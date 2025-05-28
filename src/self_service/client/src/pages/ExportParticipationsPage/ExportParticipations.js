import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import Page from '../../components/Page';
import ExportParticipationsContainer from '../../containers/ExportParticipationsContainer';

const propTypes = {
    classes: PropTypes.object.isRequired
};

const styles = () => ({});

const exportParticipations = () => {
    return (
        <Page>
           <ExportParticipationsContainer/>
        </Page>
    );
};

export default withStyles(styles)(exportParticipations);