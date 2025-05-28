const ContentDisposition = require('content-disposition');
const { createResponse, getExportDate } = require('../utility_functions/utilityFunctions');
const { saveToS3 } = require('../utility_functions/aws_sdk_utils/s3Utilities');
const { query: DBQuery } = require('../database/dbUtilities');
const { RESPONSE_OK } = require('../constants/responses');
const TABLES = require('../constants/tableNames');

/**
 * Query that will return all entires for the specified date by using index - entry_date
 * @param queryDate
 * @param table
 */
const query = (queryDate, table) => {
    const expression = 'entry_date = :entry_date';
    const expressionValues = {
        ':entry_date': queryDate,
    };
    const index = 'entry_date';
    const queryParams = {
        TableName: table,
        KeyConditionExpression: expression,
        ExpressionAttributeValues: expressionValues,
    };
    if (index) {
        queryParams.IndexName = index;
    }
    return DBQuery(queryParams);
};

/*
 * Save exported db table
 */
const saveDataToS3 = (dbData, tableName, date) => {
    console.log('Saving CSV to S3...');
    const fileName = `analysis/${date.queryDateStr}/${tableName}_${date.dateMil}.json`;

    return saveToS3({
        Key: fileName,
        Body: JSON.stringify(dbData),
        Bucket: process.env.PRIVATE_BUCKET,
        ContentType: 'application/json',
        ContentDisposition: ContentDisposition(fileName, {
            type: 'inline',
        }),
    });
};

/**
 * Runs query for each table that needs to be exported to s3 daily
 * @param dataExportDate - obj that contains date in milliseconds and previous date in str format
 */
const exportTablesData = (dataExportDate) => {
    const tablesForData = [
        TABLES.GPP_TRANSACTION_TABLE,
        TABLES.GPP_CURRENCY_TABLE,
        TABLES.GPP_PARTICIPATIONS_TABLE,
        TABLES.GPP_PRIZE_CATALOGUE_TABLE,
    ];

    const promises = [];
    const exportResult = { failedTables: [], exportedTables: [] };

    tablesForData.forEach((table) => {
        const promise = query(dataExportDate.queryDateStr, table)
            .then((result) => {
                console.log('Query returned response');
                return saveDataToS3(result, table, dataExportDate);
            })
            .then(() => {
                console.log('Export for', table, 'table completed.');
                exportResult.exportedTables.push(table);
                return Promise.resolve();
            })
            .catch((err) => {
                console.error('ERROR: Failed to export', table, 'table:\n', JSON.stringify(err));
                exportResult.failedTables.push(table);
                return Promise.resolve();
            });
        promises.push(promise);
    });

    return Promise.all(promises)
        .then(() => {
            console.log('Exporting DB tables finished successfully.');
            console.log('Failed table exports:\n', JSON.stringify(exportResult.failedTables));
            return Promise.resolve(exportResult);
        }).catch((error) => {
            console.error('ERROR: Failed to export DB tables:\n', JSON.stringify(error));
            return Promise.reject(error);
        });
};

/**
 * Lambda that will run daily and export daily entries for analytic purposes
 * @param event - data that we receive from request
 * @param context
 * @param callback - returned data
 */
const dataExporterLambda = (event, context, callback) => {
    console.log('Received event:\n', JSON.stringify(event));
    console.log('Starting daily data export...');
    const dataExportDate = getExportDate();

    exportTablesData(dataExportDate)
        .then((result) => {
            const response = createResponse(RESPONSE_OK, {
                dataExportCompleted: true,
                failedTables: result.failedTables,
            });
            console.log('Returning response...');
            callback(null, response);
        })
        .catch((errorResponse) => {
            console.error('ERROR: Daily data export failed:\n', JSON.stringify(errorResponse));
            callback(null, errorResponse);
        });
};

module.exports = {
    dataExporterLambda,
};
