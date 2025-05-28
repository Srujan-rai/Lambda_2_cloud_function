import React, {Component, Fragment} from 'react';
import { connect } from 'react-redux';
import { changeText, getBlockedConsumer, clearForm } from '../redux/blockingConsumer/actions'
import {compose} from "lodash/fp";
import ConsumerBlockingList from '../components/ConsumerBlockingList/ConsumerBlockingList';
import AppTable from "../components/AppTable";
import {IconButton} from "@material-ui/core";
import ROUTES from "../routes/Routes";
import {Edit as EditIcon} from "@material-ui/icons";

const header = {
    gpp_user_id: "User Id",
    configuration_id: "Configuration Id",
    blocked_timestamp: "Blocked Timestamp",
    entered_by_id: "Enter by Id",
    reason: "Reason",
    requested_by_id: "Request by Id",
    title: "Title",
    unblock: "Unblock"

};
const searchForm = "searchForm";
const blockedConsumerData = "blockedConsumerData";

class ConsumerUnblockingSearchContainer extends Component {

    componentDidMount() {
        const { clearForm } = this.props;
        clearForm(searchForm);
        clearForm(blockedConsumerData);
    }

    handleSearchByIdChange = ( event ) => {
        const { changeText } = this.props;
        const formValue = event.target.value;
        const formName = event.target.name;
        changeText(formValue, formName, searchForm)

    };

    fetchBlockedConsumerByUserId = (event ) => {
        event.preventDefault();
        const userId = this.props.searchByUserId;
        const requestParam = {userId: userId};
        const { getBlockedConsumer } = this.props;
        getBlockedConsumer(requestParam)
    };

    addUnblockedButton = (arrayOfBlockedUser) => {
        const { history }  = this.props;
            return arrayOfBlockedUser.map( user => ({
                    gpp_user_id: user.gpp_user_id,
                    configuration_id: user.configuration_id,
                    blocked_timestamp: user.blocked_timestamp,
                    entered_by_id: user.entered_by_id,
                    requested_by_id: user.requested_by_id,
                    title: user.title,
                    unblock: <IconButton onClick={() => {
                        history.push(ROUTES.consumerBlocking.unblocked({userId: user.gpp_user_id, configurationId: user.configuration_id}))
                    }}>
                        <EditIcon />
                    </IconButton>
            }))
    };

    render() {
        const {blockedConsumerData} = this.props;

        return (
            <Fragment>
                <ConsumerBlockingList
                    textChange={this.handleSearchByIdChange}
                    searchParam={this.props.searchByUserId}
                    onSearch={this.fetchBlockedConsumerByUserId}
                />
                {blockedConsumerData.length > 0 &&
                <AppTable header={header} rows={this.addUnblockedButton(blockedConsumerData)}/>
                }
            </Fragment>)
    }
}

const mapStateToProps = state => ({
   searchByUserId: state.blockingConsumer.searchForm.searchByUserId,
   blockedConsumerData: state.blockingConsumer.blockedConsumerData

});

const mapDispatchToProps = {
    changeText,
    getBlockedConsumer,
    clearForm

};

export default connect(mapStateToProps, mapDispatchToProps)(ConsumerUnblockingSearchContainer)