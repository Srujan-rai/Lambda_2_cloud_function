import React, { Fragment, Component } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { Avatar, Chip, Checkbox, FormControlLabel, Paper, Typography } from '@material-ui/core';
import { ValidatorForm, TextValidator} from 'react-material-ui-form-validator';
import { connect } from 'react-redux';
import { compose } from 'lodash/fp';
import { CONFIGURATION_FORM } from '../../constants/forms';
import SingleInputComponent from '../singleInputComponent/singleInputComponent';



const propTypes = {
    /** Flow label key from flowLabelMap defined in lists.js file. It is used in order to render options of specific flow - functionality */
    flowLabelKey: PropTypes.string,
    /** Callback function to be triggered for modifying value of parameter that belongs to params property */
    changeParam: PropTypes.func.isRequired,
    /** Callback function to be triggered for removing param from params property */
    removeParam: PropTypes.func.isRequired,
    /** Callback function to be triggered for modifying value of secret parameter that belongs to secrets property */
    changeSecret: PropTypes.func.isRequired,
    /** Callback function to be triggered for removing secret from secrets property */
    removeSecret: PropTypes.func.isRequired,
    /** Callback function that should add new checker lambda in checker lamdas array */
    addToCheckerLambdas: PropTypes.func.isRequired,
    /** Callback function that should remove checker lambda from checker lamdas array */
    removeFromCheckerLambdas: PropTypes.func.isRequired,
    /** @ignore */
    classes: PropTypes.object.isRequired
};

const defaultProps = {};
const LOT_IDS = "lotIds"
const maxLotIds = 20;
const CAMPAIGN_IDS = "campaignIds"
const maxCampaignIds = 20;

const styles = (theme) => ({
    chip: {
        margin: "30px 0 30px 137px"
    },
    container: {
        width: "100%",
        marginLeft: "10px",
        display: "flex",
        flexDirection: "column",
        flexWrap: "wrap",
        justify: "flex-start",
        alignItems: "flex-start",
        marginLeft: "150px"
    },
    paper: {
        marginBottom: 20,
        paddingBottom: 20,
        width: '90%'
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
        marginBottom: "10px",
        marginTop: "5px",
        display: "flex",
        flexDirection: "column",
    },
    label: {
        width: "250px",
        display: "flex",
        flexDirection: "column",
        justify: "flex-start",
        alignItems: "flex-start",
        display: "inherit"
    },
    rowContainer: {
        marginLeft: "35px",
        marginTop: "10px",
        display: "inline"
    },
    select: {
        width: "260px",
        marginLeft: "65px",
        color: "black",
        borderRadius: "3px",
        boxShadow: "0px 0px 0px 2px #f40000",
        height: "35px",
        marginBottom: "10px",
        display: "flex",
        flexDirection: "column",
        justify: "flex-start",
        alignItems: "flex-start",
        paddingLeft: "20px",
        paddingTop: "3px",
        marginTop: "5px",
    },
    headingContainer: {
        width: "500px",
        padding: "10px",
        margin: "auto",
        fontSize: "20px"
    },
    rowContainerParent: {
        marginLeft: "20px",
        marginTop: "10px",
    },
    rowContainerChild: {
        width: "50%",
        float: "left",
        padding: "20px"
    }

});

class ConfigurationFlowAutomaticChecks extends Component {
    state = {
        minAge: false,
        captchaSecret: false,
        pincodeOriginValidity: false,
        showPincodeOrigin: false,
        showPincodeOriginInput: false
    };

    componentDidMount = () => {
        const { minAge, captchaSecret, pincodeOriginValidity, flowLabelKey } = this.props;

        if (minAge) {
            this.setState({
                minAge: true
            });
        }

        if (captchaSecret) {
            this.setState({
                captchaSecret: true
            });
        }

        if (pincodeOriginValidity) {
            this.setState({
                pincodeOriginValidity: true
            });
        }

        if (flowLabelKey === "redeemPincodeForCurrencies") {
            this.setState({
                showPincodeOrigin: true
            });
        }

        if (flowLabelKey === "redeemPincode" || flowLabelKey === "instantWin" || flowLabelKey === "promoEntry" || flowLabelKey === "redeemPincodeForCurrencies") {
            this.setState({
                showPincodeOrigin: true,
                showPincodeOriginInput: true
            });
        }

        if (flowLabelKey === "instantWin" || flowLabelKey === "promoEntry") {
            this.setState({
                displayCaptcha: false
            });
        }
    };

