const warmer = require('lambda-warmer');
const middy = require('@middy/core');
const Messages = require('@the-coca-cola-company/ngps-global-common-messages');
const ssConfig = require('./self_service/selfServiceConfig.json');
const { authenticate } = require('./ssAuthenticator');
const { authorize: authorizeSS } = require('./ssAuthorizer');
const { authorize } = require('./configAuthorizer');
const { addResponseToEventIfNeeded, putCustomEventParameter, CUSTOM_EVENT_PARAMS: { EMAIL_VERIFICATION_URL } } = require('./utility_functions/eventUtilities');
const { mergeObjectParams } = require('./utility_functions/utilityFunctions');
const { PARAMS_MAP, PATTERNS, LOCALIZATION_FIELDS } = require('./constants/common');
const { CONFIGURATION_CHECKS_MAP } = require('./constants/checkers');
const { CONFIGURATION_FUNCTIONS_MAP } = require('./constants/lambdas');
const { ERR_CODES, ERROR_CODES } = require('./constants/errCodes');
const {
    RESPONSE_OK, RESPONSE_BAD_REQUEST, RESPONSE_INTERNAL_ERROR, RESPONSE_NOT_FOUND,
} = require('./constants/responses');
const { verifyCDSToken } = require('./authorizers');
const { checkIfUserMigrated } = require('./userMigration/cdsMigrationUtils');
const { localizeObject } = require('./utility_functions/localizationUtilities');
const {
    mergeResponses,
    checkReceivedResponse,
    createResponse,
    createErrorBody,
    createErrBody,
    getSatisfiedUserType,
    createResponseInvalidParameter,
    safeExtractParams,
    configTimePeriodCheck,
    getTracingId,
    shouldEnterCoreLogicCheck,
    createPublicListPrizeEventCtx,
} = require('./utility_functions/utilityFunctions');
const { invokeLambda } = require('./utility_functions/aws_sdk_utils/lambdaUtilities');
const { getConfiguration, addParametersToEvent } = require('./utility_functions/configUtilities');
const { fetchS3Config } = require('./middlewares/fetchS3Config');
const { determinePluginRoute } = require('./middlewares/determinePluginRoute');
const { callExternalService } = require('./middlewares/callExternalService');
const { extractRequestParams } = require('./middlewares/extractRequestParams');
const { createOrAppendParticipation } = require('./middlewares/createOrAppendParticipations');
const {
    getAdditionalInformation,
    getFlowLabel,
    getFlowParameter,
    getDefaultLanguage,
} = require('./self_service/configurationUtils');

/**
 * Executes single AWS Lambda functions.
 * @param event - original event received by arbiter
 * @param lambda - AWS Lambda functions to be executed
 * @param previousResponse - current arbiter response
 * @param map - flow/checks map for lambda functions invoke parameters
 */
const executeSingle = (lambda, previousResponse, event, map) => new Promise((resolve, reject) => {
    (async () => {
        try {
            console.log('Executing lambda:', lambda);
            const lambdaParams = map[lambda];
            if (!lambdaParams) {
                console.warn(`Lambda ${lambda} not found.`);
                return resolve(previousResponse);
            }
            lambdaParams.Payload = JSON.stringify(event);
            const previousResBody = JSON.parse(previousResponse.body);
            const eventObject = addResponseToEventIfNeeded(previousResBody, event);
            const response = await invokeLambda(map[lambda], eventObject);
            const mergedResponse = mergeResponses(
                { ...previousResponse, body: JSON.stringify(previousResBody) },
                response,
            );
            if (mergedResponse.statusCode === 200) return resolve(mergedResponse);
            return reject(mergedResponse);
        } catch (errorResponse) {
            reject(errorResponse);
        }
    })();
});

/**
 * Executes chain of AWS Lambda functions.
 * @param event - original event received by arbiter
 * @param lambdaArray - array of AWS Lambda functions
 * @param previousResponse - current arbiter response
 * @param map - flow/checks map for lambda functions invoke parameters
 */
const executeChain = (event, lambdaArray, previousResponse, map) => {
    let promise = Promise.resolve(previousResponse);
    for (let i = 0; i < lambdaArray.length; i++) {
        if (lambdaArray[i] !== 'validInput') {
            promise = promise.then((res) => executeSingle(lambdaArray[i], res, event, map)).catch((err) => {
                // Logs only nodejs errors, not the internal ones
                if (!err?.statusCode) {
                    console.error(`executeSingle ERROR: ${JSON.stringify(err)}`);
                }
                const errorResponse = checkReceivedResponse(err);
                return Promise.reject(errorResponse);
            });
        }
    }
    return promise;
};

/**
 * Executes chain of Checker Lambdas.
 */
