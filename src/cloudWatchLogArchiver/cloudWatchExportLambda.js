const Logger = require('./metrics/Logger');
const CloudWatchExporter = require('./utils/CloudWatchExporter');

const { sendTeamsNotification } = require('./common/sendTeamsNotification');

function extractMessageBody(event) {
    if (!event.Records?.[0]) throw new Error(`Invalid event structure - ${JSON.stringify(event)}`);

    let messageBody;
    const sqsRecord = event.Records[0];

    try {
        messageBody = JSON.parse(sqsRecord.body);
        Logger.info({
            message: 'Message Body Extracted',
            messageBody,
        });
    } catch (error) {
        throw new Error(`Failed to parse message body: ${error.message}`);
    }

    return messageBody;
}

function createResponse(message) {
    Logger.info({
        message: `[createResponse] Creating response with message: ${message}`,
    });
    return {
        statusCode: 200,
        body: JSON.stringify({ message }),
    };
}

/**
 * AWS Lambda handler that processes CloudWatch log export requests from SQS.
 * Creates an export task for CloudWatch logs and handles various error scenarios.
 *
 * Flow:
 * 1. Extracts message body from SQS event
 * 2. Initializes CloudWatchExporter with message parameters
 * 3. Creates export task for CloudWatch logs
 * 4. Handles specific error cases:
 *    - Returns 200 if no logs exist for the specified day
 *    - Sends Teams notification for other errors
 *
 * @param {Object} event - The Lambda event object containing SQS records
 * @returns {Object} Response object with status code 200 and success/error message
 * @throws {Error} If message parsing fails, export task creation fails, or Teams notification fails
 */
module.exports.handler = async (event) => {
    Logger.info({ message: '[handler] Lambda execution started', event });

    let messageBody;
    let exporter;
    try {
        messageBody = extractMessageBody(event);
        exporter = new CloudWatchExporter(messageBody);
    } catch (error) {
        Logger.error({ message: '[handler] Error encountered during setup', error });
        throw error;
    }

    try {
        await exporter.createExportTask();
        return createResponse('Export task completed successfully');
    } catch (error) {
        Logger.error({ message: '[handler] Lambda execution encountered an error', error });

        if (process.env.SEND_NOTIFICATIONS_ON_ERROR === 'true') {
            Logger.info({ message: '[handler] Sending Teams notification' });
            await sendTeamsNotification(messageBody, error).catch((notifError) => {
                Logger.error({
                    message: '[sendTeamsNotification] Error encountered while sending Teams notification',
                    error: notifError,
                });
                throw notifError;
            });
        }

        if (error.originalError.name === 'InvalidParameterException') {
            /* If the error is an ExportError with a specific type, return a 200 status code with the error message.
            This is to handle the case where the export job fails as there are no logs for a given day. */
            Logger.warn({
                message: '[handler] Handling specific error case - InvalidParameterException',
                error: error.message,
            });
            return createResponse('Export task completed with error due to no logs for the given day');
        }
        throw error;
    }
};
