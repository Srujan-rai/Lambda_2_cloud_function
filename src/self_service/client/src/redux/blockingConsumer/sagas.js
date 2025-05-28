import { call, put, takeLatest } from 'redux-saga/effects';
import * as blockedConsumerActions from "./actions";
import Api from "../../api/calls";
import * as uiActions from "../ui/actions";

function* requestBlockedConsumer(action) {
    try {
        yield call(Api.blockedConsumer.save, action.payload);
        yield put(blockedConsumerActions.clearForm("consumerBlockingForm"));
        yield put(uiActions.showNotification({
            title: "Action successfull!",
            message: "User successfully blocked",
            visible: true,
            type: "SUCCESS"
        }));
    } catch (error) {
        let errorMessage = "";
        if (error.response && error.response.data && error.response.data.errorDetails && error.response.data.errorDetails.blockReason) {
            errorMessage = `The Consumer is blocked. Reason: ${error.response.data.errorDetails.blockReason}`;
        } else if (error.response && error.response.data && error.response.data.message) {
            errorMessage = error.response.data.message;
        }
        yield put(uiActions.showNotification({
            title: "Action failed!",
            message: errorMessage,
            visible: true,
            type: "ERROR"
        }));
        console.log("ERROR", error)
    }
}
function* requestGetBlockedConsumer(action) {

    try {
        const {data} = yield call(Api.blockedConsumer.get, action.payload);
        yield put(blockedConsumerActions.getBlockedConsumerSuccess(data.blockedConsumerData));
        yield put(uiActions.showNotification({
            title: "Action successfull!",
            message: "Blocked consumer data",
            visible: true,
            type: "SUCCESS"
        }));
    }catch (error) {
        yield put(uiActions.showNotification({
            title: "Action failed!",
            message: "Not found",
            visible: true,
            type: "ERROR"
        }));
    }

}

function* requestUnblockedConsumer(action) {
    try {
        const data = yield call(Api.blockedConsumer.unblocked, action.payload);
        yield put(blockedConsumerActions.clearForm("consumerUnblockingForm"));
        yield put(uiActions.showNotification({
            title: "Action successfull!",
            message: "Unblocked consumer",
            visible: true,
            type: "SUCCESS"
        }));
    } catch (error) {
        const {response} = error
        yield put(uiActions.showNotification({
            title: "Action failed!",
            message: response.data.message,
            visible: true,
            type: "ERROR"
        }));
    }
}

function* blockedConsumerSaga() {
    yield takeLatest(blockedConsumerActions.BLOCKED_CONSUMER, requestBlockedConsumer);
    yield takeLatest(blockedConsumerActions.GET_BLOCKED_CONSUMER, requestGetBlockedConsumer);
    yield takeLatest(blockedConsumerActions.UNBLOCKED_CONSUMER, requestUnblockedConsumer);
}

export default blockedConsumerSaga;