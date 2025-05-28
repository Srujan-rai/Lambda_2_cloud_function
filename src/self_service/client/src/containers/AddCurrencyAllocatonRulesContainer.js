import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import { compose } from 'lodash/fp';
import  { textInputChange, numberChange, showNotification } from '../redux/ui/actions';
import { saveCurrencyAllocationRuleRequest } from '../redux/currencyAllocationRules/actions';
import CurrencyAllocationRulesForm from '../components/CurrencyAllocationRulesForm/CurrencyAllocationRulesForm';
import { CURRENCY_ALLOCATION_RULES_FORM } from '../constants/forms';
import { deleteEmptyProperties } from '../helpers/utils'

const propTypes = {
    /** Flag that determines whether to show component or not */
    display: PropTypes.bool,
    /** Callback function to trigger upon 'x' button click */
    onClose: PropTypes.func,
    /** @ignore */
    classes: PropTypes.object.isRequired
};

const defaultProps = {
    display: true,
    onClose: null
};

const styles = {};

class AddCurrencyAllocationRulesContainer extends Component {
    disabledFields = {
        configurationId: false,
        programId: false,
        lotId: false,
        currencyId: false
    };


    handleNumberChange = (value, name) => {
        const { changeNumber } = this.props;
        changeNumber(value, name, CURRENCY_ALLOCATION_RULES_FORM);
    };

    handleTextInputChange = event => {
        const { changeText } = this.props;
        changeText(event, CURRENCY_ALLOCATION_RULES_FORM);
    };

    handleSubmit = event => {
        event.preventDefault();
        const { configurationId } = this.props.currencyAllocationRulesFormState;
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
        
        const data = deleteEmptyProperties(this.props.currencyAllocationRulesFormState);

        if (data.validity) {
            data.validity = parseInt(data.validity);
        }

        const { saveCurrencyAllocationRule } = this.props;
        saveCurrencyAllocationRule(data);
    };

    render() {
        const { display, onClose} = this.props;
        if (!display) {
            return null;
        }
        return <CurrencyAllocationRulesForm
                   store={this.props.currencyAllocationRulesFormState}
                   onTextInputChange={this.handleTextInputChange}
                   onNumberChange={this.handleNumberChange}
                   onSave={this.handleSubmit}
                   onClose={onClose}
                   disabled={this.disabledFields}
                />;
    };
};

AddCurrencyAllocationRulesContainer.propTypes = propTypes;
AddCurrencyAllocationRulesContainer.defaultProps = defaultProps;

const mapStateToProps = state => ({
    //TODO Replace by using reselect
    currencyAllocationRulesFormState: state.ui[CURRENCY_ALLOCATION_RULES_FORM],
    currencyAllocationRules: state.currencyAllocationRules.currencyAllocationRules
});

const mapDispatchToProps = dispatch => ({
    changeNumber: (value, name, source) => {
        dispatch(numberChange(value, name, source));
    },
    changeText: (event, source) => {
        dispatch(textInputChange(event, source));
    },
    saveCurrencyAllocationRule: (data) => {
        dispatch(saveCurrencyAllocationRuleRequest(data));
    },
    notify: ({title, message, type, visible}) => {
        dispatch(showNotification({title, message, type, visible}));
    }
});

const enhance = compose(
    withStyles(styles),
    connect(mapStateToProps, mapDispatchToProps)
);

export default enhance(AddCurrencyAllocationRulesContainer);