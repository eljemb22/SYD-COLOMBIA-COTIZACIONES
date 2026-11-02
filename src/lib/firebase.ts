import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  memoryLocalCache,
  setLogLevel,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import {
  getAuth,
  Auth,
  signInAnonymously,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Automatically purge any stale Firestore WebStorage mutation queues from previous error loops
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && (key.startsWith('firestore_') || key.startsWith('firestore:'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => {
      try {
        window.localStorage.removeItem(k);
      } catch (_) {}
    });
  } catch (_) {}
}

// Configure log level to avoid spamming the console with transient connection/offline warnings
try {
  setLogLevel('silent');
} catch (_) {}

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const rawDbId = (firebaseConfig as any).firestoreDatabaseId;

const firestoreDbId =
  rawDbId && rawDbId !== '(default)'
    ? rawDbId
    : undefined;

let firestoreInstance: Firestore;
try {
  const firestoreSettings = {
    ignoreUndefinedProperties: true,
    experimentalAutoDetectLongPolling: true,
    localCache: memoryLocalCache(),
  };

  if (firestoreDbId) {
    firestoreInstance = initializeFirestore(
      app,
      firestoreSettings,
      firestoreDbId
    );
  } else {
    firestoreInstance = initializeFirestore(app, firestoreSettings);
  }
} catch (e) {
  try {
    const fallbackSettings = {
      ignoreUndefinedProperties: true,
      experimentalAutoDetectLongPolling: true,
      localCache: memoryLocalCache(),
    };
    firestoreInstance = firestoreDbId
      ? initializeFirestore(app, fallbackSettings, firestoreDbId)
      : initializeFirestore(app, fallbackSettings);
  } catch {
    firestoreInstance = firestoreDbId ? getFirestore(app, firestoreDbId) : getFirestore(app);
  }
}

export const db: Firestore = firestoreInstance;
export const defaultDb: Firestore = firestoreInstance;
export const auth: Auth = getAuth(app);

/**
 * Inicia sesion en Firebase con el token de acceso de Google que la app ya
 * obtiene para Drive / Gmail.
 *
 * Firestore tiene reglas de seguridad que exigen un usuario autenticado. La
 * version de escritorio no puede usar el inicio de sesion anonimo (esta
 * deshabilitado en el proyecto), pero el proveedor de Google si esta activo.
 * Al canjear el token de Google por una sesion de Firebase, todas las PCs que
 * conecten la misma cuenta reciben los cambios en tiempo real.
 */
export async function signInFirebaseWithGoogle(accessToken: string): Promise<User | null> {
  if (!accessToken) return null;
  try {
    const credential = GoogleAuthProvider.credential(null, accessToken);
    const result = await signInWithCredential(auth, credential);
    return result.user;
  } catch (error) {
    // No se interrumpe la conexion de Drive/Gmail: la app sigue funcionando
    // en modo local aunque Firestore no pueda autenticarse.
    console.warn('Firebase Auth (Google) no disponible:', error);
    return null;
  }
}

/** Token de Google guardado por la app (Drive o Gmail), si existe. */
export function getStoredGoogleAccessToken(): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const token =
      localStorage.getItem('syd_google_workspace_token_v1') ||
      localStorage.getItem('syd_gmail_oauth_token_v1');
    if (!token) return null;
    if (token.startsWith('direct_') || token.startsWith('demo_') || token.startsWith('fake_')) {
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

export function getFirestoreDb(): Firestore | null {
  return firestoreInstance || null;
}

export function getFirestoreInstances(): Firestore[] {
  return [db];
}

// Restaura la sesion de Firebase al arrancar. Primero intenta con el token de
// Google que la app ya tiene guardado (Drive/Gmail); si no existe o falla,
// recurre al inicio anonimo (puede estar deshabilitado en el proyecto).
if (typeof window !== 'undefined' && auth) {
  let bootstrapAttempted = false;
  onAuthStateChanged(auth, (user) => {
    if (user || bootstrapAttempted) return;
    bootstrapAttempted = true;

    const storedGoogleToken = getStoredGoogleAccessToken();
    if (storedGoogleToken) {
      signInFirebaseWithGoogle(storedGoogleToken).then((firebaseUser) => {
        if (!firebaseUser) {
          signInAnonymously(auth).catch(() => {
            // Sin sesion: la app continua en modo local.
          });
        }
      });
      return;
    }

    signInAnonymously(auth).catch(() => {
      // Silent fallback for offline / unconfigured environments
    });
  });

  // Validate connection to Firestore
  async function testConnection() {
    try {
      await getDocFromServer(doc(db, 'test', 'connection'));
    } catch (error) {
      if (error instanceof Error && error.message.includes('the client is offline')) {
        console.warn('Firebase Firestore is operating in offline/reconnecting mode.');
      }
    }
  }
  testConnection().catch(() => {});
}

export { app };


