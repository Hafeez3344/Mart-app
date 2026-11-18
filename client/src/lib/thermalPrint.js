import api from './api';
import { printMasterReceiptPdf, printMasterReceiptNetworkThermal } from './masterReceiptPdfPrint';
import { printRawBase64ViaWebUsb, printViaWorkstationAgent, isWebUsbPaired, isWorkstationAgentOnline } from './webUsbPrint';

// Export Master Thermal Receipt Generator (Direct Network Thermal with Browser Fallback)
export const printThermalPatientMasterReceipt = printMasterReceiptNetworkThermal;
export const printThermalMartReceipt = (...args) => printThermalPharmacyReceipt(...args);

/**
 * Resolves configured departmental workstation thermal printer from localStorage
 */
export function getWorkstationPrinter(dept = '') {
  if (typeof window === 'undefined') return null;
  try {
    const depts = dept ? [dept, 'laboratory', 'frontdesk', 'workstation'] : ['frontdesk', 'laboratory', 'workstation'];
    for (const d of depts) {
      const deptTarget = localStorage.getItem(`hms_target_${d}`);
      if (deptTarget) return deptTarget;
      const deptSaved = localStorage.getItem(`hms_printer_${d}`);
      if (deptSaved) {
        try {
          const parsed = JSON.parse(deptSaved);
          if (parsed.enabled === false) continue;
          if (parsed.mode === 'WEBUSB') return 'WEBUSB';
          if (parsed.mode === 'LOCAL_AGENT') return 'LOCAL_AGENT';
          if (parsed.mode === 'USB') return `USB:${parsed.usbPrinterName || 'BlackCopper 80mm Series'}`;
          if (parsed.networkIp) return `${parsed.networkIp}:${parsed.networkPort || 9100}`;
        } catch (e) {}
      }
    }
    const globalTarget = localStorage.getItem('hms_workstation_printer');
    if (globalTarget) return globalTarget;
  } catch (e) {
    // ignore
  }
  return null;
}

/**
 * Smart Workstation Dispatcher:
 * - Direct WebUSB (if mode is WEBUSB or device is paired)
 * - Local Workstation Agent on localhost:5005 (if mode is LOCAL_AGENT)
 * - Server Windows Spooler / Shared UNC / Network IP (default)
 */
