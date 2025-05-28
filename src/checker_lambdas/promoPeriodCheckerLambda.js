const Moment = require('moment-timezone');
const Utils = require('../utility_functions/utilityFunctions');
const { getConfiguration } = require('../utility_functions/configUtilities');
const PromoUtils = require('../self_service/promotionsUtils');
const { ERROR_CODES: { CHECKER_LAMBDA_REJECTION } } = require('../constants/errCodes');
const { RESPONSE_OK, RESPONSE_FORBIDDEN } = require('../constants/responses');

/**
 * CheckerLambda. Checks if request comes during promo period (between start and end date of promotion)
 */

module.exports.promoPeriodCheckerLambda = async (event) => {
    try {
        const params = Utils.extractParams(event);
        console.log('Extracted params:\n', JSON.stringify(params));

        const configuration = await getConfiguration(params.configurationId, event);
        const withinPeriod = await checkIfWithinPromoPeriod(configuration); // TODO: test here catch
        console.log('Returning response:\n', JSON.stringify(withinPeriod));
        return withinPeriod;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', errorResponse);
        return errorResponse;
    }
};

const checkIfWithinPromoPeriod = async (config) => {
    const moment = Moment();
    console.log(`current time is: ${moment.toDate().getTime()}`);

    // Get the promotionId from Dynamo DB and evaluate the result.
    const promotionMetaData = await PromoUtils.getMetadata(config.promotionId);
    const currentTime = moment.toDate().getTime();
    const isStarted = currentTime > promotionMetaData.promotion_start_utc;
    const isFinished = currentTime > promotionMetaData.promotion_end_utc;

    // If the start time is in the future || the end time is in the past
    if (!isStarted || isFinished) {
        const errorDetails = {
            promotionLive: false,
            promotionStarted: isStarted,
            promotionEnded: isFinished,
        };

        const errorBody = Utils.createErrorBody(CHECKER_LAMBDA_REJECTION,
            'Participating is not allowed at this time', errorDetails);
        throw Utils.createResponse(RESPONSE_FORBIDDEN, errorBody);
    }
    return Utils.createResponse(RESPONSE_OK, { promotionLive: true });
};
