const { unmarshall } = require('@aws-sdk/util-dynamodb');

module.exports.transform = async (event) => {
    const output = event.records.reduce((acc, record) => {
        const decodedRecord = JSON.parse(Buffer.from(record.data, 'base64').toString('utf-8'));
        const res = {
            recordId: record.recordId,
            result: 'Ok',
        };
        const decodedData = JSON.parse(Buffer.from(decodedRecord.data, 'base64').toString('utf-8'));
        const dataRecord = unmarshall(decodedData.dynamodb.OldImage);
        res.data = Buffer.from(`${JSON.stringify(dataRecord)}\n`, 'utf-8').toString('base64');
        acc.push(res);

        return acc;
    }, []);

    console.log(`Processing completed.  Successful records ${output.length}.`);

    return { records: output };
};
