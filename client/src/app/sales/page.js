'use client';

import React, { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import { printThermalMartReceipt } from '../../lib/thermalPrint';
import { useHospital } from '../../context/HospitalContext';
import {
  Receipt,
  Search,
  Calendar,
  Printer,
  RotateCcw,
  Eye,
  Filter,
  X,
  RefreshCw,
  CheckCircle2,
  DollarSign
} from 'lucide-react';

export default function SalesHistoryPage() {
  const { storeName, address, phone, currencySymbol } = useHospital();

  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('ALL');

  // View Details Modal
  const [selectedSale, setSelectedSale] = useState(null);

  // Return Modal
  const [returnModal, setReturnModal] = useState({
    open: false,
    sale: null,
    itemsToReturn: [],
    refundMethod: 'CASH',
    reason: 'Customer Return / Exchange'
  });

  const fetchSales = async () => {
    try {
      setLoading(true);
      const res = await api.get('/sales');
      if (res.data?.success) {
        setSales(res.data.sales || []);
      }
    } catch (err) {
      console.error('Fetch sales error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, []);

  const handleOpenReturn = (sale) => {
    setReturnModal({
      open: true,
      sale,
      itemsToReturn: (sale.items || []).map(i => ({
        productId: i.productId,
        productName: i.productName,
        quantity: i.quantity,
        returnQty: 1,
        unitPrice: i.unitPrice
      })),
      refundMethod: 'CASH',
      reason: 'Customer Return'
    });
  };

  const handleSubmitReturn = async (e) => {
    e.preventDefault();
    if (!returnModal.sale) return;

    const returnItems = returnModal.itemsToReturn.filter(i => (parseFloat(i.returnQty) || 0) > 0);
    if (returnItems.length === 0) {
      alert('Select at least one item and quantity to return.');
      return;
    }

    const totalRefund = returnItems.reduce(
      (sum, i) => sum + (parseFloat(i.returnQty) || 0) * (parseFloat(i.unitPrice) || 0),
      0
    );

    try {
      const res = await api.post('/sales/returns', {
        saleId: returnModal.sale.id,
        invoiceNo: returnModal.sale.invoiceNo,
        items: returnItems.map(i => ({
          productId: i.productId,
          productName: i.productName,
          quantity: parseFloat(i.returnQty),
          unitPrice: parseFloat(i.unitPrice),
          refundAmount: parseFloat(i.returnQty) * parseFloat(i.unitPrice)
        })),
        totalRefund,
        refundMethod: returnModal.refundMethod,
        reason: returnModal.reason
      });

      if (res.data?.success) {
        alert('Return processed and stock restored to inventory!');
        setReturnModal({ open: false, sale: null, itemsToReturn: [], refundMethod: 'CASH', reason: '' });
        fetchSales();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to process return.');
    }
  };

  const filtered = sales.filter(s => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      s.invoiceNo?.toLowerCase().includes(q) ||
      s.customerName?.toLowerCase().includes(q) ||
      s.customerPhone?.includes(q) ||
      s.cashierName?.toLowerCase().includes(q);

    const matchMethod = paymentFilter === 'ALL' || s.paymentMethod === paymentFilter;

    return matchSearch && matchMethod;
  });

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <Receipt className="w-6 h-6 text-emerald-400" />
                <span>Sales Invoices & History</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Browse past POS sales, reprint receipts, and process customer item returns
              </p>
            </div>

            <button
              onClick={fetchSales}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Bar */}
          <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-2xl flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search invoice number, customer name, phone, cashier..."
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Payment Methods</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="ONLINE">Online</option>
              <option value="CREDIT">Khata Credit</option>
            </select>
          </div>

          {/* Sales Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Invoice #</th>
                    <th className="p-3">Date & Time</th>
                    <th className="p-3">Customer</th>
                    <th className="p-3">Cashier</th>
                    <th className="p-3 text-center">Payment</th>
                    <th className="p-3 text-right">Net Amount</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        Loading sales history...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        No sales transactions found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map(s => (
                      <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-mono text-emerald-400 font-bold">
                          {s.invoiceNo}
                        </td>
                        <td className="p-3 text-slate-400">
                          {new Date(s.createdAt).toLocaleString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="p-3 font-bold text-white">
                          <div>{s.customerName}</div>
                          {s.customerPhone && (
                            <div className="text-[10px] text-slate-500">{s.customerPhone}</div>
                          )}
                        </td>
                        <td className="p-3 text-slate-400">{s.cashierName || 'Cashier'}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] font-semibold text-slate-300">
                            {s.paymentMethod}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-white">
                          {currencySymbol} {s.netTotal}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.status === 'PAID'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : s.status === 'RETURNED'
                                ? 'bg-rose-500/15 text-rose-400'
                                : 'bg-amber-500/15 text-amber-400'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* View Details */}
                            <button
                              onClick={() => setSelectedSale(s)}
                              title="View Invoice Items"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Reprint Thermal Receipt */}
                            <button
                              onClick={() =>
                                printThermalMartReceipt({
                                  sale: s,
                                  storeName,
                                  address,
                                  phone
                                })
                              }
                              title="Reprint Thermal Receipt"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>

                            {/* Return Button */}
                            {s.status !== 'RETURNED' && (
                              <button
                                onClick={() => handleOpenReturn(s)}
                                title="Process Return / Exchange"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
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
          VIEW SALE DETAILS MODAL
      ========================================== */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Invoice Details</h3>
                <p className="text-xs font-mono text-emerald-400">{selectedSale.invoiceNo}</p>
              </div>
              <button onClick={() => setSelectedSale(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedSale.items?.map((item, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <div>
                    <div className="font-bold text-white">{item.productName}</div>
                    <div className="text-[10px] text-slate-400">
                      {item.quantity} x {currencySymbol} {item.unitPrice}
                    </div>
                  </div>
                  <div className="font-mono font-bold text-emerald-400">
                    {currencySymbol} {item.totalPrice}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="font-mono">{currencySymbol} {selectedSale.subtotal}</span>
              </div>
              {selectedSale.discount > 0 && (
                <div className="flex justify-between text-rose-400">
                  <span>Discount:</span>
                  <span className="font-mono">-{currencySymbol} {selectedSale.discount}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-sm pt-1 border-t border-slate-800 text-white">
                <span>Net Total:</span>
                <span className="font-mono text-emerald-400">{currencySymbol} {selectedSale.netTotal}</span>
              </div>
            </div>

            <button
              onClick={() =>
                printThermalMartReceipt({
                  sale: selectedSale,
                  storeName,
                  address,
                  phone
                })
              }
              className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Print Thermal Receipt</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================
          RETURN & REFUND MODAL
      ========================================== */}
      {returnModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Sales Return & Exchange</h3>
                <p className="text-xs font-mono text-emerald-400">{returnModal.sale?.invoiceNo}</p>
              </div>
              <button
                onClick={() => setReturnModal({ ...returnModal, open: false })}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReturn} className="space-y-3">
              <div className="space-y-2 max-h-52 overflow-y-auto">
                {returnModal.itemsToReturn.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex-1 truncate">
                      <div className="font-bold text-white truncate">{item.productName}</div>
                      <div className="text-[10px] text-slate-400">
                        Bought: {item.quantity} • Unit: {currencySymbol} {item.unitPrice}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] text-slate-400">Return Qty:</label>
                      <input
                        type="number"
                        min="0"
                        max={item.quantity}
                        value={item.returnQty}
                        onChange={(e) => {
                          const updated = [...returnModal.itemsToReturn];
                          updated[idx].returnQty = Math.min(
                            item.quantity,
                            Math.max(0, parseFloat(e.target.value) || 0)
                          );
                          setReturnModal({ ...returnModal, itemsToReturn: updated });
                        }}
                        className="w-16 px-2 py-1 bg-slate-900 border border-slate-800 rounded-lg text-center font-mono text-xs text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Refund Method
                </label>
                <select
                  value={returnModal.refundMethod}
                  onChange={(e) => setReturnModal({ ...returnModal, refundMethod: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="CASH">Cash Refund</option>
                  <option value="STORE_CREDIT">Store Credit / Khata</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setReturnModal({ ...returnModal, open: false })}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-xs font-bold text-white"
                >
                  Confirm Return & Restock
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

