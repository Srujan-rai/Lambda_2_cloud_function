const Moment = require('moment-timezone');
const {
    getNumberOfUserWinsForPrizeId,
    getNumberOfUserWinsForTier,
    getAvailableMoment,
    setWinningMomentUnavailable,
} = require('../../../database/winningMomentsTable');
const {
    getWinningLimitsPerTier,
    getWinningLimitPerPrize,
    getViralCodesPrizeLimits,
} = require('../../../self_service/configurationUtils');
const {
    pincodesStringToArray,
} = require('../../../participation_types/pincodes/mixCodesUtilityFunctions');
const { getConfiguration } = require('../../../utility_functions/configUtilities');
const { executeWithRetry } = require('../../../database/dbUtilities');
const { PARAMS_MAP: { CONFIGURATION_ID, FLOW_LABEL, PINS } } = require('../../../constants/common');
/**
 * Updates the winning moment table if limitations (I.E. winning limit per prize) are fulfilled.
 * @param eventParams
 * @param {Array} winningMomentItems - the moments available for the user
 * @param participationTime - timestamp of participating in IW
 */
const claimWinningMoment = (eventParams, winningMomentItems, participationTime) => {
    if (!winningMomentItems) {
        // no moments available..
        return Promise.reject();
    }
    // Pass the first item from the winningMomentItems array and use its length as retrying attempts
    return executeWithRetry(
        () => setWinningMomentUnavailable(
            winningMomentItems.shift(),
            participationTime,
            eventParams.gppUserId,
        ),
        winningMomentItems.length,
    );
};

/**
 * Checks if user has reached limit of wins for this prize/tier.
 * @param eventParams
 * @param gppUserId - userId to check against for reached prize limits
 * @param tableQueryFunction - which function to use from the table handler in order to check user prize/tier usage
 * @param arrayOfLimits - Limits set on config level. Could be tier/prize limits
 * @return {Promise} array of prizeId/tiers that user has reached the limits for
 */
const checkReachedLimit = async (eventParams, gppUserId, tableQueryFunction, arrayOfLimits = {}) => {
    try {
        const reachedLimits = [];
        const promises = Object.entries(arrayOfLimits).map(async ([id, limit]) => {
            console.log(`${id}: ${limit}`);
            // eslint-disable-next-line no-param-reassign
            id = Number.isNaN(+id) ? id : parseInt(id);
            return (async () => {
                const userUsed = await tableQueryFunction(eventParams[CONFIGURATION_ID], gppUserId, id);
                if (limit && (userUsed >= limit)) {
                    // if limit is no defined or user is still under limit, resolve.
                    reachedLimits.push(id);
                    console.log('Reached limit!');
                }
            })();
        });

        await Promise.all(promises);
        return reachedLimits;
    } catch (err) {
        console.log(err);
        throw err;
    }
};

/**
 * Extracts limitations from configuration and checks if user is valid for claiming the winning moment
 * @param eventParams
 * @param config - retrieved config from s3
 * @returns {Promise} with tierLimits and prizeLimits properties
 */
const getReachedLimits = async (eventParams, config) => {
    const reachedLimitsResponse = {};
    const tierLimits = getWinningLimitsPerTier(config, eventParams[FLOW_LABEL]);
    const prizeLimits = getWinningLimitPerPrize(config, eventParams[FLOW_LABEL]);
    const viralPrizesMap = getViralCodesPrizeLimits(config, eventParams[FLOW_LABEL]);
    if (viralPrizesMap) {
        const matchedViralPrizes = matchViralPrizes(viralPrizesMap, eventParams[PINS]);
        reachedLimitsResponse.allowedViralPrizes = matchedViralPrizes;
    }
    const reachedTierLimits = await checkReachedLimit(eventParams, eventParams.gppUserId, getNumberOfUserWinsForTier, tierLimits);
    reachedLimitsResponse.reachedTierLimits = reachedTierLimits;
    const reachedPrizeLimits = await checkReachedLimit(eventParams, eventParams.gppUserId, getNumberOfUserWinsForPrizeId, prizeLimits);
    reachedLimitsResponse.reachedPrizeLimits = reachedPrizeLimits;
    return reachedLimitsResponse;
};

/**
 * Creates result for case when user is a winner.
 * @param prizeId - prizeId to add to the winning response
 */
const createWinnerResult = async (prizeId) => {
    const result = {
        winner: true,
        prizeId,
    };
    return result;
};

/**
 * Creates result for cese when user is not a winner
 */
const createLooserResult = async () => {
    const result = { winner: false };
    return result;
};

/**
 * Instant win algorithm. Uses winning_moments_table and compares it to participation moment in order to determine
 * if user is a winner, as well as to determine prizeId in winning case.
 * @param eventParams
 * @return {Promise} loosing/winning json result
 */
const executeWinningAttempt = async (eventParams, event) => {
    try {
        const participationTime = Moment().toDate().getTime();

        const config = await getConfiguration(eventParams[CONFIGURATION_ID], event);
        const limitations = await getReachedLimits(eventParams, config);

        const availableMoments = await getAvailableMoment(
            eventParams[CONFIGURATION_ID],
            participationTime,
            limitations.reachedTierLimits,
            limitations.reachedPrizeLimits,
            limitations.allowedViralPrizes,
        );

        console.log(`Found ${availableMoments.length} available moments..`);

        if (!availableMoments[0]) {
            throw new Error('zero available momments');
        }

        const claimedWinningMoment = await claimWinningMoment(eventParams, availableMoments.slice(0, 5), participationTime);
        return createWinnerResult(claimedWinningMoment.Attributes.prize_id);
    } catch (err) {
        if (err) {
            console.error('Err is: ', err);
        }
        return createLooserResult();
    }
};

/**
 * Check if there are viral prizes linked to the used pincodes
 * if there are returns array of prizeIds that will be used for query WM
 * @param prizesMap - json object mapping viral pins with prize ids
 * @param pins - list of used pincodes
 * @return {Array} allowed prizeIds
 */
const matchViralPrizes = (prizesMap, pins) => {
    if (prizesMap) {
        pins = pincodesStringToArray(pins);
        let allowedPrizes = [];
        pins.forEach((pin) => {
            if (!prizesMap[pin]) {
                console.error('given viral code not supported', pin);
                return;
            }
            allowedPrizes = [...prizesMap[pin]];
        });
        if (allowedPrizes.length > 0) {
            return allowedPrizes;
        }
        throw new Error('viral pin not found in config');
    } else {
        return undefined;
    }
};

module.exports = {
    executeWinningAttempt,
    checkReachedLimit,
};
