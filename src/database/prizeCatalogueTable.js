const uniqid = require('uniqid');
const Moment = require('moment-timezone');
const {
    createResponseInvalidParameter,
    omitNullValues,
    convertObjectStringsToPlainText,
    createResponseMissingParameters,
    createErrorBody,
    createErrBody,
    createResponse,
    createResponseNotEnoughPrizes,
    copyAsSnakeCase,
} = require('../utility_functions/utilityFunctions');
const {
    getConfigurationId,
} = require('../self_service/configurationUtils');
const {
    checkMandatoryParams,
    getPutTableParams,
    putItem,
    deleteItem,
    get: DBGet,
    query: DBQuery,
    EXCEPTIONS: { VALIDATION_EXCEPTION },
    getInsertDate,
    update,
    conditionalUpdate,
    scan,
    executeWithRetry,
} = require('./dbUtilities');
// TODO imported for usage of constants in non-exported functions, remove when we introduce models for tables
const { localizeResult } = require('../utility_functions/localizationUtilities');
const {
    PRIZE_CATALOGUE_COUNTERS, PARAMS_MAP, DELIVERY_TYPE, BARCODE_TYPE, FINAL_STATE,
} = require('../constants/common');
const { RESPONSE_FORBIDDEN, RESPONSE_BAD_REQUEST } = require('../constants/responses');
const { ERROR_CODES: { DYNAMO_DB_ERROR, NOT_FOUND }, ERR_CODES: { IW_DIGITAL_CODE_NOT_FOUND } } = require('../constants/errCodes');

const { GPP_PRIZE_CATALOGUE_TABLE } = require('../constants/tableNames');

const MANDATORY_PUT_PARAMS = {
    name: 'name', // string
    desc: 'desc', // string
    active: 'active', // bool
    configurationId: 'configuration_id', // string
    prizeId: 'prize_id', // string
    deliveryType: 'delivery_type', // string
    barcodeType: 'barcode_type', // string
    totalAmount: PRIZE_CATALOGUE_COUNTERS.TOTAL_AMOUNT, // number
    totalAvailable: PRIZE_CATALOGUE_COUNTERS.TOTAL_AVAILABLE, // number
};

const DEFAULT_PROJECTION_QUERY_COLUMNS = {
    name: 'name',
    desc: 'desc',
    shortDesc: 'short_desc',
    totalAvailable: PRIZE_CATALOGUE_COUNTERS.TOTAL_AVAILABLE,
    cost: 'cost',
    prizeUrlImage: 'img_url',
};

const ALLOWED_UPDATE_PARAMETERS = {
    name: 'name',
    desc: 'desc',
    shortDesc: 'short_desc',
    redeemDesc: 'redeem_desc',
    active: 'active',
    cost: 'cost',
    totalAmount: PRIZE_CATALOGUE_COUNTERS.TOTAL_AMOUNT,
    totalAvailable: PRIZE_CATALOGUE_COUNTERS.TOTAL_AVAILABLE,
    totalReserved: PRIZE_CATALOGUE_COUNTERS.TOTAL_RESERVED,
    totalExpired: PRIZE_CATALOGUE_COUNTERS.TOTAL_EXPIRED,
    imgUrl: 'img_url',
    imagesMetadata: 'images_metadata',
    deliveryType: 'delivery_type',
    redemptionLink: 'redemption_link',
    barcodeType: 'barcode_type',
    entryDate: 'entry_date',
    priority: 'priority',
    tags: 'tags',
    tier: 'tier',
    redemptionLimit: 'redemption_limit',
    minAge: 'min_age',
    finalState: 'final_state',
    activePartition: 'active_partition',
    totalPartitions: 'total_partitions',
    autoUploadVouchers: 'auto_upload_vouchers',
    hasEndDate: 'has_end_date',
    endDate: 'end_date',
    startDate: 'start_date',
    validityPeriodAfterClaim: 'validity_period_after_claim',
};
const ALLOWED_UPDATE_PARAMS = ALLOWED_UPDATE_PARAMETERS;

const REQUIRED_UPDATE_PARAMS = {
    configurationId: 'configuration_id',
    prizeId: 'prize_id',
};

const RICH_TEXT_COLUMNS = ['desc', 'short_desc', 'redeem_desc'];
const PRIZE_COLUMNS_RICH_TEXT = RICH_TEXT_COLUMNS;

const COUNTERS_PROJECTION = ['prize_id', ...Object.values(PRIZE_CATALOGUE_COUNTERS)];

/**
 * Adds default values for some of mandatory params in case they are missing.
 */
const addDefaultValuesToParams = (params) => {
    if (!Object.prototype.hasOwnProperty.call(params, PARAMS_MAP.PRIZE_ID)) {
        params.prizeId = uniqid();
    }
    if (!Object.prototype.hasOwnProperty.call(params, 'totalAvailable')) {
        params.totalAvailable = 0;
    }
    if (!Object.prototype.hasOwnProperty.call(params, 'totalAmount')) {
        params.totalAmount = 0;
    }
    params.entryDate = getInsertDate();
};

/**
 * Validate if value is in object
 * @param object
 * @param value -  required value in object
 * @returns {boolean}
 */
const isObjectContainingValue = (object, value) => {
    const filterArray = Object.keys(object).filter((key) => Object.is(object[key], value));
    return filterArray.length > 0;
};

const addStartEndDatesIfMissing = (inputPrizeList, configStartDate, configEndDate) => inputPrizeList.map((prizeObj) => {
    if (!prizeObj.end_date || !prizeObj.start_date) {
        return { ...prizeObj, start_date: configStartDate, end_date: configEndDate };
    }
    return prizeObj;
});
/**
 * Validate DeliveryType and BarCodeType
 * @param params - must be valid integer in DeliveryType and BarCodeType parameters
 * @returns {*}
 */
