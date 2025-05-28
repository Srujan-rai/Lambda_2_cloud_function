import React, {Component, Fragment} from 'react';
import {Typography, Select, MenuItem, Button, FormControlLabel, RadioGroup, Radio} from '@material-ui/core';
import { withStyles, Chip, Avatar } from '@material-ui/core';
import { analysisTablesList, analysisUserTypesList } from '../../constants/lists';
import { ValidatorForm, TextValidator} from 'react-material-ui-form-validator';

const styles = (theme) => ({
    root: {
        color: "#f40000",
        marginBottom: "50px"
    },
    chip: {
        margin: "30px 0 30px 65px",
        fontSize: 16
    },
    container: {
        width: "50%",
        marginLeft: "65px",
        display: "flex",
        flexDirection: "column",
        justify: "flex-start",
        alignItems: "flex-start"
    },
    textField: {
        backgroundColor: "white",
        marginLeft: "65px",
        width: "230px",
        height: "35px",
        borderRadius: "5px",
        boxShadow: "0px 0px 0px 2px #f40000",
        paddingLeft: "5px",
        paddingRight: "5px",
        paddingTop: "5px",
        marginBottom: "10px",
        marginTop: "5px"
    },
    label: {
        width: "230px",
        marginLeft: "65px",
        display: "flex",
        flexDirection: "column",
        justify: "flex-start",
        alignItems: "flex-start"
    },
    rowContainer: {
        marginLeft: "65px",
        marginTop: "10px",
        display: "inline"
    },
    select: {
        width: "230px",
        marginLeft: "65px",
        color: "black",
        borderRadius: "3px",
        boxShadow: "0px 0px 0px 2px #f40000",
        height: "35px",
        marginBottom: "10px",
        display: "flex",
        flexDirection: "row",
        justify: "flex-start",
        alignItems: "flex-start",
        paddingLeft: "20px",
        marginTop: "5px"
    },
    group: {
        width: "230px",
        marginLeft: "65px"
    },
    button: {
        marginLeft: "130px",
        marginBottom: "50px",
        marginTop: "30px",
        color: "white",
        width: "100px",
        backgroundColor: "#f40000",
        borderRadius: "5px solid white"
    }
});

class QueryTableForm extends Component {
    render() {
        const { store, classes, onTextInputChange, onSelectChange, onSearch } = this.props;

        return (
            <Fragment>
                <ValidatorForm className={classes.root} autoComplete="off" onSubmit={event => onSearch(event)}>
                    <Chip
                        avatar={<Avatar>QT</Avatar>}
                        label="Query Table"
                        color="primary"
                        className={classes.chip}
                    />
                    <div className={classes.rowContainer}>
                        <label className={classes.label}>
                            <Typography variant="body2" gutterBottom>Table Properties (comma separated)</Typography>
                        </label>
                        <TextValidator
                            name={'queryProps'}
                            className={classes.textField}
                            value={store.queryProps}
                            onChange={(event) => onTextInputChange(event)}
                            margin="normal"
                            required
                            validators={['required']}
                            errorMessages={['This field is required']}
                            InputProps={{
                                disableUnderline: true
                            }}
                            inputProps={{
                                minLength: 5,
                                maxLength: 200
                            }}
                        />
                    </div>
                    <div className={classes.rowContainer}>
                        <label className={classes.label}>
                            <Typography variant="body2" gutterBottom>Table Values (comma separated)</Typography>
                        </label>
                        <TextValidator
                            name={'queryValues'}
                            className={classes.textField}
                            value={store.queryValues}
                            onChange={(event) => onTextInputChange(event)}
                            margin="normal"
                            validators={['required']}
                            errorMessages={['This field is required']}
                            InputProps={{
                                disableUnderline: true
                            }}
                            inputProps={{
                                minLength: 3,
                                maxLength: 200
                            }}
                        />
                    </div>
                    <div className={classes.rowContainer}>
                        <label className={classes.label}>
                            <Typography variant="body2" gutterBottom>Table</Typography>
                        </label>
                        <Select
                            value={store.table}
                            onChange={(event) => onSelectChange(event)}
                            name={'table'}
                            className={classes.select}
                            required
                            disableUnderline
                            validators={['required']}
                            errorMessages={['This field is required']}
                        >
                            {analysisTablesList.map(table => (
                                <MenuItem key={table} value={table}>
                                    {table}
                                </MenuItem>
                            ))}
                        </Select>
                    </div>
                    <Button type="submit" variant="contained" color="primary" className={classes.button}>Search</Button>
                </ValidatorForm>
            </Fragment>
        );
    }
};

export default withStyles(styles)(QueryTableForm);
