const uniqid = require('uniqid');
const axios = require('axios');
const axiosRetry = require('axios-retry');
const warmer = require('lambda-warmer');
const { middyValidatorWrapper } = require('../../middlewares/middyValidatorWrapper');
const { getMixCodesParameters } = require('../../self_service/configurationUtils');
const { pinCodeValidator } = require('./codeValidator');
const { checkIsUserBlocked } = require('../../utility_functions/blockedUsersUtilities');
const {
    extractParams, createResponse, getExpirationTimestamp,
} = require('../../utility_functions/utilityFunctions');
const { getConfiguration } = require('../../utility_functions/configUtilities');
const {
    createBurnParameters, isViralCode, createRejectedPincodeItem, logPincodeData,
    validateConfigurationRules, createResponseRejectedPincodes, createSuccessResponse,
} = require('./mixCodesUtilityFunctions');
const {
    putEntry: putPincodeParticipationFailedEntry,
} = require('../../database/participationPincodesDatabase');
const { checkPrizeAvailability } = require('../../database/prizeCatalogueTable');
const { REQUIRED_PARAMETERS_FOR_LAMBDA } = require('../../constants/lambdas');
const { RESPONSE_OK } = require('../../constants/responses');
const { PARAMS_MAP: { CONFIGURATION_ID, FLOW_LABEL }, MIXCODE_REQUEST } = require('../../constants/common');
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
    onRetry: (_retryCount, _error, requestConf) => {
        // Unique transaction id on every retry
        const newMCtransactionId = uniqid();
        const updatedUrl = requestConf.url.replace(/transactionId=\w+/, `transactionId=${newMCtransactionId}`);
        requestConf.url = updatedUrl;
    },
    retryDelay: axiosRetry.exponentialDelay,
});
/** This Lambda takes in the event, strips the pin codes and then adds the burned pin to the participation table.
 * @param event - data that we receive from request
 */
const baseCodeBurnerLambda = async (event) => {
    try {
        if (await warmer(event)) return 'warmed';
        const params = extractParams(event);
        const config = await getConfiguration(params[CONFIGURATION_ID], event);
        // TODO these can be moved out into arbiter checks or something other checks
        await checkIsUserBlocked(params);
        validateConfigurationRules(params);
        const expirationTimestamp = getExpirationTimestamp(config);
        params.expirationTimestamp = expirationTimestamp;
        if (config.flow?.instantWin?.params?.voucherAvailability) await checkPrizeAvailability(params.configurationId);
        const pinCodeRequestData = await getRequestData(event, config, params);
        const [validPincodeItem] = pinCodeRequestData.validPinCodeItems;

        let mappedPinCodeBurnData;

        if (validPincodeItem.reconciledBurn && !validPincodeItem.isViral) {
            console.log(`Reconciled burn. Last used MixCodes transactionId -> ${validPincodeItem.reconciledBurn.transactionId}`);
            mappedPinCodeBurnData = {
                pincode: validPincodeItem.pincode,
                programId: validPincodeItem.programId.toString(),
                lotId: validPincodeItem.lotId.toString(),
                lotName: validPincodeItem.lotName,
                mixCodesTransactionId: validPincodeItem.reconciledBurn.transactionId,
                burned: true,
            };
        } else {
            const cbResult = await checkCircuitBreaker(circuitBreakerModules.MIX_CODES);
            let burnResults;

            if (cbResult.allowed) {
                burnResults = await burnPincode(validPincodeItem, params[CONFIGURATION_ID], expirationTimestamp);
                await checkResponseForMixCodes(burnResults, cbResult.state);
            } else {
                burnResults = customErrorResponseForMixCodes(validPincodeItem.pincode, 'put');
            }
            mappedPinCodeBurnData = await pincodeBurnResultsMapper(pinCodeRequestData, burnResults, expirationTimestamp);
        }

        const participationId = uniqid();
        await logPincodeData(params, mappedPinCodeBurnData, event, participationId);
        return generateResponse(mappedPinCodeBurnData, participationId);
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', errorResponse);
        return errorResponse;
    }
};

/**
 * Recursive function which calls Mixcodes for a maximum of 3 times
 * @param {Object} pinCodeRequestData - contains request data for pincode that is valid against given programid
 * @param {String} configId - configuration id
 * @param {Number} expirationTimestamp - Optional. TTL of the record
 * @returns {Object} pincodeData - Object containing all data accumulated from requesting and burning.
 */
