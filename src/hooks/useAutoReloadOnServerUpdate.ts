import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { markAppUpdateAsSeen, CURRENT_APP_VERSION } from '../utils/versionCheck';

interface ServerVersionResponse {
  bootTime: number;
  version: string;
  timestamp: number;
}

/**
 * Hook that detects new server builds, restarts, or version deployments in real time
 * and automatically reloads the page on any connected PC/device without manual user intervention.
 * 
 * Uses TRIPLE detection:
 * 1. Firebase Firestore real-time snapshot (`system_settings/app_reload_signal`)
 * 2. Rapid HTTP polling against `/api/version` (every 1.5 seconds + on window focus)
 * 3. Browser BroadcastChannel for instant local multi-tab coordination
 */
export function useAutoReloadOnServerUpdate() {
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const initialBootTimeRef = useRef<number | null>(null);
  const initialVersionRef = useRef<string | null>(null);
  const isReloadingRef = useRef<boolean>(false);
  const initialFirestoreSignalRef = useRef<number | null>(null);
  const serverWasOfflineRef = useRef<boolean>(false);
  const mountTimeRef = useRef<number>(Date.now());

  // Initialize current version in storage on mount
  useEffect(() => {
    markAppUpdateAsSeen(CURRENT_APP_VERSION);
  }, []);

  const triggerAppReload = (reason: string, targetVer?: string) => {
    if (isReloadingRef.current) return;

    // Guard: Prevent reload during the first 10 seconds of app load
    if (Date.now() - mountTimeRef.current < 10000) {
      console.log('[AutoReload] Reload ignored during initial boot grace period:', reason);
      return;
    }

    isReloadingRef.current = true;
    console.log('[AutoReload] Triggering reload due to:', reason);

    // Ensure the new version is marked as seen so user is never trapped in a prompt loop
    markAppUpdateAsSeen(targetVer || initialVersionRef.current || CURRENT_APP_VERSION);

    setIsUpdating(true);
    setUpdateMessage('🚀 Nueva actualización detectada. Reiniciando y sincronizando la app automáticamente...');

    // Broadcast to other open tabs on this browser
    try {
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('syd_app_reload_channel');
        bc.postMessage({ type: 'RELOAD', reason, timestamp: Date.now() });
        bc.close();
      }
    } catch (e) {
      console.debug(e);
    }

    // Clear client service caches if available
    try {
      if ('caches' in window) {
        window.caches.keys().then((keys) => {
          keys.forEach((key) => window.caches.delete(key));
        });
      }
    } catch (e) {
      console.warn(e);
    }

    setTimeout(async () => {
      // Confirm the new server build is alive and answering before refreshing
      try {
        const ping = await fetch('/api/version?t=' + Date.now(), {
          headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
        });
        if (ping.ok) {
          window.location.reload();
          return;
        }
      } catch (_) {}
      setTimeout(() => window.location.reload(), 1000);
    }, 1000);
  };

  // 1. Browser BroadcastChannel Listener for instant tab sync
  useEffect(() => {
    try {
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('syd_app_reload_channel');
        bc.onmessage = (event) => {
          if (event.data?.type === 'RELOAD') {
            triggerAppReload(event.data?.reason || 'Actualización en otra pestaña');
          }
        };
        return () => {
          bc.close();
        };
      }
    } catch (e) {}
  }, []);

  // 2. Firebase Firestore Real-Time Listener (instant push across all devices/PCs)
  useEffect(() => {
    try {
      if (!db) return;
      const reloadDoc = doc(db, 'system_settings', 'app_reload_signal');
      const unsubscribe = onSnapshot(
        reloadDoc,
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();
          const signalTimestamp = Number(data?.timestamp || 0);

          if (!signalTimestamp) return;

          if (initialFirestoreSignalRef.current === null) {
            initialFirestoreSignalRef.current = signalTimestamp;
            return;
          }

          if (signalTimestamp > initialFirestoreSignalRef.current) {
            initialFirestoreSignalRef.current = signalTimestamp;
            triggerAppReload(data?.reason || 'Nueva versión publicada en tiempo real');
          }
        },
        (err) => {
          console.debug('Firestore reload listener fallback:', err);
        }
      );

      return () => {
        unsubscribe();
      };
    } catch (e) {
      console.warn(e);
    }
  }, []);

  // 3. Server API polling backup (every 1.5 seconds + on window focus / visibility change)
  useEffect(() => {
    let isMounted = true;

    const checkServerVersion = async () => {
      if (isReloadingRef.current) return;
      if (typeof document !== 'undefined' && document.hidden) return;

      try {
        const response = await fetch('/api/version?t=' + Date.now(), {
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          },
        });

        if (response.status === 429) {
          // Rate limited, do not treat as offline or error, wait for next tick
          return;
        }

        if (!response.ok) {
          serverWasOfflineRef.current = true;
          return;
        }

        const data: ServerVersionResponse = await response.json();
        if (!data || !data.bootTime) return;

        // First initial check
        if (initialBootTimeRef.current === null) {
          initialBootTimeRef.current = data.bootTime;
          initialVersionRef.current = data.version;
          return;
        }

        // Server booted with a new build or version (only trigger if current session has been running for at least 15s)
        if (
          (initialBootTimeRef.current !== null && data.bootTime !== initialBootTimeRef.current) ||
          (data.version && initialVersionRef.current && data.version !== initialVersionRef.current)
        ) {
          if (isMounted) {
            triggerAppReload('Nuevo despliegue o actualización del servidor detectada');
          }
        } else {
          serverWasOfflineRef.current = false;
        }
      } catch (err) {
        // Server is currently compiling or restarting
        serverWasOfflineRef.current = true;
      }
    };

    checkServerVersion();
    const interval = setInterval(checkServerVersion, 60000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkServerVersion();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  return { isUpdating, updateMessage, triggerAppReload };
}
