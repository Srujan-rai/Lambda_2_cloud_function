import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import Page from '../../components/Page';
import DownloadReplicationContainer from '../../containers/DownloadReplicationContainer';

const propTypes = {
    classes: PropTypes.object.isRequired
};

const styles = () => ({});

const DownloadReplicationPage = (props) => {
    return (
        <Page>
            <Fragment>
                <DownloadReplicationContainer {...props} />
            </Fragment>
        </Page>
    );
};

DownloadReplicationPage.propTypes = propTypes;

export default withStyles(styles)(DownloadReplicationPage);