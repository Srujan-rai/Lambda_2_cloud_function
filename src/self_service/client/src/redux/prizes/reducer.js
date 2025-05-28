import * as ActionTypes from './actions';

const initialState = {
    promotionName: "",
    country: "",
    prizes: [],
    prize: {},
    prizeId: "",
    configurationId: ""
};

const prizesReducer = (state = initialState, action) => {
    switch (action.type) {
        case ActionTypes.SAVE_PRIZE_SUCCESS:
            return {
                ...state
            };
        case ActionTypes.SAVE_PRIZE_ERROR:
            return {
                ...state
            };
        case ActionTypes.GET_PRIZES_SUCCESS:
            const data = action.payload;
            return {
                ...state,
                promotionName: data.promotionName,
                country: data.country,
                prizes: [...data.prizeList]
            };
        case ActionTypes.GET_PRIZES_ERROR:
            return {
                ...state,
                prizes: []
            };
        case ActionTypes.EMPTY_PRIZES:
            return {
                ...state,
                prizes: []
            };
        case ActionTypes.GET_PRIZE_SUCCESS:
            return {
                ...state,
                prize: action.payload.data.prizeDetails
            };
        case ActionTypes.GET_PRIZE_ERROR:
            return {
                ...state
            };
        case ActionTypes.SET_PRIZE_ID:
            return {
                ...state,
                prizeId: action.payload
            };
        case ActionTypes.CLEAR_PRIZE_ID:
            return {
                ...state,
                prizeId: ''
            };
        case ActionTypes.SET_CONFIG_ID:
            return {
                ...state,
                configurationId: action.payload
            };
        case ActionTypes.CLEAR_CONFIG_ID:
            return {
                ...state,
                configurationId: ''
            };
        case ActionTypes.SET_SELECTED_PRIZE:
            return {
                ...state,
                prize: action.payload
            };
        default:
            return {
                ...state
            };
    }
};

export default prizesReducer;