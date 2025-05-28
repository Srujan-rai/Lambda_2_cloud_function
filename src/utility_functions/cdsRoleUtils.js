// const { CDS_ROLE_MAPPING } = require('@the-coca-cola-company/ngps-global-common-utils');

const emea = {
    beta: '667311885519',
    gamma: '813498473693',
    prod: '815624497135',
    'production-it': '815624497135',
    production: '815624497135',
};

const global = {
    alpha: '659441176226',
    beta: '643379729709',
    gamma: '843036663906',
    prod: '662738669227',
    'production-it': '662738669227',
    production: '662738669227',
};

const latam = {
    alpha: '182514489678',
    beta: '739290165488',
    gamma: '651428460623',
    prod: '555481124101',
    'production-it': '555481124101',
    production: '555481124101',
};

const apac = {
    alpha: '561796161542',
    beta: '167647113642',
    gamma: '408663089588',
    prod: '291082369246',
    'production-it': '291082369246',
    production: '291082369246',
};

const naou = {
    alpha: '943397210269',
    beta: '196331975080',
    gamma: '352715399040',
    prod: '698898049352',
    'production-it': '698898049352',
    production: '698898049352',
};

const CDS_ACCOUNT_ID_MAP = {
    emea,
    global,
    latam,
    apac,
    naou,
};

const CDS_AWS_REGION_MAP = {
    emea: 'eu-west-1',
    global: 'us-east-1',
    latam: 'us-west-2',
    apac: 'ap-southeast-1',
    naou: 'us-east-1',
};

const getCdsQueueName = (stage, region) => {
    const queueName = `${stage}-primary-${region}-cds-message-services-event-queue`;
    return `https://sqs.${CDS_AWS_REGION_MAP[region]}.amazonaws.com/${CDS_ACCOUNT_ID_MAP[region][stage]}/${queueName}`;
};

const getCdsRoleName = (stage, region) => `${stage}-primary-${region}-cds-message-services-ngps-event-role`;

module.exports = {
    getCdsQueueName,
    getCdsRoleName,
    CDS_ACCOUNT_ID_MAP,
    CDS_AWS_REGION_MAP,
};
