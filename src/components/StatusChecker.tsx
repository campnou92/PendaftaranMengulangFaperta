import React, { useState } from 'react';
import { SimpleRegistration, AdminSettings } from '../types';
import { Search, Printer, ArrowRight, CheckCircle2, Clock, XCircle, AlertCircle, Coins, FileText, CheckCircle, Check, X, Loader2 } from 'lucide-react';
import { fetchRegistrationByExactNim } from '../lib/firebase';

interface StatusCheckerProps {
  registrations?: SimpleRegistration[];
  adminSettings?: AdminSettings;
  onViewReceipt: (registration: SimpleRegistration) => void;
  onGoToForm: () => void;
}

export const StatusChecker: React.FC<StatusCheckerProps> = ({
  registrations = [],
  adminSettings,
  onViewReceipt,
  onGoToForm
}) => {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SimpleRegistration[]>([]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNim = query.trim().toUpperCase();
    if (!cleanNim) return;

    setSearched(true);
    setIsSearching(true);

    try {
      // 1. Fetch exact matching document from Firestore Cloud (1 single read)
      const cloudMatches = await fetchRegistrationByExactNim(cleanNim);
      
      if (cloudMatches && cloudMatches.length > 0) {
        setResults(cloudMatches);
      } else {
        // Fallback: check local memory if offline
        const localMatches = (registrations || []).filter(
          r => r.nim.toUpperCase().trim() === cleanNim
        );
        setResults(localMatches);
      }
    } catch (err) {
      console.warn('Status search error:', err);
      const localMatches = (registrations || []).filter(
        r => r.nim.toUpperCase().trim() === cleanNim
      );
      setResults(localMatches);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-3 sm:px-6">
      
      {/* Title */}
      <div className="text-center max-w-xl mx-auto mb-6">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          Cek Status & Cetak KRS Pengulangan
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Ketik <strong>Nomor Induk Mahasiswa (NIM)</strong> Anda untuk melacak progress verifikasi berkas dan mencetak KRS resmi.
        </p>
      </div>

      {/* Search Input Box */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-4 sm:p-5 mb-8">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={query}
              onChange={(e) => setQuery(e.target.value.replace(/\D/g, ''))}
              placeholder="Masukkan NIM Anda (hanya angka, contoh: 2210511001)..."
              className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#166534] font-medium font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="h-11 px-5 bg-[#166534] hover:bg-[#14532D] disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm cursor-pointer min-h-[44px] flex items-center justify-center gap-2 shrink-0 active:scale-98"
          >
            {isSearching ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Mencari...</span>
              </>
            ) : (
              <span>Cari Data</span>
            )}
          </button>
        </form>

        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Pastikan memasukkan <strong>NIM lengkap</strong> yang Anda gunakan saat mendaftar. Data dilindungi privasi kampus.</span>
        </div>
      </div>

      {/* Results List */}
      {searched && (
        <div className="space-y-6">
          {results.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800">
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Data Pendaftaran Tidak Ditemukan</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                NIM "{query}" belum terdaftar pada sistem pendaftaran mengulang semester ini.
              </p>
              <button
                onClick={onGoToForm}
                className="mt-4 px-4 py-2 bg-[#166534] hover:bg-[#14532D] text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span>Buka Formulir Pendaftaran</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            results.map((reg) => {
              const isApproved = reg.status === 'approved';
              const isRejected = reg.status === 'rejected';
              const isPending = reg.status === 'pending';

              return (
                <div 
                  key={reg.id} 
                  className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-6"
                >
                  
                  {/* Top Bar: Student Identity & Overall Badge */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-slate-500 dark:text-slate-400 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          {reg.id}
                        </span>
                        <span className="text-xs text-slate-400">•</span>
                        <span className="text-xs font-bold text-[#166534] dark:text-emerald-400">{reg.targetSemester || 'Semester 3/5'}</span>
                      </div>
                      <h3 className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                        {reg.nama} <span className="font-mono text-slate-500 font-medium">({reg.nim})</span>
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Angkatan {reg.angkatan} • Kelas Asal: {reg.kelasAsal} • {reg.selectedCourses.length} Mata Kuliah ({reg.totalSks} SKS)
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      {isApproved && (
                        <span className="px-3 py-1 rounded-xl text-xs font-extrabold bg-emerald-100 dark:bg-emerald-950/60 text-[#166534] dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1.5 shadow-xs">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>DISETUJUI</span>
                        </span>
                      )}
                      {isPending && (
                        <span className="px-3 py-1 rounded-xl text-xs font-extrabold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1.5 shadow-xs">
                          <Clock className="w-3.5 h-3.5" />
                          <span>MENUNGGU VERIFIKASI</span>
                        </span>
                      )}
                      {isRejected && (
                        <span className="px-3 py-1 rounded-xl text-xs font-extrabold bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-300 border border-red-300 dark:border-red-700 flex items-center gap-1.5 shadow-xs">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>DITOLAK</span>
                        </span>
                      )}

                      <button
                        onClick={() => onViewReceipt(reg)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#166534] hover:bg-[#14532D] text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer min-h-[38px] active:scale-95 shrink-0"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Cetak KRS</span>
                      </button>
                    </div>
                  </div>

                  {/* Vertical Verification Timeline (Dikirim -> Diverifikasi -> Disetujui/Ditolak) */}
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-4">
                      Timeline Status Verifikasi:
                    </h4>

                    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                      
                      {/* Step 1: Pendaftaran Terkirim Online */}
                      <div className="relative flex items-start gap-3">
                        <div className="absolute -left-6 top-0.5 w-5 h-5 rounded-full bg-[#166534] text-white flex items-center justify-center text-[10px] shadow-xs">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">1. Formulir Diajukan Secara Online</span>
                            <span className="text-[10px] font-mono text-slate-400">({reg.registrationDate})</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Data {reg.selectedCourses.length} mata kuliah ({reg.totalSks} SKS) berhasil terdaftar di portal. Mahasiswa wajib mencetak dokumen KRS.
                          </p>
                        </div>
                      </div>

                      {/* Step 2: Penyerahan Cetak KRS & Bukti Pembayaran ke Loket FP */}
                      <div className="relative flex items-start gap-3">
                        <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-xs ${
                          isApproved || isRejected
                            ? 'bg-[#166534] text-white'
                            : 'bg-amber-500 text-white animate-pulse'
                        }`}>
                          {isApproved || isRejected ? <Check className="w-3 h-3 stroke-[3]" /> : <Clock className="w-3 h-3" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">2. Penyerahan Berkas Cetak &amp; Bukti Pembayaran ke Loket</span>
                            <span className={`text-[10px] font-bold px-2 py-0.2 rounded-md ${
                              reg.paymentStatus === 'verified'
                                ? 'bg-emerald-100 text-[#166534] dark:bg-emerald-950/60 dark:text-emerald-400'
                                : 'bg-amber-100 text-amber-800'
                            }`}>
                              {reg.paymentStatus === 'verified' ? 'Lunas & Diverifikasi' : 'Menunggu Penyerahan Fisik'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                            Mahasiswa membawa lembar cetak formulir (A4) ke loket Administrasi Fakultas Pertanian INSTIPER, disertai bukti fisik pembayaran bagi mahasiswa angkatan berbayar per SKS.
                          </p>
                        </div>
                      </div>

                      {/* Step 3: Status Akhir (Disetujui / Ditolak oleh Admin FP) */}
                      <div className="relative flex items-start gap-3">
                        <div className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-xs ${
                          isApproved
                            ? 'bg-[#166534] text-white'
                            : isRejected
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-300 dark:bg-slate-700 text-slate-600'
                        }`}>
                          {isApproved ? <Check className="w-3 h-3 stroke-[3]" /> : isRejected ? <X className="w-3 h-3 stroke-[3]" /> : '3'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-bold ${
                              isApproved ? 'text-[#166534] dark:text-emerald-400' : isRejected ? 'text-red-600' : 'text-slate-600'
                            }`}>
                              3. Pengesahan Admin Fakultas Pertanian: {isApproved ? 'Disetujui & Disahkan' : isRejected ? 'Ditolak' : 'Menunggu Verifikasi'}
                            </span>
                          </div>
                          
                          {isApproved && (
                            <p className="text-[11px] text-[#166534] dark:text-emerald-400 mt-0.5">
                              Berkas fisik telah diverifikasi dan disahkan oleh Admin Fakultas Pertanian. Status pengulangan mata kuliah Anda telah resmi aktif.
                            </p>
                          )}

                          {isRejected && (
                            <div className="mt-2 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-300">
                              <strong>Alasan Penolakan:</strong>
                              <p className="mt-0.5">{reg.rejectionReason || reg.adminNotes || 'Berkas fisik tidak diserahkan, bukti bayar tidak valid, atau terdapat bentrok prasyarat kelas.'}</p>
                            </div>
                          )}

                          {isPending && (
                            <div className="mt-1 p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg text-[11px] text-amber-900 dark:text-amber-200">
                              Pastikan Anda sudah mencetak KRS dan menyerahkannya ke loket Administrasi Fakultas Pertanian INSTIPER disertai bukti pembayaran (bagi angkatan berbayar).
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Course List Card Accordion */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300 block mb-2">
                      Mata Kuliah yang Didaftarkan:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {reg.selectedCourses.map((c, i) => (
                        <div key={i} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white block">{c.name}</span>
                            <span className="text-[10px] text-slate-400">{c.courseId} • Sem {c.semester || '-'} • {c.prodi}</span>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-[#166534] dark:text-emerald-400 block">{c.selectedClass}</span>
                            <span className="text-[10px] text-slate-500 font-semibold">{c.sks} SKS</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              );
            })
          )}
        </div>
      )}

    </div>
  );
};
