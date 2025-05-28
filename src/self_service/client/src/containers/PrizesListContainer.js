import React, { Component, Fragment } from 'react';
import {IconButton, withStyles} from '@material-ui/core';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { compose } from 'lodash/fp';
import { Chip, Dialog, Typography, Radio, RadioGroup, FormControlLabel, Backdrop, CircularProgress } from '@material-ui/core';
import { getPrizesRequest, emptyPrizes, setConfigId, getPrizeRequest } from '../redux/prizes/actions';
import { addListingLanguage, enableSpinner, clearForm } from '../redux/ui/actions';
import PrizesList from '../components/PrizesList';
import FloatingActionButton from '../components/FloatingActionButton';
import Search from '../components/Search';
import LanguagePicker from '../components/LanguagePicker';
import { getLanguageCode } from '../helpers/utils';
import { supportedLanguagesMap } from '../constants/lists';
import ROUTES from '../routes/Routes';
import { Edit as EditIcon } from "@material-ui/icons";
import { PRIZE_FORM } from "../constants/forms";
import Page from '../components/Page';
import { getConfigurationRequest } from "../redux/configurations/actions";

const propTypes = {};

const styles = {
    language: {
        display: 'flex',
        flexDirection: 'row',
        marginBottom: 20
    },
    chip: {
        marginLeft: 30
    },
    configuration: {
        paddingTop: 10,
        width: "90%",
        margin: "auto",
        paddingBottom: 0
    },
    textField: {
        width: 200,
        height: 35,
        borderRadius: 5,
        boxShadow: "0 0 0 2px #f40000",
        padding: "5px 5px 0 5px",
        margin: "10px 0 10px 22px"
    },
    label: {
        width: 220,
        marginLeft: 50,
        display: "flex",
        flexDirection: "column",
        justify: "flex-start",
        alignItems: "flex-start"
    },
    radioGroups: {
        marginLeft: "50px"
    },
    backdrop: {
        zIndex: 99999,
        color: '#fff',
    },
};

const defaultProps = {};

const header = {
    prizeId: 'Prize Id',
    name: 'Prize Name',
    tags: 'Price Tags',
    promotionName: 'Promotion Name',
    country: 'Country',
    amountAvailable: 'Total Available',
    active: 'Active',
    priority: 'Priority',
    edit: 'Edit'
};

class PrizesListContainer extends Component {
    state = {
        prizeFilter: "all",
        language: {
            "en-GB": "English (United Kingdom)"
        },
        displayLanguagePicker: false
    };

    shouldComponentUpdate = (nextProp) => {
        const {configurationId, prizes, spinnerEnabled, forceRender, afterRender} = this.props;

        if (nextProp.configurationId !== configurationId ||
            (nextProp.prizes.length !== prizes.length) ||
            (nextProp.spinnerEnabled !== spinnerEnabled)
        ) {
            return true;
        }

        if (forceRender) {
            typeof afterRender === 'function' && afterRender();
            return true;
        }

        return false;
    }

    componentDidMount = () => {
        const { emptyPrizes, clearForm } = this.props;
        clearForm(PRIZE_FORM);
        window.onbeforeunload = emptyPrizes();
    };

    componentWillUnmount = () => {
        const { emptyPrizes, clearForm } = this.props;
        emptyPrizes();
        clearForm(PRIZE_FORM);
    };

    chooseLanguage = () => {
        this.setState({
            displayLanguagePicker: true
        });
    };

    handleNewLanguage = language => {
        const languageCode = getLanguageCode(language);
        this.setState({
            language: {
                [languageCode]: language
            },
            displayLanguagePicker: false
        });
        this.props.setLanguage([languageCode], language);
    };

    handleLanguageCancel = () => {
        this.setState({
            displayLanguagePicker: false
        });
    };

    handlePrizeStatusChange = (event) => {  
        this.setState({
            [event.target.name]: event.target.value
        });
        this.forceUpdate();
    };

    handleConfigurationChange = event => {
        const configurationId = event.target.value;
        const { setConfigurationId } = this.props;
        setConfigurationId(configurationId)
    };

    fetchPrizes = () => {
        const { getPrizes, configurationId, getConfiguration, executeOnSearchClick, enableSpinner } = this.props;
        const { language, prizeFilter } = this.state;
        enableSpinner(PRIZE_FORM, true);
        getConfiguration(configurationId);
        getPrizes(configurationId.trim(), Object.keys(language)[0], prizeFilter);
        typeof executeOnSearchClick === 'function' && executeOnSearchClick();
    };

