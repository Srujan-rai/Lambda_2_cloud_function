const {
    query: dbQuery,
    putItem: dbPut,
    batchWrite: dbBatchWrite,
    get: dbGet,
} = require('./dbUtilities');

const { PARTICIPATION_PINCODES_TABLE } = require('../constants/tableNames');

/**
 * Return json object with generated insert params
 * @param params - received insert params
 */
const generateBatchWrite = (params) => {
    const insertParams = {
        RequestItems: {
            [PARTICIPATION_PINCODES_TABLE]: [],
        },
    };

    params.pincodes.forEach((element) => {
        const insertItem = {
            PutRequest: {
                Item: {
                    mixcodes_pincode: element.pincode,
                    participation_id: params.participationId,
                },
            },
        };
        insertParams.RequestItems[PARTICIPATION_PINCODES_TABLE].push(insertItem);
    });
    return insertParams;
};

/**
 * Core query function for participation pincodes database.
 *
 * @param {string} expression - DynamoDB's KeyConditionExpression
 * @param {Object} expressionValues - DynamoDB's ExpressionAttributeValues
 * @param {string} index - optional parameter. Represent IndexName for query.
 *
 * @returns {Promise} with {@link dbQuery} result
 */
const query = (expression, expressionValues, index) => {
    const queryParams = {
        TableName: PARTICIPATION_PINCODES_TABLE,
        KeyConditionExpression: expression,
        ExpressionAttributeValues: expressionValues,
    };
    if (index) {
        queryParams.IndexName = index;
    }
    return dbQuery(queryParams);
};

/**
 * Return json object with generated insert params
 * @param params - received insert params
 */
const generateInsertParams = (params) => {
    const returnedObject = params.isViralCodeCheck ? {
        TableName: PARTICIPATION_PINCODES_TABLE,
        Item: {
            mixcodes_pincode: `${params.mixcodePincode}#${params.participationId}`,
            participation_id: params.participationId,
            viral_code: params.pincode,
            end_of_conf: params.expirationTimestamp,
        },
    } : {
        TableName: PARTICIPATION_PINCODES_TABLE,
        Item: {
            mixcodes_pincode: params.mixcodePincode,
            participation_id: params.participationId,
            pincode: params.pincode,
            mixcodes_transaction_id: params.MCtransactionId,
            end_of_conf: params.expirationTimestamp,
            mixcodes_error_code: params.MCErrorCode,
            redeemed: params.redeemed,
        },
    };
    return returnedObject;
};

/**
 * Method for inserting mixcodes pincodes related to participation entry.
 * @param {Object} params - dynamic attributes for insert.
 * @returns {Promise} result of {@link dbPut}
 */
const putEntry = (params) => {
    console.log('Received participation pincodes insert params:\n', JSON.stringify(params));
    const insertParams = generateInsertParams(params);
    return dbPut(insertParams);
};

/**
 * Method for inserting mixcodes pincodes related to participation entry.
 * @param {Object} params - insert multiple pincode with same participationId
 * at a time.
 * @returns {Promise} result of {@link dbBatchWrite}
 */
const batchWrite = async (params) => {
    console.log('Received participation pincodes batch write params:\n', JSON.stringify(params));

    const items = generateBatchWrite(params);
    await dbBatchWrite(items);
    return items.RequestItems[PARTICIPATION_PINCODES_TABLE];
};

/**
 * Main query on participation pincodes database.
 * @param {string} mixcode_pincode - HASH key for participation table
 * @returns {Promise} {@link dbQuery} result.
 */
const mainQuery = (pincode) => {
    const expression = 'mixcode_pincode = :mixcode_pincode';
    const expressionValues = {
        ':mixcodes_pincode': pincode,
    };
    return query(expression, expressionValues);
};

/**
 * Get a unique item from the table
 * @param {string} sparseKey consists of pincode#programId#userId
 * @returns {Promise} {@link dbGet}
 */
const getItem = (sparseKey) => dbGet({
    TableName: PARTICIPATION_PINCODES_TABLE,
    Key: {
        mixcodes_pincode: sparseKey,
    },
});

module.exports = {
    putEntry,
    batchWrite,
    mainQuery,
    getItem,
};
