const PromotionsTable = require('../database/promotionsTable');
const ParticipationsTable = require('../database/participationsDatabase');
const DBUtils = require('../database/dbUtilities');
const { publishToSnsTopic } = require('../utility_functions/aws_sdk_utils/snsUtilities');

/**
 * Queries participation table.
 *
 * @param {String} configurationId - Configuration Id
 * @param {String} date - date string in format YYYY-MM-DD
 *
 * @returns {Promise}
 */
const checkParticipations = async (configurationId, date) => {
    const result = await ParticipationsTable.queryByConfigurationAndDate(configurationId, date);
    return {
        configurationId,
        participationRecord: result[0],
    };
};

/**
 * Lambda that will get list of configurations from promotion table and check
 * if something was recorded in participation table for any of them
 */
module.exports.configParticipation = async () => {
    if (process.env.createAlarms !== 'true') {
        return 'Alarms are not configured for this stage';
    }

    try {
        const promotions = await PromotionsTable.scanAllPromotions();
        // Remove config duplicates if any
        const configurations = promotions.map((promotion) => promotion.configurations)
            .flat()
            .sort()
            .filter((item, idx, arr) => !idx || item !== arr[idx - 1]);
        const timestampYesterday = Date.now() - 86400000; // current time - 24h
        const promises = configurations.map((configuration) => checkParticipations(
            configuration,
            DBUtils.getInsertDate(timestampYesterday),
        ));
        const participationsQueryResults = await Promise.all(promises);
        const noParticipationConfigs = participationsQueryResults
            .filter((queryResultRecord) => !queryResultRecord.participationRecord)
            .map((queryResultRecord) => queryResultRecord.configurationId);
        if (noParticipationConfigs.length) {
            const snsParams = {
                Message: `There are no participations recorded yesterday for configurations: ${noParticipationConfigs}`,
                Subject: 'Configurations without participations',
                TopicArn: `arn:aws:sns:${process.env.regionName}:${process.env.accountId}:${process.env.stageName}-alarms`,
            };
            await publishToSnsTopic(snsParams);
        }
        return noParticipationConfigs;
    } catch (error) {
        return error;
    }
};
