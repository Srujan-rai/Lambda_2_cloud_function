import React, { Component } from 'react';
import {Typography} from "@material-ui/core";
import {TextValidator} from "react-material-ui-form-validator";
import IconButton from "@material-ui/core/IconButton";
import {Add, Remove} from "@material-ui/icons";
import {compose} from "lodash/fp";
import {withStyles} from "@material-ui/core/styles";
import styles from "../ConfigurationForm/stylesInstantWinFlow";

const fieldNameMap ={
    "Prize ID": "prizeId",
    "Prize Limit": "prizeLimit",
    "Currency ID": "currencyId",
    "Cost": "amount",
    "Tier": "tier",
    "Limit": "tierLimit",
    "ViralCode": "viralCode",
    "PrizeIds": "prizeIds"
}
class MultipleFieldPairsComponent extends Component {


    render() {
        const {objectProperty, objectValue, idx, classes, onRow, handler, firstLabelName, secondLabelName, typeOfFirstFormField, typeOfSecondFormField} = this.props;
        return (
            <div
                style={{width: "800px", display: "flex", "flex-direction": "row", "align-items": "flex-start"}}>
                <div className={classes.rowContainer}>
                    <label className={classes.label}>
                        <Typography variant="body2" gutterBottom>{firstLabelName}</Typography>
                    </label>
                    <TextValidator
                        id={idx}
                        name={fieldNameMap[firstLabelName]}
                        value={objectProperty}
                        onChange={handler(idx)}
                        className={classes.textField}
                        margin="normal"
                        required
                        type={typeOfFirstFormField}
                        validators={['required']}
                        errorMessages={['This field is required', 'Type must be number!', 'Number must be positive', 'Number must be less or equal to 900']}
                        InputProps={{
                            disableUnderline: true
                        }}
                    />
                </div>
                <div className={classes.rowContainer}>
                    <label className={classes.label}>
                        <Typography variant="body2" gutterBottom>{secondLabelName}</Typography>
                    </label>
                    <TextValidator
                        id={idx}
                        name={fieldNameMap[secondLabelName]}
                        value={objectValue}
                        onChange={handler(idx)}
                        className={classes.textField}
                        margin="normal"
                        required
                        type={typeOfSecondFormField}
                        validators={['required']}
                        errorMessages={['This field is required', 'Type must be number!', 'Number must be positive', 'Number must be less or equal to 900']}
                        InputProps={{
                            disableUnderline: true
                        }}
                    />
                </div>
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

export default enhance(MultipleFieldPairsComponent)
