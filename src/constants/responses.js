const COMMON_HEADERS = {
    'Access-Control-Allow-Origin': '*', // Required for CORS support to work
    'Access-Control-Allow-Credentials': true,
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
};

module.exports = {
    RESPONSE_OK: {
        statusCode: 200,
        headers: COMMON_HEADERS,
    },
    RESPONSE_BAD_REQUEST: {
        statusCode: 400,
        headers: COMMON_HEADERS,
    },
    RESPONSE_UNAUTHORIZED: {
        statusCode: 401,
        headers: COMMON_HEADERS,
    },
    RESPONSE_FORBIDDEN: {
        statusCode: 403,
        headers: COMMON_HEADERS,
    },
    RESPONSE_NOT_FOUND: {
        statusCode: 404,
        headers: COMMON_HEADERS,
    },
    RESPONSE_PRECONDITION_FAILED: {
        statusCode: 412,
        headers: COMMON_HEADERS,
    },
    RESPONSE_INTERNAL_ERROR: {
        statusCode: 500,
        headers: COMMON_HEADERS,
    },
};
