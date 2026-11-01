import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bell,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  X,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Clock,
  Check,
  Building2,
  DollarSign,
  Package,
  Sparkles,
} from 'lucide-react';
import { SystemAlertItem, AlertSeverity, ActiveTab, MedicalEquipment } from '../../types';
import { CURRENT_APP_VERSION } from '../../utils/versionCheck';

interface FloatingAlertsWidgetProps {
  alerts: SystemAlertItem[];
  summary: {
    total: number;
    critica: number;
    media: number;
    informativa: number;
  };
  onNavigateTab: (tab: ActiveTab) => void;
  onEditEquipment?: (equipment: MedicalEquipment) => void;
  equipments?: MedicalEquipment[];
  onOpenAppUpdates?: () => void;
}

export const FloatingAlertsWidget: React.FC<FloatingAlertsWidgetProps> = ({
  alerts,
  summary,
  onNavigateTab,
  onEditEquipment,
  equipments = [],
  onOpenAppUpdates,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'todas' | AlertSeverity>('todas');
  const [dismissedAlertIds, setDismissedAlertIds] = useState<string[]>(() => {
    try {
      const raw =
        localStorage.getItem('syd_dismissed_alert_ids_v2') ||
        localStorage.getItem('syd_dismissed_alert_ids_v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  });
  const [showToast, setShowToast] = useState(false);
  const [activeToastAlert, setActiveToastAlert] = useState<SystemAlertItem | null>(null);

  const persistDismissed = (ids: string[]) => {
    try {
      localStorage.setItem('syd_dismissed_alert_ids_v2', JSON.stringify(ids));
    } catch (_) {}
  };

  // Listen to external toggle & update events
  useEffect(() => {
    const handleToggle = () => setIsOpen((prev) => !prev);
    const handleOpen = () => setIsOpen(true);
    const handleAlertsUpdated = () => {
      try {
        const stored =
          localStorage.getItem('syd_dismissed_alert_ids_v2') ||
          localStorage.getItem('syd_dismissed_alert_ids_v1');
        if (stored) {
          const list = JSON.parse(stored);
          if (Array.isArray(list)) setDismissedAlertIds(list);
        }
      } catch (_) {}
    };

    window.addEventListener('syd-toggle-alerts-widget', handleToggle);
    window.addEventListener('syd-open-alerts-widget', handleOpen);
    window.addEventListener('syd-alerts-updated', handleAlertsUpdated);
    window.addEventListener('syd-update-status-changed', handleAlertsUpdated);

    return () => {
      window.removeEventListener('syd-toggle-alerts-widget', handleToggle);
      window.removeEventListener('syd-open-alerts-widget', handleOpen);
      window.removeEventListener('syd-alerts-updated', handleAlertsUpdated);
      window.removeEventListener('syd-update-status-changed', handleAlertsUpdated);
    };
  }, []);

  // Visible alerts list
  const visibleAlerts = useMemo(() => {
    return alerts.filter((a) => !dismissedAlertIds.includes(a.id));
  }, [alerts, dismissedAlertIds]);

  const hasSystemUpdate = useMemo(() => {
    return visibleAlerts.some((a) => a.category === 'actualizacion_sistema');
  }, [visibleAlerts]);

  const filteredAlerts = useMemo(() => {
    if (activeFilter === 'todas') return visibleAlerts;
    return visibleAlerts.filter((a) => a.severity === activeFilter);
  }, [visibleAlerts, activeFilter]);

  const currentSummary = useMemo(() => {
    return {
      total: visibleAlerts.length,
      critica: visibleAlerts.filter((a) => a.severity === 'critica').length,
      media: visibleAlerts.filter((a) => a.severity === 'media').length,
      informativa: visibleAlerts.filter((a) => a.severity === 'informativa').length,
    };
  }, [visibleAlerts]);

  // App start timestamp tracking to strictly prevent immediate pop-ups on launch/refresh
  const appMountTimeRef = React.useRef(Date.now());
  const initialOpenCheckedRef = React.useRef(false);

  // Check & trigger toast according to strict timing policy:
  // - NEVER pop up immediately upon app open / page refresh.
  // - 'informativa': Shows ONLY ONCE per alert ID across app lifetime.
  // - 'media': Shown at most once every 10 minutes (600,000 ms).
  // - 'critica': Shown at most once every 5 minutes (300,000 ms).
  useEffect(() => {
    if (visibleAlerts.length === 0) {
      setShowToast(false);
      setActiveToastAlert(null);
      return;
    }

    let history: {
      seenInformativaIds?: string[];
      lastToastTimes?: { [key: string]: number };
      lastAppSessionStart?: number;
    } = {};

    try {
      const stored = localStorage.getItem('syd_toast_alert_history');
      if (stored) {
        history = JSON.parse(stored);
      }
    } catch {
      history = {};
    }

    const seenInformativa = history.seenInformativaIds || [];
    const lastToastTimes = history.lastToastTimes || {};
    const now = Date.now();

    // On fresh app launch/open, set initial cooldown anchor so it does NOT fire immediately on open
    if (!initialOpenCheckedRef.current) {
      initialOpenCheckedRef.current = true;
      if (!lastToastTimes['critica'] || now - lastToastTimes['critica'] > 5 * 60 * 1000) {
        lastToastTimes['critica'] = now;
      }
      if (!lastToastTimes['media'] || now - lastToastTimes['media'] > 10 * 60 * 1000) {
        lastToastTimes['media'] = now;
      }
      try {
        localStorage.setItem(
          'syd_toast_alert_history',
          JSON.stringify({
            seenInformativaIds: seenInformativa,
            lastToastTimes,
            lastAppSessionStart: now,
          })
        );
      } catch {}
      return;
    }

    // Candidate selection strictly respecting intervals:
    // 1. Critical alerts: check if 5 min (300,000 ms) passed
    const criticalCandidate = visibleAlerts.find((a) => a.severity === 'critica');
    const lastCritica = lastToastTimes['critica'] || 0;
    const canShowCritica = criticalCandidate && now - lastCritica >= 5 * 60 * 1000;

    // 2. Medium alerts: check if 10 min (600,000 ms) passed
    const mediaCandidate = visibleAlerts.find((a) => a.severity === 'media');
    const lastMedia = lastToastTimes['media'] || 0;
    const canShowMedia = mediaCandidate && now - lastMedia >= 10 * 60 * 1000;

    // 3. Informative alerts: ONLY if never seen before
    const infoCandidate = visibleAlerts.find(
      (a) => a.severity === 'informativa' && !seenInformativa.includes(a.id)
    );

    let chosenCandidate: SystemAlertItem | null = null;
    if (canShowCritica && criticalCandidate) {
      chosenCandidate = criticalCandidate;
      lastToastTimes['critica'] = now;
    } else if (canShowMedia && mediaCandidate) {
      chosenCandidate = mediaCandidate;
      lastToastTimes['media'] = now;
    } else if (infoCandidate && (now - appMountTimeRef.current > 30000)) {
      // Informative shows once, not immediately at 0s of app open
      chosenCandidate = infoCandidate;
      seenInformativa.push(infoCandidate.id);
    }

    if (!chosenCandidate) {
      return;
    }

    // Trigger floating toast preview
    setActiveToastAlert(chosenCandidate);
    setShowToast(true);

    try {
      localStorage.setItem(
        'syd_toast_alert_history',
        JSON.stringify({
          seenInformativaIds: seenInformativa,
          lastToastTimes,
          lastAppSessionStart: now,
        })
      );
    } catch {}

    const timer = setTimeout(() => {
      setShowToast(false);
    }, 6000);

    return () => clearTimeout(timer);
  }, [visibleAlerts]);

  // Periodic interval runner (every 20s) to evaluate 5-min and 10-min recurring toast triggers
  useEffect(() => {
    const interval = setInterval(() => {
      if (visibleAlerts.length === 0 || isOpen) return;
      const now = Date.now();
      let history: any = {};
      try {
        const stored = localStorage.getItem('syd_toast_alert_history');
        if (stored) history = JSON.parse(stored);
      } catch {}
      const lastToastTimes = history.lastToastTimes || {};
      const seenInformativa = history.seenInformativaIds || [];

      const criticalCandidate = visibleAlerts.find((a) => a.severity === 'critica');
      const lastCritica = lastToastTimes['critica'] || 0;
      if (criticalCandidate && now - lastCritica >= 5 * 60 * 1000) {
        lastToastTimes['critica'] = now;
        try {
          localStorage.setItem('syd_toast_alert_history', JSON.stringify({ ...history, lastToastTimes }));
        } catch {}
        setActiveToastAlert(criticalCandidate);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 6000);
        return;
      }

      const mediaCandidate = visibleAlerts.find((a) => a.severity === 'media');
      const lastMedia = lastToastTimes['media'] || 0;
      if (mediaCandidate && now - lastMedia >= 10 * 60 * 1000) {
        lastToastTimes['media'] = now;
        try {
          localStorage.setItem('syd_toast_alert_history', JSON.stringify({ ...history, lastToastTimes }));
        } catch {}
        setActiveToastAlert(mediaCandidate);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 6000);
        return;
      }
    }, 20000);

    return () => clearInterval(interval);
  }, [visibleAlerts, isOpen]);

  // Close widget when ESC key is pressed
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedAlertIds((prev) => {
      const next = Array.from(new Set([...prev, id]));
      persistDismissed(next);
      return next;
    });
  };

  const handleDismissAll = () => {
    setDismissedAlertIds((prev) => {
      const next = Array.from(new Set([...prev, ...alerts.map((a) => a.id)]));
      persistDismissed(next);
      return next;
    });
  };

  const handleActionClick = (alert: SystemAlertItem) => {
    setIsOpen(false);
    setShowToast(false);

    // If it's a system update alert, open the App Updates modal
    if (alert.category === 'actualizacion_sistema') {
      if (onOpenAppUpdates) {
        onOpenAppUpdates();
      } else {
        window.dispatchEvent(new CustomEvent('syd-open-app-updates'));
      }
      return;
    }

    // If it's a Google Drive new part alert, open the Google Workspace Modal directly
    if (alert.category === 'nueva_parte_drive' || alert.sourceModule === 'Google Drive / Sheets') {
      window.dispatchEvent(
        new CustomEvent('syd-open-workspace-modal', {
          detail: { openSubTab: 'parts', partCode: alert.entityId },
        })
      );
      return;
    }

    // If it's a catalog cost alert and we have the equipment, open the edit modal directly
    if (alert.category === 'costo_catalogo' && (alert.details as any)?.equipmentId && onEditEquipment) {
      const eq = equipments.find((e) => e.id === (alert.details as any)?.equipmentId);
      if (eq) {
        onNavigateTab('catalogo');
        setTimeout(() => {
          onEditEquipment(eq);
        }, 150);
        return;
      }
    }

    onNavigateTab(alert.targetTab);
  };

  // Active toast alert (prioritizing critical alerts respecting intervals)
  const currentToast = activeToastAlert || visibleAlerts[0] || null;

  return (
    <>
      {/* 1. FLOATING TOAST NOTIFICATION (Auto-Dismissing compact preview) */}
      {showToast && !isOpen && currentToast && (
        <div
          id="floating-alert-toast"
          className="fixed bottom-20 left-6 z-50 max-w-[270px] sm:max-w-[290px] bg-[#121e31]/95 backdrop-blur-md border border-slate-700/80 shadow-2xl rounded-xl p-2 sm:p-2.5 text-white animate-slideUp transition-all duration-300"
        >
          <div className="flex items-start justify-between gap-1.5">
            <div className="flex items-start gap-1.5">
              <div
                className={`p-1 rounded-md shrink-0 mt-0.5 border ${
                  currentToast.severity === 'critica'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                    : currentToast.severity === 'media'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                }`}
              >
                {currentToast.severity === 'critica' ? (
                  <ShieldAlert className="w-3.5 h-3.5" />
                ) : currentToast.severity === 'media' ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : (
                  <Info className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
                  <span
                    className={`text-[7.5px] uppercase font-black px-1.5 py-0.2 rounded tracking-wide ${
                      currentToast.severity === 'critica'
                        ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
                        : currentToast.severity === 'media'
                        ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40'
                        : 'bg-blue-500/30 text-blue-300 border border-blue-500/40'
                    }`}
                  >
                    {currentToast.severity === 'critica'
                      ? '🔴 Crítica'
                      : currentToast.severity === 'media'
                      ? '🟡 Media'
                      : '🔵 Info'}
                  </span>
                  <span className="text-[8.5px] text-slate-400 font-medium truncate max-w-[130px]">
                    {currentToast.sourceModule}
                  </span>
                </div>
                <h4 className="text-[10.5px] font-bold text-white leading-snug line-clamp-1">
                  {currentToast.title}
                </h4>
                <p className="text-[9px] text-slate-300 line-clamp-2 leading-relaxed">
                  {currentToast.message}
                </p>
                <div className="pt-0.5 flex items-center gap-1.5">
                  <button
                    onClick={() => handleActionClick(currentToast)}
                    className="bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950 px-1.5 py-0.5 rounded text-[9px] font-black transition cursor-pointer flex items-center gap-0.5 shadow-xs"
                  >
                    <span>{currentToast.actionLabel || 'Resolver'}</span>
                    <ArrowRight className="w-2.5 h-2.5" />
                  </button>
                  <button
                    onClick={() => {
                      setShowToast(false);
                      setIsOpen(true);
                    }}
                    className="text-slate-300 hover:text-white text-[9px] font-bold underline px-1 py-0.5 cursor-pointer"
                  >
                    Ver todas ({visibleAlerts.length})
                  </button>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowToast(false)}
              className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-700/50 transition cursor-pointer shrink-0"
              title="Cerrar notificación flotante"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* 2. PERSISTENT FLOATING BUTTON (Always visible, even with 0 alerts) */}
      <div className="fixed bottom-6 left-6 z-40 flex items-center gap-2 animate-fadeIn">
        <button
          id="open-floating-alerts-btn"
          onClick={() => {
            setShowToast(false);
            setIsOpen(!isOpen);
          }}
          className={`relative w-12 h-12 rounded-full shadow-2xl transition-all duration-300 cursor-pointer border flex items-center justify-center hover:scale-105 active:scale-95 ${
            hasSystemUpdate
              ? 'bg-gradient-to-br from-emerald-950/95 via-cyan-950/95 to-blue-950/95 border-emerald-400 text-white shadow-emerald-950/70 ring-2 ring-emerald-400/50 animate-pulse'
              : currentSummary.critica > 0
              ? 'bg-rose-950/95 hover:bg-rose-900 border-rose-500 text-white shadow-rose-950/60 ring-2 ring-rose-500/40'
              : currentSummary.media > 0
              ? 'bg-amber-950/95 hover:bg-amber-900 border-amber-500 text-white shadow-amber-950/60 ring-2 ring-amber-500/40'
              : currentSummary.total > 0
              ? 'bg-[#1e314b]/95 hover:bg-[#253f63] border-[#38bdf8]/80 text-white shadow-cyan-950/50 ring-2 ring-cyan-500/30'
              : 'bg-[#132238]/95 hover:bg-[#1c3252] border-[#38bdf8]/50 text-slate-300 hover:text-white shadow-xl hover:border-[#38bdf8]'
          }`}
          title={
            hasSystemUpdate
              ? `¡Nueva versión v${CURRENT_APP_VERSION} disponible! Centro de Alertas (${currentSummary.total} pendientes)`
              : `Centro de Alertas (${currentSummary.total} pendientes)`
          }
        >
          <Bell
            className={`w-5 h-5 transition-transform ${
              hasSystemUpdate
                ? 'text-emerald-300 animate-spin-slow'
                : currentSummary.critica > 0
                ? 'text-rose-400 animate-bounce'
                : currentSummary.media > 0
                ? 'text-amber-400 animate-pulse'
                : currentSummary.total > 0
                ? 'text-cyan-300'
                : 'text-[#38bdf8]'
            }`}
          />
          {currentSummary.total > 0 ? (
            <span
              className={`absolute -top-1 -right-1 font-black text-[10px] min-w-[19px] h-[19px] px-1 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-md ${
                hasSystemUpdate
                  ? 'bg-emerald-400 text-slate-950 font-black animate-pulse'
                  : currentSummary.critica > 0
                  ? 'bg-rose-500 text-white animate-pulse'
                  : currentSummary.media > 0
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-[#38bdf8] text-slate-950 font-bold'
              }`}
            >
              {currentSummary.total}
            </span>
          ) : (
            <span
              className="absolute -top-1 -right-1 font-bold text-[9px] min-w-[17px] h-[17px] px-1 rounded-full flex items-center justify-center border-2 border-slate-900 shadow-xs bg-slate-700/90 text-slate-300"
              title="0 alertas pendientes"
            >
              0
            </span>
          )}
        </button>
      </div>

      {/* 3. COMPACT FLOATING ALERTS POPUP (Floats at bottom-left, keeps app 100% visible) */}
      {isOpen && (
        <>
          {/* Transparent click-outside overlay - Does NOT dim or blur the background app */}
          <div
            className="fixed inset-0 z-40 bg-transparent cursor-default"
            onClick={() => setIsOpen(false)}
            aria-label="Cerrar panel de notificaciones"
          />

          <div
            className="fixed bottom-20 left-4 sm:left-6 z-50 w-[calc(100vw-2rem)] max-w-[390px] sm:max-w-[420px] max-h-[500px] sm:max-h-[540px] bg-[#121e30] rounded-2xl border border-[#334d6e] shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-3.5 py-2.5 bg-[#182840] border-b border-[#334d6e] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#38bdf8]/20 text-[#38bdf8] rounded-lg border border-[#38bdf8]/40">
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white flex items-center gap-1.5 leading-tight">
                    <span>Alertas del Sistema</span>
                    <span className="bg-[#38bdf8] text-slate-950 text-[9px] font-black px-1.5 py-0.2 rounded-full">
                      {currentSummary.total}
                    </span>
                  </h3>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Notificaciones de costos, OC y licitaciones
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-700/40 transition cursor-pointer"
                title="Cerrar panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Severity Filter Tabs */}
            <div className="px-3 py-1.5 bg-[#152338] border-b border-[#334d6e]/60 flex items-center justify-between gap-1 overflow-x-auto scrollbar-thin">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveFilter('todas')}
                  className={`px-2 py-0.5 rounded text-[10.5px] font-bold transition cursor-pointer ${
                    activeFilter === 'todas'
                      ? 'bg-[#38bdf8] text-slate-950'
                      : 'bg-[#192b45] text-slate-300 hover:text-white'
                  }`}
                >
                  Todas ({currentSummary.total})
                </button>
                <button
                  onClick={() => setActiveFilter('critica')}
                  className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold transition cursor-pointer flex items-center gap-1 ${
                    activeFilter === 'critica'
                      ? 'bg-rose-500 text-white'
                      : 'bg-[#192b45] text-rose-300 hover:text-white border border-rose-500/30'
                  }`}
                >
                  <span>🔴 Críticas</span>
                  <span className="text-[9.5px]">({currentSummary.critica})</span>
                </button>
                <button
                  onClick={() => setActiveFilter('media')}
                  className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold transition cursor-pointer flex items-center gap-1 ${
                    activeFilter === 'media'
                      ? 'bg-amber-500 text-slate-950 font-black'
                      : 'bg-[#192b45] text-amber-300 hover:text-white border border-amber-500/30'
                  }`}
                >
                  <span>🟡 Medias</span>
                  <span className="text-[9.5px]">({currentSummary.media})</span>
                </button>
                <button
                  onClick={() => setActiveFilter('informativa')}
                  className={`px-1.5 py-0.5 rounded text-[10.5px] font-bold transition cursor-pointer flex items-center gap-1 ${
                    activeFilter === 'informativa'
                      ? 'bg-blue-500 text-white'
                      : 'bg-[#192b45] text-blue-300 hover:text-white border border-blue-500/30'
                  }`}
                >
                  <span>🔵 Info</span>
                  <span className="text-[9.5px]">({currentSummary.informativa})</span>
                </button>
              </div>

              {visibleAlerts.length > 0 && (
                <button
                  onClick={handleDismissAll}
                  className="text-[9.5px] text-slate-400 hover:text-rose-300 font-semibold whitespace-nowrap px-1.5 py-0.5 rounded hover:bg-slate-800 transition cursor-pointer"
                  title="Marcar todas como revisadas"
                >
                  Descartar
                </button>
              )}
            </div>

            {/* Alert List Content */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-2 scrollbar-thin">
              {filteredAlerts.length === 0 ? (
                <div className="py-8 text-center text-slate-400 space-y-2">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center mx-auto">
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">¡Todo al día!</h4>
                    <p className="text-[10.5px] text-slate-400 mt-0.5">
                      No hay alertas pendientes en esta categoría.
                    </p>
                  </div>
                </div>
              ) : (
                filteredAlerts.map((alert) => {
                  const isCritica = alert.severity === 'critica';
                  const isMedia = alert.severity === 'media';

                  return (
                    <div
                      key={alert.id}
                      className={`p-2.5 rounded-xl border transition-all duration-200 space-y-1.5 shadow-sm ${
                        isCritica
                          ? 'bg-rose-950/25 border-rose-500/50 hover:border-rose-400'
                          : isMedia
                          ? 'bg-amber-950/25 border-amber-500/50 hover:border-amber-400'
                          : 'bg-blue-950/25 border-blue-500/40 hover:border-blue-400'
                      }`}
                    >
                      {/* Top badge row */}
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span
                            className={`text-[8.5px] uppercase font-black px-1.5 py-0.2 rounded tracking-wide ${
                              isCritica
                                ? 'bg-rose-500/30 text-rose-300 border border-rose-500/40'
                                : isMedia
                                ? 'bg-amber-500/30 text-amber-300 border border-amber-500/40'
                                : 'bg-blue-500/30 text-blue-300 border border-blue-500/40'
                            }`}
                          >
                            {isCritica
                              ? '🔴 Crítica'
                              : isMedia
                              ? '🟡 Media'
                              : '🔵 Info'}
                          </span>
                          <span className="text-[9.5px] text-slate-300 font-semibold bg-[#152338] px-1.5 py-0.2 rounded border border-[#334d6e]">
                            {alert.sourceModule}
                          </span>
                        </div>
                        <button
                          onClick={(e) => handleDismiss(alert.id, e)}
                          className="text-slate-400 hover:text-rose-300 p-0.5 rounded transition cursor-pointer"
                          title="Descartar notificación"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Title & description */}
                      <div>
                        <h4 className="text-[11.5px] font-bold text-white leading-snug">
                          {alert.title}
                        </h4>
                        <p className="text-[10.5px] text-slate-300 mt-0.5 leading-snug">
                          {alert.message}
                        </p>
                      </div>

                      {/* Bottom action button */}
                      <div className="pt-1 border-t border-[#334d6e]/40 flex items-center justify-between gap-2">
                        <span className="text-[9px] text-slate-400 truncate max-w-[160px]">
                          {alert.category === 'actualizacion_sistema'
                            ? '✨ Software & Versión'
                            : alert.category === 'costo_catalogo'
                            ? '💰 Costos y Margen'
                            : alert.category === 'oc_retraso'
                            ? '⏱️ Despacho a Cliente'
                            : alert.category === 'oc_pago'
                            ? '💳 Pago a Proveedor'
                            : '📋 Operaciones'}
                        </span>
                        <button
                          onClick={() => handleActionClick(alert)}
                          className={`px-2.5 py-1 rounded-md text-[10.5px] font-black transition cursor-pointer inline-flex items-center gap-1 shadow-xs active:scale-95 shrink-0 ${
                            isCritica
                              ? 'bg-rose-500 hover:bg-rose-600 text-white'
                              : isMedia
                              ? 'bg-amber-400 hover:bg-amber-500 text-slate-950'
                              : 'bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950'
                          }`}
                        >
                          <span>{alert.actionLabel || 'Resolver'}</span>
                          <ChevronRight className="w-3 h-3 stroke-[3]" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Slim Footer */}
            <div className="px-3 py-1.5 bg-[#152338] border-t border-[#334d6e]/60 text-center text-[9.5px] text-slate-400 flex items-center justify-between">
              <span>Sincronizado en tiempo real</span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-cyan-400 hover:underline font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
};
