/* eslint-disable global-require */
const https = require('https');
const Stream = require('stream').Transform;
const AdmZip = require('adm-zip');

const {
    extractFileExtension,
    copyAsCamelCase,
    getConfigFilePath,
} = require('../utility_functions/utilityFunctions');
const {
    sendSQSMessage: sqsSendMessage,
    getReplicationUploadQueueURL,
} = require('../utility_functions/aws_sdk_utils/sqsUtilities');
const {
    saveToS3,
    getFileFromS3,
} = require('../utility_functions/aws_sdk_utils/s3Utilities');

const db = {
    currenciesDb: require('../database/currencyDatabase'),
    allocationRulesDb: require('../database/currencyAllocationRuleDatabase'),
    prizeCatalogueDb: require('../database/prizeCatalogueTable'),
};

/**
 * Extract the prize image uri path
 * @param {String} uri the prize image uri
 * @returns {String} prize image path
 */
const getUriPath = (uri) => uri.slice(uri.indexOf('prizeImage'));

/**
 * Extract the cloud front host
 * @param {String} uri the prize image uri
 * @returns {String} the uri host without protocol
 */
const getUriHost = (uri) => {
    const noProtocolUri = uri.replace(/https:\/\/|http:\/\//, '');
    return noProtocolUri.slice(0, noProtocolUri.indexOf('prizeImage') - 1);
};

/**
 * Copy the prize image via http request to the AWS CF and save it into public S3
 * @param {String} uri the prize image uri
 * @returns {Promise}
 */
const copyPrizeImage = (uri) => new Promise((resolve, reject) => {
    https.request({
        host: getUriHost(uri),
        path: `/${getUriPath(uri)}`,
        protocol: 'https:',
    }, (response) => {
        const data = new Stream();

        response.on('data', (chunk) => data.push(chunk));

        response.on('end', () => {
            saveToS3({
                Bucket: process.env.PUBLIC_BUCKET,
                Body: data.read(),
                Key: getUriPath(uri),
                ACL: 'public-read',
            }).then((res) => {
                resolve(res);
            }).catch((err) => {
                reject(err);
            });
        });
    }).end();
});

/**
 * Sends a sqs message
 * @param {Boolean} success
 * @param {Array} rejectedItems array with the rejected items
 * @param {String} reason the string of the error
 * @returns {Promise}
 */
const sendSQSMessage = (success, rejectedItems, reason) => sqsSendMessage({
    MessageBody: JSON.stringify({
        success,
        rejectedItems,
        reason,
    }),
    QueueUrl: getReplicationUploadQueueURL(),
});

/**
 * It gets the prize image uri path and add as a prefix the AWS CF host with the protocol
 * @param {Array|String} links the prize image uri extracted from the prize catalog db record
 * @returns {Array|String}
 */
const getNewPrizeImageUri = (links) => {
    if (!Array.isArray(links)) {
        return `${process.env.cloudFrontPublicUri}/${getUriPath(links)}`;
    }

    return links.map((link) => `${process.env.cloudFrontPublicUri}/${getUriPath(link)}`);
};

/**
 * Processes prizeData object, extracted from the archive.
 * It changes the img_url parameter with the apropriate host. E.g. if the package has been uploaded on gamma from dev
 * the img_url from https://ngps-public-bucket-dev.s3-eu-west-1.amazonaws.com/prizeImages/CCA-configuration-1/prize_one_currency/testImage1.png
 * will be changed to https://ngps-public-bucket-gamma.s3-eu-west-1.amazonaws.com/prizeImages/CCA-configuration-1/prize_one_currency/testImage1.png
 * After the change the data will be stored into the DB.
 * @param {Object} data prize data object
 * @returns {Array<Promise>}
 */
function processPrizeData(data) {
    const promises = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            const { prize } = data[key];
            if (Array.isArray(prize.img_url)) {
                prize.img_url.map((url) => promises.push(copyPrizeImage(url)));
            } else {
                promises.push(copyPrizeImage(prize.img_url));
            }

            prize.img_url = getNewPrizeImageUri(prize.img_url);
            promises.push(db.prizeCatalogueDb.putEntry(copyAsCamelCase(prize)));
        }
    }
    return promises;
}

/**
 * Processes the configuration file, extracted from the archive
 * @param {Object} data The config file in plain js object
 * @returns {Array<Promise>}
 */
function processConfig(data) {
    return [saveToS3({
        Body: JSON.stringify(data),
        Bucket: process.env.PRIVATE_BUCKET,
        ContentType: 'text/plain',
        Key: getConfigFilePath(data.configurationId),
    })];
}

/**
 * Produces a function which will be executed later on, to process the specified type of data
 * @param {String} type the type of the data which you want to process
 * @returns {Function}
 */
function processData(type) {
    if (type === 'prizeData') {
        return processPrizeData;
    } if (type === 'config') {
        return processConfig;
    }
    return (data) => {
        const promises = [];
        const camelCaseData = copyAsCamelCase(data);

        // eslint-disable-next-line no-restricted-syntax
        for (const item of camelCaseData) {
            promises.push(db[`${type}Db`].putEntry(item, true));
        }

        return promises;
    };
}
const actions = {
    allocationRules: processData('allocationRules'),
    currencies: processData('currencies'),
    prizeData: processData('prizeData'),
    config: processData('config'),
};

/**
 * Replication Upload handler. It will be called from fileUploadListenerLambda on putObject event.
 * It gets the replication package from S3, read the entries in the zip file and starts populating the DB and S3
 * The prize images are not part of the package, they are coppied from CF (the url is taken from img_url prize parameter)
 * and saved to S3 directly.
 * @param {Object} event AWS event
 * @returns {Promise}
 */
const handleReplicationUpload = async (event) => {
    try {
        console.log('Received event:\n', JSON.stringify(event));

        const fileName = event.Records[0].s3.object.key;
        const fileExtension = extractFileExtension(fileName);

        if (fileExtension !== 'zip') {
            throw new Error('Wrong file format!');
        }

        const replicationZip = await getFileFromS3({
            readConfFileParams: {
                Bucket: event.Records[0].s3.bucket.name,
                Key: fileName,
                ResponseContentType: 'application/zip',
            },
            ErrorMessage: 'Error while reading file from bucket!',
        }, true);

        const zip = new AdmZip(replicationZip);
        const promises = [];

        zip.getEntries().forEach((zipEntry) => {
            const data = zipEntry.getData().toString();
            const file = zipEntry.name.slice(0, zipEntry.name.indexOf('.'));

            promises.push(...actions[file](JSON.parse(data)));
        });

        return await Promise.allSettled(promises).then((res) => {
            const rejectedRes = res.filter((val) => val.status === 'rejected');

            return rejectedRes.length ? sendSQSMessage(false, rejectedRes) : sendSQSMessage(true);
        }).catch((err) => sendSQSMessage(false, undefined, err.message));
    } catch (err) {
        return sendSQSMessage(false, undefined, err.message);
    }
};

module.exports = {
    handleReplicationUpload,
};
