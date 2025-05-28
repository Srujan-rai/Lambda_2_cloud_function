import { call, put, takeLatest } from 'redux-saga/effects';
import Api from '../../api/calls';
import * as prizeActions from './actions';
import * as uiActions from '../ui/actions';
import { PRIZE_FORM } from '../../constants/forms';
import {addCurrencyAmount, prepareErrorMessage} from '../../helpers/utils';

function* savePrize(action) {
    try {
        const { prizeId } = yield call(Api.prizes.save, action.payload);
        const fieldsToNotClear = ["configurationId", "formDisabled", "currencies"];
        yield put(uiActions.clearForm(PRIZE_FORM, fieldsToNotClear));
        yield put(uiActions.showNotification({
            title: "Action successful!",
            message: "Prize successfully saved!\n Prize ID: " + prizeId,
            visible: true,
            type: "SUCCESS",
            disableAutoHide: true
        }));
        yield put(uiActions.enableSpinner(PRIZE_FORM, false));
    } catch (error) {
        yield put(uiActions.enableSpinner(PRIZE_FORM, false));
        const errorMessage = prepareErrorMessage(error);
        yield put(prizeActions.savePrizeError(errorMessage));
        yield put(uiActions.showNotification({
            title: "Action failed!",
            message: `Failed to save prize! ${errorMessage}`,
            visible: true,
            type: "ERROR"
        }));
    }
}

function* editPrize(action) {
    try {
        yield call(Api.prizes.edit, action.payload);
        yield put(uiActions.clearForm(PRIZE_FORM));
        yield put(uiActions.showNotification({
            title: "Action successfull!",
            message: "Prize successfully edited in prize catalogue table",
            visible: true,
            type: "SUCCESS"
        }));
        yield put(uiActions.enableSpinner(PRIZE_FORM, false));
    } catch (error) {
        yield put(uiActions.enableSpinner(PRIZE_FORM, false));
        const errorMessage = prepareErrorMessage(error);
        yield put(prizeActions.savePrizeError(errorMessage));
        yield put(uiActions.showNotification({
            title: "Action failed!",
            message: "Failed to edit prize in prize catalogue table",
            visible: true,
            type: "ERROR"
        }));
    }
}

function* getPrizes(action) {
    try {
        const response = yield call(Api.prizes.getAllPrizesForConfiguration, action.payload);
        yield put(prizeActions.getPrizesSuccess(response));
        yield put(uiActions.enableSpinner(PRIZE_FORM, false));
        if (response.prizeList.length === 0) {
            yield put(uiActions.showNotification({
                title: "Action successful!",
                message: "There are no prizes that meet the search criteria.",
                visible: true,
                type: "SUCCESS"
            }));
        }
    } catch (error) {
        const errorMessage = prepareErrorMessage(error.response.data);
        yield put(uiActions.enableSpinner(PRIZE_FORM, false));
        yield put(prizeActions.getPrizesError(errorMessage));
        yield put(uiActions.showNotification({
            title: "Action failed!",
            message: `Failed to fetch prizes! ${errorMessage}.`,
            visible: true,
            type: "ERROR"
        }));
    }
}

function* getPrize(action) {
    try {
        const configuration = yield call(Api.configurations.get, action.payload.configurationId);
        const currenciesIds = configuration.data.configurationMetadata.configurationParameters.currencies;
        if(currenciesIds && !(currenciesIds.toString()).includes('')) {
            const matchedCurrencies = yield call(Api.currencies.getByIds, currenciesIds);
            const currencies = addCurrencyAmount(matchedCurrencies.data.matchedCurrencies, 0);
            yield put(uiActions.setCurrenciesByConfig(currencies));
        }
        const prize = yield call(Api.prizes.get, action.payload);
        if(!Object.entries(prize.data).length) {
            yield put(uiActions.showNotification({
                title: "Action info!",
                message: `Prize ${action.payload} does not exist!`,
                visible: true,
                type: "INFO"
            }));
        }
        yield put(prizeActions.getPrizeSuccess(prize));
    } catch (error) {
        yield put(prizeActions.getPrizeError(error.message));
        yield put(uiActions.showNotification({
            title: "Action failed!",
            message: `Failed to get prize! ${error.message}`,
            visible: true,
            type: "ERROR"
        }));
    }
}

function* prizeSaga() {
    yield takeLatest(prizeActions.SAVE_PRIZE_REQUEST, savePrize);
    yield takeLatest(prizeActions.EDIT_PRIZE_REQUEST, editPrize);
    yield takeLatest(prizeActions.GET_PRIZES_REQUEST, getPrizes);
    yield takeLatest(prizeActions.GET_PRIZE_REQUEST, getPrize);
}

export default prizeSaga;
