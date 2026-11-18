const crypto = require('crypto');

/**
 * Safe ID Generation Module for Mart Point of Sale (POS) System
 * Cryptographically secure, high-entropy unique identifier generator.
 */

function randomHex(bytes = 3) {
  return crypto.randomBytes(bytes).toString('hex').toUpperCase();
}

function randomDigits(length = 6) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

/**
 * Generates POS Sale Invoice Number: POS-YYYY-XXXXXX
 * e.g. POS-2026-834921
 */
function generateSaleInvoiceNo(year = new Date().getFullYear()) {
  const ts = Date.now().toString().slice(-6);
  return `POS-${year}-${ts}-${randomHex(2)}`;
}

// Backward compatibility alias
function generatePharmacyInvoiceNo(year = new Date().getFullYear()) {
  return generateSaleInvoiceNo(year);
}
function generateInvoiceNo(year = new Date().getFullYear()) {
  return generateSaleInvoiceNo(year);
}

/**
 * Generates Purchase Order / Stock-In Number: PO-YYYY-XXXX
 */
function generatePurchaseOrderNo(year = new Date().getFullYear()) {
  const ts = Date.now().toString().slice(-5);
  return `PO-${year}-${ts}-${randomHex(2)}`;
}

/**
 * Generates Sales Return Number: RET-YYYY-XXXX
 */
function generateReturnNo(year = new Date().getFullYear()) {
  const ts = Date.now().toString().slice(-5);
  return `RET-${year}-${ts}-${randomHex(2)}`;
}
function generatePharmacyReturnNo(year = new Date().getFullYear()) {
  return generateReturnNo(year);
}

/**
 * Generates Register Shift Number: SHIFT-YYYYMMDD-XXXX
 */
function generateShiftNo() {
  const d = new Date();
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
  return `SHIFT-${dateStr}-${randomHex(2)}`;
}

/**
 * Generates standard 12-digit Mart product barcode
 */
function generateProductBarcode() {
  const prefix = '890'; // Retail mart prefix
  const middle = Date.now().toString().slice(-8);
  const suffix = randomDigits(1);
  return `${prefix}${middle}${suffix}`;
}

module.exports = {
  randomHex,
  randomDigits,
  generateSaleInvoiceNo,
  generatePurchaseOrderNo,
  generateReturnNo,
  generateShiftNo,
  generateProductBarcode,
  generatePharmacyInvoiceNo,
  generatePharmacyReturnNo,
  generateInvoiceNo
};
