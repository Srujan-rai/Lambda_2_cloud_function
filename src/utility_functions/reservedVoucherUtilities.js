const { createErrBody, createResponse } = require('./utilityFunctions');
const { queryByParticipationId, getParticipationStatusTransactionParams } = require('../database/participationsDatabase');
const {
    mainQuery,
    getRevertDigitalCodePartitionedTransactionParams,
    getRevertDigitalCodeTransactionParams,
} = require('../database/digitalCodesTable');
const { ERR_CODES, ERROR_CODES } = require('../constants/errCodes');
const { RESPONSE_BAD_REQUEST } = require('../constants/responses');
const { DIGITAL_CODES_STATUS } = require('../constants/common');
/**
 * Revert digital code which is in reserved status by prizeId and voucherCode from the participationRecord
 * @param participationRecord
 * @param transactItems - array of transaction items
 */
const revertDigitalCode = async (participationRecord, transactItems, prizeQueryResponse) => {
    // eslint-disable-next-line prefer-const
    let { redeemed_prize: { prize_id: prizeId, voucher_code: voucherCode, active_partition: activePartition } } = participationRecord;
    let basePrizeId;

    if (activePartition && !prizeQueryResponse[0]) {
        const errorBody = createErrBody(ERR_CODES.IW_DIGITAL_CODE_NOT_FOUND, 'Prize not found!',
            undefined, ERROR_CODES.NOT_FOUND);
        const errorResponse = createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errorResponse;
    }
    const currentActivePartition = prizeQueryResponse ? prizeQueryResponse[0].active_partition : undefined;

    if (activePartition) {
        basePrizeId = prizeId;
        prizeId = `${prizeId}-${activePartition}`;
    }
    const result = await mainQuery(prizeId, voucherCode);

    if (!result[0]) {
        const errorBody = createErrBody(ERR_CODES.IW_DIGITAL_CODE_NOT_FOUND, 'No digital code found!',
            undefined, ERROR_CODES.NOT_FOUND);
        const errorResponse = createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errorResponse;
    } else if (result[0].voucher_status !== 'reserved') {
        const errorBody = createErrBody(ERR_CODES.IRREVERSIBLE_IW_VOUCHER, 'Unable to revert digital code!',
            undefined, ERROR_CODES.INVALID_PARAMETER);
        const errorResponse = createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errorResponse;
    }

    const digitalCode = result[0];
    if (activePartition !== currentActivePartition) {
        const arrayOfTransactItems = getRevertDigitalCodePartitionedTransactionParams(digitalCode, currentActivePartition, basePrizeId);
        arrayOfTransactItems.forEach((item) => transactItems.push(item));
    } else {
        transactItems.push(getRevertDigitalCodeTransactionParams(prizeId, voucherCode, DIGITAL_CODES_STATUS.AVAILABLE));
    }
    return digitalCode;
};

/**
 * Revert only valid (instant_win_winner == true) participation by participationId
 * @param participationId - data that we receive from request
 * @param transactItems - array of transaction items
 */
const revertParticipation = async (participationId, transactItems) => {
    const result = await queryByParticipationId(participationId);
    if (!result[0]) {
        const errorBody = createErrBody(ERR_CODES.IW_PARTICIPATION_NOT_FOUND, 'No participation with such id found!',
            undefined, ERROR_CODES.NOT_FOUND);
        const errorResponse = createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errorResponse;
    } else if (!result[0].instant_win_winner) {
        const errorBody = createErrBody(ERR_CODES.IRREVERSIBLE_IW_PARTICIPATION, 'Only a winning participation can be reverted!',
            undefined, ERROR_CODES.IRREVERSIBLE_PARTICIPATION);
        const errorResponse = createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errorResponse;
    }

    const participationItem = result[0];
    const { request_id: requestId, gpp_user_id: gppUserId } = participationItem;
    transactItems.push(getParticipationStatusTransactionParams(gppUserId, requestId, 'reverted'));
    return participationItem;
};

module.exports = {
    revertDigitalCode,
    revertParticipation,
};
