//Action Types
export const SAVE_CONFIGURATION_REQUEST = 'configurations/SAVE_CONFIGURATION_REQUEST';
export const SAVE_CONFIGURATION_SUCCESS = 'configurations/SAVE_CONFIGURATION_SUCCESS';
export const SAVE_CONFIGURATION_ERROR = 'configurations/SAVE_CONFIGURATION_ERROR';

export const GET_CONFIGURATION_REQUEST = 'configurations/GET_CONFIGURATION_REQUEST';
export const GET_CONFIGURATION_SUCCESS = 'configurations/GET_CONFIGURATION_SUCCESS';
export const GET_CONFIGURATION_ERROR = 'configurations/GET_CONFIGURATION_ERROR';

export const CLEAR_CONFIGURATION = 'configurations/CLEAR_CONFIGURATION';

//Action Creators For Save Configuration data
export const saveConfigurationRequest = (data, file) => ({
    type: SAVE_CONFIGURATION_REQUEST,
    payload: data,
    file
});

export const saveConfigurationSuccess = response => ({
    type: SAVE_CONFIGURATION_SUCCESS,
    payload: response
});

export const saveConfigurationError = error => ({
    type: SAVE_CONFIGURATION_ERROR,
    payload: error
});

//Action Creators For Get Configuration data

/**
 * Used for dispatching action for fetching configuration on configuration field when focus is lost 
 * @param {string} configurationId - unique key for configuration
 * @param {boolean} withCurrencies - get currencies by configuration or not
 */
export const getConfigurationRequest = (configurationId, withCurrencies) => ({
    type: GET_CONFIGURATION_REQUEST,
    payload: configurationId,
    withCurrencies: withCurrencies
});

export const getConfigurationSuccess = response => ({
    type: GET_CONFIGURATION_SUCCESS,
    payload: response
});

export const getConfigurationError = error => ({
    type: GET_CONFIGURATION_ERROR,
    payload: error
});

export const clearConfiguration = () => ({
    type: CLEAR_CONFIGURATION
});