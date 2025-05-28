export const CHANGE_TEXT = 'blockingConsumer/CHANGE_TEXT';
export const BLOCKED_CONSUMER = 'blockingConsumer/BLOCKING_CONSUMER';
export const CLEAR_FORM = 'blockingConsumer/CLEAR_FORM';
export const GET_BLOCKED_CONSUMER = 'blockingConsumer/GET_BLOCKED_CONSUMER';
export const GET_BLOCKED_CONSUMER_SUCCESS = 'blockingConsumer/GET_BLOCKED_CONSUMER_SUCCESS';
export const CLEAR_SEARCH_PARAM = 'blockingConsumer/CLEAR_SEARCH_PARAM';
export const UNBLOCKED_CONSUMER = 'blockingConsumer/UNBLOCKED_CONSUMER';

export const changeText = (value, fieldName, formName) => ({
    type: CHANGE_TEXT,
    payload: {
        value,
        fieldName,
        formName
    }
});

export const saveBlockedConsumer = (data) => ({
    type: BLOCKED_CONSUMER,
    payload: data
});

export const clearForm = (formName) => ({
    type: CLEAR_FORM,
    payload: {
        formName
    }
});

export const unblockedConsumer = (data) => ({
    type: UNBLOCKED_CONSUMER,
    payload: data
});

export const getBlockedConsumer = (data) => ({
    type: GET_BLOCKED_CONSUMER,
    payload: data
});

export const getBlockedConsumerSuccess = (blockedConsumerData) => ({
    type: GET_BLOCKED_CONSUMER_SUCCESS,
    payload: blockedConsumerData
});