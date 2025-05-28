// TODO File is getting huge, consider splitting this file into smaller utility groups.
// (I.E. responseUtilities, validationUtilities, S3Utilities etc.)

const striptags = require('striptags');
const snakeCase = require('lodash.snakecase');
const Messages = require('@the-coca-cola-company/ngps-global-common-messages');
const { Parser } = require('json2csv');
const aws4 = require('aws4');
const {
    getConfigurationParameter,
    getFlowLabel,
    getFlowParameter,
    getCurrencyValidity,
} = require('../self_service/configurationUtils');
const { ERROR_CODES, ERR_CODES } = require('../constants/errCodes');
const {
    RESPONSE_OK,
    RESPONSE_BAD_REQUEST,
    RESPONSE_FORBIDDEN,
    RESPONSE_INTERNAL_ERROR,
    RESPONSE_NOT_FOUND,
} = require('../constants/responses');
const { PATTERNS, PARAMS_MAP, PLUGIN_SPECIFIC_KEYS } = require('../constants/common');
const { QUERY_LAMBDAS, CONFIGURATION_FUNCTIONS_MAP } = require('../constants/lambdas');

const CONCATENATION_SEPARATOR = '|';
const CONF_FILE_NAME = 'conf.txt';
const ALLOWED_IMAGE_FILES_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/bmp'];

/**
 * Transforms stringified JSON body into JSON object body.
 */
const parseBody = (response) => {
    const resType = response && response.body && typeof response.body;

    if (resType === 'string') {
        return JSON.parse(response.body);
    }

    if (resType === 'object') {
        return response.body;
    }

    return {};
};

/**
 * Creates a response based on responseType (RESPONSE_OK, RESPONSE_INTERNAL_ERROR etc.) and a response body.
 */
const createResponse = (responseType, body) => {
    // trick to make a json copy
    const result = JSON.parse(JSON.stringify(responseType));
    let responseBody;
    // stringify the body, or do nothing in body isn't a JSON object
    if (body instanceof Object) {
        responseBody = JSON.stringify(body);
    } else {
        responseBody = body;
    }
    result.body = responseBody;
    return result;
};

const shouldEnterCoreLogicCheck = (event) => {
    if (event.pluginError) {
        console.error('Plugin error detected:', event.pluginError);
        return createResponse(RESPONSE_INTERNAL_ERROR, {
            message: event.pluginError.message || 'An error occurred in the plugin.',
            pluginOutput: event.pluginError || 'An error occurred in the plugin.',
        });
    }

    if (event?.pluginOutput && event?.permitIntoCoreLogic === 'block') {
        return createResponse(RESPONSE_OK, {
            message: 'Core logic was blocked by plugin outcome. External service plugin was executed successfully',
            pluginOutput: event.pluginOutput,
        });
    }

    if (event?.permitIntoCoreLogic === 'allow') {
        return null;
    }
};

/**
 * Creates a response body for error responses. This function helps in keeping the same template for all error responses,
 * which will make error handling easier for the client.
 *
 * @deprecated use {@link createErrBody}.
 */
// TODO remove this function after full refactor for new err codes is done
const createErrorBody = (errorCode, message, errorDetails) => {
    const errorBody = {
        message,
        errorCode,
    };
    // error details are optional
    if (errorDetails) {
        errorBody.errorDetails = errorDetails;
    }
    return errorBody;
};

/**
 * Creates error response containing both {@param errCode} and {@param errorCode} (for backwards compatibility reasons)
 *
 * @param {number} errCode - 5 digits error code uniquely defining error (new error code)
 * @param {String} message - error message
 * @param {Object} errorDetails - Additional error details/attributes
 * @param {number} errorCode - Traditional error codes (kept for backwards compatibility reasons)
 *
 * @returns {Object} HTTP error response object
 */
// TODO remove parameter 'errorCode' once all clients adopt new 'errCode"
const createErrBody = (errCode, message, errorDetails, errorCode) => {
    const errorBody = {
        message,
        errCode,
        errorCode,
    };
    // error details are optional
    if (errorDetails) {
        errorBody.errorDetails = errorDetails;
    }
    return errorBody;
};

/**
 * Creates error response for invalid JSON request
 *
 * @returns {Object} - Returns error response JSON object
 */
const createResponseBadJsonRequest = () => {
    const errorBody = createErrorBody(ERROR_CODES.INVALID_JSON_REQUEST, 'Invalid JSON format');
    return createResponse(RESPONSE_BAD_REQUEST, errorBody);
};

/**
 * Creates error response for invalid custom status
 *
 * @returns {Object} - Returns error response JSON object
 */
const createResponseInvalidVoucherStatus = (invalidStatus) => {
    const errorBody = createErrBody(ERROR_CODES.INVALID_VOUCHER_STATUS, `${invalidStatus}: is not a valid status! Please check the value and try again.`);
    return createResponse(RESPONSE_BAD_REQUEST, errorBody);
};

/**
 * Creates error response for scenario where configuration is not properly created.
 */
const createResponseBadConfiguration = () => {
    const errorBody = createErrorBody(ERROR_CODES.CONFIGURATION_ERROR, 'Configuration error');
    return createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
};

/**
 * Creates error response for scenario where configuration is not properly created.
 */
const createResponseEmptyWallet = () => {
    const errorBody = createErrorBody(ERR_CODES.WALLET_IS_EMPTY, 'Wallet is empty or non-existent');
    return createResponse(RESPONSE_BAD_REQUEST, errorBody);
};

