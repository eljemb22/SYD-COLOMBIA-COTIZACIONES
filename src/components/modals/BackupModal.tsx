import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Database,
  Download,
  Upload,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  FileJson,
  Calendar,
  Cloud,
  Mail,
  RefreshCw,
  Layers,
  FileText,
  BookOpen,
  FileSpreadsheet,
  Truck,
  Users,
  Check,
  SlidersHorizontal,
  Sparkles,
  Info,
  CheckSquare,
  Square,
  FileDown,
  Globe,
  Key,
  ExternalLink,
} from 'lucide-react';
import { googleWorkspaceService } from '../../services/googleWorkspaceService';
import {
  SavedQuote,
  MedicalEquipment,
  TenderClientProject,
  OCTrackingContract,
  TechnicalDocument,
  StoredUserAccount,
  ThemeSettings,
  QuoteHeader,
  QuoteItem,
  AuthUser,
  SalesOrderRecord,
  SalesInvoiceRecord,
} from '../../types';
import {
  generateAppBackup,
  downloadBackupAsJson,
  downloadDatabaseAsExcel,
  downloadExcelDatabaseTemplate,
  validateAnyBackupFile,
  restoreBackupToSystem,
  RestoreCallbacks,
} from '../../utils/backupRestoreUtils';
import { performHourlyAutomaticBackup, performDailyAutomaticBackup } from '../../services/realtimeSync';
import { CURRENT_APP_VERSION } from '../../utils/versionCheck';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  quotes: SavedQuote[];
  equipments: MedicalEquipment[];
  tenderProjects: TenderClientProject[];
  ocContracts: OCTrackingContract[];
  salesOrders?: SalesOrderRecord[];
  salesInvoices?: SalesInvoiceRecord[];
  documents: TechnicalDocument[];
  users: StoredUserAccount[];
  themeSettings?: ThemeSettings;
  activeLetterheadUrl?: string | null;
  quoteHeader?: QuoteHeader;
  quoteItems?: QuoteItem[];
  currentUser?: AuthUser | null;
  onRestoreCallbacks: RestoreCallbacks;
  onOpenSqlConsole?: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  quotes,
  equipments,
  tenderProjects,
  ocContracts,
  salesOrders = [],
  salesInvoices = [],
  documents,
  users,
  themeSettings,
  activeLetterheadUrl,
  quoteHeader,
  quoteItems,
  currentUser,
  onRestoreCallbacks,
  onOpenSqlConsole,
}) => {
  const [downloadSuccessJson, setDownloadSuccessJson] = useState(false);
  const [downloadSuccessExcel, setDownloadSuccessExcel] = useState(false);
  const [downloadSuccessTemplate, setDownloadSuccessTemplate] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Google Drive state
  const [isSavingDrive, setIsSavingDrive] = useState(false);
  const [driveUploadResult, setDriveUploadResult] = useState<{ name: string; url: string } | null>(null);
  const [driveUploadError, setDriveUploadError] = useState<string | null>(null);

  // Restore state
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    error?: string;
    fileType?: 'excel' | 'json';
    counts?: any;
    metadata?: any;
    extractedData?: any;
    detectedSheets?: string[];
  } | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'overwrite'>('merge');
  const [selectedCollections, setSelectedCollections] = useState({
    equipments: true,
    quotes: true,
    tenderProjects: true,
    ocContracts: true,
    technicalDocuments: true,
    systemUsers: true,
    themeAndSettings: true,
  });
  const [isRestoring, setIsRestoring] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [restoreStatus, setRestoreStatus] = useState<{
    success: boolean;
    message: string;
    counts?: any;
  } | null>(null);
  const [recipientEmails, setRecipientEmails] = useState<string>(() => {
    return localStorage.getItem('syd_backup_recipient_emails') || 'auxlineadiagnostica@syd.com.co, eljemb22@gmail.com';
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Permission evaluation for active user
  const canAccessSql = currentUser?.role === 'admin' || !!currentUser?.permissions?.canAccessSqlAnalytics;
  const canManageBackups = currentUser?.role === 'admin' || (currentUser?.permissions?.canManageBackups ?? true);
  const canExportData = currentUser?.role === 'admin' || (currentUser?.permissions?.canExportData ?? true);

  // Update selected collections automatically when file is analyzed
  useEffect(() => {
    if (validationResult?.isValid && validationResult.counts) {
      setSelectedCollections({
        equipments: (validationResult.counts.equipments || 0) > 0,
        quotes: (validationResult.counts.quotes || 0) > 0,
        tenderProjects: (validationResult.counts.tenderProjects || 0) > 0,
        ocContracts: (validationResult.counts.ocContracts || 0) > 0,
        technicalDocuments: (validationResult.counts.technicalDocuments || 0) > 0,
        systemUsers: (validationResult.counts.systemUsers || 0) > 0,
        themeAndSettings: !!(validationResult.extractedData?.themeSettings || validationResult.extractedData?.activeLetterheadUrl),
      });
    }
  }, [validationResult]);

  if (!isOpen) return null;

  const handleDownloadExcel = () => {
    downloadDatabaseAsExcel({
      quotes,
      equipments,
      tenderProjects,
      ocContracts,
      salesOrders,
      salesInvoices,
      technicalDocuments: documents,
      systemUsers: users,
      themeSettings,
      activeLetterheadUrl,
      currentQuoteDraft: quoteHeader && quoteItems ? { header: quoteHeader, items: quoteItems } : undefined,
      currentUser,
    });
    setDownloadSuccessExcel(true);
    setTimeout(() => setDownloadSuccessExcel(false), 4000);
  };

  const handleDownloadTemplate = () => {
    downloadExcelDatabaseTemplate();
    setDownloadSuccessTemplate(true);
    setTimeout(() => setDownloadSuccessTemplate(false), 4000);
  };

  const handleDownloadBackupJson = () => {
    const payload = generateAppBackup({
      quotes,
      equipments,
      tenderProjects,
      ocContracts,
      salesOrders,
      salesInvoices,
      technicalDocuments: documents,
      systemUsers: users,
      themeSettings,
      activeLetterheadUrl,
      currentQuoteDraft: quoteHeader && quoteItems ? { header: quoteHeader, items: quoteItems } : undefined,
      currentUser,
    });

    downloadBackupAsJson(payload);
    setDownloadSuccessJson(true);
    setTimeout(() => setDownloadSuccessJson(false), 4000);
  };

  const handleSaveToGoogleDrive = async () => {
    setIsSavingDrive(true);
    setDriveUploadResult(null);
    setDriveUploadError(null);
    try {
      if (!googleWorkspaceService.isConnected()) {
        await googleWorkspaceService.connectGoogleWorkspace();
      }
      const payload = generateAppBackup({
        quotes,
        equipments,
        tenderProjects,
        ocContracts,
        salesOrders,
        salesInvoices,
        technicalDocuments: documents,
        systemUsers: users,
        themeSettings,
        activeLetterheadUrl,
        currentQuoteDraft: quoteHeader && quoteItems ? { header: quoteHeader, items: quoteItems } : undefined,
        currentUser,
      });
      const res = await googleWorkspaceService.saveBackupToDrive(payload);
      setDriveUploadResult({ name: res.name, url: res.webViewLink || '' });
    } catch (err: any) {
      setDriveUploadError(err.message || 'Error guardando en Google Drive');
    } finally {
      setIsSavingDrive(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFile(file);
    setRestoreStatus(null);
    setProgressMessage('Analizando estructura del archivo...');

    try {
      const result = await validateAnyBackupFile(file);
      setValidationResult(result);
    } catch (err: any) {
      setValidationResult({
        isValid: false,
        error: `No se pudo leer el archivo: ${err?.message || 'Formato no soportado'}`,
      });
    } finally {
      setProgressMessage('');
    }
  };

  const handleExecuteRestore = async () => {
    if (!validationResult || !validationResult.isValid || !validationResult.extractedData) return;

    setIsRestoring(true);
    setRestoreStatus(null);
    setProgressMessage('Iniciando restauración y sincronización en la nube...');

    try {
      const res = await restoreBackupToSystem(
        validationResult.extractedData,
        onRestoreCallbacks,
        {
          mode: restoreMode,
          selectedCollections,
          currentData: {
            equipments,
            quotes,
            tenderProjects,
            ocContracts,
            technicalDocuments: documents,
            systemUsers: users,
            themeSettings,
            activeLetterheadUrl,
          },
          onProgress: (msg) => setProgressMessage(msg),
        }
      );

      setRestoreStatus(res);
    } catch (err: any) {
      console.error('Error in execute restore:', err);
      setRestoreStatus({
        success: false,
        message: `Error durante la restauración: ${err?.message || 'Fallo inesperado'}`,
      });
    } finally {
      setIsRestoring(false);
      setProgressMessage('');
    }
  };

  const handleSendEmailBackup = async () => {
    if (isSendingEmail) return;
    setIsSendingEmail(true);
    setEmailStatus(null);

    const parsedRecipients = recipientEmails
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 3 && s.includes('@'));

    try {
      localStorage.setItem('syd_backup_recipient_emails', recipientEmails);
    } catch (e) {}

    const result = await performHourlyAutomaticBackup(
      equipments,
      quotes,
      tenderProjects,
      ocContracts,
      documents,
      users,
      salesOrders,
      salesInvoices,
      parsedRecipients.length > 0 ? parsedRecipients : ['auxlineadiagnostica@syd.com.co', 'eljemb22@gmail.com'],
      true // forceManual
    );

    setIsSendingEmail(false);
    setEmailStatus(result);
    setTimeout(() => setEmailStatus(null), 6000);
  };

  const toggleCollection = (key: keyof typeof selectedCollections) => {
    setSelectedCollections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectAllCollections = (val: boolean) => {
    setSelectedCollections({
      equipments: val,
      quotes: val,
      tenderProjects: val,
      ocContracts: val,
      technicalDocuments: val,
      systemUsers: val,
      themeAndSettings: val,
    });
  };

  const lastManualDate = localStorage.getItem('syd_last_manual_backup_date');
  const lastDailyDate = localStorage.getItem('syd_last_daily_backup_date');

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/25 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scaleIn"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-900 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Base de Datos & Centro de Respaldo Excel
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[11px] font-bold text-emerald-300">
                  Excel (.xlsx) + Nube Web
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Exporta e importa toda la información en Microsoft Excel (.xlsx) y mantén la sincronización web activa
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Cerrar ventana"
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 scrollbar-thin text-slate-200">
          {/* Web Architecture Notice Banner */}
          <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/50 via-teal-950/40 to-slate-900 border border-emerald-500/30 flex items-start gap-3">
            <Globe className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <div className="font-bold text-emerald-300">
                Aplicación Web 100% Autónoma con Soporte Excel Nativo
              </div>
              <p className="text-slate-300 leading-relaxed">
                Esta plataforma está construida como una <strong>página web moderna</strong> accesible desde cualquier navegador (Chrome, Edge, Safari, móvil).
                Toda la base de datos se puede <strong>exportar a Excel (.xlsx)</strong> con múltiples pestañas para editar o respaldar en tu computador, e <strong>importar de vuelta</strong> en cualquier momento sin perder datos.
              </p>
            </div>
          </div>

          {/* Section 1: Live Data Summary */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span>Registros Actuales en la Base de Datos</span>
              </h3>
              <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Disponible en Web & Sincronizado
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-white">{quotes.length}</div>
                  <div className="text-[10px] text-slate-400 truncate">Cotizaciones</div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <BookOpen className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-white">{equipments.length}</div>
                  <div className="text-[10px] text-slate-400 truncate">Equipos Médicos</div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-white">{tenderProjects.length}</div>
                  <div className="text-[10px] text-slate-400 truncate">Licitaciones</div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Truck className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-white">{ocContracts.length}</div>
                  <div className="text-[10px] text-slate-400 truncate">Contratos OC</div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-white">{documents.length}</div>
                  <div className="text-[10px] text-slate-400 truncate">Docs & INVIMA</div>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-black text-white">{users.length}</div>
                  <div className="text-[10px] text-slate-400 truncate">Usuarios</div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Download Excel Database (Primary Feature) */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-950/40 via-slate-800/60 to-teal-950/40 border border-emerald-500/40 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  <span>Descargar Base de Datos Completa en Excel (.xlsx)</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px]">
                    Multi-Pestaña
                  </span>
                </h4>
                <p className="text-xs text-slate-300 mt-1">
                  Exporta un libro de Excel oficial con pestañas independientes para: <strong>Catálogo de Equipos</strong>, <strong>Cotizaciones</strong>, <strong>Ítems Cotizados</strong>, <strong>Licitaciones</strong>, <strong>Contratos OC</strong>, <strong>Clientes</strong> y <strong>Proveedores</strong>.
                </p>
                {lastManualDate && (
                  <p className="text-[11px] text-slate-400 mt-1">
                    Última exportación realizada: {new Date(lastManualDate).toLocaleString('es-CO')}
                  </p>
                )}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                <button
                  id="btn-download-excel-db"
                  type="button"
                  onClick={handleDownloadExcel}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition cursor-pointer active:scale-95 border border-emerald-400/40"
                >
                  {downloadSuccessExcel ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-200 stroke-[3]" />
                      <span>¡Excel Descargado!</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>Descargar Excel (.xlsx)</span>
                    </>
                  )}
                </button>

                <button
                  id="btn-download-excel-template"
                  type="button"
                  onClick={handleDownloadTemplate}
                  title="Descarga un formato de Excel en blanco con ejemplos para ingresar datos"
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-white text-xs font-bold border border-emerald-500/30 flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-95"
                >
                  {downloadSuccessTemplate ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-300 stroke-[3]" />
                      <span>¡Plantilla Descargada!</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-3.5 h-3.5" />
                      <span>Plantilla Vacía</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Google Drive and JSON backup triggers */}
            <div className="pt-2.5 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              <button
                type="button"
                onClick={handleSaveToGoogleDrive}
                disabled={isSavingDrive}
                className="px-3 py-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 hover:text-white border border-blue-500/40 flex items-center gap-1.5 transition font-semibold cursor-pointer disabled:opacity-50"
              >
                {isSavingDrive ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Subiendo a Google Drive...</span>
                  </>
                ) : (
                  <>
                    <Cloud className="w-3.5 h-3.5 text-blue-400" />
                    <span>Guardar Respaldo en Google Drive</span>
                  </>
                )}
              </button>

              <div className="flex items-center gap-1">
                <span>Respaldo crudo:</span>
                <button
                  type="button"
                  onClick={handleDownloadBackupJson}
                  className="text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer font-semibold ml-1"
                >
                  <FileJson className="w-3.5 h-3.5" />
                  <span>{downloadSuccessJson ? '¡JSON Descargado!' : 'Descargar JSON'}</span>
                </button>
              </div>
            </div>

            {driveUploadResult && (
              <div className="p-3 rounded-lg bg-blue-950/40 border border-blue-500/50 flex items-center justify-between gap-2 text-xs text-blue-200 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Copia guardada en Drive: <strong>{driveUploadResult.name}</strong></span>
                </div>
                {driveUploadResult.url && (
                  <a
                    href={driveUploadResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-[11px] flex items-center gap-1 transition"
                  >
                    <span>Ver en Drive</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}

            {driveUploadError && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/50 flex items-center gap-2 text-xs text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{driveUploadError}</span>
              </div>
            )}
          </div>

          {/* Section 3: Restore / Import Database from Excel or JSON */}
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/80 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Cargar / Importar Archivo de Base de Datos (Excel .xlsx o JSON)</span>
              </h4>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-[10px] font-bold text-emerald-300">
                Excel y JSON Soportados
              </span>
            </div>

            <p className="text-xs text-slate-300">
              Selecciona tu archivo de Excel (<code className="text-emerald-300 font-mono">.xlsx</code> o <code className="text-emerald-300 font-mono">.xls</code>) o JSON. El sistema detectará automáticamente todas las columnas y hojas (Equipos, Cotizaciones, Licitaciones, OCs) y las cargará en la aplicación.
            </p>

            <input
              type="file"
              ref={fileInputRef}
              accept=".xlsx,.xls,.json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/json"
              onChange={handleFileChange}
              className="hidden"
            />

            {!restoreFile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-5 px-4 border-2 border-dashed border-emerald-500/40 hover:border-emerald-400 rounded-xl bg-slate-900/60 hover:bg-slate-900/90 transition flex flex-col items-center justify-center gap-2 text-xs font-semibold text-slate-300 cursor-pointer group"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 group-hover:bg-emerald-500/20 text-emerald-400 flex items-center justify-center transition">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <span className="font-bold text-sm text-white">Haga clic aquí para seleccionar el archivo Excel (.xlsx) o JSON</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  Soporta catálogos grandes de 300+ equipos, hojas de cotizaciones y bases de datos consolidadas
                </span>
              </button>
            ) : (
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 space-y-4">
                {/* File Header Bar */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2 min-w-0">
                    {validationResult?.fileType === 'excel' ? (
                      <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <FileJson className="w-5 h-5 text-cyan-400 shrink-0" />
                    )}
                    <span className="text-xs font-bold text-white truncate">{restoreFile.name}</span>
                    <span className="text-[11px] text-slate-400">({(restoreFile.size / 1024).toFixed(1)} KB)</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-emerald-300 border border-emerald-500/30">
                      {validationResult?.fileType === 'excel' ? 'Libro Excel' : 'JSON'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRestoreFile(null);
                      setValidationResult(null);
                      setRestoreStatus(null);
                      setProgressMessage('');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-xs text-slate-400 hover:text-rose-300 cursor-pointer"
                  >
                    Cambiar archivo
                  </button>
                </div>

                {/* Validation Info & Summary of items found */}
                {validationResult && (
                  <div className="space-y-4">
                    {validationResult.isValid ? (
                      <>
                        {/* Detected Collections Pill Grid */}
                        <div>
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                            <span>Datos Detectados en el Archivo:</span>
                            {validationResult.detectedSheets && validationResult.detectedSheets.length > 0 && (
                              <span className="text-[10px] text-emerald-400 font-normal">
                                Hojas: {validationResult.detectedSheets.join(', ')}
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-between text-xs">
                              <span className="text-slate-300 flex items-center gap-1.5">
                                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                                Equipos Biomédicos:
                              </span>
                              <span className="font-bold text-emerald-400 text-sm">
                                {validationResult.counts?.equipments || 0}
                              </span>
                            </div>

                            <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-between text-xs">
                              <span className="text-slate-300 flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-sky-400" />
                                Cotizaciones:
                              </span>
                              <span className="font-bold text-sky-400 text-sm">
                                {validationResult.counts?.quotes || 0}
                              </span>
                            </div>

                            <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-between text-xs">
                              <span className="text-slate-300 flex items-center gap-1.5">
                                <FileSpreadsheet className="w-3.5 h-3.5 text-purple-400" />
                                Licitaciones:
                              </span>
                              <span className="font-bold text-purple-400 text-sm">
                                {validationResult.counts?.tenderProjects || 0}
                              </span>
                            </div>

                            <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-between text-xs">
                              <span className="text-slate-300 flex items-center gap-1.5">
                                <Truck className="w-3.5 h-3.5 text-amber-400" />
                                Contratos OC:
                              </span>
                              <span className="font-bold text-amber-400 text-sm">
                                {validationResult.counts?.ocContracts || 0}
                              </span>
                            </div>

                            <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-between text-xs">
                              <span className="text-slate-300 flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
                                Docs & INVIMA:
                              </span>
                              <span className="font-bold text-teal-400 text-sm">
                                {validationResult.counts?.technicalDocuments || 0}
                              </span>
                            </div>

                            <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/80 flex items-center justify-between text-xs">
                              <span className="text-slate-300 flex items-center gap-1.5">
                                <Users className="w-3.5 h-3.5 text-indigo-400" />
                                Usuarios:
                              </span>
                              <span className="font-bold text-indigo-400 text-sm">
                                {validationResult.counts?.systemUsers || 0}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Mode Selector */}
                        <div>
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Modo de Carga en la Base de Datos:</span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <button
                              type="button"
                              onClick={() => setRestoreMode('merge')}
                              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                                restoreMode === 'merge'
                                  ? 'bg-emerald-950/40 border-emerald-500/80 shadow-md shadow-emerald-500/10'
                                  : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                    restoreMode === 'merge'
                                      ? 'border-emerald-400 bg-emerald-400'
                                      : 'border-slate-500 bg-transparent'
                                  }`}
                                >
                                  {restoreMode === 'merge' && <Check className="w-3 h-3 text-slate-950 stroke-[3]" />}
                                </div>
                                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                  <span>Fusionar sin Perder Nada</span>
                                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Recomendado
                                  </span>
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-300 mt-1 pl-6 leading-relaxed">
                                Conserva los datos existentes y agrega todos los registros nuevos o actualizados del archivo Excel. <strong>No elimina ninguna cotización o equipo actual</strong>.
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() => setRestoreMode('overwrite')}
                              className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                                restoreMode === 'overwrite'
                                  ? 'bg-rose-950/40 border-rose-500/80 shadow-md shadow-rose-500/10'
                                  : 'bg-slate-800/40 border-slate-700 hover:bg-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                    restoreMode === 'overwrite'
                                      ? 'border-rose-400 bg-rose-400'
                                      : 'border-slate-500 bg-transparent'
                                  }`}
                                >
                                  {restoreMode === 'overwrite' && (
                                    <Check className="w-3 h-3 text-slate-950 stroke-[3]" />
                                  )}
                                </div>
                                <span className="text-xs font-bold text-white">Reemplazar / Sobrescribir Todo</span>
                              </div>
                              <p className="text-[11px] text-slate-300 mt-1 pl-6 leading-relaxed">
                                Sobrescribe las colecciones seleccionadas con exactamente lo que contiene el archivo Excel.
                              </p>
                            </button>
                          </div>
                        </div>

                        {/* Collection Checkboxes */}
                        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span className="font-semibold uppercase tracking-wider">
                              Seleccionar Colecciones a Cargar:
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => selectAllCollections(true)}
                                className="text-emerald-400 hover:underline cursor-pointer"
                              >
                                Todas
                              </button>
                              <span>|</span>
                              <button
                                type="button"
                                onClick={() => selectAllCollections(false)}
                                className="text-slate-400 hover:text-white cursor-pointer"
                              >
                                Ninguna
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                            <label className="flex items-center gap-2 cursor-pointer text-slate-200 select-none">
                              <input
                                type="checkbox"
                                checked={selectedCollections.equipments}
                                onChange={() => toggleCollection('equipments')}
                                className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-emerald-600"
                              />
                              <span>Equipos Médicos ({validationResult.counts?.equipments || 0})</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer text-slate-200 select-none">
                              <input
                                type="checkbox"
                                checked={selectedCollections.quotes}
                                onChange={() => toggleCollection('quotes')}
                                className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-emerald-600"
                              />
                              <span>Cotizaciones ({validationResult.counts?.quotes || 0})</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer text-slate-200 select-none">
                              <input
                                type="checkbox"
                                checked={selectedCollections.tenderProjects}
                                onChange={() => toggleCollection('tenderProjects')}
                                className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-emerald-600"
                              />
                              <span>Licitaciones ({validationResult.counts?.tenderProjects || 0})</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer text-slate-200 select-none">
                              <input
                                type="checkbox"
                                checked={selectedCollections.ocContracts}
                                onChange={() => toggleCollection('ocContracts')}
                                className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-emerald-600"
                              />
                              <span>Contratos OC ({validationResult.counts?.ocContracts || 0})</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer text-slate-200 select-none">
                              <input
                                type="checkbox"
                                checked={selectedCollections.technicalDocuments}
                                onChange={() => toggleCollection('technicalDocuments')}
                                className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-emerald-600"
                              />
                              <span>Docs & INVIMA ({validationResult.counts?.technicalDocuments || 0})</span>
                            </label>

                            <label className="flex items-center gap-2 cursor-pointer text-slate-200 select-none">
                              <input
                                type="checkbox"
                                checked={selectedCollections.systemUsers}
                                onChange={() => toggleCollection('systemUsers')}
                                className="w-4 h-4 rounded bg-slate-800 border-slate-600 text-emerald-600"
                              />
                              <span>Usuarios ({validationResult.counts?.systemUsers || 0})</span>
                            </label>
                          </div>
                        </div>

                        {/* Action Button & Progress */}
                        <div>
                          {isRestoring && progressMessage && (
                            <div className="mb-2.5 p-2.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-300 flex items-center gap-2 animate-pulse">
                              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
                              <span>{progressMessage}</span>
                            </div>
                          )}

                          <button
                            id="btn-execute-restore-now"
                            type="button"
                            onClick={handleExecuteRestore}
                            disabled={isRestoring}
                            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-98 border border-emerald-400/40"
                          >
                            {isRestoring ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Cargando datos en la aplicación...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4" />
                                <span>
                                  {restoreMode === 'merge'
                                    ? 'Cargar e Integrar Archivo en la Base de Datos'
                                    : 'Sobrescribir y Cargar Todo Ahora'}
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{validationResult.error}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Restore Finished Status Banner */}
                {restoreStatus && (
                  <div
                    className={`p-4 rounded-xl text-xs flex flex-col gap-2.5 ${
                      restoreStatus.success
                        ? 'bg-emerald-950/90 border border-emerald-500/80 text-emerald-100 shadow-lg shadow-emerald-950/50'
                        : 'bg-rose-950/90 border border-rose-500/80 text-rose-100 shadow-lg shadow-rose-950/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-sm">
                      {restoreStatus.success ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                      )}
                      <span>{restoreStatus.message}</span>
                    </div>

                    {restoreStatus.counts && (
                      <div className="text-xs text-emerald-200/90 pl-7 space-y-1">
                        <p>
                          Base de datos consolidada: <strong>{restoreStatus.counts.equipments}</strong> equipos médicos,{' '}
                          <strong>{restoreStatus.counts.quotes}</strong> cotizaciones,{' '}
                          <strong>{restoreStatus.counts.tenderProjects}</strong> licitaciones,{' '}
                          <strong>{restoreStatus.counts.ocContracts}</strong> contratos OC.
                        </p>
                      </div>
                    )}

                    {restoreStatus.success && (
                      <div className="pt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={onClose}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>¡Listo! Cerrar y Ver Datos Cargados</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 4: Hourly Automated Email Backup Dispatch */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-800/80 via-indigo-950/40 to-slate-800/80 border border-indigo-500/40 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Mail className="w-4 h-4 text-indigo-400" />
                    <span>Respaldo Automático Cada Hora por Correo</span>
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[10px] font-bold">
                    Cada 60 minutos &bull; 24/7
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Genera y envía automáticamente un correo con la <strong>Base de Datos Completa en Excel (.xlsx) con 12 pestañas</strong> y archivo de restauración .JSON cada hora para evitar cualquier pérdida de información.
                </p>
                {lastDailyDate && (
                  <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Último respaldo por correo registrado: {lastDailyDate}</span>
                  </p>
                )}
              </div>

              <button
                type="button"
                id="btn-send-email-backup-now"
                onClick={handleSendEmailBackup}
                disabled={isSendingEmail}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 shrink-0 border border-indigo-400/30 active:scale-95"
              >
                {isSendingEmail ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Generando y Enviando Excel...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5 text-indigo-200" />
                    <span>Enviar Excel Ahora al Correo</span>
                  </>
                )}
              </button>
            </div>

            {/* Recipient configuration bar */}
            <div className="pt-2.5 border-t border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 shrink-0">
                <span>Destinatarios del Correo Horario:</span>
              </label>
              <input
                type="text"
                value={recipientEmails}
                onChange={(e) => setRecipientEmails(e.target.value)}
                placeholder="auxlineadiagnostica@syd.com.co, eljemb22@gmail.com"
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 font-mono"
              />
            </div>
          </div>

          {/* Section 5: Admin SQL Relational Console (Discreet entry for Admin and authorized users) */}
          {onOpenSqlConsole && canAccessSql && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-cyan-950/30 to-slate-900 border border-cyan-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-400/30 flex items-center justify-center shrink-0">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">Consola de Analítica SQL Relacional</span>
                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                      {currentUser?.role === 'admin' ? 'Administrador 🔒' : 'Permiso Autorizado 🔒'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ejecuta consultas SQL en vivo, cruces de tablas y reportes gerenciales con validación de clave.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSqlConsole();
                }}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-md shadow-cyan-600/20 border border-cyan-400/30 active:scale-95"
              >
                <Key className="w-3.5 h-3.5" />
                <span>Abrir Consola SQL</span>
              </button>
            </div>
          )}

          {emailStatus && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 animate-fadeIn ${
                emailStatus.success
                  ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300'
                  : 'bg-rose-950/40 border border-rose-500/40 text-rose-300'
              }`}
            >
              {emailStatus.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{emailStatus.message}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Los datos se exportan en formato Excel estándar (.xlsx) compatible con Microsoft Excel, Google Sheets y LibreOffice.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
