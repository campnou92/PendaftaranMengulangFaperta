export type RegistrationStatus = 'pending' | 'approved' | 'rejected';
export type PaymentStatus = 'pending' | 'paid' | 'verified';

export type UserRole = 'baak' | 'finance' | 'superadmin' | 'kaprodi';

export interface AuthUser {
  username: string;
  name: string;
  role: UserRole;
  title: string;
}

export interface ManagedUser {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  title: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface CourseItem {
  id: string;
  name: string;
  sks: number;
  prodi: 'agroteknologi' | 'agribisnis' | string;
  semester: number | string; // e.g. 1, 3, 5 or 'Antara'
  availableClasses?: string[];
  restrictedClasses?: string[]; // Daftar kelas beasiswa / dilarang mengulang khusus untuk matakuliah ini
  academicYear?: string; // e.g. '2024/2025', '2025/2026'
  periodId?: string; // ID record periode pendaftaran
}

export interface SelectedCourseItem {
  courseId: string;
  name: string;
  sks: number;
  prodi: string;
  semester?: number | string;
  selectedClass: string;
  academicYear?: string;
  periodId?: string;
}

export interface UploadedFileItem {
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
  uploadedAt: string;
}

export interface SimpleRegistration {
  id: string;
  registrationDate: string; // Auto generate
  status: RegistrationStatus;
  targetSemester: string; // e.g. 'Semester 3', 'Semester 5', or 'Semua Semester'
  academicYear?: string; // e.g. '2025/2026' (tercatat dari activeAcademicYear saat daftar)
  academicTerm?: string; // e.g. 'Ganjil' / 'Genap'
  
  // Data Mahasiswa sesuai gambar
  email: string;
  angkatan: string;
  nama: string;
  nim: string;
  noWa: string;
  kelasAsal: string;
  
  // Matakuliah yang dipilih
  selectedCourses: SelectedCourseItem[];
  totalSks: number;
  
  // Berkas yang diunggah mahasiswa (KHS / Bukti Bayar / Formulir)
  uploadedFile?: UploadedFileItem;

  // Status Pembayaran Khusus Admin Keuangan
  paymentStatus?: PaymentStatus;
  paymentDate?: string;
  paymentNote?: string;
  estimatedFee?: number;
  
  // Catatan admin jika ada & alasan penolakan
  adminNotes?: string;
  rejectionReason?: string;
}

export interface AdminSettings {
  classOptions: string[];
  classNote: string;
  
  // Pengaturan Format & Contoh Pengisian Kelas Asal (Superadmin)
  kelasAsalMode?: 'input_with_chips' | 'select' | 'input';
  kelasAsalPlaceholder?: string;
  kelasAsalCustomOptions?: string[];

  // Pengaturan Tahun Ajaran Aktif & Daftar Periode (Superadmin / Admin Fakultas)
  activeAcademicYear?: string; // Default: '2025/2026'
  activeTerm?: string; // Default: 'Ganjil'
  availableAcademicYears?: string[]; // Contoh: ['2023/2024', '2024/2025', '2025/2026', '2026/2027']

  // Pengaturan Biaya Mengulang Per SKS untuk Angkatan Tertentu (Superadmin)
  feePerSksEnabled: boolean;
  costPerSks: number; // Biaya per SKS dalam Rupiah, misal 50000
  paidBatches: string[]; // Daftar angkatan yang dikenakan biaya, contoh: ['2020', '2021', '2022']
  paymentInstructions: string; // Teks note instruksi pembayaran yang muncul pada hasil pendaftaran
  paymentAccountInfo: string; // Nomor rekening, loket atau kontak bagian keuangan
  
  // Pengaturan Batas Maksimal Pengambilan SKS (Default 24 SKS & Konfigurasi Khusus Per Angkatan)
  defaultMaxSks: number; // Default 24 SKS
  batchMaxSks?: Record<string, number>; // Batas SKS khusus per angkatan, misal { "2020": 20, "2021": 22 }

  // Pengaturan Buka / Tutup Pendaftaran Berdasarkan Semester & Jadwal Periode (Superadmin)
  semesterSchedules?: Record<string, SemesterSchedule>;

