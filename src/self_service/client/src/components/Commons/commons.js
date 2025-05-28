import React from 'react';
import PropTypes from 'prop-types';
import { Avatar, Chip, Fab, withStyles, CircularProgress } from '@material-ui/core';
import CheckIcon from '@material-ui/icons/Check';

import styles from './styles';

let HeaderChip = ({ label, avatar, classes }) => (
    <>
        <Chip
            avatar={<Avatar>{avatar}</Avatar>}
            label={label}
            color="primary"
            className={classes.headerChip}
        />
    </>
);

HeaderChip.propTypes = {
    label: PropTypes.string.isRequired,
    avatar: PropTypes.string.isRequired
};


let CheckBtn = ({ status, handleOnClick, classes }) => {
    const isChecking = (status === 'Checking');
    const fabClass = isChecking ? 'fabNormal' : `fab${status}`;

    return (
        <div className={classes.fabWrapper}>
            <Fab
                color="primary"
                size="small"
                className={classes[fabClass]}
                onClick={handleOnClick}
            >
                <CheckIcon />
            </Fab>
            {isChecking &&
                <CircularProgress size={48} className={classes.fabProgress} />
            }
        </div>
    )

}
// valid statuses Normal, Checking, Fail, Ok
CheckBtn.propTypes = {
    status: PropTypes.oneOf([
        'Normal', 'Checking', 'Fail', 'Ok'
    ]),
    handleOnClick: PropTypes.func.isRequired,
    classes: PropTypes.object
};

HeaderChip = withStyles(styles)(HeaderChip);
CheckBtn = withStyles(styles)(CheckBtn);

export {
    HeaderChip,
    CheckBtn
};