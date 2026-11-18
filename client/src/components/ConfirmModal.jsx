'use client';

import React from 'react';
import { AlertTriangle, Trash2, CheckCircle2, XCircle, Info, X } from 'lucide-react';

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmation Required',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger', // 'danger' | 'warning' | 'success' | 'info'
  loading = false,
  isAlertOnly = false
}) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-sky-600" />;
      case 'danger':
      default:
        return <XCircle className="w-5 h-5 text-rose-600" />;
    }
  };

  const getBadgeStyle = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'warning':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'info':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'danger':
      default:
        return 'bg-rose-50 text-rose-700 border-rose-200';
    }
  };

  const getConfirmBtnStyle = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-500/20';
      case 'info':
        return 'bg-sky-600 hover:bg-sky-700 text-white shadow-sky-500/20';
      case 'danger':
      default:
        return 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20';
    }
  };

  return (
    <div className="fixed inset-0 bg-[#1F3F66]/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl border border-[#B7D7F0] shadow-2xl max-w-sm w-full p-5 space-y-4 text-slate-800">
        
        {/* Modal Header */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner border ${getBadgeStyle()}`}>
              {getIcon()}
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-[#1F3F66]">{title}</h3>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hospital Notification</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="text-xs text-slate-700 leading-relaxed font-semibold bg-[#EDF6FF]/60 p-3.5 rounded-xl border border-[#B7D7F0]/60">
          {message}
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end gap-2.5 pt-2 border-t border-[#B7D7F0]/60">
          {!isAlertOnly && (
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-colors"
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            onClick={onConfirm || onClose}
            disabled={loading}
            className={`px-5 py-2 text-xs font-extrabold rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-2 ${getConfirmBtnStyle()}`}
          >
            {loading ? (
              <span>Processing...</span>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
