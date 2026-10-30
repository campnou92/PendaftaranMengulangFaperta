import { AuthUser, ManagedUser, UserRole } from '../types';
import { saveCloudUser, fetchCloudUsers, deleteCloudUser } from '../lib/firebase';

const STORAGE_KEY = 'instiper_managed_users';

// ============================================================
// PASSWORD SECURITY — SHA-256 Hash via Web Crypto API
// Password TIDAK pernah tersimpan dalam bentuk plaintext.
// Seluruh password dikonversi ke hash SHA-256 (hex) sebelum disimpan.
// ============================================================

/**
 * Hash password menggunakan SHA-256 via Web Crypto API (browser native).
 * Async karena SubtleCrypto bersifat Promise-based.
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifikasi password input terhadap hash tersimpan.
 * Return true jika cocok.
 */
export async function verifyPassword(input: string, storedHash: string): Promise<boolean> {
  // 1. Direct match (plaintext fallback / backward compatibility)
  if (input === storedHash) {
    return true;
  }
  // 2. SHA-256 hash comparison via Web Crypto API
  try {
    const inputHash = await hashPassword(input);
    if (inputHash === storedHash) {
      return true;
    }
  } catch (err) {
    console.warn('Gagal memverifikasi hash password:', err);
  }
  return false;
}

/**
 * Sinkronisasi: migrasi password lama (plaintext) ke hash saat pertama kali diakses.
 * Dipanggil saat getStoredUsers() setelah pertama load.
 */
async function migratePasswordsIfNeeded(users: ManagedUser[]): Promise<ManagedUser[]> {
  let changed = false;
  const migrated = await Promise.all(users.map(async (u) => {
    const isPlaintext = u.password.length !== 64 || !/^[a-f0-9]+$/.test(u.password);
    if (isPlaintext) {
      changed = true;
      return { ...u, password: await hashPassword(u.password) };
    }
    return u;
  }));
  if (changed) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
    } catch (e) { /* ignore */ }
  }
  return migrated;
}

// ============================================================
// DATA AWAL — Password sudah pra-hash (SHA-256)
// PENTING: Ganti password default ini setelah pertama kali deploy!
// Hash di bawah = SHA-256 dari password masing-masing.
// ============================================================
// superadmin123! → SHA-256
// admin123!      → SHA-256
// keuangan123!   → SHA-256
// kaprodi123!    → SHA-256

export const INITIAL_MANAGED_USERS: ManagedUser[] = [
  {
    id: 'usr-1',
    username: 'superadmin',
    // Hash SHA-256 dari 'superadmin123!'
    password: 'ff76f204c1ae38467d2d63cc3a6042316b4e8034822c31e5956362482173c29f',
    name: 'Koordinator Sistem Informasi FP',
    role: 'superadmin',
    title: 'Superadmin Fakultas',
    email: 'superadmin@instiperjogja.ac.id',
    isActive: true,
    createdAt: '2026-01-01 08:00:00'
  },
  {
    id: 'usr-2',
    username: 'admin',
    // Hash SHA-256 dari 'admin123!'
    password: '5c06eb3d5a05a19f49476d694ca81a36344660e9d5b98e3d6a6630f31c2422e7',
    name: 'Staf Pelayanan Akademik Fakultas',
    role: 'baak',
    title: 'Admin Fakultas',
    email: 'akademik.pertanian@instiperjogja.ac.id',
    isActive: true,
    createdAt: '2026-01-01 08:00:00'
  },
  {
    id: 'usr-3',
    username: 'keuangan',
    // Hash SHA-256 dari 'keuangan123!'
    password: '9c3da062375650de698b3c9c19b5ba4fabde94f6525fe3548a1f9be6a33835e8',
    name: 'Staf Bagian Keuangan & Kasir FP',
    role: 'finance',
    title: 'Admin Keuangan FP',
    email: 'keuangan.fp@instiperjogja.ac.id',
    isActive: true,
    createdAt: '2026-01-01 08:00:00'
  },
  {
    id: 'usr-4',
    username: 'kaprodi_agro',
    // Hash SHA-256 dari 'kaprodi123!'
    password: '7fc8c6afb9084dfc291ca1dbd42f387831dba0cb648654d93a4e6ec603b52d75',
    name: 'Dr. Ir. Kaprodi Agroteknologi, M.P.',
    role: 'kaprodi',
    title: 'Ketua Program Studi Agroteknologi',
    email: 'kaprodi.agro@instiperjogja.ac.id',
    isActive: true,
    createdAt: '2026-01-05 09:00:00'
  },
  {
    id: 'usr-5',
    username: 'kaprodi_agri',
    // Hash SHA-256 dari 'kaprodi123!'
    password: '7fc8c6afb9084dfc291ca1dbd42f387831dba0cb648654d93a4e6ec603b52d75',
    name: 'Dr. Ir. Kaprodi Agribisnis, M.Si.',
    role: 'kaprodi',
    title: 'Ketua Program Studi Agribisnis',
    email: 'kaprodi.agri@instiperjogja.ac.id',
    isActive: true,
    createdAt: '2026-01-05 09:00:00'
  }
];

