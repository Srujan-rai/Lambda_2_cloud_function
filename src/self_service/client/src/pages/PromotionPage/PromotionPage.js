import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import Page from '../../components/Page';
import PromotionContainer from '../../containers/PromotionContainer';

const propTypes = {
    classes: PropTypes.object.isRequired
};

const styles = () => ({});

const PromotionPage = (props) => {
    return (
        <Page>
            <Fragment>
                <PromotionContainer {...props} />
            </Fragment>
        </Page>
    );
};

PromotionPage.propTypes = propTypes;

export default withStyles(styles)(PromotionPage);