import React, { Component } from 'react'
import ConsumerUnblockingForm from "../components/ConsumerUnblockingForm/ConsumerUnblockingForm";
import { changeText, getBlockedConsumer, unblockedConsumer } from '../redux/blockingConsumer/actions'
import connect from "react-redux/es/connect/connect";
import { Paper } from '@material-ui/core';

const consumerUnblockingForm = "consumerUnblockingForm";
const propertyNameUserId = "gppUserId";
const propertyNameConfigurationId = "configurationId";

class ConsumerUnblockingContainer extends Component {

    componentDidMount() {
        const {userId, configurationId} = this.props.match.params;
        const {changeText} = this.props;
        changeText(userId, propertyNameUserId, consumerUnblockingForm);
        changeText(configurationId, propertyNameConfigurationId, consumerUnblockingForm)
    }

    handleTextInputChange = ( event ) => {
        const { changeText } = this.props;
        const inputValue = event.target.value;
        const formName = event.target.name;
        changeText(inputValue, formName, consumerUnblockingForm)
    };

    unblockedConsumer = (event) => {
        event.preventDefault();
        const { blockedConsumerFormData } = this.props;
        const data = Object.assign({}, {
            ...blockedConsumerFormData
        });
        const {unblockedConsumer} = this.props;
        unblockedConsumer(data)
    };

    render () {
        const { blockedConsumerFormData } = this.props;
        return (
            <Paper>
                <ConsumerUnblockingForm
                    data={blockedConsumerFormData}
                    onTextInputChange={this.handleTextInputChange}
                    unblockedConsumer={this.unblockedConsumer}
                />
            </Paper>
        )
    }
}

const mapStateToProps = state => ({
    blockedConsumerFormData: state.blockingConsumer.consumerUnblockingForm,
    blockedConsumerData: state.blockingConsumer.blockedConsumerData

});

const mapDispatchToProps = {
    changeText,
    getBlockedConsumer,
    unblockedConsumer
};

export default connect(mapStateToProps, mapDispatchToProps)(ConsumerUnblockingContainer);