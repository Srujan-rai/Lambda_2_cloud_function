const {
    query: DBQuery,
    addExpressionAttributeValue,
    addFilterExpression,
    addKeyExpression,
    putItem,
    filterUpdateParams,
    generateUpdateTableParams,
    update,
    EXCEPTIONS: { CONDITIONAL_CHECK_FAILED_EXCEPTION },
} = require('./dbUtilities');
const {
    parseBody,
    createResponse,
    concatenateColumnValues,
} = require('../utility_functions/utilityFunctions');
const { PARAMS_MAP } = require('../constants/common');
const { RESPONSE_BAD_REQUEST } = require('../constants/responses');
const DBUtils = require('./dbUtilities');
const { GPP_CURRENCY_ALLOCATION_RULES_TABLE } = require('../constants/tableNames');

/**
 * getParams
 *  filter/return parameters, needed in order
 *  to update table
 * @param params - data that we receive from request
 * @returns {Object} with all values for update
 */
const getParams = (params) => ({
    configurationId: params.configurationId,
    ruleId: params.ruleId,
    amount: params.allocationRuleParams.amount,
    currencyId: params.allocationRuleParams.currencyId,
    validity: params.allocationRuleParams.validity ? params.allocationRuleParams.validity : undefined,
    userKoId: params.allocationRuleParams.userKoId ? params.allocationRuleParams.userKoId : undefined,
    jiraTicketId: params.allocationRuleParams.jiraTicketId ? params.allocationRuleParams.jiraTicketId : undefined,
    ruleActive: params.allocationRuleParams.ruleActive,
    deletionTimestamp: params.allocationRuleParams.deletionTimestamp ? params.allocationRuleParams.deletionTimestamp : undefined,
});

const ALLOWED_UPDATE_PARAMS = {
    amount: PARAMS_MAP.AMOUNT,
    currencyId: 'currency_id',
    validity: 'validity',
    userKoId: 'user_koid',
    jiraTicketId: 'jira_ticket_id',
    ruleActive: 'rule_active',
    deletionTimestamp: 'deletion_timestamp',
};

const OPTIONAL_PARAMS = [
    PARAMS_MAP.VALIDITY,
    PARAMS_MAP.USER_KOID,
    PARAMS_MAP.JIRA_TICKET_ID,
    PARAMS_MAP.RULE_ACTIVE,
    PARAMS_MAP.DELETION_TIMESTAMP,
];

/**
 * Creates a basic dynamoDB insert item for currency allocation rules table.
 *
 * @param {Object} params - object holding attributes for insert
 *
 * @returns {Object} basic insert params for currency allocation rules table.
 */
const createBaseInsertParams = (params) => {
    const ruleId = concatenateColumnValues(params.programId, params.lotId, params.currencyId);

    return {
        TableName: GPP_CURRENCY_ALLOCATION_RULES_TABLE,
        Item: {
            configuration_id: params.configurationId,
            rule_id: ruleId,
            program_id: params.programId,
            lot_id: params.lotId,
            currency_id: params.currencyId,
            amount: params.amount,
            validity: params.validity,
            jira_ticket_id: params.jiraTicketId,
            user_koid: params.userKoId,
            rule_active: params.ruleActive,
            deletion_timestamp: params.deletionTimestamp,
        },
    };
};

/**
 * Core query for coin allocation rules table. Called with condition expression, values for that expression
 * and index which is used.
 * @param keyExpression - DynamoDB's KeyConditionExpression - parametrized condition for query
 * @param filterExpression - DynamoDB's FilterExpression. Refines query result by applying filter on returned data.
 * @param expressionValues - DynamoDB's ExpressionAttributeValues - values for keyExpression, filterExpression.
 * @param projection - DynamoDB's ProjectionExpression - defines columns to be shown for successful query.
 * @param index - specified if using secondary index (global | local)
 */
const query = (keyExpression, filterExpression, expressionValues, projection, index) => {
    const queryParams = {
        TableName: GPP_CURRENCY_ALLOCATION_RULES_TABLE,
    };

    if (keyExpression) {
        queryParams.KeyConditionExpression = keyExpression;
    }
    if (expressionValues) {
        queryParams.ExpressionAttributeValues = expressionValues;
    }
    if (filterExpression) {
        queryParams.FilterExpression = filterExpression;
    }
    if (projection) {
        queryParams.ProjectionExpression = projection;
    }
    if (index) {
        queryParams.IndexName = index;
    }
    return DBQuery(queryParams);
};

