const bwipjs = require('bwip-js');
const { getObjectKeyByValue } = require('./utilityFunctions');
const { PARAMS_MAP, BARCODE_TYPE } = require('../constants/common');
const { uploadFile } = require('./aws_sdk_utils/s3Utilities');

/**
 * Validate BarCodeType
 * @param params - must be valid integer in BarCodeType parameters
 * @returns {Promise<any>}
 */
const validateParams = (params) => {
    params.barcodeType = getObjectKeyByValue(BARCODE_TYPE, params.barcodeType);

    if (!params.barcodeType) { // barcodeType could be 0 (which means that we shouldn't generate barcode) or undefined
        return Promise.reject(new Error(`MissingParameters: ${PARAMS_MAP.BARCODE_TYPE}`));
    }
    if (!params.fileName) {
        return Promise.reject(new Error(`MissingParameters: ${PARAMS_MAP.FILE_NAME}`));
    }
    if (!params.barcodeText) {
        return Promise.reject(new Error(`MissingParameters: ${PARAMS_MAP.BARCODE_TEXT}`));
    }

    return Promise.resolve(params);
};

/**
 * Generate the QR code or Barcode
 * @param params - provided params from event
 * @returns {Promise<any>}
 */
const generateBarcode = (params) => new Promise((resolve, reject) => {
    bwipjs.toBuffer({
        bcid: params.barcodeType, // Barcode type
        text: params.barcodeText, // Text to encode
        scale: 4, // 3x scaling factor
        includetext: true, // Show human-readable text
        textxalign: 'center', // Always good to set this
    }, (err, png) => {
        if (err) {
            return reject(err); // `err` may be a string or Error object
        }
        // `png` is a Buffer
        // png.length           : PNG file length
        // png.readUInt32BE(16) : PNG image width
        // png.readUInt32BE(20) : PNG image height
        return resolve(png);
    });
});

/**
 * Save barcode image to S3
 * @param fileName - provided filename
 * @param barcodeImage - provided barcode image
 * @returns {Promise<any>}
 */
const saveBarcodeImageToS3 = async (fileName, barcodeImage) => {
    const barcodeImageFileParams = {
        Bucket: process.env.PUBLIC_BUCKET,
        Key: fileName,
        Body: barcodeImage,
        ContentType: 'image/png',
        ACL: 'public-read',
    };

    const data = await uploadFile(barcodeImageFileParams);
    console.log('Barcode image saved to S3 bucket:\n', JSON.stringify(data));
    const barcodeUrl = process.env.cloudFrontPublicUri !== 'undefined'
        ? `${process.env.cloudFrontPublicUri}/${encodeURIComponent(data.Key)}`
        : data.Location;
    return barcodeUrl;
};

/**
 * Create QR or Barcode.
 * @param {Object} params parameters for generating the QR/Barcode
 * @param {number} params.barcodeType description
 * @param {string} params.barcodeText description
 * @param {string} params.fileName description
 * @returns {Promise<any>}
 */
const createQRcodeOrBarcode = async (params) => {
    console.log('QRcode/Barcode create params:\n', JSON.stringify(params));

    try {
        const parameters = await validateParams(params);
        const barcodeImage = await generateBarcode(parameters);
        const barcodeURL = await saveBarcodeImageToS3(params.fileName, barcodeImage);
        return Promise.resolve(barcodeURL);
    } catch (err) {
        console.error('ERROR: Failed to create QRcode/Barcode:\n', err);
        return Promise.resolve(null);
    }
};

module.exports = {
    createQRcodeOrBarcode,
    generateBarcode,
    validateParams,
};
