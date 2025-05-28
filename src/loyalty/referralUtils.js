const { GPP_REFERRAL_RECORDS_LOCK } = require('../constants/tableNames');
const { get, putItem } = require('../database/dbUtilities');

/**
 * Validates and sets a lock in DynamoDB based on the provided parameters.
 * @param {Object} params - The parameters object containing the necessary data.
 * @param {string} params.azp - The authorized party - experience id.
 * @param {string} params.userId - The referee hashed_kocid
 * @param {string} params.ref_hashed_kocid - The referrer hashed_kocid.
 * @param {string} params.ref_code - The referral code.
 * @param {number} params.exp - The token expiration time in seconds.
 * @returns {Promise<void>}
 */
const validateAndSetLock = async (params) => {
    const {
        azp, userId, ref_hashed_kocid, ref_code, exp,
    } = params;
    const sparseKey = `${azp}#${ref_hashed_kocid}#${userId}`;
    await checkRecordLock(sparseKey);
    await createRecordLock(sparseKey, ref_code, exp);
};

/**
 * Checks if a record lock exists for a given sparse key.
 * @param {string} ref_id - The key to check for an existing lock.
 * @returns {Promise<void>}
 */
const checkRecordLock = async (ref_id) => {
    const getParams = {
        TableName: GPP_REFERRAL_RECORDS_LOCK,
        Key: {
            ref_id,
        },
    };
    const result = await get(getParams);
    if (result.length && result[0].expireAt > Math.round(new Date() / 1000)) {
        throw new Error('Referral code was already used');
    }
};

/**
 * Creates a record lock for a given sparse key.
 * @param {string} ref_id - The key for the record lock.
 * @param {string} referral_code - The referral code.
 * @param {number} exp - The token expiration time in seconds.
 * @returns {Promise<void>}
 */
const createRecordLock = (ref_id, referral_code, exp) => {
    const putParams = {
        TableName: GPP_REFERRAL_RECORDS_LOCK,
        Item: {
            ref_id,
            ref_code: referral_code,
            expireAt: parseInt(exp),
        },
    };
    return putItem(putParams);
};

module.exports = {
    validateAndSetLock,
};
