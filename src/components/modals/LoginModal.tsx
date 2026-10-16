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
} from 'lucide-react';
import { AuthUser } from '../../types';
import { authenticateUser } from '../../data/authData';
import { SyDOfficialIsoLogo } from '../common/SyDOfficialIsoLogo';
import { getStoredThemeSettings } from '../../utils/themeStorage';
import { makeImageBackgroundTransparent } from '../../utils/imageTransparencyUtils';

interface LoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: AuthUser) => void;
}

/**
 * Ultra-thin, delicate hairline white contour filter for dark backgrounds.
 * Creates an elegant, barely-visible fine white edge (0.5px) around dark letters and shapes.
 */
export const ULTRA_THIN_WHITE_OUTLINE =
  'drop-shadow(0 0 1.5px rgba(255,255,255,0.95)) drop-shadow(0 0 3px rgba(255,255,255,0.5)) drop-shadow(0 2px 8px rgba(0,0,0,0.55))';

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Custom Logo URL state (configured exclusively in Admin Configuration)
  const [customLogoUrl, setCustomLogoUrl] = useState<string>(() => {
    try {
      const storedLoginLogo = localStorage.getItem('syd_custom_login_logo_url');
      if (storedLoginLogo) return storedLoginLogo;
      const theme = getStoredThemeSettings();
      if (theme?.companyLogoUrl) return theme.companyLogoUrl;
    } catch {}
    return '';
  });

  // Automatically process existing custom logo to ensure white background (including inside "D") is removed cleanly
  useEffect(() => {
    const processStoredLogo = async () => {
      try {
        const storedLoginLogo = localStorage.getItem('syd_custom_login_logo_url');
        if (storedLoginLogo && storedLoginLogo.startsWith('data:image/')) {
          const transparent = await makeImageBackgroundTransparent(storedLoginLogo, 205);
          setCustomLogoUrl(transparent);
          localStorage.setItem('syd_custom_login_logo_url', transparent);
        }
      } catch (err) {
        console.error('Error processing stored logo background:', err);
      }
    };
    processStoredLogo();
  }, []);

  // Read stored preference for subtle white outline
  const hasWhiteOutline = (() => {
    try {
      const stored = localStorage.getItem('syd_logo_white_outline');
      if (stored !== null) return stored === 'true';
    } catch {}
    return true;
  })();

  if (!isOpen) return null;

  const handleLogin = (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    setErrorMsg(null);

    const cleanUsername = (username || '').trim();
    const cleanPassword = (password || '').trim();

    if (!cleanUsername || !cleanPassword) {
      setErrorMsg('Por favor ingrese su usuario y contraseña.');
      return;
    }

    const cleanInput = cleanUsername.toLowerCase();
    if (
      cleanInput === 'papi' ||
      cleanInput === 'hijo' ||
      cleanInput === 'papi@syd.com.co' ||
      cleanInput === 'hijo@syd.com.co'
    ) {
      setErrorMsg('Este usuario ya no existe. El acceso está restringido únicamente a "Jairo" y "Fabian".');
      return;
    }

    setIsLoading(true);

    try {
      const user = authenticateUser(cleanUsername, cleanPassword);
      if (user) {
        setIsLoading(false);
        setUsername('');
        setPassword('');
        onLoginSuccess(user);
      } else {
        setIsLoading(false);
        setErrorMsg('Credenciales incorrectas. Verifique su usuario y contraseña.');
      }
    } catch (err) {
      setIsLoading(false);
      setErrorMsg('Error al verificar credenciales.');
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md bg-[#111c2e] border border-[#334d6e] rounded-3xl shadow-2xl overflow-hidden">
        {/* Header with Pristine Corporate Branding */}
        <div className="p-6 pb-4 bg-gradient-to-br from-[#15253d] to-[#1e314b] border-b border-[#334d6e] text-center relative">
          
          {/* Logo Display Area - Clean, static corporate display without hover artifacts */}
          <div className="rounded-2xl p-2 max-w-[320px] mx-auto mb-3 flex flex-col items-center justify-center select-none">
            {customLogoUrl ? (
              <div className="w-full flex items-center justify-center min-h-[64px]">
                <img
                  src={customLogoUrl}
                  alt="SUMINISTROS Y DOTACIONES DE COLOMBIA S.A.S."
                  style={{
                    filter: hasWhiteOutline ? ULTRA_THIN_WHITE_OUTLINE : 'drop-shadow(0 3px 6px rgba(0,0,0,0.4))',
                  }}
                  className="w-full max-h-20 object-contain pointer-events-none"
                />
              </div>
            ) : (
              <div className="w-full flex items-center justify-center min-h-[64px]">
                <div
                  style={{
                    filter: hasWhiteOutline ? ULTRA_THIN_WHITE_OUTLINE : 'drop-shadow(0 3px 6px rgba(0,0,0,0.4))',
                  }}
                  className="w-full flex items-center justify-center"
                >
                  <SyDOfficialIsoLogo className="w-full h-auto max-h-18" isDarkTheme={true} />
                </div>
              </div>
            )}
          </div>

          <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
            SUMINISTROS Y DOTACIONES DE COLOMBIA S.A.S.
          </h2>
          <p className="text-xs text-[#38bdf8] font-bold tracking-wider uppercase mt-0.5">
            Portal de Acceso Corporativo
          </p>
          <p className="text-xs text-slate-400 mt-1.5">
            Ingrese sus credenciales de usuario y contraseña autorizados para ingresar a la plataforma.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Username Input */}
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
                placeholder="Ingrese su nombre de usuario"
                className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl pl-9 pr-3 py-2.5 text-sm text-white font-medium focus:border-[#38bdf8] focus:ring-2 focus:ring-[#38bdf8]/20 outline-none transition"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">
              Contraseña
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                placeholder="Ingrese su contraseña"
                className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl pl-9 pr-10 py-2.5 text-sm text-white font-medium focus:border-[#38bdf8] focus:ring-2 focus:ring-[#38bdf8]/20 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            id="btn-login-submit"
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-4 rounded-xl text-white font-extrabold text-sm flex items-center justify-center gap-2.5 transition-all duration-200 transform active:scale-95 hover:brightness-110 disabled:opacity-50 cursor-pointer border border-cyan-300/50 relative overflow-hidden group"
            style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 45%, #38bdf8 100%)',
              color: '#ffffff',
              boxShadow: '0 0 30px rgba(56, 189, 248, 0.55), 0 4px 20px rgba(2, 132, 199, 0.5)',
              textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
            }}
          >
            {/* Shimmer light reflection effect */}
            <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/25 to-transparent skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 ease-in-out pointer-events-none" />
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span className="tracking-wide text-sm font-black drop-shadow-xs">Ingresar al Sistema</span>
                <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#0d1522] border-t border-[#334d6e]/50 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sistema Seguro Verificado</span>
          </div>
          <span className="font-mono text-[#38bdf8]">v3.5 Enterprise</span>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
