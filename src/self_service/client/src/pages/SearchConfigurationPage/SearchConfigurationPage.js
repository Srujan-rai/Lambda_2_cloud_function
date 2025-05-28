import React, { Component } from 'react';
import PropTypes from 'prop-types';
import Page from '../../components/Page';
import { withStyles } from '@material-ui/core'
import SearchConfigurationContainer from '../../containers/SearchConfigurationContainer';

class SearchConfigurationPage extends Component {
    render () {
        return (
            <Page>
                <SearchConfigurationContainer location={this.props.location}/>
            </Page>
        );
    }
}

SearchConfigurationPage.propTypes = {
    classes: PropTypes.object.isRequired
};

SearchConfigurationPage.defaultProps = {};

export default withStyles({})(SearchConfigurationPage);