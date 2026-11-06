import React, { useState, useEffect } from 'react';
import { DownloadCloud, RefreshCw, X, CheckCircle2 } from 'lucide-react';

interface DesktopUpdateState {
  available: boolean;
  version: string;
  progress: number;
  status: string;
  downloading: boolean;
  downloaded: boolean;
  error: string | null;
}

const initialState: DesktopUpdateState = {
  available: false,
  version: '',
  progress: 0,
  status: '',
  downloading: false,
  downloaded: false,
  error: null,
};

export const DesktopUpdateBanner: React.FC = () => {
  const desktop = (window as any).sydDesktop;
  const [state, setState] = useState<DesktopUpdateState>(initialState);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!desktop || !desktop.onUpdateEvent) return;

    const off = desktop.onUpdateEvent((payload: any) => {
      if (!payload || !payload.type) return;
      switch (payload.type) {
        case 'available':
          setState((s) => ({
            ...s,
            available: true,
            version: payload.version || s.version,
            status: `Nueva versión ${payload.version || ''} disponible`,
            downloading: false,
            downloaded: false,
            error: null,
          }));
          setDismissed(false);
          break;
        case 'progress':
          setState((s) => ({
            ...s,
            progress: Math.round(payload.percent || 0),
            status: `Descargando actualización... ${Math.round(payload.percent || 0)}%`,
            downloading: true,
          }));
          break;
        case 'downloaded':
          setState((s) => ({
            ...s,
            downloaded: true,
            downloading: false,
            available: true,
            progress: 100,
            status: 'Actualización lista. Reinicia para instalar.',
          }));
          break;
        case 'error':
          if (payload.message && payload.message.includes('404')) return; // no releases published yet
          setState((s) => ({ ...s, downloading: false, error: payload.message || 'Error al actualizar' }));
          break;
        default:
          break;
      }
    });

    // Check on mount
    if (desktop.checkForUpdates) {
      desktop.checkForUpdates().catch(() => {});
    }

    return () => {
      if (typeof off === 'function') off();
    };
  }, [desktop]);

  if (!desktop) return null;
  if (dismissed && !state.downloaded && !state.downloading) return null;
  if (!state.available && !state.downloaded && !state.error) return null;

  const handleDownload = async () => {
    if (desktop.downloadUpdate) {
      setState((s) => ({ ...s, downloading: true, error: null, status: 'Iniciando descarga...', progress: 0 }));
      try {
        await desktop.downloadUpdate();
      } catch (e: any) {
        setState((s) => ({ ...s, downloading: false, error: e && e.message ? e.message : String(e) }));
      }
    }
  };

  const handleInstall = async () => {
    if (desktop.quitAndInstall) {
      try {
        await desktop.quitAndInstall();
      } catch (e: any) {
        setState((s) => ({ ...s, error: e && e.message ? e.message : String(e) }));
      }
    }
  };

  return (
    <div
      id="app-desktop-update-banner"
      role="alert"
      className="relative z-40 bg-gradient-to-r from-violet-950 via-indigo-900 to-slate-900 border-b border-violet-500/40 text-white shadow-xl animate-fadeIn"
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6">
        {state.error ? (
          <div className="flex items-center justify-between gap-3 text-xs text-rose-300">
            <span>{state.error}</span>
            {state.available && !state.downloaded && (
              <button
                type="button"
                onClick={handleDownload}
                className="shrink-0 rounded-lg border border-rose-400/40 px-3 py-1.5 font-bold hover:bg-rose-500/10"
              >
                Reintentar descarga
              </button>
            )}
          </div>
        ) : state.downloaded ? (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-black tracking-wide uppercase text-emerald-300">
                  Actualización lista
                </span>
                <p className="text-[11px] text-slate-300">
                  Versión {state.version} descargada. Reinicia la aplicación para instalarla.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleInstall}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reiniciar e instalar</span>
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800/60 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : state.downloading ? (
          <div className="py-1 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 font-bold text-violet-300">
                <DownloadCloud className="w-4 h-4 animate-bounce text-violet-400 shrink-0" />
                <span className="truncate">{state.status}</span>
              </div>
              <span className="font-black text-violet-400 tabular-nums shrink-0">{state.progress}%</span>
            </div>
            <div className="w-full bg-slate-950/80 rounded-full h-2.5 overflow-hidden border border-violet-500/30 p-0.5 shadow-inner">
              <div
                className="bg-gradient-to-r from-violet-400 via-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-300 ease-out shadow-sm"
                style={{ width: `${state.progress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
              <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-400/40 text-violet-300 flex items-center justify-center shrink-0">
                <DownloadCloud className="w-4 h-4 text-violet-300" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black tracking-wide uppercase text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-400/30">
                    Actualización disponible
                  </span>
                  <span className="text-xs font-extrabold text-white">Versión {state.version}</span>
                </div>
                <p className="text-[11px] text-slate-300 truncate max-w-xl">
                  Hay una nueva versión del instalador lista para descargar.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end flex-wrap">
              <button
                type="button"
                onClick={handleDownload}
                disabled={state.downloading}
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-400 to-indigo-400 hover:from-violet-300 hover:to-indigo-300 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>{state.downloading ? 'Descargando…' : 'Descargar actualización'}</span>
              </button>
              <button
                type="button"
                onClick={() => setDismissed(true)}
                title="Cerrar notificación"
                className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800/60 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
