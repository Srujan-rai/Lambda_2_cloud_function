import React, { Fragment, Component }  from 'react';
import { withStyles } from '@material-ui/core/styles';
import { Avatar, Button, Chip, Checkbox, Modal, Paper, Typography, FormControlLabel, Fade, Tooltip, IconButton } from '@material-ui/core';
import { ValidatorForm, TextValidator} from 'react-material-ui-form-validator';
import { validateUrl as isUrl } from "../../helpers/validations";
import SdkConfigurationModal from './helperModal';
import styles from "./styles";
import InfoIcon from '@material-ui/icons/Info';
import { Visibility as VisibilityIcon } from '@material-ui/icons';

class SdkConfigurationForm extends Component {
    componentDidMount() {
        ValidatorForm.addValidationRule('isUrl', (value) => isUrl(value));
    }
    render() {
        const {
            classes, onModalSubmit, onFormSubmit, state, modalHelperState, formState, editState, handleChange, handleModalCheck, handleIconButtonClick, onMappingModalSubmit,
            handleModalClose, modalOpenState, onTextInputChange, onFileNameChange, onModalParameterChange,
            handleRequiredTextField, onTemplateCheckboxChange, handleFormCheckBoxChange,
        } = this.props;
        return (
            <Fragment>
                <Paper>
                    <Chip
                        avatar={<Avatar>CO</Avatar>}
                        label={`${editState ? 'Edit' : 'Add New'} SDK Configuration`}
                        color="primary"
                        className={classes.chip}
                    />
                    <ValidatorForm
                        // className={classes.sdkContainer}
                        autoComplete="off"
                        className={classes.form}
                        onSubmit={event => onFormSubmit(event)}
                    >
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>File name</Typography>
                            </label>
                            <TextValidator
                                name="fileName"
                                onChange={(event) => onFileNameChange(event)}
                                fullWidth
                                value={state.fileName}
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
                                <Typography variant="body2" gutterBottom>Promotion id</Typography>
                            </label>
                            <TextValidator
                                name="promotionId"
                                onChange={(event) => onTextInputChange(event)}
                                fullWidth
                                value={formState.promotionId}
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
                                <Typography variant="body2" gutterBottom>API key</Typography>
                            </label>
                            <TextValidator
                                name="apiKey"
                                onChange={(event) => onTextInputChange(event)}
                                validators={['required']}
                                errorMessages={['This field is required']}
                                fullWidth
                                value={formState.apiKey}
                                InputProps={{
                                    disableUnderline: true,
                                    className: classes.textField
                                }}
                            />
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Captcha site key</Typography>
                            </label>
                            <TextValidator
                                name="captchaSiteKey"
                                onChange={(event) => onTextInputChange(event)}
                                validators={['required']}
                                errorMessages={['This field is required']}
                                fullWidth
                                value={formState.captchaSiteKey}
                                InputProps={{
                                    disableUnderline: true,
                                    className: classes.textField
                                }}
                            />
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Flow label</Typography>
                            </label>
                            <TextValidator
                                name="flowLabel"
                                onChange={(event) => onTextInputChange(event)}
                                validators={['required']}
                                errorMessages={['This field is required']}
                                fullWidth
                                value={formState.flowLabel}
                                InputProps={{
                                    disableUnderline: true,
                                    className: classes.textField
                                }}
                            />
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Endpoint</Typography>
                            </label>
                            <TextValidator
                                name="endpoint"
                                onChange={(event) => onTextInputChange(event)}
                                validators={['isUrl']}
                                errorMessages={['Not a valid url']}
                                fullWidth
                                value={formState.endpoint}
                                InputProps={{
                                    disableUnderline: true,
                                    className: classes.textField
                                }}
                            />
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Configuration id</Typography>
                            </label>
                            <TextValidator
                                name="configurationId"
                                onChange={(event) => onTextInputChange(event)}
                                fullWidth
                                value={formState.configurationId}
                                InputProps={{
                                    disableUnderline: true,
                                    className: classes.textField
                                }}
                            />
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Optional inputs</Typography>
                            </label>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        value="checkedA"
                                        inputProps={{ 'formFieldType': 'text'}}
                                        label="Gilad Gray"
                                        name="pins"
                                        onChange={handleChange}
                                        checked={state.checkedItems.pins}
                                    />
                                }
                                label="Pincode"
                            />
                            {(state.checkedItems.pins) &&
                                    <IconButton name="pins" aria-label="Close" className={classes.closeButton} onClick={(event) => { event.stopPropagation(); handleModalCheck(event.currentTarget.name)}}>
                                        <VisibilityIcon fontSize="medium" />
                                    </IconButton>}
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        value="checkedA"
                                        inputProps={{ 'formFieldType': 'checkbox'}}
                                        label="Gilad Gray"
                                        name="pp"
                                        onChange={handleChange}
                                        checked={state.checkedItems.pp}
                                    />
                                }
                                label="PP checkbox"
                            />
                              {(state.checkedItems.pp) &&
                                    <IconButton name="pp" aria-label="Close" className={classes.closeButton} onClick={(event) => { event.stopPropagation(); handleModalCheck(event.currentTarget.name)}}>
                                        <VisibilityIcon fontSize="medium" />
                                    </IconButton>}
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Form Options</Typography>
                            </label>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        name="hidden"
                                        onChange={handleFormCheckBoxChange}
                                        checked={state.result.form.hidden}
                                    />
                                }
                                label={<Typography className={classes.marginTop5} variant="body2" gutterBottom>Hidden Form
                                    <Tooltip className={classes.tooltip} placement="right" title={
                                        <span className={classes.tooltipText}>
                                            If the form is marked as "hidden", it will be hidden for the client,
                                            but submitted directly after the "JS SDK" initialization
                                        </span>
                                    }>
                                        <InfoIcon className={classes.tooltipIcon} fontSize="small" />
                                    </Tooltip>
                                </Typography>}
                            />
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>SDK Options</Typography>
                            </label>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        name="useResponseTemplate"
                                        onChange={onTemplateCheckboxChange}
                                        checked={state.result.useResponseTemplate}
                                    />
                                }
                                label="Enable SDK Response Template"
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        name="useErrorTemplate"
                                        onChange={onTemplateCheckboxChange}
                                        checked={state.result.useErrorTemplate}
                                    />
                                }
                                label="Enable SDK Error Template"
                            />
                            {  state.result.useErrorTemplate &&
                                <FormControlLabel
                                control={
                                    <Checkbox
                                        value="checked"
                                        inputProps={{ 'formFieldType': 'checkbox'}}
                                        name="errMapping"
                                        onChange={handleChange}
                                        checked={state.checkedItems.errMapping}
                                    />
                                }
                                label="Enable SDK Error Message Mapping"
                            />
                            }
                            {state.checkedItems.errMapping &&
                                <IconButton aria-label="Close" className={classes.closeButton} onClick={(event) => handleIconButtonClick(event, "checkbox", "errMapping")}>
                                    <VisibilityIcon fontSize="medium" />
                                </IconButton>}
                            {  state.result.useResponseTemplate &&
                                <FormControlLabel
                                control={
                                    <Checkbox
                                        value="checked"
                                        inputProps={{ 'formFieldType': 'checkbox'}}
                                        name="responseMapping"
                                        onChange={handleChange}
                                        checked={state.checkedItems.responseMapping}
                                    />
                                }
                                label="Enable SDK Response Message Mapping"
                            />
                            }
                            {(state.checkedItems.responseMapping) &&
                                <IconButton aria-label="Close" className={classes.closeButton} onClick={(event) => handleIconButtonClick(event, "checkbox", "responseMapping")}>
                                    <VisibilityIcon fontSize="medium" />
                                </IconButton>}

                            {  state.result.useResponseTemplate && state.result.responseTemplateMapping &&
                                <FormControlLabel
                                control={
                                    <Checkbox
                                        value="checked"
                                        inputProps={{ 'formFieldType': 'checkbox'}}
                                        name="detailedPrizeView"
                                        onChange={handleChange}
                                        checked={state.checkedItems.detailedPrizeView}
                                    />
                                }
                                label="Enable SDK Detailed Prize View Message Mapping"
                            />
                            }
                             {(state.checkedItems.detailedPrizeView) &&
                                <IconButton aria-label="Close" className={classes.closeButton} onClick={(event) => handleIconButtonClick(event, "checkbox", "detailedPrizeView")}>
                                    <VisibilityIcon fontSize="medium" />
                                </IconButton>}
                        </div>
                        <div className={classes.buttonContainer}>
                            <Button type="submit" variant="contained" className={classes.button} disabled={state.buttonDisabled}>Save</Button>
                        </div>
                    </ValidatorForm>
                    { state.helperModal.name === 'errMapping' &&
                    <Modal
                        open={modalOpenState}
                        onClose={() =>this.props.handleModalClose()}
                    >
                        <Fade in={modalOpenState}>
                            <div className={classes.modal}>
                                <h3 id="transition-modal-title">{state.checkedItems.errMapping ? "Add custom error messages" : "Add additional input"}
                                    <Tooltip className={classes.tooltip} placement="right" title={
                                        <span className={classes.tooltipText}>
                                            The ERROR message mapping template field represents the fields which can be localized/translated for the specific error messages,
                                            given as example.
                                        </span>
                                    }>
                                        <InfoIcon className={classes.tooltipIcon} fontSize="small" />
                                    </Tooltip>
                                </h3>
                            </div>
                        </Fade>
                    </Modal>
                    }
                    { state.helperModal.name === 'responseMapping' &&
                    <Modal
                        open={modalOpenState}
                        onClose={() =>this.props.handleModalClose()}
                    >
                        <Fade in={modalOpenState}>
                            <div className={classes.modal}>
                                <h3 id="transition-modal-title">{state.checkedItems.responseMapping ? "Add custom response messages" : "Add additional input"}
                                 <Tooltip className={classes.tooltip} placement="right" title={
                                        <span className={classes.tooltipText}>
                                            The response template mapping fields shows the specific response which can be translated/localized for the needs,
                                            of the specific markets.
                                        </span>
                                    }>
                                        <InfoIcon className={classes.tooltipIcon} fontSize="small" />
                                    </Tooltip>
                                </h3>
                            </div>
                        </Fade>
                    </Modal>
                    }

                    { state.helperModal.name === 'detailedPrizeView' &&
                    <Modal
                        open={modalOpenState}
                        onClose={() =>this.props.handleModalClose()}
                    >
                        <Fade in={modalOpenState}>
                            <div className={classes.modal}>
                                <h3 id="transition-modal-title">{state.checkedItems.detailedPrizeView ? "Add custom detailed view messages" : "Add additional input"}
                                 <Tooltip className={classes.tooltip} placement="right" title={
                                        <span className={classes.tooltipText}>
                                            Detailed prize view mapping shows what can be translated for the client's specific needs such as text/buttons, as shown below.
                                        </span>
                                    }>
                                        <InfoIcon className={classes.tooltipIcon} fontSize="small" />
                                    </Tooltip>
                                </h3>
                            </div>
                        </Fade>
                    </Modal>
                    }
                    <Modal
                        open={modalOpenState}
                        onClose={() => this.props.handleModalClose()}
                    >
                        <Fade in={modalOpenState}>
                            <div className={classes.modal}>
                                <h3 id="transition-modal-title">Add additional input</h3>
                                <SdkConfigurationModal
                                    fieldType={state.helperModal.type}
                                    onTextInputChange={onTextInputChange}
                                    onModalParameterChange={onModalParameterChange}
                                    onModalSubmit={onModalSubmit}
                                    modalState={modalHelperState}
                                    handleRequiredTextField={handleRequiredTextField}
                                    onMappingModalSubmit={onMappingModalSubmit}
                                />
                            </div>
                        </Fade>
                    </Modal>
                </Paper>
            </Fragment>
        );
    };
};

export default withStyles(styles)(SdkConfigurationForm);