const validateAttributes = (params) => {
    const deliveryTypeValue = params.deliveryType !== '' ? Number(params.deliveryType) : params.deliveryType;
    const barCodeTypeValue = params.barcodeType !== '' ? Number(params.barcodeType) : params.barcodeType;
    const {
        priority, tier, active, redemptionLink,
    } = params;

    const invalidParams = [];

    if (Object.prototype.hasOwnProperty.call(params, PARAMS_MAP.DELIVERY_TYPE)
        && !isObjectContainingValue(DELIVERY_TYPE, deliveryTypeValue)
    ) {
        invalidParams.push(PARAMS_MAP.DELIVERY_TYPE);
    }
    if (Object.prototype.hasOwnProperty.call(params, PARAMS_MAP.BARCODE_TYPE) && !isObjectContainingValue(BARCODE_TYPE, barCodeTypeValue)) {
        invalidParams.push(PARAMS_MAP.BARCODE_TYPE);
    }
    if (Object.prototype.hasOwnProperty.call(params, PARAMS_MAP.FINAL_STATE) && !isObjectContainingValue(FINAL_STATE, params.finalState)) {
        invalidParams.push(PARAMS_MAP.FINAL_STATE);
    }
    if (params[ALLOWED_UPDATE_PARAMETERS.tags] && !Array.isArray(params[ALLOWED_UPDATE_PARAMETERS.tags])) {
        invalidParams.push(ALLOWED_UPDATE_PARAMETERS.tags);
    }
    if (active && typeof active !== 'boolean') {
        invalidParams.push(ALLOWED_UPDATE_PARAMETERS.active);
    }
    if (priority && !Number.isInteger(priority)) {
        invalidParams.push(ALLOWED_UPDATE_PARAMETERS.priority);
    }
    if (tier && !Number.isInteger(tier)) {
        invalidParams.push(ALLOWED_UPDATE_PARAMETERS.tier);
    }
    if (redemptionLink && typeof redemptionLink !== 'string') {
        invalidParams.push(ALLOWED_UPDATE_PARAMETERS.redemptionLink);
    }
    if (invalidParams.length <= 0) {
        return Promise.resolve();
    }
    const response = createResponseInvalidParameter(invalidParams);
    return Promise.reject(response);
};

/**
 * Function for putting prize values into PrizeCatalogue Table
 * @param params are received via post call
 * @returns {*} Promise of Error or Success insert
 */
const putEntry = async (params) => {
    addDefaultValuesToParams(params);
    checkMandatoryParams(params, MANDATORY_PUT_PARAMS);
    await validateAttributes(params);

    const tableParams = getPutTableParams(omitNullValues(params), GPP_PRIZE_CATALOGUE_TABLE);
    const res = await putItem(tableParams);
    return res;
};

/**
 * Remove prize from Prize Catalogue
 * @param configurationId
 * @param prizeId get from post parameter
 * @returns {Promise}
 */
const deletePrize = (configurationId, prizeId) => {
    const tableParams = {
        TableName: GPP_PRIZE_CATALOGUE_TABLE,
        Key: {
            prize_id: prizeId,
            configuration_id: configurationId,
        },
    };
    return deleteItem(tableParams);
};

/**
 * Filters provided params and returns json object composed of key - value pairs allowed to be updated in prize catalogue item.
 * Every param gets converted from camelCase to snake case notation needed for dynamo db table columns.
 * @param params - json object with key value pairs to be used for updating prize catalogue item
 */
const getUpdateParams = (params) => {
    const tmpObj = {
        ...params,
        entryDate: getInsertDate(),
    };
    const updateParams = {
        keys: {
            configuration_id: tmpObj[PARAMS_MAP.CONFIGURATION_ID],
            prize_id: tmpObj[PARAMS_MAP.PRIZE_ID],
        },
        columns: {},
    };
    delete tmpObj[PARAMS_MAP.CONFIGURATION_ID];
    delete tmpObj[PARAMS_MAP.PRIZE_ID];

    updateParams.columns = Object.keys(tmpObj).reduce((acc, param) => {
        if (param in ALLOWED_UPDATE_PARAMS) {
            acc[ALLOWED_UPDATE_PARAMS[param]] = tmpObj[param];
        }
        return acc;
    }, {});

    return copyAsSnakeCase(updateParams);
};

/**
 * Creates, prepares tableParams to be used (passed to DBUtils update function)
 * for updating prize catalogue item based on provided parameters
 * @param params - filtered params
 * @returns {{TableName: *}}
 */
const getUpdateTableParams = (params) => {
    const tableParams = {
        TableName: GPP_PRIZE_CATALOGUE_TABLE,
        Key: {
            configuration_id: params.keys.configuration_id,
            prize_id: params.keys.prize_id,
        },
    };

    const paramsObj = Object.keys(params.columns).reduce((acc, param) => {
        if (param === 'desc' || param === 'name') {
            acc.expressionAttributeValues[`:${param}`] = params.columns[param];
            acc.updateExpression += `#${param} = :${param}, `;
            acc.expressionAttributeNames[`#${param}`] = param;
            return acc;
        }

        if (params.columns[param] === null && !REQUIRED_UPDATE_PARAMS[param]) {
            acc.paramsToRemove.push(param);
            return acc;
        }

        acc.updateExpression += `${param} = :${param}, `;
        acc.expressionAttributeValues[`:${param}`] = params.columns[param];
        return acc;
    }, {
        expressionAttributeValues: {},
        expressionAttributeNames: {},
        paramsToRemove: [],
        updateExpression: 'set ',
    });

    paramsObj.updateExpression = paramsObj.updateExpression.slice(0, -2);

    if (paramsObj.paramsToRemove.length > 0) {
        paramsObj.updateExpression += ` remove ${paramsObj.paramsToRemove.join(', ')}`;
    }

    console.log('Update expression:\n', JSON.stringify(paramsObj.updateExpression));
    console.log('Expression attribute values:\n', JSON.stringify(paramsObj.expressionAttributeValues));

    tableParams.UpdateExpression = paramsObj.updateExpression;
    if (Object.keys(paramsObj.expressionAttributeNames).length > 0) {
        tableParams.ExpressionAttributeNames = paramsObj.expressionAttributeNames;
    }
    tableParams.ExpressionAttributeValues = paramsObj.expressionAttributeValues;
    tableParams.ReturnValues = 'UPDATED_NEW';
    return tableParams;
};

