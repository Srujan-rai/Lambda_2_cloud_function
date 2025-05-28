import * as ActionTypes from './actions';

const initialState = {
    emailTemplates: []
};

const emailTemplatesReducer = (state = initialState, action) => {
    switch (action.type) {
        case ActionTypes.GET_EMAIL_TEMPLATES_SUCCESS:
            const data = action.payload.data;
            return {
                ...state,
                country: data.country,
                emailTemplates: [...data.allEmailTemplates]
            };
        case ActionTypes.GET_EMAIL_TEMPLATES_ERROR:
        case ActionTypes.EMPTY_EMAIL_TEMPLATES:
            return {
                ...state,
                emailTemplates: []
            };
        default:
            return state;
    }
};

export default emailTemplatesReducer;