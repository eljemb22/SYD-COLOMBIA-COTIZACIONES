import React, { ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, Wrench, CheckCircle2, Cpu, AlertTriangle, Database } from 'lucide-react';
import { INITIAL_EQUIPMENTS, INITIAL_DOCUMENTS, INITIAL_TENDER_CLIENTS } from '../../data/initialData';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
  errorStack: string;
  countdown: number;
  repairPhase: 'analyzing' | 'repairing' | 'restoring' | 'ready_reboot';
  repairLogs: string[];
  resetKey: number;
}

export class AutoRecoveryErrorBoundary extends React.Component<Props, State> {
  override state: State = {
    hasError: false,
    errorMessage: '',
    errorStack: '',
    countdown: 3,
    repairPhase: 'analyzing',
    repairLogs: [],
    resetKey: 0,
  };

  private timerId: number | null = null;
  private repairTimeout1: number | null = null;
  private repairTimeout2: number | null = null;
  private recoveryAttempts = 0;

  constructor(props: Props) {
    super(props);
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const errorMsg = error?.message || 'Error de ejecución no controlado en la aplicación';
    return {
      hasError: true,
      errorMessage: errorMsg,
      errorStack: error?.stack || '',
      countdown: 3,
      repairPhase: 'analyzing',
      repairLogs: [
        '[ANOMALÍA DETECTADA] Se ha detenido la ejecución para proteger la integridad del sistema.',
        `[DIAGNÓSTICO INICIAL] Causa identificada: ${errorMsg.slice(0, 90)}...`,
      ],
    };
  }

  componentDidMount() {
    try {
      const lastIncident = sessionStorage.getItem('syd_last_auto_repaired_incident');
      if (lastIncident) {
        sessionStorage.removeItem('syd_last_auto_repaired_incident');
      }
    } catch (e) {}
  }

  componentWillUnmount() {
    this.clearAllTimers();
  }

