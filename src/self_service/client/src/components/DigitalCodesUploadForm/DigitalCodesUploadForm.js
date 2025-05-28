import React, { Fragment, Component }  from 'react';
import { withStyles } from '@material-ui/core/styles';
import { Avatar, Button, Chip, Paper, Typography, CircularProgress, Backdrop } from '@material-ui/core';
import { ValidatorForm, TextValidator} from 'react-material-ui-form-validator';
import 'react-quill/dist/quill.snow.css';
import * as FileType from '../../constants/files';
import styles from "./styles";
import FileUpload from '../FileUpload/FileUpload';

const configurationId = "configurationId";
const prizeId = "prizeId";
const digitalCodes = "digitalCodes";

class DigitalCodesUploadForm extends Component {
    render() {
        const {
          classes, errors, store, onConfigurationSearch, onTextInputChange,
           onFileChange, onSave, isEdit } = this.props;

        const chipLabel = "Upload Prize Vouchers";

        return (
            <Fragment>
                <Backdrop className={classes.backdrop} open={store.spinnerEnabled}>
                    <CircularProgress color="inherit" />
                </Backdrop>
                <Paper>           
                    <ValidatorForm  className={classes.container} autoComplete="off" onSubmit={event => onSave(event)}>
                        <Chip
                            avatar={<Avatar>PR</Avatar>}
                            label={chipLabel}
                            color="primary"
                            className={classes.mainChip}
                        />
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Configuration</Typography>
                            </label>
                            <TextValidator
                                autoFocus
                                id={configurationId}
                                name={configurationId}
                                className={classes.textField}
                                value={store.configurationId}
                                onChange={(event) => onTextInputChange(event)}
                                margin="normal"
                                required
                                validators={['required']}
                                errorMessages={['This field is required']}
                                InputProps={{
                                    disableUnderline: true
                                }}
                            />
                            <Button type="button" variant="contained" className={classes.configButton} onClick={onConfigurationSearch}>Search</Button>
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Prize id</Typography>
                            </label>
                            <TextValidator
                                id={prizeId}
                                name={prizeId}
                                className={classes.textField}
                                value={store.prizeId}
                                onChange={(event) => onTextInputChange(event)}
                                margin="normal"
                                required
                                validators={['required']}
                                errorMessages={['This field is required']}
                                disabled = { store.formDisabled }
                                style={store.formDisabled  ? {  opacity: 0.3 } : {}}
                                inputProps={{
                                    maxLength: 50
                                }}
                                InputProps={{
                                    disableUnderline: true,
                                }}
                            />
                        </div>            
                         <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Digital codes</Typography>
                            </label>
                            <div className={classes.fileUpload} style={store.formDisabled  ? {  display: "none" } : {}}>
                                <FileUpload type={FileType.CSV_FILE} name={digitalCodes} onChange={onFileChange} />
                            </div>
                        </div>
                        <div className={classes.rowContainer}>
                            <Button type="submit" variant="contained" className={classes.button} disabled = { store.formDisabled }
                                style={store.formDisabled  ? {  opacity: 0.3 } : {}}>Save</Button>
                        </div>
                    </ValidatorForm>
                </Paper>
            </Fragment>            
        );
    };
};

export default withStyles(styles)(DigitalCodesUploadForm);