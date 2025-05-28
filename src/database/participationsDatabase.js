const uniqid = require('uniqid');
const {
    getInsertDate,
    getPutTableParams,
    putItem,
    countQuery,
    queryWithPagination,
    query: DBQuery,
    get: DBGet,
} = require('./dbUtilities');
const {
    copyAsSnakeCase,
    createErrorBody,
    createResponse,
} = require('../utility_functions/utilityFunctions');
const { ERROR_CODES } = require('../constants/errCodes');
const { RESPONSE_BAD_REQUEST } = require('../constants/responses');
const { PARAMS_MAP: { GPP_USER_ID } } = require('../constants/common');
const { GPP_PARTICIPATIONS_TABLE } = require('../constants/tableNames');
const { PROD_STAGE_NAMES } = require('../constants/stages');

/**
 * Method for inserting new participation.
 *
 * @param {string} gppUserId - HASH key for participation table.
 * @param {string} requestId - RANGE key for participation table, represents actual requestId received by lambda invoke event.
 * @param {Object} params - dynamic attributes for insert.
 *
 * @returns {Promise} result of {@link putItem}
 */
const putEntry = (gppUserId, requestId, params) => {
    const snakeCaseParams = copyAsSnakeCase(params);

    if (Object.prototype.hasOwnProperty.call(snakeCaseParams, 'redeemed_prize')) {
        snakeCaseParams.prize_id = snakeCaseParams.redeemed_prize.prize_id;
    }

    if (snakeCaseParams.inserted_transactions?.end_of_conf) {
        snakeCaseParams.end_of_conf = snakeCaseParams.inserted_transactions?.end_of_conf;
    }

    const participationId = snakeCaseParams.participation_id ? snakeCaseParams.participation_id : uniqid();
    const participationTime = Date.now().toString();

    const snakeCaseItem = {
        ...snakeCaseParams,
        gpp_user_id: gppUserId,
        request_id: requestId,
        participation_id: participationId,
        participation_time: participationTime,
        entry_date: getInsertDate(),
    };

    const tableParams = getPutTableParams(snakeCaseItem, GPP_PARTICIPATIONS_TABLE);
    return putItem(tableParams);
};

/**
 * Core query function for participation database. All special queries should rely on this one.
 *
 * @param {string} expression - DynamoDB's KeyConditionExpression
 * @param {Object} expressionValues - DynamoDB's ExpressionAttributeValues
 * @param {string} index - optional parameter. Represent IndexName for query.
 * @param {string} filterExpression - optional parameter. Represent FilterExpression for query
 * @param {Object} expressionAttributeNames - optional parameter. Represent ExpressionAttributeNames for query
 * @param {Boolean} count - optional parameter. If provided Select: 'COUNT' will be added to the query
 *
 * @returns {Promise} with {@link query} result
 */
const query = (expression, expressionValues, index, filterExpression, expressionAttributeNames, count) => {
    const queryParams = {
        TableName: GPP_PARTICIPATIONS_TABLE,
        KeyConditionExpression: expression,
        ExpressionAttributeValues: expressionValues,
    };
    if (index) {
        queryParams.IndexName = index;
    }
    if (filterExpression) {
        queryParams.FilterExpression = filterExpression;
    }
    if (expressionAttributeNames) {
        queryParams.ExpressionAttributeNames = expressionAttributeNames;
    }

    return count ? countQuery(queryParams) : DBQuery(queryParams, false);
};

/**
 * Get Item from participation's database using gppUserID and RequestID
 * @param {string} gppUserId - HASH key for participation table
 * @param {string} requestId - RANGE key for participation table, value from lambda invocation event
 * @param {boolean} stronglyConsistentRead - optional parameter. If provided will be used for strongly consistent read
 * @returns {Promise} {@link get} result.
 */
const get = (gppUserId, requestId, stronglyConsistentRead) => {
    const getParams = {
        TableName: GPP_PARTICIPATIONS_TABLE,
        Key: {
            gpp_user_id: gppUserId,
            request_id: requestId,
        },
        ...stronglyConsistentRead && { ConsistentRead: true },
    };
    return DBGet(getParams);
};

/**
 * Adds record to existing participation row, or creates new one.
 *
 * @param {string} gppUserId - HASH key for participation table
 * @param {string} requestId - RANGE key for participation table, value from lambda invocation event
 * @param {Object} insertParams - other dynamic attributes for insert
 *
 * @returns {Promise} result of {@link putEntry}
 */