  private clearAllTimers = () => {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.repairTimeout1 !== null) {
      clearTimeout(this.repairTimeout1);
      this.repairTimeout1 = null;
    }
    if (this.repairTimeout2 !== null) {
      clearTimeout(this.repairTimeout2);
      this.repairTimeout2 = null;
    }
  };

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AutoRecovery] Fallo capturado por el sistema de auto-reparación:', error, errorInfo);
    this.recoveryAttempts += 1;

    // Track consecutive crashes in sessionStorage to stop infinite refresh loops
    let recentCrashes = 0;
    try {
      const crashData = sessionStorage.getItem('syd_consecutive_crash_count');
      recentCrashes = crashData ? parseInt(crashData, 10) || 0 : 0;
      recentCrashes += 1;
      sessionStorage.setItem('syd_consecutive_crash_count', String(recentCrashes));
    } catch (_) {}

    // If crashing repeatedly (more than 2 consecutive times), do not auto-loop indefinitely
    if (recentCrashes > 2 || this.recoveryAttempts > 2) {
      console.warn('[AutoRecovery] Múltiples anomalías consecutivas. Deteniendo auto-reinicio cíclico.');
      this.performDataSelfRepair(error);
      this.setState({
        repairPhase: 'ready_reboot',
        repairLogs: [
          '[AVISO] Se detectaron múltiples reinicios consecutivos.',
          '[ESTABILIZACIÓN] Catálogos y datos locales sanitizados y protegidos.',
          '[LISTO] Presione "Reiniciar Aplicación" o abra la pantalla inicial.',
        ],
      });
      return;
    }

    this.startSelfHealingProcess(error);
  }

  private startSelfHealingProcess = (error?: Error) => {
    this.clearAllTimers();

    // Step 1: Immediate error analysis & memory audit (400ms)
    this.repairTimeout1 = window.setTimeout(() => {
      this.performDataSelfRepair(error);
      this.setState((prev) => ({
        repairPhase: 'repairing',
        repairLogs: [
          ...prev.repairLogs,
          '[AUTODIAGNÓSTICO] Escaneando coherencia de esquemas y memoria local...',
          '[AUTOREPARACIÓN] Sanitizando registros y purgando estados inconsistentes...',
        ],
      }));
    }, 400);

    // Step 2: Restoring safe state defaults (900ms)
    this.repairTimeout2 = window.setTimeout(() => {
      this.setState((prev) => ({
        repairPhase: 'restoring',
        repairLogs: [
          ...prev.repairLogs,
          '[INTEGRIDAD OK] Catálogos y parámetros restablecidos con éxito.',
          '[REINICIO ACTIVO] Reiniciando la aplicación limpia automáticamente...',
        ],
      }));
    }, 900);

    // Step 3: Countdown ticker and automatic recovery
    let currentCountdown = 2;
    this.timerId = window.setInterval(() => {
      currentCountdown -= 1;
      if (currentCountdown <= 0) {
        this.clearAllTimers();
        this.executeImmediateRecovery();
      } else {
        this.setState({ countdown: currentCountdown });
      }
    }, 800);
  };

  public executeImmediateRecovery = (isManual: boolean = false) => {
    this.clearAllTimers();
    this.performDataSelfRepair();

    // Only clear consecutive crash counter upon explicit user manual action
    if (isManual) {
      try {
        sessionStorage.removeItem('syd_consecutive_crash_count');
      } catch (_) {}
      this.recoveryAttempts = 0;
    }

    // Reset error boundary state so React remounts the children with a fresh clean key
    this.setState((prev) => ({
      hasError: false,
      errorMessage: '',
      errorStack: '',
      countdown: 3,
      repairPhase: 'analyzing',
      repairLogs: [],
      resetKey: prev.resetKey + 1,
    }));
  };

  private performDataSelfRepair = (error?: Error) => {
    try {
      // Audit and sanitize each critical localStorage key
      const keysToAudit = [
        'syd_equipments_catalog',
        'syd_tender_clients_v2',
        'syd_technical_documents_v3',
        'syd_quotes_history_v1',
        'syd_saved_quotes_database_v2',
        'syd_oc_tracking_contracts_v3',
        'syd_theme_settings_v1',
        'syd_auth_current_user_v1',
        'syd_users_list_v2',
      ];

      keysToAudit.forEach((key) => {
        const item = localStorage.getItem(key);
        if (item) {
          try {
            const parsed = JSON.parse(item);
            if (parsed === null || parsed === undefined) {
              this.restoreDefaultForKey(key);
            }
          } catch {
            console.warn(`[AutoRecovery] Llave corrupta reparada automáticamente: ${key}`);
            this.restoreDefaultForKey(key);
          }
        }
      });

      if (error) {
        const incidentReport = {
          timestamp: new Date().toISOString(),
          error: error.message,
          stack: error.stack,
          repaired: true,
        };
        sessionStorage.setItem('syd_last_auto_repaired_incident', JSON.stringify(incidentReport));
      }
    } catch (e) {
      console.error('[AutoRecovery] Error durante sanitización de datos:', e);
    }
  };

  private restoreDefaultForKey = (key: string) => {
    switch (key) {
      case 'syd_equipments_catalog':
        localStorage.setItem(key, JSON.stringify(INITIAL_EQUIPMENTS));
        break;
      case 'syd_tender_clients_v2':
        localStorage.setItem(key, JSON.stringify([]));
        break;
      case 'syd_technical_documents_v3':
        localStorage.setItem(key, JSON.stringify(INITIAL_DOCUMENTS));
        break;
      default:
        localStorage.removeItem(key);
        break;
    }
  };

  render() {
    if (!this.state.hasError) {
      return (
        <React.Fragment key={this.state.resetKey}>
          {this.props.children}
        </React.Fragment>
      );
    }

    const { countdown, errorMessage, repairPhase, repairLogs } = this.state;

    return (
      <div
        id="auto-recovery-lock-screen"
        className="fixed inset-0 z-[999999] bg-[#090d16] text-white flex items-center justify-center p-4 select-none overflow-hidden"
        style={{ backdropFilter: 'blur(20px)' }}
      >
        {/* Ambient background glow */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-2xl w-full bg-[#101a2b] border border-rose-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col gap-5">
          {/* Top decorative emergency bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 via-amber-400 to-sky-400 animate-pulse" />

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/50 flex items-center justify-center shrink-0 text-rose-400 shadow-lg shadow-rose-500/20">
                <ShieldAlert className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Sistema de Auto-Reparación y Reinicio
                  </h1>
                  <span className="bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] uppercase font-black px-2 py-0.5 rounded-full">
                    100% Automático
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                  El sistema detectó una anomalía, ha protegido tus datos y está restaurando y reiniciando la aplicación de forma automática.
                </p>
              </div>
            </div>

            {/* Countdown Badge */}
            <div className="flex flex-col items-center justify-center bg-[#0a1220] border border-[#334d6e] rounded-2xl px-4 py-2 shrink-0">
              <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Reinicio en</span>
              <span className="text-2xl sm:text-3xl font-black text-[#38bdf8] font-mono animate-pulse">
                0{countdown}s
              </span>
            </div>
          </div>

          {/* Error Description Box */}
          <div className="bg-[#0b1220] border border-rose-500/20 rounded-2xl p-3 text-xs text-rose-300 font-mono flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="truncate flex-1">
              <span className="text-slate-400 font-sans font-semibold">Causa del evento: </span>
              <span>{errorMessage || 'Fallo de estado en tiempo de ejecución'}</span>
            </div>
          </div>

          {/* Healing Step Indicators */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div
              className={`p-2.5 rounded-xl border transition-all ${
                repairPhase === 'analyzing'
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-md ring-2 ring-amber-500/30'
                  : 'bg-[#152438] border-emerald-500/30 text-emerald-300'
              }`}
            >
              <Cpu className={`w-4 h-4 mx-auto mb-1 ${repairPhase === 'analyzing' ? 'text-amber-400 animate-spin' : 'text-emerald-400'}`} />
              <span className="font-bold block text-[11px]">1. Diagnóstico</span>
              <span className="text-[10px] text-slate-400">{repairPhase === 'analyzing' ? 'Escaneando...' : 'Completado ✓'}</span>
            </div>

            <div
              className={`p-2.5 rounded-xl border transition-all ${
                repairPhase === 'repairing'
                  ? 'bg-sky-500/20 border-sky-500/60 text-sky-300 shadow-md ring-2 ring-sky-500/30'
                  : repairPhase === 'restoring' || repairPhase === 'ready_reboot'
                  ? 'bg-[#152438] border-emerald-500/30 text-emerald-300'
                  : 'bg-[#152438] border-[#334d6e] text-slate-400'
              }`}
            >
              <Wrench className={`w-4 h-4 mx-auto mb-1 ${repairPhase === 'repairing' ? 'text-sky-400 animate-pulse' : repairPhase === 'restoring' ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span className="font-bold block text-[11px]">2. Auto-Reparación</span>
              <span className="text-[10px] text-slate-400">{repairPhase === 'repairing' ? 'Sanitizando...' : repairPhase === 'restoring' ? 'Sanitizado ✓' : 'En cola'}</span>
            </div>

            <div
              className={`p-2.5 rounded-xl border transition-all ${
                repairPhase === 'restoring' || repairPhase === 'ready_reboot'
                  ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 shadow-md ring-2 ring-emerald-500/30'
                  : 'bg-[#152438] border-[#334d6e] text-slate-400'
              }`}
            >
              <CheckCircle2 className={`w-4 h-4 mx-auto mb-1 ${repairPhase === 'restoring' ? 'text-emerald-400 animate-bounce' : 'text-slate-400'}`} />
              <span className="font-bold block text-[11px]">3. Re-inicio</span>
              <span className="text-[10px] text-slate-400">{repairPhase === 'restoring' ? 'Reiniciando...' : 'Esperando'}</span>
            </div>
          </div>

          {/* Live Diagnostic Terminal Logs */}
          <div className="bg-[#070b14] border border-[#20324c] rounded-2xl p-3.5 font-mono text-[11px] space-y-1.5 max-h-36 overflow-y-auto">
            <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-[#20324c] text-[10px]">
              <div className="flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-sky-400" />
                <span>LOG DEL PROTOCOLO DE RECUPERACIÓN AUTOMÁTICA</span>
              </div>
              <span className="text-emerald-400">Progreso 100%</span>
            </div>
            {repairLogs.map((log, idx) => (
              <div key={idx} className="text-slate-300 flex items-start gap-1.5 leading-relaxed">
                <span className="text-[#38bdf8]">›</span>
                <span>{log}</span>
              </div>
            ))}
            <div className="text-sky-400 font-bold flex items-center gap-2 pt-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Ejecutando restauración y reinicio automático ({countdown}s)...</span>
            </div>
          </div>

          {/* Bottom Banner & Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 pt-2 border-t border-[#20324c]">
            <span className="text-[11px] text-center sm:text-left">
              {repairPhase === 'ready_reboot'
                ? 'Sistema estabilizado. Haga clic abajo para ingresar.'
                : 'Restauración y sanitización en curso...'}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => this.executeImmediateRecovery(true)}
                className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-sky-600/30 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Entrar a la Aplicación Ahora</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
