'use client';

import React, { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import {
  User,
  Mail,
  Phone,
  Lock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Save,
  ShoppingCart
} from 'lucide-react';

export default function ProfilePage() {
  const { user, checkUserLoggedIn } = useAuth();

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: ''
  });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || user.staff?.phone || '',
        password: ''
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg({ type: '', text: '' });

    try {
      const payload = {
        name: form.name,
        email: form.email,
        phone: form.phone
      };
      if (form.password && form.password.trim()) {
        payload.password = form.password.trim();
      }

      const res = await api.put('/auth/profile', payload);
      if (res.data?.success) {
        setMsg({ type: 'success', text: 'Profile updated successfully!' });
        if (checkUserLoggedIn) checkUserLoggedIn();
      } else {
        setMsg({ type: 'error', text: res.data?.message || 'Failed to update profile.' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Update failed.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <User className="w-6 h-6 text-emerald-600" />
              <span>User Profile & Security</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage your personal staff account credentials and contact details
            </p>
          </div>

          {msg.text && (
            <div
              className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 ${
                msg.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{msg.text}</span>
            </div>
          )}

          <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
            <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-xl">
                {user?.name ? user.name.charAt(0).toUpperCase() : 'C'}
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">{user?.name}</h3>
                <p className="text-xs text-slate-400">{user?.email}</p>
                <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold mt-1 uppercase">
                  {user?.role || 'STAFF'}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Phone Number
                  </label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+92 300 1234567"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    New Password (Leave blank to keep current)
                  </label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-slate-800">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Updating...' : 'Save Profile Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

