import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core';
import AppTable from '../AppTable';

const propTypes = {
    /** Table header for prize catalogue columns */
    header: PropTypes.object.isRequired,
    /** Prize catalogue items that should be displayed by the table  */
    rows: PropTypes.arrayOf(PropTypes.object),
    /** @ignore */
    classes: PropTypes.object.isRequired
};

const defaultProps = {};

const styles = {};

const PrizesList = ({ header, rows, classes }) => {
    return (
        <Fragment>
            <AppTable header={header} rows={rows} />
        </Fragment>
    );
};

PrizesList.propTypes = propTypes;
PrizesList.defaultProps = defaultProps;

export default withStyles(styles)(PrizesList);
