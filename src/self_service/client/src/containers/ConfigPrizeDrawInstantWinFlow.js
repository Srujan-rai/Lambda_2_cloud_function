import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import { compose, flow } from 'lodash/fp';
import { Avatar, Button, Checkbox, Chip, FormControlLabel, MenuItem, Paper, Select, Typography, Tooltip } from '@material-ui/core';
import { instantWinAlgorithms } from '../constants/lists';
import { addFlowLabel } from '../redux/ui/actions';
import { TextValidator, ValidatorForm } from "react-material-ui-form-validator";
import ConfigurationFlowAutomaticChecks from '../components/ConfigurationFlowAutomaticChecks';
import ConfigurationFlowSecrets from '../components/ConfigurationFlowSecrets';
import MultipleFieldPairsComponent from '../components/MultipleFieldPairsComponent/MultipleFieldPairsComponent';
import styles from "../components/ConfigurationForm/stylesInstantWinFlow";
import { CONFIGURATION_FORM } from '../constants/forms';
import DatePicker from 'react-datepicker';
import moment from 'moment-timezone';
import InfoIcon from '@material-ui/icons/Info';

const propTypes = {
    /** Flow label key from flowLabelMap defined in lists.js file. It is used in order to render options of specific flow - functionality */
    flowLabelKey: PropTypes.string.isRequired,
    /** Callback function that hides configuration flow dialog */
    hideFlowDialog: PropTypes.func.isRequired,
    /** @ignore */
};

const CURRENCY_REDUCER = "currencyReducer";
const PARTICIPATION_LIMIT = "participationLimit";
const PARTICIPATION_LIMIT_USE_CALENDAR_DATES = "participationLimitUseCalendarDates";
const PARTICIPATION_LIMIT_USE_CONFIG_DATES = "participationLimitUseConfigDates";
const WINNING_LIMITS_PER_TIER_FLAG = "winningLimitsPerTierFlag";
const WINNING_LIMITS_PER_TIER = "winningLimitsPerTier";
const WINNING_LIMITS_PER_TIER_ARRAY = "winningLimitsPerTierArray";
const WINNING_LIMITS_PER_PRIZE = "winningLimitsPerPrize";
const WINNING_LIMITS_PER_PRIZE_FLAG = "winningLimitsPerPrizeFlag";
const WINNING_LIMITS_PER_PRIZE_ARRAY = "winningLimitPerPrizeArray";
const INSTANT_WIN_LIMIT_PER_CONFIGURATION = "instantWinLimitPerConfiguration";
const INSTANT_WIN_LIMIT_PER_TIME_INTERVAL = "instantWinLimitPerTimeInterval";
const INSTANT_WIN_PRIZE_LIMITS = "instantWinPrizeLimits";
const VIRAL_CODES_PRIZE_MAP_FLAG = "viralCodesPrizeMapFlag";
const VIRAL_CODES_MAPPING_ARRAY = "viralCodesMappingArray";
const VIRAL_CODES_MAPPING = "winningPrizesPerViralCode";
const ALWAYS_WIN = "alwaysWin";
const REDUCE_AMOUNT = "reduceAmount";
const INTEGER_FIELDS = ["delaySeconds", "participationLimit", "participationLimitTime", 'minAge', 'instantWinLimitPerTimeInterval', 'instantWinLimitPerTimeIntervalValue', 'instantWinLimitPerConfiguration'];
const PINCODE_ORIGIN_VALIDITY = "pincodeOriginValidityCheckerLambda";
const BURN_PINCODES = "burnPincodes";
const IMAGE_ENTRY = "imageEntry"
const INSTANT_WIN_COST_ENTRY = "instantWinCostEntry"
const INSTANT_WIN_COST_ENTRY_CONFIGURATION = "instantWinCostEntryConfiguration";
const maxLotIds = 20;
const userTimeZone = moment.tz.guess();
const availableTimeZones = moment.tz.names();
const defaultTimeZone = availableTimeZones.includes(userTimeZone) ? userTimeZone : 'Europe/London';
const participationLimitStartInitValue = parseInt(moment().startOf('day').format('x'));
const participationLimitEndInitValue = parseInt(moment().endOf('month').format('x'));
const minDateDatePicker = parseInt(moment().day(moment().days() - 1).format('x'));
class ConfigurationFlowContainer extends Component {

    state = {
        temporaryProperties: {
            message: '',
            flags: {
                winningLimitsPerTierFlag: false,
                viralCodesPrizeMapFlag: false,
                winningLimitsPerPrizeFlag: false,
                alwaysWin: false
            },
            winningLimitPerPrizeArray: [],
            winningLimitsPerTierArray: [],
            viralCodesMappingArray: [],
            captchaSecretDirty: false,
            minAgeDirty: false,
            start: participationLimitStartInitValue,
            end: participationLimitEndInitValue,
            useConfigStartEndDates: false,
            displayParticipationLimit: false,
            displayBurnPincodes: false,
            displayImageEntry: false,
            displayCurrncyReduce: false,
            displayInstantWinLimitPerConfiguration: false,
            displayAlwaysWin: false,
            displayWinningLimitsPerPrizeFlag: false,
            displayInstantWinLimitPerTimeInterval: false,
            displayWinningLimitsPerTierflag: false,
            displayInstatWinCostEntry: false,
            displayViralCodesPrizeMap: false,
            displayLotIdPrizeMap: false,
            displayAlgorithm: false,
            displayUseVoucherStatusReserved: false,
            displayDelayEmail: false,
            displayParameters: false,
            displayParams: false
        },
        params: {
            algorithm: '',
            useStatusReserved: false,
            delaySeconds: '',
            participationLimit: '',
            participationLimitTime: '',
            participationLimitUseCalendarDates: false,
            participationLimitCalendarDatesRange: {
                startDate: participationLimitStartInitValue,
                endDate: participationLimitEndInitValue
            },
            participationLimitTimeZone: defaultTimeZone,
            instantWinLimitPerTimeInterval: '',
            instantWinLimitPerTimeIntervalValue: '',
            instantWinLimitPerConfiguration: '',
            winningLimitsPerTier: {},
            winningLimitsPerPrize: {},
            instantWinCostEntryConfiguration: ''
        },
        secrets: {},
        checkerLambdas: [],
        instantWinLimitCheckers: [],
        flowLambdas: []
    };

