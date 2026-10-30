import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Header } from './components/Header';
import { RegistrationForm } from './components/RegistrationForm';
import { RegistrationReceipt } from './components/RegistrationReceipt';
import { StatusChecker } from './components/StatusChecker';
import { LoginModal } from './components/LoginModal';

// Code splitting: Lazy-load heavy administrative modules
const AdminPanel = lazy(() => import('./components/AdminPanel').then(m => ({ default: m.AdminPanel })));
const FinancePanel = lazy(() => import('./components/FinancePanel').then(m => ({ default: m.FinancePanel })));
import { INITIAL_COURSES, DEFAULT_ADMIN_SETTINGS } from './data/courses';
import { INITIAL_REGISTRATIONS } from './data/mockRegistrations';
import { CourseItem, SimpleRegistration, AdminSettings, AuthUser, PaymentStatus, UserRole, ManagedUser } from './types';
import { CheckCircle2, X, Lock } from 'lucide-react';
import { InstiperLogo } from './components/InstiperLogo';
import { 
  testConnection, 
  subscribeCloudRegistrations, 
  saveCloudRegistration, 
  deleteCloudRegistration, 
  subscribeCloudCourses, 
  syncAllCoursesToCloud, 
  deleteCloudCourse,
  deleteBatchCloudCourses,
  subscribeCloudSettings, 
  saveCloudSettings,
  subscribeCloudUsers
} from './lib/firebase';

const STORAGE_COURSES_KEY = 'siakad_courses_data_v2';
const STORAGE_REGISTRATIONS_KEY = 'siakad_registrations_data_v2';
const STORAGE_SETTINGS_KEY = 'siakad_admin_settings_v2';
const STORAGE_AUTH_USER_KEY = 'siakad_auth_user_v2';

