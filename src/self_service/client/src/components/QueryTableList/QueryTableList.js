import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { withStyles, Button } from '@material-ui/core';
import AppTable from '../AppTable';
import { CSVLink } from "react-csv";

const propTypes = {
    /** Table header for prize catalogue columns */
    header: PropTypes.arrayOf(PropTypes.string).isRequired,
    /** Prize catalogue items that should be displayed by the table  */
    rows: PropTypes.arrayOf(PropTypes.object),
    /** @ignore */
    classes: PropTypes.object.isRequired
};

const defaultProps = {};

const styles = {
    button: {
        marginLeft: '65px'
    },
    link: {
        color: "#ffffff"
    },
    hr: {
        border: '0',
        height: '1px',
        backgroundImage: 'linear-gradient(to right, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0))'
    }
};

const QueryTableList = ({ header, rows, classes }) => {
    return (
        <Fragment>
            <hr className={classes.hr}/>
            <Button variant="contained" color="primary" className={classes.button}>
                <CSVLink
                    headers={Object.keys(header)}
                    data={rows}
                    filename={"self-service-query-table.csv"}
                    className={`${classes.link}`}
                    target="_blank"
                >
                Download as CSV
                </CSVLink>
            </Button>
            <AppTable header={header} rows={rows} />
        </Fragment>
    );
};

QueryTableList.propTypes = propTypes;
QueryTableList.defaultProps = defaultProps;

export default withStyles(styles)(QueryTableList);
