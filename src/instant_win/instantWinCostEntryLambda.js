const warmer = require('lambda-warmer');
const { middyValidatorWrapper } = require('../middlewares/middyValidatorWrapper');
const {
    createErrBody,
    extractParams,
    createResponse,
    parseBody,
} = require('../utility_functions/utilityFunctions');
const { getConfiguration } = require('../utility_functions/configUtilities');
const { invokeLambda } = require('../utility_functions/aws_sdk_utils/lambdaUtilities');
const {
    getWalletDataPerCurrencies,
} = require('../database/walletTable');
const { getInstantWinCostConfigId, getReduceAmount } = require('../self_service/configurationUtils');

const { REQUIRED_PARAMETERS_FOR_LAMBDA, CONFIGURATION_FUNCTIONS_MAP } = require('../constants/lambdas');
const { RESPONSE_OK, RESPONSE_INTERNAL_ERROR } = require('../constants/responses');
const { ERR_CODES: { IW_PRIZE_REDEEM_FAILED }, ERROR_CODES: { UNKNOWN_ERROR } } = require('../constants/errCodes');

const flowLabel = 'instantWin';

const convertToObject = (wallet) => wallet.reduce((currencyIdObj, item) => {
    currencyIdObj[item.currency_id] = item.amount;
    return currencyIdObj;
}, {});

const compareWalletAndAmount = (requiredAmount, userWallet) => {
    const insufficientCurrencies = [];
    requiredAmount.forEach((item) => {
        const { currencyId, amount } = item;
        if (userWallet[currencyId] >= amount) {
            console.log(`Enough amount for ${currencyId}`);
        } else {
            insufficientCurrencies.push(currencyId);
        }
    });
    return insufficientCurrencies;
};

const checkWallet = async (configuration, userId) => {
    const requiredAmount = await getReduceAmount(configuration, flowLabel);
    const userWalletResult = await getWalletDataPerCurrencies(userId, configuration.configurationParameters.currencies);
    const userWallet = convertToObject(userWalletResult);

    return compareWalletAndAmount(requiredAmount, userWallet);
};

const createInvokeEvent = (event, params, configId) => {
    const customEvent = { ...event };
    customEvent.body = JSON.stringify({
        userId: params.userId,
        configurationId: configId,
        flowLabel,
        gppUserId: params.gppUserId,
    });
    return customEvent;
};

const renameInstantWinResult = (result) => {
    const parsedBody = parseBody(result);
    parsedBody.instantWinEntryResult = parsedBody.instantWinResult;
    delete parsedBody.instantWinResult;
    result.body = JSON.stringify(parsedBody);
    return result;
};

const instantWinCostEntryLambda = async (event) => {
    try {
        if (await warmer(event)) return 'warmed';
        const params = extractParams(event);
        const configuration = await getConfiguration(params.configurationId, event);
        const instantWinConfigId = getInstantWinCostConfigId(configuration, params.flowLabel);
        if (!instantWinConfigId) {
            console.error('ERROR: Instant win entry configuration not found');
            throw new Error();
        }
        const instantWinCostConfig = await getConfiguration(instantWinConfigId, event);
        const insufficientCurrencies = await checkWallet(instantWinCostConfig, params.gppUserId);
        if (insufficientCurrencies.length > 0) {
            const response = createResponse(RESPONSE_OK, { insufficientCurrencies });
            return response;
        }
        const customEvent = createInvokeEvent(event, params, instantWinConfigId);
        await invokeLambda(CONFIGURATION_FUNCTIONS_MAP.currencyReducer, customEvent);
        const res = await invokeLambda(CONFIGURATION_FUNCTIONS_MAP.instantWin, customEvent);
        const result = renameInstantWinResult(res);
        console.log('Returning response:\n', JSON.stringify(result));
        return result;
    } catch (err) {
        console.error('ERROR: Returning error response:\n', err);
        const errorBody = createErrBody(IW_PRIZE_REDEEM_FAILED, 'Instant win with cost entry cannot be triggered.', undefined, UNKNOWN_ERROR);
        const errorResponse = createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
        return errorResponse;
    }
};

module.exports.instantWinCostEntryLambda = middyValidatorWrapper(instantWinCostEntryLambda,
    REQUIRED_PARAMETERS_FOR_LAMBDA.instantWinCostEntry);
