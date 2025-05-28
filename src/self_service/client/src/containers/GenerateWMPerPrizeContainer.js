import React, { Component, Fragment } from 'react';
import { Button, Checkbox, Slider, TextField, Divider, Typography } from '@material-ui/core';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import { withStyles } from '@material-ui/core/styles';
import PrizesListContainer from './PrizesListContainer';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { compose } from 'lodash/fp';
import { generateWinningMomentsPerPrize, clearWinningMoments } from '../redux/winningMoments/actions';
import { getPrizesRequest } from '../redux/prizes/actions';
import { getConfigurationRequest } from "../redux/configurations/actions";
import { showNotification } from '../redux/ui/actions';

const styles = {
    slider: {
        padding: '3px 0',
        width: '90%'
    },
    textField: {
        width: '86%',
        maxWidth: 220
    },
    genericButton: {
        marginLeft: 18
    },
    downloadInfo: {
        marginLeft: 18,
        marginRight: 18
    }
};

const prizeListHeader = {
    select: 'Select',
    prizeId: 'Prize Id',
    name: 'Prize Name',
    startDate: 'Start Date',
    endDate: 'End Date',
    timestampDistDefect: 'Timestamp Distribution Defect',
    amountAvailable: 'Total Available',
    active: 'Active',
    winningMomentExp: 'Winning Moment Expiration'
};

const marks = (count, step) => {
    const marks = [];

    for (let i = 0; i <= count; i += step) {
        marks.push({
            value: i
        });
    }

    return marks;
};

const startDate = new Date();
const endDate = new Date(new Date().setMonth(startDate.getMonth() + 1));

const getTextFieldDateFormat = (date) => {
    const isoDate = date.toISOString();
    const dateStringEnd = isoDate.lastIndexOf(':');
    return isoDate.slice(0, dateStringEnd);
};

class GenerateWMPerPrizeContainer extends Component {
    state = {
        prizes: {},
        forcePrizeListRender: false
    };
    showDownloadBtn = false;
    generateMoments = () => {
        const { prizes, configurationId, notify, generate } = this.props;
        const prizesInState = Object.keys(this.state.prizes);
        const prizesMap = prizes.length && prizes.reduce((prizesAcc, prize) => {
            prizesAcc[prize.prizeId] = prize;
            return prizesAcc;
        }, {});

        if (!prizesInState.length) {
            notify({
                title: "Action warning!",
                message: "Please select at least one prize!",
                type: "WARNING",
                visible: true
            });
            return;
        }

        const prizeParams = prizesInState.filter(prizeId => this.state.prizes[prizeId].selected).map(prizeId => {
            const prize = this.state.prizes[prizeId];

            return {
                prizeId,
                startDate: prize.startDate || prizesMap[prizeId].startDate || startDate.getTime(),
                endDate: prize.endDate || prizesMap[prizeId].endDate || endDate.getTime(),
                timestampDistributionDefect: prize.timestampDistributionDefect || 0,
                winningMomentExpiration: prize.winningMomentExpiration || 0
            };
        });

        generate({
            configurationId,
            prizeParams
        });

        this.showDownloadBtn = true;
    };
    renderPrizeRows = () => {
        const { prizes, classes } = this.props;

        return prizes.map(item => ({
            prizeId: item.prizeId,
            name: item.name,
            active: item.active ? 'Yes' : 'No',
            amountAvailable: item.amountAvailable,
            startDate: <TextField
                name="startDate"
                type="datetime-local"
                defaultValue={item.startDate ? getTextFieldDateFormat(new Date(item.startDate)) : getTextFieldDateFormat(startDate)}
                disabled={item.startDate ? true : false}
                className={classes.textField}
                onChange={(event) => {
                    this.setState({
                        prizes: {
                            ...this.state.prizes,
                            [item.prizeId]: {
                                ...this.state.prizes[item.prizeId],
                                startDate: new Date(event.target.value).getTime()
                            }
                        }
                    });
                }}
            />,
            endDate: <TextField
                name="endDate"
                type="datetime-local"
                defaultValue={item.endDate ? getTextFieldDateFormat(new Date(item.endDate)) : getTextFieldDateFormat(startDate)}
                disabled={item.endDate ? true : false}
                className={classes.textField}
                InputLabelProps={{
                    shrink: true,
                }}
                onChange={(event) => {
                    this.setState({
                        prizes: {
                            ...this.state.prizes,
                            [item.prizeId]: {
                                ...this.state.prizes[item.prizeId],
                                endDate: new Date(event.target.value).getTime()
                            }
                        }
                    });
                }}
            />,
            winningMomentExp: <TextField
                defaultValue={0}
                type="number"
                value={this.state.prizes[item.prizeId] && this.state.prizes[item.prizeId].winningMomentExpiration}
                onChange={(event) => {
                    this.setState({
                        prizes: {
                            ...this.state.prizes,
                            [item.prizeId]: {
                                ...this.state.prizes[item.prizeId],
                                winningMomentExpiration: event.target.value
                            }
                        }
                    });
                }}
            />,
            select: <Checkbox
                defaultChecked={this.state.prizes[item.prizeId] && this.state.prizes[item.prizeId].selected}
                onChange={(event, value) => {
                    this.setState({
                        prizes: {
                            ...this.state.prizes,
                            [item.prizeId]: {
                                ...this.state.prizes[item.prizeId],
                                selected: value
                            }
                        }
                    });
                }}
                name="displayAdditionalInfo"
            />,
            timestampDistDefect: <Slider
                defaultValue={0}
                value={this.state.prizes[item.prizeId] && this.state.prizes[item.prizeId].timestampDistributionDefect}
                onChange={(event, value) => {
                    this.setState({
                        prizes: {
                            ...this.state.prizes,
                            [item.prizeId]: {
                                ...this.state.prizes[item.prizeId],
                                timestampDistributionDefect: value
                            }
                        }
                    });
                }}
                step={1}
                min={0}
                max={100}
                valueLabelDisplay="auto"
                marks={marks(100, 10)}
                className={classes.slider}
            />
        }));
    };

