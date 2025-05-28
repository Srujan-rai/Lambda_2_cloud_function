const randomNumber = require('random-number-csprng-2');
const ContentDisposition = require('content-disposition');
const {
    saveToS3,
    uploadToS3,
    createSignedURL,
} = require('../utility_functions/aws_sdk_utils/s3Utilities');
const Utils = require('../utility_functions/utilityFunctions');
const { customTransformer } = require('./prizeDrawExportUtils');
const { prizeDrawPartExportCSVHeaders } = require('../constants/fileSchemas');

const { RESPONSE_BAD_REQUEST } = require('../constants/responses');
const { ERR_CODES: { INVALID_REQUEST_PARAMETERS }, ERROR_CODES: { INVALID_PARAMETER } } = require('../constants/errCodes');
const { CONFIGURATION_FUNCTIONS_MAP } = require('../constants/lambdas');
const { invokeLambda } = require('../utility_functions/aws_sdk_utils/lambdaUtilities');

/**
 * Method uploading the exported csv file to S3 and returning the signed url
 * @param participations - participation array
 * @param numberOfWinners - number of winners
 */
const createParticipationsExport = async (configurationId, result, existingFile) => {
    const dateExportInfo = Utils.getExportDate();
    try {
        const fileName = existingFile || `analysis/prize_draw_participations/${dateExportInfo.exportDate}/${configurationId}_${dateExportInfo.dateMil}.csv`;
        const csv = await Utils.exportToCSV({
            data: result,
            fields: prizeDrawPartExportCSVHeaders,
            delimiter: ';',
            transformer: [customTransformer],
        });
        const filePath = await uploadToS3(csv, configurationId, fileName, process.env.PRIVATE_BUCKET, 'Key');
        const presignedURL = await createSignedURL(filePath, process.env.PRIVATE_BUCKET);
        return {
            presignedURL,
            fileName,
        };
    } catch (err) {
        console.error('ERROR: Failed to export', configurationId, ' \n', JSON.stringify(err));
        throw err;
    }
};

/**
 * A function that generates the winning numbers using random-number-csprng-2
 * @param participationArrayLength - a number based on all participation Ids from the previous queries
 * @param numberOfWinners - value is passed in from the event and is extracted into the params var.
 * This is ultimately how many times the RNG should run.
 */
const getWinningNumbers = (participationArrayLength, numberOfWinners) => {
    const startingNumber = 0;
    const endingNumber = participationArrayLength - 1;
    const winnersSet = new Set();

    if (!numberOfWinners) {
        const errorBody = Utils.createErrBody(INVALID_PARAMETER, `Number of winners is not a number ${numberOfWinners}`, INVALID_REQUEST_PARAMETERS);
        const errorResponse = Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
        return Promise.reject(errorResponse);
    }

    if (numberOfWinners > participationArrayLength) {
        numberOfWinners = participationArrayLength;
    }

    const getNumbers = async () => {
        try {
            const number = await randomNumber(startingNumber, endingNumber);

            if (winnersSet.size === numberOfWinners) {
                console.log('Finished generating winning numbers');
                return [...winnersSet];
            }
            if (number || number === 0) {
                winnersSet.add(number);
                return getNumbers();
            }
            return getNumbers();
        } catch (error) {
            console.error(error);
        }
    };

    return getNumbers();
};

/**
 * Method returning random winners
 * @param participations - participation array
 * @param numberOfWinners - number of winners
 */
const getWinners = async (participations, numberOfWinners) => {
    if (participations.length === 1) {
        return [participations[0]];
    }
    const winningNumbers = await getWinningNumbers(participations.length, parseInt(numberOfWinners));
    return selectWinners(winningNumbers, participations);
};

/**
 * A function that matches the winning numbers to the participation based on there index
 * @param winningNumbers - an array of numbers to be used to select the winning participation Ids from participationIdsArray
 * @param participationIdsArray - an array of all participation Ids from the previous queries.
 */
const selectWinners = (winningNumbers, participationIdsArray) => {
    const winnerArray = winningNumbers.map((winningNumber) => participationIdsArray[winningNumber]);
    return winnerArray;
};

/**
 * A function that saves the winners to a config specific bucket in S3
 * @param winnerArray - an array of the winning participationIds
 * @param configId - the config Id passed in from the event
 */
const saveDataToS3 = (winnerArray, configId) => {
    const winnerObject = { ...winnerArray };
    const date = Utils.getExportDate();
    const filePath = `prize-draw-results/${configId}/winners_${date.queryDateStr}/winners_${configId}_${date.dateMil}.json`;

    console.log('Saving file to S3...');
    return saveToS3({
        Key: filePath,
        Body: JSON.stringify(winnerObject),
        Bucket: process.env.PRIVATE_BUCKET,
        ContentType: 'application/json',
        ContentDisposition: ContentDisposition(filePath, {
            type: 'inline',
        }),
    });
};

/**
 * Re-invokes a Lambda function with a specified event and file name as input..
 *
 * @param {Object} event - The event data that will be passed to the Lambda function.
 * @param {string} fileNm - The name of the file to be passed as a parameter to the Lambda function.
 * @returns {Promise} - The result of invoking the Lambda function asynchronously.
 */
const reInvokeLambda = async (event, fileNm) => {
    const invokeParams = { ...CONFIGURATION_FUNCTIONS_MAP.lotteryExporterLambda, InvocationType: 'Event' };
    return invokeLambda(invokeParams, { batchProcess: 'true', prevPayload: event, fileName: fileNm });
};

module.exports = {
    createParticipationsExport,
    getWinners,
    saveDataToS3,
    reInvokeLambda,
};
