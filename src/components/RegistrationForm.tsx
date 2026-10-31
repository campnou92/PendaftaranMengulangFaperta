import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  CourseItem, 
  SelectedCourseItem, 
  SimpleRegistration, 
  AdminSettings, 
  RegistrationPeriod,
  getMaxSksForBatch, 
  getSemesterStatus, 
  formatDateTimeId,
  isClassRestrictedForRepeat, 
  getRestrictedClassesForSemester
} from '../types';
import { ANGKATAN_OPTIONS, DEFAULT_CLASSES, DEFAULT_REGISTRATION_FLOW } from '../data/courses';
import { 
  AlertCircle, 
  CheckCircle2, 
  Search, 
  BookOpen, 
  FileText, 
  Info,
  Clock,
  Send,
  Ban,
  Printer,
  CreditCard,
  Building2,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  X,
  Loader2
} from 'lucide-react';
import { checkNimIsRegistered } from '../lib/firebase';
import { renderFormattedNote } from '../utils/textFormatting';

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
  // 1. Tahun Ajaran & Semester Aktif (Sinkron dengan Periode Pendaftaran Terbuka)
  const activeAcademicYear = adminSettings.activeAcademicYear || '2025/2026';
  const activeTerm = adminSettings.activeTerm || 'Ganjil';

  // Ambil seluruh periode pendaftaran yang ditentukan Admin: hanya yang showOnMainForm !== false dan isOpen !== false
  const openVisiblePeriods = useMemo(() => {
    const allPeriods: RegistrationPeriod[] = adminSettings.registrationPeriods || [];
    return allPeriods.filter(p => p.showOnMainForm !== false && p.isOpen !== false);
  }, [adminSettings.registrationPeriods]);

  // Ekstrak secara dinamis semester apa saja yang diaktifkan Admin untuk tampil di halaman utama
  const activeSemesters = useMemo(() => {
    const semSet = new Set<number>();
    
    // Prioritas 1: Dari openVisiblePeriods (hanya semester yang dibuka & diset tampil oleh admin)
    openVisiblePeriods.forEach((p) => {
      const semNum = Number(p.semester);
      if (!isNaN(semNum) && semNum > 0) {
        semSet.add(semNum);
      }
    });

    // Fallback awal jika belum ada periode pendaftaran aktif:
    if (semSet.size === 0) {
      const activeCourses = courses.filter(c => !c.academicYear || c.academicYear === activeAcademicYear);
      const targetCourses = activeCourses.length > 0 ? activeCourses : courses;
      targetCourses.forEach((c) => {
        const semNum = Number(c.semester);
        if (!isNaN(semNum) && semNum > 0) {
          semSet.add(semNum);
        }
      });
    }

    return Array.from(semSet).sort((a, b) => a - b);
  }, [openVisiblePeriods, courses, activeAcademicYear]);

  // Helper mencari record periode pendaftaran yang cocok untuk suatu semester
  const findPeriodForSemester = useCallback((semNum: number | string | undefined | null): RegistrationPeriod | undefined => {
    if (!semNum) return undefined;
    const targetSem = Number(semNum);
    return openVisiblePeriods.find(p => Number(p.semester) === targetSem) 
      || (adminSettings.registrationPeriods || []).find(p => Number(p.semester) === targetSem && (!p.academicYear || p.academicYear === activeAcademicYear));
  }, [openVisiblePeriods, adminSettings.registrationPeriods, activeAcademicYear]);

  // Helper mencari record periode pendaftaran yang cocok untuk suatu mata kuliah
  const findPeriodForCourse = useCallback((course: CourseItem): RegistrationPeriod | undefined => {
    if (course.periodId) {
      const byId = (adminSettings.registrationPeriods || []).find(p => p.id === course.periodId);
      if (byId) return byId;
    }
    return findPeriodForSemester(course.semester);
  }, [adminSettings.registrationPeriods, findPeriodForSemester]);

  // Ambil mata kuliah aktif: utamakan courses dari tiap periode yang dibuka dan tampil di halaman utama
  const activeYearCourses = useMemo(() => {
    const courseMap = new Map<string, CourseItem>();

    if (openVisiblePeriods.length > 0) {
      openVisiblePeriods.forEach((period) => {
        // Jika periode memiliki daftar mata kuliah mandiri (per record semester & TA)
        if (Array.isArray(period.courses) && period.courses.length > 0) {
          period.courses.forEach((c) => {
            courseMap.set(c.id, {
              ...c,
              periodId: period.id,
              academicYear: period.academicYear || activeAcademicYear,
              semester: period.semester
            });
          });
        } else {
          // Ambil dari courses global yang cocok dengan semester dan TA periode ini
          let matched = courses.filter((c) => {
            if (c.periodId && c.periodId === period.id) return true;
            const sameSem = Number(c.semester) === Number(period.semester);
            const sameYear = !c.academicYear || c.academicYear === period.academicYear;
            const isOffered = !Array.isArray(period.offeredCourseIds) || period.offeredCourseIds.length === 0 || period.offeredCourseIds.includes(c.id);
            return sameSem && sameYear && isOffered;
          });
          // Fallback jika tidak ada course spesifik TA tertentu: gunakan matakuliah master semester tersebut
          if (matched.length === 0) {
            matched = courses.filter((c) => Number(c.semester) === Number(period.semester));
          }
          matched.forEach((c) => courseMap.set(c.id, { ...c, academicYear: period.academicYear || c.academicYear }));
        }
      });
      return Array.from(courseMap.values());
    }

    // Jika belum ada periode sama sekali, tampilkan courses sesuai TA aktif (fallback ke semua courses jika kosong)
    const activeList = courses.filter((c) => !c.academicYear || c.academicYear === activeAcademicYear);
    return activeList.length > 0 ? activeList : courses;
  }, [openVisiblePeriods, courses, activeAcademicYear]);

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

  // 5. Prodi Tab: 'agroteknologi' | 'agribisnis' | 'all'
  const [activeProdiTab, setActiveProdiTab] = useState<'agroteknologi' | 'agribisnis' | 'all'>('agroteknologi');
  const [searchQuery, setSearchQuery] = useState('');

  // Layout Controls: SKS Filter & Sort Order
  const [sksFilter, setSksFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'default' | 'sks-desc' | 'name-asc'>('default');

  // 6. Agreement check / acknowledgment
  const [agreeToFlow, setAgreeToFlow] = useState(true);

  // Mobile Guide Collapsible State
  const [isMobileGuideOpen, setIsMobileGuideOpen] = useState(false);

  // Alur Pendaftaran Settings (Dinamis dari Admin Settings)
  const currentFlowSettings = useMemo(() => {
    const custom = adminSettings.registrationFlow;
    return {
      title: custom?.title || DEFAULT_REGISTRATION_FLOW.title || 'Alur Resmi Pendaftaran Mengulang',
      subtitle: custom?.subtitle || DEFAULT_REGISTRATION_FLOW.subtitle || 'Fakultas Pertanian — Wajib Dipahami Seluruh Mahasiswa',
      steps: custom?.steps && custom.steps.length > 0 ? custom.steps : (DEFAULT_REGISTRATION_FLOW.steps || []),
      highlightNote: custom?.highlightNote || DEFAULT_REGISTRATION_FLOW.highlightNote || 'Pendaftaran Anda dinyatakan sah dan aktif setelah lembar cetak fisik diverifikasi dan ditandatangani oleh Admin Fakultas Pertanian INSTIPER.',
      commitmentText: custom?.commitmentText || DEFAULT_REGISTRATION_FLOW.commitmentText
    };
  }, [adminSettings.registrationFlow]);

  // Form submission feedback
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Helper untuk menghitung sisa waktu & status penutupan link berdasarkan semester
  const calculateTimeLeft = () => {
    const now = new Date();

    // 1. Jika pengguna memilih semester tertentu (misal Semester 1, Semester 3 atau Semester 5)
    if (selectedSemester !== 'all') {
      const semNum = Number(selectedSemester);
      const semStatus = !isNaN(semNum) 
        ? getSemesterStatus(semNum, adminSettings, activeAcademicYear) 
        : { isOpen: true, state: 'open' as const, message: 'Sesuai Jadwal Akademik', label: 'DIBUKA', badgeClass: '' };
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
      const endDateStr = semStatus.period?.endDate || semStatus.endDate || schedule?.endDate || '2026-11-30T23:59:59';
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
    if (activeSemesters.length === 0) {
      return {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isClosed: true,
        statusLabel: 'Pendaftaran Belum Dibuka',
        detailMessage: 'Saat ini belum ada periode pendaftaran mengulang yang dibuka atau diaktifkan oleh Fakultas Pertanian.',
        semesterLabel: 'Semua Semester',
        targetDateFormatted: '-'
      };
    }

    const semKeys = activeSemesters.map(String);
    const statuses = semKeys.map(k => {
      const p = findPeriodForSemester(k);
      return {
        semKey: k,
        status: getSemesterStatus(k, adminSettings, activeAcademicYear),
        schedule: adminSettings.semesterSchedules?.[k],
        period: p
      };
    });

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

    for (const item of openStatuses) {
      const endStr = item.period?.endDate || item.status.endDate || item.schedule?.endDate || '2026-11-30T23:59:59';
      const d = new Date(endStr);
      const validD = isNaN(d.getTime()) ? new Date('2026-11-30T23:59:59') : d;
      if (!minTargetDate || validD.getTime() < minTargetDate.getTime()) {
        minTargetDate = validD;
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

  // Helper untuk generate tanggal pendaftaran saat submit (bukan saat mount)
  const generateRegistrationDate = () => {
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
  };

  // Seluruh kelas yang ada di database sistem & yang di-import
  const globalClassOptions = useMemo(() => {
    const classSet = new Set<string>();

    // 1. Dari opsi kelas admin di settings database (classOptions)
    if (Array.isArray(adminSettings.classOptions) && adminSettings.classOptions.length > 0) {
      adminSettings.classOptions.forEach((c) => {
        if (c && typeof c === 'string' && c.trim()) classSet.add(c.trim());
      });
    }

    // 2. Dari seluruh mata kuliah di sistem / hasil import
    (courses || []).forEach((c) => {
      if (Array.isArray(c.availableClasses)) {
        c.availableClasses.forEach((cls) => {
          if (cls && typeof cls === 'string' && cls.trim()) classSet.add(cls.trim());
        });
      }
    });

    // 3. Dari periode pendaftaran aktif (jika ada courses mandiri per periode)
    (adminSettings.registrationPeriods || []).forEach((p) => {
      if (Array.isArray(p.courses)) {
        p.courses.forEach((c) => {
          if (Array.isArray(c.availableClasses)) {
            c.availableClasses.forEach((cls) => {
              if (cls && typeof cls === 'string' && cls.trim()) classSet.add(cls.trim());
            });
          }
        });
      }
    });

    if (classSet.size === 0) {
      DEFAULT_CLASSES.forEach((c) => classSet.add(c));
    }

    return Array.from(classSet);
  }, [adminSettings.classOptions, adminSettings.registrationPeriods, courses]);

  // Contoh penulisan kelas diambil secara dinamis dari referensi kelas nyata di database sistem / hasil import
  const dynamicKelasAsalPlaceholder = useMemo(() => {
    // Ambil kelas reguler nyata (abaikan kelas bertanda beasiswa untuk contoh kelas asal reguler)
    const regularClasses = globalClassOptions.filter(c => !c.toLowerCase().includes('beasiswa'));
    const pool = regularClasses.length > 0 ? regularClasses : globalClassOptions;

    // Ambil 2 contoh representatif dari database sistem / hasil import
    const samples = pool.slice(0, 2);

    if (samples.length >= 2) {
      return `Contoh: ${samples[0]}, ${samples[1]} (atau pilih opsi kelas di bawah)`;
    } else if (samples.length === 1) {
      return `Contoh: ${samples[0]} (atau pilih opsi kelas di bawah)`;
    }

    return 'Contoh: SPKS A, SPKS B (atau pilih opsi kelas di bawah)';
  }, [globalClassOptions]);

  const kelasAsalPlaceholderText = useMemo(() => {
    // Jika admin mengonfigurasi teks kustom yang bukan default lama 'Kelas A'
    if (adminSettings.kelasAsalPlaceholder && !adminSettings.kelasAsalPlaceholder.includes('Kelas A')) {
      return adminSettings.kelasAsalPlaceholder;
    }
    return dynamicKelasAsalPlaceholder;
  }, [adminSettings.kelasAsalPlaceholder, dynamicKelasAsalPlaceholder]);

  // Helper available classes for course
  const getAvailableClasses = (course: CourseItem): string[] => {
    if (course.availableClasses && Array.isArray(course.availableClasses) && course.availableClasses.length > 0) {
      return course.availableClasses;
    }
    return globalClassOptions;
  };

  const getDefaultClass = (courseId: string): string => {
    const course = activeYearCourses.find(c => c.id === courseId) || courses.find(c => c.id === courseId);
    if (course) {
      const period = findPeriodForCourse(course);
      const available = getAvailableClasses(course);
      const allowed = available.filter(cls => !isClassRestrictedForRepeat(cls, course.semester, adminSettings, period, course));
      return allowed[0] || available[0] || 'Kelas A';
    }
    return globalClassOptions[0] || 'Kelas A';
  };

  const getSelectedClass = (course: CourseItem): string => {
    const period = findPeriodForCourse(course);
    const available = getAvailableClasses(course);
    const chosen = courseSelections[course.id]?.selectedClass;
    if (chosen && available.includes(chosen) && !isClassRestrictedForRepeat(chosen, course.semester, adminSettings, period, course)) {
      return chosen;
    }
    const allowed = available.filter(cls => !isClassRestrictedForRepeat(cls, course.semester, adminSettings, period, course));
    return allowed[0] || available[0] || 'Kelas A';
  };

  // Check duplicate registration by NIM (hanya jika pendaftaran aktif / belum ditolak pada Tahun Ajaran yang sama)
  const localDuplicate = useMemo(() => {
    if (!nim.trim()) return null;
    const cleanNim = nim.toLowerCase().trim();
    return existingRegistrations.find(
      (r) => r.nim.toLowerCase().trim() === cleanNim && 
        r.status !== 'rejected' && 
        (!r.academicYear || r.academicYear === activeAcademicYear)
    );
  }, [nim, existingRegistrations, activeAcademicYear]);

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
      checkNimIsRegistered(clean, activeAcademicYear).then((res) => {
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
  }, [nim, localDuplicate, activeAcademicYear]);

  const duplicateRegistration = localDuplicate || cloudDuplicate;

  // Mahasiswa yang pendaftarannya ditolak diberi izin mendaftar ulang perbaikan
  const previousRejectedRegistration = useMemo(() => {
    if (!nim.trim()) return null;
    return existingRegistrations.find(
      (r) => r.nim.toLowerCase().trim() === nim.toLowerCase().trim() && r.status === 'rejected'
    );
  }, [nim, existingRegistrations]);

  // Filter courses based on activeYearCourses, dynamic semester, prodi tab & smart similar search
  const filteredCourses = useMemo(() => {
    const list = activeYearCourses.filter((c) => {
      // 1. Filter Semester
      if (selectedSemester !== 'all' && String(c.semester) !== selectedSemester) {
        return false;
      }

      // 2. Filter Prodi Tab
      if (activeProdiTab !== 'all' && c.prodi !== activeProdiTab) return false;

      // 3. Filter Beban SKS
      if (sksFilter !== 'all' && String(c.sks) !== sksFilter) return false;

      // 4. Smart Similar / Flexible Live Search
      if (searchQuery.trim()) {
        const cleanQuery = searchQuery.toLowerCase().trim();
        const queryWords = cleanQuery.split(/\s+/).filter(Boolean);
        const targetText = `${c.name} ${c.id} ${c.prodi} ${c.semester ? `semester ${c.semester}` : ''}`.toLowerCase();
        const isMatch = queryWords.every((word) => targetText.includes(word));
        if (!isMatch) return false;
      }

      return true;
    });

    if (sortOrder === 'sks-desc') {
      return [...list].sort((a, b) => b.sks - a.sks);
    }
    if (sortOrder === 'name-asc') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [activeYearCourses, selectedSemester, activeProdiTab, sksFilter, sortOrder, searchQuery]);

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

  // Menentukan periode pendaftaran aktif berdasarkan pilihan semester atau mata kuliah yang dipilih
  const currentActivePeriod = useMemo(() => {
    if (selectedSemester !== 'all') {
      return findPeriodForSemester(selectedSemester);
    }
    if (selectedList.length > 0) {
      const firstPeriod = findPeriodForCourse(selectedList[0]);
      if (firstPeriod) return firstPeriod;
    }
    return openVisiblePeriods[0];
  }, [selectedSemester, findPeriodForSemester, selectedList, findPeriodForCourse, openVisiblePeriods]);

  // Max SKS for selected Angkatan (Mendukung override per-periode semester)
  const currentMaxSks = useMemo(() => {
    return getMaxSksForBatch(angkatan, adminSettings, currentActivePeriod);
  }, [angkatan, adminSettings, currentActivePeriod]);

  // Fee calculation per SKS (Mendukung override per-periode semester)
  const isFeeSystemActive = currentActivePeriod?.feePerSksEnabled !== undefined 
    ? currentActivePeriod.feePerSksEnabled 
    : (adminSettings.feePerSksEnabled ?? true);
  const paidBatches = currentActivePeriod?.paidBatches ?? adminSettings.paidBatches ?? ['2020', '2021', '2022'];
  const costPerSks = currentActivePeriod?.costPerSks ?? adminSettings.costPerSks ?? 50000;
  const isPaidBatch = isFeeSystemActive && paidBatches.includes(angkatan);

  // Total Biaya Pendaftaran Mengulang (Mendukung perhitungan akurat per periode semester)
  const totalBiaya = useMemo(() => {
    return selectedList.reduce((acc, c) => {
      const p = findPeriodForCourse(c);
      const feeActive = p?.feePerSksEnabled !== undefined ? p.feePerSksEnabled : isFeeSystemActive;
      const pBatches = p?.paidBatches ?? paidBatches;
      const cRate = p?.costPerSks ?? costPerSks;
      const applies = feeActive && pBatches.includes(angkatan);
      return acc + (applies ? c.sks * cRate : 0);
    }, 0);
  }, [selectedList, findPeriodForCourse, isFeeSystemActive, paidBatches, costPerSks, angkatan]);

  const isOverSksLimit = totalSks > currentMaxSks;

  // Helper: Cek apakah suatu mata kuliah berada di semester yang pendaftarannya sedang ditutup
  const isCourseClosedCheck = (course: CourseItem): { isClosed: boolean; reason: string } => {
    // 1. Cek langsung record periode dari mata kuliah ini jika ada
    const period = findPeriodForCourse(course);
    if (period) {
      if (period.isOpen === false) {
        return {
          isClosed: true,
          reason: period.closedMessage || `Pendaftaran Semester ${course.semester} (T.A. ${period.academicYear}) ditutup oleh Fakultas.`
        };
      }
      if (period.useSchedule) {
        const now = new Date();
        const start = period.startDate ? new Date(period.startDate) : null;
        const end = period.endDate ? new Date(period.endDate) : null;
        if (start && !isNaN(start.getTime()) && now < start) {
          return { isClosed: true, reason: `Pendaftaran Semester ${course.semester} belum dibuka (Jadwal: ${formatDateTimeId(period.startDate)}).` };
        }
        if (end && !isNaN(end.getTime()) && now > end) {
          return { isClosed: true, reason: period.closedMessage || `Pendaftaran Semester ${course.semester} telah berakhir (${formatDateTimeId(period.endDate)}).` };
        }
      }
    }

    // 2. Jika portal semester yang dipilih secara global saat ini ditutup
    if (selectedSemester !== 'all') {
      const semStatus = getSemesterStatus(selectedSemester, adminSettings, activeAcademicYear);
      if (!semStatus.isOpen) {
        return {
          isClosed: true,
          reason: semStatus.message || `Pendaftaran Semester ${selectedSemester} ditutup.`
        };
      }
    }

    // 3. Fallback cek status spesifik semester mata kuliah tersebut
    if (typeof course.semester === 'number') {
      const semStatus = getSemesterStatus(course.semester, adminSettings, activeAcademicYear);
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
  }, [adminSettings.semesterSchedules, adminSettings.registrationPeriods, selectedSemester, activeAcademicYear]);

  // Toggle single course selection (with support for explicit boolean target)
  const handleToggleCourse = (course: CourseItem, forceChecked?: boolean) => {
    const { isClosed } = isCourseClosedCheck(course);
    if (isClosed) return; // Kotak centang nonaktif ketika link ditutup

    setCourseSelections((prev) => {
      const current = prev[course.id];
      const isCurrentlyChecked = current?.checked || false;
      const willBeChecked = typeof forceChecked === 'boolean' ? forceChecked : !isCurrentlyChecked;

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
        isOpen: activeSemesters.length > 0 && activePortalStatus.isOpen,
        scheduleText: activeSemesters.length > 0 ? 'Sesuai Jadwal Akademik' : 'Belum Ada Semester Dibuka'
      };
    }
    const semNumber = Number(sem);
    const status = !isNaN(semNumber) 
      ? getSemesterStatus(semNumber, adminSettings, activeAcademicYear) 
      : { isOpen: true, message: 'Sesuai Jadwal Akademik' };
    const count = activeYearCourses.filter((c) => Number(c.semester) === semNumber).length;

    return {
      title: `Semester ${semNumber}`,
      courseCount: `${count} Mata Kuliah Tersedia`,
      isOpen: status.isOpen,
      scheduleText: status.message
    };
  };

  // Ringkasan peringatan kelas beasiswa
  const scholarshipAlertText = useMemo(() => {
    const parts: string[] = [];
    activeSemesters.forEach((sem) => {
      const p = findPeriodForSemester(sem);
      const restricted = getRestrictedClassesForSemester(sem, adminSettings, p);
      if (restricted.length > 0) {
        parts.push(`Semester ${sem}: ${restricted.join(', ')}`);
      }
    });

    if (parts.length > 0) {
      return `Kelas Beasiswa (${parts.join('; ')}) hanya diperuntukkan bagi mahasiswa penerima beasiswa baru dan dilarang dipilih untuk mengulang. Pilihlah Kelas Reguler (A/B/C/D) atau Karyawan.`;
    }
    return `Kelas Beasiswa dikhususkan untuk penerima beasiswa baru dan tidak diperkenankan untuk mengulang mata kuliah. Silakan pilih kelas reguler yang tersedia.`;
  }, [activeSemesters, adminSettings, findPeriodForSemester]);

  // Status jadwal pembukaan portal semester (dinamis untuk semua semester aktif)
  const activePortalStatus = useMemo(() => {
    if (activeSemesters.length === 0) {
      return {
        isOpen: false,
        message: 'Saat ini belum ada periode pendaftaran mengulang yang dibuka atau diaktifkan oleh pihak Fakultas.'
      };
    }
    if (selectedSemester !== 'all') {
      const semNum = Number(selectedSemester);
      if (!isNaN(semNum)) {
        return getSemesterStatus(semNum, adminSettings, activeAcademicYear);
      }
    }
    const statuses = activeSemesters.map(s => getSemesterStatus(s, adminSettings, activeAcademicYear));
    const anyOpen = statuses.some(s => s.isOpen);
    return {
      isOpen: anyOpen,
      message: anyOpen ? 'Portal Gabungan Pendaftaran Mengulang' : 'Seluruh jadwal pendaftaran semester saat ini ditutup'
    };
  }, [selectedSemester, activeSemesters, adminSettings, activeAcademicYear]);

  // Cek apakah ada matakuliah yang dipilih berada di semester yang sedang ditutup
  const closedCourseSelected = useMemo(() => {
    return selectedList.find(c => isCourseClosedCheck(c).isClosed);
  }, [selectedList, isCourseClosedCheck]);

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

    const targetPeriod = selectedList.length > 0 ? findPeriodForCourse(selectedList[0]) : currentActivePeriod;
    const finalAcademicYear = targetPeriod?.academicYear || activeAcademicYear;

    // Build final selected courses
    const finalSelectedCourses: SelectedCourseItem[] = selectedList.map((c) => {
      const cPeriod = findPeriodForCourse(c);
      return {
        courseId: c.id,
        name: c.name,
        sks: c.sks,
        prodi: c.prodi,
        semester: c.semester,
        selectedClass: getSelectedClass(c),
        academicYear: c.academicYear || cPeriod?.academicYear || finalAcademicYear,
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
      registrationDate: generateRegistrationDate(), // Generate SAAT submit, bukan saat mount
      academicYear: finalAcademicYear,
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
          1. PAGE HERO & LIVE STATUS (Section 1)
          Judul ringkas & informatif tanpa logo dobel dengan Header
         ============================================================ */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-200/80 dark:border-slate-800/80">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-tight">
              Formulir Pendaftaran Mengulang
            </h1>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>T.A. {activeAcademicYear} • {activeTerm}</span>
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium leading-relaxed max-w-2xl">
            Lengkapi data mahasiswa, pilih mata kuliah yang ingin diulang, dan cetak bukti pendaftaran untuk validasi ke loket Fakultas Pertanian.
          </p>
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
      </div>

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
                    {currentFlowSettings.title}
                  </h2>
                  <p className="text-[11px] sm:text-xs text-[#166534] dark:text-emerald-400 font-semibold">
                    {currentFlowSettings.subtitle}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-[10px] sm:text-[11px] font-bold px-2.5 py-0.5 sm:py-1 rounded-full bg-[#166534]/10 text-[#166534] dark:text-emerald-300 border border-[#166534]/20">
                  {currentFlowSettings.steps.length} Langkah Prosedur
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
              {currentFlowSettings.steps.map((st, i) => (
                <React.Fragment key={st.step || i}>
                  <span className={st.step === 3 ? 'text-[#CA8A04]' : 'text-[#166534] dark:text-emerald-400'}>
                    {st.step}. {st.title.split(' ')[0]}
                  </span>
                  {i < currentFlowSettings.steps.length - 1 && (
                    <span className="text-slate-300 dark:text-slate-700">➔</span>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* 4 Cards Alur - Unified INSTIPER Academic Style (Responsif HP & Desktop) */}
            <div className={`${isMobileGuideOpen ? 'grid' : 'hidden'} sm:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3`}>
              {currentFlowSettings.steps.map((st, sIdx) => {
                const isStep3 = st.step === 3;
                return (
                  <div key={st.step || sIdx} className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`w-6 h-6 rounded-full text-white flex items-center justify-center text-xs font-black shadow-2xs ${isStep3 ? 'bg-[#CA8A04]' : 'bg-[#166534]'}`}>
                          {st.step}
                        </span>
                        {st.tag && (
                          <span className={`text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded border ${
                            isStep3
                              ? 'text-amber-800 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800'
                              : 'text-[#166534] dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800'
                          }`}>
                            {st.tag}
                          </span>
                        )}
                      </div>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                        {st.title}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {st.desc}
                      </p>
                    </div>
                    <div className={`mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] font-semibold ${isStep3 ? 'text-[#CA8A04]' : 'text-[#166534] dark:text-emerald-400'}`}>
                      ✓ {st.tag ? `Prosedur ${st.tag}` : `Langkah ${st.step}`}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Highlight Note */}
            <div className={`${isMobileGuideOpen ? 'flex' : 'hidden sm:flex'} p-3 bg-emerald-100/70 dark:bg-emerald-950/60 rounded-xl items-center gap-2.5 text-xs text-emerald-950 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800`}>
              <Info className="w-4 h-4 text-[#166534] dark:text-emerald-400 shrink-0" />
              <span>
                <strong>Penting:</strong> {currentFlowSettings.highlightNote}
              </span>
            </div>
          </div>

          <form id="registration-form" onSubmit={handleSubmitForm} className="space-y-6 sm:space-y-8">
            
            {/* ============================================================
                2. POINT 1: DATA MAHASISWA & KELAS ASAL (Section 2 - Alur Pertama)
               ============================================================ */}
            <section className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl p-5 sm:p-7 border border-slate-200/90 dark:border-slate-700/80 shadow-xl shadow-slate-200/40 dark:shadow-black/50 ring-1 ring-black/[0.04] dark:ring-white/[0.05] relative overflow-hidden transition-all duration-200 hover:shadow-2xl">
              {/* Top Accent Gradient Line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-600 via-amber-400 to-emerald-600" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-800 to-slate-950 text-white flex items-center justify-center font-black text-sm shadow-md ring-2 ring-emerald-500/30 shrink-0">
                    01
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/80">
                        Point 1
                      </span>
                      <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                        Data Mahasiswa &amp; Kelas Asal
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Isi data identitas diri yang valid sesuai KTM dan Kartu Rencana Studi resmi.
                    </p>
                  </div>
                </div>
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
                          placeholder={kelasAsalPlaceholderText}
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
            </section>

            {/* ============================================================
                PENGARAH ALUR: POINT 1 ➔ POINT 2 (Directional Flow Indicator)
               ============================================================ */}
            <div className="flex flex-col items-center justify-center my-4 sm:my-6 select-none relative group" aria-hidden="true">
              <div className="h-6 sm:h-8 w-0.5 bg-gradient-to-b from-emerald-600 via-emerald-500/60 to-emerald-400/20 dark:from-emerald-400 dark:via-emerald-500/40" />
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/95 dark:bg-slate-900/90 border-2 border-emerald-500/40 dark:border-emerald-500/50 shadow-lg shadow-emerald-600/10 dark:shadow-emerald-950/40 backdrop-blur-md transition-all duration-300 group-hover:scale-105 group-hover:border-emerald-500 group-hover:shadow-emerald-500/20">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-600 to-slate-900 text-white flex items-center justify-center shadow-xs">
                  <ChevronDown className="w-3.5 h-3.5 animate-bounce stroke-[3]" />
                </div>
                <div className="text-left">
                  <span className="text-[10px] uppercase font-black tracking-wider text-emerald-700 dark:text-emerald-400 block -mb-0.5">
                    Langkah Selanjutnya
                  </span>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                    Point 2: <span className="text-[#141414] dark:text-white font-extrabold">Pilih Portal Semester</span>
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse stroke-[2.5] ml-1" />
              </div>
              <div className="h-6 sm:h-8 w-0.5 bg-gradient-to-b from-emerald-400/20 via-emerald-500/60 to-emerald-600 dark:from-emerald-400/20 dark:via-emerald-500/40 dark:to-emerald-400" />
            </div>

            {/* ============================================================
                3. POINT 2: PILIH PORTAL SEMESTER (Section 3 - Alur Kedua)
                Dinamis sesuai semester yang memiliki mata kuliah di TA Aktif
               ============================================================ */}
            <section className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl p-5 sm:p-7 border border-slate-200/90 dark:border-slate-700/80 shadow-xl shadow-slate-200/40 dark:shadow-black/50 ring-1 ring-black/[0.04] dark:ring-white/[0.05] relative overflow-hidden transition-all duration-200 hover:shadow-2xl">
              {/* Top Accent Gradient Line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-600 via-amber-400 to-emerald-600" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-800 to-slate-950 text-white flex items-center justify-center font-black text-sm shadow-md ring-2 ring-emerald-500/30 shrink-0">
                    02
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/80">
                        Point 2
                      </span>
                      <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                        Pilih Portal Semester (T.A. {activeAcademicYear})
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Tentukan semester mata kuliah yang ingin Anda daftarkan untuk diulang pada periode {activeTerm}.
                    </p>
                  </div>
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
                      {activeSemesters.length > 0 ? activeSemesters.map(s => `Sem ${s}`).join(', ') : 'Belum Ada'}
                    </span>
                  </div>
                </button>

                {/* Notifikasi jika belum ada semester yang dibuka/ditampilkan */}
                {activeSemesters.length === 0 && (
                  <div className="col-span-1 sm:col-span-2 lg:col-span-3 p-4 rounded-xl border border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/20 flex flex-col justify-center items-center text-center">
                    <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                      Belum ada semester pendaftaran yang dibuka atau diaktifkan oleh Admin untuk tampil di formulir utama.
                    </p>
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                      Silakan hubungi admin akademik atau tunggu jadwal pembukaan pendaftaran mengulang mata kuliah.
                    </p>
                  </div>
                )}

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

              {/* Catatan dari Superadmin dengan Format Link Aktif ala Google Form */}
              {adminSettings.classNote && (
                <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300 shadow-2xs">
                  <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <strong className="font-bold text-slate-900 dark:text-slate-100 block mb-1.5">
                      Catatan Pengumuman Akademik:
                    </strong>
                    {renderFormattedNote(adminSettings.classNote)}
                  </div>
                </div>
              )}
            </section>

            {/* ============================================================
                PERINGATAN KELAS BEASISWA
               ============================================================ */}
            <div className="bg-red-50/80 dark:bg-red-950/30 border-l-4 border-red-600 p-4 rounded-r-2xl border border-red-200/60 dark:border-red-900/40 flex items-start gap-3 text-xs sm:text-sm text-slate-800 dark:text-slate-200 shadow-md">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <p>
                  <strong>Perhatian Akademik:</strong> {scholarshipAlertText}
                </p>
              </div>
            </div>

            {/* ============================================================
                PENGARAH ALUR: POINT 2 ➔ POINT 3 (Directional Flow Indicator)
               ============================================================ */}
            <div className="flex flex-col items-center justify-center my-4 sm:my-6 select-none relative group" aria-hidden="true">
              <div className="h-6 sm:h-8 w-0.5 bg-gradient-to-b from-emerald-600 via-emerald-500/60 to-emerald-400/20 dark:from-emerald-400 dark:via-emerald-500/40" />
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/95 dark:bg-slate-900/90 border-2 border-emerald-500/40 dark:border-emerald-500/50 shadow-lg shadow-emerald-600/10 dark:shadow-emerald-950/40 backdrop-blur-md transition-all duration-300 group-hover:scale-105 group-hover:border-emerald-500 group-hover:shadow-emerald-500/20">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-600 to-slate-900 text-white flex items-center justify-center shadow-xs">
                  <ChevronDown className="w-3.5 h-3.5 animate-bounce stroke-[3]" />
                </div>
                <div className="text-left">
                  <span className="text-[10px] uppercase font-black tracking-wider text-emerald-700 dark:text-emerald-400 block -mb-0.5">
                    Langkah Selanjutnya
                  </span>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                    Point 3: <span className="text-[#141414] dark:text-white font-extrabold">Pilih Mata Kuliah yang Diulang</span>
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse stroke-[2.5] ml-1" />
              </div>
              <div className="h-6 sm:h-8 w-0.5 bg-gradient-to-b from-emerald-400/20 via-emerald-500/60 to-emerald-600 dark:from-emerald-400/20 dark:via-emerald-500/40 dark:to-emerald-400" />
            </div>

            {/* ============================================================
                6. POINT 3: PILIH MATA KULIAH YANG DIULANG (Section 6)
               ============================================================ */}
            <section className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl p-5 sm:p-7 border border-slate-200/90 dark:border-slate-700/80 shadow-xl shadow-slate-200/40 dark:shadow-black/50 ring-1 ring-black/[0.04] dark:ring-white/[0.05] relative overflow-hidden transition-all duration-200 hover:shadow-2xl space-y-6">
              {/* Top Accent Gradient Line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-600 via-amber-400 to-emerald-600" />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-800 to-slate-950 text-white flex items-center justify-center font-black text-sm shadow-md ring-2 ring-emerald-500/30 shrink-0">
                    03
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/80">
                        Point 3
                      </span>
                      <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                        Pilih Mata Kuliah yang Diulang
                      </h2>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Centang mata kuliah yang ingin Anda daftarkan dan sesuaikan pilihan kelasnya.
                    </p>
                  </div>
                </div>

                {/* Status Terpilih & SKS Badge Meter */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="px-3.5 py-1.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    Terpilih: <strong className="text-emerald-700 dark:text-emerald-400 font-extrabold">{selectedList.length}</strong> mata kuliah
                  </div>
                  <div className={`self-start sm:self-auto px-4 py-1.5 rounded-full text-xs font-mono font-bold flex items-center gap-2 shadow-2xs border ${
                    isOverSksLimit 
                      ? 'bg-red-100 text-red-600 border-red-300' 
                      : 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  }`}>
                    <span>{totalSks} SKS Terpilih</span>
                    <span className="text-slate-400">/</span>
                    <span>Maks {currentMaxSks} SKS</span>
                  </div>
                </div>
              </div>

              {/* Behance Unified Search Input & Segmented Prodi Switcher */}
              <div className="bg-slate-50 dark:bg-slate-800/80 p-2 sm:p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-2xs space-y-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                  
                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari matakuliah, dosen, kode MK, atau program studi..."
                      className="w-full h-11 pl-11 pr-10 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#141414] dark:focus:ring-emerald-500 shadow-2xs transition-all"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
                        title="Hapus pencarian"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Segmented Prodi Switcher */}
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-full border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0 self-stretch md:self-auto overflow-x-auto no-scrollbar">
                    <button
                      type="button"
                      onClick={() => setActiveProdiTab('all')}
                      className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-full text-xs font-bold transition-all text-center cursor-pointer shrink-0 ${
                        activeProdiTab === 'all'
                          ? 'bg-[#141414] dark:bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      Semua ({tabCounts.allSelected}/{tabCounts.allTotal})
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveProdiTab('agroteknologi')}
                      className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-full text-xs font-bold transition-all text-center cursor-pointer shrink-0 ${
                        activeProdiTab === 'agroteknologi'
                          ? 'bg-[#141414] dark:bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      Agroteknologi ({tabCounts.agroSelected}/{tabCounts.agroTotal})
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveProdiTab('agribisnis')}
                      className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-full text-xs font-bold transition-all text-center cursor-pointer shrink-0 ${
                        activeProdiTab === 'agribisnis'
                          ? 'bg-[#141414] dark:bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-black dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      Agribisnis ({tabCounts.agriSelected}/{tabCounts.agriTotal})
                    </button>
                  </div>

                </div>

                {searchQuery.trim() && (
                  <div className="flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/80 animate-fade-in">
                    <span className="font-bold">🔍 Live Search:</span>
                    <span>Ditemukan <strong>{filteredCourses.length}</strong> mata kuliah yang cocok dengan kata kunci "{searchQuery}"</span>
                  </div>
                )}
              </div>

              {/* Filter Pills Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 pb-1 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex flex-wrap items-center gap-2">
                  
                  {/* Filter Pill: Semester */}
                  <div className="relative inline-flex items-center">
                    <select
                      value={selectedSemester}
                      onChange={(e) => setSelectedSemester(e.target.value)}
                      className="appearance-none bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold py-1.5 pl-3 pr-7 rounded-full shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#141414] dark:focus:ring-emerald-500 cursor-pointer"
                      title="Filter Semester Matakuliah"
                    >
                      <option value="all">Semester: Semua</option>
                      {activeSemesters.map(sem => (
                        <option key={sem} value={String(sem)}>Semester {sem}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
                  </div>

                  {/* Filter Pill: Beban SKS */}
                  <div className="relative inline-flex items-center">
                    <select
                      value={sksFilter}
                      onChange={(e) => setSksFilter(e.target.value)}
                      className="appearance-none bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold py-1.5 pl-3 pr-7 rounded-full shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#141414] dark:focus:ring-emerald-500 cursor-pointer"
                      title="Filter Beban SKS"
                    >
                      <option value="all">Beban: Semua SKS</option>
                      <option value="2">2 SKS</option>
                      <option value="3">3 SKS</option>
                      <option value="4">4 SKS</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 pointer-events-none" />
                  </div>

                  {/* Filter Pill: Urutkan */}
                  <div className="relative inline-flex items-center">
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as any)}
                      className="appearance-none bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold py-1.5 pl-3 pr-7 rounded-full shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#141414] dark:focus:ring-emerald-500 cursor-pointer"
                      title="Urutan Tampilan Matakuliah"
                    >
                      <option value="default">Urutkan: Default</option>
                      <option value="sks-desc">SKS Terbanyak</option>
                      <option value="name-asc">Nama Matkul A - Z</option>
                    </select>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 absolute right-2.5 pointer-events-none" />
                  </div>

                </div>

                {/* Right: Select All & View Switcher */}
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  
                  {/* Select All Checkbox Pill */}
                  {(() => {
                    const openCourses = filteredCourses.filter(c => !isCourseClosedCheck(c).isClosed);
                    const allVisibleClosed = filteredCourses.length > 0 && openCourses.length === 0;

                    return (
                      <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold select-none cursor-pointer transition-all ${
                        allVisibleClosed 
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-60' 
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-400 shadow-2xs'
                      }`}>
                        <input
                          type="checkbox"
                          disabled={allVisibleClosed}
                          checked={areAllVisibleSelected}
                          onChange={handleToggleSelectAllVisible}
                          className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-600 cursor-pointer"
                        />
                        <span className="hidden sm:inline">
                          {allVisibleClosed 
                            ? 'Link Ditutup' 
                            : `Pilih Semua (${openCourses.length}/${filteredCourses.length})`}
                        </span>
                        <span className="sm:hidden">
                          Semua ({openCourses.length})
                        </span>
                      </label>
                    );
                  })()}

                </div>
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

              {/* ============================================================
                  TABEL MATAKULIAH RAPI & TERSTRUKTUR (Table View)
                 ============================================================ */}
              {filteredCourses.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white/50 dark:bg-slate-900/50">
                  <BookOpen className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-bold">
                    Tidak ada mata kuliah yang cocok dengan filter atau kata kunci.
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    Coba ubah filter semester, prodi, atau hapus kata kunci pencarian.
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700/80 text-[11px] font-black uppercase text-slate-600 dark:text-slate-300 tracking-wider select-none">
                          <th className="py-3.5 px-3.5 text-center w-16">Pilih</th>
                          <th className="py-3.5 px-4 min-w-[220px]">Mata Kuliah &amp; Kode</th>
                          <th className="py-3.5 px-3 text-center w-24">SKS</th>
                          <th className="py-3.5 px-3 text-center w-24">Semester</th>
                          <th className="py-3.5 px-3 w-32">Program Studi</th>
                          <th className="py-3.5 px-4 min-w-[180px]">Opsi Kelas Ditawarkan</th>
                          <th className="py-3.5 px-4 text-right w-28">Status Biaya</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-xs">
                        {filteredCourses.map((course, idx) => {
                          const { isClosed: isCourseClosed, reason: closedReason } = isCourseClosedCheck(course);
                          const isChecked = !isCourseClosed && (courseSelections[course.id]?.checked || false);
                          const chosenClass = getSelectedClass(course);
                          const availableClasses = getAvailableClasses(course);

                          return (
                            <tr
                              key={course.id}
                              className={`transition-colors duration-150 ${
                                isCourseClosed
                                  ? 'bg-slate-50/60 dark:bg-slate-950/40 opacity-55 cursor-not-allowed select-none'
                                  : isChecked
                                  ? 'bg-emerald-50/60 dark:bg-emerald-950/30 font-semibold'
                                  : idx % 2 === 0
                                  ? 'bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                                  : 'bg-slate-50/40 dark:bg-slate-900/40 hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                              }`}
                            >
                              {/* Kolom 1: Checkbox Seleksi (Playwright Selector Compatible via sr-only SKS label) */}
                              <td className="py-3 px-3.5 text-center align-middle">
                                <label 
                                  className={`inline-flex items-center justify-center p-2 rounded-lg text-xs font-bold transition-all select-none cursor-pointer ${
                                    isCourseClosed 
                                      ? 'cursor-not-allowed opacity-50 text-slate-400' 
                                      : isChecked 
                                      ? 'bg-emerald-600 text-white shadow-xs' 
                                      : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                                  }`}
                                  title={isCourseClosed ? closedReason : isChecked ? 'Batal memilih' : 'Pilih mata kuliah ini'}
                                >
                                  <input
                                    type="checkbox"
                                    disabled={isCourseClosed}
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (!isCourseClosed) {
                                        handleToggleCourse(course, e.target.checked);
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className={`w-4 h-4 rounded transition-all ${
                                      isCourseClosed 
                                        ? 'opacity-40 cursor-not-allowed' 
                                        : 'text-emerald-600 focus:ring-emerald-500 cursor-pointer'
                                    }`}
                                  />
                                  {/* Hidden screen-reader text so Playwright locator label filter /SKS/i passes without visible duplicate */}
                                  <span className="sr-only">
                                    {course.sks} SKS
                                  </span>
                                </label>
                              </td>

                              {/* Kolom 2: Nama Mata Kuliah & Kode */}
                              <td className="py-3 px-4 align-middle">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`font-bold text-xs sm:text-sm tracking-tight ${
                                      isCourseClosed 
                                        ? 'text-slate-400 line-through' 
                                        : isChecked 
                                        ? 'text-emerald-700 dark:text-emerald-300' 
                                        : 'text-slate-900 dark:text-white'
                                    }`}>
                                      {course.name}
                                    </span>
                                    {isCourseClosed && (
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800" title={closedReason}>
                                        Link Ditutup
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400 font-mono">
                                    <span className="font-semibold text-slate-500 dark:text-slate-400 uppercase">{course.id}</span>
                                    <span>•</span>
                                    <span>Kurikulum FP</span>
                                  </div>
                                </div>
                              </td>

                              {/* Kolom 3: Beban SKS - Rapi, horizontal, tidak berulang/tumpang tindih */}
                              <td className="py-3 px-3 text-center align-middle whitespace-nowrap">
                                <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 shadow-2xs whitespace-nowrap">
                                  {course.sks} SKS
                                </span>
                              </td>

                              {/* Kolom 4: Semester */}
                              <td className="py-3 px-3 text-center align-middle">
                                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  Sem {course.semester}
                                </span>
                              </td>

                              {/* Kolom 5: Program Studi */}
                              <td className="py-3 px-3 align-middle">
                                <span className="capitalize font-semibold text-slate-700 dark:text-slate-300 text-xs">
                                  {course.prodi}
                                </span>
                              </td>

                              {/* Kolom 6: Opsi Kelas Ditawarkan */}
                              <td className="py-3 px-4 align-middle">
                                <select
                                  disabled={!isChecked || isCourseClosed}
                                  value={chosenClass}
                                  onChange={(e) => handleChangeClass(course.id, e.target.value)}
                                  className={`w-full h-8 px-2.5 rounded-lg text-xs font-bold border transition-all ${
                                    !isChecked || isCourseClosed
                                      ? 'bg-slate-100 dark:bg-slate-800/40 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed opacity-60'
                                      : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-emerald-300 border-emerald-500/60 shadow-2xs focus:ring-2 focus:ring-emerald-500 cursor-pointer'
                                  }`}
                                >
                                  {availableClasses.map((cls) => {
                                    const coursePeriod = findPeriodForCourse(course);
                                    const isScholarship = isClassRestrictedForRepeat(cls, course.semester, adminSettings, coursePeriod, course);
                                    return (
                                      <option key={cls} value={cls} disabled={isScholarship}>
                                        {cls} {isScholarship ? '(Beasiswa - Dilarang)' : ''}
                                      </option>
                                    );
                                  })}
                                </select>
                              </td>

                              {/* Kolom 7: Status Biaya */}
                              <td className="py-3 px-4 text-right align-middle">
                                {isPaidBatch ? (
                                  <span className="font-mono font-bold text-amber-700 dark:text-amber-400 text-xs">
                                    Rp {(course.sks * costPerSks).toLocaleString('id-ID')}
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                                    Bebas Biaya
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </section>

            {/* ============================================================
                PENGARAH ALUR: POINT 3 ➔ POINT 4 (Directional Flow Indicator)
               ============================================================ */}
            <div className="flex flex-col items-center justify-center my-4 sm:my-6 select-none relative group" aria-hidden="true">
              <div className="h-6 sm:h-8 w-0.5 bg-gradient-to-b from-emerald-600 via-emerald-500/60 to-emerald-400/20 dark:from-emerald-400 dark:via-emerald-500/40" />
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/95 dark:bg-slate-900/90 border-2 border-emerald-500/40 dark:border-emerald-500/50 shadow-lg shadow-emerald-600/10 dark:shadow-emerald-950/40 backdrop-blur-md transition-all duration-300 group-hover:scale-105 group-hover:border-emerald-500 group-hover:shadow-emerald-500/20">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-600 to-slate-900 text-white flex items-center justify-center shadow-xs">
                  <ChevronDown className="w-3.5 h-3.5 animate-bounce stroke-[3]" />
                </div>
                <div className="text-left">
                  <span className="text-[10px] uppercase font-black tracking-wider text-emerald-700 dark:text-emerald-400 block -mb-0.5">
                    Langkah Terakhir
                  </span>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                    Point 4: <span className="text-[#141414] dark:text-white font-extrabold">Pernyataan &amp; Finalisasi Pendaftaran</span>
                  </span>
                </div>
                <ChevronDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse stroke-[2.5] ml-1" />
              </div>
              <div className="h-6 sm:h-8 w-0.5 bg-gradient-to-b from-emerald-400/20 via-emerald-500/60 to-emerald-600 dark:from-emerald-400/20 dark:via-emerald-500/40 dark:to-emerald-400" />
            </div>

            {/* ============================================================
                7. POINT 4: PERNYATAAN & KOMITMEN (Section 7)
               ============================================================ */}
            <section id="section-point-4" className="bg-white/95 dark:bg-slate-900/90 backdrop-blur-md rounded-3xl p-5 sm:p-7 border border-slate-200/90 dark:border-slate-700/80 shadow-xl shadow-slate-200/40 dark:shadow-black/50 ring-1 ring-black/[0.04] dark:ring-white/[0.05] relative overflow-hidden transition-all duration-200 hover:shadow-2xl space-y-4">
              {/* Top Accent Gradient Line */}
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-600 via-amber-400 to-emerald-600" />

              <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-800 to-slate-950 text-white flex items-center justify-center font-black text-sm shadow-md ring-2 ring-emerald-500/30 shrink-0">
                  04
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-800/80">
                      Point 4
                    </span>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                      Pernyataan &amp; Komitmen Alur Pendaftaran
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Pastikan kebenaran data dan pahami kewajiban penyerahan berkas fisik ke loket Fakultas Pertanian.
                  </p>
                </div>
              </div>

              {/* Komitmen Berada Sebelum Tombol Kirim Pendaftaran */}
              <div className="p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border-2 border-emerald-600/30 dark:border-emerald-500/40 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed shadow-2xs">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreeToFlow}
                    onChange={(e) => setAgreeToFlow(e.target.checked)}
                    className="w-5 h-5 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-600 dark:bg-slate-800 cursor-pointer shrink-0"
                  />
                  <span>
                    {currentFlowSettings.commitmentText || 'Saya menyatakan data mata kuliah yang saya pilih sudah benar dan saya memahami bahwa setelah formulir ini terkirim, saya wajib mencetak KRS Mengulang (A4) dan menyerahkannya langsung ke Administrasi Fakultas Pertanian INSTIPER'} {isPaidBatch ? 'disertai bukti fisik setoran/transfer pembayaran biaya.' : '(bebas biaya mengulang).'}
                  </span>
                </label>
              </div>

              {/* Tombol Kirim Pendaftaran (Berada Tepat Setelah Komitmen) */}
              <div className="pt-2">
                <button
                  type="submit"
                  form="registration-form"
                  disabled={!canSubmit}
                  title={getSubmitDisabledReason() || 'Kirim Formulir Pendaftaran Mengulang'}
                  className="w-full h-12 sm:h-13 rounded-xl bg-[#166534] hover:bg-[#14532D] text-white font-extrabold text-sm sm:text-base shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                >
                  <Send className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Kirim Pendaftaran</span>
                </button>

                {getSubmitDisabledReason() && (
                  <div className="mt-3 p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 leading-relaxed flex items-center gap-2">
                    <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>{getSubmitDisabledReason()}</span>
                  </div>
                )}
              </div>
            </section>

            {/* Global Submission Error if any */}
            {submissionError && (
              <div className="p-3.5 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-2xl text-xs font-semibold flex items-center gap-2 shadow-sm">
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

            {/* Action Shortcut to Point 4 (Desktop Sidebar) */}
            <div>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('section-point-4');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="w-full h-12 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <Send className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-200" />
                <span>Menuju Point 4 &amp; Kirim Form ↓</span>
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

          {/* Right: Action Shortcut to Point 4 */}
          <div className="shrink-0 flex flex-col items-stretch sm:items-end gap-1 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('section-point-4');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="w-full sm:w-auto h-11 px-5 rounded-xl bg-[#166534] hover:bg-[#14532D] text-white font-extrabold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Menuju Point 4 (Kirim) ↓</span>
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

