import { PROMOTION_FORM, CONFIGURATION_FORM } from '../../constants/forms';
//Action Types
export const CHANGE_TEXT = 'ui/CHANGE_TEXT';
export const CHANGE_IMAGE_METADATA = 'ui/CHANGE_IMAGE_METADATA';
export const CHANGE_NUMBER = 'ui/CHANGE_NUMBER';
export const CHANGE_CHECKBOX = 'ui/CHANGE_CHECKBOX';
export const CHANGE_SELECT = 'ui/CHANGE_SELECT';
export const CHANGE_CURRENCY = 'ui/CHANGE_CURRENCY';
export const CHANGE_CURRENCY_AMOUNT = 'ui/CHANGE_CURRENCY_AMOUNT';
export const SET_PRIZE_TAGS = "UI/SET_PRIZE_TAGS";
export const CHANGE_FILE = 'ui/CHANGE_FILE';
export const SET_FIELDS_MESSAGES = 'ui/SET_FIELDS_MESSAGES';
export const SET_FIELDS_ERRORS = 'ui/SET_FIELDS_ERRORS';
export const SET_FIELD_ERROR = 'ui/SET_FIELD_ERROR';
export const CLEAR_FIELD_ERROR = 'ui/CLEAR_FIELD_ERROR';
export const CLEAR_FIELDS_ERRORS = 'ui/CLEAR_FIELDS_ERRORS';
export const CLEAR_FORM = 'ui/CLEAR_FORM';
export const DISABLE_FORM = 'ui/DISABLE_FORM';
export const ENABLE_SPINNER = 'ui/ENABLE_SPINNER';
export const FILL_FORM = 'ui/FILL_FORM';
export const SHOW_NOTIFICATION = 'ui/SHOW_NOTIFICATION';
export const HIDE_NOTIFICATION = 'ui/HIDE_NOTIFICATION';
export const ADD_LANGUAGE = 'ui/ADD_LANGUAGE';
export const ADD_LANGUAGES = 'ui/ADD_LANGUAGES';
export const ADD_DEFAULT_LANGUAGE = 'ui/ADD_DEFAULT_LANGUAGE';
export const ADD_LISTING_LANGUAGE = 'ui/ADD_LISTING_LANGUAGE';
export const SET_SELECTED_LANGUAGE = 'ui/SET_SELECTED_LANGUAGE';
export const SET_PRIZE_IMAGES = 'ui/SET_PRIZE_IMAGES';
export const REMOVE_LANGUAGE = 'ui/REMOVE_LANGUAGE';
export const ADD_FLOW_LABEL = 'ui/ADD_FLOW_LABEL';
export const REMOVE_FLOW_LABEL = 'ui/REMOVE_FLOW_LABEL';
export const ADD_CURRENCY = 'ui/ADD_CURRENCY';
export const REMOVE_CURRENCY = 'ui/REMOVE_CURRENCY';
export const ADD_CONFIGURATION_PARAMETER = 'ui/ADD_CONFIGURATION_PARAMETER';
export const ADD_ADDITIONAL_INFO_PARAMETER = 'ui/ADD_ADDITIONAL_INFO_PARAMETER';
export const CLEAR_CURRENCY_LIST = 'ui/CLEAR_CURRENCY_LIST';
export const CHANGE_DATETIME = 'ui/CHANGE_DATETIME';
export const SET_CURRENCIES_BY_CONFIG = 'ui/SET_CURRENCIES_BY_CONFIG';
export const EMAIL_TEMPLATE_GET = 'ui/EMAIL_TEMPLATE_GET';
export const EMAIL_TEMPLATE_GET_SUCCESS = 'ui/EMAIL_TEMPLATE_GET_SUCCESS';
export const EMAIL_TEMPLATE_GET_UPDATED = 'ui/EMAIL_TEMPLATE_UPDATED';
export const CLEAR_ALL = 'ui/CLEAR_ALL';//clear error + notification
export const SET_PRIZE_COST = 'ui/SET_PRIZE_COST';
export const ADD_COST_ITEM_TO_PRIZE = 'ui/ADD_COST_ITEM_TO_PRIZE';
export const REMOVE_COST_ITEM_FROM_PRIZE = 'ui/REMOVE_COST_ITEM_FROM_PRIZE';
export const CHANGE_VALIDITY = 'ui/CHANGE_VALIDITY';
export const ADD_FILE_ITEM_ADDITION = 'ui/ADD_ITEM_FILE_ADDITION';
export const REMOVE_FILE_ITEM_ADDITION = 'ui/REMOVE_FILE_ITEM_ADDITION';
export const CHANGE_FILE_UPLOAD = 'ui/CHANGE_FILE_UPLOAD';
export const CHANGE_PROP = 'ui/CHANGE_PROP';

