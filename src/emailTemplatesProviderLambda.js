const EmailTemplatesTable = require('./database/emailTemplatesTable');
const Utils = require('./utility_functions/utilityFunctions');
const { RESPONSE_OK } = require('./constants/responses');
/**
 * Lambda for retrieving all email templates from email templates table.
 */
const emailTemplatesProviderLambda = async () => {
    try {
        const allEmailTemplatesData = await EmailTemplatesTable.scanAllEmailTemplates();
        const response = Utils.createResponse(RESPONSE_OK, { allEmailTemplates: allEmailTemplatesData });
        console.log('Returning success response...');
        return response;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', errorResponse);
        return errorResponse;
    }
};

module.exports = {
    emailTemplatesProviderLambda,
};
