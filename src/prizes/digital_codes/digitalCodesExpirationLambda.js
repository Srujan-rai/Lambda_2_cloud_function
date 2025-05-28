const Utils = require('../../utility_functions/utilityFunctions');
const DigitalCodes = require('../../database/digitalCodesTable');
const PrizeCatalogue = require('../../database/prizeCatalogueTable');
const DBUtils = require('../../database/dbUtilities');
const {
    getDigitalCodesExpirationQueueURL,
    deleteSQSMessage,
    sendSQSMessage,
} = require('../../utility_functions/aws_sdk_utils/sqsUtilities');
const { DIGITAL_CODES_STATUS } = require('../../constants/common');

const queueUrl = getDigitalCodesExpirationQueueURL();

/**
 * Updates prize counters object
 * @param {Array} code - digital code item
 * @param {Object} countersObj - empty object or object from type {configId: {prizeId: { status: N, status2: N}}}
 */
const addToPrizeCountersObj = (code, countersObj) => {
    const configId = code.configuration_id;
    const status = code.voucher_status;
    //  get the prize name without -N partition suffix
    const prizeId = Utils.extractPrizeId(code.prize_id);

    if (!Object.prototype.hasOwnProperty.call(countersObj, configId)) {
        countersObj[configId] = {};
    }
    if (!Object.prototype.hasOwnProperty.call(countersObj[configId], prizeId)) {
        countersObj[configId][prizeId] = {};
    }
    if (!Object.prototype.hasOwnProperty.call(countersObj[configId][prizeId], status)) {
        countersObj[configId][prizeId][status] = 1;
    } else {
        countersObj[configId][prizeId][status] += 1;
    }
};

/**
 * Changes status for all codes from passed array to expired
 * @param {Array} codes - contains digital code objects
 * @return {Promise} - object containing prizeUpdate numbers, codes that need to be resend and failed updates counter
 */
const expireCodes = async (codes) => {
    const prizeCountersObj = {};
    const throttledUpdates = [];
    const timedOutUpdates = [];
    const failedUpdates = { count: 0, items: [] };
    let exp_time;

    if (process.env.ARCHIVE_EXPIRED_CONFIG_DATA === 'true') {
        exp_time = Utils.createExpTime(6);
    }

    // eslint-disable-next-line
    for (const code of codes) {
        // vouchers should expire only if initially queried status was not changed meanwhile
        const transactionParams = DigitalCodes.createChangeStatusTransactionItem(
            code.prize_id,
            code.voucher,
            code.voucher_status,
            DIGITAL_CODES_STATUS.EXPIRED,
            { should_expire: 'false', ...exp_time && { exp_time } },
        ).Update;

        // removing promises array with allSettled method, and adding forof loop to go through the codes separately in order to,
        // slow down the process of updating the codes and not throttle/error the digital_codes_table.
        // if needed will add DB.UTILS SLEEP FUNCTIONIONS OR RETRY MIN/MAX SLEEP FUNCTION for randomized delay or timeout of 100-300 MS.

        // TODO: Add batch processing with expo back off and retry for throttled/timed out updates.
        try {
            await DBUtils.update(transactionParams, true);
            addToPrizeCountersObj(code, prizeCountersObj);
        } catch (err) {
            const errorMessage = JSON.parse(err.body);
            const errorCode = errorMessage.errorDetails.DynamoDBCode;
            console.error(`Error processing code ${code.voucher}: ${err}`);

            switch (errorCode) {
                case DBUtils.EXCEPTIONS.THROTTLING_EXCEPTION:
                    throttledUpdates.push(code);
                    break;
                case 'TimeoutError':
                    timedOutUpdates.push(code);
                    break;
                default:
                    failedUpdates.count += 1;
                    failedUpdates.items.push({ transactionParams, code });
            }
        }
    }

    return {
        prizeCountersObj,
        throttledUpdates,
        timedOutUpdates,
        failedUpdates,
    };
};

/**
 * Updates prize counters for prizes
 * @param {Objects} countersObj - contains counters for prizes eg: eg: {configId: {prizeId: { status: N}}}
 * @return {Promise} - promise with the result of update operation
 */
