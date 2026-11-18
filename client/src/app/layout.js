import React from 'react';
import localFont from 'next/font/local';
import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import { CurrencyProvider } from '../context/CurrencyContext';
import { HospitalProvider } from '../context/HospitalContext';
import { SidebarProvider } from '../context/SidebarContext';
import ReduxProvider from '../store/ReduxProvider';

const outfit = localFont({
  src: [
    {
      path: '../../fonts/Outfit-Light.ttf',
      weight: '300',
      style: 'normal',
    },
    {
      path: '../../fonts/Outfit-Regular.ttf',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../fonts/Outfit-Medium.ttf',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../fonts/Outfit-SemiBold.ttf',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../fonts/Outfit-Bold.ttf',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../../fonts/Outfit-Bold.ttf',
      weight: '800',
      style: 'normal',
    },
    {
      path: '../../fonts/Outfit-Bold.ttf',
      weight: '900',
      style: 'normal',
    },
  ],
  variable: '--font-outfit',
  display: 'swap',
  preload: true,
  fallback: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
});

export const metadata = {
  title: 'Metro Super Mart - Modern Point of Sale (POS)',
  description: 'High-Performance Supermarket & Retail Point of Sale (POS) and Inventory Management System'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={outfit.variable} suppressHydrationWarning>
      <body className={`${outfit.className} font-sans bg-slate-950 text-white antialiased`} suppressHydrationWarning>
        <ReduxProvider>
          <AuthProvider>
            <CurrencyProvider>
              <HospitalProvider>
                <SidebarProvider>
                  {children}
                </SidebarProvider>
              </HospitalProvider>
            </CurrencyProvider>
          </AuthProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
