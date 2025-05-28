const Utils = require('./utility_functions/utilityFunctions');
const UserRolesTable = require('./database/userRolesTable');
const { ERROR_CODES: { FLOW_LAMBDA_REJECTION, CONFIGURATION_PARAMETER_MISSING } } = require('./constants/errCodes');
const { RESPONSE_FORBIDDEN, RESPONSE_BAD_REQUEST } = require('./constants/responses');

const USER_LEVELS = {
    read_only: 0,
    editor: 20,
    super_admin: 40,
};

/** The Authorize is used for the validation of users
 * @param {Object} params - Request body parameters, originally received by Lambda.
 * @param {Object} configuration - Configuration in JSON format
 * @param {String} koId - the KO ID of the SS user.

 * @returns {Promise} - resolved with status 200 HTTP response if all checks passed,
 *                    - rejected with appropriate error HTTP response if any check fails
 */
module.exports.authorize = async (params, configuration, koId) => {
    try {
        if (process.env.authenticateAndAuthorizeSS === 'false') { // if no authentication and authorization are required
            return '';
        }

        const requiredMinUserLevel = configuration.flow[params.flowLabel].params
            && configuration.flow[params.flowLabel].params.minUserLevel;
        const needsConfigAccess = Object.prototype.hasOwnProperty.call(params, 'configurationId');

        if (!Number.isInteger(requiredMinUserLevel)) {
            const errorBody = Utils.createErrorBody(CONFIGURATION_PARAMETER_MISSING,
                "Missing flow parameter 'minUserLevel'");
            throw Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody);
        }

        const userLevel = USER_LEVELS.read_only; // give user the minimal role

        if (userLevel >= requiredMinUserLevel && !needsConfigAccess) {
            return userLevel; // we will not check in the UserRolesTable if the user has the requiredMinUserLevel
        }

        const results = await UserRolesTable.getUserRole(koId); // if any
        const errorMessage = 'Not authorized';
        if (results[0] && results[0].role >= requiredMinUserLevel && !needsConfigAccess) {
            return results[0].role;
        }
        if (results[0] && results[0].role >= requiredMinUserLevel && needsConfigAccess) {
            const allowedConfigs = results[0].configurations;
            if (allowedConfigs && (allowedConfigs.values.includes(params.configurationId) || allowedConfigs.values.includes('*'))) {
                return results[0].role;
            }
        }
        const errorBody = Utils.createErrorBody(FLOW_LAMBDA_REJECTION, errorMessage);
        const response = Utils.createResponse(RESPONSE_FORBIDDEN, errorBody);
        throw response;
    } catch (error) {
        console.log('Error', error);
        return error;
    }
};
