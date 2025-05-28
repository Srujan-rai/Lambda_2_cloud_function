const { captureAWSv3Client } = require('aws-xray-sdk-core');
const { SendMessageCommand } = require('@aws-sdk/client-sqs');
const { mainQuery, updateEntry } = require('../database/prizeCatalogueTable');
const {
    splitArray, createResponse, createResponsePrizeNotFound,
} = require('./utilityFunctions');
const { uploadToS3 } = require('./aws_sdk_utils/s3Utilities');
const { getDigitalCodesQueueURL, getWinningMomentsQueueURL } = require('./aws_sdk_utils/sqsUtilities');
const { RESPONSE_BAD_REQUEST } = require('../constants/responses');
const { createSQSClientManager } = require('../awsSdkClientManager');

const sqsClientManager = createSQSClientManager();

/**
 * Process array of json digital code objects
 * and send them to SQS and update prize if prizeID partitions are used
 * @param digitalCodes - JSON array (https://www.npmjs.com/package/csvtojson) received from fileUploadListenerLambda
 * @param configurationId - configurationId for which we are inserting rows
 * @param prizeId - prizeId for with we are inserting rows
 */
const sendCodesToSQS = async (digitalCodes, configurationId, prizeId, lambdaContext) => {
    const sqs = captureAWSv3Client(sqsClientManager.getClient());
    let usePartitions = false;
    let activePartition = 0;
    let partitionNumber = 0;
    const batchSize = 1000;

    let finalState;
    let prize;
    const chunksOfVouchers = splitArray(digitalCodes, batchSize);

    console.log(`CSV LENGTH IS: ${digitalCodes.length}`);
    console.log(`chunkOfVouchers LENGTH IS: ${chunksOfVouchers.length}`);

    if (digitalCodes.length === 0) {
        return Promise.reject(createResponse(RESPONSE_BAD_REQUEST, 'No vouchers found for upload'));
    }
    try {
        const prizes = await mainQuery(configurationId, prizeId);
        prize = prizes[0];
        if (!prize) {
            return Promise.reject(createResponsePrizeNotFound(prizeId));
        }

        const existingAndNewVouchersCount = prize.total_amount + digitalCodes.length;
        // Increase partitioning if it's already enabled or enable it if threshold is passed
        if (existingAndNewVouchersCount > process.env.digitalCodesPartitioningThreshold) {
            usePartitions = true;
            // if prize.total_partitions === undefined then codes should be added without partition suffix (-1)
            partitionNumber = prize.total_partitions === undefined ? 0 : prize.total_partitions + 1;
            activePartition = prize.active_partition || 0;
        }
        finalState = prize.final_state ? prize.final_state : null;
        let counter = 1;

        // eslint-disable-next-line no-restricted-syntax
        for (const chunk of chunksOfVouchers) {
            // The below is used for larger file uploads handling;
            // The lambda timesout when trying to send large amount of codes and therefore prize entry not updated
            if (lambdaContext && lambdaContext.getRemainingTimeInMillis() <= 10000) {
                const dataToSave = getRemainingData(chunksOfVouchers.slice(counter - 1));
                await uploadRemainingData(dataToSave, configurationId, prizeId);
                if (usePartitions) {
                    return await updatePrizeEntry(configurationId, prizeId, activePartition, partitionNumber);
                }
            }
            // The below promise is to slow down the process of sending the messages to the sqs,
            // so we dont throttle our tables and writes. Please do not remove before testing thoroughly.
            // await new Promise((resolve) => setTimeout(resolve, 1300));

            console.log(`Rows to be updated: ${chunk.length}`);
            const queueUrl = getDigitalCodesQueueURL();
            // SQS message parameters
            const messageBody = {
                configurationId, vouchersToUpload: chunk, prizeId, finalState, shouldExpire: 'true',
            };
            messageBody.partitionNumber = usePartitions ? partitionNumber : null;
            const queueParams = {
                MessageBody: JSON.stringify(messageBody),
                QueueUrl: queueUrl,
                DelaySeconds: 2,
            };
            const sendCommand = new SendMessageCommand(queueParams);
            try {
                const data = await sqs.send(sendCommand);
                console.log(`Vouchers message for uploading with id: ${data.MessageId} added to queue`);
            } catch (err) {
                console.error(`Failed to send vouchers for processing to queue: ${err}`);
            }

            if (usePartitions && counter !== chunksOfVouchers.length) {
                partitionNumber += 1;
            }

            counter += 1;
        }
        if (usePartitions) {
            return await updatePrizeEntry(configurationId, prizeId, activePartition, partitionNumber);
        }
    } catch (err) {
        console.error(`Error ocurred while sending codes to SQS, ${err}`);
        throw err;
    }
};

