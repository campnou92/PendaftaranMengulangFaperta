import { CourseItem, SimpleRegistration, AdminSettings } from '../types';

export interface ClassQuotaStatus {
  enrolled: number;
  quota: number; // 0 = unlimited (tidak dibatasi)
  remaining: number; // Sisa kursi, Infinity jika kuota === 0
  isFull: boolean;
  hasQuota: boolean;
}

/**
 * Menghitung jumlah mahasiswa yang mendaftar pada mata kuliah dan kelas tertentu.
 * Pendaftaran berstatus 'rejected' diabaikan (kuota dikembalikan).
 */
export const getEnrolledClassCount = (
  course: CourseItem | { id: string; name: string },
  className: string,
  registrations: SimpleRegistration[]
): number => {
  if (!registrations || !Array.isArray(registrations)) return 0;
  
  const courseId = course.id;
  const courseNameLower = course.name ? course.name.toLowerCase().trim() : '';

  return registrations.filter(r => {
    if (r.status === 'rejected') return false;
    return r.courses?.some(c => 
      (c.courseId === courseId || (c.name && c.name.toLowerCase().trim() === courseNameLower)) &&
      c.selectedClass?.trim().toLowerCase() === className.trim().toLowerCase()
    );
  }).length;
};

/**
 * Mengambil kuota kapasitas untuk kelas tertentu pada mata kuliah.
 * Mengembalikan angka kuota (> 0) atau 0 jika tidak ada batasan.
 */
export const getClassQuota = (
  course: CourseItem,
  className: string,
  adminSettings?: AdminSettings
): number => {
  if (course.classQuotas && typeof course.classQuotas[className] === 'number') {
    return Math.max(0, course.classQuotas[className]);
  }
  if (adminSettings?.defaultClassQuota && adminSettings.defaultClassQuota > 0) {
    return adminSettings.defaultClassQuota;
  }
  return 0;
};

/**
 * Mengambil status lengkap kuota kelas (terdaftar, kuota, sisa kursi, apakah penuh).
 */
export const getClassQuotaStatus = (
  course: CourseItem,
  className: string,
  registrations: SimpleRegistration[],
  adminSettings?: AdminSettings
): ClassQuotaStatus => {
  const quota = getClassQuota(course, className, adminSettings);
  const enrolled = getEnrolledClassCount(course, className, registrations);
  const hasQuota = quota > 0;
  const remaining = hasQuota ? Math.max(0, quota - enrolled) : Infinity;
  const isFull = hasQuota && enrolled >= quota;

  return {
    enrolled,
    quota,
    remaining,
    isFull,
    hasQuota,
  };
};

