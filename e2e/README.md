# Playwright E2E Testing — Portal Pendaftaran Mengulang FAPERTA

Suite pengujian otomatis End-to-End (E2E) menggunakan **Playwright Test** untuk memvalidasi seluruh alur kerja aplikasi secara real-time pada browser Chromium.

## 📁 Struktur Pengujian (`e2e/`)

| File Pengujian | Cakupan Fitur |
|---|---|
| `home-and-navigation.spec.ts` | Identitas kampus INSTIPER, navigasi antar-tab, & Dark/Light mode toggle |
| `registration-form.spec.ts` | Validasi input mahasiswa, pemilihan matakuliah & SKS, aturan persetujuan, & aktivasi submit |
| `status-checker.spec.ts` | Pencarian status pendaftaran & KRS berdasarkan NIM, feedback NIM tidak ditemukan |
| `auth-and-admin.spec.ts` | Autentikasi Pengelola (Superadmin/BAAK), penolakan kredensial salah, pembukaan panel admin, & logout |
| `finance-portal.spec.ts` | Login Staf Keuangan, monitor ringkasan tagihan SKS, filter semester, & pencarian |

## 🚀 Cara Menjalankan Pengujian

1. **Jalankan semua pengujian (Headless Mode)**:
   ```bash
   npm run test:e2e
   ```

2. **Jalankan pengujian dengan Antarmuka Interaktif (Playwright UI Mode)**:
   ```bash
   npm run test:e2e:ui
   ```

3. **Jalankan file pengujian tertentu**:
   ```bash
   npx playwright test e2e/registration-form.spec.ts
   ```

4. **Buka Laporan Hasil Pengujian (HTML Report)**:
   ```bash
   npx playwright show-report
   ```