/**
 * Function for updating prize item with new values provided via params.
 * Only columns that are allowed to be updated will be affected.
 * @param params - json object for updating existing prize item
 */
const updateEntry = async (params) => {
    const updateParams = getUpdateParams(params);
    const tableParams = getUpdateTableParams(updateParams);
    await validateAttributes(params);
    return update(tableParams);
};

/**
 * Converts single prize item's rich attributes to plain text.
 *
 * @param {Object} prize - prize item (from prize catalogue table)
 * @returns {Object} prize item with converted attributes
 */
function convertPrizeAttributesToPlainText(prize) {
    RICH_TEXT_COLUMNS.forEach((element) => {
        prize[element] = convertObjectStringsToPlainText(prize[element]);
    });
    return prize;
}

/**
 * Converts all rich attributes to plain text, for all items in query result.
 *
 * @param {Array} queryResult - result of DynamoDB query.
 * @returns {Array} queryResult with items having plain text instead of rich text attributes.
 */
function convertAllPrizesAttributesToPlainText(queryResult) {
    const convertedPrizes = queryResult.map((singleResult) => convertPrizeAttributesToPlainText(singleResult));
    console.log('Finished converting prizes to plain text.');
    return convertedPrizes;
}

/**
 * Core query for prize catalogue table. Called with condition expression, values for that expression and index which is used.
 * @param {String} expression - parametrized condition for query
 * @param {Object} expressionValues - values for expression
 * @param {String} filterExpression - DynamoDB parameter for filtering the query results automatically
 * @param {String} textFormat - defines the wanted format of strings in query output (rich/plain)
 * @param {String} index - name of index used for query
 *
 * @returns {Array} list of items that satisfy provided conditions
 */
const query = async (expression, expressionValues, filterExpression, textFormat, index) => {
    const queryParams = {
        TableName: GPP_PRIZE_CATALOGUE_TABLE,
        KeyConditionExpression: expression,
        ExpressionAttributeValues: expressionValues,
    };

    if (filterExpression) {
        queryParams.FilterExpression = filterExpression;
    }

    if (index) {
        queryParams.IndexName = index;
    }

    const result = await DBQuery(queryParams);

    if (textFormat === 'plain') {
        return convertAllPrizesAttributesToPlainText(result);
    }
    return result;
};

/**
 * Get Item from prize catalogue database called with configurationId, prizeID
 * which will return a single item.
 * @param {String} configurationId - HASH key
 * @param {String} prizeId - SORT key
 * @param {String} textFormat - defines the wanted format of strings in query output (rich/plain)
 * @returns {Promise} {@link get} result.
 */
const get = async (configurationId, prizeId, textFormat) => {
    const getParams = {
        TableName: GPP_PRIZE_CATALOGUE_TABLE,
        Key: {
            configuration_id: configurationId,
            prize_id: prizeId,
        },
    };

    const result = await DBGet(getParams);
    if (textFormat === 'plain') {
        return convertAllPrizesAttributesToPlainText(result);
    }
    return result;
};

/**
 * Queries prize catalogue table by using prizeIdIndex.
 *
 * @param {String} configuration - Actual configuration. Used for localization purposes
 * @param {String} prizeId - Hash key for this Index
 * @param {String} textFormat - plain/rich
 * @param {String} language - wanted language for translation
 *
 * @returns {Promise} inherited from {@link DBUtils} query function
 */
const localizedQueryByPrizeId = async (configuration, prizeId, textFormat, language) => {
    const queryResult = await query('prize_id = :prizeId', { ':prizeId': prizeId }, undefined, textFormat, 'prizeIdIndex');
    return localizeResult({ queryResult, requestedLanguage: language, configuration });
};

/**
 * Returns prize catalogue data for primary keys pair (configurationId and prizeId).
 * @param {String} configurationId - Hash key for this table.
 * @param {String} prizeId - ID of wanted prize
 * @param {String} textFormat - defines the wanted format of strings in query output (rich/plain)
 * @returns {Promise} {@link get} result.
 */
const mainQuery = (configurationId, prizeId, textFormat) => get(configurationId, prizeId, textFormat);

/**
 * Returns prize catalogue data for key pair representing primary key in a required language (or in default language if
 * no match for required language)
 *
 * @param {Object} configuration - Actual configuration JSON
 * @param {String} prizeId - id of queried prize
 * @param {String} language - Code in RFC5646 format.
 * @param {String} textFormat - defines the wanted format of strings in query output (rich/plain)
 * @returns {Promise} list of items that satisfies query conditions, additionally localized, and in required text format.
 */
const localizedMainQuery = async (configuration, prizeId, language, textFormat) => {
    const configurationId = getConfigurationId(configuration);
    const queryResult = await mainQuery(configurationId, prizeId, textFormat);
    return localizeResult({ queryResult, requestedLanguage: language, configuration });
};

/**
 * Returns full list of prizes for provided configurationId.
 *
 * @param {String} configurationId - Hash key for this table.
 * @param {String} textFormat - defines the wanted format of strings in query output (rich/plain)
 */
const fullListQuery = async (configurationId, textFormat) => {
    const expression = 'configuration_id = :configuration_id';
    const expressionValues = {
        ':configuration_id': configurationId,
    };
    return query(expression, expressionValues, undefined, textFormat);
};