const burnPincode = async (pinCodeRequestData, configId, expirationTimestamp) => {
    const {
        pincode, userId, campaignId, programId, getParams: { uri: getUri, mixCodesConfigParams },
    } = pinCodeRequestData;
    const {
        uri: burnUri,
        headers,
        timeout,
        MCtransactionId,
    } = createBurnParameters(pincode, mixCodesConfigParams, userId, configId);

    try {
        console.log('burn chain started...');
        const response = await axiosClient.put(burnUri, pincode, { headers, timeout });
        return response;
    } catch (err) {
        console.error('Burn pincode failed with: ', err);
        if (err && !campaignId) {
            // Return success in case of Already redeemed error after retry
            if (err.response?.data?.errorCode === 406 && err.response?.config['axios-retry']?.retryCount > 0) {
                return createSuccessResponse(pincode, programId, pinCodeRequestData, err.response);
            }
            const rec = {
                mixcodePincode: `${pincode}#${programId}#${userId}`,
                MCtransactionId,
                pincode,
                MCErrorCode: err.response?.data?.errorCode,
                expirationTimestamp,
            };
            const responseError = {
                pincode,
                errorCode: rec.MCErrorCode && rec.MCErrorCode !== 422 ? rec.MCErrorCode : 432,
                message: 'pincode not redeemed',
            };

            await putPincodeParticipationFailedEntry(rec);

            if (rec.MCErrorCode) {
                return Promise.resolve(responseError);
            }

            return checkAndRevertBurn(getUri, burnUri, headers, pincode, responseError);
        }
        return err;
    }
};

/**
 * Try to revert burn of pincode if it has errored but
 * still got burned
 * @param {Object} err - err from mixcode request
 */
const checkAndRevertBurn = async (getUri, burnUri, headers, pincode, responseError) => {
    console.log(`Reverting a pincode ${pincode}`);
    try {
        const res = await axiosClient.get(getUri, { headers });
        if (res.data.redeemed) {
            try {
                await axiosClient.delete(burnUri, { headers });
                responseError.message = 'pincode reverted';
            } catch (e) {
                console.error('failed pincode revert with: ', e);
                return responseError;
            }
        }
        return responseError;
    } catch (e) {
        console.error('failed to get data for pincode: ', e);
        return responseError;
    }
};

/**
 * Creates a mapped response from pincode burning
 * @param {Object} pinCodeData - containing all relevant pincode data
 * @param {Array} responseData - data returned from pincode burning
 */
const pincodeBurnResultsMapper = async (params, responseData, expirationTimestamp) => {
    let errorItem;

    if (responseData.status === 200) {
        const {
            code: pincode, programId, transactionId, lot, campaign,
        } = responseData.data;
        console.log('returning mapped pincode burn data...');
        return {
            pincode,
            programId: programId.toString(),
            ...(!isViralCode(responseData.data) ? {
                lotId: lot.lotId.toString(),
                lotName: lot.lotName,
                mixCodesTransactionId: transactionId,
            } : {
                campaignId: campaign.campaignId.toString(),
                campaignName: campaign.campaignName.toString(),
                mixCodesTransactionId: transactionId,
            }),
            burned: true,
        };
    }
    if (responseData && responseData.message && responseData.message.includes('timeout')) {
        const errorCode = 424;
        const pincode = responseData.config.data;
        errorItem = { prioritisedError: [createRejectedPincodeItem(pincode, errorCode, false)] };
    } else if (responseData && responseData.errorCode) {
        const { pincode, errorCode } = responseData;
        errorItem = { prioritisedError: [createRejectedPincodeItem(pincode, errorCode, false)] };
    } else {
        const { errorCode } = responseData.response.data;
        const pincode = responseData.config.data;
        errorItem = { prioritisedError: [createRejectedPincodeItem(pincode, errorCode, false)] };
    }
    await logPincodeData({ ...params, expirationTimestamp }, errorItem);
    throw createResponseRejectedPincodes(errorItem.prioritisedError);
};

/**
 * Generates or extract cached object with needed request data for
 * valid pincode burning
 * @param {object} event
 * @param {String} config - configuration object
 * @param {object} params - event params
 */
const getRequestData = async (event, config, params) => {
    let result = {};
    if (event.customParameters && event.customParameters.cachedValidPinCodeData) {
        console.log('taking pincode data from the event.....');
        result.validPinCodeItems = [...event.customParameters.cachedValidPinCodeData[event.requestContext.requestId]];
        delete [...event.customParameters.cachedValidPinCodeData[event.requestContext.requestId]];
    } else {
        console.log('requesting pincode data from pinCodeValidator.....');
        result = await pinCodeValidator(params, getMixCodesParameters(config, params[FLOW_LABEL]));
    }
    return result;
};

/**
 * Generates final response from codeBurnerLambda
 * @param {object} mappedPinCodeBurnData - response from mixcodes
 * @param {String} participationID - Participation Id
 */
const generateResponse = (mappedPinCodeBurnData, participationId) => {
    const response = [];
    if (mappedPinCodeBurnData.prioritisedError) {
        response.push(mappedPinCodeBurnData.prioritisedError);
    } else {
        const {
            mixCodesTransactionId, lotName, campaignName, ...remainingItems
        } = mappedPinCodeBurnData;
        response.push(remainingItems);
    }
    return createResponse(RESPONSE_OK, { burnResult: response, participationId });
};

module.exports.codeBurnerLambda = middyValidatorWrapper(baseCodeBurnerLambda, REQUIRED_PARAMETERS_FOR_LAMBDA.burnPincodes);
