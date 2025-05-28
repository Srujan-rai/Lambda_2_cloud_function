const ContentDisposition = require('content-disposition');
const { createResponse, createErrorBody } = require('../utility_functions/utilityFunctions');
const { getFileFromS3, listObjectsInS3V2, saveToS3 } = require('../utility_functions/aws_sdk_utils/s3Utilities');
const { getConfiguration } = require('../utility_functions/configUtilities');
const { queryPromotionTable } = require('../database/promotionsTable');
const { RESPONSE_OK, RESPONSE_INTERNAL_ERROR } = require('../constants/responses');
const { ERR_CODES: { UNKNOWN_REASON } } = require('../constants/errCodes');
const { publishToSnsTopic } = require('../utility_functions/aws_sdk_utils/snsUtilities');

// deprecated path to archive configuration metadata: 'analysis/configuration_meta_data.json';
const METADATA_S3_FOLDER = 'metadata/configurations.json';

const metadataObjectSchema = [
    'configuration_id',
    'user_id_type',
    'language',
    'country',
    'name',
    'promoVariation',
    'promo_id',
    'promo_name',
    'start_date',
    'end_date',
    'promotion_fullName',
];

const configParamMappings = {
    userIdType: 'user_id_type',
    emailTemplateId: 'email_template_id',
    language: 'language',
    country: 'country',
    configurationSubMechanic: 'promoVariation',
    currencies: 'currencies',
};

const promoMappings = {
    promo_type: 'promo_type',
    promotion_name: 'promo_name',
    promotion_fullName: 'promotion_fullName',
    promotion_start_utc: 'start_date',
    promotion_end_utc: 'end_date',
};

/**
 * Lambda which will be executed daily, and combine data from s3 and dynamodb in order to create a json file, with all
 * the metadata that our content team needs. It will also inform them via email about newly created or modified objects
 * that have missing params.
 */
module.exports.configurationMetadataExporterLambda = async () => {
    try {
        const s3data = await getS3BucketsData({ Bucket: process.env.PRIVATE_BUCKET });
        let alreadySavedConfigs;
        let dataToSave;
        let yesterdayCreatedConfigs;
        const metadataJsonExists = s3data.find((object) => object.Key === METADATA_S3_FOLDER);
        if (metadataJsonExists) {
            alreadySavedConfigs = await getAlreadySavedConfigs();
            yesterdayCreatedConfigs = getYesterdayConfigs(s3data);
            if (!yesterdayCreatedConfigs) {
                const response = createResponse(RESPONSE_OK, {});
                return response;
            }
            const { configurations: newConfigurations } = await transformConfigurationMetadata(yesterdayCreatedConfigs);
            checkMissingParamsAndSendNotification(newConfigurations);
            const concatAllConfigurations = alreadySavedConfigs.configurations.concat(newConfigurations);
            const getUniqueConfigs = concatAllConfigurations.filter((value, index, array) => array.findIndex(
                (elementValue) => (JSON.stringify(elementValue) === JSON.stringify(value)),
            ) === index);
            dataToSave = { configurations: getUniqueConfigs };
        } else {
            const allConfigurations = await getAllConfigurations(s3data);
            dataToSave = await transformConfigurationMetadata(allConfigurations);
        }
        await saveMetadataInS3(dataToSave);
        const response = createResponse(RESPONSE_OK, {});
        return response;
    } catch (err) {
        const errorBody = createErrorBody(UNKNOWN_REASON,
            'ERROR');
        const errorResponse = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
        throw errorResponse;
    }
};

/**
 * Gets all configurations created yesterday fromn the listed S3 objects
 * @param {Array} parsedS3Data - s3 data from the listed objects in s3
 * @returns {Array}
 */
const getYesterdayConfigs = (parsedS3Data) => {
    const arrayOfConfigurations = parsedS3Data.reduce((acc, configurationObject) => {
        const date = new Date(configurationObject.LastModified).toISOString().split('T')[0];
        const today = new Date();
        const yesterday = new Date(today).setDate(today.getDate() - 1);
        const yesterdayDate = new Date(yesterday).toISOString().split('T')[0];
        if (yesterdayDate === date) {
            const confId = configurationObject.Key.split('/');
            if (confId[0] && confId[1] === 'conf.txt') {
                acc.push(confId[0]);
            }
        }
        return acc;
    }, []);
    if (arrayOfConfigurations.includes('metadata')) {
        arrayOfConfigurations.splice(arrayOfConfigurations.indexOf('metadata'), 1);
    }
    if (arrayOfConfigurations.includes('analysis')) {
        arrayOfConfigurations.splice(arrayOfConfigurations.indexOf('analysis'), 1);
    }
    if (arrayOfConfigurations.includes('docs')) {
        arrayOfConfigurations.splice(arrayOfConfigurations.indexOf('docs'), 1);
    }
    return arrayOfConfigurations[0] ? new Set(arrayOfConfigurations) : false;
};

/**
 * Gets all configurationIds fromn the listed S3 objects
 * @param {Object} parsedS3Data - s3 data from the listed objects in s3
 * @returns {Array}
 */
