const moment = require('moment-timezone');
const {
    update,
    query,
    putItem,
    queryWithPagination,
    EXCEPTIONS: {
        CONDITIONAL_CHECK_FAILED_EXCEPTION,
        VALIDATION_EXCEPTION,
        THROTTLING_EXCEPTION,
    },
} = require('./dbUtilities');
const {
    createErrorBody,
    createResponse,
} = require('../utility_functions/utilityFunctions');

const { ERROR_CODES: { INVALID_PARAMETER } } = require('../constants/errCodes');
const { RESPONSE_INTERNAL_ERROR } = require('../constants/responses');
const { WINNING_MOMENTS_STATUS } = require('../constants/common');

const { WINNING_MOMENTS_TABLE } = require('../constants/tableNames');
/**
 * Updates winning moment table by setting status to "claimed" and adding some claim details (gppUserId and win time)
 */
const setWinningMomentUnavailable = (winningMoment, gmtClaimed, gppUserId) => {
    console.log('Updating winning moment:\n', JSON.stringify(winningMoment));
    const tableParams = {
        TableName: WINNING_MOMENTS_TABLE,
        Key: {
            configuration_id: winningMoment.configuration_id,
            gmt_start: winningMoment.gmt_start,
        },
        UpdateExpression: 'remove gmt_status set #st = :status_claimed, gmt_claimed = :gmt_claimed, gpp_user_id = :gpp_user_id',
        ConditionExpression: '#st = :status_available',
        ExpressionAttributeNames: {
            // Explicit declaration of name "status" because it is dynamoDB keyword
            '#st': 'status',
        },
        ExpressionAttributeValues: {
            ':status_claimed': 'claimed',
            ':status_available': 'available',
            ':gmt_claimed': gmtClaimed.toString(),
            ':gpp_user_id': gppUserId,
        },
        ReturnValues: 'ALL_NEW',
    };
    return update(tableParams);
};

/**
 * Returns list of winning moments that are ready for claiming.
 */
const getAvailableMoment = (
    configurationId,
    requestTime,
    reachedTiers = [],
    prizeLimits = [],
    allowedViralPrizes = [],
) => {
    const queryParams = {
        TableName: WINNING_MOMENTS_TABLE,
        // gmt_status is a dynamic column and it exists only if the moment is available
        KeyConditionExpression: 'configuration_id = :configuration_id and gmt_status <= :participationTime',
        ExpressionAttributeValues: {
            ':configuration_id': configurationId,
            ':participationTime': requestTime.toString(),
        },
        IndexName: 'gppConfigurationIdAndGmtStatusIndex',
    };
    reachedTiers.forEach((tier) => {
        const filterExp = `tier <> :tier${tier}`;

        queryParams.FilterExpression = queryParams.FilterExpression ? queryParams.FilterExpression += ` AND ${filterExp}` : filterExp;
        queryParams.ExpressionAttributeValues[`:tier${tier}`] = tier;
    });
    let prizeLimitsCounter = 0;
    prizeLimits.forEach((prizeId) => {
        const filterExp = `prize_id <> :prize${prizeLimitsCounter}`;

        queryParams.FilterExpression = queryParams.FilterExpression ? queryParams.FilterExpression += ` AND ${filterExp}` : filterExp;
        queryParams.ExpressionAttributeValues[`:prize${prizeLimitsCounter}`] = `${prizeId}`;
        prizeLimitsCounter++;
    });
    allowedViralPrizes.forEach((prizeId, indx) => {
        const logicalOperator = indx === 0 ? 'AND (' : 'OR ';
        const filterExp = `prize_id = :prizeId${prizeId}`;
        queryParams.FilterExpression = queryParams.FilterExpression ? queryParams.FilterExpression += `  ${logicalOperator} ${filterExp}` : `(${filterExp}`;
        queryParams.ExpressionAttributeValues[`:prizeId${prizeId}`] = prizeId;
        if (indx === allowedViralPrizes.length - 1) queryParams.FilterExpression += ')';
    });

    const filterExp = `attribute_not_exists(gmt_end) OR gmt_end >= :gmtEnd${requestTime}`;
    queryParams.FilterExpression = queryParams.FilterExpression ? queryParams.FilterExpression += ` AND ${filterExp}` : filterExp;
    queryParams.ExpressionAttributeValues[`:gmtEnd${requestTime}`] = requestTime.toString();

    return query(queryParams, true);
};

