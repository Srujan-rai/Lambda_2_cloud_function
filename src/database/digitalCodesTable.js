const Moment = require('moment-timezone');
const DBUtils = require('./dbUtilities');
const PrizeCatalogue = require('./prizeCatalogueTable');
const Utils = require('../utility_functions/utilityFunctions');
const {
    PARAMS_MAP,
    VOUCHER_STATUS_TO_PRIZE_COUNTER_MAP,
    DIGITAL_CODES_STATUS,
    PRIZE_CATALOGUE_COUNTERS,
} = require('../constants/common');
const { DYNAMO_DB_CANCELLATION_REASONS } = require('../constants/dbExceptions');

const { updateParticipationRedeemedPrizeStatusTransaction } = require('./participationsDatabase');

const AllowedUpdateParams = {
    status: 'voucher_status',
    claimTimestamp: 'claim_timestamp',
    gppUserId: 'gpp_user_id',
    redemptionAppUser: 'redemption_app_user',
    outletId: 'outlet_id',
    outletName: 'outlet_name',
    redemptionTimestamp: 'redemption_timestamp',
    shouldExpire: 'should_expire',
    expiryDate: 'expiry_date',
};
const { GPP_DIGITAL_CODES_TABLE } = require('../constants/tableNames');

module.exports.ALLOWED_UPDATE_PARAMS = AllowedUpdateParams;

/**
 * Get Item from participation's database called with gppUserID and RequestID
 * which will return a single item.
 * @param {string} prizeId - Prize ID
 * @param {string} voucher - voucher ID
 * @returns {Promise} {@link get} result.
 */
const get = async (prizeId, voucher) => {
    const getParams = {
        TableName: GPP_DIGITAL_CODES_TABLE,
        Key: {
            prize_id: prizeId,
            voucher,
        },
    };
    return DBUtils.get(getParams);
};

/**
 * Function that generates condition expression along with expression values for allowed voucher_status values.
 *
 * @param {Array} allowedOldValues - array of allowed values for voucher_status column
 *
 * @returns {Object} par of ConditionExpression and ExpressionAttributeValues, aligned with DynamoDB's params.
 */
function generateAllowedStatusCondition(allowedOldValues) {
    let ConditionExpression = 'voucher_status IN (';
    const ExpressionAttributeValues = {};
    allowedOldValues.forEach((supportedValue, index) => {
        const conditionValue = `:cond_val_${supportedValue}`;

        ConditionExpression += conditionValue;
        ExpressionAttributeValues[conditionValue] = supportedValue;
        if (index < allowedOldValues.length - 1) {
            ConditionExpression += ', ';
        }
    });
    ConditionExpression += ')';

    return {
        ConditionExpression,
        ExpressionAttributeValues,
    };
}

/**
 * Creates base DynamoDB update parameters. Doing so by mapping attributes from a simple form into DynamoDB parameters.
 *
 * @param {Object} params - Object holding parameters for update
 *
 * @returns {Object} DynamoDB update parameters. It's form is basic (no condition expression, filter expression, etc.)
 */
function generateUpdateParams(params) {
    const keyUpdateParams = { prize_id: PARAMS_MAP.PRIZE_ID, voucher: PARAMS_MAP.VOUCHER };
    const keyTableParams = ['prize_id', 'voucher'];
    const updateParams = DBUtils.filterUpdateParams(params, AllowedUpdateParams, keyUpdateParams);
    const tableParams = DBUtils.generateUpdateTableParams(updateParams, GPP_DIGITAL_CODES_TABLE, keyTableParams);
    tableParams.ReturnValues = 'ALL_NEW';
    return tableParams;
}

/**
 * Generic update method for digital code entry
 * @param params - fields to be updated
 */
const updateEntry = (params) => DBUtils.update(generateUpdateParams(params));

/**
 * Update status of current DigitalCode to  redeemed -> "false"
 * @param prizeId - this info is obtained from post parameters
 * @param voucher - information that we get from db query
 * @param status - change status of current voucher
 * @param shouldExpire - denotes if code should be picked up by voucher expiration lambda (default value true)
 */
