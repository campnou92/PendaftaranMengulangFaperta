import { CourseItem, AdminSettings, RegistrationFlowSettings } from '../types';

export const DEFAULT_REGISTRATION_FLOW: RegistrationFlowSettings = {
  title: 'Alur Resmi Pendaftaran Mengulang',
  subtitle: 'Fakultas Pertanian — Wajib Dipahami Seluruh Mahasiswa',
  steps: [
    {
      step: 1,
      title: 'Isi Identitas & Kelas Asal',
      desc: 'Lengkapi identitas mahasiswa, tentukan kelas asal, lalu pilih semester kurikulum yang ingin diulang.',
      tag: 'Online'
    },
    {
      step: 2,
      title: 'Cetak Lembar KRS (A4)',
      desc: 'Setelah formulir dikirim, sistem membuka dokumen KRS. Anda juga dapat mengecek status dan mencetak ulang kapan saja di menu "Cek & Cetak Hasil" dengan memasukkan NIM.',
      tag: 'Standar Resmi'
    },
    {
      step: 3,
      title: 'Bukti Pembayaran SKS',
      desc: 'Bagi angkatan lama (2022 ke bawah), bayar biaya per SKS dan siapkan slip fisik transfer/bank. (Angkatan 2023+ bebas biaya).',
      tag: 'Slip Bank'
    },
    {
      step: 4,
      title: 'Serahkan ke Loket FP',
      desc: 'Bawa lembar cetak formulir beserta bukti fisik pembayaran (jika ada) ke Administrasi Fakultas Pertanian untuk validasi.',
      tag: 'Loket Admin FP'
    }
  ],
  highlightNote: 'Penting: Pastikan seluruh isian identitas mahasiswa dan mata kuliah yang dipilih sudah sesuai sebelum mengirimkan formulir pendaftaran.',
  commitmentText: 'Saya menyatakan data mata kuliah yang saya pilih sudah benar dan saya memahami bahwa setelah formulir ini terkirim, saya wajib mencetak KRS Mengulang (A4) dan menyerahkannya langsung ke Administrasi Fakultas Pertanian INSTIPER'
};

