const bluebird = require('bluebird');
const middy = require('@middy/core');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { processCache } = require('../middlewares/utils');
const { createS3FileParams } = require('../utility_functions/aws_sdk_utils/s3Utilities');
const { fetchECReplicationGroup } = require('../middlewares/fetchECReplicationGroup');
const { setupRedisClient } = require('../utility_functions/redisUtils');
const { createResponse } = require('../utility_functions/utilityFunctions');
const { createLeaderboardExpirySchedule } = require('./leaderboardUtils');
const { TRANSACTION_TYPES } = require('../constants/common');
const { RESPONSE_OK } = require('../constants/responses');

const handler = async (event) => {
    const recordsCount = event.Records.length;
    const options = {
        cacheExpiry: parseInt(process.env.CACHE_EXPIRY || 600000),
    };
    const eccEndpoint = event.eccReplicationGroup?.ReplicationGroups[0]?.NodeGroups[0]?.PrimaryEndpoint;
    const redisClient = setupRedisClient(eccEndpoint);

    try {
        const processRecord = async (record, idx) => {
            try {
                const eventId = record.eventID;
                console.log(`Event id: ${eventId}`);
                const processedEventKey = `processed_event:${eventId}`;
                const isDuplicate = await redisClient.exists(processedEventKey);
                if (isDuplicate) {
                    console.log(`Skipping duplicate event: ${eventId}`);
                    return;
                }
                const unmarshalledNewImage = unmarshall(record.dynamodb?.NewImage);
                console.log(`Processing record ${idx + 1} of ${recordsCount}:`);
                const {
                    configuration_id,
                    currency_id,
                    transaction_type,
                    transaction_timestamp,
                    amount,
                    gpp_user_id,
                } = unmarshalledNewImage;
                const { value } = processCache(
                    { ...options, cacheKey: configuration_id },
                    async (objectKey) => createS3FileParams(objectKey, 'application/json'),
                    configuration_id,
                );
                const { leaderboard } = await value;

                if (leaderboard && leaderboard.currencyIds?.includes(currency_id)
                    && transaction_type === TRANSACTION_TYPES.earn && leaderboard.expiresAt > transaction_timestamp) {
                    const sortedSetKey = `leaderboard:${configuration_id}:${currency_id}`;
                    const setExists = await redisClient.exists(sortedSetKey);
                    if (!setExists) {
                        await createLeaderboardExpirySchedule(sortedSetKey, configuration_id, leaderboard.expiresAt, eccEndpoint);
                    }
                    const newAmount = await redisClient.zincrby(sortedSetKey, amount, gpp_user_id);
                    await redisClient.set(processedEventKey, '1', 'NX', 'EX', 86400);
                    console.log(`User ${gpp_user_id} with new amount ${newAmount}`);
                }
            } catch (err) {
                console.error('Error while processing record:', err);
                throw err;
            }
        };

        await bluebird.map(
            event.Records, (record, idx) => processRecord(record, idx), { concurrency: 15 },
        );
        return createResponse(RESPONSE_OK, { message: 'Event processed successfully' });
    } catch (err) {
        console.error('ERROR:', err);
        throw err;
    } finally {
        await redisClient.disconnect();
    }
};

module.exports = {
    handler: middy(handler)
        .use(fetchECReplicationGroup({}, `${process.env.stageName}-leaderboard-cache`)),
};
