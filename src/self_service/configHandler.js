const uniqid = require('uniqid');
const moment = require('moment-timezone');
const Utils = require('../utility_functions/utilityFunctions');
const {
    setS3BucketLifecycle,
    saveToS3,
    getS3BucketLifecycle,
} = require('../utility_functions/aws_sdk_utils/s3Utilities');
const { getConfiguration, searchJsSdkConfiguration } = require('../utility_functions/configUtilities');
const promotionsTable = require('../database/promotionsTable');
const PromotionUtils = require('./promotionsUtils');
const { REQUIRED_PARAMETERS_FOR_LAMBDA } = require('../constants/lambdas');
const { RESPONSE_OK, RESPONSE_INTERNAL_ERROR } = require('../constants/responses');
const { PARAMS_MAP: { PROMOTION_ID, CONFIGURATION_ID, CONFIGURATION } } = require('../constants/common');
const { ERROR_CODES: { DYNAMO_DB_ERROR } } = require('../constants/errCodes');

const CURRENT_CONFIGURATION_VERSION = 2;
const CONF_FILE_EXT = '.txt';
const SDK_CONF_FILE_EXT = '.json';

/**
 * Upload JS SDK configuration to s3 private bucket
 * @param eventParams - data that we receive from request
 */
const saveJsSdkConfigurationFile = async (jsSdkConfig, fileName, isEdit) => {
    console.log('Saving SDK configuration file...');
    const fullFileName = `sdk/configurations/${fileName}${SDK_CONF_FILE_EXT}`;

    const writeJsSdkConfigFile = {
        Body: JSON.stringify(jsSdkConfig),
        Bucket: process.env.PUBLIC_BUCKET,
        ContentType: 'text/json',
        Key: fullFileName,
        ACL: 'public-read',
    };

    if (isEdit) {
        try {
            const oldConfig = await searchJsSdkConfiguration(fileName);
            const sdkConfExtIdx = fullFileName.lastIndexOf(SDK_CONF_FILE_EXT);
            const sdkConfPath = fullFileName.slice(0, sdkConfExtIdx);

            await saveToS3({
                Body: JSON.stringify(oldConfig),
                Bucket: process.env.PUBLIC_BUCKET,
                ContentType: 'text/json',
                Key: `${sdkConfPath}_last_used_${new Date().getTime()}${SDK_CONF_FILE_EXT}`,
            });
            return saveToS3(writeJsSdkConfigFile);
        } catch (e) {
            console.error(e.message);
        }
    }

    return saveToS3(writeJsSdkConfigFile);
};

/**
 * Execute JS SDK configuration create/upload flow
 * @param eventParams - data that we receive from request
 */
const executeJsSdkConfigurationFlow = (eventParams) => {
    const jsSdkConfig = eventParams.configuration;
    const { isEdit } = eventParams;
    return saveJsSdkConfigurationFile(jsSdkConfig, eventParams.fileName, isEdit)
        .then(() => {
            const body = {
                configStored: true,
                configuration: jsSdkConfig,
            };
            const response = Utils.createResponse(RESPONSE_OK, body);
            return Promise.resolve(response);
        }).catch((err) => Promise.reject(err));
};

/**
 * check the passed configuration object and prepare for upload
 * @param eventParams - data that we receive from request
 */
