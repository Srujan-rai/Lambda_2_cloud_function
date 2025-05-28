import * as ActionTypes from './actions';

const initialState = {
    configurations: [],
    configuration: null
};

const configurationsReducer = (state = initialState, action) => {
    switch (action.type) {
        case ActionTypes.SAVE_CONFIGURATION_SUCCESS:
            return {
                ...state,
                configurations: [...state.configurations, action.payload]
            };
        case ActionTypes.SAVE_CONFIGURATION_ERROR:
            return {
                ...state
            };
        case ActionTypes.GET_CONFIGURATION_SUCCESS:
            return {
                ...state,
                configuration: action.payload
            };
        case ActionTypes.GET_CONFIGURATION_ERROR:
            return {
                ...state
            };
        case ActionTypes.CLEAR_CONFIGURATION:
            return {
                ...state,
                configuration: null
            }
        default:
            return {
                ...state
            };
    }
};

export default configurationsReducer;