/**
 * Creates error response for missing parameters.
 */
const createResponseMissingParameters = (missingParameters) => {
    const errorBody = createErrBody(ERR_CODES.MISSING_REQUEST_PARAMETERS, Messages.COMMON_ERR.MISSING_REQUEST_PARAMETERS,
        { missingParameters }, ERROR_CODES.REQUEST_PARAMETER_MISSING);
    return createResponse(RESPONSE_BAD_REQUEST, errorBody);
};

/**
 * Creates error response for unexpected error
 */
const createResponseUnknownError = () => {
    const errorBody = createErrorBody(ERROR_CODES.UNKNOWN_ERROR, Messages.COMMON_ERR.INTERNAL_SERVER_ERROR);
    return createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
};

/**
 * Creates error response for invalid parameters.
 * @param invalidParams
 * @returns {any}
 */
const createResponseInvalidParameter = (invalidParams) => {
    const errorBody = createErrBody(ERR_CODES.INVALID_REQUEST_PARAMETERS, Messages.COMMON_ERR.INVALID_REQUEST_PARAMETERS,
        { invalidParameters: invalidParams }, ERROR_CODES.INVALID_PARAMETER);
    return createResponse(RESPONSE_BAD_REQUEST, errorBody);
};

/**
 * Creates error response for insufficient currencies on purchase.
 *
 * @param {Array<string>} failedCurrencies - currencies that are missing
 * @returns {Object} HTTP error response
 */
const createResponseInsufficientCurrencies = (failedCurrencies, prize, statusCode) => {
    if (statusCode === '200' && prize?.prize_id) {
        return createResponse(RESPONSE_OK, {
            message: Messages.IW_ERR.NOT_ENOUGH_CURRENCIES,
            items: prize.prize_id,
        });
    }

    const errorBody = createErrorBody(ERROR_CODES.CHECKER_LAMBDA_REJECTION, Messages.IW_ERR.NOT_ENOUGH_CURRENCIES,
        { missingCurrencies: failedCurrencies });
    return createResponse(RESPONSE_FORBIDDEN, errorBody);
};

/**
 * Creates HTTP error response for non existing voucher.
 *
 * @param {String} voucherCode - voucher code that was attempted to be found
 *
 * @returns {Object} HTTP error response with status 404.
 */
const createResponseVoucherNotFound = (voucherCode) => {
    const errorBody = createErrorBody(ERROR_CODES.FLOW_LAMBDA_REJECTION, 'No voucher matching the criteria', { voucher: voucherCode });
    return createResponse(RESPONSE_NOT_FOUND, errorBody);
};

/**
 * Creates HTTP error (400) response for bad attempt to redeem a voucher.
 *
 * @param {String} prizeId - prize who's voucher was attempted to be redeemed
 * @param {String} voucher - voucher code that was attempted to be redeemed
 *
 * @returns {Object} HTTP error response with status 400.
 */
const createResponseCantRedeemVoucher = (prizeId, voucher) => {
    const errorBody = createErrorBody(ERROR_CODES.FLOW_LAMBDA_REJECTION,
        "Voucher doesn't exist, or not in redeemable state", { prizeId, voucher });
    return createResponse(RESPONSE_BAD_REQUEST, errorBody);
};

/**
 * Creates HTTP error response for non existing prize.
 *
 * @param {String} prizeId - prize id that was attempted to be found
 *
 * @returns {Object} HTTP error response with status 404.
 */
const createResponsePrizeNotFound = (prizeId, configurationId) => {
    const errorBody = createErrorBody(ERROR_CODES.FLOW_LAMBDA_REJECTION, 'No prize matching the criteria', { prize: prizeId, configuration: configurationId });
    return createResponse(RESPONSE_NOT_FOUND, errorBody);
};

/**
 * Creates error response for user is deleted.
 *
 * @param userId {string} Users's userId
 * @returns {Object} Error JSON response
 */
const createResponseUserDeleted = (userId) => {
    const errorBody = createErrorBody(ERROR_CODES.FLOW_LAMBDA_REJECTION,
        'User is deleted', { userId });
    return createResponse(RESPONSE_FORBIDDEN, errorBody);
};

/**
 * Checks if provided string is in camel case.
 */
const isCamelCase = (string) => {
    const camelMatcherRegex = /^([a-z])+([a-zA-Z0-9])*$/g;
    const regexResult = camelMatcherRegex.exec(string);
    return !!(regexResult && regexResult.length);
};

/**
 * Transforms into snake case only if string is originally in camel case.
 */
const camelToSnake = (string) => (isCamelCase(string) ? snakeCase(string) : string);

/**
 * Converts snake case string to camel case.
 */
const snakeToCamel = (snakeString) => snakeString.replace(/(_\w)/g, (match) => match[1].toUpperCase());

/**
 * Transforms object's attribute keys. Mostly used for conversion from camel case to snake case and vice versa.
 */
const transformKeys = (object, caseConverterFunction) => {
    let result;
    // Initialize as array or object, depending on type of passed parameter
    if (Array.isArray(object)) {
        result = [];
    } else if (typeof object === 'object') {
        result = {};
    } else {
        return undefined;
    }
    const keysToSkip = [...PLUGIN_SPECIFIC_KEYS];
    // eslint-disable-next-line no-restricted-syntax
    for (const key in object) {
        if (keysToSkip.includes(key)) {
            result[key] = object[key];
        } else if (Object.prototype.hasOwnProperty.call(object, key)) {
            const transformedKey = caseConverterFunction(`${key}`);
            if (object[key] && (typeof object[key] === 'object' || Array.isArray(object[key]))) {
                result[transformedKey] = transformKeys(object[key], caseConverterFunction);
            } else {
                result[transformedKey] = object[key];
            }
        }
    }
    return result;
};

