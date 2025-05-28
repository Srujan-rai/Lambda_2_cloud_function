import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { MenuList } from '@material-ui/core';
import AppMenuItem from '../AppMenuItem';

const propTypes = {
    actions: PropTypes.arrayOf(PropTypes.shape({
        name: PropTypes.string.isRequired,
        route: PropTypes.string.isRequired,
        icon: PropTypes.node
    })).isRequired,
    classes: PropTypes.object.isRequired
};

const styles = (theme) => ({});

const renderActions = actions => {
    return actions.map((action, index) => (
        <AppMenuItem
            key={`${action.name}-${index}`}
            label={action.name}
            to={action.route}
            icon={action.icon}
        />
    ));
};

const MenuItems = ({ actions }) => {
    return (
        <Fragment>
            <MenuList>
                {renderActions(actions)}
            </MenuList>
        </Fragment>
    );
};

MenuItems.propTypes = propTypes;

export default withStyles(styles)(MenuItems);