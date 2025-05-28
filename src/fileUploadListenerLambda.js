const Utils = require('@the-coca-cola-company/ngps-global-common-utils');
const axios = require('axios');
const uniqid = require('uniqid');
const { Readable } = require('stream');
const { pipeline } = require('node:stream/promises');
const csvtojson = require('csvtojson');
const ParticipationsDatabase = require('./database/participationsDatabase');
const prizeCatalogueTable = require('./database/prizeCatalogueTable');
const { writeBlockedToDynamoDB } = require('./database/blockedUsersTable');
const CryptoUtils = require('./utility_functions/cryptoUtils');
const {
    extractFileExtension,
    copyAsCamelCase,
    getExpirationTimestamp,
} = require('./utility_functions/utilityFunctions');
const {
    getFileFromS3,
    getS3ObjectUrl,
    saveToS3,
} = require('./utility_functions/aws_sdk_utils/s3Utilities');
const { getConfiguration } = require('./utility_functions/configUtilities');
const { getParametersFromSSM } = require('./utility_functions/aws_sdk_utils/ssmUtilities');
const { invokeLambda } = require('./utility_functions/aws_sdk_utils/lambdaUtilities');
const { rekognitionImage } = require('./utility_functions/aws_sdk_utils/rekognitionUtilities');
const UploadUtils = require('./utility_functions/fileUploadUtils');
const { handleReplicationUpload } = require('./replicationManagement/uploadReplication');
const { localizeInsertObject } = require('./utility_functions/localizationUtilities');
const { CONFIGURATION_FUNCTIONS_MAP: { configStoreLambda: CONFIG_STORE_INVOKE_PARAMS } } = require('./constants/lambdas');
const { RESPONSE_OK, RESPONSE_INTERNAL_ERROR } = require('./constants/responses');
const { ERROR_CODES: { UNKNOWN_ERROR } } = require('./constants/errCodes');

const WINNING_MOMENTS_CSV_FOLDER_NAME = 'winningMomentCSVs';
const BULK_UPLOAD_DIGITAL_CODES_FOLER_NAME = 'digitalCodesBulkUpload';
const REPLICATION_PACKAGE_FOLDER_NAME = 'replications';
const PRIZES_CSV_FOLDER_NAME = 'bulkPrizesCSVs';
const UPDATE_PRIZES_CSV_FOLDER_NAME = 'bulkPrizesUpdateCSVs';
const UPLOAD_VOUCHERS_CSV_FOLDER_NAME = 'voucherCSVs';
const FRAUD_USERS = 'fraudUsers';
/**
 * Listens for file uploads in s3.
 * 1. It listens to public bucket for user img uploads
 * 2. It listens to gpp-private-bucket-stage for csv digital code files uploads.
 * @param event - data that we receive from request
 *
 * NOTE: after sls deploy --yourStage, 'sls s3deploy --stage yourStage' should be executed for this to work.
 */

