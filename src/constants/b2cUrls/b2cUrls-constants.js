/**
 * Verifiers object containing issuer URLs and their corresponding audience.
 * @type {Object}
 */

const VERIFIERS = {
    // #region Global

    'https://globalalphab2c.b2clogin.com/85a255d1-055f-452f-98fd-f61dc5427040/v2.0/':
    {
        audience: ['693c9648-02c0-42ed-abf0-f00a5fd9d5b6', '280760c7-0cf5-4c5a-9577-f0c48c98325c'],
    },
    'https://globalalphab2c.b2clogin.com/tfp/85a255d1-055f-452f-98fd-f61dc5427040/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: ['693c9648-02c0-42ed-abf0-f00a5fd9d5b6', '280760c7-0cf5-4c5a-9577-f0c48c98325c'],
    },
    'https://globalbetab2c.b2clogin.com/e4be6fbe-9651-482b-be43-a96887ac634c/v2.0/':
    {
        audience: '17d00aea-7f9e-4e90-95f5-d3b79b9dd5b9',
    },
    'https://globalbetab2c.b2clogin.com/tfp/e4be6fbe-9651-482b-be43-a96887ac634c/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: '17d00aea-7f9e-4e90-95f5-d3b79b9dd5b9',
    },
    'https://globalgammab2c.b2clogin.com/tfp/c2de165b-d048-4efc-9ec1-9e2aece50955/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: ['4f233928-d35d-4c04-b088-131d4a5cb78e', '37dc5c7f-65ea-4d8a-bc38-181c39c1acfa'],
    },
    'https://globalgammab2c.b2clogin.com/c2de165b-d048-4efc-9ec1-9e2aece50955/v2.0/':
    {
        audience: ['4f233928-d35d-4c04-b088-131d4a5cb78e', '37dc5c7f-65ea-4d8a-bc38-181c39c1acfa'],
    },
    'https://alpha-login.global.coca-cola.com/85a255d1-055f-452f-98fd-f61dc5427040/v2.0/':
    {
        audience: '693c9648-02c0-42ed-abf0-f00a5fd9d5b6',
    },
    'https://alpha-login.global.coca-cola.com/tfp/85a255d1-055f-452f-98fd-f61dc5427040/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: '693c9648-02c0-42ed-abf0-f00a5fd9d5b6',
    },
    'https://beta-login.global.coca-cola.com/e4be6fbe-9651-482b-be43-a96887ac634c/v2.0/':
    {
        audience: '17d00aea-7f9e-4e90-95f5-d3b79b9dd5b9',
    },
    'https://beta-login.global.coca-cola.com/tfp/e4be6fbe-9651-482b-be43-a96887ac634c/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: '17d00aea-7f9e-4e90-95f5-d3b79b9dd5b9',
    },
    'https://gamma-login.global.coca-cola.com/c2de165b-d048-4efc-9ec1-9e2aece50955/v2.0/':
    {
        audience: ['4f233928-d35d-4c04-b088-131d4a5cb78e', '37dc5c7f-65ea-4d8a-bc38-181c39c1acfa'],
    },
    'https://gamma-login.global.coca-cola.com/tfp/c2de165b-d048-4efc-9ec1-9e2aece50955/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: ['4f233928-d35d-4c04-b088-131d4a5cb78e', '37dc5c7f-65ea-4d8a-bc38-181c39c1acfa'],
    },
    // #endregion
    // #region APAC

    'https://apacalpha.b2clogin.com/4c7ee0b5-a059-441d-ad31-a46ad2bc2e2b/v2.0/':
    {
        audience: '74f2386e-84b5-44ac-bb3e-b79e25938008',
    },
    'https://apacalpha.b2clogin.com/tfp/4c7ee0b5-a059-441d-ad31-a46ad2bc2e2b/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: '74f2386e-84b5-44ac-bb3e-b79e25938008',
    },
    'https://apacbeta.b2clogin.com/b98f7187-7ed6-46a5-8b48-0dc604e9b215/v2.0/':
    {
        audience: '9da852e3-bf9e-4f86-b9b6-824bf808afd6',
    },
    'https://apacbeta.b2clogin.com/tfp/b98f7187-7ed6-46a5-8b48-0dc604e9b215/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: '9da852e3-bf9e-4f86-b9b6-824bf808afd6',
    },
    'https://apacgamma.b2clogin.com/362898a3-c984-4234-97ea-a5eca53c12e8/v2.0/':
    {
        audience: '5db270d4-8eb8-47da-be32-1200e34051e8',
    },
    'https://apacgamma.b2clogin.com/tfp/362898a3-c984-4234-97ea-a5eca53c12e8/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: '5db270d4-8eb8-47da-be32-1200e34051e8',
    },
    'https://apacprod.b2clogin.com/9bc74ee7-48cb-4d52-aa77-9cf89b29cbf4/v2.0/':
    {
        audience: 'daaa1591-82e7-47a2-bced-aa5e9aa09ef8',
    },
    'https://apacprod.b2clogin.com/tfp/9bc74ee7-48cb-4d52-aa77-9cf89b29cbf4/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: 'daaa1591-82e7-47a2-bced-aa5e9aa09ef8',
    },
    'https://alpha-login.apac.coca-cola.com/4c7ee0b5-a059-441d-ad31-a46ad2bc2e2b/v2.0/':
    {
        audience: '74f2386e-84b5-44ac-bb3e-b79e25938008',
    },
    'https://alpha-login.apac.coca-cola.com/tfp/4c7ee0b5-a059-441d-ad31-a46ad2bc2e2b/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: '74f2386e-84b5-44ac-bb3e-b79e25938008',
    },
    'https://beta-login.apac.coca-cola.com/b98f7187-7ed6-46a5-8b48-0dc604e9b215/v2.0/':
    {
        audience: '9da852e3-bf9e-4f86-b9b6-824bf808afd6',
    },
    'https://beta-login.apac.coca-cola.com/tfp/b98f7187-7ed6-46a5-8b48-0dc604e9b215/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: '9da852e3-bf9e-4f86-b9b6-824bf808afd6',
    },
    'https://gamma-login.apac.coca-cola.com/362898a3-c984-4234-97ea-a5eca53c12e8/v2.0/':
    {
        audience: '5db270d4-8eb8-47da-be32-1200e34051e8',
    },
    'https://gamma-login.apac.coca-cola.com/tfp/362898a3-c984-4234-97ea-a5eca53c12e8/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: '5db270d4-8eb8-47da-be32-1200e34051e8',
    },
    'https://login.apac.coca-cola.com/9bc74ee7-48cb-4d52-aa77-9cf89b29cbf4/v2.0/':
    {
        audience: 'daaa1591-82e7-47a2-bced-aa5e9aa09ef8',
        isProdUrl: true,
    },
    'https://login.apac.coca-cola.com/tfp/9bc74ee7-48cb-4d52-aa77-9cf89b29cbf4/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: 'daaa1591-82e7-47a2-bced-aa5e9aa09ef8',
        isProdUrl: true,
    },
    // #endregion
    // #region EMEA

    'https://emeaalpha.b2clogin.com/648a6f79-5846-4426-8247-f58ff0671930/v2.0/':
    {
        audience: '43f89431-efe0-4658-a4a9-600a097875b9',
    },
    'https://emeaalpha.b2clogin.com/tfp/648a6f79-5846-4426-8247-f58ff0671930/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: '43f89431-efe0-4658-a4a9-600a097875b9',
    },
    'https://emeabeta.b2clogin.com/a2cb8b81-683a-428a-a2cf-ac7887a14c87/v2.0/':
    {
        audience: '2a5795f9-130e-49dd-8fe3-6db4ae0e4b70',
    },
    'https://emeabeta.b2clogin.com/tfp/a2cb8b81-683a-428a-a2cf-ac7887a14c87/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: '2a5795f9-130e-49dd-8fe3-6db4ae0e4b70',
    },
    'https://emeagamma.b2clogin.com/4107a1c4-0907-4e85-a087-16168284f0c0/v2.0/':
    {
        audience: '59fea29b-e2f1-474a-a228-776c81e80c5e',
    },
    'https://emeagamma.b2clogin.com/tfp/4107a1c4-0907-4e85-a087-16168284f0c0/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: '59fea29b-e2f1-474a-a228-776c81e80c5e',
    },
    'https://emeaprod.b2clogin.com/88467e8b-5137-4c7c-ae8c-77ee707f2f37/v2.0/':
    {
        audience: 'a8970fa9-78c6-487c-ae74-96baf7a221bb',
    },
    'https://emeaprod.b2clogin.com/tfp/88467e8b-5137-4c7c-ae8c-77ee707f2f37/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: 'a8970fa9-78c6-487c-ae74-96baf7a221bb',
    },
    'https://alpha-login.emea.coca-cola.com/648a6f79-5846-4426-8247-f58ff0671930/v2.0/':
    {
        audience: '43f89431-efe0-4658-a4a9-600a097875b9',
    },
    'https://alpha-login.emea.coca-cola.com/tfp/648a6f79-5846-4426-8247-f58ff0671930/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: '43f89431-efe0-4658-a4a9-600a097875b9',
    },
    'https://beta-login.emea.coca-cola.com/a2cb8b81-683a-428a-a2cf-ac7887a14c87/v2.0/':
    {
        audience: '2a5795f9-130e-49dd-8fe3-6db4ae0e4b70',
    },
    'https://beta-login.emea.coca-cola.com/tfp/a2cb8b81-683a-428a-a2cf-ac7887a14c87/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: '2a5795f9-130e-49dd-8fe3-6db4ae0e4b70',
    },
    'https://gamma-login.emea.coca-cola.com/4107a1c4-0907-4e85-a087-16168284f0c0/v2.0/':
    {
        audience: '59fea29b-e2f1-474a-a228-776c81e80c5e',
    },
    'https://gamma-login.emea.coca-cola.com/tfp/4107a1c4-0907-4e85-a087-16168284f0c0/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: '59fea29b-e2f1-474a-a228-776c81e80c5e',
    },
    'https://login.emea.coca-cola.com/88467e8b-5137-4c7c-ae8c-77ee707f2f37/v2.0/':
    {
        audience: 'a8970fa9-78c6-487c-ae74-96baf7a221bb',
        isProdUrl: true,
    },
    'https://login.emea.coca-cola.com/tfp/88467e8b-5137-4c7c-ae8c-77ee707f2f37/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: 'a8970fa9-78c6-487c-ae74-96baf7a221bb',
        isProdUrl: true,
    },
    // #endregion
    // #region LATMAM

    'https://latamalpha.b2clogin.com/6e3b8a87-97c4-4441-a6b0-d6f536fea3f4/v2.0/':
    {
        audience: null,
    },
    'https://latamalpha.b2clogin.com/tfp/6e3b8a87-97c4-4441-a6b0-d6f536fea3f4/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: null,
    },
    'https://latambeta.b2clogin.com/8a7698f0-bbc7-4d89-a0ea-a396814b050d/v2.0/':
    {
        audience: null,
    },
    'https://latambeta.b2clogin.com/tfp/8a7698f0-bbc7-4d89-a0ea-a396814b050d/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: null,
    },
    'https://latamgamma.b2clogin.com/2f09d0bb-c222-4396-bc8f-ff45a268d36b/v2.0/':
    {
        audience: null,
    },
    'https://latamgamma.b2clogin.com/tfp/2f09d0bb-c222-4396-bc8f-ff45a268d36b/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: null,
    },
    'https://latamprod.b2clogin.com/c206a032-1abd-4f16-abec-5634d45d70eb/v2.0/':
    {
        audience: null,
    },
    'https://latamprod.b2clogin.com/tfp/c206a032-1abd-4f16-abec-5634d45d70eb/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: null,
    },
    'https://alpha-login.latam.coca-cola.com/6e3b8a87-97c4-4441-a6b0-d6f536fea3f4/v2.0/':
    {
        audience: null,
    },
    'https://alpha-login.latam.coca-cola.com/tfp/6e3b8a87-97c4-4441-a6b0-d6f536fea3f4/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: null,
    },
    'https://beta-login.latam.coca-cola.com/8a7698f0-bbc7-4d89-a0ea-a396814b050d/v2.0/':
    {
        audience: null,
    },
    'https://beta-login.latam.coca-cola.com/tfp/8a7698f0-bbc7-4d89-a0ea-a396814b050d/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: null,
    },
    'https://gamma-login.latam.coca-cola.com/2f09d0bb-c222-4396-bc8f-ff45a268d36b/v2.0/':
    {
        audience: null,
    },
    'https://gamma-login.latam.coca-cola.com/tfp/2f09d0bb-c222-4396-bc8f-ff45a268d36b/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: null,
    },
    'https://login.latam.coca-cola.com/c206a032-1abd-4f16-abec-5634d45d70eb/v2.0/':
    {
        audience: null,
        isProdUrl: true,
    },
    'https://login.latam.coca-cola.com/tfp/c206a032-1abd-4f16-abec-5634d45d70eb/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: null,
        isProdUrl: true,
    },
    // #endregion
    // #region NA

    'https://ccnaalpha.b2clogin.com/5e772f74-fdea-4ee9-9d70-458c6f6f1f14/v2.0/':
    {
        audience: 'f9e316e0-91e3-45ea-8cf2-0621729c8c6a',
    },
    'https://ccnaalpha.b2clogin.com/tfp/5e772f74-fdea-4ee9-9d70-458c6f6f1f14/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: 'f9e316e0-91e3-45ea-8cf2-0621729c8c6a',
    },
    'https://ccnabeta.b2clogin.com/762dc676-de7f-403d-ab15-6c2570572d6a/v2.0/':
    {
        audience: 'a97933a9-bda8-43ac-8933-0d6afcfa700e',
    },
    'https://ccnabeta.b2clogin.com/tfp/762dc676-de7f-403d-ab15-6c2570572d6a/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: 'a97933a9-bda8-43ac-8933-0d6afcfa700e',
    },
    'https://ccnagamma.b2clogin.com/eea175f2-9b38-4a8e-93d5-d28873d0592a/v2.0/':
    {
        audience: '2eaf1642-a5b1-4228-a78f-95dab7f5550e',
    },
    'https://ccnagamma.b2clogin.com/tfp/eea175f2-9b38-4a8e-93d5-d28873d0592a/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: '2eaf1642-a5b1-4228-a78f-95dab7f5550e',
    },
    'https://ccnaprod.b2clogin.com/a62739e6-ccaa-4a4a-831c-416177dae1ea/v2.0/':
    {
        audience: 'ba129a38-fb74-43ca-8730-d255b4eae00e',
    },
    'https://ccnaprod.b2clogin.com/tfp/a62739e6-ccaa-4a4a-831c-416177dae1ea/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: 'ba129a38-fb74-43ca-8730-d255b4eae00e',
    },
    'https://test-login.naou.coca-cola.com/762dc676-de7f-403d-ab15-6c2570572d6a/v2.0/':
    {
        audience: 'a97933a9-bda8-43ac-8933-0d6afcfa700e',
        shouldTransformStageName: true,
    },
    'https://test-login.naou.coca-cola.com/tfp/762dc676-de7f-403d-ab15-6c2570572d6a/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: 'a97933a9-bda8-43ac-8933-0d6afcfa700e',
        shouldTransformStageName: true,
    },
    'https://uat-login.naou.coca-cola.com/eea175f2-9b38-4a8e-93d5-d28873d0592a/v2.0/':
    {
        audience: '2eaf1642-a5b1-4228-a78f-95dab7f5550e',
        shouldTransformStageName: true,
    },
    'https://uat-login.naou.coca-cola.com/tfp/eea175f2-9b38-4a8e-93d5-d28873d0592a/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: '2eaf1642-a5b1-4228-a78f-95dab7f5550e',
        shouldTransformStageName: true,
    },
    'https://login.naou.coca-cola.com/a62739e6-ccaa-4a4a-831c-416177dae1ea/v2.0/':
    {
        audience: 'ba129a38-fb74-43ca-8730-d255b4eae00e',
        isProdUrl: true,
    },
    'https://login.naou.coca-cola.com/tfp/a62739e6-ccaa-4a4a-831c-416177dae1ea/b2c_1a_signup_signin_gam/v2.0/':
    {
        audience: 'ba129a38-fb74-43ca-8730-d255b4eae00e',
        isProdUrl: true,
    },
    // #endregion
};