const prepareConfiguration = (eventParams) => {
    // Setup configurationId
    let configurationId = eventParams[CONFIGURATION_ID];
    if (!configurationId) {
        configurationId = uniqid();
        eventParams.configurationId = configurationId;
    }

    const config = eventParams[CONFIGURATION];
    console.log('Preparing configuration\n', JSON.stringify(config));
    config.GPPConfigVersion = CURRENT_CONFIGURATION_VERSION;

    // Setup config core data
    config.configurationId = configurationId;
    config.promotionId = eventParams[PROMOTION_ID];

    // check for additionalInformation image
    const { additionalInformation } = config.configurationParameters;
    if (additionalInformation && additionalInformation.imgUrl) {
        const fileName = additionalInformation.imgUrl.replace(/^.*[\\/]/, '');
        // construct imgUrl replacing white space in fileName
        const updatedImgUrl = process.env.cloudFrontPublicUri
            ? `${process.env.cloudFrontPublicUri}/configurationImages/${configurationId}/${fileName.replace(/\s/g, '')}`
            : `${process.env.PUBLIC_BUCKET}/configurationImages/${configurationId}/${fileName.replace(/\s/g, '')}`;
        additionalInformation.imgUrl = updatedImgUrl;
    }

    console.log('Configuration is ready:\n', JSON.stringify(config));
    return config;
};

const writeConfigToS3 = (config, fileName) => {
    const writeConfigFile = {
        Body: JSON.stringify(config),
        Bucket: process.env.PRIVATE_BUCKET,
        ContentType: 'text/plain',
        Key: fileName,
    };

    return saveToS3(writeConfigFile)
        .then(() => Promise.resolve(config))
        .catch((error) => Promise.reject(error));
};

/**
 * Upload configuration to s3 private bucket
 * bucket name = configurationId
 * If the configuration has been edited, a copy of the old version will be saved in the same S3 path
 * @param {Object} config - configuration data
 * @param {Boolean} isEdit - true if the config object has been edited
 * @returns {Promise}
 */
const saveConfigurationFile = async (config, isEdit) => {
    try {
        console.log('Saving configuration file...');
        const { configurationId } = config;
        const fileName = Utils.getConfigFilePath(configurationId);
        const isImageEntry = config.flow?.promoEntry?.params?.imageEntry;

        if (isEdit) {
            const oldConfig = await getConfiguration(configurationId);
            const [confPath] = fileName.split(CONF_FILE_EXT);
            await saveToS3({
                Body: JSON.stringify(oldConfig),
                Bucket: process.env.PRIVATE_BUCKET,
                ContentType: 'text/plain',
                Key: `${confPath}_last_used_${new Date().getTime()}${CONF_FILE_EXT}`,
            });
        }

        if (isImageEntry) manageBucketLifecycle(config);
        return await writeConfigToS3(config, fileName);
    } catch (error) {
        console.error('ERROR: Failed to save configuration: \n', JSON.stringify(error));
        return error;
    }
};

const manageBucketLifecycle = async (config) => {
    try {
        const BUCKET_NAME = process.env.USER_DATA_BUCKET;
        const response = await getS3BucketLifecycle({ Bucket: BUCKET_NAME });
        const responseBody = JSON.parse(response.body);
        const params = createUpdateLifecycleParams(BUCKET_NAME, config, responseBody);
        await setS3BucketLifecycle(params);
    } catch (error) {
        console.error('ERROR: Failed to manage bucket lifecycle: \n', JSON.stringify(error));
        return error;
    }
};

/**
 * Create params object for updating S3 bucket lifecycle configuration
 * @param {String} bucket - name of the bucket
 * @param {Object} config - configuration object
 * @param {Object} lifeCycleConfigs - lifecycle policy of the configuration
 * @Return params
 */
const createUpdateLifecycleParams = (bucket, config, lifeCycleConfigs) => {
    const { configurationId, configurationParameters } = config;

    const lifecycleId = `Config retention rules: ${configurationId}`;

    // Add 30 days to the configuration end date as the expiry date.
    // The date value must be in ISO 8601 format. The time is always midnight UTC.
    const expiryDate = moment(configurationParameters.configurationEndUtc)
        .add(30, 'days').utc().startOf('day')
        .toISOString();

    const lifecycleRuleObj = {
        ID: lifecycleId,
        Filter: {
            And: {
                Prefix: `${configurationId}/`,
                Tags: [
                    {
                        Key: 'config_id',
                        Value: configurationId,
                    },
                    {
                        Key: 'participation_type',
                        Value: 'image',
                    },
                ],
            },
        },
        Status: 'Enabled',
        Transitions: [
            {
                Date: expiryDate,
                StorageClass: 'GLACIER',
            },
        ],
    };

    const params = {
        Bucket: bucket,
        LifecycleConfiguration: {
            Rules: [
                lifecycleRuleObj,
            ],
        },
    };

    // If the lifecycle policy exists, replace or append a new rule in the policy
    if (lifeCycleConfigs) {
        params.LifecycleConfiguration = lifeCycleConfigs;
        const ruleIndex = lifeCycleConfigs.Rules.findIndex((rule) => rule.ID === lifecycleId);
        const rulesLength = params.LifecycleConfiguration.Rules.length;
        params.LifecycleConfiguration.Rules[(ruleIndex < 0) ? rulesLength : ruleIndex] = lifecycleRuleObj;
    }

    return params;
};

