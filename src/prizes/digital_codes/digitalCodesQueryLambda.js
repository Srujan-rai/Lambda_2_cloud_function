const { middyValidatorWrapper } = require('../../middlewares/middyValidatorWrapper');
const Utils = require('../../utility_functions/utilityFunctions');
const { getConfiguration } = require('../../utility_functions/configUtilities');
const DigitalCodes = require('../../database/digitalCodesTable');
const DigitalCodesUtils = require('./digitalCodesUtilities');
const { REQUIRED_PARAMETERS_FOR_LAMBDA } = require('../../constants/lambdas');
const { PARAMS_MAP: { CONFIGURATION_ID, VOUCHER } } = require('../../constants/common');
const { RESPONSE_OK } = require('../../constants/responses');

/**
 * Takes response suitable subset of object with data from both digital codes table and prize catalogue table.
 *
 * @param {Object} item - object holding data from digital codes table and prize catalogue table.
 *
 * @returns {Object} Subset of {@param item}, with renamed keys.
 */
const filterAndFormatResultItem = (item) => ({
    voucher: item.voucher,
    voucherStatus: item.voucher_status,
    prizeName: item.name,
    prizeId: item.prize_id,
    redeemTimestamp: item.redeem_timestamp,
    claimTimestamp: item.claim_timestamp,
    expiryDate: item.expiry_date,
});

/**
 * Lambda handler. Queries digital codes based only on voucher string (can have more matches due to non-unique voucher strings)
 *
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
const baseDigitalCodesQueryLambda = async (event) => {
    try {
        const params = Utils.extractParams(event);
        const configuration = await getConfiguration(params[CONFIGURATION_ID], event);
        const vouchersArray = await DigitalCodes.queryWithStatusCondition(params[VOUCHER]);

        if (!vouchersArray || !vouchersArray.length) {
            throw Utils.createResponseVoucherNotFound(params[VOUCHER]);
        }

        const resultsArray = await DigitalCodesUtils.joinWithPrizeDetails(params, vouchersArray, configuration);
        const filteredVoucherDetailsArray = await resultsArray.map((result) => filterAndFormatResultItem(result));

        const response = Utils.createResponse(RESPONSE_OK, { vouchers: filteredVoucherDetailsArray });
        console.log('Returning response...');
        return response;
    } catch (error) {
        console.log(`ERROR occurred. Returning object: ${JSON.stringify(error)}`);
        return error;
    }
};

module.exports = {
    digitalCodesQueryLambda: middyValidatorWrapper(baseDigitalCodesQueryLambda, REQUIRED_PARAMETERS_FOR_LAMBDA.digitalCodesQueryLambda),
};
