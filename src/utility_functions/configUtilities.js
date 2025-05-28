const {
    createResponse,
    createResponseMissingParameters,
    createErrorBody,
    concatenateColumnValues,
} = require('./utilityFunctions');
const { PARAMS_MAP } = require('../constants/common');
const { getCachedConfiguration, putConfigurationIntoCache } = require('./eventUtilities');
const { getFileFromS3, createS3FileParams } = require('./aws_sdk_utils/s3Utilities');
const { RESPONSE_OK, RESPONSE_BAD_REQUEST } = require('../constants/responses');
const {
    getConfigurationParameter,
} = require('../self_service/configurationUtils');
const { ERROR_CODES } = require('../constants/errCodes');

const searchJsSdkConfiguration = async (fileName) => {
    const filePath = `sdk/configurations/${fileName}.json`;
    const fileParams = {
        readConfFileParams: {
            Bucket: process.env.PUBLIC_BUCKET,
            Key: filePath,
            ResponseContentType: 'application/json',
        },
    };

    return getFileFromS3(fileParams);
};

/**
 * Gets configuration object from cache or from S3 if it's not yet cached.
 *
 * @param {String} configurationId - id of configuration which needs to be obtained
 * @param {Object} event - Lambda event (contains cached objects)
 *
 * @returns {Promise} Requested configuration, or HTTP error response if it doesn't exist
 */
const getConfiguration = async (configurationId, event) => {
    if (!configurationId) {
        throw createResponseMissingParameters([PARAMS_MAP.CONFIGURATION_ID]);
    }

    const cachedConfig = getCachedConfiguration(event, configurationId);

    if (cachedConfig) {
        console.log('Found cached config! Returning...');
        return cachedConfig;
    }

    console.log("Configuration wasn't found in cache! Attempting to find it on S3...");
    const configuration = await createS3FileParams(configurationId, 'application/json')
        .catch((err) => { throw err; });

    console.log('Configuration obtained. Putting into cache...');
    putConfigurationIntoCache(event, configuration);
    console.log('Returning config....');
    return configuration;
};

/**
 * Checks if the configuration exists in the cache or in S3 if it's cached.
 * @param {String} configurationId - id of configuration which needs to be obtained
 * @param {Object} event - Lambda event (contains cached objects)
 * @returns {Object} Requested configuration, or HTTP error response if it doesn't exist
 */
const configurationExistsChecker = (configurationId, event) => {
    const cachedConfig = getCachedConfiguration(event, configurationId);
    if (cachedConfig) {
        console.log('Found cached config! Returning...');
        return Promise.resolve(createResponse(RESPONSE_OK, 'Configuration ID found in the cache!'));
    }
    console.log("Configuration wasn't found in cache! Attempting to find it on S3...");
    return createS3FileParams(configurationId);
};

const getDefaultUserIdType = (configuration) => {
    const userIdType = getConfigurationParameter(configuration, 'userIdType');
    if (!userIdType) {
        const errBody = createErrorBody(ERROR_CODES.CONFIGURATION_ERROR, 'UserIdType not defined in configuration!');
        const err = createResponse(RESPONSE_BAD_REQUEST, errBody);
        throw (err);
    }
    return userIdType;
};

/**
 * Determines userIdType - if not provided via params the one from configuration will be used.
 *
 * @param  {Object} params - provided params from event
 * @param {Object} configuration - configuration from S3
 *
 * @returns {Promise<any>}
 */
// TODO parameter "configuration" is currently optional.
// Refactor all invocations so that configuration is passed as well, and remove unnecessary conditions in this function
// Currently this function is not in use!
const getUserIdType = async (params, configuration) => {
    const userIdType = params[PARAMS_MAP.USER_ID_TYPE];

    if (!userIdType) {
        const config = configuration || await getConfiguration(params[PARAMS_MAP.CONFIGURATION_ID]);
        return getDefaultUserIdType(config);
    }

    return userIdType;
};

/**
 * Function that determines gpp user id based on params
 *
 * @param {Object} params - extracted params from event
 * @param {Object} configuration - configuration from S3
 *
 * @returns {Promise<any>}
 */
const setupGppUserId = (params, configuration, userMigrated) => {
    const defaultUserIdType = getDefaultUserIdType(configuration);
    const userIdType = (userMigrated && defaultUserIdType === 'uuid' && 'cds') || defaultUserIdType;

    params.gppUserId = concatenateColumnValues(params[PARAMS_MAP.USER_ID], userIdType);
};

/**
 * Attach params to the event that will be
 * needed by flow/checker lambdas
 * @param event
 * @param params
 * @param config
 */
const addParametersToEvent = (event, params, config, userMigrated) => {
    if (params[PARAMS_MAP.USER_ID]) {
        setupGppUserId(params, config, userMigrated);
        if (userMigrated) {
            params.userMigrated = userMigrated;
        }
        event.body = JSON.stringify(params);
    }
};

/**
 * Determines whether a given configuration is currently active based on its start and end timestamps.
 *
 * @param {Object} configuration - An object representing the configuration to evaluate.
 *
 * @returns {boolean} - Returns `true` if the current time is between the start and end UTC timestamps(configuration is active).
 *
 * @example
 * const configuration = {
 *     configurationParameters: {
 *         configurationStartUtc: Date.UTC(2023, 0, 1), // January 1, 2023, UTC
 *         configurationEndUtc: Date.UTC(2023, 11, 31) // December 31, 2023, UTC
 *     }
 * };
 *
 * const isActive = isConfigurationActive(configuration);
 * // Output will depend on the current date and time when the function is called.
 */
const isConfigurationActive = (configuration) => {
    const { configurationStartUtc, configurationEndUtc } = configuration.configurationParameters || {};
    const nowTimestamp = new Date().getTime();
    return configurationStartUtc < nowTimestamp && nowTimestamp < configurationEndUtc;
};

module.exports = {
    searchJsSdkConfiguration,
    configurationExistsChecker,
    getConfiguration,
    getUserIdType,
    setupGppUserId,
    addParametersToEvent,
    getDefaultUserIdType,
    isConfigurationActive,
};
