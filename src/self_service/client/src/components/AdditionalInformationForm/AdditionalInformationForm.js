import React, { Component, Fragment } from 'react';
import { withStyles, Paper, FormControlLabel, Checkbox, Typography } from '@material-ui/core';
import DatePicker from "react-datepicker";
import { HeaderChip, VInput, VSelect, VArea } from '../Commons';
import styles from './styles';
import FileUpload from '../FileUpload/FileUpload';
import { IMAGE_FILE } from '../../constants/files';
import { connect } from 'react-redux';
import { compose } from 'lodash/fp';
import { showNotification, hideNotification, clearAll } from '../../redux/ui/actions';

class AdditionalInformation extends Component {
    constructor(props) {
        super(props);

        const date = new Date();
        this.infoType = ['fanta', 'ice_breaker', 'push_the_button', 'web_view_instant_win', 'Xmas20'];
        const { additionalInformationData, isEdit } = this.props;
        const initialState = {
            startDate: date.getTime(),
            endDate: new Date(new Date().setMonth(date.getMonth() + 1)).getTime(),
            imgUrl: '',
            type: '',
            active: true,
            totalCurrencyAccumulated: false,
            visibleFromDate: date.getTime(),
            minAge: 0,
            description: '',
            cost: {},
            shortDescription: '',
            tags: '',
            wv_url: ''
        };
        if ((isEdit && additionalInformationData) && Object.keys(additionalInformationData).length !== 0) {
            this.state = {
                ...additionalInformationData,
                formState: {
                    ...initialState,
                    ...additionalInformationData
                }
            }
        } else {
            this.state = {
                formState: {
                    ...initialState
                }
            };
        }
        this.handleTagsValidate = this.handleTagsValidate.bind(this);
        this.handleTagsChange = this.handleTagsChange.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.handleBoolChange = this.handleBoolChange.bind(this);
        this.handleNumChange = this.handleNumChange.bind(this);
        this.handleDateTimeChange = this.handleDateTimeChange.bind(this);
        this.handleCostChange = this.handleCostChange.bind(this);
        this.handleFileChange = this.handleFileChange.bind(this);
        this.handleTotalCurrencyAccumulated = this.handleTotalCurrencyAccumulated.bind(this);
    }

    componentDidMount() {
        const costArray = this.state.cost;
        if (costArray && costArray.length) {
            const costObject = costArray.reduce((currency, { currencyId, amount }) => (currency[currencyId] = amount, currency), {})
            this.setState(state => ({
                ...state,
                cost: costObject,
                formState: {
                    ...state.formState,
                    cost: costObject
                }
            }))
        }
        this.setState(state => ({
            ...state,
            active: true
        }));
        this.props.onAdditionalInfoParamChange({ ...this.state });
    }

    componentDidUpdate(prevProps, prevState) {
        for (const [key, val] of Object.entries(this.state)) {
            if (prevState[key] !== val) {
                const state = { ...this.state };
                if (state.cost) {
                    const costKeys = Object.keys(state.cost);

                    state.cost = costKeys.map((currency) => ({
                        currencyId: currency,
                        amount: state.cost[currency],
                    }));
                }
                delete state["formState"];
                this.props.onAdditionalInfoParamChange(state);
                break;
            }
        }
    }

    componentWillUnmount() {
        this.props.onAdditionalInfoParamChange({});
    }

    handleChange(event) {
        this.setState(state => ({
            [event.name]: event.value,
            formState: {
                ...state.formState,
                [event.name]: event.value
            }
        }));
    }

    clearForm() {
        const { hideNotifyD } = this.props;
        hideNotifyD();
    }

    handleTagsChange(event) {
        const tags = this.handleTagsValidate(event);
         this.setState(state => ({
            [event.name]: tags,
            formState: {
                ...state.formState,
                [event.name]: tags
            }
        }));
    }

