'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle2, AlertCircle, Info, ShieldAlert } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

interface ConfirmConfig {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  resolve: (value: boolean) => void;
}

interface NotificationContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
  showConfirm: (message: string, options?: { title?: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean }) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const showConfirm = useCallback((message: string, options?: { title?: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean }) => {
    return new Promise<boolean>((resolve) => {
      setConfirmConfig({
        title: options?.title || 'Confirm Action',
        message,
        confirmLabel: options?.confirmLabel || 'Confirm',
        cancelLabel: options?.cancelLabel || 'Cancel',
        destructive: options?.destructive ?? false,
        resolve: (val) => {
          setConfirmConfig(null);
          resolve(val);
        }
      });
    });
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <NotificationContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {/* Sleek Toast Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-xl border bg-white shadow-lg animate-in slide-in-from-bottom-5 duration-200 ${
              toast.type === 'success' ? 'border-emerald-200 text-emerald-800' :
              toast.type === 'error' ? 'border-red-200 text-red-800' :
              'border-slate-200 text-slate-800'
            }`}
          >
            {toast.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />}
            {toast.type === 'error' && <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />}
            {toast.type === 'info' && <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />}
            
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold leading-relaxed break-words">{toast.message}</p>
            </div>
            
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Sleek Confirm Dialog Modal */}
      {confirmConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-155">
            <div className="flex items-center gap-2.5 text-slate-800">
              <ShieldAlert className={`h-5 w-5 ${confirmConfig.destructive ? 'text-red-500' : 'text-indigo-500'}`} />
              <h3 className="text-sm font-bold uppercase tracking-wider">{confirmConfig.title}</h3>
            </div>
            
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              {confirmConfig.message}
            </p>
            
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => confirmConfig.resolve(false)}
                className="px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
              >
                {confirmConfig.cancelLabel}
              </button>
              <button
                onClick={() => confirmConfig.resolve(true)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm transition-colors cursor-pointer ${
                  confirmConfig.destructive
                    ? 'bg-red-600 hover:bg-red-500'
                    : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {confirmConfig.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
