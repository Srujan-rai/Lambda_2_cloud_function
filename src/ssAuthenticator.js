const jwksClient = require('jwks-rsa');
const jwt = require('jsonwebtoken');
const Utils = require('./utility_functions/utilityFunctions');
const {
    ERROR_CODES: {
        FLOW_LAMBDA_REJECTION,
        INVALID_PARAMETER,
        UNKNOWN_ERROR,
    },
} = require('./constants/errCodes');
const { RESPONSE_UNAUTHORIZED, RESPONSE_BAD_REQUEST } = require('./constants/responses');
/** Checks for validity of the provided sso idtoken
 * Google Captcha Checker.
 * @param event - data that we receive from request
 * @returns {Promise<String>}
 */
module.exports.authenticate = (event) => {
    const { headers } = event;

    if (process.env.authenticateAndAuthorizeSS === 'false') { // if no authentication and authorization are required
        return Promise.resolve('');
    }

    if (!headers['id-token']) {
        const errorBody = Utils.createErrorBody(FLOW_LAMBDA_REJECTION, 'Unauthorized');
        const response = Utils.createResponse(RESPONSE_UNAUTHORIZED, errorBody);
        return Promise.reject(response);
    }

    try {
        const token = headers['id-token'];
        const hbuff = Buffer.from(token.split('.')[0], 'base64');
        const hinfo = JSON.parse(hbuff.toString('utf8'));
        const { kid } = hinfo;
        const client = jwksClient({
            cache: true,
            strictSsl: true,
            jwksUri: process.env.jwksUri,
            requestHeaders: {},
            requestAgentOptions: {},
        });

        return new Promise((resolve, reject) => {
            client.getSigningKey(kid, (err, key) => {
                if (err) {
                    const errorBody = Utils.createErrorBody(FLOW_LAMBDA_REJECTION, 'Invalid token');
                    return reject(Utils.createResponse(RESPONSE_UNAUTHORIZED, errorBody));
                }
                const signingKey = key.publicKey || key.rsaPublicKey;
                jwt.verify(token, signingKey, (error, decoded) => {
                    if (error) {
                        console.log('error: ', error);
                        const errorBody = Utils.createErrorBody(FLOW_LAMBDA_REJECTION, error.message || 'Unauthorized');
                        const response = Utils.createResponse(RESPONSE_UNAUTHORIZED, errorBody);
                        return reject(response);
                    }

                    const koId = decoded.preferred_username && decoded.preferred_username.split('@')[0]; // because the decoded.preferred_username looks like 'S123456@alwaysko.com' and we want only the KO ID

                    if (!koId) {
                        const errorBody = Utils.createErrorBody(INVALID_PARAMETER,
                            'Missing SSO username');
                        return reject(Utils.createResponse(RESPONSE_BAD_REQUEST, errorBody));
                    }

                    console.log('Successful authentication: ', koId);
                    return resolve(koId);
                });
            });
        });
    } catch (e) {
        console.log('error: ', e);
        const errorBody = Utils.createErrorBody(UNKNOWN_ERROR, e.message || 'Authentication error occurred');
        const response = Utils.createResponse(RESPONSE_UNAUTHORIZED, errorBody);
        return Promise.reject(response);
    }
};
