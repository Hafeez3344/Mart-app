'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { useHospital } from '../../context/StoreContext';
import {
  ShoppingCart,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Store,
  UserCheck,
  BadgeDollarSign
} from 'lucide-react';

const QUICK_ROLES = [
  {
    id: 'admin',
    name: 'Super Admin',
    role: 'Full Access & Reports',
    email: 'admin@mart.com',
    color: 'from-indigo-600 to-indigo-800',
    badge: 'Executive'
  },
  {
    id: 'cashier',
    name: 'Head Cashier',
    role: 'Fast POS Checkout',
    email: 'cashier@mart.com',
    color: 'from-emerald-600 to-emerald-800',
    badge: 'Counter 01'
  },
  {
    id: 'manager',
    name: 'Store Manager',
    role: 'Stock & Suppliers',
    email: 'manager@mart.com',
    color: 'from-amber-600 to-amber-800',
    badge: 'Inventory'
  }
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { storeName, tagline } = useHospital();

  const [email, setEmail] = useState('cashier@mart.com');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setErrorMsg('');
    setLoading(true);

    try {
      const res = await login(email, password);
      if (!res.success) {
        setErrorMsg(res.message || 'Invalid credentials. Please try again.');
      }
    } catch (err) {
      setErrorMsg('Login request failed. Ensure backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelect = (roleEmail) => {
    setEmail(roleEmail);
    setPassword('admin123');
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 selection:bg-emerald-500 selection:text-white">
      {/* Background Decorative Rings */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-100/60 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-teal-100/60 rounded-full blur-3xl" />
      </div>

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-4 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-600/20 mb-2">
            <ShoppingCart className="w-8 h-8 stroke-[2.5]" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            {storeName || 'Super Mart'}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm font-medium">
            {tagline || 'Point of Sale & Retail Management System'}
          </p>
        </div>

        {/* Quick Cashier / Staff Selectors */}
        <div className="grid grid-cols-3 gap-2">
          {QUICK_ROLES.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => handleQuickSelect(role.email)}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                email === role.email
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-xs font-bold'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700">
                {role.badge}
              </div>
              <div className="text-xs font-bold truncate mt-0.5 text-slate-900">{role.name}</div>
            </button>
          ))}
        </div>

        {/* Main Login Card */}
        <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xl shadow-slate-200/50">
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Workstation Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cashier@mart.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/15 transition-all shadow-2xs font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Passcode / Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 hover:bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/15 transition-all shadow-2xs font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-xl shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 text-sm transition-all active:scale-[0.98] mt-2"
            >
              {loading ? (
                <span>Authenticating Terminal...</span>
              ) : (
                <>
                  <span>Sign In & Open Register</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-400 flex items-center justify-center gap-2 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Super Mart POS v2.0 • Offline Sync Ready</span>
        </div>
      </div>
    </div>
  );
}
