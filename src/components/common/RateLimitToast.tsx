import React, { useState, useEffect } from 'react';
import { Clock, X, AlertTriangle } from 'lucide-react';
import { RateLimitEventDetail } from '../../utils/rateLimitHandler';

export const RateLimitToast: React.FC = () => {
  const [alert, setAlert] = useState<RateLimitEventDetail | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);

  useEffect(() => {
    const handleAlert = (e: Event) => {
      const customEvent = e as CustomEvent<RateLimitEventDetail>;
      if (customEvent.detail) {
        setAlert(customEvent.detail);
        setSecondsRemaining(customEvent.detail.retryAfterSeconds || 60);
      }
    };

    window.addEventListener('syd_rate_limit_alert', handleAlert);
    return () => {
      window.removeEventListener('syd_rate_limit_alert', handleAlert);
    };
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!alert) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setAlert(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [alert]);

  if (!alert) return null;

  return (
    <div
      id="rate-limit-toast-banner"
      className="fixed bottom-6 right-6 z-50 max-w-md w-full bg-slate-900/95 backdrop-blur-md border border-amber-500/40 rounded-2xl shadow-2xl p-4 text-slate-100 animate-in fade-in slide-in-from-bottom-5 duration-300"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400 shrink-0 mt-0.5">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>Límite de Solicitudes Temporal</span>
              {alert.feature && (
                <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-200 rounded text-[10px] font-semibold">
                  {alert.feature}
                </span>
              )}
            </h4>
            <button
              id="dismiss-rate-limit-toast-btn"
              onClick={() => setAlert(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              title="Cerrar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed mb-3">
            {alert.message}
          </p>
          <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-800/80 pt-2">
            <span className="flex items-center gap-1.5 text-amber-400/90 font-medium">
              <Clock className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '3s' }} />
              Reanudación en {secondsRemaining}s
            </span>
            <span className="text-slate-500 text-[10px]">
              La app sigue activa con datos locales
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
