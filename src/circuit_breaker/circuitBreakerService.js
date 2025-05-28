const Moment = require('moment-timezone');
const { getCircuitBreakerItem, updateCircuitBreakerItem, putEntry } = require('../database/circuitBreakerTable');

const COUNT_THRESHOLD = 10;
const OPEN_TIMEOUT_MINUTES = 10;

const CIRCUIT_STATES = {
    OPEN: 'open',
    HALF_OPEN: 'halfOpen',
    CLOSED: 'closed',
    NONE: 'none',
    CREATE_PARAMS: 'createParams',
};

const circuitBreakerModules = {
    MIX_CODES: {
        moduleId: 'MixCodesCircuitBreaker',
        defaultState: 'closed',
        defaultSuccessCount: '0',
        defaultErrorCount: '0',
        defaultLastFailure: '',
    },
};

/**
 * Checks the circuit breaker state and returns whether requests are allowed.
 * @param {string} moduleName
 * @returns {Promise<{allowed: boolean, state: string}>}
 */
const checkCircuitBreaker = async (moduleConfig) => {
    console.log('execute checkCircuitBreaker');
    try {
        const circuitState = await getCircuitBreakerItem({ moduleId: moduleConfig.moduleId });
        const stateValue = circuitState === null ? CIRCUIT_STATES.CREATE_PARAMS : circuitState.state;

        switch (stateValue) {
            case CIRCUIT_STATES.CLOSED:
                return { allowed: true, state: CIRCUIT_STATES.CLOSED };

            case CIRCUIT_STATES.OPEN: {
                const lastFailureTime = circuitState.lastFailure;
                const storedMoment = Moment.utc(lastFailureTime);
                const expiryMoment = storedMoment.clone().add(OPEN_TIMEOUT_MINUTES, 'minutes');
                const nowUTC = Moment.utc();

                if (nowUTC.isAfter(expiryMoment)) {
                    console.log('changed to halfOpen state.');
                    await updateCircuitBreakerItem(moduleConfig.moduleId, { state: CIRCUIT_STATES.HALF_OPEN });
                    return { allowed: true, state: CIRCUIT_STATES.HALF_OPEN };
                }
                console.log(`Circuit is open. ${OPEN_TIMEOUT_MINUTES} minutes have not passed since last failure.`);

                return { allowed: false, state: CIRCUIT_STATES.OPEN };
            }

            case CIRCUIT_STATES.HALF_OPEN:
                return { allowed: true, state: CIRCUIT_STATES.HALF_OPEN };

            case CIRCUIT_STATES.CREATE_PARAMS:
                await putEntry(moduleConfig);
                return { allowed: true };

            default:
                return { allowed: true, state: 'unknown' };
        }
    } catch (error) {
        console.error('Error checking circuit breaker:', error);
        return { allowed: true, state: 'error' };
    }
};
/**
 * Updates the parameter store if the circuit breaker is not in open or halfOpen state.
 * @param {string} moduleName
 */
const enableCircuitBreaker = async (moduleName) => {
    const moduleConfig = circuitBreakerModules[moduleName];
    try {
        const circuitState = await getCircuitBreakerItem({ moduleId: moduleConfig.moduleId });
        const stateValue = circuitState.state || moduleConfig.defaultState;

        if (stateValue === CIRCUIT_STATES.CLOSED) {
            const nowUTCString = Moment.utc().format();
            await updateCircuitBreakerItem(moduleConfig.moduleId, {
                state: CIRCUIT_STATES.OPEN,
                lastFailure: nowUTCString,
            });
            console.log(`Circuit breaker state updated to open for module ${moduleConfig.moduleId}`);
        }
    } catch (error) {
        console.error('Error updating circuit breaker state:', error);
    }
};

/**
 * Increments the success or error count based on the API response status.
 * When a counter exceeds the threshold, it resets the counters and updates the state.
 * @param {string} moduleName - Key from circuitBreakerModules (e.g., "MIX_CODES")
 * @param {string} status - "success" or "error"
 */
const incrementCBCount = async (moduleConfig, status) => {
    try {
        const circuitObj = await getCircuitBreakerItem({ moduleId: moduleConfig.moduleId });
        const isSuccess = status === 'success';
        const counterKey = isSuccess ? 'successCount' : 'errorCount';
        const defaultValue = isSuccess ? moduleConfig.defaultSuccessCount : moduleConfig.defaultErrorCount;
        const currentCount = Number(circuitObj[counterKey] || defaultValue);
        const newCount = currentCount + 1;

        if (newCount > COUNT_THRESHOLD) {
            const extraUpdates = isSuccess
                ? { lastFailure: '' }
                : { lastFailure: Moment.utc().format() };
            const newState = isSuccess ? CIRCUIT_STATES.CLOSED : CIRCUIT_STATES.OPEN;
            await resetValues(moduleConfig.moduleId, { state: newState, ...extraUpdates });
        } else {
            await updateCircuitBreakerItem(moduleConfig.moduleId, { [counterKey]: newCount });
        }
    } catch (error) {
        console.error('Error incrementing circuit breaker count:', error);
    }
};

/**
 * Resets success and error counts and updates the state (and optionally lastFailure).
 * @param {string} moduleId
 * @param {object} options - { state: newState, lastFailure?: value }
 */
const resetValues = async (moduleId, { state, lastFailure }) => {
    const updates = {
        successCount: '0',
        errorCount: '0',
        state,
        lastFailure,
    };
    await updateCircuitBreakerItem(moduleId, updates);
};

/**
 * Checks the API response and triggers circuit breaker updates accordingly.
 * @param {object} response - The API response object.
 * @param {string} circuitState - The current circuit breaker state.
 */
const checkResponseForMixCodes = async (response, circuitState) => {
    try {
        if (![200, 500].includes(response.status)) {
            return;
        }
        const isSuccess = response.status === 200;
        console.log(isSuccess ? 'CB_MIX_CODES_API_SUCCESS' : 'CB_MIX_CODES_API_FAILURE'); // Logging for metric filter

        if (circuitState === 'halfOpen') {
            await incrementCBCount(circuitBreakerModules.MIX_CODES, isSuccess ? 'success' : 'error');
        }
    } catch (error) {
        console.log('checkResponseForMixCodes error', error);
    }
};

const customErrorResponseForMixCodes = (pincode, action) => {
    const baseData = {
        message: 'SERVICE_UNAVAILABLE',
        errorCode: 503,
    };

    const config = { pincode };

    if (action === 'get') {
        return [
            {
                status: 'fulfilled',
                value: {
                    status: 503,
                    config,
                    data: {
                        ...baseData,
                        code: pincode,
                    },
                },
            },
        ];
    }

    return {
        config,
        status: 503,
        response: {
            data: {
                ...baseData,
                pincode,
                transactionId: '',
            },
        },
    };
};

module.exports = {
    checkCircuitBreaker,
    enableCircuitBreaker,
    checkResponseForMixCodes,
    customErrorResponseForMixCodes,
    circuitBreakerModules,
};
