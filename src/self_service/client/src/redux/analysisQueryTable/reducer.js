import * as ActionTypes from './actions';

const initialState = {
    analysisQueryTableResult: [],
    analysisQueryTableColumns: {}
};

const analysisQueryTableReducer = (state = initialState, action) => {
    switch (action.type) {
        case ActionTypes.QUERY_TABLE_RESULT_SUCCESS:
            return {
                ...state,
                analysisQueryTableResult: [...action.payload.data.result[0].data],
                analysisQueryTableColumns: {...action.payload.data.result[0].columns}
            }
        case ActionTypes.QUERY_TABLE_RESULT_ERROR:
            return {
                ...state,
                analysisQueryTableResult: [],
                analysisQueryTableColumns: {}
            };
        default:
            return {
                ...state
            };
    }
};

export default analysisQueryTableReducer;
