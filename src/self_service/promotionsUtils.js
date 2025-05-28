const { getPromoMetadata } = require('../database/promotionsTable');

const getMetadata = (promotionId) => getPromoMetadata(promotionId)
    .then((queryResult) => Promise.resolve(queryResult[0]));

const getMetadataParameter = async (promotionId, paramName) => {
    console.log('Checking metadata parameter, looking for:', paramName);
    const [res] = await getPromoMetadata(promotionId);

    if (!res) {
        console.log(paramName, 'is undefined');
        return undefined;
    }

    console.log(`${paramName}: ${res[paramName]}`);
    return res[paramName];
};

module.exports = {
    getMetadata,
    getMetadataParameter,
};
