const moment = require('moment');
const { getPromotionByDateAndNotArchived } = require('../../database/promotionsTable');
const { RESPONSE_INTERNAL_ERROR, RESPONSE_OK } = require('../../constants/responses');
const {
    createResponse,
} = require('../../utility_functions/utilityFunctions');
const { getMetadata } = require('../emailTemplateUtilities');
const { sendEmail } = require('../../utility_functions/aws_sdk_utils/sesUtilities');
const { createEmailParams, assignDynamicValues } = require('../emailService');

/**
 * Service layer for processing the notification
 */
const processNotifForCampaign = async () => {
    try {
        const momentDate = moment();
        const eightDaysLaterTimestamp = momentDate.add(8, 'days').toDate().getTime();
        const result = await getPromotionByDateAndNotArchived(eightDaysLaterTimestamp);

        const filteredData = filterPromotions(result);
        if (filteredData.length > 0) {
            const emailTemplate = await getMetadata('templateForCampaignEndNotification');

            if (typeof emailTemplate !== 'undefined') {
                await Promise.all(
                    Object.keys(filteredData).map(async (key) => {
                        const newTemplate = JSON.parse(JSON.stringify(emailTemplate));
                        return processSending(filteredData[key], newTemplate);
                    }),
                );
                const response = createResponse(RESPONSE_OK, {
                    message: `Campaign End Date Notification Completed. Number of records notified: ${filteredData.length}`,
                });
                return response;
            }

            const response = createResponse(RESPONSE_OK, {
                message: 'No email template exist in the dynamodb.',
            });
            return response;
        }

        const response = createResponse(RESPONSE_OK, {
            message: 'Campaign End Date Notification Completed with no records to process.',
        });
        return response;
    } catch (error) {
        console.log('Error in processNotifForCampaign', error);
        const errResponse = createResponse(RESPONSE_INTERNAL_ERROR, 'Error in processNotifForCampaign');
        throw errResponse;
    }
};

/**
 * Processes and prepares an email for sending by populating the email template with dynamic values
 * and setting the recipient details based on the filtered data.
 *
 * @param {Object} filteredData - The filtered data containing information to configure the email.
 * @param {Object} emailTemplate - The email template object to be updated with recipient and dynamic values.
 */
async function processSending(filteredData, emailTemplate) {
    try {
        const recipientValue = [];

        if (!filteredData.promotion_owner || !emailTemplate.sender_email) {
            console.error('promotion_owner/sender email is empty or null.');
            return;
        }

        recipientValue.push(filteredData.promotion_owner);
        emailTemplate.toRecipient = recipientValue;

        const dynamicValues = {
            dateNotification: filteredData.reminder === '7' ? '7 days' : '1 day',
            dateNotifbody: filteredData.reminder === '7' ? 'in 7 days' : 'tomorrow',
            promoOwner: filteredData.promotion_owner,
            campaignName: filteredData.promotion_name,
        };

        emailTemplate.subject_text = assignDynamicValues(dynamicValues, emailTemplate, 'subject_text');
        emailTemplate.introductory_text = assignDynamicValues(dynamicValues, emailTemplate, 'introductory_text');

        const emailParams = await createEmailParams(emailTemplate);
        const result = await sendEmail(emailParams);
        if (result.success) {
            console.log('Email sent successfully:', filteredData.promotion_owner);
        }
    } catch (error) {
        console.log('Error sending email for ', filteredData.promotion_owner);
        throw error;
    }
}

/**
 * Calculates a future date by adding a specified number of days to the current date.
 *
 * @param {number} days - The number of days to add to the current date.
 * @returns {Object} A Moment.js date object representing the future date.
 */
function getFutureDate(days) {
    return moment().clone().add(days, 'days').startOf('day');
}

/**
 * Function to filter promotions based on their end date.
 * It checks if the `promotion_end_utc` is 7 days or today's date.
 * @param {Array} data - Array of promotion objects.
 * @returns {Array} - Filtered array of promotions.
 */
function filterPromotions(data) {
    try {
        const sevenDaysAfter = getFutureDate(7);
        const oneDayAfter = getFutureDate(1);

        return data.filter((entry) => {
            if (!entry.promotion_end_utc) {
                console.warn(`Missing promotion_end_utc for entry: ${JSON.stringify(entry)}`);
                return false;
            }

            const promotionEndDate = moment(entry.promotion_end_utc);

            if (!promotionEndDate.isValid()) {
                console.warn(`Invalid promotion_end_utc value for entry: ${JSON.stringify(entry)}`);
                return false;
            }

            const isSevenDaysAfter = promotionEndDate.isSame(sevenDaysAfter, 'day');
            const isOneDayAfter = promotionEndDate.isSame(oneDayAfter, 'day');

            if (isSevenDaysAfter) {
                entry.reminder = '7';
                return { ...entry };
            } if (isOneDayAfter) {
                entry.reminder = '1';
                return { ...entry };
            }

            return false;
        });
    } catch (error) {
        console.log('error encountered in filterPromotions', error);
        throw error;
    }
}

module.exports = {
    processNotifForCampaign,
};
