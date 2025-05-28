const DBUtils = require('../database/dbUtilities');
const digitalCodes = require('../database/digitalCodesTable');
const PrizeCatalogue = require('../database/prizeCatalogueTable');
const SQSUtils = require('../utility_functions/aws_sdk_utils/sqsUtilities');
const { DIGITAL_CODES_STATUS } = require('../constants/common');

const queueUrl = SQSUtils.getDigitalCodesQueueURL();

/**
 * Function that returns list of vouchers to SQS
 * @param {Object} messageBody - Object containing the message details
 * @return {Promise<any>} - Returns a Promise after finishing sqs.sendMessage
 */
const returnBackToSQS = async (messageBody) => {
    try {
        const data = await SQSUtils.sendSQSMessage({
            MessageBody: JSON.stringify(messageBody),
            QueueUrl: queueUrl,
        });
        console.log(`Vouchers for uploading with id: ${data.MessageId} RE-added to queue`);
        return data;
    } catch (err) {
        console.log(`Failed to send vouchers for processing to queue: ${err}`);
        throw err;
    }
};

/**
 * Requests available messages from the digitalCodesUpload SQS queue
 * and then process them by uploading to digital_codes_table.
 * Any codes that failed because of Throttle_exception are collected in array
 * and returned back to the sqs with new message. The ones that are found to be
 * duplicate or with invalid parameters are removed from the sqs.
 *
 * @param {Object} event - Data that we receive from request
 * @param {Object} context - Lambda context
 * @param callback - Callback function for returning the response
 *
 * @returns {Promise}
 */
module.exports.digitalCodesUploadLambda = async (event) => {
    const failedVouchers = [];
    const alreadyExistingVouchers = [];
    const invalidDataVouchers = [];

    if (event.Records.length > 0) {
        const messageBody = JSON.parse(event.Records[0].body);
        const messageReceiveCount = event.Records[0].attributes.ApproximateReceiveCount;
        const messageReceiptHandle = event.Records[0].receiptHandle;
        const { messageId } = event.Records[0];
        const { vouchersToUpload } = messageBody;
        console.log('VOUCHERS LENGTH IS: ', vouchersToUpload.length);

        let { prizeId } = messageBody;
        if (messageBody.partitionNumber) {
            prizeId += `-${messageBody.partitionNumber}`;
        }

        const { configurationId } = messageBody;

        // if we fail continuously with unexpected error, delete the message
        if (messageReceiveCount > 10) {
            await SQSUtils.deleteSQSMessage(messageReceiptHandle, messageId, queueUrl);
            console.error(`DELETING MESSAGE:\n ${messageBody}`);
            return 'Message was deleted after reaching the ReceiveCount threshold';
        }
        // eslint-disable-next-line no-restricted-syntax
        for (const voucher of vouchersToUpload) {
            const insertItem = {
                voucher: voucher.voucher,
                configurationId,
                experience: voucher.experience,
                expiryDate: voucher.expiryDate,
                prizeId,
                voucherStatus: DIGITAL_CODES_STATUS.AVAILABLE,
                finalState: messageBody.finalState,
                shouldExpire: messageBody.shouldExpire,
            };

            // eslint-disable-next-line no-restricted-syntax
            await new Promise((resolve) => {
                // eslint-disable-next-line no-restricted-syntax
                (async () => {
                    try {
                        await digitalCodes.putEntry(insertItem);
                        resolve();
                    } catch (err) {
                        // check if the error is because of Condition failure -> in our case that will mean item
                        // already exists
                        const errorMessage = JSON.parse(err.body);
                        if (errorMessage.errorDetails.DynamoDBCode === DBUtils.EXCEPTIONS.CONDITIONAL_CHECK_FAILED_EXCEPTION) {
                            console.error(`Voucher ${voucher.voucher} already exists`);
                            alreadyExistingVouchers.push(insertItem);
                            return resolve();
                        }
                        if (errorMessage.errorDetails.DynamoDBCode === DBUtils.EXCEPTIONS.VALIDATION_EXCEPTION) {
                            console.error(`Voucher ${voucher.voucher} contains invalid data`);
                            invalidDataVouchers.push(insertItem);
                            return resolve();
                        }
                        if (errorMessage.errorDetails.DynamoDBCode === DBUtils.EXCEPTIONS.THROTTLING_EXCEPTION) {
                            failedVouchers.push(voucher);
                            return resolve();
                        }
                        if (errorMessage.errorDetails && errorMessage.errorDetails.DynamoDBCode) {
                            console.error(`Voucher upload failed because ${errorMessage}`);
                            failedVouchers.push(voucher);
                        }
                        resolve();
                    }
                })();
            });
        }
        // execute all promises in the array
        try {
            if (failedVouchers.length > 0) {
                messageBody.vouchersToUpload = failedVouchers;
                await returnBackToSQS(messageBody);
            }
            const insertedCodesCount = vouchersToUpload.length
                - failedVouchers.length
                - alreadyExistingVouchers.length
                - invalidDataVouchers.length;

            if (insertedCodesCount) {
                const incrementResult = await PrizeCatalogue.incrementPrizeAmounts(
                    configurationId,
                    messageBody.prizeId,
                    insertedCodesCount,
                );
                return incrementResult;
            }
            const codesTotal = {
                inserted: insertedCodesCount,
                failed: failedVouchers.length,
                alreadyExistingVouchers: alreadyExistingVouchers.length,
                invalidDataVouchers: invalidDataVouchers.length,
            };
            return codesTotal;
        } catch (error) {
            console.error(`Failed to import digital codes CSV entries:\n, ${JSON.stringify(error)}`);
            return error;
        }
    } else {
        throw new Error('Empty message');
    }
};
