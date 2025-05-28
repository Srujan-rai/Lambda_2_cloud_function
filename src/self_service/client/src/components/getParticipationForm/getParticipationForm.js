import React, { Component } from "react";
import {Typography, Button } from "@material-ui/core";
import { withStyles, Chip, Avatar } from "@material-ui/core";
import { ValidatorForm, TextValidator } from "react-material-ui-form-validator";
import styles from "./styles";

class getParticipationForm extends Component {
  render() {
    const { store, classes, searchParam, onTextInputChange, onSearch } = this.props;
return (
    <ValidatorForm
      className={classes.root}
      autoComplete="off"
      onSubmit={event => onSearch(event)}
    >
      <Chip
        avatar={<Avatar>PI</Avatar>}
        label="Participation Info"
        color="primary"
        className={classes.chip}
      />
        <div className={classes.rowContainer}>
            <label className={classes.label}>
                <Typography variant="body2" gutterBottom>
                    <span style={{ textTransform: "capitalize" }}>
                        {searchParam}
                    </span>
                </Typography>
            </label>
            <TextValidator
                name={searchParam}
                className={classes.textField}
                value={store[searchParam]}
                onChange={(event) => onTextInputChange(event)}
                margin="normal"
                required
                validators={['required']}
                errorMessages={['This field is required']}
                InputProps={{
                    disableUnderline: true
                }}
                inputProps={{
                    minLength: 1,
                    maxLength: 50
                }}
            />
        </div>
    
        <Button type="submit" variant="contained" color="primary" className={classes.button}>Search</Button>
    </ValidatorForm>
    );
  }
}

export default withStyles(styles)(getParticipationForm);