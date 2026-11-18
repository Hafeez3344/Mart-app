/**
 * Client-Side Direct Thermal Printer Driver
 * Supports:
 * 1. WebUSB: Direct browser-to-USB communication for modern Chrome/Edge.
 * 2. Local Workstation Agent: High-performance, zero-conflict local print bridge on localhost:5005.
 */

const STORAGE_KEY_PAIRED_DEVICE = 'hms_webusb_paired';

/**
 * Check if WebUSB is supported in the current browser
 */
export function isWebUsbSupported() {
  return typeof navigator !== 'undefined' && 'usb' in navigator;
}

/**
 * Check if a WebUSB printer has already been paired on this computer
 */
export function isWebUsbPaired() {
  return Boolean(getSavedWebUsbDevice());
}

/**
 * Request user to pair their USB thermal printer (One-time click in Settings)
 */
export async function pairWebUsbPrinter() {
  if (!isWebUsbSupported()) {
    throw new Error('WebUSB is not supported in this browser. Please use Chrome or Edge.');
  }

  try {
    const device = await navigator.usb.requestDevice({
      filters: [] // Allow user to select any detected USB device (BlackCopper, POS-80, etc.)
    });

    if (device) {
      const info = {
        vendorId: device.vendorId,
        productId: device.productId,
        productName: device.productName || 'USB Thermal Printer',
        manufacturerName: device.manufacturerName || 'Generic'
      };
      localStorage.setItem(STORAGE_KEY_PAIRED_DEVICE, JSON.stringify(info));
      return { success: true, device: info };
    }
  } catch (err) {
    if (err.name === 'NotFoundError') {
      throw new Error('No printer was selected.');
    }
    throw err;
  }
}

/**
 * Unpair saved WebUSB printer
 */
export function forgetWebUsbPrinter() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_PAIRED_DEVICE);
  }
}

/**
 * Get previously paired USB device info
 */
export function getSavedWebUsbDevice() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PAIRED_DEVICE);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Find and connect to the paired USB thermal printer
 */
async function getConnectedDevice() {
  if (!isWebUsbSupported()) return null;
  const paired = getSavedWebUsbDevice();
  const devices = await navigator.usb.getDevices();

  if (devices.length === 0) return null;

  if (paired) {
    const match = devices.find(d => d.vendorId === paired.vendorId && d.productId === paired.productId);
    if (match) return match;
  }

  // Fallback: pick the first authorized USB device
  return devices[0] || null;
}

/**
 * Send raw ESC/POS byte array directly to the client's USB printer
 * @param {Uint8Array|ArrayBuffer} dataBytes
 */
export async function printViaWebUsb(dataBytes) {
  const device = await getConnectedDevice();
  if (!device) {
    throw new Error('NO_WEBUSB_DEVICE');
  }

  try {
    await device.open();
  } catch (openErr) {
    if (openErr.name === 'SecurityError' || openErr.message?.includes('Access denied')) {
      throw new Error('WEBUSB_ACCESS_DENIED');
    }
    throw openErr;
  }

  // Select first configuration if not already selected
  if (device.configuration === null) {
    await device.selectConfiguration(1);
  }

  // Find the printer interface (usually class 7 or first interface)
  let printerInterface = device.configuration.interfaces.find(i => 
    i.alternates.some(a => a.interfaceClass === 7)
  ) || device.configuration.interfaces[0];

  if (!printerInterface) {
    await device.close();
    throw new Error('Could not find printer interface on USB device.');
  }

  const interfaceNumber = printerInterface.interfaceNumber;
  await device.claimInterface(interfaceNumber);

  // Find OUT endpoint for sending data to printer
  const alternate = printerInterface.alternates[0];
  const outEndpoint = alternate.endpoints.find(e => e.direction === 'out');

  if (!outEndpoint) {
    await device.releaseInterface(interfaceNumber);
    await device.close();
    throw new Error('Could not find output endpoint on USB printer.');
  }

  const endpointNumber = outEndpoint.endpointNumber;

  // Send bytes in chunks (max 64 or 512 bytes per transfer for bulk endpoint)
  const chunkSize = 64;
  const buffer = dataBytes instanceof Uint8Array ? dataBytes : new Uint8Array(dataBytes);

  for (let i = 0; i < buffer.length; i += chunkSize) {
    const chunk = buffer.slice(i, i + chunkSize);
    await device.transferOut(endpointNumber, chunk);
  }

  // Release and close cleanly
  try {
    await device.releaseInterface(interfaceNumber);
    await device.close();
  } catch (e) {
    // ignore clean up error
  }

  return { success: true };
}

/**
 * Decodes a Base64 ESC/POS string and sends it directly via WebUSB
 * @param {string} base64String
 */
export async function printRawBase64ViaWebUsb(base64String) {
  if (!base64String) throw new Error('No print data provided');
  const binaryString = atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return await printViaWebUsb(bytes);
}

/**
 * Checks if the optional lightweight local workstation print agent is running on localhost:5005
 */
export async function isWorkstationAgentOnline(port = 5005) {
  if (typeof window === 'undefined') return false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    const res = await fetch(`http://127.0.0.1:${port}/status`, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      return Boolean(data?.online);
    }
  } catch (e) {
    return false;
  }
  return false;
}

/**
 * Sends print job to the local workstation agent on localhost:5005
 */
export async function printViaWorkstationAgent(rawBase64, printerName = 'BlackCopper 80mm Series', port = 5005) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  const res = await fetch(`http://127.0.0.1:${port}/print`, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      printerName,
      rawBase64
    })
  });
  clearTimeout(timer);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'Workstation agent print failed');
  }
  return await res.json();
}
