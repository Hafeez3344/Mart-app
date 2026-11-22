'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../lib/api';

const StoreContext = createContext();

export function StoreProvider({ children }) {
  const [settings, setSettings] = useState({
    storeName: 'Al Masoom Supar Mart',
    hospitalName: 'Al Masoom Supar Mart', // Compatibility alias
    tagline: 'Fresh Quality Products, Best Daily Prices',
    phone: '+92 300 1234567',
    email: 'info@almasoommart.pk',
    address: 'Main Commercial Boulevard, Phase 4, City Center',
    locationAddress: 'Main Commercial Boulevard, Phase 4, City Center',
    taxNumber: 'NTN-5829104-1',
    taxRegistrationNo: 'NTN-5829104-1',
    currencyCode: 'PKR',
    currencySymbol: 'Rs.',
    receiptHeader: 'Thank you for shopping at Al Masoom Supar Mart!',
    receiptFooter: 'Items can be exchanged within 7 days with valid receipt.',
    paperWidth: 80,
    enableSound: true,
    enableCashDrawer: true
  });
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      if (res.data?.success && res.data?.settings) {
        setSettings({
          ...res.data.settings,
          storeName: res.data.settings.storeName || res.data.settings.hospitalName || 'Al Masoom Supar Mart',
          hospitalName: res.data.settings.storeName || res.data.settings.hospitalName || 'Al Masoom Supar Mart',
          address: res.data.settings.address || res.data.settings.locationAddress || 'Main Commercial Boulevard',
          locationAddress: res.data.settings.address || res.data.settings.locationAddress || 'Main Commercial Boulevard',
          taxNumber: res.data.settings.taxNumber || res.data.settings.taxRegistrationNo || 'NTN-5829104-1',
          taxRegistrationNo: res.data.settings.taxNumber || res.data.settings.taxRegistrationNo || 'NTN-5829104-1'
        });
      }
    } catch (err) {
      console.error('StoreContext fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const value = {
    settings,
    storeName: settings.storeName || 'Al Masoom Supar Mart',
    hospitalName: settings.storeName || 'Al Masoom Supar Mart',
    tagline: settings.tagline || 'Fresh Quality Products, Best Daily Prices',
    phone: settings.phone || '+92 300 1234567',
    email: settings.email || 'info@almasoommart.pk',
    address: settings.address || 'Main Commercial Boulevard, Phase 4, City Center',
    locationAddress: settings.address || 'Main Commercial Boulevard, Phase 4, City Center',
    taxNumber: settings.taxNumber || 'NTN-5829104-1',
    taxRegistrationNo: settings.taxNumber || 'NTN-5829104-1',
    currencyCode: settings.currencyCode || 'PKR',
    currencySymbol: settings.currencySymbol || 'Rs.',
    receiptHeader: settings.receiptHeader || 'Thank you for shopping with us!',
    receiptFooter: settings.receiptFooter || 'Items can be exchanged within 7 days with valid receipt.',
    paperWidth: settings.paperWidth || 80,
    enableSound: settings.enableSound !== false,
    enableCashDrawer: settings.enableCashDrawer !== false,
    refetchSettings: fetchSettings
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const context = useContext(StoreContext);
  if (!context) {
    return {
      storeName: 'Al Masoom Supar Mart',
      hospitalName: 'Al Masoom Supar Mart',
      tagline: 'Fresh Quality Products, Best Daily Prices',
      phone: '+92 300 1234567',
      email: 'info@almasoommart.pk',
      address: 'Main Commercial Boulevard, Phase 4, City Center',
      locationAddress: 'Main Commercial Boulevard, Phase 4, City Center',
      currencySymbol: 'Rs.',
      currencyCode: 'PKR',
      taxNumber: 'NTN-5829104-1',
      taxRegistrationNo: 'NTN-5829104-1',
      paperWidth: 80,
      enableSound: true,
      enableCashDrawer: true,
      refetchSettings: () => {}
    };
  }
  return context;
}

export const useHospital = useStore;
export const useMart = useStore;
export const HospitalProvider = StoreProvider;
export default StoreContext;

