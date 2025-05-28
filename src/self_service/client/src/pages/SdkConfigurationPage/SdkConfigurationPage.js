import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import Page from '../../components/Page';
import SdkConfigurationContainer from '../../containers/SdkConfigurationContainer';

const propTypes = {
    classes: PropTypes.object.isRequired
};

const styles = () => ({});

const SdkConfigurationPage = () => (
    <Page>
        <Fragment>
            <SdkConfigurationContainer />
        </Fragment>
    </Page>
);

SdkConfigurationPage.propTypes = propTypes;

export default withStyles(styles)(SdkConfigurationPage);