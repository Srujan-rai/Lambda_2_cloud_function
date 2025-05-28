import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';

import ImageIcon from '@material-ui/icons/Image';
import Tooltip from '@material-ui/core/Tooltip';
import { MenuItem, withStyles, Select, Typography } from '@material-ui/core';
import { TextValidator } from 'react-material-ui-form-validator';
import ReactQuill from 'react-quill';
import * as FileType from '../../constants/files';
import InfoIcon from '@material-ui/icons/Info';

import styles from './styles';

// HOC components only !!!

// classes come from withStyle ....
let VInput = ({ fieldData, handleOnChange, options, classes }) => {
    let elemProps = {
        name: fieldData.name,
        value: fieldData.value || "",
        placeholder: fieldData.placeholder || "",
        margin: "normal",
        className: classes.textField,
        InputProps: {
            disableUnderline: true
        }
    };
    if (options) {
        if (options.multiline) {
            elemProps["multiline"] = true;
            elemProps["rows"] = options.rows || 5;
        }
        if (options.required) {
            elemProps["validators"] = ["required"];
        }
        if (options.type) {
            elemProps.type = options.type;

            if (options.type === 'number' && +fieldData.value > -1) {
                elemProps.value = +fieldData.value;
            }
        }
    }
    return (
        <div className={classes.rowContainer}>
            {fieldData.label &&
                <label>
                    <Typography variant="body2" gutterBottom className={classes.label}>
                        {fieldData.label}
                    </Typography>
                </label>
            }
            {fieldData.tooltip &&
                <Tooltip placement="right" title={
                    <span className={classes.tooltipText}>
                        {fieldData.tooltip}
                    </span>
                }>
                    <InfoIcon className={classes.checkboxTooltipIcon} fontSize="small" />
                </Tooltip>
            }
            <TextValidator
                {...elemProps}
                onChange={ev => handleOnChange({ name: ev.target.name, value: ev.target.value })}
            />
            {fieldData.error &&
                <div className={classes.error}>
                    {fieldData.error}
                </div>}
        </div>
    )
};

VInput.propTypes = {
    fieldData: PropTypes.shape({
        label: PropTypes.string,
        name: PropTypes.string.isRequired,
        value: PropTypes.any,
        error: PropTypes.string,
        tooltip: PropTypes.string

    }),
    handleOnChange: PropTypes.func.isRequired,
    options: PropTypes.object,
    classes: PropTypes.object,
};

let VArea = ({ fieldData, handleOnChange, options, classes }) => {
    const { label, name, value = "" } = fieldData;
    return (
        <div className={classes.rowContainer}>
            <label>
                <Typography variant="body2" gutterBottom className={classes.label}>
                    {label}
                </Typography>
            </label>
            <ReactQuill
                theme="snow"
                name={name}
                value={value}
                onChange={html => handleOnChange({ value: html, name })}
                className={classes.textArea}
            />
            {fieldData.error &&
                <div className={classes.error}>
                    {fieldData.error}
                </div>}
        </div>
    )
};

VArea.propTypes = {
    fieldData: PropTypes.shape({
        label: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        value: PropTypes.string,
        error: PropTypes.string
    }),
    handleOnChange: PropTypes.func.isRequired,
    options: PropTypes.object,
    classes: PropTypes.object
};

//options.listData
let VSelect = ({ fieldData, handleOnChange, options, classes }) => {
    const { label, name, value } = fieldData;
    let listData = options.list || [];

    return (
        <div className={classes.rowContainer}>
            <label>
                <Typography variant="body2" gutterBottom className={classes.label}>
                    {label}
                </Typography>
            </label>
            <Select
                name={name}
                value={value || ""}
                onChange={ev => handleOnChange({ name: ev.target.name, value: ev.target.value })}
                fullWidth
                className={classes.select}
                disableUnderline
            >
                {listData.map(lValue => (
                    <MenuItem key={lValue} value={lValue}>
                        {lValue}
                    </MenuItem>
                ))}
            </Select>
            {fieldData.error &&
                <div className={classes.error}>
                    {fieldData.error}
                </div>
            }
        </div>
    );
}

VSelect.propTypes = {
    fieldData: PropTypes.shape({
        label: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        value: PropTypes.string.isRequired,
        error: PropTypes.string
    }),
    handleOnChange: PropTypes.func.isRequired,
    options: PropTypes.object,
    classes: PropTypes.object
};

let VFile = ({ fieldData, handleOnChange, classes }) => {
    const { label, name, value } = fieldData;
    return (
        <div className={classes.rowContainer}>
            <label>
                <Typography variant="body2" gutterBottom className={classes.label}>
                    {label}
                </Typography>
            </label>

            <input
                className={classes.fileUpload}
                type="file"
                name={name}
                onChange={ev =>
                    handleOnChange({ name: ev.target.name, value: ev.target.value, files: ev.target.files }, FileType.IMAGE_FILE)}
                id={name} />
            {value && <div className={classes.cell}>
                <Tooltip title={value}>
                    <ImageIcon />
                </Tooltip>
            </div>}
            {fieldData.error &&
                <div className={classes.error}>
                    {fieldData.error}
                </div>
            }
        </div>
    );
}

// input Files
VFile.propTypes = {
    fieldData: PropTypes.shape({
        label: PropTypes.string,
        name: PropTypes.string.isRequired,
        value: PropTypes.string,
        error: PropTypes.string
    }),
    handleOnChange: PropTypes.func.isRequired,
    options: PropTypes.object,
    classes: PropTypes.object
};

VInput = withStyles(styles)(VInput);
VArea = withStyles(styles)(VArea);
VSelect = withStyles(styles)(VSelect);
VFile = withStyles(styles)(VFile);

export {
    VInput,
    VArea,
    VSelect,
    VFile
};
