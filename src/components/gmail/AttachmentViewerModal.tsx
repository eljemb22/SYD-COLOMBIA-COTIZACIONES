import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Download,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  FileCheck,
  ExternalLink,
  Search,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2,
  Table as TableIcon,
  Eye,
  Building2,
  CheckCircle2,
  Printer,
  ShieldCheck,
  Award,
  Calendar,
  Hash,
  DollarSign,
  Layers,
  Sparkles,
  UserPlus,
  UserCheck,
  AlertTriangle,
  Edit3,
  ShieldAlert,
  MapPin,
  Check,
  BellRing,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { resolveAttachmentBlob, AttachmentBlobResult } from '../../utils/attachmentGeneratorUtils';
import { PdfCanvasViewer } from './PdfCanvasViewer';
import {
  ClientRecord,
  getStoredClients,
  normalizeClientName,
  getClientDataStatus,
} from '../../utils/clientStorage';
import { ClientQuickCreateModal } from '../modals/ClientQuickCreateModal';

export interface ViewableAttachment {
  filename: string;
  mimeType: string;
  size?: number;
  attachmentId?: string;
  messageId?: string;
  dataUrl?: string;
  relatedSubject?: string;
  relatedSender?: string;
  relatedOCNumber?: string;
  relatedItems?: Array<{ description: string; quantity?: number; unitPrice?: number; brand?: string; model?: string }>;
  relatedTotalCOP?: number;
  isClientPO?: boolean;
  emailType?: string;
  customerName?: string;
  customerSede?: string;
}

interface AttachmentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  attachment: ViewableAttachment | null;
  relatedOrderSubject?: string;
  relatedSender?: string;
  relatedOCNumber?: string;
  customerName?: string;
  customerSede?: string;
  isClientPO?: boolean;
  emailType?: string;
  quoteNumber?: string;
  relatedItems?: Array<{ description: string; quantity?: number; unitPrice?: number; brand?: string; model?: string; partCode?: string }>;
  relatedTotalCOP?: number;
  onClientUpdated?: (client: ClientRecord) => void;
}

