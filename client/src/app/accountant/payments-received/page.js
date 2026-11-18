'use client';

import React, { useState, useEffect } from 'react';
import api from '../../../lib/api';
import { useCurrency } from '../../../context/CurrencyContext';
import { useHospital } from '../../../context/HospitalContext';
import {
  Receipt,
  DollarSign,
  Calendar,
  Search,
  RefreshCw,
  Printer,
  CreditCard,
  Building2,
  ChevronDown,
  Filter,
  CheckCircle2,
  X,
  FileText,
  User
} from 'lucide-react';

export default function AccountantPaymentsReceivedPage() {
  const { formatAmount } = useCurrency();
  const { hospitalName } = useHospital();

  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today'); // today, yesterday, weekly, monthly, all, custom
  const [method, setMethod] = useState('ALL'); // ALL, CASH, CARD, SEHAT_CARD
  const [category, setCategory] = useState('ALL'); // ALL, OPD, IPD, LAB, PHARMACY, SURGERY
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [summary, setSummary] = useState({
    totalPaymentsReceived: 0,
    cashCollected: 0,
    cardOnlineCollected: 0,
    sehatCardCollected: 0,
    totalTransactions: 0
  });

  const [payments, setPayments] = useState([]);
  const [selectedReceipt, setSelectedReceipt] = useState(null);

  const fetchPaymentsData = async () => {
    setLoading(true);
    try {
      let url = `/billing/payments-received?period=${period}&method=${method}&category=${category}`;
      if (period === 'custom' && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      if (searchQuery) {
        url += `&search=${encodeURIComponent(searchQuery)}`;
      }

      const res = await api.get(url);
      if (res.data.success) {
        setSummary(res.data.summary || {});
        setPayments(res.data.payments || []);
      }
    } catch (err) {
      console.error('Error fetching payments received:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPaymentsData();
  }, [period, method, category]);

  const handleCustomDateSubmit = (e) => {
    e.preventDefault();
    if (startDate && endDate) {
      setPeriod('custom');
      fetchPaymentsData();
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchPaymentsData();
  };

  // Printable Receipt Generator
  const handlePrintReceipt = (payment) => {
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Popup blocker prevented print preview. Please allow popups.');
      return;
    }

    const printDate = new Date().toLocaleString('en-GB');

    const contentHtml = `
      <div style="border-bottom:2px solid #0f172a; padding-bottom:8px; margin-bottom:12px;">
        <h2 style="margin:0; color:#0f172a; text-transform:uppercase; font-size:16px;">${hospitalName}</h2>
        <p style="margin:2px 0 0 0; font-size:10px; color:#475569; font-weight:bold;">OFFICIAL PAYMENT RECEIPT & ACKNOWLEDGEMENT</p>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:10px; margin-bottom:12px; background:#f8fafc; padding:10px; border-radius:6px; border:1px solid #cbd5e1;">
        <div><strong>Receipt #:</strong> ${payment.receiptNo}</div>
        <div><strong>Date & Time:</strong> ${new Date(payment.date).toLocaleString('en-GB')}</div>
        <div><strong>Patient Name:</strong> ${payment.patientName}</div>
        <div><strong>MRN / Reg No:</strong> ${payment.mrn}</div>
        <div><strong>Service Department:</strong> ${payment.category}</div>
        <div><strong>Payment Method:</strong> ${payment.paymentMethod}</div>
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:9.5px; margin-bottom:12px;">
        <thead>
          <tr style="background:#f1f5f9; text-align:left;">
            <th style="padding:6px; border:1px solid #cbd5e1;">Transaction Category</th>
            <th style="padding:6px; border:1px solid #cbd5e1;">Details / Description</th>
            <th style="padding:6px; border:1px solid #cbd5e1; text-align:right;">Amount Paid</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:6px; border:1px solid #cbd5e1;">${payment.category}</td>
            <td style="padding:6px; border:1px solid #cbd5e1;">${payment.notes || 'Payment Settlement Received'}</td>
            <td style="padding:6px; border:1px solid #cbd5e1; text-align:right;"><strong>${formatAmount(payment.paidAmount)}</strong></td>
          </tr>
        </tbody>
      </table>
      <div style="background:#f0fdf4; border:1px solid #86efac; padding:8px 12px; border-radius:6px; text-align:right; font-size:12px; font-weight:bold; color:#166534;">
        Total Paid Collection: ${formatAmount(payment.paidAmount)}
      </div>
    `;

    const fullHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment_Receipt_${payment.receiptNo}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #0f172a; }
            .signature-area { margin-top: 35px; display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; }
          </style>
        </head>
        <body>
          ${contentHtml}
          <div class="signature-area">
            <div style="border-top:1px solid #000; width:140px; text-align:center; padding-top:3px;">Collected By: ${payment.receivedBy}</div>
            <div style="border-top:1px solid #000; width:140px; text-align:center; padding-top:3px;">Accountant / Cashier Stamp</div>
          </div>
          <script>
            setTimeout(function() { window.focus(); window.print(); }, 350);
          </script>
        </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(fullHtml);
    printWin.document.close();
    printWin.focus();

    try {
      printWin.onafterprint = () => {
        try { printWin.close(); } catch(e) {}
      };
    } catch(e) {}

    setTimeout(() => {
      try {
        printWin.focus();
        printWin.print();
      } catch(e) {}
    }, 400);
  };

  return (
    <div className="space-y-3 pb-8 text-[11px] text-slate-600">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-xs space-y-2.5">
        {/* Row 1: Title Banner */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Receipt className="w-3.5 h-3.5" />
            </div>
            <div>
              <h1 className="text-xs font-bold text-slate-800 tracking-tight">Payments Received & Cash Collections</h1>
              <p className="text-[10px] text-slate-400">
                Itemized log of all revenue collections across OPD, IPD, Pharmacy, Lab, and OT Procedures
              </p>
            </div>
          </div>

          <button
            onClick={fetchPaymentsData}
            disabled={loading}
            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors flex items-center gap-1 text-[10px] font-medium"
            title="Refresh payments list"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Row 2: Floating Select Filters (Right-Aligned) */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 text-[11px] pt-0.5">
          {/* Floating Select 1: Date Period */}
          <div className="relative min-w-[140px] flex-1 sm:flex-none">
            <label className="absolute -top-1.5 left-2 px-1 bg-white text-[8.5px] font-semibold tracking-wider text-emerald-600 z-10">
              Date Period
            </label>
            <div className="relative flex items-center">
              <Calendar className="w-3 h-3 absolute left-2 text-slate-400 pointer-events-none" />
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full pl-7 pr-6 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white appearance-none cursor-pointer hover:border-slate-300 transition-colors"
              >
                <option value="today">Today (Daily)</option>
                <option value="yesterday">Yesterday</option>
                <option value="weekly">This Week (7 Days)</option>
                <option value="monthly">Last 30 Days</option>
                <option value="all">All Time</option>
                <option value="custom">Custom Date Range</option>
              </select>
              <ChevronDown className="w-3 h-3 absolute right-1.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Floating Select 2: Payment Method */}
          <div className="relative min-w-[140px] flex-1 sm:flex-none">
            <label className="absolute -top-1.5 left-2 px-1 bg-white text-[8.5px] font-semibold tracking-wider text-emerald-600 z-10">
              Payment Method
            </label>
            <div className="relative flex items-center">
              <DollarSign className="w-3 h-3 absolute left-2 text-slate-400 pointer-events-none" />
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full pl-7 pr-6 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white appearance-none cursor-pointer hover:border-slate-300 transition-colors"
              >
                <option value="ALL">All Methods</option>
                <option value="CASH">Cash Collection</option>
                <option value="CARD">Card / Online</option>
                <option value="SEHAT_CARD">Sehat Card / Panel</option>
              </select>
              <ChevronDown className="w-3 h-3 absolute right-1.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Floating Select 3: Service Category */}
          <div className="relative min-w-[150px] flex-1 sm:flex-none">
            <label className="absolute -top-1.5 left-2 px-1 bg-white text-[8.5px] font-semibold tracking-wider text-emerald-600 z-10">
              Department Category
            </label>
            <div className="relative flex items-center">
              <Filter className="w-3 h-3 absolute left-2 text-slate-400 pointer-events-none" />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full pl-7 pr-6 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:bg-white appearance-none cursor-pointer hover:border-slate-300 transition-colors"
              >
                <option value="ALL">All Departments</option>
                <option value="OPD">OPD Consultation</option>
                <option value="IPD">IPD Admissions</option>
                <option value="PHARMACY">Pharmacy Store</option>
                <option value="LAB">Lab Diagnostics</option>
                <option value="SURGERY">Surgeries & OT</option>
              </select>
              <ChevronDown className="w-3 h-3 absolute right-1.5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Custom Date Inputs */}
          {period === 'custom' && (
            <form onSubmit={handleCustomDateSubmit} className="flex items-center gap-1.5 bg-slate-50 p-1 border border-slate-200 rounded-lg">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-medium text-slate-700 focus:outline-none focus:border-emerald-500"
              />
              <span className="text-slate-400 text-[9px]">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-medium text-slate-700 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-medium rounded transition-colors"
              >
                Apply
              </button>
            </form>
          )}
        </div>
      </div>

      {/* WHITE KPI CARDS with Soft Shadows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* KPI 1: Total Payments Received */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 shadow-xs flex items-center justify-between hover:border-emerald-200 transition-colors">
          <div className="space-y-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Total Received</span>
            <div className="text-sm font-bold text-slate-800">
              {loading ? '...' : formatAmount(summary.totalPaymentsReceived || 0)}
            </div>
            <div className="text-[9.5px] text-slate-400 font-normal">{summary.totalTransactions || 0} Transactions</div>
          </div>
          <div className="p-2 rounded-lg bg-emerald-50/80 text-emerald-600 border border-emerald-100/60">
            <Receipt className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* KPI 2: Cash Collections */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 shadow-xs flex items-center justify-between hover:border-green-200 transition-colors">
          <div className="space-y-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Cash Collections</span>
            <div className="text-sm font-bold text-slate-800">
              {loading ? '...' : formatAmount(summary.cashCollected || 0)}
            </div>
            <div className="text-[9.5px] text-slate-400 font-normal">Physical Cash Drawer</div>
          </div>
          <div className="p-2 rounded-lg bg-green-50/80 text-green-600 border border-green-100/60">
            <DollarSign className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* KPI 3: Card / Online Collections */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 shadow-xs flex items-center justify-between hover:border-indigo-200 transition-colors">
          <div className="space-y-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Card & Online</span>
            <div className="text-sm font-bold text-slate-800">
              {loading ? '...' : formatAmount(summary.cardOnlineCollected || 0)}
            </div>
            <div className="text-[9.5px] text-slate-400 font-normal">POS & Bank Transfers</div>
          </div>
          <div className="p-2 rounded-lg bg-indigo-50/80 text-indigo-600 border border-indigo-100/60">
            <CreditCard className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* KPI 4: Sehat Card / Insurance Claims */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-2.5 shadow-xs flex items-center justify-between hover:border-cyan-200 transition-colors">
          <div className="space-y-0.5">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Sehat Card Claims</span>
            <div className="text-sm font-bold text-cyan-700">
              {loading ? '...' : formatAmount(summary.sehatCardCollected || 0)}
            </div>
            <div className="text-[9.5px] text-slate-400 font-normal">Government Panel Clearance</div>
          </div>
          <div className="p-2 rounded-lg bg-cyan-50/80 text-cyan-600 border border-cyan-100/60">
            <Building2 className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* Main Content Table & Search Bar */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden">
        {/* Search & Filter Bar */}
        <div className="p-2.5 border-b border-slate-100 bg-slate-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="text-xs font-bold text-slate-700">
            Itemized Payments List ({payments.length} Records)
          </div>

          <form onSubmit={handleSearchSubmit} className="relative min-w-[220px]">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search receipt #, patient or MRN..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-2.5 py-1 bg-white border border-slate-200/80 rounded-lg text-[10px] font-normal text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            />
          </form>
        </div>

        {/* Payments Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-[10px] flex items-center justify-center gap-1.5">
              <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
              <span>Fetching payment records...</span>
            </div>
          ) : payments.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-[10px]">
              No payments received matching selected filters.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-[10px] min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/70 text-slate-400 font-semibold uppercase tracking-wider text-[9px] border-b border-slate-100">
                  <th className="py-2 px-3 font-semibold">Receipt # & Date</th>
                  <th className="py-2 px-3 font-semibold">Patient Name & MRN</th>
                  <th className="py-2 px-3 font-semibold">Department / Category</th>
                  <th className="py-2 px-3 font-semibold">Method</th>
                  <th className="py-2 px-3 font-semibold">Amount Paid</th>
                  <th className="py-2 px-3 font-semibold">Received By</th>
                  <th className="py-2 px-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600 font-normal">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-2 px-3">
                      <div className="font-mono font-semibold text-emerald-700 text-[10.5px]">{p.receiptNo}</div>
                      <div className="text-[9px] text-slate-400">{new Date(p.date).toLocaleString('en-GB')}</div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-semibold text-slate-700 text-[11px]">{p.patientName}</div>
                      <div className="text-[9.5px] text-slate-400 font-normal">MRN: {p.mrn}</div>
                    </td>
                    <td className="py-2 px-3">
                      <div className="font-medium text-slate-700">{p.category}</div>
                      <div className="text-[9px] text-slate-400">{p.notes || '-'}</div>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`text-[9.5px] font-semibold px-2 py-0.5 rounded border ${
                        p.paymentMethod === 'CASH'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : p.paymentMethod === 'SEHAT_CARD'
                          ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
                          : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      }`}>
                        {p.paymentMethod}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-800">
                      {formatAmount(p.paidAmount)}
                    </td>
                    <td className="py-2 px-3 font-medium text-slate-600">
                      {p.receivedBy}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setSelectedReceipt(p)}
                          className="px-2 py-0.5 bg-slate-100/70 hover:bg-slate-200/80 text-slate-600 rounded text-[9.5px] font-medium transition-colors border border-slate-200/50"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handlePrintReceipt(p)}
                          className="p-1 bg-emerald-50/70 hover:bg-emerald-100/80 text-emerald-600 rounded transition-colors border border-emerald-100/50"
                          title="Print Official Payment Receipt"
                        >
                          <Printer className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* RECEIPT DETAILS MODAL */}
      {selectedReceipt && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="bg-white rounded-xl max-w-md w-full p-4 space-y-3 shadow-lg border border-slate-200 text-[11px]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-xs font-semibold text-slate-800">Receipt #{selectedReceipt.receiptNo}</h3>
                <p className="text-[9.5px] text-slate-400">{new Date(selectedReceipt.date).toLocaleString('en-GB')}</p>
              </div>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-lg border border-slate-200/60 text-[10px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Patient Name:</span>
                <strong className="text-slate-800">{selectedReceipt.patientName}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">MRN:</span>
                <strong className="text-slate-800">{selectedReceipt.mrn}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Department:</span>
                <strong className="text-slate-800">{selectedReceipt.category}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment Method:</span>
                <strong className="text-emerald-700">{selectedReceipt.paymentMethod}</strong>
              </div>
              <div className="flex justify-between border-t border-slate-200/80 pt-1 text-xs">
                <span className="font-bold text-slate-700">Amount Received:</span>
                <strong className="text-emerald-700">{formatAmount(selectedReceipt.paidAmount)}</strong>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1 border-t border-slate-100">
              <button
                onClick={() => handlePrintReceipt(selectedReceipt)}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-medium rounded-md flex items-center gap-1"
              >
                <Printer className="w-3 h-3" />
                <span>Print Receipt</span>
              </button>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-medium rounded-md"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
