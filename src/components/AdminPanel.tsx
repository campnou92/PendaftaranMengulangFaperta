import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { 
  CourseItem, 
  SimpleRegistration, 
  SelectedCourseItem,
  RegistrationStatus,
  AdminSettings, 
  AuthUser,
  ManagedUser,
  UserRole,
  getMaxSksForBatch, 
  isClassRestrictedForRepeat,
  RegistrationFlowStep,
  RegistrationFlowSettings
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
  CalendarClock,
  AlertTriangle,
  Info,
  Award,
  Ban,
  Upload,
  FileUp,
  KeyRound,
  UserPlus,
  ShieldCheck,
  Eye,
  EyeOff,
  ChevronRight,
  Database,
  Copy,
  Loader2,
  ListOrdered
} from 'lucide-react';
import { INITIAL_COURSES, DEFAULT_ADMIN_SETTINGS, ANGKATAN_OPTIONS, DEFAULT_CLASSES, DEFAULT_REGISTRATION_FLOW } from '../data/courses';
import { downloadMasterCoursesTemplate, parseMasterCoursesFile } from '../utils/excelImportExport';
import { ExamAttendanceModal } from './ExamAttendanceModal';
import { RichNoteEditor } from './RichNoteEditor';
import { RegistrationPeriodsManager } from './RegistrationPeriodsManager';
import { renderFormattedNote } from '../utils/textFormatting';
import { 
  getStoredUsers, 
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
  onDeleteCourse?: (courseId: string) => Promise<void> | void;
  onDeleteBatchCourses?: (courseIds: string[]) => Promise<void> | void;
  onClearAllCourses?: () => Promise<void> | void;
  onUpdateSettings: (newSettings: AdminSettings) => void;
  onDeleteRegistration: (id: string) => void;
  onUpdateRegistrationStatus?: (id: string, status: RegistrationStatus, rejectionReason?: string) => void;
  onUpdateRegistration?: (updatedRegistration: SimpleRegistration) => void;
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
  onDeleteCourse,
  onDeleteBatchCourses,
  onClearAllCourses,
  onUpdateSettings,
  onDeleteRegistration,
  onUpdateRegistrationStatus,
  onUpdateRegistration,
  onViewReceipt,
  onSwitchToFinance,
  onLogout
}) => {
  const [activeTab, setActiveTab] = useState<'courses' | 'superadmin' | 'registrations' | 'users' | 'periods'>('registrations');

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
      academicYear: adminSettings.activeAcademicYear || '2025/2026',
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

  // Superadmin: Fitur Mengintip (Reveal/Peek) Password Semua Akun
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [showAllPasswords, setShowAllPasswords] = useState<boolean>(false);
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);

  const toggleRevealPassword = (userId: string) => {
    setRevealedPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleCopyCredentials = (user: ManagedUser) => {
    const text = `Username: ${user.username}\nPassword: ${user.password}\nPeran: ${user.title}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedUserId(user.id);
      setTimeout(() => setCopiedUserId(null), 2500);
    }).catch(() => {});
  };

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
  const [selectedCourseYear, setSelectedCourseYear] = useState<string>(() => {
    // Jika tahun ajaran aktif memiliki mata kuliah, tampilkan tahun ajaran aktif.
    // Jika tahun ajaran aktif belum memiliki mata kuliah khusus, default ke 'all' agar tabel tidak kosong membingungkan admin.
    const inActiveYear = (courses || []).filter(c => (c.academicYear || '2025/2026') === currentActiveAcademicYear).length;
    return inActiveYear > 0 ? currentActiveAcademicYear : 'all';
  });
  const [newCourseAcademicYear, setNewCourseAcademicYear] = useState<string>(currentActiveAcademicYear);
  const [editAcademicYear, setEditAcademicYear] = useState<string>(currentActiveAcademicYear);

  // Copy Courses modal state
  const [isCopyCoursesModalOpen, setIsCopyCoursesModalOpen] = useState(false);
  const [copySourceYear, setCopySourceYear] = useState<string>('2025/2026');
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

  // Courses yang relevan dengan filter Tahun Ajaran yang dipilih saat ini
  const coursesInSelectedYear = useMemo(() => {
    if (selectedCourseYear === 'all') return courses;
    return (courses || []).filter(c => (c.academicYear || '2025/2026') === selectedCourseYear);
  }, [courses, selectedCourseYear]);

  // Filter courses in table by semester
  const [filterCourseSemester, setFilterCourseSemester] = useState<string>('all');
  const uniqueCourseSemesters = useMemo(() => {
    const s = new Set<string>();
    const targetList = coursesInSelectedYear.length > 0 ? coursesInSelectedYear : courses;
    (targetList || []).forEach(c => {
      if (c.semester !== undefined && c.semester !== null && String(c.semester).trim() !== '') {
        s.add(String(c.semester).trim());
      }
    });
    return Array.from(s).sort((a, b) => (Number(a) || 0) - (Number(b) || 0));
  }, [coursesInSelectedYear, courses]);

  // Filter registrations by semester and class
  const [filterRegSemester, setFilterRegSemester] = useState<string>('all');
  const [filterRegClass, setFilterRegClass] = useState<string>('all');

  // Exam Attendance Print Modal State (UTS & UAS - Format Standar A4)
  const [isExamAttendanceModalOpen, setIsExamAttendanceModalOpen] = useState(false);
  const [examAttendanceCourseId, setExamAttendanceCourseId] = useState<string | undefined>(undefined);
  const [examAttendanceClass, setExamAttendanceClass] = useState<string | undefined>(undefined);

  // Editing course state
  const [editName, setEditName] = useState('');
  const [editSks, setEditSks] = useState(2);
  const [editProdi, setEditProdi] = useState<'agroteknologi' | 'agribisnis'>('agroteknologi');
  const [editSemester, setEditSemester] = useState<number>(3);
  const [editClasses, setEditClasses] = useState<string[]>([]);

  // Dedicated In-App Modals for Course Management (Anti-Gagal dalam Iframe)
  const [isEditCourseModalOpen, setIsEditCourseModalOpen] = useState(false);
  const [courseBeingEdited, setCourseBeingEdited] = useState<CourseItem | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<CourseItem | null>(null);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const [isBatchDeleteModalOpen, setIsBatchDeleteModalOpen] = useState(false);
  const [isResetCoursesModalOpen, setIsResetCoursesModalOpen] = useState(false);
  const [isClearAllCoursesModalOpen, setIsClearAllCoursesModalOpen] = useState(false);
  const [isClearingAllCourses, setIsClearingAllCourses] = useState(false);
  const [courseFeedback, setCourseFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isDeletingCourse, setIsDeletingCourse] = useState(false);

  // In-app Confirmations for Registrations and Users (No blocked window.confirm)
  const [registrationToDelete, setRegistrationToDelete] = useState<SimpleRegistration | null>(null);
  const [statusModalReg, setStatusModalReg] = useState<SimpleRegistration | null>(null);
  const [selectedNewStatus, setSelectedNewStatus] = useState<RegistrationStatus>('approved');
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>('');
  const [userToDelete, setUserToDelete] = useState<ManagedUser | null>(null);

  // Edit Registration State (Admin mengedit data pendaftaran & mengganti kelas mengulang)
  const [registrationBeingEdited, setRegistrationBeingEdited] = useState<SimpleRegistration | null>(null);
  const [editRegNama, setEditRegNama] = useState('');
  const [editRegNim, setEditRegNim] = useState('');
  const [editRegAngkatan, setEditRegAngkatan] = useState('2022');
  const [editRegKelasAsal, setEditRegKelasAsal] = useState('');
  const [editRegNoWa, setEditRegNoWa] = useState('');
  const [editRegEmail, setEditRegEmail] = useState('');
  const [editRegTargetSemester, setEditRegTargetSemester] = useState('Semester 3');
  const [editRegStatus, setEditRegStatus] = useState<RegistrationStatus>('approved');
  const [editRegAdminNotes, setEditRegAdminNotes] = useState('');
  const [editRegSelectedCourses, setEditRegSelectedCourses] = useState<SelectedCourseItem[]>([]);
  const [courseToAddInEdit, setCourseToAddInEdit] = useState<string>('');
  const [editRegFeedback, setEditRegFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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

  // Superadmin: Kelas Beasiswa & Pembatasan Kelas Mengulang Per Semester
  const [restrictedRepeatClassesDraft, setRestrictedRepeatClassesDraft] = useState<Record<string, string[]>>(
    adminSettings.restrictedRepeatClasses ?? (DEFAULT_ADMIN_SETTINGS.restrictedRepeatClasses || {})
  );
  const [restrictedRepeatClassReasonDraft, setRestrictedRepeatClassReasonDraft] = useState<Record<string, string>>(
    adminSettings.restrictedRepeatClassReason ?? (DEFAULT_ADMIN_SETTINGS.restrictedRepeatClassReason || {})
  );
  const [activeScholarshipSemesterTab, setActiveScholarshipSemesterTab] = useState<string>('3');
  const [newCustomScholarshipClass, setNewCustomScholarshipClass] = useState<string>('');
  const [scholarshipSavedFeedback, setScholarshipSavedFeedback] = useState<boolean>(false);
  const [scholarshipCourseSearch, setScholarshipCourseSearch] = useState<string>('');

  // BAAK: Modal & State Import Master Matakuliah
  const [isCourseImportModalOpen, setIsCourseImportModalOpen] = useState(false);
  const [importParsedCourses, setImportParsedCourses] = useState<CourseItem[]>([]);
  const [importCourseError, setImportCourseError] = useState<string | null>(null);
  const [importCourseSuccess, setImportCourseSuccess] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');

  // Superadmin: Editor Alur & Panduan Pendaftaran Mahasiswa
  const initialFlow = adminSettings.registrationFlow ?? DEFAULT_REGISTRATION_FLOW;
  const [flowTitleDraft, setFlowTitleDraft] = useState<string>(initialFlow.title);
  const [flowSubtitleDraft, setFlowSubtitleDraft] = useState<string>(initialFlow.subtitle);
  const [flowStepsDraft, setFlowStepsDraft] = useState<RegistrationFlowStep[]>(
    initialFlow.steps && initialFlow.steps.length === 4 ? initialFlow.steps : DEFAULT_REGISTRATION_FLOW.steps
  );
  const [flowHighlightDraft, setFlowHighlightDraft] = useState<string>(initialFlow.highlightNote);
  const [flowCommitmentDraft, setFlowCommitmentDraft] = useState<string>(initialFlow.commitmentText);
  const [flowSavedFeedback, setFlowSavedFeedback] = useState<boolean>(false);

  // Sync if adminSettings changes externally
  useEffect(() => {
    setFeeEnabled(adminSettings.feePerSksEnabled ?? true);
    setCostPerSks(adminSettings.costPerSks ?? 50000);
    setSelectedPaidBatches(adminSettings.paidBatches ?? ['2020', '2021', '2022']);
    setPaymentInstructionsDraft(adminSettings.paymentInstructions ?? DEFAULT_ADMIN_SETTINGS.paymentInstructions);
    setPaymentAccountInfoDraft(adminSettings.paymentAccountInfo ?? DEFAULT_ADMIN_SETTINGS.paymentAccountInfo);
    setRestrictedRepeatClassesDraft(adminSettings.restrictedRepeatClasses ?? (DEFAULT_ADMIN_SETTINGS.restrictedRepeatClasses || {}));
    setRestrictedRepeatClassReasonDraft(adminSettings.restrictedRepeatClassReason ?? (DEFAULT_ADMIN_SETTINGS.restrictedRepeatClassReason || {}));
    setActiveAcademicYearDraft(adminSettings.activeAcademicYear ?? '2025/2026');
    setActiveTermDraft(adminSettings.activeTerm ?? 'Ganjil');
    setAvailableYearsDraft(adminSettings.availableAcademicYears ?? ['2023/2024', '2024/2025', '2025/2026', '2026/2027']);

    const rf = adminSettings.registrationFlow ?? DEFAULT_REGISTRATION_FLOW;
    setFlowTitleDraft(rf.title);
    setFlowSubtitleDraft(rf.subtitle);
    setFlowStepsDraft(rf.steps && rf.steps.length === 4 ? rf.steps : DEFAULT_REGISTRATION_FLOW.steps);
    setFlowHighlightDraft(rf.highlightNote);
    setFlowCommitmentDraft(rf.commitmentText);
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
    setEditSemester(Number(course.semester) || 3);
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
      setCourseFeedback({ type: 'error', message: 'Tahun ajaran asal dan tujuan tidak boleh sama.' });
      setTimeout(() => setCourseFeedback(null), 3500);
      return;
    }
    const sourceCourses = courses.filter(c => (c.academicYear || '2025/2026') === copySourceYear);
    if (sourceCourses.length === 0) {
      setCourseFeedback({ type: 'error', message: `Tidak ada mata kuliah pada Tahun Ajaran ${copySourceYear} untuk disalin.` });
      setTimeout(() => setCourseFeedback(null), 3500);
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

  // Simpan Pengaturan Tahun Ajaran Aktif (Superadmin / Admin Fakultas)
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
      setCourseFeedback({ type: 'error', message: `Tahun ajaran "${clean}" sudah ada dalam daftar.` });
      setTimeout(() => setCourseFeedback(null), 3500);
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

  // Confirm delete course (from Modal) with permanent Cloud removal
  const handleConfirmDeleteCourse = async () => {
    if (!courseToDelete) return;
    const name = courseToDelete.name;
    const targetId = courseToDelete.id;
    setIsDeletingCourse(true);
    try {
      if (onDeleteCourse) {
        await onDeleteCourse(targetId);
      } else {
        onUpdateCourses(courses.filter(c => c.id !== targetId));
      }
      setSelectedCourseIds(prev => prev.filter(id => id !== targetId));
      setCourseToDelete(null);
      setCourseFeedback({
        type: 'success',
        message: `Mata kuliah "${name}" berhasil dihapus secara permanen dari sistem.`
      });
    } catch (err) {
      console.error('Failed to delete course:', err);
      setCourseFeedback({
        type: 'error',
        message: `Gagal menghapus mata kuliah "${name}". Silakan coba kembali.`
      });
    } finally {
      setIsDeletingCourse(false);
      setTimeout(() => setCourseFeedback(null), 3500);
    }
  };

  // Toggle select all visible courses
  const handleToggleSelectAllCourses = (filteredIds: string[]) => {
    if (filteredIds.length === 0) return;
    const allSelected = filteredIds.every(id => selectedCourseIds.includes(id));
    if (allSelected) {
      // Uncheck all in current filter
      setSelectedCourseIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      // Check all in current filter
      setSelectedCourseIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  };

  // Toggle select single course
  const handleToggleSelectCourse = (courseId: string) => {
    setSelectedCourseIds(prev =>
      prev.includes(courseId) ? prev.filter(id => id !== courseId) : [...prev, courseId]
    );
  };

  // Clear selection
  const handleClearSelectedCourses = () => {
    setSelectedCourseIds([]);
  };

  // Confirm batch delete courses with permanent Cloud removal
  const handleConfirmBatchDeleteCourses = async () => {
    if (selectedCourseIds.length === 0) return;
    const count = selectedCourseIds.length;
    const idsToDelete = [...selectedCourseIds];
    setIsDeletingCourse(true);
    try {
      if (onDeleteBatchCourses) {
        await onDeleteBatchCourses(idsToDelete);
      } else {
        const remaining = courses.filter(c => !idsToDelete.includes(c.id));
        onUpdateCourses(remaining);
      }
      setSelectedCourseIds([]);
      setIsBatchDeleteModalOpen(false);
      setCourseFeedback({
        type: 'success',
        message: `Berhasil menghapus ${count} mata kuliah terpilih dari katalog kurikulum.`
      });
    } catch (err) {
      console.error('Failed to batch delete courses:', err);
      setCourseFeedback({
        type: 'error',
        message: `Gagal menghapus mata kuliah terpilih. Silakan coba kembali.`
      });
    } finally {
      setIsDeletingCourse(false);
      setTimeout(() => setCourseFeedback(null), 3500);
    }
  };

  // Confirm reset to default 18 courses (from Modal)
  const handleConfirmResetCourses = () => {
    const targetYear = currentActiveAcademicYear || '2025/2026';
    const baseCourses = INITIAL_COURSES.map(c => ({
      ...c,
      academicYear: targetYear
    }));
    onUpdateCourses(baseCourses);
    setSelectedCourseIds([]);
    setIsResetCoursesModalOpen(false);
    setCourseFeedback({
      type: 'success',
      message: `Daftar mata kuliah berhasil dikembalikan ke 18 mata kuliah bawaan FP INSTIPER untuk T.A. ${targetYear}.`
    });
    setTimeout(() => setCourseFeedback(null), 3500);
  };

  // Confirm clear ALL courses across all academic years
  const handleConfirmClearAllCourses = async () => {
    setIsClearingAllCourses(true);
    try {
      if (onClearAllCourses) {
        await onClearAllCourses();
      } else {
        onUpdateCourses([]);
      }
      setSelectedCourseIds([]);
      setIsClearAllCoursesModalOpen(false);
      setCourseFeedback({
        type: 'success',
        message: 'Seluruh katalog mata kuliah berhasil dikosongkan secara permanen dari sistem & Cloud.'
      });
    } catch (err) {
      console.error('Failed to clear all courses:', err);
      setCourseFeedback({
        type: 'error',
        message: 'Gagal mengosongkan seluruh mata kuliah. Silakan coba kembali.'
      });
    } finally {
      setIsClearingAllCourses(false);
      setTimeout(() => setCourseFeedback(null), 3500);
    }
  };

  // ==========================================
  // HANDLERS: EDIT DATA PENDAFTARAN & KELAS MENGULANG
  // ==========================================
  const handleStartEditRegistration = (reg: SimpleRegistration) => {
    setRegistrationBeingEdited(reg);
    setEditRegNama(reg.nama || '');
    setEditRegNim(reg.nim || '');
    setEditRegAngkatan(reg.angkatan || '2022');
    setEditRegKelasAsal(reg.kelasAsal || '');
    setEditRegNoWa(reg.noWa || '');
    setEditRegEmail(reg.email || '');
    setEditRegTargetSemester(reg.targetSemester || 'Semester 3');
    setEditRegStatus(reg.status || 'approved');
    setEditRegAdminNotes(reg.adminNotes || reg.rejectionReason || '');
    setEditRegSelectedCourses(reg.selectedCourses ? JSON.parse(JSON.stringify(reg.selectedCourses)) : []);
    setCourseToAddInEdit('');
    setEditRegFeedback(null);
  };

  const handleChangeCourseClassInEdit = (index: number, newClass: string) => {
    setEditRegSelectedCourses(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], selectedClass: newClass };
      return copy;
    });
  };

  const handleRemoveCourseFromEdit = (index: number) => {
    setEditRegSelectedCourses(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddCourseToRegistrationEdit = () => {
    if (!courseToAddInEdit) return;
    const courseObj = courses.find(c => c.id === courseToAddInEdit);
    if (!courseObj) return;

    if (editRegSelectedCourses.some(c => c.courseId === courseObj.id)) {
      setEditRegFeedback({
        type: 'error',
        message: `Mata kuliah "${courseObj.name}" sudah ada dalam daftar mahasiswa ini.`
      });
      setTimeout(() => setEditRegFeedback(null), 3500);
      return;
    }

    const availableClasses = courseObj.availableClasses && courseObj.availableClasses.length > 0
      ? courseObj.availableClasses
      : adminSettings.classOptions;
    const defaultClass = availableClasses[0] || 'Kelas A';

    setEditRegSelectedCourses(prev => [
      ...prev,
      {
        courseId: courseObj.id,
        name: courseObj.name,
        sks: courseObj.sks,
        prodi: courseObj.prodi,
        semester: courseObj.semester,
        selectedClass: defaultClass,
        academicYear: courseObj.academicYear || registrationBeingEdited?.academicYear || adminSettings.activeAcademicYear || '2025/2026'
      }
    ]);
    setCourseToAddInEdit('');
  };

  const handleSaveRegistrationEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!registrationBeingEdited) return;

    const cleanNama = editRegNama.trim();
    const cleanNim = editRegNim.trim().toUpperCase();

    if (!cleanNama || !cleanNim) {
      setEditRegFeedback({
        type: 'error',
        message: 'Nama dan NIM mahasiswa tidak boleh kosong.'
      });
      return;
    }

    if (editRegSelectedCourses.length === 0) {
      setEditRegFeedback({
        type: 'error',
        message: 'Mahasiswa harus mengambil minimal 1 mata kuliah.'
      });
      return;
    }

    const currentTotalSks = editRegSelectedCourses.reduce((sum, c) => sum + (Number(c.sks) || 0), 0);
    const maxSksAllowed = getMaxSksForBatch(editRegAngkatan, adminSettings);

    if (currentTotalSks > maxSksAllowed) {
      setEditRegFeedback({
        type: 'error',
        message: `Total beban SKS (${currentTotalSks} SKS) melebihi batas kuota Angkatan ${editRegAngkatan} (maksimal ${maxSksAllowed} SKS).`
      });
      return;
    }

    const isPaidBatch = (adminSettings.paidBatches || []).includes(editRegAngkatan);
    const costPerSks = adminSettings.costPerSks || 50000;
    const estimatedFee = (adminSettings.feePerSksEnabled && isPaidBatch) ? currentTotalSks * costPerSks : 0;

    const updatedReg: SimpleRegistration = {
      ...registrationBeingEdited,
      nama: cleanNama,
      nim: cleanNim,
      angkatan: editRegAngkatan,
      kelasAsal: editRegKelasAsal.trim(),
      noWa: editRegNoWa.trim(),
      email: editRegEmail.trim(),
      targetSemester: editRegTargetSemester,
      status: editRegStatus,
      adminNotes: editRegAdminNotes.trim(),
      rejectionReason: editRegStatus === 'rejected' ? (editRegAdminNotes.trim() || registrationBeingEdited.rejectionReason || 'Ditolak oleh admin') : '',
      selectedCourses: editRegSelectedCourses,
      totalSks: currentTotalSks,
      estimatedFee,
      paymentStatus: registrationBeingEdited.paymentStatus
    };

    if (onUpdateRegistration) {
      onUpdateRegistration(updatedReg);
    }

    setRegistrationBeingEdited(null);
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

  // Superadmin: Simpan Pengaturan Alur Pendaftaran
  const handleSaveFlowSettings = () => {
    const updatedFlow: RegistrationFlowSettings = {
      title: flowTitleDraft.trim() || DEFAULT_REGISTRATION_FLOW.title,
      subtitle: flowSubtitleDraft.trim() || DEFAULT_REGISTRATION_FLOW.subtitle,
      steps: flowStepsDraft.map((st, idx) => ({
        step: idx + 1,
        title: st.title.trim() || DEFAULT_REGISTRATION_FLOW.steps[idx].title,
        desc: st.desc.trim() || DEFAULT_REGISTRATION_FLOW.steps[idx].desc,
        tag: (st.tag ?? '').trim() || DEFAULT_REGISTRATION_FLOW.steps[idx].tag
      })),
      highlightNote: flowHighlightDraft.trim() || DEFAULT_REGISTRATION_FLOW.highlightNote,
      commitmentText: flowCommitmentDraft.trim() || DEFAULT_REGISTRATION_FLOW.commitmentText
    };

    onUpdateSettings({
      ...adminSettings,
      registrationFlow: updatedFlow
    });
    setFlowSavedFeedback(true);
    setTimeout(() => setFlowSavedFeedback(false), 2500);
  };

  // Superadmin: Reset Pengaturan Alur Pendaftaran ke Default
  const handleResetFlowSettings = () => {
    setFlowTitleDraft(DEFAULT_REGISTRATION_FLOW.title);
    setFlowSubtitleDraft(DEFAULT_REGISTRATION_FLOW.subtitle);
    setFlowStepsDraft(DEFAULT_REGISTRATION_FLOW.steps);
    setFlowHighlightDraft(DEFAULT_REGISTRATION_FLOW.highlightNote);
    setFlowCommitmentDraft(DEFAULT_REGISTRATION_FLOW.commitmentText);

    onUpdateSettings({
      ...adminSettings,
      registrationFlow: DEFAULT_REGISTRATION_FLOW
    });
    setFlowSavedFeedback(true);
    setTimeout(() => setFlowSavedFeedback(false), 2500);
  };

  const handleUpdateStepDraft = (index: number, field: keyof RegistrationFlowStep, value: string) => {
    setFlowStepsDraft(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Add Class Option
  const handleAddClassOption = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newClassName.trim();
    if (!trimmed) return;

    if (adminSettings.classOptions.includes(trimmed)) {
      setCourseFeedback({ type: 'error', message: `Opsi "${trimmed}" sudah ada dalam daftar.` });
      setTimeout(() => setCourseFeedback(null), 3500);
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
      setCourseFeedback({ type: 'error', message: 'Minimal harus ada 1 opsi kelas aktif.' });
      setTimeout(() => setCourseFeedback(null), 3500);
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
      setCourseFeedback({ type: 'error', message: `Angkatan ${trimmed} sudah ada dalam daftar.` });
      setTimeout(() => setCourseFeedback(null), 3500);
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
    let nextDraft: Record<string, string[]> = { ...restrictedRepeatClassesDraft };
    if (presetType === 'standard') {
      nextDraft[activeScholarshipSemesterTab] = ['Kelas Beasiswa'];
    } else if (presetType === 'clear') {
      nextDraft[activeScholarshipSemesterTab] = [];
    } else if (presetType === 'all-beasiswa') {
      nextDraft[activeScholarshipSemesterTab] = ['Kelas Beasiswa'];
    }
    setRestrictedRepeatClassesDraft(nextDraft);
    handleSaveScholarshipSettings(nextDraft);
  };

  // Semesters yang dibuka / tersedia di aplikasi (Periode Pendaftaran & Master Courses)
  const openSemestersForScholarship = useMemo(() => {
    const sems = new Set<string>();
    // 1. Dari registrationPeriods (periode pendaftaran yang dibuka/ada)
    if (adminSettings.registrationPeriods && adminSettings.registrationPeriods.length > 0) {
      adminSettings.registrationPeriods.forEach(p => {
        if (p.semester !== undefined && p.semester !== null) {
          sems.add(String(p.semester));
        }
      });
    }
    // 2. Dari courses
    courses.forEach(c => {
      if (c.semester !== undefined && c.semester !== null) {
        sems.add(String(c.semester));
      }
    });
    // 3. Fallback jika masih kosong
    if (sems.size === 0) {
      sems.add('3');
      sems.add('5');
    }
    return Array.from(sems).sort((a, b) => {
      const numA = Number(a);
      const numB = Number(b);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b);
    });
  }, [adminSettings.registrationPeriods, courses]);

  // Auto-switch jika activeScholarshipSemesterTab tidak ada di openSemestersForScholarship
  useEffect(() => {
    if (openSemestersForScholarship.length > 0 && !openSemestersForScholarship.includes(activeScholarshipSemesterTab)) {
      setActiveScholarshipSemesterTab(openSemestersForScholarship[0]);
    }
  }, [openSemestersForScholarship, activeScholarshipSemesterTab]);

  // Periode aktif untuk semester yang dipilih (jika ada)
  const activePeriodForSelectedSem = useMemo(() => {
    return (adminSettings.registrationPeriods || []).find(
      p => String(p.semester) === String(activeScholarshipSemesterTab)
    );
  }, [adminSettings.registrationPeriods, activeScholarshipSemesterTab]);

  // Daftar matakuliah untuk semester yang dipilih
  const coursesInSelectedScholarshipSemester = useMemo(() => {
    const map = new Map<string, CourseItem>();
    if (activePeriodForSelectedSem?.courses) {
      activePeriodForSelectedSem.courses.forEach(c => map.set(c.id, c));
    }
    courses.filter(c => String(c.semester) === String(activeScholarshipSemesterTab)).forEach(c => {
      if (!map.has(c.id)) {
        map.set(c.id, c);
      }
    });
    const list = Array.from(map.values());
    if (!scholarshipCourseSearch.trim()) return list;
    const q = scholarshipCourseSearch.toLowerCase().trim();
    return list.filter(c => c.name.toLowerCase().includes(q) || c.prodi.toLowerCase().includes(q));
  }, [courses, activePeriodForSelectedSem, activeScholarshipSemesterTab, scholarshipCourseSearch]);

  // Handler untuk mengupdate kelas & status beasiswa pada mata kuliah spesifik
  const handleUpdateCourseClasses = (
    courseId: string, 
    updatedAvailable: string[], 
    updatedRestricted?: string[]
  ) => {
    const updatedGlobalCourses = courses.map(c => {
      if (c.id === courseId) {
        return {
          ...c,
          availableClasses: updatedAvailable,
          restrictedClasses: updatedRestricted !== undefined ? updatedRestricted : c.restrictedClasses
        };
      }
      return c;
    });
    onUpdateCourses(updatedGlobalCourses);

    // Sinkronkan juga ke periode pendaftaran jika ada
    if (activePeriodForSelectedSem && adminSettings.registrationPeriods) {
      const updatedPeriods = adminSettings.registrationPeriods.map(p => {
        if (p.id === activePeriodForSelectedSem.id && p.courses) {
          const newPeriodCourses = p.courses.map(c => {
            if (c.id === courseId) {
              return {
                ...c,
                availableClasses: updatedAvailable,
                restrictedClasses: updatedRestricted !== undefined ? updatedRestricted : c.restrictedClasses
              };
            }
            return c;
          });
          return { ...p, courses: newPeriodCourses };
        }
        return p;
      });
      onUpdateSettings({
        ...adminSettings,
        registrationPeriods: updatedPeriods
      });
    }

    setScholarshipSavedFeedback(true);
    setTimeout(() => setScholarshipSavedFeedback(false), 2000);
  };

  // Toggle status beasiswa/larangan untuk suatu kelas pada mata kuliah spesifik
  const handleToggleCourseRestriction = (course: CourseItem, className: string) => {
    const defaultRestricted = restrictedRepeatClassesDraft[String(course.semester)] || [];
    const currentRestricted = Array.isArray(course.restrictedClasses) 
      ? course.restrictedClasses 
      : [...defaultRestricted];
    
    const nextRestricted = currentRestricted.includes(className)
      ? currentRestricted.filter(c => c !== className)
      : [...currentRestricted, className];

    const currentAvailable = (course.availableClasses && course.availableClasses.length > 0)
      ? course.availableClasses
      : (adminSettings.classOptions || DEFAULT_CLASSES);

    handleUpdateCourseClasses(course.id, currentAvailable, nextRestricted);
  };

  // Tambah kelas ke mata kuliah tertentu
  const handleAddClassToCourse = (course: CourseItem, className: string) => {
    const currentAvailable = (course.availableClasses && course.availableClasses.length > 0)
      ? course.availableClasses
      : (adminSettings.classOptions || DEFAULT_CLASSES);
    
    if (currentAvailable.includes(className)) return;
    const nextAvailable = [...currentAvailable, className];
    handleUpdateCourseClasses(course.id, nextAvailable);
  };

  // Hapus kelas dari mata kuliah tertentu
  const handleRemoveClassFromCourse = (course: CourseItem, className: string) => {
    const currentAvailable = (course.availableClasses && course.availableClasses.length > 0)
      ? course.availableClasses
      : (adminSettings.classOptions || DEFAULT_CLASSES);
    
    if (currentAvailable.length <= 1) return; // Sisakan minimal 1 kelas
    const nextAvailable = currentAvailable.filter(c => c !== className);
    const nextRestricted = (course.restrictedClasses || []).filter(c => c !== className);
    handleUpdateCourseClasses(course.id, nextAvailable, nextRestricted);
  };

  // Reset mata kuliah ke aturan bawaan semester
  const handleResetCourseToSemesterDefaults = (courseId: string) => {
    const defaultClasses = adminSettings.classOptions || DEFAULT_CLASSES;
    const defaultRestricted = restrictedRepeatClassesDraft[activeScholarshipSemesterTab] || [];
    handleUpdateCourseClasses(courseId, [...defaultClasses], [...defaultRestricted]);
  };

  // Terapkan bawaan semester ke SEMUA mata kuliah di semester yang aktif
  const handleApplySemesterDefaultsToAllCourses = (semKey: string) => {
    const defaultClasses = adminSettings.classOptions || DEFAULT_CLASSES;
    const defaultRestricted = restrictedRepeatClassesDraft[semKey] || [];

    const updatedGlobalCourses = courses.map(c => {
      if (String(c.semester) === String(semKey)) {
        return {
          ...c,
          availableClasses: [...defaultClasses],
          restrictedClasses: [...defaultRestricted]
        };
      }
      return c;
    });
    onUpdateCourses(updatedGlobalCourses);

    if (activePeriodForSelectedSem && adminSettings.registrationPeriods) {
      const updatedPeriods = adminSettings.registrationPeriods.map(p => {
        if (p.id === activePeriodForSelectedSem.id && p.courses) {
          const newPeriodCourses = p.courses.map(c => ({
            ...c,
            availableClasses: [...defaultClasses],
            restrictedClasses: [...defaultRestricted]
          }));
          return { ...p, courses: newPeriodCourses };
        }
        return p;
      });
      onUpdateSettings({
        ...adminSettings,
        registrationPeriods: updatedPeriods
      });
    }

    setScholarshipSavedFeedback(true);
    setTimeout(() => setScholarshipSavedFeedback(false), 2500);
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
      setCourseFeedback({ type: 'error', message: 'Belum ada data pendaftar untuk diexport.' });
      setTimeout(() => setCourseFeedback(null), 3500);
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

  // Daftar semester unik yang tersedia dari data mata kuliah, periode, & registrasi aktif
  const availableRegSemesters = useMemo(() => {
    const semSet = new Set<string>();
    (courses || []).forEach(c => {
      if (c.semester !== undefined && c.semester !== null && String(c.semester).trim() !== '') {
        semSet.add(String(c.semester).trim());
      }
    });
    (adminSettings.registrationPeriods || []).forEach(p => {
      if (p.semester) semSet.add(String(p.semester).trim());
      (p.courses || []).forEach(c => {
        if (c.semester) semSet.add(String(c.semester).trim());
      });
    });
    registrations.forEach(r => {
      const matches = r.targetSemester?.match(/\d+/g);
      if (matches) matches.forEach(m => semSet.add(m));
      r.selectedCourses?.forEach(c => {
        if (c.semester) semSet.add(String(c.semester).trim());
      });
    });
    if (semSet.size === 0) {
      INITIAL_COURSES.forEach(c => {
        if (c.semester) semSet.add(String(c.semester).trim());
      });
    }
    return Array.from(semSet).sort((a, b) => (Number(a) || 0) - (Number(b) || 0));
  }, [courses, adminSettings.registrationPeriods, registrations]);

  // Dynamic Semester Cards for Rekapitulasi Dashboard
  const rekapSemesterStats = useMemo(() => {
    const semSet = new Set<string>();

    // 1. Semester dari seluruh pendaftar saat ini (prioritas tertinggi)
    registrations.forEach(r => {
      const match = r.targetSemester?.match(/\d+/g);
      if (match) match.forEach(m => semSet.add(m));
      r.selectedCourses?.forEach(c => {
        if (c.semester !== undefined && c.semester !== null) semSet.add(String(c.semester).trim());
      });
    });

    // 2. Semester dari periode pendaftaran yang dibuat / dibuka
    (adminSettings.registrationPeriods || []).forEach(p => {
      if (p.semester !== undefined && p.semester !== null) semSet.add(String(p.semester).trim());
    });

    // 3. Fallback jika masih sedikit
    availableRegSemesters.forEach(s => semSet.add(s));

    if (semSet.size === 0) {
      semSet.add('1');
      semSet.add('3');
      semSet.add('5');
    }

    const sortedSemesters = Array.from(semSet).sort((a, b) => (Number(a) || 0) - (Number(b) || 0));

    return sortedSemesters.map(sem => {
      const matchingRegs = registrations.filter(r => 
        r.targetSemester === `Semester ${sem}` || 
        r.targetSemester === sem || 
        r.selectedCourses?.some(c => String(c.semester) === String(sem))
      );

      const totalSksForSem = matchingRegs.reduce((acc, r) => {
        const semCourses = r.selectedCourses?.filter(c => String(c.semester) === String(sem));
        if (semCourses && semCourses.length > 0) {
          return acc + semCourses.reduce((sum, c) => sum + (c.sks || 0), 0);
        }
        return acc + (r.totalSks || 0);
      }, 0);

      const period = (adminSettings.registrationPeriods || []).find(p => String(p.semester) === String(sem));
      const isOpen = period ? period.isOpen : true;
      const semNum = Number(sem);
      const isGanjil = isNaN(semNum) ? false : semNum % 2 !== 0;

      const theme = isGanjil 
        ? {
            border: 'border-emerald-200/90 dark:border-emerald-800/60',
            bgIcon: 'bg-emerald-100/60 dark:bg-emerald-950/80 text-[#166534] dark:text-emerald-400',
            textTitle: 'text-[#166534] dark:text-emerald-400',
            textNumber: 'text-[#166534] dark:text-emerald-300',
            badgeBg: 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300',
            badgeText: 'GANJIL',
            icon: sem === '1' ? '🌱' : sem === '3' ? '🌿' : '🌾'
          }
        : {
            border: 'border-blue-200/90 dark:border-blue-800/60',
            bgIcon: 'bg-blue-100/60 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400',
            textTitle: 'text-blue-700 dark:text-blue-400',
            textNumber: 'text-blue-800 dark:text-blue-300',
            badgeBg: 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300',
            badgeText: 'GENAP',
            icon: sem === '2' ? '🌴' : sem === '4' ? '🌳' : '🪴'
          };

      return {
        semester: sem,
        count: matchingRegs.length,
        totalSks: totalSksForSem,
        period,
        isOpen,
        isGanjil,
        theme
      };
    });
  }, [registrations, adminSettings.registrationPeriods, availableRegSemesters]);

  const lintasRegistrations = useMemo(() => {
    return registrations.filter(r => 
      r.targetSemester?.toLowerCase().includes('gabungan') || 
      r.targetSemester?.toLowerCase().includes('lintas')
    );
  }, [registrations]);

  const getSemesterBadgeStyle = (semText?: string) => {
    if (!semText) return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300';
    const clean = semText.toLowerCase();
    if (clean.includes('gabungan') || clean.includes('lintas')) {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300';
    }
    const match = semText.match(/\d+/);
    if (match) {
      const num = Number(match[0]);
      if (num === 1) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300';
      if (num === 2) return 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border border-teal-300';
      if (num === 3) return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 border border-green-300';
      if (num === 4) return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300 border border-cyan-300';
      if (num === 5) return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-300';
      if (num === 6) return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-300';
      if (num === 7) return 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300 border border-violet-300';
      if (num === 8) return 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-950 dark:text-fuchsia-300 border border-fuchsia-300';
    }
    return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300';
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

    if (filterRegSemester !== 'all') {
      if (filterRegSemester === 'gabungan') {
        const isGab = r.targetSemester?.toLowerCase().includes('gabungan') || r.targetSemester?.toLowerCase().includes('lintas');
        if (!isGab) return false;
      } else {
        const matchesTarget = r.targetSemester === filterRegSemester || r.targetSemester === `Semester ${filterRegSemester}`;
        const matchesCourse = r.selectedCourses?.some(c => String(c.semester) === String(filterRegSemester));
        if (!matchesTarget && !matchesCourse) return false;
      }
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
                    PORTAL PENGELOLA
                  </span>
                  <span className="bg-[#008744] text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                    ADMIN
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

                {/* Menu: Periode Pendaftaran (Buka Periode & Record Semester) */}
                <button
                  type="button"
                  onClick={() => setActiveTab('periods')}
                  className={`flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                    activeTab === 'periods'
                      ? 'bg-[#008744] text-white font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 font-medium'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Calendar className={`w-4 h-4 shrink-0 ${activeTab === 'periods' ? 'text-white' : 'text-[#008744]'}`} />
                    <span className="truncate">Periode Pendaftaran</span>
                  </div>
                  {activeTab === 'periods' ? (
                    <ChevronRight className="w-4 h-4 text-white shrink-0 ml-1" />
                  ) : (
                    <span className="px-2 py-0.5 text-[9px] rounded-full font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                      Buka
                    </span>
                  )}
                </button>

                {/* Menu: Pengaturan Umum & Biaya Fakultas */}
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
                    <Sliders className={`w-4 h-4 shrink-0 ${activeTab === 'superadmin' ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">Pengaturan Umum &amp; Biaya</span>
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

            {/* Kelompok Menu: DOKUMEN & PRESENSI */}
            <div>
              <div className="px-3 pb-2 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                DOKUMEN &amp; PRESENSI
              </div>
              <nav className="space-y-1">
                {/* Menu: Presensi Ujian (UTS / UAS) */}
                <button
                  type="button"
                  onClick={() => {
                    setExamAttendanceCourseId(undefined);
                    setExamAttendanceClass(undefined);
                    setIsExamAttendanceModalOpen(true);
                  }}
                  className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-xs transition-all cursor-pointer text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-amber-50/70 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:hover:bg-amber-950/60 font-semibold border border-amber-200/80 dark:border-amber-900/50"
                  title="Cetak Presensi Ujian UTS &amp; UAS format standar A4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Printer className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span className="truncate">Presensi Ujian (UTS/UAS)</span>
                  </div>
                  <span className="px-1.5 py-0.2 text-[9px] rounded-md font-bold uppercase tracking-wider bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200">
                    A4
                  </span>
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
                    title="Kelola Akun, Username & Password Pengelola (Khusus Superadmin - Terpisah dari Admin Fakultas)"
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
                  {activeTab === 'periods' && 'Periode Pendaftaran & Penawaran MK'}
                  {activeTab === 'courses' && 'Mata Kuliah & SKS'}
                  {activeTab === 'superadmin' && 'Pengaturan Umum & Biaya Fakultas'}
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
                  <span>Akses Khusus Superadmin (Terpisah dari Admin Fakultas)</span>
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
                  Semua ({coursesInSelectedYear.length})
                </button>
                {uniqueCourseSemesters.map((sem) => (
                  <button
                    key={sem}
                    type="button"
                    onClick={() => setFilterCourseSemester(sem)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      filterCourseSemester === sem
                        ? 'bg-[#166534] text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700'
                    }`}
                  >
                    Semester {sem} ({coursesInSelectedYear.filter(c => String(c.semester) === sem).length})
                  </button>
                ))}
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

                {courses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsClearAllCoursesModalOpen(true)}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-[#E4202A] dark:text-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 border border-rose-200 dark:border-rose-800 shadow-2xs transition-colors cursor-pointer"
                    title="Kosongkan seluruh mata kuliah di semua tahun ajaran dan semester"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Kosongkan Semua MK ({courses.length})</span>
                  </button>
                )}

                {selectedCourseIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsBatchDeleteModalOpen(true)}
                    className="px-3 py-2 bg-[#E4202A] hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer animate-fade-in"
                    title="Hapus mata kuliah yang telah dipilih"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Terpilih ({selectedCourseIds.length})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Banner Informatif jika Tahun Ajaran terpilih belum memiliki mata kuliah */}
            {selectedCourseYear !== 'all' && coursesInSelectedYear.length === 0 && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs mb-4 animate-fade-in">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-sm text-amber-800 dark:text-amber-200">
                      Tahun Ajaran {selectedCourseYear} Belum Memiliki Mata Kuliah Khusus (0 MK)
                    </p>
                    <p className="mt-0.5 text-amber-700 dark:text-amber-300 leading-relaxed">
                      Saat ini terdapat <strong>{courses.length} mata kuliah master</strong> di Tahun Ajaran lain (T.A. 2025/2026). Di form pendaftaran depan mahasiswa, sistem otomatis menggunakan mata kuliah master tersebut sebagai cadangan. Anda dapat menyalinnya sekarang ke T.A. {selectedCourseYear} agar dapat dikelola mandiri.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      const sourceCourses = courses.filter(c => (c.academicYear || '2025/2026') === '2025/2026');
                      const baseList = sourceCourses.length > 0 ? sourceCourses : courses;
                      const cloned = baseList.map(c => ({
                        ...c,
                        id: `clone-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                        academicYear: selectedCourseYear
                      }));
                      onUpdateCourses([...courses, ...cloned]);
                      setCourseFeedback({
                        type: 'success',
                        message: `Berhasil menyalin ${cloned.length} mata kuliah ke T.A. ${selectedCourseYear}!`
                      });
                      setTimeout(() => setCourseFeedback(null), 4000);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin {courses.length} MK ke {selectedCourseYear}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCourseYear('all')}
                    className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-100/50 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Tampilkan Semua TA
                  </button>
                </div>
              </div>
            )}

            {/* Filtered courses list and batch selection helpers */}
            {(() => {
              const filteredCoursesForTable = courses.filter(c => {
                if (selectedCourseYear !== 'all' && (c.academicYear || '2025/2026') !== selectedCourseYear) {
                  return false;
                }
                if (filterCourseSemester !== 'all' && String(c.semester) !== filterCourseSemester) {
                  return false;
                }
                return true;
              });
              const visibleCourseIds = filteredCoursesForTable.map(c => c.id);
              const isAllVisibleSelected = visibleCourseIds.length > 0 && visibleCourseIds.every(id => selectedCourseIds.includes(id));
              const isSomeVisibleSelected = visibleCourseIds.some(id => selectedCourseIds.includes(id)) && !isAllVisibleSelected;

              return (
                <div className="space-y-3">
                  {/* Batch Action Bar saat ada matakuliah yang dipilih */}
                  {selectedCourseIds.length > 0 && (
                    <div className="p-3 sm:p-4 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-fade-in">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#E4202A] text-white flex items-center justify-center text-sm font-black shadow-xs shrink-0">
                          {selectedCourseIds.length}
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm font-extrabold text-rose-950 dark:text-rose-100">
                            {selectedCourseIds.length} Mata Kuliah Dipilih
                          </p>
                          <p className="text-[11px] text-rose-700 dark:text-rose-300">
                            Pilih hapus massal untuk menghapus semua mata kuliah yang telah ditandai sekaligus
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleToggleSelectAllCourses(visibleCourseIds)}
                          className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                        >
                          {isAllVisibleSelected ? 'Batalkan Semua di Tampilan' : `Pilih Semua (${visibleCourseIds.length})`}
                        </button>

                        <button
                          type="button"
                          onClick={handleClearSelectedCourses}
                          className="px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                        >
                          Batal
                        </button>

                        <button
                          type="button"
                          onClick={() => setIsBatchDeleteModalOpen(true)}
                          className="px-4 py-2 bg-[#E4202A] hover:bg-red-700 text-white text-xs font-extrabold rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-98"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Hapus Terpilih ({selectedCourseIds.length})</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Courses Table */}
                  <div className="border border-slate-300 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 dark:bg-slate-800 font-bold border-b border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                        <tr>
                          {/* Checkbox Select All */}
                          <th className="py-2.5 px-3 w-10 text-center">
                            <div className="flex items-center justify-center">
                              <input
                                type="checkbox"
                                checked={isAllVisibleSelected}
                                ref={(el) => {
                                  if (el) el.indeterminate = isSomeVisibleSelected;
                                }}
                                onChange={() => handleToggleSelectAllCourses(visibleCourseIds)}
                                className="w-4 h-4 rounded border-slate-300 text-[#166534] focus:ring-[#166534] cursor-pointer"
                                title={isAllVisibleSelected ? "Batalkan pilihan semua" : "Pilih semua mata kuliah"}
                              />
                            </div>
                          </th>
                          <th className="py-2.5 px-2 w-10 text-center">No</th>
                          <th className="py-2.5 px-3">Nama Mata Kuliah</th>
                          <th className="py-2.5 px-3 w-28 text-center">Semester</th>
                          <th className="py-2.5 px-3 w-24 text-center">Beban SKS</th>
                          <th className="py-2.5 px-3 w-32">Program Studi</th>
                          <th className="py-2.5 px-3">Opsi Kelas Ditawarkan</th>
                          <th className="py-2.5 px-3 w-28 text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {filteredCoursesForTable.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-8 text-center text-slate-500 font-medium">
                              Tidak ada mata kuliah yang sesuai dengan filter.
                            </td>
                          </tr>
                        ) : (
                          filteredCoursesForTable.map((course, idx) => {
                            const isSelected = selectedCourseIds.includes(course.id);

                            return (
                              <tr
                                key={course.id}
                                className={`transition-colors ${
                                  isSelected
                                    ? 'bg-rose-50/70 dark:bg-rose-950/30'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                }`}
                              >
                                {/* Checkbox Baris */}
                                <td className="py-2.5 px-3 text-center">
                                  <div className="flex items-center justify-center">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => handleToggleSelectCourse(course.id)}
                                      className="w-4 h-4 rounded border-slate-300 text-[#166534] focus:ring-[#166534] cursor-pointer"
                                    />
                                  </div>
                                </td>

                                <td className="py-2.5 px-2 text-center font-bold text-slate-500">
                                  {idx + 1}
                                </td>

                                {/* Nama MK */}
                                <td className="py-2.5 px-3">
                                  <span className="font-medium text-slate-900 dark:text-slate-100">{course.name}</span>
                                </td>

                                {/* Semester */}
                                <td className="py-2.5 px-3 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                    course.semester === 3
                                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                      : course.semester === 5
                                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    Sem {course.semester || 3}
                                  </span>
                                </td>

                                {/* SKS */}
                                <td className="py-2.5 px-3 text-center">
                                  <span className="font-bold text-blue-900 dark:text-blue-300 px-2 py-0.5 bg-blue-50 dark:bg-blue-950/60 rounded border border-blue-200 dark:border-blue-800">
                                    {course.sks} SKS
                                  </span>
                                </td>

                                {/* Prodi */}
                                <td className="py-2.5 px-3">
                                  <span className="capitalize text-slate-700 dark:text-slate-300 font-medium">
                                    {course.prodi}
                                  </span>
                                </td>

                                {/* Opsi Kelas Ditawarkan */}
                                <td className="py-2.5 px-3">
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
                                </td>

                                {/* Actions */}
                                <td className="py-2.5 px-3 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExamAttendanceCourseId(course.id);
                                        setExamAttendanceClass(undefined);
                                        setIsExamAttendanceModalOpen(true);
                                      }}
                                      className="p-1.5 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                                      title="Cetak Presensi Ujian (UTS / UAS) Mata Kuliah Ini"
                                    >
                                      <Printer className="w-3.5 h-3.5" />
                                    </button>

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
                          })
                        )}
                      </tbody>
                    </table>

                    {/* Mobile Card View for Courses (HP-friendly) */}
                    <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      {filteredCoursesForTable.map((course, idx) => {
                        const isSelected = selectedCourseIds.includes(course.id);
                        return (
                          <div
                            key={course.id}
                            className={`p-4 space-y-2.5 transition-colors ${
                              isSelected ? 'bg-rose-50/70 dark:bg-rose-950/30' : ''
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectCourse(course.id)}
                                className="w-4 h-4 mt-0.5 rounded border-slate-300 text-[#166534] focus:ring-[#166534] cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
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
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-1">{course.name}</h4>
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
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
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
                        Admin Fakultas / Superadmin
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
            {/* INTEGRASI JADWAL PENDAFTARAN (DIKELOLA DI MENU PERIODE PENDAFTARAN) */}
            {/* ============================================================== */}
            <div className="bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-white dark:from-emerald-950/30 dark:via-slate-800/80 dark:to-slate-800/80 border-2 border-emerald-400 dark:border-emerald-700 rounded-2xl p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                    <CalendarClock className="w-5 h-5 text-yellow-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                        Pengaturan Jadwal Pendaftaran Semester
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                        Terkoneksi ke Periode Pendaftaran
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                      Jadwal pembukaan dan penutupan pendaftaran kini dikonfigurasi langsung per-semester di menu <strong>Periode Pendaftaran</strong>. Setiap semester dapat memiliki rentang tanggal buka, batas akhir penutupan otomatis, dan pesan notifikasi yang berbeda-beda tanpa duplikasi pengaturan.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('periods')}
                  className="px-4 py-2.5 bg-[#008744] hover:bg-[#007038] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2 shrink-0 self-start sm:self-auto"
                >
                  <Calendar className="w-4 h-4" />
                  <span>Atur Jadwal di Periode Pendaftaran</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* FITUR NOTE: Admin bisa mengedit Note dengan Link Tautan ala Google Form */}
            <div className="bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-slate-50 border-2 border-amber-300 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-700 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                    <StickyNote className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm text-amber-950">
                        Catatan Pengumuman Akademik &amp; Tautan Link (Format Google Form)
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-900 border border-blue-300">
                        🔗 Hyperlink Support
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Sisipkan link tautan (seperti jadwal kuliah Google Sheets, Google Drive, dll) dengan teks tampilan khusus (misal: "Link Jadwal Kuliah: Klik Disini") persis seperti di Google Form.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {noteSavedFeedback && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md flex items-center gap-1 border border-emerald-300">
                      <Check className="w-3.5 h-3.5" />
                      Note Tersimpan!
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleResetNote}
                    className="text-[11px] text-amber-800 hover:text-amber-950 font-semibold underline cursor-pointer"
                  >
                    Kembalikan Default
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveNote}
                    className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-xs font-bold shadow flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan Perubahan Note</span>
                  </button>
                </div>
              </div>

              {/* Rich Note Editor Google Forms */}
              <RichNoteEditor
                value={noteDraft}
                onChange={setNoteDraft}
                label="Isi Teks Catatan / Pengumuman untuk Mahasiswa:"
                placeholder="Ketik catatan pengumuman atau instruksi pendaftaran di sini..."
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <span className="text-[11px] text-slate-500 italic">
                  💡 Tip: Gunakan tombol <strong className="text-blue-600 font-bold">Link 🔗</strong> pada toolbar untuk menyisipkan tautan Google Sheets atau Drive dengan label tampilan khusus.
                </span>
                <button
                  type="button"
                  onClick={handleSaveNote}
                  className="px-5 py-2.5 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all self-end sm:self-auto"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Catatan &amp; Link</span>
                </button>
              </div>

              {/* Pratinjau Tampilan Note Hasil Akhir di Sisi Mahasiswa */}
              <div className="pt-4 border-t border-amber-200">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block mb-2">
                  Pratinjau Tampilan Note di Formulir Mahasiswa:
                </span>
                <div className="bg-white dark:bg-slate-900 border-2 border-amber-300 rounded-xl p-4 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-3 shadow-xs">
                  <StickyNote className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="font-extrabold text-[11px] text-amber-900 dark:text-amber-300 block mb-1">
                      Catatan Pengumuman Akademik:
                    </span>
                    <div className="font-medium">
                      {noteDraft ? renderFormattedNote(noteDraft) : <span className="text-slate-400 italic">Belum ada catatan.</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================== */}
            {/* FITUR ALUR: Editor Alur & Panduan Pendaftaran Mahasiswa */}
            {/* ============================================================== */}
            <div className="bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-white dark:from-emerald-950/30 dark:via-slate-800/80 dark:to-slate-800/80 border-2 border-[#166534] dark:border-emerald-600 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-emerald-200 dark:border-emerald-800/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#166534] text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                    <ListOrdered className="w-5 h-5 text-yellow-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                        Editor Alur &amp; Panduan Pendaftaran Mahasiswa
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-[#166534] border border-emerald-300">
                        Live di Form Mahasiswa
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Kelola 4 langkah prosedur alur pendaftaran, judul panduan, catatan penting, serta kalimat komitmen mahasiswa.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {flowSavedFeedback && (
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-300 animate-fade-in flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" />
                      Alur Tersimpan!
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleResetFlowSettings}
                    className="h-10 px-3.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Bawaan</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveFlowSettings}
                    className="h-10 px-5 bg-[#166534] hover:bg-[#14532D] text-white rounded-xl text-xs font-extrabold shadow-sm flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  >
                    <Save className="w-4 h-4" />
                    <span>Simpan Alur Pendaftaran</span>
                  </button>
                </div>
              </div>

              {/* Judul & Subjudul Banner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Judul Utama Banner Panduan:
                  </label>
                  <input
                    type="text"
                    value={flowTitleDraft}
                    onChange={(e) => setFlowTitleDraft(e.target.value)}
                    placeholder="Contoh: Alur Resmi Pendaftaran Mengulang"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#166534]"
                  />
                </div>
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Subjudul / Lembaga:
                  </label>
                  <input
                    type="text"
                    value={flowSubtitleDraft}
                    onChange={(e) => setFlowSubtitleDraft(e.target.value)}
                    placeholder="Contoh: Fakultas Pertanian — Wajib Dipahami Seluruh Mahasiswa"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-[#166534]"
                  />
                </div>
              </div>

              {/* 4 Langkah Prosedur */}
              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-2.5">
                  4 Langkah Prosedur Alur Resmi:
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {flowStepsDraft.map((st, idx) => (
                    <div 
                      key={idx} 
                      className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border-2 border-emerald-500/30 dark:border-emerald-700/50 shadow-2xs space-y-2.5 flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 pb-2 border-b border-slate-100 dark:border-slate-800">
                          <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-[#166534] text-white">
                            Langkah {idx + 1}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">
                            Point 0{idx + 1}
                          </span>
                        </div>

                        <div className="mt-2.5 space-y-2">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                              Tag / Badge Prosedur:
                            </label>
                            <input
                              type="text"
                              value={st.tag}
                              onChange={(e) => handleUpdateStepDraft(idx, 'tag', e.target.value)}
                              placeholder="Tag (e.g. Online, Cetak A4)"
                              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                              Judul Langkah:
                            </label>
                            <input
                              type="text"
                              value={st.title}
                              onChange={(e) => handleUpdateStepDraft(idx, 'title', e.target.value)}
                              placeholder="Judul Prosedur"
                              className="w-full h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                              Deskripsi Instruksi:
                            </label>
                            <textarea
                              rows={3}
                              value={st.desc}
                              onChange={(e) => handleUpdateStepDraft(idx, 'desc', e.target.value)}
                              placeholder="Deskripsi langkah..."
                              className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 resize-none leading-relaxed"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
                        ✓ Tampil di Card 0{idx + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Catatan Penting & Kalimat Komitmen */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
                {/* Highlight Note */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-emerald-600 shrink-0" />
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Catatan Penting di Bawah 4 Kartu Alur:
                    </label>
                  </div>
                  <textarea
                    rows={3}
                    value={flowHighlightDraft}
                    onChange={(e) => setFlowHighlightDraft(e.target.value)}
                    placeholder="Contoh: Pastikan seluruh isian identitas mahasiswa..."
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#166534] resize-none leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-400">
                    Teks ini tampil pada bilah hijau di bagian bawah banner alur pendaftaran.
                  </p>
                </div>

                {/* Kalimat Pernyataan Komitmen Mahasiswa */}
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                    <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Kalimat Pernyataan &amp; Komitmen Mahasiswa (Point 4):
                    </label>
                  </div>
                  <textarea
                    rows={3}
                    value={flowCommitmentDraft}
                    onChange={(e) => setFlowCommitmentDraft(e.target.value)}
                    placeholder="Contoh: Saya menyatakan data mata kuliah yang saya pilih sudah benar..."
                    className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-[#166534] resize-none leading-relaxed"
                  />
                  <p className="text-[11px] text-slate-400">
                    Kalimat persetujuan yang wajib dicentang mahasiswa sebelum tombol Kirim Pendaftaran aktif.
                  </p>
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

              {/* Semester Switcher Tabs (Dinamis Berdasarkan Semester yang Dibuka / Tersedia) & Preset Bar */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4 bg-white/90 dark:bg-slate-800/90 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-2xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Pilih Semester yang Dibuka:</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {openSemestersForScholarship.map((semKey) => {
                      const periodForSem = (adminSettings.registrationPeriods || []).find(p => String(p.semester) === String(semKey));
                      const isPeriodOpen = periodForSem ? periodForSem.isOpen : true;
                      const restrictedCount = (restrictedRepeatClassesDraft[semKey] || []).length;
                      const isSelected = activeScholarshipSemesterTab === semKey;

                      return (
                        <button
                          key={semKey}
                          type="button"
                          onClick={() => setActiveScholarshipSemesterTab(semKey)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-indigo-700 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                          }`}
                        >
                          <span>Semester {semKey}</span>
                          {periodForSem && (
                            <span 
                              className={`w-2 h-2 rounded-full ${isPeriodOpen ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} 
                              title={isPeriodOpen ? 'Periode Semester Ini Sedang Dibuka' : 'Periode Semester Ini Ditutup'}
                            />
                          )}
                          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                            isSelected ? 'bg-indigo-950/40 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}>
                            {restrictedCount} dilarang
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Preset Actions */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-semibold text-slate-500">Preset Semester Ini:</span>
                  <button
                    type="button"
                    onClick={() => handleApplyScholarshipPreset('standard')}
                    className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold rounded border border-slate-300 dark:border-slate-700 cursor-pointer shadow-2xs"
                    title="Larang 'Kelas Beasiswa' pada semester ini"
                  >
                    Preset Standar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyScholarshipPreset('all-beasiswa')}
                    className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-bold rounded border border-slate-300 dark:border-slate-700 cursor-pointer shadow-2xs"
                    title="Larang 'Kelas Beasiswa' di semester ini"
                  >
                    Semua 'Kelas Beasiswa'
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyScholarshipPreset('clear')}
                    className="px-2 py-1 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-800 dark:text-rose-300 text-[10px] font-bold rounded border border-rose-200 dark:border-rose-800 cursor-pointer shadow-2xs"
                    title="Bebaskan semua kelas (Semua boleh diambil)"
                  >
                    Izinkan Semua Kelas
                  </button>
                </div>
              </div>

              {/* Konten Semester Aktif */}
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-indigo-200 dark:border-indigo-800 p-4 sm:p-5 shadow-2xs space-y-6">
                
                {/* BAGIAN 1: ATURAN STANDAR / BAWAAN KELAS SEMESTER INI */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                        <Layers className="w-4 h-4 text-indigo-600" />
                        <span>1. Status Opsi Kelas Bawaan Semester {activeScholarshipSemesterTab}:</span>
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Klik kartu kelas di bawah untuk mengubah status standar kelas (Boleh vs Dilarang Beasiswa) pada Semester {activeScholarshipSemesterTab}.
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-semibold text-indigo-900 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
                        Terlarang Mengulang: <strong>{(restrictedRepeatClassesDraft[activeScholarshipSemesterTab] || []).length} Kelas</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleApplySemesterDefaultsToAllCourses(activeScholarshipSemesterTab)}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer flex items-center gap-1"
                        title="Terapkan aturan standar kelas ini ke seluruh mata kuliah di semester ini"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Terapkan Standar ke Semua MK</span>
                      </button>
                    </div>
                  </div>

                  {/* Grid Kelas Standar Semester */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {adminSettings.classOptions.map((className) => {
                      const isRestricted = (restrictedRepeatClassesDraft[activeScholarshipSemesterTab] || []).includes(className);

                      return (
                        <div
                          key={className}
                          onClick={() => handleToggleClassRestriction(activeScholarshipSemesterTab, className)}
                          className={`p-3 rounded-xl border-2 transition-all cursor-pointer select-none flex flex-col justify-between ${
                            isRestricted
                              ? 'bg-rose-50/90 dark:bg-rose-950/40 border-rose-400 dark:border-rose-600 shadow-xs ring-1 ring-rose-400/30'
                              : 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700 hover:border-emerald-400 hover:bg-emerald-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-xs text-slate-900 dark:text-white">{className}</span>
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
                              <span className="text-rose-800 dark:text-rose-300 font-semibold flex items-center gap-1">
                                <span>🚫 Kelas Beasiswa (Tidak Boleh Mengulang)</span>
                              </span>
                            ) : (
                              <span className="text-emerald-800 dark:text-emerald-300 font-medium">
                                ✓ Kelas Reguler (Dapat dipilih mengulang)
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Form Tambah Nama Kelas Khusus Beasiswa untuk Semester Ini */}
                  <div className="pt-2 flex flex-col sm:flex-row gap-2 items-center">
                    <div className="flex-1 w-full flex gap-2">
                      <input
                        type="text"
                        value={newCustomScholarshipClass}
                        onChange={(e) => setNewCustomScholarshipClass(e.target.value)}
                        placeholder={`Ketik nama kelas beasiswa baru khusus Semester ${activeScholarshipSemesterTab} (contoh: Kelas Beasiswa Kemitraan, Kelas D Khusus)...`}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                  <div className="pt-2">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
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
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* BAGIAN 2: PENGATURAN KELAS MANDIRI TIAP MATA KULIAH */}
                <div className="pt-5 border-t-2 border-indigo-100 dark:border-indigo-900/60 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-emerald-600" />
                          <span>2. Opsi Kelas &amp; Status Beasiswa Mandiri Tiap Mata Kuliah (Semester {activeScholarshipSemesterTab})</span>
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                          {coursesInSelectedScholarshipSemester.length} Mata Kuliah Terdaftar
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Kelas untuk tiap mata kuliah dapat disesuaikan secara berbeda (misal: MK A hanya buka Kelas A &amp; B, sedangkan MK B buka Kelas C &amp; D, dengan status beasiswa yang berbeda).
                      </p>
                    </div>

                    {/* Search box mata kuliah */}
                    <div className="relative w-full sm:w-64 shrink-0">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={scholarshipCourseSearch}
                        onChange={(e) => setScholarshipCourseSearch(e.target.value)}
                        placeholder="Cari mata kuliah..."
                        className="w-full h-8 pl-8 pr-3 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Daftar Kartu Mata Kuliah & Kelas Mandiri */}
                  {coursesInSelectedScholarshipSemester.length === 0 ? (
                    <div className="p-6 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
                      <BookOpen className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
                      <p className="text-xs text-slate-500 font-medium">
                        Tidak ada mata kuliah yang cocok untuk Semester {activeScholarshipSemesterTab}.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {coursesInSelectedScholarshipSemester.map((course) => {
                        const defaultClasses = adminSettings.classOptions || DEFAULT_CLASSES;
                        const available = (course.availableClasses && course.availableClasses.length > 0)
                          ? course.availableClasses
                          : defaultClasses;
                        
                        const defaultSemesterRestricted = restrictedRepeatClassesDraft[String(course.semester)] || [];
                        const restrictedList = Array.isArray(course.restrictedClasses)
                          ? course.restrictedClasses
                          : defaultSemesterRestricted;

                        const unaddedClasses = adminSettings.classOptions.filter(cls => !available.includes(cls));

                        return (
                          <div
                            key={course.id}
                            className="p-3.5 sm:p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all space-y-3"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                                  {course.name}
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                                  {course.sks} SKS
                                </span>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 capitalize">
                                  {course.prodi}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  ({available.length} kelas dibuka, {available.filter(c => restrictedList.includes(c)).length} beasiswa)
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleResetCourseToSemesterDefaults(course.id)}
                                  className="px-2 py-1 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 text-[10px] font-bold rounded border border-slate-300 dark:border-slate-700 cursor-pointer shadow-2xs flex items-center gap-1"
                                  title="Kembalikan kelas mata kuliah ini ke standar semester"
                                >
                                  <RotateCcw className="w-3 h-3 text-slate-500" />
                                  <span>Reset ke Standar</span>
                                </button>
                              </div>
                            </div>

                            {/* Opsi Kelas Khusus Mata Kuliah Ini */}
                            <div>
                              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                                <span>Kelas yang Dibuka untuk MK ini (Klik kartu kelas untuk ubah Boleh / Beasiswa):</span>
                              </div>

                              <div className="flex flex-wrap gap-2 items-center">
                                {available.map((cls) => {
                                  const isRestricted = restrictedList.includes(cls);

                                  return (
                                    <div
                                      key={cls}
                                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all select-none flex items-center gap-2 ${
                                        isRestricted
                                          ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800 shadow-2xs'
                                          : 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800 shadow-2xs'
                                      }`}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => handleToggleCourseRestriction(course, cls)}
                                        className="cursor-pointer flex items-center gap-1.5 hover:opacity-80"
                                        title={isRestricted ? "Klik untuk mengizinkan kelas ini diambil mengulang" : "Klik untuk melarang/menandai sebagai kelas beasiswa"}
                                      >
                                        {isRestricted ? (
                                          <>
                                            <Ban className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                                            <span>{cls}</span>
                                            <span className="text-[10px] font-extrabold uppercase px-1 py-0.2 rounded bg-rose-200 dark:bg-rose-900 text-rose-950 dark:text-rose-200">
                                              Dilarang (Beasiswa)
                                            </span>
                                          </>
                                        ) : (
                                          <>
                                            <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                            <span>{cls}</span>
                                            <span className="text-[10px] font-extrabold uppercase px-1 py-0.2 rounded bg-emerald-200 dark:bg-emerald-900 text-emerald-950 dark:text-emerald-200">
                                              Boleh Mengulang
                                            </span>
                                          </>
                                        )}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleRemoveClassFromCourse(course, cls)}
                                        className="w-4 h-4 rounded-full bg-black/10 dark:bg-white/10 hover:bg-rose-600 hover:text-white flex items-center justify-center text-[10px] cursor-pointer ml-0.5 transition-colors"
                                        title={`Hapus kelas ${cls} dari mata kuliah ini`}
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  );
                                })}

                                {/* Dropdown Tambah Kelas Opsi Lain */}
                                {unaddedClasses.length > 0 && (
                                  <div className="flex items-center gap-1">
                                    <select
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          handleAddClassToCourse(course, e.target.value);
                                          e.target.value = '';
                                        }
                                      }}
                                      defaultValue=""
                                      className="h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                                    >
                                      <option value="" disabled>+ Tambah Kelas Opsi...</option>
                                      {unaddedClasses.map(cls => (
                                        <option key={cls} value={cls}>+ {cls}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

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
            {/* INTEGRASI KUOTA SKS (DIKELOLA DI MENU PERIODE PENDAFTARAN) */}
            {/* ============================================================== */}
            <div className="bg-gradient-to-br from-indigo-50/80 via-blue-50/40 to-white dark:from-indigo-950/30 dark:via-slate-800/80 dark:to-slate-800/80 border-2 border-indigo-300 dark:border-indigo-700 rounded-2xl p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                    <Gauge className="w-5 h-5 text-indigo-100" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                        Pengaturan Kuota &amp; Batas Maksimal SKS
                      </h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-900 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700">
                        Terkoneksi ke Periode Pendaftaran
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                      Batas maksimal SKS dan kuota khusus per angkatan kini dikonfigurasi secara mandiri di menu <strong>Periode Pendaftaran</strong> per masing-masing semester (misal: Semester 1, 3, 5 dapat memiliki batasan SKS yang berbeda sesuai beban kurikulum).
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('periods')}
                  className="px-4 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-2 shrink-0 self-start sm:self-auto"
                >
                  <Sliders className="w-4 h-4" />
                  <span>Atur Kuota SKS di Periode Pendaftaran</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

          </div>
        )}

        {/* ============================================================== */}
        {/* TAB PERIODE PENDAFTARAN: BUKA PERIODE & RECORD JADWAL SEMESTER */}
        {/* ============================================================== */}
        {activeTab === 'periods' && (
          <RegistrationPeriodsManager
            adminSettings={adminSettings}
            courses={courses}
            registrations={registrations}
            onUpdateSettings={onUpdateSettings}
            onUpdateCourses={onUpdateCourses}
            currentUser={currentUser}
            onOpenCourseTab={() => setActiveTab('courses')}
          />
        )}

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

            {/* Quick Stats per Semester - Executive Monitor Cards (Dinamis Berdasarkan Data yang Ada di Sistem) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Semua Pendaftar */}
              <div 
                onClick={() => setFilterRegSemester('all')}
                className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-md ${
                  filterRegSemester === 'all'
                    ? 'border-[#008744] ring-2 ring-[#008744]/20'
                    : 'border-slate-200/90 dark:border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Total Mahasiswa
                    </span>
                    <span className="text-[9px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.2 rounded">
                      SEMUA
                    </span>
                  </div>
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
                    {registrations.reduce((s, r) => s + (r.totalSks || 0), 0)} Total SKS Terambil
                  </div>
                </div>
              </div>

              {/* Dynamic Semester Cards */}
              {rekapSemesterStats.map((stat) => {
                const isFilterActive = filterRegSemester === stat.semester;

                return (
                  <div 
                    key={stat.semester}
                    onClick={() => setFilterRegSemester(isFilterActive ? 'all' : stat.semester)}
                    className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-md ${
                      isFilterActive
                        ? `${stat.theme.border} ring-2 ring-[#008744]/30 shadow-sm`
                        : `${stat.theme.border}`
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-bold uppercase tracking-wider ${stat.theme.textTitle}`}>
                          Semester {stat.semester}
                        </span>
                        <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${stat.theme.badgeBg}`}>
                          {stat.theme.badgeText}
                        </span>
                        {stat.period && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                            stat.isOpen 
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}>
                            {stat.isOpen ? 'BUKA' : 'TUTUP'}
                          </span>
                        )}
                      </div>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${stat.theme.bgIcon}`}>
                        <span>{stat.theme.icon}</span>
                      </div>
                    </div>
                    <div>
                      <div className={`text-3xl font-black tracking-tight ${stat.theme.textNumber}`}>
                        {stat.count}
                        <span className="text-xs font-semibold opacity-70 ml-1.5">Mahasiswa</span>
                      </div>
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                        {stat.totalSks} Beban SKS Semester {stat.semester}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Card Lintas / Gabungan jika ada pendaftar lintas semester */}
              {lintasRegistrations.length > 0 && (
                <div 
                  onClick={() => setFilterRegSemester(filterRegSemester === 'gabungan' ? 'all' : 'gabungan')}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-md ${
                    filterRegSemester === 'gabungan'
                      ? 'border-amber-400 ring-2 ring-amber-400/30 shadow-sm'
                      : 'border-amber-200/80 dark:border-amber-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                        Lintas / Gabungan
                      </span>
                      <span className="text-[9px] font-black bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 rounded">
                        CAMPUR
                      </span>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-amber-100/60 dark:bg-amber-950/80 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold">
                      <span>📑</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-3xl font-black text-amber-900 dark:text-amber-300 tracking-tight">
                      {lintasRegistrations.length}
                      <span className="text-xs font-semibold text-amber-600/70 ml-1.5">Mahasiswa</span>
                    </div>
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {lintasRegistrations.reduce((s, r) => s + (r.totalSks || 0), 0)} Beban SKS Gabungan
                    </div>
                  </div>
                </div>
              )}

              {/* Card Akumulasi SKS & Keuangan */}
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
                    {registrations.reduce((s, r) => s + (r.totalSks || 0), 0)}
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
                    placeholder="Cari data pendaftar (nama mahasiswa, NIM, angkatan, kelas)..."
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
                    onClick={() => {
                      setExamAttendanceCourseId(undefined);
                      setExamAttendanceClass(undefined);
                      setIsExamAttendanceModalOpen(true);
                    }}
                    title="Cetak Presensi Ujian (UTS / UAS) Ukuran Standar A4"
                    className="flex items-center gap-2 h-11 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0 active:scale-95"
                  >
                    <Printer className="w-4 h-4 text-white" />
                    <span>Presensi Ujian (UTS/UAS)</span>
                  </button>

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

                  {availableRegSemesters.map((sem: string) => {
                    const count = registrations.filter(r => 
                      r.targetSemester === `Semester ${sem}` || 
                      r.targetSemester === sem || 
                      r.selectedCourses?.some(c => String(c.semester) === String(sem))
                    ).length;
                    return (
                      <button
                        key={sem}
                        type="button"
                        onClick={() => setFilterRegSemester(sem)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          filterRegSemester === sem
                            ? 'bg-[#008744] text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        Sem {sem} ({count})
                      </button>
                    );
                  })}

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
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${getSemesterBadgeStyle(r.targetSemester)}`}>
                                {r.targetSemester || (r.selectedCourses?.[0]?.semester ? `Semester ${r.selectedCourses[0].semester}` : 'Semester 1')}
                              </span>
                              {r.status === 'approved' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                                  ✓ Disetujui
                                </span>
                              )}
                              {r.status === 'rejected' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300">
                                  ✗ Ditolak
                                </span>
                              )}
                              {(!r.status || r.status === 'pending') && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                                  ⏳ Menunggu
                                </span>
                              )}
                            </div>
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
                                onClick={() => handleStartEditRegistration(r)}
                                className="p-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/60 rounded-xl cursor-pointer border border-amber-300 dark:border-amber-700 transition-colors shadow-2xs"
                                title="Edit Data Mahasiswa & Ganti Kelas Tempat Mengulang"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setStatusModalReg(r);
                                  setSelectedNewStatus(r.status || 'approved');
                                  setRejectionReasonInput(r.rejectionReason || '');
                                }}
                                className="p-2 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded-xl cursor-pointer border border-blue-200 dark:border-blue-800 transition-colors shadow-2xs"
                                title="Verifikasi / Validasi Status Berkas Mahasiswa"
                              >
                                <ShieldCheck className="w-4 h-4" />
                              </button>
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
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-blue-900">{r.id}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${getSemesterBadgeStyle(r.targetSemester)}`}>
                              {r.targetSemester || (r.selectedCourses?.[0]?.semester ? `Semester ${r.selectedCourses[0].semester}` : 'Semester 1')}
                            </span>
                            {r.status === 'approved' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                ✓ Disetujui
                              </span>
                            )}
                            {r.status === 'rejected' && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                ✗ Ditolak
                              </span>
                            )}
                            {(!r.status || r.status === 'pending') && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                ⏳ Menunggu
                              </span>
                            )}
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

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleStartEditRegistration(r)}
                            className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/60 rounded-lg border border-amber-300 dark:border-amber-700 cursor-pointer"
                            title="Edit Data & Ganti Kelas"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setStatusModalReg(r);
                              setSelectedNewStatus(r.status || 'approved');
                              setRejectionReasonInput(r.rejectionReason || '');
                            }}
                            className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-lg border border-blue-200 cursor-pointer"
                            title="Verifikasi Status"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </button>
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
        {/* TAB 4: MANAJEMEN KREDENSIAL USER (TERPISAH DARI ADMIN FAKULTAS - KHUSUS SUPERADMIN) */}
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
                Tab Kredensial dan Manajemen Akun terpisah dari operasional Admin Fakultas. Hanya Superadmin Fakultas yang berhak mengelola akun dan kata sandi pengelola.
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
                        Manajemen Akun & Kredensial Pengelola (Terpisah dari Admin Fakultas)
                        <span className="text-[10px] bg-amber-100 text-amber-900 font-black px-2 py-0.5 rounded-full border border-amber-300 uppercase">
                          Akses Full Superadmin
                        </span>
                      </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Kelola username, password, peran hak akses, dan status keaktifan akun staf Admin Fakultas, Keuangan, dan Kaprodi.
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
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">
                    Daftar Pengguna Terdaftar ({managedUsers.length} Akun)
                  </span>
                  <span className="text-xs text-slate-500 font-medium ml-2">
                    Aktif: {managedUsers.filter(u => u.isActive).length} • Nonaktif: {managedUsers.filter(u => !u.isActive).length}
                  </span>
                </div>

                {/* Master Peek Passwords Toggle */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAllPasswords(prev => !prev)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border shadow-2xs ${
                      showAllPasswords
                        ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                    title="Tampilkan atau sembunyikan kata sandi seluruh akun staf"
                  >
                    {showAllPasswords ? <EyeOff className="w-3.5 h-3.5 text-amber-700" /> : <Eye className="w-3.5 h-3.5 text-slate-600" />}
                    <span>{showAllPasswords ? 'Tutup Semua Password' : 'Intip Semua Password'}</span>
                  </button>
                </div>
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 font-bold border-b border-slate-200 text-slate-700">
                    <tr>
                      <th className="py-3 px-4">Username &amp; Nama</th>
                      <th className="py-3 px-4">Kata Sandi (Kredensial)</th>
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

                          {/* Kolom Kata Sandi dengan Tombol Intip & Salin */}
                          <td className="py-3 px-4">
                            {(() => {
                              const isRevealed = showAllPasswords || revealedPasswords[u.id];
                              return (
                                <div className="flex items-center gap-1.5">
                                  <div className={`px-2.5 py-1 rounded-lg font-mono text-xs transition-all border select-all ${
                                    isRevealed
                                      ? 'bg-amber-50 text-amber-950 border-amber-300 font-bold shadow-2xs'
                                      : 'bg-slate-100 text-slate-400 border-slate-200'
                                  }`}>
                                    {isRevealed ? u.password : '••••••••••••'}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => toggleRevealPassword(u.id)}
                                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                      isRevealed
                                        ? 'bg-amber-100 text-amber-800 border-amber-300 hover:bg-amber-200'
                                        : 'bg-white text-slate-500 border-slate-200 hover:text-slate-900 hover:bg-slate-100'
                                    }`}
                                    title={isRevealed ? 'Sembunyikan password' : 'Intip kata sandi akun ini'}
                                  >
                                    {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyCredentials(u)}
                                    className="p-1.5 bg-white hover:bg-slate-100 text-slate-500 hover:text-[#009A44] rounded-lg border border-slate-200 transition-colors cursor-pointer"
                                    title="Salin Username & Password"
                                  >
                                    {copiedUserId === u.id ? (
                                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              );
                            })()}
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
                              onClick={async () => {
                                await updateManagedUser(u.id, { isActive: !u.isActive });
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

                      {/* Box Kredensial Password dengan Intip & Salin */}
                      {(() => {
                        const isRevealed = showAllPasswords || revealedPasswords[u.id];
                        return (
                          <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-[10px] uppercase font-bold text-slate-400">Password:</span>
                              <span className={`font-mono text-xs px-2 py-0.5 rounded ${
                                isRevealed
                                  ? 'bg-amber-100 text-amber-900 font-bold border border-amber-300 select-all'
                                  : 'text-slate-400 font-medium'
                              }`}>
                                {isRevealed ? u.password : '••••••••••••'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleRevealPassword(u.id)}
                                className={`px-2 py-1 rounded-lg text-xs font-bold border flex items-center gap-1 cursor-pointer transition-colors ${
                                  isRevealed
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                <span>{isRevealed ? 'Tutup' : 'Intip'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCopyCredentials(u)}
                                className="p-1.5 bg-white text-slate-600 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50"
                                title="Salin Kredensial"
                              >
                                {copiedUserId === u.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        );
                      })()}

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
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setUserModalFeedback(null);
                      try {
                        const res = await addManagedUser({
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
                      } catch {
                        setUserModalFeedback('Gagal memproses akun. Coba lagi.');
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
                        placeholder="Contoh: admin_fakultas / kasir_fp"
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
                        <option value="baak">Admin Fakultas / Verifikator Akademik</option>
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
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setPasswordModalFeedback(null);
                      if (!newPasswordReset.trim()) {
                        setPasswordModalFeedback('Password baru tidak boleh kosong.');
                        return;
                      }
                      const res = await updateManagedUser(targetUserForPassword.id, { password: newPasswordReset.trim() });
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
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setEditUserFeedback(null);
                      try {
                        const res = await updateManagedUser(targetUserForEdit.id, {
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
                      } catch {
                        setEditUserFeedback('Gagal memproses perubahan akun.');
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
                        <option value="baak">Admin Fakultas / Verifikator Akademik</option>
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
                  disabled={isDeletingCourse}
                  onClick={() => setCourseToDelete(null)}
                  className="w-1/2 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isDeletingCourse}
                  onClick={handleConfirmDeleteCourse}
                  className="w-1/2 py-2.5 px-4 rounded-xl bg-[#E4202A] hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md shadow-red-500/20 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isDeletingCourse ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Ya, Hapus</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 2B: KONFIRMASI HAPUS BANYAK MATA KULIAH (BATCH DELETE) */}
      {/* ============================================================== */}
      {isBatchDeleteModalOpen && selectedCourseIds.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-rose-100 text-[#E4202A] flex items-center justify-center mx-auto mb-4 border border-rose-200 shadow-xs">
                <Trash2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">
                Hapus {selectedCourseIds.length} Mata Kuliah Terpilih?
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
                Anda akan menghapus <strong>{selectedCourseIds.length} mata kuliah</strong> dari katalog kurikulum secara permanen.
              </p>

              {/* Rincian Mata Kuliah yang Ditandai untuk Dihapus */}
              <div className="text-left mb-3">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 px-1">
                  <span>Daftar Mata Kuliah ({selectedCourseIds.length}):</span>
                  <span>Semester / SKS</span>
                </div>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-2 space-y-1.5 divide-y divide-slate-100 dark:divide-slate-700/60">
                  {courses
                    .filter(c => selectedCourseIds.includes(c.id))
                    .map((course, i) => (
                      <div
                        key={course.id}
                        className="flex items-center justify-between pt-1.5 first:pt-0 text-xs"
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-slate-900 dark:text-slate-100 truncate">
                            <span className="font-mono text-slate-400 text-[10px] mr-1.5">#{i + 1}</span>
                            {course.name}
                          </p>
                          <span className="text-[10px] text-slate-500 capitalize">{course.prodi}</span>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Sem {course.semester}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 font-mono">
                            {course.sks} SKS
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-[11px] text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-left mb-5">
                ⚠️ <strong>Perhatian:</strong> Mata kuliah yang dihapus tidak akan dapat dipilih lagi oleh mahasiswa dalam portal pendaftaran mengulang.
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={isDeletingCourse}
                  onClick={() => setIsBatchDeleteModalOpen(false)}
                  className="w-1/2 py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isDeletingCourse}
                  onClick={handleConfirmBatchDeleteCourses}
                  className="w-1/2 py-2.5 px-4 rounded-xl bg-[#E4202A] hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md shadow-red-500/20 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isDeletingCourse ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Ya, Hapus {selectedCourseIds.length} MK</span>
                    </>
                  )}
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
      {/* MODAL 3B: KONFIRMASI KOSONGKAN SELURUH MATA KULIAH */}
      {/* ============================================================== */}
      {isClearAllCoursesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-950/60 text-[#E4202A] dark:text-rose-400 flex items-center justify-center mx-auto mb-4 border border-rose-200 dark:border-rose-800 shadow-xs">
                <Trash2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">
                Kosongkan Seluruh Katalog Mata Kuliah?
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                Anda akan menghapus seluruh <strong>{courses.length} mata kuliah</strong> di semua tahun ajaran dan semester secara permanen dari sistem &amp; Cloud.
              </p>
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 rounded-xl text-[11px] text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-left mb-5">
                ⚠️ <strong>Peringatan:</strong> Seluruh mata kuliah akan dikosongkan total dan tidak akan muncul kembali sampai Anda menambahkan atau mengimpor mata kuliah baru.
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={isClearingAllCourses}
                  onClick={() => setIsClearAllCoursesModalOpen(false)}
                  className="w-1/2 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isClearingAllCourses}
                  onClick={handleConfirmClearAllCourses}
                  className="w-1/2 py-2.5 px-4 rounded-xl bg-[#E4202A] hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isClearingAllCourses ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mengosongkan...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Ya, Kosongkan Semua</span>
                    </>
                  )}
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
      {/* MODAL 4B: VERIFIKASI / VALIDASI STATUS BERKAS PENDAFTARAN */}
      {/* ============================================================== */}
      {statusModalReg && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 dark:border-slate-800">
            {/* Header */}
            <div className="bg-[#008744] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">Validasi &amp; Verifikasi Berkas</h3>
                  <p className="text-[11px] text-emerald-100">Fakultas Pertanian — Pengesahan Pendaftaran Mengulang</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStatusModalReg(null)}
                className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/15 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-blue-900 dark:text-blue-300">{statusModalReg.id}</span>
                  <span className="font-semibold text-slate-500">{statusModalReg.targetSemester}</span>
                </div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  {statusModalReg.nama} <span className="font-mono text-slate-500 font-normal">({statusModalReg.nim})</span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Angkatan {statusModalReg.angkatan} • {statusModalReg.selectedCourses.length} Mata Kuliah ({statusModalReg.totalSks} SKS)
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Tentukan Keputusan Status Berkas:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedNewStatus('approved')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      selectedNewStatus === 'approved'
                        ? 'border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                    <span>Setujui (Sah)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedNewStatus('pending')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      selectedNewStatus === 'pending'
                        ? 'border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <Clock className="w-5 h-5 text-amber-600" />
                    <span>Menunggu</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedNewStatus('rejected')}
                    className={`p-3 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      selectedNewStatus === 'rejected'
                        ? 'border-2 border-rose-500 bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 font-bold'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <X className="w-5 h-5 text-rose-600" />
                    <span>Tolak</span>
                  </button>
                </div>
              </div>

              {selectedNewStatus === 'rejected' && (
                <div className="space-y-1.5 animate-fade-in">
                  <label className="block text-xs font-bold text-rose-700 dark:text-rose-400">
                    Alasan Penolakan (Akan tampil pada Cek Status Mahasiswa):
                  </label>
                  <textarea
                    rows={3}
                    value={rejectionReasonInput}
                    onChange={(e) => setRejectionReasonInput(e.target.value)}
                    placeholder="Contoh: Berkas fisik cetak KRS belum diserahkan ke loket, atau bukti transfer biaya mengulang belum valid..."
                    className="w-full p-2.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/20 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <p className="text-[10px] text-slate-500">
                    Mahasiswa yang ditolak diizinkan melakukan pendaftaran ulang perbaikan melalui formulir.
                  </p>
                </div>
              )}

              {selectedNewStatus === 'approved' && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-[11px] text-emerald-900 dark:text-emerald-300">
                  Status ini menandakan berkas cetak fisik telah diterima di loket Administrasi Fakultas dan disahkan oleh pengelola.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStatusModalReg(null)}
                className="px-4 py-2 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-600 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onUpdateRegistrationStatus) {
                    onUpdateRegistrationStatus(statusModalReg.id, selectedNewStatus, rejectionReasonInput);
                  }
                  setStatusModalReg(null);
                }}
                className="px-5 py-2 bg-[#008744] hover:bg-[#00702F] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>Simpan Keputusan Status</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: EDIT DATA PENDAFTARAN & GANTI KELAS TEMPAT MENGULANG */}
      {/* ============================================================== */}
      {registrationBeingEdited && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Header */}
            <div className="bg-[#008744] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Edit3 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">Edit Data Pendaftaran Mahasiswa</h3>
                  <p className="text-xs text-emerald-100">
                    Ubah biodata, ganti kelas mengulang, atau sesuaikan mata kuliah terpilih
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRegistrationBeingEdited(null)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/15 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveRegistrationEdit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 space-y-6 overflow-y-auto text-xs">
                {/* Metadata Tag */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">ID Registrasi:</span>
                    <span className="font-mono font-bold text-sm text-blue-900 dark:text-blue-300">
                      {registrationBeingEdited.id}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Tanggal Submit:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {registrationBeingEdited.registrationDate}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">Tahun Ajaran:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {registrationBeingEdited.academicYear || adminSettings.activeAcademicYear || '2025/2026'}
                    </span>
                  </div>
                </div>

                {/* Feedback Alert if any */}
                {editRegFeedback && (
                  <div
                    className={`p-3.5 rounded-xl border flex items-center gap-2.5 ${
                      editRegFeedback.type === 'error'
                        ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
                        : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span className="text-xs font-semibold">{editRegFeedback.message}</span>
                  </div>
                )}

                {/* Section 1: Biodata Mahasiswa */}
                <div className="space-y-3">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2 pb-1 border-b border-slate-200 dark:border-slate-800">
                    <Users className="w-4 h-4 text-[#008744]" />
                    <span>Biodata &amp; Informasi Mahasiswa</span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Nama Lengkap Mahasiswa *
                      </label>
                      <input
                        type="text"
                        required
                        value={editRegNama}
                        onChange={(e) => setEditRegNama(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-[#008744] focus:outline-none"
                        placeholder="Contoh: Budi Santoso"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        NIM (Nomor Induk Mahasiswa) *
                      </label>
                      <input
                        type="text"
                        required
                        value={editRegNim}
                        onChange={(e) => setEditRegNim(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-[#008744] focus:outline-none"
                        placeholder="Contoh: 21/45678/SP/01234"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Angkatan Masuk
                      </label>
                      <select
                        value={editRegAngkatan}
                        onChange={(e) => setEditRegAngkatan(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-[#008744] focus:outline-none"
                      >
                        {ANGKATAN_OPTIONS.map((angk) => (
                          <option key={angk} value={angk}>
                            Angkatan {angk}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Kelas Asal Mahasiswa
                      </label>
                      <input
                        type="text"
                        value={editRegKelasAsal}
                        onChange={(e) => setEditRegKelasAsal(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-[#008744] focus:outline-none"
                        placeholder="Contoh: Agroteknologi A / Agribisnis B"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Nomor WhatsApp / HP
                      </label>
                      <input
                        type="text"
                        value={editRegNoWa}
                        onChange={(e) => setEditRegNoWa(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-[#008744] focus:outline-none"
                        placeholder="08123456789"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Alamat Email Mahasiswa
                      </label>
                      <input
                        type="email"
                        value={editRegEmail}
                        onChange={(e) => setEditRegEmail(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-[#008744] focus:outline-none"
                        placeholder="nama@instiperjogja.ac.id"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Portal Semester Tujuan
                      </label>
                      <select
                        value={editRegTargetSemester}
                        onChange={(e) => setEditRegTargetSemester(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-[#008744] focus:outline-none"
                      >
                        {availableRegSemesters.map(sem => (
                          <option key={sem} value={`Semester ${sem}`}>Semester {sem}</option>
                        ))}
                        <option value="Semester Gabungan">Semester Gabungan / Lintas</option>
                        {editRegTargetSemester && 
                          !availableRegSemesters.some(s => `Semester ${s}` === editRegTargetSemester) && 
                          editRegTargetSemester !== 'Semester Gabungan' && (
                            <option value={editRegTargetSemester}>{editRegTargetSemester}</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Status Verifikasi Berkas
                      </label>
                      <select
                        value={editRegStatus}
                        onChange={(e) => setEditRegStatus(e.target.value as RegistrationStatus)}
                        className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-[#008744] focus:outline-none"
                      >
                        <option value="approved">✅ Disetujui (Approved)</option>
                        <option value="pending">⏳ Menunggu Verifikasi (Pending)</option>
                        <option value="rejected">❌ Ditolak / Perlu Perbaikan (Rejected)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 2: Mata Kuliah & Pilihan Kelas Mengulang */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pb-1 border-b border-slate-200 dark:border-slate-800">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#008744]" />
                      <span>Mata Kuliah &amp; Kelas Tempat Mengulang</span>
                    </h4>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                      {editRegSelectedCourses.length} mata kuliah dipilih
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Pilih dropdown kelas pada tiap matakuliah untuk memindahkan mahasiswa ke kelas mengulang yang diminta. Anda juga dapat menambah atau menghapus matakuliah.
                  </p>

                  {/* Course Items List */}
                  <div className="space-y-2.5">
                    {editRegSelectedCourses.length === 0 ? (
                      <div className="p-6 text-center rounded-xl border border-dashed border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20">
                        Belum ada mata kuliah yang dipilih. Silakan tambahkan mata kuliah di bawah.
                      </div>
                    ) : (
                      editRegSelectedCourses.map((c, idx) => {
                        const matchedCourse = courses.find(item => item.id === c.courseId);
                        const courseClasses = matchedCourse?.availableClasses && matchedCourse.availableClasses.length > 0
                          ? matchedCourse.availableClasses
                          : adminSettings.classOptions;

                        return (
                          <div
                            key={`${c.courseId}-${idx}`}
                            className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 dark:text-white text-xs">
                                  {c.name}
                                </span>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                                  {c.sks} SKS
                                </span>
                                {c.semester && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                    Sem. {c.semester}
                                  </span>
                                )}
                                {c.prodi && (
                                  <span className="text-[10px] text-slate-500 uppercase">
                                    {c.prodi}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Class Selector Dropdown & Remove Button */}
                            <div className="flex items-center gap-2 shrink-0">
                              <div className="flex items-center gap-1.5">
                                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                  Kelas Mengulang:
                                </label>
                                <select
                                  value={c.selectedClass || courseClasses[0] || 'Kelas A'}
                                  onChange={(e) => handleChangeCourseClassInEdit(idx, e.target.value)}
                                  className="px-2.5 py-1.5 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-slate-900 text-blue-900 dark:text-blue-300 font-bold text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                >
                                  {courseClasses.map((cls) => {
                                    const isRestricted = c.semester
                                      ? isClassRestrictedForRepeat(cls, c.semester, adminSettings)
                                      : false;
                                    return (
                                      <option key={cls} value={cls}>
                                        {cls} {isRestricted ? '(Khusus/Beasiswa)' : ''}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveCourseFromEdit(idx)}
                                className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg border border-rose-200 dark:border-rose-800 cursor-pointer transition-colors"
                                title="Hapus mata kuliah ini dari pendaftaran"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add New Course to this Registration */}
                  <div className="pt-2">
                    <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Tambah Mata Kuliah Lain dari Katalog:
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={courseToAddInEdit}
                        onChange={(e) => setCourseToAddInEdit(e.target.value)}
                        className="flex-1 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-[#008744] focus:outline-none"
                      >
                        <option value="">-- Pilih Mata Kuliah untuk Ditambahkan --</option>
                        {courses
                          .filter(c => !editRegSelectedCourses.some(item => item.courseId === c.id))
                          .map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} ({c.sks} SKS, Semester {c.semester}, {c.prodi === 'agroteknologi' ? 'Agrotek' : 'Agribis'})
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={handleAddCourseToRegistrationEdit}
                        disabled={!courseToAddInEdit}
                        className="px-4 py-2.5 bg-[#008744] hover:bg-[#00702F] disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed shrink-0"
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>Tambah</span>
                      </button>
                    </div>
                  </div>

                  {/* Live SKS & Fee Estimate Info Box */}
                  {(() => {
                    const currentTotalSks = editRegSelectedCourses.reduce((sum, c) => sum + (Number(c.sks) || 0), 0);
                    const maxSksAllowed = getMaxSksForBatch(editRegAngkatan, adminSettings);
                    const isOverLimit = currentTotalSks > maxSksAllowed;
                    const isPaidBatch = (adminSettings.paidBatches || []).includes(editRegAngkatan);
                    const costPerSks = adminSettings.costPerSks || 50000;
                    const estFee = (adminSettings.feePerSksEnabled && isPaidBatch) ? currentTotalSks * costPerSks : 0;

                    return (
                      <div className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                        isOverLimit
                          ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                          : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div>
                            <span className="text-[11px] block font-semibold">Total Beban SKS:</span>
                            <div className="flex items-center gap-1.5">
                              <span className="text-base font-black font-mono">
                                {currentTotalSks} SKS
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                (Batas Angkatan {editRegAngkatan}: {maxSksAllowed} SKS)
                              </span>
                            </div>
                          </div>
                        </div>

                        <div>
                          <span className="text-[11px] block font-semibold">Estimasi Biaya SKS:</span>
                          <span className="font-black text-sm font-mono">
                            {adminSettings.feePerSksEnabled && isPaidBatch
                              ? `Rp ${estFee.toLocaleString('id-ID')}`
                              : 'Bebas Biaya (SPP Reguler)'}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Section 3: Catatan Pengelola / Alasan Penolakan */}
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    Catatan Pengelola / Memo Perubahan (Opsional):
                  </label>
                  <textarea
                    rows={2}
                    value={editRegAdminNotes}
                    onChange={(e) => setEditRegAdminNotes(e.target.value)}
                    placeholder="Contoh: Pemindahan kelas A ke B atas permohonan mahasiswa karena jadwal bentrok dengan praktikum..."
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-[#008744] focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500">
                    Jika status ditolak (rejected), catatan ini akan tampil sebagai alasan penolakan bagi mahasiswa saat cek status.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setRegistrationBeingEdited(null)}
                  className="px-4 py-2.5 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-600 cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#008744] hover:bg-[#00702F] text-white rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan Pendaftaran</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
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

      {/* Modal Cetak Presensi Ujian (UTS / UAS) Format Standar A4 */}
      <ExamAttendanceModal
        isOpen={isExamAttendanceModalOpen}
        onClose={() => setIsExamAttendanceModalOpen(false)}
        courses={courses}
        registrations={registrations}
        adminSettings={adminSettings}
        defaultCourseId={examAttendanceCourseId}
        defaultClass={examAttendanceClass}
      />

    </div>
  );
};
