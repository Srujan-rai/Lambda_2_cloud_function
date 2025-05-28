import { CognitoIdentityClient } from"@aws-sdk/client-cognito-identity";
import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import jwt from 'jsonwebtoken';
import { encryptData } from "./utils";
/**
 * Request temp credentials from cognito identity pool
 * 1. Gets the Azure token from sessionStorage
 * 2. Use it to build aws-sdk cred get request
 * 3. Save access/secret key + sessionToken to sessionStorage
 * @param dataObj - object that consists of parameters being passed to arbiterSS
 */
export const authenticateCognito = async () => {
    const azureResponse = localStorage.getItem("adal.idtoken");
    const idpUrl = process.env.REACT_APP_IDP_URL;
    const identityPoolId = process.env.REACT_APP_COGNITO_IDENTITY_POOL_ID;
    const region = process.env.REACT_APP_COGNITO_REGION;

    const cognitoIdentityClient = new CognitoIdentityClient({
        region,
        credentials: fromCognitoIdentityPool({
            clientConfig: { region },
            identityPoolId,
            logins: {
                [idpUrl + '/v2.0']: azureResponse
            }
        })
    })
    window.history.replaceState({}, 0, window.location.pathname);
    try {
        const credentials = await cognitoIdentityClient.config.credentials()
        console.log('You are logged into COGNITO.');
        const { accessKeyId, secretAccessKey, sessionToken} = credentials;
        sessionStorage.setItem('accessKeyId', encryptData(accessKeyId));
        sessionStorage.setItem('secretAccessKey', encryptData(secretAccessKey));
        sessionStorage.setItem('sessionToken', encryptData(sessionToken));
        return getUserRole()
    } catch(err) {
        console.log("ERROR: An error occured " + JSON.stringify(err));
        console.log('You are NOT logged into COGNITO.');
        throw err;
    }
}

export const getUserRole = () => {
    let azureResponse = localStorage.getItem("adal.idtoken");
    let decodedToken = jwt.decode(azureResponse);
    let koId = decodedToken.preferred_username && decodedToken.preferred_username.split('@')[0];
    return Promise.resolve(koId);
}
