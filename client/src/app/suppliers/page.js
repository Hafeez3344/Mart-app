'use client';

import React, { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import { useHospital } from '../../context/StoreContext';
import {
  Truck,
  Plus,
  Search,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  CreditCard,
  X,
  RefreshCw,
  Receipt
} from 'lucide-react';

export default function SuppliersPage() {
  const { currencySymbol } = useHospital();

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Supplier Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    taxNo: ''
  });

  // Pay Supplier Modal
  const [payModal, setPayModal] = useState({
    open: false,
    supplier: null,
    amount: '',
    paymentMethod: 'CASH',
    referenceNo: '',
    notes: ''
  });

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/suppliers');
      if (res.data?.success) {
        setSuppliers(res.data.suppliers || []);
      }
    } catch (err) {
      console.error('Fetch suppliers error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    if (!addForm.companyName.trim()) return;

    try {
      await api.post('/suppliers', addForm);
      setShowAddModal(false);
      setAddForm({ companyName: '', contactPerson: '', phone: '', email: '', address: '', taxNo: '' });
      fetchSuppliers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create supplier.');
    }
  };

  const handlePaySupplier = async (e) => {
    e.preventDefault();
    if (!payModal.supplier || !payModal.amount) return;

    try {
      await api.post('/suppliers/payments', {
        supplierId: payModal.supplier.id,
        amount: parseFloat(payModal.amount),
        paymentMethod: payModal.paymentMethod,
        referenceNo: payModal.referenceNo,
        notes: payModal.notes
      });
      alert('Supplier payment recorded successfully!');
      setPayModal({ open: false, supplier: null, amount: '', paymentMethod: 'CASH', referenceNo: '', notes: '' });
      fetchSuppliers();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record payment.');
    }
  };

  const filtered = suppliers.filter(s => {
    const q = searchQuery.toLowerCase().trim();
    return (
      !q ||
      s.companyName?.toLowerCase().includes(q) ||
      s.contactPerson?.toLowerCase().includes(q) ||
      s.phone?.includes(q)
    );
  });

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Truck className="w-6 h-6 text-emerald-600" />
                <span>Suppliers & Vendor Ledgers</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage distributor accounts, purchases, and outstanding payable balances
              </p>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Add Supplier</span>
            </button>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vendor name, contact person, phone..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500 shadow-2xs"
            />
          </div>

          {/* Suppliers Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {loading ? (
              <div className="col-span-full py-12 text-center text-slate-500 text-xs">
                Loading suppliers...
              </div>
            ) : filtered.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 text-xs">
                No suppliers registered yet. Click 'Add Supplier' to register vendors.
              </div>
            ) : (
              filtered.map(s => (
                <div
                  key={s.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h4 className="text-sm font-bold text-slate-900 leading-tight">{s.companyName}</h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {s._count?.products || 0} Products
                      </span>
                    </div>

                    {s.contactPerson && (
                      <div className="text-xs text-slate-600 font-medium">Contact: {s.contactPerson}</div>
                    )}

                    <div className="space-y-1 text-[11px] text-slate-500">
                      {s.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-400" />
                          <span>{s.phone}</span>
                        </div>
                      )}
                      {s.address && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span className="truncate">{s.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-slate-500">Payable Balance:</div>
                      <div className="text-sm font-extrabold font-mono text-rose-600">
                        {currencySymbol} {s.payableBalance}
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        setPayModal({
                          open: true,
                          supplier: s,
                          amount: '',
                          paymentMethod: 'CASH',
                          referenceNo: '',
                          notes: ''
                        })
                      }
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-600 hover:text-white border border-emerald-200 font-bold text-xs text-emerald-700 transition-colors"
                    >
                      Pay Voucher
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* =========================================
          ADD SUPPLIER MODAL
      ========================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Register Vendor / Supplier</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSupplier} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={addForm.companyName}
                  onChange={(e) => setAddForm({ ...addForm, companyName: e.target.value })}
                  placeholder="e.g. Nestle Pakistan Ltd."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={addForm.contactPerson}
                  onChange={(e) => setAddForm({ ...addForm, contactPerson: e.target.value })}
                  placeholder="e.g. Sales Rep Name"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="+92 300 1234567"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Warehouse Address</label>
                <input
                  type="text"
                  value={addForm.address}
                  onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                  placeholder="City / Industrial Area"
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
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================
          PAY SUPPLIER MODAL
      ========================================== */}
      {payModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Record Vendor Payment</h3>
                <p className="text-xs text-emerald-700 font-semibold">{payModal.supplier?.companyName}</p>
              </div>
              <button
                onClick={() => setPayModal({ ...payModal, open: false })}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaySupplier} className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between">
                <span className="text-slate-500">Current Payable Balance:</span>
                <span className="font-mono text-rose-600 font-extrabold">
                  {currencySymbol} {payModal.supplier?.payableBalance}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Amount *
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Mode
                </label>
                <select
                  value={payModal.paymentMethod}
                  onChange={(e) => setPayModal({ ...payModal, paymentMethod: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                >
                  <option value="CASH">Cash</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reference / Cheque No.
                </label>
                <input
                  type="text"
                  value={payModal.referenceNo}
                  onChange={(e) => setPayModal({ ...payModal, referenceNo: e.target.value })}
                  placeholder="e.g. CHQ-92810"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
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
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


