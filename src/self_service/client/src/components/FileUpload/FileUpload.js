import React, { Component } from 'react';
import { withStyles } from '@material-ui/core';
import { validateFileType, validateImageDimensions } from '../../helpers/validations';

const styles = {
    fileUpload: {
        color: 'white',
        marginTop: 5,
        marginBottom: 15,
        borderRadius: 5,
        backgroundColor: '#f40000',
        boxShadow: '0px 0px 0px 1px #f40000',
        width: 250
    }
}

/**
 * File input component that is used to upload prize image.
 * Note: on configurationId change it will unload the selected file
 */
class FileUpload extends Component {
    handleFileChange = (event) => {
        event.preventDefault();
        const fileType = this.props.type;
        const file = event.target.files[0];
        const isValid = validateFileType(file, fileType);

        if (this.props.isIcon && isValid) {
            event.persist();
            return validateImageDimensions(file).then((res) => this.props.onChange(event, res, this.props.invalidIcoMsg));
        }
        this.props.onChange(event, isValid);
    };

    render() {
        const { classes, name, configurationKey, language, disabled } = this.props;
        return (
            <input
                disabled={disabled}
                className={classes.fileUpload}
                onChange={this.handleFileChange}
                name={name}
                language={language}
                type="file"
                key={configurationKey}
            />
        )
    }
}

export default withStyles(styles)(FileUpload);
