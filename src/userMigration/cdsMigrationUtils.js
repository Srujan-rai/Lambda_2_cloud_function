const Moment = require('moment');
const { ConfiguredRetryStrategy } = require('@aws-sdk/util-retry');
const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const {
    get, update, query, batchWriteToPromise, deleteItem, queryWithLimit, processUnprocessedItems,
} = require('../database/dbUtilities');
const { createDocClientManager } = require('../awsSdkClientManager');
const { createErrBody, createResponse, splitArray } = require('../utility_functions/utilityFunctions');
const { getTableData } = require('../database/databaseSchemaUtils');
const { mainQuery } = require('../database/walletTable');
const { STANDARD_PROMISE_SIZE, SSM_LAST_EVALUATED_USER } = require('./migrationConstants');
const TableNames = require('../constants/tableNames');

const {
    ERR_CODES: { PARTICIPANT_IS_BLOCKED },
} = require('../constants/errCodes');
const { RESPONSE_FORBIDDEN } = require('../constants/responses');
const { getParametersFromSSM } = require('../utility_functions/aws_sdk_utils/ssmUtilities');

const { MIGRATION_TABLE } = process.env;
const docClientManager = createDocClientManager();

const checkIfUserMigrated = async (params) => {
    console.log(`Checking user: ${params.userId}`);

    const [user] = await findUser(params.userId);

    const isValidUserForMigration = await checkUserMigrationRecord(user);
    if (!isValidUserForMigration) return true;

    await markUserForMigration(params.userId);
    params.userId = user.uuid;
    return false;
};

const checkUserMigrationRecord = async (user) => {
    if (!user || user.migrated) {
        console.log('User not existing/marked as migrated in the mapping table');
        return false;
    }

    if (user.blocked) {
        console.error('User temporarily blocked for participation');
        const errorBody = createErrBody(PARTICIPANT_IS_BLOCKED, 'Participation currently not possible. Please try again later');
        const errorResponse = createResponse(RESPONSE_FORBIDDEN, errorBody);
        throw errorResponse;
    }

    if (!user.rCount) {
        console.log(`User ${user.hashedKocid} will be skipped due to ${user.rCount} records for processing`);
        return false;
    }

    return true;
};

const findUser = async (id) => {
    const getParams = {
        TableName: MIGRATION_TABLE,
        Key: { hashedKocid: id },
    };
    return get(getParams);
};

const markUserForMigration = async (id) => {
    const requestTimestamp = new Date().getTime();
    const updateParams = {
        TableName: MIGRATION_TABLE,
        ExpressionAttributeValues: {
            ':requestTimestamp': requestTimestamp,
            ':marked': 'pending',
        },
        Key: {
            hashedKocid: id,
        },
        UpdateExpression: 'set lastRequestT = :requestTimestamp, migration = :marked',
    };
    return update(updateParams);
};

const markUserAsMigrated = (id) => {
    const updateParams = {
        TableName: MIGRATION_TABLE,
        ExpressionAttributeValues: {
            ':markedForExport': true,
            ':blocked': false,
            ':migration': 'completed',
            ':processorAssigned': false,
        },
        Key: {
            hashedKocid: id,
        },
        UpdateExpression: `
            set migrated = :markedForExport,
            blocked = :blocked,
            migration = :migration,
            processorAssigned = :processorAssigned
        `,
    };
    return update(updateParams);
};

const removeProcessorFromUser = (id) => {
    const updateParams = {
        TableName: MIGRATION_TABLE,
        ExpressionAttributeValues: {
            ':blocked': true,
            ':migration': 'pending',
            ':processorAssigned': false,
        },
        Key: {
            hashedKocid: id,
        },
        UpdateExpression: 'set blocked = :blocked, migration = :migration, processorAssigned = :processorAssigned',
    };
    return update(updateParams);
};

const markUserAsBlocked = (id) => {
    const updateParams = {
        TableName: MIGRATION_TABLE,
        ExpressionAttributeValues: {
            ':blocked': true,
            ':migration': 'pending',
            ':processorAssigned': true,
        },
        Key: {
            hashedKocid: id,
        },
        UpdateExpression: 'set blocked = :blocked, migration = :migration, processorAssigned = :processorAssigned',
    };
    return update(updateParams);
};

