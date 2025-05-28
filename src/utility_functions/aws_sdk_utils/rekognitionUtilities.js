const { captureAWSv3Client } = require('aws-xray-sdk-core');
const { DetectModerationLabelsCommand } = require('@aws-sdk/client-rekognition');
const { createRekognitionClientManager } = require('../../awsSdkClientManager');

const rekognitionImage = async (bucketName, filePath, confidenceLevel) => {
    try {
        const manager = createRekognitionClientManager();
        const client = captureAWSv3Client(manager.getClient());

        const rekognitionParams = {
            Image: {
                S3Object: {
                    Bucket: bucketName,
                    Name: filePath,
                },
            },
            MinConfidence: confidenceLevel,
        };

        const command = new DetectModerationLabelsCommand(rekognitionParams);
        const response = await client.send(command);
        return response;
    } catch (err) {
        console.error('Error detecting moderation labels:', err);
        throw err;
    }
};

module.exports = {
    rekognitionImage,
};
