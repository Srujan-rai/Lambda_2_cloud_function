const Moment = require('moment-timezone');
const randomNumber = require('random-number-csprng-2');
const warmer = require('lambda-warmer');
const axios = require('axios');
const { middyValidatorWrapper } = require('../middlewares/middyValidatorWrapper');
const {
    validateParams,
    putEntry,
} = require('../database/transactionDatabase');
const { getMetadataParameter } = require('../self_service/promotionsUtils');
const {
    createResponseCantRedeemPrize,
    createResponseVoucherExpired,
    createResponseInsufficientCurrencies,
    createErrorBody,
    createResponse,
    extractParams,
    getCurrencyValidThru,
    extractRequestId,
    parseBody,
    getExpirationTimestamp,
    filterParamsWithOptionalInfo,
} = require('../utility_functions/utilityFunctions');
const { getConfiguration, getDefaultUserIdType } = require('../utility_functions/configUtilities');
const { invokeLambda } = require('../utility_functions/aws_sdk_utils/lambdaUtilities');
const { sendSQSMessage } = require('../utility_functions/aws_sdk_utils/sqsUtilities');
const { getEventData, CUSTOM_EVENT_PARAMS } = require('../utility_functions/eventUtilities');
const { mainQuery: queryCurrency } = require('../database/currencyDatabase');
const {
    getWalletDataPerCurrencies,
} = require('../database/walletTable');
const {
    resetTotalAvailable,
    localizedMainQuery,
    updatePrizeCountersForRedeem,
    determineIfCNG,
    addStartEndDatesIfMissing,
} = require('../database/prizeCatalogueTable');
const {
    changeStatusForRedeem,
    queryByStatus,
} = require('../database/digitalCodesTable');
const {
    addItemToParticipation,
    checkForRedemptionLimit,
} = require('../database/participationsDatabase');
const {
    getEmailDelaySeconds,
    getConfigurationId,
    getIsStatusReserved,
    getUpdateCurrencyExpirationPerTransaction,
} = require('../self_service/configurationUtils');
const { checkIsUserBlocked } = require('../utility_functions/blockedUsersUtilities');
const { createQRcodeOrBarcode } = require('../utility_functions/barcodeUtils');
const { executeWithRetry } = require('../database/dbUtilities');
const { getMailQueueURL } = require('../utility_functions/aws_sdk_utils/sqsUtilities');

const { REQUIRED_PARAMETERS_FOR_LAMBDA, CONFIGURATION_FUNCTIONS_MAP: { emailSendLambda: SEND_EMAIL_INVOKE_PARAMS } } = require('../constants/lambdas');
const {
    PARAMS_MAP, DIGITAL_CODES_STATUS, DELIVERY_TYPE, BARCODE_TYPE, TRANSACTION_TYPES, PRIZE_CATALOGUE_COUNTERS, PATTERNS,
} = require('../constants/common');
const { RESPONSE_BAD_REQUEST, RESPONSE_OK } = require('../constants/responses');
const { ERROR_CODES, ERR_CODES } = require('../constants/errCodes');

const REDEEM_PRIZE_RETRY_COUNT = 3;

/**
 * Change digital codes status and retries the redeemPrize call if needed
 * @param {ChangeDigitalCodesStatusData} data The needed parameters
 * @returns {Promise} digitalCodes.changeStatus result
 */
const changeDigitalCodesStatus = (data) => {
    const {
        reqParams, digitalCodesStatusRes, useStatusReserved, digCodesPrizeId, prizeDetailsRes, digitalCodesIndex, retryCounter,
    } = data;
    const newStatus = useStatusReserved ? DIGITAL_CODES_STATUS.RESERVED : DIGITAL_CODES_STATUS.CLAIMED;
    const additionalData = {
        gppUserId: reqParams.gppUserId,
        requestId: reqParams.requestId,
        claimTimestamp: new Date().getTime(),
        expiryDate: getValidityPeriodAfterClaim(prizeDetailsRes) || digitalCodesStatusRes[digitalCodesIndex].expiry_date,
    };
    const currentPrizeEntryDate = prizeDetailsRes.entry_date;

    digitalCodesStatusRes[digitalCodesIndex].expiry_date = additionalData.expiryDate;

    return changeStatusForRedeem(
        reqParams.configurationId,
        reqParams.prizeId,
        digitalCodesStatusRes[digitalCodesIndex],
        DIGITAL_CODES_STATUS.AVAILABLE,
        newStatus, additionalData,
        digCodesPrizeId,
        prizeDetailsRes.active_partition_to_be_updated,
        currentPrizeEntryDate,
    )
        .catch((err) => {
            console.error('Change Status For Redeem ', err);
            if (retryCounter && retryCounter > 0) {
                // eslint-disable-next-line no-use-before-define
                return executeWithRetry(() => redeemPrize(reqParams, useStatusReserved, prizeDetailsRes, retryCounter - 1));
            }
            return Promise.reject(createResponseCantRedeemPrize(reqParams[PARAMS_MAP.PRIZE_ID]));
        });
};

