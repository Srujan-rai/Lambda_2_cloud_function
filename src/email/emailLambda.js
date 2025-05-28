const {
    extractParams,
    createErrorBody,
    createResponse,
    createErrBody,
    copyAsCamelCase,
} = require('../utility_functions/utilityFunctions');
const { getConfiguration } = require('../utility_functions/configUtilities');
const { sendTemplatedEmail: sendSESEmail } = require('../utility_functions/aws_sdk_utils/sesUtilities');
const { mainQuery: mainEmailQuery } = require('../database/emailTemplatesTable');
const dataStructMailTpl = JSON.parse(JSON.stringify(require('./templates_source/data_structure_winning_mail_template.json')));
const {
    CONFIGURATION_FUNCTIONS_MAP: { sendMessage },
} = require('../constants/lambdas');
const {
    ERROR_CODES: {
        CONFIGURATION_PARAMETER_MISSING,
        FLOW_LAMBDA_REJECTION,
        DYNAMO_DB_ERROR,
        UNKNOWN_REASON,
    },
} = require('../constants/errCodes');
const { RESPONSE_INTERNAL_ERROR, RESPONSE_BAD_REQUEST, RESPONSE_OK } = require('../constants/responses');
const {
    PATTERNS: { hashedKocid },
    PARAMS_MAP: { MESSAGE_BODY },
} = require('../constants/common');
const { invokeLambda } = require('../utility_functions/aws_sdk_utils/lambdaUtilities');

/**
 * Lambda for sending email to specified email address using SES
 * and stored template
 * It can be called from AWS SQS or LambdaUtils.invokeLambda
 * @param event - data that we receive from request
 * @param context
 * @param callback - returned data
 */
const baseEmailSendLambda = async (event) => {
    let params;
    try {
        if (Array.isArray(event.Records) && event.Records.length) {
            params = extractParams(event.Records[0]);
        } else {
            params = extractParams(event);
        }
        const configData = await getConfiguration(params.configurationId, event);

        const { sendingProvider, isHashedUserId } = getProviderDetails(params);

        const emailTemplateId = checkConfigurationParameters(configData, params, isHashedUserId);
        const emailParams = await createEmailParams[sendingProvider](emailTemplateId, params);

        const data = await sendTemplatedEmail[sendingProvider](
            emailParams,
            params.envDetails,
        );
        console.log('Returning response:\n', JSON.stringify(data));
        return data;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', errorResponse);
        throw errorResponse;
    }
};

/**
 * Checks if required email parameters exist in the configuration
 * @param configData - data from promo configuration
 * @returns {string}
 */
const checkConfigurationParameters = (configData, params, isHashedUserId) => {
    console.log('Checking configuration parameters...');
    let emailTemplateId;
    if (isHashedUserId) {
        const locale = params.language || configData?.configurationParameters?.language || 'en_GB';
        emailTemplateId = configData?.configurationParameters?.ajoEmailTemplate || `EVTprize_redeem_ngps_email_${locale}`;
    } else if (params.ref_code) {
        const locale = params.language || configData?.configurationParameters?.language || 'en_GB';
        emailTemplateId = configData?.referralRewards?.emailTemplateId || `EVTreferral_rewards_promo_email_${locale}`;
    } else {
        emailTemplateId = configData?.configurationParameters?.emailTemplateId;
    }

    if (!emailTemplateId) {
        const errorBody = createErrorBody(CONFIGURATION_PARAMETER_MISSING, 'Invalid email configuration');
        const errResponse = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
        throw errResponse;
    }
    return emailTemplateId;
};

const getProviderDetails = (params) => {
    let useMessageManagement = false;

    if (params.emailProvider === 'transactional') {
        useMessageManagement = true;
    } else if (process.env.useMessageManagement === 'true') {
        useMessageManagement = params.userId && params.userId.match(hashedKocid);
    }

    return {
        sendingProvider: useMessageManagement ? 'transactional' : 'ses',
        isHashedUserId: useMessageManagement,
    };
};

/**
 * Query using primary key for EmailTemplates table. Returns JSON representing row in EmailTemplates for provided emailTemplateId.
 * If there is no match for provided emailTemplateId, rejects with error response.
 * @param emailTemplateId
 * @returns {Promise<any>}
 */
