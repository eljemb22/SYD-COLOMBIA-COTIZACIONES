/**
 * Devuelve el origen que debe registrarse en Google Cloud Console para que
 * el popup de autorizacion de Google funcione.
 *
 * - En la version web es el origen real de la pagina (http://localhost:3000,
 *   el dominio de AI Studio, etc.).
 * - En la version de escritorio la interfaz se carga desde el origen interno
 *   "app://syd" (que Google no acepta), pero la autorizacion se completa en
 *   una ventana auxiliar servida desde http://localhost:PORT.
 */
export function getGoogleOAuthOriginLabel(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000';
  }
  const desktopOrigin = window.sydDesktop?.oauthOrigin;
  if (desktopOrigin) {
    return desktopOrigin;
  }
  return window.location.origin || 'http://localhost:3000';
}
