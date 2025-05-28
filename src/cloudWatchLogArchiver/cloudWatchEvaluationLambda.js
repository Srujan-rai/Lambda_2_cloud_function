const DependenciesBuilder = require('./utils/DependenciesBuilder');
const Logger = require('./metrics/Logger');
const { ResultsManagerInstance } = require('./metrics/ResultsManager');

/**
 * AWS Lambda handler that orchestrates the CloudWatch log archival evaluation pipeline.
 * Executes a sequence of operations including fetching log groups, enriching with tags,
 * evaluating export jobs, and publishing results to SQS. Tracks execution metrics and
 * handles errors appropriately.
 *
 * @async
 * @returns {Promise<Object>} Response object containing execution status and metrics
 * @throws {Error} Rethrows any errors encountered during pipeline execution
 */
module.exports.handler = async () => {
    const dependenciesBuilder = new DependenciesBuilder();
    const dependencies = dependenciesBuilder.buildEvaluationDependencies();

    try {
        const {
            getLogGroups,
            logGroupTagEnrichment,
            exportJobEnrichment,
            sqsPublisher,
            asyncPipeline,
        } = dependencies;

        // Start the timer
        ResultsManagerInstance.startTimer();

        // Run the pipeline
        await asyncPipeline(
            getLogGroups,
            logGroupTagEnrichment,
            exportJobEnrichment,
            sqsPublisher,
        );

        const response = {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Pipeline execution completed',
                metrics: ResultsManagerInstance.getMetrics(),
            }),
        };

        Logger.info(response);
        return response;
    } catch (error) {
        Logger.error({
            message: 'Error Caught In Handler',
            actualError: error,
            metrics: ResultsManagerInstance.getMetrics(),
        });

        throw error;
    }
};
