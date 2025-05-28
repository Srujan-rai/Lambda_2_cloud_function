const {
    calculateTimestamp,
    copyFrom,
    createResponseInvalidParameter,
    setupParameter,
    createResponseMissingParameters,
    checkPassedParameters,
    extractParams,
    exportToCSV,
    createResponse,
    isPercentValue,
} = require('../../../utility_functions/utilityFunctions');
const {
    uploadToS3,
    createSignedURL,
} = require('../../../utility_functions/aws_sdk_utils/s3Utilities');
const { getConfiguration, configurationExistsChecker } = require('../../../utility_functions/configUtilities');
const {
    queryByConfigIdAndPrizeId,
    fullListQuery,
} = require('../../../database/prizeCatalogueTable');
const ssConfig = require('../../../self_service/selfServiceConfig.json');

const ADVANCED_GENERATOR_EXCLUDE_PARAMS = [
    'prizeDistributionDefect',
    'configurationId',
];
const { REQUIRED_PARAMETERS_FOR_LAMBDA } = require('../../../constants/lambdas');
const { RESPONSE_OK } = require('../../../constants/responses');
const { PARAMS_MAP, WINNING_MOMENTS_STATUS: { AVAILABLE } } = require('../../../constants/common');

/**
 * Generates dates, based on start and end date
 * @param {Object} params start, end date and defects
 * @param {Array} additionalDetails and array of items passed in from the Adv and Basic flow
 * @returns {Array} mapped winning moments
 */
const generateGMTStartDates = (count, insertParams, timeProps, winningMomentExpiration, usedTimestamps = {}) => {
    console.log('Winning Moment Generation Starting');
    const winningMoments = [];
    for (let i = 0; i < count; i++) {
        const gmtStart = calculateTimestamp(timeProps.sequenceStart(i), timeProps.sequenceDuration(), timeProps.defect, usedTimestamps);
        usedTimestamps[gmtStart] = true;
        const wmExpiraiton = Number(winningMomentExpiration) + gmtStart;
        const wmObject = {
            gmtStart,
            ...(insertParams[i] ? {
                prizeId: insertParams[i].prize_id || '',
                tier: insertParams[i].tier || 0,
                status: insertParams[i].status || '',
                endDate: winningMomentExpiration > 0 ? wmExpiraiton : '',
            } : {
                prizeId: insertParams.prizeId || '',
                tier: insertParams.tier || 0,
                status: insertParams.status || '',
                endDate: winningMomentExpiration > 0 ? wmExpiraiton : '',
            }),
        };
        winningMoments.push(wmObject);
    }
    console.log(`Winning Moment Generation Completed! Moments Generated: ${winningMoments.length}`);
    return winningMoments;
};

/**
 *
 *  @param {Object} params start, end date and defects
 * @param {Number} count the number of prizes that should be created
 * @param {*} index passed in as an argument for calculating sequenceStart
 * @returns {Object} params required for calculating the time stamp
 */
const calculateTimeSequences = (params, count) => ({
    defect: parseInt(params[PARAMS_MAP.TIMESTAMP_DISTRIBUTION_DEFECT]),
    startDate: parseInt(params[PARAMS_MAP.START_DATE]),
    endDate: parseInt(params[PARAMS_MAP.END_DATE]),
    prizeNum: count,
    sequenceDuration() {
        const { startDate, endDate, prizeNum } = this;
        if (endDate <= startDate + prizeNum) {
            throw createResponseInvalidParameter([PARAMS_MAP.END_DATE, PARAMS_MAP.START_DATE]);
        }
        return (endDate - startDate) / prizeNum;
    },
    sequenceStart(index = 0) {
        return this.startDate + index * this.sequenceDuration();
    },
});

/**
 * This function is responsible for building the query params for DB and then filtering anything that doesn't match specific criteria
 *
 * @param {Object} params - params passed from the Lambda
 * @returns {Promise} - Containing the prizes qualified for moment generation.
 */
