import React, { Component, Fragment } from 'react';
import {withRouter} from "react-router-dom";
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { compose } from 'lodash/fp';
import { textInputChange, showNotification  } from '../redux/ui/actions';
import SdkConfigurationForm from '../components/SdkConfigurationForm';
import Api from '../api/calls';
import ROUTES from '../routes/Routes';
import {COMMON_ERR, MIXCODES_ERR, SDK_RESPONSE, DETAILED_PRIZE_VIEW} from '@the-coca-cola-company/ngps-global-common-messages'


const propTypes = {
    classes: PropTypes.object.isRequired,
};

const ERRMESSAGES = {
    ...COMMON_ERR,
    ...MIXCODES_ERR
}

const RESPONSE_MESSAGES = {
    ...SDK_RESPONSE
}

const RESPONSE_DETAILED_VIEW = {
    ...DETAILED_PRIZE_VIEW
}

const messagesMap = {
    errMapping: {
        messages: {...ERRMESSAGES},
        resultTemplate: "errorTemplateMapping",
        responseType: "customErr"
    },
    responseMapping: {
        messages: {...RESPONSE_MESSAGES},
        resultTemplate: "responseTemplateMapping",
        responseType: "customLabel"
    },
    detailedPrizeView: {
        messages: {...RESPONSE_DETAILED_VIEW},
        resultTemplate: "responseTemplateMapping",
        responseType: "customDetailedViewResponse"
    }
}

const initalState = {
    displayFlowDialog: false,
    open: false,
    fileName: '',
    fieldType: '',
    checkBoxesCount: 0,
    buttonDisabled: false,
    result: {
        apiKey: "",
        configurationId: "",
        endpoint: "",
        flowLabel: "",
        promotionId: "",
        captchaSiteKey: "",
        useResponseTemplate: false,
        useErrorTemplate: false,
        form: {
            hidden: false,
            submitText: "submit",
            fields: []
        }
    },
    resultModal: {},
    helperModal: {
        label:{default:''},
        helpText:{default:''},
        placeHolder:{default:''},
        name:'',
        type:''
    },
    form: {},
    checkedItems: {
        pins: false,
        pp: false,
        errMapping: false,
        responseMapping: false,
        detailedPrizeView: false
    }
};

class SdkConfigurationContainer extends Component {
    state = initalState;
    componentDidMount() {
        const { editState } = this.props;
        if (editState?.sdkConfig) {
            window.history.replaceState(null, '', ROUTES.sdkConfigurations.edit(editState.fileName));
            this.setState({
                fileName: editState.fileName,
                result: {...editState.sdkConfig},
                checkedItems: {...editState.checkedItems}
            });
        }
    }

    handleSubmit = event => {
        //TODO: disable submit while sending request
        const { notify, editState } = this.props;
        const isEdit = editState ? true : false;
        this.setState({buttonDisabled: true});
        event.target.disabled = true;
        Api.jsSdkConfiguration.save(this.state.result, this.state.fileName, isEdit)
            .then(() => {
                notify({
                    title: 'Action successful!',
                    message: 'JS SDK configuration saved!',
                    type: 'SUCCESS',
                    visible: true
                });
                if (isEdit) {
                    this.props.history.goBack();
                } else {
                    this.setState(initalState);
                }

            }).catch(err => {
                let errMsg = "";
                if(err.response){
                    errMsg = err.response.data.message;
                }
                notify({
                    title: 'Action failed!',
                    message: `Something went wrong. JS sdk not saved - ${errMsg}`,
                    type: "ERROR",
                    visible: true
                });
                this.setState({buttonDisabled: false});
            })
    };

    handleTemplateCheckboxChange = event => {
        this.setState({
            result: {
                ...this.state.result,
                [event.target.name]: event.target.checked
            }
        });
    }

    handleCheckBoxChange = event => {
        this.setState({
            checkedItems: {
                ...this.state.checkedItems,
                [event.target.name]: event.target.checked
            }
        })
    }

    handleTextInputChange = event => {
        event.persist();
        this.setState({
            result: {
                ...this.state.result,
                [event.target.name]: event.target.value
            }
        });
    };

    handleRequiredTextField = event => {
        let checked = event.target.checked;
        if(checked) {
            return this.addRequiredTextField();
        } else {
            return this.removeRequiredTextField();
        }
    }

    addRequiredTextField = () => {
        this.setState({
            resultModal: {
                ...this.state.resultModal,
                validation: [
                        {
                        rule: ".+",
                        message:{
                            default:"This field is required"
                        }
                    }
                ]
            },
        })
    }

    removeRequiredTextField = () => {
        let resultModal = this.state.resultModal;
        delete resultModal.validation;
        this.setState({
            resultModal: {
                resultModal
            },
        })
    }

