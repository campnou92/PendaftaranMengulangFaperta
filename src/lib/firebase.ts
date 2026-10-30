import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  getDocFromServer,
  writeBatch,
  query,
  where
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { CourseItem, SimpleRegistration, AdminSettings, ManagedUser } from '../types';
import { INITIAL_MANAGED_USERS } from '../utils/userManagement';
import { DEFAULT_ADMIN_SETTINGS } from '../data/courses';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific firestoreDatabaseId (CRITICAL)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.warn('Firestore Error Context:', JSON.stringify(errInfo));
  return errInfo;
}

// Test connection on boot
export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'settings', 'global'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client offline, utilizing cached storage.');
    }
    return false;
  }
}

// ----------------------------------------------------
// 1. REGISTRATIONS (Real-time Cloud Sync)
// ----------------------------------------------------
export function subscribeCloudRegistrations(
  onUpdate: (registrations: SimpleRegistration[]) => void,
  onError?: (err: any) => void
) {
  const colRef = collection(db, 'registrations');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: SimpleRegistration[] = [];
      snapshot.forEach((d) => {
        items.push(d.data() as SimpleRegistration);
      });
      // Sort newest first
      items.sort((a, b) => b.id.localeCompare(a.id));
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'registrations');
      if (onError) onError(error);
    }
  );
}

