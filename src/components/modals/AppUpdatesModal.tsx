import React, { useState } from 'react';
import {
  X,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Smartphone,
  Laptop,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  Info,
  Clock,
} from 'lucide-react';
import {
  CURRENT_APP_VERSION,
  CURRENT_RELEASE_DATE,
  APP_RELEASES_HISTORY,
  checkForAppUpdatesOnline,
  applyAppUpdateAndReload,
  markAppUpdateAsSeen,
  AppRelease,
} from '../../utils/versionCheck';

interface AppUpdatesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppUpdatesModal: React.FC<AppUpdatesModalProps> = ({ isOpen, onClose }) => {
  const [isChecking, setIsChecking] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [checkResult, setCheckResult] = useState<{
    tested: boolean;
    updateAvailable: boolean;
    latestVersion: string;
    message: string;
    checkedAt: string;
  } | null>(null);
  const [activeReleaseTab, setActiveReleaseTab] = useState<string>(CURRENT_APP_VERSION);

  if (!isOpen) return null;

  const handleCheckNow = async () => {
    setIsChecking(true);
    setCheckResult(null);

    try {
      const res = await checkForAppUpdatesOnline();
      setTimeout(() => {
        setIsChecking(false);
        setCheckResult({
          tested: true,
          updateAvailable: res.updateAvailable,
          latestVersion: res.latestVersion,
          message: res.updateAvailable
            ? `¡Hay cambios y mejoras disponibles para la versión ${res.latestVersion}!`
            : `El sistema está en la versión más reciente (${CURRENT_APP_VERSION}). ¡Todo al día!`,
          checkedAt: res.lastChecked,
        });
      }, 700);
    } catch (e) {
      setIsChecking(false);
      setCheckResult({
        tested: true,
        updateAvailable: false,
        latestVersion: CURRENT_APP_VERSION,
        message: `Comprobación realizada. Sistema en versión v${CURRENT_APP_VERSION}.`,
        checkedAt: new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      });
    }
  };

  const handleApplyUpdate = async () => {
    setIsReloading(true);
    markAppUpdateAsSeen();
    setTimeout(async () => {
      await applyAppUpdateAndReload();
    }, 400);
  };

  const handleDismissModal = () => {
    markAppUpdateAsSeen();
    onClose();
  };

  return (
    <div
      id="app-updates-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn overflow-y-auto"
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
          <button
            onClick={handleDismissModal}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto scrollbar-thin text-slate-200">
          {/* Main Status & Action Card */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800/80 border border-slate-700/80 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-300">Versión Instalada:</span>
                    <span className="text-sm font-black text-white">v{CURRENT_APP_VERSION}</span>
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                      {CURRENT_RELEASE_DATE}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {checkResult?.tested
                      ? checkResult.message
                      : 'Base de datos en la nube y sistema sincronizados en tiempo real.'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  id="btn-check-updates-now"
                  type="button"
                  onClick={handleCheckNow}
                  disabled={isChecking || isReloading}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-white transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Comprobar si hay nuevas mejoras o datos"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isChecking ? 'animate-spin' : ''}`} />
                  <span>{isChecking ? 'Buscando...' : 'Buscar Actualizaciones'}</span>
                </button>

                <button
                  id="btn-apply-update-reload"
                  type="button"
                  onClick={handleApplyUpdate}
                  disabled={isReloading}
                  className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95"
                  title="Refrescar caché y recargar aplicación"
                >
                  <Zap className={`w-3.5 h-3.5 fill-current ${isReloading ? 'animate-bounce' : ''}`} />
                  <span>{isReloading ? 'Aplicando...' : 'Recargar & Aplicar'}</span>
                </button>
              </div>
            </div>

            {checkResult && (
              <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1 text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Última comprobación: {checkResult.checkedAt}</span>
                </span>
                <span>Servidor: Google Cloud / Firestore</span>
              </div>
            )}
          </div>

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
                  <span>Computadores (Web & PWA)</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Se actualiza <strong>automáticamente en vivo</strong> en cada recarga o con <kbd className="bg-slate-900 px-1 rounded text-cyan-300 font-mono text-[10px]">Ctrl+F5</kbd>. Los datos y estados siempre están sincronizados con la nube.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 bg-slate-900/90 border-t border-slate-800 flex items-center justify-end">
          <button
            onClick={handleDismissModal}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
