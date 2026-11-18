'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import api from '../lib/api';
import { useCurrency } from '../context/CurrencyContext';
import { useHospital } from '../context/HospitalContext';
import {
  Receipt,
  DollarSign,
  Calendar,
  Search,
  RefreshCw,
  Printer,
  CreditCard,
  Building2,
  Filter,
  CheckCircle2,
  X,
  FileText,
  User,
  Pill,
  TestTube,
  Baby,
  BedDouble,
  Stethoscope,
  Syringe,
  Activity,
  ArrowUpDown,
  Download,
  Copy,
  Check,
  Eye,
  Clock,
  Phone,
  ShieldCheck,
  Layers,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  RotateCcw,
  HeartPulse
} from 'lucide-react';
import { printThermalRefundReceipt } from '../lib/thermalPrint';

export default function PaymentHistoryView({ role = 'ADMIN' }) {
  const { formatAmount } = useCurrency();
  const { hospitalName, hospitalAddress, hospitalPhone } = useHospital();

  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today'); // today, yesterday, weekly, monthly, all, custom
  const [department, setDepartment] = useState('ALL');
  const [method, setMethod] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [summary, setSummary] = useState({
    totalPaymentsReceived: 0,
    totalDiscounts: 0,
    totalRefunds: 0,
    refundCount: 0,
    cashCollected: 0,
    cardOnlineCollected: 0,
    sehatCardCollected: 0,
    pharmacyCollected: 0,
    labCollected: 0,
    nurseryCollected: 0,
    ipdCollected: 0,
    gyneCollected: 0,
    nurseryIpdCollected: 0,
    frontdeskCollected: 0,
    totalTransactions: 0
  });

  const [payments, setPayments] = useState([]);
  const [selectedTx, setSelectedTx] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [pagination, setPagination] = useState({
    totalRecords: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 15
  });

  const fetchPaymentsData = async (targetPage = currentPage, targetLimit = pageSize) => {
    setLoading(true);
    try {
      let url = `/billing/payments-received?period=${period}&department=${department}&method=${method}&status=${status}&page=${targetPage}&limit=${targetLimit}`;
      if (period === 'custom' && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }

      const res = await api.get(url);
      if (res.data.success) {
        setSummary(res.data.summary || {});
        setPayments(res.data.payments || []);
        if (res.data.pagination) {
          setPagination(res.data.pagination);
          setCurrentPage(res.data.pagination.currentPage);
          setPageSize(res.data.pagination.limit);
        }
      }
    } catch (err) {
      console.error('Error fetching payments history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    fetchPaymentsData(1, pageSize);
  }, [period, department, method, status]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || (pagination.totalPages && newPage > pagination.totalPages)) return;
    setCurrentPage(newPage);
    fetchPaymentsData(newPage, pageSize);
  };

  const handlePageSizeChange = (newLimit) => {
    const lim = parseInt(newLimit, 10) || 15;
    setPageSize(lim);
    setCurrentPage(1);
    fetchPaymentsData(1, lim);
  };

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    setCurrentPage(1);
    fetchPaymentsData(1, pageSize);
  };

  const handleCopy = (text, id) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Helper to fetch all records for current period/filters for exports and full prints
  const getFullRecordsForExport = async () => {
    try {
      let url = `/billing/payments-received?period=${period}&department=${department}&method=${method}&status=${status}&allRecords=true`;
      if (period === 'custom' && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      const res = await api.get(url);
      return res.data?.payments || payments;
    } catch (err) {
      console.error('Failed to fetch all records for export:', err);
      return payments;
    }
  };

  // Export to CSV (Full filtered dataset)
  const handleExportCSV = async () => {
    const recordsToExport = await getFullRecordsForExport();
    if (!recordsToExport || !recordsToExport.length) return;

    const headers = [
      'Date & Time',
      'Transaction Ref',
      'Department',
      'Patient Name',
      'MRN',
      'Phone',
      'Description / Items',
      'Gross Amount',
      'Discount',
      'Net Payable',
      'Paid Amount',
      'Balance Due',
      'Payment Method',
      'Status',
      'Counter',
      'Collected By'
    ];

    const rows = recordsToExport.map(p => [
      `"${new Date(p.date).toLocaleString()}"`,
      `"${p.receiptNo || p.transactionNo}"`,
      `"${p.departmentLabel || p.department}"`,
      `"${p.patientName || 'N/A'}"`,
      `"${p.mrn || 'N/A'}"`,
      `"${p.phone || 'N/A'}"`,
      `"${(p.description || '').replace(/"/g, '""')}"`,
      p.grossAmount || 0,
      p.discount || 0,
      p.netPayable || 0,
      p.paidAmount || 0,
      p.balanceDue || 0,
      `"${p.paymentMethod || 'CASH'}"`,
      `"${p.paymentStatus || 'PAID'}"`,
      `"${p.paidAtCounter || 'COUNTER'}"`,
      `"${p.collectedBy || 'Staff'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Payment_History_${period}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Full Ledger Sheet (Full filtered dataset)
  const handlePrintLedger = async () => {
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Popup blocker prevented print preview. Please allow popups.');
      return;
    }

    const recordsToPrint = await getFullRecordsForExport();
    const printDate = new Date().toLocaleString('en-GB');

    const tableRows = (recordsToPrint || []).map((p, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
        <td style="padding: 6px 8px; text-align: center;">${idx + 1}</td>
        <td style="padding: 6px 8px;">${new Date(p.date).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}</td>
        <td style="padding: 6px 8px; font-family: monospace; font-weight: bold;">${p.receiptNo || p.transactionNo}</td>
        <td style="padding: 6px 8px; font-weight: bold;">${p.departmentLabel || p.department}</td>
        <td style="padding: 6px 8px;">${p.patientName} (${p.mrn || 'N/A'})</td>
        <td style="padding: 6px 8px;">${p.description}</td>
        <td style="padding: 6px 8px; text-align: right;">Rs. ${Number(p.grossAmount || 0).toLocaleString()}</td>
        <td style="padding: 6px 8px; text-align: right; color: #b45309;">${p.discount > 0 ? `-Rs. ${Number(p.discount).toLocaleString()}` : '-'}</td>
        <td style="padding: 6px 8px; text-align: right; font-weight: bold; color: #047857;">Rs. ${Number(p.paidAmount || 0).toLocaleString()}</td>
        <td style="padding: 6px 8px; text-align: center; font-weight: bold;">${p.paymentMethod}</td>
        <td style="padding: 6px 8px; text-align: center;">${p.paymentStatus}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment History Audit Report - ${hospitalName}</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; padding: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { background: #0f172a; color: #ffffff; padding: 8px; text-align: left; font-size: 11px; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div>
            <h1 style="margin: 0; font-size: 20px; text-transform: uppercase;">${hospitalName}</h1>
            <p style="margin: 2px 0; font-size: 12px; color: #475569;">${hospitalAddress} | Tel: ${hospitalPhone}</p>
            <h3 style="margin: 6px 0 0 0; color: #1e293b; font-size: 14px;">OFFICIAL PAYMENT & TRANSACTION HISTORY AUDIT LEDGER</h3>
          </div>
          <div style="text-align: right; font-size: 11px; color: #475569;">
            <p style="margin: 0;"><strong>Period:</strong> ${period.toUpperCase()}</p>
            <p style="margin: 2px 0;"><strong>Department:</strong> ${department}</p>
            <p style="margin: 2px 0;"><strong>Printed:</strong> ${printDate}</p>
          </div>
        </div>

        <div style="display: flex; gap: 15px; margin-bottom: 12px; background: #f8fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0; font-size: 12px;">
          <div><strong>Total Transactions:</strong> ${summary.totalTransactions}</div>
          <div><strong>Total Net Collections:</strong> <span style="color: #047857; font-weight: bold;">Rs. ${Number(summary.totalPaymentsReceived).toLocaleString()}</span></div>
          <div><strong>Cash:</strong> Rs. ${Number(summary.cashCollected).toLocaleString()}</div>
          <div><strong>Card/Online:</strong> Rs. ${Number(summary.cardOnlineCollected).toLocaleString()}</div>
          <div><strong>Pharmacy:</strong> Rs. ${Number(summary.pharmacyCollected).toLocaleString()}</div>
          <div><strong>Lab:</strong> Rs. ${Number(summary.labCollected).toLocaleString()}</div>
          <div><strong>Front Desk:</strong> Rs. ${Number(summary.frontdeskCollected).toLocaleString()}</div>
          <div><strong>Total Discounts:</strong> Rs. ${Number(summary.totalDiscounts).toLocaleString()}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">#</th>
              <th>Date / Time</th>
              <th>Ref No</th>
              <th>Department</th>
              <th>Patient / Customer</th>
              <th>Items / Service Description</th>
              <th style="text-align: right;">Gross</th>
              <th style="text-align: right;">Discount</th>
              <th style="text-align: right;">Paid (PKR)</th>
              <th style="text-align: center;">Method</th>
              <th style="text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div style="margin-top: 30px; display: flex; justify-content: space-between; font-size: 11px; color: #475569; border-top: 1px solid #cbd5e1; padding-top: 15px;">
          <div>Generated by Hospital Management System • Verified & Audited</div>
          <div>Authorized Accounts Signature: _______________________</div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 400);
          };
        </script>
      </body>
      </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
  };

  // Thermal Slip Receipt for an Individual Row
  const handlePrintThermalSlip = (tx) => {
    if (tx.department === 'REFUND' || tx.sourceType === 'EXPENSE_REFUND') {
      printThermalRefundReceipt({
        receiptNo: tx.receiptNo || tx.transactionNo,
        patientName: tx.patientName,
        mrn: tx.mrn,
        phone: tx.phone,
        amount: Math.abs(tx.paidAmount || tx.netPayable || 0),
        reason: tx.notes || 'Patient Cash Refund',
        itemDescription: tx.description,
        paymentMethod: tx.paymentMethod || 'CASH',
        date: tx.date
      }, { hospitalName, hospitalAddress, hospitalPhone });
      return;
    }

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Popup blocker prevented print preview. Please allow popups.');
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt - ${tx.receiptNo || tx.transactionNo}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", monospace;
            width: 80mm;
            margin: 0;
            padding: 10px 14px;
            font-size: 12px;
            line-height: 1.35;
            color: #000;
            background: #fff;
            box-sizing: border-box;
          }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .bold { font-weight: bold; }
          .header { border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px; }
          .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
          .divider { border-top: 1px dashed #000; margin: 6px 0; }
          .double-divider { border-top: 2px solid #000; border-bottom: 1px solid #000; height: 3px; margin: 8px 0; }
          .due-box { background: #eee; padding: 4px; border: 1px solid #999; margin-top: 4px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header text-center">
          <h2 style="margin: 0 0 2px 0; font-size: 16px; font-weight: 900; letter-spacing: 0.5px;">${hospitalName}</h2>
          <div style="font-size: 10px;">${hospitalAddress}</div>
          <div style="font-size: 10px;">Phone: ${hospitalPhone}</div>
          <div style="font-size: 11px; font-weight: 800; margin-top: 4px; text-transform: uppercase;">
            *** OFFICIAL PAYMENT RECEIPT ***
          </div>
          <div style="font-size: 10px; font-weight: bold; color: #333;">${tx.departmentLabel || tx.department}</div>
        </div>

        <div class="row">
          <span>Receipt No:</span>
          <span class="bold">${tx.receiptNo || tx.transactionNo}</span>
        </div>
        <div class="row">
          <span>Date:</span>
          <span>${new Date(tx.date).toLocaleDateString()} ${new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div class="row">
          <span>Patient / Cust:</span>
          <span class="bold">${tx.patientName}</span>
        </div>
        <div class="row">
          <span>MRN:</span>
          <span class="bold">${tx.mrn || 'WALK-IN'}</span>
        </div>
        ${tx.phone && tx.phone !== 'N/A' ? `<div class="row"><span>Phone:</span><span>${tx.phone}</span></div>` : ''}

        <div class="divider"></div>

        <div style="font-weight: bold; font-size: 11px; margin-bottom: 4px;">SERVICES / MEDICINES:</div>
        <div style="font-size: 11px; padding: 2px 0;">${tx.description}</div>

        <div class="double-divider"></div>

        <div class="row">
          <span>Gross Billed:</span>
          <span>Rs. ${Number(tx.grossAmount || 0).toLocaleString()}</span>
        </div>
        ${tx.discount > 0 ? `
          <div class="row" style="font-weight: bold;">
            <span>Discount Concession:</span>
            <span>- Rs. ${Number(tx.discount).toLocaleString()}</span>
          </div>
          <div class="row" style="font-weight: bold;">
            <span>Net Payable:</span>
            <span>Rs. ${Number(tx.netPayable || 0).toLocaleString()}</span>
          </div>
        ` : ''}
        <div class="row bold" style="font-size: 13px; margin-top: 4px;">
          <span>TOTAL PAID:</span>
          <span>Rs. ${Number(tx.paidAmount || 0).toLocaleString()}</span>
        </div>
        <div class="row">
          <span>Payment Method:</span>
          <span>${tx.paymentMethod}</span>
        </div>
        <div class="row">
          <span>Counter / Cashier:</span>
          <span>${tx.collectedBy || tx.paidAtCounter || 'Cashier'}</span>
        </div>

        <div class="divider"></div>

        ${tx.balanceDue > 0 ? `
          <div class="row due-box">
            <span>REMAINING DUE:</span>
            <span>Rs. ${Number(tx.balanceDue).toLocaleString()}</span>
          </div>
        ` : `
          <div class="text-center bold" style="margin: 6px 0; font-size: 11px;">
            ✓ DUES FULLY PAID & SETTLED
          </div>
        `}

        <div style="font-size: 9px; text-align: center; margin-top: 12px; color: #333;">
          Thank you for choosing ${hospitalName}.<br/>
          Computer generated verified slip • No signature required.
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() { window.print(); }, 350);
          };
        </script>
      </body>
      </html>
    `;

    printWin.document.write(html);
    printWin.document.close();
  };

  // Department Badges styling helper
  const getDeptBadge = (dept) => {
    switch (dept) {
      case 'PHARMACY':
        return {
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          icon: Pill,
          label: 'Pharmacy'
        };
      case 'LABORATORY':
        return {
          bg: 'bg-purple-100 text-purple-800 border-purple-300',
          icon: TestTube,
          label: 'Laboratory'
        };
      case 'NURSERY':
        return {
          bg: 'bg-pink-100 text-pink-800 border-pink-300',
          icon: Baby,
          label: 'Nursery / NICU'
        };
      case 'IPD':
        return {
          bg: 'bg-indigo-100 text-indigo-800 border-indigo-300',
          icon: BedDouble,
          label: 'Inpatient (IPD)'
        };
      case 'OPD':
        return {
          bg: 'bg-sky-100 text-sky-800 border-sky-300',
          icon: Stethoscope,
          label: 'OPD Consult'
        };
      case 'SURGERY':
        return {
          bg: 'bg-rose-100 text-rose-800 border-rose-300',
          icon: Syringe,
          label: 'OT Surgery'
        };
      case 'SERVICES':
        return {
          bg: 'bg-cyan-100 text-cyan-800 border-cyan-300',
          icon: Activity,
          label: 'Clinical Srv'
        };
      case 'REFUND':
        return {
          bg: 'bg-rose-100 text-rose-800 border-rose-300',
          icon: RotateCcw,
          label: 'Refund'
        };
      case 'GYNECOLOGY':
      case 'GYNE':
        return {
          bg: 'bg-rose-100 text-rose-800 border-rose-300',
          icon: HeartPulse,
          label: 'Gyne & Maternity'
        };
      default:
        return {
          bg: 'bg-blue-100 text-blue-800 border-blue-300',
          icon: Building2,
          label: 'Front Desk'
        };
    }
  };



  return (
    <div className="space-y-5">
      {/* 1. TOP HEADER & ACTION BAR */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#1F3F66] text-white flex items-center justify-center shadow-xs">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Payment History & Transaction Ledger
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                  LIVE AUDIT
                </span>
              </h1>
              <p className="text-xs font-bold text-slate-500">
                Hospital-wide audit trail of all payments across Front Desk, Pharmacy, Laboratory, Nursery, IPD, and OPD.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          <button
            onClick={fetchPaymentsData}
            disabled={loading}
            className="py-2 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
            title="Refresh Ledger"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            href={role === 'FRONTDESK' ? '/frontdesk/reports' : '/admin/reports'}
            className="py-2 px-3.5 bg-blue-50 hover:bg-blue-100 text-[#1F3F66] border border-blue-200 font-extrabold rounded-xl text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="Open Complete Master Financial & Shift Reports"
          >
            <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
            <span>Master Reports</span>
          </Link>

          <button
            onClick={handleExportCSV}
            disabled={!payments.length}
            className="py-2 px-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-extrabold rounded-xl text-xs inline-flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrintLedger}
            disabled={!payments.length}
            className="py-2 px-4 bg-[#1F3F66] hover:bg-[#162e4a] text-white font-extrabold rounded-xl text-xs inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Audit Sheet</span>
          </button>
        </div>
      </div>

      {/* 2. EXECUTIVE METRIC KPI CARDS — 2 rows × 4 columns */}
      <div className="space-y-3">
        {/* Row 1: Revenue + Departments */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-3">
          {/* Total Net Revenue */}
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-2xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-emerald-800 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">Total Net Revenue</span>
              <DollarSign className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-emerald-950 font-mono">
              {formatAmount(summary.totalPaymentsReceived)}
            </div>
            <div className="text-[10px] font-bold text-emerald-700 mt-0.5">
              {summary.totalTransactions} Total Receipts
            </div>
          </div>

          {/* Front Desk & OPD Collections */}
          <div className="bg-white border border-blue-200 rounded-2xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-blue-700 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">Front Desk & OPD</span>
              <Building2 className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-slate-900 font-mono">
              {formatAmount(summary.frontdeskCollected)}
            </div>
            <div className="text-[10px] font-bold text-blue-600 mt-0.5">
              OPD & Desk Settlements
            </div>
          </div>

          {/* Pharmacy Counter & Dues */}
          <div className="bg-white border border-teal-200 rounded-2xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-teal-700 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">Pharmacy Sales</span>
              <Pill className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-slate-900 font-mono">
              {formatAmount(summary.pharmacyCollected)}
            </div>
            <div className="text-[10px] font-bold text-teal-600 mt-0.5">
              POS & Credit Recoveries
            </div>
          </div>

          {/* Laboratory Diagnostics */}
          <div className="bg-white border border-purple-200 rounded-2xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-purple-700 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">Lab Diagnostics</span>
              <TestTube className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-slate-900 font-mono">
              {formatAmount(summary.labCollected)}
            </div>
            <div className="text-[10px] font-bold text-purple-600 mt-0.5">
              Pathology Test Fees
            </div>
          </div>
        </div>

        {/* Row 2: Nursery + IPD + Gyne + Discounts + Refunds */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* Nursery & NICU */}
          <div className="bg-white border border-pink-200 rounded-2xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-pink-700 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">Nursery & NICU</span>
              <Baby className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-slate-900 font-mono">
              {formatAmount(summary.nurseryCollected)}
            </div>
            <div className="text-[10px] font-bold text-pink-600 mt-0.5">
              NICU & Baby Unit Fees
            </div>
          </div>

          {/* IPD Inpatient */}
          <div className="bg-white border border-indigo-200 rounded-2xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-indigo-700 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">IPD Inpatient</span>
              <BedDouble className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-slate-900 font-mono">
              {formatAmount(summary.ipdCollected)}
            </div>
            <div className="text-[10px] font-bold text-indigo-600 mt-0.5">
              Ward & Inpatient Stays
            </div>
          </div>

          {/* Gynecology & Maternity */}
          <div className="bg-white border border-rose-200 rounded-2xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-rose-700 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">Gyne & Maternity</span>
              <HeartPulse className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-slate-900 font-mono">
              {formatAmount(summary.gyneCollected)}
            </div>
            <div className="text-[10px] font-bold text-rose-600 mt-0.5">
              Maternity & Deliveries
            </div>
          </div>

          {/* Discounts Concession */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 shadow-2xs">
            <div className="flex items-center justify-between text-amber-800 mb-1">
              <span className="text-[11px] font-black uppercase tracking-wider">Discounts Given</span>
              <Receipt className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-amber-950 font-mono">
              - {formatAmount(summary.totalDiscounts)}
            </div>
            <div className="text-[10px] font-bold text-amber-700 mt-0.5">
              Total Concessions
            </div>
          </div>

          {/* Patient Refunds — ALWAYS VISIBLE KPI */}
          <div className={`rounded-2xl p-3.5 shadow-2xs border transition-all ${
            summary.totalRefunds > 0
              ? 'bg-rose-50 border-rose-300 ring-1 ring-rose-200'
              : 'bg-slate-50/60 border-slate-200'
          }`}>
            <div className={`flex items-center justify-between mb-1 ${
              summary.totalRefunds > 0 ? 'text-rose-800' : 'text-slate-500'
            }`}>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider">Cash Refunds</span>
                {summary.totalRefunds > 0 && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                  </span>
                )}
              </div>
              <RotateCcw className="w-4 h-4" />
            </div>
            <div className={`text-lg font-black font-mono ${
              summary.totalRefunds > 0 ? 'text-rose-700' : 'text-slate-400'
            }`}>
              {summary.totalRefunds > 0 ? `- ${formatAmount(summary.totalRefunds)}` : formatAmount(0)}
            </div>
            <div className={`text-[10px] font-bold mt-0.5 ${
              summary.totalRefunds > 0 ? 'text-rose-600' : 'text-slate-400'
            }`}>
              {summary.refundCount > 0
                ? `${summary.refundCount} Voucher${summary.refundCount !== 1 ? 's' : ''} • Deducted from Cash`
                : 'No Refunds This Period'}
            </div>
          </div>
        </div>
      </div>

      {/* 3. MULTI-LEVEL FILTER CONTROLS */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        {/* Dropdown Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Time Period Filter */}
          <div>
            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Time Period
            </label>
            <select
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-300/80 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all cursor-pointer shadow-2xs"
            >
              <option value="today">Today (Default)</option>
              <option value="yesterday">Yesterday</option>
              <option value="weekly">Last 7 Days</option>
              <option value="monthly">This Month</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Department Counter Filter */}
          <div>
            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              Department Counter
            </label>
            <select
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-300/80 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all cursor-pointer shadow-2xs"
            >
              <option value="ALL">All Counters</option>
              <option value="PHARMACY">Pharmacy</option>
              <option value="LABORATORY">Laboratory</option>
              <option value="NURSERY">Nursery / NICU</option>
              <option value="FRONTDESK">Front Desk & OPD</option>
              <option value="IPD">Inpatient Wards</option>
              <option value="GYNECOLOGY">Gynecology & Maternity</option>
              <option value="SURGERY">OT Surgeries</option>
              <option value="SERVICES">Clinical Services</option>
              <option value="REFUND">Patient Cash Refunds</option>
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-blue-600" />
              Payment Method
            </label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-300/80 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all cursor-pointer shadow-2xs"
            >
              <option value="ALL">All Payment Methods</option>
              <option value="CASH">Cash Payment at Desk</option>
              <option value="CARD">Credit / Debit Card POS</option>
              <option value="ONLINE">Bank Transfer / Online</option>
              <option value="SEHAT_CARD">Sehat Sahulat Card</option>
            </select>
          </div>

          {/* Settlement Status Filter */}
          <div>
            <label className="block text-[10px] font-black text-slate-600 uppercase mb-1 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
              Settlement Status
            </label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-300/80 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all cursor-pointer shadow-2xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="PAID">Fully Paid</option>
              <option value="PARTIAL">Partial Payment</option>
              <option value="DUE_RECOVERY">Dues Recovery Receipt</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>
        </div>

        {/* Custom Range (Conditional) & Live Search */}
        <div className="flex flex-col md:flex-row items-stretch md:items-end gap-3 pt-1 border-t border-slate-100">
          {period === 'custom' && (
            <div className="flex items-center gap-2 bg-blue-50/70 p-2 rounded-xl border border-blue-200">
              <span className="text-[11px] font-black text-blue-900 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" /> Range:
              </span>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="py-1 px-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-xs font-bold text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="py-1 px-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => {
                  setCurrentPage(1);
                  fetchPaymentsData(1, pageSize);
                }}
                disabled={!startDate || !endDate}
                className="py-1 px-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-lg text-xs cursor-pointer disabled:opacity-50 transition-all shadow-2xs"
              >
                Apply
              </button>
            </div>
          )}

          {/* Search Input Bar */}
          <form onSubmit={handleSearch} className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search patient, MRN, transaction / invoice #, phone, service..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setTimeout(() => {
                      setCurrentPage(1);
                      fetchPaymentsData(1, pageSize);
                    }, 50);
                  }}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button
              type="submit"
              className="py-2 px-4 bg-[#1F3F66] hover:bg-[#162e4a] text-white font-extrabold rounded-xl text-xs h-[34px] cursor-pointer shadow-xs transition-all whitespace-nowrap"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* 4. TRANSACTION AUDIT TABLE */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {/* Table Header Controls */}
        <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex justify-between items-center flex-wrap gap-2">
          <div>
            <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#1F3F66]" />
              <span>Unified Transaction History Audit Trail</span>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-black">
                {pagination.totalRecords} Entries
              </span>
            </h2>
            <p className="text-[11px] text-slate-500 font-bold mt-0.5">
              Live chronological register across all hospital points of collection
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">Rows per page:</span>
            <select
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 rounded-lg py-1 px-2 text-xs font-extrabold text-slate-800 cursor-pointer focus:ring-1 focus:ring-blue-500"
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>

        {/* Table View with Row Margins and Card Shadows */}
        <div className="overflow-x-auto p-3.5 sm:p-5 bg-slate-50/60">
          <table className="w-full text-left border-separate border-spacing-y-2.5">
            <thead>
              <tr className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                <th className="pb-1 px-3.5">Date & Time</th>
                <th className="pb-1 px-3">Transaction / Ref</th>
                <th className="pb-1 px-3">Department</th>
                <th className="pb-1 px-3">Customer / Patient</th>
                <th className="pb-1 px-3">Dispensed Items / Service</th>
                <th className="pb-1 px-3 text-right">Billed & Discount</th>
                <th className="pb-1 px-3 text-right">Paid Amount</th>
                <th className="pb-1 px-3">Payment Method</th>
                <th className="pb-1 px-3 text-center">Status</th>
                <th className="pb-1 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {loading && payments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                    <span className="font-extrabold">Loading transaction ledger records...</span>
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200/80 shadow-xs">
                    <Receipt className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-extrabold text-slate-700">No payment transactions found.</p>
                    <p className="text-[11px] text-slate-400">Try adjusting your filters or date range.</p>
                  </td>
                </tr>
              ) : (
                payments.map(tx => {
                  const deptBadge = getDeptBadge(tx.department);
                  const DeptIcon = deptBadge.icon;

                  return (
                    <tr
                      key={tx.id}
                      className="bg-white hover:bg-blue-50/40 transition-all duration-150 shadow-xs hover:shadow-md group rounded-xl"
                    >
                      {/* Date & Time */}
                      <td className="py-3 px-3.5 whitespace-nowrap border-y border-l border-slate-200/90 first:rounded-l-xl">
                        <div className="font-bold text-slate-900">
                          {new Date(tx.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Transaction / Receipt No */}
                      <td className="py-3 px-3 whitespace-nowrap border-y border-slate-200/90">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-[#1F3F66] text-[11px]">
                            {tx.receiptNo || tx.transactionNo}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(tx.receiptNo || tx.transactionNo, tx.id)}
                            className="text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
                            title="Copy Ref No"
                          >
                            {copiedId === tx.id ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <div className="text-[9.5px] text-slate-400 font-medium">
                          Counter: {tx.paidAtCounter || 'COUNTER'}
                        </div>
                      </td>

                      {/* Department Badge */}
                      <td className="py-3 px-3 whitespace-nowrap border-y border-slate-200/90">
                        <span className={`inline-flex items-center gap-1 py-0.5 px-2 rounded-md font-extrabold text-[10px] border ${deptBadge.bg}`}>
                          <DeptIcon className="w-3 h-3" />
                          {deptBadge.label}
                        </span>
                      </td>

                      {/* Customer / Patient Details */}
                      <td className="py-3 px-3 border-y border-slate-200/90">
                        <div className="font-black text-slate-900 leading-tight">
                          {tx.patientName}
                        </div>
                        <div className="text-[10.5px] text-slate-500 font-mono">
                          {tx.mrn && tx.mrn !== 'WALK-IN' ? `MRN: ${tx.mrn}` : 'Walk-In'}
                          {tx.phone && tx.phone !== 'N/A' && ` • ${tx.phone}`}
                        </div>
                      </td>

                      {/* Dispensed Items / Service Description */}
                      <td className="py-3 px-3 max-w-xs border-y border-slate-200/90">
                        <div className="font-bold text-slate-800 line-clamp-1 text-[11.5px]" title={tx.description}>
                          {tx.description}
                        </div>
                        <div className="text-[9.5px] text-slate-400 italic">
                          {tx.notes || tx.category}
                        </div>
                      </td>

                      {/* Gross & Discount */}
                      <td className="py-3 px-3 text-right whitespace-nowrap border-y border-slate-200/90">
                        <div className="font-mono text-slate-700 font-bold text-[11px]">
                          {formatAmount(tx.grossAmount || tx.paidAmount)}
                        </div>
                        {tx.discount > 0 && (
                          <div className="font-mono text-[10px] font-black text-amber-700">
                            Disc: -{formatAmount(tx.discount)}
                          </div>
                        )}
                      </td>

                      {/* Paid Amount */}
                      <td className="py-3 px-3 text-right whitespace-nowrap border-y border-slate-200/90">
                        {tx.paidAmount < 0 || tx.paymentStatus === 'REFUNDED' ? (
                          <>
                            <div className="font-mono font-black text-rose-600 text-[12.5px]">
                              - {formatAmount(Math.abs(tx.paidAmount))}
                            </div>
                            <div className="text-[9px] font-bold text-rose-500">
                              Refund Disbursed
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="font-mono font-black text-emerald-800 text-[12.5px]">
                              {formatAmount(tx.paidAmount)}
                            </div>
                            {tx.balanceDue > 0 ? (
                              <div className="text-[9.5px] font-extrabold text-rose-600">
                                Due: {formatAmount(tx.balanceDue)}
                              </div>
                            ) : (
                              <div className="text-[9px] font-bold text-emerald-600">
                                ✓ Fully Settled
                              </div>
                            )}
                          </>
                        )}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3 px-3 whitespace-nowrap border-y border-slate-200/90">
                        <span className="font-extrabold text-[#1F3F66] text-[11px] block">
                          {tx.paymentMethod}
                        </span>
                        <span className="text-[9.5px] text-slate-400">
                          By: {tx.collectedBy || 'Cashier'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center whitespace-nowrap border-y border-slate-200/90">
                        {tx.paymentStatus === 'REFUNDED' ? (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-900 border border-rose-300 rounded-md font-black text-[9.5px]">
                            REFUNDED
                          </span>
                        ) : tx.paymentStatus === 'PAID' ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-md font-black text-[9.5px]">
                            PAID
                          </span>
                        ) : tx.paymentStatus === 'DUE_RECOVERY' ? (
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-300 rounded-md font-black text-[9.5px]">
                            DUES REC
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-md font-black text-[9.5px]">
                            PARTIAL
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-center whitespace-nowrap border-y border-r border-slate-200/90 last:rounded-r-xl">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handlePrintThermalSlip(tx)}
                            className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg cursor-pointer transition-all"
                            title="Print 80mm Thermal Receipt Slip"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setSelectedTx(tx)}
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg cursor-pointer transition-all"
                            title="View Full Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
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

        {/* Server-Driven Pagination Footer */}
        {pagination.totalRecords > 0 && (
          <div className="p-3.5 bg-slate-50/70 border-t border-slate-200 flex justify-between items-center flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-500">
                Showing {Math.min((currentPage - 1) * pageSize + 1, pagination.totalRecords)} to {Math.min(currentPage * pageSize, pagination.totalRecords)} of {pagination.totalRecords} total entries
              </span>
              <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={e => handlePageSizeChange(e.target.value)}
                  className="bg-white border border-slate-300 rounded-lg py-1 px-2 text-xs font-bold text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value={10}>10</option>
                  <option value={15}>15</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handlePageChange(1)}
                disabled={currentPage <= 1}
                className="py-1 px-2.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 disabled:opacity-40 cursor-pointer hover:bg-slate-50 text-[11px]"
                title="First Page"
              >
                First
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="py-1 px-2.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 disabled:opacity-40 cursor-pointer hover:bg-slate-50 inline-flex items-center gap-0.5"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <span className="px-2.5 font-black text-slate-800">
                Page {currentPage} of {pagination.totalPages || 1}
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= (pagination.totalPages || 1)}
                className="py-1 px-2.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 disabled:opacity-40 cursor-pointer hover:bg-slate-50 inline-flex items-center gap-0.5"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handlePageChange(pagination.totalPages)}
                disabled={currentPage >= (pagination.totalPages || 1)}
                className="py-1 px-2.5 bg-white border border-slate-300 rounded-lg font-bold text-slate-700 disabled:opacity-40 cursor-pointer hover:bg-slate-50 text-[11px]"
                title="Last Page"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. TRANSACTION DETAILS MODAL */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200 space-y-4">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-wider">
                  Transaction Details
                </span>
                <h3 className="text-base font-black text-slate-900">
                  {selectedTx.receiptNo || selectedTx.transactionNo}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 font-bold block">Patient / Customer:</span>
                  <span className="font-extrabold text-slate-900 text-sm">{selectedTx.patientName}</span>
                  <div className="text-[11px] text-slate-500 font-mono">MRN: {selectedTx.mrn || 'WALK-IN'}</div>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Department Counter:</span>
                  <span className="font-extrabold text-[#1F3F66]">{selectedTx.departmentLabel}</span>
                  <div className="text-[11px] text-slate-500">Collected by: {selectedTx.collectedBy}</div>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-bold block mb-1">Service & Item Details:</span>
                <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 font-semibold text-slate-800">
                  {selectedTx.description}
                </div>
              </div>

              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-500">Gross Billed Amount:</span>
                  <span className="font-mono text-slate-800">{formatAmount(selectedTx.grossAmount)}</span>
                </div>
                {selectedTx.discount > 0 && (
                  <div className="flex justify-between font-bold text-amber-700">
                    <span>Discount Concession:</span>
                    <span className="font-mono">- {formatAmount(selectedTx.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold">
                  <span className="text-slate-500">Net Payable:</span>
                  <span className="font-mono text-slate-900">{formatAmount(selectedTx.netPayable)}</span>
                </div>
                <div className="flex justify-between font-black text-sm text-emerald-800 pt-1 border-t border-slate-200">
                  <span>Total Amount Paid:</span>
                  <span className="font-mono">{formatAmount(selectedTx.paidAmount)}</span>
                </div>
                {selectedTx.balanceDue > 0 ? (
                  <div className="flex justify-between font-extrabold text-rose-600 pt-0.5">
                    <span>Outstanding Dues Remaining:</span>
                    <span className="font-mono">{formatAmount(selectedTx.balanceDue)}</span>
                  </div>
                ) : (
                  <div className="flex justify-between font-extrabold text-emerald-700 pt-0.5">
                    <span>Clearance Status:</span>
                    <span>✓ FULLY PAID & SETTLED</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div>
                  <span className="text-slate-400 font-bold block">Payment Method:</span>
                  <span className="font-black text-slate-800">{selectedTx.paymentMethod}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Date & Time:</span>
                  <span className="font-mono text-slate-700">{new Date(selectedTx.date).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handlePrintThermalSlip(selectedTx)}
                className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Print Thermal Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-xl text-xs cursor-pointer"
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
