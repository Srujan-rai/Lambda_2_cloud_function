import React, { Fragment, Component } from "react";
import Page from "../components/Page";
import { connect } from "react-redux";
import BulkPrizeUploadForm from "../components/BulkPrizeUploadForm";
import {
    textInputChange,
    showNotification,
    fileChange,
    clearForm,
    disableForm,
    enableSpinner,
} from "../redux/ui/actions";
import {
    getConfigurationRequest,
    getConfigurationSuccess,
} from "../redux/configurations/actions";
import { validatePrizeCsvFile } from "../helpers/validations";
import { BULK_PRIZE_UPLOAD_FORM } from "../constants/forms";
import Api from "../api/calls";

class BulkPrizeUploadContainer extends Component {


    componentDidMount() {
        const { clearForm } = this.props;
        window.onbeforeunload = () => clearForm(BULK_PRIZE_UPLOAD_FORM);
    };

    componentWillUnmount() {
        window.onbeforeunload = null;
        const { clearForm } = this.props;
        clearForm(BULK_PRIZE_UPLOAD_FORM);
    };

    handleTextInputChange = (event) => {
        const field = event.target.name;
        const { changeText, disableForm, clearForm } = this.props;
        if (field == "configurationId") {
            disableForm(BULK_PRIZE_UPLOAD_FORM);
            clearForm(BULK_PRIZE_UPLOAD_FORM);
        }

        changeText({ ...event }, BULK_PRIZE_UPLOAD_FORM);
    };

    handleFileChange = (event, isValid) => {
        this.props.changeFile(event, BULK_PRIZE_UPLOAD_FORM, isValid);
    };

    readCsvAndValidate = (event) => {
        const csvFile = event.target.prizeFile.files[0];
        let promises = [];
        promises.push(
            new Promise((resolve, reject) => {
                if (!csvFile) {
                    reject({ title: "Error:", message: "Missing csv file!" });
                }

                const reader = new FileReader();
                reader.onload = async (evt) => {
                    const content = evt.target.result;
                    const {pathname} = this.props.location;
                    const isValidCsv = await validatePrizeCsvFile(content,pathname);
                    if (!isValidCsv) {
                        reject({
                            title: "Error:",
                            message: "Invalid file type or csv format!",
                        });
                    }
                    resolve();
                };
                reader.readAsText(csvFile);
            })
        );
        return Promise.all(promises);
    };

    handleSubmit = async (event) => {
        event.persist();
        event.preventDefault();
        const data = { ...this.props.formState };
        const { notify, enableSpinner } = this.props;
        let errorObject = {
            type: "ERROR",
            visible: true,
            title: "Something went wrong!",
        };

        enableSpinner(BULK_PRIZE_UPLOAD_FORM, true);
        try {
            const {pathname} = this.props.location;
            const isUpdate = pathname === '/bulkPrizes/edit';
            await this.readCsvAndValidate(event);
            await Api.prizes.saveBulk(data, event, isUpdate);
            let notifyMessage = "Prizes sent for upload successfully!";
            if(isUpdate) notifyMessage = "Prizes successfully sent for update!";
            notify({
                type: "SUCCESS",
                visible: true,
                title: "Success",
                message: notifyMessage,
            });
        } catch (err) {
            errorObject.message = err.message
                ? err.message
                : "Upload was not successful!";
            notify(errorObject);
        } finally {
            enableSpinner(BULK_PRIZE_UPLOAD_FORM, false);
        }
    };

    handleConfigurationFetch = (event) => {
        event.preventDefault();
        const { formState, disableForm, enableSpinner } = this.props;
        const configurationId = formState.configurationId;

        if (configurationId.trim().length > 0) {
            enableSpinner(BULK_PRIZE_UPLOAD_FORM, true);
            let configuration;
            Api.configurations
                .get(configurationId)
                .then((response) => {
                    configuration = response.data.configurationMetadata;
                    enableSpinner(BULK_PRIZE_UPLOAD_FORM, false);
                    disableForm(BULK_PRIZE_UPLOAD_FORM, false);
                    return Promise.resolve();
                })
                .catch((err) => {
                    const { notify } = this.props;
                    console.log("Could not fetch configuration err: ", err);
                    notify({
                        title: "Error:",
                        message: "Could not fetch configuration.",
                        type: "ERROR",
                        visible: true,
                    });
                    enableSpinner(BULK_PRIZE_UPLOAD_FORM, false);
                });
        }
    };

    render() {
        return (
            <Page>
                <Fragment>
                    <BulkPrizeUploadForm
                        store={this.props.formState}
                        urlPath={this.props.location.pathname}
                        onSave={this.handleSubmit}
                        onConfigurationSearch={this.handleConfigurationFetch}
                        onFileChange={this.handleFileChange}
                        onTextInputChange={this.handleTextInputChange}
                    />
                </Fragment>
            </Page>
        )
    }
};

const mapStateToProps = (state) => {
    return {
        formState: state.ui.bulkPrizeUploadForm,
    };
};

const mapDispatchToProps = (dispatch) => ({
    changeText: (event, source) => {
        dispatch(textInputChange(event, source));
    },
    changeFile: (event, source, isValid) => {
        dispatch(fileChange(event, source, isValid));
    },
    clearForm: (source) => {
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
    getConfiguration: (configurationId) => {
        dispatch(getConfigurationRequest(configurationId));
    },
    setConfiguration: (configuration) => {
        dispatch(getConfigurationSuccess(configuration));
    }

});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(BulkPrizeUploadContainer);
