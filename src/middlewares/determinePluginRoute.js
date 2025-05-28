const { PARAMS_MAP } = require('../constants/common');

const determinePluginRoute = (flowName) => {
    const determinePluginRouteOnBefore = async ({ event }) => {
        const flowLabel = flowName || event?.body?.flowLabel;
        const configurationId = event?.body[PARAMS_MAP.CONFIGURATION_ID] || event?.queryStringParameters?.[PARAMS_MAP.CONFIGURATION_ID];
        // eslint-disable-next-line
        const pluginRoutes = event?.customParameters?.cachedConfigurations[configurationId]?.flow[flowLabel]?.pluginRoutes;
        if (pluginRoutes) {
            const pluginRouteKeys = Object.keys(pluginRoutes);
            const defaultRoute = pluginRouteKeys.find((routeKey) => pluginRoutes[routeKey].defaultRoute);
            // eslint-disable-next-line
            const inferredRouteToUse = pluginRouteKeys.map((routeKey) => {
                if (pluginRoutes[routeKey]?.requiredParams.every((value) => Object.keys(event.body).includes(value))) {
                    return routeKey;
                }
            }).filter((value) => value)[0];
            console.log(inferredRouteToUse);
            event.body.pluginRoute = inferredRouteToUse || defaultRoute;
        }
    };

    return { before: determinePluginRouteOnBefore };
};

module.exports = {
    determinePluginRoute,
};
