import React, { useState, useMemo, useRef } from 'react';
import { 
  AdminSettings, 
  RegistrationPeriod, 
  CourseItem, 
  SimpleRegistration, 
  AuthUser,
  formatDateTimeId,
  getSemesterStatus,
  getRestrictedClassesForSemester
} from '../types';
import { ANGKATAN_OPTIONS, DEFAULT_CLASSES } from '../data/courses';
import { downloadMasterCoursesTemplate, parseMasterCoursesFile } from '../utils/excelImportExport';
import { 
  Calendar, 
  CalendarClock, 
  Clock, 
  PlusCircle, 
  Trash2, 
  Edit3, 
  Save,
  X, 
  AlertTriangle, 
  BookOpen,
  Search,
  CheckCircle2,
  Lock, 
  Unlock, 
  Eye, 
  EyeOff, 
  Sliders,
  FileUp,
  FileDown,
  Coins,
  ShieldAlert,
  ArrowRight,
  Plus,
} from 'lucide-react';

interface RegistrationPeriodsManagerProps {
  adminSettings: AdminSettings;
  courses: CourseItem[];
  registrations?: SimpleRegistration[];
  onUpdateSettings: (newSettings: AdminSettings) => void;
  onUpdateCourses?: (newCourses: CourseItem[]) => void;
  currentUser?: AuthUser | null;
  onOpenCourseTab?: () => void;
}

