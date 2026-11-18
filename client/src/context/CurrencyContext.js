'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const CurrencyContext = createContext();

export const CurrencyProvider = ({ children }) => {
  // Default currency is PKR (Rs.)
  const [currency, setCurrency] = useState('PKR');
  const [symbol, setSymbol] = useState('Rs. ');

  useEffect(() => {
    const savedCurrency = localStorage.getItem('hms_currency');
    if (savedCurrency) {
      changeCurrency(savedCurrency);
    }
  }, []);

  const changeCurrency = (code) => {
    setCurrency(code);
    localStorage.setItem('hms_currency', code);
    switch (code) {
      case 'PKR':
        setSymbol('Rs. ');
        break;
      case 'USD':
        setSymbol('$');
        break;
      case 'EUR':
        setSymbol('€');
        break;
      case 'GBP':
        setSymbol('£');
        break;
      default:
        setSymbol('Rs. ');
    }
  };

  const formatAmount = (amount) => {
    const num = Number(amount) || 0;
    return `${symbol}${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  return (
    <CurrencyContext.Provider value={{ currency, symbol, changeCurrency, formatAmount }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);
