'use client';

import React, { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import { useStore } from '../../context/StoreContext';
import {
  Settings,
  Store,
  Printer,
  DollarSign,
  Receipt,
  Save,
  CheckCircle2,
  RefreshCw,
  Phone,
  Mail,
  MapPin,
  Volume2,
  Sliders,
  ShieldCheck,
  CreditCard,
  Database,
  Download,
  Zap
} from 'lucide-react';

export default function MartSettingsPage() {
  const { refetchSettings } = useStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupResult, setBackupResult] = useState(null);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const [form, setForm] = useState({
    storeName: 'Metro Super Mart & Grocers',
    tagline: 'Fresh Quality Products, Best Daily Prices',
    phone: '+92 300 1234567',
    email: 'info@metromart.pk',
    address: 'Main Commercial Boulevard, Phase 4, City Center',
    taxNumber: 'NTN-5829104-1',
    currencyCode: 'PKR',
    currencySymbol: 'Rs.',
    receiptHeader: 'Thank you for shopping at Metro Super Mart!',
    receiptFooter: 'Items can be exchanged within 7 days with valid receipt.',
    paperWidth: 80,
    enableSound: true,
    enableCashDrawer: true
  });

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/settings');
      if (res.data?.success && res.data.settings) {
        setForm({
          storeName: res.data.settings.storeName || res.data.settings.hospitalName || 'Metro Super Mart & Grocers',
          tagline: res.data.settings.tagline || 'Fresh Quality Products, Best Daily Prices',
          phone: res.data.settings.phone || '+92 300 1234567',
          email: res.data.settings.email || 'info@metromart.pk',
          address: res.data.settings.address || res.data.settings.locationAddress || 'Main Commercial Boulevard',
          taxNumber: res.data.settings.taxNumber || res.data.settings.taxRegistrationNo || 'NTN-5829104-1',
          currencyCode: res.data.settings.currencyCode || 'PKR',
          currencySymbol: res.data.settings.currencySymbol || 'Rs.',
          receiptHeader: res.data.settings.receiptHeader || 'Thank you for shopping with us!',
          receiptFooter: res.data.settings.receiptFooter || 'Items can be exchanged within 7 days with valid receipt.',
          paperWidth: res.data.settings.paperWidth || 80,
          enableSound: res.data.settings.enableSound !== false,
          enableCashDrawer: res.data.settings.enableCashDrawer !== false
        });
      }
    } catch (err) {
      console.error('Fetch settings error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg({ type: '', text: '' });

    try {
      const res = await api.put('/settings', form);
      if (res.data?.success) {
        setMsg({ type: 'success', text: 'Mart settings saved successfully!' });
        refetchSettings();
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update settings.' });
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    setBackupResult(null);
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.createDbBackup) {
        const res = await window.electronAPI.createDbBackup();
        if (res.success) {
          setBackupResult({ type: 'success', text: `Backup created: ${res.fileName} (${(res.sizeBytes / 1024).toFixed(1)} KB)` });
        } else {
          setBackupResult({ type: 'error', text: res.error || 'Backup failed' });
        }
      } else {
        setBackupResult({ type: 'info', text: 'Backups are managed by the main Electron host PC. Running in browser mode.' });
      }
    } catch (e) {
      setBackupResult({ type: 'error', text: e.message });
    } finally {
      setBackupLoading(false);
    }
  };

  const handleTestDrawer = () => {
    if (typeof window !== 'undefined' && window.electronAPI?.openCashDrawer) {
      window.electronAPI.openCashDrawer();
    } else {
      alert('Cash drawer trigger is available on the Electron host terminal.');
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Settings className="w-6 h-6 text-emerald-600" />
                <span>Mart Store & Hardware Settings</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure mart identity, currency, receipt branding, and ESC/POS thermal printers
              </p>
            </div>

            <button
              onClick={fetchSettings}
              className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 border border-slate-200 shadow-xs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {msg.text && (
            <div
              className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                msg.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{msg.text}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            {/* Store Identity */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Store className="w-4 h-4 text-emerald-600" />
                <span>Store Identity & Business Profile</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mart / Supermarket Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.storeName}
                    onChange={(e) => setForm({ ...form, storeName: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Store Slogan / Tagline
                  </label>
                  <input
                    type="text"
                    value={form.tagline}
                    onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Phone Number
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Business Email
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Physical Store Address
                  </label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    NTN / Tax Registration Number
                  </label>
                  <input
                    type="text"
                    value={form.taxNumber}
                    onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Currency Symbol
                  </label>
                  <input
                    type="text"
                    value={form.currencySymbol}
                    onChange={(e) => setForm({ ...form, currencySymbol: e.target.value })}
                    placeholder="Rs., $, SAR, AED"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Thermal Printer & Receipt Settings */}
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Printer className="w-4 h-4 text-emerald-600" />
                <span>Thermal Printer & Receipt Customization</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Receipt Paper Width
                  </label>
                  <select
                    value={form.paperWidth}
                    onChange={(e) => setForm({ ...form, paperWidth: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  >
                    <option value={80}>80mm (Standard POS Thermal)</option>
                    <option value={58}>58mm (Compact Mobile POS Thermal)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Receipt Header Greeting
                  </label>
                  <input
                    type="text"
                    value={form.receiptHeader}
                    onChange={(e) => setForm({ ...form, receiptHeader: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Receipt Footer Exchange Policy
                  </label>
                  <input
                    type="text"
                    value={form.receiptFooter}
                    onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="enableSound"
                    checked={form.enableSound}
                    onChange={(e) => setForm({ ...form, enableSound: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="enableSound" className="text-xs text-slate-300 cursor-pointer">
                    Enable Barcode Scanner Audio Beep
                  </label>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="enableDrawer"
                    checked={form.enableCashDrawer}
                    onChange={(e) => setForm({ ...form, enableCashDrawer: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="enableDrawer" className="text-xs text-slate-300 cursor-pointer">
                    Auto-Kick Cash Drawer on Cash Sale
                  </label>
                </div>
              </div>
            </div>

            {/* Database Backup & Hardware Testing */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <Database className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Database Backup & Hardware Testing</h3>
                  <p className="text-xs text-slate-400">PostgreSQL automated snapshot and POS hardware pulse</p>
                </div>
              </div>

              {backupResult && (
                <div
                  className={`p-3 rounded-xl text-xs font-semibold ${
                    backupResult.type === 'success'
                      ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                      : backupResult.type === 'error'
                      ? 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
                      : 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-400'
                  }`}
                >
                  {backupResult.text}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleBackup}
                  disabled={backupLoading}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-md transition-all active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>{backupLoading ? 'Creating Backup...' : 'Create Instant DB Backup (.sql)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleTestDrawer}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center gap-2 border border-slate-700 transition-all active:scale-95"
                >
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Test Cash Drawer Pulse</span>
                </button>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold rounded-2xl text-xs shadow-xl shadow-emerald-500/20 flex items-center gap-2 active:scale-95"
              >
                <Save className="w-4 h-4 stroke-[2.5]" />
                <span>{saving ? 'Saving...' : 'Save Mart Settings'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

