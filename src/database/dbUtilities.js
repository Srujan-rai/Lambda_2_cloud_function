const { captureAWSv3Client } = require('aws-xray-sdk-core');
const {
    QueryCommand,
    PutCommand,
    BatchWriteCommand,
    ScanCommand,
    BatchGetCommand,
    UpdateCommand,
    DeleteCommand,
    GetCommand,
    TransactWriteCommand,
} = require('@aws-sdk/lib-dynamodb');
const { DYNAMO_DB_EXCEPTIONS: EXCEPTIONS } = require('../constants/dbExceptions');
const {
    createResponse,
    createErrBody,
    copyAsCamelCase,
    copyAsSnakeCase,
    createErrorBody,
    sleep,
    randomInt,
    parseBody,
} = require('../utility_functions/utilityFunctions');
const { ERROR_CODES, ERR_CODES } = require('../constants/errCodes');
const { RESPONSE_OK, RESPONSE_INTERNAL_ERROR, RESPONSE_BAD_REQUEST } = require('../constants/responses');
const { createDocClientManager } = require('../awsSdkClientManager');

const docClientManager = createDocClientManager();

const DB_FUNCTION_RECOVER = {
    recoveryAttempts: 5,
    minRetryMills: 450,
    maxRetryMills: 650,
};

const retryableErrors = [
    EXCEPTIONS.CONDITIONAL_CHECK_FAILED_EXCEPTION,
    EXCEPTIONS.TRANSACTION_CANCELED_EXCEPTION,
    EXCEPTIONS.TRANSACTION_CONFLICT_EXCEPTION,
    EXCEPTIONS.INTERNAL_SERVER_ERROR,
    EXCEPTIONS.THROTTLING_EXCEPTION,
];

/**
 * Separator character used for merging two columns into one (delimiter for split)
 */

/**
 * Inserts new item into specified DynamoDB table based on TableName and Item specification object provided through tableParams
 * @param tableParams - TableName and Item specification object - json of (key, value) attributes
 * @returns {Promise<any>}
 */
const putItem = async (tableParams, logging = true) => {
    const client = captureAWSv3Client(docClientManager.getDocClient());
    tableParams = JSON.parse(JSON.stringify(tableParams));
    try {
        const data = await client.send(new PutCommand(tableParams));
        if (logging) console.log('Successfully put item into', tableParams.TableName, 'table:\n', JSON.stringify(data));
        const insertedItem = copyAsCamelCase(tableParams.Item);
        const response = createResponse(RESPONSE_OK, { entryInserted: true, entry: insertedItem });
        return response;
    } catch (err) {
        if (logging) console.error('ERROR: Failed to put data into', tableParams.TableName, 'table:\n', JSON.stringify(err));
        const errorBody = createErrBody(ERR_CODES.DYNAMO_DB_ERROR_PUT, 'Failed to save new entry',
            { DynamoDBCode: err.name }, ERROR_CODES.DYNAMO_DB_ERROR);
        const errResponse = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
        throw errResponse;
    }
};

/**
 * Perform batchWrite into table
 * @param params - DynamoDb batch write styled json object
 */
const batchWrite = async (params) => {
    const client = captureAWSv3Client(docClientManager.getDocClient());
    params = JSON.parse(JSON.stringify(params));
    try {
        const data = await client.send(new BatchWriteCommand(params));
        console.log('Successfully performed batch write');
        return data;
    } catch (err) {
        console.error('ERROR: Failed to perform batch write for', params.TableName, 'table:\n',
            err);
        throw err;
    }
};

const batchWriteToPromise = (params, clientOptions) => {
    const client = captureAWSv3Client(docClientManager.getDocClient(clientOptions));
    const paramsCopy = JSON.parse(JSON.stringify({
        ...params,
        ReturnConsumedCapacity: 'INDEXES',
    }, (key, value) => (typeof value === 'bigint' ? value.toString() : value)));

    return client.send(new BatchWriteCommand(paramsCopy));
};

