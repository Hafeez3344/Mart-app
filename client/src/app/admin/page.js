'use client';

import React, { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import RoleGuard from '../../components/RoleGuard';
import Link from 'next/link';
import api from '../../lib/api';
import { printThermalMartReceipt } from '../../lib/thermalPrint';
import { useStore } from '../../context/StoreContext';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Truck,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Receipt,
  Plus,
  ArrowRight,
  RefreshCw,
  Printer,
  Zap,
  CreditCard,
  Banknote,
  QrCode,
  ShieldCheck
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { storeName, address, phone, currencySymbol } = useStore();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const AnimatedNumber = ({ value = 0 }) => {
    const target = Number(value) || 0;
    const [display, setDisplay] = useState(0);

    useEffect(() => {
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setDisplay(target);
        return;
      }
      let frameId;
      const duration = 450;
      const start = performance.now();
      const from = 0;

      const tick = (now) => {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const nextVal = from + (target - from) * eased;
        setDisplay(Number.isInteger(target) ? Math.round(nextVal) : Number(nextVal.toFixed(2)));
        if (progress < 1) {
          frameId = requestAnimationFrame(tick);
        }
      };

      frameId = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frameId);
    }, [target]);

    return <>{display}</>;
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/dashboard');
      if (res.data?.success) {
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error('Fetch admin stats error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <RoleGuard allowedRoles={['ADMIN']}>
      <div className="space-y-6">
          {/* Header Title & Shortcuts */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <LayoutDashboard className="w-6 h-6 text-emerald-600" />
                <span>Mart Executive Overview</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time supermarket sales, cashier checkouts, inventory health, and store analytics
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchStats}
                disabled={loading}
                className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 border border-slate-200 shadow-xs transition-all duration-200 active:scale-95 disabled:opacity-70"
                title="Refresh Analytics"
              >
                <RefreshCw className={`w-4 h-4 transition-transform duration-300 ${loading ? 'animate-spin text-emerald-600' : 'hover:rotate-90'}`} />
              </button>

              <Link
                href="/pos"
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs flex items-center gap-2 shadow-md shadow-emerald-600/20 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-600/30 active:scale-95 transition-all duration-200 group"
              >
                <Zap className="w-4 h-4 fill-current transition-transform duration-200 group-hover:scale-110" />
                <span>Launch POS Terminal</span>
              </Link>
            </div>
          </div>

          {/* 4 Core Stat Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Today's Sales Revenue */}
            <div
              style={{ animationDelay: '0ms' }}
              className="animate-dash-up group p-4 rounded-3xl bg-white border border-slate-200 flex items-center justify-between shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-emerald-200"
            >
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Today's Net Revenue
                </div>
                <div className="text-2xl font-black font-mono text-emerald-700">
                  {currencySymbol} <AnimatedNumber value={stats?.totalRevenueToday || 0} />
                </div>
                <div className="text-[10px] text-slate-500 font-semibold">
                  {stats?.ordersTodayCount || 0} Orders Processed
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            {/* Gross Profit Today */}
            <div
              style={{ animationDelay: '60ms' }}
              className="animate-dash-up group p-4 rounded-3xl bg-white border border-slate-200 flex items-center justify-between shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-indigo-200"
            >
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Gross Margin Today
                </div>
                <div className="text-2xl font-black font-mono text-indigo-700">
                  {currencySymbol} <AnimatedNumber value={stats?.grossProfitToday || 0} />
                </div>
                <div className="text-[10px] text-slate-500 font-semibold">
                  Sales minus Purchase Cost
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            {/* Total Active SKUs */}
            <div
              style={{ animationDelay: '120ms' }}
              className="animate-dash-up group p-4 rounded-3xl bg-white border border-slate-200 flex items-center justify-between shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-amber-200"
            >
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Active Products
                </div>
                <div className="text-2xl font-black text-slate-900">
                  <AnimatedNumber value={stats?.totalProducts || 0} />
                </div>
                <div className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                  <AlertTriangle className={`w-3 h-3 ${stats?.lowStockCount > 0 ? 'animate-pulse' : ''}`} />
                  <span>{stats?.lowStockCount || 0} Low Stock Alerts</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
                <Package className="w-6 h-6" />
              </div>
            </div>

            {/* Customer Khata Dues */}
            <div
              style={{ animationDelay: '180ms' }}
              className="animate-dash-up group p-4 rounded-3xl bg-white border border-slate-200 flex items-center justify-between shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-rose-200"
            >
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  Customer Dues (Khata)
                </div>
                <div className="text-2xl font-black font-mono text-rose-600">
                  {currencySymbol} <AnimatedNumber value={stats?.totalCustomerDues || 0} />
                </div>
                <div className="text-[10px] text-slate-500 font-semibold">
                  Across {stats?.totalCustomers || 0} Registered Customers
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Quick Shortcuts Bar */}
          <div style={{ animationDelay: '220ms' }} className="animate-dash-up grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Link
              href="/pos"
              className="p-3.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 flex items-center gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] group shadow-xs"
            >
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white group-hover:scale-110 transition-all duration-200">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">POS Terminal</div>
                <div className="text-[10px] text-slate-500">Barcode checkout</div>
              </div>
            </Link>

            <Link
              href="/products"
              className="p-3.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 flex items-center gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] group shadow-xs"
            >
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white group-hover:scale-110 transition-all duration-200">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Add Product</div>
                <div className="text-[10px] text-slate-500">Manage catalog</div>
              </div>
            </Link>

            <Link
              href="/purchases"
              className="p-3.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 flex items-center gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] group shadow-xs"
            >
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white group-hover:scale-110 transition-all duration-200">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Stock-In Purchase</div>
                <div className="text-[10px] text-slate-500">Receive goods</div>
              </div>
            </Link>

            <Link
              href="/register"
              className="p-3.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 flex items-center gap-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98] group shadow-xs"
            >
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white group-hover:scale-110 transition-all duration-200">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">Cash Drawer</div>
                <div className="text-[10px] text-slate-500">Shift audits</div>
              </div>
            </Link>
          </div>

          {/* 7-Day Revenue Trend & Payment Methods Breakdown */}
          <div style={{ animationDelay: '280ms' }} className="animate-dash-up grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Weekly Trend Bar Cards */}
            <div className="lg:col-span-2 p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-xs transition-shadow duration-200 hover:shadow-md">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>7-Day Sales Performance</span>
                </h3>
              </div>

              {/* Simple Responsive Bar Chart */}
              <div className="h-44 flex items-end justify-between gap-2 pt-6 px-2">
                {stats?.weeklyTrends?.map((day, idx) => {
                  const maxRev = Math.max(...(stats.weeklyTrends.map(t => t.revenue) || [1]), 1000);
                  const heightPercent = Math.max(10, Math.round((day.revenue / maxRev) * 100));

                  return (
                    <div key={idx} className="group/bar flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <div className="text-[10px] font-mono text-emerald-700 font-bold truncate transition-transform duration-200 group-hover/bar:-translate-y-0.5">
                        {currencySymbol}{day.revenue}
                      </div>
                      <div
                        style={{
                          height: `${heightPercent}%`,
                          animationDelay: `${idx * 55}ms`
                        }}
                        className="animate-bar-grow w-full max-w-[40px] rounded-t-xl bg-gradient-to-t from-emerald-600 to-teal-400 transition-all duration-200 group-hover/bar:brightness-110 group-hover/bar:scale-x-105 shadow-md shadow-emerald-500/10"
                      />
                      <span className="text-[10px] text-slate-500 font-medium truncate max-w-[50px] transition-colors group-hover/bar:text-slate-900">
                        {day.day.split(',')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment Modes Today */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200 space-y-4 shadow-xs transition-shadow duration-200 hover:shadow-md">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-600" />
                <span>Today's Payment Modes</span>
              </h3>

              <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs transition-all duration-150 hover:bg-slate-100/80 hover:translate-x-0.5">
                  <span className="flex items-center gap-2 text-slate-700">
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    <span>Cash</span>
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {currencySymbol} <AnimatedNumber value={stats?.paymentBreakdown?.cash || 0} />
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs transition-all duration-150 hover:bg-slate-100/80 hover:translate-x-0.5">
                  <span className="flex items-center gap-2 text-slate-700">
                    <CreditCard className="w-4 h-4 text-blue-400" />
                    <span>Card / POS</span>
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {currencySymbol} <AnimatedNumber value={stats?.paymentBreakdown?.card || 0} />
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs transition-all duration-150 hover:bg-slate-100/80 hover:translate-x-0.5">
                  <span className="flex items-center gap-2 text-slate-700">
                    <QrCode className="w-4 h-4 text-purple-400" />
                    <span>Online / QR</span>
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {currencySymbol} <AnimatedNumber value={stats?.paymentBreakdown?.online || 0} />
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs transition-all duration-150 hover:bg-slate-100/80 hover:translate-x-0.5">
                  <span className="flex items-center gap-2 text-slate-700">
                    <Users className="w-4 h-4 text-rose-400" />
                    <span>Khata Credit</span>
                  </span>
                  <span className="font-mono font-bold text-slate-900">
                    {currencySymbol} <AnimatedNumber value={stats?.paymentBreakdown?.credit || 0} />
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Live Sales Table */}
          <div style={{ animationDelay: '340ms' }} className="animate-dash-up space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <span>Recent Completed Sales</span>
              </h3>
              <Link href="/sales" className="text-xs font-semibold text-emerald-700 hover:underline transition-transform duration-150 hover:translate-x-0.5">
                View All Invoices â†’
              </Link>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Invoice #</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Cashier</th>
                    <th className="p-3 text-center">Payment</th>
                    <th className="p-3 text-right">Net Bill</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {!stats?.recentSales || stats.recentSales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-400">
                        No sales recorded yet.
                      </td>
                    </tr>
                  ) : (
                    stats.recentSales.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors duration-150">
                        <td className="p-3 font-mono text-emerald-700 font-bold">{s.invoiceNo}</td>
                        <td className="p-3 font-bold text-white">{s.customerName}</td>
                        <td className="p-3 text-slate-400">{s.cashierName || 'Cashier'}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-semibold text-slate-600 border border-slate-200">
                            {s.paymentMethod}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                          {currencySymbol} {s.netTotal}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() =>
                              printThermalMartReceipt({
                                sale: s,
                                storeName,
                                address,
                                phone
                              })
                            }
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 transition-all duration-150 hover:scale-110 active:scale-95"
                            title="Reprint Thermal Slip"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
    </RoleGuard>
  );
}

