const { middyValidatorWrapper } = require('./middlewares/middyValidatorWrapper');
const Utils = require('./utility_functions/utilityFunctions');
const { getConfiguration } = require('./utility_functions/configUtilities');
const WinningMomentsTable = require('./database/winningMomentsTable');
const PromotionsUtils = require('./self_service/promotionsUtils');
const ReservedVoucherUtils = require('./utility_functions/reservedVoucherUtilities');
const DBUtils = require('./database/dbUtilities');
const PrizeCatalogueTable = require('./database/prizeCatalogueTable');
const { REQUIRED_PARAMETERS_FOR_LAMBDA } = require('./constants/lambdas');
const { RESPONSE_OK, RESPONSE_BAD_REQUEST } = require('./constants/responses');
const { WINNING_MOMENTS_STATUS } = require('./constants/common');
const { ERROR_CODES: { NOT_FOUND }, ERR_CODES: { WINNING_MOMENT_NOT_FOUND } } = require('./constants/errCodes');
/**
 * This lambda is for reverting the Winning moment if being rejected after no successful validation
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */

const rejectWinningMomentLambda = async (event) => {
    try {
        const params = Utils.extractParams(event);
        const transactItems = [];
        const participationItem = await ReservedVoucherUtils.revertParticipation(params.participationId, transactItems);
        let prizeQueryResponse;
        if (participationItem.redeemed_prize && participationItem.redeemed_prize.active_partition) {
            prizeQueryResponse = await PrizeCatalogueTable.mainQuery(participationItem.configuration_id, participationItem.prize_id);
        }
        await ReservedVoucherUtils.revertDigitalCode(participationItem, transactItems, prizeQueryResponse);
        const winningMoment = await rejectWinningMoment(participationItem, transactItems);
        await recreateWinningMoment(winningMoment, transactItems);
        updatePrizeCounters(participationItem, transactItems);
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

/**
 * Reject winning moment by configurationId, gppUserId, prizeId from the participationRecord
 * @param participationRecord
 */
const rejectWinningMoment = async (participationRecord, transactItems) => {
    const { configuration_id: configurationId, prize_id: prizeId, gpp_user_id: gppUserId } = participationRecord;

    const winningMomentItem = await WinningMomentsTable.getWinningMoment(
        configurationId,
        gppUserId,
        prizeId,
        WINNING_MOMENTS_STATUS.CLAIMED,
    );
    if (!winningMomentItem) {
        const errorBody = Utils.createErrBody(WINNING_MOMENT_NOT_FOUND, 'No such winning moment found!',
            undefined, NOT_FOUND);
        const errorResponse = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errorResponse;
    }
    transactItems.push(WinningMomentsTable.getUpdateWinningMomentStatusTransactionParams(
        winningMomentItem,
        WINNING_MOMENTS_STATUS.REJECTED,
    ));
    return winningMomentItem;
};

/**
 * Create winning moment based on the rejected winning moment with new gmtStart and available status
 * @param toBeRejectedWinningMoment
 * @param transactItems - array of transaction items
 */
const recreateWinningMoment = async (toBeRejectedWinningMoment, transactItems) => {
    const configurationId = toBeRejectedWinningMoment.configuration_id;
    const configData = await getConfiguration(configurationId);
    const expirationTimestamp = Utils.getExpirationTimestamp(configData);
    const promoEndTime = await PromotionsUtils.getMetadataParameter(configData.promotionId, 'promotion_end_utc');
    const newWinningMoment = {
        configurationId,
        gmtStart: getRandomWinningMomentTimestamp(promoEndTime),
        prizeId: toBeRejectedWinningMoment.prize_id,
        status: WINNING_MOMENTS_STATUS.AVAILABLE,
        tier: +toBeRejectedWinningMoment.tier,
        endOfConf: expirationTimestamp,
    };
    transactItems.push(WinningMomentsTable.getWinningMomentTransactionInsertParams(newWinningMoment));
    return newWinningMoment;
};

/**
 * Get Random WinningMoment Timestamp smaller than promotion end time and bigger than current time + 1hour
 * @param promoEndTime
 */
const getRandomWinningMomentTimestamp = (promoEndTime) => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    const nowPlus1 = now.getTime();

    return Utils.calculateTimestamp(nowPlus1, promoEndTime - nowPlus1, 100);
};

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

module.exports = {
    rejectWinningMomentLambda: middyValidatorWrapper(rejectWinningMomentLambda, REQUIRED_PARAMETERS_FOR_LAMBDA.rejectWinningMomentLambda),
};
