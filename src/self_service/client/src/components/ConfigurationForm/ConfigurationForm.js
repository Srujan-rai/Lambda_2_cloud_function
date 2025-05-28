import React, { Fragment, Component } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { Avatar, Button, Chip, Checkbox, Dialog, DialogContent, DialogTitle, IconButton, ListItemText, MenuItem, Paper, Select, Typography, Tooltip, FormControlLabel } from '@material-ui/core';
import { Close as CloseIcon, Visibility as VisibilityIcon } from '@material-ui/icons';
import InfoIcon from '@material-ui/icons/Info';
import { ValidatorForm, TextValidator } from 'react-material-ui-form-validator';
import ConfigurationFlowContainer from '../../containers/ConfigurationFlowContainer';
import * as PromotionOptions from '../../constants/lists';
import DatePicker from "react-datepicker";
import { prepareDateTimePickerParams, getObjectKey } from "../../helpers/utils";
import "react-datepicker/dist/react-datepicker.css";
import styles from "./styles";
import AdditionalInformation from "../AdditionalInformationForm";
import ConfigPrizeDrawInstantWinFlow from '../../containers/ConfigPrizeDrawInstantWinFlow';

const propTypes = {
    store: PropTypes.shape({
        promotionId: PropTypes.string.isRequired,
        flow: PropTypes.object.isRequired,
        configurationParameters: PropTypes.shape({
            configurationStartUtc: PropTypes.number.isRequired,
            configurationEndUtc: PropTypes.number.isRequired,
            country: PropTypes.string.isRequired,
            userIdType: PropTypes.string.isRequired,
            language: PropTypes.string.isRequired,
            emailTemplateId: PropTypes.string.isRequired,
            ajoEmailTemplate: PropTypes.string.isRequired,
            currencies: PropTypes.array,
            validity: PropTypes.string,
            additionalInformation: PropTypes.shape({
                startDate: PropTypes.number,
                endDate: PropTypes.number,
                imageUrl: PropTypes.string,
                type: PropTypes.string,
                active: PropTypes.bool,
                visibleFromDate: PropTypes.number,
                minAge: PropTypes.number,
                description: PropTypes.string,
                name: PropTypes.string,
                shortDescription: PropTypes.string,
                cost: PropTypes.number,
                wv_url: PropTypes.string,
                tags: PropTypes.string,
            })
        }).isRequired,
    }).isRequired,
    hideFlowDialog: PropTypes.func.isRequired,
    displayFlowDialog: PropTypes.bool.isRequired,
    selectedFlowLabelKey: PropTypes.string.isRequired,
    onDateTimeChange: PropTypes.func.isRequired,
    onSave: PropTypes.func.isRequired,
    onConfigurationParameterChange: PropTypes.func.isRequired,
    onAdditionalInfoParamChange: PropTypes.func.isRequired,
    onTextInputChange: PropTypes.func.isRequired,
    onCurrencyChange: PropTypes.func.isRequired,
    onCountryChange: PropTypes.func.isRequired,
    onFlowToggle: PropTypes.func.isRequired,
    classes: PropTypes.object.isRequired,
    displayAdditionalInformation: PropTypes.bool.isRequired,
    handleAdditionalInfoDisplay: PropTypes.func.isRequired
};

const defaultProps = {};
const BURN_PINCODES = "burnPincodes";
const CURRENCY_REDUCER = "currencyReducer";
const promotionId = "promotionId";
const flow = "flow";
const country = "country";
const userIdType = "userIdType";
const language = "language";
const currenciesArray = "currenciesArray";
const configurationStartUtc = "configurationStartUtc";
const configurationEndUtc = "configurationEndUtc";
const emailTemplateId = "emailTemplateId";
const ajoEmailTemplate = 'ajoEmailTemplate';
const validity = "validity";
const prizeListPriority = "priorityOrder";
const captchaSecret = "captchaSecret";
const promoName='name';

class ConfigurationForm extends Component {

