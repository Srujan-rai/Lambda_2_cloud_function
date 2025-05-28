import React, { Fragment, Component }  from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import 'react-quill/dist/quill.snow.css';
import {TextValidator, ValidatorForm} from "react-material-ui-form-validator";
import {Avatar, Button, Chip, Typography} from '@material-ui/core';
import {styles} from '../../styles/styles'

const userId = "userId";
const configurationId = "configurationId";
const whoBlockedUser = "enteredById";
const whoRequestTheBlocking = "requestedById";
const reasonForBlocking = "reason";
const title = "title";

const propTypes = {
    data: PropTypes.shape({
        configurationId: PropTypes.string.isRequired,
        userId: PropTypes.string.isRequired,
        enteredById: PropTypes.string.isRequired,
        requestedById: PropTypes.string.isRequired,
        reason: PropTypes.string.isRequired,
        title: PropTypes.string
    }),
    classes: PropTypes.object.isRequired,
    onTextInputChange: PropTypes.func.isRequired,
    blockConsumer: PropTypes.func.isRequired
};

class ConsumerBlockingForm extends Component {

    render() {
        const {classes, data, onTextInputChange, blockConsumer} = this.props;
        return (
            <ValidatorForm  className={classes.container} autoComplete="off" onSubmit={event => blockConsumer(event)}>
             <Chip
                avatar={<Avatar>PR</Avatar>}
                label={"Block consumer"}
                color="primary"
                className={classes.chip}
            />
            <div className={classes.rowContainer}>
                <label className={classes.label}>
                <Typography variant="body2" gutterBottom>Configuration ID</Typography>
                </label>
                <TextValidator
                    autoFocus
                    id={configurationId}
                    name={configurationId}
                    className={classes.textField}
                    value={data.configurationId}
                    onChange={(event) => onTextInputChange(event)}
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
                        <Typography variant="body2" gutterBottom>User ID</Typography>
                    </label>
                    <TextValidator
                         autoFocus
                         id={userId}
                         name={userId}
                         value={data.userId}
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
                     <Typography variant="body2" gutterBottom>KOID of the person who has blocked the consumer</Typography>
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
                    <Typography variant="body2" gutterBottom>KOID of the person who requested the blocking of the consumer</Typography>
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
                    <label className={classes.label}>
                        <Typography variant="body2" gutterBottom>Title</Typography>
                    </label>
                    <TextValidator
                        autoFocus
                        id={title}
                        name={title}
                        value={data.title}
                        onChange={(event) => onTextInputChange(event)}
                        className={classes.textField}
                        margin="normal"
                        InputProps={{
                            disableUnderline: true
                        }}
                    />
                </div>
                <div className={classes.rowContainer}>
                    <label className={classes.label}>
                        <Typography variant="body2" gutterBottom>Reason for blocking</Typography>
                    </label>
                    <TextValidator
                        autoFocus
                        id={reasonForBlocking}
                        name={reasonForBlocking}
                        value={data.reason}
                        onChange={(event) => onTextInputChange(event)}
                        className={classes.textArea}
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

ConsumerBlockingForm.propTypes = propTypes;

export default withStyles(styles)(ConsumerBlockingForm);