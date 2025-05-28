import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core';
import Page from '../../components/Page';
import SearchPrizeContainer from '../../containers/SearchPrizeContainer';

const propTypes = {
    classes: PropTypes.object.isRequired
};

const defaultProps = {};

const styles = {};

class SearchPrizePage extends Component {
    render () {
        return (
            <Page>
                <SearchPrizeContainer />
            </Page>
        );
    }
}

SearchPrizePage.propTypes = propTypes;
SearchPrizePage.defaultProps = defaultProps;

export default withStyles(styles)(SearchPrizePage);