    render() {
        const {
            classes, displayFlowDialog, hideFlowDialog, selectedFlowLabelKey, currencies, emailTemplates, store, onCountryChange, onCurrencyChange, onTextInputChange,
            onConfigurationParameterChange, onFlowToggle, onDateTimeChange, onSave, onNumberChange, onAdditionalInfoParamChange, onAdditionalInfoFieldChange, displayAdditionalInformation,
            handleAdditionalInfoDisplay, handleFlowCheck, isEdit, additionalInformationData, getFileName, displayPrizesPriorityField, handlePrizeListPriorityChange
        } = this.props;
        const startDate = store.configurationParameters.configurationStartUtc ? new Date(store.configurationParameters.configurationStartUtc) : store.configurationParameters.configurationStartUtc;
        const endDate = store.configurationParameters.configurationEndUtc ? new Date(store.configurationParameters.configurationEndUtc) : store.configurationParameters.configurationEndUtc;
        const flows = Object.keys(store.flow);
        const selectedCurrencies = store.configurationParameters.currencies ? store.configurationParameters.currencies : [];
        const name = store.configurationParameters.additionalInformation?.name ? store.configurationParameters.additionalInformation.name : '';
        const includesBurnPincodes = store.flow?.instantWin?.flowLambdas?.includes(BURN_PINCODES);
        const includesCurrencyReducer = store.flow?.instantWin?.flowLambdas?.includes(CURRENCY_REDUCER);
        const isFlowLabelEnabled = (flowLabelKey) => {
            // Only one mechanic can be selected for a configuration. Disable the mechanic option if another mechanic has already been selected.
            if(flowLabelKey === 'instantWin' && store.flow.hasOwnProperty('promoEntry')) return false;
            if(flowLabelKey === 'promoEntry' && store.flow.hasOwnProperty('instantWin')) return false;
            return true;
        }

        return (
            <Fragment>
                <Paper>
                    <Chip
                        avatar={<Avatar>CO</Avatar>}
                        label={`${isEdit ? 'Edit' : 'Add New'} Configuration`}
                        color="primary"
                        className={classes.chip}
                    />
                    <ValidatorForm className={classes.container} autoComplete="off" onSubmit={event => onSave(event)}>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Promotion id</Typography>
                            </label>
                            <TextValidator
                                id={promotionId}
                                name={promotionId}
                                value={store.promotionId}
                                onChange={(event) => onTextInputChange(event)}
                                fullWidth
                                className={classes.textField}
                                margin="normal"
                                InputProps={{
                                    disableUnderline: true
                                }}
                            />
                            {store.messages && !!store.messages.promotionId &&
                                <div className={classes.messages}>
                                    {store.messages.promotionId}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Country</Typography>
                            </label>
                            <Select
                                name={country}
                                value={store.configurationParameters.country}
                                onChange={(event) => onCountryChange(event)}
                                fullWidth
                                className={classes.select}
                                disableUnderline
                            >
                                {PromotionOptions.promotionMarketList.map(country => (
                                    <MenuItem key={country} value={country}>
                                        {country}
                                    </MenuItem>
                                ))}
                            </Select>
                            {store.messages && !!store.messages.country &&
                                <div className={classes.messages}>
                                    {store.messages.country}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>User Id origin</Typography>
                            </label>
                            <Select
                                name={userIdType}
                                value={store.configurationParameters.userIdType}
                                onChange={(event) => onConfigurationParameterChange(event)}
                                fullWidth
                                className={classes.select}
                                disableUnderline
                            >
                                {Object.values(PromotionOptions.userIdOriginMap).sort().map((userIdOrigin, index) => (
                                    <MenuItem key={index} value={getObjectKey(PromotionOptions.userIdOriginMap, userIdOrigin)}>
                                        {userIdOrigin}
                                    </MenuItem>
                                ))}
                            </Select>
                            {store.messages && !!store.messages.userIdType &&
                                <div className={classes.messages}>
                                    {store.messages.userIdType}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Default language</Typography>
                            </label>
                            <Select
                                name={language}
                                value={store.configurationParameters.language}
                                onChange={(event) => onConfigurationParameterChange(event)}
                                fullWidth
                                className={classes.select}
                                disableUnderline
                            >
                                {Object.values(PromotionOptions.supportedLanguagesMap).sort().map((supportedLanguage, index) => (
                                    <MenuItem key={index} value={getObjectKey(PromotionOptions.supportedLanguagesMap, supportedLanguage)}>
                                        { supportedLanguage}
                                    </MenuItem>
                                ))}
                            </Select>
                            {store.messages && !!store.messages.language &&
                                <div className={classes.messages}>
                                    {store.messages.language}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Currencies</Typography>
                            </label>
                            <Select
                                multiple
                                name={currenciesArray}
                                value={store.configurationParameters.currencies}
                                onChange={(event) => onCurrencyChange(event)}
                                fullWidth
                                className={classes.select}
                                disableUnderline
                                renderValue={selected => selected.join(', ')}
                            >
                                {currencies.map(currency => (
                                    <MenuItem key={currency.currency_id} value={currency.currency_id}>
                                        <Checkbox checked={store.configurationParameters.currencies.includes(currency.currency_id)} />
                                        <ListItemText primary={currency.name} />
                                    </MenuItem>
                                ))}
                            </Select>
                            {store.messages && !!store.messages.currencies &&
                                <div className={classes.messages}>
                                    {store.messages.currencies}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Functionalities</Typography>
                            </label>
                            <Select
                                multiple
                                name={flow}
                                value={flows}
                                onChange={onFlowToggle}
                                fullWidth
                                className={classes.select}
                                disableUnderline
                                renderValue={selected => selected.join(', ')}
                            >
                                {Object.entries(PromotionOptions.flowLabelMap).map(([flowLabelKey, flowLabelName]) => (
                                    <MenuItem key={flowLabelKey} value={flowLabelKey} disabled={!isFlowLabelEnabled(flowLabelKey)}>
                                        <Checkbox checked={flows.includes(flowLabelKey)} />
                                        <ListItemText primary={flowLabelName} />
                                        {isEdit && flows.includes(flowLabelKey) && !PromotionOptions.staticConfigurationFlows.includes(flowLabelKey) &&
                                            <IconButton aria-label="Close" className={classes.closeButton} onClick={(event) => { event.stopPropagation(); handleFlowCheck(flowLabelKey) }}>
                                                <VisibilityIcon fontSize="large" />
                                            </IconButton>}
                                    </MenuItem>
                                ))}
                            </Select>
                            {store.messages && !!store.messages.flow &&
                                <div className={classes.messages}>
                                    {store.messages.flow}
                                </div>
                            }
                        </div>
                        {displayPrizesPriorityField &&
                            <div className={classes.rowContainer}>
                                <label className={classes.label}>
                                    <Typography variant="body2" gutterBottom>Prize List Priority</Typography>
                                </label>
                                <Select
                                    name={prizeListPriority}
                                    value={(flows.includes('listPrizes') &&
                                        store.flow.listPrizes.params &&
                                        store.flow.listPrizes.params.priorityOrder) || ''
                                    }
                                    onChange={(event) => handlePrizeListPriorityChange(event.target.value)}
                                    fullWidth
                                    className={`${classes.select} ${classes.selectTemplate}`}
                                    disableUnderline
                                >
                                    {PromotionOptions.prizeListPriority.map(priority => (
                                        <MenuItem key={priority} value={priority}>
                                            {priority}
                                        </MenuItem>
                                    ))}
                                </Select>
                                {store.messages && !!store.messages.emailTemplateId &&
                                    <div className={classes.messages}>
                                        {store.messages.emailTemplateId}
                                    </div>
                                }
                            </div>
                        }
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Email template id</Typography>
                            </label>
                            <Select
                                name={emailTemplateId}
                                value={store.configurationParameters.emailTemplateId}
                                onChange={(event) => onConfigurationParameterChange(event)}
                                fullWidth
                                className={`${classes.select} ${classes.selectTemplate}`}
                                disableUnderline
                            >
                                {emailTemplates.map(template => (
                                    <MenuItem key={template.template_id} value={template.template_id}>
                                        {template.template_name}
                                    </MenuItem>
                                ))}
                            </Select>
                            {store.messages && !!store.messages.emailTemplateId &&
                                <div className={classes.messages}>
                                    {store.messages.emailTemplateId}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.labelTooltip}>
                                <Typography variant="body2" gutterBottom>AJO Template Name</Typography>
                                <Tooltip placement="right" title={
                                    <span className={classes.tooltipText}>
                                        Provide the name of the template created in AJO and if user id origin is CDS
                                    </span>
                                }>
                                    <InfoIcon className={classes.tooltipIcon} fontSize="small" />
                                </Tooltip>
                            </label>
                            <TextValidator
                                id={ajoEmailTemplate}
                                name={ajoEmailTemplate}
                                value={store.configurationParameters.ajoEmailTemplate}
                                onChange={(event) => onConfigurationParameterChange(event)}
                                fullWidth
                                className={classes.textField}
                                margin="normal"
                                InputProps={{
                                    disableUnderline: true
                                }}
                            />
                            {store.messages && !!store.messages.ajoEmailTemplate &&
                                <div className={classes.messages}>
                                    {store.messages.ajoEmailTemplate}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer2}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Configuration start date</Typography>
                            </label>
                            <DatePicker
                                selected={startDate}
                                onChange={(value) => onDateTimeChange(prepareDateTimePickerParams(configurationStartUtc, value))}
                                showTimeSelect
                                dateFormat="MM/dd/yyyy h:mm aa"
                                className={`${classes.textField} ${classes.dateField}`}
                                calendarClassName={classes.calendarField}
                                minDate={new Date()}
                            />
                            {store.messages && !!store.messages.configurationStartUtc &&
                                <div className={classes.messages}>
                                    {store.messages.configurationStartUtc}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer2}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Configuration end date</Typography>
                            </label>
                            <DatePicker
                                selected={endDate}
                                onChange={(value) => onDateTimeChange(prepareDateTimePickerParams(configurationEndUtc, value))}
                                showTimeSelect
                                dateFormat="MM/dd/yyyy h:mm aa"
                                className={`${classes.textField} ${classes.dateField}`}
                                calendarClassName={classes.calendarField}
                                minDate={startDate}
                            />
                            {store.messages && !!store.messages.configurationEndUtc &&
                                <div className={classes.messages}>
                                    {store.messages.configurationEndUtc}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer2}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Currency validity (days)</Typography>
                            </label>
                            <TextValidator
                                name={validity}
                                value={store.validity}
                                defaultValue=''
                                onChange={(event) => onNumberChange(event.target.value, event.target.name)}
                                className={classes.validityField}
                                margin="normal"
                                type="number"
                                validators={['isNumber', 'minNumber:1']}
                                errorMessages={['Must be number', 'Value must be larger than 0']}
                                InputProps={{
                                    disableUnderline: true,
                                }}
                            />
                        </div>

                        <div className={classes.rowContainer2}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Captcha secret</Typography>
                            </label>
                            <TextValidator
                                id={captchaSecret}
                                name={captchaSecret}
                                value={store.configurationParameters.captchaSecret}
                                onChange={(event) => onConfigurationParameterChange(event)}
                                fullWidth
                                className={classes.textField}
                                margin="normal"
                                InputProps={{
                                    disableUnderline: true
                                }}
                            />
                        </div>

                        <div className={classes.rowContainer2}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Name</Typography>
                            </label>
                            <TextValidator
                                id={promoName}
                                name={promoName}
                                value={name}
                                onChange={(event) => onAdditionalInfoFieldChange(event)}
                                fullWidth
                                className={classes.textField}
                                margin="normal"
                                InputProps={{
                                    disableUnderline: true
                                }}
                            />
                            {store.messages && !!store.messages.name &&
                                <div className={classes.messages}>
                                    {store.messages.name}
                                </div>
                            }
                        </div>

                        <div className={`${classes.rowContainer2} ${classes.displayAdditionalInfo}`}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={displayAdditionalInformation}
                                        onChange={handleAdditionalInfoDisplay}
                                        name="displayAdditionalInfo"
                                    />
                                }
                                label="Additional Information"
                            />
                        </div>

                        {
                            displayAdditionalInformation &&
                            <AdditionalInformation
                                onAdditionalInfoParamChange={onAdditionalInfoParamChange}
                                isEdit={this.props.isEdit}
                                additionalInformationData={additionalInformationData}
                                selectedCurrencies={selectedCurrencies}
                                getFileName={getFileName}
                                includesBurnPincodes= {includesBurnPincodes}
                                includesCurrencyReducer= {includesCurrencyReducer}
                            />
                        }

                        <div className={classes.buttonContainer}>
                            <Button type="submit" variant="contained" className={classes.button}>Save</Button>
                        </div>
                    </ValidatorForm>
                    <Dialog
                        className={classes.dialog}
                        onClose={onFlowToggle}
                        open={displayFlowDialog}
                        maxWidth="xl"
                        scroll="body"
                    >
                        <DialogTitle id="flow-dialog" onClose={this.handleClose}>
                            Set Configuration Functionality
                            <IconButton aria-label="Close" className={classes.closeButton} onClick={hideFlowDialog}>
                                <CloseIcon />
                            </IconButton>
                        </DialogTitle>
                        <DialogContent>
                        {selectedFlowLabelKey === "instantWin" ? (

                                <ConfigPrizeDrawInstantWinFlow
                                    flowLabelKey={selectedFlowLabelKey}
                                    hideFlowDialog={hideFlowDialog}
                                />
                            ) : selectedFlowLabelKey === "promoEntry" ? (
                                <ConfigPrizeDrawInstantWinFlow
                                    flowLabelKey={selectedFlowLabelKey}
                                    hideFlowDialog={hideFlowDialog}
                                />
                            ) : (
                                <ConfigurationFlowContainer
                                    flowLabelKey={selectedFlowLabelKey}
                                    hideFlowDialog={hideFlowDialog}
                                />
                            )
                            }
                        </DialogContent>
                    </Dialog>
                </Paper>
            </Fragment>
        );
    };
};

ConfigurationForm.propTypes = propTypes;
ConfigurationForm.defaultProps = defaultProps;

export default withStyles(styles)(ConfigurationForm);
