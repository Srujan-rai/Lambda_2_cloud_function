import React, { Component, Fragment } from 'react';
import Page from '../components/Page';
import { connect } from 'react-redux';
import AutoUploadDigitalCodesForm from '../components/AutoUploadDigitalCodesForm';
import { textInputChange, showNotification, fileChange, clearForm, disableForm, enableSpinner } from '../redux/ui/actions';
import { changeDigitalCodesUpload, addDigitalCodes, clearDigitalCodes, removeDigitalCodes } from '../redux/digitalCodesBulkUpload/actions'
import { getConfigurationRequest, getConfigurationSuccess } from '../redux/configurations/actions';
import { validateDigitalCodesCsvFile } from '../helpers/validations';
import { AUTO_UPLOAD_DIGITAL_CODES_FORM } from '../constants/forms';
import Api from '../api/calls';

class AutoUploadDigitalCodesContainer extends Component {
    errors = {};

    componentDidMount() {
        const { clearForm } = this.props;
        this.props.clearDigitalCodes();
        window.onbeforeunload = () => clearForm(AUTO_UPLOAD_DIGITAL_CODES_FORM);
    };

    componentWillUnmount() {
        window.onbeforeunload = null;
        const { clearForm } = this.props;
        clearForm(AUTO_UPLOAD_DIGITAL_CODES_FORM);
    };

    handleTextInputChange = event => {
        const field = event.target.name;
        const { changeText, disableForm, clearForm } = this.props;
        if (field == "configurationId") {
            disableForm(AUTO_UPLOAD_DIGITAL_CODES_FORM);
            clearForm(AUTO_UPLOAD_DIGITAL_CODES_FORM);
        }

        changeText({ ...event }, AUTO_UPLOAD_DIGITAL_CODES_FORM);
    };

    handleFileChange = (event, isValid) => {
        this.props.changeFile(event, AUTO_UPLOAD_DIGITAL_CODES_FORM, isValid);
    };

    handleDigitalCodesFileChange = (event, isValid, index, value) => {
        this.props.changeDigitalCodesUpload(event, isValid, index, value);
    }

    handleConfigurationFetch = event => {
        event.preventDefault();
        const { formState, disableForm, enableSpinner } = this.props;
        const configurationId = formState.configurationId;

        if (configurationId.trim().length > 0) {
            enableSpinner(AUTO_UPLOAD_DIGITAL_CODES_FORM, true);
            let configuration;
            Api.configurations.get(configurationId)
                .then(response => {
                    configuration = response.data.configurationMetadata;
                    enableSpinner(AUTO_UPLOAD_DIGITAL_CODES_FORM, false);
                    disableForm(AUTO_UPLOAD_DIGITAL_CODES_FORM, false);
                    return Promise.resolve();
                })
                .catch(err => {
                    const { notify } = this.props;
                    notify({
                        title: "Error:",
                        message: "Could not fetch configuration.",
                        type: "ERROR",
                        visible: true
                    });
                    enableSpinner(AUTO_UPLOAD_DIGITAL_CODES_FORM, false);
                })
        }
    }

    readCSVandValidate = (event, errorObject) => {
        const arrayOfDigitalCodeFiles = NodeList.prototype.isPrototypeOf(event.target.digitalCodes) ?
        [...event.target.digitalCodes] : [event.target.digitalCodes];
        let promises = [];
        for (const digitalCode of arrayOfDigitalCodeFiles) {
            promises.push(new Promise((resolve, reject) => {
                const csvFile = digitalCode.files[0];
                if (!csvFile) {
                    errorObject.title = "Error:";
                    errorObject.message = "Missing csv file!"
                    reject(errorObject);
                }

                const reader = new FileReader();
                reader.onload = evt => {
                    const content = evt.target.result;
                    const isValidCsv = validateDigitalCodesCsvFile(content);
                    if (!isValidCsv) {
                        errorObject.title = "Error:";
                        errorObject.message = "Invalid file type or csv format!"
                        reject(errorObject);
                    }
                    resolve();
                }
                reader.readAsText(digitalCode.files[0]);
            }))
        }
        return Promise.all(promises);
    }

    handleSubmit = event => {
        event.persist();
        event.preventDefault();
        const data = { ...this.props.formState };
        const getPrizeParams = { configurationId: data.configurationId, prizeId: data.prizeId };
        const { notify, enableSpinner } = this.props;
        let errorObject = { type: "ERROR", visible: true, title: "Something went wrong!" };
        enableSpinner(AUTO_UPLOAD_DIGITAL_CODES_FORM, true);

        return this.readCSVandValidate(event, errorObject)
            .then(() => Api.prizes.get(getPrizeParams))
            .then(() => Api.autoDigitalCodes.add(data, event))
            .then(() => {
                enableSpinner(AUTO_UPLOAD_DIGITAL_CODES_FORM, false);
                notify({ type: "SUCCESS", visible: true, title: "Success", message: "Vouchers sent for upload successfully!" })
            })
            .catch(err => {
                errorObject.message = err.message ? err.message : "Upload was not successful!";
                enableSpinner(AUTO_UPLOAD_DIGITAL_CODES_FORM, false);
                notify(errorObject);
            })
    };

    render() {
        return (
            <Page>
                <Fragment>
                    <AutoUploadDigitalCodesForm
                        errors={this.errors}
                        store={this.props.formState}
                        digitalCodesArray={this.props.digitalCodesArray}
                        onTextInputChange={this.handleTextInputChange}
                        onFileChange={this.handleFileChange}
                        onConfigurationSearch={this.handleConfigurationFetch}
                        onSave={this.handleSubmit}
                        onChangeDigitalCodesFile={this.handleDigitalCodesFileChange}
                        onDigitalCodesAddition={this.props.addDigitalCodes}
                        onDigitalCodesRemoval={this.props.removeDigitalCodes}
                    />
                </Fragment>
            </Page>
        );
    };
};

const mapStateToProps = state => ({
    formState: state.ui[AUTO_UPLOAD_DIGITAL_CODES_FORM],
    digitalCodesArray: state.bulkUploadDigitalCodes.digitalCodesBulkUpload
});

const mapDispatchToProps = dispatch => ({
    changeText: (event, source) => {
        dispatch(textInputChange(event, source));
    },
    changeFile: (event, source, isValid) => {
        dispatch(fileChange(event, source, isValid))
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
    notify: ({ title, message, type, visible }) => {
        dispatch(showNotification({ title, message, type, visible }));
    },
    getConfiguration: (configurationId, withCurrencies) => {
        dispatch(getConfigurationRequest(configurationId, withCurrencies));
    },
    setConfiguration: (configuration) => {
        dispatch(getConfigurationSuccess(configuration));
    },
    addDigitalCodes: (index, value) => {
        dispatch(addDigitalCodes(index, value))
    },
    removeDigitalCodes: (index, value, name) => {
        dispatch(removeDigitalCodes(index, value, name))
    },
    changeDigitalCodesUpload: (event, index, value, isValid) => {
        dispatch(changeDigitalCodesUpload(event, index, value, isValid))
    },
    clearDigitalCodes: () => {
        dispatch(clearDigitalCodes())
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(AutoUploadDigitalCodesContainer);