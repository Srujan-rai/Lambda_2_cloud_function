/* eslint-disable no-underscore-dangle */
const { ListTagsForResourceCommand } = require('@aws-sdk/client-cloudwatch-logs');
const { Transform } = require('stream');

const { pause } = require('../common/helpers');

const { ResultsManagerInstance } = require('../metrics/ResultsManager');
const CloudWatchRateLimiter = require('../utils/CloudWatchRateLimiter');

/**
 * A Transform stream that enriches CloudWatch log groups with their associated tags.
 * Implements retry logic, circuit breaker pattern, and rate limiting for AWS API calls.
 *
 * @extends Transform
 * @param {AWS.CloudWatchLogs} cloudWatchClient - AWS CloudWatch Logs client instance
 * @param {Object} config - Configuration object
 * @param {number} [config.highWaterMark] - Stream buffer size
 * @param {number} [config.maxRetries=3] - Maximum number of retry attempts
 * @param {number} [config.retryBaseDelay=1000] - Base delay in ms between retries
 * @param {number} [config.circuitBreakerThreshold=5] - Number of failures before circuit opens
 * @param {number} [config.circuitBreakerResetTimeout=60000] - Time in ms before circuit resets
 * @param {Object} logger - Logger instance for operational monitoring
 */
class LogGroupTagEnrichment extends Transform {
    constructor(cloudWatchClient, config, logger) {
        super({
            objectMode: true,
            highWaterMark: config.highWaterMark,
        });
        this.cloudWatchClient = cloudWatchClient;
        this.logger = logger;
        this.retryConfig = {
            maxRetries: config.maxRetries || 3,
            baseDelay: config.retryBaseDelay || 1000,
        };
        this.circuitBreaker = {
            failures: 0,
            lastFailure: null,
            threshold: config.circuitBreakerThreshold || 5,
            resetTimeout: config.circuitBreakerResetTimeout || 60000,
        };

        this.correlationId = `tag-enrich-${Date.now()}`;
        this.logGroup = {};
    }

    async _transform(logGroup, _, callback) {
        if (!logGroup) {
            callback(new Error('Log group is undefined'));
            return;
        }
        this.logGroup = logGroup;

        if (this.shouldBreakCircuit()) {
            callback(new Error('Circuit breaker is open'));
            return;
        }

        try {
            const tags = await this.fetchTags();
            callback(null, { ...logGroup, tags });
        } catch (error) {
            this.handleFailure(error, callback);
        }
    }

    async fetchTags() {
        let attempt = 0;

        while (attempt < this.retryConfig.maxRetries) {
            try {
                await CloudWatchRateLimiter.throttle();
            } catch (error) {
                this.logger.error({ message: 'Error throttling CloudWatch API', error, correlationId: this.correlationId });

                if (error.name === 'ThrottlingException') {
                    attempt++;
                    // eslint-disable-next-line no-continue
                    continue;
                }

                this.circuitBreaker.failures = this.circuitBreaker.threshold;
                this.circuitBreaker.lastFailure = new Date();
                break;
            }

            try {
                const response = await this.cloudWatchClient.send(this.listTagsCommand());
                if (Object.keys(response?.tags).length === 0) return {};

                return Object.entries(response.tags).reduce((acc, [key, value]) => {
                    if (!key.includes('aws:')) return { ...acc, [key]: value };

                    return acc;
                },
                {});
            } catch (error) {
                this.logger.error({
                    message: 'Error fetching tags',
                    error,
                    retriesRemaining: this.retryConfig.maxRetries - attempt,
                    correlationId: this.correlationId,
                    logGroup: this.logGroup,
                });

                if (error.name !== 'ThrottlingException') throw error;

                await pause(this.retryConfig.baseDelay * 2 ** attempt);
                attempt++;
            }
        }
        throw new Error('Max retries exceeded');
    }

    listTagsCommand() {
        return new ListTagsForResourceCommand({
            resourceArn: this.logGroup.logGroupArn,
        });
    }

    shouldBreakCircuit() {
        if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
            console.log('Circuit breaker is open due to failures');

            const timeElapsed = Date.now() - this.circuitBreaker.lastFailure;
            return timeElapsed < this.circuitBreaker.resetTimeout;
        }
        return false;
    }

    handleFailure(error, callback) {
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailure = Date.now();

        ResultsManagerInstance.addFailure(error, 'LogGroupTagEnrichment');
        this.logger.error({
            message: 'Failed to retrieve tags',
            correlationId: this.correlationId,
            logGroup: this.logGroup,
            errorName: error.name,
            errorMessage: error.message,
        });

        callback(error);
    }

    logSuccess(filteredTags) {
        ResultsManagerInstance.updateCounter(1, 'logGroupsTagsReceived');

        this.logger.info({
            message: 'Tags retrieved successfully',
            correlationId: this.correlationId,
            logGroup: this.logGroup,
            tags: filteredTags,
        });
        this.circuitBreaker.failures = 0;
    }

    _destroy(error, callback) {
        this.circuitBreaker.failures = 0;
        this.cloudWatchClient = null;
        callback(error);
        super.destroy();
    }
}

module.exports = LogGroupTagEnrichment;