module.exports.fileUploadListenerLambda = async (event, context) => {
    // TODO split this function into lambdas that are going to handle only one type of upload.
    try {
        console.log('Received event:\n', JSON.stringify(event));

        const bucketName = event.Records[0].s3.bucket.name;
        const fileName = event.Records[0].s3.object.key;
        const fileExtension = extractFileExtension(fileName);
        const keyParts = fileName.split('/');

        console.log('File extension is', fileExtension);
        if (bucketName === process.env.PRIVATE_BUCKET) {
            if ((fileExtension === 'csv' || fileExtension === 'json') && keyParts.includes(BULK_UPLOAD_DIGITAL_CODES_FOLER_NAME)) {
                console.log('Uploading bulkUploadDigitalCodes...');
            } else if (fileExtension === 'csv' && keyParts.includes(WINNING_MOMENTS_CSV_FOLDER_NAME)) {
                await handleWinningMomentsCsvUpload(event);
            } else if (fileExtension === 'csv' && keyParts.includes(PRIZES_CSV_FOLDER_NAME)) {
                await handleBulkPrizeCsvUpload(event);
            } else if (fileExtension === 'csv' && keyParts.includes(UPDATE_PRIZES_CSV_FOLDER_NAME)) {
                await handleBulkPrizeUpdateCsvUpload(event);
            } else if (fileExtension === 'csv' && UPLOAD_VOUCHERS_CSV_FOLDER_NAME) {
                await handleVouchersCsvUpload(event, context);
            } else if (fileExtension === 'zip' && keyParts.includes(REPLICATION_PACKAGE_FOLDER_NAME)) {
                await handleReplicationUpload(event);
            } else {
                console.error('ERROR: File extension not supported.');
            }
        } else if (bucketName === process.env.USER_DATA_BUCKET) {
            if (fileExtension === 'csv' && keyParts.includes(FRAUD_USERS)) {
                await handleFraudDetectionCsvUpload(fileName);
            } else {
                await handleImageUpload(event, context);
            }
        } else {
            console.error('ERROR: Unknown public bucket upload.');
        }

        return Utils.UTILITY_FUNCTIONS.createResponse(RESPONSE_OK, { uploaded: true });
    } catch (err) {
        console.error(err);
        return Utils.UTILITY_FUNCTIONS.createResponse(
            RESPONSE_INTERNAL_ERROR,
            Utils.UTILITY_FUNCTIONS.createErrBody(UNKNOWN_ERROR, err.errorMessage),
            { uploaded: false },
        );
    }
};

/**
 * Get uploaded img path and via it extracts
 * the configurationId, userId, userIdType
 * Then uses that data to -> query the users table -> create email params ->invoke email lambda
 * @param event - event that invoked the fileUploadListenerLambda
 */
const handleImageUpload = async (event, context) => {
    const filePath = decodeURIComponent(event.Records[0].s3.object.key);
    const bucketName = decodeURIComponent(event.Records[0].s3.bucket.name);
    const split = filePath.split('/');
    const configurationId = split[2];
    const userIdType = split[3];
    const userId = split[4];
    const params = {};
    const { cryptKey } = await getParametersFromSSM('cryptKey');
    const enctyptedEntryId = CryptoUtils.encryptText(`${configurationId}/${filePath}`, cryptKey);
    const config = await getConfiguration(configurationId, event);
    const expiryTimestamp = getExpirationTimestamp(config);
    params.configurationId = configurationId;
    params.entry = filePath;
    params.entryType = 'image';
    params.userId = userId;
    params.userIdType = userIdType;
    params.encryptedEntryId = enctyptedEntryId;
    params.end_of_conf = expiryTimestamp;

    await handleRekognition(bucketName, filePath);

    await ParticipationsDatabase.putEntry(`${userId}|${userIdType}`, context.awsRequestId, params);
};

const handleRekognition = async (bucketName, filePath) => {
    try {
        const response = await rekognitionImage(bucketName, filePath, 70);
        const labels = response.ModerationLabels;

        if (labels?.length > 0) {
            console.log(`Inappropriate image detected in file: ${filePath} (bucket: ${bucketName}) | Moderation Labels: ${JSON.stringify(labels)}`);
        }
    } catch (error) {
        console.error(`Error in handleRekognition for file: ${filePath} (bucket: ${bucketName})`, error);
    }
};

/**
 * Extract csv file's data
 * and then parse it into json objects
 * - CSV parse documentation -> https://www.npmjs.com/package/csvtojson
 * @param event - Lambda trigger event
 */
const handleVouchersCsvUpload = async (event, context) => {
    const filePath = decodeURIComponent(event.Records[0].s3.object.key);
    const split = filePath.split('/');
    const configurationId = split[0];
    const prizeId = split[2];
    const csvParams = getCsvParams(event, filePath);
    const expectedHeader = Utils.COMMON.EXPECTED_VOUCHERS_CSV_HEADER;
    const entries = await Utils.UTILITY_FUNCTIONS.extractCsvEntries(csvParams, expectedHeader, false, true, getFileFromS3);

    await UploadUtils.sendCodesToSQS(entries, configurationId, prizeId, context);
};