    componentDidMount = () => {
        ValidatorForm.addValidationRule('isDivisibleByTwentyFour', (value) => {
            return value % 24 === 0 ? true : false;
        });

        const { flowLabelKey } = this.props;
        if(flowLabelKey == "promoEntry") {
            this.setState(state => ({
                flowLambdas: [...state.flowLambdas, "promoEntryLambda"],
                temporaryProperties: {
                    ...state.temporaryProperties,
                displayParticipationLimit: true,
                displayBurnPincodes: true,
                displayImageEntry: true,
                displayCurrncyReduce: true,
                displayInstantWinLimitPerConfiguration: false,
                displayAlwaysWin: false,
                displayWinningLimitsPerPrizeFlag: false,
                displayInstantWinLimitPerTimeInterval: false,
                displayWinningLimitsPerTierflag: false,
                displayInstatWinCostEntry: false,
                displayViralCodesPrizeMap: false,
                displayAlgorithm: false,
                displayUseVoucherStatusReserved: false,
                displayDelayEmail: false,
                displayParameters: false,
                displayParams: true
                }}));
    }

        if (flowLabelKey == "instantWin") {
            this.setState(state => ({
                flowLambdas: [...state.flowLambdas, flowLabelKey],
                temporaryProperties: {
                    ...state.temporaryProperties,
                displayParticipationLimit: true,
                displayBurnPincodes: true,
                displayCurrncyReduce: true,
                displayInstantWinLimitPerConfiguration: true,
                displayAlwaysWin: true,
                displayWinningLimitsPerPrizeFlag: true,
                displayInstantWinLimitPerTimeInterval: true,
                displayWinningLimitsPerTierflag: true,
                displayInstatWinCostEntry: true,
                displayViralCodesPrizeMap: true,
                displayAlgorithm: true,
                displayUseVoucherStatusReserved: true,
                displayDelayEmail: true,
                displayParameters: true,
                displayParams: false
            }}));
        }

        const { flow } = this.props;
        if (flow && Object.keys(flow).includes('params')) {
            this.setState((state) => {
                const newState = {
                    ...state,
                    ...flow
                };

                if (flow.params.participationLimitCalendarDatesRange &&
                    flow.params.participationLimitCalendarDatesRange.startDate
                ) {
                    newState.temporaryProperties = {
                        ...state.temporaryProperties,
                        start: parseInt(moment(moment.tz(flow.params.participationLimitCalendarDatesRange.startDate, flow.params.participationLimitTimeZone).format('YYYY-MM-DD')).format('x')),
                        end: parseInt(moment(moment.tz(flow.params.participationLimitCalendarDatesRange.endDate, flow.params.participationLimitTimeZone).format('YYYY-MM-DDTHH:mm:ss.SSS')).format('x'))
                    };
                } else if (flow.params.participationLimitUseCalendarDates) {
                    newState.temporaryProperties = {
                        ...state.temporaryProperties,
                        useConfigStartEndDates: true
                    };
                }

                if (flow.params.winningLimitsPerTier) {
                    newState.temporaryProperties = {
                        ...newState.temporaryProperties,
                        flags: {
                            ...newState.temporaryProperties.flags,
                            winningLimitsPerTierFlag: true
                        }
                    };
                    Object.entries(newState.params.winningLimitsPerTier).forEach(([key, value]) => {
                        newState.temporaryProperties.winningLimitsPerTierArray.push({ tier: key, tierLimit: value });
                    })
                }

                if (flow.params.winningPrizesPerViralCode) {
                    newState.temporaryProperties = {
                        ...newState.temporaryProperties,
                        flags: {
                            ...newState.temporaryProperties.flags,
                            viralCodesPrizeMapFlag: true
                        }
                    };
                    Object.entries(newState.params.winningPrizesPerViralCode).forEach(([key, value]) => {
                        newState.temporaryProperties.viralCodesMappingArray.push({ viralCode: key, prizeIds: value.join() });
                    })
                }

                if (flow.params.winningLimitsPerPrize) {
                    newState.temporaryProperties = {
                        ...newState.temporaryProperties,
                        flags: {
                            ...newState.temporaryProperties.flags,
                            winningLimitsPerPrizeFlag: true
                        }
                    };
                    Object.entries(newState.params.winningLimitsPerPrize).forEach(([key, value]) => {
                        newState.temporaryProperties.winningLimitPerPrizeArray.push({ prizeId: key, prizeLimit: value });
                    })
                }


                return newState;
            });
        }
    };

    handleChange = event => {
        const name = event.target.name;
        const isChecked = event.target.checked;

        if (!isChecked) {
            switch (name) {
                case CURRENCY_REDUCER:
                    this.handleRemoveFromFlowLambdas(CURRENCY_REDUCER);
                    this.handleParamRemove(REDUCE_AMOUNT);
                    break;
                case BURN_PINCODES:
                    this.handleRemoveFromFlowLambdas(BURN_PINCODES);
                    break;
                case IMAGE_ENTRY:
                    this.handleParamChange(IMAGE_ENTRY, false);
                    break;
                case PARTICIPATION_LIMIT:
                    this.handleRemoveFromCheckerLambdas(PARTICIPATION_LIMIT);
                    break;
                case INSTANT_WIN_LIMIT_PER_CONFIGURATION:
                    this.handleRemoveFromInstantWinLimitCheckers(INSTANT_WIN_LIMIT_PER_CONFIGURATION);
                    break;
                case INSTANT_WIN_LIMIT_PER_TIME_INTERVAL:
                    this.handleRemoveFromInstantWinLimitCheckers(INSTANT_WIN_LIMIT_PER_TIME_INTERVAL);
                    break;
                case PINCODE_ORIGIN_VALIDITY:
                    this.handleRemoveFromCheckerLambdas(PINCODE_ORIGIN_VALIDITY);
                    break;
                case INSTANT_WIN_COST_ENTRY:
                    this.handleRemoveFromFlowLambdas(INSTANT_WIN_COST_ENTRY);
                    this.handleParamRemove(INSTANT_WIN_COST_ENTRY_CONFIGURATION)
                    break;
            }
        } else {
            switch (name) {
                case CURRENCY_REDUCER:
                    this.handleAddToFlowLambdas(CURRENCY_REDUCER);
                    break;
                case BURN_PINCODES:
                    this.handleAddToFlowLambdas(BURN_PINCODES);
                    break;
                case IMAGE_ENTRY:
                    this.handleParamChange(IMAGE_ENTRY, true);
                    break;
                case PARTICIPATION_LIMIT:
                    this.handleAddToCheckerLambdas(PARTICIPATION_LIMIT);
                    break;
                case INSTANT_WIN_LIMIT_PER_CONFIGURATION:
                    this.handleAddToInstantWinLimitCheckers(INSTANT_WIN_LIMIT_PER_CONFIGURATION);
                    break;
                case INSTANT_WIN_LIMIT_PER_TIME_INTERVAL:
                    this.handleAddToInstantWinLimitCheckers(INSTANT_WIN_LIMIT_PER_TIME_INTERVAL);
                    break;
                case PINCODE_ORIGIN_VALIDITY:
                    this.handleAddToCheckerLambdas(PINCODE_ORIGIN_VALIDITY);
                    break;
                case INSTANT_WIN_COST_ENTRY:
                    this.handleAddToFlowLambdas(INSTANT_WIN_COST_ENTRY);
                    break;
            }
        }
    };

    handleAddToCheckerLambdas = checkerLambdaName => {
        this.setState((state) => {
            return {
                checkerLambdas: [...state.checkerLambdas, checkerLambdaName]
            }
        });
    };

    handleAddToFlowLambdas = flowLambdaName => {
        const flowLambdas = (flowLambdaName === CURRENCY_REDUCER || flowLambdaName === BURN_PINCODES) ? [flowLambdaName, ...this.state.flowLambdas] : [...this.state.flowLambdas, flowLambdaName];
        (flowLambdaName === CURRENCY_REDUCER) ? (this.setState((state) => { return { flowLambdas, params: { ...state.params, reduceAmount: [{ currencyId: '', amount: '' }] } } })) : (this.setState(() => { return { flowLambdas } }))
    };

