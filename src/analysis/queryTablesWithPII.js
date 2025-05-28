const Utils = require('../utility_functions/utilityFunctions');
const gdprRequestsTable = require('../database/gdprRequestsTable');
const queryTableFlow = require('./queryTableFlow').executeQueryTableFlow;

/**
 * Sanitize and build the query parameters
 *
 * @param {Object} params - Query parameters
 * @returns {Array} - Transformed query parameters
 */
const transformReqParams = (params) => {
    const values = params.queryValues.replace(/\s/, '').split(',');
    const prefixes = params.filePrefix.replace(/\s/, '').split(',');

    return values.map((val, idx) => ({
        ...params,
        queryValues: val,
        filePrefix: prefixes[idx],
    }));
};

/**
 * Querying tables with PII data by given array of parameters.
 *
 * @param {Object} params Parameters for query
 * @returns {Promise}
 */
const queryTables = (params) => {
    const transformedParams = transformReqParams(params);

    if (!transformedParams.length) {
        return Promise.reject(new Error('Some params are missing'));
    }

    const promises = [];
    const results = [];

    transformedParams.forEach((param) => {
        promises.push(gdprRequestsTable.checkIsUserDeleted(Utils.createGppUserId(param.queryValues))
            .then((result) => {
                if (result.deleted) {
                    return Promise.resolve({ error: 'User is deleted', userId: param.queryValues });
                }
                return queryTableFlow(param);
            })
            .then((result) => results.push(result)));
    });

    return Promise.all(promises).then(() => results);
};

module.exports = {
    queryTables,
};
