import React, { Fragment, Component } from 'react';
import { withStyles } from '@material-ui/core/styles';
import { Avatar, Button, Chip, Fab, Paper, Tooltip, Checkbox, FormControlLabel } from '@material-ui/core';
import { Clear as ClearIcon } from '@material-ui/icons';
import InfoIcon from '@material-ui/icons/Info';
import PropTypes from 'prop-types';
import Typography from '@material-ui/core/Typography';
import { ValidatorForm, TextValidator } from 'react-material-ui-form-validator';

const propTypes = {
    store: PropTypes.shape({
        currencyId: PropTypes.string.isRequired,
        configurationId: PropTypes.string.isRequired,
        amount: PropTypes.number.isRequired,
        programId: PropTypes.string.isRequired,
        lotId: PropTypes.string.isRequired,
        jiraTicketId: PropTypes.string.isRequired,
        userKoId: PropTypes.string.isRequired,
        ruleActive: PropTypes.bool.isRequired,
        deletionTimestamp: PropTypes.number.isRequired
    }).isRequired,
    onNumberChange: PropTypes.func.isRequired,
    onTextInputChange: PropTypes.func.isRequired,
    classes: PropTypes.object.isRequired,
    onSave: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired
};

const defaultProps = {};

const styles = (theme) => ({
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
        marginLeft: "95px",
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
        marginLeft: "95px",
        display: "flex",
        justify: "flex-start",
        alignItems: "flex-start"
    },
    fieldNote: {
        marginLeft: "95px",
        display: "flex",
        flexDirection: "column",
        justify: "flex-start",
        alignItems: "flex-start",
        opacity: 0.5
    },
    chip: {
        margin: "10px 0 30px 95px",
        fontSize: 16
    },
    rowContainer: {
        marginLeft: "65px",
        marginTop: "10px",
        display: "inline"
    },
    button: {
        marginLeft: "160px",
        marginBottom: "50px",
        marginTop: "30px",
        color: "white",
        width: "100px",
        backgroundColor: "#f40000",
        borderRadius: "5px solid white"
    },
    buttonRemoveFormPanel: {
        margin: "20px 20px 0 0",
        float: 'right',
        width: 35,
        height: 35
    },
    disabled: {
        color: 'rgba(0, 0, 0, 0.38)',
        cursor: 'default'
    },
    checkBox: {
        marginLeft: "93px",
        display: "inline"
    },
    tooltipIcon: {
        marginLeft: "0.175rem"
    },
    tooltipText: {
        fontSize: "0.725rem"
    }
});

const configurationIdForAdding = "configurationIdForAdding";
const configurationId = "configurationId";
const currencyId = "currencyId";
const amount = "amount";
const programId = "programId";
const lotId = "lotId";
const validity = "validity";
const userKoId = "userKoId";
const jiraTicketId = "jiraTicketId";



class CurrencyAllocationRulesForm extends Component {
    state = {
        deleteAllocationRule: false
    };

    handleCheckboxChange = event => {
        const name = event.target.name;
        const isChecked = event.target.checked;
        this.setState({
            [name]: isChecked,
        });
}

