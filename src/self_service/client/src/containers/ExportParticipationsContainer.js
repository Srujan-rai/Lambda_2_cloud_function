import React, { Component } from 'react';
import { ExportParticipationsForm } from '../components/ExportParticipationsForm';
import { connect } from 'react-redux';
import { compose } from 'lodash/fp';
import { showNotification } from '../redux/ui/actions';
import { props } from 'bluebird';
import Api from '../api/calls';

class ExportParticipationsContainer extends Component {
    constructor() {
        super(props);

        this.state = {
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
            configurationId: '',
            fileLink: ''
        };
    }

    handleTextInputChange = (event) => {
        this.setState({ [event.target.name]: event.target.value });
    };

    handleDateTimeChange = (val) => {
        this.setState({ [val.name]: val.date.toISOString().split('T')[0] });
    };

    setStartDate = (value) => {
        this.setState({"startDate": value});
    }

    setEndDate = (value) => {
        const currentDate = new Date().toISOString().split('T')[0];
        if (currentDate < value) {
            this.setState({"endDate": currentDate});
        } else {
            this.setState({"endDate": value});
        }
    }

    handleConfigurationFetch = (event) => {
        event.preventDefault();
        const configurationId = this.state.configurationId;

        if (configurationId.trim().length > 0) {
            let configurationParameters;
            Api.configurations
                .get(configurationId)
                .then((response) => {
                    const { notify } = this.props;
                    configurationParameters = response.data.configurationMetadata.configurationParameters;
                    const configurationStartDate = new Date(configurationParameters.configurationStartUtc).toISOString().split('T')[0];
                    const configurationEndDate = new Date(configurationParameters.configurationEndUtc).toISOString().split('T')[0];
                    this.setStartDate(configurationStartDate);
                    this.setEndDate(configurationEndDate);
                    notify({
                        title: "Dates loaded",
                        message: 'Start and End Date have been set to match the configuration',
                        visible: true,
                        type: "SUCCESS",
                        disableAutoHide: true
                    })
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
                });
        }
    };

    showLoading = (status) => {
        this.setState({ "spinnerEnabled" : status});
    }
    
    handleFormSubmit = async (event) => {
        const { notify } = this.props;
        try {
            event.preventDefault();
            this.showLoading(true);
            const fileLink = await Api.participations.export(this.state.configurationId, this.state.startDate, this.state.endDate);
            this.setState({ "fileLink" : fileLink});
            this.showLoading(false)
            notify({
                title: "Action successfull!",
                message: 'Successfully exported, please download them by clicking on the button!',
                visible: true,
                type: "SUCCESS",
                disableAutoHide: true
            })
        } catch(err) { 
            console.error("failed with", err);
            notify({
                title: "Error!",
                message: `Failed exporting: ${err.message}`,
                visible: true,
                type: "ERROR",
                disableAutoHide: true
            })
            this.showLoading(false)
        }
    };

    render() {
        return (
            <ExportParticipationsForm
                store={ this.state }
                onTextInputChange={this.handleTextInputChange}
                onDateTimeChange={this.handleDateTimeChange}
                onConfigurationSearch={this.handleConfigurationFetch}
                onSubmit={this.handleFormSubmit}
            />
        )
    };
};

const mapDispatchToProps = dispatch => ({
    notify: ({ title, message, type, visible, disableAutoHide }) => {
        dispatch(showNotification({ title, message, type, visible, disableAutoHide }))
    }
});

const enhance = compose(
    connect(null, mapDispatchToProps)
);

export default enhance(ExportParticipationsContainer);