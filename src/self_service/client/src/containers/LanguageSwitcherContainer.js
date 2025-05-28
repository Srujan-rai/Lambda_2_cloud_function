import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core';
import { Dialog, Paper, Tab, Tabs } from '@material-ui/core';
import { Add as AddIcon, HighlightOff as HighlightOffIcon } from '@material-ui/icons';
import LanguagePicker from '../components/LanguagePicker';
import { supportedLanguagesMap } from '../constants/lists';

const propTypes = {
    /** Ordinal value pointing to the language tab that should be selected */
    tab: PropTypes.number,
    /** Map of languages that should be displayed via tabs - {"en-GB": "English (United Kingdom)", "de-ch": "German (Switzerland)"} */
    languagesMap: PropTypes.object.isRequired,
    /** Function that handles new language being added - add new tab */
    onNewLanguageAdded: PropTypes.func.isRequired,
    /** Function that handles selection of new language tab */
    onLanguageTabChange: PropTypes.func.isRequired,
    /** Function that handles language removal - delete tab */
    onLanguageRemove: PropTypes.func.isRequired,
    /** @ignore */
    classes: PropTypes.object.isRequired
};

const defaultProps = {
    tab: 0
};

const styles = {
    removeIcon: {
        position: "absolute",
        top: "0",
        right: "0"
    }
};

/** Generic language switcher component composed of language tabs. Operations: add new language, remove language and switch between languages.
 *  Beside internal logic, can be used from parent component to handle different functionalities as per parent component needs(descriptions in callback functions).
 *  Behaviour is described via callback functions passed as props, thus aiming both scopes.
 */
class LanguageSwitcherContainer extends Component {
    state = {
        displayLanguagePicker: false
    };

    handleLanguageCancel = () => {
        this.setState({
            displayLanguagePicker: false
        });
    };

    handleNewLanguage = language => {
        this.setState({
            displayLanguagePicker: false
        });
        const { onNewLanguageAdded } = this.props;
        onNewLanguageAdded(language);
    };

    handleLanguageTabChange = (event, value) => {
        const { languagesMap, onLanguageTabChange } = this.props;
        if (value === Object.entries(languagesMap).length) {
            this.setState({
                displayLanguagePicker: true
            });
        } else {
            onLanguageTabChange(event, value);
        }
    };

    render () {
        const { classes, languagesMap, tab, onLanguageRemove } = this.props;
        return (
            <Fragment>
                <Paper square>
                    <Tabs
                        value={tab}
                        indicatorColor="primary"
                        textColor="primary"
                        onChange={this.handleLanguageTabChange}
                    >
                        {Object.entries(languagesMap).map(([languageKey, languageName], index, languages) =>
                            (index || languages.length > 1) && languageKey != this.props.defaultLanguage ?
                            <Tab
                                key={index}
                                label={languageName}
                                icon={<span className={classes.removeIcon} onClick={event => onLanguageRemove(event, languageKey)}><HighlightOffIcon /></span>}
                            /> :
                            <Tab key={index} label={languageName} />
                        )}
                        <Tab label="Add New Language" icon={<AddIcon />} />
                    </Tabs>
                </Paper>
                <Dialog open={this.state.displayLanguagePicker}>
                    <LanguagePicker
                        languages={Object.values(supportedLanguagesMap)}
                        onSelected={this.handleNewLanguage}
                        onCancel={this.handleLanguageCancel} />
                </Dialog>     
            </Fragment>
        );
    }
}

LanguageSwitcherContainer.propTypes = propTypes;
LanguageSwitcherContainer.defaultProps = defaultProps;

export default withStyles(styles)(LanguageSwitcherContainer);