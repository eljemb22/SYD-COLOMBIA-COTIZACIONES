/**
 * SYD Colombia - Utilidades de seguridad para el proceso principal de Electron (CommonJS puro).
 * No depende de TypeScript: se ejecuta directamente en Node/Electron.
 *
 * Categorías de la skill Cloudflare security-audit-skill:
 *   - DESKTOP-MOBILE-AND-LOCAL-IPC: validación de mensajes IPC
 */

/** Valida que un payload de IPC sea un objeto plano y seguro. */
function validateIpcPayload(payload, allowedKeys) {
  if (payload == null) return true;
  if (typeof payload !== 'object') return false;
  if (Array.isArray(payload)) return false;
  // Bloquear objetos con prototype modificado (prototype pollution)
  const proto = Object.getPrototypeOf(payload);
  if (proto !== Object.prototype && proto !== null) return false;
  if (allowedKeys) {
    const keys = Object.keys(payload);
    return keys.every((k) => allowedKeys.includes(k));
  }
  return true;
}

module.exports = {
  validateIpcPayload,
};
