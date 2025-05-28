const { extractParams, createResponse } = require('./utility_functions/utilityFunctions');
const { searchJsSdkConfiguration, getConfiguration } = require('./utility_functions/configUtilities');
const { RESPONSE_OK } = require('./constants/responses');
/**
 * Lambda that obtain configuration data.
 * depends on GET_CONFIGURATION_PARAMS
 * @param event - data that we receive from request
 */
module.exports.configurationProviderLambda = async (event) => {
    const params = extractParams(event);
    try {
        const metadata = await getMetadata(params);
        return createResponse(RESPONSE_OK, { configurationMetadata: metadata });
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:', errorResponse);
        throw errorResponse;
    }
};

const getMetadata = async ({ jsSdkRetrieve, fileName, configurationId }) => (jsSdkRetrieve
    ? searchJsSdkConfiguration(fileName)
    : getConfiguration(configurationId));
