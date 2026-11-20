'use client';

import React, { useState, useEffect } from 'react';
import Header from '../../components/Header';
import Sidebar from '../../components/Sidebar';
import api from '../../lib/api';
import { useHospital } from '../../context/StoreContext';
import { useAuth } from '../../context/AuthContext';
import {
  Banknote,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  X,
  History,
  Clock,
  UserCheck
} from 'lucide-react';

export default function RegisterShiftsPage() {
  const { user } = useAuth();
  const { currencySymbol } = useHospital();

  const [currentShift, setCurrentShift] = useState(null);
  const [shiftsHistory, setShiftsHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openingCash, setOpeningCash] = useState('5000');

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingCash, setClosingCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');

  const [showCashMovementModal, setShowCashMovementModal] = useState(false);
  const [movementType, setMovementType] = useState('CASH_OUT');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');

  const fetchShiftData = async () => {
    try {
      setLoading(true);
      const [currRes, histRes] = await Promise.all([
        api.get('/register/current-shift'),
        api.get('/register/shifts')
      ]);

      if (currRes.data?.success) setCurrentShift(currRes.data.shift || null);
      if (histRes.data?.success) setShiftsHistory(histRes.data.shifts || []);
    } catch (err) {
      console.error('Fetch register error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShiftData();
  }, []);

  const handleOpenShift = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/register/open-shift', {
        openingCash: parseFloat(openingCash) || 0
      });
      if (res.data?.success) {
        setShowOpenModal(false);
        fetchShiftData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to open shift.');
    }
  };

  const handleCloseShift = async (e) => {
    e.preventDefault();
    if (!currentShift) return;

    try {
      const res = await api.post('/register/close-shift', {
        shiftId: currentShift.id,
        closingCash: parseFloat(closingCash) || 0,
        notes: closeNotes
      });
      if (res.data?.success) {
        setShowCloseModal(false);
        alert(res.data.message);
        fetchShiftData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to close shift.');
    }
  };

  const handleCashMovement = async (e) => {
    e.preventDefault();
    if (!currentShift || !movementAmount) return;

    try {
      const res = await api.post('/register/cash-movement', {
        shiftId: currentShift.id,
        type: movementType,
        amount: parseFloat(movementAmount),
        reason: movementReason
      });
      if (res.data?.success) {
        setShowCashMovementModal(false);
        setMovementAmount('');
        setMovementReason('');
        fetchShiftData();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record cash movement.');
    }
  };

  const expectedInDrawer = currentShift
    ? currentShift.openingCash + currentShift.cashSales + currentShift.cashIn - currentShift.cashOut
    : 0;

  return (
    <div className="flex h-screen bg-slate-950 text-white overflow-hidden">
      <Sidebar />

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <Banknote className="w-6 h-6 text-emerald-400" />
                <span>Cash Register & Shift Drawer</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Track cashier drawer opening float, cash sales, petty expenses, and end-of-shift audits
              </p>
            </div>
          </div>

          {/* Active Shift Card or Open Shift Prompt */}
          {currentShift ? (
            <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400">
                    <Unlock className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-extrabold text-white">
                        Active Shift: {currentShift.shiftNo}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                        OPEN
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Cashier: <strong className="text-white">{currentShift.cashierName}</strong> • Opened:{' '}
                      {new Date(currentShift.openedAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowCashMovementModal(true)}
                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition-colors"
                  >
                    Cash In / Out
                  </button>
                  <button
                    onClick={() => {
                      setClosingCash(expectedInDrawer.toString());
                      setShowCloseModal(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-xs font-bold text-white shadow-lg shadow-rose-500/20 transition-colors"
                  >
                    Close Shift
                  </button>
                </div>
              </div>

              {/* Drawer Financials Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Opening Float</div>
                  <div className="text-lg font-black font-mono text-white mt-0.5">
                    {currencySymbol} {currentShift.openingCash}
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Cash Sales</div>
                  <div className="text-lg font-black font-mono text-emerald-400 mt-0.5">
                    {currencySymbol} {currentShift.cashSales}
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800">
                  <div className="text-[10px] uppercase font-bold text-slate-400">Petty Cash Out</div>
                  <div className="text-lg font-black font-mono text-rose-400 mt-0.5">
                    -{currencySymbol} {currentShift.cashOut}
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-2xl border border-emerald-500/30">
                  <div className="text-[10px] uppercase font-bold text-emerald-400">Expected in Drawer</div>
                  <div className="text-lg font-black font-mono text-emerald-400 mt-0.5">
                    {currencySymbol} {expectedInDrawer}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 text-center space-y-4">
              <div className="inline-flex p-3 rounded-full bg-slate-800 text-slate-400">
                <Lock className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">No Active Cash Register Shift</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Open your cash drawer shift before beginning POS checkout to ensure accurate float reconciliation.
                </p>
              </div>
              <button
                onClick={() => setShowOpenModal(true)}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-emerald-500/20"
              >
                Open Register Shift
              </button>
            </div>
          )}

          {/* Past Shifts History */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" />
              <span>Shift Reconciliation History</span>
            </h3>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Shift No</th>
                      <th className="p-3">Cashier</th>
                      <th className="p-3">Opened</th>
                      <th className="p-3">Closed</th>
                      <th className="p-3 text-right">Expected</th>
                      <th className="p-3 text-right">Actual Count</th>
                      <th className="p-3 text-right">Difference</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {shiftsHistory.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center text-slate-500">
                          No closed shifts recorded yet.
                        </td>
                      </tr>
                    ) : (
                      shiftsHistory.map(s => (
                        <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-mono text-emerald-400 font-bold">{s.shiftNo}</td>
                          <td className="p-3 font-bold text-white">{s.cashierName}</td>
                          <td className="p-3 text-slate-400">{new Date(s.openedAt).toLocaleTimeString()}</td>
                          <td className="p-3 text-slate-400">
                            {s.closedAt ? new Date(s.closedAt).toLocaleTimeString() : '—'}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-300">
                            {currencySymbol} {s.expectedCash || 0}
                          </td>
                          <td className="p-3 text-right font-mono text-white font-bold">
                            {currencySymbol} {s.closingCash || 0}
                          </td>
                          <td className="p-3 text-right font-mono font-bold">
                            <span className={s.difference >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                              {s.difference >= 0 ? '+' : ''}
                              {currencySymbol} {s.difference || 0}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                s.status === 'OPEN'
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {s.status}
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
        </div>
      </div>

      {/* =========================================
          OPEN SHIFT MODAL
      ========================================== */}
      {showOpenModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Open Cash Register Shift</h3>
              <button onClick={() => setShowOpenModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOpenShift} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Opening Float Cash ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  placeholder="5000"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOpenModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-slate-950"
                >
                  Open Drawer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================
          CLOSE SHIFT MODAL
      ========================================== */}
      {showCloseModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">Close Register & Audit</h3>
                <p className="text-xs text-slate-400 font-mono">{currentShift?.shiftNo}</p>
              </div>
              <button onClick={() => setShowCloseModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCloseShift} className="space-y-3">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs flex justify-between">
                <span className="text-slate-400">Calculated Expected Cash:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {currencySymbol} {expectedInDrawer}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Physical Cash Counted ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-xs font-bold text-white"
                >
                  Close & Reconcile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================
          CASH IN / OUT MODAL
      ========================================== */}
      {showCashMovementModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">Cash Drawer Movement</h3>
              <button
                onClick={() => setShowCashMovementModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCashMovement} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Type</label>
                <select
                  value={movementType}
                  onChange={(e) => setMovementType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="CASH_OUT">Cash Out (Petty Cash / Staff Tea / Expense)</option>
                  <option value="CASH_IN">Cash In (Float Replenishment)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Amount ({currencySymbol}) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={movementAmount}
                  onChange={(e) => setMovementAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Reason</label>
                <input
                  type="text"
                  required
                  value={movementReason}
                  onChange={(e) => setMovementReason(e.target.value)}
                  placeholder="e.g. Shopping bags purchase"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCashMovementModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-xs text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-xs font-bold text-slate-950"
                >
                  Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

