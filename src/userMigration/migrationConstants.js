const TableNames = require('../constants/tableNames');

module.exports = {
    IDENTITY_PROVIDERS: ['cds', 'cid', 'uuid'],
    MAX_WRITE_CAPACITY_UNITS: parseInt(process.env.CDS_MIG_MAX_WRITE_CAPACITY_UNITS),
    MAX_WCU_WAIT_TIME: parseInt(process.env.CDS_MIG_MAX_WCU_WAIT_TIME),
    MAX_ITERATION_COUNT: parseInt(process.env.CDS_MIG_MAX_ITERATION_COUNT),
    STANDARD_PROMISE_SIZE: parseInt(process.env.CDS_MIG_STANDARD_PROMISE_SIZE),
    MAX_ITERATION_LARGE_COUNT: 35,
    SSM_LAST_EVALUATED_USER: `/Migration/${process.env.stageName}/LastEvaluatedUser`,
    TABLE_QUERY_PARAMS: [
        {
            TableName: TableNames.GPP_TRANSACTION_TABLE,
            Delete: true,
            BatchSize: 15,
        },
        {
            TableName: TableNames.GPP_PARTICIPATIONS_TABLE,
            Delete: true,
            BatchSize: 10,
        },
        {
            TableName: TableNames.WINNING_MOMENTS_TABLE,
            IndexName: 'gppUserIdAndTierIndex',
            BatchSize: 25,
        },
        {
            TableName: TableNames.GPP_DIGITAL_CODES_TABLE,
            IndexName: 'gppUserIdIndex',
            BatchSize: 25,
        },
        {
            TableName: TableNames.GPP_UNSUCCESSFUL_BURN_ATTEMPTS_TABLE,
            IndexName: 'gpp_user_id',
            BatchSize: 25,
        },
        {
            TableName: TableNames.GPP_WALLET_TABLE,
            Delete: true,
            BatchSize: 25,
        },
        {
            TableName: TableNames.GPP_BLOCKED_USERS_TABLE,
            Delete: true,
            BatchSize: 25,
        },
        {
            TableName: TableNames.GPP_BLOCKED_PARTICIPATIONS_TABLE,
            Delete: true,
            BatchSize: 25,
        },
        {
            TableName: TableNames.EXPIRATION_WALLET_TABLE,
            Delete: true,
            BatchSize: 25,
        },
        {
            TableName: TableNames.GPP_ARCHIVED_UNBLOCKED_USERS_TABLE,
            IndexName: 'gpp_user_id',
            Delete: true,
            BatchSize: 25,
        },
    ],
};