    componentDidMount = () => {
        this.props.clearWinningMoments()
    }

    render() {
        const { prizes, classes, csvContent } = this.props;

        return (
            <Fragment>
                < PrizesListContainer
                    hideLanguageDialog={true}
                    prizeListHeader={prizeListHeader}
                    prizeListRows={this.renderPrizeRows()}
                    hidePrizeList={prizes.length === 0}
                    hideAddPrizeButton
                    executeOnSearchClick={() => {
                        this.showDownloadBtn = false;
                        this.setState({ prizes: {}, forcePrizeListRender: true });
                    }}
                    forceRender={this.state.forcePrizeListRender}
                    afterRender={() => {this.setState({forcePrizeListRender: false})}}
                />
                {prizes.length > 0 &&
                    <Button title="Generic Winning Moments" color="primary" variant="contained" className={classes.genericButton} onClick={this.generateMoments}>Generate</Button>
                }
                {(this.showDownloadBtn && csvContent && prizes.length > 0) &&
                    <div className={classes.downloadInfo}>
                        <Divider style={{ marginTop: "1.5rem" }} />
                        <Typography className={classes.wrapIcon} variant="body2" gutterBottom style={{ marginTop: "1rem" }}>
                            <InfoOutlinedIcon fontSize="small" />
                            <span style={{ marginLeft: 5 }}>
                                Click "Download" to download and verify the generated file and upload it via "Upload Winning Moments Page".
                            </span>
                        </Typography>
                        <div style={{ marginTop: "1rem" }}>
                            <Button variant="contained" style={{ color: "blue" }} href={csvContent} on>
                                Download
                            </Button>
                        </div>
                    </div>
                }
            </Fragment>
        )
    };
};

GenerateWMPerPrizeContainer.propTypes = {
    classes: PropTypes.object.isRequired,
};

const mapStateToProps = state => ({
    prizes: state.prizes.prizes,
    configurationId: state.prizes.configurationId,
    csvContent: state.winningMoments.csvContent
});

const mapDispatchToProps = dispatch => ({
    notify: ({ title, message, type, visible }) => dispatch(showNotification({ title, message, type, visible })),
    generate: ({ configurationId, prizeParams }) => dispatch(generateWinningMomentsPerPrize({ configurationId, prizeParams })),
    clearWinningMoments: () => dispatch(clearWinningMoments()),
    getPrizes: (configurationId, languageCode) => dispatch(getPrizesRequest(configurationId, languageCode)),
    getConfiguration: configurationId => dispatch(getConfigurationRequest(configurationId))
});

const enhance = compose(
    withStyles(styles),
    connect(mapStateToProps, mapDispatchToProps)
);

export default enhance(GenerateWMPerPrizeContainer);
