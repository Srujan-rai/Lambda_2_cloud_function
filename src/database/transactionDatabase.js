const {
    query: dbQuery,
    createErrorMissingParameter,
    createErrorInvalidParameter,
    putItem,
    executeWithRetry,
    createError,
    transactWrite,
    getInsertDate,
    countQuery,
} = require('./dbUtilities');
const { buildPutOrUpdateItem: walletBuildPutOrUpdateParams } = require('./walletTable');
const { buildPutOrUpdateItem: expBuildPutOrUpdateParams } = require('./expirationWalletTable');
const {
    sendSQSMessage,
    getExpirationWalletQueueURL,
} = require('../utility_functions/aws_sdk_utils/sqsUtilities');
const { RESPONSE_FORBIDDEN, RESPONSE_INTERNAL_ERROR } = require('../constants/responses');
const { TRANSACTION_TYPES } = require('../constants/common');

const { GPP_TRANSACTION_TABLE } = require('../constants/tableNames');

/**
 * Creates parameters for docClient insert based on camel case parameters received from I.E. lambda.
 */
const createInsertParams = (camelCaseParams) => ({
    TableName: GPP_TRANSACTION_TABLE,
    Item: {
        gpp_user_id: camelCaseParams.gppUserId,
        transaction_timestamp: camelCaseParams.transactionTimestamp,
        currency_id: camelCaseParams.currencyId,
        amount: camelCaseParams.amount,
        transaction_type: camelCaseParams.transactionType,
        wallet_rolling_total: camelCaseParams.walletRollingTotal,
        configuration_id: camelCaseParams.configurationId,
        promo_name: camelCaseParams.promoName,
        currency_name: camelCaseParams.currencyName,
        prize_id: camelCaseParams.prizeId,
        entry_date: getInsertDate(camelCaseParams.transactionTimestamp),
        valid_thru: camelCaseParams.validThru,
        event_code: camelCaseParams.eventCode,
        end_of_conf: camelCaseParams.endOfConf,
        referral: camelCaseParams.referral,
        ref_code: camelCaseParams.refCode,
    },
});

/**
 * Validates transaction timestamp. Timestamp cant be undefined or null, and has to be a number.
 */
const validateTransactionTimestamp = (transactionTimestamp) => {
    if (transactionTimestamp == null || Number.isNaN(transactionTimestamp)) {
        throw createErrorMissingParameter(RESPONSE_INTERNAL_ERROR,
            'transaction_timestamp', GPP_TRANSACTION_TABLE);
    }
};

/**
 * Validates wallet rolling total. Has to be positive (or 0) value, has to be a number.
 */
const validateWalletRollingTotal = (walletRollingTotal, currencyId) => {
    if (walletRollingTotal === null) {
        throw createErrorMissingParameter(RESPONSE_INTERNAL_ERROR,
            'wallet_rolling_total', GPP_TRANSACTION_TABLE);
    }
    if (Number.isNaN(walletRollingTotal)) {
        throw createErrorInvalidParameter(RESPONSE_INTERNAL_ERROR,
            'wallet_rolling_total', GPP_TRANSACTION_TABLE);
    } if (walletRollingTotal < 0) {
        throw createError(RESPONSE_FORBIDDEN, 'Not enough currency to make transaction',
            { currencyId });
    }
};

/**
 * Validates amount parameter. Has to be positive (sign is determined by transactionType).
 */
const validateAmount = (amount) => {
    if (amount == null) {
        throw createErrorMissingParameter(RESPONSE_FORBIDDEN, 'amount',
            GPP_TRANSACTION_TABLE);
    } if (Number.isNaN(amount) || amount === '' || amount < 0) {
        throw createErrorInvalidParameter(RESPONSE_FORBIDDEN, 'amount',
            GPP_TRANSACTION_TABLE);
    }
};

/**
 * Validates transaction type. Has to be one of {@link TRANSACTION_TYPES}
 */
const validateTransactionType = (transactionType) => {
    if (transactionType == null) {
        throw createErrorMissingParameter(RESPONSE_INTERNAL_ERROR,
            'transaction_type', GPP_TRANSACTION_TABLE);
    }
    // eslint-disable-next-line no-restricted-syntax
    for (const key in TRANSACTION_TYPES) {
        if (transactionType === TRANSACTION_TYPES[key]) {
            return undefined;
        }
    }
    throw createErrorInvalidParameter(RESPONSE_INTERNAL_ERROR,
        'transaction_type', GPP_TRANSACTION_TABLE);
};

