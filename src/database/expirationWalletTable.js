const Moment = require('moment-timezone');
const Utils = require('../utility_functions/utilityFunctions');
const DBUtils = require('./dbUtilities');
const { ERROR_CODES: { DYNAMO_DB_ERROR } } = require('../constants/errCodes');
const { RESPONSE_FORBIDDEN } = require('../constants/responses');
const { TRANSACTION_TYPES } = require('../constants/common');

const { EXPIRATION_WALLET_TABLE } = require('../constants/tableNames');

/**
 *  If there is no entry in wallet table use this amount as default
 */
module.exports.DEFAULT_CURRENCY_AMOUNT = 0;

/**
 *  Method for inserting new user into expiration wallet.
 *
 * @param {Object} params - object holding the insert attributes
 *
 * @returns {Promise<any>} - resolved for inserted walletEntry.
 */
module.exports.putEntry = (params) => {
    console.log('Received expirationWallet insert params:\n', JSON.stringify(params));
    const expirationId = Utils.concatenateColumnValues(params.currencyId, params.validThru, params.configurationId);

    const tableParams = {
        TableName: EXPIRATION_WALLET_TABLE,
        Item: {
            gpp_user_id: params.gppUserId,
            expiration_id: expirationId,
            valid_thru: params.validThru,
            currency_id: params.currencyId,
            currency_name: params.currencyName,
            last_modified: params.lastModified,
            configuration_id: params.configurationId,
            amount: params.amount,
            already_spent: 0,
            spent_amount: 0,
        },
    };

    return DBUtils.putItem(tableParams);
};

/**
 * Core query for expiration wallet database.
 *
 * @param {String} expression - parametrized condition for query
 * @param {Object} expressionValues - values for expression
 *
 * @returns {Promise<any>} - returns the resultsfrom the query in the DB
 */
const query = (expression, expressionValues, index, filterExpression) => {
    const queryParams = {
        TableName: EXPIRATION_WALLET_TABLE,
        KeyConditionExpression: expression,
        ExpressionAttributeValues: expressionValues,
    };
    if (index) {
        queryParams.IndexName = index;
    }
    if (filterExpression) {
        queryParams.FilterExpression = filterExpression;
    }
    return DBUtils.query(queryParams);
};

/**
 * Returns specific entry
 * @param gppUserId
 * @param expirationId
 */
module.exports.get = (gppUserId, expirationId) => {
    const getParams = {
        TableName: EXPIRATION_WALLET_TABLE,
        Key: {
            gpp_user_id: gppUserId,
            expiration_id: expirationId,
        },
    };
    return DBUtils.get(getParams);
};

/**
 * Returns user expiration wallet data for provided user id and the concatenation between currencyId and ValidThru
 *
 * @param {String} gppUserId - concatenation of userId and userIdType using {@link Utils.concatenateColumnValues}
 * @param {String }expirationId - expirationid combining currencyId and validThru timestamp for filtration
 *
 * @returns {Promise<any>} - returns query from the DB.
 * @
 */
module.exports.mainQuery = (gppUserId, expirationId) => this.get(gppUserId, expirationId);

/**
 * Queries the expiration wallet table for the specific user and gets the currencies which are not expired.
 *
 * @returns {Promise<any>} - result of the query of the wallet with the specific data.
 */

module.exports.queryUserAndNotExpiredCurrencies = (gppUserId, currencyId) => {
    const expression = 'gpp_user_id = :gpp_user_id AND currency_id = :currency_id';
    const expressionValues = {
        ':gpp_user_id': gppUserId,
        ':currency_id': currencyId,
        ':zero': 0,
    };
    const index = 'expiryUserAndCurrencyId';
    const filterExpression = 'already_spent = :zero OR attribute_not_exists(already_spent)';

    return query(expression, expressionValues, index, filterExpression);
};

/**
 * Queries the expiration wallet table for the specific user and gets the currencies which are not expired.
 *
 * @param {String} userId - origin userId (CID's uuid or email string or BAMBOO ID etc.)
 *
 * @returns {Promise<any>} - result of the query of the wallet with the specific data.
 */

module.exports.queryUnspentCurrenciesByUser = (userId) => {
    const gppUserId = Utils.createGppUserId(userId);
    const expression = 'gpp_user_id = :gpp_user_id AND already_spent = :zero';
    const expressionValues = {
        ':gpp_user_id': gppUserId,
        ':zero': 0,
    };
    const index = 'queryByUserAndAlreadySpent';

    return query(expression, expressionValues, index);
};

/**
 * Returns user expiration wallet data for provided split value of gpp user id (concatenation will be made using
 *
 * {@link Utils.concatenateColumnValues} automatically.
 *
 * @param {String} userId - origin userId (CID's uuid or email string or BAMBOO ID etc.)
 * @param {String} userIdType - defines origin/type of userId ("CID", "email", "BAMBOO" etc.)
 *
 * @returns {Promise<any>} - Promise with the found user.
 */
module.exports.mainQueryWithSplitValues = (userId, userIdType, expirationId) => {
    const gppUserId = Utils.concatenateColumnValues(userId, userIdType);
    return this.mainQuery(gppUserId, expirationId);
};

