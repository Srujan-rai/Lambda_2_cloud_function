const DBUtils = require('./dbUtilities');

const { GPP_PROMOTIONS_TABLE } = require('../constants/tableNames');

/**
 *  Method for inserting new promotion
 */
module.exports.putEntry = (params) => {
    params.entryDate = DBUtils.getInsertDate();
    const putParams = DBUtils.getPutTableParams(params, GPP_PROMOTIONS_TABLE);
    return DBUtils.putItem(putParams);
};

/**
 * Get Item from promotion's database called with promotionId.
 * which will return a single item.
 * @param promotionId - Primary Key used to get item from DynamoDB
 * @returns {Promise} {@link get} result.
 */
const get = (promotionId) => {
    const getParams = {
        TableName: GPP_PROMOTIONS_TABLE,
        Key: { promotion_id: promotionId },
    };

    return DBUtils.get(getParams);
};

/**
 * Return promotion metadata
 * @param {String} promotionId - Primary Key used to query the promotions table
 * @returns {Promise} {@link get} result.
 */
module.exports.getPromoMetadata = (promotionId) => get(promotionId);

/**
 * Add item to configurations attribute of promotion metadata.
 */
module.exports.addConfiguration = (promotionId, configurationId) => {
    const tableParamsUpdate = {
        TableName: GPP_PROMOTIONS_TABLE,
        Key: {
            promotion_id: promotionId,
        },
        UpdateExpression: 'set configurations = list_append(if_not_exists(configurations, :empty_list), :configuration_id), entry_date = :new_entry_date',
        ExpressionAttributeValues: {
            ':configuration_id': [configurationId],
            ':empty_list': [],
            ':new_entry_date': DBUtils.getInsertDate(),
        },
        ReturnValues: 'ALL_NEW',
    };

    return DBUtils.update(tableParamsUpdate);
};

/**
 * Get all promotions from the promotions table
 * which will return a single item.
 *
 * @returns {Promise}
 */
module.exports.scanAllPromotions = () => {
    const scanParams = {
        TableName: GPP_PROMOTIONS_TABLE,
    };

    return DBUtils.scan(scanParams);
};

/**
 * Get specific promotion table depending on the promotionId.
 * @param {String} promotionId - query promotions table for specific promotionId.
 * @returns {Promise}
 */
module.exports.queryPromotionTable = (promotionId) => {
    const promoQueryParams = {
        TableName: GPP_PROMOTIONS_TABLE,
        KeyConditionExpression: 'promotion_id = :promotion_id',
        ExpressionAttributeValues: {
            ':promotion_id': promotionId,
        },
    };
    return DBUtils.query(promoQueryParams);
};

/**
 * Retrieves promotion data by date and not archive
 *
 * @param {Date} customDate - Custom date.
 * @returns {Promise<object>} - A promise that resolves to the result of the scan operation.
 */
module.exports.getPromotionByDateAndNotArchived = (customDate) => {
    const queryParams = {
        TableName: GPP_PROMOTIONS_TABLE,
        FilterExpression: 'promotion_end_utc <= :end AND (attribute_not_exists(archived) OR archived = :bool)',
        ExpressionAttributeValues: {
            ':end': customDate,
            ':bool': false,
        },
    };

    return DBUtils.scan(queryParams);
};
