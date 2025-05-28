const {
    checkPassedParameters,
    checkForEmptyStringInParameters,
    createGppUserId,
    createErrorBody,
    createResponse,
    extractParams,
    createResponseMissingParameters,
    getExpirationTimestamp,
} = require('./utility_functions/utilityFunctions');
const { getConfiguration } = require('./utility_functions/configUtilities');
const {
    MANDATORY_PARAMS: BLOCKED_USERS_MANDATORY_PARAMS,
    putEntry: blockUser,
    deleteBlockedConsumer,
    getUserBlockingRecords,
} = require('./database/blockedUsersTable');
const { putEntry: archiveUser } = require('./database/archivedUnblockedUsersTable');
const {
    checkIsUserBlocked,
    checkIfConfigurationIdIsValid,
} = require('./utility_functions/blockedUsersUtilities');
const { getBlockingLambdaFlow } = require('./self_service/configurationUtils');
const ssConfig = require('./self_service/selfServiceConfig.json');
const { RESPONSE_NOT_FOUND, RESPONSE_OK } = require('./constants/responses');
const { ERROR_CODES: { NOT_FOUND } } = require('./constants/errCodes');

const MANDATORY_PARAMS = ['gppUserId', 'configurationId', 'enteredById', 'requestedById'];

const BLOCKED_USER_FLOWS = {
    BLOCK: 'blockUser',
    UNBLOCKED: 'unblockUser',
    LIST: 'blockUserList',
};

/**
 * Block user for specific configuration.
 *
 * @param {Object} params - JSON object representing http request body
 * @return {Promise} data for blocked user
 */
const blockedConsumer = async (params, event) => {
    checkPassedParameters(params, BLOCKED_USERS_MANDATORY_PARAMS);
    checkForEmptyStringInParameters(params);
    const blockedUserParams = { ...params };
    blockedUserParams.gppUserId = createGppUserId(blockedUserParams.userId);
    await checkIfConfigurationIdIsValid(blockedUserParams.configurationId, event);
    await checkIsUserBlocked(blockedUserParams);
    if (blockedUserParams.configurationId !== '*' && process.env.ARCHIVE_EXPIRED_CONFIG_DATA === 'true') {
        const config = await getConfiguration(blockedUserParams.configurationId, event);
        blockedUserParams.expirationTimestamp = getExpirationTimestamp(config);
    }
    return blockUser(blockedUserParams);
};

/**
 * Wrap function and if it return Promise.resolve if the User is blocked or Promise.reject
 * if the User is not blocked
 * @param {Function} fun - checkIsUserBlocked fun
 * @param params - client parameters (originally received by lambda invoke event)
 * @return {Promise}
 */
const revertPromise = async (fun, params) => {
    try {
        await fun(params);
        const errorBody = createErrorBody(NOT_FOUND, 'User is not blocked');
        const errorResponse = createResponse(RESPONSE_NOT_FOUND, errorBody);
        throw errorResponse;
    } catch (response) {
        const body = JSON.parse(response.body);

        if (body.errorCode !== 2) {
            throw response;
        }
    }
};

/**
 * Unblock user for specific configuration and archive the record in ArchivedUnblockedUsersTable.
 *
 * @param {Object} params - JSON object representing http request body
 * @return {Promise} data for unblocked user
 */
const unblockedConsumer = async (params, event) => {
    checkPassedParameters(params, MANDATORY_PARAMS);
    checkForEmptyStringInParameters(params);
    await checkIfConfigurationIdIsValid(params.configurationId, event);
    await revertPromise(checkIsUserBlocked, params);
    const blockedConsumerDeletedRecord = await deleteBlockedConsumer(params.gppUserId, params.configurationId);
    const body = JSON.parse(blockedConsumerDeletedRecord.body);
    const {
        Attributes: {
            // eslint-disable-next-line camelcase
            blocked_timestamp, entered_by_id, requested_by_id, reason, title,
        },
    } = body.Item;
    return archiveUser(params, blocked_timestamp, entered_by_id, requested_by_id, reason, title);
};

/**
 * List all records ( by configuration) in which user is blocked
 *
 * @param {Object} params - JSON object representing http request body
 * @return {Promise} data for unblocked user
 */
const listConsumer = async (params) => {
    const userId = createGppUserId(params.userId);
    const blockedRecords = await getUserBlockingRecords(userId);
    const result = { blockedConsumerData: blockedRecords };
    const httpResponse = createResponse(RESPONSE_OK, result);
    return httpResponse;
};

/**
 * This lambda is activate with a flow "consumerBlocking".
 * It expect "blockingUserParams" parameter. Depend of the parameter: "consumerBlockingFlow"
 * the function will save consumer (User) in gpp_blocked_users_table, list all records (by configuration),
 * which is blocked user or unblock user and save record in
 * gpp_archived_unblocked_user
 *
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data (which is save in gpp_blocked_users_table)
 */
const consumerBlockingLambda = async (event) => {
    const params = extractParams(event);
    try {
        if (!params.flowLabel) {
            throw createResponseMissingParameters('flowLabel');
        }
        const consumerBlockingFlow = getBlockingLambdaFlow(ssConfig, params.flowLabel);
        switch (consumerBlockingFlow) {
            case BLOCKED_USER_FLOWS.BLOCK:
                return await blockedConsumer(params, event);
            case BLOCKED_USER_FLOWS.UNBLOCKED:
                return await unblockedConsumer(params, event);
            case BLOCKED_USER_FLOWS.LIST:
                return await listConsumer(params);
            default:
                break;
        }
    } catch (err) {
        return err;
    }

    return undefined;
};

module.exports = {
    consumerBlockingLambda,
};
