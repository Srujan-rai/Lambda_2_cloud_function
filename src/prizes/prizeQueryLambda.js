const middy = require('@middy/core');
const {
    copyAsCamelCase,
    mergeObjectParams,
    createResponse,
    extractParams,
} = require('../utility_functions/utilityFunctions');
const { getConfiguration } = require('../utility_functions/configUtilities');
const { localizedFullListQuery } = require('../database/prizeCatalogueTable');
const { listPrizesRedisScenario } = require('./prizeCacheManagerUtils');
const { setupRedisClient } = require('../utility_functions/redisUtils');
const { setupLanguage } = require('../utility_functions/localizationUtilities');
const { fetchECReplicationGroup } = require('../middlewares/fetchECReplicationGroup');
const { queryByCurrenciesIds } = require('../database/currencyDatabase');
const {
    PARAMS_MAP: {
        RICHTEXT_RESPONSE_TYPE, CONFIGURATION_ID, LANGUAGE, FILTER, PRIORITY,
    },
} = require('../constants/common');
const { checkPassedParameters } = require('../utility_functions/utilityFunctions');
const { REQUIRED_PARAMETERS_FOR_LAMBDA } = require('../constants/lambdas');
const { RESPONSE_OK } = require('../constants/responses');
const { GPP_CURRENCY_TABLE } = require('../constants/tableNames');

/**
 * Transforms single item from dbResponse into REST API response item (part of a resulting array)
 *
 * @param {Object} prizeItem - row from prizeCatalogue
 * @returns {Object} prizeItem with camelCase and extended names, and attributes are filtered (not all attributes are returned)
 */
const filterAndFormatPrizeItem = (prizeItem) => {
    const filteredPrize = {
        configurationId: prizeItem.configuration_id,
        prizeId: prizeItem.prize_id,
        active: prizeItem.active,
        name: prizeItem.name,
        description: prizeItem.desc,
        shortDescription: prizeItem.short_desc,
        redeemDescription: prizeItem.redeem_desc,
        amountAvailable: prizeItem.total_available,
        totalAmount: prizeItem.total_amount,
        prizeCost: copyAsCamelCase(prizeItem.cost),
        imgUrl: prizeItem.img_url,
        imagesMetadata: prizeItem.images_metadata,
        deliveryType: prizeItem.delivery_type,
        redemptionLink: prizeItem.redemption_link,
        barcodeType: prizeItem.barcode_type,
        priority: prizeItem.priority,
        tags: prizeItem.tags,
        minAge: prizeItem.min_age,
    };
    if (prizeItem.start_date) {
        filteredPrize.startDate = prizeItem.start_date;
    }
    if (prizeItem.end_date) {
        filteredPrize.endDate = prizeItem.end_date;
    }
    if (prizeItem.has_end_date) {
        filteredPrize.hasEndDate = prizeItem.has_end_date;
    }
    if (prizeItem.visible_from_date) {
        filteredPrize.visibleFromDate = prizeItem.visible_from_date;
    }
    return filteredPrize;
};

/**
 * Transforms dbResponse into REST API response, also filters data to return only relevant info.
 */
const filterAndFormatPrizeArray = (dbResponse, responseType) => {
    const resultArray = [];
    for (let i = 0; i < dbResponse.length; i++) {
        const resultItem = filterAndFormatPrizeItem(dbResponse[i], responseType);
        resultArray.push(resultItem);
    }
    return resultArray;
};

/**
 * orderPrizesByPriority
 * @param {Object} prizesList - prizes list
 * @param {String} orderType - ASC || DESC
 * @returns {Object} orderedList - ordered prizes by priority
 */
