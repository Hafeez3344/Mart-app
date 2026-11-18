/**
 * Database & Input Integrity Validation Utilities
 * Enforces strict money validation, boolean validation, and date/time standardization.
 */

/**
 * Validates and normalizes monetary values.
 * - Enforces non-negative finite numbers
 * - Rounds to 2 decimal places to prevent floating-point precision leaks
 * @param {any} val - The input value
 * @param {number} defaultVal - Fallback value (default: 0.00)
 * @returns {number} Normalized float rounded to 2 decimal places
 */
function parseMoney(val, defaultVal = 0.00) {
  if (val === undefined || val === null || val === '') return defaultVal;
  const num = parseFloat(val);
  if (isNaN(num) || !isFinite(num)) return defaultVal;
  // Non-negative constraint for monetary charges, rates, fees, and payments
  const clamped = Math.max(0, num);
  return Math.round((clamped + Number.EPSILON) * 100) / 100;
}

/**
 * Validates financial balance constraints:
 * - discount cannot exceed total
 * - net total = total - discount (minimum 0)
 * - paid amount cannot exceed net total
 * - balance = net total - paid amount
 */
function validateFinancials({ totalAmount = 0, discountAmount = 0, paidAmount = 0 }) {
  const total = parseMoney(totalAmount);
  const rawDiscount = parseMoney(discountAmount);
  const discount = Math.min(total, rawDiscount);
  const netTotal = parseMoney(total - discount);
  const rawPaid = parseMoney(paidAmount);
  const paid = Math.min(netTotal, rawPaid);
  const balance = parseMoney(netTotal - paid);

  let paymentStatus = 'UNPAID';
  if (paid >= netTotal && netTotal > 0) {
    paymentStatus = 'PAID';
  } else if (paid > 0) {
    paymentStatus = 'PARTIAL';
  } else if (netTotal === 0 && total > 0) {
    paymentStatus = 'PAID'; // 100% discount
  }

  return {
    total,
    discount,
    netTotal,
    paid,
    balance,
    paymentStatus
  };
}

/**
 * Strictly parses boolean values from query strings, form-data, or JSON.
 * Avoids the JavaScript bug where string "false" evaluates to truthy!
 * @param {any} val - Input value (e.g. true, false, "true", "false", 1, 0, "yes", "no")
 * @param {boolean} defaultVal - Fallback boolean (default: false)
 * @returns {boolean}
 */
function parseBoolean(val, defaultVal = false) {
  if (typeof val === 'boolean') return val;
  if (val === 1 || val === '1') return true;
  if (val === 0 || val === '0') return false;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === 'true' || s === 'yes' || s === 'y' || s === 'on') return true;
    if (s === 'false' || s === 'no' || s === 'n' || s === 'off') return false;
  }
  return defaultVal;
}

/**
 * Standardizes date parsing to valid ISO Date object.
 * Prevents "Invalid Date" database errors.
 * @param {any} val - Input date string or timestamp
 * @param {Date|null} defaultDate - Fallback date
 * @returns {Date}
 */
function parseIsoDate(val, defaultDate = new Date()) {
  if (!val) return defaultDate;
  const d = new Date(val);
  return isNaN(d.getTime()) ? defaultDate : d;
}

/**
 * Returns formatted YYYY-MM-DD date string.
 * @param {Date|string|number} val
 * @returns {string} e.g. "2026-10-01"
 */
function formatDateYmd(val = new Date()) {
  const d = parseIsoDate(val);
  return d.toISOString().split('T')[0];
}

module.exports = {
  parseMoney,
  validateFinancials,
  parseBoolean,
  parseIsoDate,
  formatDateYmd
};
