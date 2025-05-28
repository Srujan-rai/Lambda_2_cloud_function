import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import Page from '../../components/Page';
import QueryTableContainer from '../../containers/QueryTableContainer';

const propTypes = {
    classes: PropTypes.object.isRequired
};

const styles = () => ({});

const AnalysisQueryTablePage = () => {
    return (
        <Page>
            <QueryTableContainer />
        </Page>
    );
};

AnalysisQueryTablePage.propTypes = propTypes;

export default withStyles(styles)(AnalysisQueryTablePage);