/**
 * Extract csv file's data
 * and then parse it into json objects
 * - CSV parse documentation -> https://www.npmjs.com/package/csvtojson
 * @param event - Lambda trigger event
 */
const handleWinningMomentsCsvUpload = async (event) => {
    const filePath = decodeURIComponent(event.Records[0].s3.object.key);
    const split = filePath.split('/');
    const configurationId = split[0];
    const csvParams = getCsvParams(event, filePath);
    const wmExpiraiton = ['gmtStart', 'prizeId', 'tier', 'status', 'endDate'];
    const wmNoExpiration = ['gmtStart', 'prizeId', 'tier', 'status'];

    const wmExpired = await Utils.UTILITY_FUNCTIONS.extractCsvEntries(csvParams, wmExpiraiton, false, true, getFileFromS3, true);

    const expectedHeader = wmExpired ? wmExpiraiton : wmNoExpiration;
    const entries = await Utils.UTILITY_FUNCTIONS.extractCsvEntries(csvParams, expectedHeader, false, true, getFileFromS3);

    await UploadUtils.sendMomentsToSQS(entries, configurationId);
};

/**
 * Get CSV file parameters
 * @param event - Lambda trigger event
 * @param filePath - csv file path
 */
const getCsvParams = (event, filePath) => ({
    readConfFileParams: {
        Bucket: event.Records[0].s3.bucket.name,
        Key: filePath,
        ResponseContentType: 'text/csv',
    },
    ErrorMessage: 'Error while reading file from bucket!',
});

/**
 * if the 'winningLimits' property is presented in the csv and contains some value
 * it will be added into every configuration flow
 * @param {Object} config configuration object
 * @param {Object} winningLimits winning limits object
 * @returns {Object} The ConfigStoreLambda response
 */
const updateWinningLimitsForConfig = async (config, winningLimits) => {
    /* This will add the 'winningLimits' object to every flow
    Otherwise, we have to pass the flow in the csv file which could cause more misunderstanding among the clients */
    const limits = Object.keys(config.flow);

    if (!limits.length) {
        console.log('No winningLimits presented, skipping configuration update');
        return;
    }

    limits.forEach((currFlow) => {
        config.flow[currFlow].winningLimits = {
            ...config.flow[currFlow].winningLimits,
            ...winningLimits,
        };
    });

    await invokeLambda(CONFIG_STORE_INVOKE_PARAMS, {
        body: JSON.stringify({
            configuration: config,
            configurationId: config.configurationId,
            promotionId: config.promotionId,
            isEdit: true,
        }),
    });
};

/**
 * Extract csv file's data
 * and then add prizes to DB
 * @param event - Lambda trigger event
 */