const createOrAppend = async (gppUserId, requestId, insertParams) => {
    const stronglyConsistentRead = PROD_STAGE_NAMES.includes(process.env.stageName);
    const items = await get(gppUserId, requestId, stronglyConsistentRead);
    const currentItem = items ? items[0] : undefined;
    if (currentItem && currentItem.inserted_transactions && insertParams.insertedTransactions) {
        currentItem.inserted_transactions = currentItem.inserted_transactions.concat(insertParams.insertedTransactions);
        delete insertParams.insertedTransactions;
    }
    const mergedParams = { ...currentItem, ...insertParams };
    return putEntry(gppUserId, requestId, mergedParams);
};

/**
 * Does the same as {@link createOrAppend} but with more "lambda-friendly" parameters.
 *
 * @param {Object} params - lambda invoke event params
 * @param {Object} requestId - lambda invoke requestId
 * @param {Object} insertionObject - other dynamic attributes for insert
 *
 * @returns {Promise} result of {@link createOrAppend}
 */
const addItemToParticipation = (params, requestId, insertionObject) => {
    insertionObject.configurationId = Object.prototype.hasOwnProperty.call(params, 'configurationId') ? params.configurationId : undefined;
    insertionObject.optionalInformation = Object.prototype.hasOwnProperty.call(params, 'optionalInformation') ? params.optionalInformation : undefined;
    if (params.ref_code) {
        insertionObject.refCode = params.ref_code;
    }
    if (params.participationId) {
        insertionObject.participationId = params.participationId;
    }
    if (params.country) {
        insertionObject.country = params.country;
    }
    console.log('Adding item to participation:\n', JSON.stringify(insertionObject));
    return createOrAppend(params[GPP_USER_ID], requestId, insertionObject);
};

/**
 * Query on participation database. Uses gppUserId + prizeId)
 *
 * @param {string} gppUserId - HASH key for participation table
 * @param {string} prizeId - RANGE key for participation table, value from lambda invocation event
 * @param {Object} filters - Optional, if provided, it shoulde includes filterExpression, filterValues,
 * and expressionAttributeNames if the field name is a reserved word
 *
 * @returns {Promise} {@link query} result.
 */
const queryByGppUserIdAndPrizeId = (gppUserId, prizeId, filters) => {
    const expression = 'gpp_user_id = :gpp_user_id AND prize_id = :prize_id';

    const expressionValues = {
        ':gpp_user_id': gppUserId,
        ':prize_id': prizeId,
    };

    const index = 'user_and_prize_id';

    if (filters) {
        const { filterExpression, filterValues, expressionAttributeNames } = filters;

        if (!filterExpression || !filterValues) throw new Error('Missing expressions in filters');

        return query(expression, { ...expressionValues, ...filterValues }, index, filterExpression, expressionAttributeNames);
    }

    return query(expression, expressionValues, index);
};

/**
 * Create query filters based on the participation status
 *
 * @param {string} statusValue - participation status
 * @param {string} comparator - the comparator to use for the filter
 *
 * @returns {Object} filters for the query
 */
const generateFiltersByStatus = ({ statusValue, comparator }) => {
    const filters = {
        filterExpression: `#st ${comparator} :status`,
        filterValues: {
            ':status': statusValue,
        },
        expressionAttributeNames: {
            '#st': 'status',
        },
    };

    return filters;
};

/**
 * Query participation DB. Uses gpp_user_id and participation_time. If there is a filter will be transfered to query method
 *
 * @param {string} userId - HASH key - corresponds to gpp_user_id
 * @param {string} startDate - RANGE key corresponds to participation_time - start date timestamp
 * @param {string} endDate - RANGE key corresponds to participation_time - end date timestamp
 * @param {string} filterExpression - Optional, will be transferred to query method
 * @param {Object} filterValues - if provided will be appended to expressionValues Object
 * @param {Object} expressionAttributeNames - Optional, will be transferred to query method
 * @param {Boolean} count - if provided the query will return the count only
 *
 * @returns {Promise} {@link query} result.
 */
const queryByGppUserIdAndParticipationTimestamp = (
    userId,
    startDate,
    endDate,
    filterExpression,
    filterValues,
    expressionAttributeNames,
    count,
) => {
    const expression = 'gpp_user_id = :gpp_user_id AND participation_time BETWEEN :start_date AND :end_date';
    let expressionValues = {
        ':gpp_user_id': userId,
        ':start_date': `${startDate}`,
        ':end_date': `${endDate || new Date().getTime()}`,
    };

    if (filterValues) {
        expressionValues = { ...expressionValues, ...filterValues };
    }

    const index = 'user_and_timestamp';

    return query(expression, expressionValues, index, filterExpression, expressionAttributeNames, count);
};

/**
 * Query participation DB with given userId and timestamp and will filter the result by existence of successfulBurns
 *
 * @param {string} userId - HASH key - corresponds to gpp_user_id
 * @param {string} timestamp - RANGE key corresponds to participation_time
 * @param {string} configId - configuration id
 *
 * @returns {Promise} {@link query} result.
 */
