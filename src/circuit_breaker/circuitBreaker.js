const { enableCircuitBreaker } = require('./circuitBreakerService');

module.exports.circuitBreaker = async (event) => {
    console.log('event', event);
    try {
        await enableCircuitBreaker(event.module);
    } catch (error) {
        console.log('error updating the circuit breaker for ', event.module);
        throw error;
    }
};
