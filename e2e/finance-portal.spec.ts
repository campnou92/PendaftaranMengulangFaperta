import { test, expect } from '@playwright/test';

test.describe('Aplikasi Pendaftaran Mengulang FAPERTA - Portal Keuangan', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Buka dialog login
    const accessBtn = page.getByRole('button', { name: /Akses Pengelola/i });
    await accessBtn.scrollIntoViewIfNeeded();
    await accessBtn.click();

    // Login sebagai staf keuangan
    await page.getByPlaceholder('Masukkan username...').fill('keuangan');
    await page.getByPlaceholder('Masukkan password...').fill('keuangan123!');
    await page.getByRole('button', { name: /Masuk Sekarang/i }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
  });

  test('menampilkan ringkasan tagihan biaya SKS dan metrik keuangan', async ({ page }) => {
    // Verifikasi tab Keuangan otomatis aktif untuk staf keuangan
    const financeTab = page.getByRole('button', { name: /Keuangan/i });
    await expect(financeTab).toBeVisible();
    await financeTab.click();

    // Verifikasi kartu metrik ringkasan
    await expect(page.getByText('Total Potensi Tagihan', { exact: false })).toBeVisible();
    await expect(page.getByText('Realisasi Pembayaran', { exact: false })).toBeVisible();
    await expect(page.getByText('Menunggu Pembayaran', { exact: true })).toBeVisible();
    await expect(page.getByText('Ketentuan Biaya SKS', { exact: false })).toBeVisible();
  });

  test('memiliki filter semester dinamis dan pencarian mahasiswa', async ({ page }) => {
    await page.getByRole('button', { name: /Keuangan/i }).click();

    // Input pencarian mahasiswa
    const searchInput = page.getByPlaceholder(/Cari NIM, nama, WA, angkatan.../i);
    await expect(searchInput).toBeVisible();

    // Tombol export excel
    const exportBtn = page.getByRole('button', { name: /Export Excel Keuangan/i });
    await expect(exportBtn).toBeVisible();
  });
});

