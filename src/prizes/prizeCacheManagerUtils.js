const Moment = require('moment-timezone');
const {
    localizedFullListQuery, fullListQuery, convertPrizeAttributesToPlainText, determineIfCNG, addStartEndDatesIfMissing,
} = require('../database/prizeCatalogueTable');
const {
    copyAsCamelCase,
} = require('../utility_functions/utilityFunctions');

/* This is required since all redis has values are stored as strings.
    Having some of the prize values being objects such as  "name": {"bg-BG": "bgname"}
    will end up as [object Object] when stored and therefore render it
    unusable later when fetched
    */

const prepareObjectForRedis = (objectToPrep) => {
    const preparedObject = objectToPrep;
    Object.keys(preparedObject).forEach((key) => {
        if (typeof preparedObject[key] === 'object') {
            preparedObject[key] = JSON.stringify(preparedObject[key]);
        }
    });
    return preparedObject;
};

const showCorrectFlagInResponse = (prizeObjects, inputCurrTime, setFlagTo) => prizeObjects.map((prize) => {
    let actualStatus;
    if (setFlagTo !== undefined) {
        actualStatus = setFlagTo;
    } else if ((prize?.end_date > inputCurrTime && prize?.start_date < inputCurrTime)) {
        actualStatus = 'true';
    } else if ((prize?.end_date < inputCurrTime) || (prize?.start_date > inputCurrTime)) {
        actualStatus = 'false';
    }
    return { ...prize, active: actualStatus };
});

const filterBasedOnTimestamp = (fullPrizeList, inputPostFetchCNGFilter) => {
    const currTime = Moment().unix() * 1000;
    let cngFilteredPrizes;
    switch (inputPostFetchCNGFilter) {
        case 'active':
            cngFilteredPrizes = showCorrectFlagInResponse((fullPrizeList.filter((prize) => (prize?.end_date > currTime && prize?.start_date < currTime))), currTime, 'true');
            break;
        case 'available':
            cngFilteredPrizes = showCorrectFlagInResponse((fullPrizeList.filter((prize) => (prize?.end_date > currTime && prize?.start_date < currTime && prize?.total_available > 0))), currTime, 'true');
            break;
        case 'inactive':
            cngFilteredPrizes = showCorrectFlagInResponse((fullPrizeList.filter((prize) => (prize?.end_date < currTime || prize?.start_date > currTime))), currTime, 'false');
            break;
        case 'all':
            cngFilteredPrizes = showCorrectFlagInResponse(fullPrizeList, currTime);
            break;
        default:
            cngFilteredPrizes = showCorrectFlagInResponse((fullPrizeList.filter((prize) => (prize?.end_date > currTime && prize?.start_date < currTime))), currTime, 'true');
    }
    return cngFilteredPrizes;
};

const fetchCachedIndividualPrizes = async (filter, prizeListInfo, isCNG, inputConfigStart, inputConfigEnd, redisClientInput) => {
    let prizesToQueryFor;
    const postFetchCNGFilter = filter;
    // eslint-disable-next-line
    isCNG && (filter = 'all');
    switch (filter) {
        case 'active':
            prizesToQueryFor = JSON.parse(prizeListInfo.activePrizes);
            break;
        case 'available':
            prizesToQueryFor = JSON.parse(prizeListInfo.activePrizes);
            break;
        case 'inactive':
            prizesToQueryFor = JSON.parse(prizeListInfo.inactivePrizes);
            break;
        case 'all':
            prizesToQueryFor = JSON.parse(prizeListInfo.inactivePrizes);
            prizesToQueryFor.push(...JSON.parse(prizeListInfo.activePrizes));
            break;
        default:
            prizesToQueryFor = JSON.parse(prizeListInfo.activePrizes);
    }
    let prizeObjectsFetchedFromCache = await Promise.all(prizesToQueryFor.map((prizeInList) => redisClientInput.hgetall(prizeInList)));
    if (isCNG) {
        const startEndDateFilledPrizes = addStartEndDatesIfMissing(prizeObjectsFetchedFromCache, inputConfigStart, inputConfigEnd);
        return filterBasedOnTimestamp(startEndDateFilledPrizes, postFetchCNGFilter);
    }
    prizeObjectsFetchedFromCache = (filter === 'available') ? prizeObjectsFetchedFromCache.filter((prizeObject) => prizeObject.total_available > 0) : prizeObjectsFetchedFromCache;
    return prizeObjectsFetchedFromCache;
};

const putSingleObjectIntoCache = async (inputImage, inputRedisClient) => {
    await inputRedisClient.hset(inputImage.prize_id, prepareObjectForRedis(inputImage));
};