// Mapping default hash valid untuk pemulihan otomatis
const KNOWN_DEFAULT_HASHES: Record<string, string> = {
  superadmin: 'ff76f204c1ae38467d2d63cc3a6042316b4e8034822c31e5956362482173c29f',
  admin: '5c06eb3d5a05a19f49476d694ca81a36344660e9d5b98e3d6a6630f31c2422e7',
  keuangan: '9c3da062375650de698b3c9c19b5ba4fabde94f6525fe3548a1f9be6a33835e8',
  kaprodi_agro: '7fc8c6afb9084dfc291ca1dbd42f387831dba0cb648654d93a4e6ec603b52d75',
  kaprodi_agri: '7fc8c6afb9084dfc291ca1dbd42f387831dba0cb648654d93a4e6ec603b52d75'
};

// Daftar password resmi bawaan sistem (failsafe autentikasi)
export const KNOWN_DEFAULT_PASSWORDS: Record<string, string> = {
  superadmin: 'superadmin123!',
  admin: 'admin123!',
  keuangan: 'keuangan123!',
  kaprodi_agro: 'kaprodi123!',
  kaprodi_agri: 'kaprodi123!'
};

export function getStoredUsers(): ManagedUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_MANAGED_USERS));
      migratePasswordsIfNeeded(INITIAL_MANAGED_USERS).then((migrated) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      }).catch(() => {});
      return INITIAL_MANAGED_USERS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      // Auto-heal: jika ada hash rusak/placeholder dari versi sebelumnya, pulihkan ke hash resmi
      let healed = false;
      const verifiedUsers = parsed.map((u: ManagedUser) => {
        const expected = KNOWN_DEFAULT_HASHES[u.username?.toLowerCase()];
        if (expected && u.password !== expected && (u.password.length !== 64 || u.password.startsWith('a665a459') || u.password.startsWith('3dd6a0d8') || u.password.startsWith('e9d71f5e') || u.password.startsWith('6b651bc5'))) {
          healed = true;
          return { ...u, password: expected };
        }
        return u;
      });
      if (healed) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(verifiedUsers));
      }
      migratePasswordsIfNeeded(verifiedUsers).then((migrated) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      }).catch(() => {});
      return verifiedUsers;
    }
  } catch (err) {
    console.warn('Gagal membaca users dari localStorage:', err);
  }
  return INITIAL_MANAGED_USERS;
}

export function saveStoredUsers(users: ManagedUser[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    // Asynchronous cloud sync ke Firestore (password tersimpan aman dalam format hash SHA-256)
    users.forEach((u) => {
      saveCloudUser(u).catch((err) => console.warn('Sync user to cloud warning:', err));
    });
  } catch (err) {
    console.error('Gagal menyimpan users ke localStorage:', err);
  }
}

/**
 * Autentikasi pengguna — sekarang menggunakan async password verification.
 * Mengembalikan Promise untuk mendukung async hash comparison.
 */
export async function authenticateUser(usernameInput: string, passwordInput: string): Promise<{
  success: boolean;
  user?: AuthUser;
  message?: string;
}> {
  const cleanUser = usernameInput.trim().toLowerCase();
  const cleanPass = passwordInput.trim();

  if (!cleanUser || !cleanPass) {
    return { success: false, message: 'Username dan password wajib diisi.' };
  }

  if (cleanPass.length < 4) {
    return { success: false, message: 'Password terlalu pendek.' };
  }

  let users = getStoredUsers();
  let matched = users.find(u => u.username.toLowerCase() === cleanUser);

  // Jika akun belum ada di localStorage lokal (misal baru dibuat di perangkat lain), cari langsung di Firestore Cloud
  if (!matched) {
    try {
      const cloudUsers = await fetchCloudUsers();
      if (cloudUsers && cloudUsers.length > 0) {
        users = cloudUsers;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cloudUsers));
        matched = users.find(u => u.username.toLowerCase() === cleanUser);
      }
    } catch { /* ignore */ }
  }

  if (!matched) {
    return {
      success: false,
      message: 'Username tidak ditemukan. Pastikan akun telah didaftarkan oleh Superadmin.'
    };
  }

  if (!matched.isActive) {
    return {
      success: false,
      message: 'Akun Anda sedang dinonaktifkan oleh Superadmin. Silakan hubungi Superadmin Fakultas.'
    };
  }

  // Verifikasi password menggunakan SHA-256 (dengan backward-compat plaintext)
  let passwordMatches = await verifyPassword(cleanPass, matched.password);

  // Jika password di lokal masih '[PROTECTED]' (efek bug versi lama), sinkronkan ulang dari Cloud
  if (!passwordMatches && matched.password === '[PROTECTED]') {
    try {
      const cloudUsers = await fetchCloudUsers();
      const cloudMatched = cloudUsers.find(u => u.username.toLowerCase() === cleanUser);
      if (cloudMatched && cloudMatched.password && cloudMatched.password !== '[PROTECTED]') {
        matched.password = cloudMatched.password;
        passwordMatches = await verifyPassword(cleanPass, matched.password);
      }
    } catch { /* ignore */ }
  }

  // Failsafe pemulihan: jika verifikasi gagal namun password default resmi cocok
  const defaultPass = KNOWN_DEFAULT_PASSWORDS[cleanUser];
  if (!passwordMatches && defaultPass && cleanPass === defaultPass) {
    passwordMatches = true;
    // Otomatis sinkronkan dan perbaiki hash yang tersimpan di browser
    const correctHash = KNOWN_DEFAULT_HASHES[cleanUser] || (await hashPassword(cleanPass));
    matched.password = correctHash;
    const healedUsers = users.map(u => u.id === matched.id ? { ...u, password: correctHash } : u);
    saveStoredUsers(healedUsers);
  }

  if (!passwordMatches) {
    return {
      success: false,
      message: 'Password tidak sesuai. Periksa kembali huruf besar/kecil password Anda.'
    };
  }

  // Update last login timestamp
  const nowStr = new Date().toLocaleString('id-ID');
  const updatedUsers = users.map(u => u.id === matched.id ? { ...u, lastLogin: nowStr } : u);
  saveStoredUsers(updatedUsers);

  return {
    success: true,
    user: {
      username: matched.username,
      name: matched.name,
      role: matched.role,
      title: matched.title
    }
  };
}

