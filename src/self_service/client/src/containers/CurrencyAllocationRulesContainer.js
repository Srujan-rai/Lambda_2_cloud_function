import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core';
import { connect } from 'react-redux';
import { compose } from 'lodash/fp';
import { Avatar, Chip, Button, Paper, Typography } from '@material-ui/core';
import { TextValidator, ValidatorForm } from 'react-material-ui-form-validator';
import FloatingActionButton from '../components/FloatingActionButton';
import CurrencyAllocationRulesList from '../components/CurrencyAllocationRulesList';
import AddCurrencyAllocationRulesContainer from './AddCurrencyAllocatonRulesContainer';
import { getCurrencyAllocationRulesRequest, emptyCurrencyAllocationRules, getCurrencyAllocationRule } from '../redux/currencyAllocationRules/actions';
import { clearForm, fillForm, showNotification } from '../redux/ui/actions';
import { prepareCurrencyAllocationRulesData, convertToCamelCase } from '../helpers/utils'
import EditCurrencyAllocationRulesContainer from './EditCurrencyAllocationRulesContainer';

import { CURRENCY_ALLOCATION_RULES_FORM } from '../constants/forms';

const propTypes = {
    classes: PropTypes.object.isRequired
};

const defaultProps = {};

const styles = {
    paper: {
        paddingBottom: 50
    },
    chip: {
        margin: "30px 0 30px 0",
        fontSize: 16
    },
    rowContainer: {
        marginLeft: "50px",
        marginTop: "10px",
        display: "inline"
    },
    label: {
        width: "220px",
        marginLeft: "50px",
        display: "flex",
        flexDirection: "column",
        justify: "flex-start",
        alignItems: "flex-start"
    },
    textField: {
        backgroundColor : "white",
        marginLeft: "50px",
        width: "200px",
        height: "35px",
        borderRadius: "5px",
        boxShadow: "0px 0px 0px 2px #f40000",
        paddingLeft: "5px",
        paddingRight: "5px",
        paddingTop: "5px",
        marginBottom: "10px",
        marginTop: "5px"
    },
    button: {
        marginTop: "5px",
        marginLeft: "-25px",
        color: "white",
        width: "100px",
        backgroundColor: "#f40000",
        borderRadius: "5px solid white"
    },
    table: {
        margin: "0px 70px 0px 50px",
    }
};

const configurationId = "configurationId";

const header = {
    configurationId: "Configuration ID",
    currencyId: "Currency ID",
    amount: "Amount",
    programId: "Program ID",
    lotId: "Lot ID",
    validity: "Validity",
    edit: "Edit/Delete"
};


class CurrencyAllocationRulesContainer extends Component {
    state = {
        configurationId: "",
        displayAddNewRuleForm: false,
        displayEditRuleForm: false
    }

    componentDidMount = () => {
        window.onbeforeunload = this.clearCurrencyAllocationRules;
    }

    clearCurrencyAllocationRules = () => {
        const { emptyRules } = this.props;
        emptyRules();
    }

    componentWillUnmount = () => {
        this.clearCurrencyAllocationRules();
        window.onbeforeunload = null;
    }

    handleTextInputChange = event => {
        const configurationId = event.target.value;
        this.setState({ configurationId });
    }

    getCurrencyAllocationRules = () => {
        const { configurationId } = this.state;
        if (configurationId.trim().length === 0 || configurationId.includes(" ")) {
            const { notify } = this.props;
            notify({
                title: "Invalid Configuration Id",
                message: "Configuration Id must not contain white spaces!",
                type: "WARNING",
                visible: true
            });
            return;
        }
        const { getRules } = this.props;
        getRules(configurationId);
    }

    handleClickOnAddNewRuleButton = () => {
        if (this.state.displayEditRuleForm) {
            this.props.clearForm();
        }
        this.setState({
            displayAddNewRuleForm: true,
            displayEditRuleForm: false
        });
    }