//Action Creators

/**
 * Used for dispatching action upon text change in input text field
 * @param {object} event
 * @param {string} source - defines form which state should be changed
 */
export const textInputChange = (event, source) => ({
    type: CHANGE_TEXT,
    event,
    source
});

/**
 * Used for dispatching action upon image metadata change
 * @param {string} value - defines value which state should be changed
 * @param {string} name - the metadata field name
 * @param {number} index - index of the image
 * @param {string} source - defines form which state should be changed
 */
export const imageMetadataChange = (index, language, value, name, source) => ({
    type: CHANGE_IMAGE_METADATA,
    value,
    name,
    index,
    language,
    source
});

export const numberChange = (value, name, source) => ({
    type: CHANGE_NUMBER,
    value,
    name,
    source
});

export const checkboxChange = (event, source) => ({
    type: CHANGE_CHECKBOX,
    event,
    source
});

/**
 * Used for dispatching action upon change in select box
 * @param {*} event
 * @param {string} source - defines form which state should be changed
 */
export const selectChange = (event, source) => ({
    type: CHANGE_SELECT,
    event,
    source
});

/**
 * Used for dispatching action upon currency change in select box
 * @param {number} index index of the changed currency
 * @param {string} currencyId id of the changed currency
 * @param {number} currencyValue value of the changed currency
 */
export const currencyChange = (index, currencyId, amount) => ({
    type: CHANGE_CURRENCY, index, currencyId, amount
});

/**
 * Used for dispatching action upon file change for upload
 * @param {Object} event
 * @param {string} fileType
 * @param {boolean} isValid - is file of required type
 */
export const fileChange = (event, source, isValid, customMessage) => ({
    type: CHANGE_FILE,
    event,
    source,
    isValid,
    customMessage
});

export const changeFileUpload = (event, index, language, value, isValid)=> ({
    type: CHANGE_FILE_UPLOAD,
    event,
    index,
    language,
    value,
    isValid,
});


/**
 * Used for dispatching action for displaying validation messages
 *  @param {string} fields - the name of the fields that are checked against validations
 *  @param {boolean} isPromotion - separate two forms
 */
export const setFieldsMessages = (fields, isPromotion = false) => ({
    type: SET_FIELDS_MESSAGES,
    formType: isPromotion ? PROMOTION_FORM : CONFIGURATION_FORM,
    fields
});

/**
 * Used for dispatching action for displaying validation Errors
 *  @param {string} fields - the name of the fields that are checked against validations
 *  @param {string} formName - form which these fields belong and validate
 */
export const setFieldsErrors = (fields, formName) => ({
    type: SET_FIELDS_ERRORS,
    fields,
    formName
});

/**
 * Used for dispatching action for displaying one Error one field
 *  @param {string} fields - the name of the fields that are checked against validations
 *  @param {string} formName - form which these fields belong and validate
 *  @param {string} errorMessage - error which will be displayed
 */
export const setFieldError = (field, formName, errorMessage) => ({
    type: SET_FIELD_ERROR,
    field,
    formName,
    errorMessage
});

/**
 * Used for dispatching action for displaying validation Errors
 *  @param {array} fields - the name of the fields that are checked against validations
 *  @param {string} formName - form which these fields belong and validate
 */
export const clearFieldError = (field, formName) => ({
    type: CLEAR_FIELD_ERROR,
    field,
    formName
});

/**
 * Used for dispatching action for displaying validation Errors
 *  @param {string} fields - the name of the fields that are checked against validations
 *  @param {string} formName - form which these fields belong and validate
 */
