import { call, put, takeLatest } from 'redux-saga/effects';
import Api from '../../api/calls';
import * as uiActions from '../ui/actions';
import * as uploadReplicationActions from './actions';
import { UPLOAD_REPLICATION_FORM } from '../../constants/forms';
import { prepareErrorMessage } from '../../helpers/utils';

function* uploadReplication(action) {
    try {
        const success = yield call(Api.replication.upload, action.payload, action.file);
        if (success) {
            yield put(uiActions.clearForm(UPLOAD_REPLICATION_FORM));
            yield put(uiActions.showNotification({
                title: "Action successfull!",
                message: 'The package were successfully uploaded, you will be notifyed whether the package processing was successfull or not!',
                visible: true,
                type: "SUCCESS"
            }));
        }
        yield put(uiActions.enableSpinner(UPLOAD_REPLICATION_FORM, false));
    } catch (error) {
        yield put(uiActions.enableSpinner(UPLOAD_REPLICATION_FORM, false));

        const errorMessage = prepareErrorMessage(error);
        yield put(uiActions.showNotification({
            title: "Action failed!",
            message: `Failed to upload the replication package! ${errorMessage}`,
            visible: true,
            type: "ERROR"
        }));
    }
}

function* uploadReplicationSaga() {
    yield takeLatest(uploadReplicationActions.UPLOAD_REPLICATION, uploadReplication);
}

export default uploadReplicationSaga;