const getPrizeDetails = async (params) => {
    const promises = params.prizeParams.map(
        (prize) => queryByConfigIdAndPrizeId({
            configurationId: params.configurationId,
            textFormat: 'responseType',
            prizeId: prize.prizeId,
        }),
    );

    const res = await Promise.all(promises);
    const queryResult = res.flat().filter((el) => el.total_available > 0 && el.active);
    return queryResult.map(
        (prize) => ({
            count: prize.total_available,
            currentIndex: 1,
            insertItem: {
                tier: prize.tier,
                prize_id: prize.prize_id,
                configuration_id: params[PARAMS_MAP.CONFIGURATION_ID],
                status: AVAILABLE,
            },
        }),
    );
};

/**
 * Extracts prize details suitable for further processing.
 *
 * @param {Object} params - Lambda parameters (rest API + default values)
 * @returns {Promise} Array holding distinct basic insert items, total count and iterator.
 */
const preparePrizeInfoArray = async (params) => {
    let queryResult = [];
    if (params?.generatorType === 'basic' && params?.prizeIds.length) {
        // query for the selected prizes from SS2
        queryResult = await Promise.all(params.prizeIds.map(async (prizeId) => (
            queryByConfigIdAndPrizeId({
                configurationId: params[PARAMS_MAP.CONFIGURATION_ID],
                textFormat: params[PARAMS_MAP.RICHTEXT_RESPONSE_TYPE],
                prizeId,
            })
        ))).then((prizes) => (
            prizes.flat()
        )).catch((err) => {
            throw err;
        });
    } else {
        queryResult = await fullListQuery(params[PARAMS_MAP.CONFIGURATION_ID], params[PARAMS_MAP.RICHTEXT_RESPONSE_TYPE]);
    }

    const result = [];
    for (let i = 0; i < queryResult.length; i++) {
        if (queryResult[i].total_available) {
            result.push({
                count: queryResult[i].total_available,
                currentIndex: 1,
                insertItem: {
                    tier: queryResult[i].tier,
                    prize_id: queryResult[i].prize_id,
                    configuration_id: params[PARAMS_MAP.CONFIGURATION_ID],
                    status: AVAILABLE,
                },
            });
        }
    }
    console.log('Prize details extracted:\n', JSON.stringify(result));
    return result;
};

/**
 * Helper function for {@link distributePrizeInsertItems}.
 * In the array of DISTINCT prizeDetails finds the next suitable for distributed array of basic insert items. This is
 * achieved by calculating 'completion rate'. Item closer to completion is less likely to be picked next.
 *
 * @param {Object} prizeDetails - object holding basic insert item, total count and iterator
 * @param {Number} defect - number (0-100). Defines the proportion between real (equal distribution) and random rate.
 * The lower the value, the closer to real rate (equal distribution).
 * 0 means that result (after all iterations) will be equally distributed array.
 * 100 means that result (after all iterations) will be randomly distributed array.
 */
const getNextQualifiedIndex = (prizeDetails, defect) => {
    const rateArray = prizeDetails.map((element) => {
        const realRate = element.currentIndex / element.count;
        return ((100 - defect) * realRate + defect * Math.random()) / 100;
    });
    return rateArray.indexOf(Math.min(...rateArray));
};

/**
 * Creates array of basic insert items (all columns from winning moments table except gmt_start). Distribution varies from
 * equal distribution to random distribution based on the prizeDistributionDefect parameter.
 *
 * @param {Object} params - Lambda parameters (rest API + default values)
 * @param {Array<Object>} prizeDetails - Array holding distinct basic insert items, total count and iterator.
 * @returns {Array<Object>} Full (not distinct) array of basic insert items (winning moments table columns without gmt_start)
 */
const distributePrizeInsertItems = (params, prizeDetails) => {
    console.log('Equally distributing items...');

    const basicInsertItemsArray = [];
    let totalVoucherCount = 0;
    for (let i = 0; i < prizeDetails.length; i++) {
        totalVoucherCount += prizeDetails[i].count;
    }
    console.log('Total voucher count calculated! Count:', totalVoucherCount);

    for (let i = 0; i < totalVoucherCount; i++) {
        const qualifiedIndex = getNextQualifiedIndex(prizeDetails, params[PARAMS_MAP.PRIZE_DISTRIBUTION_DEFECT]);
        const qualifiedItem = prizeDetails[qualifiedIndex];
        basicInsertItemsArray.push(copyFrom(qualifiedItem.insertItem));

        qualifiedItem.currentIndex++;
        if (qualifiedItem.currentIndex > qualifiedItem.count) {
            prizeDetails.splice(qualifiedIndex, 1);
        }
    }

    console.log('Basic insert items array created! Array:\n', JSON.stringify(basicInsertItemsArray));
    return basicInsertItemsArray;
};

