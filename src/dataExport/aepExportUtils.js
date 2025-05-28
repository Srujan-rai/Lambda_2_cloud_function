const schemaMapper = require('@the-coca-cola-company/mbs-schema-mapper');
const cloneDeep = require('lodash.clonedeep');
const axios = require('axios');
const moment = require('moment-timezone');
const { mainQuery: prizeMainQuery } = require('../database/prizeCatalogueTable');
const { copyAsCamelCase, getSatisfiedUserType } = require('../utility_functions/utilityFunctions');
const { sendSQSMessage } = require('../utility_functions/aws_sdk_utils/sqsUtilities');
const { getParametersFromSSM } = require('../utility_functions/aws_sdk_utils/ssmUtilities');

const TRANS_WHITELIST_ATTRS = ['transactionDate', 'amount', 'configurationId', 'currencyId', 'currencyName',
    'promoName', 'transactionType', 'walletRollingTotal', 'prize'];
const COST_WHITELIST_ATTRS = ['amount', 'currencyId', 'name'];
const PRIZE_WHITELIST_ATTRS = ['prizeId', 'active', 'barcodeType', 'configurationId', 'cost', 'deliveryType', 'desc',
    'entryDate', 'languageForListing', 'name', 'priority', 'redeemDesc', 'redemptionLimit', 'redemptionLink', 'shortDesc',
    'tier', 'totalAmount', 'totalAvailable', 'totalClaimed', 'totalExpired', 'startDate', 'endDate', 'tags', 'expiryDate'];
const PINCODE_WHITELIST_ATTRS = ['lotId', 'programId'];
const PARTICIPATION_WHITELIST_ATTRS = ['participationId', 'person', 'configurationId', 'transactions', 'mailSent', 'instantWinWinner',
    'optionalInformation', 'participationDate', 'redeemedPrize', 'successfulBurns'];

const ssmAttrs = {
    MEMBERS_API_ENDPOINT: process.env.SSM_PARAM_MEMBERS_API_ENDPOINT,
    MEMBERS_API_USER: process.env.SSM_PARAM_MEMBERS_API_USER,
    MEMBERS_API_PASS: process.env.SSM_PARAM_MEMBERS_API_PASS,
    CDS_HASH_ENDPOINT: process.env.SSM_PARAM_CDS_HASH_ENDPOINT,
    CDS_HASH_X_API_KEY: process.env.SSM_PARAM_CDS_HASH_X_API_KEY,
    AEP_QUEUE_URL: process.env.SSM_PARAM_AEP_QUEUE_URL,
};

// Cache for 15 mins.. to prevent SSM throttling errors
let lastFetchTime = moment('1900-01-01');
const CACHE_TTL = 15;
let cachedConfigProps = [];

const getConfigProps = async () => {
    const now = moment();

    if (now.isAfter(lastFetchTime.add(CACHE_TTL, 'minutes'))) {
        const attributes = [];
        Object.values(ssmAttrs).forEach((val) => {
            attributes.push(val);
        });
        cachedConfigProps = await getParametersFromSSM(...attributes);
        lastFetchTime = now;
    }

    return cachedConfigProps;
};

/**
 *  Utility invoking Members API with required parameters and authorization
 * @param searchParameterType
 * @param searchParameterValue
 * @returns {Promise<*>}
 */
const getMemberFromMembersApi = async (searchParameterType, searchParameterValue) => {
    const configProps = await getConfigProps();
    try {
        if (!configProps[ssmAttrs.MEMBERS_API_ENDPOINT]
            || !configProps[ssmAttrs.MEMBERS_API_USER]
            || !configProps[ssmAttrs.MEMBERS_API_PASS]) {
            throw new Error('Members API Endpoint Configuration is Missing');
        }
        const url = `${configProps[ssmAttrs.MEMBERS_API_ENDPOINT]}`;
        const members = await axios.get(url, {
            auth: {
                username: configProps[ssmAttrs.MEMBERS_API_USER],
                password: configProps[ssmAttrs.MEMBERS_API_PASS],
            },
            params: {
                searchParameterName: searchParameterType,
                searchParameterValue,
                socialSearch: 'N',
            },
        });

        // This error is a 200 response
        if (members.errorCode) {
            console.error('ERROR: Cannot find Member', JSON.stringify(members));
            throw new Error('Cannot find User in Members API');
        }

        if (!Object.prototype.hasOwnProperty.call(members, 'data')) {
            console.error('ERROR: Cannot parse data from MemberAPI response');
            throw new Error('Cannot parse data from MemberAPI response');
        }

        if (!members.data?.length) {
            console.error('ERROR: Empty result returned from MemberAPI');
            throw new Error('Empty result returned from MemberAPI');
        }

        console.debug('Members API returned ', JSON.stringify(members.data[0]));
        return members.data[0];
    } catch (error) {
        console.error(`ERROR: Unknown Error trying to get Member from Members API', ${error.response?.data || error}`);
        throw error;
    }
};

