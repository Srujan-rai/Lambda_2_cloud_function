const uniqid = require('uniqid');
const Messages = require('@the-coca-cola-company/ngps-global-common-messages');
const {
    getInvalidStringParameters,
    createResponseInvalidParameter,
    createErrorBody,
    createResponse,
    arrayFromString,
    filterParamsWithOptionalInfo,
    extractRequestId,
} = require('../../utility_functions/utilityFunctions');
const { addItemToParticipation } = require('../../database/participationsDatabase');
const { putEntry: putPincodeParticipationFailedEntry } = require('../../database/participationPincodesDatabase');
const sqsUtilities = require('../../utility_functions/aws_sdk_utils/sqsUtilities');
const { ERROR_CODES: { INVALID_PARAMETER } } = require('../../constants/errCodes');
const {
    PARAMS_MAP: {
        CONFIGURATION_ID,
        FLOW_LABEL,
        PINS,
    }, MIXCODE_REQUEST,
    PATTERNS: {
        mcPinCode,
        mcViralCode,
    },
} = require('../../constants/common');
const { RESPONSE_FORBIDDEN, RESPONSE_BAD_REQUEST, RESPONSE_OK } = require('../../constants/responses');

const REJECTION_REASONS = {
    INVALID_INPUT: {
        reason: Messages.MIXCODES_ERR.INVALID_INPUT,
        priority: 1,
        code: 400,
        origin: 'MixCodes',
    },
    PINCODE_IS_EXPIRED: {
        reason: Messages.MIXCODES_ERR.PINCODE_IS_EXPIRED,
        priority: 2,
        code: 420,
        origin: 'Internal',
    },
    REQUEST_TIMED_OUT: {
        reason: Messages.MIXCODES_ERR.REQUEST_TIMED_OUT,
        priority: 2,
        code: 424,
        origin: 'Internal',
    },
    CODE_INACTIVE: {
        reason: Messages.MIXCODES_ERR.CODE_INACTIVE,
        priority: 6,
        code: 407,
        origin: 'MixCodes',
    },
    ALREADY_REDEEMED: {
        reason: Messages.MIXCODES_ERR.ALREADY_REDEEMED,
        priority: 7,
        code: 406,
        origin: 'MixCodes',
    },
    MISSING_ALLOCATION_RULE: {
        reason: Messages.MIXCODES_ERR.MISSING_ALLOCATION_RULE,
        code: 421,
        origin: 'Internal',
    },
    INVALID_LOT_ID: {
        reason: Messages.MIXCODES_ERR.INVALID_LOT_ID,
        code: 426,
        origin: 'Internal',
    },
    INVALID_PRG_ID: {
        reason: Messages.MIXCODES_ERR.INVALID_PRG_ID,
        priority: 0,
        code: 401,
        origin: 'MixCodes',
    },
    INVALID_ORG_ID: {
        reason: Messages.MIXCODES_ERR.INVALID_ORG_ID,
        priority: 0,
        code: 402,
        origin: 'MixCodes',
    },
    INVALID_HASH: {
        reason: Messages.MIXCODES_ERR.INVALID_HASH,
        priority: 0,
        code: 404,
        origin: 'MixCodes',
    },
    DUPLICATE_REQUEST: {
        reason: Messages.MIXCODES_ERR.DUPLICATE_REQUEST,
        priority: 8,
        code: 405,
        origin: 'MixCodes',
    },
    TOO_MANY_ATTEMPTS: {
        reason: Messages.MIXCODES_ERR.TOO_MANY_ATTEMPTS,
        priority: 4,
        code: 408,
        origin: 'MixCodes',
    },
    INVALID_TRN_ID: {
        reason: Messages.MIXCODES_ERR.INVALID_TRN_ID,
        priority: 5,
        code: 403,
        origin: 'MixCodes',
    },
    REDEMPTION_LOCKED: {
        reason: Messages.MIXCODES_ERR.REDEMPTION_LOCKED,
        priority: 8,
        code: 409,
        origin: 'MixCodes',
    },
    REDEMPTION_LIMIT_REACHED: {
        reason: Messages.MIXCODES_ERR.REDEMPTION_LIMIT_REACHED,
        priority: 9,
        code: 410,
        origin: 'MixCodes',
    },
    ACCESS_DENIED: {
        reason: Messages.MIXCODES_ERR.ACCESS_DENIED,
        priority: 0,
        code: 430,
        origin: 'MixCodes',
    },
    UNKNOWN: {
        reason: Messages.MIXCODES_ERR.UNKNOWN,
        priority: 0,
        code: 422,
        origin: undefined,
    },
    WRONG_SECRET: {
        reason: Messages.MIXCODES_ERR.WRONG_SECRET,
        priority: 0,
        code: 423,
        origin: 'MixCodes',
    },
    PROMOTION_ALREADY_REDEEMED: {
        reason: Messages.MIXCODES_ERR.PROMOTION_ALREADY_REDEEMED,
        priority: 0,
        code: 425,
        origin: 'MixCodes',
    },
    PROMOTIONID_REQUIRED: {
        reason: Messages.MIXCODES_ERR.PROMOTIONID_REQUIRED,
        priority: 0,
        code: 428,
        mixCodesCode: 422,
        origin: 'MixCodes',
    },
    WRONG_PROMOTION: {
        reason: Messages.MIXCODES_ERR.WRONG_PROMOTION,
        priority: 0,
        code: 429,
        mixCodesCode: 423,
        origin: 'MixCodes',
    },
    INVALID_CAMPAIGN_ID: {
        reason: Messages.MIXCODES_ERR.INVALID_CAMPAIGN_ID,
        priority: 0,
        code: 427,
        origin: 'Internal',
    },
    UNREDEEM_FAILED: {
        reason: Messages.MIXCODES_ERR.UNREDEEM_FAILED,
        priority: 11,
        code: 412,
        origin: 'MixCodes',
    },

    // This should take presidency over any other error as the code has been reverted and in a valid state
    EXCEEDED_MAX_RETRIES: {
        reason: Messages.MIXCODES_ERR.EXCEEDED_MAX_RETRIES,
        priority: 100,
        code: 432,
        origin: 'Internal',
    },

    // CODE_NOTAVAILABLE && GENERATION_LIMITS have same code
    // in VIRAL code / PIN code API responses
    CODE_NOTAVAILABLE: {
        reason: Messages.MIXCODES_ERR.CODE_NOT_AVAILABLE,
        priority: 8,
        code: 411,
        origin: 'Mixcodes',
    },
    GENERATION_LIMITS: {
        reason: Messages.MIXCODES_ERR.GENERATION_LIMITS,
        priority: 10,
        code: 411,
        origin: 'MixCodes',
    },
    SERVICE_UNAVAILABLE: {
        reason: Messages.MIXCODES_ERR.SERVICE_UNAVAILABLE,
        priority: 0,
        code: 503,
        origin: 'MixCodes',
    },
};

