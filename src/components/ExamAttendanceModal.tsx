import React, { useState, useMemo, useRef } from 'react';
import { CourseItem, SimpleRegistration, AdminSettings } from '../types';
import * as XLSX from 'xlsx';
import { 
  Printer, 
  Download, 
  FileSpreadsheet, 
  X, 
  BookOpen, 
  Calendar, 
  Clock, 
  Layers, 
  Users, 
  CheckCircle2, 
  Filter,
  RefreshCw,
  Building,
  GraduationCap,
  Sparkles
} from 'lucide-react';

interface ExamAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: CourseItem[];
  registrations: SimpleRegistration[];
  adminSettings: AdminSettings;
  defaultCourseId?: string;
  defaultClass?: string;
}

export const ExamAttendanceModal: React.FC<ExamAttendanceModalProps> = ({
  isOpen,
  onClose,
  courses,
  registrations,
  adminSettings,
  defaultCourseId,
  defaultClass
}) => {
  // 1. Selector State
  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => {
    if (defaultCourseId && courses.some(c => c.id === defaultCourseId)) return defaultCourseId;
    return courses[0]?.id || '';
  });

  const [selectedClass, setSelectedClass] = useState<string>(() => {
    return defaultClass || adminSettings.classOptions[0] || 'Kelas A';
  });

  const [examType, setExamType] = useState<'UTS' | 'UAS'>('UTS');
  const [academicYear, setAcademicYear] = useState<string>(() => {
    return adminSettings.activeAcademicYear || '2025/2026';
  });

  const [semesterText, setSemesterText] = useState<string>('');
  const [examRoom, setExamRoom] = useState<string>('R. 201');
  const [examDate, setExamDate] = useState<string>(() => {
    const today = new Date();
    return today.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  });
  const [customJurusan, setCustomJurusan] = useState<string>('');
  const [customProdi, setCustomProdi] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'approved_only' | 'all'>('approved_only');
  const [proctorName, setProctorName] = useState<string>('');

  // Selected Course Object
  const currentCourse = useMemo(() => {
    return courses.find(c => c.id === selectedCourseId) || courses[0];
  }, [courses, selectedCourseId]);

  // Sync / Derive defaults when course changes
  React.useEffect(() => {
    if (currentCourse) {
      // Semester: Ganjil / Genap or Semester number
      const semNum = Number(currentCourse.semester) || 3;
      const isGanjil = semNum % 2 !== 0;
      setSemesterText(`${isGanjil ? 'Ganjil' : 'Genap'} / Semester ${semNum}`);

      // Prodi & Jurusan defaults
      const prodiName = currentCourse.prodi?.toLowerCase() || '';
      if (prodiName.includes('agribisnis')) {
        setCustomProdi('Agribisnis');
        setCustomJurusan('Sosial Ekonomi Pertanian');
      } else {
        setCustomProdi('Agroteknologi');
        setCustomJurusan('Budidaya Pertanian');
      }
    }
  }, [currentCourse]);

  // Available Repeating Classes for this Course
  const availableClasses = useMemo(() => {
    if (currentCourse?.availableClasses && currentCourse.availableClasses.length > 0) {
      return currentCourse.availableClasses;
    }
    return adminSettings.classOptions || ['Kelas A', 'Kelas B', 'Kelas C', 'Kelas D', 'Kelas E'];
  }, [currentCourse, adminSettings.classOptions]);

  // Ensure valid selected class
  React.useEffect(() => {
    if (availableClasses.length > 0 && !availableClasses.includes(selectedClass) && selectedClass !== 'all') {
      setSelectedClass(availableClasses[0]);
    }
  }, [availableClasses, selectedClass]);

  // Filter students for this Course and Class
  const participantStudents = useMemo(() => {
    if (!currentCourse) return [];

    return registrations.filter(reg => {
      // Status filter
      if (statusFilter === 'approved_only' && reg.status !== 'approved') {
        return false;
      }
      if (reg.status === 'rejected') {
        return false;
      }

      // Check if student enrolled in this course & class
      const hasCourse = reg.selectedCourses.some(sc => {
        const matchesCourse = sc.courseId === currentCourse.id;
        const matchesClass = selectedClass === 'all' || sc.selectedClass === selectedClass;
        return matchesCourse && matchesClass;
      });

      return hasCourse;
    }).map(reg => {
      const courseEntry = reg.selectedCourses.find(sc => sc.courseId === currentCourse.id);
      return {
        id: reg.id,
        nim: reg.nim,
        nama: reg.nama,
        kelasAsal: reg.kelasAsal || '-',
        kelasMengulang: courseEntry?.selectedClass || selectedClass,
        angkatan: reg.angkatan,
        status: reg.status
      };
    }).sort((a, b) => a.nim.localeCompare(b.nim));
  }, [registrations, currentCourse, selectedClass, statusFilter]);

  // Prepare table rows (Batches of 20 rows per page to match standard A4 page template)
  const rowsPerPage = 20;
  const totalPages = Math.max(1, Math.ceil(participantStudents.length / rowsPerPage));

  // Generate pages with exact 20 rows each (filled with student data or blank padded)
  const pagesData = useMemo(() => {
    const pages = [];
    for (let p = 0; p < totalPages; p++) {
      const startIdx = p * rowsPerPage;
      const endIdx = startIdx + rowsPerPage;
      const pageStudents = participantStudents.slice(startIdx, endIdx);

      // Pad up to 20 rows
      const rows = [];
      for (let i = 0; i < rowsPerPage; i++) {
        const rowNumber = startIdx + i + 1;
        const student = pageStudents[i] || null;
        rows.push({
          rowNumber,
          student
        });
      }
      pages.push({
        pageNumber: p + 1,
        totalPages,
        rows
      });
    }
    return pages;
  }, [participantStudents, totalPages]);

  // Generate Standalone HTML Document
  const generatePrintHtml = () => {
    if (!currentCourse) return '';

    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Presensi_${examType}_${currentCourse.name}_${selectedClass}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 15mm 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    body {
      font-family: "Times New Roman", Times, Georgia, serif;
      color: #000;
      background: #fff;
      margin: 0;
      padding: 0;
      font-size: 11pt;
      line-height: 1.25;
    }
    .page-sheet {
      width: 100%;
      page-break-after: always;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 255mm;
    }
    .page-sheet:last-child {
      page-break-after: auto;
    }
    .header-grid {
      display: flex;
      justify-content: space-between;
      margin-bottom: 12px;
      font-size: 10.5pt;
    }
    .header-col {
      width: 48%;
    }
    .meta-row {
      display: flex;
      margin-bottom: 2px;
    }
    .meta-lbl {
      width: 130px;
      font-weight: bold;
    }
    .meta-sep {
      width: 16px;
      font-weight: bold;
      text-align: center;
    }
    .meta-val {
      flex: 1;
      font-weight: normal;
    }
    .attendance-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000;
      font-size: 9.5pt;
    }
    .attendance-table th, 
    .attendance-table td {
      border: 1px solid #000;
      padding: 3px 5px;
      vertical-align: middle;
    }
    .attendance-table th {
      font-weight: bold;
      text-align: center;
      background-color: #f7f7f7;
    }
    .col-no { width: 32px; text-align: center; }
    .col-kelas { width: 75px; text-align: center; }
    .col-nim { width: 95px; text-align: center; font-family: "Times New Roman", Times, serif; }
    .col-nama { width: 220px; text-align: left; padding-left: 6px; }
    .col-sub { width: 26px; text-align: center; }
    .col-ttd { width: 90px; }
    .row-data {
      height: 24px;
    }
    .footer-section {
      margin-top: 14px;
      display: flex;
      justify-content: space-between;
      font-size: 10.5pt;
    }
    .footer-col-left {
      width: 45%;
    }
    .footer-col-right {
      width: 45%;
      text-align: left;
      padding-left: 50px;
    }
    .sig-space {
      height: 55px;
    }
    .no-print-bar {
      background: #166534;
      color: #fff;
      padding: 10px 16px;
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    .btn-print {
      background: #eab308;
      color: #111;
      border: none;
      padding: 8px 16px;
      font-weight: bold;
      border-radius: 4px;
      cursor: pointer;
    }
    @media print {
      .no-print-bar { display: none !important; }
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div><strong>Presensi Ujian ${examType} - Fakultas Pertanian INSTIPER</strong> (Ukuran A4)</div>
    <button class="btn-print" onclick="window.print()">🖨️ Cetak Dokumen</button>
  </div>

  ${pagesData.map((page) => `
    <div class="page-sheet">
      <div>
        <!-- HEADER 2 KOLOM SESUAI GAMBAR TEMPLATE -->
        <div class="header-grid">
          <div class="header-col">
            <div class="meta-row">
              <span class="meta-lbl">Matakuliah</span>
              <span class="meta-sep">:</span>
              <span class="meta-val"><strong>${currentCourse.name}</strong></span>
            </div>
            <div class="meta-row">
              <span class="meta-lbl">Fakultas</span>
              <span class="meta-sep">:</span>
              <span class="meta-val">Fakultas Pertanian</span>
            </div>
            <div class="meta-row">
              <span class="meta-lbl">Program Studi</span>
              <span class="meta-sep">:</span>
              <span class="meta-val">${customProdi}</span>
            </div>
            <div class="meta-row">
              <span class="meta-lbl">Jurusan</span>
              <span class="meta-sep">:</span>
              <span class="meta-val">${customJurusan}</span>
            </div>
            <div class="meta-row">
              <span class="meta-lbl">Kelas Mengulang</span>
              <span class="meta-sep">:</span>
              <span class="meta-val"><strong>${selectedClass === 'all' ? 'Semua Kelas' : selectedClass}</strong></span>
            </div>
          </div>

          <div class="header-col">
            <div class="meta-row">
              <span class="meta-lbl">Ujian</span>
              <span class="meta-sep">:</span>
              <span class="meta-val"><strong>${examType}</strong></span>
            </div>
            <div class="meta-row">
              <span class="meta-lbl">Semester</span>
              <span class="meta-sep">:</span>
              <span class="meta-val">${semesterText}</span>
            </div>
            <div class="meta-row">
              <span class="meta-lbl">T.A.</span>
              <span class="meta-sep">:</span>
              <span class="meta-val">${academicYear}</span>
            </div>
            <div class="meta-row">
              <span class="meta-lbl">Ruang</span>
              <span class="meta-sep">:</span>
              <span class="meta-val">${examRoom || '-'}</span>
            </div>
            <div class="meta-row">
              <span class="meta-lbl">Tanggal</span>
              <span class="meta-sep">:</span>
              <span class="meta-val">${examDate}</span>
            </div>
          </div>
        </div>

        <!-- TABEL 20 BARIS DENGAN SUB-KOLOM NILAI (S, P, G) & TANDA TANGAN -->
        <table class="attendance-table">
          <thead>
            <tr>
              <th rowspan="2" class="col-no">No</th>
              <th rowspan="2" class="col-kelas">Kelas Asal</th>
              <th rowspan="2" class="col-nim">Nim</th>
              <th rowspan="2" class="col-nama">Nama</th>
              <th colspan="3">Nilai</th>
              <th rowspan="2" class="col-ttd">Tanda Tangan</th>
            </tr>
            <tr>
              <th class="col-sub">S</th>
              <th class="col-sub">P</th>
              <th class="col-sub">G</th>
            </tr>
          </thead>
          <tbody>
            ${page.rows.map(r => `
              <tr class="row-data">
                <td class="col-no">${r.rowNumber}</td>
                <td class="col-kelas">${r.student ? r.student.kelasAsal : ''}</td>
                <td class="col-nim">${r.student ? r.student.nim : ''}</td>
                <td class="col-nama">${r.student ? r.student.nama.toUpperCase() : ''}</td>
                <td class="col-sub"></td>
                <td class="col-sub"></td>
                <td class="col-sub"></td>
                <td class="col-ttd"></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- FOOTER / TANDA TANGAN PENGAWAS -->
      <div class="footer-section">
        <div class="footer-col-left">
          <div style="margin-bottom: 2px;">Jumlah Peserta : <strong>${participantStudents.length} Mahasiswa</strong></div>
          <div>Pengawas</div>
          <div class="sig-space"></div>
          <div>( ${proctorName ? proctorName : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;' } )</div>
        </div>

        <div class="footer-col-right">
          <div style="margin-bottom: 2px;">Yogyakarta, ${examDate}</div>
          <div style="color: transparent;">Dosen Penguji / Panitia</div>
          <div class="sig-space"></div>
          <div>(&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</div>
        </div>
      </div>
    </div>
  `).join('')}

</body>
</html>`;
  };

  // Trigger browser print with isolated iframe & window.print fallback
  const handlePrint = () => {
    try {
      const htmlContent = generatePrintHtml();
      const iframe = document.createElement('iframe');
      iframe.setAttribute('style', 'visibility: hidden; height: 0; width: 0; position: absolute; border: 0;');
      document.body.appendChild(iframe);
      
      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(htmlContent);
        doc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            try {
              document.body.removeChild(iframe);
            } catch (e) {}
          }, 1500);
        }, 350);
      } else {
        window.print();
      }
    } catch (err) {
      console.warn('Iframe print warning, using window.print:', err);
      window.print();
    }
  };

  // Download Standalone Print HTML (Anti-gagal, standard A4 guaranteed)
  const handleDownloadStandaloneHtml = () => {
    if (!currentCourse) return;
    const printHtml = generatePrintHtml();
    const blob = new Blob([printHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Presensi_${examType}_${currentCourse.name.replace(/\s+/g, '_')}_${selectedClass.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Export as Excel (.xlsx)
  const handleExportExcel = () => {
    if (!currentCourse) return;

    const dataRows = participantStudents.map((s, idx) => ({
      'No': idx + 1,
      'Kelas Asal': s.kelasAsal,
      'Nim': s.nim,
      'Nama': s.nama,
      'Nilai S': '',
      'Nilai P': '',
      'Nilai G': '',
      'Tanda Tangan': ''
    }));

    // Pad up to 20 rows if less than 20
    if (dataRows.length < 20) {
      for (let i = dataRows.length + 1; i <= 20; i++) {
        dataRows.push({
          'No': i,
          'Kelas Asal': '',
          'Nim': '',
          'Nama': '',
          'Nilai S': '',
          'Nilai P': '',
          'Nilai G': '',
          'Tanda Tangan': ''
        });
      }
    }

    const ws = XLSX.utils.json_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Presensi_${examType}`);

    const fileName = `Presensi_${examType}_${currentCourse.name.replace(/[^a-zA-Z0-9]/g, '_')}_${selectedClass.replace(/\s+/g, '_')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  if (!isOpen || !currentCourse) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm flex justify-center p-2 sm:p-4 print:p-0 print:bg-white print:overflow-visible print:static">
      <div className="relative w-full max-w-5xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col my-auto max-h-[96vh] print:max-h-none print:shadow-none print:border-none print:rounded-none print:w-full print:m-0 print:static">
        
        {/* ============================================================== */}
        {/* TOP TOOLBAR & CONTROLS (HIDDEN DURING PRINT) */}
        {/* ============================================================== */}
        <div className="shrink-0 p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 rounded-t-2xl print:hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-lg">
                  <Printer className="w-5 h-5" />
                </span>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">
                  Cetak Presensi Ujian (UTS / UAS)
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  Format Standar A4
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Format resmi presensi ujian Fakultas Pertanian INSTIPER. Data terisi otomatis berdasarkan registrasi mahasiswa yang disetujui.
              </p>
            </div>

            {/* Print & Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#008744] hover:bg-[#007038] text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer hover:shadow-lg active:scale-95"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak A4</span>
              </button>
              
              <button
                type="button"
                onClick={handleDownloadStandaloneHtml}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs rounded-xl border border-slate-300 dark:border-slate-700 transition-all cursor-pointer"
                title="Unduh file HTML untuk dicetak offline"
              >
                <Download className="w-4 h-4" />
                <span>Unduh HTML</span>
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-semibold text-xs rounded-xl border border-emerald-300 dark:border-emerald-800 transition-all cursor-pointer"
                title="Ekspor tabel presensi ke Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Form Filter & Parameters (Live Interactive Customization) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 text-xs">
            {/* 1. Mata Kuliah */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Mata Kuliah
              </label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              >
                {courses.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Sem {c.semester} - {c.sks} SKS)
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Kelas Mengulang */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Kelas Mengulang
              </label>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              >
                <option value="all">-- Semua Kelas Mengulang --</option>
                {availableClasses.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>

            {/* 3. Jenis Ujian (UTS / UAS) */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Jenis Ujian
              </label>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-200 dark:bg-slate-800 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setExamType('UTS')}
                  className={`py-1 rounded-md font-black text-center cursor-pointer transition-all ${
                    examType === 'UTS' 
                      ? 'bg-white dark:bg-slate-700 text-[#008744] dark:text-emerald-400 shadow-xs' 
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  UTS
                </button>
                <button
                  type="button"
                  onClick={() => setExamType('UAS')}
                  className={`py-1 rounded-md font-black text-center cursor-pointer transition-all ${
                    examType === 'UAS' 
                      ? 'bg-white dark:bg-slate-700 text-[#008744] dark:text-emerald-400 shadow-xs' 
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  UAS
                </button>
              </div>
            </div>

            {/* 4. Tahun Ajaran */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tahun Ajaran (T.A.)
              </label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                placeholder="misal: 2025/2026"
              />
            </div>

            {/* 5. Ruang Ujian */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Ruang Ujian
              </label>
              <input
                type="text"
                value={examRoom}
                onChange={(e) => setExamRoom(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                placeholder="misal: R. 201"
              />
            </div>

            {/* 6. Tanggal Ujian */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tanggal Ujian
              </label>
              <input
                type="text"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                placeholder="misal: 15 November 2026"
              />
            </div>

            {/* 7. Nama Pengawas (Opsional) */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nama Pengawas (Opsional)
              </label>
              <input
                type="text"
                value={proctorName}
                onChange={(e) => setProctorName(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                placeholder="Kosongkan jika diisi manual"
              />
            </div>

            {/* 8. Status Filter Pendaftar */}
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Sumber Data Mahasiswa
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="approved_only">Hanya yang Disetujui (Approved)</option>
                <option value="all">Semua Pendaftar Aktif</option>
              </select>
            </div>
          </div>

          {/* Quick Stats banner */}
          <div className="mt-3 flex items-center justify-between text-xs px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-medium">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Ditemukan: <strong>{participantStudents.length} Mahasiswa</strong> mengulang mata kuliah <strong>{currentCourse.name}</strong> ({selectedClass === 'all' ? 'Semua Kelas' : selectedClass})</span>
            </div>
            <div className="text-slate-500 dark:text-slate-400 font-mono">
              Total {totalPages} Lembar A4 (20 baris per lembar)
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* DOCUMENT PREVIEW CONTAINER (SERIF A4 FORMAT SAMA PERSIS GAMBAR) */}
        {/* ============================================================== */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200 dark:bg-slate-950 flex flex-col items-center print:p-0 print:bg-white print:overflow-visible">
          
          {pagesData.map((page) => (
            <div
              key={page.pageNumber}
              className="w-full max-w-[210mm] min-h-[297mm] bg-white text-black p-10 sm:p-14 shadow-xl border border-slate-300 mb-8 font-serif select-text flex flex-col justify-between print:m-0 print:border-none print:shadow-none print:w-full print:p-0 print:min-h-0 print:page-break-after-always print:max-w-none"
              style={{
                fontFamily: '"Times New Roman", Times, Georgia, serif',
                lineHeight: 1.3
              }}
            >
              <div>
                {/* 1. HEADER DUA KOLOM DENGAN TITIK DUA TERSEJAJAR (PERSIS LAMPIRAN) */}
                <div className="grid grid-cols-2 gap-6 text-[13px] mb-4 text-black">
                  
                  {/* Kolom Kiri Header */}
                  <div className="space-y-1">
                    <div className="grid grid-cols-[120px_14px_1fr] items-baseline">
                      <span className="font-bold">Matakuliah</span>
                      <span className="font-bold">:</span>
                      <span className="font-bold text-[13.5px] uppercase">{currentCourse.name}</span>
                    </div>
                    <div className="grid grid-cols-[120px_14px_1fr] items-baseline">
                      <span className="font-bold">Fakultas</span>
                      <span className="font-bold">:</span>
                      <span>Fakultas Pertanian</span>
                    </div>
                    <div className="grid grid-cols-[120px_14px_1fr] items-baseline">
                      <span className="font-bold">Program Studi</span>
                      <span className="font-bold">:</span>
                      <span>{customProdi}</span>
                    </div>
                    <div className="grid grid-cols-[120px_14px_1fr] items-baseline">
                      <span className="font-bold">Jurusan</span>
                      <span className="font-bold">:</span>
                      <span>{customJurusan}</span>
                    </div>
                    <div className="grid grid-cols-[120px_14px_1fr] items-baseline">
                      <span className="font-bold">Kelas Mengulang</span>
                      <span className="font-bold">:</span>
                      <span className="font-bold uppercase">{selectedClass === 'all' ? 'Semua Kelas' : selectedClass}</span>
                    </div>
                  </div>

                  {/* Kolom Kanan Header */}
                  <div className="space-y-1">
                    <div className="grid grid-cols-[90px_14px_1fr] items-baseline">
                      <span className="font-bold">Ujian</span>
                      <span className="font-bold">:</span>
                      <span className="font-bold text-[13.5px] uppercase">{examType}</span>
                    </div>
                    <div className="grid grid-cols-[90px_14px_1fr] items-baseline">
                      <span className="font-bold">Semester</span>
                      <span className="font-bold">:</span>
                      <span>{semesterText}</span>
                    </div>
                    <div className="grid grid-cols-[90px_14px_1fr] items-baseline">
                      <span className="font-bold">T.A.</span>
                      <span className="font-bold">:</span>
                      <span>{academicYear}</span>
                    </div>
                    <div className="grid grid-cols-[90px_14px_1fr] items-baseline">
                      <span className="font-bold">Ruang</span>
                      <span className="font-bold">:</span>
                      <span>{examRoom || '-'}</span>
                    </div>
                    <div className="grid grid-cols-[90px_14px_1fr] items-baseline">
                      <span className="font-bold">Tanggal</span>
                      <span className="font-bold">:</span>
                      <span>{examDate}</span>
                    </div>
                  </div>
                </div>

                {/* 2. TABEL PRESENSI (PERSIS GAMBAR LAMPIRAN USER) */}
                <table className="w-full border-collapse border border-black text-[12px] text-black">
                  <thead>
                    <tr className="bg-white">
                      <th rowSpan={2} className="border border-black px-1.5 py-1 text-center font-bold w-10">
                        No
                      </th>
                      <th rowSpan={2} className="border border-black px-2 py-1 text-center font-bold w-24">
                        Kelas Asal
                      </th>
                      <th rowSpan={2} className="border border-black px-2 py-1 text-center font-bold w-32">
                        Nim
                      </th>
                      <th rowSpan={2} className="border border-black px-3 py-1 text-center font-bold">
                        Nama
                      </th>
                      <th colSpan={3} className="border border-black px-2 py-0.5 text-center font-bold w-24">
                        Nilai
                      </th>
                      <th rowSpan={2} className="border border-black px-2 py-1 text-center font-bold w-32">
                        Tanda Tangan
                      </th>
                    </tr>
                    <tr className="bg-white">
                      <th className="border border-black px-1.5 py-0.5 text-center font-bold w-8">
                        S
                      </th>
                      <th className="border border-black px-1.5 py-0.5 text-center font-bold w-8">
                        P
                      </th>
                      <th className="border border-black px-1.5 py-0.5 text-center font-bold w-8">
                        G
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {page.rows.map(r => (
                      <tr key={r.rowNumber} className="h-7">
                        <td className="border border-black px-1 text-center font-serif text-[12px]">
                          {r.rowNumber}
                        </td>
                        <td className="border border-black px-2 text-center font-serif text-[12px]">
                          {r.student ? r.student.kelasAsal : ''}
                        </td>
                        <td className="border border-black px-2 text-center font-serif text-[12px] tracking-wide">
                          {r.student ? r.student.nim : ''}
                        </td>
                        <td className="border border-black px-2 text-left font-serif text-[12px] uppercase">
                          {r.student ? r.student.nama : ''}
                        </td>
                        <td className="border border-black text-center"></td>
                        <td className="border border-black text-center"></td>
                        <td className="border border-black text-center"></td>
                        <td className="border border-black px-1 text-xs">
                          {/* Blank for student handwritten signature */}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 3. FOOTER SIGNATURE SECTION (PERSIS GAMBAR LAMPIRAN USER) */}
              <div className="mt-8 pt-2 grid grid-cols-2 gap-8 text-[12.5px] text-black page-break-inside-avoid">
                {/* Footer Kiri: Jumlah Peserta & Pengawas */}
                <div>
                  <div className="mb-1">
                    Jumlah Peserta : <span className="font-bold">{participantStudents.length} Mahasiswa</span>
                  </div>
                  <div>Pengawas</div>
                  <div className="h-16"></div>
                  <div>
                    ( {proctorName ? proctorName : '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'} )
                  </div>
                </div>

                {/* Footer Kanan: Kota, Tanggal & Tanda Tangan */}
                <div className="text-left pl-10">
                  <div className="mb-1">
                    Yogyakarta, {examDate}
                  </div>
                  <div className="text-transparent select-none">-</div>
                  <div className="h-16"></div>
                  <div>
                    ( {'\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'} )
                  </div>
                </div>
              </div>
            </div>
          ))}

        </div>

      </div>
    </div>
  );
};
