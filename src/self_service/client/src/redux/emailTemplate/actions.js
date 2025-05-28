//Action Types
export const GET_EMAIL_TEMPLATES_REQUEST = 'emailTemplates/GET_EMAIL_TEMPLATES_REQUEST';
export const GET_EMAIL_TEMPLATES_SUCCESS = 'emailTemplates/GET_EMAIL_TEMPLATES_SUCCESS';
export const GET_EMAIL_TEMPLATES_ERROR = 'emailTemplates/GET_EMAIL_TEMPLATES_ERROR';

export const EMPTY_EMAIL_TEMPLATES = 'emailTemplates/EMPTY_EMAIL_TEMPLATES';

//Action Creators For Get EmailTemplates
export const getEmailTemplatesRequest = () => ({
    type: GET_EMAIL_TEMPLATES_REQUEST,
    payload: {}
});

export const getEmailTemplatesSuccess = response => ({
    type: GET_EMAIL_TEMPLATES_SUCCESS,
    payload: response
});

export const getEmailTemplatesError = error => ({
    type: GET_EMAIL_TEMPLATES_ERROR,
    payload: error
});

//Action Creator For Setting EmailTemplates To Be Empty Array
export const emptyEmailTemplates = () => ({
    type: EMPTY_EMAIL_TEMPLATES
});