const middy = require('@middy/core');
const { COMMON_ERR: { INTERNAL_SERVER_ERROR } } = require('@the-coca-cola-company/ngps-global-common-messages');
const {
    createResponse,
    createErrBody,
} = require('../utility_functions/utilityFunctions');
const { validateAndSetLock } = require('./referralUtils');
const {
    RESPONSE_OK, RESPONSE_INTERNAL_ERROR, RESPONSE_BAD_REQUEST,
} = require('../constants/responses');
const {
    ERR_CODES: {
        CONFIGURATION_MALFORMED,
        MISSING_REQUEST_PARAMETERS,
        UNKNOWN_REASON,
        REFERRAL_CODE_ALREADY_USED,
        REFERRAL_LIMIT_REACHED,
        LOYALTY_TRANSACTION_FAILED,
    },
} = require('../constants/errCodes');
const { extractRequestParams } = require('../middlewares/extractRequestParams');
const { fetchS3Config } = require('../middlewares/fetchS3Config');
const { invokeLambda } = require('../utility_functions/aws_sdk_utils/lambdaUtilities');
const { CONFIGURATION_FUNCTIONS_MAP: { transactionLambda, sendMessage } } = require('../constants/lambdas');
const { PARAMS_MAP: { CONFIGURATION_ID, MESSAGE_BODY } } = require('../constants/common');
const { addParametersToEvent } = require('../utility_functions/configUtilities');
const { countUserConfigCurrencyRefCode } = require('../database/transactionDatabase');
const { isConfigurationActive } = require('../utility_functions/configUtilities');
const { CUSTOM_EVENT_PARAMS: { ENV_DETAILS } } = require('../utility_functions/eventUtilities');

const parseStringBody = (res) => {
    const parseBody = typeof res === 'string';
    return parseBody ? JSON.parse(res) : res;
};