/**
 * This function update status for "redeemed" voucher
 * @param {Object} params that we get for post request
 * @param {Boolean} useStatusReserved - passed from updateCountersInPrizeCatalogue to determine if a voucher should be claimed or reserved.
 * @param {Object} prizeDetailsRes - prize details
 * @param {Number} retryCounter - redeem prize counter, currently used if the queryStatus fail.
 *
 * @returns {Promise} resolved with redeemed voucher details, or rejected with http error
 */
const redeemPrize = async (params, useStatusReserved, prizeDetailsRes, retryCounter) => {
    try {
        // If the prize doesn't cointain vouchers, only update the counters
        if (prizeDetailsRes.voucher_dist === false) {
            await executeWithRetry(
                () => updatePrizeCountersForRedeem(
                    prizeDetailsRes.configuration_id,
                    prizeDetailsRes.prize_id,
                    PRIZE_CATALOGUE_COUNTERS.TOTAL_REDEEMED,
                    prizeDetailsRes.entry_date,
                ),
            );

            return [undefined];
        }

        let digCodesPrizeId = params.prizeId;
        // If the prize is big and has partitions
        if (prizeDetailsRes.active_partition) {
            digCodesPrizeId += `-${prizeDetailsRes.active_partition}`;
        }

        const response = await queryByStatus(digCodesPrizeId, DIGITAL_CODES_STATUS.AVAILABLE, 1000);
        const date = new Date();
        const currentTimestamp = date.getTime();

        if (!response || !response[0]) {
            if (prizeDetailsRes.active_partition < prizeDetailsRes.total_partitions) {
                // TODO: retry with activePartiton +1
                prizeDetailsRes.active_partition += 1;
                prizeDetailsRes.active_partition_to_be_updated = prizeDetailsRes.active_partition;
                return redeemPrize(params, useStatusReserved, prizeDetailsRes, retryCounter - 1);
            }
            return resetTotalAvailable(prizeDetailsRes.prize_id, prizeDetailsRes.configuration_id);
        }
        if (response.length > 1) {
            try {
                let num;
                for (let i = 0; i <= 2; i++) {
                    num = await randomNumber(0, response.length - 1);
                    if (response[num].should_expire === 'true' && response[num].expiry_date > currentTimestamp) {
                        break;
                    } if (response[num].should_expire === 'false') {
                        break;
                    } if (!(response[num].should_expire)) {
                        break;
                    } if (i === 2 || response[num].expiry_date < currentTimestamp) {
                        throw createResponseVoucherExpired(response.prize_id);
                    }
                }
                return changeDigitalCodesStatus({
                    reqParams: params,
                    digitalCodesStatusRes: response,
                    useStatusReserved,
                    digCodesPrizeId,
                    prizeDetailsRes,
                    digitalCodesIndex: num === response.length ? num - 1 : num,
                    retryCounter,
                });
            } catch (err) {
                throw createResponseCantRedeemPrize(params[PARAMS_MAP.PRIZE_ID]);
            }
        }

        return changeDigitalCodesStatus({
            reqParams: params,
            digitalCodesStatusRes: response,
            useStatusReserved,
            digCodesPrizeId,
            prizeDetailsRes,
            digitalCodesIndex: 0,
            retryCounter,
        });
    } catch (err) {
        console.log('Error: ', err);
        throw err;
    }
};

/**
 * @typedef ChangeDigitalCodesStatusData
 * @type {Object}
 * @property {Object} reqParams POST request parameters
 * @property {Array} digitalCodesStatusRes digitalCodes.queryByStatus response
 * @property {Boolean} useStatusReserved used to determine the new status
 * @property {string} digCodesPrizeId Digital Codes PrizeId
 * @property {Object} prizeDetailsRes getPrize method response
 * @property {string} digitalCodesIndex The index which will be used to get a digital code from digitalCodesStatusRes
 * @property {string} retryCounter redeemPrize invocation counter
 */

/**
 * Return object with keys currencyId and value amount
 *
 * @param {Array} currencyArray
 *
 * @returns {Object}
 */
