const { createResponse } = require('../utility_functions/utilityFunctions');
const { getCurrencyExpirationQueueURL, sendSQSMessage } = require('../utility_functions/aws_sdk_utils/sqsUtilities');
const { splitArray } = require('../utility_functions/utilityFunctions');
const { getExpiredCurrencies } = require('../database/expirationWalletTable');
const { RESPONSE_OK } = require('../constants/responses');

/**
 * Generates SQS message with currencies subject of expiration
 * and sends it to the SQS queue to be picked by expirator lambda
 * @param {Array} expiredCurrencies - Array that contains expiryWallet records
 * @return {Promise<any>} - Returns a Promise after finishing sqs.sendMessage
 */
const distributeInSQS = async (expiredCurrencies) => {
    console.log('Rows to be updated:\n', expiredCurrencies.length);
    const queueUrl = getCurrencyExpirationQueueURL();

    const expireCurrenciesInBatches = async (itemsArr) => {
        if (itemsArr.length > 100) {
            const chunksOfExpiredCurrencies = splitArray(itemsArr, 100);
            const promises = chunksOfExpiredCurrencies.map((chunk) => sendSQSMessage({
                MessageBody: JSON.stringify(chunk),
                QueueUrl: queueUrl,
            }));
            await Promise.allSettled(promises)
                .then((results) => {
                    const fulfilledCount = results.filter((promise) => promise.status === 'fulfilled').length;
                    console.log(`${fulfilledCount} out of ${results.length} message chunks successfully sent to SQS.`);
                })
                .catch((err) => {
                    console.error('ERROR: Returning error response:\n', JSON.stringify(err));
                    throw err;
                });
        } else {
            await sendSQSMessage({
                MessageBody: JSON.stringify(itemsArr),
                QueueUrl: queueUrl,
            });
        }
    };

    try {
        await expireCurrenciesInBatches(expiredCurrencies);
        return expiredCurrencies.length;
    } catch (err) {
        console.log(`Sending message failed with - , ${err}`);
        return -1;
    }
};

/**
 * Lambda that gets all expired currencies
 * and adds SQS tasks to expire + deduct user's wallet
 * @param event
 * @param context
 * @param callback
 * @return {Object} - object with number of currencies sent for expiration
 */
const currencyExpiryEvaluation = async () => {
    try {
        const expiredCurrencies = await getExpiredCurrencies();

        const amountOfCurrenciesSent = await distributeInSQS(expiredCurrencies);
        console.log('Rows updated! Count:', amountOfCurrenciesSent);
        return createResponse(RESPONSE_OK, { amountOfCurrenciesSent });
    } catch (err) {
        console.error('ERROR: Failed to get/send expired currencies to SQS:\n', err);
        throw err;
    }
};

module.exports = {
    currencyExpiryEvaluation,
};
