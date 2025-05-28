const { createResponseBadJsonRequest } = require('../utility_functions/utilityFunctions');

const extractRequestData = () => {
    const extractRequestDataBefore = ({ event }) => {
        try {
            let params = {};
            if (event.body) {
                params = JSON.parse(event.body);
            }
            if (event.queryStringParameters) {
                params = {
                    ...params,
                    ...event.queryStringParameters,
                };
            }
            if (event.requestContext.authorizer) {
                const {
                    email, userId,
                } = event.requestContext.authorizer;
                params = {
                    ...params,
                    email,
                    userId,
                };
            }
            event.body = params;
        } catch (error) {
            console.error('ERROR: Failed to extract request params:\n', error);
            throw createResponseBadJsonRequest();
        }
    };

    return { before: extractRequestDataBefore };
};

module.exports = {
    extractRequestData,
};