const REQ_RETRY_MESSAGES = {
    inProgress: 'Request already in progress',
};

const PIN_REJECTION_REASONS = REJECTION_REASONS;

const validateCode = (code, mcConfigArray) => {
    const codeTypes = {
        pin: false,
        viral: false,
    };
    mcConfigArray.forEach((config) => {
        if (config?.uri?.includes('pin')) {
            codeTypes.pin = true;
        } else if (config?.uri?.includes('viral')) {
            codeTypes.viral = true;
        }
    });

    if ((codeTypes.pin && codeTypes.viral) || (!codeTypes.pin && codeTypes.viral)) {
        // If the config array contains 2 different types we have to use the most greedy regexp
        return mcViralCode.test(code);
    }

    return mcPinCode.test(code);
};

/**
 * Validates http body params.
 *
 * @param {Object} params - request body parameters
 *
 * @returns {Promise} resolved with {@param params} if all params are valid, rejected with HTTP error if any is invalid
 */
const validateCommonParams = (params) => {
    const invalidStrings = getInvalidStringParameters(params, [CONFIGURATION_ID, FLOW_LABEL, PINS]);
    if (invalidStrings.length > 0) {
        return Promise.reject(createResponseInvalidParameter(invalidStrings));
    }
    return Promise.resolve(params);
};

