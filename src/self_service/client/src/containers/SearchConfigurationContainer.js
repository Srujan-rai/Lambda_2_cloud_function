import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core';
import { connect } from 'react-redux';
import { compose } from 'lodash/fp';
import { Redirect } from 'react-router-dom';
import { getConfigurationRequest } from "../redux/configurations/actions";
import Search from '../components/Search';
import ROUTES from '../routes/Routes';

const propTypes = {
    /** @ignore */
    classes: PropTypes.object.isRequired
};

const styles = {};

class SearchConfigurationContainer extends Component {
    state = {
        configId: '',
        fromEdit: this.props.location.fromEdit,
    };

    fetchConfig = () => {
        const { getConfiguration } = this.props;
        getConfiguration(this.state.configId);
        this.setState({ 
            fromEdit : false 
        })
    };

    render() {
        const { config } = this.props;
        const { fromEdit } = this.state;

        if (config && config.configurationId && !fromEdit) {
            return <Redirect to={ROUTES.configurations.edit(config.configurationId)} />
        }

        return (
                <Fragment>
                <Search
                    acronym="SFC"
                    headline="Search For Configuration"
                    searchId="Configuration Id"
                    value={this.state.configId}
                    onTextInputChange={(event) => this.setState({configId: event.target.value})}
                    onSearch={this.fetchConfig} />
            </Fragment>
        );
    }
}

SearchConfigurationContainer.propTypes = propTypes;

const mapStateToProps = state => ({
    config: state.configurations.configuration
});

const mapDispatchToProps = dispatch => ({
    getConfiguration: configurationId => {
        dispatch(getConfigurationRequest(configurationId));
    }
});

const enhance = compose(
    withStyles(styles),
    connect(mapStateToProps, mapDispatchToProps)
);

export default enhance(SearchConfigurationContainer);