const executeCheckerLambdaChain = async (event, configuration, previousResponse, params) => {
    const { checkerLambdas } = configuration.flow[params.flowLabel];

    if (!checkerLambdas) {
        // No checks to perform...
        return createResponse(RESPONSE_OK, {});
    }

    console.log('Executing chain of checkerLambdas:\n', JSON.stringify(checkerLambdas));
    return executeChain(event, checkerLambdas, previousResponse, CONFIGURATION_CHECKS_MAP);
};

/**
 * Executes chain of Flow Lambdas.
 */
const executeFlowLambdaChain = (event, configuration, previousResponse, params) => {
    const { flowLambdas } = configuration.flow[params[PARAMS_MAP.FLOW_LABEL]];
    console.log('Executing chain of flowLambdas:\n', JSON.stringify(flowLambdas));
    return executeChain(event, flowLambdas, previousResponse, CONFIGURATION_FUNCTIONS_MAP);
};

/**
 * Executes checker and flow lambdas specified in config
 */
const executeFlow = async (event, config, response, params) => {
    try {
        const checkerResponse = await executeCheckerLambdaChain(event, config, response, params);
        const fullResponse = await executeFlowLambdaChain(event, config, checkerResponse, params);
        return fullResponse;
    } catch (errorResponse) {
        if (!errorResponse) {
            const errorBody = createErrorBody(ERROR_CODES.UNKNOWN_ERROR,
                'Something went wrong! Please contact GPP');
            const internalError = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
            throw internalError;
        }
        throw errorResponse;
    }
};

/**
 * Validate common request params from SDK requests
 * @param params
 */
const validateRequestParams = async (params) => {
    const invalidParams = [];

    if (params.userIdType && !params.userIdType.match(PATTERNS.userTypePattern)) {
        invalidParams.push(PARAMS_MAP.USER_ID_TYPE);
    }
    if (params.email && !params.email.match(PATTERNS.email)) {
        invalidParams.push(PARAMS_MAP.EMAIL_DESTINATION);
    }
    if (params.flowLabel && !params.flowLabel.match(PATTERNS.alphaNumericPattern)) {
        invalidParams.push(PARAMS_MAP.FLOW_LABEL);
    }
    if (params.configurationId && !params.configurationId.match(PATTERNS.alphaNumericPattern)) {
        invalidParams.push(PARAMS_MAP.CONFIGURATION_ID);
    }
    if (invalidParams.length) {
        throw createResponseInvalidParameter(invalidParams);
    }
    return params;
};

/**
 * Checks the presence of core arguments and configuration attributes. Common for arbiter and arbiterSS.
 *
 * @param {Object} params - Request body parameters, originally received by Lambda.
 * @param {Object} configuration - Configuration in JSON format
 *
 * @returns {Promise} - resolved with status 200 HTTP response if all checks passed,
 *                    - rejected with appropriate error HTTP response if any check fails
 */
const performCommonCoreChecks = async (params, configuration) => {
    if (!params[PARAMS_MAP.FLOW_LABEL]) {
        // TODO use createResponseMissingParameters instead
        const errorBody = createErrBody(ERR_CODES.MISSING_REQUEST_PARAMETERS,
            'missing argument(s)', { argsMissing: [PARAMS_MAP.FLOW_LABEL] }, ERROR_CODES.REQUEST_PARAMETER_MISSING);
        throw createResponse(RESPONSE_BAD_REQUEST, errorBody);
    }
    if (!configuration.flow) {
        const errorBody = createErrBody(ERR_CODES.CONFIGURATION_MALFORMED,
            'bad promotion configuration', undefined, ERROR_CODES.CONFIGURATION_PARAMETER_MISSING);
        throw createResponse(RESPONSE_BAD_REQUEST, errorBody);
    }
    if (!configuration.flow[params.flowLabel]) {
        const errorBody = createErrBody(ERR_CODES.NONEXISTENT_FLOW_LABEL,
            Messages.COMMON_ERR.INVALID_FLOW, undefined, ERROR_CODES.CONFIGURATION_PARAMETER_MISSING);
        throw createResponse(RESPONSE_BAD_REQUEST, errorBody);
    }
    if (Object.prototype.hasOwnProperty.call(params, PARAMS_MAP.USER_ID) && !getSatisfiedUserType(params[PARAMS_MAP.USER_ID])) {
        throw createResponseInvalidParameter(params[PARAMS_MAP.USER_ID]);
    }
    configTimePeriodCheck(configuration, params);
    console.log('All core checks passed!');
};

const getUserDetails = (event) => {
    const { email, userId } = event.requestContext.authorizer;
    return { email, userId: userId || email };
};

