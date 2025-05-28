const uniqid = require('uniqid');
const DBUtils = require('./dbUtilities');
const { copyAsSnakeCase } = require('../utility_functions/utilityFunctions');
const { PARAMS_MAP: { TEMPLATE_ID } } = require('../constants/common');

const { GPP_EMAIL_TEMPLATES_TABLE } = require('../constants/tableNames');

module.exports.MANDATORY_PUT_PARAMS = {
    country: 'country',
    subjectText: 'subject_text',
    senderEmail: 'sender_email',
    sesConfigSets: 'ses_config_sets',
    sesEmailTemplate: 'ses_email_template',
};

module.exports.ALLOWED_UPDATE_PARAMS = {
    templateName: 'template_name',
    country: 'country',
    senderName: 'sender_name',
    subjectText: 'subject_text',
    headerImagePath: 'header_image_path',
    introductoryText: 'introductory_text',
    additionalText: 'additional_text',
    signatureText: 'signature_text',
    socialIconsAndLinks: 'social_icons_and_links',
    copyrightText: 'copyright_text',
    privacyPolicy: 'privacy_policy',
    termsOfService: 'terms_of_service',
    senderEmail: 'sender_email',
    sesConfigSets: 'ses_config_sets',
    sesEmailTemplate: 'ses_email_template',
    localizationLabels: 'localization_labels',
};

/**
 * Insert new entry to email templates table
 * @param params - received insert params
 * @returns {*} Promise of Error or Success insert
 */
module.exports.putEntry = async (params) => {
    console.log('Received email template insert params:\n', JSON.stringify(params));
    DBUtils.checkMandatoryParams(params, this.MANDATORY_PUT_PARAMS);
    const insertParams = generateInsertParams(params);
    return DBUtils.putItem(insertParams);
};

/**
 * Return json object with generated insert params
 * @param params - received insert params
 */
const generateInsertParams = (params) => ({
    TableName: GPP_EMAIL_TEMPLATES_TABLE,
    Item: {
        template_id: uniqid(),
        template_name: params.templateName,
        country: params.country,
        sender_name: params.senderName,
        subject_text: params.subjectText,
        header_image_path: params.headerImagePath,
        introductory_text: params.introductoryText,
        additional_text: params.additionalText,
        signature_text: params.signatureText,
        social_icons_and_links: params.socialIconsAndLinks,
        copyright_text: params.copyrightText,
        privacy_policy: params.privacyPolicy,
        terms_of_service: params.termsOfService,
        sender_email: params.senderEmail,
        ses_config_sets: params.sesConfigSets,
        ses_email_template: params.sesEmailTemplate,
        localization_labels: copyAsSnakeCase(params.localizationLabels),
        expiry_label: params.expiryLabel,
    },
});

/**
 * Query Email Templates table
 * @param expression - parametrized condition for query
 * @param expressionValues - values for expression
 * @param index - optional and specified if using secondary index (global | local)
 */
const query = (expression, expressionValues, index) => {
    const queryParams = {
        TableName: GPP_EMAIL_TEMPLATES_TABLE,
        KeyConditionExpression: expression,
        ExpressionAttributeValues: expressionValues,
    };
    if (index) {
        queryParams.IndexName = index;
    }
    return DBUtils.query(queryParams);
};

/**
 * Main table query by template_id
 * @param templateId - uuid
 */
module.exports.mainQuery = (templateId) => {
    const expression = 'template_id = :template_id';
    const expressionValues = {
        ':template_id': templateId,
    };
    return query(expression, expressionValues);
};

/**
 * Function for updating email template item with new values provided via params.
 * Only columns that are allowed to be updated will be affected.
 * @param params - json object for updating existing email template item - templateName: "new template", introductoryText: "example text"
 */
module.exports.updateEntry = (params) => {
    const keyUpdateParams = { template_id: TEMPLATE_ID };
    const keyTableParams = ['template_id'];
    const updateParams = DBUtils.filterUpdateParams(params, this.ALLOWED_UPDATE_PARAMS, keyUpdateParams);
    const tableParams = DBUtils.generateUpdateTableParams(updateParams, GPP_EMAIL_TEMPLATES_TABLE, keyTableParams);

    return DBUtils.update(tableParams);
};

/**
 * Returns all email templates with scan.
 */
module.exports.scanAllEmailTemplates = () => {
    const scanParams = {
        TableName: GPP_EMAIL_TEMPLATES_TABLE,
    };

    return DBUtils.scan(scanParams);
};
