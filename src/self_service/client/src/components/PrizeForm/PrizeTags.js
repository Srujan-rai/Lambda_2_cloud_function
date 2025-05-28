import React, { Component } from "react";

import {
    Chip,
    IconButton,
    TextField,
    Typography,
    withStyles
} from "@material-ui/core";

import { Check } from "@material-ui/icons";

import commonStyles from "./styles";

const styles = {
    root: {
        marginLeft: "50px",
        marginTop: "10px"
    },
    chip: {
        marginRight: "10px"
    },
    iconButton: {
        marginLeft: "10px"
    }
};

const initialState = { tag: "" };

class PrizeTags extends Component {
    state = initialState;

    handleInputChange = event => {
        event.preventDefault();
        const tag = event.target.value;
        this.setState({ ...this.state, tag });
    };

    render() {
        const { classes, tags, onRemoval, disabled, onAddition } = this.props;

        return (
            <>
                <label className={classes.label}>
                    <Typography variant="body2" gutterBottom>
                        Tags
                    </Typography>
                </label>
                <TextField
                    value={this.state.tag}
                    className={classes.textField}
                    onChange={this.handleInputChange}
                    disabled = {disabled}
                    style={disabled ? {  opacity: 0.3 } : {}}
                    InputProps={{ disableUnderline: true }}
                />
                <IconButton
                    color="primary"
                    className={classes.iconButton}
                    disabled = {disabled}
                    style={disabled ? {  opacity: 0.3 } : {}}
                    onClick={() => {
                        this.setState(initialState);
                        onAddition(this.state.tag);
                    }}
                >
                    <Check fontSize="small" />
                </IconButton>
                <div className={classes.root}>
                    {!!tags && tags.map((tag, i) => (
                        <Chip
                            key={i}
                            label={tag}
                            className={classes.chip}
                            onDelete={() => onRemoval(tag)}
                        />
                    ))}
                </div>
            </>
        );
    }
}

const combinedStyles = {
    ...styles,
    label: commonStyles.label,
    textField: commonStyles.textField
};

export default withStyles(
    combinedStyles
)(PrizeTags);
