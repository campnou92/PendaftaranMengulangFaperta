import { SimpleRegistration } from '../types';

export const INITIAL_REGISTRATIONS: SimpleRegistration[] = [
  {
    id: 'REG-2026-001',
    registrationDate: '12 Oktober 2026, 09:15 WIB',
    status: 'approved',
    targetSemester: 'Semester 3',
    email: 'dimas.pertanian@gmail.com',
    angkatan: '2023',
    nama: 'Dimas Kurniawan',
    nim: '2210511001',
    noWa: '081234567890',
    kelasAsal: 'Agroteknologi 2A',
    selectedCourses: [
      {
        courseId: 'agro-1',
        name: 'Matematika',
        sks: 1,
        prodi: 'agroteknologi',
        semester: 3,
        selectedClass: 'Kelas A'
      },
      {
        courseId: 'agro-4',
        name: 'Penilaian Kesesuaian Lahan dan Pemetaan',
        sks: 3,
        prodi: 'agroteknologi',
        semester: 3,
        selectedClass: 'Kelas B'
      }
    ],
    totalSks: 4,
    adminNotes: 'Terverifikasi'
  },
  {
    id: 'REG-2026-002',
    registrationDate: '12 Oktober 2026, 14:30 WIB',
    status: 'pending',
    targetSemester: 'Semester 3',
    email: 'sarah.agribisnis@gmail.com',
    angkatan: '2023',
    nama: 'Sarah Amanda',
    nim: '2310512042',
    noWa: '085712345678',
    kelasAsal: 'Agribisnis 2B',
    selectedCourses: [
      {
        courseId: 'agri-10',
        name: 'Ekonomi Matematika',
        sks: 1,
        prodi: 'agribisnis',
        semester: 3,
        selectedClass: 'Kelas A'
      },
      {
        courseId: 'agri-13',
        name: 'PU Manajemen Agribisnis',
        sks: 2,
        prodi: 'agribisnis',
        semester: 3,
        selectedClass: 'Kelas C'
      }
    ],
    totalSks: 3,
    adminNotes: 'Menunggu konfirmasi'
  },
  {
    id: 'REG-2026-003',
    registrationDate: '13 Oktober 2026, 10:20 WIB',
    status: 'approved',
    targetSemester: 'Semester 5',
    email: 'rizky.agrotek5@gmail.com',
    angkatan: '2022',
    nama: 'Rizky Pratama',
    nim: '2210515088',
    noWa: '081399887766',
    kelasAsal: 'Agroteknologi 3A',
    paymentStatus: 'pending',
    paymentNote: 'Menunggu transfer ke Bank Mandiri',
    selectedCourses: [
      {
        courseId: 'agro-8',
        name: 'Iklim dan Pengelolaan Sumber Daya Tanah dan Air',
        sks: 4,
        prodi: 'agroteknologi',
        semester: 5,
        selectedClass: 'Kelas A'
      },
      {
        courseId: 'agro-9',
        name: 'Prkt Blok Persiapan Lahan',
        sks: 4,
        prodi: 'agroteknologi',
        semester: 5,
        selectedClass: 'Kelas B'
      },
      {
        courseId: 'agro-5a',
        name: 'Pengendalian Hama & Penyakit Terpadu',
        sks: 3,
        prodi: 'agroteknologi',
        semester: 5,
        selectedClass: 'Kelas A'
      }
    ],
    totalSks: 11,
    adminNotes: 'Disetujui untuk semester 5'
  },
  {
    id: 'REG-2026-004',
    registrationDate: '13 Oktober 2026, 11:45 WIB',
    status: 'approved',
    targetSemester: 'Semester 3',
    email: 'maya.anggraini21@gmail.com',
    angkatan: '2021',
    nama: 'Maya Anggraini',
    nim: '2110513019',
    noWa: '082188990011',
    kelasAsal: 'Agroteknologi 4B',
    paymentStatus: 'paid',
    paymentDate: '13 Oktober 2026, 13:00 WIB',
    paymentNote: 'Bukti transfer BNI Rp 300.000 sudah dikirim via WA',
    selectedCourses: [
      {
        courseId: 'agro-3',
        name: 'Fisiologi Tumbuhan',
        sks: 3,
        prodi: 'agroteknologi',
        semester: 3,
        selectedClass: 'Kelas B'
      },
      {
        courseId: 'agro-4',
        name: 'Penilaian Kesesuaian Lahan dan Pemetaan',
        sks: 3,
        prodi: 'agroteknologi',
        semester: 3,
        selectedClass: 'Kelas A'
      }
    ],
    totalSks: 6,
    adminNotes: 'Validasi berkas lengkap'
  },
  {
    id: 'REG-2026-005',
    registrationDate: '13 Oktober 2026, 13:10 WIB',
    status: 'approved',
    targetSemester: 'Semester 5',
    email: 'bagas.wicaksono20@gmail.com',
    angkatan: '2020',
    nama: 'Bagas Wicaksono',
    nim: '2010514055',
    noWa: '085277889900',
    kelasAsal: 'Agribisnis 4A',
    paymentStatus: 'verified',
    paymentDate: '13 Oktober 2026, 14:15 WIB',
    paymentNote: 'Lunas & terverifikasi oleh Staf Keuangan BAAK',
    selectedCourses: [
      {
        courseId: 'agri-12',
        name: 'Riset Operasi',
        sks: 3,
        prodi: 'agribisnis',
        semester: 5,
        selectedClass: 'Kelas A'
      },
      {
        courseId: 'agri-16',
        name: 'Sistem Informasi Manajemen',
        sks: 3,
        prodi: 'agribisnis',
        semester: 5,
        selectedClass: 'Kelas C'
      },
      {
        courseId: 'agri-14',
        name: 'Manajemen Keuangan',
        sks: 2,
        prodi: 'agribisnis',
        semester: 5,
        selectedClass: 'Kelas B'
      }
    ],
    totalSks: 8,
    adminNotes: 'Prioritas angkatan akhir'
  }
];
