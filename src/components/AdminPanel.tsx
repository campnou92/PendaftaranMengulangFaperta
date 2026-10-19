import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { 
  CourseItem, 
  SimpleRegistration, 
  AdminSettings, 
  AuthUser,
  ManagedUser,
  UserRole,
  getMaxSksForBatch, 
  SemesterSchedule, 
  getSemesterStatus, 
  formatDateTimeId,
  getRestrictedClassesForSemester,
  isClassRestrictedForRepeat,
  getRestrictedClassReason
} from '../types';
import { 
  PlusCircle, 
  Trash2, 
  Edit3, 
  Save, 
  RotateCcw, 
  Printer, 
  CheckCircle, 
  Users, 
  BookOpen, 
  Search, 
  Download,
  FileSpreadsheet,
  StickyNote,
  Sliders,
  Check,
  X,
  Layers,
  Sparkles,
  CreditCard,
  Coins,
  Gauge,
  Calendar,
  Clock,
  Lock,
  Unlock,
  CalendarClock,
  AlertTriangle,
  Info,
  Award,
  Ban,
  Upload,
  FileUp,
  FileDown,
  KeyRound,
  UserPlus,
  ShieldCheck,
  UserCheck,
  UserX,
  Eye,
  EyeOff,
  ChevronRight,
  Database,
  Copy
} from 'lucide-react';
import { INITIAL_COURSES, DEFAULT_ADMIN_SETTINGS, ANGKATAN_OPTIONS } from '../data/courses';
import { downloadMasterCoursesTemplate, parseMasterCoursesFile } from '../utils/excelImportExport';
import { InstiperLogo } from './InstiperLogo';
import { 
  getStoredUsers, 
  saveStoredUsers, 
  addManagedUser, 
  updateManagedUser, 
  deleteManagedUser,
  getDefaultTitleForRole 
} from '../utils/userManagement';

interface AdminPanelProps {
  courses: CourseItem[];
  registrations: SimpleRegistration[];
  adminSettings: AdminSettings;
  currentUser?: AuthUser | null;
  onUpdateCourses: (newCourses: CourseItem[]) => void;
  onUpdateSettings: (newSettings: AdminSettings) => void;
  onDeleteRegistration: (id: string) => void;
  onViewReceipt: (registration: SimpleRegistration) => void;
  onSwitchToFinance?: () => void;
  onLogout?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  courses,
  registrations,
  adminSettings,
  currentUser,
  onUpdateCourses,
  onUpdateSettings,
  onDeleteRegistration,
  onViewReceipt,
  onSwitchToFinance,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<'courses' | 'superadmin' | 'registrations' | 'users'>('registrations');

  // Proteksi hak akses kredensial: Jika staf non-superadmin mencoba membuka tab users, otomatis alihkan ke registrations
  useEffect(() => {
    if (currentUser?.role !== 'superadmin' && activeTab === 'users') {
      setActiveTab('registrations');
    }
  }, [currentUser, activeTab]);

