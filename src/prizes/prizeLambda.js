const Utils = require('../utility_functions/utilityFunctions');
const { getConfiguration } = require('../utility_functions/configUtilities');
const PrizeCatalogue = require('../database/prizeCatalogueTable');
const configurationUtils = require('../self_service/configurationUtils');
const ssConfig = require('../self_service/selfServiceConfig.json');
const {
    RESPONSE_OK, RESPONSE_BAD_REQUEST, RESPONSE_INTERNAL_ERROR, RESPONSE_NOT_FOUND,
} = require('../constants/responses');
const { ERROR_CODES: { REQUEST_PARAMETER_MISSING, INVALID_PARAMETER, NOT_FOUND } } = require('../constants/errCodes');
const { PARAMS_MAP: { CONFIGURATION_ID, PRIZE_ID } } = require('../constants/common');

/**
 * returns single prize
 * @param getParams - event params, expect prizeId, configurationId
 */
const getPrize = async (getParams) => {
    Utils.checkPassedParameters(getParams, [CONFIGURATION_ID, PRIZE_ID]);
    const result = await PrizeCatalogue.mainQuery(getParams.configurationId, getParams.prizeId);
    if (result.length === 0) {
        const errorBody = Utils.createErrorBody(NOT_FOUND,
            'No available prize for these parameters!',
            [CONFIGURATION_ID, PRIZE_ID]);
        throw Utils.createResponse(RESPONSE_NOT_FOUND, errorBody);
    } else {
        const responseBody = {
            prizeDetails: Utils.copyAsCamelCase(result[0]),
        };
        return Utils.createResponse(RESPONSE_OK, responseBody);
    }
};

const addPrizeExpTime = (params, config) => {
    const expirationTimestamp = params.prizeParams.endDate
        ? Utils.createExpTime(1, new Date(params.prizeParams.endDate))
        : Utils.getExpirationTimestamp(config);
    return expirationTimestamp;
};
/**
 * This function is used for Self Service and requires the use of a corresponding flowLabel as defined in the switch statements.
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
module.exports.prizeLambda = async (event) => {
    const params = Utils.extractParams(event);
    if (!params.prizeParams) {
        const errorBody = Utils.createErrorBody(REQUEST_PARAMETER_MISSING,
            'missing parameter "prizeParams"');
        const errorResponse = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
        console.error('ERROR: Returning error response:\n', JSON.stringify(errorResponse));
        return errorResponse;
    }
    if (params.prizeParams.cost) {
        const invalidCost = params.prizeParams.cost.filter((currency) => currency.amount < 0 || !Number.isInteger(currency.amount));
        if (invalidCost.length > 0) {
            const errorBody = Utils.createErrorBody(INVALID_PARAMETER, 'Cost amount should be positive number');
            const response = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
            return response;
        }
    }
    if (Array.isArray(params.prizeParams.cost) && params.prizeParams.cost.length === 0) {
        const errorBody = Utils.createErrorBody(INVALID_PARAMETER, 'Warning! No currency defined for Collect&Get Prize.');
        const response = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
        return response;
    }

    const prizeFlow = configurationUtils.getPrizeLambdaFlow(ssConfig, params.flowLabel);
    if (prizeFlow == null) {
        const errorBody = Utils.createErrorBody(INVALID_PARAMETER,
            'prizeLambdaFlow not specified in config.');
        const errorResponse = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
        console.error('ERROR: Returning error response:\n', JSON.stringify(errorResponse));
        return errorResponse;
    }
    console.log('Prize flow is:', prizeFlow);

    if (params.prizeParams.endDate && params.prizeParams.endDateUTC) {
        const localTimestamp = Utils.dateLocalTimeConvertion(params.prizeParams.endDate, params.prizeParams.endDateUTC);
        params.prizeParams.endDate = localTimestamp;
        delete params.prizeParams.endDateUTC;
    }

    if (params.prizeParams.startDate && params.prizeParams.startDateUTC) {
        const localTimestamp = Utils.dateLocalTimeConvertion(params.prizeParams.startDate, params.prizeParams.startDateUTC);
        params.prizeParams.startDate = localTimestamp;
        delete params.prizeParams.startDateUTC;
    }

    switch (prizeFlow) {
        case 'getPrize':
            try {
                const result = await getPrize(params.prizeParams);
                console.log('Returning response:\n', JSON.stringify(result));
                return result;
            } catch (errorResponse) {
                console.error('ERROR: Returning error response:\n', errorResponse);
                return errorResponse;
            }
        case 'deletePrize':
            try {
                const result = await PrizeCatalogue.deletePrize(params.prizeParams.configurationId, params.prizeParams.prizeId);
                console.log('Returning response:\n', JSON.stringify(result));
                return result;
            } catch (errorResponse) {
                console.error('ERROR: Returning error response:\n', errorResponse);
                return errorResponse;
            }
        case 'addPrize':
            try {
                if (params.prizeParams.endDate) {
                    params.prizeParams.hasEndDate = '1';
                }
                const config = await getConfiguration(params.prizeParams.configurationId, event);
                if (process.env.ARCHIVE_EXPIRED_CONFIG_DATA === 'true') {
                    params.prizeParams.expTime = addPrizeExpTime(params, config);
                }
                const result = await PrizeCatalogue.putEntry(params.prizeParams);
                console.log('Returning response:\n', JSON.stringify(result));
                return result;
            } catch (errorResponse) {
                console.error('ERROR: Returning error response:\n', errorResponse);
                return errorResponse;
            }
        case 'updatePrize':
            try {
                if (params.prizeParams.endDate && !(params.prizeParams.hasEndDate)) {
                    params.prizeParams.hasEndDate = '1';
                }
                const config = await getConfiguration(params.prizeParams.configurationId, event);
                if (process.env.ARCHIVE_EXPIRED_CONFIG_DATA === 'true') {
                    params.prizeParams.expTime = addPrizeExpTime(params, config);
                }
                const result = await PrizeCatalogue.updateEntry(params.prizeParams);
                console.log('Returning response:\n', JSON.stringify(result));
                return Utils.createResponse(RESPONSE_OK, result);
            } catch (errorResponse) {
                console.error('ERROR: Returning error response:\n', errorResponse);
                return errorResponse;
            }
        default:
            const errorBody = Utils.createErrorBody(INVALID_PARAMETER,
                'Such prizeLambdaFlow does not exist.');
            const errorResponse = Utils.createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
            console.error('ERROR: Returning error response:\n', errorResponse);
            return errorResponse;
    }
};