export const INITIAL_COURSES: CourseItem[] = [
  // ==========================================
  // PRODI AGROTEKNOLOGI - SEMESTER 3
  // ==========================================
  { id: 'agro-1', name: 'Matematika', sks: 1, prodi: 'agroteknologi', semester: 3, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agro-2', name: 'Prinsip Dasar Pertanian dan Perkebunan', sks: 1, prodi: 'agroteknologi', semester: 3, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agro-3', name: 'Pengetahuan Perkebunan dan Kehutanan Berkelanjutan', sks: 2, prodi: 'agroteknologi', semester: 3, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agro-4', name: 'Penilaian Kesesuaian Lahan dan Pemetaan', sks: 3, prodi: 'agroteknologi', semester: 3, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agro-5', name: 'Teknik Persiapan Lahan', sks: 2, prodi: 'agroteknologi', semester: 3, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agro-6', name: 'Budaya Dasar dan Etika', sks: 1, prodi: 'agroteknologi', semester: 3, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agro-7', name: 'Dasar dasar Agroteknologi', sks: 2, prodi: 'agroteknologi', semester: 3, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agro-3a', name: 'Fisiologi Tumbuhan Pertanian', sks: 3, prodi: 'agroteknologi', semester: 3, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agro-3b', name: 'Mikrobiologi Pertanian Terapan', sks: 2, prodi: 'agroteknologi', semester: 3, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },

  // ==========================================
  // PRODI AGROTEKNOLOGI - SEMESTER 5
  // ==========================================
  { id: 'agro-8', name: 'Iklim dan Pengelolaan Sumber Daya Tanah dan Air', sks: 4, prodi: 'agroteknologi', semester: 5, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agro-9', name: 'Prkt Blok Persiapan Lahan', sks: 4, prodi: 'agroteknologi', semester: 5, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agro-5a', name: 'Pengendalian Hama & Penyakit Terpadu', sks: 3, prodi: 'agroteknologi', semester: 5, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agro-5b', name: 'Manajemen Produksi Tanaman Perkebunan', sks: 3, prodi: 'agroteknologi', semester: 5, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agro-5c', name: 'Bioteknologi Pertanian Terapan', sks: 2, prodi: 'agroteknologi', semester: 5, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agro-5d', name: 'Konservasi Tanah dan Air', sks: 3, prodi: 'agroteknologi', semester: 5, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },

  // ==========================================
  // PRODI AGRIBISNIS - SEMESTER 3
  // ==========================================
  { id: 'agri-10', name: 'Ekonomi Matematika', sks: 1, prodi: 'agribisnis', semester: 3, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agri-11', name: 'PU Manajemen Data', sks: 2, prodi: 'agribisnis', semester: 3, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agri-12', name: 'Agama Kontekstual Kristen', sks: 2, prodi: 'agribisnis', semester: 3, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agri-13', name: 'PU Manajemen Agribisnis', sks: 2, prodi: 'agribisnis', semester: 3, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agri-14', name: 'Agama Kontekstual Islam', sks: 2, prodi: 'agribisnis', semester: 3, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agri-15', name: 'Bhs Indonesia', sks: 2, prodi: 'agribisnis', semester: 3, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agri-3a', name: 'Ekonomi Mikro Pertanian', sks: 3, prodi: 'agribisnis', semester: 3, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agri-3b', name: 'Akuntansi Usaha Tani & Perkebunan', sks: 3, prodi: 'agribisnis', semester: 3, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },

  // ==========================================
  // PRODI AGRIBISNIS - SEMESTER 5
  // ==========================================
  { id: 'agri-16', name: 'PU Budidaya Pertanian', sks: 2, prodi: 'agribisnis', semester: 5, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agri-17', name: 'PU Bisnis Pertanian', sks: 2, prodi: 'agribisnis', semester: 5, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agri-18', name: 'PU perkebunan dan kehutanan berkelanjutan', sks: 2, prodi: 'agribisnis', semester: 5, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agri-5a', name: 'Analisis Kelayakan Usaha Agribisnis', sks: 3, prodi: 'agribisnis', semester: 5, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agri-5b', name: 'Manajemen Pemasaran Hasil Pertanian', sks: 3, prodi: 'agribisnis', semester: 5, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agri-5c', name: 'Manajemen Rantai Pasok Agribisnis', sks: 3, prodi: 'agribisnis', semester: 5, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'], academicYear: '2025/2026' },
  { id: 'agri-5d', name: 'Kewirausahaan Agribisnis Digital', sks: 2, prodi: 'agribisnis', semester: 5, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'], academicYear: '2025/2026' },
  // ==========================================
  // PRODI AGROTEKNOLOGI - SEMESTER 1
  // ==========================================
  { id: 'agro-s1-1', name: 'Pancasila & Kewarganegaraan', sks: 2, prodi: 'agroteknologi', semester: 1, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agro-s1-2', name: 'Biologi Pertanian Terapan', sks: 3, prodi: 'agroteknologi', semester: 1, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agro-s1-3', name: 'Kimia Dasar Pertanian', sks: 3, prodi: 'agroteknologi', semester: 1, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },

  // ==========================================
  // PRODI AGRIBISNIS - SEMESTER 1
  // ==========================================
  { id: 'agri-s1-1', name: 'Pengantar Ilmu Ekonomi Pertanian', sks: 3, prodi: 'agribisnis', semester: 1, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agri-s1-2', name: 'Pengantar Sosiologi Pedesaan', sks: 2, prodi: 'agribisnis', semester: 1, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
  { id: 'agri-s1-3', name: 'Matematika Ekonomi Terapan', sks: 3, prodi: 'agribisnis', semester: 1, availableClasses: ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas Karyawan'] },
];

// Pastikan semua INITIAL_COURSES default memiliki academicYear: '2025/2026'
export const INITIAL_COURSES_WITH_YEAR: CourseItem[] = INITIAL_COURSES.map(c => ({
  ...c,
  academicYear: c.academicYear || '2025/2026'
}));

export const ANGKATAN_OPTIONS = [
  '2020',
  '2021',
  '2022',
  '2023',
  '2024',
  '2025',
  '2026'
];

export const SEMESTER_OPTIONS = [
  { id: 'all', label: 'Semua Semester (Gabungan)', num: null },
  { id: '1', label: 'Semester 1', num: 1 },
  { id: '3', label: 'Semester 3', num: 3 },
  { id: '5', label: 'Semester 5', num: 5 }
];

export const DEFAULT_CLASSES = [
  'SPKS A', 'SPKS B', 'SPKS C', 'SPKS D', 'SPKS E', 'SPKS F',
  'SPKS G', 'SPKS H', 'SPKS I', 'SPKS J', 'SPKS K', 'SMBP A',
  'SMBP B', 'SMBP C', 'SPA A', 'SPA B', 'SEA A', 'ANTAN A', 'ANTAN B'
];

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  activeAcademicYear: '2025/2026',
  activeTerm: 'Ganjil',
  availableAcademicYears: ['2023/2024', '2024/2025', '2025/2026', '2026/2027'],
  classOptions: [
    'SPKS A', 'SPKS B', 'SPKS C', 'SPKS D', 'SPKS E', 'SPKS F',
    'SPKS G', 'SPKS H', 'SPKS I', 'SPKS J', 'SPKS K', 'SMBP A',
    'SMBP B', 'SMBP C', 'SPA A', 'SPA B', 'SEA A', 'ANTAN A', 'ANTAN B'
  ],
  kelasAsalMode: 'input_with_chips',
  kelasAsalPlaceholder: 'Contoh: SPKS A, SPKS B (atau pilih opsi kelas di bawah)',
  kelasAsalCustomOptions: [],
  classNote: `1. Pendaftaran mengulang tersaji per semester: silakan pilih portal pendaftaran Semester 1, 3, atau 5 sesuai jadwal periode yang dibuka.
2. Admin Fakultas dapat menentukan daftar matakuliah dan beban SKS untuk masing-masing semester (kelola di menu Panel Admin Fakultas).
3. NIM yang sudah dipakai untuk melakukan pendaftaran tidak bisa dipakai lagi (ada notifikasi peringatan).
4. Setelah berhasil mendaftar, pendaftar dapat mencetak hasil matakuliah yang dipilih. Batas maksimal pengambilan adalah 24 SKS.
5. Perhatian: Kelas berstatus "Kelas Beasiswa" tidak dapat dipilih untuk kelas mengulang.
Link Jadwal Kuliah: [Klik Disini](https://docs.google.com/spreadsheets/d/1_instiper_jadwal_kuliah/edit)`,
  feePerSksEnabled: true,
  costPerSks: 50000,
  paidBatches: ['2020', '2021', '2022'], // Mahasiswa angkatan lama dikenakan biaya per SKS
  paymentInstructions: `Pemberitahuan: Mahasiswa angkatan yang terdaftar dikenakan kewajiban pembayaran biaya mengulang mata kuliah sebesar Rp 50.000 per SKS. Harap segera melunasi pembayaran sebelum batas akhir validasi KRS dan mengirimkan bukti transfer ke Bagian Keuangan / Tata Usaha Fakultas Pertanian.`,
  paymentAccountInfo: `Bank Mandiri / BNI No. Rek: 137-00-1928374-1 a.n. Bendahara Fakultas Pertanian (Konfirmasi WA Keuangan: 0812-8877-6655)`,
  defaultMaxSks: 24,
  batchMaxSks: {
    '2020': 20, // Angkatan 2020 batas maksimal 20 SKS
    '2021': 22  // Angkatan 2021 batas maksimal 22 SKS
  },
  registrationPeriods: [
    {
      id: 'period-2025-2026-sem-1',
      semester: 1,
      academicYear: '2025/2026',
      title: 'Pendaftaran Mengulang Semester 1 — T.A. 2025/2026',
      isOpen: true,
      useSchedule: true,
      startDate: '2026-10-01T08:00',
      endDate: '2026-11-20T23:59',
      closedMessage: 'Pendaftaran Mengulang Semester 1 saat ini telah ditutup. Silakan hubungi loket Admin BAAK FP INSTIPER jika memerlukan dispensasi.',
      offeredCourseIds: ['agro-s1-1', 'agro-s1-2', 'agro-s1-3', 'agri-s1-1', 'agri-s1-2', 'agri-s1-3'],
      createdAt: '2026-10-01T08:00:00.000Z',
      notes: 'Periode pendaftaran mata kuliah mengulang khusus Semester 1.'
    },
    {
      id: 'period-2025-2026-sem-3',
      semester: 3,
      academicYear: '2025/2026',
      title: 'Pendaftaran Mengulang Semester 3 — T.A. 2025/2026',
      isOpen: true,
      useSchedule: true,
      startDate: '2026-10-01T08:00',
      endDate: '2026-11-30T23:59',
      closedMessage: 'Pendaftaran Mengulang Semester 3 saat ini telah ditutup oleh pihak Admin Fakultas Pertanian.',
      offeredCourseIds: [
        'agro-1', 'agro-2', 'agro-3', 'agro-4', 'agro-5', 'agro-6', 'agro-7', 'agro-3a', 'agro-3b',
        'agri-10', 'agri-11', 'agri-12', 'agri-13', 'agri-14', 'agri-15', 'agri-3a', 'agri-3b'
      ],
      createdAt: '2026-10-01T08:00:00.000Z',
      notes: 'Periode pendaftaran mata kuliah mengulang Semester 3.'
    },
    {
      id: 'period-2025-2026-sem-5',
      semester: 5,
      academicYear: '2025/2026',
      title: 'Pendaftaran Mengulang Semester 5 — T.A. 2025/2026',
      isOpen: true,
      useSchedule: true,
      startDate: '2026-10-05T08:00',
      endDate: '2026-12-15T23:59',
      closedMessage: 'Pendaftaran Mengulang Semester 5 saat ini telah ditutup oleh pihak Admin Fakultas Pertanian.',
      offeredCourseIds: [
        'agro-8', 'agro-9', 'agro-5a', 'agro-5b', 'agro-5c', 'agro-5d',
        'agri-16', 'agri-17', 'agri-18', 'agri-5a', 'agri-5b', 'agri-5c', 'agri-5d'
      ],
      createdAt: '2026-10-05T08:00:00.000Z',
      notes: 'Periode pendaftaran mata kuliah mengulang Semester 5.'
    }
  ],
  semesterSchedules: {
    '1': {
      semester: 1,
      isOpen: true,
      useSchedule: true,
      startDate: '2026-10-01T08:00',
      endDate: '2026-11-20T23:59',
      closedMessage: 'Pendaftaran Mengulang Semester 1 saat ini telah ditutup oleh pihak Admin Fakultas Pertanian.'
    },
    '3': {
      semester: 3,
      isOpen: true,
      useSchedule: true,
      startDate: '2026-10-01T08:00',
      endDate: '2026-11-30T23:59',
      closedMessage: 'Pendaftaran Mengulang Semester 3 saat ini telah ditutup oleh pihak Admin Fakultas Pertanian. Silakan hubungi bagian akademik jika membutuhkan dispensasi keterlambatan.'
    },
    '5': {
      semester: 5,
      isOpen: true,
      useSchedule: true,
      startDate: '2026-10-05T08:00',
      endDate: '2026-12-15T23:59',
      closedMessage: 'Pendaftaran Mengulang Semester 5 saat ini telah ditutup oleh pihak Admin Fakultas Pertanian. Silakan hubungi bagian akademik jika membutuhkan dispensasi keterlambatan.'
    }
  },
  // Konfigurasi Kelas Beasiswa yang TIDAK Boleh Dipilih untuk Mengulang Per Semester
  restrictedRepeatClasses: {
    '3': ['Kelas Beasiswa'],
    '5': ['Kelas Beasiswa', 'Kelas D']
  },
  restrictedRepeatClassReason: {
    '3': 'Kelas Beasiswa pada Semester 3 dikhususkan bagi mahasiswa penerima beasiswa penuh dan tidak dibuka untuk kelas mengulang.',
    '5': 'Kelas Beasiswa dan Kelas D pada Semester 5 diperuntukkan bagi mahasiswa jalur beasiswa prestasi/kemitraan dan tidak dapat diambil untuk mengulang.'
  },
  registrationFlow: DEFAULT_REGISTRATION_FLOW
};
