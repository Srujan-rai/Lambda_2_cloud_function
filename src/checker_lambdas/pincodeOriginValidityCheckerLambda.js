const warmer = require('lambda-warmer');
const { middyValidatorWrapper } = require('../middlewares/middyValidatorWrapper');
const { pinCodeValidator } = require('../participation_types/pincodes/codeValidator');
const ConfigUtils = require('../self_service/configurationUtils');
const currencyAllocationRuleTable = require('../database/currencyAllocationRuleDatabase');
const {
    extractParams, createResponse, createErrBody, getExpirationTimestamp,
} = require('../utility_functions/utilityFunctions');
const { getConfiguration } = require('../utility_functions/configUtilities');
const {
    validateCommonParams, validateConfigurationRules, createResponseRejectedPincodes, PIN_REJECTION_REASONS,
    createRejectedPincodeItem, logPincodeData,
} = require('../participation_types/pincodes/mixCodesUtilityFunctions');
const { PARAMS_MAP: { CONFIGURATION_ID, FLOW_LABEL } } = require('../constants/common');
const { REQUIRED_PARAMETERS_FOR_CHECKER_LAMBDA } = require('../constants/checkers');
const { RESPONSE_OK, RESPONSE_BAD_REQUEST } = require('../constants/responses');
const { ERR_CODES: { REQUEST_RETRY } } = require('../constants/errCodes');
/**
 * Checker Lambda. Used for checking pincodes in C&G and InstantWin mechanics before redeeming them.
 */
const basePincodeOriginValidityCheckerLambda = async (event) => {
    try {
        if (await warmer(event)) return 'warmed';
        const params = extractParams(event);
        await validateCommonParams(params);
        const configuration = await getConfiguration(params[CONFIGURATION_ID], event);
        const expirationTimestamp = getExpirationTimestamp(configuration);
        await validateConfigurationRules(params);
        params.expirationTimestamp = expirationTimestamp;

        const pincodeDetailsArray = await pinCodeValidator(
            params, ConfigUtils.getMixCodesParameters(configuration, params[FLOW_LABEL]),
        );
        const lotIds = ConfigUtils.getFlowParameter(configuration.flow[params.flowLabel], 'lotIds');
        const campaignIds = ConfigUtils.getFlowParameter(configuration.flow[params.flowLabel], 'campaignIds');
        const validPinCodeData = await checkPincodes(pincodeDetailsArray, params, lotIds, campaignIds);
        const response = createResponse(RESPONSE_OK, { validationResult: validPinCodeData });
        console.log('Returning success response:', response);
        return response;
    } catch (err) {
        if ((err?.body && err.body.includes('REQUEST_TIMED_OUT')) || (err.code && err.code === 'ECONNABORTED')) {
            const errorBody = createErrBody(REQUEST_RETRY, 'Something went wrong while checking the code, please retry!');
            return createResponse(RESPONSE_BAD_REQUEST, errorBody);
        }

        console.log('Returning failure response:', err);
        return err;
    }
};

/**
 * Checks if pincodes are ok for continuing with redeem (for C&G mechanic). Includes check against MixCode's ability to
 * redeem provided pincode, and a check for possible rewards on redeeming a pincode.
 *
 * @param {Array<Object>} pincodeDetailsArray - array of objects describing pincodes in details
 * (actual code, programId, lotId, validity....).
 * @param {String} configurationId - ID of invoked configuration. Used for query on currencyAllocationTable.
 * @param {String} gppUserId - user ID
 * @param {bool} isInstantWin - denotes instantWin flow
 * @param {Arrays} lotIds - lotId used in instantWin scenario
 * @returns {Promise}
 *          - resolved without data if all pincodes passed the check.
 *          - rejected with array of actual pincode strings (for pincodes that failed the check).
 */
const checkPincodes = async (pincodeDetailsArray, { configurationId, gppUserId, expirationTimestamp }, lotIds, campaignIds) => {
    let ngpsSplitResult;
    // for instantWin skip allocation rules validity check
    if (lotIds && lotIds.length || campaignIds) {
        ngpsSplitResult = await splitByLotCampaignValidity(
            pincodeDetailsArray.validPinCodeItems,
            lotIds,
            campaignIds,
            configurationId,
            gppUserId,
            expirationTimestamp,
        );
    } else {
        // Invoke split by NGPS validity only for those that are considered valid by MixCodes (even if there are some invalid)
        ngpsSplitResult = await splitByAllocationRulesValidity(
            pincodeDetailsArray.validPinCodeItems, configurationId, gppUserId, expirationTimestamp,
        );
    }

    console.log(`all invalid pincodes after NGPS split: ${JSON.stringify(ngpsSplitResult.prioritisedError)}`);
    if (ngpsSplitResult.prioritisedError.length && !ngpsSplitResult.validPincodes.length) {
        throw createResponseRejectedPincodes(ngpsSplitResult.prioritisedError);
    } else {
        return ngpsSplitResult.validPincodes;
    }
};