export async function dispatchWorkstationPrint(endpoint, payload, dept = '') {
  let config = null;
  if (typeof window !== 'undefined') {
    try {
      const depts = dept ? [dept, 'laboratory', 'frontdesk', 'workstation'] : ['frontdesk', 'laboratory', 'workstation'];
      for (const d of depts) {
        const saved = localStorage.getItem(`hms_printer_${d}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.enabled !== false) {
              config = parsed;
              break;
            }
          } catch (e) {}
        }
      }
      if (!config) {
        const gen = localStorage.getItem('hms_printer_workstation');
        if (gen) config = JSON.parse(gen);
      }
    } catch (e) {}
  }

  let isWebUsb = config?.mode === 'WEBUSB' || (!config?.mode && isWebUsbPaired());
  let isAgent = config?.mode === 'LOCAL_AGENT';

  // Auto-detect local workstation printer bridge if running on localhost:5005
  if (!isWebUsb && !isAgent && (!config?.mode || config?.mode === 'USB')) {
    try {
      const agentActive = await isWorkstationAgentOnline();
      if (agentActive) {
        isAgent = true;
      }
    } catch (e) {}
  }

  if (isWebUsb || isAgent) {
    const res = await api.post(endpoint, {
      ...payload,
      returnBuffer: true
    });

    if (res.data?.rawBase64) {
      if (isWebUsb) {
        await printRawBase64ViaWebUsb(res.data.rawBase64);
        return { success: true, method: 'webusb', message: "Printed directly via this PC's USB printer" };
      } else {
        await printViaWorkstationAgent(res.data.rawBase64, config?.usbPrinterName || 'BlackCopper 80mm Series');
        return { success: true, method: 'agent', message: 'Printed directly via local workstation agent' };
      }
    }
  }

  const printerTarget = payload.printerIp || getWorkstationPrinter(dept);
  const res = await api.post(endpoint, {
    ...payload,
    printerIp: printerTarget
  });

  return res.data;
}

/**
 * Direct Hardware Network (TCP/IP) + Smart Browser Fallback for OPD Consultation Token
 */
export const printThermalTokenSlip = async ({
  hospitalName = '',
  hospitalAddress = '',
  hospitalPhone = '',
  patient = {},
  appointment = {},
  tokenNo = '1',
  doctorName = '',
  specialization = '',
  opdRoom = '',
  patientName = '',
  patientMrn = '',
  consultationFee = 0,
  paidAmount = null,
  paymentStatus = '',
  date = '',
  time = '',
  forceBrowserPrint = false
} = {}) => {
  let activeHospitalName = hospitalName;
  let activeHospitalAddress = hospitalAddress;
  let activeHospitalPhone = hospitalPhone;

  if (!activeHospitalName || activeHospitalName === 'DOST & CARE HOSPITAL' || !activeHospitalAddress || !activeHospitalPhone) {
    try {
      const setRes = await api.get('/settings');
      if (setRes.data?.success && setRes.data.settings) {
        const s = setRes.data.settings;
        if (s.hospitalName && (!activeHospitalName || activeHospitalName === 'DOST & CARE HOSPITAL')) {
          activeHospitalName = s.hospitalName;
        }
        if (!activeHospitalAddress && (s.locationAddress || s.address)) {
          activeHospitalAddress = s.locationAddress || s.address;
        }
        if (!activeHospitalPhone && (s.phone || s.contactPhone)) {
          activeHospitalPhone = s.phone || s.contactPhone;
        }
      }
    } catch (e) {
      console.warn('Could not load hospital settings:', e);
    }
  }

  activeHospitalName = activeHospitalName || 'CarePulse Hospital & Health System';

  const dateStr = date
    ? `${new Date(date).toLocaleDateString('en-GB')}${time ? ' ' + time : ''}`
    : new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

  const pName = (patientName || patient?.name || appointment?.patientName || appointment?.patient?.name || 'PATIENT').toUpperCase();
  const pMrn = patientMrn || patient?.mrn || appointment?.patient?.mrn || appointment?.mrn || 'N/A';
  const rawDoc = doctorName || appointment?.doctor?.user?.name;
  const docName = rawDoc
    ? (rawDoc.startsWith('Dr.') ? rawDoc : `Dr. ${rawDoc}`)
    : 'Duty Medical Officer';
  const deptName = specialization || appointment?.doctor?.department?.name || appointment?.doctor?.specialization || 'OPD General';
  const fee = parseFloat(consultationFee || appointment?.consultationFee || 500);

  const resolvedPaid = paidAmount !== null && paidAmount !== undefined
    ? parseFloat(paidAmount)
    : (appointment?.paidAmount !== null && appointment?.paidAmount !== undefined
        ? parseFloat(appointment?.paidAmount)
        : null);

  const rawStatus = (
    paymentStatus ||
    appointment?.paymentStatus ||
    (resolvedPaid !== null && resolvedPaid >= fee && fee > 0
      ? 'PAID'
      : (resolvedPaid !== null && resolvedPaid > 0 ? 'PARTIAL' : (resolvedPaid === 0 ? 'PENDING' : '')))
  ).toString().toUpperCase().trim();

  let displayStatus = 'PAID';
  if (rawStatus === 'UNPAID' || rawStatus === 'PENDING' || rawStatus === 'DUE') {
    displayStatus = 'PENDING';
  } else if (rawStatus === 'PARTIAL') {
    displayStatus = 'PARTIAL';
  } else if (rawStatus === 'PAID') {
    displayStatus = 'PAID';
  } else if (resolvedPaid !== null && resolvedPaid >= fee && fee > 0) {
    displayStatus = 'PAID';
  } else if (resolvedPaid !== null && resolvedPaid > 0) {
    displayStatus = 'PARTIAL';
  } else if (resolvedPaid === 0) {
    displayStatus = 'PENDING';
  }

  // 1. ATTEMPT DIRECT SILENT BACKEND NETWORK OR LOCAL WORKSTATION THERMAL PRINTING
  if (!forceBrowserPrint) {
    try {
      const netRes = await dispatchWorkstationPrint('/print/token', {
        appointmentId: appointment?.id,
        tokenNo: String(tokenNo || appointment?.tokenNo || '1'),
        patientName: pName,
        mrn: pMrn,
        doctorName: docName,
        department: deptName,
        fee,
        paidAmount: resolvedPaid,
        paymentStatus: displayStatus,
        dateStr
      }, 'frontdesk');

      if (netRes?.success) {
        console.log('✓ Token printed silently via thermal printer:', netRes.message);
        return { success: true, method: netRes.method || 'hardware', message: netRes.message };
      }
    } catch (netErr) {
      console.info('Direct thermal printer offline or disabled, opening browser print dialog:', netErr?.response?.data?.message || netErr.message);
    }
  }

  // 2. SEAMLESS FALLBACK TO BROWSER PRINT PREVIEW
  const printWin = window.open('', '_blank');
  if (!printWin) {
    alert('Pop-up blocked. Please allow pop-ups to preview and print thermal tokens.');
    return { success: false, error: 'POPUP_BLOCKED' };
  }

  try {
    const H = '─', V = '│', TL = '┌', TR = '┐', BL = '└', BR = '┘', L = '├', R = '┤';
    const W = 42;

    const border = (w, type) => {
      if (type === 'top') return TL + H.repeat(w) + TR;
      if (type === 'bottom') return BL + H.repeat(w) + BR;
      return L + H.repeat(w) + R;
    };
    const text = (s, align = 'center') => {
      const str = String(s || '').slice(0, W);
      if (align === 'center') {
        const lp = Math.floor((W - str.length) / 2);
        const rp = W - str.length - lp;
        return V + ' '.repeat(Math.max(0, lp)) + str + ' '.repeat(Math.max(0, rp)) + V;
      }
      return V + ' ' + str.padEnd(W - 1, ' ') + V;
    };
    const twoCol = (c1, c2) => {
      const s1 = (' ' + String(c1 || '')).slice(0, 22).padEnd(22, ' ');
      const s2 = (' ' + String(c2 || '')).slice(0, 19).padEnd(19, ' ');
      return V + s1 + V + s2 + V;
    };

    const lines = [];
    lines.push(border(W, 'top'));
    lines.push(text(`[+] ${activeHospitalName.toUpperCase()} [+]`, 'center'));
    if (activeHospitalAddress) lines.push(text(activeHospitalAddress, 'center'));
    if (activeHospitalPhone) lines.push(text(`Ph: ${activeHospitalPhone}`, 'center'));
    lines.push(border(W, 'middle'));
    lines.push(text('OPD CONSULTATION TOKEN', 'center'));
    lines.push(border(W, 'middle'));
    lines.push(text('TOKEN NUMBER', 'center'));
    lines.push(text(`*** #${tokenNo} ***`, 'center'));
    lines.push(text(String(deptName || 'OPD GENERAL').toUpperCase(), 'center'));
    lines.push(border(W, 'middle'));
    lines.push(twoCol(`Patient: ${String(pName).slice(0, 13)}`, `MRN: ${pMrn}`));
    lines.push(twoCol(`Doctor:  ${String(docName).slice(0, 13)}`, `Fee: Rs.${fee.toFixed(0)}`));
    lines.push(twoCol(`Date:    ${String(dateStr).slice(0, 13)}`, `Status: ${displayStatus}`));
    lines.push(border(W, 'middle'));
    lines.push(text('Please wait for your token number.', 'center'));
    lines.push(text('Wish you a speedy recovery!', 'center'));
    lines.push(border(W, 'bottom'));

    const asciiTokenText = lines.join('\n');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>OPD Token #${tokenNo}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0 auto !important;
    }
    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      html, body {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
      }
      .receipt-wrapper {
        width: 78mm !important;
        margin: 0 auto !important;
        padding: 2px 0 !important;
        display: flex !important;
        justify-content: center !important;
      }
      pre.escpos-receipt {
        font-family: 'Courier New', Courier, 'Lucida Console', monospace !important;
        font-size: 13.5px !important;
        line-height: 1.18 !important;
        font-weight: 700 !important;
        color: #000 !important;
        white-space: pre !important;
      }
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html {
      background: #f1f5f9;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 12px 0;
    }
    body {
      background: #fff;
      color: #000;
      margin: 0 auto;
      padding: 4px;
    }
    .receipt-wrapper {
      width: 78mm;
      max-width: 78mm;
      margin: 0 auto;
      display: flex;
      justify-content: center;
    }
    pre.escpos-receipt {
      font-family: 'Courier New', Courier, 'Lucida Console', monospace;
      font-size: 13.5px;
      line-height: 1.18;
      font-weight: 700;
      letter-spacing: 0.1px;
      color: #000;
      white-space: pre;
      margin: 0 auto;
      padding: 0;
      -webkit-font-smoothing: antialiased;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
  </style>
</head>
<body>
  <div class="receipt-wrapper">
    <pre class="escpos-receipt">${asciiTokenText}</pre>
  </div>
</body>
</html>`;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      try { printWin.print(); } catch(e) { console.error('printWin.print() failed:', e); }
    }, 500);
    return { success: true, method: 'browser' };
  } catch (err) {
    console.error('Thermal token print error:', err);
    alert('Failed to launch thermal token print window.');
    return { success: false, error: err.message };
  }
};

export const printThermalPharmacyReceipt = async (options = {}, forceBrowserPrint = false) => {
  try {
    const sale = options.sale || (Array.isArray(options.pharmacySales) ? options.pharmacySales[0] : options);
    if (!sale) return { success: false, error: 'No sale data provided' };

    let hospName = options.hospitalName || '';
    let hospAddress = options.hospitalAddress || '';
    let hospPhone = options.hospitalPhone || '';

    if (!hospName || !hospAddress || !hospPhone) {
      try {
        const setRes = await api.get('/settings');
        if (setRes.data?.success && setRes.data.settings) {
          const s = setRes.data.settings;
          hospName = hospName || s.hospitalName;
          hospAddress = hospAddress || s.locationAddress || s.address;
          hospPhone = hospPhone || s.phone || s.contactPhone;
        }
      } catch (e) {
        console.warn('Could not load hospital settings:', e);
      }
    }

    hospName = hospName || 'CarePulse Hospital';
    hospAddress = hospAddress || 'Plot 14, Sector H-8/4, Islamabad, Pakistan';
    hospPhone = hospPhone || '+92 51 111 222 333';

    const subtotal = sale.subtotal !== undefined ? sale.subtotal : (sale.netTotal || 0);
    const netTotal = sale.netTotal !== undefined ? sale.netTotal : subtotal;
    const paid = sale.paidAmount !== undefined ? sale.paidAmount : (sale.status === 'PAID' ? netTotal : 0);
    const totalRefund = sale.totalRefund || sale.totalSaleRefund || 0;
    const adjustedNet = sale.adjustedNetTotal !== undefined ? sale.adjustedNetTotal : Math.max(0, netTotal - totalRefund);
    const unpaid = sale.unpaidBalance !== undefined ? sale.unpaidBalance : Math.max(0, adjustedNet - paid);

    const rawItems = sale.items || (sale.medicineName ? [{ medicineName: sale.medicineName, quantity: sale.quantity || 1, unitPrice: sale.unitPrice || 0, totalPrice: sale.totalPrice || (sale.unitPrice || 0) * (sale.quantity || 1) }] : []);

    // 1. ATTEMPT DIRECT HARDWARE SILENT THERMAL PRINT (LOCAL USB, WEBUSB, OR TCP/IP)
    if (!forceBrowserPrint) {
      try {
        const netRes = await dispatchWorkstationPrint('/print/pharmacy-receipt', {
          saleId: sale.id,
          invoiceNo: sale.invoiceNo,
          customerName: sale.customerName || options.patient?.name || 'Walk-In Customer',
          customerPhone: sale.customerPhone || options.patient?.phone || '',
          mrn: sale.mrn || options.patient?.mrn || 'N/A',
          items: rawItems,
          subtotal,
          discount: sale.discount || 0,
          netTotal,
          totalRefund,
          adjustedNetTotal: adjustedNet,
          paidAmount: paid,
          balanceDue: unpaid,
          paymentMethod: sale.paymentMethod || 'CASH',
          paidAtCounter: sale.paidAtCounter || 'PHARMACY',
          dateStr: sale.createdAt ? new Date(sale.createdAt).toLocaleString('en-GB') : undefined,
          printerIp: options?.printerIp
        }, 'pharmacy');

        if (netRes?.success) {
          console.log('✓ Pharmacy receipt printed directly to thermal printer:', netRes.message);
          return { success: true, method: netRes.method || 'hardware', message: netRes.message };
        }
      } catch (hardwareErr) {
        console.info('Direct thermal printer unavailable, falling back to browser print:', hardwareErr?.response?.data?.message || hardwareErr.message);
      }
    }

    // 2. FALLBACK TO BROWSER PRINT PREVIEW (with auto-close)
    const itemsRows = rawItems.map(i => {
      const retQty = i.returnedQuantity || 0;
      const activeQty = i.activeQuantity !== undefined ? i.activeQuantity : Math.max(0, (i.quantity || 1) - retQty);
      const activeTot = i.activeTotalPrice !== undefined ? i.activeTotalPrice : (activeQty * (i.unitPrice || 0));

      return `
      <tr>
        <td style="padding: 3px 0; border-bottom: 1px dashed #000; text-align: left; word-break: break-word;">
          ${i.medicineName || 'Medicine'}
          ${retQty > 0 ? `<br/><span style="color:#b91c1c; font-size:8.5px; font-weight:bold;">(Returned: ${retQty} qty)</span>` : ''}
        </td>
        <td style="padding: 3px 0; text-align: center; border-bottom: 1px dashed #000; font-weight: bold;">
          ${retQty > 0 ? `<strike style="color:#888;">${i.quantity}</strike> <strong>${activeQty}</strong>` : (i.quantity || 1)}
        </td>
        <td style="padding: 3px 0; text-align: right; border-bottom: 1px dashed #000;">Rs. ${Number(i.unitPrice || 0).toFixed(0)}</td>
        <td style="padding: 3px 0; text-align: right; font-weight: bold; border-bottom: 1px dashed #000;">
          ${retQty > 0 ? `<strike style="font-weight:normal;color:#888;">Rs. ${Number(i.totalPrice || 0).toFixed(0)}</strike><br/>Rs. ${Number(activeTot).toFixed(0)}` : `Rs. ${Number(i.totalPrice || activeTot).toFixed(0)}`}
        </td>
      </tr>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Receipt #${sale.invoiceNo || 'PHARM-RECEIPT'}</title>
        <style>
          @page { size: 80mm auto; margin: 0; }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: monospace;
            font-size: 11px;
            line-height: 1.35;
            padding: 12px 10px;
            width: 290px;
            margin: 0 auto;
            color: #000;
            background: #fff;
          }
          .header {
            text-align: center;
            border-bottom: 1px dashed #000;
            padding-bottom: 6px;
            margin-bottom: 6px;
          }
          .title {
            font-size: 13px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.3px;
          }
          .sub-info {
            font-size: 9.5px;
            line-height: 1.25;
            margin-top: 1px;
          }
          .inv-tag {
            margin-top: 4px;
            font-weight: bold;
            font-size: 10.5px;
            letter-spacing: 0.4px;
          }
          .info-block {
            margin-bottom: 6px;
            font-size: 11px;
            line-height: 1.35;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 4px;
          }
          th {
            border-bottom: 1px solid #000;
            text-align: left;
            padding: 4px 0;
            text-transform: uppercase;
            font-size: 11px;
            font-weight: 900;
          }
          .totals {
            margin-top: 4px;
            padding-top: 2px;
            font-size: 11px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
          }
          .bold-row {
            font-weight: 900;
          }
          .footer-block {
            text-align: center;
            margin-top: 10px;
            font-size: 10.5px;
            border-top: 1px dashed #000;
            padding-top: 6px;
          }
          @media print {
            html, body {
              width: 100% !important;
              margin: 0 auto !important;
              padding: 4px 6px !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${hospName}</div>
          <div class="sub-info">${hospAddress}</div>
          <div class="sub-info">Ph: ${hospPhone}</div>
          <div class="inv-tag">PHARMACY COUNTER INVOICE</div>
        </div>

        <div class="info-block">
          <div><strong>Inv #:</strong> ${sale.invoiceNo || 'OTC-INV'}</div>
          <div><strong>Date:</strong> ${new Date(sale.createdAt || Date.now()).toLocaleString()}</div>
          <div><strong>Customer:</strong> ${sale.customerName || options.patient?.name || 'Customer'}</div>
          ${sale.customerPhone ? `<div><strong>Phone:</strong> ${sale.customerPhone}</div>` : ''}
          <div><strong>Status:</strong> <span style="font-weight: bold; text-transform: uppercase;">${sale.status || (unpaid > 0 ? 'PENDING' : 'PAID')}</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 44%;">ITEM</th>
              <th style="text-align: center; width: 14%;">QTY</th>
              <th style="text-align: right; width: 21%;">PRICE</th>
              <th style="text-align: right; width: 21%;">TOTAL</th>
            </tr>
          </thead>
          <tbody>${itemsRows}</tbody>
        </table>

        <div class="totals">
          <div class="row">
            <span>Subtotal:</span>
            <span>Rs. ${Number(subtotal).toFixed(2)}</span>
          </div>
          ${(sale.discount || 0) > 0 ? `
            <div class="row">
              <span>Discount:</span>
              <span>- Rs. ${Number(sale.discount).toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="row bold-row" style="margin-top: 4px; border-top: 1px solid #000; padding-top: 3px;">
            <span>Orig. Billed Total:</span>
            <span>Rs. ${Number(netTotal).toFixed(2)}</span>
          </div>
          ${totalRefund > 0 ? `
            <div class="row" style="color: #b91c1c; font-weight: bold;">
              <span>Returned Refund:</span>
              <span>- Rs. ${Number(totalRefund).toFixed(2)}</span>
            </div>
            <div class="row bold-row" style="font-size: 11.5px; margin-top: 2px; border-top: 1px dashed #000; padding-top: 2px;">
              <span>Adjusted Net Total:</span>
              <span>Rs. ${Number(adjustedNet).toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="row">
            <span>Paid (${sale.paymentMethod || 'CASH'}${sale.paidAtCounter === 'FRONTDESK' ? ' • Front Desk Counter' : (sale.paidAtCounter === 'PHARMACY' || paid > 0 ? ' • Pharmacy Counter' : ' • Pending Front Desk')}):</span>
            <span>Rs. ${Number(paid).toFixed(2)}</span>
          </div>
          ${unpaid > 0 ? `
            <div class="row bold-row" style="color:#b91c1c; margin-top: 2px;">
              <span>Unpaid Balance:</span>
              <span>Rs. ${Number(unpaid).toFixed(2)}</span>
            </div>
            <div class="row" style="font-size: 9.5px; color: #64748b; margin-top: 1px;">
              <span>Settlement:</span>
              <span>Pay at Front Desk Counter</span>
            </div>
          ` : ''}
        </div>

        <div class="footer-block">
          Thank you for choosing ${hospName}!
        </div>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Popup window blocked. Please allow popups for this site to preview receipts.');
      return { success: false, error: 'Popup blocked' };
    }
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();

    // Auto-close popup once print dialog finishes or is dismissed
    try {
      printWin.onafterprint = () => {
        try { printWin.close(); } catch(e) {}
      };
    } catch(e) {}

    setTimeout(() => {
      try {
        printWin.print();
      } catch(e) {
        console.error('printWin.print() failed:', e);
      }
    }, 400);

    return { success: true, method: 'browser' };
  } catch (err) {
    console.error('Thermal pharmacy print error:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Direct Hardware TCP/IP / USB Thermal Printing for Medical Services & Procedures
 */
export const printThermalServiceReceipt = async (order = {}, forceBrowserPrint = false, options = {}) => {
  try {
    if (!order) return { success: false, error: 'No order provided' };

    let hospName = order.hospitalName || '';
    let hospAddress = order.hospitalAddress || '';
    let hospPhone = order.hospitalPhone || '';

    if (!hospName || !hospAddress || !hospPhone) {
      try {
        const setRes = await api.get('/settings');
        if (setRes.data?.success && setRes.data.settings) {
          const s = setRes.data.settings;
          hospName = hospName || s.hospitalName;
          hospAddress = hospAddress || s.locationAddress || s.address;
          hospPhone = hospPhone || s.phone || s.contactPhone;
        }
      } catch (e) {}
    }
    hospName = hospName || 'CarePulse Hospital';
    hospAddress = hospAddress || 'Plot 14, Sector H-8/4, Islamabad, Pakistan';
    hospPhone = hospPhone || '+92 51 111 222 333';

    let services = [];
    try {
      services = Array.isArray(order.services) ? order.services : (typeof order.servicesJson === 'string' ? JSON.parse(order.servicesJson) : (order.servicesJson || []));
    } catch(e) {
      services = [];
    }

    const total = order.totalFee || order.netTotal || 0;
    const discount = order.discountAmount || 0;
    const net = order.netTotal || Math.max(0, total - discount);
    const paid = order.paidAmount !== undefined ? order.paidAmount : (order.paymentStatus === 'PAID' ? net : 0);

    // 1. Hardware print attempt
    if (!forceBrowserPrint) {
      try {
        const netRes = await dispatchWorkstationPrint('/print/service-receipt', {
          orderId: order.id,
          orderNo: order.orderNo,
          patientName: order.patientName,
          mrn: order.mrn,
          refDoctor: order.refDoctor,
          services,
          totalFee: total,
          discountAmount: discount,
          netTotal: net,
          paidAmount: paid,
          paymentStatus: order.paymentStatus || 'PAID',
          paymentMethod: order.paymentMethod || 'CASH',
          dateStr: order.createdAt ? new Date(order.createdAt).toLocaleString('en-GB') : undefined,
          printerIp: options?.printerIp
        }, 'frontdesk');
        if (netRes?.success) {
          return { success: true, method: netRes.method || 'hardware', message: netRes.message };
        }
      } catch(e) {}
    }

    // 2. Fallback browser print preview
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Popup window blocked. Please allow popups to preview receipts.');
      return { success: false, error: 'Popup blocked' };
    }

    const servicesRows = services.map(s => `
      <tr>
        <td style="padding: 3px 0; border-bottom: 1px dashed #000; text-align: left;">${s.name || s.serviceName || 'Service'}</td>
        <td style="padding: 3px 0; text-align: center; border-bottom: 1px dashed #000; font-weight: bold;">1</td>
        <td style="padding: 3px 0; text-align: right; font-weight: bold; border-bottom: 1px dashed #000;">Rs. ${Number(s.fee || s.amount || 0).toFixed(0)}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html><html><head><title>Receipt #${order.orderNo}</title>
    <style>
      @page { size: 80mm auto; margin: 0; }
      body { font-family: monospace; font-size: 11px; line-height: 1.35; padding: 12px 10px; width: 290px; margin: 0 auto; color: #000; background: #fff; }
      .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
      .title { font-size: 13px; font-weight: 900; text-transform: uppercase; }
      .sub-info { font-size: 9.5px; line-height: 1.25; margin-top: 1px; }
      .inv-tag { margin-top: 4px; font-weight: bold; font-size: 10.5px; }
      .info-block { margin-bottom: 6px; font-size: 11px; line-height: 1.35; }
      table { width: 100%; border-collapse: collapse; margin-top: 4px; }
      th { border-bottom: 1px solid #000; text-align: left; padding: 4px 0; text-transform: uppercase; font-size: 11px; font-weight: 900; }
      .totals { margin-top: 4px; padding-top: 2px; font-size: 11px; border-top: 1px dashed #000; }
      .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
      .bold-row { font-weight: 900; }
      .footer-block { text-align: center; margin-top: 10px; font-size: 10.5px; border-top: 1px dashed #000; padding-top: 6px; }
    </style></head><body>
      <div class="header">
        <div class="title">${hospName}</div>
        <div class="sub-info">${hospAddress}</div>
        <div class="sub-info">Ph: ${hospPhone}</div>
        <div class="inv-tag">MEDICAL SERVICES & PROCEDURES RECEIPT</div>
      </div>
      <div class="info-block">
        <div><strong>Order #:</strong> ${order.orderNo}</div>
        <div><strong>Date:</strong> ${new Date(order.createdAt || Date.now()).toLocaleString()}</div>
        <div><strong>Patient:</strong> ${order.patientName} (${order.mrn || 'N/A'})</div>
        <div><strong>Doctor:</strong> ${order.refDoctor || 'Consultant'}</div>
        <div><strong>Status:</strong> <span style="font-weight: bold; text-transform: uppercase;">${order.paymentStatus || 'PAID'}</span></div>
      </div>
      <table>
        <thead><tr><th style="width: 60%;">SERVICE</th><th style="text-align: center; width: 15%;">QTY</th><th style="text-align: right; width: 25%;">FEE</th></tr></thead>
        <tbody>${servicesRows}</tbody>
      </table>
      <div class="totals">
        <div class="row"><span>Total Fee:</span><span>Rs. ${Number(total).toFixed(2)}</span></div>
        ${discount > 0 ? `<div class="row"><span>Discount:</span><span>- Rs. ${Number(discount).toFixed(2)}</span></div>` : ''}
        <div class="row bold-row" style="margin-top: 4px; border-top: 1px solid #000; padding-top: 3px;">
          <span>Net Payable:</span><span>Rs. ${Number(net).toFixed(2)}</span>
        </div>
        <div class="row"><span>Paid (${order.paymentMethod || 'CASH'}):</span><span>Rs. ${Number(paid).toFixed(2)}</span></div>
      </div>
      <div class="footer-block">Thank you for choosing ${hospName}!<br/>Wish you speedy recovery.</div>
      <script>setTimeout(function(){ window.focus(); window.print(); }, 350);</script>
    </body></html>`;

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
      try { printWin.print(); } catch(e) {}
    }, 400);

    return { success: true, method: 'browser' };
  } catch(err) {
    console.error('Print service receipt error:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Direct Hardware TCP/IP / USB Thermal Printing for Laboratory Test Order Receipt
 * Performs silent printing without browser popup, with high-clarity 80mm fallback
 */
export const printThermalLabReceipt = async (order = {}, forceBrowserPrint = false, options = {}) => {
  try {
    if (!order) return { success: false, error: 'No lab order provided' };

    let hospName = order.hospitalName || '';
    let hospAddress = order.hospitalAddress || '';
    let hospPhone = order.hospitalPhone || '';

    if (!hospName || !hospAddress || !hospPhone) {
      try {
        const setRes = await api.get('/settings');
        if (setRes.data?.success && setRes.data.settings) {
          const s = setRes.data.settings;
          hospName = hospName || s.hospitalName;
          hospAddress = hospAddress || s.locationAddress || s.address;
          hospPhone = hospPhone || s.phone || s.contactPhone;
        }
      } catch (e) {}
    }
    hospName = hospName || 'Al Shiffa General Hospital Samar Bagh';
    hospAddress = hospAddress || 'Near THQ Samar Bagh Lower Dir';
    hospPhone = hospPhone || '+92 51 111 222 333';

    let tests = [];
    try {
      tests = Array.isArray(order.tests) ? order.tests : (typeof order.testsJson === 'string' ? JSON.parse(order.testsJson) : (order.testsJson || []));
    } catch(e) {
      tests = [];
    }

    const total = order.totalFee || order.netTotal || 0;
    const discount = order.discountAmount || 0;
    const net = order.netTotal || Math.max(0, total - discount);
    const paid = order.paidAmount !== undefined ? order.paidAmount : ((order.paymentStatus === 'PAID' || order.isPaid) ? net : 0);
    const dues = Math.max(0, net - paid);

    const isExt = order.patientType === 'EXTERNAL' || order.mrn === 'WALK-IN';
    const mrnDisplay = isExt && (!order.mrn || order.mrn === 'WALK-IN') ? 'WALK-IN (OUTSIDE)' : (order.mrn || 'N/A');
    const doctorDisplay = order.refDoctor || (isExt ? 'Outside Referring Physician / Self' : 'Hospital OPD Consultant');

    // 1. Silent Hardware Print Attempt (Windows USB Spooler or TCP/IP Network Printer)
    if (!forceBrowserPrint) {
      try {
        const netRes = await dispatchWorkstationPrint('/print/lab-receipt', {
          orderId: order.id,
          orderNo: order.orderNo,
          patientName: order.patientName,
          patientType: isExt ? 'EXTERNAL' : 'INTERNAL',
          isExternal: isExt,
          phone: order.phone,
          mrn: mrnDisplay,
          gender: order.gender,
          age: order.age,
          refDoctor: doctorDisplay,
          tests,
          totalFee: total,
          discountAmount: discount,
          netTotal: net,
          paidAmount: paid,
          balanceDue: dues,
          paymentStatus: order.paymentStatus || (dues === 0 ? 'PAID' : 'PARTIAL'),
          paymentMethod: order.paymentMethod || 'CASH',
          paidAtCounter: order.paidAtCounter || 'FRONTDESK',
          dateStr: order.createdAt ? new Date(order.createdAt).toLocaleString('en-GB') : undefined,
          printerIp: options?.printerIp
        }, 'laboratory');

        if (netRes?.success) {
          console.log('✓ Lab receipt printed silently via hardware:', netRes.destination || netRes.message);
          return { success: true, method: netRes.method || 'hardware', message: netRes.message };
        }
      } catch(e) {
        console.warn('Silent hardware thermal printing error:', e?.response?.data?.message || e?.message);
        if (options?.silentOnly) {
          return { success: false, error: e?.response?.data?.message || e?.message };
        }
      }
    }

    // 2. Fallback High-Clarity 80mm Browser Print Preview (Only if hardware print failed or forced)
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Popup window blocked. Please allow popups to preview receipts.');
      return { success: false, error: 'Popup blocked' };
    }

    const testsRows = tests.map(t => {
      const tName = t.name || t.testName || 'Diagnostic Test';
      const tFee = Number(t.fee || t.price || 0);
      return `
        <tr>
          <td style="border: 1px solid #000000; padding: 4px 6px; text-align: left; font-weight: 700; color: #000;">
            ${tName}
          </td>
          <td style="border: 1px solid #000000; padding: 4px 6px; text-align: center; font-weight: 800; color: #000;">1</td>
          <td style="border: 1px solid #000000; padding: 4px 6px; text-align: right; font-weight: 800; color: #000;">Rs. ${tFee.toFixed(0)}</td>
        </tr>
      `;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Lab Receipt #${order.orderNo}</title>
    <style>
      @page { size: 80mm auto; margin: 0; }
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, monospace;
        font-size: 11.5px;
        line-height: 1.35;
        padding: 6px 4px;
        width: 76mm;
        max-width: 310px;
        margin: 0 auto;
        color: #000000;
        background: #ffffff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .receipt-table {
        width: 100%;
        border: 2px solid #000000;
        border-collapse: collapse;
        background: #ffffff;
      }
      .receipt-table td, .receipt-table th {
        border: 1px solid #000000;
        padding: 4px 6px;
        color: #000000;
      }
      .header-cell {
        text-align: center;
        border-bottom: 2px solid #000000 !important;
        padding: 8px 4px !important;
      }
      .title {
        font-size: 14px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 2px;
      }
      .sub-info {
        font-size: 10px;
        font-weight: 600;
        line-height: 1.25;
      }
      .badge-cell {
        background: #000000 !important;
        color: #ffffff !important;
        font-weight: 900;
        font-size: 11px;
        letter-spacing: 0.5px;
        text-align: center;
        text-transform: uppercase;
        padding: 4px !important;
        border-bottom: 2px solid #000000 !important;
      }
      .th-header th {
        background: #e2e8f0 !important;
        font-weight: 900;
        font-size: 11px;
        text-transform: uppercase;
        border: 1px solid #000000 !important;
      }
      .total-row td {
        font-size: 11.5px;
        font-weight: 700;
      }
      .net-row td {
        background: #f1f5f9 !important;
        font-size: 13px !important;
        font-weight: 900 !important;
        border-top: 2px solid #000000 !important;
        border-bottom: 2px solid #000000 !important;
      }
      .footer-cell {
        text-align: center;
        border-top: 2px solid #000000 !important;
        padding: 6px 4px !important;
        font-size: 10px;
        font-weight: 600;
        line-height: 1.35;
      }
      @media print {
        body { padding: 0 !important; width: 100% !important; }
        .receipt-table { border: 2px solid #000000 !important; }
      }
    </style></head><body>
      <table class="receipt-table">
        <tr>
          <td colspan="3" class="header-cell">
            <div class="title">${hospName}</div>
            <div class="sub-info">${hospAddress}</div>
            <div class="sub-info">Ph: ${hospPhone}</div>
          </td>
        </tr>
        <tr>
          <td colspan="3" class="badge-cell">PATHOLOGY &amp; DIAGNOSTICS INVOICE</td>
        </tr>
        <tr>
          <td colspan="2" style="width: 58%;"><strong>Order No:</strong> ${order.orderNo}</td>
          <td style="width: 42%; text-align: right;"><strong>Date:</strong> ${new Date(order.createdAt || Date.now()).toLocaleDateString('en-GB')}</td>
        </tr>
        <tr>
          <td colspan="3"><strong>Patient:</strong> ${order.patientName} (${order.gender || ''} ${order.age ? `${order.age}Y` : ''})</td>
        </tr>
        <tr>
          <td colspan="2"><strong>Origin:</strong> ${isExt ? 'WALK-IN (OUTSIDE)' : 'INPATIENT (HOSPITAL)'}</td>
          <td style="text-align: right;"><strong>MRN:</strong> ${mrnDisplay}</td>
        </tr>
        ${order.phone && order.phone !== 'N/A' ? `
        <tr>
          <td colspan="2"><strong>Phone:</strong> ${order.phone}</td>
          <td style="text-align: right;"><strong>Counter:</strong> ${order.paidAtCounter === 'LAB_COUNTER' ? 'LAB COUNTER' : (order.paidAtCounter || 'FRONTDESK')}</td>
        </tr>
        ` : `
        <tr>
          <td colspan="3"><strong>Counter:</strong> ${order.paidAtCounter === 'LAB_COUNTER' ? 'LAB COUNTER' : (order.paidAtCounter || 'FRONTDESK')}</td>
        </tr>
        `}
        <tr>
          <td colspan="3"><strong>Doctor:</strong> ${doctorDisplay}</td>
        </tr>
        <tr class="th-header">
          <th style="width: 58%; text-align: left;">PRESCRIBED TEST / PANEL</th>
          <th style="width: 14%; text-align: center;">QTY</th>
          <th style="width: 28%; text-align: right;">FEE</th>
        </tr>
        ${testsRows}
        <tr class="total-row">
          <td colspan="2" style="text-align: right;">Subtotal Tests Fee:</td>
          <td style="text-align: right; font-weight: 800;">Rs. ${Number(total).toFixed(2)}</td>
        </tr>
        ${discount > 0 ? `
        <tr class="total-row">
          <td colspan="2" style="text-align: right;">Discount Concession:</td>
          <td style="text-align: right; font-weight: 800;">- Rs. ${Number(discount).toFixed(2)}</td>
        </tr>
        ` : ''}
        <tr class="net-row">
          <td colspan="2" style="text-align: right;">NET DIAGNOSTIC BILL:</td>
          <td style="text-align: right;">Rs. ${Number(net).toFixed(2)}</td>
        </tr>
        <tr class="total-row">
          <td colspan="2" style="text-align: right;">Paid (${order.paymentMethod || 'CASH'}):</td>
          <td style="text-align: right; font-weight: 900;">Rs. ${Number(paid).toFixed(2)}</td>
        </tr>
        ${dues > 0 ? `
        <tr style="color: #b91c1c; font-weight: 900;">
          <td colspan="2" style="text-align: right;">PENDING BALANCE DUE:</td>
          <td style="text-align: right;">Rs. ${Number(dues).toFixed(2)}</td>
        </tr>
        <tr>
          <td colspan="3" style="text-align: center; color: #b91c1c; font-weight: 800; font-size: 10px; background: #fff1f2;">
            *** Pay pending settlement at Front Desk Counter ***
          </td>
        </tr>
        ` : `
        <tr style="color: #047857; font-weight: 900;">
          <td colspan="2" style="text-align: right;">PAYMENT STATUS:</td>
          <td style="text-align: right;">PAID IN FULL</td>
        </tr>
        `}
        <tr>
          <td colspan="3" class="footer-cell">
            Please present this slip for sample submission &amp; report collection.<br/>
            *** THANK YOU FOR VISITING ***<br/>
            <strong>${hospName}</strong>
          </td>
        </tr>
      </table>
      <script>setTimeout(function(){ window.focus(); window.print(); }, 350);</script>
    </body></html>`;

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
      try { printWin.print(); } catch(e) {}
    }, 400);

    return { success: true, method: 'browser' };
  } catch(err) {
    console.error('Print lab receipt error:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Direct Hardware Network / USB Thermal Print with High-Resolution Browser Fallback for X-Ray / Radiology Scan Receipts
 */
export const printThermalXrayReceipt = async (order = {}, forceBrowserPrint = false, options = {}) => {
  try {
    if (!order) return { success: false, error: 'No X-Ray order provided' };

    let hospName = order.hospitalName || '';
    let hospAddress = order.hospitalAddress || '';
    let hospPhone = order.hospitalPhone || '';

    if (!hospName || !hospAddress || !hospPhone) {
      try {
        const setRes = await api.get('/settings');
        if (setRes.data?.success && setRes.data.settings) {
          const s = setRes.data.settings;
          hospName = hospName || s.hospitalName;
          hospAddress = hospAddress || s.locationAddress || s.address;
          hospPhone = hospPhone || s.phone || s.contactPhone;
        }
      } catch (e) {}
    }
    hospName = hospName || 'Al Shiffa General Hospital Samar Bagh';
    hospAddress = hospAddress || 'Near THQ Samar Bagh Lower Dir';
    hospPhone = hospPhone || '+92 51 111 222 333';

    let scans = [];
    try {
      if (Array.isArray(order.scans)) {
        scans = order.scans;
      } else if (order.scanType) {
        scans = [{
          name: order.scanType,
          modality: order.modality || 'Digital X-Ray',
          bodyPart: order.bodyPart || 'Chest / Thorax',
          fee: order.fee || order.netTotal || 0
        }];
      }
    } catch(e) {
      scans = [];
    }

    const total = order.fee !== undefined ? order.fee : (order.totalFee || order.netTotal || 0);
    const discount = order.discountAmount || 0;
    const net = order.netTotal !== undefined ? order.netTotal : Math.max(0, total - discount);
    const paid = order.paidAmount !== undefined ? order.paidAmount : ((order.paymentStatus === 'PAID' || order.isPaid) ? net : 0);
    const dues = Math.max(0, net - paid);

    const isExt = order.patientType === 'EXTERNAL' || order.mrn === 'WALK-IN';
    const mrnDisplay = isExt && (!order.mrn || order.mrn === 'WALK-IN') ? 'WALK-IN (OUTSIDE)' : (order.mrn || 'N/A');
    const doctorDisplay = order.referringDoctor || (isExt ? 'Outside Referring Physician / Self' : 'Hospital OPD Consultant');

    // 1. Silent Hardware Print Attempt (Windows USB Spooler or TCP/IP Network Printer)
    if (!forceBrowserPrint) {
      try {
        const netRes = await dispatchWorkstationPrint('/print/xray-receipt', {
          orderId: order.id,
          orderNo: order.orderNo,
          patientName: order.patientName,
          patientType: isExt ? 'EXTERNAL' : 'INTERNAL',
          isExternal: isExt,
          phone: order.phone,
          mrn: mrnDisplay,
          gender: order.gender,
          age: order.age,
          referringDoctor: doctorDisplay,
          scanType: order.scanType,
          modality: order.modality,
          bodyPart: order.bodyPart,
          priority: order.priority || 'Routine',
          scans,
          fee: total,
          discountAmount: discount,
          netTotal: net,
          paidAmount: paid,
          balanceDue: dues,
          paymentStatus: order.paymentStatus || (dues === 0 ? 'PAID' : 'PARTIAL'),
          paymentMethod: order.paymentMethod || 'CASH',
          paidAtCounter: order.paidAtCounter || 'FRONTDESK',
          dateStr: order.createdAt ? new Date(order.createdAt).toLocaleString('en-GB') : undefined,
          printerIp: options?.printerIp
        }, 'radiology');

        if (netRes?.success) {
          console.log('✓ X-Ray receipt printed silently via hardware:', netRes.destination || netRes.message);
          return { success: true, method: netRes.method || 'hardware', message: netRes.message };
        }
      } catch(e) {
        console.warn('Silent hardware thermal printing error:', e?.response?.data?.message || e?.message);
        if (options?.silentOnly) {
          return { success: false, error: e?.response?.data?.message || e?.message };
        }
      }
    }

    // 2. Fallback High-Clarity 80mm Browser Print Preview (Only if hardware print failed or forced)
    const printWin = window.open('', '_blank');
    if (!printWin) {
      alert('Popup window blocked. Please allow popups to preview receipts.');
      return { success: false, error: 'Popup blocked' };
    }

    const scansRows = (scans.length > 0 ? scans : [{ name: order.scanType || 'Radiology Scan', modality: order.modality || 'X-Ray', fee: total }]).map(s => {
      const sName = s.name || s.scanType || order.scanType || 'Radiology Scan';
      const sMod = (s.modality || order.modality || 'X-RAY').substring(0, 8);
      const sFee = Number(s.fee || s.price || total || 0);
      return `
        <tr>
          <td style="border: 1px solid #000000; padding: 4px 6px; text-align: left; font-weight: 700; color: #000;">
            ${sName}
            ${s.bodyPart || order.bodyPart ? `<div style="font-size:9.5px;font-weight:normal;color:#333;">Region: ${s.bodyPart || order.bodyPart}</div>` : ''}
          </td>
          <td style="border: 1px solid #000000; padding: 4px 6px; text-align: center; font-weight: 800; color: #000;">${s.quantity || s.qty || 1}</td>
          <td style="border: 1px solid #000000; padding: 4px 6px; text-align: right; font-weight: 800; color: #000;">Rs. ${sFee.toFixed(0)}</td>
        </tr>
      `;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>X-Ray Receipt #${order.orderNo}</title>
    <style>
      @page { size: 80mm auto; margin: 0; }
      * { box-sizing: border-box; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, monospace;
        font-size: 11.5px;
        line-height: 1.35;
        padding: 6px 4px;
        width: 76mm;
        max-width: 310px;
        margin: 0 auto;
        color: #000000;
        background: #ffffff;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .receipt-table {
        width: 100%;
        border: 2px solid #000000;
        border-collapse: collapse;
        background: #ffffff;
      }
      .receipt-table td, .receipt-table th {
        border: 1px solid #000000;
        padding: 4px 6px;
        color: #000000;
      }
      .header-cell {
        text-align: center;
        border-bottom: 2px solid #000000 !important;
        padding: 8px 4px !important;
      }
      .title {
        font-size: 14px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 2px;
      }
      .sub-info {
        font-size: 10px;
        font-weight: 600;
        line-height: 1.25;
      }
      .badge-cell {
        background: #000000;
        color: #ffffff !important;
        text-align: center;
        font-weight: 900;
        font-size: 12px;
        letter-spacing: 1px;
        padding: 4px 0;
      }
    </style>
    </head><body>
      <table class="receipt-table">
        <tr>
          <td colspan="3" class="header-cell">
            <div class="title">${hospName}</div>
            <div class="sub-info">${hospAddress}</div>
            <div class="sub-info">Ph: ${hospPhone}</div>
          </td>
        </tr>
        <tr>
          <td colspan="3" class="badge-cell">
            RADIOLOGY & X-RAY RECEIPT
          </td>
        </tr>
        <tr>
          <td colspan="2" style="font-weight: 800; font-size: 12px;">ORDER: ${order.orderNo || 'XR-RECEIPT'}</td>
          <td style="text-align: right; font-weight: 700; font-size: 10px;">${order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}</td>
        </tr>
        <tr>
          <td colspan="3" style="font-size: 12px; font-weight: 800; text-transform: uppercase;">
            PATIENT: ${order.patientName || 'WALK-IN'}
          </td>
        </tr>
        <tr>
          <td colspan="2" style="font-size: 10.5px; font-weight: 700;">
            MRN: ${mrnDisplay}
          </td>
          <td style="text-align: right; font-size: 10.5px; font-weight: 700;">
            ${order.gender || ''} ${order.age ? `(${order.age}Y)` : ''}
          </td>
        </tr>
        <tr>
          <td colspan="3" style="font-size: 10px; font-weight: 600;">
            Doctor: ${doctorDisplay}
          </td>
        </tr>
        <tr style="background: #f0f0f0;">
          <th style="text-align: left; font-size: 10px; font-weight: 900; border: 1px solid #000;">SCAN / EXAMINATION</th>
          <th style="text-align: center; font-size: 10px; font-weight: 900; border: 1px solid #000; width: 45px;">QTY</th>
          <th style="text-align: right; font-size: 10px; font-weight: 900; border: 1px solid #000; width: 65px;">FEE</th>
        </tr>
        ${scansRows}
        <tr>
          <td colspan="2" style="text-align: right; font-weight: 700;">Scan Total:</td>
          <td style="text-align: right; font-weight: 700;">Rs. ${Number(total).toFixed(0)}</td>
        </tr>
        ${Number(discount) > 0 ? `
        <tr>
          <td colspan="2" style="text-align: right; font-weight: 700; color: #000;">Discount Concession:</td>
          <td style="text-align: right; font-weight: 700; color: #000;">-Rs. ${Number(discount).toFixed(0)}</td>
        </tr>` : ''}
        <tr style="border-top: 2px solid #000;">
          <td colspan="2" style="text-align: right; font-weight: 900; font-size: 12px;">NET RADIOLOGY BILL:</td>
          <td style="text-align: right; font-weight: 900; font-size: 12px;">Rs. ${Number(net).toFixed(0)}</td>
        </tr>
        <tr>
          <td colspan="2" style="text-align: right; font-weight: 800;">PAID (${order.paymentMethod || 'CASH'}):</td>
          <td style="text-align: right; font-weight: 800;">Rs. ${Number(paid).toFixed(0)}</td>
        </tr>
        ${Number(dues) > 0 ? `
        <tr style="color: #000;">
          <td colspan="2" style="text-align: right; font-weight: 900;">BALANCE DUE:</td>
          <td style="text-align: right; font-weight: 900;">Rs. ${Number(dues).toFixed(0)}</td>
        </tr>` : ''}
        <tr>
          <td colspan="2" style="text-align: right; font-weight: 800;">STATUS:</td>
          <td style="text-align: right; font-weight: 900;">${dues <= 0 || order.paymentStatus === 'PAID' ? 'PAID IN FULL' : 'PENDING'}</td>
        </tr>
        <tr>
          <td colspan="3" style="text-align: center; padding: 6px 4px; font-size: 9.5px; border-top: 2px solid #000;">
            Please bring this slip to X-Ray Room<br/>
            *** THANK YOU FOR VISITING ***<br/>
            <strong>${hospName}</strong>
          </td>
        </tr>
      </table>
      <script>setTimeout(function(){ window.focus(); window.print(); }, 350);</script>
    </body></html>`;

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
      try { printWin.print(); } catch(e) {}
    }, 400);

    return { success: true, method: 'browser' };
  } catch(err) {
    console.error('Print X-Ray receipt error:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Direct Hardware Network / USB Thermal Print with High-Resolution Browser Fallback for Medicine Barcode Stickers
 */
export const printThermalBarcodeLabel = async ({
  medicine = {},
  barcodeDataUrl = '',
  hospitalName = '',
  quantity = 10,
  layoutMode = 'dual', // 'dual' (2-in-a-row for 4BARCODE / 80mm rolls) or 'single'
  rotate90 = false,     // If printer driver or Chrome flips orientation
  forceBrowserPrint = false
} = {}) => {
  const medName = medicine?.name || 'Medicine Item';
  const generic = medicine?.genericName || '';
  const barcode = medicine?.barcode || '890123456701';
  const price = medicine?.retailPrice || 0;
  const expStr = medicine?.expiryDate ? new Date(medicine.expiryDate).toLocaleDateString('en-GB') : '';
  const hospName = hospitalName || 'CarePulse Hospital Pharmacy';
  const qty = Math.min(100, Math.max(1, parseInt(quantity, 10) || 10));

  // 1. ATTEMPT DIRECT SILENT HARDWARE THERMAL PRINT (USB SPOOLER OR TCP/IP 9100)
  if (!forceBrowserPrint) {
    try {
      const netRes = await api.post('/print/barcode-sticker', {
        medicineName: medName,
        genericName: generic,
        barcode,
        retailPrice: price,
        expiryDate: medicine?.expiryDate,
        hospitalName: hospName,
        quantity: qty,
        printerIp: getWorkstationPrinter('pharmacy')
      });

      if (netRes.data?.success) {
        console.log(`✓ ${qty} Barcode sticker(s) printed silently via hardware thermal printer:`, netRes.data.message);
        return { success: true, method: 'hardware', message: netRes.data.message, copies: qty };
      }
    } catch (netErr) {
      console.info('Hardware thermal printer offline or busy, falling back to high-res browser print:', netErr?.response?.data?.message || netErr.message);
    }
  }

  // 2. ULTRA HIGH-RES BROWSER LABEL PRINT (OPTIMIZED FOR 4BARCODE 4B-2054K & 2-IN-A-ROW ROLLS)
  try {
    const printWin = window.open('', '_blank', 'width=700,height=750');
    if (!printWin) {
      alert('Pop-up blocked. Please allow pop-ups to print barcode stickers.');
      return { success: false, error: 'POPUP_BLOCKED' };
    }

    const singleCard = `
      <div class="sticker-card">
        <div class="hosp-title">${hospName}</div>
        <div class="med-title">${medName}</div>
        ${generic ? `<div class="med-generic">${generic}</div>` : ''}
        <div class="barcode-container">
          ${barcodeDataUrl ? `<img class="barcode-img" src="${barcodeDataUrl}" alt="Barcode ${barcode}" />` : ''}
        </div>
        <div class="footer-row">
          <span class="price-tag">Rs. ${Number(price).toLocaleString()}</span>
          ${expStr ? `<span class="exp-tag">EXP: ${expStr}</span>` : '<span class="exp-tag">PHARMACY</span>'}
        </div>
      </div>
    `;

    let contentHtml = '';
    if (layoutMode === 'dual') {
      // Pair into rows of 2 for dual-column 38x25mm rolls
      const rows = [];
      for (let i = 0; i < qty; i += 2) {
        const leftCard = singleCard;
        const rightCard = (i + 1 < qty) ? singleCard : '<div class="sticker-card empty"></div>';
        rows.push(`
          <div class="sticker-row">
            ${leftCard}
            ${rightCard}
          </div>
        `);
      }
      contentHtml = `<div class="stickers-container ${rotate90 ? 'is-rotated' : ''}">${rows.join('\n')}</div>`;
    } else {
      contentHtml = `
        <div class="stickers-grid ${rotate90 ? 'is-rotated' : ''}">
          ${Array.from({ length: qty }).map(() => singleCard).join('\n')}
        </div>
      `;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Barcode Batch (${qty}x) - ${medName}</title>
  <style>
    @page {
      ${layoutMode === 'dual' ? (rotate90 ? 'size: 25mm 80mm;' : 'size: 80mm 25mm;') : 'size: auto;'}
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #fff;
      color: #000;
      padding: ${layoutMode === 'dual' ? '0' : '6px'};
      margin: 0 auto;
      ${layoutMode === 'dual' ? (rotate90 ? 'width: 25mm;' : 'width: 78mm;') : ''}
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .batch-header {
      font-size: 10px;
      font-weight: bold;
      color: #555;
      text-align: center;
      margin-bottom: 6px;
      padding-bottom: 3px;
      border-bottom: 1px dashed #ccc;
    }
    @media print {
      .batch-header {
        display: none !important;
      }
    }

    /* DUAL COLUMN (2 IN A ROW) LAYOUT */
    .stickers-container {
      width: 78mm;
      margin: 0 auto;
    }
    .stickers-container.is-rotated {
      transform: rotate(-90deg);
      transform-origin: top left;
      position: absolute;
      left: 0;
      top: 78mm;
    }
    .sticker-row {
      display: flex;
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      width: 78mm;
      height: 24.8mm;
      max-height: 24.8mm;
      page-break-inside: avoid;
      break-inside: avoid;
      padding: 0 0.5mm;
      overflow: hidden;
      box-sizing: border-box;
    }
    .sticker-row .sticker-card {
      width: 37mm;
      max-width: 37mm;
      height: 23mm;
      max-height: 23mm;
      padding: 1mm 1.5mm;
      border: 1px dashed #cbd5e1;
      border-radius: 2px;
      text-align: center;
      background: #fff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
      box-sizing: border-box;
    }
    @media print {
      .sticker-row .sticker-card {
        border: none !important;
      }
    }
    .sticker-card.empty {
      visibility: hidden;
      border: none !important;
    }

    /* SINGLE COLUMN FALLBACK */
    .stickers-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
      align-items: flex-start;
      margin: 0 auto;
    }
    .stickers-grid .sticker-card {
      width: 160px;
      padding: 5px 6px;
      border: 1.5px solid #000;
      border-radius: 4px;
      text-align: center;
      background: #fff;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* SHARED CARD STYLING */
    .hosp-title {
      font-size: ${layoutMode === 'dual' ? '7px' : '8px'};
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.1;
      border-bottom: 0.5px solid #000;
      padding-bottom: 1px;
    }
    .med-title {
      font-size: ${layoutMode === 'dual' ? '8.5px' : '11px'};
      font-weight: 900;
      line-height: 1.1;
      color: #000;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 0.5px;
    }
    .med-generic {
      font-size: ${layoutMode === 'dual' ? '6.5px' : '8px'};
      font-style: italic;
      color: #444;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1;
    }
    .barcode-container {
      margin: 1px 0;
      display: flex;
      justify-content: center;
      align-items: center;
      height: ${layoutMode === 'dual' ? '9.5mm' : 'auto'};
      overflow: hidden;
    }
    .barcode-img {
      width: 100%;
      max-width: ${layoutMode === 'dual' ? '35mm' : '145px'};
      height: ${layoutMode === 'dual' ? '9.5mm' : 'auto'};
      object-fit: contain;
      image-rendering: pixelated;
      image-rendering: -webkit-optimize-contrast;
      display: block;
    }
    .footer-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: ${layoutMode === 'dual' ? '7.5px' : '8.5px'};
      font-weight: bold;
      border-top: 0.5px solid #000;
      padding-top: 1px;
      line-height: 1;
    }
    .price-tag {
      font-size: ${layoutMode === 'dual' ? '8px' : '9.5px'};
      font-weight: 900;
      color: #000;
    }
    .exp-tag {
      font-size: ${layoutMode === 'dual' ? '7px' : '8px'};
      color: #333;
    }
  </style>
</head>
<body>
  ${layoutMode === 'dual' ? '' : `<div class="batch-header">Batch Print: ${qty} Barcode Stickers for "${medName}"</div>`}
  ${contentHtml}
  <script>
    setTimeout(function() {
      window.focus();
      window.print();
    }, 300);
  </script>
</body>
</html>`;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();

    try {
      printWin.onafterprint = () => {
        try { printWin.close(); } catch(e) {}
      };
    } catch(e) {}

    return { success: true, method: 'browser' };
  } catch(err) {
    console.error('Barcode label print error:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Direct Hardware TCP/IP / Windows USB Thermal Printing for Customer Dues & Payment Statement
 * (with high-resolution browser fallback)
 */
export const printThermalCustomerDuesStatement = async ({
  customer = {},
  sales = [],
  hospitalName = '',
  hospitalAddress = '',
  hospitalPhone = '',
  forceBrowserPrint = false
} = {}) => {
  try {
    const custName = customer.name || customer.customer_name || 'Valued Customer';
    const custPhone = customer.phone || customer.customer_phone || '';
    const custId = customer.id || customer.customer_id || '';

    const ledgerTotalBilled = sales.reduce((sum, s) => sum + (Number(s.netTotal) || 0), 0);
    const ledgerTotalPaid = sales.reduce((sum, s) => sum + (Number(s.paidAmount) || 0), 0);
    const ledgerOutstanding = sales.reduce((sum, s) => sum + Math.max(0, (Number(s.netTotal) || 0) - (Number(s.paidAmount) || 0)), 0);

    let hospName = hospitalName || '';
    let hospAddress = hospitalAddress || '';
    let hospPhone = hospitalPhone || '';

    if (!hospName || !hospAddress || !hospPhone) {
      try {
        const setRes = await api.get('/settings');
        if (setRes.data?.success && setRes.data.settings) {
          const s = setRes.data.settings;
          hospName = hospName || s.hospitalName;
          hospAddress = hospAddress || s.locationAddress || s.address;
          hospPhone = hospPhone || s.phone || s.contactPhone;
        }
      } catch (e) {
        console.warn('Could not load hospital settings:', e);
      }
    }

    hospName = hospName || 'CarePulse Hospital Pharmacy';
    hospAddress = hospAddress || 'Plot 14, Sector H-8/4, Islamabad, Pakistan';
    hospPhone = hospPhone || '+92 51 111 222 333';

    // 1. ATTEMPT DIRECT SILENT HARDWARE THERMAL PRINT
    if (!forceBrowserPrint) {
      try {
        const netRes = await dispatchWorkstationPrint('/print/customer-dues', {
          customerName: custName,
          customerPhone: custPhone,
          customerId: custId,
          totalBilled: ledgerTotalBilled,
          totalPaid: ledgerTotalPaid,
          totalPending: ledgerOutstanding,
          sales,
          hospitalName: hospName,
          hospitalAddress: hospAddress,
          hospitalPhone: hospPhone
        }, 'pharmacy');

        if (netRes?.success) {
          console.log('✓ Customer dues statement printed directly to thermal printer:', netRes.message);
          return { success: true, method: netRes.method || 'hardware', message: netRes.message };
        }
      } catch (hardwareErr) {
        console.info('Direct thermal printer unavailable, falling back to browser print:', hardwareErr?.response?.data?.message || hardwareErr.message);
      }
    }

    // 2. BROWSER THERMAL PRINT FALLBACK (80mm/58mm standard receipt)
    const printWin = window.open('', '_blank', 'width=420,height=600');
    if (!printWin) {
      alert('Pop-up blocked. Please allow pop-ups for thermal receipt printing.');
      return { success: false, error: 'POPUP_BLOCKED' };
    }

    const invoicesRows = sales.map(s => {
      const due = Math.max(0, (Number(s.netTotal) || 0) - (Number(s.paidAmount) || 0));
      const statusColor = s.status === 'PAID' ? '#166534' : due > 0 ? '#b91c1c' : '#854d0e';
      return `
        <tr>
          <td style="padding: 3px 0; border-bottom: 1px dashed #000; text-align: left;">
            <div><strong>${s.invoiceNo}</strong></div>
            <div style="font-size: 8.5px; color: #555;">${new Date(s.createdAt).toLocaleDateString('en-GB')}</div>
          </td>
          <td style="padding: 3px 0; border-bottom: 1px dashed #000; text-align: right;">Rs. ${Number(s.netTotal || 0).toFixed(0)}</td>
          <td style="padding: 3px 0; border-bottom: 1px dashed #000; text-align: right; color: #166534;">Rs. ${Number(s.paidAmount || 0).toFixed(0)}</td>
          <td style="padding: 3px 0; border-bottom: 1px dashed #000; text-align: right; font-weight: bold; color: ${statusColor};">
            Rs. ${Number(due).toFixed(0)}
          </td>
        </tr>
      `;
    }).join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Customer Dues Statement - ${custName}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: monospace;
      font-size: 11px;
      line-height: 1.35;
      padding: 12px 10px;
      width: 290px;
      margin: 0 auto;
      color: #000;
      background: #fff;
    }
    .header {
      text-align: center;
      border-bottom: 1px dashed #000;
      padding-bottom: 6px;
      margin-bottom: 6px;
    }
    .title {
      font-size: 13px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .sub-info {
      font-size: 9.5px;
      line-height: 1.25;
      margin-top: 1px;
    }
    .inv-tag {
      margin-top: 5px;
      font-weight: 900;
      font-size: 10.5px;
      letter-spacing: 0.3px;
      border: 1px solid #000;
      padding: 2px 4px;
      display: inline-block;
    }
    .info-block {
      margin: 8px 0;
      font-size: 10.5px;
      line-height: 1.4;
      border-bottom: 1px dashed #000;
      padding-bottom: 6px;
    }
    .summary-box {
      background: #f8fafc;
      border: 1.5px solid #000;
      padding: 6px 8px;
      margin: 8px 0;
      font-size: 11px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3px;
    }
    .summary-row.due {
      border-top: 1px solid #000;
      padding-top: 4px;
      margin-top: 4px;
      font-size: 12.5px;
      font-weight: 900;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
    }
    th {
      border-bottom: 1px solid #000;
      padding: 4px 0;
      text-transform: uppercase;
      font-size: 9.5px;
      font-weight: 900;
    }
    .footer-block {
      text-align: center;
      margin-top: 10px;
      font-size: 9.5px;
      border-top: 1px dashed #000;
      padding-top: 6px;
      line-height: 1.35;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">${hospName}</div>
    <div class="sub-info">${hospAddress}</div>
    <div class="sub-info">Ph: ${hospPhone}</div>
    <div class="inv-tag">CUSTOMER DUES & PAYMENT STATEMENT</div>
  </div>

  <div class="info-block">
    <div><strong>Customer:</strong> ${custName}</div>
    ${custPhone ? `<div><strong>Phone:</strong> ${custPhone}</div>` : ''}
    <div><strong>Date:</strong> ${new Date().toLocaleString('en-GB')}</div>
    <div><strong>Account Status:</strong> <span style="font-weight: 900;">${ledgerOutstanding > 0 ? 'ACTIVE DUES' : 'FULLY SETTLED'}</span></div>
  </div>

  <div class="summary-box">
    <div class="summary-row">
      <span>Total Lifetime Billed:</span>
      <span>Rs. ${Number(ledgerTotalBilled).toFixed(0)}</span>
    </div>
    <div class="summary-row">
      <span>Total Amount Paid:</span>
      <span style="font-weight: bold; color: #166534;">Rs. ${Number(ledgerTotalPaid).toFixed(0)}</span>
    </div>
    <div class="summary-row due">
      <span>TOTAL PENDING DUE:</span>
      <span style="color: ${ledgerOutstanding > 0 ? '#b91c1c' : '#166534'};">Rs. ${Number(ledgerOutstanding).toFixed(0)}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="text-align: left; width: 38%;">INVOICE</th>
        <th style="text-align: right; width: 20%;">BILLED</th>
        <th style="text-align: right; width: 20%;">PAID</th>
        <th style="text-align: right; width: 22%;">DUE</th>
      </tr>
    </thead>
    <tbody>
      ${invoicesRows || '<tr><td colspan="4" style="text-align:center;padding:6px 0;">No sales invoices on record</td></tr>'}
    </tbody>
  </table>

  <div class="footer-block">
    ${ledgerOutstanding > 0 ? '<strong>Notice:</strong> Kindly settle your pending dues of Rs. ' + Number(ledgerOutstanding).toFixed(0) + ' at the counter.<br/>' : 'All accounts are cleared. Thank you for your trust!<br/>'}
    Thank you for choosing ${hospName}!<br/>
    <span style="font-size: 8px; color: #666;">Computer Generated Statement Slip</span>
  </div>

  <script>
    setTimeout(function() {
      window.focus();
      window.print();
    }, 350);
  </script>
</body>
</html>`;

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
      try { printWin.print(); } catch(e) {}
    }, 400);

    return { success: true, method: 'browser' };
  } catch (err) {
    console.error('Print customer dues statement error:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Silent 80mm thermal printing of Patient Cash Refund Voucher via hidden iframe
 */
export function printRefundReceiptViaHiddenIframe(slip, options = {}) {
  return new Promise((resolve) => {
    try {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        return resolve({ success: false, error: 'NO_WINDOW' });
      }

      const existingIframe = document.getElementById('silent-refund-print-frame');
      if (existingIframe) {
        existingIframe.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'silent-refund-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const hospName = options.hospitalName || 'CarePulse Hospital';
      const hospAddr = options.hospitalAddress || '';
      const hospPhone = options.hospitalPhone || '';

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Refund Slip - ${slip.receiptNo || 'REFUND'}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Courier New", monospace;
      width: 78mm;
      max-width: 78mm;
      margin: 0 auto;
      padding: 10px 12px;
      font-size: 11px;
      line-height: 1.35;
      color: #000;
      background: #fff;
    }
    .text-center { text-align: center; }
    .bold { font-weight: bold; }
    .header { border-bottom: 2px dashed #000; padding-bottom: 6px; margin-bottom: 6px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 11px; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .double-divider { border-top: 2px solid #000; border-bottom: 1px solid #000; height: 3px; margin: 6px 0; }
    .refund-box {
      background: #f1f1f1;
      padding: 6px;
      border: 2px solid #000;
      margin: 6px 0;
      text-align: center;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header text-center">
    <h2 style="margin: 0 0 2px 0; font-size: 15px; font-weight: 900; letter-spacing: 0.5px;">${hospName}</h2>
    ${hospAddr ? `<div style="font-size: 9.5px;">${hospAddr}</div>` : ''}
    ${hospPhone ? `<div style="font-size: 9.5px;">Ph: ${hospPhone}</div>` : ''}
    <div style="font-size: 11.5px; font-weight: 900; margin-top: 4px; text-transform: uppercase;">
      *** OFFICIAL PATIENT REFUND VOUCHER ***
    </div>
    <div style="font-size: 9.5px; font-weight: bold;">FRONT DESK CASH DISBURSEMENT</div>
  </div>

  <div class="row">
    <span>Voucher No:</span>
    <span class="bold">${slip.receiptNo || 'EXP-REF'}</span>
  </div>
  <div class="row">
    <span>Date & Time:</span>
    <span>${new Date(slip.date || Date.now()).toLocaleDateString('en-GB')} ${new Date(slip.date || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
  </div>
  <div class="row">
    <span>Patient Name:</span>
    <span class="bold">${slip.patientName}</span>
  </div>
  <div class="row">
    <span>MRN:</span>
    <span class="bold">${slip.mrn || 'WALK-IN'}</span>
  </div>
  ${slip.phone && slip.phone !== 'N/A' ? `<div class="row"><span>Phone:</span><span>${slip.phone}</span></div>` : ''}

  <div class="divider"></div>

  <div style="font-size: 10.5px; margin-bottom: 4px;">
    <span class="bold">REFUNDED ITEM / SERVICE:</span>
    <div>${slip.itemDescription || 'Patient Cash Consultation / Order Refund'}</div>
  </div>

  <div style="font-size: 10.5px; margin-bottom: 4px;">
    <span class="bold">REASON FOR REFUND:</span>
    <div style="font-style: italic;">${slip.reason || 'Patient waiting too long / Doctor delayed'}</div>
  </div>

  <div class="refund-box">
    <div style="font-size: 10px; font-weight: bold;">TOTAL CASH REFUNDED</div>
    <div style="font-size: 17px; font-weight: 900;">Rs. ${Number(slip.amount || 0).toLocaleString()}</div>
    <div style="font-size: 9.5px;">(Deducted from Shift Net Cash)</div>
  </div>

  <div class="row">
    <span>Refund Method:</span>
    <span class="bold">${slip.paymentMethod || 'CASH'}</span>
  </div>
  <div class="row">
    <span>Disbursed By:</span>
    <span>Front Desk Cashier</span>
  </div>

  <div class="double-divider"></div>

  <div style="margin-top: 20px; display: flex; justify-content: space-between; font-size: 9.5px;">
    <div>Patient Signature<br/>________________</div>
    <div style="text-align: right;">Cashier Signature<br/>________________</div>
  </div>

  <div style="font-size: 8.5px; text-align: center; margin-top: 12px; color: #444;">
    Computer generated verified refund voucher.<br/>
    Amount immediately deducted from shift net cash.
  </div>
</body>
</html>`;

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!doc) {
        return resolve({ success: false, error: 'NO_IFRAME_DOC' });
      }

      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            try { iframe.remove(); } catch (e) {}
          }, 3000);
          resolve({ success: true, method: 'iframe' });
        } catch (e) {
          console.warn('Iframe print error:', e);
          resolve({ success: false, error: e.message });
        }
      }, 300);
    } catch (err) {
      console.error('Silent refund print iframe error:', err);
      resolve({ success: false, error: err.message });
    }
  });
}

/**
 * Direct silent hardware thermal print for Patient Cash Refund Voucher
 * 1. Dispatches directly to hardware thermal printer (USB or TCP/IP port 9100)
 * 2. If hardware printer unavailable, falls back seamlessly to silent iframe printing
 */
export async function printThermalRefundReceipt(refundData, options = {}) {
  if (!refundData) return { success: false, error: 'NO_DATA' };

  let hospName = options.hospitalName || '';
  let hospAddr = options.hospitalAddress || '';
  let hospPhone = options.hospitalPhone || '';

  if (!hospName || !hospAddr || !hospPhone) {
    try {
      const setRes = await api.get('/settings');
      if (setRes.data?.success && setRes.data.settings) {
        const s = setRes.data.settings;
        hospName = hospName || s.hospitalName || 'CarePulse Hospital';
        hospAddr = hospAddr || s.locationAddress || s.address || '';
        hospPhone = hospPhone || s.phone || s.contactPhone || '';
      }
    } catch (e) {}
  }

  // 1. ATTEMPT HARDWARE THERMAL PRINT (LOCAL USB, WEBUSB, OR SERVER SPOOLER)
  if (!options.forceBrowserPrint) {
    try {
      const netRes = await dispatchWorkstationPrint('/print/refund-receipt', {
        receiptNo: refundData.receiptNo,
        refCode: refundData.refCode,
        patientName: refundData.patientName,
        mrn: refundData.mrn,
        phone: refundData.phone,
        amount: refundData.amount,
        reason: refundData.reason,
        itemDescription: refundData.itemDescription,
        paymentMethod: refundData.paymentMethod || 'CASH',
        date: refundData.date,
        hospitalName: hospName,
        hospitalAddress: hospAddr,
        hospitalPhone: hospPhone,
        printerIp: options.printerIp
      }, 'frontdesk');

      if (netRes?.success) {
        console.log(`✓ Refund voucher ${refundData.receiptNo} printed silently via thermal printer:`, netRes.message);
        return { success: true, method: netRes.method || 'hardware', message: netRes.message };
      }
    } catch (netErr) {
      console.info('Hardware thermal printer offline or busy, falling back to silent iframe browser print:', netErr?.response?.data?.message || netErr.message);
    }
  }

  // 2. SILENT BROWSER PRINT VIA HIDDEN IFRAME (NO POPUP WINDOW CREATED)
  return await printRefundReceiptViaHiddenIframe(refundData, {
    hospitalName: hospName,
    hospitalAddress: hospAddr,
    hospitalPhone: hospPhone
  });
}

export default {
  printThermalPatientMasterReceipt,
  printThermalTokenSlip,
  printThermalPharmacyReceipt,
  printThermalServiceReceipt,
  printThermalLabReceipt,
  printThermalXrayReceipt,
  printThermalBarcodeLabel,
  printThermalCustomerDuesStatement,
  printThermalRefundReceipt,
  printRefundReceiptViaHiddenIframe
};
