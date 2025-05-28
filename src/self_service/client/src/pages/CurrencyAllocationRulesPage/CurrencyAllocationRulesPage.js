import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import Page from '../../components/Page';
import CurrencyAllocationRulesContainer from '../../containers/CurrencyAllocationRulesContainer';

const propTypes = {
    classes: PropTypes.object.isRequired
};

const styles = (theme) => ({
    container: {
        fontSize: 28,
        color: 'black',
        borderRadius: 10,
        border: '2px solid #f3f3f3',
        borderLeft: '10px solid #f44336',
        borderRight: '10px solid #f44336',
        width: 300,
        margin: 50,
        padding: 30
    }
});

const CurrencyAllocationRulesPage = ({ classes }) => (
    <Page>
        <Fragment>
            <CurrencyAllocationRulesContainer />
        </Fragment>
    </Page>
);

CurrencyAllocationRulesPage.propTypes = propTypes;

export default withStyles(styles)(CurrencyAllocationRulesPage);