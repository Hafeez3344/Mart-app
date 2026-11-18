import api from './api';
import { getWorkstationPrinter } from './thermalPrint';

/**
 * Standard High-Density Code 39 Barcode Generator
 * Generates vector SVGs and canvas data for optical scanning with handheld thermal/laser barcode readers.
 */

const CODE39_PATTERNS = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
  '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
  '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
  'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
  'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
  'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
  'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
  'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
  'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
  '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
  '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100'
};

/**
 * Generate a standalone, vector Code 39 SVG string
 * @param {string} rawText - The text / MRN to encode
 * @param {object} options - Configurable dimensions & display options
 * @returns {string} - Complete SVG HTML markup
 */
export function generateCode39Svg(rawText, options = {}) {
  const {
    height = 36,
    narrowWidth = 1.4,
    wideWidth = 3.5,
    charGap = 1.4,
    quietZone = 10,
    showText = true,
    fontSize = 10,
    fillColor = '#000000',
    bgColor = '#ffffff',
    className = ''
  } = options;

  const cleanText = String(rawText || 'PATIENT')
    .toUpperCase()
    .replace(/[^A-Z0-9\-\.\s\$\/\+\%]/g, '');

  const fullString = `*${cleanText}*`;

  let currentX = quietZone;
  const rects = [];

  for (let i = 0; i < fullString.length; i++) {
    const char = fullString[i];
    const pattern = CODE39_PATTERNS[char] || CODE39_PATTERNS['-'];

    for (let p = 0; p < 9; p++) {
      const isBar = p % 2 === 0;
      const isWide = pattern[p] === '1';
      const width = isWide ? wideWidth : narrowWidth;

      if (isBar) {
        rects.push(
          `<rect x="${currentX.toFixed(1)}" y="0" width="${width.toFixed(1)}" height="${height}" fill="${fillColor}" shape-rendering="crispEdges" />`
        );
      }
      currentX += width;
    }
    // inter-character gap (white space)
    currentX += charGap;
  }

  const totalWidth = Math.ceil(currentX + quietZone);
  const textSpace = showText ? fontSize + 4 : 0;
  const totalHeight = Math.ceil(height + textSpace);

  const textElement = showText
    ? `<text x="${(totalWidth / 2).toFixed(1)}" y="${(height + fontSize).toFixed(1)}" text-anchor="middle" font-family="monospace, Courier, sans-serif" font-size="${fontSize}px" font-weight="bold" fill="${fillColor}" letter-spacing="1px">${cleanText}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}" class="${className}" style="display:inline-block;max-width:100%;height:auto;background:${bgColor};">
    ${bgColor ? `<rect width="100%" height="100%" fill="${bgColor}"/>` : ''}
    ${rects.join('')}
    ${textElement}
  </svg>`;
}

/**
 * Render Code 39 Barcode onto an HTML5 Canvas
 */
