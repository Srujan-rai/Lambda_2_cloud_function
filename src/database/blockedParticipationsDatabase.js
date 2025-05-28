const { GPP_BLOCKED_PARTICIPATIONS_TABLE } = require('../constants/tableNames');
const DBUtils = require('./dbUtilities');

/**
 * putEntry into gpp_blocket_participations_table where we record gppUserId, timestamp and configId, for which
 * the client is not able to participate until the timestamp date is not reached or overdue.
 * @param {*} gppUserId
 * @param {*} nextAvailableParticipationTimestamp
 * @param {*} configurationId
 * @returns - success or fail response based on the result of inserting the item into dynamoDb
 */
const putEntry = async (nextAvailableParticipationTimestamp, gppUserId, configurationId, partLimitVer, expirationTimestamp) => {
    const insertParams = {
        TableName: GPP_BLOCKED_PARTICIPATIONS_TABLE,
        Item: {
            gpp_user_id: gppUserId,
            configuration_id: configurationId,
            next_available_participation: nextAvailableParticipationTimestamp,
            end_of_conf: expirationTimestamp,
            part_limit_ver: partLimitVer,
        },
    };

    return DBUtils.putItem(insertParams, true);
};

/**
 * Get next available participation from the table to compare until which date the client is not able to participate in the promotion,
 * the query is used with DAX and cached in order to save calls from clients who are still not eligible for participation.
 * @param {*} gppUserId
 * @param {*} configurationId
 * @returns - results of the query from dynamodb
 */
const getItem = async (gppUserId, configurationId) => {
    const getParams = {
        TableName: GPP_BLOCKED_PARTICIPATIONS_TABLE,
        Key: {
            configuration_id: configurationId,
            gpp_user_id: gppUserId,
        },
    };
    return DBUtils.get(getParams);
};

module.exports = {
    getItem,
    putEntry,
};
