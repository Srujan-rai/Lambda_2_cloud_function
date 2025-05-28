const Utils = require('../utility_functions/utilityFunctions');
const emailTemplatesTable = require('../database/emailTemplatesTable');
const emailTemplateUtils = require('./emailTemplateUtilities');
const configurationUtils = require('../self_service/configurationUtils');
const ssConfig = require('../self_service/selfServiceConfig.json');

const {
    ERROR_CODES: {
        REQUEST_PARAMETER_MISSING, INVALID_PARAMETER, S3_WRITE_ERROR, DYNAMO_DB_ERROR, NOT_FOUND,
    },
} = require('../constants/errCodes');
const { RESPONSE_BAD_REQUEST, RESPONSE_INTERNAL_ERROR, RESPONSE_OK } = require('../constants/responses');
const { EMAIL_TEMPLATE_IMAGE_FOLDER_NAME } = require('../constants/common');

const CFPublicUri = process.env.cloudFrontPublicUri;

/**
 * This function expects an emailTemplateLambdaFlow parameter that will execute the right flow.
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
module.exports.emailTemplateLambda = async (event) => {
    const params = Utils.extractParams(event);

    if (!params.emailTemplateParams) {
        const errorBody = Utils.createErrorBody(REQUEST_PARAMETER_MISSING,
            'missing parameter "emailTemplateParams"');
        const errorResponse = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
        console.error('ERROR: Returning error response:\n', JSON.stringify(errorResponse));
        return errorResponse;
    }

    const emailTemplateFlow = configurationUtils.getEmailTemplateLambdaFlow(ssConfig, params.flowLabel);

    if (!emailTemplateFlow) {
        const errorBody = Utils.createErrorBody(INVALID_PARAMETER,
            'emailTemplateFlow not specified in config.');
        const errorResponse = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
        console.error('ERROR: Returning error response:\n', JSON.stringify(errorResponse));
        return errorResponse;
    }
    console.log('Email template flow is:', emailTemplateFlow);

    switch (emailTemplateFlow) {
        case 'addEmailTemplate':
            try {
                console.log('Add email template...');
                const result = await emailTemplatesTable.putEntry(params.emailTemplateParams);
                console.log('Returning response:\n', JSON.stringify(result));
                return result;
            } catch (errorResponse) {
                console.error('ERROR: Returning error response:\n', errorResponse);
                return errorResponse;
            }
        case 'uploadImagesEmailTemplate':
            try {
                await checkEmailTemplateId(params.emailTemplateParams);
                const result = await uploadImagesEmailTemplate(params.emailTemplateParams);
                const insertImageResult = await insertImagesInfoToDynamoDB(
                    result.imagesLocations,
                    result.iconsWithPaths,
                    result.templateId,
                );
                console.log('Returning response:\n', JSON.stringify(insertImageResult));
                return insertImageResult;
            } catch (errorResponse) {
                console.error('ERROR: Returning error response:\n', errorResponse);
                return errorResponse;
            }
        case 'getEmailTemplate':
            try {
                const result = await getEmailTemplate(params.emailTemplateParams);
                console.log('Returning response:\n', JSON.stringify(result));
                return result;
            } catch (errorResponse) {
                console.error('ERROR: Returning error response:\n', errorResponse);
                return errorResponse;
            }
        case 'updateEmailTemplate':
            try {
                await checkEmailTemplateId(params.emailTemplateParams);
                const result = await updateEmailTemplate(params.emailTemplateParams);
                console.log('Returning response:\n', JSON.stringify(result));
                return result;
            } catch (errorResponse) {
                console.error('ERROR: Returning error response:\n', errorResponse);
                return errorResponse;
            }
        case 'updateImagesEmailTemplate':
            try {
                await checkEmailTemplateId(params.emailTemplateParams);
                const deleteImagesResult = await deleteImagesEmailTemplate(params.emailTemplateParams);
                const uploadImagesResult = await uploadImagesEmailTemplate(deleteImagesResult);
                const result = await updateImagesInfoToDynamoDB(uploadImagesResult);
                console.log('Returning response:\n', JSON.stringify(result));
                return result;
            } catch (errorResponse) {
                console.error('ERROR: Returning error response:\n', errorResponse);
                return errorResponse;
            }
        default:
            const errorBody = Utils.createErrorBody(INVALID_PARAMETER,
                'Such emailTemplateLambdaFlow does not exist.');
            const errorResponse = Utils.createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
            console.error('ERROR: Returning error response:\n', errorResponse);
            return errorResponse;
    }
};

/**
 * Upload email template images
 * @param {Object} params - {headerImage, icons}
 */
