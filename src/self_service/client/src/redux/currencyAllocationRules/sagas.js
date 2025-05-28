import { call, put, takeLatest } from 'redux-saga/effects';
import Api from '../../api/calls';
import * as carActions from './actions';
import * as uiActions from '../ui/actions';
import { CURRENCY_ALLOCATION_RULES_FORM } from '../../constants/forms';
import { getCurrencyAllocationRulesRequest } from './actions';

function* getCurrencyAllocationRules(action) {
    try {
        const currencyAllocationRules = yield call(Api.currencyAllocationRules.getCurrencyAllocationRules, action.payload);
        yield put(carActions.getCurrencyAllocationRulesSuccess(currencyAllocationRules.data.allCurrencyAllocationRules));
    } catch (error) {
        yield put(carActions.getCurrencyAllocationRulesError(error.message));
        yield put(uiActions.showNotification({
            title: "Action failed!",
            message: `Configuration Id ${action.payload.configurationId} does not exist! Failed to fetch currency allocation rules!`,
            visible: true,
            type: "ERROR"
        }));
    }
}

function* saveCurrencyAllocationRule(action) {
    try {
        const currencyAllocationRule = yield call(Api.currencyAllocationRules.save, action.payload);
        yield put(carActions.saveCurrencyAllocationRuleSuccess(currencyAllocationRule.data.entry));
        yield put(uiActions.clearForm(CURRENCY_ALLOCATION_RULES_FORM));
        const message = "Currency allocation rule successfully saved.";
        yield put(uiActions.showNotification({
            title: "Action successful!",
            message,
            visible: true,
            type: "SUCCESS"
        }));
    } catch (error) {
        yield put(carActions.saveCurrencyAllocationRuleError(error.message));
        let message = "Failed to insert Currency Allocation Rule!";
        // change notification message to 'reason' returned by NGPS engine (if returned)
        if (error && error.response && error.response.data && error.response.data.errorDetails && error.response.data.errorDetails.reason) {
            message = error.response.data.errorDetails.reason;
        }
        yield put(uiActions.showNotification({
            title: "Action failed!",
            message: message,
            visible: true,
            type: "ERROR"
        }));
    }
}

function* editCurrencyAllocationRule(action) {
    try {
        const currencyAllocationRule = yield call(Api.currencyAllocationRules.edit, action.payload);
        yield put(carActions.saveCurrencyAllocationRuleSuccess(currencyAllocationRule));
        yield put(uiActions.clearForm(CURRENCY_ALLOCATION_RULES_FORM));
        //get allocation list again
        const configurationId = action.payload.configurationId;
        yield put(getCurrencyAllocationRulesRequest(configurationId));
        const message = "Currency allocation rule successfully edited.";
        yield put(uiActions.showNotification({
            title: "Action successful!",
            message,
            visible: true,
            type: "SUCCESS"
        }));
    } catch (error) {
        yield put(carActions.saveCurrencyAllocationRuleError(error.message));
        let message = "Failed to edit Currency Allocation Rule!";
        // change notification message to 'reason' returned by NGPS engine (if returned)
        if (error && error.response && error.response.data && error.response.data.errorDetails && error.response.data.errorDetails.reason) {
            message = error.response.data.errorDetails.reason;
        }
        yield put(uiActions.showNotification({
            title: "Action failed!",
            message: message,
            visible: true,
            type: "ERROR"
        }));
    }
}


function* currencyAllocationRulesSaga() {
    yield takeLatest(carActions.GET_CURRENCY_ALLOCATION_RULES_REQUEST, getCurrencyAllocationRules);
    yield takeLatest(carActions.EDIT_CURRENCY_ALLOCATION_RULE_REQUEST, editCurrencyAllocationRule);
    yield takeLatest(carActions.SAVE_CURRENCY_ALLOCATION_RULE_REQUEST, saveCurrencyAllocationRule);
}

export default currencyAllocationRulesSaga;