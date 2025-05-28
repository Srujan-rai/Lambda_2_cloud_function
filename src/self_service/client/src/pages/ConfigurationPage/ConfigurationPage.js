import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import Page from '../../components/Page';
import ConfigurationContainer from '../../containers/ConfigurationContainer';

const propTypes = {
    classes: PropTypes.object.isRequired
};

const styles = () => ({});

const ConfigurationPage = () => (
    <Page>
        <Fragment>
            <ConfigurationContainer />
        </Fragment>
    </Page>
);

ConfigurationPage.propTypes = propTypes;

export default withStyles(styles)(ConfigurationPage);