/**
 * Check if it needs to update the currency or add a new one if it does not exist into expiration wallet
 *
 * @param {Object} params - event params
 *
 * @returns {Object | Promise} - returns Resolved Promise with params for DynamoDB table
 * Put or goes tocreateConditionalUpdateParams for already existing table row.
 */
module.exports.buildPutOrUpdateItem = async (params) => {
    const {
        gppUserId,
        currencyId,
        currencyName,
        validThru,
        configurationId,
        updateCurrencyExpirationPerTransaction,
        amount,
        userIdType,
        transactionType,
        lastModified,
    } = params;
    const expirationId = Utils.concatenateColumnValues(currencyId, validThru, configurationId);
    let items;

    if (updateCurrencyExpirationPerTransaction && updateCurrencyExpirationPerTransaction[currencyId]) {
        const transactions = [];

        let finalAmount = amount;
        let alreadySpent = 0;
        let spentAmount = 0;

        const expression = 'gpp_user_id = :gpp_user_id';

        const filterExpression = [
            'currency_id = :currency_id',
            'configuration_id = :configuration_id',
            'valid_thru > :valid_thru',
        ].join(' AND ');

        const expressionValues = {
            ':gpp_user_id': gppUserId,
            ':currency_id': currencyId,
            ':configuration_id': configurationId,
            ':valid_thru': new Date().getTime(),
        };

        items = await query(expression, expressionValues, undefined, filterExpression);

        const [item] = items;

        if (item) {
            finalAmount += items[0].amount;
            alreadySpent += items[0].already_spent;
            spentAmount += items[0].spent_amount;
        }

        if (item && item.valid_thru !== validThru) {
            transactions.push({
                Delete: {
                    TableName: EXPIRATION_WALLET_TABLE,
                    Key: {
                        gpp_user_id: gppUserId,
                        expiration_id: item.expiration_id,
                    },
                },
            });
        }

        transactions.push({
            Put: {
                TableName: EXPIRATION_WALLET_TABLE,
                Item: {
                    gpp_user_id: gppUserId,
                    expiration_id: expirationId,
                    valid_thru: validThru,
                    currency_id: currencyId,
                    currency_name: currencyName || 'Currency name not specified',
                    amount: finalAmount,
                    last_modified: lastModified,
                    configuration_id: configurationId,
                    already_spent: alreadySpent,
                    spent_amount: spentAmount,
                },
            },
        });

        return transactions;
    }

    items = await this.mainQuery(gppUserId, expirationId);

    if (items.length > 0) {
        return createConditionalUpdateCurrencyParams(
            items,
            gppUserId,
            expirationId,
            validThru,
            currencyId,
            amount,
            userIdType,
            transactionType,
        );
    } if (transactionType === TRANSACTION_TYPES.earn) {
        return [{
            Put: {
                TableName: EXPIRATION_WALLET_TABLE,
                Item: {
                    gpp_user_id: gppUserId,
                    expiration_id: expirationId,
                    valid_thru: validThru,
                    currency_id: currencyId,
                    currency_name: currencyName || 'Currency name not specified',
                    amount,
                    last_modified: lastModified,
                    configuration_id: configurationId,
                    already_spent: 0,
                    spent_amount: 0,
                },
            },
        }];
    }
    const errResponse = createUpdateImpossibleErrorResponse();
    throw errResponse;
};

/**
 * Creates error response when the data in the update/create params is not existent.
 *
 * @returns {String|Number} - returns string with the error body and error number.
 */

const createUpdateImpossibleErrorResponse = () => {
    const errorBody = Utils.createErrorBody(DYNAMO_DB_ERROR,
        "Can't update unexisting data",
        { reason: DBUtils.EXCEPTIONS.VALIDATION_EXCEPTION });
    return Utils.createResponse(RESPONSE_FORBIDDEN, errorBody);
};

/**
 * Creates update amount params for the expiration wallet record.
 * @param {String} gppUserId - gppuserid provided from the previous fun
 * @param {String} exporationId - expirationId conca of gppuser and validthru
 * @param {Number} addAmount - number to be added
 * @param {Number} conditionAmount - number to be conditioned, takes the value from the "amount" in the current row
 * and compares in to the amount to make sure they are the same.
 *
 * @returns {Object} returns params for inserting into update table.
 */
const createUpdateCurrencyAmountParams = (gppUserId, expirationId, addAmount, conditionAmount, spentAmount) => {
    const totalAmount = addAmount + conditionAmount;
    return [{
        Update: {
            ExpressionAttributeValues: {
                ':addAmount': addAmount,
                ':conditionAmount': conditionAmount,
                ':spentAmount': spentAmount,
                ':totalAmount': totalAmount,
                ':zero': 0,
            },
            Key: {
                gpp_user_id: gppUserId,
                expiration_id: expirationId,
            },
            ReturnValues: 'ALL_NEW',
            TableName: EXPIRATION_WALLET_TABLE,
            ConditionExpression: ':addAmount > :zero AND amount = :conditionAmount AND :totalAmount > :spentAmount',
            UpdateExpression: 'SET amount = amount + :addAmount, already_spent = :zero',
        },
    }];
};

