import React from 'react';
import Page from '../../components/Page';
import ConsumerUnblockingContainer from "../../containers/ConsumerUnblockingContainer";

const ConsumerUnblockingPage = ({match}) => {
    return (
        <Page>
            <ConsumerUnblockingContainer match={match}/>
        </Page>
    );
};

export default (ConsumerUnblockingPage);