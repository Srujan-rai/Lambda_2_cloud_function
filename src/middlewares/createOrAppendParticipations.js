const { rsParticipationOnly } = require('../utility_functions/plugin_utils/rsUtils');
const { MIDDLEWARE_MAP } = require('../constants/plugins');
const { PARAMS_MAP } = require('../constants/common');

const pluginHandlersParticipationOnly = {
    RS: async (event) => {
        await rsParticipationOnly(event);
    },
};

const createOrAppendParticipation = () => {
    const participationActionOnBefore = async ({ event }) => {
        const configurationId = event?.body[PARAMS_MAP.CONFIGURATION_ID] || event?.queryStringParameters?.[PARAMS_MAP.CONFIGURATION_ID];
        const { flowLabel, pluginRoute } = event?.body || {};
        const cachedConfig = event?.customParameters?.cachedConfigurations?.[configurationId];
        const flow = cachedConfig?.flow?.[flowLabel];
        const pluginObject = flow?.pluginRoutes?.[pluginRoute] || null;

        if (pluginObject) {
            try {
                const { middlewareToUse, executionOrder, pluginId } = pluginObject;

                if (middlewareToUse === MIDDLEWARE_MAP.UPDATE_PARTICIPATION && executionOrder === 'onBefore') {
                    if (pluginHandlersParticipationOnly[pluginId]) {
                        await pluginHandlersParticipationOnly[pluginId](event);
                    }
                }
            } catch (error) {
                console.error('ERROR: Failed to call onBefore for createOrAppendParticipation', '\n', error);
                throw error;
            }
        } else {
            console.log('Skipping participationActionOnBefore as pluginObject is undefined or missing.');
        }
    };

    return { before: participationActionOnBefore };
};

module.exports = {
    createOrAppendParticipation,
};
