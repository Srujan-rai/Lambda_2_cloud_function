const { middyValidatorWrapper } = require('../../middlewares/middyValidatorWrapper');
const Utils = require('../../utility_functions/utilityFunctions');
const DigitalCodes = require('../../database/digitalCodesTable');
const PrizeCatalogue = require('../../database/prizeCatalogueTable');
const { REQUIRED_PARAMETERS_FOR_LAMBDA } = require('../../constants/lambdas');
const { PARAMS_MAP: { PRIZE_ID, AMOUNT, CONFIGURATION_ID } } = require('../../constants/common');
const { RESPONSE_OK } = require('../../constants/responses');

/**
 * Validates provided parameters
 *
 * @param {Object} params - parameters provided
 *
 * @return {Promise} resolved if parameters are valid, rejected if there is invalid parameter
 */
const validateParameters = (params) => {
    if (Number.isInteger(params[AMOUNT]) && params[AMOUNT] > 0) {
        return Promise.resolve(params);
    }
    return Promise.reject(Utils.createResponseInvalidParameter([AMOUNT]));
};

/**
 * Lambda handler. Marks specified amount of digital codes (for specified prize/configuration) as removed.
 *
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
const baseDigitalCodesRemoverLambda = async (event) => {
    try {
        const params = Utils.extractParams(event);
        let successAmount = 0;
        await validateParameters(params);
        const resultArray = await DigitalCodes.markAsRemoved(params[PRIZE_ID], params[AMOUNT]);
        successAmount = resultArray.filter((result) => result.status === 'fulfilled').length;
        const updatedValues = await PrizeCatalogue.updateCountersForRemovedPrize(params[CONFIGURATION_ID], params[PRIZE_ID], successAmount);
        console.log('Rows updated! Count:', successAmount);
        console.log('updatedValues: ', JSON.stringify(updatedValues));
        const responseBody = {
            message: 'Successfully removed vouchers!',
            digitalCodesRowsUpdatedCount: successAmount,
            totalAvailable: updatedValues.Attributes.total_available,
        };
        return Utils.createResponse(RESPONSE_OK, responseBody);
    } catch (err) {
        console.error('ERROR: Failed to update digital codes status:\n', err);
        return err;
    }
};

module.exports = {
    digitalCodesRemoverLambda: middyValidatorWrapper(baseDigitalCodesRemoverLambda,
        REQUIRED_PARAMETERS_FOR_LAMBDA.digitalCodesRemoverLambda),
};
