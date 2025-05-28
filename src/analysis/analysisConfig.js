const queryTableFlow = require('./queryTableFlow').executeQueryTableFlow;
const queryGdprTables = require('./queryTablesWithPII').queryTables;
const { getTableNameWithStageSuffixArrayWithPII } = require('../database/databaseSchemaUtils');
const {
    GPP_TRANSACTION_TABLE, GPP_PARTICIPATIONS_TABLE, PARTICIPATION_PINCODES_TABLE, GPP_DIGITAL_CODES_TABLE, GPP_USER_ROLES_TABLE,
} = require('../constants/tableNames');

const ANALYSIS_FLOWS = {
    getUserTransactions: {
        handler: queryTableFlow,
        tables: [
            GPP_TRANSACTION_TABLE,
        ],
    },
    exportGDPRUserData: {
        handler: queryGdprTables,
        tables: getTableNameWithStageSuffixArrayWithPII(),
    },
    getParticipation: {
        handler: queryTableFlow,
        tables: [
            GPP_PARTICIPATIONS_TABLE,
        ],
    },
    getPincodesParticipation: {
        handler: queryTableFlow,
        tables: [
            PARTICIPATION_PINCODES_TABLE,
        ],
    },
    getDigitalCodes: {
        handler: queryTableFlow,
        tables: [
            GPP_DIGITAL_CODES_TABLE,
        ],
    },
    getUserRole: {
        handler: queryTableFlow,
        tables: [
            GPP_USER_ROLES_TABLE,
        ],
    },
};

module.exports = {
    ANALYSIS_FLOWS,
};
