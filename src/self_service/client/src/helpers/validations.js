import * as FileType from '../constants/files';
import { LOCALIZED_FIELDS_MAX_CHARS } from '../constants/forms';
import { ValidationRules } from 'react-form-validator-core';
import * as csv from "csvtojson";
/**
 * Determines is file of required file type
 * @param {Object} file - object reference to file
 * @param {string} fileType - provided expected type of file
 */
export const validateFileType = (file, fileType) => {
    let allowedMimeTypes = [];
    if (!file) {
        return true;
    }
    switch (fileType) {
        case FileType.CSV_FILE:
            allowedMimeTypes = ["", "text/plain", "text/x-csv", "text/csv", "application/vnd.ms-excel", "application/csv", "application/x-csv", "text/comma-separated-values", "text/x-comma-separated-values", "text/tab-separated-values"];
            return allowedMimeTypes.includes(file.type);
        case FileType.IMAGE_FILE:
            allowedMimeTypes = ["image/jpeg", "image/png", 'image/svg+xml'];
            return allowedMimeTypes.includes(file.type);
        case FileType.ZIP_FILE:
            allowedMimeTypes = ["application/zip"];
            return allowedMimeTypes.includes(file.type);
        default:
            return false;
    }
};

export const validateImageDimensions = (file, width = 16, height = 16) => new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = function () {
        URL.revokeObjectURL(objectUrl);
        resolve(width === this.width && height === this.height);
    };
    img.src = objectUrl;
});

/**
 * Delete all whitespaces in name of file
 * @param {Object} fileName - string reference to name of file
 */
export const removeAllWhitespaceInFileName = (fileName) => {
    return fileName.replace(/\s/g, '');
};

export const evaluateTimestampsInVoucherFile = (lines, configurationParametersStartDate) => {
    let currentDate = Date.now();
    for (let i = 1; i < lines.length; i++) {
        let currentLine = lines[i].split(";");
        if (((Number(currentLine[2]) < currentDate)) || ((Number(currentLine[2]) < configurationParametersStartDate))) {
            return false
        };
    }
    return true
};

/**
 * Determines is digital codes csv content in proper format.
 * @param {string} content - file content, read from another context
 */
export const validateDigitalCodesCsvFile = (content, configurationParametersStartDate) => {
    try {
        const lines = content.split("\n");
        if (lines.length < 2) {
            return false;
        }
        const header = lines[0].trim();
        if (!evaluateTimestampsInVoucherFile(lines, configurationParametersStartDate)) {
            return false;
        }
        const delimitersList = [',', ';', '|', '$', '"'];
        let delimiter = null;
        for (let expectedDelimiter of delimitersList) {
            if (header.indexOf(expectedDelimiter) !== -1) {
                delimiter = expectedDelimiter;
                break;
            }
        }
        const columns = header.split(delimiter);
        const requiredColumns = ["experience", "voucher", "expiryDate"];
        if (columns.length !== requiredColumns.length) {
            return false;
        }
        for (let requiredColumn of requiredColumns) {
            if (!columns.includes(requiredColumn)) {
                return false;
            }
        }
        return true;
    } catch (error) {
        console.log("Digital codes csv - validation error:", error);
        return false;
    }
};

/**
 * Returns maximum allowed content length for prize form localized fields
 * @param {string} field
 */
export const getMaxCharactersAllowed = field => {
    switch (field) {
        case "name":
            return LOCALIZED_FIELDS_MAX_CHARS.name
        case "desc":
            return LOCALIZED_FIELDS_MAX_CHARS.desc;
        case "shortDesc":
            return LOCALIZED_FIELDS_MAX_CHARS.shortDesc;
        case "redeemDesc":
            return LOCALIZED_FIELDS_MAX_CHARS.redeemDesc;
        default:
            return 100;
    }
};

/**
 * Check if URL is valid, including protocol and other domain rules
 * @param {string} url
 */
export const validateUrl = url => {
    const regexQuery = new RegExp("http(s)?:\/\/([\\w@]?[\\w-.:@]+)+\\.[\\w\\.?=%&=\\-@/$,]*");
    return regexQuery.test(url);
};

const colonOrQuestionMarkRegex = /[:\?]/g;

const isEmailPrefixValid = prefix => ValidationRules.isEmpty(prefix) || prefix === "mailto";
const isEmailValid = email => !ValidationRules.isEmpty(email) && ValidationRules.isEmail(email);

/**
 * Check if email link is valid, including protocol and other domain rules
 * @param {string} emailLink
 * @returns {boolean} true or false
 */
