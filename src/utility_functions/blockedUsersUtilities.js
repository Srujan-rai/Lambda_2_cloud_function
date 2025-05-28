const Messages = require('@the-coca-cola-company/ngps-global-common-messages');
const { getConfiguration } = require('./configUtilities');
const { getUserBlockingRecords } = require('../database/blockedUsersTable');
const { createErrBody, createResponse } = require('./utilityFunctions');
const { ERR_CODES: { PARTICIPANT_IS_BLOCKED }, ERROR_CODES: { FLOW_LAMBDA_REJECTION } } = require('../constants/errCodes');
const { RESPONSE_FORBIDDEN } = require('../constants/responses');

/**
 * Extract single object from DB response
 * @param params - client parameters (originally received by lambda invoke event)
 */
const checkIsUserBlocked = async (params) => {
    const { gppUserId, configurationId } = params;

    if (!gppUserId) {
        return Promise.resolve();
    }

    try {
        const queryResult = await getUserBlockingRecords(gppUserId);
        if (queryResult.length) { // user is blocked
            // If we have record blocking the user for all configurations
            // we should use it otherwise we should use the record blocking the user for specific configId
            const blockedForAllConfigs = queryResult.find((record) => record.configuration_id === '*');
            const blockRecord = blockedForAllConfigs || queryResult.find((record) => record.configuration_id === configurationId);
            if (blockRecord) {
                const errorBody = createErrBody(PARTICIPANT_IS_BLOCKED,
                    Messages.COMMON_ERR.BLOCKED, {
                        blockTitle: blockRecord.title || '',
                        blockReason: blockRecord.reason || '',
                    }, FLOW_LAMBDA_REJECTION);
                const errorResponse = createResponse(RESPONSE_FORBIDDEN, errorBody);
                return Promise.reject(errorResponse);
            }
            return Promise.resolve(); // if no blockRecord
        }
        return Promise.resolve();
    } catch (err) {
        return Promise.reject(err);
    }
};

/**
 * Check if the user is blocked for all configuration ID ("*") or for one valid configuration ID
 * @param configurationId
 * return Promis with configuration or just resolve the promis
 */
const checkIfConfigurationIdIsValid = (configurationId, event) => {
    if (configurationId === '*') {
        return Promise.resolve();
    }
    return getConfiguration(configurationId, event);
};

module.exports = {
    checkIsUserBlocked,
    checkIfConfigurationIdIsValid,
};
