const utils = require('../utility_functions/aws_sdk_utils/apigwUtilities');
const { publishToSnsTopic } = require('../utility_functions/aws_sdk_utils/snsUtilities');

/**
 * Lambda that will get list of usage plans, check
 * if the remaning quota for any of them is below 20%
 * and send an email notification
 */

module.exports.checkUsagePlans = async () => {
    try {
        const usagePlans = await utils.getAllUsagePlans();
        if (usagePlans.length === 0) return;

        let emailMessage = '';

        await Promise.all(
            usagePlans.map(async (plan) => {
                if (!plan.quota) return;
                // Calculate the remaining quota for each key assigned of the usage plan
                const { limit } = plan.quota;
                const remainingQuotaPerKey = await utils.getRemainingQuota(
                    plan.id,
                );
                Object.entries(remainingQuotaPerKey).forEach(([key, value]) => {
                    const remainingPercentage = (value * 100) / limit;
                    // If quota <= 20% send an email
                    if (remainingPercentage <= 20) {
                        emailMessage += `{${plan.name}: {key id:${key}, remaining quota: ${remainingPercentage}%}},`;
                    }
                });
            }),
        );
        if (emailMessage !== '') {
            const snsParams = {
                Message: `${emailMessage}`,
                Subject: 'Low Remaining Quota for Usage Plan',
                TopicArn: `arn:aws:sns:${process.env.regionName}:${process.env.accountId}:${process.env.stageName}-alarms`,
            };
            await publishToSnsTopic(snsParams);
            console.log(emailMessage);
            return 'Email alert was sent successfully';
        }
        return 'No action needed';
    } catch (error) {
        console.log(error);
    }
};