/**
 * Creates error response for trying to redeem prize that doesn't have enough vouchers.
 *
 * @param {String} prizeId - ID of prize that was unavailable for redeemed
 * @param {String} counterName - name of the column that is not having enough count
 * @param {Number} counterValue - value in {@param counterName} column
 *
 * @returns {Object} HTTP error response
 */
const createResponseNotEnoughPrizes = (prizeId, counterName, counterValue) => {
    const errorDetails = {};
    errorDetails[PARAMS_MAP.PRIZE_ID] = prizeId;
    if (counterName) {
        errorDetails[snakeToCamel(counterName)] = counterValue;
    }
    const errorBody = createErrBody(ERR_CODES.IW_PRIZE_REDEEM_FAILED,
        Messages.IW_ERR.NOT_ENOUGH_PRIZES + prizeId, errorDetails, ERROR_CODES.CHECKER_LAMBDA_REJECTION);
    return createResponse(RESPONSE_BAD_REQUEST, errorBody);
};

/**
 * Creates error response for case when prize redeem failed to be completed.
 *
 * @param {String} prizeId - ID of prize that was unavailable for redeemed
 *
 * @returns {Promise} HTTP error response.
 */
const createResponseCantRedeemPrize = (prizeId) => {
    const errorBody = createErrorBody(ERROR_CODES.FLOW_LAMBDA_REJECTION,
        Messages.IW_ERR.NOT_AVAILABLE_FOR_REDEEM, { invalidPrizeId: prizeId });
    return createResponse(RESPONSE_BAD_REQUEST, errorBody);
};

/**
 * Creates error response for case when all vouchers available are expired
 *
 * @param {String} prizeId - ID of prize that was unavailable for redeemed
 *
 * @returns {Promise} HTTP error response.
 */
const createResponseVoucherExpired = (prizeId) => {
    const errorBody = createErrorBody(ERROR_CODES.FLOW_LAMBDA_REJECTION,
        Messages.IW_ERR.VOUCHER_EXPIRED, { invalidPrizeId: prizeId });
    return createResponse(RESPONSE_BAD_REQUEST, errorBody);
};

/**
 * Setter for attribute 'body'. Usually used for creation of lambda response.
 */
const setBody = (body, response) => {
    response.body = JSON.stringify(body);
};

/**
 * Adds all attributes from parameterObject into resultObject.
 * If both objects have attribute with the same name, result object will update that value.
 */
const mergeObjectParams = (resultObject, parameterObject) => {
    const obj = !resultObject ? {} : { ...resultObject };

    Object.keys(parameterObject).reduce((acc, key) => {
        acc[key] = parameterObject[key];
        return acc;
    }, obj);

    return obj;
};

/**
 * Function that merges responses from two different lambdas into one. If any response is representing an error response,
 * only that response will be returned. This function serves as a helper for iteratively creating final response in
 * lambda chain execution.
 */
const mergeResponses = (response, otherResponse) => {
    console.log('Merging responses...');

    if (response.isBase64Encoded) {
        return response;
    }

    if (otherResponse.isBase64Encoded) {
        return otherResponse;
    }

    if (!otherResponse) {
        return response;
    }
    if (!response) {
        return otherResponse;
    }
    if (parseInt(response.statusCode) !== 200) {
        return response;
    }
    if (parseInt(otherResponse.statusCode) !== 200) {
        return otherResponse;
    }

    let mergedBody = {};
    mergedBody = mergeObjectParams(mergedBody, parseBody(response));
    mergedBody = mergeObjectParams(mergedBody, parseBody(otherResponse));
    return createResponse(RESPONSE_OK, mergedBody);
};

/**
 * Extract Post Parameters
 * @param event
 * @returns {any}
 */
const extractPostParams = (event) => (typeof event.body === 'string' ? JSON.parse(event.body) : event.body);

/**
 * Extract Get Parameters
 * @param event
 */
const extractGetParams = (event) => event.queryStringParameters;

/**
 * Returns tracing ID from event object .
 *
 * @param {Object} event
 *
 * @returns {String}
 */
const getTracingId = (event) => {
    const tracingId = (event.requestContext && event.requestContext.requestId) ? event.requestContext.requestId : 'not existent';
    return tracingId;
};

/**
 * Extract's query string or request body from an event.
 */
const extractParams = (event) => {
    let params;
    if (event.body) {
        params = extractPostParams(event);
    } else if (event.queryStringParameters) {
        params = extractGetParams(event);
    } else {
        params = {};
    }
    console.log(`Tracing ID: ${getTracingId(event)}`);
    return params;
};

/**
 * Extracts request params from Lambda event and handles JSON parse exception
 *
 * @param {Object} event - Lambda event
 * @return {Promise<never>|Promise<any>} - Returns Promise with extracted params or reject Promise in case of an exception
 */
const safeExtractParams = (event) => {
    try {
        const params = extractParams(event);
        return Promise.resolve(params);
    } catch (error) {
        console.error('ERROR: Failed to extract request params:\n', error);
        return Promise.reject(createResponseBadJsonRequest());
    }
};

/**
 * Creates and returns copy of JSON object.
 */
const copyFrom = (object) => JSON.parse(JSON.stringify(object));

