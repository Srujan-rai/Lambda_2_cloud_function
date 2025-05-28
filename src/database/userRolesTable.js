const {
    get,
    createSet,
    checkMandatoryParams,
    update,
} = require('./dbUtilities');
const {
    isValidString,
    createResponseInvalidParameter,
    arrayFromString,
} = require('../utility_functions/utilityFunctions');
const { GPP_USER_ROLES_TABLE } = require('../constants/tableNames');

const MANDATORY_UPDATE_PARAMS = {
    koId: 'ko_id',
    role: 'role',
};

/**
 * Get Item user role record for given ssUsername  and country
 * @param {String} koId - the KO ID of the SS user.
 * @returns {Promise} {@link get} result.
 */
const getUserRole = (koId) => {
    const getParams = {
        TableName: GPP_USER_ROLES_TABLE,
        Key: {
            ko_id: koId,
        },
    };
    return get(getParams);
};

const validateAttributes = (params) => {
    const invalidParams = [];

    if (Object.prototype.hasOwnProperty.call(params, 'koId') && !isValidString(params.koId)) {
        invalidParams.push('koId');
    }
    if (Object.prototype.hasOwnProperty.call(params, 'configurationIds') && !isValidString(params.configurationIds)) {
        invalidParams.push('configurationIds');
    }
    if (Object.prototype.hasOwnProperty.call(params, 'role') && !Number.isInteger(params.role)) {
        invalidParams.push('role');
    }
    if (invalidParams.length <= 0) {
        return undefined;
    }

    throw createResponseInvalidParameter(invalidParams);
};

/**
 * Function that creates update parameters for user update
 * @param {Object} params - parameters for updating existing version of item
 * @returns {Object} filtered out DynamoDb update params;
 */
const creatUpdateParams = (params) => {
    const { koId, role } = params;

    const updateParams = {
        TableName: GPP_USER_ROLES_TABLE,
        Key: {
            ko_id: koId,
        },
        UpdateExpression: 'SET #role = :role',
        ExpressionAttributeValues: {
            ':role': role,
        },
        ExpressionAttributeNames: { '#role': 'role' },
        ReturnValues: 'ALL_NEW',
    };

    if (params.configurationIds && isValidString(params.configurationIds)) {
        updateParams.UpdateExpression += ' ADD configurations :configuration_id';
        const configurationIds = arrayFromString(params.configurationIds);
        updateParams.ExpressionAttributeValues[':configuration_id'] = Array.from(createSet(configurationIds));
    }

    return updateParams;
};

/**
 * Updates/add item in the table
 * @param params - parameters for updating existing version of item
 */
const updateEntry = async (params) => {
    const tableParamsUpdate = creatUpdateParams(params);
    checkMandatoryParams(params, MANDATORY_UPDATE_PARAMS);
    validateAttributes(params);
    return update(tableParamsUpdate);
};

module.exports = {
    getUserRole,
    updateEntry,
};
