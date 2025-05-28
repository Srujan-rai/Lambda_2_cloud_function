const { rsEventProcessor } = require('./processors');

const config = {
    eventMap: {
        RS: rsEventProcessor,
    },
};

module.exports = { config };
