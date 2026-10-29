import React, { useState, useMemo } from 'react';
import { 
  AdminSettings, 
  RegistrationPeriod, 
  CourseItem, 
  SimpleRegistration, 
  AuthUser,
  formatDateTimeId,
  getSemesterStatus
} from '../types';
import { 
  Calendar, 
  CalendarClock, 
  Clock, 
  PlusCircle, 
  Trash2, 
  Edit3, 
  Save, 
  Check, 
  X, 
  AlertTriangle, 
  BookOpen, 
  Users, 
  ChevronRight, 
  Search, 
  Layers, 
  Sparkles, 
  RotateCcw,
  Info,
  CheckCircle,
  Copy,
  Lock,
  Unlock,
  Eye,
  Sliders
} from 'lucide-react';

interface RegistrationPeriodsManagerProps {
  adminSettings: AdminSettings;
  courses: CourseItem[];
  registrations: SimpleRegistration[];
  onUpdateSettings: (newSettings: AdminSettings) => void;
  currentUser?: AuthUser | null;
  onOpenCourseTab?: () => void;
}

export const RegistrationPeriodsManager: React.FC<RegistrationPeriodsManagerProps> = ({
  adminSettings,
  courses,
  registrations,
  onUpdateSettings,
  currentUser,
  onOpenCourseTab
}) => {
  const periods: RegistrationPeriod[] = adminSettings.registrationPeriods || [];
  const currentAcademicYear = adminSettings.activeAcademicYear || '2025/2026';
  const availableYears = adminSettings.availableAcademicYears || ['2023/2024', '2024/2025', '2025/2026', '2026/2027'];

  // Filters
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterSemester, setFilterSemester] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [periodBeingEdited, setPeriodBeingEdited] = useState<RegistrationPeriod | null>(null);
  const [periodToDelete, setPeriodToDelete] = useState<RegistrationPeriod | null>(null);
  const [periodToViewDetails, setPeriodToViewDetails] = useState<RegistrationPeriod | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form Draft States
  const [semesterInput, setSemesterInput] = useState<number>(1);
  const [academicYearInput, setAcademicYearInput] = useState<string>(currentAcademicYear);
  const [titleInput, setTitleInput] = useState<string>('');
  const [isOpenInput, setIsOpenInput] = useState<boolean>(true);
  const [useScheduleInput, setUseScheduleInput] = useState<boolean>(true);
  const [startDateInput, setStartDateInput] = useState<string>('');
  const [endDateInput, setEndDateInput] = useState<string>('');
  const [closedMessageInput, setClosedMessageInput] = useState<string>('');
  const [offeredCourseIdsInput, setOfferedCourseIdsInput] = useState<string[]>([]);
  const [offeredClassesInput, setOfferedClassesInput] = useState<string[]>(adminSettings.classOptions || ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan']);
  const [notesInput, setNotesInput] = useState<string>('');
  const [courseFilterProdi, setCourseFilterProdi] = useState<'all' | 'agroteknologi' | 'agribisnis'>('all');
  const [courseSearchInModal, setCourseSearchInModal] = useState<string>('');

  // Helper: Format default ISO datetime local (e.g. "2026-11-01T08:00")
  const getFormattedDateTimeLocal = (date: Date): string => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const y = date.getFullYear();
    const m = pad(date.getMonth() + 1);
    const d = pad(date.getDate());
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    return `${y}-${m}-${d}T${hh}:${mm}`;
  };

  // Open Create Modal
  const handleOpenCreateModal = (defaultSem: number = 1) => {
    const now = new Date();
    const twoWeeks = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    twoWeeks.setHours(23, 59, 0, 0);

    const semCourses = courses.filter(c => c.semester === defaultSem);
    const semCourseIds = semCourses.map(c => c.id);

    setPeriodBeingEdited(null);
    setSemesterInput(defaultSem);
    setAcademicYearInput(currentAcademicYear);
    setTitleInput(`Pendaftaran Mengulang Semester ${defaultSem} — T.A. ${currentAcademicYear}`);
    setIsOpenInput(true);
    setUseScheduleInput(true);
    setStartDateInput(getFormattedDateTimeLocal(now));
    setEndDateInput(getFormattedDateTimeLocal(twoWeeks));
    setClosedMessageInput(`Pendaftaran Mengulang Semester ${defaultSem} telah ditutup oleh pihak Admin Fakultas Pertanian.`);
    setOfferedCourseIdsInput(semCourseIds.length > 0 ? semCourseIds : courses.slice(0, 8).map(c => c.id));
    setOfferedClassesInput(adminSettings.classOptions || ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan']);
    setNotesInput(`Periode pendaftaran mata kuliah mengulang untuk mahasiswa yang mengambil Semester ${defaultSem}.`);
    setCourseFilterProdi('all');
    setCourseSearchInModal('');
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (period: RegistrationPeriod) => {
    setPeriodBeingEdited(period);
    setSemesterInput(period.semester);
    setAcademicYearInput(period.academicYear);
    setTitleInput(period.title);
    setIsOpenInput(period.isOpen);
    setUseScheduleInput(period.useSchedule);
    setStartDateInput(period.startDate || '');
    setEndDateInput(period.endDate || '');
    setClosedMessageInput(period.closedMessage || '');
    setOfferedCourseIdsInput(Array.isArray(period.offeredCourseIds) ? period.offeredCourseIds : []);
    setOfferedClassesInput(adminSettings.classOptions || ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan']);
    setNotesInput(period.notes || '');
    setCourseFilterProdi('all');
    setCourseSearchInModal('');
    setIsModalOpen(true);
  };

  // Handle semester change inside modal (auto-updates title & suggested courses)
  const handleSemesterChangeInModal = (newSem: number) => {
    setSemesterInput(newSem);
    if (!periodBeingEdited) {
      setTitleInput(`Pendaftaran Mengulang Semester ${newSem} — T.A. ${academicYearInput}`);
      setClosedMessageInput(`Pendaftaran Mengulang Semester ${newSem} telah ditutup oleh pihak Admin Fakultas Pertanian.`);
      // Auto-suggest courses for this semester
      const matching = courses.filter(c => c.semester === newSem);
      if (matching.length > 0) {
        setOfferedCourseIdsInput(matching.map(c => c.id));
      }
    }
  };

  // Handle Save Period (Create or Edit)
  const handleSavePeriod = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = titleInput.trim();
    if (!cleanTitle) {
      setFeedback({ type: 'error', message: 'Judul periode pendaftaran tidak boleh kosong.' });
      return;
    }

    if (offeredCourseIdsInput.length === 0) {
      setFeedback({ type: 'error', message: 'Pilih minimal 1 mata kuliah yang ditawarkan untuk periode ini.' });
      return;
    }

    const nowIso = new Date().toISOString();
    let updatedPeriods: RegistrationPeriod[];

    if (periodBeingEdited) {
      // Update existing
      updatedPeriods = periods.map(p => {
        if (p.id === periodBeingEdited.id) {
          return {
            ...p,
            semester: semesterInput,
            academicYear: academicYearInput,
            title: cleanTitle,
            isOpen: isOpenInput,
            useSchedule: useScheduleInput,
            startDate: startDateInput,
            endDate: endDateInput,
            closedMessage: closedMessageInput.trim(),
            offeredCourseIds: offeredCourseIdsInput,
            notes: notesInput.trim(),
            updatedAt: nowIso
          };
        }
        return p;
      });
    } else {
      // Create new
      const newPeriod: RegistrationPeriod = {
        id: `period-${academicYearInput.replace(/\//g, '-')}-sem-${semesterInput}-${Date.now().toString(36)}`,
        semester: semesterInput,
        academicYear: academicYearInput,
        title: cleanTitle,
        isOpen: isOpenInput,
        useSchedule: useScheduleInput,
        startDate: startDateInput,
        endDate: endDateInput,
        closedMessage: closedMessageInput.trim(),
        offeredCourseIds: offeredCourseIdsInput,
        notes: notesInput.trim(),
        createdAt: nowIso,
        updatedAt: nowIso
      };
      updatedPeriods = [newPeriod, ...periods];
    }

    // Synchronize to adminSettings and mirror schedule to semesterSchedules for backward compatibility
    const updatedSchedules = {
      ...(adminSettings.semesterSchedules || {}),
      [String(semesterInput)]: {
        semester: semesterInput,
        isOpen: isOpenInput,
        useSchedule: useScheduleInput,
        startDate: startDateInput,
        endDate: endDateInput,
        closedMessage: closedMessageInput.trim()
      }
    };

    onUpdateSettings({
      ...adminSettings,
      registrationPeriods: updatedPeriods,
      semesterSchedules: updatedSchedules
    });

    setIsModalOpen(false);
    setPeriodBeingEdited(null);
    setFeedback({
      type: 'success',
      message: periodBeingEdited
        ? `Periode "${cleanTitle}" berhasil diperbarui!`
        : `Periode Pendaftaran Semester ${semesterInput} (T.A. ${academicYearInput}) berhasil dibuka!`
    });
    setTimeout(() => setFeedback(null), 4000);
  };

  // Instant Toggle Status (Buka / Tutup Cepat)
  const handleTogglePeriodStatus = (period: RegistrationPeriod) => {
    const newStatus = !period.isOpen;
    const updatedPeriods = periods.map(p => {
      if (p.id === period.id) {
        return { ...p, isOpen: newStatus, updatedAt: new Date().toISOString() };
      }
      return p;
    });

    const updatedSchedules = {
      ...(adminSettings.semesterSchedules || {}),
      [String(period.semester)]: {
        semester: period.semester,
        isOpen: newStatus,
        useSchedule: period.useSchedule,
        startDate: period.startDate,
        endDate: period.endDate,
        closedMessage: period.closedMessage
      }
    };

    onUpdateSettings({
      ...adminSettings,
      registrationPeriods: updatedPeriods,
      semesterSchedules: updatedSchedules
    });

    setFeedback({
      type: 'success',
      message: newStatus
        ? `Pendaftaran Semester ${period.semester} (T.A. ${period.academicYear}) sekarang DIBUKA!`
        : `Pendaftaran Semester ${period.semester} (T.A. ${period.academicYear}) sekarang DITUTUP.`
    });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Confirm Delete Period
  const handleConfirmDeletePeriod = () => {
    if (!periodToDelete) return;
    const target = periodToDelete;
    const updatedPeriods = periods.filter(p => p.id !== target.id);

    onUpdateSettings({
      ...adminSettings,
      registrationPeriods: updatedPeriods
    });

    setPeriodToDelete(null);
    setFeedback({
      type: 'success',
      message: `Record periode Semester ${target.semester} (${target.academicYear}) berhasil dihapus.`
    });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Duplicate / Copy Period to another academic year
  const handleDuplicatePeriod = (period: RegistrationPeriod, targetYear: string) => {
    const cloned: RegistrationPeriod = {
      ...period,
      id: `period-${targetYear.replace(/\//g, '-')}-sem-${period.semester}-${Date.now().toString(36)}`,
      academicYear: targetYear,
      title: `Pendaftaran Mengulang Semester ${period.semester} — T.A. ${targetYear}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updated = [cloned, ...periods];
    onUpdateSettings({
      ...adminSettings,
      registrationPeriods: updated
    });

    setFeedback({
      type: 'success',
      message: `Berhasil menduplikasi periode Semester ${period.semester} ke T.A. ${targetYear}!`
    });
    setTimeout(() => setFeedback(null), 3500);
  };

  // Filtered Periods List
  const filteredPeriods = useMemo(() => {
    return periods.filter(p => {
      if (filterYear !== 'all' && p.academicYear !== filterYear) return false;
      if (filterSemester !== 'all' && String(p.semester) !== filterSemester) return false;

      const status = getSemesterStatus(p.semester, { ...adminSettings, registrationPeriods: [p] }, p.academicYear);
      if (filterStatus === 'open' && !status.isOpen) return false;
      if (filterStatus === 'closed' && status.isOpen) return false;
      if (filterStatus === 'upcoming' && status.state !== 'upcoming') return false;
      if (filterStatus === 'expired' && status.state !== 'expired') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(q);
        const matchesSem = `semester ${p.semester}`.includes(q);
        const matchesYear = p.academicYear.toLowerCase().includes(q);
        if (!matchesTitle && !matchesSem && !matchesYear) return false;
      }

      return true;
    });
  }, [periods, filterYear, filterSemester, filterStatus, searchQuery, adminSettings]);

  // Statistics
  const stats = useMemo(() => {
    let totalOpen = 0;
    let totalScheduled = 0;
    let totalClosed = 0;

    periods.forEach(p => {
      const st = getSemesterStatus(p.semester, { ...adminSettings, registrationPeriods: [p] }, p.academicYear);
      if (st.isOpen) totalOpen++;
      else totalClosed++;
      if (p.useSchedule) totalScheduled++;
    });

    return {
      total: periods.length,
      open: totalOpen,
      closed: totalClosed,
      scheduled: totalScheduled
    };
  }, [periods, adminSettings]);

  // Helper count registered students for a semester & academic year
  const getRegisteredCountForPeriod = (sem: number, year: string): number => {
    const semName = `Semester ${sem}`;
    return registrations.filter(r => {
      const regYear = r.academicYear || currentAcademicYear;
      const matchesYear = regYear === year;
      const matchesSem = r.targetSemester === semName || r.targetSemester?.includes(String(sem));
      return matchesYear && matchesSem;
    }).length;
  };

  return (
    <div className="space-y-6">
      {/* ============================================================== */}
      {/* 1. HEADER & ACTION BANNER */}
      {/* ============================================================== */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-[#166534] text-white rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-yellow-400 text-slate-900 shadow-xs">
                Manajemen Pendaftaran Mengulang
              </span>
              <span className="text-emerald-200 text-xs font-semibold">
                Fakultas Pertanian INSTIPER
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Periode Pendaftaran &amp; Penawaran Mata Kuliah
            </h2>
            <p className="text-xs sm:text-sm text-emerald-100 font-medium leading-relaxed">
              Buka periode pendaftaran mengulang untuk masing-masing semester (contoh: Semester 1, 3, dan 5). Tiap semester dapat memiliki jadwal rentang waktu (waktu buka/tutup) serta daftar mata kuliah dan kelas yang berdiri sendiri.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenCreateModal(1)}
              className="px-4 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-slate-900 rounded-xl text-xs font-black shadow-md flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-4 h-4 text-slate-900" />
              <span>+ Buka Periode Semester 1</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenCreateModal(3)}
              className="px-4 py-2.5 bg-white hover:bg-emerald-50 text-emerald-900 rounded-xl text-xs font-black shadow-md flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-4 h-4 text-emerald-800" />
              <span>+ Buka Periode Semester 3</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenCreateModal(5)}
              className="px-4 py-2.5 bg-emerald-800/80 hover:bg-emerald-800 text-white border border-emerald-400/40 rounded-xl text-xs font-black shadow-md flex items-center gap-2 transition-all cursor-pointer active:scale-95"
            >
              <PlusCircle className="w-4 h-4 text-yellow-300" />
              <span>+ Buka Periode Semester 5</span>
            </button>
          </div>
        </div>
      </div>

      {/* FEEDBACK ALERT */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between gap-3 animate-fade-in shadow-xs ${
            feedback.type === 'error'
              ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-bold">
            {feedback.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" /> : <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. STATS SUMMARY CARDS */}
      {/* ============================================================== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-bold mb-1">
            <span>Total Record Periode</span>
            <Calendar className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {stats.total}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Seluruh semester &amp; tahun ajaran</p>
        </div>

        <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 text-xs font-bold mb-1">
            <span>Periode Aktif Dibuka</span>
            <Unlock className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-900 dark:text-emerald-200">
            {stats.open}
          </div>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400 mt-0.5">Dapat diakses oleh mahasiswa</p>
        </div>

        <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-blue-800 dark:text-blue-300 text-xs font-bold mb-1">
            <span>Jadwal Otomatis</span>
            <CalendarClock className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-900 dark:text-blue-200">
            {stats.scheduled}
          </div>
          <p className="text-[11px] text-blue-700/80 dark:text-blue-400 mt-0.5">Memiliki waktu buka &amp; tutup</p>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 text-xs font-bold mb-1">
            <span>Periode Ditutup</span>
            <Lock className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-black text-slate-700 dark:text-slate-300">
            {stats.closed}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Akses pendaftaran nonaktif</p>
        </div>
      </div>

      {/* ============================================================== */}
      {/* 3. FILTER & SEARCH CONTROLS */}
      {/* ============================================================== */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Search Box */}
          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari semester atau judul periode..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#166534]"
            />
          </div>

          {/* Filter Tahun Ajaran */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-bold hidden sm:inline">Tahun Ajaran:</span>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534] cursor-pointer"
            >
              <option value="all">Semua T.A.</option>
              {availableYears.map(yr => (
                <option key={yr} value={yr}>T.A. {yr}</option>
              ))}
            </select>
          </div>

          {/* Filter Semester */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-bold hidden sm:inline">Semester:</span>
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534] cursor-pointer"
            >
              <option value="all">Semua Semester</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
              <option value="3">Semester 3</option>
              <option value="4">Semester 4</option>
              <option value="5">Semester 5</option>
              <option value="6">Semester 6</option>
              <option value="7">Semester 7</option>
              <option value="8">Semester 8</option>
            </select>
          </div>

          {/* Filter Status */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-bold hidden sm:inline">Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534] cursor-pointer"
            >
              <option value="all">Semua Status</option>
              <option value="open">🟢 Sedang Dibuka</option>
              <option value="closed">🔴 Ditutup</option>
              <option value="upcoming">🟡 Belum Dibuka</option>
              <option value="expired">⚪ Selesai (Expired)</option>
            </select>
          </div>
        </div>

        {/* New Period Button */}
        <button
          type="button"
          onClick={() => handleOpenCreateModal()}
          className="px-4 py-2 bg-[#166534] hover:bg-[#14532D] text-white rounded-xl text-xs font-black shadow-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Buka Periode Kustom</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* 4. LIST / TABLE OF REGISTRATION PERIODS */}
      {/* ============================================================== */}
      {filteredPeriods.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
            <Calendar className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">
            Belum Ada Periode Pendaftaran yang Sesuai
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Tidak ditemukan periode pendaftaran mengulang dengan filter saat ini. Klik tombol di bawah untuk membuka periode baru.
          </p>
          <button
            type="button"
            onClick={() => handleOpenCreateModal(1)}
            className="px-4 py-2 bg-[#166534] hover:bg-[#14532D] text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer inline-flex items-center gap-2 mt-2"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Buka Periode Pendaftaran Baru</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPeriods.map((period) => {
            const status = getSemesterStatus(period.semester, { ...adminSettings, registrationPeriods: [period] }, period.academicYear);
            const offeredCount = period.offeredCourseIds?.length || 0;
            const registeredCount = getRegisteredCountForPeriod(period.semester, period.academicYear);

            return (
              <div
                key={period.id}
                className={`bg-white dark:bg-slate-900 rounded-2xl border-2 transition-all shadow-sm overflow-hidden ${
                  status.isOpen
                    ? 'border-emerald-300 dark:border-emerald-700/60 hover:shadow-md'
                    : 'border-slate-200 dark:border-slate-800 opacity-90'
                }`}
              >
                {/* Period Card Top Header */}
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    {/* Big Semester Badge */}
                    <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 font-black shadow-xs ${
                      period.semester === 1
                        ? 'bg-emerald-600 text-white'
                        : period.semester === 3
                        ? 'bg-blue-600 text-white'
                        : period.semester === 5
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-700 text-white'
                    }`}>
                      <span className="text-[9px] uppercase tracking-tighter opacity-80">SEM</span>
                      <span className="text-lg leading-none font-mono font-black">{period.semester}</span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                          Tahun Ajaran: <strong className="text-slate-900 dark:text-white font-mono">{period.academicYear}</strong>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border ${status.badgeClass}`}>
                          {status.label}
                        </span>
                        {period.academicYear === currentAcademicYear && (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            TA Aktif
                          </span>
                        )}
                      </div>

                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                        {period.title}
                      </h3>
                    </div>
                  </div>

                  {/* Actions & Instant Toggle */}
                  <div className="flex items-center gap-2.5 shrink-0 self-end lg:self-auto flex-wrap">
                    {/* Instant Toggle Button (Buka / Tutup Cepat) */}
                    <button
                      type="button"
                      onClick={() => handleTogglePeriodStatus(period)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 shadow-xs ${
                        period.isOpen
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200'
                      }`}
                      title={period.isOpen ? 'Klik untuk menutup link pendaftaran semester ini' : 'Klik untuk membuka pendaftaran semester ini'}
                    >
                      {period.isOpen ? (
                        <>
                          <Lock className="w-3.5 h-3.5 text-rose-600" />
                          <span>Tutup Link</span>
                        </>
                      ) : (
                        <>
                          <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Buka Link</span>
                        </>
                      )}
                    </button>

                    {/* View Details / Courses Button */}
                    <button
                      type="button"
                      onClick={() => setPeriodToViewDetails(period)}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>Rincian MK</span>
                    </button>

                    {/* Edit Period */}
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(period)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold border border-blue-200 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    {/* Delete Period */}
                    <button
                      type="button"
                      onClick={() => setPeriodToDelete(period)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-xl border border-rose-200 cursor-pointer"
                      title="Hapus record periode ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Period Card Details & Schedule Info */}
                <div className="p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-800/30 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  {/* Column 1: Rentang Waktu / Jadwal */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      Rentang Jadwal Pendaftaran
                    </span>
                    {period.useSchedule ? (
                      <div className="space-y-0.5 pt-0.5">
                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                          Buka: <strong className="text-slate-900 dark:text-white">{formatDateTimeId(period.startDate)}</strong>
                        </p>
                        <p className="font-semibold text-slate-700 dark:text-slate-300">
                          Tutup: <strong className="text-slate-900 dark:text-white">{formatDateTimeId(period.endDate)}</strong>
                        </p>
                      </div>
                    ) : (
                      <p className="font-semibold text-slate-700 dark:text-slate-300 pt-0.5">
                        Mode Jadwal: <strong>Manual (Tidak Berbatas Waktu)</strong>
                      </p>
                    )}
                  </div>

                  {/* Column 2: Mata Kuliah & Pilihan Kelas */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                      Mata Kuliah &amp; Kelas Ditawarkan
                    </span>
                    <div className="pt-0.5">
                      <p className="font-bold text-slate-900 dark:text-white">
                        {offeredCount} Mata Kuliah Dibuka
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        Kelas: {adminSettings.classOptions?.slice(0, 4).join(', ')}...
                      </p>
                    </div>
                  </div>

                  {/* Column 3: Status Mahasiswa & Quick stats */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-500" />
                      Statistik Pendaftar Semester {period.semester}
                    </span>
                    <div className="flex items-center gap-2 pt-0.5">
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 font-mono font-bold text-xs">
                        {registeredCount} Mahasiswa
                      </span>
                      <span className="text-[11px] text-slate-500">
                        telah mendaftar di T.A. {period.academicYear}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Closed Message Banner if closed or scheduled */}
                {period.closedMessage && !status.isOpen && (
                  <div className="px-4 py-2.5 bg-rose-50 dark:bg-rose-950/40 border-t border-rose-200 dark:border-rose-800/60 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
                    <Info className="w-4 h-4 shrink-0 text-rose-600" />
                    <span><strong>Pesan Saat Ditutup:</strong> {period.closedMessage}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. MODAL: BUKA / EDIT PERIODE PENDAFTARAN */}
      {/* ============================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200 dark:border-slate-800 my-8">
            {/* Modal Header */}
            <div className="bg-[#166534] text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <CalendarClock className="w-5 h-5 text-yellow-300" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    {periodBeingEdited ? 'Edit Periode Pendaftaran' : 'Buka Periode Pendaftaran Mengulang Baru'}
                  </h3>
                  <p className="text-xs text-emerald-100">
                    Tentukan semester, tahun ajaran, rentang jadwal, serta daftar mata kuliah dan kelas yang dibuka.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSavePeriod} className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto text-xs">
              {/* SECTION 1: IDENTITAS PERIODE & SEMESTER */}
              <div className="space-y-4">
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <Calendar className="w-4 h-4 text-[#166534]" />
                  <span>1. Identitas Periode &amp; Semester Pendaftaran</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Semester */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Pilih Semester yang Dibuka *
                    </label>
                    <select
                      value={semesterInput}
                      onChange={(e) => handleSemesterChangeInModal(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-black text-[#166534] dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-[#166534] cursor-pointer"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
                        <option key={s} value={s}>
                          Semester {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tahun Ajaran */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Tahun Ajaran Akademik *
                    </label>
                    <select
                      value={academicYearInput}
                      onChange={(e) => {
                        setAcademicYearInput(e.target.value);
                        if (!periodBeingEdited) {
                          setTitleInput(`Pendaftaran Mengulang Semester ${semesterInput} — T.A. ${e.target.value}`);
                        }
                      }}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534] cursor-pointer"
                    >
                      {availableYears.map(yr => (
                        <option key={yr} value={yr}>
                          Tahun Akademik {yr} {yr === currentAcademicYear ? '(Aktif)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status Buka Langsung */}
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Status Buka / Tutup *
                    </label>
                    <select
                      value={isOpenInput ? 'open' : 'closed'}
                      onChange={(e) => setIsOpenInput(e.target.value === 'open')}
                      className={`w-full px-3 py-2.5 rounded-xl border text-xs font-black focus:outline-none focus:ring-2 focus:ring-[#166534] cursor-pointer ${
                        isOpenInput
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-700'
                          : 'bg-rose-50 text-rose-900 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-700'
                      }`}
                    >
                      <option value="open">🟢 DIBUKA (Akses Mahasiswa Aktif)</option>
                      <option value="closed">🔴 DITUTUP (Akses Mahasiswa Nonaktif)</option>
                    </select>
                  </div>
                </div>

                {/* Judul Periode */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nama / Judul Record Periode *
                  </label>
                  <input
                    type="text"
                    required
                    value={titleInput}
                    onChange={(e) => setTitleInput(e.target.value)}
                    placeholder="Contoh: Pendaftaran Mengulang Semester 1 — T.A. 2026/2027"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold text-xs focus:ring-2 focus:ring-[#166534] focus:outline-none"
                  />
                </div>
              </div>

              {/* SECTION 2: JADWAL WAKTU BUKA - TUTUP */}
              <div className="space-y-4">
                <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <span>2. Rentang Jadwal (Waktu Buka &amp; Tutup Otomatis)</span>
                </h4>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      Gunakan Jadwal Tanggal &amp; Waktu Otomatis
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Sistem akan menghitung mundur dan otomatis membuka/menutup formulir pendaftaran berdasarkan rentang waktu di bawah.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useScheduleInput}
                      onChange={(e) => setUseScheduleInput(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#166534]"></div>
                  </label>
                </div>

                {useScheduleInput && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in">
                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Tanggal &amp; Waktu Mulai Dibuka *
                      </label>
                      <input
                        type="datetime-local"
                        required={useScheduleInput}
                        value={startDateInput}
                        onChange={(e) => setStartDateInput(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono font-bold focus:ring-2 focus:ring-[#166534] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                        Tanggal &amp; Waktu Berakhir (Tutup) *
                      </label>
                      <input
                        type="datetime-local"
                        required={useScheduleInput}
                        value={endDateInput}
                        onChange={(e) => setEndDateInput(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono font-bold focus:ring-2 focus:ring-[#166534] focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Pesan Khusus Ketika Link Ditutup / Selesai
                  </label>
                  <textarea
                    rows={2}
                    value={closedMessageInput}
                    onChange={(e) => setClosedMessageInput(e.target.value)}
                    placeholder="Contoh: Pendaftaran Mengulang Semester 1 saat ini telah ditutup oleh pihak Admin Fakultas Pertanian..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-[#166534] focus:outline-none"
                  />
                </div>
              </div>

              {/* SECTION 3: PEMILIHAN MATA KULIAH & KELAS */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-emerald-600" />
                    <span>3. Daftar Mata Kuliah yang Ditawarkan ({offeredCourseIdsInput.length} Terpilih)</span>
                  </h4>

                  {/* Filter & Quick Buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => {
                        const matching = courses.filter(c => c.semester === semesterInput).map(c => c.id);
                        setOfferedCourseIdsInput(Array.from(new Set([...offeredCourseIdsInput, ...matching])));
                      }}
                      className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-[#166534] text-[11px] font-bold rounded-lg border border-emerald-300 cursor-pointer"
                    >
                      + Pilih Semua MK Sem {semesterInput}
                    </button>
                    <button
                      type="button"
                      onClick={() => setOfferedCourseIdsInput(courses.map(c => c.id))}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg cursor-pointer"
                    >
                      Pilih Semua MK
                    </button>
                    <button
                      type="button"
                      onClick={() => setOfferedCourseIdsInput([])}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold rounded-lg cursor-pointer"
                    >
                      Kosongkan
                    </button>
                  </div>
                </div>

                {/* Filter and Search for Courses in Modal */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={courseSearchInModal}
                      onChange={(e) => setCourseSearchInModal(e.target.value)}
                      placeholder="Cari matakuliah untuk ditambahkan..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    />
                  </div>
                  <select
                    value={courseFilterProdi}
                    onChange={(e) => setCourseFilterProdi(e.target.value as any)}
                    className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold"
                  >
                    <option value="all">Semua Prodi</option>
                    <option value="agroteknologi">Agroteknologi</option>
                    <option value="agribisnis">Agribisnis</option>
                  </select>
                </div>

                {/* Scrollable Course Selection Grid */}
                <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 p-1">
                  {courses
                    .filter(c => {
                      if (courseFilterProdi !== 'all' && c.prodi !== courseFilterProdi) return false;
                      if (courseSearchInModal.trim()) {
                        const q = courseSearchInModal.toLowerCase();
                        return c.name.toLowerCase().includes(q) || String(c.semester).includes(q);
                      }
                      return true;
                    })
                    .map((course) => {
                      const isSelected = offeredCourseIdsInput.includes(course.id);
                      return (
                        <label
                          key={course.id}
                          className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/30'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                if (isSelected) {
                                  setOfferedCourseIdsInput(offeredCourseIdsInput.filter(id => id !== course.id));
                                } else {
                                  setOfferedCourseIdsInput([...offeredCourseIdsInput, course.id]);
                                }
                              }}
                              className="w-4 h-4 rounded text-[#166534] focus:ring-[#166534] cursor-pointer"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 dark:text-white truncate">
                                {course.name}
                              </p>
                              <span className="text-[10px] text-slate-500 capitalize">
                                {course.prodi} • Semester {course.semester}
                              </span>
                            </div>
                          </div>

                          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                            {course.sks} SKS
                          </span>
                        </label>
                      );
                    })}
                </div>

                {/* Available Classes Notice */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block">
                    Opsi Pilihan Kelas yang Tersedia untuk Mahasiswa:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(adminSettings.classOptions || ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan']).map(cls => (
                      <span key={cls} className="px-2.5 py-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200">
                        ✓ {cls}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Opsi kelas dapat disesuaikan lebih lanjut melalui tab Menu Mata Kuliah &amp; SKS.
                  </p>
                </div>

                {/* Notes Input */}
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Catatan Internal Admin / Informasi Tambahan (Opsional)
                  </label>
                  <input
                    type="text"
                    value={notesInput}
                    onChange={(e) => setNotesInput(e.target.value)}
                    placeholder="Contoh: Khusus mata kuliah persiapan praktikum dan perkebunan..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-[#166534] focus:outline-none"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[#166534] hover:bg-[#14532D] text-white rounded-xl font-bold shadow-md cursor-pointer flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>{periodBeingEdited ? 'Simpan Perubahan Periode' : 'Buka Periode Pendaftaran'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 6. MODAL: RINCIAN MATA KULIAH PERIODE */}
      {/* ============================================================== */}
      {periodToViewDetails && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="bg-[#166534] text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base">Daftar Mata Kuliah yang Ditawarkan</h3>
                <p className="text-xs text-emerald-100">{periodToViewDetails.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setPeriodToViewDetails(null)}
                className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto text-xs">
              <div className="flex items-center justify-between font-bold text-slate-500 pb-2 border-b">
                <span>Mata Kuliah ({periodToViewDetails.offeredCourseIds?.length || 0})</span>
                <span>Prodi &amp; SKS</span>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {courses
                  .filter(c => (periodToViewDetails.offeredCourseIds || []).includes(c.id))
                  .map((c, i) => (
                    <div key={c.id} className="py-2.5 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white">
                          <span className="font-mono text-slate-400 mr-1.5">#{i + 1}</span>
                          {c.name}
                        </p>
                        <span className="text-[10px] text-slate-500 capitalize">{c.prodi} • Semester {c.semester}</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold font-mono">
                        {c.sks} SKS
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setPeriodToViewDetails(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 7. MODAL: KONFIRMASI HAPUS PERIODE */}
      {/* ============================================================== */}
      {periodToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-full bg-rose-100 text-[#E4202A] flex items-center justify-center mx-auto mb-4 border border-rose-200">
                <Trash2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-1">
                Hapus Record Periode?
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                Apakah Anda yakin ingin menghapus record periode <strong>"{periodToDelete.title}"</strong>?
                <br />
                <span className="text-[11px] text-slate-500 block mt-1">Data pendaftar sebelumnya yang sudah tersimpan tidak akan terhapus.</span>
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setPeriodToDelete(null)}
                  className="w-1/2 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDeletePeriod}
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
    </div>
  );
};
