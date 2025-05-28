const {
    queryEndDate,
    expireAvailablePrizes,
    queryPrizeWithExpirableMoments,
} = require('../../../database/prizeCatalogueTable');
const { createResponse } = require('../../../utility_functions/utilityFunctions');
const {
    getWinningMomentsExpiratonQueueURL,
    sendSQSMessage,
} = require('../../../utility_functions/aws_sdk_utils/sqsUtilities');
const { queryMomentsPrizeAndConfiguration } = require('../../../database/winningMomentsTable');
const { RESPONSE_OK } = require('../../../constants/responses');

/**
 * Will evaluate the moments which have to be expired based on "has_expirable_moments" flag in the prize
 * @returns {Array} of moments
 */
const evalMomentsByEndDate = async () => {
    const prizesWithExpirableWM = await queryPrizeWithExpirableMoments();
    const evalTime = new Date().getTime();

    if (prizesWithExpirableWM.length === 0) {
        const response = createResponse(RESPONSE_OK, { message: 'No prizes with expirable moments.' });
        console.log('Returning response:\n', JSON.stringify(response));
        return response;
    }

    const momentsToExpire = await Promise.all(prizesWithExpirableWM.map(async (prize) => {
        const activeMomentsLeft = await queryMomentsPrizeAndConfiguration(prize.configuration_id, prize.prize_id, 'configuration_id, gmt_start, gmt_end');
        return activeMomentsLeft;
    }));

    return momentsToExpire.filter((arr) => arr.length).flat().filter((wm) => wm.gmt_end <= evalTime);
};

/**
 * Will evaluate the moments which have to be expired based on "has_end_date" flag in the prize
 * and if the prize "end_date" is in the past. Also will reset the prize counters to 0
 * @returns {Array}
 */
const evalMomentsByPrizeEndDate = async () => {
    const expiredWinningMomentPrizes = await queryEndDate(new Date().getTime());
    if (expiredWinningMomentPrizes.length === 0) {
        const response = createResponse(RESPONSE_OK, { message: 'No prizes expired yesterday.' });
        console.log('Returning response:\n', JSON.stringify(response));
        return response;
    }
    const momentsToExpire = [];
    // TODO to be checked
    // eslint-disable-next-line no-restricted-syntax
    for (const prize of expiredWinningMomentPrizes) {
        const { configuration_id: configurationId, prize_id: prizeId, total_available: totalAvailable } = prize;
        if (totalAvailable > 0) {
            const activeMomentsLeft = await queryMomentsPrizeAndConfiguration(configurationId, prizeId, 'configuration_id, gmt_start');
            // eslint-disable-next-line no-restricted-syntax
            for (const winningMoment of activeMomentsLeft) {
                momentsToExpire.push(winningMoment);
            }
            // Reset total available for prizes to prevent claiming moments
            await expireAvailablePrizes(prizeId, configurationId, totalAvailable);
        } else {
            console.log(`Total available is 0 in prizeId:${prizeId} and configurationId:${configurationId}`);
        }
    }

    return momentsToExpire;
};

/**
 * Generates SQS message with currencies subject of expiration
 * and sends it to the SQS queue to be picked by expirator lambda
 * @param {Array} expiredCurrencies - Array that contains expiryWallet records
 * @return {Promise<any>} - Returns a Promise after finishing sqs.sendMessage
 */
const distributeInSQS = (expiredMoments) => {
    console.log('Rows to be updated:\n', expiredMoments.length);
    const queueUrl = getWinningMomentsExpiratonQueueURL();
    return sendSQSMessage({
        MessageBody: JSON.stringify(expiredMoments),
        QueueUrl: queueUrl,
    });
};

const evalMoments = {
    wm_end_date: evalMomentsByEndDate,
    prize_end_date: evalMomentsByPrizeEndDate,
};

/**
 * Lambda which will expire the winning moments associated with a specific prize/configuration id, so
 * they cannot be used anymore for this prize/configuration and will not carry on.
 * @returns {Array}
 */
const winningMomentsExpiryEvaluater = async (event) => {
    try {
        const momentsToExpire = await evalMoments[event.type]();
        /* eslint-disable */
        let i; let j; const chunk = 1500;
        for (i = 0, j = momentsToExpire.length; i < j; i += chunk) {
            const tempArray = momentsToExpire.slice(i, i + chunk);
            await new Promise((resolve) => setTimeout(resolve, 1500));
            const promise = new Promise((resolve) => {
                distributeInSQS(tempArray)
                    .then(() => resolve())
                    .catch((err) => {
                        console.error(`batch failed distribute in sqs.. ${err}`);
                        resolve();
                    });
            });
            await promise;
        }
        const response = createResponse(RESPONSE_OK, {});
        return response;
    } catch (err) {
        console.log(`Winning moments expiration failed with', ${JSON.stringify(err)}`);
        return err;
    }
};

module.exports = {
    winningMomentsExpiryEvaluater,
};
