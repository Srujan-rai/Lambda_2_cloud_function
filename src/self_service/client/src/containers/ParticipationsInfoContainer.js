import React, { Component } from 'react';
import { connect } from 'react-redux';
import { compose } from 'lodash/fp';
import { Button, Paper } from '@material-ui/core';
import { textInputChange, clearForm } from '../redux/ui/actions';
import { queryParticipationResultRequest, emptyParticipations } from '../redux/participationQuery/actions';
import { QueryParticipationForm } from '../components/getParticipationForm';
import { PARTICIPATION_TABLE_FORM } from '../constants/forms';
import AppTable from '../components/AppTable';
import { withRouter } from "react-router-dom";
import { parse as parseCSV } from "json2csv";
import { parse } from "querystring";
import { CSVLink } from "react-csv";
import { camelCase } from "lodash";

const getSearchParam = url => {
    const { type } = parse(url.search.slice(1));
    return camelCase(type);
};

const flowMapping = {
  configurationId: "getByConfigId",
  userId: "getByUserId",
  pincode: "get",
  digitalVoucher: "getByVoucher"
};

class ParticipationsInfoContainer extends Component {
    componentDidMount() {
        this.props.clearForm(PARTICIPATION_TABLE_FORM);
        this.props.emptyParticipations();
    };

    handleTextInputChange = event => {
        const target = { value: event.target.value, name: event.target.name };
        this.props.changeText({ target }, PARTICIPATION_TABLE_FORM);
    };

    handleFormSubmit = event => {
        event.preventDefault();
        const searchParam = getSearchParam(this.props.location);

        const data = {};
        data["method"] = flowMapping[searchParam];
        data[searchParam] = this.props.participationTableFormState[searchParam];
        
        this.props.queryParticipation(data);
    };

    renderParticipationItems = () => {
        const { participationQueryTableColumns, participationQueryResult } = this.props;
        const columnsKeys = Object.keys(participationQueryTableColumns);

        return participationQueryResult.map(item => {
            const newItem = {};

            columnsKeys.forEach(key => {
                if (key === 'participation_time') {
                    newItem[key] = new Date(+item[key]).toUTCString();
                } else if (typeof item[key] === 'object' || Array.isArray(item[key])) {
                    newItem[key] = JSON.stringify(item[key]);
                } else {
                    newItem[key] = item[key] === true ? "yes" : item[key];
                }
            });

            return newItem;
        });
    };

    render() {
        const {
            location: url,
            participationTableFormState,
            participationQueryTableColumns,
            participationQueryResult
        } = this.props;

        return (
          <Paper>
            <QueryParticipationForm
                searchParam={getSearchParam(url)}
                store={participationTableFormState}
                onTextInputChange={this.handleTextInputChange}
                onSearch={this.handleFormSubmit}
            />
            {participationQueryResult.length > 0 && (
                <div style={{ padding: "1rem" }}>
                    <AppTable
                        header={participationQueryTableColumns}
                        rows={this.renderParticipationItems()}
                    />
                    <Button variant="contained" color="primary" style={{ marginTop: "1rem" }}>
                        <CSVLink
                            data={parseCSV(participationQueryResult)}
                            header={Object.keys(participationQueryTableColumns)}
                            filename={`participations-${new Date().getTime()}.csv`}
                            style={{ color: "white" }}
                            target="_blank"
                        >
                            Export CSV
                        </CSVLink>
                    </Button>
                </div>
            )}
          </Paper>
        );
    }
};

const mapStateToProps = state => ({
    participationTableFormState: state.ui.participationTableForm,
    participationQueryResult: state.participationQuery.participationQueryTableResult,
    participationQueryTableColumns: state.participationQuery.participationQueryTableColumns
});

const mapDispatchToProps = {
    queryParticipation: queryParticipationResultRequest,
    changeText: textInputChange,
    emptyParticipations,
    clearForm
};

const enhance = compose(withRouter, connect(mapStateToProps, mapDispatchToProps));
export default enhance(ParticipationsInfoContainer);