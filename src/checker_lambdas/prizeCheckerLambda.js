const Moment = require('moment-timezone');
const { middyValidatorWrapper } = require('../middlewares/middyValidatorWrapper');
const { projectionQuery, determineIfCNG } = require('../database/prizeCatalogueTable');
const {
    createResponseNotEnoughPrizes,
    createErrorBody,
    extractParams,
    createResponse,
    createResponseCantRedeemPrize,
} = require('../utility_functions/utilityFunctions');
const { PRIZE_CATALOGUE_COUNTERS: { TOTAL_AVAILABLE } } = require('../constants/common');
const { ERROR_CODES: { CHECKER_LAMBDA_REJECTION } } = require('../constants/errCodes');
const { RESPONSE_BAD_REQUEST, RESPONSE_OK } = require('../constants/responses');
const { REQUIRED_PARAMETERS_FOR_CHECKER_LAMBDA } = require('../constants/checkers');
const { getConfiguration } = require('../utility_functions/configUtilities');

/**
 * Gets the prize
 * @param {object} params
 * @param {Array<string>} attributes
 * @returns {object}
 * @throws created error response
 */
const getPrize = async (params, attributes) => {
    const prize = await projectionQuery(params.configurationId, params.prizeId, [...attributes],
        params.responseType);
    console.log('Data from query:\n', JSON.stringify(prize));
    if (prize[0]) {
        return prize[0];
    }
    const errorBody = createErrorBody(CHECKER_LAMBDA_REJECTION, `Prize with id ${params.prizeId} does not exist!`);
    const errResponse = createResponse(RESPONSE_BAD_REQUEST, errorBody);
    throw errResponse;
};

/**
 * Checks if the prize is valid by determining if it's C&G and looks up for timestamps to check the expiration.
 * If it's not then it's InstantWin and checks if its active.
 * @param {object} prize
 * @param {string} prize.prizeId
 * @param {boolean} prize.active
 * @param {number|undefined} prize.startDate
 * @param {number|undefined} prize.endDate
 * @param {string} prize.configurationId
 * @param {object} event
 * @throws created error response
 */
const checkIsPrizeValid = async ({
    prizeId, active, startDate, endDate, configurationId,
}, event) => {
    const currentTimestamp = Moment().unix() * 1000;
    const errorRes = createResponseCantRedeemPrize(prizeId);
    const configuration = await getConfiguration(configurationId, event);
    const { flow, configurationParameters: { configurationStartUtc: configStartDate, configurationEndUtc: configEndDate } } = configuration;
    const prizeStartDate = startDate || configStartDate;
    const prizeEndDate = endDate || configEndDate;
    const hasTimestamps = prizeStartDate && prizeEndDate;
    const isCNG = flow ? determineIfCNG(flow) : false;

    if (isCNG && hasTimestamps && (currentTimestamp < prizeStartDate || prizeEndDate < currentTimestamp)) {
        throw errorRes;
    }

    if (!isCNG && !active) {
        throw errorRes;
    }
};

/**
 * Check if there is enough prizes in prize catalogue table to fulfill the request.
 * @param {object} prize
 * @param {string} prize.prizeId
 * @param {number} prize.totalAvailable
 * @throws created error response
 */
const checkPrizeAmount = ({ totalAvailable, prizeId }) => {
    if (totalAvailable > 0) return;
    throw createResponseNotEnoughPrizes(prizeId, TOTAL_AVAILABLE, totalAvailable || 0);
};

/**
 * This lambda should check if the prize is active and there are enough prizes for user to purchase
 * It expects PRIZE_ID.
 * @param event - data that we receive from request
 */
const prizeCheckerLambda = async (event) => {
    try {
        const params = extractParams(event);
        const {
            total_available, active, start_date, end_date,
        } = await getPrize(params, [TOTAL_AVAILABLE, 'active', 'start_date', 'end_date']);
        await checkIsPrizeValid({
            prizeId: params.prizeId,
            active,
            startDate: start_date,
            endDate: end_date,
            configurationId: params.configurationId,
        }, event);
        checkPrizeAmount({ prizeId: params.prizeId, totalAvailable: total_available });
        const response = createResponse(RESPONSE_OK, '');
        console.log('Returning response:\n', JSON.stringify(response));
        return response;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', errorResponse);
        return errorResponse;
    }
};

module.exports = {
    prizeCheckerLambda: middyValidatorWrapper(prizeCheckerLambda, REQUIRED_PARAMETERS_FOR_CHECKER_LAMBDA.prizeCheckerLambda),
};
