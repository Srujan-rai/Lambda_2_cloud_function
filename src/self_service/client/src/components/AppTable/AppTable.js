import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import { uniqueId } from 'lodash';
import { Table, TableBody, TableCell, TableHead, TableRow } from '@material-ui/core';
import { Paper } from '@material-ui/core';

const propTypes = {
    /** Table header that representes the array of strings for column names */
    header: PropTypes.object.isRequired,
    /** Generic rows that should be displayed by the table  */
    rows: PropTypes.arrayOf(PropTypes.object),
    /** @ignore */
    classes: PropTypes.object.isRequired
};

const defaultProps = {
    rows: []
};

const styles = theme => ({
    root: {
        width: '100%',
        margin: 'auto',
        marginTop: theme.spacing.unit * 3,
        overflowX: 'auto'
    },
    table: {
        minWidth: 700
    }
});

/** Generic table that has columns defined by header(object) and rows populated by using rows prop. */
const AppTable = ({ classes, header, rows }) => {
    return (
        <Paper className={classes.root}>
            <Table className={classes.table}>
                <TableHead>
                    <TableRow>
                        {Object.values(header).map((column, index) => <TableCell key={uniqueId()} align={index === 0 ? "left" : "right"}>{column}</TableCell>)}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rows.map( row => {
                            return(<TableRow key={uniqueId()} hover>
                                {Object.keys(header).map( (columnHeader, index) => {
                                    if (index === 0){
                                        return <TableCell key={uniqueId()} component="th" scope="row">{row[columnHeader]}</TableCell>
                                    }
                                    return <TableCell key={uniqueId()} align="right">{row[columnHeader]}</TableCell>
                                })}
                            </TableRow>)
                        }
                    )}
                </TableBody>
            </Table>
        </Paper>
    );
};

AppTable.propTypes = propTypes;
AppTable.defaultProps = defaultProps;

export default withStyles(styles)(AppTable);