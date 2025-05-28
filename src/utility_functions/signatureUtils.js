const crypto = require('crypto-js');

/**
 * Creates signing key used for (I.E. policy) signing
 * @param {moment} moment Date object
 * @param {key} key AWS secret key
 * @returns {String} HMAC
 */
const generateSigningKey = (moment, key) => {
    const date = moment.format('YYYYMMDD');
    const dateKey = crypto.HmacSHA256(date, `AWS4${key}`);
    const { regionName } = process.env;
    const dateRegionKey = crypto.HmacSHA256(regionName, dateKey);
    const dateRegionServiceKey = crypto.HmacSHA256('s3', dateRegionKey);
    return crypto.HmacSHA256('aws4_request', dateRegionServiceKey);
};

/**
 * Creates a signature using string to sign, and signing key.
 */
const sign = (stringToSign, signingKey) => {
    console.log('Calculating signature for', stringToSign);
    const sig = crypto.HmacSHA256(stringToSign, signingKey);
    return crypto.enc.Hex.stringify(sig);
};

module.exports = {
    generateSigningKey,
    sign,
};
