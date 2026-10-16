import React from 'react';
import { FileText, Search, ShieldCheck, Coins, LogIn, LogOut, UserCheck, Moon, Sun, Cloud } from 'lucide-react';
import { AuthUser, UserRole } from '../types';

interface HeaderProps {
  activeTab: 'form' | 'status' | 'admin' | 'finance';
  setActiveTab: (tab: 'form' | 'status' | 'admin' | 'finance') => void;
  registrationsCount: number;
  chargedRegistrationsCount?: number;
  currentUser: AuthUser | null;
  onOpenLogin: (roleHint?: UserRole) => void;
  onLogout: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  isCloudConnected?: boolean | null;
}

export const Header: React.FC<HeaderProps> = ({ 
  activeTab, 
  setActiveTab, 
  registrationsCount,
  chargedRegistrationsCount = 0,
  currentUser,
  onOpenLogin,
  onLogout,
  isDarkMode,
  onToggleDarkMode,
  isCloudConnected = true
}) => {
  return (
    <header className="sticky top-0 z-40 print:hidden shadow-md">
      {/* Main Bar */}
      <div className="bg-[#166534] dark:bg-[#0F1F15] text-white border-b border-[#14532D] dark:border-[#1E3A28] transition-colors duration-150">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-16 sm:h-17 gap-2 sm:gap-4">
            
              {/* Campus Identity with Official INSTIPER Logo */}
              <div 
                className="flex items-center gap-2.5 sm:gap-3 cursor-pointer select-none shrink-0"
                onClick={() => setActiveTab('form')}
                title="Kembali ke Beranda Formulir Pendaftaran"
              >
                <img
                  src="/logo_instiper.png"
                  alt="Logo Resmi INSTIPER Yogyakarta"
                  className="w-9 h-9 sm:w-11 sm:h-11 object-contain shrink-0 drop-shadow-xs"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-xs sm:text-sm tracking-wider text-white uppercase truncate">
                      INSTIPER
                    </span>
                    <span className="text-[10px] bg-[#EAB308] text-slate-950 font-black px-1.5 py-0.5 rounded-md shrink-0 shadow-2xs">
                      FAPERTA
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-xs text-white/80 font-medium block -mt-0.5 truncate max-w-[170px] sm:max-w-none">
                    Pendaftaran Mengulang MK
                  </span>
                </div>
              </div>

              {/* Desktop Navigation Tabs */}
              <nav className="hidden lg:flex items-center gap-1.5 py-1">
                
                {/* Tab: Form Pendaftaran */}
                <button
                  type="button"
                  onClick={() => setActiveTab('form')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[44px] ${
                    activeTab === 'form'
                      ? 'bg-white text-[#166534] shadow-sm font-extrabold'
                      : 'text-white/90 hover:text-white hover:bg-white/15'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Form Pendaftaran</span>
                </button>

                {/* Tab: Cek & Cetak Hasil */}
                <button
                  type="button"
                  onClick={() => setActiveTab('status')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[40px] ${
                    activeTab === 'status'
                      ? 'bg-white text-[#166534] shadow-sm font-extrabold'
                      : 'text-white/90 hover:text-white hover:bg-white/15'
                  }`}
                >
                  <Search className="w-4 h-4" />
                  <span>Cek &amp; Cetak Hasil</span>
                </button>

                {/* Admin Tabs — HANYA tampil jika Staf/Pengelola SUDAH Login (Akses Khusus Admin) */}
                {currentUser && currentUser.role === 'baak' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('admin')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[40px] ${
                      activeTab === 'admin'
                        ? 'bg-white text-[#166534] shadow-sm font-extrabold ring-1 ring-[#EAB308]'
                        : 'text-white/90 hover:text-white hover:bg-white/15'
                    }`}
                    title="Panel Operasional Akademik & Pendaftar BAAK"
                  >
                    <ShieldCheck className="w-4 h-4 text-[#FDE047]" />
                    <span>Admin BAAK</span>
                    {registrationsCount > 0 && (
                      <span className="px-1.5 py-0.2 bg-black/30 text-white text-[10px] rounded-full font-bold">
                        {registrationsCount}
                      </span>
                    )}
                  </button>
                )}

                {currentUser && currentUser.role === 'superadmin' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('admin')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[40px] ${
                      activeTab === 'admin'
                        ? 'bg-white text-[#166534] shadow-sm font-extrabold ring-1 ring-[#EAB308]'
                        : 'text-white/90 hover:text-white hover:bg-white/15'
                    }`}
                    title="Portal Pengelola Lengkap (BAAK & Superadmin Kredensial)"
                  >
                    <ShieldCheck className="w-4 h-4 text-[#FDE047]" />
                    <span>Portal Pengelola</span>
                    <span className="px-1.5 py-0.2 bg-[#EAB308] text-slate-950 text-[9px] font-black rounded-md">
                      SUPER
                    </span>
                    {registrationsCount > 0 && (
                      <span className="px-1.5 py-0.2 bg-black/30 text-white text-[10px] rounded-full font-bold">
                        {registrationsCount}
                      </span>
                    )}
                  </button>
                )}

                {currentUser && currentUser.role === 'kaprodi' && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('admin')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[40px] ${
                      activeTab === 'admin'
                        ? 'bg-white text-[#166534] shadow-sm font-extrabold ring-1 ring-[#EAB308]'
                        : 'text-white/90 hover:text-white hover:bg-white/15'
                    }`}
                    title={`Portal Monitoring Kaprodi (${currentUser.title})`}
                  >
                    <ShieldCheck className="w-4 h-4 text-[#FDE047]" />
                    <span>Portal Kaprodi</span>
                    {registrationsCount > 0 && (
                      <span className="px-1.5 py-0.2 bg-black/30 text-white text-[10px] rounded-full font-bold">
                        {registrationsCount}
                      </span>
                    )}
                  </button>
                )}

                {currentUser && (currentUser.role === 'finance' || currentUser.role === 'superadmin') && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('finance')}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[40px] ${
                      activeTab === 'finance'
                        ? 'bg-white text-[#166534] shadow-sm font-extrabold ring-1 ring-[#EAB308]'
                        : 'text-white/90 hover:text-white hover:bg-white/15'
                    }`}
                    title="Panel Khusus Admin Keuangan: Data Pendaftar Kena Biaya SKS"
                  >
                    <Coins className="w-4 h-4 text-[#FDE047]" />
                    <span>Keuangan</span>
                    {chargedRegistrationsCount > 0 && (
                      <span className="px-1.5 py-0.2 bg-[#EAB308] text-slate-900 font-black text-[10px] rounded-full shadow-xs">
                        {chargedRegistrationsCount}
                      </span>
                    )}
                  </button>
                )}
              </nav>

            {/* Right Controls: Dark Mode Toggle + User Profile */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

              {/* Theme Toggle Button (Light/Dark) - Generous >=44px tap target for mobile & desktop */}
              <button
                type="button"
                onClick={onToggleDarkMode}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl text-white/95 hover:text-white hover:bg-white/20 bg-black/15 flex items-center justify-center transition-all cursor-pointer shrink-0 border border-white/20 active:scale-90 shadow-2xs"
                title={isDarkMode ? 'Beralih ke Mode Terang (Light Mode)' : 'Beralih ke Mode Gelap (Dark Mode)'}
                aria-label="Toggle tema gelap terang"
              >
                {isDarkMode ? (
                  <Sun className="w-5 h-5 text-[#FDE047] transition-transform duration-200 rotate-0" />
                ) : (
                  <Moon className="w-5 h-5 text-white transition-transform duration-200" />
                )}
              </button>

              {/* User Logged In Profile (Hanya Tampil Jika Staf Login) */}
              {currentUser && (
                <div className="flex items-center gap-1 sm:gap-1.5 pl-1 sm:pl-2 border-l border-white/20 shrink-0">
                  <div 
                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 bg-black/25 text-white border border-white/20"
                    title={`Login sebagai ${currentUser.name} (${currentUser.title})`}
                  >
                    <UserCheck className="w-3.5 h-3.5 text-[#FDE047]" />
                    <span className="hidden sm:inline font-semibold">{currentUser.title}</span>
                    <span className="sm:hidden capitalize">{currentUser.role}</span>
                  </div>

                  <button
                    type="button"
                    onClick={onLogout}
                    className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl text-white/80 hover:text-white hover:bg-red-600/80 flex items-center justify-center transition-colors cursor-pointer shrink-0 active:scale-95"
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

        {/* Mobile Navigation Bar (Dioptimalkan Khusus Pengguna HP) */}
        {currentUser ? (
          /* Tampilan Mobile Saat Staf Login: Tab Admin BAAK & Keuangan Tersedia */
          <div className="lg:hidden bg-[#15803D] dark:bg-[#0f4423] border-t border-white/10 px-2 sm:px-4 py-1.5 transition-colors duration-150">
            <nav className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 touch-pan-x">
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[40px] active:scale-95 ${
                  activeTab === 'form'
                    ? 'bg-white text-[#166534] shadow-sm font-extrabold'
                    : 'text-white/90 hover:text-white hover:bg-white/15'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Formulir</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('status')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[40px] active:scale-95 ${
                  activeTab === 'status'
                    ? 'bg-white text-[#166534] shadow-sm font-extrabold'
                    : 'text-white/90 hover:text-white hover:bg-white/15'
                }`}
              >
                <Search className="w-4 h-4" />
                <span>Status</span>
              </button>

              {(currentUser.role === 'baak' || currentUser.role === 'superadmin' || currentUser.role === 'kaprodi') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[40px] active:scale-95 ${
                    activeTab === 'admin'
                      ? 'bg-white text-[#166534] shadow-sm font-extrabold ring-1 ring-[#EAB308]'
                      : 'text-white/90 hover:text-white hover:bg-white/15'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-[#FDE047]" />
                  <span>{currentUser.role === 'superadmin' ? 'Pengelola' : currentUser.role === 'kaprodi' ? 'Kaprodi' : 'BAAK'}</span>
                  {registrationsCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-black/35 text-white text-[10px] rounded-full font-bold">
                      {registrationsCount}
                    </span>
                  )}
                </button>
              )}

              {(currentUser.role === 'finance' || currentUser.role === 'superadmin') && (
                <button
                  type="button"
                  onClick={() => setActiveTab('finance')}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 min-h-[40px] active:scale-95 ${
                    activeTab === 'finance'
                      ? 'bg-white text-[#166534] shadow-sm font-extrabold ring-1 ring-[#EAB308]'
                      : 'text-white/90 hover:text-white hover:bg-white/15'
                  }`}
                >
                  <Coins className="w-4 h-4 text-[#FDE047]" />
                  <span>Keuangan</span>
                  {chargedRegistrationsCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-[#EAB308] text-slate-900 font-black text-[10px] rounded-full shadow-xs">
                      {chargedRegistrationsCount}
                    </span>
                  )}
                </button>
              )}
            </nav>
          </div>
        ) : (
          /* Tampilan Mobile Khusus Mahasiswa: Bersih, 2 Tombol Proporsional, Tanpa Elemen Admin */
          <div className="lg:hidden bg-[#15803D] dark:bg-[#0f4423] border-t border-white/10 px-3 py-2 transition-colors duration-150">
            <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => setActiveTab('form')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[44px] active:scale-95 ${
                  activeTab === 'form'
                    ? 'bg-white text-[#166534] shadow-sm font-extrabold ring-1 ring-white/40'
                    : 'text-white/90 hover:text-white hover:bg-white/15'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Form Pendaftaran</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('status')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[44px] active:scale-95 ${
                  activeTab === 'status'
                    ? 'bg-white text-[#166534] shadow-sm font-extrabold ring-1 ring-white/40'
                    : 'text-white/90 hover:text-white hover:bg-white/15'
                }`}
              >
                <Search className="w-4 h-4" />
                <span>Cek &amp; Cetak KRS</span>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* Signature Janur Kuning Accent Line (#EAB308) Under Header */}
      <div className="h-1 bg-[#EAB308] w-full shadow-xs" />
    </header>
  );
};
