import React from "react";
import { Typography, Button } from "@material-ui/core";
import { withStyles, Chip, Avatar } from "@material-ui/core";
import { ValidatorForm, TextValidator } from "react-material-ui-form-validator";
import styles from "../getParticipationForm/styles";

const GetDigitalCodeByVOucherForm = ({ state, classes, onChange, onSubmit }) => (
    <ValidatorForm
        className={classes.root}
        autoComplete="off"
        onSubmit={onSubmit}
    >
        <Chip
            avatar={<Avatar>DCI</Avatar>}
            label="Digital Codes Info"
            color="primary"
            className={classes.chip}
        />
        <div className={classes.rowContainer}>
            <label className={classes.label}>
                <Typography variant="body2" gutterBottom>
                    Voucher
                </Typography>
            </label>
            <TextValidator
                name="voucher"
                className={classes.textField}
                value={state.voucher}
                onChange={onChange}
                margin="normal"
                validators={["required"]}
                errorMessages={["This field is required"]}
                InputProps={{
                    disableUnderline: true
                }}
                inputProps={{
                    minLength: 1,
                    maxLength: 20
                }}
            />
        </div>
        <Button
            type="submit"
            variant="contained"
            color="primary"
            className={classes.button}
        >
            Search
        </Button>
    </ValidatorForm>
);

export default withStyles(styles)(GetDigitalCodeByVOucherForm);