  // Handler Backup Data Menyeluruh (Format JSON Aman)
  const handleBackupData = () => {
    const backupObject = {
      exportedAt: new Date().toISOString(),
      system: 'Pendaftaran Mengulang FAPERTA INSTIPER',
      academicYear: '2026/2027',
      operator: currentUser ? { name: currentUser.name, role: currentUser.role } : 'System Admin',
      totalMatakuliah: courses.length,
      totalPendaftar: registrations.length,
      totalPengelola: managedUsers.length,
      adminSettings,
      courses,
      registrations,
      users: managedUsers.map(u => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        title: u.title,
        email: u.email,
        isActive: u.isActive,
        createdAt: u.createdAt
      }))
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupObject, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `backup-faperta-instiper-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };
  
  // ==========================================
  // SUPERADMIN: USER & CREDENTIAL MANAGEMENT STATE
  // ==========================================
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>(() => getStoredUsers());
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('baak');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [userModalFeedback, setUserModalFeedback] = useState<string | null>(null);

  // Password Reset Modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [targetUserForPassword, setTargetUserForPassword] = useState<ManagedUser | null>(null);
  const [newPasswordReset, setNewPasswordReset] = useState('');
  const [passwordModalFeedback, setPasswordModalFeedback] = useState<string | null>(null);

  // Edit User Modal
  const [isEditUserModalOpen, setIsEditUserModalOpen] = useState(false);
  const [targetUserForEdit, setTargetUserForEdit] = useState<ManagedUser | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserRole, setEditUserRole] = useState<UserRole>('baak');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserActive, setEditUserActive] = useState<boolean>(true);
  const [editUserFeedback, setEditUserFeedback] = useState<string | null>(null);

  const refreshUsersList = () => {
    setManagedUsers(getStoredUsers());
  };

  // Search state
  const [searchReg, setSearchReg] = useState('');

  // Course addition state
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseSks, setNewCourseSks] = useState(2);
  const [newCourseProdi, setNewCourseProdi] = useState<'agroteknologi' | 'agribisnis'>('agroteknologi');
  const [newCourseSemester, setNewCourseSemester] = useState<number>(3);
  // Academic Year State & Management
  const currentActiveAcademicYear = adminSettings.activeAcademicYear || '2025/2026';
  const [selectedCourseYear, setSelectedCourseYear] = useState<string>(currentActiveAcademicYear);
  const [newCourseAcademicYear, setNewCourseAcademicYear] = useState<string>(currentActiveAcademicYear);
  const [editAcademicYear, setEditAcademicYear] = useState<string>(currentActiveAcademicYear);

  // Copy Courses modal state
  const [isCopyCoursesModalOpen, setIsCopyCoursesModalOpen] = useState(false);
  const [copySourceYear, setCopySourceYear] = useState<string>('2024/2025');
  const [copyTargetYear, setCopyTargetYear] = useState<string>(currentActiveAcademicYear);

  // Academic Year Settings draft (Superadmin / BAAK)
  const [activeAcademicYearDraft, setActiveAcademicYearDraft] = useState<string>(
    adminSettings.activeAcademicYear ?? DEFAULT_ADMIN_SETTINGS.activeAcademicYear ?? '2025/2026'
  );
  const [activeTermDraft, setActiveTermDraft] = useState<string>(
    adminSettings.activeTerm ?? DEFAULT_ADMIN_SETTINGS.activeTerm ?? 'Ganjil'
  );
  const [availableYearsDraft, setAvailableYearsDraft] = useState<string[]>(
    adminSettings.availableAcademicYears ?? DEFAULT_ADMIN_SETTINGS.availableAcademicYears ?? ['2023/2024', '2024/2025', '2025/2026', '2026/2027']
  );
  const [newAcademicYearInput, setNewAcademicYearInput] = useState<string>('');
  const [academicYearSavedFeedback, setAcademicYearSavedFeedback] = useState<boolean>(false);

  // Filter registrations by Academic Year
  const [filterRegAcademicYear, setFilterRegAcademicYear] = useState<string>('all');

  // Filter courses in table by semester
  const [filterCourseSemester, setFilterCourseSemester] = useState<string>('all');

  // Filter registrations by semester and class
  const [filterRegSemester, setFilterRegSemester] = useState<'all' | 'Semester 3' | 'Semester 5' | 'gabungan'>('all');
  const [filterRegClass, setFilterRegClass] = useState<string>('all');

  // Editing course state
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSks, setEditSks] = useState(2);
  const [editProdi, setEditProdi] = useState<'agroteknologi' | 'agribisnis'>('agroteknologi');
  const [editSemester, setEditSemester] = useState<number>(3);
  const [editClasses, setEditClasses] = useState<string[]>([]);

  // Dedicated In-App Modals for Course Management (Anti-Gagal dalam Iframe)
  const [isEditCourseModalOpen, setIsEditCourseModalOpen] = useState(false);
  const [courseBeingEdited, setCourseBeingEdited] = useState<CourseItem | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<CourseItem | null>(null);
  const [isResetCoursesModalOpen, setIsResetCoursesModalOpen] = useState(false);
  const [courseFeedback, setCourseFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // In-app Confirmations for Registrations and Users (No blocked window.confirm)
  const [registrationToDelete, setRegistrationToDelete] = useState<SimpleRegistration | null>(null);
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);

  // Superadmin: Note editing state
  const [noteDraft, setNoteDraft] = useState(adminSettings.classNote);
  const [noteSavedFeedback, setNoteSavedFeedback] = useState(false);

  // Superadmin: Class options management state
  const [newClassName, setNewClassName] = useState('');
  const [editingClassIndex, setEditingClassIndex] = useState<number | null>(null);
  const [editClassValue, setEditClassValue] = useState('');

  // Superadmin: Fee per SKS by Batch management state
  const [feeEnabled, setFeeEnabled] = useState<boolean>(adminSettings.feePerSksEnabled ?? true);
  const [costPerSks, setCostPerSks] = useState<number>(adminSettings.costPerSks ?? 50000);
  const [selectedPaidBatches, setSelectedPaidBatches] = useState<string[]>(
    adminSettings.paidBatches ?? ['2020', '2021', '2022']
  );
  const [paymentInstructionsDraft, setPaymentInstructionsDraft] = useState<string>(
    adminSettings.paymentInstructions ?? DEFAULT_ADMIN_SETTINGS.paymentInstructions
  );
  const [paymentAccountInfoDraft, setPaymentAccountInfoDraft] = useState<string>(
    adminSettings.paymentAccountInfo ?? DEFAULT_ADMIN_SETTINGS.paymentAccountInfo
  );
  const [newCustomBatch, setNewCustomBatch] = useState<string>('');
  const [feeSavedFeedback, setFeeSavedFeedback] = useState<boolean>(false);

  // Superadmin: Max SKS Settings state (Default 24 SKS & Batch specific rules)
  const [defaultMaxSksInput, setDefaultMaxSksInput] = useState<number>(
    adminSettings.defaultMaxSks ?? 24
  );
  const [batchMaxSksConfig, setBatchMaxSksConfig] = useState<Record<string, number>>(
    adminSettings.batchMaxSks ?? (DEFAULT_ADMIN_SETTINGS.batchMaxSks || {})
  );
  const [selectedBatchForLimit, setSelectedBatchForLimit] = useState<string>('2020');
  const [customBatchLimitSks, setCustomBatchLimitSks] = useState<number>(20);
  const [newCustomBatchForLimit, setNewCustomBatchForLimit] = useState<string>('');
  const [maxSksSavedFeedback, setMaxSksSavedFeedback] = useState<boolean>(false);

  // Superadmin: Semester Registration Schedules (Buka / Tutup & Rentang Waktu)
  const [semesterSchedulesDraft, setSemesterSchedulesDraft] = useState<Record<string, SemesterSchedule>>(
    adminSettings.semesterSchedules ?? (DEFAULT_ADMIN_SETTINGS.semesterSchedules || {})
  );
  const [scheduleSavedFeedback, setScheduleSavedFeedback] = useState<boolean>(false);
  const [activeScheduleTab, setActiveScheduleTab] = useState<'3' | '5'>('3');

  // Superadmin: Kelas Beasiswa & Pembatasan Kelas Mengulang Per Semester
  const [restrictedRepeatClassesDraft, setRestrictedRepeatClassesDraft] = useState<Record<string, string[]>>(
    adminSettings.restrictedRepeatClasses ?? (DEFAULT_ADMIN_SETTINGS.restrictedRepeatClasses || {})
  );
  const [restrictedRepeatClassReasonDraft, setRestrictedRepeatClassReasonDraft] = useState<Record<string, string>>(
    adminSettings.restrictedRepeatClassReason ?? (DEFAULT_ADMIN_SETTINGS.restrictedRepeatClassReason || {})
  );
  const [activeScholarshipSemesterTab, setActiveScholarshipSemesterTab] = useState<'3' | '5'>('3');
  const [newCustomScholarshipClass, setNewCustomScholarshipClass] = useState<string>('');
  const [scholarshipSavedFeedback, setScholarshipSavedFeedback] = useState<boolean>(false);

  // BAAK: Modal & State Import Master Matakuliah
  const [isCourseImportModalOpen, setIsCourseImportModalOpen] = useState(false);
  const [importParsedCourses, setImportParsedCourses] = useState<CourseItem[]>([]);
  const [importCourseError, setImportCourseError] = useState<string | null>(null);
  const [importCourseSuccess, setImportCourseSuccess] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');

  // Sync if adminSettings changes externally
  useEffect(() => {
    setFeeEnabled(adminSettings.feePerSksEnabled ?? true);
    setCostPerSks(adminSettings.costPerSks ?? 50000);
    setSelectedPaidBatches(adminSettings.paidBatches ?? ['2020', '2021', '2022']);
    setPaymentInstructionsDraft(adminSettings.paymentInstructions ?? DEFAULT_ADMIN_SETTINGS.paymentInstructions);
    setPaymentAccountInfoDraft(adminSettings.paymentAccountInfo ?? DEFAULT_ADMIN_SETTINGS.paymentAccountInfo);
    setDefaultMaxSksInput(adminSettings.defaultMaxSks ?? 24);
    setBatchMaxSksConfig(adminSettings.batchMaxSks ?? (DEFAULT_ADMIN_SETTINGS.batchMaxSks || {}));
    setSemesterSchedulesDraft(adminSettings.semesterSchedules ?? (DEFAULT_ADMIN_SETTINGS.semesterSchedules || {}));
    setRestrictedRepeatClassesDraft(adminSettings.restrictedRepeatClasses ?? (DEFAULT_ADMIN_SETTINGS.restrictedRepeatClasses || {}));
    setRestrictedRepeatClassReasonDraft(adminSettings.restrictedRepeatClassReason ?? (DEFAULT_ADMIN_SETTINGS.restrictedRepeatClassReason || {}));
    setActiveAcademicYearDraft(adminSettings.activeAcademicYear ?? '2025/2026');
    setActiveTermDraft(adminSettings.activeTerm ?? 'Ganjil');
    setAvailableYearsDraft(adminSettings.availableAcademicYears ?? ['2023/2024', '2024/2025', '2025/2026', '2026/2027']);
  }, [adminSettings]);

  // Add course handler (FITUR 1 dengan Semester & Feedback In-App & Tahun Ajaran)
  const handleAddCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim()) {
      setCourseFeedback({ type: 'error', message: 'Nama mata kuliah tidak boleh kosong.' });
      return;
    }

    const targetYear = newCourseAcademicYear || (selectedCourseYear === 'all' ? currentActiveAcademicYear : selectedCourseYear);
    const newCourse: CourseItem = {
      id: `custom-${Date.now()}`,
      name: newCourseName.trim(),
      sks: Number(newCourseSks) || 1,
      prodi: newCourseProdi,
      semester: Number(newCourseSemester) || 3,
      academicYear: targetYear,
      availableClasses: adminSettings.classOptions
    };

    onUpdateCourses([...courses, newCourse]);
    setNewCourseName('');
    setNewCourseSks(2);
    setCourseFeedback({
      type: 'success',
      message: `Mata kuliah "${newCourse.name}" (${newCourse.sks} SKS, Semester ${newCourse.semester}, T.A. ${newCourse.academicYear}) berhasil ditambahkan!`
    });
    setTimeout(() => setCourseFeedback(null), 3500);
  };

  // Start editing course via dedicated Modal
  const handleStartEdit = (course: CourseItem) => {
    setCourseBeingEdited(course);
    setEditName(course.name);
    setEditSks(course.sks);
    setEditProdi(course.prodi as any);
    setEditSemester(course.semester || 3);
    setEditAcademicYear(course.academicYear || currentActiveAcademicYear);
    setEditClasses(course.availableClasses && course.availableClasses.length > 0 ? course.availableClasses : adminSettings.classOptions);
    setCourseFeedback(null);
    setIsEditCourseModalOpen(true);
  };

  // Save edited course from Modal
  const handleSaveCourseFromModal = () => {
    if (!editName.trim()) {
      setCourseFeedback({ type: 'error', message: 'Nama mata kuliah tidak boleh kosong.' });
      return;
    }
    if (!courseBeingEdited) return;

    const updated = courses.map(c => {
      if (c.id === courseBeingEdited.id) {
        return {
          ...c,
          name: editName.trim(),
          sks: Number(editSks) || 1,
          prodi: editProdi,
          semester: Number(editSemester) || 3,
          academicYear: editAcademicYear || c.academicYear || currentActiveAcademicYear,
          availableClasses: editClasses.length > 0 ? editClasses : adminSettings.classOptions
        };
      }
      return c;
    });

    onUpdateCourses(updated);
    setIsEditCourseModalOpen(false);
    setCourseBeingEdited(null);
    setCourseFeedback({
      type: 'success',
      message: `Mata kuliah "${editName.trim()}" (${editSks} SKS, Semester ${editSemester}) berhasil diperbarui!`
    });
    setTimeout(() => setCourseFeedback(null), 3500);
  };

  // Salin Semua Matkul dari Satu Tahun Ajaran ke Tahun Ajaran Lain (Fitur Duplikasi Cepat)
  const handleCopyCourses = () => {
    if (!copySourceYear || !copyTargetYear) return;
    if (copySourceYear === copyTargetYear) {
      alert('Tahun ajaran asal dan tujuan tidak boleh sama.');
      return;
    }
    const sourceCourses = courses.filter(c => (c.academicYear || '2025/2026') === copySourceYear);
    if (sourceCourses.length === 0) {
      alert(`Tidak ada mata kuliah pada Tahun Ajaran ${copySourceYear} untuk disalin.`);
      return;
    }

    const cloned: CourseItem[] = sourceCourses.map(c => ({
      ...c,
      id: `clone-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      academicYear: copyTargetYear
    }));

    onUpdateCourses([...courses, ...cloned]);
    setIsCopyCoursesModalOpen(false);
    setSelectedCourseYear(copyTargetYear);
    setCourseFeedback({
      type: 'success',
      message: `Berhasil menduplikasi ${cloned.length} mata kuliah dari T.A. ${copySourceYear} ke T.A. ${copyTargetYear}!`
    });
    setTimeout(() => setCourseFeedback(null), 4000);
  };

  // Simpan Pengaturan Tahun Ajaran Aktif (Superadmin / BAAK)
  const handleSaveAcademicYearSettings = () => {
    onUpdateSettings({
      ...adminSettings,
      activeAcademicYear: activeAcademicYearDraft,
      activeTerm: activeTermDraft,
      availableAcademicYears: availableYearsDraft
    });
    setAcademicYearSavedFeedback(true);
    setTimeout(() => setAcademicYearSavedFeedback(false), 2500);
  };

  // Tambah Tahun Ajaran Baru ke Daftar
  const handleAddNewAcademicYearOption = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newAcademicYearInput.trim();
    if (!clean) return;
    if (availableYearsDraft.includes(clean)) {
      alert(`Tahun ajaran "${clean}" sudah ada dalam daftar.`);
      return;
    }
    const updated = [...availableYearsDraft, clean];
    setAvailableYearsDraft(updated);
    onUpdateSettings({
      ...adminSettings,
      availableAcademicYears: updated
    });
    setNewAcademicYearInput('');
  };

  // Confirm delete course (from Modal)
  const handleConfirmDeleteCourse = () => {
    if (!courseToDelete) return;
    const name = courseToDelete.name;
    onUpdateCourses(courses.filter(c => c.id !== courseToDelete.id));
    setCourseToDelete(null);
    setCourseFeedback({
      type: 'success',
      message: `Mata kuliah "${name}" berhasil dihapus dari sistem.`
    });
    setTimeout(() => setCourseFeedback(null), 3500);
  };

  // Confirm reset to default 18 courses (from Modal)
  const handleConfirmResetCourses = () => {
    onUpdateCourses(INITIAL_COURSES);
    setIsResetCoursesModalOpen(false);
    setCourseFeedback({
      type: 'success',
      message: 'Daftar mata kuliah berhasil dikembalikan ke 18 mata kuliah bawaan FP INSTIPER.'
    });
    setTimeout(() => setCourseFeedback(null), 3500);
  };

  // Save Note (Superadmin Note feature)
  const handleSaveNote = () => {
    onUpdateSettings({
      ...adminSettings,
      classNote: noteDraft.trim()
    });
    setNoteSavedFeedback(true);
    setTimeout(() => setNoteSavedFeedback(false), 2500);
  };

  // Reset Note to Default
  const handleResetNote = () => {
    setNoteDraft(DEFAULT_ADMIN_SETTINGS.classNote);
    onUpdateSettings({
      ...adminSettings,
      classNote: DEFAULT_ADMIN_SETTINGS.classNote
    });
    setNoteSavedFeedback(true);
    setTimeout(() => setNoteSavedFeedback(false), 2500);
  };

  // Add Class Option
  const handleAddClassOption = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newClassName.trim();
    if (!trimmed) return;

    if (adminSettings.classOptions.includes(trimmed)) {
      alert(`Opsi "${trimmed}" sudah ada dalam daftar.`);
      return;
    }

    const updatedOptions = [...adminSettings.classOptions, trimmed];
    onUpdateSettings({
      ...adminSettings,
      classOptions: updatedOptions
    });
    // Sync courses with the new class option
    const updatedCourses = courses.map(c => ({
      ...c,
      availableClasses: updatedOptions
    }));
    onUpdateCourses(updatedCourses);
    setNewClassName('');
  };

  // Delete Class Option
  const handleDeleteClassOption = (className: string) => {
    if (adminSettings.classOptions.length <= 1) {
      alert('Minimal harus ada 1 opsi kelas aktif.');
      return;
    }
    const updatedOptions = adminSettings.classOptions.filter(c => c !== className);
    onUpdateSettings({
      ...adminSettings,
      classOptions: updatedOptions
    });
    // Sync courses
    const updatedCourses = courses.map(c => ({
      ...c,
      availableClasses: (c.availableClasses || updatedOptions).filter(cls => cls !== className)
    }));
    onUpdateCourses(updatedCourses);
  };

  // Save Edit Class Option
  const handleSaveEditClass = (index: number) => {
    const oldName = adminSettings.classOptions[index];
    const trimmed = editClassValue.trim();
    if (!trimmed) return;

    const updatedOptions = [...adminSettings.classOptions];
    updatedOptions[index] = trimmed;
    onUpdateSettings({
      ...adminSettings,
      classOptions: updatedOptions
    });
    // Sync courses
    const updatedCourses = courses.map(c => ({
      ...c,
      availableClasses: (c.availableClasses || []).map(cls => cls === oldName ? trimmed : cls)
    }));
    onUpdateCourses(updatedCourses);
    setEditingClassIndex(null);
  };

  // Preset Class Options
  const handleApplyPreset = (preset: string[]) => {
    onUpdateSettings({
      ...adminSettings,
      classOptions: preset
    });
    const updatedCourses = courses.map(c => ({
      ...c,
      availableClasses: preset
    }));
    onUpdateCourses(updatedCourses);
  };

  // Toggle batch payment
  const handleToggleBatch = (batchYear: string) => {
    setSelectedPaidBatches(prev => {
      if (prev.includes(batchYear)) {
        return prev.filter(b => b !== batchYear);
      } else {
        return [...prev, batchYear].sort();
      }
    });
  };

  // Add custom batch year
  const handleAddCustomBatch = () => {
    const trimmed = newCustomBatch.trim();
    if (!trimmed) return;
    if (selectedPaidBatches.includes(trimmed)) {
      alert(`Angkatan ${trimmed} sudah ada dalam daftar.`);
      return;
    }
    setSelectedPaidBatches(prev => [...prev, trimmed].sort());
    setNewCustomBatch('');
  };

  // Save fee settings (Superadmin)
  const handleSaveFeeSettings = () => {
    onUpdateSettings({
      ...adminSettings,
      feePerSksEnabled: feeEnabled,
      costPerSks: Number(costPerSks) || 0,
      paidBatches: selectedPaidBatches,
      paymentInstructions: paymentInstructionsDraft.trim(),
      paymentAccountInfo: paymentAccountInfoDraft.trim()
    });
    setFeeSavedFeedback(true);
    setTimeout(() => setFeeSavedFeedback(false), 2500);
  };

  // Save max SKS settings (Superadmin)
  const handleSaveMaxSksSettings = (
    overrideConfig?: Record<string, number>,
    overrideDefault?: number
  ) => {
    const finalDefault = overrideDefault !== undefined ? overrideDefault : (Number(defaultMaxSksInput) || 24);
    const finalConfig = overrideConfig !== undefined ? overrideConfig : batchMaxSksConfig;

    onUpdateSettings({
      ...adminSettings,
      defaultMaxSks: finalDefault,
      batchMaxSks: finalConfig
    });
    setMaxSksSavedFeedback(true);
    setTimeout(() => setMaxSksSavedFeedback(false), 2500);
  };

  // Set or update custom limit for a batch
  const handleSetBatchLimit = (batch: string, sks: number) => {
    const cleanBatch = batch.trim();
    if (!cleanBatch) return;
    const cleanSks = Math.max(1, Math.min(36, Number(sks) || 24));
    const nextConfig = {
      ...batchMaxSksConfig,
      [cleanBatch]: cleanSks
    };
    setBatchMaxSksConfig(nextConfig);
    handleSaveMaxSksSettings(nextConfig);
  };

  // Remove custom limit for a batch (reverts to default)
  const handleRemoveBatchLimit = (batch: string) => {
    const nextConfig = { ...batchMaxSksConfig };
    delete nextConfig[batch];
    setBatchMaxSksConfig(nextConfig);
    handleSaveMaxSksSettings(nextConfig);
  };

  // Apply quick SKS Presets
  const handleApplySksPreset = (type: 'all-default' | 'seniors-20' | 'seniors-graduated') => {
    if (type === 'all-default') {
      setDefaultMaxSksInput(24);
      setBatchMaxSksConfig({});
      handleSaveMaxSksSettings({}, 24);
    } else if (type === 'seniors-20') {
      const nextConfig = { '2020': 20, '2021': 20 };
      setDefaultMaxSksInput(24);
      setBatchMaxSksConfig(nextConfig);
      handleSaveMaxSksSettings(nextConfig, 24);
    } else if (type === 'seniors-graduated') {
      const nextConfig = { '2020': 18, '2021': 20, '2022': 22 };
      setDefaultMaxSksInput(24);
      setBatchMaxSksConfig(nextConfig);
      handleSaveMaxSksSettings(nextConfig, 24);
    }
  };

  // Helper: Format Date to input datetime-local string YYYY-MM-DDTHH:mm
  const toLocalDatetimeValue = (date: Date): string => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  // Save Semester Registration Schedules (Superadmin)
  const handleSaveScheduleSettings = (overrideSchedules?: Record<string, SemesterSchedule>) => {
    const finalSchedules = overrideSchedules !== undefined ? overrideSchedules : semesterSchedulesDraft;
    onUpdateSettings({
      ...adminSettings,
      semesterSchedules: finalSchedules
    });
    setScheduleSavedFeedback(true);
    setTimeout(() => setScheduleSavedFeedback(false), 2500);
  };

  // Update a field in a semester's schedule
  const handleUpdateSchedule = (semKey: string, updates: Partial<SemesterSchedule>) => {
    const current = semesterSchedulesDraft[semKey] || {
      semester: Number(semKey),
      isOpen: true,
      useSchedule: true,
      startDate: '2026-10-01T08:00',
      endDate: '2026-11-30T23:59',
      closedMessage: `Pendaftaran Mengulang Semester ${semKey} saat ini ditutup oleh pihak Fakultas Pertanian.`
    };
    const next = {
      ...semesterSchedulesDraft,
      [semKey]: {
        ...current,
        ...updates
      }
    };
    setSemesterSchedulesDraft(next);
  };

  // Quick preset actions for a semester schedule
  const handleApplySchedulePreset = (semKey: string, presetType: '1week' | '2weeks' | '1month' | 'permanent' | 'close') => {
    const now = new Date();
    let updates: Partial<SemesterSchedule> = {};

    if (presetType === 'close') {
      updates = { isOpen: false };
    } else if (presetType === 'permanent') {
      updates = { isOpen: true, useSchedule: false };
    } else {
      const start = new Date(now);
      const end = new Date(now);
      if (presetType === '1week') end.setDate(end.getDate() + 7);
      if (presetType === '2weeks') end.setDate(end.getDate() + 14);
      if (presetType === '1month') end.setDate(end.getDate() + 30);
      end.setHours(23, 59, 0, 0);

      updates = {
        isOpen: true,
        useSchedule: true,
        startDate: toLocalDatetimeValue(start),
        endDate: toLocalDatetimeValue(end)
      };
    }

    const current = semesterSchedulesDraft[semKey] || {
      semester: Number(semKey),
      isOpen: true,
      useSchedule: true,
      startDate: '',
      endDate: '',
      closedMessage: `Pendaftaran Mengulang Semester ${semKey} saat ini ditutup oleh pihak Fakultas Pertanian.`
    };
    const next = {
      ...semesterSchedulesDraft,
      [semKey]: {
        ...current,
        ...updates
      }
    };
    setSemesterSchedulesDraft(next);
    handleSaveScheduleSettings(next);
  };

  // Mass open / close all semesters
  const handleToggleAllSemesters = (isOpen: boolean) => {
    const next: Record<string, SemesterSchedule> = { ...semesterSchedulesDraft };
    ['3', '5'].forEach(semKey => {
      const current = next[semKey] || {
        semester: Number(semKey),
        isOpen: true,
        useSchedule: false,
        startDate: '',
        endDate: '',
        closedMessage: `Pendaftaran Mengulang Semester ${semKey} saat ini ditutup oleh pihak Fakultas Pertanian.`
      };
      next[semKey] = {
        ...current,
        isOpen
      };
    });
    setSemesterSchedulesDraft(next);
    handleSaveScheduleSettings(next);
  };

  // ==========================================
  // HANDLERS: KELAS BEASISWA & PEMBATASAN MENGULANG
  // ==========================================
  const handleSaveScholarshipSettings = (
    overrideClasses?: Record<string, string[]>,
    overrideReasons?: Record<string, string>
  ) => {
    const finalClasses = overrideClasses !== undefined ? overrideClasses : restrictedRepeatClassesDraft;
    const finalReasons = overrideReasons !== undefined ? overrideReasons : restrictedRepeatClassReasonDraft;
    onUpdateSettings({
      ...adminSettings,
      restrictedRepeatClasses: finalClasses,
      restrictedRepeatClassReason: finalReasons
    });
    setScholarshipSavedFeedback(true);
    setTimeout(() => setScholarshipSavedFeedback(false), 2500);
  };

  const handleToggleClassRestriction = (semKey: string, className: string) => {
    const currentList = restrictedRepeatClassesDraft[semKey] || [];
    const nextList = currentList.includes(className)
      ? currentList.filter(c => c !== className)
      : [...currentList, className];
    const nextDraft = {
      ...restrictedRepeatClassesDraft,
      [semKey]: nextList
    };
    setRestrictedRepeatClassesDraft(nextDraft);
    handleSaveScholarshipSettings(nextDraft);
  };

  const handleAddCustomScholarshipClass = (semKey: string) => {
    const trimmed = newCustomScholarshipClass.trim();
    if (!trimmed) return;

    let updatedClassOptions = adminSettings.classOptions;
    if (!updatedClassOptions.includes(trimmed)) {
      updatedClassOptions = [...updatedClassOptions, trimmed];
    }

    const currentList = restrictedRepeatClassesDraft[semKey] || [];
    const nextList = currentList.includes(trimmed) ? currentList : [...currentList, trimmed];
    const nextDraft = {
      ...restrictedRepeatClassesDraft,
      [semKey]: nextList
    };

    setRestrictedRepeatClassesDraft(nextDraft);
    onUpdateSettings({
      ...adminSettings,
      classOptions: updatedClassOptions,
      restrictedRepeatClasses: nextDraft,
      restrictedRepeatClassReason: restrictedRepeatClassReasonDraft
    });
    setNewCustomScholarshipClass('');
    setScholarshipSavedFeedback(true);
    setTimeout(() => setScholarshipSavedFeedback(false), 2500);
  };

  const handleApplyScholarshipPreset = (presetType: 'standard' | 'clear' | 'all-beasiswa') => {
    let nextDraft: Record<string, string[]> = {};
    if (presetType === 'standard') {
      nextDraft = {
        '3': ['Kelas Beasiswa'],
        '5': ['Kelas Beasiswa', 'Kelas D']
      };
    } else if (presetType === 'clear') {
      nextDraft = {
        '3': [],
        '5': []
      };
    } else if (presetType === 'all-beasiswa') {
      nextDraft = {
        '3': ['Kelas Beasiswa'],
        '5': ['Kelas Beasiswa']
      };
    }
    setRestrictedRepeatClassesDraft(nextDraft);
    handleSaveScholarshipSettings(nextDraft);
  };

  // ==========================================
  // HANDLERS: IMPORT MASTER MATAKULIAH (BAAK)
  // ==========================================
  const handleFileSelectForMasterCourseImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportCourseError(null);
    setImportCourseSuccess(null);

    const result = await parseMasterCoursesFile(file, adminSettings.classOptions);
    if (result.error) {
      setImportCourseError(result.error);
      setImportParsedCourses([]);
    } else {
      setImportParsedCourses(result.courses);
    }
    e.target.value = '';
  };

  const handleConfirmMasterCourseImport = () => {
    if (importParsedCourses.length === 0) return;

    let finalCourses: CourseItem[] = [];
    if (importMode === 'replace') {
      finalCourses = importParsedCourses;
    } else {
      const existingIds = new Set(courses.map(c => c.id));
      const newItems = importParsedCourses.map((c, i) => {
        if (existingIds.has(c.id)) {
          return { ...c, id: `${c.id}-imp-${Date.now()}-${i}` };
        }
        return c;
      });
      finalCourses = [...courses, ...newItems];
    }

    onUpdateCourses(finalCourses);
    setImportCourseSuccess(`Berhasil mengimpor ${importParsedCourses.length} mata kuliah (${importMode === 'replace' ? 'menggantikan daftar lama' : 'ditambahkan ke daftar'})!`);
    setTimeout(() => {
      setIsCourseImportModalOpen(false);
      setImportParsedCourses([]);
      setImportCourseSuccess(null);
    }, 1800);
  };

  // Export registrations to Excel (.xlsx)
  const handleExportExcel = () => {
    if (registrations.length === 0) {
      alert('Belum ada data pendaftar untuk diexport.');
      return;
    }

    // Determine target dataset (if user filtered, inform or export filtered, or export all)
    const exportData = filteredRegistrations.length > 0 ? filteredRegistrations : registrations;

    const isFeeSysActive = adminSettings.feePerSksEnabled ?? true;
    const currentPaidBatches = adminSettings.paidBatches ?? ['2020', '2021', '2022'];
    const currentCostPerSks = adminSettings.costPerSks ?? 50000;

    // Sheet 1: Data Rekap Pendaftar Mahasiswa
    const pendaftarRows = exportData.map((r, index) => {
      const portalLabel = r.targetSemester 
        ? r.targetSemester 
        : (r.selectedCourses.some(c => c.semester === 3) && r.selectedCourses.some(c => c.semester === 5))
          ? 'Gabungan (Sem 3 & 5)'
          : r.selectedCourses[0]?.semester 
            ? `Semester ${r.selectedCourses[0].semester}` 
            : '-';

      const courseNamesFormatted = r.selectedCourses
        .map(c => `${c.name} [${c.selectedClass || 'A'}, ${c.sks} SKS${c.semester ? `, Sem ${c.semester}` : ''}]`)
        .join('; ');

      const isCharged = isFeeSysActive && currentPaidBatches.includes(r.angkatan);
      const tagihanBiaya = isCharged ? r.totalSks * currentCostPerSks : 0;

      return {
        'No': index + 1,
        'ID Registrasi': r.id,
        'Tahun Akademik': r.academicYear || adminSettings.activeAcademicYear || '2025/2026',
        'Periode': r.academicTerm || adminSettings.activeTerm || 'Ganjil',
        'Tanggal Daftar': r.registrationDate,
        'Portal Semester': portalLabel,
        'NIM': r.nim,
        'Nama Mahasiswa': r.nama,
        'Angkatan': r.angkatan,
        'Status Biaya SKS': isCharged ? 'Dikenakan Biaya SKS' : 'Bebas Biaya SKS',
        'Total Tagihan Biaya (Rp)': tagihanBiaya,
        'Kelas Asal': r.kelasAsal,
        'No WhatsApp': r.noWa,
        'Email': r.email,
        'Total SKS': r.totalSks,
        'Jumlah MK': r.selectedCourses.length,
        'Daftar Mata Kuliah Diambil': courseNamesFormatted
      };
    });

    const wsPendaftar = XLSX.utils.json_to_sheet(pendaftarRows);
    wsPendaftar['!cols'] = [
      { wch: 5 },   // No
      { wch: 18 },  // ID
      { wch: 16 },  // Tahun Akademik
      { wch: 12 },  // Periode
      { wch: 18 },  // Tanggal
      { wch: 22 },  // Portal Semester
      { wch: 16 },  // NIM
      { wch: 26 },  // Nama
      { wch: 10 },  // Angkatan
      { wch: 20 },  // Status Biaya SKS
      { wch: 24 },  // Total Tagihan Biaya (Rp)
      { wch: 12 },  // Kelas Asal
      { wch: 16 },  // No WA
      { wch: 26 },  // Email
      { wch: 10 },  // Total SKS
      { wch: 11 },  // Jumlah MK
      { wch: 60 }   // Rincian Mata Kuliah
    ];

    // Sheet 2: Rincian Peserta Per Mata Kuliah (Presensi / Kelas)
    const rincianPesertaRows: any[] = [];
    let rincianCounter = 1;

    exportData.forEach(r => {
      r.selectedCourses.forEach(c => {
        rincianPesertaRows.push({
          'No': rincianCounter++,
          'Tahun Akademik': r.academicYear || adminSettings.activeAcademicYear || '2025/2026',
          'Semester MK': c.semester ? `Semester ${c.semester}` : '-',
          'Nama Mata Kuliah': c.name,
          'SKS': c.sks,
          'Opsi Kelas Dipilih': c.selectedClass || 'Kelas A',
          'NIM': r.nim,
          'Nama Mahasiswa': r.nama,
          'Angkatan': r.angkatan,
          'Kelas Asal': r.kelasAsal,
          'No WhatsApp': r.noWa,
          'Tanggal Daftar': r.registrationDate,
          'ID Registrasi': r.id
        });
      });
    });

    const wsRincian = XLSX.utils.json_to_sheet(rincianPesertaRows);
    wsRincian['!cols'] = [
      { wch: 5 },
      { wch: 16 }, // Tahun Akademik
      { wch: 14 },
      { wch: 32 },
      { wch: 8 },
      { wch: 18 },
      { wch: 16 },
      { wch: 26 },
      { wch: 10 },
      { wch: 12 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 }
    ];

    // Sheet 3: Rekap Statistik Peminat Mata Kuliah
    const rekapMKRows = courses.map((course, idx) => {
      const pendaftarMK = exportData.filter(r => r.selectedCourses.some(c => c.courseId === course.id));
      const totalSksAkumulasi = pendaftarMK.length * course.sks;
      
      return {
        'No': idx + 1,
        'Semester': `Semester ${course.semester}`,
        'Nama Mata Kuliah': course.name,
        'SKS': course.sks,
        'Program Studi': course.prodi === 'agroteknologi' ? 'Agroteknologi' : 'Agribisnis',
        'Tahun Ajaran': course.academicYear || adminSettings.activeAcademicYear || '2025/2026',
        'Jumlah Pendaftar': pendaftarMK.length,
        'Total Beban SKS': totalSksAkumulasi,
        'Daftar Mahasiswa (NIM - Nama - Kelas)': pendaftarMK.map(r => {
          const sel = r.selectedCourses.find(c => c.courseId === course.id);
          return `${r.nim} (${r.nama} [${sel?.selectedClass || 'A'}])`;
        }).join('; ')
      };
    });

    const wsRekapMK = XLSX.utils.json_to_sheet(rekapMKRows);
    wsRekapMK['!cols'] = [
      { wch: 5 },
      { wch: 13 },
      { wch: 32 },
      { wch: 8 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 15 },
      { wch: 60 }
    ];

    // Create Workbook and append Sheets
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsPendaftar, 'Data Pendaftar');
    XLSX.utils.book_append_sheet(wb, wsRincian, 'Peserta Per Mata Kuliah');
    XLSX.utils.book_append_sheet(wb, wsRekapMK, 'Rekap Peminat MK');

    // Generate filename with date
    const today = new Date().toISOString().slice(0, 10);
    const filterSuffix = (filterRegSemester !== 'all' ? `_${filterRegSemester.replace(/\s+/g, '_')}` : '') +
      (filterRegAcademicYear !== 'all' ? `_TA_${filterRegAcademicYear.replace('/', '-')}` : '');
    const filename = `Data_Pendaftaran_Mengulang_Pertanian${filterSuffix}_${today}.xlsx`;

    // Download Excel file
    XLSX.writeFile(wb, filename);
  };

  // Export registrations to CSV (fallback)
  const handleExportCSV = () => {
    const headers = ['ID Registrasi', 'Tahun Akademik', 'Tanggal Daftar', 'Portal Semester', 'Email', 'Angkatan', 'Nama', 'NIM', 'No WA', 'Kelas Asal', 'Total SKS', 'Matakuliah Terpilih'];
    const rows = filteredRegistrations.map(r => [
      r.id,
      `"${r.academicYear || adminSettings.activeAcademicYear || '2025/2026'}"`,
      `"${r.registrationDate}"`,
      `"${r.targetSemester || '-'}"`,
      `"${r.email}"`,
      r.angkatan,
      `"${r.nama}"`,
      `"${r.nim}"`,
      `"${r.noWa}"`,
      `"${r.kelasAsal}"`,
      r.totalSks,
      `"${r.selectedCourses.map(c => `${c.name} (${c.selectedClass}, ${c.sks} SKS)`).join('; ')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Pendaftaran_Mengulang_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRegistrations = registrations.filter(r => {
    const matchesSearch =
      r.nama.toLowerCase().includes(searchReg.toLowerCase()) ||
      r.nim.includes(searchReg) ||
      r.email.toLowerCase().includes(searchReg.toLowerCase());

    if (!matchesSearch) return false;

    if (filterRegAcademicYear !== 'all') {
      const regYear = r.academicYear || adminSettings.activeAcademicYear || '2025/2026';
      if (regYear !== filterRegAcademicYear) return false;
    }

    if (filterRegSemester === 'Semester 3') {
      return r.targetSemester === 'Semester 3';
    }
    if (filterRegSemester === 'Semester 5') {
      return r.targetSemester === 'Semester 5';
    }
    if (filterRegSemester === 'gabungan') {
      return (
        r.targetSemester?.toLowerCase().includes('gabungan') ||
        r.targetSemester?.toLowerCase().includes('lintas')
      );
    }

    if (filterRegClass !== 'all') {
      const matchClass = r.selectedCourses.some(c => c.selectedClass === filterRegClass) || r.kelasAsal?.includes(filterRegClass);
      if (!matchClass) return false;
    }

    return true;
  });

  return (
    <div className="w-full max-w-[1600px] mx-auto py-4 sm:py-6 px-2 sm:px-4 lg:px-6">
      {/* 2-Column Responsive Dashboard with Dedicated Left Sidebar (Matching FAPERTA CBT Layout) */}
      <div className="admin-panel-container bg-white dark:bg-slate-900 rounded-2xl lg:rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row overflow-hidden min-h-[850px] transition-colors">
        
        {/* ============================================================== */}
        {/* 1. SIDEBAR KIRI (Persis Tampilan Portal CBT Lampiran User) */}
        {/* ============================================================== */}
        <aside className="w-full lg:w-72 bg-white dark:bg-slate-900 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 p-4 sm:p-5 flex flex-col justify-between shrink-0 select-none">
          <div className="space-y-6">
            
            {/* Header Sidebar: Logo INSTIPER + Judul Portal */}
            <div className="flex items-center gap-3 pb-5 border-b border-slate-100 dark:border-slate-800">
              <div className="w-11 h-11 shrink-0 p-0.5 flex items-center justify-center">
                <img src="/logo_instiper.png" alt="Logo INSTIPER" className="w-full h-full object-contain" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-sm tracking-tight text-slate-900 dark:text-white uppercase">
                    PORTAL UJIAN
                  </span>
                  <span className="bg-[#008744] text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    CBT
                  </span>
                </div>
                <p className="text-[11px] font-black text-[#008744] dark:text-emerald-400 mt-0.5 tracking-tight uppercase">
                  FAPERTA INSTIPER
                </p>
              </div>
            </div>

            {/* Kelompok Menu: MENU UTAMA */}
            <div>
              <div className="px-3 pb-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                MENU UTAMA
              </div>
              <nav className="space-y-1">
                {/* Menu: Data Pendaftar */}
                <button
                  type="button"
                  onClick={() => setActiveTab('registrations')}
                  className={`flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                    activeTab === 'registrations'
                      ? 'bg-[#008744] text-white font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Users className={`w-4 h-4 shrink-0 ${activeTab === 'registrations' ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">Data Pendaftar</span>
                  </div>
                  {activeTab === 'registrations' ? (
                    <ChevronRight className="w-4 h-4 text-white shrink-0 ml-1" />
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] rounded-full font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {registrations.length}
                    </span>
                  )}
                </button>

                {/* Menu: Jadwal & Kuota SKS */}
                <button
                  type="button"
                  onClick={() => setActiveTab('superadmin')}
                  className={`flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                    activeTab === 'superadmin'
                      ? 'bg-[#008744] text-white font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CalendarClock className={`w-4 h-4 shrink-0 ${activeTab === 'superadmin' ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">Jadwal &amp; Batas SKS</span>
                  </div>
                  {activeTab === 'superadmin' ? (
                    <ChevronRight className="w-4 h-4 text-white shrink-0 ml-1" />
                  ) : (
                    <span className="px-1.5 py-0.2 text-[9px] rounded-md font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                      Atur
                    </span>
                  )}
                </button>
              </nav>
            </div>

            {/* Kelompok Menu: DATA MASTER */}
            <div>
              <div className="px-3 pb-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                DATA MASTER
              </div>
              <nav className="space-y-1">
                {/* Menu: Mata Kuliah & SKS */}
                <button
                  type="button"
                  onClick={() => setActiveTab('courses')}
                  className={`flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                    activeTab === 'courses'
                      ? 'bg-[#008744] text-white font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <BookOpen className={`w-4 h-4 shrink-0 ${activeTab === 'courses' ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">Mata Kuliah &amp; SKS</span>
                  </div>
                  {activeTab === 'courses' ? (
                    <ChevronRight className="w-4 h-4 text-white shrink-0 ml-1" />
                  ) : (
                    <span className="px-2 py-0.5 text-[10px] rounded-full font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {courses.length}
                    </span>
                  )}
                </button>
              </nav>
            </div>

            {/* Kelompok Menu: SISTEM & KREDENSIAL */}
            {/* Requirement: Kredensial DIBUAT TERPISAH dari Admin BAAK (Khusus Superadmin) */}
            {currentUser?.role === 'superadmin' ? (
              <div>
                <div className="flex items-center justify-between px-3 pb-2">
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    SISTEM &amp; KREDENSIAL
                  </span>
                  <span className="text-[9px] bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 font-black px-1.5 py-0.2 rounded-md border border-amber-300 dark:border-amber-700">
                    SUPERADMIN
                  </span>
                </div>
                <nav className="space-y-1">
                  {/* Menu: Kelola Kredensial User (Terpisah dari Admin BAAK) */}
                  <button
                    type="button"
                    onClick={() => setActiveTab('users')}
                    className={`flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                      activeTab === 'users'
                        ? 'bg-[#008744] text-white font-bold shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
                    }`}
                    title="Kelola Akun, Username & Password Pengelola (Khusus Superadmin - Terpisah dari BAAK)"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <KeyRound className={`w-4 h-4 shrink-0 ${activeTab === 'users' ? 'text-white' : 'text-amber-500'}`} />
                      <span className="truncate">Kelola Kredensial User</span>
                    </div>
                    {activeTab === 'users' ? (
                      <ChevronRight className="w-4 h-4 text-white shrink-0 ml-1" />
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] rounded-full font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200">
                        {managedUsers.length}
                      </span>
                    )}
                  </button>

                  {/* Menu: Backup Data */}
                  <button
                    type="button"
                    onClick={handleBackupData}
                    className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                    title="Unduh Cadangan Lengkap Data Matakuliah, Pendaftar, dan Pengaturan Sistem"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Database className="w-4 h-4 shrink-0 text-slate-400" />
                      <span className="truncate">Backup Data</span>
                    </div>
                    <Download className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  {/* Menu: Portal Keuangan */}
                  {onSwitchToFinance && (
                    <button
                      type="button"
                      onClick={onSwitchToFinance}
                      className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 font-semibold border border-emerald-200 dark:border-emerald-800/60 mt-1"
                      title="Buka Panel Rekapitulasi Keuangan"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Coins className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="truncate">Portal Keuangan</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    </button>
                  )}
                </nav>
              </div>
            ) : (
              /* Khusus Staf BAAK: Backup Data & Info Proteksi Kredensial */
              <div className="pt-2">
                <div className="px-3 pb-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  SISTEM
                </div>
                <button
                  type="button"
                  onClick={handleBackupData}
                  className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                  title="Unduh Cadangan Data Pendaftaran & Matakuliah"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Database className="w-4 h-4 shrink-0 text-slate-400" />
                    <span className="truncate">Backup Data</span>
                  </div>
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                </button>
                <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                  <div className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 mb-1">
                    <Lock className="w-3 h-3 text-amber-500" />
                    <span>Kredensial Terpisah</span>
                  </div>
                  Manajemen akun & kredensial pengelola diproteksi dan hanya dapat diakses melalui login Superadmin.
                </div>
              </div>
            )}

          </div>

          {/* Bagian Bawah Sidebar: Profil Pengguna & Logout */}
          <div className="pt-4 mt-6 border-t border-slate-100 dark:border-slate-800">
            {currentUser && (
              <div className="bg-slate-50 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-[#008744] dark:bg-emerald-400 animate-pulse shrink-0" />
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                      {currentUser.name}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    currentUser.role === 'superadmin' 
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700' 
                      : currentUser.role === 'kaprodi'
                      ? 'bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700'
                      : 'bg-emerald-100 dark:bg-emerald-950 text-[#166534] dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                  }`}>
                    {currentUser.title}
                  </span>
                  {onLogout && (
                    <button
                      type="button"
                      onClick={onLogout}
                      className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-bold cursor-pointer text-[11px]"
                      title="Logout / Keluar"
                    >
                      Logout
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ============================================================== */}
        {/* 2. AREA KONTEN KANAN (Persis Format Header CBT Lampiran) */}
        {/* ============================================================== */}
        <main className="flex-1 min-w-0 bg-[#F8FAF9] dark:bg-[#0B130E] p-4 sm:p-6 lg:p-8 flex flex-col">
          
          {/* Top Header Bar Sisi Kanan: Logo Mini + Judul Halaman + Badge T.A. 2026/2027 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200/80 dark:border-slate-800/80">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center shrink-0 shadow-2xs">
                <img src="/logo_instiper.png" alt="Logo INSTIPER" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {activeTab === 'registrations' && 'Rekap & Data Pendaftar'}
                  {activeTab === 'courses' && 'Mata Kuliah & SKS'}
                  {activeTab === 'superadmin' && 'Jadwal & Kuota SKS'}
                  {activeTab === 'users' && 'Kelola Kredensial Pengelola'}
                </h1>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  <span>Fakultas Pertanian INSTIPER</span>
                  <span>•</span>
                  <span className="bg-emerald-50 dark:bg-emerald-950/60 text-[#008744] dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-bold px-2 py-0.5 rounded-md text-[11px]">
                    T.A. 2026/2027
                  </span>
                </div>
              </div>
            </div>

            {/* Right Header Info Badges */}
            <div className="flex items-center gap-2">
              {activeTab === 'users' && (
                <span className="text-xs bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-bold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-2xs">
                  <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>Akses Khusus Superadmin (Terpisah dari BAAK)</span>
                </span>
              )}
            </div>
          </div>

          {/* Area Konten Tab Dinamis */}
          <div className="flex-1">

        {/* TAB 1: KELOLA MATA KULIAH & SKS (FITUR 1) */}
        {activeTab === 'courses' && (
          <div>
            {/* Feedback Alert Banner */}
            {courseFeedback && (
              <div className={`p-3.5 mb-5 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 shadow-xs animate-fade-in ${
                courseFeedback.type === 'error'
                  ? 'bg-rose-50 text-rose-800 border border-rose-300'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
              }`}>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{courseFeedback.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCourseFeedback(null)}
                  className="text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Toolbar Pemilih Tahun Ajaran & Tombol Duplikasi/Salin Matkul */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[#166534] dark:text-emerald-400 flex items-center justify-center font-bold shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      Katalog Mata Kuliah per Tahun Ajaran
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                      Aktif: T.A. {adminSettings.activeAcademicYear || '2025/2026'} ({adminSettings.activeTerm || 'Ganjil'})
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Kelola mata kuliah secara independen untuk tiap tahun ajaran tanpa risiko merusak data tahun lalu.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <label htmlFor="course-year-select" className="text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0">
                    Pilih TA:
                  </label>
                  <select
                    id="course-year-select"
                    value={selectedCourseYear}
                    onChange={(e) => {
                      setSelectedCourseYear(e.target.value);
                      if (e.target.value !== 'all') {
                        setNewCourseAcademicYear(e.target.value);
                      }
                    }}
                    className="h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-extrabold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534] shadow-2xs cursor-pointer"
                  >
                    <option value="all">Semua Tahun Ajaran ({courses.length} MK)</option>
                    {(adminSettings.availableAcademicYears || ['2023/2024', '2024/2025', '2025/2026', '2026/2027']).map((yr) => (
                      <option key={yr} value={yr}>
                        T.A. {yr} {yr === (adminSettings.activeAcademicYear || '2025/2026') ? '(Aktif)' : ''} ({courses.filter(c => (c.academicYear || '2025/2026') === yr).length} MK)
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCopyCoursesModalOpen(true)}
                  className="h-10 px-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
                  title="Salin/Duplikasi seluruh mata kuliah dari tahun ajaran sebelumnya ke tahun ajaran baru"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin dari Tahun Lalu</span>
                </button>
              </div>
            </div>

            {/* Form Tambah Mata Kuliah Baru */}
            <div className="bg-gradient-to-br from-emerald-50/50 via-white to-slate-50 dark:from-emerald-950/20 dark:via-slate-800/60 dark:to-slate-800/60 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-5 sm:p-6 mb-8 shadow-xs">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-emerald-200/50 dark:border-emerald-800/50">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#166534] text-white flex items-center justify-center font-bold shadow-xs">
                    <PlusCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                      Tambah Mata Kuliah Baru (Katalog Kurikulum)
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                      Tentukan nama mata kuliah, tahun ajaran, semester tawar, beban SKS, dan prodi yang ditawarkan.
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#166534]/10 text-[#166534] dark:text-emerald-300 border border-[#166534]/20">
                  Kurikulum FP
                </span>
              </div>

              <form onSubmit={handleAddCourse} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-4">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Mata Kuliah
                  </label>
                  <input
                    type="text"
                    value={newCourseName}
                    onChange={(e) => setNewCourseName(e.target.value)}
                    placeholder="Contoh: Pengantar Bioteknologi Pertanian"
                    className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#166534] bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Tahun Ajaran
                  </label>
                  <select
                    value={newCourseAcademicYear}
                    onChange={(e) => setNewCourseAcademicYear(e.target.value)}
                    className="w-full h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#166534] bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs cursor-pointer"
                  >
                    {(adminSettings.availableAcademicYears || ['2023/2024', '2024/2025', '2025/2026', '2026/2027']).map((yr) => (
                      <option key={yr} value={yr}>
                        {yr} {yr === (adminSettings.activeAcademicYear || '2025/2026') ? '(Aktif)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Semester
                  </label>
                  <select
                    value={newCourseSemester}
                    onChange={(e) => setNewCourseSemester(Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#166534] bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs cursor-pointer"
                  >
                    <option value={3}>Semester 3</option>
                    <option value={5}>Semester 5</option>
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                    <option value={4}>Semester 4</option>
                    <option value={6}>Semester 6</option>
                    <option value={7}>Semester 7</option>
                    <option value={8}>Semester 8</option>
                  </select>
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 text-center">
                    SKS
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={newCourseSks}
                    onChange={(e) => setNewCourseSks(Number(e.target.value))}
                    className="w-full h-10 px-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#166534] bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs"
                    required
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Prodi
                  </label>
                  <select
                    value={newCourseProdi}
                    onChange={(e) => setNewCourseProdi(e.target.value as any)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#166534] bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-2xs cursor-pointer"
                  >
                    <option value="agroteknologi">Agroteknologi</option>
                    <option value="agribisnis">Agribisnis</option>
                  </select>
                </div>

                <div className="sm:col-span-1">
                  <button
                    type="submit"
                    className="w-full h-10 px-2 bg-[#166534] hover:bg-[#14532D] text-white rounded-xl text-xs font-extrabold shadow-sm transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-98"
                    title="Tambah Mata Kuliah"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>Tambah</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Filter Semester & Header List & Import & Reset */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 flex-wrap">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 px-2">Filter Semester:</span>
                <button
                  type="button"
                  onClick={() => setFilterCourseSemester('all')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    filterCourseSemester === 'all'
                      ? 'bg-[#166534] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700'
                  }`}
                >
                  Semua ({courses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCourseSemester('3')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    filterCourseSemester === '3'
                      ? 'bg-[#166534] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700'
                  }`}
                >
                  🌿 Semester 3 ({courses.filter(c => c.semester === 3).length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterCourseSemester('5')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    filterCourseSemester === '5'
                      ? 'bg-[#166534] text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700'
                  }`}
                >
                  🌾 Semester 5 ({courses.filter(c => c.semester === 5).length})
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Download Template Master */}
                <button
                  type="button"
                  onClick={() => downloadMasterCoursesTemplate('xlsx')}
                  className="px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  title="Unduh Template Excel untuk import master matakuliah"
                >
                  <Download className="w-3.5 h-3.5 text-[#166534] dark:text-emerald-400" />
                  <span>Template MK (.xlsx)</span>
                </button>

                {/* Import Master Matakuliah */}
                <button
                  type="button"
                  onClick={() => {
                    setImportParsedCourses([]);
                    setImportCourseError(null);
                    setImportCourseSuccess(null);
                    setIsCourseImportModalOpen(true);
                  }}
                  className="px-3.5 py-2 bg-[#166534] hover:bg-[#14532D] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  title="Import daftar mata kuliah, SKS dan kelas dari Excel atau CSV"
                >
                  <FileUp className="w-3.5 h-3.5" />
                  <span>Import Matakuliah &amp; SKS</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsResetCoursesModalOpen(true)}
                  className="text-xs text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 font-semibold cursor-pointer px-2 py-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Bawaan</span>
                </button>
              </div>
            </div>

            {/* Courses Table */}
            <div className="border border-slate-300 rounded-lg overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 font-bold border-b border-slate-300 text-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 w-12 text-center">No</th>
                    <th className="py-2.5 px-3">Nama Mata Kuliah</th>
                    <th className="py-2.5 px-3 w-28 text-center">Semester</th>
                    <th className="py-2.5 px-3 w-24 text-center">Beban SKS</th>
                    <th className="py-2.5 px-3 w-32">Program Studi</th>
                    <th className="py-2.5 px-3">Opsi Kelas Ditawarkan</th>
                    <th className="py-2.5 px-3 w-28 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {courses
                    .filter(c => {
                      if (selectedCourseYear !== 'all' && (c.academicYear || '2025/2026') !== selectedCourseYear) {
                        return false;
                      }
                      if (filterCourseSemester !== 'all' && String(c.semester) !== filterCourseSemester) {
                        return false;
                      }
                      return true;
                    })
                    .map((course, idx) => {
                      const isEditing = editingCourseId === course.id;

                      return (
                        <tr key={course.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 text-center font-bold text-slate-500">
                            {idx + 1}
                          </td>

                          {/* Nama MK */}
                          <td className="py-2.5 px-3">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-2 py-1 rounded border border-blue-400 text-xs font-semibold"
                              />
                            ) : (
                              <span className="font-medium text-slate-900">{course.name}</span>
                            )}
                          </td>

                          {/* Semester */}
                          <td className="py-2.5 px-3 text-center">
                            {isEditing ? (
                              <select
                                value={editSemester}
                                onChange={(e) => setEditSemester(Number(e.target.value))}
                                className="px-2 py-1 rounded border border-blue-400 text-xs font-bold"
                              >
                                <option value={3}>Sem 3</option>
                                <option value={5}>Sem 5</option>
                                <option value={1}>Sem 1</option>
                                <option value={2}>Sem 2</option>
                                <option value={4}>Sem 4</option>
                                <option value={6}>Sem 6</option>
                                <option value={7}>Sem 7</option>
                              </select>
                            ) : (
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                course.semester === 3
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : course.semester === 5
                                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                Sem {course.semester || 3}
                              </span>
                            )}
                          </td>

                          {/* SKS */}
                          <td className="py-2.5 px-3 text-center">
                            {isEditing ? (
                              <input
                                type="number"
                                min={1}
                                max={6}
                                value={editSks}
                                onChange={(e) => setEditSks(Number(e.target.value))}
                                className="w-16 px-1 py-1 rounded border border-blue-400 text-xs text-center font-bold"
                              />
                            ) : (
                              <span className="font-bold text-blue-900 px-2 py-0.5 bg-blue-50 rounded border border-blue-200">
                                {course.sks} SKS
                              </span>
                            )}
                          </td>

                          {/* Prodi */}
                          <td className="py-2.5 px-3">
                            {isEditing ? (
                              <select
                                value={editProdi}
                                onChange={(e) => setEditProdi(e.target.value as any)}
                                className="px-2 py-1 rounded border border-blue-400 text-xs"
                              >
                                <option value="agroteknologi">Agroteknologi</option>
                                <option value="agribisnis">Agribisnis</option>
                              </select>
                            ) : (
                              <span className="capitalize text-slate-700 font-medium">
                                {course.prodi}
                              </span>
                            )}
                          </td>

                          {/* Opsi Kelas Ditawarkan */}
                          <td className="py-2.5 px-3">
                            {isEditing ? (
                              <div className="space-y-1">
                                <div className="flex flex-wrap gap-1">
                                  {adminSettings.classOptions.map((cls) => {
                                    const isChosen = editClasses.includes(cls);
                                    return (
                                      <button
                                        key={cls}
                                        type="button"
                                        onClick={() => {
                                          if (isChosen) {
                                            if (editClasses.length > 1) {
                                              setEditClasses(editClasses.filter(c => c !== cls));
                                            }
                                          } else {
                                            setEditClasses([...editClasses, cls]);
                                          }
                                        }}
                                        className={`px-1.5 py-0.5 text-[10px] rounded font-bold border transition-colors cursor-pointer ${
                                          isChosen
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                            : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-50'
                                        }`}
                                      >
                                        {cls}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px]">
                                  <button
                                    type="button"
                                    onClick={() => setEditClasses(adminSettings.classOptions)}
                                    className="text-blue-600 hover:underline font-semibold cursor-pointer"
                                  >
                                    Pilih Semua
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {(course.availableClasses && course.availableClasses.length > 0 ? course.availableClasses : adminSettings.classOptions).map((cls) => {
                                  const isScholarship = isClassRestrictedForRepeat(cls, course.semester, adminSettings);
                                  return (
                                    <span
                                      key={cls}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                        isScholarship
                                          ? 'bg-rose-50 text-rose-700 border-rose-300'
                                          : 'bg-slate-100 text-slate-700 border-slate-200'
                                      }`}
                                      title={isScholarship ? `Kelas Beasiswa (Semester ${course.semester}): Dilarang untuk mengulang` : 'Kelas Reguler'}
                                    >
                                      {cls}
                                      {isScholarship && <span className="ml-1 text-[9px] text-rose-600 font-extrabold">🚫 Beasiswa</span>}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleStartEdit(course)}
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                                title="Edit Mata Kuliah, Semester & SKS"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setCourseToDelete(course)}
                                className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                                title="Hapus Mata Kuliah"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>

              {/* Mobile Card View for Courses (HP-friendly, tidak butuh scroll horizontal) */}
              <div className="md:hidden divide-y divide-slate-200 border-t border-slate-200 bg-white">
                {courses
                  .filter(c => {
                    if (selectedCourseYear !== 'all' && (c.academicYear || '2025/2026') !== selectedCourseYear) {
                      return false;
                    }
                    if (filterCourseSemester !== 'all' && String(c.semester) !== filterCourseSemester) {
                      return false;
                    }
                    return true;
                  })
                  .map((course, idx) => (
                    <div key={course.id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[10px] text-slate-500 font-bold">#{idx + 1}</span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              course.semester === 3
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : course.semester === 5
                                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              Semester {course.semester || 3}
                            </span>
                            <span className="capitalize text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                              {course.prodi}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 mt-1">{course.name}</h4>
                        </div>
                        <span className="font-extrabold text-xs text-[#009A44] bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0">
                          {course.sks} SKS
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {(course.availableClasses || adminSettings.classOptions).slice(0, 4).map(cls => (
                            <span key={cls} className="text-[9px] font-bold px-1.5 py-0.2 bg-slate-100 text-slate-700 rounded border border-slate-200">
                              {cls}
                            </span>
                          ))}
                          {(course.availableClasses || adminSettings.classOptions).length > 4 && (
                            <span className="text-[9px] text-slate-500 font-semibold">
                              +{(course.availableClasses || adminSettings.classOptions).length - 4} kelas
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(course)}
                            className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 flex items-center gap-1 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setCourseToDelete(course)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SUPERADMIN - KELOLA OPSI KELAS & EDIT NOTE */}
        {activeTab === 'superadmin' && (
          <div className="space-y-8">

            {/* ============================================================== */}
            {/* FITUR 0: PENGATURAN TAHUN AJARAN & SEMESTER BERJALAN (MASTER PERIODE) */}
            {/* ============================================================== */}
            <div className="bg-gradient-to-br from-emerald-50 via-teal-50/40 to-white dark:from-emerald-950/30 dark:via-slate-800/80 dark:to-slate-800/80 border-2 border-[#166534] dark:border-emerald-600 rounded-2xl p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-5 border-b border-emerald-200 dark:border-emerald-800/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#166534] text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                    <Calendar className="w-5 h-5 text-yellow-300" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
                      Master Periode Tahun Ajaran &amp; Semester Berjalan
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-[#166534] border border-emerald-300">
                        BAAK / Superadmin
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Tentukan Tahun Ajaran dan Semester yang sedang dibuka untuk pendaftaran mahasiswa mengulang.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {academicYearSavedFeedback && (
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-300 animate-fade-in flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      Periode Tersimpan!
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveAcademicYearSettings}
                    className="h-10 px-5 bg-[#166534] hover:bg-[#14532D] text-white rounded-xl text-xs font-extrabold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Periode Aktif</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                {/* Kolom 1: Pemilihan Tahun Ajaran Aktif */}
                <div className="md:col-span-4 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tahun Ajaran Aktif (Pendaftaran Dibuka):
                  </label>
                  <select
                    value={activeAcademicYearDraft}
                    onChange={(e) => setActiveAcademicYearDraft(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-black text-[#166534] dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-[#166534] cursor-pointer"
                  >
                    {availableYearsDraft.map((yr) => (
                      <option key={yr} value={yr}>
                        Tahun Akademik {yr}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-slate-500">
                    Portal mahasiswa otomatis hanya menampilkan matkul terdaftar pada T.A. ini.
                  </p>
                </div>

                {/* Kolom 2: Pemilihan Semester Berjalan */}
                <div className="md:col-span-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Semester Periode:
                  </label>
                  <select
                    value={activeTermDraft}
                    onChange={(e) => setActiveTermDraft(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-black text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534] cursor-pointer"
                  >
                    <option value="Ganjil">Semester Ganjil</option>
                    <option value="Genap">Semester Genap</option>
                    <option value="Antara">Semester Antara / SP</option>
                  </select>
                  <p className="text-[11px] text-slate-500">
                    Dicantumkan resmi pada lembar cetak hasil KRS pendaftar.
                  </p>
                </div>

                {/* Kolom 3: Tambah Pilihan Tahun Ajaran Baru */}
                <div className="md:col-span-5 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-3">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Tambah Tahun Ajaran Baru ke Daftar:
                  </label>
                  <form onSubmit={handleAddNewAcademicYearOption} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newAcademicYearInput}
                      onChange={(e) => setNewAcademicYearInput(e.target.value)}
                      placeholder="Contoh: 2026/2027"
                      className="flex-1 h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#166534]"
                    />
                    <button
                      type="submit"
                      className="h-10 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer"
                    >
                      + Tambah TA
                    </button>
                  </form>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {availableYearsDraft.map((yr) => (
                      <span
                        key={yr}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          yr === activeAcademicYearDraft
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {yr} {yr === activeAcademicYearDraft ? '(Aktif)' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* FITUR BUKA / TUTUP PENDAFTARAN BERDASARKAN SEMESTER & JADWAL PERIODE */}
            {/* ============================================================== */}
            <div className="bg-gradient-to-br from-emerald-50/80 via-teal-50/50 to-slate-50 border-2 border-emerald-400 rounded-xl p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-emerald-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <CalendarClock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-emerald-950 flex items-center gap-2">
                      Pengaturan Buka / Tutup Pendaftaran Berdasarkan Semester & Rentang Jadwal
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300">
                        Superadmin
                      </span>
                    </h3>
                    <p className="text-[11px] text-emerald-800">
                      Buka atau tutup akses pendaftaran per semester (Semester 3 atau Semester 5), serta tentukan rentang tanggal dan jam kapan pendaftaran dibuka secara otomatis.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {scheduleSavedFeedback && (
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1 border border-emerald-300">
                      <Check className="w-3 h-3" />
                      Jadwal Tersimpan!
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleToggleAllSemesters(true)}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                    title="Buka pendaftaran untuk semua semester sekarang"
                  >
                    Buka Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAllSemesters(false)}
                    className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                    title="Tutup pendaftaran untuk semua semester sekarang"
                  >
                    Tutup Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveScheduleSettings()}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Simpan Jadwal
                  </button>
                </div>
              </div>

              {/* SEMESTER CARDS (SEMESTER 3 & SEMESTER 5) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
                {(['3', '5'] as const).map((semKey) => {
                  const schedule = semesterSchedulesDraft[semKey] || {
                    semester: Number(semKey),
                    isOpen: true,
                    useSchedule: true,
                    startDate: '2026-10-01T08:00',
                    endDate: '2026-11-30T23:59',
                    closedMessage: `Pendaftaran Mengulang Semester ${semKey} saat ini ditutup oleh pihak Fakultas Pertanian.`
                  };
                  const liveStatus = getSemesterStatus(semKey, { ...adminSettings, semesterSchedules: semesterSchedulesDraft });

                  return (
                    <div
                      key={semKey}
                      className={`rounded-xl border-2 p-4 transition-all ${
                        liveStatus.isOpen
                          ? 'bg-white border-emerald-300 shadow-xs'
                          : 'bg-rose-50/40 border-rose-300 shadow-xs'
                      }`}
                    >
                      {/* Top Header of Card */}
                      <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{semKey === '3' ? '🌿' : '🌾'}</span>
                          <div>
                            <h4 className="font-black text-sm text-slate-900">
                              Semester {semKey}
                            </h4>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {courses.filter(c => c.semester === Number(semKey)).length} Mata Kuliah Terdaftar
                            </span>
                          </div>
                        </div>

                        {/* Status Badge & Toggle Button */}
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${liveStatus.badgeClass}`}>
                            {liveStatus.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              handleUpdateSchedule(semKey, { isOpen: !schedule.isOpen });
                              handleSaveScheduleSettings({
                                ...semesterSchedulesDraft,
                                [semKey]: { ...schedule, isOpen: !schedule.isOpen }
                              });
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                              schedule.isOpen
                                ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                            }`}
                            title={schedule.isOpen ? 'Klik untuk menutup pendaftaran semester ini' : 'Klik untuk membuka pendaftaran semester ini'}
                          >
                            {schedule.isOpen ? (
                              <>
                                <Lock className="w-3 h-3" />
                                Tutup
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3 h-3" />
                                Buka
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Schedule Settings Details */}
                      <div className="space-y-3 text-xs">
                        {/* Auto-schedule checkbox */}
                        <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                          <div>
                            <label className="font-bold text-slate-900 block cursor-pointer flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={schedule.useSchedule}
                                onChange={(e) => handleUpdateSchedule(semKey, { useSchedule: e.target.checked })}
                                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                              />
                              Gunakan Jadwal Rentang Waktu Otomatis
                            </label>
                            <span className="text-[10px] text-slate-500 ml-5.5 block">
                              Sistem otomatis membuka/menutup sesuai tanggal & jam yang disetel
                            </span>
                          </div>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            schedule.useSchedule ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                          }`}>
                            {schedule.useSchedule ? 'Jadwal Aktif' : 'Manual'}
                          </span>
                        </div>

                        {/* Date Inputs if useSchedule is active */}
                        {schedule.useSchedule && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 bg-white rounded-lg border border-slate-200">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-emerald-600" />
                                Tanggal & Jam Mulai Dibuka:
                              </label>
                              <input
                                type="datetime-local"
                                value={schedule.startDate || ''}
                                onChange={(e) => handleUpdateSchedule(semKey, { startDate: e.target.value })}
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-mono font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                              <span className="text-[10px] text-slate-500 mt-0.5 block truncate">
                                Mulai: {schedule.startDate ? formatDateTimeId(schedule.startDate) : 'Belum diatur'}
                              </span>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                                <Clock className="w-3 h-3 text-rose-600" />
                                Tanggal & Jam Batas Berakhir:
                              </label>
                              <input
                                type="datetime-local"
                                value={schedule.endDate || ''}
                                onChange={(e) => handleUpdateSchedule(semKey, { endDate: e.target.value })}
                                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs font-mono font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                              <span className="text-[10px] text-slate-500 mt-0.5 block truncate">
                                Berakhir: {schedule.endDate ? formatDateTimeId(schedule.endDate) : 'Belum diatur'}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Quick Presets */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-bold text-slate-500">Preset Cepat:</span>
                          <button
                            type="button"
                            onClick={() => handleApplySchedulePreset(semKey, '1week')}
                            className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-semibold rounded border border-slate-300 cursor-pointer"
                          >
                            +7 Hari
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplySchedulePreset(semKey, '2weeks')}
                            className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-semibold rounded border border-slate-300 cursor-pointer"
                          >
                            +14 Hari
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplySchedulePreset(semKey, '1month')}
                            className="px-2 py-0.5 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-semibold rounded border border-slate-300 cursor-pointer"
                          >
                            +30 Hari
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplySchedulePreset(semKey, 'permanent')}
                            className="px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-semibold rounded border border-emerald-300 cursor-pointer"
                          >
                            Buka Tanpa Batas
                          </button>
                          <button
                            type="button"
                            onClick={() => handleApplySchedulePreset(semKey, 'close')}
                            className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-800 text-[10px] font-semibold rounded border border-rose-300 cursor-pointer"
                          >
                            Tutup Sekarang
                          </button>
                        </div>

                        {/* Custom closed message */}
                        <div className="pt-2 border-t border-slate-200">
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Pesan Notifikasi Khusus Saat Ditutup:
                          </label>
                          <input
                            type="text"
                            value={schedule.closedMessage || ''}
                            onChange={(e) => handleUpdateSchedule(semKey, { closedMessage: e.target.value })}
                            placeholder={`Pendaftaran Mengulang Semester ${semKey} telah ditutup oleh pihak Fakultas Pertanian.`}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* LIVE SUMMARY BANNER */}
              <div className="bg-emerald-100/60 border border-emerald-200 rounded-lg p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-emerald-800 shrink-0" />
                  <div className="text-[11px] text-emerald-950 font-medium">
                    <strong>Sinkronisasi Real-Time:</strong> Status Semester 3 (
                    <span className="font-bold underline">{getSemesterStatus('3', { ...adminSettings, semesterSchedules: semesterSchedulesDraft }).label}</span>
                    ) & Semester 5 (
                    <span className="font-bold underline">{getSemesterStatus('5', { ...adminSettings, semesterSchedules: semesterSchedulesDraft }).label}</span>
                    ). Mahasiswa yang membuka formulir akan langsung mendapati portal menyesuaikan dengan jadwal ini.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSaveScheduleSettings()}
                  className="px-3 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white rounded text-xs font-bold shadow-xs shrink-0 cursor-pointer"
                >
                  Simpan Semua Jadwal
                </button>
              </div>
            </div>

            {/* FITUR NOTE: Admin bisa mengedit Note */}
            <div className="bg-amber-50/70 border-2 border-amber-300 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-amber-200">
                <div className="flex items-center gap-2">
                  <StickyNote className="w-5 h-5 text-amber-700" />
                  <div>
                    <h3 className="font-extrabold text-sm text-amber-950">
                      Tampilan Fitur Note (Admin Bisa Mengedit Note)
                    </h3>
                    <p className="text-[11px] text-amber-800">
                      Catatan ini tampil pada kotak "Note:" di sisi kanan formulir pendaftaran untuk dibaca oleh mahasiswa.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {noteSavedFeedback && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Tersimpan!
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleResetNote}
                    className="text-[11px] text-amber-800 hover:text-amber-950 font-semibold underline cursor-pointer"
                  >
                    Kembalikan Default
                  </button>
                </div>
              </div>

              {/* Textarea Editor */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-800">
                  Isi Teks Note / Catatan:
                </label>
                <textarea
                  rows={5}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Ketik catatan pengumuman atau instruksi pendaftaran di sini..."
                  className="w-full p-3 rounded-lg border border-amber-300 bg-white text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-inner font-serif leading-relaxed"
                />

                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 italic">
                    Perubahan note akan langsung terlihat pada formulir mahasiswa.
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveNote}
                    className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Simpan Perubahan Note
                  </button>
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="mt-5 pt-4 border-t border-amber-200">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block mb-2">
                  Pratinjau Tampilan Note di Formulir Mahasiswa:
                </span>
                <div className="bg-white border-2 border-amber-300 rounded-lg p-3 text-xs text-amber-950 flex items-start gap-2.5 shadow-sm">
                  <StickyNote className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold text-[11px] text-amber-900 block mb-0.5">
                      Note / Catatan Opsi Kelas:
                    </span>
                    <p className="font-medium text-amber-900">{noteDraft || 'Belum ada catatan.'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* FITUR OPSI PILIH KELAS: Superadmin menentukan opsi pilih kelas */}
            <div className="bg-slate-50 border border-slate-300 rounded-xl p-5 shadow-sm">
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-600" />
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      Tentukan Opsi Pilih Kelas pada Tabel Daftar Matakuliah
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Superadmin dapat menambah, mengedit, atau menghapus pilihan kelas yang muncul pada dropdown tabel mahasiswa.
                    </p>
                  </div>
                </div>

                {/* Preset Options */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">Preset:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(['Kelas A', 'Kelas B', 'Kelas C'])}
                    className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-semibold rounded border border-slate-300 cursor-pointer"
                  >
                    A, B, C
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'])}
                    className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-semibold rounded border border-slate-300 cursor-pointer"
                  >
                    A s.d D + Karyawan
                  </button>
                </div>
              </div>

              {/* Form Tambah Opsi Kelas Baru */}
              <form onSubmit={handleAddClassOption} className="flex gap-2 mb-6">
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Ketik nama opsi kelas baru (contoh: Kelas D, Kelas Praktikum, Kelas Sore)..."
                  className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Tambah Opsi Kelas
                </button>
              </form>

              {/* Active Class Options Chips */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Daftar Opsi Kelas Aktif Saat Ini ({adminSettings.classOptions.length} Opsi):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {adminSettings.classOptions.map((className, idx) => {
                    const isEditingThis = editingClassIndex === idx;

                    return (
                      <div
                        key={idx}
                        className="p-3 bg-white border border-slate-300 rounded-lg shadow-sm flex items-center justify-between gap-2"
                      >
                        {isEditingThis ? (
                          <div className="flex items-center gap-1 flex-1">
                            <input
                              type="text"
                              value={editClassValue}
                              onChange={(e) => setEditClassValue(e.target.value)}
                              className="w-full px-2 py-1 border border-blue-400 rounded text-xs font-bold"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditClass(idx)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded cursor-pointer"
                              title="Simpan"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingClassIndex(null)}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded cursor-pointer"
                              title="Batal"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded bg-blue-100 text-blue-900 font-mono font-bold text-[10px] flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <span className="font-bold text-xs text-slate-900">{className}</span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingClassIndex(idx);
                                  setEditClassValue(className);
                                }}
                                className="p-1 text-slate-500 hover:text-blue-600 rounded hover:bg-blue-50 cursor-pointer"
                                title="Edit nama kelas"
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteClassOption(className)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 cursor-pointer"
                                title="Hapus opsi kelas"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* FITUR KELAS BEASISWA & PEMBATASAN KELAS MENGULANG PER SEMESTER */}
            {/* ============================================================== */}
            <div className="bg-gradient-to-br from-purple-50 via-indigo-50/40 to-slate-50 border-2 border-indigo-300 rounded-xl p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-indigo-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-sm text-indigo-950">
                        Pengaturan Kelas Beasiswa (Tidak Boleh Mengulang) Per Semester
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-200 text-indigo-900 border border-indigo-300">
                        Superadmin
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Tentukan kelas beasiswa yang dilarang dipilih sebagai kelas mengulang. Karena kelas beasiswa tiap semester dapat berbeda (misal Semester 3 vs Semester 5), Anda dapat mengonfigurasinya per semester.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {scholarshipSavedFeedback && (
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-md flex items-center gap-1 border border-emerald-300">
                      <Check className="w-3.5 h-3.5 text-emerald-700" />
                      Tersimpan & Sinkron!
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSaveScholarshipSettings()}
                    className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Pengaturan</span>
                  </button>
                </div>
              </div>

              {/* Semester Switcher Tabs & Preset Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 bg-white/80 p-2.5 rounded-lg border border-indigo-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Pilih Semester:</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveScholarshipSemesterTab('3')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeScholarshipSemesterTab === '3'
                          ? 'bg-indigo-700 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>🌿 Semester 3</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-900/30 text-white font-mono">
                        {(restrictedRepeatClassesDraft['3'] || []).length} dilarang
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveScholarshipSemesterTab('5')}
                      className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeScholarshipSemesterTab === '5'
                          ? 'bg-indigo-700 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      <span>🌾 Semester 5</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-900/30 text-white font-mono">
                        {(restrictedRepeatClassesDraft['5'] || []).length} dilarang
                      </span>
                    </button>
                  </div>
                </div>

                {/* Preset Actions */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-500">Preset Cepat:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyScholarshipPreset('standard')}
                    className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold rounded border border-slate-300 cursor-pointer shadow-2xs"
                    title="Semester 3: Kelas Beasiswa | Semester 5: Kelas Beasiswa & Kelas D"
                  >
                    Preset Standar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyScholarshipPreset('all-beasiswa')}
                    className="px-2 py-1 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold rounded border border-slate-300 cursor-pointer shadow-2xs"
                    title="Larang 'Kelas Beasiswa' di semua semester"
                  >
                    Semua 'Kelas Beasiswa'
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyScholarshipPreset('clear')}
                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-800 text-[10px] font-bold rounded border border-rose-200 cursor-pointer shadow-2xs"
                    title="Bebaskan semua kelas (Semua boleh diambil)"
                  >
                    Izinkan Semua Kelas
                  </button>
                </div>
              </div>

              {/* Konten Semester Aktif */}
              <div className="bg-white rounded-xl border border-indigo-200 p-4 shadow-2xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <span>Status Opsi Kelas untuk Mahasiswa Mengulang Semester {activeScholarshipSemesterTab}:</span>
                      <span className="text-[10px] font-normal text-slate-500">
                        (Klik kartu kelas untuk mengubah status larangan)
                      </span>
                    </h4>
                  </div>
                  <span className="text-[11px] font-semibold text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                    Terlarang Mengulang: <strong>{(restrictedRepeatClassesDraft[activeScholarshipSemesterTab] || []).length} Kelas</strong>
                  </span>
                </div>

                {/* Grid Kelas dan Status */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {adminSettings.classOptions.map((className) => {
                    const isRestricted = (restrictedRepeatClassesDraft[activeScholarshipSemesterTab] || []).includes(className);

                    return (
                      <div
                        key={className}
                        onClick={() => handleToggleClassRestriction(activeScholarshipSemesterTab, className)}
                        className={`p-3 rounded-lg border-2 transition-all cursor-pointer select-none flex flex-col justify-between ${
                          isRestricted
                            ? 'bg-rose-50/90 border-rose-400 shadow-xs ring-1 ring-rose-400/30'
                            : 'bg-emerald-50/60 border-emerald-300 hover:border-emerald-400 hover:bg-emerald-50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900">{className}</span>
                          </div>
                          {isRestricted ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-rose-600 text-white flex items-center gap-1">
                              <Ban className="w-2.5 h-2.5" />
                              Dilarang
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-emerald-600 text-white flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" />
                              Boleh
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] leading-tight font-medium">
                          {isRestricted ? (
                            <span className="text-rose-800 font-semibold flex items-center gap-1">
                              <span>🚫 Kelas Beasiswa (Tidak Boleh Mengulang)</span>
                            </span>
                          ) : (
                            <span className="text-emerald-800 font-medium">
                              ✓ Kelas Reguler (Dapat dipilih mengulang)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Form Tambah Nama Kelas Khusus Beasiswa untuk Semester Ini */}
                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2 items-center">
                  <div className="flex-1 w-full flex gap-2">
                    <input
                      type="text"
                      value={newCustomScholarshipClass}
                      onChange={(e) => setNewCustomScholarshipClass(e.target.value)}
                      placeholder={`Ketik nama kelas beasiswa khusus Semester ${activeScholarshipSemesterTab} (contoh: Kelas Beasiswa Kemitraan, Kelas D Khusus)...`}
                      className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddCustomScholarshipClass(activeScholarshipSemesterTab)}
                      className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Jadikan Kelas Beasiswa</span>
                    </button>
                  </div>
                </div>

                {/* Keterangan / Alasan Khusus yang Ditampilkan kepada Mahasiswa */}
                <div className="pt-3 border-t border-slate-100">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Pesan Alasan / Notifikasi Mahasiswa (Semester {activeScholarshipSemesterTab}):
                  </label>
                  <textarea
                    rows={2}
                    value={restrictedRepeatClassReasonDraft[activeScholarshipSemesterTab] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRestrictedRepeatClassReasonDraft(prev => ({
                        ...prev,
                        [activeScholarshipSemesterTab]: val
                      }));
                    }}
                    placeholder={`Contoh: Kelas Beasiswa pada Semester ${activeScholarshipSemesterTab} dikhususkan bagi mahasiswa beasiswa penuh dan tidak dibuka untuk mengulang.`}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                  <span className="text-[10px] text-slate-500 italic block mt-0.5">
                    * Pesan ini akan muncul pada notifikasi peringatan jika ada mahasiswa yang mencoba memilih kelas beasiswa tersebut pada form pendaftaran.
                  </span>
                </div>
              </div>
            </div>

            {/* FITUR BIAYA SKS BERDASARKAN ANGKATAN (Pengaturan Superadmin) */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 border-2 border-amber-400 rounded-xl p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-amber-300">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-amber-950 flex items-center gap-2">
                      Pengaturan Biaya Mengulang Per SKS Berdasarkan Angkatan
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900 border border-amber-400">
                        Superadmin
                      </span>
                    </h3>
                    <p className="text-[11px] text-amber-800">
                      Tentukan angkatan mana saja yang dikenakan biaya per SKS, tarif per SKS, dan note instruksi pembayaran yang tercetak pada hasil pendaftaran.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {feeSavedFeedback && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Pengaturan Biaya Tersimpan!
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveFeeSettings}
                    className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Simpan Pengaturan Biaya
                  </button>
                </div>
              </div>

              {/* Status & Tarif Row */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-5">
                {/* Toggle Aktif */}
                <div className="md:col-span-5 bg-white p-3.5 rounded-lg border border-amber-300 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Status Sistem Biaya SKS:
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {feeEnabled ? 'Aktif (Angkatan terpilih kena biaya)' : 'Nonaktif (Semua angkatan gratis)'}
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={feeEnabled}
                      onChange={(e) => setFeeEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                </div>

                {/* Tarif per SKS */}
                <div className="md:col-span-7 bg-white p-3.5 rounded-lg border border-amber-300">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <label className="text-xs font-bold text-slate-800">
                      Tarif Biaya Per SKS:
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-500">Pilihan cepat:</span>
                      {[35000, 50000, 75000, 100000].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCostPerSks(val)}
                          className={`text-[10px] px-1.5 py-0.5 rounded border cursor-pointer font-semibold ${
                            costPerSks === val 
                              ? 'bg-amber-600 text-white border-amber-700' 
                              : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-300'
                          }`}
                        >
                          {val / 1000}rb
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-500">Rp</span>
                    <input
                      type="number"
                      step={5000}
                      min={0}
                      value={costPerSks}
                      onChange={(e) => setCostPerSks(Number(e.target.value) || 0)}
                      className="w-full pl-9 pr-14 py-1.5 rounded border border-slate-300 font-mono font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">/ SKS</span>
                  </div>
                </div>
              </div>

              {/* Pemilihan Angkatan yang Dikenakan Biaya */}
              <div className="bg-white p-4 rounded-lg border border-amber-300 mb-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 mb-3 border-b border-slate-200">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Daftar Angkatan yang Dikenakan Biaya Per SKS:
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Klik pada kartu angkatan untuk mengaktifkan / menonaktifkan kewajiban biaya mengulang.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedPaidBatches(['2020', '2021', '2022'])}
                      className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[10px] font-bold rounded border border-amber-300 cursor-pointer"
                    >
                      Angkatan &le; 2022 (Senior)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPaidBatches(Array.from(new Set([...ANGKATAN_OPTIONS, ...selectedPaidBatches])))}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold rounded border border-slate-300 cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPaidBatches([])}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-rose-700 text-[10px] font-bold rounded border border-slate-300 cursor-pointer"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>

                {/* Chips Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 mb-3">
                  {Array.from(new Set([...ANGKATAN_OPTIONS, ...selectedPaidBatches])).sort().map(batch => {
                    const isChecked = selectedPaidBatches.includes(batch);
                    return (
                      <div
                        key={batch}
                        onClick={() => handleToggleBatch(batch)}
                        className={`p-2.5 rounded-lg border-2 cursor-pointer transition-all flex flex-col items-center justify-center text-center ${
                          isChecked 
                            ? 'bg-amber-50 border-amber-500 text-amber-950 font-bold shadow-sm ring-1 ring-amber-400' 
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-white'
                        }`}
                      >
                        <span className="text-sm font-black font-mono">{batch}</span>
                        <span className={`text-[9px] font-semibold mt-0.5 px-1.5 py-0.5 rounded ${
                          isChecked 
                            ? 'bg-amber-600 text-white' 
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {isChecked ? 'Kena Biaya SKS' : 'Bebas Biaya'}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Tambah Angkatan Kustom */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200 text-xs">
                  <span className="text-[11px] text-slate-600 font-medium">Tambah Angkatan Lain:</span>
                  <input
                    type="text"
                    value={newCustomBatch}
                    onChange={(e) => setNewCustomBatch(e.target.value)}
                    placeholder="Contoh: 2019"
                    className="w-28 px-2 py-1 border border-slate-300 rounded text-xs text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomBatch}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold cursor-pointer"
                  >
                    Tambah
                  </button>
                </div>
              </div>

              {/* Teks Instruksi & Catatan Pembayaran */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="bg-white p-3.5 rounded-lg border border-amber-300 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Catatan / Note Instruksi Pembayaran:
                  </label>
                  <p className="text-[10px] text-slate-500">
                    Pesan pengumuman yang muncul pada bukti hasil pendaftaran dan cetakan mahasiswa.
                  </p>
                  <textarea
                    rows={3}
                    value={paymentInstructionsDraft}
                    onChange={(e) => setPaymentInstructionsDraft(e.target.value)}
                    className="w-full p-2.5 rounded border border-slate-300 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                    placeholder="Tuliskan catatan pembayaran untuk mahasiswa..."
                  />
                </div>

                <div className="bg-white p-3.5 rounded-lg border border-amber-300 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Informasi Rekening / Loket Pembayaran:
                  </label>
                  <p className="text-[10px] text-slate-500">
                    Nomor rekening universitas / fakultas atau kontak WA konfirmasi keuangan.
                  </p>
                  <textarea
                    rows={3}
                    value={paymentAccountInfoDraft}
                    onChange={(e) => setPaymentAccountInfoDraft(e.target.value)}
                    className="w-full p-2.5 rounded border border-slate-300 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                    placeholder="Contoh: Bank BNI Rek: 1234-5678-90 a.n. Kas Fakultas..."
                  />
                </div>
              </div>

              {/* Preview Box */}
              <div className="bg-amber-100/60 border border-amber-300 rounded-lg p-3 text-xs">
                <span className="font-bold text-amber-900 uppercase text-[10px] block mb-1">
                  👁️ Simulasi Tampilan Note pada Hasil Cetak Mahasiswa:
                </span>
                <p className="text-[11px] text-amber-950 font-medium leading-relaxed">
                  "⚠️ <strong>Angkatan Kena Biaya ({selectedPaidBatches.join(', ') || 'Belum dipilih'}):</strong> {paymentInstructionsDraft || '...'}"
                </p>
                <div className="mt-1 text-[10px] text-slate-600 font-mono">
                  Loket/Rekening: {paymentAccountInfoDraft || '...'}
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* FITUR BATAS MAKSIMAL PENGAMBILAN SKS (DEFAULT 24 SKS & ATURAN ANGKATAN) */}
            {/* ============================================================== */}
            <div className="bg-gradient-to-br from-indigo-50/70 via-blue-50/50 to-slate-50 border-2 border-indigo-300 rounded-xl p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-indigo-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Gauge className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-indigo-950 flex items-center gap-2">
                      Pengaturan Batas Maksimal SKS Pengambilan (Default 24 SKS & Aturan Khusus Angkatan)
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-900 border border-indigo-300">
                        Superadmin
                      </span>
                    </h3>
                    <p className="text-[11px] text-indigo-800">
                      Batas bawaan pengambilan matakuliah adalah <strong>24 SKS</strong>. Anda dapat mengatur jumlah SKS maksimal untuk angkatan tertentu secara fleksibel.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {maxSksSavedFeedback && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded flex items-center gap-1 border border-emerald-300">
                      <Check className="w-3 h-3" />
                      Batas SKS Tersimpan!
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSaveMaxSksSettings()}
                    className="px-4 py-2 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Simpan Pengaturan SKS
                  </button>
                </div>
              </div>

              {/* SECTION 1: DEFAULT MAKSIMAL SKS UNTUK SELURUH ANGKATAN */}
              <div className="bg-white p-4 rounded-lg border border-indigo-200 mb-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-slate-200">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                      1. Batas Maksimal SKS Default (Bawaan Seluruh Angkatan)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Berlaku otomatis untuk semua angkatan mahasiswa yang tidak memiliki batas khusus tersendiri.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-slate-500 font-medium">Pilihan Cepat:</span>
                    {[20, 22, 24].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          setDefaultMaxSksInput(val);
                          handleSaveMaxSksSettings(undefined, val);
                        }}
                        className={`text-[11px] px-2.5 py-1 rounded font-bold border cursor-pointer transition-all ${
                          defaultMaxSksInput === val
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                            : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-300'
                        }`}
                      >
                        {val} SKS {val === 24 ? '(Standar)' : ''}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-700 whitespace-nowrap">
                      Jumlah Batas Default:
                    </label>
                    <div className="relative w-36">
                      <input
                        type="number"
                        min={1}
                        max={36}
                        value={defaultMaxSksInput}
                        onChange={(e) => setDefaultMaxSksInput(Number(e.target.value) || 24)}
                        className="w-full px-3 py-1.5 pr-12 rounded border border-indigo-300 font-bold font-mono text-indigo-950 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-indigo-50/30"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 pointer-events-none">
                        SKS
                      </span>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-600 bg-slate-50 px-3 py-1.5 rounded border border-slate-200 flex-1">
                    ℹ️ Standar bawaan sistem adalah <strong>24 SKS</strong>. Jika formulir mahasiswa melebihi angka ini, sistem otomatis menampilkan peringatan merah dan tombol kirim pendaftaran dinonaktifkan.
                  </div>
                </div>
              </div>

              {/* SECTION 2: PENGATURAN ATURAN KHUSUS SKS PER ANGKATAN */}
              <div className="bg-white p-4 rounded-lg border border-indigo-200 mb-5 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-200">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-indigo-600" />
                      2. Atur Batas Maksimal SKS untuk Angkatan Tertentu
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Tentukan kuota SKS khusus untuk angkatan tertentu (misal: angkatan lama 2020 dibatasi 20 SKS, angkatan 2021 dibatasi 22 SKS).
                    </p>
                  </div>

                  {/* Preset Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase">Preset:</span>
                    <button
                      type="button"
                      onClick={() => handleApplySksPreset('all-default')}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold rounded border border-slate-300 cursor-pointer"
                      title="Semua angkatan memakai batas default 24 SKS"
                    >
                      Semua Standar (24 SKS)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplySksPreset('seniors-20')}
                      className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[10px] font-bold rounded border border-amber-300 cursor-pointer"
                      title="Angkatan 2020 & 2021 dibatasi 20 SKS"
                    >
                      Senior &le;2021 (20 SKS)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplySksPreset('seniors-graduated')}
                      className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-900 text-[10px] font-bold rounded border border-blue-300 cursor-pointer"
                      title="2020: 18 SKS, 2021: 20 SKS, 2022: 22 SKS"
                    >
                      Gradasi Senior (18, 20, 22 SKS)
                    </button>
                  </div>
                </div>

                {/* Form Tambah / Modifikasi Batas Angkatan */}
                <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-200 mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-950 whitespace-nowrap">Pilih Angkatan:</span>
                    <select
                      value={selectedBatchForLimit}
                      onChange={(e) => {
                        const b = e.target.value;
                        setSelectedBatchForLimit(b);
                        if (batchMaxSksConfig[b] !== undefined) {
                          setCustomBatchLimitSks(batchMaxSksConfig[b]);
                        }
                      }}
                      className="px-2.5 py-1.5 bg-white border border-indigo-300 rounded text-xs font-bold font-mono text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {Array.from(new Set([...ANGKATAN_OPTIONS, ...Object.keys(batchMaxSksConfig)])).sort().map(batch => (
                        <option key={batch} value={batch}>
                          Angkatan {batch} {batchMaxSksConfig[batch] ? `(Saat ini: ${batchMaxSksConfig[batch]} SKS)` : `(Default: ${defaultMaxSksInput} SKS)`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-950 whitespace-nowrap">Batas Maksimal:</span>
                    <div className="relative w-28">
                      <input
                        type="number"
                        min={1}
                        max={36}
                        value={customBatchLimitSks}
                        onChange={(e) => setCustomBatchLimitSks(Number(e.target.value) || 20)}
                        className="w-full px-2.5 py-1.5 pr-10 bg-white border border-indigo-300 rounded text-xs font-bold font-mono text-indigo-950 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 pointer-events-none">
                        SKS
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {[18, 20, 22].map((sksVal) => (
                        <button
                          key={sksVal}
                          type="button"
                          onClick={() => setCustomBatchLimitSks(sksVal)}
                          className={`text-[10px] px-1.5 py-1 rounded font-bold border cursor-pointer ${
                            customBatchLimitSks === sksVal
                              ? 'bg-indigo-600 text-white border-indigo-700'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-300'
                          }`}
                        >
                          {sksVal}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSetBatchLimit(selectedBatchForLimit, customBatchLimitSks)}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold shadow flex items-center justify-center gap-1.5 cursor-pointer transition-colors sm:ml-auto"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Terapkan untuk Angkatan {selectedBatchForLimit}
                  </button>
                </div>

                {/* Grid Kartu Status Batas SKS per Angkatan */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700">
                      Daftar Status Batas SKS Seluruh Angkatan:
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {Object.keys(batchMaxSksConfig).length} angkatan memiliki aturan batas khusus
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
                    {Array.from(new Set([...ANGKATAN_OPTIONS, ...Object.keys(batchMaxSksConfig)])).sort().map(batch => {
                      const hasCustom = batchMaxSksConfig[batch] !== undefined && Number(batchMaxSksConfig[batch]) > 0;
                      const activeLimit = hasCustom ? batchMaxSksConfig[batch] : defaultMaxSksInput;

                      return (
                        <div
                          key={batch}
                          className={`p-2.5 rounded-lg border-2 transition-all flex flex-col justify-between ${
                            hasCustom
                              ? 'bg-indigo-50/80 border-indigo-400 shadow-sm'
                              : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className="font-mono font-black text-sm text-slate-900">
                              {batch}
                            </span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                              hasCustom
                                ? 'bg-indigo-600 text-white'
                                : 'bg-slate-200 text-slate-700'
                            }`}>
                              {hasCustom ? 'Khusus' : 'Default'}
                            </span>
                          </div>

                          <div className="text-center py-1">
                            <span className={`font-mono font-black text-base ${
                              hasCustom ? 'text-indigo-900' : 'text-slate-800'
                            }`}>
                              {activeLimit} <span className="text-xs font-medium text-slate-500">SKS</span>
                            </span>
                          </div>

                          {/* Quick Stepper & Actions */}
                          <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleSetBatchLimit(batch, Math.max(1, activeLimit - 1))}
                                className="w-5 h-5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold flex items-center justify-center cursor-pointer"
                                title="Kurangi 1 SKS"
                              >
                                -
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSetBatchLimit(batch, Math.min(36, activeLimit + 1))}
                                className="w-5 h-5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold flex items-center justify-center cursor-pointer"
                                title="Tambah 1 SKS"
                              >
                                +
                              </button>
                            </div>

                            {hasCustom ? (
                              <button
                                type="button"
                                onClick={() => handleRemoveBatchLimit(batch)}
                                className="text-[10px] text-rose-600 hover:text-rose-800 font-semibold underline cursor-pointer"
                                title="Kembalikan angkatan ini ke batas default"
                              >
                                Reset
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedBatchForLimit(batch);
                                  setCustomBatchLimitSks(20);
                                  handleSetBatchLimit(batch, 20);
                                }}
                                className="text-[10px] text-indigo-700 hover:text-indigo-900 font-semibold underline cursor-pointer"
                                title="Atur batas khusus untuk angkatan ini"
                              >
                                Set Khusus
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tambah Angkatan Kustom untuk Batas SKS */}
                  <div className="flex items-center gap-2 pt-3 mt-3 border-t border-slate-200 text-xs">
                    <span className="text-[11px] text-slate-600 font-medium">Tambah Angkatan Lain:</span>
                    <input
                      type="text"
                      value={newCustomBatchForLimit}
                      onChange={(e) => setNewCustomBatchForLimit(e.target.value)}
                      placeholder="Contoh: 2019"
                      className="w-28 px-2 py-1 border border-slate-300 rounded text-xs text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = newCustomBatchForLimit.trim();
                        if (!trimmed) return;
                        handleSetBatchLimit(trimmed, 20);
                        setSelectedBatchForLimit(trimmed);
                        setNewCustomBatchForLimit('');
                      }}
                      className="px-2.5 py-1 bg-indigo-900 hover:bg-indigo-950 text-white rounded text-xs font-semibold cursor-pointer"
                    >
                      Tambah & Atur Batas
                    </button>
                  </div>
                </div>
              </div>

              {/* LIVE PREVIEW / PENJELASAN SINKRONISASI KE FORMULIR MAHASISWA */}
              <div className="bg-indigo-100/60 border border-indigo-200 rounded-lg p-3 text-xs">
                <span className="font-bold text-indigo-950 uppercase text-[10px] block mb-1">
                  👁️ Pratinjau & Penerapan Sistem Batas SKS:
                </span>
                <p className="text-[11px] text-indigo-900 font-medium leading-relaxed">
                  • <strong>Batas Default:</strong> Mahasiswa seluruh angkatan memiliki kuota maksimal <strong>{defaultMaxSksInput} SKS</strong>.
                  <br />
                  • <strong>Aturan Khusus:</strong> {
                    Object.keys(batchMaxSksConfig).length > 0 ? (
                      Object.entries(batchMaxSksConfig).map(([b, sks]) => `Angkatan ${b}: maks ${sks} SKS`).join(' | ')
                    ) : (
                      'Belum ada angkatan yang diatur khusus (semua angkatan menggunakan batas default 24 SKS).'
                    )
                  }
                  <br />
                  • <strong>Validasi Otomatis:</strong> Di formulir pendaftaran, mahasiswa akan melihat info kuota SKS sesuai angkatannya secara otomatis. Jika pilihan mata kuliah melebihi kuota tersebut, tombol pendaftaran dikunci dan peringatan akan muncul.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: DATA PENDAFTAR MAHASISWA */}
        {/* ============================================================== */}
        {/* TAB 3: REKAPITULASI & DATA PENDAFTAR MAHASISWA */}
        {/* ============================================================== */}
        {activeTab === 'registrations' && (
          <div className="space-y-6">
            
            {/* Header Seksi Rekap Data Pendaftar */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                      Rekapitulasi Pendaftaran Mahasiswa Mengulang
                    </h2>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-[#008744]/15 text-[#008744] dark:text-emerald-400">
                      LIVE DATA
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Lihat rincian pendaftar mahasiswa mengulang per program studi, semester target, kelas praktikum, dan status KRS.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                    Total: <strong className="text-[#008744] dark:text-emerald-400 font-mono text-sm">{registrations.length}</strong> Mahasiswa
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stats per Semester - Executive Monitor Cards (Format Gaya CBT INSTIPER) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Semua Pendaftar */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Total Mahasiswa
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-[#008744] dark:text-emerald-400 flex items-center justify-center font-bold">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                    {registrations.length}
                    <span className="text-xs font-semibold text-slate-400 ml-1.5">Mahasiswa</span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {registrations.reduce((s, r) => s + r.totalSks, 0)} Total SKS Terambil
                  </div>
                </div>
              </div>

              {/* Card 2: Semester 3 */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-emerald-200/80 dark:border-emerald-800/60 p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-[#166534] dark:text-emerald-400 uppercase tracking-wider">
                      Semester 3
                    </span>
                    <span className="text-[9px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.2 rounded">
                      GANJIL
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-emerald-100/60 dark:bg-emerald-950/80 text-[#166534] dark:text-emerald-400 flex items-center justify-center font-bold">
                    <span>🌿</span>
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-black text-[#166534] dark:text-emerald-300 tracking-tight">
                    {registrations.filter(r => r.targetSemester === 'Semester 3').length}
                    <span className="text-xs font-semibold text-emerald-600/70 ml-1.5">Mahasiswa</span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {registrations.filter(r => r.targetSemester === 'Semester 3').reduce((s, r) => s + r.totalSks, 0)} Beban SKS Semester 3
                  </div>
                </div>
              </div>

              {/* Card 3: Semester 5 */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-blue-200/80 dark:border-blue-800/60 p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                      Semester 5
                    </span>
                    <span className="text-[9px] font-black bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-1.5 py-0.2 rounded">
                      GANJIL
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-blue-100/60 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 flex items-center justify-center font-bold">
                    <span>🌾</span>
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-black text-blue-800 dark:text-blue-300 tracking-tight">
                    {registrations.filter(r => r.targetSemester === 'Semester 5').length}
                    <span className="text-xs font-semibold text-blue-600/70 ml-1.5">Mahasiswa</span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {registrations.filter(r => r.targetSemester === 'Semester 5').reduce((s, r) => s + r.totalSks, 0)} Beban SKS Semester 5
                  </div>
                </div>
              </div>

              {/* Card 4: SKS & Keuangan */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-amber-200/80 dark:border-amber-800/60 p-5 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                    Akumulasi Beban SKS
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-amber-100/60 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold">
                    <BookOpen className="w-4 h-4" />
                  </div>
                </div>
                <div>
                  <div className="text-3xl font-black text-amber-900 dark:text-amber-300 tracking-tight">
                    {registrations.reduce((s, r) => s + r.totalSks, 0)}
                    <span className="text-xs font-semibold text-amber-600/70 ml-1.5">SKS</span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                    {registrations.filter(r => (adminSettings.paidBatches || []).includes(r.angkatan)).length} Mahasiswa Kena Biaya SKS
                  </div>
                </div>
              </div>
            </div>

            {/* Filter & Search Toolbar - 2-Baris Rapi & Ergonomis */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 sm:p-5 shadow-xs space-y-4">
              {/* Baris 1: Kolom Pencarian + Tombol Ekspor Excel & CSV */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchReg}
                    onChange={(e) => setSearchReg(e.target.value)}
                    placeholder="Cari ujian / pendaftar (nama mahasiswa, NIM, angkatan, kelas)..."
                    className="w-full h-11 pl-11 pr-10 rounded-xl border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#008744] bg-slate-50 dark:bg-slate-800/80 transition-all shadow-2xs"
                  />
                  {searchReg && (
                    <button
                      type="button"
                      onClick={() => setSearchReg('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    title="Unduh data pendaftar format spreadsheet Excel (.xlsx) dengan 3 sheet lengkap"
                    className="flex items-center gap-2 h-11 px-4 bg-[#008744] hover:bg-[#00702F] text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0 active:scale-95"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-yellow-300" />
                    <span>Export Excel (.xlsx)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExportCSV}
                    title="Unduh data format CSV"
                    className="flex items-center gap-1.5 h-11 px-3.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 shadow-2xs active:scale-95"
                  >
                    <Download className="w-4 h-4 text-slate-500" />
                    <span>CSV</span>
                  </button>
                </div>
              </div>

              {/* Baris 2: Segmented Semester Filter & Dropdown Kelas */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mr-1">
                    Filter Semester:
                  </span>

                  <button
                    type="button"
                    onClick={() => setFilterRegSemester('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterRegSemester === 'all'
                        ? 'bg-[#008744] text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    Semua ({registrations.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterRegSemester('Semester 3')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterRegSemester === 'Semester 3'
                        ? 'bg-[#008744] text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    🌿 Sem 3 ({registrations.filter(r => r.targetSemester === 'Semester 3').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterRegSemester('Semester 5')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterRegSemester === 'Semester 5'
                        ? 'bg-[#008744] text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    🌾 Sem 5 ({registrations.filter(r => r.targetSemester === 'Semester 5').length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterRegSemester('gabungan')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterRegSemester === 'gabungan'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    📑 Lintas / Gabungan ({registrations.filter(r => r.targetSemester?.toLowerCase().includes('gabungan') || r.targetSemester?.toLowerCase().includes('lintas')).length})
                  </button>

                  {/* Filter Kelas */}
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 ml-1">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Kelas:</span>
                    <select
                      value={filterRegClass}
                      onChange={(e) => setFilterRegClass(e.target.value)}
                      className="text-xs font-bold text-[#008744] dark:text-emerald-400 bg-transparent focus:outline-none cursor-pointer"
                    >
                      <option value="all">Semua Kelas</option>
                      {adminSettings.classOptions.map((cls) => (
                        <option key={cls} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filter Tahun Ajaran */}
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 ml-1">
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">T.A.:</span>
                    <select
                      value={filterRegAcademicYear}
                      onChange={(e) => setFilterRegAcademicYear(e.target.value)}
                      className="text-xs font-bold text-[#008744] dark:text-emerald-400 bg-transparent focus:outline-none cursor-pointer"
                    >
                      <option value="all">Semua Tahun</option>
                      {(adminSettings.availableAcademicYears || ['2023/2024', '2024/2025', '2025/2026', '2026/2027']).map((yr) => (
                        <option key={yr} value={yr}>{yr}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Menampilkan <strong className="text-slate-900 dark:text-white font-bold">{filteredRegistrations.length}</strong> dari {registrations.length} pendaftar
                </div>
              </div>
            </div>

            {/* Tabel Pendaftar (Layar Monitor & Komputer) */}
            <div className="border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs bg-white dark:bg-slate-900">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#0f2918] text-white font-bold">
                    <tr>
                      <th className="py-3 px-4">No. &amp; ID Reg</th>
                      <th className="py-3 px-4">Mahasiswa &amp; Kontak</th>
                      <th className="py-3 px-4">Angkatan &amp; Status Biaya</th>
                      <th className="py-3 px-4">Mata Kuliah Diambil</th>
                      <th className="py-3 px-4 text-center">Total SKS</th>
                      <th className="py-3 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {filteredRegistrations.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500 dark:text-slate-400">
                          <div className="max-w-xs mx-auto space-y-1">
                            <Search className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                            <p className="font-bold text-sm text-slate-700 dark:text-slate-300">Tidak ada data pendaftar</p>
                            <p className="text-xs text-slate-400">Coba ubah kata kunci pencarian atau sesuaikan filter semester &amp; kelas.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredRegistrations.map((r) => (
                        <tr key={r.id} className="hover:bg-emerald-50/30 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 align-top">
                            <span className="font-mono font-bold text-blue-900 dark:text-blue-300 block text-xs">{r.id}</span>
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.targetSemester === 'Semester 3'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300'
                                : r.targetSemester === 'Semester 5'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300'
                            }`}>
                              {r.targetSemester || 'Semester 3'}
                            </span>
                            <span className="block text-[10px] text-slate-400 mt-1">{r.registrationDate}</span>
                          </td>
                          <td className="py-3 px-4 align-top">
                            <strong className="text-slate-900 dark:text-white text-xs block">{r.nama}</strong>
                            <span className="font-mono text-slate-700 dark:text-slate-300 font-bold block text-[11px] mt-0.5">
                              NIM: {r.nim}
                            </span>
                            <a
                              href={`https://wa.me/${r.noWa.replace(/^0/, '62')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1 mt-0.5"
                              title="Hubungi Mahasiswa via WhatsApp"
                            >
                              <span>📱</span> {r.noWa}
                            </a>
                          </td>
                          <td className="py-3 px-4 align-top">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                              Angkatan {r.angkatan}
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                              Kelas Asal: {r.kelasAsal}
                            </span>
                            {adminSettings.feePerSksEnabled && (adminSettings.paidBatches || []).includes(r.angkatan) ? (
                              <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                                Tagihan: Rp {(r.totalSks * (adminSettings.costPerSks || 50000)).toLocaleString('id-ID')}
                              </span>
                            ) : (
                              <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                                Bebas Biaya
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 align-top">
                            <div className="space-y-1.5 max-w-sm">
                              {r.selectedCourses.map((c, i) => (
                                <div key={i} className="flex items-center justify-between gap-2 p-1.5 bg-slate-50 dark:bg-slate-800/80 rounded-lg border border-slate-200/80 dark:border-slate-700/80 text-[11px]">
                                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                    {c.name}
                                  </span>
                                  <div className="flex items-center gap-1 shrink-0 font-bold">
                                    <span className="bg-white dark:bg-slate-700 text-blue-800 dark:text-blue-300 px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-800 text-[10px]">
                                      {c.selectedClass}
                                    </span>
                                    <span className="text-slate-600 dark:text-slate-400 text-[10px]">
                                      {c.sks} SKS
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center align-top">
                            <span className="inline-block px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 font-mono font-black text-sm border border-blue-200 dark:border-blue-800">
                              {r.totalSks} SKS
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center align-top">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => onViewReceipt(r)}
                                className="p-2 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-xl cursor-pointer border border-emerald-200 dark:border-emerald-800 transition-colors shadow-2xs"
                                title="Cetak KRS & Bukti Pendaftaran"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setRegistrationToDelete(r)}
                                className="p-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl cursor-pointer border border-rose-200 dark:border-rose-800 transition-colors shadow-2xs"
                                title="Hapus Data Pendaftaran"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View for Registrations (No Horizontal Scroll on Mobile Phones) */}
              <div className="md:hidden divide-y divide-slate-200">
                {filteredRegistrations.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    Belum ada data pendaftar yang cocok dengan filter.
                  </div>
                ) : (
                  filteredRegistrations.map((r) => (
                    <div key={r.id} className="p-4 space-y-3 bg-white">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-blue-900">{r.id}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-[#009A44]/15 text-[#009A44]">
                              {r.targetSemester || 'Semester 3'}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 mt-1">{r.nama}</h4>
                          <p className="text-xs text-slate-500 font-mono">NIM: {r.nim} • {r.noWa}</p>
                        </div>

                        <div className="text-right">
                          <span className="text-sm font-black text-[#009A44] block">{r.totalSks} SKS</span>
                          <span className="text-[10px] text-slate-400 font-medium">Angkatan {r.angkatan}</span>
                        </div>
                      </div>

                      {/* Course list summary */}
                      <div className="p-2.5 bg-slate-50 rounded-lg text-xs space-y-1">
                        <span className="font-bold text-slate-600 block text-[11px]">Mata Kuliah ({r.selectedCourses.length}):</span>
                        {r.selectedCourses.map((c, i) => (
                          <div key={i} className="flex justify-between text-[11px] text-slate-700">
                            <span className="truncate pr-2">• {c.name} ({c.selectedClass})</span>
                            <span className="font-bold shrink-0">{c.sks} SKS</span>
                          </div>
                        ))}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between pt-1">
                        <div>
                          {adminSettings.feePerSksEnabled && (adminSettings.paidBatches || []).includes(r.angkatan) ? (
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                              Kena Biaya: Rp {(r.totalSks * (adminSettings.costPerSks || 50000)).toLocaleString('id-ID')}
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                              Bebas Biaya
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onViewReceipt(r)}
                            className="px-3 py-1.5 bg-[#009A44] text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Cetak</span>
                          </button>
                          <button
                            onClick={() => setRegistrationToDelete(r)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg border border-red-200 cursor-pointer"
                            title="Hapus Data"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 4: MANAJEMEN KREDENSIAL USER (TERPISAH DARI ADMIN BAAK - KHUSUS SUPERADMIN) */}
        {/* ============================================================== */}
        {activeTab === 'users' && (
          currentUser?.role !== 'superadmin' ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-rose-200 dark:border-rose-900/60 p-8 sm:p-12 text-center max-w-lg mx-auto my-12 shadow-md">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center mb-4 border border-rose-200 dark:border-rose-800">
                <Lock className="w-8 h-8" />
              </div>
              <h3 className="font-extrabold text-lg text-slate-900 dark:text-white mb-2">
                Akses Kredensial Terproteksi Khusus Superadmin
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                Tab Kredensial dan Manajemen Akun terpisah dari operasional Admin BAAK. Hanya Superadmin Fakultas yang berhak mengelola akun dan kata sandi pengelola.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('registrations')}
                className="px-6 py-2.5 bg-[#008744] hover:bg-[#00702F] text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                Kembali ke Data Pendaftar
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* User Management Header */}
              <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#009A44]/15 text-[#009A44] flex items-center justify-center font-bold shrink-0">
                      <KeyRound className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                        Manajemen Akun & Kredensial Pengelola (Terpisah dari BAAK)
                        <span className="text-[10px] bg-amber-100 text-amber-900 font-black px-2 py-0.5 rounded-full border border-amber-300 uppercase">
                          Akses Full Superadmin
                        </span>
                      </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Kelola username, password, peran hak akses, dan status keaktifan akun staf BAAK, Keuangan, dan Kaprodi.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setNewUsername('');
                    setNewUserPassword('');
                    setNewUserName('');
                    setNewUserRole('baak');
                    setNewUserEmail('');
                    setUserModalFeedback(null);
                    setIsAddUserModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2.5 bg-[#009A44] hover:bg-[#00702F] text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Tambah Akun Pengelola Baru</span>
                </button>
              </div>

              {/* Security Policy Reminder */}
              <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-[#009A44] shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Keamanan Akun:</strong> Halaman login tidak lagi menyediakan tombol demo atau otomatis terisi. Seluruh staf wajib memasukkan username dan password resmi yang telah Anda daftarkan di bawah ini.
                </p>
              </div>
            </div>

            {/* User List Table & Mobile Cards */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                  Daftar Pengguna Terdaftar ({managedUsers.length} Akun)
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  Aktif: {managedUsers.filter(u => u.isActive).length} • Nonaktif: {managedUsers.filter(u => !u.isActive).length}
                </span>
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 font-bold border-b border-slate-200 text-slate-700">
                    <tr>
                      <th className="py-3 px-4">Username & Nama</th>
                      <th className="py-3 px-4">Peran / Hak Akses</th>
                      <th className="py-3 px-4">Email Kontak</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4">Terakhir Login</th>
                      <th className="py-3 px-4 text-center">Aksi Kredensial</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {managedUsers.map((u) => {
                      const isSuper = u.username === 'superadmin';
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-lg bg-[#009A44]/10 text-[#009A44] flex items-center justify-center font-bold text-xs shrink-0">
                                {u.username.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <span className="font-bold text-slate-900 block font-mono text-xs">{u.username}</span>
                                <span className="text-slate-600 text-[11px]">{u.name}</span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              u.role === 'superadmin'
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : u.role === 'finance'
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : u.role === 'baak'
                                ? 'bg-blue-100 text-blue-900 border border-blue-300'
                                : 'bg-purple-100 text-purple-900 border border-purple-300'
                            }`}>
                              {u.title}
                            </span>
                          </td>

                          <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                            {u.email || '-'}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <button
                              type="button"
                              disabled={isSuper}
                              onClick={() => {
                                updateManagedUser(u.id, { isActive: !u.isActive });
                                refreshUsersList();
                              }}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                                u.isActive
                                  ? 'bg-green-100 text-[#009A44] border border-green-300 hover:bg-green-200'
                                  : 'bg-red-100 text-[#E4202A] border border-red-300 hover:bg-red-200'
                              } ${isSuper ? 'cursor-default opacity-90' : ''}`}
                              title={isSuper ? 'Akun Superadmin Utama selalu aktif' : 'Klik untuk ubah status keaktifan'}
                            >
                              {u.isActive ? '✓ Aktif' : '✗ Nonaktif'}
                            </button>
                          </td>

                          <td className="py-3 px-4 text-[11px] text-slate-500 font-mono">
                            {u.lastLogin || 'Belum pernah'}
                          </td>

                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Ubah Password */}
                              <button
                                type="button"
                                onClick={() => {
                                  setTargetUserForPassword(u);
                                  setNewPasswordReset('');
                                  setPasswordModalFeedback(null);
                                  setIsPasswordModalOpen(true);
                                }}
                                className="p-1.5 text-amber-700 hover:bg-amber-50 rounded-lg border border-amber-200 transition-colors cursor-pointer"
                                title="Ubah / Reset Password Pengguna Ini"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>

                              {/* Edit Profil */}
                              <button
                                type="button"
                                onClick={() => {
                                  setTargetUserForEdit(u);
                                  setEditUserName(u.name);
                                  setEditUserRole(u.role);
                                  setEditUserEmail(u.email || '');
                                  setEditUserActive(u.isActive);
                                  setEditUserFeedback(null);
                                  setIsEditUserModalOpen(true);
                                }}
                                className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                                title="Edit Data Pengguna"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {/* Hapus */}
                              <button
                                type="button"
                                disabled={isSuper}
                                onClick={() => setUserToDelete(u)}
                                className={`p-1.5 rounded-lg border transition-colors ${
                                  isSuper
                                    ? 'text-slate-300 border-slate-200 cursor-not-allowed'
                                    : 'text-red-600 hover:bg-red-50 border-red-200 cursor-pointer'
                                }`}
                                title={isSuper ? 'Akun Superadmin tidak dapat dihapus' : 'Hapus Akun'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View for User Accounts */}
              <div className="md:hidden divide-y divide-slate-100">
                {managedUsers.map((u) => {
                  const isSuper = u.username === 'superadmin';
                  return (
                    <div key={u.id} className="p-4 space-y-3 bg-white">
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-mono font-bold text-xs text-slate-900 block">{u.username}</span>
                          <span className="text-xs text-slate-600 font-medium">{u.name}</span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">{u.title}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.isActive ? 'bg-green-100 text-[#009A44]' : 'bg-red-100 text-[#E4202A]'
                        }`}>
                          {u.isActive ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-50">
                        <span className="text-[10px] text-slate-400 font-mono">
                          Login: {u.lastLogin || '-'}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setTargetUserForPassword(u);
                              setNewPasswordReset('');
                              setPasswordModalFeedback(null);
                              setIsPasswordModalOpen(true);
                            }}
                            className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-bold"
                          >
                            Reset Password
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTargetUserForEdit(u);
                              setEditUserName(u.name);
                              setEditUserRole(u.role);
                              setEditUserEmail(u.email || '');
                              setEditUserActive(u.isActive);
                              setEditUserFeedback(null);
                              setIsEditUserModalOpen(true);
                            }}
                            className="p-1.5 text-blue-700 border border-blue-200 rounded-lg"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

            {/* MODAL: TAMBAH USER PENGELOLA BARU */}
            {isAddUserModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
                <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
                  <div className="bg-[#009A44] text-white p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserPlus className="w-5 h-5 text-yellow-300" />
                      <h3 className="text-sm font-extrabold text-white">Tambah Akun Pengelola Baru</h3>
                    </div>
                    <button
                      onClick={() => setIsAddUserModalOpen(false)}
                      className="p-1 text-white/80 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setUserModalFeedback(null);
                      const res = addManagedUser({
                        username: newUsername,
                        password: newUserPassword,
                        name: newUserName,
                        role: newUserRole,
                        title: getDefaultTitleForRole(newUserRole),
                        email: newUserEmail
                      });
                      if (res.success) {
                        refreshUsersList();
                        setUserModalFeedback(res.message || 'Akun berhasil ditambahkan!');
                        setTimeout(() => setIsAddUserModalOpen(false), 1200);
                      } else {
                        setUserModalFeedback(res.message || 'Gagal menambahkan akun.');
                      }
                    }}
                    className="p-5 space-y-3.5 text-xs"
                  >
                    {userModalFeedback && (
                      <div className={`p-3 rounded-xl font-semibold ${
                        userModalFeedback.includes('berhasil') ? 'bg-green-50 text-[#009A44]' : 'bg-red-50 text-[#E4202A]'
                      }`}>
                        {userModalFeedback}
                      </div>
                    )}

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Username Akun *</label>
                      <input
                        type="text"
                        required
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="Contoh: admin_baak2 / kasir_fp"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Password Awal *</label>
                      <input
                        type="password"
                        required
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        placeholder="Masukkan password awal..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Staf *</label>
                      <input
                        type="text"
                        required
                        value={newUserName}
                        onChange={(e) => setNewUserName(e.target.value)}
                        placeholder="Nama dan gelar staf..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Peran / Hak Akses *</label>
                      <select
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                      >
                        <option value="baak">Staf BAAK / Verifikator Akademik</option>
                        <option value="finance">Staf Keuangan / Kasir Pembayaran</option>
                        <option value="kaprodi">Ketua Program Studi (Kaprodi)</option>
                        <option value="superadmin">Superadmin Fakultas</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Email Resmi (Opsional)</label>
                      <input
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        placeholder="staf@instiperjogja.ac.id"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                      />
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAddUserModalOpen(false)}
                        className="px-4 py-2 border rounded-xl font-bold text-slate-600 cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-[#009A44] hover:bg-[#00702F] text-white rounded-xl font-bold cursor-pointer"
                      >
                        Simpan Akun
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* MODAL: RESET / UBAH PASSWORD */}
            {isPasswordModalOpen && targetUserForPassword && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
                <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden">
                  <div className="bg-amber-600 text-white p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-5 h-5 text-yellow-200" />
                      <h3 className="text-sm font-extrabold text-white">Ubah Password Akun</h3>
                    </div>
                    <button
                      onClick={() => setIsPasswordModalOpen(false)}
                      className="p-1 text-white/80 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setPasswordModalFeedback(null);
                      if (!newPasswordReset.trim()) {
                        setPasswordModalFeedback('Password baru tidak boleh kosong.');
                        return;
                      }
                      const res = updateManagedUser(targetUserForPassword.id, { password: newPasswordReset.trim() });
                      if (res.success) {
                        refreshUsersList();
                        setPasswordModalFeedback('Password berhasil diperbarui!');
                        setTimeout(() => setIsPasswordModalOpen(false), 1200);
                      } else {
                        setPasswordModalFeedback(res.message || 'Gagal mengubah password.');
                      }
                    }}
                    className="p-5 space-y-3.5 text-xs"
                  >
                    {passwordModalFeedback && (
                      <div className={`p-3 rounded-xl font-semibold ${
                        passwordModalFeedback.includes('berhasil') ? 'bg-green-50 text-[#009A44]' : 'bg-red-50 text-[#E4202A]'
                      }`}>
                        {passwordModalFeedback}
                      </div>
                    )}

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">Akun Pengelola:</span>
                      <strong className="text-slate-900 font-mono text-xs">{targetUserForPassword.username}</strong>
                      <span className="block text-[11px] text-slate-600">{targetUserForPassword.name}</span>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Password Baru *</label>
                      <input
                        type="password"
                        required
                        value={newPasswordReset}
                        onChange={(e) => setNewPasswordReset(e.target.value)}
                        placeholder="Masukkan password baru..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsPasswordModalOpen(false)}
                        className="px-4 py-2 border rounded-xl font-bold text-slate-600 cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold cursor-pointer"
                      >
                        Perbarui Password
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* MODAL: EDIT USER DETAILS */}
            {isEditUserModalOpen && targetUserForEdit && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
                <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
                  <div className="bg-blue-700 text-white p-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Edit3 className="w-5 h-5 text-white" />
                      <h3 className="text-sm font-extrabold text-white">Edit Data Akun</h3>
                    </div>
                    <button
                      onClick={() => setIsEditUserModalOpen(false)}
                      className="p-1 text-white/80 hover:text-white cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setEditUserFeedback(null);
                      const res = updateManagedUser(targetUserForEdit.id, {
                        name: editUserName.trim(),
                        role: editUserRole,
                        title: getDefaultTitleForRole(editUserRole),
                        email: editUserEmail.trim(),
                        isActive: editUserActive
                      });
                      if (res.success) {
                        refreshUsersList();
                        setEditUserFeedback('Data akun berhasil diperbarui!');
                        setTimeout(() => setIsEditUserModalOpen(false), 1200);
                      } else {
                        setEditUserFeedback(res.message || 'Gagal memperbarui akun.');
                      }
                    }}
                    className="p-5 space-y-3.5 text-xs"
                  >
                    {editUserFeedback && (
                      <div className={`p-3 rounded-xl font-semibold ${
                        editUserFeedback.includes('berhasil') ? 'bg-green-50 text-[#009A44]' : 'bg-red-50 text-[#E4202A]'
                      }`}>
                        {editUserFeedback}
                      </div>
                    )}

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[10px] text-slate-400 block">Username (Permanen):</span>
                      <strong className="text-slate-900 font-mono text-xs">{targetUserForEdit.username}</strong>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Nama Lengkap *</label>
                      <input
                        type="text"
                        required
                        value={editUserName}
                        onChange={(e) => setEditUserName(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Peran Hak Akses *</label>
                      <select
                        value={editUserRole}
                        onChange={(e) => setEditUserRole(e.target.value as UserRole)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold"
                      >
                        <option value="baak">Staf BAAK / Verifikator Akademik</option>
                        <option value="finance">Staf Keuangan / Kasir Pembayaran</option>
                        <option value="kaprodi">Ketua Program Studi (Kaprodi)</option>
                        <option value="superadmin">Superadmin Fakultas</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Email Kontak</label>
                      <input
                        type="email"
                        value={editUserEmail}
                        onChange={(e) => setEditUserEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono"
                      />
                    </div>

                    <div className="pt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editUserActive}
                          disabled={targetUserForEdit.username === 'superadmin'}
                          onChange={(e) => setEditUserActive(e.target.checked)}
                          className="w-4 h-4 rounded text-[#009A44] cursor-pointer"
                        />
                        <span className="font-bold text-slate-800">Akun Aktif (Dapat Login)</span>
                      </label>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditUserModalOpen(false)}
                        className="px-4 py-2 border rounded-xl font-bold text-slate-600 cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold cursor-pointer"
                      >
                        Simpan Perubahan
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            </div>
          )
        )}

          </div>
        </main>
      </div>

      {/* ============================================================== */}
      {/* MODAL 1: EDIT MATA KULIAH LENGKAP & CEPAT */}
      {/* ============================================================== */}
      {isEditCourseModalOpen && courseBeingEdited && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            {/* Header */}
            <div className="bg-[#009A44] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold">
                  <Edit3 className="w-4 h-4 text-yellow-300" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Edit Data Mata Kuliah</h3>
                  <p className="text-[11px] text-white/80 font-mono">ID: {courseBeingEdited.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsEditCourseModalOpen(false);
                  setCourseBeingEdited(null);
                }}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {courseFeedback && (
                <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  courseFeedback.type === 'error'
                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}>
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{courseFeedback.message}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Nama Mata Kuliah <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#009A44] bg-white"
                  placeholder="Contoh: Manajemen Agribisnis Terpadu"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Semester</label>
                  <select
                    value={editSemester}
                    onChange={(e) => setEditSemester(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#009A44] bg-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                      <option key={s} value={s}>Semester {s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">Beban SKS</label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={editSks}
                    onChange={(e) => setEditSks(Math.max(1, Math.min(6, Number(e.target.value))))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-black text-center focus:outline-none focus:ring-2 focus:ring-[#009A44] bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Tahun Ajaran Kurikulum</label>
                <select
                  value={editAcademicYear}
                  onChange={(e) => setEditAcademicYear(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#009A44] bg-white"
                >
                  {(adminSettings.availableAcademicYears || ['2023/2024', '2024/2025', '2025/2026', '2026/2027']).map((yr) => (
                    <option key={yr} value={yr}>
                      T.A. {yr} {yr === currentActiveAcademicYear ? '(Aktif)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">Program Studi</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditProdi('agroteknologi')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      editProdi === 'agroteknologi'
                        ? 'bg-[#009A44]/15 border-[#009A44] text-[#00702F] shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🌱 Agroteknologi
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditProdi('agribisnis')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      editProdi === 'agribisnis'
                        ? 'bg-[#009A44]/15 border-[#009A44] text-[#00702F] shadow-xs'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    🌾 Agribisnis
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    Opsi Kelas yang Ditawarkan
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditClasses(adminSettings.classOptions)}
                      className="text-[11px] font-bold text-[#009A44] hover:underline cursor-pointer"
                    >
                      Pilih Semua
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setEditClasses(adminSettings.classOptions.filter(c => !c.toLowerCase().includes('beasiswa')))}
                      className="text-[11px] font-bold text-slate-600 hover:underline cursor-pointer"
                    >
                      Hanya Reguler
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                  {adminSettings.classOptions.map((cls) => {
                    const isChosen = editClasses.includes(cls);
                    const isRestricted = isClassRestrictedForRepeat(cls, editSemester, adminSettings);
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => {
                          if (isChosen) {
                            if (editClasses.length > 1) {
                              setEditClasses(editClasses.filter(c => c !== cls));
                            }
                          } else {
                            setEditClasses([...editClasses, cls]);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                          isChosen
                            ? isRestricted
                              ? 'bg-rose-100 text-rose-800 border-rose-300 shadow-2xs'
                              : 'bg-[#009A44] text-white border-[#009A44] shadow-2xs'
                            : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <span>{cls}</span>
                        {isChosen && <Check className="w-3 h-3 ml-0.5" />}
                        {isRestricted && <span className="text-[9px] font-mono">🚫</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsEditCourseModalOpen(false);
                  setCourseBeingEdited(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleSaveCourseFromModal}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#009A44] hover:bg-[#00702F] transition-all cursor-pointer flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2: KONFIRMASI HAPUS MATA KULIAH */}
      {/* ============================================================== */}
      {courseToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-rose-100 text-[#E4202A] flex items-center justify-center mx-auto mb-4 border border-rose-200 shadow-xs">
                <Trash2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 mb-1">
                Hapus Mata Kuliah?
              </h3>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Apakah Anda yakin ingin menghapus mata kuliah:
                <br />
                <span className="font-bold text-slate-900 text-sm block mt-1">"{courseToDelete.name}"</span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {courseToDelete.sks} SKS • Semester {courseToDelete.semester} • Prodi {courseToDelete.prodi}
                </span>
              </p>
              <div className="p-2.5 bg-amber-50 rounded-xl text-[11px] text-amber-800 border border-amber-200 text-left mb-5">
                ⚠️ Mata kuliah ini akan dihapus dari portal penawaran mahasiswa.
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setCourseToDelete(null)}
                  className="w-1/2 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeleteCourse}
                  className="w-1/2 py-2.5 px-4 rounded-xl bg-[#E4202A] hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md shadow-red-500/20 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Ya, Hapus</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 3: KONFIRMASI RESET MATA KULIAH KE 18 BAWAAN */}
      {/* ============================================================== */}
      {isResetCoursesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4 border border-amber-200">
                <RotateCcw className="w-7 h-7" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 mb-1">
                Reset ke 18 Mata Kuliah Bawaan?
              </h3>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Tindakan ini akan mengembalikan daftar mata kuliah ke 18 mata kuliah standar bawaan kurikulum FP INSTIPER Yogyakarta.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsResetCoursesModalOpen(false)}
                  className="w-1/2 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmResetCourses}
                  className="w-1/2 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Ya, Reset</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 4: KONFIRMASI HAPUS PENDAFTARAN */}
      {/* ============================================================== */}
      {registrationToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-rose-100 text-[#E4202A] flex items-center justify-center mx-auto mb-4 border border-rose-200">
                <Trash2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 mb-1">
                Hapus Data Pendaftaran?
              </h3>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Hapus pendaftaran <strong>{registrationToDelete.nama}</strong> (NIM: <span className="font-mono">{registrationToDelete.nim}</span>)?
                <br />
                <span className="text-[11px] text-slate-500 block mt-1">Setelah dihapus, NIM ini dapat digunakan mendaftar kembali.</span>
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setRegistrationToDelete(null)}
                  className="w-1/2 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteRegistration(registrationToDelete.id);
                    setRegistrationToDelete(null);
                  }}
                  className="w-1/2 py-2.5 px-4 rounded-xl bg-[#E4202A] hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Ya, Hapus</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 5: KONFIRMASI HAPUS PENGGUNA */}
      {/* ============================================================== */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-rose-100 text-[#E4202A] flex items-center justify-center mx-auto mb-4 border border-rose-200">
                <Trash2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 mb-1">
                Hapus Akun Pengguna?
              </h3>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Yakin ingin menghapus akun pengelola <strong>"{userToDelete.username}"</strong> ({userToDelete.name})?
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setUserToDelete(null)}
                  className="w-1/2 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteManagedUser(userToDelete.id);
                    refreshUsersList();
                    setUserToDelete(null);
                  }}
                  className="w-1/2 py-2.5 px-4 rounded-xl bg-[#E4202A] hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Ya, Hapus</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: IMPORT MASTER MATAKULIAH (EXCEL / CSV) UNTUK BAAK */}
      {/* ============================================================== */}
      {isCourseImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <FileUp className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white leading-tight">
                    Import Master Matakuliah, SKS & Kelas
                  </h3>
                  <p className="text-xs text-blue-100">
                    Unggah spreadsheet Excel (.xlsx) atau CSV untuk memperbarui katalog mata kuliah pada formulir pendaftaran.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCourseImportModalOpen(false);
                  setImportParsedCourses([]);
                  setImportCourseError(null);
                  setImportCourseSuccess(null);
                }}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              
              {/* Step 1: Download Template */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm text-blue-950 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px] font-mono">1</span>
                      Unduh Template Standar
                    </h4>
                    <p className="text-[11px] text-blue-800 mt-0.5">
                      Gunakan format template yang sudah disesuaikan dengan kolom: Kode, Nama MK, SKS, Semester, Prodi, dan Opsi Kelas.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => downloadMasterCoursesTemplate('xlsx')}
                      className="px-3 py-1.5 bg-white hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" />
                      <span>Template Excel (.xlsx)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadMasterCoursesTemplate('csv')}
                      className="px-3 py-1.5 bg-white hover:bg-blue-100 text-blue-900 border border-blue-300 rounded-lg text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" />
                      <span>Template CSV (.csv)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2: Upload File */}
              <div className="bg-slate-50 border border-slate-300 rounded-xl p-4">
                <h4 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center text-[11px] font-mono">2</span>
                  Pilih File Spreadsheet untuk Diimpor
                </h4>

                <label className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer bg-white transition-colors group">
                  <Upload className="w-8 h-8 text-slate-400 group-hover:text-blue-600 mb-2 transition-colors" />
                  <span className="text-xs font-bold text-slate-800 group-hover:text-blue-600">
                    Klik untuk memilih file Excel (.xlsx, .xls) atau .csv
                  </span>
                  <span className="text-[11px] text-slate-500 mt-0.5">
                    Maksimal ukuran file 5 MB
                  </span>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileSelectForMasterCourseImport}
                    className="hidden"
                  />
                </label>

                {importCourseError && (
                  <div className="mt-3 p-3 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{importCourseError}</span>
                  </div>
                )}

                {importCourseSuccess && (
                  <div className="mt-3 p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-xs text-emerald-800 flex items-center gap-2 font-bold animate-fade-in">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{importCourseSuccess}</span>
                  </div>
                )}
              </div>

              {/* Step 3: Pratinjau Data yang Terdeteksi */}
              {importParsedCourses.length > 0 && (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <h4 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px] font-mono">3</span>
                      Pratinjau Data ({importParsedCourses.length} Mata Kuliah Terdeteksi)
                    </h4>
                    
                    {/* Mode Import */}
                    <div className="flex items-center gap-3 text-xs bg-slate-100 p-1.5 rounded-lg border border-slate-300">
                      <label className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-800">
                        <input
                          type="radio"
                          name="importMode"
                          value="append"
                          checked={importMode === 'append'}
                          onChange={() => setImportMode('append')}
                          className="text-blue-600"
                        />
                        <span>Tambahkan (Append)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer font-bold text-rose-700">
                        <input
                          type="radio"
                          name="importMode"
                          value="replace"
                          checked={importMode === 'replace'}
                          onChange={() => setImportMode('replace')}
                          className="text-rose-600"
                        />
                        <span>Gantikan Semua (Replace All)</span>
                      </label>
                    </div>
                  </div>

                  <div className="border border-slate-300 rounded-lg max-h-60 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 border-b border-slate-300 text-slate-700 font-bold sticky top-0">
                        <tr>
                          <th className="py-2 px-2.5 w-10 text-center">No</th>
                          <th className="py-2 px-2.5">Nama Mata Kuliah</th>
                          <th className="py-2 px-2.5 w-20 text-center">Semester</th>
                          <th className="py-2 px-2.5 w-16 text-center">SKS</th>
                          <th className="py-2 px-2.5 w-28">Prodi</th>
                          <th className="py-2 px-2.5">Kelas Ditawarkan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {importParsedCourses.map((c, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-1.5 px-2.5 text-center font-mono text-slate-500">{i + 1}</td>
                            <td className="py-1.5 px-2.5 font-medium text-slate-900">{c.name}</td>
                            <td className="py-1.5 px-2.5 text-center">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-900 border border-blue-200">
                                Sem {c.semester}
                              </span>
                            </td>
                            <td className="py-1.5 px-2.5 text-center font-bold text-blue-900">{c.sks} SKS</td>
                            <td className="py-1.5 px-2.5 capitalize text-slate-700">{c.prodi}</td>
                            <td className="py-1.5 px-2.5">
                              <span className="text-[10px] text-slate-600">
                                {(c.availableClasses || []).join(', ')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setIsCourseImportModalOpen(false);
                  setImportParsedCourses([]);
                  setImportCourseError(null);
                  setImportCourseSuccess(null);
                }}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-300 cursor-pointer transition-colors"
              >
                Batal
              </button>

              <button
                type="button"
                disabled={importParsedCourses.length === 0}
                onClick={handleConfirmMasterCourseImport}
                className={`px-5 py-2 rounded-lg text-xs font-bold shadow-md flex items-center gap-2 transition-all ${
                  importParsedCourses.length === 0
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-blue-500/25'
                }`}
              >
                <Check className="w-4 h-4" />
                <span>
                  Terapkan {importParsedCourses.length} Mata Kuliah ke Sistem
                </span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: SALIN MATA KULIAH DARI TAHUN LALU (DUPLIKASI CEPAT) */}
      {/* ============================================================== */}
      {isCopyCoursesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-800">
            {/* Header */}
            <div className="bg-amber-500 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center font-bold">
                  <Copy className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Salin Mata Kuliah Antar Tahun Ajaran</h3>
                  <p className="text-[11px] text-white/90">Duplikasi cepat katalog kurikulum ke periode baru</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCopyCoursesModalOpen(false)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-slate-800 dark:text-slate-100">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Fitur ini akan menyalin seluruh mata kuliah dari Tahun Ajaran Asal ke Tahun Ajaran Tujuan. Sangat praktis saat membuka tahun ajaran baru sehingga Anda tidak perlu menginput ulang secara manual.
                </span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    1. Tahun Ajaran Asal (Sumber Data)
                  </label>
                  <select
                    value={copySourceYear}
                    onChange={(e) => setCopySourceYear(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {(adminSettings.availableAcademicYears || ['2023/2024', '2024/2025', '2025/2026', '2026/2027']).map((yr) => {
                      const count = courses.filter(c => (c.academicYear || '2025/2026') === yr).length;
                      return (
                        <option key={yr} value={yr}>
                          T.A. {yr} ({count} Mata Kuliah Tersedia)
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    2. Tahun Ajaran Tujuan (Penerima Duplikasi)
                  </label>
                  <select
                    value={copyTargetYear}
                    onChange={(e) => setCopyTargetYear(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {(adminSettings.availableAcademicYears || ['2023/2024', '2024/2025', '2025/2026', '2026/2027']).map((yr) => {
                      const count = courses.filter(c => (c.academicYear || '2025/2026') === yr).length;
                      return (
                        <option key={yr} value={yr}>
                          T.A. {yr} {yr === currentActiveAcademicYear ? '(Aktif)' : ''} ({count} Mata Kuliah Sekarang)
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Ringkasan */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                  <div className="flex justify-between font-medium text-slate-600 dark:text-slate-400">
                    <span>Mata kuliah yang akan disalin:</span>
                    <strong className="text-amber-600 dark:text-amber-400">
                      {courses.filter(c => (c.academicYear || '2025/2026') === copySourceYear).length} Mata Kuliah
                    </strong>
                  </div>
                  <div className="flex justify-between font-medium text-slate-600 dark:text-slate-400">
                    <span>Arah penyalinan:</span>
                    <strong className="text-slate-900 dark:text-white">
                      T.A. {copySourceYear} &rarr; T.A. {copyTargetYear}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsCopyCoursesModalOpen(false)}
                className="px-4 py-2 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-600 cursor-pointer transition-colors"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleCopyCourses}
                disabled={courses.filter(c => (c.academicYear || '2025/2026') === copySourceYear).length === 0 || copySourceYear === copyTargetYear}
                className={`px-5 py-2 rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition-all ${
                  courses.filter(c => (c.academicYear || '2025/2026') === copySourceYear).length === 0 || copySourceYear === copyTargetYear
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-500'
                    : 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer shadow-amber-500/25 active:scale-95'
                }`}
              >
                <Copy className="w-4 h-4" />
                <span>Salin Mata Kuliah Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
