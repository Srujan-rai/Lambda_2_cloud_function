const { middyValidatorWrapper } = require('../middlewares/middyValidatorWrapper');
const Utils = require('../utility_functions/utilityFunctions');
const expirationWallet = require('../database/expirationWalletTable');
const { REQUIRED_PARAMETERS_FOR_LAMBDA } = require('../constants/lambdas');
const { RESPONSE_OK } = require('../constants/responses');

/**
 *
 *@param {*} item  - receives an item to update the format that it returns.
 */
const filterAndFormatResultItem = (item) => ({
    gpp_user_id: item.gpp_user_id,
    amount: item.amount,
    configuration_id: item.configuration_id,
    currency_id: item.currency_id,
    currency_name: item.currency_name,
    last_modified: item.last_modified,
    entry_date: item.entry_date,
    valid_thru: item.valid_thru,
    already_spent: item.already_spent,
    spent_amount: item.spent_amount,
});

/**
 * Lambda Queries expiration wallet table based on gppUserId and already_spent parameter.
 *
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */

const baseQueryExpirationWalletLambda = async (event) => {
    try {
        const params = Utils.extractParams(event);

        await Utils.validateParameters(params);
        const queryResult = await expirationWallet.queryUnspentCurrenciesByUser(params.gppUserId, params.configurationId);
        const result = await queryResult.map((res) => filterAndFormatResultItem(res));

        const response = Utils.createResponse(RESPONSE_OK, { expirationWallet: result });
        console.log(`Returning response: ${JSON.stringify(response)}`);
        return response;
    } catch (error) {
        console.log(`ERROR occurred. Returning object: ${JSON.stringify(error)}`);
        return error;
    }
};

module.exports = {
    queryExpirationWalletLambda: middyValidatorWrapper(baseQueryExpirationWalletLambda,
        REQUIRED_PARAMETERS_FOR_LAMBDA.queryExpirationWalletLambda),
};
