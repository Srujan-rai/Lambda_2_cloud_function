const expirationWalletTable = require('../database/expirationWalletTable');
const Utils = require('../utility_functions/utilityFunctions');
const { RESPONSE_OK } = require('../constants/responses');
/**
 * Function for calculating and and setuping up the expiration wallet amounts and other data.
 *
 * @param {Object} params - parameters passed from event (sqs Message) with all details to update expirationWallet,
 * gpp_user_id, valid_thru, spent_amount, amount, currencyId, expirationId.
 * params.amount is the total amount which the client is spending and which needs to be removed from expiration wallet
 * by going through the expiration wallet and accumuating the total number of coins needed
 * starting from the ones with are to expire the soonest.
 *
 * @returns {Object} - Write in dynamodb table in Expiraiton Wallet Table.
 */

const checkExpiredCurrencyAndAmount = async (params) => {
    let accumulatedCurrencyFromExpirationWallet = 0;
    const usersSpentAmount = params.amount;

    const result = await expirationWalletTable.queryUserAndNotExpiredCurrencies(params.gppUserId, params.currencyId);
    result.sort((a, b) => a.valid_thru - b.valid_thru);

    // eslint-disable-next-line no-restricted-syntax
    for (const walletRecord of result) {
        accumulatedCurrencyFromExpirationWallet += walletRecord.amount;
        const totalAmount = walletRecord.amount;
        const spentAmount = walletRecord.spent_amount;
        const differenceAmountAndSpentAmount = totalAmount - spentAmount;
        let amountInSpent = 0;

        if (differenceAmountAndSpentAmount > 0) {
            accumulatedCurrencyFromExpirationWallet -= spentAmount;
        }

        if (usersSpentAmount > accumulatedCurrencyFromExpirationWallet) {
            amountInSpent = totalAmount;
            expirationWalletTable.updateRowInExpiredWallet(walletRecord, amountInSpent);
        }

        if (accumulatedCurrencyFromExpirationWallet === usersSpentAmount) {
            amountInSpent = totalAmount;
            return expirationWalletTable.updateRowInExpiredWallet(walletRecord, amountInSpent);
        }

        if (accumulatedCurrencyFromExpirationWallet > usersSpentAmount) {
            const leftAmount = accumulatedCurrencyFromExpirationWallet - usersSpentAmount;
            amountInSpent = totalAmount - leftAmount;
            return expirationWalletTable.updateRowInExpiredWallet(walletRecord, amountInSpent);
        }

        if (
            !walletRecord
            || walletRecord.amount === Number.isNaN(walletRecord.amount)
            || walletRecord.spent_amount === Number.isNaN(walletRecord.spent_amount)
        ) {
            break;
        }
    }
};

/**
 * Expiration WalletLambda which is triggered through SQS, when inovked it writes the data to the expiration wallet table in dynamodb.
 *
 * @param {Object} event - data that we receive from request
 * @param {Object} context - Lambda context
 * @param callback - returned data
 */

module.exports.expirationWalletLambda = async (event) => {
    if (event.Records.length > 0) {
        try {
            const parsedParams = JSON.parse(event.Records[0].body);
            const data = await checkExpiredCurrencyAndAmount(parsedParams);
            const response = Utils.createResponse(RESPONSE_OK, { expirationWalletStatus: data });
            console.log('Returning success response...');
            return response;
        } catch (errorResponse) {
            console.error('ERROR: Returning error response:\n', errorResponse);
            throw errorResponse;
        }
    } else {
        throw new Error('Empty message');
    }
};
