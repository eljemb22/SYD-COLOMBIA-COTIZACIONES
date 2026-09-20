import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Tag,
  Package,
  Sparkles,
  FileText,
  DollarSign,
  Plus,
  Trash2,
  CheckCircle2,
  Hash,
  AlertCircle,
  Building,
  Building2,
  ShieldCheck,
  Calendar,
  Eye,
  Download,
  Paperclip,
  MessageSquare,
  CornerDownRight,
  FileSpreadsheet,
  Image as ImageIcon,
  Clock,
  BookOpen,
} from 'lucide-react';
import {
  DetectedPurchaseOrder,
  DetectedPartToImport,
  DetectedPurchaseOrderItem,
} from '../../services/gmailIntegrationService';
import { splitEmailThread, cleanEmailText } from '../../utils/emailThreadUtils';
import { AttachmentViewerModal, ViewableAttachment } from './AttachmentViewerModal';
import { CleanEmailReader } from './CleanEmailReader';

interface EditDetectedOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: DetectedPurchaseOrder;
  onSaveOrder: (updatedOrder: DetectedPurchaseOrder) => void;
  onOpenPartEdit?: (part: DetectedPartToImport) => void;
}

export const EditDetectedOrderModal: React.FC<EditDetectedOrderModalProps> = ({
  isOpen,
  onClose,
  order,
  onSaveOrder,
  onOpenPartEdit,
}) => {
  const [emailType, setEmailType] = useState<
    'part_creation_response' | 'part_authorization' | 'oc_response' | 'general_po' | 'client_po' | 'documentation' | 'meeting_invite' | 'other'
  >('general_po');
  const [detectedOCNumber, setDetectedOCNumber] = useState('');
  const [detectedCustomer, setDetectedCustomer] = useState('');
  const [detectedEstimatedTotal, setDetectedEstimatedTotal] = useState<number>(0);
  const [urgency, setUrgency] = useState<'Alta' | 'Media' | 'Baja'>('Media');
  const [items, setItems] = useState<DetectedPurchaseOrderItem[]>([]);
  const [parts, setParts] = useState<DetectedPartToImport[]>([]);
  const [selectedAttachmentForPreview, setSelectedAttachmentForPreview] = useState<ViewableAttachment | null>(null);
  const [panelLayout, setPanelLayout] = useState<'split' | 'email_expanded' | 'form_expanded'>('split');

  useEffect(() => {
    if (order) {
      setEmailType(
        order.emailType ||
          (order.detectedPartsToImport && order.detectedPartsToImport.length > 0
            ? 'part_creation_response'
            : 'general_po')
      );
      setDetectedOCNumber(order.detectedOCNumber || '');
      setDetectedCustomer(order.detectedCustomer || order.senderName || '');
      setDetectedEstimatedTotal(order.detectedEstimatedTotal || 0);
      setUrgency(order.urgency || 'Media');
      setItems(order.detectedItems ? JSON.parse(JSON.stringify(order.detectedItems)) : []);
      setParts(order.detectedPartsToImport ? JSON.parse(JSON.stringify(order.detectedPartsToImport)) : []);
    }
  }, [order]);

  if (!isOpen) return null;

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const handleAddItem = () => {
    const newItem: DetectedPurchaseOrderItem = {
      description: 'Nuevo Equipo / Insumo',
      quantity: 1,
      unitPrice: 1000000,
      totalPrice: 1000000,
      brand: order.senderName || 'SYD',
      model: 'Estándar',
    };
    const updated = [...items, newItem];
    setItems(updated);
    recalculateTotal(updated);
  };

  const handleRemoveItem = (idx: number) => {
    const updated = items.filter((_, i) => i !== idx);
    setItems(updated);
    recalculateTotal(updated);
  };

  const handleItemChange = (idx: number, field: keyof DetectedPurchaseOrderItem, value: any) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    if (field === 'quantity' || field === 'unitPrice') {
      const q = field === 'quantity' ? Number(value) : updated[idx].quantity;
      const p = field === 'unitPrice' ? Number(value) : (updated[idx].unitPrice || 0);
      updated[idx].totalPrice = q * p;
    }
    setItems(updated);
    recalculateTotal(updated);
  };

  const recalculateTotal = (currentItems: DetectedPurchaseOrderItem[]) => {
    const total = currentItems.reduce((sum, it) => sum + (it.totalPrice || (it.quantity * (it.unitPrice || 0))), 0);
    if (total > 0) {
      setDetectedEstimatedTotal(total);
    }
  };

  const handleAddPartQuick = () => {
    const newPart: DetectedPartToImport = {
      code: `PARTE-${Math.floor(1000 + Math.random() * 9000)}`,
      name: 'Nueva Parte Solicitada',
      brand: order.partCreationNotice?.requestedItem?.brand || order.detectedPartsToImport?.[0]?.brand || '',
      model: order.partCreationNotice?.requestedItem?.model || order.detectedPartsToImport?.[0]?.model || 'Estándar',
      baseCostCOP: 0,
      taxExempt: false,
      taxRate: 0.19,
      supplier: order.partCreationNotice?.requestedItem?.supplier || order.detectedPartsToImport?.[0]?.supplier || '',
      category: 'Accesorios',
      invimaRecordNumber: 'INVIMA 2021EBC-0008450',
      description: 'Parte creada desde correo de compras',
    };
    setParts([...parts, newPart]);
  };

  const handleRemovePart = (idx: number) => {
    setParts(parts.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    const isDoc = emailType === 'documentation';
    const updatedOrder: DetectedPurchaseOrder = {
      ...order,
      emailType,
      detectedOCNumber: isDoc ? undefined : (detectedOCNumber.trim() || undefined),
      detectedCustomer: detectedCustomer.trim() || undefined,
      detectedEstimatedTotal: isDoc ? undefined : (Number(detectedEstimatedTotal) || undefined),
      urgency,
      detectedItems: isDoc ? [] : items,
      detectedPartsToImport: emailType === 'part_creation_response' ? parts : isDoc ? undefined : parts.length > 0 ? parts : undefined,
    };

    onSaveOrder(updatedOrder);
    onClose();
  };

  // Parse email body into structured messages for the thread / cola de correos
  const rawBody = order.rawBodyText || order.snippet || '';
  const threadMessages = splitEmailThread(rawBody, order.senderName || order.sender, order.date);
  const isThread = threadMessages.length > 1;

  const attachments = order.attachments || [];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
        <div className="relative w-full max-w-7xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[94vh] max-h-[96vh]">
          {/* Header */}
          <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2 truncate">
                  <span>Modificar Detección y Lectura de Correo</span>
                </h2>
                <p className="text-xs text-slate-400 truncate hidden sm:block">
                  Lectura legible del correo, cola de mensajes y ajuste de equipos, partes o clasificación
                </p>
              </div>
            </div>

            {/* Layout Switcher Buttons: Split, Full Email, Full Form */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setPanelLayout('split')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    panelLayout === 'split'
                      ? 'bg-cyan-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="Vista dividida: Correo a la izquierda y Detección a la derecha"
                >
                  Dividida
                </button>
                <button
                  type="button"
                  onClick={() => setPanelLayout('email_expanded')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    panelLayout === 'email_expanded'
                      ? 'bg-cyan-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="Ampliar vista del correo para máxima legibilidad"
                >
                  <span>Ampliar Correo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPanelLayout('form_expanded')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    panelLayout === 'form_expanded'
                      ? 'bg-cyan-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title="Ver solo formulario de ajustes de detección"
                >
                  Solo Ajustes
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="Cerrar modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body: Responsive Layout according to panelLayout */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-slate-950/40">
            {/* LEFT COLUMN: Large, Readable Email Viewer & Thread Chain */}
            <div
              className={`space-y-4 flex flex-col ${
                panelLayout === 'email_expanded'
                  ? 'lg:col-span-12'
                  : panelLayout === 'form_expanded'
                  ? 'hidden'
                  : 'lg:col-span-7'
              }`}
            >
              {/* Email Meta Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">
                      Asunto del Correo
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-white leading-snug break-words">
                      {order.subject}
                    </h3>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 ${
                      order.urgency === 'Alta'
                        ? 'bg-rose-950/60 border-rose-500/50 text-rose-300'
                        : order.urgency === 'Media'
                        ? 'bg-amber-950/60 border-amber-500/50 text-amber-300'
                        : 'bg-slate-800 border-slate-700 text-slate-300'
                    }`}
                  >
                    Urgencia: {order.urgency}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300 pt-2 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5 truncate">
                    <Building className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-slate-400">De:</span>
                    <strong className="text-white truncate">{order.senderName || order.sender}</strong>
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-slate-400">Fecha:</span>
                    <strong className="text-slate-200">{order.date || 'Reciente'}</strong>
                  </div>
                </div>
              </div>

              {/* Dedicated Clean Email Reader with Thread separation and font size control */}
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Texto del Correo y Cola de Mensajes
                    </h4>
                  </div>
                  {panelLayout !== 'email_expanded' && (
                    <button
                      type="button"
                      onClick={() => setPanelLayout('email_expanded')}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                    >
                      Ampliar a pantalla completa &rarr;
                    </button>
                  )}
                </div>

                <CleanEmailReader
                  rawText={order.rawBodyText || order.snippet || ''}
                  rawHtml={order.rawHtml}
                  senderName={order.senderName || order.sender}
                  senderEmail={order.senderEmail}
                  dateStr={order.date}
                />
              </div>

              {/* Attachments Section */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-cyan-400" />
                    <span>Archivos Adjuntos del Correo ({attachments.length})</span>
                  </span>
                  {attachments.length === 0 && (
                    <span className="text-[11px] text-slate-500">Sin archivos adjuntos</span>
                  )}
                </div>

                {attachments.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {attachments.map((att, attIdx) => {
                      const isPdf = att.filename.toLowerCase().endsWith('.pdf');
                      const isExcel = /\.(xlsx|xls|csv)$/i.test(att.filename);
                      const isImg = /\.(jpg|jpeg|png|webp)$/i.test(att.filename);

                      return (
                        <div
                          key={attIdx}
                          className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-2.5 transition group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isPdf
                                  ? 'bg-rose-500/20 text-rose-400'
                                  : isExcel
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : isImg
                                  ? 'bg-purple-500/20 text-purple-400'
                                  : 'bg-cyan-500/20 text-cyan-400'
                              }`}
                            >
                              {isPdf ? (
                                <FileText className="w-4 h-4" />
                              ) : isExcel ? (
                                <FileSpreadsheet className="w-4 h-4" />
                              ) : isImg ? (
                                <ImageIcon className="w-4 h-4" />
                              ) : (
                                <Paperclip className="w-4 h-4" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-cyan-300 transition">
                                {att.filename}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {att.size ? `${(att.size / 1024).toFixed(1)} KB` : 'Archivo adjunto'}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setSelectedAttachmentForPreview({
                                ...att,
                                messageId: order.messageId,
                                relatedSubject: order.subject,
                                relatedSender: order.senderName || order.sender,
                                relatedOCNumber: order.detectedOCNumber,
                                relatedItems: order.detectedItems,
                                relatedTotalCOP: order.detectedEstimatedTotal,
                              })
                            }
                            className="p-1.5 bg-slate-800 hover:bg-cyan-600 hover:text-slate-950 text-cyan-300 rounded-lg transition cursor-pointer shrink-0"
                            title="Ver archivo adjunto tal como fue enviado (PDF / Excel auténtico)"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Este correo no incluye adjuntos descargables. Toda la información clave se encuentra en el cuerpo del mensaje.
                  </p>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Classification, Items & Form Fields */}
            <div
              className={`space-y-5 ${
                panelLayout === 'form_expanded'
                  ? 'lg:col-span-12'
                  : panelLayout === 'email_expanded'
                  ? 'hidden'
                  : 'lg:col-span-5'
              }`}
            >
              {/* Classification Selection */}
              <div className="space-y-2 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <label className="block text-xs font-bold text-slate-200">
                  Clasificación del Proceso
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {/* Option 1: Creación de parte */}
                  <button
                    type="button"
                    onClick={() => setEmailType('part_creation_response')}
                    className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                      emailType === 'part_creation_response'
                        ? 'bg-emerald-950/60 border-emerald-400 text-white shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        emailType === 'part_creation_response'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Creación de Parte Aprobada</div>
                      <div className="text-[11px] text-slate-400 leading-snug">
                        Compras asignó número de parte para crear en catálogo.
                      </div>
                    </div>
                  </button>

                  {/* Option 2: Autorización de parte */}
                  <button
                    type="button"
                    onClick={() => setEmailType('part_authorization')}
                    className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                      emailType === 'part_authorization'
                        ? 'bg-amber-950/60 border-amber-400 text-white shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        emailType === 'part_authorization'
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Autorización de Parte</div>
                      <div className="text-[11px] text-slate-400 leading-snug">
                        Solicitud o visto bueno para autorizar compra o cotización.
                      </div>
                    </div>
                  </button>

                  {/* Option 3: Orden de Compra (OC) */}
                  <button
                    type="button"
                    onClick={() => setEmailType('general_po')}
                    className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                      emailType === 'general_po' || emailType === 'oc_response'
                        ? 'bg-cyan-950/60 border-cyan-400 text-white shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        emailType === 'general_po' || emailType === 'oc_response'
                          ? 'bg-cyan-500/20 text-cyan-400'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Nueva Orden de Compra (OC)</div>
                      <div className="text-[11px] text-slate-400 leading-snug">
                        Orden de compra formal con ítems o equipos solicitados.
                      </div>
                    </div>
                  </button>

                  {/* Option 4: Orden de Compra de Cliente */}
                  <button
                    type="button"
                    onClick={() => setEmailType('client_po')}
                    className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                      emailType === 'client_po'
                        ? 'bg-emerald-950/60 border-emerald-400 text-white shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        emailType === 'client_po'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Orden de Compra de Cliente</div>
                      <div className="text-[11px] text-slate-400 leading-snug">
                        OC recibida de cliente (radica en Contratos y genera OCs a proveedores).
                      </div>
                    </div>
                  </button>

                  {/* Option 5: Documentación Técnica */}
                  <button
                    type="button"
                    onClick={() => setEmailType('documentation')}
                    className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                      emailType === 'documentation'
                        ? 'bg-indigo-950/60 border-indigo-400 text-white shadow-md'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg shrink-0 ${
                        emailType === 'documentation'
                          ? 'bg-indigo-500/20 text-indigo-400'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      <BookOpen className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Documentación Técnica</div>
                      <div className="text-[11px] text-slate-400 leading-snug">
                        No es orden de compra; son fichas técnicas, INVIMA o anexos para radicar en Documentación Técnica.
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Mode 1: Documentación Técnica Panel */}
              {emailType === 'documentation' ? (
                <div className="space-y-3 bg-slate-950 p-4 rounded-xl border border-indigo-500/40">
                  <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
                    <BookOpen className="w-4 h-4 text-indigo-400" />
                    <span>Expediente de Documentación Técnica</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Este correo contiene archivos técnicos y documentación. No constituye una orden de compra mercantil ni generará requerimientos de compras pendientes.
                  </p>
                  <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-[11px] text-indigo-200">
                    💡 Al guardar esta clasificación, podrás radicar todos los anexos directamente en el repositorio de <strong>Documentación Técnica</strong> con un solo clic.
                  </div>
                </div>
              ) : emailType === 'part_creation_response' ? (
                <div className="space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      <span>Partes Asignadas por Compras ({parts.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleAddPartQuick}
                      className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Nueva Parte</span>
                    </button>
                  </div>

                  {parts.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                      No hay partes configuradas. Haz clic en &quot;Nueva Parte&quot; para agregar el código asignado.
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {parts.map((p, pIdx) => (
                        <div
                          key={pIdx}
                          className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <input
                              type="text"
                              value={p.code}
                              onChange={(e) => {
                                const up = [...parts];
                                up[pIdx].code = e.target.value;
                                setParts(up);
                              }}
                              placeholder="Código Parte (ej: 70860)"
                              className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-cyan-300 font-mono font-bold w-36"
                            />
                            <div className="flex items-center gap-1">
                              {onOpenPartEdit && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onOpenPartEdit(p);
                                    onClose();
                                  }}
                                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded text-[11px] font-semibold transition"
                                >
                                  Editar Completo
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleRemovePart(pIdx)}
                                className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <input
                            type="text"
                            value={p.name}
                            onChange={(e) => {
                              const up = [...parts];
                              up[pIdx].name = e.target.value;
                              setParts(up);
                            }}
                            placeholder="Nombre oficial de la parte"
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* Mode 2: General OC Config */
                <div className="space-y-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                        <Hash className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Número de OC</span>
                      </label>
                      <input
                        type="text"
                        value={detectedOCNumber}
                        onChange={(e) => setDetectedOCNumber(e.target.value)}
                        placeholder="Ej: 125897 o OC-0441"
                        className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Monto Estimado COP</span>
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={detectedEstimatedTotal || ''}
                        onChange={(e) => setDetectedEstimatedTotal(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                      <Building className="w-3.5 h-3.5 text-purple-400" />
                      <span>Proveedor o Cliente</span>
                    </label>
                    <input
                      type="text"
                      value={detectedCustomer}
                      onChange={(e) => setDetectedCustomer(e.target.value)}
                      placeholder="Ej: Jaime Luis Gonzales Gomez / Compras SYD"
                      className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white"
                    />
                  </div>

                  {/* Items list */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1">
                        <Package className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Ítems / Equipos ({items.length})</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="inline-flex items-center gap-1 bg-cyan-600 hover:bg-cyan-500 text-slate-950 px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Agregar Ítem</span>
                      </button>
                    </div>

                    {items.length === 0 ? (
                      <div className="p-3 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                        No hay ítems detallados en esta orden.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {items.map((it, itIdx) => (
                          <div
                            key={itIdx}
                            className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                value={it.quantity}
                                onChange={(e) => handleItemChange(itIdx, 'quantity', parseInt(e.target.value) || 1)}
                                className="w-14 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-bold text-center"
                                title="Cantidad"
                              />
                              <input
                                type="text"
                                value={it.description}
                                onChange={(e) => handleItemChange(itIdx, 'description', e.target.value)}
                                placeholder="Descripción del equipo"
                                className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(itIdx)}
                                className="p-1 text-red-400 hover:text-red-300 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                              <span>Precio:</span>
                              <input
                                type="number"
                                value={it.unitPrice || 0}
                                onChange={(e) => handleItemChange(itIdx, 'unitPrice', parseFloat(e.target.value) || 0)}
                                className="w-32 bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-emerald-300 font-mono text-right"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs rounded-xl shadow-lg transition cursor-pointer active:scale-95"
            >
              <Save className="w-4 h-4 stroke-[2.5]" />
              <span>Guardar Ajustes de Detección</span>
            </button>
          </div>
        </div>
      </div>

      {/* Attachment Preview Modal */}
      {selectedAttachmentForPreview && (
        <AttachmentViewerModal
          isOpen={!!selectedAttachmentForPreview}
          onClose={() => setSelectedAttachmentForPreview(null)}
          attachment={selectedAttachmentForPreview}
          relatedOrderSubject={order.subject}
          relatedSender={order.senderName || order.sender}
          relatedOCNumber={order.detectedOCNumber}
          relatedItems={order.detectedItems}
          relatedTotalCOP={order.detectedEstimatedTotal}
        />
      )}
    </>
  );
};
