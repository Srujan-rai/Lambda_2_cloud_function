const { processNotifForCampaign } = require('./campaignService');
const { RESPONSE_OK } = require('../../constants/responses');
const { createResponse } = require('../../utility_functions/utilityFunctions');

const EVENT_SOURCE_SCHEDULER = 'eventbridge.scheduler';
const MODULE_CAMPAIGN_END_DATE_NOTIF = 'campaignEndDateNotif';

/**
 * Lambda for sending notifications.
 * @param {Object} event - Data received from the request.
 * @param {Object} context - AWS Lambda context object (optional).
 * @returns {Object} Response object with appropriate status and message.
 */
module.exports.notifProcessorHandler = async (event) => {
    console.log('Received event:', JSON.stringify(event));

    try {
        if (event.source === EVENT_SOURCE_SCHEDULER && event.module === MODULE_CAMPAIGN_END_DATE_NOTIF) {
            console.log('Processing notification for campaign end date...');
            return await processNotifForCampaign();
        }

        const response = createResponse(RESPONSE_OK, {
            message: 'Unknown event source or module. Unable to process event.',
        });
        return response;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', errorResponse);
        throw errorResponse;
    }
};
