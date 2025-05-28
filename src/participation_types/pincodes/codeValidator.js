const axios = require('axios');
const axiosRetry = require('axios-retry');
const {
    createRejectedPincodeItem, getPriorityError, logPincodeData,
    createResponseRejectedPincodes, isViralCode, createMixCodesHeaders,
    validateCode, PIN_REJECTION_REASONS,
} = require('./mixCodesUtilityFunctions');
const { PARAMS_MAP: { PINS, CONFIGURATION_ID, USER_ID }, MIXCODE_REQUEST } = require('../../constants/common');
const { getItem: getPincodeParticipation } = require('../../database/participationPincodesDatabase');
const {
    checkCircuitBreaker,
    checkResponseForMixCodes,
    customErrorResponseForMixCodes,
    circuitBreakerModules,
} = require('../../circuit_breaker/circuitBreakerService');

const axiosClient = axios.create({
    responseType: 'json',
    json: true,
    allowGetBody: true,
});
axiosRetry(axiosClient, {
    shouldResetTimeout: true,
    retries: MIXCODE_REQUEST.reqRetryAttempts,
    retryCondition: (e) => {
        console.error('retry request failed with:', e.message);
        return e.code === 'ECONNABORTED';
    },
    retryDelay: axiosRetry.exponentialDelay,
});
/** Function orchestrating the validation for the parsed pincodes
 * @param {Array} params the event data
 * @param {Array} mixCodesParametersArray an array of MixCode params for each program id taken from the config file.
 * @returns if no valid pincodes are found then an error is returned else and Array of valid pincodes for burning
 */
module.exports.pinCodeValidator = async (params, mixCodesParametersArray) => {
    console.log('Codes checking has started...');
    const returnMixCodesConfigParams = true;
    const pincode = params[PINS];

    if (!validateCode(pincode, mixCodesParametersArray)) {
        throw createResponseRejectedPincodes([createRejectedPincodeItem(pincode, 400, false)]);
    }

    const cbResult = await checkCircuitBreaker(circuitBreakerModules.MIX_CODES);
    let programIdsPinValidity;

    if (cbResult.allowed) {
        programIdsPinValidity = await Promise.allSettled(
            multiProgramCheckParams(pincode, mixCodesParametersArray,
                returnMixCodesConfigParams, params[CONFIGURATION_ID], params[USER_ID]),
        );
    } else {
        programIdsPinValidity = customErrorResponseForMixCodes(pincode, 'get');
    }

    const mappedPinCodeData = await programIdsPinValidity.reduce(async (accomulator, pinProgramIdRequestPromise) => {
        const acc = await accomulator;
        let pinCodeRequestData = {};
        if (pinProgramIdRequestPromise.status === 'fulfilled') {
            pinCodeRequestData = pinProgramIdRequestPromise.value;
            await checkResponseForMixCodes(pinCodeRequestData, cbResult.state);
        } else if (pinProgramIdRequestPromise.reason.response) {
            pinCodeRequestData = pinProgramIdRequestPromise.reason.response;
        } else {
            // timeout
            pinCodeRequestData.config = pinProgramIdRequestPromise.reason.config;
            pinCodeRequestData.data = pinProgramIdRequestPromise.reason;
        }
        const responseStatusCode = await getPincodeResponseData(pinCodeRequestData, params.userId);

        if (responseStatusCode.length) {
            acc.invalidPinCodeItems.push({ ...createRejectedPincodeItem(...responseStatusCode) });
        } else {
            acc.validPinCodeItems.push({ ...responseStatusCode });
        }

        return acc;
    }, Promise.resolve({ validPinCodeItems: [], invalidPinCodeItems: [] }));

    if (!mappedPinCodeData.validPinCodeItems.length) {
        mappedPinCodeData.prioritisedError = getPriorityError(mappedPinCodeData);
        await logPincodeData(params, mappedPinCodeData);
        throw createResponseRejectedPincodes(mappedPinCodeData.prioritisedError);
    } else {
        return mappedPinCodeData;
    }
};

/** This function checks the fulfilled pincode does not match any of the following criteria - if so this is a valid pincode.
 * @param {responseItem} responseItem - object with properties pincode (String), valid (Boolean).
 * @return {boolean} pincode valid true or false.
 */
