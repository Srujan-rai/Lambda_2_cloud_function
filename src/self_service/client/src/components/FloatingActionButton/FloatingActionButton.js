import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core';
import { Fab, Tooltip } from '@material-ui/core';
import { Add as AddIcon } from '@material-ui/icons';

const propTypes = {
    /** Size of the button */
    size: PropTypes.oneOf(['small', 'medium', 'large']),
    /** Tooltip text to display on mouseover event */
    title: PropTypes.string.isRequired,
    /** Colour of the button - use theme colours */
    color: PropTypes.string,
    /** Aria label text */
    label: PropTypes.string,
    /** Icon component to be displayed on button */
    icon: PropTypes.node,
    /** Callback function that adds behaviour to the button when clicked */
    onClick: PropTypes.func,
    /** @ignore */
    classes: PropTypes.object.isRequired
};

const defaultProps = {
    size: "large",
    color: "primary",
    label: "Add",
    icon: <AddIcon />,
    onClick: null,
    style: null
};

const styles = {
    floatingActionButton: {
        position: "fixed",
        right: 30,
        bottom: 30
    }
};

const FloatingActionButton = ({ classes, style, size, title, color, label, icon, onClick }) => (
    <Tooltip title={title}>
        <Fab size={size} color={color} aria-label={label} className={!style ? classes.floatingActionButton : style} onClick={onClick}>
            {icon}
        </Fab>
    </Tooltip>
);

FloatingActionButton.propTypes = propTypes;
FloatingActionButton.defaultProps = defaultProps;

export default withStyles(styles)(FloatingActionButton);
