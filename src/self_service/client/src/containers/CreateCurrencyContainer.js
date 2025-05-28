import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { compose } from 'lodash/fp';
import { textInputChange, showNotification, addFileItemAddition, removeFileItemAddition, fileChange, } from '../redux/ui/actions';
import CreateCurrencyForm from '../components/CreateCurrencyForm/CreateCurrencyForm';
import { CURRENCY_CREATION_FORM } from '../constants/forms';
import Api from '../api/calls';

const propTypes = {
    classes: PropTypes.object.isRequired
};

const initalState = {
    formState: {
        currencyName: '',
        country: '',
        currencyFamily: ''
    },
    result: {
        currencyName: "",
        country: "",
        currencyFamily: "",
        form: {
            submitText: "submit",
            fields: []
        }
    },
    buttonDisabled: false,
    form: {}
};

class CreateCurrencyContainer extends Component {

    state = initalState;

    handleSubmit = event => {
        const { notify } = this.props;
        this.setState({buttonDisabled: true});
        Api.currencyCreation.save(this.state.formState, event.target.currencyIcon && event.target.currencyIcon.files[0])
            .then(result => {
                let currencyId = result.entry.currencyId;
                this.setState(initalState);
                notify({
                    title: 'Action successful!',
                    message: 'Currency saved! CurrencyId - ' + currencyId,
                    type: 'SUCCESS',
                    visible: true,
                    disableAutoHide: true
                });

            }).catch(err => {
                let errMsg = "";
                if(err.response){
                    errMsg = err.response.data.message;
                }
                notify({
                    title: 'Action failed!',
                    message: `Something went wrong. Currency not saved - ${errMsg}`,
                    type: "ERROR",
                    visible: true,
                    disableAutoHide: true
                });
                this.setState({buttonDisabled: false});
            })
    };

    handleSelectChange = event => {
        this.setState({
            formState : {
                ...this.state.formState,
                [event.target.name]: event.target.value
            }
        })
    }

    handleTextInputChange = event => {
        event.persist();
        this.setState({
            formState: {
                ...this.state.formState,
                [event.target.name]: event.target.value
            }
        });
    };

    handleFileChange = (event, isValid, customMessage) => {
        this.props.changeFileUpload(event, CURRENCY_CREATION_FORM, isValid, customMessage);
    };

    handleRequiredTextField = event => {
        let checked = event.target.checked;
        if(checked) {
            return this.addRequiredTextField();
        } else {
            return this.removeRequiredTextField();
        }
    }

    render() {
        return (
            <CreateCurrencyForm
            onFormSubmit={this.handleSubmit}
            onTextInputChange={this.handleTextInputChange}
            onSelectInputChange={this.handleSelectChange}
            store={this.props.currencyCreationFormState}
            state={this.state}
            formState={this.state.formState}
            handleChange={this.handleChange}
            handleRequiredTextField={this.handleRequiredTextField}
            fieldType={this.state.fieldType}
            onChangeFileUpload={this.handleFileChange}
            />
        );
    };
};

CreateCurrencyContainer.propTypes = propTypes;

const mapStateToProps = state => ({
    currencyCreationFormState: state.ui[CURRENCY_CREATION_FORM],
});

const mapDispatchToProps = dispatch => ({
    changeText: (event, source) => {
        dispatch(textInputChange(event, source));
    },
    notify: ({title, message, type, visible, disableAutoHide}) => {
        dispatch(showNotification({title, message, type, visible, disableAutoHide}));
    },
    changeFileUpload: (event, value, isValid, customMessage) => {
        dispatch(fileChange(event, value, isValid, customMessage))
    },
});

const enhance = compose(
    connect(mapStateToProps, mapDispatchToProps)
);

export default enhance(CreateCurrencyContainer);