/**
 * Queries DynamoDB and handles response.
 * @param {Object} queryParams - Provided by one of handlers for DynamoDB tables, represent the query parameters for DocumentClient.
 * @param {boolean} limitQuery - true/false - return the query result after reaching 1mb limit of data.
 */
const query = async (queryParams, limitQuery) => {
    const client = captureAWSv3Client(docClientManager.getDocClient());
    let data;
    let dataReceived = [];

    let ExclusiveStartKey;

    do {
        try {
            const params = { ...queryParams, ExclusiveStartKey };
            data = await client.send(new QueryCommand(params));
            dataReceived = data.Items?.length ? dataReceived.concat(data.Items) : [];
            console.log('Query for ', params.TableName, 'table succeeded');

            ExclusiveStartKey = data.LastEvaluatedKey;
            if (data.LastEvaluatedKey) console.log('more items to query.. continuing..');
        } catch (err) {
            console.error('ERROR: Failed to query', queryParams.TableName, 'table:\n', err);
            const errorBody = createErrBody(
                ERR_CODES.DYNAMO_DB_ERROR_QUERY,
                'Failed to read data',
                { DynamoDBCode: err.name },
                ERROR_CODES.DYNAMO_DB_ERROR,
            );
            const response = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
            throw response;
        }
    } while (data.LastEvaluatedKey && !limitQuery && !queryParams.Limit);

    console.log('No more items! Returning result...');
    return dataReceived;
};

/**
 * Queries DynamoDB with pagination options.
 * @param queryParams - Provided by one of handlers for DynamoDB tables, represent the query parameters for DocumentClient.
 * @param {Boolean} limitQuery - (optional) return the query result after reaching the limit provided.
 *  @param {Number} limit  - (optional) return the query result after reaching the limit provided.
 * @param {Array} keyAttributes - Array of strings - attributes of the LastEvaluatedKey (partition, sort, index key).Required with limit
 */

const queryWithPagination = async (queryParams, limitQuery, limit, keyAttributes) => {
    let dataReceived = [];
    let result;
    let { ExclusiveStartKey } = queryParams;

    const client = captureAWSv3Client(docClientManager.getDocClient());

    do {
        result = await client.send(new QueryCommand({ ...queryParams, ExclusiveStartKey }));
        ExclusiveStartKey = result.LastEvaluatedKey;
        dataReceived = [...dataReceived, ...result.Items];
    } while ((result.LastEvaluatedKey && result.Items?.length) && (!limitQuery || limit > dataReceived.length));

    if (limit && dataReceived[limit] && !ExclusiveStartKey) {
        ExclusiveStartKey = getLastEvaluatedKeyFromItem(dataReceived[limit - 1], keyAttributes);
    }

    return {
        dataReceived: dataReceived.slice(0, limit),
        ...limitQuery && { nextKey: ExclusiveStartKey },
    };
};

/**
 * Queries DynamoDB with limit options.
 * @param queryParams - Provided by one of handlers for DynamoDB tables, represent the query parameters for DocumentClient.
 *  @param {Number} limit  - return the result after reaching the limit provided regardless of the number of evaluated.
 */

const queryWithLimit = async (queryParams, limit) => {
    let dataReceived = [];
    let result;
    let { ExclusiveStartKey } = queryParams;

    const client = captureAWSv3Client(docClientManager.getDocClient());

    do {
        result = await client.send(new QueryCommand({ ...queryParams, ExclusiveStartKey }));
        dataReceived = [...dataReceived, ...result.Items];
        ExclusiveStartKey = result.LastEvaluatedKey;

        if (dataReceived.length >= limit) break;
    } while (result.LastEvaluatedKey && result.Items?.length);

    return dataReceived.slice(0, limit);
};

const getLastEvaluatedKeyFromItem = (item, keyAttributes) => keyAttributes.reduce((acc, key) => {
    acc[key] = item[key];
    return acc;
}, {});

/**
 * countQuery DynamoDB.
 * @param queryParams - Provided by one of handlers for DynamoDB tables, represent the query parameters for DocumentClient.
 * @return {Promise} - promise object with DocumentClient response
 */
