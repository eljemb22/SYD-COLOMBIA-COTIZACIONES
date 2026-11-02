/**
 * Puente de autenticacion de Google para la version de escritorio.
 *
 * En la app web (navegador) el flujo usa Google Identity Services (GSI) con un
 * popup, que exige que el origen de la pagina este autorizado en Google Cloud.
 *
 * En la version de escritorio la interfaz se carga desde el origen interno
 * "app://syd", que Google no acepta. Por eso el proceso principal de Electron
 * abre una ventana auxiliar en "http://localhost:PORT" (origen ya autorizado),
 * ahi se completa el flujo y el token vuelve a la app por IPC.
 */

export interface DesktopOAuthTokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
}

export interface DesktopOAuthBridge {
  isDesktop: true;
  platform: string;
  version: string;
  /** Origen real que Google exige registrar (http://localhost:PORT). */
  oauthOrigin?: string;
  startOAuth: (options: {
    clientId: string;
    scopes: string;
  }) => Promise<DesktopOAuthTokenResponse | null>;
}

declare global {
  interface Window {
    sydDesktop?: DesktopOAuthBridge;
  }
}

/** Indica si la app esta corriendo dentro de Electron (escritorio). */
export function isDesktopRuntime(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.sydDesktop && window.sydDesktop.isDesktop);
}

/**
 * Ejecuta el flujo OAuth de Google.
 * En escritorio delega en la ventana auxiliar de Electron; en web usa GSI.
 * Devuelve la respuesta de token de Google ({ access_token, expires_in, ... }).
 */
export async function requestGoogleToken(
  clientId: string,
  scopes: string,
  initTokenClient: (options: {
    client_id: string;
    scope: string;
    prompt: string;
    callback: (response: any) => void;
    error_callback?: (err: any) => void;
  }) => { requestAccessToken: (overrideConfig?: { prompt?: string }) => void }
): Promise<DesktopOAuthTokenResponse> {
  // Escritorio: flujo por IPC hacia la ventana auxiliar en localhost.
  if (isDesktopRuntime() && window.sydDesktop) {
    try {
      const result = await window.sydDesktop.startOAuth({ clientId, scopes });
      if (!result) {
        throw new Error('Google no devolvio ninguna respuesta de autenticacion.');
      }
      if (result.error) {
        throw new Error(result.error);
      }
      return result;
    } catch (err: any) {
      throw new Error(err?.message || 'No se pudo completar la autenticacion con Google.');
    }
  }

  // Web: flujo estandar de Google Identity Services.
  return new Promise<DesktopOAuthTokenResponse>((resolve, reject) => {
    try {
      const client = initTokenClient({
        client_id: clientId,
        scope: scopes,
        prompt: 'consent select_account',
        callback: (response: any) => resolve(response),
        error_callback: (err: any) => reject(err),
      });
      client.requestAccessToken({ prompt: 'select_account' });
    } catch (err: any) {
      reject(err);
    }
  });
}
