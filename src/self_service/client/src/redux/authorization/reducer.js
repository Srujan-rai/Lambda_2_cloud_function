import * as ActionTypes from './actions';

const initialState = {
    userRole: ''
};

const getUserRoleReducer = (state = initialState, action) => {
    switch (action.type) {
        case ActionTypes.GET_USER_ROLE_SUCCESS:
            return {
                ...state,
                userRole: action.payload
            };
        case ActionTypes.GET_USER_ROLE_ERROR:
            return initialState;
        default:
            return state;
    }
};

export default getUserRoleReducer;