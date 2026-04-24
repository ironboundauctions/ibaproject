import React from 'react';
import { AlertTriangle, Trash2, X, CheckCircle, Info, RotateCcw } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success' | 'restore';
  alertOnly?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  detail,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  alertOnly = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const iconBg = {
    danger: 'bg-red-100 text-red-600',
    warning: 'bg-amber-100 text-amber-600',
    info: 'bg-blue-100 text-blue-600',
    success: 'bg-green-100 text-green-600',
    restore: 'bg-teal-100 text-teal-600',
  };

  const confirmColors = {
    danger: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
    warning: 'bg-amber-500 hover:bg-amber-600 focus:ring-amber-400',
    info: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    success: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
    restore: 'bg-teal-600 hover:bg-teal-700 focus:ring-teal-500',
  };

  const detailBg = {
    danger: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    info: 'bg-blue-50 border-blue-200',
    success: 'bg-green-50 border-green-200',
    restore: 'bg-teal-50 border-teal-200',
  };

  const detailText = {
    danger: 'text-red-800',
    warning: 'text-amber-800',
    info: 'text-blue-800',
    success: 'text-green-800',
    restore: 'text-teal-800',
  };

  const Icon = () => {
    if (variant === 'danger') return <Trash2 className="h-6 w-6" />;
    if (variant === 'success') return <CheckCircle className="h-6 w-6" />;
    if (variant === 'restore') return <RotateCcw className="h-6 w-6" />;
    if (variant === 'info') return <Info className="h-6 w-6" />;
    return <AlertTriangle className="h-6 w-6" />;
  };

  const handleBackdropClick = () => {
    if (alertOnly) onConfirm();
    else onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleBackdropClick}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <button
          onClick={alertOnly ? onConfirm : onCancel}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="p-6">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${iconBg[variant]}`}>
            <Icon />
          </div>

          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-gray-600 text-sm leading-relaxed">{message}</p>

          {detail && (
            <div className={`mt-3 p-3 border rounded-lg ${detailBg[variant]}`}>
              <p className={`text-sm leading-relaxed ${detailText[variant]}`}>{detail}</p>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3 justify-end">
          {!alertOnly && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              {cancelLabel}
            </button>
          )}
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${confirmColors[variant]}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
