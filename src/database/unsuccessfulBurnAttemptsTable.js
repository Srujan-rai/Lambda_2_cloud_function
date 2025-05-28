const uniqid = require('uniqid');
const {
    getInsertDate,
    putItem,
    batchWrite,
    countQuery,
    query: DBQuery,
} = require('./dbUtilities');
const { copyAsSnakeCase } = require('../utility_functions/utilityFunctions');
const { UNSUCCESSFUL_BURN_ATTEMPTS_TABLE } = require('../constants/tableNames');

const query = (expression, expressionValues, index, filterExpression, expressionAttributeNames, count) => {
    const queryParams = {
        TableName: UNSUCCESSFUL_BURN_ATTEMPTS_TABLE,
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
 * Method for inserting new unsuccessful burn attemps to DynamoDB. Here the passed
 * payload is enrichied with timestamp and entry date for analytical purposes.
 * @param {object} payload - data that will be stored (configurationId, gppUserId, etc.)
 */
const saveItem = async (payload) => {
    const timestamp = new Date().getTime();
    const entryDate = getInsertDate(timestamp);
    const { pincode } = payload.pincodeError;
    const { configurationId } = payload;
    const { gppUserId } = payload;
    const transactionId = payload.pincodeError.mixCodesTransactionId
        ? payload.pincodeError.mixCodesTransactionId : `code-validation-error-${uniqid()}`;
    const endOfConf = payload.expirationTimestamp;
    const insertParams = {
        Item: copyAsSnakeCase({
            ...payload.pincodeError, configurationId, gppUserId, timestamp, entryDate, pincode, transactionId, endOfConf,
        }),
        TableName: UNSUCCESSFUL_BURN_ATTEMPTS_TABLE,
    };
    return putItem(insertParams);
};

/**
 * Method for inserting multiple unsuccessful burn items to DynamoDB.
 * @param {Array} errors - data that will be stored (configurationId, gppUserId, etc.)
 * @param {String} configurationId - data that will be stored (configurationId, gppUserId, etc.)
 * @param {String} gppUserId - data that will be stored (configurationId, gppUserId, etc.)
 */
const batchSaveErrors = (errors, configurationId, gppUserId) => {
    const insertParams = {
        RequestItems: {
            [UNSUCCESSFUL_BURN_ATTEMPTS_TABLE]: [],
        },
    };
    const timestamp = new Date().getTime();
    const entryDate = getInsertDate(timestamp);
    const transactionId = errors.mixCodesTransactionId
        ? errors.mixCodesTransactionId : `code-validation-error-${uniqid()}`;
    const { pincode } = errors.pincodeError;

    const insertItem = {
        PutRequest: {
            Item: copyAsSnakeCase({
                ...errors.pincodeError, pincode, timestamp, entryDate, configurationId, gppUserId, transactionId,
            }),
        },
    };

    insertParams.RequestItems[UNSUCCESSFUL_BURN_ATTEMPTS_TABLE].push(insertItem);

    return batchWrite(insertParams);
};

/**
 * Query unsuccessfulBurnAttempsTable DB. Uses gpp_user_id. If there is a filter will be transfered to query method
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
const queryByGppUserId = (
    userId,
    filterExpression,
    filterValues,
    expressionAttributeNames,
    count,
) => {
    const expression = 'gpp_user_id = :gpp_user_id';

    let expressionValues = {
        ':gpp_user_id': userId,
    };

    if (filterValues) {
        expressionValues = { ...expressionValues, ...filterValues };
    }

    const index = 'gpp_user_id';

    return query(expression, expressionValues, index, filterExpression, expressionAttributeNames, count);
};

module.exports = {
    saveItem,
    batchSaveErrors,
    queryByGppUserId,
};
