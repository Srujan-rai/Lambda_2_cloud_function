import React from 'react';
import Page from '../../components/Page';
import ConsumerUnblockingContainer from "../../containers/ConsumerUnblockingSearchContainer";

const ConsumerUnblockingSearchPage = ({history}) => {
    return (
        <Page>
            <ConsumerUnblockingContainer history={history}/>
        </Page>
    );
};

export default (ConsumerUnblockingSearchPage);