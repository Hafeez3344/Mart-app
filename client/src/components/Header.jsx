'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { useSidebar } from '../context/SidebarContext';
import {
  ShoppingCart,
  Store,
  Calendar,
  Sparkles,
  Menu,
  X,
  User as UserIcon,
  LogOut,
  Zap,
  Printer,
  Wifi,
  Copy,
  Check
} from 'lucide-react';

export default function Header() {
  const { user, logout } = useAuth();
  const { storeName, tagline } = useStore();
  const { isOpen, toggleSidebar } = useSidebar();
  const [lanUrl, setLanUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // If running inside Electron, get LAN info via IPC
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.getLanInfo().then((res) => {
        if (res?.serverUrl) setLanUrl(res.serverUrl);
      }).catch(() => {});
    } else {
      // Fallback: fetch from API
      fetch('http://localhost:5000/api/settings/lan')
        .then(r => r.json())
        .then(data => {
          if (data?.accessUrl) setLanUrl(data.accessUrl);
        })
        .catch(() => {});
    }
  }, []);

  const copyLanUrl = () => {
    if (!lanUrl) return;
    navigator.clipboard.writeText(lanUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const todayDateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

  const getRoleBadge = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-indigo-50 text-indigo-700 border border-indigo-200';
      case 'MANAGER':
        return 'bg-amber-50 text-amber-700 border border-amber-200';
      case 'CASHIER':
        return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border border-slate-200';
    }
  };

  return (
    <header className="w-full h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between shadow-xs sticky top-0 z-30 shrink-0 select-none">
      {/* Left: Mobile Toggle & Store Identity */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
          aria-label="Toggle Sidebar"
        >
          {isOpen ? <X className="w-5 h-5 text-rose-600" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-sm shadow-emerald-600/20 flex items-center justify-center text-white shrink-0">
          <ShoppingCart className="w-5 h-5 stroke-[2.5]" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-none">
              {storeName || 'Super Mart'}
            </h1>
            <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-black rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              POS v2.0
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium mt-0.5 hidden xs:block">
            {tagline || 'Point of Sale & Inventory'}
          </p>
        </div>
      </div>

      {/* Right: Quick POS Button, Date & User Session */}
      <div className="flex items-center gap-2.5 sm:gap-4">
        {/* LAN Access Badge */}
        {lanUrl && (
          <button
            onClick={copyLanUrl}
            title="Click to copy Counter / LAN URL for other computers"
            className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-[11px] font-mono hover:bg-slate-100 hover:border-emerald-400 transition-all shadow-2xs"
          >
            <Wifi className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-slate-400">LAN:</span>
            <span className="text-slate-800 font-bold">{lanUrl}</span>
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400 hover:text-slate-700" />
            )}
          </button>
        )}

        {/* Quick Launch POS Button */}
        <Link
          href="/pos"
          className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-95"
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span className="hidden sm:inline">POS Terminal</span>
          <span className="text-[10px] font-mono bg-emerald-800/60 px-1 py-0.2 rounded hidden md:inline">F1</span>
        </Link>

        {/* Date Display */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200 font-semibold shadow-2xs">
          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
          <span>{todayDateStr}</span>
        </div>

        {/* User Pill & Signout */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-bold text-slate-900 truncate max-w-[120px]">
              {user?.name || 'Cashier'}
            </span>
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-full self-end ${getRoleBadge(user?.role)}`}>
              {user?.role || 'CASHIER'}
            </span>
          </div>

          <button
            onClick={logout}
            title="Sign Out"
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-200 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