module.exports.updateStatus = (prizeId, voucher, status, shouldExpire = 'true') => {
    const params = {
        prizeId,
        voucher,
        status,
        shouldExpire,
    };

    return updateEntry(params);
};

/**
 * Changes status of a voucher. Additionally updates prize catalogue counters related to this transition.
 *
 * @param {String} configurationId - ID of configuration associated to voucher.
 * @param {String} prizeId - ID of a prize associated to voucher.
 * @param {String} voucherCode - voucher string (voucher code)
 * @param {String} toStatus - desired new status
 * @param {String | undefined} fromStatus - Condition for status change.
 *      If provided status change will be done only if old status is equal to this parameter.
 *      If undefined, there will be no condition related to old status value
 * @param {Object} additionalData - additional data that needs to be SET in DigitalCodesTable
 * (no support for removal yet, or additional conditions etc.)
 * @param {Object} participationKey - { gpp_user_id, request_id } used to update the status prop in redeemed_prize in participations table
 * @param {String|undefined} activePartition - this checks if the participation has active partition
 * @returns {Promise} resolved with array of updated vouchers (digital codes table items) or rejected with HTTP error response.
 */
// eslint-disable-next-line
module.exports.changeStatusForOneVoucher = async (configurationId, prizeId, voucherCode, fromStatus, toStatus, additionalData, participationKey, activePartition) => {
    const prizeIdForVoucher = activePartition ? `${prizeId}-${activePartition}` : prizeId;
    const result = await get(prizeIdForVoucher, voucherCode);
    if (!fromStatus) {
        fromStatus = result[0].voucher_status;
    }
    return this.changeStatus(configurationId, prizeId, result, fromStatus, toStatus, additionalData, prizeIdForVoucher, participationKey);
};

/**
 * Changes status for each item in {@param voucherDetailsArray} from {@param fromStatus} to {@param toStatus}.
 * Prize catalogue counters will also be modified within same DynamoDB transaction. Vouchers provided for status change
 * should have current status equal to {@param fromStatus} and should belong to same prize, otherwise the transaction will be rejected.
 *
 * @param {String} configurationId - ID of configuration associated to voucher.
 * @param {String} prizeId - ID of a prize associated to voucher.
 * @param {Array<Object>} voucherDetailsArray - Array of voucher records.
 * These records should all have the same initial status. (fromStatus)
 * @param {String} fromStatus - Status from which we want to make a status change.
 * @param {String} toStatus - desired new status
 * @param {Object} additionalData - additional data that needs to be SET in DigitalCodesTable
 * (no support for removal yet, or additional conditions etc.)
 * @param {String} digCodesPrizeId - the calculated prizeId for prizes that are split in partitions. Ex - 'prizeid-active_partition'
 * @param {Object} participationKey - {gpp_user_id, request_id} used to update the status prop in redeemed_prize in participations table
 * @param {Number} activePartitionToBeUpdated - which should be the active_parition of the prize
 *
 * @returns {Promise} resolved with array of updated vouchers (digital codes table items) or rejected with HTTP error response.
 */

