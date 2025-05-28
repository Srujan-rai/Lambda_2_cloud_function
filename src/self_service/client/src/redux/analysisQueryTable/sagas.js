import { call, put, takeLatest } from 'redux-saga/effects';
import Api from '../../api/calls';
import * as analysisQueryTableActions from './actions';
import * as uiActions from '../ui/actions';
import { QUERY_TABLE_FORM } from '../../constants/forms';

function* queryTable(action) {
    try {
        const response = yield call(Api.queryTable.getQueryResult, action.payload);
        yield put(uiActions.clearForm(QUERY_TABLE_FORM));
        yield put(analysisQueryTableActions.queryTableResultSuccess(response));

        const resultLength = response.data.result[0].data.length
        const message = `Found ${resultLength} record${resultLength > 1 ? 's' : ''}`;

        yield put(uiActions.showNotification({
            title: "Action successfull!",
            message,
            visible: true,
            type: "SUCCESS"
        }));
    } catch (error) {
        yield put(analysisQueryTableActions.queryTableResultError(error.message));
        yield put(uiActions.showNotification({
            title: "Action failed!",
            message: "Failed to query table!",
            visible: true,
            type: "ERROR"
        }));
    }
}

function* queryTableSaga() {
    yield takeLatest(analysisQueryTableActions.QUERY_TABLE_RESULT_REQUEST, queryTable);
}

export default queryTableSaga;
