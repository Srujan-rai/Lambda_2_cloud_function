const { middyValidatorWrapper } = require('../../middlewares/middyValidatorWrapper');
const {
    arrayFromString,
    createErrorBody,
    extractParams,
    createResponse,
} = require('../../utility_functions/utilityFunctions');
const { getConfiguration } = require('../../utility_functions/configUtilities');
const { getMaxNumberOfParticipationIds } = require('../../self_service/configurationUtils');
const { changeStatusForOneVoucher } = require('../../database/digitalCodesTable');
const { queryByParticipationId } = require('../../database/participationsDatabase');
const { REQUIRED_PARAMETERS_FOR_LAMBDA } = require('../../constants/lambdas');
const { RESPONSE_OK, RESPONSE_BAD_REQUEST } = require('../../constants/responses');
const {
    ERROR_CODES: {
        REQUEST_PARAMETER_MISSING,
        FLOW_LAMBDA_REJECTION,
    },
} = require('../../constants/errCodes');
const { DIGITAL_CODES_STATUS } = require('../../constants/common');

/**
 * Change status from Reserved to Claimed Transaction
 * @param participationRecord
 */
const changeStatusFromReservedToClaimed = async (participationRecord) => {
    const { configuration_id: configurationId, redeemed_prize } = participationRecord;
    const { voucher_code: voucherCode, prize_id: prizeId } = redeemed_prize;
    const activePartition = redeemed_prize?.active_partition;
    const participationKey = {
        gpp_user_id: participationRecord.gpp_user_id,
        request_id: participationRecord.request_id,
    };

    return changeStatusForOneVoucher(configurationId, prizeId, voucherCode, DIGITAL_CODES_STATUS.RESERVED,
        DIGITAL_CODES_STATUS.CLAIMED, { claimTimestamp: new Date().getTime() }, participationKey, activePartition);
};

/**
 * Claim DigitalCode And Update Prize Counters
 * @param participationId
 */
const claimDigitalCodeAndUpdatePrizeCounters = async (participationId) => {
    try {
        const result = await queryByParticipationId(participationId);

        if (!result[0]) {
            throw new Error(`Participation with such id '${participationId}' was not found`);
        }
        await changeStatusFromReservedToClaimed(result[0]);
        return participationId;
    } catch (err) {
        console.log('Error: ', err);
        throw participationId;
    }
};

/**
 * Try claiming DigitalCodes from request.
 * @param {object} participationIdsParameter - participationIds from the request
 * @param {object} maxParticipationIds
 */
const claimDigitalCodes = async (participationIdsParameter, maxParticipationIds) => {
    const participationIds = arrayFromString(participationIdsParameter);

    if (!participationIds.length) {
        const errorBody = createErrorBody(REQUEST_PARAMETER_MISSING, 'No participation ids in request!');
        const errorResponse = createResponse(RESPONSE_BAD_REQUEST, errorBody);
        return Promise.reject(errorResponse);
    }

    if (maxParticipationIds && participationIds.length > +maxParticipationIds) {
        const errorBody = createErrorBody(FLOW_LAMBDA_REJECTION, 'Maximum allowed participation ids exceeded!');
        const errorResponse = createResponse(RESPONSE_BAD_REQUEST, errorBody);
        return Promise.reject(errorResponse);
    }

    const promises = [];
    for (let i = 0; i < participationIds.length; i++) {
        promises.push(claimDigitalCodeAndUpdatePrizeCounters(participationIds[i]));
    }

    try {
        const results = await Promise.allSettled(promises);
        const fulfilledUpdates = [];
        const rejectedUpdates = [];

        results.forEach((result) => {
            if (result.status === 'fulfilled') {
                fulfilledUpdates.push(result.value);
            } else {
                rejectedUpdates.push(result.reason);
            }
        });

        console.log('fulfilledUpdates: ', fulfilledUpdates);
        console.log('rejectedUpdates: ', rejectedUpdates);
        return { fulfilledUpdates, rejectedUpdates };
    } catch (err) {
        console.log('allSettled error: ', err);
        throw err;
    }
};

/**
 * Lambda handler. Marks specified voucher as 'claimed' as well as updating Prize Counters
 *
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
const acceptReservedVoucherLambda = async (event) => {
    try {
        const params = extractParams(event);
        const configuration = await getConfiguration(params.configurationId, event);
        const maxParticipationIds = await getMaxNumberOfParticipationIds(configuration, params.flowLabel);
        const updatedRecords = await claimDigitalCodes(params.participationIds, maxParticipationIds);
        const responseBody = {
            message: updatedRecords.rejectedUpdates.length ? 'Some vouchers were not successfully claimed!' : 'All vouchers were successfully claimed!',
            updatedRecords,
        };
        const response = createResponse(RESPONSE_OK, responseBody);
        return response;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', errorResponse);
        return errorResponse;
    }
};

module.exports = {
    acceptReservedVoucherLambda: middyValidatorWrapper(acceptReservedVoucherLambda,
        REQUIRED_PARAMETERS_FOR_LAMBDA.acceptReservedVoucherLambda),
};