/**
 * Checks if there is any user benefit in redeeming provided pincode.
 *
 * @param {String} configurationId - ID of invoked configuration. Used for query on currencyAllocationTable.
 * @param {Array} pincodeDetails - details of pincodes for possible redeem.
 * @returns {Promise<Object>} resolved if there is currency reward, rejected if not.
 */
const checkAllocationRules = async (configurationId, pincodeDetails) => {
    const lotIdOrCampaign = pincodeDetails.lotId ? pincodeDetails.lotId : pincodeDetails.campaignId;
    try {
        const satisfiedRules = await currencyAllocationRuleTable.mainQuery(
            configurationId,
            pincodeDetails.programId.toString(),
            lotIdOrCampaign.toString(),
            true,
        );
        console.log(`satisfied rules for pincode "${pincodeDetails.pincode}": ${JSON.stringify(satisfiedRules)}`);
        if (satisfiedRules == null || satisfiedRules.length <= 0) {
            throw pincodeDetails;
        } else {
            return pincodeDetails;
        }
    } catch (err) {
        console.error(err);
        return Promise.reject(pincodeDetails);
    }
};

/**
 * Splits provided pincode details into "validPincodes" and "invalidPincode" arrays.
 * Validity is decided by analyzing if there is any user benefit in by redeeming for each of provided pincodes.
 *
 * @param {Array<Object>} pincodeDetailsArray - array of objects describing pincodes in details
 * (actual code, programId, lotId, validity....).
 * @param {String} configurationId - ID of invoked configuration. Used for query on currencyAllocationTable.
 * @returns {Promise} Always resolved with object holding 2 arrays - "validPincodes" and "invalidPincodes"
 * (in the same format as {@param pincodeDetailsArray}).
 */
const splitByAllocationRulesValidity = async (pincodeDetailsArray, configurationId, gppUserId, expirationTimestamp) => {
    const checkResults = await Promise.allSettled(
        pincodeDetailsArray.map((pincodeDetails) => checkAllocationRules(configurationId, pincodeDetails)),
    );

    const pincodeData = Object.keys(checkResults).reduce((acc, key) => {
        const el = checkResults[key];

        if (el.status === 'rejected') {
            const { pincode, programId, lotId } = el.reason;
            acc.prioritisedError.push({
                ...createRejectedPincodeItem(pincode, PIN_REJECTION_REASONS.MISSING_ALLOCATION_RULE.code, false),
                pincode: {
                    pincode, programId, lotId, valid: true,
                },
            });
        } else {
            acc.validPincodes.push(el.value);
        }

        return acc;
    }, {
        validPincodes: [],
        prioritisedError: [],
    });

    if (pincodeData.prioritisedError.length) {
        await logPincodeData({ configurationId, gppUserId, expirationTimestamp }, pincodeData);
    }

    return pincodeData;
};

/**
 * Checks if pincodes are from configured lotIds
 *
 * @param {Array<Object>} pincodes - array of objects describing pincodes in details (actual code, programId, lotId, validity....).
 * @param {Array} lotIds - lotId used in instantWin scenario
 * @param {String} configurationId - ID of invoked configuration. Used for query on currencyAllocationTable.
 * @param {String} gppUserId - user ID
 * @returns {Object} Always resolved with object holding 2 arrays - "validPincodes" and "invalidPincodes"
 * (in the same format as {@param pincodeDetailsArray}).
 */
const splitByLotCampaignValidity = async (validPinCodeItems, lotIds, campaignIds, configurationId, gppUserId, expirationTimestamp) => {
    const pincodeData = Object.keys(validPinCodeItems).reduce((acc, key) => {
        const item = validPinCodeItems[key];

        // lotIds.includes(parseInt(item.lotId) is a legacy check, mixcodes V2 started using the lots as strings
        if (
            (Array.isArray(lotIds) && (lotIds.includes(parseInt(item.lotId)) || lotIds.includes(item.lotId)))
            || (Array.isArray(campaignIds) && (campaignIds.includes(parseInt(item.campaignId)) || campaignIds.includes(item.campaignId)))
        ) {
            acc.validPincodes.push(item);
        } else {
            const reason = item.campaignId ? PIN_REJECTION_REASONS.INVALID_CAMPAIGN_ID.code : PIN_REJECTION_REASONS.INVALID_LOT_ID.code;
            const {
                pincode,
                programId,
                lotId,
                campaignId,
            } = item;
            acc.prioritisedError.push({
                ...createRejectedPincodeItem(pincode, reason, false),
                pincode: {
                    pincode, programId, lotId, campaignId, valid: true,
                },
            });
        }

        return acc;
    }, {
        validPincodes: [],
        prioritisedError: [],
    });

    if (pincodeData.prioritisedError.length) {
        await logPincodeData({ configurationId, gppUserId, expirationTimestamp }, pincodeData);
    }
    return pincodeData;
};

module.exports.pincodeOriginValidityCheckerLambda = middyValidatorWrapper(basePincodeOriginValidityCheckerLambda,
    REQUIRED_PARAMETERS_FOR_CHECKER_LAMBDA.pincodeOriginValidityCheckerLambda);
