const CryptoJS = require('crypto-js');
const { middyValidatorWrapper } = require('../../middlewares/middyValidatorWrapper');
const Utils = require('../../utility_functions/utilityFunctions');
const DigitalCodes = require('../../database/digitalCodesTable');
const DigitalCodesUtils = require('./digitalCodesUtilities');
const { getParametersFromSSM } = require('../../utility_functions/aws_sdk_utils/ssmUtilities');
const { getConfiguration, setupGppUserId } = require('../../utility_functions/configUtilities');

const { REQUIRED_PARAMETERS_FOR_LAMBDA } = require('../../constants/lambdas');
const { RESPONSE_OK } = require('../../constants/responses');
const { PARAMS_MAP, DIGITAL_CODES_STATUS } = require('../../constants/common');

const symetricCacheObject = () => {
    let privateSymmetricKey = '';
    return Object.freeze({
        get key() {
            return privateSymmetricKey;
        },
        async setKeyFromSSM() {
            const { nextTokenSymmetricKey } = await getParametersFromSSM('nextTokenSymmetricKey');
            privateSymmetricKey = nextTokenSymmetricKey;
        },
    });
};

let symetricCache;

/**
 * Lambda handler. Queries digital codes based on - userId + configurationId + allowed statuses
 *
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */

const baseDigitalCodesQueryByUserLambda = async (event) => {
    try {
        const params = Utils.extractParams(event);

        if (params.allowedVoucherStatuses && event.httpMethod === 'GET') {
            params.allowedVoucherStatuses = JSON.parse(params.allowedVoucherStatuses);
        }

        await validateParameters(params);
        const configIdsArr = getRequestConfigs(params);

        const { digtalCodesArr, cursor } = await processQueryForConfigs(event, params, configIdsArr);

        const response = Utils.createResponse(RESPONSE_OK, { vouchers: digtalCodesArr, cursor });
        console.log('Success! Returning response...');
        return response;
    } catch (error) {
        console.log(`ERROR occurred. Returning object: ${JSON.stringify(error)}`);
        return error;
    }
};

/**
 * Query digital codes and join with prize details
 *
 * @param {Object} params - HTTP body parameters
 * @param {Object} configuration - config object
 * @returns {Promise}
 */
const queryAndJoinWithPrizeDetails = async (params, configuration) => {
    const queryRequestToken = params.decryptedToken
        && params.decryptedToken[configuration[PARAMS_MAP.CONFIGURATION_ID]];
    const { dataReceived: vouchersArray, nextKey } = params?.sortByClaimstamp
        ? await DigitalCodes.queryByUserIdSortByClaimstamp(
            params[PARAMS_MAP.GPP_USER_ID],
            params[PARAMS_MAP.LIMIT],
            params[PARAMS_MAP.SORT_ORDER],
            params?.expiredStatusToFetch,
            queryRequestToken,
        )
        : await DigitalCodes.queryByUserId(
            params[PARAMS_MAP.GPP_USER_ID],
            configuration[PARAMS_MAP.CONFIGURATION_ID],
            params[PARAMS_MAP.ALLOWED_VOUCHER_STATUSES],
            params[PARAMS_MAP.LIMIT],
            queryRequestToken,
        );
    const itemsArray = await DigitalCodesUtils.joinWithPrizeDetails(params, vouchersArray, configuration);
    return { digitalCodes: itemsArray.map((res) => filterAndFormatResultItem(res)), nextKey };
};

const getRequestConfigs = (params) => {
    let configIdsArr = [params[PARAMS_MAP.CONFIGURATION_ID]];
    if (params[PARAMS_MAP.CONFIGURATION_IDS] && !params?.sortByClaimstamp) {
        configIdsArr.push(...params[PARAMS_MAP.CONFIGURATION_IDS].split(/[ ,]+/));
        configIdsArr = Array.from(new Set(configIdsArr));
    }
    return configIdsArr;
};

