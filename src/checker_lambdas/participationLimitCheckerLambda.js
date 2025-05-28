const warmer = require('lambda-warmer');
const Messages = require('@the-coca-cola-company/ngps-global-common-messages');
const moment = require('moment-timezone');
const { middyValidatorWrapper } = require('../middlewares/middyValidatorWrapper');
const Utils = require('../utility_functions/utilityFunctions');
const { getConfiguration } = require('../utility_functions/configUtilities');
const participationDb = require('../database/participationsDatabase');
const {
    LAMBDA_NAMES: { instantWin, promoEntry },
} = require('../constants/lambdas');
const { RESPONSE_BAD_REQUEST, RESPONSE_OK } = require('../constants/responses');
const {
    ERROR_CODES: { CHECKER_LAMBDA_REJECTION },
} = require('../constants/errCodes');
const { PARAMS_MAP } = require('../constants/common');
const {
    REQUIRED_PARAMETERS_FOR_CHECKER_LAMBDA,
} = require('../constants/checkers');
const {
    getItem,
    putEntry,
} = require('../database/blockedParticipationsDatabase');

const supportedMechanics = {
    instantWin: 'instant_win_winner',
    promoEntry: 'promo_entry_participation',
};
/**
 * Start timestamp is the start of the day ( In the preset timezone or utc)
 * End is calculated based on the end of the participation limit and the rolling period
 * The main calculation is based on https://momentjs.com/docs/#/get-set/min/
 *
 * @param {moment} startingMoment user participation time
 * @param {Number} end timestamp representing the end of the participation limit
 * @param {Number} rolling the rolling period ( days ) in which the limit will occur. I.e. if we have 2 days
 * period the minimum date ( end date ) for checking will not be the current day, but the day after.
 * This will be used if e.g. we want to limit the user participation for a week ( 168h ).
 * @returns {Object} start and end dates
 */
const calculateStartAndEndTimestamp = (startingMoment, end, rolling) => {
    const date = startingMoment.startOf('day');
    const startDate = parseInt(date.format('x'));
    const endDate = parseInt(
        moment
            .min(date.add(rolling - 1, 'days').endOf('day'), moment(end))
            .format('x'),
    );
    return {
        start: startDate,
        end: endDate,
    };
};

const checkParticipationLimit = async ({
    mechanic,
    userId,
    start,
    end,
    configId,
    limit,
}) => {
    const participationRes = await participationDb.getUserParticipationsIfAttributeExists(
        mechanic,
        userId,
        start,
        end,
        configId,
    );

    return {
        endTime: end,
        participationRes: participationRes && participationRes.Count >= limit,
    };
};

const calculateStartEndTimestamp = (time = moment(), rollingPeriod) => {
    const start = moment(time);
    const end = moment(time);

    return {
        startTimestamp: parseInt(
            start.subtract(rollingPeriod, 'h').format('x'),
        ),
        endTimestamp: parseInt(end.add(rollingPeriod, 'h').format('x')),
    };
};

const createDatesRangeParams = ({
    time,
    config,
    datesRange,
    rollingPeriod,
    checkHoursInRange,
}) => {
    const startDate = datesRange.startDate
        || config.configurationParameters.configurationStartUtc;
    const endDate = datesRange.endDate
        || config.configurationParameters.configurationEndUtc;

    // If the endDate of the participation specific range is the same as configurationEndDate,
    // we should throw an error to the customer, otherwise if the configurationEndDate is longer in the future,
    // than the limitEndDate, the customer should be able to participate.
    if (datesRange.endDate) {
        if (time.isBefore(startDate) || time.isAfter(endDate)) {
            if (
                datesRange.endDate < config.configurationParameters.configurationEndUtc
            ) {
                return { startTimestamp: 0, endTimestamp: 0 };
            }
            throw Utils.createResponse(
                RESPONSE_BAD_REQUEST,
                Utils.createErrorBody(
                    CHECKER_LAMBDA_REJECTION,
                    Messages.COMMON_ERR.PARTICIPATION_LIMIT_OUT_OF_RANGE,
                ),
            );
        }
    }

    if (checkHoursInRange) {
        return calculateStartEndTimestamp(time, rollingPeriod);
    }

    const { start, end } = calculateStartAndEndTimestamp(
        time,
        endDate,
        rollingPeriod,
    );
    return { startTimestamp: start, endTimestamp: end };
};

