const { createResponse } = require('../utility_functions/utilityFunctions');
const { processParticipationExport, exportParticipations, getPrizeDrawConfigIds } = require('./prizeDrawExportUtils');
const { RESPONSE_OK } = require('../constants/responses');

const startExecutionTime = Date.now();

/**
 * Lambda that will run each Monday and export participation entries for particular configId
 * @param event - data that we receive from request
 * @param context
 * @param callback - returned data
 */
const prizeDrawExporterLambda = async (event) => {
    console.log('Received event:\n', JSON.stringify(event));
    console.log('Starting participation data export...');
    let responseBody = {};
    try {
        if (event?.payloadSource && event?.configurationId) {
            responseBody = await processParticipationExport(event.configurationId, event?.payloadSource, event?.state, startExecutionTime);
        } else {
            const configurationIds = await getPrizeDrawConfigIds();
            const result = await exportParticipations(configurationIds);

            responseBody = {
                prizeDrawExportCompleted: true,
                failedConfigIds: result.failedConfigIds,
                exportedParticipations: result.exported,
            };
        }
        const response = createResponse(RESPONSE_OK, responseBody);
        console.log('Returning response..');
        return response;
    } catch (errorResponse) {
        console.error('ERROR: prize draw export failed:\n', JSON.stringify(errorResponse));
        throw errorResponse;
    }
};

module.exports = {
    prizeDrawExporterLambda,
};