const uploadImagesEmailTemplate = async (params) => {
    const promises = [];
    const icons = [];

    console.log('Uploading email template images...');

    if (!params.icons.length && !params.headerImage) {
        return params;
    }
    if (!emailTemplateUtils.checkImageFilesTypes(params)) {
        const errorBody = Utils.createErrorBody(INVALID_PARAMETER, 'Invalid image file type');
        const errResponse = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errResponse;
    }
    if (params.headerImage && params.headerImage.file) {
        const headerImage = { ...params.headerImage };

        console.log('Generate header image file path to S3 bucket and make an upload promise object.');
        headerImage.path = `${EMAIL_TEMPLATE_IMAGE_FOLDER_NAME}/${params.templateId}/headerImage/${headerImage.name}`;
        promises.push(emailTemplateUtils.createS3UploadPromise(headerImage));
    }
    if (params.icons) {
        console.log('Generate icons path to S3 bucket and make an upload promise objects.');
        params.icons.forEach((data, index) => {
            const icon = { ...data };

            if (icon.file && icon.btnLink) {
                icon.path = `${EMAIL_TEMPLATE_IMAGE_FOLDER_NAME}/${params.templateId}/icons/${index}/${icon.name}`;
                promises.push(emailTemplateUtils.createS3UploadPromise(icon));
                icons.push(icon);
            }
        });
    }
    try {
        const data = await Promise.all(promises);
        console.log('Response from S3 upload promises is:\n', JSON.stringify(data));
        const dataForInsert = { ...params };
        dataForInsert.imagesLocations = data;
        dataForInsert.iconsWithPaths = icons;
        console.log('Data for insert to DynamoDB:\n', JSON.stringify(dataForInsert));
        return dataForInsert;
    } catch (err) {
        console.error('ERROR: Failed to upload images to S3:\n', JSON.stringify(err));
        const errorBody = Utils.createErrorBody(S3_WRITE_ERROR, 'Failed upload images to S3');
        const errResponse = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errResponse;
    }
};

/**
 * Prepare and insert images info to dynamoDB
 * @param {Array} imagesLocation
 * @param {Array} icons
 * @param {String} templateId
 */
const insertImagesInfoToDynamoDB = async (imagesLocation, icons, templateId) => {
    console.log('Saving images url to DynamoDB...');
    const images = [...imagesLocation];
    const result = {
        templateId,
        socialIconsAndLinks: [],
    };

    if (images.length > icons.length) {
        console.log('Set header image path.');
        result.headerImagePath = CFPublicUri
            ? `${CFPublicUri}/${emailTemplateUtils.extractFileKey(images[0].Location)}` : images[0].Location;
        console.log(`Deleting header image from icons:\n${JSON.stringify(images[0])}`);
        images.splice(0, 1);
    }
    console.log(`Prepare icons for insert:\n${JSON.stringify(result)}`);
    images.forEach((image, index) => {
        const icon = {
            img_src: CFPublicUri
                ? `${CFPublicUri}/${emailTemplateUtils.extractFileKey(image.Location)}` : image.Location,
            btn_link: icons[index].btnLink,
        };

        result.socialIconsAndLinks.push(icon);
    });
    console.log('All images ready for upload:\n', JSON.stringify(result));
    try {
        await emailTemplatesTable.updateEntry(result);
        return Utils.createResponse(RESPONSE_OK, {});
    } catch (err) {
        const errorBody = Utils.createErrorBody(DYNAMO_DB_ERROR,
            'Failed to save icons information to DynamoDB');
        const errResponse = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errResponse;
    }
};

/**
 * Get email template
 * @param {Object} params - {templateId}
 */
const getEmailTemplate = async (params) => {
    console.log('Getting email template...');
    if (!params.templateId) {
        const errorBody = Utils.createErrorBody(REQUEST_PARAMETER_MISSING, 'Missing parameter templateId');
        const errResponse = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errResponse;
    }
    if (typeof params.templateId === 'object') {
        params.templateId = params.templateId.templateId;
    }
    try {
        const response = await emailTemplateUtils.getMetadata(params.templateId);
        return Utils.createResponse(RESPONSE_OK, { emailTemplateMetadata: Utils.copyAsCamelCase(response) });
    } catch (err) {
        console.error('ERROR:\n', JSON.stringify(err));
        const errorBody = Utils.createErrorBody(DYNAMO_DB_ERROR, 'Failed to get email template');
        const errResponse = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errResponse;
    }
};

/**
 * Update email template
 * @param {Object} params - {templateId, templateName,
 * country, senderName, subjectText, introductoryText, additionalText, signatureText,
 * copyrightText, privacyPolicy, termsOfService, headerImagePath, socialIconsAndLinks}
 */
