import React, { Component, Fragment } from "react";
import { withStyles } from '@material-ui/core/styles';
import FileUpload from '../FileUpload/FileUpload';
import { Button, Paper, Backdrop, CircularProgress } from '@material-ui/core';
import { HeaderChip } from "../Commons";
import { ValidatorForm } from "react-material-ui-form-validator";
import {ZIP_FILE} from '../../constants/files';
import styles from './styles';
class UploadReplicationForm extends Component {
    render() {
        const { store, classes, onFileChange, onSubmit } = this.props;

        return (
            <Fragment>
                <Paper>
                    <Backdrop className={classes.backdrop} open={store.spinnerEnabled}>
                        <CircularProgress color="inherit" />
                    </Backdrop>
                    <HeaderChip
                        label='Upload Replicaiton Package'
                        avatar='URP'
                        classes={{ headerChip: classes.mainChip }} />
                    <ValidatorForm className={classes.container} autoComplete="off" onSubmit={event => onSubmit(event)}>
                        <FileUpload
                            classes={classes}
                            type={ZIP_FILE}
                            name="replicationPackage"
                            onChange={onFileChange}
                        />
                        <Button type="submit" variant="contained" className={classes.button}>Upload Package</Button>
                    </ValidatorForm>
                </Paper>
            </Fragment>
        );
    }
};

export default withStyles(styles)(UploadReplicationForm);