module.exports.changeStatus = async (configurationId, prizeId, voucherDetailsArray, fromStatus, toStatus, additionalData = { should_expire: 'true' }, digCodesPrizeId, participationKey, activePartitionToBeUpdated) => {
    const transactItems = [];
    const updatedVouchersArray = [];
    const columnToIncrement = VOUCHER_STATUS_TO_PRIZE_COUNTER_MAP[toStatus];
    const columnToDecrement = VOUCHER_STATUS_TO_PRIZE_COUNTER_MAP[fromStatus];
    if (!digCodesPrizeId) {
        digCodesPrizeId = prizeId;
    }
    try {
        const result = await this.determineExpirationStatus(prizeId, toStatus);
        additionalData.should_expire = result;
        voucherDetailsArray.forEach((voucher) => {
            transactItems.push(this.createChangeStatusTransactionItem(
                digCodesPrizeId,
                voucher.voucher,
                fromStatus,
                toStatus,
                additionalData,
            ));
            const updatedVoucher = { ...voucher };
            updatedVoucher.voucher_status = toStatus;
            updatedVoucher.prize_id = prizeId;
            if (additionalData) {
                Object.assign(updatedVoucher, additionalData);
            }
            updatedVouchersArray.push(updatedVoucher);
        });
        const prizeCatalogueTransactionItem = await PrizeCatalogue.createUpdateCountersTransactionItem(
            configurationId,
            prizeId,
            columnToIncrement,
            columnToDecrement,
            voucherDetailsArray.length,
            activePartitionToBeUpdated,
        );
        transactItems.push(prizeCatalogueTransactionItem);
        transactItems.push({ Update: updateParticipationRedeemedPrizeStatusTransaction(participationKey, toStatus) });

        await DBUtils.executeWithRetry(() => DBUtils.transactWrite({ TransactItems: transactItems }));
        return updatedVouchersArray;
    } catch (err) {
        console.log('ERROR: Failed to change status for ', JSON.stringify(voucherDetailsArray));
        throw err;
    }
};

/**
 * Changes status for single voucher from available to {@param toStatus}.
 * Prize catalogue counters will also be modified after change status transaction using atomic count update.
 * Prize entry_date and active_partition are added to code change transaction if needed. Voucher provided for status change
 * should have current status equal to {@param fromStatus} and should belong to same prize, otherwise the transaction will be rejected.
 *
 * @param {String} configurationId - ID of configuration associated to voucher.
 * @param {String} prizeId - ID of a prize associated to voucher.
 * @param {Object} voucherOject - Object with voucher details.
 * @param {String} fromStatus - Status from which we want to make a status change.
 * @param {String} toStatus - desired new status
 * @param {Object} additionalData - additional data that needs to be SET in DigitalCodesTable
 * (no support for removal yet, or additional conditions etc.)
 * @param {String} digCodesPrizeId - the calculated prizeId for prizes that are split in partitions. Ex - 'prizeid-active_partition'
 * @param {Number} activePartitionToBeUpdated - which should be the active_parition of the prize
 * @param {String} currentPrizeEntryDate - value of entry_date attribute for the prize
 *
 * @returns {Promise} resolved with array of updated vouchers (digital codes table items) or rejected with HTTP error response.
 */
module.exports.changeStatusForRedeem = async (configurationId, prizeId, voucherObject, fromStatus, toStatus, additionalData = { should_expire: 'true' }, digCodesPrizeId, activePartitionToBeUpdated, currentPrizeEntryDate) => {
    const transactItems = [];
    const updatedVouchersArray = [];
    const columnToIncrement = VOUCHER_STATUS_TO_PRIZE_COUNTER_MAP[toStatus];
    let changeStatusFailed;

    if (!digCodesPrizeId) {
        digCodesPrizeId = prizeId;
    }
    try {
        const entryDate = DBUtils.getInsertDate();

        const result = await this.determineExpirationStatus(prizeId, toStatus);

        additionalData.should_expire = result;
        transactItems.push(this.createChangeStatusTransactionItem(
            digCodesPrizeId,
            voucherObject.voucher,
            fromStatus,
            toStatus,
            additionalData,
        ));

        const updatedVoucher = { ...voucherObject };
        updatedVoucher.voucher_status = toStatus;
        updatedVoucher.prize_id = prizeId;
        if (additionalData) {
            Object.assign(updatedVoucher, additionalData);
        }
        updatedVouchersArray.push(updatedVoucher);
        // check if entryDate ot active partition needs to be updated
        if (currentPrizeEntryDate !== entryDate || activePartitionToBeUpdated) {
            transactItems.push(PrizeCatalogue.createUpdatePrizeEntryDateTransactionItem(
                configurationId,
                prizeId,
                entryDate,
                activePartitionToBeUpdated,
            ));
        }
        try {
            await DBUtils.executeWithRetry(
                () => DBUtils.transactWrite({ TransactItems: transactItems }, true),
                5,
                DYNAMO_DB_CANCELLATION_REASONS.CONDITIONAL_CHECK_FAILED,
            );
        } catch (err) {
            changeStatusFailed = true;
            throw err;
        }
        await DBUtils.executeWithRetry(() => PrizeCatalogue.updatePrizeCountersForRedeem(configurationId, prizeId, columnToIncrement));

        return updatedVouchersArray;
    } catch (err) {
        if (changeStatusFailed) {
            console.log('ERROR: Failed to change status for ', JSON.stringify(voucherObject));
            throw err;
        } else {
            console.log(`ERROR: Failed to update counters while redeeming prize: ${prizeId} `, JSON.stringify(err));
            return updatedVouchersArray;
        }
    }
};

