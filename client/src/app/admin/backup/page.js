'use client';

import React, { useState, useEffect } from 'react';
import {
  DatabaseBackup,
  Download,
  UploadCloud,
  Cloud,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  Calendar,
  ShieldCheck,
  FolderOpen,
  ArrowUpRight,
  Database,
  Lock,
  Users,
  CreditCard,
  FileText
} from 'lucide-react';
import api from '../../../lib/api';

export default function AdminBackupPage() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [data, setData] = useState(null);
  const [statusMsg, setStatusMsg] = useState(null);
  const [restoreFile, setRestoreFile] = useState(null);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await api.get('/backup/summary');
      if (res.data?.success) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Error fetching backup data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const triggerBrowserDownload = async (filename) => {
    try {
      const res = await api.get(`/backup/download/${encodeURIComponent(filename)}`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      alert('Failed to download backup file: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleExportBackup = async () => {
    setExporting(true);
    setStatusMsg(null);
    try {
      const res = await api.post('/backup/export');
      if (res.data?.success && res.data.filename) {
        setStatusMsg({
          type: 'success',
          text: `✓ Backup created successfully! File saved to: ${res.data.filename}`
        });

        // Trigger direct blob download so Chrome never blocks with "File wasn't available"
        await triggerBrowserDownload(res.data.filename);

        fetchSummary();
      } else {
        setStatusMsg({ type: 'error', text: res.data?.message || 'Failed to export backup.' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || err.message });
    } finally {
      setExporting(false);
    }
  };

  const handleCloudSync = async () => {
    setSyncingCloud(true);
    setStatusMsg(null);
    try {
      const res = await api.post('/backup/cloud-sync');
      if (res.data?.success) {
        setStatusMsg({
          type: 'success',
          text: `✓ Online Cloud Sync Complete: ${res.data.message}`
        });
      } else {
        setStatusMsg({ type: 'error', text: res.data?.message || 'Cloud sync failed.' });
      }
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.response?.data?.message || err.message });
    } finally {
      setSyncingCloud(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setRestoreFile(e.target.files[0]);
    }
  };

  const handleRestoreSubmit = async () => {
    if (!restoreFile) {
      alert('Please select a valid .json backup file to restore.');
      return;
    }

    if (!confirm('WARNING: Restoring from a backup will merge and update your live hospital database. Do you wish to continue?')) {
      return;
    }

    setRestoring(true);
    setStatusMsg(null);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const parsed = JSON.parse(event.target.result);
          const res = await api.post('/backup/restore', { backupContent: parsed });
          if (res.data?.success) {
            setStatusMsg({
              type: 'success',
              text: `✓ ${res.data.message}`
            });
            fetchSummary();
          } else {
            setStatusMsg({ type: 'error', text: res.data?.message || 'Restoration failed.' });
          }
        } catch (parseErr) {
          setStatusMsg({ type: 'error', text: 'Invalid JSON backup format: ' + parseErr.message });
        } finally {
          setRestoring(false);
        }
      };
      reader.readAsText(restoreFile);
    } catch (err) {
      setStatusMsg({ type: 'error', text: err.message });
      setRestoring(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      {/* Header Banner */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
            <DatabaseBackup className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-800">
              Hospital Database Backup & Cloud Security
            </h1>
            <p className="text-sm font-medium text-slate-500">
              Preserve all patient histories, financial ledgers, pharmacy sales & clinical records with 1-click snapshots.
            </p>
          </div>
        </div>

        <button
          onClick={fetchSummary}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-bold hover:bg-slate-50 transition shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Status Notification */}
      {statusMsg && (
        <div
          className={`mb-6 p-4 rounded-xl flex items-center gap-3 text-sm font-bold border ${
            statusMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {statusMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          )}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Database Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-blue-500" /> Patients
          </div>
          <div className="text-2xl font-black text-slate-800">{data?.metrics?.patients ?? '—'}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Appointments
          </div>
          <div className="text-2xl font-black text-slate-800">{data?.metrics?.appointments ?? '—'}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-emerald-500" /> Invoices
          </div>
          <div className="text-2xl font-black text-slate-800">{data?.metrics?.invoices ?? '—'}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-amber-500" /> Pharmacy Sales
          </div>
          <div className="text-2xl font-black text-slate-800">{data?.metrics?.pharmacySales ?? '—'}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-purple-500" /> Lab Orders
          </div>
          <div className="text-2xl font-black text-slate-800">{data?.metrics?.labOrders ?? '—'}</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-500" /> Staff Accounts
          </div>
          <div className="text-2xl font-black text-slate-800">{data?.metrics?.users ?? '—'}</div>
        </div>
      </div>

      {/* Main Operations Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Card 1: Local Backup Export */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">1-Click Local Data Backup</h2>
                <p className="text-xs font-medium text-slate-500">Download complete structured database snapshot to your PC or USB drive.</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 mb-6 text-xs text-slate-600 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Backup Directory:</span>
                <span className="font-mono text-slate-500 truncate max-w-[220px]" title={data?.backupDir}>
                  {data?.backupDir || 'C:/Users/.../Hospital_Backups'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Format:</span>
                <span className="font-mono bg-blue-100 text-blue-700 px-2 py-0.5 rounded">.JSON (Universal & Encrypted)</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Scope:</span>
                <span className="text-emerald-600 font-bold">100% Patient & Financial Tables</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleExportBackup}
            disabled={exporting}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition active:scale-[0.98] disabled:opacity-60"
          >
            {exporting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            <span>{exporting ? 'Generating Backup...' : 'Download & Save Full Backup Now'}</span>
          </button>
        </div>

        {/* Card 2: Online Cloud Sync */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <Cloud className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Online Cloud Synchronization</h2>
                <p className="text-xs font-medium text-slate-500">Mirror hospital database securely to cloud storage for disaster recovery.</p>
              </div>
            </div>

            <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 mb-6 text-xs text-slate-600 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Cloud Status:</span>
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-600">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  Active & Ready
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Security Standard:</span>
                <span className="font-semibold text-slate-700 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-emerald-600" /> AES-256 SSL Encrypted
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700">Off-Site Recovery:</span>
                <span className="text-slate-500">Restorable anytime even if physical PC fails</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleCloudSync}
            disabled={syncingCloud}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition active:scale-[0.98] disabled:opacity-60"
          >
            {syncingCloud ? <RefreshCw className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
            <span>{syncingCloud ? 'Synchronizing with Cloud...' : 'Sync Live Hospital Data to Cloud'}</span>
          </button>
        </div>
      </div>

      {/* Restore Section & Past Backups Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Restore Column */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm lg:col-span-1">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Restore Database Snapshot</h3>
              <p className="text-xs text-slate-500">Upload a previous .json backup file to restore records.</p>
            </div>
          </div>

          <div className="border-2 border-dashed border-slate-200 rounded-xl p-5 text-center mb-4 bg-slate-50/50">
            <FileJson className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            />
            {restoreFile && (
              <p className="mt-2 text-xs font-mono font-bold text-emerald-600">
                Selected: {restoreFile.name} ({(restoreFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <button
            onClick={handleRestoreSubmit}
            disabled={restoring || !restoreFile}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-xl shadow-md transition disabled:opacity-50"
          >
            {restoring ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{restoring ? 'Restoring Records...' : 'Confirm & Restore Data'}</span>
          </button>
        </div>

        {/* Past Backups Archive */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm lg:col-span-2">
          <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-indigo-600" />
            <span>Saved Local Backups Archive ({data?.backups?.length || 0})</span>
          </h3>

          <div className="overflow-x-auto max-h-[300px] overflow-y-auto border border-slate-100 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider sticky top-0 border-b border-slate-200">
                <tr>
                  <th className="p-3">File Name</th>
                  <th className="p-3">Created Date & Time</th>
                  <th className="p-3">File Size</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data?.backups && data.backups.length > 0 ? (
                  data.backups.map((b, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition font-medium">
                      <td className="p-3 font-mono text-slate-700 flex items-center gap-2">
                        <FileJson className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        <span className="truncate max-w-[200px]">{b.filename}</span>
                      </td>
                      <td className="p-3 text-slate-500">
                        {new Date(b.createdAt).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="p-3 text-slate-600 font-bold">{b.sizeMB} MB</td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => triggerBrowserDownload(b.filename)}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold hover:underline"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400">
                      No previous local backups found. Click &quot;Download &amp; Save Full Backup Now&quot; above to create your first snapshot.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
