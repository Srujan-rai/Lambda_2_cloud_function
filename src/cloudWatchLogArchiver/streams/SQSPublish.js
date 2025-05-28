/* eslint-disable no-underscore-dangle */
const { SendMessageBatchCommand } = require('@aws-sdk/client-sqs');
const { Transform } = require('stream');

const { pause, calcJitBackoffDelay } = require('../common/helpers');

const { ResultsManagerInstance } = require('../metrics/ResultsManager');
const CloudWatchRateLimiter = require('../utils/CloudWatchRateLimiter');

/**
 * The `SQSPublish` class is a custom Transform stream that publishes log groups to an AWS SQS queue in batches.
 * It handles message size validation, batch sending, retries, and error handling. The class is responsible for:
 *
 * - Constructing the Transform stream with the necessary configuration (batch size, high watermark)
 * - Buffering log group messages in memory until the batch size is reached
 * - Sending message batches to the SQS queue using the provided SQS client
 * - Handling errors and implementing retry logic with exponential backoff
 * - Flushing remaining messages in the buffer when the stream closes
 */
class SQSPublish extends Transform {
    /**
     * Creates a new SQSPublish transform stream instance.
     *
     * @param {Object} sqsClient - AWS SQS client for sending message batches
     * @param {string} queueUrl - Target SQS queue URL
     * @param {Object} config - Configuration options
     * @param {number} config.pauseDurationMs - Base pause duration between retries in ms
     * @param {number} config.sqsMessageBatchSize - Number of messages per batch to send to SQS (max 10)
     * @param {number} config.highWaterMark - Maximum internal buffer size
     * @param {number} config.maxRetries - Maximum retry attempts
     * @param {Object} logger - Logger instance for errors and info
     * @throws {Error} When batch size > 10 (AWS SQS limit)
     * @throws {Error} When queue URL is missing
     */
    constructor(sqsClient, queueUrl, config, logger) {
        super({
            objectMode: true,
            highWaterMark: config.highWaterMark,
        });

        this.sqsClient = sqsClient;
        this.queueUrl = queueUrl;
        this.config = config;
        this.logger = logger;
        this.messageBuffer = [];
        this.correlationId = '';

        this.validateParams();
    }

    validateParams() {
        if (this.config.sqsMessageBatchSize > 10) throw new Error('Batch size cannot exceed 10 messages per AWS SQS limits');

        if (!this.queueUrl) throw new Error('Queue URL is required');
    }

    async _transform(logGroup, _encoding, callback) {
        this.correlationId = `sqs-publish-${Date.now()}`;

        if (!logGroup) {
            callback(new Error('Log group is required'));
            return;
        }

        try {
            const messageSize = Buffer.from(JSON.stringify(logGroup)).length;
            if (messageSize > 256 * 1024) throw new Error('Message exceeds SQS size limit of 256KB');

            this.messageBuffer.push({ MessageBody: JSON.stringify(logGroup) });

            if (this.messageBuffer.length >= this.config.sqsMessageBatchSize) {
                await this.sendMessageBatch(this.config.maxRetries);
            }

            callback(null, logGroup);
        } catch (error) {
            ResultsManagerInstance.addFailure(error, 'sqsMessagesSent');
            this.logger.error({
                message: 'Failed to send message to SQS',
                error,
                correlationId: this.correlationId,
            });

            callback(error);
        }
    }

    async sendMessageBatch(retryCount) {
        try {
            if (process.env.SKIP_SEND_MESSAGE_TO_SQS === 'true') {
                console.log('Skipping sending message to SQS');
                return;
            }

            await CloudWatchRateLimiter.throttle();
            await this.sqsClient.send(new SendMessageBatchCommand(this.createMessageParams()));
            this.handleSuccess();
        } catch (error) {
            const retryableErrors = ['RequestLimitExceeded', 'ThrottlingException', 'ServiceUnavailable'];
            const canRetry = retryableErrors.includes(error.name) && retryCount > 1;

            if (!canRetry) return this.handleError(error);

            await this.handleRetry();
        }
    }

    async _flush(callback) {
        try {
            console.info('Flushing remaining messages to SQS');

            if (this.messageBuffer.length > 0) {
                this.logger.info({
                    message: 'Sending remaining messages to SQS',
                    correlationId: this.correlationId,
                    remainingMessageBuffer: this.messageBuffer.length,
                });
                await this.sendMessageBatch();
            }

            callback();
        } catch (error) {
            callback(error);
        }
    }

    async handleRetry() {
        ResultsManagerInstance.addRetry();
        this.logger.warn({
            message: 'Retrying to send message to SQS',
            correlationId: this.correlationId,
            retryCount: this.config.maxRetries,
        });

        await pause(calcJitBackoffDelay(this.config.pauseDurationMs, this.config.maxRetries));
        return this.sendMessageBatch(this.config.maxRetries - 1);
    }

    handleError(error) {
        ResultsManagerInstance.addFailure(error, 'sqsMessagesSent');
        this.logger.error({
            message: 'Failed to send message to SQS',
            error,
            correlationId: this.correlationId,
        });
        throw new Error(`Batch send failed: ${error.message}`);
    }

    createMessageParams() {
        return {
            QueueUrl: this.queueUrl,
            Entries: this.messageBuffer.map((msg, index) => ({
                Id: `${this.correlationId}-${index}`,
                ...msg,
            })),
        };
    }

    handleSuccess() {
        ResultsManagerInstance.updateCounter(this.messageBuffer.length, 'sqsMessagesSent');
        this.logger.info({
            message: 'Batch sent to SQS',
            correlationId: this.correlationId,
        });

        this.messageBuffer = [];
    }

    _destroy(error, callback) {
        this.logger.warn({
            message: 'SQS Publish stream destroyed',
            errorName: error?.name,
            errorMessage: error?.message,
        });
        callback(error);
        super.destroy();
    }
}

module.exports = SQSPublish;
