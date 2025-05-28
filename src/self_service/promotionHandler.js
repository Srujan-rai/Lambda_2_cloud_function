const uniqid = require('uniqid');
const Moment = require('moment-timezone');
const Utils = require('../utility_functions/utilityFunctions');
const promotionsTable = require('../database/promotionsTable');
const { RESPONSE_OK } = require('../constants/responses');

/**
 * Preparing promo metadata object
 */
const preparePromoMetadata = (eventParams) => {
    const metadata = eventParams.promotionMetaData;
    const moment = Moment();

    if (!metadata.promotionId) {
        metadata.promotionId = uniqid();
        metadata.creationTime = moment.toDate().getTime();
    }

    metadata.lastModified = moment.toDate().getTime();
    return Promise.resolve(metadata);
};

/**
 * Create promotion and insert it to promotionsTable
 * @param event - data that we receive from request
 * @param context
 * @param callback - return data
 */
module.exports.promotionCreate = (event, context, callback) => {
    const eventParams = Utils.extractParams(event);
    console.log('Extracted params:\n', JSON.stringify(eventParams));

    preparePromoMetadata(eventParams)
        .then((metadata) => promotionsTable.putEntry(metadata))
        .then((result) => {
            const body = Utils.parseBody(result);
            const response = Utils.createResponse(RESPONSE_OK, {
                promotionCreated: true,
                promotionId: body.entry.promotionId,
                promotion: body.entry,
            });
            console.log('Returning success response');
            callback(null, response);
        })
        .catch((err) => {
            console.error('ERROR: Returning error response:\n', JSON.stringify(err));
            callback(null, err);
        });
};