function convertCurrencyArrayToObject(currencyArray) {
    return currencyArray.reduce((currencyIdObj, item) => {
        currencyIdObj[item.currency_id] = item.amount;
        return currencyIdObj;
    }, {});
}

/**
 * checkAimedRollingTotal
 *   check: is it enough currencies in userWallet
 *   to afford allocationArray
 * @param userWalletArray - user wallet amount
 * @param allocationArray - prize price
 *
 * @return {Array<currencyId>} currencies that failed the check
 */
const checkAimedRollingTotal = (userWalletArray, allocationArray) => {
    const failedCurrencies = [];
    const userWalletObj = convertCurrencyArrayToObject(userWalletArray);
    allocationArray.forEach((cost) => {
        const { currencyId, amount } = cost;
        if (userWalletObj[currencyId] == null) {
            userWalletObj[currencyId] = 0;
        }
        const result = userWalletObj[currencyId] + amount;
        if (result < 0) {
            failedCurrencies.push(currencyId);
        }
    });

    return failedCurrencies;
};

/**
 * checkUserWallet
 *
 * @param {Array<Object>} allocationArray - array of allocation objects
 * @param {Object} params - HTTP request body parameters
 * @param {Object} config - the promo configuration
 *
 * @return {Promise} allocationArray
 */
const checkUserWallet = async (allocationArray, params, config) => {
    const userWalletArray = await getWalletDataPerCurrencies(params.gppUserId, config.configurationParameters.currencies);
    const failedCurrencies = checkAimedRollingTotal(userWalletArray, allocationArray);
    if (failedCurrencies.length) {
        throw createResponseInsufficientCurrencies(failedCurrencies);
    }
    return userWalletArray;
};

/**
 * Add data to Transaction DB. Returns inserted object (instead of original full http response)
 *
 * @param {Object} insertParams - object holding attributes for insert into Transaction table
 *
 * @returns {Object} object holding inserted attributes (same object as parameter)
 */
const addDataToDb = async (insertParams) => {
    await putEntry(insertParams);
    return insertParams;
};

/**
 * Executes putEntry for the whole provided array of insertParams.
 */
function insertAllTransactions(insertParamsArray) {
    const promises = insertParamsArray.map((params) => addDataToDb(params));
    return Promise.all(promises).catch((err) => { throw err; });
}

/**
 * Extracts allocation array from either params, or event
 */
const getAllocationArray = (params, requestId, event) => {
    console.log('Extracting allocation array....');

    if (Object.prototype.hasOwnProperty.call(params, PARAMS_MAP.CURRENCY_ALLOCATION_ARRAY)) {
        // getting currency allocation array from params
        console.log('Required parameter found in event! Allocations:\n',
            JSON.stringify(params[PARAMS_MAP.CURRENCY_ALLOCATION_ARRAY]));
        return params[PARAMS_MAP.CURRENCY_ALLOCATION_ARRAY];
    }
    // if not provided via parameters (or feature is blocked) take from event.
    console.log('No allocation provided, checking event...');
    const data = getEventData(event, requestId, CUSTOM_EVENT_PARAMS.CACHED_ALLOCATION_DATA);

    // if there is no data in event return error
    if (data === undefined) {
        console.error('ERROR: No currency allocations array data in event.');
        const errorBody = createErrorBody(ERROR_CODES.REQUEST_PARAMETER_MISSING,
            'Not provided data via params and there is no data in event : missing argument(s)',
            { argsMissing: [PARAMS_MAP.CURRENCY_ALLOCATION_ARRAY] });
        throw createResponse(RESPONSE_BAD_REQUEST, errorBody);
    } else {
        console.log('Currency allocations array data found');
        return data;
    }
};

/**
 * Creates a response body part related to the redeemed prize
 *
 * @param {Object} voucherInfo - redeemed voucher (digital code) details
 * @param {Object} prizeInfo - prize info from prize catalogue table
 *
 * @return {Object} filtered details about redeemed prize
 */
function filterAndFormatPrizeDetailsBodyPart(voucherInfo, prizeInfo) {
    // Adding more, prize related details...
    voucherInfo.prizeId = prizeInfo.prize_id;
    voucherInfo.name = prizeInfo.name;
    voucherInfo.shortDescription = prizeInfo.short_desc;
    voucherInfo.redeemDescription = prizeInfo.redeem_desc;
    voucherInfo.redemptionLink = prizeInfo.redemption_link;
    voucherInfo.imgUrl = prizeInfo.img_url;
    voucherInfo.barcodeType = prizeInfo.barcode_type;
    voucherInfo.tags = prizeInfo.tags;

    return voucherInfo;
}

