//Action Types
export const SAVE_PRIZE_REQUEST = 'prizes/SAVE_PRIZE_REQUEST';
export const SAVE_PRIZE_SUCCESS = 'prizes/SAVE_PRIZE_SUCCESS';
export const SAVE_PRIZE_ERROR = 'prizes/SAVE_PRIZE_ERROR';
export const EDIT_PRIZE_REQUEST = 'prizes/EDIT_PRIZE_REQUEST';

export const GET_PRIZES_REQUEST = 'prizes/GET_PRIZES_REQUEST';
export const GET_PRIZES_SUCCESS = 'prizes/GET_PRIZES_SUCCESS';
export const GET_PRIZES_ERROR = 'prizes/GET_PRIZES_ERROR';

export const GET_PRIZE_REQUEST = 'prizes/GET_PRIZE_REQUEST';
export const GET_PRIZE_SUCCESS = 'prizes/GET_PRIZE_SUCCESS';
export const GET_PRIZE_ERROR = 'prizes/GET_PRIZE_ERROR';
export const SET_PRIZE_ID = 'prizes/SET_PRIZE_ID';
export const CLEAR_PRIZE_ID = 'prizes/CLEAR_PRIZE_ID';
export const SET_SELECTED_PRIZE = 'prizes/SET_SELECTED_PRIZE';
export const SET_CONFIG_ID = 'prizes/SET_CONFIG_ID';
export const CLEAR_CONFIG_ID = 'prizes/CLEAR_CONFIG_ID';

export const EMPTY_PRIZES = 'prizes/EMPTY_PRIZES';

//Action Creators For Save Prize
export const savePrizeRequest = (data, event) => ({
    type: SAVE_PRIZE_REQUEST,
    payload: {
        data,
        event
    }
});

export const savePrizeSuccess = response => ({
    type: SAVE_PRIZE_SUCCESS,
    payload: response
});

export const savePrizeError = error => ({
    type: SAVE_PRIZE_ERROR,
    payload: error
});

//Action Creators For Edit Prize
export const editPrizeRequest = (data, event) => ({
    type: EDIT_PRIZE_REQUEST,
    payload: {
        data,
        event
    }
});

//Action Creators For Get Prizes
export const getPrizesRequest = (configurationId, languageCode, filter) => ({
    type: GET_PRIZES_REQUEST,
    payload: {
        configurationId,
        language: languageCode,
        filter: filter
    }
});

export const getPrizesSuccess = response => ({
    type: GET_PRIZES_SUCCESS,
    payload: response
});

export const getPrizesError = error => ({
    type: GET_PRIZES_ERROR,
    payload: error
});

export const  getPrizeRequest = data => ({
    type: GET_PRIZE_REQUEST,
    payload: data
});

export const getPrizeSuccess = response => ({
    type: GET_PRIZE_SUCCESS,
    payload: response
});

export const getPrizeError = error => ({
    type: GET_PRIZE_ERROR,
    payload: error
});

export const setPrizeId = prizeId => ({
    type: SET_PRIZE_ID,
    payload: prizeId
});

export const clearPrizeId = () => ({
    type: CLEAR_PRIZE_ID
});

export const setConfigId = configId => ({
    type: SET_CONFIG_ID,
    payload: configId
});

export const clearConfigId = () => ({
    type: CLEAR_CONFIG_ID
});

export const setSelectedPrize = (prize) => ({
    type: SET_SELECTED_PRIZE,
    payload: prize
});

//Action Creator For Setting Prizes To Be Empty Array
export const emptyPrizes = () => ({
    type: EMPTY_PRIZES
});