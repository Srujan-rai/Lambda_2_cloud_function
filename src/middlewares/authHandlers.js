const { signRequest } = require('../utility_functions/utilityFunctions');
const { getParametersFromSSM } = require('../utility_functions/aws_sdk_utils/ssmUtilities');

const authHandlers = {
    // Different auth types can be added as per requirements
    // Bearer: (pluginId) => ({ Authorization: `Bearer ${token}` }),
    // APIKey: (pluginId) => ({ 'x-api-key': apiKey }),
    AWSv4: async (pluginId, requestOptions) => {
        const parameterName = `${pluginId}_CREDENTIALS`;
        const credentials = await getParametersFromSSM(parameterName);
        const { accessKeyId, secretAccessKey } = JSON.parse(credentials[parameterName]);
        const params = {
            accessKeyId,
            secretAccessKey,
            ...requestOptions,
        };

        return signRequest(params);
    },
};

const getAuthHeaders = (auth, pluginId, requestOptions) => {
    if (!auth || !auth.type) return {};

    const authHandler = authHandlers[auth.type];
    if (!authHandler) {
        throw new Error('Unsupported auth type');
    }
    return authHandler(pluginId, requestOptions);
};

module.exports = {
    getAuthHeaders,
};
