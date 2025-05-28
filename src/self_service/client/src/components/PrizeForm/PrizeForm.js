import React, { Fragment, Component } from 'react';
import { withStyles } from '@material-ui/core/styles';
import { Avatar, Button, Chip, FormControlLabel, MenuItem, Paper, Radio, Select, Tooltip, Typography, RadioGroup, CircularProgress, Backdrop, IconButton, Checkbox } from '@material-ui/core';
import CurrencyList from '../CurrencyList';
import { ValidatorForm, TextValidator } from 'react-material-ui-form-validator';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { validateUrl as isUrl, isEmailLinkValid } from "../../helpers/validations";
import { prepareDateTimePickerParams, getSelectedLanguageCode } from "../../helpers/utils";
import { ValidationRules } from 'react-form-validator-core';
import InfoIcon from '@material-ui/icons/Info';
import PrizeTags from './PrizeTags';
import styles from "./styles";
import PrizeImageList from '../PrizeImageList/PrizeImageList';
import DatePicker from "react-datepicker";

const desc = "desc";
const shortDesc = "shortDesc";
const redeemDesc = "redeemDesc";
const configurationId = "configurationId";
const name = "name";
const active = "active";
const deliveryType = "deliveryType";
const finalState = "finalState";
const validityPeriodAfterClaim = "validityPeriodAfterClaim";
const redemptionLink = "redemptionLink";
const barcodeType = "barcodeType";
const priority = "priority";
const tier = "tier";
const redemptionLimit = "redemptionLimit";
const minAge = "minAge";
const endDateUTC = "endDateUTC";
const startDateUTC = "startDateUTC";

const areCurrenciesValid = (currencies, formDisabled) => currencies && Array.isArray(currencies) && currencies.length !== 0 && !formDisabled;
const typeOfPrize = (store) => {
    if(store.poolPrize) return "always_win";
    return store.cost ? "standard" : "instant_win";
}
class PrizeForm extends Component {
    componentDidMount = () => {
        ValidatorForm.addValidationRule('isEmptyOrUrlOrEmailLink', value => ValidationRules.isEmpty(value) || isUrl(value) || isEmailLinkValid(value));
        ValidatorForm.addValidationRule('isEmptyOrGreaterThanZero', value => ValidationRules.isEmpty(value) || Number(value) > 0);
    };

