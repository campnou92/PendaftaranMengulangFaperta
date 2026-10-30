import { test, expect } from '@playwright/test';

test.describe('Aplikasi Pendaftaran Mengulang FAPERTA - Cek & Cetak Hasil', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Buka tab Cek & Cetak Hasil
    await page.getByRole('button', { name: /Cek & Cetak Hasil/i }).click();
  });

  test('menampilkan input pencarian NIM dan tombol cari status', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Masukkan NIM Anda/i);
    await expect(searchInput).toBeVisible();

    const searchBtn = page.getByRole('button', { name: /Cari Data/i });
    await expect(searchBtn).toBeVisible();
  });

  test('menampilkan pesan ketika NIM tidak ditemukan', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Masukkan NIM Anda/i);
    await searchInput.fill('999999999');

    const searchBtn = page.getByRole('button', { name: /Cari Data/i });
    await searchBtn.click();

    // Tunggu feedback hasil pencarian
    await expect(page.locator('text=/Data Pendaftaran Tidak Ditemukan/i')).toBeVisible({ timeout: 10000 });
  });

  test('dapat kembali ke formulir pendaftaran dari halaman pencarian', async ({ page }) => {
    // Klik tombol Kembali ke Form
    const backBtn = page.getByRole('button', { name: /Form Pendaftaran/i });
    await backBtn.click();

    await expect(page.getByPlaceholder('nama@email.com')).toBeVisible();
  });
});

