import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core';
import { Avatar, Chip, Paper, Typography, MenuItem, Select, Tooltip } from '@material-ui/core';
import { Clear as ClearIcon } from '@material-ui/icons';
import FloatingActionButton from '../FloatingActionButton';
import { ValidatorForm, TextValidator} from 'react-material-ui-form-validator';
import { flowLabelMap } from '../../constants/lists';
import { connect } from 'react-redux';
import { compose } from 'lodash/fp';
import { CONFIGURATION_FORM } from '../../constants/forms';

const propTypes = {
    /** Flow label key from flowLabelMap defined in lists.js file. It is used in order to render options of specific flow - functionality */
    flowLabelKey: PropTypes.string.isRequired,
    /** Callback function that modify current value for mixcode secret param */
    onMixCodesParamChange: PropTypes.func.isRequired,
    /** Callback function that removes whole mixcode together with secret params */
    onRemoveMixcode: PropTypes.func.isRequired,
    /** @ignore */
    classes: PropTypes.object.isRequired
};

const internalRegularPincodesUri = "https://mixcodes-internal.coke.com/pcservices/rest/v7/pincodes/";
const internalViralPincodesUri = "https://mixcodes-internal.coke.com/pcservices/rest/v7/viralcodes/";
const regularPincodesUri = "https://mixcodes.coke.com/pcservices/rest/v7/pincodes/";
const viralPincodesUri = "https://mixcodes.coke.com/pcservices/rest/v7/viralcodes/";
const usingVPC = process.env.REACT_APP_USING_VPC;


const styles = {
    mainContainer: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        marginLeft: 115,
        marginBottom: 20
    },
    rowContainer: {
        margin: "15px 0 10px 15px"
    },
    paper: {
        marginBottom: 20,
        paddingBottom: 20,
        width: '90%'
    },
    chip: {
        margin: "5px 0 30px 70px"
    },
    textField: {
        backgroundColor: "white",
        width: "220px",
        height: "35px",
        borderRadius: "5px",
        boxShadow: "0px 0px 0px 2px #f40000",
        paddingLeft: "10px",
        paddingRight: "5px",
        paddingTop: "5px",
        marginLeft: 50,
        marginBottom: 10,
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
        display:"inherit",
        marginLeft: 50
    },
    fieldset: {
        border: "2px solid #f40000",
        borderRadius: 5
    },
    legend: {
        color: "#f40000"
    },
    secretRow: {
        width: "30vw",
        padding: 20
    },
    select: {
        width: "180px",
        minWidth: "100px",
        flexBasis: '200px',
        marginBottom:"5px",
        color: "black",
        borderRadius: "5px",
        boxShadow: "0px 0px 0px 2px #f40000",
        height: "35px",
        display: "flex",
        flexDirection: "column",
        justify: "flex-start",
        alignItems: "flex-start",
        paddingLeft: "10px",
        paddingTop: "3px",
        marginTop: "0px",
        marginLeft: "50px"
    },
    selectTemplate: {
        minWidth: "100px",
        maxWidth: "100px"
    },
    addNew: {
        float: "right"
    },
    fabContainer: {
        width: 60,
        marginLeft: 10,
        paddingRight: 20,
        paddingTop: 35,
        textAlign: 'right'
    },
    fab: {},
    fabRemove: {
        border: "2px solid #f40000",
        backgroundColor: "white",
        color: "#f40000",
        boxShadow: "none",
        '&:hover': {
            backgroundColor: "white"
        }
    },
    mixcodes: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'flex-start'
    }
};

class ConfigurationFlowSecrets extends Component {
    state = {
        mixcodes: [
            {
                programId: '',
                secret: '',
                uri: ''
            }
        ]
    };

    renderHeadline = () => {
        const { classes } = this.props;
        return (
            <Chip
                avatar={<Avatar>SE</Avatar>}
                label="Secrets"
                color="primary"
                className={classes.chip}
            />
        );
    };

    renderContent = () => {
        const { flowLabelKey } = this.props;
        const flowLabelsKeys = Object.keys(flowLabelMap);
        switch (flowLabelKey) {
            case flowLabelsKeys[0]:
                return this.renderRedeemPincode();
            case flowLabelsKeys[1]:
                return this.renderRedeemPincodeForCurrencies();
            case flowLabelsKeys[6]:
                return this.renderInstantWinWithBurnPincode();
            case flowLabelsKeys[7]:
                return this.renderPrizeDrawWithBurnPincode();
        }
    };

    handleMixcodeParamChange = (index, event) => {
        const { onMixCodesParamChange } = this.props;
        onMixCodesParamChange(index, event);
        const mixcodes = [...this.state.mixcodes];
        mixcodes[index][event.target.name] = event.target.value;
        this.setState({ mixcodes });
    };

    handleMixcodeAdd = () => {
        this.setState(({ mixcodes }) => ({
            mixcodes: [...mixcodes, {
                programId: '',
                secret: '',
                uri: ''
            }]
        }));
    };

    handleMixcodeRemove = (event, index) => {
        const { mixcodes } = this.state;
        const newMixcodes = mixcodes.filter((mixcode, ordinal) => ordinal !== index);
        this.setState({ mixcodes: newMixcodes });
        for(let i = 0; i < mixcodes.length; i++) {
            if (!mixcodes[i].programId && !mixcodes[i].secret && !mixcodes[i].uri) {
                delete(mixcodes[i]);
            }
        }
        const { onRemoveMixcode } = this.props;
        onRemoveMixcode(mixcodes, index);
    };