/**
 * STAGES: An array of stage names taken from know verifier URLS
 */
const STAGES = ['alpha', 'beta', 'gamma', 'prod', 'uat', 'test'];

/**
 * STAGE_REGEX: A regular expression that matches any of the stage names.
 * @type {RegExp}
 * @returns {RegExp}
 * @example
 * // Returns true
 * STAGE_REGEX.test('alpha');
 */
const STAGE_REGEX = new RegExp(STAGES.join('|'));

/**
 * COCA_COLA_LOGIN_REGEX: This regular expression matches URLs that follow the pattern https://<something>-login.<something>.coca-cola.com.
 * @type {RegExp}
 * @returns {RegExp}
 * @example
 * // Returns true
 * COCA_COLA_LOGIN_REGEX.test('https://alpha-login.global.coca-cola.com');
 */
const COCA_COLA_LOGIN_REGEX = /https:\/\/(.*?)-login\.(.*?)\.coca-cola\.com/;

/**
 * B2C_LOGIN_REGEX: This regular expression matches URLs that follow the pattern https://<something>.b2clogin.com.
 * @type {RegExp}
 * @returns {RegExp}
 * @example
 * // Returns true
 * B2C_LOGIN_REGEX.test('https://alpha.b2clogin.com');
 */
const B2C_LOGIN_REGEX = /https:\/\/(.*?)\.b2clogin\.com/;