export const clearFieldsErrors = (formName) => ({
    type: CLEAR_FIELDS_ERRORS,
    formName
});

/**
 * Used for dispatching action for displaying validation Errors
 *  @param {string} fields - the name of the fields that are checked against validations
 *  @param {string} formName - form which these fields belong and validate
 */
export const clearAll = (formName) => ({
    type: CLEAR_ALL,
    formName
});

/**
 * Used for dispatching action to clear the form after submission
 *  @param {string} source - defines form which state should be changed
 */
export const clearForm = (formName, fieldsToSkip = []) => ({
    type: CLEAR_FORM,
    formName,
    fieldsToSkip
});

/**
 * Used for dispatching action to enable/disable the from
 *  @param {string} formName - defines form which state should be changed
 *  @param {string} formStatus - true/false
 */
export const disableForm = (formName, formStatus) => ({
    type: DISABLE_FORM,
    formName,
    formStatus
});

/**
 * Used for dispatching action to fill particular form store
 *  @param {String} formName - the name of the form
 *  @param {Object} formData - data which need to be stored (camelCase)
 */
export const fillForm = (formName, formData) => ({
    type: FILL_FORM,
    formName,
    formData
});

/**
 * Used for dispatching action to fill particular form store
 *  @param {String} formName - the name of the form
 *  @param {Object} formData - data which need to be stored (camelCase)
 */
export const enableSpinner = (formName, spinnerStatus) => ({
    type: ENABLE_SPINNER,
    formName,
    spinnerStatus
});

/**
 * Used for dispatching action to show notifications
 * @param {Object} param - object with title, message, type, visible and disableAutoHide properties
 */
export const showNotification = ({ title, message, type, visible, disableAutoHide }) => ({
    type: SHOW_NOTIFICATION,
    payload: {
        title,
        message,
        type,
        visible,
        disableAutoHide
    }
});

export const hideNotification = () => ({
    type: HIDE_NOTIFICATION
});

/**
 * Used for dispatching action for adding new language to the prize form
 * @param {string} code - language two letter code like "bg", "sr", ...
 * @param {string} name - language name like "Bulgarian", "Serbian", ...
 */
export const addLanguage = (code, name) => ({
    type: ADD_LANGUAGE,
    language: {
        code,
        name
    }
});

/**
 * Used for dispatching action for setting language from list prize form
 * @param {string} code - language two letter code like "bg", "sr", ...
 * @param {string} name - language name like "Bulgarian", "Serbian", ...
 */
export const addListingLanguage = (code, name) => ({
    type: ADD_LISTING_LANGUAGE,
    language: {
        code,
        name
    }
});

/**
 * Used for dispatching action for setting all existing languages on the edit prize form
 * @param {Object} languages - all languages for current prize
 */
export const addLanguages = languages => ({
    type: ADD_LANGUAGES,
    languages
});

/**
 * Used for dispatching action for adding new language to the prize form
 * @param {string} code - language two letter code like "bg", "sr", ...
 * @param {string} name - language name like "Bulgarian", "Serbian", ...
 */
export const addDefaultLanguage = (code, name) => ({
    type: ADD_DEFAULT_LANGUAGE,
    language: {
        code,
        name
    }
});

/**
 * Used for dispatching action for setting newly selected language on the prize form
 * @param {number} languageTab - ordinal value of selected tab in language tab switcher
 */
export const setSelectedLanguage = languageTab => ({
    type: SET_SELECTED_LANGUAGE,
    languageTab
});

/**
 * Used for dispatching action for setting prize image metadata on the prize form
 * @param {string} code - language code like "en-GB", "de-CH", ...
 */
 export const setPrizeImages = (code) => ({
    type: SET_PRIZE_IMAGES,
    language: {
        code
    }
});

/**
 * Used for dispatching action for removing language from the prize form
 * @param {string} code - language code like "en-GB", "de-CH", ...
 */
export const removeLanguage = (code) => ({
    type: REMOVE_LANGUAGE,
    language: {
        code
    }
});

/**
 * Used for dispatching action for adding flowLabel to the configuration's flow
 * @param {string} flowLabelKey - flowLabel name
 * @param {string} flowLabelObject - flowLabel content
 */