export function renderCode39ToCanvas(canvas, rawText, options = {}) {
  if (!canvas) return;
  const {
    barHeight = 40,
    narrowWidth = 2,
    wideWidth = 5,
    charGap = 2,
    quietZone = 14,
    showText = true,
    fontSize = 12,
    fillColor = '#000000',
    bgColor = '#ffffff'
  } = options;

  const cleanText = String(rawText || 'PATIENT')
    .toUpperCase()
    .replace(/[^A-Z0-9\-\.\s\$\/\+\%]/g, '');

  const fullString = `*${cleanText}*`;

  // Calculate total canvas width
  let totalContentWidth = 0;
  for (let i = 0; i < fullString.length; i++) {
    const pattern = CODE39_PATTERNS[fullString[i]] || CODE39_PATTERNS['-'];
    for (let p = 0; p < 9; p++) {
      totalContentWidth += pattern[p] === '1' ? wideWidth : narrowWidth;
    }
    totalContentWidth += charGap;
  }

  const canvasWidth = totalContentWidth + quietZone * 2;
  const textHeight = showText ? fontSize + 8 : 0;
  const canvasHeight = barHeight + textHeight + 8;

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  let currentX = quietZone;
  ctx.fillStyle = fillColor;

  for (let i = 0; i < fullString.length; i++) {
    const pattern = CODE39_PATTERNS[fullString[i]] || CODE39_PATTERNS['-'];
    for (let p = 0; p < 9; p++) {
      const isBar = p % 2 === 0;
      const isWide = pattern[p] === '1';
      const width = isWide ? wideWidth : narrowWidth;

      if (isBar) {
        ctx.fillRect(Math.round(currentX), 4, width, barHeight);
      }
      currentX += width;
    }
    currentX += charGap;
  }

  if (showText) {
    ctx.font = `bold ${fontSize}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = fillColor;
    ctx.fillText(cleanText.split('').join(' '), canvasWidth / 2, barHeight + 6);
  }
}

/**
 * Silent thermal print for patient barcode sticker
 * 1. Attempts direct hardware printing to thermal label printer via POST /api/print/patient-barcode
 * 2. If hardware printer is offline or unavailable, falls back to silent hidden iframe print
 */
export async function printPatientBarcodeStickerSilent(patient, options = {}) {
  if (!patient) return { success: false, message: 'No patient record provided' };

  const mrn = patient.mrn || 'PATIENT';
  const pName = patient.name || patient.patientName || 'Patient';
  const age = patient.age ? String(patient.age) : '';
  const gender = patient.gender || '';
  const phone = patient.phone || '';
  const hospitalName = options.hospitalName || 'DOCTORS HOSPITAL TIMERGARA';
  const copies = Math.min(50, Math.max(1, parseInt(options.copies || options.quantity, 10) || 1));

  // 1. ATTEMPT DIRECT HARDWARE THERMAL PRINT (USB SPOOLER OR TCP/IP 9100)
  if (!options.forceBrowserPrint) {
    try {
      const printerTarget = options.printerIp || getWorkstationPrinter('frontdesk') || getWorkstationPrinter();
      const netRes = await api.post('/print/patient-barcode', {
        patientId: patient.id,
        patientName: pName,
        mrn,
        gender,
        age,
        phone,
        hospitalName,
        copies,
        printerIp: printerTarget
      });

      if (netRes.data?.success) {
        console.log(`✓ Patient barcode sticker for "${pName}" (${mrn}) printed silently via hardware printer:`, netRes.data.message);
        return { success: true, method: 'hardware', message: netRes.data.message, mrn };
      }
    } catch (netErr) {
      console.info('Hardware thermal printer offline or busy, falling back to silent iframe browser print:', netErr?.response?.data?.message || netErr.message);
    }
  }

  // 2. SILENT BROWSER PRINT VIA HIDDEN IFRAME (NO POPUP WINDOW CREATED)
  return printPatientBarcodeViaIframe(patient, { hospitalName, copies });
}

/**
 * Silent printing of barcode sticker using hidden iframe without opening popup windows
 */
export function printPatientBarcodeViaIframe(patient, options = {}) {
  return new Promise((resolve) => {
    try {
      if (typeof window === 'undefined' || typeof document === 'undefined') {
        return resolve({ success: false, error: 'NO_WINDOW' });
      }

      const mrn = patient?.mrn || 'PATIENT';
      const pName = patient?.name || patient?.patientName || 'Patient';
      const ageGender = [patient?.gender, patient?.age ? `${patient.age}Y` : ''].filter(Boolean).join(' • ') || '—';
      const phone = patient?.phone || '';
      const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const hospName = options.hospitalName || 'DOCTORS HOSPITAL TIMERGARA';

      const barcodeSvg = generateCode39Svg(mrn, {
        height: 30,
        narrowWidth: 1.3,
        wideWidth: 3.2,
        charGap: 1.3,
        quietZone: 6,
        fontSize: 9,
        showText: true
      });

      const existingIframe = document.getElementById('silent-barcode-print-frame');
      if (existingIframe) {
        existingIframe.remove();
      }

      const iframe = document.createElement('iframe');
      iframe.id = 'silent-barcode-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Barcode Sticker - ${mrn}</title>
  <style>
    @page {
      size: 50mm 30mm;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      width: 50mm;
      height: 30mm;
      max-width: 50mm;
      max-height: 30mm;
      padding: 1.5mm 2mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      color: #000;
      background: #fff;
      overflow: hidden;
    }
    .h-name {
      font-size: 6pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.2px;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      border-bottom: 0.5px solid #000;
      padding-bottom: 0.5mm;
    }
    .pat-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-top: 0.8mm;
      font-size: 7.5pt;
      font-weight: 900;
      line-height: 1.1;
    }
    .pat-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 32mm;
    }
    .pat-meta {
      font-size: 6pt;
      font-weight: 700;
      white-space: nowrap;
    }
    .barcode-container {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0.5mm 0;
      overflow: hidden;
    }
    .barcode-container svg {
      width: 100%;
      max-height: 16mm;
    }
    .footer-row {
      display: flex;
      justify-content: space-between;
      font-size: 5.5pt;
      font-weight: 600;
      border-top: 0.5px dotted #666;
      padding-top: 0.5mm;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="h-name">${hospName}</div>
  <div class="pat-row">
    <span class="pat-name">${pName}</span>
    <span class="pat-meta">${ageGender}</span>
  </div>
  <div class="barcode-container">
    ${barcodeSvg}
  </div>
  <div class="footer-row">
    <span>${phone ? `Ph: ${phone}` : 'Hospital File'}</span>
    <span>${dateStr}</span>
  </div>
</body>
</html>`;

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (!doc) {
        printPatientBarcodeSticker(patient, hospName);
        return resolve({ success: true, method: 'window' });
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
          printPatientBarcodeSticker(patient, hospName);
          resolve({ success: true, method: 'window' });
        }
      }, 250);
    } catch (err) {
      printPatientBarcodeSticker(patient, options.hospitalName);
      resolve({ success: false, error: err.message });
    }
  });
}

