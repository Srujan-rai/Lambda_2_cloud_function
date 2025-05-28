const Utils = require('./utility_functions/utilityFunctions');
const { getConfiguration } = require('./utility_functions/configUtilities');
const CurrencyAllocationRuleTable = require('./database/currencyAllocationRuleDatabase');
const ConfigUtils = require('./self_service/configurationUtils');
const ssConfig = require('./self_service/selfServiceConfig.json');
const { PARAMS_MAP } = require('./constants/common');
const { RESPONSE_OK } = require('./constants/responses');
const { REQUIRED_PARAMETERS_FOR_LAMBDA } = require('./constants/lambdas');
/** Supported currency allocation flows (configuration parameter) */
const CURRENCY_ALLOCATION_FLOWS = {
    ADD: 'add',
    EDIT: 'edit',
    LIST: 'list',
};

const MANDATORY_INSERT_PARAMETERS = [
    PARAMS_MAP.CONFIGURATION_ID,
    PARAMS_MAP.PROGRAM_ID,
    PARAMS_MAP.LOT_ID,
    PARAMS_MAP.CURRENCY_ID,
    PARAMS_MAP.AMOUNT,
];

/**
 * Handles currencyAllocationFlow result in success scenario.
 *
 * @param {Object} responseBody - JSON object representing http response body
 * @param {function} callback - Lambda callback
 */
const resolveHandler = (responseBody, callback) => {
    const response = Utils.createResponse(RESPONSE_OK, responseBody);
    console.log('Returning response..');
    callback(null, response);
};

/**
 * Handles currencyAllocationFlow result in case of an error.
 *
 * @param {Object} httpError - JSON representing full http error response that needs to be returned back.
 * @param {function} callback - Lambda callback
 */
const rejectHandler = (httpError, callback) => {
    console.error('ERROR: Returning error response:\n', httpError);
    callback(null, httpError);
};

/**
 * Adds currency allocation rule.
 *
 * @param {Object} params - REST request parameters
 *
 * @returns {Promise} success or HTTP error
 */
const addCurrencyAllocationRule = async (params) => {
    const insertParams = {
        configurationId: params.configurationId,
        programId: params.programId,
        lotId: params.lotId,
        currencyId: params.currencyId,
        amount: params.amount,
        validity: params.validity,
        jiraTicketId: params.jiraTicketId,
        userKoId: params.userKoId,
        ruleActive: true,
    };

    const response = await CurrencyAllocationRuleTable.putDistinctEntry(insertParams);
    return Promise.resolve(Utils.parseBody(response));
};

/**
 * Validates parameters for insert.
 *
 * @params {Object} params - parameters received via HTTP request
 *
 * @returns {Promise} Promise, resolved if all validations pass, rejected with HTTP error response if any fails
 */
const validateInsertParameters = async (params, event) => {
    Utils.checkPassedParameters(params, MANDATORY_INSERT_PARAMETERS);
    await getConfiguration(params[PARAMS_MAP.CONFIGURATION_ID], event);
    const invalidParams = [];
    if (!(typeof params[PARAMS_MAP.PROGRAM_ID] === 'string' && (params[PARAMS_MAP.PROGRAM_ID] === '*' || /^[0-9]+$/.test(params[PARAMS_MAP.PROGRAM_ID])))) {
        invalidParams.push(PARAMS_MAP.PROGRAM_ID);
    }
    if (!(typeof params[PARAMS_MAP.LOT_ID] === 'string' && (params[PARAMS_MAP.LOT_ID] === '*' || /^[0-9]+$/.test(params[PARAMS_MAP.LOT_ID])))) {
        invalidParams.push(PARAMS_MAP.LOT_ID);
    }
    if (typeof params[PARAMS_MAP.CURRENCY_ID] !== 'string') {
        invalidParams.push(PARAMS_MAP.CURRENCY_ID);
    }
    if (!Number.isInteger(params[PARAMS_MAP.AMOUNT])) {
        invalidParams.push(PARAMS_MAP.AMOUNT);
    }
    if (
        (params[PARAMS_MAP.VALIDITY] !== undefined && !Number.isInteger(params[PARAMS_MAP.VALIDITY]))
        || (Number.isInteger(params[PARAMS_MAP.VALIDITY]) && params[PARAMS_MAP.VALIDITY] <= 0)
    ) {
        invalidParams.push(PARAMS_MAP.VALIDITY);
    }
    if (invalidParams.length <= 0) {
        return Promise.resolve();
    }
    return Promise.reject(Utils.createResponseInvalidParameter(invalidParams));
};

/**
 * Function that returns list of currency allocation rules for specified configuration
 *
 * @param {Object} params - REST request parameters
 *
 * @returns {Promise} list of rules (HTTP body) or HTTP error
 */
const listCurrencyAllocationRules = async (params) => {
    const { configurationId } = params;
    const allCurrencyAllocationRules = await CurrencyAllocationRuleTable.queryByConfigurationId(configurationId);
    return Promise.resolve({ allCurrencyAllocationRules });
};

/**
 * Lambda for retrieving all currency allocation rules for currency table.
 * @param event - data that we receive from request
 * @param context
 * @param callback - returned data
 */
const currencyAllocationRulesUtilitiesLambda = async (event, context, callback) => {
    const params = Utils.extractParams(event);

    const flowJSON = ConfigUtils.getFlowLabel(ssConfig, params[PARAMS_MAP.FLOW_LABEL]);
    const currencyAllocationFlow = ConfigUtils.getFlowParameter(flowJSON, 'currencyAllocationFlow');

    switch (currencyAllocationFlow) {
        case CURRENCY_ALLOCATION_FLOWS.ADD:
            try {
                await validateInsertParameters(params, event);
                const data = await addCurrencyAllocationRule(params);
                resolveHandler(data, callback);
            } catch (error) {
                rejectHandler(error, callback);
            }
            break;
        case CURRENCY_ALLOCATION_FLOWS.EDIT:
            try {
                const requiredParams = REQUIRED_PARAMETERS_FOR_LAMBDA.currencyAllocationRulesUtilitiesLambda;
                Utils.checkPassedParameters(params, requiredParams);
                const resData = await CurrencyAllocationRuleTable.updateEntry(params);
                resolveHandler(resData, callback);
            } catch (errData) {
                rejectHandler(errData, callback);
            }
            break;
        case CURRENCY_ALLOCATION_FLOWS.LIST:
            try {
                const data = await listCurrencyAllocationRules(params);
                resolveHandler(data, callback);
            } catch (error) {
                rejectHandler(error, callback);
            }
            break;
        default:
            // Unsupported flow is set in configuration. Shouldn't happen because we are maintaining self-service
            // configuration in the codebase.
            callback(null, Utils.createResponseBadConfiguration());
    }
};

module.exports = {
    currencyAllocationRulesUtilitiesLambda,
};
