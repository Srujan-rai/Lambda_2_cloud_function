import React, { Component, Fragment } from 'react';
import { Redirect } from 'react-router-dom';

import { connect } from 'react-redux';

import { showNotification, hideNotification, clearAll } from '../redux/ui/actions';
import Search from '../components/Search';
import ROUTES from '../routes/Routes';

import api from '../api';

class SearchEmailTemplatesContainer extends Component {
    state = {
        templateId: "",
        redirect: false
    }

    componentDidMount = () => {
        window.onbeforeunload = () => { this.clearForm(); }
    }

    componentWillUnmount() {
        this.clearForm();
        window.onbeforeunload = null;
    }

    clearForm () {
        const { hideNotifyD } = this.props;
        hideNotifyD();
    }

    _handleOnChange = ({ target }) => {
        const { value } = target;

        if (value.length === 6) {
            this.clearForm();
        }
        this.setState({
            templateId: target.value
        })
    }

    _handleOnSearch = () => {
        const { templateId } = this.state;
        const { notifyD } = this.props;

        if (templateId.length < 5) {
            notifyD({
                type: "ERROR",
                visible: true,
                title: "Email Templates Search",
                message: "Please fill template Id."
            });
            return;
        }

        api.emailTemplates.get(templateId)
            .then(data => {
                this.clearForm();
                this.setState({ redirect: true });
            }).catch(err => {
                const { notifyD } = this.props;
                notifyD({
                    type: "ERROR",
                    visible: true,
                    title: "Email Templates Search",
                    message: "Missing template Id."
                });
            })
    }

    render() {
        const { templateId, redirect } = this.state;
        if (redirect) {
            return <Redirect to={ROUTES.emailTemplates.edit(templateId)} />
        }

        return (
            <Fragment>
                <Search
                    acronym="ET"
                    headline="Email Templates"
                    searchId="Template Id"
                    value={this.state.templateId}
                    onTextInputChange={this._handleOnChange}
                    onSearch={this._handleOnSearch} />
            </Fragment>
        );
    }
}

const mapDispatchToProps = dispatch => ({
    notifyD: ({ title, message, type, visible }) => {
        dispatch(showNotification({ title, message, type, visible }));
    },
    clearAllD: (formName) => {
        dispatch(clearAll(formName));
    },
    hideNotifyD: () => {
        dispatch(hideNotification());
    }
});

export default connect(null, mapDispatchToProps)(SearchEmailTemplatesContainer); ;