    handleFileNameChange = event => {
        event.persist();
        this.setState({
                fileName: event.target.value
            });
    }

    handleChange = event => {
        let checked = event.target.checked;
        if(checked) {
            this.handleOpen(event);
            this.handleCheckBoxChange(event);
        } else {
            const checkBoxName = event.target.getAttribute("name");
            let optionalFields = this.state.result.form.fields.filter(function( obj ) {
                return obj.name !== checkBoxName;
            });
            let result = {...this.state.result};
            const resultTemplate = messagesMap[checkBoxName]?.resultTemplate;
            if (resultTemplate && this.state.result[resultTemplate]){
                if (checkBoxName === "detailedPrizeView") {
                    const detailedResponse = ["button","prizeList","iwResult","participationInserted"];
                    const filteredResponse = Object.keys(this.state.result.responseTemplateMapping).filter(key => !detailedResponse.includes(key))
                                    .reduce((obj, key) => {obj[key] = this.state.result.responseTemplateMapping[key];return obj}, {});
                    result.responseTemplateMapping = filteredResponse;
                } else {
                    delete result[resultTemplate];
                }
            }
            this.setState({
                checkBoxesCount: this.state.checkBoxesCount - 1,
                result: {
                    ...result,
                    form: {
                        ...this.state.result.form,
                        fields: optionalFields
                    }
                }
            })
            this.handleCheckBoxChange(event);
        }
    };

    handleOpen = event => {
        const name = event.target.getAttribute("name");
        const type = event.target.getAttribute("formFieldType")

        let apiErrAndResponse = {};
            for (let key in messagesMap[name]?.messages) {
                apiErrAndResponse[messagesMap[name].messages[key]] = {default: ""}
            }

        this.setState({
            open: true,
            modalSubmitted: false,
            checkBoxesCount: this.state.checkBoxesCount + 1,
            resultModal: {
                type,
                name
            },
            helperModal: {
                ...this.state.helperModal,
                type,
                name,
                ...apiErrAndResponse
            }
        });
    };

    handleClose = () => {
        let activeCheckboxName = this.state.helperModal.name;
        let modalSubmitted = true;
        let checkBoxesCount = this.state.checkBoxesCount;

        this.setState({
            open: false,
            checkBoxesCount: checkBoxesCount,
            checkedItems: {
                ...this.state.checkedItems,
                [activeCheckboxName]: modalSubmitted
            },
            helperModal: {
                helpText:{default:''},
                label:{default:''},
                helperText:{default:''},
                placeHolder:{default:''},
                name:'',
                type:''
            },
            resultModal : {}
        });
    };

    handleModalParameterChange = event => {
        this.setState({
            resultModal: {
                ...this.state.resultModal,
                [event.target.name]: {
                    default: event.target.value
                }
            },
            helperModal: {
                ...this.state.helperModal,
                [event.target.name]: {
                    default: event.target.value
                }
            }
        });
        let helperModal = {...this.state.helperModal}
        helperModal[event.target.name] = event.target.value;
    };

    handleDetailedPrizeViewMapping = () => {
        const detailedResponse = ["button","prizeList","iwResult","participationInserted"];
        const responseObject = this.state.result.responseTemplateMapping;
        const filteredResponse = Object.keys(responseObject).filter(key => detailedResponse.includes(key))
                                .reduce((obj, key) => {obj[key] = responseObject[key];return obj}, {});

        const detailedResponsesMap = {
            button: {
                CUSTOM_LABEL: "customLabel",
                ERROR_BUTTON_TEXT: "errorButtonText",
                PRIZE_LIST_BUTTON_TEXT: "prizeListButtonText",
                VIEW_PRIZE_DETAILS_BUTTON_TEXT: "viewPrizeDetailsButtonText",
                RETURN_FROM_DETAILED_VIEW_TEXT: "returnFromDetailedViewText"
            },
            prizeList: {
                PRIZE_LIST_BUTTON_FLOW: "prizeListButtonFlow",
                ITEMS_TO_SHOW: "itemsToShow"
            },
            iwResult: {
                IW_RESULT_CUSTOM_LABEL: "customLabel",
                POSITIVE: "positive",
                NEGATIVE: "negative",
            },
            participationInserted:{
                PARTICIPATION_INSERTED_POSITIVE_EVENT: "positiveEventLabel",
                PARTICIPATION_INSERTED_NEGATIVE_EVENT: "negativeEventLabel",
                POSITIVE_EVENT_VALUE: "positiveEventValue",
                NEGATIVE_EVENT_VALUE: "negativeEventValue"
            }
        }
        let mappedDetailedResponses = {}
        for (let name in filteredResponse) {
            let mappedValues =  Object.fromEntries(Object.entries(filteredResponse[name]).map(([message, value]) => {
                let codeType;
                if (name === "participationInserted" && message === "customLabel") {
                    let mappedCustomLabel = Object.fromEntries(Object.entries({...value}).map(([k, v]) => {
                        codeType = Object.keys(detailedResponsesMap[name]).find(key => detailedResponsesMap[name][key] === k);
                        return [messagesMap["detailedPrizeView"].messages[codeType], {"default": v}]
                    }))
                    mappedDetailedResponses = {...mappedCustomLabel, ...mappedDetailedResponses}
                }
                codeType = Object.keys(detailedResponsesMap[name]).find(key => detailedResponsesMap[name][key] === message);
                return [messagesMap["detailedPrizeView"].messages[codeType], {"default": value}]
            }))
            mappedDetailedResponses = {...mappedValues, ...mappedDetailedResponses}
        }

        return mappedDetailedResponses
    }

