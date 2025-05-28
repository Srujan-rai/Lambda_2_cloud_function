const Moment = require('moment-timezone');
const { uploadFile } = require('../utility_functions/aws_sdk_utils/s3Utilities');
const { setupRedisClient } = require('../utility_functions/redisUtils');

const leaderboardExpiryLambda = async (event) => {
    const redisClient = setupRedisClient(event.redisECGroupEndpoint);

    try {
        const members = await redisClient.zrange(event.leaderboardKeyToExpire, 0, -1, 'WITHSCORES');
        const leaderboardToExport = members.reduce((accum, member, index) => {
            if (!(index % 2)) {
                accum.push({
                    rank: index / 2,
                    member,
                    score: members[index + 1],
                });
            }
            return accum;
        }, []);
        const uploadResult = await uploadFile(
            {
                Bucket: `${process.env.PRIVATE_BUCKET}`,
                Key: `${event.leaderboardKeyToExpire.split(':')[1]}/leaderboards/${(event.dailyExport // eslint-disable-line
                    ? ('dailyLeaderboard/' + `${Moment().format('YYYY-MM-DD')}/`) // eslint-disable-line
                    : 'finalLeaderboard/')}${event.leaderboardKeyToExpire}`, // eslint-disable-line
                Body: JSON.stringify(leaderboardToExport),
                ContentType: 'application/json',
            },
        );
        if (uploadResult?.$metadata?.httpStatusCode !== 200) {
            throw new Error(`Uploading leaderboard with Key: ${event.leaderboardKeyToExpire} to S3 failed with code ${uploadResult?.$metadata?.httpStatusCode}`);
        }
        console.log('Leaderboard uploaded to S3 successfully.');
        if (!event.dailyExport) {
            await redisClient.del(event.leaderboardKeyToExpire);
        }
    } catch (err) {
        console.error('Error while attempting to expire leaderboard:', err);
        throw err;
    } finally {
        await redisClient.disconnect();
    }
};

module.exports = {
    leaderboardExpiryLambda,
};