/**
 * Creates (or appends to existing one) DynamoDB's KeyConditionExpression based on primary(partition) key (configurationId)
 */
const addConfigurationIdCondition = (queryParams, configurationId) => {
    const configurationIdKey = addExpressionAttributeValue(queryParams, configurationId);
    const expression = `configuration_id = ${configurationIdKey}`;
    addKeyExpression(queryParams, expression);
};

/**
 * Applies FilterExpression to existing queryParameters, specifying rule we search for, but accepting universal rules (such as *|*).
 */
const addUniversalRuleFilter = (queryParams, programId, lotId) => {
    const providedProgramValueKey = addExpressionAttributeValue(queryParams, programId);
    const anyProgramValueKey = addExpressionAttributeValue(queryParams, '*');
    const providedLotValueKey = addExpressionAttributeValue(queryParams, lotId);
    const anyLotValueKey = addExpressionAttributeValue(queryParams, '*');

    const multiProgramFilterExpression = `program_id IN (${providedProgramValueKey}, ${anyProgramValueKey})`;
    const multiLotFilterExpression = `lot_id IN (${providedLotValueKey}, ${anyLotValueKey})`;

    addFilterExpression(queryParams, multiProgramFilterExpression);
    addFilterExpression(queryParams, multiLotFilterExpression);
};

/**
 * Creates query condition related part of DynamoDB's queryParams.
 *
 * @param {String} configurationId - Hash key. Id of configuration for which the rule is set.
 * @param {String} programId - programId from Mixcode
 * @param {String} lotId - lotId from Mixcode
 * @param {Boolean} excludeZeroValue - true/false, indicates if we should add filter for excluding rules with value 0
 * @returns {Object} DynamoDB query parameters.
 */
const createMixcodesCondition = (configurationId, programId, lotId, excludeZeroValue) => {
    console.log('Creating mixcodes condition parameters...');
    const queryParams = {};
    addConfigurationIdCondition(queryParams, configurationId);
    addUniversalRuleFilter(queryParams, programId, lotId);
    if (excludeZeroValue) {
        addFilterForExcludingZeroValueRule(queryParams);
        addFilterForExcludingInactiveRules(queryParams, true);
    }
    return queryParams;
};

/**
 * Query using main key pair (hash and range). Range key is constructed using concatenation utility method on
 * programId and lotId.
 *
 * @param {String} configurationId - Hash key. Id of configuration for which the rule is set.
 * @param {String} programId - MixCode's progamId.
 * @param {String} lotId - MixCode's lotId
 * @param {Boolean} excludeZeroValue - flag indicating if we should exclude rules that gives some currency, with amount 0
 * @retrns {Array<Object>} array of items that satisfy conditions.
 */
const mainQuery = (configurationId, programId, lotId, excludeZeroValue) => {
    if (!lotId) lotId = '*';
    const condition = createMixcodesCondition(configurationId, programId, lotId, excludeZeroValue);
    return query(condition.KeyConditionExpression, condition.FilterExpression, condition.ExpressionAttributeValues,
        undefined, undefined);
};

/**
 * Same as mainQuery but with projection "currency_id, amount" (Most commonly used projection)
 *
 * @param {String} configurationId - Hash key. Id of configuration for which the rule is set.
 * @param {String} programId - MixCode's progamId.
 * @param {String} lotId - MixCode's lotId
 * @param {Boolean} excludeZeroValue - flag indicating if we should exclude rules that gives some currency, with amount 0
 * @retrns {Array<Object>} array of items that satisfy conditions with a projection [currency_id, amount].
 */
const mainQueryWithAllocationProjection = (configurationId, programId, lotId, excludeZeroValue) => {
    const condition = createMixcodesCondition(configurationId, programId, lotId, excludeZeroValue);
    const projection = 'currency_id, amount';
    return query(condition.KeyConditionExpression, condition.FilterExpression, condition.ExpressionAttributeValues,
        projection, undefined);
};

