const reflect = require('p-reflect');
const contentDisposition = require('content-disposition');
const dbUtils = require('../database/dbUtilities');
const databaseSchemaUtils = require('../database/databaseSchemaUtils');
const Utils = require('../utility_functions/utilityFunctions');
const { saveToS3 } = require('../utility_functions/aws_sdk_utils/s3Utilities');
const { GPP_BLOCKED_USERS_TABLE, GDPR_REQUESTS_TABLE } = require('../constants/tableNames');

const REQUIRED_PARAMETERS = ['queryParams', 'queryValues', 'tables'];
const { ERROR_CODES: { NOT_FOUND } } = require('../constants/errCodes');
const { RESPONSE_BAD_REQUEST } = require('../constants/responses');
/**
 * Adds table column names to the passed query table data.
 *
 * @param {Object} data - Query table data
 */
const addTableColumns = (data) => {
    data.forEach((item) => {
        item.columns = Utils.beautifyColumnNames(databaseSchemaUtils.getTableColumns(item.tableName));
    });
};

/**
 * Exports DynamoDB data to S3 in CSV
 *
 * @param {Array} data - DynamoDB data for exporting
 * @param {string} filePrefix - File prefix for CSV files
 * @return {Promise} - Returns Promise with exported DynamoDB data
 */
const exportTosS3inCSV = (data, filePrefix) => {
    console.log('Exporting file to CSV and storing it in S3 bucket...');
    const promises = [];

    data.forEach((item) => {
        if (item.data || item.data.length) {
            promises.push(Utils.exportToCSV({
                data: item.data,
                fields: databaseSchemaUtils.getTableColumns(item.tableName),
            })
                .then((csv) => {
                    let fileName;

                    if (filePrefix) {
                        fileName = `analysis/${filePrefix}/${filePrefix}_${item.tableName}_${new Date().getTime()}.csv`;
                    } else {
                        fileName = `analysis/${item.tableName}/${item.tableName}_${new Date().getTime()}.csv`;
                    }

                    item.fileName = fileName;

                    return saveToS3({
                        Key: fileName,
                        Body: csv,
                        Bucket: process.env.PRIVATE_BUCKET,
                        ContentType: 'text/csv',
                        ContentDisposition: contentDisposition(fileName, {
                            type: 'inline',
                        }),
                    });
                }));
        }
    });

    return Promise.all(promises).then(() => data);
};

/**
 * Removing not user PII data
 *
 * @param {Array} data - Exported data
 * @param {string} tableName - Table name
 * @returns {Array} - Filtered data
 */
const removingNotUserPIIdata = (data, tableName) => {
    const TABLE_DATA_THAT_NEEDS_TO_BE_REMOVED_FROM_GDPR_EXPORT = {
        [GPP_BLOCKED_USERS_TABLE]: ['requested_by_id', 'entered_by_id'],
        [GDPR_REQUESTS_TABLE]: ['requester_user_id'],
    };

    if (!data || !Array.isArray(data)) {
        return data;
    }
    const fileds = TABLE_DATA_THAT_NEEDS_TO_BE_REMOVED_FROM_GDPR_EXPORT[tableName];
    if (!fileds) {
        return data;
    }
    return data.map((item) => {
        fileds.forEach((filed) => delete item[filed]);
        return item;
    });
};

/**
 * Process the result from the DynamoDB query
 *
 * @param {Array} queryResult - Result from the query
 * @param {Array} queryParams - Query params
 * @param {Array} params - Flow params
 * @returns {Array} - Processed result
 */
const processResult = (queryResult, queryParams, params) => {
    const processedResult = [];

    queryResult.forEach((result, i) => {
        if (result.isFulfilled && result.value && result.value.length) {
            processedResult.push({
                data: params.removeNotUserPII ? removingNotUserPIIdata(result.value, queryParams[i].TableName) : result.value,
                tableName: queryParams[i].TableName,
            });
        }
    });

    return processedResult;
};

/**
 * Construct DynamoDB query parameters object
 *
 * @param {Array} queryParams - Query parameters for KeyConditionExpression
 * @param {Object} expAttrValues - ExpressionAttributeValues
 * @param {string} tableName - Table name
 * @param {string} index - Index name
 * @param {Array} filterParams - Filter parameters for FilterExpression
 * @returns {Object} - Returns constructed query parameters
 */
const constructQueryParams = (queryParams, expAttrValues, tableName, index, filterParams) => {
    const params = {
        TableName: tableName,
        KeyConditionExpression: dbUtils.combineQueryParams(queryParams),
        ExpressionAttributeValues: expAttrValues,
        FilterExpression: dbUtils.combineQueryParams(filterParams),
    };

    if (index) {
        params.IndexName = index;
    }

    return params;
};

/**
 * Prepare parameters for the DynamoDB query and splits them by tables
 *
 * @param {Object} params - Query params
 * @returns {Array} Query params array
 */
const prepareQueryParams = (params) => {
    const queryParameters = params.queryParams.split(',');
    const queryParametersValues = params.queryValues.split(',');
    const filterParameters = Object.prototype.hasOwnProperty.call(params, 'filterParams') ? params.filterParams.split(',') : undefined;
    const filterParametersValues = Object.prototype.hasOwnProperty.call(params, 'filterValues') ? params.filterValues.split(',') : undefined;
    const expAttrValues = dbUtils.combineQueryValues(queryParametersValues, queryParameters, filterParametersValues,
        filterParameters);

    if (Object.prototype.hasOwnProperty.call(expAttrValues, ':gpp_user_id')) {
        expAttrValues[':gpp_user_id'] = Utils.createGppUserId(expAttrValues[':gpp_user_id']);
    }

    const queryParamsArr = [];

    params.tables.forEach((table) => {
        const partitionKey = queryParameters[0];
        let index;
        if (!databaseSchemaUtils.checkIfTablesHasPartitionKey(table, partitionKey)) {
            index = databaseSchemaUtils.getRightIndexNameByPartitionKey(table, partitionKey);
        }

        queryParamsArr.push(constructQueryParams(queryParameters, expAttrValues, table, index, filterParameters));
    });

    return queryParamsArr;
};

/**
 * Executes DynamoDB query/queries depending on the passed params
 *
 * @param {Object} params - Needed parameters to perform the query
 * @returns {Promise} - Returns Promise with query results
 */
const executeQueryTableFlow = async (params) => {
    console.log('Executing queryTableFlow...');
    Utils.checkPassedParameters(params, REQUIRED_PARAMETERS);
    const promises = [];
    const queryParams = prepareQueryParams(params);

    queryParams.forEach((query) => {
        promises.push(dbUtils.query(query));
    });

    const queryResult = await Promise.all(promises.map(reflect));
    const processedResult = processResult(queryResult, queryParams, params);
    if (!processedResult || !processedResult.length) {
        const errorBody = Utils.createErrorBody(NOT_FOUND, 'No records found for the specified params');
        throw Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
    }
    if (params.showTableColumns) {
        addTableColumns(processedResult);
    }
    if (params.exportToCSV) {
        await exportTosS3inCSV(processedResult, params.filePrefix);
    }
    return {
        result: processedResult,
    };
};

module.exports = {
    executeQueryTableFlow,
};
