import React, { Component } from 'react';
import Page from '../../components/Page';
import UploadReplicationContainer from '../../containers/UploadReplicationContainer';

class UploadReplicationPage extends Component {
    render() {
        return (
            <Page>
                <UploadReplicationContainer />
            </Page>
        );
    }
};

export default UploadReplicationPage;