/**
 * SYD Colombia - Utilidades de seguridad basadas en las categorías de ataque
 * de la skill Cloudflare security-audit-skill:
 *   - CLIENT-SIDE: sanitización de salida para prevenir XSS/DOM-injection
 *   - DESKTOP-MOBILE-AND-LOCAL-IPC: validación de mensajes IPC de Electron
 *   - WEB-PROTOCOL-AND-AUTH: rate limiting y almacenamiento seguro de credenciales
 */

/* =====================================================================
   1. CLIENT-SIDE — Sanitización de salida (prevenir XSS / DOM-injection)
   ===================================================================== */

/** Escapa caracteres HTML para renderizar texto de usuarios de forma segura. */
export const escapeHtml = (unsafe: string | null | undefined): string => {
  if (unsafe == null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/** Sanitiza un nombre de usuario o texto corto para mostrar en la UI. */
export const sanitizeDisplayText = (value: unknown, fallback = 'Desconocido'): string => {
  if (value == null || typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return escapeHtml(trimmed);
};

/** Sanitiza un objeto AuthUser eliminando campos sensibles antes de usar en UI. */
export const sanitizeAuthUser = (user: any): any => {
  if (!user || typeof user !== 'object') return null;
  return {
    id: String(user.id || ''),
    username: sanitizeDisplayText(user.username),
    name: sanitizeDisplayText(user.name),
    email: sanitizeDisplayText(user.email),
    role: user.role === 'admin' ? 'admin' : 'viewer',
    roleLabel: sanitizeDisplayText(user.roleLabel),
    department: sanitizeDisplayText(user.department),
    avatarColor: sanitizeDisplayText(user.avatarColor),
    permissions: user.permissions || {},
  };
};

/* =====================================================================
   2. DESKTOP-MOBILE-AND-LOCAL-IPC — Validación de mensajes IPC de Electron
   ===================================================================== */

/** Esquemas permitidos para handlers IPC del auto-updater. */
export const IPC_UPDATE_SCHEMAS = {
  'syd:update:check': { allowEmpty: true },
  'syd:update:download': { allowEmpty: true },
  'syd:update:install': { allowEmpty: true },
} as const;

/** Valida que un payload de IPC sea un objeto plano y no contenga prototipos peligrosos. */
export const validateIpcPayload = (payload: any, allowedKeys?: string[]): boolean => {
  if (payload == null) return true; // null/undefined permitidos para algunos handlers
  if (typeof payload !== 'object') return false;
  if (Array.isArray(payload)) return false;
  // Bloquear objetos con prototype modificado (prototype pollution)
  if (Object.getPrototypeOf(payload) !== Object.prototype && Object.getPrototypeOf(payload) !== null) {
    return false;
  }
  if (allowedKeys) {
    const keys = Object.keys(payload);
    return keys.every((k) => allowedKeys.includes(k));
  }
  return true;
};

/* =====================================================================
   3. WEB-PROTOCOL-AND-AUTH — Rate limiting y credenciales
   ===================================================================== */

/** Almacena intentos de fallo de login por usuario/IP para rate limiting. */
const loginAttempts = new Map<string, { count: number; firstAttempt: number }>();

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutos

/** Registra un intento fallido de login. Devuelve true si el usuario está bloqueado. */
export const recordLoginFailure = (identifier: string): { locked: boolean; remainingMs: number } => {
  const now = Date.now();
  const entry = loginAttempts.get(identifier) || { count: 0, firstAttempt: now };
  entry.count += 1;
  if (entry.count === 1) entry.firstAttempt = now;
  loginAttempts.set(identifier, entry);

  if (entry.count >= LOGIN_MAX_ATTEMPTS) {
    const elapsed = now - entry.firstAttempt;
    const remainingMs = Math.max(0, LOGIN_LOCKOUT_MS - elapsed);
    return { locked: remainingMs > 0, remainingMs };
  }
  return { locked: false, remainingMs: 0 };
};

/** Verifica si un identificador está bloqueado por rate limiting. */
export const isLoginLocked = (identifier: string): { locked: boolean; remainingMs: number } => {
  const entry = loginAttempts.get(identifier);
  if (!entry) return { locked: false, remainingMs: 0 };
  const now = Date.now();
  const elapsed = now - entry.firstAttempt;
  if (elapsed >= LOGIN_LOCKOUT_MS) {
    loginAttempts.delete(identifier);
    return { locked: false, remainingMs: 0 };
  }
  return { locked: true, remainingMs: LOGIN_LOCKOUT_MS - elapsed };
};

/** Limpia los intentos de fallo tras un login exitoso. */
export const clearLoginAttempts = (identifier: string) => {
  loginAttempts.delete(identifier);
};

/** Identificador por defecto (usa 'default' si no hay IP disponible). */
export const getLoginIdentifier = (ip?: string): string => `login:${ip || 'default'}`;
