const { queryByParticipationId, addItemToParticipation } = require('../../database/participationsDatabase');
const { fetchWithCache, createInvalidError, getConfiguration } = require('./helpers');
const { CONFIGURATION_FUNCTIONS_MAP: { sendMessage } } = require('../../constants/lambdas');
const { PARAMS_MAP: { MESSAGE_BODY } } = require('../../constants/common');
const { RS_TRANSACTION_STATUSES } = require('../../constants/plugins');

const getParticipationItem = async (participationId) => {
    const participationResult = await fetchWithCache(
        participationId,
        async (partId) => queryByParticipationId(partId),
        true,
        300000,
    );
    const participationItem = participationResult[0];
    if (!participationItem) {
        throw createInvalidError('Participation item not found');
    }
    return participationItem;
};

const rsEventProcessor = {
    functionName: sendMessage,
    getConfig: async (event) => {
        const { externalId: participationId } = event;
        try {
            const participationItem = await getParticipationItem(participationId);
            const configuration = await getConfiguration(participationItem.configuration_id);
            return configuration;
        } catch (err) {
            console.error('ERROR while getting config:', err);
            throw err;
        }
    },
    preProcess: async (event) => {
        const { externalId: participationId } = event;
        const participationItem = await getParticipationItem(participationId);
        if (participationItem && participationItem.status !== 'processing') {
            throw createInvalidError('Event message already processed');
        }
    },
    payload: async (event, configuration) => {
        const { externalId: participationId, transactionStatus, applicableProducts } = event;
        if (transactionStatus === RS_TRANSACTION_STATUSES.PROCESSED && applicableProducts?.length) {
            const participationItem = await getParticipationItem(participationId);
            const [userId] = event.user.userId.split('|');
            return {
                [MESSAGE_BODY]: {
                    context: {
                        url: `${configuration.pluginParams.url}?participationId=${participationId}`,
                        participationId,
                    },
                    template: configuration.pluginParams.emailTemplateId,
                    recipient: userId,
                    channel: 'email',
                    provider: 'ajo',
                },
                envDetails: participationItem.message_meta,
            };
        }
        console.log(`Payload cannot be created. Transacation status is: ${transactionStatus}`);
        // a case for invalid receipt to be added and for not applicable products
    },
    postProcess: async (event, configuration) => {
        const { externalId: participationId, transactionStatus, applicableProducts } = event;
        const status = (transactionStatus === RS_TRANSACTION_STATUSES.PROCESSED && applicableProducts?.length) ? 'awaitsuser' : 'complete';
        const { configurationId } = configuration;
        const participationItem = await getParticipationItem(participationId);
        const { request_id: requestId, gpp_user_id: gppUserId } = participationItem;
        return addItemToParticipation(
            { gppUserId, configurationId },
            requestId,
            { pluginOutput: event, emailSent: true, status },
        );
    },
};

module.exports = { rsEventProcessor };