/**
 * Extracts parameters from the API Gateway event object
 * and returns an updated event with the extracted params.
 *
 * For GET requests, query params are merged with user details.
 * For POST requests, request body is merged with user details
 * and configurationId from the query string params.
 *
 * @param {Object} event - The API Gateway event object
 * @returns {Object} The updated event object
 */
const extractParamsFromEvent = (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    const userDetails = getUserDetails(event);
    const requestMethod = event.httpMethod;
    const queryParams = event.queryStringParameters;
    const updatedEvent = {
        ...event,
    };

    if (requestMethod !== 'POST') {
        updatedEvent.queryStringParameters = {
            ...queryParams,
            ...userDetails,
        };
    } else {
        const requestBody = event.body;
        updatedEvent.body = {
            ...requestBody,
            ...userDetails,
            configurationId: queryParams?.configurationId,
        };
    }

    console.log(`Updated ${requestMethod} event:`, JSON.stringify(updatedEvent, null, 2));
    return updatedEvent;
};

/**
 * Validate the optional auth header with cds
 * @param {*} event
 * @returns promise resolve/reject
 */
const validateAuthHeader = async (event) => {
    try {
        const authHeader = event.headers && event.headers.cdsauthorization;
        if (authHeader) {
            return await verifyCDSToken(authHeader);
        }
    } catch (e) {
        const errorBody = createErrBody(ERR_CODES.INVALID_REQUEST_PARAMETERS,
            e.message, ERROR_CODES.INVALID_PARAMETER);
        throw createResponse(RESPONSE_BAD_REQUEST, errorBody);
    }
};

/**
 * Lambda function exposed via APIGateway. Entry point (currently) for any request. Calls series of other lambdas
 * and standard functions to validate request parameters and return response.
 *
 * @param {Object} event - Data that we receive from request
 */
const arbiter = async (event) => {
    console.log('Received event request context:\n', event.requestContext && event.requestContext.identity);
    try {
        if (await warmer(event)) return 'warmed';
        const enterCoreLogicCheck = shouldEnterCoreLogicCheck(event);
        if (enterCoreLogicCheck) {
            return enterCoreLogicCheck;
        }
        const params = event.body;

        console.log(`Tracing ID: ${getTracingId(event)}`);
        console.log('Extracted params:\n', JSON.stringify(params));

        const userInfo = await validateAuthHeader(event);

        if (userInfo?.emailVerificationUrl) {
            putCustomEventParameter(event, EMAIL_VERIFICATION_URL, userInfo.emailVerificationUrl);
        }

        if (userInfo?.userId && params[PARAMS_MAP.USER_ID] !== userInfo.userId) {
            params[PARAMS_MAP.USER_ID] = userInfo.userId;
        }

        if (userInfo?.country) {
            params[PARAMS_MAP.COUNTRY] = userInfo.country;
        }

        await validateRequestParams(params);

        const s3ClientConfig = event.customParameters?.cachedConfigurations[params[PARAMS_MAP.CONFIGURATION_ID]];

        await performCommonCoreChecks(params, s3ClientConfig);
        await authorize(event, s3ClientConfig.configurationId);

        let userMigrated;

        if (process.env.migrateUsers === 'true' && params[PARAMS_MAP.USER_ID]) {
            userMigrated = await checkIfUserMigrated(params);
        }

        addParametersToEvent(event, params, s3ClientConfig, userMigrated);
        const response = createResponse(RESPONSE_OK, {});
        const result = await executeFlow(event, s3ClientConfig, response, params);
        if (event?.pluginOutput) {
            const tempBody = JSON.parse(result.body);
            if (!tempBody?.participationId) {
                tempBody.participationId = event.pluginOutput.externalId;
            }
            result.body = JSON.stringify({ ...tempBody, pluginOutput: event.pluginOutput });
        }
        console.log('Success! Returning response...');

        return hasAdditionalInfo(params, s3ClientConfig) ? createAdditionalInfoResponse(params, s3ClientConfig, result) : result;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', JSON.stringify(errorResponse));
        return errorResponse;
    }
};

/**
 * Method to get additional information
 *
 * @param {Object} params
 * @param {Object} config
 */
const createAdditionalInfoResponse = (params, config, response) => {
    const additionalInfo = getAdditionalInformation(config);
    if (!additionalInfo) {
        const errorBody = createErrorBody(ERROR_CODES.NOT_FOUND,
            'Additional information not found');
        const errResponse = createResponse(RESPONSE_NOT_FOUND, errorBody);
        throw errResponse;
    }

    const additionalConfigurationInformation = localizeObject({
        translatableObject: additionalInfo,
        localizationFields: LOCALIZATION_FIELDS.getFieldKeys(),
        requestedLanguage: params.language,
        defaultLanguage: getDefaultLanguage(config),
    });

    const updatedResponseBody = mergeObjectParams(JSON.parse(response.body), { additionalConfigurationInformation });

    return { ...response, body: JSON.stringify(updatedResponseBody) };
};

