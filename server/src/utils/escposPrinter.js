//escposPrinter.js
const net = require('net');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Send raw binary buffer to a network thermal printer over TCP/IP (Port 9100)
 * @param {string} printerIp - e.g. "192.168.1.200"
 * @param {Buffer} buffer - ESC/POS command buffer
 * @param {number} port - default 9100
 * @param {number} timeoutMs - default 3500ms
 */
function sendToNetworkPrinter(printerIp, buffer, port = 9100, timeoutMs = 3500) {
  return new Promise((resolve, reject) => {
    if (!printerIp) {
      return reject(new Error('No printer IP address configured.'));
    }

    const client = new net.Socket();
    let isSettled = false;

    client.setTimeout(timeoutMs);

    client.connect(port, printerIp, () => {
      client.write(buffer, () => {
        // Small delay before closing to ensure printer buffer flushes
        setTimeout(() => {
          client.end();
          if (!isSettled) {
            isSettled = true;
            resolve({
              success: true,
              message: `Printed successfully to ${printerIp}:${port}`
            });
          }
        }, 150);
      });
    });

    client.on('timeout', () => {
      client.destroy();
      if (!isSettled) {
        isSettled = true;
        reject(new Error(`Printer at ${printerIp}:${port} timed out. Check network cable and power.`));
      }
    });

    client.on('error', (err) => {
      client.destroy();
      if (!isSettled) {
        isSettled = true;
        reject(new Error(`Failed to connect to printer at ${printerIp}:${port}: ${err.message}`));
      }
    });
  });
}

/**
 * Quick connection check to verify if printer is online
 */
function testPrinterConnection(printerIp, port = 9100, timeoutMs = 2000) {
  return new Promise((resolve) => {
    if (!printerIp) {
      return resolve({ online: false, message: 'Printer IP address not set.' });
    }

    const client = new net.Socket();
    let isSettled = false;

    client.setTimeout(timeoutMs);

    client.connect(port, printerIp, () => {
      client.destroy();
      if (!isSettled) {
        isSettled = true;
        resolve({ online: true, message: `Thermal printer at ${printerIp}:${port} is ONLINE and reachable.` });
      }
    });

    client.on('timeout', () => {
      client.destroy();
      if (!isSettled) {
        isSettled = true;
        resolve({ online: false, message: `Connection timed out to ${printerIp}:${port}.` });
      }
    });

    client.on('error', (err) => {
      client.destroy();
      if (!isSettled) {
        isSettled = true;
        resolve({ online: false, message: `Cannot reach ${printerIp}:${port}: ${err.message}` });
      }
    });
  });
}

/**
 * List all installed Windows printers using PowerShell CimInstance
 */
function getWindowsPrinters() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      return resolve([]);
    }
    const cmd = `powershell -WindowStyle Hidden -NonInteractive -NoProfile -Command "Get-CimInstance Win32_Printer | Select-Object Name, Default, PortName, WorkOffline | ConvertTo-Json"`;
    exec(cmd, { encoding: 'utf8', timeout: 6000, windowsHide: true }, (err, stdout) => {
      if (err || !stdout) {
        return resolve([]);
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        const list = Array.isArray(parsed) ? parsed : [parsed];
        resolve(list.map(p => ({
          name: p.Name,
          isDefault: !!p.Default,
          port: p.PortName,
          isOffline: !!p.WorkOffline
        })));
      } catch (e) {
        resolve([]);
      }
    });
  });
}

/**
 * Send raw binary ESC/POS buffer directly to a Windows USB / Spooler printer
 */
function sendToWindowsUsbPrinter(printerName, buffer) {
  return new Promise((resolve, reject) => {
    if (!printerName) {
      return reject(new Error('No Windows printer name provided.'));
    }
    const tempFile = path.join(os.tmpdir(), `hms_usb_${Date.now()}_${Math.random().toString(36).slice(2)}.bin`);
    fs.writeFile(tempFile, buffer, (writeErr) => {
      if (writeErr) return reject(writeErr);

      const psScript = path.join(__dirname, 'printToWindowsUsb.ps1');
      const cmd = `powershell -WindowStyle Hidden -NonInteractive -NoProfile -ExecutionPolicy Bypass -File "${psScript}" -PrinterName "${printerName}" -FilePath "${tempFile}"`;
      exec(cmd, { encoding: 'utf8', timeout: 10000, windowsHide: true }, (execErr, stdout, stderr) => {
        fs.unlink(tempFile, () => { });

        if (execErr || stdout.includes('FAILED')) {
          return reject(new Error(stdout.trim() || stderr || execErr?.message || 'Print execution failed'));
        }
        resolve({
          success: true,
          message: `Printed successfully to USB printer "${printerName}"`
        });
      });
    });
  });
}

/**
 * Quick Test Slip for USB / Hardware Verification
 */
function buildTestTicketEscPos(hospitalName = 'CarePulse Hospital', printerLabel = 'BlackCopper 80mm Series') {
  let out = '';
  out += `${ESC}@`; // init
  out += `${ESC}a\x01`; // center
  out += `${ESC}E\x01`; // bold
  out += `${hospitalName.toUpperCase()}\n`;
  out += `${ESC}E\x00`; // bold off
  out += `THERMAL PRINTER HARDWARE TEST\n`;
  out += `------------------------------------------\n`;
  out += `${ESC}a\x00`; // left
  out += `Printer:   ${printerLabel}\n`;
  out += `Port:      USB / Direct Spooler\n`;
  out += `Timestamp: ${new Date().toLocaleString()}\n`;
  out += `Status:    READY & ONLINE (100%)\n`;
  out += `------------------------------------------\n`;
  out += `${ESC}a\x01`; // center
  out += `${ESC}E\x01`;
  out += `HARDWARE CONNECTION SUCCESSFUL!\n`;
  out += `${ESC}E\x00`;
  out += `Silent 1-click receipt printing is active.\n\n\n`;
  out += `${GS}V\x41\x10`; // cut
  return Buffer.from(out, 'latin1');
}

// --------------------------------------------------------------------------
// ESC/POS FORMATTERS (Standard 80mm roll = 42-48 columns)
// --------------------------------------------------------------------------

const ESC = '\x1B';
const GS = '\x1D';

// CP437 Solid Box Drawing Characters (continuous unbroken borders on thermal paper)
const H_LINE = Buffer.from([0xC4]).toString('latin1');    // '─' solid horizontal
const V_LINE = Buffer.from([0xB3]).toString('latin1');    // '│' solid vertical
const CORNER_TL = Buffer.from([0xDA]).toString('latin1'); // '┌'
const CORNER_TR = Buffer.from([0xBF]).toString('latin1'); // '┐'
const CORNER_BL = Buffer.from([0xC0]).toString('latin1'); // '└'
const CORNER_BR = Buffer.from([0xD9]).toString('latin1'); // '┘'
const T_LEFT = Buffer.from([0xC3]).toString('latin1');    // '├'
const T_RIGHT = Buffer.from([0xB4]).toString('latin1');   // '┤'
const CROSS = Buffer.from([0xC5]).toString('latin1');     // '┼'
const T_DOWN = Buffer.from([0xC2]).toString('latin1');    // '┬'
const T_UP = Buffer.from([0xC1]).toString('latin1');      // '┴'

// Table formatting helpers for 80mm thermal ESC/POS (46 columns wide)
function boxBorder(len = 44, type = 'middle') {
  if (type === 'top') {
    return CORNER_TL + H_LINE.repeat(len) + CORNER_TR + '\n';
  } else if (type === 'bottom') {
    return CORNER_BL + H_LINE.repeat(len) + CORNER_BR + '\n';
  } else {
    return T_LEFT + H_LINE.repeat(len) + T_RIGHT + '\n';
  }
}

