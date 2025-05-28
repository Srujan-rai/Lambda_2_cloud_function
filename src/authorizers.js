const { JwtRsaVerifier } = require('aws-jwt-verify');
const { SimpleJwksCache } = require('aws-jwt-verify/jwk');
const { decomposeJwt } = require('aws-jwt-verify/jwt');
const { JwtInvalidIssuerError, FetchError } = require('aws-jwt-verify/error');
const {
    getTracingId,
    executeWithRetry,
} = require('./utility_functions/utilityFunctions');
const { invokeLambda } = require('./utility_functions/aws_sdk_utils/lambdaUtilities');
const { CONFIGURATION_CHECKS_MAP } = require('./constants/checkers');
const tokenValidators = require('./tokenValidators');
const { JwtTokenVerifiersInstance } = require('./constants/b2cUrls/b2cV2Urls');
const { PARAMS_MAP } = require('./constants/common');

const VERIFY_MAX_RETRIES = 3;

/* TODO adjust this to use https://github.com/The-Coca-Cola-Company/global-cds-authorizer-services lambda
when all of the legacy promos are decommissioned */
class CustomJwksCache extends SimpleJwksCache {
    getJwk(jwksUri, decomposedJwt) {
        const { acr } = decomposedJwt.payload;
        const remove = 'v2.0/.well-known/jwks.json';
        const endpoint = decomposedJwt?.payload?.tfp
            ? 'discovery/v2.0/keys'
            : `${acr}/discovery/v2.0/keys`;
        const uri = jwksUri.replace(remove, endpoint);
        return super.getJwk(uri, decomposedJwt);
    }
}

const verifier = JwtRsaVerifier.create(
    JwtTokenVerifiersInstance.getJwtVerificationEntities(),
    { jwksCache: new CustomJwksCache() },
);

const skipVerifyUserRequestPaths = [
    '/publicListPrizes',
    '/additionalInformation',
];

/** The Authorize is used for the validation of users jwt token with cds
 * and checking if the captcha response is valid.
 * @param {Object} event Data that we receive from request
 * @returns Policy, which will allow or deny a user to access a resource
 */

const sdkAuthorizer = async (event) => {
    try {
        console.log(getTracingId(event));
        if (process.env.IS_OFFLINE === 'true') {
            return generatePolicy(
                {
                    effect: 'Allow',
                    resource: event.methodArn,
                    userDetails: {
                        email: 'jsSDKTestUser@coca-cola.com',
                        userId: '4147e5fc-8522-4d82-b2e6-7927cd93ffca',
                        hashed_kocid: 'e5877285b1af752670adbc415e1024ec2396526dff9ed322321d684b7da9553c',
                        ref_hashed_kocid: 'ecdbf3af4d1297e89916a92efce6132bdf9c8afd38b588f4f0b968570ff7f52d',
                        ref_code: 'REPS123123',
                    },
                },
                true,
            );
        }

        if (!skipVerifyUserRequestPaths.includes(event.path)) return await verifyUserRequest(event);

        return generatePolicy({ effect: 'Allow', resource: event.methodArn, undefined });
    } catch (e) {
        console.error('An error occurred:', e);
        const errMessage = e.body ? JSON.parse(e.body).message : e.message;
        return generatePolicy({ effect: 'Deny', resource: event.methodArn, message: errMessage || 'Unauthorized' });
    }
};

/**
 * Validate cds authorization token
 * @param {String} authHeader jwt token
 */
const verifyCDSToken = async (authHeader) => {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('The authorization token is missing or has incorrect format!');
    }

    const token = authHeader.replace('Bearer ', '');

    const {
        uuid,
        kocid,
        hashed_kocid,
        ref_hashed_kocid,
        ref_code,
        emailAddress,
        email,
        preferred_username,
        hashedKocid,
        iss,
        country,
        azp,
        exp,
    } = await verifier.verify(token).catch(async (err) => {
        if (err instanceof JwtInvalidIssuerError) {
            const [issuer] = err.failedAssertion.actual;
            const validator = tokenValidators[issuer.replace('cid.', '')];
            const { payload: customClaims } = decomposeJwt(token);

            if (!validator || !(await validator.verify(token, validator.jwksUri || customClaims, customClaims))) {
                throw new Error('The authorization token is invalid or from invalid issuer');
            }

            return customClaims;
        }

        if (err instanceof FetchError && err?.message.includes('time-out')) {
            return executeWithRetry(() => verifier.verify(token), VERIFY_MAX_RETRIES).catch((error) => {
                throw error;
            });
        }

        throw new Error(`Token verification failed: Token - ${token}; Error: ${err}`);
    });

    return {
        userId: (process.env.migrateUsers === 'true' ? (hashedKocid || hashed_kocid) : uuid) || kocid || hashed_kocid,
        email: emailAddress || email || preferred_username,
        emailVerificationUrl: JwtTokenVerifiersInstance.getEmailVerificationUrl(iss),
        envDetails: JSON.stringify(JwtTokenVerifiersInstance.extractEnvParamsFromUrl(iss)), // stage & region
        country: country || undefined,
        hashed_kocid: hashed_kocid || undefined,
        ref_hashed_kocid: ref_hashed_kocid || undefined,
        ref_code: ref_code || undefined,
        azp,
        exp,
    };
};

/**
 * This function is called to validate the user if the event path is no publicListPrizes
 * @param {*} event - event Obj
 * @returns - a generated policy with the user and captcha is valid
 */
async function verifyUserRequest(event) {
    await validateCaptchaToken(event);

    const authHeader = event.headers.Authorization || event.headers.authorization;
    const userDetails = await verifyCDSToken(authHeader);

    return generatePolicy({ effect: 'Allow', resource: event.methodArn, userDetails });
}

/**
 * A simple function for validating the captcha token
 * @param {*} event - event Obj
 */
async function validateCaptchaToken(event) {
    if (event.queryStringParameters[PARAMS_MAP.RECAPTCHA]) {
        const lambdaParams = CONFIGURATION_CHECKS_MAP.checkCaptcha;
        const captchaResponse = await invokeLambda(lambdaParams, event);
        const bodyObj = captchaResponse.body && JSON.parse(captchaResponse.body);
        if (!bodyObj.captchaVerified) {
            throw new Error({ customMessage: 'The reCaptcha validation failed!' });
        }
    }
}

/**
 * Generate authentication policy
 * @param {String} effect Allow or Deny
 * @param {String} resource Resource ARN
 */
const generatePolicy = (params, debug) => {
    const {
        resource, effect, message, userDetails,
    } = params;
    const authResponse = {};

    if (effect && resource) {
        authResponse.policyDocument = {
            Version: '2012-10-17',
            Statement: [{
                Action: 'execute-api:Invoke',
                Resource: resource,
                Effect: effect,
            }],
        };
    }

    if (message) {
        authResponse.context = {
            customErrorMessage: message,
        };
    }

    if (userDetails) {
        authResponse.context = userDetails;
    }

    if (debug) {
        authResponse.principalId = 'user';
        authResponse.isOffline = true;
    }

    console.log('Generated policy:', JSON.stringify(authResponse));
    return authResponse;
};

module.exports = {
    sdkAuthorizer,
    verifyCDSToken,
};
