import { decryptData } from '../auth/utils';

const aws4 = require('aws4');
const BASE_URL = process.env.REACT_APP_BASE_URL;
const ARBITER_SS_URL = `${BASE_URL}/arbiterSS`;

/**
 * Returns signed AWS4 request for axios to use
 * 1. Create options object and prepare it for to get signed by aws4 library
 * 2. Pass it to aws4 with Cognito access/secret key and sessionToken
 * 3. Return the result to the caller
 * @param dataObj - object that consists of parameters being passed to arbiterSS
 */
export const generateSignedRequest = dataObj => {
    const options = {
        host: `${process.env.REACT_APP_HOST_URL}`,
        url: ARBITER_SS_URL,
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'id-token': localStorage.getItem("adal.idtoken") || ''
        },
        data: dataObj,
        body: JSON.stringify(dataObj),
        path: `${process.env.REACT_APP_URL_PATH}`,
    };

    if (process.env.NODE_ENV === "development") {
        return options
    }
    //TODO: when using locally and AWS signature is not needed,
    // you can comment out the func bellow and return options
    let signedRequest = aws4.sign(options,
        {
        // assumes user has authenticated and we have called
        // AWS.config.credentials.get to retrieve keys and
        // session tokens
        secretAccessKey: decryptData(sessionStorage.secretAccessKey),
        accessKeyId: decryptData(sessionStorage.accessKeyId),
        sessionToken: decryptData(sessionStorage.sessionToken),
        })

        delete signedRequest.headers['Host']
        delete signedRequest.headers['Content-Length']

    return signedRequest;
}