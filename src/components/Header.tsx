import React, { useState, useEffect } from 'react';
import { RefreshCw, Menu, Check, Sparkles, Database, Share2, Copy, Cloud, Moon, Bell } from 'lucide-react';
import { ActiveTab } from './Navigation';
import { AuthUser, ThemeSettings } from '../types';
import { SyDLogo } from './common/SyDLogo';
import { SyncConnectionStatus } from '../services/realtimeSync';
import { hasUnseenAppUpdates, CURRENT_APP_VERSION } from '../utils/versionCheck';

interface HeaderProps {
  activeQuoteSubtotal?: number;
  activeQuoteTotal?: number;
  itemsCount?: number;
  onResetSample?: () => void;
  onPrintPreview?: () => void;
  onOpenMobileMenu?: () => void;
  activeTab?: ActiveTab;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
  onOpenUserManagement?: () => void;
  onSuspendApp?: () => void;
  onRefresh?: () => void;
  onOpenCustomization?: () => void;
  themeSettings?: ThemeSettings;
  syncStatus?: SyncConnectionStatus;
  onOpenShareModal?: () => void;
  onOpenAppUpdates?: () => void;
  onOpenBackupModal?: () => void;
  onOpenGoogleWorkspaceModal?: () => void;
  onOpenNotifications?: () => void;
  alertsCount?: number;
}

const TAB_TITLES: Record<ActiveTab, { title: string; subtitle: string }> = {
  inicio: {
    title: 'Panel de Control & Resumen',
    subtitle: 'Métricas generales, accesos rápidos e historial de cotizaciones',
  },
  ventas: {
    title: 'Cotizaciones',
    subtitle: '',
  },
  historial: {
    title: 'Cotizaciones Guardadas',
    subtitle: 'Historial completo de propuestas comerciales, duplicación y seguimiento de estados',
  },
  costos: {
    title: 'Costos y Rentabilidad',
    subtitle: '',
  },
  catalogo: {
    title: 'Creación de Equipos Médicos',
    subtitle: '',
  },
  licitaciones: {
    title: 'Licitaciones y Contratos',
    subtitle: 'Gestión de procesos licitatorios, pliegos, anexos técnicos y contratos',
  },
  documentacion: {
    title: 'Documentación Técnica',
    subtitle: '',
  },
  seguimiento_oc: {
    title: 'Seguimiento de Órdenes de Compra (OC)',
    subtitle: 'Control logístico de contratos adjudicados, recepción, pagos y alertas de 48h',
  },
  ordenes_venta: {
    title: 'Órdenes de Venta & Facturación a Clientes (OV)',
    subtitle: 'Despachos de equipos médicos por OV, remisiones firmadas, actas de entrega y radicación de facturas SYD',
  },
  gmail_compras: {
    title: 'Centro de Integración Gmail & Órdenes de Compra',
    subtitle: 'Conexión de cuenta de correo, detección de OCs del departamento de compras y envío de plantillas oficiales',
  },
};