/**
 * Reads the rules in configuration and checks if provided parameters satisfy the rules.
 */
const validateConfigurationRules = (params) => {
    console.log('Validation of configuration rules for pins is starting...');
    const pincodes = pincodesStringToArray(params.pins);

    if (pincodes.length > 1) {
        const errorBody = createErrorBody(INVALID_PARAMETER, 'pincode limitations failed');
        const response = createResponse(RESPONSE_FORBIDDEN, errorBody);
        console.error('ERROR: Conditions are not satisfied!');
        throw response;
    }
    console.log('Conditions satisfied! Resolving...');
    return createResponse(RESPONSE_OK, {});
};

/**
 * Returns array of strings from passed coma separated string.
 */
const pincodesStringToArray = (params) => arrayFromString(params);

const createAuthHeaderVal = (programId, secret) => Buffer.from(`${programId}:${secret}`).toString('base64');

const createMixCodesHeaders = (programId, secret) => {
    const authHeaderVal = createAuthHeaderVal(programId, secret);
    return {
        Accept: 'application/json',
        Authorization: `Basic ${authHeaderVal}`,
    };
};

/** Function to create the Mixcodes put parameters
 * @param {String} pincode - object with properties pincode (String), valid (Boolean).
 * @param {Object} mixCodesConfigParams - object with properties required to get pincode
 * @param {String} userId
 * @return {Object}
 */
const createBurnParameters = (pincode, mixCodesConfigParams, userId, configId) => {
    const encodePincode = encodeURIComponent(pincode);
    const headers = createMixCodesHeaders(mixCodesConfigParams.programId, mixCodesConfigParams.secret);
    const MCtransactionId = uniqid();
    const uri = `${mixCodesConfigParams.uri}${encodePincode}.json?programId=${mixCodesConfigParams.programId}&consumerId=${userId}&promotionId=${configId}&transactionId=${MCtransactionId}`;

    return {
        method: 'PUT',
        uri,
        headers,
        pincode,
        timeout: Number(MIXCODE_REQUEST.timeout),
        MCtransactionId,
    };
};

/**
 * Creates one element of the invalidPincodes array.
 * Array that holds these items should be later provided to the {@link createResponseRejectedPincodes}
 *
 * @param {String} pincode - pincode string
 * @param {Number} errorCode - Error code for the reason why the pincode is rejected/invalid.
 * @param {Boolean} addPriorityToResponse - flag for adding priority to the response object default = true;
 *
 * @typedef {Object} Rejection
 * @property {string} pincode - Rejected Pincode
 * @property {string} reason - Rejection reason
 * @property {number} errorCode - Error code tied to rejection reason
 * @property {string} errorName - Descriptive error name
 * @property {string} origin - Origin of the generated response: MixCodes, Internal...
 *
 * @returns {Rejection} - Object containing rejection details
 */
const createRejectedPincodeItem = (pincode, errorCode, addPriorityToResponse = true) => {
    const rejectionReasonsArray = Object.keys(REJECTION_REASONS);
    let reasonItem;

    const reasonNamesArray = rejectionReasonsArray.filter((item) => REJECTION_REASONS[item].code === errorCode);
    if (reasonNamesArray.length > 0) {
        reasonItem = REJECTION_REASONS[reasonNamesArray[0]];
        reasonItem.errorName = reasonNamesArray[0];
        if (reasonItem.mixCodesCode) errorCode = reasonItem.mixCodesCode; // special case for temp Daha Daha duplicate pincodes issue
    } else {
        reasonItem = REJECTION_REASONS.UNKNOWN;
        reasonItem.errorName = 'UNKNOWN';
        errorCode = REJECTION_REASONS.UNKNOWN.code;
    }

    const rejectedPincodeItem = {
        pincode,
        reason: reasonItem.reason,
        errorCode: errorCode || REJECTION_REASONS.UNKNOWN.code,
        errorName: reasonItem.errorName,
        origin: reasonItem.origin,
    };

    if (addPriorityToResponse) {
        rejectedPincodeItem.priority = reasonItem.priority;
    }

    return rejectedPincodeItem;
};

