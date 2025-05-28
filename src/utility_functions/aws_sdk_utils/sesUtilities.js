const { captureAWSv3Client } = require('aws-xray-sdk-core');
const { SendTemplatedEmailCommand, SendEmailCommand } = require('@aws-sdk/client-ses');
const axios = require('axios');
const { createSESClientManager } = require('../../awsSdkClientManager');
const { PATTERNS } = require('../../constants/common');

const sesClientManager = createSESClientManager();

/**
 *
 * @param {Object} params SES Params. Example: {
        Destination: {
            ToAddresses: [checkedParams.email],
        },
        Source: fromEmail,
        Template: templateConfigurationData.ses_email_template,
        TemplateData: templateData,
        ConfigurationSetName: templateConfigurationData.ses_config_sets,
    }
 * @returns {Promise}
 */
const sendTemplatedEmail = (params) => {
    const sesInstance = captureAWSv3Client(sesClientManager.getClient());
    const command = new SendTemplatedEmailCommand(params);
    return sesInstance.send(command);
};

/**
 *
 * @param {Object} event AWS Event
 * @returns {Object} authHeader: JWT Token; emailVerificationUrl: CDS email verification url
 */
const getEmailVerificationRequestParams = (event) => {
    const authHeader = event.headers?.cdsauthorization || event.headers?.Authorization || event.headers?.authorization;
    const emailVerificationUrl = event?.requestContext?.authorizer?.emailVerificationUrl || event?.customParameters?.emailVerificationUrl;
    return { authHeader, emailVerificationUrl };
};

/**
 * Retrieves the user's email address from an external service.
 *
 * @param {string} authHeader - The authorization header containing the user's authentication token.
 * @param {Object} event - The Lambda invocation event.
 * @returns {Promise<string>} - A promise that resolves with the user's email address.
 * @throws {Error} - If there is an error retrieving the email address.
 */
const getConsumerEmail = async (authHeader, emailVerificationUrl) => {
    try {
        if (!emailVerificationUrl) {
            throw new Error('Skipping email sending because the email verification URL is missing from the event context');
        }

        const { data } = await axios.get(emailVerificationUrl, {
            headers: {
                Authorization: authHeader,
            },
        });

        // Return the user's email address from the response data
        return data.email;
    } catch (err) {
        console.error('ERROR: Failed to get user email:\n', err);
        throw err;
    }
};

/**
 * Checks whether the email passed the regexp
 * @param {String} email
 * @returns {Boolean}
 */
const isValidEmail = (email) => email.match(PATTERNS.email);

/**
 * Returns an email object with information about the user
 * @param event Lambda invocation event
 * @param params that we get for post request
 * @param userIdType
 *
 * @returns {Promise} resolved with email object
 */
const setupEmail = async (event, { email, userId } = {}, userIdType) => {
    const { authHeader, emailVerificationUrl } = getEmailVerificationRequestParams(event);

    const userEmail = email
            || userIdType === 'email' && userId
            || authHeader && authHeader.startsWith('Bearer ') && await getConsumerEmail(authHeader, emailVerificationUrl);

    if (!userEmail) {
        throw new Error('Skipping email sending because no user email has been found');
    }

    if (!isValidEmail(userEmail)) {
        throw new Error('Skipping email sending because the provided user email is invalid');
    }

    return userEmail;
};

/**
 * Sends an email using AWS SES
 * @param {Object} params - Parameters for sending the email, including the sender, recipient, subject, and body.
 *
 * @returns {Promise} - Resolves with the result of the SES send operation.
 */
const sendEmail = async (params) => {
    const sesInstance = captureAWSv3Client(sesClientManager.getClient());
    const command = new SendEmailCommand(params);

    try {
        const response = await sesInstance.send(command);
        console.log('Email sent successfully. Message ID:', response.MessageId);
        return { success: true, messageId: response.MessageId };
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

module.exports = {
    sendTemplatedEmail,
    setupEmail,
    sendEmail,
};
