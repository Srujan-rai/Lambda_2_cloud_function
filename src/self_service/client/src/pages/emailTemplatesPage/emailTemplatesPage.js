import React from 'react';
import Page from '../../components/Page';
import EmailTemplateContainer from '../../containers/EmailTemplatesContainer';

const EmailTempaltesPage = (props) => (
    <Page>
        <EmailTemplateContainer { ...props } />
    </Page>
);

export default EmailTempaltesPage;