const handleBulkPrizeCsvUpload = async (event) => {
    const filePath = decodeURIComponent(event.Records[0].s3.object.key);
    const csvParams = getCsvParams(event, filePath);
    const split = filePath.split('/');
    const configurationId = split[1];
    const expectedHeaderIW = Utils.COMMON.EXPECTED_IW_PRIZES_CSV_HEADER;
    const expectedHeaderCandG = Utils.COMMON.EXPECTED_CG_PRIZES_CSV_HEADER;

    const iwPrizes = await Utils.UTILITY_FUNCTIONS.extractCsvEntries(csvParams, expectedHeaderIW, false, true, getFileFromS3, true);
    const expectedHeader = iwPrizes ? expectedHeaderIW : expectedHeaderCandG;
    const entries = await Utils.UTILITY_FUNCTIONS.extractCsvEntries(csvParams, expectedHeader, true, true, getFileFromS3);
    const config = await getFileFromS3({
        readConfFileParams: {
            Bucket: process.env.PRIVATE_BUCKET,
            Key: `${configurationId}/conf.txt`,
            ResponseContentType: 'application/json',
        },
        ErrorMessage: 'Error while reading file from bucket!',
    });
    const expirationTime = getExpirationTimestamp(config);
    const entriesForInsert = [];
    let defaultLangExists = false;
    const promises = [];

    entries.forEach((entry) => {
        const checked = Utils.UTILITY_FUNCTIONS.checkRequiredPrizeParams(Object.keys(entry), entry, config);
        if (checked) { defaultLangExists = checked; }

        if (entry.tags && typeof entry.tags === 'string' && !Array.isArray(entry.tags)) {
            entry.tags = entry.tags.split(',');
        }
        // If we do not have voucher distribution, but the validity period has a value, reset it
        if (entry.validityPeriodAfterClaim && !entry.voucherDist) {
            entry.validityPeriodAfterClaim = undefined;
        }

        entry.prizeId = uniqid();
        entry.expTime = expirationTime;
        return promises.push(handleImgUrls(entry, configurationId));
    });

    const updatedEntries = await Promise.allSettled(promises);
    updatedEntries.forEach((entry) => {
        if (entry.status !== 'fulfilled') {
            console.error('Prize entry failed with:', entry.reason);
            return;
        }
        const { value } = entry;
        const {
            amount, currencyId, language, ...rest
        } = value;

        if (currencyId) {
            rest.cost = [{
                amount: amount || 0,
                currencyId,
            }];
        }

        const convertedEntry = { ...localizeInsertObject(language, rest), configurationId };

        entriesForInsert.push(convertedEntry);
    });

    if (!defaultLangExists) {
        throw new Error('The file you uploaded cannot be processed. The default language set for this configuration is missing for at least one prize');
    }

    const winningLimits = {};

    const results = await Promise.allSettled(entriesForInsert.map((entry) => prizeCatalogueTable.putEntry(entry)));
    results.forEach((result) => {
        if (result.status !== 'fulfilled') {
            console.error('A request failed with', result.body);
            return;
        }
        const { entry } = JSON.parse(result.value.body);

        if (entry.winningLimit) {
            winningLimits[entry.prizeId] = entry.winningLimit;
        }
    });

    await updateWinningLimitsForConfig(config, winningLimits, event);
};

const handleImgUrls = async (entry, configId) => {
    const { imgUrl, language, prizeId } = entry;

    if (!imgUrl) {
        throw new Error(`Prize entry with ${prizeId} and ${entry.name} has no images`);
    }

    let externalImgUrls = imgUrl.split('|');
    if (externalImgUrls.length > 5) {
        console.log(`Prize entry with ${prizeId} and ${entry.name} has more than 5 image urls. Processing only the first 5...`);
        externalImgUrls = externalImgUrls.slice(0, 5);
    }
    const promises = [];
    externalImgUrls.forEach((url) => {
        promises.push(extractAndSaveImg(url, language, configId, prizeId));
    });
    const ngpsUrls = await Promise.allSettled(promises);
    const metadata = [];
    let priority = 1;
    const name = '';
    entry.imgUrl = ngpsUrls.map((url) => {
        metadata.push({
            priority,
            size: 'medium',
            url: url.value,
            activeStatus: 'false',
            ratio: 'vertical',
            name,
        });
        priority++;
        return url.value;
    });
    entry.image_metadata = { [language]: metadata };
    return entry;
};

