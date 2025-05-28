const Moment = require('moment');
const Json2csv = require('json2csv').parse;
const ContentDisposition = require('content-disposition');
const { CONFIGURATION_FUNCTIONS_MAP } = require('../constants/lambdas');
const { prizeDrawPartExportCSVHeaders } = require('../constants/fileSchemas');
const { invokeLambda } = require('../utility_functions/aws_sdk_utils/lambdaUtilities');
const {
    saveToS3,
    uploadToS3,
    createMultiPartUpload,
    completeMultiPartUpload,
    uploadPart,
    abortMultiPartUpload,
    createSignedURL,
    getFileFromS3,
} = require('../utility_functions/aws_sdk_utils/s3Utilities');
const { exportToCSV, getExportDate } = require('../utility_functions/utilityFunctions');
const { queryByConfiguration } = require('../database/participationsDatabase');

/**
 * @param {*} startExecutionTime - The time when lambda started
 * @returns elapsed time in secods
 */
const getElapsedTime = (startExecutionTime) => {
    const currentTime = Date.now();
    const elapsedMills = currentTime - startExecutionTime;
    return elapsedMills / 1000;
};

/**
 * @param {*} configurationId - configuration id
 * @param {*} stateParams - params to pass to lambda event
 * @returns filePath and message for client
 */
const reinvokeLambaWithState = async (configurationId, stateParams) => {
    const invokeParams = { ...CONFIGURATION_FUNCTIONS_MAP.prizeDrawExporterLambda, InvocationType: 'Event' };
    await invokeLambda(invokeParams, { payloadSource: 'internal', configurationId, state: stateParams });
    console.log('Lambda invoked');
    return { filePath: stateParams.fileName, message: 'File is being processed. Please wait...' };
};

const customTransformer = (item) => {
    const updatedItem = { ...item };
    updatedItem.participation_time = Moment(parseInt(updatedItem.participation_time)).format('YYYY-MM-DD, h:mm:ss a');
    if (updatedItem.optional_information?.participation_image) {
        updatedItem.participation_image = updatedItem.optional_information.participation_image;
        delete updatedItem.optional_information;
    }
    return updatedItem;
};
/**
 * @param {*} data - dynamo db items data
 * @returns data in csv format and its size
 */
const getCsvPartAndSize = async (data, isFirstChunk) => {
    const csvPart = await exportToCSV({
        data,
        fields: prizeDrawPartExportCSVHeaders,
        delimiter: ';',
        transformer: [customTransformer],
        header: isFirstChunk,
    });
    const partBufferLenght = Buffer.byteLength(csvPart, 'utf8');
    return { csvPart, partBufferLenght };
};

/**
 * @param {*} configurationId - configuration id
 * @param {*} csv - data is csv format
 * @param {*} multipartUploadParts - array of Etags and part number
 * @param {*} fileName - path of file
 * @param {*} uploadId - s3 multipart upload id
 * @param {*} partNumber - multipart upload part number
 * @param {*} bucketName - bucket name
 * @returns filePath
 */
const completeUpload = async (configurationId,
    csv,
    multipartUploadParts,
    fileName,
    uploadId,
    partNumber,
    bucketName) => {
    if (csv !== '') {
        if (!multipartUploadParts.length) {
            console.log('Simple upload to s3');
            await abortMultiPartUpload({
                Bucket: bucketName,
                Key: fileName,
                UploadId: uploadId,
            });
            console.log('Multipart upload aborted');
            return uploadToS3(csv, configurationId, fileName, bucketName, 'Key', true);
        }
        console.log(`Uploading final part ${partNumber}`);
        const { ETag } = await uploadPart({
            Bucket: bucketName,
            Key: fileName,
            PartNumber: partNumber,
            UploadId: uploadId,
            Body: csv,
        });

        multipartUploadParts.push({ ETag, PartNumber: partNumber });
    }

    if (multipartUploadParts.length > 0) {
        const { Key } = await completeMultiPartUpload({
            Bucket: bucketName,
            Key: fileName,
            UploadId: uploadId,
            MultipartUpload: { Parts: multipartUploadParts },
        });
        console.log('Completed multipart upload', Key);
        return Key;
    }
};

/**
 * @param {*} param - undefined or object with state from lambda event
 * @returns initial uploadId, partNumer, partSize and exclusiveStartKey
 */
const initializeStateParams = ({
    uploadId, partNumber = 1, partSize = 0, exclusiveStartKey,
} = {}) => ({
    uploadId, partNumber, partSize, exclusiveStartKey,
});

/**
 * @param {*} params - object containin configurationId, fileName, bucketName, bufferSize, payloadSource, startExecutionTime, state
 * @returns filePath
 */
