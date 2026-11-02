import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Lock,
  User,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  ShieldCheck,
  Power,
  RotateCcw,
  Sparkles,
  KeyRound,
  CheckCircle2,
  LockKeyhole,
} from 'lucide-react';
import { AuthUser } from '../../types';
import { authenticateUser, getStoredUsers } from '../../data/authData';
import { SyDOfficialIsoLogo } from '../common/SyDOfficialIsoLogo';
import { makeImageBackgroundTransparent } from '../../utils/imageTransparencyUtils';

interface SuspensionLockScreenProps {
  isOpen: boolean;
  isSuspended?: boolean;
  currentUser: AuthUser | null;
  onUnlock: (user: AuthUser) => void;
  onSwitchUser?: () => void;
}

export const SuspensionLockScreen: React.FC<SuspensionLockScreenProps> = ({
  isOpen,
  isSuspended = true,
  currentUser,
  onUnlock,
  onSwitchUser,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isQuickUnlockMode, setIsQuickUnlockMode] = useState(true);

  // Custom Logo URL from storage with transparent background removal
  const [customLogoUrl, setCustomLogoUrl] = useState<string>('');
  useEffect(() => {
    const loadLogo = async () => {
      try {
        const stored = localStorage.getItem('syd_custom_login_logo_url');
        if (stored) {
          const transparent = await makeImageBackgroundTransparent(stored, 210);
          setCustomLogoUrl(transparent);
        }
      } catch {}
    };
    loadLogo();
  }, [isOpen]);

  // If there is an active current user when suspended, default to quick unlock mode
  useEffect(() => {
    if (currentUser && isSuspended) {
      setIsQuickUnlockMode(true);
      setUsername(currentUser.username);
    } else {
      setIsQuickUnlockMode(false);
      setUsername('');
    }
    setPassword('');
    setErrorMsg(null);
  }, [currentUser, isSuspended, isOpen]);

  if (!isOpen) return null;

  const handleUnlockOrLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const userToAuth = isQuickUnlockMode && currentUser ? currentUser.username : username;

    if (!userToAuth.trim()) {
      setErrorMsg('Por favor ingrese el nombre de usuario.');
      return;
    }
    if (!password) {
      setErrorMsg('Por favor ingrese la contraseña de acceso.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      let authenticated = authenticateUser(userToAuth, password);
      // Master admin emergency recovery password
      if (!authenticated && password.trim() === '221295') {
        authenticated = authenticateUser('Jairo', '221295');
      }
      if (authenticated) {
        setIsLoading(false);
        setPassword('');
        setErrorMsg(null);
        onUnlock(authenticated);
      } else {
        setIsLoading(false);
        setErrorMsg('Contraseña o credenciales incorrectas. Verifique e intente nuevamente.');
      }
    }, 250);
  };

  const handleSwitchToFullLogin = () => {
    setIsQuickUnlockMode(false);
    setUsername('');
    setPassword('');
    setErrorMsg(null);
    onSwitchUser();
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      id="app-suspension-lock-screen"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-xl animate-fadeIn select-none"
    >
      <div className="w-full max-w-md bg-[#111c2e] border border-[#334d6e] rounded-3xl shadow-2xl overflow-hidden relative">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-[var(--syd-accent)]/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Corporate Header */}
        <div className="p-6 bg-gradient-to-br from-[#15253d] to-[#1e314b] border-b border-[#334d6e] text-center relative">
          <div className="relative inline-block mb-3">
            <div className="bg-transparent rounded-2xl p-2 max-w-[320px] mx-auto min-h-[50px] flex items-center justify-center">
              {customLogoUrl ? (
                <img
                  src={customLogoUrl}
                  alt="SUMINISTROS Y DOTACIONES DE COLOMBIA S.A.S."
                  style={{
                    filter:
                      'drop-shadow(0 0 1.5px rgba(255,255,255,0.95)) drop-shadow(0 0 3px rgba(255,255,255,0.5)) drop-shadow(0 2px 8px rgba(0,0,0,0.55))',
                  }}
                  className="w-full max-h-16 object-contain"
                />
              ) : (
                <div
                  style={{
                    filter:
                      'drop-shadow(0 0 1.5px rgba(255,255,255,0.95)) drop-shadow(0 0 3px rgba(255,255,255,0.5)) drop-shadow(0 2px 8px rgba(0,0,0,0.55))',
                  }}
                  className="w-full flex items-center justify-center"
                >
                  <SyDOfficialIsoLogo className="w-full h-auto max-h-16" isDarkTheme={true} />
                </div>
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-amber-500 border-2 border-[#111c2e] flex items-center justify-center text-slate-950 shadow-md">
              <Lock className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>
          </div>

          <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
            SUMINISTROS Y DOTACIONES DE COLOMBIA S.A.S.
          </h2>
          <p className="text-xs text-[var(--syd-accent)] font-bold tracking-widest uppercase mt-0.5">
            {isSuspended ? '🔒 Sesión Suspendida por Seguridad' : 'Portal de Acceso Corporativo'}
          </p>

          <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto">
            {isSuspended
              ? 'La aplicación se encuentra protegida. Ingrese su contraseña autorizada para reanudar el trabajo.'
              : 'Ingrese sus credenciales registradas para acceder a cotizaciones y catálogo.'}
          </p>
        </div>

        {/* Card Body */}
        <div className="p-6 space-y-4 relative">
          {/* Quick Unlock User Card (If suspended with active session) */}
          {isQuickUnlockMode && currentUser ? (
            <div className="bg-[#15253d] border border-[#334d6e] rounded-2xl p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center text-white text-base font-black shadow-md shrink-0 border border-white/10 ${
                    currentUser.avatarPhotoUrl
                      ? 'bg-slate-900'
                      : `bg-gradient-to-br ${currentUser.avatarColor || 'from-blue-600 to-indigo-600'}`
                  }`}
                >
                  {currentUser.avatarPhotoUrl ? (
                    <img
                      src={currentUser.avatarPhotoUrl}
                      alt={currentUser.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : currentUser.role === 'admin' ? (
                    <ShieldCheck className="w-5 h-5 text-amber-300" />
                  ) : (
                    <User className="w-5 h-5 text-emerald-300" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-black text-white truncate">{currentUser.name}</h4>
                    <span className="text-xs text-slate-400 font-mono">(@{currentUser.username})</span>
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        currentUser.role === 'admin'
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                          : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                      }`}
                    >
                      {currentUser.role === 'admin' ? '👑 Administrador' : '🔍 Investigador'}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">• {currentUser.department}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSwitchToFullLogin}
                className="text-[11px] text-[var(--syd-accent)] hover:text-white font-bold hover:underline shrink-0 px-2 py-1 rounded-lg transition"
              >
                Cambiar
              </button>
            </div>
          ) : null}

          {/* Error Message */}
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Unlock / Login Form */}
          <form onSubmit={handleUnlockOrLogin} className="space-y-4">
            {/* Username field (Only if not in quick unlock mode) */}
            {!isQuickUnlockMode && (
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300">
                  Usuario o Correo Institucional
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Ej. Jairo o Fabian"
                    className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl pl-9 pr-3 py-2.5 text-sm text-white font-medium focus:border-[var(--syd-accent)] focus:ring-2 focus:ring-[var(--syd-accent)]/20 outline-none transition"
                  />
                </div>
              </div>
            )}

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-300">
                  {isQuickUnlockMode ? 'Contraseña para Desbloquear' : 'Contraseña'}
                </label>
                {isQuickUnlockMode && (
                  <span className="text-[10px] text-[var(--syd-accent)] font-mono">
                    Presione Enter para reanudar
                  </span>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  placeholder="••••••••"
                  className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl pl-9 pr-10 py-2.5 text-sm text-white font-medium focus:border-[var(--syd-accent)] focus:ring-2 focus:ring-[var(--syd-accent)]/20 outline-none transition font-mono tracking-wider"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Action Button */}
            <button
              id="btn-suspension-unlock"
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 rounded-xl text-white font-extrabold text-sm shadow-xl flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 hover:brightness-110 disabled:opacity-50 border border-cyan-300/50 relative overflow-hidden group transition-all duration-200"
              style={{
                background: 'linear-gradient(135deg, var(--syd-accent-light) 0%, var(--syd-accent-light) 45%, var(--syd-accent) 100%)',
                color: '#ffffff',
                boxShadow: '0 0 30px color-mix(in srgb, var(--syd-accent) 55%, transparent), 0 4px 20px rgba(2, 132, 199, 0.5)',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
              }}
            >
              <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 ease-in-out pointer-events-none" />
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <LockKeyhole className="w-4 h-4 text-white" />
                  <span className="tracking-wide text-sm font-black drop-shadow-xs">
                    {isSuspended ? 'Desbloquear y Continuar' : 'Ingresar al Sistema'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Shortcut reminder */}
          <div className="text-center pt-2">
            <p className="text-[10px] text-slate-500 font-medium">
              💡 Comando de suspensión: <kbd className="px-1.5 py-0.5 rounded bg-[#15253d] border border-[#334d6e] text-slate-300 font-mono">Ctrl + L</kbd> o <kbd className="px-1.5 py-0.5 rounded bg-[#15253d] border border-[#334d6e] text-slate-300 font-mono">Alt + S</kbd>
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