/**
 * Error response when request can't be processed further due to all invalid pincodes
 * @param {Array<String>} invalidPincodes - pincodes that didn't pass validation
 * @returns {Object} error
 */
const createResponseRejectedPincodes = (invalidPincodes) => {
    const errorBody = createErrorBody(INVALID_PARAMETER, Messages.COMMON_ERR.PINCODES_REJECTED, { pinRejection: invalidPincodes });
    return createResponse(RESPONSE_BAD_REQUEST, errorBody);
};

/** This function checks if passed in object contains ViralCode
 * @param {responseItem} responseItem - object with properties pincode (String), valid (Boolean).
 * @return {boolean}
 */
const isViralCode = (responseItem) => {
    if (responseItem.campaign
        || responseItem.value
        && responseItem.value.body
        && responseItem.value.body.campaign
    ) {
        return true;
    }
    return false;
};

/** Function for prioritizing errors which were received form Mix Codes
 * @param {Array} pinCodeData - An array of failed items
 * @return object with priority error from Mix Code.
 */
const getPriorityError = (pinCodeData) => {
    const prioritisedErrors = pinCodeData.invalidPinCodeItems.reduce((acc, item) => {
        if (acc.length === 0) {
            acc.push(item);
        } else if (acc[(acc.length - 1)].pincode === item.pincode && acc[(acc.length - 1)].priority < item.priority) {
            acc[(acc.length - 1)] = item;
        } else if (acc[(acc.length - 1)].pincode !== item.pincode) {
            acc.push(item);
        }

        return acc;
    }, [])
        .filter((item) => {
            if (item.priority) {
                delete item.priority;
                return item;
            }
            return item;
        });

    return pinCodeData.burnResult ? filterPincodeItems(pinCodeData, prioritisedErrors) : prioritisedErrors;
};

/** Function for filtering specific data from the dataset
 * along with ensuring uniqueness of Valid pins from Invalid pins
 * @param {Object} pinCodeData - Object contain all pincode data
 * @param {Array} prioritisedErrors - An array of failed items
 * @return object with priority error from Mix Code.
 */
const filterPincodeItems = (pinCodeData, prioritisedErrors) => prioritisedErrors.filter(
    (el) => !pinCodeData.burnResult.find(({ pincode }) => pincode === el.pincode),
);

const validateMessageBodyParams = (pincodeData) => {
    const pincodeBody = {};
    if (pincodeData.pincode.pincode) {
        pincodeBody.pincode = pincodeData.pincode.pincode;
    } else {
        throw new Error('Pincode is missing');
    }

    if (pincodeData.reason) {
        pincodeBody.reason = pincodeData.reason;
    } else {
        throw new Error('Reason is missing');
    }

    if (pincodeData.errorCode) {
        pincodeBody.errorCode = pincodeData.errorCode;
    } else {
        throw new Error('ErrorCode is missing');
    }

    if (pincodeData.errorName) {
        pincodeBody.errorName = pincodeData.errorName;
    } else {
        throw new Error('ErrorName is missing');
    }

    if (pincodeData.origin) {
        pincodeBody.origin = pincodeData.origin;
    } else {
        throw new Error('Origin is missing');
    }

    return pincodeBody;
};

/**
 * Adds successful records' lot id and program id to the participation row.
 * @param {Object} event - lambda invocation event
 * @param {Object} pincodeData - result of burn attempt for pincode
 * @param {String} participationId
 * @returns {Promise} holding response from {@link addItemToParticipation} or without data in case
 * that insert wasn't needed.
 */

