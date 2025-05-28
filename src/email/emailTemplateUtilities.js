const { mainQuery } = require('../database/emailTemplatesTable');
const { validateImageType, prepareBase64ImageToUpload } = require('../utility_functions/utilityFunctions');
const { deleteFileFromS3, uploadFile } = require('../utility_functions/aws_sdk_utils/s3Utilities');
const { EMAIL_TEMPLATE_IMAGE_FOLDER_NAME } = require('../constants/common');

/**
 * Checking image files types
 * @param {Object} params - {headerImage, icons}
 */
const checkImageFilesTypes = (params) => {
    let isValid = false;
    const imagesToCheck = params.icons ? [...params.icons] : [];
    if (params.headerImage && params.headerImage.file) {
        imagesToCheck.push(params.headerImage);
    }
    for (let index = 0; index < imagesToCheck.length; index++) {
        if (imagesToCheck[index] && !validateImageType(imagesToCheck[index].type)) {
            return false;
        }
        isValid = true;
    }
    return isValid;
};

/**
 * Create S3 upload promise
 * @param {Object} params - {file, path, type}
 */
const createS3UploadPromise = (params) => {
    const file = prepareBase64ImageToUpload(params.file);
    const emailTemplateImageParams = {
        Bucket: process.env.PUBLIC_BUCKET,
        Key: params.path,
        Body: file,
        ContentEncoding: 'base64',
        ContentType: params.type,
        ACL: 'public-read',
    };

    return uploadFile(emailTemplateImageParams);
};

/**
 * Extract single object from DB response
 * @param {String} templateId
 */
const getMetadata = async (templateId) => {
    try {
        const queryResult = await mainQuery(templateId);
        return Promise.resolve(queryResult[0]);
    } catch (err) {
        return Promise.reject(err);
    }
};

/**
 * Extract file key from file location
 * @param {String} fileLocation
 */
const extractFileKey = (fileLocation) => {
    const index = fileLocation.indexOf(EMAIL_TEMPLATE_IMAGE_FOLDER_NAME);

    return fileLocation.substr(index);
};

/**
 * Create S3 delete promise
 * @param {Array} keys
 */
const createS3DeletePromise = (keys) => {
    const emailTemplateImageParams = {
        Bucket: process.env.PUBLIC_BUCKET,
        Delete: {
            Objects: keys,
            Quiet: false,
        },
    };
    return deleteFileFromS3(emailTemplateImageParams, true);
};

/**
 * Prepare images for update and delete
 * @param {Object} params - {headerImage, icons, templateId}
 */
const prepareUpdateImages = (params) => {
    const imagesForDelete = {
        iconsByIndex: {},
        allIcons: [...params.icons],
        icons: [],
        templateId: params.templateId,
        iconsForDelete: [],
    };

    if (params.headerImage && params.headerImage.file && params.headerImage.headerImagePath) {
        imagesForDelete.headerImage = params.headerImage;
    }
    if (params.icons) {
        params.icons.forEach((icon, index) => {
            if (icon.file && icon.imgSrc && icon.btnLink) {
                imagesForDelete.iconsForDelete[index] = icon;
            }
            if (icon.file && icon.btnLink) {
                imagesForDelete.iconsByIndex[index] = icon;
                imagesForDelete.icons[index] = icon;
            }
        });
    }
    console.log('Updated images for delete:\n', JSON.stringify(imagesForDelete));
    return imagesForDelete;
};

module.exports = {
    checkImageFilesTypes,
    createS3UploadPromise,
    getMetadata,
    extractFileKey,
    createS3DeletePromise,
    prepareUpdateImages,
};
