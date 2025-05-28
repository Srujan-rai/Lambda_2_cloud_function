const middy = require('@middy/core');
const { fetchS3Config } = require('../../middlewares/fetchS3Config');
const { extractRequestParams } = require('../../middlewares/extractRequestParams');
const { createResponse } = require('../../utility_functions/utilityFunctions');
const { RESPONSE_OK } = require('../../constants/responses');
const { callExternalService } = require('../../middlewares/callExternalService');
const { determinePluginRoute } = require('../../middlewares/determinePluginRoute');

const uploadImage = async (event) => {
    const { calledServiceResponse, calledService } = event;
    if (calledServiceResponse && calledService) {
        console.log(`Called service for image upload ${calledService}`);
        return createResponse(RESPONSE_OK, calledServiceResponse);
    }
    return createResponse(RESPONSE_OK, {});
};

module.exports = {
    uploadImage: middy(uploadImage)
        .use(extractRequestParams())
        .use(fetchS3Config())
        .use(determinePluginRoute('uploadImage'))
        .use(callExternalService('uploadImage')),
};
