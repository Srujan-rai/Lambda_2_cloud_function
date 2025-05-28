import { call, put, takeLatest } from 'redux-saga/effects';
import Api from '../../api/calls';
import * as uiActions from '../ui/actions';
import * as downloadReplicationActions from './actions';
import { DOWNLOAD_REPLICATION_FORM } from '../../constants/forms';
import { prepareErrorMessage } from '../../helpers/utils';

function* downloadReplication(action) {
    try {
        const replciationZip = yield call(Api.replication.download, action.payload);
        if (replciationZip) {
            yield put(uiActions.clearForm(DOWNLOAD_REPLICATION_FORM));
        }
        yield put(uiActions.enableSpinner(DOWNLOAD_REPLICATION_FORM, false));
    } catch (error) {
        yield put(uiActions.enableSpinner(DOWNLOAD_REPLICATION_FORM, false));

        const errorMessage = prepareErrorMessage(error);
        yield put(uiActions.showNotification({
            title: "Action failed!",
            message: `Failed to download the replication package! ${errorMessage}`,
            visible: true,
            type: "ERROR"
        }));
    }
}

function* downloadReplicationSaga() {
    yield takeLatest(downloadReplicationActions.DOWNLOAD_REPLICATION, downloadReplication);
}

export default downloadReplicationSaga;