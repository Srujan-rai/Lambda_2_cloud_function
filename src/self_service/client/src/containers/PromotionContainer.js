import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import { compose } from 'lodash/fp';
import { textInputChange, selectChange, setFieldsMessages, dateTimeInputChange } from '../redux/ui/actions';
import PromotionForm from '../components/PromotionForm';
import { PROMOTION_FORM, PROMOTION_FORM_MANDATORY_FIELDS } from '../constants/forms';
import { savePromotionRequest, getPromotionRequest, setSelectedPromotion } from '../redux/promotions/actions';

const propTypes = {
    classes: PropTypes.object.isRequired
};

const styles = {};

class PromotionContainer extends Component {
    componentDidMount = () => {
        const { match: { params } } = this.props;
        if (params && params.promotionId) {
            this.promotionId = params.promotionId;
            const { getPromotion } = this.props;
            getPromotion(params.promotionId);
        }
    }

    componentWillUnmount = () => {
        window.onbeforeunload = this.clearPromotion();
    };

    clearPromotion= () => {
        const { setPromotion } = this.props;
        setPromotion(undefined);
    };

    handleTextInputChange = event => {
        event.persist();
        const { changeText } = this.props;
        changeText(event, PROMOTION_FORM);
    };

    handleDateTimeChange = props => {
        const { changeDateTime } = this.props;
        changeDateTime(props, PROMOTION_FORM);
    };

    handleSelectChange = event => {
        const { changeSelect } = this.props;
        changeSelect(event, PROMOTION_FORM);
    };

    handleSubmit = event => {
        event.preventDefault();
        const data = {...this.props.promotionFormState};
        const requiredArray = this.validateForm();
        if (requiredArray.length > 0) {
            const { setMessages } = this.props;
            setMessages(requiredArray, true);
            return false;
        };
        data.promotionStartUtc = new Date(data.promotionStartUtc).getTime();
        data.promotionEndUtc = new Date(data.promotionEndUtc).getTime();
        const { savePromotion } = this.props;
        delete data.messages;
        savePromotion(data);
    };

    validateForm = () => {
        const data = {...this.props.promotionFormState};
        delete data.messages;
        const missingValuesFields = [];
        for (let key in data) {
            if (PROMOTION_FORM_MANDATORY_FIELDS.includes(key) && !String(data[key]).length) {
                missingValuesFields.push(key);
            }
        }
        return missingValuesFields;
    };

    render() {
        return <PromotionForm
                   store={this.props.promotionFormState}
                   onTextInputChange={this.handleTextInputChange}
                   onSelectChange={this.handleSelectChange}
                   onSave={this.handleSubmit}
                   onDateTimeChange={this.handleDateTimeChange}
                />;
    };
};

PromotionContainer.propTypes = propTypes;

const mapStateToProps = state => ({
    //TODO Replace by using reselect
    promotionFormState: state.ui[PROMOTION_FORM],
    promotion: state.promotions.promotion
});

const mapDispatchToProps = dispatch => ({
    changeText: (event, source) => {
        dispatch(textInputChange(event, source));
    },
    changeSelect: (event, source) => {
        dispatch(selectChange(event, source));
    },
    savePromotion: data => {
        dispatch(savePromotionRequest(data));
    },
    setMessages: (data, isPromotion) => {
        dispatch(setFieldsMessages(data, isPromotion));
    },
    getPromotion: promotionId => {
        dispatch(getPromotionRequest(promotionId));
    },
    setPromotion: promotion => {
        dispatch(setSelectedPromotion(promotion));
    },
    changeDateTime: (props, source) => {
        dispatch(dateTimeInputChange(props, source));
    }
});

const enhance = compose(
    withStyles(styles),
    connect(mapStateToProps, mapDispatchToProps)
);

export default enhance(PromotionContainer);