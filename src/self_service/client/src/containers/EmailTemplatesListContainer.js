import React, { Component, Fragment } from 'react';
import {Avatar, IconButton, withStyles} from '@material-ui/core';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';
import { compose } from 'lodash/fp';
import { Chip } from '@material-ui/core';
import { getEmailTemplatesRequest, emptyEmailTemplates } from '../redux/emailTemplate/actions';
import EmailTemplatesList from '../components/EmailTemplatesList';
import FloatingActionButton from '../components/FloatingActionButton';
import ROUTES from '../routes/Routes';
import { Edit as EditIcon } from "@material-ui/icons";
import Page from '../components/Page';

const propTypes = {};

const styles = {};

const defaultProps = {};

const header = {
    templateId: "Template Id",
    country: "Country",
    subjectText: "Subject",
    templateName: "Template Name",
    senderEmail: "Sender Email",
    senderName: "Sender Name",
    introductoryText: "introductory Text",
    edit: 'Edit'
};

class EmailTemplatesListContainer extends Component {
    state = {};

    componentDidMount = () => {
        const emptyEmailTemplates = this.props.emptyEmailTemplates;
        emptyEmailTemplates();
        this.fetchEmailTemplates();
    };

    componentWillUnmount = () => {
        const emptyEmailTemplates = this.props.emptyEmailTemplates;
        emptyEmailTemplates();
    };

    fetchEmailTemplates = () => {
        const { getEmailTemplates } = this.props;
        getEmailTemplates();
    };

    renderEmailTemplateItems = () => {
        const { emailTemplates, history} = this.props;
        return emailTemplates.map(item => ({
            templateId: item.template_id,
            country: item.country,
            subjectText : item.subject_text,
            templateName: item.template_name,
            senderEmail: item.sender_email,
            senderName: item.sender_name,
            introductoryText : item.introductory_text,
            edit: <IconButton onClick={() => {
                history.push(ROUTES.emailTemplates.edit(item.template_id));
            }}>
                <EditIcon/>
            </IconButton>
        }));
    };

    render() {
        return (
        <Page>
            <Fragment >
                <Chip
                    avatar={<Avatar>ET</Avatar>}
                    label="Email templates"
                    color="primary"
                />
                <EmailTemplatesList
                    header={header}
                    rows={this.renderEmailTemplateItems()}
                />
                <Link to={`${ROUTES.emailTemplates.add}`}>
                    <FloatingActionButton title="Add New Template" color="primary" label="Add" />
                </Link>
            </Fragment>
        </Page>
        );
    };
};

EmailTemplatesListContainer.propTypes = propTypes;
EmailTemplatesListContainer.defaultProps = defaultProps;

const mapStateToProps = state => ({
    emailTemplates: state.emailTemplates.emailTemplates
});

const mapDispatchToProps = dispatch => ({
    getEmailTemplates: () => dispatch(getEmailTemplatesRequest()),
    emptyEmailTemplates: () => dispatch(emptyEmailTemplates())
});

const enhance = compose(
    withStyles(styles),
    connect(mapStateToProps, mapDispatchToProps)
);

export default enhance(EmailTemplatesListContainer);