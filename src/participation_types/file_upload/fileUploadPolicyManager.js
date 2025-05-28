// TODO consider exporting more functions (I.E. method that generates only plain policy)
const Moment = require('moment-timezone');
const signatureUtils = require('../../utility_functions/signatureUtils');
const ConfigurationUtils = require('../../self_service/configurationUtils');
const { getParametersFromSSM } = require('../../utility_functions/aws_sdk_utils/ssmUtilities');

/**
 * Merge all parts into one result.
 */
const createResult = (encodedPolicy, plainPolicy, signature, clientConditions, bucket) => ({
    policy: encodedPolicy,
    signature,
    urlToUpload: `https://${bucket}.s3.${process.env.regionName}.amazonaws.com`,
    plainPolicy,
    clientConditions,
});

/**
 * Client friendly representation of conditions to fulfill.
 * Idea is that client can simply add these parts to the multipart/form-data POST request
 */
const generateClientConditions = (s3Key, credential, dateLongFormat, encodedPolicy, signature, acl) => ({
    acl,
    'x-amz-meta-uuid': '14365123651274',
    'x-amz-meta-tag': '',
    'x-amz-server-side-encryption': 'AES256',
    'x-amz-credential': credential,
    'x-amz-algorithm': 'AWS4-HMAC-SHA256',
    'x-amz-date': dateLongFormat,
    'x-amz-signature': signature,
    policy: encodedPolicy,
    key: s3Key,
});

/**
 * Creates array of JSONs representing conditions parameter for POST request policy.
 */
const generateServerConditions = (s3Key, maxSize, credential, dateLongFormat, allowedMIMEtype, bucket, acl) => {
    const result = [
        { bucket },
        ['starts-with', '$key', s3Key],
        ['starts-with', '$Content-Type', allowedMIMEtype],
        ['starts-with', '$x-amz-meta-tag', ''],
        // Common with client conditions:
        { acl },
        { 'x-amz-meta-uuid': '14365123651274' },
        { 'x-amz-server-side-encryption': 'AES256' },
        { 'x-amz-credential': credential },
        { 'x-amz-algorithm': 'AWS4-HMAC-SHA256' },
        { 'x-amz-date': dateLongFormat },
    ];
    if (maxSize != null) {
        result.push(['content-length-range', 0, maxSize]);
    }
    return result;
};

/**
 * Creates policy with given conditions and sets expiration date on it.
 */
const generatePolicy = (policyConditions, policyDurationMinutes) => ({
    expiration: Moment().add(policyDurationMinutes, 'minutes').format('YYYY-MM-DDTHH:mm:ss\\Z'),
    conditions: policyConditions,
});

/**
 * Creates JSON that holds plain policy, encoded policy, policy signature, and user friendly representation of conditions.
 * Technique used - https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-HTTPPOSTConstructPolicy.html
 */
module.exports.generateS3Policy = async (key, configuration, flowLabel, allowedMIMEtype, bucket, acl) => {
    console.log('Policy generation started for configuration:', configuration.configurationId);
    console.log('Extracting max file size...');
    const maxFileSize = ConfigurationUtils.getMaxFileSizeForUpload(configuration, flowLabel);
    console.log('Max file size:', maxFileSize);
    console.log('Extracting policy duration...');
    const policyDuration = ConfigurationUtils.getUploadPolicyDuration(configuration, flowLabel);
    console.log('Policy duration:', policyDuration);
    // check params from config file, 0 is also not allowed
    if (!policyDuration) {
        throw new Error('Configuration missing policyDuration parameter!');
    }

    const { secretKeyId, secretKey } = await getParametersFromSSM('secretKeyId', 'secretKey');

    const moment = Moment();
    const signingKey = signatureUtils.generateSigningKey(moment, secretKey);

    const credential = `${secretKeyId}/${moment.format('YYYYMMDD')}/${process.env.regionName}/s3/aws4_request`;

    const dateLongFormat = moment.format('YYYYMMDD\\THHMMSS\\Z');
    const policyConditions = generateServerConditions(key, maxFileSize, credential, dateLongFormat, allowedMIMEtype, bucket, acl);
    const plainPolicy = generatePolicy(policyConditions, policyDuration);
    const encodedPolicy = Buffer.from(JSON.stringify(plainPolicy)).toString('base64');
    const signature = signatureUtils.sign(encodedPolicy, signingKey);
    const clientConditions = generateClientConditions(key, credential, dateLongFormat, encodedPolicy, signature, acl);

    const result = createResult(encodedPolicy, plainPolicy, signature, clientConditions, bucket);
    console.log('Successfully generated S3 policy.');

    return result;
};
