import React from 'react';
import ROUTES from '../routes/Routes';
import { Add as AddIcon, Edit as EditIcon, List as ListIcon, PlaylistAdd as PlaylistAddIcon, QueryBuilder as QueryIcon, CloudDownload as DownloadIcon, CloudUpload as UploadIcon} from '@material-ui/icons';
//TODO Improve route - links defining and handling after implementing React Router features
const links = {
    prizes: [
        { name: "Add New Prize", route: ROUTES.prizes.add, icon: <AddIcon /> },
        { name: "Add vouchers", route: ROUTES.prizes.addDigitalCodes, icon: <AddIcon /> },
        { name: "List Prizes", route: ROUTES.prizes.list, icon: <ListIcon /> },
        { name: "Edit Prize", route: ROUTES.prizes.search, icon: <EditIcon /> },
        { name: "Add Bulk Vouchers", route: ROUTES.prizes.addBulkDigitalCodes, icon: <AddIcon />},
        { name: "Add Prizes via Bulk Upload", route: ROUTES.prizes.addBulkPrizes, icon: <AddIcon />},
        { name: "Update Bulk Prizes", route: ROUTES.prizes.editBulkPrizes, icon: <EditIcon />}
    ],
    configurations: [
        { name: "Add New Configuration", route: ROUTES.configurations.add, icon: <AddIcon /> },
        { name: "Add New Js Sdk Configuration", route: ROUTES.sdkConfigurations.add, icon: <AddIcon /> },
        { name: "Edit Configuration", route: ROUTES.configurations.search, icon: <EditIcon /> },
        { name: "Edit Js Sdk Configuration", route: ROUTES.sdkConfigurations.search, icon: <EditIcon /> },
    ],
    currencyAllocationRules: [
        { name: "Mixcodes Allocation Rules", route: ROUTES.currencyAllocationRules.manage, icon: <PlaylistAddIcon /> }
    ],
    promotions: [
        { name: "Add New Promotion", route: ROUTES.promotions.add, icon: <AddIcon /> },
        { name: "Edit Promotion", route: ROUTES.promotions.search, icon: <EditIcon /> }
    ],
    analysis: [
        { name: "Query Table", route: ROUTES.analysis.queryTable, icon: <QueryIcon />}
    ],
    winningMoments: [
        { name: "Upload Winning Moments", route: ROUTES.winningMoments.upload, icon: <UploadIcon /> },
        { name: "Generate Winning Moments per Prize", route: ROUTES.winningMoments.generatePerPrize, icon: <AddIcon />}
    ],
    emailTemplates: [
        { name: "Add New Template", route: ROUTES.emailTemplates.add, icon: <AddIcon /> },
        { name: "List Templates", route: ROUTES.emailTemplates.list, icon: <ListIcon /> },
        { name: "Edit Template", route: ROUTES.emailTemplates.search, icon: <EditIcon /> }
    ],
    participationsInformation: [
        { name: "Search by Pincode", route: ROUTES.participationsInformation.search + "?type=pincode", icon: <AddIcon /> },
        { name: "Search by User ID", route: ROUTES.participationsInformation.search + "?type=user-id", icon: <AddIcon /> },
        { name: "Search by Configuration ID", route: ROUTES.participationsInformation.search + "?type=configuration-id", icon: <AddIcon /> },
        { name: "Search by Voucher", route: ROUTES.participationsInformation.search + "?type=digital-voucher", icon: <AddIcon /> },
        { name: "Export participations", route: ROUTES.participations.export, icon: <AddIcon /> }
    ],
    consumerBlocking: [
        { name: "Block consumer", route: ROUTES.consumerBlocking.add, icon: <AddIcon /> },
        { name: "Search blocked consumer", route: ROUTES.consumerBlocking.search, icon: <AddIcon /> }
    ],
    currencyCreation: [
        { name: "Create currency", route: ROUTES.currencyCreation.add, icon: <AddIcon /> }
    ],
    replication: [
        { name: "Download Replication", route: ROUTES.replication.download, icon: <DownloadIcon /> },
        { name: "Upload Replication", route: ROUTES.replication.upload, icon: <UploadIcon /> }
    ],

    getPrizesLinks() {
        return links.prizes;
    },
    getConfigurationsLinks() {
        return links.configurations;
    },
    getCurrencyAllocationRulesLinks() {
        return links.currencyAllocationRules;
    },
    getPromotionsLinks() {
        return links.promotions;
    },
    getAnalysisLinks() {
        return links.analysis;
    },
    getWinningMomentsLinks() {
        return links.winningMoments;
    },
    getEmailTemplatesLinks() {
        return links.emailTemplates;
    },
    getParticipationsLinks() {
        return links.participationsInformation;
    },
    getConsumerBlockingLinks() {
        return links.consumerBlocking;
    },
    getCurrencyCreationLinks() {
        return links.currencyCreation;
    },
    getReplicationLinks() {
        return links.replication;
    }
};

export default links;