const getPincodeResponseData = async ({
    config, data, status, data: {
        message, errorCode, redeemed, lot, campaign, code: pincode, programId,
    },
}, userId) => {
    let statusCode = 0;
    let reconciledBurn;
    const [rec] = await getPincodeParticipation(`${pincode}#${programId}#${userId}`);

    if (message?.includes('timeout')) {
        statusCode = 424;
    }
    // The status check will work only if MIXCODES has returned an HTML
    if (
        (message?.includes('Access Denied'))
        || status && (status > 400 && status < 500)
    ) {
        statusCode = 430;
    } else if (errorCode) {
        statusCode = errorCode;
        if (errorCode === 407 && message?.includes('expired')) {
            statusCode = 420;
        }
        // The new codes have duplication in our rejections map. They are used by Daha Daha
        if (errorCode === 422 && message?.includes('promotion id')) {
            statusCode = 428;
        }
        if (errorCode === 423 && message?.includes('another promotion')) {
            statusCode = 429;
        }
    } else if (!redeemed && rec?.mixcodes_error_code === 422) {
        statusCode = 432;
    } else if (!redeemed && rec?.redeemed) {
        statusCode = 406;
    } else if (redeemed) {
        // NZ program with duplicated codes, to be removed after depleting all codes or upon mixcodes team confirmation
        if (programId === 486473) {
            console.log(`NZ Program Code ${pincode}, User: ${userId}`);
        } else if (!rec
            || rec.redeemed
            || (!rec.mixcodes_transaction_id && rec.participation_id)
            || (rec.mixcodes_error_code && rec.mixcodes_error_code !== 422)
        ) {
            statusCode = 406;
        } else {
            reconciledBurn = {
                transactionId: rec.mixcodes_transaction_id,
            };
        }
    } else if ((lot && !lot.active) || (campaign && !campaign.active)) {
        statusCode = 407;
    } else if (lot?.expired) {
        statusCode = 420;
    }

    if (!statusCode) {
        if (!lot && !campaign) {
            return [config.pincode, PIN_REJECTION_REASONS.UNKNOWN.code];
        }
        const isViral = isViralCode(data);

        return {
            userId,
            ...(isViral
                ? {
                    pincode,
                    programId,
                    campaignId: campaign.campaignId,
                } : {
                    pincode,
                    programId,
                    lotId: lot.lotId,
                    lotName: lot.lotName,
                }),
            getParams: { mixCodesConfigParams: config.mixCodesConfigParams, uri: config.uri },
            reconciledBurn,
            isViral,
        };
    }

    return [config.pincode, statusCode];
};

/** Function used for generating promises for get requests for multiple endpoints
 *@param {String} pincode
 *@param {Array} mixCodesParametersArray - array containing specific details required for get req
 *@param {Boolean} returnMixCodesConfigParams - true or false value for if the config details should be returned
 *@param {String} configId - configuration id
 *@param {String} userId - user identifier
 *@returns {Promise} - get request
 */
const multiProgramCheckParams = (
    pinCode,
    mixCodesParametersArray,
    returnMixCodesConfigParams,
    configId,
    userId,
) => mixCodesParametersArray.map((mixCodeParam) => {
    try {
        const getParameters = createGetParameters(pinCode, mixCodeParam, returnMixCodesConfigParams, configId, userId);
        return axiosClient.get(getParameters.uri, { ...getParameters }, MIXCODE_REQUEST.reqRetryAttempts);
    } catch (e) {
        console.error('MixCodes get request failed with: ', e);
        return e;
    }
});

/** Function to create the Mixcodes get parameters
 * @param {String} pincode - object with properties pincode (String), valid (Boolean).
 * @param {Object} mixCodesConfigParams - object with properties required to get pincode
 * @param {Boolean} returnMixCodesConfigParams - true or false value to be used if the params used to generate headers
 * etc, should be returned.
 * @return {Object}
 */
const createGetParameters = (pincode, mixCodesConfigParams, returnMixCodesConfigParams, configId, userId) => {
    const encodePincode = encodeURIComponent(pincode);
    const headers = createMixCodesHeaders(mixCodesConfigParams.programId, mixCodesConfigParams.secret);
    const uri = `${mixCodesConfigParams.uri}${encodePincode}.json?programId=${mixCodesConfigParams.programId}&promotionId=${configId}&consumerId=${userId}`;
    const getParams = {
        uri,
        headers,
        pincode,
        timeout: Number(MIXCODE_REQUEST.timeout),
    };

    if (returnMixCodesConfigParams) {
        getParams.mixCodesConfigParams = mixCodesConfigParams;
    }

    return getParams;
};
