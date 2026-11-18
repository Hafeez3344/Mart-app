'use client';

import React, { useState, useEffect } from 'react';
import api from '../lib/api';
import {
  isWebUsbSupported,
  isWebUsbPaired,
  pairWebUsbPrinter,
  getSavedWebUsbDevice,
  forgetWebUsbPrinter,
  printRawBase64ViaWebUsb,
  isWorkstationAgentOnline,
  printViaWorkstationAgent
} from '../lib/webUsbPrint';
import {
  Printer,
  Radio,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Send,
  HelpCircle,
  HardDrive,
  Save,
  Check,
  Usb,
  Laptop,
  Server,
  Zap,
  Download
} from 'lucide-react';

export default function WorkstationPrinterSettings({
  department = 'workstation',
  departmentLabel = 'This Workstation Counter',
  receiptType = 'Receipts & Tokens'
}) {
  const storageKey = `hms_printer_${department}`;

  const [windowsPrinters, setWindowsPrinters] = useState([]);
  const [fetchingPrinters, setFetchingPrinters] = useState(false);

  // WebUSB and Agent status
  const [webUsbSupported, setWebUsbSupported] = useState(false);
  const [pairedDevice, setPairedDevice] = useState(null);
  const [agentOnline, setAgentOnline] = useState(false);
  const [checkingAgent, setCheckingAgent] = useState(false);

  // Config state
  const [config, setConfig] = useState({
    enabled: true,
    mode: 'LOCAL_AGENT', // 'LOCAL_AGENT' | 'WEBUSB' | 'USB' | 'NETWORK'
    usbPrinterName: 'BlackCopper 80mm Series',
    networkIp: '192.168.1.200',
    networkPort: 9100,
  });

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [printerTest, setPrinterTest] = useState({ testing: false, status: null, message: '' });
  const [testingTicket, setTestingTicket] = useState(false);
  const [downloadAgentUrl, setDownloadAgentUrl] = useState('/api/print/download-agent');

  // Load from localStorage on mount and dynamically set download URL
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location) {
      const host = window.location.hostname || 'localhost';
      setDownloadAgentUrl(`http://${host}:5000/api/print/download-agent`);
    }
    setWebUsbSupported(isWebUsbSupported());
    setPairedDevice(getSavedWebUsbDevice());

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        setConfig(prev => ({ ...prev, ...parsed }));
      } else {
        // If webusb is already paired, default to WEBUSB, else if agent online default to agent, else USB
        const globalTarget = localStorage.getItem('hms_workstation_printer');
        if (globalTarget) {
          if (globalTarget.startsWith('USB:')) {
            setConfig(prev => ({ ...prev, mode: 'USB', usbPrinterName: globalTarget.replace('USB:', '') }));
          } else if (globalTarget.includes('.') || globalTarget.includes(':')) {
            const parts = globalTarget.split(':');
            setConfig(prev => ({ ...prev, mode: 'NETWORK', networkIp: parts[0], networkPort: parseInt(parts[1], 10) || 9100 }));
          }
        }
      }
    } catch (e) {
      console.warn('Failed to parse printer config from localStorage:', e);
    }
    fetchPrinters();
    checkAgentStatus();
  }, [storageKey]);

  const checkAgentStatus = async () => {
    setCheckingAgent(true);
    const online = await isWorkstationAgentOnline();
    setAgentOnline(online);
    setCheckingAgent(false);
  };

  const handleDownloadAgent = async (e) => {
    if (e) e.preventDefault();
    try {
      const res = await api.get('/print/download-agent', { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'workstation-printer.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch (err) {
      window.location.href = downloadAgentUrl;
    }
  };

  const fetchPrinters = async () => {
    setFetchingPrinters(true);
    try {
      const res = await api.get('/print/windows-printers');
      if (res.data?.success && res.data.printers) {
        setWindowsPrinters(res.data.printers);
        if (!localStorage.getItem(storageKey)) {
          const def = res.data.printers.find(p => p.isDefault) ||
            res.data.printers.find(p => p.name === 'BlackCopper 80mm Series') ||
            res.data.printers.find(p => (p.name.includes('80') || p.name.includes('POS') || p.name.includes('BlackCopper')) && !p.name.includes('(1)')) ||
            res.data.printers.find(p => p.name.includes('80') || p.name.includes('POS') || p.name.includes('BlackCopper')) ||
            res.data.printers[0];
          if (def) {
            setConfig(prev => ({ ...prev, usbPrinterName: def.name }));
          }
        }
      }
    } catch (e) {
      console.warn('Could not fetch Windows printers:', e);
    } finally {
      setFetchingPrinters(false);
    }
  };

  const handlePairWebUsb = async () => {
    try {
      setPrinterTest({ testing: true, status: null, message: 'Requesting USB device access...' });
      const res = await pairWebUsbPrinter();
      if (res?.device) {
        setPairedDevice(res.device);
        const next = { ...config, mode: 'WEBUSB' };
        setConfig(next);
        handleSave(next);
        setPrinterTest({
          testing: false,
          status: 'online',
          message: `Successfully paired with "${res.device.productName}"! Direct printing is now active on this computer.`
        });
      }
    } catch (err) {
      setPrinterTest({
        testing: false,
        status: 'offline',
        message: err.message || 'Failed to pair USB printer.'
      });
    }
  };

  const handleForgetWebUsb = () => {
    forgetWebUsbPrinter();
    setPairedDevice(null);
    setPrinterTest({
      testing: false,
      status: null,
      message: 'WebUSB printer unpaired from this computer.'
    });
  };

  const handleSave = (newConfig = config) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(newConfig));
      localStorage.setItem('hms_printer_workstation', JSON.stringify(newConfig));

      let target = `USB:${newConfig.usbPrinterName}`;
      if (newConfig.mode === 'WEBUSB') target = 'WEBUSB';
      if (newConfig.mode === 'LOCAL_AGENT') target = 'LOCAL_AGENT';
      if (newConfig.mode === 'NETWORK') target = `${newConfig.networkIp}:${newConfig.networkPort || 9100}`;

      localStorage.setItem(`hms_target_${department}`, target);
      localStorage.setItem('hms_workstation_printer', target);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error('Failed to save printer config:', e);
    }
  };

  const handleTestConnection = async () => {
    setPrinterTest({ testing: true, status: null, message: 'Testing printer connection...' });

    if (config.mode === 'WEBUSB') {
      const dev = getSavedWebUsbDevice();
      if (!dev) {
        setPrinterTest({
          testing: false,
          status: 'offline',
          message: 'No USB printer has been paired yet. Click "Pair This PC\'s USB Printer" above.'
        });
        return;
      }
      setPrinterTest({
        testing: false,
        status: 'online',
        message: `Paired with local USB device: ${dev.productName} (Ready for silent printing)`
      });
      return;
    }

    if (config.mode === 'LOCAL_AGENT') {
      const online = await isWorkstationAgentOnline();
      setAgentOnline(online);
      if (online) {
        setPrinterTest({
          testing: false,
          status: 'online',
          message: `Local Workstation Print Agent is ONLINE on port 5005 (Sending directly to this PC's "${config.usbPrinterName}")`
        });
      } else {
        setPrinterTest({
          testing: false,
          status: 'offline',
          message: 'Local Workstation Print Agent is NOT running on this computer. Start "start-workstation-printer.bat" or choose another mode.'
        });
      }
      return;
    }

    // Backend Windows / Network test
    try {
      const target = config.mode === 'USB' ? `USB:${config.usbPrinterName}` : config.networkIp;
      const port = config.mode === 'NETWORK' ? (config.networkPort || 9100) : 9100;
      const res = await api.get(`/print/status?ip=${encodeURIComponent(target)}&port=${port}`);
      if (res.data?.online) {
        setPrinterTest({ testing: false, status: 'online', message: res.data.message || 'Printer is ONLINE and ready!' });
      } else {
        setPrinterTest({ testing: false, status: 'offline', message: res.data.message || 'Printer is offline or unreachable.' });
      }
    } catch (err) {
      setPrinterTest({ testing: false, status: 'offline', message: err.response?.data?.message || err.message });
    }
  };

  const handlePrintTestTicket = async () => {
    setTestingTicket(true);
    setPrinterTest({ testing: true, status: null, message: 'Generating and dispatching test ticket...' });

    try {
      // 1. Direct WebUSB
      if (config.mode === 'WEBUSB') {
        const res = await api.post('/print/test-ticket', {
          returnBuffer: true,
          label: `${departmentLabel} (Direct WebUSB)`
        });
        if (res.data?.rawBase64) {
          await printRawBase64ViaWebUsb(res.data.rawBase64);
          setPrinterTest({
            testing: false,
            status: 'online',
            message: `✓ Test ticket printed silently via WebUSB directly to this computer's USB cable!`
          });
          return;
        }
      }

      // 2. Local Workstation Agent
      if (config.mode === 'LOCAL_AGENT') {
        const res = await api.post('/print/test-ticket', {
          returnBuffer: true,
          label: `${departmentLabel} (Local Workstation Agent)`
        });
        if (res.data?.rawBase64) {
          await printViaWorkstationAgent(res.data.rawBase64, config.usbPrinterName);
          setPrinterTest({
            testing: false,
            status: 'online',
            message: `✓ Test ticket printed silently via Local Workstation Agent to "${config.usbPrinterName}"!`
          });
          return;
        }
      }

      // 3. Server Spooler / Network Printer
      const target = config.mode === 'USB' ? `USB:${config.usbPrinterName}` : config.networkIp;
      const port = config.mode === 'NETWORK' ? (config.networkPort || 9100) : 9100;
      const res = await api.post('/print/test-ticket', {
        target,
        port,
        label: `${departmentLabel} Workstation Thermal Printer`
      });

      if (res.data?.success) {
        setPrinterTest({
          testing: false,
          status: 'online',
          message: res.data.message || `Test ticket printed successfully on ${target}!`
        });
      } else {
        setPrinterTest({
          testing: false,
          status: 'offline',
          message: res.data.message || 'Failed to print test ticket.'
        });
      }
    } catch (err) {
      setPrinterTest({
        testing: false,
        status: 'offline',
        message: err.message || 'Failed to print test ticket'
      });
    } finally {
      setTestingTicket(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-[#B7D7F0] shadow-sm overflow-hidden text-xs">
      {/* Top Banner */}
      <div className="p-5 border-b border-[#B7D7F0]/60 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm shrink-0">
            <Printer className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-extrabold text-[#1F3F66]">
                Dedicated Workstation Thermal Printer
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px] tracking-wide border border-amber-300 uppercase">
                {departmentLabel}
              </span>
            </div>
            <p className="text-slate-600 text-xs mt-0.5">
              Print {receiptType} silently directly to the physical thermal printer connected to <strong>THIS</strong> computer.
            </p>
          </div>
        </div>

        {/* Enable/Disable Toggle */}
        <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-xl border border-amber-200 shadow-2xs">
          <span className={`font-bold text-xs ${config.enabled ? 'text-amber-800' : 'text-slate-400'}`}>
            {config.enabled ? 'Direct Printing Active' : 'Disabled'}
          </span>
          <button
            type="button"
            onClick={() => {
              const next = { ...config, enabled: !config.enabled };
              setConfig(next);
              handleSave(next);
            }}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
              config.enabled ? 'bg-amber-600' : 'bg-slate-300'
            }`}
            title="Toggle direct thermal printing on this machine"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
                config.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-6">
        {/* Connection Mode Selection */}
        <div>
          <label className="block font-bold text-slate-700 text-xs mb-2">
            Choose How THIS Computer Connects to its USB Thermal Printer:
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {/* Mode 1: Local Workstation Agent (Recommended) */}
            <button
              type="button"
              onClick={() => {
                const next = { ...config, mode: 'LOCAL_AGENT' };
                setConfig(next);
                handleSave(next);
              }}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                config.mode === 'LOCAL_AGENT'
                  ? 'border-emerald-500 bg-emerald-50/70 shadow-xs ring-2 ring-emerald-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <Laptop className={`w-4 h-4 ${config.mode === 'LOCAL_AGENT' ? 'text-emerald-700' : 'text-slate-500'}`} />
                  <span className="font-bold text-xs text-slate-800">Local PC Agent</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  RECOMMENDED
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                Uses the local print helper on this computer. 100% silent, zero driver conflicts with Windows.
              </p>
              <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center gap-1.5 text-[10px]">
                <span className={`w-2 h-2 rounded-full ${agentOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
                <span className={agentOnline ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                  {agentOnline ? 'Agent Running (Port 5005)' : 'Agent Not Detected'}
                </span>
              </div>
            </button>

            {/* Mode 2: Direct WebUSB */}
            <button
              type="button"
              onClick={() => {
                const next = { ...config, mode: 'WEBUSB' };
                setConfig(next);
                handleSave(next);
              }}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                config.mode === 'WEBUSB'
                  ? 'border-amber-500 bg-amber-50/70 shadow-xs ring-2 ring-amber-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <Usb className={`w-4 h-4 ${config.mode === 'WEBUSB' ? 'text-amber-700' : 'text-slate-500'}`} />
                  <span className="font-bold text-xs text-slate-800">Direct WebUSB</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  Chrome / Edge
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                Direct browser communication via USB cable without any helper scripts.
              </p>
              <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center gap-1.5 text-[10px]">
                <span className={`w-2 h-2 rounded-full ${pairedDevice ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                <span className={pairedDevice ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                  {pairedDevice ? `Paired: ${pairedDevice.productName?.slice(0, 16)}` : 'Not paired yet'}
                </span>
              </div>
            </button>

            {/* Mode 3: Server Windows Spooler */}
            <button
              type="button"
              onClick={() => {
                const next = { ...config, mode: 'USB' };
                setConfig(next);
                handleSave(next);
              }}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                config.mode === 'USB'
                  ? 'border-blue-500 bg-blue-50/70 shadow-xs ring-2 ring-blue-500/20'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  <Server className={`w-4 h-4 ${config.mode === 'USB' ? 'text-blue-700' : 'text-slate-500'}`} />
                  <span className="font-bold text-xs text-slate-800">Server / Shared Spooler</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                  Server PC
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                For when using the main Server computer, or using Windows Shared Printer names.
              </p>
              <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center gap-1.5 text-[10px]">
                <span className="text-slate-500 font-mono truncate">
                  Target: {config.usbPrinterName || 'BlackCopper 80mm'}
                </span>
              </div>
            </button>
          </div>
        </div>

        {/* DETAILS FOR MODE 1: LOCAL WORKSTATION AGENT */}
        {config.mode === 'LOCAL_AGENT' && (
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-extrabold text-emerald-950 text-xs flex items-center gap-1.5">
                  <span>Local Workstation Print Agent (Port 5005)</span>
                </h4>
                <p className="text-[11px] text-emerald-900/80 mt-0.5">
                  This runs silently in the background of THIS computer and forwards prints to your local USB thermal printer.
                </p>
              </div>
              <button
                type="button"
                onClick={checkAgentStatus}
                disabled={checkingAgent}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 transition-colors cursor-pointer bg-white px-2.5 py-1.5 rounded-lg border border-emerald-300 shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checkingAgent ? 'animate-spin' : ''}`} />
                <span>{checkingAgent ? 'Checking...' : 'Check Status'}</span>
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold text-slate-700 text-xs">
                Local Printer Name on THIS Computer:
              </label>
              <input
                type="text"
                value={config.usbPrinterName}
                onChange={(e) => {
                  const next = { ...config, usbPrinterName: e.target.value };
                  setConfig(next);
                  handleSave(next);
                }}
                placeholder="BlackCopper 80mm Series"
                className="w-full px-3 py-2 rounded-lg border border-emerald-300 font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
              <p className="text-[10px] text-slate-500">
                Must match the printer name shown in Windows Devices and Printers on this computer (usually "BlackCopper 80mm Series" or "POS-80").
              </p>
            </div>

            {!agentOnline && (
              <div className="p-3.5 bg-white rounded-lg border border-amber-200 text-[11px] text-amber-900 space-y-2 leading-relaxed">
                <div className="font-bold flex items-center gap-1.5 text-amber-800 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>How to connect this computer in 10 seconds:</span>
                </div>
                <div>
                  1. Click the button below to download the helper to this computer:
                </div>
                <div>
                  <button
                    type="button"
                    onClick={handleDownloadAgent}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Workstation Printer Helper (.zip)</span>
                  </button>
                </div>
                <div>
                  2. Extract the downloaded ZIP and double-click <strong>install-autostart.bat</strong> (runs silently in the background on Windows startup without any black window!).
                </div>
                <div>
                  3. Come back here, click <strong>"Check Status"</strong>, and click <strong>"Print Test Ticket"</strong>!
                </div>
              </div>
            )}
          </div>
        )}

        {/* DETAILS FOR MODE 2: WEBUSB */}
        {config.mode === 'WEBUSB' && (
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-extrabold text-amber-950 text-xs flex items-center gap-1.5">
                  <span>Direct WebUSB Browser Pairing</span>
                </h4>
                <p className="text-[11px] text-amber-900/80 mt-0.5">
                  Pair your physically connected USB printer once. The browser will stream receipts directly over USB.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePairWebUsb}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Usb className="w-3.5 h-3.5" />
                  <span>{pairedDevice ? 'Change / Re-pair USB Printer' : 'Pair This PC\'s USB Printer'}</span>
                </button>
                {pairedDevice && (
                  <button
                    type="button"
                    onClick={handleForgetWebUsb}
                    className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Unpair
                  </button>
                )}
              </div>
            </div>

            {pairedDevice ? (
              <div className="p-3 bg-white rounded-lg border border-amber-200 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <div className="text-[11px]">
                  <div className="font-bold text-slate-800">Paired: {pairedDevice.productName}</div>
                  <div className="text-slate-500 font-mono text-[10px]">
                    Vendor ID: 0x{pairedDevice.vendorId?.toString(16)} | Product ID: 0x{pairedDevice.productId?.toString(16)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-white rounded-lg border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                Click <strong>"Pair This PC's USB Printer"</strong> above. A browser popup will appear — choose your <strong>BlackCopper</strong> or <strong>POS-80</strong> printer and click Connect.
              </div>
            )}
          </div>
        )}

        {/* DETAILS FOR MODE 3: SERVER WINDOWS SPOOLER */}
        {config.mode === 'USB' && (
          <div className="space-y-3 p-4 rounded-xl bg-blue-50/50 border border-blue-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label className="font-extrabold text-[#1F3F66] text-xs flex items-center gap-1.5">
                <span>Select Server Windows Spooler or Shared Printer:</span>
              </label>
              <button
                type="button"
                onClick={fetchPrinters}
                disabled={fetchingPrinters}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 hover:text-blue-950 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${fetchingPrinters ? 'animate-spin' : ''}`} />
                <span>{fetchingPrinters ? 'Scanning...' : 'Scan / Refresh Printers'}</span>
              </button>
            </div>

            <div className="relative">
              <select
                value={config.usbPrinterName}
                onChange={(e) => {
                  const next = { ...config, usbPrinterName: e.target.value };
                  setConfig(next);
                  handleSave(next);
                }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-blue-300 bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
              >
                {windowsPrinters.length > 0 ? (
                  windowsPrinters.map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name} {p.isDefault ? '★ [DEFAULT WINDOWS PRINTER]' : ''} — Port: {p.port || 'USB'}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="BlackCopper 80mm Series">BlackCopper 80mm Series</option>
                    <option value="BlackCopper 80mm Series(1)">BlackCopper 80mm Series(1)</option>
                    <option value="POS-80">POS-80 / POS-58 Thermal Printer</option>
                  </>
                )}
              </select>
            </div>

            <div className="text-[11px] text-blue-900/80 leading-relaxed">
              Target Printer: <strong className="font-mono text-blue-950 font-bold">{config.usbPrinterName}</strong>.
              Jobs will be printed through the Windows Print Spooler on the server machine.
            </div>
          </div>
        )}

        {/* Save & Test Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleSave()}
              className="px-4 py-2 rounded-lg bg-[#1F3F66] hover:bg-[#173252] text-white font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save for {departmentLabel}</span>
            </button>

            <button
              type="button"
              onClick={handlePrintTestTicket}
              disabled={testingTicket || printerTest.testing}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {testingTicket ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Print Test Ticket on THIS Computer</span>
            </button>

            <button
              type="button"
              onClick={handleTestConnection}
              disabled={printerTest.testing}
              className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all border border-slate-300 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {printerTest.testing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-slate-600" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" />
              )}
              <span>Check Status</span>
            </button>
          </div>

          {saveSuccess && (
            <div className="text-emerald-700 font-bold flex items-center gap-1.5 animate-in fade-in duration-200">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Settings saved for this workstation!</span>
            </div>
          )}
        </div>

        {/* Feedback / Status Alert Box */}
        {printerTest.message && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 transition-all ${
              printerTest.status === 'online'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : printerTest.status === 'offline'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            {printerTest.status === 'online' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
            {printerTest.status === 'offline' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
            {printerTest.testing && <RefreshCw className="w-4 h-4 text-amber-600 animate-spin shrink-0 mt-0.5" />}
            <div className="space-y-0.5">
              <div className="font-bold">
                {printerTest.status === 'online' ? 'Hardware Verified: Online' : printerTest.status === 'offline' ? 'Connection Notice' : 'Testing in Progress'}
              </div>
              <div className="text-[11px] leading-relaxed">{printerTest.message}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
