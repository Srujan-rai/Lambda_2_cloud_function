import * as ActionTypes from './actions';

const initialState = {
    digitalCodesBulkUpload: [""]
};

const bulkDigitalCodesUploadReducer = (state = initialState, action) => {
    switch (action.type) {
        case ActionTypes.CHANGE_DIGITAL_CODES_UPLOAD:
            const oldCodes = [...state.digitalCodesBulkUpload];
            oldCodes[action.index] = action.value;
            return {
                digitalCodesBulkUpload: oldCodes,
                };
        case ActionTypes.REMOVE_AUTO_UPLOAD_DIGITAL_CODES:
            const newRemovedValue = [...state.digitalCodesBulkUpload];
            const afterRemoval = newRemovedValue.filter((_, i) => i !== action.index);
            return {
                digitalCodesBulkUpload: afterRemoval
                }
        case ActionTypes.ADD_AUTO_UPLOAD_DIGITAL_CODES: {
            return {
                digitalCodesBulkUpload: [...state.digitalCodesBulkUpload, ""]
            };
        }
        case ActionTypes.CLEAR_DIGITAL_CODES: {
            return initialState;
        }
        default:
            return state;
    }
}

export default bulkDigitalCodesUploadReducer;