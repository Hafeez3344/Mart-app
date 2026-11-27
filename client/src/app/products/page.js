'use client';

import React, { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import { useHospital } from '../../context/StoreContext';
import {
  Package,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Edit2,
  Trash2,
  ScanBarcode,
  RefreshCw,
  X,
  CheckCircle2,
  SlidersHorizontal,
  ChevronDown,
  ArrowUpDown,
  Tag,
  Boxes,
  Layers
} from 'lucide-react';

export default function ProductsPage() {
  const { currencySymbol } = useHospital();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [stockFilter, setStockFilter] = useState('ALL'); // ALL, LOW, OUT

  // Add / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form, setForm] = useState({
    name: '',
    barcode: '',
    sku: '',
    category: 'GROCERY & STAPLES',
    brand: '',
    costPrice: '',
    retailPrice: '',
    wholesalePrice: '',
    piecesPerPack: '1',
    packPrice: '',
    packBarcode: '',
    packsPerCarton: '1',
    cartonPrice: '',
    cartonBarcode: '',
    stockQuantity: '',
    minStockAlert: '10',
    unit: 'Pcs',
    allowFractional: false,
    expiryDate: '',
    batchNo: '',
    supplierId: ''
  });

  // Stock Adjustment Modal
  const [adjustModal, setAdjustModal] = useState({
    open: false,
    product: null,
    type: 'DAMAGE',
    quantity: '',
    reason: ''
  });

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const [prodRes, catRes, supRes] = await Promise.all([
        api.get('/products'),
        api.get('/products/categories').catch(() => ({ data: { categories: [] } })),
        api.get('/suppliers').catch(() => ({ data: { suppliers: [] } }))
      ]);

      if (prodRes.data?.success) setProducts(prodRes.data.products || []);
      if (catRes.data?.success) setCategories(catRes.data.categories || []);
      if (supRes.data?.success) setSuppliers(supRes.data.suppliers || []);
    } catch (err) {
      console.error('Fetch products error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setForm({
      name: '',
      barcode: `890${Date.now().toString().slice(-8)}`,
      sku: `SKU-${Date.now().toString().slice(-6)}`,
      category: categories[0]?.name || 'GROCERY & STAPLES',
      brand: '',
      costPrice: '',
      retailPrice: '',
      wholesalePrice: '',
      piecesPerPack: '1',
      packPrice: '',
      packBarcode: '',
      packsPerCarton: '1',
      cartonPrice: '',
      cartonBarcode: '',
      stockQuantity: '0',
      minStockAlert: '10',
      unit: 'Pcs',
      allowFractional: false,
      expiryDate: '',
      batchNo: '',
      supplierId: ''
    });
    setShowModal(true);
  };

  const handleOpenEdit = (p) => {
    setEditingProduct(p);
    setForm({
      name: p.name || '',
      barcode: p.barcode || '',
      sku: p.sku || '',
      category: p.category || 'GROCERY & STAPLES',
      brand: p.brand || '',
      costPrice: p.costPrice !== undefined ? p.costPrice.toString() : '',
      retailPrice: p.retailPrice !== undefined ? p.retailPrice.toString() : '',
      wholesalePrice: p.wholesalePrice ? p.wholesalePrice.toString() : '',
      piecesPerPack: p.piecesPerPack ? p.piecesPerPack.toString() : '1',
      packPrice: p.packPrice ? p.packPrice.toString() : '',
      packBarcode: p.packBarcode || '',
      packsPerCarton: p.packsPerCarton ? p.packsPerCarton.toString() : '1',
      cartonPrice: p.cartonPrice ? p.cartonPrice.toString() : '',
      cartonBarcode: p.cartonBarcode || '',
      stockQuantity: p.stockQuantity !== undefined ? p.stockQuantity.toString() : '0',
      minStockAlert: p.minStockAlert !== undefined ? p.minStockAlert.toString() : '10',
      unit: p.unit || 'Pcs',
      allowFractional: Boolean(p.allowFractional),
      expiryDate: p.expiryDate ? p.expiryDate.slice(0, 10) : '',
      batchNo: p.batchNo || '',
      supplierId: p.supplierId || ''
    });
    setShowModal(true);
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, form);
      } else {
        await api.post('/products', form);
      }
      setShowModal(false);
      fetchProducts();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save product.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to deactivate this product?')) return;
    try {
      await api.delete(`/products/${id}`);
      fetchProducts();
    } catch (err) {
      alert('Failed to delete product.');
    }
  };

  const handleSaveAdjustment = async (e) => {
    e.preventDefault();
    if (!adjustModal.product || !adjustModal.quantity) return;

    try {
      await api.post(`/products/${adjustModal.product.id}/adjust-stock`, {
        quantity: parseFloat(adjustModal.quantity),
        type: adjustModal.type,
        reason: adjustModal.reason
      });
      setAdjustModal({ open: false, product: null, type: 'DAMAGE', quantity: '', reason: '' });
      fetchProducts();
    } catch (err) {
      alert('Failed to adjust stock.');
    }
  };

  const filtered = products.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    const matchSearch =
      !q ||
      p.name?.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      p.brand?.toLowerCase().includes(q);

    const matchCat = selectedCategory === 'ALL' || p.category === selectedCategory;

    let matchStock = true;
    if (stockFilter === 'LOW') matchStock = p.stockQuantity > 0 && p.stockQuantity <= (p.minStockAlert || 10);
    else if (stockFilter === 'OUT') matchStock = p.stockQuantity <= 0;

    return matchSearch && matchCat && matchStock;
  });

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Package className="w-6 h-6 text-emerald-600" />
                <span>Products & Inventory</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Manage retail barcode items, pricing, margins & stock quantities
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchProducts}
                className="p-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors shadow-2xs"
                title="Refresh Catalog"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              <button
                onClick={handleOpenAdd}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 flex items-center gap-1.5 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Add Product</span>
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="p-3 bg-white border border-slate-200 rounded-2xl flex flex-col md:flex-row gap-3 shadow-2xs">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by product name, barcode, SKU, brand..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
              />
            </div>

            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name} ({c.product_count || 0})
                </option>
              ))}
            </select>

            {/* Stock Level Filter */}
            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
            >
              <option value="ALL">All Stock Levels</option>
              <option value="LOW">Low Stock Only</option>
              <option value="OUT">Out of Stock Only</option>
            </select>
          </div>

          {/* Product Data Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Barcode / SKU</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Cost</th>
                    <th className="p-3 text-right">Retail Price</th>
                    <th className="p-3 text-right">Margin</th>
                    <th className="p-3 text-center">Stock</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        Loading products catalog...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-400">
                        No products match the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((p) => {
                      const isOut = p.stockQuantity <= 0;
                      const isLow = p.stockQuantity > 0 && p.stockQuantity <= (p.minStockAlert || 10);
                      const margin =
                        p.retailPrice > 0
                          ? (((p.retailPrice - p.costPrice) / p.retailPrice) * 100).toFixed(0)
                          : 0;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="p-3 font-mono text-emerald-700">
                            <div>{p.barcode || '—'}</div>
                            <div className="text-[10px] text-slate-400">{p.sku}</div>
                          </td>
                          <td className="p-3">
                            <div className="font-bold text-slate-900 text-xs">{p.name}</div>
                            {p.brand && (
                              <div className="text-[10px] text-slate-400">{p.brand}</div>
                            )}
                            {(p.piecesPerPack > 1 || p.packsPerCarton > 1) && (
                              <div className="mt-1 flex flex-wrap gap-1 text-[9px] font-medium text-slate-500">
                                {p.piecesPerPack > 1 && (
                                  <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200">
                                    Box: {p.piecesPerPack} {p.unit} ({currencySymbol}{p.packPrice || '—'})
                                  </span>
                                )}
                                {p.packsPerCarton > 1 && (
                                  <span className="px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200">
                                    Carton: {p.packsPerCarton} Boxes = {p.piecesPerPack * p.packsPerCarton} {p.unit} ({currencySymbol}{p.cartonPrice || '—'})
                                  </span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-slate-600">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] font-semibold">
                              {p.category}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono text-slate-500">
                            {currencySymbol} {p.costPrice}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">
                            {currencySymbol} {p.retailPrice}
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-emerald-600">
                            {margin}%
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isOut
                                  ? 'bg-rose-50 text-rose-600 border border-rose-200'
                                  : isLow
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {p.stockQuantity} {p.unit}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() =>
                                  setAdjustModal({
                                    open: true,
                                    product: p,
                                    type: 'DAMAGE',
                                    quantity: '',
                                    reason: ''
                                  })
                                }
                                title="Adjust Stock (Damage / Expiry)"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                              >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEdit(p)}
                                title="Edit Product"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(p.id)}
                                title="Deactivate"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================
          ADD / EDIT PRODUCT MODAL
      ========================================== */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-900">
                {editingProduct ? 'Edit Product' : 'Add New Retail Product'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Product Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Product Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Coca-Cola 1.5L Bottle"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/15"
                  />
                </div>

                {/* Barcode */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Barcode / Scanner Code
                  </label>
                  <input
                    type="text"
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    placeholder="890123456789"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-emerald-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                {/* SKU */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">SKU Code</label>
                  <input
                    type="text"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="BEV-COKE-15L"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Brand */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Brand</label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    placeholder="e.g. Nestle, Unilever"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                {/* Cost Price */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cost Price (Purchase) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.costPrice}
                    onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
                    placeholder="150"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                {/* Retail Price */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Retail Price (Selling) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.retailPrice}
                    onChange={(e) => setForm({ ...form, retailPrice: e.target.value })}
                    placeholder="180"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-emerald-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                {/* Stock Quantity */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Current Stock Quantity
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={form.stockQuantity}
                    onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })}
                    placeholder="100"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                {/* Low Stock Alert */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Low Stock Alert Level
                  </label>
                  <input
                    type="number"
                    value={form.minStockAlert}
                    onChange={(e) => setForm({ ...form, minStockAlert: e.target.value })}
                    placeholder="10"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                {/* Unit */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
                  <select
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  >
                    {['Pcs', 'Kg', 'Gram', 'Liter', 'Pack', 'Box', 'Bottle', 'Can', 'Dozen'].map(
                      (u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      )
                    )}
                  </select>
                </div>

                {/* Supplier */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Supplier</label>
                  <select
                    value={form.supplierId}
                    onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.companyName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3-Tier Multi-Unit Packaging (Carton -> Box -> Piece) */}
                <div className="col-span-2 p-4 bg-emerald-50/70 border border-emerald-200/90 rounded-2xl mt-1">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-950">
                        3-Tier Packaging Hierarchy (Carton ➔ Box/Dabbi ➔ Piece)
                      </span>
                    </div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                      Wholesale & Retail
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {/* Tier 2: Box / Dabbi */}
                    <div className="p-3 bg-white border border-emerald-100 rounded-xl space-y-2 shadow-2xs">
                      <div className="font-bold text-slate-800 flex items-center justify-between">
                        <span>📦 Box / Dabbi (Pack)</span>
                        <span className="text-[10px] text-slate-500 font-normal">Inner pack</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Pieces in 1 Box</label>
                          <input
                            type="number"
                            min="1"
                            value={form.piecesPerPack}
                            onChange={(e) => setForm({ ...form, piecesPerPack: e.target.value })}
                            placeholder="e.g. 50"
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Box Sell Price ({currencySymbol})</label>
                          <input
                            type="number"
                            step="0.01"
                            value={form.packPrice}
                            onChange={(e) => setForm({ ...form, packPrice: e.target.value })}
                            placeholder="e.g. 230"
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-emerald-700"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Box Barcode (Optional)</label>
                        <input
                          type="text"
                          value={form.packBarcode}
                          onChange={(e) => setForm({ ...form, packBarcode: e.target.value })}
                          placeholder="Scan barcode on box"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                    </div>

                    {/* Tier 3: Full Carton */}
                    <div className="p-3 bg-white border border-emerald-100 rounded-xl space-y-2 shadow-2xs">
                      <div className="font-bold text-slate-800 flex items-center justify-between">
                        <span>📦 Full Carton (Bulk)</span>
                        <span className="text-[10px] text-slate-500 font-normal">Outer wholesale box</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Boxes in 1 Carton</label>
                          <input
                            type="number"
                            min="1"
                            value={form.packsPerCarton}
                            onChange={(e) => setForm({ ...form, packsPerCarton: e.target.value })}
                            placeholder="e.g. 10"
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Carton Sell Price ({currencySymbol})</label>
                          <input
                            type="number"
                            step="0.01"
                            value={form.cartonPrice}
                            onChange={(e) => setForm({ ...form, cartonPrice: e.target.value })}
                            placeholder="e.g. 2200"
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-emerald-700"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Carton Barcode (Optional)</label>
                        <input
                          type="text"
                          value={form.cartonBarcode}
                          onChange={(e) => setForm({ ...form, cartonBarcode: e.target.value })}
                          placeholder="Scan barcode on carton"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quick Carton Breakdown Calculator */}
                  <div className="mt-3 p-2.5 bg-white/90 rounded-xl border border-emerald-100 flex items-center justify-between gap-3 text-xs">
                    <div className="text-[11px] text-slate-600">
                      💡 <strong>Carton Cost Helper:</strong> Total in 1 carton = <span className="font-bold text-emerald-700">{(parseFloat(form.piecesPerPack) || 1) * (parseFloat(form.packsPerCarton) || 1)} {form.unit || 'pieces'}</span>.
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder="Carton Cost"
                        id="quickCartonCostInput"
                        className="w-28 px-2 py-1 text-xs border border-slate-300 rounded-lg bg-slate-50"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const val = parseFloat(document.getElementById('quickCartonCostInput')?.value);
                          const totalPieces = (parseFloat(form.piecesPerPack) || 1) * (parseFloat(form.packsPerCarton) || 1);
                          if (val > 0 && totalPieces > 0) {
                            const pieceCost = (val / totalPieces).toFixed(2);
                            setForm(prev => ({ ...prev, costPrice: pieceCost }));
                          }
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[10px] transition-colors"
                      >
                        Auto-Set Piece Cost
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-md shadow-emerald-600/20"
                >
                  {editingProduct ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================
          STOCK ADJUSTMENT MODAL
      ========================================== */}
      {adjustModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">Stock Adjustment</h3>
                <p className="text-xs text-emerald-700 font-bold">{adjustModal.product?.name}</p>
              </div>
              <button
                onClick={() => setAdjustModal({ ...adjustModal, open: false })}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Adjustment Type
                </label>
                <select
                  value={adjustModal.type}
                  onChange={(e) => setAdjustModal({ ...adjustModal, type: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                >
                  <option value="DAMAGE">Damage / Broken Goods (-)</option>
                  <option value="EXPIRED">Perishable Expiry (-)</option>
                  <option value="SHRINKAGE">Shrinkage / Missing (-)</option>
                  <option value="RESTOCK">Manual Restock (+)</option>
                  <option value="COUNT_CORRECTION_ADD">Audit Correction (+)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quantity to Adjust ({adjustModal.product?.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={adjustModal.quantity}
                  onChange={(e) => setAdjustModal({ ...adjustModal, quantity: e.target.value })}
                  placeholder="e.g. 5"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason / Notes
                </label>
                <input
                  type="text"
                  value={adjustModal.reason}
                  onChange={(e) => setAdjustModal({ ...adjustModal, reason: e.target.value })}
                  placeholder="e.g. Dropped during shelf stocking"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setAdjustModal({ ...adjustModal, open: false })}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-xs font-bold text-white shadow-xs"
                >
                  Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

