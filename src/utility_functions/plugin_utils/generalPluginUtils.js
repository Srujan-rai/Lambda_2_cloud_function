const axios = require('axios');
const uniqid = require('uniqid');
const { getAuthHeaders } = require('../../middlewares/authHandlers');
const { rsProcessingResponse } = require('./rsUtils');

const pluginHandlersExtRequest = {
    RS: async (responseStatus, responseData, event, externalId) => {
        await rsProcessingResponse(responseStatus, responseData, event, externalId);
    },
};

/**
 * Resolves a nested path in an object.
 * @param {Object} object - The object to resolve the path in.
 * @param {string} path - The dot-separated path to resolve.
 * @returns {*} - The resolved value or undefined if the path does not exist.
 */
const resolvePath = (object, path) => path
    .split('.')
    .reduce((acc, key) => (acc ? acc[key] : undefined), object);

/**
 * Extracts request data based on the selected plugin route and input event.
 * @param {Object} selectedPluginRoute - The plugin route configuration.
 * @param {Object} inputEvent - The input event.
 * @returns {Object} - The extracted request data.
 */
const getRequestData = (selectedPluginRoute, inputEvent) => {
    const data = {};
    const extParams = selectedPluginRoute?.externalReqParams || {};
    Object.keys(extParams).forEach((requiredParamKey) => {
        if (Object.hasOwn(extParams[requiredParamKey], 'valueReference')) {
            data[requiredParamKey] = resolvePath(inputEvent, extParams[requiredParamKey].valueReference);
        } else {
            data[requiredParamKey] = extParams[requiredParamKey];
        }
    });
    return data;
};

/**
 * Makes an external request based on the selected plugin route and event.
 * @param {Object} selectedPluginRoute - The plugin route configuration.
 * @param {Object} event - The input event.
 * @returns {Promise<Object>} - The response data from the external request.
 */
const externalRequest = async (selectedPluginRoute, event) => {
    const {
        method, fetchUrl, pluginId, auth, region,
    } = selectedPluginRoute;

    const data = getRequestData(selectedPluginRoute, event, pluginId);
    // following if block is temporary. to be optimized
    const noAdditionalActionsRequest = Object.keys(selectedPluginRoute?.externalReqParams).includes('fileNames');
    const configurationId = event?.body?.configurationId || event?.queryStringParameters?.configurationId;
    if (!noAdditionalActionsRequest) {
        data.externalId = uniqid();
        data.userId += `|${event?.customParameters?.cachedConfigurations?.[configurationId]?.configurationParameters?.userIdType}`;
    }

    const requestOptions = {
        data,
        method: method.toUpperCase(),
        url: new URL(fetchUrl),
    };

    const headers = await getAuthHeaders(
        auth,
        pluginId,
        { ...requestOptions, region: region || 'eu-west-1' },
    );

    try {
        const response = await axios({ ...requestOptions, ...headers });
        console.log(response.data);
        if (pluginHandlersExtRequest[pluginId] && !noAdditionalActionsRequest) {
            await pluginHandlersExtRequest[pluginId](response?.status, response?.data, event, data.externalId);
        }
        event.pluginResponse = response?.data;
        return response.data;
    } catch (error) {
        event.pluginError = {
            success: false,
            message: error.response?.data?.message || 'An error occurred with the external request.',
            statusCode: error.response?.status || 500,
        };
        return {}; // Returning so the code continues on to core functionality and the error is returned from arbiter
    }
};

module.exports = {
    externalRequest,
};
