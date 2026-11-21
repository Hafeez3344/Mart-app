'use client';

import React, { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import { useStore } from '../../context/StoreContext';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  Layers,
  Calendar,
  RefreshCw,
  ShoppingBag,
  Percent,
  ArrowUpRight
} from 'lucide-react';

export default function ReportsPage() {
  const { currencySymbol } = useStore();

  const [financial, setFinancial] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [valuation, setValuation] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const [finRes, topRes, valRes] = await Promise.all([
        api.get('/reports/financial'),
        api.get('/reports/top-products'),
        api.get('/reports/stock-valuation')
      ]);

      if (finRes.data?.success) setFinancial(finRes.data.summary);
      if (topRes.data?.success) setTopProducts(topRes.data.topProducts || []);
      if (valRes.data?.success) setValuation(valRes.data.valuation);
    } catch (err) {
      console.error('Fetch reports error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-emerald-600" />
                <span>Financial & Sales Analytics</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time profitability, Cost of Goods Sold (COGS), top sellers & stock valuations
              </p>
            </div>

            <button
              onClick={fetchReports}
              className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 border border-slate-200 shadow-xs"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* 6 Key Financial KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[10px] uppercase font-bold text-slate-500">Net Sales Revenue</div>
              <div className="text-lg font-black font-mono text-emerald-400 mt-1">
                {currencySymbol} {financial?.adjustedSales || 0}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {financial?.totalTransactions || 0} Orders
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[10px] uppercase font-bold text-slate-500">Cost of Goods (COGS)</div>
              <div className="text-lg font-black font-mono text-slate-300 mt-1">
                {currencySymbol} {financial?.totalCogs || 0}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Purchase cost</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[10px] uppercase font-bold text-slate-500">Gross Profit</div>
              <div className="text-lg font-black font-mono text-indigo-400 mt-1">
                {currencySymbol} {financial?.grossProfit || 0}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Sales - COGS</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[10px] uppercase font-bold text-slate-500">Store Expenses</div>
              <div className="text-lg font-black font-mono text-rose-400 mt-1">
                {currencySymbol} {financial?.totalExpenses || 0}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Operating costs</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[10px] uppercase font-bold text-slate-500">Net Clean Profit</div>
              <div className={`text-lg font-black font-mono mt-1 ${(financial?.netProfit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {currencySymbol} {financial?.netProfit || 0}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Gross - Expenses</div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <div className="text-[10px] uppercase font-bold text-slate-500">Net Profit Margin</div>
              <div className="text-lg font-black font-mono text-amber-400 mt-1">
                {financial?.profitMargin || 0}%
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Return on Sales</div>
            </div>
          </div>

          {/* Stock Valuation & Top Sellers Two-Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Selling Products */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-600" />
                  <span>Top-Selling Fast Moving Items</span>
                </h3>
              </div>

              {topProducts.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No sales recorded yet to compute top selling items.
                </div>
              ) : (
                <div className="space-y-2">
                  {topProducts.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center justify-center font-mono border border-emerald-200">
                          #{idx + 1}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{p.productName}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {p.totalQuantitySold} Units Sold
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-bold font-mono text-emerald-700">
                          {currencySymbol} {p.totalRevenue}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Warehouse Stock Valuation */}
            <div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600" />
                  <span>Inventory Asset Valuation</span>
                </h3>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400 font-medium">Total Active SKUs</div>
                    <div className="text-xl font-black text-slate-900 mt-0.5">
                      {valuation?.totalItems || 0}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400 font-medium">Total Physical Units in Stock</div>
                    <div className="text-xl font-black font-mono text-emerald-700 mt-0.5">
                      {valuation?.totalStockUnits || 0}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400 font-medium">Total Cost Valuation (Capital Locked)</div>
                    <div className="text-xl font-black font-mono text-slate-700 mt-0.5">
                      {currencySymbol} {valuation?.totalCostValuation || 0}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400 font-medium">Projected Retail Selling Value</div>
                    <div className="text-xl font-black font-mono text-emerald-700 mt-0.5">
                      {currencySymbol} {valuation?.totalRetailValuation || 0}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400 font-medium">Projected Gross Profit</div>
                    <div className="text-xl font-black font-mono text-amber-400 mt-0.5">
                      +{currencySymbol} {valuation?.projectedProfit || 0}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

