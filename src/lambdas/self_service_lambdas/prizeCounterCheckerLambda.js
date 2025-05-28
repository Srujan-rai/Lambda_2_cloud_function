const utils = require('../../utility_functions/utilityFunctions');
const prizeCatalogueTableUtils = require('../../database/prizeCatalogueTable');
const digitalCodesTableUtils = require('../../database/digitalCodesTable');
const { RESPONSE_OK } = require('../../constants/responses');
/**
 * Handler function for a Lambda that checks if prize counters for total amount and total available are correct.
 * Depending on the received parameters, the Lambda checks:
 *  - All of the prizes in the prize catalog table (if no parameters are received)
 *  - Specific prize (if one prize ID is in the received parameters)
 *  - Multiple prizes (if multiple prize IDs, concatenated by comma, are in the received parameters)
 *
 * @param {Object} event - Data that we receive from request
 * @param {Object} context - Lambda context
 * @param callback - Callback function for returning the response
 */
module.exports.prizeCounterChecker = (event, context, callback) => {
    console.log('Received event:\n', JSON.stringify(event));

    let prizeIds;
    const invalidPrizeIds = [];

    utils.safeExtractParams(event)
        .then((params) => {
            const { prizeId } = params;
            if (prizeId) {
                if (typeof prizeId !== 'string') {
                    return Promise.reject(utils.createResponseInvalidParameter('prizeId'));
                }
                const promises = [];
                prizeIds = prizeId.split(',');
                prizeIds.forEach((id) => {
                    promises.push(prizeCatalogueTableUtils.queryByPrizeId(id.trim()));
                });
                return Promise.all(promises)
                    .then((result) => {
                        let processedResult = [];
                        result.forEach((item, i) => {
                            if (item.length > 0) {
                                processedResult = processedResult.concat(item);
                            } else {
                                invalidPrizeIds.push(prizeIds[i].trim());
                            }
                        });
                        return Promise.resolve(processedResult);
                    });
            }
            return prizeCatalogueTableUtils.getAllPrizes();
        })
        .then((prizes) => {
            const promises = [];
            prizes.forEach((prize) => {
                promises.push(checkCountersForOnePrize(prize));
            });
            return Promise.all(promises);
        })
        .then((checkCountersResult) => {
            if (invalidPrizeIds.length > 0) {
                addInvalidPrizeIdsToResult(checkCountersResult, invalidPrizeIds);
            }
            console.log('Prize counter checker result:\n', JSON.stringify(checkCountersResult));
            const response = utils.createResponse(RESPONSE_OK, { checkedPrizes: checkCountersResult });
            console.log('Returning success response...');
            callback(null, response);
        })
        .catch((error) => {
            console.error('ERROR: Returning error response:\n', error);
            callback(null, error);
        });
};

/**
 * Checks the counters for a specific prize and returns a result of the check
 *
 * @param {Object} prize - Prize that we want to check
 * @return {Promise<{prizeId: (Object.redeemed_prize.prize_id|Object.prize_id|String)} | never>}
 */
function checkCountersForOnePrize(prize) {
    return digitalCodesTableUtils.getDigitalCodesByPrizeId(prize.prize_id)
        .then((digitalCodes) => {
            const prizeCounters = countDigitalCodes(digitalCodes);
            const checkCounterResult = createCheckCounterResult(prize, prizeCounters);
            return Promise.resolve(checkCounterResult);
        });
}
/**
 * Returns prize counters by counting digital codes
 *
 * @param {Array} digitalCodes - Array of digital codes
 * @return {{prizeId: string, totalAmount: number, totalAvailable: number}} - Returns JSON object with the prize counters
 */
function countDigitalCodes(digitalCodes) {
    const totalAmount = digitalCodes.length;
    let totalAvailable = 0;
    let totalClaimed = 0;
    let totalExpired = 0;
    let totalRemoved = 0;
    let totalReserved = 0;
    digitalCodes.forEach((item) => {
        switch (item.voucher_status) {
            case 'available':
                totalAvailable += 1;
                break;
            case 'claimed':
                totalClaimed += 1;
                break;
            case 'expired':
                totalExpired += 1;
                break;
            case 'removed':
                totalRemoved += 1;
                break;
            case 'reserved':
                totalReserved += 1;
                break;
            default:
                console.error('Unknown status', item.voucher_status, 'for digital code:', item.prize_id, item.voucher);
        }
    });
    return {
        totalAmount,
        totalAvailable,
        totalClaimed,
        totalExpired,
        totalRemoved,
        totalReserved,
    };
}

/**
 * Creates the result of the prize counter checker
 *
 * @param {Object} prize - JSON object of the prize
 * @param {Object} prizeCounters - JSON object containing the counted prize counters
 * @return {Object} - Returns the result of the prize counter checker
 */
function createCheckCounterResult(prize, prizeCounters) {
    const checkCounterResult = {
        prizeId: prize.prize_id,
    };
    if (prize.total_amount === prizeCounters.totalAmount
        && prize.total_available === prizeCounters.totalAvailable
        && (prize.total_claimed === undefined || prize.total_claimed === prizeCounters.totalClaimed)
        && (prize.total_reserved === undefined || prize.total_reserved === prizeCounters.totalReserved)
        && (prize.total_expired === undefined || prize.total_expired === prizeCounters.totalExpired)
        && (prize.total_removed === undefined || prize.total_removed === prizeCounters.totalRemoved)) {
        checkCounterResult.verified = true;
    } else {
        checkCounterResult.verified = false;
        checkCounterResult.error = {};
        if (prize.total_amount !== prizeCounters.totalAmount) {
            checkCounterResult.error.totalAmount = {
                prizeCatalogueCount: prize.total_amount,
                digitalCodesCount: prizeCounters.totalAmount,
            };
        }
        if (prize.total_available !== prizeCounters.totalAvailable) {
            checkCounterResult.error.totalAvailable = {
                prizeCatalogueCount: prize.total_available,
                digitalCodesCount: prizeCounters.totalAvailable,
            };
        }
        if (prize.total_claimed && prize.total_claimed !== prizeCounters.totalClaimed) {
            checkCounterResult.error.totalClaimed = {
                prizeCatalogueCount: prize.total_claimed,
                digitalCodesCount: prizeCounters.totalClaimed,
            };
        }
        if (prize.total_reserved && prize.total_reserved !== prizeCounters.totalReserved) {
            checkCounterResult.error.totalReserved = {
                prizeCatalogueCount: prize.total_reserved,
                digitalCodesCount: prizeCounters.totalReserved,
            };
        }
        if (prize.total_expired && prize.total_expired !== prizeCounters.totalExpired) {
            checkCounterResult.error.totalExpired = {
                prizeCatalogueCount: prize.total_expired,
                digitalCodesCount: prizeCounters.totalExpired,
            };
        }
        if (prize.total_removed && prize.total_removed !== prizeCounters.totalRemoved) {
            checkCounterResult.error.totalRemoved = {
                prizeCatalogueCount: prize.total_removed,
                digitalCodesCount: prizeCounters.totalRemoved,
            };
        }
    }
    return checkCounterResult;
}

/**
 * Adds invalid prize IDs to the counter checker result
 *
 * @param {Array} result - Array of counter checker results
 * @param {Array<string>} invalidPrizeIds - Array of invalid prize IDs
 */
function addInvalidPrizeIdsToResult(result, invalidPrizeIds) {
    if (result && Array.isArray(result)) {
        invalidPrizeIds.forEach((prizeId) => {
            result.push({
                prizeId,
                verified: false,
                error: 'Prize does not exist',
            });
        });
    }
}