export const RegistrationPeriodsManager: React.FC<RegistrationPeriodsManagerProps> = ({
  adminSettings,
  courses,
  onUpdateSettings,
  onUpdateCourses,
}) => {
  const periods: RegistrationPeriod[] = adminSettings.registrationPeriods || [];
  const currentAcademicYear = adminSettings.activeAcademicYear || '2025/2026';
  const availableYears = adminSettings.availableAcademicYears || ['2023/2024', '2024/2025', '2025/2026', '2026/2027'];

  // Filter List States
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterSemester, setFilterSemester] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [activeModalTab, setActiveModalTab] = useState<'identity' | 'courses' | 'rules'>('identity');
  const [periodBeingEdited, setPeriodBeingEdited] = useState<RegistrationPeriod | null>(null);
  const [periodToDelete, setPeriodToDelete] = useState<RegistrationPeriod | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // =========================================================================
  // MODAL FORM STATE: STEP 1 (IDENTITAS & JADWAL)
  // =========================================================================
  const [semesterInput, setSemesterInput] = useState<number | string>(1);
  const [academicYearInput, setAcademicYearInput] = useState<string>(currentAcademicYear);
  const [titleInput, setTitleInput] = useState<string>('');
  const [isOpenInput, setIsOpenInput] = useState<boolean>(true);
  const [showOnMainFormInput, setShowOnMainFormInput] = useState<boolean>(true);
  const [useScheduleInput, setUseScheduleInput] = useState<boolean>(true);
  const [startDateInput, setStartDateInput] = useState<string>('');
  const [endDateInput, setEndDateInput] = useState<string>('');
  const [closedMessageInput, setClosedMessageInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');

  // Inline Add New Academic Year
  const [isAddingNewYear, setIsAddingNewYear] = useState<boolean>(false);
  const [newYearInput, setNewYearInput] = useState<string>('');

  // =========================================================================
  // MODAL FORM STATE: STEP 2 (MATAKULIAH, SKS & KELAS PERIODE)
  // =========================================================================
  const [periodCourses, setPeriodCourses] = useState<CourseItem[]>([]);

  // Quick Manual Add Course inside Period
  const [quickCourseName, setQuickCourseName] = useState<string>('');
  const [quickCourseSks, setQuickCourseSks] = useState<number>(2);
  const [quickCourseProdi, setQuickCourseProdi] = useState<'agroteknologi' | 'agribisnis'>('agroteknologi');
  const [quickCourseClasses] = useState<string[]>(
    adminSettings.classOptions?.filter(c => !c.toLowerCase().includes('beasiswa')) || ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan']
  );

  // In-modal Excel Import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importPreviewCourses, setImportPreviewCourses] = useState<CourseItem[] | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');

  // Copy Courses from another period
  const [copySourcePeriodId, setCopySourcePeriodId] = useState<string>('');

  // =========================================================================
  // MODAL FORM STATE: STEP 3 (BIAYA SKS, BATAS SKS & KELAS BEASISWA)
  // =========================================================================
  // 1. Biaya SKS
  const [feePerSksEnabledInput, setFeePerSksEnabledInput] = useState<boolean>(adminSettings.feePerSksEnabled ?? true);
  const [costPerSksInput, setCostPerSksInput] = useState<number>(adminSettings.costPerSks ?? 50000);
  const [paidBatchesInput, setPaidBatchesInput] = useState<string[]>(adminSettings.paidBatches || ['2020', '2021', '2022']);
  const [paymentInstructionsInput, setPaymentInstructionsInput] = useState<string>(
    adminSettings.paymentInstructions || 'Pemberitahuan: Mahasiswa angkatan yang bersangkutan dikenakan kewajiban pembayaran biaya mengulang mata kuliah sesuai ketentuan akademik Fakultas Pertanian INSTIPER.'
  );
  const [paymentAccountInfoInput, setPaymentAccountInfoInput] = useState<string>(
    adminSettings.paymentAccountInfo || 'Bank BNI / Mandiri Rekening Resmi Fakultas Pertanian INSTIPER Yogyakarta.'
  );

  // 2. Batas SKS
  const [defaultMaxSksInput, setDefaultMaxSksInput] = useState<number>(adminSettings.defaultMaxSks ?? 24);
  const [batchMaxSksInput, setBatchMaxSksInput] = useState<Record<string, number>>(adminSettings.batchMaxSks || { '2020': 20, '2021': 22 });
  const [newBatchLimitYear, setNewBatchLimitYear] = useState<string>('');
  const [newBatchLimitValue, setNewBatchLimitValue] = useState<number>(20);

  // 3. Kelas Beasiswa
  const [restrictedRepeatClassesInput, setRestrictedRepeatClassesInput] = useState<string[]>(['Kelas Beasiswa']);
  const [restrictedRepeatClassReasonInput, setRestrictedRepeatClassReasonInput] = useState<string>(
    'Kelas ini berstatus Kelas Beasiswa dan tidak dibuka untuk kelas mengulang mahasiswa reguler.'
  );

  // Helper: Format default ISO datetime local
  const getFormattedDateTimeLocal = (date: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
  };

  // Helper: Get courses that belong to a specific period
  const getCoursesForPeriod = (period: RegistrationPeriod): CourseItem[] => {
    // 1. Direct embedded courses on period
    if (Array.isArray(period.courses) && period.courses.length > 0) {
      return period.courses;
    }
    // 2. Match from global courses by offeredCourseIds
    if (Array.isArray(period.offeredCourseIds) && period.offeredCourseIds.length > 0) {
      const idSet = new Set(period.offeredCourseIds);
      const matched = courses.filter(c => idSet.has(c.id));
      if (matched.length > 0) return matched;
    }
    // 3. Match from global courses by semester and academicYear
    return courses.filter(c => 
      String(c.semester) === String(period.semester) && 
      (!c.academicYear || c.academicYear === period.academicYear)
    );
  };

  // Open Create Modal
  const handleOpenCreateModal = (defaultSem: number = 1) => {
    const now = new Date();
    const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    twoWeeks.setHours(23, 59, 0, 0);

    const semCourses = courses.filter(c => String(c.semester) === String(defaultSem) && (!c.academicYear || c.academicYear === currentAcademicYear));

    setPeriodBeingEdited(null);
    setActiveModalTab('identity');
    setSemesterInput(defaultSem);
    setAcademicYearInput(currentAcademicYear);
    setTitleInput(`Pendaftaran Mengulang Semester ${defaultSem} — T.A. ${currentAcademicYear}`);
    setIsOpenInput(true);
    setShowOnMainFormInput(true);
    setUseScheduleInput(true);
    setStartDateInput(getFormattedDateTimeLocal(now));
    setEndDateInput(getFormattedDateTimeLocal(twoWeeks));
    setClosedMessageInput(`Pendaftaran Mengulang Semester ${defaultSem} saat ini telah ditutup oleh pihak Admin Fakultas Pertanian.`);
    setNotesInput(`Periode pendaftaran mata kuliah mengulang Semester ${defaultSem}.`);

    // Courses for this new period
    setPeriodCourses(semCourses);

    // Rules defaults
    setFeePerSksEnabledInput(adminSettings.feePerSksEnabled ?? true);
    setCostPerSksInput(adminSettings.costPerSks ?? 50000);
    setPaidBatchesInput(adminSettings.paidBatches || ['2020', '2021', '2022']);
    setPaymentInstructionsInput(adminSettings.paymentInstructions || '');
    setPaymentAccountInfoInput(adminSettings.paymentAccountInfo || '');
    setDefaultMaxSksInput(adminSettings.defaultMaxSks ?? 24);
    setBatchMaxSksInput(adminSettings.batchMaxSks || { '2020': 20, '2021': 22 });

    const existingRestricted = getRestrictedClassesForSemester(defaultSem, adminSettings);
    setRestrictedRepeatClassesInput(existingRestricted.length > 0 ? existingRestricted : ['Kelas Beasiswa']);
    setRestrictedRepeatClassReasonInput(
      adminSettings.restrictedRepeatClassReason?.[String(defaultSem)] ||
      `Kelas ini merupakan Kelas Beasiswa pada Semester ${defaultSem} dan tidak diperkenankan untuk diambil sebagai kelas mengulang.`
    );

    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (period: RegistrationPeriod) => {
    setPeriodBeingEdited(period);
    setActiveModalTab('identity');
    setSemesterInput(period.semester);
    setAcademicYearInput(period.academicYear);
    setTitleInput(period.title);
    setIsOpenInput(period.isOpen);
    setShowOnMainFormInput(period.showOnMainForm ?? period.isOpen);
    setUseScheduleInput(period.useSchedule);
    setStartDateInput(period.startDate || '');
    setEndDateInput(period.endDate || '');
    setClosedMessageInput(period.closedMessage || '');
    setNotesInput(period.notes || '');

    // Load period courses
    setPeriodCourses(getCoursesForPeriod(period));

    // Load rules
    setFeePerSksEnabledInput(period.feePerSksEnabled ?? adminSettings.feePerSksEnabled ?? true);
    setCostPerSksInput(period.costPerSks ?? adminSettings.costPerSks ?? 50000);
    setPaidBatchesInput(period.paidBatches || adminSettings.paidBatches || ['2020', '2021', '2022']);
    setPaymentInstructionsInput(period.paymentInstructions || adminSettings.paymentInstructions || '');
    setPaymentAccountInfoInput(period.paymentAccountInfo || adminSettings.paymentAccountInfo || '');
    setDefaultMaxSksInput(period.defaultMaxSks ?? adminSettings.defaultMaxSks ?? 24);
    setBatchMaxSksInput(period.batchMaxSks || adminSettings.batchMaxSks || { '2020': 20, '2021': 22 });

    const restricted = period.restrictedRepeatClasses && period.restrictedRepeatClasses.length > 0
      ? period.restrictedRepeatClasses
      : getRestrictedClassesForSemester(period.semester, adminSettings);
    setRestrictedRepeatClassesInput(restricted.length > 0 ? restricted : ['Kelas Beasiswa']);
    setRestrictedRepeatClassReasonInput(
      period.restrictedRepeatClassReason ||
      adminSettings.restrictedRepeatClassReason?.[String(period.semester)] ||
      `Kelas Beasiswa pada Semester ${period.semester} tidak diperkenankan untuk diambil mengulang.`
    );

    setIsModalOpen(true);
  };

  // Semester change in modal
  const handleSemesterChangeInModal = (newSem: number | string) => {
    setSemesterInput(newSem);
    if (!periodBeingEdited) {
      setTitleInput(`Pendaftaran Mengulang Semester ${newSem} — T.A. ${academicYearInput}`);
      setClosedMessageInput(`Pendaftaran Mengulang Semester ${newSem} saat ini telah ditutup oleh pihak Admin Fakultas Pertanian.`);
      // Auto-suggest courses if creating new
      const matching = courses.filter(c => String(c.semester) === String(newSem) && (!c.academicYear || c.academicYear === academicYearInput));
      if (matching.length > 0) {
        setPeriodCourses(matching);
      }
    }
  };

  // Handler: Tambah / simpan batas kuota SKS khusus per angkatan untuk periode ini
  const handleAddBatchLimit = () => {
    if (!newBatchLimitYear) return;
    const cleanYear = newBatchLimitYear.trim();
    const cleanVal = Number(newBatchLimitValue) || 24;
    setBatchMaxSksInput(prev => ({
      ...prev,
      [cleanYear]: cleanVal
    }));
    setNewBatchLimitYear('');
    setNewBatchLimitValue(20);
  };

  // Add new academic year inline
  const handleAddNewAcademicYear = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newYearInput.trim();
    if (!clean) return;
    if (availableYears.includes(clean)) {
      setAcademicYearInput(clean);
      setIsAddingNewYear(false);
      setNewYearInput('');
      return;
    }
    const updated = [...availableYears, clean];
    onUpdateSettings({
      ...adminSettings,
      availableAcademicYears: updated
    });
    setAcademicYearInput(clean);
    setIsAddingNewYear(false);
    setNewYearInput('');
    if (!periodBeingEdited) {
      setTitleInput(`Pendaftaran Mengulang Semester ${semesterInput} — T.A. ${clean}`);
    }
    setFeedback({ type: 'success', message: `Tahun ajaran baru "${clean}" berhasil ditambahkan ke sistem!` });
    setTimeout(() => setFeedback(null), 3000);
  };

  // Add course to period manually
  const handleAddCourseToPeriod = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = quickCourseName.trim();
    if (!cleanName) return;

    const newId = `${quickCourseProdi === 'agroteknologi' ? 'agro' : 'agri'}-sem${semesterInput}-${Date.now().toString(36)}`;
    const newCourse: CourseItem = {
      id: newId,
      name: cleanName,
      sks: Math.max(1, Math.min(6, quickCourseSks)),
      prodi: quickCourseProdi,
      semester: semesterInput,
      availableClasses: quickCourseClasses.length > 0 ? quickCourseClasses : adminSettings.classOptions,
      academicYear: academicYearInput,
      periodId: periodBeingEdited ? periodBeingEdited.id : undefined
    };

    setPeriodCourses(prev => [...prev, newCourse]);
    setQuickCourseName('');
    setFeedback({ type: 'success', message: `Mata kuliah "${cleanName}" ditambahkan ke periode ini.` });
    setTimeout(() => setFeedback(null), 2500);
  };

  // Remove course from period
  const handleRemoveCourseFromPeriod = (courseId: string) => {
    setPeriodCourses(prev => prev.filter(c => c.id !== courseId));
  };

  // Toggle kelas beasiswa / larangan untuk suatu matakuliah di periode ini
  const handleToggleCourseClassRestrictionInPeriod = (courseId: string, className: string) => {
    setPeriodCourses(prev => prev.map(c => {
      if (c.id === courseId) {
        const currentRestricted = Array.isArray(c.restrictedClasses) 
          ? c.restrictedClasses 
          : [...restrictedRepeatClassesInput];
        const nextRestricted = currentRestricted.includes(className)
          ? currentRestricted.filter(cls => cls !== className)
          : [...currentRestricted, className];
        return { ...c, restrictedClasses: nextRestricted };
      }
      return c;
    }));
  };

  // Tambah kelas ke matakuliah di periode ini
  const handleAddClassToCourseInPeriod = (courseId: string, className: string) => {
    setPeriodCourses(prev => prev.map(c => {
      if (c.id === courseId) {
        const currentAvailable = c.availableClasses && c.availableClasses.length > 0
          ? c.availableClasses
          : (adminSettings.classOptions || DEFAULT_CLASSES);
        if (currentAvailable.includes(className)) return c;
        return { ...c, availableClasses: [...currentAvailable, className] };
      }
      return c;
    }));
  };

  // Hapus kelas dari matakuliah di periode ini
  const handleRemoveClassFromCourseInPeriod = (courseId: string, className: string) => {
    setPeriodCourses(prev => prev.map(c => {
      if (c.id === courseId) {
        const currentAvailable = c.availableClasses && c.availableClasses.length > 0
          ? c.availableClasses
          : (adminSettings.classOptions || DEFAULT_CLASSES);
        if (currentAvailable.length <= 1) return c;
        const nextAvailable = currentAvailable.filter(cls => cls !== className);
        const nextRestricted = (c.restrictedClasses || []).filter(cls => cls !== className);
        return { ...c, availableClasses: nextAvailable, restrictedClasses: nextRestricted };
      }
      return c;
    }));
  };

  // Excel Import for Period Courses
  const handleImportExcelFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const defaultClasses = adminSettings.classOptions || DEFAULT_CLASSES;
      const result = await parseMasterCoursesFile(file, defaultClasses);
      if (result.error) {
        setFeedback({ type: 'error', message: result.error });
        return;
      }

      if (result.courses.length === 0) {
        setFeedback({ type: 'error', message: 'Tidak ditemukan data mata kuliah pada file yang diunggah.' });
        return;
      }

      // Stamp imported courses with the period's semester and academicYear if not specified
      const stampedCourses: CourseItem[] = result.courses.map(c => ({
        ...c,
        semester: c.semester || semesterInput,
        academicYear: c.academicYear || academicYearInput
      }));

      setImportPreviewCourses(stampedCourses);
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Gagal membaca file Excel: ${err.message || 'Format tidak sesuai'}` });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Confirm Excel Import
  const handleConfirmImport = () => {
    if (!importPreviewCourses || importPreviewCourses.length === 0) return;

    if (importMode === 'replace') {
      setPeriodCourses(importPreviewCourses);
    } else {
      const existingIds = new Set(periodCourses.map(c => c.id));
      const filtered = importPreviewCourses.map((c, i) => {
        if (existingIds.has(c.id)) {
          return { ...c, id: `${c.id}-p-${Date.now().toString(36)}-${i}` };
        }
        return c;
      });
      setPeriodCourses(prev => [...prev, ...filtered]);
    }

    setFeedback({
      type: 'success',
      message: `Berhasil mengimpor ${importPreviewCourses.length} mata kuliah ke periode ini!`
    });
    setImportPreviewCourses(null);
    setTimeout(() => setFeedback(null), 3000);
  };

  // Copy courses from another period
  const handleCopyFromAnotherPeriod = () => {
    if (!copySourcePeriodId) return;
    const srcPeriod = periods.find(p => p.id === copySourcePeriodId);
    if (!srcPeriod) return;

    const srcCourses = getCoursesForPeriod(srcPeriod);
    if (srcCourses.length === 0) {
      setFeedback({ type: 'error', message: 'Periode yang dipilih tidak memiliki data mata kuliah.' });
      setTimeout(() => setFeedback(null), 3000);
      return;
    }

    const cloned: CourseItem[] = srcCourses.map((c, i) => ({
      ...c,
      id: `${c.id}-clone-${Date.now().toString(36)}-${i}`,
      semester: semesterInput,
      academicYear: academicYearInput
    }));

    setPeriodCourses(prev => [...prev, ...cloned]);
    setFeedback({
      type: 'success',
      message: `Berhasil menyalin ${cloned.length} mata kuliah dari ${srcPeriod.title}!`
    });
    setCopySourcePeriodId('');
    setTimeout(() => setFeedback(null), 3500);
  };

  // Save Period (Create or Edit)
  const handleSavePeriod = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = titleInput.trim();
    if (!cleanTitle) {
      setFeedback({ type: 'error', message: 'Judul periode pendaftaran tidak boleh kosong.' });
      return;
    }

    const nowIso = new Date().toISOString();
    const periodId = periodBeingEdited 
      ? periodBeingEdited.id 
      : `period-${academicYearInput.replace(/\//g, '-')}-sem-${semesterInput}-${Date.now().toString(36)}`;

    // Prepare courses stamped with periodId
    const finalPeriodCourses: CourseItem[] = periodCourses.map(c => ({
      ...c,
      semester: semesterInput,
      academicYear: academicYearInput,
      periodId
    }));

    const offeredCourseIds = finalPeriodCourses.map(c => c.id);

    const savedPeriod: RegistrationPeriod = {
      id: periodId,
      semester: semesterInput,
      academicYear: academicYearInput,
      title: cleanTitle,
      isOpen: isOpenInput,
      showOnMainForm: showOnMainFormInput,
      useSchedule: useScheduleInput,
      startDate: startDateInput,
      endDate: endDateInput,
      closedMessage: closedMessageInput.trim(),
      offeredCourseIds,
      courses: finalPeriodCourses,
      feePerSksEnabled: feePerSksEnabledInput,
      costPerSks: costPerSksInput,
      paidBatches: paidBatchesInput,
      paymentInstructions: paymentInstructionsInput.trim(),
      paymentAccountInfo: paymentAccountInfoInput.trim(),
      defaultMaxSks: defaultMaxSksInput,
      batchMaxSks: batchMaxSksInput,
      restrictedRepeatClasses: restrictedRepeatClassesInput,
      restrictedRepeatClassReason: restrictedRepeatClassReasonInput.trim(),
      notes: notesInput.trim(),
      createdAt: periodBeingEdited?.createdAt || nowIso,
      updatedAt: nowIso
    };

    let updatedPeriods: RegistrationPeriod[];
    if (periodBeingEdited) {
      updatedPeriods = periods.map(p => p.id === periodBeingEdited.id ? savedPeriod : p);
    } else {
      updatedPeriods = [savedPeriod, ...periods];
    }

    // Mirror to semesterSchedules for backward compatibility
    const updatedSchedules = {
      ...(adminSettings.semesterSchedules || {}),
      [String(semesterInput)]: {
        semester: Number(semesterInput) || 3,
        isOpen: isOpenInput,
        useSchedule: useScheduleInput,
        startDate: startDateInput,
        endDate: endDateInput,
        closedMessage: closedMessageInput.trim()
      }
    };

    // Update settings in Cloud Firestore
    onUpdateSettings({
      ...adminSettings,
      registrationPeriods: updatedPeriods,
      semesterSchedules: updatedSchedules
    });

    // Update global courses list with the period's courses so they sync to Cloud Firestore
    if (onUpdateCourses) {
      // Replace or merge period's courses in global courses
      const otherCourses = courses.filter(c => c.periodId !== periodId && !(String(c.semester) === String(semesterInput) && c.academicYear === academicYearInput));
      onUpdateCourses([...otherCourses, ...finalPeriodCourses]);
    }

    setIsModalOpen(false);
    setPeriodBeingEdited(null);
    setFeedback({
      type: 'success',
      message: periodBeingEdited
        ? `Periode "${cleanTitle}" dan pengaturan per-semester berhasil diperbarui!`
        : `Periode Pendaftaran Semester ${semesterInput} (T.A. ${academicYearInput}) berhasil dibuka lengkap dengan mata kuliah dan tarif biaya!`
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Toggle Period Status (Buka / Tutup Cepat)
  const handleTogglePeriodStatus = (period: RegistrationPeriod) => {
    const newStatus = !period.isOpen;
    const updatedPeriods = periods.map(p => {
      if (p.id === period.id) {
        return { 
          ...p, 
          isOpen: newStatus, 
          showOnMainForm: newStatus ? (p.showOnMainForm ?? true) : false,
          updatedAt: new Date().toISOString() 
        };
      }
      return p;
    });

    onUpdateSettings({
      ...adminSettings,
      registrationPeriods: updatedPeriods
    });

    setFeedback({
      type: 'success',
      message: `Pendaftaran ${period.title} ${newStatus ? 'berhasil DIBUKA' : 'berhasil DITUTUP'}.`
    });
    setTimeout(() => setFeedback(null), 3000);
  };

  // Toggle Show On Main Form (Tampil / Sembunyikan dari Form Mahasiswa)
  const handleToggleShowOnMainForm = (period: RegistrationPeriod) => {
    const newShow = period.showOnMainForm === false ? true : false;
    const updatedPeriods = periods.map(p => {
      if (p.id === period.id) {
        return { ...p, showOnMainForm: newShow, updatedAt: new Date().toISOString() };
      }
      return p;
    });

    onUpdateSettings({
      ...adminSettings,
      registrationPeriods: updatedPeriods
    });

    setFeedback({
      type: 'success',
      message: `Semester ${period.semester} (${period.academicYear}) ${newShow ? 'sekarang DITAMPILKAN' : 'DISEMBUNYIKAN'} dari halaman utama pendaftaran mahasiswa.`
    });
    setTimeout(() => setFeedback(null), 3000);
  };

  // Delete Period
  const handleConfirmDeletePeriod = () => {
    if (!periodToDelete) return;
    const targetId = periodToDelete.id;
    const title = periodToDelete.title;

    const updatedPeriods = periods.filter(p => p.id !== targetId);
    onUpdateSettings({
      ...adminSettings,
      registrationPeriods: updatedPeriods
    });

    if (onUpdateCourses) {
      onUpdateCourses(courses.filter(c => c.periodId !== targetId));
    }

    setPeriodToDelete(null);
    setFeedback({
      type: 'success',
      message: `Record periode "${title}" berhasil dihapus dari sistem.`
    });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Filtered periods list
  const filteredPeriods = useMemo(() => {
    return periods.filter(p => {
      if (filterYear !== 'all' && p.academicYear !== filterYear) return false;
      if (filterSemester !== 'all' && String(p.semester) !== filterSemester) return false;
      if (filterStatus === 'open' && !p.isOpen) return false;
      if (filterStatus === 'closed' && p.isOpen) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = p.title.toLowerCase().includes(q);
        const matchYear = p.academicYear.toLowerCase().includes(q);
        const matchSem = String(p.semester).includes(q);
        if (!matchTitle && !matchYear && !matchSem) return false;
      }
      return true;
    });
  }, [periods, filterYear, filterSemester, filterStatus, searchQuery]);

  return (
    <div className="space-y-6">
      
      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 animate-fade-in shadow-md ${
          feedback.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100'
            : 'bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700 text-rose-950 dark:text-rose-100'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span className="text-xs sm:text-sm font-bold flex-1">{feedback.message}</span>
          <button 
            type="button" 
            onClick={() => setFeedback(null)} 
            className="p-1 hover:bg-black/10 rounded-lg cursor-pointer text-slate-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Panel & Primary Action */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Periode Pendaftaran Mengulang (Tahun Ajaran &amp; Semester)
              </h2>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-[#166534] text-white">
                ALUR UTAMA
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Buka pendaftaran mengulang per semester dan tahun ajaran, kelola daftar matakuliah &amp; opsi kelas (input manual/import Excel), serta atur tarif biaya SKS, batas SKS, dan kelas beasiswa khusus per periode.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => handleOpenCreateModal(3)}
              className="px-4 py-2.5 bg-[#166534] hover:bg-[#14532D] text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-sm transition-all flex items-center gap-2 cursor-pointer active:scale-98"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Buka Pendaftaran Baru</span>
            </button>
          </div>
        </div>

        {/* Workflow Guide Banner */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-100 dark:border-emerald-900/40 text-xs">
            <span className="font-extrabold text-[#166534] dark:text-emerald-400 block mb-1">
              1. Buka Periode Semester &amp; TA
            </span>
            <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
              Tentukan semester berapa dan tahun ajaran berapa yang dibuka. Jika TA belum ada, tambah langsung secara instan.
            </p>
          </div>
          <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 rounded-xl border border-blue-100 dark:border-blue-900/40 text-xs">
            <span className="font-extrabold text-blue-700 dark:text-blue-400 block mb-1">
              2. Masukkan Matakuliah &amp; SKS
            </span>
            <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
              Input cepat nama matakuliah, SKS, dan kelas, atau gunakan fitur Import Excel langsung di dalam formulir periode.
            </p>
          </div>
          <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/40 text-xs">
            <span className="font-extrabold text-amber-700 dark:text-amber-400 block mb-1">
              3. Atur Biaya, Batas SKS &amp; Beasiswa
            </span>
            <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
              Atur tarif biaya per SKS, batas kuota SKS, dan kelas beasiswa yang dilarang khusus untuk periode pendaftaran tersebut.
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {/* Filter Tahun Ajaran */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-bold text-slate-500">Tahun Ajaran:</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="h-9 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
            >
              <option value="all">Semua T.A.</option>
              {availableYears.map(yr => (
                <option key={yr} value={yr}>T.A. {yr}</option>
              ))}
            </select>
          </div>

          {/* Filter Semester */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-bold text-slate-500">Semester:</label>
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="h-9 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
            >
              <option value="all">Semua Semester</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                <option key={s} value={String(s)}>Semester {s}</option>
              ))}
            </select>
          </div>

          {/* Filter Status */}
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-bold text-slate-500">Status:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-9 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
            >
              <option value="all">Semua Status</option>
              <option value="open">Aktif / Dibuka</option>
              <option value="closed">Ditutup</option>
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari semester / judul..."
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Period Cards Grid */}
      {filteredPeriods.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
          <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">
            Belum Ada Periode Pendaftaran yang Sesuai
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-5">
            Belum ada record pendaftaran mengulang yang dibuat untuk kriteria filter ini. Silakan buat periode baru untuk membuka pendaftaran semester &amp; tahun ajaran.
          </p>
          <button
            type="button"
            onClick={() => handleOpenCreateModal(3)}
            className="px-4 py-2.5 bg-[#166534] hover:bg-[#14532D] text-white rounded-xl text-xs font-bold shadow-sm transition-all inline-flex items-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ Buka Pendaftaran Mengulang Sekarang</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredPeriods.map((period) => {
            const periodCoursesList = getCoursesForPeriod(period);
            const totalSks = periodCoursesList.reduce((sum, c) => sum + (c.sks || 0), 0);
            const statusInfo = getSemesterStatus(period.semester, adminSettings, period.academicYear);
            const isShownOnMain = period.showOnMainForm !== false && period.isOpen;

            return (
              <div
                key={period.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border transition-all shadow-xs flex flex-col justify-between overflow-hidden ${
                  period.isOpen
                    ? 'border-emerald-200 dark:border-emerald-900/60 ring-1 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-800 opacity-90'
                }`}
              >
                {/* Card Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-black bg-[#166534] text-white">
                        Semester {period.semester}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                        T.A. {period.academicYear}
                      </span>
                      {isShownOnMain ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          <span>Tampil di Form Utama</span>
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 flex items-center gap-1">
                          <EyeOff className="w-3 h-3" />
                          <span>Tersembunyi</span>
                        </span>
                      )}
                    </div>
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white line-clamp-1" title={period.title}>
                      {period.title}
                    </h3>
                  </div>

                  {/* Master Toggle Buka/Tutup Switch */}
                  <button
                    type="button"
                    onClick={() => handleTogglePeriodStatus(period)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-black tracking-wider uppercase transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      period.isOpen
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                        : 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                    title={period.isOpen ? 'Klik untuk menutup pendaftaran' : 'Klik untuk membuka pendaftaran'}
                  >
                    {period.isOpen ? (
                      <>
                        <Unlock className="w-3.5 h-3.5" />
                        <span>Dibuka</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Ditutup</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Card Body: Details */}
                <div className="p-4 space-y-3 text-xs">
                  {/* Jadwal Pendaftaran Semester Ini */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-[#166534] dark:text-emerald-400" />
                        <span>Jadwal Pendaftaran:</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${statusInfo.badgeClass}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    {period.useSchedule && period.startDate && period.endDate ? (
                      <div className="text-[11px] text-slate-700 dark:text-slate-300 font-semibold font-mono leading-tight">
                        {formatDateTimeId(period.startDate)} s/d {formatDateTimeId(period.endDate)}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 italic">
                        Manual (Terbuka tanpa batasan waktu otomatis)
                      </div>
                    )}
                  </div>

                  {/* Kuota & Batas Maksimal SKS Semester Ini */}
                  <div className="p-2.5 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/60 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase flex items-center gap-1">
                        <Sliders className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Kuota &amp; Batas SKS:</span>
                      </span>
                      <span className="font-black text-xs text-blue-800 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded border border-blue-300 dark:border-blue-700">
                        Standar Maks {period.defaultMaxSks ?? adminSettings.defaultMaxSks ?? 24} SKS
                      </span>
                    </div>
                    {period.batchMaxSks && Object.keys(period.batchMaxSks).length > 0 ? (
                      <div>
                        <span className="text-[10px] text-slate-500 block mb-1">Batas Khusus Angkatan:</span>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(period.batchMaxSks).map(([yr, lim]) => (
                            <span key={yr} className="px-2 py-0.5 bg-white dark:bg-slate-800 text-blue-800 dark:text-blue-300 rounded-md text-[10px] font-bold border border-blue-200 dark:border-blue-800 shadow-2xs">
                              Angkatan {yr}: {lim} SKS
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block italic">
                        Semua angkatan mengikuti batas standar ({period.defaultMaxSks ?? adminSettings.defaultMaxSks ?? 24} SKS).
                      </span>
                    )}
                  </div>

                  {/* Matakuliah yang Ditawarkan */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div>
                        <p className="font-extrabold text-slate-900 dark:text-white text-xs">
                          {periodCoursesList.length} Mata Kuliah Ditawarkan
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Total Beban: <strong className="font-mono text-emerald-700 dark:text-emerald-400">{totalSks} SKS</strong>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(period)}
                      className="px-2 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-[11px] font-bold hover:bg-slate-100 cursor-pointer"
                    >
                      Kelola MK
                    </button>
                  </div>

                  {/* Biaya SKS Periode Ini */}
                  <div className="p-2 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-bold text-[10px] uppercase">Ketentuan Biaya:</span>
                    {period.feePerSksEnabled !== false ? (
                      <span className="font-extrabold text-amber-700 dark:text-amber-400">
                        Rp {(period.costPerSks ?? adminSettings.costPerSks ?? 50000).toLocaleString('id-ID')} / SKS ({period.paidBatches ? period.paidBatches.join(', ') : 'Angkatan Berbayar'})
                      </span>
                    ) : (
                      <span className="text-slate-500 font-medium">Bebas Biaya (Gratis)</span>
                    )}
                  </div>

                  {/* Kelas Beasiswa Dilarang */}
                  {Array.isArray(period.restrictedRepeatClasses) && period.restrictedRepeatClasses.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-rose-700 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/30 p-2 rounded-lg border border-rose-200 dark:border-rose-900">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Larangan: {period.restrictedRepeatClasses.join(', ')}</span>
                    </div>
                  )}
                </div>

                {/* Card Actions Footer */}
                <div className="p-3 bg-slate-50/80 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleShowOnMainForm(period)}
                      className={`p-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                        isShownOnMain
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                      }`}
                      title={isShownOnMain ? 'Sembunyikan dari pilihan semester halaman mahasiswa' : 'Tampilkan di pilihan semester halaman mahasiswa'}
                    >
                      {isShownOnMain ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      <span className="text-[10px]">{isShownOnMain ? 'Aktif di Form' : 'Sembunyi'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(period)}
                      className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Edit &amp; Atur</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPeriodToDelete(period)}
                      className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl border border-rose-200 dark:border-rose-800 transition-colors cursor-pointer"
                      title="Hapus record periode ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL TERPADU: BUAT / EDIT PENDAFTARAN MENGULANG PERIODE */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-4xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden my-auto max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-[#166534]" />
                  <span>{periodBeingEdited ? 'Edit Periode Pendaftaran Mengulang' : 'Buka Pendaftaran Mengulang Baru'}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Tentukan semester, tahun ajaran, masukkan daftar mata kuliah &amp; SKS, serta konfigurasikan biaya &amp; batas SKS untuk periode ini.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tab Navigators */}
            <div className="px-6 pt-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveModalTab('identity')}
                className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeModalTab === 'identity'
                    ? 'border-[#166534] text-[#166534] dark:text-emerald-400 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <CalendarClock className="w-4 h-4 text-[#166534] dark:text-emerald-400" />
                <span>1. Identitas &amp; Jadwal Pendaftaran</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModalTab('courses')}
                className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeModalTab === 'courses'
                    ? 'border-[#166534] text-[#166534] dark:text-emerald-400 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <BookOpen className="w-4 h-4 text-[#166534] dark:text-emerald-400" />
                <span>2. Mata Kuliah &amp; Kelas ({periodCourses.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveModalTab('rules')}
                className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                  activeModalTab === 'rules'
                    ? 'border-[#166534] text-[#166534] dark:text-emerald-400 font-extrabold'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Sliders className="w-4 h-4 text-[#166534] dark:text-emerald-400" />
                <span>3. Kuota SKS, Biaya &amp; Larangan Kelas</span>
              </button>
            </div>

            {/* Modal Body Content */}
            <form onSubmit={handleSavePeriod} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
              
              {/* ============================================================== */}
              {/* TAB 1: IDENTITAS & WAKTU BUKA */}
              {/* ============================================================== */}
              {activeModalTab === 'identity' && (
                <div className="space-y-5 animate-fade-in">
                  
                  {/* Semester & Tahun Ajaran Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Pilihan Semester */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Pilihan Semester <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={String(semesterInput)}
                        onChange={(e) => handleSemesterChangeInModal(Number(e.target.value) || e.target.value)}
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                        required
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                          <option key={s} value={s}>Semester {s}</option>
                        ))}
                      </select>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Tentukan semester mata kuliah yang dibuka untuk mengulang.
                      </span>
                    </div>

                    {/* Pilihan Tahun Ajaran + Tambah Inline */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Tahun Ajaran <span className="text-rose-500">*</span>
                        </label>
                        {!isAddingNewYear && (
                          <button
                            type="button"
                            onClick={() => setIsAddingNewYear(true)}
                            className="text-[11px] font-extrabold text-[#166534] dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>+ Tambah TA Baru</span>
                          </button>
                        )}
                      </div>

                      {isAddingNewYear ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newYearInput}
                            onChange={(e) => setNewYearInput(e.target.value)}
                            placeholder="Contoh: 2026/2027"
                            className="flex-1 h-11 px-3.5 rounded-xl border border-emerald-400 bg-white dark:bg-slate-800 text-xs font-bold font-mono text-slate-900 dark:text-white"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={handleAddNewAcademicYear}
                            className="h-11 px-3 bg-[#166534] text-white rounded-xl text-xs font-bold cursor-pointer"
                          >
                            Simpan
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsAddingNewYear(false)}
                            className="h-11 px-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      ) : (
                        <select
                          value={academicYearInput}
                          onChange={(e) => {
                            setAcademicYearInput(e.target.value);
                            if (!periodBeingEdited) {
                              setTitleInput(`Pendaftaran Mengulang Semester ${semesterInput} — T.A. ${e.target.value}`);
                            }
                          }}
                          className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                          required
                        >
                          {availableYears.map(yr => (
                            <option key={yr} value={yr}>T.A. {yr}</option>
                          ))}
                        </select>
                      )}
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Pilih tahun ajaran aktif atau buat tahun ajaran baru jika belum terdaftar.
                      </span>
                    </div>
                  </div>

                  {/* Judul Periode */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Judul Periode Pendaftaran <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={titleInput}
                      onChange={(e) => setTitleInput(e.target.value)}
                      placeholder="Contoh: Pendaftaran Mengulang Semester 3 — T.A. 2026/2027"
                      className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                      required
                    />
                  </div>

                  {/* Toggles: Status Buka & Tampil di Halaman Utama */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                    {/* Toggle Status Buka */}
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">
                          Status Pendaftaran Aktif
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {isOpenInput ? 'Pendaftaran sedang dibuka' : 'Pendaftaran ditutup'}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={isOpenInput}
                        onChange={(e) => {
                          setIsOpenInput(e.target.checked);
                          if (!e.target.checked) setShowOnMainFormInput(false);
                          else setShowOnMainFormInput(true);
                        }}
                        className="w-5 h-5 rounded border-slate-300 text-[#166534] focus:ring-[#166534] cursor-pointer"
                      />
                    </div>

                    {/* Toggle Tampil di Form Utama Mahasiswa */}
                    <div className="flex items-center justify-between gap-3 border-t sm:border-t-0 sm:border-l border-slate-200 dark:border-slate-700 pt-3 sm:pt-0 sm:pl-4">
                      <div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white block">
                          Tampil di Form Mahasiswa
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {showOnMainFormInput ? 'Muncul di pilihan semester' : 'Sembunyikan dari mahasiswa'}
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={showOnMainFormInput}
                        onChange={(e) => setShowOnMainFormInput(e.target.checked)}
                        className="w-5 h-5 rounded border-slate-300 text-[#166534] focus:ring-[#166534] cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Pengaturan Jadwal Otomatis */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-[#166534]" />
                        <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                          Gunakan Rentang Waktu Jadwal Otomatis
                        </span>
                      </div>
                      <input
                        type="checkbox"
                        checked={useScheduleInput}
                        onChange={(e) => setUseScheduleInput(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-[#166534] focus:ring-[#166534] cursor-pointer"
                      />
                    </div>

                    {useScheduleInput && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Tanggal &amp; Waktu Mulai Dibuka
                          </label>
                          <input
                            type="datetime-local"
                            value={startDateInput}
                            onChange={(e) => setStartDateInput(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Tanggal &amp; Waktu Selesai (Batas Akhir)
                          </label>
                          <input
                            type="datetime-local"
                            value={endDateInput}
                            onChange={(e) => setEndDateInput(e.target.value)}
                            className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Pesan Ditutup */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Pesan Notifikasi Jika Pendaftaran Ditutup
                    </label>
                    <input
                      type="text"
                      value={closedMessageInput}
                      onChange={(e) => setClosedMessageInput(e.target.value)}
                      placeholder="Contoh: Pendaftaran Mengulang Semester 3 telah ditutup oleh pihak Fakultas Pertanian."
                      className="w-full h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              )}

              {/* ============================================================== */}
              {/* TAB 2: MATA KULIAH, SKS & KELAS PERIODE */}
              {/* ============================================================== */}
              {activeModalTab === 'courses' && (
                <div className="space-y-5 animate-fade-in">
                  
                  {/* Top Action Box: Excel Import & Manual Add */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                          Kelola Mata Kuliah Periode Semester {semesterInput} (T.A. {academicYearInput})
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Masukkan mata kuliah, SKS, dan kelas yang dibuka khusus pada semester dan tahun ajaran ini.
                        </p>
                      </div>

                      {/* Import Buttons */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => downloadMasterCoursesTemplate('xlsx')}
                          className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
                          title="Unduh format template Excel"
                        >
                          <FileDown className="w-3.5 h-3.5 text-blue-600" />
                          <span>Unduh Template</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3.5 py-1.5 bg-[#166534] hover:bg-[#14532D] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
                          title="Upload Excel berisi daftar mata kuliah"
                        >
                          <FileUp className="w-3.5 h-3.5" />
                          <span>Import dari Excel</span>
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".xlsx,.xls,.csv"
                          onChange={handleImportExcelFile}
                          className="hidden"
                        />
                      </div>
                    </div>

                    {/* Copy from another period row */}
                    {periods.length > 0 && (
                      <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          Atau salin matakuliah dari periode lain:
                        </span>
                        <div className="flex items-center gap-2">
                          <select
                            value={copySourcePeriodId}
                            onChange={(e) => setCopySourcePeriodId(e.target.value)}
                            className="h-8 px-2 rounded-lg border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800"
                          >
                            <option value="">Pilih Periode Sumber...</option>
                            {periods.filter(p => p.id !== periodBeingEdited?.id).map(p => (
                              <option key={p.id} value={p.id}>{p.title}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={!copySourcePeriodId}
                            onClick={handleCopyFromAnotherPeriod}
                            className="h-8 px-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            Salin
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Excel Import Preview Modal / Banner if parsed */}
                  {importPreviewCourses && (
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 rounded-2xl space-y-3 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-emerald-950 dark:text-emerald-200">
                          📋 {importPreviewCourses.length} Mata Kuliah Terbaca dari Excel
                        </span>
                        <div className="flex items-center gap-2">
                          <select
                            value={importMode}
                            onChange={(e) => setImportMode(e.target.value as any)}
                            className="h-8 px-2 rounded-lg border border-emerald-300 text-xs bg-white text-emerald-950 font-bold"
                          >
                            <option value="append">Tambahkan ke daftar ini</option>
                            <option value="replace">Gantikan seluruh daftar ini</option>
                          </select>
                          <button
                            type="button"
                            onClick={handleConfirmImport}
                            className="h-8 px-3 bg-[#166534] text-white rounded-lg text-xs font-extrabold cursor-pointer"
                          >
                            Terapkan Import
                          </button>
                          <button
                            type="button"
                            onClick={() => setImportPreviewCourses(null)}
                            className="h-8 px-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quick Add Form Manual */}
                  <div className="p-4 bg-slate-50/50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                    <span className="text-[11px] font-extrabold text-slate-700 dark:text-slate-300 block mb-2">
                      + Tambah Mata Kuliah Manual ke Periode Ini
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                      <div className="sm:col-span-5">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Nama Mata Kuliah</label>
                        <input
                          type="text"
                          value={quickCourseName}
                          onChange={(e) => setQuickCourseName(e.target.value)}
                          placeholder="Contoh: Matematika Terapan"
                          className="w-full h-9 px-3 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">SKS</label>
                        <input
                          type="number"
                          min={1}
                          max={6}
                          value={quickCourseSks}
                          onChange={(e) => setQuickCourseSks(Number(e.target.value) || 2)}
                          className="w-full h-9 px-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs text-center font-bold bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1">Program Studi</label>
                        <select
                          value={quickCourseProdi}
                          onChange={(e) => setQuickCourseProdi(e.target.value as any)}
                          className="w-full h-9 px-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs bg-white dark:bg-slate-800"
                        >
                          <option value="agroteknologi">Agroteknologi</option>
                          <option value="agribisnis">Agribisnis</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <button
                          type="button"
                          onClick={handleAddCourseToPeriod}
                          disabled={!quickCourseName.trim()}
                          className="w-full h-9 bg-[#166534] hover:bg-[#14532D] disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
                        >
                          + Tambah
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Period Courses Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span>Daftar Mata Kuliah Periode Ini ({periodCourses.length} MK):</span>
                      <span className="font-mono text-emerald-700 dark:text-emerald-400">
                        Total SKS: {periodCourses.reduce((sum, c) => sum + (c.sks || 0), 0)} SKS
                      </span>
                    </div>

                    {periodCourses.length === 0 ? (
                      <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                        <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <p className="text-xs text-slate-500">
                          Belum ada mata kuliah yang didaftarkan pada periode ini. Silakan input manual atau import file Excel di atas.
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-50 dark:bg-slate-800 font-bold border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 sticky top-0">
                            <tr>
                              <th className="py-2 px-3 w-8 text-center">No</th>
                              <th className="py-2 px-3">Nama Mata Kuliah</th>
                              <th className="py-2 px-3 w-16 text-center">SKS</th>
                              <th className="py-2 px-3 w-28">Prodi</th>
                              <th className="py-2 px-3 min-w-[200px]">Kelas yang Dibuka &amp; Status Beasiswa (Klik untuk Ubah)</th>
                              <th className="py-2 px-3 w-12 text-center">Aksi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {periodCourses.map((c, idx) => {
                              const curAvail = (c.availableClasses && c.availableClasses.length > 0)
                                ? c.availableClasses
                                : (adminSettings.classOptions || DEFAULT_CLASSES);
                              const unadded = (adminSettings.classOptions || DEFAULT_CLASSES).filter(cls => !curAvail.includes(cls));

                              return (
                                <tr key={c.id || idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                                  <td className="py-2 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                                  <td className="py-2 px-3 font-bold text-slate-900 dark:text-white">{c.name}</td>
                                  <td className="py-2 px-3 text-center font-bold text-emerald-700 dark:text-emerald-400">{c.sks} SKS</td>
                                  <td className="py-2 px-3 capitalize text-slate-600 dark:text-slate-300">{c.prodi}</td>
                                  <td className="py-2 px-3">
                                    <div className="flex flex-wrap gap-1 items-center">
                                      {curAvail.map((cls) => {
                                        const isRestricted = Array.isArray(c.restrictedClasses)
                                          ? c.restrictedClasses.includes(cls)
                                          : restrictedRepeatClassesInput.includes(cls);

                                        return (
                                          <div
                                            key={cls}
                                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 select-none ${
                                              isRestricted
                                                ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800'
                                                : 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800'
                                            }`}
                                          >
                                            <button
                                              type="button"
                                              onClick={() => handleToggleCourseClassRestrictionInPeriod(c.id, cls)}
                                              className="cursor-pointer"
                                              title={isRestricted ? "Kelas Beasiswa / Dilarang (Klik untuk jadikan boleh)" : "Kelas Reguler / Boleh (Klik untuk jadikan beasiswa/dilarang)"}
                                            >
                                              {cls} {isRestricted ? '🚫' : '✓'}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveClassFromCourseInPeriod(c.id, cls)}
                                              className="hover:text-rose-600 cursor-pointer ml-0.5 text-[9px]"
                                              title="Hapus kelas dari mata kuliah ini"
                                            >
                                              ×
                                            </button>
                                          </div>
                                        );
                                      })}

                                      {unadded.length > 0 && (
                                        <select
                                          defaultValue=""
                                          onChange={(e) => {
                                            if (e.target.value) {
                                              handleAddClassToCourseInPeriod(c.id, e.target.value);
                                              e.target.value = '';
                                            }
                                          }}
                                          className="h-5 px-1 text-[9px] rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-bold text-slate-500 cursor-pointer"
                                        >
                                          <option value="" disabled>+ Kelas</option>
                                          {unadded.map(cls => (
                                            <option key={cls} value={cls}>+ {cls}</option>
                                          ))}
                                        </select>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveCourseFromPeriod(c.id)}
                                      className="p-1 text-rose-500 hover:text-rose-700 rounded cursor-pointer"
                                      title="Hapus dari periode ini"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                </div>
              )}

              {/* ============================================================== */}
              {/* TAB 3: BIAYA SKS, BATAS SKS & KELAS BEASISWA KHUSUS PERIODE */}
              {/* ============================================================== */}
              {activeModalTab === 'rules' && (
                <div className="space-y-6 animate-fade-in">
                  
                  {/* SEKSI 1: BIAYA SKS KHUSUS PERIODE INI */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <Coins className="w-4 h-4 text-amber-600" />
                        <div>
                          <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                            1. Pengaturan Biaya Mengulang per SKS (Periode Ini)
                          </h4>
                          <p className="text-[11px] text-slate-500">
                            Tentukan apakah periode pendaftaran ini berbayar dan angkatan mahasiswa mana yang dikenakan biaya.
                          </p>
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={feePerSksEnabledInput}
                        onChange={(e) => setFeePerSksEnabledInput(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-[#166534] focus:ring-[#166534] cursor-pointer"
                      />
                    </div>

                    {feePerSksEnabledInput && (
                      <div className="space-y-3 pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                              Biaya per SKS (Rupiah)
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={5000}
                              value={costPerSksInput}
                              onChange={(e) => setCostPerSksInput(Number(e.target.value) || 0)}
                              className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-extrabold text-amber-900 dark:text-amber-400"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                              Angkatan Mahasiswa yang Dikenakan Biaya
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {ANGKATAN_OPTIONS.map(yr => {
                                const isChecked = paidBatchesInput.includes(yr);
                                return (
                                  <button
                                    key={yr}
                                    type="button"
                                    onClick={() => {
                                      setPaidBatchesInput(prev => 
                                        prev.includes(yr) ? prev.filter(y => y !== yr) : [...prev, yr]
                                      );
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                      isChecked
                                        ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                                        : 'bg-white text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400'
                                    }`}
                                  >
                                    {yr} {isChecked && '✓'}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            Info Rekening Bank &amp; Kontak Konfirmasi Keuangan
                          </label>
                          <input
                            type="text"
                            value={paymentAccountInfoInput}
                            onChange={(e) => setPaymentAccountInfoInput(e.target.value)}
                            placeholder="Contoh: Bank BNI No. Rek: 123-456 a.n. FAPERTA INSTIPER"
                            className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SEKSI 2: PENGATURAN KUOTA & BATAS MAKSIMAL SKS (SEMESTER INI) */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border-2 border-blue-200 dark:border-blue-800/60 space-y-4">
                    <div className="flex items-center gap-2.5 pb-3 border-b border-blue-200 dark:border-blue-800/60">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                        <Sliders className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                          2. Pengaturan Kuota &amp; Batas Maksimal SKS (Semester {semesterInput})
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Tentukan batas maksimal SKS pengambilan untuk semester ini secara mandiri (default 24 SKS atau batas khusus per angkatan).
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Batas Standar Semester Ini */}
                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Batas SKS Standar Seluruh Angkatan
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={defaultMaxSksInput}
                            onChange={(e) => setDefaultMaxSksInput(Number(e.target.value) || 24)}
                            className="w-24 h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-black text-blue-900 dark:text-blue-400 text-center"
                          />
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">SKS / Mahasiswa</span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1.5">
                          Berlaku otomatis untuk semua angkatan yang tidak memiliki aturan batasan khusus pada semester ini.
                        </p>
                      </div>

                      {/* Form Tambah Batas Khusus Angkatan */}
                      <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                          Tambah / Ubah Batas Kuota Angkatan Khusus
                        </label>
                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          <select
                            value={newBatchLimitYear}
                            onChange={(e) => setNewBatchLimitYear(e.target.value)}
                            className="h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-white"
                          >
                            <option value="">Pilih Angkatan...</option>
                            {ANGKATAN_OPTIONS.map(yr => (
                              <option key={yr} value={yr}>Angkatan {yr}</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={1}
                            max={30}
                            value={newBatchLimitValue}
                            onChange={(e) => setNewBatchLimitValue(Number(e.target.value) || 20)}
                            className="w-20 h-10 px-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-center text-slate-900 dark:text-white"
                            title="Batas SKS"
                          />
                          <button
                            type="button"
                            onClick={handleAddBatchLimit}
                            disabled={!newBatchLimitYear}
                            className={`h-10 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                              newBatchLimitYear
                                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Simpan</span>
                          </button>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1.5">
                          Contoh: Mahasiswa Angkatan 2020 dibatasi 20 SKS, Angkatan 2021 dibatasi 22 SKS.
                        </p>
                      </div>
                    </div>

                    {/* Active Batch Limits List */}
                    <div className="pt-2">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1.5">
                        Daftar Batasan Kuota SKS Khusus per Angkatan yang Diterapkan:
                      </span>
                      {Object.keys(batchMaxSksInput).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(batchMaxSksInput).map(([yr, limit]) => (
                            <span
                              key={yr}
                              className="px-3 py-1.5 bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-300 rounded-xl text-xs font-bold border border-blue-300 dark:border-blue-800 flex items-center gap-2 shadow-2xs"
                            >
                              <span>Angkatan {yr}: <strong>{limit} SKS</strong></span>
                              <button
                                type="button"
                                onClick={() => {
                                  const copy = { ...batchMaxSksInput };
                                  delete copy[yr];
                                  setBatchMaxSksInput(copy);
                                }}
                                className="w-4 h-4 rounded-full bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200 hover:bg-rose-500 hover:text-white flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
                                title={`Hapus aturan khusus Angkatan ${yr}`}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 bg-white/70 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-[11px] text-slate-500 text-center">
                          Belum ada batas khusus per angkatan. Semua angkatan mahasiswa mengikuti batas standar ({defaultMaxSksInput} SKS).
                        </div>
                      )}
                    </div>
                  </div>

                  {/* SEKSI 3: KELAS BEASISWA (LARANGAN MENGULANG) KHUSUS PERIODE INI */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                      <ShieldAlert className="w-4 h-4 text-rose-600" />
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-900 dark:text-white">
                          3. Pengaturan Kelas Beasiswa (Dilarang untuk Kelas Mengulang)
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Pilih nama kelas yang berstatus beasiswa sehingga tidak dapat dipilih oleh mahasiswa saat mendaftar.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                        Opsi Kelas yang Dilarang untuk Periode Semester {semesterInput}:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {(adminSettings.classOptions || DEFAULT_CLASSES).map(cls => {
                          const isRestricted = restrictedRepeatClassesInput.includes(cls);
                          return (
                            <button
                              key={cls}
                              type="button"
                              onClick={() => {
                                setRestrictedRepeatClassesInput(prev => 
                                  prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
                                );
                              }}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                                isRestricted
                                  ? 'bg-rose-100 text-rose-900 border-rose-300 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-white text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {cls} {isRestricted && '🚫 Dilarang'}
                            </button>
                          );
                        })}
                      </div>

                      <div className="pt-2">
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                          Alasan / Pesan Peringatan Larangan Kelas
                        </label>
                        <input
                          type="text"
                          value={restrictedRepeatClassReasonInput}
                          onChange={(e) => setRestrictedRepeatClassReasonInput(e.target.value)}
                          placeholder="Pesan larangan kelas beasiswa..."
                          className="w-full h-10 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                        />
                      </div>

                      <div className="p-2.5 bg-indigo-50/70 dark:bg-indigo-950/40 rounded-xl border border-indigo-200 dark:border-indigo-800 text-[11px] text-indigo-900 dark:text-indigo-300 flex items-center justify-between gap-2 mt-2">
                        <span>💡 <strong>Tips:</strong> Pengaturan ini merupakan standar umum. Anda juga dapat menentukan opsi kelas dan status beasiswa yang berbeda per mata kuliah secara mandiri di <strong>Tab 2 (Mata Kuliah &amp; Kelas)</strong>.</span>
                        <button
                          type="button"
                          onClick={() => setActiveModalTab('courses')}
                          className="text-indigo-700 dark:text-indigo-400 font-bold underline cursor-pointer shrink-0"
                        >
                          Buka Tab 2 →
                        </button>
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* Modal Footer Controls */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  {activeModalTab !== 'identity' && (
                    <button
                      type="button"
                      onClick={() => setActiveModalTab(activeModalTab === 'rules' ? 'courses' : 'identity')}
                      className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                    >
                      ← Kembali
                    </button>
                  )}
                  {activeModalTab !== 'rules' && (
                    <button
                      type="button"
                      onClick={() => setActiveModalTab(activeModalTab === 'identity' ? 'courses' : 'rules')}
                      className="px-3.5 py-2 bg-slate-800 text-white dark:bg-slate-700 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1"
                    >
                      <span>Lanjut</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-slate-300 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Batal
                  </button>

                  <button
                    type="submit"
                    className="px-5 py-2 bg-[#166534] hover:bg-[#14532D] text-white rounded-xl text-xs font-extrabold shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{periodBeingEdited ? 'Simpan Perubahan Periode' : 'Buka Pendaftaran Periode Ini'}</span>
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {periodToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-rose-100 dark:bg-rose-950/60 text-[#E4202A] flex items-center justify-center mx-auto mb-4 border border-rose-200 shadow-xs">
                <Trash2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">
                Hapus Record Periode Pendaftaran?
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                Anda akan menghapus record <strong>{periodToDelete.title}</strong> (T.A. {periodToDelete.academicYear}) dari sistem.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setPeriodToDelete(null)}
                  className="w-1/2 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeletePeriod}
                  className="w-1/2 py-2.5 px-4 rounded-xl bg-[#E4202A] hover:bg-red-700 text-white text-xs font-bold shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Ya, Hapus</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
