import React, { Component, Fragment } from 'react';
import { connect } from 'react-redux';
import striptags from 'striptags';
import LanguageSwitcherContainer from './LanguageSwitcherContainer';
import PrizeForm from '../components/PrizeForm';
import { textInputChange, numberChange, selectChange, showNotification, currencyChange, addCostItemToPrize, fileChange, imageMetadataChange,
         clearForm, addLanguage, setSelectedLanguage, removeLanguage, setPrizeTags, setPrizeCost, removeCostItemFromPrize,
         addFileItemAddition, removeFileItemAddition, changeFileUpload, setCurrenciesByConfig, disableForm, enableSpinner,
         dateTimeInputChange, checkboxChange, propChange } from '../redux/ui/actions';
import { savePrizeRequest } from '../redux/prizes/actions';
import { getConfigurationRequest, getConfigurationSuccess } from '../redux/configurations/actions';
import { validateDigitalCodesCsvFile, getMaxCharactersAllowed } from '../helpers/validations';
import { PRIZE_FORM, PRIZE_FORM_LOCALIZED_FIELDS, INITIAL_LANGUAGE_KEY } from '../constants/forms';
import { getLanguageCode, addCurrencyAmount } from '../helpers/utils';
import { supportedLanguagesMap } from '../constants/lists';
import Api from '../api/calls';

class AddPrizeContainer extends Component {
    errors = {};

    state = {
        tab: 0
    };

    componentDidMount() {
        const { clearForm } = this.props;
        window.onbeforeunload = () => clearForm(PRIZE_FORM);
    };

    componentWillUnmount() {
        window.onbeforeunload = null;
        const { clearForm } = this.props;
        clearForm(PRIZE_FORM);
    };

    //fetch configuration/configuration currencies and put in state
    handleConfigurationFetch = event => {
        event.preventDefault();
        const { setConfiguration, setCurrencies, prizeFormState, disableForm, enableSpinner} = this.props;
        const configurationId = prizeFormState.configurationId;

        if (configurationId.trim().length > 0) {
            enableSpinner(PRIZE_FORM, true);
            let configuration;
            Api.configurations.get(configurationId)
                    .then(response => {
                        configuration = response.data.configurationMetadata;
                        setConfiguration(configuration);
                        const currenciesIds = configuration.configurationParameters.currencies;
                        if(currenciesIds && currenciesIds.length > 0) {
                           return Api.currencies.getByIds(currenciesIds)
                            .then(currenciesReturned => {
                                const currencies = addCurrencyAmount(currenciesReturned.data.matchedCurrencies, 0);
                                setCurrencies(currencies);
                            })
                        }
                        return Promise.resolve();
                    })
                    .then(() => {
                        disableForm(PRIZE_FORM, false);
                        this.forceUpdate();
                        if (configuration && configuration.configurationId != configurationId) {
                            return;
                        }
                        const defaultLanguageKey = configuration && configuration.configurationParameters ? configuration.configurationParameters.language : null;
                        let defaultLanguageName = supportedLanguagesMap[defaultLanguageKey];

                        if (defaultLanguageKey && defaultLanguageName) {
                            const { addLanguage, removeLanguage, setSelectedLanguage } = this.props;
                            addLanguage(defaultLanguageKey, defaultLanguageName);

                            if(defaultLanguageKey !== INITIAL_LANGUAGE_KEY) {
                                removeLanguage(INITIAL_LANGUAGE_KEY);
                            }

                            this.setState({ tab: 0 });
                            setSelectedLanguage(0);
                        }
                        
                        enableSpinner(PRIZE_FORM, false);
                    })
                    .catch(err => {
                        const { notify } = this.props;
                        console.log("Could not fetch configuration err: ", err);
                        notify({
                            title: "Error!",
                            message: "Could not fetch configuration.",
                            type: "ERROR",
                            visible: true
                        });
                        enableSpinner(PRIZE_FORM, false);
                    })
            }
        }

    handleConfigurationBlur = event => {
        event.preventDefault();
        const { disableForm } = this.props;
        disableForm(PRIZE_FORM, true);
    }

