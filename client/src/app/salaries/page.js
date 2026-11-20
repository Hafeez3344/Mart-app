'use client';

import React, { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import { useHospital } from '../../context/StoreContext';
import {
  CircleDollarSign,
  Users,
  Search,
  Calendar,
  DollarSign,
  CheckCircle2,
  X,
  RefreshCw,
  Printer,
  CreditCard,
  Plus
} from 'lucide-react';

export default function SalariesPage() {
  const { currencySymbol } = useHospital();

  const [staffList, setStaffList] = useState([]);
  const [salaryRecords, setSalaryRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Disburse Modal
  const [payModal, setPayModal] = useState({
    open: false,
    staff: null,
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    baseSalary: '',
    bonus: '0',
    deductions: '0',
    notes: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [staffRes, salRes] = await Promise.all([
        api.get('/staff'),
        api.get('/staff/salaries/all').catch(() => ({ data: { records: [] } }))
      ]);

      if (staffRes.data?.success) setStaffList(staffRes.data.staff || []);
      if (salRes.data?.success) setSalaryRecords(salRes.data.records || []);
    } catch (err) {
      console.error('Fetch salaries error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenPay = (staff) => {
    setPayModal({
      open: true,
      staff,
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      baseSalary: staff.baseSalary ? staff.baseSalary.toString() : '25000',
      bonus: '0',
      deductions: '0',
      notes: ''
    });
  };

  const handleDisburseSalary = async (e) => {
    e.preventDefault();
    if (!payModal.staff) return;

    try {
      const base = parseFloat(payModal.baseSalary) || 0;
      const bon = parseFloat(payModal.bonus) || 0;
      const ded = parseFloat(payModal.deductions) || 0;
      const net = base + bon - ded;

      await api.post(`/staff/${payModal.staff.id}/pay-salary`, {
        month: parseInt(payModal.month),
        year: parseInt(payModal.year),
        baseSalary: base,
        bonus: bon,
        deductions: ded,
        netSalary: net,
        paymentMethod: 'CASH',
        notes: payModal.notes
      });

      alert('Staff salary disbursed successfully!');
      setPayModal({ open: false, staff: null, month: 1, year: 2026, baseSalary: '', bonus: '0', deductions: '0', notes: '' });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to disburse salary.');
    }
  };

  const filteredStaff = staffList.filter(s => {
    const q = searchQuery.toLowerCase().trim();
    const fullName = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
    return !q || fullName.includes(q) || s.employeeId?.toLowerCase().includes(q) || s.designation?.toLowerCase().includes(q);
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
                <CircleDollarSign className="w-6 h-6 text-emerald-400" />
                <span>Mart Staff Payroll & Salaries</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage cashier salaries, shifts, advance deductions, and payment disbursements
              </p>
            </div>

            <button
              onClick={fetchData}
              className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff name, employee ID, designation..."
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Staff Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                  <tr>
                    <th className="p-3">Emp ID</th>
                    <th className="p-3">Staff Name</th>
                    <th className="p-3">Designation</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3 text-right">Base Salary</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        Loading staff list...
                      </td>
                    </tr>
                  ) : filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500">
                        No staff members found.
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map(s => (
                      <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-mono text-emerald-400 font-bold">{s.employeeId}</td>
                        <td className="p-3 font-bold text-white">
                          {s.firstName} {s.lastName}
                        </td>
                        <td className="p-3 text-slate-300">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px]">
                            {s.designation}
                          </span>
                        </td>
                        <td className="p-3 text-slate-400">{s.phone || '—'}</td>
                        <td className="p-3 text-right font-mono font-bold text-white">
                          {currencySymbol} {s.baseSalary}
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400">
                            {s.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleOpenPay(s)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 font-bold text-xs text-emerald-400 transition-colors"
                          >
                            Pay Salary
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

      {/* =========================================
          DISBURSE SALARY MODAL
      ========================================== */}
      {payModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Disburse Salary</h3>
                <p className="text-xs text-emerald-400 font-semibold">
                  {payModal.staff?.firstName} {payModal.staff?.lastName} ({payModal.staff?.designation})
                </p>
              </div>
              <button
                onClick={() => setPayModal({ ...payModal, open: false })}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDisburseSalary} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Month</label>
                  <select
                    value={payModal.month}
                    onChange={(e) => setPayModal({ ...payModal, month: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
                      <option key={m} value={m}>
                        Month {m}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Year</label>
                  <input
                    type="number"
                    value={payModal.year}
                    onChange={(e) => setPayModal({ ...payModal, year: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Base Salary ({currencySymbol})
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={payModal.baseSalary}
                  onChange={(e) => setPayModal({ ...payModal, baseSalary: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Bonus / Incentive ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={payModal.bonus}
                    onChange={(e) => setPayModal({ ...payModal, bonus: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Deductions / Advance ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={payModal.deductions}
                    onChange={(e) => setPayModal({ ...payModal, deductions: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-rose-400"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs flex justify-between font-bold">
                <span className="text-slate-400">Net Disbursed:</span>
                <span className="font-mono text-emerald-400 text-sm">
                  {currencySymbol}{' '}
                  {(
                    (parseFloat(payModal.baseSalary) || 0) +
                    (parseFloat(payModal.bonus) || 0) -
                    (parseFloat(payModal.deductions) || 0)
                  ).toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setPayModal({ ...payModal, open: false })}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-slate-950"
                >
                  Disburse & Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