const orderPrizesByPriority = (prizesList, orderType) => {
    orderType = orderType || 'ASC';
    const sortFn = {
        ASC: (prize1, prize2) => {
            // In case of undefined move it to bottom of result
            if (!prize1.priority && prize1.priority !== 0) {
                return 1;
            }
            return (prize1.priority > prize2.priority) ? 1 : -1;
        },
        DESC: (prize1, prize2) => {
            if (!prize2.priority && prize2.priority !== 0) {
                return -1;
            }
            return (prize1.priority > prize2.priority) ? -1 : 1;
        },
    };
    let orderedPrizes = prizesList;
    if ((['ASC', 'DESC'].indexOf(orderType) > -1)) {
        orderedPrizes = prizesList.sort(sortFn[orderType]);
    }
    return orderedPrizes;
};
const { useRedis } = process.env;
/**
 * Lambda for prize catalogue query.
 * In cases of undefined priority for a prize, it will
 * move it to the bottom of the results
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
const prizeQueryLambda = async (event) => {
    let params = extractParams(event);
    const responseType = params[RICHTEXT_RESPONSE_TYPE];
    try {
        if (event.resource === '/publicListPrizes') {
            params.flowLabel = 'listPrizes';
        } else {
            // TODO: remove try/catch once all clients are passing uuid
            const requiredParams = REQUIRED_PARAMETERS_FOR_LAMBDA.prizeQueryLambda;
            try {
                checkPassedParameters(params, requiredParams);
            } catch (e) {
                console.warn('UUID not passed to the request. This parameter will be mandatory soon');
            }
        }
        let listOfPrizes;
        const s3ClientConfig = await getConfiguration(params[CONFIGURATION_ID], event);
        setupLanguage(params, s3ClientConfig);

        if (s3ClientConfig.flow[params.flowLabel]?.params) {
            params = mergeObjectParams(params, s3ClientConfig.flow[params.flowLabel].params);
        }

        if (useRedis === 'true') {
            const redisClient = setupRedisClient(event.eccReplicationGroup?.ReplicationGroups[0]?.NodeGroups[0]?.PrimaryEndpoint);
            listOfPrizes = await listPrizesRedisScenario(
                redisClient,
                params[CONFIGURATION_ID],
                params[FILTER],
                params[LANGUAGE],
                params[RICHTEXT_RESPONSE_TYPE],
                s3ClientConfig,
                filterAndFormatPrizeArray,
            );
            await redisClient.disconnect();
        } else {
            const dbResult = await localizedFullListQuery(
                s3ClientConfig,
                params[LANGUAGE],
                params[FILTER],
                params[RICHTEXT_RESPONSE_TYPE],
            );
            listOfPrizes = filterAndFormatPrizeArray(dbResult, responseType);
        }

        if (params.includeCurrenciesIcon) {
            const curr = listOfPrizes.reduce((acc, prize) => {
                if (prize.prizeCost && prize.prizeCost.length) {
                    prize.prizeCost.forEach((cost) => {
                        if (acc.indexOf(cost.currencyId) === -1) {
                            acc.push(cost.currencyId);
                        }
                    });
                }
                return acc;
            }, []);

            const { [GPP_CURRENCY_TABLE]: cData } = await queryByCurrenciesIds(curr, ['currency_id', 'icon_url']);
            const cWithIcons = cData.filter((c) => c.icon_url);
            listOfPrizes.forEach((prize) => {
                if (prize.prizeCost) {
                    prize.prizeCost.forEach((cost) => {
                        const currData = cWithIcons.find((c) => c.currency_id === cost.currencyId);
                        if (currData) {
                            cost.iconUrl = currData.icon_url;
                        }
                    });
                }
            });
        }
        const orderedPrizes = orderPrizesByPriority(listOfPrizes, params[PRIORITY]);
        const response = createResponse(RESPONSE_OK, { prizeList: orderedPrizes });
        console.log('Success! Returning response..');
        return response;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', errorResponse);
        return errorResponse;
    }
};

module.exports = {
    prizeQueryLambda: middy(prizeQueryLambda)
        .use(fetchECReplicationGroup({}, `${process.env.stageName}-redis-cache`, process.env.useRedis)),
};
