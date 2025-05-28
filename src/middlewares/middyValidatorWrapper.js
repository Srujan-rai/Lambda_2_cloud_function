const middy = require('@middy/core');
const httpErrorHandler = require('@middy/http-error-handler');
const { extractRequestParams } = require('./extractRequestParams');
const validateParamsMiddleware = require('./validateParams');

const middyValidatorWrapper = (handler, requiredParams = []) => (
    middy(handler)
        .use(extractRequestParams())
        .use(validateParamsMiddleware(requiredParams))
        .use(
            httpErrorHandler({
                fallbackMessage: 'Internal server error',
                exposeStack: false,
            }),
        )
);

module.exports = { middyValidatorWrapper };
