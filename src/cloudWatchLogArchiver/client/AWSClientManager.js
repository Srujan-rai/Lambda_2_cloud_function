const { createCloudWatchLogsClientManager, createSQSClientManager } = require('../../awsSdkClientManager');

/**
 * Manages AWS clients for CloudWatch Logs and SQS.
 * This class provides a singleton instance that can be used to get CloudWatch Logs and SQS clients with a shared configuration.
 */
class AWSClientManager {
    constructor(region, clientConfig = {}) {
        if (!region) throw new Error('Region is required');

        this.region = region;
        this.clientConfig = clientConfig;
    }

    static getInstance(region, clientConfig) {
        if (!AWSClientManager.instance) {
            AWSClientManager.instance = new AWSClientManager(region, clientConfig);
        }
        return AWSClientManager.instance;
    }

    getCloudWatchClient() {
        if (!this.cloudWatchClient) {
            const cloudWatchClient = createCloudWatchLogsClientManager();
            this.cloudWatchClient = cloudWatchClient.getClient(this.clientConfig);
        }
        return this.cloudWatchClient;
    }

    getSQSClient() {
        if (!this.sqsClient) {
            const sqsClient = createSQSClientManager();
            this.sqsClient = sqsClient.getClient(this.clientConfig);
        }
        return this.sqsClient;
    }
}

module.exports = AWSClientManager;
