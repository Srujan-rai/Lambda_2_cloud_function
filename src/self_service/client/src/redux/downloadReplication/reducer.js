
import * as ActionTypes from './actions';

const initialState = {
    replication: ""
};

const downloadReplicationReducer = (state = initialState, action) => {
    switch (action.type) {
        case ActionTypes.DOWNLOAD_REPLICATION:
            return {
                ...state,
                replication: action.payload.replication
            };
        default:
            return {...state};
    }
};

export default downloadReplicationReducer;