    handleModalEditMapping = (event) => {
        const messagesType = messagesMap[event.target.name].messages;
        const resultTemplateName = messagesMap[event.target.name].resultTemplate;
        const modalMapping = this.state.result[resultTemplateName];
        const responseType = messagesMap[event.target.name].responseType
        let codeTemplateMapping;

        if (event.target.name === "detailedPrizeView") {
            codeTemplateMapping = this.handleDetailedPrizeViewMapping()
        } else {
            codeTemplateMapping = Object.fromEntries(
                Object.entries(modalMapping).map(([message, value]) => {
                    const codeType = Object.values(messagesType).find(v => messagesType[message] === v);
                    return [codeType, {'default': value[responseType]}]
                })
            )
        }

        this.handleOpen(event);

        this.setState({
            open: true,
            modalSubmitted: false,
            resultModal: {
                ...this.state.resultModal,
                ...codeTemplateMapping,
                name: event.target.name,
                type: event.target.fieldType
            },
            helperModal: {
                ...this.state.helperModal,
                ...codeTemplateMapping,
                name: event.target.name,
                type: event.target.fieldType,
            }
        })
    }

    handleIconButtonClick = (event, fieldType, name) => {
        event.stopPropagation();
        event.target.fieldType = fieldType;
        event.target.name = name;
        this.handleModalEditMapping(event);
    }

    handleModalCheck = checkBoxKey => {
        const fieldsResult = this.state.result.form.fields;
        if (fieldsResult.length > 0) {
            let resultObj = fieldsResult.find(obj => obj.name === checkBoxKey);
            this.setState({
                open: true,
                modalSubmitted: false,
                resultModal: {
                    ...this.state.resultModal,
                    ...resultObj
                },
                helperModal: {
                    ...this.state.helperModal,
                    ...resultObj
                }})
        }
    };

    handleModalEdit = resultFields => {
        const currentField = this.state.helperModal.name;
        const filteredFields = resultFields.filter(function(obj) { return obj.name != currentField });
        this.setState({
            result: {
                ...this.state.result,
                form: {
                    ...this.state.result.form,
                    fields: filteredFields
                }
            }
        })
    }
    handleModalSubmit = () => {
        let optionalFieldToAdd = this.state.resultModal;
        if (optionalFieldToAdd.type === "checkbox") {
            optionalFieldToAdd.options = [{ label: { default: "Yes" }, value: true }]
        }
        this.handleModalEdit(this.state.result.form.fields);
        let resultOptionalFields = this.state.result.form.fields;
        resultOptionalFields.push(optionalFieldToAdd);
        this.setState({
            modalSubmitted: true,
            result: {
                ...this.state.result,
                form: {
                    ...this.state.result.form,
                    fields: resultOptionalFields
                }
            }
        }, () => this.handleClose());
    }

    clearObjectProperties = (obj) => {
        for (let key in obj) {
            if (!obj[key] || typeof obj[key] !== "object") {
                continue
              }
              this.clearObjectProperties(obj[key]);
            if (Object.keys(obj[key]).length === 0) delete obj[key]
        }
    }

