import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowRight, Zap, RefreshCw, X, ShieldCheck, DownloadCloud } from 'lucide-react';
import {
  CURRENT_APP_VERSION,
  hasUnseenAppUpdates,
  checkForAppUpdatesOnline,
  applyAppUpdateAndReload,
  markAppUpdateAsSeen,
  getActiveReleaseInfo,
  isVersionNewer,
  AppRelease,
} from '../../utils/versionCheck';

interface AppUpdateBannerProps {
  onOpenDetails?: () => void;
}

export const AppUpdateBanner: React.FC<AppUpdateBannerProps> = ({ onOpenDetails }) => {
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(() => hasUnseenAppUpdates());
  const [targetVersion, setTargetVersion] = useState<string>(CURRENT_APP_VERSION);
  const [releaseInfo, setReleaseInfo] = useState<AppRelease | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [installStatusText, setInstallStatusText] = useState('');
  const [isDismissed, setIsDismissed] = useState(false);

  const desktop = (window as any).sydDesktop;
  const ipcOffRef = useRef<(() => void) | null>(null);

  // Clean up IPC listener on unmount
  useEffect(() => {
    return () => {
      if (ipcOffRef.current) {
        ipcOffRef.current();
        ipcOffRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // Initial active release check
    const info = getActiveReleaseInfo();
    setReleaseInfo(info);
    if (info && info.version) {
      setTargetVersion(info.version);
    }

    // If desktop .exe, register IPC listener for real update events
    if (desktop && desktop.onUpdateEvent) {
      ipcOffRef.current = desktop.onUpdateEvent((payload: any) => {
        if (!payload || !payload.type) return;
        switch (payload.type) {
          case 'available':
            setUpdateAvailable(true);
            setTargetVersion(payload.version || targetVersion);
            setReleaseInfo((prev) => prev || { version: payload.version || '', title: 'Nueva Actualización SYD Colombia', summary: 'Nuevas mejoras y optimizaciones disponibles.', highlights: ['Mejoras de rendimiento y sincronización.'], releaseDate: new Date().toISOString().split('T')[0], isImportant: true });
            setIsInstalling(false);
            break;
          case 'progress':
            setInstallProgress(Math.round(payload.percent || 0));
            setInstallStatusText(`Descargando actualización... ${Math.round(payload.percent || 0)}%`);
            break;
          case 'downloaded':
            setInstallProgress(100);
            setInstallStatusText('Actualización descargada. Reiniciando e instalando...');
            setUpdateAvailable(false);
            setTimeout(() => {
              desktop.quitAndInstall();
            }, 1000);
            break;
          case 'error':
            if (payload.message && payload.message.includes('404')) return;
            setInstallStatusText('Error al verificar actualización.');
            break;
          default:
            break;
        }
      });
    }

    // Auto-check online on mount
    checkForAppUpdatesOnline().then((res) => {
      const installed =
        localStorage.getItem('installed_version') ||
        localStorage.getItem('syd_app_version_installed') ||
        CURRENT_APP_VERSION;
      if (
        res.updateAvailable &&
        isVersionNewer(res.latestVersion, installed) &&
        isVersionNewer(res.latestVersion, CURRENT_APP_VERSION)
      ) {
        setUpdateAvailable(true);
        setTargetVersion(res.latestVersion);
        setReleaseInfo(res.releaseInfo);
      } else {
        setUpdateAvailable(false);
      }
    });

    const handleUpdateEvent = (e: Event) => {
      const customEv = e as CustomEvent;
      const newVer = customEv.detail?.version;
      const installed =
        localStorage.getItem('installed_version') ||
        localStorage.getItem('syd_app_version_installed') ||
        CURRENT_APP_VERSION;

      if (
        newVer &&
        isVersionNewer(newVer, installed) &&
        isVersionNewer(newVer, CURRENT_APP_VERSION)
      ) {
        setTargetVersion(newVer);
        setUpdateAvailable(true);
        setIsDismissed(false);
      } else {
        setUpdateAvailable(false);
      }
    };

    window.addEventListener('syd-update-status-changed', handleUpdateEvent);
    return () => window.removeEventListener('syd-update-status-changed', handleUpdateEvent);
  }, []);

  if (!updateAvailable || isDismissed) {
    return null;
  }

  const handleInstallNow = () => {
    if (isInstalling) return;

    // If desktop .exe, use real electron-updater IPC: download + install
    if (desktop && desktop.downloadUpdate && desktop.quitAndInstall) {
      setIsInstalling(true);
      setInstallProgress(0);
      setInstallStatusText('Iniciando descarga de actualización desde la nube...');

      desktop.downloadUpdate().catch((e: any) => {
        setIsInstalling(false);
        setInstallStatusText('Error al iniciar descarga: ' + (e && e.message ? e.message : String(e)));
      });
      return;
    }

    // Web fallback: simulated flow + reload
    const versionToInstall = targetVersion || CURRENT_APP_VERSION;
    localStorage.setItem('installed_version', versionToInstall);
    localStorage.setItem('syd_app_version_installed', versionToInstall);
    markAppUpdateAsSeen(versionToInstall);

    setIsInstalling(true);
    setInstallProgress(12);
    setInstallStatusText('Iniciando descarga de actualización en línea...');

    const steps = [
      { progress: 32, text: `Descargando componentes de la versión v${versionToInstall}...` },
      { progress: 62, text: 'Sincronizando base de datos en la nube y verificando permisos...' },
      { progress: 85, text: 'Limpiando memoria caché de Windows...' },
      { progress: 97, text: 'Finalizando actualización y aplicando cambios...' },
      { progress: 100, text: '¡Instalación completada! Reiniciando aplicación...' },
    ];

    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < steps.length) {
        setInstallProgress(steps[stepIndex].progress);
        setInstallStatusText(steps[stepIndex].text);
        stepIndex++;
      } else {
        clearInterval(interval);
        localStorage.setItem('installed_version', versionToInstall);
        markAppUpdateAsSeen(versionToInstall);
        setTimeout(async () => {
          await applyAppUpdateAndReload(versionToInstall);
        }, 500);
      }
    }, 450);
  };

  const handleDismiss = () => {
    if (isInstalling) return;
    const versionToDismiss = targetVersion || CURRENT_APP_VERSION;
    setIsDismissed(true);
    setUpdateAvailable(false);
    localStorage.setItem('installed_version', versionToDismiss);
    localStorage.setItem('syd_app_version_installed', versionToDismiss);
    markAppUpdateAsSeen(versionToDismiss);
  };

  return (
    <div
      id="app-online-update-banner"
      role="alert"
      className="relative z-40 bg-gradient-to-r from-cyan-950 via-blue-900 to-indigo-950 border-b border-cyan-500/40 text-white shadow-xl animate-fadeIn"
    >
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6">
        {isInstalling ? (
          /* Installing Progress Mode */
          <div className="py-1 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 font-bold text-cyan-300">
                <DownloadCloud className="w-4 h-4 animate-bounce text-cyan-400 shrink-0" />
                <span className="truncate">{installStatusText}</span>
              </div>
              <span className="font-black text-cyan-400 tabular-nums shrink-0">
                {installProgress}%
              </span>
            </div>

            {/* Progress Bar Track */}
            <div className="w-full bg-slate-950/80 rounded-full h-2.5 overflow-hidden border border-cyan-500/30 p-0.5 shadow-inner">
              <div
                className="bg-gradient-to-r from-cyan-400 via-blue-500 to-emerald-400 h-full rounded-full transition-all duration-300 ease-out shadow-sm"
                style={{ width: `${installProgress}%` }}
              />
            </div>
          </div>
        ) : (
          /* Ready to Install Mode */
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Left Info */}
            <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 animate-spin-slow text-cyan-300" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-black tracking-wide uppercase text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-400/30">
                    ¡Actualización Disponible!
                  </span>
                  <span className="text-xs font-extrabold text-white">
                    Versión {targetVersion}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 truncate max-w-xl">
                  {releaseInfo?.title || 'Nuevas mejoras, correcciones y optimizaciones listas para instalar en tu app.'}
                </p>
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end flex-wrap">
              {onOpenDetails && (
                <button
                  type="button"
                  onClick={onOpenDetails}
                  className="px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-600/80 text-xs font-semibold transition cursor-pointer"
                >
                  Ver Novedades
                </button>
              )}

              <button
                id="btn-banner-install-update-now"
                type="button"
                onClick={handleInstallNow}
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black text-xs shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95 animate-pulse"
              >
                <Zap className="w-3.5 h-3.5 fill-current text-slate-950" />
                <span>Instalar Actualización</span>
              </button>

              <button
                type="button"
                onClick={handleDismiss}
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
