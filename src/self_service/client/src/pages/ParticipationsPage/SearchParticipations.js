import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import Page from '../../components/Page';
import ParticipationsInfoContainer from '../../containers/ParticipationsInfoContainer';

const propTypes = {
    classes: PropTypes.object.isRequired
};

const styles = () => ({});

const searchParticipations = () => {
    return (
        <Page>
           <ParticipationsInfoContainer/>
        </Page>
    );
};

searchParticipations.propTypes = propTypes;

export default withStyles(styles)(searchParticipations);