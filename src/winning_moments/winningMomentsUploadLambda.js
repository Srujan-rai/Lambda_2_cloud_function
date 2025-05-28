const WinningMoments = require('../database/winningMomentsTable');
const { getWinningMomentsQueueURL, deleteSQSMessage, sendSQSMessage } = require('../utility_functions/aws_sdk_utils/sqsUtilities');
const { getExpirationTimestamp } = require('../utility_functions/utilityFunctions');
const { getConfiguration } = require('../utility_functions/configUtilities');

const queueUrl = getWinningMomentsQueueURL();

/**
 * Requests available messages from the winningMomentsUpload SQS queue
 * and then process them by uploading to digital_codes_table.
 * Any moments that failed because of Throttle_exception are collected in array
 * and returned back to the sqs with new message. The ones that are found to be
 * duplicate or with invalid parameters are removed from the sqs.
 *
 * @param {Object} event - Data that we receive from request
 * @param {Object} context - Lambda context
 * @param callback - Callback function for returning the response
 *
 * @returns {Promise}
 */
module.exports.winningMomentsUploadLambda = async (event) => {
    const messageBody = JSON.parse(event.Records[0].body);
    const messageReceiveCount = event.Records[0].attributes.ApproximateReceiveCount;
    const messageReceiptHandle = event.Records[0].receiptHandle;
    const { messageId } = event.Records[0];
    let momentsToRetry = 0;

    // if we fail continuously with unexpected error, delete the message
    if (messageReceiveCount > 10) {
        await deleteSQSMessage(messageReceiptHandle, messageId).catch((err) => { throw err; });
        console.error(`DELETING MESSAGE:\n ${messageBody}`);
        return 'Message was deleted after reaching the ReceiveCount threshold';
    }

    if (event.Records.length > 0) {
        const { momentsToUpload, configurationId } = messageBody;
        const config = await getConfiguration(configurationId, event);
        const winningMomentExpTimestamp = getExpirationTimestamp(config);
        console.log(`Message contains ${momentsToUpload.length} moments for upload!`);
        const retryEntries = await WinningMoments.putCSVEntries(momentsToUpload, configurationId, winningMomentExpTimestamp);
        if (retryEntries.length) {
            if (retryEntries.length > 1000) {
                await retryInChunksToSQS(retryEntries);
            } else {
                momentsToRetry = await retryToSQS(messageBody, retryEntries, momentsToRetry);
            }
        }
        const uploadedMomentsCount = momentsToUpload.length - momentsToRetry;
        console.log(`${uploadedMomentsCount} moments uploaded successfully`);
        return `${uploadedMomentsCount} moments uploaded successfully`;
    }

    throw new Error('Empty message');
};

const retryToSQS = async (messageBody, retryEntries, momentsToRetry) => {
    momentsToRetry = retryEntries.length;
    messageBody.momentsToUpload = retryEntries;
    console.log(`Sending back to SQS ${retryEntries.length} failed to upload moments`);
    await sendSQSMessage({
        MessageBody: JSON.stringify(messageBody),
        QueueUrl: queueUrl,
    });
    return momentsToRetry;
};
const retryInChunksToSQS = async (momentsArr) => {
    // eslint-disable-next-line no-restricted-syntax
    for (const momentsChunk of momentsArr) {
        console.log(`Sending back to SQS ${momentsChunk} failed to upload moments`);
        await sendSQSMessage({
            MessageBody: JSON.stringify(momentsChunk),
            QueueUrl: queueUrl,
        });
    }
};
