const { unmarshall } = require('@aws-sdk/util-dynamodb');
const middy = require('@middy/core');
const { fetchECReplicationGroup } = require('../middlewares/fetchECReplicationGroup');
const { fullListQuery } = require('../database/prizeCatalogueTable');
const { setupRedisClient } = require('../utility_functions/redisUtils');
const {
    putBackfillItemsIntoCache,
    prepareObjectForRedis,
    activeStatusChange,
    reconcileCacheOnDelete,
    putSingleObjectIntoCache,
} = require('./prizeCacheManagerUtils');

const redisPrizeCacheManagerLambda = async (event) => {
    const redisClient = setupRedisClient(event.eccReplicationGroup?.ReplicationGroups[0]?.NodeGroups[0]?.PrimaryEndpoint);
    const redisHashGetter = async (hashToGet, keyToGet) => {
        const result = await redisClient.hget(hashToGet, keyToGet);
        return result;
    };
    /* eslint-disable-next-line */
  for (const record of event.Records) {
        if (record.eventName !== 'REMOVE') {
            const unmarshalledNewImage = unmarshall(record.dynamodb.NewImage);
            const redisPrizeListHashKey = `${unmarshalledNewImage.configuration_id}#prizeList`;
            const prizeInfoAvailableInCache = await redisClient.hgetall(redisPrizeListHashKey);

            if (record.eventName === 'INSERT') {
                const prizeStatus = unmarshalledNewImage.active ? 'activePrizes' : 'inactivePrizes';
                if (Object.keys(prizeInfoAvailableInCache).length === 0 && prizeInfoAvailableInCache.constructor === Object) {
                    const backfillRecordsAvailable = await fullListQuery(unmarshalledNewImage.configuration_id, 'richtext');
                    // This is the case where records have existed in the database prior to the cache being enabled.
                    // a backfill is required to reconcicle the DB and the cache
                    await putBackfillItemsIntoCache([...backfillRecordsAvailable], redisPrizeListHashKey, redisClient);
                } else {
                    const theCacheStateIs = await redisHashGetter(redisPrizeListHashKey, prizeStatus);
                    const joinedPrizes = JSON.parse(theCacheStateIs);
                    joinedPrizes.push(unmarshalledNewImage.prize_id);
                    Promise.allSettled([
                        await redisClient.hset(unmarshalledNewImage.prize_id, prepareObjectForRedis(unmarshalledNewImage)),
                        await redisClient.hset(redisPrizeListHashKey, {
                            [prizeStatus]: `["${joinedPrizes.join('","')}"]`,
                        }),
                    ]);
                }
            }
            if (record.eventName === 'MODIFY') {
                const unmarshalledOldImage = unmarshall(record.dynamodb.OldImage);
                if (Object.keys(prizeInfoAvailableInCache).length > 0 && prizeInfoAvailableInCache.constructor === Object) {
                    if (unmarshalledNewImage.active !== unmarshalledOldImage.active) {
                        await activeStatusChange(redisPrizeListHashKey, unmarshalledNewImage, redisClient);
                    } else {
                        await putSingleObjectIntoCache(unmarshalledNewImage, redisClient);
                    }
                } else {
                    const backfillRecordsAvailable = await fullListQuery(unmarshalledNewImage.configuration_id, 'richtext');
                    await putBackfillItemsIntoCache(backfillRecordsAvailable, redisPrizeListHashKey, redisClient);
                }
            }
        } else {
            const unmarshalledOldImage = unmarshall(record.dynamodb.OldImage);
            await reconcileCacheOnDelete(`${unmarshalledOldImage.configuration_id}#prizeList`, unmarshalledOldImage, redisClient);
        }
    }
    await redisClient.disconnect();
};

module.exports = {
    redisPrizeCacheManagerLambda: middy(redisPrizeCacheManagerLambda)
        .use(fetchECReplicationGroup({}, `${process.env.stageName}-redis-cache`)),
};