    render() {
        const {
            classes, errors, store, onConfigurationBlur, onConfigurationSearch, onTextInputChange, onSelectChange, onCostItemAddition, onCostItemRemoval, onImageMetadataChange,onImageMetadataNameChange,
            onCurrencyChange, onNumberInputChange, onCurrencyAmountChange, onFileChange, onSave, isEdit, onCostTypeChange, onFileItemAddition,
            onFileItemRemoval, onChangeFileUpload, onChange, handleDateTimeChange, handleDateTimeToggle, handleValidityPeriodToggle
        } = this.props;

        const selectedLanguageCode = getSelectedLanguageCode(store.selectedLanguage);
        const chipLabel = isEdit ? "Edit Prize" : "Add New Prize";

        return (
            <Fragment>
                <Backdrop className={classes.backdrop} open={store.spinnerEnabled}>
                    <CircularProgress color="inherit" />
                </Backdrop>
                <Paper>
                    <ValidatorForm className={classes.container} autoComplete="off" onSubmit={event => onSave(event)}>
                        <Chip
                            avatar={<Avatar>PR</Avatar>}
                            label={chipLabel}
                            color="primary"
                            className={classes.mainChip}
                        />
                        {
                            !isEdit &&
                            <div className={classes.rowContainer}>
                                <label className={classes.label}>
                                    <Typography variant="body2" gutterBottom>Configuration</Typography>
                                </label>
                                <TextValidator
                                    autoFocus
                                    id={configurationId}
                                    name={configurationId}
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
                                <Button type="button" variant="contained" className={classes.configButton} onClick={onConfigurationSearch}>Search</Button>
                            </div>
                        }
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Prize name</Typography>
                            </label>
                            <TextValidator
                                id={name}
                                name={name}
                                className={classes.textField}
                                value={store.name[selectedLanguageCode] || ""}
                                onChange={(event) => onTextInputChange(event)}
                                margin="normal"
                                required
                                validators={['required']}
                                errorMessages={['This field is required']}
                                disabled={store.formDisabled}
                                style={store.formDisabled ? { opacity: 0.3 } : {}}
                                inputProps={{
                                    maxLength: 150
                                }}
                                InputProps={{
                                    disableUnderline: true,
                                }}
                            />
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Prize image</Typography>
                                <Tooltip placement="right" title={
                                    <span className={classes.tooltipText}>
                                        Recommended image resolution: 1080px x 1080px. Allowed image formats: PNG, JPG, SVG
                                    </span>
                                }>
                                    <InfoIcon className={classes.tooltipIcon} fontSize="small" />
                                </Tooltip>
                            </label>

                            <PrizeImageList
                                store={store}
                                onFileItemAddition={onFileItemAddition}
                                onChangeFileUpload={onChangeFileUpload}
                                onFileItemRemoval={onFileItemRemoval}
                                onImageMetadataChange={onImageMetadataChange}
                                onImageMetadataNameChange={onImageMetadataNameChange}

                            />
                        </div>
                        {
                            store.messages && !!store.messages.imagesMetadata &&
                            <div className={classes.messages}>{store.messages.imagesMetadata}</div>
                        }
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Prize description full</Typography>
                            </label>
                            <ReactQuill
                                theme="snow"
                                id={desc}
                                name={desc}
                                style={store.formDisabled ? { opacity: 0.3 } : {}}
                                value={store.desc[selectedLanguageCode] || ""}
                                className={classes.textArea}
                                onChange={html => onTextInputChange({ target: { value: html, name: desc } })}
                            />
                            {errors && errors.desc &&
                                <small className={classes.error}>Max length reached.</small>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Prize description short</Typography>
                            </label>
                            <ReactQuill
                                theme="snow"
                                id={shortDesc}
                                name={shortDesc}
                                style={store.formDisabled ? { opacity: 0.3 } : {}}
                                value={store.shortDesc[selectedLanguageCode] || ""}
                                className={classes.textArea}
                                onChange={html => onTextInputChange({ target: { value: html, name: shortDesc } })}
                            />
                            {errors && errors.shortDesc &&
                                <small className={classes.error}>Max length reached.</small>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Prize redemption description</Typography>
                            </label>
                            <ReactQuill
                                theme="snow"
                                id={redeemDesc}
                                name={redeemDesc}
                                style={store.formDisabled ? { opacity: 0.3 } : {}}
                                value={store.redeemDesc[selectedLanguageCode] || ""}
                                className={classes.textArea}
                                onChange={html => onTextInputChange({ target: { value: html, name: redeemDesc } })}
                            />
                            {errors && errors.redeemDesc &&
                                <small className={classes.error}>Max length reached.</small>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Prize type</Typography>
                            </label>
                            <RadioGroup name="costType" value={typeOfPrize(store)} onChange={onCostTypeChange} className={classes.rowContainer} row>
                                <FormControlLabel value="instant_win" control={<Radio color="primary" />} label="Instant Win" disabled={store.formDisabled} />
                                <FormControlLabel value="always_win" control={<Radio color="primary" />} label="Always Win" disabled={store.formDisabled} />
                                <FormControlLabel value="standard" control={<Radio color="primary" />} label="Collect & Get" disabled={!areCurrenciesValid(store.currencies, store.formDisabled)} />
                            </RadioGroup>
                            {
                                (isEdit && store.cost) &&
                                <CurrencyList
                                    currencies={store.currencies}
                                    cost={store.cost}
                                    onCurrencyChange={onCurrencyChange}
                                    onCostItemRemoval={onCostItemRemoval}
                                    onCostItemAddition={onCostItemAddition}
                                />
                                || store.cost &&
                                <CurrencyList
                                    currencies={store.currencies}
                                    cost={store.cost}
                                    onCurrencyChange={onCurrencyChange}
                                    onCostItemRemoval={onCostItemRemoval}
                                    onCostItemAddition={onCostItemAddition}
                                />
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Active</Typography>
                            </label>
                            <Select
                                value={store.active}
                                onChange={(event) => onSelectChange(event)}
                                name={active}
                                disabled={store.formDisabled}
                                style={store.formDisabled ? { opacity: 0.3 } : {}}
                                className={classes.select}
                                required
                                disableUnderline
                                validators={['required']}
                                errorMessages={['This field is required']}
                            >
                                <MenuItem value={true}>
                                    <Typography variant="body2" gutterBottom>Yes</Typography>
                                </MenuItem>
                                <MenuItem value={false}>
                                    <Typography variant="body2" gutterBottom>No</Typography>
                                </MenuItem>
                            </Select>
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Voucher Distribution</Typography>
                            </label>
                            <Select
                                value={((store.voucherDist === undefined) || (store.voucherDist === true)) ? true : false}
                                onChange={(event) => onSelectChange(event)}
                                name="voucherDist"
                                disabled={store.formDisabled}
                                style={store.formDisabled ? { opacity: 0.3 } : {}}
                                className={classes.select}
                                required
                                disableUnderline
                                validators={['required']}
                                errorMessages={['This field is required']}
                            >
                                <MenuItem value={true}>
                                    <Typography variant="body2" gutterBottom>Yes</Typography>
                                </MenuItem>
                                <MenuItem value={false}>
                                    <Typography variant="body2" gutterBottom>No</Typography>
                                </MenuItem>
                            </Select>
                        </div>
                        {(store.voucherDist === false) &&
                            <Fragment>
                                <div className={classes.rowContainer}>
                                    <label className={classes.label}>
                                        <Typography variant="body2" gutterBottom>Total Quantity</Typography>
                                    </label>
                                    <TextValidator
                                        name="totalAmount"
                                        value={store.totalAmount}
                                        className={classes.textField}
                                        disabled={store.formDisabled}
                                        style={store.formDisabled ? { opacity: 0.3 } : {}}
                                        onChange={event => onNumberInputChange(event.target.valueAsNumber, event.target.name)}
                                        margin="normal"
                                        required
                                        type="number"
                                        validators={['required', 'isNumber']}
                                        errorMessages={['This field is required', 'Must be number']}
                                        InputProps={{
                                            disableUnderline: true
                                        }}
                                    />
                                </div>
                                <div className={classes.rowContainer}>
                                    <label className={classes.label}>
                                        <Typography variant="body2" gutterBottom>Available Quantity</Typography>
                                    </label>
                                    <TextValidator
                                        name="totalAvailable"
                                        value={store.totalAvailable}
                                        className={classes.textField}
                                        disabled={store.formDisabled}
                                        style={store.formDisabled ? { opacity: 0.3 } : {}}
                                        onChange={event => onNumberInputChange(event.target.valueAsNumber, event.target.name)}
                                        margin="normal"
                                        required
                                        type="number"
                                        validators={['required', 'isNumber']}
                                        errorMessages={['This field is required', 'Must be number']}
                                        InputProps={{
                                            disableUnderline: true
                                        }}
                                    />
                                </div>
                            </Fragment>
                        }
                        {!store.cost &&
                            <div className={classes.checkboxCtnr}>
                                <div className={classes.rowContainer}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={store.useStartEndDates}
                                                onChange={event => handleDateTimeToggle(event)}
                                                name="useStartEndDates"
                                            />
                                        }
                                        label={<Fragment>
                                            <Typography variant="body2">Use Start and End dates
                                                <Tooltip placement="right" title={
                                                    <span className={classes.tooltipText}>
                                                        These dates will be used along with advanced winning moment generator.<br/>
                                                        They are optional and shouldn't be mistaken with promotion's or config's start/end dates.
                                                    </span>
                                                }>
                                                    <InfoIcon className={classes.checkboxTooltipIcon} fontSize="small" />
                                                </Tooltip>
                                            </Typography>

                                        </Fragment>
                                        }
                                        disabled={store.formDisabled}
                                    />
                                </div>
                            </div>
                        }
                        {!store.cost && store.useStartEndDates &&
                            <Fragment>
                                <div className={classes.rowContainer}>
                                    <label className={classes.label}>
                                        <Typography variant="body2" gutterBottom>Start date</Typography>
                                    </label>
                                    <DatePicker
                                        selected={new Date(store.startDate)}
                                        onChange={(value) => handleDateTimeChange(prepareDateTimePickerParams('startDate', new Date(value).getTime()))}
                                        className={`${classes.textField} ${classes.dateField} ${store.formDisabled ? classes.disabled : ''}`}
                                        calendarClassName={classes.calendarField}
                                        disabled={store.formDisabled}
                                        placeholderText="This is disabled"
                                        value={new Date(store.startDate).toUTCString()}
                                        minDate={new Date()}
                                    />
                                </div>
                                <div className={classes.rowContainer}>
                                    <label className={classes.label}>
                                        <Typography variant="body2" gutterBottom>Start date timezone</Typography>
                                    </label>
                                    <Select
                                        value={store.startDateUTC}
                                        onChange={(event) => onSelectChange(event)}
                                        name={startDateUTC}
                                        disabled={store.formDisabled}
                                        style={store.formDisabled ? { opacity: 0.3 } : {}}
                                        className={classes.select}
                                        required
                                        disableUnderline
                                        validators={['required']}
                                        errorMessages={['This field is required']}
                                    >
                                        <MenuItem value={"UTC+1"}>
                                            <Typography variant="body2" gutterBottom>UTC+1</Typography>
                                        </MenuItem>
                                        <MenuItem value={"UTC+2"}>
                                            <Typography variant="body2" gutterBottom>UTC+2</Typography>
                                        </MenuItem>
                                        <MenuItem value={"UTC+3"}>
                                            <Typography variant="body2" gutterBottom>UTC+3</Typography>
                                        </MenuItem>
                                    </Select>
                                </div>
                                <div className={classes.rowContainer}>
                                    <label className={classes.label}>
                                        <Typography variant="body2" gutterBottom>End date</Typography>
                                    </label>
                                    <DatePicker
                                        selected={new Date(new Date(store.endDate).setDate(new Date(store.endDate).getDate() - 1))}
                                        onChange={(value) => handleDateTimeChange(prepareDateTimePickerParams('endDate', new Date(new Date(value).setDate(new Date(value).getDate() + 1)).getTime()))}
                                        className={`${classes.textField} ${classes.dateField} ${store.formDisabled ? classes.disabled : ''}`}
                                        calendarClassName={classes.calendarField}
                                        disabled={store.formDisabled}
                                        value={new Date(store.endDate).toUTCString()}
                                        minDate={new Date(store.startDate)}
                                    />
                                </div>
                                <div className={classes.rowContainer}>
                                    <label className={classes.label}>
                                        <Typography variant="body2" gutterBottom>End date timezone</Typography>
                                    </label>
                                    <Select
                                        value={store.endDateUTC}
                                        onChange={(event) => onSelectChange(event)}
                                        name={endDateUTC}
                                        disabled={store.formDisabled}
                                        style={store.formDisabled ? { opacity: 0.3 } : {}}
                                        className={classes.select}
                                        required
                                        disableUnderline
                                        validators={['required']}
                                        errorMessages={['This field is required']}
                                    >
                                        <MenuItem value={"UTC+1"}>
                                            <Typography variant="body2" gutterBottom>UTC+1</Typography>
                                        </MenuItem>
                                        <MenuItem value={"UTC+2"}>
                                            <Typography variant="body2" gutterBottom>UTC+2</Typography>
                                        </MenuItem>
                                        <MenuItem value={"UTC+3"}>
                                            <Typography variant="body2" gutterBottom>UTC+3</Typography>
                                        </MenuItem>
                                    </Select>
                                </div>
                                <div className={classes.checkboxCtnr}>
                                    <div className={classes.rowContainer}>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={store.hasExpirableMoments}
                                                    onChange={event => handleDateTimeToggle(event)}
                                                    name="hasExpirableMoments"
                                                />
                                            }
                                            label={<Fragment>
                                                <Typography variant="body2">Does the prize contains expirable winning moments
                                                    <Tooltip placement="right" title={
                                                        <span className={classes.tooltipText}>
                                                            If the prize has expirable winning moments please select the checkbox,
                                                            in order to use the expirable winning moments logic properly.<br/>
                                                            The moments will be expired by a cron job that runs at a certain time,
                                                            but the moments won't be visible for clients which participated after the end date.
                                                        </span>
                                                    }>
                                                        <InfoIcon className={classes.checkboxTooltipIcon} fontSize="small" />
                                                    </Tooltip>
                                                </Typography>

                                            </Fragment>
                                            }
                                            disabled={store.formDisabled}
                                        />
                                    </div>
                                </div>
                            </Fragment>
                        }
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Delivery type</Typography>
                            </label>
                            <Select
                                value={store.deliveryType}
                                onChange={(event) => onSelectChange(event)}
                                name={deliveryType}
                                disabled={store.formDisabled}
                                style={store.formDisabled ? { opacity: 0.3 } : {}}
                                className={classes.select}
                                required
                                disableUnderline
                                validators={['required']}
                                errorMessages={['This field is required']}
                            >
                                <MenuItem value={1}>
                                    <Typography variant="body2" gutterBottom>Digital</Typography>
                                </MenuItem>
                                <MenuItem value={2}>
                                    <Typography variant="body2" gutterBottom>Physical</Typography>
                                </MenuItem>
                            </Select>
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Redemption link</Typography>
                                <Tooltip placement="right" title={
                                    <span className={classes.tooltipText}>
                                        A valid URL should start with <b>http:&#47;&#47;</b> or <b>https:&#47;&#47;</b>.<br/>
                                        A valid email can start with <b>mailto:</b> and can contain parameters like <b>subject</b>, <b>body</b>, etc.<br/>
                                        No whitespaces allowed.
                                    </span>
                                }>
                                    <InfoIcon className={classes.tooltipIcon} fontSize="small" />
                                </Tooltip>
                            </label>
                            <TextValidator
                                id={redemptionLink}
                                name={redemptionLink}
                                className={classes.textField}
                                value={store.redemptionLink?.trim()}
                                disabled={store.formDisabled}
                                style={store.formDisabled ? { opacity: 0.3 } : {}}
                                validators={['isEmptyOrUrlOrEmailLink']}
                                errorMessages={['Not a valid url or an email link']}
                                onChange={(event) => onTextInputChange(event)}
                                margin="normal"
                                inputProps={{
                                    maxLength: 300
                                }}
                                InputProps={{
                                    disableUnderline: true
                                }}
                            />
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Barcode type</Typography>
                            </label>
                            <Select
                                value={store.barcodeType}
                                onChange={(event) => onSelectChange(event)}
                                name={barcodeType}
                                disabled={store.formDisabled}
                                style={store.formDisabled ? { opacity: 0.3 } : {}}
                                className={classes.select}
                                required
                                disableUnderline
                                validators={['required']}
                                errorMessages={['This field is required']}
                            >
                                <MenuItem value={0}>
                                    <Typography variant="body2" gutterBottom>None</Typography>
                                </MenuItem>
                                <MenuItem value={1}>
                                    <Typography variant="body2" gutterBottom>QR Code</Typography>
                                </MenuItem>
                                <MenuItem value={2}>
                                    <Typography variant="body2" gutterBottom>Code 128</Typography>
                                </MenuItem>
                                <MenuItem value={3}>
                                    <Typography variant="body2" gutterBottom>Code 32</Typography>
                                </MenuItem>
                                <MenuItem value={4}>
                                    <Typography variant="body2" gutterBottom>Data matrix</Typography>
                                </MenuItem>
                                <MenuItem value={5}>
                                    <Typography variant="body2" gutterBottom>UPC</Typography>
                                </MenuItem>
                            </Select>
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Priority</Typography>
                            </label>
                            <TextValidator
                                name={priority}
                                value={store.priority}
                                className={classes.textField}
                                disabled={store.formDisabled}
                                style={store.formDisabled ? { opacity: 0.3 } : {}}
                                onChange={event => onNumberInputChange(event.target.valueAsNumber, event.target.name)}
                                margin="normal"
                                required
                                type="number"
                                validators={['required', 'isNumber', 'minNumber:1', 'maxNumber:100']}
                                errorMessages={['This field is required', 'Must be number', 'Must be between 1 and 100', 'Must be between 1 and 100']}
                                InputProps={{
                                    disableUnderline: true
                                }}
                            />
                        </div>
                        {
                            !store.cost &&
                            <div className={classes.rowContainer}>
                                <label className={classes.label}>
                                    <Typography variant="body2" gutterBottom>Tier</Typography>
                                </label>
                                <TextValidator
                                    name={tier}
                                    value={store.tier}
                                    className={classes.textField}
                                    disabled={store.formDisabled}
                                    style={store.formDisabled ? { opacity: 0.3 } : {}}
                                    onChange={event => onNumberInputChange(event.target.valueAsNumber, event.target.name)}
                                    margin="normal"
                                    type="number"
                                    validators={['isNumber', 'minNumber:1', 'maxNumber:100']}
                                    errorMessages={['Must be number', 'Must be between 1 and 100', 'Must be between 1 and 100']}
                                    InputProps={{ disableUnderline: true }}
                                />
                            </div>
                        }
                        {
                            store.cost &&
                            <div className={classes.rowContainer}>
                                <label className={classes.label}>
                                    <Typography variant="body2" gutterBottom>Redemption Limit</Typography>
                                </label>
                                <TextValidator
                                    name={redemptionLimit}
                                    value={store.redemptionLimit || ""}
                                    className={classes.textField}
                                    disabled={store.formDisabled}
                                    style={store.formDisabled ? { opacity: 0.3 } : {}}
                                    onChange={(event) => onNumberInputChange(event.target.valueAsNumber, event.target.name)}
                                    margin="normal"
                                    type="number"
                                    validators={['isNumber', 'minNumber:1', 'maxNumber:100']}
                                    errorMessages={['Must be a number', 'Must be between 1 and 100', 'Must be between 1 and 100']}
                                    InputProps={{
                                        disableUnderline: true
                                    }}
                                />
                            </div>
                        }
                        {
                            store.voucherDist &&
                            <div className={classes.rowContainer}>
                                <label className={classes.label}>
                                    <Typography variant="body2" gutterBottom>Final state</Typography>
                                </label>
                                <Select
                                    value={store.finalState}
                                    onChange={(event) => onSelectChange(event)}
                                    name={finalState}
                                    disabled={store.formDisabled}
                                    style={store.formDisabled ? { opacity: 0.3 } : {}}
                                    className={classes.select}
                                    disableUnderline
                                >
                                    <MenuItem value={"redeemed"}>
                                        <Typography variant="body2" gutterBottom>Redeemed</Typography>
                                    </MenuItem>
                                    <MenuItem value={"claimed"}>
                                        <Typography variant="body2" gutterBottom>Claimed</Typography>
                                    </MenuItem>
                                </Select>
                            </div>
                        }

                        <div className={classes.rowContainer}>
                            <PrizeTags tags={store.tags} onAddition={this.props.onTagAddition} onRemoval={this.props.onTagRemoval} disabled={store.formDisabled} />
                        </div>

                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Minimum age</Typography>
                            </label>
                            <TextValidator
                                name={minAge}
                                value={store.minAge}
                                className={classes.textField}
                                disabled={store.formDisabled}
                                style={store.formDisabled ? { opacity: 0.3 } : {}}
                                onChange={event => onNumberInputChange(event.target.valueAsNumber, event.target.name)}
                                margin="normal"
                                type="number"
                                validators={['isNumber', 'minNumber:1', 'maxNumber:120']}
                                errorMessages={['Must be a number', 'Must be between 1 and 120', 'Must be between 1 and 120']}
                                InputProps={{
                                    disableUnderline: true
                                }}
                            />
                        </div>

                        { store.voucherDist &&
                            <div className={classes.checkboxCtnr}>
                                <div className={classes.rowContainer}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={store.enableValidityPeriodAfterClaim}
                                                onChange={event => handleValidityPeriodToggle(event)}
                                                name="enableValidityPeriodAfterClaim"
                                            />
                                        }
                                        label={
                                            <Fragment>
                                                <Typography variant="body2">Validity Period After Claim
                                                    <Tooltip placement="right" title={
                                                        <span className={classes.tooltipText}>
                                                            Period during which a voucher for this prize has to be redeemed.<br/>
                                                            For example, if 30 is entered, the validity period starts counting on the day when a voucher was claimed plus 29 days.
                                                        </span>
                                                    }>
                                                        <InfoIcon className={classes.checkboxTooltipIcon} fontSize="small" />
                                                    </Tooltip>
                                                </Typography>
                                            </Fragment>
                                        }
                                        disabled={store.formDisabled}
                                    />
                                </div>
                            </div>
                        }

                        { store.voucherDist && store.enableValidityPeriodAfterClaim &&
                            <div className={classes.rowContainer}>
                                <label className={classes.label}>
                                    <Typography variant="body2" gutterBottom>Validity Period</Typography>
                                </label>
                                <TextValidator
                                    name={validityPeriodAfterClaim}
                                    value={store.validityPeriodAfterClaim}
                                    className={classes.textField}
                                    disabled={store.formDisabled}
                                    style={store.formDisabled ? { opacity: 0.3 } : {}}
                                    onChange={(event) => onNumberInputChange(event.target.value, event.target.name)}
                                    margin="normal"
                                    type="number"
                                    validators={['isEmptyOrGreaterThanZero']}
                                    errorMessages={['Must be empty or greater than 0']}
                                    InputProps={{
                                        disableUnderline: true
                                    }}
                                />
                            </div>
                        }

                        <div className={classes.rowContainer}>
                            <Button type="submit" variant="contained" className={classes.button} disabled={store.formDisabled}
                                style={store.formDisabled ? { opacity: 0.3 } : {}}>Save</Button>
                        </div>
                    </ValidatorForm>
                </Paper>
            </Fragment>
        );
    };
};

export default withStyles(styles)(PrizeForm);
