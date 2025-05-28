const Utils = require('../utility_functions/utilityFunctions');
const SQSUtils = require('../utility_functions/aws_sdk_utils/sqsUtilities');
const { getConfiguration } = require('../utility_functions/configUtilities');
const expirationWallet = require('../database/expirationWalletTable');
const { createInsertParams } = require('../database/transactionDatabase');
const walletTable = require('../database/walletTable');
const dbUtilities = require('../database/dbUtilities');
const { prepareCommonParameters } = require('../wallet/prizeRedeemAndTransactionLambda');
const { RESPONSE_INTERNAL_ERROR, RESPONSE_OK } = require('../constants/responses');
const { ERR_CODES: { INVALID_PARAMETER } } = require('../constants/errCodes');
const { TRANSACTION_TYPES } = require('../constants/common');

/**
 * Function that returns back to SQS any failed expiration request
 * In order to be re-tried again
 * @param currencies - Array of failed currencies
 */
const returnBackToSQS = (currencies) => {
    const queueUrl = SQSUtils.getCurrencyExpirationQueueURL();
    const queueParams = {
        MessageBody: JSON.stringify(currencies),
        QueueUrl: queueUrl,
    };
    return SQSUtils.sendSQSMessage(queueParams);
};

/**
 * Validate the received currency for expiration
 * In order to be re-tried again
 * @param currenciesResponse - dynamodb getItem response array
 */
const checkValidCurrency = (currenciesResponse) => {
    console.log('Currency in checkValid', currenciesResponse);
    const currency = currenciesResponse[0];
    const invalid = ['configuration_id', 'amount', 'spent_amount', 'gpp_user_id'].filter((prop) => !Object.prototype.hasOwnProperty.call(currency, prop));

    if (invalid.length) {
        const errorBody = Utils.createErrBody(INVALID_PARAMETER, 'Invalid currencies record in DB detected.', undefined);
        const errorResponse = Utils.createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
        return Promise.reject(errorResponse);
    }
    return Promise.resolve(currency);
};

/**
 * Lambda that fetch messages from SQS and expires records from expiration_wallet
 * by creating a transaction and deducting the user's wallet
 * @param event
 * @param context
 * @param callback
 * @returns {Promise}
 */
const currencyExpirator = async (event) => {
    const currenciesToBeRetried = [];
    if (event.Records.length > 0) {
        const promises = [];
        const currenciesToExpire = JSON.parse(event.Records[0].body);

        currenciesToExpire.forEach((eventCurrency) => {
            let amountToExpire;
            let currencyToExpire;
            const uniqueOffset = currenciesToExpire.indexOf(eventCurrency);
            const transactWriteItems = [];
            if (!eventCurrency.gpp_user_id && !eventCurrency.expiration_id) {
                console.error('INVALID CURRENCY FETCHED');
                return;
            }
            const promise = new Promise((resolve) => {
                (async () => {
                    try {
                        const currenciesResponse = await expirationWallet.get(eventCurrency.gpp_user_id, eventCurrency.expiration_id);
                        const currency = await checkValidCurrency(currenciesResponse);
                        currencyToExpire = currency;
                        console.log('Currency is', currencyToExpire);
                        amountToExpire = currency.amount - currency.spent_amount;
                        const configuration = await getConfiguration(currency.configuration_id, event);
                        const transactionParams = await prepareCommonParameters(currencyToExpire.gpp_user_id, configuration,
                            currencyToExpire.currency_id, -amountToExpire, uniqueOffset, TRANSACTION_TYPES.expired);
                        const insertParams = createInsertParams(transactionParams);
                        transactWriteItems.push({ Put: insertParams });
                        const walletParams = {
                            gppUserId: currencyToExpire.gpp_user_id,
                            currencyId: currencyToExpire.currency_id,
                            amount: amountToExpire,
                            transactionType: TRANSACTION_TYPES.expired,
                        };
                        const walletUpdateParams = await walletTable.buildPutOrUpdateItem(walletParams);
                        transactWriteItems.push(walletUpdateParams);
                        const params = await expirationWallet.expireCurrency(currencyToExpire.gpp_user_id, currencyToExpire.expiration_id);
                        transactWriteItems.push(params);
                        await dbUtilities.transactWrite({ TransactItems: transactWriteItems });
                        resolve();
                    } catch (err) {
                        console.error(`Expire for currency ${eventCurrency.expiration_id} and ${eventCurrency.gpp_user_id} has failed with ${err}`);
                        const errBody = JSON.parse(err.body);
                        // only return back to queue if DB error
                        if (errBody.errorDetails && errBody.errorDetails.DynamoDBCode) {
                            currenciesToBeRetried.push(currencyToExpire);
                        }
                        resolve();
                    }
                })();
            });
            promises.push(promise);
        });
        try {
            await Promise.all(promises);

            console.log('Finished.');
            if (currenciesToBeRetried.length > 0) {
                return returnBackToSQS(currenciesToBeRetried);
            }
            return Utils.createResponse(RESPONSE_OK, { currenciesToBeRetried });
        } catch (err) {
            console.error(`Failed operation because of ${err}`);
            throw err;
        }
    } else {
        throw new Error('Empty message');
    }
};

module.exports = {
    currencyExpirator,
};