    handleTextInputChange = event => {
        const content = event.target.value;
        const field = event.target.name;
        let counter = striptags(content).length;
        const { changeText, disableForm, clearForm } = this.props;
        if(field == "configurationId") {
            disableForm(PRIZE_FORM);
            clearForm(PRIZE_FORM);
        }
        if (PRIZE_FORM_LOCALIZED_FIELDS.includes(field) && counter > getMaxCharactersAllowed(field)) {
            this.forceUpdate(() => {
                this.errors = {...this.errors, [field]: true};
            });
        } else {
            if (PRIZE_FORM_LOCALIZED_FIELDS.includes(field)) {
                this.errors = {...this.errors, [field]: false};
            }
            changeText({...event}, PRIZE_FORM);
        }
    };

    handleNumberInputChange = (value, name) => {
        const { changeNumber } = this.props;
        changeNumber(value, name, PRIZE_FORM);
    };

    handleSelectChange = event => {
        const { changeSelect } = this.props;
        changeSelect(event, PRIZE_FORM);
    };

    handleImageMetadataNameChange = (index, language, value, name) => {
        const { changeImageMetadata } = this.props;
        const metadataImageName = value.trim().replace(/\s+/g, ' ');
        changeImageMetadata(index, language, metadataImageName, name, PRIZE_FORM);
    };

    handleImageMetadataChange = (index, language, value, name) => {
        const { changeImageMetadata } = this.props;
        changeImageMetadata(index, language, value, name, PRIZE_FORM);
    };

    handleDateTimeChange = props => {
        const { changeDateTime } = this.props;
        changeDateTime(props, PRIZE_FORM);
    };

    handleDateTimeToggle = event => {
        const {checkboxChange} = this.props;
        checkboxChange(event, PRIZE_FORM)
    }

    handleValidityPeriodToggle = event => {
        const {checkboxChange} = this.props;
        checkboxChange(event, PRIZE_FORM)
    };

    handleCurrencyChange = (event, index) => {
        const { name: id, value, valueAsNumber } = event.target;
        const currencyId = id === "currencyId" ? value : null;
        const amount = id === "amount" ? valueAsNumber : null;
        this.props.changeCurrency(index, currencyId, amount);
    };

    handleFileChange = (event, isValid) => {
        this.props.changeFile(event, PRIZE_FORM, isValid);
    };

    handleChangeFileUpload = (event, index, language, value, isValid) => {
        this.props.changeFileUpload(event, index, language, value, isValid);
    }

    handleSubmit = event => {
        event.persist();
        event.preventDefault();
        const data = {...this.props.prizeFormState};
        const { notify, enableSpinner } = this.props;
        enableSpinner(PRIZE_FORM, true);
        let errorObject = {
            type: "ERROR",
            visible: true
        };
        for (let property of ["redeemDesc", "shortDesc", "desc"]) {
            if (Object.values(data[property]).some(val => !val || val.replace(/<[^>]*>?/gm, '').trim() === "")) {
                errorObject.title = "Validation Rules";
                errorObject.message = "Prize description fields are mandatory"
                enableSpinner(PRIZE_FORM, false);
                notify(errorObject);
                return;
            }
        }
        if (Array.isArray(data.cost) && data.cost.length === 0) {
            errorObject.title = "Validation Rules";
            errorObject.message = "Warning! No currency defined for Collect&Get Prize."
            enableSpinner(PRIZE_FORM, false);
            notify(errorObject);
            return;
        }
        for (let message in data.messages) {
             if (Array.isArray(data.messages[message])) {
                for (let messageInArray of data.messages[message]) {
                    const theMessages = Array.isArray(data.messages[message]);
                    if (messageInArray) {
                        errorObject.title = "Validation Rules";
                        errorObject.messageInArray = data.messages[messageInArray];
                        enableSpinner(PRIZE_FORM, false);
                        notify(errorObject);
                        return;
                    }
                    if (!theMessages) {
                        errorObject.title = "Validation Rules";
                        errorObject.message = data.messages[message];
                        enableSpinner(PRIZE_FORM, false);
                        notify(errorObject);
                        return;
                    };
                }
             }
        }

        this.submit(data, event);
    };