export default function App() {
  const [activeTab, setActiveTab] = useState<'form' | 'status' | 'admin' | 'finance'>('form');
  const [isCloudConnected, setIsCloudConnected] = useState<boolean | null>(null);

  // Dark Mode Theme State (Sync with system preference + manual toggle)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('instiper_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark');
      try {
        localStorage.setItem('instiper_theme', 'dark');
      } catch (e) {}
    } else {
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      document.body.classList.remove('dark');
      try {
        localStorage.setItem('instiper_theme', 'light');
      } catch (e) {}
    }
  }, [isDarkMode]);

  // Listen to OS system color-scheme changes if not overridden by user
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const saved = localStorage.getItem('instiper_theme');
      if (!saved) {
        setIsDarkMode(e.matches);
      }
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_AUTH_USER_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to load auth user', e);
    }
    return null;
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [loginRoleHint, setLoginRoleHint] = useState<UserRole>('finance');

  // Listen to URL query params for staff portal entry (?admin, ?login, ?staf)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.has('admin') || params.has('login') || params.has('staf') || params.has('staff') || params.has('baak') || params.has('keuangan')) {
        const isBaak = params.has('baak') || params.get('role') === 'baak' || params.get('role') === 'superadmin';
        setLoginRoleHint(isBaak ? 'baak' : 'finance');
        setIsLoginModalOpen(true);
        // Clean query parameter from URL bar without reload
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    } catch (e) {
      console.warn('URL check warning', e);
    }
  }, []);

  // Courses state (Admin can add/edit/delete courses & SKS - FITUR 1)
  // Courses state (Admin can add/edit/delete courses & SKS - FITUR 1)
  const [courses, setCourses] = useState<CourseItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_COURSES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((c: CourseItem) => ({
            ...c,
            academicYear: c.academicYear || '2025/2026'
          }));
        }
      }
    } catch (e) {
      console.error('Failed to load courses', e);
    }
    return [];
  });

  // Admin Settings: Class options & editable Note for Superadmin
  const [adminSettings, setAdminSettings] = useState<AdminSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.classOptions) && typeof parsed.classNote === 'string') {
          return {
            ...DEFAULT_ADMIN_SETTINGS,
            ...parsed,
            activeAcademicYear: parsed.activeAcademicYear || DEFAULT_ADMIN_SETTINGS.activeAcademicYear || '2025/2026',
            activeTerm: parsed.activeTerm || DEFAULT_ADMIN_SETTINGS.activeTerm || 'Ganjil',
            availableAcademicYears: Array.isArray(parsed.availableAcademicYears) && parsed.availableAcademicYears.length > 0 
              ? parsed.availableAcademicYears 
              : (DEFAULT_ADMIN_SETTINGS.availableAcademicYears || ['2023/2024', '2024/2025', '2025/2026', '2026/2027']),
            feePerSksEnabled: typeof parsed.feePerSksEnabled === 'boolean' ? parsed.feePerSksEnabled : DEFAULT_ADMIN_SETTINGS.feePerSksEnabled,
            costPerSks: typeof parsed.costPerSks === 'number' ? parsed.costPerSks : DEFAULT_ADMIN_SETTINGS.costPerSks,
            paidBatches: Array.isArray(parsed.paidBatches) ? parsed.paidBatches : DEFAULT_ADMIN_SETTINGS.paidBatches,
            paymentInstructions: parsed.paymentInstructions || DEFAULT_ADMIN_SETTINGS.paymentInstructions,
            paymentAccountInfo: parsed.paymentAccountInfo || DEFAULT_ADMIN_SETTINGS.paymentAccountInfo,
            defaultMaxSks: typeof parsed.defaultMaxSks === 'number' && parsed.defaultMaxSks > 0 ? parsed.defaultMaxSks : DEFAULT_ADMIN_SETTINGS.defaultMaxSks,
            batchMaxSks: parsed.batchMaxSks && typeof parsed.batchMaxSks === 'object' && !Array.isArray(parsed.batchMaxSks) ? parsed.batchMaxSks : (DEFAULT_ADMIN_SETTINGS.batchMaxSks || {}),
            semesterSchedules: parsed.semesterSchedules && typeof parsed.semesterSchedules === 'object' && !Array.isArray(parsed.semesterSchedules) ? parsed.semesterSchedules : (DEFAULT_ADMIN_SETTINGS.semesterSchedules || {}),
            registrationPeriods: Array.isArray(parsed.registrationPeriods) && parsed.registrationPeriods.length > 0 ? parsed.registrationPeriods : (DEFAULT_ADMIN_SETTINGS.registrationPeriods || []),
            restrictedRepeatClasses: parsed.restrictedRepeatClasses && typeof parsed.restrictedRepeatClasses === 'object' && !Array.isArray(parsed.restrictedRepeatClasses) ? parsed.restrictedRepeatClasses : DEFAULT_ADMIN_SETTINGS.restrictedRepeatClasses,
            restrictedRepeatClassReason: parsed.restrictedRepeatClassReason && typeof parsed.restrictedRepeatClassReason === 'object' && !Array.isArray(parsed.restrictedRepeatClassReason) ? parsed.restrictedRepeatClassReason : DEFAULT_ADMIN_SETTINGS.restrictedRepeatClassReason,
            kelasAsalMode: parsed.kelasAsalMode || DEFAULT_ADMIN_SETTINGS.kelasAsalMode || 'input_with_chips',
            kelasAsalPlaceholder: parsed.kelasAsalPlaceholder || DEFAULT_ADMIN_SETTINGS.kelasAsalPlaceholder || 'Contoh: Kelas A',
            kelasAsalCustomOptions: Array.isArray(parsed.kelasAsalCustomOptions) ? parsed.kelasAsalCustomOptions : (DEFAULT_ADMIN_SETTINGS.kelasAsalCustomOptions || []),
          };
        }
      }
    } catch (e) {
      console.error('Failed to load settings', e);
    }
    return DEFAULT_ADMIN_SETTINGS;
  });

  // Registrations state (NIM duplicate check - FITUR 2)
  const [registrations, setRegistrations] = useState<SimpleRegistration[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_REGISTRATIONS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Failed to load registrations', e);
    }
    // Mulai dengan array kosong — jangan tampilkan data mock ke produksi
    return [];
  });

  // Active receipt view (Print receipt after register - FITUR 3)
  const [activeReceipt, setActiveReceipt] = useState<SimpleRegistration | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Persist courses to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_COURSES_KEY, JSON.stringify(courses));
    } catch (e) {
      console.error('Failed to save courses', e);
    }
  }, [courses]);

  // Persist settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify(adminSettings));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
  }, [adminSettings]);

  // Persist registrations to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_REGISTRATIONS_KEY, JSON.stringify(registrations));
    } catch (e) {
      console.error('Failed to save registrations', e);
    }
  }, [registrations]);

  // Persist auth user to localStorage
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(STORAGE_AUTH_USER_KEY, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(STORAGE_AUTH_USER_KEY);
      }
    } catch (e) {
      console.error('Failed to save auth user', e);
    }
  }, [currentUser]);

  // Cloud Firestore Real-time Synchronization on Mount
  useEffect(() => {
    // 1. Connection check on boot
    testConnection().then((connected) => {
      setIsCloudConnected(connected);
    });

    // 2. Real-time registrations sync: HANYA untuk staf admin yang sedang login
    // Mahasiswa biasa tidak perlu dan dilarang mendownload ribuan data pendaftar lain
    let unsubRegs = () => {};
    if (currentUser) {
      unsubRegs = subscribeCloudRegistrations((cloudRegs) => {
        setRegistrations(cloudRegs || []);
      });
    }

    // 3. Real-time courses sync from Firestore (Katalog MK)
    const unsubCourses = subscribeCloudCourses((cloudCourses) => {
      if (Array.isArray(cloudCourses)) {
        setCourses(cloudCourses);
      }
    });

    // 4. Real-time settings sync from Firestore (Pengaturan Jadwal & Biaya)
    const unsubSettings = subscribeCloudSettings((cloudSettings) => {
      if (cloudSettings) {
        setAdminSettings(prev => ({
          ...prev,
          ...cloudSettings
        }));
      }
    });

    // 5. Real-time system users sync from Firestore: sinkronkan ke seluruh sesi pengguna
    const unsubUsers = subscribeCloudUsers((cloudUsers) => {
      if (cloudUsers && cloudUsers.length > 0) {
        try {
          const raw = localStorage.getItem('instiper_managed_users');
          const localList: ManagedUser[] = raw ? JSON.parse(raw) : [];
          // Gabungkan akun cloud dengan lokal, utamakan hash password valid jika cloud [PROTECTED]
          const merged = cloudUsers.map((cu) => {
            const local = localList.find((l) => l.id === cu.id || l.username.toLowerCase() === cu.username.toLowerCase());
            if (cu.password === '[PROTECTED]' && local && local.password && local.password !== '[PROTECTED]') {
              return { ...cu, password: local.password };
            }
            return cu;
          });
          localStorage.setItem('instiper_managed_users', JSON.stringify(merged));
        } catch (e) {
          console.warn('Sync cloud users to cache error:', e);
        }
      }
    });

    return () => {
      unsubRegs();
      unsubCourses();
      unsubSettings();
      unsubUsers();
    };
  }, [currentUser]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Login & Logout Handlers
  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setIsLoginModalOpen(false);
    showToast(`Berhasil login sebagai ${user.name} (${user.title})`);
    
    // Auto-navigate to matching portal
    if (user.role === 'finance') {
      setActiveTab('finance');
    } else {
      setActiveTab('admin');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    showToast('Berhasil keluar (logout) dari akun pengelola.');
    setActiveTab('form');
  };

  const handleOpenLoginModal = (roleHint: UserRole = 'finance') => {
    setLoginRoleHint(roleHint);
    setIsLoginModalOpen(true);
  };

  // Form submit success handler with Cloud Firestore write
  const handleRegistrationSuccess = (newReg: SimpleRegistration) => {
    setRegistrations(prev => [newReg, ...prev]);
    // Save to Firestore Cloud immediately
    saveCloudRegistration(newReg).catch(err => {
      console.warn('Cloud registration sync warning:', err);
    });
    showToast(`Pendaftaran ${newReg.nama} berhasil tersimpan ke Cloud! Silakan cetak KRS.`);
    // Immediately open print receipt view (Fitur 3)
    setActiveReceipt(newReg);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Admin updates courses with Cloud sync
  const handleUpdateCourses = (newCourses: CourseItem[]) => {
    setCourses(newCourses);
    syncAllCoursesToCloud(newCourses).catch(err => {
      console.warn('Cloud sync courses warning:', err);
    });
    showToast('Daftar mata kuliah dan SKS berhasil disinkronkan ke Cloud!');
  };

  // Admin deletes a single course with direct atomic Cloud deletion
  const handleDeleteCourse = async (courseId: string) => {
    // 1. Immediately update state and localStorage
    setCourses(prev => {
      const updated = prev.filter(c => c.id !== courseId);
      try {
        localStorage.setItem(STORAGE_COURSES_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to update localStorage', e);
      }
      return updated;
    });

    // 2. Remove deleted course from any active registrationPeriods
    setAdminSettings(prev => {
      if (!prev.registrationPeriods || prev.registrationPeriods.length === 0) return prev;
      const updatedPeriods = prev.registrationPeriods.map(p => ({
        ...p,
        offeredCourseIds: (p.offeredCourseIds || []).filter(id => id !== courseId),
        courses: Array.isArray(p.courses) ? p.courses.filter(c => c.id !== courseId) : p.courses
      }));
      const updatedSettings = { ...prev, registrationPeriods: updatedPeriods };
      saveCloudSettings(updatedSettings).catch(() => {});
      return updatedSettings;
    });

    // 3. Perform direct Cloud delete
    try {
      await deleteCloudCourse(courseId);
      showToast('Mata kuliah berhasil dihapus permanen dari sistem & Cloud!');
    } catch (err) {
      console.error('Failed to delete course from cloud:', err);
      showToast('Peringatan: Gagal menghapus mata kuliah dari Cloud.');
      throw err;
    }
  };

  // Admin deletes multiple courses with batch Cloud deletion
  const handleDeleteBatchCourses = async (courseIds: string[]) => {
    if (!courseIds || courseIds.length === 0) return;
    const toDeleteSet = new Set(courseIds);
    setCourses(prev => {
      const updated = prev.filter(c => !toDeleteSet.has(c.id));
      try {
        localStorage.setItem(STORAGE_COURSES_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to update localStorage', e);
      }
      return updated;
    });

    setAdminSettings(prev => {
      if (!prev.registrationPeriods || prev.registrationPeriods.length === 0) return prev;
      const updatedPeriods = prev.registrationPeriods.map(p => ({
        ...p,
        offeredCourseIds: (p.offeredCourseIds || []).filter(id => !toDeleteSet.has(id)),
        courses: Array.isArray(p.courses) ? p.courses.filter(c => !toDeleteSet.has(c.id)) : p.courses
      }));
      const updatedSettings = { ...prev, registrationPeriods: updatedPeriods };
      saveCloudSettings(updatedSettings).catch(() => {});
      return updatedSettings;
    });

    try {
      await deleteBatchCloudCourses(courseIds);
      showToast(`${courseIds.length} mata kuliah berhasil dihapus permanen dari Cloud!`);
    } catch (err) {
      console.error('Failed to batch delete courses from cloud:', err);
      showToast('Peringatan: Gagal menghapus sebagian mata kuliah dari Cloud.');
      throw err;
    }
  };

  // Admin clears all courses across all academic years with Cloud sync
  const handleClearAllCourses = async () => {
    setCourses([]);
    try {
      localStorage.setItem(STORAGE_COURSES_KEY, JSON.stringify([]));
    } catch (e) {
      console.warn('Failed to update localStorage', e);
    }

    setAdminSettings(prev => {
      if (!prev.registrationPeriods || prev.registrationPeriods.length === 0) return prev;
      const updatedPeriods = prev.registrationPeriods.map(p => ({
        ...p,
        offeredCourseIds: [],
        courses: []
      }));
      const updatedSettings = { ...prev, registrationPeriods: updatedPeriods };
      saveCloudSettings(updatedSettings).catch(() => {});
      return updatedSettings;
    });

    try {
      await syncAllCoursesToCloud([]);
      showToast('Seluruh katalog mata kuliah berhasil dikosongkan dari Cloud & lokal!');
    } catch (err) {
      console.error('Failed to clear courses from cloud:', err);
      showToast('Peringatan: Gagal mengosongkan mata kuliah dari Cloud.');
      throw err;
    }
  };

  // Superadmin updates settings with Cloud sync
  const handleUpdateSettings = (newSettings: AdminSettings) => {
    setAdminSettings(newSettings);
    saveCloudSettings(newSettings).catch(err => {
      console.warn('Cloud sync settings warning:', err);
    });
    showToast('Pengaturan sistem & ketentuan biaya SKS berhasil disimpan ke Cloud!');
  };

  // Inline Note quick update with Cloud sync
  const handleUpdateNote = (newNote: string) => {
    const updated = { ...adminSettings, classNote: newNote };
    setAdminSettings(updated);
    saveCloudSettings(updated).catch(err => {
      console.warn('Cloud sync note warning:', err);
    });
    showToast('Catatan pengumuman berhasil diperbarui di Cloud!');
  };

  // Admin deletes registration with Cloud sync
  const handleDeleteRegistration = (id: string) => {
    setRegistrations(prev => prev.filter(r => r.id !== id));
    deleteCloudRegistration(id).catch(err => {
      console.warn('Cloud delete registration warning:', err);
    });
    showToast('Data pendaftaran berhasil dihapus dari Cloud. NIM kini dapat dipakai kembali.');
  };

  // Finance updates payment status with Cloud sync
  const handleUpdatePaymentStatus = (registrationId: string, status: PaymentStatus, note?: string) => {
    const now = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const target = registrations.find(r => r.id === registrationId);
    if (target) {
      const updatedReg: SimpleRegistration = {
        ...target,
        paymentStatus: status,
        paymentDate: status === 'verified' || status === 'paid' ? now : undefined,
        paymentNote: note !== undefined ? note : target.paymentNote
      };
      saveCloudRegistration(updatedReg).catch(err => {
        console.warn('Cloud payment update warning:', err);
      });
    }

    setRegistrations(prev => prev.map(r => {
      if (r.id === registrationId) {
        return {
          ...r,
          paymentStatus: status,
          paymentDate: status === 'verified' || status === 'paid' ? now : undefined,
          paymentNote: note !== undefined ? note : r.paymentNote
        };
      }
      return r;
    }));

    const statusText = status === 'verified' ? 'LUNAS & TERVERIFIKASI' : status === 'paid' ? 'SUDAH BAYAR' : 'MENUNGGU PEMBAYARAN';
    showToast(`Status pembayaran pendaftar diubah menjadi: ${statusText}`);
  };

  // Academic Admin updates registration approval status with Cloud sync
  const handleUpdateRegistrationStatus = (registrationId: string, status: import('./types').RegistrationStatus, reason?: string) => {
    const target = registrations.find(r => r.id === registrationId);
    if (target) {
      const updatedReg: SimpleRegistration = {
        ...target,
        status,
        rejectionReason: status === 'rejected' ? (reason?.trim() || 'Berkas fisik belum diserahkan atau syarat tidak lengkap') : undefined
      };
      saveCloudRegistration(updatedReg).catch(err => {
        console.warn('Cloud registration status update warning:', err);
      });
    }

    setRegistrations(prev => prev.map(r => {
      if (r.id === registrationId) {
        return {
          ...r,
          status,
          rejectionReason: status === 'rejected' ? (reason?.trim() || 'Berkas fisik belum diserahkan atau syarat tidak lengkap') : undefined
        };
      }
      return r;
    }));

    const statusLabel = status === 'approved' ? 'DISETUJUI / DISAHKAN' : status === 'rejected' ? 'DITOLAK' : 'MENUNGGU VERIFIKASI';
    showToast(`Status berkas pendaftaran berhasil diubah menjadi: ${statusLabel}`);
  };

  // Academic Admin edits registration data with Cloud sync
  const handleUpdateRegistration = (updatedReg: SimpleRegistration) => {
    saveCloudRegistration(updatedReg).catch(err => {
      console.warn('Cloud registration update warning:', err);
    });

    setRegistrations(prev => prev.map(r => {
      if (r.id === updatedReg.id) {
        return updatedReg;
      }
      return r;
    }));

    showToast(`Data pendaftaran ${updatedReg.nama} (${updatedReg.nim}) berhasil diperbarui!`);
  };

  // Charged registrations count for header badge
  const chargedRegistrationsCount = registrations.filter(r => {
    const isFeeActive = adminSettings.feePerSksEnabled ?? true;
    const paidBatches = adminSettings.paidBatches ?? ['2020', '2021', '2022'];
    return isFeeActive && paidBatches.includes(r.angkatan);
  }).length;

  return (
    <div className="min-h-screen bg-[#F8FAF9] dark:bg-[#0B130E] flex flex-col font-sans text-[#231F20] dark:text-slate-100 transition-colors duration-150">
      
      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveReceipt(null);
          if (tab === 'finance' && !currentUser) {
            handleOpenLoginModal('finance');
            return;
          }
          if (tab === 'admin' && !currentUser) {
            handleOpenLoginModal('baak');
            return;
          }
          setActiveTab(tab);
        }}
        registrationsCount={registrations.length}
        chargedRegistrationsCount={chargedRegistrationsCount}
        currentUser={currentUser}
        onOpenLogin={handleOpenLoginModal}
        onLogout={handleLogout}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(prev => !prev)}
        isCloudConnected={isCloudConnected}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-50 sm:max-w-md bg-slate-900/95 dark:bg-slate-800/95 text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 dark:border-slate-600 flex items-center justify-between gap-3 text-xs font-semibold animate-fade-in backdrop-blur-md print:hidden">
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="w-4 h-4 text-[#166534] dark:text-emerald-400 shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </div>
          <button 
            onClick={() => setToastMessage(null)} 
            className="text-slate-400 hover:text-white ml-2 cursor-pointer p-1 shrink-0"
            aria-label="Tutup notifikasi"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 pb-16">
        {activeReceipt ? (
          <RegistrationReceipt
            registration={activeReceipt}
            adminSettings={adminSettings}
            onBack={() => setActiveReceipt(null)}
          />
        ) : (
          <>
            {activeTab === 'form' && (
              <RegistrationForm
                courses={courses}
                existingRegistrations={registrations}
                adminSettings={adminSettings}
                onSubmitSuccess={handleRegistrationSuccess}
                onUpdateNote={handleUpdateNote}
              />
            )}

            {activeTab === 'status' && (
              <StatusChecker
                registrations={registrations}
                adminSettings={adminSettings}
                onViewReceipt={(r) => {
                  setActiveReceipt(r);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onGoToForm={() => setActiveTab('form')}
              />
            )}

            {activeTab === 'admin' && (
              <Suspense fallback={
                <div className="max-w-md mx-auto my-16 p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 text-center">
                  <div className="w-10 h-10 border-3 border-[#166534] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Memuat Panel Administrasi Akademik...</p>
                </div>
              }>
                <AdminPanel
                  courses={courses}
                  registrations={registrations}
                  adminSettings={adminSettings}
                  currentUser={currentUser}
                  onUpdateCourses={handleUpdateCourses}
                  onDeleteCourse={handleDeleteCourse}
                  onDeleteBatchCourses={handleDeleteBatchCourses}
                  onClearAllCourses={handleClearAllCourses}
                  onUpdateSettings={handleUpdateSettings}
                  onDeleteRegistration={handleDeleteRegistration}
                  onUpdateRegistrationStatus={handleUpdateRegistrationStatus}
                  onUpdateRegistration={handleUpdateRegistration}
                  onViewReceipt={(r) => {
                    setActiveReceipt(r);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onSwitchToFinance={() => setActiveTab('finance')}
                  onLogout={handleLogout}
                />
              </Suspense>
            )}

            {activeTab === 'finance' && (
              currentUser ? (
                <Suspense fallback={
                  <div className="max-w-md mx-auto my-16 p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 text-center">
                    <div className="w-10 h-10 border-3 border-[#166534] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Memuat Panel Rekapitulasi Keuangan...</p>
                  </div>
                }>
                  <FinancePanel
                    currentUser={currentUser}
                    registrations={registrations}
                    adminSettings={adminSettings}
                    courses={courses}
                    onUpdatePaymentStatus={handleUpdatePaymentStatus}
                    onViewReceipt={(r) => {
                      setActiveReceipt(r);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    onLogout={handleLogout}
                  />
                </Suspense>
              ) : (
                <div className="max-w-md mx-auto my-12 p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#166534]/15 text-[#166534] dark:text-emerald-400 mx-auto flex items-center justify-center font-bold text-xl mb-3">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h3 className="font-extrabold text-base text-slate-900 dark:text-white mb-1">
                    Akses Khusus Admin Keuangan FP
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
                    Halaman ini bersifat kredensial. Silakan login terlebih dahulu untuk mengakses rekapitulasi pembayaran biaya SKS dan verifikasi pelunasan mahasiswa.
                  </p>
                  <button
                    onClick={() => handleOpenLoginModal('finance')}
                    className="w-full py-2.5 bg-[#166534] hover:bg-[#14532D] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
                  >
                    Buka Login Admin Keuangan
                  </button>
                </div>
              )
            )}
          </>
        )}
      </main>

      {/* Confidential Login Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        defaultRoleHint={loginRoleHint}
      />

      {/* Clean Academic Footer with INSTIPER Branding */}
      <footer className="bg-[#0a1f12] text-slate-300 text-xs py-8 border-t border-emerald-900/60 print:hidden mb-28 lg:mb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-white/10 p-1 flex items-center justify-center shrink-0 border border-white/15 shadow-xs">
              <img src="/logo_instiper.png" alt="Logo INSTIPER" className="w-full h-full object-contain" />
            </div>
            <div>
              <p className="font-extrabold text-white text-xs uppercase tracking-wide">
                Institut Pertanian Stiper (INSTIPER) Yogyakarta
              </p>
              <p className="text-[11px] text-emerald-200/80">
                Fakultas Pertanian — Sistem Pendaftaran Mengulang Matakuliah
              </p>
            </div>
          </div>

          <div className="text-center sm:text-right text-[11px] text-slate-400 flex flex-col sm:items-end gap-1.5">
            <p>Kampus INSTIPER: Jl. Nangka II, Krodan, Maguwoharjo, Depok, Sleman, D.I. Yogyakarta 55281</p>
            <div className="flex items-center justify-center sm:justify-end gap-3 text-[10px] text-slate-400">
              <span>© {new Date().getFullYear()} Fakultas Pertanian INSTIPER Yogyakarta.</span>
              <span>•</span>
              {!currentUser ? (
                <button
                  onClick={() => handleOpenLoginModal('baak')}
                  className="text-emerald-400 hover:text-emerald-300 underline font-medium cursor-pointer inline-flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity"
                  title="Akses Khusus Pengelola / Staf Admin Fakultas & Keuangan"
                >
                  <Lock className="w-3 h-3" />
                  <span>Akses Pengelola</span>
                </button>
              ) : (
                <span className="text-emerald-300 font-semibold inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{currentUser.name} ({currentUser.title})</span>
                  <button 
                    onClick={handleLogout} 
                    className="underline text-red-400 hover:text-red-300 ml-1 cursor-pointer"
                  >
                    Logout
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
