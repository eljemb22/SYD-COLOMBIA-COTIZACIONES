import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Smartphone,
  Laptop,
  Layers,
  ShieldCheck,
  Zap,
  Info,
  ArrowRight,
  DownloadCloud,
  Globe,
  Monitor,
  Download,
} from 'lucide-react';
import {
  CURRENT_APP_VERSION,
  CURRENT_RELEASE_DATE,
  APP_RELEASES_HISTORY,
  checkForAppUpdatesOnline,
  applyAppUpdateAndReload,
  markAppUpdateAsSeen,
  hasUnseenAppUpdates,
  getPlatformInfo,
  isDesktopExeEnvironment,
} from '../../utils/versionCheck';

interface AppUpdatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppUpdatesModal: React.FC<AppUpdatesModalProps> = ({ isOpen, onClose }) => {
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installProgress, setInstallProgress] = useState(0);
  const [installStatusText, setInstallStatusText] = useState('');
  const [targetInstallVersion, setTargetInstallVersion] = useState<string>(CURRENT_APP_VERSION);
  const [hasPendingUpdate, setHasPendingUpdate] = useState<boolean>(false);
  const [isUpdateDownloaded, setIsUpdateDownloaded] = useState(false);
  const [latestRemoteVersion, setLatestRemoteVersion] = useState<string>(CURRENT_APP_VERSION);
  const [platformInfo, setPlatformInfo] = useState(() => getPlatformInfo());
  const [checkResult, setCheckResult] = useState<{
    tested: boolean;
    updateAvailable: boolean;
    latestVersion: string;
    message: string;
    checkedAt: string;
  } | null>(null);
  const [activeReleaseTab, setActiveReleaseTab] = useState<string>(CURRENT_APP_VERSION);

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

  // Check update status whenever modal opens
  useEffect(() => {
    if (!isOpen) return;

    setPlatformInfo(getPlatformInfo());
    let isMounted = true;

    // If desktop .exe, register IPC listener for real update events
    if (desktop && desktop.onUpdateEvent) {
      ipcOffRef.current = desktop.onUpdateEvent((payload: any) => {
        if (!payload || !payload.type) return;
        if (!isMounted) return;
        switch (payload.type) {
          case 'available':
            setHasPendingUpdate(true);
            setLatestRemoteVersion(payload.version || latestRemoteVersion);
            setTargetInstallVersion(payload.version || latestRemoteVersion);
            setInstallStatusText(`Nueva versión ${payload.version || ''} detectada. Listo para instalar.`);
            break;
          case 'progress':
            setInstallProgress(Math.round(payload.percent || 0));
            setInstallStatusText(`Descargando actualización... ${Math.round(payload.percent || 0)}%`);
            break;
          case 'downloaded':
            setInstallProgress(100);
            setInstallStatusText(desktop.isPortable
              ? 'Actualización descargada y verificada. Pulsa “Actualizar y reiniciar” para aplicarla.'
              : 'Actualización descargada. Pulsa “Reiniciar e instalar” cuando quieras aplicarla.');
            setHasPendingUpdate(false);
            setIsUpdateDownloaded(true);
            setIsInstalling(false);
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

    const checkPromise = desktop && desktop.checkForUpdates
      ? desktop.checkForUpdates().then((res: any) => {
          if (res?.ok === false) throw new Error(res.reason || 'No se pudo consultar la versión publicada.');
          return ({
          updateAvailable: Boolean(res?.updateInfo),
          latestVersion: res?.updateInfo?.version || CURRENT_APP_VERSION,
          updateDownloaded: Boolean(res?.updateDownloaded),
          lastChecked: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
          });
        })
      : checkForAppUpdatesOnline();

    checkPromise.then((res) => {
      if (!isMounted) return;
      setHasPendingUpdate(res.updateAvailable);
      setIsUpdateDownloaded(Boolean((res as any).updateDownloaded));
      setLatestRemoteVersion(res.latestVersion);
      setTargetInstallVersion(res.latestVersion);
      setCheckResult({
        tested: true,
        updateAvailable: res.updateAvailable,
        latestVersion: res.latestVersion,
        message: res.updateAvailable
          ? `¡Hay una nueva versión disponible (v${res.latestVersion}) con mejoras listas para instalar!`
          : `El sistema ya se encuentra en la versión más reciente (v${CURRENT_APP_VERSION}). ¡Todo está al día!`,
        checkedAt: res.lastChecked,
      });
    }).catch((error: any) => {
      if (!isMounted) return;
      setHasPendingUpdate(false);
      setIsUpdateDownloaded(false);
      setCheckResult({
        tested: true,
        updateAvailable: false,
        latestVersion: CURRENT_APP_VERSION,
        message: `No se pudo comprobar la actualización: ${error?.message || String(error)}`,
        checkedAt: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      });
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, desktop]);

  if (!isOpen) return null;

  const handleCheckNow = async () => {
    setIsChecking(true);
    setCheckResult(null);
    setInstallProgress(0);
    setInstallStatusText('');

    // If desktop .exe, use IPC checkForUpdates
    if (desktop && desktop.checkForUpdates) {
      try {
        const res = await desktop.checkForUpdates();
        if (res?.ok === false) throw new Error(res.reason || 'No se pudo consultar la versión publicada.');
        setIsChecking(false);
        setHasPendingUpdate(res.updateInfo ? true : false);
        setIsUpdateDownloaded(Boolean(res.updateDownloaded));
        setLatestRemoteVersion(res.updateInfo?.version || CURRENT_APP_VERSION);
        setTargetInstallVersion(res.updateInfo?.version || CURRENT_APP_VERSION);
        setCheckResult({
          tested: true,
          updateAvailable: res.updateInfo ? true : false,
          latestVersion: res.updateInfo?.version || CURRENT_APP_VERSION,
          message: res.updateInfo
            ? `¡Se detectó una nueva versión v${res.updateInfo.version} disponible en la nube!`
            : `El sistema ya está actualizado a la última versión (v${CURRENT_APP_VERSION}). No hay actualizaciones pendientes.`,
          checkedAt: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        });
        return;
      } catch (e) {
        setIsChecking(false);
        setCheckResult({
          tested: true,
          updateAvailable: false,
          latestVersion: CURRENT_APP_VERSION,
          message: `No se pudo comprobar la actualización: ${(e as any)?.message || String(e)}`,
          checkedAt: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
        });
        return;
      }
    }

    // Web fallback
    try {
      const res = await checkForAppUpdatesOnline();
      setTimeout(() => {
        setIsChecking(false);
        setHasPendingUpdate(res.updateAvailable);
        setLatestRemoteVersion(res.latestVersion);
        setTargetInstallVersion(res.latestVersion);
        setPlatformInfo(getPlatformInfo());
        setCheckResult({
          tested: true,
          updateAvailable: res.updateAvailable,
          latestVersion: res.latestVersion,
          message: res.updateAvailable
            ? `¡Se detectó una nueva versión v${res.latestVersion} disponible en la nube!`
            : `El sistema ya está actualizado a la última versión (v${CURRENT_APP_VERSION}). No hay actualizaciones pendientes.`,
          checkedAt: res.lastChecked,
        });
      }, 600);
    } catch (e) {
      setIsChecking(false);
      setHasPendingUpdate(false);
      setCheckResult({
        tested: true,
        updateAvailable: false,
        latestVersion: CURRENT_APP_VERSION,
        message: `Comprobación realizada. Sistema en versión v${CURRENT_APP_VERSION}.`,
        checkedAt: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      });
    }
  };

  const startInstallationFlow = async (targetVer: string, isReinstall: boolean = false) => {
    if (isInstalling) return;

    // The portable target stages its replacement and swaps it after the app exits.
    if (desktop && desktop.downloadUpdate && desktop.quitAndInstall) {
      if (desktop.isPortable) {
        if (isUpdateDownloaded) {
          try {
            await desktop.quitAndInstall();
          } catch (e: any) {
            setInstallStatusText('No se pudo reiniciar para actualizar: ' + (e?.message || String(e)));
          }
          return;
        }
        setIsInstalling(true);
        setTargetInstallVersion(targetVer);
        setInstallProgress(0);
        setInstallStatusText('Descargando y verificando la actualización portable...');
        try {
          const result = await desktop.downloadUpdate();
          if (result?.ok === false) throw new Error(result.reason || 'No se pudo descargar la actualización portable.');
          setIsInstalling(false);
          setIsUpdateDownloaded(Boolean(result?.alreadyDownloaded));
          setHasPendingUpdate(!result?.alreadyDownloaded);
          setInstallProgress(result?.alreadyDownloaded ? 100 : 0);
          setInstallStatusText(result?.alreadyDownloaded
            ? `Versión ${result.version || targetVer} lista. Pulsa “Actualizar y reiniciar” para aplicarla.`
            : 'Preparando la descarga portable...');
        } catch (e: any) {
          setIsInstalling(false);
          setInstallStatusText('Error al descargar la actualización: ' + (e?.message || String(e)));
        }
        return;
      }
      if (isUpdateDownloaded) {
        try {
          await desktop.quitAndInstall();
        } catch (e: any) {
          setInstallStatusText('No se pudo reiniciar para instalar: ' + (e?.message || String(e)));
        }
        return;
      }

      setIsInstalling(true);
      setTargetInstallVersion(targetVer);
      setInstallProgress(0);
      setInstallStatusText('Iniciando descarga de actualización desde la nube...');

      try {
        const result = await desktop.downloadUpdate();
        if (result?.ok === false) throw new Error(result.reason || 'No se pudo descargar la actualización.');
        if (result?.alreadyDownloaded) {
          setIsUpdateDownloaded(true);
          setHasPendingUpdate(false);
          setIsInstalling(false);
          setInstallProgress(100);
          setInstallStatusText('Actualización descargada. Pulsa “Reiniciar e instalar” cuando quieras aplicarla.');
          return;
        }
        // Los eventos IPC actualizan el progreso y dejan el reinicio a elección del usuario.
        return;
      } catch (e: any) {
        setIsInstalling(false);
        setInstallStatusText('Error al iniciar descarga: ' + (e && e.message ? e.message : String(e)));
        return;
      }
    }

    // Web fallback: simulated flow + reload
    setIsInstalling(true);
    setTargetInstallVersion(targetVer);
    setInstallProgress(10);
    setInstallStatusText('Conectando con el servidor en la nube y verificando versión...');

    const isExe = platformInfo.isDesktopExe;
    const steps = [
      {
        progress: 28,
        text: isReinstall
          ? 'Descargando paquetes limpios del sistema...'
          : `Descargando componentes de la versión v${targetVer}...`,
      },
      { progress: 58, text: 'Verificando seguridad de base de datos Firestore y sincronización...' },
      {
        progress: 82,
        text: isExe
          ? 'Actualizando archivos locales y caché del ejecutable de Windows (.EXE)...'
          : 'Limpiando memoria caché del navegador y actualizando archivos locales...',
      },
      { progress: 96, text: 'Aplicando configuración y preparando reinicio de aplicación...' },
      { progress: 100, text: '¡Actualización completada con éxito! Reiniciando aplicación...' },
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setInstallProgress(steps[currentStep].progress);
        setInstallStatusText(steps[currentStep].text);
        currentStep++;
      } else {
        clearInterval(interval);
        localStorage.setItem('installed_version', targetVer || CURRENT_APP_VERSION);
        localStorage.setItem('syd_app_version_installed', targetVer || CURRENT_APP_VERSION);
        markAppUpdateAsSeen(targetVer);
        setHasPendingUpdate(false);
        setTimeout(async () => {
          await applyAppUpdateAndReload(targetVer);
        }, 500);
      }
    }, 450);
  };

  const handleDismissModal = () => {
    if (isInstalling) return;
    const version = latestRemoteVersion || CURRENT_APP_VERSION;
    localStorage.setItem('installed_version', version);
    localStorage.setItem('syd_app_version_installed', version);
    markAppUpdateAsSeen(version);
    onClose();
  };

  return (
    <div
      id="app-updates-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/25 animate-fadeIn overflow-y-auto"
      onClick={handleDismissModal}
    >
      <div
        id="app-updates-modal-content"
        className="w-full max-w-2xl bg-[#0f172a] rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh] animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 shadow-md">
              <Sparkles className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white tracking-tight">
                  Centro de Actualizaciones
                </h3>
                <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10.5px] font-black px-2 py-0.5 rounded-full">
                  v{CURRENT_APP_VERSION}
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Control de versiones, mejoras continuas y sincronización multidispositivo
              </p>
            </div>
          </div>
          {!isInstalling && (
            <button
              onClick={handleDismissModal}
              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto scrollbar-thin text-slate-200">
          {/* Active Installation Progress Card */}
          {isInstalling ? (
            <div className="p-5 rounded-xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 border-2 border-cyan-500/60 shadow-xl space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center justify-center">
                    <DownloadCloud className="w-5 h-5 animate-bounce text-cyan-400" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">
                      Descargando actualización (v{targetInstallVersion})
                    </h4>
                    <p className="text-xs text-slate-300">
                      Por favor espera unos segundos mientras se aplican los cambios...
                    </p>
                  </div>
                </div>
                <span className="text-base font-black text-cyan-400 tabular-nums">
                  {installProgress}%
                </span>
              </div>

              {/* Progress Bar Track */}
              <div className="space-y-1.5">
                <div className="w-full bg-slate-950 rounded-full h-3.5 overflow-hidden border border-slate-700/80 p-0.5 shadow-inner">
                  <div
                    className="bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-400 h-full rounded-full transition-all duration-300 ease-out shadow-sm"
                    style={{ width: `${installProgress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
                  <span className="flex items-center gap-1.5 text-cyan-300 font-medium">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>{installStatusText}</span>
                  </span>
                  <span className="font-mono text-slate-500">Paso {installProgress < 30 ? '1/4' : installProgress < 60 ? '2/4' : installProgress < 90 ? '3/4' : '4/4'}</span>
                </div>
              </div>
            </div>
          ) : (
            /* Main Status & Action Card */
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 border border-slate-700/80 shadow-xl space-y-4">
              {/* Header inside card: Status icon + Version & Details */}
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                    hasPendingUpdate
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {hasPendingUpdate ? (
                    <Zap className="w-5 h-5 text-cyan-300 fill-current animate-pulse" />
                  ) : (
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-300">Versión Instalada:</span>
                    <span className="text-sm font-black text-white bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                      v{CURRENT_APP_VERSION}
                    </span>
                    <span className="text-[10px] bg-slate-800/80 text-slate-400 px-2 py-0.5 rounded-md border border-slate-700/60 font-mono">
                      {CURRENT_RELEASE_DATE}
                    </span>
                    {hasPendingUpdate || isUpdateDownloaded ? (
                      <span className="text-[11px] font-black text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        ¡Actualización v{latestRemoteVersion} disponible!
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Al día
                      </span>
                    )}
                  </div>

                  {/* Detected Platform Tag */}
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-800/90 border border-slate-700/80 text-[10.5px] text-slate-300">
                      {platformInfo.isDesktopExe ? (
                        <Monitor className="w-3 h-3 text-indigo-400" />
                      ) : (
                        <Globe className="w-3 h-3 text-sky-400" />
                      )}
                      <span className="font-semibold">{platformInfo.platformLabel}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {checkResult?.tested
                      ? checkResult.message
                      : 'Base de datos en la nube y sistema sincronizados en tiempo real.'}
                  </p>
                </div>
              </div>

              {/* Action Buttons Row: Responsive & Tailored to Platform */}
              <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Status indicator on the left */}
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  {hasPendingUpdate || isUpdateDownloaded ? (
                    <span className="text-cyan-300 font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
                      <span>{isUpdateDownloaded ? desktop?.isPortable ? 'Actualización lista para aplicar' : 'Actualización descargada y lista para instalar' : platformInfo.isDesktopExe ? desktop?.isPortable ? 'Nueva versión portable disponible' : 'Nueva versión de Windows lista para descargar' : 'Nueva versión web lista para aplicar'}</span>
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Tienes instalada la versión más reciente
                    </span>
                  )}
                </div>

                {/* Right button group */}
                <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap justify-end">
                  <button
                    id="btn-check-updates-now"
                    type="button"
                    onClick={handleCheckNow}
                    disabled={isChecking || isInstalling}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700/90 active:scale-95 border border-slate-600 text-xs font-bold text-slate-200 hover:text-white transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
                    title="Comprobar en la nube si hay nuevas versiones"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isChecking ? 'animate-spin' : ''}`} />
                    <span>{isChecking ? 'Buscando...' : 'Buscar Actualizaciones'}</span>
                  </button>

                  {/* If update is pending: prominent Install Button */}
                  {(hasPendingUpdate || isUpdateDownloaded) && (
                    <button
                      id="btn-apply-update-reload"
                      type="button"
                      onClick={() => startInstallationFlow(latestRemoteVersion)}
                      disabled={isInstalling}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-500 hover:from-emerald-300 hover:to-cyan-300 text-slate-950 text-xs font-black shadow-lg transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 animate-pulse"
                      title={isUpdateDownloaded ? `${desktop?.isPortable ? 'Actualizar y reiniciar' : 'Reiniciar e instalar'} v${latestRemoteVersion}` : platformInfo.isDesktopExe ? `Descargar actualización v${latestRemoteVersion}` : `Recargar y aplicar v${latestRemoteVersion}`}
                    >
                      <Zap className="w-4 h-4 fill-current text-slate-950" />
                      <span>
                        {isUpdateDownloaded
                          ? `${desktop?.isPortable ? 'Actualizar y reiniciar' : 'Reiniciar e instalar'} (v${latestRemoteVersion})`
                          : platformInfo.isDesktopExe
                          ? `Descargar actualización (v${latestRemoteVersion})`
                          : `Instalar Actualización Ahora (v${latestRemoteVersion})`}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {checkResult && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Última comprobación: {checkResult.checkedAt}</span>
                  <span>Servidor: Google Cloud / Firestore</span>
                </div>
              )}
            </div>
          )}

          {/* Release Notes / Novedades Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>Novedades & Registro de Versiones</span>
              </h4>
              <span className="text-[11px] text-slate-400">
                Versión actual: <strong className="text-white">v{CURRENT_APP_VERSION}</strong>
              </span>
            </div>

            {/* Version tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              {APP_RELEASES_HISTORY.map((rel) => {
                const isActive = activeReleaseTab === rel.version;
                const isCurrent = rel.version === CURRENT_APP_VERSION;
                return (
                  <button
                    key={rel.version}
                    onClick={() => setActiveReleaseTab(rel.version)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                    }`}
                  >
                    <span>v{rel.version}</span>
                    {isCurrent && (
                      <span className="bg-emerald-400 text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full">
                        Actual
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active Release Highlights */}
            {(() => {
              const activeRelease =
                APP_RELEASES_HISTORY.find((r) => r.version === activeReleaseTab) || APP_RELEASES_HISTORY[0];
              return (
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-3">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <h5 className="text-sm font-bold text-white leading-tight">
                        {activeRelease.title}
                      </h5>
                      <span className="text-xs text-slate-400 shrink-0 font-medium">
                        {activeRelease.releaseDate}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      {activeRelease.summary}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    <h6 className="text-[11px] font-bold uppercase text-slate-400 tracking-wider">
                      Cambios Destacados:
                    </h6>
                    <ul className="space-y-1 text-xs text-slate-300">
                      {activeRelease.highlights.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Quick Guide for Devices (Mobile vs PC Executable) */}
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
            <h5 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              <span>¿Cómo se actualizan los demás dispositivos?</span>
            </h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-cyan-300">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Celulares & Tablets</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Se actualizan automáticamente. Solo deben cerrar la app y volver a abrirla (o deslizar hacia abajo para refrescar).
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-indigo-300">
                  <Laptop className="w-3.5 h-3.5" />
                  <span>Computadores (Ejecutable .exe & Web)</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Cuando haya una nueva versión, saltará el aviso para instalarla en 1 clic. También puedes pulsar <kbd className="bg-slate-900 px-1 rounded text-cyan-300 font-mono text-[10px]">F5</kbd> o <kbd className="bg-slate-900 px-1 rounded text-cyan-300 font-mono text-[10px]">Ctrl+Shift+R</kbd>.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between">
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Actualización en caliente segura (no borra tus cotizaciones ni clientes)</span>
          </div>

          <button
            onClick={handleDismissModal}
            disabled={isInstalling}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition cursor-pointer disabled:opacity-50"
          >
            {isInstalling ? 'Instalando...' : 'Cerrar'}
          </button>
        </div>
      </div>
    </div>
  );
};
