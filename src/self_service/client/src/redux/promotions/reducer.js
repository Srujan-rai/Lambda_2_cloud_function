import * as ActionTypes from './actions';

const initialState = {
    promotions: [],
    promotion: {}
};

const promotionsReducer = (state = initialState, action) => {
    switch (action.type) {
        case ActionTypes.SAVE_PROMOTION_SUCCESS:
            return {
                ...state
            }
        case ActionTypes.SAVE_PROMOTION_ERROR:
            return {
                ...state
            };
        case ActionTypes.GET_PROMOTION_SUCCESS:
            return {
                ...state,
                promotion: action.payload.data.promotionMetadata
            }
        case ActionTypes.GET_PROMOTION_ERROR:
            return {
                ...state
            };
        case ActionTypes.SET_SELECTED_PROMOTION:
            return {
                ...state,
                promotion: action.payload
            }
        default:
            return {
                ...state
            };
    };
};

export default promotionsReducer;