const getUserForMigration = async () => {
    const thresholdTimestamp = Moment().subtract(20, 'minutes').toDate().getTime();
    const queryParams = {
        TableName: MIGRATION_TABLE,
        IndexName: 'migration-lastRequestT-index',
        KeyConditionExpression: '#migration = :pkey and lastRequestT <= :thresholdTimestamp',
        ExpressionAttributeValues: {
            ':pkey': 'pending',
            ':processorAssigned': false,
            ':thresholdTimestamp': thresholdTimestamp,
            ':recordsCount': 2000,
        },
        ExpressionAttributeNames: {
            '#migration': 'migration',
            '#processorAssigned': 'processorAssigned',
        },
        FilterExpression: `
            rCount <= :recordsCount AND (#processorAssigned = :processorAssigned
            OR attribute_not_exists(#processorAssigned))
        `,
    };

    return queryWithLimit(queryParams, 10);
};

const getUsersToMigrate = async (limit = 25) => {
    const scanParams = {
        TableName: MIGRATION_TABLE,
        Limit: limit,
        FilterExpression: `
            attribute_not_exists(#lastRequestT) AND
            #rCount > :rCount AND
            attribute_not_exists(#processorAssigned)
        `,
        ExpressionAttributeNames: {
            '#lastRequestT': 'lastRequestT',
            '#rCount': 'rCount',
            '#processorAssigned': 'processorAssigned',
        },
        ExpressionAttributeValues: {
            ':rCount': 0,
        },
    };
    try {
        const response = await getParametersFromSSM(SSM_LAST_EVALUATED_USER);
        const lastEvaluatedKey = response[SSM_LAST_EVALUATED_USER] && JSON.parse(response[SSM_LAST_EVALUATED_USER]);
        if (lastEvaluatedKey) {
            console.log('Last evaluated key', lastEvaluatedKey);
            scanParams.ExclusiveStartKey = lastEvaluatedKey;
        }
    } catch (err) {
        console.log('ERROR: Error while getting ssm param:', err);
    }
    return scan(scanParams);
};

const getUserWithLargerCount = async () => {
    const thresholdTimestamp = Moment().subtract(20, 'minutes').toDate().getTime();
    const queryParams = {
        TableName: MIGRATION_TABLE,
        IndexName: 'migration-lastRequestT-index',
        KeyConditionExpression: '#migration = :pkey and lastRequestT <= :thresholdTimestamp',
        ExpressionAttributeValues: {
            ':pkey': 'pending',
            ':processorAssigned': false,
            ':thresholdTimestamp': thresholdTimestamp,
            ':recordsCount': 2000,
        },
        ExpressionAttributeNames: {
            '#migration': 'migration',
            '#processorAssigned': 'processorAssigned',
        },
        FilterExpression: `
            rCount > :recordsCount AND (#processorAssigned = :processorAssigned
            OR attribute_not_exists(#processorAssigned))
        `,
    };

    return queryWithLimit(queryParams, 10);
};

const scan = async (params) => {
    const docClient = docClientManager.getDocClient({ retryStrategy: new ConfiguredRetryStrategy(3, 300) });
    try {
        const data = await docClient.send(new ScanCommand(params));
        return {
            scannedUsers: data.Items,
            lastKey: data.LastEvaluatedKey,
        };
    } catch (err) {
        console.error('ERROR: Failed to scan table', err);
        throw err;
    }
};

async function getUserRecords(tableParams, gppUserId) {
    const queryParams = {
        TableName: tableParams.TableName,
        KeyConditionExpression: 'gpp_user_id = :gpp_user_id',
        ExpressionAttributeValues: {
            ':gpp_user_id': gppUserId,
        },
    };

    if (tableParams.IndexName) {
        queryParams.IndexName = tableParams.IndexName;
    }

    return query(queryParams);
}

const getBatchRecordsTemplate = (tableName) => ({ RequestItems: { [tableName]: [] } });

const makeBatchedRequests = async (requestParams) => {
    const {
        records,
        tableParams,
        hashedKocid,
        identityType,
        requestType,
    } = requestParams;

    const { TableName, BatchSize } = tableParams;
    const batchedRequests = [getBatchRecordsTemplate(TableName)];
    let batchNumber = 0;

    for (let index = 0; index < records.length; index++) {
        const record = records[index];
        if (batchedRequests[batchNumber].RequestItems[TableName].length === BatchSize) {
            batchNumber++;
            batchedRequests.push(getBatchRecordsTemplate(TableName));
        }

        const requestItem = requestType === 'put'
            ? await makePutRequestItem(record, hashedKocid, identityType, TableName)
            : makeDeleteRequestItem(record, tableParams.TableName);

        batchedRequests[batchNumber].RequestItems[TableName].push(requestItem);
    }

    return batchedRequests;
};

