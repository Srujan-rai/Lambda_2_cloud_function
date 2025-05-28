'user strict';

const Utils = require('./utility_functions/utilityFunctions');
const DBUtils = require('./database/dbUtilities');
const { RESPONSE_OK } = require('./constants/responses');
const { GPP_PRIZE_CATALOGUE_TABLE } = require('./constants/tableNames');

/**
 * Lambda that will be triggered upon uploading images through self service,
 * the information then will be saved to s3 and dynamoDb, overwritting the current content of dynamodb img_url and other details,
 * if necessary.
 * @param event - received object with all the information about all prize images
 * (without the file itself, which is uploaded to S3 directly from the FE)
 */
module.exports.editPrizeImageUploadLambda = async (event, context, callback) => {
    const params = Utils.extractParams(event);
    try {
        const updateParams = await createUpdateParams(params);
        const updateResult = await DBUtils.update(updateParams);
        const response = Utils.createResponse(RESPONSE_OK, { theResult: updateResult });
        console.log(`Returning response: ${JSON.stringify(response)}`);
        callback(null, response);
    } catch (error) {
        console.log(`ERROR occurred. Returning object: ${JSON.stringify(error)}`);
        callback(null, error);
    }
    const response = Utils.createResponse(RESPONSE_OK, { theResult: 'OK' });
    console.log(`Returning response: ${JSON.stringify(response)}`);
    callback(null, response);
};

/**
 * @param {*} params - parameters received from the FE with prizeImage upload array containing the needed image uploads for the dynamodb.
 * the items in the array will look like this - "https://gpp-public-bucket-exampleBucketName.s3.example-region.amazonaws.com/prizeImages/exampleConfigurationId/examplePrizeId/examplePrizeImage.png",
 * The split function will take the configuration id and the prizeId from the first file in the array,
 * as there will be always at least 1 file in the array to be received.
 */

const createUpdateParams = (params) => {
    const configurationId = params.prizeParams && params.prizeParams.configurationId;
    const prizeId = params.prizeParams && params.prizeParams.prizeId;

    return Promise.resolve({
        ExpressionAttributeValues: {
            ':imgUrl': params.prizeParams.imgUrl,
            ':imagesMetadata': params.prizeParams.imagesMetadata,
        },
        Key: {
            configuration_id: configurationId,
            prize_id: prizeId,
        },
        ReturnValues: 'ALL_NEW',
        TableName: GPP_PRIZE_CATALOGUE_TABLE,
        UpdateExpression: 'SET img_url = :imgUrl, images_metadata = :imagesMetadata',
    });
};
