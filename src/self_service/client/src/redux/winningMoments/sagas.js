import { call, put, select, takeLatest } from 'redux-saga/effects';
import { UPLOAD_WINNING_MOMENTS, GENERATE_WINNING_MOMENTS, GENERATE_WINNING_MOMENTS_PER_PRIZE, serveWinningMoments } from './actions';
import { WINNING_MOMENTS_FORM } from '../../constants/forms';
import { showNotification } from '../ui/actions';
import API from '../../api/calls';

function* getFormState() {
    return yield select(state => state.ui[WINNING_MOMENTS_FORM]);
}

function* uploadWinningMoments(action) {
    const { configurationId } = yield getFormState();

    try {
        yield call(API.configurations.get, configurationId);
        yield call(API.winningMoments.save, { configurationId, file: action.payload });
        yield put(
            showNotification({
                title: 'Action successful!',
                message: 'Winning moments successfully saved!',
                type: 'SUCCESS',
                visible: true
            })
        );
    } catch (error) {
        yield put(
            showNotification({
                title: 'Action failed!',
                message: `Failed to save Winning moments! ${error.message}`,
                type: 'ERROR',
                visible: true
            })
        )
    }
}

function* generateWinningMoments() {
    const { configurationId, startDate, endDate, prizeDistributionDefect, timestampDistributionDefect, winningMomentExpiration } = yield getFormState();
    const startTimestamp = new Date(startDate).getTime(), endTimestamp = new Date(endDate).getTime();

    try {
        yield call(API.configurations.get, configurationId);
        const csvData = yield call(API.winningMoments.generate, { configurationId, startTimestamp, endTimestamp, prizeDistributionDefect, timestampDistributionDefect, winningMomentExpiration });
        yield put(serveWinningMoments(csvData));
        yield put(
            showNotification({
                title: 'Action successful!',
                message: 'Winning moments successfully generated!',
                type: 'SUCCESS',
                visible: true
            })
        );
    } catch (error) {
        yield put(
            showNotification({
                title: 'Action failed!',
                message: `Failed to generate Winning moments! ${error.message}`,
                type: 'ERROR',
                visible: true
            })
        )
    }
}

function* generateWinningMomentsPerPrize(action) {
    try {
        yield call(API.configurations.get, action.payload.configurationId);
        const csvData = yield call(API.winningMoments.generatePerPrize, action.payload);
        yield put(serveWinningMoments(csvData));
        yield put(
            showNotification({
                title: 'Action successful!',
                message: 'Winning moments successfully generated!',
                type: 'SUCCESS',
                visible: true
            })
        );
    } catch (error) {
        yield put(
            showNotification({
                title: 'Action failed!',
                message: `Failed to generate Winning moments! ${error.message}`,
                type: 'ERROR',
                visible: true
            })
        )
    }
}

function* winningMomentsSaga() {
    yield takeLatest(UPLOAD_WINNING_MOMENTS, uploadWinningMoments);
    yield takeLatest(GENERATE_WINNING_MOMENTS, generateWinningMoments);
    yield takeLatest(GENERATE_WINNING_MOMENTS_PER_PRIZE, generateWinningMomentsPerPrize);
}

export default winningMomentsSaga;
