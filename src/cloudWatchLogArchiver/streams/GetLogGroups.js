/* eslint-disable no-continue */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-underscore-dangle */
const { DescribeLogGroupsCommand } = require('@aws-sdk/client-cloudwatch-logs');
const { Readable } = require('stream');

const { pause } = require('../common/helpers');

const { ResultsManagerInstance } = require('../metrics/ResultsManager');
const CloudWatchRateLimiter = require('../utils/CloudWatchRateLimiter');
const CloudWatchError = require('../common/CloudWatchError');

/**
 * The `GetLogGroups` class extends the `Readable` stream interface to fetch and process AWS CloudWatch log groups.
 * It implements a robust error handling mechanism with exponential backoff for throttling exceptions,
 * manages batch processing of log groups with backpressure support, and tracks metrics through a ResultsManager.
 *
 * Key features:
 * - Throttling and rate limiting management
 * - Batch processing with configurable size
 * - Automatic retry mechanism with exponential backoff
 * - Comprehensive error handling and logging
 * - Stream backpressure support
 */
class GetLogGroups extends Readable {
    /**
     * Initializes a new instance of the `GetLogGroups` class.
     *
     * @param cloudWatchClient - AWS CloudWatch Logs client instance for API interactions.
     * @param {Object} config - Configuration settings for the stream behavior.
     * @param {Object} config.highWaterMark - Maximum number of objects to store in the internal buffer.
     * @param {Object} config.maxBackoffDelay - Maximum delay in milliseconds between retry attempts.
     * @param {number} config.getLogsBatchSize - Number of log groups to retrieve per API request.
     * @param {Object} logger - Logger instance for tracking operations and debugging.
     */
    constructor(cloudWatchClient, config, logger) {
        super({
            highWaterMark: config.highWaterMark,
            objectMode: true,
        });

        this.cloudWatchClient = cloudWatchClient;
        this.config = config;
        this.nextToken = null;
        this.retryCount = 0;
        this.logger = logger;
    }

    async _read() {
        this.correlationId = `get-log-groups-${Date.now()}`;
        try {
            await CloudWatchRateLimiter.throttle();
            const command = new DescribeLogGroupsCommand({
                nextToken: this.nextToken,
                limit: this.config.getLogsBatchSize,
            });

            const { logGroups, nextToken } = await this.cloudWatchClient.send(command);
            if (!logGroups.length && !nextToken) {
                this.logger.warn({
                    message: 'No log groups found',
                    correlationId: this.correlationId,
                    logGroups,
                });
                this.push(null);
                return;
            }

            this.processLogGroups(logGroups, nextToken);

            if (!nextToken) {
                const processedCount = ResultsManagerInstance.getCounter('logGroupsProcessed');
                this.logger.info({
                    message: `No more log groups to retrieve from CloudWatch. Total log groups processed: ${processedCount}`,
                });
                this.push(null);
                return;
            }

            this.nextToken = nextToken;
            this.retryCount = 0;
        } catch (error) {
            this.logger.error({
                message: 'Error fetching log groups',
                error,
                correlationId: this.correlationId,
            });

            const canRetry = error.name === 'ThrottlingException' && this.retryCount < this.maxRetries;
            if (!canRetry) return this.handleError(error, canRetry);

            await this.handleRetry();
        }
    }

    async handleRetry() {
        this.retryCount++;
        const backoffDelay = this.calcBackoffDelay();

        this.logger.warn({
            message: 'Retrying after throttling exception',
            retryCount: this.retryCount,
            backoffDelay,
            correlationId: this.correlationId,
        });

        ResultsManagerInstance.addRetry();
        await pause(backoffDelay);
        return this._read();
    }

    handleError(error, canRetry) {
        const isCloudWatchError = error && error instanceof CloudWatchError;

        if (!canRetry || !isCloudWatchError) {
            ResultsManagerInstance.addFailure(error, 'LogGroupSource');
            this.logger.error({
                message: !isCloudWatchError
                    ? 'Error processing log groups. Error is not an instance of CloudWatchError.'
                    : 'Error processing log groups with no retry',
                retryInfo: {
                    retryCount: this.retryCount,
                    maxRetries: this.maxRetries,
                    lastKey: this.nextToken,
                },
                error,
                correlationId: this.correlationId,
            });

            return this.destroy(error);
        }
    }

    processLogGroups(logGroups, nextToken) {
        ResultsManagerInstance.updateCounter(
            logGroups.length,
            'logGroupsProcessed',
        );

        for (const logGroup of logGroups) {
            if (!logGroup.logGroupArn) {
                this.logger.warn({
                    message: 'Log group does not have an ARN. Skipping.',
                    logGroup,
                    correlationId: this.correlationId,
                });
                continue;
            }

            const canContinue = this.push(logGroup);
            if (!canContinue) {
                this.logger.warn({
                    message: 'Backpressure detected. Stopping further processing.',
                    correlationId: this.correlationId,
                });
                return;
            }
        }

        this.logger.info({
            message: 'Retrieved log groups',
            count: logGroups.length,
            hasMoreResults: !!nextToken,
            correlationId: this.correlationId,
        });
    }

    calcBackoffDelay() {
        return Math.min(
            this.baseDelay * 2 ** this.retryCount,
            this.config.maxBackoffDelay || 2000,
        );
    }

    _destroy(error, callback) {
        this.logger.warn({
            message: 'GetLogGroups stream destroyed',
            errorName: error?.name,
            errorMessage: error?.message,
        });
        callback(error);
        super.destroy();
    }
}

module.exports = GetLogGroups;
