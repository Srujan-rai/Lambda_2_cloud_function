const Logger = require('../metrics/Logger');

/**
 * A class that manages a queue of asynchronous requests with concurrency control.
 */
class RequestQueue {
    /**
     * Creates a new RequestQueue instance.
     * @param {number} concurrency - Maximum number of concurrent requests allowed (default: 2)
     */
    constructor(concurrency = 2) {
        /** @type {Array<Function>} Array to store queued request resolvers */
        this.queue = [];
        /** @type {number} Number of currently running requests */
        this.running = 0;
        /** @type {number} Maximum number of concurrent requests allowed */
        this.concurrency = concurrency;
        Logger.info({ message: `[RequestQueue.constructor] Created new request queue with concurrency: ${concurrency}` });
    }

    /**
     * Adds a new request to the queue and executes it when possible.
     * @param {Function} fn - Async function to be executed
     * @returns {Promise<any>} Result of the executed function
     * @throws {Error} Propagates any error thrown by the executed function
     */
    async add(fn) {
        if (this.running >= this.concurrency) {
            Logger.info({ message: `[RequestQueue.add] Queue full, waiting. Current running: ${this.running}, Queue length: ${this.queue.length}` });
            await new Promise((resolve) => this.queue.push(resolve));
        }
        this.running++;
        try {
            return await fn();
        } finally {
            this.running--;
            if (this.queue.length > 0) {
                Logger.info({ message: `[RequestQueue.add] Request completed. Processing next in queue. Queue length: ${this.queue.length}` });
                this.queue.shift()();
            } else {
                Logger.info({ message: `[RequestQueue.add] Request completed. No items in queue. Current running: ${this.running}` });
            }
        }
    }
}
module.exports = RequestQueue;
