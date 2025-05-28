const { ElastiCacheClient, DescribeReplicationGroupsCommand } = require('@aws-sdk/client-elasticache');
const { createClient } = require('@middy/util');
const { createErrBody, createResponse } = require('../utility_functions/utilityFunctions');
const { processCache } = require('./utils');
const { ERR_CODES } = require('../constants/errCodes');
const { RESPONSE_BAD_REQUEST } = require('../constants/responses');

const defaults = {
    AwsClient: ElastiCacheClient,
    awsClientAssumeRole: undefined,
    awsClientCapture: undefined,
    awsClientOptions: {},
    cacheExpiry: -1,
};

const fetchECReplicationGroup = (opts = {}, replicationGroupId, useGroup = 'true') => {
    const options = { ...defaults, ...opts };

    let client = null;

    const fetch = async () => {
        const params = {
            ReplicationGroupId: replicationGroupId,
            ShowCacheNodeInfo: true,
            ShowCacheClustersNotInReplicationGroups: true,
        };
        return client.send(new DescribeReplicationGroupsCommand(params));
    };

    const fetchECReplicationGroupBefore = async (request) => {
        if (useGroup === 'false') {
            return;
        }
        if (request.event.warmer) {
            console.log('Lambda warmer event');
            return Promise.resolve();
        }

        if (!client) { client = await createClient(options, request); }

        try {
            const newOptions = { ...options, cacheKey: 'eccReplicationGroup' };
            const { value } = await processCache(newOptions, fetch, replicationGroupId);
            const fetchedECCReplicationGroup = await value;

            request.event.eccReplicationGroup = fetchedECCReplicationGroup;
        } catch (err) {
            console.error('ERROR: Failed to fetch ECC replication group info', JSON.stringify(err));

            const errorBody = createErrBody(ERR_CODES.ECC_GET_REPGROUP_ERROR, 'Failed to fetch replication group info',
                undefined, undefined);
            return createResponse(RESPONSE_BAD_REQUEST, errorBody);
        }
    };

    return { before: fetchECReplicationGroupBefore };
};

module.exports = {
    fetchECReplicationGroup,
};