    submit = (data, event) => {
        delete data.imgUrl;
        delete data.digitalCodes;
        delete data.messages;
        delete data.languages;
        delete data.selectedLanguage;
        delete data.priorityOptions;
        delete data.formDisabled;
        delete data.spinnerEnabled;
        delete data.localizedFieldsCounter;
        delete data.languageForListing;
        delete data.currencies;

        if (!data.redemptionLink) {
            data.redemptionLink = null;
        }
        if(!data.finalState) {
            data.finalState = null;
        }
        if (!data.redemptionLimit) {
            delete data.redemptionLimit;
        }
        if (!data.useStartEndDates) {
            delete data.startDate;
            delete data.endDate;
            delete data.startDateUTC;
            delete data.endDateUTC;
        }

        if (!data.enableValidityPeriodAfterClaim) {
            data.validityPeriodAfterClaim = null;
        }

        delete data.useStartEndDates;
        delete data.enableValidityPeriodAfterClaim;

        const { savePrize } = this.props;

        savePrize({prizeParams: data}, event);
    };

    handleNewLanguage = language => {
        const { addLanguage, setSelectedLanguage } = this.props;
        const languagesMap = this.props.prizeFormState.languages;
        const languages = Object.values(languagesMap);
        let value = languages.indexOf(language);
        if (value < 0) {
            const languageCode = getLanguageCode(language);
            addLanguage(languageCode, language);
            value = languages.length;
        }
        this.setState({ tab: value });
        setSelectedLanguage(value);
    };

    handleLanguageTabChange = (event, tab) => {
        const { setSelectedLanguage } = this.props;
        this.setState({ tab });
        setSelectedLanguage(tab);
    };

    handleLanguageRemove = (event, languageKey) => {
        const { removeLanguage, setSelectedLanguage } = this.props;
        const languagesMap = this.props.prizeFormState.languages;
        const { selectedLanguage } = this.props.prizeFormState;
        const languageToRemoveIndex = Object.keys(languagesMap).indexOf(languageKey);
        let selectedLanguageIndex = Object.keys(languagesMap).indexOf(Object.keys(selectedLanguage)[0]);
        if (languageToRemoveIndex === selectedLanguageIndex) {
            if (selectedLanguageIndex > 0) {
                selectedLanguageIndex--;
            } else {
                selectedLanguageIndex = 0;
                setSelectedLanguage(selectedLanguageIndex);
            }
        } else if (languageToRemoveIndex < selectedLanguageIndex) {
            selectedLanguageIndex--;
        }
        this.setState({ tab: selectedLanguageIndex });
        removeLanguage(languageKey);
        setSelectedLanguage(selectedLanguageIndex);
        event.stopPropagation();
    };

    handleTagAddition = newTag => {
        if (!!newTag) {
            const { prizeFormState, setPrizeTags } = this.props;
            const tags = prizeFormState.tags || [];
            if (!tags.includes(newTag)) {
                setPrizeTags([...tags, newTag]);
            }
        }
    };

    handleTagRemoval = oldTag => {
        const { prizeFormState, setPrizeTags } = this.props;
        const newTags = prizeFormState.tags.filter(tag => tag !== oldTag);
        setPrizeTags(newTags.length > 0 ? newTags : null);
    };

    handleCostTypeChange = (event, val) => {
        const {setPrizeCost, propChange} = this.props;
        if (val !== 'instant_win' && this.props.prizeFormState.useStartEndDates) {
            propChange(false, 'useStartEndDates', PRIZE_FORM);
        }
        if(val =="always_win") {
            propChange(true, 'poolPrize', PRIZE_FORM);
        } else {
            propChange(false, 'poolPrize', PRIZE_FORM);
        }
        setPrizeCost(event);
    };

