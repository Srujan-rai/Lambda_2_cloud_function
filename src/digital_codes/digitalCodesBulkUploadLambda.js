const Commons = require('@the-coca-cola-company/ngps-global-common-utils');
const ContentDisposition = require('content-disposition');
const { sendCodesToSQS } = require('../utility_functions/fileUploadUtils');
const {
    mainQuery,
    updateEntry,
} = require('../database/prizeCatalogueTable');
const {
    createErrorBody,
    createResponse,
} = require('../utility_functions/utilityFunctions');
const {
    saveToS3,
    deleteFileFromS3,
    getFileFromS3,
} = require('../utility_functions/aws_sdk_utils/s3Utilities');
const { ERR_CODES: { UNKNOWN_REASON } } = require('../constants/errCodes');
const { RESPONSE_INTERNAL_ERROR, RESPONSE_OK } = require('../constants/responses');

/**
 * Uploads the previously downloaded csv file, which codes were written to dynamodb,
 * as json file for data retention.
 * @param {*} fileName
 * @param {*} uploadedCodesToDynamo
 */
const uploadWrittenFilesToS3 = (fileName, uploadedCodesToDynamo) => saveToS3({
    Key: `${fileName}.json`,
    Body: JSON.stringify(uploadedCodesToDynamo),
    Bucket: process.env.PRIVATE_BUCKET,
    ContentType: 'application/json',
    ContentDisposition: ContentDisposition(`${fileName}.json`, {
        type: 'inline',
    }),
});

/**
 * Function which hansles the initial batch write of the auto upload functionality.
 * Always takes the first uploaded csv file and writtes it in dynamodb, after which uploads the same file
 * in json format for data retention. If the prize in dynamodb has auto_upload_vouchers column,
 * meaning that it's already part of the bulkUpload lambdas, it will not trigger the upload/deletion of the
 * first file which it receives.
 * @param {Object} event
 */
const digitalCodesBulkUploadLambda = async (event) => {
    const receivedEventParse = JSON.parse(event.body);
    const { configurationId, prizeId, fileNames } = receivedEventParse;
    const prizeCatalogeObject = await mainQuery(configurationId, prizeId);

    if (!(('auto_upload_vouchers') in prizeCatalogeObject[0])) {
        const filePath = `${configurationId}/prizes/${prizeId}/digitalCodesBulkUpload/${fileNames}`;
        try {
            const exctractEntriesCsvParams = {
                readConfFileParams: {
                    Bucket: process.env.PRIVATE_BUCKET,
                    Key: filePath,
                    ResponseContentType: 'text/csv',
                },
            };
            const expectedHeader = Commons.COMMON.EXPECTED_VOUCHERS_CSV_HEADER;
            const newEntries = await Commons.UTILITY_FUNCTIONS.extractCsvEntries(
                exctractEntriesCsvParams, expectedHeader, false, true, getFileFromS3,
            );
            await sendCodesToSQS(newEntries, configurationId, prizeId);
            const deleteCsvFileParams = {
                Bucket: process.env.PRIVATE_BUCKET,
                Key: filePath,
            };
            await deleteFileFromS3(deleteCsvFileParams);
            await uploadWrittenFilesToS3(filePath, newEntries);

            const dbUpdateParams = {
                configurationId,
                prizeId,
                autoUploadVouchers: '1',
            };

            await updateEntry(dbUpdateParams);
            const response = createResponse(RESPONSE_OK, {});
            console.log('Returning response:\n', JSON.stringify(response));
            return response;
        } catch (err) {
            const errorBody = createErrorBody(UNKNOWN_REASON,
                'Something went wrong! Vouchers were not uploaded.');
            const errorResponse = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);

            throw errorResponse;
        }
    } else {
        const response = createResponse(RESPONSE_OK, {});
        console.log('Returning response:\n', JSON.stringify(response));
        return response;
    }
};

module.exports = {
    digitalCodesBulkUploadLambda,
};
