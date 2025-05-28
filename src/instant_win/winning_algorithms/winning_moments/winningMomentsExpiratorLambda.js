const { createResponse } = require('../../../utility_functions/utilityFunctions');
const { expireWinningMoments } = require('../../../database/winningMomentsTable');
const {
    getWinningMomentsExpiratonQueueURL,
    sendSQSMessage,
} = require('../../../utility_functions/aws_sdk_utils/sqsUtilities');
const { EXCEPTIONS: { THROTTLING_EXCEPTION } } = require('../../../database/dbUtilities');
const { RESPONSE_OK } = require('../../../constants/responses');
/**
 * SQS Lambda which will expire the winning moments associated with a specific prize/configuration id, so
 * they cannot be used anymore for this prize/configuration and will not carry on.
 */
const winningMomentsExpiratorLambda = async (event) => {
    try {
        if (event.Records.length > 0) {
            const failedMoments = []; let totalFailed = 0; let
                successfulCounter = 0;
            const winningMomentsToBeExpired = JSON.parse(event.Records[0].body);
            /* eslint-disable */
            for (const winningMoment of winningMomentsToBeExpired) {
                await new Promise(async (resolve) => {
                    try {
                        await expireWinningMoments(winningMoment);
                        successfulCounter += 1;
                        resolve();
                    } catch (err) {
                        // only return back to queue if DB error
                        const errBody = JSON.parse(err.body);
                        if (errBody.errorDetails && errBody.errorDetails.DynamoDBCode === THROTTLING_EXCEPTION) {
                            failedMoments.push(winningMoment);
                        } else {
                            console.error(`Update of voucher ${winningMoment.configuration_id} + ${winningMoment.gmt_start} failed with: ${err}`);
                        }
                        totalFailed += 1;
                        resolve();
                    }
                });
            }
            /* eslint-disable */
            console.log(`expired moments ${successfulCounter} , failed moments ${totalFailed}, total momemnts retried ${failedMoments.length}`);
            if (failedMoments.length > 0) {
                const queueUrl = getWinningMomentsExpiratonQueueURL();
                await sendSQSMessage({
                    MessageBody: JSON.stringify(failedMoments),
                    QueueUrl: queueUrl,
                });
            }
        }
        const response = createResponse(RESPONSE_OK, {});
        return response;
    } catch (err) {
        console.error('Failed with err: ', err);
        throw err;
    }
};

module.exports = {
    winningMomentsExpiratorLambda,
};