const referralRewardsLambda = async (event) => {
    try {
        const params = event.body;
        const s3ClientConfig = event.customParameters?.cachedConfigurations[event.body[CONFIGURATION_ID]];
        const { referralRewards } = s3ClientConfig;

        if (!referralRewards.referrer && !referralRewards.referee) {
            return createResponse(RESPONSE_INTERNAL_ERROR, createErrBody(CONFIGURATION_MALFORMED, INTERNAL_SERVER_ERROR));
        }

        if (!isConfigurationActive(s3ClientConfig)) {
            return createResponse(RESPONSE_BAD_REQUEST, createErrBody(LOYALTY_TRANSACTION_FAILED, 'Promotion is inactive!'));
        }

        if (!event.requestContext?.authorizer?.ref_hashed_kocid || !event.requestContext?.authorizer?.ref_code) {
            return createResponse(RESPONSE_INTERNAL_ERROR, createErrBody(MISSING_REQUEST_PARAMETERS, 'Missing referral details'));
        }

        await validateAndSetLock(event.requestContext?.authorizer);

        const envDetails = event.requestContext?.authorizer[ENV_DETAILS];

        params.ref_code = event.requestContext?.authorizer?.ref_code;

        const promises = [];
        const result = {};

        Object.keys(referralRewards).forEach((key) => {
            if (key !== 'referrer' && key !== 'referee') {
                return;
            }

            params.userId = event.requestContext?.authorizer[
                key === 'referrer'
                    ? 'ref_hashed_kocid'
                    : 'hashed_kocid'
            ];

            addParametersToEvent(event, params, s3ClientConfig);

            const user = params.userId;
            const paramsCopy = { ...params };

            result[user] = { user, success: [], error: [] };

            promises.push({ user }, countUserConfigCurrencyRefCode({
                gppUserId: params.gppUserId,
                configurationId: s3ClientConfig[CONFIGURATION_ID],
                currencyId: referralRewards[key]?.currency,
            }).then(({ Count }) => {
                if (referralRewards[key]?.limit && Count >= referralRewards[key]?.limit) {
                    console.log(`Limit reached for ${user}`);
                    // eslint-disable-next-line
                    return Promise.reject({
                        body: createErrBody(REFERRAL_LIMIT_REACHED, 'Referral limit reached'),
                    });
                }
                return invokeLambda(transactionLambda, {
                    requestContext: {
                        requestId: event.requestContext.requestId,
                    },
                    body: {
                        ...paramsCopy,
                        currencyAllocations: [
                            {
                                currencyId: referralRewards[key]?.currency,
                                amount: referralRewards[key]?.amount,
                            },
                        ],
                    },
                }).then((res) => {
                    result[user].success.push(parseStringBody(res?.body));
                    result[user].amountInserted = referralRewards[key]?.amount;

                    if (referralRewards[key].sendEmail) {
                        return invokeLambda(sendMessage, {
                            body: JSON.stringify({
                                [MESSAGE_BODY]: {
                                    context: {
                                        ref_code: params.ref_code,
                                        currency:
                                            referralRewards[key]?.currency,
                                        amount: referralRewards[key]?.amount,
                                    },
                                    template: referralRewards.emailTemplateId,
                                    recipient: user,
                                    channel: 'email',
                                    provider: 'ajo',
                                },
                                envDetails,
                            }),
                        }).catch((err) => {
                            if (err) {
                                // eslint-disable-next-line
                                return Promise.reject({
                                    body: createErrBody(
                                        UNKNOWN_REASON,
                                        'Failed to send email',
                                        { messageSent: false },
                                    ),
                                });
                            }
                        });
                    }
                });
            }));
        });

        const trans = await Promise.allSettled(promises);

        let currentUser;

        // Group by user
        trans.forEach((req) => {
            if (req?.status === 'rejected') {
                if (!req?.reason?.body) {
                    req.reason.body = createErrBody(UNKNOWN_REASON, req?.reason?.errorMessage);
                }
                result[currentUser]?.error?.push(req?.reason?.body);
            } else if (req?.status === 'fulfilled') {
                if (req.value?.user) {
                    currentUser = req.value.user;
                    return;
                }

                result[currentUser]?.success?.push(parseStringBody(req?.value?.body));
            }
        });

        // TODO remove when OneXP team confirm they implemented the change to use - Object.values(result)
        const resss = Object.values(result).reduce((acc, val) => {
            if (val.error.length) {
                const err = val.error.reduce((er, item) => Object.assign(er, typeof item === 'string' ? JSON.parse(item) : item), {});

                acc.error.push({
                    user: {
                        userId: val.user,
                    },
                    ...err,
                });
            }

            if (val.success.length) {
                const succ = val.success.reduce((su, item) => Object.assign(su, typeof item === 'string' ? JSON.parse(item) : item), {});

                acc.success.push({
                    user: {
                        userId: val.user,
                    },
                    amountInserted: val.amountInserted,
                    ...succ,
                });
            }

            return acc;
        }, {
            error: [],
            success: [],
        });

        if (resss.success.length === 0) {
            return createResponse(RESPONSE_INTERNAL_ERROR, createErrBody(UNKNOWN_REASON, resss));
        }

        return createResponse(RESPONSE_OK, resss);
        // return createResponse(RESPONSE_OK, Object.values(result));
    } catch (error) {
        if (error?.message?.includes('Cannot read properties of undefined (reading \'referrer\')')) {
            return createResponse(RESPONSE_INTERNAL_ERROR, createErrBody(CONFIGURATION_MALFORMED, INTERNAL_SERVER_ERROR));
        }
        if (error.message?.includes('Referral code was already used')) {
            return createResponse(RESPONSE_BAD_REQUEST, createErrBody(REFERRAL_CODE_ALREADY_USED, 'Referral code was already used'));
        }

        return createResponse(RESPONSE_INTERNAL_ERROR, createErrBody(UNKNOWN_REASON, INTERNAL_SERVER_ERROR));
    }
};

module.exports = {
    referralRewards: middy(referralRewardsLambda)
        .use(extractRequestParams())
        .use(fetchS3Config()),
};
