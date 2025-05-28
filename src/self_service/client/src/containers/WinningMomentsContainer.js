import React, { Component, Fragment } from 'react';
import { Button, Divider, FormControlLabel, RadioGroup, Radio, Typography, withStyles } from '@material-ui/core';
import { ValidatorForm, TextValidator } from 'react-material-ui-form-validator';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { dateTimeInputChange, textInputChange, numberChange, fileChange, clearForm } from '../redux/ui/actions';
import { uploadWinningMoments, generateWinningMoments, clearWinningMoments } from '../redux/winningMoments/actions';
import GeneratorForm from '../components/WinningMoments/GeneratorForm';
import FileUpload from '../components/FileUpload/FileUpload';
import { WINNING_MOMENTS_FORM } from '../constants/forms';
import * as FileType from '../constants/files';

const styles = {
    buttonContainer: { marginTop: 5, marginBottom: 5 },
    formContainer: { marginTop: 20, width: '50%', marginLeft: 50 },
    button: { color: 'white', backgroundColor: '#f40000', borderRadius: '5px solid white' },
    textField: { width: 250, height: 35, borderRadius: 5, boxShadow: '0 0 0 2px #f40000', padding: 5, marginBottom: 10, marginTop: 5 },
    wrapIcon: { verticalAlign: 'middle', display: 'inline-flex' }
};

const FlowLabel = Object.freeze({
    UPLOAD_WINNING_MOMENTS: 'winningMomentsInsertion',
    GENERATE_WINNING_MOMENTS: 'generateMoments'
});

class WinningMomentsContainer extends Component {
    handleFlowChange = event => {
        event.preventDefault();
        this.props.clearForm(WINNING_MOMENTS_FORM);
        this.props.clearWinningMoments();
        this.handleTextChange(event);
    };

    handleTextChange = event => {
        event.preventDefault();
        this.props.textInputChange({ ...event }, WINNING_MOMENTS_FORM);
    };

    handleNumberChange = event => {
        event.preventDefault();
        const { valueAsNumber, name } = event.target;
        this.props.numberChange(valueAsNumber, name, WINNING_MOMENTS_FORM);
    };

    handleFileChange = (event, isValid) => {
        this.props.fileChange(event, WINNING_MOMENTS_FORM, isValid);
    };

    handleSubmit = event => {
        event.preventDefault();
        switch (this.props.formState.flowLabel) {
            case FlowLabel.UPLOAD_WINNING_MOMENTS:
                this.props.uploadWinningMoments(event.target.fileUploader.files[0]);
                break;
            case FlowLabel.GENERATE_WINNING_MOMENTS:
                this.props.generateWinningMoments();
                break;
            default:
                break;
        }
    };

    render() {
        const { classes, formState, winningMomentsState, moveWinningMoments, dateTimeInputChange } = this.props;

        return (
            <div className={classes.formContainer}>
                <ValidatorForm autoComplete="off" onSubmit={this.handleSubmit}>
                    <label>
                        <Typography variant="body2" gutterBottom>
                            Configuration
                        </Typography>
                    </label>
                    <TextValidator name="configurationId" className={classes.textField} value={formState.configurationId} onChange={this.handleTextChange}
                        onBlur={this.handleConfigurationBlur} required validators={['required']} errorMessages={['This field is required']} InputProps={{ disableUnderline: true }} />
                    <RadioGroup name="flowLabel" value={formState.flowLabel} onChange={this.handleFlowChange} row>
                        <FormControlLabel value={FlowLabel.UPLOAD_WINNING_MOMENTS} control={<Radio color="primary" />} label="Upload from existing file" />
                        <FormControlLabel value={FlowLabel.GENERATE_WINNING_MOMENTS} control={<Radio color="primary" />} label="Generate new winning moments" />
                    </RadioGroup>
                    {formState.flowLabel === 'winningMomentsInsertion' && <FileUpload type={FileType.CSV_FILE} name="fileUploader" onChange={this.handleFileChange} />}
                    {formState.flowLabel === 'generateMoments' && <GeneratorForm onNumberChange={this.handleNumberChange} onDateTimeChange={dateTimeInputChange} formState={formState} />}
                    <div className={classes.buttonContainer}>
                        <Button type="submit" variant="contained" className={classes.button}>
                            Submit
                        </Button>
                    </div>
                </ValidatorForm>
                {winningMomentsState.csvContent && (
                    <Fragment>
                        <Divider style={{ marginTop: "1.5rem" }} />
                        <Typography className={classes.wrapIcon} variant="body2" gutterBottom style={{ marginTop: "1rem" }}>
                            <InfoOutlinedIcon fontSize="small" />
                            <span style={{ marginLeft: 5 }}>
                                Click "Download" to download and verify the generated file and upload it via "Upload from existing file".
                            </span>
                        </Typography>
                        <div style={{ marginTop: "1rem" }}>
                        <Button variant="contained" style={{ color: "blue" }} href={winningMomentsState.csvContent} on>
                                Download
                            </Button>
                        </div>
                    </Fragment>
                )}
            </div>
        );
    }

    componentDidMount() {
        this.props.clearForm(WINNING_MOMENTS_FORM);
        this.props.clearWinningMoments();
    };
}

const mapStateToProps = state => ({
    formState: state.ui[WINNING_MOMENTS_FORM],
    winningMomentsState: state.winningMoments
});

const mapDispatchToProps = {
    clearWinningMoments,
    uploadWinningMoments,
    generateWinningMoments,
    dateTimeInputChange,
    textInputChange,
    numberChange,
    fileChange,
    clearForm
};

export default compose(
    withStyles(styles),
    connect(mapStateToProps, mapDispatchToProps)
)(WinningMomentsContainer);