    handleRemoveFromCheckerLambdas = checkerLambdaName => {
        const checkerLambdasArray = [...this.state.checkerLambdas];
        const newCheckerLambdasArray = checkerLambdasArray.filter(checkerLambda => checkerLambda !== checkerLambdaName);
        this.setState({
            checkerLambdas: newCheckerLambdasArray,
            params: {
                ...this.state.params,
                participationLimit: '',
                participationLimitTime: '',
                participationLimitUseCalendarDates: false,
                lotIds: ['']
            }
        });
    };

    handleRemoveFromFlowLambdas = flowLambdaName => {
        const flowLambdasArray = [...this.state.flowLambdas];
        const newFlowLambdasArray = flowLambdasArray.filter(flowLambda => flowLambda !== flowLambdaName);

        this.setState((state) => {
            return {
                flowLambdas: newFlowLambdasArray,
                params: {
                    ...state.params,
                    reduceAmount: []
                }
            }
        });
    };

    handleParamRemove = name => {
        const params = { ...this.state.params };
        if (params.hasOwnProperty([name])) {
            delete params[name];
            this.setState({ params });
        }
    };

    handleParamChange = (field, value) => {
        if (INTEGER_FIELDS.includes(field)) {
            value = Number(value)
        }

        const state = {
            params: {
                ...this.state.params,
                [field]: value
            }
        };

        if (field === 'minAge') {
            state.temporaryProperties = { ...this.state.temporaryProperties };
            state.temporaryProperties.minAgeDirty = true;
        }

        this.setState(state);
    };

    handleChangeFlag = (flagName, value) => {
        this.setState({
            temporaryProperties: {
                ...this.state.temporaryProperties,
                flags: {
                    ...this.state.temporaryProperties.flags,
                    [flagName]: value
                }
            }
        });
    };

    handleChangeTemporaryArray = (nameOfArray, value) => {
        this.setState((state) => {
            return {
                temporaryProperties: {
                    ...state.temporaryProperties,
                    [nameOfArray]: value
                }
            }
        });
    };

    handleFlagsChange = event => {
        const field = event.target.name;
        let value = event.target.value;

        this.handleChangeFlag(field, value);

        if (!value && field === WINNING_LIMITS_PER_TIER_FLAG) {
            this.handleChangeTemporaryArray(WINNING_LIMITS_PER_TIER_ARRAY, []);
            this.handleParamRemove(WINNING_LIMITS_PER_TIER);
        } else if (value && field === WINNING_LIMITS_PER_TIER_FLAG) {
            this.handleChangeTemporaryArray(WINNING_LIMITS_PER_TIER_ARRAY, [{ tier: "", tierLimit: "" }]);
        } else if (!value && field === WINNING_LIMITS_PER_PRIZE_FLAG) {
            this.handleChangeTemporaryArray(WINNING_LIMITS_PER_PRIZE_ARRAY, []);
            this.handleParamRemove(WINNING_LIMITS_PER_PRIZE);
        } else if (value && field === WINNING_LIMITS_PER_PRIZE_FLAG) {
            this.handleChangeTemporaryArray(WINNING_LIMITS_PER_PRIZE_ARRAY, [{ prizeId: '', prizeLimit: '' }]);
        } else if (value && field === VIRAL_CODES_PRIZE_MAP_FLAG) {
            this.handleChangeTemporaryArray(VIRAL_CODES_MAPPING_ARRAY, [{ viralCode: '', prizeIds: '' }]);
        } else if (!value && field === VIRAL_CODES_PRIZE_MAP_FLAG) {
            this.handleChangeTemporaryArray(VIRAL_CODES_MAPPING_ARRAY, []);
            this.handleParamRemove(VIRAL_CODES_MAPPING);
        }else if (value && field === ALWAYS_WIN) {
            this.handleParamChange(ALWAYS_WIN, true)
        } else if (!value && field === ALWAYS_WIN) {
            this.handleParamRemove(ALWAYS_WIN)
        } else {
            this.handleChangeFlag(field, value)
        }
    };

    validity = () => {
        const { flowLabelKey } = this.props;
        if (flowLabelKey === "instantWin" && this.state.params.algorithm === '') {
            this.setState({
                temporaryProperties: {
                    ...this.state.temporaryProperties,
                    message: "This field is required"
                }
            });
            return false
        }
        if ((this.state.flowLambdas).includes('burnPincodes')) {
            if (!this.state.secrets.mixCodesParameters) {
                this.setState({
                    temporaryProperties: {
                        ...this.state.temporaryProperties,
                        message: "The mixcodes parameter fields above must all be completed when including functionality to burn pincodes"
                    }
                });
                return false
            }
            for (let i = 0; i < this.state.secrets.mixCodesParameters.length; i++) {
                if ((!this.state.secrets.mixCodesParameters[i].secret) ||
                    (!this.state.secrets.mixCodesParameters[i].programId) ||
                    (!this.state.secrets.mixCodesParameters[i].uri)) {
                    this.setState({
                        temporaryProperties: {
                            ...this.state.temporaryProperties,
                            message: "The mixcodes parameter fields above must all be completed when including functionality to burn pincodes"
                        }
                    });
                    return false
                }
            }
        };
        return true;
    };

    addRowWinningLimitPerPrize = (idx) => () => {
        let newPrizeLimitation = Object.assign({}, { prizeId: "", prizeLimit: "" });
        let prizeLimitArray = [...this.state.temporaryProperties.winningLimitPerPrizeArray];
        prizeLimitArray.push(newPrizeLimitation);

        this.handleChangeTemporaryArray(WINNING_LIMITS_PER_PRIZE_ARRAY, prizeLimitArray)
    };

    addRowWinningLimitPerTierArray = (idx) => () => {
        let newTierLimitation = Object.assign({}, { tier: "", tierLimit: "" });
        let tierLimitArray = [...this.state.temporaryProperties.winningLimitsPerTierArray];
        tierLimitArray.push(newTierLimitation);

        this.handleChangeTemporaryArray(WINNING_LIMITS_PER_TIER_ARRAY, tierLimitArray)
    };

    addRowParticipationCost = (idx) => () => {
        let newParticipationCost = Object.assign({}, { currencyId: "", amount: "" });
        let participationCostArray = [...this.state.params.reduceAmount];
        participationCostArray.push(newParticipationCost);

        this.handleParamChange(REDUCE_AMOUNT, participationCostArray);
    };

    addRowViralCodeMapping = (idx) => () => {
        let newViralCodeMap = Object.assign({}, { viralCode: '', prizeIds: '' });
        let viralCodesMappingArray = [...this.state.temporaryProperties.viralCodesMappingArray];
        viralCodesMappingArray.push(newViralCodeMap);

        this.handleChangeTemporaryArray(VIRAL_CODES_MAPPING_ARRAY, viralCodesMappingArray);
    };

    deleteRowWinningLimitPerPrize = (idx) => () => {
        let winningLimitPerPrizeArray = this.state.temporaryProperties.winningLimitPerPrizeArray;
        winningLimitPerPrizeArray.splice(idx, 1);

        this.handleChangeTemporaryArray(WINNING_LIMITS_PER_PRIZE_ARRAY, winningLimitPerPrizeArray);
    };

    deleteRowParticipationCost = (idx) => () => {
        let { params: { reduceAmount } } = this.state;
        reduceAmount.splice(idx, 1);

        this.handleParamChange(REDUCE_AMOUNT, reduceAmount);
    };

