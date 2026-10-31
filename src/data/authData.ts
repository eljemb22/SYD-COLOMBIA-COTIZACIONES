import { AuthUser, StoredUserAccount, ViewerPermissions } from '../types';
import { saveSystemUsersToFirestore, saveSingleUserToFirestore, deleteUserFromFirestore } from '../services/realtimeSync';

export const DEFAULT_VIEWER_PERMISSIONS: ViewerPermissions = {
  canEditSales: false,
  canEditCostManager: false,
  canEditCatalog: false,
  canEditTenders: false,
  canManageOCTracking: false,
  canEditDocuments: false,
  canManageSalesOrders: false,
  canManageQuotesHistory: false,
  canManageSuppliers: false,
  canManageSerials: false,
  canManageCustomization: false,
  canExportData: false,
  canManageBackups: false,
  canAccessSqlAnalytics: false,
  canManageGmailPurchases: false,
  canManageGoogleWorkspace: false,
  canQuoteEmergencyParts: false,
  canSplitSalesOrders: false,
};

export const FULL_ADMIN_PERMISSIONS: ViewerPermissions = {
  canEditSales: true,
  canEditCostManager: true,
  canEditCatalog: true,
  canEditTenders: true,
  canManageOCTracking: true,
  canEditDocuments: true,
  canManageSalesOrders: true,
  canManageQuotesHistory: true,
  canManageSuppliers: true,
  canManageSerials: true,
  canManageCustomization: true,
  canExportData: true,
  canManageBackups: true,
  canAccessSqlAnalytics: true,
  canManageGmailPurchases: true,
  canManageGoogleWorkspace: true,
  canQuoteEmergencyParts: true,
  canSplitSalesOrders: true,
};

export const INITIAL_SYSTEM_USERS: StoredUserAccount[] = [
  {
    id: 'user-admin-1',
    username: 'Jairo',
    password: '221295',
    name: 'Jairo',
    email: 'jairo@syd.com.co',
    role: 'admin',
    roleLabel: 'Administrador Total',
    department: 'Dirección Comercial & Costos',
    avatarColor: 'from-blue-600 to-indigo-600',
    permissions: { ...FULL_ADMIN_PERMISSIONS },
  },
  {
    id: 'user-viewer-2',
    username: 'Fabian',
    password: '123456',
    name: 'Fabian',
    email: 'fabian@syd.com.co',
    role: 'viewer',
    roleLabel: 'Investigador & Descargas',
    department: 'Licitaciones & Consultas',
    avatarColor: 'from-emerald-600 to-teal-600',
    permissions: { ...DEFAULT_VIEWER_PERMISSIONS },
  },
];

const USERS_STORAGE_KEY = 'syd_registered_system_users_v4';
const AUTH_SESSION_KEY = 'syd_current_session_user_v4';

export const sanitizeUserAccounts = (rawList: any[]): { users: StoredUserAccount[]; hasChanges: boolean } => {
  if (!Array.isArray(rawList) || rawList.length === 0) {
    return { users: INITIAL_SYSTEM_USERS, hasChanges: true };
  }
  let hasChanges = false;
  const users: StoredUserAccount[] = rawList.map((u: any) => {
    let cleanU = { ...u };
    const uName = (cleanU.username || '').toLowerCase().trim();
    const displayName = (cleanU.name || '').toLowerCase().trim();

    if (uName === 'papi' || displayName === 'papi' || cleanU.id === 'user-admin-1') {
      if (cleanU.username !== 'Jairo' || cleanU.name !== 'Jairo' || cleanU.password !== '221295') {
        hasChanges = true;
      }
      cleanU.id = 'user-admin-1';
      cleanU.username = 'Jairo';
      cleanU.name = 'Jairo';
      cleanU.email = 'jairo@syd.com.co';
      cleanU.password = '221295';
      cleanU.role = 'admin';
      cleanU.roleLabel = 'Administrador Total';
      cleanU.department = 'Dirección Comercial & Costos';
    } else if (uName === 'hijo' || displayName === 'hijo' || cleanU.id === 'user-viewer-2') {
      if (cleanU.username !== 'Fabian' || cleanU.name !== 'Fabian' || cleanU.password !== '123456') {
        hasChanges = true;
      }
      cleanU.id = 'user-viewer-2';
      cleanU.username = 'Fabian';
      cleanU.name = 'Fabian';
      cleanU.email = 'fabian@syd.com.co';
      cleanU.password = '123456';
      cleanU.role = 'viewer';
      cleanU.roleLabel = 'Investigador & Descargas';
      cleanU.department = 'Licitaciones & Consultas';
    }

    if (cleanU.username?.toLowerCase() === 'jairo') {
      cleanU.password = '221295';
      cleanU.name = 'Jairo';
      cleanU.role = 'admin';
    }
    if (cleanU.username?.toLowerCase() === 'fabian') {
      cleanU.password = '123456';
      cleanU.name = 'Fabian';
    }

    return {
      ...cleanU,
      permissions:
        cleanU.role === 'admin'
          ? { ...FULL_ADMIN_PERMISSIONS }
          : { ...DEFAULT_VIEWER_PERMISSIONS, ...(cleanU.permissions || {}) },
    };
  });

  return { users, hasChanges };
};

