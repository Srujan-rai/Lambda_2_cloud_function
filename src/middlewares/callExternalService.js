const { PARAMS_MAP } = require('../constants/common');
const { externalRequest } = require('../utility_functions/plugin_utils/generalPluginUtils');
const { PLUGINS_MAP, MIDDLEWARE_MAP } = require('../constants/plugins');

const callExternalService = (flowName) => {
    const fetchOnBefore = async ({ event }) => {
        const bodyParams = event?.body;
        const configurationId = bodyParams?.[PARAMS_MAP.CONFIGURATION_ID] || event?.queryStringParameters?.[PARAMS_MAP.CONFIGURATION_ID];
        const s3Config = event?.customParameters?.cachedConfigurations?.[configurationId];
        const flowLabel = flowName || bodyParams?.flowLabel;
        const flow = s3Config?.flow?.[flowLabel];
        const pluginRoute = bodyParams?.pluginRoute;
        const selectedPluginRoute = flow?.pluginRoutes?.[pluginRoute];
        if (selectedPluginRoute) {
            const {
                executionOrder,
                middlewareToUse,
                pluginId,
            } = selectedPluginRoute;
            if (middlewareToUse === MIDDLEWARE_MAP.CALL_EXTERNAL_SERVICE && executionOrder === 'onBefore') {
                try {
                    const response = await externalRequest(selectedPluginRoute, event);
                    event.calledService = PLUGINS_MAP[pluginId];
                    event.calledServiceResponse = response;
                } catch (error) {
                    event.pluginError = {
                        success: false,
                        message: error?.response?.data?.message || 'An error occurred with the external request.',
                        statusCode: error?.response?.status || 500,
                    };
                }
            }
        }
    };

    return { before: fetchOnBefore };
};

module.exports = {
    callExternalService,
};
