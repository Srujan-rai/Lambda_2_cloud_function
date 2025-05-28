const bluebird = require('bluebird');
const DBUtils = require('./dbUtilities');
const {
    splitArray,
} = require('../utility_functions/utilityFunctions');
const { GPP_BLOCKED_USERS_TABLE } = require('../constants/tableNames');
/**
 * Core query function for blocked users database.
 */
module.exports.MANDATORY_PARAMS = ['userId', 'configurationId', 'reason', 'enteredById', 'requestedById'];

const query = (expression, expressionValues) => {
    const queryParams = {
        TableName: GPP_BLOCKED_USERS_TABLE,
        KeyConditionExpression: expression,
        ExpressionAttributeValues: expressionValues,
    };
    return DBUtils.query(queryParams, false);
};

/**
 * Return user blocking records for provided user id and configuration id.
 * @param gppUserId - concatenation of userId and userIdType
 */
module.exports.getUserBlockingRecords = (gppUserId) => {
    const expression = 'gpp_user_id = :gpp_user_id';
    const expressionValues = {
        ':gpp_user_id': gppUserId,
    };
    return query(expression, expressionValues);
};

/**
 * Function for putting user into gpp_blocked_users_table
 * @param params are received via post call
 * @returns {*} Promise of Error or Success insert
 */
module.exports.putEntry = (params) => {
    const tableParams = {
        TableName: GPP_BLOCKED_USERS_TABLE,
        Item: {
            gpp_user_id: params.gppUserId,
            configuration_id: params.configurationId,
            blocked_timestamp: new Date().getTime(),
            reason: params.reason,
            entered_by_id: params.enteredById,
            requested_by_id: params.requestedById,
            title: params.title,
            end_of_conf: params.expirationTimestamp,
        },
    };
    return DBUtils.putItem(tableParams);
};

/**
 * Remove blocked consumer from Blocked Users Table
 * @param gppUserId
 * @param configurationId
 * @returns {Promise}
 */
module.exports.deleteBlockedConsumer = (gppUserId, configurationId) => {
    const key = {
        gpp_user_id: gppUserId,
        configuration_id: configurationId,
    };
    const expression = 'gpp_user_id = :gpp_user_id AND configuration_id = :configuration_id';
    const expressionValues = {
        ':gpp_user_id': gppUserId,
        ':configuration_id': configurationId,
    };
    const tableParams = {
        TableName: GPP_BLOCKED_USERS_TABLE,
        Key: key,
        ConditionExpression: expression,
        ExpressionAttributeValues: expressionValues,
        ReturnValues: 'ALL_OLD',
    };
    return DBUtils.deleteItem(tableParams);
};

module.exports.writeBlockedToDynamoDB = async (recordsArray, reason, title) => {
    const maxBatchSize = 25;

    const uniqueUsers = Array.from(new Set(recordsArray));
    console.log(`Blocking ${uniqueUsers.length} users`);
    const chunkedUsers = splitArray(uniqueUsers, maxBatchSize);
    try {
        await bluebird.map(
            chunkedUsers, (chunk) => processRecordBatches(chunk, reason, title), { concurrency: 5 },
        );
    } catch (error) {
        console.error('Error while blocking users', error);
    }
};

const processRecordBatches = async (chunk, reason, title) => {
    const tableName = GPP_BLOCKED_USERS_TABLE;
    const params = {
        RequestItems: {
            [tableName]: chunk.map((userId) => ({
                PutRequest: {
                    Item: {
                        gpp_user_id: `${userId}|cds`,
                        configuration_id: '*',
                        blocked_timestamp: new Date().getTime(),
                        reason,
                        title,
                    },
                },
            })),
        },
    };

    const data = await DBUtils.batchWriteToPromise(params);
    if (data.UnprocessedItems[tableName]?.length) {
        await DBUtils.processUnprocessedItems(data.UnprocessedItems[tableName], tableName);
    }
};
