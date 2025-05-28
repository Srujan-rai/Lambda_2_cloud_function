const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { deletionOfPrizeData } = require('./dynamoDbStreamProcessor/deletionOfPrizeData');

/**
 * Handler for this lambda
 * @param {Object} event - The event object containing the records to be processed.
 */
const prizeRecordProcessor = async (event) => {
    try {
        if (event?.Records && Array.isArray(event.Records)) {
            return await eventRecordService(event);
        }
    } catch (err) {
        console.error('Error encountered in prizeRecordProcessor', err);
    }
};

/**
 * Processes DynamoDB stream events
 * @param {Object} event - The event object containing the records to be processed.
 * @returns {Promise<void>} - A promise indicating the completion of the processing.
 */
const eventRecordService = async (event) => {
    try {
        const results = await Promise.all(
            event.Records.map(async (eventRecord) => {
                const {
                    eventSource, eventSourceARN, eventName, dynamodb,
                } = eventRecord;

                if (
                    eventSource === 'aws:dynamodb'
                    && eventSourceARN.includes('catalogue_table')
                    && eventName === 'REMOVE'
                ) {
                    try {
                        const unmarshalledRecord = unmarshall(dynamodb.Keys);
                        const prizeCatalogData = unmarshall(dynamodb.OldImage);
                        if (prizeCatalogData.total_partitions) {
                            unmarshalledRecord.total_partitions = prizeCatalogData.total_partitions;
                        }
                        unmarshalledRecord.voucher_dist = prizeCatalogData.voucher_dist;

                        const result = await deletionOfPrizeData(unmarshalledRecord);
                        return result;
                    } catch (error) {
                        console.error(`Error processing record: ${JSON.stringify(eventRecord)}`, error);
                    }
                } else {
                    console.log('no entries to process.');
                }
            }),
        );
        return results[0];
    } catch (error) {
        console.error('Error processing eventRecordService:', error);
        throw error;
    }
};

module.exports = {
    prizeRecordProcessor,
};
