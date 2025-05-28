const { middyValidatorWrapper } = require('../../middlewares/middyValidatorWrapper');
const Utils = require('../../utility_functions/utilityFunctions');
const ReservedVoucherUtils = require('../../utility_functions/reservedVoucherUtilities');
const DBUtils = require('../../database/dbUtilities');
const PrizeCatalogueTable = require('../../database/prizeCatalogueTable');
const { REQUIRED_PARAMETERS_FOR_LAMBDA } = require('../../constants/lambdas');
const { RESPONSE_OK } = require('../../constants/responses');

/**
 * This function will revert the prize counters for the prizeID and configurationID passed in from @param participationItem.
 * @param participationItem - participation extracted from the participation's table
 * @param transactItems[Array] - an array made up of statements to be passed to Dynamo DB\
 * @returns {Object} - The updateParams from getReservedAndClaimedCountersUpdateParams
 */
const updatePrizeCounters = async (participationItem, transactItems) => {
    const { configuration_id: configurationId, prize_id: prizeId } = participationItem;
    const updateParam = PrizeCatalogueTable.getReservedAndClaimedCountersUpdateParams(configurationId, prizeId, 1);

    transactItems.push(updateParam);

    return updateParam;
};

/**
 * This lambda is for reverting the reserved voucher if being rejected after  unsuccessful validation
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
const baseRejectReservedVoucherLambda = async (event) => {
    try {
        const params = Utils.extractParams(event);
        const transactItems = [];
        const participationItem = await ReservedVoucherUtils.revertParticipation(params.participationId, transactItems);
        let prizeQueryResponse;

        if (participationItem.redeemed_prize && participationItem.redeemed_prize.active_partition) {
            prizeQueryResponse = await PrizeCatalogueTable.mainQuery(participationItem.configuration_id, participationItem.prize_id);
        }

        await ReservedVoucherUtils.revertDigitalCode(participationItem, transactItems, prizeQueryResponse);
        await updatePrizeCounters(participationItem, transactItems);
        await DBUtils.transactWrite({ TransactItems: transactItems });

        const responseBody = {
            message: 'InstantWin was successfully reverted!',
        };
        const response = Utils.createResponse(RESPONSE_OK, responseBody);
        return response;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', errorResponse);
        return errorResponse;
    }
};

module.exports = {
    rejectReservedVoucherLambda: middyValidatorWrapper(baseRejectReservedVoucherLambda,
        REQUIRED_PARAMETERS_FOR_LAMBDA.rejectReservedVoucherLambda),
};
