const { query } = require('./dbUtilities');
const { GPP_CLIENTS_SIGNATURE_TABLE } = require('../constants/tableNames');
/**
 * Function that queries DynamoDB with passed in expression and expressionValues.
 * @param {String} expression - used for query KeyConditionExpression
 * @param {String} expressionValues - values to be used in KeyConditionExpression
* @returns {Promise} with {@link DBUtils.query} result
 */
const queryTable = (expression, expressionValues) => {
    const queryParams = {
        TableName: GPP_CLIENTS_SIGNATURE_TABLE,
        KeyConditionExpression: expression,
        ExpressionAttributeValues: expressionValues,
    };
    return query(queryParams);
};

/**
 * Function that returns resulst from DynamoDB for given key/configId pair
 * @param {String} accessKey - AWS access key ID extraxted from request
 * @param {String} configId - configuratioId received from request
 * @returns {Promise<any>} - resolved for DynamoDB query result.
 */
const getClientConfigurations = (accessKey, configId) => {
    const expression = 'access_key = :access_key AND config_id = :config_id';
    const expressionValues = {
        ':access_key': accessKey,
        ':config_id': configId,
    };
    return queryTable(expression, expressionValues);
};

module.exports = {
    getClientConfigurations,
};