/**
 * LOGIN_COCA_COLA_REGEX: This regular expression matches URLs that follow the pattern https://login.<something>.coca-cola.com.
 * @type {RegExp}
 * @returns {RegExp}
 * @example
 * // Returns true
 * LOGIN_COCA_COLA_REGEX.test('https://login.alpha.coca-cola.com');
 */
const LOGIN_COCA_COLA_REGEX = /https:\/\/login\.(.*?)\.coca-cola\.com/;

/**
 * Regular expression for COKE_LEGACY_LOGIN.
 * Matches the legacy login URL for COKE consumers.
 * @type {RegExp}
 * @returns {RegExp}
 * @example
 * // Returns true
 * COKE_LEGACY_LOGIN_REGEX.test('https://cid.alpha.gcds.coke.com/v2/consumers');
 */
const COKE_LEGACY_CID_LOGIN_REGEX = /https:\/\/cid\.(.*?)\.(.*?)\.gcds\.coke\.com/;

/**
 * Regular expression for COKE_LEGACY_LOGIN.
 * Matches the legacy login URL for COKE consumers.
 * @type {RegExp}
 * @returns {RegExp}
 * @example
 * // Returns true
 * COKE_LEGACY_LOGIN_REGEX.test('https://alpha.gcds.coke.com/v2/consumers');
 */
