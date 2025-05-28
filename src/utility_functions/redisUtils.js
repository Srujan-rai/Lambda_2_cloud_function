const Redis = require('ioredis');

const setupRedisClient = (primaryEndpoint) => {
    try {
        return new Redis({
            port: primaryEndpoint.Port,
            host: primaryEndpoint.Address,
            username: 'default',
        });
    } catch (error) {
        console.error('Setting up Redis Client failed with', error);
    }
};

module.exports = {
    setupRedisClient,
};