export const getStoredUsers = (): StoredUserAccount[] => {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY) || localStorage.getItem('syd_registered_system_users_v3');
    if (!raw) {
      saveStoredUsers(INITIAL_SYSTEM_USERS);
      return INITIAL_SYSTEM_USERS;
    }
    const parsed = JSON.parse(raw);
    const { users, hasChanges } = sanitizeUserAccounts(parsed);
    if (hasChanges) {
      saveStoredUsers(users);
    }
    return users;
  } catch (err) {
    console.error('Error reading users from localStorage', err);
    return INITIAL_SYSTEM_USERS;
  }
};

let authBroadcastChannel: BroadcastChannel | null = null;
try {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    authBroadcastChannel = new BroadcastChannel('syd_auth_broadcast_channel');
  }
} catch {}

export const saveStoredUsers = (users: StoredUserAccount[]) => {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('syd_users_updated', { detail: users }));
    }
    if (authBroadcastChannel) {
      try {
        authBroadcastChannel.postMessage({ type: 'USERS_UPDATED', users });
      } catch {}
    }
    saveSystemUsersToFirestore(users).catch((e) => console.error('Cloud user sync error:', e));
  } catch (err) {
    console.error('Error saving users to localStorage', err);
  }
};

export const createStoredUserAccount = (
  newUser: Omit<StoredUserAccount, 'id'>
): { users: StoredUserAccount[]; createdUser: StoredUserAccount } => {
  const users = getStoredUsers();
  const newId = `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const created: StoredUserAccount = {
    ...newUser,
    id: newId,
    updatedAt: now,
    _updatedAt: now,
    permissions:
      newUser.role === 'admin'
        ? { ...FULL_ADMIN_PERMISSIONS }
        : newUser.permissions || { ...DEFAULT_VIEWER_PERMISSIONS },
  };

  const updated = [...users, created];
  saveStoredUsers(updated);
  saveSingleUserToFirestore(created).catch((e) => console.error('Cloud create user error:', e));
  return { users: updated, createdUser: created };
};

export const deleteStoredUserAccount = (userId: string): StoredUserAccount[] => {
  const users = getStoredUsers();
  // Prevent deleting the primary admin account
  if (userId === 'user-admin-1') {
    return users;
  }
  const updated = users.filter((u) => u.id !== userId);
  saveStoredUsers(updated);
  deleteUserFromFirestore(userId).catch((e) => console.error('Cloud delete user error:', e));
  return updated;
};

export const updateStoredUserAccount = (
  userId: string,
  updates: Partial<StoredUserAccount>
): StoredUserAccount[] => {
  const users = getStoredUsers();
  let updatedRecord: StoredUserAccount | null = null;
  const now = new Date().toISOString();
  const updated = users.map((u) => {
    if (u.id === userId) {
      updatedRecord = { ...u, ...updates, updatedAt: now, _updatedAt: now };
      return updatedRecord;
    }
    return u;
  });
  saveStoredUsers(updated);
  if (updatedRecord) {
    saveSingleUserToFirestore(updatedRecord).catch((e) => console.error('Cloud update user error:', e));
  }

  // If the updated user is currently logged in, update session too
  const currentUser = getActiveSessionUser();
  if (currentUser && (currentUser.id === userId || (updatedRecord && currentUser.username?.toLowerCase() === (updatedRecord as StoredUserAccount).username?.toLowerCase()))) {
    const found = updated.find((u) => u.id === userId);
    if (found) {
      const { password, ...safe } = found;
      setStoredAuthUser(safe);
    }
  }

  return updated;
};

export const updateSpecificUserPermissions = (
  userId: string,
  newPermissions: ViewerPermissions
): StoredUserAccount[] => {
  const users = getStoredUsers();
  let updatedRecord: StoredUserAccount | null = null;
  const now = new Date().toISOString();
  const updated = users.map((u) => {
    if (u.id === userId) {
      updatedRecord = { ...u, permissions: newPermissions, updatedAt: now, _updatedAt: now };
      return updatedRecord;
    }
    return u;
  });
  saveStoredUsers(updated);
  if (updatedRecord) {
    saveSingleUserToFirestore(updatedRecord).catch((e) => console.error('Cloud update user permissions error:', e));
  }

  // Update current session if matching
  const currentUser = getActiveSessionUser();
  if (
    currentUser &&
    (currentUser.id === userId ||
      (updatedRecord &&
        currentUser.username?.toLowerCase() === (updatedRecord as StoredUserAccount).username?.toLowerCase()))
  ) {
    const safe = { ...currentUser, permissions: newPermissions };
    setStoredAuthUser(safe);
  }

  return updated;
};

export const updateViewerPermissions = (newPermissions: ViewerPermissions): StoredUserAccount[] => {
  const users = getStoredUsers();
  const now = new Date().toISOString();
  const updated = users.map((u) => {
    if (u.role === 'viewer') {
      const rec = { ...u, permissions: newPermissions, updatedAt: now, _updatedAt: now };
      saveSingleUserToFirestore(rec).catch((e) => console.error('Cloud update user permissions error:', e));
      return rec;
    }
    return u;
  });
  saveStoredUsers(updated);

  // Update current session if logged in as viewer
  const currentUser = getActiveSessionUser();
  if (currentUser && currentUser.role === 'viewer') {
    const safe = { ...currentUser, permissions: newPermissions };
    setStoredAuthUser(safe);
  }

  return updated;
};

export const getActiveSessionUser = (): AuthUser | null => {
  try {
    const raw = sessionStorage.getItem(AUTH_SESSION_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

export const getStoredAuthUser = (): AuthUser | null => {
  // Cada vez que se abra la aplicación debe solicitar autenticación (pantalla de ingreso primero)
  return null;
};

export const setStoredAuthUser = (user: AuthUser | null) => {
  try {
    if (!user) {
      sessionStorage.removeItem(AUTH_SESSION_KEY);
      localStorage.removeItem(AUTH_SESSION_KEY);
      localStorage.removeItem('syd_current_session_user_v3');
      sessionStorage.removeItem('syd_current_session_user_v3');
    } else {
      sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
    }
  } catch (err) {
    console.error('Error writing auth to storage', err);
  }
};

export const authenticateUser = (usernameInput: string, passwordInput: string): AuthUser | null => {
  const cleanUsername = (usernameInput || '').trim().toLowerCase();
  const cleanPass = (passwordInput || '').trim();
  if (!cleanUsername || !cleanPass) return null;

  // Strictly block obsolete user names: papi and hijo are not permitted
  if (
    cleanUsername === 'papi' ||
    cleanUsername === 'hijo' ||
    cleanUsername === 'papi@syd.com.co' ||
    cleanUsername === 'hijo@syd.com.co'
  ) {
    return null;
  }

  let users = getStoredUsers();
  if (!Array.isArray(users) || users.length === 0) {
    users = INITIAL_SYSTEM_USERS;
  }

  // Ensure no legacy accounts named papi or hijo can be matched
  const filteredUsers = users.filter(
    (u) =>
      u.username?.toLowerCase() !== 'papi' &&
      u.username?.toLowerCase() !== 'hijo' &&
      u.name?.toLowerCase() !== 'papi' &&
      u.name?.toLowerCase() !== 'hijo'
  );

  // Check if credentials match any registered user in system
  const found = filteredUsers.find(
    (u) =>
      (u.username?.toLowerCase() === cleanUsername ||
       u.name?.toLowerCase() === cleanUsername ||
       u.email?.toLowerCase() === cleanUsername ||
       (cleanUsername === 'admin' && u.role === 'admin') ||
       (cleanUsername === 'investigador' && u.role === 'viewer') ||
       (cleanUsername === 'jairo' && u.username?.toLowerCase() === 'jairo') ||
       (cleanUsername === 'fabian' && u.username?.toLowerCase() === 'fabian')) &&
      (u.password === cleanPass ||
       (u.role === 'admin' && cleanPass === '221295') ||
       (u.role === 'viewer' && cleanUsername === 'fabian' && cleanPass === '123456'))
  );

  if (found) {
    const { password, ...safeUser } = found;
    return safeUser;
  }

  // Fallback to default admin for Jairo if not found in stored users
  if (
    (cleanUsername === 'jairo' ||
     cleanUsername === 'jairo@syd.com.co' ||
     cleanUsername === 'admin' ||
     cleanUsername === 'administrador') &&
    cleanPass === '221295'
  ) {
    const defaultAdmin = INITIAL_SYSTEM_USERS.find((u) => u.role === 'admin') || INITIAL_SYSTEM_USERS[0];
    const { password, ...safeUser } = defaultAdmin;
    return safeUser;
  }

  // Fallback to default viewer for Fabian if not found in stored users
  if (
    (cleanUsername === 'fabian' ||
     cleanUsername === 'fabian@syd.com.co' ||
     cleanUsername === 'investigador' ||
     cleanUsername === 'consulta' ||
     cleanUsername === 'viewer') &&
    cleanPass === '123456'
  ) {
    const defaultViewer = INITIAL_SYSTEM_USERS.find((u) => u.role === 'viewer') || INITIAL_SYSTEM_USERS[1];
    const { password, ...safeUser } = defaultViewer;
    return safeUser;
  }

  return null;
};

export const verifyAdminPassword = (passwordInput: string): boolean => {
  const cleanPass = (passwordInput || '').trim();
  if (!cleanPass) return false;
  const users = getStoredUsers();
  const adminUsers = users.filter((u) => u.role === 'admin');
  if (adminUsers.length > 0) {
    return adminUsers.some((admin) => admin.password === cleanPass);
  }
  return cleanPass === '221295';
};

