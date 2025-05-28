```js
const currencies = [
        {id: "1", name: "Coin", amount: 0},
        {id: "2", name: "Gem", amount: 0},
];

<CurrencyItem
    currencies={currencies}
    currency={currencies[0]}
    onCurrencyChange={() => alert("Currency change detected!")}
    onCurrencyAmountChange={() => alert("Currency amount change detected!")}
/>
```