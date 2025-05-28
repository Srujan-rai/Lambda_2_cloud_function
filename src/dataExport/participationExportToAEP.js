const { unmarshall } = require('@aws-sdk/util-dynamodb');

const aepExportUtils = require('./aepExportUtils');

/**
 * Lambda function that processes events from dynamoDB stream to push Participation Data to AEP
 * @param event - data that we receive from request
 *
 */
module.exports.participationExportToAEP = async (event) => {
    await Promise.all(event.Records.map(async (item) => {
        if (item.dynamodb && item.dynamodb.NewImage) {
            const participationData = unmarshall(item.dynamodb.NewImage);
            await aepExportUtils.exportParticipationToAEP(participationData);
        }
    }));
};
