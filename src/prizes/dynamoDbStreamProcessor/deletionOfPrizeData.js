const csv = require('csvtojson');
const { getPaginatedWinningMoments } = require('../../database/winningMomentsTable');
const { getDigitalCodesDataWithKeyAndLimit } = require('../../database/digitalCodesTable');
const { RESPONSE_OK } = require('../../constants/responses');
const {
    createResponse,
} = require('../../utility_functions/utilityFunctions');
const { GPP_DIGITAL_CODES_TABLE, WINNING_MOMENTS_TABLE } = require('../../constants/tableNames');
const DBUtils = require('../../database/dbUtilities');
const { listObjectsInS3V2, deleteFileFromS3, getFileFromS3 } = require('../../utility_functions/aws_sdk_utils/s3Utilities');
/**
 * Deletes prize data and its related entities based on the provided record.
 *
 * @param {Object} record - The database record containing the prize and configuration information.
 * @throws Will throw an error if required fields are missing or operations fail.
 */
const deletionOfPrizeData = async (record) => {
    try {
        const configurationId = record.configuration_id;
        const prizeId = record.prize_id;
        const voucherDist = record.voucher_dist;

        if (!prizeId) {
            const response = createResponse(RESPONSE_OK, {
                message: 'prizeId is missing in the record. Deletion process cannot proceed.',
            });
            return response;
        }
        if (!configurationId) {
            const response = createResponse(RESPONSE_OK, {
                message: 'configurationId is missing in the record. Deletion process cannot proceed.',
            });
            return response;
        }

        const promises = [
            queryAndDeleteRecords(WINNING_MOMENTS_TABLE, record), // winning Moments
            checkAndDeleteFilesFromS3(record, voucherDist),
        ];

        if (voucherDist) {
            promises.push(processByBatchForDigitalCode(record)); // forDigitalCode
        }

        await Promise.all(promises);

        console.log(`Deletion process completed for prizeId: ${prizeId} and configurationId: ${configurationId}`);
        const response = createResponse(RESPONSE_OK, {
            message: 'Successfully deleted winning moments and vouchers info',
        });
        return response;
    } catch (error) {
        console.error(`Error during prize data deletion: ${error.message}`);
        throw error;
    }
};

/**
 * Processes records by batch for digital codes.
 * If the record has defined total partitions, it processes all partitions.
 * @param {Object} record - The record containing partition and digital code data.
 * @property {number} [record.total_partitions] - The number of partitions to process.
 * @throws Will throw an error if the processing or query fails.
 */
const processByBatchForDigitalCode = async (record) => {
    try {
        if (record.total_partitions) {
            await processAllPartitions(record, record.total_partitions);
        } else {
            await queryAndDeleteRecords(GPP_DIGITAL_CODES_TABLE, record);
        }
    } catch (error) {
        console.error('Error in processByBatchForDigitalCode:', error);
        throw error;
    }
};

/**
 * Processes all partitions of a record in descending order.
 * Updates the `prize_id` for each partition and performs a query and delete operation.
 *
 * @param {Object} record - The record containing partition and prize data.
 * @param {number} startPartition - The starting partition number to process.
 * @returns {Promise<void>} A promise that resolves when all partitions are processed.
 */
const processAllPartitions = async (record, startPartition) => {
    const basePrizeId = record.prize_id.split('-')[0];
    const deletePromises = [
        queryAndDeleteRecords(GPP_DIGITAL_CODES_TABLE, {
            ...record,
            prize_id: basePrizeId,
        }),
    ];

    for (let i = startPartition; i >= 1; i--) {
        deletePromises.push(
            queryAndDeleteRecords(GPP_DIGITAL_CODES_TABLE, {
                ...record,
                prize_id: `${basePrizeId}-${i}`,
            }),
        );
    }

    await Promise.all(deletePromises);
};

/**
 * Queries a table and deletes matching records in batches.
 * Implements retry logic with exponential backoff to handle potential failures.
 *
 * @param {string} tableName - The name of the table to query and delete records from.
 * @param {Object} record - The query parameters to filter records in the table.
 */
const queryAndDeleteRecords = async (tableName, record) => {
    let lastEvaluatedKey = null;
    let retries = 0;
    const MAX_RETRIES = 5;
    const BACKOFF_TIME = 200;
    do {
        try {
            const { queryResult, key } = await queryTableFunction(tableName, record, lastEvaluatedKey);
            const items = queryResult.dataReceived || [];

            if (items.length === 0) {
                break;
            }

            const deleteRequests = items.map((item) => {
                const assignedKey = {};

                if (key.primary) {
                    assignedKey[key.primary] = item[key.primary];
                }
                if (key.sortKey) {
                    assignedKey[key.sortKey] = item[key.sortKey];
                }

                return { DeleteRequest: { Key: assignedKey } };
            });

            const params = {
                RequestItems: {
                    [tableName]: deleteRequests,
                },
            };
            await DBUtils.batchWrite(params);

            lastEvaluatedKey = queryResult.nextKey;
            retries = 0;
        } catch (error) {
            retries++;
            if (retries > MAX_RETRIES) {
                console.error('Max retries reached. Operation failed.', error);
                throw error;
            }
            console.warn(`Retrying operation (${retries}/${MAX_RETRIES})...`, error);

            const backoff = BACKOFF_TIME * 2 ** retries + Math.random() * 100;
            await new Promise((resolve) => setTimeout(resolve, backoff));
        }
    } while (lastEvaluatedKey);
};

