import { call, put, takeLatest } from 'redux-saga/effects';
import Api from '../../api/calls';
import * as promotionActions from './actions';
import * as uiActions from '../ui/actions';
import { PROMOTION_FORM } from '../../constants/forms';
import { prepareErrorMessage } from '../../helpers/utils';

function* savePromotion(action) {
    try {
        const { promotionId } = action.payload;
        const promotion = yield call(Api.promotions.save, action.payload);
        if (!promotionId) {
            yield put(uiActions.clearForm(PROMOTION_FORM));
        }
        const message = "Promotion successfully saved!\n" + "Promotion ID: " + promotion.data.promotionId;
        yield put(uiActions.showNotification({
            title: "Action successful!",
            message,
            visible: true,
            type: "SUCCESS",
            disableAutoHide: true
        }));
    } catch (error) {
        const errorMessage = prepareErrorMessage(error.response.data);
        yield put(promotionActions.savePromotionError(errorMessage));
        yield put(uiActions.showNotification({
            title: "Action failed!",
            message: `Failed to save promotion! ${errorMessage}`,
            visible: true,
            type: "ERROR"
        }));
    }
}

function* getPromotion(action) {
    try {
        const promotion = yield call(Api.promotions.get, action.payload);
        if(!Object.entries(promotion.data).length) {
            yield put(uiActions.showNotification({
                title: "Action info!",
                message: `Promotion ${action.payload} does not exist!`,
                visible: true,
                type: "INFO"
            }));
        }
        yield put(promotionActions.getPromotionSuccess(promotion));
    } catch (error) {
        const errorMessage = prepareErrorMessage(error.response.data);
        yield put(promotionActions.getPromotionError(errorMessage));
        yield put(uiActions.showNotification({
            title: "Action failed!",
            message: `Failed to get promotion! ${errorMessage}`,
            visible: true,
            type: "ERROR"
        }));
    }
}

function* promotionSaga() {
    yield takeLatest(promotionActions.SAVE_PROMOTION_REQUEST, savePromotion);
    yield takeLatest(promotionActions.GET_PROMOTION_REQUEST, getPromotion);
}

export default promotionSaga;