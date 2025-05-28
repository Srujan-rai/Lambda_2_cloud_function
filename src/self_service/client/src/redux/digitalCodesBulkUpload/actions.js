//Action Types
export const ADD_AUTO_UPLOAD_DIGITAL_CODES = 'digitalCodesBulkUpload/ADD_AUTO_UPLOAD_DIGITAL_CODES';
export const REMOVE_AUTO_UPLOAD_DIGITAL_CODES = 'digitalCodesBulkUplaod/REMOVE_AUTO_UPLOAD_DIGITAL_CODES';
export const CHANGE_DIGITAL_CODES_UPLOAD = 'digitalCodesBulkUpload/CHANGE_DIGITAL_CODES_UPLOAD';
export const CLEAR_DIGITAL_CODES = 'digitalCodesBulkUpload/CLEAR_DIGITAL_CODES';

//Action Creators
export const addDigitalCodes = (payload) => ({
    type: ADD_AUTO_UPLOAD_DIGITAL_CODES,
    payload
});

export const changeDigitalCodesUpload = (event, index, value, isValid) => ({
    type: CHANGE_DIGITAL_CODES_UPLOAD,
    event,
    index,
    value,
    isValid,
});

export const removeDigitalCodes = (index, name)=> ({
    type: REMOVE_AUTO_UPLOAD_DIGITAL_CODES,
    index,
    name
})


export const clearDigitalCodes = () => ({
    type: CLEAR_DIGITAL_CODES
})