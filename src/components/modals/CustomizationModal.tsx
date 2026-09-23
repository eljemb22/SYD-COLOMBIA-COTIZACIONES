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
  Upload,
  User,
  Square,
  Sliders,
  Paintbrush,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
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

interface CustomizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: ThemeSettings;
  onThemeUpdated: (theme: ThemeSettings) => void;
  currentUser?: AuthUser | null;
  onUpdateCurrentUserPhoto?: (photoUrl: string) => void;
  onUserUpdated?: (user: AuthUser) => void;
}

export const CustomizationModal: React.FC<CustomizationModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onThemeUpdated,
  currentUser,
  onUpdateCurrentUserPhoto,
  onUserUpdated,
}) => {
  const [theme, setTheme] = useState<ThemeSettings>(currentTheme);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState<boolean>(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  // Keep local theme state in sync when opened or changed
  useEffect(() => {
    if (isOpen) {
      setTheme(currentTheme);
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

  if (!isOpen || typeof document === 'undefined') return null;

  // Single atomic updater for one or more fields to prevent closure race conditions
  const updateFields = (partial: Partial<ThemeSettings>) => {
    setTheme((prev) => {
      const updated = { ...prev, ...partial, updatedAt: new Date().toISOString() };
      applyThemeToDOM(updated);
      saveStoredThemeSettings(updated);
      onThemeUpdated(updated);
      return updated;
    });
  };

  const applyPresetBundle = (bundle: typeof PRESET_THEME_BUNDLES[0]) => {
    updateFields(bundle.theme);
  };

  const handleResetDefaults = () => {
    const defaults = { ...DEFAULT_THEME_SETTINGS, updatedAt: new Date().toISOString() };
    setTheme(defaults);
    applyThemeToDOM(defaults);
    saveStoredThemeSettings(defaults);
    onThemeUpdated(defaults);
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Url = event.target?.result as string;
      if (base64Url) {
        updateFields({
          companyLogoUrl: base64Url,
          logoStyle: 'custom_image',
        });
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

  const activeCanvas = CANVAS_THEME_MAP[theme.canvasTheme] || CANVAS_THEME_MAP.navy_dark;
  const isLightMode = activeCanvas.isLight;

  return createPortal(
    <div
      id="customization-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-fadeIn"
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
            <div className="w-9 h-9 rounded-xl bg-[#38bdf8]/15 border border-[#38bdf8]/30 flex items-center justify-center text-[#38bdf8] shadow-sm">
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
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider">
                  Temas Rápidos del Sistema
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                Cambio instantáneo en 1 clic
              </span>
            </div>

            {/* 6 columns responsive theme cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              {PRESET_THEME_BUNDLES.map((bundle) => {
                const isSelected =
                  theme.canvasTheme === bundle.theme.canvasTheme &&
                  theme.accentColor === bundle.theme.accentColor;
                return (
                  <button
                    key={bundle.id}
                    type="button"
                    onClick={() => applyPresetBundle(bundle)}
                    className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between gap-2 cursor-pointer relative group ${
                      isSelected
                        ? 'bg-[#38bdf8]/15 border-[#38bdf8] ring-2 ring-[#38bdf8]/50 shadow-md scale-[1.02]'
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
                      {isSelected && <Check className="w-4 h-4 text-[#38bdf8]" />}
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

          {/* SECTION 2: Foto de Perfil & Avatar del Usuario */}
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
                  className="px-3 py-1.5 rounded-lg bg-[#38bdf8]/15 hover:bg-[#38bdf8]/25 text-[#38bdf8] border border-[#38bdf8]/40 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0"
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
                      className={`p-2 rounded-xl border flex items-center gap-2 text-left transition cursor-pointer hover:scale-[1.02] ${
                        isSelected
                          ? 'bg-[#38bdf8]/20 border-[#38bdf8] ring-2 ring-[#38bdf8]/50 shadow-sm'
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
                      <Palette className="w-3.5 h-3.5 text-[#38bdf8]" />
                      <h3 className="text-[10.5px] font-black uppercase tracking-wider">
                        Color de Fondo (Canvas)
                      </h3>
                    </div>
                    {theme.canvasTheme === 'custom' && (
                      <span className="text-[9px] text-[#38bdf8] font-bold">Personalizado</span>
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
                            className={`p-1.5 rounded-md border text-left flex items-center gap-1.5 transition cursor-pointer ${
                              isSelected
                                ? 'bg-[#38bdf8]/15 border-[#38bdf8] shadow-2xs'
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
                            {isSelected && <Check className="w-2.5 h-2.5 text-[#38bdf8] shrink-0" />}
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
                            className={`p-1.5 rounded-md border text-left flex items-center gap-1.5 transition cursor-pointer ${
                              isSelected
                                ? 'bg-[#38bdf8]/15 border-[#38bdf8]'
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
                            {isSelected && <Check className="w-2.5 h-2.5 text-[#38bdf8] shrink-0" />}
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
                          className={`p-1.5 border text-left flex items-center justify-between transition cursor-pointer ${
                            isSelected
                              ? 'bg-[#38bdf8]/15 border-[#38bdf8]'
                              : isLightMode
                              ? 'bg-slate-100 hover:bg-slate-200 border-slate-200'
                              : 'bg-[#15253d] hover:bg-[#1a2f4c] border-[#334d6e]/70'
                          }`}
                          style={{ borderRadius: item.radius }}
                        >
                          <div>
                            <div className="text-[10px] font-bold leading-tight">{item.name}</div>
                            <span className="text-[8px] text-slate-400">{item.label}</span>
                          </div>
                          {isSelected && <Check className="w-2.5 h-2.5 text-[#38bdf8] shrink-0" />}
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
                    <Type className="w-3.5 h-3.5 text-sky-400" />
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
                          className={`p-1.5 rounded-md border text-left flex items-center justify-between transition cursor-pointer ${
                            isSelected
                              ? 'bg-[#38bdf8]/15 border-[#38bdf8]'
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
                          {isSelected && <Check className="w-2.5 h-2.5 text-[#38bdf8]" />}
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
              className="px-3.5 py-1 rounded-md bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950 text-[10.5px] font-black transition flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
            >
              <Check className="w-3 h-3" />
              <span>Listo</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
