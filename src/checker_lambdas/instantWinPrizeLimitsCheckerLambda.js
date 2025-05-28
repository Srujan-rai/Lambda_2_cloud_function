const Messages = require('@the-coca-cola-company/ngps-global-common-messages');
const { middyValidatorWrapper } = require('../middlewares/middyValidatorWrapper');
const Utils = require('../utility_functions/utilityFunctions');
const { getConfiguration } = require('../utility_functions/configUtilities');
const { getInstantWinWinningParticipationsFromConfiguration } = require('../database/participationsDatabase');
const { RESPONSE_BAD_REQUEST, RESPONSE_OK } = require('../constants/responses');
const { ERROR_CODES: { CHECKER_LAMBDA_REJECTION } } = require('../constants/errCodes');
const { PARAMS_MAP } = require('../constants/common');
const { REQUIRED_PARAMETERS_FOR_CHECKER_LAMBDA } = require('../constants/checkers');

/**
 * Lambda function that checks the possibility of a user to participate in a given promo
 * The lambda will validate the prizes won per time interval, if the following parameters exist:
 * instantWinLimitPerTimeInterval - limit of instant win prizes won per time interval
 * instantWinLimitPerTimeInterval - time interval in hours
 * The lambda will validate the total prizes won in the promo, if the following parameter exists:
 * winningParticipationsLimit - max winning participations per user
 *
 * @param {Object} event - Data that we receive from request
 */
const baseInstantWinPrizeLimitsCheckerLambda = async (event) => {
    try {
        const params = await Utils.safeExtractParams(event);
        const config = await getConfiguration(params.configurationId, event);
        const flow = config.flow[params.flowLabel];

        Utils.checkRequiredFlowParameters(
            config,
            params.flowLabel,
        );
        if (flow.params[PARAMS_MAP.INSTANT_WIN_LIMIT_PER_CONFIGURATION]) {
            Utils.checkParametersFormat({
                number: flow.params[PARAMS_MAP.INSTANT_WIN_LIMIT_PER_CONFIGURATION],
            });
        }
        if (flow.params[PARAMS_MAP.INSTANT_WIN_LIMIT_PER_TIME_INTERVAL]
            && flow.params[PARAMS_MAP.INSTANT_WIN_LIMIT_PER_TIME_INTERVAL_VALUE]) {
            Utils.checkParametersFormat({
                number: [flow.params[PARAMS_MAP.INSTANT_WIN_LIMIT_PER_TIME_INTERVAL],
                    flow.params[PARAMS_MAP.INSTANT_WIN_LIMIT_PER_TIME_INTERVAL_VALUE]],
            });
        }

        const usersWinningParticipations = await getInstantWinWinningParticipationsFromConfiguration(
            params[PARAMS_MAP.CONFIGURATION_ID],
            params[PARAMS_MAP.GPP_USER_ID],
        );

        if (flow.params[PARAMS_MAP.INSTANT_WIN_LIMIT_PER_CONFIGURATION]
            && usersWinningParticipations.length >= flow.params[PARAMS_MAP.INSTANT_WIN_LIMIT_PER_CONFIGURATION]) {
            const resBody = Utils.createErrorBody(
                CHECKER_LAMBDA_REJECTION,
                Messages.COMMON_ERR.INSTANT_WIN_LIMIT_PER_CONFIGURATION_REACHED,
            );
            throw (Utils.createResponse(RESPONSE_BAD_REQUEST, resBody));
        }

        if (flow.params[PARAMS_MAP.INSTANT_WIN_LIMIT_PER_TIME_INTERVAL]
            && flow.params[PARAMS_MAP.INSTANT_WIN_LIMIT_PER_TIME_INTERVAL_VALUE] && usersWinningParticipations.length > 0) {
            const startTimeStamp = Date.now();
            const endTimeStamp = startTimeStamp - (3600000 * flow.params[PARAMS_MAP.INSTANT_WIN_LIMIT_PER_TIME_INTERVAL_VALUE]);
            const filteredParticipations = usersWinningParticipations.filter(
                (part) => part.participation_time >= endTimeStamp && part.participation_time < startTimeStamp,
            );
            if (filteredParticipations.length >= flow.params[PARAMS_MAP.INSTANT_WIN_LIMIT_PER_TIME_INTERVAL]) {
                const resBody = Utils.createErrorBody(
                    CHECKER_LAMBDA_REJECTION,
                    Messages.COMMON_ERR.INSTANT_WIN_LIMIT_PER_TIME_INTERVAL_REACHED,
                );
                throw (Utils.createResponse(RESPONSE_BAD_REQUEST, resBody));
            }
        }

        const res = Utils.createResponse(RESPONSE_OK, '');
        console.log('Returning response:\n', JSON.stringify(res));
        return res;
    } catch (err) {
        console.error('ERROR: Returning error response:\n', err);
        return err;
    }
};

module.exports.instantWinPrizeLimitsCheckerLambda = middyValidatorWrapper(baseInstantWinPrizeLimitsCheckerLambda,
    REQUIRED_PARAMETERS_FOR_CHECKER_LAMBDA.instantWinPrizeLimits);