/**
 * Creates update status transaction item.
 *
 * @param {String} prizeId - Hash key for the table
 * @param {String} voucher - Range key for the table
 * @param {String | undefined} conditionallyFromStatus - If provided, defines a condition for transition.
 * (update only if old status equals this parameter)
 * @param {String} toStatus - Aimed new status
 * @param {Object | undefined} additionalData - Any additional field updates. Keys will automatically be transformed to snake case.
 *
 * @returns {Object} DynamoDB update item transaction item. Result will return UPDATED_OLD values.
 */
module.exports.createChangeStatusTransactionItem = (prizeId, voucher, conditionallyFromStatus, toStatus, additionalData) => {
    const snakeCaseAdditionalData = Utils.copyAsSnakeCase(additionalData);

    let UpdateExpression = 'set voucher_status = :toStatus';
    const ExpressionAttributeValues = {
        ':toStatus': toStatus,
    };

    let ConditionExpression;
    if (conditionallyFromStatus) {
        ConditionExpression = 'voucher_status = :fromStatus';
        ExpressionAttributeValues[':fromStatus'] = conditionallyFromStatus;
    }

    if (snakeCaseAdditionalData) {
        Object.keys(snakeCaseAdditionalData).forEach((key) => {
            UpdateExpression = `${UpdateExpression}, ${key} = :${key}`;
            ExpressionAttributeValues[`:${key}`] = snakeCaseAdditionalData[key];
        });
    }
    const updateParams = {
        TableName: GPP_DIGITAL_CODES_TABLE,
        Key: {
            prize_id: prizeId,
            voucher,
        },
        UpdateExpression,
        ConditionExpression,
        ExpressionAttributeValues,
        ReturnValues: 'ALL_NEW',
    };
    return {
        Update: updateParams,
    };
};

/**
 * Updates status and removes claim_timestamp, gpp_user_id
 * @param prizeId - prize id
 * @param voucherCode - voucher code
 * @param status - change status of current voucher
 */
module.exports.getRevertDigitalCodeTransactionParams = (prizeId, voucherCode, status) => ({
    Update: {
        TableName: GPP_DIGITAL_CODES_TABLE,
        Key: {
            prize_id: prizeId,
            voucher: voucherCode,
        },
        UpdateExpression: 'SET voucher_status = :status, should_expire = :should_expire REMOVE claim_timestamp, gpp_user_id',
        ExpressionAttributeValues: {
            ':status': status,
            // this is used only with target status available, hence we can set should_expire="true" without additional checks
            ':should_expire': 'true',
        },
        ReturnValues: 'ALL_NEW',
    },
});

/**
 * Returns DB transact parameters for recreating digital code with new prizeId - active_partition
 * @param digitalCode -
 * @param currentActivePartition - active partition of the prize at time of recreate
 * @param basePrizeId - prizeId without '-partition' in the end
 */