/**
 * Lambda function which checks the possibility of a user to participate in a given promo
 * When added as a checker, the lambda has 2 required parameters which will be gathered from the config:
 * codeBurningLimit - participation limit
 * codeBurningLimitTime - participation limit time in hours
 * If "participationLimitUseCalendarDates" var has been set to true, the checker will use calendar days instad of hours
 * e.g. 2021-01-29T00:00:00 - 2021-03-31T23:59:59
 * "codeBurningLimitTime" var will be used as a rolling period of the limit
 * (e.g. block the user for 7 days, after that he could participate again).
 * The value should be in hours and not less than 24
 *
 * @param {Object} event - Data that we receive from request
 * @param {Object} context - Lambda context
 * @param callback - Callback function for returning the response
 */
const baseParticipationLimitCheckerLambda = async (event) => {
    try {
        if (await warmer(event)) return 'warmed';
        const params = await Utils.safeExtractParams(event);
        const config = await getConfiguration(
            params.configurationId,
            event,
        );
        const expirationTimestamp = Utils.getExpirationTimestamp(config);
        moment.tz.setDefault(
            config.configurationParameters.configurationDatesTimezone,
        );
        const time = moment();
        const flow = config.flow[params.flowLabel];
        const configPartLimitVer = flow.params[PARAMS_MAP.PART_LIMIT_VER]
            ? flow.params[PARAMS_MAP.PART_LIMIT_VER]
            : 0;
        const getUserData = await getItem(
            params[PARAMS_MAP.GPP_USER_ID],
            params.configurationId,
        );
        const tablePartLimitVer = getUserData[0]?.part_limit_ver
            ? getUserData[0].part_limit_ver
            : 0;
        const partLimitMismatch = configPartLimitVer > tablePartLimitVer;
        const canUserParticipate = await checkUserParticipation(getUserData);

        if (!(canUserParticipate || partLimitMismatch)) {
            const resBody = Utils.createErrorBody(
                CHECKER_LAMBDA_REJECTION,
                Messages.COMMON_ERR.PARTICIPATION_LIMIT_REACHED,
            );
            throw Utils.createResponse(
                RESPONSE_BAD_REQUEST,
                Object.assign(resBody, {
                    nextAvailableParticipation:
                        getUserData[0].next_available_participation,
                }),
            );
        }
        const newTablePartLimitVer = configPartLimitVer > 0 ? configPartLimitVer : undefined;
        // PARTICIPATION_LIFETIME_LIMIT the time will be taken from the config
        if (flow.params[PARAMS_MAP.PARTICIPATION_LIMIT_MULTIPLE_CHECKS]) {
            const mechanic = flow.flowLambdas.find(
                (name) => name.includes('instantWin') || name.includes('promoEntry')).replace('Lambda', '');
            const checks = [];

            if (!Object.keys(supportedMechanics).includes(mechanic)) {
                // TODO Add meaningfull error
                const resBody = Utils.createErrorBody(
                    CHECKER_LAMBDA_REJECTION,
                    'The mechanic is not supported',
                );
                throw Utils.createResponse(RESPONSE_BAD_REQUEST, resBody);
            }
            // Lifetime limitations check
            if (flow.params[PARAMS_MAP.PARTICIPATION_LIFETIME_LIMIT]) {
                Utils.checkParametersFormat({
                    number: [
                        flow.params[PARAMS_MAP.PARTICIPATION_LIFETIME_LIMIT],
                    ],
                });

                checks.push(
                    checkParticipationLimit({
                        mechanic: supportedMechanics[mechanic],
                        userId: params[PARAMS_MAP.GPP_USER_ID],
                        start: config.configurationParameters
                            .configurationStartUtc,
                        end: config.configurationParameters.configurationEndUtc,
                        configId: params.configurationId,
                        limit: flow.params[
                            PARAMS_MAP.PARTICIPATION_LIFETIME_LIMIT
                        ],
                    }),
                );
            }
            // Calendar Days check - the rolling period is 24 hours ( 1 day )
            if (
                flow.params[PARAMS_MAP.PARTICIPATION_LIMIT_CALENDAR_DATES_LIMIT]
            ) {
                Utils.checkParametersFormat({
                    number: [
                        flow.params[
                            PARAMS_MAP.PARTICIPATION_LIMIT_CALENDAR_DATES_LIMIT
                        ],
                    ],
                });

                const { startTimestamp, endTimestamp } = createDatesRangeParams(
                    {
                        time,
                        config,
                        datesRange:
                            flow.params[
                                PARAMS_MAP
                                    .PARTICIPATION_LIMIT_CALENDAR_DATES_RANGE
                            ],
                        rollingPeriod: 1,
                    },
                );

                checks.push(
                    checkParticipationLimit({
                        mechanic: supportedMechanics[mechanic],
                        userId: params[PARAMS_MAP.GPP_USER_ID],
                        start: startTimestamp,
                        end: endTimestamp,
                        configId: params.configurationId,
                        limit: flow.params[
                            PARAMS_MAP.PARTICIPATION_LIMIT_CALENDAR_DATES_LIMIT
                        ],
                    }),
                );
            }
            if (flow.params[PARAMS_MAP.PARTICIPATION_LIMIT]) {
                Utils.checkRequiredFlowParameters(config, params.flowLabel, [
                    PARAMS_MAP.PARTICIPATION_LIMIT,
                    PARAMS_MAP.PARTICIPATION_LIMIT_TIME,
                ]);

                Utils.checkParametersFormat({
                    number: [
                        flow.params[PARAMS_MAP.PARTICIPATION_LIMIT_TIME],
                        flow.params[PARAMS_MAP.PARTICIPATION_LIMIT],
                    ],
                });

                const { startTimestamp, endTimestamp } = flow.params[
                    PARAMS_MAP.PARTICIPATION_LIMIT_START_END_DATES_RANGE
                ]
                    ? createDatesRangeParams({
                        time,
                        config,
                        datesRange:
                              flow.params[
                                  PARAMS_MAP
                                      .PARTICIPATION_LIMIT_START_END_DATES_RANGE
                              ],
                        rollingPeriod:
                              flow.params[PARAMS_MAP.PARTICIPATION_LIMIT_TIME],
                        checkHoursInRange: true,
                    })
                    : calculateStartEndTimestamp(
                        time,
                        flow.params[PARAMS_MAP.PARTICIPATION_LIMIT_TIME],
                    );

                checks.push(
                    checkParticipationLimit({
                        mechanic: supportedMechanics[mechanic],
                        userId: params[PARAMS_MAP.GPP_USER_ID],
                        start: startTimestamp,
                        end: endTimestamp,
                        configId: params.configurationId,
                        limit: flow.params[PARAMS_MAP.PARTICIPATION_LIMIT],
                    }),
                );
            }
            const promiseAllChecks = await Promise.all(checks);
            const userLimited = promiseAllChecks.filter(
                (value) => value.participationRes === true,
            );

            if (!userLimited.length) {
                const res = Utils.createResponse(RESPONSE_OK, '');
                return res;
            }

            const timeStampEnd = userLimited.reduce((acc, loc) => (acc.endTime > loc.endTime ? acc : loc),
            );
            const nextAvailableParticipationTimestamp = timeStampEnd.endTime;

            await putEntry(
                nextAvailableParticipationTimestamp,
                params[PARAMS_MAP.GPP_USER_ID],
                params.configurationId,
                newTablePartLimitVer,
                expirationTimestamp,
            );
            const resBody = Utils.createErrorBody(
                CHECKER_LAMBDA_REJECTION,
                Messages.COMMON_ERR.PARTICIPATION_LIMIT_REACHED,
            );
            throw Utils.createResponse(
                RESPONSE_BAD_REQUEST,
                Object.assign(resBody, {
                    nextAvailableParticipation:
                        nextAvailableParticipationTimestamp,
                }),
            );
        } else {
            Utils.checkRequiredFlowParameters(config, params.flowLabel, [
                PARAMS_MAP.PARTICIPATION_LIMIT,
                PARAMS_MAP.PARTICIPATION_LIMIT_TIME,
            ]);

            Utils.checkParametersFormat({
                number: [
                    flow.params[PARAMS_MAP.PARTICIPATION_LIMIT_TIME],
                    flow.params[PARAMS_MAP.PARTICIPATION_LIMIT],
                ],
            });
        }

        let startTimestamp;
        let endTimestamp;
        let nextAvailableParticipationTimestamp;

        if (flow.params[PARAMS_MAP.PARTICIPATION_LIMIT_USE_CALENDAR_DATES]) {
            const datesRange = flow.params[
                PARAMS_MAP.PARTICIPATION_LIMIT_CALENDAR_DATES_RANGE
            ];
            const startDate = datesRange
                ? datesRange.startDate
                : config.configurationParameters.configurationStartUtc;
            const endDate = datesRange
                ? datesRange.endDate
                : config.configurationParameters.configurationEndUtc;
            let rollingPeriod = flow.params[PARAMS_MAP.PARTICIPATION_LIMIT_TIME] / 24;

            // if the rolling period is not divisible by 24 set it to the minimum number of days
            if (rollingPeriod % 1 !== 0) {
                rollingPeriod = 1;
            }
            /* if we do not have dates provided we have to use the default ones, which were created on UTC time
                which is the same as the current one. Otherwise use the timezone provided to do the calculations */
            const participationTime = moment();

            if (
                participationTime.isSameOrAfter(startDate)
                && participationTime.isBefore(endDate)
            ) {
                const startEndRange = calculateStartAndEndTimestamp(
                    participationTime,
                    endDate,
                    rollingPeriod,
                );
                startTimestamp = startEndRange.start;
                endTimestamp = startEndRange.end;
            } else {
                nextAvailableParticipationTimestamp = endDate;
                await putEntry(
                    nextAvailableParticipationTimestamp,
                    params[PARAMS_MAP.GPP_USER_ID],
                    params.configurationId,
                    newTablePartLimitVer,
                    expirationTimestamp,
                );
                const resBody = Utils.createErrorBody(
                    CHECKER_LAMBDA_REJECTION,
                    Messages.COMMON_ERR.PARTICIPATION_LIMIT_OUT_OF_RANGE,
                );
                throw Utils.createResponse(RESPONSE_BAD_REQUEST, resBody);
            }
        } else {
            startTimestamp = Utils.decreaseDateTimeByHours(
                flow.params[PARAMS_MAP.PARTICIPATION_LIMIT_TIME],
            );
        }

        let participationRes;
        if (flow.flowLambdas.includes(instantWin)) {
            participationRes = await participationDb.getUserParticipationsDataIfAttributeExists(
                'instant_win_winner',
                params[PARAMS_MAP.GPP_USER_ID],
                startTimestamp,
                endTimestamp,
                params.configurationId,
            );
        } else if (flow.flowLambdas.includes(promoEntry)) {
            participationRes = await participationDb.getUserParticipationsDataIfAttributeExists(
                'promo_entry_participation',
                params[PARAMS_MAP.GPP_USER_ID],
                startTimestamp,
                endTimestamp,
                params.configurationId,
            );
        }

        if (
            !participationRes
            || !participationRes.length
            || participationRes.length
                < flow.params[PARAMS_MAP.PARTICIPATION_LIMIT]
        ) {
            const res = Utils.createResponse(RESPONSE_OK, '');
            console.log('Returning response:\n', JSON.stringify(res));
            return res;
        }

        if (
            flow.params[PARAMS_MAP.PARTICIPATION_LIMIT_TIME]
            && flow.params[PARAMS_MAP.PARTICIPATION_LIMIT_USE_CALENDAR_DATES]
                === undefined
        ) {
            const checkEarliestParticipation = participationRes.reduce(
                (prev, curr) => (+prev.participation_time < +curr.participation_time
                    ? prev
                    : curr),
            );
            const participationTimeNumber = +checkEarliestParticipation.participation_time;
            const calculateParticipationLimitTime = flow.params[PARAMS_MAP.PARTICIPATION_LIMIT_TIME] * 3600000;
            endTimestamp = participationTimeNumber + calculateParticipationLimitTime;
        }

        nextAvailableParticipationTimestamp = endTimestamp || config.configurationParameters.configurationEndUtc;

        await putEntry(
            nextAvailableParticipationTimestamp,
            params[PARAMS_MAP.GPP_USER_ID],
            params.configurationId,
            newTablePartLimitVer,
        );
        const resBody = Utils.createErrorBody(
            CHECKER_LAMBDA_REJECTION,
            Messages.COMMON_ERR.PARTICIPATION_LIMIT_REACHED,
        );
        throw Utils.createResponse(
            RESPONSE_BAD_REQUEST,
            Object.assign(resBody, {
                nextAvailableParticipation: nextAvailableParticipationTimestamp,
            }),
        );
    } catch (err) {
        console.error('ERROR: Returning error response:\n', err);
        return err;
    }
};

/**
 * Comparing currentimstamp and the next available participation date for the client, to deteremine whether he can,
 * participate at the moment or we can straightly reject him.
 * @param {*} userData
 * @returns - true or false depending on the outcome whether the client can participate at the moment or not.
 */
const checkUserParticipation = async (userData) => {
    if (userData.length === 0) {
        return true;
    }
    const nextAvailableParticipation = userData[0].next_available_participation;
    const currentTimestamp = moment().format('x');
    if (nextAvailableParticipation < Number(currentTimestamp)) {
        return true;
    }
    return false;
};

module.exports.participationLimitCheckerLambda = middyValidatorWrapper(baseParticipationLimitCheckerLambda,
    REQUIRED_PARAMETERS_FOR_CHECKER_LAMBDA.participationLimit);
