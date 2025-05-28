const Utils = require('./utility_functions/utilityFunctions');
const { getFileFromS3 } = require('./utility_functions/aws_sdk_utils/s3Utilities');
const { RESPONSE_OK, RESPONSE_NOT_FOUND } = require('./constants/responses');
const { ERROR_CODES: { NOT_FOUND } } = require('./constants/errCodes');

/**
 * Lambda that obtain currency Codes file.
 * depends on GET_CONFIGURATION_PARAMS
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
module.exports.currencyCodesLambda = async (event, context, callback) => {
    try {
        const currencyCodes = await getFileFromS3({
            readConfFileParams: {
                Bucket: process.env.PRIVATE_BUCKET,
                Key: 'currency_codes/codes.json',
                ResponseContentType: 'application/json',
            },
            ErrorMessage: "Currency Codes file doesn't exist!",
        });
        const response = Utils.createResponse(RESPONSE_OK, { currencyCodes });
        console.log('Returning response..');
        callback(null, response);
    } catch (е) {
        const errorBody = Utils.createErrorBody(NOT_FOUND, 'No currency Codes file found !');
        const errResponse = Utils.createResponse(RESPONSE_NOT_FOUND, errorBody);
        console.error('ERROR: Returning error response:\n', errResponse);
        callback(null, errResponse);
    }
};
