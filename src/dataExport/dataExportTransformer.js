const { unmarshall } = require('@aws-sdk/util-dynamodb');
const CryptoJS = require('crypto-js');
const bluebird = require('bluebird');
const moment = require('moment');
const { COMMON } = require('@the-coca-cola-company/ngps-global-common-utils');
const { getFileFromS3, saveToS3 } = require('../utility_functions/aws_sdk_utils/s3Utilities');

const OU_MAPPING = require('../constants/ouMapping.json');
const FOLDER_NAMES = require('../constants/folderNames.json');

const HASHED_UUID_REGEX = /^[a-fA-F0-9]{64}$/;

const getOuByCountry = (mapping, country) => Object.keys(mapping).find((key) => mapping[key].includes(country));

/**
 * Retrieves the country name corresponding to a given ISO Alpha-2 country code.
 * @param {string} country - The ISO Alpha-2 country code. For example: 'GR' for Greece.
 * @returns {string} - The country name if the ISO code exists in COMMON.COUNTRY_LIST;
 *                     otherwise, returns the input country code.
 * @example
 * // Assuming COMMON.COUNTRY_LIST contains { 'GR': 'Greece', 'US': 'United States' }
 * getCountryNameByIso('GR');  // Returns 'Greece'
 *
 * @example
 * // If the country code is not in COMMON.COUNTRY_LIST
 * getCountryNameByIso('XX');  // Returns 'XX'
 */
const getCountryNameByIso = (country) => (COMMON.COUNTRY_LIST[country] ? COMMON.COUNTRY_LIST[country] : country);

const getCountry = async (newImageUnmarshalled) => {
    if (newImageUnmarshalled?.country) {
        return getCountryNameByIso(newImageUnmarshalled.country);
    }
    if (newImageUnmarshalled?.promotion_market) {
        return getCountryNameByIso(newImageUnmarshalled.promotion_market[0]);
    }

    const configParams = {
        readConfFileParams: {
            Bucket: `${process.env.PRIVATE_BUCKET}`,
            Key: `${newImageUnmarshalled?.configuration_id}/conf.txt`,
            ResponseContentType: 'application/json',
        },
    };

    try {
        const configurationJSON = await getFileFromS3(configParams);
        return getCountryNameByIso(
            configurationJSON.configurationParameters?.country,
        );
    } catch (error) {
        console.log('Fetching configuration failed with', error);
    }
};

const fetchTableName = (firstRecord) => {
    const decodedFirstRecord = JSON.parse(
        Buffer.from(firstRecord, 'base64').toString('utf-8'),
    );

    const shardTableName = JSON.parse(
        Buffer.from(decodedFirstRecord.data, 'base64').toString('utf-8'),
    ).tableName;

    return FOLDER_NAMES[Object.keys(FOLDER_NAMES).reduce((accumulator, currentValue) => (shardTableName.includes(currentValue) ? currentValue + accumulator : accumulator), '')];
};

const createS3Params = (inputTableName, currentOU, inputSegmentedData) => {
    const date = moment();
    const month = date.format('MM');
    const day = date.format('DD');
    const hour = date.format('HH');
    const year = date.format('YYYY');
    const timestamp = date.valueOf();

    const objectPath = `dataExporter/${inputTableName}/${currentOU
    }/${year}/${month}/${day}/${hour}/${process.env.apiName}-${process.env.stageName
    }-${inputTableName}-${year}-${month}-${day}-${hour}-${timestamp}`;

    return {
        Body: inputSegmentedData[currentOU],
        Bucket: process.env.PRIVATE_BUCKET,
        Key: objectPath,
    };
};

const saveOUSegments = async (params) => {
    try { await saveToS3(params); } catch (error) {
        console.log('Unable to save OU files to S3 due to', error);
    }
};

const handler = async (event) => {
    const recordsCount = event.records.length;
    const base64EmptyString = 'Jyc=';
    const segmentedData = {};
    const tableName = fetchTableName(event.records[0].data);

    const processRecord = async (record, idx) => {
        try {
            const decodedRecord = JSON.parse(
                Buffer.from(record.data, 'base64').toString('utf-8'),
            );
            const decodedData = JSON.parse(Buffer.from(decodedRecord.data, 'base64').toString('utf-8'));

            const newImageUnmarshalled = unmarshall(
                decodedData.dynamodb.NewImage,
            );

            console.log(`Processing record ${idx + 1} of ${recordsCount}:`);

            const recordCountry = await getCountry(newImageUnmarshalled);

            const currentOU = getOuByCountry(OU_MAPPING, recordCountry);
            if (!currentOU) {
                console.log(`Couldn't get OU by country!
                    \nCountry: ${recordCountry}
                    \n configuration_id: ${newImageUnmarshalled.configuration_id}`);
            }

            const validatedRecord = checkRecordForUserId(
                newImageUnmarshalled,
                currentOU,
            );

            segmentedData[currentOU] = segmentedData[currentOU] || '';
            segmentedData[currentOU] += `${JSON.stringify(validatedRecord)}\n`;

            return {
                result: 'Ok',
                recordId: record.recordId,
                data: Buffer.from(JSON.stringify(validatedRecord)).toString('base64'),
            };
        } catch (err) {
            console.error('ERROR:', err);
            return { result: 'Dropped', recordId: record.recordId, data: base64EmptyString };
        }
    };

    const output = await bluebird.map(
        event.records, (record, idx) => processRecord(record, idx), { concurrency: 15 },
    );

    const ous = Object.keys(segmentedData);
    for (let i = 0; i < ous.length; i++) {
        const s3Params = createS3Params(tableName, ous[i], segmentedData);
        await saveOUSegments(s3Params);
    }

    console.log(`Processing completed.  Successful records ${output.length}.`);

    return Promise.resolve({ records: output });
};

const checkRecordForUserId = (record, currentOU) => {
    if (!record.gpp_user_id && !record.inserted_transactions?.length) return record;

    const { gpp_user_id, inserted_transactions } = record;
    const shouldHash = currentOU !== 'northamerica-ou';
    const userID = shouldHash ? hashUserId(gpp_user_id) : gpp_user_id;

    const transformTransactions = (transactions) => transactions.map((transaction) => {
        let transactionUserId;
        if (transaction.gpp_user_id === gpp_user_id) {
            transactionUserId = userID;
        } else {
            transactionUserId = shouldHash ? hashUserId(transaction.gpp_user_id) : transaction.gpp_user_id;
        }
        return {
            ...transaction,
            gpp_user_id: transactionUserId,
        };
    });

    return {
        ...record,
        gpp_user_id: userID,
        inserted_transactions: inserted_transactions?.length ? transformTransactions(inserted_transactions) : undefined,
    };
};

const hashUserId = (gppUserID) => {
    if (!gppUserID) return gppUserID;
    const [userId] = gppUserID.split('|');

    return userId.match(HASHED_UUID_REGEX)
        ? userId
        : CryptoJS.SHA256(userId).toString();
};

module.exports = {
    handler,
    checkRecordForUserId,
};
