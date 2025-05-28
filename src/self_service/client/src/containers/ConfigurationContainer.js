import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import { compose } from 'lodash/fp';
import {
    textInputChange,
    selectChange,
    setFieldsMessages,
    showNotification,
    addFlowLabel,
    removeFlowLabel,
    addCurrency,
    removeCurrency,
    addConfigurationParameter,
    addAdditionalInfoParameter,
    clearCurrencyList,
    numberChange
} from '../redux/ui/actions';
import ConfigurationForm from '../components/ConfigurationForm';
import { saveConfigurationRequest } from '../redux/configurations/actions';
import {
    CONFIGURATION_FORM,
    CONFIGURATION_FORM_MANDATORY_FIELDS,
    CURRENCY_MANDATORY_FLOWS,
    CONFIGURATION_TAGS
} from '../constants/forms';
import Api from '../api/calls';
import { staticConfigurationFlows, flowLabelMap } from '../constants/lists';
import { getFileName } from '../helpers/utils';

const BURN_PINCODES = "burnPincodes";
const CURRENCY_REDUCER = "currencyReducer";

const propTypes = {
    classes: PropTypes.object.isRequired
};

const styles = {
    dialog: {
        maxWidth: '100%',
        border: '2px solid blue'
    }
};

class ConfigurationContainer extends Component {
    state = {
        currencies: [],
        emailTemplates: [],
        currenciesForSelectedCountry: [],
        emailTemplatesForSelectedCountry: [],
        selectedFlowLabelKey: '',
        displayFlowDialog: false,
        displayAdditionalInformation: false,
        displayPrizesPriorityField: false,
        validity: ''
    };

    componentDidMount = () => {
        const getAllCurrencies = Api.currencies.get();
        getAllCurrencies
            .then(response => {
                this.setState({
                    currencies: response.data.getAllCurrencies
                });
            })
            .catch(error => {
                const { notify } = this.props;
                notify({
                    title: "Action warning!",
                    message: "There are no available currencies!",
                    type: "WARNING",
                    visible: true
                });
            });

        const getAllEmailTemplates = Api.emailTemplatesForConfiguration.get();
        getAllEmailTemplates
            .then(response => {
                this.setState({
                    emailTemplates: response.data.allEmailTemplates
                });
            })
            .catch(error => {
                const { notify } = this.props;
                notify({
                    title: "Action warning!",
                    message: "There are no available email templates!",
                    type: "WARNING",
                    visible: true
                });
            });
    };


    handleNumberChange = (value, name) => {
        const { changeNumber } = this.props;
        changeNumber(value, name, CONFIGURATION_FORM);
    };

    handleDateTimeChange = props => {
        const { addConfigurationParameter } = this.props;
        addConfigurationParameter(props.name, props.date);
    };

    handleCountryChange = event => {
        const selectedCountry = event.target.value;
        const { addConfigurationParameter } = this.props;
        addConfigurationParameter("country", selectedCountry);
        const providedCurrencies = this.state.currencies.filter(currency => currency.country === selectedCountry);
        const providedEmailTemplates = this.state.emailTemplates.filter(emailTemplate => emailTemplate.country === selectedCountry);
        this.setState({
            currenciesForSelectedCountry: providedCurrencies,
            emailTemplatesForSelectedCountry: providedEmailTemplates
        });
        const { clearCurrencyList } = this.props;
        clearCurrencyList();
    };

    handleConfigurationParameterChange = event => {
        const { addConfigurationParameter } = this.props;
        addConfigurationParameter(event.target.name, event.target.value);
    };

    handleCurrencyChange = event => {
        const selectedCurrencies = this.props.configurationFormState.configurationParameters.currencies;
        const checkedCurrencies = event.target.value;
        if (selectedCurrencies.length > checkedCurrencies.length) {
            const { removeCurrency } = this.props;
            const selectedCurrency = selectedCurrencies.filter(currency => !checkedCurrencies.includes(currency));
            removeCurrency(selectedCurrency[0])
        } else {
            const { addCurrency } = this.props;
            const selectedCurrency = checkedCurrencies.filter(currency => !selectedCurrencies.includes(currency));
            addCurrency(selectedCurrency[0]);
        }
    };

