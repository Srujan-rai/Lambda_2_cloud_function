/* eslint-disable global-require */
const {
    extractParams,
    checkPassedParameters,
    createResponse,
} = require('../utility_functions/utilityFunctions');
const ssConfig = require('./selfServiceConfig.json');
const { REQUIRED_PARAMETERS_FOR_LAMBDA } = require('../constants/lambdas');
const { RESPONSE_OK } = require('../constants/responses');
/**
 * Requires the specified tableHandler.
 * The handler is specified on SSconfig flow level
 * @param tableHandler - name of the tableHandler file. (ex. currencyDatabase)
 */
const getTableHandler = (tableHandler) => {
    console.log(`../../database/${tableHandler}`);
    try {
        // eslint-disable-next-line import/no-dynamic-require
        return require(`../database/${tableHandler}`);
    } catch (e) {
        console.log('oh no big error', e);
        return undefined;
    }
};

/**
 * Generic Lambda that will be used for SS create/edit Screens.
 * It is expecting 'dbOperationParams' object that contains the
 * needed fields for the new db entity
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
const databaseOperationsHandler = (event, context, callback) => {
    try {
        const eventParams = extractParams(event);

        const { dbOperationType } = ssConfig.flow[eventParams.flowLabel].params;
        const { tableHandler, additionalFunctionParams } = ssConfig.flow[eventParams.flowLabel].params;
        if (!dbOperationType && !tableHandler) {
            callback(null, 'SS flow misconfigured!');
        }
        console.log('Extracted params:\n', JSON.stringify(eventParams));
        const requiredParameters = REQUIRED_PARAMETERS_FOR_LAMBDA.databaseOperationsHandler;

        checkPassedParameters(eventParams, requiredParameters);
        const handler = getTableHandler(tableHandler);
        let result;
        switch (dbOperationType) {
            case 'put':
                handler.putEntry.apply(null, [eventParams.dbOperationParams, ...additionalFunctionParams])
                    .then((insertedItem) => {
                        result = insertedItem;
                        callback(null, result);
                    });
                break;
            case 'update':
                handler.updateEntry(eventParams.dbOperationParams)
                    .then((item) => {
                        const res = createResponse(RESPONSE_OK, { item });
                        callback(null, res);
                    })
                    .catch((err) => {
                        callback(null, err);
                    });
                break;
            default:
                result = 'error, wrong dbOperationFlow...';
                break;
        }
    } catch (err) {
        console.error('ERROR: Returning error response:\n', JSON.stringify(err));
        callback(null, err);
    }
};

module.exports = {
    databaseOperationsHandler,
};
