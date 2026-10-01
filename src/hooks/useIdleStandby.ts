import { useState, useEffect, useRef, useCallback } from 'react';
import { AuthUser } from '../types';

export const DEFAULT_STANDBY_TIMEOUT_MINUTES = 10;
export const STORAGE_KEY_STANDBY_TIMEOUT = 'syd_standby_timeout_minutes';

export const STANDBY_TIMEOUT_OPTIONS = [
  { value: 5, label: '5 minutos' },
  { value: 10, label: '10 minutos (Recomendado)' },
  { value: 15, label: '15 minutos' },
  { value: 20, label: '20 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 45, label: '45 minutos' },
  { value: 60, label: '1 hora (60 minutos)' },
  { value: 120, label: '2 horas' },
  { value: 0, label: 'Desactivado (Nunca suspender)' },
];

export interface UseIdleStandbyReturn {
  isStandby: boolean;
  standbySince: Date | null;
  timeoutMinutes: number;
  setTimeoutMinutes: (minutes: number) => void;
  enterStandby: () => void;
  wakeUp: () => void;
  lastActivityTime: number;
}

export function useIdleStandby(currentUser: AuthUser | null): UseIdleStandbyReturn {
  const [isStandby, setIsStandby] = useState<boolean>(false);
  const [standbySince, setStandbySince] = useState<Date | null>(null);

  const [timeoutMinutes, setTimeoutMinutesState] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_STANDBY_TIMEOUT);
      if (stored !== null) {
        const parsed = parseInt(stored, 10);
        return isNaN(parsed) ? DEFAULT_STANDBY_TIMEOUT_MINUTES : parsed;
      }
    } catch {}
    return DEFAULT_STANDBY_TIMEOUT_MINUTES;
  });

  const lastActivityTimeRef = useRef<number>(Date.now());
  const lastThrottleUpdateRef = useRef<number>(0);
  const isStandbyRef = useRef<boolean>(false);
  isStandbyRef.current = isStandby;

  const setTimeoutMinutes = useCallback((minutes: number) => {
    setTimeoutMinutesState(minutes);
    try {
      localStorage.setItem(STORAGE_KEY_STANDBY_TIMEOUT, String(minutes));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('syd_standby_timeout_updated', { detail: minutes }));
      }
    } catch {}
  }, []);

  // Listen to external timeout changes (e.g. from CustomizationModal or other tabs)
  useEffect(() => {
    const handleCustomTimeoutEvent = (e: any) => {
      const mins = Number(e?.detail);
      if (!isNaN(mins)) {
        setTimeoutMinutesState(mins);
      }
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY_STANDBY_TIMEOUT && e.newValue !== null) {
        const parsed = parseInt(e.newValue, 10);
        if (!isNaN(parsed)) {
          setTimeoutMinutesState(parsed);
        }
      }
    };

    window.addEventListener('syd_standby_timeout_updated', handleCustomTimeoutEvent);
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      window.removeEventListener('syd_standby_timeout_updated', handleCustomTimeoutEvent);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  const enterStandby = useCallback(() => {
    if (!currentUser) return; // Do not enter standby if no user is logged in
    setIsStandby(true);
    setStandbySince(new Date());
    isStandbyRef.current = true;
  }, [currentUser]);

  const wakeUp = useCallback(() => {
    setIsStandby(false);
    setStandbySince(null);
    isStandbyRef.current = false;
    lastActivityTimeRef.current = Date.now();
  }, []);

  // Update activity timestamp with light throttling (1.2s)
  const recordActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastThrottleUpdateRef.current > 1200) {
      lastThrottleUpdateRef.current = now;
      lastActivityTimeRef.current = now;
    }
  }, []);

  // Track global user interactions when NOT in standby
  useEffect(() => {
    if (!currentUser || isStandby) return;

    const handleUserInteraction = () => {
      recordActivity();
    };

    const events: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'wheel',
    ];

    events.forEach((evt) => {
      window.addEventListener(evt, handleUserInteraction, { passive: true });
    });

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserInteraction);
      });
    };
  }, [currentUser, isStandby, recordActivity]);

  // Periodic idle check (every 5 seconds)
  useEffect(() => {
    if (!currentUser || timeoutMinutes <= 0) return;

    const timeoutMs = timeoutMinutes * 60 * 1000;

    const checkIdle = () => {
      if (isStandbyRef.current) return;
      const now = Date.now();
      const elapsed = now - lastActivityTimeRef.current;
      if (elapsed >= timeoutMs) {
        enterStandby();
      }
    };

    const intervalId = setInterval(checkIdle, 5000);

    // Also check on visibilitychange/focus (in case user had the tab minimized or OS locked)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkIdle();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [currentUser, timeoutMinutes, enterStandby]);

  // Wake-up listener when IN standby:
  // User specifically requested: "presionando enter o algo para que vuelva... sin perder la informacion"
  useEffect(() => {
    if (!isStandby) return;

    const handleKeyDownInStandby = (e: KeyboardEvent) => {
      // Any common resume key: Enter, Space, Escape, or standard keys
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape' || e.key === 'Return') {
        e.preventDefault();
        wakeUp();
      } else if (!e.ctrlKey && !e.altKey && !e.metaKey && e.key.length === 1) {
        // Alphanumeric keys
        wakeUp();
      }
    };

    window.addEventListener('keydown', handleKeyDownInStandby, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDownInStandby, true);
    };
  }, [isStandby, wakeUp]);

  return {
    isStandby,
    standbySince,
    timeoutMinutes,
    setTimeoutMinutes,
    enterStandby,
    wakeUp,
    lastActivityTime: lastActivityTimeRef.current,
  };
}
