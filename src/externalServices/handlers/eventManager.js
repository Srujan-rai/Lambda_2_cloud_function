const { invokeLambda } = require('../../utility_functions/aws_sdk_utils/lambdaUtilities');
const { createInvalidError } = require('../utils/helpers');
const { config } = require('../utils/config');

const eventManager = async (message) => {
    console.log('Processing event:', message);
    const { pluginId } = message.systemMetadata;

    const eventConfig = config.eventMap[pluginId];
    if (!eventConfig) {
        throw createInvalidError(`No event message configuration found for pluginId: ${pluginId}`);
    }

    const {
        getConfig, functionName, payload, preProcess, postProcess,
    } = eventConfig;

    const configuration = await getConfig(message);

    if (preProcess) {
        await preProcess(message);
    }
    const lambdaPayload = await payload(message, configuration);
    const response = {};
    if (lambdaPayload) {
        const res = await invokeLambda(functionName, { body: JSON.stringify(lambdaPayload) });
        console.log('Function returned response: ', JSON.stringify(res));
        response.function = res;
    }

    if (postProcess) {
        response.postProcess = await postProcess(message, configuration);
    }

    return response;
};

module.exports = { eventManager };
