const { middyValidatorWrapper } = require('../middlewares/middyValidatorWrapper');
const Utils = require('../utility_functions/utilityFunctions');
const gdprRequestsTable = require('../database/gdprRequestsTable');
const { REQUIRED_PARAMETERS_FOR_LAMBDA } = require('../constants/lambdas');
const { GDPR_REQUEST_TYPES } = require('../constants/common');
const { RESPONSE_OK } = require('../constants/responses');

/**
 * Add new GDPR request to the GDPR requests table
 *
 * @param {Object} event - Data that we receive from request
 */

const baseAddGdprRequest = async (event) => {
    try {
        const eventParams = Utils.extractParams(event);

        if (!Utils.checkForJsonValue(GDPR_REQUEST_TYPES, eventParams.requestType)) {
            throw Utils.createResponseInvalidParameter('requestType');
        }
        const userStatus = await gdprRequestsTable.checkIsUserDeleted(Utils.createGppUserId(eventParams.userId));

        if (userStatus.deleted) {
            throw Utils.createResponseUserDeleted(eventParams.userId);
        }

        const putResult = await gdprRequestsTable.putEntry(eventParams);
        const body = Utils.parseBody(putResult);
        const response = Utils.createResponse(RESPONSE_OK, body);
        console.log('Returning success response...');
        return response;
    } catch (error) {
        console.error('ERROR: Returning error response:\n', JSON.stringify(error));
        return error;
    }
};

module.exports = {
    addGdprRequest: middyValidatorWrapper(baseAddGdprRequest, REQUIRED_PARAMETERS_FOR_LAMBDA.addGdprRequestLambda),
};
