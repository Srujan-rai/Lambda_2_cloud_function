const { pipeline } = require('stream');
const { promisify } = require('util');

const AWSClientManager = require('../client/AWSClientManager');

const Logger = require('../metrics/Logger');

const GetLogGroups = require('../streams/GetLogGroups');
const LogGroupTagEnrichment = require('../streams/LogGroupTagEnrichment');
const ExportJobEnrichment = require('../streams/ExportJobEnrichment');
const SQSPublish = require('../streams/SQSPublish');

/**
 * @class DependenciesBuilder
 * @description A builder class that constructs and manages AWS service dependencies using the dependency injection pattern.
 * This class is responsible for creating and configuring AWS clients and stream processing components.
 *
 * @property {Object} config - Configuration object for AWS services and stream processing
 * @property {Object} config.aws - AWS-specific configuration
 * @property {number} config.aws.baseDelay - Base delay for exponential backoff (in milliseconds)
 * @property {number} config.aws.maxRetries - Maximum number of retry attempts for AWS operations
 * @property {number} config.aws.maxBackoffDelay - Maximum backoff delay between retries (in milliseconds)
 * @property {number} config.aws.batchSize - Size of batches for AWS operations
 * @property {number} config.aws.requestTimeout - Timeout for AWS requests (in milliseconds)
 * @property {number} config.highWaterMark - Stream buffer size
 * @property {number} config.maxRetries - Maximum number of retry attempts for stream operations
 * @property {number} config.batchSize - Batch size for stream processing
 * @property {number} config.pauseDurationMs - Duration to pause between operations (in milliseconds)
 * @property {string} region - AWS region for the services
 */
class DependenciesBuilder {
    constructor() {
        this.config = {
            maxBackoffDelay: 2000,
            getLogsBatchSize: 5,
            highWaterMark: 10000,
            maxRetries: 5,
            sqsMessageBatchSize: 10,
            pauseDurationMs: 100,
        };
        this.region = process.env.AWS_REGION;
        this.resources = new Set();
    }

    validateEnvironmentVariables() {
        const requiredEnvVars = [
            'AWS_REGION',
            'EXPORT_CW_LOGS_JOB_QUEUE',
        ];

        requiredEnvVars.forEach((envVar) => {
            if (!process.env[envVar]) {
                Logger.error({ message: `Missing required environment variable: ${envVar}. Current value: ${this[envVar]}` });
                throw new Error(`Missing required environment variable: ${envVar}`);
            }
        });
    }

    buildBaseDependencies() {
        console.log('Building base dependencies...');
        const AwsClientManagerInstance = new AWSClientManager(this.region);
        const sqsClient = AwsClientManagerInstance.getSQSClient();
        const cloudWatchClient = AwsClientManagerInstance.getCloudWatchClient();

        // Track clients for cleanup
        this.resources.add(sqsClient);
        this.resources.add(cloudWatchClient);

        return { sqsClient, cloudWatchClient };
    }

    buildEvaluationDependencies() {
        this.validateEnvironmentVariables();
        console.log('Building evaluation dependencies...');
        const { sqsClient, cloudWatchClient } = this.buildBaseDependencies();

        const streams = {
            getLogGroups: new GetLogGroups(cloudWatchClient, this.config, Logger),
            logGroupTagEnrichment: new LogGroupTagEnrichment(cloudWatchClient, this.config, Logger),
            exportJobEnrichment: new ExportJobEnrichment(cloudWatchClient, this.config, Logger),
            sqsPublisher: new SQSPublish(sqsClient, process.env.EXPORT_CW_LOGS_JOB_QUEUE, this.config, Logger),
            asyncPipeline: promisify(pipeline),
        };

        // Track streams for cleanup
        Object.values(streams).forEach((stream) => {
            if (stream && typeof stream.destroy === 'function') {
                this.resources.add(stream);
            }
        });

        return streams;
    }
}
module.exports = DependenciesBuilder;
