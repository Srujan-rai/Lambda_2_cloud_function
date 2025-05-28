/* eslint-disable no-useless-catch */
const { saveItem } = require('./unsuccessfulBurnAttemptsTable');
const { getGenericDbWriterQueue, deleteSQSMessage, sendSQSMessage } = require('../utility_functions/aws_sdk_utils/sqsUtilities');
const { EXCEPTIONS } = require('./dbUtilities');

const logger = {
    pincodeError: saveItem,
};

/**
 * Lambda that gets SQS messages for applying generic dynamodb writes
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
module.exports.genericDynamoDbWriter = async (event) => {
    let messageBody;
    const queueUrl = getGenericDbWriterQueue();

    const messageReceiveCount = event.Records[0].attributes.ApproximateReceiveCount;
    const messageReceiptHandle = event.Records[0].receiptHandle;
    const { messageId } = event.Records[0];

    if (messageReceiveCount > 10) {
        try {
            await deleteSQSMessage(messageReceiptHandle, messageId, queueUrl);
            console.error(`DELETING MESSAGE:\n ${messageBody}`);
            return 'Message was deleted after reaching the ReceiveCount threshold';
        } catch (err) {
            throw err;
        }
    }
    try {
        if (event.Records.length) {
            const promises = [];
            const failedDynamodbWrites = [];
            messageBody = JSON.parse(event.Records[0].body);

            messageBody.forEach((dynamoDbWriteResult) => {
                const promise = new Promise(async (resolve, reject) => {
                    try {
                        const loggerFn = logger[dynamoDbWriteResult.reason];
                        await loggerFn(dynamoDbWriteResult);
                        resolve();
                    } catch (err) {
                        const errBody = JSON.parse(err.body);
                        if (errBody.errorDetails && errBody.errorDetails.DynamoDBCode === EXCEPTIONS.THROTTLING_EXCEPTION) {
                            failedDynamodbWrites.push(dynamoDbWriteResult);
                        }
                        reject();
                    }
                });
                promises.push(promise);
            });
            await Promise.allSettled(promises);
            if (failedDynamodbWrites.length > 0) {
                const params = {
                    MessageBody: JSON.stringify(failedDynamodbWrites),
                    QueueUrl: queueUrl,
                };
                await sendSQSMessage(params);
            }
        } else {
            throw new Error('The received message didnt contain any information');
        }
    } catch (err) {
        throw err;
    }
};
