/**
 * Represents an error that occurred while interacting with the AWS CloudWatch service.
 * @param {string} message - The error message.
 * @param {Error} awsError - The underlying AWS error object.
 * @property {string} name - The name of the error, set to 'CloudWatchError'.
 * @property {Error} awsError - The underlying AWS error object.
 * @property {string} correlationId - An optional correlation ID for the error.
 */
class CloudWatchError extends Error {
    constructor(message, awsError) {
        super(message);
        this.name = 'CloudWatchError';
        this.awsError = awsError;
        this.correlationId = '';
    }
}

module.exports = CloudWatchError;