/**
 * Returns array of strings from passed coma separated string.
 */
const arrayFromString = (params) => params.replace(/\s/g, '').split(',').filter(Boolean);

/**
 * Returns config file path
 */
const getConfigFilePath = (configurationId) => `${configurationId}/${CONF_FILE_NAME}`;
/**
 * Returns requestId from event's object request context
 * @param event
 * @returns {string}
 */
const extractRequestId = (event) => getTracingId(event);

/**
 * Check if mandatory params for a function to run are provided.
 * @param params - provided params from event
 * @param requiredParameters - required parameters
 * @returns {Object}
 */
const checkPassedParameters = (params, requiredParameters) => {
    const missingParameters = requiredParameters && requiredParameters.filter((param) => {
        if (params == null || !Object.prototype.hasOwnProperty.call(params, param)) {
            return true;
        }
        return false;
    });

    if (missingParameters.length <= 0) {
        return;
    }
    const errResponse = createResponseMissingParameters(missingParameters);
    throw errResponse;
};

/**
 * Check for empty string in params
 * @param params - provided params from event
 * @returns {Promise<any>}
 */
const checkForEmptyStringInParameters = (params) => {
    const emptyParameters = Object.keys(params).filter((param) => params[param] === '');

    if (emptyParameters.length) {
        throw createResponseInvalidParameter(emptyParameters);
    }
    return undefined;
};

/**
 * If parameter is missing, sets the default value from configuration flow. Parameters in flow and REST API
 * MUST be named the same, or this function can't be reused.
 *
 * @param {Object} params - REST API parameters (received by Lambda)
 * @param {String} paramName - parameter name
 * @param {Object} config - configuration object
 * @returns {Object} updated params
 */
const setupParameter = (params, paramName, config) => {
    if (Object.prototype.hasOwnProperty.call(params, paramName)) {
        // early exit, parameter is already provided.
        return params;
    }

    console.log(`setting up paramter: ${paramName}`);
    const flowLabelJson = getFlowLabel(config, params[PARAMS_MAP.FLOW_LABEL]);
    params[paramName] = getFlowParameter(flowLabelJson, paramName);
    return params;
};

/**
 * Utility method used for merging two columns into one. Used when uniqueness of a row is defined by more than 2 columns.
 */
const concatenateColumnValues = (...column) => `${column.join(CONCATENATION_SEPARATOR)}`;

/**
 * Inverse function for concatenateColumnValues.
 */
const splitColumnValues = (value) => value.split(CONCATENATION_SEPARATOR);

const extractFileExtension = (fileName) => {
    const fileExtensionRegex = /(?:\.([^.]+))?$/;
    return fileExtensionRegex.exec(fileName)[1];
};

/**
 * Convert from Rich to Plain text
 * @param {String} richText
 * @returns {void | string | *}
 */
const convertToPlain = (richText) => {
    if (!richText) {
        return '';
    }

    const plainText = striptags(richText);
    const htmlEntities = {
        '&nbsp;': ' ',
        '&lt;': '<',
        '&gt;': '>',
        '&amp;': '&',
        '&quot;': '"',
        '&apos;': '\'',
        '&cent;': '¢',
        '&pound;': '£',
        '&yen;': '¥;',
        '&euro;': '€',
        '&copy;': '©',
        '&reg;': '®',
        '&trade;': '™',
    };
    const entityRegex = /&[0-9a-zA-Z]{2,7};/gm;
    return (plainText || richText).replace(entityRegex, (match) => htmlEntities[match] || '');
};

/**
 * Converts all object attributes with type of "string" into plain text (from HTML)
 *
 * @param {Object} object - object for conversion
 * @returns {Object} converted object
 */
const convertObjectStringsToPlainText = (object) => {
    if (object == null || Object.keys(object) == null || Object.keys(object).length <= 0) {
        return object;
    }

    if (typeof object === 'string') {
        return convertToPlain(object);
    }

    Object.keys(object).forEach((key) => {
        if (typeof object[key] === 'string') {
            object[key] = convertToPlain(object[key]);
            if (object[key] === '') {
                object[key] = undefined;
            }
        } else if (typeof object[key] === 'object') {
            object[key] = convertObjectStringsToPlainText(object[key]);
        }
    });

    return object;
};

/**
 * Returns a deep copy of passed object/array with camel case keys.
 * This function is created because none of libraries covers all cases GPP has.
 */
const copyAsCamelCase = (snakeObject) => transformKeys(snakeObject, snakeToCamel);

/**
 * Returns a deep copy of passed object/array with snake case keys.
 * This function is created because none of libraries covers all cases GPP has.
 */
const copyAsSnakeCase = (camelObject) => transformKeys(camelObject, camelToSnake);

/**
 * Exports data to csv format
 * @param {Object} params - The params for json to csv parser
 * @param {Array} params.data - the data which will be used for generating the csv
 * @param {Array} params.fields - csv fields (columns)
 * @param {String} params.quote - Character(s) to use a quote mark
 * @param {String} params.doubleQuote - Character(s) to use as a escaped quote.
 * @param {String} params.delimiter - Character to be used as delimiter which will override the default(,).
 * @param {Array} params.transformer - Optional array of parses transformers.
 * @param {Boolean} params.header - Optional boolean indicates whether to include headers.
 * @returns {Promise} - generated csv
 */