/**
 * Queries a table based on the provided record and optional last evaluated key.
 * Returns the query result and associated key structure for further processing.
 *
 * @param {string} tableName - The name of the table to query.
 * @param {Object} record - The record containing query parameters.
 * @param {Object|null} lastEvaluatedKey - The key to continue querying from (if any).
 * @returns {Object} - An object containing the query result and key structure.
 */
const queryTableFunction = async (tableName, record, lastEvaluatedKey) => {
    if (tableName === GPP_DIGITAL_CODES_TABLE) {
        const queryResult = await getDigitalCodesDataWithKeyAndLimit(record.prize_id, lastEvaluatedKey, 25);

        return {
            queryResult,
            key: {
                primary: 'prize_id',
                sortKey: 'voucher',
            },
        };
    }
    if (tableName === WINNING_MOMENTS_TABLE) {
        const queryResult = await getPaginatedWinningMoments(record.configuration_id, record.prize_id, lastEvaluatedKey, 25);
        return {
            queryResult,
            key: {
                primary: 'configuration_id',
                sortKey: 'gmt_start',
            },
        };
    }
};

/** *
 * This function checks if there are files in S3 related to the record and deletes them. It also cleans empty winning moments files.
 *
 * @param {object} record
 * @param {boolean} voucherDist
 */
const checkAndDeleteFilesFromS3 = async (record, voucherDist) => {
    const bucket = process.env.PRIVATE_BUCKET;
    if (voucherDist) {
        await deleteVouchersForRecord(record, bucket);
    }
    await deleteWinningMomentsForRecord(record, bucket);
};

/**
 * This is a helper function to delete the vouchers for the record
 *
 * @param {object} record
 * @param {string} record.configuration_id
 * @param {string} record.prize_id
 * @param {string} bucket
 */
const deleteVouchersForRecord = async ({ configuration_id, prize_id }, bucket) => {
    const vouchersPath = `${configuration_id}/prizes/${prize_id}/voucherCSVs/`;
    const listVouchersCSVsParams = {
        Bucket: bucket,
        Prefix: vouchersPath,
    };
    const voucherCSVs = await listObjectsInS3V2(listVouchersCSVsParams);
    if (voucherCSVs && voucherCSVs?.Contents?.length) {
        const deleteVouchersParams = {
            Bucket: bucket,
            Delete: { Objects: voucherCSVs.Contents.map(({ Key }) => ({ Key })) },
        };
        await deleteFileFromS3(deleteVouchersParams, true);
    }
};

/**
 * This is a helper function to delete winning moments for the record and clean empty ones from the folder
 *
 * @param {object} record
 * @param {string} record.configuration_id
 * @param {string} record.prize_id
 * @param {string} bucket
 */
const deleteWinningMomentsForRecord = async ({ configuration_id, prize_id }, bucket) => {
    const winningMomentsPath = `${configuration_id}/winningMomentCSVs/`;
    const listWinningMomentsParams = {
        Bucket: bucket,
        Prefix: winningMomentsPath,
    };
    const winningMomentsCSVs = await listObjectsInS3V2(listWinningMomentsParams);
    if (winningMomentsCSVs && winningMomentsCSVs?.Contents?.length) {
        const winningMomentsFilesData = await Promise.all(winningMomentsCSVs.Contents.map(async ({ Key }) => {
            const params = {
                readConfFileParams: {
                    Bucket: bucket,
                    Key,
                },
                ErrorMessage: "Winning moments csv file doesn't exist",
            };
            const fileAsString = await getFileFromS3(params, false);
            return { filePath: Key, data: await csv().fromString(fileAsString) };
        }));
        const emptyWinningMomentsFiles = winningMomentsFilesData.filter(({ data }) => data.length === 0).map(({ filePath }) => filePath);
        const filesForDeletion = winningMomentsFilesData.reduce((acc, wmFile) => {
            if (wmFile.data.length === 0) return acc;
            const hasPrizeId = wmFile.data.some((obj) => Object.entries(obj).some(([key, value]) => {
                const indexForPrizeId = key.split(';').indexOf('prizeId');
                const prizeIdForWinningMoment = value.split(';')[indexForPrizeId];
                return prizeIdForWinningMoment === prize_id;
            }));
            if (hasPrizeId) acc.push(wmFile.filePath);
            return acc;
        }, []);
        const deleteWinningMomentsParams = {
            Bucket: bucket,
            Delete: { Objects: [...filesForDeletion, ...emptyWinningMomentsFiles].map((filePath) => ({ Key: filePath })) },
        };
        await deleteFileFromS3(deleteWinningMomentsParams, true);
    }
};

module.exports = {
    deletionOfPrizeData,
};
