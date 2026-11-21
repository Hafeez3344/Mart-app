'use client';

import React, { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import { useHospital } from '../../context/StoreContext';
import {
  Users,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  Receipt,
  X,
  RefreshCw,
  CreditCard,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function CustomersPage() {
  const { currencySymbol } = useHospital();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [duesOnly, setDuesOnly] = useState(false);

  // Add Customer Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    creditLimit: '50000',
    notes: ''
  });

  // Receive Payment Modal
  const [payModal, setPayModal] = useState({
    open: false,
    customer: null,
    amount: '',
    paymentMethod: 'CASH',
    referenceNo: '',
    notes: ''
  });

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/customers');
      if (res.data?.success) {
        setCustomers(res.data.customers || []);
      }
    } catch (err) {
      console.error('Fetch customers error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim() || !addForm.phone.trim()) return;

    try {
      await api.post('/customers', addForm);
      setShowAddModal(false);
      setAddForm({ name: '', phone: '', email: '', address: '', creditLimit: '50000', notes: '' });
      fetchCustomers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to register customer.');
    }
  };

  const handleReceivePayment = async (e) => {
    e.preventDefault();
    if (!payModal.customer || !payModal.amount) return;

    try {
      await api.post('/customers/payments', {
        customerId: payModal.customer.id,
        amount: parseFloat(payModal.amount),
        paymentMethod: payModal.paymentMethod,
        referenceNo: payModal.referenceNo,
        notes: payModal.notes
      });
      alert('Khata payment recorded successfully!');
      setPayModal({ open: false, customer: null, amount: '', paymentMethod: 'CASH', referenceNo: '', notes: '' });
      fetchCustomers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record customer payment.');
    }
  };

  const filtered = customers.filter(c => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      c.name?.toLowerCase().includes(q) ||
      c.phone?.includes(q) ||
      c.address?.toLowerCase().includes(q);

    const matchDues = duesOnly ? c.currentBalance > 0 : true;

    return matchSearch && matchDues;
  });

  const totalOutstandingDues = customers.reduce((sum, c) => sum + (c.currentBalance > 0 ? c.currentBalance : 0), 0);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Users className="w-6 h-6 text-emerald-600" />
                <span>Customer Accounts & Khata (Credit)</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage registered mart customer profiles, credit limits, and collect payments
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Register Customer</span>
              </button>
            </div>
          </div>

          {/* KPI Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between shadow-xs">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Registered Accounts</div>
                <div className="text-xl font-black text-slate-900 mt-0.5">{customers.length}</div>
              </div>
              <Users className="w-8 h-8 text-indigo-300" />
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between shadow-xs">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Customer Dues (Khata)</div>
                <div className="text-xl font-black text-rose-600 font-mono mt-0.5">
                  {currencySymbol} {totalOutstandingDues}
                </div>
              </div>
              <DollarSign className="w-8 h-8 text-rose-300" />
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between shadow-xs">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Accounts with Due Balance</div>
                <div className="text-xl font-black text-amber-600 mt-0.5">
                  {customers.filter(c => c.currentBalance > 0).length}
                </div>
              </div>
              <AlertCircle className="w-8 h-8 text-amber-300" />
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
                placeholder="Search by customer name, phone number, address..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <button
              onClick={() => setDuesOnly(!duesOnly)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                duesOnly
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-white text-slate-500 border-slate-200 hover:text-slate-700'
              }`}
            >
              {duesOnly ? 'Showing Dues Only' : 'Show All Customers'}
            </button>
          </div>

          {/* Customers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {loading ? (
              <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                Loading customer profiles...
              </div>
            ) : filtered.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                No customers match your search criteria.
              </div>
            ) : (
              filtered.map(c => (
                <div
                  key={c.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-col justify-between space-y-3 shadow-xs"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between">
                      <h4 className="text-sm font-bold text-slate-900 leading-tight">{c.name}</h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                        {c.loyaltyPoints} Pts
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-700 font-medium">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{c.phone}</span>
                    </div>

                    {c.address && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{c.address}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-500">Khata Due Balance:</div>
                      <div className={`text-sm font-black font-mono ${c.currentBalance > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                        {currencySymbol} {c.currentBalance}
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        setPayModal({
                          open: true,
                          customer: c,
                          amount: c.currentBalance > 0 ? c.currentBalance.toString() : '',
                          paymentMethod: 'CASH',
                          referenceNo: '',
                          notes: ''
                        })
                      }
                      className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 font-bold text-xs text-emerald-700 transition-colors"
                    >
                      Collect Payment
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* =========================================
          REGISTER CUSTOMER MODAL
      ========================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Register Customer</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="e.g. Tariq Mehmood"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile / Phone Number *</label>
                <input
                  type="text"
                  required
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="03001234567"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Residential Address</label>
                <input
                  type="text"
                  value={addForm.address}
                  onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                  placeholder="Street / Sector / Area"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Credit Limit ({currencySymbol})</label>
                <input
                  type="number"
                  value={addForm.creditLimit}
                  onChange={(e) => setAddForm({ ...addForm, creditLimit: e.target.value })}
                  placeholder="50000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-xs text-slate-600 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================
          COLLECT PAYMENT MODAL
      ========================================== */}
      {payModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Collect Customer Khata Payment</h3>
                <p className="text-xs text-emerald-700 font-semibold">{payModal.customer?.name}</p>
              </div>
              <button
                onClick={() => setPayModal({ ...payModal, open: false })}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReceivePayment} className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between">
                <span className="text-slate-400">Current Due Balance:</span>
                <span className="font-mono text-rose-600 font-extrabold">
                  {currencySymbol} {payModal.customer?.currentBalance}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Received Amount ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={payModal.amount}
                  onChange={(e) => setPayModal({ ...payModal, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={payModal.paymentMethod}
                  onChange={(e) => setPayModal({ ...payModal, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer / Online</option>
                  <option value="CARD">Debit / Credit Card</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPayModal({ ...payModal, open: false })}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-xs text-slate-600 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white"
                >
                  Record Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


