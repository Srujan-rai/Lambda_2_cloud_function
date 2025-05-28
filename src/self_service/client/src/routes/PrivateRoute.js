import React from 'react';
import { Redirect, Route } from 'react-router-dom';
import ROUTES from './Routes';

//TODO Replace this hardcoded basic authentication with the authentication logic from state
const loggedIn = true;

const PrivateRoute = (props) => {
    return loggedIn ? <Route {...props} /> : <Redirect to={ROUTES.login} />;
};

export default PrivateRoute;