const makePutRequestItem = async (record, userId, identityType, tableName) => {
    const idType = identityType === 'uuid' ? 'cds' : identityType;
    let putItem = { ...record, gpp_user_id: `${userId}|${idType}` };

    if (tableName === TableNames.GPP_DIGITAL_CODES_TABLE && putItem.claim_timestamp) {
        putItem.claim_timestamp = Number(putItem.claim_timestamp);
    }

    if (tableName === TableNames.GPP_PARTICIPATIONS_TABLE && putItem.inserted_transactions) {
        putItem.inserted_transactions.map((transaction) => {
            transaction.gpp_user_id = `${userId}|${idType}`;
            return transaction;
        });
    }

    if (tableName === TableNames.GPP_WALLET_TABLE) {
        putItem = await getWalletRecord(record, `${userId}|${idType}`);
    }

    return {
        PutRequest: {
            Item: putItem,
        },
    };
};

const makeDeleteRequestItem = (record, tableName) => {
    if (!record) return;

    const { partitionKey, sortKey } = getTableData(tableName.replace(`_${process.env.stageName}`, '')) || {};

    if (partitionKey) {
        const key = {
            [partitionKey]: record[partitionKey],
        };
        if (sortKey) {
            key[sortKey] = record[sortKey];
        }

        return {
            DeleteRequest: {
                Key: key,
            },
        };
    }
};

class RequestCounters {
    totalPutRequests = 0;

    totalDeleteRequests = 0;

    setUpdateCounters({ newPutRequestLength, newDeleteRequestLength }) {
        if (newPutRequestLength) this.totalPutRequests += newPutRequestLength;
        if (newDeleteRequestLength) this.totalDeleteRequests += newDeleteRequestLength;
    }

    resetCounters() {
        this.totalPutRequests = 0;
        this.totalDeleteRequests = 0;
    }
}

const validateRequestItem = (request, tableName) => request?.RequestItems[tableName]?.length
    && request;

const remainingItemsProcessor = async (unprocessedItemsArr, tableName) => {
    console.info(`Processing remaining items with count: ${unprocessedItemsArr.length}`);
    for (let index = 0; index < unprocessedItemsArr.length; index++) {
        console.info(`Processing item ${index + 1}/${unprocessedItemsArr.length}...`);
        const item = unprocessedItemsArr[index];
        await processUnprocessedItems(item, tableName);
    }
};

const markUsersAsExported = async (usersArr) => {
    const chunkedUsers = splitArray(usersArr, 25);
    let promises = [];
    const unprocessedItems = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const chunk of chunkedUsers) {
        if (promises.length === STANDARD_PROMISE_SIZE) {
            console.log('Executing batch...');
            await Promise.all(promises);
            promises = [];
        }
        promises.push(
            batchUpdateMigratedUsers(chunk)
                .then((res) => {
                    if (res.UnprocessedItems[MIGRATION_TABLE]?.length) {
                        unprocessedItems.push(res.UnprocessedItems);
                    }
                }));
    }
    if (promises.length) await Promise.all(promises);

    if (!unprocessedItems.length) return console.log('All items succesffully marked as exported');

    return remainingItemsProcessor(unprocessedItems, MIGRATION_TABLE);
};

const batchUpdateMigratedUsers = (chunkedUsers) => {
    const insertParams = {
        RequestItems: {
            [MIGRATION_TABLE]: [],
        },
    };
    chunkedUsers.forEach((item) => {
        item.exported = true;
        insertParams.RequestItems[MIGRATION_TABLE].push({
            PutRequest: {
                Item: item,
            },
        });
    });
    return batchWriteToPromise(insertParams);
};

const deleteUsers = (users) => Promise.allSettled(users.map(({ hashedKocid }) => deleteItem({
    TableName: MIGRATION_TABLE,
    Key: {
        hashedKocid,
    },
    ConditionExpression: 'migrated = :toBeDeleted',
    ExpressionAttributeValues: {
        ':toBeDeleted': true,
    },
})));

const getWalletRecord = async (oldRecordWallet, newGppUserId) => {
    const { currency_id, amount: oldRecordAmount } = oldRecordWallet;
    const existingWalletItem = await mainQuery(newGppUserId, currency_id);

    const existingAmount = existingWalletItem?.[0]?.amount ?? 0;
    const sumAmount = oldRecordAmount + existingAmount;

    const walletItem = existingWalletItem?.[0] || oldRecordWallet;

    const walletRecord = {
        ...walletItem,
        gpp_user_id: newGppUserId,
        amount: sumAmount,
    };
    return walletRecord;
};

module.exports = {
    checkIfUserMigrated,
    getUserForMigration,
    getUsersToMigrate,
    markUserAsBlocked,
    markUserAsMigrated,
    getUserRecords,
    makeBatchedRequests,
    RequestCounters,
    validateRequestItem,
    remainingItemsProcessor,
    removeProcessorFromUser,
    markUsersAsExported,
    deleteUsers,
    getUserWithLargerCount,
};
