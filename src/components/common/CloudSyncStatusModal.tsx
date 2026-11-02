import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Cloud,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  Smartphone,
  Share2,
  X,
  Database,
  Mail,
  Send,
  ExternalLink,
  QrCode,
  Info,
  Monitor,
  Download,
  ShieldCheck,
  Zap,
  Terminal,
  FileCode,
  Laptop,
  Server,
  Play,
} from 'lucide-react';
import { SyncConnectionStatus } from '../../services/realtimeSync';
import { isDesktopRuntime } from '../../services/desktopOAuth';
import {
  getPublicShareAppUrl,
  getPublishedStudioAppUrl,
  getCloudRunShareAppUrl,
  getAppQrCodeUrl,
  generateLocalhostBatScript,
  generateLocalhostHtmlFile,
} from '../../utils/appUrlHelper';

interface CloudSyncStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: SyncConnectionStatus;
  stats: {
    quotesCount: number;
    equipmentsCount: number;
    tendersCount: number;
    ocContractsCount: number;
    documentsCount: number;
  };
  onForceSync?: () => void;
  onSendBackupNow?: () => Promise<{ success: boolean; message: string }>;
}

export const CloudSyncStatusModal: React.FC<CloudSyncStatusModalProps> = ({
  isOpen,
  onClose,
  syncStatus,
  stats,
  onForceSync,
  onSendBackupNow,
}) => {
  const [copiedPublic, setCopiedPublic] = useState(false);
  const [copiedStudio, setCopiedStudio] = useState(false);
  const [copiedCloudRun, setCopiedCloudRun] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState<boolean>(false);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);
  const [showLocalhostSection, setShowLocalhostSection] = useState<boolean>(true);
  const [showBatCode, setShowBatCode] = useState<boolean>(false);

  // En escritorio no se muestran URLs ni instaladores de navegador: la app ya
  // es un ejecutable y la sincronizacion se activa conectando Google.
  const isDesktop = isDesktopRuntime();

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsAppInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult?.outcome === 'accepted') {
        setIsAppInstalled(true);
      }
      setDeferredPrompt(null);
    } else {
      alert('Para instalar en este PC sin permisos de administrador:\n1. Haz clic en el ícono de instalar en la barra de direcciones de tu navegador (Chrome o Edge) junto a la URL.\n2. O presiona Menú (tres puntos ⋮) > "Guardar y compartir" > "Instalar SYD Colombia".');
    }
  };

  const publishedStudioUrl = getPublishedStudioAppUrl();
  const cloudRunUrl = getCloudRunShareAppUrl();
  const publicShareUrl = getPublicShareAppUrl();
  const qrCodeUrl = getAppQrCodeUrl(publishedStudioUrl, 220);

  const handleDownloadBat = () => {
    const script = generateLocalhostBatScript(publishedStudioUrl, 3000);
    const blob = new Blob([script], { type: 'application/x-bat;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Iniciar_SYD_Localhost.bat';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadHtml = () => {
    const html = generateLocalhostHtmlFile(publicShareUrl);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SYD_Colombia_Local.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const powershellCommand = `powershell -NoProfile -Command "$u='${publicShareUrl}';$l=New-Object System.Net.HttpListener;$l.Prefixes.Add('http://localhost:3000/');$l.Start();Start-Process 'http://localhost:3000';while($l.IsListening){$c=$l.GetContext();$h=\\"<script>location.href='$u'</script>\\";$b=[System.Text.Encoding]::UTF8.GetBytes($h);$c.Response.OutputStream.Write($b,0,$b.Length);$c.Response.Close()}"`;

  if (!isOpen) return null;

  const handleManualBackup = async () => {
    if (!onSendBackupNow) return;
    setIsSendingEmail(true);
    setBackupNotice(null);
    try {
      const res = await onSendBackupNow();
      setBackupNotice(res.message);
    } catch (e: any) {
      setBackupNotice(e?.message || 'Error al procesar el respaldo');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const copyToClipboard = (text: string, setFn: (val: boolean) => void) => {
    if (!navigator.clipboard) {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setFn(true);
      setTimeout(() => setFn(false), 2500);
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      setFn(true);
      setTimeout(() => setFn(false), 2500);
    });
  };

  const handleTriggerRefresh = () => {
    setIsRefreshing(true);
    if (onForceSync) onForceSync();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 800);
  };

  const getStatusBadge = () => {
    switch (syncStatus) {
      case 'connected':
        return (
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Conectado y Sincronizado en Tiempo Real</span>
          </div>
        );
      case 'syncing':
        return (
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-sky-500/10 border border-sky-500/30 rounded-full text-sky-400 text-xs font-semibold">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Sincronizando cambios con la nube...</span>
          </div>
        );
      case 'connecting':
        return (
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
            <span>Conectando a base de datos en la nube...</span>
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-slate-300 text-xs font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
            <span>Modo Local (Guardado seguro)</span>
          </div>
        );
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/25 animate-fadeIn"
      onClick={onClose}
    >
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-indigo-950/50 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Acceso Multi-Equipo & Compartir en Otros PC</span>
              </h2>
              <p className="text-xs text-slate-400">
                Sincronización en tiempo real con Firebase Firestore
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Status badge */}
          <div className="flex items-center justify-between flex-wrap gap-2 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-medium text-slate-300">Estado de Conexión Nube:</span>
            </div>
            {getStatusBadge()}
          </div>

          {isDesktop && (
            <div className="p-4 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-sky-950/50 border border-emerald-500/50 rounded-2xl shadow-xl space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white">Sincronización entre PCs</h3>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Los cambios se comparten en tiempo real por Firebase Firestore.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="text-emerald-400 font-black text-[11px] flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> 1. Conecta Google
                  </span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    En cada PC, abre <strong>Google Drive</strong> (ventana 1) o <strong>Gmail</strong> (ventana 5.1) y pulsa <strong>Conectar con Google</strong>.
                  </p>
                </div>
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="text-sky-400 font-black text-[11px] flex items-center gap-1.5">
                    <Cloud className="w-3.5 h-3.5 shrink-0" /> 2. Misma cuenta
                  </span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    Usa la misma cuenta de Google en todas las PCs para que compartan la misma base de datos.
                  </p>
                </div>
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5">
                  <span className="text-indigo-400 font-black text-[11px] flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 shrink-0" /> 3. Verifica el estado
                  </span>
                  <p className="text-slate-300 text-[11px] leading-relaxed">
                    El estado debe decir <strong>Conectado y Sincronizado</strong>. Si dice <strong>Modo Local</strong>, vuelve a conectar Google.
                  </p>
                </div>
              </div>
              <p className="text-[10.5px] text-slate-400">
                La app funciona instalada o en modo portable; no requiere Node.js ni permisos de administrador.
              </p>
            </div>
          )}

          {!isDesktop && (
            <>
          {/* Corporate PC Installation Card (No Admin, No Node Required) */}
          <div className="p-4 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-sky-950/50 border border-emerald-500/50 rounded-2xl shadow-xl space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <Monitor className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Instalar en este PC Empresarial</span>
                    <span className="text-[9.5px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                      Sin Node ni Administrador
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Se instala como programa de escritorio en Windows con ícono propio y ventana independiente
                  </p>
                </div>
              </div>

              {deferredPrompt && !isAppInstalled && (
                <button
                  type="button"
                  onClick={handleInstallApp}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer active:scale-95 border border-emerald-400/40"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Instalar Ahora (1 Clic)</span>
                </button>
              )}
            </div>

            {/* Step-by-step instructions for blocked enterprise computers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5">
                <span className="text-emerald-400 font-black text-[11px] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> Paso 1: Instalación en 2 Clics
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  En la barra superior de <strong>Google Chrome</strong> o <strong>Microsoft Edge</strong>, haz clic en el ícono de pantalla 🖥️ <em>&quot;Instalar SYD Colombia&quot;</em> (junto a la URL), o en el Menú (tres puntos <strong className="text-white">⋮</strong>) &gt; <em>&quot;Guardar y compartir&quot;</em> &gt; <em>&quot;Instalar como aplicación&quot;</em>.
                </p>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5">
                <span className="text-sky-400 font-black text-[11px] flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 shrink-0" /> Paso 2: Interconectado y Modificable
                </span>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  <strong>¡Sin pedir contraseña de administrador!</strong> Queda guardado en tu Escritorio. Todos los computadores de la oficina quedan conectados a la misma base de datos en tiempo real, y cualquier corrección se actualiza en línea de inmediato.
                </p>
              </div>
            </div>
          </div>

          {/* Localhost Server Card (No Node, No Admin Needed) */}
          <div className="p-4 bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 border border-blue-500/50 rounded-2xl shadow-xl space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                  <Laptop className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Modo Localhost (Servidor Local en tu PC)</span>
                    <span className="text-[9.5px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-500/30">
                      http://localhost:3000
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Ejecútalo en tu equipo por localhost manteniendo la conexión en tiempo real con los demás computadores
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  id="btn-download-localhost-bat"
                  onClick={handleDownloadBat}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition cursor-pointer active:scale-95 border border-sky-400/40"
                  title="Descargar script .bat para iniciar localhost sin instalar Node.js ni pedir clave de administrador"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar Lanzador (.bat)</span>
                </button>

                <button
                  type="button"
                  id="btn-download-local-html"
                  onClick={handleDownloadHtml}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-xs rounded-xl transition cursor-pointer active:scale-95 border border-slate-700"
                  title="Descargar acceso directo HTML local para abrir con doble clic"
                >
                  <FileCode className="w-3.5 h-3.5 text-amber-400" />
                  <span>Acceso Local (.html)</span>
                </button>
              </div>
            </div>

            {/* Explanatory blocks */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
              <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                <span className="text-sky-400 font-bold text-[10.5px] flex items-center gap-1">
                  <Play className="w-3 h-3 text-sky-400 shrink-0" /> 1. Doble Clic y Listo
                </span>
                <p className="text-slate-300 text-[10.5px] leading-relaxed">
                  Descarga el archivo <code>.bat</code> y hazle doble clic. Abre tu navegador en <code>http://localhost:3000</code> automáticamente usando PowerShell nativo de Windows (sin Node ni administrador).
                </p>
              </div>

              <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                <span className="text-emerald-400 font-bold text-[10.5px] flex items-center gap-1">
                  <Database className="w-3 h-3 text-emerald-400 shrink-0" /> 2. Conectado a la Red
                </span>
                <p className="text-slate-300 text-[10.5px] leading-relaxed">
                  Aunque lo uses en tu localhost, está conectado a la base de datos Firestore de SYD Colombia. Todas las cotizaciones y órdenes creadas se comparten con los demás PCs.
                </p>
              </div>

              <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                <span className="text-indigo-400 font-bold text-[10.5px] flex items-center gap-1">
                  <Zap className="w-3 h-3 text-indigo-400 shrink-0" /> 3. Modificable en Línea
                </span>
                <p className="text-slate-300 text-[10.5px] leading-relaxed">
                  Si hay algún error o ajuste que me pidas solucionar, los cambios se aplican en vivo en la nube y se reflejan en tu localhost sin reinstalar nada.
                </p>
              </div>
            </div>

            {/* One-Liner PowerShell Terminal Alternative */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-slate-300 text-[11px] font-bold">
                  <Terminal className="w-3.5 h-3.5 text-sky-400" />
                  <span>¿Tu empresa bloquea descargas de archivos .bat? Inicia con 1 comando:</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(powershellCommand, setCopiedCmd)}
                  className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer shrink-0 ${
                    copiedCmd
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700'
                  }`}
                >
                  {copiedCmd ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>¡Comando Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar Comando PowerShell</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Presiona <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-200">Win + R</kbd>, escribe <code className="text-sky-300">powershell</code>, pega el comando y presiona <kbd className="px-1 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-200">Enter</kbd>. Levantará <code>localhost:3000</code> al instante sin pedir contraseña de administrador.
              </p>
            </div>
          </div>

          {/* Primary Share Link Card: Published AI Studio URL */}
          <div className="space-y-3 p-4 bg-gradient-to-r from-slate-950 via-indigo-950/40 to-slate-950 border border-sky-500/40 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-white flex items-center gap-2">
                <Share2 className="w-4 h-4 text-sky-400" />
                <span>1. Enlace Publicado Oficial (AI Studio)</span>
              </label>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                Dominio Oficial Publish
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 bg-slate-950 border border-slate-700/80 rounded-xl">
              <input
                type="text"
                readOnly
                value={publishedStudioUrl}
                className="bg-transparent text-xs text-cyan-200 font-mono w-full px-2 py-1 outline-none select-all min-w-0"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => copyToClipboard(publishedStudioUrl, setCopiedStudio)}
                  className={`flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg transition shrink-0 cursor-pointer ${
                    copiedStudio
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white shadow-md active:scale-95 border border-sky-400/40'
                  }`}
                >
                  {copiedStudio ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar Enlace</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => window.open(publishedStudioUrl, '_blank', 'noopener,noreferrer')}
                  title="Abrir enlace en una pestaña nueva para verificarlo"
                  className="flex items-center justify-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer active:scale-95"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Probar ↗</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowQr(!showQr)}
                  title="Mostrar Código QR para escanear con el celular"
                  className={`flex items-center justify-center gap-1 px-2.5 py-2 text-xs font-semibold rounded-lg border transition cursor-pointer active:scale-95 ${
                    showQr
                      ? 'bg-purple-600 text-white border-purple-400'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5 text-purple-300" />
                  <span className="hidden sm:inline">QR</span>
                </button>
              </div>
            </div>

            {/* QR Code view toggle */}
            {showQr && (
              <div className="p-4 bg-slate-900 border border-purple-500/40 rounded-xl flex flex-col sm:flex-row items-center gap-4 animate-fadeIn">
                <div className="p-2 bg-white rounded-xl shadow-lg shrink-0">
                  <img
                    src={qrCodeUrl}
                    alt="Código QR del Sistema SYD Colombia"
                    className="w-32 h-32 rounded object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="space-y-1.5 text-center sm:text-left">
                  <h4 className="text-xs font-bold text-white flex items-center justify-center sm:justify-start gap-1.5">
                    <Smartphone className="w-4 h-4 text-purple-400" />
                    <span>Abre la app al instante en tu celular o tablet</span>
                  </h4>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Abre la cámara de tu celular, enfoca el código QR y toca la notificación para ingresar a <strong>SYD Colombia</strong> sin necesidad de escribir la dirección.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Secondary Alternative Card: Direct Google Cloud Run URL */}
          <div className="space-y-3 p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-700/80 rounded-2xl shadow-lg">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Server className="w-4 h-4 text-cyan-400" />
                <span>2. Enlace Directo Servidor en la Nube (Google Cloud Run)</span>
              </label>
              <span className="text-[10px] bg-sky-500/20 text-sky-300 font-bold px-2.5 py-0.5 rounded-full border border-sky-500/30">
                Servidor Activo
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-2 bg-slate-950 border border-slate-800 rounded-xl">
              <input
                type="text"
                readOnly
                value={cloudRunUrl}
                className="bg-transparent text-xs text-slate-300 font-mono w-full px-2 py-1 outline-none select-all min-w-0"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => copyToClipboard(cloudRunUrl, setCopiedCloudRun)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition shrink-0 cursor-pointer ${
                    copiedCloudRun
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 active:scale-95'
                  }`}
                >
                  {copiedCloudRun ? (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => window.open(cloudRunUrl, '_blank', 'noopener,noreferrer')}
                  title="Abrir enlace en una pestaña nueva para verificarlo"
                  className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer active:scale-95"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Probar ↗</span>
                </button>
              </div>
            </div>
          </div>
            </>
          )}

          {!isDesktop && (
            <div className="p-3.5 bg-amber-950/30 border border-amber-500/30 rounded-xl space-y-2">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-amber-200/90 leading-relaxed">
                  <p className="font-semibold text-amber-300">
                    ¿Cómo compartir el acceso con tu equipo de trabajo?
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-[11.5px] text-slate-300">
                    <li>
                      <strong>Usa el botón &ldquo;Copiar Enlace&rdquo;</strong>: Pégalo en WhatsApp, correo o Teams para que tus compañeros puedan entrar desde cualquier navegador.
                    </li>
                    <li>
                      <strong>Acceso Móvil Instantáneo</strong>: Puedes pulsar el botón <strong>&ldquo;QR&rdquo;</strong> y escanearlo con la cámara del celular.
                    </li>
                    <li>
                      <strong>Sincronización en Tiempo Real</strong>: Cualquier cotización, equipo o licitación que se cree se reflejará automáticamente en todos los dispositivos conectados.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {isDesktop && (
            <div className="p-3.5 bg-amber-950/30 border border-amber-500/30 rounded-xl space-y-2">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-amber-200/90 leading-relaxed">
                  <p className="font-semibold text-amber-300">Si la sincronización no está activa</p>
                  <ul className="list-disc list-inside space-y-1 text-[11.5px] text-slate-300">
                    <li>Conecta Google Drive o Gmail en esta PC con la misma cuenta de las demás.</li>
                    <li>Verifica que el puerto 3000 no esté ocupado por otro programa.</li>
                    <li>Cierra cualquier otra copia de SYD Colombia abierta.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Automatic Daily Email Backup Card */}
          <div className="p-4 bg-gradient-to-r from-blue-950/40 via-slate-900 to-indigo-950/40 rounded-xl border border-blue-800/40 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white flex items-center gap-2">
                    Copia de Seguridad Diaria Automática
                    <span className="px-2 py-0.5 text-[10px] font-semibold bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-full">
                      Activo 24/7
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Destino: <strong className="text-blue-300">eljemb22@gmail.com</strong>
                  </p>
                </div>
              </div>

              {onSendBackupNow && (
                <button
                  onClick={handleManualBackup}
                  disabled={isSendingEmail}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-50"
                >
                  <Send className={`w-3.5 h-3.5 ${isSendingEmail ? 'animate-bounce' : ''}`} />
                  <span>{isSendingEmail ? 'Enviando copia...' : 'Enviar Respaldo Ahora'}</span>
                </button>
              )}
            </div>

            {backupNotice && (
              <div className="p-2 rounded bg-slate-950/80 border border-blue-500/40 text-[11px] text-blue-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{backupNotice}</span>
              </div>
            )}
          </div>

          {/* Synced Data Counters */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-300">
              Datos Sincronizados en la Nube
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="text-base font-bold text-white">{stats.quotesCount}</div>
                <div className="text-[10px] text-slate-400">Cotizaciones</div>
              </div>
              <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="text-base font-bold text-white">{stats.equipmentsCount}</div>
                <div className="text-[10px] text-slate-400">Equipos Catálogo</div>
              </div>
              <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="text-base font-bold text-white">{stats.tendersCount}</div>
                <div className="text-[10px] text-slate-400">Licitaciones</div>
              </div>
              <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800">
                <div className="text-base font-bold text-white">{stats.ocContractsCount}</div>
                <div className="text-[10px] text-slate-400">Órdenes / OC</div>
              </div>
              <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
                <div className="text-base font-bold text-white">{stats.documentsCount}</div>
                <div className="text-[10px] text-slate-400">Documentos</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={handleTriggerRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Verificar Sincronización</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
