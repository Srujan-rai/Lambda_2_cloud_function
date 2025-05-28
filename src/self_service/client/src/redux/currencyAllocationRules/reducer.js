import * as ActionTypes from './actions';
import { prepareCurrencyAllocationRulesItem } from '../../helpers/utils';

const initialState = {
    currencyAllocationRules: []
};

const currencyAllocationRulesReducer = (state = initialState, action) => {
    switch (action.type) {
        case ActionTypes.GET_CURRENCY_ALLOCATION_RULES_SUCCESS:
            return {
                ...state,
                currencyAllocationRules: action.payload
            };
        case ActionTypes.GET_CURRENCY_ALLOCATION_RULES_ERROR:
            return initialState;
        case ActionTypes.EMPTY_CURRENCY_ALLOCATION_RULES:
            return initialState;
        case ActionTypes.SAVE_CURRENCY_ALLOCATION_RULE_SUCCESS:
            return {
                ...state,
                currencyAllocationRules: [...state.currencyAllocationRules, prepareCurrencyAllocationRulesItem(action.payload)]
            }
        case ActionTypes.SAVE_CURRENCY_ALLOCATION_RULE_ERROR:
            return {...state};
        default:
            return {...state};
    }
};

export default currencyAllocationRulesReducer;
