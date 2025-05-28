const Messages = require('@the-coca-cola-company/ngps-global-common-messages');
const { middyValidatorWrapper } = require('../middlewares/middyValidatorWrapper');
const {
    createErrorBody,
    createResponse,
    safeExtractParams,
    checkRequiredFlowParameters,
    checkParametersFormat,
    decreaseDateTimeByHours,
} = require('../utility_functions/utilityFunctions');
const { getConfiguration } = require('../utility_functions/configUtilities');
const {
    validateCommonParams,
    pincodesStringToArray,
} = require('../participation_types/pincodes/mixCodesUtilityFunctions');
const { getUserParticipationsIfsuccessfulBurnsExists } = require('../database/participationsDatabase');
const { ERROR_CODES: { CHECKER_LAMBDA_REJECTION } } = require('../constants/errCodes');
const { RESPONSE_OK, RESPONSE_BAD_REQUEST } = require('../constants/responses');
const { REQUIRED_PARAMETERS_FOR_CHECKER_LAMBDA } = require('../constants/checkers');
const { PARAMS_MAP: { PARTICIPATION_LIMIT, PARTICIPATION_LIMIT_TIME, GPP_USER_ID } } = require('../constants/common');

/**
 * Checks whether we should stop the user participation based on its activity. The possible situations for stopping are:
 * 1. He burned pincodes equal to the limit
 * 2. He has less burned pincodes than the limit, but the sent pincodes are more than allowed
 *
 * @param {Array} data - DynamoDB records
 * @param {Number} limit - participation limit
 * @param {Number} pinsCount - poincodes count
 */
const processParticipationRecords = (data, limit, pinsCount) => {
    const usedCodeBurns = data.length ? data.length : 0;

    if ((usedCodeBurns || pinsCount) && (usedCodeBurns >= limit
        || usedCodeBurns < limit + pinsCount
        && limit < usedCodeBurns + pinsCount
        && limit > usedCodeBurns)) {
        const diff = limit - usedCodeBurns;
        let err = Messages.COMMON_ERR.PARTICIPATION_LIMIT_REACHED;

        if (diff > 0 && pinsCount > diff) {
            err = `You can use only ${diff} pincode. For what is remaining please try again later!`;
        }

        const resBody = createErrorBody(CHECKER_LAMBDA_REJECTION, err);
        throw createResponse(RESPONSE_BAD_REQUEST, resBody);
    }
};

/**
 * Lambda function which checks is it able the specified user to participate in a promo
 * When added as a checker, the lambda has 2 required parameters which will be gathered from the config:
 * codeBurningLimit - participation limit
 * codeBurningLimitTime - participation limit time in hours
 *
 * @param {Object} event - Data that we receive from request
 * @param {Object} context - Lambda context
 * @param callback - Callback function for returning the response
 */
const baseCodeBurnerLimitCheckerLambda = async (event) => {
    try {
        const params = await safeExtractParams(event);
        await validateCommonParams(params);
        const configuration = await getConfiguration(params.configurationId, event);
        const flow = configuration.flow[params.flowLabel];

        checkRequiredFlowParameters(
            configuration,
            params.flowLabel,
            [PARTICIPATION_LIMIT, PARTICIPATION_LIMIT_TIME],
        );

        checkParametersFormat({
            number: [flow.params[PARTICIPATION_LIMIT], flow.params[PARTICIPATION_LIMIT_TIME]],
        });

        const limitTimestamp = decreaseDateTimeByHours(flow.params[PARTICIPATION_LIMIT_TIME]);
        const userParticipations = await getUserParticipationsIfsuccessfulBurnsExists(
            params[GPP_USER_ID],
            limitTimestamp, params.configurationId,
        );

        await processParticipationRecords(
            userParticipations,
            flow.params[PARTICIPATION_LIMIT],
            pincodesStringToArray(params.pins).length,
        );
        const res = createResponse(RESPONSE_OK, '');
        console.log('Returning response:\n', JSON.stringify(res));
        return res;
    } catch (err) {
        console.error('ERROR: Returning error response:\n', err);
        return err;
    }
};

module.exports.codeBurnerLimitCheckerLambda = middyValidatorWrapper(baseCodeBurnerLimitCheckerLambda,
    REQUIRED_PARAMETERS_FOR_CHECKER_LAMBDA.codeBurningLimit);
