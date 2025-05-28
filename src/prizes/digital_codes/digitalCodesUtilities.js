const { localizedQueryByPrizeId } = require('../../database/prizeCatalogueTable');
const {
    createResponseInvalidVoucherStatus,
    createResponseUnknownError,
} = require('../../utility_functions/utilityFunctions');
const {
    PARAMS_MAP: { RICHTEXT_RESPONSE_TYPE, LANGUAGE },
    PARAMS_MAP,
    DIGITAL_CODES_STATUS,
    PRIZE_CATALOGUE_COUNTERS,
} = require('../../constants/common');
const { getConfiguration } = require('../../utility_functions/configUtilities');

/**
 * Joins digital codes query result and prize catalogue query results
 *
 * @param {Object} params - HTTP request parameters (POST body)
 * @param {Array<Object>} vouchersArray - array of vouchers (result of digital codes query)
 * @param {String} configuration - actual configuration (JSON). Used for localization purposes.
 *
 * @returns {Promise} Array of objects containing both prize catalogue and digital codes data
 */
const joinWithPrizeDetails = async (params, vouchersArray, configuration, event) => {
    // if prizeId contains -activePartition in the end -> remove it
    const regex = /([-]\d*)/;
    const localizedPrizes = {};
    const finalResult = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const voucher of vouchersArray) {
        if (voucher.prize_id.includes('-')) {
            voucher.prize_id = voucher.prize_id.replace(regex, '');
        }
        const result = { ...voucher };
        if (localizedPrizes[voucher.prize_id]) {
            const localizedPrize = localizedPrizes[voucher.prize_id];
            Object.assign(result, localizedPrize);
        } else {
            let config = configuration;
            if (!config && event) {
                config = await getConfiguration(voucher.configuration_id, event);
            }
            const queryResult = await localizedQueryByPrizeId(
                config,
                voucher.prize_id,
                params[RICHTEXT_RESPONSE_TYPE],
                params[LANGUAGE],
            );
            if (queryResult && queryResult.length) {
                localizedPrizes[voucher.prize_id] = queryResult[0];
                Object.assign(result, queryResult[0]);
            }
        }
        if (result.barcode_type !== 0) {
            result.barcode_url = getBarcodeUrl(voucher);
        }
        finalResult.push(result);
    }

    return finalResult;
};

/**
 * Returns link to the saved voucher
 * @param {Object} voucher - object with voucher info
 * @returns {String} barcode url
 */
const getBarcodeUrl = (voucher) => {
    const publicUri = process.env.cloudFrontPublicUri !== 'undefined' ? process.env.cloudFrontPublicUri : `https://${process.env.PUBLIC_BUCKET}.s3-${process.env.regionName}.amazonaws.com`;
    return `${publicUri}/${voucher.configuration_id}/${voucher.prize_id}/barcodes/${voucher.prize_id}_${encodeURIComponent(voucher.voucher)}`;
};

/**
* Determines the new status for a voucher
* based on the selectedStatus parameter from the request
* @param {object} params request params
* @returns {string}
* */

const determineNewStatus = (params) => {
    const selectedStatus = params[PARAMS_MAP.SELECTED_STATUS];
    if (!selectedStatus) {
        return DIGITAL_CODES_STATUS.REDEEMED;
    }

    const upperCaseStatus = selectedStatus.toUpperCase();
    if (!DIGITAL_CODES_STATUS[upperCaseStatus]) {
        throw createResponseInvalidVoucherStatus(selectedStatus);
    }

    return DIGITAL_CODES_STATUS[upperCaseStatus];
};

/**
 * Function that determines which counters will be
 * incremented/decremented based on the oldStatus of digital code
 * @param {string}
 * */

const defineCountersToUpdate = (oldStatus) => {
    if (!oldStatus) {
        throw createResponseUnknownError();
    }

    if (oldStatus === DIGITAL_CODES_STATUS.LOCKED) {
        return PRIZE_CATALOGUE_COUNTERS.TOTAL_CLAIMED;
    }

    const counterName = `TOTAL_${oldStatus.toUpperCase()}`;
    const columToDecrement = PRIZE_CATALOGUE_COUNTERS[counterName];
    return columToDecrement;
};

module.exports = {
    joinWithPrizeDetails,
    determineNewStatus,
    defineCountersToUpdate,
};
