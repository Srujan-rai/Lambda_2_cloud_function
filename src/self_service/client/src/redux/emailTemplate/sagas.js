import { call, put, takeLatest } from 'redux-saga/effects';
import Api from '../../api/calls';
import * as uiActions from '../ui/actions';
import * as emailTemplatesActions from "./actions";
import {prepareErrorMessage} from "../../helpers/utils";

function* getTemplate(action) {
    try {
        let templateData = yield call(Api.emailTemplates.get, action.templateId);
        yield put(uiActions.getEmailTemplateSuccess(templateData.data));
    } catch (error) {
        yield put(uiActions.showNotification({
            title: "Action failed!",
            message: "Failed occur during getting information.",
            visible: true,
            type: "ERROR"
        }));
    }
}

function* getEmailTemplates(action) {
    try {
        const response = yield call(Api.emailTemplates.getList, action.payload);
        yield put(emailTemplatesActions.getEmailTemplatesSuccess(response));
        if (response.data.allEmailTemplates.length === 0) {
            yield put(uiActions.showNotification({
                title: "Action successful!",
                message: "There are no emailTemplates that meet the search criteria.",
                visible: true,
                type: "SUCCESS"
            }));
        }
    } catch (error) {
        const errorMessage = prepareErrorMessage(error.response.data);
        yield put(emailTemplatesActions.getEmailTemplatesError());
        yield put(uiActions.showNotification({
            title: "Action failed!",
            message: `Failed to fetch emailTemplates ${errorMessage}.`,
            visible: true,
            type: "ERROR"
        }));
    }
}

function* emailTemplateSaga() {
    yield takeLatest(uiActions.EMAIL_TEMPLATE_GET, getTemplate);
    yield takeLatest(emailTemplatesActions.GET_EMAIL_TEMPLATES_REQUEST, getEmailTemplates);
}

export default emailTemplateSaga;