const moment = require('moment');
const { putItem, query, update } = require('../../database/dbUtilities');
const { createResponse } = require('../utilityFunctions');
const { queryWithPagination } = require('../../database/dbUtilities');
const {
    RESPONSE_OK,
    RESPONSE_INTERNAL_ERROR,
} = require('../../constants/responses');
const { RS_TRANSACTION_STATUSES } = require('../../constants/plugins');

const tableName = `gpp_participations_table_${process.env.stageName}`;

/**
 * Handles the processing response for RS plugins.
 * Writes participation data to the DynamoDB table and updates the event object.
 *
 * @param {number} inputStatus - The HTTP status code of the response (e.g., 200, 202).
 * @param {Object} inputData - The response data from the plugin.
 * @param {Object} event - The event object containing request and context information.
 * @param {string} inputParticipationId - The unique participation ID.
 */

const rsProcessingResponse = async (inputStatus, inputData, event, inputParticipationId) => {
    event.pluginOutput = inputData;
    const configurationId = event?.body?.configurationId || event?.queryStringParameters?.configurationId;
    const hashedKocid = event?.requestContext?.authorizer?.hashed_kocid;
    const userIdType = event?.customParameters?.cachedConfigurations?.[configurationId]?.configurationParameters?.userIdType;
    const dbInput = {
        gpp_user_id: `${hashedKocid}|${userIdType}`,
        request_id: event?.requestContext?.requestId,
        configuration_id: configurationId,
        entry_date: moment().format('YYYY-MM-DD'),
        participation_id: inputParticipationId,
        participation_time: (moment().valueOf()).toString(),
    };
    if (inputStatus === 200) {
        // eslint-disable-next-line
        if (inputData.transactionStatus === 'INVALID_RECEIPT' || !inputData.applicableProducts?.length) {
            dbInput.status = 'complete';
            event.permitIntoCoreLogic = 'block';
        } else if (inputData.transactionStatus === 'REVIEW') {
            dbInput.status = 'processing';
            event.permitIntoCoreLogic = 'block';
        } else {
            dbInput.status = 'complete';
            event.permitIntoCoreLogic = 'allow';
        }

        event.body.participation_id = inputParticipationId;
    }
    if (inputStatus === 202) {
        event.permitIntoCoreLogic = 'block';
        dbInput.status = 'processing';
    }
    if (inputData) {
        dbInput.pluginOutput = inputData;
        dbInput.message_meta = event?.requestContext?.authorizer?.envDetails;
    }

    try {
        await putItem({
            TableName: tableName,
            Item: dbInput,
        });
        event.body.participation_id = inputParticipationId;
    } catch (e) {
        console.log('Failed to write participation during plugin operation with error:', e);
    }
};

/**
 * Handles participation-only logic for RS plugins.
 * Queries the DynamoDB table using the participation ID and updates the item's status to "complete".
 *
 * @param {Object} event - The event object containing request and context information.
 */

const rsParticipationOnly = async (event) => {
    const participationId = event?.body?.participationId;

    if (!participationId) {
        console.log('Participation ID is missing in the event body.');
        return;
    }

    try {
        const queryResult = await query({
            TableName: tableName,
            IndexName: 'participationIdIndex',
            KeyConditionExpression: 'participation_id = :participationId',
            ExpressionAttributeValues: {
                ':participationId': participationId,
            },
        });

        if (!queryResult?.length) {
            console.log(`No participation found for participationId: ${participationId}`);
            return;
        }

        const [participationRec] = queryResult;

        if (participationRec.pluginOutput?.transactionStatus !== RS_TRANSACTION_STATUSES.PROCESSED) {
            event.permitIntoCoreLogic = 'block';
            event.pluginOutput = participationRec.pluginOutput;
        }

        await update({
            TableName: tableName,
            Key: {
                gpp_user_id: participationRec.gpp_user_id,
                request_id: participationRec.request_id,
            },
            UpdateExpression: 'SET #status = :status, #participation_time = :participationTime',
            ExpressionAttributeNames: {
                '#status': 'status',
                '#participation_time': 'participation_time',
            },
            ExpressionAttributeValues: {
                ':status': 'complete',
                ':participationTime': moment().valueOf().toString(),
            },
        });
        event.requestContext.requestId = participationRec.request_id; // setting the req ID to the req ID of the previously created object
        event.requestContext.authorizer.userId = event.requestContext.authorizer.hashed_kocid;
        console.log(`Participation updated successfully for participationId: ${participationId}`);
    } catch (e) {
        console.log('Failed to query or update participation during plugin operation with error:', e);
    }
};

/**
 * Handles participation querying for participations that resulted from the RS scanner output.
 * This function is exposed via API Gateway and requires only gppUserId as input.
 * It only returns the participation objects that have the status property
 *
 * @param {String} userType - OPTIONAL. Defaults to |cds if not passed.
 * @param {String} limit - OPTIONAL. The maximum number of participations to return.
 * @param {String} exclusiveStartKey - OPTIONAL. The key to start the pagination from.
 * @param {String} statusFilter - OPTIONAL. The status to filter the participations by.
 * @returns {Object} - The response object containing the queried participations including the plugin output.
 * @throws {Error} - Throws an error if the query fails.
 */

const queryParticipationsWithStatus = async (event) => {
    const inputLimit = event?.queryStringParameters?.limit;
    const exclusiveStartKey = event?.queryStringParameters?.exclusiveStartKey;
    const statusFilter = event?.queryStringParameters?.statusFilter;
    const configurationId = event?.queryStringParameters?.configurationId;
    const gppUserId = `${event?.requestContext?.authorizer?.hashed_kocid}|${(event?.queryStringParameters?.userType || 'cds')}`;

    const queryParams = {
        TableName: tableName,
        KeyConditionExpression: 'gpp_user_id = :gppUserId',
        ExpressionAttributeValues: {
            ':gppUserId': gppUserId,
        },
        FilterExpression: 'attribute_exists(#status)',
        ExpressionAttributeNames: {
            '#status': 'status',
        },
    };
    if (statusFilter) {
        queryParams.FilterExpression += ' AND #status = :statusFilter';
        queryParams.ExpressionAttributeValues[':statusFilter'] = statusFilter;
    }
    if (configurationId) {
        queryParams.FilterExpression += ' AND configuration_id = :configurationId';
        queryParams.ExpressionAttributeValues[':configurationId'] = configurationId;
    }
    if (exclusiveStartKey) {
        queryParams.ExclusiveStartKey = JSON.parse(exclusiveStartKey);
    }
    try {
        const queryPaginatedResult = await queryWithPagination(queryParams, inputLimit || 25, inputLimit || 25, ['gpp_user_id', 'request_id'], exclusiveStartKey);
        const resultWithoutObsoleteProps = {
            dataReceived: queryPaginatedResult.dataReceived.map((participationItem) => {
                const { message_meta, ...restOfObject } = participationItem;
                return restOfObject;
            }),
        };
        console.log('Query result:', resultWithoutObsoleteProps);
        return createResponse(RESPONSE_OK, resultWithoutObsoleteProps);
    } catch (error) {
        console.log('Failed to query participations with error:', error);
        return createResponse(RESPONSE_INTERNAL_ERROR, error);
    }
};

module.exports = {
    queryParticipationsWithStatus,
    rsProcessingResponse,
    rsParticipationOnly,
};