const COKE_LEGACY_LOGIN_REGEX = /https:\/\/(.*?)\.(.*?)\.gcds\.coke\.com/;

/**
 * Regular expression for COKE_LEGACY_CID_PROD_LOGIN_REGEX.
 * Matches the legacy login URL for COKE consumers.
 * @type {RegExp}
 * @returns {RegExp}
 * @example
 * // Returns true
 * COKE_LEGACY_CID_PROD_LOGIN_REGEX.test('https://cid.prod.gcds.coke.com');
 */
const COKE_LEGACY_CID_PROD_LOGIN_REGEX = /https:\/\/cid\.([a-zA-Z0-9_-]*)\.gcds\.coke\.com/;

/**
 * Regular expression for COKE_LEGACY_PROD_LOGIN_REGEX.
 * Matches the legacy login URL for COKE consumers.
 * @type {RegExp}
 * @returns {RegExp}
 * @example
 * // Returns true
 * COKE_LEGACY_PROD_LOGIN_REGEX.test('https://prod.gcds.coke.com');
 * */
const COKE_LEGACY_PROD_LOGIN_REGEX = /https:\/\/([a-zA-Z0-9_-]*)\.gcds\.coke\.com/;

/**
 * StringToBeReplaced: The string to be replaced in the base URL.
 * @type {string}
 */
