import React, { Component } from 'react';
import { BrowserRouter } from 'react-router-dom';
import './App.css';
import { MuiThemeProvider } from '@material-ui/core/styles';
import { CssBaseline } from '@material-ui/core';
import theme from './theme';
import Router from './routes/Router';
import NotificationContainer from './containers/NotificationContainer';
import { authenticateCognito } from './auth/authorizer';
import { getUserRoleRequest } from './redux/authorization/actions';
import { connect } from "react-redux";

const DO_NOT_LOGIN = process.env.REACT_APP_DO_NOT_LOGIN === 'false' ? false : true;

class App extends Component {
    componentDidMount() {
        if (!DO_NOT_LOGIN) {
            authenticateCognito()
                .then(koId => { this.props.getUserRoleRequest(koId) })
                .catch(err => err)
        }
    }

    render() {
        return (
            <BrowserRouter>
                <MuiThemeProvider theme={theme}>
                    <CssBaseline />
                    <Router />
                    <NotificationContainer />
                </MuiThemeProvider>
            </BrowserRouter>
        );
    };
};

const mapDistpatchToProps = { getUserRoleRequest };

export default connect(null, mapDistpatchToProps)(App);