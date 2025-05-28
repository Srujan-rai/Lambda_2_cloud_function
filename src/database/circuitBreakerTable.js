const DBUtils = require('./dbUtilities');
const { GPP_CIRCUIT_BREAKER } = require('../constants/tableNames');

const getCircuitBreakerItem = async (moduleConfig) => {
    const queryParams = {
        TableName: GPP_CIRCUIT_BREAKER,
        Key: { circuit_breaker_id: moduleConfig.moduleId },
    };
    const results = await DBUtils.get(queryParams);

    return results && results.length > 0
        ? results[0]
        : null;
};

/**
 * Updates the circuit breaker item for the given module configuration with provided updates.
 * Constructs a dynamic update expression and leverages the existing `update` utility.
 *
 * @param {string} moduleId - The unique identifier for the circuit breaker module.
 * @param {object} updates - An object with keys as attribute names and their new values.
 * @returns {Promise<object>} The updated attributes.
 */
const updateCircuitBreakerItem = async (moduleId, updates) => {
    let updateExp = 'set';
    const expAttrNames = {};
    const expAttrValues = {};
    Object.entries(updates).forEach(([key, value], index) => {
        const prefix = index === 0 ? ' ' : ', ';
        updateExp += `${prefix}#${key} = :${key}`;
        expAttrNames[`#${key}`] = key;
        expAttrValues[`:${key}`] = value;
    });

    const updateParams = {
        TableName: GPP_CIRCUIT_BREAKER,
        Key: { circuit_breaker_id: moduleId },
        UpdateExpression: updateExp,
        ExpressionAttributeNames: expAttrNames,
        ExpressionAttributeValues: expAttrValues,
        ReturnValues: 'ALL_NEW',
    };

    const result = await DBUtils.update(updateParams);
    return result.Attributes;
};

/**
 * Inserts a new entry into the GPP_CIRCUIT_BREAKER table.
 * @param {Object} putParams - The parameters for the entry to insert.
 * @returns {Promise} - A promise that resolves when the item is successfully inserted.
 */
const putEntry = async (putParams) => {
    const insertParams = {
        TableName: GPP_CIRCUIT_BREAKER,
        Item: {
            circuit_breaker_id: putParams.moduleId,
            errorCount: putParams.defaultErrorCount,
            lastFailure: putParams.defaultLastFailure,
            state: putParams.defaultState,
            successCount: putParams.defaultSuccessCount,
        },
    };

    return DBUtils.putItem(insertParams);
};

module.exports = {
    getCircuitBreakerItem,
    updateCircuitBreakerItem,
    putEntry,
};
