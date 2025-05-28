import React, { Component, Fragment } from "react";
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import { compose } from 'lodash/fp';
import UploadReplicationForm from "../components/UploadReplicationForm/UploadReplicationForm";
import { UPLOAD_REPLICATION_FORM } from '../constants/forms';
import { fileChange, enableSpinner } from '../redux/ui/actions';
import { uploadReplication } from '../redux/uploadReplication/actions';

const propTypes = {
    classes: PropTypes.object.isRequired
};

const styles = {};

class UploadReplicationContainer extends Component {
    handleFileChange = (event, isValid) => {
        const { changeFile } = this.props;
        changeFile(event, UPLOAD_REPLICATION_FORM, isValid);
    }

    handleSubmit = (event) => {
        const { upload, UploadReplicationFormState, enableSpinner } = this.props;
        enableSpinner(UPLOAD_REPLICATION_FORM, true);
        upload(UploadReplicationFormState, event.target.replicationPackage && event.target.replicationPackage.files[0]);
    }

    render() {
        const { UploadReplicationFormState } = this.props;
        return (
            <Fragment>
                <UploadReplicationForm 
                    store={UploadReplicationFormState}
                    onFileChange={this.handleFileChange}
                    onSubmit={this.handleSubmit}
                />
            </Fragment>
        );
    }
}

UploadReplicationContainer.propTypes = propTypes;

const mapStateToProps = state => ({
    UploadReplicationFormState: state.ui[UPLOAD_REPLICATION_FORM]
});

const mapDispatchToProps = dispatch => ({
    changeFile: (event, source) => {
        dispatch(fileChange(event, source));
    },
    enableSpinner: (source, spinnerStatus) => {
        dispatch(enableSpinner(source, spinnerStatus));
    },
    upload: (data, file) => {
        dispatch(uploadReplication(data, file));
    }
});

const enhance = compose(
    withStyles(styles),
    connect(mapStateToProps, mapDispatchToProps)
);

export default enhance(UploadReplicationContainer);