const getAllConfigurations = async (parsedS3Data) => {
    const arrayOfConfigurations = parsedS3Data.reduce((acc, s3Object) => {
        const confId = s3Object.Key.split('/');
        if (confId[0] && confId[1] === 'conf.txt') {
            acc.push(confId[0]);
        }
        return acc;
    }, []);

    if (arrayOfConfigurations.includes('metadata')) {
        arrayOfConfigurations.splice(arrayOfConfigurations.indexOf('metadata'), 1);
    }
    if (arrayOfConfigurations.includes('analysis')) {
        arrayOfConfigurations.splice(arrayOfConfigurations.indexOf('analysis'), 1);
    }
    if (arrayOfConfigurations.includes('docs')) {
        arrayOfConfigurations.splice(arrayOfConfigurations.indexOf('docs'), 1);
    }

    return new Set(arrayOfConfigurations);
};

/**
 * Transforming configuration and dynamodb data into a single json file,
 * which we can put in our s3 buckets containing all the available information.
 * @param {Array<string>} configurationIds - configuration  id
 * @returns {Object}
 */
const transformConfigurationMetadata = async (configurationIds) => {
    const allData = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const confId of configurationIds) {
        const metadataObject = {};
        let promoDetails;
        const config = await getConfiguration(confId);
        if (confId) {
            metadataObject.configuration_id = confId;
        }
        const configParams = config.configurationParameters ?? {};
        Object.entries(configParamMappings).forEach(([configParamKey, metadataObjKey]) => {
            const value = configParams[configParamKey];
            if (value) metadataObject[metadataObjKey] = value;
        });
        if (configParams?.additionalInformation?.name) {
            metadataObject.name = configParams.additionalInformation.name;
        }
        if (config.promotionId) {
            metadataObject.promo_id = config.promotionId;
            promoDetails = await queryPromotionTable(config.promotionId);
        }
        const promo = (promoDetails && promoDetails[0]) ?? {};
        Object.entries(promoMappings).forEach(([promoKey, metadataObjKey]) => {
            const value = promo[promoKey];
            if (value) metadataObject[metadataObjKey] = value;
        });
        allData.push(metadataObject);
    }
    return { configurations: allData };
};

/**
 * This function checks for missing params in the metadata objects array to be saved
 * and sends notification to subscribers with SNS
 *
 * @param {Array<object>} configurations
 */
const checkMissingParamsAndSendNotification = async (configs) => {
    let message = '';
    for (let i = 0; i < configs.length; i++) {
        const missingParams = getConfigMissingParams(configs[i]);
        if (missingParams.length !== 0) {
            const { configuration_id } = configs[i];
            message += `
            -> configuration_id: ${configuration_id} has missing parameters: ${missingParams.join(', ')}\n`;
        }
    }
    if (message !== '') {
        const { stageName, regionName, accountId } = process.env;
        const snsParams = {
            Message: message,
            Subject: `Stage ${stageName} on region ${regionName} has configurations with missing metadata parameters`,
            TopicArn: `arn:aws:sns:${regionName}:${accountId}:${stageName}-missingParamsConfigMetadata`,
        };
        await publishToSnsTopic(snsParams);
    }
};

/**
 * This function finds transformed metadata objects with missing properties
 *
 * @param {object} config
 * @returns empty array if nothing is missing or an array with empty params
*/
const getConfigMissingParams = (config) => {
    const missingParams = [];
    metadataObjectSchema.forEach((param) => {
        if (!(param in config)) {
            missingParams.push(param);
        }
    });
    return missingParams;
};

/**
 * Saving the metadata into a single file in our analysis S3 folder in our private bucket.
 * @param {JSON} allData - json file which contains all the metaData
 * @returns {Object}
 */
const saveMetadataInS3 = (allData) => {
    const fileName = METADATA_S3_FOLDER;
    return saveToS3({
        Key: fileName,
        Body: JSON.stringify(allData),
        Bucket: process.env.PRIVATE_BUCKET,
        ContentType: 'application/json',
        ContentDisposition: ContentDisposition(fileName, {
            type: 'inline',
        }),
    });
};

/**
 * Recursively gets all information from s3, and getting above the 1000 objects limit of the s3 listObjects.
 * @param {Object} params - bucket params name
 * @param {Array} allKeys - array of all list objects in s3
 * @returns {Promise}
 */
const getS3BucketsData = async (bucket, allKeys = []) => {
    const response = await listObjectsInS3V2(bucket);
    response.Contents.forEach((obj) => allKeys.push(obj));
    if (response.NextContinuationToken) {
        bucket.ContinuationToken = response.NextContinuationToken;
        await getS3BucketsData(bucket, allKeys);
    }
    return allKeys;
};

/**
 * Function that gets the metadata_json file which contains all saved configurations for analytics.
 * @returns {Promise}
 */
const getAlreadySavedConfigs = async () => {
    const getFileParams = {
        ErrorMessage: 'MetadataExporter failed to get all configurations list',
        readConfFileParams: {
            Key: METADATA_S3_FOLDER,
            Bucket: process.env.PRIVATE_BUCKET,
            ResponseContentType: 'application/json',
        },
    };
    const res = await getFileFromS3(getFileParams);
    return res;
};
