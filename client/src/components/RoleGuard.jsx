'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft, ShoppingCart } from 'lucide-react';
import Link from 'next/link';

export default function RoleGuard({ allowedRoles = ['ADMIN'], children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const userRole = (user?.role || 'CASHIER').toUpperCase();
  const isAllowed = userRole === 'ADMIN' || allowedRoles.includes(userRole);

  if (!isAllowed) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] p-6 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mb-4 shadow-sm">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-slate-900 mb-1">
          Access Restricted
        </h2>
        <p className="text-xs text-slate-500 max-w-md mb-6 leading-relaxed">
          This section is reserved for <strong>{allowedRoles.join(' or ')}</strong> personnel only. Your current account role is <span className="font-bold text-rose-600 uppercase">[{userRole}]</span>.
        </p>

        <div className="flex items-center gap-3">
          <Link
            href="/pos"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 transition-all"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Go to POS Terminal</span>
          </Link>
          <button
            onClick={() => router.back()}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Go Back</span>
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