    deleteRowWinningLimitPerTier = (idx) => () => {
        let winningLimitsPerTierArray = this.state.temporaryProperties.winningLimitsPerTierArray;
        winningLimitsPerTierArray.splice(idx, 1);

        this.handleChangeTemporaryArray(WINNING_LIMITS_PER_TIER_ARRAY, winningLimitsPerTierArray)
    };

    deleteRowViralCodeMapping = (idx) => () => {
        let viralCodesMappingArray = this.state.temporaryProperties.viralCodesMappingArray;
        viralCodesMappingArray.splice(idx, 1);

        this.handleChangeTemporaryArray(VIRAL_CODES_MAPPING_ARRAY, viralCodesMappingArray)
    };

    onChangePrizeLimit = (idx) => (event) => {
        let prizeLimitArray = [...this.state.temporaryProperties.winningLimitPerPrizeArray];

        const value = event.target.name === "prizeLimit" ? Number(event.target.value) : event.target.value;
        prizeLimitArray[idx][event.target.name] = value;
        this.handleChangeTemporaryArray(WINNING_LIMITS_PER_PRIZE_ARRAY, prizeLimitArray);
    };

    onChangeParticipationCost = (idx) => (event) => {
        let participationCostArray = [...this.state.params.reduceAmount];

        const value = event.target.name === "amount" ? Number(event.target.value) : event.target.value;
        participationCostArray[idx][event.target.name] = value;

        this.handleParamChange(REDUCE_AMOUNT, participationCostArray);
        global.costArray = [...this.state.params.reduceAmount];
    };


    onChangeWinningLimitPerTier = (idx) => (event) => {
        let limitsPerTierArray = [...this.state.temporaryProperties.winningLimitsPerTierArray];

        const value = event.target.name === "tierLimit" ? Number(event.target.value) : event.target.value;
        limitsPerTierArray[idx][event.target.name] = value;
        this.handleChangeTemporaryArray(WINNING_LIMITS_PER_TIER_ARRAY, limitsPerTierArray);
    };

    handleMixcodeAdd = () => {
        this.setState(({ mixcodes }) => ({
            mixcodes: [...mixcodes, {
                programId: '',
                secret: '',
                uri: ''
            }]
        }));
    };

    handleMixcodeRemove = (event, index) => {
        const { mixcodes } = this.state;
        const newMixcodes = mixcodes.filter((mixcode, ordinal) => ordinal !== index);
        this.setState({ mixcodes: newMixcodes });
        const { onRemoveMixcode } = this.props;
        onRemoveMixcode(mixcodes, index);
    };

    onChangeViralCodeMapping = (idx) => (event) => {
        let prizeIdsPerViralCode = [...this.state.temporaryProperties.viralCodesMappingArray];

        const value = event.target.value;
        prizeIdsPerViralCode[idx][event.target.name] = value;
        this.handleChangeTemporaryArray(VIRAL_CODES_MAPPING_ARRAY, prizeIdsPerViralCode);
    };

    handleSecretChange = event => {
        this.setState({
            secrets: {
                ...this.state.secrets,
                [event.target.name]: event.target.value
            },
            temporaryProperties: {
                ...this.state.temporaryProperties,
                captchaSecretDirty: true
            }
        });
    };

    handleSecretRemove = name => {
        const secrets = { ...this.state.secrets };
        if (secrets.hasOwnProperty([name])) {
            delete secrets[name];
            this.setState({ secrets });
        }
    };

    handleParticipationLimitDatesRangeChange = (dates) => {
        const [start, end] = dates;

        this.setState((state) => ({
            temporaryProperties: {
                ...state.temporaryProperties,
                start,
                end
            },
            params: {
                ...state.params,
                participationLimitCalendarDatesRange: {
                    ...state.params.participationLimitCalendarDatesRange,
                    startDate: parseInt(moment.tz(moment(start).startOf('day').format('YYYY-MM-DD'), state.params.participationLimitTimeZone).format('x')),
                    endDate: end ? parseInt(moment.tz(moment(end).endOf('day').format('YYYY-MM-DDTHH:mm:ss.SSS'), state.params.participationLimitTimeZone).format('x')) : start
                }
            }
        }));
    };

    handleParticipationLimitTimeZoneChange = (timezone) => {
        this.setState((state) => ({
            params: {
                ...state.params,
                participationLimitTimeZone: timezone,
                participationLimitCalendarDatesRange: {
                    ...state.params.participationLimitCalendarDatesRange,
                    startDate: parseInt(moment.tz(moment(state.temporaryProperties.start).startOf('day').format('YYYY-MM-DD'), timezone).format('x')),
                    endDate: parseInt(moment.tz(moment(state.temporaryProperties.end).endOf('day').format('YYYY-MM-DDTHH:mm:ss.SSS'), timezone).format('x'))
                }
            }
        }));
    };

    handleUseCalendarDatesChange = (event) => {
        const checked = event.target.checked;

        this.setState((state) => {
            const newState = { params: { ...state.params } };
            newState.params.participationLimitUseCalendarDates = checked
            if (checked) {
                if (!state.params.participationLimitCalendarDatesRange) {
                    newState.params.participationLimitCalendarDatesRange = {
                        startDate: participationLimitStartInitValue,
                        endDate: participationLimitEndInitValue
                    }
                    newState.params.participationLimitTimeZone = state.params.participationLimitTimeZone || defaultTimeZone
                }

                newState.params.participationLimitTime = state.params.participationLimitTime &&
                    (state.params.participationLimitTime / 24) % 1 === 0 ?
                    state.params.participationLimitTime : 24;
            } else {
                newState.params.participationLimitTime = '';
            }

            return newState;
        })
    };

    setMixCodesParam = (position, event) => {
        this.setState({
            secrets: {
                ...this.state.secrets,
                mixCodesParameters: this.getUpdatedMixCodesParametersArray(position, event)
            }
        });
    };

    handleRemoveMixcode = (mixcodes, index) => {
        const newMixcodes = mixcodes.filter((mixcode, ordinal) => ordinal !== index);
        this.setState({
            secrets: {
                ...this.state.secrets,
                mixCodesParameters: newMixcodes
            }
        });
    };

    getUpdatedMixCodesParametersArray = (position, event) => {
        let mixCodesParametersArray = [];
        const { mixCodesParameters } = { ...this.state.secrets };
        if (mixCodesParameters && Array.isArray(mixCodesParameters)) {
            mixCodesParametersArray = [...mixCodesParameters];
            const mixCodesElement = { ...mixCodesParametersArray[position] };
            mixCodesElement[event.target.name] = event.target.value;
            mixCodesParametersArray[position] = mixCodesElement;
        } else {
            mixCodesParametersArray[0] = {
                [event.target.name]: event.target.value
            };
        }
        return mixCodesParametersArray;
    };

    handleUseConfigStartEndDatesChange = (event) => {
        const checked = event.target.checked;

        this.setState((state) => {
            const newState = {
                temporaryProperties: {
                    ...state.temporaryProperties,
                    useConfigStartEndDates: checked
                }
            };

            if (!checked && !state.params.participationLimitCalendarDatesRange) {
                newState.params = {
                    ...state.params,
                    participationLimitCalendarDatesRange: {
                        startDate: participationLimitStartInitValue,
                        endDate: participationLimitEndInitValue
                    },
                    participationLimitTimeZone: state.params.participationLimitTimeZone || defaultTimeZone
                };
            }
            return newState;
        })
    };