module.exports.getRevertDigitalCodePartitionedTransactionParams = (digitalCode, currentActivePartition, basePrizeId) => {
    const prizeId = `${basePrizeId}-${currentActivePartition}`;
    return [
        {
            Put: {
                TableName: GPP_DIGITAL_CODES_TABLE,
                Item: {
                    prize_id: prizeId,
                    voucher: digitalCode.voucher,
                    experience: digitalCode.experience,
                    voucher_status: DIGITAL_CODES_STATUS.AVAILABLE,
                    configuration_id: digitalCode.configuration_id,
                    expiry_date: digitalCode.expiry_date,
                    entry_date: digitalCode.entry_date,
                    should_expire: digitalCode.should_expire,
                },
            },
        },
        {
            Delete: {
                TableName: GPP_DIGITAL_CODES_TABLE,
                Key: {
                    prize_id: digitalCode.prize_id,
                    voucher: digitalCode.voucher,
                },
            },
        },
    ];
};

/**
 * Changes the voucher_status to 'redeemed' along with adding additional info.
 *
 * @param {String} prizeId - Hash key
 * @param {String} voucher - Range key
 * @param {String} outletId - ID of outlet that uses redemption app. (Retailer that redeems/gives prize to a user)
 * @param {String} outletName - Name of outlet that uses redemption app. (Retailer that redeems/gives prize to a user)
 * @param {String} redemptionAppUser - ID of user that uses redemption app. (Retailer's employee who redeems/gives prize for a user)
 */
module.exports.redeemDigitalCode = (prizeId, voucher, outletId, outletName, redemptionAppUser, status) => {
    const params = {
        prizeId,
        voucher,
        outletId,
        outletName,
        redemptionAppUser,
        status,
        redemptionTimestamp: new Date().getTime(),
    };

    const updateParams = generateUpdateParams(params);

    const allowedStatuses = [DIGITAL_CODES_STATUS.CLAIMED, DIGITAL_CODES_STATUS.RESERVED, DIGITAL_CODES_STATUS.LOCKED];
    const condition = generateAllowedStatusCondition(allowedStatuses);
    updateParams.ConditionExpression = condition.ConditionExpression;
    Object.assign(updateParams.ExpressionAttributeValues, condition.ExpressionAttributeValues);
    updateParams.ReturnValues = 'ALL_OLD';
    // redeemed is final_state => changing should_expire
    updateParams.UpdateExpression += ', should_expire = :should_expire';
    updateParams.ExpressionAttributeValues[':should_expire'] = 'false';

    return DBUtils.update(updateParams)
        .catch((err) => {
            console.error('Error while redeeming voucher', err);
            return Promise.reject(Utils.createResponseCantRedeemVoucher(prizeId, voucher));
        });
};

/**
 * @param prizeId - this info is obtained from post parameters
 * @param voucher - information that we get from db query
 * @param status - change status of current voucher
 * @param gppUserId - the user that has claimed the voucher
 */
module.exports.claimDigitalCode = async (prizeId, voucher, status, gppUserId) => {
    const params = {
        prizeId,
        voucher,
        status,
        gppUserId,
        claimTimestamp: new Date().getTime(),
    };
    try {
        const shouldExpire = await this.determineExpirationStatus(prizeId, status);

        params.shouldExpire = shouldExpire;
        await updateEntry(params);
    } catch (err) {
        throw Utils.createResponseUnknownError();
    }
};

/**
 * Query Digital Codes Table
 * @param expression
 * @param expressionValues
 */
const query = (expression, expressionValues, index, limit) => {
    const queryParams = {
        TableName: GPP_DIGITAL_CODES_TABLE,
        KeyConditionExpression: expression,
        ExpressionAttributeValues: expressionValues,
        ReturnValues: 'UPDATED_NEW',
    };
    if (index) {
        queryParams.IndexName = index;
    }
    if (limit) {
        queryParams.Limit = limit;
    }

    return DBUtils.query(queryParams, false);
};

/**
 * Queries voucher withing configurationId before redeeming it in order to get its correct prizeId-partition.
 *
 * @param {String} voucher - Voucher code
 * @param {String} configurationId
 * @param {String} prizeId
 *
 * @returns {Promise} Inherited from {@link DBUtils.query}
 */