/**
 * Updates winning moment status
 * @param winningMoment
 * @param status - new status
 */
const getUpdateWinningMomentStatusTransactionParams = (winningMoment, status) => ({
    Update: {
        TableName: WINNING_MOMENTS_TABLE,
        Key: {
            configuration_id: winningMoment.configuration_id,
            gmt_start: winningMoment.gmt_start,
        },
        UpdateExpression: 'set #st = :status',
        ExpressionAttributeNames: {
            // Explicit declaration of name "status" because it is dynamoDB keyword
            '#st': 'status',
        },
        ExpressionAttributeValues: {
            ':status': status,
        },
        ReturnValues: 'ALL_NEW',
    },
});

/**
 * Insert winning moment to DB
 * @param params - should contain "configuration_id", "gmt_start", "prize_id", "status", "user_id", "tier"
 */
const putEntry = (params) => {
    if (!params.gmtStart || !moment(+params.gmtStart).isValid()) {
        const errorBody = createErrorBody(INVALID_PARAMETER, 'Wrong date format');
        const response = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
        return Promise.reject(response);
    }

    const insertParams = {
        TableName: WINNING_MOMENTS_TABLE,
        Item: {
            configuration_id: params.configurationId,
            gmt_start: String(params.gmtStart),
            prize_id: params.prizeId,
            status: WINNING_MOMENTS_STATUS.AVAILABLE,
            tier: +params.tier,
            gmt_status: String(params.gmtStart),
            gmt_end: +params.endDate || params.endDate,
            end_of_conf: params.winningMomentExpTimestamp,
        },
        ExpressionAttributeNames: {
            '#configuration_id': 'configuration_id',
            '#gmt_start': 'gmt_start',

        },
        ConditionExpression: '#configuration_id <> :configuration_id And #gmt_start <> :gmt_start',
        ExpressionAttributeValues: {
            ':configuration_id': params.configurationId,
            ':gmt_start': String(params.gmtStart),
        },
    };
    return putItem(insertParams, false);
};

/**
 * Process array of json winning moments objects
 * and save them to winning_moments_table using putEntry
 * It will also save/show the number of the rows that failed in the end.
 * @param winningMoments - csv rows
 * @param configurationId - configurationId for which we are inserting rows
 */
const putCSVEntries = async (winningMoments, configurationId, winningMomentExpTimestamp) => {
    console.log('Received winning moments CSV entries:\n', JSON.stringify(winningMoments));
    const promises = [];
    // array of moments that should be retried
    const entriesToRetry = []; const invalidMoments = []; const
        failedMoments = [];
    const FIRST_CSV_FILE_ROW = 2;
    // csv file with header -> first row is 2
    let currentCsvRow = FIRST_CSV_FILE_ROW;
    winningMoments.forEach((winningMoment) => {
        winningMoment.csvRow = currentCsvRow;
        const promise = putEntry({ ...winningMoment, configurationId, winningMomentExpTimestamp })
            .catch((err) => {
                // check if the error is because of Condition failure -> in our case that will mean item
                // already exists
                const errorMessage = JSON.parse(err.body);
                if (errorMessage.errorDetails && errorMessage.errorDetails.DynamoDBCode === CONDITIONAL_CHECK_FAILED_EXCEPTION) {
                    errorMessage.message = 'Winning moment already exists!';
                    winningMoment.originalTimestamp = winningMoment.gmtStart;
                    const randomIntFromInterval = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
                    winningMoment.gmtStart = (parseInt(winningMoment.gmtStart) + randomIntFromInterval(-250, 250)).toString();
                    entriesToRetry.push(winningMoment);
                }
                if (errorMessage.errorDetails.DynamoDBCode === VALIDATION_EXCEPTION) {
                    console.error(`WinningMoment ${JSON.stringify(winningMoment)} contains invalid data`);
                    invalidMoments.push(winningMoment);
                    return Promise.resolve();
                }
                if (errorMessage.errorDetails && errorMessage.errorDetails.DynamoDBCode === THROTTLING_EXCEPTION) {
                    entriesToRetry.push(winningMoment);
                }
                return Promise.resolve();
            });
        currentCsvRow++;
        promises.push(promise);
    });
    await Promise.all(promises);
    console.log(`Number of winning moments CSV entries that failed to insert: ${failedMoments.length}`);
    console.log(`Number of winning moments CSV entries containing invalid data: ${invalidMoments.length}`);
    return entriesToRetry;

    // TODO: add revert process here.
    // one solution might be adding extra insertionId to table and delete all
    // fields that has it if insertion fails. To be confirmed with PO.
};

