const { executeWinningAttempt } = require('./winning_moments/winningMoment');
const {
    createErrBody,
    createResponse,
} = require('../../utility_functions/utilityFunctions');
const { getConfiguration } = require('../../utility_functions/configUtilities');
const { getInstantWinAlgorithm } = require('../../self_service/configurationUtils');
const { ERR_CODES: { NONEXISTENT_IW_ALGORITHM }, ERROR_CODES: { CONFIGURATION_ERROR } } = require('../../constants/errCodes');
const { RESPONSE_INTERNAL_ERROR } = require('../../constants/responses');
/**
 * Mapping file. Maps key specified in configuration to a file responsible for executing winning algorithm
 *
 * NOTE: ALL ALGORITHMS SHOULD EXPECT ONE PARAMETER WHICH REPRESENTS LAMBDA INVOKE EVENT PARAMETERS (PARSED EVENT BODY)
 */
const ALGORITHMS = {
    winningMoments: executeWinningAttempt,
};

/**
 * Extracts algorithm function from mapping JSON.
 */
const getAlgorithmFunction = async (configurationId, flowLabel, event) => {
    console.log('Attempting to extract winning algorithm....');
    console.log('Algorithms:\n', JSON.stringify(ALGORITHMS));
    try {
        const configuration = await getConfiguration(configurationId, event);
        const algorithmName = await getInstantWinAlgorithm(configuration, flowLabel);
        if (!algorithmName) {
            console.error('ERROR: Algorithm name was NOT found!');
            throw new Error();
        }
        const algorithm = ALGORITHMS[algorithmName];
        if (!algorithm) {
            console.error("ERROR: Algorithm doesn't exist");
            throw new Error("Algorithm doesn't exist");
        }
        console.log('Algorithm name found!\nName:', algorithmName, '\nAlgorithm:', algorithm);
        return algorithm;
    } catch (err) {
        const errorBody = createErrBody(NONEXISTENT_IW_ALGORITHM,
            'Error while trying to obtain instant win algorithm. Please check your configuration',
            undefined, CONFIGURATION_ERROR);
        const errorResponse = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
        throw errorResponse;
    }
};

module.exports = {
    getAlgorithmFunction,
};
