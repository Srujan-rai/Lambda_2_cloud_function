/* eslint-disable */
'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const ContentDisposition = require('content-disposition');
const CryptoJS = require('crypto-js');

const client = new DynamoDBClient({region: 'eu-west-1'});
const docClient = DynamoDBDocumentClient.from(client);

const HASHED_UUID_REGEX = /^[a-fA-F0-9]{64}$/;

/**
 *  * This object holds the instances for which we want to do the data export
 *   * @typedef Instances
 *    * @type {Object}
 *     * @property {Object} stageName - dynamic property, currently used for prod instances
 *      */

/**
 *  * If the instance has specific requirements, they can be easily set up, by providing
 *   * the `setup` property into the instance object. The value has to be a function that will be executed at
 *    * a later stage. See `setupItalyInstance` for reference.
 *     * @typedef Instance
 *      * @type {Object}
 *       * @property {Object} stageName - dynamic property, currently used for prod instances
 *        * @property {function} setup - stores function that setups instance specific configurations
 *         * @property {string} bucketName - the bucket which we want to use for the instance
 *          */
const instances = {
    'prod': {
        bucketName: 'ngps-private-bucket-prod'
    }
};

/**
 *  * The tables which will be used to query the data
 *   */
const tables = [
    'gpp_currency_table',
    'gpp_participations_table',
    'gpp_transaction_table',
    'gpp_prize_catalogue_table',
    'gpp_promotions_table'
];

/**
 *  * Execute the provided setup function ( if exists ) for the passed instance
 *   * @param {string} instance
 *    * @returns {Promise}
 *     */
const instanceCustomSetup = (instance) => {
    if (typeof instances[instance].setup === 'function') {
        instances[instance].setup();
    }
    return Promise.resolve();
};

/**
 *  * A Function that will run daily and export daily entries for analytic purposes
 *   * Will loop through {Instances} object and will execute the Promise chain for every instance
 *    * The important is the order of the execution. Every instance has to wait for the previous to finish,
 *     * because if don't the aws-sdk config can be overridden if the secific instance has a different needs(different region etc.)
 *      */
const dataExporterLambda = async () => {
    console.log("Starting daily data export..");

    for (const instance of Object.keys(instances)) {
        const dataExportDate = getExportDate();

        await instanceCustomSetup(instance)
            .then(() => setupTables(instance))
            .then(tables => exportTablesData(dataExportDate, tables, instance))
            .then(result => {
                console.log("dateExporterLambda finished");
                return { dataExportCompleted: true, failedTables: result.failedTables };
            })
            .catch(err => console.log("Daily data export failed with", err));
    }
};

/**
 *  * Will create the table names for the specific instance and will put files counter in every table
 *   * Example of the object structure -> {'gpp_currency_table_production-it': {filesCount: 0}}
 *    * @param {string} instance
 *     * @returns {Array.<Object>} the tables
 *      */
const setupTables = (instance) => {
    console.log(`Setting up ${instance} tables`);
    return tables.reduce((acc, val) => {
        acc[`${val}_${instance}`] = {
            filesCount: 0
        };
        return acc;
    }, {});
};

/**
 *  * Runs query for each table that needs to be exported to s3 daily
 *   * @param dataExportDate - obj that contains date in milliseconds and previous date in str format
 *    * @param {Array} tables to iterate over
 *     * @param {string} instance the name of the instance, will be used to retrieve the specific bucket name
 *      *
 *       * @returns {Promise}
 *        */
const exportTablesData = (dataExportDate, tables, instance) => {
    let promises = [];
    let exportResult = { failedTables: [], exportedTables: []};

    Object.keys(tables).forEach(table => {
        promises.push(
            query(dataExportDate, table, tables[table].filesCount, instance)
                .then(() => {
                    console.log("Export for " + table + " completed.");
                    exportResult.exportedTables.push(table);
                    return Promise.resolve();
                })
                .catch(err => {
                    console.log("failed " + table + " export with err", err);
                    exportResult.failedTables.push(table);
                    return Promise.resolve();
                })
        );
    });

    return Promise.all(promises)
        .then(() => {
            console.log("Exporting db tables finished");
            console.log("Failed table exports: ",  exportResult.failedTables);
            console.log(new Date());
            return Promise.resolve(exportResult);
        }).catch(error => {
            console.log("Something went wrong with tables exporting: ",error);
            return Promise.reject(error);
        });
};

/**
 *  * Query that will return all entires for the specified date by using index - entry_date
 *   * @param queryDate
 *    * @param table
 *     * @param filesCount
 *      * @param {string} instance the name of the instance, will be used to retrieve the specific bucket name
 *       *
 *        * @returns {Promise}
 *         */
const query = (queryDate, table, filesCount, instance) => {
    let expression = "entry_date = :entry_date";
    let expressionValues = {
        ":entry_date": queryDate.queryDateStr
    };
    let index = "entry_date";
    let queryParams = {
        TableName : table,
        KeyConditionExpression: expression,
        ExpressionAttributeValues: expressionValues
    };
    if (index) {
        queryParams.IndexName = index;
    }
    return queryLocal(queryParams, false, queryDate, filesCount, instance);
};