/**
 * Returns active/inactive list of prizes for provided configurationId.
 *
 * @param {String} configurationId - Hash key for this table.
 * @param {Boolean} active - parameter for filtering active/inactive prizes
 * @param {String} textFormat - defines the wanted format of strings in query output (rich/plain)
 * @returns {Array} list of items that satisfy provided conditions
 */
const filteredListQuery = (configurationId, active, textFormat) => {
    const expression = 'configuration_id = :configuration_id';
    const expressionValues = {
        ':configuration_id': configurationId,
        ':active': active,
    };
    const filterExpression = 'active = :active';
    return query(expression, expressionValues, filterExpression, textFormat);
};

const availableFilteredListQuery = (configurationId, textFormat) => {
    const expression = 'configuration_id = :configuration_id';
    const expressionValues = {
        ':configuration_id': configurationId,
        ':active': true,
        ':total_available': 0,
    };
    const filterExpression = `
        active = :active AND
        total_available > :total_available
    `;
    return query(expression, expressionValues, filterExpression, textFormat);
};

/**
 * Returns active prizes from always win pool of prizes
 *
 * @param {String} configurationId - Hash key for this table.
 * @param {Boolean} isRatioWinning - flag indicating whether ratio winning is enabled.
 * @returns {Array} list of items that satisfy provided conditions
 */
const alwaysWinPoolQuery = (configurationId, isRatioWinning = false) => {
    const expression = 'configuration_id = :configuration_id';
    const expressionValues = {
        ':configuration_id': configurationId,
        ':active': true,
        ':pool_prize': true,
        ':zero': 0,
    };

    const filterExpression = `
        active = :active AND
        pool_prize = :pool_prize AND
        ${isRatioWinning ? 'winning_ratio'
        : 'total_available'} > :zero
    `;
    return query(expression, expressionValues, filterExpression);
};

/**
 * Returns a prize record based on configuration_id and prize_id
 * @param {*} queryParams Contains configurationId, prizeId and textFormat
 * @returns {Promise}
 */
const queryByConfigIdAndPrizeId = (queryParams) => {
    const expression = 'configuration_id = :configuration_id AND prize_id = :prize_id';
    const expressionValues = {
        ':configuration_id': queryParams.configurationId,
        ':prize_id': queryParams.prizeId,
    };

    return query(expression, expressionValues, undefined, queryParams.textFormat);
};

const determineIfCNG = (inputFlowObject) => !!(Object.keys(inputFlowObject).filter((key) => (key === 'redeemPincodeForCurrencies') || (key === 'autoRedeemCnG')).length);

/**
 * Returns full list of prizes for one configurationId. Translatable values will be replaced with only translated value (string).
 *
 * @param {Object} configuration - Actual configuration JSON.
 * @param {String} filter - string value ["active", "inactive", "all", "available"],
 * representing the state of the prize based on its start and end date
 * @param {String} textFormat - defines the wanted format of strings in query output (rich/plain)
 *
 * @returns {Promise} list of items that satisfy provided conditions, or rejected with HTTP error response.
 */

const queryWithTimestampFilter = async (inputConfigurationId, filter, inputTextFormat, inputConfigStartDate, inputConfigEndDate) => {
    const currentTimestamp = Moment().unix() * 1000;
    /* The below block is kept as it includes more precise queries and will be usable once CCA
    converts to SS2 */

    // const filterExpressionMap = {
    //     active: 'start_date < :currentTimestamp AND end_date > :currentTimestamp',
    //     inactive: 'start_date > :currentTimestamp OR end_date < :currentTimestamp',
    //     available: '(start_date < :currentTimestamp AND end_date > :currentTimestamp) AND total_available > :zero',
    // };
    // const expressionValues = {
    //     ':configurationId': inputConfigurationId,
    //     ...(filter !== 'all' && { ':currentTimestamp': currentTimestamp }),
    //     ...(filter === 'available' && { ':zero': 0 }),
    // };
    // const expression = 'configuration_id = :configurationId';
    // return query(expression, expressionValues, filterExpressionMap[filter], inputTextFormat);

    const expressionValues = {
        ':configurationId': inputConfigurationId,
    };

    const expression = 'configuration_id = :configurationId';
    const fetchedPrizes = await query(expression, expressionValues, undefined, inputTextFormat);
    const addedDatesPrizes = addStartEndDatesIfMissing(fetchedPrizes, inputConfigStartDate, inputConfigEndDate);

    const filterStatusConditions = {
        active: (prize) => prize?.end_date > currentTimestamp && prize?.start_date < currentTimestamp,
        available: (prize) => prize?.end_date > currentTimestamp && prize?.start_date < currentTimestamp && prize?.total_available > 0,
        inactive: (prize) => prize?.end_date < currentTimestamp || prize?.start_date > currentTimestamp,
        all: () => true,
    };

    const filterCondition = filterStatusConditions[filter] || filterStatusConditions.active;
    return addedDatesPrizes.filter(filterCondition);
};

const statusFlagBasedQueryMap = (inputFilter, inputConfigurationId, inputTextFormat) => {
    const queryMap = {
        all: fullListQuery(inputConfigurationId, inputTextFormat),
        active: filteredListQuery(inputConfigurationId, true, inputTextFormat),
        inactive: filteredListQuery(inputConfigurationId, false, inputTextFormat),
        available: availableFilteredListQuery(inputConfigurationId, inputTextFormat),
    };
    return queryMap[inputFilter];
};

