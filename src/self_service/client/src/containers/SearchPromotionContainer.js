import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core';
import { connect } from 'react-redux';
import { compose } from 'lodash/fp';
import { Redirect } from 'react-router-dom';
import { getPromotionRequest } from '../redux/promotions/actions';
import Search from '../components/Search';
import ROUTES from '../routes/Routes';

const propTypes = {
    /** @ignore */
    classes: PropTypes.object.isRequired
};

const styles = {};

class SearchPromotionContainer extends Component {
    state = {
        promotionId: ""
    }

    handleTextInputChange = event => {
        this.setState({
            promotionId: event.target.value
        })
    }

    fetchPromotion = () => {
        const { promotionId } = this.state;
        const { getPromotion } = this.props;
        getPromotion(promotionId);
    }

    render() {
        const { classes, promotion } = this.props;
        if (promotion && promotion.promotionId) {
            return <Redirect to={ROUTES.promotions.edit(promotion.promotionId)} />
        }
        return (
            <Fragment>
                <Search
                    acronym="PR"
                    headline="Promotions"
                    searchId="Promotion Id"
                    value={this.state.promotionId}
                    onTextInputChange={this.handleTextInputChange}
                    onSearch={this.fetchPromotion} />
            </Fragment>
        );
    }
}

SearchPromotionContainer.propTypes = propTypes;

const mapStateToProps = state => ({
    promotion: state.promotions.promotion
});

const mapDispatchToProps = dispatch => ({
    getPromotion: promotionId => {
        dispatch(getPromotionRequest(promotionId));
    }
});

const enhance = compose(
    withStyles(styles),
    connect(mapStateToProps, mapDispatchToProps)
);

export default enhance(SearchPromotionContainer);
