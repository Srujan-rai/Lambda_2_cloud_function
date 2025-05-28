const { createResponseMissingParameters } = require('../utility_functions/utilityFunctions');

/**
 * Custom Middy middleware to check required parameters
 *
 * @param {Array<string>} requiredParams - List of required parameter names
 */
const validateParams = (requiredParams = []) => ({
    before: async (request) => {
        const params = request.event.body || {};

        const missing = requiredParams.filter(
            (key) => !Object.prototype.hasOwnProperty.call(params, key),
        );

        if (missing.length > 0) {
            const { statusCode, body: responseBody, headers } = createResponseMissingParameters(missing);
            const error = new Error(responseBody);
            error.statusCode = statusCode;
            error.headers = headers;
            throw error;
        }
    },
});

module.exports = validateParams;
