const { IW_ERR } = require('@the-coca-cola-company/ngps-global-common-messages');
const warmer = require('lambda-warmer');
const bluebird = require('bluebird');
const randomNumber = require('random-number-csprng-2');
const { middyValidatorWrapper } = require('../middlewares/middyValidatorWrapper');
const {
    createErrBody,
    extractParams,
    extractRequestId,
    parseBody,
    createResponse,
    shuffleArray,
    getExpirationTimestamp,
    createErrorBody,
} = require('../utility_functions/utilityFunctions');
const { getConfiguration } = require('../utility_functions/configUtilities');
const { invokeLambda } = require('../utility_functions/aws_sdk_utils/lambdaUtilities');
const { getAlgorithmFunction } = require('./winning_algorithms/winninAlgorithmsMapper');
const { getAlwaysWinPrize, getRatioWinning, getWinningLimitsPerTier } = require('../self_service/configurationUtils');
const { addItemToParticipation, checkForRedemptionLimit } = require('../database/participationsDatabase');
const { checkIsUserBlocked } = require('../utility_functions/blockedUsersUtilities');
const { alwaysWinPoolQuery } = require('../database/prizeCatalogueTable');
const { REQUIRED_PARAMETERS_FOR_LAMBDA, CONFIGURATION_FUNCTIONS_MAP } = require('../constants/lambdas');
const { PARAMS_MAP: { CONFIGURATION_ID, FLOW_LABEL } } = require('../constants/common');
const { RESPONSE_BAD_REQUEST, RESPONSE_INTERNAL_ERROR, RESPONSE_OK } = require('../constants/responses');
const { ERR_CODES: { IW_PRIZE_REDEEM_FAILED, FLOW_LAMBDA_REJECTION }, ERROR_CODES: { UNKNOWN_ERROR } } = require('../constants/errCodes');
const { checkReachedLimit } = require('./winning_algorithms/winning_moments/winningMoment');
const {
    getNumberOfUserWinsForTier,
} = require('../database/winningMomentsTable');
/**
* Post processing of instant win algorithm in case that user is a winner.
* This function is responsible for redeeming the prize returned by algorithm.
*/
const executeWinningScenario = async (event, algorithmResult, recordExpiration) => {
    let expirationTimestamp = recordExpiration;
    if (!recordExpiration) {
        const params = extractParams(event);
        const configuration = await getConfiguration(params[CONFIGURATION_ID], event);
        expirationTimestamp = getExpirationTimestamp(configuration);
    }

    try {
        const prizeRedeemEvent = { ...event };
        const prizeRedeemBody = extractParams(event);
        prizeRedeemBody.prizeId = algorithmResult.prizeId;
        if (algorithmResult.skipLimitCheck) {
            prizeRedeemBody.skipLimitCheck = algorithmResult.skipLimitCheck;
        }
        prizeRedeemEvent.body = JSON.stringify(prizeRedeemBody);
        const response = await invokeLambda(CONFIGURATION_FUNCTIONS_MAP.prizeRedeemLambda, prizeRedeemEvent);
        const { redeemedPrize } = parseBody(response);
        const result = { winner: true, redeemedPrize, expirationTimestamp };
        return result;
    } catch (error) {
        const genericErrorBody = createErrBody(IW_PRIZE_REDEEM_FAILED, 'Prize could not be redeemed!', undefined, UNKNOWN_ERROR);
        const rejectionReason = error.body.includes(IW_ERR.REDEMPTION_LIMIT_REACHED)
            ? createResponse(RESPONSE_BAD_REQUEST, error.body)
            : createResponse(RESPONSE_INTERNAL_ERROR, genericErrorBody);
        // user has won a prize, but redeem wasn't successful! According to PO, this is not valid scenario for instantWin
        // but from technical perspective prize count can be 0. We then just return appropriate error message indicating
        // that the prize is not available for the prize id.
        throw rejectionReason;
    }
};

