import { test, expect } from '@playwright/test';

test.describe('Aplikasi Pendaftaran Mengulang FAPERTA - Formulir Pendaftaran', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('menampilkan semua kolom input data mahasiswa yang wajib', async ({ page }) => {
    // Verifikasi kolom input form
    await expect(page.getByPlaceholder('nama@email.com')).toBeVisible();
    await expect(page.getByPlaceholder(/Nama lengkap mahasiswa/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Contoh: 2112345/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Contoh: 081234567890/i)).toBeVisible();
  });

  test('validasi tombol submit belum aktif jika form belum lengkap atau belum memilih matakuliah', async ({ page }) => {
    const submitBtn = page.getByRole('button', { name: /Kirim Pendaftaran|Daftar Sekarang/i });
    
    // Tombol submit harus dalam kondisi disabled jika belum lengkap
    await expect(submitBtn).toBeDisabled();
  });

  test('dapat memilih mata kuliah dan melihat akumulasi SKS bertambah', async ({ page }) => {
    // Tunggu hingga daftar mata kuliah tampil dan pilih baris mata kuliah pertama
    const courseCard = page.locator('label').filter({ hasText: /SKS/i }).first();
    await expect(courseCard).toBeVisible({ timeout: 10000 });

    const courseCheckbox = courseCard.locator('input[type="checkbox"]');
    await courseCheckbox.check();
    await expect(courseCheckbox).toBeChecked();

    // Verifikasi ringkasan mata kuliah terpilih bertambah
    await expect(page.locator('text=/1\\s+Mata Kuliah/i').first()).toBeVisible();
  });

  test('dapat mengisi data pendaftaran lengkap dan melihat tombol submit aktif', async ({ page }) => {
    // 1. Tunggu hingga daftar mata kuliah tampil
    const courseCard = page.locator('label').filter({ hasText: /SKS/i }).first();
    await expect(courseCard).toBeVisible({ timeout: 10000 });

    // 2. Isi identitas mahasiswa
    await page.getByPlaceholder('nama@email.com').fill('mahasiswa.test@instiperjogja.ac.id');
    await page.getByPlaceholder(/Nama lengkap mahasiswa/i).fill('BAMBANG TRIATMOJO');
    const randomNim = '22' + Math.floor(10000 + Math.random() * 90000);
    await page.getByPlaceholder(/Contoh: 2112345/i).fill(randomNim);
    await page.getByPlaceholder(/Contoh: 081234567890/i).fill('081298765432');

    // 3. Isi kelas asal menggunakan selector spesifik datalist
    const kelasInput = page.locator('input[list="admin-kelas-asal-datalist"]');
    if (await kelasInput.isVisible()) {
      await kelasInput.fill('SPKS A');
    } else {
      await page.getByRole('combobox').nth(1).selectOption({ index: 1 });
    }

    // 4. Centang salah satu matakuliah
    const courseCheckbox = courseCard.locator('input[type="checkbox"]');
    await courseCheckbox.check();
    await expect(courseCheckbox).toBeChecked();

    // Verifikasi ringkasan 1 mata kuliah terpilih
    await expect(page.locator('text=/1\\s+Mata Kuliah/i').first()).toBeVisible({ timeout: 5000 });

    // 5. Verifikasi tombol submit menjadi aktif
    const submitBtn = page.getByRole('button', { name: /Kirim Pendaftaran|Daftar Sekarang/i });
    await submitBtn.scrollIntoViewIfNeeded();
    await expect(submitBtn).toBeEnabled({ timeout: 10000 });
  });
});

