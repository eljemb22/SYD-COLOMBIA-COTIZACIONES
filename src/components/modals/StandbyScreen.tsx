import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  User,
  ShieldCheck,
  Moon,
  Clock,
  Sparkles,
  LogOut,
  CornerDownLeft,
  CheckCircle2,
  Sliders,
  ChevronRight,
} from 'lucide-react';
import { AuthUser } from '../../types';
import { STANDBY_TIMEOUT_OPTIONS } from '../../hooks/useIdleStandby';

interface StandbyScreenProps {
  isOpen: boolean;
  currentUser?: AuthUser | null;
  onWakeUp: () => void;
  onLogout?: () => void;
  timeoutMinutes?: number;
  onTimeoutChange?: (minutes: number) => void;
}

export const StandbyScreen: React.FC<StandbyScreenProps> = ({
  isOpen,
  currentUser = null,
  onWakeUp,
  onLogout = () => {},
  timeoutMinutes = 15,
  onTimeoutChange = () => {},
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [showConfig, setShowConfig] = useState<boolean>(false);

  // Live real-time clock update while in standby
  useEffect(() => {
    if (!isOpen) return;

    const updateClock = () => {
      const now = new Date();
      // Formatted time: HH:MM:SS am/pm
      setCurrentTime(
        now.toLocaleTimeString('es-CO', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );

      // Formatted date in Spanish: "Jueves, 24 de septiembre de 2026"
      const dateStr = now.toLocaleDateString('es-CO', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
      // Capitalize first letter
      setCurrentDate(dateStr.charAt(0).toUpperCase() + dateStr.slice(1));
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      id="app-standby-screen"
      onClick={(e) => {
        // If clicking the backdrop outside of config buttons, resume session smoothly
        const target = e.target as HTMLElement;
        if (!target.closest('button') && !target.closest('select')) {
          onWakeUp();
        }
      }}
      className="fixed inset-0 z-[99999] flex flex-col justify-between p-6 sm:p-10 bg-[#060b14]/95 backdrop-blur-2xl text-white select-none animate-fadeIn cursor-pointer"
    >
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-sky-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Top Header: Company Branding + Standby Pill */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-slate-950 shadow-lg shadow-sky-500/20 shrink-0">
            <Building2 className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-black tracking-tight text-white leading-tight">
              SUMINISTROS Y DOTACIONES DE COLOMBIA
            </h1>
            <p className="text-[10px] sm:text-xs text-sky-400 font-bold uppercase tracking-wider">
              Sistema de Cotizaciones & Licitaciones
            </p>
          </div>
        </div>

        {/* Standby Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-slate-700/80 shadow-md">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300">
            <Moon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Modo Suspensión / Standby</span>
            <span className="sm:hidden">Standby</span>
          </div>
        </div>
      </div>

      {/* Center Hero: Clock + Safe Session Card + Primary Wake Prompt */}
      <div className="w-full max-w-xl mx-auto flex flex-col items-center text-center my-auto py-6 relative z-10">
        {/* Large Digital Clock */}
        <div className="mb-6">
          <div className="text-5xl sm:text-7xl font-mono font-black tracking-tight text-white drop-shadow-md">
            {currentTime || '--:--:--'}
          </div>
          <div className="text-xs sm:text-sm text-slate-400 font-medium mt-1 flex items-center justify-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>{currentDate || 'Cargando fecha...'}</span>
          </div>
        </div>

        {/* User Session Safe Card */}
        {currentUser && (
          <div className="w-full bg-slate-900/90 border border-slate-700/80 rounded-2xl p-4 sm:p-5 shadow-2xl mb-8 backdrop-blur-md text-left">
            <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-11 h-11 rounded-xl overflow-hidden flex items-center justify-center text-white text-base font-black shadow-md shrink-0 border border-white/10 ${
                    currentUser.avatarPhotoUrl
                      ? 'bg-slate-950'
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
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-white truncate">{currentUser.name}</h3>
                    <span className="text-xs text-slate-400 font-mono">(@{currentUser.username})</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                        currentUser.role === 'admin'
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                          : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                      }`}
                    >
                      {currentUser.role === 'admin' ? '👑 Administrador' : '💼 Usuario Registrado'}
                    </span>
                    <span className="text-[10px] text-slate-400">• {currentUser.department}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sesión Activa</span>
              </div>
            </div>

            {/* Reassurance text */}
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-emerald-400 font-semibold">Toda su información está protegida:</strong> Las cotizaciones en borrador, tablas y ventanas permanecen exactamente donde las dejó. Ningún dato se ha cerrado ni borrado.
            </p>
          </div>
        )}

        {/* Primary Interactive Call To Action */}
        <div className="w-full flex flex-col items-center gap-3">
          <button
            id="btn-wake-up-standby"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onWakeUp();
            }}
            className="group w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-sm sm:text-base rounded-2xl shadow-xl shadow-sky-500/30 hover:shadow-sky-500/50 transition-all flex items-center justify-center gap-3 cursor-pointer active:scale-95 border border-sky-300/40"
          >
            <span>Reanudar Sesión</span>
            <kbd className="px-2 py-0.5 text-xs font-mono font-bold bg-white/20 text-white border border-white/40 rounded-md flex items-center gap-1 group-hover:bg-white/30 shadow-xs">
              <span>ENTER</span>
              <CornerDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            </kbd>
          </button>

          <p className="text-xs text-slate-400 font-medium animate-pulse flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Presione <strong>Enter</strong> o haga clic en cualquier parte para continuar</span>
          </p>
        </div>
      </div>

      {/* Bottom Footer: Options & Logout */}
      <div className="w-full max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800/80 text-xs text-slate-400 relative z-10">
        <div className="flex items-center gap-2">
          <span>Tiempo de suspensión automática:</span>
          <select
            value={timeoutMinutes}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              e.stopPropagation();
              onTimeoutChange(parseInt(e.target.value, 10));
            }}
            className="bg-slate-900 border border-slate-700 text-sky-300 font-bold text-xs rounded-lg px-2.5 py-1 outline-none focus:border-sky-400 cursor-pointer"
          >
            {STANDBY_TIMEOUT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[11px] text-slate-500 hidden md:inline">
            Atajo para suspender: <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-slate-300">Ctrl + L</kbd> o <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-mono text-slate-300">Alt + S</kbd>
          </span>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onLogout();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
            title="Cerrar la sesión actual para ingresar con otro usuario"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
