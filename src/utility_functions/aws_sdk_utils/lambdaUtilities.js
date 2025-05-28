const { captureAWSv3Client } = require('aws-xray-sdk-core');
const { InvokeCommand } = require('@aws-sdk/client-lambda');
const { createLambdaClientManager } = require('../../awsSdkClientManager');

const lambdaClientManager = createLambdaClientManager();
const MAX_INVOKE_RETRIES = 2;

/**
 * Function that invokes lambda function.
 * @param lambdaInvokeParameters - one of lambda invoke parameters from constants.js
 * @param lambdaEvent - Payload that should be passed to the lambda (it usually is original event that started lambda chain)
 * @return Invoked lambda's response
 */
const invokeLambda = async (lambdaInvokeParameters, lambdaEvent, retries) => {
    const lambda = getLambdaClient();
    const retryCounter = defineRetryCounter(lambdaInvokeParameters.FunctionName, retries);

    try {
        const data = await lambda.send(new InvokeCommand({
            ...lambdaInvokeParameters,
            Payload: JSON.stringify(lambdaEvent),
        }));

        if (lambdaInvokeParameters.InvocationType === 'Event') return;

        const result = Buffer.from(data.Payload).toString();
        const response = JSON.parse(result);

        // Temp logic to retry transaction lambda
        if (!response) {
            console.log(`${lambdaInvokeParameters.FunctionName} returned without response`);
            return retryLambdaInvocation(retryCounter, lambdaInvokeParameters, lambdaEvent);
        }

        if (response.statusCode === 200) {
            console.log('Lambda returned success response!');
            return response;
        }

        handleError(response, 'ERROR: Lambda returned failure response:\n');
    } catch (err) {
        handleError(err, 'ERROR: Invoked lambda returned error:\n');
    }
};

const defineRetryCounter = (funcName, retries) => {
    if (!funcName.includes('transactionLambda')) return undefined;
    if (retries) return retries;
    return 0;
};

const getLambdaClient = () => {
    if (process.env.IS_OFFLINE) {
        const endpointUrl = `http://localhost:${process.env.SLS_OFFLINE_PORT || 3000}`;
        return lambdaClientManager.getClient({
            region: process.env.regionName,
            endpoint: endpointUrl,
        });
    }
    return captureAWSv3Client(lambdaClientManager.getClient());
};

const handleError = (error, message) => {
    console.error(message, JSON.stringify(error));
    throw error;
};

const retryLambdaInvocation = async (retryCounter, lambdaInvokeParameters, lambdaEvent) => {
    if (retryCounter >= MAX_INVOKE_RETRIES) {
        return handleError(new Error(), 'ERROR: Invoked lambda returned empty response');
    }

    console.log(`Lambda does not return a response. Executing with ${retryCounter + 1} retry`);
    return invokeLambda(lambdaInvokeParameters, lambdaEvent, retryCounter + 1);
};

module.exports = {
    invokeLambda,
};
