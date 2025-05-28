import React, { Component, Fragment } from 'react';
import Page from '../components/Page';
import { connect } from 'react-redux';
import DigitalCodesUploadForm from '../components/DigitalCodesUploadForm';
import { textInputChange, showNotification, fileChange, clearForm, disableForm, enableSpinner } from '../redux/ui/actions';
import { getConfigurationRequest, getConfigurationSuccess } from '../redux/configurations/actions';
import { validateDigitalCodesCsvFile } from '../helpers/validations';
import { DIGITAL_CODES_UPLOAD_FORM } from '../constants/forms';
import Api from '../api/calls';
let configurationParametersStartDate = {};

class UploadDigitalCodesContainer extends Component {
    errors = {};

    componentDidMount() {
        const { clearForm } = this.props;
        window.onbeforeunload = () => clearForm(DIGITAL_CODES_UPLOAD_FORM);
    };

    componentWillUnmount() {
        window.onbeforeunload = null;
        const { clearForm } = this.props;
        clearForm(DIGITAL_CODES_UPLOAD_FORM);
    };

    handleTextInputChange = event => {
        const field = event.target.name;
        const { changeText, disableForm, clearForm } = this.props;
        if(field == "configurationId") {
            disableForm(DIGITAL_CODES_UPLOAD_FORM);
            clearForm(DIGITAL_CODES_UPLOAD_FORM );
        }

        changeText({...event}, DIGITAL_CODES_UPLOAD_FORM);
    };

    handleFileChange = (event, isValid) => {
        this.props.changeFile(event, DIGITAL_CODES_UPLOAD_FORM, isValid);
    };

    handleConfigurationFetch = event => {
        event.preventDefault();
        const {formState, disableForm, enableSpinner} = this.props;
        const configurationId = formState.configurationId;

        if (configurationId.trim().length > 0) {
            enableSpinner(DIGITAL_CODES_UPLOAD_FORM, true);
            let configuration;
            Api.configurations.get(configurationId)
                    .then(response => {
                        configuration = response.data.configurationMetadata;
                        configurationParametersStartDate = response.data.configurationMetadata.configurationParameters.configurationStartUtc;
                        enableSpinner(DIGITAL_CODES_UPLOAD_FORM, false);
                        disableForm(DIGITAL_CODES_UPLOAD_FORM, false);
                        return Promise.resolve();
                    })
                    .catch(err => {
                        const { notify } = this.props;
                        console.log("Could not fetch configuration err: ", err);
                        notify({
                            title: "Error:",
                            message: "Could not fetch configuration.",
                            type: "ERROR",
                            visible: true
                        });
                        enableSpinner(DIGITAL_CODES_UPLOAD_FORM, false);
                    })
            }
    }

    readCSVandValidate = (event, errorObject) => {
        return new Promise((resolve, reject) => {
            const csvFile = event.target.digitalCodes.files[0];
            if (!csvFile) {
                errorObject.title = "Error:";
                errorObject.message = "Missing csv file!"
                reject(errorObject);
            }
            const reader = new FileReader();
            reader.onload = evt => {
                const content = evt.target.result;

                const isValidCsv = validateDigitalCodesCsvFile(content, configurationParametersStartDate);
                if (!isValidCsv) {
                    errorObject.title = "Error:";
                    errorObject.message = "Invalid file type or csv format!"
                    reject(errorObject);
                }
                resolve();
            }
            reader.readAsText(event.target.digitalCodes.files[0])
        });
    }

    handleSubmit = event => {
        event.persist();
        event.preventDefault();
        const data = {...this.props.formState};
        const getPrizeParams = { configurationId: data.configurationId, prizeId: data.prizeId };
        const { notify, enableSpinner } = this.props;
        let errorObject = { type: "ERROR", visible: true, title: "Something went wrong!" };
        enableSpinner(DIGITAL_CODES_UPLOAD_FORM, true);

        return this.readCSVandValidate(event, errorObject)
            .then(() => Api.prizes.get(getPrizeParams))
            .then(() => Api.digitalCodes.add(data, event))
            .then(() => {
                enableSpinner(DIGITAL_CODES_UPLOAD_FORM, false);
                notify({ type: "SUCCESS", visible: true, title: "Success", message: "Vouchers sent for upload successfully!"})
            })
            .catch(err => {
                console.log("failed upload with", err);
                errorObject.message = err.message ? err.message : "Upload was not successful!";
                enableSpinner(DIGITAL_CODES_UPLOAD_FORM, false);
                notify(errorObject);
            })
    };

    render() {
        return (
            <Page>
                <Fragment>
                    <DigitalCodesUploadForm
                        errors={this.errors}
                        store={this.props.formState}
                        onTextInputChange={this.handleTextInputChange}
                        onFileChange={this.handleFileChange}
                        onConfigurationSearch={this.handleConfigurationFetch}
                        onSave={this.handleSubmit}
                    />
                </Fragment>
            </Page>
        );
    };
};

const mapStateToProps = state => ({
    formState: state.ui[DIGITAL_CODES_UPLOAD_FORM],
    configuration: state.configurations.configuration
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
    notify: ({title, message, type, visible}) => {
        dispatch(showNotification({title, message, type, visible}));
    },
    getConfiguration: (configurationId, withCurrencies) => {
        dispatch(getConfigurationRequest(configurationId, withCurrencies));
    },
    setConfiguration: (configuration) => {
        dispatch(getConfigurationSuccess(configuration));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(UploadDigitalCodesContainer);
