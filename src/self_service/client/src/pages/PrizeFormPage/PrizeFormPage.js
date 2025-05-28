import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import AddPrizeContainer from '../../containers/AddPrizeContainer';
import Page from '../../components/Page';

const propTypes = {
    classes: PropTypes.object.isRequired
};

const styles = () => ({
});

const PrizeFormPage = () => {
    return (
        <Page>
            <Fragment>
                <AddPrizeContainer />
            </Fragment>
        </Page>
    );
};

PrizeFormPage.propTypes = propTypes;

export default withStyles(styles)(PrizeFormPage);