    handleTextInputChange = event => {
        event.persist();
        const { changeText } = this.props;
        changeText(event, CONFIGURATION_FORM);
    };

    handleFlowCheck = selectedFlowLabelKey => {
        const displayFlowDialog = staticConfigurationFlows.includes(selectedFlowLabelKey) ? false : true;
        const state = {
            displayFlowDialog,
            selectedFlowLabelKey
        };

        if (!this.state.displayPrizesPriorityField && selectedFlowLabelKey === 'listPrizes') {
            state.displayPrizesPriorityField = true;
        }

        this.setState(state);
    };

    handleFlowUncheck = (selectedFlowLabel) => {
        this.setState({
            displayFlowDialog: false,
            selectedFlowLabelKey: '',
            displayPrizesPriorityField: selectedFlowLabel !== 'listPrizes'
        });
    };

    handleFlowToggle = event => {
        const { flow } = this.props.configurationFormState;
        const flowLabels = event.target.value;

        if (!flowLabels) return;
        const previousFlowLabels = Object.keys(flow);

        if (previousFlowLabels.length > flowLabels.length) {
            const { removeFlowLabel } = this.props;
            const selectedFlowLabel = previousFlowLabels.filter(flowLabel => !flowLabels.includes(flowLabel));
            removeFlowLabel(selectedFlowLabel[0]);
            this.handleFlowUncheck(selectedFlowLabel[0]);
        } else {
            const { addFlowLabel } = this.props;
            let stateToStore;
            let selectedFlowLabel = flowLabels.filter(flowLabel => !previousFlowLabels.includes(flowLabel))[0];

            switch (selectedFlowLabel) {
                case "listPrizes":
                    stateToStore = {
                        flowLambdas: [
                            "prizeQueryLambda"
                        ],
                        params: {
                            "additionalInformation": true
                        }
                    };
                    break;
                case "addTransaction":
                    stateToStore = {
                        flowLambdas: [
                            "transactionLambda"
                        ]
                    };
                    break;
                case "queryWallet":
                    stateToStore = {
                        flowLambdas: [
                            "walletLambda"
                        ]
                    };
                    break;
                case "queryVouchers":
                    stateToStore = {
                        flowLambdas: [
                            "digitalCodesQueryByUserLambda"
                        ]
                    };
                    break;
                case "pincodeHistory":
                    stateToStore = {
                        flowLambdas: [
                            "pincodeHistoryLambda"
                        ]
                    };
                    break;
                case "redeemPrize":
                    stateToStore = {
                        checkerLambdas: [
                            "prizeCheckerLambda",
                            "currencyCheckerLambda"
                        ],
                        flowLambdas: [
                            "prizeRedeemLambda"
                        ]
                    };
                    break;
                default:
                    break;
            }
            addFlowLabel(selectedFlowLabel, stateToStore);
            this.handleFlowCheck(selectedFlowLabel);
        }
    };

    handleHideFlowDialog = () => {
        this.setState({
            displayFlowDialog: false
        });
    };

    hideAdditionalInformationSection = () => {
        this.setState({
            displayAdditionalInformation: false
        });
    };

