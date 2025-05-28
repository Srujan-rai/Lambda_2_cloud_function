import React, {Component, Fragment} from 'react';
import { connect } from 'react-redux';
import striptags from 'striptags';
import LanguageSwitcherContainer from './LanguageSwitcherContainer';
import PrizeForm from '../components/PrizeForm';
import { textInputChange, numberChange, selectChange, showNotification, currencyChange, addCostItemToPrize,
    removeCostItemFromPrize, fileChange, clearForm, addDefaultLanguage, addLanguage, addLanguages,
    setSelectedLanguage, removeLanguage, setPrizeImages, setPrizeTags, setPrizeCost, addFileItemAddition, removeFileItemAddition, imageMetadataChange,
    changeFileUpload, enableSpinner, dateTimeInputChange, checkboxChange, propChange  } from '../redux/ui/actions';
import { clearPrizeId, setSelectedPrize, clearConfigId, editPrizeRequest } from '../redux/prizes/actions';
import { validateDigitalCodesCsvFile, getMaxCharactersAllowed } from '../helpers/validations';
import { PRIZE_FORM, PRIZE_FORM_LOCALIZED_FIELDS } from '../constants/forms';
import { getLanguageCode } from '../helpers/utils';
import { supportedLanguagesMap } from '../constants/lists';
import Page from '../components/Page';

class EditPrizeContainer extends Component {
    state = {
        tab: 0,
        passedFromList: true
    };

    componentDidMount = () => {
        const { configId } = this.props;

        if (configId) {
            this.setLanguage();
            this.setPrizeImages();
        }
    };

    componentDidUpdate = prevProps => {
        const { prizeFormState } = this.props;
        // Removing tick on the box - UseStartEndDate for Editing prizes as per ticket - GPP-4299
        prizeFormState.useStartEndDates = false;
        if (prizeFormState.prizeId !== prevProps.prizeFormState.prizeId) {
            this.setPrizeLanguages(Object.keys(prizeFormState.name));
        }
        if (Object.keys(prizeFormState.languages).length !== Object.keys(prevProps.prizeFormState.languages).length && this.state.passedFromList) {
           this.setLanguagePassedFromList();
           this.setState({ passedFromList: false });
        }
    };

    componentWillUnmount = () => {
        const { clearForm, removePrizeId, setSelectedPrize, removeConfigId } = this.props;
        clearForm(PRIZE_FORM);
        removePrizeId();
        removeConfigId();
        setSelectedPrize(null);
    };

