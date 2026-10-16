import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Palette,
  Type,
  Sparkles,
  RotateCcw,
  Check,
  Building,
  Building2,
  Upload,
  User,
  Square,
  Sliders,
  Paintbrush,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Moon,
  Clock,
  ShieldCheck,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import { SyDLogo } from '../common/SyDLogo';
import { makeImageBackgroundTransparent } from '../../utils/imageTransparencyUtils';
import {
  ThemeSettings,
  CanvasThemeKey,
  AccentColorKey,
  ButtonShapeKey,
  TextColorKey,
  FontFamilyKey,
  FontSizeKey,
  AuthUser,
} from '../../types';
import {
  CANVAS_THEME_MAP,
  ACCENT_COLOR_MAP,
  BUTTON_SHAPE_MAP,
  TEXT_COLOR_MAP,
  FONT_FAMILY_MAP,
  PRESET_THEME_BUNDLES,
  DEFAULT_THEME_SETTINGS,
  PRESET_AVATARS,
  applyThemeToDOM,
  saveStoredThemeSettings,
} from '../../utils/themeStorage';
import {
  STORAGE_KEY_STANDBY_TIMEOUT,
  DEFAULT_STANDBY_TIMEOUT_MINUTES,
  STANDBY_TIMEOUT_OPTIONS,
} from '../../hooks/useIdleStandby';

interface CustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: ThemeSettings;
  onThemeUpdated: (theme: ThemeSettings) => void;
  currentUser?: AuthUser | null;
  onUpdateCurrentUserPhoto?: (photoUrl: string) => void;
  onUserUpdated?: (user: AuthUser) => void;
  standbyTimeoutMinutes?: number;
  onStandbyTimeoutChange?: (minutes: number) => void;
}