/**
 * Function that prepares conditional update parameters. Queries expiration wallet for amount, used for ConditionExpression, and
 * validates if update params are ok. These validations are needed because these are condition parameters, meaning that
 * we will reuse this function if there was exception in which case previously valid request can be no longer valid,
 * depending on change that happened.
 *
 * @param {Object} items- array of objects with all found items from the previous request.
 * @param {String} gppUserId- gppUserId provided from the previous fun
 * @param {String} expirationId - expirationId - concatenated values of gppuserid and validthru.
 * @param {Number} ValidThru - number of validthru timestamp.
 * @param {String} currencyId - representation of the name of the currencyId
 * @param {Number} addAmount - amount to be added to the current amount in the params
 * @param {Number} transType - type of the transaction - spend or earn.
 *
 * @returns {Promise<any>} Resolved promise with next func.
 *
 */
const createConditionalUpdateCurrencyParams = (items, gppUserId, expirationId, validThru, currencyId, addAmount, transType) => {
    if (!items || items.length <= 0) {
        const response = createUpdateImpossibleErrorResponse();
        return Promise.reject(response);
    }

    // Logic for spending currencies should be implement here in the next story.
    if (transType === TRANSACTION_TYPES.spend) {
        addAmount = -addAmount;
    }

    if (items[0].amount + addAmount < 0) {
        const errorBody = Utils.createErrorBody(DYNAMO_DB_ERROR,
            'Trying to spend currency that the user does not have!');
        return Promise.reject(Utils.createResponse(RESPONSE_FORBIDDEN, errorBody));
    }

    // all checks passed, create update params....
    const conditionAmount = items[0].amount;
    const spentAmount = items[0].spent_amount;
    return createUpdateCurrencyAmountParams(gppUserId, expirationId, addAmount, conditionAmount, spentAmount);
};

/**
 * Returns all available digital codes that have expiry date set in past
 */
module.exports.getExpiredCurrencies = () => {
    const moment = Moment();
    const currentTimestamp = moment.toDate().getTime();

    const expression = 'already_spent = :false and valid_thru < :current_timestamp';
    const expressionValues = {
        ':false': 0,
        ':current_timestamp': currentTimestamp,
    };

    const index = 'expirationCheck';
    return query(expression, expressionValues, index);
};

/**
 * Build and return expiration_wallet update parameters for an expired record.
 * This is then used in db.transactWrite together with a transaction put record and user_wallet update record
 */
const buildExpireUpdate = (currency) => {
    currency.spent_amount = currency.spent_amount ? currency.spent_amount : 0;
    const expiredAmount = currency.amount - currency.spent_amount;
    const moment = Moment();
    const currentTimestamp = moment.toDate().getTime();
    return {
        Update: {
            ExpressionAttributeValues: {
                ':expiredAmount': expiredAmount,
                ':true': 1,
                ':false': 0,
                ':current_timestamp': currentTimestamp,
                ':spent_amount': currency.spent_amount,
            },
            Key: {
                gpp_user_id: currency.gpp_user_id,
                expiration_id: currency.expiration_id,
            },
            ReturnValues: 'ALL_NEW',
            TableName: EXPIRATION_WALLET_TABLE,
            ConditionExpression: 'already_spent = :false AND valid_thru < :current_timestamp AND spent_amount = :spent_amount',
            UpdateExpression: 'SET expired_amount = :expiredAmount, already_spent = :true',
        },
    };
};

/**
 * Returns all available digital codes that have expiry date set in past
 */
module.exports.expireCurrency = async (gppUserId, expirationId) => {
    const currency = await this.mainQuery(gppUserId, expirationId);
    const res = await buildExpireUpdate(currency[0]);
    return res;
};

/**
 * The function receives parameters and updates the expired wallet table accordingly,
 * depending on the amount which needs to be expensed and other factors.
 *
 * @param {Object} params - parameters passed from event
 * @param {Number} recordInExpiredWallet - exact row in the expired wallet table
 * @param {Number} leftAmountInLastRow - current state of "amount" in the current expired wallet table
 * @param {Number} spentAmountInLastRow -  current state of "spent_amount" in the current expired wallet table
 */

module.exports.updateRowInExpiredWallet = (recordInExpiredWallet, amountInSpent) => {
    const amountInRow = recordInExpiredWallet.amount;
    const updateParams = {
        TableName: EXPIRATION_WALLET_TABLE,
        ExpressionAttributeValues: {
            ':spent_amount': amountInSpent,
            ':already_spent': 1,
        },
        Key: {
            gpp_user_id: recordInExpiredWallet.gpp_user_id,
            expiration_id: recordInExpiredWallet.expiration_id,
        },
        ReturnValues: 'ALL_NEW',
        UpdateExpression: 'set spent_amount = :spent_amount, already_spent = :already_spent',
    };

    if (amountInRow > amountInSpent) {
        updateParams.ExpressionAttributeValues[':already_spent'] = 0;
        return DBUtils.update(updateParams);
    }
    return DBUtils.update(updateParams);
};
