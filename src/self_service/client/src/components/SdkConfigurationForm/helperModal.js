import React, { Component } from "react";
import { withStyles } from '@material-ui/core/styles';
import { ValidatorForm, TextValidator } from 'react-material-ui-form-validator';
import { Button, Checkbox, Typography, FormControlLabel } from '@material-ui/core';
import styles from "./styles";
import { COMMON_ERR, MIXCODES_ERR, SDK_RESPONSE, DETAILED_PRIZE_VIEW } from "@the-coca-cola-company/ngps-global-common-messages"
class SdkHelperModal extends Component {
    render() {
        const {
            classes, onModalSubmit, modalState, onModalParameterChange, fieldType, handleRequiredTextField, onMappingModalSubmit
        } = this.props;

        const modalMap = {
            errMapping: {
                errors: {
                    ...COMMON_ERR,
                    ...MIXCODES_ERR,
                }
            },
            responseMapping: {
                errors: {
                    ...SDK_RESPONSE,
                }
            },
            detailedPrizeView: {
                errors: {
                    ...DETAILED_PRIZE_VIEW,
                }
            },
        };
        if (modalState.name) {
            const MESSAGES = modalMap[modalState.name]?.errors
            if (MESSAGES) {
                let form = Object.keys(MESSAGES).map(message => {
                    return <div key={message}>
                        <label className={classes.label}>
                            <Typography variant="body2" gutterBottom>{MESSAGES[message]}</Typography>
                        </label>
                        <TextValidator
                            name={MESSAGES[message]}
                            onChange={(event) => onModalParameterChange(event)}
                            fullWidth
                            value={modalState[MESSAGES[message]]?.default}
                            className={classes.textWrapper}
                            InputProps={{
                                disableUnderline: true,
                                className: classes.textField
                            }}
                        />
                    </div>
                });
                return (
                    <ValidatorForm autoComplete="off" onSubmit={onMappingModalSubmit}>
                        {form}
                        <div className={classes.buttonContainer}>
                            <Button type="submit" variant="contained" className={classes.modalButton}>Save</Button>
                        </div>
                    </ValidatorForm>
                )
            }
        }

        return (
            <ValidatorForm autoComplete="off" onSubmit={event => onModalSubmit(event)}>
                <div>
                    <label className={classes.label}>
                        <Typography variant="body2" gutterBottom>Field Label</Typography>
                    </label>
                    <TextValidator
                        name="label"
                        onChange={(event) => onModalParameterChange(event)}
                        fullWidth
                        value={modalState.label.default}
                        className={classes.textWrapper}
                        validators={['required']}
                        errorMessages={['This field is required']}
                        InputProps={{
                            disableUnderline: true,
                            className: classes.textField
                        }}
                    />
                </div>
                {fieldType == "text" &&
                    <div>
                        <label className={classes.label}>
                            <Typography variant="body2" gutterBottom>Field Help Text</Typography>
                        </label>
                        <TextValidator
                            name="helpText"
                            onChange={(event) => onModalParameterChange(event)}
                            value={modalState.helpText.default}
                            className={classes.textWrapper}
                            fullWidth
                            InputProps={{
                                disableUnderline: true,
                                className: classes.textField
                            }}
                        />
                    </div>
                }
                {fieldType == "text" &&
                    <div>
                        <label className={classes.label}>
                            <Typography variant="body2" gutterBottom>Field Placeholder</Typography>
                        </label>
                        <TextValidator
                            name="placeHolder"
                            onChange={(event) => onModalParameterChange(event)}
                            fullWidth
                            value={modalState.placeHolder.default}
                            className={classes.textWrapper}
                            InputProps={{
                                disableUnderline: true,
                                className: classes.textField
                            }}
                        />
                    </div>
                }
                {fieldType == "text" &&
                    <FormControlLabel
                        control={
                            <Checkbox
                                onChange={(event) => handleRequiredTextField(event)} //TODO: add validation to resultModal..
                                inputProps={{ 'aria-label': 'Checkbox A' }}
                                label="Gilad Gray"
                            />
                        }
                        label="Required"
                    />
                }
                <div className={classes.buttonContainer}>
                    <Button type="submit" variant="contained" className={classes.modalButton}>Save</Button>
                </div>
            </ValidatorForm>

        );
    }
}

export default withStyles(styles)(SdkHelperModal);
