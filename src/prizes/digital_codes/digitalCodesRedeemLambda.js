const { middyValidatorWrapper } = require('../../middlewares/middyValidatorWrapper');
const Utils = require('../../utility_functions/utilityFunctions');
const DBUtils = require('../../database/dbUtilities');
const DigitalCodes = require('../../database/digitalCodesTable');
const PrizeCatalogue = require('../../database/prizeCatalogueTable');
const digitalCodesUtils = require('./digitalCodesUtilities');
const { updateParticipationRedeemedPrizeStatusTransaction } = require('../../database/participationsDatabase');

const { REQUIRED_PARAMETERS_FOR_LAMBDA } = require('../../constants/lambdas');
const { PARAMS_MAP, DIGITAL_CODES_STATUS } = require('../../constants/common');
const { RESPONSE_OK } = require('../../constants/responses');

/**
 * Gets array of invalid parameters
 *
 * @param {Object} params - parameters received via event
 *
 * @returns {Array} list of invalid parameters.
 */
const getInvalidParameters = (params) => {
    const stringAttributes = [
        PARAMS_MAP.PRIZE_ID,
        PARAMS_MAP.VOUCHER,
        PARAMS_MAP.REDEMPTION_APP_USER,
        PARAMS_MAP.OUTLET_ID,
        PARAMS_MAP.OUTLET_NAME,
    ];
    return Utils.getInvalidStringParameters(params, stringAttributes);
};

/**
 * Lambda handler. Marks specified voucher as 'redeemed' as well as adding some additional redeem information to a voucher record
 *
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
const baseDigitalCodesRedeemLambda = async (event) => {
    try {
        const params = await Utils.safeExtractParams(event);

        const invalidParameters = getInvalidParameters(params);
        if (invalidParameters && invalidParameters.length > 0) {
            const errResponse = Utils.createResponseInvalidParameter(invalidParameters);
            throw errResponse;
        }

        const queryResult = await DigitalCodes.getVoucherPrizeId(
            params[PARAMS_MAP.VOUCHER],
            params[PARAMS_MAP.CONFIGURATION_ID],
            params[PARAMS_MAP.PRIZE_ID],
        );

        // if prize uses partitions -> get correct prizeId for this voucher
        if (queryResult.length === 0) {
            throw Utils.createResponseCantRedeemVoucher(params[PARAMS_MAP.PRIZE_ID], params[PARAMS_MAP.VOUCHER]);
        }
        const prizeId = queryResult[0].prize_id;

        //  if the request does not contain selectedStatus a regular redemption will be done
        const newStatus = digitalCodesUtils.determineNewStatus(params);
        const oldValues = await DigitalCodes.redeemDigitalCode(
            prizeId,
            params[PARAMS_MAP.VOUCHER],
            params[PARAMS_MAP.OUTLET_ID],
            params[PARAMS_MAP.OUTLET_NAME],
            params[PARAMS_MAP.REDEMPTION_APP_USER],
            newStatus,
        );
        console.log('Voucher moved to status:', newStatus);

        if (newStatus === DIGITAL_CODES_STATUS.REDEEMED) {
            const oldStatus = oldValues.Attributes.voucher_status;
            const columnToDecrement = digitalCodesUtils.defineCountersToUpdate(oldStatus);

            await PrizeCatalogue.updateCountersForRedeemedPrize(
                oldValues.Attributes.configuration_id,
                params[PARAMS_MAP.PRIZE_ID],
                1,
                columnToDecrement,
            );
        }

        if (oldValues.Attributes.request_id && oldValues.Attributes.gpp_user_id) {
            await DBUtils.update(updateParticipationRedeemedPrizeStatusTransaction(
                { request_id: oldValues.Attributes.request_id, gpp_user_id: oldValues.Attributes.gpp_user_id },
                newStatus,
            ));
        }

        const body = {
            message: `Successfully ${newStatus} a voucher`,
            prizeId: params[PARAMS_MAP.PRIZE_ID],
            voucher: params[PARAMS_MAP.VOUCHER],
        };
        const response = Utils.createResponse(RESPONSE_OK, body);
        console.log('Returning success response..');
        return response;
    } catch (error) {
        console.log(`ERROR: Returning error response:\n${JSON.stringify(error)}`);
        return error;
    }
};

module.exports = {
    digitalCodesRedeemLambda: middyValidatorWrapper(baseDigitalCodesRedeemLambda, REQUIRED_PARAMETERS_FOR_LAMBDA.digitalCodesRedeemLambda),
};