/**
 * Get winning moment transaction insert params
 * @param params - should contain "configuration_id", "gmt_start", "prize_id", "status", "user_id", "tier"
 */
const getWinningMomentTransactionInsertParams = (params) => {
    const item = {
        Put: {
            TableName: WINNING_MOMENTS_TABLE,
            Item: {
                configuration_id: params.configurationId,
                gmt_start: String(params.gmtStart),
                prize_id: params.prizeId,
                status: params.status,
                tier: +params.tier,
                end_of_conf: params.endOfConf,
            },
        },
    };

    if (params.status === WINNING_MOMENTS_STATUS.AVAILABLE) {
        item.Put.Item.gmt_status = item.Put.Item.gmt_start;
    }

    return item;
};

/**
 * Queries using index (gpp_user_id + tier) and returns records count. Represent number of prizes user won from tier.
 */
const getNumberOfUserWinsForTier = async (configurationId, gppUserId, tier) => {
    const queryParams = {
        TableName: WINNING_MOMENTS_TABLE,
        KeyConditionExpression: 'gpp_user_id = :gpp_user_id and tier = :tier',
        FilterExpression: 'configuration_id = :configuration_id AND #st <> :rejected',
        ExpressionAttributeValues: {
            ':configuration_id': configurationId,
            ':gpp_user_id': gppUserId,
            ':tier': tier,
            ':rejected': 'rejected',
        },
        ExpressionAttributeNames: {
            '#st': 'status',
        },
        IndexName: 'gppUserIdAndTierIndex',
    };
    const items = await query(queryParams);
    return items.length;
};

/**
 * Queries using index (gpp_user_id + prizeId) and returns records count. Represent number of times user won specific prize.
 */
const getNumberOfUserWinsForPrizeId = async (configurationId, gppUserId, prizeId) => {
    const queryParams = {
        TableName: WINNING_MOMENTS_TABLE,
        KeyConditionExpression: 'gpp_user_id = :gpp_user_id and prize_id = :prize_id',
        FilterExpression: 'configuration_id = :configuration_id AND #st <> :rejected',
        ExpressionAttributeValues: {
            ':configuration_id': configurationId,
            ':gpp_user_id': gppUserId,
            ':prize_id': prizeId,
            ':rejected': 'rejected',
        },
        ExpressionAttributeNames: {
            '#st': 'status',
        },
        IndexName: 'gppUserIdAndPrizeIdIndex',
    };
    const items = await query(queryParams);
    return items.length;
};

/**
 * Queries using index (gpp_user_id + prizeId) and returns first record.
 * @param configurationId - configuration id
 * @param gppUserId - voucher code
 * @param prizeId - prize id
 * @param status - status
 */
