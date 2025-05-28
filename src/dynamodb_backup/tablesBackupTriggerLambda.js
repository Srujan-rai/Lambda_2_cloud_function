const { captureAWSv3Client } = require('aws-xray-sdk-core');
const { DynamoDBClient, CreateBackupCommand } = require('@aws-sdk/client-dynamodb');
const Utils = require('../utility_functions/utilityFunctions');
const { tables } = require('../database/databaseSchema.json');

const dynamodb = captureAWSv3Client(new DynamoDBClient({ region: process.env.regionName }));
const { RESPONSE_OK } = require('../constants/responses');
/**
 * Function that requests on-demand backup to be created
 * for a particular table
 * @param String tableName - name of table
 *
 * @returns {Promise} - Returns Promise after completing the call to Dynamodb
 */
const createBackup = (tableName) => {
    const timestamp = (new Date()).getTime();
    const command = new CreateBackupCommand({
        BackupName: `${tableName}-${timestamp}`,
        TableName: tableName,
    });
    return dynamodb.send(command);
};

/**
 * Lambda that runs monthly checks if on-demand backup is enabled for the environment
 * and submit requests for it if it is
 * @param {Object} event - data that we receive from request
 * @param {Object} context - Lambda context
 * @param callback - returned data
 */
module.exports.tablesBackupTriggerLambda = (event, context, callback) => {
    if (process.env.enableOnDemandDbBackups === 'false') {
        return callback(null, { error: 'db backup not enabled.' });
    }

    const environmentTableNames = tables.map((table) => `${table.name}_${process.env.stageName}`);
    const promises = [];
    environmentTableNames.forEach((tableName) => {
        const promise = createBackup(tableName)
            .then(() => {
                console.log(`[backup] successfully requested backup for ${tableName}`);
                return Promise.resolve();
            })
            .catch((err) => {
                console.log(`Backup for table ${tableName} failed with ${err}`);
                return Promise.reject(err);
            });
        promises.push(promise);
    });

    return Promise.allSettled(promises)
        .then((results) => {
            const failedBackupRequests = results.filter((result) => result.status === 'rejected').length;
            const succesfullBackupRequests = results.filter((result) => result.status === 'fulfilled').length;
            const response = Utils.createResponse(RESPONSE_OK, { backupsTrigged: succesfullBackupRequests, failed: failedBackupRequests });
            console.log('Result of execution: ', JSON.stringify(response));
            callback(null, response);
        })
        .catch((err) => {
            console.error('ERROR: Returning error response:\n', JSON.stringify(err));
            callback(null, err);
        });
};
