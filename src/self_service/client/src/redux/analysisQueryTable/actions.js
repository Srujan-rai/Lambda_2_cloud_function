//Action Types
export const QUERY_TABLE_RESULT_REQUEST = 'analysisQueryTable/QUERY_TABLE_RESULT_REQUEST';
export const QUERY_TABLE_RESULT_SUCCESS = 'analysisQueryTable/QUERY_TABLE_RESULT_SUCCESS';
export const QUERY_TABLE_RESULT_ERROR = 'analysisQueryTable/QUERY_TABLE_RESULT_ERROR';

//Action Creators For Query Table
export const queryTableResultRequest = data => ({
    type: QUERY_TABLE_RESULT_REQUEST,
    payload: data
});

export const queryTableResultSuccess = response => ({
    type: QUERY_TABLE_RESULT_SUCCESS,
    payload: response
});

export const queryTableResultError = error => ({
    type: QUERY_TABLE_RESULT_ERROR,
    payload: error
});
