const DigitalCodes = require('../../database/digitalCodesTable');
const { ERROR_CODES, ERR_CODES } = require('../../constants/errCodes');
const { RESPONSE_OK, RESPONSE_INTERNAL_ERROR } = require('../../constants/responses');
const { queryWithPagination } = require('../../database/dbUtilities');
const { createErrBody, createResponse, splitArray } = require('../../utility_functions/utilityFunctions');
const { getDigitalCodesExpirationQueueURL, sendSQSMessage } = require('../../utility_functions/aws_sdk_utils/sqsUtilities');

const queueUrl = getDigitalCodesExpirationQueueURL();

/**
 * Lambda function triggered recurrently every 24h. Sends codes to SQS expiration queue
 * Codes that reached the prize final_state attribute and "removed" codes are not expired
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
module.exports.digitalCodesStatusUpdater = async () => {
    try {
        // Prevent executing it on local while debugging
        if (process.env.IS_OFFLINE) {
            return;
        }
        const queryParams = DigitalCodes.createExpirableParams();
        const message = await queryAndProcess(queryParams);
        return createResponse(RESPONSE_OK, { message });
    } catch (err) {
        console.error('ERROR: Failed to update digital codes status:\n', err);
        throw err;
    }
};

/**
 * The previous amount of processing items was 1000, however lowered it to 500 items per message in order to scale down the the speed of,
 * expiration/upload. Promising the items in a loop rather then sending them straight away, again done with purpose to slow down the speed.
 * Do not re-writte using faster approaches without throroughly testing first.
 * @param {*} itemsArr
 */
const processItems = async (itemsArr) => {
    if (itemsArr.length > 500) {
        const chunksOfCodes = splitArray(itemsArr, 500);
        // eslint-disable-next-line
        for (const chunk of chunksOfCodes) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await sendSQSMessage({
                MessageBody: JSON.stringify(chunk),
                QueueUrl: queueUrl,
            });
        }
    } else {
        await sendSQSMessage({
            MessageBody: JSON.stringify(itemsArr),
            QueueUrl: queueUrl,
        });
    }
};

const queryAndProcess = async (queryParams) => {
    console.log('Query params:\n', JSON.stringify(queryParams));
    let message;
    try {
        const result = await queryWithPagination(queryParams, true);
        if (!result.dataReceived.length) {
            message = 'No codes for expiration found';
            return message;
        }
        console.log(`Sending ${result.dataReceived.length} items to be processed to SQS.`);
        await processItems(result.dataReceived);

        if (!result.nextKey) {
            console.log('No more items! Processing result ...');
            message = 'Data items have been processed.';
            return message;
        }

        console.log('More items to query. Continuing...');
        return queryAndProcess({
            ...queryParams,
            ExclusiveStartKey: result.nextKey,
        });
    } catch (err) {
        console.error('ERROR: Failed to query', queryParams.TableName, 'table:\n', err);
        const errorBody = createErrBody(ERR_CODES.DYNAMO_DB_ERROR_QUERY, 'Failed to read data', undefined, ERROR_CODES.DYNAMO_DB_ERROR);
        const response = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
        throw response;
    }
};