const countQuery = async (queryParams, returnUserFromQuery = false) => {
    let totalCount = 0;
    const client = captureAWSv3Client(docClientManager.getDocClient());
    let data;
    let ExclusiveStartKey;

    do {
        try {
            const params = { ...queryParams, Select: 'COUNT', ExclusiveStartKey };
            data = await client.send(new QueryCommand(params));

            console.log('Query succeeded with:\n', JSON.stringify(data), totalCount);
            totalCount += data.Count;

            ExclusiveStartKey = data.LastEvaluatedKey;
        } catch (err) {
            console.error('ERROR: Failed with:\n', JSON.stringify(err));
            throw err;
        }
    } while (data.LastEvaluatedKey);
    return {
        ...data,
        Count: totalCount,
        ...(returnUserFromQuery ? { userID: queryParams.ExpressionAttributeValues[':gpp_user_id'] } : {}),
    };
};

/**
 * Scans DynamoDB and handles response
 * @param scanParams - Provided by one of handlers for DynamoDB tables, represent the fully created scan parameters.
 */
const scan = async (scanParams) => {
    const client = captureAWSv3Client(docClientManager.getDocClient());
    let dataReceived = [];
    let ExclusiveStartKey;

    do {
        try {
            const params = { ...scanParams, ExclusiveStartKey };
            const data = await client.send(new ScanCommand(params));

            console.log('Scan succeeded with data length: ', data.Count);
            dataReceived = dataReceived.concat(data.Items);

            ExclusiveStartKey = data.LastEvaluatedKey;
            if (data.LastEvaluatedKey) console.log('more items to query.. continuing..');
        } catch (err) {
            console.error('ERROR: Failed to scan', scanParams.TableName, 'table:\n',
                JSON.stringify(err));
            const errorBody = createErrBody(ERR_CODES.DYNAMO_DB_ERROR_SCAN, 'Failed to scan data', undefined, ERROR_CODES.DYNAMO_DB_ERROR);
            const response = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
            throw response;
        }
    } while (ExclusiveStartKey);

    console.log('No more items! Returning result...');
    return dataReceived;
};

/**
 * Batch DynamoDB and handles response
 * @param batchParams - Provided by one of handlers for DynamoDB tables, represent the batchGet parameters for DocumentClient.
 */
const batchGetItem = async (batchParams) => {
    const client = captureAWSv3Client(docClientManager.getDocClient());
    try {
        const data = await client.send(new BatchGetCommand(batchParams));
        console.log('Successfully performed batch get:', JSON.stringify(data));
        return data.Responses;
    } catch (err) {
        console.error('ERROR: Failed perform batch get from', batchParams.TableName, 'table:\n', JSON.stringify(err));
        const errorBody = createErrBody(ERR_CODES.DYNAMO_DB_ERROR_BATCH_GET, 'Failed to read data', undefined, ERROR_CODES.DYNAMO_DB_ERROR);
        const response = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
        throw response;
    }
};

/**
 * Update entity in DynamoDB and handles response.
 * @param updateParams - Provided by one of handlers for DynamoDB tables, represent the update parameters for DocumentClient.
 */
const update = async (updateParams, logging = true) => {
    const client = captureAWSv3Client(docClientManager.getDocClient());
    const params = JSON.parse(JSON.stringify(updateParams));
    try {
        const { Attributes } = await client.send(new UpdateCommand(params));
        return { Attributes };
    } catch (err) {
        if (logging) {
            console.log('ERROR while trying to update entity with params: ', updateParams);
            console.log(`ERROR: ${JSON.stringify(err)}`);
        }
        const errorBody = createErrBody(ERR_CODES.DYNAMO_DB_ERROR_UPDATE, 'Failed to update data', { DynamoDBCode: err.name }, ERROR_CODES.DYNAMO_DB_ERROR);
        const response = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
        throw response;
    }
};

