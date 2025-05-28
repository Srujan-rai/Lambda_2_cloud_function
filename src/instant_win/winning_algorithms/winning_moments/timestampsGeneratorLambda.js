const { middyValidatorWrapper } = require('../../../middlewares/middyValidatorWrapper');
const {
    calculateTimestamp,
    isPercentValue,
    createResponseInvalidParameter,
    extractParams,
    createResponse,
} = require('../../../utility_functions/utilityFunctions');
const { RESPONSE_OK } = require('../../../constants/responses');
const {
    PARAMS_MAP: {
        START_DATE, END_DATE, TIMESTAMPS_AMOUNT, TIMESTAMP_DISTRIBUTION_DEFECT,
    },
} = require('../../../constants/common');
const { REQUIRED_PARAMETERS_FOR_LAMBDA } = require('../../../constants/lambdas');

/**
 * Generates array of timestamps based on provided input.
 *
 * @param {Object} params - request parameters (originally received by Lambda)
 *
 * @returns {Array<Number>} Array of generated timestamps
 */
const generateTimestampsArray = (params) => {
    const startDate = params[START_DATE];
    const endDate = params[END_DATE];
    const defect = params[TIMESTAMP_DISTRIBUTION_DEFECT];
    const amount = params[TIMESTAMPS_AMOUNT];
    const result = [];

    console.log('Creating timestamps for time range: ', startDate, ' - ', endDate);
    const sequenceDuration = (endDate - startDate) / amount;
    console.log('Sequence duration calculated! Value:', sequenceDuration);

    for (let i = 0; i < amount; i++) {
        const sequenceStart = startDate + i * sequenceDuration;
        result.push(calculateTimestamp(sequenceStart, sequenceDuration, defect));
    }
    return result;
};

/**
 * Validates provided parameters.
 *
 * @param {Object} params - request parameters (originally received by Lambda)
 *
 * @returns {Promise} resolved if all parameters pass the validation, rejected with error response if any fail
 */
const validateInputParams = async (params) => {
    const invalidParams = [];

    // Check types and values
    if (!isPercentValue(params[TIMESTAMP_DISTRIBUTION_DEFECT])) {
        invalidParams.push(TIMESTAMP_DISTRIBUTION_DEFECT);
    }
    if (!Number.isInteger(params[TIMESTAMPS_AMOUNT]) || params[TIMESTAMPS_AMOUNT] <= 0) {
        invalidParams.push(TIMESTAMPS_AMOUNT);
    }
    if (!Number.isInteger(params[START_DATE])) {
        invalidParams.push(START_DATE);
    }
    if (!Number.isInteger(params[END_DATE])) {
        invalidParams.push(END_DATE);
    }

    // Early exit. Proceed with further checks only if all parameters are individually valid.
    if (invalidParams.length > 0) {
        throw createResponseInvalidParameter(invalidParams);
    }

    // Check if combination of parameters is valid
    if (params[START_DATE] + params[TIMESTAMPS_AMOUNT] > params[END_DATE]) {
        invalidParams.push(START_DATE, END_DATE, TIMESTAMPS_AMOUNT);
    }

    if (invalidParams.length > 0) {
        throw createResponseInvalidParameter(invalidParams);
    } else {
        return params;
    }
};

/**
 * Lambda function. Responsible for generating winning moments based on series of rules and constraints
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
const timestampsGeneratorLambda = async (event) => {
    try {
        const params = extractParams(event);
        await validateInputParams(params);
        const timestampsArray = await generateTimestampsArray(params);
        const response = createResponse(RESPONSE_OK, { generatedTimestamps: timestampsArray });
        console.log('Returning success response...');
        return response;
    } catch (err) {
        console.error('ERROR: Returning error response:\n', err);
        return err;
    }
};

module.exports = {
    timestampsGeneratorLambda: middyValidatorWrapper(timestampsGeneratorLambda, REQUIRED_PARAMETERS_FOR_LAMBDA.timestampsGeneratorLambda),
};
