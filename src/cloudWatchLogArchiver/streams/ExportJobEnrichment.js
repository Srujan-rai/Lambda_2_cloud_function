/* eslint-disable no-underscore-dangle */
const { Transform } = require('stream');
const { FilterLogEventsCommand } = require('@aws-sdk/client-cloudwatch-logs');

const CloudWatchRateLimiter = require('../utils/CloudWatchRateLimiter');
const { calculateNextExportLogsWindow } = require('../common/helpers');
const { ResultsManagerInstance } = require('../metrics/ResultsManager');

/**
 * A Transform stream that enriches CloudWatch log groups with export job information.
 * Calculates the next export logs window for each log group and handles error reporting.
 *
 * @extends Transform
 * @param cloudWatchClient - AWS CloudWatch Logs client instance for API interactions.
 * @param {Object} config - Configuration object containing highWaterMark setting
 * @param {Object} logger - Logger instance for error and warning reporting
 * @throws {Error} When log group enrichment fails
 */
class ExportJobEnrichment extends Transform {
    constructor(cloudWatchClient, config, logger) {
        super({
            objectMode: true,
            highWaterMark: config.highWaterMark,
        });

        this.cloudWatchClient = cloudWatchClient;
        this.logger = logger;
    }

    async _transform(logGroup, _encoding, callback) {
        const correlationId = `exportJob-enrich-${Date.now()}`;
        try {
            await CloudWatchRateLimiter.throttle();
            const exportJob = await this.createExportJobForLogGroup(logGroup);
            callback(null, exportJob);
        } catch (error) {
            ResultsManagerInstance.addFailure(error, 'ExportJobEnrichment');

            this.logger.error({
                message: 'Failed to enrich log group with export job',
                correlationId,
                logGroupName: logGroup.logGroupName,
                errorName: error.name,
                errorMessage: error.message,
            });

            callback(error);
        }
    }

    async createExportJobForLogGroup(logGroup) {
        const exportJob = calculateNextExportLogsWindow(logGroup);
        const { logGroupName, exportFromDate, exportToDate } = exportJob.exportJobParams;

        const params = new FilterLogEventsCommand({
            logGroupName,
            startTime: exportFromDate,
            endTime: exportToDate,
            limit: 1,
        });

        try {
            const response = await this.cloudWatchClient.send(params);
            if (response.events && response.events.length) return exportJob;

            const updatedExportJob = {
                ...exportJob,
                exportJobParams: {
                    ...exportJob.exportJobParams,
                    skipExport: true,
                },
            };

            this.logger.warn({
                message:
                    'No logs found for requested export range. Export Job will be skipped for this date range',
                updatedExportJob: updatedExportJob.exportJobParams,
            });

            return updatedExportJob;
        } catch (error) {
            this.logger.error({ message: 'Error creating export job for log group', error });

            throw new Error(
                `${JSON.stringify({
                    error: `Error creating export job for log group: ${logGroupName}`,
                    reason: error.name,
                })}`,
            );
        }
    }

    _destroy(error, callback) {
        this.logger.warn({
            message: 'ExportJobEnrichment stream destroyed',
            errorName: error?.name,
            errorMessage: error?.message,
        });
        callback(error);
        super.destroy();
    }
}

module.exports = ExportJobEnrichment;