const getEmailTemplateConfigurationData = async (emailTemplateId) => {
    const result = await mainEmailQuery(emailTemplateId);
    if (result[0]) {
        return result[0];
    }
    const errorBody = createErrorBody(DYNAMO_DB_ERROR, 'No email template with such id found!');
    const errorResponse = createResponse(RESPONSE_BAD_REQUEST, errorBody);
    throw errorResponse;
};

/**
 * Create parameters for sending email based on email provider
 * @param templateConfigurationData - email params from db
 * @param params - email params for prize details and receiver
 * @returns {Promise<any>}
 */

const createEmailParams = {
    ses: async (emailTemplateId, params) => {
        const templateConfigurationData = await getEmailTemplateConfigurationData(emailTemplateId);
        console.log('Creating email params from template configuration data:\n', JSON.stringify(templateConfigurationData));
        const checkedParams = checkForExclusions(params, templateConfigurationData);
        const templateData = JSON.stringify(getMailTemplateData(checkedParams, templateConfigurationData));
        const fromEmail = templateConfigurationData.sender_name
            ? `${templateConfigurationData.sender_name} <${templateConfigurationData.sender_email}>`
            : templateConfigurationData.sender_email;
        const emailParams = {
            Destination: {
                ToAddresses: [checkedParams.email],
            },
            Source: fromEmail,
            Template: templateConfigurationData.ses_email_template,
            TemplateData: templateData,
            ConfigurationSetName: templateConfigurationData.ses_config_sets,
        };
        console.log('Email params:\n', JSON.stringify(emailParams));

        return emailParams;
    },

    transactional: (emailTemplateId, params) => {
        console.log('Creating email params for transactional api');
        const { data } = getMailTemplateData(
            params,
            { emailTemplateId },
        );

        const contextParams = getContextParams(data);

        const emailParams = {
            recipient: params.userId,
            channel: 'email',
            template: emailTemplateId,
            provider: 'ajo',
            context: contextParams,
        };
        console.log('Email params:\n', JSON.stringify(emailParams));
        return emailParams;
    },
};

/** Checks for any exclusions passed in from the templateConfigurationData and removes accordingly.
 * @param templateConfigurationData - email params from db
 * @param params - email params for prize details and receiver
 * @returns {Object<string>}
 */
const checkForExclusions = (params, templateConfigurationData) => {
    if (templateConfigurationData.exclusions) {
        const checkedParams = { ...params };

        templateConfigurationData.exclusions.forEach((key) => {
            console.log(key);
            delete checkedParams.prizeDetails[key];
        });
        return checkedParams;
    }
    return params;
};

/**
 * Prepare parameters for sending email
 * @param params
 * @param templateConfigurationData
 * @returns {string}
 */
