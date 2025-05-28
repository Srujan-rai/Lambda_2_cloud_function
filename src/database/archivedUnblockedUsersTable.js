const uniqid = require('uniqid');
const DBUtils = require('./dbUtilities');
const { GPP_ARCHIVED_UNBLOCKED_USERS_TABLE } = require('../constants/tableNames');
/**
 * Archived unblocked user in Archived unblocked users table,
 * @param {Object} params mandatory params to archived user
 * @param {String} blocked_timestamp blocked user date
 * @param {String} entered_by_id who blocked user
 * @param {String} requested_by_id who request to blocked the user
 * @param {String} reason why the user is blocked
 * @param {String} title
 */
// eslint-disable-next-line camelcase
module.exports.putEntry = (params, blocked_timestamp, entered_by_id, requested_by_id, reason, title) => {
    const tableParams = {
        TableName: GPP_ARCHIVED_UNBLOCKED_USERS_TABLE,
        Item: {
            archived_id: uniqid(),
            gpp_user_id: params.gppUserId,
            configuration_id: params.configurationId,
            unblocked_timestamp: new Date().getTime(),
            entered_by_id: params.enteredById,
            requested_by_id: params.requestedById,
            blocked_data: {
                blocked_timestamp, requested_by_id, entered_by_id, reason, title,
            },
        },
    };
    return DBUtils.putItem(tableParams);
};
