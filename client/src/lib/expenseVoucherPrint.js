/**
 * Official Super Mart Expense Voucher & Petty Cash Slip Generator
 * Generates an 80mm thermal receipt or A5 print voucher for store expense records.
 */

export const printExpenseVoucher = ({
  storeName = 'METRO SUPER MART & GROCERS',
  hospitalName = '',
  storeAddress = 'Main Commercial Boulevard, Phase 4, City Center',
  hospitalAddress = '',
  expense
}) => {
  if (!expense) return;

  const displayName = storeName || hospitalName || 'METRO SUPER MART';
  const displayAddress = storeAddress || hospitalAddress || 'Main Commercial Boulevard';

  const win = window.open('', '_blank');
  if (!win) {
    alert('Popup blocker prevented receipt printing. Please allow popups.');
    return;
  }

  const amt = parseFloat(expense.amount || 0);
  const expenseDate = new Date(expense.expenseDate || expense.createdAt).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Expense Voucher - ${expense.expenseNo || 'EXP'}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      width: 68mm;
      margin: 1mm auto;
      padding: 0;
      color: #000;
      font-size: 8px;
      line-height: 1.2;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .font-black { font-weight: 900; }
    .header { border-bottom: 1.2px solid #000; padding-bottom: 3px; margin-bottom: 3px; }
    .title { font-size: 11px; font-weight: 900; text-transform: uppercase; margin: 0; }
    .subtitle { font-size: 7.5px; margin: 1px 0 0 0; color: #333; }
    .badge { display: inline-block; padding: 1px 4px; border: 1px solid #000; border-radius: 3px; font-weight: 800; font-size: 8px; margin: 2px 0; }
    .row { display: flex; justify-content: space-between; margin: 1.5px 0; }
    .divider { border-top: 1px solid #000; margin: 3px 0; }
    .double-divider { border-top: 1.2px solid #000; border-bottom: 1.2px solid #000; padding: 2px 0; margin: 3px 0; }
    .amount-box { background: #f4f4f4; border: 1.2px solid #000; padding: 3px; text-align: center; margin: 4px 0; border-radius: 3px; }
    .amount-val { font-size: 12px; font-weight: 900; }
    .signature-area { margin-top: 14px; padding-top: 3px; display: flex; justify-content: space-between; font-size: 7.5px; }
    .sig-line { border-top: 1px solid #000; width: 45%; text-align: center; padding-top: 2px; }
  </style>
</head>
<body>
  <div class="header text-center">
    <h1 class="title">${displayName}</h1>
    <p class="subtitle">${displayAddress}</p>
    <div class="badge">OFFICIAL STORE EXPENSE VOUCHER</div>
    <div style="font-size: 9.5px; margin-top: 3px;">Voucher No: <strong>${expense.expenseNo}</strong></div>
    <div style="font-size: 9px; color: #444;">Date: ${expenseDate}</div>
  </div>

  <div class="row">
    <span>Category:</span>
    <span class="font-bold">${expense.category || 'General Expense'}</span>
  </div>

  <div class="row">
    <span>Description / Title:</span>
    <span class="font-bold" style="text-align: right; max-width: 60%;">${expense.title}</span>
  </div>

  ${expense.paidTo ? `
  <div class="row">
    <span>Paid To (Recipient):</span>
    <span class="font-bold">${expense.paidTo}</span>
  </div>` : ''}

  ${expense.referenceNo ? `
  <div class="row">
    <span>Bill / Ref No:</span>
    <span class="font-bold">${expense.referenceNo}</span>
  </div>` : ''}

  <div class="row">
    <span>Payment Channel:</span>
    <span class="font-bold">${expense.paymentMethod || 'CASH'}</span>
  </div>

  <div class="row">
    <span>Recorded By:</span>
    <span>${expense.recordedBy || 'Front Desk'}</span>
  </div>

  ${expense.notes ? `
  <div class="divider"></div>
  <div style="font-size: 9.5px;"><strong>Remarks / Notes:</strong> ${expense.notes}</div>
  ` : ''}

  <div class="amount-box">
    <div style="font-size: 9px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">Total Amount Paid</div>
    <div class="amount-val">Rs. ${amt.toLocaleString()}</div>
  </div>

  <div class="signature-area">
    <div class="sig-line">Prepared / Paid By</div>
    <div class="sig-line">Receiver / Verified By</div>
  </div>

  <div style="text-align: center; font-size: 8px; color: #666; margin-top: 15px;">
    System-generated store expense record • Super Mart POS
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