    handleSubmit = event => {
        event.preventDefault();
        const data = { ...this.props.configurationFormState };
        const requiredArray = this.validateForm();
        if (requiredArray.length > 0) {
            const { setMessages } = this.props;
            setMessages(requiredArray);
            return false;
        }
        const prizeImage = event.target.imgUrl ? event.target.imgUrl.files[0] : null;
        let validityObject = this.prepareCurrencyValidity(data.validity, data.configurationParameters.currencies);
        delete data.validity;
        if (validityObject === false) {
            delete data.configurationParameters.validity;
        } else {
            data.configurationParameters.validity = validityObject;
        }
        data.configurationParameters.configurationStartUtc = new Date(data.configurationParameters.configurationStartUtc).getTime();
        data.configurationParameters.configurationEndUtc = new Date(data.configurationParameters.configurationEndUtc).getTime();

        let includesBurnPincodes = data.flow?.instantWin?.flowLambdas?.includes(BURN_PINCODES);
        let includesCurrencyReducer = data.flow?.instantWin?.flowLambdas?.includes(CURRENCY_REDUCER);
        let instantWinTags;
        if (includesCurrencyReducer && includesBurnPincodes) {
            instantWinTags = [CONFIGURATION_TAGS.includePinCodeTag, CONFIGURATION_TAGS.includeCostTag];
            data.configurationParameters.additionalInformation[CONFIGURATION_TAGS.costPropertyName] = global.costArray;
        }
        if (includesBurnPincodes && !includesCurrencyReducer) {
            instantWinTags = [CONFIGURATION_TAGS.includePinCodeTag];
        }
        if (includesCurrencyReducer && !includesBurnPincodes) {
            instantWinTags = [CONFIGURATION_TAGS.includeCostTag];
            data.configurationParameters.additionalInformation[CONFIGURATION_TAGS.costPropertyName] = global.costArray;
        }

        const includesCurrencyReducerPrizwDraw = data.flow?.promoEntry?.flowLambdas?.includes(CURRENCY_REDUCER);

        if(!includesCurrencyReducerPrizwDraw) {
            delete data.configurationParameters.additionalInformation[CONFIGURATION_TAGS.costPropertyName];
        } else {
            data.configurationParameters.additionalInformation[CONFIGURATION_TAGS.costPropertyName] = global.costArray;
        }

        const inputTags = data.configurationParameters.additionalInformation.tags;
        data.configurationParameters.additionalInformation[CONFIGURATION_TAGS.propertyName] = [].concat(instantWinTags, inputTags)
        .map((tag) => {
            if (typeof tag !== 'string') return tag
            return tag.trim()
        })
        .filter((tag) => tag);
        const { saveConfiguration } = this.props;
        delete data.messages;
        saveConfiguration(data, prizeImage);
        this.hideAdditionalInformationSection();
    };

    handleAdditionalInfoParamChange = (info) => {
        const { addConfigurationParameter } = this.props;
        addConfigurationParameter('additionalInformation', info);
    };

    handleAdditionalInfoFieldChange = (event) => {
        const { addAdditionalInfoParameter } = this.props;
        addAdditionalInfoParameter(event.target.name, event.target.value);
    };

    handleAdditionalInfoDisplay = () => {
        const { addFlowLabel, removeFlowLabel } = this.props;
        if (!this.state.displayAdditionalInformation) {
            const stateToStore = {
                flowLambdas: [
                    "prizeQueryLambda",
                ],
                params: {
                    "additionalInformation": true
                }
            };
            addFlowLabel("listPrizes", stateToStore);
        } else {
            removeFlowLabel("listPrizes");
        }

        this.setState(state => ({
            displayAdditionalInformation: !state.displayAdditionalInformation
        }));
    }

    prepareCurrencyValidity = (validity, currencies) => {
        validity = parseInt(validity);
        if (!validity || !Array.isArray(currencies) || currencies.length < 1) {
            return false;
        }
        let validityObject = {};
        for (let currency of currencies) {
            validityObject[currency] = validity;
        }
        return validityObject;
    };

    validateForm = () => {
        const data = { ...this.props.configurationFormState };
        delete data.messages;
        const missingValuesFields = [];
        for (let key in data) {
            // currently we don't use prerequirements. It is just added in reducer to be aware for future use.
            if (key === "prerequirements") continue;
            if (CONFIGURATION_FORM_MANDATORY_FIELDS.includes(key) && (!String(data[key]).length || Object.keys(data[key]).length === 0)) {
                missingValuesFields.push(key);
                continue;
            }
            if (key === "configurationParameters") {
                for (let configParameterKey in data.configurationParameters) {
                    if (CONFIGURATION_FORM_MANDATORY_FIELDS.includes(configParameterKey) && !String(data.configurationParameters[configParameterKey]).length) {
                        missingValuesFields.push(configParameterKey);
                        continue;
                    }
                    if (configParameterKey === 'additionalInformation') {
                        for (let additionalParam in data.configurationParameters.additionalInformation) {
                            if (CONFIGURATION_FORM_MANDATORY_FIELDS.includes(additionalParam) && !String(data.configurationParameters.additionalInformation[additionalParam]).length) {
                                missingValuesFields.push(additionalParam);
                                continue;
                            }
                        }
                    }
                }
            }
            if (key === "flow") {
                for (let flowKey in data.flow) {
                    if (CURRENCY_MANDATORY_FLOWS.includes(flowKey) && !String(data.configurationParameters.currencies).length) {
                        if (flowKey === "redeemPincodeForCurrencies" || (flowKey === "instantWin" && data.flow.instantWin.flowLambdas.includes("currencyReducer"))) {
                            missingValuesFields.push("currencies");
                            break;
                        }
                    }
                }
            }
        }
        return missingValuesFields;
    };

