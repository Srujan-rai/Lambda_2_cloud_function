import React, { Fragment, Component } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { Avatar, Button, Chip, Checkbox, ListItemText, MenuItem, Paper, Select, Typography } from '@material-ui/core';
import { ValidatorForm, TextValidator } from 'react-material-ui-form-validator';
import * as PromotionOptions from '../../constants/lists';
import DatePicker from "react-datepicker";
import { prepareDateTimePickerParams } from "../../helpers/utils";
import "react-datepicker/dist/react-datepicker.css";


const propTypes = {
    store: PropTypes.shape({
        promotionName: PropTypes.string.isRequired,
        promotionOwner: PropTypes.string.isRequired,
        promotionAuthor: PropTypes.string.isRequired,
        promotionMarket: PropTypes.string.isRequired,
        promotionBu: PropTypes.string.isRequired,
        promotionTg: PropTypes.array.isRequired,
        promotionBrand: PropTypes.array.isRequired,
        promotionPrizeType: PropTypes.array.isRequired,
        promotionFunction: PropTypes.string.isRequired,
        promotionCampaign: PropTypes.string.isRequired,
        promotionEntity: PropTypes.string.isRequired,
        promotionTransaction: PropTypes.bool.isRequired,
        digitalExperience: PropTypes.array.isRequired,
        promoType: PropTypes.array.isRequired,
        promotionStartUtc: PropTypes.string.isRequired,
        promotionEndUtc: PropTypes.string.isRequired,
    }).isRequired,
    onTextInputChange: PropTypes.func.isRequired,
    onSelectChange: PropTypes.func.isRequired,
    classes: PropTypes.object.isRequired,
    onSave: PropTypes.func.isRequired,
    onDateTimeChange: PropTypes.func.isRequired
};

const defaultProps = {};

const styles = (theme) => ({
    root: {
        color: "#f40000",
        marginBottom: "50px"
    },
    chip: {
        margin: "30px 0 30px 90px"
    },
    container: {
        width: "100%",
        display: "flex",
        flexDirection: "row",
        marginTop: "30px",
        flexWrap: "wrap",
        justify: "flex-start",
        alignItems: "flex-start",
        marginLeft: "30px"
    },
    textField: {
        backgroundColor: "white",
        width: "260px",
        height: "35px",
        borderRadius: "5px",
        boxShadow: "0px 0px 0px 2px #f40000",
        paddingLeft: "10px",
        paddingRight: "5px",
        paddingTop: "5px",
        display: "flex",
        flexDirection: "row"
    },
    dateField: {
        border: "none",
        "&:focus": {
            outline: "none"
        },
        marginTop: "10px",
        marginBottom: "5px"
    },
    calendarField: {
        marginTop: "30px"
    },
    label: {
        width: "250px",
        flexDirection: "row",
        justify: "flex-start",
        alignItems: "flex-start",
        display: "inherit"
    },
    rowContainer: {
        marginLeft: "65px",
        display: "inline",
        flexDirection: "column",
        justify: "flex-start",
        alignItems: "flex-start",
        minHeight: "100px"
    },
    select: {
        width: "260px",
        color: "black",
        borderRadius: "3px",
        boxShadow: "0px 0px 0px 2px #f40000",
        height: "35px",
        paddingTop: "3px",
        display: "flex",
        flexDirection: "column",
        justify: "flex-start",
        alignItems: "flex-start",
        paddingLeft: "20px",
        marginTop: "15px",
        marginBottom: "5px"
    },
    button: {
        marginBottom: "50px",
        marginTop: "35px",
        color: "white",
        height: "35px",
        width: "100px",
        backgroundColor: "#f40000",
        borderRadius: "5px solid white"
    },
    buttonContainer: {
        justifyContent: "flex-end",
        marginLeft: "65px"
    },
    headingContainer: {
        width: "500px",
        padding: "10px",
        fontSize: "20px"
    },
    messages: {
        color: "red",
        fontWeight: "bold",
        fontSize: 12
    }
});

