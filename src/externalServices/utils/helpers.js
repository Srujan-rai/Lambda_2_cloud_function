const { processCache } = require('../../middlewares/utils');
const { createS3FileParams } = require('../../utility_functions/aws_sdk_utils/s3Utilities');
const { getExternalSerivceDlqURL, sendSQSMessage } = require('../../utility_functions/aws_sdk_utils/sqsUtilities');

const CACHE_EXPIRY = parseInt(process.env.CACHE_EXPIRY || 600000);

const fetchWithCache = async (cacheKey, fetchFunction, doNotCacheEmpty, cacheTime) => {
    const { value } = processCache(
        { cacheExpiry: cacheTime || CACHE_EXPIRY, cacheKey },
        fetchFunction,
        cacheKey,
        doNotCacheEmpty,
    );
    const result = await value;
    return result;
};

const getConfiguration = async (configurationId) => {
    const config = await fetchWithCache(
        configurationId,
        async (configId) => createS3FileParams(configId, 'application/json'),
    );
    return config;
};

const createInvalidError = (message) => new Error(message, { cause: 'INVALID' });

const sendMessageToDLQ = async (record) => {
    console.log('Sending message to DLQ: ', record.messageId);
    await sendSQSMessage({
        MessageBody: record.body,
        MessageGroupId: record.attributes.MessageGroupId,
        MessageDeduplicationId: record.attributes.MessageDeduplicationId,
        QueueUrl: getExternalSerivceDlqURL(),
    });
};

module.exports = {
    fetchWithCache,
    getConfiguration,
    sendMessageToDLQ,
    createInvalidError,
};
