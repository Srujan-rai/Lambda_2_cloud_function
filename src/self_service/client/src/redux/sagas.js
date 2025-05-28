import { all, fork } from 'redux-saga/effects';
import prizeSaga from './prizes/sagas';
import currencyAllocationRulesSaga from './currencyAllocationRules/sagas';
import promotionsSaga from './promotions/sagas';
import configurationsSaga from './configurations/sagas';
import analysisQueryTableSaga from './analysisQueryTable/sagas';
import emailTemplateSaga from './emailTemplate/sagas';
import participationQuerySaga from './participationQuery/sagas';
import blockedConsumerSaga from './blockingConsumer/sagas'
import getUserRoleSaga from "./authorization/sagas";
import winningMoments from './winningMoments/sagas';
import downloadReplication from './downloadReplication/sagas';
import uploadReplication from './uploadReplication/sagas';

function* rootSaga() {
    yield all([
        fork(prizeSaga),
        fork(currencyAllocationRulesSaga),
        fork(promotionsSaga),
        fork(configurationsSaga),
        fork(analysisQueryTableSaga),
        fork(emailTemplateSaga),
        fork(participationQuerySaga),
        fork(blockedConsumerSaga),
        fork(getUserRoleSaga),
        fork(winningMoments),
        fork(downloadReplication),
        fork(uploadReplication)
    ]);
}

export default rootSaga;