/**
* Create range blocks for ratio-based instant win
* @param {Array} prizes - ratio-based prizes
* @returns {Array} - ranges specified the prize ids, range lower/upper values, and total_available of the prize
*/
const createRatioWinningRanges = (prizes) => {
    const ranges = [];

    const total = prizes.reduce((acc, prize) => {
        ranges.push({
            prizeId: prize.prize_id,
            lowerVal: acc + 1,
            upperVal: acc += prize.winning_ratio,
            totalAvailable: prize.total_available,
        });
        return acc;
    }, 0);

    if (total !== 10000) {
        throw createResponse(RESPONSE_BAD_REQUEST, 'The total percentage of the ratios should be equal to 100%.');
    }

    return ranges;
};

/**
* Execute randomized draw to select prize from ratio-based prize ranges
* @param {Array} ranges - Array of objects with prizeId, lower/upper range values, and total available prizes
* @returns {string} Prize ID of selected prize
*/
const drawWinningPrizeId = async (ranges) => {
    const randomNum = await randomNumber(1, 10000);

    // decide which prize to win based on where the random number locates in the range blocks
    const prizeRange = ranges.find((range) => randomNum >= range.lowerVal && randomNum <= range.upperVal);

    return prizeRange.prizeId;
};

/**
* Execute randomized draw for ratio-based winning prizes
* @param {Object} params - Parameters
* @param {Object} params.event - Event data
* @param {Array} params.prizes - Array of prize objects with ratios
* @param {Number} params.expirationTimestamp - Expiration timestamp
* @returns {Promise} Result of executeWinningScenario call
*/
const ratioWinningDraw = async ({ event, prizes, expirationTimestamp }) => {
    const ratioBasedPrizes = checkPrizeRatios(prizes);
    const ranges = createRatioWinningRanges(ratioBasedPrizes);
    const algorithmResult = {
        winner: true,
        prizeId: await drawWinningPrizeId(ranges),
        skipLimitCheck: true,
    };

    return executeWinningScenario(event, algorithmResult, expirationTimestamp);
};

/**
* Recalculate the ratios if the total_available of any prizes is 0
* @param {Array} params.prizes - Array of prize objects with ratios
* @returns {Array} params.prizes - Array of recalculated prize objects with ratios
*/
function checkPrizeRatios(prizes) {
    let totalZeroRatio = 0;
    const availableItems = prizes.filter(({ total_available, winning_ratio }) => {
        if (total_available > 0) return true;
        totalZeroRatio += winning_ratio;
        return false;
    });

    if (availableItems.length === 0) {
        throw createResponse(RESPONSE_BAD_REQUEST, 'No available prizes.');
    }

    if (totalZeroRatio === 0) return prizes;

    const newPrizes = availableItems.map((item) => ({
        ...item,
        winning_ratio: Math.trunc(item.winning_ratio + totalZeroRatio / availableItems.length),
    }));

    newPrizes[0].winning_ratio += 10000 - newPrizes.reduce((sum, { winning_ratio }) => sum + winning_ratio, 0);

    console.log(`Done checking/recalculating ratios for the prizes. Return prizes: ${JSON.stringify(newPrizes)}`);

    return newPrizes;
}

/**
* Post processing of instant win algorithm in case that always win is set to true
*  Tries to award always win prize from pool.
* Handles ratio based winning if enabled.
* Throws error if no prizes available.
* @param {Object} event - data that we receive from request
* @param {String|Boolean} alwaysWinPrizeId - alwaysWin variable from configuration
* @param {Object} params - params from event
* @param {Number} expirationTimestamp - expiration timestamp
* @param {Boolean} isRatioWinning - flag indicating whether ratio winning functionality is enabled
* @returns {Promise}
*/
const executeAlwaysWinScenario = async (event, alwaysWinPrizeId, params, expirationTimestamp, isRatioWinning) => {
    try {
        if (alwaysWinPrizeId !== true) {
        // TODO: remove once all active promotions switch to pool
            return executeWinningScenario(event, { winner: true, prizeId: alwaysWinPrizeId }, expirationTimestamp);
        }

        const prizes = await alwaysWinPoolQuery(params[CONFIGURATION_ID], isRatioWinning);
        if (prizes.length === 0) return { winner: false };

        await checkTierLimit(params, event);

        if (isRatioWinning) return ratioWinningDraw({ event, prizes, expirationTimestamp });

        const shuffledPrizes = shuffleArray(prizes);
        const promises = shuffledPrizes.map(async (prize) => {
            await checkForRedemptionLimit({ ...params, prizeId: prize.prize_id }, prize);
            return prize.prize_id;
        });

        const algorithmResult = { winner: true, prizeId: await bluebird.any(promises), skipLimitCheck: true };
        return executeWinningScenario(event, algorithmResult, expirationTimestamp);
    } catch (err) {
        console.error('ERROR:', err);
        if (bluebird.AggregateError && err instanceof bluebird.AggregateError) {
            const knownError = err.find((e) => typeof e?.body === 'string'
                && (
                    e.body.includes('Tier Limit for this tier has been reached')
                    || e.body.includes(IW_ERR.TIER_LIMIT_REACHED)
                    || e.body.includes('Redemption Limit for this prize has been reached')
                    || e.body.includes(IW_ERR.REDEMPTION_LIMIT_REACHED)
                ),
            );

            if (knownError) {
                throw createResponse(RESPONSE_BAD_REQUEST, knownError.body);
            }
        }
        throw err;
    }
};

