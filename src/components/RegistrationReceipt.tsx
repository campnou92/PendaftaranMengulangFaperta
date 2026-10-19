import React, { useState } from 'react';
import { SimpleRegistration, AdminSettings, getMaxSksForBatch } from '../types';
import { Printer, ArrowLeft, CheckCircle2, CreditCard, Download, FileCheck, Info, FileText } from 'lucide-react';

interface RegistrationReceiptProps {
  registration: SimpleRegistration;
  adminSettings?: AdminSettings;
  onBack?: () => void;
}

export const RegistrationReceipt: React.FC<RegistrationReceiptProps> = ({ 
  registration, 
  adminSettings, 
  onBack 
}) => {
  const [printTipOpen, setPrintTipOpen] = useState(false);

  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      console.error('Window print error:', e);
      // Fallback: trigger HTML download
      handleDownloadHtml();
    }
  };

  const maxAllowedSks = getMaxSksForBatch(registration.angkatan, adminSettings);

  // Biaya per SKS calculation
  const isFeeSystemActive = adminSettings?.feePerSksEnabled ?? true;
  const paidBatches = adminSettings?.paidBatches ?? ['2020', '2021', '2022'];
  const costPerSks = adminSettings?.costPerSks ?? 50000;
  
  const isPaidBatch = isFeeSystemActive && paidBatches.includes(registration.angkatan);
  const totalBiaya = registration.totalSks * costPerSks;

  const paymentInstructions = adminSettings?.paymentInstructions || 
    'Pemberitahuan: Mahasiswa angkatan yang bersangkutan dikenakan kewajiban pembayaran biaya mengulang mata kuliah sesuai ketentuan akademik Fakultas Pertanian INSTIPER.';
  const paymentAccountInfo = adminSettings?.paymentAccountInfo || 
    'Bank BNI / Mandiri Rekening Resmi Fakultas Pertanian INSTIPER Yogyakarta.';

  // Fitur Unduh Dokumen HTML Siap Cetak (Solusi Mandiri & Anti-Gagal untuk Browser/HP/Iframe)
  const handleDownloadHtml = () => {
    const courseRows = registration.selectedCourses.map((c, i) => `
      <tr>
        <td style="text-align:center; padding: 6px 8px; border: 1px solid #333; font-weight: bold;">${i + 1}</td>
        <td style="padding: 6px 8px; border: 1px solid #333;">
          <div style="font-weight: 600;">${c.name}</div>
          <div style="font-size: 9px; color: #555; font-family: monospace;">${c.courseId}</div>
        </td>
        <td style="padding: 6px 8px; border: 1px solid #333; text-transform: capitalize;">${c.prodi}</td>
        <td style="text-align:center; padding: 6px 8px; border: 1px solid #333; font-weight: 600;">Sem ${c.semester || '-'}</td>
        <td style="text-align:center; padding: 6px 8px; border: 1px solid #333; font-weight: bold; color: #00702F;">${c.selectedClass}</td>
        <td style="text-align:center; padding: 6px 8px; border: 1px solid #333; font-weight: bold;">${c.sks} SKS</td>
      </tr>
    `).join('');

    const feeSection = isPaidBatch ? `
      <div style="margin: 12px 0; padding: 10px 14px; border: 1px solid #444; border-radius: 6px; font-size: 11px; background: #fafafa;">
        <div style="display:flex; justify-content:space-between; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 4px;">
          <strong style="text-transform: uppercase;">Kewajiban Pembayaran Biaya Mengulang:</strong>
          <strong style="font-size: 13px;">Rp ${totalBiaya.toLocaleString('id-ID')}</strong>
        </div>
        <p style="margin: 3px 0; color: #222;">${paymentInstructions}</p>
        <p style="margin: 3px 0; font-family: monospace; font-weight: bold;">${paymentAccountInfo}</p>
      </div>
    ` : '';

    const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>KRS_Mengulang_${registration.nim}_${registration.nama.replace(/\s+/g, '_')}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 15mm 12mm 15mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #111; margin: 0; padding: 10px; font-size: 11pt; line-height: 1.35; background: #fff; }
    .header-box { text-align: center; border-bottom: 3px double #111; padding-bottom: 8px; margin-bottom: 14px; }
    .univ-title { font-size: 15pt; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; margin: 0; }
    .faculty-title { font-size: 13pt; font-weight: 900; color: #166534; text-transform: uppercase; margin: 2px 0; }
    .prodi-title { font-size: 10pt; font-weight: 600; margin: 2px 0; }
    .address-title { font-size: 8.5pt; color: #555; margin: 2px 0; }
    .meta-bar { display: flex; justify-content: space-between; font-size: 9pt; font-family: monospace; border-top: 1px solid #ccc; margin-top: 6px; padding-top: 4px; }
    .doc-title { text-align: center; margin: 12px 0 14px 0; }
    .doc-title h2 { font-size: 12pt; font-weight: 900; text-transform: uppercase; text-decoration: underline; margin: 0; }
    .identity-table, .course-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10pt; }
    .identity-table td { padding: 5px 8px; border: 1px solid #333; }
    .identity-table .lbl { font-weight: bold; background: #f3f4f6; width: 120px; }
    .course-table th { background: #f3f4f6; padding: 7px 8px; border: 1px solid #333; font-weight: 800; font-size: 10pt; }
    .signature-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 40px; margin-top: 25px; text-align: center; font-size: 9.5pt; page-break-inside: avoid; }
    .sig-col { display: flex; flex-direction: column; justify-content: space-between; height: 115px; }
    .alur-box { margin-top: 12px; padding: 8px 12px; background: #f9f9f9; border-left: 3px solid #166534; font-size: 8.5pt; color: #333; page-break-inside: avoid; }
    .no-print-bar { background: #166534; color: #fff; padding: 10px 16px; border-radius: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; }
    .btn-print { background: #EAB308; color: #111; font-weight: 800; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; }
    @media print {
      body { padding: 0; }
      .no-print-bar { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div><strong>Dokumen Resmi KRS Pengulangan INSTIPER</strong> — Siap Cetak (A4)</div>
    <button class="btn-print" onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
  </div>

  <div class="header-box">
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px;">
      <tr>
        <td style="width: 80px; text-align: center; vertical-align: middle;">
          <img src="/logo_instiper.png" alt="Logo INSTIPER" style="width: 72px; height: 72px; object-fit: contain;" />
        </td>
        <td style="text-align: center; vertical-align: middle;">
          <div class="univ-title">INSTITUT PERTANIAN STIPER YOGYAKARTA</div>
          <div class="faculty-title">FAKULTAS PERTANIAN</div>
          <div class="prodi-title">Program Studi Agroteknologi (S1) &amp; Program Studi Agribisnis (S1)</div>
          <div class="address-title">Jl. Nangka II, Krodan, Maguwoharjo, Kec. Depok, Kabupaten Sleman, Daerah Istimewa Yogyakarta 55281</div>
        </td>
        <td style="width: 80px;" aria-hidden="true"></td>
      </tr>
    </table>
    <div class="meta-bar">
      <span>No. Dokumen: KRS-ULANG/${registration.id}</span>
      <span>Tgl Registrasi: ${registration.registrationDate}</span>
    </div>
  </div>

  <div class="doc-title">
    <h2>KRS PENGULANGAN MATAKULIAH (${(registration.targetSemester || 'SEMESTER TERPILIH').toUpperCase()})</h2>
    <div style="font-size: 10pt; font-weight: bold; margin-top: 2px; color: #166534;">TAHUN AKADEMIK ${registration.academicYear || adminSettings?.activeAcademicYear || '2025/2026'} (${(registration.academicTerm || adminSettings?.activeTerm || 'GANJIL').toUpperCase()})</div>
    <div style="font-size: 9pt; color: #555; font-weight: 500; margin-top: 2px;">Dokumen Resmi Registrasi Akademik Mahasiswa</div>
  </div>

  <table class="identity-table">
    <tr>
      <td class="lbl">Nama Lengkap</td>
      <td style="font-weight: bold; text-transform: uppercase;">${registration.nama}</td>
      <td class="lbl">NIM</td>
      <td style="font-family: monospace; font-weight: bold;">${registration.nim}</td>
    </tr>
    <tr>
      <td class="lbl">Tahun Akademik</td>
      <td style="font-weight: bold; color: #166534;">${registration.academicYear || adminSettings?.activeAcademicYear || '2025/2026'} (${registration.academicTerm || adminSettings?.activeTerm || 'Ganjil'})</td>
      <td class="lbl">Portal Semester</td>
      <td style="font-weight: bold;">${registration.targetSemester || 'Semester Terpilih'}</td>
    </tr>
    <tr>
      <td class="lbl">Email</td>
      <td>${registration.email}</td>
      <td class="lbl">Angkatan</td>
      <td><strong>Angkatan ${registration.angkatan}</strong> (${isPaidBatch ? 'Dikenakan Biaya SKS' : 'Bebas Biaya SKS'})</td>
    </tr>
    <tr>
      <td class="lbl">No. WhatsApp</td>
      <td style="font-family: monospace;">${registration.noWa}</td>
      <td class="lbl">Kelas Asal</td>
      <td>${registration.kelasAsal}</td>
    </tr>
  </table>

  <table class="course-table">
    <thead>
      <tr>
        <th style="width: 35px; text-align: center;">No</th>
        <th>Nama Mata Kuliah</th>
        <th style="width: 120px;">Program Studi</th>
        <th style="width: 80px; text-align: center;">Semester</th>
        <th style="width: 90px; text-align: center;">Kelas</th>
        <th style="width: 80px; text-align: center;">SKS</th>
      </tr>
    </thead>
    <tbody>
      ${courseRows}
    </tbody>
  </table>

  <div style="display:flex; justify-content:space-between; align-items:center; margin: 8px 0; font-size: 10pt;">
    <div style="display:inline-flex; border: 1px solid #111; border-radius: 4px; overflow: hidden;">
      <span style="background: #f3f4f6; padding: 4px 10px; font-weight: bold; border-right: 1px solid #111;">Total SKS Diambil</span>
      <span style="padding: 4px 12px; font-weight: 900; color: #00702F;">${registration.totalSks} SKS</span>
    </div>
    <span style="font-size: 9pt; color: #555; font-style: italic;">(Batas Maksimal Angkatan: ${maxAllowedSks} SKS)</span>
  </div>

  ${feeSection}

  <!-- Petunjuk Alur Pendaftaran Resmi -->
  <div class="alur-box">
    <strong>ALUR PENDAFTARAN RESMI FAKULTAS PERTANIAN:</strong>
    <ol style="margin: 4px 0 0 16px; padding: 0;">
      <li>Cetak lembar KRS Pengulangan ini pada kertas ukuran A4.</li>
      <li>${isPaidBatch ? `Lampirkan <strong>bukti fisik pembayaran</strong> biaya mengulang sebesar <strong>Rp ${totalBiaya.toLocaleString('id-ID')}</strong> (slip setoran/transfer bank).` : `Mahasiswa Angkatan ${registration.angkatan} bebas biaya SKS mengulang (tidak perlu bukti pembayaran).`}</li>
      <li>Serahkan dokumen cetak fisik ini beserta bukti pembayaran langsung ke loket <strong>Administrasi Fakultas Pertanian INSTIPER</strong> untuk verifikasi berkas dan pengesahan tanda tangan.</li>
    </ol>
  </div>

  <!-- Hanya Dua Tanda Tangan: Pendaftar dan Admin Fakultas Pertanian -->
  <div class="signature-grid">
    <div class="sig-col">
      <div>
        <p style="margin: 0; color: #444;">Yogyakarta, ..........................</p>
        <p style="margin: 3px 0 0 0; font-weight: bold;">Pendaftar,</p>
      </div>
      <div>
        <p style="margin: 0; font-weight: bold; text-decoration: underline; text-transform: uppercase;">( ${registration.nama} )</p>
        <p style="margin: 2px 0 0 0; font-size: 8pt; color: #666; font-family: monospace;">NIM. ${registration.nim}</p>
      </div>
    </div>

    <div class="sig-col">
      <div>
        <p style="margin: 0; color: #444;">Mengetahui &amp; Memverifikasi,</p>
        <p style="margin: 3px 0 0 0; font-weight: bold;">Admin Fakultas Pertanian,</p>
      </div>
      <div>
        <p style="margin: 0; font-weight: bold;">( .................................................... )</p>
        <p style="margin: 2px 0 0 0; font-size: 8pt; color: #666;">NIP / NPK. ........................................</p>
        <p style="margin: 2px 0 0 0; font-size: 7.5pt; color: #888; font-style: italic;">Tanggal Verifikasi: .........................</p>
      </div>
    </div>
  </div>

  <script>
    // Auto trigger print when opened directly
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        try { window.print(); } catch (e) {}
      }, 400);
    });
  </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `KRS_Mengulang_${registration.nim}_${registration.nama.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-[960px] mx-auto px-4 py-6 font-sans">
      {/* Action / Print Toolbar (Disembunyikan saat mencetak) */}
      <div className="print:hidden mb-6 bg-[#166534] dark:bg-[#14532D] text-white p-4 rounded-2xl shadow-md space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-800 bg-white hover:bg-[#EAB308] px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali</span>
              </button>
            )}
            <div>
              <h2 className="text-sm font-extrabold text-white">Kartu Rencana Studi (KRS) Pengulangan</h2>
              <p className="text-xs text-white/85">No. Registrasi: <span className="font-mono font-bold text-[#FDE047]">{registration.id}</span></p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {/* Tombol Unduh Dokumen Siap Cetak (HTML / PDF) */}
            <button
              onClick={handleDownloadHtml}
              className="flex items-center justify-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-4 py-2.5 rounded-xl text-xs font-bold border border-white/30 transition-all cursor-pointer shadow-2xs min-h-[44px] active:scale-95"
              title="Unduh dokumen KRS resmi siap cetak / buka di tab browser baru"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Dokumen (.HTML)</span>
            </button>

            {/* Tombol Cetak Langsung (A4) */}
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 bg-[#EAB308] hover:bg-[#CA8A04] text-slate-950 px-5 py-2.5 rounded-xl text-xs font-black shadow-md transition-all cursor-pointer min-h-[44px] active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Dokumen KRS (A4)</span>
            </button>
          </div>
        </div>

        {/* Tip Ringkas Cetak */}
        <div className="flex items-center justify-between text-[11px] text-white/90 pt-1 border-t border-white/20">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-[#FDE047] shrink-0" />
            <span>Format cetak standar A4 resmi telah disesuaikan satu halaman dengan 2 kolom tanda tangan resmi.</span>
          </div>
          <button
            onClick={() => setPrintTipOpen(!printTipOpen)}
            className="text-[#FDE047] hover:underline font-semibold cursor-pointer shrink-0 ml-2"
          >
            {printTipOpen ? 'Tutup Petunjuk' : 'Petunjuk Cetak PDF'}
          </button>
        </div>

        {printTipOpen && (
          <div className="p-3 bg-black/20 rounded-xl text-xs text-white/95 space-y-1 animate-fade-in border border-white/10">
            <p className="font-bold text-[#FDE047]">💡 Cara Menyimpan sebagai PDF / Mencetak:</p>
            <ol className="list-decimal pl-4 space-y-0.5 text-[11px] text-white/90">
              <li>Klik tombol <strong>"Cetak Dokumen KRS (A4)"</strong> di atas.</li>
              <li>Pada dialog browser, pilih <strong>Tujuan (Destination): "Simpan sebagai PDF"</strong> atau pilih nama printer Anda.</li>
              <li>Atur <strong>Ukuran Kertas: A4</strong> dan <strong>Margin: Default / Minimum</strong>.</li>
              <li>Jika browser memblokir dialog cetak, gunakan tombol <strong>"Unduh Dokumen (.HTML)"</strong> lalu buka file tersebut untuk langsung mencetak.</li>
            </ol>
          </div>
        )}
      </div>

      {/* Alur Selanjutnya Box (Khusus Layar Mahasiswa agar Sangat Paham Alurnya) */}
      <div className="print:hidden mb-6 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/60 rounded-2xl p-4 sm:p-5 text-xs text-emerald-900 dark:text-emerald-100 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-[#166534] dark:text-emerald-400 font-extrabold text-sm sm:text-base">
          <CheckCircle2 className="w-5 h-5 text-[#166534] shrink-0" />
          <span>Pendaftaran Berhasil Dikirim! Silakan Selesaikan Alur Resmi Berikut:</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/80 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-[#166534] mb-1">
              <span className="w-5 h-5 rounded-full bg-[#166534] text-white flex items-center justify-center text-[10px]">1</span>
              <span>Cetak KRS Ini (A4)</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-normal">
              Cetak lembar formulir KRS resmi di bawah menggunakan tombol <strong>Cetak Dokumen KRS (A4)</strong> di atas.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/80 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-[#CA8A04] dark:text-[#EAB308] mb-1">
              <span className="w-5 h-5 rounded-full bg-[#CA8A04] text-white flex items-center justify-center text-[10px]">2</span>
              <span>Bukti Pembayaran SKS</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-normal">
              {isPaidBatch ? (
                <>Siapkan <strong>bukti fisik pembayaran</strong> biaya mengulang sebesar <strong>Rp {totalBiaya.toLocaleString('id-ID')}</strong> (slip bank/transfer).</>
              ) : (
                <>Mahasiswa Angkatan {registration.angkatan} <strong>bebas biaya SKS</strong>, tidak perlu melampirkan bukti pembayaran.</>
              )}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/80 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-[#166534] dark:text-emerald-400 mb-1">
              <span className="w-5 h-5 rounded-full bg-[#166534] text-white flex items-center justify-center text-[10px]">3</span>
              <span>Serahkan ke Loket</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-normal">
              Serahkan lembar cetak fisik &amp; bukti bayar ke loket <strong>Administrasi Fakultas Pertanian</strong> untuk pengesahan tanda tangan.
            </p>
          </div>
        </div>
      </div>

      {/* Official A4 Print Document */}
      <div className="bg-white text-slate-900 p-3.5 sm:p-10 rounded-2xl shadow-xl border border-slate-300 dark:border-slate-700 print:border-none print:shadow-none print:p-0 print:m-0 print-card">
        
        {/* Kop Surat Resmi INSTIPER Yogyakarta dengan Logo Kampus */}
        <div className="border-b-4 border-double border-slate-900 pb-3 mb-4 print-kop">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 flex items-center justify-center p-1">
              <img src="/logo_instiper.png" alt="Logo INSTIPER" className="w-full h-full object-contain" />
            </div>
            <div className="flex-1 text-center">
              <h1 className="text-sm sm:text-lg font-black tracking-wider text-slate-900 uppercase leading-snug">
                INSTITUT PERTANIAN STIPER YOGYAKARTA
              </h1>
              <h2 className="text-sm sm:text-lg font-black text-[#166534] uppercase tracking-wide leading-snug mt-0.5">
                FAKULTAS PERTANIAN
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-800 font-semibold mt-0.5">
                Program Studi Agroteknologi (S1) &amp; Program Studi Agribisnis (S1)
              </p>
              <p className="text-[9px] sm:text-[11px] text-slate-600 mt-0.5">
                Jl. Nangka II, Krodan, Maguwoharjo, Kec. Depok, Kabupaten Sleman, Daerah Istimewa Yogyakarta 55281
              </p>
            </div>
            <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 hidden sm:block opacity-0" aria-hidden="true" />
          </div>

          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-300 text-[10px] text-slate-600 font-mono">
            <span>No. Dokumen: KRS-ULANG/{registration.id}</span>
            <span>Tgl Registrasi: {registration.registrationDate}</span>
          </div>
        </div>

        {/* Title of Document */}
        <div className="text-center my-3 pb-1 print-title">
          <h3 className="text-sm sm:text-base font-extrabold uppercase underline tracking-wide text-slate-900">
            KARTU RENCANA STUDI (KRS) PENGULANGAN MATAKULIAH
          </h3>
          <p className="text-xs font-bold text-[#166534] print:text-black mt-0.5 uppercase">
            Tahun Akademik {registration.academicYear || adminSettings?.activeAcademicYear || '2025/2026'} ({registration.academicTerm || adminSettings?.activeTerm || 'Ganjil'}) • {registration.targetSemester || 'Semester Terpilih'}
          </p>
        </div>

        {/* Identity Table */}
        <div className="mb-4 overflow-x-auto rounded-lg border border-slate-400 print:overflow-visible print:border-black print-avoid-break touch-pan-x">
          <table className="w-full text-xs border-collapse">
            <tbody>
              <tr className="border-b border-slate-300 print:border-black">
                <td className="w-28 sm:w-36 bg-slate-100 print:bg-transparent font-bold p-2 text-slate-700 print:text-black border-r border-slate-300 print:border-black">
                  Nama Lengkap
                </td>
                <td className="p-2 font-bold text-slate-900 print:text-black uppercase">
                  {registration.nama}
                </td>
                <td className="w-24 bg-slate-100 print:bg-transparent font-bold p-2 text-slate-700 print:text-black border-l border-r border-slate-300 print:border-black">
                  NIM
                </td>
                <td className="p-2 font-mono font-bold text-slate-900 print:text-black">
                  {registration.nim}
                </td>
              </tr>
              <tr className="border-b border-slate-300 print:border-black">
                <td className="bg-slate-100 print:bg-transparent font-bold p-2 text-slate-700 print:text-black border-r border-slate-300 print:border-black">
                  Tahun Akademik
                </td>
                <td className="p-2 font-bold text-[#166534] print:text-black">
                  {registration.academicYear || adminSettings?.activeAcademicYear || '2025/2026'} ({registration.academicTerm || adminSettings?.activeTerm || 'Ganjil'})
                </td>
                <td className="bg-slate-100 print:bg-transparent font-bold p-2 text-slate-700 print:text-black border-l border-r border-slate-300 print:border-black">
                  Portal Semester
                </td>
                <td className="p-2 text-slate-900 print:text-black font-semibold">
                  {registration.targetSemester || 'Semester Terpilih'}
                </td>
              </tr>
              <tr className="border-b border-slate-300 print:border-black">
                <td className="bg-slate-100 print:bg-transparent font-bold p-2 text-slate-700 print:text-black border-r border-slate-300 print:border-black">
                  Email
                </td>
                <td className="p-2 text-slate-800 print:text-black">
                  {registration.email}
                </td>
                <td className="bg-slate-100 print:bg-transparent font-bold p-2 text-slate-700 print:text-black border-l border-r border-slate-300 print:border-black">
                  Angkatan
                </td>
                <td className="p-2 text-slate-900 print:text-black font-semibold">
                  Angkatan {registration.angkatan}
                  <span className="text-[10px] text-slate-500 print:text-black ml-1.5 font-normal">
                    ({isPaidBatch ? 'Dikenakan Biaya SKS' : 'Bebas Biaya SKS'})
                  </span>
                </td>
              </tr>
              <tr>
                <td className="bg-slate-100 print:bg-transparent font-bold p-2 text-slate-700 print:text-black border-r border-slate-300 print:border-black">
                  No. WhatsApp
                </td>
                <td className="p-2 font-mono text-slate-800 print:text-black">
                  {registration.noWa}
                </td>
                <td className="bg-slate-100 print:bg-transparent font-bold p-2 text-slate-700 print:text-black border-l border-r border-slate-300 print:border-black">
                  Kelas Asal
                </td>
                <td className="p-2 text-slate-900 print:text-black font-semibold">
                  {registration.kelasAsal}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Selected Courses Table */}
        <div className="mb-4 overflow-x-auto rounded-lg border border-slate-400 print:overflow-visible print:border-black print-avoid-break touch-pan-x">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-100 print:bg-transparent border-b-2 border-slate-400 print:border-black">
              <tr>
                <th className="p-2 text-center w-8 font-black border-r border-slate-300 print:border-black">No</th>
                <th className="p-2 text-left font-black border-r border-slate-300 print:border-black">Mata Kuliah &amp; Kode</th>
                <th className="p-2 text-left w-28 font-black border-r border-slate-300 print:border-black">Program Studi</th>
                <th className="p-2 text-center w-20 font-black border-r border-slate-300 print:border-black">Semester</th>
                <th className="p-2 text-center w-24 font-black border-r border-slate-300 print:border-black">Kelas Pilihan</th>
                <th className="p-2 text-center w-16 font-black">SKS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 print:divide-black">
              {registration.selectedCourses.map((c, index) => (
                <tr key={c.courseId} className="hover:bg-slate-50 print:hover:bg-transparent">
                  <td className="p-2 text-center font-bold border-r border-slate-300 print:border-black">{index + 1}</td>
                  <td className="p-2 border-r border-slate-300 print:border-black">
                    <div className="font-bold text-slate-900 print:text-black">{c.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono print:text-black">{c.courseId}</div>
                  </td>
                  <td className="p-2 capitalize border-r border-slate-300 print:border-black">{c.prodi}</td>
                  <td className="p-2 text-center font-semibold border-r border-slate-300 print:border-black">
                    Sem {c.semester || '-'}
                  </td>
                  <td className="p-2 text-center font-black text-[#009A44] print:text-black border-r border-slate-300 print:border-black">
                    {c.selectedClass}
                  </td>
                  <td className="p-2 text-center font-black">{c.sks} SKS</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* SKS Summary Footer Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-100 print:bg-transparent rounded-lg border border-slate-400 print:border-black text-xs font-semibold mb-3 print-avoid-break">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span>Total Beban Mengulang:</span>
              <div className="px-2.5 py-0.5 bg-[#009A44] text-white print:text-black print:bg-transparent print:border print:border-black rounded-md font-extrabold">
                {registration.totalSks} SKS
              </div>
            </div>
            <span className="text-slate-500 italic text-[11px] print:text-black">
              (Maksimal Angkatan {registration.angkatan}: {maxAllowedSks} SKS)
            </span>
          </div>

          <div className="text-right text-[11px] text-slate-500 print:text-black">
            ID Registrasi: <span className="font-mono font-bold text-slate-800 print:text-black">{registration.id}</span>
          </div>
        </div>

        {/* Fee Note if Paid Batch */}
        {isPaidBatch && (
          <div className="mb-4 border border-amber-400 bg-amber-50/70 rounded-xl p-3 text-xs print:border-black print:bg-white print-avoid-break">
            <div className="flex items-start gap-2.5">
              <CreditCard className="w-4 h-4 text-amber-700 shrink-0 mt-0.5 print:hidden" />
              <div className="flex-1">
                <div className="flex items-center justify-between pb-1 mb-1 border-b border-amber-300 print:border-black">
                  <span className="font-bold text-amber-950 uppercase print:text-black">Kewajiban Pembayaran Biaya Mengulang:</span>
                  <span className="font-mono font-black text-sm text-amber-900 print:text-black">
                    Rp {totalBiaya.toLocaleString('id-ID')}
                  </span>
                </div>
                <p className="text-amber-900 leading-tight print:text-black text-[11px]">
                  {paymentInstructions}
                </p>
                <div className="mt-1 font-mono font-bold text-amber-950 print:text-black text-[11px]">
                  {paymentAccountInfo}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Petunjuk Alur Prosedur Resmi (Tercetak di Lembar A4) */}
        <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border-l-4 border-[#009A44] border-slate-300 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 print:border-black print:border-l-4 print:bg-transparent print:p-2.5 print:my-2 print-avoid-break">
          <p className="font-extrabold text-slate-900 dark:text-white uppercase tracking-wider text-[11px] print:text-black">
            Petunjuk &amp; Prosedur Alur Pendaftaran:
          </p>
          <ol className="list-decimal pl-4 mt-1 space-y-0.5 text-[11px] print:text-black">
            <li>Cetak dokumen formulir KRS Mengulang ini pada kertas ukuran <strong>A4</strong>.</li>
            <li>
              {isPaidBatch ? (
                <span>
                  Lampirkan <strong>bukti fisik pembayaran mengulang</strong> (slip transfer/setoran bank) sebesar <strong>Rp {totalBiaya.toLocaleString('id-ID')}</strong>.
                </span>
              ) : (
                <span>
                  Mahasiswa Angkatan {registration.angkatan} <strong>bebas biaya SKS mengulang</strong> (tidak perlu bukti pembayaran).
                </span>
              )}
            </li>
            <li>
              Serahkan lembar cetak formulir ini beserta bukti fisik pembayaran langsung ke loket <strong>Administrasi Fakultas Pertanian INSTIPER</strong> untuk verifikasi data dan pengesahan tanda tangan resmi.
            </li>
          </ol>
        </div>

        {/* Signature Areas (Hanya 2 Tanda Tangan: Pendaftar dan Admin Fakultas Pertanian) */}
        <div className="mt-6 pt-4 border-t border-slate-300 print:border-black text-xs print-signatures print-avoid-break">
          <div className="grid grid-cols-2 gap-8 text-center">
            
            {/* Signature 1: Pendaftar (Mahasiswa) */}
            <div className="flex flex-col justify-between h-28">
              <div>
                <p className="text-slate-600 print:text-black text-[11px]">Yogyakarta, ..........................</p>
                <p className="font-bold text-slate-900 print:text-black mt-0.5">Pendaftar,</p>
              </div>
              <div>
                <p className="font-bold underline text-slate-900 print:text-black uppercase">
                  ( {registration.nama} )
                </p>
                <p className="text-[10px] text-slate-500 print:text-black font-mono">NIM. {registration.nim}</p>
              </div>
            </div>

            {/* Signature 2: Admin Fakultas Pertanian */}
            <div className="flex flex-col justify-between h-28">
              <div>
                <p className="text-slate-600 print:text-black text-[11px]">Mengetahui &amp; Memverifikasi,</p>
                <p className="font-bold text-slate-900 print:text-black mt-0.5">Admin Fakultas Pertanian,</p>
              </div>
              <div>
                <p className="font-bold text-slate-900 print:text-black">
                  ( .................................................... )
                </p>
                <p className="text-[10px] text-slate-500 print:text-black">NIP / NPK. ........................................</p>
                <p className="text-[9px] text-slate-400 print:text-black mt-0.5 italic">Tanggal Verifikasi: .........................</p>
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};
