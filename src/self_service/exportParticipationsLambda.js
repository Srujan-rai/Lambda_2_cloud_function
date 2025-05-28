const {
    extractParams,
    createResponse,
    createErrorBody,
    exportToCSV,
} = require('../utility_functions/utilityFunctions');
const { getConfiguration } = require('../utility_functions/configUtilities');
const {
    uploadToS3,
    createSignedURL,
} = require('../utility_functions/aws_sdk_utils/s3Utilities');
const { queryByConfigurationAndBetweenDates } = require('../database/participationsDatabase');
const { RESPONSE_OK, RESPONSE_INTERNAL_ERROR } = require('../constants/responses');
const { ERROR_CODES: { DYNAMO_DB_ERROR } } = require('../constants/errCodes');
const { participationExportCSVHeaders } = require('../constants/fileSchemas');

/**
 * Lambda for handling requests for exporting participation data into csv file.
 * @param event - data that we receive from request
 */
module.exports.exportParticipationsLambda = async (event) => {
    try {
        const params = extractParams(event);
        await getConfiguration(params.configurationId, event);
        const response = await exportUserDataParticipation(params.configurationId, params.startDate, params.endDate);
        return response;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', JSON.stringify(errorResponse));
        return errorResponse;
    }
};

/**
 * Creates/stores csv and returns link to donwload csv file from private S3 bucket
 * that contains participations data for provided promotion id between dates.
 * @param {String} configurationId
 * @param {String} startDate
 * @param {String} endDate
 */
const exportUserDataParticipation = async (configurationId, startDate, endDate) => {
    try {
        const participations = await queryByConfigurationAndBetweenDates(configurationId, startDate, endDate);
        const csv = await genarateCsvFile(participations);
        const signedUrl = await storeCsvFile(configurationId, csv, startDate, endDate);
        const response = createResponse(RESPONSE_OK, { userDataParticipationExported: true, url: signedUrl });
        return response;
    } catch (err) {
        console.error(err);
        const errorBody = createErrorBody(DYNAMO_DB_ERROR,
            'Failed to export participation data');
        const errorResponse = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
        throw errorResponse;
    }
};

/**
 * Writes provided csv file into promotion directory into private S3 bucket.
 * @param {String} configurationId
 * @param {Array} csvFile
 * @param {String} startDate
 * @param {String} endDate
 */
const storeCsvFile = async (configurationId, csvFile, startDate, endDate) => {
    const fileName = `${configurationId}/report/promotion_report-${startDate}-${endDate}.csv`;
    const filePath = await uploadToS3(csvFile, configurationId, fileName, process.env.PRIVATE_BUCKET, 'Key');
    return createSignedURL(filePath, process.env.PRIVATE_BUCKET);
};

/**
 * Writes provided csv file into promotion directory into private S3 bucket.
 * @param {Array} participations
 */
const genarateCsvFile = async (participations) => exportToCSV({
    data: participations, fields: participationExportCSVHeaders,
});
