const { pause } = require('../common/helpers');
const Logger = require('../metrics/Logger');

/**
 * A rate limiter for CloudWatch API requests, using a token bucket algorithm.
 * This class manages the token bucket and provides a `throttle()` method to
 * ensure that requests are rate-limited to the configured maximum.
 */
class CloudWatchRateLimiter {
    static lastRequestTime = 0;

    static tokenBucket = 10;

    static maxTokens = 10;

    static refillRate = 5; // Requests per second

    static async throttle() {
        const now = Date.now();
        const timeElapsed = now - this.lastRequestTime;

        // Calculate precise token refill based on elapsed time
        const newTokens = (timeElapsed / 1000) * this.refillRate;
        this.tokenBucket = Math.min(
            this.maxTokens,
            this.tokenBucket + newTokens,
        );

        if (this.tokenBucket < 5) {
            // Calculate exact wait time needed for next token
            const waitTime = Math.ceil((1 - this.tokenBucket) * (1000 / this.refillRate));
            Logger.warn({
                message: `Rate limited. Waiting for ${waitTime}ms to continue.`,
                correlationId: 'rate-limiter',
            });

            await pause(waitTime);
            this.tokenBucket = 1;
        }

        this.tokenBucket--;
        this.lastRequestTime = now;
    }
}

module.exports = CloudWatchRateLimiter;
