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

export const ULTRA_THIN_WHITE_OUTLINE =
  'drop-shadow(0 0 1.5px rgba(255,255,255,0.95)) drop-shadow(0 0 3px rgba(255,255,255,0.5)) drop-shadow(0 2px 8px rgba(0,0,0,0.55))';

const LOGO_SRC = '/logos/syd_login_logo.png';

export const LoginModal: React.FC<{ isOpen: boolean; onLoginSuccess: (user: AuthUser) => void; onClose?: () => void }> = ({ isOpen, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [phase, setPhase] = useState<'draw' | 'exit' | 'ready'>('draw');

  useEffect(() => {
    if (!isOpen) return;
    setPhase('draw');
    const tExit = setTimeout(() => setPhase('exit'), 1800);
    const tReady = setTimeout(() => setPhase('ready'), 2250);
    return () => {
      clearTimeout(tExit);
      clearTimeout(tReady);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

  // Fase de bienvenida: el logo emerge con un brillo que recorre su silueta
  if (phase !== 'ready') {
    return createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#050b18] via-[#0a1324] to-[#1a1033]">
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-cyan-500/20 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-indigo-500/25 blur-[120px] animate-pulse" style={{ animationDelay: '1.5s' }} />

        <div
          className={`relative flex flex-col items-center px-6 ${
            phase === 'exit' ? 'animate-introExit' : ''
          }`}
        >
          <div className="relative w-80 h-80 sm:w-96 sm:h-96">
            {/* Halo que respira detrás del logo */}
            <div className="absolute inset-8 rounded-full bg-cyan-400/30 blur-[90px] animate-introGlow" />
            <div className="absolute inset-16 rounded-full bg-indigo-400/25 blur-[70px] animate-introGlow" style={{ animationDelay: '1.2s' }} />

            {/* Logo que emerge desde el desenfoque */}
            <img
              src={LOGO_SRC}
              alt="SYD"
              className="relative w-full h-full object-contain animate-logoReveal"
            />

            {/* Destello que recorre el logo, recortado a su propia silueta */}
            <div
              className="absolute inset-0 pointer-events-none animate-logoShine"
              style={{
                background:
                  'linear-gradient(105deg, transparent 36%, rgba(255,255,255,0.9) 48%, rgba(165,243,252,0.75) 55%, transparent 68%)',
                WebkitMaskImage: `url(${LOGO_SRC})`,
                maskImage: `url(${LOGO_SRC})`,
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center',
              }}
            />
          </div>

          <p className="animate-introTextUp mt-6 text-center text-sm sm:text-base text-white uppercase font-black drop-shadow-[0_0_18px_rgba(56,189,248,0.55)]">
            Suministros y Dotaciones de Colombia
          </p>
          <p
            className="mt-3 text-center text-[10px] sm:text-[11px] text-cyan-200/75 font-semibold uppercase tracking-[0.32em] animate-fadeIn"
            style={{ animationDelay: '0.85s' }}
          >
            Sistema de Cotizaciones y Licitaciones
          </p>

          {/* Barra de carga sutil */}
          <div className="mt-7 h-[2px] w-40 rounded-full bg-white/10 overflow-hidden">
            <div className="animate-progressFill h-full w-full bg-gradient-to-r from-cyan-300 via-sky-400 to-indigo-400" />
          </div>
        </div>
      </div>,
      document.body
    );
  }

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden animate-fadeIn" style={{ animationDuration: '0.6s' }}>
      <div className="absolute inset-0 bg-gradient-to-br from-[#050b18] via-[#0a1324] to-[#1a1033]">
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full bg-cyan-500/20 blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60vw] h-[60vw] rounded-full bg-indigo-500/25 blur-[120px] animate-pulse" style={{ animationDelay: '1.5s' }} />
      </div>

      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="absolute w-1 h-1 rounded-full bg-cyan-300/60 animate-float"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 100}%`,
              animationDelay: `${(i * 0.3) % 3}s`,
              animationDuration: `${3 + (i % 4)}s`,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-md animate-loginCardIn">
        <div className="relative rounded-[32px] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.7)]">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.08] via-white/[0.03] to-transparent backdrop-blur-3xl" />

          <div className="relative px-8 pt-5 pb-2 text-center">
            <div className="mx-auto mb-3 w-80 h-auto max-h-80 flex items-center justify-center animate-float">
              <img
                src={LOGO_SRC}
                alt="SUMINISTROS Y DOTACIONES DE COLOMBIA S.A.S."
                style={{
                  filter: 'drop-shadow(0 0 60px rgba(56,189,248,0.8))',
                }}
                className="w-full h-auto object-contain"
              />
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight bg-gradient-to-r from-white via-cyan-200 to-indigo-200 bg-clip-text text-transparent">
              SUMINISTROS Y DOTACIONES
            </h1>
            <p className="text-sm font-bold text-cyan-300 tracking-[0.25em] uppercase mt-1">
              DE COLOMBIA S.A.S.
            </p>
            <p className="text-xs text-slate-300/80 mt-3 font-medium">
              Portal de Acceso Corporativo
            </p>
          </div>

          <form onSubmit={handleLogin} className="relative px-8 pb-6 space-y-3">
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-rose-500/15 border border-rose-400/40 text-rose-200 text-xs font-semibold animate-shake backdrop-blur-md">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-300" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Usuario o Correo Institucional
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-cyan-300 transition">
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
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm text-white font-medium placeholder-slate-400 outline-none transition-all duration-300 focus:bg-white/10 focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/15 focus:shadow-[0_0_24px_rgba(56,189,248,0.25)]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                Contraseña
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-cyan-300 transition">
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
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-12 py-3 text-sm text-white font-medium placeholder-slate-400 outline-none transition-all duration-300 focus:bg-white/10 focus:border-cyan-400/60 focus:ring-4 focus:ring-cyan-400/15 focus:shadow-[0_0_24px_rgba(56,189,248,0.25)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-cyan-300 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={isLoading}
              className="group relative w-full mt-2 py-3.5 px-4 rounded-2xl text-white font-black text-sm flex items-center justify-center gap-2.5 overflow-hidden transition-all duration-300 transform active:scale-[0.97] disabled:opacity-50 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #06b6d4 0%, #3b82f6 50%, #6366f1 100%)',
                boxShadow: '0 10px 30px rgba(59, 130, 246, 0.4), 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.25)',
              }}
            >
              <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 ease-in-out pointer-events-none" />
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span className="tracking-wide text-sm font-black drop-shadow-md">Ingresar al Sistema</span>
                  <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1.5 transition-transform duration-300" />
                </>
              )}
            </button>
          </form>

          <div className="relative px-8 py-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400 bg-white/[0.02]">
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sistema Seguro Verificado</span>
            </div>
            <span className="font-mono text-cyan-300">v3.5 Enterprise</span>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};