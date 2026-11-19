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
        return 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30';
      case 'MANAGER':
        return 'bg-amber-500/10 text-amber-400 border border-amber-500/30';
      case 'CASHIER':
        return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30';
      default:
        return 'bg-slate-500/10 text-slate-300 border border-slate-500/30';
    }
  };

  return (
    <header className="w-full h-16 bg-slate-900 border-b border-slate-800 px-4 md:px-6 flex items-center justify-between shadow-md sticky top-0 z-30 shrink-0 select-none">
      {/* Left: Mobile Toggle & Store Identity */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="md:hidden p-2 rounded-xl text-slate-300 hover:bg-slate-800 border border-slate-700 transition-colors"
          aria-label="Toggle Sidebar"
        >
          {isOpen ? <X className="w-5 h-5 text-rose-400" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 shadow-md flex items-center justify-center shrink-0">
          <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
            <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-extrabold text-white tracking-tight leading-none">
              {storeName || 'Metro Super Mart'}
            </h1>
            <span className="hidden sm:inline-flex px-1.5 py-0.5 text-[10px] font-bold rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              POS v2.0
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium mt-0.5 hidden xs:block">
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
            className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/90 border border-slate-700/80 text-slate-300 text-[11px] font-mono hover:bg-slate-700/80 hover:border-emerald-500/40 transition-all"
          >
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">LAN:</span>
            <span className="text-emerald-300 font-semibold">{lanUrl}</span>
            {copied ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-3 h-3 text-slate-500 hover:text-white" />
            )}
          </button>
        )}

        {/* Quick Launch POS Button */}
        <Link
          href="/pos"
          className="flex items-center gap-2 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-emerald-500/20 transition-all active:scale-95"
        >
          <Zap className="w-3.5 h-3.5 fill-current" />
          <span className="hidden sm:inline">POS Terminal</span>
          <span className="text-[10px] font-mono opacity-80 hidden md:inline">[F1]</span>
        </Link>

        {/* Date Display */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/60 font-medium">
          <Calendar className="w-3.5 h-3.5 text-emerald-400" />
          <span>{todayDateStr}</span>
        </div>

        {/* User Pill & Signout */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs font-bold text-white truncate max-w-[120px]">
              {user?.name || 'Cashier'}
            </span>
            <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded-full self-end ${getRoleBadge(user?.role)}`}>
              {user?.role || 'STAFF'}
            </span>
          </div>

          <button
            onClick={logout}
            title="Sign Out"
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl border border-transparent hover:border-rose-500/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