    updateStateParamsLimits = () => {
        const tierLimitArray = [...this.state.temporaryProperties.winningLimitsPerTierArray];
        const viralCodesMappingArray = [...this.state.temporaryProperties.viralCodesMappingArray];
        const prizeLimitArray = [...this.state.temporaryProperties.winningLimitPerPrizeArray];
        this.transformLimitArraysToObjects(tierLimitArray, WINNING_LIMITS_PER_TIER);
        this.transformLimitArraysToObjects(prizeLimitArray, WINNING_LIMITS_PER_PRIZE);
        if (viralCodesMappingArray.length > 0) {
            viralCodesMappingArray.forEach((value) => {
                value.prizeIds = value.prizeIds.split(/[ ,]+/);
            });
            this.transformLimitArraysToObjects(viralCodesMappingArray, VIRAL_CODES_MAPPING);
        }
    }

    transformLimitArraysToObjects = (arr, objName) => {
        if (arr.length > 0) {
            this.setState((state) => {
                const newState = {
                    params: {
                        ...state.params,
                        [objName]: {}
                    }
                }

                arr.forEach((value) => {
                    const objKeyValue = Object.values(value)[0];
                    const objValue = Object.values(value)[1];
                    newState.params[objName][objKeyValue] = objValue;

                });
                return newState
            })
        }
    }

    putFlowInStore = () => {
        if (!this.validity()) {
            return false
        }

        const { flowLabelKey, addFlowLabel, hideFlowDialog } = this.props;
        this.updateStateParamsLimits();
        let state = { ...this.state };

        if (!state.checkerLambdas.includes(PARTICIPATION_LIMIT)) {
            Object.keys(state.params).map((key) => {
                if (key.includes(PARTICIPATION_LIMIT)) {
                    delete state.params[key];
                }
            });
        } else if (
            !state.params.participationLimitUseCalendarDates ||
            state.temporaryProperties.useConfigStartEndDates
        ) {
            delete state.params.participationLimitCalendarDatesRange;
            delete state.params.participationLimitTimeZone;
        }

        if (!state.instantWinLimitCheckers.includes(INSTANT_WIN_LIMIT_PER_CONFIGURATION)) {
            Object.keys(state.params).map((key) => {
                if (key.includes(INSTANT_WIN_LIMIT_PER_CONFIGURATION)) {
                    delete state.params[key];
                }
            });
        }

        if (!state.instantWinLimitCheckers.includes(INSTANT_WIN_LIMIT_PER_TIME_INTERVAL)) {
            Object.keys(state.params).map((key) => {
                if (key.includes(INSTANT_WIN_LIMIT_PER_TIME_INTERVAL)) {
                    delete state.params[key];
                }
            });
        }

        if (!state.checkerLambdas.includes(INSTANT_WIN_PRIZE_LIMITS) && (state.instantWinLimitCheckers.includes(INSTANT_WIN_LIMIT_PER_CONFIGURATION) || state.instantWinLimitCheckers.includes(INSTANT_WIN_LIMIT_PER_TIME_INTERVAL))) {
            state.checkerLambdas.push(INSTANT_WIN_PRIZE_LIMITS);
        }

        delete state["temporaryProperties"];




        let stateToStore;
        stateToStore = {
            ...state,
            checkerLambdas: [
                ...state.checkerLambdas
            ],
        };

        addFlowLabel(flowLabelKey, stateToStore);
        hideFlowDialog();
    };

    handleAddToInstantWinLimitCheckers = checkerLambdaName => {
        this.setState((state) => {
            return {
                instantWinLimitCheckers: [...state.instantWinLimitCheckers, checkerLambdaName]
            }
        });
    };

    handleRemoveFromInstantWinLimitCheckers = checkerLambdaName => {
        const instantWinLimitCheckersArray = [...this.state.instantWinLimitCheckers];
        const newinstantWinLimitCheckersArray = instantWinLimitCheckersArray.filter(checkerLambda => checkerLambda !== checkerLambdaName);
        this.setState({
            instantWinLimitCheckers: newinstantWinLimitCheckersArray,
        });
    };