/**
 * Validates the value of important parameters.
 *
 * @param {Object} params - Lambda parameters (rest API + default values)
 * @param {Array} params - List of exception that can be used when
 * @returns {Promise} resolved with parameters if validation passes, rejects with HTTP error response if fails.
 */
const validateParameters = (params, exceptions) => {
    let invalidParameters = [];
    if (!isPercentValue(params[PARAMS_MAP.PRIZE_DISTRIBUTION_DEFECT])) {
        invalidParameters.push(PARAMS_MAP.PRIZE_DISTRIBUTION_DEFECT);
    }
    if (!isPercentValue(params[PARAMS_MAP.TIMESTAMP_DISTRIBUTION_DEFECT])) {
        invalidParameters.push(PARAMS_MAP.TIMESTAMP_DISTRIBUTION_DEFECT);
    }
    if (!params[PARAMS_MAP.START_DATE]) {
        invalidParameters.push(PARAMS_MAP.START_DATE);
    }
    if (!params[PARAMS_MAP.END_DATE]) {
        invalidParameters.push(PARAMS_MAP.END_DATE);
    }
    if (params[PARAMS_MAP.END_DATE] <= params[PARAMS_MAP.START_DATE]) {
        invalidParameters.push(PARAMS_MAP.END_DATE, PARAMS_MAP.START_DATE);
    }
    if (!params.configurationId) {
        invalidParameters.push(PARAMS_MAP.CONFIGURATION_ID);
    }

    if (exceptions) {
        invalidParameters = invalidParameters.filter((el) => !exceptions.includes(el));
    }

    if (invalidParameters.length === 0) {
        return Promise.resolve(params);
    }
    return Promise.reject(createResponseInvalidParameter(invalidParameters));
};

/**
 * If distribution defect parameters are missing, sets it to default value from configuration.
 *
 * @param {Object} params - Lambda parameters (rest API + default values)
 * @returns {Object} updated params
 */
function setupDefectFactors(params) {
    if (Object.prototype.hasOwnProperty.call(params, PARAMS_MAP.PRIZE_DISTRIBUTION_DEFECT)
        && Object.prototype.hasOwnProperty.call(params, PARAMS_MAP.TIMESTAMP_DISTRIBUTION_DEFECT)) {
        // Both parameters exist, exit early an skip S3 read.
        return params;
    }

    setupParameter(params, PARAMS_MAP.PRIZE_DISTRIBUTION_DEFECT, ssConfig);
    setupParameter(params, PARAMS_MAP.TIMESTAMP_DISTRIBUTION_DEFECT, ssConfig);
    return params;
}

/**
 * This flow will generate winning moments based on configurationId. It takes the full list of prizes for a specific config
 * and generates moments for them.
 * @param {Object} eventParams event parameters
 * @param {Object} event AWS Event object
 */
const executeBasicFlow = async (eventParams, event) => {
    try {
        const params = setupDefectFactors(eventParams);
        checkPassedParameters(params, REQUIRED_PARAMETERS_FOR_LAMBDA.winningMomentsGeneratorLambda);
        await validateParameters(params);
        await configurationExistsChecker(params.configurationId, event);
        const prizeDetails = await preparePrizeInfoArray(params);
        const basicInsertItems = await distributePrizeInsertItems(params, prizeDetails);
        const winningMoments = generateGMTStartDates(basicInsertItems.length, basicInsertItems,
            calculateTimeSequences(params, basicInsertItems.length), eventParams.winningMomentExpiration);
        return winningMoments;
    } catch (err) {
        console.error('ERROR:\n', err);
        throw err;
    }
};

