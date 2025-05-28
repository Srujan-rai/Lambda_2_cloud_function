const AdmZip = require('adm-zip');
const Utils = require('../utility_functions/utilityFunctions');
const { getConfiguration } = require('../utility_functions/configUtilities');
const currencyDb = require('../database/currencyDatabase');
const allocationRulesDb = require('../database/currencyAllocationRuleDatabase');
const prizeCatalogueDb = require('../database/prizeCatalogueTable');
const { ERROR_CODES: { UNKNOWN_ERROR } } = require('../constants/errCodes');
const { RESPONSE_INTERNAL_ERROR } = require('../constants/responses');

/**
 * Reset the prize counters
 * @param {Array<Object>} prizes
 */
const resetPrizeCounters = (prizes) => {
    if (prizes && prizes.length) {
        prizes.forEach((prize) => {
            Object.keys(prize).filter((v) => v.startsWith('total_')).forEach((counter) => { prize[counter] = 0; });
        });
    }
};

/**
 * Zips the data and returns a buffer object
 * @param {Object} data
 * @returns {Buffer}
 */
const zipData = (data) => {
    const zip = new AdmZip();

    Object.entries(data).forEach(([key, val]) => {
        zip.addFile(`${key}.json`, Buffer.from(JSON.stringify(val)));
    });

    console.log('Everything zipped, returning buffer...');
    return zip.toBuffer();
};

/**
 * Download Replication handler. Gets the needed data from the DB and the configuration file from S3.
 * Zips everything and returns a base64 body.
 * @param {Object} event AWS Event
 * @returns {Object}
 */
const downloadReplication = async (event) => {
    try {
        const params = Utils.extractParams(event);
        const data = {};

        if (!params.configurationId) {
            throw new Error('missing mandatory parameter configuration Id');
        }

        data.config = await getConfiguration(params.configurationId);

        if (params.currencies) {
            data.currencies = await currencyDb.queryByConfigurationId(data.config);
        }

        if (params.allocationRules) {
            data.allocationRules = await allocationRulesDb.queryByConfigurationId(params.configurationId);
        }

        if (params.prizeData) {
            data.prizeData = {};

            const prizes = await prizeCatalogueDb.fullListQuery(params.configurationId);

            resetPrizeCounters(prizes);
            prizes.forEach((prize) => {
                data.prizeData[prize.prize_id] = {
                    prize,
                };
            });
        }

        const response = {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': true,
                'Access-Control-Expose-Headers': 'Content-Disposition',
                'Content-Type': 'application/zip',
                'Cache-Control': 'no-store',
                'Content-Disposition': `attachment; filename=replication-${process.env.apiName}-${process.env.stageName}-${new Date().getTime()}.zip`,
            },
            body: zipData(data).toString('base64'),
            isBase64Encoded: true,
        };

        return response;
    } catch (err) {
        if (err.body && err.headers) {
            return err;
        }

        const errorBody = Utils.createErrorBody(UNKNOWN_ERROR, 'Something went wrong.');
        return Utils.createResponse(RESPONSE_INTERNAL_ERROR, errorBody);
    }
};

module.exports = {
    downloadReplication,
};
