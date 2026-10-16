import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { SimpleRegistration, AdminSettings, AuthUser, PaymentStatus } from '../types';
import {
  Coins,
  CreditCard,
  FileSpreadsheet,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Printer,
  Check,
  RotateCcw,
  User,
  Filter,
  DollarSign,
  TrendingUp,
  Download,
  Info
} from 'lucide-react';
import { InstiperLogo } from './InstiperLogo';

interface FinancePanelProps {
  currentUser: AuthUser;
  registrations: SimpleRegistration[];
  adminSettings: AdminSettings;
  onUpdatePaymentStatus: (registrationId: string, status: PaymentStatus, note?: string) => void;
  onViewReceipt: (registration: SimpleRegistration) => void;
  onLogout: () => void;
}

export const FinancePanel: React.FC<FinancePanelProps> = ({
  currentUser,
  registrations,
  adminSettings,
  onUpdatePaymentStatus,
  onViewReceipt,
  onLogout
}) => {
  // Filter states
  const [onlyPaidBatches, setOnlyPaidBatches] = useState<boolean>(true);
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<'all' | 'pending' | 'paid' | 'verified'>('all');
  const [filterSemester, setFilterSemester] = useState<'all' | 'Semester 3' | 'Semester 5' | 'gabungan'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Note dialog state
  const [editingNoteRegId, setEditingNoteRegId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');

  const isFeeActive = adminSettings.feePerSksEnabled ?? true;
  const paidBatches = adminSettings.paidBatches ?? ['2020', '2021', '2022'];
  const costPerSks = adminSettings.costPerSks ?? 50000;

  // Helper check
  const isChargedPerSks = (reg: SimpleRegistration) => {
    return isFeeActive && paidBatches.includes(reg.angkatan);
  };

  const getBillAmount = (reg: SimpleRegistration) => {
    return isChargedPerSks(reg) ? reg.totalSks * costPerSks : 0;
  };

  // Filtered registrations
  const filteredData = registrations.filter((reg) => {
    const isCharged = isChargedPerSks(reg);

    // Filter by charged status
    if (onlyPaidBatches && !isCharged) {
      return false;
    }

    // Filter by payment status
    if (filterPaymentStatus !== 'all') {
      const regStatus = reg.paymentStatus || 'pending';
      if (regStatus !== filterPaymentStatus) {
        return false;
      }
    }

    // Filter by semester
    if (filterSemester === 'Semester 3' && reg.targetSemester !== 'Semester 3') {
      return false;
    }
    if (filterSemester === 'Semester 5' && reg.targetSemester !== 'Semester 5') {
      return false;
    }
    if (filterSemester === 'gabungan') {
      const isGab = reg.targetSemester?.toLowerCase().includes('gabungan') || reg.targetSemester?.toLowerCase().includes('lintas');
      if (!isGab) return false;
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        reg.nama.toLowerCase().includes(q) ||
        reg.nim.includes(q) ||
        reg.email.toLowerCase().includes(q) ||
        reg.noWa.includes(q) ||
        reg.angkatan.includes(q);
      if (!match) return false;
    }

    return true;
  });

  // Calculate Financial KPI Metrics
  const chargedRegistrations = registrations.filter(isChargedPerSks);
  const totalChargedCount = chargedRegistrations.length;
  const totalPotentialRevenue = chargedRegistrations.reduce((sum, r) => sum + getBillAmount(r), 0);

  const verifiedRegistrations = chargedRegistrations.filter(r => r.paymentStatus === 'verified' || r.paymentStatus === 'paid');
  const totalRealizedRevenue = verifiedRegistrations.reduce((sum, r) => sum + getBillAmount(r), 0);

  const pendingRegistrations = chargedRegistrations.filter(r => !r.paymentStatus || r.paymentStatus === 'pending');
  const totalPendingRevenue = pendingRegistrations.reduce((sum, r) => sum + getBillAmount(r), 0);

  // Export Excel Khusus Keuangan (.xlsx)
  const handleExportExcelFinance = () => {
    if (filteredData.length === 0) {
      alert('Tidak ada data pendaftar untuk diexport.');
      return;
    }

    // Sheet 1: Rekap Tagihan Keuangan
    const financeRows = filteredData.map((reg, idx) => {
      const isCharged = isChargedPerSks(reg);
      const tagihan = isCharged ? reg.totalSks * costPerSks : 0;
      let statusLabel = 'BEBAS BIAYA (GRATIS)';
      if (isCharged) {
        if (reg.paymentStatus === 'verified') statusLabel = 'LUNAS & TERVERIFIKASI';
        else if (reg.paymentStatus === 'paid') statusLabel = 'SUDAH BAYAR (MENUNGGU VERIFIKASI)';
        else statusLabel = 'MENUNGGU PEMBAYARAN';
      }

      return {
        'No': idx + 1,
        'ID Registrasi': reg.id,
        'Tanggal Daftar': reg.registrationDate,
        'NIM': reg.nim,
        'Nama Mahasiswa': reg.nama,
        'No. WhatsApp': reg.noWa,
        'Email': reg.email,
        'Angkatan': reg.angkatan,
        'Kelas Asal': reg.kelasAsal,
        'Semester Target': reg.targetSemester,
        'Total SKS': reg.totalSks,
        'Kewajiban Biaya': isCharged ? 'Ya (Kena Biaya SKS)' : 'Bebas Biaya',
        'Tarif Per SKS': isCharged ? costPerSks : 0,
        'Total Tagihan (Rp)': tagihan,
        'Status Pembayaran': statusLabel,
        'Tanggal Verifikasi': reg.paymentDate || '-',
        'Catatan / Bukti Keuangan': reg.paymentNote || '-',
        'Daftar Matakuliah': reg.selectedCourses.map(c => `${c.name} (${c.sks} SKS, ${c.selectedClass})`).join('; ')
      };
    });

    const wsFinance = XLSX.utils.json_to_sheet(financeRows);
    wsFinance['!cols'] = [
      { wch: 5 },
      { wch: 15 },
      { wch: 22 },
      { wch: 14 },
      { wch: 26 },
      { wch: 15 },
      { wch: 26 },
      { wch: 10 },
      { wch: 16 },
      { wch: 14 },
      { wch: 10 },
      { wch: 18 },
      { wch: 14 },
      { wch: 18 },
      { wch: 24 },
      { wch: 22 },
      { wch: 30 },
      { wch: 50 }
    ];

    // Sheet 2: Ringkasan Finansial
    const summaryRows = [
      { 'Indikator Keuangan': 'Total Mahasiswa Pendaftar Keseluruhan', 'Jumlah': `${registrations.length} Mahasiswa`, 'Nominal (Rp)': '-' },
      { 'Indikator Keuangan': 'Mahasiswa Dikenakan Biaya SKS Mengulang', 'Jumlah': `${totalChargedCount} Mahasiswa`, 'Nominal (Rp)': totalPotentialRevenue },
      { 'Indikator Keuangan': 'Sudah Bayar / Lunas & Terverifikasi', 'Jumlah': `${verifiedRegistrations.length} Mahasiswa`, 'Nominal (Rp)': totalRealizedRevenue },
      { 'Indikator Keuangan': 'Tunggakan / Menunggu Pembayaran', 'Jumlah': `${pendingRegistrations.length} Mahasiswa`, 'Nominal (Rp)': totalPendingRevenue },
      { 'Indikator Keuangan': 'Tarif Per SKS Aktif', 'Jumlah': '-', 'Nominal (Rp)': costPerSks },
      { 'Indikator Keuangan': 'Angkatan Kena Biaya', 'Jumlah': paidBatches.join(', '), 'Nominal (Rp)': '-' }
    ];

    const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
    wsSummary['!cols'] = [
      { wch: 38 },
      { wch: 22 },
      { wch: 20 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsFinance, 'Rekap Tagihan Keuangan');
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Finansial');

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Laporan_Keuangan_SKS_Mengulang_Pertanian_${today}.xlsx`);
  };

  const handleOpenNoteModal = (reg: SimpleRegistration) => {
    setEditingNoteRegId(reg.id);
    setNoteDraft(reg.paymentNote || '');
  };

  const handleSaveNote = () => {
    if (!editingNoteRegId) return;
    const target = registrations.find(r => r.id === editingNoteRegId);
    if (target) {
      onUpdatePaymentStatus(
        editingNoteRegId,
        target.paymentStatus || 'pending',
        noteDraft
      );
    }
    setEditingNoteRegId(null);
  };

  return (
    <div className="w-full max-w-[1540px] mx-auto py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
      <div className="finance-panel-container bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-5 sm:p-8 lg:p-10 transition-colors">
        
        {/* Header Portal Keuangan */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-xl flex items-center justify-center shrink-0 shadow-xs">
              <img src="/logo_instiper.png" alt="Logo INSTIPER" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Panel Keuangan &amp; Kasir FP
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#009A44]/15 dark:bg-[#009A44]/30 text-[#009A44] dark:text-[#05B752] border border-[#009A44]/30">
                  Akses Khusus Keuangan
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Monitoring pembayaran biaya mengulang per SKS, validasi pelunasan mahasiswa, dan ekspor rekapitulasi.
              </p>
            </div>
          </div>

          {/* User Info & Actions */}
          <div className="flex items-center gap-2.5 bg-slate-50 dark:bg-slate-800/80 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="text-right sm:text-left pr-2 min-w-0">
              <span className="text-xs font-bold text-slate-900 dark:text-white block leading-tight truncate">
                {currentUser.name}
              </span>
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold block truncate">
                {currentUser.title}
              </span>
            </div>
            <button
              onClick={onLogout}
              className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-rose-100 dark:hover:bg-rose-900/40 hover:text-rose-700 dark:hover:text-rose-300 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
              title="Keluar dari akun pengelola"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Financial KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {/* Card 1: Total Potensi Tagihan */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 text-white p-4 rounded-xl shadow-sm border border-slate-700">
            <div className="flex items-center justify-between text-slate-300 mb-1 text-xs">
              <span className="font-semibold uppercase tracking-wider text-[10px]">Total Potensi Tagihan</span>
              <DollarSign className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-white font-mono">
              Rp {totalPotentialRevenue.toLocaleString('id-ID')}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Dari <strong className="text-white">{totalChargedCount}</strong> mahasiswa kena biaya
            </p>
          </div>

          {/* Card 2: Realisasi Terbayar */}
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/60 dark:from-emerald-950/40 dark:to-emerald-900/30 p-4 rounded-xl border-2 border-emerald-300 dark:border-emerald-700 shadow-sm">
            <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 mb-1 text-xs">
              <span className="font-bold uppercase tracking-wider text-[10px]">Realisasi Pembayaran</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-950 dark:text-emerald-100 font-mono">
              Rp {totalRealizedRevenue.toLocaleString('id-ID')}
            </div>
            <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-1">
              <strong>{verifiedRegistrations.length}</strong> mahasiswa lunas / bayar
            </p>
          </div>

          {/* Card 3: Menunggu Pembayaran */}
          <div className="bg-gradient-to-br from-amber-50 to-amber-100/60 dark:from-amber-950/40 dark:to-amber-900/30 p-4 rounded-xl border-2 border-amber-300 dark:border-amber-700 shadow-sm">
            <div className="flex items-center justify-between text-amber-800 dark:text-amber-300 mb-1 text-xs">
              <span className="font-bold uppercase tracking-wider text-[10px]">Menunggu Pembayaran</span>
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-2xl font-black text-amber-950 dark:text-amber-100 font-mono">
              Rp {totalPendingRevenue.toLocaleString('id-ID')}
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1">
              <strong>{pendingRegistrations.length}</strong> mahasiswa belum lunas
            </p>
          </div>

          {/* Card 4: Tarif & Aturan Superadmin */}
          <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-400 mb-1 text-xs">
              <span className="font-bold uppercase tracking-wider text-[10px]">Ketentuan Biaya SKS</span>
              <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-lg font-black text-slate-900 dark:text-white font-mono">
              Rp {costPerSks.toLocaleString('id-ID')} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/ SKS</span>
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
              Angkatan Kena Biaya: <strong className="text-slate-900 dark:text-white">{paidBatches.join(', ') || '-'}</strong>
            </p>
          </div>
        </div>

        {/* Filter and Control Bar */}
        <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-xl border border-slate-300 dark:border-slate-700 mb-6 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            
            {/* Toggle: Hanya Mahasiswa Kena Biaya vs Semua */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                Data Ditampilkan:
              </span>

              <button
                type="button"
                onClick={() => setOnlyPaidBatches(true)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 min-h-[38px] ${
                  onlyPaidBatches
                    ? 'bg-emerald-700 text-white shadow-sm ring-2 ring-emerald-600/30'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>Hanya yang Dikenakan Biaya SKS</span>
                <span className={`px-1.5 py-0.2 text-[10px] rounded-full ${
                  onlyPaidBatches ? 'bg-emerald-900 text-emerald-100' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}>
                  {chargedRegistrations.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setOnlyPaidBatches(false)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 min-h-[38px] ${
                  !onlyPaidBatches
                    ? 'bg-slate-900 dark:bg-slate-700 text-white shadow-sm'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>Semua Pendaftar</span>
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {registrations.length}
                </span>
              </button>
            </div>

            {/* Export Excel Button */}
            <button
              onClick={handleExportExcelFinance}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-md hover:shadow transition-all cursor-pointer shrink-0 min-h-[38px]"
              title="Unduh laporan keuangan berformat Excel (.xlsx) 2 sheet lengkap"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
              <span>Export Excel Keuangan (.xlsx)</span>
            </button>
          </div>

          {/* Sub Filters: Status Pembayaran, Semester, Search */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            {/* Status Pembayaran */}
            <div className="md:col-span-4">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Status Pembayaran:
              </label>
              <select
                value={filterPaymentStatus}
                onChange={(e) => setFilterPaymentStatus(e.target.value as any)}
                className="w-full px-2.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Semua Status Pembayaran</option>
                <option value="pending">⏳ Menunggu Pembayaran (Belum Lunas)</option>
                <option value="paid">💳 Sudah Bayar (Menunggu Verifikasi)</option>
                <option value="verified">✅ Lunas & Terverifikasi</option>
              </select>
            </div>

            {/* Filter Semester */}
            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Semester:
              </label>
              <select
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value as any)}
                className="w-full px-2.5 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Semua Semester</option>
                <option value="Semester 3">🌿 Semester 3</option>
                <option value="Semester 5">🌾 Semester 5</option>
                <option value="gabungan">📑 Gabungan</option>
              </select>
            </div>

            {/* Pencarian */}
            <div className="md:col-span-5">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Pencarian Mahasiswa:
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari NIM, nama, WA, angkatan..."
                  className="w-full pl-8 pr-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Tabel Data Pendaftar Khusus Keuangan */}
        <div className="border border-slate-300 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-slate-900 dark:bg-slate-950 text-white px-4 py-3 flex items-center justify-between">
            <span className="font-bold text-xs flex items-center gap-2">
              <Coins className="w-4 h-4 text-emerald-400" />
              Daftar Mahasiswa &amp; Rincian Tagihan ({filteredData.length} Pendaftar)
            </span>
            <span className="text-[11px] text-slate-300 font-mono">
              Tarif per SKS: <strong className="text-white">Rp {costPerSks.toLocaleString('id-ID')}</strong>
            </span>
          </div>

          <div className="overflow-x-auto touch-pan-x">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold border-b border-slate-300 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3 text-center w-10">No</th>
                  <th className="py-2.5 px-3">Mahasiswa &amp; NIM</th>
                  <th className="py-2.5 px-3">Angkatan &amp; Kelas</th>
                  <th className="py-2.5 px-3">Matakuliah &amp; SKS</th>
                  <th className="py-2.5 px-3 text-right">Total Tagihan (Rp)</th>
                  <th className="py-2.5 px-3 text-center">Status Pembayaran</th>
                  <th className="py-2.5 px-3 text-center">Aksi Verifikasi Keuangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 dark:text-slate-400">
                      <AlertCircle className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                      <p className="font-semibold text-slate-700 dark:text-slate-300">Tidak ada data pendaftar yang cocok dengan filter.</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {onlyPaidBatches 
                          ? 'Ganti filter atau pilih opsi "Semua Pendaftar" untuk melihat pendaftar lainnya.' 
                          : 'Coba ubah kata kunci pencarian.'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((reg, idx) => {
                    const isCharged = isChargedPerSks(reg);
                    const tagihan = getBillAmount(reg);
                    const status = reg.paymentStatus || 'pending';

                    return (
                      <tr key={reg.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-3 text-center font-bold text-slate-500 dark:text-slate-400">
                          {idx + 1}
                        </td>

                        {/* Mahasiswa & NIM */}
                        <td className="py-3 px-3">
                          <strong className="text-slate-900 dark:text-white block text-xs">{reg.nama}</strong>
                          <span className="font-mono text-blue-700 dark:text-blue-400 font-bold text-[11px] block">
                            NIM: {reg.nim}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                            WA: {reg.noWa} | Reg: {reg.id}
                          </span>
                        </td>

                        {/* Angkatan & Kelas */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-800 dark:text-slate-200">Angkatan {reg.angkatan}</span>
                            {isCharged ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                                Kena Biaya
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                                Bebas Biaya
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5">
                            {reg.kelasAsal} ({reg.targetSemester || 'Semester 3'})
                          </span>
                        </td>

                        {/* Matakuliah & SKS */}
                        <td className="py-3 px-3">
                          <span className="font-black text-slate-900 dark:text-white text-xs">
                            {reg.totalSks} SKS Total
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                            ({reg.selectedCourses.length} Mata Kuliah)
                          </span>
                          <ul className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 max-w-xs space-y-0.5">
                            {reg.selectedCourses.slice(0, 2).map((c, i) => (
                              <li key={i} className="truncate">
                                • {c.name} ({c.sks} SKS)
                              </li>
                            ))}
                            {reg.selectedCourses.length > 2 && (
                              <li className="italic text-slate-400">
                                +{reg.selectedCourses.length - 2} matakuliah lainnya
                              </li>
                            )}
                          </ul>
                        </td>

                        {/* Total Tagihan */}
                        <td className="py-3 px-3 text-right">
                          {isCharged ? (
                            <div>
                              <span className="font-black text-sm text-emerald-900 dark:text-emerald-300 block font-mono">
                                Rp {tagihan.toLocaleString('id-ID')}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                                {reg.totalSks} SKS × Rp {costPerSks.toLocaleString('id-ID')}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800 inline-block">
                              Rp 0 (Bebas Biaya)
                            </span>
                          )}
                        </td>

                        {/* Status Pembayaran */}
                        <td className="py-3 px-3 text-center">
                          {isCharged ? (
                            <div className="inline-flex flex-col items-center gap-1">
                              {status === 'verified' ? (
                                <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 border border-emerald-400 dark:border-emerald-700 flex items-center gap-1">
                                  <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                                  LUNAS &amp; TERVERIFIKASI
                                </span>
                              ) : status === 'paid' ? (
                                <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-900 dark:text-blue-300 border border-blue-400 dark:border-blue-700 flex items-center gap-1">
                                  <CreditCard className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
                                  SUDAH BAYAR (PROSES)
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-950 dark:text-amber-300 border border-amber-400 dark:border-amber-700 flex items-center gap-1">
                                  <Clock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                                  MENUNGGU PEMBAYARAN
                                </span>
                              )}

                              {reg.paymentDate && (
                                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">
                                  {reg.paymentDate.split(',')[0]}
                                </span>
                              )}

                              {reg.paymentNote && (
                                <span className="text-[10px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded max-w-[160px] truncate" title={reg.paymentNote}>
                                  Note: {reg.paymentNote}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                              Tidak Ada Tagihan
                            </span>
                          )}
                        </td>

                        {/* Aksi Verifikasi Keuangan */}
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {isCharged && (
                              <>
                                {status !== 'verified' ? (
                                  <button
                                    onClick={() => {
                                      const now = new Date().toLocaleDateString('id-ID', {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric'
                                      });
                                      onUpdatePaymentStatus(
                                        reg.id,
                                        'verified',
                                        `Lunas diverifikasi Admin Keuangan pada ${now}`
                                      );
                                    }}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs min-h-[32px]"
                                    title="Tandai pembayaran telah LUNAS & terverifikasi"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Tandai Lunas</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => {
                                      onUpdatePaymentStatus(reg.id, 'pending', 'Status direset ke Menunggu Pembayaran');
                                    }}
                                    className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950/50 text-slate-700 dark:text-slate-300 hover:text-amber-900 dark:hover:text-amber-200 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors border border-slate-300 dark:border-slate-700 min-h-[32px]"
                                    title="Batalkan status lunas (kembalikan ke Menunggu Pembayaran)"
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Batal Lunas</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => handleOpenNoteModal(reg)}
                                  className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg cursor-pointer"
                                  title="Edit catatan bukti transfer / konfirmasi"
                                >
                                  <Info className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}

                            <button
                              onClick={() => onViewReceipt(reg)}
                              className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg cursor-pointer"
                              title="Lihat / Cetak Bukti Hasil Pendaftaran"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List for Financial Registrations (Dark Mode & Touch Ergonomics) */}
          <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-800">
            {filteredData.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Tidak ada data pendaftar yang cocok dengan filter.
              </div>
            ) : (
              filteredData.map((reg) => {
                const isCharged = isChargedPerSks(reg);
                const tagihan = getBillAmount(reg);
                const status = reg.paymentStatus || 'pending';

                return (
                  <div key={reg.id} className="p-4 space-y-3 bg-white dark:bg-slate-900">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <strong className="text-sm font-bold text-slate-900 dark:text-white block">{reg.nama}</strong>
                        <span className="font-mono text-xs text-blue-700 dark:text-blue-400 font-bold">NIM: {reg.nim}</span>
                        <span className="block text-[10px] text-slate-400 mt-0.5">Angkatan {reg.angkatan} • {reg.kelasAsal}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-amber-900 dark:text-amber-300 block font-mono">
                          {isCharged ? `Rp ${tagihan.toLocaleString('id-ID')}` : 'Bebas Biaya'}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">{reg.totalSks} SKS</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        status === 'verified'
                          ? 'bg-green-100 dark:bg-green-950/60 text-[#009A44] dark:text-[#05B752] border border-green-300 dark:border-green-800'
                          : status === 'paid'
                          ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                      }`}>
                        {status === 'verified' ? '✓ Lunas' : status === 'paid' ? 'Sudah Bayar' : 'Menunggu Bayar'}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {isCharged && status !== 'verified' && (
                          <button
                            onClick={() => {
                              const now = new Date().toLocaleDateString('id-ID');
                              onUpdatePaymentStatus(reg.id, 'verified', `Lunas pada ${now}`);
                            }}
                            className="px-3 py-1.5 bg-[#009A44] hover:bg-[#00702F] text-white rounded-lg text-xs font-bold min-h-[36px]"
                          >
                            Tandai Lunas
                          </button>
                        )}
                        <button
                          onClick={() => onViewReceipt(reg)}
                          className="p-2 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Catatan Pembayaran */}
        {editingNoteRegId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-slate-900 max-w-md w-full rounded-2xl shadow-2xl border border-slate-300 dark:border-slate-700 p-5">
              <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Catatan Verifikasi Pembayaran
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                Masukkan catatan transfer bank, nomor referensi, atau keterangan dari mahasiswa.
              </p>

              <textarea
                rows={3}
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder="Contoh: Transfer BNI Rp 300.000 tgl 12/10 ref: 89123847..."
                className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 mb-4"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingNoteRegId(null)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer min-h-[40px]"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveNote}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer min-h-[40px]"
                >
                  Simpan Catatan
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