    handlePrizeListPriorityChange = (value) => {
        const { addFlowLabel } = this.props;

        addFlowLabel('listPrizes', {
            flowLambdas: [
                "prizeQueryLambda"
            ],
            params: {
                priorityOrder: value,
                additionalInformation: true
            }
        });
    };

    render() {
        const { displayFlowDialog, selectedFlowLabelKey, displayAdditionalInformation, displayPrizesPriorityField } = this.state;
        return (
            <Fragment>
                <ConfigurationForm
                    displayFlowDialog={displayFlowDialog}
                    displayPrizesPriorityField={displayPrizesPriorityField}
                    hideFlowDialog={this.handleHideFlowDialog}
                    selectedFlowLabelKey={selectedFlowLabelKey}
                    currencies={this.state.currenciesForSelectedCountry}
                    emailTemplates={this.state.emailTemplatesForSelectedCountry}
                    onConfigurationParameterChange={this.handleConfigurationParameterChange}
                    onCurrencyChange={this.handleCurrencyChange}
                    store={this.props.configurationFormState}
                    onCountryChange={this.handleCountryChange}
                    onTextInputChange={this.handleTextInputChange}
                    onNumberChange={this.handleNumberChange}
                    onFlowToggle={this.handleFlowToggle}
                    onDateTimeChange={this.handleDateTimeChange}
                    onAdditionalInfoParamChange={this.handleAdditionalInfoParamChange}
                    onAdditionalInfoFieldChange={this.handleAdditionalInfoFieldChange}
                    displayAdditionalInformation={displayAdditionalInformation}
                    handleAdditionalInfoDisplay={this.handleAdditionalInfoDisplay}
                    onSave={this.handleSubmit}
                    getFileName={getFileName}
                    handlePrizeListPriorityChange={this.handlePrizeListPriorityChange}
                />
            </Fragment>
        );
    };
}
ConfigurationContainer.propTypes = propTypes;

const mapStateToProps = state => ({
    //TODO Replace by using reselect
    configurationFormState: state.ui[CONFIGURATION_FORM]
});

const mapDispatchToProps = dispatch => ({
    changeNumber: (value, name, source) => {
        dispatch(numberChange(value, name, source));
    },
    changeText: (event, source) => {
        dispatch(textInputChange(event, source));
    },
    changeSelect: (event, source) => {
        dispatch(selectChange(event, source));
    },
    saveConfiguration: (data, file) => {
        dispatch(saveConfigurationRequest(data, file));
    },
    addFlowLabel: (flowLabelKey, flowLabelObject) => {
        dispatch(addFlowLabel(flowLabelKey, flowLabelObject));
    },
    removeFlowLabel: flowLabelKey => {
        dispatch(removeFlowLabel(flowLabelKey));
    },
    addCurrency: currency => {
        dispatch(addCurrency(currency));
    },
    removeCurrency: currency => {
        dispatch(removeCurrency(currency));
    },
    setMessages: data => {
        dispatch(setFieldsMessages(data));
    },
    notify: ({ title, message, type, visible }) => {
        dispatch(showNotification({ title, message, type, visible }));
    },
    addConfigurationParameter: (key, value) => {
        dispatch(addConfigurationParameter(key, value));
    },
    addAdditionalInfoParameter: (key, value) => {
        dispatch(addAdditionalInfoParameter(key, value));
    },
    clearCurrencyList: () => {
        dispatch(clearCurrencyList());
    }
});

const enhance = compose(
    withStyles(styles),
    connect(mapStateToProps, mapDispatchToProps)
);

export default enhance(ConfigurationContainer);
