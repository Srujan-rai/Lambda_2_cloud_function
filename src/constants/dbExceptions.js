/**
 * Exceptions thrown by DynamoDB. See https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Programming.Errors.html
 */
const DYNAMO_DB_EXCEPTIONS = {
    ACCESS_DENIED_EXCEPTION: 'AccessDeniedException',
    TRANSACTION_CANCELED_EXCEPTION: 'TransactionCanceledException',
    TRANSACTION_CONFLICT_EXCEPTION: 'TransactionConflictException',
    TRANSACTION_IN_PROGRESS_EXCEPTION: 'TransactionInProgressException',
    CONDITIONAL_CHECK_FAILED_EXCEPTION: 'ConditionalCheckFailedException',
    INCOMPLETE_SIGNATURE_EXCEPTION: 'IncompleteSignatureException',
    ITEM_COLLECTION_SIZE_LIMIT_EXCEEDED_EXCEPTION: 'ItemCollectionSizeLimitExceededException',
    LIMIT_EXCEEDED_EXCEPTION: 'LimitExceededException',
    MISSING_AUTH_TOKEN_EXCEPTION: 'MissingAuthenticationTokenException',
    PROVISIONED_THROUGHPUT_EXCEEDED_EXCEPTION: 'ProvisionedThroughputExceededException',
    RESOURCE_IN_USE_EXCEPTION: 'ResourceInUseException',
    RESOURCE_NOT_FOUND_EXCEPTION: 'ResourceNotFoundException',
    THROTTLING_EXCEPTION: 'ThrottlingException',
    UNRECOGNIZED_CLIENT_EXCEPTION: 'UnrecognizedClientException',
    VALIDATION_EXCEPTION: 'ValidationException',
    INTERNAL_SERVER_ERROR: 'InternalServerError',
};

const DYNAMO_DB_CANCELLATION_REASONS = {
    CONDITIONAL_CHECK_FAILED: 'ConditionalCheckFailed',
    ITEM_COLLECTION_SIZE_LIMIT_EXCEEDED: 'ItemCollectionSizeLimitExceeded',
    TRANSACTION_CONFLICT: 'TransactionConflict',
    PROVISIONED_THROUGHPUT_EXCEEDED: 'ProvisionedThroughputExceeded',
    THROTTLING_ERROR: 'ThrottlingError',
    VALIDATION_ERROR: 'ValidationError',
};

module.exports = {
    DYNAMO_DB_EXCEPTIONS,
    DYNAMO_DB_CANCELLATION_REASONS,
};
