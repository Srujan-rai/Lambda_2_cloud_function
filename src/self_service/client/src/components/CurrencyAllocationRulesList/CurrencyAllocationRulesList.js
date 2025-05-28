import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core';
import AppTable from '../AppTable';

const propTypes = {
    /** Table header for currency allocation rules columns */
    header: PropTypes.arrayOf(PropTypes.string).isRequired,
    /** Currency Allocation Rules items that should be displayed by the table  */
    rows: PropTypes.arrayOf(PropTypes.object),
    /** @ignore */
    classes: PropTypes.object.isRequired
};

const defaultProps = {};

const styles = {
    table1: {
        width: "80%",
        border: "5px solid blue"
    }
};

const CurrencyAllocationRulesList = ({ header, rows, classes }) => {
    return (
        <Fragment>
            <AppTable
                header={header}
                rows={rows}
                className={classes.table1}
            />
        </Fragment>
    );
};

CurrencyAllocationRulesList.propTypes = propTypes;
CurrencyAllocationRulesList.defaultProps = defaultProps;

export default withStyles(styles)(CurrencyAllocationRulesList);
