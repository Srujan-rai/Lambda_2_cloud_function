const axios = require('axios');
const { middyValidatorWrapper } = require('../middlewares/middyValidatorWrapper');
const Utils = require('../utility_functions/utilityFunctions');
const { getConfiguration } = require('../utility_functions/configUtilities');
const ConfigurationUtils = require('../self_service/configurationUtils');
const { PARAMS_MAP: { RECAPTCHA, CONFIGURATION_ID } } = require('../constants/common');
const { ERR_CODES: { CONFIGURATION_MALFORMED }, ERROR_CODES: { CONFIGURATION_ERROR, UNKNOWN_ERROR, CHECKER_LAMBDA_REJECTION } } = require('../constants/errCodes');
const { RESPONSE_BAD_REQUEST, RESPONSE_FORBIDDEN, RESPONSE_OK } = require('../constants/responses');
const { REQUIRED_PARAMETERS_FOR_CHECKER_LAMBDA } = require('../constants/checkers');

/**
 * Lambda Function for the checking of Google Capture.
 * In order for this to work you will need to have a configuration in S3 comprising of a configID, flowLabel,
 * checkerLambda and secret with the capture secret passed as an object.
 * In addition you will need to pass a call specifying the configOD, flowLabel and g-recaptcha-response(REQUIRED-FIELD)
 * @param event - The data that we receive from the request
 * @param context -
 * @param callback - The data that will be returned
 */
const baseCaptchaCheckerLambda = async (event) => {
    try {
        const params = Utils.extractParams(event);
        const remoteIp = event.requestContext.identity ? event.requestContext.identity.sourceIp : '';
        console.log('remoteip:', remoteIp || 'Unknown');
        const configuration = await getConfiguration(params[CONFIGURATION_ID], event);
        const secret = ConfigurationUtils.getCaptchaSecret(configuration, params.flowLabel);
        if (!secret) {
            const errorBody = Utils.createErrBody(CONFIGURATION_MALFORMED, 'Configuration missing g-captcha details!', undefined, CONFIGURATION_ERROR);
            const errResponse = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
            throw errResponse;
        }

        const captchaResponse = params[RECAPTCHA];
        const googleResponse = await verifyCaptchaWithGoogle(secret, captchaResponse, remoteIp);
        console.log('Google response:\n', googleResponse.data);
        const response = createCaptchaVerificationResponse(googleResponse.data.success);
        console.log('Returning success response...');
        return response;
    } catch (err) {
        console.error('ERROR:', err);
        if (err.response) {
            return err;
        }
        const errorBody = Utils.createErrorBody(UNKNOWN_ERROR, 'Error while checking captcha.');
        const errorResponse = Utils.createResponse(RESPONSE_FORBIDDEN, errorBody);
        console.error('ERROR: Returning error response:\n', errorResponse);
        return errorResponse;
    }
};

/**
 * The below will construct a response based on the boolean result of the API Call to google.
 * @param {boolean} verified - Takes a true of false value which is passed into the IF and builds the response body accordingly.
 */
const createCaptchaVerificationResponse = (verified) => {
    const body = {
        captchaVerified: verified,
    };
    if (verified) {
        return Utils.createResponse(RESPONSE_OK, body);
    }
    const errorBody = Utils.createErrorBody(CHECKER_LAMBDA_REJECTION,
        'captcha verification failed', body);
    return Utils.createResponse(RESPONSE_FORBIDDEN, errorBody);
};

/**
 * The below is an API call made to Google Capture which is made up of:
 * @param {string} method - The method of sending the request.
 * @param {string} uri - The endpoint for sending the request
 * @param {Object} qs - The object containing the following properties:
 * @property {string} qs.secret - The secret taken from the configuration in S3.
 * @property {string} qs.response - The clients captcha response which is stored in the g-recaptcha-response param.
 * @property {string} qs.remoteip - The IP of the clients machine / device.
 * @param {boolean} json - The format of the data to be sent and received.
 */
const verifyCaptchaWithGoogle = (secret, captchaResponse, remoteIp) => axios.post('https://www.google.com/recaptcha/api/siteverify', {
    secret,
    response: captchaResponse,
    remoteip: remoteIp,
}, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
});

module.exports.captchaCheckerLambda = middyValidatorWrapper(baseCaptchaCheckerLambda, REQUIRED_PARAMETERS_FOR_CHECKER_LAMBDA.checkCaptcha);
