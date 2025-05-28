const ContentDisposition = require('content-disposition');
const { SHA256 } = require('crypto-js');
const { saveToS3 } = require('../utility_functions/aws_sdk_utils/s3Utilities');
const { getExportDate } = require('../utility_functions/utilityFunctions');
const { query } = require('../database/dbUtilities');
const { markUsersAsExported } = require('./cdsMigrationUtils');

const { MIGRATION_TABLE } = process.env;

const encodeUsersUUID = (users) => users.map(({ hashedKocid, uuid }) => ({
    hashedUuid: SHA256(uuid).toString(),
    hashedKocid,
}));

const exporter = async () => {
    try {
        const migratedUsers = await query({
            TableName: MIGRATION_TABLE,
            KeyConditionExpression: 'migration = :completed',
            FilterExpression: 'migrated = :markedForExport AND exported <> :alreadyExported',
            ExpressionAttributeValues: {
                ':completed': 'completed',
                ':markedForExport': true,
                ':alreadyExported': true,
            },
            IndexName: 'migration-lastRequestT-index',
        });

        if (!migratedUsers.length) {
            console.log('Nothing to Migrate');
            return;
        }

        const encodedUsers = encodeUsersUUID(migratedUsers);
        const { exportDate, dateMil } = getExportDate();
        const fileName = `analysis/userMigration/${exportDate}/${MIGRATION_TABLE}_${dateMil}.json`;

        await saveToS3({
            Key: fileName,
            Body: JSON.stringify(encodedUsers),
            Bucket: process.env.PRIVATE_BUCKET,
            ContentType: 'application/json',
            ContentDisposition: ContentDisposition(fileName, {
                type: 'inline',
            }),
        });

        await markUsersAsExported(migratedUsers);
        // For now we skip deletion
        // await deleteUsers(encodedUsers);
    } catch (err) {
        console.error(`Migrated users export failed with error: ${err}`);
        throw err;
    }
};

module.exports = {
    exporter,
};