const executeWithRetry = (func, retries = DB_FUNCTION_RECOVER.recoveryAttempts, exceptionToSkip) => func().catch((err) => {
    console.error('ERROR: Failed to perform operation\n', JSON.stringify(err));
    console.log('Attempts left: ', retries);
    const { errorDetails } = parseBody(err);

    let skipException = false;
    if (errorDetails.CancellationReasons) {
        skipException = errorDetails.CancellationReasons.every((reason) => reason.Code !== exceptionToSkip);
    }

    if (retries > 0
        && !skipException
        && retryableErrors.includes(errorDetails.DynamoDBCode)) {
        console.log('Retrying operation...');
        const { minRetryMills, maxRetryMills } = DB_FUNCTION_RECOVER;
        const throttleTime = randomInt(minRetryMills, maxRetryMills);
        return sleep(throttleTime).then(() => executeWithRetry(func, retries - 1, exceptionToSkip));
    }

    return Promise.reject(err);
});

/**
 * Function handling conditional update. Includes re-attempting for fixed amount of times in case of error.
 *
 * @param createUpdateParamsCallback - Callback function. Should (re-)creates parameters for
 *      conditional update. Needed in case of conditional update exception in which case condition needs to be updated.
 *      Expected return value of this callback is {@link Promise}
 *
 * @returns {Promise} inherited from {@link update}
 */
const conditionalUpdate = async (createUpdateParamsCallback) => {
    const updateParams = await createUpdateParamsCallback();
    return executeWithRetry(() => update(updateParams));
};

/**
 * Sets undefined or empty attributes of queryParams to empty string or empty JSON object for consistency sake.
 * Narrows down valid empty attributes (undefined, null, "", {}...) values to only 2 ("", {}).
 */
const initializeMissingQueryParametersAttributes = (queryParams) => {
    if (!queryParams) {
        queryParams = {
            KeyConditionExpression: '',
            ExpressionAttributeValues: {},
        };
    } else {
        if (!queryParams.KeyConditionExpression) {
            queryParams.KeyConditionExpression = '';
        }
        if (!queryParams.FilterExpression) {
            queryParams.FilterExpression = '';
        }
        if (!queryParams.ExpressionAttributeValues) {
            queryParams.ExpressionAttributeValues = {};
        }
    }
};

/**
 * Appends expression of specified type to queryParams.
 */
const appendExpression = (queryParams, expressionType, expression) => {
    queryParams[expressionType] += ` AND ( ${expression} )`;
};

/**
 * Creates or appends expression of specified type to queryParams.
 */
const addExpression = (queryParams, expressionType, expression) => {
    initializeMissingQueryParametersAttributes(queryParams);
    if (queryParams[expressionType] === '') {
        queryParams[expressionType] = expression;
    } else {
        appendExpression(queryParams, expressionType, expression);
    }
};

/**
 * Creates or appends KeyConditionExpression to queryParams
 */
const addKeyExpression = (queryParams, expression) => {
    addExpression(queryParams, 'KeyConditionExpression', expression);
};

/**
 * Creates or appends FilterExpression to queryParams
 */
const addFilterExpression = (queryParams, expression) => {
    addExpression(queryParams, 'FilterExpression', expression);
};

/**
 * Adds ExpressionAttributeValue to queryParams. Returns key under which value is stored.
 *
 * NOTICE:
 * Should be called before adding expression because keygen is included.
 */
const addExpressionAttributeValue = (queryParams, value) => {
    initializeMissingQueryParametersAttributes(queryParams);
    const index = Object.keys(queryParams.ExpressionAttributeValues).length;
    const valueKey = `:value${index}`;
    queryParams.ExpressionAttributeValues[valueKey] = value;
    return valueKey;
};

/**
 * Deletes items from specified DynamoDB table based on key, condition expression, expression attributes and expression attribute values
 * provided through tableParams
 * @param tableParams - specified parameters to be used by AWS.DynamoDB.DocumentClient instance
 * @returns {Promise<any>}
 */
