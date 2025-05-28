const Commons = require('@the-coca-cola-company/ngps-global-common-utils');
const ContentDisposition = require('content-disposition');
const PrizeCatalogue = require('../database/prizeCatalogueTable');
const UploadUtils = require('../utility_functions/fileUploadUtils');
const Utils = require('../utility_functions/utilityFunctions');
const {
    getFileFromS3,
    deleteFileFromS3,
    saveToS3,
    listObjectsInS3,
} = require('../utility_functions/aws_sdk_utils/s3Utilities');
const { RESPONSE_INTERNAL_ERROR, RESPONSE_OK } = require('../constants/responses');
const { ERR_CODES: { UNKNOWN_REASON } } = require('../constants/errCodes');

/**
 * Goes thru prize catalogue table and scans for prize which was item auto_upload_digital_codes,
 * returns all prizes with the auto_upload = 1;
 */
const getAutoUploadDigitalCodesPrizes = async () => PrizeCatalogue.queryAutoUploadPrizes();

/**
 * List objects from the spcecific prizeid/ConfigurationId bucket, and selects the first .csv file,
 * in order to upload it as the next batch for autoUploadDigitalodes flow.
 * @param {*} prizeId
 * @param {*} configurationId
 */
const listFolderObjects = async (prizeId, configurationId) => {
    const params = {
        Bucket: process.env.PRIVATE_BUCKET,
        Delimiter: '/',
        Prefix: `${configurationId}/prizes/${prizeId}/digitalCodesBulkUpload/`,
    };
    const data = await listObjectsInS3(params);
    const parsedBody = JSON.parse(data.body);
    const parsedResponse = JSON.parse(parsedBody.filesListed);
    return parsedResponse;
};

/**
 * Checks whether the file is a csv one.
 * @param {String} str
 * @param {String} csvEnding
 */
const confirmCsvFile = (str) => {
    const csvEnding = '.csv';
    const checker = str.substr(-(csvEnding.length)) === csvEnding;
    return checker;
};

/**
 * Goes thru all files uploaded in the s3-bucket-conf-prizes-digitalCodesBulkUpload and gets the first csv file,
 * in order to put it in dynamo db.
 * @param {Object} listObjects
 */
const getCsvFile = (listObjects) => {
    // eslint-disable-next-line no-restricted-syntax
    for (const file of listObjects.Contents) {
        const fileName = file.Key;
        const unusedCsv = confirmCsvFile(fileName);
        if (unusedCsv) {
            return fileName;
        }
    }
};

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
 * Lambda Which will go execute every 24h and go through the prize catalogue,
 * mark any prizes which has auto_upload as 1 and check whether the threshold for auto-upload of was reached,
 * The threshold for auto uploda is whether available vouchers are fewer than 50% of the vouchers in the first
 * taken csv file form the folder.
 */
module.exports.digitalCodesBulkUploadDailyLambda = async () => {
    const autoUploadPrizes = await getAutoUploadDigitalCodesPrizes();
    // TODO to be revisited and modified if possible to not block the thread with the await in the loop
    // eslint-disable-next-line no-restricted-syntax
    for (const prize of autoUploadPrizes) {
        const configurationId = prize.configuration_id;
        const prizeId = prize.prize_id;
        const totalAvailable = prize.total_available;
        try {
            const listObjects = await listFolderObjects(prizeId, configurationId);
            const csvFile = getCsvFile(listObjects);
            if (csvFile) {
                const exctractEntriesCsvParams = {
                    readConfFileParams: {
                        Bucket: process.env.PRIVATE_BUCKET,
                        Key: csvFile,
                        ResponseContentType: 'text/csv',
                    },
                };
                const expectedHeader = Commons.COMMON.EXPECTED_VOUCHERS_CSV_HEADER;
                const newEntries = await Commons.UTILITY_FUNCTIONS.extractCsvEntries(
                    exctractEntriesCsvParams, expectedHeader,
                    false, true, getFileFromS3,
                );
                const newVouchersLenght = newEntries.length / 2;
                if (totalAvailable < newVouchersLenght) {
                    await UploadUtils.sendCodesToSQS(newEntries, configurationId, prizeId);
                    const deleteCsvFileParams = {
                        Bucket: process.env.PRIVATE_BUCKET,
                        Key: csvFile,
                    };
                    await deleteFileFromS3(deleteCsvFileParams);
                    await uploadWrittenFilesToS3(csvFile, newEntries, configurationId, prizeId);
                }
            } else {
                console.log(`CSV not found for ${prizeId}`);
            }
        } catch (err) {
            const errorBody = Utils.createErrorBody(UNKNOWN_REASON,
                'Something went wrong! Vouchers were not uploaded.');
            const errorResponse = Utils.createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
            throw errorResponse;
        }
    }
    const response = Utils.createResponse(RESPONSE_OK, {});
    console.log('Returning response:\n', JSON.stringify(response));
    return response;
};