export async function saveCloudRegistration(reg: SimpleRegistration): Promise<void> {
  const path = `registrations/${reg.id}`;
  try {
    await setDoc(doc(db, 'registrations', reg.id), reg);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function deleteCloudRegistration(id: string): Promise<void> {
  const path = `registrations/${id}`;
  try {
    await deleteDoc(doc(db, 'registrations', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

/**
 * Targeted query: Fetch only registrations matching exact NIM.
 * Consumes only 1 read per matched document, preventing full collection scans.
 */
export async function fetchRegistrationByExactNim(nim: string): Promise<SimpleRegistration[]> {
  try {
    const cleanNim = nim.trim().toUpperCase();
    if (!cleanNim) return [];
    
    const colRef = collection(db, 'registrations');
    const q = query(colRef, where('nim', '==', cleanNim));
    const snapshot = await getDocs(q);
    
    const results: SimpleRegistration[] = [];
    snapshot.forEach((d) => {
      results.push(d.data() as SimpleRegistration);
    });
    return results;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `registrations?nim=${nim}`);
    return [];
  }
}

/**
 * Check if a NIM is already registered and active (not rejected) in the given academic year.
 */
export async function checkNimIsRegistered(
  nim: string,
  academicYear?: string
): Promise<{ exists: boolean; registration?: SimpleRegistration }> {
  try {
    const records = await fetchRegistrationByExactNim(nim);
    const active = records.find(r => {
      if (r.status === 'rejected') return false;
      if (academicYear && r.academicYear && r.academicYear !== academicYear) {
        return false;
      }
      return true;
    });
    if (active) {
      return { exists: true, registration: active };
    }
    return { exists: false, registration: records[0] };
  } catch {
    return { exists: false };
  }
}

// ----------------------------------------------------
// 2. COURSES (Real-time Cloud Sync)
// ----------------------------------------------------
export function subscribeCloudCourses(
  onUpdate: (courses: CourseItem[]) => void,
  onError?: (err: any) => void
) {
  const colRef = collection(db, 'courses');
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items: CourseItem[] = [];
      snapshot.forEach((d) => {
        const data = d.data() as CourseItem;
        items.push({
          ...data,
          id: data.id || d.id
        });
      });
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'courses');
      if (onError) onError(error);
    }
  );
}

export async function saveCloudCourse(course: CourseItem): Promise<void> {
  const path = `courses/${course.id}`;
  try {
    await setDoc(doc(db, 'courses', course.id), course);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function deleteCloudCourse(courseId: string): Promise<void> {
  const path = `courses/${courseId}`;
  try {
    await deleteDoc(doc(db, 'courses', courseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export async function deleteBatchCloudCourses(courseIds: string[]): Promise<void> {
  if (!courseIds || courseIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    courseIds.forEach((id) => {
      batch.delete(doc(db, 'courses', id));
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'courses/batch');
    throw error;
  }
}

export async function seedInitialCourses(courses: CourseItem[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    courses.forEach((c) => {
      const docRef = doc(db, 'courses', c.id);
      batch.set(docRef, c);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'courses');
  }
}

export async function syncAllCoursesToCloud(courses: CourseItem[]): Promise<void> {
  try {
    // Diff-based synchronization: only delete courses that are no longer in the list,
    // and set/update all incoming courses. NEVER wipe the entire collection!
    const existing = await getDocs(collection(db, 'courses'));
    const incomingIds = new Set(courses.map(c => c.id));
    
    const batch = writeBatch(db);
    // 1. Delete documents that exist in Firestore but are NOT in the incoming list
    existing.forEach((d) => {
      if (!incomingIds.has(d.id)) {
        batch.delete(d.ref);
      }
    });

    // 2. Set/update all incoming courses
    courses.forEach((c) => {
      batch.set(doc(db, 'courses', c.id), c);
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'courses');
    throw error;
  }
}

// ----------------------------------------------------
// 3. SETTINGS (Real-time Cloud Sync)
// ----------------------------------------------------
export function subscribeCloudSettings(
  onUpdate: (settings: AdminSettings) => void,
  onError?: (err: any) => void
) {
  const docRef = doc(db, 'settings', 'global');
  return onSnapshot(
    docRef,
    async (snapshot) => {
      if (!snapshot.exists()) {
        try {
          await setDoc(docRef, DEFAULT_ADMIN_SETTINGS);
        } catch (e) {
          console.warn('Auto-seed settings skipped:', e);
        }
        onUpdate(DEFAULT_ADMIN_SETTINGS);
        return;
      }
      onUpdate(snapshot.data() as AdminSettings);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
      if (onError) onError(error);
    }
  );
}

export async function saveCloudSettings(settings: AdminSettings): Promise<void> {
  const path = 'settings/global';
  try {
    await setDoc(doc(db, 'settings', 'global'), settings);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// ----------------------------------------------------
// 4. SYSTEM USERS (Real-time Cloud Sync)
// ----------------------------------------------------
export function subscribeCloudUsers(
  onUpdate: (users: ManagedUser[]) => void,
  onError?: (err: any) => void
) {
  const colRef = collection(db, 'system_users');
  return onSnapshot(
    colRef,
    async (snapshot) => {
      if (snapshot.empty) {
        try {
          await seedInitialUsers(INITIAL_MANAGED_USERS);
        } catch (e) {
          console.warn('Auto-seed users skipped:', e);
        }
        onUpdate(INITIAL_MANAGED_USERS);
        return;
      }
      const users: ManagedUser[] = [];
      snapshot.forEach((d) => {
        users.push(d.data() as ManagedUser);
      });
      onUpdate(users);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, 'system_users');
      if (onError) onError(error);
    }
  );
}

export async function fetchCloudUsers(): Promise<ManagedUser[]> {
  const colRef = collection(db, 'system_users');
  try {
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) return [];
    const users: ManagedUser[] = [];
    snapshot.forEach((d) => {
      users.push(d.data() as ManagedUser);
    });
    return users;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'system_users');
    return [];
  }
}

export async function saveCloudUser(user: ManagedUser): Promise<void> {
  const path = `system_users/${user.id}`;
  try {
    await setDoc(doc(db, 'system_users', user.id), user);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function deleteCloudUser(userId: string): Promise<void> {
  const path = `system_users/${userId}`;
  try {
    await deleteDoc(doc(db, 'system_users', userId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export async function seedInitialUsers(users: ManagedUser[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    users.forEach((u) => {
      const docRef = doc(db, 'system_users', u.id);
      batch.set(docRef, u);
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'system_users');
  }
}
