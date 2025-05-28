import React, { Component, Fragment } from "react";
import { withStyles, Chip, Avatar, Paper, Divider, Backdrop, CircularProgress, Typography, Button } from "@material-ui/core";
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import DatePicker from "react-datepicker";
import { ValidatorForm, TextValidator } from "react-material-ui-form-validator";
import { prepareDateTimePickerParams } from '../../helpers/utils';

import styles from "./styles";

class exportParticipationsForm extends Component {
  render() {
    const { store, classes, onDateTimeChange, onTextInputChange, onSubmit, onConfigurationSearch, startDate, endDate } = this.props;
return (
    <Fragment>
        <Backdrop className={classes.backdrop} open={store.spinnerEnabled}>
            <CircularProgress color="inherit" />
        </Backdrop>
        <Paper className={classes.paper}>
            <ValidatorForm
            className={classes.root}
            autoComplete="off"
            onSubmit={event => onSubmit(event)}
            >
            <Chip
                avatar={<Avatar>PI</Avatar>}
                label="Export Participations"
                color="primary"
                className={classes.chip}
            />
            <div className={classes.rowContainer}>
                <label className={classes.label}>
                    <Typography variant="body2" gutterBottom>Configuration Id</Typography>
                </label>
                <TextValidator
                    name={'configurationId'}
                    className={classes.textField}
                    value={store.configurationId}
                    onChange={(event) => onTextInputChange(event)}
                    margin="normal"
                    required
                    validators={['required']}
                    errorMessages={['This field is required']}
                    InputProps={{
                        disableUnderline: true
                    }}
                    inputProps={{
                        minLength: 5,
                        maxLength: 200
                    }}
                />
                <Button type="button" className={classes.buttonDateFill} variant="contained"onClick={onConfigurationSearch}>Auto-fill Dates</Button>
            </div>
            <div className={classes.rowContainer2}>
                    <label className={classes.label}>
                        <Typography variant="body2" gutterBottom>start date</Typography>
                    </label>
                    <DatePicker
                        selected={new Date(store.startDate)}
                        onChange={(value) => onDateTimeChange(prepareDateTimePickerParams("startDate", value))}
                        showTimeSelect
                        dateFormat="MM/dd/yyyy h:mm aa"
                        className={`${classes.textField} ${classes.dateField}`}
                        calendarClassName={classes.calendarField}
                    />
                    {store.messages && !!store.messages.configurationStartUtc &&
                        <div className={classes.messages}>
                            {store.messages.configurationStartUtc}
                        </div>
                    }
            </div>
            <div className={classes.rowContainer2}>
                <label className={classes.label}>
                    <Typography variant="body2" gutterBottom>End date</Typography>
                </label>
                <DatePicker
                    selected={new Date(store.endDate)}
                    onChange={(value) => onDateTimeChange(prepareDateTimePickerParams("endDate", value))}
                    showTimeSelect
                    dateFormat="MM/dd/yyyy h:mm aa"
                    className={`${classes.textField} ${classes.dateField}`}
                    calendarClassName={classes.calendarField}
                    minDate={new Date()}
                />   
            </div>
            <div className={classes.buttonContainer}>
                    <Button type="submit" variant="contained" className={classes.button}>Export</Button>
            </div>
            {(store.fileLink) &&
                        <div className={classes.downloadInfo}>
                            <Divider style={{ marginTop: "1.5rem" }} />
                            <Typography className={classes.wrapIcon} variant="body2" gutterBottom style={{ marginTop: "1rem" }}>
                                <InfoOutlinedIcon fontSize="small" />
                                <span style={{ marginLeft: 5 }}>
                                    Click "Download" to download csv file with participations for this time period".
                                </span>
                            </Typography>
                            <div style={{ marginTop: "1rem" }}>
                                <Button variant="contained" style={{ color: "blue" }} href={store.fileLink} on>
                                    Download
                                </Button>
                            </div>
                        </div>
                    }     
            </ValidatorForm>
        </Paper>
    </Fragment>
    );
  }
}

export default withStyles(styles)(exportParticipationsForm);