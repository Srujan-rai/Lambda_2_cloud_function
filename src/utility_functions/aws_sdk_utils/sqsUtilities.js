const { captureAWSv3Client } = require('aws-xray-sdk-core');
const { SendMessageCommand, DeleteMessageCommand } = require('@aws-sdk/client-sqs');
const { createSQSClientManager } = require('../../awsSdkClientManager');

const sqsClientManager = createSQSClientManager();

const STAGE_NAME = process.env.stageName;
const REGION_NAME = process.env.regionName;
const ACCOUNT_ID = process.env.accountId;
/**
 * Creates MailQueue url
 * @param {string} accountId - account id
 * @param {string} stageId - stage id
 * @returns {string} - mail queue url
 */
const getMailQueueURL = () => `https://sqs.${REGION_NAME}.amazonaws.com/${ACCOUNT_ID}/${STAGE_NAME}MailQueue`;

/**
 * Creates currency expiration SQS url
 * @param {string} accountId - account id
 * @param {string} stageId - stage id
 * @returns {string} - mail queue url
 */
const getCurrencyExpirationQueueURL = () => `https://sqs.${REGION_NAME}.amazonaws.com/${ACCOUNT_ID}/${STAGE_NAME}CurrencyExpirationQueue`;

/**
 * Creates winning moments upload SQS url
 * @returns {string} - winning moments queue url
 */
const getWinningMomentsQueueURL = () => `https://sqs.${REGION_NAME}.amazonaws.com/${ACCOUNT_ID}/${STAGE_NAME}WinningMomentsUploadQueue`;

/**
 * Creates digital codes upload SQS url
 * @returns {string} - winning moments queue url
 */
const getDigitalCodesQueueURL = () => `https://sqs.${REGION_NAME}.amazonaws.com/${ACCOUNT_ID}/${STAGE_NAME}DigitalCodesUploadQueue`;

/**
 * Creates expirationWalletUpdate Que Url
 * @returns {String} - expiration wallet queue url
 */
const getExpirationWalletQueueURL = () => `https://sqs.${REGION_NAME}.amazonaws.com/${ACCOUNT_ID}/${STAGE_NAME}ExpirationWalletQueue.fifo`;

/**
 * Creates digital codes expiration SQS url
 * @returns {string} - mail queue url
 */
const getDigitalCodesExpirationQueueURL = () => `https://sqs.${REGION_NAME}.amazonaws.com/${ACCOUNT_ID}/${STAGE_NAME}DigitalCodesExpirationQueue`;

/**
 * Creates replication upload SQS url
 * @returns {string} - upload queue url
 */
const getReplicationUploadQueueURL = () => `https://sqs.${REGION_NAME}.amazonaws.com/${ACCOUNT_ID}/${STAGE_NAME}ReplicationUploadQueue`;

/**
 * Creates replication upload SQS url
 * @returns {string} - upload queue url
 */
const getWinningMomentsExpiratonQueueURL = () => `https://sqs.${REGION_NAME}.amazonaws.com/${ACCOUNT_ID}/${STAGE_NAME}WinningMomentsExpirationQueue`;

/**
 * Creates generic dynamodb writter SQS url
 * @param {string} accountId - account id
 * @param {string} stageId - stage id
 * @returns {string} - mail queue url
 */
const getGenericDbWriterQueue = () => `https://sqs.${REGION_NAME}.amazonaws.com/${ACCOUNT_ID}/${STAGE_NAME}GenericDbWriterQueue`;

/**
 * Creates external service DLQ url
 * @returns {string} - external service DLQ url
 */
const getExternalSerivceDlqURL = () => `https://sqs.${REGION_NAME}.amazonaws.com/${ACCOUNT_ID}/${STAGE_NAME}ExternalServiceDLQ.fifo`;

/**
 * Function that send message SQS
 * @param {Object} queueParams - SendMessageCommandInput params
 * @return {Promise<any>} - Returns a Promise after finishing sqs.sendMessage
 */

const sendSQSMessage = async (queueParams, clientOptions = {}) => {
    const sqs = captureAWSv3Client(sqsClientManager.getClient(clientOptions));
    const messageSendCommand = new SendMessageCommand(queueParams);
    try {
        const data = await sqs.send(messageSendCommand);
        console.log(`New message with id: ${data.MessageId} added to queue`);
        return data;
    } catch (err) {
        console.log(`Failed to send message for processing to queue: ${err}`);
        throw err;
    }
};

/**
 * Function that deletes SQS message
 * @param {String} receiptHandle - The receipt handle associated with the message to delete
 * @param {String} messageId - The message ID
 * @return {Promise<any>} - Returns a Promise after finishing sqs.deleteMessage
 */
const deleteSQSMessage = async (receiptHandle, messageId, queueUrl) => {
    const sqs = captureAWSv3Client(sqsClientManager.getClient());

    const params = {
        QueueUrl: queueUrl,
        ReceiptHandle: receiptHandle,
    };
    const deleteCommand = new DeleteMessageCommand(params);
    try {
        const data = await sqs.send(deleteCommand);
        console.log(`SQS Message ${messageId} successfully deleted.`);
        return data;
    } catch (err) {
        console.log(`Failed to delete SQS message ${messageId} ${err}`);
        throw err;
    }
};

/**
 * Function that returns list of vouchers to SQS
 * @param {Object} messageBody - Object containing the message details
 * @return {Promise<any>} - Returns a Promise after finishing sqs.sendMessage
 */
const returnBackToSQS = async (messageBody, queueUrl) => {
    const sqs = captureAWSv3Client(sqsClientManager.getClient());
    // SQS message parameters
    const queueParams = {
        MessageBody: JSON.stringify(messageBody),
        QueueUrl: queueUrl,
    };
    const messageSendCommand = new SendMessageCommand(queueParams);
    try {
        const data = await sqs.send(messageSendCommand);
        console.log(`Vouchers for uploading with id: ${data.MessageId} RE-added to queue`);
        return data;
    } catch (err) {
        console.log(`Failed to send vouchers for processing to queue: ${err}`);
        throw err;
    }
};

module.exports = {
    getMailQueueURL,
    getCurrencyExpirationQueueURL,
    getWinningMomentsQueueURL,
    getDigitalCodesQueueURL,
    getExpirationWalletQueueURL,
    getDigitalCodesExpirationQueueURL,
    getReplicationUploadQueueURL,
    getWinningMomentsExpiratonQueueURL,
    getGenericDbWriterQueue,
    getExternalSerivceDlqURL,
    sendSQSMessage,
    deleteSQSMessage,
    returnBackToSQS,
};