const updateFlagForCNGPrizes = (prizes) => {
    const currentTimestamp = Moment().unix() * 1000;
    return prizes.map((prize) => {
        let actualStatus;
        if ((prize?.end_date > currentTimestamp && prize?.start_date < currentTimestamp)) {
            actualStatus = true;
        } else if ((prize?.end_date < currentTimestamp) || (prize?.start_date > currentTimestamp)) {
            actualStatus = false;
        }
        return { ...prize, active: actualStatus };
    });
};

/**
 * Returns full list of prizes for one configurationId. Translatable values will be replaced with only translated value (string).
 *
 * @param {Object} configuration - Actual configuration JSON.
 * @param {String} language - Code in RFC5646 format.
 * @param {String} filter - string value ["active", "inactive", "all"], representing which values of column 'active' should be returned
 * @param {String} textFormat - defines the wanted format of strings in query output (rich/plain)
 *
 * @returns {Promise} list of items that satisfy provided conditions, or rejected with HTTP error response.
 */

const localizedFullListQuery = async (configuration, language, filter, textFormat) => {
    const isCNG = determineIfCNG(configuration?.flow);
    const configurationId = getConfigurationId(configuration);
    const timeStampBasedQuery = (isCNG && queryWithTimestampFilter(configurationId, (filter || 'active'), textFormat, configuration?.configurationParameters?.configurationStartUtc,
        configuration?.configurationParameters?.configurationEndUtc));

    if (language == null) {
        return Promise.reject(createResponseMissingParameters([PARAMS_MAP.LANGUAGE]));
    }

    let queryResult = await executeWithRetry(() => timeStampBasedQuery || statusFlagBasedQueryMap((filter || 'active'), configurationId, textFormat));
    // eslint-disable-next-line
    isCNG && (queryResult = updateFlagForCNGPrizes(queryResult));
    return localizeResult({ queryResult, requestedLanguage: language, configuration });
};

/**
 * Query prize catalogue table by providing params array.
 * If array is empty or not provided, default projection columns will be used.
 * @param {String} configurationId - Hash key for this table.
 * @param {String} prizeId - id of queried prize
 * @param {Array} columns - [optional] - array that contains column names that will be used for projection in snake case notation
 * @param {String} textFormat - defines the wanted format of strings in query output (rich/plain)
 * @returns {Promise}
 */
const projectionQuery = async (configurationId, prizeId, columns, textFormat) => {
    if (!columns || !columns.length) {
        columns = Object.values(DEFAULT_PROJECTION_QUERY_COLUMNS);
    }
    let projectionExpression = '';
    const expressionAttributeNames = {};
    columns.forEach((column) => {
        projectionExpression += `#${column}, `;
        expressionAttributeNames[`#${column}`] = column;
    });
    projectionExpression = projectionExpression.slice(0, -2);
    const projectionParams = {
        TableName: GPP_PRIZE_CATALOGUE_TABLE,
        ProjectionExpression: projectionExpression,
        KeyConditionExpression: 'configuration_id = :configuration_id AND prize_id = :prize_id',
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: {
            ':configuration_id': configurationId,
            ':prize_id': prizeId,
        },
    };
    const result = await DBQuery(projectionParams);
    if (textFormat === 'plain') {
        return convertAllPrizesAttributesToPlainText(result);
    }
    return result;
};

/**
 * Queries prize catalogue with projection holding amount counters.
 *
 * @param {String} configurationId - Hash key for this table
 * @param {String} prizeId - Range key for this table
 *
 * @returns {Promise} resolved - Array with one or zero elements from prize catalogue table, with projection on amount counters.
 *                    rejected - HTTP error response
 */
const queryWithCountersProjection = async (configurationId, prizeId) => {
    const items = await projectionQuery(configurationId, prizeId, COUNTERS_PROJECTION, undefined);
    console.log('Projection query finished with items:\n', JSON.stringify(items));
    if (!items || items.length <= 0) {
        const errorBody = createErrorBody(DYNAMO_DB_ERROR,
            `No match for a prize with prizeId = ${prizeId
            } and configurationId = ${configurationId}`,
            { reason: VALIDATION_EXCEPTION });
        const errResponse = createResponse(RESPONSE_FORBIDDEN, errorBody);
        throw errResponse;
    } else {
        return items;
    }
};

/**
 * Private function. Suits as helper for constructing update amount parameters.
 */
const createIncrementAmountParameters = (configurationId, prizeId, incrementalAmount) => {
    const entryDate = getInsertDate();
    const updateParams = {
        TableName: GPP_PRIZE_CATALOGUE_TABLE,
        Key: {
            configuration_id: configurationId,
            prize_id: prizeId,
        },
        UpdateExpression: 'set #columnTotalAvailable = #columnTotalAvailable + :incrementalAmount, #columnTotalAmount = #columnTotalAmount + :incrementalAmount, entry_date = :entry_date',
        ExpressionAttributeValues: {
            ':incrementalAmount': incrementalAmount,
            ':entry_date': entryDate,
        },
        ExpressionAttributeNames: {
            '#columnTotalAvailable': ALLOWED_UPDATE_PARAMS.totalAvailable,
            '#columnTotalAmount': ALLOWED_UPDATE_PARAMS.totalAmount,
        },
        ReturnValues: 'UPDATED_NEW',
    };
    return updateParams;
};

/**
 * Updates a row in prize catalogue by adding specified amount to "total_amount" and "total_available"  column.
 * @param {String} configurationId - Target Configuration ID
 * @param {String} prizeId - Prize ID to be updated
 * @param {Number} incrementalAmount - The incremental value for the available and total amounts column
 * @returns {Object | updateParams} - The parameters that will be used to perform the update.
 *  */
const incrementPrizeAmounts = (
    configurationId,
    prizeId,
    incrementalAmount,
) => update(createIncrementAmountParameters(configurationId, prizeId, incrementalAmount));

