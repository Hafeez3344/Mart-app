'use client';

import React, { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import {
  Tag,
  Plus,
  Trash2,
  Package,
  Layers,
  X,
  RefreshCw
} from 'lucide-react';

export default function CategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#10b981');

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await api.get('/products/categories');
      if (res.data?.success) {
        setCategories(res.data.categories || []);
      }
    } catch (err) {
      console.error('Fetch categories error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await api.post('/products/categories', { name, description, color });
      setShowAddModal(false);
      setName('');
      setDescription('');
      fetchCategories();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create category.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      await api.delete(`/products/categories/${id}`);
      fetchCategories();
    } catch (err) {
      alert('Failed to delete category.');
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <Tag className="w-6 h-6 text-emerald-600" />
                <span>Product Categories</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Organize store goods into departments for rapid POS cashier access
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchCategories}
                className="p-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700 border border-slate-200 shadow-xs"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Add Category</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {loading ? (
              <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                Loading categories...
              </div>
            ) : categories.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                No categories found. Click Add Category to create one.
              </div>
            ) : (
              categories.map((c) => (
                <div
                  key={c.id}
                  className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col justify-between hover:border-slate-700 transition-colors space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: c.color || '#10b981' }}
                      />
                      <h4 className="text-sm font-bold text-white truncate max-w-[180px]">
                        {c.name}
                      </h4>
                    </div>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2">
                    {c.description || 'No description provided.'}
                  </p>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{c.product_count || 0} Products</span>
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Create New Category</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. FROZEN DESSERTS"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white uppercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Description of goods in this category..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tag Color
                </label>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-16 h-8 bg-slate-950 border border-slate-800 rounded-lg cursor-pointer"
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
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


