//Action Types
export const GET_CURRENCY_ALLOCATION_RULES_REQUEST = 'currencyAllocationRules/GET_CURRENCY_ALLOCATION_RULES_REQUEST';
export const GET_CURRENCY_ALLOCATION_RULES_SUCCESS = 'currencyAllocationRules/GET_CURRENCY_ALLOCATION_RULES_SUCCESS';
export const GET_CURRENCY_ALLOCATION_RULES_ERROR = 'currencyAllocationRules/GET_CURRENCY_ALLOCATION_RULES_ERROR';

export const EMPTY_CURRENCY_ALLOCATION_RULES = 'currencyAllocationRules/EMPTY_CURRENCY_ALLOCATION_RULES';

export const SAVE_CURRENCY_ALLOCATION_RULE_REQUEST = 'currencyAllocationRules/SAVE_CURRENCY_ALLOCATION_RULE_REQUEST';
export const EDIT_CURRENCY_ALLOCATION_RULE_REQUEST = 'currencyAllocationRules/EDIT_CURRENCY_ALLOCATION_RULE_REQUEST';
export const SAVE_CURRENCY_ALLOCATION_RULE_SUCCESS = 'currencyAllocationRules/SAVE_CURRENCY_ALLOCATION_RULE_SUCCESS';
export const SAVE_CURRENCY_ALLOCATION_RULE_ERROR = 'currencyAllocationRules/SAVE_CURRENCY_ALLOCATION_RULE_ERROR';

//Action Creators For Get Currency Allocation Rules
export const getCurrencyAllocationRulesRequest = configurationId => ({
    type: GET_CURRENCY_ALLOCATION_RULES_REQUEST,
    payload: {
        configurationId
    }
});

export const getCurrencyAllocationRulesSuccess = response => ({
    type: GET_CURRENCY_ALLOCATION_RULES_SUCCESS,
    payload: response
});

export const getCurrencyAllocationRulesError = error => ({
    type: GET_CURRENCY_ALLOCATION_RULES_ERROR,
    payload: error
});

//Action Creators for setting the currency allocation rules array from redux store to be empty
export const emptyCurrencyAllocationRules = () => ({
    type: EMPTY_CURRENCY_ALLOCATION_RULES
});

//Action Creators For Save Currency Allocation Rules
export const saveCurrencyAllocationRuleRequest = data => ({
    type: SAVE_CURRENCY_ALLOCATION_RULE_REQUEST,
    payload: data
});

//Action Creators For Save Currency Allocation Rules
export const editCurrencyAllocationRuleRequest = data => ({
    type: EDIT_CURRENCY_ALLOCATION_RULE_REQUEST,
    payload: data
});

export const saveCurrencyAllocationRuleSuccess = response => ({
    type: SAVE_CURRENCY_ALLOCATION_RULE_SUCCESS,
    payload: response
});

export const saveCurrencyAllocationRuleError = error => ({
    type: SAVE_CURRENCY_ALLOCATION_RULE_ERROR,
    payload: error
});