  // Daftar Record Periode Pendaftaran (Superadmin / Admin Buka Periode Semester & Jadwal)
  registrationPeriods?: RegistrationPeriod[];

  // Pengaturan Kelas Beasiswa (Tidak Boleh untuk Kelas Mengulang) Per Semester (Superadmin)
  restrictedRepeatClasses?: Record<string, string[]>; // Mapping per semester: misal { '3': ['Kelas Beasiswa'], '5': ['Kelas Beasiswa', 'Kelas D'] }
  restrictedRepeatClassReason?: Record<string, string>; // Keterangan / alasan per semester

  // Pengaturan Alur & Panduan Pendaftaran Mahasiswa (Superadmin / Admin Fakultas)
  registrationFlow?: RegistrationFlowSettings;
}

export interface RegistrationFlowStep {
  step: number;
  title: string;
  desc: string;
  tag?: string;
}

export interface RegistrationFlowSettings {
  title: string; // Default: 'Alur Resmi Pendaftaran Mengulang'
  subtitle: string; // Default: 'Fakultas Pertanian — Wajib Dipahami Seluruh Mahasiswa'
  steps: RegistrationFlowStep[];
  highlightNote: string;
  commitmentText: string;
}

export interface RegistrationPeriod {
  id: string;
  semester: number | string; // e.g. 1, 2, 3, 4, 5, 6, 7, 8 or 'Antara'
  academicYear: string; // e.g. '2026/2027'
  title: string;
  isOpen: boolean; // Master status buka/tutup pendaftaran
  showOnMainForm?: boolean; // Tampilkan di pilihan semester formulir utama mahasiswa (default true jika isOpen)
  useSchedule: boolean;
  startDate: string; // ISO datetime "2026-10-01T08:00"
  endDate: string; // ISO datetime "2026-11-30T23:59"
  closedMessage?: string;
  
  // Daftar mata kuliah & kelas yang dibuka khusus untuk periode ini
  offeredCourseIds: string[]; // List of CourseItem IDs offered
  courses?: CourseItem[]; // Embedded / full list of CourseItem for this period
  offeredClasses?: Record<string, string[]>; // Custom classes offered per course (optional override)
  
  // Pengaturan Biaya SKS Khusus Periode Ini
  feePerSksEnabled?: boolean;
  costPerSks?: number;
  paidBatches?: string[];
  paymentInstructions?: string;
  paymentAccountInfo?: string;

  // Pengaturan Batas Maksimal SKS Khusus Periode Ini
  defaultMaxSks?: number;
  batchMaxSks?: Record<string, number>;

  // Pengaturan Kelas Beasiswa (Larangan Mengulang) Khusus Periode Ini
  restrictedRepeatClasses?: string[];
  restrictedRepeatClassReason?: string;

  createdAt: string;
  updatedAt?: string;
  notes?: string;
}

export interface SemesterSchedule {
  semester: number; // 3, 5, etc.
  isOpen: boolean; // Master toggle: true (buka) / false (tutup manual)
  useSchedule: boolean; // Gunakan jadwal otomatis tanggal & jam
  startDate: string; // ISO datetime string, misal "2026-10-01T08:00"
  endDate: string; // ISO datetime string, misal "2026-11-30T23:59"
  closedMessage?: string; // Pesan notifikasi khusus ketika pendaftaran ditutup
}

export interface SemesterStatusResult {
  isOpen: boolean;
  state: 'open' | 'manual_closed' | 'upcoming' | 'expired';
  label: string;
  badgeClass: string;
  message: string;
  startDate?: string;
  endDate?: string;
  period?: RegistrationPeriod;
}

export function formatDateTimeId(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) + ' WIB';
  } catch {
    return dateStr;
  }
}

