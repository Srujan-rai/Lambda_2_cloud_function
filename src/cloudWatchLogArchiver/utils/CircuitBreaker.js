const Logger = require('../metrics/Logger');

/**
 * CircuitBreaker implements the Circuit Breaker pattern to handle failures in operations.
 * It helps prevent cascading failures by temporarily stopping operations after a threshold
 * of failures is reached, and allows the system to recover.
 */
class CircuitBreaker {
    /**
     * Creates a new CircuitBreaker instance
     * @param {number} timeout - The time in milliseconds to keep the circuit breaker open before attempting to reset (default: 60000ms)
     * @param {number} threshold - The number of failures that must occur before opening the circuit (default: 5)
     */
    constructor(timeout = 60000, threshold = 5) {
        this.isOpen = false;
        this.timeout = timeout;
        this.failures = 0;
        this.threshold = threshold;
        this.lastFailure = null;
    }

    /**
     * Executes a function with circuit breaker protection
     * @param {Function} fn - The async function to execute
     * @returns {Promise<any>} The result of the executed function
     * @throws {Error} When the circuit is open or when the executed function fails
     */
    async execute(fn) {
        if (this.isOpen) {
            const timeElapsed = Date.now() - this.lastFailure;
            Logger.info({ message: `[CircuitBreaker.execute] Circuit breaker is open. Time elapsed since last failure: ${timeElapsed}ms` });
            if (timeElapsed < this.timeout) {
                throw new Error('Circuit breaker is open');
            }
            Logger.info({ message: '[CircuitBreaker.execute] Circuit breaker timeout exceeded, resetting circuit' });
            this.reset();
        }

        try {
            const result = await fn();
            this.failures = 0;
            return result;
        } catch (error) {
            this.failures++;
            this.lastFailure = Date.now();
            Logger.error({ message: `[CircuitBreaker.execute] Operation failed. Failure count: ${this.failures}` });

            if (this.failures >= this.threshold) {
                this.isOpen = true;
                Logger.warn({ message: `[CircuitBreaker.execute] Circuit breaker opened after ${this.failures} failures` });
            }
            throw error;
        }
    }

    /**
     * Resets the circuit breaker to its initial state
     * Closes the circuit, resets the failure count, and clears the last failure timestamp
     */
    reset() {
        this.isOpen = false;
        this.failures = 0;
        this.lastFailure = null;
        Logger.info({ message: '[CircuitBreaker.reset] Circuit breaker reset' });
    }
}
module.exports = CircuitBreaker;