export const CustomizationModal: React.FC<CustomizationModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onThemeUpdated,
  currentUser,
  onUpdateCurrentUserPhoto,
  onUserUpdated,
  standbyTimeoutMinutes,
  onStandbyTimeoutChange,
}) => {
  const [theme, setTheme] = useState<ThemeSettings>(() => ({
    ...DEFAULT_THEME_SETTINGS,
    ...(currentTheme || {}),
  }));
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  // Standby inactivity timeout local state synced with localStorage and props
  const [idleMinutes, setIdleMinutes] = useState<number>(() => {
    if (typeof standbyTimeoutMinutes === 'number') {
      return standbyTimeoutMinutes;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY_STANDBY_TIMEOUT);
      if (stored !== null) {
        const parsed = parseInt(stored, 10);
        return isNaN(parsed) ? DEFAULT_STANDBY_TIMEOUT_MINUTES : parsed;
      }
    } catch {}
    return DEFAULT_STANDBY_TIMEOUT_MINUTES;
  });

  // Sync when prop changes
  useEffect(() => {
    if (typeof standbyTimeoutMinutes === 'number') {
      setIdleMinutes(standbyTimeoutMinutes);
    }
  }, [standbyTimeoutMinutes]);

  const handleIdleMinutesChange = (newMinutes: number) => {
    setIdleMinutes(newMinutes);
    try {
      localStorage.setItem(STORAGE_KEY_STANDBY_TIMEOUT, String(newMinutes));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('syd_standby_timeout_updated', { detail: newMinutes }));
      }
    } catch {}
    if (onStandbyTimeoutChange) {
      onStandbyTimeoutChange(newMinutes);
    }
  };

  const [activePresetId, setActivePresetId] = useState<string>(() => {
    const match = PRESET_THEME_BUNDLES.find(
      (b) =>
        (currentTheme?.canvasTheme || DEFAULT_THEME_SETTINGS.canvasTheme) === b.theme.canvasTheme &&
        (currentTheme?.accentColor || DEFAULT_THEME_SETTINGS.accentColor) === b.theme.accentColor
    );
    return match ? match.id : 'syd_default_original';
  });

  // Keep local theme state in sync when opened or changed
  useEffect(() => {
    if (isOpen) {
      const merged = {
        ...DEFAULT_THEME_SETTINGS,
        ...(currentTheme || {}),
      };
      setTheme(merged);
      const match = PRESET_THEME_BUNDLES.find(
        (b) =>
          merged.canvasTheme === b.theme.canvasTheme &&
          merged.accentColor === b.theme.accentColor
      );
      setActivePresetId(match ? match.id : 'syd_default_original');
    }
  }, [isOpen, currentTheme]);

  // Handle ESC key press to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Single atomic updater for one or more fields to prevent closure race conditions
  const updateFields = (partial: Partial<ThemeSettings>) => {
    setTheme((prev) => {
      const updated = { ...prev, ...partial, updatedAt: new Date().toISOString() };
      applyThemeToDOM(updated);
      saveStoredThemeSettings(updated);
      // Schedule parent update on next tick or synchronously outside closure
      setTimeout(() => {
        onThemeUpdated(updated);
      }, 0);
      return updated;
    });
  };

  const applyPresetBundle = (bundle: typeof PRESET_THEME_BUNDLES[0]) => {
    setActivePresetId(bundle.id);
    updateFields(bundle.theme);
  };

  const handleResetDefaults = () => {
    setActivePresetId('syd_default_original');
    const defaults = { ...DEFAULT_THEME_SETTINGS, updatedAt: new Date().toISOString() };
    setTheme(defaults);
    applyThemeToDOM(defaults);
    saveStoredThemeSettings(defaults);
    onThemeUpdated(defaults);
  };

  // White Outline Border Mode state for logos on dark backgrounds
  const [hasWhiteOutline, setHasWhiteOutline] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('syd_logo_white_outline');
      if (stored !== null) return stored === 'true';
    } catch {}
    return true;
  });

  const toggleWhiteOutline = (enabled: boolean) => {
    setHasWhiteOutline(enabled);
    try {
      localStorage.setItem('syd_logo_white_outline', String(enabled));
    } catch {}
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Url = event.target?.result as string;
      if (base64Url) {
        // Automatically make white background transparent for clean floating look
        const transparentLogo = await makeImageBackgroundTransparent(base64Url);
        updateFields({
          companyLogoUrl: transparentLogo,
          logoStyle: 'custom_image',
        });
        try {
          localStorage.setItem('syd_custom_login_logo_url', transparentLogo);
        } catch {}
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target?.result as string;
      if (base64Url) {
        if (onUpdateCurrentUserPhoto) {
          onUpdateCurrentUserPhoto(base64Url);
        }
        if (onUserUpdated && currentUser) {
          onUserUpdated({ ...currentUser, avatarPhotoUrl: base64Url });
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const applyNewUserPhoto = (url: string) => {
    if (onUpdateCurrentUserPhoto) {
      onUpdateCurrentUserPhoto(url);
    }
    if (onUserUpdated && currentUser) {
      onUserUpdated({ ...currentUser, avatarPhotoUrl: url });
    }
  };

  // Global Ctrl+V listener for pasting avatar photo while modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handleModalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const activeEl = document.activeElement as HTMLElement | null;
      const isTypingText =
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
              const base64Url = event.target?.result as string;
              if (base64Url) {
                applyNewUserPhoto(base64Url);
              }
            };
            reader.readAsDataURL(file);
          }
          return;
        }
      }

      if (!isTypingText) {
        const text = e.clipboardData?.getData('text')?.trim();
        if (text && (text.startsWith('http') || text.startsWith('data:image/')) && /\.(png|jpe?g|webp|svg|gif)($|\?)/i.test(text)) {
          e.preventDefault();
          applyNewUserPhoto(text);
        }
      }
    };

    window.addEventListener('paste', handleModalPaste);
    return () => window.removeEventListener('paste', handleModalPaste);
  }, [isOpen, currentUser, onUpdateCurrentUserPhoto, onUserUpdated]);

  const activeCanvas = (theme?.canvasTheme && CANVAS_THEME_MAP[theme.canvasTheme]) || CANVAS_THEME_MAP.navy_dark;
  const isLightMode = Boolean(activeCanvas?.isLight);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      id="customization-modal-backdrop"
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/25 animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="customization-modal-container"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-5xl lg:max-w-6xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border animate-scaleUp text-xs ${
          isLightMode
            ? 'bg-slate-50 border-slate-300 text-slate-900'
            : 'bg-[#15253d] border-[#334d6e] text-white'
        }`}
      >
        {/* Header: Spacious & Clear */}
        <div
          className={`px-5 py-3.5 border-b flex items-center justify-between shrink-0 ${
            isLightMode ? 'bg-white border-slate-200' : 'bg-[#111c2e] border-[#334d6e]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              style={{
                backgroundColor: 'var(--syd-accent-glow)',
                borderColor: 'var(--syd-accent)',
                color: 'var(--syd-accent)',
              }}
              className="w-9 h-9 rounded-xl border flex items-center justify-center shadow-sm"
            >
              <Paintbrush className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black tracking-tight flex items-center gap-2">
                <span>Personalización &amp; Apariencia</span>
              </h2>
              <p className="text-xs text-slate-400 leading-none mt-1">
                Ajuste temas visuales, avatar de usuario y configuración de colores globales
              </p>
            </div>
          </div>

          <button
            id="btn-close-customization-modal"
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-700/20 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-slate-500/30 flex items-center justify-center transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body: Spacious & Clear Sections */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
          
          {/* SECTION 1: Temas Rápidos Predefinidos - Spacious Grid */}
          <div
            className={`p-4 rounded-xl border shadow-sm ${
              isLightMode ? 'bg-white border-slate-200' : 'bg-[#111c2e] border-[#334d6e]/80'
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider">
                  Temas Rápidos del Sistema
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  id="btn-quick-reset-default-theme"
                  type="button"
                  onClick={handleResetDefaults}
                  title="Restablecer todos los colores, fondos y bordes al Tema Original de fábrica (Default)"
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all cursor-pointer hover:opacity-90 active:scale-95 shadow-xs"
                  style={{
                    backgroundColor: 'var(--syd-card-bg)',
                    borderColor: 'var(--syd-accent)',
                    color: 'var(--syd-accent)',
                  }}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restablecer Tema Original (Default)</span>
                </button>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Cambio instantáneo en 1 clic
                </span>
              </div>
            </div>

            {/* 6 columns responsive theme cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {PRESET_THEME_BUNDLES.map((bundle) => {
                const isSelected = activePresetId === bundle.id;
                return (
                  <button
                    key={bundle.id}
                    type="button"
                    onClick={() => applyPresetBundle(bundle)}
                    style={
                      isSelected
                        ? {
                            borderColor: 'var(--syd-accent)',
                            backgroundColor: 'var(--syd-accent-glow)',
                            boxShadow: '0 0 12px var(--syd-accent-glow)',
                          }
                        : undefined
                    }
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer relative group ${
                      isSelected
                        ? 'ring-2 ring-[var(--syd-accent)]/50 shadow-md scale-[1.02]'
                        : isLightMode
                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-200'
                        : 'bg-[#15253d] hover:bg-[#1a2f4c] border-[#334d6e]/70'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {bundle.swatches.map((swatch, sIdx) => (
                          <div
                            key={sIdx}
                            className="w-3.5 h-3.5 rounded-full border border-black/40 shadow-xs"
                            style={{ backgroundColor: swatch }}
                          />
                        ))}
                      </div>
                      {isSelected && (
                        <div style={{ color: 'var(--syd-accent)' }}>
                          <Check className="w-4 h-4 stroke-[3]" />
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-xs font-bold truncate leading-tight">
                        {bundle.name}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {bundle.badge}
                      </span>
                    </div>
                  </button>
                );
              })}

              {/* Slot: Botón de Ajustes Avanzados */}
              <button
                id="btn-toggle-advanced-customization-slot"
                type="button"
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer relative group ${
                  showAdvancedSettings
                    ? 'bg-purple-950/40 border-purple-500 ring-2 ring-purple-500/50 shadow-md text-white'
                    : isLightMode
                    ? 'bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-900'
                    : 'bg-purple-950/20 hover:bg-purple-900/35 border-purple-500/40 text-purple-200'
                }`}
                title="Ajustes manuales de color Hex, fuentes y bordes"
              >
                <div className="flex items-center justify-between">
                  <div className="w-5 h-5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center justify-center">
                    <SlidersHorizontal className="w-3 h-3" />
                  </div>
                  {showAdvancedSettings ? (
                    <ChevronUp className="w-3.5 h-3.5 text-purple-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-purple-400" />
                  )}
                </div>

                <div>
                  <div className="text-xs font-black truncate leading-tight">
                    {showAdvancedSettings ? 'Ocultar Ajustes' : 'Ajustes Manuales'}
                  </div>
                  <span className="text-[10px] text-purple-400 font-mono">
                    {showAdvancedSettings ? 'Personalización ON' : 'Colores Hex & Fuentes'}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* SECTION 2: Logo Oficial de la Empresa & Identidad Corporativa */}
          <div
            className={`p-4 rounded-xl border space-y-3.5 ${
              isLightMode ? 'bg-white border-slate-200' : 'bg-[#111c2e] border-[#334d6e]/80'
            }`}
          >
            {/* Header del Cuadro */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-700/30">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" style={{ color: 'var(--syd-accent)' }} />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-100">
                  Logo Oficial de la Empresa &amp; Membrete
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                Visible en encabezados, cotizaciones, órdenes de venta y reportes oficiales
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
              {/* Visual Preview Card & Actions */}
              <div
                className={`lg:col-span-5 p-3.5 rounded-xl border flex flex-col items-center text-center gap-3 ${
                  isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-[#15253d] border-[#334d6e]'
                }`}
              >
                <div className="w-full flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300">Vista Previa en Vivo</span>
                  {theme.companyLogoUrl ? (
                    <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Check className="w-3 h-3" /> Logo Personalizado
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-sky-400 bg-sky-950/60 border border-sky-500/40 px-2 py-0.5 rounded-full">
                      Emblema SYD Activo
                    </span>
                  )}
                </div>

                {/* Preview container */}
                <div className="w-full h-24 rounded-xl border border-slate-600/40 bg-slate-900/60 flex items-center justify-center p-3 overflow-hidden shadow-inner relative group">
                  {theme.companyLogoUrl ? (
                    <img
                      src={theme.companyLogoUrl}
                      alt={theme.companyName || 'Logo Empresa'}
                      className="max-h-full max-w-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <SyDLogo size="lg" showText={true} themeSettings={theme} />
                  )}
                </div>

                {/* Buttons: Upload / Remove */}
                <div className="w-full flex items-center gap-2">
                  <input
                    type="file"
                    ref={logoFileInputRef}
                    onChange={handleLogoFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => logoFileInputRef.current?.click()}
                    className="flex-1 py-2 px-3 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 transition cursor-pointer shadow-md active:scale-95"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{theme.companyLogoUrl ? 'Cambiar Logo' : 'Subir Logo (PC / Ctrl+V)'}</span>
                  </button>

                  {theme.companyLogoUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        updateFields({
                          companyLogoUrl: '',
                          logoStyle: 'emblem_3d',
                        });
                        try {
                          localStorage.removeItem('syd_custom_login_logo_url');
                        } catch {}
                      }}
                      title="Quitar logo personalizado y volver al emblema oficial SYD"
                      className="p-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition cursor-pointer flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Subtle White Outline Toggle for Dark Backgrounds */}
                <div className="w-full pt-2 border-t border-slate-700/30 flex items-center justify-between">
                  <div className="text-left">
                    <span className="text-[11px] font-bold text-slate-200 block">Borde blanco fino en letras</span>
                    <span className="text-[9.5px] text-slate-400">Realce sutil y elegante sobre fondo oscuro</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleWhiteOutline(!hasWhiteOutline)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      hasWhiteOutline ? 'bg-sky-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        hasWhiteOutline ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Right Controls: URL direct input, Company Name & Subtitle, Preset Vector Styles */}
              <div className="lg:col-span-7 space-y-3">
                {/* Direct URL / Web image link */}
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">
                    URL Web Directa del Logo (Opcional o pegar con Ctrl+V)
                  </label>
                  <input
                    type="text"
                    placeholder="https://ejemplo.com/logo-empresa.png"
                    value={theme.companyLogoUrl?.startsWith('data:') ? '' : theme.companyLogoUrl || ''}
                    onChange={(e) => {
                      const val = e.target.value.trim();
                      updateFields({
                        companyLogoUrl: val,
                        logoStyle: val ? 'custom_image' : 'emblem_3d',
                      });
                    }}
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-sky-400 outline-none"
                  />
                </div>

                {/* Company Name & Subtitle */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Nombre de la Empresa
                    </label>
                    <input
                      type="text"
                      value={theme.companyName || ''}
                      onChange={(e) => updateFields({ companyName: e.target.value })}
                      placeholder="SYD COLOMBIA"
                      className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-sky-400 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1">
                      Subtítulo / Línea de Negocio
                    </label>
                    <input
                      type="text"
                      value={theme.companySubtitle || ''}
                      onChange={(e) => updateFields({ companySubtitle: e.target.value })}
                      placeholder="Línea Diagnóstica"
                      className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-2 text-xs text-white font-bold focus:border-sky-400 outline-none"
                    />
                  </div>
                </div>

                {/* Preset Vector Emblems (when no custom image is uploaded) */}
                {!theme.companyLogoUrl && (
                  <div>
                    <label className="text-[11px] font-bold text-slate-300 block mb-1.5">
                      O selecciona un Emblema Corporativo Integrado:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { id: 'emblem_3d', label: 'Emblema 3D SYD', desc: 'Caduceo y pulso' },
                        { id: 'medical_cross', label: 'Cruz Médica', desc: 'Hospitalario' },
                        { id: 'shield_tech', label: 'Escudo Tech', desc: 'Seguridad' },
                        { id: 'minimal', label: 'Minimalista', desc: 'Texto limpio' },
                      ].map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => updateFields({ logoStyle: st.id as any })}
                          className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                            theme.logoStyle === st.id
                              ? 'bg-sky-500/20 border-sky-400 ring-2 ring-sky-400/40 text-white'
                              : 'bg-[#15253d] hover:bg-[#1a2f4c] border-[#334d6e] text-slate-300'
                          }`}
                        >
                          <div className="text-[11px] font-bold">{st.label}</div>
                          <div className="text-[9.5px] text-slate-400">{st.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 3: Foto de Perfil & Avatar del Usuario */}
          <div
            className={`p-4 rounded-xl border space-y-3 ${
              isLightMode ? 'bg-white border-slate-200' : 'bg-[#111c2e] border-[#334d6e]/80'
            }`}
          >
            {/* Header del Cuadro */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-700/30">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-100">
                  Foto de Perfil &amp; Avatar
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                Tu imagen visible en la barra lateral y encabezados
              </span>
            </div>

            {/* Fila Principal + Galería Integrada */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              {/* Left Column: Active User Info & Upload */}
              <div
                className={`lg:col-span-4 flex items-center justify-between gap-3 p-3 rounded-xl border ${
                  isLightMode ? 'bg-slate-50 border-slate-200' : 'bg-[#15253d] border-[#334d6e]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center font-black text-sm shrink-0 border border-white/20 shadow-md ${
                      currentUser?.avatarPhotoUrl ? 'bg-slate-900' : 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white'
                    }`}
                  >
                    {currentUser?.avatarPhotoUrl ? (
                      <img
                        src={currentUser.avatarPhotoUrl}
                        alt={currentUser?.name || 'Usuario'}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      currentUser?.name?.substring(0, 2).toUpperCase() || 'US'
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold truncate text-white leading-tight">{currentUser?.name || 'Usuario'}</div>
                    <div className="text-[11px] text-slate-400 truncate mt-0.5">@{currentUser?.username || 'admin'} • {currentUser?.roleLabel || 'Administrador'}</div>
                  </div>
                </div>

                <input
                  type="file"
                  ref={avatarFileInputRef}
                  onChange={handleAvatarFileUpload}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => avatarFileInputRef.current?.click()}
                  title="Subir foto o presionar Ctrl + V para pegar desde el portapapeles"
                  style={{
                    backgroundColor: 'var(--syd-card-bg)',
                    borderColor: 'var(--syd-accent)',
                    color: 'var(--syd-accent)',
                  }}
                  className="px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 hover:opacity-90 active:scale-95 shadow-xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Subir (Ctrl+V)</span>
                </button>
              </div>

              {/* Right Column: Galería de Avatares */}
              <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRESET_AVATARS.map((av) => {
                  const isSelected = currentUser?.avatarPhotoUrl === av.url;
                  return (
                    <button
                      key={av.id}
                      type="button"
                      onClick={() => applyNewUserPhoto(av.url)}
                      style={
                        isSelected
                          ? {
                              borderColor: 'var(--syd-accent)',
                              boxShadow: '0 0 10px var(--syd-accent-glow)',
                            }
                          : undefined
                      }
                      className={`p-2 rounded-xl border flex items-center gap-2 text-left transition cursor-pointer hover:scale-[1.02] ${
                        isSelected
                          ? 'ring-2 ring-[var(--syd-accent)]/50 shadow-sm'
                          : isLightMode
                          ? 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                          : 'bg-[#15253d] hover:bg-[#1a2f4c] border-[#334d6e]/70'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg overflow-hidden border border-white/20 shrink-0 bg-slate-900 shadow-xs">
                        <img src={av.url} alt={av.label} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate leading-tight text-white">
                          {av.label}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate mt-0.5">{av.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 3: Modo Suspensión & Standby por Inactividad */}
          <div
            className={`p-4 rounded-xl border space-y-3.5 ${
              isLightMode ? 'bg-white border-slate-200' : 'bg-[#111c2e] border-[#334d6e]/80'
            }`}
          >
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-700/30">
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-100">
                  Modo Suspensión / Standby por Inactividad
                </h3>
              </div>
              <span className="text-xs text-amber-400/90 font-medium flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Protege la pantalla sin cerrar sesión ni perder datos</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
              {/* Left description */}
              <div className="md:col-span-7 space-y-1.5">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Si no utilizas el sistema durante este período, la pantalla entrará en reposo mostrando el reloj y estado de tu sesión protegida. Podrás volver instantáneamente pulsando <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-white text-[11px]">Enter</kbd> o haciendo clic.
                </p>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Tiempo actual configurado: <strong className="text-sky-300 font-bold">{idleMinutes === 0 ? 'Desactivado' : `${idleMinutes} minutos`}</strong></span>
                </div>
              </div>

              {/* Right selector */}
              <div className="md:col-span-5 flex flex-col gap-1.5">
                <label
                  htmlFor="select-standby-timeout"
                  className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-sky-400" />
                  <span>Tiempo de inactividad antes de suspender:</span>
                </label>
                <select
                  id="select-standby-timeout"
                  value={idleMinutes}
                  onChange={(e) => handleIdleMinutesChange(parseInt(e.target.value, 10))}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer outline-none focus:ring-2 focus:ring-sky-500/50 ${
                    isLightMode
                      ? 'bg-slate-100 border-slate-300 text-slate-900 focus:bg-white'
                      : 'bg-[#15253d] border-[#334d6e] text-white hover:bg-[#1a2f4c]'
                  }`}
                >
                  {STANDBY_TIMEOUT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-400">
                  Guarda automáticamente en <code className="text-sky-400">localStorage</code> y surte efecto de inmediato.
                </span>
              </div>
            </div>
          </div>

          {/* SECCIONES AVANZADAS: Solo se muestran cuando showAdvancedSettings está activado */}
          {showAdvancedSettings && (
            <div className="space-y-2.5 pt-0.5 animate-fadeIn">
              {/* ADVANCED 1: Colores de Fondo (Canvas) & Color de Acento / Botones */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {/* Colores de Fondo (Canvas) */}
                <div
                  className={`p-2.5 rounded-lg border space-y-2 ${
                    isLightMode ? 'bg-white border-slate-200' : 'bg-[#111c2e] border-[#334d6e]/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Palette className="w-3.5 h-3.5" style={{ color: 'var(--syd-accent)' }} />
                      <h3 className="text-[10.5px] font-black uppercase tracking-wider">
                        Color de Fondo (Canvas)
                      </h3>
                    </div>
                    {theme.canvasTheme === 'custom' && (
                      <span className="text-[9px] font-bold" style={{ color: 'var(--syd-accent)' }}>Personalizado</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                    {(Object.keys(CANVAS_THEME_MAP) as CanvasThemeKey[])
                      .filter((k) => k !== 'custom')
                      .map((k) => {
                        const c = CANVAS_THEME_MAP[k];
                        const isSelected = theme.canvasTheme === k;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => updateFields({ canvasTheme: k })}
                            style={
                              isSelected
                                ? {
                                    borderColor: 'var(--syd-accent)',
                                    backgroundColor: 'var(--syd-accent-glow)',
                                  }
                                : undefined
                            }
                            className={`p-1.5 rounded-md border text-left flex items-center gap-1.5 transition cursor-pointer ${
                              isSelected
                                ? 'shadow-2xs'
                                : isLightMode
                                ? 'bg-slate-100 hover:bg-slate-200 border-slate-200'
                                : 'bg-[#15253d] hover:bg-[#1a2f4c] border-[#334d6e]/70'
                            }`}
                          >
                            <div
                              className="w-3.5 h-3.5 rounded border border-white/20 shrink-0"
                              style={{ backgroundColor: c.bodyBg }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-bold truncate leading-none">
                                {c.name}
                              </div>
                            </div>
                            {isSelected && <Check className="w-2.5 h-2.5 shrink-0" style={{ color: 'var(--syd-accent)' }} />}
                          </button>
                        );
                      })}
                  </div>

                  {/* Custom canvas hex picker */}
                  <div className="pt-1.5 border-t border-slate-700/40 flex items-center gap-1.5">
                    <label className="text-[10px] font-bold shrink-0 text-slate-400">
                      Hex:
                    </label>
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        type="color"
                        value={theme.customCanvasHex || '#0f1a2e'}
                        onChange={(e) => {
                          updateFields({
                            customCanvasHex: e.target.value,
                            canvasTheme: 'custom',
                          });
                        }}
                        className="w-6 h-6 rounded border border-slate-600 bg-transparent cursor-pointer"
                      />
                      <input
                        type="text"
                        value={theme.customCanvasHex || '#0f1a2e'}
                        onChange={(e) => {
                          updateFields({
                            customCanvasHex: e.target.value,
                            canvasTheme: 'custom',
                          });
                        }}
                        placeholder="#0f1a2e"
                        className="flex-1 px-2 py-0.5 text-[10.5px] border rounded font-mono uppercase bg-slate-800/40 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* Selector Unificado: Color de Acento & Botones */}
                <div
                  className={`p-2.5 rounded-lg border space-y-2 ${
                    isLightMode ? 'bg-white border-slate-200' : 'bg-[#111c2e] border-[#334d6e]/80'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                      <h3 className="text-[10.5px] font-black uppercase tracking-wider">
                        Acento &amp; Botones
                      </h3>
                    </div>
                    <span className="text-[9px] text-slate-400">Unificado</span>
                  </div>

                  <div className="grid grid-cols-2 gap-1 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                    {(Object.keys(ACCENT_COLOR_MAP) as AccentColorKey[])
                      .filter((k) => k !== 'custom')
                      .map((k) => {
                        const a = ACCENT_COLOR_MAP[k];
                        const isSelected = theme.accentColor === k;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() =>
                              updateFields({
                                accentColor: k,
                                buttonColor: k,
                              })
                            }
                            style={
                              isSelected
                                ? {
                                    borderColor: 'var(--syd-accent)',
                                    backgroundColor: 'var(--syd-accent-glow)',
                                  }
                                : undefined
                            }
                            className={`p-1.5 rounded-md border text-left flex items-center gap-1.5 transition cursor-pointer ${
                              isSelected
                                ? 'shadow-2xs'
                                : isLightMode
                                ? 'bg-slate-100 hover:bg-slate-200 border-slate-200'
                                : 'bg-[#15253d] hover:bg-[#1a2f4c] border-[#334d6e]/70'
                            }`}
                          >
                            <div
                              className="w-3.5 h-3.5 rounded-full border border-black/30 shrink-0 shadow-2xs"
                              style={{ backgroundColor: a.hex }}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-bold truncate leading-none">
                                {a.name}
                              </div>
                            </div>
                            {isSelected && <Check className="w-2.5 h-2.5 shrink-0" style={{ color: 'var(--syd-accent)' }} />}
                          </button>
                        );
                      })}
                  </div>

                  {/* Custom accent/button hex picker */}
                  <div className="pt-1.5 border-t border-slate-700/40 flex items-center gap-1.5">
                    <label className="text-[10px] font-bold shrink-0 text-slate-400">
                      Hex:
                    </label>
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        type="color"
                        value={theme.customAccentHex || '#38bdf8'}
                        onChange={(e) => {
                          updateFields({
                            customAccentHex: e.target.value,
                            customButtonHex: e.target.value,
                            accentColor: 'custom',
                            buttonColor: 'custom',
                          });
                        }}
                        className="w-6 h-6 rounded border border-slate-600 bg-transparent cursor-pointer"
                      />
                      <input
                        type="text"
                        value={theme.customAccentHex || '#38bdf8'}
                        onChange={(e) => {
                          updateFields({
                            customAccentHex: e.target.value,
                            customButtonHex: e.target.value,
                            accentColor: 'custom',
                            buttonColor: 'custom',
                          });
                        }}
                        placeholder="#38bdf8"
                        className="flex-1 px-2 py-0.5 text-[10.5px] border rounded font-mono uppercase bg-slate-800/40 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ADVANCED 2: Formas & Tipografía */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {/* Formas y Bordes */}
                <div
                  className={`p-2.5 rounded-lg border space-y-2 ${
                    isLightMode ? 'bg-white border-slate-200' : 'bg-[#111c2e] border-[#334d6e]/80'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <Square className="w-3.5 h-3.5 text-purple-400" />
                    <h3 className="text-[10.5px] font-black uppercase tracking-wider">
                      Formas &amp; Bordes
                    </h3>
                  </div>

                  {/* Forma Botones */}
                  <div className="grid grid-cols-2 gap-1">
                    {(Object.keys(BUTTON_SHAPE_MAP) as ButtonShapeKey[]).map((shapeKey) => {
                      const item = BUTTON_SHAPE_MAP[shapeKey];
                      const isSelected = theme.buttonShape === shapeKey;
                      return (
                        <button
                          key={shapeKey}
                          type="button"
                          onClick={() => updateFields({ buttonShape: shapeKey })}
                          style={{
                            borderRadius: item.radius,
                            ...(isSelected
                              ? {
                                  borderColor: 'var(--syd-accent)',
                                  backgroundColor: 'var(--syd-accent-glow)',
                                }
                              : {}),
                          }}
                          className={`p-1.5 border text-left flex items-center justify-between transition cursor-pointer ${
                            isSelected
                              ? 'shadow-2xs'
                              : isLightMode
                              ? 'bg-slate-100 hover:bg-slate-200 border-slate-200'
                              : 'bg-[#15253d] hover:bg-[#1a2f4c] border-[#334d6e]/70'
                          }`}
                        >
                          <div>
                            <div className="text-[10px] font-bold leading-tight">{item.name}</div>
                            <span className="text-[8px] text-slate-400">{item.label}</span>
                          </div>
                          {isSelected && <Check className="w-2.5 h-2.5 shrink-0" style={{ color: 'var(--syd-accent)' }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tipografía & Escala */}
                <div
                  className={`p-2.5 rounded-lg border space-y-2 ${
                    isLightMode ? 'bg-white border-slate-200' : 'bg-[#111c2e] border-[#334d6e]/80'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <Type className="w-3.5 h-3.5" style={{ color: 'var(--syd-accent)' }} />
                    <h3 className="text-[10.5px] font-black uppercase tracking-wider">
                      Tipografía &amp; Escala
                    </h3>
                  </div>

                  <div className="grid grid-cols-2 gap-1">
                    {(Object.keys(FONT_FAMILY_MAP) as FontFamilyKey[]).map((fKey) => {
                      const f = FONT_FAMILY_MAP[fKey];
                      const isSelected = theme.fontFamily === fKey;
                      return (
                        <button
                          key={fKey}
                          type="button"
                          onClick={() => updateFields({ fontFamily: fKey })}
                          style={
                            isSelected
                              ? {
                                  borderColor: 'var(--syd-accent)',
                                  backgroundColor: 'var(--syd-accent-glow)',
                                }
                              : undefined
                          }
                          className={`p-1.5 rounded-md border text-left flex items-center justify-between transition cursor-pointer ${
                            isSelected
                              ? 'shadow-2xs'
                              : isLightMode
                              ? 'bg-slate-100 hover:bg-slate-200 border-slate-200'
                              : 'bg-[#15253d] hover:bg-[#1a2f4c] border-[#334d6e]/70'
                          }`}
                        >
                          <div>
                            <div className="text-[10.5px] font-bold leading-tight" style={{ fontFamily: f.family }}>
                              {f.name}
                            </div>
                            <div className="text-[8px] text-slate-400">{f.category}</div>
                          </div>
                          {isSelected && <Check className="w-2.5 h-2.5 shrink-0" style={{ color: 'var(--syd-accent)' }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Sticky Footer: Ultra Compact Confirmation & Reset */}
        <div
          className={`px-3.5 py-2 border-t flex items-center justify-between gap-2 shrink-0 ${
            isLightMode ? 'bg-white border-slate-200' : 'bg-[#111c2e] border-[#334d6e]'
          }`}
        >
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            <span className="truncate">Cambios guardados en vivo</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              id="btn-reset-theme"
              type="button"
              onClick={handleResetDefaults}
              className="px-2.5 py-1 rounded-md bg-slate-700/20 hover:bg-slate-700/40 border border-slate-600/40 text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restablecer</span>
            </button>

            <button
              id="btn-save-close-customization"
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: 'var(--syd-btn-bg, var(--syd-accent))',
                color: 'var(--syd-btn-text)',
                borderRadius: 'var(--syd-btn-radius)',
              }}
              className="px-3.5 py-1 text-[10.5px] font-black transition flex items-center gap-1 shadow-xs cursor-pointer active:scale-95 hover:opacity-90"
            >
              <Check className="w-3 h-3 stroke-[3]" />
              <span>Listo</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
