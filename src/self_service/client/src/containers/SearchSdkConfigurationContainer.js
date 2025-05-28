import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core';
import { connect } from 'react-redux';
import { compose } from 'lodash/fp';
import { showNotification  } from '../redux/ui/actions';
import Api from '../api/calls';
import Search from '../components/Search';
import SdkConfigurationContainer from "../containers/SdkConfigurationContainer"

const propTypes = {
    /** @ignore */
    classes: PropTypes.object.isRequired
};

const styles = {};

class SearchSdkConfigurationContainer extends Component {
    state = {
        fileName: '',
    };

    findCheckedItems = (result) => {
        let checkedItems = result.form.fields.reduce((item, {name}) => (item[name]=true, item), {})
        if (result.responseTemplateMapping) {
            const detailedResponse = ["button","prizeList","iwResult","participationInserted"];
            if (Object.keys(result.responseTemplateMapping).some(e => detailedResponse.indexOf(e) !== -1)) {
                checkedItems={
                    ...checkedItems,
                    detailedPrizeView: true
                }
            }
            
            checkedItems = {
                ...checkedItems, 
                responseMapping: true
            }
        }
        if (result.errorTemplateMapping){
            checkedItems = {
                ...checkedItems, 
                errMapping: true
            }
        }
        return checkedItems
    }
    
    fetchJsSdkConfig = async () => {
        const { notify } = this.props;
        try {
            const result = await Api.jsSdkConfiguration.get(this.state.fileName)
            const checkedItems = this.findCheckedItems(result);

            this.setState({ 
                editState: {
                    sdkConfig: result,
                    fileName: this.state.fileName,
                    checkedItems: {...checkedItems}
                }
            })
        } catch(err) {
            let errMsg = "";
            if(err.response){
                errMsg = err.response.data.message;
            }
            notify({
                title: 'Action failed!',
                message: `Something went wrong. - ${errMsg}`,
                type: "ERROR",
                visible: true
            });
        }
    };


    render() {
        return (
                <Fragment>
                {!this.state.editState && <Search
                    acronym="SFC"
                    headline="Search For JS SDK Configuration"
                    searchId="JS SDK File Name"
                    value={this.state.fileName}
                    onTextInputChange={(event) => this.setState({fileName: event.target.value})}
                    onSearch={this.fetchJsSdkConfig} 
                />}
                {this.state.editState?.sdkConfig && <SdkConfigurationContainer
                    editState={this.state.editState}
                />} 
            </Fragment>
        );
    }
}

SearchSdkConfigurationContainer.propTypes = propTypes;

const mapDispatchToProps = dispatch => ({
    notify: ({title, message, type, visible}) => {
        dispatch(showNotification({title, message, type, visible}));
    },
});

const enhance = compose(
    withStyles(styles), 
    connect(null, mapDispatchToProps
));


export default enhance(SearchSdkConfigurationContainer);