const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { createClient } = require('@middy/util');
const { COMMON_ERR: { CONFIG_NOT_FOUND } } = require('@the-coca-cola-company/ngps-global-common-messages');
const { createErrBody, createResponse } = require('../utility_functions/utilityFunctions');
const { processCache } = require('./utils');
const { ERROR_CODES, ERR_CODES } = require('../constants/errCodes');
const { RESPONSE_BAD_REQUEST } = require('../constants/responses');
const { putConfigurationIntoCache } = require('../utility_functions/eventUtilities');

const cacheExpiry = process.env.stageName !== 'localTesting' ? parseInt(process.env.CACHE_EXPIRY || 600000) : -1;
const bucketName = process.env.PRIVATE_BUCKET;

const defaults = {
    AwsClient: S3Client,
    awsClientAssumeRole: undefined,
    awsClientCapture: undefined,
    awsClientOptions: {},
    cacheExpiry,
};

const getObjectKey = ({ body, queryStringParameters }) => {
    const configurationId = body?.configurationId || queryStringParameters?.configurationId;
    return `${configurationId}/conf.txt`;
};

const fetchS3Config = (opts = {}) => {
    const options = { ...defaults, ...opts };

    let client = null;

    const fetch = async (objectKey) => {
        const params = { Bucket: bucketName, Key: objectKey };
        const res = await client.send(new GetObjectCommand(params));
        const str = await res.Body?.transformToString();
        return JSON.parse(str);
    };

    const fetchS3ConfigBefore = async (request) => {
        if (request.event.warmer) {
            console.log('Lambda warmer event');
            return Promise.resolve();
        }

        if (!client) { client = await createClient(options, request); }

        const objectKey = getObjectKey(request.event);
        console.debug(`Configuration key: ${objectKey}`);

        try {
            const newOptions = { ...options, cacheKey: objectKey };
            const { value } = processCache(newOptions, fetch, objectKey);
            const s3ClientConfig = await value;

            putConfigurationIntoCache(request.event, s3ClientConfig);
        } catch (err) {
            console.error('ERROR: Failed to read from S3 bucket:\n', JSON.stringify(err));

            const errorBody = createErrBody(ERR_CODES.NONEXISTENT_CONFIGURATION, CONFIG_NOT_FOUND,
                undefined, ERROR_CODES.S3_READ_ERROR);
            return createResponse(RESPONSE_BAD_REQUEST, errorBody);
        }
    };

    return { before: fetchS3ConfigBefore };
};

module.exports = {
    fetchS3Config,
};
