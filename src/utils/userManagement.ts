import { AuthUser, ManagedUser, UserRole } from '../types';

const STORAGE_KEY = 'instiper_managed_users';

export const INITIAL_MANAGED_USERS: ManagedUser[] = [
  {
    id: 'usr-1',
    username: 'superadmin',
    password: 'superadmin123!',
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
    password: 'admin123!',
    name: 'Staf Pelayanan Akademik BAAK',
    role: 'baak',
    title: 'Admin BAAK FP',
    email: 'baak.pertanian@instiperjogja.ac.id',
    isActive: true,
    createdAt: '2026-01-01 08:00:00'
  },
  {
    id: 'usr-3',
    username: 'keuangan',
    password: 'keuangan123!',
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
    password: 'kaprodi123!',
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
    password: 'kaprodi123!',
    name: 'Dr. Ir. Kaprodi Agribisnis, M.Si.',
    role: 'kaprodi',
    title: 'Ketua Program Studi Agribisnis',
    email: 'kaprodi.agri@instiperjogja.ac.id',
    isActive: true,
    createdAt: '2026-01-05 09:00:00'
  }
];

export function getStoredUsers(): ManagedUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_MANAGED_USERS));
      return INITIAL_MANAGED_USERS;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('Gagal membaca users dari localStorage:', err);
  }
  return INITIAL_MANAGED_USERS;
}

export function saveStoredUsers(users: ManagedUser[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    // Asynchronous cloud sync to Firestore
    import('../lib/firebase').then(({ seedInitialUsers }) => {
      seedInitialUsers(users).catch((err) => console.warn('Cloud user sync warning:', err));
    }).catch(() => {});
  } catch (err) {
    console.error('Gagal menyimpan users ke localStorage:', err);
  }
}

export function authenticateUser(usernameInput: string, passwordInput: string): {
  success: boolean;
  user?: AuthUser;
  message?: string;
} {
  const cleanUser = usernameInput.trim().toLowerCase();
  const cleanPass = passwordInput.trim();

  if (!cleanUser || !cleanPass) {
    return { success: false, message: 'Username dan password wajib diisi.' };
  }

  const users = getStoredUsers();
  const matched = users.find(u => u.username.toLowerCase() === cleanUser);

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

  if (matched.password !== cleanPass) {
    return { 
      success: false, 
      message: 'Password tidak sesuai. Periksa kembali huruf besar/kecil password Anda.' 
    };
  }

  // Update last login
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

export function addManagedUser(userData: {
  username: string;
  password: string;
  name: string;
  role: UserRole;
  title: string;
  email?: string;
}): { success: boolean; message?: string } {
  const users = getStoredUsers();
  const cleanUser = userData.username.trim().toLowerCase();

  if (!cleanUser) {
    return { success: false, message: 'Username wajib diisi.' };
  }
  if (!userData.password.trim()) {
    return { success: false, message: 'Password wajib diisi.' };
  }
  if (!userData.name.trim()) {
    return { success: false, message: 'Nama lengkap wajib diisi.' };
  }

  if (users.some(u => u.username.toLowerCase() === cleanUser)) {
    return { success: false, message: `Username "${cleanUser}" sudah digunakan oleh akun lain.` };
  }

  const newUser: ManagedUser = {
    id: `usr-${Date.now()}`,
    username: cleanUser,
    password: userData.password.trim(),
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

export function updateManagedUser(
  userId: string,
  updates: Partial<Pick<ManagedUser, 'name' | 'role' | 'title' | 'email' | 'isActive' | 'password'>>
): { success: boolean; message?: string } {
  const users = getStoredUsers();
  const target = users.find(u => u.id === userId);

  if (!target) {
    return { success: false, message: 'Pengguna tidak ditemukan.' };
  }

  // Lindungi akun superadmin utama agar tidak sengaja dinonaktifkan
  if (target.username === 'superadmin' && updates.isActive === false) {
    return { success: false, message: 'Akun Superadmin Utama tidak boleh dinonaktifkan.' };
  }

  const updated = users.map(u => {
    if (u.id === userId) {
      return {
        ...u,
        ...updates
      };
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
  return { success: true, message: `Akun "${target.username}" berhasil dihapus.` };
}

export function getDefaultTitleForRole(role: UserRole): string {
  switch (role) {
    case 'superadmin':
      return 'Superadmin Fakultas';
    case 'baak':
      return 'Staf Pelayanan Akademik BAAK';
    case 'finance':
      return 'Staf Bagian Keuangan';
    case 'kaprodi':
      return 'Ketua Program Studi';
    default:
      return 'Staf Pengelola';
  }
}