const deleteItem = async (tableParams) => {
    console.log('Delete items params:\n', JSON.stringify(tableParams));
    const client = captureAWSv3Client(docClientManager.getDocClient());
    try {
        const data = await client.send(new DeleteCommand(tableParams));
        console.log('Successfully deleted item(s) from', tableParams.TableName, 'table:\n', JSON.stringify(data));
        const response = createResponse(RESPONSE_OK, { ItemsDeleted: true, Item: data });
        return response;
    } catch (err) {
        console.error('ERROR: Failed to delete item(s) from', tableParams.TableName, 'table:\n',
            JSON.stringify(err));
        const errorBody = createErrBody(ERR_CODES.DYNAMO_DB_ERROR_DELETE, 'Failed to delete item(s)!', undefined, ERROR_CODES.DYNAMO_DB_ERROR);
        const response = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
        throw response;
    }
};

/**
 * @param params params that we receive from arbiter/api
 * @param mandatoryParams Object that have all field that are mandatory
 * @returns {*}
 */
const checkMandatoryParams = (params, mandatoryParams) => {
    if (!mandatoryParams) {
        return undefined;
    }
    const allowedPutParams = Object.keys(mandatoryParams).map((param) => {
        if (!(param in params) || params[param] == null || params[param] === '') {
            return { status: false, what: param };
        }
        return { status: true, what: param };
    });
    const onlyFalseParams = allowedPutParams.filter((e) => e.status === false);
    if (onlyFalseParams.length > 0) {
        const errorDetails = {
            missingParams: onlyFalseParams,
        };
        const errorBody = createErrBody(ERR_CODES.MISSING_DYNAMO_DB_MANDATORY_PARAMS,
            'Must contain all mandatory parameters', errorDetails, ERROR_CODES.DYNAMO_DB_ERROR);
        throw createResponse(RESPONSE_BAD_REQUEST, errorBody);
    }
    return undefined;
};

/**
 * Putting data into DB. Also we use lodash for converting string to snakeCase
 * @param params get all params from api call
 * @param tableName - name of table that we want to use
 * @returns {{TableName: *}}
 */
const getPutTableParams = (params, tableName) => {
    const tableParams = {
        TableName: tableName,
    };
    tableParams.Item = copyAsSnakeCase(params);
    return tableParams;
};

/** @deprecated use non-generic errors instead */
// TODO remove this function and refactor usages so that detailed errors with different err codes are returned instead
const createError = (responseType, errorMessage, errorDetails) => {
    const errorBody = createErrorBody(ERROR_CODES.DYNAMO_DB_ERROR, errorMessage, errorDetails);
    return createResponse(responseType, errorBody);
};

/** @deprecated, will be modified */
// TODO move this function into utility functions, and use new err codes
const createErrorMissingParameter = (responseType, parameterName, tableName) => {
    let message;
    if (!tableName) {
        message = 'Mandatory transaction parameter missing';
    } else {
        message = `Mandatory parameter for ${tableName} is missing!`;
    }
    return createError(responseType, message, { parameterMissing: parameterName });
};

/** @deprecated, will be modified */
// TODO move this function into utility functions, and use new err codes
const createErrorInvalidParameter = (responseType, parameterName, tableName) => {
    let message;
    if (!tableName) {
        message = 'Invalid parameter! Make sure parameter satisfies conditions.';
    } else {
        message = `Invalid parameter for ${tableName}! Make sure type and conditions for parameters are met.`;
    }
    return createError(responseType, message, { invalidParameter: parameterName });
};

/**
 * Will concatenate passed parameters as valid DynamoDB KeyConditionExpression
 * @param {Array} params
 * @returns {string} similar to this format -> param1 = :param1 AND param2 = :param2"
 */
const combineQueryParams = (params) => {
    if (params && Array.isArray(params)) {
        let queryParams = '';

        params.forEach((key, idx) => {
            if (!idx) {
                queryParams += `${key} = :${key}`;
            } else {
                queryParams += ` AND ${key} = :${key}`;
            }
        });

        return queryParams;
    }
    return undefined;
};

