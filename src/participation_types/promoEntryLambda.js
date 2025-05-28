const uniqid = require('uniqid');
const warmer = require('lambda-warmer');
const Messages = require('@the-coca-cola-company/ngps-global-common-messages');
const { middyValidatorWrapper } = require('../middlewares/middyValidatorWrapper');
const {
    extractParams,
    extractRequestId,
    checkPassedParameters,
    prepareBase64ImageToUpload,
    createResponse,
    createErrBody,
    getExpirationTimestamp,
} = require('../utility_functions/utilityFunctions');
const { getConfiguration } = require('../utility_functions/configUtilities');
const { saveToS3 } = require('../utility_functions/aws_sdk_utils/s3Utilities');
const { invokeLambda } = require('../utility_functions/aws_sdk_utils/lambdaUtilities');
const ParticipationTable = require('../database/participationsDatabase');
const BlockedUsersUtils = require('../utility_functions/blockedUsersUtilities');
const { REQUIRED_PARAMETERS_FOR_LAMBDA, CONFIGURATION_FUNCTIONS_MAP } = require('../constants/lambdas');
const { RESPONSE_OK, RESPONSE_BAD_REQUEST } = require('../constants/responses');
const { PARAMS_MAP } = require('../constants/common');
const { ERR_CODES, ERROR_CODES } = require('../constants/errCodes');

const basePromoEntryLambda = async (event) => {
    try {
        if (await warmer(event)) return 'warmed';

        const params = extractParams(event);
        await BlockedUsersUtils.checkIsUserBlocked(params);
        let expirationTimestamp = Math.floor((new Date().setFullYear(new Date().getFullYear() + 10)) / 1000); // 10 years from now in sec
        const configExtracted = await getConfiguration(params.configurationId, event);
        expirationTimestamp = getExpirationTimestamp(configExtracted);
        let response = {};

        if (params.entryType === 'image') {
            // throw error if the image entry functionality is not enabled
            if (configExtracted.flow[params.flowLabel].params.imageEntry !== true) {
                const errorBody = createErrBody(ERR_CODES.INVALID_REQUEST_PARAMETERS,
                    Messages.COMMON_ERR.INVALID_REQUEST_PARAMETERS, 'Image entry functionality is not enabled for this configuration.', ERROR_CODES.INVALID_PARAMETER);
                throw createResponse(RESPONSE_BAD_REQUEST, errorBody);
            }

            // throw error if participationImage is missing in the request
            const imageEntryRequiredParams = REQUIRED_PARAMETERS_FOR_LAMBDA.promoEntryLambdaWithImageEntry;
            checkPassedParameters(params.optionalInformation, imageEntryRequiredParams);

            // invoke ssFileUpload to get policy for S3 image upload
            const participationId = uniqid();
            const uploadEvent = { ...event };
            const uploadEventBody = extractParams(event);
            uploadEventBody.flowLabel = 'imageUploadParticipation';
            uploadEventBody.configuration = configExtracted;
            uploadEventBody.fileName = `${participationId}.png`;
            uploadEventBody.imageUploadParticipation = true;
            uploadEvent.body = JSON.stringify(uploadEventBody);

            const requestUploadUrlResult = await invokeLambda(CONFIGURATION_FUNCTIONS_MAP.ssFileUpload, uploadEvent);

            const { fileUploadDetails } = JSON.parse(requestUploadUrlResult.body);
            const { acl, key } = fileUploadDetails.clientConditions;
            const { bucket } = fileUploadDetails.plainPolicy.conditions[0];
            const tags = `config_id=${params[PARAMS_MAP.CONFIGURATION_ID]}&participation_type=image`;

            await saveToS3({
                Key: key,
                Body: prepareBase64ImageToUpload(params.optionalInformation.participationImage),
                Bucket: bucket,
                ACL: acl,
                ContentType: 'image',
                Tagging: tags,
            });

            console.log('Succesfully save the image to: ', `${bucket}/${key}`);

            // Update participation image to image url in the event body
            params.optionalInformation.participationImage = `${bucket}/${key}`;
            event.body = JSON.stringify(params);

            await ParticipationTable.addItemToParticipation(params,
                extractRequestId(event),
                { participationId, promoEntryParticipation: true, endOfConf: expirationTimestamp });
            response = createResponse(RESPONSE_OK, { participationInserted: true, participationImage: `${bucket}/${key}`, participationId });
        } else {
            await ParticipationTable.addItemToParticipation(
                params,
                extractRequestId(event),
                { promoEntryParticipation: true, endOfConf: expirationTimestamp });
            response = createResponse(RESPONSE_OK, { participationInserted: true });
        }

        console.log('Returning promo entry response successfully!');
        return response;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', errorResponse);
        return errorResponse;
    }
};

module.exports.promoEntryLambda = middyValidatorWrapper(basePromoEntryLambda, REQUIRED_PARAMETERS_FOR_LAMBDA.promoEntryLambda);