const exportToCSV = (params) => {
    console.log('Export result to csv file...');

    const {
        data, fields, quote = '', doubleQuote = '', delimiter = ',', transformer = [], header,
    } = params;

    if (!data || !fields) {
        const errorBody = createErrorBody(
            ERROR_CODES.REQUEST_PARAMETER_MISSING,
            'Export to CSV can not be done due to missing required parameters',
        );

        return Promise.reject(createResponse(RESPONSE_BAD_REQUEST, errorBody));
    }

    const json2csvParser = new Parser({
        fields, header: header !== false, quote, doubleQuote, delimiter, transforms: transformer,
    });
    const csv = json2csvParser.parse(data);

    return Promise.resolve(csv);
};

/**
 * Checks if 'value' is an object
 */
const isObject = (value) => value != null && value === Object(value);

/**
 * Returns object key by its value
 * @param object
 * @param value - required value in object
 * @returns {(string | undefined)}
 */
const getObjectKeyByValue = (object, value) => Object.keys(object).find((key) => object[key] === value);

/**
 * Determines is image of required file type
 * @param {String} fileType
 */
const validateImageType = (fileType) => ALLOWED_IMAGE_FILES_TYPES.includes(fileType);

/**
 * Checks if {@param value} is string that contains characters other than white spaces
 *
 * @param {*} value - value that is checked
 *
 * @returns {Boolean} true if value satisfies the condition, false otherwise
 */
const isValidString = (value) => typeof value === 'string' && value.trim().length > 0;

/**
 * Gets array of invalid string values. Invalid string will be considered any non-string value, or empty string.
 *
 * @param {Object} params - parameters received via Lambda event
 * @param {Array<String>} stringAttributes - array of attributes that should have valid string value.
 *
 * @returns {Array<String>} array of invalid strings.
 */
const getInvalidStringParameters = (params, stringAttributes) => {
    const invalidParams = [];
    stringAttributes.forEach((attribute) => {
        if (!isValidString(params[attribute])) {
            invalidParams.push(attribute);
        }
    });
    return invalidParams;
};

/**
 * Prepare base64 image for converting before upload to S3
 * @param {String} file
 */
const prepareBase64ImageToUpload = (file) => Buffer.from(file.replace(/^data:image\/\w+;base64,/, ''), 'base64');

/**
 * Checks if response is valid http response
 * Checks if response is empty object
 * Checks if response has property statusCode
 * Checks if response has property headers
 */
const isValidHttpResponse = (response) => Object.entries(response).length !== 0 && !!response.statusCode && !!response.headers;

/**
 * Checks if response is valid
 * If the response is valid return response
 * If the response is not valid return response with status code 500, message "internal server error" and unknown error 9
 */
const checkReceivedResponse = (response) => {
    if (isValidHttpResponse(response)) {
        return response;
    }
    return createResponseUnknownError();
};

const randomInRange = (min, max) => Math.random() * (max - min) + min;

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));

/**
 * Checks if json contains a value (on a first level attributes)
 *
 * @param {Object} json - object to check
 * @param {*} value - value that we search for
 * @returns {Boolean} true if value exists, false if it doesn't
 */
const checkForJsonValue = (json, value) => {
    if (!json) {
        console.log('finished the check');
        return false;
    }
    // eslint-disable-next-line no-restricted-syntax
    for (const key in json) {
        if (json[key] === value) {
            console.log('finished the check');
            return true;
        }
    }
    console.log('finished the check');
    return false;
};

/**
 * Beautify Raw table column names - e.g. "configuration_id" -> "Configuration Id"
 * @param {Array} columns - raw table column names
 * @returns {Object} raw column name as property of the object and beautified value as value
 * e.g. {configuration_id: "Configuration Id"}
 */
const beautifyColumnNames = (columns) => columns.reduce((accumulator, currentValue) => {
    accumulator[currentValue] = currentValue.split('_').reduce((acc, val) => `${acc + val.charAt(0).toUpperCase() + val.slice(1)} `, '');
    return accumulator;
}, {});

/**
 * Checks the type of user based on Regular Expressions to see if the user
 * is of a valid type. Either email or cid
 * @param userId - the userId passed in from the event.
 * @returns - Type/undefined based on the evaluation of the userId, either email or cid.
 * if userID is invalid then undefined will be returned.
 */
const getSatisfiedUserType = (userId) => {
    // eslint-disable-next-line no-restricted-syntax
    for (const type in PATTERNS) {
        if (Object.prototype.hasOwnProperty.call(PATTERNS, type)) {
            const pattern = PATTERNS[type];
            if (pattern.test(userId)) {
                return type;
            }
        }
    }

    return undefined;
};

/**
 * Checks if value is 0-100 percent.
 *
 * @param {Number} value - percent value
 * @returns {Boolean} true if validation passes, false if fails
 */
const isPercentValue = (value) => typeof value === 'number' && value >= 0 && value <= 100;

/**
 * Creates a full userId with appropriate user type
 *
 * @param {string} userId User's userId
 * @returns {string} Full userId with user type
 */
const createGppUserId = (userId) => {
    const userType = getSatisfiedUserType(userId);
    return userId + (userType ? (`|${userType}`) : '');
};

/**
 * Omits null values from an object
 * @param {object} inputObj Object with null values
 * @returns The object with null values omitted
 */
const omitNullValues = (inputObj) => Object.keys(inputObj).reduce((obj, key) => {
    if (inputObj[key] !== null) {
        obj[key] = inputObj[key];
    }
    return obj;
}, {});

