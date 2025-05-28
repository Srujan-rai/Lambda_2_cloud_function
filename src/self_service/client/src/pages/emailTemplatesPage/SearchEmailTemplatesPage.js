import React from 'react';
import Page from '../../components/Page';
import SearchEmailTemplatesContainer from '../../containers/SearchEmailTemplatesContainer';

const SearchEmailTempaltesPage = (props) => (
    <Page>
        <SearchEmailTemplatesContainer {...props.match} />
    </Page>
);

export default SearchEmailTempaltesPage;