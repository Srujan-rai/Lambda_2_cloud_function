/**
 * Creates an object representing the email parameters required for sending an email.
 * This includes sender details, recipient addresses, subject, and body content.
 *
 * @param {Object} params - The params details to configure.
 * @returns {Object} - The formatted email parameters object.
 */
const createEmailParams = (params) => {
    try {
        const emailParams = {
            Source: params.sender_email,
            Destination: {
                ToAddresses: params.toRecipient,
            },
            Message: {
                Subject: {
                    Data: params.subject_text,
                    Charset: 'UTF-8',
                },
                Body: {
                    Html: {
                        Data: params.introductory_text,
                        Charset: 'UTF-8',
                    },
                },
            },
        };

        return emailParams;
    } catch (error) {
        console.log('error encountered in createEmailParams', error);
        throw error;
    }
};

/**
 * Replaces placeholder keys in a specific column of an email
 * template with corresponding values from a dynamicValues object.
 * @param {Object} dynamicValues - An object containing key-value pairs for dynamic replacement.
 * @param {Object} emailTemplate - The email template object containing columns with placeholder values.
 * @param {string} column - The specific column in the emailTemplate to apply the dynamic value replacement.
 * @returns {string} The updated content of the specified column after placeholder replacement.
 */
const assignDynamicValues = (dynamicValues, emailTemplate, column) => {
    try {
        emailTemplate[column] = emailTemplate[column].replace(
            /{{(\w+)}}/g,
            (match, key) => dynamicValues[key] || match,
        );

        return emailTemplate[column];
    } catch (error) {
        console.log('error encountered in assignDynamicValues', error);
        throw error;
    }
};

module.exports = {
    createEmailParams,
    assignDynamicValues,
};
