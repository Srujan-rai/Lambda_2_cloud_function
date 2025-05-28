const Moment = require('moment-timezone');
const { createSchedule } = require('../utility_functions/aws_sdk_utils/schedulerUtilities');

const createLeaderboardExpirySchedule = async (leaderboardKey, inputConfigurationId, expiresAt, redisECGroupEndpoint) => {
    const targetAndRoleARN = {
        Arn: `arn:aws:lambda:${process.env.regionName}:${process.env.accountId}:function:${process.env.apiName}-${process.env.stageName}-leaderboardExpiryLambda`,
        RoleArn: `arn:aws:iam::${process.env.accountId}:role/LeaderboardSchedulerRole-${process.env.apiName}${process.env.stageName}-${process.env.regionName}`,
    };
    const commandInputMap = {
        finalLeaderboardExpirySchedule: {
            Name: `Final_expiry_schedule_for_Leaderboard_${inputConfigurationId}_${process.env.stageName}`,
            ScheduleExpression: `at(${Moment(expiresAt).format('YYYY-MM-DD[T]HH:mm:ss')})`,
            Description: `A schedule created to trigger the final expiry process for Leaderboard: ${leaderboardKey}`,
            Target: {
                ...targetAndRoleARN,
                Input: JSON.stringify({
                    leaderboardKeyToExpire: leaderboardKey,
                    redisECGroupEndpoint,
                }),
            },
            FlexibleTimeWindow: {
                Mode: 'OFF',
            },
            ActionAfterCompletion: 'DELETE',
            RetryPolicy: {
                MaximumRetryEvents: 3,
            },
        },
        dailyLeaderBoardExpirySchedule: {
            Name: `Daily_export_schedule_for_Leaderboard_${inputConfigurationId}_${process.env.stageName}`,
            ScheduleExpression: 'rate(24 hours)',
            EndDate: Moment(expiresAt).toDate(),
            Description: `A schedule created to trigger the daily export process for Leaderboard: ${leaderboardKey}`,
            Target: {
                ...targetAndRoleARN,
                Input: JSON.stringify({
                    dailyExport: true,
                    leaderboardKeyToExpire: leaderboardKey,
                    redisECGroupEndpoint,
                }),
            },
            FlexibleTimeWindow: {
                Mode: 'OFF',
            },
            ActionAfterCompletion: 'DELETE',
            RetryPolicy: {
                MaximumRetryEvents: 3,
            },
        },
    };

    const expiresWithin24Hrs = (Moment().valueOf() + 86400000) > expiresAt;
    if (expiresWithin24Hrs) {
        await createSchedule(commandInputMap.finalLeaderboardExpirySchedule);
    } else {
        await Promise.all(Object.keys(commandInputMap).map((commandInputKey) => createSchedule(commandInputMap[commandInputKey])));
    }
};

module.exports = {
    createLeaderboardExpirySchedule,
};