/**
 * Checks the conditional restrictions from dynamodb ConditionExpression and Retries the function.
 *
 * @param {*} error - the error passed to the function, which is checked for ConditionalCheckFailedException
 * @param {*} data - the data to be used for putItem
 */
const checkConditionalFailAndRetry = (error, data) => {
    const isErrorConditionalCheck = error.body.includes('ConditionalCheckFailedException');
    if (isErrorConditionalCheck) {
        data.Item.transaction_timestamp += Math.floor(Math.random() * 100);
        return putItem(data);
    }
    console.log(`creation of transaction failed${JSON.stringify(error)}`);
    return undefined;
};

/**
 * Claims a free prize in wallet where - the transaction type is SPEND and the amount to be spend is 0.
 *
 * @param {Object} params - parameters passed to insert new transaction Data to transaction table
 *
 * @returns {Object} - which will be put in the dynamoDb table.
 */

const freePrizeClaim = (params) => executeWithRetry(() => putItem(params)
    .catch((error) => {
        checkConditionalFailAndRetry(error, params);
    }));

/**
 * Function that activates only when validthru parameter is present, adding currency to wallet table and expiration table.
 *
 * @param {*} params - passed params to insert new transaction Data to transaction table
 * @param {*} transParams -  Creates parameters for docClient insert based on camel case parameters received from I.E. lambda.
 *
 * @returns {Promise} - transact write operation to write in the dynamodb specified tables.
 */

const earnCurrencyWithValidThruParam = (params, transParams) => executeWithRetry(async () => {
    const arrayOfWallets = [];
    params.flagExpirationWallet = true;
    const walletItem = await walletBuildPutOrUpdateParams(params);
    arrayOfWallets.push(walletItem);
    const expirationWalletActionItems = await expBuildPutOrUpdateParams(params);
    return transactWrite({ TransactItems: [{ Put: transParams }, ...arrayOfWallets.concat(expirationWalletActionItems)] });
});

/**
 * Validates insert parameters. Returns promise. Resolves with same insertParams as provided. Rejects with error response.
 */
const validateInsertParams = (insertParams) => {
    if (!Object.prototype.hasOwnProperty.call(insertParams, 'Item')) {
        const errResponse = createError(RESPONSE_INTERNAL_ERROR, 'Insert item missing');
        throw errResponse;
    }
    const item = insertParams.Item;
    validateTransactionTimestamp(item.transaction_timestamp);
    validateTransactionType(item.transaction_type);
    validateAmount(item.amount);
    validateWalletRollingTotal(item.wallet_rolling_total, item.currency_id);
};

/**
 * Spending currency functionality, which will check if you have enough funds in the wallet, then try to
 * extract the same amount of currencies from the expiration wallet (if it exists), and return the wallet updates.
 *
 * @param {*} params - passed params to insert new transaction Data to transaction table
 * @param {*} transParams -  Creates parameters for docClient insert based on camel case parameters received from I.E. lambda.
 */

const spendCurrency = async (params, transParams) => {
    let walletItem;
    try {
        walletItem = await walletBuildPutOrUpdateParams(params);
        await transactWrite({ TransactItems: [{ Put: transParams }, walletItem] });
        return await walletItem.expirationWalletValue ? sendSQSMessage({
            MessageBody: JSON.stringify(params),
            QueueUrl: getExpirationWalletQueueURL(),
            MessageGroupId: params.gppUserId,
        }) : Promise.resolve();
    } catch (error) {
        if (error.body.includes('TransactionCanceledException')) {
            transParams.Item.transaction_timestamp += Math.floor(Math.random() * 100);
            return transactWrite({ TransactItems: [{ Put: transParams }, walletItem] });
        }
        console.log(`Transact Write Failed:\n${JSON.stringify(error.body)}`);
    }
    return undefined;
};

/**
 * Earn currency without valid_thru parameters, for configurations where expiration functionality is not used in general.
 *
 * @param {*} params - passed params to insert new transaction Data to transaction table
 * @param {*} transParams -  Creates parameters for docClient insert based on camel case parameters received from I.E. lambda.
 */