    handleChange = event => {
        const name = event.target.name;
        const isChecked = event.target.checked;
        this.setState({ [name]: isChecked });
        if (!isChecked) {
            const { removeParam, removeSecret, removeFromCheckerLambdas } = this.props;
            switch (name) {
                case "minAge":
                    removeParam(name);
                    removeFromCheckerLambdas("age");
                    break;
                case "captchaSecret":
                    removeSecret(name);
                    break;
                case "pincodeOriginValidity":
                    removeFromCheckerLambdas("pincodeOriginValidityCheckerLambda");
                    break;
            }
        } else {
            const { changeParam, changeSecret, addToCheckerLambdas } = this.props;
            switch (name) {
                case "minAge":
                    changeParam(event.target.name, event.target.value);
                    addToCheckerLambdas("age");
                    break;
                case "captchaSecret":
                    changeSecret(event)
                    break;
                case "pincodeOriginValidity":
                    addToCheckerLambdas("pincodeOriginValidityCheckerLambda");
                    break;
            }
        }
    };


    onChangeLotIdOrCampaignId = (idx, valuesToUpdate, paramToUpdate) => (event) => {
        const { lotIds, campaignIds, changeParam} = this.props;
            let idsArray = [...valuesToUpdate];
            idsArray[idx] = +event.target.value;
            changeParam(paramToUpdate, idsArray);

    };

    addRowLotIdOrCampaignId = (valuesToUpdate, paramToUpdate) => (event) => {
        const { lotIds, campaignIds, changeParam } = this.props;
        let newId = ""
        let idsArray = [...valuesToUpdate];
        if (idsArray.length < maxLotIds && idsArray.length < maxCampaignIds){
            idsArray.push(newId);
            changeParam(paramToUpdate, idsArray);
    }
    };

    deleteRowLotIdOrCampaignId = (idx, valuesToUpdate, paramToUpdate) => (event) => {
        const { lotIds, campaignIds, changeParam } = this.props;
        let idsArray = [...valuesToUpdate];
            idsArray.splice(idx, 1);
            changeParam(paramToUpdate, idsArray)
    };




