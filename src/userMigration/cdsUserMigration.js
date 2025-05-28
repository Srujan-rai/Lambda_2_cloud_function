const { Writable, Transform, Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const Moment = require('moment');

const { batchWriteToPromise } = require('../database/dbUtilities');
const TableNames = require('../constants/tableNames');
const {
    TABLE_QUERY_PARAMS: tableQueryParams,
    MAX_WRITE_CAPACITY_UNITS,
    STANDARD_PROMISE_SIZE,
    MAX_WCU_WAIT_TIME,
    MAX_ITERATION_COUNT,
    MAX_ITERATION_LARGE_COUNT,
} = require('./migrationConstants');
const {
    markUserAsBlocked,
    markUserAsMigrated,
    getUserRecords,
    makeBatchedRequests,
    RequestCounters,
    validateRequestItem,
    getUserForMigration,
    getUserWithLargerCount,
    remainingItemsProcessor,
    removeProcessorFromUser,
} = require('./cdsMigrationUtils');

const Counters = new RequestCounters();
const requestsAcc = new Map();

let MAX_ITERATIONS = MAX_ITERATION_COUNT;

const slowerTableWriter = async (tableRequests) => {
    const {
        putRequests, deleteRequests, tableName, userId,
    } = tableRequests;

    const unprocessedItemsArr = [];
    let totalWcuUsed = 0;

    for (let index = 0; index < putRequests.length; index++) {
        let wcuUsedInIteration = 0;

        if (totalWcuUsed >= MAX_WRITE_CAPACITY_UNITS) {
            console.info('pausing write operations for ', tableName, 'as ', totalWcuUsed, ' write units have been used');
            await new Promise((res) => setTimeout(res, MAX_WCU_WAIT_TIME));
            totalWcuUsed = 0;
        }

        const putRequest = putRequests?.length && validateRequestItem(putRequests[index], tableName);
        const promises = [];
        if (putRequest) {
            promises.push(
                batchWriteToPromise(putRequest).then(async (putRes) => {
                    const consumedUnits = putRes.ConsumedCapacity[0].CapacityUnits;
                    wcuUsedInIteration += consumedUnits;

                    if (putRes.UnprocessedItems[tableName]?.length) {
                        console.info(`${putRes.UnprocessedItems[tableName].length}, Unprocessed put items for user: ${userId}`);
                        unprocessedItemsArr.push(putRes.UnprocessedItems);
                    }
                }),
            );
        }

        const deleteRequest = deleteRequests?.length && validateRequestItem(deleteRequests[index], tableName);
        if (deleteRequest) {
            promises.push(batchWriteToPromise(deleteRequest).then((delRes) => {
                const consumedUnits = delRes.ConsumedCapacity[0].CapacityUnits;
                wcuUsedInIteration += consumedUnits;

                if (delRes.UnprocessedItems[tableName]?.length) {
                    console.info(`${delRes.UnprocessedItems[tableName].length}, Unprocessed delete items for user: ${userId}`);
                    unprocessedItemsArr.push(delRes.UnprocessedItems);
                }
            }));
        }

        await Promise.allSettled(promises);
        totalWcuUsed += wcuUsedInIteration;
    }

    if (!unprocessedItemsArr.length) return console.info('Slow processor finished writing records for', tableName);

    await remainingItemsProcessor(unprocessedItemsArr, tableName);
};

const standardTableWriter = async (tableRequests) => {
    const {
        putRequests, deleteRequests, tableName, userId,
    } = tableRequests;

    const unprocessedItemsArr = [];

    let promises = [];
    for (let index = 0; index < putRequests.length; index++) {
        if (promises.length === STANDARD_PROMISE_SIZE) {
            await Promise.all(promises);
            promises = [];
        }

        const putRequest = putRequests?.length && validateRequestItem(putRequests[index], tableName);
        if (putRequest) {
            promises.push(
                batchWriteToPromise(putRequest)
                    .then(async (putRes) => {
                        if (putRes.UnprocessedItems[tableName]?.length) {
                            console.info(`${putRes.UnprocessedItems[tableName].length}, Unprocessed put items for user: ${userId}`);
                            unprocessedItemsArr.push(putRes.UnprocessedItems);
                        }
                    }));
        }

        const deleteRequest = deleteRequests?.length && validateRequestItem(deleteRequests[index], tableName);
        if (deleteRequest) {
            promises.push(
                batchWriteToPromise(deleteRequest).then((delRes) => {
                    if (delRes.UnprocessedItems[tableName]?.length) {
                        console.info(`${delRes.UnprocessedItems[tableName].length}, Unprocessed delete items for user: ${userId}`);
                        unprocessedItemsArr.push(delRes.UnprocessedItems);
                    }
                }));
        }
    }

    if (promises.length) await Promise.allSettled(promises);

    if (!unprocessedItemsArr.length) return console.info('Standard processor finished writing records for', tableName);

    await remainingItemsProcessor(unprocessedItemsArr, tableName);
};

const dbWriter = () => new Writable({
    objectMode: true,
    highWaterMark: 1,
    async write(requests, _encoding, callback) {
        if (requests.size !== tableQueryParams.length) return callback(null);

        try {
            console.info('Writing data to DB...');
            const slowPromises = [];
            const standardPromises = [];
            requests.forEach((value, key) => {
                if (key === TableNames.GPP_PARTICIPATIONS_TABLE || key === TableNames.GPP_TRANSACTION_TABLE) {
                    slowPromises.push(slowerTableWriter(value));
                    return;
                }

                standardPromises.push(standardTableWriter(value));
            });

            await Promise.all([...slowPromises, ...standardPromises]);
            console.info('Finished writing data! Returning...');
            return callback(null);
        } catch (error) {
            console.error(error);
            callback(error);
        }
    },
});

const userRecordsProcessor = (identities, uuid, hashedKocid) => new Transform({
    objectMode: true,
    highWaterMark: 1,
    async transform(tableParams, _encoding, callback) {
        const tableName = tableParams.TableName;

        requestsAcc.set(tableName, {
            putRequests: [],
            deleteRequests: [],
            tableName,
            userId: hashedKocid,
        });

        for (let index = 0; index < identities.length; index++) {
            const identityType = identities[index];
            const gppUserId = `${uuid}|${identityType}`;

            const records = await getUserRecords(tableParams, gppUserId);
            const tableItem = requestsAcc.get(tableName);

            if (records.length) {
                console.info(`Total User Records Found: ${records.length}`);

                const putRequests = await makeBatchedRequests({
                    records,
                    tableParams,
                    hashedKocid,
                    identityType,
                    requestType: 'put',
                });

                const deleteRequests = tableParams?.Delete && await makeBatchedRequests({
                    records,
                    tableParams,
                    requestType: 'delete',
                });

                const updatedItem = {
                    ...tableItem,
                    putRequests: [...tableItem.putRequests, ...putRequests],
                    deleteRequests: [...tableItem.deleteRequests, ...deleteRequests || []],
                };
                requestsAcc.set(tableName, updatedItem);

                Counters.setUpdateCounters({
                    newPutRequestLength: records.length,
                    newDeleteRequestLength: tableParams?.Delete && records.length,
                });
            }
        }

        callback(null, requestsAcc);
    },
});

const processUser = async (user) => {
    console.info(`
        Starting migration of user with record,
        ${JSON.stringify(user)}
    `);
    const { uuid, hashedKocid, identities } = user;

    try {
        await markUserAsBlocked(hashedKocid);

        const readableStream = Readable.from(tableQueryParams);
        await pipeline(
            readableStream,
            userRecordsProcessor(identities, uuid, hashedKocid),
            dbWriter()
                .on('close', async () => console.info('Stream Closed, Returning...')),
        );

        await markUserAsMigrated(hashedKocid);
        console.info(`
            User: ${hashedKocid} was successfully marked for export!
            Total migrated records for user ${hashedKocid}: ${Counters.totalPutRequests}.
            Total deleted records for user ${uuid}: ${Counters.totalDeleteRequests}.
        `);

        requestsAcc.clear();
        Counters.resetCounters();
    } catch (err) {
        // user remains blocked in a pending migration status and will be retried on the next run.
        console.error('An error occurred', err);
        await removeProcessorFromUser(hashedKocid);
        throw err;
    }
};

const migrateUser = async () => {
    try {
        console.time('Total execution time at completion');

        let totalProcessedUsers = 0;

        for (let index = 0; index < MAX_ITERATIONS; index++) {
            console.time('Time taken to migrate user');
            const users = await getUserForMigration();
            let user = users[0];
            MAX_ITERATIONS = MAX_ITERATION_COUNT;

            if (!user) {
                console.info('No user marked for migration');
                const startTime = Moment('01:00:00', 'hh:mm:ss');
                const endTime = Moment('06:00:00', 'hh:mm:ss');
                if (Moment().isBetween(startTime, endTime)) {
                    console.log('Getting users with rCount greater than 2000');
                    MAX_ITERATIONS = MAX_ITERATION_LARGE_COUNT;
                    const largeCountUsers = await getUserWithLargerCount();
                    user = largeCountUsers[0];
                }
            }

            // check if there is a user after scanning for users and exit loop if not found.
            if (!user) return console.info('No user returned from migration table for processing');

            if (user) {
                console.info('Processing user:', totalProcessedUsers + 1);
                await processUser(user);
                totalProcessedUsers++;
                console.timeEnd('Time taken to migrate user');
            }
        }

        console.info(`Execution complete, total migrated users: ${totalProcessedUsers}`);
        console.timeEnd('Total execution time at completion');
    } catch (err) {
        console.error('ERROR: Failed to user migration execution: ', err);
    }
};

module.exports = { migrateUser };
