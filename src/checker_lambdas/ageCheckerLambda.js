const Moment = require('moment-timezone');
const { middyValidatorWrapper } = require('../middlewares/middyValidatorWrapper');
const Utils = require('../utility_functions/utilityFunctions');
const { getConfiguration } = require('../utility_functions/configUtilities');
const ConfigurationUtils = require('../self_service/configurationUtils');
const { REQUIRED_PARAMETERS_FOR_CHECKER_LAMBDA } = require('../constants/checkers');
const { ERROR_CODES: { CONFIGURATION_PARAMETER_MISSING, CHECKER_LAMBDA_REJECTION } } = require('../constants/errCodes');
const {
    RESPONSE_BAD_REQUEST, RESPONSE_OK, RESPONSE_INTERNAL_ERROR, RESPONSE_FORBIDDEN,
} = require('../constants/responses');
const { PARAMS_MAP: { DATE_OF_BIRTH } } = require('../constants/common');

/**
 * Lambda function.
 * Expects date of birth as parameter (expressed as timestamp)
 * Checks whether user is qualified for participating the promotion (old enough)
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
const baseAgeCheckerLambda = async (event) => {
    try {
        const params = Utils.extractParams(event);
        const configuration = await getConfiguration(params.configurationId, event);
        const res = processAgeValidation(params, configuration);
        console.log('Returning response:\n', JSON.stringify(res));
        return res;
    } catch (err) {
        console.error('ERROR: Returning error response:\n', err);
        return err;
    }
};

/**
 * Checks the age of the user from the values being passed from the body of the event
 * and the minimum age required for the promotion which is specified in the config file
 * @param {Object} params - Query Parameters
 * @param configuration - Pulled in from the config file in S3
 */
const processAgeValidation = (params, configuration) => {
    const minAge = ConfigurationUtils.getMinAge(configuration, params.flowLabel);

    if (!minAge) {
        const errorBody = Utils.createErrorBody(CONFIGURATION_PARAMETER_MISSING, 'minAge not configured');
        const errRes = Utils.createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
        throw errRes;
    }
    console.log('Minimum age is:', minAge);

    const dob = Moment(params[DATE_OF_BIRTH]);

    if (!dob.isValid()) {
        const errorBody = Utils.createErrorBody(CHECKER_LAMBDA_REJECTION, 'Invalid parameter type!',
            { parameter: `${DATE_OF_BIRTH}` });
        const errRes = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errRes;
    }

    const age = Moment().diff(dob, 'years');

    console.log('Calculating age...', age);

    const isUnderaged = age < minAge;

    if (isUnderaged) {
        const errorBody = Utils.createErrorBody(CHECKER_LAMBDA_REJECTION, "User can't participate",
            { underaged: true });
        const res = Utils.createResponse(RESPONSE_FORBIDDEN, errorBody);
        throw res;
    } else {
        const res = Utils.createResponse(RESPONSE_OK, { underaged: isUnderaged });
        return res;
    }
};

module.exports.ageCheckerLambda = middyValidatorWrapper(baseAgeCheckerLambda, REQUIRED_PARAMETERS_FOR_CHECKER_LAMBDA.age);
