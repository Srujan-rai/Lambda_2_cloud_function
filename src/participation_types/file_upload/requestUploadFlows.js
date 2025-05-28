const Utils = require('../../utility_functions/utilityFunctions');
const { getDefaultUserIdType } = require('../../utility_functions/configUtilities');
const { RESPONSE_INTERNAL_ERROR } = require('../../constants/responses');
const { PARAMS_MAP } = require('../../constants/common');
const { ERROR_CODES } = require('../../constants/errCodes');

const FILE_UPLOAD_FLOWS = {
    voucherCodesInsertion: {
        flowName: 'voucherCSV',
        allowedMIMEtype: 'text/csv',
    },
    imageUploadParticipation: {
        flowName: 'imageUploadParticipation',
        allowedMIMEtype: 'image',
    },
    prizeImageUpload: {
        flowName: 'prizeImageUpload',
        allowedMIMEtype: 'image',
    },
    winningMomentsInsertion: {
        flowName: 'winningMomentCsv',
        allowedMIMEtype: 'text/csv',
    },
    bulkUpoadVoucherCodes: {
        flowName: 'bulkUploadVoucherCSVs',
        allowedMIMEtype: 'text/csv',
    },
    replicationPackageInsertion: {
        flowName: 'replicationPackageInsertion',
        allowedMIMEtype: 'application/zip',
    },
    additionalInformationImageUpload: {
        flowName: 'additionalInformationImageUpload',
        allowedMIMEtype: 'image',
    },
    bulkUploadPrizes: {
        flowName: 'bulkPrizeUpload',
        allowedMIMEtype: 'text/csv',
    },
    bulkUpdatePrizes: {
        flowName: 'bulkPrizeUpdate',
        allowedMIMEtype: 'text/csv',
    },
    currencyIconUpload: {
        flowName: 'currencyIconUpload',
        allowedMIMEtype: 'image',
    },
};

/**
 * set the key/bucket/MIMEtype params for this flow
 * @param params - params that are in the http request
 */
const setReplicationPackageUploadFlowAttributes = (params) => {
    Utils.checkPassedParameters(params, [PARAMS_MAP.FILE_NAME]);
    const date = new Date().toISOString().split('T')[0];
    return {
        key: `replications/${date}/${params[PARAMS_MAP.FILE_NAME]}`,
        bucket: process.env.PRIVATE_BUCKET,
        MIMEtype: FILE_UPLOAD_FLOWS.replicationPackageInsertion.allowedMIMEtype,
        acl: 'private',
    };
};

/**
 * set the key/bucket/MIMEtype params for this flow
 * @param params - params that are in the http request
 */
const setWinningMomentUploadFlowAttributes = (params) => {
    Utils.checkPassedParameters(params, [PARAMS_MAP.CONFIGURATION_ID, PARAMS_MAP.FILE_NAME]);
    const result = {};
    result.key = `${params[PARAMS_MAP.CONFIGURATION_ID]}/winningMomentCSVs/${params[PARAMS_MAP.FILE_NAME]}`;
    result.bucket = process.env.PRIVATE_BUCKET;
    result.MIMEtype = FILE_UPLOAD_FLOWS.winningMomentsInsertion.allowedMIMEtype;
    result.acl = 'private';
    return result;
};

/**
 * set the key/bucket/MIMEtype params for this flow
 * @param params - params that are in the http request
 */
const setVoucherUploadFlowAttributes = (params) => {
    Utils.checkPassedParameters(params, [PARAMS_MAP.CONFIGURATION_ID, PARAMS_MAP.PRIZE_ID, PARAMS_MAP.FILE_NAME]);
    const result = {};
    result.key = `${params[PARAMS_MAP.CONFIGURATION_ID]}/prizes/${params[PARAMS_MAP.PRIZE_ID]}/voucherCSVs/${params[PARAMS_MAP.FILE_NAME]}`;
    result.bucket = process.env.PRIVATE_BUCKET;
    result.MIMEtype = FILE_UPLOAD_FLOWS.voucherCodesInsertion.allowedMIMEtype;
    result.acl = 'private';
    return result;
};

/**
 * set the key/bucket/MIMEtype params for this flow
 * @param params - params that are in the http request
 * @param config -  the extracted config
 */
function setImageParticipationFlowAttributes(params, config) {
    const result = {};

    // check if userIdType is specified in call or config file
    if (!Object.prototype.hasOwnProperty.call(params, PARAMS_MAP.USER_ID_TYPE)) {
        params.userIdType = getDefaultUserIdType(config);
        if (!params.userIdType) {
            // if neither -> reject
            const errorBody = Utils.createErrorBody(ERROR_CODES.CONFIGURATION_PARAMETER_MISSING,
                'UserIdType not specified in config.');
            throw Utils.createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
        }
    }

    result.key = `imageParticipation/${params.accessSegmentation ? `${params.accessSegmentation}/` : ''}${params.configurationId}/${params.userIdType.toString().toLowerCase()}/${params.userId}/${params.fileName}`;
    result.bucket = process.env.USER_DATA_BUCKET;
    result.MIMEtype = FILE_UPLOAD_FLOWS.imageUploadParticipation.allowedMIMEtype;
    result.acl = 'private';

    return result;
}

/**
 * set the key/bucket/MIMEtype params for this flow
 * @param params - params that are in the http request
 */
function setPrizeImageUploadFlowAttributes(params) {
    const result = {};
    if (!Object.prototype.hasOwnProperty.call(params, PARAMS_MAP.PRIZE_ID)) {
        const errorBody = Utils.createErrorBody(ERROR_CODES.REQUEST_PARAMETER_MISSING,
            'prize id not specified.');
        throw Utils.createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
    }
    result.key = `prizeImages/${params.configurationId}/${params.prizeId}/${params.languageCode}/${params.fileName}`;
    result.bucket = process.env.PUBLIC_BUCKET;
    result.MIMEtype = FILE_UPLOAD_FLOWS.prizeImageUpload.allowedMIMEtype;
    result.acl = 'public-read';

    return result;
}