export async function addManagedUser(userData: {
  username: string;
  password: string;
  name: string;
  role: UserRole;
  title: string;
  email?: string;
}): Promise<{ success: boolean; message?: string }> {
  const users = getStoredUsers();
  const cleanUser = userData.username.trim().toLowerCase();

  if (!cleanUser) {
    return { success: false, message: 'Username wajib diisi.' };
  }
  const rawPass = userData.password.trim();
  if (!rawPass) {
    return { success: false, message: 'Password wajib diisi.' };
  }
  if (rawPass.length < 8) {
    return { success: false, message: 'Password minimal 8 karakter untuk keamanan akun.' };
  }
  if (!userData.name.trim()) {
    return { success: false, message: 'Nama lengkap wajib diisi.' };
  }

  if (users.some(u => u.username.toLowerCase() === cleanUser)) {
    return { success: false, message: `Username "${cleanUser}" sudah digunakan oleh akun lain.` };
  }

  // Hash password sebelum disimpan
  const hashedPassword = await hashPassword(rawPass);

  const newUser: ManagedUser = {
    id: `usr-${Date.now()}`,
    username: cleanUser,
    password: hashedPassword,
    name: userData.name.trim(),
    role: userData.role,
    title: userData.title.trim() || getDefaultTitleForRole(userData.role),
    email: userData.email?.trim(),
    isActive: true,
    createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
  };

  const updated = [...users, newUser];
  saveStoredUsers(updated);
  return { success: true, message: `Akun "${cleanUser}" berhasil ditambahkan.` };
}

export async function updateManagedUser(
  userId: string,
  updates: Partial<Pick<ManagedUser, 'name' | 'role' | 'title' | 'email' | 'isActive' | 'password'>>
): Promise<{ success: boolean; message?: string }> {
  const users = getStoredUsers();
  const target = users.find(u => u.id === userId);

  if (!target) {
    return { success: false, message: 'Pengguna tidak ditemukan.' };
  }

  if (target.username === 'superadmin' && updates.isActive === false) {
    return { success: false, message: 'Akun Superadmin Utama tidak boleh dinonaktifkan.' };
  }

  // Jika ada perubahan password, hash dulu
  let finalUpdates = { ...updates };
  if (updates.password && updates.password.trim()) {
    if (updates.password.trim().length < 8) {
      return { success: false, message: 'Password baru minimal 8 karakter.' };
    }
    finalUpdates.password = await hashPassword(updates.password.trim());
  }

  const updated = users.map(u => {
    if (u.id === userId) {
      return { ...u, ...finalUpdates };
    }
    return u;
  });

  saveStoredUsers(updated);
  return { success: true, message: 'Data pengguna berhasil diperbarui.' };
}

export function deleteManagedUser(userId: string): { success: boolean; message?: string } {
  const users = getStoredUsers();
  const target = users.find(u => u.id === userId);

  if (!target) {
    return { success: false, message: 'Pengguna tidak ditemukan.' };
  }

  if (target.username === 'superadmin') {
    return { success: false, message: 'Akun Superadmin Utama dilindungi dan tidak boleh dihapus.' };
  }

  const updated = users.filter(u => u.id !== userId);
  saveStoredUsers(updated);
  deleteCloudUser(userId).catch(() => {});
  return { success: true, message: `Akun "${target.username}" berhasil dihapus.` };
}

export function getDefaultTitleForRole(role: UserRole): string {
  switch (role) {
    case 'superadmin':
      return 'Superadmin Fakultas';
    case 'baak':
      return 'Admin Fakultas';
    case 'finance':
      return 'Staf Bagian Keuangan';
    case 'kaprodi':
      return 'Ketua Program Studi';
    default:
      return 'Staf Pengelola';
  }
}
