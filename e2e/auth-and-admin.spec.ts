import { test, expect } from '@playwright/test';

test.describe('Aplikasi Pendaftaran Mengulang FAPERTA - Autentikasi & Portal Admin', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('dapat membuka dialog login dari footer dan membatalkannya', async ({ page }) => {
    // Scroll dan klik tombol Akses Pengelola di footer
    const accessBtn = page.getByRole('button', { name: /Akses Pengelola/i });
    await accessBtn.scrollIntoViewIfNeeded();
    await accessBtn.click();

    // Dialog modal login harus muncul
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder('Masukkan username...')).toBeVisible();
    await expect(page.getByPlaceholder('Masukkan password...')).toBeVisible();

    // Klik tombol Batal
    await page.getByRole('button', { name: /Batal/i }).click();

    // Dialog modal login harus tertutup
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('menampilkan pesan error jika login dengan username atau password salah', async ({ page }) => {
    const accessBtn = page.getByRole('button', { name: /Akses Pengelola/i });
    await accessBtn.scrollIntoViewIfNeeded();
    await accessBtn.click();

    await page.getByPlaceholder('Masukkan username...').fill('pengguna_salah');
    await page.getByPlaceholder('Masukkan password...').fill('passwordsalah123');

    await page.getByRole('button', { name: /Masuk Sekarang/i }).click();

    // Harus muncul peringatan error
    await expect(page.locator('text=/tidak ditemukan|tidak sesuai/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('berhasil login sebagai Superadmin dan membuka Portal Pengelola', async ({ page }) => {
    const accessBtn = page.getByRole('button', { name: /Akses Pengelola/i });
    await accessBtn.scrollIntoViewIfNeeded();
    await accessBtn.click();

    // Kredensial default superadmin
    await page.getByPlaceholder('Masukkan username...').fill('superadmin');
    await page.getByPlaceholder('Masukkan password...').fill('superadmin123!');

    await page.getByRole('button', { name: /Masuk Sekarang/i }).click();

    // Modal login tertutup
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Header harus menampilkan tab Portal Pengelola SUPER dan Keuangan
    const portalTab = page.getByRole('button', { name: /Portal Pengelola/i });
    await expect(portalTab).toBeVisible();

    const financeTab = page.getByRole('button', { name: /Keuangan/i });
    await expect(financeTab).toBeVisible();

    // Buka Portal Pengelola
    await portalTab.click();

    // Verifikasi fitur admin terlihat (misal: Kelola Matakuliah, Rekapitulasi)
    await expect(page.locator('text=/Mata Kuliah|Pendaftar|Rekapitulasi/i').first()).toBeVisible();

    // Logout
    const logoutBtn = page.getByRole('button', { name: /Logout/i }).first();
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // Setelah logout, tab Portal Pengelola tidak lagi terlihat di header
    await expect(portalTab).not.toBeVisible();
  });
});

