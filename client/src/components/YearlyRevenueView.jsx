'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Printer,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  X,
  Stethoscope,
  TestTube,
  Pill,
  BedDouble,
  Baby,
  Syringe,
  Activity,
  Receipt,
  Banknote,
  Percent,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Building2,
  BadgeDollarSign
} from 'lucide-react';
import api from '../lib/api';
import { useStore } from '../context/StoreContext';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function YearlyRevenueView({ basePath = '/admin' }) {
  const { storeName, locationAddress, phone } = useStore();

  const currentSystemYear = new Date().getFullYear();
  const currentSystemMonth = new Date().getMonth() + 1; // 1-12

  const [selectedYear, setSelectedYear] = useState(currentSystemYear);
  const [loading, setLoading] = useState(true);
  const [rawReportData, setRawReportData] = useState(null);
  const [cache, setCache] = useState({});

  // Modal State
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [modalTab, setModalTab] = useState('overview'); // 'overview' | 'daily'
  const [showActiveDaysOnly, setShowActiveDaysOnly] = useState(true);

  // Available years: past 2 years, current, and next 2 years
  const availableYears = useMemo(() => {
    const years = [];
    for (let y = currentSystemYear - 2; y <= currentSystemYear + 2; y++) {
      years.push(y);
    }
    return years;
  }, [currentSystemYear]);

  // Fetch yearly data
  const fetchYearlyData = async (yearToFetch, forceRefresh = false) => {
    if (!forceRefresh && cache[yearToFetch]) {
      setRawReportData(cache[yearToFetch]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const token = typeof window !== 'undefined'
        ? (localStorage.getItem('hms_token') || localStorage.getItem('token'))
        : null;

      const headers = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-auth-token'] = token;
      }

      const response = await api.get(`/billing/yearly-revenue?year=${yearToFetch}`, { headers });
      const resData = response.data;

      if (resData && (resData.success || resData.months || resData.data)) {
        const payload = resData.data || resData;
        setRawReportData(payload);
        setCache(prev => ({ ...prev, [yearToFetch]: payload }));
      }
    } catch (error) {
      console.error('Error fetching yearly revenue report:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchYearlyData(selectedYear);
  }, [selectedYear]);

  const handlePrevYear = () => {
    setSelectedYear(prev => prev - 1);
  };

  const handleNextYear = () => {
    setSelectedYear(prev => prev + 1);
  };

  const handleCurrentYear = () => {
    setSelectedYear(currentSystemYear);
  };

  const handleRefresh = () => {
    fetchYearlyData(selectedYear, true);
  };

  const openMonthModal = (month) => {
    setSelectedMonth(month);
    setModalTab('overview');
    setShowActiveDaysOnly(true);
  };

  const closeMonthModal = () => {
    setSelectedMonth(null);
  };

  // Build robust 12 Calendar Months: ALWAYS 12 rows like a calendar
  const calendarMonths = useMemo(() => {
    const fetchedMonths = rawReportData?.months || [];
    const monthsMap = {};
    fetchedMonths.forEach(m => {
      if (m && m.monthNumber) {
        monthsMap[m.monthNumber] = m;
      }
    });

    return MONTH_NAMES.map((name, idx) => {
      const monthNum = idx + 1;
      const existing = monthsMap[monthNum];

      if (existing) {
        return {
          ...existing,
          monthNumber: monthNum,
          monthName: existing.monthName || name,
          shortName: existing.shortName || name.slice(0, 3),
          year: existing.year || selectedYear,
          daysCount: existing.daysCount || new Date(selectedYear, idx + 1, 0).getDate()
        };
      }

      // Default blank calendar month with clean zeroes
      const daysCount = new Date(selectedYear, idx + 1, 0).getDate();
      return {
        monthIndex: idx,
        monthNumber: monthNum,
        monthName: name,
        shortName: name.slice(0, 3),
        year: selectedYear,
        periodLabel: `${name} ${selectedYear}`,
        daysCount,
        opdRevenue: 0,
        opdCount: 0,
        labRevenue: 0,
        labGross: 0,
        labDiscount: 0,
        labCount: 0,
        pharmacySales: 0,
        pharmacyGross: 0,
        pharmacyDiscount: 0,
        pharmacyDuesCollected: 0,
        pharmacyReturns: 0,
        pharmacyNetRevenue: 0,
        pharmacyCount: 0,
        servicesRevenue: 0,
        servicesGross: 0,
        servicesDiscount: 0,
        servicesCount: 0,
        ipdRevenue: 0,
        ipdGross: 0,
        ipdCount: 0,
        nurseryRevenue: 0,
        nurseryGross: 0,
        nurseryDiscount: 0,
        nurseryCount: 0,
        surgeryRevenue: 0,
        surgeryGross: 0,
        surgeryDiscount: 0,
        surgeryCount: 0,
        grossBilled: 0,
        discountsTotal: 0,
        refundsTotal: 0,
        netRevenue: 0,
        hospitalExpenses: 0,
        expensesCount: 0,
        salariesDisbursed: 0,
        salariesCount: 0,
        advancesDisbursed: 0,
        totalExpenses: 0,
        netProfit: 0,
        profitMargin: 0,
        totalTransactions: 0,
        paymentMethods: {
          CASH: 0,
          BANK_TRANSFER: 0,
          ONLINE: 0,
          CARD: 0,
          SEHAT_CARD: 0,
          OTHER: 0
        },
        dailyBreakdown: []
      };
    });
  }, [rawReportData, selectedYear]);

  // Robust Summary Calculation (from server or computed from 12 calendar months)
  const summary = useMemo(() => {
    const s = rawReportData?.yearSummary || rawReportData?.annualSummary || {};

    const totalNetRevenue = s.totalAnnualNetRevenue ?? s.totalNetRevenue ?? calendarMonths.reduce((sum, m) => sum + (m.netRevenue || 0), 0);
    const totalGrossBilled = s.totalAnnualGross ?? s.totalGrossBilled ?? calendarMonths.reduce((sum, m) => sum + (m.grossBilled || 0), 0);
    const totalExpenses = s.totalAnnualOutflows ?? s.totalExpenses ?? calendarMonths.reduce((sum, m) => sum + (m.totalExpenses || 0), 0);
    const hospitalExpenses = s.totalAnnualExpenses ?? s.hospitalExpenses ?? calendarMonths.reduce((sum, m) => sum + (m.hospitalExpenses || 0), 0);
    const salariesDisbursed = s.totalAnnualSalaries ?? s.salariesDisbursed ?? calendarMonths.reduce((sum, m) => sum + (m.salariesDisbursed || 0), 0);
    const advancesDisbursed = s.totalAnnualAdvances ?? s.advancesDisbursed ?? calendarMonths.reduce((sum, m) => sum + (m.advancesDisbursed || 0), 0);
    const netProfit = s.netAnnualProfit ?? s.netProfit ?? (totalNetRevenue - totalExpenses);
    const profitMargin = totalNetRevenue > 0
      ? (s.annualProfitMargin ?? s.profitMargin ?? parseFloat(((netProfit / totalNetRevenue) * 100).toFixed(1)))
      : 0;
    const totalTransactions = s.totalAnnualTransactions ?? s.totalTransactions ?? calendarMonths.reduce((sum, m) => sum + (m.totalTransactions || 0), 0);

    const departmentTotals = s.departmentalTotals || s.departmentTotals || {
      opd: calendarMonths.reduce((sum, m) => sum + (m.opdRevenue || 0), 0),
      lab: calendarMonths.reduce((sum, m) => sum + (m.labRevenue || 0), 0),
      pharmacy: calendarMonths.reduce((sum, m) => sum + (m.pharmacyNetRevenue || 0), 0),
      services: calendarMonths.reduce((sum, m) => sum + (m.servicesRevenue || 0), 0),
      ipd: calendarMonths.reduce((sum, m) => sum + (m.ipdRevenue || 0), 0),
      nursery: calendarMonths.reduce((sum, m) => sum + (m.nurseryRevenue || 0), 0),
      surgery: calendarMonths.reduce((sum, m) => sum + (m.surgeryRevenue || 0), 0)
    };

    // Find Best Performing Month
    const activeMonths = calendarMonths.filter(m => (m.netRevenue || 0) > 0);
    let bestMonth = s.bestMonth;
    if (!bestMonth && activeMonths.length > 0) {
      bestMonth = activeMonths.reduce((prev, curr) => (curr.netRevenue > prev.netRevenue ? curr : prev), activeMonths[0]);
    }

    return {
      totalNetRevenue,
      totalGrossBilled,
      totalExpenses,
      hospitalExpenses,
      salariesDisbursed,
      advancesDisbursed,
      netProfit,
      profitMargin,
      totalTransactions,
      departmentTotals,
      bestMonth
    };
  }, [rawReportData, calendarMonths]);

  // CSV Export for the 12-Month Annual Data
  const handleExportCSV = () => {
    const headers = [
      'Month Number',
      'Month Name',
      'Year',
      'OPD Revenue (Rs)',
      'OPD Patients',
      'Lab Revenue (Rs)',
      'Lab Tests',
      'Pharmacy Net Revenue (Rs)',
      'Pharmacy Orders',
      'IPD Revenue (Rs)',
      'IPD Admissions',
      'Nursery Revenue (Rs)',
      'Nursery Admissions',
      'Surgery Revenue (Rs)',
      'Surgery Cases',
      'Clinical Services Revenue (Rs)',
      'Gross Billed (Rs)',
      'Discounts (Rs)',
      'Refunds (Rs)',
      'Net Revenue (Rs)',
      'Operating Expenses (Rs)',
      'Salaries Disbursed (Rs)',
      'Advances Disbursed (Rs)',
      'Total Expenses (Rs)',
      'Net Profit (Rs)',
      'Profit Margin (%)',
      'Total Transactions'
    ];

    const rows = calendarMonths.map(m => [
      m.monthNumber,
      m.monthName,
      m.year,
      m.opdRevenue,
      m.opdCount,
      m.labRevenue,
      m.labCount,
      m.pharmacyNetRevenue,
      m.pharmacyCount,
      m.ipdRevenue,
      m.ipdCount,
      m.nurseryRevenue,
      m.nurseryCount,
      m.surgeryRevenue,
      m.surgeryCount,
      m.servicesRevenue,
      m.grossBilled,
      m.discountsTotal,
      m.refundsTotal,
      m.netRevenue,
      m.hospitalExpenses,
      m.salariesDisbursed,
      m.advancesDisbursed,
      m.totalExpenses,
      m.netProfit,
      `${m.profitMargin}%`,
      m.totalTransactions
    ]);

    // Grand Total Row
    rows.push([
      'ANNUAL TOTAL',
      `Full Year ${selectedYear}`,
      selectedYear,
      summary.departmentTotals?.opd || 0,
      '',
      summary.departmentTotals?.lab || 0,
      '',
      summary.departmentTotals?.pharmacy || 0,
      '',
      summary.departmentTotals?.ipd || 0,
      '',
      summary.departmentTotals?.nursery || 0,
      '',
      summary.departmentTotals?.surgery || 0,
      '',
      summary.departmentTotals?.services || 0,
      summary.totalGrossBilled || 0,
      '',
      '',
      summary.totalNetRevenue || 0,
      summary.hospitalExpenses || 0,
      summary.salariesDisbursed || 0,
      summary.advancesDisbursed || 0,
      summary.totalExpenses || 0,
      summary.netProfit || 0,
      `${summary.profitMargin || 0}%`,
      summary.totalTransactions || 0
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Super_Mart_Annual_Financial_Report_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Monthly Audit Statement
  const handlePrintMonthlyStatement = (month) => {
    if (!month) return;

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Pop-up blocked. Please allow pop-ups to print reports.');
      return;
    }

    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${month.monthName} ${month.year} - Monthly Financial Statement</title>
          <style>
            @page { size: A4 portrait; margin: 12mm 15mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; margin: 0; padding: 15px; font-size: 11pt; }
            .header { text-align: center; border-bottom: 2px solid #1F3F66; padding-bottom: 12px; margin-bottom: 15px; }
            .header h1 { margin: 0 0 4px 0; font-size: 18pt; color: #1F3F66; text-transform: uppercase; letter-spacing: 0.5px; }
            .header p { margin: 2px 0; font-size: 9.5pt; color: #64748b; }
            .doc-title { background: #EDF6FF; border: 1px solid #B7D7F0; padding: 8px 12px; margin: 12px 0; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
            .doc-title h2 { margin: 0; font-size: 13pt; color: #1F3F66; }
            .doc-title span { font-size: 9pt; color: #475569; font-weight: 600; }
            
            .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 15px; }
            .kpi-box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; background: #f8fafc; text-align: center; }
            .kpi-label { font-size: 8pt; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 4px; }
            .kpi-val { font-size: 14pt; font-weight: 800; color: #0f172a; }
            .kpi-sub { font-size: 7.5pt; color: #64748b; margin-top: 2px; }

            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 9pt; }
            th { background: #1F3F66; color: white; text-align: left; padding: 6px 8px; font-weight: 600; font-size: 8.5pt; }
            td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
            tr:nth-child(even) { background-color: #f8fafc; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .font-bold { font-weight: bold; }
            .total-row { background: #e2e8f0 !important; font-weight: bold; border-top: 2px solid #94a3b8; }

            .section-heading { font-size: 11pt; font-weight: bold; color: #1F3F66; border-bottom: 1.5px solid #cbd5e1; padding-bottom: 4px; margin: 15px 0 6px 0; }
            .signatures { margin-top: 40px; display: flex; justify-content: space-between; padding: 0 20px; }
            .sig-box { text-align: center; width: 180px; }
            .sig-line { border-top: 1px solid #0f172a; margin-top: 45px; margin-bottom: 4px; }
            .sig-title { font-size: 8.5pt; font-weight: bold; color: #475569; text-transform: uppercase; }

            @media print {
              body { padding: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${storeName || 'SUPER MART POINT OF SALE & INVENTORY'}</h1>
            <p>${locationAddress || 'Main Commercial Boulevard'} | Tel: ${phone || 'N/A'}</p>
            <p style="font-size: 8.5pt; color: #94a3b8;">Official Certified Financial Audit Statement</p>
          </div>

          <div class="doc-title">
            <h2>Monthly Revenue & Financial Performance Audit</h2>
            <span>Period: ${month.monthName} ${month.year} (${month.daysCount} Days)</span>
          </div>

          <div class="kpi-grid">
            <div class="kpi-box">
              <div class="kpi-label">Gross Billed Revenue</div>
              <div class="kpi-val">Rs. ${(month.grossBilled || 0).toLocaleString()}</div>
              <div class="kpi-sub">Total Services Invoiced</div>
            </div>
            <div class="kpi-box" style="border-color: #10b981; background: #ecfdf5;">
              <div class="kpi-label" style="color: #065f46;">Net Revenue Collected</div>
              <div class="kpi-val" style="color: #065f46;">Rs. ${(month.netRevenue || 0).toLocaleString()}</div>
              <div class="kpi-sub" style="color: #047857;">Actual Collections</div>
            </div>
            <div class="kpi-box" style="border-color: #f43f5e; background: #fff1f2;">
              <div class="kpi-label" style="color: #9f1239;">Operating Outflows</div>
              <div class="kpi-val" style="color: #9f1239;">Rs. ${(month.totalExpenses || 0).toLocaleString()}</div>
              <div class="kpi-sub" style="color: #be123c;">Expenses & Salaries</div>
            </div>
            <div class="kpi-box" style="border-color: #3b82f6; background: #eff6ff;">
              <div class="kpi-label" style="color: #1e40af;">Net Operating Profit</div>
              <div class="kpi-val" style="color: #1e40af;">Rs. ${(month.netProfit || 0).toLocaleString()}</div>
              <div class="kpi-sub" style="color: #2563eb;">Margin: ${month.profitMargin || 0}%</div>
            </div>
          </div>

          <div class="section-heading">Departmental Revenue Breakdown</div>
          <table>
            <thead>
              <tr>
                <th>Department / Service Division</th>
                <th class="text-center">Count / Cases</th>
                <th class="text-right">Gross Invoiced (Rs)</th>
                <th class="text-right">Net Collected (Rs)</th>
                <th class="text-right">% of Month Revenue</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="font-bold">OPD Doctor Consultations</td>
                <td class="text-center">${month.opdCount || 0} Patients</td>
                <td class="text-right">${(month.opdRevenue || 0).toLocaleString()}</td>
                <td class="text-right font-bold">${(month.opdRevenue || 0).toLocaleString()}</td>
                <td class="text-right">${month.netRevenue > 0 ? (((month.opdRevenue || 0) / month.netRevenue) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr>
                <td class="font-bold">Pathology & Clinical Laboratory</td>
                <td class="text-center">${month.labCount || 0} Tests</td>
                <td class="text-right">${(month.labGross || month.labRevenue || 0).toLocaleString()}</td>
                <td class="text-right font-bold">${(month.labRevenue || 0).toLocaleString()}</td>
                <td class="text-right">${month.netRevenue > 0 ? (((month.labRevenue || 0) / month.netRevenue) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr>
                <td class="font-bold">Pharmacy & Medical POS Counter</td>
                <td class="text-center">${month.pharmacyCount || 0} Sales</td>
                <td class="text-right">${(month.pharmacyGross || month.pharmacyNetRevenue || 0).toLocaleString()}</td>
                <td class="text-right font-bold">${(month.pharmacyNetRevenue || 0).toLocaleString()}</td>
                <td class="text-right">${month.netRevenue > 0 ? (((month.pharmacyNetRevenue || 0) / month.netRevenue) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr>
                <td class="font-bold">IPD Inpatient Admissions & Wards</td>
                <td class="text-center">${month.ipdCount || 0} Admissions</td>
                <td class="text-right">${(month.ipdGross || month.ipdRevenue || 0).toLocaleString()}</td>
                <td class="text-right font-bold">${(month.ipdRevenue || 0).toLocaleString()}</td>
                <td class="text-right">${month.netRevenue > 0 ? (((month.ipdRevenue || 0) / month.netRevenue) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr>
                <td class="font-bold">Nursery & NICU Neonatal Station</td>
                <td class="text-center">${month.nurseryCount || 0} Neonates</td>
                <td class="text-right">${(month.nurseryGross || month.nurseryRevenue || 0).toLocaleString()}</td>
                <td class="text-right font-bold">${(month.nurseryRevenue || 0).toLocaleString()}</td>
                <td class="text-right">${month.netRevenue > 0 ? (((month.nurseryRevenue || 0) / month.netRevenue) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr>
                <td class="font-bold">Clinical Services & Radiology</td>
                <td class="text-center">${month.servicesCount || 0} Procedures</td>
                <td class="text-right">${(month.servicesGross || month.servicesRevenue || 0).toLocaleString()}</td>
                <td class="text-right font-bold">${(month.servicesRevenue || 0).toLocaleString()}</td>
                <td class="text-right">${month.netRevenue > 0 ? (((month.servicesRevenue || 0) / month.netRevenue) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr>
                <td class="font-bold">Operation Theatre (OT) Surgeries</td>
                <td class="text-center">${month.surgeryCount || 0} Surgeries</td>
                <td class="text-right">${(month.surgeryGross || month.surgeryRevenue || 0).toLocaleString()}</td>
                <td class="text-right font-bold">${(month.surgeryRevenue || 0).toLocaleString()}</td>
                <td class="text-right">${month.netRevenue > 0 ? (((month.surgeryRevenue || 0) / month.netRevenue) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr class="total-row">
                <td>TOTAL DEPARTMENTAL COLLECTIONS</td>
                <td class="text-center font-bold">${month.totalTransactions || 0} Cases</td>
                <td class="text-right">${(month.grossBilled || 0).toLocaleString()}</td>
                <td class="text-right font-bold">Rs. ${(month.netRevenue || 0).toLocaleString()}</td>
                <td class="text-right">100.0%</td>
              </tr>
            </tbody>
          </table>

          <div class="section-heading" style="margin-top: 18px;">Operating Expenses & Payroll Disbursements</div>
          <table>
            <thead>
              <tr>
                <th>Expense Classification</th>
                <th class="text-center">Vouchers / Staff</th>
                <th class="text-right">Total Outflow (Rs)</th>
                <th class="text-right">% of Total Expenses</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="font-bold">Store General & Operating Expenses</td>
                <td class="text-center">${month.expensesCount || 0} Vouchers</td>
                <td class="text-right font-bold">${(month.hospitalExpenses || 0).toLocaleString()}</td>
                <td class="text-right">${month.totalExpenses > 0 ? (((month.hospitalExpenses || 0) / month.totalExpenses) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr>
                <td class="font-bold">Staff Salaries & Payroll Disbursed</td>
                <td class="text-center">${month.salariesCount || 0} Disbursed</td>
                <td class="text-right font-bold">${(month.salariesDisbursed || 0).toLocaleString()}</td>
                <td class="text-right">${month.totalExpenses > 0 ? (((month.salariesDisbursed || 0) / month.totalExpenses) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr>
                <td class="font-bold">Staff Advance Payments</td>
                <td class="text-center">-</td>
                <td class="text-right font-bold">${(month.advancesDisbursed || 0).toLocaleString()}</td>
                <td class="text-right">${month.totalExpenses > 0 ? (((month.advancesDisbursed || 0) / month.totalExpenses) * 100).toFixed(1) : 0}%</td>
              </tr>
              <tr class="total-row">
                <td>TOTAL OPERATING OUTFLOWS</td>
                <td class="text-center font-bold">-</td>
                <td class="text-right font-bold" style="color: #9f1239;">Rs. ${(month.totalExpenses || 0).toLocaleString()}</td>
                <td class="text-right">100.0%</td>
              </tr>
            </tbody>
          </table>

          <div class="signatures">
            <div class="sig-box">
              <div class="sig-line"></div>
              <div class="sig-title">Prepared By (Accountant)</div>
            </div>
            <div class="sig-box">
              <div class="sig-line"></div>
              <div class="sig-title">Store Manager</div>
            </div>
            <div class="sig-box">
              <div class="sig-line"></div>
              <div class="sig-title">Owner / Managing Director</div>
            </div>
          </div>

          <div style="text-align: center; margin-top: 25px; font-size: 8pt; color: #94a3b8;">
            Generated on: ${new Date().toLocaleString()} • Super Mart POS Automated Financial Audit
          </div>
        </body>
      </html>
    `;

    printWin.document.write(printHtml);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 400);
  };

  return (
    <div className="space-y-5 pb-12">
      {/* 1. Page Header & Year Controls */}
      <div className="bg-white rounded-2xl p-4 md:p-6 border border-[#B7D7F0]/60 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-2 bg-[#EDF6FF] rounded-xl text-[#1F3F66] border border-[#B7D7F0]/60">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black text-[#1F3F66] tracking-tight">
                Annual & Monthly Revenue Analytics
              </h1>
              <p className="text-xs md:text-sm text-slate-500 font-medium">
                Comprehensive 12-month calendar performance, department collections, operating expenses, and net profit for <span className="font-bold text-[#1F3F66]">{selectedYear}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Year Selector & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Year Switcher */}
          <div className="flex items-center bg-[#EDF6FF]/70 p-1 rounded-xl border border-[#B7D7F0]/80">
            <button
              onClick={handlePrevYear}
              className="p-1.5 rounded-lg text-[#1F3F66] hover:bg-white transition hover:shadow-2xs"
              title="Previous Year"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="relative mx-1">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="appearance-none bg-white text-[#1F3F66] font-extrabold text-sm pl-3 pr-7 py-1.5 rounded-lg border border-[#B7D7F0] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#5A9BD5]/40 shadow-2xs"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>
                    Year {y}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            <button
              onClick={handleNextYear}
              className="p-1.5 rounded-lg text-[#1F3F66] hover:bg-white transition hover:shadow-2xs"
              title="Next Year"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {selectedYear !== currentSystemYear && (
            <button
              onClick={handleCurrentYear}
              className="px-3 py-1.5 bg-white text-xs font-bold text-[#1F3F66] border border-[#B7D7F0] rounded-xl hover:bg-[#EDF6FF] transition shadow-2xs"
            >
              Current Year ({currentSystemYear})
            </button>
          )}

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition border border-slate-300"
            title="Reload data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#1F3F66]' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-2xs disabled:opacity-50"
            title="Download CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. Top Executive Annual KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Total Hospital Income */}
        <div className="bg-gradient-to-br from-[#1F3F66] via-[#1b375a] to-slate-900 text-white p-4 rounded-2xl shadow-sm border border-[#1F3F66] relative overflow-hidden">
          <div className="absolute right-3 top-3 bg-white/10 p-2 rounded-xl backdrop-blur-xs">
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">
            Total Money Collected (Income {selectedYear})
          </span>
          <h2 className="text-2xl font-black tracking-tight text-white mt-1 mb-1">
            Rs. {(summary.totalNetRevenue || 0).toLocaleString()}
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-emerald-300 font-semibold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Total Bills Made: Rs. {(summary.totalGrossBilled || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Card 2: Total Hospital Expenses */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden">
          <div className="absolute right-3 top-3 bg-rose-50 p-2 rounded-xl text-rose-600">
            <Receipt className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Store Expenses
          </span>
          <h2 className="text-2xl font-black tracking-tight text-rose-600 mt-1 mb-1">
            Rs. {(summary.totalExpenses || 0).toLocaleString()}
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Bills & Expenses: Rs. {(summary.hospitalExpenses || 0).toLocaleString()} • Staff Salaries: Rs. {(summary.salariesDisbursed || 0).toLocaleString()}
          </p>
        </div>

        {/* Card 3: Net Hospital Profit */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden">
          <div className="absolute right-3 top-3 bg-emerald-50 p-2 rounded-xl text-emerald-600">
            <BadgeDollarSign className="w-5 h-5" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Store Net Profit (Remaining)
            </span>
            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
              (summary.netProfit || 0) >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}>
              {(summary.profitMargin || 0)}% Profit
            </span>
          </div>
          <h2 className={`text-2xl font-black tracking-tight mt-1 mb-1 ${
            (summary.netProfit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
          }`}>
            Rs. {(summary.netProfit || 0).toLocaleString()}
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Money Left = Total Income - Total Expenses
          </p>
        </div>

        {/* Card 4: Best Earning Month */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs relative overflow-hidden">
          <div className="absolute right-3 top-3 bg-blue-50 p-2 rounded-xl text-blue-600">
            <Sparkles className="w-5 h-5" />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Best Earning Month
          </span>
          <h2 className="text-xl font-black text-slate-800 mt-1 mb-1">
            {summary.bestMonth?.monthName || summary.bestMonth?.name || (summary.totalNetRevenue > 0 ? 'September' : 'N/A')}
          </h2>
          <p className="text-xs font-semibold text-[#1F3F66]">
            Rs. {(summary.bestMonth?.netRevenue || 0).toLocaleString()} Collected • {summary.totalTransactions || 0} Patient Visits
          </p>
        </div>
      </div>

      {/* 3. Departmental Annual Contribution Overview */}
      <div className="bg-white rounded-2xl p-4 md:p-5 border border-[#B7D7F0]/60 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#1F3F66]" />
            <h3 className="text-sm font-bold text-[#1F3F66]">
              Departmental Annual Revenue Share ({selectedYear})
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Click any month below to inspect details
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {/* OPD */}
          <div className="bg-blue-50/60 p-2.5 rounded-xl border border-blue-100 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-blue-700 text-xs font-semibold">
              <Stethoscope className="w-3.5 h-3.5" />
              <span>OPD Doctor</span>
            </div>
            <div className="mt-1.5">
              <div className="text-sm font-black text-blue-900">
                Rs. {(summary.departmentTotals?.opd || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-blue-600 font-medium">
                {summary.totalNetRevenue > 0 ? (((summary.departmentTotals?.opd || 0) / summary.totalNetRevenue) * 100).toFixed(1) : 0}% of Total
              </div>
            </div>
          </div>

          {/* Laboratory */}
          <div className="bg-purple-50/60 p-2.5 rounded-xl border border-purple-100 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-purple-700 text-xs font-semibold">
              <TestTube className="w-3.5 h-3.5" />
              <span>Laboratory</span>
            </div>
            <div className="mt-1.5">
              <div className="text-sm font-black text-purple-900">
                Rs. {(summary.departmentTotals?.lab || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-purple-600 font-medium">
                {summary.totalNetRevenue > 0 ? (((summary.departmentTotals?.lab || 0) / summary.totalNetRevenue) * 100).toFixed(1) : 0}% of Total
              </div>
            </div>
          </div>

          {/* Pharmacy */}
          <div className="bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-100 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-emerald-700 text-xs font-semibold">
              <Pill className="w-3.5 h-3.5" />
              <span>Pharmacy Net</span>
            </div>
            <div className="mt-1.5">
              <div className="text-sm font-black text-emerald-900">
                Rs. {(summary.departmentTotals?.pharmacy || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-emerald-600 font-medium">
                {summary.totalNetRevenue > 0 ? (((summary.departmentTotals?.pharmacy || 0) / summary.totalNetRevenue) * 100).toFixed(1) : 0}% of Total
              </div>
            </div>
          </div>

          {/* IPD */}
          <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-indigo-700 text-xs font-semibold">
              <BedDouble className="w-3.5 h-3.5" />
              <span>IPD Wards</span>
            </div>
            <div className="mt-1.5">
              <div className="text-sm font-black text-indigo-900">
                Rs. {(summary.departmentTotals?.ipd || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-indigo-600 font-medium">
                {summary.totalNetRevenue > 0 ? (((summary.departmentTotals?.ipd || 0) / summary.totalNetRevenue) * 100).toFixed(1) : 0}% of Total
              </div>
            </div>
          </div>

          {/* Nursery */}
          <div className="bg-rose-50/60 p-2.5 rounded-xl border border-rose-100 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-rose-700 text-xs font-semibold">
              <Baby className="w-3.5 h-3.5" />
              <span>Nursery & NICU</span>
            </div>
            <div className="mt-1.5">
              <div className="text-sm font-black text-rose-900">
                Rs. {(summary.departmentTotals?.nursery || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-rose-600 font-medium">
                {summary.totalNetRevenue > 0 ? (((summary.departmentTotals?.nursery || 0) / summary.totalNetRevenue) * 100).toFixed(1) : 0}% of Total
              </div>
            </div>
          </div>

          {/* Clinical Services */}
          <div className="bg-teal-50/60 p-2.5 rounded-xl border border-teal-100 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-teal-700 text-xs font-semibold">
              <Syringe className="w-3.5 h-3.5" />
              <span>Clinical Serv.</span>
            </div>
            <div className="mt-1.5">
              <div className="text-sm font-black text-teal-900">
                Rs. {(summary.departmentTotals?.services || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-teal-600 font-medium">
                {summary.totalNetRevenue > 0 ? (((summary.departmentTotals?.services || 0) / summary.totalNetRevenue) * 100).toFixed(1) : 0}% of Total
              </div>
            </div>
          </div>

          {/* Surgeries */}
          <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-100 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 text-amber-700 text-xs font-semibold">
              <Building2 className="w-3.5 h-3.5" />
              <span>OT Surgeries</span>
            </div>
            <div className="mt-1.5">
              <div className="text-sm font-black text-amber-900">
                Rs. {(summary.departmentTotals?.surgery || 0).toLocaleString()}
              </div>
              <div className="text-[10px] text-amber-600 font-medium">
                {summary.totalNetRevenue > 0 ? (((summary.departmentTotals?.surgery || 0) / summary.totalNetRevenue) * 100).toFixed(1) : 0}% of Total
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. The 12-Month Table: ALWAYS 12 CALENDAR ROWS */}
      <div className="bg-white rounded-2xl border border-[#B7D7F0]/60 shadow-xs overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-[#1F3F66] flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#5A9BD5]" />
              <span>12 Months Store Income & Expenses Calendar ({selectedYear})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Full 12 calendar rows for each month • Click any row or &quot;Details&quot; button to view full income and expenses
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#EDF6FF] text-[#1F3F66] text-xs font-bold rounded-lg border border-[#B7D7F0]">
              <span className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-500 animate-spin' : 'bg-emerald-500 animate-pulse'}`}></span>
              {loading ? 'Refreshing...' : 'Live Store Data'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-3.5"># Month</th>
                <th className="py-3 px-3 text-right">OPD (Rs)</th>
                <th className="py-3 px-3 text-right">Lab (Rs)</th>
                <th className="py-3 px-3 text-right">Pharmacy (Rs)</th>
                <th className="py-3 px-3 text-right">IPD Wards (Rs)</th>
                <th className="py-3 px-3 text-right">Nursery (Rs)</th>
                <th className="py-3 px-3 text-right">Surgery (Rs)</th>
                <th className="py-3 px-3 text-right">Total Bill (Rs)</th>
                <th className="py-3 px-3 text-right font-black text-emerald-800">Total Income (Rs)</th>
                <th className="py-3 px-3 text-right text-rose-800">Total Expenses (Rs)</th>
                <th className="py-3 px-3 text-right">Net Profit (Rs)</th>
                <th className="py-3 px-3 text-center">Profit %</th>
                <th className="py-3 px-3.5 text-center">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {calendarMonths.map((m) => {
                const isCurrentMonth = selectedYear === currentSystemYear && m.monthNumber === currentSystemMonth;
                const isPositive = (m.netProfit || 0) >= 0;
                const hasData = (m.netRevenue || 0) > 0 || (m.totalExpenses || 0) > 0;

                return (
                  <tr
                    key={m.monthNumber}
                    onClick={() => openMonthModal(m)}
                    className={`cursor-pointer transition-all duration-150 ${
                      isCurrentMonth
                        ? 'bg-[#EDF6FF]/70 hover:bg-[#EDF6FF] font-semibold border-l-4 border-l-[#1F3F66]'
                        : hasData
                          ? 'hover:bg-blue-50/60'
                          : 'opacity-80 hover:opacity-100 hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Month Column */}
                    <td className="py-3.5 px-3.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black ${
                          isCurrentMonth
                            ? 'bg-[#1F3F66] text-white shadow-2xs'
                            : hasData
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-600'
                        }`}>
                          {m.monthNumber < 10 ? `0${m.monthNumber}` : m.monthNumber}
                        </span>
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span>{m.monthName}</span>
                            {isCurrentMonth && (
                              <span className="text-[9px] bg-[#1F3F66] text-white px-1.5 py-0.2 rounded font-black tracking-wide">
                                CURRENT
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">
                            {m.daysCount} Days • {m.totalTransactions || 0} Cases
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* OPD */}
                    <td className="py-3.5 px-3 text-right">
                      <span className={(m.opdRevenue || 0) > 0 ? 'font-bold text-slate-800' : 'text-slate-400'}>
                        Rs. {(m.opdRevenue || 0).toLocaleString()}
                      </span>
                      {(m.opdCount || 0) > 0 && (
                        <div className="text-[10px] text-slate-400 font-medium">{m.opdCount} visits</div>
                      )}
                    </td>

                    {/* Lab */}
                    <td className="py-3.5 px-3 text-right">
                      <span className={(m.labRevenue || 0) > 0 ? 'font-bold text-slate-800' : 'text-slate-400'}>
                        Rs. {(m.labRevenue || 0).toLocaleString()}
                      </span>
                      {(m.labCount || 0) > 0 && (
                        <div className="text-[10px] text-slate-400 font-medium">{m.labCount} tests</div>
                      )}
                    </td>

                    {/* Pharmacy Net */}
                    <td className="py-3.5 px-3 text-right">
                      <span className={(m.pharmacyNetRevenue || 0) > 0 ? 'font-bold text-slate-800' : 'text-slate-400'}>
                        Rs. {(m.pharmacyNetRevenue || 0).toLocaleString()}
                      </span>
                      {(m.pharmacyCount || 0) > 0 && (
                        <div className="text-[10px] text-slate-400 font-medium">{m.pharmacyCount} sales</div>
                      )}
                    </td>

                    {/* IPD */}
                    <td className="py-3.5 px-3 text-right">
                      <span className={(m.ipdRevenue || 0) > 0 ? 'font-bold text-slate-800' : 'text-slate-400'}>
                        Rs. {(m.ipdRevenue || 0).toLocaleString()}
                      </span>
                      {(m.ipdCount || 0) > 0 && (
                        <div className="text-[10px] text-slate-400 font-medium">{m.ipdCount} admits</div>
                      )}
                    </td>

                    {/* Nursery */}
                    <td className="py-3.5 px-3 text-right">
                      <span className={(m.nurseryRevenue || 0) > 0 ? 'font-bold text-slate-800' : 'text-slate-400'}>
                        Rs. {(m.nurseryRevenue || 0).toLocaleString()}
                      </span>
                      {(m.nurseryCount || 0) > 0 && (
                        <div className="text-[10px] text-slate-400 font-medium">{m.nurseryCount} neonates</div>
                      )}
                    </td>

                    {/* Surgery */}
                    <td className="py-3.5 px-3 text-right">
                      <span className={(m.surgeryRevenue || 0) > 0 ? 'font-bold text-slate-800' : 'text-slate-400'}>
                        Rs. {(m.surgeryRevenue || 0).toLocaleString()}
                      </span>
                      {(m.surgeryCount || 0) > 0 && (
                        <div className="text-[10px] text-slate-400 font-medium">{m.surgeryCount} cases</div>
                      )}
                    </td>

                    {/* Gross Billed */}
                    <td className="py-3.5 px-3 text-right text-slate-600">
                      Rs. {(m.grossBilled || 0).toLocaleString()}
                    </td>

                    {/* Net Revenue */}
                    <td className="py-3.5 px-3 text-right">
                      <span className={`font-black text-sm ${
                        (m.netRevenue || 0) > 0 ? 'text-emerald-700' : 'text-slate-400'
                      }`}>
                        Rs. {(m.netRevenue || 0).toLocaleString()}
                      </span>
                    </td>

                    {/* Outflows */}
                    <td className="py-3.5 px-3 text-right">
                      <span className={`font-bold ${
                        (m.totalExpenses || 0) > 0 ? 'text-rose-600' : 'text-slate-400'
                      }`}>
                        Rs. {(m.totalExpenses || 0).toLocaleString()}
                      </span>
                    </td>

                    {/* Net Profit */}
                    <td className="py-3.5 px-3 text-right">
                      <span className={`font-black ${
                        !hasData ? 'text-slate-400' : isPositive ? 'text-emerald-700' : 'text-rose-700'
                      }`}>
                        Rs. {(m.netProfit || 0).toLocaleString()}
                      </span>
                    </td>

                    {/* Margin % */}
                    <td className="py-3.5 px-3 text-center">
                      {hasData ? (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-black ${
                          isPositive
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {m.profitMargin || 0}%
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[10px]">0%</span>
                      )}
                    </td>

                    {/* Action Button */}
                    <td className="py-3.5 px-3.5 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openMonthModal(m);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-[#1F3F66] text-[#1F3F66] hover:text-white border border-[#B7D7F0] hover:border-[#1F3F66] rounded-lg text-[11px] font-bold transition shadow-2xs active:scale-95"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Details</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Table Footer: Annual Totals */}
            <tfoot>
              <tr className="bg-slate-900 text-white text-xs font-black border-t-2 border-slate-800">
                <td className="py-4 px-3.5 text-slate-200">
                  <div>ANNUAL TOTAL ({selectedYear})</div>
                  <div className="text-[10px] font-medium text-slate-400">12 Months Calendar Sum</div>
                </td>
                <td className="py-4 px-3 text-right text-slate-200">
                  Rs. {(summary.departmentTotals?.opd || 0).toLocaleString()}
                </td>
                <td className="py-4 px-3 text-right text-slate-200">
                  Rs. {(summary.departmentTotals?.lab || 0).toLocaleString()}
                </td>
                <td className="py-4 px-3 text-right text-slate-200">
                  Rs. {(summary.departmentTotals?.pharmacy || 0).toLocaleString()}
                </td>
                <td className="py-4 px-3 text-right text-slate-200">
                  Rs. {(summary.departmentTotals?.ipd || 0).toLocaleString()}
                </td>
                <td className="py-4 px-3 text-right text-slate-200">
                  Rs. {(summary.departmentTotals?.nursery || 0).toLocaleString()}
                </td>
                <td className="py-4 px-3 text-right text-slate-200">
                  Rs. {(summary.departmentTotals?.surgery || 0).toLocaleString()}
                </td>
                <td className="py-4 px-3 text-right text-slate-300">
                  Rs. {(summary.totalGrossBilled || 0).toLocaleString()}
                </td>
                <td className="py-4 px-3 text-right text-emerald-400 text-sm">
                  Rs. {(summary.totalNetRevenue || 0).toLocaleString()}
                </td>
                <td className="py-4 px-3 text-right text-rose-300">
                  Rs. {(summary.totalExpenses || 0).toLocaleString()}
                </td>
                <td className="py-4 px-3 text-right text-emerald-300 text-sm">
                  Rs. {(summary.netProfit || 0).toLocaleString()}
                </td>
                <td className="py-4 px-3 text-center">
                  <span className="bg-white/20 text-white px-2 py-0.5 rounded text-[10px]">
                    {summary.profitMargin || 0}%
                  </span>
                </td>
                <td className="py-4 px-3.5 text-center text-slate-400">
                  12 Mo
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 5. Comprehensive Month Detail Modal */}
      {selectedMonth && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-fadeIn">
          <div
            className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#1F3F66] text-white p-4 md:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl border border-white/20">
                  <CalendarDays className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg md:text-xl font-black tracking-tight text-white">
                      {selectedMonth.monthName} {selectedMonth.year} Financial Statement
                    </h2>
                    <span className="text-[10px] bg-[#5A9BD5] text-white px-2 py-0.5 rounded-full font-bold">
                      {selectedMonth.daysCount} Days
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Detailed departmental collections, operating expenses, daily breakdown, and payment methods
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintMonthlyStatement(selectedMonth)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#5A9BD5] hover:bg-[#4a89c2] text-white text-xs font-bold rounded-xl transition shadow-2xs"
                  title="Print Laser Statement"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Print Statement</span>
                </button>

                <button
                  onClick={closeMonthModal}
                  className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition"
                  title="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal KPI Highlights Bar */}
            <div className="bg-[#EDF6FF] border-b border-[#B7D7F0]/60 p-3 md:px-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Money Collected</span>
                <div className="text-lg font-black text-emerald-700">
                  Rs. {(selectedMonth.netRevenue || 0).toLocaleString()}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Bill Amount</span>
                <div className="text-lg font-black text-slate-800">
                  Rs. {(selectedMonth.grossBilled || 0).toLocaleString()}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total Store Expenses</span>
                <div className="text-lg font-black text-rose-600">
                  Rs. {(selectedMonth.totalExpenses || 0).toLocaleString()}
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Net Profit (Remaining)</span>
                <div className={`text-lg font-black ${(selectedMonth.netProfit || 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  Rs. {(selectedMonth.netProfit || 0).toLocaleString()} ({selectedMonth.profitMargin || 0}% Profit)
                </div>
              </div>
            </div>

            {/* Modal Tabs Bar */}
            <div className="border-b border-slate-200 px-4 md:px-6 flex items-center justify-between bg-slate-50 shrink-0">
              <div className="flex gap-2">
                <button
                  onClick={() => setModalTab('overview')}
                  className={`py-3 px-3.5 text-xs font-bold border-b-2 transition ${
                    modalTab === 'overview'
                      ? 'border-[#1F3F66] text-[#1F3F66]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Departmental & Operational Overview
                </button>
                <button
                  onClick={() => setModalTab('daily')}
                  className={`py-3 px-3.5 text-xs font-bold border-b-2 transition ${
                    modalTab === 'daily'
                      ? 'border-[#1F3F66] text-[#1F3F66]'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Day-by-Day Activity Log ({selectedMonth.dailyBreakdown?.length || 0} Days)
                </button>
              </div>

              {modalTab === 'daily' && (
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showActiveDaysOnly}
                    onChange={(e) => setShowActiveDaysOnly(e.target.checked)}
                    className="rounded text-[#1F3F66] focus:ring-[#5A9BD5]"
                  />
                  <span>Active Days Only</span>
                </label>
              )}
            </div>

            {/* Modal Body Content (Scrollable) */}
            <div className="p-4 md:p-6 overflow-y-auto space-y-6">
              {modalTab === 'overview' && (
                <>
                  {/* Department Collections Grid */}
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-[#1F3F66]" />
                      <span>Department Income Breakdown</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {/* OPD */}
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                            <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
                            <span>OPD Doctor Consultations</span>
                          </span>
                          <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                            {selectedMonth.opdCount || 0} Visits
                          </span>
                        </div>
                        <div className="text-xl font-black text-slate-900 mt-2">
                          Rs. {(selectedMonth.opdRevenue || 0).toLocaleString()}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Direct physician consultation fee receipts
                        </p>
                      </div>

                      {/* Laboratory */}
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                            <TestTube className="w-3.5 h-3.5 text-purple-600" />
                            <span>Pathology Laboratory</span>
                          </span>
                          <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">
                            {selectedMonth.labCount || 0} Tests
                          </span>
                        </div>
                        <div className="text-xl font-black text-slate-900 mt-2">
                          Rs. {(selectedMonth.labRevenue || 0).toLocaleString()}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Gross: Rs. {(selectedMonth.labGross || 0).toLocaleString()} • Disc: Rs. {(selectedMonth.labDiscount || 0).toLocaleString()}
                        </p>
                      </div>

                      {/* Pharmacy Net */}
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                            <Pill className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Pharmacy Net Collections</span>
                          </span>
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                            {selectedMonth.pharmacyCount || 0} Sales
                          </span>
                        </div>
                        <div className="text-xl font-black text-slate-900 mt-2">
                          Rs. {(selectedMonth.pharmacyNetRevenue || 0).toLocaleString()}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Sales: Rs. {(selectedMonth.pharmacySales || 0).toLocaleString()} • Dues: +Rs. {(selectedMonth.pharmacyDuesCollected || 0).toLocaleString()} • Ret: -Rs. {(selectedMonth.pharmacyReturns || 0).toLocaleString()}
                        </p>
                      </div>

                      {/* IPD */}
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                            <BedDouble className="w-3.5 h-3.5 text-indigo-600" />
                            <span>IPD Inpatient Admissions</span>
                          </span>
                          <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">
                            {selectedMonth.ipdCount || 0} Admits
                          </span>
                        </div>
                        <div className="text-xl font-black text-slate-900 mt-2">
                          Rs. {(selectedMonth.ipdRevenue || 0).toLocaleString()}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Ward stays, nursing care, and admitted billing
                        </p>
                      </div>

                      {/* Nursery */}
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                            <Baby className="w-3.5 h-3.5 text-rose-600" />
                            <span>Nursery & NICU Station</span>
                          </span>
                          <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded">
                            {selectedMonth.nurseryCount || 0} Neonates
                          </span>
                        </div>
                        <div className="text-xl font-black text-slate-900 mt-2">
                          Rs. {(selectedMonth.nurseryRevenue || 0).toLocaleString()}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Gross: Rs. {(selectedMonth.nurseryGross || 0).toLocaleString()} • Disc: Rs. {(selectedMonth.nurseryDiscount || 0).toLocaleString()}
                        </p>
                      </div>

                      {/* Clinical Services */}
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                            <Syringe className="w-3.5 h-3.5 text-teal-600" />
                            <span>Clinical Services & Procedures</span>
                          </span>
                          <span className="text-[10px] font-bold bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded">
                            {selectedMonth.servicesCount || 0} Orders
                          </span>
                        </div>
                        <div className="text-xl font-black text-slate-900 mt-2">
                          Rs. {(selectedMonth.servicesRevenue || 0).toLocaleString()}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Diagnostics, radiology, ultrasounds, and minor procedures
                        </p>
                      </div>

                      {/* OT Surgeries */}
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 sm:col-span-2 lg:col-span-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-amber-600" />
                            <span>Operation Theatre (OT) Surgeries</span>
                          </span>
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                            {selectedMonth.surgeryCount || 0} Cases
                          </span>
                        </div>
                        <div className="text-xl font-black text-slate-900 mt-2">
                          Rs. {(selectedMonth.surgeryRevenue || 0).toLocaleString()}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Surgical interventions, surgeon fees, and OT utility bills
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Expenses & Staff Salaries Breakdown */}
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                      <Receipt className="w-3.5 h-3.5 text-rose-600" />
                      <span>Store Expenses & Staff Salaries</span>
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-rose-50/60 p-3.5 rounded-xl border border-rose-100">
                        <div className="text-[11px] font-bold text-rose-800 uppercase">Store Bills & Everyday Expenses</div>
                        <div className="text-lg font-black text-rose-700 mt-1">
                          Rs. {(selectedMonth.hospitalExpenses || 0).toLocaleString()}
                        </div>
                        <p className="text-[10px] text-rose-600 mt-0.5">
                          {selectedMonth.expensesCount || 0} Verified expense vouchers
                        </p>
                      </div>

                      <div className="bg-amber-50/60 p-3.5 rounded-xl border border-amber-100">
                        <div className="text-[11px] font-bold text-amber-800 uppercase">Salaries & Payroll</div>
                        <div className="text-lg font-black text-amber-700 mt-1">
                          Rs. {(selectedMonth.salariesDisbursed || 0).toLocaleString()}
                        </div>
                        <p className="text-[10px] text-amber-600 mt-0.5">
                          {selectedMonth.salariesCount || 0} Staff & doctor salary disbursements
                        </p>
                      </div>

                      <div className="bg-orange-50/60 p-3.5 rounded-xl border border-orange-100">
                        <div className="text-[11px] font-bold text-orange-800 uppercase">Staff Advances</div>
                        <div className="text-lg font-black text-orange-700 mt-1">
                          Rs. {(selectedMonth.advancesDisbursed || 0).toLocaleString()}
                        </div>
                        <p className="text-[10px] text-orange-600 mt-0.5">
                          Advance payments issued in this month
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Payment Methods Distribution */}
                  {selectedMonth.paymentMethods && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Payment Methods Distribution
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-bold">CASH</span>
                          <div className="font-black text-slate-800">
                            Rs. {(selectedMonth.paymentMethods.CASH || 0).toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-bold">BANK TRANSFER</span>
                          <div className="font-black text-slate-800">
                            Rs. {(selectedMonth.paymentMethods.BANK_TRANSFER || 0).toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-bold">CARD / POS</span>
                          <div className="font-black text-slate-800">
                            Rs. {(selectedMonth.paymentMethods.CARD || 0).toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-bold">ONLINE</span>
                          <div className="font-black text-slate-800">
                            Rs. {(selectedMonth.paymentMethods.ONLINE || 0).toLocaleString()}
                          </div>
                        </div>
                        <div className="bg-white p-2 rounded-lg border border-slate-200">
                          <span className="text-[10px] text-slate-400 font-bold">SEHAT CARD</span>
                          <div className="font-black text-slate-800">
                            Rs. {(selectedMonth.paymentMethods.SEHAT_CARD || 0).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {modalTab === 'daily' && (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">
                      Day-by-Day Financial Breakdown for {selectedMonth.monthName} {selectedMonth.year}
                    </span>
                    <span className="text-slate-500">
                      {showActiveDaysOnly ? 'Showing active days with revenue or expenses' : `Showing all ${selectedMonth.daysCount} calendar days`}
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 text-[10px] font-bold text-slate-500 uppercase sticky top-0 z-10 border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Day of Week</th>
                          <th className="py-2.5 px-3 text-right">Net Revenue (Rs)</th>
                          <th className="py-2.5 px-3 text-right">Expenses (Rs)</th>
                          <th className="py-2.5 px-3 text-right">Net Daily Margin</th>
                          <th className="py-2.5 px-3 text-center">Cases</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {((selectedMonth.dailyBreakdown && selectedMonth.dailyBreakdown.length > 0)
                          ? selectedMonth.dailyBreakdown
                          : Array.from({ length: selectedMonth.daysCount || 30 }, (_, i) => ({
                              day: i + 1,
                              date: `${selectedMonth.year}-${String(selectedMonth.monthNumber || 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`,
                              dayOfWeek: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(selectedMonth.year, (selectedMonth.monthNumber || 1) - 1, i + 1).getDay()],
                              netRevenue: 0,
                              expenses: 0,
                              netProfit: 0,
                              transactions: 0
                            }))
                        )
                          .filter(d => !showActiveDaysOnly || (d.netRevenue || d.revenue || 0) > 0 || d.expenses > 0)
                          .map((day) => {
                            const rev = day.netRevenue ?? day.revenue ?? 0;
                            const exp = day.expenses || 0;
                            const profit = day.netProfit ?? day.net ?? (rev - exp);
                            const isNetPositive = profit >= 0;
                            const hasActivity = rev > 0 || exp > 0;

                            return (
                              <tr
                                key={day.day}
                                className={hasActivity ? 'hover:bg-blue-50/50' : 'text-slate-400'}
                              >
                                <td className="py-2 px-3 font-semibold text-slate-800">
                                  Day {day.day < 10 ? `0${day.day}` : day.day} ({day.date})
                                </td>
                                <td className="py-2 px-3 text-slate-500 font-medium">
                                  {day.dayOfWeek || day.dayName || ''}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-emerald-700">
                                  {rev > 0 ? `Rs. ${rev.toLocaleString()}` : 'Rs. 0'}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-rose-600">
                                  {exp > 0 ? `Rs. ${exp.toLocaleString()}` : 'Rs. 0'}
                                </td>
                                <td className="py-2 px-3 text-right font-black">
                                  <span className={!hasActivity ? 'text-slate-400' : isNetPositive ? 'text-emerald-700' : 'text-rose-700'}>
                                    Rs. {profit.toLocaleString()}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-center font-semibold text-slate-600">
                                  {day.transactions || day.count || 0}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500">
                Super Mart Annual Financial Analytics • {selectedMonth.monthName} {selectedMonth.year}
              </span>
              <button
                onClick={closeMonthModal}
                className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl transition"
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