    handleTagsValidate(event) {
        const { includesBurnPincodes, includesCurrencyReducer, notify } = this.props;
        const tags = event.value.split(',').filter((tag) => `${tag},`);

        let errorObject = { type: "ERROR", title: "ERROR!", visible: true };
        let tagLimit = 10;
        if (includesBurnPincodes) { tagLimit--; }
        if (includesCurrencyReducer) { tagLimit--; }
        if (tags.length > tagLimit) {
            errorObject.message = `Enter no more than ${tagLimit} current tags count: ${tags.length}`;
            notify(errorObject);
            return tags;
        }
        const regexTags = /instantwinpe|instantwincost/i;
        const regexAlphanumeric = /[A-Z0-9\,\s]+$/ig;
        if (regexTags.test(tags)) {
            errorObject.message = `Exclude tag ${tags.toString().match(/instantwinpe|instantwincost/i)}`;
            notify(errorObject);
            return tags;
        }
        if (!regexAlphanumeric.test(tags)) {
            errorObject.message = "Only comma separated alphanumeric characters allowed in Tags";
            notify(errorObject);
            return tags;
        }
        const tagsCharLength = /[a-zA-Z0-9]/g.length;
        let charLimit = 250;
        if (tagsCharLength > charLimit) {
            errorObject.message = `Tags should not exceed ${charLimit} characters, current character count is ${tagsCharLength}`;
            notify(errorObject);
            return tags;
        }
        return tags;
    }

    handleBoolChange(event) {
        event.persist();
        let checked = event.target.checked;
        let name = event.target.name;
        this.setState(state => ({
            [name]: checked,
            formState: {
                ...state.formState,
                [name]: checked
            }
        }));
    }

    handleNumChange(event) {
        this.setState(state => ({
            [event.name]: Number(event.value),
            formState: {
                ...state.formState,
                [event.name]: Number(event.value)
            }
        }));
    }

    handleDateTimeChange(val, name) {
        this.setState(state => ({
            [name]: val.getTime(),
            formState: {
                ...state.formState,
                [name]: val.getTime()
            }
        }));
    }

    handleCostChange(event) {
        this.setState(state => ({
            ...state,
            cost: {
                ...state.cost,
                [event.name]: +[event.value]
            },
            formState: {
                ...state.formState,
                cost: {
                    ...state.formState.cost,
                    [event.name]: +[event.value]
                }
            }
        }));
    }

    handleFileChange(event) {
        let value = event.target.value;
        this.setState(state => ({
            imgUrl: value,
            formState: {
                ...state.formState,
                imgUrl: value
            }
        }));
    }

    handleTotalCurrencyAccumulated(event) {
        event.persist();
        let name = event.target.name;
        let checked = event.target.checked;
        this.setState(state => ({
            [name]: checked,
            formState: {
                ...state.formState,
                [name]: checked
            }
        }))
    }

