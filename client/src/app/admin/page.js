'use client';

import React, { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import Link from 'next/link';
import api from '../../lib/api';
import { printThermalMartReceipt } from '../../lib/thermalPrint';
import { useHospital } from '../../context/HospitalContext';
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
  const { storeName, address, phone, currencySymbol } = useHospital();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

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
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {/* Header Title & Shortcuts */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <LayoutDashboard className="w-6 h-6 text-emerald-400" />
                <span>Mart Executive Overview</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time supermarket sales, cashier checkouts, inventory health, and store analytics
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchStats}
                className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
                title="Refresh Analytics"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <Link
                href="/pos"
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>Launch POS Terminal</span>
              </Link>
            </div>
          </div>

          {/* 4 Core Stat Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Today's Sales Revenue */}
            <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Today's Net Revenue
                </div>
                <div className="text-2xl font-black font-mono text-emerald-400">
                  {currencySymbol} {stats?.totalRevenueToday || 0}
                </div>
                <div className="text-[10px] text-slate-500 font-semibold">
                  {stats?.ordersTodayCount || 0} Orders Processed
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>

            {/* Gross Profit Today */}
            <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Gross Margin Today
                </div>
                <div className="text-2xl font-black font-mono text-indigo-400">
                  {currencySymbol} {stats?.grossProfitToday || 0}
                </div>
                <div className="text-[10px] text-slate-500 font-semibold">
                  Sales minus Purchase Cost
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>

            {/* Total Active SKUs */}
            <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Active Products
                </div>
                <div className="text-2xl font-black text-white">
                  {stats?.totalProducts || 0}
                </div>
                <div className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  <span>{stats?.lowStockCount || 0} Low Stock Alerts</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Package className="w-6 h-6" />
              </div>
            </div>

            {/* Customer Khata Dues */}
            <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Customer Dues (Khata)
                </div>
                <div className="text-2xl font-black font-mono text-rose-400">
                  {currencySymbol} {stats?.totalCustomerDues || 0}
                </div>
                <div className="text-[10px] text-slate-500 font-semibold">
                  Across {stats?.totalCustomers || 0} Registered Customers
                </div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Quick Shortcuts Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Link
              href="/pos"
              className="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex items-center gap-3 transition-colors group"
            >
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-colors">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">POS Terminal</div>
                <div className="text-[10px] text-slate-400">Barcode checkout</div>
              </div>
            </Link>

            <Link
              href="/products"
              className="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex items-center gap-3 transition-colors group"
            >
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-slate-950 transition-colors">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Add Product</div>
                <div className="text-[10px] text-slate-400">Manage catalog</div>
              </div>
            </Link>

            <Link
              href="/purchases"
              className="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex items-center gap-3 transition-colors group"
            >
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                <Truck className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Stock-In Purchase</div>
                <div className="text-[10px] text-slate-400">Receive goods</div>
              </div>
            </Link>

            <Link
              href="/register"
              className="p-3.5 rounded-2xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 flex items-center gap-3 transition-colors group"
            >
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-slate-950 transition-colors">
                <Banknote className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white">Cash Drawer</div>
                <div className="text-[10px] text-slate-400">Shift audits</div>
              </div>
            </Link>
          </div>

          {/* 7-Day Revenue Trend & Payment Methods Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Weekly Trend Bar Cards */}
            <div className="lg:col-span-2 p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>7-Day Sales Performance</span>
                </h3>
              </div>

              {/* Simple Responsive Bar Chart */}
              <div className="h-44 flex items-end justify-between gap-2 pt-6 px-2">
                {stats?.weeklyTrends?.map((day, idx) => {
                  const maxRev = Math.max(...(stats.weeklyTrends.map(t => t.revenue) || [1]), 1000);
                  const heightPercent = Math.max(10, Math.round((day.revenue / maxRev) * 100));

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                      <div className="text-[10px] font-mono text-emerald-400 font-bold truncate">
                        {currencySymbol}{day.revenue}
                      </div>
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className="w-full max-w-[40px] rounded-t-xl bg-gradient-to-t from-emerald-600 to-teal-400 transition-all shadow-md shadow-emerald-500/10"
                      />
                      <span className="text-[10px] text-slate-400 font-medium truncate max-w-[50px]">
                        {day.day.split(',')[0]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Payment Modes Today */}
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                <span>Today's Payment Modes</span>
              </h3>

              <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-300">
                    <Banknote className="w-4 h-4 text-emerald-400" />
                    <span>Cash</span>
                  </span>
                  <span className="font-mono font-bold text-white">
                    {currencySymbol} {stats?.paymentBreakdown?.cash || 0}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-300">
                    <CreditCard className="w-4 h-4 text-blue-400" />
                    <span>Card / POS</span>
                  </span>
                  <span className="font-mono font-bold text-white">
                    {currencySymbol} {stats?.paymentBreakdown?.card || 0}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-300">
                    <QrCode className="w-4 h-4 text-purple-400" />
                    <span>Online / QR</span>
                  </span>
                  <span className="font-mono font-bold text-white">
                    {currencySymbol} {stats?.paymentBreakdown?.online || 0}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-300">
                    <Users className="w-4 h-4 text-rose-400" />
                    <span>Khata Credit</span>
                  </span>
                  <span className="font-mono font-bold text-white">
                    {currencySymbol} {stats?.paymentBreakdown?.credit || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Live Sales Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-400" />
                <span>Recent Completed Sales</span>
              </h3>
              <Link href="/sales" className="text-xs font-semibold text-emerald-400 hover:underline">
                View All Invoices →
              </Link>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Invoice #</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Cashier</th>
                    <th className="p-3 text-center">Payment</th>
                    <th className="p-3 text-right">Net Bill</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {!stats?.recentSales || stats.recentSales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500">
                        No sales recorded yet.
                      </td>
                    </tr>
                  ) : (
                    stats.recentSales.map(s => (
                      <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-mono text-emerald-400 font-bold">{s.invoiceNo}</td>
                        <td className="p-3 font-bold text-white">{s.customerName}</td>
                        <td className="p-3 text-slate-400">{s.cashierName || 'Cashier'}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-slate-300">
                            {s.paymentMethod}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-white">
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
                            className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10"
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
      </div>
    </div>
  );
}
