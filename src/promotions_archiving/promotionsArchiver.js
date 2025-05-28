const Moment = require('moment-timezone');
const { getPromotionByDateAndNotArchived } = require('../database/promotionsTable');
const { GPP_PROMOTIONS_TABLE } = require('../constants/tableNames');
const { splitArray } = require('../utility_functions/utilityFunctions');
const dbUtils = require('../database/dbUtilities');

const promotionsArchiver = async () => {
    try {
        const moment = Moment();
        const currentTimestamp = moment.toDate().getTime();
        const promotionItems = await getPromotionByDateAndNotArchived(currentTimestamp);
        if (promotionItems.length === 0) {
            console.log('No items to process');
            return;
        }
        const promotionChunks = splitArray(promotionItems, 25);

        // eslint-disable-next-line no-restricted-syntax
        for (const chunk of promotionChunks) {
            console.log('Processing batch...');
            const res = await batchWritePromoItems(chunk);
            if (res.UnprocessedItems && res.UnprocessedItems.length > 0) {
                console.log('Unprocessed items:', res.UnprocessedItems);
            }
        }
    } catch (err) {
        console.error('Error while archiving promotions', err);
    }
};

const createWriteParams = (promotionItems) => {
    const insertParams = {
        RequestItems: {
            [GPP_PROMOTIONS_TABLE]: [],
        },
    };
    promotionItems.forEach((item) => {
        item.archived = true;
        item.last_modified = new Date().getTime();
        // To do: Add ttl for the promo item;
        insertParams.RequestItems[GPP_PROMOTIONS_TABLE].push({
            PutRequest: {
                Item: item,
            },
        });
    });
    return insertParams;
};

const batchWritePromoItems = async (promoItems) => {
    const writeParams = createWriteParams(promoItems);
    return dbUtils.batchWrite(writeParams);
};

module.exports = {
    promotionsArchiver,
};
