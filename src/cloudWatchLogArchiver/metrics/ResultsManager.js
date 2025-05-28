/**
 * The ResultsManager class is responsible for managing the metrics and failed requests related to the CloudWatch Log Archiver.
 * It provides methods to update counters, get counter values, start a timer, add failed requests, and get the overall metrics.
 * The metrics tracked include the start time, number of log groups processed,
 * number of log groups with tags received, number of SQS messages sent, and number of retries.
 */
class ResultsManager {
    constructor() {
        this.failedRequests = {};
        this.metrics = {
            startTime: 0,
            logGroupsProcessed: 0,
            logGroupsTagsReceived: 0,
            sqsMessagesSent: 0,
            retries: 0,
        };
    }

    updateCounter(amount, key) {
        this.metrics[key] += amount;
        console.log(`Counter Updated. Total ${key}: ${this.metrics[key]}`);
    }

    getCounter(key) {
        return this.metrics[key];
    }

    startTimer() {
        this.metrics.startTime = Date.now();
    }

    addFailure(error, key) {
        if (!this.failedRequests[key]) {
            this.failedRequests[key] = [];
        }

        this.failedRequests[key].push(error);
    }

    addRetry() {
        this.metrics.retries++;
    }

    getMetrics() {
        const {
            startTime, logGroupsProcessed, logGroupsTagsReceived, retries,
        } = this.metrics;

        return {
            duration: `${((Date.now() - startTime) / 1000).toFixed(2)} seconds`,
            failedRequests: Object.entries(this.failedRequests).map((failure) => failure),
            failures: this.failedRequests,
            retryCount: retries,
            averageProcessingTime: `${Math.floor((Date.now() - startTime) / (logGroupsProcessed + logGroupsTagsReceived + retries))} milliseconds`,
            metics: this.metrics,
        };
    }
}

/**
 * An instance of the `ResultsManager` class,
 * which is responsible for tracking various metrics related to the processing of CloudWatch log groups.
 */
const ResultsManagerInstance = new ResultsManager();

module.exports = { ResultsManagerInstance, ResultsManager };