export const AttachmentViewerModal: React.FC<AttachmentViewerModalProps> = ({
  isOpen,
  onClose,
  attachment,
  relatedOrderSubject,
  relatedSender,
  relatedOCNumber,
  customerName,
  customerSede,
  isClientPO,
  emailType,
  quoteNumber,
  relatedItems,
  relatedTotalCOP,
  onClientUpdated,
}) => {
  const [blobResult, setBlobResult] = useState<AttachmentBlobResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pdfViewMode, setPdfViewMode] = useState<'original' | 'syd_audit'>('original');

  // Excel viewer state
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [excelSearchQuery, setExcelSearchQuery] = useState('');

  // Image viewer zoom state
  const [zoomLevel, setZoomLevel] = useState(1);

  // Client database integration state
  const [clientsList, setClientsList] = useState<ClientRecord[]>(() => getStoredClients());
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientSaveToast, setClientSaveToast] = useState<string | null>(null);

  // Sync client list when modal opens
  useEffect(() => {
    if (isOpen) {
      setClientsList(getStoredClients());
    }
  }, [isOpen]);

  // 1. Rigorous check: Is this file actually a Client Purchase Order (OC enviada por un Cliente)?
  // Excel files (.xlsx, .xls, .csv) and internal SYD documents are NEVER client registration POs!
  const isCustomerPurchaseOrder = useMemo(() => {
    if (!attachment) return false;

    const fname = (attachment.filename || '').toLowerCase();
    // NEVER treat Excel spreadsheets, CSVs, or Word files as client purchase order forms to create clients
    if (/\.(xlsx|xls|csv|docx|doc|txt)$/i.test(fname)) {
      return false;
    }

    // Explicit client PO flag from email classification
    if (isClientPO === true || attachment.isClientPO === true || emailType === 'client_po') {
      return true;
    }

    // Sender verification: internal SYD accounts are NOT clients sending purchase orders
    const sender = `${relatedSender || ''} ${attachment.relatedSender || ''}`.toLowerCase();
    const isInternalSender =
      /compras@syd|auditoriacompras@syd|auxadministrativo@syd|direccion@syd|syd colombia|suministros y dotaciones/i.test(
        sender
      );
    if (
      isInternalSender &&
      (emailType === 'general_po' ||
        emailType === 'part_authorization' ||
        emailType === 'part_creation_response' ||
        emailType === 'other')
    ) {
      return false;
    }

    const combined = `${fname} ${relatedOrderSubject || ''} ${attachment.relatedSubject || ''} ${relatedOCNumber || ''}`.toLowerCase();

    // Internal spreadsheets, tracking reports, or supplier quotes should NEVER trigger client detection
    if (/contrato.*directas|seguimiento|inventario|reporte|directas|cotizaci[oó]n proveedor|vitalis|convatec/i.test(combined)) {
      return false;
    }

    // Authentic Client Purchase Order identifiers in PDF
    if (/hboc\d+|orden.*compra.*hospital|orden.*compra.*cl[ií]nica|pedido.*cliente|orden de compra \(|oc cliente/i.test(combined)) {
      return true;
    }

    // Non-internal client name passed explicitly
    if (customerName && customerName.trim().length > 3 && !/SYD|Suministros|Auditor|Compras|Directas/i.test(customerName)) {
      return true;
    }

    return false;
  }, [attachment, isClientPO, emailType, relatedSender, relatedOrderSubject, relatedOCNumber, customerName]);

  // 2. Identify the specific client profile ONLY when this is a valid Client Purchase Order
  const detectedClientProfile = useMemo(() => {
    if (!isCustomerPurchaseOrder) return null;

    const fname = attachment?.filename || '';
    const subj = `${relatedOrderSubject || ''} ${attachment?.relatedSubject || ''}`;
    const ocNum = relatedOCNumber || attachment?.relatedOCNumber || '';
    const sender = `${relatedSender || ''} ${attachment?.relatedSender || ''}`;
    const rawCust = customerName || attachment?.customerName || '';
    const combined = `${fname} ${subj} ${ocNum} ${sender} ${rawCust}`;

    // A. Fundación Hospital Infantil Napoleón Franco Pareja / Casa del Niño / HBOC
    if (/NAPOLEON|HOSPITAL\s+INFANTIL|CASA\s+DEL\s+NI[ÑN]O|HBOC/i.test(combined)) {
      return {
        name: 'FUNDACION HOSPITAL INFANTIL NAPOLEON FRANCO PAREJA',
        sede: customerSede || attachment?.customerSede || 'CLÍNICA DE ESPECIALIDADES',
        nit: '', // Zero invention: empty until confirmed
        city: 'Barranquilla',
        department: 'Atlántico',
        address: 'CRA 43 50 59',
        contactPerson: 'LAURA CRISTINA ALTAMONA BLANCO',
        contactPhone: '3302636',
        contactEmail: '', // Zero invention: empty until confirmed
        notes: `Detectado desde orden de compra No. ${ocNum || 'HBOC0000000640'} (Sede: ${customerSede || attachment?.customerSede || 'Clínica de Especialidades'})`,
        isNapoleon: true,
        source: 'oc' as const,
      };
    }

    // B. Hospital Universitario San Rafael
    if (/SAN\s+RAFAEL/i.test(combined)) {
      return {
        name: 'HOSPITAL UNIVERSITARIO SAN RAFAEL',
        sede: customerSede || attachment?.customerSede || 'SEDE PRINCIPAL',
        nit: '',
        city: 'Bogotá D.C.',
        department: 'Cundinamarca',
        address: 'Carrera 8 # 17 - 45 Sur',
        contactPerson: 'Dpto. Compras y Suministros',
        contactPhone: '',
        contactEmail: '',
        notes: `Detectado desde orden de compra ${ocNum || ''}`,
        isNapoleon: false,
        source: 'oc' as const,
      };
    }

    // C. Clínica Medellín
    if (/CL[IÍ]NICA\s+MEDELL[IÍ]N/i.test(combined)) {
      return {
        name: 'CLÍNICA MEDELLÍN',
        sede: customerSede || attachment?.customerSede || 'SEDE EL POBLADO',
        nit: '',
        city: 'Medellín',
        department: 'Antioquia',
        address: 'Calle 54 # 46 - 27',
        contactPerson: 'Adquisiciones y Dotaciones',
        contactPhone: '',
        contactEmail: '',
        notes: `Detectado desde orden de compra ${ocNum || ''}`,
        isNapoleon: false,
        source: 'oc' as const,
      };
    }

    // D. Extract client from subject parentheses if present, e.g. "Orden de compra (Clínica El Rosario)"
    const parenMatch = subj.match(/\(([^)]+)\)/);
    if (parenMatch && parenMatch[1].trim().length > 3 && !/SYD|Compras|Cotiz|Solicitud|Excel/i.test(parenMatch[1])) {
      const clientNameParsed = parenMatch[1].trim().toUpperCase();
      return {
        name: clientNameParsed,
        sede: customerSede || attachment?.customerSede || '',
        nit: '',
        city: '',
        department: '',
        address: '',
        contactPerson: '',
        contactPhone: '',
        contactEmail: '',
        notes: `Detectado desde asunto de correo de orden de compra (${ocNum || ''})`,
        isNapoleon: false,
        source: 'oc' as const,
      };
    }

    // E. Explicit non-internal customerName passed
    if (rawCust && rawCust.trim().length > 3 && !/SYD|Suministros|Auditor|Compras|Directas/i.test(rawCust)) {
      return {
        name: rawCust.trim().toUpperCase(),
        sede: customerSede || attachment?.customerSede || '',
        nit: '',
        city: '',
        department: '',
        address: '',
        contactPerson: '',
        contactPhone: '',
        contactEmail: '',
        notes: `Detectado desde correo de orden de compra (${ocNum || ''})`,
        isNapoleon: false,
        source: 'oc' as const,
      };
    }

    return null;
  }, [isCustomerPurchaseOrder, attachment, relatedOrderSubject, relatedOCNumber, relatedSender, customerName, customerSede]);

  const detectedClientName = detectedClientProfile?.name || '';
  const detectedSede = detectedClientProfile?.sede || '';
  const isNapoleonDetected = Boolean(detectedClientProfile?.isNapoleon);

  const resolvedCustomer = detectedClientName || customerName || '';

  // Match in DB
  const matchedClientRecord = useMemo(() => {
    if (!detectedClientName) return null;
    const targetNorm = normalizeClientName(detectedClientName);
    return (
      clientsList.find((c) => {
        const norm = normalizeClientName(c.name);
        return (
          norm === targetNorm ||
          norm.includes(targetNorm) ||
          targetNorm.includes(norm) ||
          (targetNorm.includes('NAPOLEON') && norm.includes('NAPOLEON')) ||
          (targetNorm.includes('INFANTIL') && norm.includes('INFANTIL'))
        );
      }) || null
    );
  }, [clientsList, detectedClientName]);

  const clientStatus = useMemo(() => {
    if (!detectedClientProfile) return null;
    if (matchedClientRecord) {
      return getClientDataStatus(matchedClientRecord);
    }
    return getClientDataStatus({
      name: detectedClientProfile.name,
      sede: detectedClientProfile.sede,
      nit: detectedClientProfile.nit,
      city: detectedClientProfile.city,
      department: detectedClientProfile.department,
      contactPerson: detectedClientProfile.contactPerson,
      contactPhone: detectedClientProfile.contactPhone,
      contactEmail: detectedClientProfile.contactEmail,
    });
  }, [matchedClientRecord, detectedClientProfile]);

  const detectedProfileForModal = useMemo(() => {
    if (!detectedClientProfile) return null;
    return {
      name: detectedClientProfile.name,
      sede: detectedClientProfile.sede,
      nit: detectedClientProfile.nit || '',
      city: detectedClientProfile.city || '',
      department: detectedClientProfile.department || '',
      address: detectedClientProfile.address || '',
      contactPerson: detectedClientProfile.contactPerson || '',
      contactPhone: detectedClientProfile.contactPhone || '',
      contactEmail: detectedClientProfile.contactEmail || '',
      notes: detectedClientProfile.notes || '',
      source: 'oc' as const,
    };
  }, [detectedClientProfile]);

  const handleClientSaved = (savedClient: ClientRecord) => {
    const updated = getStoredClients();
    setClientsList(updated);
    setClientSaveToast(`Cliente "${savedClient.name}" guardado exitosamente en la base de datos.`);
    setTimeout(() => setClientSaveToast(null), 5000);
    if (onClientUpdated) {
      onClientUpdated(savedClient);
    }
  };

  // Load and resolve the attachment blob as soon as modal opens or attachment changes
  useEffect(() => {
    if (!isOpen || !attachment) {
      setBlobResult(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setLoadError(null);
    setExcelSearchQuery('');
    setSelectedSheetIndex(0);
    setZoomLevel(1);

    resolveAttachmentBlob(attachment, {
      subject: relatedOrderSubject || attachment.relatedSubject,
      sender: relatedSender || attachment.relatedSender,
      ocNumber: relatedOCNumber || attachment.relatedOCNumber,
      customerName: resolvedCustomer,
      quoteNumber: quoteNumber || '310826-9',
      items: relatedItems || (attachment.relatedItems as any),
      totalCOP: relatedTotalCOP || attachment.relatedTotalCOP,
      pdfType: pdfViewMode,
    })
      .then((res) => {
        if (isMounted) {
          setBlobResult(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Error resolving attachment blob:', err);
          setLoadError('No se pudo procesar el archivo adjunto');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [
    isOpen,
    attachment,
    relatedOrderSubject,
    relatedSender,
    relatedOCNumber,
    resolvedCustomer,
    quoteNumber,
    relatedItems,
    relatedTotalCOP,
    pdfViewMode,
  ]);

  // Clean up created object URL on unmount or change
  useEffect(() => {
    return () => {
      if (blobResult?.blobUrl) {
        URL.revokeObjectURL(blobResult.blobUrl);
      }
    };
  }, [blobResult]);

  // Active Excel Sheet Data
  const sheetNames = useMemo(() => {
    if (!blobResult?.workbook) return [];
    return blobResult.workbook.SheetNames || [];
  }, [blobResult]);

  const activeSheetRows = useMemo(() => {
    if (!blobResult?.workbook || sheetNames.length === 0) return [];
    const sheetName = sheetNames[selectedSheetIndex] || sheetNames[0];
    const worksheet = blobResult.workbook.Sheets[sheetName];
    if (!worksheet) return [];

    const rawRows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
    }) as any[][];

    return rawRows;
  }, [blobResult, sheetNames, selectedSheetIndex]);

  // Filtered Excel Rows
  const filteredRows = useMemo(() => {
    if (!excelSearchQuery.trim()) return activeSheetRows;
    const q = excelSearchQuery.toLowerCase();
    return activeSheetRows.filter((row) =>
      row.some((cell) => String(cell).toLowerCase().includes(q))
    );
  }, [activeSheetRows, excelSearchQuery]);

  if (!isOpen || !attachment) return null;

  const isPdf =
    blobResult?.isPdf ??
    (attachment.mimeType.toLowerCase().includes('pdf') || attachment.filename.toLowerCase().endsWith('.pdf'));
  const isExcel =
    blobResult?.isExcel ??
    (attachment.mimeType.toLowerCase().includes('spreadsheet') ||
      attachment.mimeType.toLowerCase().includes('excel') ||
      /\.(xlsx|xls|csv)$/i.test(attachment.filename));
  const isImage =
    blobResult?.isImage ??
    (attachment.mimeType.toLowerCase().startsWith('image/') ||
      /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(attachment.filename));

  const formatSize = (bytes?: number) => {
    const b = bytes || blobResult?.size;
    if (!b) return 'Tamaño verificado';
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatCOP = (val?: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val || 0);

  const handleDownload = () => {
    if (!blobResult) return;
    const a = document.createElement('a');
    a.href = blobResult.blobUrl;
    a.download = attachment.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenInNewTab = () => {
    if (!blobResult) return;
    window.open(blobResult.blobUrl, '_blank');
  };

  const handlePrint = () => {
    if (blobResult?.blobUrl) {
      window.open(blobResult.blobUrl, '_blank');
    } else {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/90 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-6xl bg-slate-900 border border-slate-700/90 rounded-2xl shadow-2xl flex flex-col h-[94vh] max-h-[96vh] overflow-hidden">
        {/* Header Bar */}
        <div className="p-3 sm:p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                isPdf
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  : isExcel
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : isImage
                  ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                  : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
              }`}
            >
              {isPdf ? (
                <FileText className="w-5 h-5" />
              ) : isExcel ? (
                <FileSpreadsheet className="w-5 h-5" />
              ) : isImage ? (
                <ImageIcon className="w-5 h-5" />
              ) : (
                <FileCheck className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-md sm:max-w-xl">
                  {attachment.filename}
                </h3>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-semibold">
                  {isPdf ? 'PDF Oficial' : isExcel ? 'Excel Interactivo' : isImage ? 'Imagen' : 'Documento'}
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span>{formatSize(attachment.size)}</span>
                <span>&bull;</span>
                <span className="font-mono text-cyan-300/80">{attachment.mimeType}</span>
                {relatedOCNumber && (
                  <>
                    <span>&bull;</span>
                    <span className="text-slate-300 font-bold">{relatedOCNumber}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Print button */}
            <button
              type="button"
              onClick={handlePrint}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition cursor-pointer border border-slate-700"
              title="Imprimir documento"
            >
              <Printer className="w-3.5 h-3.5 text-cyan-400" />
              <span>Imprimir</span>
            </button>

            {/* Open in new tab button */}
            {blobResult && (
              <button
                type="button"
                onClick={handleOpenInNewTab}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition cursor-pointer border border-slate-700"
                title="Abrir archivo directamente en una pestaña nueva del navegador"
              >
                <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                <span>Nueva Pestaña</span>
              </button>
            )}

            {/* Download button */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={loading || !blobResult}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition cursor-pointer shadow-md"
              title="Descargar archivo auténtico en su equipo"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Descargar</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
              title="Cerrar vista"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* DETECTED CLIENT HEADER CARD (ONLY FOR ACTUAL CLIENT PURCHASE ORDERS)      */}
        {/* ========================================================================= */}
        {isCustomerPurchaseOrder && detectedClientProfile && clientStatus && (
          <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-slate-800 px-3.5 sm:px-4 py-2.5 shrink-0 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Left: Client Name, Logo and Sede */}
              <div className="flex items-center gap-3">
                {isNapoleonDetected ? (
                  /* Casa del Niño Emblem representation */
                  <div
                    className="relative w-10 h-10 rounded-xl bg-slate-950 border border-cyan-500/30 p-1 flex flex-col items-center justify-center shrink-0 shadow-md group cursor-pointer"
                    onClick={() => setIsClientModalOpen(true)}
                    title="Emblema Casa del Niño - Hospital Infantil (Detectado en PDF)"
                  >
                    <div className="grid grid-cols-4 gap-0.5 w-full h-3 rounded-t overflow-hidden">
                      <div className="bg-pink-500 h-full" title="Casa del Niño" />
                      <div className="bg-purple-500 h-full" />
                      <div className="bg-cyan-500 h-full" />
                      <div className="bg-amber-500 h-full" />
                    </div>
                    <div className="w-full bg-blue-900 h-3.5 rounded-b flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-white rounded-xs" />
                    </div>
                  </div>
                ) : (
                  /* Medical / Institutional Building Icon for other hospitals */
                  <div
                    className="w-10 h-10 rounded-xl bg-slate-950 border border-teal-500/30 flex items-center justify-center shrink-0 shadow-md cursor-pointer hover:border-teal-400 transition"
                    onClick={() => setIsClientModalOpen(true)}
                    title={`Cliente detectado: ${detectedClientName}`}
                  >
                    <Building2 className="w-5 h-5 text-teal-400" />
                  </div>
                )}

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/25 flex items-center gap-1">
                      <Sparkles className="w-2.5 h-2.5" /> Cliente Detectado en OC
                    </span>
                    {detectedSede && (
                      <span className="text-[10px] font-semibold text-slate-300 bg-slate-800 px-2 py-0.5 rounded-md border border-slate-700 flex items-center gap-1">
                        <MapPin className="w-2.5 h-2.5 text-cyan-400" /> Sede: {detectedSede}
                      </span>
                    )}
                    {relatedOCNumber && (
                      <span className="text-[10px] font-mono font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        OC {relatedOCNumber}
                      </span>
                    )}
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-white tracking-wide truncate max-w-xl mt-0.5">
                    {detectedClientName}
                  </h4>
                </div>
              </div>

              {/* Right: Database Status & Creation/Edit Button */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Status Pill */}
                {matchedClientRecord ? (
                  <div className="flex items-center gap-2 bg-slate-950/90 border border-slate-800 px-3 py-1.5 rounded-xl">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="hidden sm:inline">En Base de Datos</span>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                        clientStatus.isComplete
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                      }`}
                    >
                      {clientStatus.completionPercentage}% completo
                    </span>

                    {clientStatus.missingFields.length > 0 ? (
                      <span
                        className="text-[11px] text-amber-400 font-medium flex items-center gap-1"
                        title="La app le notificará los datos faltantes hasta que los complete sin inventar información"
                      >
                        <BellRing className="w-3 h-3 text-amber-400" />
                        <span>Faltan: {clientStatus.missingFields.map((f) => f.label).join(', ')}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-400" /> Datos al día
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <div className="text-xs">
                      <span className="text-amber-300 font-bold">No Registrado en Base de Datos</span>
                      <span className="text-slate-400 text-[11px] block">
                        ⚠️ Faltan datos: NIT y Correo (se guardarán en blanco sin inventar)
                      </span>
                    </div>
                  </div>
                )}

                {/* Action Button */}
                <button
                  type="button"
                  onClick={() => setIsClientModalOpen(true)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md ${
                    matchedClientRecord
                      ? 'bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white border border-slate-700 hover:border-cyan-500'
                      : 'bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 shadow-cyan-500/20'
                  }`}
                >
                  {matchedClientRecord ? (
                    <>
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Completar / Editar Datos</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Crear Cliente en Base de Datos</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Toast Notification */}
            {clientSaveToast && (
              <div className="mt-2 p-2 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs flex items-center justify-between animate-fadeIn">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{clientSaveToast}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setClientSaveToast(null)}
                  className="text-emerald-400 hover:text-emerald-200 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Content Viewer Body */}
        <div className="flex-1 flex flex-col min-h-0 bg-slate-950/70 overflow-hidden relative">
          {/* PDF Mode Selector Bar (Original from email vs SYD Digital Format) */}
          {isPdf && !loading && !loadError && (
            <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-bold text-[11px]">Vista del Documento:</span>
                <div className="inline-flex bg-slate-950 p-0.5 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setPdfViewMode('original')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      pdfViewMode === 'original'
                        ? 'bg-rose-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Ver PDF original recibido en el correo oficial del cliente"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>PDF Original del Correo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfViewMode('syd_audit')}
                    className={`px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                      pdfViewMode === 'syd_audit'
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Ver formato digital de radicación y auditoría interna de SYD"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Formato Digital SYD</span>
                  </button>
                </div>
              </div>

              {detectedClientProfile ? (
                <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
                  <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-[11px] text-slate-300">
                    <strong className="text-white">Cliente Emisor:</strong> {detectedClientProfile.name}
                  </span>
                  {relatedOCNumber && (
                    <span className="text-[11px] text-amber-300 font-mono font-bold">
                      • No. {relatedOCNumber}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-800">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-[11px] text-slate-300 font-mono truncate max-w-xs">
                    {attachment.filename}
                  </span>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-3">
              <Loader2 className="w-9 h-9 text-cyan-400 animate-spin" />
              <p className="text-sm font-semibold text-white">Procesando y cargando archivo adjunto oficial...</p>
              <p className="text-xs text-slate-400 font-mono">{attachment.filename}</p>
            </div>
          ) : loadError ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/30">
                <X className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">Error al cargar archivo</h4>
              <p className="text-xs text-slate-400 max-w-md">{loadError}</p>
            </div>
          ) : isPdf && blobResult ? (
            /* ========================================================================= */
            /* 1. NATIVE HTML5 CANVAS PDF VIEWER (NO PLUGIN, NEVER BLOCKED BY CHROME)   */
            /* ========================================================================= */
            <PdfCanvasViewer
              blob={blobResult.blob}
              filename={attachment.filename}
              blobUrl={blobResult.blobUrl}
              onDownload={handleDownload}
              onOpenInNewTab={handleOpenInNewTab}
            />
          ) : isExcel && blobResult ? (
            /* ========================================================================= */
            /* 2. EXCEL AUTHENTIC INTERACTIVE SPREADSHEET VIEWER                         */
            /* ========================================================================= */
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Excel Controls Toolbar */}
              <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
                {/* Sheet Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1 sm:pb-0">
                  <div className="flex items-center gap-1.5 mr-2 text-xs font-bold text-emerald-400">
                    <TableIcon className="w-4 h-4" />
                    <span className="hidden sm:inline">Hojas:</span>
                  </div>
                  {sheetNames.map((name, sIdx) => (
                    <button
                      key={sIdx}
                      type="button"
                      onClick={() => setSelectedSheetIndex(sIdx)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                        selectedSheetIndex === sIdx
                          ? 'bg-emerald-500 text-slate-950 shadow-xs'
                          : 'bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>

                {/* Filter and stats */}
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={excelSearchQuery}
                      onChange={(e) => setExcelSearchQuery(e.target.value)}
                      placeholder="Buscar en la hoja..."
                      className="pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 w-44 sm:w-56"
                    />
                  </div>
                  <span className="text-xs text-slate-400 font-mono hidden md:inline">
                    {filteredRows.length} filas
                  </span>
                </div>
              </div>

              {/* Spreadsheet Grid Table */}
              <div className="flex-1 overflow-auto bg-slate-950 p-3 sm:p-4">
                {filteredRows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400">
                    <Search className="w-8 h-8 text-slate-600 mb-2" />
                    <p className="text-sm font-semibold">No se encontraron filas que coincidan</p>
                  </div>
                ) : (
                  <div className="border border-slate-800 rounded-xl overflow-hidden shadow-md bg-slate-900">
                    <table className="w-full border-collapse text-left text-xs font-sans">
                      <tbody>
                        {filteredRows.map((row, rIdx) => {
                          const isFirstRowHeader = rIdx === 0 || rIdx === 6;
                          const isTitleRow = rIdx < 5;

                          return (
                            <tr
                              key={rIdx}
                              className={`border-b border-slate-800/80 transition ${
                                isFirstRowHeader
                                  ? 'bg-slate-950 font-bold text-cyan-300'
                                  : isTitleRow
                                  ? 'bg-slate-900/60 font-semibold text-slate-200'
                                  : rIdx % 2 === 0
                                  ? 'bg-slate-900/30 hover:bg-slate-800/60 text-slate-200'
                                  : 'bg-slate-950/40 hover:bg-slate-800/60 text-slate-200'
                              }`}
                            >
                              {/* Row number column */}
                              <td className="w-10 px-2 py-2 text-center font-mono text-[10px] text-slate-500 bg-slate-950/90 select-none border-r border-slate-800">
                                {rIdx + 1}
                              </td>

                              {row.map((cell: any, cIdx: number) => {
                                const isNumber = typeof cell === 'number';
                                const strVal = String(cell);
                                const isMoney = isNumber && cell > 1000;

                                return (
                                  <td
                                    key={cIdx}
                                    className={`px-3 py-2 border-r border-slate-800/60 select-text whitespace-nowrap truncate max-w-[280px] ${
                                      isFirstRowHeader
                                        ? 'text-cyan-300 font-bold'
                                        : isMoney
                                        ? 'font-mono text-emerald-300 text-right'
                                        : isNumber
                                        ? 'font-mono text-right'
                                        : 'text-slate-200'
                                    }`}
                                    title={strVal}
                                  >
                                    {isMoney
                                      ? new Intl.NumberFormat('es-CO', {
                                          style: 'currency',
                                          currency: 'COP',
                                          maximumFractionDigits: 0,
                                        }).format(cell)
                                      : strVal}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : isImage && blobResult ? (
            /* ========================================================================= */
            /* 3. IMAGE AUTHENTIC VIEWER                                                 */
            /* ========================================================================= */
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Zoom Toolbar */}
              <div className="px-4 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
                <span className="text-xs text-slate-400 font-medium">Visualizador de Imagen</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.max(0.4, z - 0.2))}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                    title="Reducir zoom"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono text-slate-300 min-w-[50px] text-center">
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomLevel((z) => Math.min(3, z + 0.2))}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                    title="Aumentar zoom"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setZoomLevel(1)}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer ml-1"
                    title="Restablecer zoom"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Scrollable image canvas */}
              <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-slate-950">
                <img
                  src={blobResult.blobUrl}
                  alt={attachment.filename}
                  style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
                  className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-2xl transition-transform duration-150"
                />
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* 4. GENERIC DOCUMENT PREVIEW & DOWNLOAD CARD                               */
            /* ========================================================================= */
            <div className="flex-1 overflow-y-auto p-6 flex items-center justify-center">
              <div className="max-w-xl w-full bg-slate-900/90 border border-slate-700 rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
                    <FileCheck className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white">{attachment.filename}</h4>
                    <p className="text-xs text-slate-400">{formatSize(attachment.size)} • {attachment.mimeType}</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Archivo listo para descarga y visualización externa</span>
                  </div>
                  <p className="text-slate-400">
                    Este documento puede ser abierto directamente en las aplicaciones nativas de su computador (Adobe Reader, Microsoft Excel, etc.).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleDownload}
                  className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm transition cursor-pointer shadow-lg flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar Archivo Oficial</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* QUICK CLIENT REGISTRATION & DATA COMPLETION MODAL                         */}
      {/* ========================================================================= */}
      {isClientModalOpen && detectedProfileForModal && (
        <ClientQuickCreateModal
          isOpen={isClientModalOpen}
          onClose={() => setIsClientModalOpen(false)}
          detectedData={detectedProfileForModal}
          existingClient={matchedClientRecord}
          onClientSaved={handleClientSaved}
        />
      )}
    </div>
  );
};
