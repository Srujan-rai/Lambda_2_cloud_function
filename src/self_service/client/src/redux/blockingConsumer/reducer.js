import * as ActionTypes from './actions';

const initialState = {
    consumerBlockingForm: {
        configurationId: "",
        userId: "",
        enteredById: "",
        requestedById: "",
        reason: "",
        title: "",
    },
    consumerUnblockingForm: {
        gppUserId: "",
        configurationId: "",
        enteredById: "",
        requestedById: "",
    },
    searchForm: {
        searchByUserId: ""
    },
    blockedConsumerData: []
};

const blockingConsumerReducer = (state = initialState, action) => {
    switch (action.type) {
        case ActionTypes.CHANGE_TEXT:
            return handleTextInputChange(state, action);
        case ActionTypes.CLEAR_FORM:
            return clearForm(initialState, state, action);
        case ActionTypes.GET_BLOCKED_CONSUMER_SUCCESS:
            return getBlockedConsumerData(state, action);
        case ActionTypes.CLEAR_SEARCH_PARAM:
            return clearSearchParam(state);
        default:
            return state;
    }
};

const handleTextInputChange = (state, action) => {
    const { payload: { fieldName, formName, value } } = action;

    return {
        ...state,
        [formName]: {
            ...state[formName],
            [fieldName]: value
        }
    }
};

const getBlockedConsumerData = (state, action) => {
    const value = action.payload;
    return {
        ...state,
        blockedConsumerData: value
    }
};

const clearForm = (initialState, state, action) => {
    const { formName } = action.payload;
     return {
        ...state,
        [formName]: initialState[formName]
    }
};

const clearSearchParam = (state) => {
  return {
      ...state,
      searchByUserId: ""
  };
};

export default blockingConsumerReducer;