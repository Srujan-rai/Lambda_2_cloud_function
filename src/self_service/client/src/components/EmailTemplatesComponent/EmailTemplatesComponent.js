import React from 'react';
import PropTypes from 'prop-types';
import { Button, Paper, withStyles, List, ListItem, ListItemText, ListItemSecondaryAction } from '@material-ui/core';
import { ValidatorForm } from 'react-material-ui-form-validator';

import styles from './styles';
import labels from './labels';
import { HeaderChip, VInput, VArea, VSelect, VFile, CheckBtn } from '../Commons';
import { SocialIcons } from '../SocialIcons';

const EmailTemplatesComponent = ({ formData, initialIcons, errorsData, handlers, classes }) => {
    const inputRender = (Element, key, options) => {
        const fieldData = {
            label: labels[key],
            name: key,
            value: formData[key],
            error: errorsData && errorsData[key] ? errorsData[key] : ""
        }
        //diff handler for VFile !!!
        const _onChange = (options && options.onChange) ? options.onChange : handlers.onChange;
        return (
            <Element
                fieldData={fieldData}
                handleOnChange={_onChange}
                options={options}
            />
        )
    }
    const localizationInputRender = (Element, key, options) => {
        const fieldData = {
            label: labels[key],
            name: key,
            value: formData.localizationLabels ? formData.localizationLabels[key] : "",
            error: errorsData && errorsData[key] ? errorsData[key] : ""
        }
        const _onChange = (options && options.onChange) ? options.onChange : handlers.onChange;
        return (
            <Element
                fieldData={fieldData}
                handleOnChange={_onChange}
                options={options}
            />
        )
    }

    return (
        <Paper className={classes.paper}>
            <div className={classes.rowContainer}>
                <HeaderChip
                    label={`Email Template - ${formData.type}`}
                    avatar="ET" />

                <ValidatorForm autoComplete="off" name="FORM" onSubmit={handlers.onSubmit}>
                    {inputRender(VInput, 'templateName')}
                    <br />
                    {inputRender(VSelect, 'country', { list: formData['countryList'] })}
                    <br />
                    {inputRender(VInput, 'subjectText', { multiline: true, rows: 3 })}
                    <br />
                    {inputRender(VInput, 'senderName')}
                    <br />
                    {inputRender(VInput, 'senderEmail')}
                    <br />
                    {inputRender(VFile, 'headerImage', { onChange: handlers.onFile })}
                    <br />
                    {inputRender(VArea, 'introductoryText')}
                    <br />
                    {inputRender(VInput, 'additionalText', { multiline: true })}
                    <br />
                    {localizationInputRender(VInput, 'expiryLabel')}
                    <br />
                    {localizationInputRender(VInput, 'redemptionLabel')}
                    <br />
                    {inputRender(VInput, 'privacyPolicy')}
                    <br />
                    {inputRender(VInput, 'termsOfService')}
                    <br />
                    <fieldset className={classes.fieldSet}>
                        <legend className={classes.legend}>Social icons</legend>
                        <SocialIcons icons={formData.icons && formData.icons.length ? formData.icons : initialIcons} iconsOnChange={handlers.iconsOnChange} />
                    </fieldset>
                    <br />
                    {inputRender(VInput, 'copyrightText')}
                    <br />
                    {inputRender(VArea, 'signatureText')}
                    <br />
                    {inputRender(VInput, 'sesConfigSets')}
                    <br />
                    {inputRender(VInput, 'sesEmailTemplate')}
                    <br />

                    <div className={classes.rowContainer}>
                        <Button type="submit" variant="contained" color="primary" className={classes.button}>
                            {formData.type}
                        </Button>
                    </div>
                </ValidatorForm>
            </div>
        </Paper>
    );
}

EmailTemplatesComponent.propTypes = {
    formData: PropTypes.object.isRequired,
    initialIcons: PropTypes.array.isRequired,
    errorsData: PropTypes.object,
    handlers: PropTypes.object.isRequired
}

export default withStyles(styles)(EmailTemplatesComponent);