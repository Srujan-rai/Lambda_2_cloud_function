const {
    createErrorBody,
    createResponse,
} = require('../utility_functions/utilityFunctions');
const {
    query: DBQuery,
    get: DBGet,
    putItem: DBPut,
    EXCEPTIONS: { VALIDATION_EXCEPTION },
} = require('./dbUtilities');
const { ERROR_CODES: { DYNAMO_DB_ERROR } } = require('../constants/errCodes');
const { RESPONSE_INTERNAL_ERROR, RESPONSE_FORBIDDEN, RESPONSE_OK } = require('../constants/responses');
const { TRANSACTION_TYPES } = require('../constants/common');

const { GPP_WALLET_TABLE } = require('../constants/tableNames');
/**
 *  If there is no entry in wallet table use this amount as default
 */
const DEFAULT_CURRENCY_AMOUNT = 0;

/**
 * Core query for wallet database.
 * @param expression - parametrized condition for query
 * @param expressionValues - values for expression
 */
const query = (expression, expressionValues) => {
    const queryParams = {
        TableName: GPP_WALLET_TABLE,
        KeyConditionExpression: expression,
        ExpressionAttributeValues: expressionValues,
    };
    return DBQuery(queryParams);
};

const createUpdateImpossibleErrorResponse = () => {
    const errorBody = createErrorBody(DYNAMO_DB_ERROR,
        "Can't update unexisting data",
        { reason: VALIDATION_EXCEPTION });
    return createResponse(RESPONSE_FORBIDDEN, errorBody);
};

/**
 * Creates update amount params.
 * @param gppUserId
 * @param currencyId
 * @param addAmount
 * @returns {Object}
 */
const createUpdateCurrencyAmountParams = (gppUserId, currencyId, addAmount, expirationWallet, shouldUpdateTotalCurrency) => {
    const updateExpression = shouldUpdateTotalCurrency ? 'SET amount = amount + :addAmount, total_amount = total_amount + :addAmount'
        : 'SET amount = amount + :addAmount';
    const updateWalletParams = {
        Update: {
            ExpressionAttributeValues: {
                ':addAmount': addAmount,
            },
            Key: {
                gpp_user_id: gppUserId,
                currency_id: currencyId,
            },
            ReturnValues: 'ALL_NEW',
            TableName: GPP_WALLET_TABLE,
            UpdateExpression: updateExpression,
        },
        expirationWalletValue: expirationWallet,
    };

    // if type spent make sure the wallet amount wont go bellow 0
    if (addAmount < 0) {
        updateWalletParams.Update.ExpressionAttributeValues[':conditionAmount'] = -addAmount;
        updateWalletParams.Update.ConditionExpression = 'amount >= :conditionAmount';
    }
    return updateWalletParams;
};

/**
 * Returns user wallet data for provided user id and currency id.
 * @param gppUserId - concatenation of userId and userIdType
 * @param currencyId - currency for which we are querying wallet
 */
const mainQuery = (gppUserId, currencyId) => {
    const expression = 'gpp_user_id = :gpp_user_id AND currency_id = :currency_id';
    const expressionValues = {
        ':gpp_user_id': gppUserId,
        ':currency_id': currencyId,
    };
    return query(expression, expressionValues);
};

/**
 * Function that prepares conditional update parameters. Queries wallet for amount, used for ConditionExpression, and
 * validates if update params are ok. These validations are needed because these are condition parameters, meaning that
 * we will reuse this function if there was exception in which case previously valid request can be no longer valid,
 * depending on change that happened.
 */
const createConditionalUpdateCurrencyParams = async (item, gppUserId, currencyId, addAmount, transType) => {
    if (transType === TRANSACTION_TYPES.spend || transType === TRANSACTION_TYPES.expired) {
        addAmount = -addAmount;
    }
    if (item.amount + addAmount < 0) {
        const errorBody = createErrorBody(DYNAMO_DB_ERROR,
            'Trying to spend currency that the user does not have!');
        const errResponse = createResponse(RESPONSE_FORBIDDEN, errorBody);
        throw errResponse;
    }
    // all checks passed, create update params....
    const expirationWallet = item.expiration_wallet;
    return createUpdateCurrencyAmountParams(gppUserId, currencyId, addAmount, expirationWallet);
};

