const {
    GetUsagePlansCommand,
    GetUsageCommand,
} = require('@aws-sdk/client-api-gateway');
const { createAPIGatewayClientManager } = require('../../awsSdkClientManager');

const apiGateway = createAPIGatewayClientManager();

/**
 * A function to query all usage plans for the account
 * @returns {Array}
 */
const getAllUsagePlans = async () => {
    const usagePlans = [];
    let position;
    do {
        const params = {
            limit: 100,
            position,
        };
        const data = await apiGateway.getClient().send(new GetUsagePlansCommand(params));
        usagePlans.push(...data.items);

        if (data.position) {
            ({ position } = data);
        }
    } while (position);
    return usagePlans;
};

/**
 * A function to query the remaining quota for each usage plan
 *  and all API keys assigned to it. It will query the usage
 * from the beginning of the month until the current date.
 * The function will return an object for each api key and the remaining quota
 * @param {String} usagePlanId
 * @returns {Object}
 */
const getRemainingQuota = async (usagePlanId) => {
    const monthStart = new Date(new Date().setDate(1)).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    let quota = [];
    let position;
    const params = {
        usagePlanId,
        startDate: monthStart,
        endDate: today,
        limit: 5,
        position,
    };
    do {
        const data = await apiGateway.getClient().send(new GetUsageCommand(params));
        if (Object.values(data.items).length > 0) {
            quota = Object.keys(data.items).reduce((item, key) => {
                item[key] = data.items[key]?.at(-1)?.at(1);
                return item;
            }, {});
        }
        if (data.position) {
            ({ position } = data);
        }
    } while (position);
    return quota;
};

module.exports = {
    getAllUsagePlans,
    getRemainingQuota,
};