module.exports.getVoucherPrizeId = (voucher, configurationId, prizeId) => {
    const queryParams = {
        TableName: GPP_DIGITAL_CODES_TABLE,
        KeyConditionExpression: 'voucher = :voucher',
        FilterExpression: 'voucher_status IN (:claimed, :reserved, :locked) AND configuration_id = :configurationId AND contains(prize_id, :prize_id)',
        ExpressionAttributeValues: {
            ':voucher': String(voucher),
            ':claimed': DIGITAL_CODES_STATUS.CLAIMED,
            ':reserved': DIGITAL_CODES_STATUS.RESERVED,
            ':locked': DIGITAL_CODES_STATUS.LOCKED,
            ':configurationId': configurationId,
            ':prize_id': prizeId,
        },
        IndexName: 'voucher',
    };
    return DBUtils.query(queryParams);
};

/**
 * Queries voucher with specified voucher string, where status is claimed, redeemed or expired.
 *
 * @param {String} voucher - Voucher code
 *
 * @returns {Promise} Inherited from {@link DBUtils.query}
 */
module.exports.queryWithStatusCondition = (voucher) => {
    const queryParams = {
        TableName: GPP_DIGITAL_CODES_TABLE,
        KeyConditionExpression: 'voucher = :voucher',
        FilterExpression: 'voucher_status IN (:claimed, :redeemed, :expired)',
        ExpressionAttributeValues: {
            ':voucher': String(voucher),
            ':claimed': DIGITAL_CODES_STATUS.CLAIMED,
            ':redeemed': DIGITAL_CODES_STATUS.REDEEMED,
            ':expired': DIGITAL_CODES_STATUS.EXPIRED,
        },
        IndexName: 'voucher',
    };
    return DBUtils.query(queryParams);
};

/**
 * Creates DynamoDB expression that allows only provided list of voucher statuses to be in response
 *
 * @param {Array} voucherStatusArray - list of allowed voucher statuses
 *
 * @retuns {Object} Object holding attributes
 *                 'Expression' (Expression in DynamoDB syntax) and
 *                 'ExpressionAttributeValues' (Values for 'Expression', also aligned with DynamoDB syntax)
 */
const createAllowedVoucherStatusesExpression = (voucherStatusArray) => {
    if (!voucherStatusArray || !voucherStatusArray.length) {
        return undefined;
    }

    const ExpressionAttributeValues = {};
    let Expression = 'voucher_status IN (';
    voucherStatusArray.forEach((status, index) => {
        const key = `:status_${status}`;
        if (index !== 0) {
            Expression = `${Expression}, ${key}`;
        } else {
            Expression += key;
        }
        ExpressionAttributeValues[key] = status;
    });
    Expression += ')';
    const res = { Expression, ExpressionAttributeValues };
    return res;
};

module.exports.queryByUserIdSortByClaimstamp = async (gppUserId, limit, sortOrder = 'ascending', expiredStatusToFetch = 'notExpired', nextToken) => {
    let keyAttributes;
    const currentTimestamp = Moment().unix() * 1000;
    const filterExpressionMap = {
        notExpired: 'expiry_date > :current_date',
        expired: 'expiry_date < :current_date',
    };
    const queryParams = {
        TableName: GPP_DIGITAL_CODES_TABLE,
        KeyConditionExpression: 'gpp_user_id = :gpp_user_id',
        ScanIndexForward: sortOrder === 'ascending',
        ...(expiredStatusToFetch !== 'all' && { FilterExpression: filterExpressionMap[expiredStatusToFetch] }),
        ExpressionAttributeValues: {
            ':gpp_user_id': gppUserId,
            ...(expiredStatusToFetch !== 'all' && { ':current_date': currentTimestamp }),
        },
        IndexName: 'gppUserIdSortByClaimStampIndex',
    };

    if (nextToken) {
        queryParams.ExclusiveStartKey = nextToken;
    }

    if (limit) keyAttributes = ['prize_id', 'claim_timestamp', 'gpp_user_id', 'voucher'];

    return DBUtils.queryWithPagination(queryParams, !!limit, limit, keyAttributes);
};

