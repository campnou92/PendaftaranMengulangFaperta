import React, { useState } from 'react';
import { AuthUser, UserRole } from '../types';
import { Lock, User, KeyRound, X, LogIn, AlertCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { InstiperLogo } from './InstiperLogo';
import { authenticateUser } from '../utils/userManagement';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: AuthUser) => void;
  defaultRoleHint?: UserRole;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const result = await authenticateUser(username, password);

      if (result.success && result.user) {
        onLoginSuccess(result.user);
        // Reset form after successful login
        setUsername('');
        setPassword('');
      } else {
        setErrorMsg(result.message || 'Username atau password tidak sesuai.');
      }
    } catch (err) {
      setErrorMsg('Terjadi kesalahan sistem saat verifikasi. Silakan coba lagi.');
      console.error('Login error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setUsername('');
    setPassword('');
    setErrorMsg(null);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden relative">
        
        {/* Subtle Signature Yellow Accent Line */}
        <div className="h-1 bg-[#FFE600] w-full" />

        {/* Modal Header with INSTIPER Branding */}
        <div className="bg-[#009A44] text-white p-6 relative">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Tutup Dialog Login"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-white/20 border border-white/30 rounded-xl shadow-xs shrink-0 flex items-center justify-center text-white">
              <ShieldCheck className="w-6 h-6 text-yellow-300" />
            </div>
            <div>
              <span className="text-[10px] font-bold tracking-widest uppercase text-yellow-300 block">
                Institut Pertanian Stiper
              </span>
              <h3 className="text-base font-black text-white leading-tight">
                Login Portal Pengelola
              </h3>
              <p className="text-xs text-white/85 mt-0.5">
                Akses Terproteksi Khusus Staf & Admin
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body with Confidential Inputs */}
        <div className="p-6 instiper-academic-pattern">
          
          <div className="mb-5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xs p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#009A44] dark:text-[#05B752] shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Halaman ini bersifat <strong>rahasia dan kredensial</strong>. Kredensial akun dikelola langsung oleh <strong>Superadmin Fakultas</strong>.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2.5 text-xs font-semibold text-[#E4202A] dark:text-red-300">
                <AlertCircle className="w-4 h-4 text-[#E4202A] shrink-0 mt-0.5" />
                <span className="leading-snug">{errorMsg}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                Username Akun
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username..."
                  className="w-full pl-9 pr-3 py-2.5 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#009A44] bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password..."
                  className="w-full pl-9 pr-10 py-2.5 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#009A44] bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleClose}
                className="w-1/3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-2/3 py-2.5 rounded-xl bg-[#009A44] hover:bg-[#00702F] text-white text-xs font-bold shadow-md hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>{isSubmitting ? 'Memeriksa...' : 'Masuk Sekarang'}</span>
              </button>
            </div>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 text-center">
            Fakultas Pertanian — Institut Pertanian Stiper Yogyakarta
          </div>
        </div>
      </div>
    </div>
  );
};
