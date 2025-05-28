const {
    getWalletDataPerCurrencies,
    queryUserWalletById,
} = require('../database/walletTable');
const {
    mainQuery,
    queryByConfigurationId,
    queryByArrayOfCurrencies,
    extractCurrencyIdsFromWallet,
} = require('../database/currencyDatabase');
const {
    createResponseInvalidParameter,
    createResponseMissingParameters,
    createErrorBody,
    createResponse,
    extractParams,
} = require('../utility_functions/utilityFunctions');
const { getConfiguration, getDefaultUserIdType } = require('../utility_functions/configUtilities');
const { RESPONSE_OK, RESPONSE_INTERNAL_ERROR } = require('../constants/responses');
const { ERROR_CODES: { CONFIGURATION_ERROR } } = require('../constants/errCodes');
const { PARAMS_MAP: { USER_ID_TYPE, CURRENCY_ID } } = require('../constants/common');

/**
 * Checks query result and analyzes the cause in case of error in order to return proper error message.
 * @param queryResult - Passed in as currencyData from retrieveCurrencies
 * @param params - initial params passed in from Arbiter
 */
const checkCurrencyQueryResult = (queryResult, params) => {
    if (!queryResult || queryResult.length <= 0 && Object.prototype.hasOwnProperty.call(params, CURRENCY_ID)) {
        throw createResponseInvalidParameter([params[CURRENCY_ID]]);
    } if (!queryResult || queryResult.length <= 0) {
        const errorBody = createErrorBody(CONFIGURATION_ERROR,
            'There are no defined currencies for this configuration',
            { currenciesNotConfigured: true });
        const response = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
        throw response;
    }
};

/**
 * Handles GET request for retriving user's wallet
 * with user id from jtw token
 * or
 * with user id from jwt and currencyIds
 */
const handleGetWallet = async (event, params) => {
    const allowedIdTypes = ['|cds', '|cid', '|uuid'];
    const userWallet = await queryUserWalletById(event.requestContext.authorizer.hashed_kocid, allowedIdTypes);
    const listOfWalletCurrencies = await extractCurrencyIdsFromWallet(userWallet);
    const gppUserId = await userWallet[0].gpp_user_id;

    if (params.currencyIds) {
        const currencyArr = params.currencyIds.split(',');
        const walletData = await getWalletDataPerCurrencies(gppUserId, currencyArr);
        const currencyData = await queryByArrayOfCurrencies(currencyArr);
        return createWalletResponse({
            walletData,
            currencyData,
        }, gppUserId);
    }
    const currencyDetails = await queryByArrayOfCurrencies(listOfWalletCurrencies);
    return createWalletResponse({
        walletData: userWallet,
        currencyData: currencyDetails,
    }, gppUserId);
};

/**
 * Merges data from currency table and wallet table
 * @param data - passed in as allData from retrieveCurrencies
 * @param params - - initial params passed in from Arbiter
 */
const createWalletResponse = (data, gppUId, displayTotalAmount) => {
    const responseData = [];
    const amountToDisplay = displayTotalAmount ? 'total_amount' : 'amount';
    for (let i = 0; i < data.currencyData.length; i++) {
        const currencyItem = data.currencyData[i];
        const responseItem = {
            currencyId: currencyItem.currency_id,
            currencyName: currencyItem.name,
            currencyIcon: currencyItem.icon_url,
            gppUserId: gppUId,
            [amountToDisplay]: 0,
        };
        const walletItem = data.walletData.find((item) => item && item.currency_id === currencyItem.currency_id);
        responseItem[amountToDisplay] = walletItem && walletItem[amountToDisplay] ? walletItem[amountToDisplay] : 0;
        responseItem.lastModified = walletItem ? walletItem.last_modified : undefined;

        responseData.push(responseItem);
    }
    return responseData;
};
/**
 * Checks the params object and checks if userIdType is specified.
 * If not then this is extracted from the config file and the
 * subsequent query will be run depending on the if currencyId is specified.
 *
 * @param {Object} params - extracted and updated params from event.
 * @param {Object} config - configuration for which it's needed to retrieve currencies
 *
 * @returns {Promise} Array of objects representing users wallet status for each of the supported/requested currencies
 */
const retrieveCurrencies = async (params, config, displayTotalAmount) => {
    if (!params.userId) {
        throw createResponseMissingParameters([params.userId]);
    }
    params[USER_ID_TYPE] = getDefaultUserIdType(config);

    const [walletData, currencyData] = await Promise.all(
        Object.prototype.hasOwnProperty.call(params, CURRENCY_ID)
            ? [
                getWalletDataPerCurrencies(params.gppUserId, [params.currencyId]),
                mainQuery(params[CURRENCY_ID]),
            ] : [
                getWalletDataPerCurrencies(params.gppUserId, config.configurationParameters.currencies),
                queryByConfigurationId(config),
            ],
    );

    checkCurrencyQueryResult(currencyData, params);
    return createWalletResponse({
        walletData,
        currencyData,
    }, params.gppUserId, displayTotalAmount);
};

const walletLambda = async (event) => {
    try {
        const params = extractParams(event);
        let data;

        if (event.httpMethod === 'GET') {
            data = await handleGetWallet(event, params);
        } else {
            const configuration = await getConfiguration(params.configurationId, event);
            data = await retrieveCurrencies(params, configuration, params.displayTotalAmount);
        }
        const response = createResponse(RESPONSE_OK, { walletStatus: data });
        console.log('Success! Returning response..');
        return response;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', errorResponse);
        return errorResponse;
    }
};

/**
 * Lambda for retrieving user wallet for particular/all currency.
 *
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
module.exports = {
    walletLambda,
};