/**
 * Will combine passed parameters as valid DynamoDB ExpressionAttributeValues
 * @param {Array} values
 * @param {Array} params
 */
const combineQueryValues = (values, params, filterValues = [], filterParams = []) => {
    const exprsParams = [...params, ...filterParams];
    const exprsValues = [...values, ...filterValues];
    if (exprsParams && exprsValues && Array.isArray(exprsValues) && Array.isArray(exprsParams)) {
        const res = {};

        exprsValues.forEach((val, idx) => {
            // eslint-disable-next-line no-restricted-globals
            if (!isNaN(val)) {
                res[`:${exprsParams[idx]}`] = parseInt(val);
            } else {
                res[`:${exprsParams[idx]}`] = val;
            }
        });

        return res;
    }

    return undefined;
};

/*
 * Return the db entry insert date.
 * Format: 2019-02-28
 */
const getInsertDate = (time) => {
    if (time == null) {
        time = new Date().getTime();
    }
    const date = new Date(time);
    const insertDate = date.toISOString().slice(0, 10);
    return insertDate;
};

/**
 * Filters provided params and returns json object composed of key - value pairs allowed to be updated in table item.
 * Every param gets converted from camelCase to snake case notation needed for dynamo db table columns.
 * @param {Object} params - json object with key value pairs to be used for updating table item
 * @param {Object} allowedUpdateParams - object with allowed params for update
 * @param {Object} paramKeys - object with keys
 */
const filterUpdateParams = (params, allowedUpdateParams, paramKeys) => {
    const tmpObj = { ...params };

    const keys = Object.keys(paramKeys).reduce((acc, key) => {
        acc[key] = tmpObj[paramKeys[key]];
        delete tmpObj[paramKeys[key]];
        return acc;
    }, {});

    const columns = Object.keys(tmpObj).reduce((acc, key) => {
        if (key in allowedUpdateParams) {
            if (typeof tmpObj[key] === 'object' && tmpObj[key] !== null) {
                tmpObj[key] = copyAsSnakeCase(tmpObj[key]);
            }
            acc[allowedUpdateParams[key]] = tmpObj[key];
        }
        return acc;
    }, {});

    return {
        keys,
        columns,
    };
};

/**
 * Creates, prepares tableParams to be used (passed to DBUtils update function) for updating table item based on provided parameters
 * @param {Object} params - filtered params
 * @param {String} tableName - name of the table
 * @param {Array} keys - array with keys
 * @param {Array} removeParams - array of attributes to remove (optional)
 * @returns {{TableName: *}}
 */
const generateUpdateTableParams = (params, tableName, keys, removeParams = []) => {
    const tableParams = {
        TableName: tableName,
        Key: {},
    };

    keys.forEach((key) => {
        tableParams.Key[key] = params.keys[key];
    });

    let updateExpression = 'set ';
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    Object.keys(params.columns).forEach((param) => {
        if (param === 'desc' || param === 'name') {
            expressionAttributeValues[`:${param}`] = params.columns[param];
            updateExpression += `#${param} = :${param}, `;
            expressionAttributeNames[`#${param}`] = param;
            return;
        }
        // skip remove params
        if (removeParams.includes(param)) {
            return;
        }
        updateExpression += `${param} = :${param}, `;
        expressionAttributeValues[`:${param}`] = params.columns[param];
    });

    updateExpression = updateExpression.slice(0, -2);

    if (removeParams.length > 0) {
        updateExpression += ` remove ${removeParams.join(', ')}`;
    }

    tableParams.UpdateExpression = updateExpression;
    if (Object.keys(expressionAttributeNames).length > 0) {
        tableParams.ExpressionAttributeNames = expressionAttributeNames;
    }
    tableParams.ExpressionAttributeValues = expressionAttributeValues;
    tableParams.ReturnValues = 'UPDATED_NEW';
    return tableParams;
};

