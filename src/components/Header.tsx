import React from 'react';
import { FileText, Search, ShieldCheck, Coins, LogOut, UserCheck, Moon, Sun, Lock } from 'lucide-react';
import { AuthUser, UserRole } from '../types';

interface HeaderProps {
  activeTab: 'form' | 'status' | 'admin' | 'finance';
  setActiveTab: (tab: 'form' | 'status' | 'admin' | 'finance') => void;
  registrationsCount: number;
  chargedRegistrationsCount?: number;
  currentUser: AuthUser | null;
  onLogout: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  onOpenLoginModal?: (role?: UserRole) => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  activeTab, 
  setActiveTab, 
  registrationsCount,
  chargedRegistrationsCount = 0,
  currentUser,
  onLogout,
  isDarkMode,
  onToggleDarkMode,
  onOpenLoginModal
}) => {
  return (
    <header className="sticky top-0 z-40 print:hidden shadow-xs">
      {/* Behance Modern Dark Pitch Top Bar */}
      <div className="bg-[#141414]/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md text-white border-b border-[#262626] transition-colors duration-150">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-16 sm:h-17 gap-2 sm:gap-4">
            
            {/* Campus Identity with Official INSTIPER Logo */}
            <div 
              className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none shrink-0 group"
              onClick={() => setActiveTab('form')}
              title="Kembali ke Beranda Formulir Pendaftaran"
            >
              <img
                src="/logo_instiper.png"
                alt="Logo Resmi INSTIPER Yogyakarta"
                className="w-9 h-9 sm:w-11 sm:h-11 object-contain shrink-0 drop-shadow-xs transition-transform group-hover:scale-105"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-xs sm:text-sm tracking-wider text-white uppercase truncate">
                    INSTIPER
                  </span>
                  <span className="text-[10px] bg-amber-400 text-slate-950 font-black px-1.5 py-0.5 rounded-md shrink-0 shadow-2xs">
                    FAPERTA
                  </span>
                </div>
                <span className="text-[10px] sm:text-xs text-neutral-400 font-medium block -mt-0.5 truncate max-w-[170px] sm:max-w-none">
                  Pendaftaran Mengulang MK
                </span>
              </div>
            </div>

            {/* Desktop Navigation Tabs (Behance Pill Style) */}
            <nav className="hidden lg:flex items-center gap-2 py-1">
              
              {/* Tab: Form Pendaftaran */}
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[40px] ${
                  activeTab === 'form'
                    ? 'bg-white text-slate-950 shadow-sm font-extrabold ring-1 ring-white/20'
                    : 'text-neutral-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Form Pendaftaran</span>
              </button>

              {/* Tab: Cek & Cetak Hasil */}
              <button
                type="button"
                onClick={() => setActiveTab('status')}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[40px] ${
                  activeTab === 'status'
                    ? 'bg-white text-slate-950 shadow-sm font-extrabold ring-1 ring-white/20'
                    : 'text-neutral-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Search className="w-4 h-4" />
                <span>Cek &amp; Cetak Hasil</span>
              </button>

              {/* Admin Tabs — HANYA tampil jika Staf/Pengelola SUDAH Login */}
              {currentUser && currentUser.role === 'baak' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[40px] ${
                    activeTab === 'admin'
                      ? 'bg-white text-slate-950 shadow-sm font-extrabold ring-1 ring-amber-400/40'
                      : 'text-neutral-300 hover:text-white hover:bg-white/10'
                  }`}
                  title="Panel Operasional Akademik & Pendaftar Fakultas"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Admin Fakultas</span>
                  {registrationsCount > 0 && (
                    <span className="px-2 py-0.5 bg-neutral-800 text-white text-[10px] rounded-full font-bold border border-neutral-700">
                      {registrationsCount}
                    </span>
                  )}
                </button>
              )}

              {currentUser && currentUser.role === 'superadmin' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[40px] ${
                    activeTab === 'admin'
                      ? 'bg-white text-slate-950 shadow-sm font-extrabold ring-1 ring-amber-400/40'
                      : 'text-neutral-300 hover:text-white hover:bg-white/10'
                  }`}
                  title="Portal Pengelola Lengkap (Admin Fakultas & Superadmin Kredensial)"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Portal Pengelola</span>
                  <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 text-[9px] font-black rounded-md">
                    SUPER
                  </span>
                  {registrationsCount > 0 && (
                    <span className="px-2 py-0.5 bg-neutral-800 text-white text-[10px] rounded-full font-bold border border-neutral-700">
                      {registrationsCount}
                    </span>
                  )}
                </button>
              )}

              {currentUser && currentUser.role === 'kaprodi' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[40px] ${
                    activeTab === 'admin'
                      ? 'bg-white text-slate-950 shadow-sm font-extrabold ring-1 ring-amber-400/40'
                      : 'text-neutral-300 hover:text-white hover:bg-white/10'
                  }`}
                  title={`Portal Monitoring Kaprodi (${currentUser.title})`}
                >
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Portal Kaprodi</span>
                  {registrationsCount > 0 && (
                    <span className="px-2 py-0.5 bg-neutral-800 text-white text-[10px] rounded-full font-bold border border-neutral-700">
                      {registrationsCount}
                    </span>
                  )}
                </button>
              )}

              {currentUser && (currentUser.role === 'finance' || currentUser.role === 'superadmin') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('finance')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[40px] ${
                    activeTab === 'finance'
                      ? 'bg-white text-slate-950 shadow-sm font-extrabold ring-1 ring-amber-400/40'
                      : 'text-neutral-300 hover:text-white hover:bg-white/10'
                  }`}
                  title="Panel Khusus Admin Keuangan: Data Pendaftar Kena Biaya SKS"
                >
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>Keuangan</span>
                  {chargedRegistrationsCount > 0 && (
                    <span className="px-2 py-0.5 bg-amber-400 text-slate-950 font-black text-[10px] rounded-full shadow-xs">
                      {chargedRegistrationsCount}
                    </span>
                  )}
                </button>
              )}
            </nav>

            {/* Right Controls: Behance Style Action Button + Dark Mode Toggle + User Profile */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">

              {/* Behance Style Staff Login Pill (When Not Logged In) */}
              {!currentUser && onOpenLoginModal && (
                <button
                  type="button"
                  onClick={() => onOpenLoginModal('baak')}
                  className="hidden md:inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold bg-[#0057ff] hover:bg-[#0047d4] text-white shadow-sm transition-all cursor-pointer hover:scale-102 active:scale-95"
                  title="Akses Portal Pengelola Khusus Staf BAAK & Keuangan"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Portal Staf</span>
                </button>
              )}

              {/* Behance Circular Theme Toggle Button (Light/Dark) */}
              <button
                type="button"
                onClick={onToggleDarkMode}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full text-white/90 hover:text-white hover:bg-white/15 bg-white/5 flex items-center justify-center transition-all cursor-pointer shrink-0 border border-white/10 active:scale-95 shadow-2xs"
                title={isDarkMode ? 'Beralih ke Mode Terang (Light Mode)' : 'Beralih ke Mode Gelap (Dark Mode)'}
                aria-label="Toggle tema gelap terang"
              >
                {isDarkMode ? (
                  <Sun className="w-4 h-4 text-amber-300 transition-transform duration-200 rotate-0" />
                ) : (
                  <Moon className="w-4 h-4 text-white transition-transform duration-200" />
                )}
              </button>

              {/* User Logged In Profile Pill (Behance Style) */}
              {currentUser && (
                <div className="flex items-center gap-1.5 sm:gap-2 pl-1 sm:pl-2 border-l border-white/15 shrink-0">
                  <div 
                    className="px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 bg-white/10 text-white border border-white/15"
                    title={`Login sebagai ${currentUser.name} (${currentUser.title})`}
                  >
                    <UserCheck className="w-3.5 h-3.5 text-amber-300" />
                    <span className="hidden sm:inline font-semibold">{currentUser.title}</span>
                    <span className="sm:hidden capitalize">{currentUser.role}</span>
                  </div>

                  <button
                    type="button"
                    onClick={onLogout}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full text-white/80 hover:text-white hover:bg-rose-600/80 bg-white/5 flex items-center justify-center transition-colors cursor-pointer shrink-0 active:scale-95 border border-white/10"
                    title="Logout / Keluar"
                    aria-label="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              )}

            </div>

          </div>
        </div>

        {/* Mobile Navigation Bar (Behance Style Rounded Pills) */}
        {currentUser ? (
          <div className="lg:hidden bg-[#0e0e0e] dark:bg-[#070707] border-t border-[#262626] px-2 sm:px-4 py-2 transition-colors duration-150">
            <nav className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 touch-pan-x">
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[36px] active:scale-95 ${
                  activeTab === 'form'
                    ? 'bg-white text-slate-950 shadow-sm font-extrabold'
                    : 'text-neutral-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Formulir</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('status')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[36px] active:scale-95 ${
                  activeTab === 'status'
                    ? 'bg-white text-slate-950 shadow-sm font-extrabold'
                    : 'text-neutral-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Search className="w-4 h-4" />
                <span>Status</span>
              </button>

              {(currentUser.role === 'baak' || currentUser.role === 'superadmin' || currentUser.role === 'kaprodi') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[36px] active:scale-95 ${
                    activeTab === 'admin'
                      ? 'bg-white text-slate-950 shadow-sm font-extrabold ring-1 ring-amber-400/40'
                      : 'text-neutral-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>Admin</span>
                  {registrationsCount > 0 && (
                    <span className="px-2 py-0.2 bg-neutral-800 text-white text-[10px] rounded-full font-bold border border-neutral-700">
                      {registrationsCount}
                    </span>
                  )}
                </button>
              )}

              {(currentUser.role === 'finance' || currentUser.role === 'superadmin') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('finance')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[36px] active:scale-95 ${
                    activeTab === 'finance'
                      ? 'bg-white text-slate-950 shadow-sm font-extrabold ring-1 ring-amber-400/40'
                      : 'text-neutral-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>Keuangan</span>
                  {chargedRegistrationsCount > 0 && (
                    <span className="px-2 py-0.2 bg-amber-400 text-slate-950 font-bold text-[10px] rounded-full">
                      {chargedRegistrationsCount}
                    </span>
                  )}
                </button>
              )}
            </nav>
          </div>
        ) : (
          <div className="lg:hidden bg-[#0e0e0e] dark:bg-[#070707] border-t border-[#262626] px-3 py-2 transition-colors duration-150">
            <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-full text-xs font-bold transition-all cursor-pointer min-h-[40px] active:scale-95 ${
                  activeTab === 'form'
                    ? 'bg-white text-slate-950 shadow-sm font-extrabold ring-1 ring-white/40'
                    : 'text-neutral-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Form Pendaftaran</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('status')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-full text-xs font-bold transition-all cursor-pointer min-h-[40px] active:scale-95 ${
                  activeTab === 'status'
                    ? 'bg-white text-slate-950 shadow-sm font-extrabold ring-1 ring-white/40'
                    : 'text-neutral-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <Search className="w-4 h-4" />
                <span>Cek &amp; Cetak KRS</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Subtle Slim Bottom Accent Line */}
      <div className="h-[2px] bg-gradient-to-r from-emerald-600 via-amber-400 to-emerald-600 w-full opacity-60" />
    </header>
  );
};