const processQueryForConfigs = async (event, params, configIdsArr) => {
    const digtalCodesArr = [];
    let nextTokenMap;
    let cursor;
    const eventParams = { ...params };

    if (!symetricCache && params[PARAMS_MAP.LIMIT]) {
        symetricCache = symetricCacheObject();
        await symetricCache.setKeyFromSSM();
    }

    if (params[PARAMS_MAP.NEXT_TOKEN]) {
        eventParams.decryptedToken = decryptNextToken(params);
    }

    await Promise.allSettled(configIdsArr.map(async (configId) => {
        if (eventParams.decryptedToken && !eventParams.decryptedToken[configId]) {
            return Promise.resolve();
        }
        const configuration = await getConfiguration(configId, event);
        setupGppUserId(eventParams, configuration, params?.userMigrated);
        const result = await queryAndJoinWithPrizeDetails(eventParams, configuration);
        digtalCodesArr.push(...result.digitalCodes);
        if (result.nextKey) {
            nextTokenMap = { ...nextTokenMap, [configId]: result.nextKey };
        }
    }));
    if (nextTokenMap) {
        cursor = { nextToken: CryptoJS.AES.encrypt(JSON.stringify(nextTokenMap), symetricCache.key).toString() };
    }

    return { digtalCodesArr, cursor };
};

/**
 * Validates received (HTTP body) parameters
 *
 * @param {Object} params - HTTP body parameters
 *
 * @returns {Promise} rejected with HTTP error response, or resolved with {@param params}
 */
function validateParameters(params) {
    const invalidParams = Utils.getInvalidStringParameters(params,
        [PARAMS_MAP.CONFIGURATION_ID,
            PARAMS_MAP.FLOW_LABEL,
            PARAMS_MAP.USER_ID]);

    if (!isAllowedVoucherStatusesValid(params[PARAMS_MAP.ALLOWED_VOUCHER_STATUSES])) {
        invalidParams.push(PARAMS_MAP.ALLOWED_VOUCHER_STATUSES);
    }

    if (isNotvalidLimitParam(params[PARAMS_MAP.LIMIT])) {
        invalidParams.push(PARAMS_MAP.LIMIT);
    }

    if (isNotValidNextToken(params)) {
        invalidParams.push(PARAMS_MAP.LIMIT);
    }

    if (invalidParams.length > 0) {
        return Promise.reject(Utils.createResponseInvalidParameter(invalidParams));
    }
    return Promise.resolve(params);
}

/**
 * Validates 'allowedVoucherStatuses' parameter. Needs to be array, and all elements need to be values that exist in backend definition.
 *
 * @param {Array} allowedVoucherStatuses - specific HTTP (optional) body parameter
 *
 * @returns {Boolean} true if valid, false if invalid
 */
function isAllowedVoucherStatusesValid(allowedVoucherStatuses) {
    if (allowedVoucherStatuses === undefined) {
        // parameter is optional, undefined is valid value
        return true;
    }

    if (!Array.isArray(allowedVoucherStatuses)) {
        return false;
    }

    for (let i = 0; i < allowedVoucherStatuses.length; i++) {
        if (!Utils.isValidString(allowedVoucherStatuses[i]) || !Object.values(DIGITAL_CODES_STATUS).includes(allowedVoucherStatuses[i])) {
            return false;
        }
    }
    return true;
}

const isNotvalidLimitParam = (limit) => limit && (!Number.isInteger(limit) || limit < 1 || limit > 5000);

const isNotValidNextToken = (params) => params[PARAMS_MAP.NEXT_TOKEN] && !params[PARAMS_MAP.LIMIT];

const decryptNextToken = (params) => {
    console.log('Next token provided. Decrypting...');

    return JSON.parse(
        CryptoJS.AES.decrypt(params[PARAMS_MAP.NEXT_TOKEN], symetricCache.key).toString(CryptoJS.enc.Utf8));
};

/**
 * Takes response suitable subset of object with data from both digital codes table and prize catalogue table.
 *
 * @param {Object} item - object holding data from digital codes table and prize catalogue table.
 *
 * @returns {Object} Subset of {@param item}, with renamed keys.
 */
function filterAndFormatResultItem(item) {
    return {
        prizeId: item.prize_id,
        voucher: item.voucher,
        name: item.name,
        shortDescription: item.short_desc,
        redeemDescription: item.redeem_desc,
        redemptionLink: item.redemption_link,
        imgUrl: item.img_url,
        barcodeType: item.barcode_type,
        barcodeUrl: item.barcode_url,
        voucherStatus: item.voucher_status,
        prizeName: item.name,
        description: item.desc,
        redeemTimestamp: item.redeem_timestamp,
        claimTimestamp: item.claim_timestamp,
        expiryDate: item.expiry_date,
        tags: item.tags,
    };
}

module.exports = {
    digitalCodesQueryByUserLambda: middyValidatorWrapper(baseDigitalCodesQueryByUserLambda,
        REQUIRED_PARAMETERS_FOR_LAMBDA.digitalCodesQueryByUserLambda),
};
