/**
 * Mensajes claros para los errores de OAuth de Google (Google Identity Services).
 *
 * El error mas comun al mover la app fuera de Google AI Studio es
 * `400: origin_mismatch`: el origen desde el que se abre la ventana de Google
 * (por ejemplo http://localhost:3000) no esta en la lista de
 * "Origenes de JavaScript autorizados" del cliente OAuth 2.0 de tipo Web.
 */

export const GOOGLE_OAUTH_CLIENT_ID =
  '56938552577-gtbfqhu57eb56b689kg11e4a7vqv8i1p.apps.googleusercontent.com';

export const GOOGLE_CLOUD_PROJECT_ID = 'gen-lang-client-0388689309';

export const GOOGLE_OAUTH_ERROR_HELP =
  'Solucion (2 minutos):\n' +
  '1) Abre https://console.cloud.google.com y selecciona el proyecto "' +
  GOOGLE_CLOUD_PROJECT_ID +
  '".\n' +
  '2) Ve a "APIs y servicios > Credenciales" y abre el cliente OAuth 2.0 de tipo "Web application" con ID ' +
  GOOGLE_OAUTH_CLIENT_ID +
  '.\n' +
  '3) En "Origenes de JavaScript autorizados" agrega el origen desde el que abres la app ' +
  '(por ejemplo http://localhost:3000). Si entras por IP de red, agrega tambien esa (http://192.168.x.x:3000).\n' +
  '4) Guarda y espera 2 a 5 minutos. Vuelve a la app y conecta de nuevo.\n' +
  '5) Si despues aparece "access_denied", agrega tu correo en "APIs y servicios > Pantalla de consentimiento de OAuth > Usuarios de prueba".';

/**
 * Detecta si el error viene del popup de Google y devuelve un texto util en espanol.
 */
export function buildGoogleOAuthErrorMessage(
  error: unknown,
  fallback = 'Error al autenticar con Google.'
): string {
  const raw =
    typeof error === 'string'
      ? error
      : ((error as any)?.message ||
          (error as any)?.error_description ||
          (error as any)?.error ||
          (error as any)?.type ||
          '') + '';

  const text = String(raw || '');
  const lower = text.toLowerCase();

  if (lower.includes('origin_mismatch') || lower.includes('idpiframe_initialization_failed')) {
    return (
      'Google bloqueo la conexion porque este origen no esta autorizado (Error 400: origin_mismatch). ' +
      'Significa que la app ahora se abre desde una direccion distinta a la de Google AI Studio.\n\n' +
      GOOGLE_OAUTH_ERROR_HELP
    );
  }

  if (lower.includes('access_denied') || lower.includes('403')) {
    return (
      'Acceso denegado por Google (Error 403: access_denied). Tu correo no tiene permisos para esta aplicacion.\n\n' +
      GOOGLE_OAUTH_ERROR_HELP
    );
  }

  if (lower.includes('popup_closed') || lower.includes('closed_by_user')) {
    return 'La ventana de autenticacion de Google se cerro antes de otorgar los permisos. Vuelve a intentarlo y acepta todos los permisos solicitados.';
  }

  if (lower.includes('invalid_client')) {
    return (
      'El cliente OAuth de Google configurado no es valido o no esta habilitado para la API de Drive/Gmail.\n\n' +
      GOOGLE_OAUTH_ERROR_HELP
    );
  }

  if (lower.includes('unauthorized_client')) {
    return (
      'La API de Google Drive o Gmail no esta habilitada en el proyecto "' +
      GOOGLE_CLOUD_PROJECT_ID +
      '". Habilitalas en "APIs y servicios > Biblioteca" y espera unos minutos.'
    );
  }

  if (lower.includes('popup_blocked') || lower.includes('popup')) {
    return 'El navegador bloqueo la ventana emergente de Google. Permite las ventanas emergentes para este sitio y vuelve a intentarlo.';
  }

  return text ? `${fallback} ${text}` : fallback;
}
