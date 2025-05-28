const { captureAWSv3Client } = require('aws-xray-sdk-core');
const { PublishCommand } = require('@aws-sdk/client-sns');
const { createSNSClientManager } = require('../../awsSdkClientManager');

const snsClientManager = createSNSClientManager();
/**
 * Publishes message to SNS topic.
 *
 * @param {Object} params - SNS message parameters
 *
 * @returns {Promise}
 */
const publishToSnsTopic = async (params) => {
    const sns = captureAWSv3Client(snsClientManager.getClient());
    return sns.send(new PublishCommand(params));
};

module.exports = {
    publishToSnsTopic,
};