/**
 * It adds the given time( in hours ) to timestamp.
 * @param {Date} date to be decreased
 * @param {Number} time in hours
 * @returns {Number} date timestamp
 */
const hoursToTimestamp = (date, time) => date.getTime() - time * 60 * 60 * 1000;

/**
 * Decrease DateTime by given hours
 * @returns {Number | undefined}
 */
const decreaseDateTimeByHours = (time) => {
    if (Number.isInteger(time)) {
        return hoursToTimestamp(new Date(), time);
    } if (typeof time === 'string') {
        const floatTime = parseFloat(time);
        if (!Number.isNaN(floatTime)) {
            return hoursToTimestamp(new Date(), parseFloat(floatTime));
        }
    }

    return undefined;
};

/**
 * Checks array of parameters for specific format.
 *
 * @param {String} format Native data type
 * @param {Array} params Array of params which we want to check
 * @returns {String} Error message
 */
const checkParamsForSpecificFormat = (format, params = []) => {
    let err;

    for (let i = 0, len = params.length; i < len; i++) {
        // eslint-disable-next-line valid-typeof
        if (typeof params[i] !== format) {
            err = createResponseInvalidParameter(params[i]);
            break;
        }
    }

    return err;
};

/**
 * Checks parameters format. e.g. if we want to check array with numbers the function invokation should look like this
 * checkParametersFormat({number: [1,2,3]}).
 *
 * @param {Object} params - parameters which we want to check
 * @returns {Promise}
 */
const checkParametersFormat = (params = {}) => {
    // eslint-disable-next-line no-restricted-syntax
    for (const format in params) {
        if (Object.prototype.hasOwnProperty.call(params, format)) {
            const err = checkParamsForSpecificFormat(format, params[format]);
            if (err) {
                throw err;
            }
        }
    }

    return undefined;
};

/**
 * Based on {@param validity}, creates validTrhu timestamp. validTrhu timestamp represents curent timestamp + validity,
 * rounded up to 23:00:00 UTC.
 *
 * @param {Number} validity - Validity period, expressed in days
 *
 * @returns {Number | undefined} expiry timestamp, rounded up to 23:00:00, expressed as timestamp.
 * Returns undefined if {@param validity} is not an integer or is a negative value
 */
const createValidThruTimestamp = (validity) => {
    if (!Number.isInteger(validity) || validity < 0) {
        return undefined;
    }
    const currentTime = new Date().getTime();
    const validityInMilliseconds = validity * 24 * 60 * 60 * 1000;
    const expirationTime = currentTime + validityInMilliseconds;
    const validThru = new Date(expirationTime).setUTCHours(23, 59, 59, 0);
    console.log(`calculated validThru: ${validThru}`);
    return validThru;
};

/**
 * Validates received (HTTP body) parameters
 *
 * @param {Object} params - HTTP body parameters
 *
 * @returns {Promise} rejected with HTTP error response, or resolved with {@param params}
 */
const validateParameters = (params) => {
    const invalidParams = getInvalidStringParameters(params, [PARAMS_MAP.USER_ID]);

    if (invalidParams.length > 0) {
        return Promise.reject(createResponseInvalidParameter(invalidParams));
    }
    return Promise.resolve(params);
};

/**
 * Split array in equal sized sub-arrays
 * @param {Array} inputArray - array that will be split
 * @param {Number} subArrayLength - size of the created sub-arrays
 * @returns {Array} array containing sub-arrays
 */
const splitArray = (inputArray, subArrayLength) => {
    const resultArray = [];
    if (inputArray.length < subArrayLength) {
        return [[...inputArray]];
    }
    for (let i = 0; i < inputArray.length; i += subArrayLength) {
        const tempArray = inputArray.slice(i, i + subArrayLength);
        resultArray.push(tempArray);
    }
    return resultArray;
};

/**
 * Picks the timestamp in specified sequence.
 *
 * @param {Number} sequenceStart - timestamp representing start of a sequence
 * @param {Number} sequenceDuration - duration of a sequence.
 * @param {Number} defectPercent - 0-100 value. Lower defect means that timestamp picked will be closer to middle value.
 *                                 0 means middle value, 100 means random value across the full sequence.
 */
const calculateTimestamp = (sequenceStart, sequenceDuration, defectPercent, usedTimestamps = {}) => {
    const sequenceEnd = sequenceStart + sequenceDuration;

    const middlePoint = (sequenceStart + sequenceEnd) / 2; // middle of the sequence

    const offsetRange = sequenceDuration * defectPercent / 100;
    const offset = randomInRange(-offsetRange / 2, offsetRange / 2); // positive or negative offset for the middle point

    const result = Math.round(middlePoint + offset);
    if (usedTimestamps[result] === true) {
        return calculateTimestamp(sequenceStart + 900, sequenceDuration, defectPercent, usedTimestamps);
    }
    return result;
};

/**
 * Checks if instantWin lambda is specified in a flow
 * @param {Object}  configuration - configuration object
 * @returns {Boolean}
 */
const checkForInstantWin = (configuration, flowLabel) => {
    const { flowLambdas } = configuration.flow[flowLabel];
    const instantWin = flowLambdas.some((lambda) => lambda === 'instantWin');
    return instantWin;
};

/**
 * Function that returns prizeId for partitioned prizes
 * @param {String} partitionedId - string containing prizeId
 * @return {String} - Returns a string with Prize ID without the partition suffix
 */
const extractPrizeId = (partitionedId) => {
    const prizeWithoutPartition = partitionedId.replace(/([-]\d*)/, '');
    return prizeWithoutPartition;
};

