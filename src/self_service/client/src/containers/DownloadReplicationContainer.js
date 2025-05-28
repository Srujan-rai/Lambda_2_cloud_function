import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import { compose } from 'lodash/fp';
import DownloadReplicationForm from '../components/DownloadReplicationForm/DownloadReplicationForm';
import { DOWNLOAD_REPLICATION_FORM } from '../constants/forms';
import { textInputChange, checkboxChange, enableSpinner } from '../redux/ui/actions';
import { downloadReplication } from '../redux/downloadReplication/actions';

const propTypes = {
    classes: PropTypes.object.isRequired
};

const styles = {};

class DownloadReplicaitonsContainer extends Component {
    handleTextInputChange = (event) => {
        const { changeText } = this.props;
        changeText(event, DOWNLOAD_REPLICATION_FORM);
    }

    handleSubmit = (event) => {
        const { download, DownloadReplicationFormState, enableSpinner } = this.props;
        enableSpinner(DOWNLOAD_REPLICATION_FORM, true);
        download(DownloadReplicationFormState);
    }

    handleCheckboxChange = (event) => {
        const { changeSelect } = this.props;
        changeSelect(event, DOWNLOAD_REPLICATION_FORM);
    }

    render() {
        const { DownloadReplicationFormState } = this.props;
        return (
            <Fragment>
                <DownloadReplicationForm
                    store={DownloadReplicationFormState}
                    onTextInputChange={this.handleTextInputChange}
                    onCheckboxChange={this.handleCheckboxChange}
                    onSubmit={this.handleSubmit}
                />
            </Fragment>
        );
    }
};

DownloadReplicaitonsContainer.propTypes = propTypes;

const mapStateToProps = state => ({
    DownloadReplicationFormState: state.ui[DOWNLOAD_REPLICATION_FORM]
});

const mapDispatchToProps = dispatch => ({
    changeText: (event, source) => {
        dispatch(textInputChange(event, source));
    },
    changeSelect: (event, source) => {
        dispatch(checkboxChange(event, source));
    },
    enableSpinner: (source, spinnerStatus) => {
        dispatch(enableSpinner(source, spinnerStatus));
    },
    download: (data) => {
        dispatch(downloadReplication(data));
    }
});

const enhance = compose(
    withStyles(styles),
    connect(mapStateToProps, mapDispatchToProps)
);

export default enhance(DownloadReplicaitonsContainer);
