/**
 * Super Mart POS - Lightweight Workstation Print Agent
 * Run this on any cashier workstation computer (Checkout Counter 1, Counter 2, etc.)
 * to enable instant, silent printing directly to that computer's local USB thermal printer.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const PORT = 5005;

// Embedded PowerShell C# Raw Spooler invoker
const RAW_PRINTER_PS = `
param([string]$PrinterName, [string]$FilePath)
$src = @"
using System;
using System.IO;
using System.Runtime.InteropServices;
public class RawHelper {
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true, CharSet=CharSet.Ansi, ExactSpelling=true)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true, CharSet=CharSet.Ansi)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, int level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);
    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);
    [DllImport("winspool.Drv", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, int dwCount, out int dwWritten);

    public static string SendBytes(string printer, byte[] bytes) {
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "Workstation Silent ESCPOS";
        di.pDataType = "RAW";
        if (OpenPrinter(printer, out hPrinter, IntPtr.Zero)) {
            if (StartDocPrinter(hPrinter, 1, di)) {
                if (StartPagePrinter(hPrinter)) {
                    IntPtr pBytes = Marshal.AllocCoTaskMem(bytes.Length);
                    Marshal.Copy(bytes, 0, pBytes, bytes.Length);
                    int written = 0;
                    bool ok = WritePrinter(hPrinter, pBytes, bytes.Length, out written);
                    Marshal.FreeCoTaskMem(pBytes);
                    EndPagePrinter(hPrinter);
                    EndDocPrinter(hPrinter);
                    ClosePrinter(hPrinter);
                    return ok ? "SUCCESS" : "WritePrinter failed: " + Marshal.GetLastWin32Error();
                }
                EndDocPrinter(hPrinter);
                ClosePrinter(hPrinter);
                return "StartPagePrinter failed";
            }
            ClosePrinter(hPrinter);
            return "StartDocPrinter failed";
        }
        return "OpenPrinter failed for: " + printer;
    }
}
"@
if (-not ([System.Management.Automation.PSTypeName]'RawHelper').Type) { Add-Type -TypeDefinition $src }
$bytes = [System.IO.File]::ReadAllBytes($FilePath)
$res = [RawHelper]::SendBytes($PrinterName, $bytes)
Write-Host $res
`;

function sendRawToLocalPrinter(printerName, buffer) {
  return new Promise((resolve, reject) => {
    const tempBin = path.join(os.tmpdir(), `ws_print_${Date.now()}.bin`);
    const tempPs = path.join(os.tmpdir(), `ws_spooler_${Date.now()}.ps1`);

    fs.writeFileSync(tempBin, buffer);
    fs.writeFileSync(tempPs, RAW_PRINTER_PS);

    const cmd = `powershell -WindowStyle Hidden -NonInteractive -NoProfile -ExecutionPolicy Bypass -File "${tempPs}" -PrinterName "${printerName}" -FilePath "${tempBin}"`;

    exec(cmd, { windowsHide: true, timeout: 8000 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(tempBin); } catch (e) {}
      try { fs.unlinkSync(tempPs); } catch (e) {}

      if (err || (stdout && stdout.includes('failed'))) {
        return reject(new Error(stdout.trim() || stderr || err.message));
      }
      resolve({ success: true, message: `Printed to ${printerName}` });
    });
  });
}

const server = http.createServer(async (req, res) => {
  // CORS & Private Network Access Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      online: true,
      service: 'CarePulse Workstation Print Agent',
      hostname: os.hostname(),
      platform: os.platform()
    }));
  }

  if (url.pathname === '/print' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const printerName = payload.printerName || 'BlackCopper 80mm Series';
        const rawBase64 = payload.rawBase64;

        if (!rawBase64) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ success: false, message: 'Missing rawBase64' }));
        }

        const buffer = Buffer.from(rawBase64, 'base64');
        const printRes = await sendRawToLocalPrinter(printerName, buffer);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, ...printRes }));
      } catch (err) {
        console.error('Workstation print error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: false, message: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`=======================================================`);
  console.log(`CarePulse HMS - Workstation Local Print Agent`);
  console.log(`Running on: http://127.0.0.1:${PORT}`);
  console.log(`Physical PC: ${os.hostname()}`);
  console.log(`Status: Ready for silent 1-click thermal printing!`);
  console.log(`=======================================================`);
});