/**
 * Call email lambda
 *
 * @param {Object} prizeDetailsRes - get all data from current prizeId
 * @param {Object} params - client parameters (originally received by lambda invoke event)
 *
 * @returns {Promise<any>}
 */
const getQRcodeOrBarcode = (prizeDetailsRes, params) => {
    if (prizeDetailsRes.barcode_type && Object.values(BARCODE_TYPE).includes(prizeDetailsRes.barcode_type)
        && prizeDetailsRes.delivery_type === DELIVERY_TYPE.digital && prizeDetailsRes.voucherCode) {
        return createQRcodeOrBarcode(
            {
                barcodeType: prizeDetailsRes.barcode_type,
                barcodeText: prizeDetailsRes.voucherCode,
                fileName: `${params.configurationId}/${params.prizeId}/barcodes/${prizeDetailsRes.prize_id}_${prizeDetailsRes.voucherCode}`,
            },
        );
    }
    return Promise.resolve(''); // resolve with empty barcode URL
};

const getEmailVerificationRequestParams = (event) => {
    const authHeader = event.headers?.cdsauthorization || event.headers?.Authorization || event.headers?.authorization;
    const emailVerificationUrl = event?.requestContext?.authorizer?.emailVerificationUrl || event?.customParameters?.emailVerificationUrl;
    return { authHeader, emailVerificationUrl };
};

/**
 * Returns an email object with information about the user
 * @param event Lambda invocation event
 * @param params that we get for post request
 * @param userIdType
 *
 * @returns {Promise} resolved with email object
 */
const setupEmail = async (event, params, userIdType) => {
    const { authHeader, emailVerificationUrl } = getEmailVerificationRequestParams(event);

    const email = params.email
        || userIdType === 'email' && params.userId
        || authHeader && authHeader.startsWith('Bearer ') && await getConsumerEmail(authHeader, emailVerificationUrl);

    if (!email) {
        throw new Error('Skipping email sending because no user email has been found');
    }

    if (!isValidEmail(email)) {
        throw new Error('Skipping email sending because the provided user email is invalid');
    }

    return email;
};

const isValidEmail = (email) => email.match(PATTERNS.email);

/**
 * Retrieves the user's email address from an external service.
 *
 * @param {string} authHeader - The authorization header containing the user's authentication token.
 * @param {Object} event - The Lambda invocation event.
 * @returns {Promise<string>} - A promise that resolves with the user's email address.
 * @throws {Error} - If there is an error retrieving the email address.
 */
const getConsumerEmail = async (authHeader, emailVerificationUrl) => {
    try {
        if (!emailVerificationUrl) {
            throw new Error('Skipping email sending because the email verification URL is missing from the event context');
        }

        const { data } = await axios.get(emailVerificationUrl, {
            headers: {
                Authorization: authHeader,
            },
        });

        // Return the user's email address from the response data
        return data.email;
    } catch (err) {
        console.error('ERROR: Failed to get user email:\n', err);
        throw err;
    }
};

/**
 * Call email lambda
 *
 * @param {Object} prizeDetailsRes - get all data from current prizeId
 * @param {Object} event - Lambda invocation event
 *
 * @returns {Promise} always resolved with boolean:
 *  true - email was sent
 *  false - email wasn't sent
 */
const sendMail = async (event, prizeDetailsRes, configuration) => {
    try {
        const params = extractParams(event);
        params.prizeDetails = prizeDetailsRes;

        const userIdType = getDefaultUserIdType(configuration);
        const email = await setupEmail(event, params, userIdType);
        const copyEventObj = { ...event };
        const eventBody = extractParams(copyEventObj);
        eventBody.email = email;
        eventBody.prizeDetails = prizeDetailsRes;
        copyEventObj.body = JSON.stringify(eventBody);
        const delaySeconds = getEmailDelaySeconds(configuration, params[PARAMS_MAP.FLOW_LABEL]);
        if (delaySeconds && Number.isInteger(+delaySeconds)) {
            // postpone sending mail by adding it to mail queue
            console.log('Mail sending delayed by', delaySeconds, 'seconds.');
            const queueUrl = getMailQueueURL();
            // SQS message parameters
            const queueParams = {
                MessageBody: copyEventObj.body,
                DelaySeconds: +delaySeconds > 900 ? 900 : delaySeconds,
                QueueUrl: queueUrl,
            };
            return await sendSQSMessage(queueParams);
        }
        await invokeLambda(SEND_EMAIL_INVOKE_PARAMS, copyEventObj);

        return true;
    } catch (err) {
        console.error('ERROR: Failed to send email:\n', err);
        return false;
    }
};