/**
 * This flow generates winning moments for every passed prize in the request body.
 * Every prize can have different generation parameters i.e. "startDate" or "timestampDistributionDefect"
 * If "startDate" or "endDate" are not passed for a prize, "configurationStartUtc" or "configurationEndUtc" will be taken
 * from the configuration
 * @param {Object} eventParams event parameters
 * @param {Object} event AWS Event object
 */
const executeAdvancedFlow = async (eventParams, event) => {
    if (!eventParams.prizeParams) {
        throw createResponseMissingParameters(['prizeParams']);
    }

    const config = await getConfiguration(eventParams[PARAMS_MAP.CONFIGURATION_ID], event);
    const { prizeParams } = eventParams;
    const { configurationStartUtc, configurationEndUtc } = config.configurationParameters;
    const newPrizeParams = prizeParams.map((prize) => ({
        ...prize,
        startDate: prize.startDate || configurationStartUtc,
        endDate: prize.endDate || configurationEndUtc,
        winningMomentExpiration: prize.winningMomentExpiration || 0,
    }));
    const params = { ...eventParams, prizeParams: newPrizeParams };
    const requiredParams = REQUIRED_PARAMETERS_FOR_LAMBDA.winningMomentsGeneratorLambda.filter(
        (param) => !ADVANCED_GENERATOR_EXCLUDE_PARAMS.includes(param),
    );
    const promises = params.prizeParams.map((prizeParam) => {
        checkPassedParameters(prizeParam, requiredParams);
        return validateParameters(prizeParam, ADVANCED_GENERATOR_EXCLUDE_PARAMS);
    });
    await Promise.all(promises);
    const prizeDetails = await getPrizeDetails(params);
    const usedTimestamps = {};
    const winningMoments = prizeDetails.flatMap((prizeInfo) => {
        const insertedItemParams = params.prizeParams.filter((prize) => prize.prizeId === prizeInfo.insertItem.prize_id)[0];
        const { winningMomentExpiration } = insertedItemParams;
        const { count, insertItem: { prize_id: prizeId, tier, status } } = prizeInfo;
        return generateGMTStartDates(count, { prizeId, tier, status },
            calculateTimeSequences(insertedItemParams, count), winningMomentExpiration, usedTimestamps);
    });

    return winningMoments;
};

/**
 * Execute a flow, based on the type. The default flow is "basic"
 * @param {String} type The type of the flow which we want to execute
 * @param {Object} params event parameters
 * @param {Object} event AWS Event object
 */
const executeGeneratorFlow = (type, params, event) => {
    if (type === 'basic') {
        return executeBasicFlow(params, event);
    } if (type === 'advanced') {
        return executeAdvancedFlow(params, event);
    }
};

/**
 * Lambda function. Responsible for generating winning moments based on series of rules and constraints
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
const winningMomentsGeneratorLambda = async (event) => {
    try {
        const fileName = event.automaticUpload ? `winningMomentCSVs/winningMoments-${Date.now()}.csv` : `winningMoments/winningMoments-${Date.now()}.csv`;
        const params = event.payloadSource ? event : extractParams(event);
        const responseBody = {};
        const winningMoments = await executeGeneratorFlow(params.generatorType || 'basic', params, event);
        const csvFields = ['gmtStart', 'prizeId', 'tier', 'status'];

        // Currently this will work only for the advanced type
        if (params.prizeParams && params.prizeParams.find((prize) => prize.winningMomentExpiration > 0)) {
            csvFields.push('endDate');
        }

        const csv = await exportToCSV({
            data: winningMoments,
            fields: csvFields,
            delimiter: ';',
        });
        const filePath = await uploadToS3(csv, params.configurationId, fileName, process.env.PRIVATE_BUCKET, 'Key');
        responseBody.csv = await createSignedURL(filePath, process.env.PRIVATE_BUCKET);
        const response = createResponse(RESPONSE_OK, responseBody);
        console.log('Winning moments generator successfully finished. Sending back positive response:\n',
            JSON.stringify(response));
        return response;
    } catch (errorResponse) {
        console.error('ERROR: Returning error response:\n', errorResponse);
        return errorResponse;
    }
};

module.exports = {
    winningMomentsGeneratorLambda,
};
