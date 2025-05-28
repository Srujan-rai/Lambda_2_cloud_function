const Utils = require('../utility_functions/utilityFunctions');
const participationDatabase = require('../database/participationsDatabase');
const { REQUIRED_PARAMETERS_FOR_LAMBDA } = require('../constants/lambdas');
const { RESPONSE_OK } = require('../constants/responses');
const { customTransformer } = require('./prizeDrawExportUtils');
const {
    createParticipationsExport,
    getWinners,
    saveDataToS3,
    reInvokeLambda,
} = require('./lotteryExporterUtils');

/**
 * A function that extracts the participation id's out of the results from the DB
 * @param resultsArray - array of items that match the queried configId and prizeId
 */
const filterForParticipationIds = (resultsArray, participationIdsArray) => {
    resultsArray.forEach((result) => {
        participationIdsArray.push(result.participation_id);
    });
};

/**
 * Lambda that will export the lottery results based on confId, winners, prizeId
 * @param event - data that we receive from request
 * @param context
 * @param callback - returned data
 */
module.exports.lotteryExporterLambda = async (event) => {
    try {
        let responseBody = {};
        if (event?.payloadSource && event?.configurationId && event?.numberOfWinners) {
            responseBody = await processGeneration(event);
        } else if (event?.batchProcess) {
            responseBody = await processFilesForWinners(event);
        } else {
            const eventParams = Utils.extractParams(event);
            const participationIdsArray = [];
            Utils.checkPassedParameters(eventParams, REQUIRED_PARAMETERS_FOR_LAMBDA.lotteryExporterLambda);
            const results = await participationDatabase.queryByConfigurationIdPlusPrizeId(eventParams.configurationId, eventParams.prizeId);
            if (!results || results.length === 0) {
                const response = Utils.createResponse(RESPONSE_OK, { customErrorMessage: 'No participation records found.' });
                return response;
            }
            await filterForParticipationIds(results, participationIdsArray);
            const winnersArray = await getWinners(participationIdsArray, eventParams.numberOfWinners);
            const exportCount = winnersArray.length;
            await saveDataToS3(winnersArray, eventParams.configurationId);
            responseBody = {
                lotteryExportCompleted: true,
                numberOfWinnersExported: exportCount,
            };
        }
        const response = Utils.createResponse(RESPONSE_OK, responseBody);
        return response;
    } catch (errorResponse) {
        console.error('ERROR: lottery export failed:\n', errorResponse);
        return errorResponse;
    }
};

/**
 * Executes a query with a timeout. If the query resolves within the specified timeout,
 * it returns the result with a "success" status.
 * @param {Promise} queryPromise - The promise representing the query to be executed.
 * @param {number} timeout - The maximum time (in milliseconds) to wait for the query to resolve.
 * @returns {Promise} - A promise that resolves with an object containing a status and data
 */
const queryWithTimeout = async (queryPromise, timeout) => {
    const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
            resolve({ status: 'timeout', data: null });
        }, timeout);
    });

    try {
        const result = await Promise.race([queryPromise, timeoutPromise]);
        return result;
    } catch (error) {
        console.log('error in queryWithTimeout', error);
        throw error;
    }
};

/**
 * Processes participant data to determine winners based on a specific configuration,
 * and exports the participation details for further use.
 *
 * @param {Object} event - The event object containing necessary payload details.
 * @returns {Promise<Object>} - The export result containing participation details.
 */
const processFilesForWinners = async (event) => {
    const result = await participationDatabase.queryByConfiguration(event.prevPayload.configurationId);
    const winnersArray = await getWinners(result, event.prevPayload.numberOfWinners);
    return createParticipationsExport(event.prevPayload.configurationId, winnersArray, event.fileName);
};

/**
 * Handles the generation process for participation results,
 * managing timeout scenarios and preparing export data.
 *
 * @param {Object} event - The event object containing configuration details.
 */
const processGeneration = async (event) => {
    let responseBody = {};
    const result = await queryWithTimeout(
        participationDatabase.queryByConfiguration(event.configurationId),
        28000,
    );
    if (result.status === 'timeout') {
        const output = await createParticipationsExport(event.configurationId, []);
        const fileNm = output.fileName;
        responseBody = {
            isBatch: 'true',
            winners: [],
            csv: output.presignedURL,
        };
        await reInvokeLambda(event, fileNm);
        return responseBody;
    }
    const winnersArray = await getWinners(result, event.numberOfWinners);
    const output = await createParticipationsExport(event.configurationId, winnersArray);
    responseBody = {
        winners: winnersArray.map((item) => customTransformer(item)),
        csv: output.presignedURL,
    };
    return responseBody;
};