/**
* Post processing of instant win algorithm in case that user was not a winner.
* @param {Object} event - data that we receive from request
* @returns {Promise}
*/
const executeLoosingScenario = async (event) => {
    const params = extractParams(event);
    const configuration = await getConfiguration(params[CONFIGURATION_ID], event);
    const alwaysWinPrizeId = getAlwaysWinPrize(configuration, params[FLOW_LABEL]);
    const expirationTimestamp = getExpirationTimestamp(configuration);
    if (alwaysWinPrizeId) {
        const isRatioWinning = getRatioWinning(configuration, params[FLOW_LABEL]);
        return executeAlwaysWinScenario(event, alwaysWinPrizeId, params, expirationTimestamp, isRatioWinning);
    }
    return { winner: false, expirationTimestamp };
};

/**
* Lambda function. Executes instant win mechanism, with winning algorithm specified in configuration
* @param {Object} event - data that we receive from request
*/
const instantWinLambda = async (event) => {
    try {
        if (await warmer(event)) return 'warmed';
        let result;
        const params = extractParams(event);
        await checkIsUserBlocked(params);
        const algorithm = await getAlgorithmFunction(params[CONFIGURATION_ID], params[FLOW_LABEL], event);
        const algorithmResult = await algorithm(params, event);
        if (algorithmResult && algorithmResult.winner) {
            result = await executeWinningScenario(event, algorithmResult);
        } else {
            result = await executeLoosingScenario(event);
        }
        const { expirationTimestamp, ...finalResponse } = result;
        const participationRawData = await addItemToParticipation(
            params, extractRequestId(event), { instantWinWinner: result.winner, endOfConf: expirationTimestamp },
        );
        const participationID = parseBody(participationRawData).entry.participationId;
        const response = createResponse(RESPONSE_OK, {
            instantWinResult: finalResponse,
            participationId: participationID,
        });
        console.log('Returning response:\n', JSON.stringify(response));
        return response;
    } catch (err) {
        console.error('ERROR: Returning error response:\n', err);
        return err;
    }
};

/**
 * Checks if a user has exceeded the winning limit for any tier.
 *
 * 1. If tier limits exist, calls the helper function `checkReachedLimit` to determine
 *    whether the user has reached or exceeded any tier limit.
 * 2. If the user has reached a limit, logs the error, creates an error response, and throws it.
 */
const checkTierLimit = async (params, event) => {
    const configuration = await getConfiguration(params[CONFIGURATION_ID], event);
    const tierLimits = getWinningLimitsPerTier(configuration, params[FLOW_LABEL]);
    if (!tierLimits) {
        console.warn('No tier limits defined.');
        return;
    }

    const reachedTiers = await checkReachedLimit(
        params,
        params.gppUserId,
        getNumberOfUserWinsForTier,
        tierLimits,
    );

    if (reachedTiers.length === 0) return;

    const errorBody = createErrorBody(
        FLOW_LAMBDA_REJECTION,
        'Tier Limit for this tier has been reached',
        { errorDetails: IW_ERR.TIER_LIMIT_REACHED },
    );
    throw createResponse(RESPONSE_BAD_REQUEST, errorBody);
};

module.exports = {
    instantWinLambda: middyValidatorWrapper(instantWinLambda, REQUIRED_PARAMETERS_FOR_LAMBDA.instantWin),
    checkTierLimit,
};
