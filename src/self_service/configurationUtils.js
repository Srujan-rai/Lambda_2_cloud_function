const getConfigurationParameter = (configuration, paramName) => {
    if (configuration && Object.prototype.hasOwnProperty.call(configuration, 'configurationParameters')) {
        return configuration.configurationParameters[paramName];
    }
    return undefined;
};

const getDefaultLanguage = (configuration) => getConfigurationParameter(configuration, 'language');

const getConfigurationId = (configuration) => {
    if (configuration) {
        return configuration.configurationId;
    }
    return undefined;
};

/**
 * Gets array of currencies from the passed configuration
 *
 * @param {Object} configuration - JSON object containing all promotion configuration information
 * @return {(Array|undefined)} - Returns array of currencies or undefined if it failed to get it
 */
const getCurrencyArray = (configuration) => getConfigurationParameter(configuration, 'currencies');

/**
 * Gets the currency valid period from the passed configuration, for a specific configuration ID
 *
 * @param {Object} configuration - JSON object containing all promotion configuration information
 * @param {string} currencyId - Currency ID
 * @return {(number|undefined)} - Returns currency valid period or undefined if it failed to get it
 */
const getCurrencyValidity = (configuration, currencyId) => {
    const currenciesValidPeriod = getConfigurationParameter(configuration, 'validity');
    let validPeriod;
    if (currenciesValidPeriod) {
        validPeriod = currenciesValidPeriod[currencyId];
    }
    return validPeriod;
};

const getPrerequirements = (configuration) => {
    if (configuration) {
        return configuration.prerequirements;
    }
    return undefined;
};

const getAllFlowLabels = (configuration) => {
    if (configuration) {
        return configuration.flow;
    }
    return undefined;
};

const getFlowLabel = (configuration, flowLabel) => {
    if (configuration && configuration.flow) {
        return configuration.flow[flowLabel];
    }
    return undefined;
};

const getFlowParameter = (flowLabelJson, paramName) => {
    if (flowLabelJson && flowLabelJson.params && Object.prototype.hasOwnProperty.call(flowLabelJson.params, paramName)) {
        return flowLabelJson.params[paramName];
    }
    return undefined;
};

const getFlowLabelSecret = (flowLabelJson, paramName) => {
    if (flowLabelJson && flowLabelJson.secrets && flowLabelJson.secrets[paramName]) {
        return flowLabelJson.secrets[paramName];
    }
    return undefined;
};

const parseNumber = (stringifiedInput) => (stringifiedInput ? parseInt(stringifiedInput) : stringifiedInput);

const getMixCodesParameters = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    return getFlowLabelSecret(flowLabelJson, 'mixCodesParameters');
};

const getInstantWinAlgorithm = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    return getFlowParameter(flowLabelJson, 'algorithm');
};

const getAlwaysWinPrize = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    return getFlowParameter(flowLabelJson, 'alwaysWin');
};

const getRatioWinning = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    return getFlowParameter(flowLabelJson, 'ratioWinning');
};

const getWinningLimitsPerTier = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    const limits = getFlowParameter(flowLabelJson, 'winningLimitsPerTier');

    if (limits) {
        return limits;
    }

    return undefined;
};

const getWinningLimitPerPrize = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    const limits = getFlowParameter(flowLabelJson, 'winningLimitsPerPrize');

    if (limits) {
        return limits;
    }
    return undefined;
};

const getViralCodesPrizeLimits = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    const prizesMap = getFlowParameter(flowLabelJson, 'winningPrizesPerViralCode');
    return prizesMap;
};

const getMaxFileSizeForUpload = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    return getFlowParameter(flowLabelJson, 'maxFileSize');
};

const getUploadPolicyDuration = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    return getFlowParameter(flowLabelJson, 'uploadPolicyDuration');
};

const getIsUploadOverrideAllowed = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    const isAllowed = getFlowParameter(flowLabelJson, 'uploadOverrideAllowed');
    return isAllowed === true || isAllowed === 'true';
};

const getUploadFileFlow = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    return getFlowParameter(flowLabelJson, 'fileUploadFlow');
};

const getMinAge = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    return parseNumber(getFlowParameter(flowLabelJson, 'minAge'));
};

const getCaptchaSecret = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    let secret = getFlowLabelSecret(flowLabelJson, 'captchaSecret');

    if (!secret) {
        secret = getConfigurationParameter(configuration, 'captchaSecret');
    }

    return secret;
};

const getPrizeLambdaFlow = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    return getFlowParameter(flowLabelJson, 'prizeLambdaFlow');
};

const getEmailTemplateLambdaFlow = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    return getFlowParameter(flowLabelJson, 'emailTemplateLambdaFlow');
};

const getCurrenciesProviderLambdaFlow = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    return getFlowParameter(flowLabelJson, 'currenciesProviderLambdaFlow');
};

const getBlockingLambdaFlow = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    return getFlowParameter(flowLabelJson, 'consumerBlockingLambdaFlow');
};

const getAnalysisLambdaFlowParams = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    return getFlowParameter(flowLabelJson, 'analysisLambdaFlowParams');
};

const getEmailDelaySeconds = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    return getFlowParameter(flowLabelJson, 'delaySeconds');
};

const getMaxNumberOfParticipationIds = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    return getFlowParameter(flowLabelJson, 'maxParticipationIds');
};

const getIsStatusReserved = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    return getFlowParameter(flowLabelJson, 'useStatusReserved');
};

const getReduceAmount = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    return getFlowParameter(flowLabelJson, 'reduceAmount');
};

const getPrizeDistributionDefect = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    return getFlowParameter(flowLabelJson, 'prizeDistributionDefect');
};

const getTimestampDistributionDefect = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    return getFlowParameter(flowLabelJson, 'timestampDistributionDefect');
};

const getAdditionalInformation = (configuration) => getConfigurationParameter(configuration, 'additionalInformation');

const getInstantWinCostConfigId = (configuration, flowLabel) => {
    const flowLabelJson = getFlowLabel(configuration, flowLabel);
    return getFlowParameter(flowLabelJson, 'instantWinCostEntryConfiguration');
};

const getUpdateCurrencyExpirationPerTransaction = (configuration) => getConfigurationParameter(configuration, 'updateCurrencyExpirationPerTransaction');

module.exports = {
    getConfigurationParameter,
    getFlowParameter,
    getDefaultLanguage,
    getConfigurationId,
    getCurrencyArray,
    getCurrencyValidity,
    getPrerequirements,
    getAllFlowLabels,
    getFlowLabel,
    getMixCodesParameters,
    getInstantWinAlgorithm,
    getAlwaysWinPrize,
    getWinningLimitsPerTier,
    getWinningLimitPerPrize,
    getMaxFileSizeForUpload,
    getUploadPolicyDuration,
    getIsUploadOverrideAllowed,
    getUploadFileFlow,
    getMinAge,
    getCaptchaSecret,
    getPrizeLambdaFlow,
    getEmailTemplateLambdaFlow,
    getCurrenciesProviderLambdaFlow,
    getBlockingLambdaFlow,
    getAnalysisLambdaFlowParams,
    getEmailDelaySeconds,
    getMaxNumberOfParticipationIds,
    getIsStatusReserved,
    getReduceAmount,
    getPrizeDistributionDefect,
    getTimestampDistributionDefect,
    getAdditionalInformation,
    getViralCodesPrizeLimits,
    getInstantWinCostConfigId,
    getUpdateCurrencyExpirationPerTransaction,
    getRatioWinning,
};