const updateEmailTemplate = async (params) => {
    console.log('Updating email template...');
    try {
        delete params.socialIconsAndLinks;
        await emailTemplatesTable.updateEntry(params);
        return Utils.createResponse(RESPONSE_OK, {});
    } catch (err) {
        console.error('ERROR:\n', JSON.stringify(err));
        const errorBody = Utils.createErrorBody(DYNAMO_DB_ERROR, 'Failed to update email template');
        const errResponse = (Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody));
        throw errResponse;
    }
};

/**
 * Delete email template images
 * @param {Object} params - {headerImage, icons}
 */
const deleteImagesEmailTemplate = async (params) => {
    const keys = [];

    console.log('Deleting email template images...');
    params = emailTemplateUtils.prepareUpdateImages(params);
    if (!params.iconsForDelete.length && !params.headerImage) {
        return params;
    }
    if (!emailTemplateUtils.checkImageFilesTypes(params)) {
        const errorBody = Utils.createErrorBody(INVALID_PARAMETER, 'Invalid image file type');
        const errResponse = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errResponse;
    }
    if (params.headerImage && params.headerImage.file && params.headerImage.headerImagePath) {
        keys.push({ Key: emailTemplateUtils.extractFileKey(params.headerImage.headerImagePath) });
    }
    if (params.iconsForDelete) {
        console.log('Generate icons path to S3 bucket and make a promise objects.');
        params.iconsForDelete.forEach((icon) => {
            if (icon.file && icon.imgSrc && icon.btnLink) {
                keys.push({ Key: emailTemplateUtils.extractFileKey(icon.imgSrc) });
            }
        });
    }
    try {
        const data = await emailTemplateUtils.createS3DeletePromise(keys);

        console.log('Successfully deleted images from S3:\n', JSON.stringify(data));
        return params;
    } catch (err) {
        console.error('ERROR: Failed to delete images from S3:\n', JSON.stringify(err));
        const errorBody = Utils.createErrorBody(S3_WRITE_ERROR, 'Failed delete images from S3');
        const errResponse = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errResponse;
    }
};

/**
 * Check email template id
 * @param {Object} params - {templateId}
 */
const checkEmailTemplateId = async (params) => {
    console.log('Checking email template id...');
    const result = await getEmailTemplate(params);
    console.log('Result is:\n', JSON.stringify(result.body));
    if (!JSON.parse(result.body).emailTemplateMetadata) {
        const errorBody = Utils.createErrorBody(NOT_FOUND, 'Invalid template id');
        const errResponse = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errResponse;
    }
};

/**
 * Prepare and update images info to dynamoDB
 * @param {Object} params - {imagesLocations, templateId, iconsWithPaths, iconsByIndex, allIcons}
 */
const updateImagesInfoToDynamoDB = async (params) => {
    console.log('Updating images url to dynamoDB...');
    const images = params.imagesLocations ? [...params.imagesLocations] : [];
    const result = {
        templateId: params.templateId,
        socialIconsAndLinks: [],
    };

    if (params.iconsWithPaths && images.length > params.iconsWithPaths.length) {
        console.log('Set header image path.');
        result.headerImagePath = CFPublicUri
            ? `${CFPublicUri}/${emailTemplateUtils.extractFileKey(images[0].Location)}` : images[0].Location;
        console.log('Deleting header image from icons:\n', JSON.stringify(images[0]));
        images.splice(0, 1);
    }
    console.log('Prepare icons for insert:\n', JSON.stringify(result));
    const preparedIcons = [];

    images.forEach((image, index) => {
        const icon = {
            imgSrc: CFPublicUri
                ? `${CFPublicUri}/${emailTemplateUtils.extractFileKey(image.Location)}` : image.Location,
            btnLink: params.iconsWithPaths[index].btnLink,
        };

        preparedIcons.push(icon);
    });
    Object.keys(params.iconsByIndex).forEach((key, index) => {
        params.iconsByIndex[key] = preparedIcons[index];
    });

    result.socialIconsAndLinks = params.allIcons.map((icon, index) => {
        icon = {
            img_src: icon.imgSrc,
            btn_link: icon.btnLink,
        };
        if (index in params.iconsByIndex) {
            icon = {
                img_src: params.iconsByIndex[index].imgSrc,
                btn_link: params.iconsByIndex[index].btnLink,
            };
        }
        return icon;
    });

    console.log('All images ready for update:\n', JSON.stringify(result));
    try {
        await emailTemplatesTable.updateEntry(result);
        return Utils.createResponse(RESPONSE_OK, {});
    } catch (err) {
        const errorBody = Utils.createErrorBody(DYNAMO_DB_ERROR,
            'Failed to save icons information to DynamoDB');
        const errResponse = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
        throw errResponse;
    }
};
