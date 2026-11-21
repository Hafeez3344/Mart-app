/**
 * Official Staff Monthly Salary Pay Slip Print Utility
 * Generates an official A4/A5 salary slip for any hospital staff member with
 * full attendance metrics and advance recovery breakdown.
 */

export const printStaffSalarySlip = ({
  hospitalName = 'SUPER MART POINT OF SALE',
  hospitalAddress = 'Main Commercial Boulevard • Ph: +92 300 1234567',
  currencySymbol = 'Rs. ',
  staff,
  salaryRecord
}) => {
  if (!staff || !salaryRecord) return;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Popup blocker prevented salary slip printing. Please allow popups.');
    return;
  }

  const basic = parseFloat(salaryRecord.basicSalary || staff.baseSalary || 0);
  const earned = parseFloat(salaryRecord.earnedSalary !== undefined && salaryRecord.earnedSalary !== null ? salaryRecord.earnedSalary : basic);
  const allowances = parseFloat(salaryRecord.allowances || 0);
  const deductions = parseFloat(salaryRecord.deductions || 0);
  const advanceDeducted = parseFloat(salaryRecord.advanceDeducted || 0);
  const net = parseFloat(salaryRecord.netSalary || (earned + allowances - deductions));

  const totalDays = salaryRecord.totalDays || 30;
  const presentDays = salaryRecord.presentDays !== undefined ? salaryRecord.presentDays : 30;
  const halfDays = salaryRecord.halfDays || 0;
  const absentDays = salaryRecord.absentDays || 0;
  const leaveDays = salaryRecord.leaveDays || 0;
  const offDays = salaryRecord.offDays || 0;

  const payDate = new Date(salaryRecord.paymentDate || salaryRecord.createdAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const sym = currencySymbol || 'Rs. ';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Salary Pay Slip - ${staff.name || staff.firstName} (${salaryRecord.month} ${salaryRecord.year})</title>
  <style>
    @page { size: A5 landscape; margin: 8mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 14px;
      color: #1e293b;
      font-size: 11.5px;
      line-height: 1.4;
      background: #fff;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .header { border-bottom: 2.5px solid #1F3F66; padding-bottom: 8px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 18px; font-weight: 900; color: #1F3F66; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .subtitle { font-size: 10px; color: #64748b; margin: 2px 0 0 0; }
    .slip-badge { background: #EDF6FF; border: 1.5px solid #B7D7F0; color: #1F3F66; font-weight: 900; font-size: 11px; padding: 4px 10px; border-radius: 6px; }
    .emp-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-bottom: 12px; font-size: 11px; }
    .emp-label { color: #64748b; font-weight: 700; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.3px; }
    .emp-val { color: #0f172a; font-weight: 800; font-size: 11px; }
    .att-box { background: #EDF6FF; border: 1px solid #B7D7F0; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; font-size: 11px; }
    .att-item { text-align: center; }
    .att-num { font-size: 13px; font-weight: 900; color: #1F3F66; }
    .att-lbl { font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
    th { background: #1F3F66; color: #fff; font-weight: 800; text-align: left; padding: 6px 10px; font-size: 10px; text-transform: uppercase; }
    td { padding: 5px 10px; border-bottom: 1px solid #e2e8f0; }
    .total-row { background: #f1f5f9; font-weight: 900; font-size: 12px; color: #1F3F66; }
    .net-box { background: #ecfdf5; border: 2px solid #10b981; border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; }
    .net-title { font-size: 12px; font-weight: 800; color: #065f46; text-transform: uppercase; }
    .net-amount { font-size: 20px; font-weight: 900; color: #047857; font-family: monospace; }
    .signature-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-top: 25px; font-size: 10px; }
    .sig-col { border-top: 1px solid #0f172a; text-align: center; padding-top: 4px; color: #475569; font-weight: 700; }
    .footer { text-align: center; font-size: 9px; color: #94a3b8; margin-top: 12px; border-top: 1px solid #cbd5e1; padding-top: 5px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="title">${hospitalName}</h1>
      <p class="subtitle">${hospitalAddress}</p>
    </div>
    <div style="text-align: right;">
      <div class="slip-badge">OFFICIAL STAFF SALARY SLIP</div>
      <div style="font-size: 10px; font-weight: 700; color: #1F3F66; margin-top: 3px;">Period: <strong>${salaryRecord.month} ${salaryRecord.year}</strong></div>
    </div>
  </div>

  <!-- Employee Info -->
  <div class="emp-grid">
    <div>
      <div class="emp-label">Employee ID</div>
      <div class="emp-val font-mono">${staff.employeeId || 'N/A'}</div>
    </div>
    <div>
      <div class="emp-label">Staff Name</div>
      <div class="emp-val">${staff.name || (staff.firstName + ' ' + (staff.lastName || ''))}</div>
    </div>
    <div>
      <div class="emp-label">Designation</div>
      <div class="emp-val">${staff.designation || 'Mart Staff'}</div>
    </div>
    <div>
      <div class="emp-label">Department</div>
      <div class="emp-val">${staff.department?.name || staff.department || 'Administration'}</div>
    </div>
    <div>
      <div class="emp-label">Disbursement Date</div>
      <div class="emp-val">${payDate}</div>
    </div>
    <div>
      <div class="emp-label">Payment Channel</div>
      <div class="emp-val">${salaryRecord.paymentMethod || 'CASH'}</div>
    </div>
    <div>
      <div class="emp-label">Status</div>
      <div class="emp-val" style="color: #059669;">✓ PAID & CLEARED</div>
    </div>
    <div>
      <div class="emp-label">Voucher Ref</div>
      <div class="emp-val font-mono">${salaryRecord.id ? salaryRecord.id.slice(0, 13) : 'SAL-REF'}</div>
    </div>
  </div>

  <!-- Attendance Metric Breakdown -->
  <div class="att-box">
    <div class="att-item">
      <div class="att-num">${totalDays}</div>
      <div class="att-lbl">Total Days</div>
    </div>
    <div class="att-item">
      <div class="att-num" style="color: #059669;">${presentDays}</div>
      <div class="att-lbl">Present (P)</div>
    </div>
    <div class="att-item">
      <div class="att-num" style="color: #d97706;">${halfDays}</div>
      <div class="att-lbl">Half-Days (HD)</div>
    </div>
    <div class="att-item">
      <div class="att-num" style="color: #0284c7;">${leaveDays + offDays}</div>
      <div class="att-lbl">Leaves / Off</div>
    </div>
    <div class="att-item">
      <div class="att-num" style="color: #dc2626;">${absentDays}</div>
      <div class="att-lbl">Absents (A)</div>
    </div>
    <div class="att-item">
      <div class="att-num font-mono">${sym}${Math.round(basic / (totalDays || 30)).toLocaleString()}</div>
      <div class="att-lbl">Daily Wage</div>
    </div>
  </div>

  <!-- Financial Breakdown -->
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
    <!-- Earnings -->
    <div>
      <table>
        <thead>
          <tr>
            <th>Earnings / Additions</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Base Package Rate</td>
            <td class="text-right font-bold">${sym}${basic.toLocaleString()}</td>
          </tr>
          <tr>
            <td><strong>Earned Salary (Attendance-based)</strong></td>
            <td class="text-right font-bold" style="color: #059669;">${sym}${earned.toLocaleString()}</td>
          </tr>
          <tr>
            <td>Allowances / Bonus</td>
            <td class="text-right font-bold">${sym}${allowances.toLocaleString()}</td>
          </tr>
          <tr class="total-row">
            <td>Gross Disbursable</td>
            <td class="text-right font-bold">${sym}${(earned + allowances).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Deductions -->
    <div>
      <table>
        <thead>
          <tr>
            <th>Deductions / Recoveries</th>
            <th class="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Advance Salary Recovery (-)</td>
            <td class="text-right font-bold" style="color: #dc2626;">${sym}${advanceDeducted.toLocaleString()}</td>
          </tr>
          <tr>
            <td>Other Deductions / Penalties (-)</td>
            <td class="text-right font-bold" style="color: #dc2626;">${sym}${Math.max(0, deductions - advanceDeducted).toLocaleString()}</td>
          </tr>
          <tr>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
          </tr>
          <tr class="total-row">
            <td>Total Deductions</td>
            <td class="text-right font-bold" style="color: #dc2626;">${sym}${deductions.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>

  <!-- Net Take Home Box -->
  <div class="net-box">
    <div>
      <div class="net-title">Net Salary Paid (Take-Home Disbursed)</div>
      <div style="font-size: 10px; color: #065f46;">Full and final monthly compensation cleared</div>
    </div>
    <div class="net-amount">${sym}${net.toLocaleString()}</div>
  </div>

  ${salaryRecord.notes ? `
  <div style="font-size: 10px; background: #f8fafc; border: 1px solid #e2e8f0; padding: 6px 10px; border-radius: 6px; margin-bottom: 15px;">
    <strong>Payroll Remarks:</strong> ${salaryRecord.notes}
  </div>` : ''}

  <div class="signature-grid">
    <div class="sig-col">Prepared By (Accounts Dept)</div>
    <div class="sig-col">Authorized Signatory / Admin</div>
    <div class="sig-col">Employee Signature & Date</div>
  </div>

  <div class="footer">
    This is an official computer-generated salary pay slip from ${hospitalName} • Document Verified
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

  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();

  try {
    win.onafterprint = () => {
      try { win.close(); } catch(e) {}
    };
  } catch(e) {}

  setTimeout(() => {
    try {
      win.focus();
      win.print();
    } catch(e) {}
  }, 400);
};