/**
 * Query using primary key for wallet table. Returns JSON representing row in wallet table for provided
 * gppUserId-currencyId pair.
 *
 * If there is no match for provided primary key, rejects with error response.
 */
const getUserWalletData = async (gppUserId, currencyId, walletData) => {
    let result;
    if (!walletData) {
        result = await getWalletDataPerCurrencies(gppUserId, [currencyId]);
    } else {
        result = walletData.filter((walletObj) => walletObj.currency_id === currencyId);
    }
    if (result.length <= 0 || !result[0]) {
        // No result in wallet means user has 0 amount for currency
        return { currency_id: currencyId, amount: 0 };
    }
    return result[0];
};

/**
 * Queries currency table and returns JSON representing one unique row (extracting it from array of results because
 * we expect only one item in array of results when we query using primary key)
 *
 * If there is no match for provided primary key, rejects with error response.
 */
const getCurrencyData = async (currencyId) => {
    const result = await queryCurrency(currencyId);
    if (result.length <= 0) {
        const message = 'Trying to modify wallet status for un-existing currency';
        const details = { invalidCurrencyId: currencyId };
        const errorBody = createErrorBody(ERROR_CODES.FLOW_LAMBDA_REJECTION, message, details);
        const errorResponse = createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errorResponse;
    }
    return result[0];
};

/**
 * This function calculates expected wallet rolling status after transaction is done.
 */
function calculateRollingTotal(currentValue, transactionAmount, transactionType) {
    if (transactionType === TRANSACTION_TYPES.spend || transactionType === TRANSACTION_TYPES.expired) {
        return currentValue - transactionAmount;
    } if (transactionType === TRANSACTION_TYPES.earn) {
        return currentValue + transactionAmount;
    }
    return undefined;
}

/**
 * Prepares part of insert parameters which is common for both transactionLambda "flows".
 *
 * @param {string} gppUserId - Users ID
 * @param {Object} configuration - JSON object stored in S3
 * @param {string} currencyId - Currency ID
 * @param {number | String} currencyAmount - The amount of currency earned/spend
 * @param {number} uniqueOffset - Unique offset that is added to the transaction timestamp
 * @param {number} transactionType - Type of transaction, either 1 (earn) or 2 (spend)
 *  * @param {string} eventCode - optional event code for the purpose of identifying transactions
 * @param {Array} userWalletData - optional user wallet data previously retrieved
 *
 * @returns {Object} - Returns insert params for the transaction table
 */
const prepareCommonParameters = async (
    gppUserId, configuration, currencyId, currencyAmount, uniqueOffset, transactionType, eventCode,
    userWalletData, ref_code) => {
    currencyAmount = currencyAmount !== '' ? Number(currencyAmount) : currencyAmount;
    const amount = Math.abs(currencyAmount);
    const paramsForInsert = {
        transactionTimestamp: parseInt(Moment().format('x')) + uniqueOffset,
        gppUserId,
        amount,
        transactionType,
        ...(eventCode ? { eventCode } : ''),
    };
    const promoName = await getMetadataParameter(configuration.promotionId, 'promotion_name');
    paramsForInsert.configurationId = getConfigurationId(configuration);
    paramsForInsert.updateCurrencyExpirationPerTransaction = getUpdateCurrencyExpirationPerTransaction(configuration);
    paramsForInsert.promoName = promoName;
    const currencyTableRow = await getCurrencyData(currencyId);
    paramsForInsert.currencyId = currencyTableRow.currency_id;
    paramsForInsert.currencyName = currencyTableRow.name;
    const walletTableRow = await getUserWalletData(gppUserId, currencyId, userWalletData);
    paramsForInsert.walletRollingTotal = calculateRollingTotal(walletTableRow.amount, amount, transactionType);
    const transactionExpiration = getExpirationTimestamp(configuration);
    paramsForInsert.endOfConf = transactionExpiration;
    paramsForInsert.refCode = ref_code;

    return validateParams(paramsForInsert);
};