    render() {
        const { classes, changeParam, changeSecret, minAge, captchaSecret, lotIds, campaignIds } = this.props;

        return (
            <Fragment>
                <Paper className={classes.paper}>
                    <Chip
                        avatar={<Avatar>AC</Avatar>}
                        label="Automatic Checks"
                        color="primary"
                        className={classes.chip}
                    />
                    <ValidatorForm className={classes.container} autoComplete="off">
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={this.state.minAge}
                                    onChange={this.handleChange}
                                    name="minAge"
                                />
                            }
                            label="User Age"
                        />
                        {this.state.minAge &&
                            <div className={classes.rowContainer}>
                                <label className={classes.label}>
                                    <Typography variant="body2" gutterBottom>Min age</Typography>
                                </label>
                                <TextValidator
                                    id="minAge"
                                    name="minAge"
                                    className={classes.textField}
                                    margin="normal"
                                    required
                                    type="number"
                                    validators={['required', 'isNumber', 'isPositive']}
                                    errorMessages={['This field is required', 'Type must be number!', 'Number must be positive']}
                                    InputProps={{
                                        disableUnderline: true
                                    }}
                                    onChange={(event) => {
                                        changeParam(event.target.name, event.target.value);
                                    }}
                                    value={minAge || 0}
                                />
                            </div>
                        }
                        {this.state.displayCaptcha &&
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={this.state.captchaSecret}
                                    onChange={this.handleChange}
                                    name="captchaSecret"
                                />
                            }
                            label="Captcha Validation"
                        />
                        }
                        {this.state.captchaSecret &&
                            <div className={classes.rowContainer}>
                                <label className={classes.label}>
                                    <Typography variant="body2" gutterBottom>Captcha secret</Typography>
                                </label>
                                <TextValidator
                                    id="captchaSecret"
                                    name="captchaSecret"
                                    className={classes.textField}
                                    margin="normal"
                                    InputProps={{
                                        disableUnderline: true
                                    }}
                                    onChange={changeSecret}
                                    value={captchaSecret || ''}
                                />
                            </div>
                        }
                        {this.state.showPincodeOrigin &&
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={this.state.pincodeOriginValidity}
                                        onChange={this.handleChange}
                                        name="pincodeOriginValidity"
                                    />
                                }
                                label="Pincode Origin Validation"
                            />
                        }

                        {(this.state.showPincodeOriginInput && this.state.pincodeOriginValidity) &&
                            <Fragment>
                                <div className={classes.rowContainerParent}>
                                    <div className={classes.rowContainerChild}>
                                        <div className={classes.rowContainer} style={{ width: "100%" }}>
                                            <label className={classes.label}>
                                                <Typography variant="body2" gutterBottom>Enter allowed lot IDs:</Typography>
                                            </label>
                                            <div>
                                                {
                                                    (lotIds.length >= maxLotIds) &&
                                                    <Typography variant="body2" gutterBottom color="error">Max number of allowed lotID fields reached</Typography>
                                                }
                                            </div>
                                            {lotIds.map((element, index) => (
                                                <SingleInputComponent
                                                    valuesToUpdate = {lotIds}
                                                    paramToUpdate = {LOT_IDS}
                                                    source = {"lot"}
                                                    typeOfField={"number"}
                                                    labelName={`Lot ID ${index + 1}`}
                                                    value={element}
                                                    idx={index}
                                                    onRow={index ? () => this.deleteRowLotIdOrCampaignId(0, lotIds, LOT_IDS) : () => this.addRowLotIdOrCampaignId(lotIds, LOT_IDS)}
                                                    handler={this.onChangeLotIdOrCampaignId}
                                                    validators={['required', 'isNumber', 'isPositive', 'maxNumber:9999999999']}
                                                    errorMessages={['This field is required', 'Type must be number!', 'Number must be positive', 'Maximum 10 digits allowed']}
                                                    maxNumberOfInputsReached={lotIds.length >= maxLotIds}
                                                />
                                            ))
                                            }
                                        </div>
                                    </div>
                                    <div className={classes.rowContainerChild}>
                                        <div className={classes.rowContainer} style={{ width: "100%" }}>

                                            <label className={classes.label}>
                                                <Typography variant="body2" gutterBottom>Enter allowed campaign IDs:</Typography>
                                            </label>
                                            <div>
                                                {
                                                    (campaignIds.length >= maxCampaignIds) &&
                                                    <Typography variant="body2" gutterBottom color="error">Max number of allowed campaignID fields reached</Typography>
                                                }
                                            </div>
                                            {campaignIds.map((element, index) => (
                                                <SingleInputComponent
                                                    valuesToUpdate = {campaignIds}
                                                    paramToUpdate = {CAMPAIGN_IDS}
                                                    source = {"campaignID"}
                                                    typeOfField={"number"}
                                                    labelName={`Campaign ID ${index + 1}`}
                                                    value={element}
                                                    idx={index}
                                                    onRow={index ? () => this.deleteRowLotIdOrCampaignId(0, campaignIds, CAMPAIGN_IDS) : () => this.addRowLotIdOrCampaignId(campaignIds, CAMPAIGN_IDS)}
                                                    handler={this.onChangeLotIdOrCampaignId}
                                                    validators={['required', 'isNumber', 'isPositive', 'maxNumber:9999999999']}
                                                    errorMessages={['This field is required', 'Type must be number!', 'Number must be positive', 'Maximum 10 digits allowed']}
                                                    maxNumberOfInputsReached={campaignIds.length >= maxLotIds}
                                                />
                                            ))
                                            }
                                        </div>
                                    </div>
                                </div>
                            </Fragment>
                        }
                    </ValidatorForm>
                </Paper>
            </Fragment>
        );
    };
};

ConfigurationFlowAutomaticChecks.propTypes = propTypes;
ConfigurationFlowAutomaticChecks.defaultProps = defaultProps;

const mapStateToProps = (state, ownProps) => {
    const { flowLabelKey } = ownProps;
    const flow = state.ui[CONFIGURATION_FORM].flow[flowLabelKey];

    return {
        captchaSecret: !ownProps.captchaSecretDirty ? (flow && flow.secrets && flow.secrets.captchaSecret) || ownProps.captchaSecret : ownProps.captchaSecret,
        pincodeOriginValidity: (flow && flow.checkerLambdas && flow.checkerLambdas.includes('pincodeOriginValidityCheckerLambda')) || false,
        minAge: !ownProps.minAgeDirty ? (flow && flow.params && flow.params.minAge) || ownProps.minAgeDirty : ownProps.minAge
    };
};

const enhance = compose(
    withStyles(styles),
    connect(mapStateToProps)
);


export default enhance(ConfigurationFlowAutomaticChecks);
