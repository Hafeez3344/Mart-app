'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import { useHospital } from '../../context/StoreContext';
import { printStaffSalarySlip } from '../../lib/salarySlipPrint';
import ConfirmModal from '../../components/ConfirmModal';
import {
  UserCheck,
  DollarSign,
  Calendar,
  Building2,
  Plus,
  Search,
  Edit3,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Printer,
  Receipt,
  CreditCard,
  User,
  Phone,
  Mail,
  Lock,
  Award,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  TrendingDown,
  Eye,
  EyeOff
} from 'lucide-react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function StaffPage() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { formatAmount } = useCurrency();
  const { hospitalName, locationAddress } = useHospital();

  const isManagementRoute = pathname?.startsWith('/admin') || pathname?.startsWith('/staff');
  const isAdminOrFrontdesk = true;

  const [loading, setLoading] = useState(true);
  const [staffList, setStaffList] = useState([]);
  const [staffProfile, setStaffProfile] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals for Admin / Frontdesk
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [deletingStaff, setDeletingStaff] = useState(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // Salary Payment Modal
  const [payingStaff, setPayingStaff] = useState(null);
  const [salaryForm, setSalaryForm] = useState({
    month: new Date().toLocaleString('en-US', { month: 'long' }),
    year: new Date().getFullYear().toString(),
    basicSalary: '45000',
    allowances: '0',
    deductions: '0',
    paymentMethod: 'CASH',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [payingLoading, setPayingLoading] = useState(false);

  // Add / Edit Staff Form State
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'STAFF',
    designation: 'Cashier',
    baseSalary: '30000',
    phone: ''
  });
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [showStaffPassword, setShowStaffPassword] = useState(false);

  // Self-profile edit form for logged-in staff member
  const [profilePassword, setProfilePassword] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchStaffData();
  }, [isAdminOrFrontdesk]);

  const fetchStaffData = async () => {
    setLoading(true);
    try {
      if (isAdminOrFrontdesk) {
        const res = await api.get('/staff/all');
        if (res.data?.success) {
          setStaffList(res.data.staffMembers || []);
        }
      }
      // Also fetch personal profile if user has staff profile
      const profRes = await api.get('/staff/profile').catch(() => null);
      if (profRes && profRes.data?.success) {
        setStaffProfile(profRes.data);
        setProfilePhone(profRes.data.staff?.phone || '');
      }
    } catch (err) {
      console.error('Error fetching staff data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setMsg({ type: '', text: '' });

    try {
      const res = await api.post('/staff', form);
      if (res.data.success) {
        setMsg({ type: 'success', text: 'Staff profile created successfully!' });
        setForm({
          name: '',
          email: '',
          password: '',
          role: 'STAFF',
          designation: 'Staff Nurse',
          baseSalary: '45000',
          phone: ''
        });
        fetchStaffData();
        setTimeout(() => setShowAddModal(false), 1200);
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to create staff member.' });
    }
  };

  const handleUpdateStaff = async (e) => {
    e.preventDefault();
    if (!editingStaff) return;
    setMsg({ type: '', text: '' });

    try {
      const res = await api.put(`/staff/${editingStaff.id}`, form);
      if (res.data.success) {
        setMsg({ type: 'success', text: 'Staff record updated successfully!' });
        fetchStaffData();
        setTimeout(() => setEditingStaff(null), 1200);
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update staff record.' });
    }
  };

  const handleOpenPaySalaryModal = (staffMember) => {
    setPayingStaff(staffMember);
    const basic = staffMember.baseSalary || 45000;
    setSalaryForm({
      month: new Date().toLocaleString('en-US', { month: 'long' }),
      year: new Date().getFullYear().toString(),
      basicSalary: basic.toString(),
      allowances: '0',
      deductions: '0',
      paymentMethod: 'CASH',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setMsg({ type: '', text: '' });
  };

  const handleDisburseSalary = async (e) => {
    e.preventDefault();
    if (!payingStaff) return;
    setPayingLoading(true);
    setMsg({ type: '', text: '' });

    try {
      const res = await api.post(`/staff/${payingStaff.id}/pay-salary`, salaryForm);
      if (res.data.success) {
        setMsg({ type: 'success', text: res.data.message || 'Salary recorded & paid successfully!' });
        fetchStaffData();

        // Offer print slip immediately
        if (res.data.salaryRecord) {
          printStaffSalarySlip({
            hospitalName: hospitalName || 'SUPER MART',
            hospitalAddress: locationAddress || 'Main Commercial Street',
            staff: {
              ...payingStaff,
              name: `${payingStaff.firstName} ${payingStaff.lastName}`
            },
            salaryRecord: res.data.salaryRecord
          });
        }

        setTimeout(() => setPayingStaff(null), 1200);
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to disburse salary.' });
    } finally {
      setPayingLoading(false);
    }
  };

  const confirmDeleteStaff = async () => {
    if (!deletingStaff) return;
    setDeletingLoading(true);
    try {
      const res = await api.delete(`/staff/${deletingStaff.id}`);
      if (res.data.success) {
        fetchStaffData();
        setDeletingStaff(null);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Error deleting staff profile.');
    } finally {
      setDeletingLoading(false);
    }
  };

  const handleSaveSelfProfile = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg({ type: '', text: '' });

    try {
      const payload = { phone: profilePhone };
      if (profilePassword && profilePassword.trim()) {
        payload.password = profilePassword.trim();
      }
      const res = await api.put('/auth/profile', payload);
      if (res.data.success) {
        setProfileMsg({ type: 'success', text: 'Your contact credentials have been updated!' });
        setProfilePassword('');
        fetchStaffData();
      }
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.response?.data?.message || 'Failed to update credentials.' });
    } finally {
      setProfileSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-[#B7D7F0] p-12 text-center text-slate-500 text-xs flex items-center justify-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin text-[#5A9BD5]" />
        <span>Loading staff directory & compensation records...</span>
      </div>
    );
  }

  // =========================================================================
  // VIEW 1: ADMIN & FRONTDESK STAFF DIRECTORY & PAYROLL ASSIGNMENT
  // =========================================================================
  if (isAdminOrFrontdesk) {
    const filteredStaff = staffList.filter(s =>
      (`${s.firstName} ${s.lastName}`).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.designation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.employeeId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalStaffPayroll = staffList.reduce((sum, s) => sum + (parseFloat(s.baseSalary) || 0), 0);

    return (
      <div className="space-y-4 pb-12 text-xs">
        {/* Header Banner */}
        <div className="bg-white rounded-2xl p-4 border border-[#B7D7F0] shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base font-extrabold text-[#1F3F66]">
                  Mart Staff & Payroll Management
                </h1>
                <p className="text-[11px] text-slate-500 font-medium">
                  Manage staff directory profiles, assign base salary rates, and disburse monthly payroll slips
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setEditingStaff(null);
                setForm({
                  name: '',
                  email: '',
                  password: '',
                  role: 'STAFF',
                  designation: 'Cashier',
                  baseSalary: '45000',
                  phone: ''
                });
                setShowAddModal(true);
              }}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>+ Add Staff Member</span>
            </button>
          </div>
        </div>

        {/* 3 Overview KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white p-3.5 rounded-2xl border border-[#B7D7F0] shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider block">
                Total Staff Active
              </span>
              <span className="text-lg font-black text-[#1F3F66] block mt-0.5">
                {staffList.length} Employees
              </span>
              <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">
                Registered in system
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-[#EDF6FF] text-[#1F3F66] flex items-center justify-center font-bold">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] text-emerald-800 font-extrabold uppercase tracking-wider block">
                Monthly Payroll Base
              </span>
              <span className="text-lg font-black text-emerald-950 block mt-0.5">
                {formatAmount(totalStaffPayroll)}
              </span>
              <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
                Estimated base monthly
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-2xl border border-purple-200 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[10px] text-purple-800 font-extrabold uppercase tracking-wider block">
                Payroll Integration
              </span>
              <span className="text-sm font-black text-purple-950 block mt-0.5">
                Auto-Expense Linked
              </span>
              <span className="text-[10px] text-purple-700 font-semibold block mt-0.5">
                Disbursements link to expenses
              </span>
            </div>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Receipt className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Directory & Table */}
        <div className="bg-white rounded-2xl border border-[#B7D7F0] shadow-xs overflow-hidden">
          <div className="p-3.5 border-b border-[#B7D7F0]/60 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-[#EDF6FF]/40">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by staff name, designation, or EMP ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs bg-white border border-[#B7D7F0] rounded-xl pl-8 pr-3 py-1.5 text-[#1F3F66] font-semibold focus:outline-none"
              />
            </div>

            <span className="text-[11px] font-bold text-[#1F3F66]">
              {filteredStaff.length} of {staffList.length} Staff Members
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#EDF6FF] text-[#1F3F66] font-extrabold uppercase border-b border-[#B7D7F0] text-[10.5px]">
                  <th className="p-3">Employee ID</th>
                  <th className="p-3">Staff Name</th>
                  <th className="p-3">Designation & Role</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Contact</th>
                  <th className="p-3 text-right">Base Salary (PKR)</th>
                  <th className="p-3 text-center">Payroll Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredStaff.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-slate-400 font-medium">
                      No staff members found matching your search. Click "+ Add Staff Member" to register staff.
                    </td>
                  </tr>
                ) : (
                  filteredStaff.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-mono font-bold text-[#1F3F66]">
                      <span className="bg-[#EDF6FF] text-[#1F3F66] px-2 py-0.5 rounded border border-[#B7D7F0]">
                        {s.employeeId}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-extrabold text-[#1F3F66]">{s.firstName} {s.lastName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{s.email}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-bold text-slate-800">{s.designation}</div>
                      <span className="text-[9.5px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 uppercase">
                        {s.user?.role || 'STAFF'}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">
                      {s.department?.name || 'Mart Operations'}
                    </td>
                    <td className="p-3 font-mono text-slate-600">
                      {s.phone || 'N/A'}
                    </td>
                    <td className="p-3 text-right font-mono font-black text-emerald-700 text-sm">
                      {formatAmount(s.baseSalary || 0)}
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => {
                            setEditingStaff(s);
                            setForm({
                              name: `${s.firstName} ${s.lastName}`,
                              email: s.email,
                              password: '',
                              role: s.user?.role || 'STAFF',
                              designation: s.designation || 'Staff Nurse',
                              baseSalary: (s.baseSalary || 45000).toString(),
                              phone: s.phone || ''
                            });
                          }}
                          className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Staff Profile"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {user?.role === 'ADMIN' && (
                          <button
                            onClick={() => setDeletingStaff(s)}
                            className="p-1 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Staff Member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL: Pay / Disburse Salary Slip */}
        {payingStaff && (
          <div className="fixed inset-0 bg-[#1F3F66]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-[#B7D7F0] shadow-2xl max-w-md w-full p-5 space-y-4 my-auto max-h-[92vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center border-b border-[#B7D7F0]/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#1F3F66]">
                      Disburse Monthly Salary
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">
                      Staff: {payingStaff.firstName} {payingStaff.lastName} ({payingStaff.employeeId})
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPayingStaff(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold p-1"
                >
                  âœ•
                </button>
              </div>

              {msg.text && (
                <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                }`}>
                  {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
                  <span>{msg.text}</span>
                </div>
              )}

              <form onSubmit={handleDisburseSalary} className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Salary Month *</label>
                    <select
                      value={salaryForm.month}
                      onChange={(e) => setSalaryForm({ ...salaryForm, month: e.target.value })}
                      className="w-full bg-[#EDF6FF] border border-[#B7D7F0] rounded-xl px-2.5 py-1.5 text-[#1F3F66] font-bold focus:outline-none"
                    >
                      {MONTHS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Year *</label>
                    <input
                      type="number"
                      required
                      value={salaryForm.year}
                      onChange={(e) => setSalaryForm({ ...salaryForm, year: e.target.value })}
                      className="w-full bg-[#EDF6FF] border border-[#B7D7F0] rounded-xl px-2.5 py-1.5 text-[#1F3F66] font-bold focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Basic Salary (PKR) *</label>
                  <input
                    type="number"
                    required
                    value={salaryForm.basicSalary}
                    onChange={(e) => setSalaryForm({ ...salaryForm, basicSalary: e.target.value })}
                    className="w-full bg-[#EDF6FF] border border-[#B7D7F0] rounded-xl px-2.5 py-1.5 text-emerald-700 font-black font-mono focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Allowances / Bonus (+)</label>
                    <input
                      type="number"
                      value={salaryForm.allowances}
                      onChange={(e) => setSalaryForm({ ...salaryForm, allowances: e.target.value })}
                      className="w-full bg-[#EDF6FF] border border-[#B7D7F0] rounded-xl px-2.5 py-1.5 text-[#1F3F66] font-semibold focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Deductions / Tax (-)</label>
                    <input
                      type="number"
                      value={salaryForm.deductions}
                      onChange={(e) => setSalaryForm({ ...salaryForm, deductions: e.target.value })}
                      className="w-full bg-[#EDF6FF] border border-[#B7D7F0] rounded-xl px-2.5 py-1.5 text-red-600 font-semibold focus:outline-none"
                    />
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center">
                  <span className="font-extrabold text-emerald-900 text-xs">Net Take-Home Salary:</span>
                  <span className="font-black text-emerald-700 text-base font-mono">
                    {formatAmount(Math.max(0, (parseFloat(salaryForm.basicSalary) || 0) + (parseFloat(salaryForm.allowances) || 0) - (parseFloat(salaryForm.deductions) || 0)))}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Payment Method</label>
                    <select
                      value={salaryForm.paymentMethod}
                      onChange={(e) => setSalaryForm({ ...salaryForm, paymentMethod: e.target.value })}
                      className="w-full bg-[#EDF6FF] border border-[#B7D7F0] rounded-xl px-2.5 py-1.5 text-[#1F3F66] font-bold focus:outline-none"
                    >
                      <option value="CASH">Cash in Hand</option>
                      <option value="BANK_TRANSFER">Bank Direct Deposit</option>
                      <option value="CHEQUE">Bank Cheque</option>
                      <option value="ONLINE">Online Transfer</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Disbursement Date</label>
                    <input
                      type="date"
                      required
                      value={salaryForm.paymentDate}
                      onChange={(e) => setSalaryForm({ ...salaryForm, paymentDate: e.target.value })}
                      className="w-full bg-[#EDF6FF] border border-[#B7D7F0] rounded-xl px-2.5 py-1.5 text-[#1F3F66] font-semibold focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Payroll Remarks / Notes</label>
                  <input
                    type="text"
                    placeholder="Optional remarks (e.g. Regular monthly payout)"
                    value={salaryForm.notes}
                    onChange={(e) => setSalaryForm({ ...salaryForm, notes: e.target.value })}
                    className="w-full bg-[#EDF6FF] border border-[#B7D7F0] rounded-xl px-2.5 py-1.5 text-[#1F3F66] font-medium focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[#B7D7F0]/60">
                  <button
                    type="button"
                    onClick={() => setPayingStaff(null)}
                    className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={payingLoading}
                    className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold flex items-center gap-1.5 shadow-md disabled:opacity-50"
                  >
                    {payingLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Confirm & Print Pay Slip</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: Add / Edit Staff Profile */}
        {(showAddModal || editingStaff) && (
          <div className="fixed inset-0 bg-[#1F3F66]/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-[#B7D7F0] shadow-2xl max-w-md w-full p-5 space-y-4 my-auto max-h-[92vh] overflow-y-auto custom-scrollbar">
              <div className="flex justify-between items-center border-b border-[#B7D7F0]/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-[#1F3F66]">
                      {editingStaff ? 'Edit Staff Member Profile' : 'Register New Staff Member'}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium">
                      {editingStaff ? `Updating employee ${editingStaff.employeeId}` : 'Creates user credentials and employee profile'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingStaff(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 font-bold p-1"
                >
                  âœ•
                </button>
              </div>

              {msg.text && (
                <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                  msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                }`}>
                  {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />}
                  <span>{msg.text}</span>
                </div>
              )}

              <form onSubmit={editingStaff ? handleUpdateStaff : handleCreateStaff} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ahmad Ali"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-[#EDF6FF] border border-[#B7D7F0] rounded-xl px-2.5 py-1.5 text-[#1F3F66] font-semibold focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="staff@mart.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full bg-[#EDF6FF] border border-[#B7D7F0] rounded-xl px-2.5 py-1.5 text-[#1F3F66] font-semibold focus:outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-700 font-bold">
                        {editingStaff ? 'Update Password' : 'Password *'}
                      </label>
                      {editingStaff && (
                        <span className="text-[10px] text-slate-400 font-normal">Leave blank to keep</span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showStaffPassword ? 'text' : 'password'}
                        required={!editingStaff}
                        placeholder={editingStaff ? 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢ (leave blank to keep)' : 'â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢'}
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className="w-full bg-[#EDF6FF] border border-[#B7D7F0] rounded-xl pl-2.5 pr-8 py-1.5 text-[#1F3F66] font-semibold focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowStaffPassword(!showStaffPassword)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        title={showStaffPassword ? 'Hide password' : 'Show password'}
                      >
                        {showStaffPassword ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Designation *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Senior Cashier"
                      value={form.designation}
                      onChange={(e) => setForm({ ...form, designation: e.target.value })}
                      className="w-full bg-[#EDF6FF] border border-[#B7D7F0] rounded-xl px-2.5 py-1.5 text-[#1F3F66] font-semibold focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Base Salary (PKR) *</label>
                    <input
                      type="number"
                      required
                      placeholder="45000"
                      value={form.baseSalary}
                      onChange={(e) => setForm({ ...form, baseSalary: e.target.value })}
                      className="w-full bg-[#EDF6FF] border border-[#B7D7F0] rounded-xl px-2.5 py-1.5 text-emerald-700 font-bold font-mono focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">Phone Number</label>
                    <input
                      type="text"
                      placeholder="0300 1234567"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="w-full bg-[#EDF6FF] border border-[#B7D7F0] rounded-xl px-2.5 py-1.5 text-[#1F3F66] font-semibold focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-bold mb-1">System Portal Access</label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                      className="w-full bg-[#EDF6FF] border border-[#B7D7F0] rounded-xl px-2.5 py-1.5 text-[#1F3F66] font-bold focus:outline-none"
                    >
                      <option value="STAFF">STAFF (Staff Portal)</option>
                      <option value="FRONT_DESK">FRONT_DESK (Cashier / Front Desk)</option>
                      <option value="ACCOUNTANT">ACCOUNTANT</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-[#B7D7F0]/60">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingStaff(null);
                    }}
                    className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-extrabold shadow-md"
                  >
                    {editingStaff ? 'Update Staff Profile' : 'Create Staff Member'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Reusable Confirm Deletion Modal */}
        <ConfirmModal
          isOpen={Boolean(deletingStaff)}
          onClose={() => setDeletingStaff(null)}
          onConfirm={confirmDeleteStaff}
          title="Delete Staff Profile"
          message={`Are you sure you want to delete ${deletingStaff ? `${deletingStaff.firstName} ${deletingStaff.lastName}` : 'this staff record'}? This action will remove their user account and system access.`}
          confirmText="Delete Staff Member"
          confirmVariant="danger"
          loading={deletingLoading}
        />
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: LOGGED-IN STAFF MEMBER SELF-SERVICE PORTAL
  // =========================================================================
  const s = staffProfile?.staff || {
    employeeId: 'EMP-STF-104',
    name: user?.name || 'Staff Member',
    email: user?.email || 'staff@mart.com',
    phone: 'N/A',
    designation: 'Clinical Staff Member',
    department: 'Mart Operations'
  };

  const sal = staffProfile?.salarySummary || {
    baseSalary: 45000,
    allowances: 5000,
    deductions: 1500,
    netSalary: 48500
  };

  const salaryRecordsList = staffProfile?.salaryRecords || [];

  return (
    <div className="space-y-4 pb-12 text-xs">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-4 border border-[#B7D7F0] shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#1F3F66] to-[#5A9BD5] p-0.5 shadow-xs flex items-center justify-center">
            <div className="w-full h-full bg-[#EDF6FF] rounded-[10px] flex items-center justify-center font-black text-[#1F3F66] text-base">
              {s.name ? s.name.charAt(0).toUpperCase() : 'S'}
            </div>
          </div>
          <div>
            <h1 className="text-base font-extrabold text-[#1F3F66] flex items-center gap-2">
              <span>{s.name}</span>
              <span className="bg-[#1F3F66] text-white font-mono text-[10px] px-2 py-0.5 rounded-full font-bold">
                {s.employeeId}
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">
              {s.designation} â€¢ {s.department}
            </p>
          </div>
        </div>

        <div className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          <span>Active Staff Employment</span>
        </div>
      </div>

      {/* 4 Financial & Employment Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-[#B7D7F0] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
              Monthly Base Rate
            </span>
            <span className="text-lg font-black text-[#1F3F66] block mt-0.5 font-mono">
              {formatAmount(sal.baseSalary)}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
              Standard contract salary
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-[#EDF6FF] text-[#1F3F66] flex items-center justify-center font-bold">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-emerald-800 font-extrabold uppercase tracking-wider block">
              Estimated Take-Home
            </span>
            <span className="text-lg font-black text-emerald-950 block mt-0.5 font-mono">
              {formatAmount(sal.netSalary)}
            </span>
            <span className="text-[10px] text-emerald-700 font-semibold block mt-0.5">
              Net payout after allowances
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-purple-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-purple-800 font-extrabold uppercase tracking-wider block">
              Salary Slips Issued
            </span>
            <span className="text-lg font-black text-purple-950 block mt-0.5">
              {salaryRecordsList.length} Slips
            </span>
            <span className="text-[10px] text-purple-700 font-semibold block mt-0.5">
              Available for print
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-sky-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-sky-800 font-extrabold uppercase tracking-wider block">
              Department Unit
            </span>
            <span className="text-xs font-black text-sky-950 block mt-0.5 truncate max-w-[140px]">
              {s.department}
            </span>
            <span className="text-[10px] text-sky-700 font-semibold block mt-0.5">
              {s.designation}
            </span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
            <Building2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Col: Employee Profile & Credentials */}
        <div className="bg-white rounded-2xl p-4 border border-[#B7D7F0] shadow-xs space-y-4">
          <h3 className="font-extrabold text-[#1F3F66] text-xs border-b border-[#B7D7F0]/60 pb-2 flex items-center gap-1.5">
            <User className="w-4 h-4 text-[#5A9BD5]" />
            <span>Employee Profile Details</span>
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-400 font-semibold">Employee ID</span>
              <span className="font-mono font-bold text-[#1F3F66]">{s.employeeId}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-400 font-semibold">Official Email</span>
              <span className="font-mono font-medium text-slate-700">{s.email}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-400 font-semibold">Designation</span>
              <span className="font-bold text-slate-800">{s.designation}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100">
              <span className="text-slate-400 font-semibold">Department</span>
              <span className="font-semibold text-slate-700">{s.department}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-400 font-semibold">Employment Status</span>
              <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                ACTIVE
              </span>
            </div>
          </div>

          {/* Quick Contact & Password Update Form */}
          <div className="pt-3 border-t border-[#B7D7F0]/60 space-y-3">
            <h4 className="font-extrabold text-[#1F3F66] text-[11px]">
              Update Contact & Password
            </h4>

            {profileMsg.text && (
              <div className={`p-2.5 rounded-xl border text-[11px] font-semibold ${
                profileMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
              }`}>
                {profileMsg.text}
              </div>
            )}

            <form onSubmit={handleSaveSelfProfile} className="space-y-2.5">
              <div>
                <label className="block text-slate-500 font-bold mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="0300 1234567"
                  value={profilePhone}
                  onChange={(e) => setProfilePhone(e.target.value)}
                  className="w-full bg-[#EDF6FF] border border-[#B7D7F0] rounded-xl px-2.5 py-1.5 text-[#1F3F66] font-semibold focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1">New Password (optional)</label>
                <input
                  type="password"
                  placeholder="Leave blank to keep current"
                  value={profilePassword}
                  onChange={(e) => setProfilePassword(e.target.value)}
                  className="w-full bg-[#EDF6FF] border border-[#B7D7F0] rounded-xl px-2.5 py-1.5 text-[#1F3F66] font-semibold focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={profileSaving}
                className="w-full py-1.5 bg-[#1F3F66] hover:bg-[#5A9BD5] text-white rounded-xl font-extrabold flex items-center justify-center gap-1.5 transition-colors shadow-2xs text-xs"
              >
                {profileSaving && <RefreshCw className="w-3 h-3 animate-spin" />}
                <span>Save Credentials</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Col (2 cols): Salary Payment History & Slips */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-4 border border-[#B7D7F0] shadow-xs space-y-3">
          <div className="flex justify-between items-center border-b border-[#B7D7F0]/60 pb-2">
            <h3 className="font-extrabold text-[#1F3F66] text-xs flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-[#5A9BD5]" />
              <span>Monthly Salary Disbursement History & Pay Slips</span>
            </h3>
            <span className="text-[10px] font-bold text-slate-400">
              {salaryRecordsList.length} Recorded Slips
            </span>
          </div>

          {salaryRecordsList.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-2 bg-[#EDF6FF]/30 rounded-xl border border-dashed border-[#B7D7F0]">
              <Receipt className="w-8 h-8 text-[#5A9BD5] mx-auto" />
              <p className="font-bold text-[#1F3F66]">No Monthly Salary Slips Recorded Yet</p>
              <p className="text-[11px] text-slate-500">
                Your monthly salary records will appear here as accounts processes and disburses your monthly payroll.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#EDF6FF] text-[#1F3F66] font-extrabold uppercase border-b border-[#B7D7F0] text-[10px]">
                    <th className="p-2.5">Period</th>
                    <th className="p-2.5">Date Paid</th>
                    <th className="p-2.5 text-right">Basic</th>
                    <th className="p-2.5 text-right">Allowances</th>
                    <th className="p-2.5 text-right">Deductions</th>
                    <th className="p-2.5 text-right">Net Paid (PKR)</th>
                    <th className="p-2.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {salaryRecordsList.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-2.5 font-bold text-[#1F3F66]">
                        {rec.month} {rec.year}
                      </td>
                      <td className="p-2.5 text-slate-500">
                        {new Date(rec.paymentDate || rec.createdAt).toLocaleDateString('en-GB')}
                      </td>
                      <td className="p-2.5 text-right font-mono">
                        {formatAmount(rec.basicSalary || 0)}
                      </td>
                      <td className="p-2.5 text-right font-mono text-emerald-700">
                        +{formatAmount(rec.allowances || 0)}
                      </td>
                      <td className="p-2.5 text-right font-mono text-rose-600">
                        -{formatAmount(rec.deductions || 0)}
                      </td>
                      <td className="p-2.5 text-right font-mono font-black text-emerald-800 text-sm">
                        {formatAmount(rec.netSalary || 0)}
                      </td>
                      <td className="p-2.5 text-center">
                        <button
                          onClick={() => printStaffSalarySlip({
                            hospitalName: hospitalName || 'SUPER MART',
                            hospitalAddress: locationAddress || 'Main Commercial Street',
                            staff: s,
                            salaryRecord: rec
                          })}
                          className="px-2 py-1 bg-[#EDF6FF] hover:bg-[#B7D7F0] text-[#1F3F66] rounded-lg font-bold flex items-center gap-1 mx-auto transition-colors text-[10.5px]"
                          title="Print Official Salary Slip"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Pay Slip</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