/**
 * gets the csv delimiter that was used in the string.
 * @param {String} csvHeader - csv string
 */
const getCSVdelimiter = (csvHeader) => {
    const possibleDelimiters = [',', ';', '|', '$', '"'];

    // eslint-disable-next-line no-restricted-syntax
    for (const allowedDelimiter of possibleDelimiters) {
        if (csvHeader.indexOf(allowedDelimiter) !== -1) {
            return allowedDelimiter;
        }
    }
};

/**
 * Checks csv header vality and the csv file validity.
 * @param {String} data
 * @param {Array} expectedHeader
 */
const checkCSVheader = (data, expectedHeader, doNotThrow) => {
    console.log('Checking CSV header...');
    // gets first line of the string - csv header
    let extractedHeader = data.slice(0, data.indexOf('\n'));
    // remove windows, unix line endings
    extractedHeader = extractedHeader.replace(/\n|\r|[\u200B-\u200D\uFEFF]/g, '');
    const csvDelimiter = getCSVdelimiter(extractedHeader);
    if (!csvDelimiter) {
        console.error('ERROR: No delimiter found, CSV broken!');
        return false;
    }
    console.log(`Found delimiter is: '${csvDelimiter}'`);
    const csvHeader = extractedHeader.split(csvDelimiter);
    console.log('CSV header is ', csvHeader);
    // sort both arrays and transform them to string in order to check if they are equal
    if (csvHeader.sort().join(',') !== expectedHeader.sort().join(',')) {
        if (!doNotThrow) {
            console.error(`ERROR: Invalid CSV format. ${csvHeader.sort().join(',')} vs ${expectedHeader.sort().join(',')}`);
        }

        return false;
    }
    return true;
};

/**
 * Converts utc timestamp to the selected timezone of utc+1, utc +2 and utc+3;
 * @param {Number} utcTimestamp
 * @param {String} timezone
 */
const dateLocalTimeConvertion = (utcTimestamp, timezone) => {
    const oneHourMilliseconds = 3600000;
    switch (timezone) {
        case 'UTC+1':
            return utcTimestamp - oneHourMilliseconds;
        case 'UTC+2':
            return utcTimestamp - oneHourMilliseconds * 2;
        case 'UTC+3':
            return utcTimestamp - oneHourMilliseconds * 3;
        default:
            const errorBody = createErrorBody(ERROR_CODES.INVALID_PARAMETER,
                'Such UTC Timezone is not supported.');
            const errorResponse = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
            console.error('ERROR: Returning error response:\n', JSON.stringify(errorResponse));
            return errorResponse;
    }
};

/**
 * Gets currency expiry timestamp depending on the currency valid period from configuration and the current UTC time
 *
 * @param {Object} configuration - JSON object containing all promotion configuration information
 * @param {string} currencyId - Currency ID
 * @returns {(number|undefined)} - Returns currency expiry timestamp or undefined if it failed to generate it
 */
const getCurrencyValidThru = (configuration, currencyId) => {
    const validity = getCurrencyValidity(configuration, currencyId);
    return createValidThruTimestamp(validity);
};

/**
 * Checks are all of the passed parameters presented in the flow configuration.
 *
 * @param {object} configuration Configuration Object
 * @param {String} flowLabel The flow which we want to extract from the config
 * @param {Array} params Required parameters which we want to check
 *
 * @returns {Promise}
 */
const checkRequiredFlowParameters = (configuration, flowLabel, params = []) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    let err;

    if (!flowLabelJson) {
        err = 'Invalid Flow Configuration, missing "flow" property';
    } else if (!flowLabelJson.params) {
        err = 'Invalid Flow Configuration, missing "params" property';
    } else {
        // eslint-disable-next-line no-restricted-syntax
        for (const flowParam of params) {
            if (getFlowParameter(flowLabelJson, flowParam) === undefined) {
                err = `Missing "${flowParam}" parameter from the configuration`;
                break;
            }
        }
    }

    if (err) {
        const errorBody = createErrorBody(ERROR_CODES.CONFIGURATION_PARAMETER_MISSING, err);
        throw createResponse(RESPONSE_BAD_REQUEST, errorBody);
    }
};

/**
 * Recursive function to retry failed requests
 * @param {Function} fn - the function to be retried.
 * @param {*} retries num of reties
 */
const executeWithRetry = (fn, retries) => {
    console.log(`number of retries remaining ${retries}`);
    return fn()
        .catch((err) => {
            console.error('retry failed with: ', err);
            if (retries > 0) {
                return executeWithRetry(fn, retries - 1);
            }
            throw err;
        });
};

/**
 * Util functions that checks if a configuration is active
 * @param {object} config
 * @param {object} params request params
 */
const configTimePeriodCheck = (config, params) => {
    const checkEnabled = getConfigurationParameter(config, 'startEndDateCheck');
    if (!checkEnabled) return;
    const startDate = getConfigurationParameter(config, 'configurationStartUtc');
    const endDate = getConfigurationParameter(config, 'configurationEndUtc');
    const currentTime = Date.now();
    const { flowLabel } = params;
    const flow = getFlowLabel(config, flowLabel);
    const isItQueryFlow = checkForQueryFlow(flow);
    if ((currentTime < startDate || currentTime > endDate) && !isItQueryFlow) {
        const errorBody = createErrBody(ERR_CODES.PARTICIPANT_IS_BLOCKED,
            'Promotion is not active', undefined, ERROR_CODES.CHECKER_LAMBDA_REJECTION);
        throw createResponse(RESPONSE_BAD_REQUEST, errorBody);
    }
};

