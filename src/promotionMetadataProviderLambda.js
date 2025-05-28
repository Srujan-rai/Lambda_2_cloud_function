const {
    extractParams,
    createResponse,
    copyAsCamelCase,
    createErrorBody,
} = require('./utility_functions/utilityFunctions');
const { getConfiguration } = require('./utility_functions/configUtilities');
const { getMetadata } = require('./self_service/promotionsUtils');
const { ERROR_CODES: { CONFIGURATION_PARAMETER_MISSING } } = require('./constants/errCodes');
const { RESPONSE_OK, RESPONSE_INTERNAL_ERROR } = require('./constants/responses');
const { PARAMS_MAP } = require('./constants/common');
/**
 *  getPromotionId
 *  @param {string} configurationID
 *
 *  extract promotionId based on relation between
 *  configuration and promotion
 *
 *  @returns {Promise} Promise with promotionId
 */
const getPromotionId = (configurationID) => getConfiguration(configurationID)
    .then((configData) => {
        const { promotionId } = configData;
        if (!promotionId) {
            const errorBody = createErrorBody(CONFIGURATION_PARAMETER_MISSING,
                'promotionId not specified in this configuration.');
            const errResponse = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
            return Promise.reject(errResponse);
        }
        return Promise.resolve(promotionId);
    }).catch((errResponse) => Promise.reject(errResponse));

/**
* Extract PromotionId from params.
*  @param {object} params
*
*  @returns {Promise} Promise with promotionId
*/
function extractPromotionId(params) {
    if (params[PARAMS_MAP.PROMOTION_ID]) {
        return Promise.resolve(params[PARAMS_MAP.PROMOTION_ID]);
    } if (params[PARAMS_MAP.CONFIGURATION_ID]) {
        return getPromotionId(params[PARAMS_MAP.CONFIGURATION_ID]);
    }
    const errorBody = createErrorBody(CONFIGURATION_PARAMETER_MISSING,
        'promotionId or configurationId not specified.');
    const errResponse = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
    return Promise.reject(errResponse);
}

/**
 * Lambda that serves as a getter for start/end dates for promotion.
 * @param event - data that we receive from request
 */
const promotionMetadataProviderLambda = async (event) => {
    try {
        const params = extractParams(event);
        const promotionId = await extractPromotionId(params);
        const metadata = await getMetadata(promotionId);
        const response = createResponse(RESPONSE_OK, { promotionMetadata: copyAsCamelCase(metadata) });
        console.log('Returning response...');
        return response;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', errorResponse);
        return errorResponse;
    }
};

module.exports = {
    promotionMetadataProviderLambda,
};