const extractAndSaveImg = async (imgUrl, language, configId, prizeId) => {
    const response = await axios.get(imgUrl, { responseType: 'arraybuffer' });
    if (response.data) {
        const fileName = imgUrl.substring(imgUrl.lastIndexOf('/') + 1);
        const fileKey = `prizeImages/${configId}/${prizeId}/${language}/${fileName}`;
        await saveToS3({
            Bucket: process.env.PUBLIC_BUCKET,
            Key: fileKey,
            Body: response.data,
            ACL: 'private',
        });
        const url = (process.env.cloudFrontPublicUri && process.env.cloudFrontPublicUri !== 'undefined') ? `${process.env.cloudFrontPublicUri}/${fileKey}`
            : getS3ObjectUrl(process.env.PUBLIC_BUCKET, fileKey, process.env.regionName);
        return url;
    }
};
/**
 * Extract csv file's data
 * and then update prizes in DB
 * @param event - Lambda trigger event
 */
const handleBulkPrizeUpdateCsvUpload = async (event) => {
    const filePath = decodeURIComponent(event.Records[0].s3.object.key);
    const csvParams = getCsvParams(event, filePath);
    const split = filePath.split('/');
    const configurationId = split[1];
    const expectedHeader = ['prizeId', 'language', 'name', 'shortDesc', 'desc', 'redeemDesc'];
    const entries = await Utils.UTILITY_FUNCTIONS.extractCsvEntries(csvParams, expectedHeader, true, true, getFileFromS3);
    const updatedEntries = {};
    const promises = [];
    // eslint-disable-next-line no-restricted-syntax
    for await (let entry of entries) {
        if (!entry.language || !entry.prizeId) {
            console.error('missing name or prize_id');
            throw new Error('The file you uploaded cannot be processed. The template is wrong');
        }
        const locale = entry.language;
        entry = localizeInsertObject(locale, entry);
        let alreadyInserted = updatedEntries[entry.prizeId]
            ? updatedEntries[entry.prizeId]
            : (await prizeCatalogueTable.get(configurationId, entry.prizeId))[0];

        alreadyInserted = {
            ...alreadyInserted,
            desc: { ...alreadyInserted.desc, ...entry.desc },
            short_desc: { ...alreadyInserted.short_desc, ...entry.shortDesc },
            redeem_desc: { ...alreadyInserted.redeem_desc, ...entry.redeemDesc },
            name: { ...alreadyInserted.name, ...entry.name },
        };
        updatedEntries[entry.prizeId] = { ...alreadyInserted };
    }
    Object.values(updatedEntries).forEach((entry) => {
        const camelEntry = copyAsCamelCase(entry);
        promises.push(() => prizeCatalogueTable.putEntry({ ...camelEntry, configurationId }));
    });

    const results = await Promise.allSettled(promises.map((func) => func()));
    results.forEach((result) => {
        if (result.status !== 'fulfilled') {
            console.error('A request failed with', result.reason.body);
        }
    });
};

const handleFraudDetectionCsvUpload = async (fileName) => {
    try {
        const filePath = decodeURIComponent(fileName);
        const data = await getFileFromS3({
            readConfFileParams: {
                Bucket: process.env.USER_DATA_BUCKET,
                Key: filePath,
                ResponseContentType: 'text/csv',
            },
            ErrorMessage: 'Error while reading file from bucket!',
        }, true);
        const records = await parseCSV(data);
        const titleForBlocking = 'Fraud detected';
        const reasonForBlocking = 'Suspicious participation';
        await writeBlockedToDynamoDB(records, reasonForBlocking, titleForBlocking);
        console.log('Fraud users have been successfully blocked');
    } catch (error) {
        console.error(error);
        throw error;
    }
};

const parseCSV = async (data) => {
    const records = [];
    const stream = Readable.from(data);

    await pipeline(
        stream,
        csvtojson(),
        async (source) => new Promise((resolve, reject) => {
            source.on('data', (user) => {
                const { _cocacola_Identities_hashedKocid: hashedKocid } = JSON.parse(user);
                records.push(hashedKocid);
            });
            source.on('end', () => {
                resolve();
            });
            source.on('error', (err) => {
                reject(err);
            });
        }),
    )
        .catch((err) => {
            console.error(err);
        });

    return records;
};