/**
 * Functions that checks if a configuration flow is
 * used for querying data
 * @param {object} flow
 */
const checkForQueryFlow = (flow) => {
    const [flowLambda] = flow.flowLambdas;
    return QUERY_LAMBDAS.includes(flowLambda);
};

/**
 * Function that shuffles randomly an array
 * using Fisher–Yates shuffle
 */

const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
};

/**
 * Function that takes configuration object
 * and calculates the expiration time of a record +1 month after configurationEndUtc
 * or 10 years from now if configurationEndUtc not available
 * return ttl value in seconds
 * @param {object} configuration
 */

const getExpirationTimestamp = (configuration) => {
    if (process.env.ARCHIVE_EXPIRED_CONFIG_DATA !== 'true') {
        return;
    }
    const { configurationEndUtc } = configuration.configurationParameters || {};
    const expirationTimestamp = configurationEndUtc
        ? configurationEndUtc + (1000 * 60 * 60 * 24 * 30)
        : new Date().setFullYear(new Date().getFullYear() + 10);
    const ttl = Math.floor(expirationTimestamp / 1000);
    return ttl;
};

const createExpTime = (monthsToAdd, date = new Date()) => Math.floor((date.setMonth(date.getMonth() + monthsToAdd)) / 1000);

const signRequest = (params) => {
    const {
        url, apiKey, data, secretAccessKey, accessKeyId, region, method,
    } = params;
    const requestOptions = {
        host: url.host,
        path: url.pathname,
        service: 'execute-api',
        method,
        region,
        headers: {
            ...apiKey && { 'x-api-key': apiKey },
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    };

    const signedRequest = aws4.sign(requestOptions, {
        secretAccessKey,
        accessKeyId,
    });

    delete signedRequest.headers.Host;
    delete signedRequest.headers['Content-Length'];

    return signedRequest;
};

const createPublicListPrizeEventCtx = (params) => {
    if (!params.configurationId) {
        throw createResponseMissingParameters(PARAMS_MAP.CONFIGURATION_ID);
    }

    const lambdaEvent = {
        resource: '/publicListPrizes',
        queryStringParameters: params,
    };

    return [CONFIGURATION_FUNCTIONS_MAP.prizeQueryLambda, lambdaEvent];
};

const filterParamsWithOptionalInfo = (event) => {
    const params = extractParams(event);

    if (params.entryType === 'image' && params.optionalInformation?.participationImage) {
        const { optionalInformation, ...filteredParams } = params;
        return filteredParams;
    }
    return params;
};

/**
 * Return object with date string
 * and date miliseconds
 * @returns {object}
 * */
const getExportDate = () => {
    const date = new Date();
    const currentDate = date.toISOString().split('T')[0];
    const dateMil = date.getTime();
    date.setDate(date.getDate() - 1);
    const previousDay = date.toISOString().slice(0, 10);
    return { dateMil, queryDateStr: previousDay, exportDate: currentDate };
};

module.exports = {
    createResponse,
    createResponseBadJsonRequest,
    createResponseBadConfiguration,
    createResponseMissingParameters,
    createResponseUnknownError,
    createResponseInvalidParameter,
    createResponseInsufficientCurrencies,
    createResponseVoucherNotFound,
    createResponseVoucherExpired,
    createResponseCantRedeemVoucher,
    createResponsePrizeNotFound,
    createResponseUserDeleted,
    createResponseNotEnoughPrizes,
    createResponseCantRedeemPrize,
    mergeResponses,
    parseBody,
    createErrorBody,
    createErrBody,
    setBody,
    getConfigFilePath,
    mergeObjectParams,
    extractParams,
    safeExtractParams,
    extractPostParams,
    extractGetParams,
    checkPassedParameters,
    checkForEmptyStringInParameters,
    setupParameter,
    getInvalidStringParameters,
    checkParamsForSpecificFormat,
    checkParametersFormat,
    validateParameters,
    copyFrom,
    arrayFromString,
    extractRequestId,
    createGppUserId,
    extractPrizeId,
    getTracingId,
    extractFileExtension,
    convertObjectStringsToPlainText,
    convertToPlain,
    copyAsCamelCase,
    copyAsSnakeCase,
    exportToCSV,
    isObject,
    getObjectKeyByValue,
    isPercentValue,
    omitNullValues,
    checkForJsonValue,
    validateImageType,
    prepareBase64ImageToUpload,
    createValidThruTimestamp,
    isValidHttpResponse,
    randomInRange,
    randomInt,
    sleep,
    beautifyColumnNames,
    getSatisfiedUserType,
    hoursToTimestamp,
    decreaseDateTimeByHours,
    splitArray,
    calculateTimestamp,
    checkForInstantWin,
    getCSVdelimiter,
    checkCSVheader,
    dateLocalTimeConvertion,
    isValidString,
    checkReceivedResponse,
    concatenateColumnValues,
    splitColumnValues,
    getCurrencyValidThru,
    checkRequiredFlowParameters,
    executeWithRetry,
    configTimePeriodCheck,
    shouldEnterCoreLogicCheck,
    shuffleArray,
    getExpirationTimestamp,
    signRequest,
    createExpTime,
    createPublicListPrizeEventCtx,
    getExportDate,
    filterParamsWithOptionalInfo,
    createResponseInvalidVoucherStatus,
    createResponseEmptyWallet,
};