/**
 * Function that creates update parameters for prize update after digital codes expiration
 *
 * @param {String} configurationId - Hash key for this table
 * @param {String} prizeId - Range key for this table
 * @param {String} columnsToDecrement - object with property = status of the the column we decrement and value = amount to decrement
 *
 * @returns {Promise} update params;
 */
const expiredCodesTotalsParameters = async (configurationId, prizeId, columnsToDecrement) => {
    await queryWithCountersProjection(configurationId, prizeId);
    const entryDate = getInsertDate();
    const incrementAmount = Object.values(columnsToDecrement).reduce((a, b) => a + b);
    const updateExpression = 'set entry_date = :entry_date, #columnToIncrement = if_not_exists(#columnToIncrement, :zero) + :incrementAmount';
    const conditionExpression = '';
    const updateParams = {
        TableName: GPP_PRIZE_CATALOGUE_TABLE,
        Key: {
            configuration_id: configurationId,
            prize_id: prizeId,
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: {
            ':entry_date': entryDate,
            ':incrementAmount': incrementAmount,
            ':zero': 0,
        },
        ExpressionAttributeNames: {
            '#columnToIncrement': 'total_expired',
        },
        ConditionExpression: conditionExpression,
        ReturnValues: 'UPDATED_NEW',
    };

    Object.keys(columnsToDecrement).forEach((key) => {
        updateParams.UpdateExpression += `, #columnToDecrement${key} = #columnToDecrement${key} - :decrementAmount${key}`;
        updateParams.ExpressionAttributeNames[`#columnToDecrement${key}`] = `total_${key}`;
        updateParams.ExpressionAttributeValues[`:decrementAmount${key}`] = columnsToDecrement[key];
        updateParams.ConditionExpression += `#columnToDecrement${key} >= :decrementAmount${key} AND `;
    });

    updateParams.ConditionExpression = updateParams.ConditionExpression.substring(0, updateParams.ConditionExpression.length - 5);

    return updateParams;
};

/**
 * Function that decrements {@param columnToDecrement} in favour of {@param columnToIncrement} by specified amount.
 *
 * @param {String} configurationId - Hash key for this table
 * @param {String} prizeId - Range key for this table
 * @param {String} columnToIncrement - Column name which needs to be incremented
 * by the same amount we decrement the {@param columnToDecrement}
 * @param {String} columnToDecrement - Column name which needs to be decremented
 * by the same amount we increment the {@param columnToIncrement}
 * @param {Number} amount - Amount which is deducted from total_available, and added to {@param columnToIncrement}.
 * @param {Number} activePartitionToBeUpdated - If it exists, Set the correct active_partition for the prize
 *
 * @returns {Promise} updated item or http error response;
 *
 */
const getUpdateCounterColumnConditionalParameters = async (
    configurationId, prizeId, columnToIncrement, columnToDecrement, amount, activePartitionToBeUpdated,
) => {
    const entryDate = getInsertDate();
    const reduceAmount = -amount;

    const updateExpression = 'set #columnToDecrement = if_not_exists(#columnToDecrement, :zero) + :reduceAmount, '
        + '#columnToIncrement = if_not_exists(#columnToIncrement, :zero) + :amount, '
        + 'entry_date = :entry_date';

    const conditionExpression = ':reduceAmount >= :zero OR ((attribute_exists(#columnToDecrement) AND #columnToDecrement >= :amount) OR (attribute_not_exists(#columnToDecrement) AND :amount <= :zero)) '
        + 'AND (:amount >= :zero) OR ((attribute_exists(#columnToIncrement) AND #columnToIncrement >= :reduceAmount) OR (attribute_not_exists(#columnToIncrement) AND :reduceAmount <= :zero))';

    const updateParams = {
        TableName: GPP_PRIZE_CATALOGUE_TABLE,
        Key: {
            configuration_id: configurationId,
            prize_id: prizeId,
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: {
            ':amount': amount,
            ':reduceAmount': reduceAmount,
            ':entry_date': entryDate,
            ':zero': 0,
        },
        ExpressionAttributeNames: {
            '#columnToIncrement': columnToIncrement,
            '#columnToDecrement': columnToDecrement,
        },
        ConditionExpression: conditionExpression,
        ReturnValues: 'UPDATED_NEW',
    };

    if (activePartitionToBeUpdated) {
        updateParams.ExpressionAttributeValues[':activePartition'] = activePartitionToBeUpdated;
        updateParams.UpdateExpression += ', active_partition = :activePartition';
    }

    return Promise.resolve(updateParams);
};

/**
 * Creates transaction item for updating prize counters.
 *
 * @param {String} configurationId - id of a configuration (Hash key for prize catalogue table)
 * @param {String} prizeId - Id of a prize (Sort key for this table)
 * @param {String} columnToIncrement - Name of a column that needs to be incremented
 * @param {String} columnToDecrement - Name of a column that needs to be decremented
 * @param {Number} amount - Amount used for increment and decrement (amount of vouchers that transferred status)
 * @param {Number} activePartitionToBeUpdated - Set the correct active_partition for the prize
 *
 * @returns {Object} Update item in a format of dynamoDB TransactItem items. Suitable for creating dynamoDB transaction.
 */
const createUpdateCountersTransactionItem = async (
    configurationId,
    prizeId,
    columnToIncrement,
    columnToDecrement,
    amount,
    activePartitionToBeUpdated,
) => {
    const updateParams = await getUpdateCounterColumnConditionalParameters(
        configurationId,
        prizeId,
        columnToIncrement,
        columnToDecrement,
        amount,
        activePartitionToBeUpdated,
    );
    console.log(`UPDATE PARAMS: ${JSON.stringify(updateParams)}`);
    const transactItem = {
        Update: updateParams,
    };
    return transactItem;
};

/**
 * Creates transaction item for updating prize entry_date & active_partition attributes.
 *
 * @param {String} configurationId - id of a configuration (Hash key for prize catalogue table)
 * @param {String} prizeId - Id of a prize (Sort key for this table)
 * @param {String} entryDate - Date in yyyy-mm-dd format
 * @param {Number} activePartitionToBeUpdated - Set the correct active_partition for the prize
 *
 * @returns {Object} Update item in a format of dynamoDB TransactItem items. Suitable for creating dynamoDB transaction.
 */
const createUpdatePrizeEntryDateTransactionItem = (configurationId, prizeId, entryDate, activePartitionToBeUpdated) => {
    const updateParams = {
        TableName: GPP_PRIZE_CATALOGUE_TABLE,
        Key: {
            configuration_id: configurationId,
            prize_id: prizeId,
        },
        UpdateExpression: 'set entry_date = :entry_date',
        ExpressionAttributeValues: {
            ':entry_date': entryDate,
        },
        ReturnValues: 'UPDATED_NEW',
    };

    if (activePartitionToBeUpdated) {
        updateParams.ExpressionAttributeValues[':activePartition'] = activePartitionToBeUpdated;
        updateParams.UpdateExpression += ', active_partition = :activePartition';
    }

    return {
        Update: updateParams,
    };
};

/**
 * Creates parameters for atomic counter update
 *
 * @param {String} configurationId - id of a configuration (Hash key for prize catalogue table)
 * @param {String} prizeId - Id of a prize (Sort key for this table)
 * @param {String} columnToIncrement - Column that will be incremented (eg: total_claimed, total_reserved)
 *
 * @returns {Object} update parameters for DynamoDB operation.
 */
const createReduceTotalAvailParams = (configurationId, prizeId, columnToIncrement) => {
    const updateExpression = 'set total_available = total_available - :amount, '
        + '#columnToIncrement = if_not_exists(#columnToIncrement, :zero) + :amount';

    const updateParams = {
        TableName: GPP_PRIZE_CATALOGUE_TABLE,
        Key: {
            configuration_id: configurationId,
            prize_id: prizeId,
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: {
            ':amount': 1,
            ':zero': 0,
        },
        ExpressionAttributeNames: {
            '#columnToIncrement': columnToIncrement,
        },
        ReturnValues: 'UPDATED_NEW',
    };

    return updateParams;
};

/**
 * Atomic prize counters update
 *
 * @param {String} configurationId - id of a configuration (Hash key for prize catalogue table)
 * @param {String} prizeId - Id of a prize (Sort key for this table)
 * @param {String} columnToIncrement - Column that will be incremented (eg: total_claimed, total_reserved)
 * @param {String} entryDate - entryDate of a prize
 *
 * @returns {Promise} updated item or error response.
 */
const updatePrizeCountersForRedeem = (configurationId, prizeId, columnToIncrement, entryDate) => {
    const dbInsertDate = getInsertDate();
    const params = createReduceTotalAvailParams(configurationId, prizeId, columnToIncrement);

    if (entryDate && entryDate !== dbInsertDate) {
        params.UpdateExpression += ', entry_date = :entry_date';
        params.ExpressionAttributeValues[':entry_date'] = dbInsertDate;
    }

    return update(params);
};

/**
 * Increments total_expired and decrements total_available/total_claimed/total_reserved/total_redeemed for specified prize and amount.
 *
 * @param {String} configurationId - configurationId - Hash key for this table.
 * @param {String} prizeId - prize to be updated
 * @param {String} columnsToDecrease -object with key/values of statuses to decrease
 *
 * @returns {Promise} inherited by {@link conditionalUpdate}
 */
const updateCountersForExpiredPrize = (configurationId, prizeId, columnsToDecrease) => conditionalUpdate(
    () => expiredCodesTotalsParameters(configurationId, prizeId, columnsToDecrease),
);

/**
 * Increments total_removed and decrements total_available for specified prize and amount.
 *
 * @param {String} configurationId - configurationId - Hash key for this table.
 * @param {String} prizeId - prize to be updated
 * @param {Number} amount - amount to be updated
 *
 * @returns {Promise} inherited by {@link conditionalUpdate}
 */
const updateCountersForRemovedPrize = (configurationId, prizeId, amount) => conditionalUpdate(
    () => getUpdateCounterColumnConditionalParameters(
        configurationId,
        prizeId,
        PRIZE_CATALOGUE_COUNTERS.TOTAL_REMOVED,
        PRIZE_CATALOGUE_COUNTERS.TOTAL_AVAILABLE,
        amount,
    ),
);

/**
 * Increments total_redeemed and decrements {@param columnToDecrement} for specified prize and amount.
 *
 * @param {String} configurationId - configurationId - Hash key for this table.
 * @param {String} prizeId - prize to be updated
 * @param {Number} amount - amount to be updated
 * @param {String} columnToDecrement - name of the column that corresponds to the counter
 * that needs to be decremented. Should be one of ["reserved", "claimed"]
 *
 * @returns {Promise} inherited by {@link conditionalUpdate}
 */
const updateCountersForRedeemedPrize = (configurationId, prizeId, amount, columnToDecrement) => conditionalUpdate(
    () => getUpdateCounterColumnConditionalParameters(
        configurationId,
        prizeId,
        PRIZE_CATALOGUE_COUNTERS.TOTAL_REDEEMED,
        columnToDecrement,
        amount,
    ),
);

/**
 * Gets all prizes from prize catalogue table
 *
 * @returns {Promise<any>} - Returns Promise with the result of the scan
 */
const getAllPrizes = () => {
    const params = {
        TableName: GPP_PRIZE_CATALOGUE_TABLE,
    };
    return scan(params);
};

/**
 * Query prize catalogue table by prize ID
 *
 * @param {string} prizeId - Prize ID
 * @returns {Promise<any>} - Returns Promise with the result of the query
 */
const queryByPrizeId = (prizeId) => query('prize_id = :prize_id', { ':prize_id': prizeId },
    undefined, undefined, 'prizeIdIndex');

/**
 * Query prize catalogue table by autoUploadVouchers parameter
 */
const queryAutoUploadPrizes = () => query('auto_upload_vouchers = :auto_upload_vouchers', { ':auto_upload_vouchers': '1' },
    undefined, undefined, 'autoUploadVouchers');

/**
 * This update is returned back to the calling function to be added into the transactionItems Array.
 * The actions performed will decrement total reserved and increment total available, effectively reversing the reserved prize.
 * @param {String} configurationId - configurationId - Hash key for this table.
 * @param {String} prizeId - prize to be updated
 * @param {Number} amount - amount to be updated
 * @returns {Object} inherited by {@link winningMomentsValidationLambda.revertPrizeCounters}
 */
const getReservedAndClaimedCountersUpdateParams = (configurationId, prizeId, amount) => ({
    Update: {
        TableName: GPP_PRIZE_CATALOGUE_TABLE,
        Key: {
            configuration_id: configurationId,
            prize_id: prizeId,
        },
        UpdateExpression: 'SET total_reserved = total_reserved - :amount, total_available = total_available + :amount',
        ExpressionAttributeValues: {
            ':amount': amount,
        },
        ReturnValues: 'UPDATED_NEW',
    },
});

/**
 * Gets all auto redeem prizes for a specific configuration ID
 *
 * @param {string} configurationId - Configuration ID
 * @returns {Array} - Returns an Array of prizes
 */
const getAutoRedeemPrizesByConfigurationId = (configurationId) => query('configuration_id = :configurationId',
    { ':configurationId': configurationId, ':autoRedeem': true },
    'auto_redeem = :autoRedeem');

/**
 * Sets total_available counter to zero
 *
 * @param {string} configurationId - Configuration ID
 * @param {string} prizeId - prize ID
 * @returns {Promise} rejects with http error response;
 */
const resetTotalAvailable = (prizeId, configId) => {
    const params = {
        configurationId: configId,
        totalAvailable: 0,
        prizeId,
    };
    return updateEntry(params)
        .then(() => Promise.reject(createResponseNotEnoughPrizes(prizeId, PRIZE_CATALOGUE_COUNTERS.TOTAL_AVAILABLE, 0)));
};

/**
 * Sets total available to 0 and total expired to the currently total available prizes
 * @param {String} prizeId - prizeId of prizeObject
 * @param {String} configId - configurationId of prizeObject
 * @param {Number} totalAvailable - total available in current prize object
 */
const expireAvailablePrizes = (prizeId, configId, totalAvailable) => {
    const params = {
        configurationId: configId,
        totalAvailable: 0,
        totalExpired: totalAvailable,
        hasEndDate: '0',
        prizeId,
    };
    return updateEntry(params);
};

/**
 * Query endDate index for prizes that have expired with hasEndDate attribute set to 1
 * @param {Number} date - timestamp to check against
 */
const queryEndDate = (date) => {
    const expression = 'has_end_date = :has_end_date AND end_date < :passedDate';
    const expressionValues = {
        ':has_end_date': '1',
        ':passedDate': date,
    };

    return query(expression, expressionValues, undefined, undefined, 'endDateIndex');
};

/**
 * Query Prize table for prizes with expirable moments.
 * @returns {Promise|Array}
 */
const queryPrizeWithExpirableMoments = () => {
    const expression = 'has_end_date = :has_end_date';
    const expressionValues = {
        ':has_end_date': '1',
        ':has_expirable_moments': true,
    };

    const filter = 'has_expirable_moments = :has_expirable_moments';

    return query(expression, expressionValues, filter, undefined, 'endDateIndex');
};

/**
 * Query Prize table to check if at least one prize for configuration have vouchers.
 * @param {String} configId - configurationId of prizeObject
 * @returns {Promise} resolved
 *                    rejected - Error response
 */
const checkPrizeAvailability = async (configId) => {
    const queryResult = await fullListQuery(configId);
    const notAvailablePrizes = queryResult.every((prize) => prize.total_available === 0);
    if (notAvailablePrizes) {
        const errorBody = createErrBody(IW_DIGITAL_CODE_NOT_FOUND, 'Not enough vouchers available',
            undefined, NOT_FOUND);
        throw createResponse(RESPONSE_BAD_REQUEST, errorBody);
    }
};

module.exports = {
    MANDATORY_PUT_PARAMS,
    DEFAULT_PROJECTION_QUERY_COLUMNS,
    ALLOWED_UPDATE_PARAMS,
    REQUIRED_UPDATE_PARAMS,
    PRIZE_COLUMNS_RICH_TEXT,
    putEntry,
    deletePrize,
    updateEntry,
    get,
    localizedQueryByPrizeId,
    mainQuery,
    localizedMainQuery,
    fullListQuery,
    determineIfCNG,
    addStartEndDatesIfMissing,
    filteredListQuery,
    queryByConfigIdAndPrizeId,
    localizedFullListQuery,
    projectionQuery,
    queryWithCountersProjection,
    incrementPrizeAmounts,
    createUpdateCountersTransactionItem,
    createUpdatePrizeEntryDateTransactionItem,
    updatePrizeCountersForRedeem,
    updateCountersForExpiredPrize,
    updateCountersForRemovedPrize,
    updateCountersForRedeemedPrize,
    getAllPrizes,
    queryByPrizeId,
    queryAutoUploadPrizes,
    getReservedAndClaimedCountersUpdateParams,
    getAutoRedeemPrizesByConfigurationId,
    resetTotalAvailable,
    expireAvailablePrizes,
    queryEndDate,
    alwaysWinPoolQuery,
    queryPrizeWithExpirableMoments,
    checkPrizeAvailability,
    convertPrizeAttributesToPlainText,
};