    render() {
        const { languages } = this.props.prizeFormState;
        const { tab } = this.state;
        const defaultLanguage = this.props.configuration ? this.props.configuration.configurationParameters.language : null;
        return (
            <Fragment>
                <LanguageSwitcherContainer
                    tab={tab}
                    languagesMap={languages}
                    onNewLanguageAdded={this.handleNewLanguage}
                    onLanguageTabChange={this.handleLanguageTabChange}
                    onLanguageRemove={this.handleLanguageRemove}
                    defaultLanguage={defaultLanguage}
                />
                <PrizeForm
                    errors={this.errors}
                    store={this.props.prizeFormState}
                    onConfigurationSearch={this.handleConfigurationFetch}
                    onTextInputChange={this.handleTextInputChange}
                    onNumberInputChange={this.handleNumberInputChange}
                    onImageMetadataChange={this.handleImageMetadataChange}
                    onImageMetadataNameChange={this.handleImageMetadataNameChange}
                    onSelectChange={this.handleSelectChange}
                    onCostItemAddition={this.props.addCostItemToPrize}
                    onCostItemRemoval={this.props.removeCostItemFromPrize}
                    onCostTypeChange={this.handleCostTypeChange}
                    onCurrencyChange={this.handleCurrencyChange}
                    onTagAddition={this.handleTagAddition}
                    onTagRemoval={this.handleTagRemoval}
                    onFileChange={this.handleFileChange}
                    onSave={this.handleSubmit}
                    onChangeFileUpload={this.handleChangeFileUpload}
                    onFileItemAddition={this.props.addFileItemAddition}
                    onFileItemRemoval={this.props.removeFileItemAddition}
                    handleDateTimeChange={this.handleDateTimeChange}
                    handleDateTimeToggle={this.handleDateTimeToggle}
                    handleValidityPeriodToggle={this.handleValidityPeriodToggle}
                />
            </Fragment>
        );
    };
};

const mapStateToProps = state => ({
    prizeFormState: state.ui[PRIZE_FORM],
    configuration: state.configurations.configuration
});

const mapDispatchToProps = dispatch => ({
    changeText: (event, source) => {
        dispatch(textInputChange(event, source));
    },
    changeNumber: (value, name, source) => {
        dispatch(numberChange(value, name, source));
    },
    changeSelect: (event, source) => {
        dispatch(selectChange(event, source));
    },
    changeCurrency: (index, currencyId, amount) => {
        dispatch(currencyChange(index, currencyId, amount));
    },
    changeImageMetadata: (index, language, value, name, source) => {
        dispatch(imageMetadataChange(index, language, value, name, source));
    },
    changeFile: (event, source, isValid) => {
        dispatch(fileChange(event, source, isValid))
    },
    savePrize: (data, event) => {
        dispatch(savePrizeRequest(data, event));
    },
    clearForm: source => {
        dispatch(clearForm(source));
    },
    enableSpinner: (source, spinnerStatus) => {
        dispatch(enableSpinner(source, spinnerStatus));
    },
    disableForm: (source, formStatus) => {
        dispatch(disableForm(source, formStatus));
    },
    notify: ({title, message, type, visible}) => {
        dispatch(showNotification({title, message, type, visible}));
    },
    getConfiguration: (configurationId, withCurrencies) => {
        dispatch(getConfigurationRequest(configurationId, withCurrencies));
    },
    setConfiguration: (configuration) => {
        dispatch(getConfigurationSuccess(configuration));
    },
    addLanguage: (languageCode, languageName) => {
        dispatch(addLanguage(languageCode, languageName));
    },
    setCurrencies: (currencies) => {
        dispatch(setCurrenciesByConfig(currencies))
    },
    setSelectedLanguage: languageTab => {
        dispatch(setSelectedLanguage(languageTab));
    },
    removeLanguage: (languageCode) => {
        dispatch(removeLanguage(languageCode));
    },
    setPrizeTags: tags => {
        dispatch(setPrizeTags(tags))
    },
    setPrizeCost: (event) => {
        dispatch(setPrizeCost(event.target.value));
    },
    addCostItemToPrize: (currencyId) => {
        dispatch(addCostItemToPrize(currencyId))
    },
    removeCostItemFromPrize: (currency) => {
        dispatch(removeCostItemFromPrize(currency))
    },
    addFileItemAddition: (index, value) => {
        dispatch(addFileItemAddition(index, value))
    },
    removeFileItemAddition: (index, value, name) => {
        dispatch(removeFileItemAddition(index, value, name))
    },
    changeFileUpload: (event, index, language, value, isValid) => {
        dispatch(changeFileUpload(event, index, language, value, isValid))
    },
    changeDateTime: (props, source) => {
        dispatch(dateTimeInputChange(props, source));
    },
    checkboxChange: (event, source) => {
        dispatch(checkboxChange(event, source));
    },
    propChange: (val, name, source) => {
        dispatch(propChange(val, name, source));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(AddPrizeContainer);
