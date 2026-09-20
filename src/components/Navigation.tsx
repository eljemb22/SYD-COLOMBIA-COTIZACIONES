import React, { useState } from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  PenLine,
  BookOpen,
  FileSpreadsheet,
  FolderArchive,
  History,
  Truck,
  PackageCheck,
  ReceiptText,
  ChevronLeft,
  ChevronRight,
  Building2,
  LogOut,
  User,
  ShieldCheck,
  Search,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Pin,
  PinOff,
  Lock,
  Brush,
  Sparkles,
  Share2,
  Database,
  Mail,
} from 'lucide-react';
import { ActiveTab, AuthUser, ThemeSettings } from '../types';
import { SyDLogo } from './common/SyDLogo';
import { CURRENT_APP_VERSION } from '../utils/versionCheck';

export type { ActiveTab };

interface NavigationProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  currentUser: AuthUser | null;
  onLogout: () => void;
  onOpenUserManagement?: () => void;
  onSuspendApp?: () => void;
  onOpenCustomization?: () => void;
  themeSettings?: ThemeSettings;
  quoteItemsCount: number;
  costItemsCount: number;
  catalogItemsCount: number;
  tenderItemsCount: number;
  docItemsCount: number;
  savedQuotesCount: number;
  ocItemsCount?: number;
  ocAlertsCount?: number;
  salesOrdersCount?: number;
  salesInvoicesCount?: number;
  onOpenAppUpdates?: () => void;
  onOpenShareModal?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onTabChange,
  isCollapsed = true,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
  currentUser,
  onLogout,
  onOpenUserManagement,
  onSuspendApp,
  onOpenCustomization,
  themeSettings,
  quoteItemsCount,
  costItemsCount,
  catalogItemsCount,
  tenderItemsCount,
  docItemsCount,
  savedQuotesCount,
  ocItemsCount = 0,
  ocAlertsCount = 0,
  salesOrdersCount = 0,
  salesInvoicesCount = 0,
  onOpenAppUpdates,
  onOpenShareModal,
}) => {
  // Hover expansion state: when cursor hovers over the sidebar, it unfolds; when cursor leaves, it minimizes
  const [isHovered, setIsHovered] = useState(false);

  // Collapsible accordion state for menu sections
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    'COTIZACIÓN': false,
    'COSTOS': false,
    'CATÁLOGO': false,
    'LICITACIONES Y CONTRATOS': false,
    'COMPRAS Y SEGUIMIENTO': false,
    'DESPACHO Y FACTURACIÓN': false,
    'DOCUMENTACIÓN': false,
  });

  // Effective state: expanded if explicitly pinned open OR if currently hovered
  const isEffectiveExpanded = !isCollapsed || isHovered;
  const isEffectiveCollapsed = !isEffectiveExpanded;

  const toggleSection = (sectionName: string) => {
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName],
    }));
  };

  const navSections = [
    {
      group: 'COTIZACIÓN',
      items: [
        {
          id: 'ventas' as ActiveTab,
          name: '1. Cotizaciones',
          subtitle: '',
          icon: ShoppingCart,
          badge:
            quoteItemsCount > 0 && savedQuotesCount > 0
              ? `${quoteItemsCount} • 📁${savedQuotesCount}`
              : quoteItemsCount > 0
              ? quoteItemsCount
              : savedQuotesCount > 0
              ? `📁 ${savedQuotesCount}`
              : null,
          badgeColor: 'bg-[#38bdf8] text-slate-950 font-bold',
          activeClass: 'bg-[#38bdf8]/15 border-[#38bdf8] text-white shadow-sm shadow-[#38bdf8]/10',
          iconBg: 'bg-[#38bdf8] text-slate-950',
          matchesTab: (currentTab: ActiveTab) => currentTab === 'ventas' || currentTab === 'historial',
        },
      ],
    },
    {
      group: 'COSTOS',
      items: [
        {
          id: 'costos' as ActiveTab,
          name: '2. Costos y Rentabilidad',
          subtitle: '',
          icon: PenLine,
          badge: costItemsCount > 0 ? costItemsCount : null,
          badgeColor: 'bg-amber-400 text-slate-950 font-bold',
          activeClass: 'bg-amber-400/15 border-amber-400 text-white shadow-sm shadow-amber-400/10',
          iconBg: 'bg-amber-400 text-slate-950',
        },
      ],
    },
    {
      group: 'CATÁLOGO',
      items: [
        {
          id: 'catalogo' as ActiveTab,
          name: '3. Creación Equipos',
          subtitle: '',
          icon: BookOpen,
          badge: catalogItemsCount > 0 ? catalogItemsCount : null,
          badgeColor: 'bg-blue-400 text-slate-950 font-bold',
          activeClass: 'bg-blue-500/15 border-blue-400 text-white shadow-sm shadow-blue-500/10',
          iconBg: 'bg-blue-400 text-slate-950',
        },
      ],
    },
    {
      group: 'LICITACIONES Y CONTRATOS',
      items: [
        {
          id: 'licitaciones' as ActiveTab,
          name: '4. Licitaciones y Contratos',
          subtitle: '',
          icon: FileSpreadsheet,
          badge: tenderItemsCount > 0 ? tenderItemsCount : null,
          badgeColor: 'bg-purple-400 text-slate-950 font-bold',
          activeClass: 'bg-purple-400/15 border-purple-400 text-white shadow-sm shadow-purple-400/10',
          iconBg: 'bg-purple-400 text-slate-950',
        },
      ],
    },
    {
      group: 'COMPRAS Y SEGUIMIENTO',
      items: [
        {
          id: 'seguimiento_oc' as ActiveTab,
          name: '5. Seguimiento de OC',
          subtitle: '',
          icon: Truck,
          badge: (ocAlertsCount && ocAlertsCount > 0) ? `⚠️ ${ocAlertsCount}` : (ocItemsCount && ocItemsCount > 0 ? ocItemsCount : null),
          badgeColor: (ocAlertsCount && ocAlertsCount > 0) ? 'bg-rose-500 text-white font-black animate-pulse' : 'bg-sky-400 text-slate-950 font-bold',
          activeClass: 'bg-sky-500/15 border-sky-400 text-white shadow-sm shadow-sky-500/10',
          iconBg: 'bg-sky-400 text-slate-950',
        },
        {
          id: 'gmail_compras' as ActiveTab,
          name: '5.1 Conexión Gmail & OCs',
          subtitle: '',
          icon: Mail,
          badge: 'Gmail',
          badgeColor: 'bg-rose-400 text-slate-950 font-bold',
          activeClass: 'bg-rose-500/15 border-rose-400 text-white shadow-sm shadow-rose-500/10',
          iconBg: 'bg-rose-400 text-slate-950',
        },
      ],
    },
    {
      group: 'DESPACHO Y FACTURACIÓN',
      items: [
        {
          id: 'ordenes_venta' as ActiveTab,
          name: '6. Órdenes de Venta y Facturación',
          subtitle: '',
          icon: PackageCheck,
          badge: salesOrdersCount > 0 ? (salesInvoicesCount > 0 ? `${salesOrdersCount} • 🧾${salesInvoicesCount}` : salesOrdersCount) : null,
          badgeColor: 'bg-teal-400 text-slate-950 font-bold',
          activeClass: 'bg-teal-400/15 border-teal-400 text-white shadow-sm shadow-teal-400/10',
          iconBg: 'bg-teal-400 text-slate-950',
        },
      ],
    },
    {
      group: 'DOCUMENTACIÓN',
      items: [
        {
          id: 'documentacion' as ActiveTab,
          name: '7. Documentación',
          subtitle: '',
          icon: FolderArchive,
          badge: docItemsCount > 0 ? docItemsCount : null,
          badgeColor: 'bg-emerald-400 text-slate-950 font-bold',
          activeClass: 'bg-emerald-400/15 border-emerald-400 text-white shadow-sm shadow-emerald-400/10',
          iconBg: 'bg-emerald-400 text-slate-950',
        },
      ],
    },
  ];

  const handleSelectTab = (tabId: ActiveTab) => {
    onTabChange(tabId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Desktop placeholder spacer that dynamically synchronizes with sidebar expansion so content is NEVER obscured or overlapped */}
      <div
        className={`hidden md:block shrink-0 transition-all duration-300 ${
          isEffectiveCollapsed ? 'w-18' : 'w-60 lg:w-64'
        }`}
      />

      {/* Main Left Sidebar (Smooth Layout Expansion & Hover/Pin synchronization) */}
      <aside
        id="main-sidebar-navigation"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          backgroundColor: 'var(--syd-sidebar-bg)',
          borderColor: 'var(--syd-border-color)',
        }}
        className={`fixed top-0 h-screen z-40 flex flex-col border-r transition-all duration-300 ease-in-out shadow-2xl shrink-0 ${
          isMobileOpen ? 'left-0 w-64' : '-left-full md:left-0'
        } ${
          isEffectiveCollapsed
            ? 'md:w-18'
            : 'md:w-60 lg:w-64 md:border-r md:border-[#38bdf8]/40 md:shadow-[0_0_25px_rgba(0,0,0,0.5)]'
        }`}
      >
        {/* Unified Identity & Profile Header (Brand, User Avatar, Role, User Mgmt, Logout & Pin) */}
        <div
          style={{
            backgroundColor: 'var(--syd-card-bg)',
            borderColor: 'var(--syd-border-color)',
          }}
          className="p-2.5 border-b shrink-0"
        >
          {isEffectiveExpanded ? (
            <div className="space-y-2 animate-fadeIn">
              {/* Row 1: User Profile Info + Dedicated Brush Customization & Pin Buttons */}
              <div className="flex items-center justify-between gap-1.5">
                <div
                  className="flex items-center gap-2.5 min-w-0 text-left flex-1 select-none"
                >
                  <div className="relative shrink-0">
                    <div
                      className={`w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center text-white font-bold text-xs shadow-sm border border-white/15 ${
                        currentUser?.avatarPhotoUrl
                          ? 'bg-slate-900'
                          : `bg-gradient-to-br ${currentUser?.avatarColor || 'from-blue-600 to-indigo-600'}`
                      }`}
                    >
                      {currentUser?.avatarPhotoUrl ? (
                        <img
                          src={currentUser.avatarPhotoUrl}
                          alt={currentUser.name}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <SyDLogo size="sm" showText={false} themeSettings={themeSettings} />
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 leading-tight">
                      <span className="text-xs font-black text-white truncate">
                        {themeSettings?.companyName || 'SYD COLOMBIA'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-slate-300 font-bold truncate">
                        {currentUser?.name || 'Jairo'}
                      </span>
                      <span
                        className={`text-[8.5px] font-black px-1.5 py-0.2 rounded-md shrink-0 ${
                          currentUser?.role === 'admin'
                            ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                            : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                        }`}
                      >
                        {currentUser?.role === 'admin' ? '👑 Admin' : '🔍 Inv.'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right utility buttons: Dedicated Brush button (only trigger for customization) + Pin */}
                <div className="flex items-center gap-1 shrink-0">
                  {onOpenCustomization && (
                    <button
                      id="btn-open-customization-brush"
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onOpenCustomization();
                      }}
                      title="Personalizar interfaz, temas y colores"
                      style={{
                        backgroundColor: 'var(--syd-sidebar-bg)',
                        borderColor: 'var(--syd-border-color)',
                      }}
                      className="p-1.5 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 border border-amber-400/50 hover:border-amber-400 shadow-sm transition cursor-pointer flex items-center justify-center group active:scale-95"
                    >
                      <Brush className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                    </button>
                  )}

                  {onToggleCollapse && (
                    <button
                      onClick={onToggleCollapse}
                      title={
                        isCollapsed
                          ? 'Fijar menú siempre expandido'
                          : 'Modo auto-minimizado (desplegar al pasar el cursor)'
                      }
                      style={{
                        backgroundColor: 'var(--syd-sidebar-bg)',
                        borderColor: 'var(--syd-border-color)',
                      }}
                      className="hidden md:flex items-center justify-center p-1.5 rounded-lg text-slate-400 hover:text-white border transition cursor-pointer"
                    >
                      {isCollapsed ? (
                        <Pin className="w-3.5 h-3.5 text-slate-400 hover:text-[#38bdf8]" />
                      ) : (
                        <ChevronLeft className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Row 2: Compact User Management & Logout Action Buttons */}
              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-700/30">
                {onOpenUserManagement && (
                  <button
                    type="button"
                    onClick={onOpenUserManagement}
                    title={
                      currentUser?.role === 'admin'
                        ? 'Configurar nombres, contraseñas, rangos y permisos de usuarios'
                        : 'Cambiar mi contraseña y ver mis permisos habilitados'
                    }
                    style={{
                      backgroundColor: 'var(--syd-sidebar-bg)',
                      borderColor: 'var(--syd-border-color)',
                    }}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg hover:opacity-90 text-[#38bdf8] hover:text-white border text-[10.5px] font-black transition cursor-pointer"
                  >
                    <KeyRound className="w-3 h-3 shrink-0" />
                    <span className="truncate">{currentUser?.role === 'admin' ? 'Usuarios' : 'Clave'}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onLogout}
                  title="Cerrar sesión actual"
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-100 border border-rose-500/30 text-[10.5px] font-black transition cursor-pointer"
                >
                  <LogOut className="w-3 h-3 shrink-0" />
                  <span className="truncate">Salir</span>
                </button>
              </div>

              {/* Version & Updates Shortcut Row */}
              {onOpenAppUpdates && (
                <button
                  type="button"
                  onClick={onOpenAppUpdates}
                  title="Ver novedades de la versión y comprobar actualizaciones"
                  className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#111e30] hover:bg-[#1a2d48] border border-cyan-500/30 text-[10.5px] text-cyan-300 font-bold transition cursor-pointer mt-1"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>Versión v{CURRENT_APP_VERSION}</span>
                  </span>
                  <span className="text-[9.5px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded border border-slate-700">
                    Novedades
                  </span>
                </button>
              )}
            </div>
          ) : (
            /* Collapsed Mode: Avatar + Mini Action Icons */
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center text-white shrink-0 border border-white/10 shadow-sm ${
                  currentUser?.avatarPhotoUrl
                    ? 'bg-slate-900'
                    : `bg-gradient-to-br ${currentUser?.avatarColor || 'from-blue-600 to-indigo-600'}`
                }`}
              >
                {currentUser?.avatarPhotoUrl ? (
                  <img
                    src={currentUser.avatarPhotoUrl}
                    alt={currentUser.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <SyDLogo size="sm" showText={false} themeSettings={themeSettings} />
                )}
              </div>

              {onOpenShareModal && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenShareModal();
                  }}
                  title="Compartir enlace web del sistema para abrir en cualquier computador o dispositivo"
                  className="w-7 h-7 rounded-lg text-sky-400 hover:text-sky-200 hover:bg-sky-500/20 border border-sky-400/40 flex items-center justify-center transition cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              )}

              {onOpenAppUpdates && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenAppUpdates();
                  }}
                  title={`Versión v${CURRENT_APP_VERSION} - Centro de Actualizaciones`}
                  className="w-7 h-7 rounded-lg text-cyan-400 hover:text-cyan-200 hover:bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center transition cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </button>
              )}

              {onOpenCustomization && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenCustomization();
                  }}
                  title="Personalizar temas y apariencia"
                  style={{
                    backgroundColor: 'var(--syd-sidebar-bg)',
                    borderColor: 'var(--syd-border-color)',
                  }}
                  className="w-7 h-7 rounded-lg text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 border border-amber-400/50 flex items-center justify-center transition cursor-pointer"
                >
                  <Brush className="w-3.5 h-3.5" />
                </button>
              )}

              {onOpenUserManagement && (
                <button
                  type="button"
                  onClick={onOpenUserManagement}
                  title={
                    currentUser?.role === 'admin'
                      ? 'Gestionar Usuarios, Contraseñas y Permisos'
                      : 'Cambiar Mi Contraseña'
                  }
                  style={{
                    backgroundColor: 'var(--syd-sidebar-bg)',
                    borderColor: 'var(--syd-border-color)',
                  }}
                  className="w-8 h-8 rounded-lg text-[#38bdf8] hover:text-white border flex items-center justify-center transition cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={onLogout}
                title="Cerrar Sesión"
                className="w-8 h-8 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-100 border border-rose-500/30 flex items-center justify-center transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation Items List */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-2.5 scrollbar-thin">
          {/* Standalone Inicio Tab */}
          <div className="space-y-0.5">
            <button
              id="sidebar-tab-inicio"
              type="button"
              onClick={() => handleSelectTab('inicio')}
              title={isEffectiveCollapsed ? 'Inicio' : undefined}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer text-left border ${
                activeTab === 'inicio'
                  ? 'bg-[#38bdf8]/15 border-[#38bdf8] text-white shadow-sm shadow-[#38bdf8]/10'
                  : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#192b45] hover:border-[#334d6e]/50'
              } ${isEffectiveCollapsed ? 'justify-center px-1 py-2' : ''}`}
            >
              <div
                className={`p-1.5 rounded-md shrink-0 transition-transform ${
                  activeTab === 'inicio' ? 'bg-[#38bdf8] text-slate-950' : 'bg-[#15253d] text-slate-400'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
              </div>

              {isEffectiveExpanded && (
                <div className="flex-1 min-w-0 flex items-center justify-between animate-fadeIn">
                  <span
                    className={`text-xs font-bold truncate leading-none ${
                      activeTab === 'inicio' ? 'text-white' : 'text-slate-300'
                    }`}
                  >
                    Inicio
                  </span>
                </div>
              )}
            </button>
          </div>

          <div className="h-px bg-[#334d6e]/40 my-1 mx-1.5" />

          {navSections.map((sec, secIdx) => {
            const isSecCollapsed = collapsedSections[sec.group];

            return (
              <div key={secIdx} className="space-y-0.5">
                {isEffectiveExpanded && (
                  <button
                    type="button"
                    onClick={() => toggleSection(sec.group)}
                    className="w-full flex items-center justify-between px-2.5 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-200 uppercase tracking-wider cursor-pointer select-none"
                  >
                    <span>{sec.group}</span>
                    {isSecCollapsed ? (
                      <ChevronDown className="w-3 h-3 text-slate-400" />
                    ) : (
                      <ChevronUp className="w-3 h-3 text-slate-400" />
                    )}
                  </button>
                )}
                {isEffectiveCollapsed && <div className="h-px bg-[#334d6e]/40 my-1 mx-1.5" />}

                {(!isSecCollapsed || isEffectiveCollapsed) &&
                  sec.items.map((tab) => {
                    const isActive = (tab as any).matchesTab
                      ? (tab as any).matchesTab(activeTab)
                      : activeTab === tab.id;
                    const Icon = tab.icon;

                    return (
                      <button
                        key={tab.id}
                        id={`sidebar-tab-${tab.id}`}
                        onClick={() => handleSelectTab(tab.id)}
                        title={isEffectiveCollapsed ? `${tab.name} (${tab.subtitle})` : undefined}
                        className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all duration-150 cursor-pointer text-left border ${
                          isActive
                            ? tab.activeClass
                            : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#192b45] hover:border-[#334d6e]/50'
                        } ${isEffectiveCollapsed ? 'justify-center px-1 py-2' : ''}`}
                      >
                        <div
                          className={`p-1.5 rounded-md shrink-0 transition-transform ${
                            isActive ? tab.iconBg : 'bg-[#15253d] text-slate-400'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </div>

                        {isEffectiveExpanded && (
                          <div className="flex-1 min-w-0 flex items-center justify-between animate-fadeIn">
                            <span
                              className={`text-xs font-bold truncate leading-none ${
                                isActive ? 'text-white' : 'text-slate-300'
                              }`}
                            >
                              {tab.name}
                            </span>

                            {tab.badge !== null && (
                              <span
                                className={`ml-1 px-1.5 py-0.2 rounded-full text-[9.5px] shrink-0 ${tab.badgeColor}`}
                              >
                                {tab.badge}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
};

