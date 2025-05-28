import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { isEqual } from 'lodash';
import { textInputChange, showNotification, hideNotification, clearForm, clearAll, setFieldError, setFieldsErrors, clearFieldError, clearFieldsErrors, getEmailTemplate, getEmailTemplateSuccess, getEmailTemplateUpdated } from '../redux/ui/actions';
import { EMAIL_TEMPLATES_FORM, EMAIL_TEMPLATES_FORM_MANDATORY_FIELDS } from '../constants/forms';
import EmailTemplatesComponent from '../components/EmailTemplatesComponent';
import { validateUrl } from "../helpers/validations";
import api from '../api';
import ROUTES from '../routes/Routes';

/**
 * local state store headerImage + icons
 * decouple from global persistant STORE !!!
 */
class EmailTemplatesContainer extends Component {
    formName = EMAIL_TEMPLATES_FORM;
    api = api.emailTemplates;
    formType = "add";

    initialIcons = {
        placeholder: "Social URL",
        btnLink: "",
        file: ""
    };

    // collect only files information 
    // into internal state
    // headerImage + icons(url+file)
    state = {
        headerImage: {},
        icons: []
    }

    componentDidMount = () => {
        this.initIcons();
        const { match: { params } } = this.props;
        if (params && params.templateId) {
            this.formType = "edit";
            this.templateId = params.templateId;
            this.getTemplate();
        } else {
            this.formType = "add";
        }

        // clear form on change from one type to other
        if (this.props.formData.formType !== this.formType) {
            this.props.clearFormD(this.formName);
        }

        this.props.onChangeD({ target: { name: "formType", value: this.formType } }, this.formName);
        window.onbeforeunload = () => { this.clearPlus(); }
    }

    shouldComponentUpdate(nextProps, nextState) {
        if (nextProps._shouldUpdate) {
            const _isEqual = isEqual(nextProps.formData.socialIconsAndLinks, this.state.icons);
            if (!_isEqual) {
                this.setState({ icons: nextProps.formData.socialIconsAndLinks });
                this.props.getDataUpdatedD();
            }
        }
        return true;
    }

    getTemplate() {
        const { getEmailTemplateD } = this.props;
        getEmailTemplateD(this.templateId);
    }

    componentWillUnmount() {
        this.clearPlus();
        window.onbeforeunload = null;
    }

    initIcons() {
        this.setState((state) => {
            const icons = [{ ...this.initialIcons }];
            return {
                icons
            }
        });
    }

    //clear errors & notifications
    clearPlus() {
        const { clearAllD } = this.props;
        clearAllD(this.formName);
    }

    getTextData = () => {
        let formData = { ...this.props.formData };
        const delKeys = [
            "countryList", "errors", "messages"
        ];
        delKeys.forEach(dkey => {
            delete formData[dkey];
        });
        // clear empty props
        Object.keys(formData).forEach(key => {
            if (!formData[key]) {
                delete formData[key];
            }
        });
        return formData;
    }

    /**
     * getIconsData
     *  filtered icons strip rows without file
     * 
     */
    getIconsData = () => {
        let iconsFiltered = [...this.state.icons];

        if (this.formType === "edit") {
            return iconsFiltered;
        } else {
            return iconsFiltered.filter(ico => ico.file && ico.file.length);
        }
    }

    /**
     * sendData to backEnd
     * chain of Requests 
     * 1. save Texts from form (return templateID)
     * 2. save headerImages + Icons (base64_encode)
     *  - based on templateID
     */
    sendData = async () => {
        try { 
            let { headerImage } = this.state;
            const textData = this.getTextData();
            const icons = this.getIconsData();
            const templateId = await this.api.saveText(textData, this.formType)
            await this.api.saveImages(templateId || this.formData.templateId, headerImage, icons, this.formType);
            return templateId;
        } catch(saveError) {
            throw saveError;  
        }
    }

    _onSubmit = (ev) => {
        ev.preventDefault();
        const { notifyD } = this.props;
        const missingMandatoryFields = this.validateForm();
        if (missingMandatoryFields.length > 0) {
            const { setErrorsD } = this.props;
            setErrorsD(missingMandatoryFields, this.formName);
            notifyD({
                type: "INFO",
                visible: true,
                title: "Email Templates Data",
                message: "Please fill mandatory fields."
            });
        } else {
            this.sendData()
                .then(templateId => {
                    this.props.clearFormD(this.formName);
                    this.initIcons();
                    notifyD({
                        type: "SUCCESS",
                        visible: true,
                        title: "Email Templates Data",
                        message: `Saved successfully. Template id:${templateId}`,
                        disableAutoHide: true
                    });
                    if(this.formType == "edit") { 
                        const { history } = this.props;
                        history.push(ROUTES.emailTemplates.search);
                    }

                })
                .catch(errData => this.submitError(errData));
        }
    }

    //catch Submit Error.
    submitError(errData) {
        let errMessage = "";
        const { notifyD } = this.props;
        switch (errData.errType) {
            case "addText":
                errMessage = "Error occured during save information.";
                break;
            case "editText":
                errMessage = "Error occured during update information.";
                break;
            case "addImages":
                errMessage = "Error occured during save images.";
                break;
            case "editImages":
                errMessage = "Error occured during update images.";
                break;
            default:
                errMessage = "Error occured during save.";
                break;
        }
        notifyD({
            type: "ERROR",
            visible: true,
            title: "Email Templates",
            message: errMessage
        });
    }

