import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import { compose } from 'lodash/fp';
import { Button } from '@material-ui/core';
import ConfigurationFlowSecrets from '../components/ConfigurationFlowSecrets';
import ConfigurationFlowAutomaticChecks from '../components/ConfigurationFlowAutomaticChecks';
import { flowLabelMap } from '../constants/lists';
import { addFlowLabel } from '../redux/ui/actions';
import { CONFIGURATION_FORM } from '../constants/forms';

const propTypes = {
    /** Flow label key from flowLabelMap defined in lists.js file. It is used in order to render options of specific flow - functionality */
    flowLabelKey: PropTypes.string.isRequired,
    /** Callback function that hides configuration flow dialog */
    hideFlowDialog: PropTypes.func.isRequired,
    /** @ignore */
    classes: PropTypes.object.isRequired
};

const styles = {
    row: {
        margin: 20
    }
};

class ConfigurationFlowContainer extends Component {
    state = {
        temporaryProperties: {
            message: '',
            minAgeDirty: false,
            captchaSecretDirty: false
        },
        params: {},
        secrets: {},
        checkerLambdas: []
    };

    handleAddToCheckerLambdas = checkerLambdaName => {
        this.setState({
            checkerLambdas: [...this.state.checkerLambdas, checkerLambdaName]
        });
    };

    handleRemoveFromCheckerLambdas = checkerLambdaName => {
        const checkerLambdasArray = [...this.state.checkerLambdas];
        const newCheckerLambdasArray = checkerLambdasArray.filter(checkerLambda => checkerLambda !== checkerLambdaName);
        this.setState({ checkerLambdas: newCheckerLambdasArray });
    };

    handleParamRemove = name => {
        const params = { ...this.state.params };
        if (params.hasOwnProperty([name])) {
            delete params[name];
            this.setState({ params });
        }
    };

    handleSecretRemove = name => {
        const secrets = { ...this.state.secrets };
        if (secrets.hasOwnProperty([name])) {
            delete secrets[name];
            this.setState({ secrets });
        }
    };

    handleParamChange = (field, value) => {
        if (["minAge"].includes(field)) {
            value = Number(value);
        }

        const state = {
            params: {
                ...this.state.params,
                [field]: value
            }
        };

        if (field === 'minAge') {
            state.temporaryProperties = { ...this.state.temporaryProperties };
            state.temporaryProperties.minAgeDirty = true;
        }
        this.setState(state);
    };

    setMixCodesParam = (position, event) => {
        this.setState({
            secrets: {
                ...this.state.secrets,
                mixCodesParameters: this.getUpdatedMixCodesParametersArray(position, event)
            }
        });
    };

    handleSecretChange = event => {
        this.setState({
            secrets: {
                ...this.state.secrets,
                [event.target.name]: event.target.value
            },
            temporaryProperties: {
                ...this.state.temporaryProperties,
                captchaSecretDirty: true
            }
        });
    };

    /**  Updates and returns mixCodesArray - on the position-th element in the array - key and name of property are determined by event object*/
    getUpdatedMixCodesParametersArray = (position, event) => {
        let mixCodesParametersArray = [];
        const { mixCodesParameters } = this.state.secrets;
        if (mixCodesParameters && Array.isArray(mixCodesParameters)) {
            mixCodesParametersArray = [...mixCodesParameters];
            const mixCodesElement = { ...mixCodesParametersArray[position] };
            mixCodesElement[event.target.name] = event.target.value;
            mixCodesParametersArray[position] = mixCodesElement;
        } else {
            mixCodesParametersArray[0] = {
                [event.target.name]: event.target.value
            };
        }
        return mixCodesParametersArray;
    };

    addCheckerLambdas = (stateToStore, checkers) => {
        stateToStore.checkerLambdas = [...checkers];
    };

    putFlowInStore = () => {
        if (!this.validity()) {
            return false
        }

        const { flowLabelKey, addFlowLabel, hideFlowDialog } = this.props;
        const flowLabelsKeys = Object.keys(flowLabelMap);
        let stateToStore;

        delete this.state.temporaryProperties;

        switch (flowLabelKey) {
            case flowLabelsKeys[0]:
                stateToStore = {
                    ...this.state,
                    flowLambdas: [
                        "burnPincodes"
                    ]
                };
                this.addCheckerLambdas(stateToStore, this.state.checkerLambdas);
                addFlowLabel(flowLabelKey, stateToStore);
                break;
            case flowLabelsKeys[1]:
                stateToStore = {
                    ...this.state,
                    flowLambdas: [
                        "burnPincodes",
                        "pincodeToCurrency",
                        "transactionLambda"
                    ]
                };
                this.addCheckerLambdas(stateToStore, this.state.checkerLambdas);
                addFlowLabel(flowLabelKey, stateToStore);
                break;
            default:
                break;
        }

        hideFlowDialog();
    };

    validity = () => {
        if ((this.state.params.lotIds && this.state.params.lotIds.includes('')) || (this.state.params.campaignIds && this.state.params.campaignIds.includes(''))) {
            return false
        }
        return true;
    };

    handleRemoveMixcode = (mixcodes, index) => {
        const newMixcodes = mixcodes.filter((mixcode, ordinal) => ordinal !== index);
        this.setState({
            secrets: {
                ...this.state.secrets,
                mixCodesParameters: newMixcodes
            }
        });
    };

    componentDidMount = () => {
        const { flow } = this.props;

        if (flow) {
            this.setState({
                ...this.state,
                ...flow
            });
        }
    };

    render() {
        const { classes, flowLabelKey } = this.props;

        return (
            <Fragment>
                {this.state.temporaryProperties && this.state.temporaryProperties.message !== "" &&
                    <div style={{ color: "red" }}>
                        {this.state.temporaryProperties.message}
                    </div>
                }
                <ConfigurationFlowSecrets
                    flowLabelKey={flowLabelKey}
                    onMixCodesParamChange={this.setMixCodesParam}
                    onRemoveMixcode={this.handleRemoveMixcode}
                    className={classes.row}
                />
                <ConfigurationFlowAutomaticChecks
                    flowLabelKey={flowLabelKey}
                    changeParam={this.handleParamChange}
                    removeParam={this.handleParamRemove}
                    changeSecret={this.handleSecretChange}
                    removeSecret={this.handleSecretRemove}
                    addToCheckerLambdas={this.handleAddToCheckerLambdas}
                    removeFromCheckerLambdas={this.handleRemoveFromCheckerLambdas}
                    className={classes.row}
                    minAge={this.state.params.minAge}
                    minAgeDirty={(this.state.temporaryProperties && this.state.temporaryProperties.minAgeDirty) || false}

                    lotIds={this.state.params.lotIds ? this.state.params.lotIds : [""]}
                    campaignIds={this.state.params.campaignIds ? this.state.params.campaignIds : [""]}
                />
                <Button onClick={this.putFlowInStore} color="primary" variant="contained">Apply Changes</Button>
            </Fragment>
        );
    };
};

ConfigurationFlowContainer.propTypes = propTypes;

const mapStateToProps = (state, ownProps) => {
    const { flowLabelKey } = ownProps;

    return { flow: state.ui[CONFIGURATION_FORM].flow[flowLabelKey] };
};

const mapDispatchToProps = dispatch => ({
    addFlowLabel: (flowLabelKey, flowLabelObject) => dispatch(addFlowLabel(flowLabelKey, flowLabelObject))
});

const enhance = compose(
    withStyles(styles),
    connect(mapStateToProps, mapDispatchToProps)
);

export default enhance(ConfigurationFlowContainer);