export const Header: React.FC<HeaderProps> = ({
  onOpenMobileMenu,
  activeTab = 'inicio',
  onRefresh,
  onOpenCustomization,
  currentUser,
  themeSettings,
  syncStatus = 'connected',
  onOpenShareModal,
  onOpenAppUpdates,
  onOpenBackupModal,
  onOpenGoogleWorkspaceModal,
  onSuspendApp,
  onOpenNotifications,
  alertsCount = 0,
}) => {
  const currentTabInfo = TAB_TITLES[activeTab] || TAB_TITLES.inicio;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [hasNewUpdate, setHasNewUpdate] = useState(() => hasUnseenAppUpdates());

  useEffect(() => {
    const handleUpdateStatus = () => {
      setHasNewUpdate(hasUnseenAppUpdates());
    };
    window.addEventListener('syd-update-status-changed', handleUpdateStatus);
    return () => window.removeEventListener('syd-update-status-changed', handleUpdateStatus);
  }, []);

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    if (onRefresh) {
      onRefresh();
    }

    // Trigger window layout refresh to clear any UI rendering lag
    window.dispatchEvent(new Event('resize'));

    setTimeout(() => {
      setIsRefreshing(false);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 2200);
    }, 400);
  };

  return (
    <header id="main-header" className="flex items-center justify-between gap-3">
      {/* Left: Mobile Menu Trigger + Tab Title Info */}
      <div className="flex items-center gap-3 min-w-0">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            title="Abrir menú de navegación"
            style={{
              backgroundColor: 'var(--syd-card-bg)',
              borderColor: 'var(--syd-border-color)',
              color: 'var(--syd-text-primary)',
              borderRadius: 'var(--syd-btn-radius)',
            }}
            className="md:hidden p-2 border transition cursor-pointer hover:opacity-90 active:scale-95"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="min-w-0">
          <h1
            className="text-lg sm:text-xl font-black tracking-tight truncate flex items-center gap-2"
            style={{ color: 'var(--syd-text-primary)' }}
          >
            <span>{currentTabInfo.title}</span>
          </h1>
          {currentTabInfo.subtitle ? (
            <p
              className="text-xs font-medium truncate hidden sm:block mt-0.5"
              style={{ color: 'var(--syd-text-secondary)' }}
            >
              {currentTabInfo.subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {/* Right: Backup Button + Version Center + Refresh button */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end relative">
        {showSuccessToast && (
          <div className="absolute right-0 top-11 z-50 bg-emerald-500 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5 animate-fadeIn border border-emerald-400 pointer-events-none whitespace-nowrap">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Sistema optimizado & sincronizado</span>
          </div>
        )}

        {/* Dedicated Share / Link Web Button (Always dynamically reflects current URL) */}
        {onOpenShareModal && (
          <button
            id="btn-open-share-link-header"
            type="button"
            onClick={onOpenShareModal}
            title="Instalar en este PC (Sin Node ni Administrador) y Compartir con otros computadores conectados"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-gradient-to-r from-sky-600/90 to-blue-600/90 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer active:scale-95 border border-sky-400/40"
          >
            <Share2 className="w-3.5 h-3.5 text-sky-200" />
            <span className="hidden xl:inline">Instalar / Compartir</span>
            <span className="hidden sm:inline xl:hidden">Compartir</span>
          </button>
        )}

        {/* Dedicated Copia de Seguridad & Base de Datos Excel Button */}
        {onOpenBackupModal && (
          <button
            id="btn-open-backup-modal"
            type="button"
            onClick={onOpenBackupModal}
            title="Base de Datos & Excel: Exportar e importar todo en Microsoft Excel (.xlsx), respaldos y sincronización"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer active:scale-95 border border-emerald-400/40"
          >
            <Database className="w-3.5 h-3.5 text-emerald-200" />
            <span className="hidden xl:inline">Base de Datos / Excel</span>
            <span className="hidden sm:inline xl:hidden">Excel / DB</span>
          </button>
        )}

        {/* Dedicated Google Workspace & Sheets/Drive Hub Button */}
        {onOpenGoogleWorkspaceModal && (
          <button
            id="btn-open-workspace-modal"
            type="button"
            onClick={onOpenGoogleWorkspaceModal}
            title="Google Workspace: Conexión con Hojas de Cálculo (Sheets), Catálogo N-FCO-03 y Respaldos en Google Drive"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer active:scale-95 border border-sky-400/40"
          >
            <Cloud className="w-3.5 h-3.5 text-sky-200" />
            <span className="hidden xl:inline">Google Workspace</span>
            <span className="hidden sm:inline xl:hidden">Sheets</span>
          </button>
        )}

        {/* Notification Bell Button in Header */}
        <button
          id="btn-header-notifications"
          type="button"
          onClick={() => {
            if (onOpenNotifications) {
              onOpenNotifications();
            } else {
              window.dispatchEvent(new CustomEvent('syd-toggle-alerts-widget'));
            }
          }}
          title={
            hasNewUpdate
              ? `Nueva actualización disponible (v${CURRENT_APP_VERSION}). Haz clic para ver notificaciones.`
              : alertsCount > 0
              ? `Centro de Notificaciones (${alertsCount} alertas pendientes)`
              : 'Centro de Notificaciones (Al día)'
          }
          className={`relative flex items-center justify-center p-2 rounded-xl border text-xs font-bold transition cursor-pointer active:scale-95 shadow-xs ${
            hasNewUpdate
              ? 'bg-gradient-to-r from-emerald-600/30 to-cyan-600/30 border-emerald-400 text-emerald-300 ring-2 ring-emerald-500/40 animate-pulse'
              : alertsCount > 0
              ? 'bg-[#1a2d48] border-cyan-400/80 text-cyan-300 ring-2 ring-cyan-500/30'
              : 'bg-[#152338] border-slate-700 text-slate-300 hover:text-white hover:border-slate-600'
          }`}
        >
          <Bell
            className={`w-4 h-4 ${
              hasNewUpdate
                ? 'text-emerald-300 animate-spin-slow'
                : alertsCount > 0
                ? 'text-cyan-300 animate-pulse'
                : 'text-slate-400'
            }`}
          />
          {(alertsCount > 0 || hasNewUpdate) && (
            <span
              className={`absolute -top-1 -right-1 font-black text-[9px] min-w-[17px] h-[17px] px-0.5 rounded-full flex items-center justify-center border border-slate-900 shadow-md ${
                hasNewUpdate
                  ? 'bg-emerald-400 text-slate-950 font-black animate-pulse'
                  : 'bg-cyan-500 text-slate-950 font-bold'
              }`}
            >
              {alertsCount > 0 ? alertsCount : '1'}
            </span>
          )}
        </button>

        {/* Button to Open App Updates Center */}
        {onOpenAppUpdates && (
          <button
            id="btn-open-app-updates"
            type="button"
            onClick={onOpenAppUpdates}
            title="Centro de Actualizaciones y Novedades del Sistema"
            className={`relative flex items-center gap-1.5 px-2.5 sm:px-3 py-2 border text-xs font-bold transition cursor-pointer active:scale-95 shadow-xs hover:opacity-90 rounded-xl ${
              hasNewUpdate
                ? 'bg-gradient-to-r from-emerald-600/30 to-cyan-600/30 border-emerald-400 text-emerald-300 ring-2 ring-emerald-500/40 animate-pulse'
                : 'bg-[#152338] border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <Sparkles className={`w-3.5 h-3.5 ${hasNewUpdate ? 'text-emerald-400 animate-spin-slow' : 'text-cyan-400'}`} />
            {hasNewUpdate ? (
              <span className="font-extrabold text-emerald-300 flex items-center gap-1">
                <span>¡Actualizar!</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              </span>
            ) : (
              <span className="font-bold">v{CURRENT_APP_VERSION}</span>
            )}
          </button>
        )}

        {/* Standby / Suspension Mode Button */}
        {onSuspendApp && (
          <button
            id="btn-header-standby"
            type="button"
            onClick={onSuspendApp}
            title="Activar Modo Suspensión / Standby (Atajo: Ctrl+L o Alt+S)"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 bg-[#152338] hover:bg-[#1e3250] border border-slate-700 hover:border-sky-500/50 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition cursor-pointer active:scale-95 shadow-xs"
          >
            <Moon className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xl:inline">Standby</span>
          </button>
        )}

        {/* Primary Refrescar / Sincronizar Button */}
        <button
          id="btn-refresh-page"
          type="button"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Refrescar sistema y optimizar rendimiento (sincroniza datos en tiempo real)"
          style={{
            backgroundColor: showSuccessToast ? 'rgba(16, 185, 129, 0.2)' : 'var(--syd-card-bg)',
            borderColor: showSuccessToast ? 'rgba(16, 185, 129, 0.4)' : 'var(--syd-border-color)',
            color: showSuccessToast ? '#10b981' : 'var(--syd-text-primary)',
            borderRadius: 'var(--syd-btn-radius)',
          }}
          className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 border text-xs font-bold transition cursor-pointer active:scale-95 shadow-xs hover:opacity-90"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`}
            style={{ color: 'var(--syd-accent)' }}
          />
          <span className="hidden sm:inline">
            {isRefreshing ? 'Refrescando...' : showSuccessToast ? 'Refrescado' : 'Refrescar'}
          </span>
        </button>
      </div>
    </header>
  );
};