    // Renders sections - blocks for mixcodes parameters (starts with one section)
    renderMixcodesSection = () => {
        const { classes } = this.props;
        const { mixcodes } = this.state;


        return (
            <Fragment>
                <Chip
                    avatar={<Avatar>EP</Avatar>}
                    label="Mixcodes Secrets"
                    className={classes.chip}
                />
                {mixcodes.map((mixcode, index, array) => {
                    return (
                        <div className={classes.mixcodes} key={index}>
                            <div className={classes.rowContainer}>
                                <label className={classes.label}>
                                    <Typography variant="body2" gutterBottom>Program Id</Typography>
                                </label>
                                <TextValidator
                                    id="programId"
                                    name="programId"
                                    className={classes.textField}
                                    margin="normal"
                                    InputProps={{
                                        disableUnderline: true
                                    }}
                                    value={mixcode.programId}
                                    onChange={event => this.handleMixcodeParamChange(index, event)}
                                />
                            </div>
                            <div className={classes.rowContainer}>
                                <label className={classes.label}>
                                    <Typography variant="body2" gutterBottom>Secret</Typography>
                                </label>
                                <TextValidator
                                    id="secret"
                                    name="secret"
                                    className={classes.textField}
                                    margin="normal"
                                    InputProps={{
                                        disableUnderline: true
                                    }}
                                    value={mixcode.secret}
                                    onChange={event => this.handleMixcodeParamChange(index, event)}
                                />
                            </div>
                            <div className={classes.rowContainer}>

                                    <label className={classes.label}>
                                    <Typography variant="body2" gutterBottom>Type of codes to be used</Typography>
                                </label>
                                <Select
                                    id="uri"
                                    name="uri"
                                    value={mixcode.uri}
                                    onChange={(event) =>this.handleMixcodeParamChange(index,event)}
                                    fullWidth
                                    className={classes.select}
                                    disableUnderline
                                >
                                    <MenuItem value={usingVPC === "true" ? internalRegularPincodesUri : regularPincodesUri}>
                                        <Typography variant="body2" gutterBottom>Regular pincodes</Typography>
                                    </MenuItem>
                                    <MenuItem value={usingVPC === "true" ? internalViralPincodesUri : viralPincodesUri}>
                                        <Typography variant="body2" gutterBottom>Viral Codes</Typography>
                                    </MenuItem>
                                </Select>
                            </div>
                            {(index === array.length - 1) &&
                                <div className={classes.fabContainer}>
                                    <FloatingActionButton
                                        style={classes.fab}
                                        size="small"
                                        title="Add Mixcodes Parameters"
                                        onClick={this.handleMixcodeAdd}
                                    />
                                </div>
                            }
                            {array.length > 1 &&
                                <div className={classes.fabContainer}>
                                    <FloatingActionButton
                                        style={classes.fabRemove}
                                        size="small"
                                        title="Remove Mixcodes Parameters"
                                        icon={<ClearIcon />}
                                        onClick={event => this.handleMixcodeRemove(event, index)}
                                    />
                                </div>
                            }
                        </div>
                    )})}
            </Fragment>
        );
    };

    renderRedeemPincode = () => {
        const { classes } = this.props;
        return (
            <ValidatorForm  className={classes.container} autoComplete="off">
                {this.renderMixcodesSection()}
            </ValidatorForm>
        );
    };

    renderInstantWinWithBurnPincode = () => {
        const { classes } = this.props;
        return (
            <ValidatorForm  className={classes.container} autoComplete="off">
                {this.renderMixcodesSection()}
            </ValidatorForm>
        );
    };

    renderPrizeDrawWithBurnPincode = () => {
        const { classes } = this.props;
        return (
            <ValidatorForm  className={classes.container} autoComplete="off">
                {this.renderMixcodesSection()}
            </ValidatorForm>
        );
    };


    renderRedeemPincodeForCurrencies = () => {
        const { classes } = this.props;
        return (
            <ValidatorForm  className={classes.container} autoComplete="off">
                {this.renderMixcodesSection()}
            </ValidatorForm>
        );
    };

    componentDidMount = () => {
        const { secrets } = this.props;

        if (secrets) {
            this.setState({
                mixcodes: [
                    ...secrets,
                    ...this.state.mixcodes
                ]
            });
        }
    };

    render() {
        const { classes } = this.props;

        return (
            <Paper className={classes.paper}>
                <div className={classes.qmainContainer}>
                    {this.renderHeadline()}
                    {this.renderContent()}
                </div>
            </Paper>
        );
    };
};

ConfigurationFlowSecrets.propTypes = propTypes;

const mapStateToProps = ( state, ownProps ) => {
    const { flowLabelKey } = ownProps;
        if (state.ui[CONFIGURATION_FORM].flow[flowLabelKey].secrets && state.ui[CONFIGURATION_FORM].flow[flowLabelKey].secrets.mixCodesParameters) {
            return {secrets: state.ui[CONFIGURATION_FORM].flow[flowLabelKey].secrets.mixCodesParameters};
        }
        return {secrets: []};
};

const enhance = compose(
    withStyles(styles),
    connect(mapStateToProps)
);

export default enhance(ConfigurationFlowSecrets);