/**
 * Queries table using Index 'gppUserIdIndex', and configurationId filter. Fixed set of allowed statuses will be added to filter as well.
 *
 * @param {String} userId - userId provided via HTTP params (NOT A GPP_USER_ID)
 * @param {String} configurationId - configuration for which we are processing request
 * @param {Array} voucherStatusArray - (optional) Array of allowed statuses for this query.
 * @param {Number} limit - (optional) Number of records to be returned.
 * @param {Object} nextToken - (optional) The last evaluated key from previous request
 *
 * @returns {Promise} inherited from {@link DBUtils.query}
 */
module.exports.queryByUserId = (gppUserId, configurationId, voucherStatusArray, limit, nextToken) => {
    let keyAttributes;
    const queryParams = {
        TableName: GPP_DIGITAL_CODES_TABLE,
        KeyConditionExpression: 'gpp_user_id = :gpp_user_id',
        ExpressionAttributeValues: {
            ':gpp_user_id': gppUserId,
        },
        IndexName: 'gppUserIdIndex',
    };

    const voucherStatusConditions = createAllowedVoucherStatusesExpression(voucherStatusArray);
    if (configurationId) {
        queryParams.FilterExpression = 'configuration_id = :configuration_id';
        queryParams.ExpressionAttributeValues[':configuration_id'] = configurationId;
    }
    if (voucherStatusConditions) {
        // Append data related to voucher status filter
        queryParams.FilterExpression = configurationId ? `${queryParams.FilterExpression} AND (${voucherStatusConditions.Expression})` : voucherStatusConditions.Expression;
        Object.assign(queryParams.ExpressionAttributeValues, voucherStatusConditions.ExpressionAttributeValues);
    }

    if (nextToken) {
        queryParams.ExclusiveStartKey = nextToken;
    }

    if (limit) keyAttributes = ['gpp_user_id', 'prize_id', 'voucher'];

    return DBUtils.queryWithPagination(queryParams, !!limit, limit, keyAttributes);
};

/**
 * Returns all digital codes that have expiry date set in past and expiry_state set to "true"
 */
module.exports.createExpirableParams = () => {
    const moment = Moment();
    const currentTimestamp = moment.toDate().getTime();

    const expression = 'should_expire = :should_expire and expiry_date <= :current_timestamp';
    const expressionValues = {
        ':should_expire': 'true',
        ':current_timestamp': currentTimestamp,
    };

    const index = 'expirableCodesIndex';

    const queryParams = {
        TableName: GPP_DIGITAL_CODES_TABLE,
        KeyConditionExpression: expression,
        ExpressionAttributeValues: expressionValues,
        ReturnValues: 'UPDATED_NEW',
        IndexName: index,
    };
    return queryParams;
};

/**
 * Main query on participation database. Uses main key (gppUserId + requestId)
 * @param {string} prizeId - Prize ID
 * @param {string} voucher - voucher ID
 * @returns {Promise} {@link get} result.
 */
module.exports.mainQuery = (prizeId, voucher) => get(prizeId, voucher);

/**
 * Function that returns list of vouchers with status equal to {@param status}
 *
 * @param {String} prizeId - HASH key for this table.
 * @param {String} status - Voucher status which we query for.
 * @param {Number} limit - Nullable. If provided, specifies amount records to be returned.
 *
 * @returns {Promise} array of vouchers.
 */
module.exports.queryByStatus = (prizeId, status, limit) => {
    const expression = 'prize_id = :prize_id AND voucher_status = :voucher_status';
    const expressionValues = {
        ':prize_id': prizeId,
        ':voucher_status': status,
    };

    const index = 'prizeIdAndStatusIndex';
    return query(expression, expressionValues, index, limit);
};

