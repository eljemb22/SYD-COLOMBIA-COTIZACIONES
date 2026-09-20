import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
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

interface LoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    const cleanInput = (username || '').trim().toLowerCase();
    if (cleanInput === 'papi' || cleanInput === 'hijo' || cleanInput === 'papi@syd.com.co' || cleanInput === 'hijo@syd.com.co') {
      setTimeout(() => {
        setIsLoading(false);
        setErrorMsg('Este usuario ya no existe. El acceso está restringido únicamente a "Jairo" y "Fabian".');
      }, 300);
      return;
    }

    setTimeout(() => {
      const user = authenticateUser(username, password);
      if (user) {
        setIsLoading(false);
        setUsername('');
        setPassword('');
        onLoginSuccess(user);
      } else {
        setIsLoading(false);
        setErrorMsg('Credenciales incorrectas. Verifique su usuario y contraseña.');
      }
    }, 300);
  };

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="w-full max-w-md bg-[#111c2e] border border-[#334d6e] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header with Corporate Branding */}
        <div className="p-6 bg-gradient-to-br from-[#15253d] to-[#1e314b] border-b border-[#334d6e] text-center relative">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#38bdf8] to-[#0284c7] flex items-center justify-center text-slate-950 shadow-lg shadow-[#38bdf8]/20 mb-3">
            <Building2 className="w-8 h-8" />
          </div>
          <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
            SUMINISTROS Y DOTACIONES DE COLOMBIA S.A.S.
          </h2>
          <p className="text-xs text-[#38bdf8] font-bold tracking-wider uppercase mt-0.5">
            Portal de Acceso Corporativo
          </p>
          <p className="text-xs text-slate-400 mt-2">
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
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white transition cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#0284c7] to-[#38bdf8] hover:from-[#0369a1] hover:to-[#0284c7] text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#38bdf8]/20 transition cursor-pointer active:scale-98 disabled:opacity-50"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Shield className="w-4 h-4" />
                <span>Ingresar al Sistema</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );

  if (typeof document !== 'undefined' && document.body) {
    return createPortal(modalContent, document.body);
  }
  return modalContent;
};