/**
 *  * Return the date of running in format - 2019-02-28"
 *   * @returns {Object} contains timestamp and ISO date
 *    */
const getExportDate = () => {
    let date = new Date();
    let dateMil = date.getTime();
    date.setDate(date.getDate()-1);
    let previousDay = date.toISOString().slice(0,10);
    return {dateMil: dateMil, queryDateStr: previousDay};
};

/**
 *  * Save exported db table
 *   * @param {Object} dbData query result
 *    * @param {string} tableName the name of the table
 *     * @param {Object} date ISO format date and timestamp
 *      * @param {Number} counter file counter
 *       * @param {string} instance the name of the instance, will be used to retrieve the specific bucket name
 *        *
 *         * @returns {Promise}
 *          */
const saveDataToS3 = async (dbData, tableName, date, counter, instance) => {
    console.log("saving csv to s3 ....", tableName, date, counter);
    const fileName = `analysis/${date.queryDateStr}/${tableName}_${date.dateMil}-${counter}.json`;
    const file = {
        Key: fileName,
        Body: JSON.stringify(dbData),
        Bucket: instances[instance].bucketName,
        ContentType: 'application/json',
        ContentDisposition: ContentDisposition(fileName, {
            type: 'inline'
        })
    };
    const S3 = new S3Client();
    try {
        const putCommand = new PutObjectCommand(file)
        const data = await S3.send(putCommand);
        console.log("File successfully saved to S3 bucket");
        console.log(`S3 object data has been received: ${JSON.stringify(data)}`);
        return {fileSaved: true};
    } catch (error) {
        console.log("file not written to S3 bucket", error);
        throw new Error("file not written")
    }
};

/**
 *  * Execute the db query
 *   * @param {Object} queryParams
 *    * @param {Boolean} limitQuery
 *     * @param {Object} queryDateStr ISO format date and timestamp
 *      * @param {Number} counter file counter
 *       * @param {string} instance the name of the instance, will be used to retrieve the specific bucket name
 *        *
 *         * @returns {Promise}
 *          */
const queryLocal = async (queryParams, limitQuery, queryDateStr, counter, instance) => {
        let dataReceived = [];
        await DBQuery(queryParams);

        async function DBQuery (queryParams){
            try {
                const command = new QueryCommand(queryParams)
                const data = await docClient.send(command);
                dataReceived = dataReceived.concat(data.Items)
                let bigData = false;
                if(dataReceived.length > 100000) {
                    await saveDataToS3(
                        await hashUUIDs(dataReceived),
                        queryParams.TableName,
                        queryDateStr,
                        counter,
                        instance
                    );
                    dataReceived = [];
                    counter++;
                    bigData = true;
                }

                if(data.LastEvaluatedKey && !limitQuery && !queryParams.Limit) {
                    console.log("more items to query.. continuing..");
                    queryParams.ExclusiveStartKey = data.LastEvaluatedKey;
                    return await DBQuery(queryParams);
                } else {
                    console.log("no more items! Returning result..");

                    if (!bigData) {
                        await saveDataToS3(
                            await hashUUIDs(dataReceived),
                            queryParams.TableName,
                            queryDateStr,
                            counter,
                            instance
                        );
                    }
                    counter = 0;

                  return dataReceived;
                }
            } catch (err) {
                console.log("ERROR while trying to query db");
                console.log("ERROR: " + JSON.stringify(err));
                let errorBody = "Failed to read data";
                throw errorBody;
            }
        }
};

/**
 *  * Hash uuids using SHA-256 and return back the result
 *   * @param {Array} queryResult query result
 *    *
 *     * @returns {Promise}
 *      */
const hashUUIDs = (queryResult) => {
    if (queryResult[0] && !queryResult[0].gpp_user_id) {
        return Promise.resolve(queryResult);
    }

    const result = queryResult.reduce((newQueryResult, record) => {
        const { gpp_user_id, inserted_transactions } = record;
        const hashedUserID = getHashedUserId(gpp_user_id);

        record = {
            ...record,
            gpp_user_id: hashedUserID,
        };

        if (inserted_transactions && inserted_transactions.length) {
            record = {
                ...record,
                inserted_transactions: inserted_transactions.map((transaction) => (
                    {
                        ...transaction,
                        gpp_user_id: transaction.gpp_user_id === gpp_user_id
                            ? hashedUserID
                            : getHashedUserId(transaction.gpp_user_id),
                    }
                )),
            };
        }

        return [...newQueryResult, record];
    }, []);

    return Promise.resolve(result);
};

/**
 *  * Hash uuids using SHA-256 for userid and return back the result
 *  * @param {string} gppUserId
 *  *
 *  * @returns {string}
 *  */
const getHashedUserId = (gppUserId) => {
    const [userId] = gppUserId.split('|');
    return userId.match(HASHED_UUID_REGEX) ? userId : CryptoJS.SHA256(userId).toString();
};

dataExporterLambda();

module.exports = {
    hashUUIDs
};