/**
 * Print a dedicated high-resolution thermal barcode sticker for a patient (Preview Window)
 * Supports standard thermal sticker printer roll sizes (50mm x 30mm or 2" x 1")
 */
export function printPatientBarcodeSticker(patient, hospitalName = 'DOCTORS HOSPITAL TIMERGARA') {
  if (!patient) return;
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Popup blocker prevented sticker print. Please allow popups.');
    return;
  }

  const mrn = patient.mrn || 'PATIENT';
  const pName = patient.name || patient.patientName || 'Patient';
  const ageGender = [patient.gender, patient.age ? `${patient.age}Y` : ''].filter(Boolean).join(' • ') || '—';
  const phone = patient.phone || '';
  const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const barcodeSvg = generateCode39Svg(mrn, {
    height: 30,
    narrowWidth: 1.3,
    wideWidth: 3.2,
    charGap: 1.3,
    quietZone: 6,
    fontSize: 9,
    showText: true
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Barcode Sticker - ${mrn}</title>
  <style>
    @page {
      size: 50mm 30mm;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      width: 50mm;
      height: 30mm;
      max-width: 50mm;
      max-height: 30mm;
      padding: 1.5mm 2mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      color: #000;
      background: #fff;
      overflow: hidden;
    }
    .h-name {
      font-size: 6pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.2px;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      border-bottom: 0.5px solid #000;
      padding-bottom: 0.5mm;
    }
    .pat-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-top: 0.8mm;
      font-size: 7.5pt;
      font-weight: 900;
      line-height: 1.1;
    }
    .pat-name {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 32mm;
    }
    .pat-meta {
      font-size: 6pt;
      font-weight: 700;
      white-space: nowrap;
    }
    .barcode-container {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 0.5mm 0;
      overflow: hidden;
    }
    .barcode-container svg {
      width: 100%;
      max-height: 16mm;
    }
    .footer-row {
      display: flex;
      justify-content: space-between;
      font-size: 5.5pt;
      font-weight: 600;
      border-top: 0.5px dotted #666;
      padding-top: 0.5mm;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="h-name">${hospitalName}</div>
  <div class="pat-row">
    <span class="pat-name">${pName}</span>
    <span class="pat-meta">${ageGender}</span>
  </div>
  <div class="barcode-container">
    ${barcodeSvg}
  </div>
  <div class="footer-row">
    <span>${phone ? `Ph: ${phone}` : 'Hospital File'}</span>
    <span>${dateStr}</span>
  </div>
  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 1200);
    };
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