    render() {

        const { classes, flowLabelKey } = this.props;
        return (
            <Fragment>
                <ValidatorForm className={classes.container} autoComplete="off" onSubmit={this.putFlowInStore}>
                    <Paper className={classes.paper}>
                        <Chip
                            avatar={<Avatar>OP</Avatar>}

                            label="Options"
                            color="primary"
                            className={classes.chip}
                        />
                        <div className={classes.container}>
                            {this.state.temporaryProperties.displayCurrncyReduce &&
                                <div className={classes.rowContainer}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={this.state.flowLambdas.includes(CURRENCY_REDUCER)}
                                                onChange={this.handleChange}
                                                name={CURRENCY_REDUCER}
                                            />
                                        }
                                        label="Requires currency for participation"
                                    />
                                </div>
                            }
                            {this.state.temporaryProperties.displayParticipationLimit &&
                                <div className={classes.rowContainer}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={this.state.checkerLambdas.includes(PARTICIPATION_LIMIT)}
                                                onChange={this.handleChange}
                                                name={PARTICIPATION_LIMIT}
                                            />
                                        }
                                        label="Check for Participation Limit"
                                    />
                                </div>
                            }
                            {this.state.temporaryProperties.displayInstantWinLimitPerConfiguration &&
                                <div className={classes.rowContainer}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={this.state.instantWinLimitCheckers.includes(INSTANT_WIN_LIMIT_PER_CONFIGURATION)}
                                                onChange={this.handleChange}
                                                name={INSTANT_WIN_LIMIT_PER_CONFIGURATION}
                                            />
                                        }
                                        label="Winning limit per configuration"
                                    />
                                </div>
                            }
                            {this.state.temporaryProperties.displayInstantWinLimitPerTimeInterval &&
                                <div className={classes.rowContainer}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={this.state.instantWinLimitCheckers.includes(INSTANT_WIN_LIMIT_PER_TIME_INTERVAL)}
                                                onChange={this.handleChange}
                                                name={INSTANT_WIN_LIMIT_PER_TIME_INTERVAL}
                                            />
                                        }
                                        label="Winning limit per time interval"
                                    />
                                </div>
                            }
                            {this.state.temporaryProperties.displayBurnPincodes &&
                                <div className={classes.rowContainer}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={this.state.flowLambdas.includes(BURN_PINCODES)}
                                                onChange={this.handleChange}
                                                name={BURN_PINCODES}
                                            />
                                        }
                                        label="Include Pincode functionality"
                                    />
                                </div>
                            }
                            {this.state.temporaryProperties.displayImageEntry &&
                                <div className={classes.rowContainer}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={this.state.params[IMAGE_ENTRY]}
                                                onChange={this.handleChange}
                                                name={IMAGE_ENTRY}
                                            />
                                        }
                                        label="Include Image Entry functionality"
                                    />
                                </div>
                            }
                            {this.state.temporaryProperties.displayInstatWinCostEntry &&
                                <div className={classes.rowContainer}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={this.state.flowLambdas.includes(INSTANT_WIN_COST_ENTRY)}
                                                onChange={this.handleChange}
                                                name={INSTANT_WIN_COST_ENTRY}
                                            />
                                        }
                                        label="Instant win entry from Auto C&G"
                                    />
                                </div>
                            }
                        </div>
                    </Paper>
                    {this.state.flowLambdas.includes(BURN_PINCODES) &&
                        <ConfigurationFlowSecrets
                            flowLabelKey={flowLabelKey}
                            onMixCodesParamChange={this.setMixCodesParam}
                            onRemoveMixcode={this.handleRemoveMixcode}
                            classes={classes.row}
                        />

                    }
                    {this.state.temporaryProperties.message !== "" &&
                        <div style={{ color: "red" }}>
                            {this.state.temporaryProperties.message}
                        </div>
                    }
                    <Paper className={classes.paper}>
                        {this.state.temporaryProperties.displayParameters &&
                            <Chip
                                avatar={<Avatar>PA</Avatar>}
                                label="Parameters"
                                color="primary"
                                className={classes.chip}
                            />
                        }
                        <div className={classes.container}>

                            {this.state.temporaryProperties.displayAlgorithm &&
                                <div className={classes.rowContainer}>
                                    <label className={classes.label}>
                                        <Typography variant="body2" gutterBottom>Algorithm</Typography>
                                    </label>
                                    <Select
                                        id="algorithm"
                                        name="algorithm"
                                        value={this.state.params.algorithm}
                                        onChange={(event) => {
                                            this.handleParamChange(event.target.name, event.target.value);
                                        }}
                                        fullWidth
                                        className={classes.select}
                                        disableUnderline
                                    >
                                        {Object.entries(instantWinAlgorithms).map(([key, value]) => (
                                            <MenuItem key={key} value={key}>
                                                {value}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                    {this.state.temporaryProperties.message !== "" && this.state.params.algorithm === '' &&
                                        <div style={{ color: "red" }}>
                                            {this.state.temporaryProperties.message}
                                        </div>
                                    }
                                </div>
                            }
                            {this.state.temporaryProperties.displayUseVoucherStatusReserved &&
                                <div className={classes.rowContainer}>
                                    <label className={classes.label}>
                                        <Typography variant="body2" gutterBottom>Use Voucher Status Reserved</Typography>
                                    </label>
                                    <Select
                                        id="useStatusReserved"
                                        name="useStatusReserved"
                                        value={this.state.params.useStatusReserved}
                                        onChange={(event) => {
                                            this.handleParamChange(event.target.name, event.target.value);
                                        }}
                                        fullWidth
                                        className={classes.select}
                                        disableUnderline
                                    >
                                        <MenuItem value={true}>
                                            <Typography variant="body2" gutterBottom>Yes</Typography>
                                        </MenuItem>
                                        <MenuItem value={false}>
                                            <Typography variant="body2" gutterBottom>No</Typography>
                                        </MenuItem>
                                    </Select>
                                </div>
                            }
                            {this.state.temporaryProperties.displayDelayEmail &&
                                <div className={classes.rowContainer}>
                                    <label className={classes.label}>
                                        <Typography variant="body2" gutterBottom>Delay Email Sending in Seconds</Typography>
                                    </label>
                                    <TextValidator
                                        id="delaySeconds"
                                        name="delaySeconds"
                                        value={this.state.params.delaySeconds}
                                        onChange={(event) => {
                                            this.handleParamChange(event.target.name, event.target.value);
                                        }}
                                        className={classes.textField}
                                        margin="normal"
                                        type="number"
                                        validators={['isNumber', 'isPositive', 'maxNumber:900']}
                                        errorMessages={['This field is required', 'Type must be number!', 'Number must be positive', 'Number must be less or equal to 900']}
                                        InputProps={{
                                            disableUnderline: true
                                        }}
                                    />
                                </div>
                            }
                            {this.state.temporaryProperties.displayWinningLimitsPerTierflag &&
                                <div className={classes.rowContainer}>
                                    <label className={classes.label}>
                                        <Typography variant="body2" gutterBottom>Winning Limits Per Tier</Typography>
                                    </label>
                                    <Select
                                        id={WINNING_LIMITS_PER_TIER_FLAG}
                                        name={WINNING_LIMITS_PER_TIER_FLAG}
                                        value={this.state.temporaryProperties.flags.winningLimitsPerTierFlag}
                                        onChange={this.handleFlagsChange}
                                        fullWidth
                                        className={classes.select}
                                        disableUnderline
                                    >
                                        <MenuItem value={true}>
                                            <Typography variant="body2" gutterBottom>Yes</Typography>
                                        </MenuItem>
                                        <MenuItem value={false}>
                                            <Typography variant="body2" gutterBottom>No</Typography>
                                        </MenuItem>
                                    </Select>
                                </div>
                            }
                            {this.state.temporaryProperties.displayWinningLimitsPerPrizeFlag &&
                                <div className={classes.rowContainer}>
                                    <label className={classes.label}>
                                        <Typography variant="body2" gutterBottom>Winning Limits Per Prize</Typography>
                                    </label>
                                    <Select
                                        id={WINNING_LIMITS_PER_PRIZE_FLAG}
                                        name={WINNING_LIMITS_PER_PRIZE_FLAG}
                                        value={this.state.temporaryProperties.flags.winningLimitsPerPrizeFlag}
                                        onChange={this.handleFlagsChange}
                                        fullWidth
                                        className={classes.select}
                                        disableUnderline
                                    >
                                        <MenuItem value={true}>
                                            <Typography variant="body2" gutterBottom>Yes</Typography>
                                        </MenuItem>
                                        <MenuItem value={false}>
                                            <Typography variant="body2" gutterBottom>No</Typography>
                                        </MenuItem>
                                    </Select>
                                </div>
                            }
                            {this.state.temporaryProperties.displayAlwaysWin &&

                                <div className={classes.rowContainer}>
                                    <label className={classes.label}>
                                        <Typography variant="body2" gutterBottom>Always Win</Typography>
                                    </label>
                                    <Select
                                        id={ALWAYS_WIN}
                                        name={ALWAYS_WIN}
                                        value={this.state.temporaryProperties.flags.alwaysWin}
                                        onChange={this.handleFlagsChange}
                                        fullWidth
                                        className={classes.select}
                                        disableUnderline
                                    >
                                        <MenuItem value={true}>
                                            <Typography variant="body2" gutterBottom>Yes</Typography>
                                        </MenuItem>
                                        <MenuItem value={false}>
                                            <Typography variant="body2" gutterBottom>No</Typography>
                                        </MenuItem>
                                    </Select>
                                </div>
                            }
                            {this.state.temporaryProperties.displayViralCodesPrizeMap &&
                                <div className={classes.rowContainer}>
                                    <label className={classes.label}>
                                        <Typography variant="body2" gutterBottom>Viral codes prize map</Typography>
                                    </label>
                                    <Select
                                        id={VIRAL_CODES_PRIZE_MAP_FLAG}
                                        name={VIRAL_CODES_PRIZE_MAP_FLAG}
                                        value={this.state.temporaryProperties.flags.viralCodesPrizeMapFlag}
                                        onChange={this.handleFlagsChange}
                                        fullWidth
                                        className={classes.select}
                                        disableUnderline
                                    >
                                        <MenuItem value={true}>
                                            <Typography variant="body2" gutterBottom>Yes</Typography>
                                        </MenuItem>
                                        <MenuItem value={false}>
                                            <Typography variant="body2" gutterBottom>No</Typography>
                                        </MenuItem>
                                    </Select>
                                </div>
                            }
                            {
                                this.state.temporaryProperties.flags.viralCodesPrizeMapFlag &&
                                this.state.temporaryProperties.viralCodesMappingArray.map((value, index) => (
                                    <MultipleFieldPairsComponent
                                        typeOfFirstFormField={"text"}
                                        typeOfSecondFormField={"text"}
                                        firstLabelName={"ViralCode"}
                                        secondLabelName={"PrizeIds"}
                                        objectProperty={value.viralCode}
                                        objectValue={value.prizeIds}
                                        rowData={value}
                                        idx={index}
                                        onRow={index ? this.deleteRowViralCodeMapping : this.addRowViralCodeMapping}
                                        handler={this.onChangeViralCodeMapping}
                                    />))
                            }
                            {
                                this.state.temporaryProperties.flags.winningLimitsPerTierFlag &&
                                this.state.temporaryProperties.winningLimitsPerTierArray.map((value, index) => (
                                    <MultipleFieldPairsComponent
                                        typeOfFirstFormField={"number"}
                                        typeOfSecondFormField={"number"}
                                        firstLabelName={"Tier"}
                                        secondLabelName={"Limit"}
                                        objectProperty={value.tier}
                                        objectValue={value.tierLimit}
                                        rowData={value}
                                        idx={index}
                                        onRow={index ? this.deleteRowWinningLimitPerTier : this.addRowWinningLimitPerTierArray}
                                        handler={this.onChangeWinningLimitPerTier}
                                    />))
                            }
                            {
                                this.state.temporaryProperties.flags.winningLimitsPerPrizeFlag &&
                                this.state.temporaryProperties.winningLimitPerPrizeArray.map((value, index) => (
                                    <MultipleFieldPairsComponent
                                        typeOfFirstFormField={"text"}
                                        typeOfSecondFormField={"number"}
                                        firstLabelName={"Prize ID"}
                                        secondLabelName={"Prize Limit"}
                                        objectProperty={value.prizeId}
                                        objectValue={value.prizeLimit}
                                        rowData={value}
                                        idx={index}
                                        onRow={index ? this.deleteRowWinningLimitPerPrize : this.addRowWinningLimitPerPrize}
                                        handler={this.onChangePrizeLimit}
                                    />))
                            }
                            {
                                this.state.flowLambdas.includes(CURRENCY_REDUCER) && (
                                    <Fragment>
                                        <div className={classes.rowContainer} style={{ width: "100%" }}>
                                            <label className={classes.label}>
                                                <Typography variant="body2" gutterBottom>Requires currency for
                                                    participation</Typography>
                                            </label>
                                            {this.state.params.reduceAmount.map((value, index) => (
                                                <MultipleFieldPairsComponent
                                                    typeOfFirstFormField={"text"}
                                                    typeOfSecondFormField={"number"}
                                                    firstLabelName={"Currency ID"}
                                                    secondLabelName={"Cost"}
                                                    objectProperty={value.currencyId}
                                                    objectValue={value.amount}
                                                    rowData={value}
                                                    idx={index}
                                                    onRow={index ? this.deleteRowParticipationCost : this.addRowParticipationCost}
                                                    handler={this.onChangeParticipationCost}
                                                />
                                                ))}
                                        </div>
                                    </Fragment>
                                )
                            }
                            {this.state.checkerLambdas.includes(PARTICIPATION_LIMIT) && (


                              <Fragment>

                                    {this.state.temporaryProperties.displayParams &&
                                        <Chip
                                            avatar={<Avatar>PA</Avatar>}
                                            label="Parameters"
                                            color="primary"
                                            className={classes.chip}
                                        />
                                    }


                                    <div className={classes.rowContainer}>

                                        <label className={classes.label}>

                                            <Typography variant="body2" gutterBottom>Participation Limit</Typography>
                                        </label>
                                        <TextValidator
                                            id={PARTICIPATION_LIMIT}
                                            name={PARTICIPATION_LIMIT}
                                            value={this.state.params.participationLimit}
                                            onChange={(event) => {
                                                this.handleParamChange(event.target.name, event.target.value);
                                            }}
                                            className={classes.textField}
                                            margin="normal"
                                            type="number"
                                            required
                                            validators={['isNumber', 'isPositive']}
                                            errorMessages={['Type must be number!', 'Number must be positive']}
                                            InputProps={{
                                                disableUnderline: true
                                            }}
                                        />
                                    </div>
                                    <div className={classes.rowContainer}>
                                        {this.state.params.participationLimitUseCalendarDates ?
                                            <label className={`${classes.label} ${classes.relativePosition}`}>
                                                <Typography variant="body2" gutterBottom>Participation Limit Rolling Period
                                                    <Tooltip placement="right" title={
                                                        <span className={classes.tooltipText}>
                                                            Cool down participation limit period in hours.
                                                            It should be divisible by 24 and the minimum value is 24 hours.
                                                            Example usage: Limit the participations for 1 week instead of the whole promotion time
                                                        </span>
                                                    }>
                                                        <InfoIcon className={classes.tooltipIcon} fontSize="small" />
                                                    </Tooltip>
                                                    <TextValidator
                                                        id="participationLimitTime"
                                                        name="participationLimitTime"
                                                        value={this.state.params.participationLimitTime}
                                                        onChange={(event) => {
                                                            this.handleParamChange(event.target.name, event.target.value);
                                                        }}
                                                        className={classes.textField}
                                                        margin="normal"
                                                        type="number"
                                                        required
                                                        validators={['isNumber', 'minNumber:24', 'isDivisibleByTwentyFour']}
                                                        errorMessages={['Type must be a number!', 'Minimum value of 24 hours', 'Value should be in 24 hour increments']}
                                                        InputProps={{
                                                            disableUnderline: true
                                                        }}
                                                    />
                                                </Typography>
                                            </label>
                                            :
                                            <label className={`${classes.label} ${classes.relativePosition}`}>
                                                <Typography variant="body2" gutterBottom>Participation Limit Time</Typography>
                                                <TextValidator
                                                    id="participationLimitTime"
                                                    name="participationLimitTime"
                                                    value={this.state.params.participationLimitTime}
                                                    onChange={(event) => {
                                                        this.handleParamChange(event.target.name, event.target.value);
                                                    }}
                                                    className={classes.textField}
                                                    margin="normal"
                                                    type="number"
                                                    required
                                                    validators={['isNumber', 'isPositive']}
                                                    errorMessages={['Type must be a number!', 'Number must be positive']}
                                                    InputProps={{
                                                        disableUnderline: true
                                                    }}
                                                />
                                            </label>
                                        }
                                    </div>
                                    <div className={classes.rowContainer}>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={this.state.params.participationLimitUseCalendarDates}
                                                    onChange={this.handleUseCalendarDatesChange}
                                                    name={PARTICIPATION_LIMIT_USE_CALENDAR_DATES}
                                                />
                                            }
                                            label="Limit participation by calendar days, rather than hours"
                                        />
                                    </div>
                                    {this.state.params.participationLimitUseCalendarDates && (
                                        <Fragment>
                                            <div className={classes.rowContainer}>
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={this.state.temporaryProperties.useConfigStartEndDates}
                                                            onChange={this.handleUseConfigStartEndDatesChange}
                                                            name={PARTICIPATION_LIMIT_USE_CONFIG_DATES}
                                                        />
                                                    }
                                                    label="Use default configuration start and end date"
                                                />
                                            </div>
                                            {!this.state.temporaryProperties.useConfigStartEndDates && (
                                                <Fragment>
                                                    <div className={classes.rowContainer}>
                                                        <label className={classes.label}>
                                                            <Typography variant="body2" gutterBottom>Participation limit date range</Typography>
                                                        </label>
                                                        <DatePicker
                                                            selected={this.state.temporaryProperties.start}
                                                            onChange={this.handleParticipationLimitDatesRangeChange}
                                                            startDate={this.state.temporaryProperties.start}
                                                            endDate={this.state.temporaryProperties.end}
                                                            selectsRange
                                                            inline
                                                            minDate={minDateDatePicker}
                                                        />
                                                    </div>
                                                    <div className={classes.rowContainer}>
                                                        <label className={classes.label}>
                                                            <Typography variant="body2" gutterBottom>Participation Limit Time Zone</Typography>
                                                        </label>
                                                        <Select
                                                            id="participationLimitTimeZine"
                                                            name="participationLimitTimeZine"
                                                            value={this.state.params.participationLimitTimeZone}
                                                            onChange={(event) => {
                                                                this.handleParticipationLimitTimeZoneChange(event.target.value);
                                                            }}
                                                            fullWidth
                                                            className={classes.select}
                                                            disableUnderline
                                                        >
                                                            {availableTimeZones.map((tz) => (
                                                                <MenuItem key={tz} value={tz}>
                                                                    {tz}
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    </div>
                                                </Fragment>
                                            )}
                                        </Fragment>
                                    )}
                                </Fragment>
                            )}
                            {this.state.instantWinLimitCheckers.includes(INSTANT_WIN_LIMIT_PER_TIME_INTERVAL) && (
                                <Fragment>
                                    <div className={classes.rowContainer}>
                                        <label className={classes.label}>
                                            <Typography variant="body2" gutterBottom>Specify the Winning limit per time interval</Typography>
                                        </label>
                                        <TextValidator
                                            id={INSTANT_WIN_LIMIT_PER_TIME_INTERVAL}
                                            name={INSTANT_WIN_LIMIT_PER_TIME_INTERVAL}
                                            value={this.state.params.instantWinLimitPerTimeInterval}
                                            onChange={(event) => {
                                                this.handleParamChange(event.target.name, event.target.value);
                                            }}
                                            className={classes.textField}
                                            margin="normal"
                                            type="number"
                                            required
                                            validators={['isNumber', 'isPositive']}
                                            errorMessages={['Type must be number!', 'Number must be positive']}
                                            InputProps={{
                                                disableUnderline: true
                                            }}
                                        />
                                    </div>
                                    <div className={classes.rowContainer}>
                                        <label className={classes.label}>
                                            <Typography variant="body2" gutterBottom>Time Interval In Hours</Typography>
                                        </label>
                                        <TextValidator
                                            id='instantWinLimitPerTimeIntervalValue'
                                            name='instantWinLimitPerTimeIntervalValue'
                                            value={this.state.params.instantWinLimitPerTimeIntervalValue}
                                            onChange={(event) => {
                                                this.handleParamChange(event.target.name, event.target.value);
                                            }}
                                            className={classes.textField}
                                            margin="normal"
                                            type="number"
                                            required
                                            validators={['isNumber', 'isPositive']}
                                            errorMessages={['Type must be number!', 'Number must be positive']}
                                            InputProps={{
                                                disableUnderline: true
                                            }}
                                        />
                                    </div>
                                </Fragment>
                            )}
                            {this.state.instantWinLimitCheckers.includes(INSTANT_WIN_LIMIT_PER_CONFIGURATION) && (
                                <Fragment>
                                    <div className={classes.rowContainer}>
                                        <label className={classes.label}>
                                            <Typography variant="body2" gutterBottom>Specify the winning limit per configuration</Typography>
                                        </label>
                                        <TextValidator
                                            id={INSTANT_WIN_LIMIT_PER_CONFIGURATION}
                                            name={INSTANT_WIN_LIMIT_PER_CONFIGURATION}
                                            value={this.state.params.instantWinLimitPerConfiguration}
                                            onChange={(event) => {
                                                this.handleParamChange(event.target.name, event.target.value);
                                            }}
                                            className={classes.textField}
                                            margin="normal"
                                            type="number"
                                            required
                                            validators={['isNumber', 'isPositive']}
                                            errorMessages={['Type must be number!', 'Number must be positive']}
                                            InputProps={{
                                                disableUnderline: true
                                            }}
                                        />
                                    </div>
                                </Fragment>
                            )}
                            {this.state.flowLambdas.includes(INSTANT_WIN_COST_ENTRY) && (
                                <Fragment>
                                    <div className={classes.rowContainer}>
                                        <label className={classes.label}>
                                            <Typography variant="body2" gutterBottom>Provide instant win configuration id</Typography>
                                        </label>
                                        <TextValidator
                                            id={INSTANT_WIN_COST_ENTRY_CONFIGURATION}
                                            name={INSTANT_WIN_COST_ENTRY_CONFIGURATION}
                                            value={this.state.params.instantWinCostEntryConfiguration}
                                            onChange={(event) => {
                                                this.handleParamChange(event.target.name, event.target.value);
                                            }}
                                            className={classes.textField}
                                            margin="normal"
                                            type="text"
                                            required
                                            InputProps={{
                                                disableUnderline: true
                                            }}
                                        />
                                    </div>
                                </Fragment>
                            )}
                        </div>
                    </Paper>
                    <ConfigurationFlowAutomaticChecks
                        flowLabelKey={flowLabelKey}
                        changeParam={this.handleParamChange}
                        removeParam={this.handleParamRemove}
                        changeSecret={this.handleSecretChange}
                        removeSecret={this.handleSecretRemove}
                        addToCheckerLambdas={this.handleAddToCheckerLambdas}
                        removeFromCheckerLambdas={this.handleRemoveFromCheckerLambdas}
                        handleAddToInstantWinLimitCheckers={this.handleAddToInstantWinLimitCheckers}
                        handleRemoveFromInstantWinLimitCheckers={this.handleRemoveFromInstantWinLimitCheckers}
                        className={classes.row}
                        minAge={this.state.params.minAge}
                        minAgeDirty={this.state.temporaryProperties.minAgeDirty}
                        lotIds={this.state.params.lotIds ? this.state.params.lotIds : [""]}
                        campaignIds={this.state.params.campaignIds ? this.state.params.campaignIds : [""]}
                    />
                    <Button type="submit" color="primary" variant="contained">Apply Changes</Button>
                </ValidatorForm>
            </Fragment>
        );
    };
}

ConfigurationFlowContainer.propTypes = propTypes;

const mapStateToProps = (state, ownProps) => {
    const { flowLabelKey } = ownProps;
    return { flow: state.ui[CONFIGURATION_FORM].flow[flowLabelKey] };
};

const mapDispatchToProps = dispatch => ({
    addFlowLabel: (flowLabelKey, flowLabelObject) => dispatch(addFlowLabel(flowLabelKey, flowLabelObject))
});

const enhance = compose(
    withStyles(styles),
    connect(mapStateToProps, mapDispatchToProps)
);

export default enhance(ConfigurationFlowContainer);

