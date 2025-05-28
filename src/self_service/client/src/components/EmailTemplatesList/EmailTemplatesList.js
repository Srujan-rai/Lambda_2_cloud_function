import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core';
import AppTable from '../AppTable';

const propTypes = {
    header: PropTypes.object.isRequired,
    rows: PropTypes.arrayOf(PropTypes.object),
    classes: PropTypes.object.isRequired
};

const defaultProps = {};

const styles = {};

const EmailTemplatesList = ({ header, rows, classes }) => {
    return (
        <AppTable header={header} rows={rows} />
    );
};

EmailTemplatesList.propTypes = propTypes;
EmailTemplatesList.defaultProps = defaultProps;

export default withStyles(styles)(EmailTemplatesList);
