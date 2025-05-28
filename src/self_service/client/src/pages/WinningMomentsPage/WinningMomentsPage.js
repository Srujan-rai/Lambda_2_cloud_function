import React from 'react';
import {Avatar, Chip, Paper} from '@material-ui/core';
import {withStyles} from '@material-ui/core/styles';

import WinningMomentsContainer from '../../containers/WinningMomentsContainer';
import Page from '../../components/Page';

const styles = {
    paper: {
        paddingBottom: 30,
    },
    chip: {
        marginTop: 30,
        marginLeft: 50,
    },
};

const WinningMomentsPage = ({classes}) => (
    <Page>
        <Paper className={classes.paper}>
            <Chip
                avatar={<Avatar>PR</Avatar>}
                className={classes.chip}
                label="Winning Moments"
                color="primary"
            />
            <WinningMomentsContainer />
        </Paper>
    </Page>
);

export default withStyles(styles)(WinningMomentsPage);