/**
 * Marks specified amount of vouchers as 'REMOVED'
 *
 * @param {String} prizeId - ID of a prize for which we want to remove vouchers
 * @param {Number} amount - amount of vouchers we want to remove
 */
module.exports.markAsRemoved = async (prizeId, amount) => {
    const vouchersArray = await this.queryByStatus(prizeId, DIGITAL_CODES_STATUS.AVAILABLE, amount);
    if (vouchersArray.length < amount) {
        const errResponse = Utils.createResponseNotEnoughPrizes(prizeId, PRIZE_CATALOGUE_COUNTERS.TOTAL_AVAILABLE, vouchersArray.length);
        throw errResponse;
    }

    const promises = [];
    vouchersArray.forEach((voucher) => {
        promises.push(this.updateStatus(voucher.prize_id, voucher.voucher, DIGITAL_CODES_STATUS.REMOVED, 'true'));
    });
    const res = await Promise.allSettled(promises);
    return res;
};

/**
 * Insert digitalCode to DB
 * @param params
 */
module.exports.putEntry = (params) => {
    const insertParams = {
        TableName: GPP_DIGITAL_CODES_TABLE,
        Item: {
            prize_id: params.prizeId,
            voucher: params.voucher,
            experience: params.experience,
            voucher_status: params.voucherStatus.toLocaleLowerCase(),
            configuration_id: params.configurationId,
            expiry_date: params.expiryDate === '' ? undefined : Number(params.expiryDate),
            entry_date: DBUtils.getInsertDate(),
            should_expire: params.shouldExpire,
        },
        ConditionExpression: 'attribute_not_exists(prize_id)',
    };
    if (params.finalState) {
        insertParams.Item.final_state = params.finalState;
    }
    return DBUtils.putItem(insertParams, false);
};

/**
 * Gets all digital codes for a specific prize ID
 *
 * @param {string} prizeId - Prize ID
 * @return {*|Promise<any>} - Returns Promise with the result of DynamoDB query
 */
module.exports.getDigitalCodesByPrizeId = (prizeId) => {
    const params = {
        TableName: GPP_DIGITAL_CODES_TABLE,
        KeyConditionExpression: 'prize_id = :prize_id',
        ExpressionAttributeValues: {
            ':prize_id': prizeId,
        },
    };
    return DBUtils.query(params);
};

/**
 * Query for a prize and returns "true"/"false" statuses to be used in voucher should_expire attribute
 *
 * @param {string} prizeId - Prize ID
 * @param {string} toStatus - target status of the voucher
 * @return {*|Promise<any>} - Returns Promise with should_expire value
 */
module.exports.determineExpirationStatus = async (prizeId, toStatus) => {
    const result = await PrizeCatalogue.queryByPrizeId(prizeId);
    if (!result.length) return Promise.reject(Utils.createResponsePrizeNotFound(prizeId));
    const finalState = result[0].final_state;
    const { AVAILABLE, EXPIRED, REMOVED } = DIGITAL_CODES_STATUS;
    const cond1 = finalState && (finalState === toStatus || toStatus === EXPIRED || toStatus === REMOVED);
    const cond2 = !finalState && toStatus !== AVAILABLE;

    return (cond1 || cond2 ? 'false' : 'true');
};

/**
 * Gets all digital codes for a specific prize ID
 *
 * @param {string} prizeId - Prize ID
  * @param {string} lastEvaluatedKey - lastEvaluatedKey
 * @return {*|Promise<any>} - Returns Promise with the result of DynamoDB query
 */
module.exports.getDigitalCodesDataWithKeyAndLimit = (prizeId, lastEvaluatedKey, limit) => {
    const params = {
        TableName: GPP_DIGITAL_CODES_TABLE,
        KeyConditionExpression: 'prize_id = :prize_id',
        ExpressionAttributeValues: {
            ':prize_id': prizeId,
        },
    };

    if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const keyAttributes = ['prize_id', 'voucher'];

    return DBUtils.queryWithPagination(params, !!limit, limit, keyAttributes);
};