/**
 * set the key/bucket/MIMEtype params for this flow
 * @param params - params that are in the http request
 */
const setBulkUploadVoucherFlowAttributes = (passedParams) => {
    Utils.checkPassedParameters(passedParams, [PARAMS_MAP.FILE_NAME]);
    return {
        key: `${passedParams[PARAMS_MAP.CONFIGURATION_ID]}/prizes/${passedParams[PARAMS_MAP.PRIZE_ID]}/digitalCodesBulkUpload/${passedParams[PARAMS_MAP.FILE_NAME]}`,
        bucket: process.env.PRIVATE_BUCKET,
        MIMEtype: FILE_UPLOAD_FLOWS.bulkUpoadVoucherCodes.allowedMIMEtype,
        acl: 'private',
    };
};

/**
 * set the key/bucket/MIMEtype params for this flow
 * @param params - params that are in the http request
 */
const setAdditionalInformationImageUploadFlowAttributes = (params) => {
    const result = {};
    if (!Object.prototype.hasOwnProperty.call(params, PARAMS_MAP.CONFIGURATION_ID)) {
        const errorBody = Utils.createErrorBody(ERROR_CODES.REQUEST_PARAMETER_MISSING,
            'configuration id not specified.');
        throw Utils.createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
    }
    result.key = `configurationImages/${params.configurationId}/${params.fileName}`;
    result.bucket = process.env.PUBLIC_BUCKET;
    result.MIMEtype = FILE_UPLOAD_FLOWS.additionalInformationImageUpload.allowedMIMEtype;
    result.acl = 'public-read';

    return result;
};
/**
 * set the key/bucket/MIMEtype params for bulkPrize flow
 * @param params - params that are in the http request
 */
const setBulkPrizeUploadedAttributes = (params) => {
    try {
        Utils.checkPassedParameters(params, [PARAMS_MAP.FILE_NAME]);
        return {
            key: `bulkPrizesCSVs/${params[PARAMS_MAP.CONFIGURATION_ID]}/${params[PARAMS_MAP.FILE_NAME]}`,
            bucket: process.env.PRIVATE_BUCKET,
            MIMEtype: FILE_UPLOAD_FLOWS.bulkUploadPrizes.allowedMIMEtype,
            acl: 'private',
        };
    } catch (error) {
        return error;
    }
};

const setBulkPrizeUpdateAttributes = (params) => {
    try {
        Utils.checkPassedParameters(params, [PARAMS_MAP.FILE_NAME]);
        return {
            key: `bulkPrizesUpdateCSVs/${params[PARAMS_MAP.CONFIGURATION_ID]}/${params[PARAMS_MAP.FILE_NAME]}`,
            bucket: process.env.PRIVATE_BUCKET,
            MIMEtype: FILE_UPLOAD_FLOWS.bulkUploadPrizes.allowedMIMEtype,
            acl: 'private',
        };
    } catch (error) {
        return error;
    }
};

const setCurrencyIconUploadAttributes = (params) => {
    Utils.checkPassedParameters(params, [PARAMS_MAP.FILE_NAME, PARAMS_MAP.CURRENCY_ID]);
    return {
        key: `icons/${params[PARAMS_MAP.CURRENCY_ID]}/${params[PARAMS_MAP.FILE_NAME]}`,
        bucket: process.env.PUBLIC_BUCKET,
        MIMEtype: FILE_UPLOAD_FLOWS.currencyIconUpload.allowedMIMEtype,
        acl: 'public-read',
    };
};

/**
 * generate the key and gets the bucket for the specified uploadFileFlow
 * It has switch case that will cover the flows that we currently have
 * @param uploadFileFLow - specified upload file flow in config file
 * @param config - the extracted config
 * @param params - params that are in the http request
 */
module.exports.initializeAllAttributes = (params, config, uploadFileFLow) => {
    switch (uploadFileFLow) {
        case FILE_UPLOAD_FLOWS.voucherCodesInsertion.flowName:
            return setVoucherUploadFlowAttributes(params);
        case FILE_UPLOAD_FLOWS.imageUploadParticipation.flowName:
            return setImageParticipationFlowAttributes(params, config);
        case FILE_UPLOAD_FLOWS.prizeImageUpload.flowName:
            return setPrizeImageUploadFlowAttributes(params);
        case FILE_UPLOAD_FLOWS.winningMomentsInsertion.flowName:
            return setWinningMomentUploadFlowAttributes(params);
        case FILE_UPLOAD_FLOWS.bulkUpoadVoucherCodes.flowName:
            return setBulkUploadVoucherFlowAttributes(params);
        case FILE_UPLOAD_FLOWS.replicationPackageInsertion.flowName:
            return setReplicationPackageUploadFlowAttributes(params);
        case FILE_UPLOAD_FLOWS.additionalInformationImageUpload.flowName:
            return setAdditionalInformationImageUploadFlowAttributes(params);
        case FILE_UPLOAD_FLOWS.bulkUploadPrizes.flowName:
            return setBulkPrizeUploadedAttributes(params);
        case FILE_UPLOAD_FLOWS.bulkUpdatePrizes.flowName:
            return setBulkPrizeUpdateAttributes(params);
        case FILE_UPLOAD_FLOWS.currencyIconUpload.flowName:
            return setCurrencyIconUploadAttributes(params);
        default: {
            const errorBody = Utils.createErrorBody(ERROR_CODES.INVALID_PARAMETER,
                'file upload flow not specified or not supported!');
            throw Utils.createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
        }
    }
};
