import { combineReducers } from 'redux';
import uiReducer from './ui/reducer';
import prizesReducer from './prizes/reducer';
import emailTemplatesReducer from './emailTemplate/reducer';
import currencyAllocationRulesReducer from './currencyAllocationRules/reducer';
import promotionsReducer from './promotions/reducer';
import configurationsReducer from './configurations/reducer';
import analysisQueryTableReducer from './analysisQueryTable/reducer';
import participationQueryReducer from './participationQuery/reducer';
import blockingConsumerReducer from "./blockingConsumer/reducer";
import getUserRoleReducer from "./authorization/reducer";
import winningMomentsReducer from "./winningMoments/reducer";
import downloadReplicationReducer from './downloadReplication/reducer';
import uploadReplicationReducer from './uploadReplication/reducer';
import bulkDigitalCodesUploadReducer from './digitalCodesBulkUpload/reducer';

const rootReducer = combineReducers({
    ui: uiReducer,
    prizes: prizesReducer,
    emailTemplates: emailTemplatesReducer,
    currencyAllocationRules: currencyAllocationRulesReducer,
    promotions: promotionsReducer,
    configurations: configurationsReducer,
    analysisQueryTable: analysisQueryTableReducer,
    participationQuery: participationQueryReducer,
    blockingConsumer: blockingConsumerReducer,
    authorization: getUserRoleReducer,
    winningMoments: winningMomentsReducer,
    downloadReplication: downloadReplicationReducer,
    uploadReplication: uploadReplicationReducer,
    bulkUploadDigitalCodes: bulkDigitalCodesUploadReducer
});

export default rootReducer;
