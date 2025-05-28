import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core';
import { connect } from 'react-redux';
import { compose } from 'lodash/fp';
import { Redirect } from 'react-router-dom';
import { getPrizeRequest, setPrizeId, setConfigId } from '../redux/prizes/actions';
import { getConfigurationRequest } from "../redux/configurations/actions";
import { setSelectedLanguage } from "../redux/ui/actions";
import Search from '../components/Search';
import ROUTES from '../routes/Routes';

const propTypes = {
    /** @ignore */
    classes: PropTypes.object.isRequired
};

const styles = {};

class SearchPrizeContainer extends Component {
    handlePrizeIdChange = event => {
        const { changePrizeId } = this.props;
        const prizeId = event.target.value;
        changePrizeId(prizeId);
    };

    handleConfigIdChange = event => {
        const { changeConfigId } = this.props;
        const configId = event.target.value;
        changeConfigId(configId);
    };

    fetchPrize = () => {
        const { getPrize, prizeId, configId, getConfiguration } = this.props;
        getConfiguration(configId, true);
        getPrize(configId, prizeId);
    };

    render() {
        const { prize, prizeId, configId } = this.props;
        if (prize && prize.prizeId) {
            return <Redirect to={ROUTES.prizes.edit(prizeId)} />
        }
        return (
                <Fragment>
                <Search
                    isEdit
                    acronym="PR"
                    headline="Prize"
                    searchId="Prize Id"
                    searchSecParam="Configuration Id"
                    value={prizeId}
                    configIdValue={configId}
                    onTextInputChange={this.handlePrizeIdChange}
                    onConfigIdChange={this.handleConfigIdChange}
                    onSearch={this.fetchPrize} />
            </Fragment>
        );
    }
}

SearchPrizeContainer.propTypes = propTypes;

const mapStateToProps = state => ({
    prize: state.prizes.prize,
    prizeId: state.prizes.prizeId,
    configId: state.prizes.configurationId
});

const mapDispatchToProps = dispatch => ({
    getPrize: (configurationId, prizeId) => {
        dispatch(getPrizeRequest({configurationId ,prizeId}));
    },
    changePrizeId: prizeId => {
        dispatch(setPrizeId(prizeId));
    },
    changeConfigId: configId => {
        dispatch(setConfigId(configId));
    },
    getConfiguration: (configurationId, withCurrencies) => {
        dispatch(getConfigurationRequest(configurationId, withCurrencies));
    },
    setSelectedLanguage: languageTab => {
        dispatch(setSelectedLanguage(languageTab));
    },
});

const enhance = compose(
    withStyles(styles),
    connect(mapStateToProps, mapDispatchToProps)
);

export default enhance(SearchPrizeContainer);
