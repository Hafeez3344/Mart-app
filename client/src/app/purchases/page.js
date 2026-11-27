'use client';

import React, { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import RoleGuard from '../../components/RoleGuard';
import api from '../../lib/api';
import { useStore } from '../../context/StoreContext';
import {
  ClipboardList,
  Plus,
  Search,
  Truck,
  DollarSign,
  PackageCheck,
  X,
  Trash2,
  Calendar,
  CheckCircle2,
  Receipt
} from 'lucide-react';

export default function PurchasesPage() {
  const { currencySymbol } = useStore();

  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  // New Purchase Modal
  const [showModal, setShowModal] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [purchaseItems, setPurchaseItems] = useState([]);
  const [paidAmount, setPaidAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [supRes, prodRes] = await Promise.all([
        api.get('/suppliers'),
        api.get('/products')
      ]);

      if (supRes.data?.success) {
        setSuppliers(supRes.data.suppliers || []);
        // Extract all purchases across suppliers
        const allPurchases = [];
        for (const s of supRes.data.suppliers || []) {
          if (s.purchases) {
            s.purchases.forEach(p => allPurchases.push({ ...p, supplierName: s.companyName }));
          }
        }
        setPurchases(allPurchases);
      }
      if (prodRes.data?.success) {
        setProducts(prodRes.data.products || []);
      }
    } catch (err) {
      console.error('Fetch purchases error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenNewPurchase = () => {
    setSelectedSupplierId(suppliers[0]?.id || '');
    setPurchaseItems([
      {
        productId: products[0]?.id || '',
        quantity: 10,
        unitCost: products[0]?.costPrice || 0,
        unit: products[0]?.unit || 'Pcs'
      }
    ]);
    setPaidAmount('0');
    setPaymentMethod('CASH');
    setNotes('');
    setShowModal(true);
  };

  const handleAddItemRow = () => {
    setPurchaseItems([
      ...purchaseItems,
      {
        productId: products[0]?.id || '',
        quantity: 10,
        unitCost: products[0]?.costPrice || 0,
        unit: products[0]?.unit || 'Pcs'
      }
    ]);
  };

  const handleRemoveRow = (idx) => {
    setPurchaseItems(purchaseItems.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, value) => {
    const updated = [...purchaseItems];
    if (field === 'productId') {
      const prod = products.find(p => p.id === value);
      updated[idx] = {
        ...updated[idx],
        productId: value,
        unitCost: prod?.costPrice || 0,
        unit: 'Pcs'
      };
    } else if (field === 'unit') {
      const prod = products.find(p => p.id === updated[idx].productId);
      const piecesPerPack = prod?.piecesPerPack || 1;
      const packsPerCarton = prod?.packsPerCarton || 1;
      const piecesPerCarton = piecesPerPack * packsPerCarton;

      let estimatedCost = prod?.costPrice || 0;
      if (value === 'Carton') {
        estimatedCost = (prod?.costPrice || 0) * piecesPerCarton;
      } else if (value === 'Pack' || value === 'Box') {
        estimatedCost = (prod?.costPrice || 0) * piecesPerPack;
      }
      updated[idx] = {
        ...updated[idx],
        unit: value,
        unitCost: estimatedCost > 0 ? estimatedCost : updated[idx].unitCost
      };
    } else {
      updated[idx][field] = value;
    }
    setPurchaseItems(updated);
  };

  const totalBill = purchaseItems.reduce(
    (sum, i) => sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitCost) || 0),
    0
  );

  const handleSubmitPurchase = async (e) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      alert('Please select a supplier.');
      return;
    }
    if (purchaseItems.length === 0) {
      alert('Add at least one item to restock.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        supplierId: selectedSupplierId,
        items: purchaseItems.map(i => {
          const prod = products.find(p => p.id === i.productId);
          return {
            productId: i.productId,
            productName: prod?.name || 'Stock Item',
            quantity: parseFloat(i.quantity) || 1,
            unitCost: parseFloat(i.unitCost) || 0,
            unit: i.unit || 'Pcs'
          };
        }),
        paidAmount: parseFloat(paidAmount) || 0,
        paymentMethod,
        description: notes
      };

      const res = await api.post('/suppliers/purchases', payload);
      if (res.data?.success) {
        alert('Stock-In purchase recorded and inventory updated!');
        setShowModal(false);
        fetchData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record purchase.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />

        <RoleGuard allowedRoles={['ADMIN', 'MANAGER', 'STOCK_KEEPER', 'ACCOUNTANT']}>
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <ClipboardList className="w-6 h-6 text-emerald-600" />
                <span>Stock-In Purchases</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Receive product inventory shipments from suppliers and log vendor invoices
              </p>
            </div>

            <button
              onClick={handleOpenNewPurchase}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>New Stock-In Bill</span>
            </button>
          </div>

          {/* Purchases Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">PO Invoice #</th>
                    <th className="p-3">Supplier Name</th>
                    <th className="p-3">Date</th>
                    <th className="p-3 text-right">Total Bill</th>
                    <th className="p-3 text-right">Paid</th>
                    <th className="p-3 text-right">Balance Due</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        Loading purchase orders...
                      </td>
                    </tr>
                  ) : purchases.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        No purchase invoices recorded yet. Click 'New Stock-In Bill' to receive goods.
                      </td>
                    </tr>
                  ) : (
                    purchases.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 font-mono text-emerald-700 font-bold">
                          {p.invoiceNo}
                        </td>
                        <td className="p-3 font-bold text-slate-900">
                          {p.supplierName || 'Vendor'}
                        </td>
                        <td className="p-3 text-slate-500">
                          {new Date(p.purchaseDate).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-right font-mono text-white font-bold">
                          {currencySymbol} {p.totalAmount}
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-700">
                          {currencySymbol} {p.paidAmount}
                        </td>
                        <td className="p-3 text-right font-mono text-rose-600 font-bold">
                          {currencySymbol} {p.balance}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.paymentStatus === 'PAID'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : p.paymentStatus === 'PARTIAL'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {p.paymentStatus}
                          </span>
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
      </div>

      {/* =========================================
          NEW STOCK-IN BILL MODAL
      ========================================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                New Stock-In Purchase Invoice
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitPurchase} className="space-y-4">
              {/* Supplier Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Vendor / Supplier *
                </label>
                <select
                  required
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                >
                  <option value="">Select Vendor</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.companyName} (Payable: {currencySymbol} {s.payableBalance})
                    </option>
                  ))}
                </select>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Received Items (Inventory will auto-increment)
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {purchaseItems.map((row, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2"
                    >
                      {/* Product Select */}
                      <select
                        value={row.productId}
                        onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:border-emerald-500 truncate"
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.barcode || p.sku})
                          </option>
                        ))}
                      </select>

                      {/* Unit */}
                      <select
                        value={row.unit || 'Pcs'}
                        onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                        className="w-24 px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="Pcs">Piece</option>
                        <option value="Pack">Box</option>
                        <option value="Carton">Carton</option>
                      </select>

                      {/* Quantity */}
                      <input
                        type="number"
                        step="any"
                        min="1"
                        placeholder="Qty"
                        value={row.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-20 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 text-center focus:outline-none focus:border-emerald-500"
                      />

                      {/* Cost */}
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Cost"
                        value={row.unitCost}
                        onChange={(e) => handleItemChange(idx, 'unitCost', e.target.value)}
                        className="w-24 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 text-right focus:outline-none focus:border-emerald-500"
                      />

                      <button
                        type="button"
                        onClick={() => handleRemoveRow(idx)}
                        className="p-1 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total & Paid Financials */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Total Purchase Amount:</span>
                  <span className="text-base font-black font-mono text-white">
                    {currencySymbol} {totalBill.toFixed(2)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <label className="text-slate-500">Amount Paid Now:</label>
                  <input
                    type="number"
                    step="any"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    className="w-32 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-right font-mono text-xs text-emerald-700 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800 text-slate-500">
                  <span>Balance Added to Supplier Payable:</span>
                  <span className="font-mono text-rose-400 font-bold">
                    {currencySymbol} {Math.max(0, totalBill - (parseFloat(paidAmount) || 0)).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
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
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-xs font-bold text-slate-950"
                >
                  {submitting ? 'Updating Inventory...' : 'Receive Stock & Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