/**
 *  FUnction to get Member bases on the userIdType
 * @param userIdType
 * @param userId
 * @returns {Promise<*>}
 */
const getMember = async (userIdType, userId) => {
    if (userIdType === 'email') {
        const member = await getMemberFromMembersApi('email', userId);
        return member;
    }
    if (userIdType === 'cid') {
        const member = await getMemberFromMembersApi('janrainUUID', userId);
        return member;
    }
    throw new Error('Not supported userType');
};

/**
 *  Utility to invoke Hashing Service with required params and authorization
 * @param hashType
 * @param value
 * @returns {Promise<*>}
 */
const getHash = async (hashType, value) => {
    const configProps = await getConfigProps();
    if (!configProps[ssmAttrs.CDS_HASH_ENDPOINT] || !configProps[ssmAttrs.CDS_HASH_X_API_KEY]) {
        throw new Error('CDS Hash API Endpoint Configuration is Missing');
    }
    try {
        const url = `${configProps[ssmAttrs.CDS_HASH_ENDPOINT]}/hash/${hashType}`;
        const body = { value };
        const options = {
            headers: {
                'x-api-key': configProps[ssmAttrs.CDS_HASH_X_API_KEY],
            },
        };
        const result = await axios.post(url, body, options);
        console.debug('hash Result', JSON.stringify(result.data));
        return result.data.hashId;
    } catch (error) {
        console.error(`ERROR: Unknown Error trying to get Member from CDS Hash API', ${error.response?.data || error}`);
        throw error;
    }
};

/**
 *  Gets the legal country from the address information. The order of precedence is Home|Mailing|Shipping
 * @param addresses
 * @returns {null|*}
 */

const getLegalCountry = (addresses) => {
    // Order of Precedence for Legal Country
    if (addresses && addresses.length > 1) {
        const precOrder = ['Home', 'Mailing', 'Shipping'];
        addresses.sort((a, b) => precOrder.indexOf(a.addressType) - precOrder.indexOf(b.addressType));
    }
    if (addresses && addresses.length > 0) {
        return addresses[0].country;
    }
    return null;
};

/**
 *  Gets the Person Information from the gpp_user_id. Invokes Mmeber API to get attributes for kocid and
 *  also invokes the hashing service to get hashedIds
 * @param participationData
 * @returns {Promise<{legalCountry: null, kocid: *, hashedKocid: undefined, account: {legalCountry: null, uuid, hashedUuid: undefined}}>}
 */

const getPerson = async (participationData) => {
    if (!participationData.gpp_user_id) {
        throw new Error('UserId is required');
    }
    const groups = participationData.gpp_user_id.split(/\|/);
    const userId = groups[0];
    if (userId.trim().length === 0) {
        throw new Error(`Cannot retrieve person information from  ${participationData.gpp_user_id}`);
    }
    const userIdType = getSatisfiedUserType(userId);
    // Right now i only know of email, we may have to change this to get other records
    const member = await getMember(userIdType, userId);
    if (!member) {
        throw new Error(`Member was not found for ${userId}`);
    }
    const { uuid } = member;
    let kocid;
    if (member.memberIdentifiers) {
        const identifiers = member.memberIdentifiers.filter((item) => item.name === 'externalId');
        if (identifiers && identifiers.length > 0) {
            kocid = identifiers[0].value;
        }
    }
    if (!kocid) {
        throw new Error('kocid is required');
    }
    const legalCountry = member.country ? member.country : getLegalCountry(member.addresses);
    const hashedKocid = await getHash('kocid', kocid);

    let hashedUuid;
    let account;
    if (member.uuid) {
        hashedUuid = await getHash('uuid', member.uuid);
        account = { uuid, hashedUuid, legalCountry };
    }
    return {
        hashedKocid, kocid, legalCountry, account,
    };
};

/**
 * Utility method to remove non whitelisted attributes
 * @param obj
 * @param whitelistAttrs
 */

const removeUnneededAttributes = (obj, whitelistAttrs) => {
    Object.keys(obj).forEach((e) => {
        if (!whitelistAttrs.find((i) => i === e)) {
            delete obj[e];
        }
    });
};

/**
 * Utility function to handle various values of name and Description
 * @param val
 * @returns {Array|null}
 */

