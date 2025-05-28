import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Page from '../../components/Page';
import { withStyles } from '@material-ui/core'
import SearchSdkConfigurationContainer from '../../containers/SearchSdkConfigurationContainer';

class SearchSdkConfigurationPage extends Component {
    render () {
        return (
            <Page>
                <SearchSdkConfigurationContainer location={this.props.location}/>
            </Page>
        );
    }
}

SearchSdkConfigurationPage.propTypes = {
    classes: PropTypes.object.isRequired
};

SearchSdkConfigurationPage.defaultProps = {};

export default withStyles({})(SearchSdkConfigurationPage);