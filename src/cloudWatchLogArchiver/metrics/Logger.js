/**
 * A logger class with static methods for logging messages at different levels.
 * The logged messages include the log level and timestamp.
 */
class Logger {
    static info(data) {
        console.log(JSON.stringify({ level: 'INFO', timestamp: new Date().toISOString(), ...data }));
    }

    static error(data) {
        console.error(JSON.stringify({ level: 'ERROR', timestamp: new Date().toISOString(), ...data }));
    }

    static warn(data) {
        console.warn(JSON.stringify({ level: 'WARN', timestamp: new Date().toISOString(), ...data }));
    }
}

module.exports = Logger;
