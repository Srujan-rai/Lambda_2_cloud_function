const { middyValidatorWrapper } = require('../middlewares/middyValidatorWrapper');
const {
    extractParams,
    createResponse,
} = require('../utility_functions/utilityFunctions');
const { getConfiguration } = require('../utility_functions/configUtilities');
const BlockedUsersUtils = require('../utility_functions/blockedUsersUtilities');
const participationDatabase = require('../database/participationsDatabase');
const unsuccessfulBurnAttemptsDatabase = require('../database/unsuccessfulBurnAttemptsTable');
const promotionsTable = require('../database/promotionsTable');
const { REQUIRED_PARAMETERS_FOR_LAMBDA } = require('../constants/lambdas');
const { RESPONSE_OK } = require('../constants/responses');
const { PARAMS_MAP } = require('../constants/common');
/**
 * Lambda that generates the user's pincode related participation history
 * @param {Object} event - data that we receive from request
 * @param callback - returned data
 *
 * @returns {Promise} - Returns Promise with result
 */
const basePincodeHistoryLambda = async (event) => {
    try {
        const params = extractParams(event);
        await BlockedUsersUtils.checkIsUserBlocked(params);
        const result = await getPincodeHistory(params);
        const response = createResponse(RESPONSE_OK, result);
        console.log('Returning pincode history response successfully!');
        return response;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', errorResponse);
        return errorResponse;
    }
};

/**
* Query pincodes history from gpp_participations_tables and gpp_unsuccessful_burn_attempts_table
*
* @param {Object} params - HTTP body parameters
* @returns {Promise}
*/
const getPincodeHistory = async (params) => {
    try {
        const defaultStartDate = new Date().setMonth(new Date().getMonth() - 6);
        params[PARAMS_MAP.START_DATE] = new Date(params[PARAMS_MAP.START_DATE]).getTime() || new Date(defaultStartDate).getTime();
        params[PARAMS_MAP.END_DATE] = new Date(params[PARAMS_MAP.END_DATE]).getTime() || new Date().getTime();

        const configMetadata = await getConfiguration(params[PARAMS_MAP.CONFIGURATION_ID]);
        const promoMetadata = await promotionsTable.getPromoMetadata(configMetadata.promotionId);

        let promoName = '';
        if (promoMetadata.length && Object.prototype.hasOwnProperty.call(promoMetadata[0], 'promotion_name')) {
            promoName = promoMetadata[0].promotion_name;
        }

        const participationsResult = await getParticipationResult(params, promoName);
        const unsuccessfulBurnsResult = await getUnsuccBurnAttemptsResult(params, promoName);
        const result = {
            success: [...participationsResult],
            failures: [...unsuccessfulBurnsResult],
        };

        return result;
    } catch (error) {
        console.error('ERROR: Error occurs during getPincodeHistory:\n', error);
        return error;
    }
};

/**
* Query participation history from gpp_participations_tables
*
* @param {Object} params - HTTP body parameters
* @param {string} promoName - Promotion name
* @returns {Promise}
*/
const getParticipationResult = async (params, promoName) => {
    try {
        const filterExpression = 'configuration_id = :configuration_id';
        const filterValues = {
            ':configuration_id': params[PARAMS_MAP.CONFIGURATION_ID],
        };
        const participationsArray = await participationDatabase.queryByGppUserIdAndParticipationTimestamp(
            params[PARAMS_MAP.GPP_USER_ID],
            params[PARAMS_MAP.START_DATE],
            params[PARAMS_MAP.END_DATE],
            filterExpression,
            filterValues,
        );

        const participationsResult = participationsArray.reduce((recordList, item) => {
            const record = {};
            if (item.successful_burns) {
                record.result = 'Successful';
                record.promotionName = promoName;
                record.pincode = item.successful_burns.pincode;
                record.entryTime = Number(item.participation_time);

                if (item.inserted_transactions && item.inserted_transactions.length) {
                    record.amount = item.inserted_transactions[0].amount;
                    record.currencyName = item.inserted_transactions[0].currency_name;
                    record.currencyId = item.inserted_transactions[0].currency_id;
                }

                recordList.push(record);
            }

            return recordList;
        }, []);

        return participationsResult;
    } catch (error) {
        console.error('ERROR: Error occurs during getParticipationResult:\n', error);
        return error;
    }
};

/**
* Query unsuccessful burn attempts history from gpp_unsuccessful_burn_attempts_table
*
* @param {Object} params - HTTP body parameters
* @param {string} promoName - Promotion name
* @returns {Promise}
*/
const getUnsuccBurnAttemptsResult = async (params, promoName) => {
    try {
        const filterExpression = 'configuration_id = :configuration_id AND #participation_time Between :start_date AND :end_date';

        const filterValues = {
            ':configuration_id': params[PARAMS_MAP.CONFIGURATION_ID],
            ':start_date': params[PARAMS_MAP.START_DATE],
            ':end_date': params[PARAMS_MAP.END_DATE],
        };

        const expressionAttributeNames = { '#participation_time': 'timestamp' };

        const unsuccessfulBurnsArray = await unsuccessfulBurnAttemptsDatabase.queryByGppUserId(
            params[PARAMS_MAP.GPP_USER_ID],
            filterExpression,
            filterValues,
            expressionAttributeNames,
        );

        const unsuccessfulBurnsResult = unsuccessfulBurnsArray.reduce((recordList, item) => {
            const record = {};
            record.result = 'Unsuccessful';
            record.promotionName = promoName;
            record.reason = item.reason;
            record.error_code = item.error_code;
            record.pincode = item.pincode;
            record.entryTime = item.timestamp;
            recordList.push(record);

            return recordList;
        }, []);

        return unsuccessfulBurnsResult;
    } catch (error) {
        console.error('ERROR: Error occurs during getUnsuccBurnAttemptsResult:\n', error);
        return error;
    }
};

module.exports = {
    pincodeHistoryLambda: middyValidatorWrapper(basePincodeHistoryLambda, REQUIRED_PARAMETERS_FOR_LAMBDA.pincodeHistoryLambda),
};
