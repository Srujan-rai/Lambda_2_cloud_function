const {
    COMMON_ERR: { INTERNAL_SERVER_ERROR },
} = require('@the-coca-cola-company/ngps-global-common-messages');
const { captureAWSv3Client } = require('aws-xray-sdk-core');
const { SQSClient, SendMessageCommand } = require('@aws-sdk/client-sqs');
const { STS } = require('@aws-sdk/client-sts');
const { UNKNOWN_REASON } = require('./constants/errCodes');
const {
    createResponse,
    createErrBody,
    extractPostParams,
} = require('./utility_functions/utilityFunctions');
const {
    RESPONSE_OK,
    RESPONSE_INTERNAL_ERROR,
} = require('./constants/responses');
const {
    PARAMS_MAP: { MESSAGE_BODY },
} = require('./constants/common');
const cdsRoleUtils = require('./utility_functions/cdsRoleUtils');
const { CUSTOM_EVENT_PARAMS: { ENV_DETAILS } } = require('./utility_functions/eventUtilities');

/**
 * @param {Object} event - Event must have body: {messageBody, token}
 *
 * This method will decrypt the token and will push message in correct cds message service.
 * When token is decrypted region and stage will be extracted from the issuer.
 * QueueUrl will be generated based on the stage and region.
 */
module.exports.sendMessage = async (event) => {
    try {
        const body = extractPostParams(event);

        let envDetails = body[ENV_DETAILS] ?? {};

        if (typeof envDetails === 'string') {
            envDetails = JSON.parse(envDetails);
        }

        const { stage, region } = envDetails;

        if (!stage || !region) {
            throw new Error(`Couldn't extract stage or region! \n Body: ${body}`);
        }

        const sts = new STS();

        const ctx = await sts.assumeRole({
            RoleArn: `arn:aws:sts::${cdsRoleUtils.CDS_ACCOUNT_ID_MAP[region][stage]}:role/${cdsRoleUtils.getCdsRoleName(stage, region)}`,
            RoleSessionName: 'promo-plus-referral-rewards',
        });

        const awsRegion = cdsRoleUtils.CDS_AWS_REGION_MAP[region];

        const sqs = captureAWSv3Client(new SQSClient({
            credentials: {
                accessKeyId: ctx.Credentials.AccessKeyId,
                secretAccessKey: ctx.Credentials.SecretAccessKey,
                sessionToken: ctx.Credentials.SessionToken,
            },
            region: awsRegion,
        }));

        const messageBody = body[MESSAGE_BODY];

        messageBody.recipient = messageBody.recipient || body.userId;

        const messageSendCommand = new SendMessageCommand({
            MessageBody: JSON.stringify(messageBody),
            QueueUrl: cdsRoleUtils.getCdsQueueName(stage, region),
        });

        const data = await sqs.send(messageSendCommand);
        console.log(`New message with id: ${data.MessageId} added to cds queue,
            Region: ${awsRegion}(${region}), Stage: ${stage}`);

        return createResponse(RESPONSE_OK, { messageSent: true });
    } catch (error) {
        console.error('Error while sending message... ', error);
        return createResponse(
            RESPONSE_INTERNAL_ERROR,
            createErrBody(UNKNOWN_REASON, INTERNAL_SERVER_ERROR, {
                messageSent: false,
            }),
        );
    }
};