    renderPrizeItems = () => {
        const { promotionName, country, prizes, configurationId, getPrize, history } = this.props;
        return prizes.map(item => ({
                    prizeId: item.prizeId,
                    name: item.name,
                    tags: item.tags ? item.tags.join(", ") : undefined,
                    promotionName,
                    country,
                    amountAvailable: item.amountAvailable,
                    active: item.active ? 'Yes' : 'No',
                    priority: item.priority,
                    edit: <IconButton onClick={() => {
                            getPrize(configurationId, item.prizeId);
                            history.push(ROUTES.prizes.edit(item.prizeId))
                            }}>
                            <EditIcon />
                          </IconButton>
                }));
    };

    render() {
        const { classes } = this.props;
        const { language, displayLanguagePicker, prizeFilter } = this.state;
        const { configurationId, hideLanguageDialog, hidePrizeList ,hideAddPrizeButton, prizeListHeader, prizeListRows, spinnerEnabled } = this.props;
        return (
        <Page>
            <Fragment >
            <Backdrop className={classes.backdrop} open={spinnerEnabled}>
                <CircularProgress color="inherit" />
            </Backdrop>
                <Search
                    acronym="PR"
                    headline="Prizes"
                    searchId="Configuration Id"
                    value={configurationId}
                    onTextInputChange={this.handleConfigurationChange}
                    onSearch={this.fetchPrizes}
                >
                    { !hideLanguageDialog && 
                        <div className={classes.language}>
                            <label className={classes.label}>
                                <Typography variant="body2" gutterBottom>Language</Typography>
                            </label>
                            {language &&
                                <Chip
                                    label={Object.entries(language)[0][1]}
                                    onDelete={this.chooseLanguage}
                                    className={classes.chip}
                                    color="primary" />
                            }
                        </div>
                    }
                    { !hideLanguageDialog &&
                        <Dialog open={displayLanguagePicker}>
                            <LanguagePicker
                                languages={Object.values(supportedLanguagesMap)}
                                onSelected={this.handleNewLanguage}
                                onCancel={this.handleLanguageCancel} />
                        </Dialog>
                    }
                    <div className={classes.rowContainer}>
                        <label className={classes.label}>
                            <Typography variant="body2" gutterBottom>Prize Status</Typography>
                        </label>    
                        <RadioGroup name="prizeFilter" value={prizeFilter} onChange={this.handlePrizeStatusChange} className={classes.radioGroups} row>
                            <FormControlLabel value="all" control={<Radio color="primary" />} label="All" />
                            <FormControlLabel value="active" control={<Radio color="primary" />} label="Active" />
                            <FormControlLabel value="inactive" control={<Radio color="primary" />} label="Not active" />
                        </RadioGroup>
                    </div>
                </Search>
                { !hidePrizeList &&
                    <PrizesList
                        header={prizeListHeader || header}
                        rows={prizeListRows || this.renderPrizeItems()}
                    />
                }
                {!hideAddPrizeButton &&
                    <Link to={`${ROUTES.prizes.add}`}>
                        <FloatingActionButton title="Add New Prize" color="primary" label="Add" />
                    </Link>
                }
            </Fragment>
        </Page>
        );
    };
};

PrizesListContainer.propTypes = propTypes;
PrizesListContainer.defaultProps = defaultProps;

const mapStateToProps = state => ({
    prizeFormState: state.ui[PRIZE_FORM],
    prizes: state.prizes.prizes,
    promotionName: state.prizes.promotionName,
    configurationId: state.prizes.configurationId,
    country: state.prizes.country,
    spinnerEnabled: state.ui[PRIZE_FORM].spinnerEnabled 
});

const mapDispatchToProps = dispatch => ({
    getPrizes: (configurationId, languageCode, filter) => dispatch(getPrizesRequest(configurationId, languageCode, filter)),
    emptyPrizes: () => dispatch(emptyPrizes()),
    setConfigurationId: (configurationId) => dispatch(setConfigId(configurationId)),
    getPrize: (configurationId, prizeId) => dispatch(getPrizeRequest({configurationId ,prizeId})),
    setLanguage: (languageCode, languageName) => dispatch(addListingLanguage(languageCode, languageName)),
    enableSpinner: (source, spinnerStatus) => dispatch(enableSpinner(source, spinnerStatus)),
    getConfiguration: configurationId => dispatch(getConfigurationRequest(configurationId)),
    clearForm: source => dispatch(clearForm(source))
});

const enhance = compose(
    withStyles(styles),
    connect(mapStateToProps, mapDispatchToProps)
);

export default enhance(PrizesListContainer);