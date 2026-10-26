import React, { useState, useMemo, useEffect } from 'react';
import { 
  CourseItem, 
  SelectedCourseItem, 
  SimpleRegistration, 
  AdminSettings, 
  getMaxSksForBatch, 
  getSemesterStatus, 
  formatDateTimeId,
  isClassRestrictedForRepeat, 
  getRestrictedClassesForSemester 
} from '../types';
import { ANGKATAN_OPTIONS, DEFAULT_CLASSES } from '../data/courses';
import { 
  AlertCircle, 
  CheckCircle2, 
  Check, 
  Search, 
  BookOpen, 
  FileText, 
  Info,
  Clock,
  Send,
  Ban,
  Layers,
  GraduationCap,
  Printer,
  CreditCard,
  Building2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  X,
  Loader2
} from 'lucide-react';
import { checkNimIsRegistered } from '../lib/firebase';

interface RegistrationFormProps {
  courses: CourseItem[];
  existingRegistrations: SimpleRegistration[];
  adminSettings: AdminSettings;
  onSubmitSuccess: (newRegistration: SimpleRegistration) => void;
  onUpdateNote?: (newNote: string) => void;
}

export const RegistrationForm: React.FC<RegistrationFormProps> = ({
  courses,
  existingRegistrations,
  adminSettings,
  onSubmitSuccess,
}) => {
  // 1. Tahun Ajaran & Semester Aktif (Solusi 3: Hanya Menampilkan Tahun Ajaran yang Aktif)
  const activeAcademicYear = adminSettings.activeAcademicYear || '2025/2026';
  const activeTerm = adminSettings.activeTerm || 'Ganjil';

  // HANYA ambil mata kuliah yang terdaftar pada Tahun Ajaran Aktif (atau tanpa academicYear sebagai fallback aman)
  const activeYearCourses = useMemo(() => {
    return courses.filter((c) => !c.academicYear || c.academicYear === activeAcademicYear);
  }, [courses, activeAcademicYear]);

  // Ekstrak secara dinamis semester apa saja yang memang memiliki mata kuliah di TA aktif (misal [1, 3, 5])
  const activeSemesters = useMemo(() => {
    const semSet = new Set<number>();
    activeYearCourses.forEach((c) => {
      if (typeof c.semester === 'number') semSet.add(c.semester);
    });
    return Array.from(semSet).sort((a, b) => a - b);
  }, [activeYearCourses]);

  // Semester Portal Selection: 'all' atau nomor semester tertentu (misal '1', '3', '5')
  const [selectedSemester, setSelectedSemester] = useState<string>('all');

  // 2. Student Identity Form Fields
  const [email, setEmail] = useState('');
  const [nama, setNama] = useState('');
  const [nim, setNim] = useState('');
  const [noWa, setNoWa] = useState('');
  const [angkatan, setAngkatan] = useState('2023');
  const [kelasAsal, setKelasAsal] = useState('');

  // 3. Course Selection Dictionary: { [courseId]: { checked: boolean, selectedClass: string } }
  const [courseSelections, setCourseSelections] = useState<{
    [id: string]: { checked: boolean; selectedClass: string };
  }>({});

  // 4. Batch class applicator
  const [batchClassToApply, setBatchClassToApply] = useState('Kelas A');

  // 5. Prodi Tab: 'agroteknologi' | 'agribisnis' | 'all'
  const [activeProdiTab, setActiveProdiTab] = useState<'agroteknologi' | 'agribisnis' | 'all'>('agroteknologi');
  const [searchQuery, setSearchQuery] = useState('');

  // 6. Agreement check / acknowledgment
  const [agreeToFlow, setAgreeToFlow] = useState(true);

  // Mobile Guide Collapsible State
  const [isMobileGuideOpen, setIsMobileGuideOpen] = useState(false);

  // Form submission feedback
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Helper untuk menghitung sisa waktu & status penutupan link berdasarkan semester
  const calculateTimeLeft = () => {
    const now = new Date();

    // 1. Jika pengguna memilih semester tertentu (misal Semester 3 atau Semester 5)
    if (selectedSemester !== 'all') {
      const semNum = Number(selectedSemester);
      const semStatus = !isNaN(semNum) 
        ? getSemesterStatus(semNum, adminSettings) 
        : { isOpen: true, state: 'open', message: 'Sesuai Jadwal Akademik' };
      const schedule = adminSettings.semesterSchedules?.[selectedSemester];
      const semTitle = `Semester ${selectedSemester}`;

      // Cek apakah semester ini berstatus tutup (manual closed atau jadwal expired)
      if (!semStatus.isOpen) {
        return {
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isClosed: true,
          statusLabel: `Link Ditutup (${semTitle})`,
          detailMessage: semStatus.message || `Pendaftaran ${semTitle} saat ini sedang ditutup.`,
          semesterLabel: semTitle,
          targetDateFormatted: '-'
        };
      }

      // Jika dibuka, hitung waktu mundur terhadap endDate
      const endDateStr = schedule?.endDate || '2026-11-30T23:59:59';
      const targetDate = new Date(endDateStr);
      const validTarget = isNaN(targetDate.getTime()) ? new Date('2026-11-30T23:59:59') : targetDate;
      const formatted = validTarget.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      const difference = validTarget.getTime() - now.getTime();
      if (difference <= 0) {
        return {
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isClosed: true,
          statusLabel: `Link Ditutup (${semTitle} Berakhir)`,
          detailMessage: `Pendaftaran ${semTitle} telah berakhir pada ${formatted}.`,
          semesterLabel: semTitle,
          targetDateFormatted: formatted
        };
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      return {
        days,
        hours,
        minutes,
        seconds,
        isClosed: false,
        statusLabel: `Ditutup s.d. ${formatted} (${semTitle}):`,
        detailMessage: `Pendaftaran ${semTitle} sedang aktif dibuka.`,
        semesterLabel: semTitle,
        targetDateFormatted: formatted
      };
    }

    // 2. Jika dipilih "Semua Semester" (Gabungan)
    const semKeys = activeSemesters.length > 0 ? activeSemesters.map(String) : ['3', '5'];
    const statuses = semKeys.map(k => ({
      semKey: k,
      status: getSemesterStatus(k, adminSettings),
      schedule: adminSettings.semesterSchedules?.[k]
    }));

    const openStatuses = statuses.filter(s => s.status.isOpen);

    // Jika seluruh semester ditutup
    if (openStatuses.length === 0) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isClosed: true,
        statusLabel: 'Link Pendaftaran Ditutup (Semua Semester)',
        detailMessage: 'Seluruh pendaftaran semester saat ini ditutup oleh Fakultas Pertanian.',
        semesterLabel: 'Semua Semester',
        targetDateFormatted: '-'
      };
    }

    // Jika ada semester yang masih buka, cari target penutupan terdekat
    let minTargetDate: Date | null = null;
    let minFormatted = '';
    let minSemKey = openStatuses[0].semKey;

    for (const item of openStatuses) {
      const endStr = item.schedule?.endDate || '2026-11-30T23:59:59';
      const d = new Date(endStr);
      const validD = isNaN(d.getTime()) ? new Date('2026-11-30T23:59:59') : d;
      if (!minTargetDate || validD.getTime() < minTargetDate.getTime()) {
        minTargetDate = validD;
        minSemKey = item.semKey;
        minFormatted = validD.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }
    }

    const targetDate = minTargetDate || new Date('2026-11-30T23:59:59');
    const difference = targetDate.getTime() - now.getTime();

    if (difference <= 0) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isClosed: true,
        statusLabel: 'Link Pendaftaran Ditutup (Semua Semester)',
        detailMessage: 'Jadwal pendaftaran seluruh semester telah berakhir.',
        semesterLabel: 'Semua Semester',
        targetDateFormatted: minFormatted || '-'
      };
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((difference % (1000 * 60)) / 1000);

    const closedCount = statuses.length - openStatuses.length;
    const closedNote = closedCount > 0 ? ` (${closedCount} Sem Ditutup)` : '';

    return {
      days,
      hours,
      minutes,
      seconds,
      isClosed: false,
      statusLabel: `Ditutup s.d. ${minFormatted}${closedNote}:`,
      detailMessage: `Pendaftaran aktif dibuka s/d ${minFormatted}.`,
      semesterLabel: 'Semua Semester',
      targetDateFormatted: minFormatted
    };
  };

  // State Countdown Timer Real-time
  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft);

  useEffect(() => {
    // Jalankan timer interval setiap 1000ms (1 detik)
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [adminSettings.semesterSchedules, selectedSemester, activeSemesters]);

  // Auto generated registration date
  const [autoDate] = useState(() => {
    const now = new Date();
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const day = now.getDate();
    const month = months[now.getMonth()];
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${minutes} WIB`;
  });

  // Global class options
  const globalClassOptions = useMemo(() => {
    return adminSettings.classOptions && adminSettings.classOptions.length > 0
      ? adminSettings.classOptions
      : DEFAULT_CLASSES;
  }, [adminSettings.classOptions]);

  // Helper available classes for course
  const getAvailableClasses = (course: CourseItem): string[] => {
    if (course.availableClasses && Array.isArray(course.availableClasses) && course.availableClasses.length > 0) {
      const valid = course.availableClasses.filter(c => globalClassOptions.includes(c));
      if (valid.length > 0 && valid.length < globalClassOptions.length) {
        return valid;
      }
    }
    return globalClassOptions;
  };

  const getDefaultClass = (courseId: string): string => {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      const available = getAvailableClasses(course);
      const allowed = available.filter(cls => !isClassRestrictedForRepeat(cls, course.semester, adminSettings));
      return allowed[0] || available[0] || 'Kelas A';
    }
    return globalClassOptions[0] || 'Kelas A';
  };

  const getSelectedClass = (course: CourseItem): string => {
    const available = getAvailableClasses(course);
    const chosen = courseSelections[course.id]?.selectedClass;
    if (chosen && available.includes(chosen) && !isClassRestrictedForRepeat(chosen, course.semester, adminSettings)) {
      return chosen;
    }
    const allowed = available.filter(cls => !isClassRestrictedForRepeat(cls, course.semester, adminSettings));
    return allowed[0] || available[0] || 'Kelas A';
  };

  // Check duplicate registration by NIM (hanya jika pendaftaran aktif / belum ditolak)
  const localDuplicate = useMemo(() => {
    if (!nim.trim()) return null;
    return existingRegistrations.find(
      (r) => r.nim.toLowerCase().trim() === nim.toLowerCase().trim() && r.status !== 'rejected'
    );
  }, [nim, existingRegistrations]);

  const [cloudDuplicate, setCloudDuplicate] = useState<SimpleRegistration | null>(null);
  const [isCheckingCloudNim, setIsCheckingCloudNim] = useState<boolean>(false);

  // Debounced cloud check for NIM to prevent cross-device duplicate submission
  useEffect(() => {
    const clean = nim.trim().toUpperCase();
    if (clean.length < 5) {
      setCloudDuplicate(null);
      setIsCheckingCloudNim(false);
      return;
    }

    if (localDuplicate) {
      setCloudDuplicate(localDuplicate);
      return;
    }

    let isMounted = true;
    setIsCheckingCloudNim(true);
    const timer = setTimeout(() => {
      checkNimIsRegistered(clean).then((res) => {
        if (!isMounted) return;
        setIsCheckingCloudNim(false);
        if (res.exists && res.registration) {
          setCloudDuplicate(res.registration);
        } else {
          setCloudDuplicate(null);
        }
      }).catch(() => {
        if (isMounted) setIsCheckingCloudNim(false);
      });
    }, 450);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [nim, localDuplicate]);

  const duplicateRegistration = localDuplicate || cloudDuplicate;

  // Mahasiswa yang pendaftarannya ditolak diberi izin mendaftar ulang perbaikan
  const previousRejectedRegistration = useMemo(() => {
    if (!nim.trim()) return null;
    return existingRegistrations.find(
      (r) => r.nim.toLowerCase().trim() === nim.toLowerCase().trim() && r.status === 'rejected'
    );
  }, [nim, existingRegistrations]);

  // Max SKS for selected Angkatan
  const currentMaxSks = useMemo(() => {
    return getMaxSksForBatch(angkatan, adminSettings);
  }, [angkatan, adminSettings]);

  // Fee calculation per SKS
  const isFeeSystemActive = adminSettings.feePerSksEnabled ?? true;
  const paidBatches = adminSettings.paidBatches ?? ['2020', '2021', '2022'];
  const costPerSks = adminSettings.costPerSks ?? 50000;
  const isPaidBatch = isFeeSystemActive && paidBatches.includes(angkatan);

  // Filter courses based on activeYearCourses, dynamic semester, prodi tab & smart similar search
  const filteredCourses = useMemo(() => {
    return activeYearCourses.filter((c) => {
      // 1. Filter Semester
      if (selectedSemester !== 'all' && String(c.semester) !== selectedSemester) {
        return false;
      }

      // 2. Filter Prodi Tab
      if (activeProdiTab !== 'all' && c.prodi !== activeProdiTab) return false;

      // 3. Smart Similar / Flexible Live Search
      if (searchQuery.trim()) {
        const cleanQuery = searchQuery.toLowerCase().trim();
        const queryWords = cleanQuery.split(/\s+/).filter(Boolean);
        const targetText = `${c.name} ${c.id} ${c.prodi} ${c.semester ? `semester ${c.semester}` : ''}`.toLowerCase();
        const isMatch = queryWords.every((word) => targetText.includes(word));
        if (!isMatch) return false;
      }

      return true;
    });
  }, [activeYearCourses, selectedSemester, activeProdiTab, searchQuery]);

  // Courses counts per tab based on activeYearCourses and selectedSemester
  const tabCounts = useMemo(() => {
    const semCourses = activeYearCourses.filter((c) => {
      if (selectedSemester === 'all') return true;
      return String(c.semester) === selectedSemester;
    });
    const agro = semCourses.filter(c => c.prodi === 'agroteknologi');
    const agri = semCourses.filter(c => c.prodi === 'agribisnis');

    const selectedAgro = agro.filter(c => courseSelections[c.id]?.checked).length;
    const selectedAgri = agri.filter(c => courseSelections[c.id]?.checked).length;
    const selectedTotal = semCourses.filter(c => courseSelections[c.id]?.checked).length;

    return {
      agroTotal: agro.length,
      agroSelected: selectedAgro,
      agriTotal: agri.length,
      agriSelected: selectedAgri,
      allTotal: semCourses.length,
      allSelected: selectedTotal
    };
  }, [activeYearCourses, selectedSemester, courseSelections]);

  // Selected courses list
  const selectedList = useMemo(() => {
    const list: CourseItem[] = [];
    activeYearCourses.forEach((c) => {
      if (courseSelections[c.id]?.checked) {
        list.push(c);
      }
    });
    return list;
  }, [activeYearCourses, courseSelections]);

  const totalSks = useMemo(() => {
    return selectedList.reduce((acc, curr) => acc + curr.sks, 0);
  }, [selectedList]);

  const totalBiaya = useMemo(() => {
    return isPaidBatch ? totalSks * costPerSks : 0;
  }, [isPaidBatch, totalSks, costPerSks]);

  const isOverSksLimit = totalSks > currentMaxSks;

  // Helper: Cek apakah suatu mata kuliah berada di semester yang pendaftarannya sedang ditutup
  const isCourseClosedCheck = (course: CourseItem): { isClosed: boolean; reason: string } => {
    // 1. Jika portal semester yang dipilih secara global saat ini ditutup
    if (selectedSemester !== 'all') {
      const semStatus = getSemesterStatus(selectedSemester, adminSettings);
      if (!semStatus.isOpen) {
        return {
          isClosed: true,
          reason: semStatus.message || `Pendaftaran Semester ${selectedSemester} ditutup.`
        };
      }
    }

    // 2. Cek status spesifik semester mata kuliah tersebut
    if (typeof course.semester === 'number') {
      const semStatus = getSemesterStatus(course.semester, adminSettings);
      if (!semStatus.isOpen) {
        return {
          isClosed: true,
          reason: semStatus.message || `Pendaftaran Semester ${course.semester} ditutup.`
        };
      }
    }

    return { isClosed: false, reason: '' };
  };

  // Uncheck otomatis mata kuliah jika semester-nya ditutup oleh admin
  useEffect(() => {
    setCourseSelections((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        if (next[id]?.checked) {
          const course = courses.find((c) => c.id === id);
          if (course && isCourseClosedCheck(course).isClosed) {
            next[id] = { ...next[id], checked: false };
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });
  }, [adminSettings.semesterSchedules, selectedSemester]);

  // Toggle single course selection
  const handleToggleCourse = (course: CourseItem) => {
    const { isClosed } = isCourseClosedCheck(course);
    if (isClosed) return; // Kotak centang nonaktif ketika link ditutup

    setCourseSelections((prev) => {
      const current = prev[course.id];
      const isCurrentlyChecked = current?.checked || false;
      const willBeChecked = !isCurrentlyChecked;

      return {
        ...prev,
        [course.id]: {
          checked: willBeChecked,
          selectedClass: current?.selectedClass || getDefaultClass(course.id),
        },
      };
    });
  };

  // Change class for a course
  const handleChangeClass = (courseId: string, newClass: string) => {
    const course = courses.find(c => c.id === courseId);
    if (course && isCourseClosedCheck(course).isClosed) return;

    setCourseSelections((prev) => ({
      ...prev,
      [courseId]: {
        checked: prev[courseId]?.checked ?? true,
        selectedClass: newClass,
      },
    }));
  };

  // Apply batch class to all currently checked courses (hanya mata kuliah yang terbuka)
  const handleApplyBatchClass = (cls: string) => {
    setCourseSelections((prev) => {
      const next = { ...prev };
      activeYearCourses.forEach((c) => {
        if (next[c.id]?.checked && !isCourseClosedCheck(c).isClosed) {
          const available = getAvailableClasses(c);
          if (available.includes(cls) && !isClassRestrictedForRepeat(cls, c.semester, adminSettings)) {
            next[c.id] = {
              ...next[c.id],
              selectedClass: cls,
            };
          }
        }
      });
      return next;
    });
  };

  // Select all or Deselect all visible courses (Hanya berlaku untuk mata kuliah yang dibuka)
  const areAllVisibleSelected = useMemo(() => {
    const openCourses = filteredCourses.filter(c => !isCourseClosedCheck(c).isClosed);
    if (openCourses.length === 0) return false;
    return openCourses.every(c => courseSelections[c.id]?.checked);
  }, [filteredCourses, courseSelections, adminSettings, selectedSemester]);

  const handleToggleSelectAllVisible = () => {
    const openCourses = filteredCourses.filter(c => !isCourseClosedCheck(c).isClosed);
    if (openCourses.length === 0) return;

    setCourseSelections((prev) => {
      const next = { ...prev };
      const targetState = !areAllVisibleSelected;

      // Hanya pilih mata kuliah yang semester-nya sedang DIBUKA
      openCourses.forEach((c) => {
        next[c.id] = {
          checked: targetState,
          selectedClass: next[c.id]?.selectedClass || getDefaultClass(c.id),
        };
      });

      // Pastikan mata kuliah yang tertutup tetap tidak tercentang
      filteredCourses.filter(c => isCourseClosedCheck(c).isClosed).forEach((c) => {
        if (next[c.id]?.checked) {
          next[c.id] = { ...next[c.id], checked: false };
        }
      });

      return next;
    });
  };

  // Status portal info dinamis
  const getPortalInfo = (sem: string) => {
    if (sem === 'all') {
      const activeSemestersText = activeSemesters.map(s => `Sem ${s}`).join(' & ');
      return {
        title: `Gabungan (${activeSemestersText || 'Semua'})`,
        courseCount: `${activeYearCourses.length} Mata Kuliah Tersedia`,
        isOpen: true,
        scheduleText: 'Sesuai Jadwal Akademik'
      };
    }
    const semNumber = Number(sem);
    const status = !isNaN(semNumber) 
      ? getSemesterStatus(semNumber, adminSettings) 
      : { isOpen: true, message: 'Sesuai Jadwal Akademik' };
    const count = activeYearCourses.filter((c) => c.semester === semNumber).length;

    return {
      title: `Semester ${semNumber}`,
      courseCount: `${count} Mata Kuliah Tersedia`,
      isOpen: status.isOpen,
      scheduleText: status.message
    };
  };

  // Scholarship warning summary
  const scholarshipAlertText = useMemo(() => {
    const sem3Restricted = getRestrictedClassesForSemester(3, adminSettings);
    const sem5Restricted = getRestrictedClassesForSemester(5, adminSettings);
    const parts: string[] = [];

    if (sem3Restricted.length > 0) {
      parts.push(`Semester 3: ${sem3Restricted.join(', ')}`);
    }
    if (sem5Restricted.length > 0) {
      parts.push(`Semester 5: ${sem5Restricted.join(', ')}`);
    }

    if (parts.length > 0) {
      return `Kelas Beasiswa (${parts.join('; ')}) hanya diperuntukkan bagi mahasiswa penerima beasiswa baru dan dilarang dipilih untuk mengulang. Pilihlah Kelas Reguler (A/B/C/D) atau Karyawan.`;
    }
    return `Kelas Beasiswa dikhususkan untuk penerima beasiswa dan tidak diperkenankan untuk mengulang mata kuliah. Silakan pilih kelas reguler yang tersedia.`;
  }, [adminSettings]);

  // Status jadwal pembukaan portal semester (dinamis untuk semua semester aktif)
  const activePortalStatus = useMemo(() => {
    if (selectedSemester !== 'all') {
      const semNum = Number(selectedSemester);
      if (!isNaN(semNum)) {
        return getSemesterStatus(semNum, adminSettings);
      }
    }
    const semesters = activeSemesters.length > 0 ? activeSemesters : [3, 5];
    const statuses = semesters.map(s => getSemesterStatus(s, adminSettings));
    const anyOpen = statuses.some(s => s.isOpen);
    return {
      isOpen: anyOpen,
      message: anyOpen ? 'Portal Gabungan Pendaftaran Mengulang' : 'Seluruh jadwal pendaftaran semester saat ini ditutup'
    };
  }, [selectedSemester, activeSemesters, adminSettings]);

  // Cek apakah ada matakuliah yang dipilih berada di semester yang sedang ditutup
  const closedCourseSelected = useMemo(() => {
    return selectedList.find(c => {
      if (typeof c.semester === 'number') {
        const s = getSemesterStatus(c.semester, adminSettings);
        return !s.isOpen;
      }
      return false;
    });
  }, [selectedList, adminSettings]);

  // Validation before submission
  const canSubmit = useMemo(() => {
    if (!activePortalStatus.isOpen) return false;
    if (closedCourseSelected) return false;
    if (duplicateRegistration) return false;
    if (!email.trim() || !nama.trim() || !nim.trim() || !noWa.trim() || !kelasAsal.trim()) return false;
    if (selectedList.length === 0) return false;
    if (totalSks > currentMaxSks) return false;
    if (!agreeToFlow) return false;
    return true;
  }, [activePortalStatus, closedCourseSelected, duplicateRegistration, email, nama, nim, noWa, kelasAsal, selectedList, totalSks, currentMaxSks, agreeToFlow]);

  const getSubmitDisabledReason = (): string | null => {
    if (!activePortalStatus.isOpen) {
      return activePortalStatus.message || `Pendaftaran untuk ${selectedSemester === 'all' ? 'seluruh semester' : `Semester ${selectedSemester}`} saat ini sedang ditutup oleh pihak Fakultas.`;
    }
    if (closedCourseSelected) {
      return `Mata kuliah "${closedCourseSelected.name}" berada di Semester ${closedCourseSelected.semester} yang saat ini pendaftarannya sedang ditutup.`;
    }
    if (duplicateRegistration) return `NIM ${nim} sudah terdaftar sebelumnya atas nama ${duplicateRegistration.nama} (ID: ${duplicateRegistration.id}). Anda tidak dapat mendaftar dua kali kecuali pendaftaran sebelumnya ditolak.`;
    if (!email.trim() || !nama.trim() || !nim.trim() || !noWa.trim() || !kelasAsal.trim()) {
      return 'Harap lengkapi semua data mahasiswa yang wajib diisi (*).';
    }
    if (selectedList.length === 0) {
      return 'Pilih minimal 1 mata kuliah yang ingin Anda daftarkan untuk diulang.';
    }
    if (totalSks > currentMaxSks) {
      return `Total SKS (${totalSks} SKS) melebihi batas maksimal Angkatan ${angkatan} (${currentMaxSks} SKS). Kurangi pilihan mata kuliah Anda.`;
    }
    if (!agreeToFlow) {
      return 'Harap beri centang pada persetujuan alur penyerahan berkas fisik dan pembayaran ke loket fakultas.';
    }
    return null;
  };

  // Handle Form Submission
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmissionError(null);

    const reason = getSubmitDisabledReason();
    if (reason) {
      setSubmissionError(reason);
      return;
    }

    // Build final selected courses
    const finalSelectedCourses: SelectedCourseItem[] = selectedList.map((c) => {
      return {
        courseId: c.id,
        name: c.name,
        sks: c.sks,
        prodi: c.prodi,
        semester: c.semester,
        selectedClass: getSelectedClass(c),
        academicYear: c.academicYear || activeAcademicYear,
      };
    });

    // Deteksi semester dinamis berdasarkan matakuliah aktual yang dipilih
    const uniqueChosenSemesters = Array.from(new Set(selectedList.map(c => c.semester))).sort((a, b) => (Number(a) || 0) - (Number(b) || 0));
    let targetSemesterLabel = 'Semua Semester';
    if (uniqueChosenSemesters.length === 1) {
      targetSemesterLabel = `Semester ${uniqueChosenSemesters[0]}`;
    } else if (uniqueChosenSemesters.length > 1) {
      targetSemesterLabel = `Semester ${uniqueChosenSemesters.join(' & ')} (Gabungan)`;
    } else {
      targetSemesterLabel = selectedSemester === 'all' ? 'Semua Semester' : `Semester ${selectedSemester}`;
    }

    // Generator ID unik dengan proteksi bentrok (Timestamp + 5 Digit Acak Aman)
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const newRegistration: SimpleRegistration = {
      id: `REG-${Date.now()}-${randomSuffix}`,
      email: email.trim(),
      nama: nama.trim().toUpperCase(),
      nim: nim.trim().toUpperCase(),
      noWa: noWa.trim(),
      angkatan,
      kelasAsal: kelasAsal.trim(),
      selectedCourses: finalSelectedCourses,
      totalSks,
      registrationDate: autoDate,
      academicYear: activeAcademicYear,
      academicTerm: activeTerm,
      status: 'pending',
      paymentStatus: 'pending',
      targetSemester: targetSemesterLabel
    };

    onSubmitSuccess(newRegistration);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 pb-36 lg:pb-16 text-slate-800 dark:text-slate-100 font-sans">
      
      {/* ============================================================
          1. HEADER (Section 1)
          Fakultas Pertanian INSTIPER Yogyakarta Identity
         ============================================================ */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 flex items-center justify-center shrink-0 shadow-xs">
            <img src="/logo_instiper.png" alt="Logo INSTIPER" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                Pendaftaran Mengulang Mata Kuliah
              </h1>
              <span className="hidden sm:inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-[#EAB308]/20 text-[#CA8A04] dark:text-[#EAB308] border border-[#EAB308]/40">
                FAPERTA
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Fakultas Pertanian — Institut Pertanian STIPER Yogyakarta
            </p>
          </div>
        </div>

        {/* Countdown Timer Penutupan Pendaftaran (Hari, Jam, Menit, Detik) */}
        <div className={`p-2.5 sm:p-3 rounded-2xl border shadow-xs flex flex-col items-start sm:items-end gap-1.5 self-stretch sm:self-auto min-w-[280px] transition-all ${
          timeLeft.isClosed
            ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 ring-1 ring-rose-400/20'
            : 'bg-white dark:bg-slate-800/90 border-emerald-200 dark:border-emerald-800/60'
        }`}>
          <div className="flex items-center gap-1.5 text-[11px] font-bold">
            <span className={`w-2.5 h-2.5 rounded-full ${timeLeft.isClosed ? 'bg-rose-600' : 'bg-emerald-500 animate-pulse'} shrink-0`} />
            <Clock className={`w-3.5 h-3.5 ${timeLeft.isClosed ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'} shrink-0`} />
            <span className={timeLeft.isClosed ? 'text-rose-900 dark:text-rose-200 font-extrabold' : 'text-slate-700 dark:text-slate-300'}>
              {timeLeft.statusLabel}
            </span>
          </div>

          {/* 4 Box Waktu: Hari, Jam, Menit, Detik (Tetap Tampil & Berhenti / Ter-reset ke 00 saat ditutup) */}
          <div className="flex items-center gap-1.5">
            {/* Box Hari */}
            <div className={`flex flex-col items-center border px-2.5 py-1 rounded-lg min-w-[44px] transition-all ${
              timeLeft.isClosed 
                ? 'bg-rose-100/70 dark:bg-rose-900/40 border-rose-300 dark:border-rose-800' 
                : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/60'
            }`}>
              <span className={`font-mono font-black text-sm sm:text-base leading-none ${
                timeLeft.isClosed ? 'text-rose-700 dark:text-rose-300' : 'text-[#166534] dark:text-emerald-300'
              }`}>
                {String(timeLeft.days).padStart(2, '0')}
              </span>
              <span className={`text-[9px] font-bold uppercase tracking-tighter mt-0.5 ${
                timeLeft.isClosed ? 'text-rose-800 dark:text-rose-400' : 'text-emerald-800 dark:text-emerald-400'
              }`}>
                Hari
              </span>
            </div>
            <span className={`font-bold ${timeLeft.isClosed ? 'text-rose-400 dark:text-rose-600' : 'text-emerald-600 dark:text-emerald-400'}`}>:</span>

            {/* Box Jam */}
            <div className={`flex flex-col items-center border px-2.5 py-1 rounded-lg min-w-[44px] transition-all ${
              timeLeft.isClosed 
                ? 'bg-rose-100/70 dark:bg-rose-900/40 border-rose-300 dark:border-rose-800' 
                : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/60'
            }`}>
              <span className={`font-mono font-black text-sm sm:text-base leading-none ${
                timeLeft.isClosed ? 'text-rose-700 dark:text-rose-300' : 'text-[#166534] dark:text-emerald-300'
              }`}>
                {String(timeLeft.hours).padStart(2, '0')}
              </span>
              <span className={`text-[9px] font-bold uppercase tracking-tighter mt-0.5 ${
                timeLeft.isClosed ? 'text-rose-800 dark:text-rose-400' : 'text-emerald-800 dark:text-emerald-400'
              }`}>
                Jam
              </span>
            </div>
            <span className={`font-bold ${timeLeft.isClosed ? 'text-rose-400 dark:text-rose-600' : 'text-emerald-600 dark:text-emerald-400'}`}>:</span>

            {/* Box Menit */}
            <div className={`flex flex-col items-center border px-2.5 py-1 rounded-lg min-w-[44px] transition-all ${
              timeLeft.isClosed 
                ? 'bg-rose-100/70 dark:bg-rose-900/40 border-rose-300 dark:border-rose-800' 
                : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800/60'
            }`}>
              <span className={`font-mono font-black text-sm sm:text-base leading-none ${
                timeLeft.isClosed ? 'text-rose-700 dark:text-rose-300' : 'text-[#166534] dark:text-emerald-300'
              }`}>
                {String(timeLeft.minutes).padStart(2, '0')}
              </span>
              <span className={`text-[9px] font-bold uppercase tracking-tighter mt-0.5 ${
                timeLeft.isClosed ? 'text-rose-800 dark:text-rose-400' : 'text-emerald-800 dark:text-emerald-400'
              }`}>
                Menit
              </span>
            </div>
            <span className={`font-bold ${timeLeft.isClosed ? 'text-rose-400 dark:text-rose-600' : 'text-emerald-600 dark:text-emerald-400'}`}>:</span>

            {/* Box Detik */}
            <div className={`flex flex-col items-center border px-2.5 py-1 rounded-lg min-w-[44px] transition-all ${
              timeLeft.isClosed 
                ? 'bg-rose-100/70 dark:bg-rose-900/40 border-rose-300 dark:border-rose-800' 
                : 'bg-amber-50 dark:bg-amber-950/60 border-amber-300 dark:border-amber-700/60'
            }`}>
              <span className={`font-mono font-black text-sm sm:text-base leading-none ${
                timeLeft.isClosed ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'
              }`}>
                {String(timeLeft.seconds).padStart(2, '0')}
              </span>
              <span className={`text-[9px] font-bold uppercase tracking-tighter mt-0.5 ${
                timeLeft.isClosed ? 'text-rose-800 dark:text-rose-400' : 'text-amber-800 dark:text-amber-400'
              }`}>
                Detik
              </span>
            </div>
          </div>

          {/* Subtext Status Waktu Berhenti / Ditutup */}
          {timeLeft.isClosed ? (
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-800 dark:text-rose-200 bg-rose-100 dark:bg-rose-900/50 px-2 py-0.5 rounded-md border border-rose-300 dark:border-rose-800">
              <Ban className="w-3 h-3 text-rose-600 dark:text-rose-400" />
              <span>Waktu Berhenti • Link {timeLeft.semesterLabel} Ditutup</span>
            </div>
          ) : (
            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
              Sistem menghitung mundur batas waktu
            </div>
          )}
        </div>
      </header>

      {/* ============================================================
          MAIN TWO-COLUMN GRID (Desktop 8-col Left / 4-col Right Sticky)
         ============================================================ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ============================================================
            LEFT COLUMN (Form Controls & Mata Kuliah Selection)
           ============================================================ */}
        <div className="lg:col-span-8 space-y-6 sm:space-y-8 min-w-0">
          
          {/* ============================================================
              SISTEM PANDUAN: ALUR RESMI PENDAFTARAN MENGULANG
              Tema Akademik Senada INSTIPER (Forest Green & Janur Kuning)
              Didesain adaptif & ringkas untuk HP (tidak memakan ruang vertikal)
             ============================================================ */}
          <div className="bg-gradient-to-br from-emerald-50/70 via-white to-slate-50/80 dark:from-emerald-950/25 dark:via-slate-900 dark:to-slate-900 border border-emerald-200/80 dark:border-emerald-800/50 rounded-2xl p-4 sm:p-6 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/50 dark:border-emerald-800/50 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#166534] text-white flex items-center justify-center shadow-xs shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                    Alur Resmi Pendaftaran Mengulang
                  </h2>
                  <p className="text-[11px] sm:text-xs text-[#166534] dark:text-emerald-400 font-semibold">
                    Fakultas Pertanian — Wajib Dipahami Seluruh Mahasiswa
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 sm:py-1 rounded-full bg-[#166534]/10 text-[#166534] dark:text-emerald-300 border border-[#166534]/20">
                  4 Langkah Prosedur
                </span>
                <button
                  type="button"
                  onClick={() => setIsMobileGuideOpen(!isMobileGuideOpen)}
                  className="sm:hidden flex items-center gap-1 text-[11px] font-bold text-[#166534] dark:text-emerald-400 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 shadow-2xs cursor-pointer"
                >
                  <span>{isMobileGuideOpen ? 'Tutup Detail' : 'Lihat Detail'}</span>
                  {isMobileGuideOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Mobile Compact Progress Strip (Selalu tampil di layar HP) */}
            <div className="sm:hidden flex items-center justify-between gap-1 p-2 bg-white/90 dark:bg-slate-900/90 rounded-xl border border-emerald-200/60 dark:border-emerald-800/60 text-[10px] font-bold">
              <span className="text-[#166534] dark:text-emerald-400">1. Form</span>
              <span className="text-slate-300 dark:text-slate-700">➔</span>
              <span className="text-[#166534] dark:text-emerald-400">2. Cetak KRS</span>
              <span className="text-slate-300 dark:text-slate-700">➔</span>
              <span className="text-[#CA8A04]">3. Slip Bayar</span>
              <span className="text-slate-300 dark:text-slate-700">➔</span>
              <span className="text-[#166534] dark:text-emerald-400">4. Loket FP</span>
            </div>

            {/* 4 Cards Alur - Unified INSTIPER Academic Style (Responsif HP & Desktop) */}
            <div className={`${isMobileGuideOpen ? 'grid' : 'hidden'} sm:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3`}>
              
              {/* Langkah 1 */}
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-full bg-[#166534] text-white flex items-center justify-center text-xs font-black shadow-2xs">1</span>
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-[#166534] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">Online</span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                    Isi Formulir Online
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Pilih portal semester, lengkapi data diri, dan centang mata kuliah mengulang pada formulir di bawah.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] font-semibold text-[#166534] dark:text-emerald-400">
                  ✓ Melalui Portal Ini
                </div>
              </div>

              {/* Langkah 2 */}
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-full bg-[#166534] text-white flex items-center justify-center text-xs font-black shadow-2xs">2</span>
                    <Printer className="w-4 h-4 text-[#166534] dark:text-emerald-400" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                    Cetak Lembar KRS (A4)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Setelah formulir dikirim, sistem membuka dokumen KRS. Cetak pada kertas A4 atau simpan file HTML/PDF resmi.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] font-semibold text-[#166534] dark:text-emerald-400">
                  ✓ Format Standar Resmi
                </div>
              </div>

              {/* Langkah 3 */}
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-full bg-[#CA8A04] text-white flex items-center justify-center text-xs font-black shadow-2xs">3</span>
                    <CreditCard className="w-4 h-4 text-[#CA8A04]" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                    Bukti Pembayaran SKS
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Bagi angkatan lama (2022 ke bawah), bayar biaya per SKS dan siapkan <strong>slip fisik transfer/bank</strong>. *(Angkatan 2023+ bebas biaya)*.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] font-semibold text-[#CA8A04]">
                  ✓ Slip / Struk Bank
                </div>
              </div>

              {/* Langkah 4 */}
              <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-6 h-6 rounded-full bg-[#166534] text-white flex items-center justify-center text-xs font-black shadow-2xs">4</span>
                    <Building2 className="w-4 h-4 text-[#166534] dark:text-emerald-400" />
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                    Serahkan ke Loket FP
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Bawa lembar cetak formulir beserta bukti fisik pembayaran (jika ada) ke <strong>Administrasi Fakultas Pertanian</strong> untuk validasi.
                  </p>
                </div>
                <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] font-semibold text-[#166534] dark:text-emerald-400">
                  ✓ Loket Admin FP
                </div>
              </div>

            </div>

            {/* Highlight Note */}
            <div className={`${isMobileGuideOpen ? 'flex' : 'hidden sm:flex'} p-3 bg-emerald-100/70 dark:bg-emerald-950/60 rounded-xl items-center gap-2.5 text-xs text-emerald-950 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800`}>
              <Info className="w-4 h-4 text-[#166534] dark:text-emerald-400 shrink-0" />
              <span>
                <strong>Penting:</strong> Pendaftaran Anda dinyatakan sah dan aktif setelah lembar cetak fisik diverifikasi dan ditandatangani oleh Admin Fakultas Pertanian INSTIPER.
              </span>
            </div>
          </div>

          <form id="registration-form" onSubmit={handleSubmitForm} className="space-y-6 sm:space-y-8">
            
            {/* ============================================================
                2. LANGKAH 1: PILIH PORTAL SEMESTER (Section 2)
                Dinamis sesuai semester yang memiliki mata kuliah di TA Aktif
               ============================================================ */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#166534] text-white flex items-center justify-center text-xs font-bold">1</span>
                    <span>Pilih Portal Semester (T.A. {activeAcademicYear})</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 ml-8">
                    Tentukan semester mata kuliah yang ingin Anda daftarkan untuk diulang pada periode {activeTerm}.
                  </p>
                </div>

                {/* Dropdown Semester Dinamis */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <label htmlFor="semester-dropdown" className="text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0">
                    Filter Semester:
                  </label>
                  <select
                    id="semester-dropdown"
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(e.target.value)}
                    className="h-10 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#166534] shadow-2xs cursor-pointer"
                  >
                    <option value="all">Semua Semester ({activeYearCourses.length} Matkul)</option>
                    {activeSemesters.map((sem) => {
                      const count = activeYearCourses.filter(c => c.semester === sem).length;
                      return (
                        <option key={sem} value={String(sem)}>
                          Semester {sem} ({count} Matkul)
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Grid Kartu Semester Dinamis */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {/* Kartu: Semua Semester */}
                <button
                  type="button"
                  onClick={() => setSelectedSemester('all')}
                  className={`text-left p-4 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                    selectedSemester === 'all'
                      ? 'border-2 border-[#166534] bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs ring-1 ring-[#166534]/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                      Semua Semester
                    </h3>
                    {selectedSemester === 'all' ? (
                      <CheckCircle2 className="w-5 h-5 text-[#166534] dark:text-emerald-400 shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700 shrink-0 mt-0.5" />
                    )}
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                    {activeYearCourses.length} Mata Kuliah Tersedia
                  </p>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                    <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                      activePortalStatus.isOpen
                        ? 'bg-emerald-100 dark:bg-emerald-900/50 text-[#166534] dark:text-emerald-300'
                        : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                    }`}>
                      {activePortalStatus.isOpen ? 'Dibuka' : 'Ditutup'}
                    </span>
                    <span className="text-slate-400 text-[10px] truncate max-w-[130px]">
                      {activeSemesters.length > 0 ? activeSemesters.map(s => `Sem ${s}`).join(', ') : 'Semua'}
                    </span>
                  </div>
                </button>

                {/* Kartu per Semester yang benar-benar ada di TA Aktif */}
                {activeSemesters.map((sem) => {
                  const semKey = String(sem);
                  const info = getPortalInfo(semKey);
                  const isSelected = selectedSemester === semKey;

                  return (
                    <button
                      key={semKey}
                      type="button"
                      onClick={() => setSelectedSemester(semKey)}
                      className={`text-left p-4 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                        isSelected
                          ? 'border-2 border-[#166534] bg-emerald-50/50 dark:bg-emerald-950/20 shadow-xs ring-1 ring-[#166534]/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                          Semester {sem}
                        </h3>
                        {isSelected ? (
                          <CheckCircle2 className="w-5 h-5 text-[#166534] dark:text-emerald-400 shrink-0" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-700 shrink-0 mt-0.5" />
                        )}
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                        {info.courseCount}
                      </p>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                        <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                          info.isOpen 
                            ? 'bg-emerald-100 dark:bg-emerald-900/50 text-[#166534] dark:text-emerald-300' 
                            : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                        }`}>
                          {info.isOpen ? 'Dibuka' : 'Ditutup'}
                        </span>
                        <span className="text-slate-400 truncate max-w-[130px]" title={info.scheduleText}>
                          {info.scheduleText}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* ============================================================
                3. LANGKAH 2: DATA MAHASISWA (Section 3)
               ============================================================ */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="mb-4">
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#166534] text-white flex items-center justify-center text-xs font-bold">2</span>
                  <span>Data Mahasiswa</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 ml-8">
                  Isi data identitas diri yang valid sesuai KTM dan Kartu Rencana Studi resmi.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Email Mahasiswa <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent transition-all shadow-2xs"
                  />
                </div>

                {/* Nama */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nama Lengkap Sesuai KTM <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    placeholder="Nama lengkap mahasiswa"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base sm:text-sm uppercase focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent transition-all shadow-2xs"
                  />
                </div>

                {/* NIM */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>Nomor Induk Mahasiswa (NIM) <span className="text-red-500">*</span></span>
                    <span className="text-[10px] text-slate-400 font-normal font-sans">(Hanya Angka)</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    value={nim}
                    onChange={(e) => setNim(e.target.value.replace(/\D/g, ''))}
                    placeholder="Contoh: 2112345"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent transition-all shadow-2xs"
                  />
                  {isCheckingCloudNim && (
                    <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                      <Loader2 className="w-3 h-3 animate-spin text-[#166534]" />
                      <span>Memeriksa status pendaftaran NIM di server cloud...</span>
                    </p>
                  )}
                  {duplicateRegistration && !isCheckingCloudNim && (
                    <div className="mt-2 p-2.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200 animate-fade-in">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>NIM {duplicateRegistration.nim} sudah terdaftar ({duplicateRegistration.id})</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-rose-700 dark:text-rose-300">
                        Pendaftaran atas nama <strong>{duplicateRegistration.nama}</strong> sudah aktif di sistem. Satu NIM hanya diizinkan mendaftar satu kali. Buka menu <strong>Cek Status</strong> untuk mencetak KRS Anda.
                      </p>
                    </div>
                  )}
                  {previousRejectedRegistration && !duplicateRegistration && !isCheckingCloudNim && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 font-semibold flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Pendaftaran sebelumnya ditolak{previousRejectedRegistration.rejectionReason ? ` (${previousRejectedRegistration.rejectionReason})` : ''}. Anda dapat mengajukan pendaftaran perbaikan.</span>
                    </p>
                  )}
                </div>

                {/* No WA */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>No WhatsApp Aktif <span className="text-red-500">*</span></span>
                    <span className="text-[10px] text-slate-400 font-normal font-sans">(Hanya Angka)</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    required
                    value={noWa}
                    onChange={(e) => setNoWa(e.target.value.replace(/\D/g, ''))}
                    placeholder="Contoh: 081234567890"
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent transition-all shadow-2xs"
                  />
                </div>

                {/* Angkatan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    Angkatan Mahasiswa <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={angkatan}
                    onChange={(e) => setAngkatan(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent transition-all shadow-2xs cursor-pointer"
                  >
                    {ANGKATAN_OPTIONS.map((th) => (
                      <option key={th} value={th}>
                        Angkatan {th}
                      </option>
                    ))}
                  </select>

                  {/* Single concise line for SKS limit & fee status */}
                  <div className="mt-2 p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Batas maksimal: <strong>{currentMaxSks} SKS</strong>
                    </p>
                    <p className={`text-[11px] mt-0.5 ${isPaidBatch ? 'text-amber-700 dark:text-amber-400 font-medium' : 'text-[#166534] dark:text-emerald-400 font-medium'}`}>
                      {isPaidBatch 
                        ? `⚠️ Dikenakan biaya Rp ${costPerSks.toLocaleString('id-ID')} / SKS (wajib melampirkan bukti fisik pembayaran ke loket).` 
                        : `✓ Angkatan ${angkatan} bebas biaya SKS mengulang (tidak perlu bukti pembayaran).`}
                    </p>
                  </div>
                </div>

                {/* Kelas Asal - Disinkronkan dengan Data Opsi Kelas Admin */}
                <div className="flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Kelas Asal Reguler <span className="text-red-500">*</span>
                      </label>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                        {adminSettings.kelasAsalMode === 'select' ? 'Pilihan Data Admin' : 'Sesuai Data Kelas Admin'}
                      </span>
                    </div>

                    {adminSettings.kelasAsalMode === 'select' ? (
                      <select
                        required
                        value={kelasAsal}
                        onChange={(e) => setKelasAsal(e.target.value)}
                        className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent transition-all shadow-2xs cursor-pointer"
                      >
                        <option value="">-- Pilih Kelas Asal ({globalClassOptions.length} Opsi Admin) --</option>
                        {globalClassOptions.map((cls) => (
                          <option key={cls} value={cls}>
                            {cls}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div>
                        <input
                          type="text"
                          required
                          list="admin-kelas-asal-datalist"
                          value={kelasAsal}
                          onChange={(e) => setKelasAsal(e.target.value)}
                          placeholder={adminSettings.kelasAsalPlaceholder || `Contoh: ${globalClassOptions[0] || 'Kelas A'}`}
                          className="w-full h-11 px-3.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#166534] focus:border-transparent transition-all shadow-2xs"
                        />
                        <datalist id="admin-kelas-asal-datalist">
                          {globalClassOptions.map((cls) => (
                            <option key={cls} value={cls} />
                          ))}
                        </datalist>
                      </div>
                    )}
                  </div>

                  {/* Opsi Pilihan Cepat Sesuai Data Kelas Admin */}
                  {adminSettings.kelasAsalMode !== 'select' && globalClassOptions.length > 0 && (
                    <div className="mt-2 p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                          Pilihan Cepat Kelas Admin:
                        </span>
                        {kelasAsal && (
                          <button
                            type="button"
                            onClick={() => setKelasAsal('')}
                            className="text-[10px] text-slate-400 hover:text-red-500 transition-colors"
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {globalClassOptions.map((cls) => {
                          const isSelected = kelasAsal === cls;
                          return (
                            <button
                              key={cls}
                              type="button"
                              onClick={() => setKelasAsal(cls)}
                              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all cursor-pointer flex items-center gap-1 ${
                                isSelected
                                  ? 'bg-[#166534] text-white shadow-xs font-bold ring-2 ring-[#166534]/30'
                                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:border-[#166534] dark:hover:border-emerald-500'
                              }`}
                            >
                              {isSelected && <span className="text-white text-[10px] font-black">✓</span>}
                              <span>{cls}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
                        Tap nama kelas di atas untuk mengisi instan, atau ketik langsung jika ada variasi nama kelas.
                      </p>
                    </div>
                  )}
                </div>

              </div>

              {/* Catatan dari Superadmin */}
              {adminSettings.classNote && (
                <div className="mt-4 p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                  <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold text-slate-700 dark:text-slate-200">Catatan Pengumuman Akademik:</strong>{' '}
                    <span>{adminSettings.classNote}</span>
                  </div>
                </div>
              )}
            </section>

            {/* ============================================================
                4. PERINGATAN KELAS BEASISWA (Section 4)
               ============================================================ */}
            <div className="bg-red-50/70 dark:bg-red-950/20 border-l-4 border-red-600 p-4 rounded-r-xl flex items-start gap-3 text-xs sm:text-sm text-slate-800 dark:text-slate-200 shadow-xs">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <p>
                  <strong>Perhatian Akademik:</strong> {scholarshipAlertText}
                </p>
              </div>
            </div>

            {/* ============================================================
                5. TERAPKAN KELAS SEKALIGUS (Section 5)
               ============================================================ */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Terapkan Kelas:
                </span>

                <div className="flex flex-wrap items-center gap-1.5">
                  {globalClassOptions.map((cls) => {
                    const isScholarship = isClassRestrictedForRepeat(cls, selectedSemester === '5' ? 5 : 3, adminSettings);

                    return (
                      <button
                        key={cls}
                        type="button"
                        disabled={isScholarship}
                        onClick={() => {
                          if (!isScholarship) {
                            setBatchClassToApply(cls);
                            handleApplyBatchClass(cls);
                          }
                        }}
                        title={isScholarship ? 'Kelas Beasiswa tidak boleh dipilih' : `Terapkan ${cls} ke semua mata kuliah yang tercentang`}
                        className={`px-2.5 py-1 text-xs rounded-lg font-semibold transition-all cursor-pointer ${
                          isScholarship
                            ? 'line-through text-slate-400 bg-slate-100 dark:bg-slate-800/50 cursor-not-allowed opacity-60'
                            : batchClassToApply === cls
                            ? 'bg-[#166534] text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {cls}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Counter */}
              <div className="text-left md:text-right text-xs font-semibold text-slate-700 dark:text-slate-300 shrink-0">
                Terpilih: <strong className="text-[#166534] dark:text-emerald-400">{selectedList.length}</strong> mata kuliah (<strong className="text-[#166534] dark:text-emerald-400">{totalSks}</strong> SKS)
              </div>
            </div>

            {/* ============================================================
                6. LANGKAH 3: PILIH MATA KULIAH (Section 6)
               ============================================================ */}
            <section className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-[#166534] text-white flex items-center justify-center text-xs font-bold">3</span>
                    <span>Pilih Mata Kuliah yang Diulang</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 ml-8">
                    Centang mata kuliah yang ingin Anda daftarkan dan sesuaikan pilihan kelasnya.
                  </p>
                </div>

                {/* SKS Badge */}
                <div className={`self-start sm:self-auto px-3 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 ${
                  isOverSksLimit 
                    ? 'bg-red-100 text-red-600 border border-red-200' 
                    : 'bg-[#166534]/10 text-[#166534] dark:text-emerald-400 border border-[#166534]/20'
                }`}>
                  <span>{totalSks} SKS Terpilih</span>
                  <span className="text-slate-400">/</span>
                  <span>Maks {currentMaxSks} SKS</span>
                </div>
              </div>

              {/* Prodi Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setActiveProdiTab('agroteknologi')}
                  className={`flex-1 min-w-[140px] py-2 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                    activeProdiTab === 'agroteknologi'
                      ? 'bg-white dark:bg-slate-900 text-[#166534] dark:text-emerald-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Agroteknologi ({tabCounts.agroSelected}/{tabCounts.agroTotal})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveProdiTab('agribisnis')}
                  className={`flex-1 min-w-[140px] py-2 px-3 rounded-lg text-xs font-bold transition-all text-center cursor-pointer ${
                    activeProdiTab === 'agribisnis'
                      ? 'bg-white dark:bg-slate-900 text-[#166534] dark:text-emerald-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Agribisnis ({tabCounts.agriSelected}/{tabCounts.agriTotal})
                </button>

                <button
                  type="button"
                  onClick={() => setActiveProdiTab('all')}
                  className={`py-2 px-3.5 rounded-lg text-xs font-bold transition-all text-center cursor-pointer shrink-0 ${
                    activeProdiTab === 'all'
                      ? 'bg-white dark:bg-slate-900 text-[#166534] dark:text-emerald-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Semua ({tabCounts.allSelected}/{tabCounts.allTotal})
                </button>
              </div>

              {/* Search bar + Select all */}
              <div className="space-y-2 pt-1">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari matkul serupa (misal: tanah, agronomi, kimia, biologi)..."
                      className="w-full h-10 pl-10 pr-9 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#166534] shadow-2xs"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                        title="Hapus pencarian"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Tombol Pilih Semua (Dinonaktifkan jika semua matakuliah berstatus tutup) */}
                  {(() => {
                    const openCourses = filteredCourses.filter(c => !isCourseClosedCheck(c).isClosed);
                    const allVisibleClosed = filteredCourses.length > 0 && openCourses.length === 0;

                    return (
                      <label className={`inline-flex items-center gap-2 text-xs font-semibold select-none self-end sm:self-center shrink-0 ${
                        allVisibleClosed 
                          ? 'text-slate-400 dark:text-slate-500 cursor-not-allowed' 
                          : 'text-slate-700 dark:text-slate-300 cursor-pointer'
                      }`}>
                        <input
                          type="checkbox"
                          disabled={allVisibleClosed}
                          checked={areAllVisibleSelected}
                          onChange={handleToggleSelectAllVisible}
                          className={`w-4 h-4 rounded transition-all ${
                            allVisibleClosed 
                              ? 'text-slate-400 bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 cursor-not-allowed opacity-50' 
                              : 'text-[#166534] focus:ring-[#166534] border-slate-300 dark:border-slate-600 dark:bg-slate-800 cursor-pointer'
                          }`}
                        />
                        <span>
                          {allVisibleClosed 
                            ? `Pilih Semua Dinonaktifkan (Link Ditutup)` 
                            : `Pilih Semua yang Tampil (${openCourses.length}/${filteredCourses.length})`}
                        </span>
                      </label>
                    );
                  })()}
                </div>

                {searchQuery.trim() && (
                  <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/80 animate-fade-in">
                    <span className="font-bold">🔍 Live Search:</span>
                    <span>Ditemukan <strong>{filteredCourses.length}</strong> mata kuliah yang cocok dengan kata kunci "{searchQuery}"</span>
                  </div>
                )}
              </div>

              {/* Banner Peringatan Jika Link Pendaftaran Semester Sedang Ditutup */}
              {activePortalStatus.isOpen === false && (
                <div className="p-3.5 sm:p-4 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50/90 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 text-xs flex items-start gap-3 shadow-xs animate-fade-in">
                  <Ban className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-black text-sm mb-1 text-rose-800 dark:text-rose-200">
                      Link Pendaftaran Ditutup ({selectedSemester === 'all' ? 'Seluruh Semester' : `Semester ${selectedSemester}`})
                    </h4>
                    <p className="leading-relaxed">
                      {activePortalStatus.message || `Pendaftaran untuk ${selectedSemester === 'all' ? 'seluruh semester' : `Semester ${selectedSemester}`} saat ini sedang ditutup oleh pihak Fakultas Pertanian. Seluruh kotak centang pemilihan mata kuliah dinonaktifkan secara otomatis.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Course rows list */}
              <div className="space-y-2.5">
                {filteredCourses.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                    <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-xs text-slate-500 font-medium">
                      Tidak ada mata kuliah yang cocok dengan filter atau kata kunci.
                    </p>
                  </div>
                ) : (
                  filteredCourses.map((course) => {
                    const { isClosed: isCourseClosed, reason: closedReason } = isCourseClosedCheck(course);
                    const isChecked = !isCourseClosed && (courseSelections[course.id]?.checked || false);
                    const chosenClass = getSelectedClass(course);
                    const availableClasses = getAvailableClasses(course);

                    return (
                      <div
                        key={course.id}
                        className={`p-3.5 sm:p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isCourseClosed
                            ? 'bg-slate-100/70 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-60 cursor-not-allowed select-none'
                            : isChecked
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/25 border-[#15803D]/60 shadow-xs ring-1 ring-[#15803D]/20'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {/* Left: Checkbox + Course Name + SKS */}
                        <div 
                          className={`flex items-start gap-3 flex-1 min-w-0 select-none ${
                            isCourseClosed ? 'cursor-not-allowed' : 'cursor-pointer'
                          }`}
                          onClick={() => {
                            if (!isCourseClosed) {
                              handleToggleCourse(course);
                            }
                          }}
                        >
                          <input
                            type="checkbox"
                            disabled={isCourseClosed}
                            checked={isChecked}
                            onChange={() => {
                              if (!isCourseClosed) {
                                handleToggleCourse(course);
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className={`w-5 h-5 mt-0.5 rounded shrink-0 transition-all ${
                              isCourseClosed
                                ? 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-400 cursor-not-allowed opacity-50'
                                : 'text-[#166534] focus:ring-[#166534] border-slate-300 dark:border-slate-700 cursor-pointer'
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className={`text-xs sm:text-sm font-bold tracking-tight truncate ${
                                isCourseClosed
                                  ? 'text-slate-400 dark:text-slate-500 line-through'
                                  : isChecked 
                                  ? 'text-[#166534] dark:text-emerald-300' 
                                  : 'text-slate-700 dark:text-slate-300'
                              }`}>
                                {course.name}
                              </h3>
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                                {course.sks} SKS
                              </span>

                              {/* Badge Link Ditutup pada Mata Kuliah */}
                              {isCourseClosed && (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1 shrink-0" title={closedReason}>
                                  <Ban className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                                  <span>Link Ditutup (Sem {course.semester})</span>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                              <span className="font-mono text-[10px]">{course.id}</span>
                              <span>•</span>
                              <span className="capitalize">{course.prodi}</span>
                              <span>•</span>
                              <span>Semester {course.semester}</span>
                              {isCourseClosed && (
                                <>
                                  <span>•</span>
                                  <span className="text-rose-600 dark:text-rose-400 font-medium">{closedReason}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right: Class Dropdown */}
                        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-slate-100 dark:border-slate-800 shrink-0">
                          <span className="text-[11px] text-slate-400 font-medium">Kelas:</span>
                          <select
                            disabled={!isChecked || isCourseClosed}
                            value={chosenClass}
                            onChange={(e) => handleChangeClass(course.id, e.target.value)}
                            className={`flex-1 sm:flex-initial h-10 sm:h-9 px-3 rounded-xl sm:rounded-lg text-xs font-bold border transition-all ${
                              !isChecked || isCourseClosed
                                ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-60'
                                : 'bg-white dark:bg-slate-800 text-[#166534] dark:text-emerald-400 border-[#15803D]/40 shadow-xs focus:ring-2 focus:ring-[#166534] cursor-pointer'
                            }`}
                          >
                            {availableClasses.map((cls) => {
                              const isScholarship = isClassRestrictedForRepeat(cls, course.semester, adminSettings);
                              return (
                                <option 
                                  key={cls} 
                                  value={cls} 
                                  disabled={isScholarship}
                                >
                                  {cls} {isScholarship ? '(Beasiswa - Dilarang)' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                      </div>
                    );
                  })
                )}
              </div>

            </section>

            {/* ============================================================
                7. KONFIRMASI ALUR PENDAFTARAN & PENYERAHAN KE LOKET
               ============================================================ */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <h3 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#166534] dark:text-emerald-400" />
                <span>Pernyataan &amp; Komitmen Alur Pendaftaran Mahasiswa</span>
              </h3>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeToFlow}
                    onChange={(e) => setAgreeToFlow(e.target.checked)}
                    className="w-5 h-5 mt-0.5 rounded text-[#166534] focus:ring-[#166534] border-slate-300 dark:border-slate-600 dark:bg-slate-800 cursor-pointer shrink-0"
                  />
                  <span>
                    Saya menyatakan data mata kuliah yang saya pilih sudah benar dan saya memahami bahwa <strong>setelah formulir ini terkirim</strong>, saya wajib <strong>mencetak KRS Mengulang (A4)</strong> dan menyerahkannya langsung ke <strong>Administrasi Fakultas Pertanian INSTIPER</strong> {isPaidBatch ? 'disertai bukti fisik setoran/transfer pembayaran per SKS' : '(bebas biaya SKS mengulang)'}.
                  </span>
                </label>
              </div>
            </div>

            {/* Global Submission Error if any */}
            {submissionError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submissionError}</span>
              </div>
            )}

          </form>

        </div>

        {/* ============================================================
            RIGHT COLUMN (Desktop Sticky Live Summary Card)
            Menyajikan live status kapasitas SKS, list ringkas MK, estimasi
            biaya, dan tombol submit yang tidak menutupi konten formulir.
           ============================================================ */}
        <aside className="hidden lg:block lg:col-span-4 sticky top-24 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-md p-5 space-y-5">
            
            {/* Header: Ringkasan with INSTIPER Green & Janur Kuning badge */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#166534] text-white flex items-center justify-center font-bold shadow-xs">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Ringkasan Pendaftaran</h3>
                  <p className="text-[11px] text-slate-400">Live Status &amp; Validasi</p>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-[#EAB308]/20 text-[#CA8A04] dark:text-[#EAB308] border border-[#EAB308]/40">
                INSTIPER
              </span>
            </div>

            {/* SKS Meter Card */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-600 dark:text-slate-400">Kapasitas SKS</span>
                <span className={`font-mono text-sm ${isOverSksLimit ? 'text-red-600 font-extrabold' : 'text-[#166534] dark:text-emerald-400 font-extrabold'}`}>
                  {totalSks} <span className="text-xs text-slate-400 font-normal">/ {currentMaxSks} SKS</span>
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    isOverSksLimit
                      ? 'bg-red-500'
                      : totalSks === currentMaxSks
                      ? 'bg-[#EAB308]'
                      : 'bg-[#166534]'
                  }`}
                  style={{ width: `${Math.min(100, (totalSks / (currentMaxSks || 24)) * 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-0.5">
                <span>Angkatan {angkatan}</span>
                <span className={isOverSksLimit ? 'text-red-600 font-bold' : ''}>
                  {currentMaxSks - totalSks >= 0 
                    ? `Sisa kuota: ${currentMaxSks - totalSks} SKS` 
                    : `⚠️ Melebihi ${totalSks - currentMaxSks} SKS!`
                  }
                </span>
              </div>
            </div>

            {/* Selected Courses List (Compact view) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span>Mata Kuliah Terpilih</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-[#166534] dark:text-emerald-300 font-bold text-[10px]">
                  {selectedList.length} Mata Kuliah
                </span>
              </div>

              {selectedList.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                  Belum ada mata kuliah yang dicentang.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 text-xs">
                  {selectedList.map(c => (
                    <div key={c.id} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{c.name}</p>
                        <p className="text-[10px] text-slate-400">{getSelectedClass(c)} • Sem {c.semester}</p>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-[#166534] dark:text-emerald-400 font-bold font-mono text-[10px] shrink-0">
                        {c.sks} SKS
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fee Calculation Summary */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-1 text-xs">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Biaya per SKS</span>
                <span className="font-mono">{isPaidBatch ? `Rp ${costPerSks.toLocaleString('id-ID')}` : 'Rp 0'}</span>
              </div>
              <div className="flex items-center justify-between text-sm font-bold text-slate-900 dark:text-white pt-1.5 border-t border-slate-200 dark:border-slate-700">
                <span>Estimasi Biaya</span>
                <span className={isPaidBatch ? 'text-[#CA8A04] dark:text-[#EAB308]' : 'text-[#166534] dark:text-emerald-400'}>
                  {isPaidBatch ? `Rp ${totalBiaya.toLocaleString('id-ID')}` : 'Bebas Biaya (Rp 0)'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 pt-0.5">
                {isPaidBatch 
                  ? '*Wajib menyertakan slip setoran/transfer fisik ke loket FP' 
                  : '*Angkatan 2023 ke atas tidak dipungut biaya SKS'}
              </p>
            </div>

            {/* Primary Action Button (Desktop Sidebar) */}
            <div>
              <button
                type="submit"
                form="registration-form"
                disabled={!canSubmit}
                title={getSubmitDisabledReason() || 'Kirim Formulir Pendaftaran Mengulang'}
                className="w-full h-12 rounded-xl bg-[#166534] hover:bg-[#14532D] text-white font-extrabold text-sm shadow-md disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <Send className="w-4 h-4" />
                <span>Kirim Pendaftaran</span>
              </button>

              {getSubmitDisabledReason() && (
                <div className="mt-2.5 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                  ℹ️ {getSubmitDisabledReason()}
                </div>
              )}
            </div>

            {/* Trust badge */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 text-center">
              Fakultas Pertanian INSTIPER Yogyakarta
            </div>
          </div>
        </aside>

      </div>

      {/* ============================================================
          8. MOBILE STICKY BOTTOM BAR (Tampil hanya pada < lg)
         ============================================================ */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 shadow-xl px-3 sm:px-4 py-3 sm:py-3.5 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-6">
          
          {/* Left stats & Progress bar */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedList.length} Mata Kuliah
                </span>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <span className={`font-mono font-bold ${isOverSksLimit ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>
                  {totalSks} / {currentMaxSks} SKS
                </span>
              </div>

              <div className="text-xs">
                <span className="text-slate-400">Estimasi Biaya: </span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {isPaidBatch 
                    ? `Rp ${totalBiaya.toLocaleString('id-ID')}` 
                    : <span className="text-[#166534] dark:text-emerald-400">Bebas Biaya</span>
                  }
                </span>
              </div>
            </div>

            {/* SKS progress bar */}
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div
                className={`h-full transition-all duration-300 ${
                  isOverSksLimit 
                    ? 'bg-red-500' 
                    : totalSks === currentMaxSks
                    ? 'bg-[#EAB308]'
                    : 'bg-[#166534]'
                }`}
                style={{ width: `${Math.min(100, (totalSks / (currentMaxSks || 24)) * 100)}%` }}
              />
            </div>
          </div>

          {/* Right: Submit Button & Mobile disabled hint */}
          <div className="shrink-0 flex flex-col items-stretch sm:items-end gap-1 w-full sm:w-auto">
            <button
              type="submit"
              form="registration-form"
              disabled={!canSubmit}
              title={getSubmitDisabledReason() || 'Kirim Formulir Pendaftaran Mengulang'}
              className="w-full sm:w-auto h-12 sm:h-11 px-6 rounded-xl bg-[#166534] hover:bg-[#14532D] text-white font-extrabold text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
            >
              <Send className="w-4 h-4" />
              <span>Kirim Pendaftaran</span>
            </button>
            {getSubmitDisabledReason() && (
              <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold text-center sm:text-right truncate max-w-xs sm:max-w-sm">
                ℹ️ {getSubmitDisabledReason()}
              </p>
            )}
          </div>

        </div>
      </div>

    </div>
  );
};