const getRemainingData = (vouchers) => {
    const csvRows = [];
    const headers = Object.keys(vouchers[0][0]);
    csvRows.push(headers.join(','));
    convertToCSV(vouchers, csvRows, headers);
    return csvRows.join('\n');
};

const convertToCSV = (vouchers, csvRows, headers) => {
    // eslint-disable-next-line no-restricted-syntax
    for (const voucherObj of vouchers) {
        if (Array.isArray(voucherObj)) {
            convertToCSV(voucherObj, csvRows, headers);
        } else {
            const values = headers.map((header) => voucherObj[header]);
            csvRows.push(values.join(','));
        }
    }
    return csvRows;
};

const uploadRemainingData = async (csv, configurationId, prizeId) => {
    const fileName = `prizes/${prizeId}/voucherCSVs/remaining_vouchers_${Date.now()}.csv`;
    const filePath = await uploadToS3(csv, configurationId, fileName, process.env.PRIVATE_BUCKET, 'Key');
    console.log(`Remaining data uploaded to ${filePath}`);
};

const updatePrizeEntry = async (configurationId, prizeId, activePartition, partitionNumber) => {
    const params = {
        configurationId,
        prizeId,
        activePartition,
        totalPartitions: partitionNumber,
    };
    return updateEntry(params);
};

/**
 * Process array of json winning moment objects
 * and send them to SQS and update prize if prizeID partitions are used
 * @param digitalCodes - JSON array (https://www.npmjs.com/package/csvtojson) received from fileUploadListenerLambda
 * @param configurationId - configurationId for which we are inserting rows
 * @param prizeId - prizeId for with we are inserting rows
 */
const sendMomentsToSQS = async (winningMoments, configurationId) => {
    const sqs = captureAWSv3Client(sqsClientManager.getClient());
    const batchSize = 1000;
    const chunksOfMoments = splitArray(winningMoments, batchSize);
    let sendMessagesCount = 0;
    let failedMessagesCount = 0;

    console.log(`CSV LENGTH IS: ${winningMoments.length}`);
    console.log(`chunkOfVouchers LENGTH IS: ${chunksOfMoments.length}`);

    if (chunksOfMoments.length === 0) {
        return Promise.reject(createResponse(RESPONSE_BAD_REQUEST, 'No winning moments found for upload'));
    }

    /* eslint-disable */
    for (const chunk of chunksOfMoments) {
        console.log(`Rows to be updated: ${chunk.length}`);
        // The below promise is to slow down the process of sending the messages to the sqs,
        // so we dont throttle our tables and writes. Please do not remove before testing thoroughly.
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const queueUrl = getWinningMomentsQueueURL();

        // SQS message parameters
        const messageBody = { configurationId, momentsToUpload: chunk };
        const queueParams = {
            MessageBody: JSON.stringify(messageBody),
            QueueUrl: queueUrl,
        };
        const sendMessageInput = new SendMessageCommand(queueParams);
        try {
            const data = await sqs.send(sendMessageInput);
            console.log(`Winning moments for uploading with id ${data.MessageId} added to queue`);
            sendMessagesCount += 1
        } catch (err) {
            console.error(`Failed to send vouchers for processing to queue: ${err}`);
            failedMessagesCount += 1;
        }
    }
    console.log(`Sent messages: ${sendMessagesCount}, failed messages: ${failedMessagesCount}`);
    return;
};

module.exports = {
    sendCodesToSQS,
    sendMomentsToSQS,
};