    handleClickOnEditRuleButton = (idx) => {
        if (this.state.displayAddNewRuleForm) {
            this.props.clearForm();
        }

        let editRule = this.props.currencyAllocationRules[idx];
        editRule = convertToCamelCase(editRule);

        this.props.fillForm(editRule);

        this.setState({
            displayAddNewRuleForm: false,
            displayEditRuleForm: true
        });
    }

    handleClickOnCloseAddNewRuleForm = () => {
        this.setState({
            displayAddNewRuleForm: false
        });
    }

    handleClickOnCloseEditNewRuleForm = () => {
        this.props.clearForm();
        this.setState({
            displayEditRuleForm: false
        });
    }

    render () {
        const { classes, currencyAllocationRules } = this.props;
        const currencyAllocationRulesDataForComponent = prepareCurrencyAllocationRulesData(currencyAllocationRules, this.handleClickOnEditRuleButton);

        return (
            <Fragment>
                <Paper className={classes.paper}>
                    <div className={classes.rowContainer}>
                        <Chip
                            avatar={<Avatar>CR</Avatar>}
                            label="Currency Rules"
                            color="primary"
                            className={classes.chip}
                        />
                        <label className={classes.label}>
                            <Typography variant="body2" gutterBottom>Configuration Id</Typography>
                        </label>
                        <ValidatorForm  className={classes.container} autoComplete="off" onSubmit={this.getCurrencyAllocationRules} name="FORM">
                            <TextValidator
                                id={configurationId}
                                name={configurationId}
                                className={classes.textField}
                                value={this.state.configurationId}
                                onChange={this.handleTextInputChange}
                                margin="normal"
                                required
                                validators={['required']}
                                errorMessages={['This field is required']}
                                InputProps={{
                                    disableUnderline: true                                    
                                }}
                            />
                            <div className={classes.rowContainer}>
                                <Button type="submit" variant="contained" color="primary" className={classes.button}>
                                    Search
                                </Button>
                            </div>
                        </ValidatorForm>
                    </div>
                    <div className={classes.table}>
                        {currencyAllocationRules.length > 0 &&
                            <CurrencyAllocationRulesList
                                header={header}
                                rows={currencyAllocationRulesDataForComponent}
                            />
                        }
                        <AddCurrencyAllocationRulesContainer
                            configurationId={this.state.configurationId}
                            display={this.state.displayAddNewRuleForm}
                            onClose={this.handleClickOnCloseAddNewRuleForm}
                        />
                        {this.state.displayEditRuleForm && 
                            <EditCurrencyAllocationRulesContainer 
                                onClose={this.handleClickOnCloseEditNewRuleForm}
                                // currencyAllocationRuleData=
                            />
                        }
                        <FloatingActionButton
                            title="Add New Rule"
                            color="primary"
                            label="Add Rule"
                            onClick={this.handleClickOnAddNewRuleButton} />
                    </div>
                </Paper>
            </Fragment>
        );
    }
}

CurrencyAllocationRulesContainer.propTypes = propTypes;
CurrencyAllocationRulesContainer.defaultProps = defaultProps;

const mapStateToProps = state => ({
    currencyAllocationRules: state.currencyAllocationRules.currencyAllocationRules
});

const mapDispatchToProps = dispatch => ({
    getRules: configurationId => {
        dispatch(getCurrencyAllocationRulesRequest(configurationId));
    },
    emptyRules: () => {
        dispatch(emptyCurrencyAllocationRules());
    },
    notify: ({title, message, type, visible}) => {
        dispatch(showNotification({title, message, type, visible}));
    },
    clearForm: () => {
        dispatch(clearForm(CURRENCY_ALLOCATION_RULES_FORM));
    },
    fillForm: (formData) => {
        dispatch(fillForm(CURRENCY_ALLOCATION_RULES_FORM, formData));
    }
});

const enhance = compose(
    withStyles(styles),
    connect(mapStateToProps, mapDispatchToProps)
);

export default enhance(CurrencyAllocationRulesContainer);