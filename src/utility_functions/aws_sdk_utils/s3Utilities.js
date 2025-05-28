const { captureAWSv3Client } = require('aws-xray-sdk-core');
const {
    GetObjectCommand,
    HeadObjectCommand,
    DeleteObjectCommand,
    DeleteObjectsCommand,
    PutObjectCommand,
    ListObjectsCommand,
    PutBucketLifecycleConfigurationCommand,
    GetBucketLifecycleConfigurationCommand,
    ListObjectsV2Command,
    CreateMultipartUploadCommand,
    CompleteMultipartUploadCommand,
    AbortMultipartUploadCommand,
    UploadPartCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { Upload } = require('@aws-sdk/lib-storage');
const Messages = require('@the-coca-cola-company/ngps-global-common-messages');
const { createS3ClientManager } = require('../../awsSdkClientManager');
const {
    createErrorBody,
    createResponse,
    createErrBody,
    createResponseUnknownError,
} = require('../utilityFunctions');
const { getParametersFromSSM } = require('./ssmUtilities');
const { ERROR_CODES, ERR_CODES } = require('../../constants/errCodes');
const {
    RESPONSE_BAD_REQUEST,
    RESPONSE_NOT_FOUND,
    RESPONSE_OK,
} = require('../../constants/responses');

const CONF_FILE_NAME = 'conf.txt';
const s3ClientManager = createS3ClientManager();

/**
 * Tries to read file from s3 and return promise.resolve/reject.
 * @param readConfFileParams - conf file for S3.getObject that should be passed.
 */
const getFileFromS3 = async (getFileParams, rawBody) => {
    const S3 = captureAWSv3Client(s3ClientManager.getClient());
    try {
        console.log('Get file from S3:\n', JSON.stringify(getFileParams));
        const { readConfFileParams } = getFileParams;
        if (!readConfFileParams) {
            console.error('ERROR: Empty S3 read config file passed.');
            const errorBody = createErrorBody(ERROR_CODES.S3_READ_ERROR,
                'Error while reading file from bucket!');
            const response = createResponse(RESPONSE_BAD_REQUEST, errorBody);
            throw new Error(response);
        }
        console.log('Reading file', readConfFileParams.Key, 'from bucket', readConfFileParams.Bucket);
        const data = await S3.send(new GetObjectCommand(readConfFileParams));
        let requirements = rawBody ? Buffer.from(await data.Body.transformToByteArray()) : await data.Body?.transformToString();
        if (readConfFileParams.ResponseContentType === 'application/json') {
            console.log('Parsing data....');
            requirements = JSON.parse(requirements);
        }
        return requirements;
    } catch (error) {
        console.error('ERROR: Failed to read from S3 bucket:\n', JSON.stringify(error));
        const errorBody = createErrBody(ERR_CODES.NONEXISTENT_CONFIGURATION, getFileParams.ErrorMessage,
            undefined, ERROR_CODES.S3_READ_ERROR);
        const response = createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw response;
    }
};

/**
 * Tries to find the configuration file from s3 and return promise.resolve/reject.
 * @param getFileParams - parameters for S3.headObject that should be used.
 */
const searchConfigurationFileInS3 = async (getFileParams) => {
    const S3 = captureAWSv3Client(s3ClientManager.getClient());

    try {
        const { readConfFileParams } = getFileParams;
        console.log(`Searching for configuration with ${JSON.stringify(readConfFileParams)}...`);
        if (!readConfFileParams || !readConfFileParams.Bucket || !readConfFileParams.Key) {
            const errorBody = createErrorBody(ERROR_CODES.INVALID_PARAMETER, 'Invalid S3 search parameters passed!');
            const response = createResponse(RESPONSE_BAD_REQUEST, errorBody);
            throw new Error(response);
        }
        const data = await S3.send(new HeadObjectCommand(readConfFileParams));
        console.log('Configuration file has been found:\n', JSON.stringify(data));
        const response = createResponse(RESPONSE_OK, 'Configuration file found');
        return response;
    } catch (error) {
        if (error && error.statusCode === 404) {
            const errorBody = createErrorBody(ERROR_CODES.NOT_FOUND, `Configuration ${error.name}!`);
            const response = createResponse(RESPONSE_NOT_FOUND, errorBody);
            console.log(`The search failed with error message: Configuration ${error.name}!`);
            throw response;
        } if (error && error.statusCode !== 404) {
            const response = createResponseUnknownError();
            console.log(`The search failed with error message: ${error.name}`);
            throw response;
        }
    }
};

/**
 * Returns configuration formed from file on S3 bucket.
 * @param configurationId - configurationId for which config file is retrieved.
 * @param {String} responseType - the required responseContentType for {@link getFileFromS3}
 * if null then {@link searchConfigurationFileInS3} will be used.
 */
const createS3FileParams = async (configurationId, responseType) => {
    const fileName = `${configurationId}/${CONF_FILE_NAME}`;
    const getFileParams = {
        readConfFileParams: {
            Bucket: process.env.PRIVATE_BUCKET,
            Key: fileName,
        },
    };

    if (responseType) {
        getFileParams.readConfFileParams.ResponseContentType = responseType;
        getFileParams.ErrorMessage = Messages.COMMON_ERR.CONFIG_NOT_FOUND;
        return getFileFromS3(getFileParams);
    }

    return searchConfigurationFileInS3(getFileParams);
};

/**
 * Saves file to s3 and returns response
 * @param putParams - s3 PutObjectCommandInput
 */
const saveToS3 = async (putParams) => {
    console.log('Saving to S3...');
    const S3 = captureAWSv3Client(s3ClientManager.getClient());
    const putCommand = new PutObjectCommand(putParams);

    try {
        await S3.send(putCommand);
        console.log('File successfully saved to S3 bucket:\n', JSON.stringify(putParams?.Key));
        const response = createResponse(RESPONSE_OK, { fileSaved: true });
        return response;
    } catch (error) {
        console.error('ERROR: File not written to S3 bucket:\n', JSON.stringify(error));
        const errorBody = createErrorBody(ERROR_CODES.S3_WRITE_ERROR, 'Error writing file to s3');
        const errorResponse = createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errorResponse;
    }
};

/**
 * Saves the file to S3 using the upload function which returns the location of the file.
 */
const uploadToS3 = async (data, configurationId, fileName, bucket, valueToReturn, exactPath) => {
    try {
        const uploadParams = {
            Bucket: bucket,
            Key: exactPath ? fileName : `${configurationId}/${fileName}`,
            Body: data,
            ContentType: 'text/csv',
            ACL: bucket === process.env.PUBLIC_BUCKET ? 'public-read' : 'private',
        };

        const uploadOptions = {
            partSize: 50 * 1024 * 1024,
            queueSize: 2,
        };

        const uploadResult = await uploadFile(uploadParams, uploadOptions);
        return uploadResult[valueToReturn] ? uploadResult[valueToReturn] : uploadResult.Location;
    } catch (error) {
        console.error('ERROR: File not written to S3 bucket:\n', JSON.stringify(error));
        const errorBody = createErrorBody(ERROR_CODES.S3_WRITE_ERROR, 'Error writing file to s3');
        const response = createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw response;
    }
};

/**
 * Uploads file to s3
 * @param {*} fileParams - PutObjectCommandInput (Bod, Bucket, Key, ACL, etc.)
 * @param {*} options - Option object containing upload configuration params
 * @returns {Promise}
 */
const uploadFile = (fileParams, options = {}) => {
    const S3 = captureAWSv3Client(s3ClientManager.getClient());
    const upload = new Upload({
        client: S3,
        params: fileParams,
        ...options,
    });
    return upload.done();
};

/**
 * Delete files from s3 and returns response.
 * @param {Object} deleteParams - s3 DeleteObjectCommandInput
 */
const deleteFileFromS3 = async (deleteParams, multiple = false) => {
    console.log('Deleting from S3...');
    const S3 = captureAWSv3Client(s3ClientManager.getClient());
    try {
        const deleteCommand = multiple ? new DeleteObjectsCommand(deleteParams) : new DeleteObjectCommand(deleteParams);
        const data = await S3.send(deleteCommand);
        console.log('File successfully deleted from S3 bucket:\n', JSON.stringify(data));
        const response = createResponse(RESPONSE_OK, { fileDeleted: true });
        return response;
    } catch (error) {
        console.error('ERROR: File not deleted from S3 bucket:\n', JSON.stringify(error));
        const errorBody = createErrorBody(ERROR_CODES.S3_DELETE_ERROR, 'Error deleting file to s3');
        const errResponse = createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errResponse;
    }
};

/**
 * RList objects in s3 bucket.
 * @param {Object} params - ListObjectsCommandInput
 */

const listObjectsInS3 = async (params) => {
    console.log('Listing files from S3...');
    const S3 = captureAWSv3Client(s3ClientManager.getClient());
    try {
        const data = await S3.send(new ListObjectsCommand(params));
        console.log('Files successfully listed from S3 bucket:\n', JSON.stringify(data));
        const response = createResponse(RESPONSE_OK, { filesListed: JSON.stringify(data) });
        return response;
    } catch (error) {
        console.error('ERROR: Failed to list files from S3 bucket:\n', JSON.stringify(error));
        const errorBody = createErrorBody(ERROR_CODES.S3_LIST_OBJECTS_ERROR, 'Error listing files from s3');
        const errResponse = createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errResponse;
    }
};

/**
 * Replaces existing S3 bucket lifecycle configuration and return response.
 * @param {Object} lifecyclePutParams - s3 PutBucketLifecycleConfigurationInput
 */
const setS3BucketLifecycle = async (lifecyclePutParams) => {
    console.log('Setting lifecycle rules for S3 bucket:');
    const S3 = captureAWSv3Client(s3ClientManager.getClient());

    try {
        const command = new PutBucketLifecycleConfigurationCommand(lifecyclePutParams);
        await S3.send(command);
        const message = 'Successfully set lifecycle for S3 bucket.';
        const response = createResponse(RESPONSE_OK, message);
        return response;
    } catch (error) {
        console.error('ERROR: Failed to set lifecycle rules for S3 bucket:\n', JSON.stringify(error));
        const errorBody = createErrBody(ERR_CODES.S3_SET_LIFECYCLE_ERROR, 'Error setting S3 bucket lifecycle rules.', undefined, ERROR_CODES.S3_SET_LIFECYCLE_ERROR);
        const errResponse = createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errResponse;
    }
};

/**
 * Gets existing S3 bucket lifecycle configuration and return response.
 * @param {Object} lifecycleGetParams - s3 GetBucketLifecycleConfigurationInput
 */
const getS3BucketLifecycle = async (lifecycleGetParams) => {
    console.log('Getting S3 bucket lifecycle rules:');
    const S3 = captureAWSv3Client(s3ClientManager.getClient());

    try {
        const command = new GetBucketLifecycleConfigurationCommand(lifecycleGetParams);
        const data = await S3.send(command);
        const response = createResponse(RESPONSE_OK, data);
        return response;
    } catch (error) {
        if (error.name === 'NoSuchLifecycleConfiguration') {
            console.log('No lifecycle configuration found.');
            const response = createResponse(RESPONSE_OK, null);
            return response;
        }

        console.error('ERROR: Failed to get S3 bucket lifecycle rules :\n', JSON.stringify(error));

        const errorBody = createErrBody(ERR_CODES.S3_GET_LIFECYCLE_ERROR, 'ERROR: Failed to get S3 bucket lifecycle rules.', undefined, ERROR_CODES.S3_GET_LIFECYCLE_ERROR);
        const errResponse = createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errResponse;
    }
};

/**
 * Function for creating a signed URL for a given bucket with a lease time.
 * @param {String} filePath - The location of the file in S3.
 * @param {String} bucket - The name of the S3 bucket.
 * @param {Object} leaseTime - The time the url will be signed for in minutes, as default we set to 30Mins.
 * @returns {Promise}
 */
const createSignedURL = async (filePath, bucket, leaseTime = 30) => {
    try {
        const credentials = await getParametersFromSSM('secretKeyId', 'secretKey');
        const internalClientManager = createS3ClientManager();
        const s3Client = internalClientManager.getClient({
            credentials: {
                accessKeyId: credentials.secretKeyId,
                secretAccessKey: credentials.secretKey,
            },
            region: process.env.regionName,
        });

        const signedUrlExpireSeconds = 60 * leaseTime;

        const getObjectParams = {
            Bucket: bucket,
            Key: filePath,
        };
        const command = new GetObjectCommand(getObjectParams);
        return getSignedUrl(s3Client, command, { expiresIn: signedUrlExpireSeconds });
    } catch (error) {
        throw JSON.stringify(error.message);
    }
};

/**
 * List objects in s3 bucket using V2 option.
 * @param {Object} params - bucket name object
 * @returns - data of the resolved objects
 */
const listObjectsInS3V2 = async (params) => {
    console.log('Listing files from S3...');
    const S3 = captureAWSv3Client(s3ClientManager.getClient());
    const listCommand = new ListObjectsV2Command(params);
    try {
        const data = await S3.send(listCommand);
        return data;
    } catch (err) {
        console.error('ERROR: Failed to list objects :\n', err);
        throw err;
    }
};

/**
 * Get objects metadata from s3 bucket
 * @param {Object} headParams - s3 HeadObjectCommandInput
 * @returns {Promise}
 */

const checkIfS3ObjectExist = (headParams) => {
    const S3 = captureAWSv3Client(s3ClientManager.getClient());
    const command = new HeadObjectCommand(headParams);
    return S3.send(command);
};

/**
 * Creates S3 bucket url
 * @param {string} bucket - the bucket name
 * @param {string} filePath - file location
 * @param {string} region - s3 region
 * @returns {string} - s3 url
 */
const getS3ObjectUrl = (bucket, filePath, region) => `https://${bucket}.s3.${region || process.env.regionName}.amazonaws.com/${filePath}`;

const createMultiPartUpload = async (options) => {
    const S3 = s3ClientManager.getClient();
    const { UploadId } = await S3.send(new CreateMultipartUploadCommand(options));
    return UploadId;
};

const completeMultiPartUpload = (options) => {
    const S3 = s3ClientManager.getClient();
    return S3.send(new CompleteMultipartUploadCommand(options));
};

const uploadPart = (options) => {
    const S3 = s3ClientManager.getClient();
    return S3.send(new UploadPartCommand(options));
};

const abortMultiPartUpload = (options) => {
    const S3 = s3ClientManager.getClient();
    return S3.send(new AbortMultipartUploadCommand(options));
};

module.exports = {
    checkIfS3ObjectExist,
    getFileFromS3,
    searchConfigurationFileInS3,
    createS3FileParams,
    saveToS3,
    uploadToS3,
    uploadFile,
    getS3ObjectUrl,
    deleteFileFromS3,
    listObjectsInS3,
    setS3BucketLifecycle,
    getS3BucketLifecycle,
    createSignedURL,
    listObjectsInS3V2,
    createMultiPartUpload,
    completeMultiPartUpload,
    uploadPart,
    abortMultiPartUpload,
};
