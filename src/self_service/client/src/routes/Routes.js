const ROUTES = {
    login: '/login',
    index: '/',
    home: '/home',
    details: '/details',
    settings: '/settings',
    prizes: {
        add: '/prizes/add',
        addDigitalCodes: '/prizeDigitalCodes/add',
        addBulkDigitalCodes: '/prizeBulkDigitalCodes/add',
        addBulkPrizes: '/bulkPrizeUpload/add',
        editBulkPrizes: '/bulkPrizes/edit',
        list: '/prizes',
        search: '/prizes/search',
        edit: prizeId => !prizeId ? '/prizes/:prizeId/edit' : `/prizes/${prizeId}/edit`
    },
    configurations: {
        add: '/configurations/add',
        search: '/configurations/search',
        edit: configurationId => !configurationId ? '/configurations/:configurationId/edit' : `/configurations/${configurationId}/edit`
    },
    sdkConfigurations: {
        add: '/sdkConfigurations/add',
        search: '/sdkConfigurations/search',
        edit: fileName => !fileName ? '/sdkConfigurations/:fileName/edit' : `/sdkConfigurations/${fileName}/edit`
    },
    currencyAllocationRules: {
        manage: '/currency-allocation-rules',
        edit: '/currency-allocation-rules/edit'
    },
    promotions: {
        add: '/promotions/add',
        search: '/promotions/search',
        edit: promotionId => !promotionId ? '/promotions/:promotionId/edit' : `/promotions/${promotionId}/edit`
    },
    analysis: {
        queryTable: '/analysis/queryTable'
    },
    winningMoments: {
        upload: '/winnings-moments/upload',
        generatePerPrize: '/winnings-moments/perprize'
    },
    emailTemplates: {
        add: '/email-templates/add',
        search: '/email-templates/search',
        list: '/email-templates/list',
        edit: templateId => !templateId ? '/email-templates/:templateId/edit' : `/email-templates/${templateId}/edit`
    },
    participationsInformation: {
        search: '/participations-info/search'
    },
    participations: {
        export: '/participations/export'
    },
    consumerBlocking: {
        add: '/consumer-blocking',
        search: '/consumer-blocking/search',
        unblocked: params => !params ? '/consumer-unblocking/:userId/:configurationId' : `/consumer-unblocking/${params.userId}/${params.configurationId}`
    },
    currencyCreation: {
        add: '/currency-creation'
    },
    replication: {
        download: '/replication/download',
        upload: '/replication/upload'
    }
};

export default ROUTES;