/**
* Prepares array of insert parameters for currencyAllocation "flow". These parameters are equal to common parameters.
 * @param {String} allocationArray - Array of prize / transaction price
 * @param {Object} configuration - Configuration which is being executed
 * @param {Object} eventParams - HTTP Body parameters.
 * @param {Array} userWalletData - optional user wallet data previously retrieved
*/
const prepareAllocationParameters = async (allocationArray, configuration, eventParams, userWalletData) => {
    const walletRollingTotalPerCurrency = {};
    const promiseInsertParametersArray = allocationArray.map(async (currency) => {
        // uniqueOffset in transactionTimestamp to make sure we are not going to get the same value in this sort key. (quick fix)
        const transactionType = currency.amount < 0 ? TRANSACTION_TYPES.spend : TRANSACTION_TYPES.earn;
        const uniqueOffset = allocationArray.indexOf(currency);
        const paramsForInsert = await prepareCommonParameters(
            eventParams.gppUserId,
            configuration,
            currency.currencyId,
            currency.amount,
            uniqueOffset,
            transactionType,
            eventParams.eventCode,
            userWalletData,
            eventParams.ref_code,
        );

        if (paramsForInsert.transactionType === TRANSACTION_TYPES.earn) {
            if (typeof currency.validThru === 'number') {
                paramsForInsert.validThru = currency.validThru;
            } else {
                paramsForInsert.validThru = getCurrencyValidThru(configuration, paramsForInsert.currencyId);
            }

            if (!walletRollingTotalPerCurrency[currency.currencyId]) {
                walletRollingTotalPerCurrency[currency.currencyId] = paramsForInsert.walletRollingTotal;
            } else {
                walletRollingTotalPerCurrency[currency.currencyId] += currency.amount;
                paramsForInsert.walletRollingTotal = walletRollingTotalPerCurrency[currency.currencyId];
            }
        }
        return paramsForInsert;
    });

    return Promise.all(promiseInsertParametersArray).catch((err) => { throw err; });
};

/**
 * Executes flow for custom currency modification.
 *
 * @param {Object} params - HTTP Body parameters.
 * @param {String} requestId - auto-generated requestId. Used for event table
 * @param {Object} configuration - Configuration which is being executed
 *
 * @returns {Promise} inserted transactions
 */
const executeAllocationFlow = async (eventParams, requestId, configuration, event) => {
    const allocationArray = getAllocationArray(eventParams, requestId, event);
    const userWalletData = await checkUserWallet(allocationArray, eventParams, configuration);
    // for each allocation item prepare transaction.
    const arrayOfInsertParams = await prepareAllocationParameters(
        allocationArray,
        configuration,
        eventParams,
        userWalletData,
    );
    return insertAllTransactions(arrayOfInsertParams);
};

/**
 * Prepares array of insert parameters for prize redeem "flow". These parameters in addition to common parameters have
 * the prizeId attribute.
 */
const preparePrizeRedeemParameters = async (params, prizeDetails, configuration) => {
    const { cost: prizeCostArray } = prizeDetails;

    const insertParamsMap = prizeCostArray.map((currency) => {
        console.log('Currency cost item:\n', JSON.stringify(currency));
        // uniqueOffset in transactionTimestamp to make sure we are not going to get the same value in this sort key. (quick fix)
        const uniqueOffset = prizeCostArray.indexOf(currency);
        const oneCurrencyPromise = (async () => {
            const insertParams = await prepareCommonParameters(params.gppUserId, configuration,
                currency.currency_id, -currency.amount, uniqueOffset, TRANSACTION_TYPES.spend);

            insertParams.prizeId = params.prizeId;
            return insertParams;
        })();
        return oneCurrencyPromise;
    });

    return Promise.all(insertParamsMap).catch((err) => { throw err; });
};

/**
 * Executes flow for redeeming a prize.
 *
 * @param {Object} params - client parameters (originally received by lambda invoke event)
 * @param {Object} prizeDetails - record from prize catalogue table
 * @param {Object} configuration - configuration that is being executed
 *
 * @returns {Promise} result of transactions insert
 */
const executeRedeemCostTransactions = async (params, prizeDetails, configuration) => {
    const arrayOfInsertParams = await preparePrizeRedeemParameters(params, prizeDetails, configuration);
    return insertAllTransactions(arrayOfInsertParams);
};

const determineActiveStatusFlagOrTimestamp = (prizeObject, isCNG, inputConfigStart, inputConfigEnd) => {
    const currentTimestamp = Moment().unix() * 1000;

    prizeObject = addStartEndDatesIfMissing([prizeObject], inputConfigStart, inputConfigEnd)[0];
    return isCNG
        ? ((prizeObject.start_date > currentTimestamp || prizeObject.end_date < currentTimestamp) || prizeObject.total_available <= 0)
        : (!prizeObject.active || prizeObject.total_available <= 0);
};
/**
 * Queries prize catalogue table and does basic checks for proceeding with flow. Returns prize record as JSON.
 */