const getMailTemplateData = (params, templateConfigurationData) => {
    // Getting TimeStamp which is a string and converting it to a human readable date
    const tpl = { ...dataStructMailTpl };

    if (params.prizeDetails.expiryDate) {
        params.prizeDetails.expiryDate = new Date(parseInt(params.prizeDetails.expiryDate));
        params.prizeDetails.expiryDate = `${params.prizeDetails.expiryDate.getDate()}/${params.prizeDetails.expiryDate.getMonth() + 1}/${params.prizeDetails.expiryDate.getFullYear()}`;
    }
    // Adding values for email template parameters
    tpl.data.subject = templateConfigurationData.subject_text || '';
    tpl.data.headerImgSrc = templateConfigurationData.header_image_path || '';
    tpl.data.introductoryText = templateConfigurationData.introductory_text || '';
    tpl.data.prizeName = params.prizeDetails ? params.prizeDetails.name : '';
    tpl.data.shortDescription = params.prizeDetails ? params.prizeDetails.short_desc : '';
    tpl.data.redeemDescription = params.prizeDetails ? params.prizeDetails.redeem_desc : '';
    tpl.data.redemptionLink = params.prizeDetails.redemption_link || '';
    tpl.data.codeText = params.prizeDetails ? params.prizeDetails.voucherCode : '';
    tpl.data.barcodeImgSrc = params.prizeDetails ? params.prizeDetails.barcodeURL : '';
    tpl.data.additionalText = templateConfigurationData.additional_text || '';
    tpl.data.signatureText = templateConfigurationData.signature_text || '';
    tpl.data.plainText = templateConfigurationData.plain_text || ''; // NOT USED FOR NOW BUT SUPPORTED BY TEMPLATE
    tpl.data.expiryDate = params.prizeDetails ? params.prizeDetails.expiryDate : '';
    tpl.data.expiryLabel = templateConfigurationData.localization_labels ? templateConfigurationData.localization_labels.expiry_label : '';
    tpl.data.prizeImgSrc = getImageUrl(params);
    tpl.data.redemptionLabel = templateConfigurationData.localization_labels ? templateConfigurationData.localization_labels.redemption_label : '';

    tpl.social = (templateConfigurationData.social_icons_and_links && templateConfigurationData.social_icons_and_links.length)
        ? copyAsCamelCase(templateConfigurationData.social_icons_and_links) : ''; // should be array of icons: [{"imgSrc": "", "btnLink": "#"}, ...]
    tpl.footer.copyrightText = templateConfigurationData.copyright_text || '';
    tpl.footer.ppLink = templateConfigurationData.privacy_policy || '';
    tpl.footer.tcLink = templateConfigurationData.terms_of_service || '';
    tpl.footer.unsubscribeLink = ''; // NOT USED FOR NOW BUT SUPPORTED BY TEMPLATE

    return tpl;
};

/** Gets image url from prize. Checks if img url is an array and if image metadata specifies priority
 * @param params - email params for prize details
 * @returns {string}
 */

const getImageUrl = (params) => {
    const { prizeDetails } = params;
    if (!prizeDetails || !prizeDetails.img_url) return '';

    if (!Array.isArray(prizeDetails.img_url)) return prizeDetails.img_url;

    const imgUrlWithPriorityOne = prizeDetails.images_metadata?.find((metaObj) => metaObj.priority === 1);
    return imgUrlWithPriorityOne?.url || prizeDetails.img_url[0] || '';
};

const getContextParams = (({
    prizeName, shortDescription, redeemDescription, redemptionLink, codeText, barcodeImgSrc, expiryDate, prizeImgSrc,
}) => ({
    prizeName, shortDescription, redeemDescription, redemptionLink, codeText, barcodeImgSrc, expiryDate, prizeImgSrc,
}));

const sendTemplatedEmail = {
    ses: async (emailParams) => {
        console.log('Sending email with params:\n', JSON.stringify(emailParams));
        try {
            await sendSESEmail(emailParams);
            const response = createResponse(RESPONSE_OK, {
                message: 'Email sent successfully',
                emailSent: true,
            });
            return response;
        } catch (err) {
            console.error('ERROR: Failed to send email:\n', JSON.stringify(err));
            const errorBody = createErrorBody(FLOW_LAMBDA_REJECTION, 'Error while sending email');
            const errResponse = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
            throw errResponse;
        }
    },
    transactional: async (emailParams, envDetails) => {
        console.log('Sending email with params:\n', JSON.stringify(emailParams));
        try {
            return invokeLambda(sendMessage, {
                body: JSON.stringify({
                    [MESSAGE_BODY]: emailParams,
                    envDetails,
                }),
            }).then(() => {
                const response = createResponse(RESPONSE_OK, {
                    message: 'sendMessage lambda was invoked!',
                });
                return response;
            }).catch((err) => {
                if (err) {
                    console.error(err);
                    // eslint-disable-next-line
                    return Promise.reject({
                        body: createErrBody(
                            UNKNOWN_REASON,
                            'Failed to push message in sendMessage lambda!',
                            { messageSent: false },
                        ),
                    });
                }
            });
        } catch (err) {
            console.error('ERROR: Failed to send email:\n', JSON.stringify(err));
            const errorBody = createErrorBody(FLOW_LAMBDA_REJECTION, err.message);
            const errResponse = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
            throw errResponse;
        }
    },
};

module.exports.emailSendLambda = baseEmailSendLambda;
