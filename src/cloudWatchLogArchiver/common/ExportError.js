/**
Custom error class for handling CloudWatch log export operations
@extends Error
@param {string} message - The error message
@param {string} type - The type of export error
@param {string|null} logGroup - The CloudWatch log group name where the error occurred
@param {Error|null} originalError - The original error object if this wraps another error
*/
class ExportError extends Error {
    constructor(message, type, logGroup = null, originalError = null) {
        super(message);
        this.name = 'ExportError';
        this.type = type;
        this.logGroup = logGroup;
        this.originalError = originalError;
    }
}

module.exports = ExportError;
