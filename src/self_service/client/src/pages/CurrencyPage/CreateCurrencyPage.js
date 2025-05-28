import React from 'react';
import Page from '../../components/Page';
import CreateCurrencyContainer from '../../containers/CreateCurrencyContainer';

const CreateCurrencyPage = (props) => (
    <Page>
        <CreateCurrencyContainer { ...props } />
    </Page>
);

export default CreateCurrencyPage;