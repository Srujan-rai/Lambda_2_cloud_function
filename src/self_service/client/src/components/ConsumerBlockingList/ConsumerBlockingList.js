import React from 'react';
import {Avatar, Button, Chip, Paper, Typography} from "@material-ui/core";
import {withStyles} from "@material-ui/core/styles";
import PropTypes from 'prop-types';
import {TextValidator, ValidatorForm} from "react-material-ui-form-validator";
import {styles} from "../../styles/styles";

const searchByUserId = "User Id";
const propTypes = {
    searchParam: PropTypes.string.isRequired,
    classes: PropTypes.object.isRequired,
    textChange: PropTypes.func.isRequired,
    onSearch: PropTypes.func.isRequired
};

const ConsumerBlockingList = ({ textChange, onSearch, searchParam, classes }) => {
    return (
        <Paper>
            <ValidatorForm
                className={classes.root}
                autoComplete="off"
                onSubmit={event => onSearch(event)}
            >
                <Chip
                    avatar={<Avatar>PI</Avatar>}
                    label="Search for blocked user"
                    color="primary"
                    className={classes.chip}
                />
                <div className={classes.rowContainer}>
                    <label className={classes.label}>
                        <Typography variant="body2" gutterBottom>
                            <span>
                            {searchByUserId}
                            </span>
                        </Typography>
                    </label>
                    <TextValidator
                        name={"searchByUserId"}
                        className={classes.textField}
                        value={searchParam}
                        onChange={(event) => textChange(event)}
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
        </Paper>
    );
};

ConsumerBlockingList.propTypes = propTypes;
export default withStyles(styles)(ConsumerBlockingList)