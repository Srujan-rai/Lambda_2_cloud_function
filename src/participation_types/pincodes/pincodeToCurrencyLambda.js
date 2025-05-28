const RulesTable = require('../../database/currencyAllocationRuleDatabase');
const Utils = require('../../utility_functions/utilityFunctions');
const MixCodesUtils = require('./mixCodesUtilityFunctions');
const { getEventData, CUSTOM_EVENT_PARAMS } = require('../../utility_functions/eventUtilities');
const { RESPONSE_OK, RESPONSE_BAD_REQUEST } = require('../../constants/responses');
const { ERROR_CODES: { FLOW_LAMBDA_REJECTION, REQUEST_PARAMETER_MISSING } } = require('../../constants/errCodes');
const { PARAMS_MAP: { PINCODES_DETAILS_ARRAY } } = require('../../constants/common');
/**
 * Filters allocation array data, making it suitable for http response.
 *
 * @param {Array} allocationArray - constructed allocation array
 *
 * @returns {Array} {@param allocationArray} with filtered fields
 */
function filterAndFormatResponseData(allocationArray) {
    return allocationArray.map((allocation) => ({
        currencyId: allocation.currencyId,
        amount: allocation.amount,
        validThru: allocation.validThru,
    }));
}

/**
 * Extracts input from either params or event depending on various conditions.
 */
const extractCodeDetails = async (params, requestId, event) => {
    const errorBody = Utils.createErrorBody(REQUEST_PARAMETER_MISSING,
        'Not provided data via params and there is no data in event : missing argument(s)', { argsMissing: [PINCODES_DETAILS_ARRAY] });
    if (Object.prototype.hasOwnProperty.call(params, PINCODES_DETAILS_ARRAY)) {
        console.log('Getting pincode details array from params...');
        return Promise.resolve(params[PINCODES_DETAILS_ARRAY]);
    }
    // if not provided via parameters (or feature is blocked) take from event.
    try {
        const data = getEventData(event, requestId, CUSTOM_EVENT_PARAMS.CACHED_BURN_DATA);
        // if there is no data in Event return error
        if (data === undefined) {
            console.log(data, 'No pincode details array in event!');
            throw Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
        } else {
            console.log('Event pincode details array data:\n', data);
            return data;
        }
    } catch (errorResponse) {
        console.error('ERROR: Failed to get pincode details array data from Event!');
        throw errorResponse;
    }
};

/**
 * Returns index of JSON array (currencyAllocations) which is related to provided currencyId. Returns -1 if there is no match.
 *
 * @param {Array} currencyAllocations - array of allocations where we search for index of provided currency
 * @param {String} currencyId - id of currency for which we search index in allocation array
 * @param {Number} validThru - Expiration timestamp for currency
 *
 * @returns {Number} index of matching item within {@param currencyAllocations}
 */
const findCurrencyAllocationIndex = (currencyAllocations, currencyId, validThru) => {
    for (let i = 0; i < currencyAllocations.length; i++) {
        if (currencyAllocations[i].currencyId === currencyId && currencyAllocations[i].validThru === validThru) {
            return i;
        }
    }
    return -1;
};

/**
 * Groups query result by currencyId, and forms JSON array of currencies to be updated.
 *
 * @param {Array} items - items returned as query result against rules table.
 * @param {Array} allocationArray - array of summed up allocations where we should add new items.
 *
 * @returns {Array} updated {@param allocationArray}
 */
const addCurrencyAllocationForDataItems = (items, allocationArray) => {
    for (let i = 0; i < items.length; i++) {
        let validThru;
        if (items[i].validity) {
            validThru = Utils.createValidThruTimestamp(items[i].validity);
        }

        const index = findCurrencyAllocationIndex(allocationArray, items[i].currency_id, validThru);
        if (index === -1) {
            // currency still not allocated, create new allocation
            const alloc = {
                currencyId: items[i].currency_id,
                amount: parseInt(items[i].amount),
                validThru,
            };
            console.log(`created allocation rule: ${JSON.stringify(alloc)}`);
            allocationArray.push(alloc);
        } else {
            console.log('Adding', items[i].amount, 'to existing allocation:\n', JSON.stringify(allocationArray[index]));
            allocationArray[index].amount += parseInt(items[i].amount);
        }
    }
    console.log(`Created allocation array:\n${JSON.stringify(allocationArray)}`);
    return allocationArray;
};

/**
 * Queries rules, groups result by currencyId, and forms JSON array of currencies to be updated.
 * @param params - GET/POST params (queryString or request body) originally received by lambda
 * @param pincodeItem - one item in array of burn results.
 * @param previousAllocations - current iteration result for constructing allocation array
 */
const addCurrencyAllocationsForPincode = async (params, pincodeItem, previousAllocations) => {
    const data = await RulesTable.mainQuery(
        params.configurationId,
        pincodeItem.programId,
        pincodeItem.lotId || pincodeItem.campaignId,
        true,
    );

    console.log(`Query completed on rules table for burn item:\n${JSON.stringify(data)}`);
    if (data.length === 0) {
        // if no allocation rule is found - reject
        const invalidPincode = MixCodesUtils.createRejectedPincodeItem(
            pincodeItem.pincode,
            MixCodesUtils.PIN_REJECTION_REASONS.MISSING_ALLOCATION_RULE.code,
        );
        throw MixCodesUtils.createResponseRejectedPincodes(invalidPincode);
    }
    const updatedAllocationArray = addCurrencyAllocationForDataItems(data, previousAllocations);
    return updatedAllocationArray;
};

/**
 * Creates promise for allocationArray.
 * Rejected if there is no valid pincode to create allocation for.
 * Resolved if there is at least one valid pincode
 *
 * Returns array of currency-amount pairs
 */
const createAllocationPromise = (params, pincodeDetailsArray) => {
    // initialize with empty array
    let allocationPromise = Promise.resolve([]);
    let isHavingValidPincode = false;
    for (let i = 0; i < pincodeDetailsArray.length; i++) {
        if (pincodeDetailsArray[i].burned) {
            isHavingValidPincode = true;
            allocationPromise = allocationPromise
                .then((previousAllocationArray) => addCurrencyAllocationsForPincode(
                    params,
                    pincodeDetailsArray[i],
                    previousAllocationArray,
                ));
        }
    }

    if (isHavingValidPincode) {
        return allocationPromise;
    }
    const errorBody = Utils.createErrorBody(FLOW_LAMBDA_REJECTION, 'No valid pincode!');
    const errorResponse = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
    return Promise.reject(errorResponse);
};

/**
 * Lambda function. Queries rules table for each pincode burn result, groups all currency gains in single allocation array.
 * This lambda is used as preparation of parameters for transaction insert based on burn results.
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
module.exports.pincodeToCurrencyLambda = async (event) => {
    try {
        const params = Utils.extractParams(event);
        const requestId = Utils.extractRequestId(event);

        const pincodeDetailsArray = await extractCodeDetails(params, requestId, event);
        const allocationArray = await createAllocationPromise(params, pincodeDetailsArray);
        const result = filterAndFormatResponseData(allocationArray);
        const body = {
            allocationArray: result,
        };
        const response = Utils.createResponse(RESPONSE_OK, body);
        console.log('Returning success response...');
        return response;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', errorResponse);
        return errorResponse;
    }
};
