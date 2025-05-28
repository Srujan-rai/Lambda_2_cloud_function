import React, { Component } from 'react';
import {Typography} from "@material-ui/core";
import {TextValidator} from "react-material-ui-form-validator";
import IconButton from "@material-ui/core/IconButton";
import {Add, Remove} from "@material-ui/icons";
import {compose} from "lodash/fp";
import {withStyles} from "@material-ui/core/styles";
import styles from "../ConfigurationForm/stylesInstantWinFlow";

class SingleInputComponent extends Component {


    render() {
        const {value, idx, classes, onRow, handler, labelName, typeOfField, validators, errorMessages, source, valuesToUpdate, paramToUpdate} = this.props;
        return ( 
            <div
                style={{width: "800px", display: "flex", "alignItems": "center"}}>
                <div className={classes.rowContainer}>
                    <label className={classes.label}>
                        <Typography variant="body2" gutterBottom>{labelName}</Typography>
                    </label>
                    <TextValidator
                        id= {source ? `${source}${idx}` : idx}
                        name={labelName}
                        value={value}
                        onChange={handler(idx, valuesToUpdate, paramToUpdate)}
                        className={classes.textField}
                        margin="normal"
                        required
                        type={typeOfField}
                        validators={validators}
                        errorMessages={errorMessages}
                        InputProps={{
                            disableUnderline: true
                        }}
                    />
                </div>
            {/* TODO: Add id to icon button component */}
                <IconButton aria-label="Add" style={{margin: "0px"}} onClick={onRow(idx)}>
                    {
                        (idx === 0) ?
                            <Add /> :
                            <Remove />
                    }
                </IconButton>
            </div>
        );
    }
}
const enhance = compose(
    withStyles(styles)

);

export default enhance(SingleInputComponent)