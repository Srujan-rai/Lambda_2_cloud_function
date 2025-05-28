const middy = require('@middy/core');
const CryptoJS = require('crypto-js');
const { RESPONSE_OK, RESPONSE_BAD_REQUEST } = require('../../constants/responses');
const Utils = require('../../utility_functions/utilityFunctions');
const DigitalCodes = require('../../database/digitalCodesTable');
const DigitalCodesUtils = require('./digitalCodesUtilities');
const { getParametersFromSSM } = require('../../utility_functions/aws_sdk_utils/ssmUtilities');
const { PARAMS_MAP, DIGITAL_CODES_STATUS } = require('../../constants/common');
const { REQUIRED_PARAMETERS_FOR_LAMBDA } = require('../../constants/lambdas');
const { checkIfUserMigrated } = require('../../userMigration/cdsMigrationUtils');
const { extractRequestData } = require('../../middlewares/extractRequestData');
const { ERROR_CODES, ERR_CODES } = require('../../constants/errCodes');

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
 * Lambda handler. Queries digital codes based on userId + allowed statuses
 *
 * @param event - data that we receive from request
 * @returns {Array<object>} vouchers with status 200 or http error
 */
const digitalCodesQueryByUserLambdaV2 = async (event) => {
    try {
        const params = parseParams(event);
        Utils.checkPassedParameters(params, REQUIRED_PARAMETERS_FOR_LAMBDA.digitalCodesQueryByUserLambdaV2);
        await validateParameters(params);
        if (process.env.migrateUsers === 'true') {
            params.userMigrated = await checkIfUserMigrated(params);
        }
        const { digitalCodesArr, cursor } = await processAndGetData(params, event);
        const res = Utils.createResponse(RESPONSE_OK, { vouchers: digitalCodesArr, cursor });
        console.log('Success! Returning response...');
        return res;
    } catch (error) {
        console.log(`ERROR occurred. Returning object: ${JSON.stringify(error)}`);
        return error;
    }
};

/**
 * If a object from the schema is in the body parse it.
 *
 * @param {object} event
 * @returns {object} params
 */
const parseParams = (event) => {
    const params = event.body;
    const schema = {
        limit: Number,
        sortByClaimstamp: Boolean,
        tags: Boolean,
        allowedVoucherStatuses: commaSeparatedStringToArray,
        nextToken: decodeURIComponent,
    };
    Object.entries(schema).forEach(([key, parse]) => {
        if (key in params) {
            params[key] = parse(params[key]);
        }
    });
    return params;
};

/**
 * Validates received parameters
 *
 * @param {Object} params - parameters
 * @returns {Promise} rejected with HTTP error response, or resolved with {@param params}
 */
const validateParameters = (params) => {
    const invalidParams = Utils.getInvalidStringParameters(params, [PARAMS_MAP.USER_ID]);
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
};

/**
 * This function queries for digital codes and combines them with data about the prize.
 * Provides nextKey token if there is limit.
 *
 * @param {object} params - parameters from the event body
 * @param {string} suffix - cds or cid suffix
 * @param {object} event - the whole event object
 * @returns {object} - digital codes array, each obj combined with prize data and nextKey token if there is limit
 */
const queryAndJoinWithPrizeDetails = async (params, suffix, event) => {
    const queryRequestToken = params.decryptedToken
        && params.decryptedToken[suffix];
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
            undefined,
            params[PARAMS_MAP.ALLOWED_VOUCHER_STATUSES],
            params[PARAMS_MAP.LIMIT],
            queryRequestToken,
        );
    const itemsArray = await DigitalCodesUtils.joinWithPrizeDetails(params, vouchersArray, undefined, event);
    return { digitalCodes: itemsArray.map((res) => filterAndFormatResultItem(res)), nextKey };
};

/**
 * This function gets the combined data and returns it as an array. Encrypts nextToken
 * if there is pagination.
 *
 * @param {object} params
 * @param {object} event
 * @returns object containing digital codes array and cursor object which contains the nextToken
 */

const processAndGetData = async (params, event) => {
    const digitalCodesArr = [];
    const suffixes = ('userMigrated' in params && params.userMigrated) ? ['cds'] : ['cds', 'cid'];
    let nextTokenMap;
    let cursor;
    if (!symetricCache && params[PARAMS_MAP.LIMIT]) {
        symetricCache = symetricCacheObject();
        await symetricCache.setKeyFromSSM();
    }
    if (params[PARAMS_MAP.NEXT_TOKEN]) params.decryptedToken = decryptNextToken(params);
    await Promise.allSettled(suffixes.map(async (suffix) => {
        if (params.decryptedToken && !params.decryptedToken[suffix]) return Promise.resolve();
        params.gppUserId = Utils.concatenateColumnValues(params[PARAMS_MAP.USER_ID], suffix);
        const { digitalCodes, nextKey } = await queryAndJoinWithPrizeDetails(params, suffix, event);
        digitalCodesArr.push(...digitalCodes);
        if (nextKey) nextTokenMap = { ...nextTokenMap, [suffix]: nextKey };
    }));
    if (nextTokenMap) {
        cursor = { nextToken: CryptoJS.AES.encrypt(JSON.stringify(nextTokenMap), symetricCache.key).toString() };
    }
    return { digitalCodesArr, cursor };
};

/**
 * Validates 'allowedVoucherStatuses' parameter. Needs to be array, and all elements need to be values that exist in backend definition.
 *
 * @param {Array} allowedVoucherStatuses - specific HTTP (optional) body parameter
 * @returns {boolean} true if valid, false if invalid
 */
const isAllowedVoucherStatusesValid = (allowedVoucherStatuses) => {
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
};

const isNotvalidLimitParam = (limit) => limit && (!Number.isInteger(limit) || limit < 1 || limit > 5000);

const isNotValidNextToken = (params) => params[PARAMS_MAP.NEXT_TOKEN] && !params[PARAMS_MAP.LIMIT];

const commaSeparatedStringToArray = (str) => str.split(/[ ,]+/);

const decryptNextToken = (params) => {
    try {
        console.log('Next token provided. Decrypting...');
        return JSON.parse(
            CryptoJS.AES.decrypt(params[PARAMS_MAP.NEXT_TOKEN], symetricCache.key).toString(CryptoJS.enc.Utf8));
    } catch (error) {
        const errorBody = Utils.createErrBody(ERR_CODES.INVALID_REQUEST_PARAMETERS, 'nextToken failed to decrypt',
            { invalidParameter: 'nextToken' }, ERROR_CODES.INVALID_PARAMETER);
        throw Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
    }
};

/**
 * Takes response suitable subset of object with data from both digital codes table and prize catalogue table.
 *
 * @param {object} item - object holding data from digital codes table and prize catalogue table.
 * @returns {object} Subset of {@param item}, with renamed keys.
 */
const filterAndFormatResultItem = (item) => ({
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
});

module.exports = {
    digitalCodesQueryByUserLambdaV2: middy(digitalCodesQueryByUserLambdaV2)
        .use(extractRequestData()),
};