    render() {
        const { classes, selectedCurrencies, isEdit, getFileName } = this.props;
        const { startDate, endDate, type, active, visibleFromDate, minAge, description, name, shortDescription, tags, cost, wv_url, totalCurrencyAccumulated, imgUrl } = this.state.formState;
        const startDateInPast = startDate < new Date().setHours(0, 0, 0);
        const editingDateDisabled = (startDateInPast && isEdit);

        return (
            <Fragment>
                <Paper className={classes.paper}>
                    <HeaderChip
                        label='Additional Information'
                        avatar='AI'
                        classes={{ headerChip: classes.headerChip }} />
                    <div className={classes.checkboxCtnr}>
                        <div className={classes.rowContainer}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={active}
                                        onChange={this.handleBoolChange}
                                        name="active"
                                    />
                                }
                                label="Active"
                            />
                        </div>
                    </div>

                    <div className={classes.checkboxCtnr}>
                        <div className={classes.rowContainer}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={totalCurrencyAccumulated}
                                        onChange={this.handleTotalCurrencyAccumulated}
                                        name="totalCurrencyAccumulated"
                                    />
                                }
                                label="Total Currency Accumulated"
                            />
                        </div>
                    </div>
                    <div className={classes.container}>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Start date {editingDateDisabled ? '(editing disabled)' : ''}</Typography>
                            </label>
                            <DatePicker
                                selected={new Date(startDate)}
                                onChange={val => this.handleDateTimeChange(val, 'startDate')}
                                showTimeSelect
                                dateFormat="MM/dd/yyyy h:mm aa"
                                className={`${classes.textField} ${classes.dateField} ${classes.select}`}
                                calendarClassName={classes.calendarField}
                                disabled={editingDateDisabled}
                                placeholderText="This is disabled"
                                minDate={new Date()}
                            />
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>End date {editingDateDisabled ? '(editing disabled)' : ''}</Typography>
                            </label>
                            <DatePicker
                                selected={new Date(endDate)}
                                onChange={val => this.handleDateTimeChange(val, 'endDate')}
                                showTimeSelect
                                dateFormat="MM/dd/yyyy h:mm aa"
                                className={`${classes.textField} ${classes.dateField}`}
                                calendarClassName={classes.calendarField}
                                disabled={editingDateDisabled}
                                minDate={new Date(startDate)}
                            />
                        </div>
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Configuration Image</Typography>
                            </label>
                            <div style={{ position: "relative" }}>
                                <FileUpload type={IMAGE_FILE} name="imgUrl" onChange={this.handleFileChange} />
                                <div className={classes.hideUploadImageUrl}> {getFileName(imgUrl) || "No File Chosen"} </div>
                            </div>
                        </div>
                        <VSelect
                            fieldData={{
                                name: 'type',
                                label: 'Type',
                                value: type,
                                placeholder: 'fanta, ice_breaker, push_the_button, web_view_instant_win, Xmas20'
                            }}
                            handleOnChange={this.handleChange}
                            options={{ list: this.infoType }}
                            classes={{
                                rowContainer: classes.rowContainer,
                                select: classes.select,
                                label: classes.label
                            }}
                        />
                        <div className={classes.rowContainer}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Visible from date</Typography>
                            </label>
                            <DatePicker
                                selected={new Date(visibleFromDate)}
                                onChange={val => this.handleDateTimeChange(val, 'visibleFromDate')}
                                showTimeSelect
                                dateFormat="MM/dd/yyyy h:mm aa"
                                className={`${classes.textField} ${classes.dateField}`}
                                calendarClassName={classes.calendarField}
                            />
                        </div>
                        <VInput
                            fieldData={{
                                name: 'minAge',
                                value: minAge,
                                placeholder: '12',
                                label: 'Min Age'
                            }}
                            options={{ type: 'number' }}
                            handleOnChange={this.handleNumChange}
                            classes={{
                                rowContainer: classes.rowContainer,
                                textField: classes.textField,
                                label: classes.label
                            }}
                        />
                        <VInput
                            fieldData={{
                                name: 'tags',
                                value: tags,
                                label: 'Tags',
                                tooltip: 'Use comma to separate one tag from another'
                            }}
                            options={{ type: 'string' }}
                            handleOnChange={this.handleTagsChange}
                            classes={{
                                rowContainer: classes.rowContainer,
                                textField: classes.textField,
                                label: classes.label,
                                Tooltip: classes.Tooltip
                            }}


                        />
                        <VArea
                            fieldData={{
                                name: 'description',
                                value: description,
                                label: 'Description'
                            }}
                            handleOnChange={this.handleChange}
                            classes={{
                                rowContainer: classes.rowContainer,
                                textArea: classes.textArea,
                                label: classes.label
                            }}
                        />
                        <VArea
                            fieldData={{
                                name: 'shortDescription',
                                value: shortDescription,
                                label: 'Short description'
                            }}
                            handleOnChange={this.handleChange}
                            classes={{
                                rowContainer: classes.rowContainer,
                                textArea: classes.textArea,
                                label: classes.label
                            }}
                        />
                        <VInput
                            fieldData={{
                                name: 'wv_url',
                                value: wv_url,
                                placeholder: 'Web View URL',
                                label: 'Web View URL'
                            }}
                            handleOnChange={this.handleChange}
                            classes={{
                                rowContainer: classes.rowContainer,
                                textField: classes.textField,
                                label: classes.label
                            }}
                        />
                    </div>
                </Paper>
            </Fragment>
        );
    }
};


const mapDispatchToProps = dispatch => ({
    notify: ({ title, message, type, visible }) => {
        dispatch(showNotification({ title, message, type, visible }));
    },
    clearAllD: (formName) => {
        dispatch(clearAll(formName));
    },
    hideNotifyD: () => {
        dispatch(hideNotification());
    }
});
const enhance = compose(
    withStyles(styles),
    connect(null, mapDispatchToProps)
);

export default enhance(AdditionalInformation);