function boxDivider3Col(w1 = 26, w2 = 5, w3 = 11, type = 'middle') {
  if (type === 'top') {
    return CORNER_TL + H_LINE.repeat(w1) + T_DOWN + H_LINE.repeat(w2) + T_DOWN + H_LINE.repeat(w3) + CORNER_TR + '\n';
  } else if (type === 'bottom') {
    return CORNER_BL + H_LINE.repeat(w1) + T_UP + H_LINE.repeat(w2) + T_UP + H_LINE.repeat(w3) + CORNER_BR + '\n';
  } else {
    return T_LEFT + H_LINE.repeat(w1) + CROSS + H_LINE.repeat(w2) + CROSS + H_LINE.repeat(w3) + T_RIGHT + '\n';
  }
}

function boxText(text, len = 44, align = 'left') {
  const s = String(text || '').substring(0, len);
  if (align === 'center') {
    const leftPad = Math.max(0, Math.floor((len - s.length) / 2));
    const rightPad = Math.max(0, len - s.length - leftPad);
    return V_LINE + ' '.repeat(leftPad) + s + ' '.repeat(rightPad) + V_LINE + '\n';
  } else if (align === 'right') {
    return V_LINE + s.padStart(len, ' ') + V_LINE + '\n';
  } else {
    return V_LINE + ' ' + s.padEnd(len - 1, ' ') + V_LINE + '\n';
  }
}

function boxTwoCol(left, right, col1 = 23, col2 = 20) {
  const l = (' ' + String(left || '')).substring(0, col1).padEnd(col1, ' ');
  const r = (' ' + String(right || '')).substring(0, col2).padEnd(col2, ' ');
  return V_LINE + l + V_LINE + r + V_LINE + '\n';
}

function boxThreeCol(c1Text, c2Text, c3Text, w1 = 26, w2 = 5, w3 = 11) {
  const c1 = (' ' + String(c1Text || '')).substring(0, w1).padEnd(w1, ' ');
  const c2 = String(c2Text || '');
  const c2Pad = Math.max(0, Math.floor((w2 - c2.length) / 2));
  const c2P = (' '.repeat(c2Pad) + c2).padEnd(w2, ' ');
  const c3 = (String(c3Text || '') + ' ').substring(0, w3).padStart(w3, ' ');
  return V_LINE + c1 + V_LINE + c2P + V_LINE + c3 + V_LINE + '\n';
}

function boxTotalsRow(label, amt, w1 = 32, w2 = 11) {
  const l = (' ' + String(label || '')).substring(0, w1).padEnd(w1, ' ');
  const a = (String(amt || '') + ' ').substring(0, w2).padStart(w2, ' ');
  return V_LINE + l + V_LINE + a + V_LINE + '\n';
}

function boxDividerTotals(w1 = 32, w2 = 11) {
  return T_LEFT + H_LINE.repeat(w1) + CROSS + H_LINE.repeat(w2) + T_RIGHT + '\n';
}

/**
 * Builds 80mm thermal ESC/POS bytes for OPD Consultation Token
 */
function buildTokenEscPos({
  hospitalName = 'Shifa Hospital Timergara',
  hospitalAddress = '',
  hospitalPhone = '',
  tokenNo = '1',
  patientName = 'WALK-IN PATIENT',
  mrn = 'N/A',
  doctorName = 'Duty Medical Officer',
  department = 'OPD General',
  fee = 500,
  paidAmount = null,
  paymentStatus = '',
  dateStr = ''
}) {
  let out = '';

  const numericFee = Number(fee) || 0;
  const numPaid = paidAmount !== null && paidAmount !== undefined ? Number(paidAmount) : null;
  const rawStatus = (paymentStatus || '').toString().toUpperCase().trim();

  let displayStatus = 'PAID';
  if (rawStatus === 'UNPAID' || rawStatus === 'PENDING' || rawStatus === 'DUE') {
    displayStatus = 'PENDING';
  } else if (rawStatus === 'PARTIAL') {
    displayStatus = 'PARTIAL';
  } else if (rawStatus === 'PAID') {
    displayStatus = 'PAID';
  } else if (numPaid !== null && numPaid >= numericFee && numericFee > 0) {
    displayStatus = 'PAID';
  } else if (numPaid !== null && numPaid > 0) {
    displayStatus = 'PARTIAL';
  } else if (numPaid === 0) {
    displayStatus = 'PENDING';
  }

  // Initialize & select CP437 table for solid box drawing
  out += `${ESC}@`;
  out += `${ESC}t\x00`; // Select Character Code Table 0 (CP437)
  out += `${ESC}a\x01`; // Align Center on paper roll
  out += `${GS}!\x00`; // Normal size

  // Header Box with Solid Borders
  out += boxBorder(44, 'top');
  out += `${ESC}E\x01`; // Only Bold ON (normal size)
  out += boxText(`[+] ${hospitalName.toUpperCase()}`, 44, 'center');
  out += `${ESC}E\x00`; // Bold OFF
  if (hospitalAddress) out += boxText(hospitalAddress, 44, 'center');
  if (hospitalPhone) out += boxText(`Ph: ${hospitalPhone}`, 44, 'center');
  out += boxBorder(44, 'middle');
  out += `${ESC}E\x01`; // Bold ON
  out += boxText('OPD CONSULTATION TOKEN', 44, 'center');
  out += `${ESC}E\x00`; // Bold OFF
  out += boxBorder(44, 'middle');

  // Token Number Box
  out += boxText('TOKEN NUMBER', 44, 'center');
  out += `${ESC}E\x01`;
  out += boxText(`#${tokenNo}`, 44, 'center');
  out += boxText(department.toUpperCase(), 44, 'center');
  out += `${ESC}E\x00`;
  out += boxBorder(44, 'middle');

  // Patient and Doctor Details
  out += boxTwoCol(`Patient: ${patientName.substring(0, 14)}`, `MRN: ${mrn}`, 23, 20);
  out += boxTwoCol(`Doctor:  ${doctorName.substring(0, 14)}`, `Fee: Rs.${numericFee.toFixed(0)}`, 23, 20);
  out += boxTwoCol(`Date:    ${(dateStr || new Date().toLocaleDateString('en-GB')).substring(0, 14)}`, `Status: ${displayStatus}`, 23, 20);
  out += boxBorder(44, 'middle');

  // Footer
  out += boxText('Please wait for your token number.', 44, 'center');
  out += boxText('Wish you a speedy recovery!', 44, 'center');
  out += boxBorder(44, 'bottom');
  out += '\n\n\n';

  // Paper Cut (GS V A 16)
  out += `${GS}V\x41\x10`;

  return Buffer.from(out, 'latin1');
}

/**
 * Builds 80mm thermal ESC/POS bytes for Master Patient Billing Receipt
 * Strict tabular format with solid borders matching browser preview.
 */
