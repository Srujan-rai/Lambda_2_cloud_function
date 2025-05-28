const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { createClient } = require('@middy/util');
const { processCache } = require('./utils');

const { enableAepExportFiltering } = process.env;

const defaults = {
    AwsClient: S3Client,
    awsClientAssumeRole: undefined,
    awsClientCapture: undefined,
    awsClientOptions: {},
    cacheExpiry: 180000,
};

const fetchAepFilterSchema = (opts = {}) => {
    const options = { ...defaults, ...opts };

    let client = null;

    const fetch = async (stageName) => {
        const getObjectParams = {
            Bucket: `aep-v2-filterschema-bucket-${stageName}`,
            Key: 'filterschema.json',
        };
        try {
            const res = await client.send(new GetObjectCommand(getObjectParams));
            const str = await res.Body?.transformToString();
            return JSON.parse(str);
        } catch (e) {
            console.log('Please check whether the filterschema.json is present in the folder. Fetching filter schema failed with', e);
        }
    };

    const fetchAepFilterSchemaBefore = async (request) => {
        if (enableAepExportFiltering === 'false') {
            return;
        }
        if (request.event.warmer) {
            console.log('Lambda warmer event');
            return Promise.resolve();
        }

        if (!client) { client = await createClient(options, request); }

        try {
            const newOptions = { ...options, cacheKey: 'aepFilterSchema' };
            const { value } = await processCache(newOptions, fetch, process.env.stageName);
            const fetchedAepFilterSchema = value;
            request.event.aepFilterSchema = await fetchedAepFilterSchema;
        } catch (err) {
            console.error('ERROR: Failed to fetch filter schema!', JSON.stringify(err));
        }
    };

    return { before: fetchAepFilterSchemaBefore };
};

module.exports = {
    fetchAepFilterSchema,
};