/**
 * Checks if specified promotionId exists in promotions table.
 * @Return promise
 *      - resolved without additional data when promotion exists
 *      - rejected with invalid parameter response if promotion doesn't exist
 */
const checkIfPromotionExists = (promotionId) => promotionsTable.getPromoMetadata(promotionId)
    .then((result) => {
        if (result && result.length > 0) {
            return Promise.resolve();
        }
        const error = Utils.createResponseInvalidParameter(['promotionId']);
        return Promise.reject(error);
    });

/**
 * Adds configurationId to configurations array, or does nothing if configurationId is already part of configurations array.
 */
const linkConfiguration = async (promotionId, configurationId) => {
    const metadata = await PromotionUtils.getMetadata(promotionId);
    if (!metadata) {
        const errorBody = Utils.createErrorBody(DYNAMO_DB_ERROR, 'Promotion not found!',
            { promotionId });
        const errorResponse = Utils.createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
        throw errorResponse;
    }
    const { configurations } = metadata;
    if (configurations && configurations.indexOf(configurationId) > -1) {
        // already linked, return current metadata
        return metadata;
    }
    return promotionsTable.addConfiguration(promotionId, configurationId);
};

/**
 * link the newly created configuration to the specified promotionId in DB
 * by configurationId
 */
const linkConfigToPromotion = (config) => linkConfiguration(config.promotionId, config.configurationId)
    .then((dbresponse) => {
        console.log('Successfully linked configuration to promotion:\n', JSON.stringify(dbresponse));
        return Promise.resolve(config);
    });

/**
 * Execute GPP configuration create/upload flow
 * @param eventParams - data that we receive from request
 */
const executeConfigurationFlow = (eventParams) => {
    const conf = prepareConfiguration(eventParams);

    return saveConfigurationFile(conf, eventParams.isEdit)
        .then((configuration) => linkConfigToPromotion(configuration))
        .then((config) => {
            const body = {
                [`config${eventParams.isEdit ? 'Edited' : 'Stored'}`]: true,
                configurationId: config.configurationId,
                configuration: config,
            };
            const response = Utils.createResponse(RESPONSE_OK, body);
            return Promise.resolve(response);
        }).catch((err) => Promise.reject(err));
};

/**
 * 1: create and upload config to s3
 * 2: link configuration to promotionId in DB(promotionsTable)
 * 3: promotionId must be specified
 *
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
const configStore = async (event) => {
    const eventParams = Utils.extractParams(event);
    console.log('Extracted params:\n', JSON.stringify(eventParams));
    const requiredParameters = REQUIRED_PARAMETERS_FOR_LAMBDA.configStoreLambda;
    try {
        Utils.checkPassedParameters(eventParams, requiredParameters);
        await checkIfPromotionExists(eventParams[PROMOTION_ID]);
        if (eventParams.jsSdkCreation) {
            return executeJsSdkConfigurationFlow(eventParams);
        }
        return executeConfigurationFlow(eventParams);
    } catch (err) {
        console.error('ERROR: Returning error response:\n', JSON.stringify(err));
        return err;
    }
};

module.exports = {
    configStore,
};