/**
 * Queries DynamoDB using getItem and handles the response.
 * @param {Object} queryParams - Provided by one of the handlers for DynamoDB tables and represent the query parameters for DocumentClient.
 * @returns {Promise} {@link get} result.
 */
const get = async (queryParams) => {
    const client = captureAWSv3Client(docClientManager.getDocClient());
    const dataReceived = [];
    try {
        const data = await client.send(new GetCommand(queryParams));
        if (!data?.Item) {
            console.log('Get operation returned no result');
        } else {
            dataReceived.push(data.Item);
        }
        return dataReceived;
    } catch (err) {
        console.error('ERROR: Failed to get item from ', queryParams.TableName, 'table:\n', JSON.stringify(err));
        const errorBody = createErrBody(ERR_CODES.DYNAMO_DB_ERROR_GET, 'Failed to read data', undefined, ERROR_CODES.DYNAMO_DB_ERROR);
        const response = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
        throw response;
    }
};

/**
 * Writes a transaction in DynamoDB and handles the response.
 * @param {Object} transactParams Operations that could be of type PutItem, UpdateItem or DeleteItem
 * @param {Boolean} getCancellationReasons Get exact reason for failure from CancellationReasons array
 * @returns {Promise} Result of the executed transactional write
 */
const transactWrite = async (transactParams, getCancellationReasons = false) => {
    const client = captureAWSv3Client(docClientManager.getDocClient());
    transactParams = JSON.parse(JSON.stringify(transactParams));
    try {
        const data = await client.send(new TransactWriteCommand(transactParams));
        console.log('Transaction written successfully. Result: ', JSON.stringify(data));
        const response = createResponse(RESPONSE_OK, { TransactionSuccess: true });
        return response;
    } catch (err) {
        console.error('ERROR: Failed to write transaction', '\n', JSON.stringify(err));
        // transaction is cancelled with TransactionCanceledException, but exact reason is in the CancellationReasons array
        const errorBody = createErrBody(ERR_CODES.DYNAMO_DB_ERROR_TRANSACT_WRITE,
            'Failed to write transaction', { DynamoDBCode: err.name, ...getCancellationReasons && { CancellationReasons: err.CancellationReasons } }, ERROR_CODES.DYNAMO_DB_ERROR);
        const response = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
        throw response;
    }
};

/**
 * Creates a set of elements inferring the type of set from the type of the first element.
 * @param {Array} list Collection to represent the DynamoDB Set
 * @returns {Object}
 */
const createSet = (list) => new Set(list);

const processUnprocessedItems = async (unprocessedItems, tableName, retryCount = 1) => {
    if (retryCount > 5) {
        throw new Error('Max retries reached, cannot process items');
    }

    if (unprocessedItems && Object.keys(unprocessedItems).length !== 0) {
        console.info(`Retry Attempt: ${retryCount}`);
        await new Promise((res) => setTimeout(res, Math.floor(Math.random() * (retryCount * 100))));
        const response = await batchWriteToPromise({ RequestItems: unprocessedItems });

        if (!response?.UnprocessedItems[tableName]?.length) {
            return console.info('Retry successful returning...');
        }

        console.info(`${response?.UnprocessedItems[tableName]?.length} item/s remaining from retry...`);
        await processUnprocessedItems(response.UnprocessedItems, tableName, retryCount + 1);
    }
};

module.exports = {
    EXCEPTIONS,
    putItem,
    batchWrite,
    query,
    countQuery,
    scan,
    batchGetItem,
    update,
    conditionalUpdate,
    executeWithRetry,
    addKeyExpression,
    addFilterExpression,
    addExpressionAttributeValue,
    deleteItem,
    checkMandatoryParams,
    getPutTableParams,
    createError,
    createErrorMissingParameter,
    createErrorInvalidParameter,
    combineQueryParams,
    combineQueryValues,
    getInsertDate,
    filterUpdateParams,
    generateUpdateTableParams,
    get,
    transactWrite,
    createSet,
    batchWriteToPromise,
    queryWithPagination,
    queryWithLimit,
    processUnprocessedItems,
};
