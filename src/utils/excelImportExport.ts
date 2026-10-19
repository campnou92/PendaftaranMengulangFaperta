import * as XLSX from 'xlsx';
import { CourseItem, AdminSettings, isClassRestrictedForRepeat, getRestrictedClassesForSemester } from '../types';

/**
 * Unduh Template Excel / CSV untuk Formulir Pendaftaran Mahasiswa Mengulang
 */
export function downloadRegistrationTemplate(
  courses: CourseItem[],
  adminSettings: AdminSettings,
  selectedSemester: string = '3',
  format: 'xlsx' | 'csv' = 'xlsx'
) {
  // Filter courses sesuai tab semester saat ini atau semua
  const targetCourses = courses.filter(c => {
    if (selectedSemester === '3') return c.semester === 3;
    if (selectedSemester === '5') return c.semester === 5;
    return true;
  });

  const sem3Restricted = getRestrictedClassesForSemester(3, adminSettings);
  const sem5Restricted = getRestrictedClassesForSemester(5, adminSettings);

  // Buat data baris
  const rows: any[][] = [
    [
      'PILIH_MENGULANG (Y/T)',
      'KODE_MK',
      'NAMA_MATAKULIAH',
      'SKS',
      'SEMESTER',
      'PROGRAM_STUDI',
      'PILIHAN_KELAS',
      'CATATAN_KELAS'
    ]
  ];

  targetCourses.forEach((c, idx) => {
    // Pilih kelas default yang bukan beasiswa
    const availClasses = c.availableClasses && c.availableClasses.length > 0
      ? c.availableClasses
      : adminSettings.classOptions;
    const allowedClasses = availClasses.filter(cls => !isClassRestrictedForRepeat(cls, c.semester, adminSettings));
    const defaultCls = allowedClasses[0] || availClasses[0] || 'Kelas A';

    rows.push([
      idx < 2 ? 'Y' : 'T', // Berikan contoh 'Y' pada 2 baris awal
      c.id,
      c.name,
      c.sks,
      c.semester,
      c.prodi === 'agroteknologi' ? 'Agroteknologi' : 'Agribisnis',
      defaultCls,
      `Opsi kelas tersedia: ${availClasses.join(', ')} (Dilarang pilih Kelas Beasiswa)`
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Set lebar kolom agar rapi
  ws['!cols'] = [
    { wch: 22 }, // PILIH_MENGULANG (Y/T)
    { wch: 12 }, // KODE_MK
    { wch: 48 }, // NAMA_MATAKULIAH
    { wch: 8 },  // SKS
    { wch: 10 }, // SEMESTER
    { wch: 16 }, // PROGRAM_STUDI
    { wch: 18 }, // PILIHAN_KELAS
    { wch: 60 }  // CATATAN_KELAS
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Pilihan_Matakuliah');

  // Sheet Petunjuk Pengisian
  const petunjukRows: any[][] = [
    ['PETUNJUK PENGISIAN TEMPLATE PENDAFTARAN MENGULANG MATAKULIAH'],
    ['FAKULTAS PERTANIAN — SISTEM AKADEMIK BAAK'],
    [''],
    ['1.', 'KOLOM PILIH_MENGULANG: Isi dengan huruf "Y" untuk memilih mata kuliah yang akan diulang, atau "T" jika tidak diambil.'],
    ['2.', 'KOLOM PILIHAN_KELAS: Isi dengan salah satu nama kelas (contoh: Kelas A, Kelas B, Kelas C, Kelas D, Kelas Karyawan).'],
    ['3.', 'KETENTUAN KELAS BEASISWA (PENTING!):'],
    ['   ', `• Semester 3: Kelas yang berstatus beasiswa (${sem3Restricted.length > 0 ? sem3Restricted.join(', ') : 'Tidak ada'}) TIDAK BOLEH dipilih untuk mengulang.`],
    ['   ', `• Semester 5: Kelas yang berstatus beasiswa (${sem5Restricted.length > 0 ? sem5Restricted.join(', ') : 'Tidak ada'}) TIDAK BOLEH dipilih untuk mengulang.`],
    ['4.', 'BATAS MAKSIMAL SKS: Default 24 SKS (atau batas khusus sesuai angkatan pendaftar).'],
    ['5.', 'Setelah mengisi file ini, simpan dan unggah kembali pada tombol "Import File Excel/CSV" pada Formulir Pendaftaran.']
  ];

  const wsPetunjuk = XLSX.utils.aoa_to_sheet(petunjukRows);
  wsPetunjuk['!cols'] = [{ wch: 6 }, { wch: 95 }];
  XLSX.utils.book_append_sheet(wb, wsPetunjuk, 'Petunjuk_Pengisian');

  const filename = `Template_Pendaftaran_Mengulang_Semester_${selectedSemester}_${Date.now()}.${format === 'csv' ? 'csv' : 'xlsx'}`;

  if (format === 'csv') {
    XLSX.writeFile(wb, filename, { bookType: 'csv' });
  } else {
    XLSX.writeFile(wb, filename, { bookType: 'xlsx' });
  }
}

/**
 * Unduh Template Excel / CSV Master Mata Kuliah untuk Admin BAAK
 */
export function downloadMasterCoursesTemplate(format: 'xlsx' | 'csv' = 'xlsx') {
  const rows: any[][] = [
    [
      'KODE_MATAKULIAH',
      'NAMA_MATAKULIAH',
      'SKS',
      'SEMESTER',
      'PROGRAM_STUDI',
      'KELAS_TERSEDIA',
      'TAHUN_AJARAN'
    ],
    [
      'agro-101',
      'Agroklimatologi dan Cuaca Terapan',
      3,
      3,
      'agroteknologi',
      'Kelas A, Kelas B, Kelas C, Kelas D, Kelas Karyawan',
      '2025/2026'
    ],
    [
      'agro-102',
      'Teknologi Pemuliaan Tanaman Tropika',
      3,
      5,
      'agroteknologi',
      'Kelas A, Kelas B, Kelas C, Kelas Karyawan',
      '2025/2026'
    ],
    [
      'agri-201',
      'Manajemen Agribisnis Berkelanjutan',
      3,
      3,
      'agribisnis',
      'Kelas A, Kelas B, Kelas C, Kelas Karyawan',
      '2025/2026'
    ],
    [
      'agri-202',
      'Kewirausahaan dan Ekspor Komoditas',
      2,
      5,
      'agribisnis',
      'Kelas A, Kelas B, Kelas C, Kelas D, Kelas Karyawan',
      '2025/2026'
    ]
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);

  ws['!cols'] = [
    { wch: 18 }, // KODE_MATAKULIAH
    { wch: 42 }, // NAMA_MATAKULIAH
    { wch: 8 },  // SKS
    { wch: 12 }, // SEMESTER
    { wch: 18 }, // PROGRAM_STUDI
    { wch: 55 }, // KELAS_TERSEDIA
    { wch: 16 }  // TAHUN_AJARAN
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Master_Matakuliah');

  const filename = `Template_Master_Matakuliah_BAAK_${Date.now()}.${format === 'csv' ? 'csv' : 'xlsx'}`;

  if (format === 'csv') {
    XLSX.writeFile(wb, filename, { bookType: 'csv' });
  } else {
    XLSX.writeFile(wb, filename, { bookType: 'xlsx' });
  }
}

/**
 * Parsing file pendaftaran dari Excel / CSV
 */
export async function parseRegistrationFile(
  file: File
): Promise<{ rows: any[]; error?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { rows: [], error: 'File Excel tidak memiliki lembar kerja (sheet).' };
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });

    if (!rawRows || rawRows.length < 2) {
      return { rows: [], error: 'File kosong atau tidak memiliki baris data mata kuliah.' };
    }

    // Normalisasi header
    const headers = (rawRows[0] || []).map((h: any) => String(h || '').trim().toUpperCase());

    // Cari index kolom
    let colPilih = headers.findIndex((h: string) => h.includes('PILIH') || h.includes('CENTANG') || h.includes('AMBIL'));
    let colNama = headers.findIndex((h: string) => h.includes('NAMA') || h.includes('MATAKULIAH'));
    let colKode = headers.findIndex((h: string) => h.includes('KODE') || h.includes('ID'));
    let colSks = headers.findIndex((h: string) => h === 'SKS' || h.includes('SKS'));
    let colSemester = headers.findIndex((h: string) => h.includes('SEMESTER') || h === 'SMT');
    let colProdi = headers.findIndex((h: string) => h.includes('PRODI') || h.includes('JURUSAN'));
    let colKelas = headers.findIndex((h: string) => h.includes('KELAS'));

    // Fallbacks jika template standar
    if (colPilih === -1) colPilih = 0;
    if (colKode === -1) colKode = 1;
    if (colNama === -1) colNama = 2;
    if (colSks === -1) colSks = 3;
    if (colSemester === -1) colSemester = 4;
    if (colProdi === -1) colProdi = 5;
    if (colKelas === -1) colKelas = 6;

    const parsed: any[] = [];

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;

      const pilihRaw = String(row[colPilih] || '').trim().toUpperCase();
      const isSelected = pilihRaw === 'Y' || pilihRaw === 'YES' || pilihRaw === 'YA' || pilihRaw === '1' || pilihRaw === 'TRUE' || pilihRaw === 'CENTANG';

      const nama = String(row[colNama] || '').trim();
      const kode = String(row[colKode] || '').trim();
      const sks = Number(row[colSks]) || 2;
      const semester = Number(row[colSemester]) || 3;
      const prodi = String(row[colProdi] || '').toLowerCase().includes('agro') ? 'agroteknologi' : 'agribisnis';
      const kelas = String(row[colKelas] || '').trim() || 'Kelas A';

      if (nama || kode) {
        parsed.push({
          index: i,
          isSelected,
          kode,
          nama,
          sks,
          semester,
          prodi,
          kelas
        });
      }
    }

    return { rows: parsed };
  } catch (err: any) {
    return { rows: [], error: `Gagal membaca file: ${err.message || 'Format tidak sesuai'}` };
  }
}

/**
 * Parsing file master mata kuliah untuk Admin BAAK
 */
export async function parseMasterCoursesFile(
  file: File,
  defaultClasses: string[]
): Promise<{ courses: CourseItem[]; error?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return { courses: [], error: 'File Excel tidak memiliki sheet.' };
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<any>(worksheet, { header: 1 });

    if (!rawRows || rawRows.length < 2) {
      return { courses: [], error: 'File tidak memiliki data mata kuliah untuk diimpor.' };
    }

    const headers = (rawRows[0] || []).map((h: any) => String(h || '').trim().toUpperCase());

    let colKode = headers.findIndex((h: string) => h.includes('KODE') || h.includes('ID'));
    let colNama = headers.findIndex((h: string) => h.includes('NAMA') || h.includes('MATAKULIAH'));
    let colSks = headers.findIndex((h: string) => h === 'SKS' || h.includes('SKS'));
    let colSemester = headers.findIndex((h: string) => h.includes('SEMESTER') || h === 'SMT');
    let colProdi = headers.findIndex((h: string) => h.includes('PRODI') || h.includes('JURUSAN'));
    let colKelas = headers.findIndex((h: string) => h.includes('KELAS'));
    let colTahun = headers.findIndex((h: string) => h.includes('TAHUN') || h.includes('AKADEMIK') || h.includes('AJARAN') || h === 'TA');

    if (colKode === -1) colKode = 0;
    if (colNama === -1) colNama = 1;
    if (colSks === -1) colSks = 2;
    if (colSemester === -1) colSemester = 3;
    if (colProdi === -1) colProdi = 4;
    if (colKelas === -1) colKelas = 5;

    const results: CourseItem[] = [];

    for (let i = 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;

      const nama = String(row[colNama] || '').trim();
      if (!nama) continue;

      const kodeRaw = String(row[colKode] || '').trim();
      const kode = kodeRaw || `import-${Date.now()}-${i}`;
      const sks = Math.max(1, Math.min(6, Number(row[colSks]) || 2));
      const semester = Math.max(1, Math.min(8, Number(row[colSemester]) || 3));
      
      const prodiRaw = String(row[colProdi] || '').toLowerCase();
      const prodi = prodiRaw.includes('agro') ? 'agroteknologi' : 'agribisnis';

      const kelasRaw = String(row[colKelas] || '').trim();
      let availableClasses: string[] = defaultClasses;
      if (kelasRaw) {
        const splitClasses = kelasRaw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
        if (splitClasses.length > 0) {
          availableClasses = splitClasses;
        }
      }

      const tahunRaw = colTahun !== -1 ? String(row[colTahun] || '').trim() : '';

      results.push({
        id: kode,
        name: nama,
        sks,
        prodi,
        semester,
        availableClasses,
        academicYear: tahunRaw || undefined
      });
    }

    if (results.length === 0) {
      return { courses: [], error: 'Tidak ada baris mata kuliah valid yang ditemukan dalam file.' };
    }

    return { courses: results };
  } catch (err: any) {
    return { courses: [], error: `Gagal membaca file: ${err.message || 'Format tidak didukung'}` };
  }
}