const promotionName = "promotionName";
const promotionOwner = "promotionOwner";
const promotionAuthor = "promotionAuthor";
const promotionMarket = "promotionMarket";
const promotionBu = "promotionBu";
const promotionTg = "promotionTg";
const promotionBrand = "promotionBrand";
const promotionPrizeType = "promotionPrizeType";
const promotionFunction = "promotionFunction";
const promotionCampaign = "promotionCampaign";
const promotionEntity = "promotionEntity";
const promotionTransaction = "promotionTransaction";
const digitalExperience = "digitalExperience";
const promoType = "promoType";
const promotionStartUtc = "promotionStartUtc";
const promotionEndUtc = "promotionEndUtc";

class PromotionForm extends Component {

    render() {
        const { classes, store, onTextInputChange, onSelectChange, onSave, onDateTimeChange } = this.props;
        const startDate = store.promotionStartUtc ? new Date(store.promotionStartUtc) : store.promotionStartUtc;
        const endDate = store.promotionEndUtc ? new Date(store.promotionEndUtc) : store.promotionEndUtc;
        return (
            <Fragment>
                <Paper>
                    <Chip
                        avatar={<Avatar>PR</Avatar>}
                        label={store.promotionId ? "Edit Promotion" : "Add New Promotion"}
                        color="primary"
                        className={classes.chip}
                    />
                    <ValidatorForm className={classes.container} autoComplete="off" onSubmit={event => onSave(event)}>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Promotion name</Typography>
                            </label>
                            <TextValidator
                                id={promotionName}
                                name={promotionName}
                                value={store.promotionName}
                                onChange={(event) => onTextInputChange(event)}
                                className={classes.textField}
                                margin="normal"
                                InputProps={{
                                    disableUnderline: true
                                }}
                                inputProps={{
                                    minLength: 10,
                                    maxLength: 50
                                }}
                            />
                            {store.messages && !!store.messages.promotionName &&
                                <div className={classes.messages}>
                                    {store.messages.promotionName}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Promotion owner</Typography>
                            </label>
                            <TextValidator
                                id={promotionOwner}
                                name={promotionOwner}
                                value={store.promotionOwner}
                                onChange={(event) => onTextInputChange(event)}
                                className={classes.textField}
                                margin="normal"
                                inputProps={{
                                    minLength: 10,
                                    maxLength: 100
                                }}
                                InputProps={{
                                    disableUnderline: true,
                                }}
                            />
                            {store.messages && !!store.messages.promotionOwner &&
                                <div className={classes.messages}>
                                    {store.messages.promotionOwner}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Promotion author</Typography>
                            </label>
                            <TextValidator
                                id={promotionAuthor}
                                name={promotionAuthor}
                                value={store.promotionAuthor}
                                onChange={(event) => onTextInputChange(event)}
                                className={classes.textField}
                                margin="normal"
                                inputProps={{
                                    minLength: 10,
                                    maxLength: 100
                                }}
                                InputProps={{
                                    disableUnderline: true,
                                }}
                            />
                            {store.messages && !!store.messages.promotionAuthor &&
                                <div className={classes.messages}>
                                    {store.messages.promotionAuthor}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Promotion market</Typography>
                            </label>
                            <Select
                                value={store.promotionMarket}
                                onChange={(event) => onSelectChange(event)}
                                name={promotionMarket}
                                className={classes.select}
                                required
                                disableUnderline
                                validators={['required']}
                                errorMessages={['This field is required']}
                            >
                                {PromotionOptions.promotionMarketList.map(promotionMarket => (
                                    <MenuItem key={promotionMarket} value={promotionMarket}>
                                        {promotionMarket}
                                    </MenuItem>
                                ))}
                            </Select>
                            {store.messages && !!store.messages.promotionMarket &&
                                <div className={classes.messages}>
                                    {store.messages.promotionMarket}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Promotion operating unit</Typography>
                            </label>
                            <Select
                                value={store.promotionBu}
                                onChange={(event) => onSelectChange(event)}
                                name={promotionBu}
                                className={classes.select}
                                required
                                disableUnderline
                                validators={['required']}
                                errorMessages={['This field is required']}
                            >
                                {PromotionOptions.promotionBUList.map(promotionBu => (
                                    <MenuItem key={promotionBu} value={promotionBu}>
                                        {promotionBu}
                                    </MenuItem>
                                ))}
                            </Select>
                            {store.messages && !!store.messages.promotionBu &&
                                <div className={classes.messages}>
                                    {store.messages.promotionBu}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Promotion target group</Typography>
                            </label>
                            <Select
                                multiple
                                value={store.promotionTg}
                                onChange={(event) => onSelectChange(event)}
                                name={promotionTg}
                                className={classes.select}
                                required
                                disableUnderline
                                validators={['required']}
                                errorMessages={['This field is required']}
                                renderValue={selected => selected.join(', ')}
                            >
                                {PromotionOptions.promotionTGList.map(promotionTg => (
                                    <MenuItem key={promotionTg} value={promotionTg}>
                                        <Checkbox checked={store.promotionTg.indexOf(promotionTg) > -1} />
                                        <ListItemText primary={promotionTg} />
                                    </MenuItem>
                                ))}
                            </Select>
                            {store.messages && !!store.messages.promotionTg &&
                                <div className={classes.messages}>
                                    {store.messages.promotionTg}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Promotion brand</Typography>
                            </label>
                            <Select
                                multiple
                                value={store.promotionBrand}
                                onChange={(event) => onSelectChange(event)}
                                name={promotionBrand}
                                className={classes.select}
                                required
                                disableUnderline
                                validators={['required']}
                                errorMessages={['This field is required']}
                                renderValue={selected => selected.join(', ')}
                            >
                                {PromotionOptions.promotionBrandList.map(promotionBrand => (
                                    <MenuItem key={promotionBrand} value={promotionBrand}>
                                        <Checkbox checked={store.promotionBrand.indexOf(promotionBrand) > -1} />
                                        <ListItemText primary={promotionBrand} />
                                    </MenuItem>
                                ))}
                            </Select>
                            {store.messages && !!store.messages.promotionBrand &&
                                <div className={classes.messages}>
                                    {store.messages.promotionBrand}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Promotion prize type</Typography>
                            </label>
                            <Select
                                multiple
                                value={store.promotionPrizeType}
                                onChange={(event) => onSelectChange(event)}
                                name={promotionPrizeType}
                                className={classes.select}
                                required
                                disableUnderline
                                validators={['required']}
                                errorMessages={['This field is required']}
                                renderValue={selected => selected.join(', ')}
                            >
                                {PromotionOptions.promotionPrizeTypeList.map(promotionPrizeType => (
                                    <MenuItem key={promotionPrizeType} value={promotionPrizeType}>
                                        <Checkbox checked={store.promotionPrizeType.indexOf(promotionPrizeType) > -1} />
                                        <ListItemText primary={promotionPrizeType} />
                                    </MenuItem>
                                ))}
                            </Select>
                            {store.messages && !!store.messages.promotionPrizeType &&
                                <div className={classes.messages}>
                                    {store.messages.promotionPrizeType}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Promotion function</Typography>
                            </label>
                            <Select
                                value={store.promotionFunction}
                                onChange={(event) => onSelectChange(event)}
                                name={promotionFunction}
                                className={classes.select}
                                required
                                disableUnderline
                                validators={['required']}
                                errorMessages={['This field is required']}
                            >
                                {PromotionOptions.promotionFunctionList.map(promotionFunction => (
                                    <MenuItem key={promotionFunction} value={promotionFunction}>
                                        {promotionFunction}
                                    </MenuItem>
                                ))}
                            </Select>
                            {store.messages && !!store.messages.promotionFunction &&
                                <div className={classes.messages}>
                                    {store.messages.promotionFunction}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Promotion campaign</Typography>
                            </label>
                            <Select
                                value={store.promotionCampaign}
                                onChange={(event) => onSelectChange(event)}
                                name={promotionCampaign}
                                className={classes.select}
                                required
                                disableUnderline
                                validators={['required']}
                                errorMessages={['This field is required']}
                            >
                                {PromotionOptions.promotionCampaignList.map(promotionCampaign => (
                                    <MenuItem key={promotionCampaign} value={promotionCampaign}>
                                        {promotionCampaign}
                                    </MenuItem>
                                ))}
                            </Select>
                            {store.messages && !!store.messages.promotionCampaign &&
                                <div className={classes.messages}>
                                    {store.messages.promotionCampaign}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Promotion entity</Typography>
                            </label>
                            <Select
                                value={store.promotionEntity}
                                onChange={(event) => onSelectChange(event)}
                                name={promotionEntity}
                                className={classes.select}
                                required
                                disableUnderline
                                validators={['required']}
                                errorMessages={['This field is required']}
                            >
                                {PromotionOptions.promotionEntityList.map(promotionEntity => (
                                    <MenuItem key={promotionEntity} value={promotionEntity}>
                                        {promotionEntity}
                                    </MenuItem>
                                ))}
                            </Select>
                            {store.messages && !!store.messages.promotionEntity &&
                                <div className={classes.messages}>
                                    {store.messages.promotionEntity}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Promotion transaction required</Typography>
                            </label>
                            <Select
                                value={store.promotionTransaction}
                                onChange={(event) => onSelectChange(event)}
                                name={promotionTransaction}
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
                            {store.messages && !!store.messages.promotionTransaction &&
                                <div className={classes.messages}>
                                    {store.messages.promotionTransaction}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Digital experience</Typography>
                            </label>
                            <Select
                                multiple
                                value={store.digitalExperience}
                                onChange={(event) => onSelectChange(event)}
                                name={digitalExperience}
                                className={classes.select}
                                required
                                disableUnderline
                                validators={['required']}
                                errorMessages={['This field is required']}
                                renderValue={selected => selected.join(', ')}
                            >
                                {PromotionOptions.digitalExperienceList.map(digitalExperience => (
                                    <MenuItem key={digitalExperience} value={digitalExperience}>
                                        <Checkbox checked={store.digitalExperience.indexOf(digitalExperience) > -1} />
                                        <ListItemText primary={digitalExperience} />
                                    </MenuItem>
                                ))}
                            </Select>
                            {store.messages && !!store.messages.digitalExperience &&
                                <div className={classes.messages}>
                                    {store.messages.digitalExperience}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Promo type</Typography>
                            </label>
                            <Select
                                multiple
                                value={store.promoType}
                                onChange={(event) => onSelectChange(event)}
                                name={promoType}
                                className={classes.select}
                                required
                                disableUnderline
                                validators={['required']}
                                errorMessages={['This field is required']}
                                renderValue={selected => selected.join(', ')}
                            >
                                {PromotionOptions.promoTypeList.map(promoType => (
                                    <MenuItem key={promoType} value={promoType}>
                                        <Checkbox checked={store.promoType.indexOf(promoType) > -1} />
                                        <ListItemText primary={promoType} />
                                    </MenuItem>
                                ))}
                            </Select>
                            {store.messages && !!store.messages.promoType &&
                                <div className={classes.messages}>
                                    {store.messages.promoType}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Start date</Typography>
                            </label>
                            <DatePicker
                                selected={startDate}
                                onChange={(value) => onDateTimeChange(prepareDateTimePickerParams(promotionStartUtc, value))}
                                showTimeSelect
                                dateFormat="MM/dd/yyyy h:mm aa"
                                className={`${classes.textField} ${classes.dateField}`}
                                calendarClassName={classes.calendarField}
                                minDate={new Date()}
                            />
                            {store.messages && !!store.messages.promotionStartUtc &&
                                <div className={classes.messages}>
                                    {store.messages.promotionStartUtc}
                                </div>
                            }
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>End date</Typography>
                            </label>
                            <DatePicker
                                selected={endDate}
                                onChange={(value) => onDateTimeChange(prepareDateTimePickerParams(promotionEndUtc, value))}
                                showTimeSelect
                                dateFormat="MM/dd/yyyy h:mm aa"
                                className={`${classes.textField} ${classes.dateField}`}
                                calendarClassName={classes.calendarField}
                                minDate={new Date(startDate)}
                            />
                            {store.messages && !!store.messages.promotionEndUtc &&
                                <div className={classes.messages}>
                                    {store.messages.promotionEndUtc}
                                </div>
                            }
                        </div>
                        <div className={classes.buttonContainer}>
                            <Button type="submit" variant="contained" className={classes.button}>Save</Button>
                        </div>
                    </ValidatorForm>
                </Paper>
            </Fragment>
        );
    };
};

PromotionForm.propTypes = propTypes;
PromotionForm.defaultProps = defaultProps;

export default withStyles(styles)(PromotionForm);