const earnCurrencyWithoutExpiration = async (params, transParams) => {
    let walletItem;
    try {
        walletItem = await walletBuildPutOrUpdateParams(params);
        return await transactWrite({ TransactItems: [{ Put: transParams }, walletItem] });
    } catch (error) {
        if (error.body.includes('TransactionCanceledException')) {
            transParams.Item.transaction_timestamp += Math.floor(Math.random() * 100);
            return transactWrite({ TransactItems: [{ Put: transParams }, walletItem] });
        }
        console.log(`Transact Write Failed:\n${JSON.stringify(error.body)}`);
    }
    return undefined;
};

/**
 * Method for inserting new transaction data to transaction table.
 */
const putEntry = async (params) => {
    const transactionParams = createInsertParams(params);
    transactionParams.ConditionExpression = 'attribute_not_exists(gpp_user_id) AND attribute_not_exists(transaction_timestamp)';
    const emptyValidThruParameter = params.validThru === undefined || params.validThru === null || Number.isNaN(params.validThru);
    validateInsertParams(transactionParams);
    if (params.validThru > 0) {
        return earnCurrencyWithValidThruParam(params, transactionParams);
    } if (emptyValidThruParameter && params.transactionType === TRANSACTION_TYPES.earn) {
        return earnCurrencyWithoutExpiration(params, transactionParams);
    } if (params.transactionType === TRANSACTION_TYPES.spend && params.amount === 0) {
        return freePrizeClaim(transactionParams);
    }
    return spendCurrency(params, transactionParams);
};

/**
 * Core query for transaction database. Called with condition expression, values for that expression and index which is used.
 * @param expression - parametrized condition for query
 * @param expressionValues - values for expression
 * @param index - optional and specified if using secondary index (global | local)
 */
const query = (expression, expressionValues, IndexName, FilterExpression) => {
    const queryParams = {
        TableName: GPP_TRANSACTION_TABLE,
        KeyConditionExpression: expression,
        ExpressionAttributeValues: expressionValues,
        ...(FilterExpression ? { FilterExpression } : ''),
        ...(IndexName ? { IndexName } : ''),
    };

    return dbQuery(queryParams);
};

/**
 * @param {string} userId - provided userId from the request which is then transformed to gppUserId
 * @param {string} configurationId - configurationId extracted from the event request
 * @param {string} currencyId - currencyId extrancted from the event request, specifying the currency used.
 *
 * @return {Object} - which will be used to query the transaction table for the expected result.
 */

const queryUserConfigurationCurrencyIndex = (gppUserId, configurationId, currencyId) => {
    const expression = 'gpp_user_id = :gpp_user_id';
    const expressionValues = {
        ':gpp_user_id': gppUserId,
    };

    const filterExpression = 'currency_id = :currency_id AND configuration_id = :configuration_id';
    expressionValues[':currency_id'] = currencyId;
    expressionValues[':configuration_id'] = configurationId;

    return query(expression, expressionValues, '', filterExpression);
};

/**
 * Returns transaction data for primary keys pair (user_id and transaction_timestamp).
 * @function mainQuery - This code could be redundant and should be tagged
 * for removal in the future.
 */
const mainQuery = (gppUserId, transactionTimestamp) => {
    const expression = 'gpp_user_id = :gpp_user_id AND transaction_timestamp = :transaction_timestamp';
    const expressionValues = {
        ':gpp_user_id': gppUserId,
        ':transaction_timestamp': transactionTimestamp,
    };
    return query(expression, expressionValues);
};

/**
 * Public function serving as check for parameters that are about to be passed to transactionDatabase.
 */
const validateParams = (camelCaseParams) => {
    const params = createInsertParams(camelCaseParams);
    validateInsertParams(params);
    return camelCaseParams;
};

/**
 * Returns transactions count for user which has ref_code.
 * @param {Object} params - params containing gppUserId, configurationId, currencyId

 * @return {Promise} - query count response.
 */
const countUserConfigCurrencyRefCode = (params) => {
    const { gppUserId, configurationId, currencyId } = params;

    const queryParams = {
        TableName: GPP_TRANSACTION_TABLE,
        KeyConditionExpression: 'gpp_user_id = :gpp_user_id',
        ExpressionAttributeValues: {
            ':gpp_user_id': gppUserId,
            ':currency_id': currencyId,
            ':configuration_id': configurationId,
        },
        FilterExpression:
            'currency_id = :currency_id AND configuration_id = :configuration_id AND attribute_exists(ref_code)',
    };
    return countQuery(queryParams);
};

module.exports = {
    createInsertParams,
    putEntry,
    queryUserConfigurationCurrencyIndex,
    countUserConfigCurrencyRefCode,
    mainQuery,
    validateParams,
};
