
import * as ActionTypes from './actions';

const initialState = {
    replication: ""
};

const uploadReplicationReducer = (state = initialState, action) => {
    switch (action.type) {
        case ActionTypes.UPLOAD_REPLICATION:
            return {
                ...state,
                replication: action.payload.replication
            };
        default:
            return {...state};
    }
};

export default uploadReplicationReducer;