    render() {
        const { classes, store, onTextInputChange, onNumberChange, onSave, onClose, formTitle, disabled} = this.props;
        return (
            <Fragment>
                <Paper>
                    <Tooltip title="Close" placement="top">
                        <Fab size="small"
                            color="primary"
                            aria-label="Remove Panel"
                            className={classes.buttonRemoveFormPanel}
                            onClick={onClose}
                        >
                            {<ClearIcon />}
                        </Fab>
                    </Tooltip>
                    <ValidatorForm className={classes.container} autoComplete="off" onSubmit={event => onSave(event)}>
                        <div className={classes.rowContainer}>
                            <Chip
                                avatar={<Avatar>CR</Avatar>}
                                label={formTitle || "Add New Currency Allocation Rule"}
                                color="primary"
                                className={classes.chip}
                            />
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Configuration Id</Typography>
                            </label>
                            <TextValidator
                                id={configurationIdForAdding}
                                name={configurationId}
                                value={store.configurationId}
                                onChange={(event) => onTextInputChange(event)}
                                className={classes.textField}
                                margin="normal"
                                required
                                disabled={disabled.configurationId}
                                validators={['required']}
                                errorMessages={['This field is required']}
                                InputProps={{
                                    disableUnderline: true
                                }}
                            />
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Program Id</Typography>
                            </label>
                            <TextValidator
                                id={programId}
                                name={programId}
                                value={store.programId}
                                onChange={(event) => onTextInputChange(event)}
                                className={classes.textField}
                                margin="normal"
                                required
                                disabled={disabled.programId}
                                validators={['required']}
                                errorMessages={['This field is required']}
                                InputProps={{
                                    disableUnderline: true
                                }}
                            />
                            <label className={classes.fieldNote}>
                                <Typography variant="caption" gutterBottom><i><strong>Please enter * to apply rule to all</strong></i></Typography>
                            </label>
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Lot ID / Campaign ID</Typography>
                                <Tooltip placement="right" title={
                                    <span className={classes.tooltipText}>
                                        A separate rule must be created for each Lot or Campaign
                                        if you need to allocate different currency amounts depending on certain Lots or Campaigns within the same Program.
                                        Enter * if the rule needs to be applied to all Lots and Campaigns under the Program specified above.
                                    </span>
                                }>
                                    <InfoIcon className={classes.tooltipIcon} fontSize="small" />
                                </Tooltip>
                            </label>
                            <TextValidator
                                id={lotId}
                                name={lotId}
                                value={store.lotId}
                                onChange={(event) => onTextInputChange(event)}
                                className={classes.textField}
                                margin="normal"
                                required
                                disabled={disabled.lotId}
                                validators={['required']}
                                errorMessages={['This field is required']}
                                InputProps={{
                                    disableUnderline: true
                                }}
                            />
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Currency Id</Typography>
                            </label>
                            <TextValidator
                                id={currencyId}
                                name={currencyId}
                                value={store.currencyId}
                                onChange={(event) => onTextInputChange(event)}
                                className={classes.textField}
                                margin="normal"
                                disabled={disabled.currencyId}
                                required
                                validators={['required']}
                                errorMessages={['This field is required']}
                                InputProps={{
                                    disableUnderline: true
                                }}
                            />
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Amount</Typography>
                            </label>
                            <TextValidator
                                id={amount}
                                name={amount}
                                value={store.amount}
                                onChange={(event) => onNumberChange(Number(event.target.value), event.target.name)}
                                className={classes.textField}
                                margin="normal"
                                required
                                type="number"
                                validators={['required', 'isNumber', 'minNumber:1']}
                                errorMessages={['This field is required', 'Type must be number!', 'Number must be positive']}
                                InputProps={{
                                    disableUnderline:
                                        true
                                }}
                            />
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Validity</Typography>
                            </label>
                            <TextValidator
                                id={validity}
                                name={validity}
                                value={store.validity}
                                onChange={(event) => onNumberChange(event.target.value, event.target.name)}
                                className={classes.textField}
                                margin="normal"
                                type="number"
                                validators={['isNumber', 'minNumber:1']}
                                errorMessages={['Type must be number!', 'Number must be positive']}
                                InputProps={{
                                    disableUnderline:
                                        true
                                }}
                            />
                            {formTitle  &&
                            <FormControlLabel
                            control={
                                <Checkbox className={classes.checkBox}
                                    onChange={this.handleCheckboxChange}
                                    name="deleteAllocationRule"
                                />
                            }
                            label="Delete Rule"

                        />
                            }
                            {this.state.deleteAllocationRule &&
                                <div className={classes.rowContainer}>
                                    <label className={classes.label}>
                                        <Typography variant="body2" gutterBottom>User KOID</Typography>
                                    </label>
                                    <TextValidator
                                        id={userKoId}
                                        name={userKoId}
                                        className={classes.textField}
                                        margin="normal"
                                        InputProps={{
                                            disableUnderline: true
                                        }}
                                        onChange={(event) => onNumberChange(event.target.value, event.target.name)}
                                        value={store.userKoId}
                                    />
                                </div>
                            }
                            {this.state.deleteAllocationRule &&
                                <div className={classes.rowContainer}>
                                    <label className={classes.label}>
                                        <Typography variant="body2" gutterBottom>Jira Ticket ID</Typography>
                                    </label>
                                    <TextValidator
                                        id={jiraTicketId}
                                        name={jiraTicketId}
                                        className={classes.textField}
                                        margin="normal"
                                        InputProps={{
                                            disableUnderline: true
                                        }}
                                        onChange={(event) => onNumberChange(event.target.value, event.target.name)}
                                        value={store.jiraTicketId}
                                    />
                                </div>
                            }

                        </div>

                        <div className={classes.rowContainer}>
                            <Button type="submit" variant="contained" className={classes.button}>{(this.state.deleteAllocationRule ? "Delete Rule" : "Save")}</Button>
                        </div>
                    </ValidatorForm>
                </Paper>
            </Fragment>
        );
    };
}

CurrencyAllocationRulesForm.propTypes = propTypes;
CurrencyAllocationRulesForm.defaultProps = defaultProps;

export default withStyles(styles)(CurrencyAllocationRulesForm);
