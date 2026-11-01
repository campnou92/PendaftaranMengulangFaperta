import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-xl mx-auto my-12 p-6 sm:p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-md border border-rose-200 dark:border-rose-900/60 text-center animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center mb-4 shadow-sm">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white mb-2">
            {this.props.fallbackTitle || 'Terjadi Kendala Saat Memuat Halaman'}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
            Sistem mendeteksi kendala pada antarmuka. Silakan coba muat ulang atau kembali ke formulir pendaftaran.
          </p>
          {this.state.error && (
            <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-left font-mono text-[11px] text-rose-700 dark:text-rose-300 mb-5 overflow-x-auto max-h-32 border border-slate-200 dark:border-slate-700">
              {this.state.error.message || String(this.state.error)}
            </div>
          )}
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="px-4 py-2.5 bg-[#008744] hover:bg-[#00702F] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Muat Ulang Panel</span>
            </button>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = window.location.pathname;
              }}
              className="px-4 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer flex items-center gap-2 transition-all"
            >
              <Home className="w-4 h-4" />
              <span>Ke Beranda</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