const getPrize = async (params, configuration) => {
    const queryResult = await localizedMainQuery(
        configuration,
        params[PARAMS_MAP.PRIZE_ID],
        params[PARAMS_MAP.LANGUAGE],
        params[PARAMS_MAP.RICHTEXT_RESPONSE_TYPE],
    );
    console.log('Localized prize query result:\n', JSON.stringify(queryResult));
    if (queryResult.length <= 0) {
        // Prize doesn't exist!
        const errorBody = createErrorBody(ERROR_CODES.FLOW_LAMBDA_REJECTION,
            'Trying to redeem un-existing prize', { invalidPrizeId: params.prizeId });
        const errorResponse = createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errorResponse;
    } else if (determineActiveStatusFlagOrTimestamp(
        queryResult[0],
        determineIfCNG(configuration?.flow),
        configuration?.configurationParameters?.configurationStartUtc,
        configuration?.configurationParameters?.configurationEndUtc,
    )) {
        // Prize is not available for redeem!
        throw createResponseCantRedeemPrize(params[PARAMS_MAP.PRIZE_ID]);
    }
    return queryResult[0];
};

/**
 * Composes array of insertion results by {@link addDataToDb} into a hhtp response that should be returned to the client.
 *
 * @param {Array} insertedTransactions - array of {@link addDataToDb} results.
 *
 * @return {Promise} holding http response.
 */
function composeTransactionResultsIntoResponse(insertedTransactions) {
    const responseBody = [];
    insertedTransactions.forEach((transaction) => {
        responseBody.push({
            transactionInserted: true,
            currencyId: transaction.currencyId,
            walletRollingTotal: transaction.walletRollingTotal,
            currencyName: transaction.currencyName,
        });
    });
    console.log('Composed result for transactions:\n', JSON.stringify(responseBody));
    return createResponse(RESPONSE_OK, { transactions: responseBody });
}

/**
 * Lambda that takes data from event and creates transaction item in transactions DynamoDB table
 */
const transactionLambda = async (event) => {
    try {
        if (await warmer(event)) return 'warmed';
        const eventBody = extractParams(event);
        const requestId = extractRequestId(event);
        const configuration = await getConfiguration(eventBody[PARAMS_MAP.CONFIGURATION_ID], event);

        if (eventBody.currencyAllocations && configuration.configurationParameters.currencies) {
            checkIfCurrenciesExist(eventBody.currencyAllocations, configuration.configurationParameters.currencies);
        }
        const expirationTimestamp = getExpirationTimestamp(configuration);
        const insertedTransactions = await executeAllocationFlow(eventBody, requestId, configuration, event);
        insertedTransactions.endOfConf = expirationTimestamp;
        if (insertedTransactions && insertedTransactions.length) {
            const bodyParams = filterParamsWithOptionalInfo(event);
            await addItemToParticipation(bodyParams, requestId, { insertedTransactions });
        }
        const response = composeTransactionResultsIntoResponse(insertedTransactions);
        console.log('Returning response...', response);
        return response;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', errorResponse);
        return errorResponse;
    }
};

/**
 * Check if currencies exist in the eventbody and the configuration itself
 * @param {Object} currencyAllocations
 * @param {Object} currencies
 */
const checkIfCurrenciesExist = (currencyAllocations, currencies) => {
    let currencyIdsArrayEventBody;
    if (Array.isArray(currencyAllocations)) {
        currencyIdsArrayEventBody = currencyAllocations.map((currencyObject) => currencyObject.currencyId);
    } else {
        currencyIdsArrayEventBody = [currencyAllocations.currencyId];
    }
    crossCheckIfCurrenciesExist(currencies, currencyIdsArrayEventBody);
};

/**
 * Lambda dedicated for prize redeem flow.
 */
