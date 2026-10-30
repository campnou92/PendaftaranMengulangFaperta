import React, { useState } from 'react';
import { AuthUser, UserRole } from '../types';
import { User, KeyRound, X, LogIn, AlertCircle, Eye, EyeOff, ShieldCheck, Sparkles } from 'lucide-react';
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
  onLoginSuccess,
  defaultRoleHint
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md transition-all duration-300"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 overflow-hidden transform transition-all duration-300 scale-100">
        
        {/* Subtle Decorative Golden Gradient Top Bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-yellow-300 to-emerald-400" />

        {/* Modal Header with Rich Forest Green Gradient & Institutional Seal */}
        <div className="relative bg-gradient-to-br from-[#0c4a24] via-[#105d2e] to-[#093519] text-white p-7 overflow-hidden">
          {/* Subtle Ambient Radial Lighting in Background */}
          <div className="absolute -top-16 -right-16 w-44 h-44 rounded-full bg-emerald-400/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-amber-400/10 blur-xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-all duration-200 cursor-pointer active:scale-95"
            aria-label="Tutup Dialog Login"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4 relative z-10">
            {/* Logo Badge with Glass Border */}
            <div className="w-13 h-13 rounded-2xl bg-white/10 backdrop-blur-md border border-white/25 p-2 flex items-center justify-center shadow-lg shadow-black/10 shrink-0">
              <InstiperLogo size={36} className="filter drop-shadow-md" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase bg-amber-400/20 text-amber-300 border border-amber-400/30">
                <Sparkles className="w-2.5 h-2.5" />
                INSTIPER YOGYAKARTA
              </span>
              <h3 className="text-lg font-black text-white tracking-tight leading-snug mt-1">
                {defaultRoleHint === 'finance' ? 'Portal Keuangan' : 'Portal Pengelola'}
              </h3>
              <p className="text-xs text-emerald-100/80 font-medium">
                {defaultRoleHint === 'finance' ? 'Akses Khusus Verifikasi Keuangan' : 'Akses Terproteksi Khusus Staf & BAAK'}
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body - Clean, Smooth & Elegant */}
        <div className="p-7 bg-white dark:bg-slate-900">
          
          {/* Confidential Notice Card */}
          <div className="mb-5 bg-gradient-to-r from-emerald-50/80 to-slate-50 dark:from-emerald-950/30 dark:to-slate-800/50 p-3.5 rounded-2xl border border-emerald-100 dark:border-emerald-900/50 flex items-start gap-3 shadow-xs">
            <div className="p-1.5 rounded-xl bg-emerald-100/70 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              Akses bersifat <strong className="text-slate-900 dark:text-white font-bold">rahasia &amp; terenkripsi</strong>. Kredensial akun dikelola oleh <strong>Superadmin Fakultas</strong>.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-2xl flex items-start gap-3 text-xs font-semibold text-rose-700 dark:text-rose-300 animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{errorMsg}</span>
              </div>
            )}

            {/* Username Input */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Username Akun
              </label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 dark:group-focus-within:text-emerald-400 transition-colors pointer-events-none">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username..."
                  className="w-full pl-11 pr-4 py-3 text-xs font-medium rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/70 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-xs"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-600 dark:group-focus-within:text-emerald-400 transition-colors pointer-events-none">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password..."
                  className="w-full pl-11 pr-11 py-3 text-xs font-medium rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/70 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition-colors cursor-pointer"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="w-1/3 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100/80 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all duration-200 cursor-pointer active:scale-98"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-2/3 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white text-xs font-bold shadow-lg shadow-emerald-700/25 hover:shadow-xl hover:shadow-emerald-600/35 active:scale-98 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <LogIn className="w-4 h-4" />
                <span>{isSubmitting ? 'Memverifikasi...' : 'Masuk Sekarang'}</span>
              </button>
            </div>
          </form>

          {/* Footer Subtext */}
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] font-medium text-slate-400 dark:text-slate-500 text-center tracking-wide">
            Fakultas Pertanian &bull; Institut Pertanian Stiper Yogyakarta
          </div>
        </div>
      </div>
    </div>
  );
};
