const { LAMBDA_PREFIX, PARAMS_MAP } = require('./common');

const CHECKER_NAMES = {
    ageCheckerLambda: `${LAMBDA_PREFIX}ageCheckerLambda`,
    captchaChecker: `${LAMBDA_PREFIX}captchaCheckerLambda`,
    promoPeriodCheckerLambda: `${LAMBDA_PREFIX}promoPeriodCheckerLambda`,
    currencyCheckerLambda: `${LAMBDA_PREFIX}currencyCheckerLambda`,
    prizeCheckerLambda: `${LAMBDA_PREFIX}prizeCheckerLambda`,
    pincodeOriginValidityCheckerLambda: `${LAMBDA_PREFIX}pincodeOriginValidityCheckerLambda`,
    codeBurningLimitCheckerLambda: `${LAMBDA_PREFIX}codeBurningLimitCheckerLambda`,
    participationLimitCheckerLambda: `${LAMBDA_PREFIX}participationLimitCheckerLambda`,
    instantWinPrizeLimitsCheckerLambda: `${LAMBDA_PREFIX}instantWinPrizeLimitsCheckerLambda`,
};

const REQUIRED_PARAMETERS_FOR_CHECKER_LAMBDA = {
    age: [PARAMS_MAP.DATE_OF_BIRTH],
    checkCaptcha: [PARAMS_MAP.RECAPTCHA],
    currencyCheckerLambda: [PARAMS_MAP.PRIZE_ID, PARAMS_MAP.USER_ID],
    currencyCheckerLambdaNoPrize: [PARAMS_MAP.USER_ID],
    prizeCheckerLambda: [PARAMS_MAP.PRIZE_ID],
    pincodeOriginValidityCheckerLambda: [PARAMS_MAP.PINS],
    codeBurningLimit: [PARAMS_MAP.USER_ID, PARAMS_MAP.PINS],
    participationLimit: [PARAMS_MAP.USER_ID],
    instantWinPrizeLimits: [PARAMS_MAP.USER_ID],
};

const CONFIGURATION_CHECKS_MAP = {
    age: {
        FunctionName: CHECKER_NAMES.ageCheckerLambda,
        InvocationType: 'RequestResponse',
        LogType: 'Tail',
    },
    promoPeriod: {
        FunctionName: CHECKER_NAMES.promoPeriodCheckerLambda,
        InvocationType: 'RequestResponse',
        LogType: 'Tail',
    },
    checkCaptcha: {
        FunctionName: CHECKER_NAMES.captchaChecker,
        InvocationType: 'RequestResponse',
        LogType: 'Tail',
    },
    currencyCheckerLambda: {
        FunctionName: CHECKER_NAMES.currencyCheckerLambda,
        InvocationType: 'RequestResponse',
        LogType: 'Tail',
    },
    prizeCheckerLambda: {
        FunctionName: CHECKER_NAMES.prizeCheckerLambda,
        InvocationType: 'RequestResponse',
        LogType: 'Tail',
    },
    pincodeOriginValidityCheckerLambda: {
        FunctionName: CHECKER_NAMES.pincodeOriginValidityCheckerLambda,
        InvocationType: 'RequestResponse',
        LogType: 'Tail',
    },
    termsAndConditionsCheckerLambda: {
        FunctionName: CHECKER_NAMES.termsAndConditionsCheckerLambda,
        InvocationType: 'RequestResponse',
        LogType: 'Tail',
    },
    codeBurningLimit: {
        FunctionName: CHECKER_NAMES.codeBurningLimitCheckerLambda,
        InvocationType: 'RequestResponse',
        LogType: 'Tail',
    },
    participationLimit: {
        FunctionName: CHECKER_NAMES.participationLimitCheckerLambda,
        InvocationType: 'RequestResponse',
        LogType: 'Tail',
    },
    instantWinPrizeLimits: {
        FunctionName: CHECKER_NAMES.instantWinPrizeLimitsCheckerLambda,
        InvocationType: 'RequestResponse',
        LogType: 'Tail',
    },
};

module.exports = {
    CONFIGURATION_CHECKS_MAP,
    REQUIRED_PARAMETERS_FOR_CHECKER_LAMBDA,
};