export function getSemesterStatus(
  semesterNum: number | string, 
  settings?: AdminSettings,
  targetAcademicYear?: string
): SemesterStatusResult {
  const semKey = String(semesterNum);
  const activeYear = targetAcademicYear || settings?.activeAcademicYear || '2025/2026';

  // 1. Prioritas Utama: Cek apakah ada record RegistrationPeriod yang cocok
  if (settings?.registrationPeriods && settings.registrationPeriods.length > 0) {
    const period = settings.registrationPeriods.find(
      p => String(p.semester) === semKey && (p.academicYear === activeYear || !p.academicYear)
    );

    if (period) {
      if (period.isOpen === false) {
        return {
          isOpen: false,
          state: 'manual_closed',
          label: 'DITUTUP MANUAL',
          badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
          message: period.closedMessage || `Pendaftaran Semester ${semKey} (T.A. ${period.academicYear}) ditutup oleh pihak Fakultas Pertanian.`,
          period
        };
      }

      if (period.useSchedule) {
        const now = new Date();
        const hasStart = Boolean(period.startDate);
        const hasEnd = Boolean(period.endDate);
        const start = hasStart ? new Date(period.startDate) : null;
        const end = hasEnd ? new Date(period.endDate) : null;

        if (start && !isNaN(start.getTime()) && now < start) {
          return {
            isOpen: false,
            state: 'upcoming',
            label: 'BELUM DIBUKA',
            badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
            message: `Pendaftaran Semester ${semKey} belum dibuka. Pendaftaran akan dibuka mulai ${formatDateTimeId(period.startDate)}.`,
            startDate: period.startDate,
            endDate: period.endDate,
            period
          };
        }

        if (end && !isNaN(end.getTime()) && now > end) {
          return {
            isOpen: false,
            state: 'expired',
            label: 'SUDAH DITUTUP',
            badgeClass: 'bg-slate-200 text-slate-800 border-slate-400',
            message: period.closedMessage || `Pendaftaran Semester ${semKey} telah berakhir pada ${formatDateTimeId(period.endDate)}.`,
            startDate: period.startDate,
            endDate: period.endDate,
            period
          };
        }

        return {
          isOpen: true,
          state: 'open',
          label: 'DIBUKA (JADWAL)',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          message: end ? `Pendaftaran Semester ${semKey} dibuka s/d ${formatDateTimeId(period.endDate)}.` : `Pendaftaran Semester ${semKey} sedang dibuka.`,
          startDate: period.startDate,
          endDate: period.endDate,
          period
        };
      }

      return {
        isOpen: true,
        state: 'open',
        label: 'DIBUKA',
        badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        message: `Pendaftaran Semester ${semKey} (T.A. ${period.academicYear}) saat ini aktif dan dibuka.`,
        period
      };
    }
  }

  // 2. Fallback: Cek semesterSchedules lama
  const schedule = settings?.semesterSchedules?.[semKey];

  // Default jika belum disetel: Pendaftaran TERTUTUP (aman by-default)
  // Admin harus secara eksplisit membuka pendaftaran via periode atau semesterSchedules
  if (!schedule) {
    return {
      isOpen: false,
      state: 'manual_closed',
      label: 'BELUM DIKONFIGURASI',
      badgeClass: 'bg-slate-200 text-slate-700 border-slate-400',
      message: `Pendaftaran Semester ${semKey} belum dikonfigurasi oleh Admin. Silakan hubungi Fakultas Pertanian.`
    };
  }

  // Jika ditutup secara manual oleh Superadmin
  if (schedule.isOpen === false) {
    return {
      isOpen: false,
      state: 'manual_closed',
      label: 'DITUTUP MANUAL',
      badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
      message: schedule.closedMessage || `Pendaftaran Semester ${semKey} ditutup oleh pihak Fakultas Pertanian.`
    };
  }

  // Jika menggunakan jadwal otomatis berbasis rentang waktu
  if (schedule.useSchedule) {
    const now = new Date();
    const hasStart = Boolean(schedule.startDate);
    const hasEnd = Boolean(schedule.endDate);
    const start = hasStart ? new Date(schedule.startDate) : null;
    const end = hasEnd ? new Date(schedule.endDate) : null;

    if (start && !isNaN(start.getTime()) && now < start) {
      return {
        isOpen: false,
        state: 'upcoming',
        label: 'BELUM DIBUKA',
        badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
        message: `Pendaftaran Semester ${semKey} belum dibuka. Pendaftaran akan dibuka mulai ${formatDateTimeId(schedule.startDate)}.`,
        startDate: schedule.startDate,
        endDate: schedule.endDate
      };
    }

    if (end && !isNaN(end.getTime()) && now > end) {
      return {
        isOpen: false,
        state: 'expired',
        label: 'SUDAH DITUTUP',
        badgeClass: 'bg-slate-200 text-slate-800 border-slate-400',
        message: schedule.closedMessage || `Pendaftaran Semester ${semKey} telah berakhir pada ${formatDateTimeId(schedule.endDate)}.`,
        startDate: schedule.startDate,
        endDate: schedule.endDate
      };
    }

    // Sedang dalam rentang aktif jadwal
    return {
      isOpen: true,
      state: 'open',
      label: 'DIBUKA (JADWAL)',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      message: end ? `Pendaftaran Semester ${semKey} dibuka s/d ${formatDateTimeId(schedule.endDate)}.` : `Pendaftaran Semester ${semKey} sedang dibuka.`,
      startDate: schedule.startDate,
      endDate: schedule.endDate
    };
  }

  // Pendaftaran dibuka manual
  return {
    isOpen: true,
    state: 'open',
    label: 'DIBUKA',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    message: `Pendaftaran Semester ${semKey} saat ini aktif dan dibuka.`
  };
}

