//Action Types
export const SAVE_PROMOTION_REQUEST = 'promotions/SAVE_PROMOTION_REQUEST';
export const SAVE_PROMOTION_SUCCESS = 'promotions/SAVE_PROMOTION_SUCCESS';
export const SAVE_PROMOTION_ERROR = 'promotions/SAVE_PROMOTION_ERROR';

export const GET_PROMOTION_REQUEST = 'promotions/GET_PROMOTION_REQUEST';
export const GET_PROMOTION_SUCCESS = 'promotions/GET_PROMOTION_SUCCESS';
export const GET_PROMOTION_ERROR = 'promotions/GET_PROMOTION_ERROR';

export const SET_SELECTED_PROMOTION = 'promotions/SET_SELECTED_PROMOTION';

//Action Creators For Save Promotion meta data
export const savePromotionRequest = data => ({
    type: SAVE_PROMOTION_REQUEST,
    payload: data
});

export const savePromotionSuccess = response => ({
    type: SAVE_PROMOTION_SUCCESS,
    payload: response
});

export const savePromotionError = error => ({
    type: SAVE_PROMOTION_ERROR,
    payload: error
});

//Action Creators For Fetching Promotion
export const getPromotionRequest = data => ({
    type: GET_PROMOTION_REQUEST,
    payload: data
});

export const getPromotionSuccess = response => ({
    type: GET_PROMOTION_SUCCESS,
    payload: response
});

export const getPromotionError = error => ({
    type: GET_PROMOTION_ERROR,
    payload: error
});

//Action Creator For Setting Active Promotion
export const setSelectedPromotion = promotion => ({
    type: SET_SELECTED_PROMOTION,
    payload: promotion
});