const dynamoDBToS3 = async (params) => {
    const {
        configurationId, fileName, bucketName, bufferSize, payloadSource, startExecutionTime, state,
    } = params;
    let previousPartLastEvaluatedKey;
    let lastPartUploaded = 0;
    let csv = '';
    let isFirstChunk = !state;
    let hasRecords = false;

    let {
        uploadId, partNumber, partSize, exclusiveStartKey,
    } = initializeStateParams(state);
    const multipartUploadParts = state?.multipartUploadParts || [];

    if (!state?.uploadId) {
        uploadId = await createMultiPartUpload({ Bucket: bucketName, Key: fileName });
    }

    try {
        do {
            const { dataReceived, nextKey } = await queryByConfiguration(configurationId, true, exclusiveStartKey);
            if (!dataReceived?.length) break;
            hasRecords = true;

            // Appsync hard typeout - 30 seconds - 2 seconds before that, return response and continue export
            if (payloadSource !== 'internal' && getElapsedTime(startExecutionTime) >= 28 && nextKey) {
                console.log('Not enough time to process, returning response to client...');
                return reinvokeLambaWithState(configurationId,
                    {
                        uploadId,
                        partNumber: lastPartUploaded + 1,
                        partSize: 0,
                        exclusiveStartKey: previousPartLastEvaluatedKey,
                        multipartUploadParts,
                        fileName,
                    });
            }

            const { csvPart, partBufferLenght } = await getCsvPartAndSize(dataReceived, isFirstChunk);
            partSize += partBufferLenght;
            csv += `${csvPart}\n`;
            isFirstChunk = false;

            if (partSize >= bufferSize && nextKey) {
                console.log(`Uploading partNumber: ${partNumber}`);
                const { ETag } = await uploadPart({
                    Bucket: bucketName,
                    Key: fileName,
                    PartNumber: partNumber,
                    UploadId: uploadId,
                    Body: csv,
                });

                multipartUploadParts.push({ ETag, PartNumber: partNumber });
                previousPartLastEvaluatedKey = exclusiveStartKey;
                lastPartUploaded = partNumber;
                partNumber++;
                partSize = 0;
                csv = '';
            }
            exclusiveStartKey = nextKey;
        } while (exclusiveStartKey);

        if (!hasRecords) {
            console.log('No participation records found.');
            return { customErrorMessage: 'No participation records found.' };
        }

        console.log('No more data to query, finalizing upload');

        const filePath = await completeUpload(configurationId,
            csv,
            multipartUploadParts,
            fileName,
            uploadId,
            partNumber,
            bucketName,
        );
        return { filePath };
    } catch (err) {
        console.error('ERROR: Multiupload failed with', err);
        return err;
    }
};
/**
 * @param {*} configurationId - configuration id
 * @param {*} payloadSource - source of event - internal or resolver
 * @param {*} state - state from lambda event
 * @param {*} startExecutionTime - start time of lambda execution
 * @returns signed csv url and optional message
 */
const processParticipationExport = async (configurationId, payloadSource, state, startExecutionTime) => {
    const bufferSize = 5 * 1024 * 1024;
    const bucketName = process.env.PRIVATE_BUCKET;
    const dateExportInfo = getExportDate();
    const fileName = state?.fileName || `analysis/prize_draw_participations/full/${dateExportInfo.exportDate}/${configurationId}_${dateExportInfo.dateMil}.csv`;
    const params = {
        configurationId, fileName, bucketName, bufferSize, payloadSource, startExecutionTime, state,
    };
    const { filePath, message, customErrorMessage } = await dynamoDBToS3(params);
    if (customErrorMessage) return { customErrorMessage };

    const signedPath = await createSignedURL(filePath, process.env.PRIVATE_BUCKET);
    return { csv: signedPath, message };
};

/**
 * Get array of configurationIds from S3 file.
 * The functionality is then exporting participations for each configurationId.
 */
const getPrizeDrawConfigIds = () => {
    const readFileParams = {
        ErrorMessage: 'prizeDrawExporter not configured',
        readConfFileParams: {
            Key: 'analysis/prize_draw_participations/lambdaConfig/prizeDrawExporterConfigs.json',
            Bucket: process.env.PRIVATE_BUCKET,
            ResponseContentType: 'application/json',
        },
    };
    return getFileFromS3(readFileParams);
};

/**
 * Generate csv header from json
 * @param jsonData
 */
const createCsvFile = (jsonData) => Object.keys(jsonData[0]).filter((key) => key !== 'configuration_id');

/**
 * Save exported db table
 * @param dbData - returned response from DB query
 * @param configId - configurationId used in the query
 * @param date - object with current date in string and milliseconds format
 */
const saveDataToS3 = (dbData, configId, date) => {
    console.log('Saving CSV to S3...');
    const csvHeader = createCsvFile(dbData);
    const csvFile = Json2csv(dbData, csvHeader);
    const filePath = `analysis/prize_draw_participations/${date.queryDateStr}/${configId}_${date.dateMil}.csv`;

    return saveToS3({
        Key: filePath,
        Body: csvFile,
        Bucket: process.env.PRIVATE_BUCKET,
        ContentType: 'application/octet-stream',
        ContentDisposition: ContentDisposition(filePath, {
            type: 'inline',
        }),
    });
};

/**
 * Runs query with each configurationId that needs to have its participations exported to s3
 * @param configurationIds - array of configurationIds
 */
const exportParticipations = async (configurationIds) => {
    const dataExportDate = getExportDate();
    const exportResult = { failedConfigIds: [], exportedConfigIds: [] };

    try {
        await Promise.all(configurationIds.map(async (configId) => {
            try {
                const result = await queryByConfiguration(configId);
                exportResult.exported = result;
                await saveDataToS3(result, configId, dataExportDate);
                console.log('Export for', configId, ' completed.');
                exportResult.exportedConfigIds.push(configId);
            } catch (err) {
                console.error('ERROR: Failed to export', configId, ' \n', JSON.stringify(err));
                exportResult.failedConfigIds.push(configId);
            }
        }));
        console.log('Exporting participations finished successfully.');
        console.log('Failed configIds participation exports:\n', JSON.stringify(exportResult.failedConfigIds));
        return exportResult;
    } catch (error) {
        console.error('ERROR: Failed to export DB tables:\n', JSON.stringify(error));
        throw error;
    }
};

module.exports = {
    customTransformer,
    processParticipationExport,
    getExportDate,
    exportParticipations,
    getPrizeDrawConfigIds,
};
