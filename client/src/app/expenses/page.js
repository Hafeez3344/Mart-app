'use client';

import React, { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import { useStore } from '../../context/StoreContext';
import {
  DollarSign,
  Plus,
  Search,
  Calendar,
  Tag,
  Trash2,
  X,
  RefreshCw,
  Receipt,
  CreditCard,
  Banknote,
  TrendingDown
} from 'lucide-react';

const EXPENSE_CATEGORIES = [
  'ALL',
  'OPERATIONAL',
  'UTILITIES (ELECTRICITY / WATER)',
  'STORE RENT',
  'PACKAGING & BAGS',
  'STAFF TEA & MEALS',
  'EQUIPMENT MAINTENANCE',
  'TRANSPORT & FREIGHT',
  'MARKETING & SIGNAGE',
  'OTHER'
];

export default function ExpensesPage() {
  const { currencySymbol } = useStore();

  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Add Expense Modal
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    title: '',
    amount: '',
    category: 'OPERATIONAL',
    paymentMethod: 'CASH',
    paidTo: '',
    referenceNo: '',
    notes: ''
  });

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const res = await api.get('/expenses');
      if (res.data?.success) {
        setExpenses(res.data.expenses || []);
      }
    } catch (err) {
      console.error('Fetch expenses error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.amount) return;

    try {
      await api.post('/expenses', {
        ...form,
        amount: parseFloat(form.amount)
      });
      setShowModal(false);
      setForm({
        title: '',
        amount: '',
        category: 'OPERATIONAL',
        paymentMethod: 'CASH',
        paidTo: '',
        referenceNo: '',
        notes: ''
      });
      fetchExpenses();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record expense.');
    }
  };

  const filtered = expenses.filter(e => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      e.title?.toLowerCase().includes(q) ||
      e.paidTo?.toLowerCase().includes(q) ||
      e.referenceNo?.toLowerCase().includes(q);

    const matchCat = selectedCategory === 'ALL' || e.category === selectedCategory;

    return matchSearch && matchCat;
  });

  const totalExpenseSum = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-rose-600" />
                <span>Daily Mart Operating Expenses</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Record and track utilities, packaging bags, maintenance, and petty store costs
              </p>
            </div>

            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-rose-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Record Expense</span>
            </button>
          </div>

          {/* Total Expense Banner */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                Total Recorded Operational Expenses
              </div>
              <div className="text-2xl font-black font-mono text-rose-600">
                {currencySymbol} {totalExpenseSum}
              </div>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-6 h-6" />
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-3 bg-white border border-slate-200 rounded-2xl flex flex-col sm:flex-row gap-3 shadow-xs">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search expense description, paid to, voucher ref..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500"
            >
              {EXPENSE_CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Expenses Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Expense Voucher #</th>
                    <th className="p-3">Title / Description</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Paid To</th>
                    <th className="p-3 text-center">Payment Mode</th>
                    <th className="p-3 text-right">Amount</th>
                    <th className="p-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        Loading expenses...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        No expenses recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filtered.map(e => (
                      <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-mono text-rose-400 font-bold">
                          {e.expenseNo || e.id.slice(0, 8)}
                        </td>
                        <td className="p-3 font-bold text-slate-900">{e.title}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600 border border-slate-200">
                            {e.category}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500">{e.paidTo || 'â€”'}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-semibold text-slate-600 border border-slate-200">
                            {e.paymentMethod}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-rose-400">
                          {currencySymbol} {e.amount}
                        </td>
                        <td className="p-3 text-slate-500">
                          {new Date(e.date || e.expenseDate || e.createdAt).toLocaleDateString()}
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

      {/* =========================================
          RECORD EXPENSE MODAL
      ========================================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Record Operating Expense</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Expense Description *
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. 500 plastic shopping bags bundle"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                >
                  {EXPENSE_CATEGORIES.filter(c => c !== 'ALL').map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Paid To / Vendor
                </label>
                <input
                  type="text"
                  value={form.paidTo}
                  onChange={(e) => setForm({ ...form, paidTo: e.target.value })}
                  placeholder="e.g. ABC Packaging Store"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Mode
                </label>
                <select
                  value={form.paymentMethod}
                  onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CARD">Debit Card</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-xs text-slate-600 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-xs font-bold text-slate-900"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

