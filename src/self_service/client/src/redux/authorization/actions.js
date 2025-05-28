export const GET_USER_ROLE_REQUEST = 'authorization/GET_USER_ROLE_REQUEST';
export const GET_USER_ROLE_SUCCESS = 'authorization/GET_USER_ROLE_SUCCESS';
export const GET_USER_ROLE_ERROR = 'authorization/GET_USER_ROLE_ERROR';

export const getUserRoleRequest = (data) => ({
    type: GET_USER_ROLE_REQUEST,
    payload: data
});

export const getUserRoleSuccess = response => ({
    type: GET_USER_ROLE_SUCCESS,
    payload: response
});

export const getUserRoleError = error => ({
    type: GET_USER_ROLE_ERROR,
    payload: error
});