export function getMaxSksForBatch(angkatan?: string, settings?: AdminSettings, period?: RegistrationPeriod): number {
  if (period) {
    if (angkatan && period.batchMaxSks && period.batchMaxSks[angkatan] !== undefined && Number(period.batchMaxSks[angkatan]) > 0) {
      return Number(period.batchMaxSks[angkatan]);
    }
    if (typeof period.defaultMaxSks === 'number' && period.defaultMaxSks > 0) {
      return period.defaultMaxSks;
    }
  }
  if (!settings) return 24;
  if (angkatan && settings.batchMaxSks && settings.batchMaxSks[angkatan] !== undefined && Number(settings.batchMaxSks[angkatan]) > 0) {
    return Number(settings.batchMaxSks[angkatan]);
  }
  return typeof settings.defaultMaxSks === 'number' && settings.defaultMaxSks > 0 ? settings.defaultMaxSks : 24;
}

export function getRestrictedClassesForSemester(
  semesterNum: number | string | undefined | null,
  settings?: AdminSettings,
  period?: RegistrationPeriod,
  course?: CourseItem
): string[] {
  // 1. Jika course spesifik memiliki daftar restrictedClasses mandiri
  if (course && Array.isArray(course.restrictedClasses)) {
    return course.restrictedClasses;
  }
  // 2. Jika periode spesifik memiliki aturan restrictedRepeatClasses
  if (period && Array.isArray(period.restrictedRepeatClasses) && period.restrictedRepeatClasses.length > 0) {
    return period.restrictedRepeatClasses;
  }
  // 3. Fallback ke restrictedRepeatClasses global per semester
  if (!settings || !settings.restrictedRepeatClasses || !semesterNum) {
    return [];
  }
  const semKey = String(semesterNum);
  const list = settings.restrictedRepeatClasses[semKey];
  return Array.isArray(list) ? list : [];
}

export function isClassRestrictedForRepeat(
  className: string,
  semesterNum: number | string | undefined | null,
  settings?: AdminSettings,
  period?: RegistrationPeriod,
  course?: CourseItem
): boolean {
  if (!className) return false;
  // 1. Jika course memiliki aturan restrictedClasses mandiri
  if (course && Array.isArray(course.restrictedClasses)) {
    return course.restrictedClasses.includes(className);
  }
  const restrictedList = getRestrictedClassesForSemester(semesterNum, settings, period);
  return restrictedList.includes(className);
}

export function getRestrictedClassReason(
  semesterNum: number | string | undefined | null,
  settings?: AdminSettings,
  period?: RegistrationPeriod,
  _course?: CourseItem
): string {
  if (period?.restrictedRepeatClassReason) {
    return period.restrictedRepeatClassReason;
  }
  const semKey = semesterNum ? String(semesterNum) : '3';
  return (
    settings?.restrictedRepeatClassReason?.[semKey] ||
    `Kelas ini merupakan Kelas Beasiswa pada Semester ${semKey} dan tidak diperkenankan untuk diambil sebagai kelas mengulang.`
  );
}


