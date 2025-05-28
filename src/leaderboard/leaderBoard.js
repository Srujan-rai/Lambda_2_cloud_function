const { RESPONSE_OK } = require('../constants/responses');
const { createResponse } = require('../utility_functions/utilityFunctions');

const leaderBoardHandler = async () => createResponse(RESPONSE_OK, {});

module.exports = { leaderBoardHandler };
