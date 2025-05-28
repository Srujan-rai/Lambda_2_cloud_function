const { S3Client } = require('@aws-sdk/client-s3');
const { SQSClient } = require('@aws-sdk/client-sqs');
const { LambdaClient } = require('@aws-sdk/client-lambda');
const { SNSClient } = require('@aws-sdk/client-sns');
const { SSMClient } = require('@aws-sdk/client-ssm');
const { SESClient } = require('@aws-sdk/client-ses');
const { KinesisClient } = require('@aws-sdk/client-kinesis');
const { SchedulerClient } = require('@aws-sdk/client-scheduler');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { NodeHttpHandler } = require('@smithy/node-http-handler');
const { APIGatewayClient } = require('@aws-sdk/client-api-gateway');
const { CloudWatchLogsClient } = require('@aws-sdk/client-cloudwatch-logs');
const { RekognitionClient } = require('@aws-sdk/client-rekognition');

const region = process.env.regionName;
const dbTimeoutOptions = {
    maxAttempts: 3,
    requestHandler: new NodeHttpHandler({
        requestTimeout: 1400,
    }),
};

const createClientManager = (ClientConstructor) => {
    let clientInstance;

    const getClient = (params = {}) => {
        if (!clientInstance) {
            clientInstance = new ClientConstructor({ region, ...params });
        }
        return clientInstance;
    };

    return { getClient };
};

const createDocClientManager = () => {
    let docClient;

    const getDocClient = (params = {}) => {
        if (!docClient) {
            const config = process.env.stageName !== 'localTesting'
                ? { region, ...dbTimeoutOptions, ...params }
                : {
                    region: 'eu-west-1',
                    endpoint: 'http://127.0.0.1:8004',
                    credentials: {
                        accessKeyId: 'test',
                        secretAccessKey: 'test',
                    },
                };
            const client = new DynamoDBClient(config);
            docClient = DynamoDBDocumentClient.from(client);
        }
        return docClient;
    };

    return { getDocClient };
};

const createS3ClientManager = () => createClientManager(S3Client);

const createSQSClientManager = () => createClientManager(SQSClient);

const createKinesisClientManager = () => createClientManager(KinesisClient);

const createLambdaClientManager = () => createClientManager(LambdaClient);

const createSNSClientManager = () => createClientManager(SNSClient);

const createSchedulerClientManager = () => createClientManager(SchedulerClient);

const createSSMClientManager = () => createClientManager(SSMClient);

const createSESClientManager = () => createClientManager(SESClient);

const createAPIGatewayClientManager = () => createClientManager(APIGatewayClient);

const createCloudWatchLogsClientManager = () => createClientManager(CloudWatchLogsClient);

const createRekognitionClientManager = () => createClientManager(RekognitionClient);

module.exports = {
    createSchedulerClientManager,
    createS3ClientManager,
    createSQSClientManager,
    createLambdaClientManager,
    createSNSClientManager,
    createSSMClientManager,
    createDocClientManager,
    createSESClientManager,
    createKinesisClientManager,
    createAPIGatewayClientManager,
    createCloudWatchLogsClientManager,
    createRekognitionClientManager,
};
