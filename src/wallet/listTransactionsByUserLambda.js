const { middyValidatorWrapper } = require('../middlewares/middyValidatorWrapper');
const Utils = require('../utility_functions/utilityFunctions');
const transactionDatabase = require('../database/transactionDatabase');
const { REQUIRED_PARAMETERS_FOR_LAMBDA } = require('../constants/lambdas');
const { RESPONSE_OK } = require('../constants/responses');

/**
 *
 *@param {*} item  - receives an item to update the format that it returns.
 */
const filterAndFormatResultItem = (item) => ({
    gpp_user_id: item.gpp_user_id,
    transaction_timestamp: item.transaction_timestamp,
    amount: item.amount,
    configuration_id: item.configuration_id,
    currency_id: item.currency_id,
    currency_name: item.currency_name,
    entry_date: item.entry_date,
    promo_name: item.promo_name,
    transaction_type: item.transaction_type,
    wallet_rolling_total: item.wallet_rolling_total,
    valid_thru: item.valid_thru,
    event_code: item.event_code,
});

/**
 * Lambda Queries transaction table based on gppUserId and configurationId, option parameter is currencyid.
 *
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */

const baseListTransactionsByUserLambda = async (event) => {
    const params = Utils.extractParams(event);
    try {
        await Utils.validateParameters(params);
        const transactionResult = await transactionDatabase.queryUserConfigurationCurrencyIndex(
            params.gppUserId,
            params.configurationId,
            params.currencyId,
        );
        const result = await transactionResult.map((res) => filterAndFormatResultItem(res));
        const response = Utils.createResponse(RESPONSE_OK, { transactions: result });
        console.log(`Returning response: ${JSON.stringify(response)}`);
        return response;
    } catch (error) {
        console.log(`ERROR occurred. Returning object: ${JSON.stringify(error)}`);
        return error;
    }
};

module.exports = {
    listTransactionsByUserLambda: middyValidatorWrapper(baseListTransactionsByUserLambda,
        REQUIRED_PARAMETERS_FOR_LAMBDA.listTransactionsByUserLambda),
};
