const Messages = require('@the-coca-cola-company/ngps-global-common-messages');
const { createErrBody, createResponse } = require('./utility_functions/utilityFunctions');
const ClientsSignature = require('./database/clientsSignatureTable');
const { ERR_CODES: { CONFIG_ACCESS_DENIED, CONFIGURATION_MALFORMED }, ERROR_CODES: { CONFIGURATION_PARAMETER_MISSING } } = require('./constants/errCodes');
const { RESPONSE_FORBIDDEN, RESPONSE_BAD_REQUEST } = require('./constants/responses');
const { getConfigurationParameter } = require('./self_service/configurationUtils');

/** Authorize specific user's access to passed in configuration Id
 * @param {Object} event -  Event received from request.
 * @param {Object} configuration - Configuration in JSON format
 * @returns {Promise} - resolved if query is succeesful
 *                    - rejected with appropriate error HTTP response if query returns no result
 */
module.exports.authorize = async (event, configurationId) => {
    if (process.env.authorizeConfigurationAccess === 'false' || process.env.IS_OFFLINE === 'true') {
        return Promise.resolve('No authorization required');
    }
    // GET requests from SDK use API key, request to arbiter use IAM access key
    const accessKey = event.httpMethod === 'GET' ? event.headers['x-api-key'] : event.requestContext.identity.accessKey;

    const result = await ClientsSignature.getClientConfigurations(accessKey, configurationId);
    if (result.length === 0) {
        console.error(`No entry found for access Key: ${accessKey} and configuration: ${configurationId}`);
        const errorBody = createErrBody(CONFIG_ACCESS_DENIED, Messages.COMMON_ERR.CONFIG_ACCESS_DENIED);
        const response = createResponse(RESPONSE_FORBIDDEN, errorBody);
        return Promise.reject(response);
    }
    return Promise.resolve('Authorization check passed');
};

/** This is checking whether the private configuration has the parameter publicListPrizes present and set to "true"
 */
module.exports.publicListPrizesChecker = (config) => {
    const listPrizesFlag = getConfigurationParameter(config, 'publicListPrizes');
    if (listPrizesFlag !== true) {
        const errorBody = createErrBody(CONFIGURATION_MALFORMED,
            'Public prize listing flow not enabled for this configuration', undefined, CONFIGURATION_PARAMETER_MISSING);
        throw createResponse(RESPONSE_BAD_REQUEST, errorBody);
    }
};
