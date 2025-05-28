const reflect = require('p-reflect');
const walletTable = require('../database/walletTable');
const prizeCatalogueTable = require('../database/prizeCatalogueTable');
const Utils = require('../utility_functions/utilityFunctions');
const {
    PARAMS_MAP: { PRIZE_ID, CONFIGURATION_ID, GPP_USER_ID },
} = require('../constants/common');
const {
    ERROR_CODES: { CHECKER_LAMBDA_REJECTION },
} = require('../constants/errCodes');
const { RESPONSE_BAD_REQUEST, RESPONSE_OK } = require('../constants/responses');
const {
    REQUIRED_PARAMETERS_FOR_CHECKER_LAMBDA,
} = require('../constants/checkers');

/**
 * Determines prize costs - if resolved follows the format [{"currency_id": "exampleCurrency1", "amount": 10},
 * {"currency_id": "exampleCurrency2", "amount": 11}, ...]
 * @param configurationId
 * @param prizeId
 * @returns {Promise<any>}
 */
const checkPrizeCosts = async (configurationId, prizeId) => {
    const prizeCostColumnName = prizeCatalogueTable.DEFAULT_PROJECTION_QUERY_COLUMNS.cost;
    // textFormat not important here

    const prize = await prizeCatalogueTable.projectionQuery(
        configurationId,
        prizeId,
        [prizeCostColumnName],
    );
    if (prize[0]) {
        let prizeCosts = prize[0][prizeCostColumnName];
        if (!Array.isArray(prizeCosts)) {
            prizeCosts = [];
        }
        if (!prizeCosts || !prizeCosts.length) {
            const errorBody = Utils.createErrorBody(
                CHECKER_LAMBDA_REJECTION,
                'Prize cost not specified!',
            );
            const response = Utils.createResponse(
                RESPONSE_BAD_REQUEST,
                errorBody,
            );
            throw response;
        }
        console.log('Prize costs:\n', JSON.stringify(prizeCosts));
        return prizeCosts;
    }
    const errorBody = Utils.createErrorBody(
        CHECKER_LAMBDA_REJECTION,
        'Prize item not found!',
    );
    const response = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
    throw response;
};

/**
 * Executes single prize cost check against user's currency amount in referenced wallet
 * @param gppUserId
 * @param prizeCost - json object from prize costs array
 * @returns {PromiseLike<any>}
 */
const userCurrencyCheck = async (gppUserId, prizeCost) => {
    try {
        const currencyId = prizeCost.currency_id || prizeCost.currencyId;
        const data = await walletTable.mainQuery(
            gppUserId,
            currencyId,
        );
        console.log('User wallet retrieved:\n', JSON.stringify(data));
        console.log(
            'Retrieved prize cost object is:\n',
            JSON.stringify(prizeCost),
        );
        const walletCurrAmount = data[0] ? parseInt(data[0].amount) : 0;
        if (walletCurrAmount >= prizeCost.amount) {
            return currencyId;
        }
        throw currencyId;
    } catch (err) {
        console.error(err);
        throw err;
    }
};

/**
 * Checks if the user has enough currencies in wallets. If he/she has enough proceed and resolve promise with "true",
 * otherwise rejects promise.
 * @param gppUserId
 * @param prizeCosts - prize cost objects array with currencyId and amount properties
 * @returns {Promise<boolean>}
 */
const checkWallet = async (gppUserId, prizeCosts) => {
    const currencyChecksPromises = [];
    prizeCosts.forEach((prizeCost) => {
        const walletResult = userCurrencyCheck(gppUserId, prizeCost);
        currencyChecksPromises.push(walletResult);
    });

    const checkResults = await Promise.all(currencyChecksPromises.map(reflect));
    console.log('Check results:\n', JSON.stringify(checkResults));
    const failedCurrencies = [];
    checkResults.forEach((element) => {
        if (element.isRejected) {
            failedCurrencies.push(element.reason);
        }
    });
    if (failedCurrencies.length === 0) {
        return true;
    }
    const errorResponse = Utils.createResponseInsufficientCurrencies(failedCurrencies);
    throw errorResponse;
};

const costOfEntryPresent = (requestFlowLabel) => requestFlowLabel === 'promoEntry' || requestFlowLabel === 'instantWin';

// eslint-disable-next-line
const costOfEntryObject = (flowLabel, configId, eventCustomParams) => eventCustomParams.cachedConfigurations[configId].flow[flowLabel].params
    .reduceAmount;

/**
 * Lambda that will check if the user that did the buy request has enough currency(currencies) amount for it.
 * It expects gppUserId, currencyId, cost (cost of the prize) for the prize purchased.
 */
module.exports.currencyCheckerLambda = async (event) => {
    const config = JSON.parse(event.body).configurationId;
    const { flowLabel } = JSON.parse(event.body);
    const costOfEntry = costOfEntryPresent(flowLabel);
    try {
        const params = Utils.extractParams(event);
        const requiredParams = costOfEntry
            ? REQUIRED_PARAMETERS_FOR_CHECKER_LAMBDA.currencyCheckerLambdaNoPrize
            : REQUIRED_PARAMETERS_FOR_CHECKER_LAMBDA.currencyCheckerLambda;
        await Utils.checkPassedParameters(params, requiredParams);
        const prizeOrEntryCosts = costOfEntry
            ? costOfEntryObject(flowLabel, config, event.customParameters)
            : await checkPrizeCosts(params[CONFIGURATION_ID], params[PRIZE_ID]);
        await checkWallet(params[GPP_USER_ID], prizeOrEntryCosts);
        const response = Utils.createResponse(RESPONSE_OK, '');
        console.log('Returning response:\n', JSON.stringify(response));
        return response;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', errorResponse);
        return errorResponse;
    }
};
