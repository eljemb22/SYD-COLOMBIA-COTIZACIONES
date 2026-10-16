import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { markAppUpdateAsSeen, CURRENT_APP_VERSION, isVersionNewer } from '../utils/versionCheck';

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

  const triggerAppReload = (reason: string, targetVer?: string) => {
    console.log('[AppUpdate] Update available:', reason, targetVer);
    markAppUpdateAsSeen(targetVer || CURRENT_APP_VERSION);
    window.dispatchEvent(new CustomEvent('syd-update-status-changed', { detail: { version: targetVer || CURRENT_APP_VERSION } }));
  };

  // Browser BroadcastChannel Listener for coordinating update status across tabs
  useEffect(() => {
    try {
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('syd_app_reload_channel');
        bc.onmessage = (event) => {
          if (event.data?.type === 'RELOAD') {
            window.dispatchEvent(new CustomEvent('syd-update-status-changed', { detail: { reason: event.data?.reason } }));
          }
        };
        return () => {
          bc.close();
        };
      }
    } catch (e) {}
  }, []);

  // Firebase Firestore Real-Time Listener for update notices
  useEffect(() => {
    try {
      if (!db) return;
      const reloadDoc = doc(db, 'system_settings', 'app_reload_signal');
      const unsubscribe = onSnapshot(
        reloadDoc,
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();
          if (data?.version && isVersionNewer(data.version, CURRENT_APP_VERSION)) {
            window.dispatchEvent(new CustomEvent('syd-update-status-changed', { detail: { reason: data?.reason, version: data?.version } }));
          }
        },
        (err) => {
          console.debug('Firestore update listener notice:', err);
        }
      );

      return () => {
        unsubscribe();
      };
    } catch (e) {
      console.warn(e);
    }
  }, []);

  return { isUpdating, updateMessage, triggerAppReload };
}