export const isEmailLinkValid = emailLink => {
    if (emailLink.includes(":")) {
        const [prefix, email] = emailLink.split(colonOrQuestionMarkRegex);
        return isEmailPrefixValid(prefix) && isEmailValid(email);
    }

    return isEmailValid(emailLink);
};

/**
 * Determines is winning moments csv content in proper format.
 * @param {string} content - file content, read from another context
 */
export const validateWinningMomentsCsvFile = content => {
    try {
        const lines = content.split("\n");
        if (lines.length < 2) {
            return false;
        }
        const header = lines[0].trim();
        const delimitersList = [',', ';', '|', '$', '"'];
        let delimiter = null;
        for (let expectedDelimiter of delimitersList) {
            if (header.indexOf(expectedDelimiter) != -1) {
                delimiter = expectedDelimiter;
                break;
            }
        }
        const columns = header.split(delimiter);
        const requiredColumns = ["gmtStart", "prizeId", "tier"];
        if (columns.length !== requiredColumns.length) {
            return false;
        }
        for (let requiredColumn of requiredColumns) {
            if (!columns.includes(requiredColumn)) {
                return false;
            }
        }
        return true;
    } catch (error) {
        console.log("Winning moments csv - validation error:", error);
        return false;
    }
};

export const validatePrizeCsvFile = async (content, pathname) => {

    let iwHeader = true;
    let cgHeader = true;

    try {
        let requiredColumns = ['language', 'name', 'shortDesc', 'desc', 'redeemDesc', 'tier', 'redemptionLink', 'imgUrl',
            'poolPrize', 'priority', 'active', 'deliveryType', 'voucherDist', 'validityPeriodAfterClaim',
            'totalAmount', 'totalAvailable', 'barcodeType', 'tags', 'winningLimit',
        ]

        const requiredColumnsCG = [
            'language', 'name', 'shortDesc', 'desc', 'redeemDesc', 'tier', 'redemptionLink', 'imgUrl',
            'redemptionLimit', 'priority', 'active', 'deliveryType', 'voucherDist', 'validityPeriodAfterClaim',
            'totalAmount', 'totalAvailable', 'barcodeType', 'amount', 'currencyId', 'tags',
        ]

        if (pathname === '/bulkPrizes/edit') {
            requiredColumns = ["prizeId", "language", "name", "shortDesc", "desc", "redeemDesc"];
        }

        const excludeColumns = ['tier', 'redemptionLimit', 'barcodeType', 'tags', 'validityPeriodAfterClaim', 'totalAmount', 'totalAvailable', 'winningLimit' ];

        let parsedLines = 0;
        const missingVals = [];

        const lines = await csv({
            output: 'json',
            delimiter: 'auto',
        }).on('header', (header) => {
            let missingColumn
            for (let requiredColumn of requiredColumns) {
                if (!header.includes(requiredColumn)) {
                    missingColumn = requiredColumn;
                    iwHeader = false
                }}

            if (!iwHeader) {
                requiredColumns = [...requiredColumnsCG];
                for (let requiredColumn of requiredColumnsCG) {
                    if (!header.includes(requiredColumn)) {
                        if(!missingColumn) { missingColumn = requiredColumn }
                        cgHeader = false
                    }}
                }

            if (!iwHeader && !cgHeader) {
                throw new Error(`Missing required column ${missingColumn}`);
            }
        }).on('error', (err) => {
            throw err;
        }).fromString(content).subscribe((json) => {
            parsedLines += 1;

            const emptyCols = {
                line: parsedLines,
                cols: [],
            };
            Object.keys(json).forEach((key) => {
                if (!excludeColumns.includes(key)
                    && requiredColumns.includes(key)
                    && (json[key] === '' || json[key] === '\r')
                ) {
                    emptyCols.cols.push(key);
                }
            });

            if (json['voucherDist'].toUpperCase() === 'FALSE' && (json['totalAmount'] === '' || json['totalAvailable'] === '')) {
                throw new Error('If prize does not require vouchers, totalAmount and totalAvailable cannot be empty');
            }

            if (emptyCols.cols.length) {
                missingVals.push(emptyCols);
            }
        });

        if (missingVals.length) {
            throw new Error(`This values should't be empty ${JSON.stringify(missingVals)}`);
        }

        if (!lines.length) {
            throw new Error('The CSV is empty');
        }

        return true;

    } catch (error) {
        console.log("Prize CSV Template validation error - an empty value is present in the Bulk Upload file.", error);
        return false;
    }
};