const addSuccessfulBurnsToParticipation = async (event, pincodeData, participationId, userId, expirationTimestamp) => {
    const isViralCodeCheck = (!!pincodeData.campaignId);
    const dataToStore = {
        programId: pincodeData.programId,
        lotId: pincodeData.lotId,
        lotName: pincodeData.lotName,
        campaignId: pincodeData.campaignId,
        campaignName: pincodeData.campaignName,
        MCtransactionId: pincodeData.mixCodesTransactionId,
        pincode: pincodeData.pincode,
    };

    const params = filterParamsWithOptionalInfo(event);

    return [
        await addItemToParticipation(
            params,
            extractRequestId(event),
            { successfulBurns: dataToStore, participationId, endOfConf: expirationTimestamp },
        ),
        await putPincodeParticipationFailedEntry({
            mixcodePincode: `${pincodeData.pincode}#${pincodeData.programId}#${userId}`,
            participationId,
            isViralCodeCheck,
            pincode: pincodeData.pincode,
            expirationTimestamp,
            redeemed: true,
        }),
    ];
};

/**
 * Function for going through pincode data and logging the results in the appropriate places
 * @param {String} userId - userId of the requester
 * @param {String} configurationId
 * @param {Array} pinCodeData - An array which includes the pincode burns and failures
 */
const logPincodeData = async ({
    gppUserId, configurationId, userId, expirationTimestamp,
}, pinCodeData, event, participationId) => {
    const invalidPincodes = [];
    try {
        if (pinCodeData.prioritisedError && pinCodeData.prioritisedError.length) {
            if (Array.isArray(pinCodeData.prioritisedError)) {
                let counter = 0;
                pinCodeData.prioritisedError.forEach(() => {
                    let messageBody;
                    if (pinCodeData.prioritisedError[counter].pincode && pinCodeData.prioritisedError[counter].errorName !== 'INVALID_INPUT') {
                        if ((pinCodeData.prioritisedError[counter].pincode).constructor.name === 'Object') {
                            const validatedPincodeBody = validateMessageBodyParams(pinCodeData.prioritisedError[counter]);
                            messageBody = {
                                pincodeError: validatedPincodeBody,
                                configurationId,
                                gppUserId,
                                event,
                                reason: 'pincodeError',
                                expirationTimestamp,
                            };
                        } else {
                            messageBody = {
                                pincodeError: pinCodeData.prioritisedError[counter],
                                configurationId,
                                gppUserId,
                                event,
                                reason: 'pincodeError',
                                expirationTimestamp,
                            };
                        }
                        counter++;
                        invalidPincodes.push(messageBody);
                    }
                });
            }
            if (invalidPincodes?.length) {
                const queUrl = sqsUtilities.getGenericDbWriterQueue();
                return sqsUtilities.sendSQSMessage({
                    MessageBody: JSON.stringify(invalidPincodes),
                    QueueUrl: queUrl,
                });
            }
            return;
        }
        if (pinCodeData.burned) {
            console.log('MIXCODES:', { ...pinCodeData, gppUserId, configurationId });
            return await addSuccessfulBurnsToParticipation(event, pinCodeData, participationId, userId, expirationTimestamp);
        }
        throw new Error('Pincode data does not contain expected attributes.');
    } catch (err) {
        throw new Error(err);
    }
};

/**
 * Function to create success response on retry 406 error
 * @param {String} pincode - Burned Pincode
 * @param {String} programId - Program id
 * @param {Object} pinCodeData - Object contain all pincode data
 * @param {Object} errResponse - Error response with config details
 */
const createSuccessResponse = (pincode, programId, pinCodeData, errResponse) => {
    const { url } = errResponse?.config || {};
    const transactionId = url ? url.match(/transactionId=(\w+)/)?.[1] : undefined;
    return {
        status: 200,
        data: {
            code: pincode,
            programId,
            lot: {
                lotId: pinCodeData?.lotId,
                lotName: pinCodeData?.lotName,
            },
            transactionId,
        },
    };
};

module.exports = {
    REQ_RETRY_MESSAGES,
    PIN_REJECTION_REASONS,
    validateCommonParams,
    validateConfigurationRules,
    pincodesStringToArray,
    createAuthHeaderVal,
    createMixCodesHeaders,
    createBurnParameters,
    createRejectedPincodeItem,
    createResponseRejectedPincodes,
    isViralCode,
    logPincodeData,
    getPriorityError,
    validateCode,
    createSuccessResponse,
};
