const Utils = require('../utility_functions/utilityFunctions');
const { getConfiguration } = require('../utility_functions/configUtilities');
const { RESPONSE_OK } = require('../constants/responses');

/**
 * Lambda that obtain configuration data.
 * depends on GET_CONFIGURATION_PARAMS
 * @param event - data that we receive from request
 * @param context
 * @param callback - returned data
 */
module.exports.configurationProviderLambda = (event, context, callback) => {
    const params = Utils.extractParams(event);

    getConfiguration(params.configurationId).then((metadata) => {
        const result = Utils.createResponse(RESPONSE_OK, { configurationMetadata: metadata });
        console.log('Returning response...');
        callback(null, result);
    }).catch((errorResponse) => {
        console.error('ERROR: Returning error response:\n', JSON.stringify(errorResponse));
        callback(null, errorResponse);
    });
};
