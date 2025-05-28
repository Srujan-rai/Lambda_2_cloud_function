const { get: getParticipation } = require('../database/participationsDatabase');
const { getAutoRedeemPrizesByConfigurationId } = require('../database/prizeCatalogueTable');
const {
    createResponse,
    extractRequestId,
    safeExtractParams,
    checkPassedParameters,
    createResponseInsufficientCurrencies,
} = require('../utility_functions/utilityFunctions');
const { invokeLambda } = require('../utility_functions/aws_sdk_utils/lambdaUtilities');
const { TRANSACTION_TYPES } = require('../constants/common');
const {
    REQUIRED_PARAMETERS_FOR_LAMBDA,
    CONFIGURATION_FUNCTIONS_MAP: {
        prizeCheckerLambda: PRIZE_CHECKER_INVOKE_PARAMS,
        prizeRedeemLambda: PRIZE_REDEEM_INVOKE_PARAMS,
    },
} = require('../constants/lambdas');
const { RESPONSE_BAD_REQUEST, RESPONSE_OK } = require('../constants/responses');

/**
 * Gets wallet total information from participation for every earned currency
 *
 * @param {Object} participation - Participation object
 * @return {Object} - JSON object with currency IDs for keys and wallet total as values for those currencies
 */
const getWalletTotalByCurrencyFromParticipation = (participation) => {
    if (participation < 1) {
        return undefined;
    }
    const transactions = participation[0].inserted_transactions;
    if (!(transactions && Array.isArray(transactions))) {
        return undefined;
    }
    const walletTotalByWonCurrencies = {};
    transactions.forEach((transaction) => {
        if (transaction.transaction_type === TRANSACTION_TYPES.earn) {
            walletTotalByWonCurrencies[transaction.currency_id] = transaction.wallet_rolling_total;
        }
    });
    return walletTotalByWonCurrencies;
};

/**
 * Calls the redeem prize logic from prizeCheckerLambda and prizeRedeemLambda
 *
 * @param {Object} event - Lambda event
 * @param {string} prizeId - Prize ID
 * @return {Promise<any>} - Returns Promise with the result of the prize redeem
 */
const redeemPrize = async (event, prizeId) => {
    const parsedBody = JSON.parse(event.body);
    parsedBody.prizeId = prizeId;
    const body = JSON.stringify(parsedBody);
    let prizeRedeemResponse;
    try {
        const mergedEvent = {
            ...event,
            body,
        };
        const prizeCheckResponse = await invokeLambda(PRIZE_CHECKER_INVOKE_PARAMS, mergedEvent);
        if (prizeCheckResponse.statusCode !== 200) {
            return prizeCheckResponse;
        }
        prizeRedeemResponse = await invokeLambda(PRIZE_REDEEM_INVOKE_PARAMS, mergedEvent);
    } catch (err) {
        prizeRedeemResponse = err;
    }

    return prizeRedeemResponse;
};

/**
 * Creates final response from the redeem prize responses
 *
 * @param {Array<Object>} responses - Array of responses
 * @return {Object} - Returns single merge response
 */
const createFinalResponses = (responses) => {
    const mergedSuccessfulResponseBody = {
        wonPrizes: [],
        notRedeemedItems: [],
    };
    const mergedUnsuccessfulResponseBody = { prizeRedeemErrors: [] };

    responses.forEach((response) => {
        const { body, statusCode } = response;
        const bodyObj = JSON.parse(body);

        if (statusCode === 200) {
            if (bodyObj?.message === 'Not enough currencies') {
                mergedSuccessfulResponseBody.notRedeemedItems.push(bodyObj.items);
            } else {
                mergedSuccessfulResponseBody.wonPrizes.push(bodyObj);
            }
        } else {
            mergedUnsuccessfulResponseBody.prizeRedeemErrors.push(bodyObj);
        }
    });

    Object.keys(mergedSuccessfulResponseBody).forEach((key) => {
        if (mergedSuccessfulResponseBody[key].length === 0) {
            delete mergedSuccessfulResponseBody[key];
        }
    });

    if (Object.keys(mergedSuccessfulResponseBody).length > 0) {
        return createResponse(RESPONSE_OK, mergedSuccessfulResponseBody);
    }
    if (mergedUnsuccessfulResponseBody.prizeRedeemErrors.length > 0) {
        return createResponse(RESPONSE_BAD_REQUEST, mergedUnsuccessfulResponseBody);
    }

    return createResponse(RESPONSE_OK, {});
};

/**
 * Lambda for auto redeeming prizes depending on the current request participation (that is if the user has won enough
 * currencies to win the auto redeem prizes)
 *
 * @param {Object} event - Received event
 * @param {Object} context - Lambda context
 * @param callback - Lambdas callback for returning the response
 */
const autoRedeemPrize = async (event) => {
    const requestId = extractRequestId(event);

    try {
        const params = await safeExtractParams(event);
        checkPassedParameters(params, REQUIRED_PARAMETERS_FOR_LAMBDA.autoRedeemPrizeLambda);
        const participation = await getParticipation(params.gppUserId, requestId);
        let prizes;
        const walletTotalByWonCurrencies = getWalletTotalByCurrencyFromParticipation(participation);
        if (!walletTotalByWonCurrencies) {
            prizes = [];
        } else {
            prizes = await getAutoRedeemPrizesByConfigurationId(params.configurationId);
        }

        const promises = [];
        prizes.forEach((prize) => {
            if (prize.cost && Array.isArray(prize.cost)) {
                const walletTotal = walletTotalByWonCurrencies[prize.cost[0].currency_id];
                if (walletTotal && walletTotal >= prize.cost[0].amount) {
                    promises.push(redeemPrize(event, prize.prize_id));
                } else {
                    promises.push(createResponseInsufficientCurrencies([prize.cost[0].currency_id], prize, '200'));
                }
            }
        });
        const responses = await Promise.all(promises);
        const finalResponse = createFinalResponses(responses);
        return finalResponse;
    } catch (error) {
        console.error('ERROR: Returning error response:\n', error);
        return error;
    }
};

module.exports = {
    autoRedeemPrize,
};