export const addFlowLabel = (flowLabelKey, flowLabelObject) => ({
    type: ADD_FLOW_LABEL,
    payload: {
        flowLabelKey,
        flowLabelObject: !flowLabelObject ? {} : flowLabelObject
    }
});

/**
 * Used for dispatching action for removing flowLabel with specified key from configuration's flow
 * @param {string} flowLabelKey - flowLabel name
 */
export const removeFlowLabel = flowLabelKey => ({
    type: REMOVE_FLOW_LABEL,
    payload: {
        flowLabelKey
    }
});

/**
 * Used for dispatching action when configuration parameter is changed
 * @param {string} key - key of configuration parameter
 * @param {string} value - value of configuration parameter
 */
export const addConfigurationParameter = (key, value) => ({
    type: ADD_CONFIGURATION_PARAMETER,
    payload: {
        key,
        value
    }
});

export const addAdditionalInfoParameter = (key, value) => ({
    type: ADD_ADDITIONAL_INFO_PARAMETER,
    payload: {
        key,
        value
    }
});

/**
 * Used for dispatching action for adding currency to the currency array in configuration parameters
 * @param {string} currencyId - id of currency for current country
 */
export const addCurrency = currencyId => ({
    type: ADD_CURRENCY,
    payload: {
        currencyId
    }
});

/**
 * Used for dispatching action for adding cost to the selected prize
 * @param {string} currencyId - id of currency for current country
 */
export const addCostItemToPrize = currency => ({
    type: ADD_COST_ITEM_TO_PRIZE, currency
});

/**
 * Used for dispatching action for removing currency with specified key from currencies array in configuration parameters
 * @param {string} currencyId - id of currency  for current country
 */
export const removeCurrency = currencyId => ({
    type: REMOVE_CURRENCY,
    payload: {
        currencyId
    }
});

/**
 * Used for dispatching action for removing cost from the selected prize
 * @param {string} currencyId - id of currency for current country
 */
export const removeCostItemFromPrize = currency => ({
    type: REMOVE_COST_ITEM_FROM_PRIZE, currency
});

/**
 * Used for dispatching action to clear currencies array from configuration parameters
 */
export const clearCurrencyList = () => ({
    type: CLEAR_CURRENCY_LIST
});

/*
 * Used for dispatching action upon text change in input text field
 * @param {object} props
 * @param {string} source - defines form which state should be changed
 */
export const dateTimeInputChange = (props, source) => ({
    type: CHANGE_DATETIME,
    props,
    source
});

/**
 * Set currencies by configuration
 */
export const setCurrenciesByConfig = currencies => ({
    type: SET_CURRENCIES_BY_CONFIG,
    currencies
});

/*
 * Used for dispatching action upon get Email Template request
 * managed through saga
 * @param {string} templateId
 */
export const getEmailTemplate = (templateId) => ({
    type: EMAIL_TEMPLATE_GET,
    templateId
});

/*
 * Used for dispatching action upon text change in input text field
 * @param {object} templateData
 */
export const getEmailTemplateSuccess = (templateData) => ({
    type: EMAIL_TEMPLATE_GET_SUCCESS,
    payload: templateData
});

/*
 * Used for dispatching action upon text change in input text field
 *  change storage _shouldUpdate(boolean) flat to FALSE
 */
export const getEmailTemplateUpdated = () => ({
    type: EMAIL_TEMPLATE_GET_UPDATED
});

/**
 * Used for settings the tags for the edited prize
 * @param {array} prizeTags list of prize tags
 * @returns action to be used in reducer
 */
export const setPrizeTags = prizeTags => ({
    type: SET_PRIZE_TAGS,
    payload: prizeTags
});

/*
 * Used for dispatching action upon chaging the cost of a prize
 */
export const setPrizeCost = payload => ({
    type: SET_PRIZE_COST, payload
});

export const addFileItemAddition = (payload) => ({
    type: ADD_FILE_ITEM_ADDITION, payload
});

export const removeFileItemAddition = (index, name)=> ({
    type: REMOVE_FILE_ITEM_ADDITION, index, name
});

export const propChange = (value, name, source) => ({
    type: CHANGE_PROP,
    value,
    name,
    source
});
