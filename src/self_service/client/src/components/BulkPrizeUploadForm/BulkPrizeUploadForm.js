import React, { Fragment } from "react";
import { withStyles } from "@material-ui/core/styles";
import {
    Avatar,
    Button,
    Chip,
    Paper,
    Typography,
    CircularProgress,
    Backdrop,
    Tooltip,
    Link
} from "@material-ui/core";
import InfoIcon from '@material-ui/icons/Info';
import { ValidatorForm, TextValidator } from "react-material-ui-form-validator";
import "react-quill/dist/quill.snow.css";
import * as FileType from "../../constants/files";
import styles from "./styles";
import FileUpload from "../FileUpload/FileUpload";

const BulkPrizeUploadForm = (props) => {
    const {
        classes,
        store,
        onSave,
        urlPath,
        onConfigurationSearch,
        onFileChange,
        onTextInputChange,
    } = props;

    return (
        <Fragment>
            <Backdrop className={classes.backdrop} open={store.spinnerEnabled}>
                <CircularProgress color="inherit" />
            </Backdrop>
            <Paper>
                <ValidatorForm
                    className={classes.container}
                    autoComplete="off"
                    onSubmit={onSave}
                >
                    <Chip
                        avatar={<Avatar>BPU</Avatar>}
                        label={"Add Prizes via Bulk Upload"}
                        color="primary"
                        className={classes.mainChip}
                    />

                    <div className={classes.rowContainer}>
                        <label className={classes.label}>
                            <Typography variant="body2" gutterBottom>
                                Configuration
                            </Typography>
                        </label>
                        <TextValidator
                            autoFocus
                            id={"configurationId"}
                            name={"configurationId"}
                            className={classes.textField}
                            value={store.configurationId}
                            onChange={onTextInputChange}
                            margin="normal"
                            required
                            validators={["required"]}
                            errorMessages={["This field is required"]}
                            InputProps={{
                                disableUnderline: true,
                            }}
                        />


                        <Button
                            disabled={store.spinnerEnabled}
                            type="button"
                            variant="contained"
                            className={classes.configButton}
                            onClick={onConfigurationSearch}
                        >
                            Search
                        </Button>
                    </div>

                    {!store.formDisabled && (
                        <Fragment>
                            <div className={classes.rowContainer}>
                                <label className={`${classes.label} ${classes.labelWithIcon}`}>
                                    <Typography variant="body2" gutterBottom>
                                        <span>
                                            Prize File Upload.(CSV only)
                                        </span>
                                    </Typography>
                                    <Tooltip placement="right" interactive title={
                                        <span className={classes.tooltipText}>
                                            Each prize can have up to 5 image urls per language. If more are uploaded, only the first 5 will be considered. For more details, check the&nbsp;
                                            <Link href="https://dev.azure.com/GlobalEngg/NextGen%20Promo%20Services%20NGPS/_wiki/wikis/NextGen-Promo-Services-NGPS.wiki/4775/Add-Prizes-via-Bulk-Upload" target='_blank' rel="noopener noreferrer">
                                                documentation.
                                            </Link>
                                        </span>
                                    }>
                                        <InfoIcon className={classes.tooltipIcon} fontSize="small" />
                                    </Tooltip>
                                </label>
                                <div className={classes.fileUpload}>
                                    <FileUpload
                                        type={FileType.CSV_FILE}
                                        name="prizeFile"
                                        onChange={onFileChange}
                                    />
                                </div>
                            </div>
                            <div className={classes.rowContainer}>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    className={classes.button}
                                    disabled={store.spinnerEnabled}
                                >
                                    Save
                                </Button>
                            </div>
                        </Fragment>
                    )}
                </ValidatorForm>
            </Paper>
        </Fragment>
    );
};

export default withStyles(styles)(BulkPrizeUploadForm);