    handleTextInputChange = event => {
        const content = event.target.value;
        const field = event.target.name;
        let counter = striptags(content).length;
        const { changeText } = this.props;
        if (PRIZE_FORM_LOCALIZED_FIELDS.includes(field) && counter > getMaxCharactersAllowed(field)) {
            this.forceUpdate();
        } else {
            changeText({...event}, PRIZE_FORM);
        }
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

    setPrizeImages = () => {
        const { configuration } = this.props;

        const defaultLanguageKey = configuration.configurationParameters.language;
        const { setPrizeImages } = this.props;
        setPrizeImages(defaultLanguageKey);
    }

    handleNumberInputChange = (value, name) => {
        const { changeNumber } = this.props;
        changeNumber(value, name, PRIZE_FORM);
    };

    handleSelectChange = event => {
        const { changeSelect } = this.props;
        changeSelect(event, PRIZE_FORM);
    };

    handleCurrencyChange = (event, index) => {
        const { name: id, value, valueAsNumber } = event.target;
        const currencyId = id === "currencyId" ? value : null;
        const amount = id === "amount" ? valueAsNumber : null;
        this.props.changeCurrency(index, currencyId, amount);
    };

    handleDateTimeChange = props => {
        const { changeDateTime } = this.props;
        changeDateTime(props, PRIZE_FORM);
    };

    handleDateTimeToggle = event => {
        const {checkboxChange} = this.props;
        checkboxChange(event, PRIZE_FORM)
    };

    handleValidityPeriodToggle = event => {
        const {checkboxChange} = this.props;
        checkboxChange(event, PRIZE_FORM)
    };

    handleFileChange = (event, isValid) => {
        this.props.changeFile(event, PRIZE_FORM, isValid);
    };

    handleChangeFileUpload = (event, index, language, value, isValid) => {
        this.props.changeFileUpload(event, index, language, value, isValid);
    }

    handleSubmit = event => {
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
        const reader = new FileReader();
        reader.onload = evt => {
            errorObject.title = "Digital codes";
            errorObject.message = "Invalid file type or csv format!"
            const content = evt.target.result;
            const isValidCsv = validateDigitalCodesCsvFile(content);
            isValidCsv ? this.submit(data, event) : notify(errorObject);
            enableSpinner(PRIZE_FORM, false);
        };
        if (data.digitalCodes) {
            reader.readAsText(event.target.digitalCodes.files[0]);
        } else {
            this.submit(data, event);
        }
    };

    submit = (data, event) => {
        delete data.digitalCodes;
        delete data.messages;
        delete data.languages;
        delete data.selectedLanguage;
        delete data.priorityOptions;
        delete data.spinnerEnabled;
        delete data.localizedFieldsCounter;
        delete data.languageForListing;
        delete data.currencies;
        //counters shouldn't be updated
        delete data.totalAmount;
        delete data.totalAvailable;
        delete data.totalClaimed;
        delete data.totalExpired;
        delete data.totalReserved;
        delete data.totalRemoved;
        delete data.totalRedeemed;
        if (!data.redemptionLink) {
            data.redemptionLink = null;
        }
        //prize finalState shouldn't be edited, due to preexisting vouchers
        delete data.finalState;
        if (!data.redemptionLimit) {
            data.redemptionLimit = '';
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

        const { editPrize } = this.props;
        editPrize({prizeParams: data}, event);
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

    setLanguage = () => {
        const { prizeFormState } = this.props;
        this.setPrizeLanguages(Object.keys(prizeFormState.name));
        this.setLanguagePassedFromList();
    };

    setPrizeLanguages = languagesKeys => {
        const { addLanguages } = this.props;
        const languages = {};

        languagesKeys.forEach(key => {
            languages[key] = supportedLanguagesMap[key];
        });
        addLanguages(languages);
    };

    setLanguagePassedFromList = () => {
        const { setSelectedLanguage, prizeFormState, configuration } = this.props;
        const languageKey = Object.keys(prizeFormState.languageForListing)[0];
        const defaultLanguageKey = configuration.configurationParameters ? configuration.configurationParameters.language : null;
        let languagesKeys = Object.keys(prizeFormState.languages);
        const tab = languagesKeys.includes(languageKey) ? languagesKeys.indexOf(languageKey) : languagesKeys.indexOf(defaultLanguageKey);

        this.setState({ tab });
        setSelectedLanguage(tab);
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
        setPrizeCost(event);
    };

    render() {
        const { tab } = this.state;
        const { prizeFormState } = this.props;
        const defaultLanguage = this.props.configuration ? this.props.configuration.configurationParameters.language : null;
        return (
            <Page>
                <Fragment>
                    <LanguageSwitcherContainer
                        tab={tab}
                        languagesMap={prizeFormState.languages}
                        onNewLanguageAdded={this.handleNewLanguage}
                        onLanguageTabChange={this.handleLanguageTabChange}
                        onLanguageRemove={this.handleLanguageRemove}
                        defaultLanguage={defaultLanguage}
                    />
                    <PrizeForm
                        store={prizeFormState}
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
                        onChangeFileUpload={this.handleChangeFileUpload}
                        onFileItemAddition={this.props.addFileItemAddition}
                        onFileItemRemoval={this.props.removeFileItemAddition}
                        onSave={this.handleSubmit}
                        handleDateTimeChange={this.handleDateTimeChange}
                        handleDateTimeToggle={this.handleDateTimeToggle}
                        handleValidityPeriodToggle={this.handleValidityPeriodToggle}
                        isEdit
                        setPrizeImages={this.setPrizeImages}
                    />
                </Fragment>
            </Page>
        );
    };
};

const mapStateToProps = state => ({
    prizeFormState: state.ui[PRIZE_FORM],
    prize: state.prizes.prize,
    configuration: state.configurations.configuration,
    configId: state.prizes.configurationId
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
    changeImageMetadata: (index, language, value, name, source) => {
        dispatch(imageMetadataChange(index, language, value, name, source));
    },
    setPrizeImages: (code) => {
        dispatch(setPrizeImages(code));
    },
    changeCurrency: (index, currencyId, amount) => {
        dispatch(currencyChange(index, currencyId, amount));
    },
    changeFile: (event, source, isValid) => {
        dispatch(fileChange(event, source, isValid))
    },
    editPrize: (data, event) => {
        dispatch(editPrizeRequest(data, event));
    },
    clearForm: source => {
        dispatch(clearForm(source));
    },
    notify: ({title, message, type, visible}) => {
        dispatch(showNotification({title, message, type, visible}));
    },
    enableSpinner: (source, spinnerStatus) => {
        dispatch(enableSpinner(source, spinnerStatus));
    },
    removePrizeId: () => {
        dispatch(clearPrizeId());
    },
    removeConfigId: () => {
        dispatch(clearConfigId());
    },
    setSelectedPrize: (prize) => {
        dispatch(setSelectedPrize(prize))
    },
    addLanguage: (languageCode, languageName) => {
        dispatch(addLanguage(languageCode, languageName));
    },
    addLanguages: languages => {
        dispatch(addLanguages(languages));
    },
    setDefaultLanguage: (languageCode, languageName) => {
        dispatch(addDefaultLanguage(languageCode, languageName));
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
    addCostItemToPrize: (currency) => {
        dispatch(addCostItemToPrize(currency))
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

export default connect(mapStateToProps, mapDispatchToProps)(EditPrizeContainer);