/**
 * Search for all rules for a single promotion (configurationId)
 *
 * @param {String} configurationId - Hash key. Id of configuration for which the rule is set.
 * @returns {Array<Object>} all rules for given configuration.
 */
const queryByConfigurationId = (configurationId) => {
    const queryParams = {};
    addConfigurationIdCondition(queryParams, configurationId);
    addFilterForExcludingInactiveRules(queryParams, true);
    return query(queryParams.KeyConditionExpression, queryParams.FilterExpression, queryParams.ExpressionAttributeValues,
        undefined, undefined);
};

/**
 * Method for inserting new rule to currency allocation rule table.
 */
const putEntry = (params) => putItem(createBaseInsertParams(params));

/**
 * Method for inserting distinct (if primary key is not taken already) record into currency allocation rules table.
 *
 * @param {Object} queryParams - currently constructed query parameters (for DynamoDB API).
 * @returns {undefined} No return value, {@param queryParams} is updated instead.
 */
const addFilterForExcludingZeroValueRule = (queryParams) => {
    const valueKey = DBUtils.addExpressionAttributeValue(queryParams, 0);
    DBUtils.addFilterExpression(queryParams, `amount > ${valueKey}`);
};

const addFilterForExcludingInactiveRules = (queryParams, ruleActive) => {
    const valueKey = DBUtils.addExpressionAttributeValue(queryParams, ruleActive);
    // attribute_not_exists(rule_active) has been added for backward compatibility
    DBUtils.addFilterExpression(queryParams, `attribute_exists(rule_active) AND rule_active = ${valueKey} OR attribute_not_exists(rule_active)`);
};
/**
 * Creates (or appends to existing one) DynamoDB's KeyConditionExpression based on primary(partition) key (configurationId)
 * @param {Object} params - object holding attributes for insert
 *
 * @returns {Promise} http response promise.
 *                    resolved - StatusCode 200 if insert succeeded
 *                    rejected - StatusCode 400 if primary key is unavailable, StatusCode 500 otherwise
 */
const putDistinctEntry = async (params) => {
    const insertParams = createBaseInsertParams(params);
    insertParams.ConditionExpression = 'attribute_not_exists(configuration_id) AND attribute_not_exists(rule_id)';
    return putItem(insertParams)
        .catch((err) => {
            const errorBody = parseBody(err);
            const dynamoDBCode = errorBody.errorDetails ? errorBody.errorDetails.DynamoDBCode : undefined;
            if (dynamoDBCode === CONDITIONAL_CHECK_FAILED_EXCEPTION) {
                errorBody.errorDetails.reason = 'Rule already exists';
                return Promise.reject(createResponse(RESPONSE_BAD_REQUEST, errorBody));
            }
            return Promise.reject(err);
        });
};

/**
 * updateEntry for currency allocation rules
 *  with new currency_id, amount or validity
 * @param params - data that we receive from request
 * @returns {Promise} dbUpdate
 */
const updateEntry = (params) => {
    const keyTableParams = ['configuration_id', 'rule_id'];
    const keyUpdateParams = { configuration_id: PARAMS_MAP.CONFIGURATION_ID, rule_id: PARAMS_MAP.RULE_ID };

    const updateParams = filterUpdateParams(getParams(params), ALLOWED_UPDATE_PARAMS, keyUpdateParams);
    const removeParams = [];

    Object.keys(updateParams.columns).forEach((key) => updateParams.columns[key] === undefined && delete updateParams.columns[key]);

    // check if there are values do remove
    // TODO: create generic filterRemoveParams dbUtilities function
    Object.entries(params.allocationRuleParams).forEach(([param, value]) => {
        if (value === null && OPTIONAL_PARAMS.includes(param)) {
            removeParams.push(param);
        }
    });

    const tableParams = generateUpdateTableParams(
        updateParams,
        GPP_CURRENCY_ALLOCATION_RULES_TABLE,
        keyTableParams,
        removeParams,
    );

    return update(tableParams);
};

module.exports = {
    mainQuery,
    mainQueryWithAllocationProjection,
    queryByConfigurationId,
    putEntry,
    putDistinctEntry,
    updateEntry,
};
