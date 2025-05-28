import React, { Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { compose } from 'lodash/fp';
import Notification from '../components/Notification/Notification';
import { CheckCircle as CheckCircleIcon, Warning as WarningIcon, Error as ErrorIcon, Info as InfoIcon } from '@material-ui/icons';
import theme from '../theme';
import { hideNotification } from '../redux/ui/actions';

const propTypes = {
    classes: PropTypes.object.isRequired
};

const styles = (theme) => ({});

class NotificationContainer extends Component {
    timeOut;

    determineInfo = type => {
        switch (type) {
            case "SUCCESS":
                return {
                    color: theme.status.success[500],
                    icon: <CheckCircleIcon />
                };
            case "INFO":
                return {
                    color: theme.status.secondary[300],
                    icon: <InfoIcon />
                };
            case "ERROR":
                return {
                    color: theme.status.error[600],
                    icon: <ErrorIcon />
                };
            case "WARNING":
                return {
                    color: theme.status.warning[700],
                    icon: <WarningIcon />
                };
            default:
                return null;
        }
    }

    componentDidUpdate = (prevProps) => {
        if (this.props.visible && this.props.visible !== prevProps.visible) {
            this.automaticHide()
        }
    }

    automaticHide = () => {
        if (!this.props.disableAutoHide) {
            this.timeOut = setTimeout(() => this.props.hide(), 3000);
        }
    }

    hideNotification = () => {
        clearTimeout(this.timeOut)
        this.props.hide();
    }

    render() {
        const info = this.determineInfo(this.props.type);
        return (
            <Notification 
                info={info}
                message={this.props.message} 
                visible={this.props.visible}
                title={this.props.title}
                type={this.props.type}
                disableAutoHide={this.props.disableAutoHide}
                hide={this.hideNotification}
            />
        )
    }
}

NotificationContainer.propTypes = propTypes;

const mapStateToProps = state => ({
    title: state.ui.notification.title,
    message: state.ui.notification.message,
    visible: state.ui.notification.visible,
    type: state.ui.notification.type,
    disableAutoHide: state.ui.notification.disableAutoHide
});

const mapDispatchToProps = dispatch => ({
    hide: () => dispatch(hideNotification())
});

const enhance = compose(
    withStyles(styles),
    connect(mapStateToProps, mapDispatchToProps)
);

export default enhance(NotificationContainer);