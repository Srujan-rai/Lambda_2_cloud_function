import React, { Component, Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { connect } from 'react-redux';
import { compose } from 'lodash/fp';
import { Paper } from '@material-ui/core';
import { textInputChange, selectChange, clearForm, showNotification } from '../redux/ui/actions';
import { queryTableResultRequest } from '../redux/analysisQueryTable/actions';
import QueryTableForm from '../components/QueryTableForm';
import QueryTableList from '../components/QueryTableList';
import { QUERY_TABLE_FORM } from '../constants/forms';
import { analysisFlowMap } from '../constants/lists';

const propTypes = {
    classes: PropTypes.object.isRequired
};

const styles = {};

class QueryTableContainer extends Component {
    handleFormSubmit = event => {
        event.preventDefault();
        const data = this.generateQueryRequestBody(this.props.queryTableFormState);
        const { queryTable } = this.props;
        queryTable(data);
    }

    generateQueryRequestBody = config => {
        let queryObject = {
            flowLabel: analysisFlowMap[config.table],
            analysisLambdaFlowParams: {
                queryParams: config.queryProps.replace(/\s/g, ''),
                queryValues: config.queryValues.replace(/\s/g, '')
            }
        };

        return queryObject;
    }

    handleTextInputChange = event => {
        const { changeText } = this.props;
        changeText(event, QUERY_TABLE_FORM);
    }

    handleSelectChange = event => {
        const { changeSelect } = this.props;
        changeSelect(event, QUERY_TABLE_FORM);
    }

    render() {
        const { queryTableResult, queryTableFormState, queryTableColumns } = this.props;
        return (
            <Fragment>
                <Paper>
                    <QueryTableForm 
                        store={queryTableFormState}
                        onTextInputChange={this.handleTextInputChange}
                        onSelectChange={this.handleSelectChange}
                        onSearch={this.handleFormSubmit}
                    />
                    {queryTableResult.length > 0 &&
                        queryTableColumns &&
                        <QueryTableList
                            header={queryTableColumns}
                            rows={queryTableResult}
                        />
                    }
                </Paper>
            </Fragment>
        );
    }
};

QueryTableContainer.propTypes = propTypes;

const mapStateToProps = state => ({
    queryTableFormState: state.ui[QUERY_TABLE_FORM],
    queryTableResult: state.analysisQueryTable.analysisQueryTableResult,
    queryTableColumns: state.analysisQueryTable.analysisQueryTableColumns
});

const mapDispatchToProps = dispatch => ({
    changeText: (event, source) => {
        dispatch(textInputChange(event, source));
    },
    changeSelect: (event, source) => {
        dispatch(selectChange(event, source));
    },
    notify: ({title, message, type, visible}) => {
        dispatch(showNotification({title, message, type, visible}));
    },
    queryTable: params => {
        dispatch(queryTableResultRequest(params));
    }
});

const enhance = compose(
    withStyles(styles),
    connect(mapStateToProps, mapDispatchToProps)
);

export default enhance(QueryTableContainer);
