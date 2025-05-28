import React from "react";
import { Button, withStyles } from "@material-ui/core";

import CurrencyItem from "../CurrencyItem";
import { isEmpty } from "lodash";


const styles = {
    button: {
        color: "white",
        marginTop: -10,
        marginLeft: 50,
        marginBottom: 10,
        backgroundColor: "#f40000"
    }
};

const randomInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1) + min);
};

const CurrencyList = ({ classes, currencies, onCurrencyChange, onCostItemAddition, onCostItemRemoval, cost }) => {
    const filteredCosts = cost.filter(item => !isEmpty(item));
    const selectedCurrencies = filteredCosts.map(item => item.currencyId);
    const availableCurrencies = currencies.filter(value => !selectedCurrencies.includes(value.currencyId));
    const randomCurrency = availableCurrencies[randomInt(0, availableCurrencies.length - 1)];

    return (
        <div style={{ marginTop: 20 }}>
            {(isEmpty(filteredCosts) && !isEmpty(randomCurrency)) && (
                <Button variant="contained" className={classes.button} onClick={() => onCostItemAddition(randomCurrency)}>
                    Add Currency To Cost
                </Button>
            )}
            {filteredCosts.map((item, index) => (
                <CurrencyItem
                    key={index}
                    currency={item}
                    addCurrency={() => onCostItemAddition(randomCurrency)}
                    removeCurrency={() => onCostItemRemoval(item)}
                    currencies={currencies.filter(value => value.currencyId === item.currencyId || !selectedCurrencies.includes(value.currencyId))}
                    onCurrencyChange={event => onCurrencyChange(event, index)}
                    hasAvailable={availableCurrencies.length > 0}
                    isLast={index === cost.length - 1}
                />
            ))}
        </div>
    );
};

export default withStyles(styles)(CurrencyList);