/**
 * Returns user wallet data for provided split value of gpp user id
 *
 * @param userId - origin userId (CID's uuid or email string or BAMBOO ID etc.)
 * @param userIdType - defines origin/type of userId ("CID", "email", "BAMBOO" etc.)
 * @param currencyId - id of specific currency that we are querying
 */
const mainQueryWithSplitValues = (gppUserId, currencyId) => mainQuery(gppUserId, currencyId);

/**
 * Retrieves the wallet table data based on unique currency ids
 * @param {String} userId - the ID of the user
 * @param {Array} currencies - array with unique currency ids
 *
 * @returns {Array} walletData
 */
const getWalletDataPerCurrencies = (userId, currencies = []) => {
    if (!currencies.length) {
        throw new Error('At least 1 currency id has to be specified in order to retrieve some data');
    }

    return Promise.all(currencies.map((currId) => DBGet({
        TableName: GPP_WALLET_TABLE,
        Key: {
            currency_id: currId,
            gpp_user_id: userId,
        },
    }).then((item) => item && item[0]))).then((res) => res.filter((item) => item));
};

/**
 * Extract the user's wallet by userId
 * @param userId - userId from the request
 * @param allowedIdTypes - array of allowed id types
 */
const queryUserWalletById = async (userId, allowedIdTypes) => {
    const userWalletPromises = allowedIdTypes.map((idType) => {
        const expression = 'gpp_user_id = :gpp_user_id';
        const expressionValues = {
            ':gpp_user_id': userId + idType,
        };
        return query(expression, expressionValues);
    });

    const userWalletResults = await Promise.all(userWalletPromises);
    return userWalletResults.find((item) => item.length > 0);
};

/**
 * Check if it needs to update the currency or add a new one if it does not exist
 * @param params - event params
 */
const buildPutOrUpdateItem = async (params) => {
    const item = await getWalletDataPerCurrencies(params.gppUserId, [params.currencyId]);
    if (item.length > 0 && item[0]) {
        return params.addTotalCurrencyAccumulated
            ? createUpdateCurrencyAmountParams(
                params.gppUserId,
                params.currencyId,
                params.amount,
                item[0].expiration_wallet,
                params.addTotalCurrencyAccumulated,
            )
            : createConditionalUpdateCurrencyParams(
                item[0],
                params.gppUserId,
                params.currencyId,
                params.amount,
                params.transactionType,
            );
    }
    if (params.transactionType === TRANSACTION_TYPES.earn) {
        const putItem = {
            Put: {
                TableName: GPP_WALLET_TABLE,
                Item: {
                    gpp_user_id: params.gppUserId,
                    currency_id: params.currencyId,
                    currency_name: params.currencyName || 'Currency name not specified',
                    amount: params.amount,
                    last_modified: params.lastModified,
                    expiration_wallet: params.flagExpirationWallet,
                },
            },
        };
        if (params.addTotalCurrencyAccumulated) {
            putItem.Put.Item.total_amount = params.amount;
        }
        return putItem;
    }
    const response = createUpdateImpossibleErrorResponse();
    throw response;
};

/**
 *  Method for inserting new user wallet.
 */
const putEntry = async (params) => {
    console.log('Received wallet insert params:\n', JSON.stringify(params));
    const tableParams = {
        TableName: GPP_WALLET_TABLE,
        Item: {
            gpp_user_id: params.gppUserId,
            currency_id: params.currencyId,
            currency_name: params.currencyName,
            amount: params.amount,
            last_modified: params.lastModified,
        },
    };
    console.log('Modified wallet insert params:\n', JSON.stringify(params));
    try {
        await DBPut(tableParams);
        return createResponse(RESPONSE_OK, { walletEntryInserted: true });
    } catch (err) {
        console.error('ERROR: Failed to put data into', GPP_WALLET_TABLE, 'table:\n', JSON.stringify(err));
        const errorBody = createErrorBody(DYNAMO_DB_ERROR, 'Failed to save wallet data');
        const response = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
        return response;
    }
};

module.exports = {
    DEFAULT_CURRENCY_AMOUNT,
    mainQuery,
    mainQueryWithSplitValues,
    buildPutOrUpdateItem,
    putEntry,
    getWalletDataPerCurrencies,
    queryUserWalletById,
};
