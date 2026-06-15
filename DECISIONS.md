# Project Decisions

## Currency Conversion

- USD expenses use a fixed historical exchange rate of `83.5` INR per USD.
- Manual expense entry stores the original `amount` and `currency`, plus `amountInr` and `exchangeRate`.
- Balance and split calculations use `amountInr` so totals stay stable over time.
