import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { Typography } from '@material-ui/core';
import Page from '../../components/Page';

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

const NotFoundPage = ({ classes }) => (
    <Page>
        <Fragment>
            <div className={classes.container}>
                <Typography variant="h3">404</Typography>
                <Typography variant="h6">Page Not Found</Typography>
            </div>
        </Fragment>
    </Page>
);

NotFoundPage.propTypes = propTypes;

export default withStyles(styles)(NotFoundPage);