const putBackfillItemsIntoCache = async (itemsToBackfill, configHash, redisClientInput) => {
    const promises = [];
    const preparedActivePrizesList = [];
    const preparedInactivePrizesList = [];
    itemsToBackfill.forEach((prizeItem) => {
        if (prizeItem.active) {
            preparedActivePrizesList.push(prizeItem.prize_id);
        } else {
            preparedInactivePrizesList.push(prizeItem.prize_id);
        }
        promises.push(redisClientInput.hset(prizeItem.prize_id, prepareObjectForRedis(prizeItem)));
    });
    promises.push(
        redisClientInput.hset(configHash, {
            activePrizes: preparedActivePrizesList.length > 0 ? `["${preparedActivePrizesList.join('","')}"]` : '[]',
            inactivePrizes: preparedInactivePrizesList.length > 0 ? `["${preparedInactivePrizesList.join('","')}"]` : '[]',
        }),
    );
    return Promise.allSettled(promises);
};

const activeStatusChange = async (inputConfigHashKey, inputNewImage, inputRedisClient) => {
    const currentCacheState = await inputRedisClient.hgetall(inputConfigHashKey);
    const parsedInactiveCacheList = currentCacheState.inactivePrizes ? JSON.parse(currentCacheState.inactivePrizes) : [];
    const parsedActiveCacheList = currentCacheState.activePrizes ? JSON.parse(currentCacheState.activePrizes) : [];
    let formattedInactiveCacheList;
    let formattedActiveCacheList;
    if (inputNewImage.active) {
        parsedActiveCacheList.push(inputNewImage.prize_id);
        const filteredInactiveCacheList = parsedInactiveCacheList?.filter((prizeId) => prizeId !== inputNewImage.prize_id);
        formattedInactiveCacheList = filteredInactiveCacheList.length > 0 ? `["${filteredInactiveCacheList.join('","')}"]` : '[]';
        formattedActiveCacheList = parsedActiveCacheList.length > 0 ? `["${parsedActiveCacheList.join('","')}"]` : '[]';
    }
    if (!inputNewImage.active) {
        parsedInactiveCacheList.push(inputNewImage.prize_id);
        const filteredActiveCacheList = parsedActiveCacheList?.filter((prizeId) => prizeId !== inputNewImage.prize_id);
        formattedActiveCacheList = filteredActiveCacheList.length > 0 ? `["${filteredActiveCacheList.join('","')}"]` : '[]';
        formattedInactiveCacheList = parsedInactiveCacheList.length > 0 ? `["${parsedInactiveCacheList.join('","')}"]` : '[]';
    }
    const updatedPrizeListHash = {
        activePrizes: formattedActiveCacheList,
        inactivePrizes: formattedInactiveCacheList,
    };
    return Promise.allSettled([
        await inputRedisClient.hset(inputConfigHashKey, updatedPrizeListHash),
        await inputRedisClient.hset(inputNewImage.prize_id, prepareObjectForRedis(inputNewImage)),
    ]);
};

const listPrizesRedisScenario = async (
    inputRedisClient,
    inputConfigurationId,
    filter,
    language,
    responseType,
    inputS3ClientConfig,
    filterRegularResult,
) => {
    const redisPrizeListHashKey = `${inputConfigurationId}#prizeList`;
    const prizeInfoAvailableInCache = await inputRedisClient.hgetall(redisPrizeListHashKey);
    if (Object.keys(prizeInfoAvailableInCache).length > 0 && prizeInfoAvailableInCache.constructor === Object) {
        const fetchedCachePrizes = await fetchCachedIndividualPrizes(
            filter, prizeInfoAvailableInCache,
            determineIfCNG(inputS3ClientConfig?.flow),
            inputS3ClientConfig?.configurationParameters?.configurationStartUtc,
            inputS3ClientConfig?.configurationParameters?.configurationEndUtc,
            inputRedisClient);
        /* eslint-disable-next-line */
    return fetchedCachePrizes.map((prizeObject) => localizeCachedPrizeObject(inputS3ClientConfig?.configurationParameters?.language, language, prizeObject, responseType));
    }
    const dbResult = await localizedFullListQuery(inputS3ClientConfig, language, filter, responseType);
    if (dbResult.length > 0) {
        const recordsToBackfill = await fullListQuery(inputConfigurationId, responseType);
        await putBackfillItemsIntoCache(recordsToBackfill, redisPrizeListHashKey, inputRedisClient);
    }
    return filterRegularResult(dbResult, responseType);
};

const removeItemFromList = (currentCachedPrizeList, imagePrizeId) => ({
    activePrizes: JSON.parse(currentCachedPrizeList.activePrizes).filter((prizeId) => prizeId !== imagePrizeId).length
        ? `["${JSON.parse(currentCachedPrizeList.activePrizes)
            .filter((prizeId) => prizeId !== imagePrizeId)
            .join('","')}"]`
        : '[]',
    inactivePrizes: JSON.parse(currentCachedPrizeList.inactivePrizes).filter((prizeId) => prizeId !== imagePrizeId).length
        ? `["${JSON.parse(currentCachedPrizeList.inactivePrizes)
            .filter((prizeId) => prizeId !== imagePrizeId)
            .join('","')}"]`
        : '[]',
});

