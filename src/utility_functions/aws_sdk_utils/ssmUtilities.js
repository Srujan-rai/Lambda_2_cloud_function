const { captureAWSv3Client } = require('aws-xray-sdk-core');
const { GetParametersCommand, PutParameterCommand } = require('@aws-sdk/client-ssm');
const { createSSMClientManager } = require('../../awsSdkClientManager');

const ssmClientManager = createSSMClientManager();

/**
 * Function for taking specific parameters from SSM. Params are collected in the values array and then
 * spread into the query object which enables us to query as many values as needed.
 * @param {Array} values - Collects the values being passed in and spreads them into the query object
 * @returns {Object/Array} - Depending on if any values are found in SSM we will return either and object
 * with values or empty array.
 */
const getParametersFromSSM = async (...values) => {
    const ssmClient = captureAWSv3Client(ssmClientManager.getClient());
    const getParamCommand = new GetParametersCommand({
        Names: values,
        WithDecryption: true,
    });
    const { Parameters } = await ssmClient.send(getParamCommand);

    if (!Parameters.length) {
        throw new Error(`Parameters ${values} can not be found in SSM`);
    }

    const ssmParams = Parameters.reduce((acc, param) => ({ ...acc, [param.Name]: param.Value }), {});

    return ssmParams;
};

/**
 * Function for adding parameter in SSM.
 * @param {Array} parameterInput - PutParameter command request
 * @returns {Promise}
 */

const putParameterInSSM = async (parameterInput) => {
    const ssmClient = captureAWSv3Client(ssmClientManager.getClient());
    const command = new PutParameterCommand(parameterInput);
    return ssmClient.send(command);
};

module.exports = {
    getParametersFromSSM,
    putParameterInSSM,
};
