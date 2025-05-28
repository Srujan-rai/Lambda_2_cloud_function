import { call, put, takeLatest } from 'redux-saga/effects';
import Api from '../../api/calls';
import * as configurationActions from './actions';
import * as uiActions from '../ui/actions';
import { CONFIGURATION_FORM } from '../../constants/forms';
import { prepareErrorMessage, addCurrencyAmount } from '../../helpers/utils';

function* saveConfiguration(action) {
    try {
        const configuration = yield call(Api.configurations.save, action.payload, action.file);
        yield put(configurationActions.saveConfigurationSuccess(configuration));
        yield put(uiActions.clearForm(CONFIGURATION_FORM));
        const message = "Configuration successfully saved!\n ID: " + configuration.data.configurationId;
        yield put(uiActions.showNotification({
            title: "Action successful!",
            message,
            visible: true,
            type: "SUCCESS",
            disableAutoHide: true
        }));
    } catch (error) {
        const errorMessage = prepareErrorMessage(error.response.data);
        yield put(configurationActions.saveConfigurationError(errorMessage));
        yield put(uiActions.showNotification({
            title: "Action failed!",
            message: `Failed to save configuration! ${errorMessage}`,
            visible: true,
            type: "ERROR"
        }));
    }
}

function* getConfiguration(action) {
    try {
        const configuration = yield call(Api.configurations.get, action.payload);
        yield put(configurationActions.getConfigurationSuccess(configuration.data.configurationMetadata));
        if (action.withCurrencies) {
            const currenciesIds = configuration.data.configurationMetadata.configurationParameters.currencies;
            const response = yield call(Api.currencies.getByIds, currenciesIds);
            const currencies = addCurrencyAmount(response.data.matchedCurrencies, 0);
            yield put(uiActions.setCurrenciesByConfig(currencies));
        }
    } catch (error) {
        const errorMessage = prepareErrorMessage(error.response.data);
        yield put(configurationActions.getConfigurationError(errorMessage));
        yield put(uiActions.showNotification({
            title: "Action failed!",
            message: `Failed to get configuration! ${errorMessage}`,
            visible: true,
            type: "ERROR"
        }));
    }
}

function* configurationSaga() {
    yield takeLatest(configurationActions.SAVE_CONFIGURATION_REQUEST, saveConfiguration);
    yield takeLatest(configurationActions.GET_CONFIGURATION_REQUEST, getConfiguration);
}

export default configurationSaga;