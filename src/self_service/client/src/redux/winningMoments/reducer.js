import { CLEAR_WINNING_MOMENTS, SERVE_WINNING_MOMENTS } from "./actions";

const initialState = {
    csvContent: null,
    csvParams: null
};

export default (state = initialState, {type, payload}) => {
    switch (type) {
        case SERVE_WINNING_MOMENTS:
            const { csvContent, csvParams } = payload;
            return { ...state, csvContent, csvParams };
        case CLEAR_WINNING_MOMENTS:
            return initialState;
        default:
            return state;
    }
};
