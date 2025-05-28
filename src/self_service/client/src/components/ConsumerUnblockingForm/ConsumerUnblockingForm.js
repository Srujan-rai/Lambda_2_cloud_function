import React, { Component }  from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import {TextValidator, ValidatorForm} from "react-material-ui-form-validator";
import {Avatar, Button, Chip, Typography} from '@material-ui/core';
import {styles} from '../../styles/styles'

const userId = "userId";
const whoBlockedUser = "enteredById";
const whoRequestTheBlocking = "requestedById";

const propTypes = {
    data: PropTypes.shape({
        gppUserId: PropTypes.string.isRequired,
        configurationId: PropTypes.string.isRequired,
        enteredById: PropTypes.string.isRequired,
        requestedById: PropTypes.string.isRequired,
    }),
    classes: PropTypes.object.isRequired,
    unblockedConsumer: PropTypes.func.isRequired,
    onTextInputChange: PropTypes.func.isRequired
};


class ConsumerUnblockingForm extends Component {

    render() {
        const {classes, data, onTextInputChange, unblockedConsumer} = this.props;

        return (
            <ValidatorForm  className={classes.container} autoComplete="off" onSubmit={event => unblockedConsumer(event)}>
                <Chip
                    avatar={<Avatar>PR</Avatar>}
                    label={"Unblocked consumer"}
                    color="primary"
                    className={classes.chip}
                />
                <div className={classes.rowContainer}>
                    <label className={classes.label}>
                        <Typography variant="body2" gutterBottom>User ID</Typography>
                    </label>
                    <TextValidator
                        autoFocus
                        id={userId}
                        name={userId}
                        value={data.gppUserId}
                        disabled
                        onChange={(event) => onTextInputChange(event)}
                        className={classes.textField}
                        margin="normal"
                        required
                        validators={['required']}
                        errorMessages={['This field is required']}
                        InputProps={{
                            disableUnderline: true
                        }}
                    />
                </div>
                <div className={classes.rowContainer}>
                    <label className={classes.label}>
                        <Typography variant="body2" gutterBottom>Configuration ID</Typography>
                    </label>
                    <TextValidator
                        autoFocus
                        id={userId}
                        name={userId}
                        value={data.configurationId}
                        disabled
                        onChange={(event) => onTextInputChange(event)}
                        className={classes.textField}
                        margin="normal"
                        required
                        validators={['required']}
                        errorMessages={['This field is required']}
                        InputProps={{
                            disableUnderline: true
                        }}
                    />
                </div>
                <div className={classes.rowContainer}>
                    <label className={classes.label}>
                        <Typography variant="body2" gutterBottom>KOID of the person who has unblocked the consumer</Typography>
                    </label>
                    <TextValidator
                        autoFocus
                        id={whoBlockedUser}
                        name={whoBlockedUser}
                        value={data.enteredById}
                        onChange={(event) => onTextInputChange(event)}
                        className={classes.textField}
                        margin="normal"
                        required
                        validators={['required']}
                        errorMessages={['This field is required']}
                        InputProps={{
                            disableUnderline: true
                        }}
                    />
                </div>
                <div className={classes.rowContainer}>
                    <label className={classes.label}>
                        <Typography variant="body2" gutterBottom>KOID of the person who requested the unblocking of the consumer</Typography>
                    </label>
                    <TextValidator
                        autoFocus
                        id={whoRequestTheBlocking}
                        name={whoRequestTheBlocking}
                        value={data.requestedById}
                        onChange={(event) => onTextInputChange(event)}
                        className={classes.textField}
                        margin="normal"
                        required
                        validators={['required']}
                        errorMessages={['This field is required']}
                        InputProps={{
                            disableUnderline: true
                        }}
                    />
                </div>
                <div className={classes.rowContainer}>
                    <Button type="submit" variant="contained" className={classes.button}>Save</Button>
                </div>
            </ValidatorForm>
        );
    };
};

ConsumerUnblockingForm.propTypes = propTypes;

export default withStyles(styles)(ConsumerUnblockingForm);