const DBUtils = require('./dbUtilities');
const Utils = require('../utility_functions/utilityFunctions');
const { GDPR_REQUEST_TYPES } = require('../constants/common');
const { GDPR_REQUESTS_TABLE } = require('../constants/tableNames');
/**
 * Method for inserting new GDPR request to table.
 *
 * @param {Object} params - Parameters for inserting new item
 * @returns {Promise<any>} - Promise response containing the result of DB put item operation
 */
const putEntry = (params) => {
    console.log('Received GDPR request insert params:\n', JSON.stringify(params));

    const insertParams = {
        TableName: GDPR_REQUESTS_TABLE,
        Item: {
            gpp_user_id: Utils.createGppUserId(params.userId),
            timestamp: new Date().getTime(),
            request_type: params.requestType,
            jira_number: params.jiraNumber,
            requester_user_id: params.requesterUserId,
        },
    };
    return DBUtils.putItem(insertParams);
};

/**
 * Core function for all user table queries. Special queries are defining special rules but should rely on this method
 * in the end.
 *
 * @param {string} expression - The condition that specifies the key values for items to be retrieved by the Query action
 * @param {string} filterExpression - The condition for filtering Query result
 * @param {Object} expressionValues - One or more values that can be substituted in an expression
 * @param {Integer} [index] - The name of an index to query
 * @returns {Promise<any>} - Promise response containing the result of DB query item operation
 */
const query = (expression, filterExpression, expressionValues, index) => {
    const queryParams = {
        TableName: GDPR_REQUESTS_TABLE,
        KeyConditionExpression: expression,
        ExpressionAttributeValues: expressionValues,
        FilterExpression: filterExpression,
    };
    if (index) {
        queryParams.IndexName = index;
    }
    return DBUtils.query(queryParams);
};

/**
 * Query all GDPR requests for a specific user
 *
 * @param {string} gppUserId - Target user's gpp_user_id
 * @returns {Promise<any>} - Promise response containing the result of DB query item operation
 */
const queryByUser = (gppUserId) => {
    const expression = 'gpp_user_id = :gpp_user_id';
    const expressionValues = {
        ':gpp_user_id': gppUserId,
    };
    return query(expression, '', expressionValues);
};

/**
 * Query all GDPR requests for a specific user and request type
 *
 * @param {string} gppUserId - Target user's gpp_user_id
 * @param {string} requestType - Type of a request
 * @returns {Promise<any>} - Promise response containing the result of DB query item operation
 */
const queryByUserAndRequestType = (gppUserId, requestType) => {
    const expression = 'gpp_user_id = :gpp_user_id';
    const expressionValues = {
        ':gpp_user_id': gppUserId,
        ':request_type': requestType,
    };
    const filterExpression = 'contains (request_type, :request_type)';
    return query(expression, filterExpression, expressionValues);
};

/**
 * Query all GDPR requests for a specific user and JIRA number
 *
 * @param {string} gppUserId - Target user's gpp_user_id
 * @param {string} jiraNumber - Target JIRA number
 * @returns {Promise<any>} - Promise response containing the result of DB query item operation
 */
const queryByUserAndJiraNumber = (gppUserId, jiraNumber) => {
    const expression = 'gpp_user_id = :gpp_user_id AND jira_number = :jira_number';
    const expressionValues = {
        ':gpp_user_id': gppUserId,
        ':jira_number': jiraNumber,
    };
    const filterExpression = 'contains (jira_number, :jira_number)';
    return query(expression, filterExpression, expressionValues);
};

/**
 * Check if user is deleted
 *
 * @param gppUserId {string} User's userId
 * @returns {Promise<any>} - Promise object containing result if user is deleted or not
 */
const checkIsUserDeleted = async (gppUserId) => {
    console.log('Checking if user is deleted...');

    const result = await queryByUserAndRequestType(gppUserId, GDPR_REQUEST_TYPES.deletion);

    const deleted = result && result.length > 0;
    console.log('Is user deleted result:', deleted);
    return Promise.resolve({
        userId: gppUserId,
        deleted,
    });
};

module.exports = {
    putEntry,
    queryByUser,
    queryByUserAndRequestType,
    queryByUserAndJiraNumber,
    checkIsUserDeleted,
};
