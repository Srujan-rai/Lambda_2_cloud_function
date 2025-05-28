const uniqid = require('uniqid');
const Utils = require('../utility_functions/utilityFunctions');
const DBUtils = require('./dbUtilities');
const ConfigUtils = require('../self_service/configurationUtils');
const { ERROR_CODES: { CONFIGURATION_ERROR, INVALID_CURRENCY_ID } } = require('../constants/errCodes');
const { RESPONSE_INTERNAL_ERROR } = require('../constants/responses');

const { GPP_CURRENCY_TABLE } = require('../constants/tableNames');

module.exports.putEntry = (params, useExistingId) => {
    const entryDate = new Date().getTime();
    const insertParams = {
        TableName: GPP_CURRENCY_TABLE,
        Item: {
            currency_id: useExistingId ? params.currencyId : uniqid(),
            currency_family: params.currencyFamily,
            name: params.name,
            icon_url: params.iconUrl,
            country: params.country,
            origin: params.origin,
            entry_date: DBUtils.getInsertDate(entryDate),
        },
    };

    return DBUtils.putItem(insertParams);
};

/**
 * Core query for currency database. Called with condition expression,
 * values for that expression and index which is used.
 * @param expression - parametrized condition for query
 * @param expressionValues - values for expression
 * @param index - optional and specified if using secondary index (global | local)
 */
const query = (expression, expressionValues, index) => {
    const queryParams = {
        TableName: GPP_CURRENCY_TABLE,
        KeyConditionExpression: expression,
        ExpressionAttributeValues: expressionValues,
    };
    if (index) {
        queryParams.IndexName = index;
    }
    return DBUtils.query(queryParams);
};

/**
 * Get Item for currency database. Called with currencyId,
 * which will return a single item.
 * @param currencyId - primary key used to get a single item from DynamoDB
 * @returns {Promise} {@link get} result.
 */
const get = (currencyId) => {
    const getParams = {
        TableName: GPP_CURRENCY_TABLE,
        Key: {
            currency_id: currencyId,
        },
    };
    return DBUtils.get(getParams);
};

/**
 * getMultipleCurrencies get query. Called with condition expression,
 * values for that expression and index which is used.
 * @param expression - parametrized condition key for query by attributes
 * @param expressionValues - values for expression
 */
const getMultipleCurrencies = (expression, expressionValues, attrToGet) => {
    const keys = expressionValues.map((value) => ({ [expression]: value }));
    const batchParams = {
        RequestItems: {
            [GPP_CURRENCY_TABLE]: {
                Keys: keys,
            },
        },
    };

    if (attrToGet) {
        batchParams.RequestItems[GPP_CURRENCY_TABLE].AttributesToGet = attrToGet;
    }
    return DBUtils.batchGetItem(batchParams);
};

/**
 * Returns currency data for primary keys pair (currency_id)
 * @returns {Promise} {@link get} result.
 */
module.exports.mainQuery = (currencyId) => get(currencyId);

/**
 * queryByCountry
 * @param {string} country
 *
 * @return currency data for specific country
 */
module.exports.queryByCountry = (country) => {
    const expression = 'country = :country';
    const expressionValues = {
        ':country': country,
    };
    const index = 'countryIndex';
    return query(expression, expressionValues, index);
};

/**
 * Returns currency family data for specific currencyFamily
 */
module.exports.queryByCurrencyFamily = (currencyFamily) => {
    const expression = 'currency_family = :currency_family';
    const expressionValues = {
        ':currency_family': currencyFamily,
    };
    const index = 'currencyFamilyIndex';
    return query(expression, expressionValues, index);
};

/**
 * Returns all currencies for one configurationId.
 */
module.exports.queryByConfigurationId = (configuration) => {
    if (!configuration) {
        return Promise.reject(Utils.createResponseBadConfiguration());
    }
    const currencyArray = ConfigUtils.getCurrencyArray(configuration);
    const promises = currencyIdArrayToQueryPromiseArray(currencyArray);
    return Promise.all(promises)
        .catch((invalidCurrencyId) => {
            const errorBody = Utils.createErrorBody(
                CONFIGURATION_ERROR,
                "currency specified in configuration doesn't exist",
                { invalidCurrency: invalidCurrencyId },
            );
            const error = Utils.createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
            return Promise.reject(error);
        });
};

/**
 * Extracts all currency ids from the user wallet
 * if no user wallet a message is sent
 * if wallet is available all currencies are extracted in arr
 */
module.exports.extractCurrencyIdsFromWallet = (userWallet) => {
    if (!userWallet) {
        throw Utils.createResponseEmptyWallet();
    }
    return userWallet.map((obj) => obj.currency_id);
};

/**
 * Returns all currencie data for list of currencie ids
 */
module.exports.queryByArrayOfCurrencies = (currencyArr) => {
    const promises = currencyIdArrayToQueryPromiseArray(currencyArr);
    return Promise.all(promises)
        .catch((invalidCurrencyId) => {
            const errorBody = Utils.createErrorBody(
                INVALID_CURRENCY_ID,
                'currency specified in the request does not exist',
                { invalidCurrency: invalidCurrencyId },
            );
            const error = Utils.createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
            throw error;
        });
};

/**
 * Function that transforms array of mainQuery result items into single item (Array will always have one item actually
 * because primary key is used for query)
 */
const mainQueryWithSingleResult = async (currencyId) => {
    const items = await this.mainQuery(currencyId);
    // we expect only 1 item when querying by primary key
    if (items && items[0]) {
        return items[0];
    }
    throw currencyId;
};

/**
 * Transforms list of currencyIds to list of queryByCurrencyId promises.
 */
function currencyIdArrayToQueryPromiseArray(currencyIdArray) {
    if (!currencyIdArray) {
        return Promise.resolve([]);
    }
    const array = currencyIdArray.map((currencyId) => mainQueryWithSingleResult(currencyId));
    return array;
}

/**
 * Returns all currencies with scan.
 */
module.exports.scanAllCurrencies = () => {
    const scanParams = {
        TableName: GPP_CURRENCY_TABLE,
    };

    return DBUtils.scan(scanParams);
};

/**
 * queryByCurrenciesIds
 * @param {Array} currenciesIds
 * @return currency data for specific Ids
 */
module.exports.queryByCurrenciesIds = (currenciesIds, attrToGet) => getMultipleCurrencies('currency_id', currenciesIds, attrToGet);
