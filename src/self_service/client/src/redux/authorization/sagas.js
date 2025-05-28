import { call, put, takeLatest } from 'redux-saga/effects';
import * as authorizationActions from "./actions";
import Api from '../../api/calls';
import { prepareErrorMessage  } from '../../helpers/utils';
import * as uiActions from '../ui/actions';

function* getUserRole(action) {
    try { 
        const loggedUser = yield call(Api.getUserRole.get, action.payload);
        yield put(authorizationActions.getUserRoleSuccess(loggedUser.result[0].data[0].role));
    } catch (error) {
        const errorMessage = prepareErrorMessage(error);
        yield put(authorizationActions.getUserRoleError(errorMessage));
        yield put(uiActions.showNotification({
            title: "Action failed!",
            message: `Failed to get User Role" ${error}`,
            visible: true,
            type: "ERROR"
        }));
    }
}

function* getUserRoleSaga() {
    yield takeLatest(authorizationActions.GET_USER_ROLE_REQUEST, getUserRole)
}

export default getUserRoleSaga;