import React, { Component } from 'react';
import { connect } from 'react-redux';

const roleMappings = {
    "prizeAuthor": 0,
    "prizeEconomyManager": 1,
    "consumerSupport": 5,
    "prizeManager": 10,
    "promotionManager": 20,
    "promotionAuthor": 30,
    "superUser": 40
};

const DO_NOT_LOGIN = process.env.REACT_APP_DO_NOT_LOGIN ==='false' ? false : true;

class Can extends Component {
    render() {
        const { userRole, roles } = this.props;
        
        if(DO_NOT_LOGIN) {
           return this.props.yes();
        }
        
        if (roles.some(role => userRole === roleMappings[role])) {
            return this.props.yes();
        } else {
            return this.props.no();
        }
    }
};

const mapStateToProps = (state) => ({
    userRole: state.authorization.userRole
});

Can.defaultProps = {
    yes: () => null,
    no: () => null
};


export default connect(mapStateToProps)(Can);