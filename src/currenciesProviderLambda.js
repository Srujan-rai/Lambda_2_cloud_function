const CurrencyTable = require('./database/currencyDatabase');
const Utils = require('./utility_functions/utilityFunctions');
const configurationUtils = require('./self_service/configurationUtils');
const ssConfig = require('./self_service/selfServiceConfig.json');
const { ERROR_CODES } = require('./constants/errCodes');
const { RESPONSE_BAD_REQUEST, RESPONSE_OK, RESPONSE_INTERNAL_ERROR } = require('./constants/responses');
const { GPP_CURRENCY_TABLE } = require('./constants/tableNames');
/**
 * Function for retrieving all currencies for currency table.
 */
const getAllCurrencies = async () => {
    try {
        const allCurrenciesData = await CurrencyTable.scanAllCurrencies();
        return Promise.resolve(Utils.createResponse(RESPONSE_OK, { getAllCurrencies: allCurrenciesData }));
    } catch (e) {
        const errorBody = Utils.createErrorBody(ERROR_CODES.DYNAMO_DB_ERROR,
            'Failed to get currencies from DynamoDB');
        return Promise.reject(Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody));
    }
};

/**
 * Function for retrieving specific currencies by ids for currency table.
 * @param {Array} currencies - array with currency ids
 */
const getCurrenciesByIds = async (currencies) => {
    try {
        const matchedCurrenciesData = await CurrencyTable.queryByCurrenciesIds(currencies);
        return Promise.resolve(Utils.createResponse(RESPONSE_OK,
            { matchedCurrencies: Utils.copyAsCamelCase(matchedCurrenciesData[GPP_CURRENCY_TABLE]) }));
    } catch (e) {
        const errorBody = Utils.createErrorBody(ERROR_CODES.DYNAMO_DB_ERROR,
            'Failed to get currencies from DynamoDB');
        return Promise.reject(Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody));
    }
};

/**
 * This function expect currenciesProviderFlow parameter that will execute the right flow.
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
const currenciesProviderLambda = async (event, context, callback) => {
    const params = Utils.extractParams(event);
    const currenciesProviderFlow = configurationUtils.getCurrenciesProviderLambdaFlow(ssConfig, params.flowLabel);

    if (!currenciesProviderFlow) {
        const errorBody = Utils.createErrorBody(ERROR_CODES.INVALID_PARAMETER,
            'currenciesProviderFlow not specified in config.');
        const errorResponse = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
        console.error('ERROR: Returning error response:\n', errorResponse);
        return callback(null, errorResponse);
    }

    console.log('Currencies provider flow:', currenciesProviderFlow);

    switch (currenciesProviderFlow) {
        case 'getAllCurrencies':
            try {
                const result = await getAllCurrencies();
                console.log('Returning response..');
                callback(null, result);
            } catch (errorResponse) {
                console.error('ERROR: Returning error response:\n', errorResponse);
                callback(null, errorResponse);
            }
            break;
        case 'getCurrenciesByIds':
            if (!params.currenciesProviderParams) {
                const errorBody = Utils.createErrorBody(ERROR_CODES.REQUEST_PARAMETER_MISSING,
                    'missing parameter "currenciesProviderParams"');
                const errorResponse = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
                console.error('ERROR: Returning error response:\n', errorResponse);
                return callback(null, errorResponse);
            }
            try {
                const result = await getCurrenciesByIds(params.currenciesProviderParams.currencies);
                console.log('Returning response..');
                callback(null, result);
            } catch (errorResponse) {
                console.error('ERROR: Returning error response:\n', errorResponse);
                callback(null, errorResponse);
            }
            break;
        default:
            const errorBody = Utils.createErrorBody(ERROR_CODES.INVALID_PARAMETER,
                'Such currenciesProviderLambdaFlow does not exist.');
            const errorResponse = Utils.createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
            console.error('ERROR: Returning error response:\n', errorResponse);
            callback(errorResponse);
            break;
    }
    return undefined;
};

module.exports = {
    currenciesProviderLambda,
};
