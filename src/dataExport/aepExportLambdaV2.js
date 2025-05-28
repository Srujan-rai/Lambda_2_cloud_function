const { captureAWSv3Client } = require('aws-xray-sdk-core');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const middy = require('@middy/core');
const { sendRecordToDataStream, filteredObject } = require('./aepExportUtilsV2');
const { fetchAepFilterSchema } = require('../middlewares/fetchAepFilterSchema');
const { createKinesisClientManager } = require('../awsSdkClientManager');

const kinesisClientManager = createKinesisClientManager();

const aepExportLambdaV2 = async (event) => {
    const kinesisClient = captureAWSv3Client(kinesisClientManager.getClient());
    const promises = [];
    (event.Records).forEach((record) => {
        const unmarshalledRecord = unmarshall(record.dynamodb.NewImage);
        const country = unmarshalledRecord.country && process.env.enableOuSegmentationForAep
            ? unmarshalledRecord.country
            : undefined;
        promises.push(sendRecordToDataStream(
            ((process.env.enableAepExportFiltering && event?.aepFilterSchema)
                ? filteredObject(Object.keys(event?.aepFilterSchema), unmarshalledRecord)
                : unmarshalledRecord),
            kinesisClient,
            country));
    });
    try {
        await Promise.all(promises);
    } catch (error) {
        console.log('Record export failed with', error);
    }
};

module.exports = {
    aepExportLambdaV2: middy(aepExportLambdaV2).use(fetchAepFilterSchema()),
};
