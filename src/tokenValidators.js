const axios = require('axios');

const legacyEndPoint = process.env.cdsValidateJWTTokenEndpoint;
const naPartnerEndpoint = process.env.naPartnerEndPoint;

const validateLegacyToken = async (token, claims) => {
    const { deviceId, iss } = claims;

    // we have 2 endpoints as issuers, but both use emeaLegacyTokenIssuer for validation
    const url = iss.replace('cid.', '') + legacyEndPoint;
    const result = await axios.post(url, { token, deviceId });

    return !result.data.status;
};

const validatePartnerToken = async (token, customClaims) => {
    const result = await axios.get(naPartnerEndpoint, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });

    customClaims.uuid = result.data.memberId;
    customClaims.emailAddress = result.data.email;

    return !result.data.status;
};

module.exports = {
    [process.env.emeaTokenIssuer]: { verify: validateLegacyToken },
    [process.env.naPartnerScopeIssuer]: { verify: validatePartnerToken },
};
