import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core';
import { Link } from 'react-router-dom';
import { MenuItem, ListItemIcon, ListItemText } from '@material-ui/core';

const propTypes = {
    /** Path to which user will be navigated upon clicking */
    to: PropTypes.string.isRequired,
    /** Label to display on the list item */
    label: PropTypes.string.isRequired,
    /** Icon to display next to the label */
    icon: PropTypes.node
};

const defaultProps = {
    icon: null
};

const styles = theme => ({});

/**
 * Renders an item which can be used in menus and dropdowns 
 */
const AppMenuItem = ({ to, icon, label }) => {
    return (
        <MenuItem button component={Link} to={to}>
            {icon && (<ListItemIcon>{icon}</ListItemIcon>)}
            <ListItemText>{label}</ListItemText>
        </MenuItem>
    );
};

AppMenuItem.propTypes = propTypes;
AppMenuItem.defaultProps = defaultProps;

export default withStyles(styles)(AppMenuItem);