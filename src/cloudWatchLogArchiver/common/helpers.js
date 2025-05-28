/**
 * Increases the given date by the specified amount and unit.
 *
 * @param {number|Date} date - The date to be modified.
 * @param {number} amount - The amount to increase the date by.
 * @param {'hour'|'day'|'month'|'year'} unit - The unit to increase the date by.
 * @param {boolean} [returnInMS=true] - Whether to return the modified date as a timestamp in milliseconds.
 * @returns {number|Date} - The modified date.
 * @throws {Error} - If the date, amount, or unit is invalid.
 */
function increaseDateBy(date, amount, unit, returnInMS = true) {
    if (!date || !amount || !unit) {
        throw new Error('Invalid date, amount or unit');
    }

    const dateCopy = new Date(date);
    let modifiedDate = '';

    switch (unit) {
        case 'hour':
            modifiedDate = new Date(
                dateCopy.setHours(dateCopy.getHours() + amount),
            );
            break;

        case 'day':
            modifiedDate = new Date(
                dateCopy.setDate(dateCopy.getDate() + amount),
            );
            break;

        case 'month':
            modifiedDate = new Date(
                dateCopy.setMonth(dateCopy.getMonth() + amount),
            );
            break;

        case 'year':
            modifiedDate = new Date(
                dateCopy.setFullYear(dateCopy.getFullYear() + amount),
            );
            break;

        default:
            throw new Error('Invalid unit');
    }

    return returnInMS ? modifiedDate.getTime() : modifiedDate;
}

/**
 * Calculates the next export logs window for a given log group.
 *
 * @param {object} logGroup - The log group object containing the necessary information.
 * @param {object} logGroup.tags - The tags associated with the log group.
 * @param {number} logGroup.creationTime - The creation time of the log group in milliseconds.
 * @param {string|number} logGroup.tags.PreviousExportToDate - The previous export to date, either as a string or number.
 * @param {string} logGroup.logGroupName - The name of the log group.
 * @returns {object} - An object containing the calculated export job parameters.
 */
function calculateNextExportLogsWindow(logGroup) {
    const { tags } = logGroup;

    // Expect that if there is the previous export to date is a ms timestamp of either type string or number
    // Expect that creationTime is a ms timestamp of type number
    const fromDate = tags?.PreviousExportToDate
        ? parseInt(tags.PreviousExportToDate, 10)
        : logGroup.creationTime;

    // Expect that fromDate is a ms timestamp of type number
    const exportFromDateZeroed = new Date(fromDate);
    exportFromDateZeroed.setHours(0, 0, 0, 0);

    return {
        ...logGroup,
        exportJobParams: {
            logGroupName: logGroup.logGroupName,
            exportFromDate: exportFromDateZeroed.getTime(),
            exportToDate: new Date(increaseDateBy(exportFromDateZeroed, 1, 'day')).getTime(),
        },
    };
}

/**
 * Pauses the current execution for the specified delay in milliseconds.
 *
 * @param {number} delay - The delay in milliseconds to pause the execution.
 * @returns {Promise<void>} - A Promise that resolves when the delay has elapsed.
 */
async function pause(delay) {
    return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Calculates a jitter-based backoff delay for retrying a queue drain operation.
 * The delay is calculated based on the provided `retryDelayMs` and the current `retries` count.
 * The delay is randomized within a range to avoid synchronized retries.
 *
 * @param {number} retryDelayMs - The base delay in milliseconds for each retry.
 * @param {number} retries - The current number of retry attempts.
 * @returns {number} - The calculated jitter-based backoff delay in milliseconds.
 */
function calcJitBackoffDelay(retryDelayMs, retries) {
    return retryDelayMs * Math.min(retries, 4) * (0.5 + Math.random());
}

module.exports = {
    increaseDateBy,
    calculateNextExportLogsWindow,
    pause,
    calcJitBackoffDelay,
};