const StringToBeReplaced = 'TEMP_URL_PARAMS';

/**
 * BASE_URL: The base URL for the B2C URLs.
 * @type {string}
 */
const BASE_URL = `https://frontend.${StringToBeReplaced}.gcds.coke.com/v2/consumers`;

/**
 * PROD_STAGE_NAME: The production stage name.
 * @type {string}
 */
const PROD_STAGE_NAME = 'prod';

/**
 * Checks the custom JWT for validity.
 * @param {Object} props - The properties object.
 * @throws {Error} Throws an error if the algorithm is incorrect.
 */
const CustomJwtCheck = (props) => {
    if (props.header.alg !== 'RS256') {
        throw new Error('Incorrect algorithm');
    }
};

const StageNameTransformer = (stage) => {
    const transformationMapping = {
        uat: 'gamma',
        test: 'beta',
        cid: 'prod',
    };

    return transformationMapping[stage] || undefined;
};

const legacyParamsExtractorByStageName = (match) => {
    const [, stage, region] = match;

    const isValidStageName = STAGE_REGEX.test(stage);
    if (!isValidStageName) {
        return {
            stage: StageNameTransformer(stage),
            region,
        };
    }

    return { stage, region };
};

const legacyProdParamsExtractor = (match) => ({
    stage: PROD_STAGE_NAME,
    region: match[1],
});

