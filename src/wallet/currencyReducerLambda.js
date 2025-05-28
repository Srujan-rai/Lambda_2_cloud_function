const { middyValidatorWrapper } = require('../middlewares/middyValidatorWrapper');
const Utils = require('../utility_functions/utilityFunctions');
const { getConfiguration } = require('../utility_functions/configUtilities');
const { invokeLambda } = require('../utility_functions/aws_sdk_utils/lambdaUtilities');
const configUtils = require('../self_service/configurationUtils');
const BlockedUsersUtils = require('../utility_functions/blockedUsersUtilities');
const { checkPrizeAvailability } = require('../database/prizeCatalogueTable');
const { REQUIRED_PARAMETERS_FOR_LAMBDA, CONFIGURATION_FUNCTIONS_MAP: { transactionLambda: TRANSACTION_INVOKE_PARAMS } } = require('../constants/lambdas');
const { RESPONSE_OK, RESPONSE_FORBIDDEN } = require('../constants/responses');
const { ERR_CODES: { CURRENCY_REDUCER_PARAMS_NOT_CONFIGURED }, ERROR_CODES: { CONFIGURATION_PARAMETER_MISSING } } = require('../constants/errCodes');

/**
 * convertReduceAmount
 * convert currency amount from Earn to Spend
 * @param {Array} reduceAmount - normal earn
 * @return {Array} reduceAmount - converted spend
 */
const convertReduceAmount = (reduceAmount) => reduceAmount.map((item) => ({
    currencyId: item.currencyId,
    amount: item.amount > 0 ? (item.amount * -1) : item.amount,
}));

/**
 * getReduceAmount
 * - get reduceAmount from current flow configuration
 * @param {Object} params
 * @returns {Promise} with reduceAmount from configuration
 */
const getReduceAmount = async (params, event) => {
    const config = await getConfiguration(params.configurationId, event);
    let reduceAmount = configUtils.getReduceAmount(config, params.flowLabel);
    if (reduceAmount && reduceAmount.length > 0) {
        reduceAmount = convertReduceAmount(reduceAmount);
        return reduceAmount;
    }
    const errorBody = Utils.createErrBody(CURRENCY_REDUCER_PARAMS_NOT_CONFIGURED,
        'ReduceAmount - flowParam is missing or empty', undefined, CONFIGURATION_PARAMETER_MISSING);
    throw Utils.createResponse(RESPONSE_FORBIDDEN, errorBody);
};

/**
 * invokeTransactionLambda
 *  - invoke transactionLambda
 *  - insert reduceAmount to transactionBody.currencyAllocation
 * @param {Array.<{amount: Number, currencyId: String}>} reduceAmount
 * @param {Object} event
 * @returns {Promise} with response
 */
const invokeTransactionLambda = async (reduceAmount, event) => {
    const transactionEvent = { ...event };
    const transactionBody = Utils.extractParams(event);
    transactionBody.currencyAllocations = reduceAmount;
    transactionEvent.body = JSON.stringify(transactionBody);
    const response = await invokeLambda(TRANSACTION_INVOKE_PARAMS, transactionEvent);
    const responseBody = Utils.parseBody(response);
    return Utils.createResponse(RESPONSE_OK, responseBody);
};

/**
 * Lambda
 * get reduceAmount params(flow)
 * invoke transactionLambda
 * with currencyAllocations
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
const currencyReducerLambda = async (event) => {
    try {
        const params = Utils.extractParams(event);

        await BlockedUsersUtils.checkIsUserBlocked(params);
        if (params?.flowLabel !== 'promoEntry') await checkPrizeAvailability(params.configurationId);
        const reduceAmount = await getReduceAmount(params, event);
        const response = await invokeTransactionLambda(reduceAmount, event);
        console.log('Returning response:\n', JSON.stringify(response));
        return response;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', errorResponse);
        return errorResponse;
    }
};

module.exports = {
    currencyReducerLambda: middyValidatorWrapper(currencyReducerLambda, REQUIRED_PARAMETERS_FOR_LAMBDA.currencyReducer),
};
