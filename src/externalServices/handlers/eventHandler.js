const { eventManager } = require('./eventManager');
const { sendMessageToDLQ } = require('../utils/helpers');

const handler = async (event) => {
    const batchItemFailures = [];

    await Promise.all(event.Records.map(async (record) => {
        try {
            const messageBody = JSON.parse(record.body);
            const { messageId } = record;
            console.log(`Processing message ID: ${messageId}`);

            const message = JSON.parse(messageBody.Message);

            const response = await eventManager(message);
            console.log('Returning response:', JSON.stringify(response));
        } catch (error) {
            console.error(`Error processing message ID ${record.messageId}:`, error);

            if (error.cause === 'INVALID') {
                await sendMessageToDLQ(record);
                return;
            }
            batchItemFailures.push({ itemIdentifier: record.messageId });
        }
    }));
    return { batchItemFailures };
};

module.exports = { handler };
