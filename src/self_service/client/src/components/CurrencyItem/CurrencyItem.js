import React from 'react';
import { IconButton, MenuItem, Select, Typography, withStyles } from '@material-ui/core';
import { TextValidator } from 'react-material-ui-form-validator';
import { Add, Remove } from '@material-ui/icons';

const styles = {
    textField: {
        backgroundColor : "white",
        width:"125px",
        height:"35px",
        paddingTop:"5px",
        borderRadius: "5px",
        boxShadow: "0px 0px 0px 2px #f40000",
        paddingLeft:"5px",
        paddingRight:"5px",
        marginTop:"0px",
        marginLeft:"25px",
        marginBottom:"30px"
    },
    label: {
        maxWidth:"200px",
        marginLeft:"25px",
        marginBottom:"35px",
        display: 'flex',
        flexDirection: "row",
        justify:"flex-start",
        alignItems:"flex-start"
    },
    select: {
        width:"175px",
        marginLeft:"50px",
        color:"black",
        borderRadius: "3px",
        boxShadow: "0px 0px 0px 2px #f40000",
        height:"35px",
        marginBottom:"10px",
        display: 'flex',
        flexDirection: "row",
        justify:"flex-start",
        alignItems:"flex-start",
        paddingLeft:"20px"
    },
    currencyRowContainer:{
        justify:"flex-start",
        alignItems:"flex-start",
        display: 'flex',
        flexDirection: "row"
    },
    iconButton: {
        marginLeft: 5,
        marginTop: -5
    }
};

const CurrencyItem = (props) => {
    const {
        classes, currency, currencies, addCurrency, removeCurrency,
        onCurrencyChange, isLast, hasAvailable
    } = props;

    return (
        <div className={classes.currencyRowContainer}>
            <Select
                value={currency.currencyId}
                onChange={onCurrencyChange}
                className={classes.select}
                name="currencyId"
                displayEmpty
                required
                disableUnderline
                validators={['required']}
                errorMessages={['This field is required']}
            >
                {currencies.map((currency, index) =>
                    <MenuItem value={currency.currencyId} key={index}>
                        <Typography variant="body2" gutterBottom >
                            {currency.name}
                        </Typography>
                    </MenuItem>
                )}
            </Select>
            <TextValidator
                name="amount"
                value={currency.amount}
                className={classes.textField}
                onChange={onCurrencyChange}
                margin="normal"
                required
                type="number"
                validators={['required', 'isNumber', 'isPositive']}
                errorMessages={['This field is required', 'Type must be number!', 'Number must be positive']}
                InputProps={{ disableUnderline: true }}
            />
            <IconButton onClick={isLast && hasAvailable ? addCurrency : removeCurrency}  color="primary" className={classes.iconButton}>
                { isLast && hasAvailable ? <Add fontSize="small" /> : <Remove fontSize="small"/> }
            </IconButton>
        </div>
    );
};

export default withStyles(styles)(CurrencyItem);
