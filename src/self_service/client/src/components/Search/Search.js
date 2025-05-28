import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core';
import { Avatar, Button, Chip, Paper, Typography } from '@material-ui/core';
import { TextValidator, ValidatorForm } from 'react-material-ui-form-validator';

const propTypes = {
    /** Headline acronym */
    acronym: PropTypes.string.isRequired,
    /** Text with purpose to inform the user about what is to be searched */
    headline: PropTypes.string.isRequired,
    /** ID of the model (entity) that is going to be searched for (Configuration Id, Promotion Id, ...) */
    searchId: PropTypes.string.isRequired,
    /** Search input field value */
    value: PropTypes.string.isRequired,
    /** Callback function that will be invoked upon text is changed in input field */
    onTextInputChange: PropTypes.func.isRequired,
    /** Callback function that will be invoked upon click (search function) */
    onSearch: PropTypes.func.isRequired,
    /** @ignore */
    classes: PropTypes.object.isRequired
};

const defaultProps = {};

const styles = {
    container: {
        width: "100%",
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        justify: "flex-start",
        alignItems: "flex-start",
    },
    paper: {
        paddingBottom: 50
    },
    chip: {
        margin: "30px 0 30px 0",
        fontSize: 16
    },
    rowContainer: {
        display: "inline",
        flexDirection: "column",
        justify: "flex-start",
        alignItems: "flex-start",
        minHeight: "100px"
    },
    label: {
        width: "220px",
        marginLeft: "50px",
        display: "flex",
        flexDirection: "column",
        justify: "flex-start",
        alignItems: "flex-start"
    },
    textField: {
        backgroundColor : "white",
        marginLeft: "50px",
        width: "200px",
        height: "35px",
        borderRadius: "5px",
        boxShadow: "0px 0px 0px 2px #f40000",
        paddingLeft: "5px",
        paddingRight: "5px",
        paddingTop: "5px",
        marginBottom: "10px",
        marginTop: "5px"
    },
    button: {
        marginTop: "29px",
        marginLeft: "30px",
        color: "white",
        width: "100px",
        backgroundColor: "#f40000",
        borderRadius: "5px solid white"
    }
};

const Search = ({ classes, acronym, headline, searchId, value, onTextInputChange, onSearch, children, configIdValue, searchSecParam, onConfigIdChange, isEdit }) => (
    <Fragment>
        <Paper className={classes.paper}>
            <div className={classes.rowContainer}>
                <Chip
                    avatar={<Avatar>{acronym}</Avatar>}
                    label={headline}
                    color="primary"
                    className={classes.chip}
                />
                <div>{children}</div>
                <ValidatorForm  className={classes.container} autoComplete="off" onSubmit={onSearch} name="FORM">
                    {
                        isEdit &&
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>{searchSecParam}</Typography>
                            </label>
                            <TextValidator
                                id="searchEdit"
                                name="searchEdit"
                                value={configIdValue}
                                className={classes.textField}
                                onChange={onConfigIdChange}
                                margin="normal"
                                required
                                validators={['required']}
                                errorMessages={['This field is required']}
                                InputProps={{
                                    disableUnderline: true
                                }}
                            />
                        </div>
                    }
                    <div className={classes.rowContainer}>
                        <label className={classes.label}>
                            <Typography variant="body2" gutterBottom>{searchId}</Typography>
                        </label>
                        <TextValidator
                            id="search"
                            name="search"
                            value={value}
                            className={classes.textField}
                            onChange={onTextInputChange}
                            margin="normal"
                            required
                            validators={['required']}
                            errorMessages={['This field is required']}
                            InputProps={{
                                disableUnderline: true
                            }}
                        />
                    </div>
                    <div className={classes.rowContainer}>
                        <Button type="submit" variant="contained" color="primary" className={classes.button}>
                            Search
                        </Button>
                    </div>
                </ValidatorForm>
            </div>
        </Paper>
    </Fragment>
);

Search.propTypes = propTypes;
Search.defaultProps = defaultProps;

export default withStyles(styles)(Search);