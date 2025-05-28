import * as ActionTypes from './actions';

const initialState = {
    participationQueryTableResult: [],
    participationQueryTableColumns: {}
};

const participationQueryTableReducer = (state = initialState, action) => {
    switch (action.type) {
        case ActionTypes.QUERY_PARTICIPATION_RESULT_SUCCESS:
            return {
                ...state,
                participationQueryTableResult: [...action.payload.data.result[0].data],
                participationQueryTableColumns: {...action.payload.data.result[0].columns}
            }
        case ActionTypes.QUERY_PARTICIPATION_RESULT_ERROR:
            return {
                ...state,
                participationQueryTableResult: [],
                participationQueryTableColumns: {}
            };
        case ActionTypes.EMPTY_PARTICIPATIONS:
            return {
                ...state,
                participationQueryTableResult: [],
                participationQueryTableColumns: {}
            };
        default:
            return {
                ...state
            };
    }
};

export default participationQueryTableReducer;
