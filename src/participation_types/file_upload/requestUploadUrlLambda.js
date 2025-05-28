const { middyValidatorWrapper } = require('../../middlewares/middyValidatorWrapper');
const Utils = require('../../utility_functions/utilityFunctions');
const { checkIfS3ObjectExist } = require('../../utility_functions/aws_sdk_utils/s3Utilities');
const { getConfiguration } = require('../../utility_functions/configUtilities');
const ConfigUtils = require('../../self_service/configurationUtils');
const policyManager = require('./fileUploadPolicyManager');
const uploadFlows = require('./requestUploadFlows');
const ssConfig = require('../../self_service/selfServiceConfig.json');
const { RESPONSE_INTERNAL_ERROR, RESPONSE_FORBIDDEN, RESPONSE_OK } = require('../../constants/responses');
const { REQUIRED_PARAMETERS_FOR_LAMBDA } = require('../../constants/lambdas');
const { PARAMS_MAP: { CONFIGURATION_ID } } = require('../../constants/common');
const { ERROR_CODES: { CONFIGURATION_PARAMETER_MISSING, CHECKER_LAMBDA_REJECTION } } = require('../../constants/errCodes');

const getUploadFlow = async (config, flowLabel) => {
    console.log('Getting upload file flow from configuration:\n', JSON.stringify(config));
    const uploadFileFLow = ConfigUtils.getUploadFileFlow(config, flowLabel);
    if (!uploadFileFLow) {
        const errorBody = Utils.createErrorBody(CONFIGURATION_PARAMETER_MISSING,
            'uploadFileFLow not specified in config.');
        throw (Utils.createResponse(RESPONSE_INTERNAL_ERROR, errorBody));
    }
    console.log(`Upload file flow is:\n${JSON.stringify(uploadFileFLow)}`);
    return uploadFileFLow;
};

/**
 * Checks if S3 key is available for upload.
 * It will resolve on err because S3 would return err if
 * the bucket does not exists upon checking the key.
 * TODO: find a way to avoid receiving an err with "code": "NotFound"
 *
 * @param policyParameters - as per given permissions in S3
 * @param configuration - configuration pulled from S3
 * @param flowLabel - name of the flow being used
 *
 */
const checkKeyAvailability = async (policyParameters, configuration, flowLabel) => {
    console.log('Checking if override is allowed...');
    const isOverrideAllowed = ConfigUtils.getIsUploadOverrideAllowed(configuration, flowLabel);
    console.log('Override allowed:', isOverrideAllowed);
    if (isOverrideAllowed) {
        return policyParameters;
    }
    const headParams = {
        Bucket: policyParameters.bucket,
        Key: policyParameters.key,
    };
    console.log('Checking key', headParams.Key, 'for bucket', headParams.Bucket);
    try {
        const data = await checkIfS3ObjectExist(headParams);
        console.error('ERROR: Key is not available:\n', JSON.stringify(data));
        throw new Error('Key is not available');
    } catch (err) {
        if (err?.message === 'Key is not available') {
            const errorMessage = 'Upload not allowed';
            const errorDetails = { uploadAllowed: false };
            const errorBody = Utils.createErrorBody(CHECKER_LAMBDA_REJECTION,
                errorMessage, errorDetails);
            const errorResponse = Utils.createResponse(RESPONSE_FORBIDDEN, errorBody);
            throw errorResponse;
        }
        console.log('Key is available:\n', JSON.stringify(err));
        return policyParameters;
    }
};

const generateUploadUrlParams = async (config, params) => {
    const uploadFileFLow = await getUploadFlow(config, params.flowLabel);
    const policyParameters = uploadFlows.initializeAllAttributes(params, config, uploadFileFLow);
    await checkKeyAvailability(policyParameters, config, params.flowLabel);
    const result = await policyManager.generateS3Policy(policyParameters.key, config,
        params.flowLabel, policyParameters.MIMEtype, policyParameters.bucket, policyParameters.acl);
    console.log('Generated S3 policy:\n', JSON.stringify(result));
    return result;
};

/**
 * Generates S3 key for upload, and creates signed policy for uploading on that S3 key.
 * Should work with SS only.
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
// TODO: limit some uploadFlows only to this lambda
const ssRequestUploadUrlLambda = async (event) => {
    try {
        const params = Utils.extractParams(event);
        let config = { ...ssConfig };
        if (params.imageUploadParticipation) {
            config = { ...params.configuration, ...ssConfig };
            params.accessSegmentation = event?.resource === '/arbiterSDK'
                ? event?.requestContext.identity?.apiKeyId
                : event?.requestContext?.identity?.accessKey;
        }
        const uploadUrlParams = await generateUploadUrlParams(config, params);
        const result = { fileUploadDetails: uploadUrlParams };
        if (params.prizeImageUpload || params.currencyIconUpload) {
            const filePath = uploadUrlParams.clientConditions.key;
            const url = process.env.cloudFrontPublicUri !== 'undefined' ? `${process.env.cloudFrontPublicUri}/${filePath}`
                : Utils.getS3ObjectUrl(process.env.PUBLIC_BUCKET, filePath, process.env.regionName);
            result.imageUrl = encodeURI(url);
        }

        const response = Utils.createResponse(RESPONSE_OK, result);
        console.log('Returning success response...');
        return response;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', JSON.stringify(errorResponse));
        return errorResponse;
    }
};

/**
 * Lambda function.
 * Expects configurationId, userId, participationId, file name, file type
 * Generates S3 key for upload, and creates signed policy for uploading on that S3 key.
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
const requestUploadUrlLambda = async (event) => {
    try {
        const params = Utils.extractParams(event);
        const configExtracted = await getConfiguration(params[CONFIGURATION_ID], event);
        const result = await generateUploadUrlParams(configExtracted, params);
        const response = Utils.createResponse(RESPONSE_OK, { fileUploadDetails: result });
        console.log('Returning response:\n', JSON.stringify(response));
        return response;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', JSON.stringify(errorResponse));
        throw errorResponse;
    }
};

module.exports = {
    ssRequestUploadUrlLambda,
    requestUploadUrlLambda: middyValidatorWrapper(requestUploadUrlLambda, REQUIRED_PARAMETERS_FOR_LAMBDA.fileUpload),
};
