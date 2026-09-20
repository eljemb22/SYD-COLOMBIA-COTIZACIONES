import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  Firestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  setLogLevel,
} from 'firebase/firestore';
import { getAuth, Auth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

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
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
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

export function getFirestoreDb(): Firestore | null {
  return firestoreInstance || null;
}

export function getFirestoreInstances(): Firestore[] {
  return [db];
}

// Auto sign-in anonymously if not signed in so all Firestore requests have valid security context
if (typeof window !== 'undefined' && auth) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      signInAnonymously(auth).catch(() => {
        // Silent fallback for offline / unconfigured environments
      });
    }
  });
}

export { app };