function buildMasterReceiptEscPos({
  hospitalName = 'Shiffa Hospital Samar Bagh',
  hospitalAddress = '',
  hospitalPhone = '',
  taxNo = '',
  receiptNo = '',
  patientName = 'PATIENT',
  mrn = 'N/A',
  phone = '',
  gender = '',
  age = '',
  dateStr = '',
  cashierName = 'Front Desk Reception',
  categories = [],
  items = [],
  subtotal = 0,
  discount = 0,
  departmentDiscounts = 0,
  masterDiscount = 0,
  netTotal = 0,
  paidAmount = 0,
  balanceDue = 0,
  totalRefunds = 0,
  paymentMethod = 'CASH'
}) {
  let out = '';

  // Auto-detect totalRefunds if not passed explicitly
  if (!totalRefunds && Array.isArray(categories)) {
    categories.forEach(c => {
      (c.items || []).forEach(i => {
        const p = Number(i.price || i.total || 0);
        if (p < 0) totalRefunds += Math.abs(p);
      });
    });
  }

  // Initialize printer & select CP437 table for solid borders
  out += `${ESC}@`;
  out += `${ESC}t\x00`; // Select Character Code Table 0 (CP437)
  out += `${ESC}a\x01`; // Align Center on paper roll
  out += `${GS}!\x00`; // Normal size

  // 1. Hospital Header Box
  out += boxBorder(44, 'top');
  out += `${ESC}E\x01`; // Only Bold ON (normal size)
  out += boxText(`[+] ${hospitalName.toUpperCase()} [+]`, 44, 'center');
  out += `${ESC}E\x00`; // Bold OFF
  if (hospitalAddress) {
    out += boxText(hospitalAddress, 44, 'center');
  }
  if (hospitalPhone) {
    out += boxText(`Ph: ${hospitalPhone}`, 44, 'center');
  }
  out += boxBorder(44, 'middle');
  out += `${ESC}E\x01`; // Bold ON
  out += boxText('PATIENT MASTER BILLING RECEIPT', 44, 'center');
  out += `${ESC}E\x00`; // Bold OFF
  out += boxBorder(44, 'middle');

  // 2. Patient Information
  const now = new Date();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
  const formattedDate = dateStr || `${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  out += boxTwoCol(`Patient: ${patientName.toUpperCase()}`, `MRN: ${mrn}`, 23, 20);
  out += boxTwoCol(`Phone: ${phone || 'N/A'}`, `Date: ${formattedDate}`, 23, 20);

  // 3. Table Column Headers with solid border
  out += boxDivider3Col(26, 5, 11, 'middle');
  out += `${ESC}E\x01`; // Bold ON
  out += boxThreeCol('ITEM / DESCRIPTION', 'QTY', 'PRICE', 26, 5, 11);
  out += `${ESC}E\x00`; // Bold OFF
  out += boxDivider3Col(26, 5, 11, 'middle');

  // 4. Categories & Item Breakdown
  if (Array.isArray(categories) && categories.length > 0) {
    categories.forEach((cat) => {
      out += `${ESC}E\x01`; // Bold ON
      out += boxText(cat.title, 44, 'left');
      out += `${ESC}E\x00`; // Bold OFF
      out += boxDivider3Col(26, 5, 11, 'middle');

      if (Array.isArray(cat.items)) {
        cat.items.forEach((item) => {
          const name = item.name || item.title || 'Item';
          const rawQty = item.qty !== undefined && item.qty !== null ? item.qty : (item.quantity !== undefined && item.quantity !== null ? item.quantity : 1);
          const numQty = parseInt(rawQty, 10);
          const qty = String(isNaN(numQty) || numQty <= 0 ? 1 : numQty);
          const rawPrice = Number(item.price || item.total || 0);
          const price = rawPrice < 0 ? `-Rs.${Math.abs(rawPrice).toFixed(0)}` : `Rs.${rawPrice.toFixed(0)}`;

          if (name.length <= 24) {
            out += boxThreeCol(name, qty, price, 26, 5, 11);
          } else {
            out += boxThreeCol(name.substring(0, 24), qty, price, 26, 5, 11);
            out += boxThreeCol(name.substring(24, 48), '', '', 26, 5, 11);
          }
        });
      }
      out += boxDivider3Col(26, 5, 11, 'middle');
    });
  } else if (Array.isArray(items) && items.length > 0) {
    const grouped = {};
    items.forEach((item) => {
      const cat = item.category || '1. GENERAL HOSPITAL SERVICES';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });

    Object.keys(grouped).forEach((catTitle) => {
      out += `${ESC}E\x01`; // Bold ON
      out += boxText(catTitle, 44, 'left');
      out += `${ESC}E\x00`; // Bold OFF
      out += boxDivider3Col(26, 5, 11, 'middle');

      grouped[catTitle].forEach((item) => {
        const name = item.name || item.title || 'Item';
        const rawQty = item.quantity !== undefined && item.quantity !== null ? item.quantity : (item.qty !== undefined && item.qty !== null ? item.qty : 1);
        const numQty = parseInt(rawQty, 10);
        const qty = String(isNaN(numQty) || numQty <= 0 ? 1 : numQty);
        const rawPrice = Number(item.total || item.amount || item.price || 0);
        const price = rawPrice < 0 ? `-Rs.${Math.abs(rawPrice).toFixed(0)}` : `Rs.${rawPrice.toFixed(0)}`;
        if (name.length <= 24) {
          out += boxThreeCol(name, qty, price, 26, 5, 11);
        } else {
          out += boxThreeCol(name.substring(0, 24), qty, price, 26, 5, 11);
          out += boxThreeCol(name.substring(24, 48), '', '', 26, 5, 11);
        }
      });
      out += boxDivider3Col(26, 5, 11, 'middle');
    });
  } else {
    out += `${ESC}E\x01`;
    out += boxText('1. GENERAL HOSPITAL SERVICES', 44, 'left');
    out += `${ESC}E\x00`;
    out += boxDivider3Col(26, 5, 11, 'middle');
    out += boxThreeCol('Consolidated Services', '1', `Rs.${Number(netTotal || subtotal).toFixed(0)}`, 26, 5, 11);
    out += boxDivider3Col(26, 5, 11, 'middle');
  }

  // 5. Financial Totals
  out += `${ESC}E\x01`; // Bold ON
  out += boxTotalsRow('GROSS BILLED:', `Rs.${Number(subtotal || netTotal).toFixed(0)}`, 32, 11);
  if (Number(departmentDiscounts) > 0 && Number(masterDiscount) > 0) {
    out += boxTotalsRow('DEPT DISCOUNTS:', `-Rs.${Number(departmentDiscounts).toFixed(0)}`, 32, 11);
    out += boxTotalsRow('MASTER CONCESSION:', `-Rs.${Number(masterDiscount).toFixed(0)}`, 32, 11);
    out += boxTotalsRow('TOTAL CONCESSION:', `-Rs.${Number(discount).toFixed(0)}`, 32, 11);
  } else if (Number(departmentDiscounts) > 0) {
    out += boxTotalsRow('DEPT DISCOUNTS:', `-Rs.${Number(departmentDiscounts).toFixed(0)}`, 32, 11);
  } else if (Number(masterDiscount) > 0) {
    out += boxTotalsRow('MASTER CONCESSION:', `-Rs.${Number(masterDiscount).toFixed(0)}`, 32, 11);
  } else if (Number(discount) > 0) {
    out += boxTotalsRow('DISCOUNT CONCESSION:', `-Rs.${Number(discount).toFixed(0)}`, 32, 11);
  }
  out += boxTotalsRow('TOTAL PAID:', `Rs.${Number(paidAmount).toFixed(0)}`, 32, 11);
  if (Number(totalRefunds) > 0) {
    out += boxTotalsRow('LESS REFUNDS ISSUED:', `-Rs.${Number(totalRefunds).toFixed(0)}`, 32, 11);
    const netPaidCash = Math.max(0, Number(paidAmount) - Number(totalRefunds));
    out += boxTotalsRow('NET CASH COLLECTED:', `Rs.${Number(netPaidCash).toFixed(0)}`, 32, 11);
  }
  out += boxTotalsRow('OUTSTANDING DUE:', `Rs.${Number(balanceDue).toFixed(0)}`, 32, 11);
  out += `${ESC}E\x00`; // Bold OFF
  out += boxBorder(44, 'middle');

  // 6. Footer (Centered)
  out += boxText('Thank you for choosing', 44, 'center');
  out += boxText(`${hospitalName}!`, 44, 'center');
  out += boxText('Wish you good health.', 44, 'center');
  out += boxBorder(44, 'bottom');
  out += '\n\n\n';

  // Paper Cut
  out += `${GS}V\x41\x10`;

  return Buffer.from(out, 'latin1');
}

/**
 * Builds 80mm thermal ESC/POS bytes for Pharmacy POS Sales Receipt
 * Tabular format with solid CP437 box borders matching the on-screen receipt.
 */
function buildPharmacyReceiptEscPos({
  hospitalName = 'Metro Super Mart & Grocers',
  hospitalAddress = '',
  hospitalPhone = '',
  invoiceNo = 'MART-INV',
  customerName = 'Walk-In Customer',
  mrn = '',
  customerPhone = '',
  dateStr = '',
  status = 'PAID',
  items = [],
  subtotal = 0,
  discount = 0,
  netTotal = 0,
  totalRefund = 0,
  adjustedNetTotal = 0,
  paidAmount = 0,
  balanceDue = 0,
  paymentMethod = 'CASH',
  paidAtCounter = 'POS'
}) {
  let out = '';

  // Initialize printer & select CP437 table for solid borders
  out += `${ESC}@`;
  out += `${ESC}t\x00`; // Select Character Code Table 0 (CP437)
  out += `${ESC}a\x01`; // Align Center on paper roll
  out += `${GS}!\x00`; // Normal size

  // 1. Hospital Header Box
  out += boxBorder(44, 'top');
  out += `${ESC}E\x01`; // Bold ON
  out += boxText(`[+] ${hospitalName.toUpperCase()} [+]`, 44, 'center');
  out += `${ESC}E\x00`; // Bold OFF
  if (hospitalAddress) {
    out += boxText(hospitalAddress, 44, 'center');
  }
  if (hospitalPhone) {
    out += boxText(`Ph: ${hospitalPhone}`, 44, 'center');
  }
  out += boxBorder(44, 'middle');
  out += `${ESC}E\x01`; // Bold ON
  out += boxText('SUPER MART POS INVOICE', 44, 'center');
  out += `${ESC}E\x00`; // Bold OFF
  out += boxBorder(44, 'middle');

  // 2. Invoice Details
  const now = new Date();
  const formattedDate = dateStr || now.toLocaleString('en-GB');

  out += boxTwoCol(`Inv: ${invoiceNo}`, `Date: ${formattedDate.substring(0, 14)}`, 23, 20);
  out += boxTwoCol(`Cust: ${(customerName || 'Walk-In').substring(0, 16)}`, `Phone: ${customerPhone || mrn || 'N/A'}`, 23, 20);
  out += boxTwoCol(`Status: ${status.toUpperCase()}`, `Counter: ${paidAtCounter || 'POS'}`, 23, 20);

  // 3. Table Column Headers with solid border
  out += boxDivider3Col(26, 5, 11, 'middle');
  out += `${ESC}E\x01`; // Bold ON
  out += boxThreeCol('ITEM / PRODUCT', 'QTY', 'TOTAL', 26, 5, 11);
  out += `${ESC}E\x00`; // Bold OFF
  out += boxDivider3Col(26, 5, 11, 'middle');

  // 4. Items List
  if (Array.isArray(items) && items.length > 0) {
    items.forEach((item) => {
      const name = item.productName || item.name || item.title || item.itemName || item.medicineName || 'Product';
      const retQty = item.returnedQuantity || 0;
      const activeQty = item.activeQuantity !== undefined ? item.activeQuantity : Math.max(0, (item.quantity || 1) - retQty);
      const qtyStr = String(retQty > 0 ? activeQty : (item.quantity || 1));
      const totVal = item.activeTotalPrice !== undefined ? item.activeTotalPrice : (item.totalPrice || item.total || ((item.unitPrice || 0) * (item.quantity || 1)) || 0);
      const priceStr = `Rs.${Number(totVal).toFixed(0)}`;

      if (name.length <= 24) {
        out += boxThreeCol(name, qtyStr, priceStr, 26, 5, 11);
      } else {
        out += boxThreeCol(name.substring(0, 24), qtyStr, priceStr, 26, 5, 11);
        out += boxThreeCol(name.substring(24, 48), '', '', 26, 5, 11);
      }

      if (retQty > 0) {
        out += boxThreeCol(` (Ret: ${retQty} qty)`, '', '', 26, 5, 11);
      }
    });
  } else {
    out += boxThreeCol('Mart Sale', '1', `Rs.${Number(netTotal || subtotal).toFixed(0)}`, 26, 5, 11);
  }

  out += boxBorder(44, 'middle');

  // 5. Financial Totals
  const effNet = adjustedNetTotal || Math.max(0, (netTotal || subtotal || 0) - (totalRefund || 0));
  const effDue = balanceDue !== undefined ? balanceDue : Math.max(0, effNet - (paidAmount || 0));

  out += `${ESC}E\x01`; // Bold ON
  out += boxTotalsRow('Subtotal:', `Rs.${Number(subtotal || netTotal || 0).toFixed(0)}`, 32, 11);
  if (Number(discount) > 0) {
    out += boxTotalsRow('Discount Concession:', `-Rs.${Number(discount).toFixed(0)}`, 32, 11);
  }
  out += boxTotalsRow('Billed Total:', `Rs.${Number(netTotal || 0).toFixed(0)}`, 32, 11);
  if (Number(totalRefund) > 0) {
    out += boxTotalsRow('Returned Refund:', `-Rs.${Number(totalRefund).toFixed(0)}`, 32, 11);
    out += boxTotalsRow('Adjusted Net Total:', `Rs.${Number(effNet).toFixed(0)}`, 32, 11);
  }
  out += boxTotalsRow(`Paid (${paymentMethod}):`, `Rs.${Number(paidAmount || 0).toFixed(0)}`, 32, 11);
  if (Number(effDue) > 0) {
    out += boxTotalsRow('Unpaid Balance:', `Rs.${Number(effDue).toFixed(0)}`, 32, 11);
  }
  out += `${ESC}E\x00`; // Bold OFF
  out += boxBorder(44, 'middle');

  if (Number(effDue) > 0) {
    out += boxText('Settlement: Pay at Front Desk Counter', 44, 'center');
    out += boxBorder(44, 'middle');
  }

  // 6. Footer
  out += boxText('Thank you for choosing', 44, 'center');
  out += boxText(`${hospitalName}!`, 44, 'center');
  out += boxText('Wish you good health.', 44, 'center');
  out += boxBorder(44, 'bottom');
  out += '\n\n\n';

  // Paper Cut
  out += `${GS}V\x41\x10`;

  return Buffer.from(out, 'latin1');
}

/**
 * Builds 80mm thermal ESC/POS bytes for Medical Services & Procedures Receipt
 */
function buildServiceReceiptEscPos({
  hospitalName = 'CarePulse Hospital',
  hospitalAddress = '',
  hospitalPhone = '',
  orderNo = 'SERV-INV',
  patientName = 'PATIENT',
  mrn = 'WALK-IN',
  refDoctor = 'Consultant Doctor',
  services = [],
  totalFee = 0,
  discountAmount = 0,
  netTotal = 0,
  paidAmount = 0,
  paymentStatus = 'PAID',
  paymentMethod = 'CASH',
  dateStr = ''
}) {
  let out = '';

  out += `${ESC}@`;
  out += `${ESC}t\x00`;
  out += `${ESC}a\x01`;
  out += `${GS}!\x00`;

  // 1. Header Box
  out += boxBorder(44, 'top');
  out += `${ESC}E\x01`;
  out += boxText(`[+] ${hospitalName.toUpperCase()} [+]`, 44, 'center');
  out += `${ESC}E\x00`;
  if (hospitalAddress) out += boxText(hospitalAddress, 44, 'center');
  if (hospitalPhone) out += boxText(`Ph: ${hospitalPhone}`, 44, 'center');
  out += boxBorder(44, 'middle');
  out += `${ESC}E\x01`;
  out += boxText('MEDICAL SERVICES & PROCEDURES RECEIPT', 44, 'center');
  out += `${ESC}E\x00`;
  out += boxBorder(44, 'middle');

  // 2. Patient & Order Meta
  const now = new Date();
  const formattedDate = dateStr || now.toLocaleString('en-GB');

  out += boxTwoCol(`Order: ${orderNo}`, `Date: ${formattedDate.substring(0, 14)}`, 23, 20);
  out += boxTwoCol(`Patient: ${patientName.substring(0, 14)}`, `MRN: ${mrn.substring(0, 14)}`, 23, 20);
  out += boxTwoCol(`Doctor: ${refDoctor.substring(0, 14)}`, `Status: ${paymentStatus}`, 23, 20);

  // 3. Table Headers
  out += boxDivider3Col(26, 5, 11, 'middle');
  out += `${ESC}E\x01`;
  out += boxThreeCol('SERVICE / PROCEDURE', 'QTY', 'FEE', 26, 5, 11);
  out += `${ESC}E\x00`;
  out += boxDivider3Col(26, 5, 11, 'middle');

  // 4. Services List
  if (Array.isArray(services) && services.length > 0) {
    services.forEach((s) => {
      const name = s.name || s.serviceName || 'Service';
      const feeStr = `Rs.${Number(s.fee || s.amount || 0).toFixed(0)}`;
      if (name.length <= 24) {
        out += boxThreeCol(name, '1', feeStr, 26, 5, 11);
      } else {
        out += boxThreeCol(name.substring(0, 24), '1', feeStr, 26, 5, 11);
        out += boxThreeCol(name.substring(24, 48), '', '', 26, 5, 11);
      }
    });
  } else {
    out += boxThreeCol('Clinical Procedure', '1', `Rs.${Number(netTotal || totalFee).toFixed(0)}`, 26, 5, 11);
  }

  out += boxBorder(44, 'middle');

  // 5. Totals
  out += `${ESC}E\x01`;
  out += boxTotalsRow('Total Service Fee:', `Rs.${Number(totalFee || netTotal).toFixed(0)}`, 32, 11);
  if (Number(discountAmount) > 0) {
    out += boxTotalsRow('Discount Applied:', `-Rs.${Number(discountAmount).toFixed(0)}`, 32, 11);
  }
  const net = netTotal !== undefined ? netTotal : Math.max(0, totalFee - discountAmount);
  out += boxTotalsRow('Net Payable:', `Rs.${Number(net).toFixed(0)}`, 32, 11);
  out += boxTotalsRow(`Paid (${paymentMethod}):`, `Rs.${Number(paidAmount || net).toFixed(0)}`, 32, 11);
  out += `${ESC}E\x00`;
  out += boxBorder(44, 'middle');

  // 6. Footer
  out += boxText('Thank you for choosing', 44, 'center');
  out += boxText(`${hospitalName}!`, 44, 'center');
  out += boxText('Wish you speedy recovery.', 44, 'center');
  out += boxBorder(44, 'bottom');
  out += '\n\n\n';

  out += `${GS}V\x41\x10`;
  return Buffer.from(out, 'latin1');
}

/**
 * Builds 80mm thermal ESC/POS bytes for Laboratory Test Order Receipt
 * Strict tabular layout with continuous CP437 solid borders (zero dotted/dashed lines)
 */
function buildLabReceiptEscPos({
  hospitalName = 'CarePulse Hospital',
  hospitalAddress = '',
  hospitalPhone = '',
  orderNo = 'LAB-INV',
  patientName = 'PATIENT',
  patientType = 'INTERNAL',
  isExternal = false,
  phone = '',
  mrn = 'WALK-IN',
  gender = '',
  age = '',
  refDoctor = 'Consultant',
  tests = [],
  totalFee = 0,
  discountAmount = 0,
  netTotal = 0,
  paidAmount = 0,
  balanceDue = 0,
  paymentStatus = 'PAID',
  paymentMethod = 'CASH',
  paidAtCounter = 'FRONTDESK',
  dateStr = ''
}) {
  let out = '';

  // Initialize printer & select CP437 table for solid box drawing
  out += `${ESC}@`;
  out += `${ESC}t\x00`; // Select CP437
  out += `${ESC}a\x01`; // Align center
  out += `${GS}!\x00`; // Normal font

  // 1. Hospital Header in Solid Box
  out += boxBorder(44, 'top');
  out += `${ESC}E\x01`;
  out += boxText(`[+] ${hospitalName.toUpperCase()} [+]`, 44, 'center');
  out += `${ESC}E\x00`;
  if (hospitalAddress) out += boxText(hospitalAddress, 44, 'center');
  if (hospitalPhone) out += boxText(`Ph: ${hospitalPhone}`, 44, 'center');
  out += boxBorder(44, 'middle');
  out += `${ESC}E\x01`;
  out += boxText('PATHOLOGY & DIAGNOSTICS INVOICE', 44, 'center');
  out += `${ESC}E\x00`;
  out += boxBorder(44, 'middle');

  // 2. Order & Patient Details with Solid Tabular Cells
  const now = new Date();
  const formattedDate = dateStr || now.toLocaleDateString('en-GB');

  out += boxTwoCol(`Order: ${orderNo}`, `Date: ${formattedDate}`, 23, 20);
  out += `${ESC}E\x01`;
  out += boxText(`Patient: ${patientName}`, 44, 'left');
  out += `${ESC}E\x00`;

  const isExt = isExternal || patientType === 'EXTERNAL' || mrn === 'WALK-IN';
  const typeTag = isExt ? 'WALK-IN (OUT)' : 'INPATIENT';
  const profileStr = (gender || age) ? `${gender || ''} ${age ? `(${age}Y)` : ''}`.trim() : 'Patient';
  const counterLabel = (paidAtCounter === 'LAB_COUNTER') ? 'LAB COUNTER' : (paidAtCounter || 'FRONTDESK');

  out += boxTwoCol(`Origin: ${typeTag}`, `Profile: ${profileStr}`, 23, 20);
  out += boxTwoCol(`MRN: ${mrn}`, phone && phone !== 'N/A' ? `Ph: ${phone}` : `Counter: ${counterLabel}`, 23, 20);
  if (phone && phone !== 'N/A') {
    out += boxTwoCol(`Doctor: ${refDoctor.substring(0, 15)}`, `Counter: ${counterLabel}`, 23, 20);
  } else {
    out += boxText(`Doctor: ${refDoctor}`, 44, 'left');
  }

  // 3. Tabular Table Column Headers with Solid Borders
  out += boxDivider3Col(26, 5, 11, 'middle');
  out += `${ESC}E\x01`;
  out += boxThreeCol('PRESCRIBED TEST / PANEL', 'QTY', 'FEE', 26, 5, 11);
  out += `${ESC}E\x00`;
  out += boxDivider3Col(26, 5, 11, 'middle');

  // 4. Test Rows in Strict Tabular Grid
  if (Array.isArray(tests) && tests.length > 0) {
    tests.forEach((t) => {
      const name = t.name || t.testName || 'Diagnostic Test';
      const feeStr = `Rs.${Number(t.fee || t.price || 0).toFixed(0)}`;
      if (name.length <= 24) {
        out += boxThreeCol(name, '1', feeStr, 26, 5, 11);
      } else {
        out += boxThreeCol(name.substring(0, 24), '1', feeStr, 26, 5, 11);
        out += boxThreeCol(name.substring(24, 48), '', '', 26, 5, 11);
      }
    });
  } else {
    out += boxThreeCol('Diagnostic Pathology', '1', `Rs.${Number(netTotal || totalFee).toFixed(0)}`, 26, 5, 11);
  }

  out += boxDividerTotals(32, 11);

  // 5. Solid Totals Section
  const net = netTotal !== undefined ? netTotal : Math.max(0, totalFee - discountAmount);
  const due = balanceDue !== undefined ? balanceDue : Math.max(0, net - paidAmount);

  out += boxTotalsRow('Subtotal Tests Fee:', `Rs.${Number(totalFee || net).toFixed(0)}`, 32, 11);
  if (Number(discountAmount) > 0) {
    out += boxTotalsRow('Discount Concession:', `-Rs.${Number(discountAmount).toFixed(0)}`, 32, 11);
  }
  out += boxDividerTotals(32, 11);

  out += `${ESC}E\x01`;
  out += boxTotalsRow('NET DIAGNOSTIC BILL:', `Rs.${Number(net).toFixed(0)}`, 32, 11);
  out += boxTotalsRow(`PAID (${paymentMethod || 'CASH'}):`, `Rs.${Number(paidAmount).toFixed(0)}`, 32, 11);
  if (Number(due) > 0) {
    out += boxTotalsRow('PENDING BALANCE DUE:', `Rs.${Number(due).toFixed(0)}`, 32, 11);
  }
  const isPaidFull = Number(due) <= 0 || paymentStatus === 'PAID';
  out += boxTotalsRow('PAYMENT STATUS:', isPaidFull ? 'PAID IN FULL' : 'PENDING', 32, 11);
  out += `${ESC}E\x00`;

  out += boxBorder(44, 'middle');

  // 6. Solid Footer
  out += boxText('Please bring slip for report collection', 44, 'center');
  out += boxText('*** THANK YOU FOR VISITING ***', 44, 'center');
  out += boxText(`${hospitalName}!`, 44, 'center');
  out += boxBorder(44, 'bottom');
  out += '\n\n\n';

  out += `${GS}V\x41\x10`;
  return Buffer.from(out, 'latin1');
}

/**
 * Builds 80mm thermal ESC/POS bytes for X-Ray / Radiology Scan Order Receipt
 * Strict tabular layout with continuous CP437 solid borders (zero dotted/dashed lines)
 */
function buildXrayReceiptEscPos({
  hospitalName = 'Shifa Hospital Timergara',
  hospitalAddress = '',
  hospitalPhone = '',
  orderNo = 'XR-INV',
  patientName = 'PATIENT',
  patientType = 'INTERNAL',
  isExternal = false,
  phone = '',
  mrn = 'WALK-IN',
  gender = '',
  age = '',
  referringDoctor = 'Hospital OPD Consultant',
  scanType = 'Chest X-Ray (PA & Lateral)',
  modality = 'Digital X-Ray',
  bodyPart = 'Chest / Thorax',
  priority = 'Routine',
  scans = [],
  fee = 0,
  discountAmount = 0,
  netTotal = 0,
  paidAmount = 0,
  balanceDue = 0,
  paymentStatus = 'PAID',
  paymentMethod = 'CASH',
  paidAtCounter = 'RADIOLOGY / FRONTDESK',
  dateStr = ''
}) {
  let out = '';

  // Initialize printer & select CP437 table for solid box drawing
  out += `${ESC}@`;
  out += `${ESC}t\x00`; // Select CP437
  out += `${ESC}a\x01`; // Align center
  out += `${GS}!\x00`; // Normal font

  // 1. Hospital Header in Solid Box
  out += boxBorder(44, 'top');
  out += `${ESC}E\x01`;
  out += boxText(`[+] ${hospitalName.toUpperCase()} [+]`, 44, 'center');
  out += `${ESC}E\x00`;
  if (hospitalAddress) out += boxText(hospitalAddress, 44, 'center');
  if (hospitalPhone) out += boxText(`Ph: ${hospitalPhone}`, 44, 'center');
  out += boxBorder(44, 'middle');
  out += `${ESC}E\x01`;
  out += boxText('RADIOLOGY & X-RAY RECEIPT', 44, 'center');
  out += `${ESC}E\x00`;
  out += boxBorder(44, 'middle');

  // 2. Order & Patient Details
  const now = new Date();
  const formattedDate = dateStr || now.toLocaleDateString('en-GB');

  out += boxTwoCol(`Order: ${orderNo}`, `Date: ${formattedDate}`, 23, 20);
  out += `${ESC}E\x01`;
  out += boxText(`Patient: ${patientName}`, 44, 'left');
  out += `${ESC}E\x00`;

  const isExt = isExternal || patientType === 'EXTERNAL' || mrn === 'WALK-IN';
  const typeTag = isExt ? 'WALK-IN (OUT)' : 'INPATIENT';
  const profileStr = (gender || age) ? `${gender || ''} ${age ? `(${age}Y)` : ''}`.trim() : 'Patient';
  const counterLabel = paidAtCounter || 'FRONTDESK';

  out += boxTwoCol(`Origin: ${typeTag}`, `Profile: ${profileStr}`, 23, 20);
  out += boxTwoCol(`MRN: ${mrn}`, phone && phone !== 'N/A' ? `Ph: ${phone}` : `Counter: ${counterLabel}`, 23, 20);
  if (referringDoctor) {
    out += boxText(`Doctor: ${referringDoctor}`, 44, 'left');
  }

  // 3. Tabular Table Column Headers with Solid Borders
  out += boxDivider3Col(26, 5, 11, 'middle');
  out += `${ESC}E\x01`;
  out += boxThreeCol('RADIOLOGY SCAN / EXAM', 'QTY', 'FEE', 26, 5, 11);
  out += `${ESC}E\x00`;
  out += boxDivider3Col(26, 5, 11, 'middle');

  // 4. Scan Rows
  const scanList = Array.isArray(scans) && scans.length > 0
    ? scans
    : [{ name: scanType, modality: modality || 'X-Ray', fee: fee || netTotal }];

  scanList.forEach((s) => {
    const name = s.name || s.scanType || scanType || 'Radiology Scan';
    const rawQty = s.quantity !== undefined && s.quantity !== null ? s.quantity : (s.qty !== undefined && s.qty !== null ? s.qty : 1);
    const numQty = parseInt(rawQty, 10);
    const qtyStr = String(isNaN(numQty) || numQty <= 0 ? 1 : numQty);
    const feeStr = `Rs.${Number(s.fee || s.price || fee || netTotal || 0).toFixed(0)}`;
    if (name.length <= 24) {
      out += boxThreeCol(name, qtyStr, feeStr, 26, 5, 11);
    } else {
      out += boxThreeCol(name.substring(0, 24), qtyStr, feeStr, 26, 5, 11);
      out += boxThreeCol(name.substring(24, 48), '', '', 26, 5, 11);
    }
    if (s.bodyPart || bodyPart) {
      out += boxText(`  Region: ${(s.bodyPart || bodyPart).substring(0, 32)}`, 44, 'left');
    }
  });

  out += boxDividerTotals(32, 11);

  // 5. Solid Totals Section
  const effTotal = fee || netTotal || 0;
  const net = netTotal !== undefined ? netTotal : Math.max(0, effTotal - discountAmount);
  const due = balanceDue !== undefined ? balanceDue : Math.max(0, net - paidAmount);

  out += boxTotalsRow('Subtotal Scan Fee:', `Rs.${Number(effTotal || net).toFixed(0)}`, 32, 11);
  if (Number(discountAmount) > 0) {
    out += boxTotalsRow('Discount Concession:', `-Rs.${Number(discountAmount).toFixed(0)}`, 32, 11);
  }
  out += boxDividerTotals(32, 11);

  out += `${ESC}E\x01`;
  out += boxTotalsRow('NET RADIOLOGY BILL:', `Rs.${Number(net).toFixed(0)}`, 32, 11);
  out += boxTotalsRow(`PAID (${paymentMethod || 'CASH'}):`, `Rs.${Number(paidAmount !== undefined ? paidAmount : net).toFixed(0)}`, 32, 11);
  if (Number(due) > 0) {
    out += boxTotalsRow('PENDING BALANCE DUE:', `Rs.${Number(due).toFixed(0)}`, 32, 11);
  }
  const isPaidFull = Number(due) <= 0 || paymentStatus === 'PAID';
  out += boxTotalsRow('PAYMENT STATUS:', isPaidFull ? 'PAID IN FULL' : 'PENDING', 32, 11);
  out += `${ESC}E\x00`;

  out += boxBorder(44, 'middle');

  // 6. Solid Footer
  out += boxText('Please bring this receipt to X-Ray Room', 44, 'center');
  out += boxText('*** THANK YOU FOR VISITING ***', 44, 'center');
  out += boxText(`${hospitalName}!`, 44, 'center');
  out += boxBorder(44, 'bottom');
  out += '\n\n\n';

  out += `${GS}V\x41\x10`;
  return Buffer.from(out, 'latin1');
}

/**
 * Builds 80mm/58mm thermal ESC/POS bytes for Pharmacy Medicine Barcode Label
 * Prints crisp vector-grade hardware Code 39 barcode directly via thermal printer firmware
 */
function buildBarcodeStickerEscPos({
  hospitalName = 'CarePulse Hospital Pharmacy',
  medicineName = 'Medicine',
  genericName = '',
  barcode = '890123456701',
  retailPrice = 0,
  expiryDate = ''
}) {
  const cleanCode = (barcode || '890123456701').toUpperCase().replace(/[^A-Z0-9\-\.\s]/g, '');
  const expStr = expiryDate ? new Date(expiryDate).toLocaleDateString('en-GB') : '';

  let out = '';
  out += `${ESC}@`; // Initialize
  out += `${ESC}t\x00`; // Select CP437 table

  // Top header - compact 24-character width formatted for small pharmacy label rolls
  out += `${ESC}a\x01`; // Center alignment
  out += `${ESC}E\x01`; // Bold
  out += `${(hospitalName || 'CarePulse Pharmacy').substring(0, 24).toUpperCase()}\n`;
  out += `${ESC}E\x00`;
  out += '------------------------\n';

  // Medicine Name in Bold
  out += `${ESC}E\x01`;
  out += `${medicineName.substring(0, 24)}\n`;
  out += `${ESC}E\x00`;

  if (genericName) {
    out += `${genericName.substring(0, 24)}\n`;
  }

  const priceStr = `Rs.${Number(retailPrice || 0).toFixed(0)}`;
  const priceExpLine = expStr ? `${priceStr}  EXP:${expStr}` : priceStr;
  out += `${ESC}E\x01`;
  out += `${priceExpLine.substring(0, 24)}\n`;
  out += `${ESC}E\x00`;
  out += '------------------------\n';

  // Barcode Configuration - Compact for small label rolls (fits 25mm to 40mm rolls)
  out += `${ESC}a\x01`; // Center align
  out += `${GS}h\x24`;  // Barcode height: 36 dots (compact)
  out += `${GS}w\x01`;  // Module width: 1 (fits small rolls cleanly without cut-off)
  out += `${GS}H\x02`;  // Human-Readable Interpretation (HRI) characters below barcode
  out += `${GS}f\x01`;  // Font B (condensed font for compact digits)

  // Native ESC/POS CODE 39 (Format A): GS k 4 <data> NUL
  out += `${GS}k\x04${cleanCode}\x00`;

  out += '\n------------------------\n\n\n';

  // Feed & Cut
  out += `${GS}V\x41\x10`;
  return Buffer.from(out, 'latin1');
}

/**
 * Builds compact thermal ESC/POS bytes for Patient MRN Barcode Sticker (50mm x 30mm or standard rolls)
 * Prints hospital header, patient name, age/gender, and native Code 39 barcode with text
 */
function buildPatientBarcodeStickerEscPos({
  hospitalName = 'DOCTORS HOSPITAL TIMERGARA',
  patientName = 'PATIENT',
  mrn = 'MRN-2026-0001',
  gender = '',
  age = '',
  phone = '',
  dateStr = ''
}) {
  const cleanCode = (mrn || 'PATIENT').toUpperCase().replace(/[^A-Z0-9\-\.\s]/g, '');
  const ageGender = [gender, age ? `${age}Y` : ''].filter(Boolean).join(' • ');
  const dateFormatted = dateStr || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  let out = '';
  out += `${ESC}@`; // Initialize
  out += `${ESC}t\x00`; // Select CP437 table

  // Top header - Hospital Name
  out += `${ESC}a\x01`; // Center alignment
  out += `${ESC}E\x01`; // Bold
  out += `${(hospitalName || 'DOCTORS HOSPITAL').substring(0, 24).toUpperCase()}\n`;
  out += `${ESC}E\x00`;
  out += '------------------------\n';

  // Patient Name & Age/Gender
  out += `${ESC}E\x01`;
  out += `${patientName.substring(0, 24)}\n`;
  out += `${ESC}E\x00`;

  if (ageGender) {
    out += `${ageGender.substring(0, 24)}\n`;
  }

  out += '------------------------\n';

  // Barcode Configuration - Compact Code 39
  out += `${ESC}a\x01`; // Center align
  out += `${GS}h\x24`;  // Barcode height: 36 dots (compact)
  out += `${GS}w\x01`;  // Module width: 1 (fits small rolls cleanly without cut-off)
  out += `${GS}H\x02`;  // Human-Readable Interpretation (HRI) characters below barcode
  out += `${GS}f\x01`;  // Font B (condensed font for compact digits)

  // Native ESC/POS CODE 39: GS k 4 <data> NUL
  out += `${GS}k\x04${cleanCode}\x00`;

  out += '\n------------------------\n';
  out += `${phone ? `Ph: ${phone}` : 'Hospital File'}  ${dateFormatted}\n\n\n`;

  // Feed & Cut
  out += `${GS}V\x41\x10`;
  return Buffer.from(out, 'latin1');
}

/**
 * Builds 80mm/58mm thermal ESC/POS bytes for Customer Dues & Payment Statement Slip
 * Prints executive financial summary (Total Billed, Total Paid, Total Pending Due)
 * and itemized invoice history.
 */
function buildCustomerDuesStatementEscPos({
  hospitalName = 'CarePulse Hospital Pharmacy',
  hospitalAddress = '',
  hospitalPhone = '',
  customerName = 'Valued Customer',
  customerPhone = '',
  customerId = '',
  totalBilled = 0,
  totalPaid = 0,
  totalPending = 0,
  sales = [],
  dateStr = ''
}) {
  let out = '';
  out += `${ESC}@`; // Initialize
  out += `${ESC}t\x00`; // CP437 table

  // 1. Header
  out += `${ESC}a\x01`; // Center
  out += boxBorder(44, 'top');
  out += boxText((hospitalName || 'CarePulse Hospital Pharmacy').toUpperCase(), 44, 'center');
  if (hospitalAddress) out += boxText(hospitalAddress, 44, 'center');
  if (hospitalPhone) out += boxText(`Phone: ${hospitalPhone}`, 44, 'center');
  out += boxBorder(44, 'middle');
  out += `${ESC}E\x01`;
  out += boxText('CUSTOMER DUES & PAYMENT STATEMENT', 44, 'center');
  out += `${ESC}E\x00`;
  out += boxBorder(44, 'middle');

  // 2. Customer Info
  out += `${ESC}a\x00`; // Left align
  out += boxText(`Customer: ${customerName}`, 44, 'left');
  if (customerPhone) out += boxText(`Phone:    ${customerPhone}`, 44, 'left');
  out += boxText(`Date:     ${dateStr || new Date().toLocaleString('en-GB')}`, 44, 'left');
  out += boxBorder(44, 'middle');

  // 3. EXECUTIVE FINANCIAL SUMMARY BOX
  out += `${ESC}E\x01`;
  out += boxText(`TOTAL BILLED:       Rs. ${Number(totalBilled).toFixed(0)}`, 44, 'left');
  out += boxText(`TOTAL PAID:         Rs. ${Number(totalPaid).toFixed(0)}`, 44, 'left');
  out += `${ESC}E\x00`;
  out += boxBorder(44, 'middle');

  out += `${ESC}E\x01`;
  out += boxText(`OUTSTANDING DUES:   Rs. ${Number(totalPending).toFixed(0)}`, 44, 'left');
  out += `${ESC}E\x00`;
  out += boxBorder(44, 'middle');

  // 4. Invoices Breakdown
  if (sales && sales.length > 0) {
    out += boxText('INVOICES BREAKDOWN:', 44, 'left');
    out += boxText('DATE       INV#        BILLED   PAID    DUE', 44, 'left');
    out += boxBorder(44, 'middle');

    sales.slice(0, 20).forEach(s => {
      const d = s.createdAt ? new Date(s.createdAt).toLocaleDateString('en-GB') : '—';
      const inv = (s.invoiceNo || 'INV').substring(0, 9);
      const b = Number(s.netTotal || 0).toFixed(0);
      const p = Number(s.paidAmount || 0).toFixed(0);
      const due = Number(Math.max(0, (s.netTotal || 0) - (s.paidAmount || 0))).toFixed(0);

      const line = `${d.padEnd(10)} ${inv.padEnd(10)} ${b.padStart(6)} ${p.padStart(6)} ${due.padStart(6)}`;
      out += boxText(line.substring(0, 42), 44, 'left');
    });

    out += boxBorder(44, 'middle');
  }

  // 5. Settlement Notice & Footer
  out += `${ESC}a\x01`; // Center
  if (Number(totalPending) > 0) {
    out += boxText('Please clear the pending balance', 44, 'center');
    out += boxText('at the pharmacy cash counter.', 44, 'center');
    out += boxBorder(44, 'middle');
  } else {
    out += boxText('All accounts are fully settled. Thank you!', 44, 'center');
    out += boxBorder(44, 'middle');
  }

  out += boxText('Thank you for choosing', 44, 'center');
  out += boxText(`${hospitalName || 'CarePulse Hospital'}!`, 44, 'center');
  out += boxBorder(44, 'bottom');
  out += '\n\n\n\n';

  // Feed & Cut
  out += `${GS}V\x41\x10`;
  return Buffer.from(out, 'latin1');
}

/**
 * Builds 80mm thermal ESC/POS bytes for Patient Cash Refund Voucher
 */
function buildRefundReceiptEscPos({
  hospitalName = 'CarePulse Hospital',
  hospitalAddress = '',
  hospitalPhone = '',
  receiptNo = 'REF-EXP',
  refCode = '',
  patientName = 'PATIENT',
  mrn = 'WALK-IN',
  phone = '',
  date = '',
  amount = 0,
  reason = 'Patient Left / Doctor Delayed',
  itemDescription = 'Patient Cash Consultation / Order Refund',
  paymentMethod = 'CASH'
}) {
  let out = '';

  // Initialize printer & select CP437 table for solid borders
  out += `${ESC}@`;
  out += `${ESC}t\x00`; // Select Character Code Table 0 (CP437)
  out += `${ESC}a\x01`; // Align Center on paper roll
  out += `${GS}!\x00`; // Normal size

  // 1. Hospital Header Box
  out += boxBorder(44, 'top');
  out += `${ESC}E\x01`; // Bold ON
  out += boxText(`[+] ${hospitalName.toUpperCase()} [+]`, 44, 'center');
  out += `${ESC}E\x00`; // Bold OFF
  if (hospitalAddress) out += boxText(hospitalAddress, 44, 'center');
  if (hospitalPhone) out += boxText(`Ph: ${hospitalPhone}`, 44, 'center');
  out += boxBorder(44, 'middle');

  out += `${ESC}E\x01`;
  out += boxText('*** PATIENT CASH REFUND VOUCHER ***', 44, 'center');
  out += boxText('FRONT DESK CASH DISBURSEMENT', 44, 'center');
  out += `${ESC}E\x00`;
  out += boxBorder(44, 'middle');

  // 2. Voucher & Patient Info
  const now = new Date(date || Date.now());
  const formattedDate = now.toLocaleDateString('en-GB') + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  out += boxTwoCol(`Voucher: ${receiptNo.substring(0, 14)}`, `Ref: ${(refCode || 'REF').substring(0, 14)}`, 23, 20);
  out += boxTwoCol(`Patient: ${patientName.toUpperCase().substring(0, 14)}`, `MRN: ${mrn}`, 23, 20);
  if (phone && phone !== 'N/A') {
    out += boxTwoCol(`Phone:   ${phone.substring(0, 14)}`, `Date: ${formattedDate.substring(0, 14)}`, 23, 20);
  } else {
    out += boxText(`Date: ${formattedDate}`, 44, 'left');
  }
  out += boxBorder(44, 'middle');

  // 3. Item and Reason
  out += boxText('REFUNDED ITEM / SERVICE:', 44, 'left');
  out += boxText((itemDescription || 'Patient Cash Refund').substring(0, 42), 44, 'left');
  out += boxBorder(44, 'middle');
  out += boxText('REASON FOR REFUND:', 44, 'left');
  out += boxText((reason || 'Patient Left / Doctor Delayed').substring(0, 42), 44, 'left');
  out += boxBorder(44, 'middle');

  // 4. Large Refund Amount Box
  out += boxText('TOTAL CASH REFUNDED:', 44, 'center');
  out += `${ESC}E\x01`;
  out += boxText(`Rs. ${Number(amount || 0).toLocaleString()} (${paymentMethod})`, 44, 'center');
  out += `${ESC}E\x00`;
  out += boxText('(Deducted from Shift Net Cash)', 44, 'center');
  out += boxBorder(44, 'middle');

  out += boxTwoCol(`Method:  ${paymentMethod}`, `Status: DISBURSED`, 23, 20);
  out += boxTwoCol(`Cashier: Front Desk Staff`, `Verified: YES`, 23, 20);
  out += boxBorder(44, 'middle');

  // 5. Signatures
  out += boxTwoCol('Patient Signature', 'Cashier Signature', 23, 20);
  out += boxTwoCol('_________________', '_________________', 23, 20);
  out += boxBorder(44, 'middle');

  // 6. Footer
  out += boxText('Computer verified official refund slip.', 44, 'center');
  out += boxText('Immediately deducted from cash in hand.', 44, 'center');
  out += boxBorder(44, 'bottom');
  out += '\n\n\n\n';

  // Cut
  out += `${GS}V\x41\x10`;
  return Buffer.from(out, 'latin1');
}

module.exports = {
  sendToNetworkPrinter,
  testPrinterConnection,
  getWindowsPrinters,
  sendToWindowsUsbPrinter,
  buildTestTicketEscPos,
  buildTokenEscPos,
  buildMasterReceiptEscPos,
  buildPharmacyReceiptEscPos,
  buildServiceReceiptEscPos,
  buildLabReceiptEscPos,
  buildXrayReceiptEscPos,
  buildBarcodeStickerEscPos,
  buildPatientBarcodeStickerEscPos,
  buildCustomerDuesStatementEscPos,
  buildRefundReceiptEscPos
};