const prizeRedeemLambda = async (event) => {
    try {
        if (await warmer(event)) return 'warmed';
        const params = { ...extractParams(event), requestId: extractRequestId(event) };
        const responseBody = {};
        const participationEntry = {};
        const configuration = await getConfiguration(params[PARAMS_MAP.CONFIGURATION_ID], event);
        const expirationTimestamp = getExpirationTimestamp(configuration);
        participationEntry.endOfConf = expirationTimestamp;
        const prizeDetailsRes = await getPrize(params, configuration);

        await checkIsUserBlocked(params);
        if (!params.skipLimitCheck) {
            await checkForRedemptionLimit(params, prizeDetailsRes);
        }
        let insertedTransactions = [];
        if (prizeDetailsRes.cost) {
            // prize is free, no need for transactions
            insertedTransactions = await executeRedeemCostTransactions(params, prizeDetailsRes, configuration);
            participationEntry.insertedTransactions = insertedTransactions;
            console.log('Transactions attached:', insertedTransactions);
        }

        const resultAll = composeTransactionResultsIntoResponse(insertedTransactions);
        // Adding transaction info to final response
        responseBody.transactions = resultAll ? parseBody(resultAll).transactions : undefined;
        const useStatusReserved = getIsStatusReserved(configuration, params.flowLabel);
        const [redeemInfo] = await redeemPrize(params, useStatusReserved, prizeDetailsRes, REDEEM_PRIZE_RETRY_COUNT);
        const voucherInfo = {};
        // include the voucher details only if the prize has voucher distribution
        if (prizeDetailsRes.voucher_dist !== false && redeemInfo) {
            voucherInfo.voucherCode = redeemInfo.voucher;
            voucherInfo.status = redeemInfo.voucher_status;
            voucherInfo.expiryDate = redeemInfo.expiry_date;
        }

        responseBody.redeemedPrize = filterAndFormatPrizeDetailsBodyPart(voucherInfo, prizeDetailsRes);

        Object.assign(prizeDetailsRes, voucherInfo);
        participationEntry.redeemedPrize = prizeDetailsRes;

        const barcodeURL = await getQRcodeOrBarcode(prizeDetailsRes, params);
        const sendEmailSuccessful = await sendMail(event, { ...prizeDetailsRes, barcodeURL }, configuration);
        responseBody.redeemedPrize.emailSent = sendEmailSuccessful;

        if (barcodeURL) {
            responseBody.redeemedPrize.barcodeUrl = barcodeURL;
        }

        if (sendEmailSuccessful) {
            responseBody.redeemedPrize.emailMessage = 'Email sent successfully';
        } else {
            responseBody.redeemedPrize.emailMessage = 'Email could not be sent';
        }

        Object.assign(participationEntry, {
            mail_sent: sendEmailSuccessful,
        });

        const participationRawData = await addItemToParticipation(params, extractRequestId(event), participationEntry);
        const participationData = parseBody(participationRawData);
        if (participationData && participationData.entry) {
            responseBody.participationId = participationData.entry.participationId || undefined;
        }

        const response = createResponse(RESPONSE_OK, responseBody);
        console.log('Returning response...');
        return response;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', errorResponse);
        return errorResponse;
    }
};

const getValidityPeriodAfterClaim = (prizeDetailsRes) => {
    if (!prizeDetailsRes.validity_period_after_claim || Number.isNaN(Number(prizeDetailsRes.validity_period_after_claim))) {
        return null;
    }

    const entryDate = new Date();
    console.log('[getValidityPeriodAfterClaim] entry date is: ', entryDate);

    const addDays = prizeDetailsRes.validity_period_after_claim - 1;
    const futureDate = new Date(entryDate.setDate(entryDate.getDate() + Number(addDays)));

    const validityPeriodAfterClaim = Date.UTC(futureDate.getFullYear(), futureDate.getMonth(), futureDate.getDate(), 23, 59, 59);

    console.log('[getValidityPeriodAfterClaim] validity period after claim is: ', validityPeriodAfterClaim);
    return validityPeriodAfterClaim;
};

/**
 * Check if the currencies from the request in the event body exists in the configuration file, if they do not,
 * the transaction will be errored and0 returned back.
 * @param {Array} configruationCurrenciesArray
 * @param {Array} eventBodyCurrenciesArray
 */
const crossCheckIfCurrenciesExist = (configruationCurrenciesArray, eventBodyCurrenciesArray) => {
    eventBodyCurrenciesArray.forEach((item) => {
        if (!configruationCurrenciesArray.includes(item)) {
            const errorBody = createErrorBody(ERR_CODES.CURRENCY_MARKET_DOES_NOT_MATCH_PROMO_MARKET, 'The currency market does not match the promotion market', { invalidCurrencyId: item });
            throw createResponse(RESPONSE_BAD_REQUEST, errorBody);
        }
    });
};

module.exports = {
    prepareCommonParameters,
    getValidityPeriodAfterClaim,
    setupEmail,
    transactionLambda: middyValidatorWrapper(transactionLambda, REQUIRED_PARAMETERS_FOR_LAMBDA.transactionLambda),
    prizeRedeemLambda: middyValidatorWrapper(prizeRedeemLambda, REQUIRED_PARAMETERS_FOR_LAMBDA.prizeRedeemLambda),
};
