import { Remove } from '@material-ui/icons';
import React, { Component } from 'react';
import { withStyles, Tooltip } from '@material-ui/core';
import InfoIcon from '@material-ui/icons/Info';
import styles from "../PrizeForm/styles";
import { TextValidator } from 'react-material-ui-form-validator';
import { MenuItem, Select, Typography, IconButton } from '@material-ui/core';
import FileUpload from '../FileUpload/FileUpload';
import * as FileType from '../../constants/files';
import { PRIZE_IMAGE_SIZES , PRIZE_IMAGE_RATIO, PRIZE_IMAGE_STATUS} from '../../constants/forms';
import { getSelectedLanguageCode } from "../../helpers/utils";

const imgFileUploadName = "imgUrl";
const imgMetadata ={
    imgMetadataUrl: "url",
    imgMetadataPriority: "priority",
    imgMetadataSize: "size"
}
const validateImageDimensions = (file, width = 1080, height = 1080) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            if (img.width >= width && img.height >= height) {
                reject(`Please choose an image that is not larger than ${width}px x ${height}px.`);
            } else {
                resolve();
            }
        };
        img.src = window.URL.createObjectURL(file);
    });
};
class PrizeImage extends Component {
    state = {
        errorMessage: null
    }
    handleFileChange = (event, isValid) => {
        event.persist();
        const file = event.target.files[0];
        validateImageDimensions(file)
            .then(() => {
                this.setState({ errorMessage: null });
                this.props.onChangeFileUpload(event, this.props.index, getSelectedLanguageCode(this.props.store.selectedLanguage), event.target.value, isValid);
            })
            .catch((error) => {
                this.setState({ errorMessage: error });
                const inputValue = event.target.value;
                event.target.value = '';
                this.props.onChangeFileUpload(event, this.props.index, getSelectedLanguageCode(this.props.store.selectedLanguage), inputValue, isValid);
            });
    }
    render() {
        const { classes, store, currentImg, index, onFileItemRemoval, onImageMetadataChange, onImageMetadataNameChange} = this.props;
        const selectedLanguageCode = getSelectedLanguageCode(store.selectedLanguage);
        const hasMoreThanOneImage = store.imagesMetadata && store.imagesMetadata[selectedLanguageCode] && store.imagesMetadata[selectedLanguageCode].length > 1;
        const hasLangPriorityOptions = store.priorityOptions && store.priorityOptions[selectedLanguageCode];
        const changeNameToEmpty = "";
        const isFileInvalid = this.state.errorMessage !== null;
        return (
            <div style={{ position: "relative" }}>
                <FileUpload
                    type={FileType.IMAGE_FILE}
                    name={imgFileUploadName}
                    onChange={this.handleFileChange}
                    disabled={store.formDisabled}
                    configurationKey={store.configurationId}
                    accept="image/*"
                />
                {isFileInvalid && (
                    <div className={`MuiPaper-root MuiCard-root Notification-container-103 MuiPaper-elevation1 MuiPaper-rounded ${classes.errorMessage}`} style={{ backgroundColor: "#E53935", fontSize: "15px" }}>
                        {this.state.errorMessage}
                    </div>
                )}
                <IconButton
                    disabled={store.formDisabled || !hasMoreThanOneImage}
                    onClick={() => onFileItemRemoval(index, changeNameToEmpty)} color="primary" className={classes.iconButton}>
                    {<Remove fontSize="small" />}
                </IconButton>
                <label className={classes.label} style={{ marginLeft: '20px' }}>
                    <Typography variant="body2">Priority</Typography>
                    <Tooltip placement="right" title={
                        <span className={classes.tooltipText}>
                            Choose a number between 1 to 5 to indicate the image priority with 1 being the highest and 5 being the lowest.
                        </span>
                    }>
                        <InfoIcon className={classes.tooltipIcon} fontSize="small" />
                    </Tooltip>
                </label>
                <Select
                    value={currentImg && currentImg[imgMetadata.priority]}
                    onChange={event => onImageMetadataChange(index, selectedLanguageCode, event.target.value, event.target.name)}
                    name={imgMetadata.priority}
                    disabled={store.formDisabled}
                    style={{ opacity: store.formDisabled ? 0.3 : 1, marginLeft: '20px' }}
                    className={classes.select}
                    disableUnderline
                >
                    <MenuItem value={null}>
                        <Typography variant="body2" gutterBottom>--</Typography>
                    </MenuItem>
                    {
                        hasLangPriorityOptions && store.priorityOptions[selectedLanguageCode].map((item, index) => {
                            return (
                                <MenuItem value={item.value} key={index} style={{ display: item.selected ? 'none' : 'block' }}>
                                    <Typography variant="body2" gutterBottom>{item.value}</Typography>
                                </MenuItem>
                            )
                        })
                    }
                </Select>
                <label className={classes.label} style={{ marginLeft: '20px' }}>
                    <Typography variant="body2">Size</Typography>
                </label>
                <Select
                    value={currentImg && currentImg[imgMetadata.size]}
                    onChange={event => onImageMetadataChange(index, selectedLanguageCode, event.target.value, event.target.name)}
                    name={imgMetadata.size}
                    disabled={store.formDisabled}
                    style={{ opacity: store.formDisabled ? 0.3 : 1, marginLeft: '20px' }}
                    className={classes.select}
                    disableUnderline
                >
                    <MenuItem value={null}>
                        <Typography variant="body2" gutterBottom>--</Typography>
                    </MenuItem>
                    {
                        Object.keys(PRIZE_IMAGE_SIZES).map((key) => {
                            return (
                                <MenuItem value={key} key={key}>
                                    <Typography variant="body2" gutterBottom>{PRIZE_IMAGE_SIZES[key]}</Typography>
                                </MenuItem>
                            )
                        })
                    }
                </Select>
                <label className={classes.label} style={{ marginLeft: '20px' }}>
                    <Typography variant="body2">Image Name</Typography>
                </label>
                <TextValidator
                    value={currentImg && currentImg[imgMetadata.name]}
                    onBlur={event => onImageMetadataNameChange(index, selectedLanguageCode, event.target.value, event.target.name)}
                    onChange={event => onImageMetadataChange(index, selectedLanguageCode, event.target.value, event.target.name)}
                    name={imgMetadata.name}
                    disabled={store.formDisabled}
                    style={{ opacity: store.formDisabled ? 0.3 : 1, marginLeft: '20px' }}
                    className={classes.select}
                    InputProps={{
                        disableUnderline: true,
                    }}
                />

                <label className={classes.label} style={{ marginLeft: '20px' }}>
                    <Typography variant="body2">Active Status</Typography>
                </label>
                <Select
                    value={currentImg && currentImg[imgMetadata.activeStatus]}
                    onChange={event => onImageMetadataChange(index, selectedLanguageCode, event.target.value, event.target.name)}
                    name={imgMetadata.activeStatus}
                    disabled={store.formDisabled}
                    style={{ opacity: store.formDisabled ? 0.3 : 1, marginLeft: '20px' }}
                    className={classes.select}
                    disableUnderline
                >
                    <MenuItem value={null}>
                        <Typography variant="body2" gutterBottom>--</Typography>
                    </MenuItem>
                    {
                        Object.keys(PRIZE_IMAGE_STATUS).map((key) => {
                            return (
                                <MenuItem value={key} key={key}>
                                    <Typography variant="body2" gutterBottom>{PRIZE_IMAGE_STATUS[key]}</Typography>
                                </MenuItem>
                            )
                        })
                    }
                </Select>

                <label className={classes.label} style={{ marginLeft: '20px' }}>
                    <Typography variant="body2">Ratio</Typography>
                </label>
                <Select
                    value={currentImg && currentImg[imgMetadata.ratio]}
                    onChange={event => onImageMetadataChange(index, selectedLanguageCode, event.target.value, event.target.name)}
                    name={imgMetadata.ratio}
                    disabled={store.formDisabled}
                    style={{ opacity: store.formDisabled ? 0.3 : 1, marginLeft: '20px' }}
                    className={classes.select}
                    disableUnderline
                >
                    <MenuItem value={null}>
                        <Typography variant="body2" gutterBottom>--</Typography>
                    </MenuItem>
                    {
                        Object.keys(PRIZE_IMAGE_RATIO).map((key) => {
                            return (
                                <MenuItem value={key} key={key}>
                                    <Typography variant="body2" gutterBottom>{PRIZE_IMAGE_RATIO[key]}</Typography>
                                </MenuItem>
                            )
                        })
                    }
                </Select>
            </div>
        );
    }
}
export default withStyles(styles)(PrizeImage);
