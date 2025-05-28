
import React, { Component, Fragment } from 'react';
import { withStyles } from '@material-ui/core/styles';
import { Typography, Button, FormControlLabel, Checkbox, Paper, CircularProgress, Backdrop } from '@material-ui/core';
import { TextValidator, ValidatorForm } from 'react-material-ui-form-validator';
import styles from './styles';
import { HeaderChip } from '../Commons';
class DownloadReplicationForm extends Component {
    render() {
        const { store, classes, onCheckboxChange, onTextInputChange, onSubmit } = this.props;

        return (
            <Fragment>
                <Paper>
                    <Backdrop className={classes.backdrop} open={store.spinnerEnabled}>
                        <CircularProgress color="inherit" />
                    </Backdrop>
                    <HeaderChip
                        label='Download Replicaiton Package'
                        avatar='DRP'
                        classes={{ headerChip: classes.mainChip }} />

                    <ValidatorForm className={classes.container} autoComplete="off" onSubmit={event => onSubmit(event)}>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Configuration ID</Typography>
                            </label>
                            <TextValidator
                                autoFocus
                                id='configurationId'
                                name='configurationId'
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
                            />
                            <div className={classes.checkboxCtnr}>
                                <div className={classes.rowContainer}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={store.allocationRules}
                                                onChange={onCheckboxChange}
                                                name="allocationRules"
                                            />
                                        }
                                        label="Allocation rules"
                                    />
                                </div>
                            </div>
                            <div className={classes.checkboxCtnr}>
                                <div className={classes.rowContainer}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={store.prizeData}
                                                onChange={onCheckboxChange}
                                                name="prizeData"
                                            />
                                        }
                                        label="Prizes data"
                                    />
                                </div>
                            </div>
                            <div className={classes.checkboxCtnr}>
                                <div className={classes.rowContainer}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={store.currencies}
                                                onChange={onCheckboxChange}
                                                name="currencies"
                                            />
                                        }
                                        label="Currencies"
                                    />
                                </div>
                            </div>
                        </div>
                        <Button type="submit" variant="contained" className={classes.button}>Download Package</Button>
                    </ValidatorForm>
                </Paper>
            </Fragment>
        );
    }
};

export default withStyles(styles)(DownloadReplicationForm);                            