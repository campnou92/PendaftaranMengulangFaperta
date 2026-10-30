import { test, expect } from '@playwright/test';

test.describe('Aplikasi Pendaftaran Mengulang FAPERTA - Navigasi & Tampilan', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('menampilkan identitas INSTIPER FAPERTA di header dan footer', async ({ page }) => {
    // Verifikasi branding header
    const banner = page.getByRole('banner');
    await expect(banner).toContainText('INSTIPER');
    await expect(banner).toContainText('FAPERTA');
    await expect(banner).toContainText('Pendaftaran Mengulang MK');

    // Verifikasi branding footer
    const footer = page.locator('footer');
    await expect(footer).toContainText('Institut Pertanian Stiper (INSTIPER) Yogyakarta');
    await expect(footer).toContainText('Fakultas Pertanian');
  });

  test('dapat berpindah tab antara Form Pendaftaran dan Cek & Cetak Hasil', async ({ page }) => {
    // Default tab adalah form pendaftaran
    const formHeading = page.locator('h1, h2, h3').filter({ hasText: /Pendaftaran Mengulang|Formulir/i }).first();
    await expect(formHeading).toBeVisible();

    // Klik tab Cek & Cetak Hasil
    await page.getByRole('button', { name: /Cek & Cetak Hasil/i }).click();

    // Verifikasi halaman status pencarian NIM tampil
    await expect(page.getByPlaceholder(/Cari NIM|Masukkan NIM/i)).toBeVisible();

    // Kembali ke tab Form Pendaftaran
    await page.getByRole('button', { name: /Form Pendaftaran/i }).click();
    await expect(formHeading).toBeVisible();
  });

  test('dapat mengubah mode gelap dan terang (Dark Mode Toggle)', async ({ page }) => {
    const themeBtn = page.getByTitle(/Beralih ke Mode/i);
    await expect(themeBtn).toBeVisible();

    const htmlElement = page.locator('html');

    // Cek status awal
    const isDarkInitial = await htmlElement.evaluate((el) => el.classList.contains('dark'));

    // Klik toggle tema
    await themeBtn.click();

    // Status tema harus berubah
    if (isDarkInitial) {
      await expect(htmlElement).not.toHaveClass(/dark/);
    } else {
      await expect(htmlElement).toHaveClass(/dark/);
    }
  });
});