const getUserParticipationsIfsuccessfulBurnsExists = (userId, timestamp, configId) => queryByGppUserIdAndParticipationTimestamp(
    userId, timestamp, undefined,
    'attribute_exists(successful_burns) AND configuration_id = :configuration_id', { ':configuration_id': configId },
);

/**
 * Query that will return all participations for the specified configurationId.
 * @param {string} configurationId
 * @param {boolean} paginateResult - true/false whether LastEvaluatedKey should be returned
 * @param {string} nextKey - the ExclusiveStartKey for the query
 */
const queryByConfiguration = (configurationId, paginateResult, nextKey) => {
    const expression = 'configuration_id = :configuration_id';
    const expressionValues = {
        ':configuration_id': configurationId,
    };
    const index = 'configuration_id';

    const queryParams = {
        TableName: GPP_PARTICIPATIONS_TABLE,
        KeyConditionExpression: expression,
        ExpressionAttributeValues: expressionValues,
        IndexName: index,
    };

    if (nextKey) {
        queryParams.ExclusiveStartKey = nextKey;
    }

    return paginateResult ? queryWithPagination(queryParams, paginateResult) : DBQuery(queryParams);
};

/**
 * Query participation DB with given userId and timestamp and will filter the result by existence of an attribute
 *
 * @param {string} attr - The given attribute which you want to check if it exists
 * @param {string} userId - HASH key - corresponds to gpp_user_id
 * @param {string} timestamp - RANGE key corresponds to participation_time
 * @param {string} configId - configuration id
 *
 * @returns {Promise} {@link query} result.
 */
const getUserParticipationsIfAttributeExists = (
    attr,
    userId,
    startTimestamp,
    endTimestamp,
    configId,
) => queryByGppUserIdAndParticipationTimestamp(
    userId, startTimestamp, endTimestamp,
    `attribute_exists(${attr}) AND configuration_id = :configuration_id AND #st <> :status`,
    { ':configuration_id': configId, ':status': 'reverted' },
    { '#st': 'status' },
    true,
);

/**
 * Query that will return all participation of user in configuration between specific timestamps.
 */

const getUserParticipationsDataIfAttributeExists = (
    attr,
    userId,
    startTimestamp,
    endTimestamp,
    configId,
) => queryByGppUserIdAndParticipationTimestamp(
    userId, startTimestamp, endTimestamp,
    `attribute_exists(${attr}) AND configuration_id = :configuration_id AND #st <> :status`,
    { ':configuration_id': configId, ':status': 'reverted' },
    { '#st': 'status' },
);
/**
 * Query that will return all participations for the specified participationId.
 * @param participationId
 */
const queryByParticipationId = (participationId) => {
    const expression = 'participation_id = :participation_id';
    const expressionValues = {
        ':participation_id': participationId,
    };
    const index = 'participationIdIndex';
    return query(expression, expressionValues, index);
};

/**
 * create transaction for updating status in redeemed_prize.
 * @param participationId
 * @param status
 */
const updateParticipationRedeemedPrizeStatusTransaction = (participationKey, status) => ({
    TableName: GPP_PARTICIPATIONS_TABLE,
    Key: {
        gpp_user_id: participationKey.gpp_user_id,
        request_id: participationKey.request_id,
    },
    UpdateExpression: 'set #redeemedPrize.#st = :new_status',

    ExpressionAttributeValues: {
        ':new_status': status,
    },
    ExpressionAttributeNames: {
        '#redeemedPrize': 'redeemed_prize',
        '#st': 'status',
    },
    ReturnValues: 'ALL_NEW',
});

/**
 * sets transaction params for updating participation status and instant_win_winner
 * @param gppUserId - HASH key
 * @param requestId - SORT key
 * @param status - participation status
 */
const getParticipationStatusTransactionParams = (gppUserId, requestId, status) => ({
    Update: {
        TableName: GPP_PARTICIPATIONS_TABLE,
        Key: {
            gpp_user_id: gppUserId,
            request_id: requestId,
        },
        UpdateExpression: 'set #st = :status, #instant = :instant_win_winner',
        ExpressionAttributeValues: {
            ':status': status,
            ':instant_win_winner': false,
        },
        ExpressionAttributeNames: {
            // Explicit declaration of name "status" because it is dynamoDB keyword
            '#st': 'status',
            '#instant': 'instant_win_winner',
        },
        ReturnValues: 'ALL_NEW',
    },
});

/**
 * Query that will return all participations given config and prize Id.
 * @param configurationId - HASH key
 * @param prizeId - SORT key
 *
 * * @returns {Promise} {@link query} result.
 */