const removeItemFromCache = async (prizeObjectInput, redisInputClient, currentPrizeList, inputConfigHashKey) => {
    const hashKeysToDelete = Object.keys(prizeObjectInput.prizeObject);
    const deletionResults = [];
    if (hashKeysToDelete) {
        hashKeysToDelete.forEach((key) => {
            deletionResults.push(redisInputClient.hdel(prizeObjectInput.prize_id, key));
        });
        await Promise.all(deletionResults);
    }
    console.log('the list is', removeItemFromList(currentPrizeList, prizeObjectInput.prize_id));
    return redisInputClient.hset(
        inputConfigHashKey,
        removeItemFromList(currentPrizeList, prizeObjectInput.prize_id),
    );
};
// This function is present in the case where
// for whatever reason we need to purge the cache without having to reset the nodes.
// This piece of code can be ran out of the prizeQuery lambda
// const purgeCache = async (inputRedisClient) => {
//     try {
//         const flushResult = await inputRedisClient.flushall()
//         console.log('The flush result is ', flushResult);
//         return flushResult;
//     } catch (error) {
//         console.log('The flush failed with', error);
//     }
// }

const reconcileCacheOnDelete = async (inputConfigHashKey, oldImageInput, redisInputClient) => {
    const currentPrizeList = await redisInputClient.hgetall(inputConfigHashKey);
    if (Object.keys(currentPrizeList).length !== 0 && currentPrizeList.constructor === Object) {
        const promises = [];
        const DBPrizeList = await fullListQuery(oldImageInput.configuration_id, 'richtext');
        const cachedPrizeIds = [...JSON.parse(currentPrizeList.activePrizes), ...JSON.parse(currentPrizeList.inactivePrizes)];
        const DBprizeIds = DBPrizeList.map((prize) => prize.prize_id);
        const leftoverCachedPrizeIds = cachedPrizeIds
            .map((prizeId) => (DBprizeIds.includes(prizeId) ? undefined : prizeId))
            .filter((item) => item !== undefined);
        const prizeObjectsToDelete = await Promise.all(leftoverCachedPrizeIds.map(async (prizeId) => {
            const fetchedCachedObject = await redisInputClient.hgetall(prizeId);
            return {
                prize_id: prizeId,
                prizeObject: fetchedCachedObject,
            };
        }));
        prizeObjectsToDelete.forEach((prizeObject) => {
            promises.push(removeItemFromCache(prizeObject, redisInputClient, currentPrizeList, inputConfigHashKey));
        });

        return Promise.all(promises);
    }
};

const localizeCachedPrizeObject = (defaultLanguage, language, prizeObject, responseType) => {
    language = Object.keys(JSON.parse(prizeObject.name)).includes(language) ? language : defaultLanguage;
    const stringFields = [
        'configuration_id',
        'prize_id',
        'entry_date',
        'redemption_link',
        'final_state',
        'img_url',
    ];
    const fieldsToParse = [
        'configuration_id',
        'prize_id',
        'active',
        'name',
        'desc',
        'short_desc',
        'redeem_desc',
        'total_available',
        'total_amount',
        'cost',
        'img_url',
        'images_metadata',
        'delivery_type',
        'redemption_link',
        'barcode_type',
        'priority',
        'tags',
        'min_age',
    ];
    const translatableFields = ['short_desc', 'redeem_desc', 'name', 'desc', 'images_metadata'];
    let formattedObject = {};
    fieldsToParse.forEach((key) => {
        if (prizeObject[key]) {
            if (stringFields.includes(key)) {
                formattedObject[key] = translatableFields.includes(key)
                    ? prizeObject[key][language]
                    : prizeObject[key];
            } else {
                formattedObject[key] = translatableFields.includes(key)
                    ? JSON.parse(prizeObject[key])[language]
                    : JSON.parse(prizeObject[key]);
            }
        }
    });
    if (responseType === 'plain') {
        formattedObject = convertPrizeAttributesToPlainText(formattedObject);
    }
    return {
        configurationId: formattedObject.configuration_id,
        prizeId: formattedObject.prize_id,
        active: formattedObject.active,
        name: formattedObject.name,
        description: formattedObject.desc,
        shortDescription: formattedObject.short_desc,
        redeemDescription: formattedObject.redeem_desc,
        amountAvailable: formattedObject.total_available,
        totalAmount: formattedObject.total_amount,
        prizeCost: copyAsCamelCase(formattedObject.cost),
        imgUrl: (formattedObject.img_url.includes('[') && formattedObject.img_url.includes(']')) ? JSON.parse(formattedObject.img_url) : formattedObject.img_url,
        imagesMetadata: formattedObject.images_metadata,
        deliveryType: formattedObject.delivery_type,
        redemptionLink: formattedObject.redemption_link,
        barcodeType: formattedObject.barcode_type,
        priority: formattedObject.priority,
        tags: formattedObject.tags,
        minAge: formattedObject.min_age,
    };
};

module.exports = {
    activeStatusChange,
    listPrizesRedisScenario,
    putBackfillItemsIntoCache,
    prepareObjectForRedis,
    fetchCachedIndividualPrizes,
    localizeCachedPrizeObject,
    reconcileCacheOnDelete,
    putSingleObjectIntoCache,
};
