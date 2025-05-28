const STAGE_INSTANCES = {
    prod: 'prod',
    production: 'production',
    productionIT: 'production-it',
};

const PROD_STAGE_NAMES = [
    STAGE_INSTANCES.prod,
    STAGE_INSTANCES.production,
    STAGE_INSTANCES.productionIT,
];

module.exports = {
    PROD_STAGE_NAMES,
};