const updatePrizeCounters = (countersObj) => {
    const promises = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const config in countersObj) {
        if (Object.prototype.hasOwnProperty.call(countersObj, config)) {
            // eslint-disable-next-line no-restricted-syntax
            for (const prize in countersObj[config]) {
                if (Object.prototype.hasOwnProperty.call(countersObj[config], prize)) {
                    const statusesObj = countersObj[config][prize];
                    const promise = PrizeCatalogue.updateCountersForExpiredPrize(config, prize, statusesObj)
                        .catch((err) => {
                            const errorMessage = JSON.parse(err.body);
                            console.error(`Failed to update prize counters: ${JSON.stringify(errorMessage)}`);
                            return Promise.reject(errorMessage);
                        });
                    promises.push(promise);
                }
            }
        }
    }

    return Promise.allSettled(promises);
};

/**
 * Queries current status for array of codes and returns counter object for expired codes
 * @param {Array} updatesArr - contains digital code objects
 * @return {Promise} - containing counters object eg: {configId: {prizeId: { status: N}}}
 */
const checkTimedOutUpdate = async (expirationResult) => {
    const promises = [];
    // check current status for each code where timeout was received
    expirationResult.timedOutUpdates.forEach((item) => {
        const promise = new Promise(async (resolve, reject) => {
            try {
                const data = await DBUtils.executeWithRetry(() => DigitalCodes.mainQuery(item.prize_id, item.voucher));
                // if expired update the counters obj for that prize
                const code = data[0];
                if (code.voucher_status && code.voucher_status === 'expired') {
                    addToPrizeCountersObj(code, expirationResult.prizeCountersObj);
                }
                resolve();
            } catch (err) {
                const errorMessage = JSON.parse(err.body);
                console.error(`Failed to query digital codes table: ${errorMessage}`);
                reject(errorMessage);
            }
        });
        promises.push(promise);
    });
    return Promise.allSettled(promises);
};

/**
 * Lambda function triggered by SQS
 * Receives array of digital codes and updates their status to expired
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
module.exports.digitalCodesExpirationLambda = async (event) => {
    if (event.Records.length > 0) {
        try {
            const messageBody = JSON.parse(event.Records[0].body);
            const messageReceiveCount = event.Records[0].attributes.ApproximateReceiveCount;
            const messageReceiptHandle = event.Records[0].receiptHandle;
            const { messageId } = event.Records[0];

            console.log('NUMBER OF CODES RECEIVED IN MESSAGE: ', messageBody.length);
            // if we fail continuously with unexpected error, delete the message
            if (messageReceiveCount > 10) {
                await deleteSQSMessage(messageReceiptHandle, messageId, queueUrl);
                console.error(`DELETING MESSAGE:\n ${messageBody}`);
                return 'Message was deleted after reaching the ReceiveCount threshold';
            }

            const result = await expireCodes(messageBody);
            const expirationResult = { ...result };
            if (expirationResult.timedOutUpdates.length) {
                await checkTimedOutUpdate(expirationResult);
            }

            if (!(Object.keys(expirationResult.prizeCountersObj).length === 0
                && expirationResult.prizeCountersObj.constructor === Object)) {
                await updatePrizeCounters(expirationResult.prizeCountersObj);
            }
            console.log(`No prize counters were updated. Received counters object: ${JSON.stringify(expirationResult.prizeCountersObj)}`);
            if (expirationResult.throttledUpdates.length) {
                console.log('Number of throttled updates:', expirationResult.throttledUpdates.length);
                await sendSQSMessage({
                    MessageBody: JSON.stringify(expirationResult.throttledUpdates),
                    QueueUrl: queueUrl,
                });
            }
            console.log(`Number of resent codes: ${expirationResult.throttledUpdates.length}`);
            console.log(`Number of failed to expire codes: ${expirationResult.failedUpdates.count}`);
            return 'CODES EXPIRATION COMPLETED';
        } catch (err) {
            console.error(err);
            throw new Error(`CODES EXPIRATION ERROR ${err}`);
        }
    } else {
        throw new Error('Empty message');
    }
};

module.exports.expireCodes = expireCodes;
