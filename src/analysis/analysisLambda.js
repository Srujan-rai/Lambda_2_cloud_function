const { middyValidatorWrapper } = require('../middlewares/middyValidatorWrapper');
const ssConfig = require('../self_service/selfServiceConfig.json');
const { getAnalysisLambdaFlowParams } = require('../self_service/configurationUtils');
const { ANALYSIS_FLOWS } = require('./analysisConfig');
const {
    extractParams,
    createErrorBody,
    createResponse,
    mergeObjectParams,
} = require('../utility_functions/utilityFunctions');
const { REQUIRED_PARAMETERS_FOR_LAMBDA } = require('../constants/lambdas');
const { RESPONSE_BAD_REQUEST, RESPONSE_OK } = require('../constants/responses');
const { ERROR_CODES: { INVALID_PARAMETER } } = require('../constants/errCodes');
/**
 * Execute passed handler from the flow config
 *
 * @param {Object} params - Needed parameters for the flow
 * @param {Object} flowConfig - The flowConfig flow object which will call the flows's specific handler
 */
const executeAnalysisFlow = (params, flowConfig) => flowConfig.handler({ ...params, tables: flowConfig.tables });

/**
 * Check required parameters in analysis config flows for a specific analysis flow label
 *
 * @param {string} analysisFlow - The name of the analysis flow to be used
 * @param {Object} analysisConfigFlows - Flows from analysis config
 * @returns {boolean} - Returns true if all checks pass
 * @throws {Error} - If checks don't pass an error is thrown with an appropriate message
 */
const checkRequiredParams = (analysisFlow, analysisConfigFlows) => {
    console.log('Checking required params in analysis config...');

    if (!analysisConfigFlows[analysisFlow]) {
        throw new Error('Not existing value for analysisLambdaFlow in analysis config flows.');
    }

    if (!analysisConfigFlows[analysisFlow].handler) {
        throw new Error(`Missing handler function for ${analysisFlow}.`);
    }

    if (!analysisConfigFlows[analysisFlow].tables) {
        throw new Error(`Missing tables filed in ${analysisFlow}.`);
    }

    return true;
};

/**
 * This function expects analysisLambdaFlow parameter that will execute the right flow.
 *
 * @param {Object} event - Data that we receive from request
 * @param {Object} context - Lambda context
 * @param callback - Callback function for returning a response
 */
const analysisLambda = async (event) => {
    const params = extractParams(event);
    try {
        try {
            checkRequiredParams(params.flowLabel, ANALYSIS_FLOWS);
        } catch (error) {
            const errorBody = createErrorBody(INVALID_PARAMETER, error.message);
            const errorResponse = createResponse(RESPONSE_BAD_REQUEST, errorBody);
            throw errorResponse;
        }
        const flowParams = mergeObjectParams(params.analysisLambdaFlowParams, getAnalysisLambdaFlowParams(ssConfig, params.flowLabel));
        const res = await executeAnalysisFlow(flowParams, ANALYSIS_FLOWS[params.flowLabel]);
        const response = createResponse(RESPONSE_OK, res);
        console.log('Returning OK response with analysis data.');
        return response;
    } catch (errResponse) {
        console.error('ERROR: Returning error response:\n', errResponse);
        return errResponse;
    }
};

module.exports = {
    analysisLambda: middyValidatorWrapper(analysisLambda, REQUIRED_PARAMETERS_FOR_LAMBDA.analysisLambda),
};
