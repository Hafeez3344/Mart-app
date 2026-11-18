'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { useHospital } from '../context/HospitalContext';
import Link from 'next/link';
import { ShoppingCart, Store, ArrowRight, ShieldCheck, Zap, BarChart3, Users, Package } from 'lucide-react';

export default function RootHomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { storeName, tagline } = useHospital();

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (user.role === 'ADMIN' || user.role === 'MANAGER') {
          router.replace('/admin');
        } else {
          router.replace('/pos');
        }
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-center items-center p-6 selection:bg-emerald-500 selection:text-white">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2 shadow-xl shadow-emerald-500/5 animate-pulse">
          <ShoppingCart className="w-12 h-12" />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {storeName || 'Metro Super Mart'}
          </h1>
          <p className="text-slate-400 text-sm">
            {tagline || 'Point of Sale & Inventory Management System'}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>System Initializing... Redirecting to Terminal</span>
        </div>

        <div className="pt-4">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98]"
          >
            <span>Open Cashier Login</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
