import { call, put, takeLatest } from 'redux-saga/effects';
import Api from '../../api/calls';
import * as participationQueryTableActions from './actions';
import * as uiActions from '../ui/actions';
// import { QUERY_TABLE_FORM } from '../../constants/forms';

function* queryParticipationTable(action) {
    try {
        const response = yield call(Api.participations[action.payload.method], action.payload);
       // yield put(uiActions.clearForm(QUERY_TABLE_FORM));
        yield put(participationQueryTableActions.queryParticipationResultSuccess(response));

        let resultLength;
        if (response.data.result.length) {
            resultLength = response.data.result[0].data.length;
        } else {
            resultLength = 0;
        }
        const message = `Found ${resultLength} record${resultLength > 1 ? 's' : ''}`;

        yield put(uiActions.showNotification({
            title: "Action successfull!",
            message,
            visible: true,
            type: "SUCCESS"
        }));
    } catch (error) {
        yield put(participationQueryTableActions.queryParticipationResultError(error.message));
        yield put(uiActions.showNotification({
            title: "Action failed!",
            message: "Failed to get participation table!",
            visible: true,
            type: "ERROR"
        }));
    }
}

function* queryParticipationSaga() {
    yield takeLatest(participationQueryTableActions.QUERY_PARTICIPATION_RESULT_REQUEST, queryParticipationTable);
}

export default queryParticipationSaga;
