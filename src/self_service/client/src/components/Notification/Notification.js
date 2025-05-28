import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { Avatar, Card, CardHeader, CardMedia, CardContent } from '@material-ui/core';
import { Close as CloseIcon } from '@material-ui/icons';

const propTypes = {
    classes: PropTypes.object.isRequired,
    info: PropTypes.object.isRequired
};

const styles = theme => ({
    container: {
        width: "80%",
        border: "3px solid transparent",
        padding: "10px",
        fontSize: 28,
        borderRadius: "10px",
        textAlign: "center",
        color:"white",
        position: "fixed",
        top: 100,
        right: "5%",
        minHeight:"100px", 
        boxShadow: "4px 4px #C0C0C0",
        animation: "move 5s infinite",
        maxWidth: "250px",
        minWidth: "190px",
    },
    card: {
        margin: '15px 0 0 15px'
    },
    avatar: {
        backgroundColor: "transparent",
        position: "absolute",
        left: "5px",
        top: "0px"
    },
    title: {
        position: "absolute",
        color: "white",
        top: "10px",
        left: "50px"
    },
    message: {
        position: "absolute",
        color: "white",
        top: "40px",
        fontSize: "15px",
        left: "10px"
    },
    closeIcon: {
        color: "white",
        cursor: "pointer",
        position: "relative",
        top: -17,
        right: -10
    }
});

const Notification = ({ classes, info, title, message, visible, hide, disableAutoHide }) => {
    const status = visible ? 'block' : 'none';
    return (
        <Fragment>
            <Card style={{ backgroundColor: info.color, display: `${status}` }} className={classes.container}>
                <CardHeader
                    avatar={<Avatar aria-label="Recipe" className={classes.avatar}>{info.icon}</Avatar>}
                    title={
                        <div className={classes.title}>
                            <span>{title}</span>
                        </div>
                    }
                    action={
                        <CloseIcon className={classes.closeIcon} onClick={() => hide()} />
                    }
                />
                <CardContent>
                    <div className={classes.message}>
                        <span>{message}</span>
                    </div>
                </CardContent>
            </Card>
        </Fragment> 
    );
}

Notification.propTypes = propTypes;

export default withStyles(styles)(Notification);