import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core';
import Page from '../../components/Page';
import SearchPromotionContainer from '../../containers/SearchPromotionContainer';

const propTypes = {
    classes: PropTypes.object.isRequired
};

const defaultProps = {};

const styles = {};

class SearchPromotionPage extends Component {
    render () {
        return (
            <Page>
                <SearchPromotionContainer />
            </Page>
        );
    }
}

SearchPromotionPage.propTypes = propTypes;
SearchPromotionPage.defaultProps = defaultProps;

export default withStyles(styles)(SearchPromotionPage);