const getWinningMoment = async (configurationId, gppUserId, prizeId, status) => {
    const queryParams = {
        TableName: WINNING_MOMENTS_TABLE,
        KeyConditionExpression: 'gpp_user_id = :gpp_user_id and prize_id = :prize_id',
        FilterExpression: 'configuration_id = :configuration_id and #st = :status',
        ExpressionAttributeValues: {
            ':configuration_id': configurationId,
            ':gpp_user_id': gppUserId,
            ':prize_id': prizeId,
            ':status': status,
        },
        ExpressionAttributeNames: {
            // Explicit declaration of name "status" because it is dynamoDB keyword
            '#st': 'status',
        },
        IndexName: 'gppUserIdAndPrizeIdIndex',
    };
    const items = await query(queryParams);
    return items[0];
};

/**
 * Expire winning moments for which the prize end_date has already passed.
 * @param {Object} winningMoment
 */
const expireWinningMoments = (winningMoment) => {
    const currentTimestamp = Date.now();
    const tableParams = {
        TableName: WINNING_MOMENTS_TABLE,
        Key: {
            configuration_id: winningMoment.configuration_id,
            gmt_start: winningMoment.gmt_start,
        },
        UpdateExpression: 'remove gmt_status set #st = :status_expired, gmt_expired = :gmt_expired',
        ConditionExpression: '#st = :status_available',
        ExpressionAttributeNames: {
            // Explicit declaration of name "status" because it is dynamoDB keyword
            '#st': 'status',
        },
        ExpressionAttributeValues: {
            ':status_expired': 'expired',
            ':status_available': 'available',
            ':gmt_expired': currentTimestamp,
        },
        ReturnValues: 'ALL_NEW',
    };
    return update(tableParams);
};

/**
 * Query available winning moments for specific prize/configurationId.
 * @param {String} configurationId
 * @param {String} prizeId
 * @param {String} projection
 */
const queryMomentsPrizeAndConfiguration = (configurationId, prizeId, projection) => {
    const queryParams = {
        TableName: WINNING_MOMENTS_TABLE,
        KeyConditionExpression: 'configuration_id = :configuration_id and prize_id = :prize_id',
        FilterExpression: '#st = :status',
        ExpressionAttributeValues: {
            ':configuration_id': configurationId,
            ':prize_id': prizeId,
            ':status': 'available',
        },
        ExpressionAttributeNames: {
            '#st': 'status',
        },
        IndexName: 'configurationIdAndPrizeIdIndex',
    };

    if (projection) {
        queryParams.ProjectionExpression = projection;
    }

    return query(queryParams);
};

/**
 * Retrieves winning moments from the database based on the provided configuration ID.
 *
 * @param {string} configId - The configuration ID used to query the Winning Moments table.
 * @param {string} prize_id - The prize ID used to query the Winning Moments table.
 * @returns {Promise<Object>} - A promise that resolves to the queried winning moments data.
 */
const getPaginatedWinningMoments = (configId, prize_id, lastEvaluatedKey, limit) => {
    const params = {
        TableName: WINNING_MOMENTS_TABLE,
        KeyConditionExpression: 'configuration_id = :configuration_id and prize_id = :prize_id',
        ExpressionAttributeValues: {
            ':configuration_id': configId,
            ':prize_id': prize_id,
        },
        IndexName: 'configurationIdAndPrizeIdIndex',
    };
    if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const keyAttributes = ['configuration_id', 'gmt_start', 'prize_id'];

    return queryWithPagination(params, !!limit, limit, keyAttributes);
};

module.exports = {
    setWinningMomentUnavailable,
    getAvailableMoment,
    getUpdateWinningMomentStatusTransactionParams,
    putCSVEntries,
    putEntry,
    getWinningMomentTransactionInsertParams,
    getNumberOfUserWinsForTier,
    getNumberOfUserWinsForPrizeId,
    getWinningMoment,
    expireWinningMoments,
    queryMomentsPrizeAndConfiguration,
    getPaginatedWinningMoments,
};