const formatDesc = (val) => {
    if (val) {
        if (typeof val !== 'object') {
            return [{ key: 'default', value: val }];
        } if (Array.isArray(val)) {
            return val.map((item) => formatDesc(item)).flat(1);
        }
        return [{
            key: Object.keys(val)[0],
            value: val[Object.keys(val)[0]],
        }];
    }
    return null;
};

/**
 *  Format timestamp to date string
 * @param prize
 */

const formatTimestampToDateString = (timestamp) => `${new Date(timestamp).toISOString().split('.')[0]}+00:00`;

/**
 *  Format Prize data as required by AEP
 * @param prize
 */

const formatPrizeData = (prize) => {
    if (prize) {
        removeUnneededAttributes(prize, PRIZE_WHITELIST_ATTRS);
        if (prize.cost) {
            prize.cost.forEach((item) => {
                removeUnneededAttributes(item, COST_WHITELIST_ATTRS);
            });
        }
        if (prize.entryDate && prize.entryDate.length === 10) {
            prize.entryDate = `${prize.entryDate}T00:00:00+00:00`;
        }
        if (prize.expiryDate) {
            prize.expiryDate = formatTimestampToDateString(prize.expiryDate);
        }
        if (prize.startDate) {
            prize.startDate = formatTimestampToDateString(prize.startDate);
        }
        if (prize.endDate) {
            prize.endDate = formatTimestampToDateString(prize.endDate);
        }
        if (Object.hasOwn(prize, 'tier') && prize.tier === '') {
            delete prize.tier;
        }
        ['desc', 'name', 'redeemDesc', 'shortDesc'].forEach((e) => {
            const formattedField = formatDesc(prize[e]);
            if (!formattedField) {
                delete prize[e];
            } else {
                prize[e] = formattedField;
            }
        });
    }
};

/**
 *  Utility function to format data to as required by the schema mapper
 * @param participationData
 * @returns {*}
 */

const formatData = (participationData) => {
    const participationOutput = copyAsCamelCase(participationData);
    participationOutput.transactions = participationOutput.insertedTransactions && participationOutput.insertedTransactions.map((item) => {
        removeUnneededAttributes(item, TRANS_WHITELIST_ATTRS);
        formatPrizeData(item.prize);
        return item;
    });
    formatPrizeData(participationOutput.redeemedPrize);
    removeUnneededAttributes(participationOutput, PARTICIPATION_WHITELIST_ATTRS);
    if (participationOutput.successfulBurns) {
        participationOutput.successfulBurns.forEach((item) => {
            removeUnneededAttributes(item, PINCODE_WHITELIST_ATTRS);
        });
    }

    if (participationOutput.optionalInformation) {
        participationOutput.optionalInformation = JSON.stringify(participationOutput.optionalInformation);
    }

    return participationOutput;
};

/**
 *  Takes the participation data and augments with additional data
 * @param participationData
 * @returns {Promise<*>}
 */
const prepData = async (participationData) => {
    if (!participationData.participation_id) {
        throw new Error('Participation Id is required');
    }
    participationData.person = await getPerson(participationData);
    if (participationData.inserted_transactions) {
        await Promise.all(participationData.inserted_transactions.map(async (item) => {
            if (item.prize_id) {
                const prizes = await prizeMainQuery(item.configuration_id, item.prize_id, null);

                if (prizes && prizes.length > 0) {
                    item.prize = prizes[0];
                }
            }
        }));
    }
    if (participationData.participation_time) {
        participationData.participationDate = moment.unix(participationData.participation_time / 1000).utc().format();
    }

    return formatData(participationData);
};

/**
 * Main Utility function that takes raw participationData and converts to XDM format to be streamed to AEP through SQS Queue
 * It uses mbs-schema-mapper for conversion
 *
 * @param participationData
 * @returns {Promise<void>}
 */
const exportParticipationToAEP = async (participationData) => {
    try {
        const dataToExportCanonical = await prepData(cloneDeep(participationData));
        console.debug('dataToExportCanonical', JSON.stringify(dataToExportCanonical));
        const dataToExportXDM = schemaMapper.validateAndConvert('promo-engine', dataToExportCanonical, null, true);
        if (dataToExportXDM instanceof Error) {
            console.error('schemaMapperError', dataToExportXDM);
            throw dataToExportXDM;
        }
        const configProps = await getConfigProps();
        const queueUrl = configProps[ssmAttrs.AEP_QUEUE_URL];
        if (!queueUrl) {
            throw new Error('AEP Export Queue Not Set');
        }
        await sendSQSMessage({
            MessageBody: JSON.stringify(dataToExportCanonical),
            QueueUrl: queueUrl,
        });
    } catch (error) {
        console.error('ERROR: Cannot export Data to AEP ', error);
        throw error;
    }
};

module.exports.exportParticipationToAEP = exportParticipationToAEP;
