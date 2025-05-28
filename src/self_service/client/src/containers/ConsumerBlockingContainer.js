import React, { Component } from 'react';
import { connect } from 'react-redux';
import ConsumerBlockingForm from "../components/ConsumerBlockingForm/ConsumerBlockingForm";
import { Paper } from '@material-ui/core';
import { changeText, saveBlockedConsumer } from "../redux/blockingConsumer/actions"

const  consumerBlockingForm = "consumerBlockingForm";

class ConsumerBlockingContainer extends Component {

    handleTextInputChange = event => {
        const { changeText } = this.props;
        const formValue = event.target.value;
        const formName = event.target.name;
        changeText(formValue, formName, consumerBlockingForm)
    };

    blockConsumer = (event) => {
        event.preventDefault();
        const blockingConsumerFormData = this.props.blockingConsumerFormData;
        const data = Object.assign({}, {
            ...blockingConsumerFormData
        });

         if (data.title === ""){
             data.title = undefined;
         }
        const { saveBlockedConsumer } = this.props;
        saveBlockedConsumer(data);
    };

    render() {
        const { blockingConsumerFormData } = this.props;
        return (
            <Paper>
                <ConsumerBlockingForm
                    data={blockingConsumerFormData}
                    onTextInputChange={this.handleTextInputChange}
                    blockConsumer={this.blockConsumer}
                />
            </Paper>
        );
    }
};

const mapStateToProps = state => ({
    blockingConsumerFormData: state.blockingConsumer.consumerBlockingForm
});

const mapDispatchToProps = {
     changeText,
     saveBlockedConsumer
};

export default connect(mapStateToProps, mapDispatchToProps)(ConsumerBlockingContainer);