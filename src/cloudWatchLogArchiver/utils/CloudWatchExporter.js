/* eslint-disable class-methods-use-this */
const { CreateExportTaskCommand, TagResourceCommand, DescribeExportTasksCommand } = require('@aws-sdk/client-cloudwatch-logs');

const DependenciesBuilder = require('./DependenciesBuilder');
const RequestQueue = require('./RequestQueue');
const CircuitBreaker = require('./CircuitBreaker');

const Logger = require('../metrics/Logger');
const ExportError = require('../common/ExportError');

class CloudWatchExporter {
    constructor(messageBody) {
        this.validateEnvironmentVariables();
        const builder = new DependenciesBuilder();
        const { cloudWatchClient, sqsClient } = builder.buildBaseDependencies();

        this.cloudWatchClient = cloudWatchClient;
        this.sqsClient = sqsClient;
        this.logGroupName = '';
        this.exportFromDate = '';
        this.exportToDate = '';
        this.logGroupToExport = messageBody;

        this.requestQueue = new RequestQueue(2);
        this.circuitBreaker = new CircuitBreaker();
    }

    async executeCloudWatchRequest(operation) {
        return this.requestQueue.add(async () => this.circuitBreaker.execute(async () => {
            const jitter = Math.random() * 500;
            await this.sleep(jitter);
            return operation();
        }));
    }

    async checkForRunningTasks() {
        const MAX_RETRIES = 15;
        const BASE_DELAY_MS = 100;

        const taskCompleted = await this.waitForTaskCompletion(MAX_RETRIES, BASE_DELAY_MS);
        if (!taskCompleted) {
            throw new Error(
                `Maximum retries (${MAX_RETRIES}) reached while checking running export tasks. Export Job ${this.logGroupName} will be sent back to SQS and retired.`,
            );
        }
    }

    async createExportTask() {
        try {
            this.extractExportParams();
            if (this.skipExport) return this.handleSkipExport();

            const exportResult = await this.executeCloudWatchRequest(() => this.executeExportTask());
            return this.updateExportTaskStatusTags(exportResult);
        } catch (error) {
            Logger.error({ message: '[CloudWatchExporter.createExportTask] Error creating export task' });
            console.error(error);

            throw await this.handleError(error);
        }
    }

    async handleSkipExport() {
        Logger.info({
            message: `Export job for ${this.logGroupName} has been skipped.`,
            logGroupParams: this.logGroupToExport,
        });

        return this.updateLogGroupTags({
            status: 'skipped',
            message: 'No logs to export for this date range',
        });
    }

    async executeExportTask() {
        // Check for running tasks
        await this.checkForRunningTasks();

        // Create export task
        const exportResult = await this.cloudWatchClient.send(this.createExportTaskCommand());

        // Check for running tasks again
        await this.checkForRunningTasks();

        Logger.info({ message: '[CloudWatchExporter.executeExportTask] Export task created successfully', exportResult });
        return exportResult;
    }