module.exports = {
    VERIFIERS,
    BASE_URL,
    PROD_STAGE_NAME,
    Matchers: {
        COCA_COLA_LOGIN: {
            regex: COCA_COLA_LOGIN_REGEX,
            regionExtractor: (match) => match[2],
        },
        B2C_LOGIN: {
            regex: B2C_LOGIN_REGEX,
            regionExtractor: (match, stage) => match[1].split(stage)[0],
        },
        LOGIN_COCA_COLA: {
            regex: LOGIN_COCA_COLA_REGEX,
            regionExtractor: (match) => match[1],
        },
        COKE_LEGACY_CID_LOGIN: {
            regex: COKE_LEGACY_CID_LOGIN_REGEX,
            customExtractor: legacyParamsExtractorByStageName,
        },
        COKE_LEGACY_CID_PROD_LOGIN: {
            regex: COKE_LEGACY_CID_PROD_LOGIN_REGEX,
            customExtractor: legacyProdParamsExtractor,
        },
        COKE_LEGACY_PROD_LOGIN: {
            regex: COKE_LEGACY_PROD_LOGIN_REGEX,
            customExtractor: legacyProdParamsExtractor,
        },
        COKE_LEGACY_LOGIN: {
            regex: COKE_LEGACY_LOGIN_REGEX,
            customExtractor: legacyParamsExtractorByStageName,
        },
    },
    RegexPatterns: {
        STAGE_REGEX,
        COCA_COLA_LOGIN_REGEX,
        B2C_LOGIN_REGEX,
        LOGIN_COCA_COLA_REGEX,
        COKE_LEGACY_CID_LOGIN_REGEX,
        COKE_LEGACY_LOGIN_REGEX,
    },
    CustomJwtCheck,
    StringToBeReplaced,
    StageNameTransformer,
};
