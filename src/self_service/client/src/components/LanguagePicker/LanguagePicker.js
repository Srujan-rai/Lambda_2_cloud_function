import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core';
import { Button, Card, CardContent, CardHeader, FormControl, MenuItem, OutlinedInput, Select } from '@material-ui/core';

const propTypes = {};

const defaultProps = {};

const styles = {
    card: {
        width: 310
    },
    select: {
        width: 280,
        height: 50,
        display: 'inline'
    },
    btnContainer: {
        marginTop: 40,
        width: 280
    },
    btnSave: {
        width: 130,
        float: 'left',
        color: '#ffffff',
        backgroundColor: '#f40000',
        borderRadius: '5px solid white'
    },
    btnCancel: {
        width: 130,
        float: 'right'
    }
};

const language = "language";

class LanguagePicker extends Component {
    state = {
        language: this.props.languages[0]
    }

    handleLanguageChange = event => {
        this.setState({
            language: event.target.value
        });
    }

    render () {
        const { classes, languages, onSelected, onCancel } = this.props;
        return (
            <Card className={classes.card}>
                <CardHeader
                    title="Add New Language"
                    subheader="Choose supported language"
                />
                <CardContent>
                    <FormControl variant="outlined" className={classes.formControl}>
                        <Select
                            className={classes.select}
                            value={this.state.language}
                            onChange={event => this.handleLanguageChange(event)}
                            input={<OutlinedInput name={language} id={language} labelWidth={0}/>}
                        >
                            {languages.sort().map((language, index) => <MenuItem value={language} key={index}>{language}</MenuItem>)}
                        </Select>
                        <div className={classes.btnContainer}>
                            <Button variant="contained" className={classes.btnSave} onClick={() => onSelected(this.state.language)}>Ok</Button>
                            <Button variant="outlined" className={classes.btnCancel} onClick={onCancel}>Cancel</Button>
                        </div>
                    </FormControl>
                </CardContent>
            </Card>
        );
    }
}

LanguagePicker.propTypes = propTypes;
LanguagePicker.defaultProps = defaultProps;

export default withStyles(styles)(LanguagePicker);