    async waitForTaskCompletion(maxRetries, baseDelay) {
        for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
            Logger.info({ message: `[CloudWatchExporter.waitForTaskCompletion] Checking export task completion - attempt ${retryCount + 1} of ${maxRetries}` });
            try {
                const runningTask = await this.executeCloudWatchRequest(() => this.checkRunningExportTasks());
                if (!runningTask.exportTasks.length) return true;
            } catch (error) {
                Logger.error({
                    message: `[CloudWatchExporter.waitForTaskCompletion] Failed to check running export tasks on attempt ${retryCount + 1}`,
                    error,
                });
            }

            const delay = Math.min(baseDelay * 2 ** retryCount, 60000); // Exponential backoff up to 60 seconds
            Logger.info({ message: `[CloudWatchExporter.waitForTaskCompletion] Waiting ${delay / 1000}s before next attempt` });
            await this.sleep(delay);
        }
        Logger.warn({ message: `[CloudWatchExporter.waitForTaskCompletion] Task completion check failed after ${maxRetries} attempts` });
        return false;
    }

    async checkRunningExportTasks() {
        const command = new DescribeExportTasksCommand({ statusCode: 'RUNNING' });
        return this.cloudWatchClient.send(command);
    }

    async updateExportTaskStatusTags(exportResult) {
        return this.updateLogGroupTags({
            status: 'success',
            message: `Export task completed with taskID: ${exportResult.taskId}`,
        });
    }

    async updateLogGroupTags({ status, message }) {
        const { logGroupToExport } = this;
        if (!logGroupToExport.logGroupArn) throw new Error('Invalid logGroupToExport: missing logGroupArn');

        const input = {
            resourceArn: logGroupToExport.logGroupArn,
            tags: {
                ...logGroupToExport.tags,
                ...this.createTagsForUpdating({ status, message }),
            },
        };

        try {
            await this.cloudWatchClient.send(new TagResourceCommand(input));
            Logger.info({ message: '[CloudWatchExporter.updateLogGroupTags] Log group tags updated successfully', input });
        } catch (error) {
            Logger.error({
                message: '[CloudWatchExporter.updateLogGroupTags] Failed to update log group tags',
                error,
            });
            throw error;
        }
    }

    async handleError(error) {
        const { logGroupToExport } = this;

        if (error.name !== 'InvalidParameterException') {
            throw new ExportError(`Critical error during log export: ${error.message}`, 'critical', logGroupToExport, error);
        }

        await this.updateLogGroupTags({ status: 'failed', message: error.name });
        throw new ExportError('Warning: Export task failed due to invalid params passed', 'warning', logGroupToExport, error);
    }

    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    validateEnvironmentVariables() {
        const requiredEnvVars = ['AWS_REGION', 'LOG_EXPORT_BUCKET'];

        if (process.env.SEND_NOTIFICATIONS_ON_ERROR === 'true') {
            requiredEnvVars.push('TEAMS_WEBHOOK_URL');
        }

        requiredEnvVars.forEach((envVar) => {
            if (!process.env[envVar]) {
                throw new Error(`Missing required environment variable: ${envVar}`);
            }
        });
        Logger.info({ message: '[CloudWatchExporter.validateEnvironmentVariables] Environment variables validated successfully' });
    }

    createExportTaskCommand() {
        const trimmedLogGroupName = this.logGroupName.replace('/', '');
        const formattedFrom = new Intl.DateTimeFormat('en-GB').format(this.exportFromDate);
        const formattedTo = new Intl.DateTimeFormat('en-GB').format(this.exportToDate);
        const range = `${formattedFrom} -> ${formattedTo}`.replaceAll('/', '-');

        const exportTaskInput = {
            logGroupName: this.logGroupName,
            from: this.exportFromDate,
            to: this.exportToDate,
            destination: process.env.LOG_EXPORT_BUCKET,
            taskName: `${trimmedLogGroupName}-${Date.now()}-export`,
            destinationPrefix: `${trimmedLogGroupName}/${range}`,
        };

        return new CreateExportTaskCommand(exportTaskInput);
    }

    extractExportParams() {
        const { logGroupToExport } = this;
        if (!logGroupToExport?.exportJobParams) {
            throw new Error('Invalid logGroupToExport: missing exportJobParams');
        }

        const {
            logGroupName, exportFromDate, exportToDate, skipExport,
        } = logGroupToExport.exportJobParams;
        if (!logGroupName || !exportFromDate || !exportToDate) {
            throw new Error('Missing required export parameters');
        }

        if (exportFromDate >= exportToDate) {
            throw new Error('Invalid date range: exportFromDate must be before exportToDate');
        }

        this.logGroupName = logGroupName;
        this.exportFromDate = exportFromDate;
        this.exportToDate = exportToDate;
        this.skipExport = skipExport;
    }

    createTagsForUpdating({ status, message }) {
        return {
            LastRunStatus: status,
            LastRunStatusReason: message,
            LastUpdateTimestamp: new Date().toISOString(),
            PreviousExportFromDate: this.exportFromDate.toString(),
            PreviousExportToDate: this.exportToDate.toString(),
        };
    }
}
module.exports = CloudWatchExporter;
