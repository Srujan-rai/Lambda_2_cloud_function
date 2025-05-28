const schema = require('./databaseSchema.json');

/**
 * Get table data by table name
 *
 * @param {string} tableName - Table name
 * @returns {string|undefined} - Returns table data or undefined if unable to fine the data
 */
const getTableData = (tableName) => {
    if (!tableName) return undefined;
    const tables = schema.tables.filter((obj) => tableName.includes(obj.name));
    if (tables.length) {
        return tables[0];
    }
    return undefined;
};

/**
 * Get table key by table name and key type
 *
 * @param {string} tableName - Table name
 * @param {string} keyType - Ket type (partitionKey or sortKey)
 * @returns {string|undefined} - Returns table key or undefined if it fails to get it
 */
const getKey = (tableName, keyType) => {
    const tableData = getTableData(tableName);
    if (tableData) {
        return tableData[keyType];
    }
    return undefined;
};

/**
 * Get table partition key by table name
 *
 * @param {string} tableName - Table name
 * @returns {string|undefined} - Returns table partition key or undefined if it fails to get it
 */
const getPartitionKey = (tableName) => getKey(tableName, 'partitionKey');

/**
 * Get table sort key by table name
 *
 * @param {string} tableName - Table name
 * @returns {string|undefined} - Returns table sort key or undefined if it fails to get it
 */
const getSortKey = (tableName) => getKey(tableName, 'sortKey');

/**
 * Get table's indexes by table name
 *
 * @param {string} tableName - Table name
 * @return {Array} - Returns table's indexes
 */
const getTableIndexes = (tableName) => {
    const tableData = getTableData(tableName);
    if (tableData && tableData.indexes) {
        return tableData.indexes;
    }
    return [];
};

/**
 * Get the right table index by Partition Key
 *
 * @param {string} tableName - Table name
 * @param {string} partitionKey - Partition Key
 * @returns {Object|undefined} - Returns index object or undefined if unable to fine the index
 */
const getRightIndexByPartitionKey = (tableName, partitionKey) => {
    const indexArray = getTableIndexes(tableName);
    if (indexArray.length > 0) {
        const filterIndexes = indexArray.filter((obj) => obj.partitionKey === partitionKey);
        if (filterIndexes.length) {
            return filterIndexes[0];
        }
    }
    return undefined;
};

/**
 * Get the right table index name by Partition Key
 *
 * @param {string} tableName - Table name
 * @param {string} partitionKey - Partition Key
 * @returns {string|undefined} - Returns index name or undefined if unable to fine the index
 */
const getRightIndexNameByPartitionKey = (tableName, partitionKey) => {
    const index = getRightIndexByPartitionKey(tableName, partitionKey);
    if (index) {
        return index.name;
    }
    return undefined;
};

/**
 * Get all tables that contain PII
 *
 * @return {Array} - Array of tables
 */
const getTablesWithPII = () => schema.tables.filter((obj) => obj.hasPIIData);

/**
 * Get all table names of the tables that contain PII
 *
 * @return {Array} - Array of table names
 */
const getTableNameArrayWithPII = () => {
    const tableNameArray = [];
    schema.tables.forEach((table) => {
        if (table.hasPIIData) {
            tableNameArray.push(table.name);
        }
    });
    return tableNameArray;
};

/**
 * Get all table names with stage suffix of the tables that contain PII
 *
 * @return {Array} - Array of table names with stage suffix
 */
const getTableNameWithStageSuffixArrayWithPII = () => {
    const tableNameArray = [];
    schema.tables.forEach((table) => {
        if (table.hasPIIData) {
            tableNameArray.push(`${table.name}_${process.env.stageName}`);
        }
    });
    return tableNameArray;
};

/**
 * Get table columns by table name
 *
 * @param tableName - Table name
 * @return {Array} - Array of table columns
 */
const getTableColumns = (tableName) => {
    const table = getTableData(tableName);
    if (!table) {
        return [];
    }
    const columnsArray = Object.keys(table.attributes).map((attr) => attr);
    return columnsArray;
};

/**
 * Checks if the specified table has a specified Partition Key
 *
 * @param {string} tableName Name of the table
 * @param {string} partitionKey Partition key for the table
 * @returns {boolean} Returns true if table has the specific Partition Key
 */
const checkIfTablesHasPartitionKey = (tableName, partitionKey) => {
    const tableData = getTableData(tableName);
    if (tableData && tableData.partitionKey === partitionKey) {
        return true;
    }
    return false;
};

/**
 * Retrieve All table names
 */
const getAllTableNames = () => schema.tables.map((table) => table.name);

module.exports = {
    getTableData,
    getPartitionKey,
    getSortKey,
    getTableIndexes,
    getRightIndexByPartitionKey,
    getRightIndexNameByPartitionKey,
    getTablesWithPII,
    getTableNameArrayWithPII,
    getTableNameWithStageSuffixArrayWithPII,
    getTableColumns,
    getAllTableNames,
    checkIfTablesHasPartitionKey,
};