    handleMappingModals = () => {
        let modalMapping = {...this.state.resultModal}
        const messagesType = messagesMap[modalMapping.name].messages;
        const stateName = messagesMap[modalMapping.name].resultTemplate;
        const responseType = messagesMap[modalMapping.name].responseType;
        delete modalMapping.name;
        delete modalMapping.type;
        //convert the object from resultModal in format used for public config
        let codeTemplateMapping = Object.fromEntries(
            Object.entries(modalMapping).map(([message, value]) => {
                const codeType = Object.keys(messagesType).find(key => messagesType[key] === message);
                return [codeType, {[responseType]: value.default}]
            })
        );

        if(responseType === 'customDetailedViewResponse') {
            const {CUSTOM_LABEL, ERROR_BUTTON_TEXT, PRIZE_LIST_BUTTON_TEXT, VIEW_PRIZE_DETAILS_BUTTON_TEXT,
            RETURN_FROM_DETAILED_VIEW_TEXT, PRIZE_LIST_BUTTON_FLOW, ITEMS_TO_SHOW,
            IW_RESULT_CUSTOM_LABEL, POSITIVE, NEGATIVE, PARTICIPATION_INSERTED_POSITIVE_EVENT, PARTICIPATION_INSERTED_NEGATIVE_EVENT,
            POSITIVE_EVENT_VALUE, NEGATIVE_EVENT_VALUE} = codeTemplateMapping;

            const detailedViewMapping = {
                button: {
                    customLabel: CUSTOM_LABEL?.customDetailedViewResponse,
                    errorButtonText: ERROR_BUTTON_TEXT?.customDetailedViewResponse,
                    prizeListButtonText: PRIZE_LIST_BUTTON_TEXT?.customDetailedViewResponse,
                    viewPrizeDetailsButtonText: VIEW_PRIZE_DETAILS_BUTTON_TEXT?.customDetailedViewResponse,
                    returnFromDetailedViewText:RETURN_FROM_DETAILED_VIEW_TEXT?.customDetailedViewResponse,
                },
                prizeList: {
                    prizeListButtonFlow: PRIZE_LIST_BUTTON_FLOW?.customDetailedViewResponse,
                    useDetailedView: (PRIZE_LIST_BUTTON_FLOW || ITEMS_TO_SHOW) ? true : undefined,
                    itemsToShow: ITEMS_TO_SHOW?.customDetailedViewResponse,
                },
                iwResult: {
                    customLabel: IW_RESULT_CUSTOM_LABEL?.customDetailedViewResponse,
                    positive: POSITIVE?.customDetailedViewResponse,
                    negative: NEGATIVE?.customDetailedViewResponse,
                },
                participationInserted:{
                    customLabel: {
                        positiveEventLabel: PARTICIPATION_INSERTED_POSITIVE_EVENT?.customDetailedViewResponse,
                        negativeEventLabel: PARTICIPATION_INSERTED_NEGATIVE_EVENT?.customDetailedViewResponse,
                    },
                    positiveEventValue: POSITIVE_EVENT_VALUE?.customDetailedViewResponse,
                    negativeEventValue: NEGATIVE_EVENT_VALUE?.customDetailedViewResponse,
                }
                }


                const detailedViewMappingResult = JSON.parse(JSON.stringify(detailedViewMapping))
                this.clearObjectProperties(detailedViewMappingResult);

                codeTemplateMapping = {...this.state.result.responseTemplateMapping, ...detailedViewMappingResult};
        }
        this.setState({
            modalSubmitted: true,
            result: {
                ...this.state.result,
                [stateName]: codeTemplateMapping
            }
        }, () => this.handleClose());
    }

    handleFormCheckBoxChange = (event) => {
        this.setState({
            result: {
                ...this.state.result,
                form: {
                    ...this.state.result.form,
                    [event.target.name]: event.target.checked
                }
            }
        });
    }

    render() {
        const { editState } = this.props;
        return (
            <SdkConfigurationForm
            handleModalOpen={this.handleOpen}
            handleModalClose={this.handleClose && this.handleMappingModals}
            onModalSubmit={this.handleModalSubmit}
            handleModalCheck={this.handleModalCheck}
            handleIconButtonClick={this.handleIconButtonClick}
            onFormSubmit={this.handleSubmit}
            onTextInputChange={this.handleTextInputChange}
            onFileNameChange={this.handleFileNameChange}
            onModalParameterChange={this.handleModalParameterChange}
            modalHelperState={this.state.helperModal}
            state={this.state}
            editState={editState}
            formState={this.state.result}
            modalOpenState={this.state.open}
            handleChange={this.handleChange}
            handleRequiredTextField={this.handleRequiredTextField}
            fieldType={this.state.fieldType}
            onTemplateCheckboxChange={this.handleTemplateCheckboxChange}
            onMappingModalSubmit={this.handleMappingModals}
            handleFormCheckBoxChange={this.handleFormCheckBoxChange}
            />
        );
    };
};

SdkConfigurationContainer.propTypes = propTypes;

const mapDispatchToProps = dispatch => ({
    changeText: (event, source) => {
        dispatch(textInputChange(event, source));
    },
    notify: ({title, message, type, visible}) => {
        dispatch(showNotification({title, message, type, visible}));
    },
});

const enhance = compose(withRouter,
    connect(null, mapDispatchToProps)
);

export default enhance(SdkConfigurationContainer);