const queryByConfigurationIdPlusPrizeId = (configurationId, prizeId) => {
    const expression = 'configuration_id = :configuration_id';
    const expressionValues = {
        ':configuration_id': configurationId,
        ':prize_id': prizeId,
    };
    const index = 'configuration_id';

    const filterExpression = 'prize_id = :prize_id';

    return query(expression, expressionValues, index, filterExpression);
};

/**
 * Query that will return all participations given config and date.
 * @param configurationId - HASH key
 * @param entryDate - SORT key
 *
 * * @returns {Promise} {@link query} result.
 */
const queryByConfigurationAndDate = (configurationId, entryDate) => {
    const expression = 'configuration_id = :configuration_id AND entry_date = :entry_date';
    const expressionValues = {
        ':configuration_id': configurationId,
        ':entry_date': entryDate,
    };
    const index = 'configuration_id_and_entry_date';
    return query(expression, expressionValues, index);
};

/**
 * Query that will return all participations given config and date.
 * @param configurationId - HASH key
 * @param entryDate - SORT key
 *
 * * @returns {Promise} {@link query} result.
 */
const queryByConfigurationAndBetweenDates = (configurationId, startDate, endDate) => {
    const expression = 'configuration_id = :configuration_id';
    const filterExpression = 'entry_date Between :start_date AND :end_date';
    const expressionValues = {
        ':configuration_id': configurationId,
        ':start_date': startDate,
        ':end_date': endDate,
    };
    const index = 'configuration_id';
    return query(expression, expressionValues, index, filterExpression);
};

/**
 * Query all participations of the user during the given experience
 * @param gppUserId - HASH key
 * @param configurationId - Id of the experience
 */
const getInstantWinWinningParticipationsFromConfiguration = (configurationId, gppUserId) => {
    const expression = 'gpp_user_id = :gpp_user_id';
    const filterExpression = 'configuration_id = :configuration_id AND instant_win_winner = :instant_win_winner';
    const index = 'user_and_timestamp';
    const expressionAttributeValues = {
        ':configuration_id': configurationId,
        ':gpp_user_id': gppUserId,
        ':instant_win_winner': true,
    };

    return query(expression, expressionAttributeValues, index, filterExpression, null, false);
};

/**
 * Checking how many time the user has redeemed prize*
 *
 * @param {Object} params - client parameters (originally received by lambda invoke event)
 * @param {Object} prizeDetails - record from prize catalogue table
 * @param {number} prizeLimitation - allowed number of prize redeems per user
 *
 * @returns {Promise<any>} prizeDetails - record from prize catalogue table
 */
const checkIfUserReachRedemptionLimit = async (params, prizeDetails, prizeLimitation) => {
    const { gppUserId, prizeId } = params;
    const filters = generateFiltersByStatus({
        statusValue: 'reverted',
        comparator: '<>',
    });
    const participationItems = await queryByGppUserIdAndPrizeId(gppUserId, prizeId, filters);
    const numberOfParticipations = participationItems.length;
    if (prizeLimitation > numberOfParticipations) {
        return prizeDetails;
    }
    console.error('User has reached the number of participations.');
    const errorBody = createErrorBody(ERROR_CODES.FLOW_LAMBDA_REJECTION,
        'Redemption Limit for this prize has been reached', { errorDetails: 'User reached redemption limit' });
    throw createResponse(RESPONSE_BAD_REQUEST, errorBody);
};

/**
 * Checking for redemption limit *
 *
 * @param {Object} params - client parameters (originally received by lambda invoke event)
 * @param {Object} prizeDetails - record from prize catalogue table
 *
 * @returns {Promise<any>} prizeDetails - record from prize catalogue table
 */
const checkForRedemptionLimit = (params, prizeDetails) => {
    const prizeLimitation = typeof prizeDetails.redemption_limit === 'string' ? prizeDetails.redemption_limit.toLowerCase() : prizeDetails.redemption_limit;

    if (!prizeLimitation || prizeLimitation === 'none') {
        return Promise.resolve(prizeDetails);
    }
    return checkIfUserReachRedemptionLimit(params, prizeDetails, prizeLimitation);
};

module.exports = {
    putEntry,
    get,
    createOrAppend,
    addItemToParticipation,
    queryByGppUserIdAndPrizeId,
    queryByGppUserIdAndParticipationTimestamp,
    getUserParticipationsIfsuccessfulBurnsExists,
    queryByConfiguration,
    getUserParticipationsIfAttributeExists,
    queryByParticipationId,
    updateParticipationRedeemedPrizeStatusTransaction,
    getParticipationStatusTransactionParams,
    queryByConfigurationIdPlusPrizeId,
    queryByConfigurationAndDate,
    queryByConfigurationAndBetweenDates,
    getInstantWinWinningParticipationsFromConfiguration,
    checkForRedemptionLimit,
    getUserParticipationsDataIfAttributeExists,
    generateFiltersByStatus,
};