    validateForm() {
        const { formData } = { ...this.props };
        let missingFields = [];

        for (let fieldName of EMAIL_TEMPLATES_FORM_MANDATORY_FIELDS) {
            let fieldValue = formData[fieldName] || "";

            if (fieldValue.trim().length === 0) {
                missingFields.push(fieldName);
            }
        }

        return missingFields;
    }

    render() {
        let { formData } = { ...this.props };

        formData['type'] = this.formType;
        formData['icons'] = this.state.icons;

        const handlers = {
            onChange: this._onChange,
            onFile: this._onFile,
            onSubmit: this._onSubmit,
            iconsOnChange: this._iconsOnChange
        };
        const initialIcons = [{ ...this.initialIcons }];
        return (
            <EmailTemplatesComponent
                formData={formData}
                initialIcons={initialIcons}
                errorsData={formData.errors}
                handlers={handlers}
            />
        );
    }

    __OnAdd = (idx) => () => {
        this.setState((state, props) => {
            let { icons } = state;
            icons.push({ ...this.initialIcons })
            return {
                icons
            };
        });
    }

    __OnDelete = (idx) => () => {
        this.setState((state, props) => {
            let { icons } = state;
            icons.splice(idx, 1);
            return {
                icons
            }
        });
    }

    __OnChange = (idx) => ({ name, value }) => {
        let icons = [...this.state.icons];

        if (!icons[idx] && idx === 0) {
            icons[idx] = [{ ...this.initialIcons }];
        }

        icons[idx].btnLink = value;
        if (!validateUrl(value)) {
            icons[idx].error = "This url is not valid.";
        } else {
            icons[idx].error = "";
        }

        this.setState({ icons });
    }

    __OnFile = (idx) => ({ name, value, files }) => {
        this.encodeFile(idx, files[0]);
    }

    encodeFile = (idx, file) => {
        const { icons } = this.state;

        const reader = new FileReader();
        reader.onload = ev => {
            const { result: base64Str } = ev.target;
            if (!icons[idx] && idx === 0) {
                icons[idx] = [{ ...this.initialIcons }];
            }

            icons[idx] = {
                ...icons[idx],
                name: file.name,
                type: file.type,
                file: base64Str,
                btnLink: icons[idx].btnLink
            }
            this.setState({
                icons,
            });
        }
        reader.readAsDataURL(file);
    }

    // scope the whole interaction with  
    // socialIcons HERE !!! 
    _iconsOnChange = () => {
        return {
            onChange: this.__OnChange,
            onAdd: this.__OnAdd,
            onDelete: this.__OnDelete,
            onFile: this.__OnFile
        }
    }

    _onChange = ({ name, value }) => {
        const { onChangeD, notification, hideNotifyD, setErrorD, clearErrorD } = this.props;
        const isUrlField = ["privacyPolicy", "termsOfService"].includes(name);
        if (isUrlField) {
            if (value && !validateUrl(value)) {
                setErrorD(name, this.formName, "This url is not valid.");
            } else {
                clearErrorD(name, this.formName);
            }
        }

        onChangeD({ target: { name, value } }, this.formName);
        notification.visible && hideNotifyD();
    }

    _onFile = ({ name, value, files }, fileType) => {
        const file = files[0];

        const reader = new FileReader();
        reader.onload = ev => {
            const { result: base64Str } = ev.target;
            let headerImage = {
                name: file.name,
                type: file.type,
                file: base64Str
            };
            if (this.props.formData && this.props.formData.headerImagePath) {
                headerImage.headerImagePath = this.props.formData.headerImagePath;
            }
            this.setState({
                headerImage
            });
        }
        reader.readAsDataURL(file);
    }
}

EmailTemplatesContainer.propTypes = {
    formData: PropTypes.object.isRequired
};

const mapStateToProps = state => ({
    formData: state.ui[EMAIL_TEMPLATES_FORM],
    notification: state.ui.notification,
    _shouldUpdate: state.ui._shouldUpdate
});

const mapDispatchToProps = dispatch => ({
    clearFormD: (formName) => {
        dispatch(clearForm(formName));
    },
    notifyD: ({ title, message, type, visible, disableAutoHide }) => {
        dispatch(showNotification({ title, message, type, visible, disableAutoHide }));
    },
    hideNotifyD: () => {
        dispatch(hideNotification());
    },
    onChangeD: (event, source) => {
        dispatch(textInputChange(event, source));
    },
    setErrorD: (fields, formName, errMessage) => {
        dispatch(setFieldError(fields, formName, errMessage));
    },
    setErrorsD: (fields, formName) => {
        dispatch(setFieldsErrors(fields, formName));
    },
    clearErrorD: (field, formName) => {
        dispatch(clearFieldError(field, formName));
    },
    clearErrorsD: (formName) => {
        dispatch(clearFieldsErrors(formName));
    },
    clearAllD: (formName) => {
        dispatch(clearAll(formName));
    },
    getEmailTemplateD: (templateId) => {
        dispatch(getEmailTemplate(templateId));
    },
    getDataSuccessD: (templateData) => {
        dispatch(getEmailTemplateSuccess(templateData));
    },
    getDataUpdatedD: () => {
        dispatch(getEmailTemplateUpdated());
    },
});

export default connect(mapStateToProps, mapDispatchToProps)(EmailTemplatesContainer);