const { PutRecordsCommand } = require('@aws-sdk/client-kinesis');
const { Buffer } = require('node:buffer');
const { getRegionByCountry } = require('@the-coca-cola-company/cds-constant-utils');

const filteredObject = (schemaKeys, unmarshalledRecord) => {
    const filteredTempObject = {};
    schemaKeys.forEach((key) => {
        if (Object.hasOwn(unmarshalledRecord, key)) {
            filteredTempObject[key] = unmarshalledRecord[key];
        }
    });
    return filteredTempObject;
};

const sendRecordToDataStream = async (recordInput, inputClient, country) => {
    const recordBlob = Buffer.from(JSON.stringify(recordInput), {
        type: 'text/csv',
    });
    const input = {
        Records: [
            {
                Data: recordBlob,
                PartitionKey: 'defaultShardPartition',
            },
        ],
        StreamARN:
            country
                ? `arn:aws:kinesis:${process.env.regionName}:${process.env.accountId}:stream/${process.env.apiName}-${process.env.stageName}-aepExportDataStream-${getRegionByCountry(country)}`
                : `arn:aws:kinesis:${process.env.regionName}:${process.env.accountId}:stream/${process.env.apiName}-${process.env.stageName}-aepExportDataStream`,
    };
    try {
        const command = new PutRecordsCommand(input);
        return inputClient.send(command);
    } catch (e) {
        console.log('Putting record into Kinesis data stream failed with', e);
    }
};

module.exports = {
    sendRecordToDataStream,
    filteredObject,
};
