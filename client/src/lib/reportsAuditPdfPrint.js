/**
 * Laser-Printer Optimized Hospital Financial Audit & Operations Report
 * Strictly Monochrome / Grayscale (B&W Laser Print Ready), No Icons, Clean Professional Typography
 */

export const printReportsAuditPdf = (reportData = {}) => {
  const {
    hospitalName = 'SHIFA HOSPITAL SAMARBAGH',
    hospitalAddress = 'Main Highway, Samarbagh, District Lower Dir, KPK',
    hospitalPhone = '+92 945 881234 / 0300-1234567',
    period = 'today',
    range = {},
    summary = {},
    transactions = [],
    activeTab = 'ALL',
    searchQuery = '',
    statusFilter = 'ALL',
    paymentMethodFilter = 'ALL',
    generatedBy = 'Front Desk Cashier / Auditor'
  } = reportData;

  const printWin = window.open('', '_blank');
  if (!printWin) {
    alert('Pop-up blocked. Please allow pop-ups to print reports.');
    return;
  }

  // Format Date Range Label
  let periodLabel = 'Today';
  if (period === 'today') {
    periodLabel = `Today (${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})`;
  } else if (period === 'yesterday') {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    periodLabel = `Yesterday (${y.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })})`;
  } else if (period === 'weekly') {
    periodLabel = 'This Week (Last 7 Days)';
  } else if (period === 'monthly') {
    periodLabel = 'This Month';
  } else if (period === 'custom') {
    const s = range.startDate ? new Date(range.startDate).toLocaleDateString('en-GB') : '';
    const e = range.endDate ? new Date(range.endDate).toLocaleDateString('en-GB') : '';
    periodLabel = `Custom Range: ${s} to ${e}`;
  }

  const generatedTime = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const auditNo = `AUD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Filter transactions matching current active filter if specified
  let filtered = transactions || [];
  if (activeTab && activeTab !== 'ALL') {
    filtered = filtered.filter(t => t.category === activeTab);
  }
  if (statusFilter && statusFilter !== 'ALL') {
    if (statusFilter === 'PAID') filtered = filtered.filter(t => t.status === 'PAID');
    else if (statusFilter === 'UNPAID') filtered = filtered.filter(t => t.status !== 'PAID');
  }
  if (paymentMethodFilter && paymentMethodFilter !== 'ALL') {
    filtered = filtered.filter(item => {
      if (item.category === 'EXPENSE' || item.category === 'SALARY' || item.category === 'REFUND') {
        return paymentMethodFilter === 'CASH';
      }
      const raw = String(item.paymentMethod || item.normalizedPaymentMethod || 'CASH').toUpperCase();
      let norm = 'CASH';
      if (raw.includes('SEHAT') || raw.includes('PANEL') || raw.includes('INSAF')) norm = 'SEHAT_CARD';
      else if (raw.includes('ONLINE') || raw.includes('BANK') || raw.includes('TRANSFER') || raw.includes('IBFT') || raw.includes('EASYPAISA') || raw.includes('JAZZCASH')) norm = 'ONLINE';
      else if (raw.includes('DEBIT') || raw.includes('CARD') || raw.includes('POS') || raw.includes('CREDIT')) norm = 'DEBIT_CARD';
      return norm === paymentMethodFilter;
    });
  }
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(item =>
      (item.patientName && item.patientName.toLowerCase().includes(q)) ||
      (item.mrn && item.mrn.toLowerCase().includes(q)) ||
      (item.code && item.code.toLowerCase().includes(q)) ||
      (item.details && typeof item.details === 'string' && item.details.toLowerCase().includes(q))
    );
  }

  const netCash = summary.totalPaidCollected || 0;
  const grossBilled = summary.totalGrossBilled || 0;
  const totalExpenses = summary.totalExpensesPaid || 0;
  const totalSalaries = summary.totalSalariesPaid || 0;
  const pendingDues = summary.totalPendingDues || 0;
  const totalIncome = summary.totalIncomeCollected || (netCash + totalExpenses + totalSalaries + (summary.refundsTotal || 0));
  const refundsTotal = summary.refundsTotal || 0;

  // Payment Methods Breakdown
  const pm = summary.paymentMethods || {};
  const pmCash = pm.cash || { amount: summary.cashCollected || 0, count: 0, percentage: 0 };
  const pmOnline = pm.online || { amount: summary.onlineCollected || 0, count: 0, percentage: 0 };
  const pmSehat = pm.sehatCard || { amount: summary.sehatCardCollected || 0, count: 0, percentage: 0 };
  const pmDebit = pm.debitCard || { amount: summary.debitCardCollected || 0, count: 0, percentage: 0 };
  const pmTotal = pm.totalCollections || ((pmCash.amount || 0) + (pmOnline.amount || 0) + (pmSehat.amount || 0) + (pmDebit.amount || 0));

  // Concise Departmental Breakdown
  const deptBreakdown = [
    { name: 'OPD Doctor Consultations', count: transactions.filter(t => t.category === 'OPD').length, amount: summary.opdPaid || 0, type: 'Income' },
    { name: 'Pathology Diagnostics (Internal Patients)', count: transactions.filter(t => t.category === 'LAB_INTERNAL').length, amount: summary.labInternalPaid || 0, type: 'Income' },
    { name: 'Pathology Diagnostics (External Walk-in)', count: transactions.filter(t => t.category === 'LAB_EXTERNAL').length, amount: summary.labExternalPaid || 0, type: 'Income' },
    { name: 'Clinical Procedures & Radiology (X-Ray)', count: transactions.filter(t => t.category === 'SERVICE_INTERNAL' || t.category === 'SERVICE_EXTERNAL').length, amount: summary.serviceTotalPaid || 0, type: 'Income' },
    { name: 'Pharmacy POS Counter Sales (OTC)', count: transactions.filter(t => t.category === 'PHARMACY_OTC').length, amount: summary.pharmacyOtcPaid || 0, type: 'Income' },
    { name: 'Pharmacy Inpatient Supplies', count: transactions.filter(t => t.category === 'PHARMACY_INTERNAL').length, amount: summary.pharmacyInternalPaid || 0, type: 'Income' },
    { name: 'Nursery & NICU Incubator Stays', count: transactions.filter(t => t.category === 'NURSERY').length, amount: summary.nurseryPaid || 0, type: 'Income' },
    { name: 'Surgical Operations & OT Procedures', count: transactions.filter(t => t.category === 'SURGERY').length, amount: summary.surgeryPaid || 0, type: 'Income' },
    { name: 'Gynecology & Obstetrics (Maternity)', count: transactions.filter(t => t.category === 'GYNE').length, amount: summary.gynePaid || 0, type: 'Income' },
    { name: 'IPD Ward & Room Stay Deposits', count: transactions.filter(t => t.category === 'IPD').length, amount: summary.ipdPaid || 0, type: 'Income' },
    { name: 'Recovered Customer / Patient Dues', count: transactions.filter(t => t.category === 'DUES_RECOVERY').length, amount: summary.duesRecoveredPaid || 0, type: 'Income' },
    { name: 'Pharmacy Returns & Customer Refunds', count: transactions.filter(t => t.category === 'REFUND').length, amount: -refundsTotal, type: 'Outflow' },
    { name: 'Hospital Operating Expenses & Petty Cash', count: transactions.filter(t => t.category === 'EXPENSE').length, amount: -totalExpenses, type: 'Outflow' },
    { name: 'Staff Salaries & Monthly Payroll Disbursals', count: transactions.filter(t => t.category === 'SALARY').length, amount: -totalSalaries, type: 'Outflow' },
    ...(summary.hmsStock && summary.hmsStock.totalValuation > 0 ? [{
      name: `HMS Stock Inventory Valuation (${summary.hmsStock.totalItems || 0} Items)`,
      count: summary.hmsStock.totalItems || 0,
      amount: summary.hmsStock.totalValuation || 0,
      type: 'Asset'
    }] : [])
  ];

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Audit Report - ${auditNo}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 12mm 15mm 12mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: Arial, Helvetica, sans-serif;
          background: #ffffff;
          color: #000000;
          margin: 0;
          padding: 0;
          font-size: 11px;
          line-height: 1.35;
        }

        /* Top Header */
        .hdr {
          text-align: center;
          border-bottom: 2px solid #000000;
          padding-bottom: 8px;
          margin-bottom: 10px;
        }
        .hdr-title {
          font-size: 18px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 3px 0;
        }
        .hdr-sub {
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin: 0 0 3px 0;
        }
        .hdr-contact {
          font-size: 9.5px;
          color: #333333;
        }

        /* Meta Grid */
        .meta-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 12px;
          border: 1px solid #000000;
        }
        .meta-table td {
          padding: 4px 8px;
          font-size: 10px;
          border: 1px solid #cccccc;
        }
        .meta-table .lbl {
          font-weight: bold;
          background: #f3f4f6;
          width: 18%;
        }
        .meta-table .val {
          font-weight: normal;
          width: 32%;
        }

        /* Financial Summary Box */
        .summary-title {
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
          border-bottom: 1.5px solid #000000;
          padding-bottom: 3px;
          margin: 10px 0 6px 0;
        }
        .summary-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 12px;
          border: 1px solid #000000;
        }
        .summary-table td {
          padding: 5px 8px;
          font-size: 10.5px;
          border: 1px solid #cccccc;
        }
        .summary-table .s-lbl {
          font-weight: bold;
          background: #f9fafb;
          width: 35%;
        }
        .summary-table .s-val {
          font-family: monospace;
          font-weight: bold;
          text-align: right;
          width: 15%;
        }
        .summary-table .net-row td {
          background: #f3f4f6;
          border-top: 2px solid #000000;
          border-bottom: 2px solid #000000;
          font-size: 11.5px;
          font-weight: bold;
        }

        /* Tables */
        table.data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
          margin-bottom: 12px;
          border: 1px solid #000000;
        }
        table.data-table th {
          background: #e5e7eb;
          color: #000000;
          font-weight: bold;
          text-transform: uppercase;
          font-size: 9px;
          padding: 5px 6px;
          border: 1px solid #000000;
          text-align: left;
        }
        table.data-table td {
          padding: 4px 6px;
          border: 1px solid #d1d5db;
          color: #000000;
          vertical-align: middle;
        }
        table.data-table tr:nth-child(even) td {
          background-color: #fafafa;
        }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-mono { font-family: monospace; }
        .font-bold { font-weight: bold; }

        /* Signatures */
        .sig-container {
          margin-top: 30px;
          display: table;
          width: 100%;
          page-break-inside: avoid;
        }
        .sig-col {
          display: table-cell;
          width: 33.33%;
          text-align: center;
          padding: 0 15px;
        }
        .sig-line {
          border-top: 1px solid #000000;
          margin-top: 35px;
          padding-top: 4px;
          font-size: 9.5px;
          font-weight: bold;
        }
        .sig-role {
          font-size: 8.5px;
          color: #444444;
        }

        /* Screen Preview Controls */
        .no-print-bar {
          position: fixed;
          top: 10px;
          right: 10px;
          background: #000000;
          color: #ffffff;
          padding: 8px 14px;
          border-radius: 6px;
          font-family: Arial, sans-serif;
          font-size: 11px;
          font-weight: bold;
          z-index: 9999;
          box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        }
        .no-print-btn {
          background: #ffffff;
          color: #000000;
          border: 1px solid #ffffff;
          padding: 4px 10px;
          border-radius: 4px;
          font-weight: bold;
          cursor: pointer;
          margin-left: 8px;
        }
        .no-print-close {
          background: transparent;
          color: #ffffff;
          border: 1px solid #ffffff;
          padding: 4px 10px;
          border-radius: 4px;
          font-weight: bold;
          cursor: pointer;
          margin-left: 5px;
        }

        @media print {
          .no-print-bar { display: none !important; }
          body { padding: 0; }
          tr { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>

      <!-- Screen Print Buttons -->
      <div class="no-print-bar">
        <span>Laser Print Preview</span>
        <button class="no-print-btn" onclick="window.print()">Print Report (Ctrl+P)</button>
        <button class="no-print-close" onclick="window.close()">Close</button>
      </div>

      <!-- Header Letterhead -->
      <div class="hdr">
        <div class="hdr-title">${hospitalName}</div>
        <div class="hdr-sub">Hospital Financial Audit & Operations Report</div>
        <div class="hdr-contact">${hospitalAddress} | Phone: ${hospitalPhone}</div>
      </div>

      <!-- Metadata Box -->
      <table class="meta-table">
        <tr>
          <td class="lbl">Audit Ref No:</td>
          <td class="val font-mono font-bold">${auditNo}</td>
          <td class="lbl">Report Period:</td>
          <td class="val font-bold">${periodLabel}</td>
        </tr>
        <tr>
          <td class="lbl">Printed Date:</td>
          <td class="val font-mono">${generatedTime}</td>
          <td class="lbl">Generated By:</td>
          <td class="val">${generatedBy}</td>
        </tr>
        <tr>
          <td class="lbl">Active Scope:</td>
          <td class="val">${activeTab === 'ALL' ? 'All Operational Departments' : activeTab}</td>
          <td class="lbl">Total Records:</td>
          <td class="val font-bold">${filtered.length} Transactions Verified</td>
        </tr>
      </table>

      <!-- Executive Financial Summary Table -->
      <div class="summary-title">Executive Financial Summary</div>
      <table class="summary-table">
        <tr>
          <td class="s-lbl">Gross Invoiced Value (Billed)</td>
          <td class="s-val">Rs. ${grossBilled.toLocaleString()}</td>
          <td class="s-lbl">Total Cash / Bank Collections</td>
          <td class="s-val">Rs. ${totalIncome.toLocaleString()}</td>
        </tr>
        <tr>
          <td class="s-lbl">Hospital Operating Expenses</td>
          <td class="s-val font-bold">(${totalExpenses.toLocaleString()})</td>
          <td class="s-lbl">Staff Salaries & Payroll</td>
          <td class="s-val font-bold">(${totalSalaries.toLocaleString()})</td>
        </tr>
        <tr>
          <td class="s-lbl">Refunds & Returns Issued</td>
          <td class="s-val">(${refundsTotal.toLocaleString()})</td>
          <td class="s-lbl">Outstanding Patient Dues</td>
          <td class="s-val">Rs. ${pendingDues.toLocaleString()}</td>
        </tr>
        <tr class="net-row">
          <td colspan="2">NET HOSPITAL CASH IN HAND (SHIFT LIQUIDITY)</td>
          <td colspan="2" class="s-val" style="font-size:12px;">Rs. ${netCash.toLocaleString()}</td>
        </tr>
      </table>

      <!-- Payment Methods & Tender Audit Table -->
      <div class="summary-title">1. Payment Methods & Tender Collections Breakdown</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:40%;">Payment Channel / Tender Method</th>
            <th style="width:20%;" class="text-center">Receipts / Count</th>
            <th style="width:20%;" class="text-right">Collected (PKR)</th>
            <th style="width:20%;" class="text-right">Revenue Share (%)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="font-bold">Cash Payment at Desk (Desk Drawer)</td>
            <td class="text-center font-mono">${pmCash.count || 0}</td>
            <td class="text-right font-mono font-bold">Rs. ${(pmCash.amount || 0).toLocaleString()}</td>
            <td class="text-right font-mono font-bold">${pmCash.percentage || 0}%</td>
          </tr>
          <tr>
            <td class="font-bold">Online Bank Transfer (IBFT / Digital)</td>
            <td class="text-center font-mono">${pmOnline.count || 0}</td>
            <td class="text-right font-mono font-bold">Rs. ${(pmOnline.amount || 0).toLocaleString()}</td>
            <td class="text-right font-mono font-bold">${pmOnline.percentage || 0}%</td>
          </tr>
          <tr>
            <td class="font-bold">Sehat Sahulat Card / Panel Insurance</td>
            <td class="text-center font-mono">${pmSehat.count || 0}</td>
            <td class="text-right font-mono font-bold">Rs. ${(pmSehat.amount || 0).toLocaleString()}</td>
            <td class="text-right font-mono font-bold">${pmSehat.percentage || 0}%</td>
          </tr>
          <tr>
            <td class="font-bold">Debit Card / POS Machine Terminal</td>
            <td class="text-center font-mono">${pmDebit.count || 0}</td>
            <td class="text-right font-mono font-bold">Rs. ${(pmDebit.amount || 0).toLocaleString()}</td>
            <td class="text-right font-mono font-bold">${pmDebit.percentage || 0}%</td>
          </tr>
          <tr style="background:#f3f4f6;font-weight:bold;border-top:1.5px solid #000000;">
            <td>TOTAL TENDERED COLLECTIONS</td>
            <td class="text-center font-mono">${(pmCash.count || 0) + (pmOnline.count || 0) + (pmSehat.count || 0) + (pmDebit.count || 0)}</td>
            <td class="text-right font-mono font-bold">Rs. ${(pmTotal || 0).toLocaleString()}</td>
            <td class="text-right font-mono font-bold">100.0%</td>
          </tr>
        </tbody>
      </table>

      <!-- Departmental Collections Breakdown -->
      <div class="summary-title">2. Departmental Revenue & Outflows Breakdown</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:50%;">Department / Operational Service</th>
            <th style="width:15%;" class="text-center">Type</th>
            <th style="width:15%;" class="text-center">Vouchers / Orders</th>
            <th style="width:20%;" class="text-right">Net Amount (PKR)</th>
          </tr>
        </thead>
        <tbody>
          ${deptBreakdown.map(r => `
            <tr>
              <td class="font-bold">${r.name}</td>
              <td class="text-center">${r.type}</td>
              <td class="text-center font-mono">${r.count}</td>
              <td class="text-right font-mono font-bold">
                ${r.amount < 0 ? `(${Math.abs(r.amount).toLocaleString()})` : `Rs. ${r.amount.toLocaleString()}`}
              </td>
            </tr>
          `).join('')}
          <tr style="background:#f3f4f6;font-weight:bold;border-top:1.5px solid #000000;">
            <td colspan="3">NET SHIFT LIQUIDITY (INCOME - EXPENSES - REFUNDS)</td>
            <td class="text-right font-mono font-bold">Rs. ${netCash.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>

      <!-- Itemized Audit Ledger Table -->
      <div class="summary-title">3. Itemized Audit Transaction Ledger (${filtered.length} Records)</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:12%;">Voucher / Ref #</th>
            <th style="width:10%;">Date</th>
            <th style="width:18%;">Patient / Party Name</th>
            <th style="width:10%;">MRN / Tag</th>
            <th style="width:13%;">Category</th>
            <th style="width:13%;">Channel</th>
            <th style="width:14%;">Description</th>
            <th style="width:10%;" class="text-right">Net (PKR)</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length === 0 ? `
            <tr>
              <td colspan="8" class="text-center" style="padding:15px;color:#666666;">
                No transactions recorded for this selected filter and period.
              </td>
            </tr>
          ` : filtered.map(item => {
            const rawMethod = String(item.paymentMethod || item.normalizedPaymentMethod || 'CASH').toUpperCase();
            let payChan = 'Cash';
            if (item.category === 'EXPENSE' || item.category === 'SALARY' || item.category === 'REFUND') payChan = 'Cash Outflow';
            else if (rawMethod.includes('SEHAT') || rawMethod.includes('PANEL')) payChan = 'Sehat Card';
            else if (rawMethod.includes('ONLINE') || rawMethod.includes('BANK')) payChan = 'Online Bank';
            else if (rawMethod.includes('DEBIT') || rawMethod.includes('CARD') || rawMethod.includes('POS')) payChan = 'Debit Card';

            return `
            <tr>
              <td class="font-mono font-bold">${item.code || 'N/A'}</td>
              <td style="white-space:nowrap;">
                ${item.date ? new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }) : 'N/A'}
              </td>
              <td class="font-bold">${item.patientName || 'Walk-In'}</td>
              <td class="font-mono" style="font-size:9px;">${item.mrn || 'N/A'}</td>
              <td>${item.category || 'N/A'}</td>
              <td class="font-bold" style="font-size:9px;">${payChan}</td>
              <td>${typeof item.details === 'string' ? item.details : 'Itemized Transaction'}</td>
              <td class="text-right font-mono font-bold">
                ${item.category === 'EXPENSE' || item.category === 'REFUND'
                  ? `(${Math.abs(item.paidAmount || 0).toLocaleString()})`
                  : `Rs. ${(item.paidAmount || 0).toLocaleString()}`}
              </td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>

      <!-- Verification & Signatures -->
      <div class="sig-container">
        <div class="sig-col">
          <div class="sig-line">Prepared By</div>
          <div class="sig-role">Front Desk Cashier / Entry Staff</div>
        </div>
        <div class="sig-col">
          <div class="sig-line">Checked & Verified By</div>
          <div class="sig-role">Accounts & Internal Auditor</div>
        </div>
        <div class="sig-col">
          <div class="sig-line">Authorized Signatory</div>
          <div class="sig-role">Medical Superintendent / Director</div>
        </div>
      </div>

      <script>
        setTimeout(function() {
          window.focus();
          window.print();
        }, 350);
      </script>
    </body>
    </html>
  `;

  printWin.document.open();
  printWin.document.write(html);
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
