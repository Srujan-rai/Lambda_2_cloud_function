import React from 'react';
import { Typography, withStyles } from '@material-ui/core';
import { TextValidator } from 'react-material-ui-form-validator';
import DatePicker from 'react-datepicker';

import { prepareDateTimePickerParams } from '../../helpers/utils';
import { WINNING_MOMENTS_FORM } from '../../constants/forms';

const styles = {
    flexContainer: { display: 'flex' },
    rightContainer: { marginLeft: 25 },
    bottomDiv: { marginTop: 10, marginBottom: 15 },
    textField: { backgroundColor: 'white', borderRadius: 5, padding: 5, boxShadow: '0px 0px 0px 2px #f40000', height: 35, width: 200 },
    dateField: { fontSize: 14, border: 'none', '&:focus': { outline: 'none' } }
};

const START_DATE = 'startDate', END_DATE = 'endDate';

const GeneratorForm = ({ classes, formState, onNumberChange, onDateTimeChange }) => {
    return (
        <div className={classes.flexContainer}>
            <div>
                <div>
                    <Typography variant="body2" gutterBottom>
                        Start Date
                    </Typography>
                    <DatePicker
                        selected={new Date(formState.startDate)}
                        onChange={value =>
                            onDateTimeChange(
                                prepareDateTimePickerParams(START_DATE, value),
                                WINNING_MOMENTS_FORM
                            )
                        }
                        showTimeSelect
                        dateFormat="MM/dd/yyyy h:mm aa"
                        className={`${classes.textField} ${classes.dateField}`}
                        calendarClassName={classes.calendarField}
                        minDate={new Date()}
                    />
                </div>
                <div className={classes.bottomDiv}>
                    <Typography variant="body2" gutterBottom>
                        Prize Distribution Defect
                    </Typography>
                    <TextValidator
                        name="prizeDistributionDefect"
                        value={formState.prizeDistributionDefect}
                        onChange={onNumberChange}
                        className={classes.textField}
                        required
                        type="number"
                        validators={['required', 'isNumber', 'minNumber:0', 'maxNumber:100']}
                        errorMessages={[
                            'This field is required',
                            'Must be a number',
                            'Must be between 0 and 100',
                            'Must be between 0 and 100'
                        ]}
                        InputProps={{ disableUnderline: true }}
                    />
                </div>
            </div>
            <div className={classes.rightContainer}>
                <div>
                    <Typography variant="body2" gutterBottom>
                        End Date
                    </Typography>
                    <DatePicker
                        selected={new Date(formState.endDate)}
                        onChange={value =>
                            onDateTimeChange(
                                prepareDateTimePickerParams(END_DATE, value),
                                WINNING_MOMENTS_FORM
                            )
                        }
                        showTimeSelect
                        dateFormat="MM/dd/yyyy h:mm aa"
                        className={`${classes.textField} ${classes.dateField}`}
                        minDate={formState.startDate}
                    />
                </div>
                <div className={classes.bottomDiv}>
                    <Typography variant="body2" gutterBottom>
                        Timestamp Distribution Defect
                    </Typography>
                    <TextValidator
                        name="timestampDistributionDefect"
                        value={formState.timestampDistributionDefect}
                        onChange={onNumberChange}
                        className={classes.textField}
                        required
                        type="number"
                        validators={['required', 'isNumber', 'minNumber:0', 'maxNumber:100']}
                        errorMessages={[
                            'This field is required',
                            'Must be a number',
                            'Must be between 0 and 100',
                            'Must be between 0 and 100'
                        ]}
                        InputProps={{ disableUnderline: true }}
                    />
                </div>
                <div className={classes.bottomDiv}>
                    <Typography variant="body2" gutterBottom>
                        Winning Moment Expiration
                    </Typography>
                    <TextValidator
                        name="winningMomentExpiration"
                        value={formState.winningMomentExpiration}
                        onChange={onNumberChange}
                        className={classes.textField}
                        required
                        type="number"
                        validators={['required', 'isNumber', 'minNumber:0', 'maxNumber:100']}
                        errorMessages={[
                            'This field is required',
                            'Must be a number',
                            'Must be between 0 and 100',
                            'Must be between 0 and 100'
                        ]}
                        InputProps={{ disableUnderline: true }}
                    />
                </div>
            </div>
        </div>
    );
};

export default withStyles(styles)(GeneratorForm);