/**
 * Flag to check if additionalInformation is needed in the flow
 *
 * @param {Object} params - Data that we receive from request
 * @param {Object} config
 */
const hasAdditionalInfo = (params, config) => {
    // additionalConfigurationInformationLambda is an obsolete lambda which will no longer be used.
    // Here we check if it exists in the flowLambdas array for backward compatibility
    const flowLambdaName = 'additionalConfigurationInformationLambda';
    const flowLabelObj = getFlowLabel(config, params.flowLabel);
    const flowParam = 'additionalInformation';

    return getFlowParameter(flowLabelObj, flowParam)
        || flowLabelObj.flowLambdas.includes(flowLambdaName);
};

/**
 * Lambda function exposed via APIGateway for Self Service usage only.
 *
 * @param {Object} event - Data that we receive from request
 */
const arbiterSS = async (event) => {
    console.log('Received event:\n', JSON.stringify(event));
    try {
        const params = await safeExtractParams(event);
        console.log('Extracted params:\n', JSON.stringify(params));
        await performCommonCoreChecks(params, ssConfig);
        const koId = await authenticate(event);
        await authorizeSS(params, ssConfig, koId);
        const response = createResponse(RESPONSE_OK, {});
        const result = await executeFlow(event, ssConfig, response, params);
        console.log('Returning response..');
        return result;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', JSON.stringify(errorResponse));
        return errorResponse;
    }
};

/**
 * Lambda function exposed via APIGateway. Entry point for JS SDK requests only.
 * Before the execution it will go through authorizers.sdkAuthorizer function which
 * will pass the user data extracted from the JWT.
 */
const arbiterSDK = async (event) => {
    if (await warmer(event)) return 'warmed';

    if (event.body.email || event.body.userId) return arbiter(event);

    /**
     * TODO: This code should be cleaned up in future iterations but for now has been left
     * as a back up should there be a failure in the middleware when extracting userId email from the requestContext Obj
     */
    if (event.queryStringParameters.email || event.queryStringParameters.userId) {
        return arbiter(event);
    }

    return arbiter(extractParamsFromEvent(event));
};

/**
 * Lambda function exposed via APIGateway for public list prizes ednpoint
 * @param {Object} event - Data that we receive from request
 */
const publicListPrizes = async (event) => {
    console.log('Received event request context:\n', event.requestContext && event.requestContext.identity);
    try {
        if (await warmer(event)) return 'warmed';

        const params = await safeExtractParams(event);
        const config = await getConfiguration(params[PARAMS_MAP.CONFIGURATION_ID], event);
        await authorize(event, config.configurationId);
        // TODO: Remove together with the SS2 changes!
        // publicListPrizesChecker(config);

        const [lambdaInvokeParameters, lambdaEvent] = createPublicListPrizeEventCtx(params);

        const result = await invokeLambda(lambdaInvokeParameters, lambdaEvent);
        const additionalInfo = getAdditionalInformation(config);

        return additionalInfo ? createAdditionalInfoResponse(params, config, result) : result;
    } catch (err) {
        console.error('ERROR: Returning error response:\n', JSON.stringify(err));
        return err;
    }
};

/**
 * Lambda function exposed via APIGateway for additional information endpoint
 * @param {Object} event - Data that we receive from request
 */
const additionalInformation = async (event) => {
    console.log('Received event request context:\n', event.requestContext && event.requestContext.identity);
    try {
        if (await warmer(event)) return 'warmed';
        console.log('warmer', await warmer(event));
        const params = event.body;
        const config = event.customParameters?.cachedConfigurations[params[PARAMS_MAP.CONFIGURATION_ID]];
        await authorize(event, config.configurationId);
        const response = createResponse(RESPONSE_OK, {});
        console.log('Returning additional data response successfully!');
        return createAdditionalInfoResponse(params, config, response);
    } catch (err) {
        console.error('ERROR: Returning error response:\n', JSON.stringify(err));
        return err;
    }
};

module.exports = {
    arbiter: middy(arbiter)
        .use(extractRequestParams())
        .use(fetchS3Config())
        .use(determinePluginRoute())
        .use(callExternalService())
        .use(createOrAppendParticipation()),
    arbiterSS,
    arbiterSDK: middy(arbiterSDK)
        .use(extractRequestParams())
        .use(fetchS3Config())
        .use(determinePluginRoute())
        .use(callExternalService())
        .use(createOrAppendParticipation()),
    publicListPrizes,
    additionalInformation: middy(additionalInformation)
        .use(extractRequestParams())
        .use(fetchS3Config()),
};
