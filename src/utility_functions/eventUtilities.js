const { cloneDeep } = require('lodash');
const { getConfigurationId } = require('../self_service/configurationUtils');

const CUSTOM_EVENT_PARAMS = {
    CACHED_CONFIGURATIONS: 'cachedConfigurations',
    CACHED_BURN_DATA: 'cachedBurnData',
    CACHED_ALLOCATION_DATA: 'cachedAllocationData',
    CACHED_VALID_PINCODE_DATA: 'cachedValidPinCodeData',
    EMAIL_VERIFICATION_URL: 'emailVerificationUrl',
    ENV_DETAILS: 'envDetails',
};

/**
 * Adds key - value pair to the event object, under attribute 'customParameters'
 *
 * @param {Object} event - Lambda event
 * @param {String} key - Attribute name
 * @param {*} value
 *
 * @returns {Object} updated {@param event}
 */
const putCustomEventParameter = (event, key, value) => {
    if (!event) {
        return undefined;
    }
    if (!event.customParameters) {
        event.customParameters = {};
    }
    event.customParameters[key] = value;
    return event;
};

/**
 * Gets cached value for specified key from the event object, (under attribute 'customParameters')
 *
 * @param {Object} event - Lambda event
 * @param {String} key - Attribute name
 *
 * @returns {*} value
 */
const getCustomEventParameter = (event, key) => {
    if (!event || !event.customParameters) {
        return undefined;
    }
    return event.customParameters[key];
};

/**
 * Adds data with specified key into the event object, (under attribute 'customParameters')
 *
 * @param {Array} data - array passed to be added to the event object and extract out the needed values
 * @param {Object} event - Lambda event
 *
 * @returns {Object} modified event
 */
const putDataIntoEvent = (key, data, requestId, event) => {
    event.customParameters[key] = {};
    event.customParameters[key][requestId] = [...data];
    return event;
};

/**
 * Stores configuration in event object.
 *
 * @param {Object} event - Lambda event
 * @param {Object} configuration - Configuration that needs to be cached
 *
 * @returns {Object} configuration - {@param configuration}
 */
const putConfigurationIntoCache = (event, configuration) => {
    let cachedConfigs = getCustomEventParameter(event, CUSTOM_EVENT_PARAMS.CACHED_CONFIGURATIONS);
    if (!cachedConfigs) {
        cachedConfigs = {};
    }

    const configurationId = getConfigurationId(configuration);
    if (!configurationId) {
        return configuration;
    }
    cachedConfigs[configurationId] = { ...configuration };
    putCustomEventParameter(event, CUSTOM_EVENT_PARAMS.CACHED_CONFIGURATIONS, cachedConfigs);
    return configuration;
};

/**
 * Gets cached configuration from {@param event}.
 *
 * @param {Object} event - Lambda event
 * @param {String} configurationId - Identifier of configuration that needs to be returned
 *
 * @returns {Object|undefined} cached configuration
 */
const getCachedConfiguration = (event, configurationId) => {
    const cachedConfigs = getCustomEventParameter(event, CUSTOM_EVENT_PARAMS.CACHED_CONFIGURATIONS);
    if (cachedConfigs) {
        return cachedConfigs[configurationId];
    }
    return undefined;
};

/**
 * Adds data with specified key into the event object, (under attribute 'customParameters')
 *
 * @param {Object} event - Lambda event
 * @param {String} requestId - Request Id for the invocation
 * @param {String} key - Attribute name
 *
 * @returns {*} event || undefined
 */
const getEventData = (event, requestId, key) => event.customParameters[key][requestId];

/**
 * Function to determine whether certain data should be added to event.customParams
 *
 * @param {Object} responseData - Object with responses passed from Arbiter
 * @param {*} event - Lambda event
 */
const addResponseToEventIfNeeded = (responseData, event) => {
    if (responseData.burnResult && !event.customParameters[CUSTOM_EVENT_PARAMS.CACHED_BURN_DATA]) {
        return putDataIntoEvent(
            CUSTOM_EVENT_PARAMS.CACHED_BURN_DATA,
            responseData.burnResult,
            event.requestContext.requestId,
            event,
        );
    }
    if (responseData.allocationArray && !event.customParameters[CUSTOM_EVENT_PARAMS.CACHED_ALLOCATION_DATA]) {
        return putDataIntoEvent(
            CUSTOM_EVENT_PARAMS.CACHED_ALLOCATION_DATA,
            responseData.allocationArray,
            event.requestContext.requestId,
            event,
        );
    }
    if (responseData.validationResult && !event.customParameters[CUSTOM_EVENT_PARAMS.CACHED_VALID_PINCODE_DATA]) {
        const validationRes = cloneDeep(responseData.validationResult);
        const response = putDataIntoEvent(
            CUSTOM_EVENT_PARAMS.CACHED_VALID_PINCODE_DATA,
            validationRes,
            event.requestContext.requestId,
            event,
        );
        responseData.validationResult.forEach((obj) => {
            delete obj.getParams;
        });

        return response;
    }
    return event;
};

module.exports = {
    CUSTOM_EVENT_PARAMS,
    putConfigurationIntoCache,
    getCachedConfiguration,
    putDataIntoEvent,
    getEventData,
    addResponseToEventIfNeeded,
    putCustomEventParameter,
};
