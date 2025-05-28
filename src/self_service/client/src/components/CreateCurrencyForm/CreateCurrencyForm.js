import React, { Fragment, Component } from "react";
import {Typography, Button, MenuItem, Paper, withStyles, Chip, Avatar, Tooltip } from "@material-ui/core";
import InfoIcon from '@material-ui/icons/Info';
import { ValidatorForm, TextValidator, SelectValidator, ValidatorComponent } from "react-material-ui-form-validator";
import * as PromotionOptions from '../../constants/lists';
import FileUpload from '../FileUpload/FileUpload';
import { IMAGE_FILE } from '../../constants/files';
import styles from "./styles";
import { INVALID_IMAGE_DIMENSIONS } from '../../constants/messages';

class ValidatorFileUpload extends ValidatorComponent {
    renderValidatorComponent() {
        return <div className={this.props.classes.fileUpload}>
                <div style={{ position: "relative" }}>
                    <FileUpload
                        {...this.props}
                    />
                </div>
            </div>
    }
};

class CreateCurrencyForm extends Component {
    componentDidMount() {
        ValidatorForm.addValidationRule('isValid', value => value ? false : true );
    }

    componentWillUnmount() {
        ValidatorForm.removeValidationRule('isValid');
    }

    render() {
        const {
            classes, onFormSubmit, state, store, onSelectInputChange, formState, onTextInputChange, onChangeFileUpload,
        } = this.props;

        return (
            <Fragment>
                <Paper>
                    <Chip
                        avatar={<Avatar>CO</Avatar>}
                        label="Create new currency"
                        color="primary"
                        className={classes.chip}
                    />
                    <ValidatorForm
                        className={classes.currencyCreationContainer}
                        autoComplete="off"
                        className={classes.form}
                        onSubmit={event => onFormSubmit(event)}
                    >
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Currency name</Typography>
                            </label>
                            <TextValidator
                                name="currencyName"
                                onChange={(event) => onTextInputChange(event)}
                                fullWidth
                                value={formState.currencyName}
                                validators={['required']}
                                errorMessages={['This field is required']}
                                InputProps={{
                                    disableUnderline: true,
                                    className: classes.textField
                                }}
                            />
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Country</Typography>
                            </label>
                            <SelectValidator
                                name="country"
                                onChange={(event) => onSelectInputChange(event)}
                                fullWidth
                                validators={['required']}
                                errorMessages={['This field is required']}
                                value={formState.country}
                                InputProps={{
                                    disableUnderline: true,
                                    className: classes.textField
                                }}
                            >
                                {PromotionOptions.promotionMarketList.map(country => (
                                    <MenuItem key={country} value={country}>
                                        {country}
                                    </MenuItem>
                                ))}
                            </SelectValidator>

                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Currency family</Typography>
                            </label>
                            <SelectValidator
                                validators={['required']}
                                errorMessages={['This field is required']}
                                value={formState.currencyFamily}
                                onChange={(event) => onSelectInputChange(event)}
                                name='currencyFamily'
                                InputProps={{
                                    disableUnderline: true,
                                    className: classes.textField
                                }}

                             >
                                <MenuItem value="coin">
                                    <Typography variant="body2" gutterBottom>coin</Typography>
                                </MenuItem>
                                <MenuItem value="gem">
                                    <Typography variant="body2" gutterBottom>gem</Typography>
                                </MenuItem>
                            </SelectValidator>
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={`${classes.label} ${classes.labelWithIcon}`}>
                                <Typography variant="body2" gutterBottom>Currency Icon</Typography>
                                <Tooltip placement="right" title={
                                    <span className={classes.tooltipText}>
                                        Optional parameter, used to display currency icon through the NGPS JS SDK.
                                        It accepts "png" and "svg" formats. The icon width and height shouldn't be
                                        more than 16x16 pixels!
                                    </span>
                                }>
                                    <InfoIcon className={classes.tooltipIcon} fontSize="small" />
                                </Tooltip>
                            </label>
                            <ValidatorFileUpload
                                type={IMAGE_FILE}
                                name="currencyIcon"
                                onChange={onChangeFileUpload}
                                isIcon={true}
                                invalidIcoMsg={INVALID_IMAGE_DIMENSIONS}
                                validators={['isValid']}
                                classes
                                value={store.messages && store.messages.currencyIcon}
                            />
                        </div>
                        {
                            store.messages && !!store.messages.currencyIcon &&
                            <div className={classes.messages}>{store.messages.currencyIcon}</div>
                        }
                        <div className={classes.buttonContainer}>
                            <Button type="submit" variant="contained" className={classes.button} disabled={state.buttonDisabled}>Save</Button>
                        </div>
                    </ValidatorForm>
                </Paper>
            </Fragment>
        );
    };
};

export default withStyles(styles)(CreateCurrencyForm);
