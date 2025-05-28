import React from 'react';
import { Switch } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import HomePage from '../pages/HomePage';
import NotFoundPage from '../pages/NotFoundPage';
import PrizeFormPage from '../pages/PrizeFormPage';
import CurrencyAllocationRulesPage from '../pages/CurrencyAllocationRulesPage';
import PromotionPage from '../pages/PromotionPage';
import ConfigurationPage from '../pages/ConfigurationPage';
import EditConfigurationContainer from '../containers/EditConfigurationContainer';
import SearchConfigurationPage from '../pages/SearchConfigurationPage';
import SearchSdkConfigurationPage from '../pages/SearchSdkConfigurationPage';
import SdkConfigurationPage from '../pages/SdkConfigurationPage';
import SearchPromotionPage from '../pages/SearchPromotionPage';
import AnalysisQueryTablePage from '../pages/AnalysisQueryTablePage';
import SearchPrizePage from '../pages/SearchPrizePage'
import WinningMomentsPage from '../pages/WinningMomentsPage';
import GenerateWMPerPrizeContainer from '../containers/GenerateWMPerPrizeContainer';
import EditPrizeContainer from '../containers/EditPrizeContainer';
import PrizesListContainer from '../containers/PrizesListContainer';
import EmailTemplatesListContainer from '../containers/EmailTemplatesListContainer';
import EmailTempaltesPage from '../pages/emailTemplatesPage';
import SearchEmailTemplatesPage from '../pages/emailTemplatesPage/SearchEmailTemplatesPage';
import ParticipationsPage from '../pages/ParticipationsPage/SearchParticipations';
import ConsumerBlockingPage from "../pages/ConsumerBlockingPage/ConsumerBlockingPage";
import CreateCurrencyPage from "../pages/CurrencyPage/CreateCurrencyPage";
import ROUTES from './Routes';
import ConsumerUnblockingSearchPage from "../pages/ConsumerUnblockingSearchPage/ConsumerUnblockingSearchPage";
import ConsumerUnblockingPage from "../pages/ConsumerUnblockingPage/ConsumerUnblockingPage";
import UploadDigitalCodesContainer from '../containers/UploadDigitalCodesContainer';
import AutoUploadDigitalCodesContainer from '../containers/AutoUploadDigitalCodesContainer';
import UploadReplicationPage from '../pages/UploadReplicationPage';
import DownloadReplicationPage from '../pages/DownloadReplicationPage';
import ExportParticipationsPage from '../pages/ExportParticipationsPage';
import BulkPrizeUploadContainer from '../containers/BulkPrizeUploadContainer';


const Router = () => (
    <Switch>
        <PrivateRoute exact path={ROUTES.index} component={HomePage} />
        <PrivateRoute exact path={ROUTES.home} component={HomePage} />
        <PrivateRoute exact path={ROUTES.prizes.add} component={PrizeFormPage} />
        <PrivateRoute exact path={ROUTES.prizes.addDigitalCodes} component={UploadDigitalCodesContainer} />
        <PrivateRoute exact path={ROUTES.prizes.addBulkDigitalCodes} component={AutoUploadDigitalCodesContainer}/>
        <PrivateRoute exact path={ROUTES.prizes.list} component={PrizesListContainer} />
        <PrivateRoute exact path={ROUTES.prizes.edit()} component={EditPrizeContainer} />
        <PrivateRoute exact path={ROUTES.prizes.search} component={SearchPrizePage} />
        <PrivateRoute exact path={ROUTES.prizes.edit()} component={NotFoundPage} />
        <PrivateRoute exact path={ROUTES.prizes.addBulkPrizes} component={BulkPrizeUploadContainer}/>
        <PrivateRoute exact path={ROUTES.prizes.editBulkPrizes} component={BulkPrizeUploadContainer}/>
        <PrivateRoute exact path={ROUTES.currencyAllocationRules.manage} component={CurrencyAllocationRulesPage} />
        <PrivateRoute exact path={ROUTES.promotions.add} component={PromotionPage} />
        <PrivateRoute exact path={ROUTES.configurations.add} component={ConfigurationPage} />
        <PrivateRoute exact path={ROUTES.configurations.search} component={SearchConfigurationPage} />
        <PrivateRoute exact path={ROUTES.configurations.edit()} component={EditConfigurationContainer} />
        <PrivateRoute exact path={ROUTES.configurations.edit()} component={NotFoundPage} />
        <PrivateRoute exact path={ROUTES.sdkConfigurations.add} component={SdkConfigurationPage} />
        <PrivateRoute exact path={ROUTES.sdkConfigurations.search} component={SearchSdkConfigurationPage} />
        <PrivateRoute exact path={ROUTES.promotions.search} component={SearchPromotionPage} />
        <PrivateRoute exact path={ROUTES.promotions.edit()} component={PromotionPage} />
        <PrivateRoute exact path={ROUTES.analysis.queryTable} component={AnalysisQueryTablePage} />
        <PrivateRoute exact path={ROUTES.winningMoments.upload} component={WinningMomentsPage} />
        <PrivateRoute exact path={ROUTES.winningMoments.generatePerPrize} component={GenerateWMPerPrizeContainer} />
        <PrivateRoute exact path={ROUTES.emailTemplates.add} component={EmailTempaltesPage} />
        <PrivateRoute exact path={ROUTES.emailTemplates.search} component={SearchEmailTemplatesPage} />
        <PrivateRoute exact path={ROUTES.emailTemplates.list} component={EmailTemplatesListContainer} />
        <PrivateRoute exact path={ROUTES.emailTemplates.edit()} component={EmailTempaltesPage} />
        <PrivateRoute exact path={ROUTES.participationsInformation.search} component={ParticipationsPage} />
        <PrivateRoute exact path={ROUTES.participations.export} component={ExportParticipationsPage} />
        <PrivateRoute exact path={ROUTES.consumerBlocking.add} component={ConsumerBlockingPage} />
        <PrivateRoute exact path={ROUTES.currencyCreation.add} component={CreateCurrencyPage} />
        <PrivateRoute exact path={ROUTES.consumerBlocking.search} component={ConsumerUnblockingSearchPage} />
        <PrivateRoute exact path={ROUTES.consumerBlocking.unblocked()} component={ConsumerUnblockingPage} />
        <PrivateRoute exact path={ROUTES.replication.download} component={DownloadReplicationPage} />
        <PrivateRoute exact path={ROUTES.replication.upload} component={UploadReplicationPage} />
        <PrivateRoute component={NotFoundPage} />
    </Switch>
);

export default Router;
