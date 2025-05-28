const { createResponseBadJsonRequest } = require('../utility_functions/utilityFunctions');

const extractRequestParams = () => {
    const extractRequestParamsBefore = ({ event }) => {
        try {
            let params = {};

            if (event.body) {
                params = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
            }

            if (event.queryStringParameters) {
                const { email, userId, envDetails } = event.requestContext.authorizer || {};
                params = {
                    ...params,
                    ...event.queryStringParameters,
                    email,
                    userId,
                    envDetails,
                };
                console.debug('queryStringParams', params);
            }
            event.body = params;
        } catch (error) {
            console.error('ERROR: Failed to extract request params:\n', error);
            throw createResponseBadJsonRequest();
        }
    };

    return { before: extractRequestParamsBefore };
};

module.exports = {
    extractRequestParams,
};
