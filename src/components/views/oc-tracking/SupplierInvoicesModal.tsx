import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  FileText,
  Upload,
  Download,
  Trash2,
  Eye,
  CheckCircle2,
  DollarSign,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  FileCheck,
  Building2,
  Plus,
} from 'lucide-react';
import { SupplierInvoiceAttachment } from '../../../types';
import { formatCOP, formatExactCOP, cleanNumericString } from '../../../utils/formatters';

interface SupplierInvoicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: string;
  ocNumber: string;
  clientName?: string;
  contractNumber?: string;
  invoices: SupplierInvoiceAttachment[];
  onSaveInvoices: (updatedInvoices: SupplierInvoiceAttachment[]) => void;
  isReadOnly?: boolean;
}

export const SupplierInvoicesModal: React.FC<SupplierInvoicesModalProps> = ({
  isOpen,
  onClose,
  supplier,
  ocNumber,
  clientName,
  contractNumber,
  invoices = [],
  onSaveInvoices,
  isReadOnly = false,
}) => {
  const [invoiceList, setInvoiceList] = useState<SupplierInvoiceAttachment[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);

  // New Invoice Form state
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [amountCOP, setAmountCOP] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    type: string;
    size: number;
    data: string;
  } | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Preview file modal state
  const [previewItem, setPreviewItem] = useState<SupplierInvoiceAttachment | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInvoiceList(invoices || []);
      setShowAddForm(invoices.length === 0 && !isReadOnly);
      setInvoiceNumber('');
      setAmountCOP(0);
      setNotes('');
      setSelectedFile(null);
      setFormError(null);
    }
  }, [isOpen, invoices, isReadOnly]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewItem) {
          setPreviewItem(null);
        } else {
          onClose();
        }
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, previewItem, onClose]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setFormError('El archivo es demasiado grande (máximo 15MB).');
      return;
    }

    setIsProcessingFile(true);
    setFormError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setSelectedFile({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        data: dataUrl,
      });
      setIsProcessingFile(false);
    };
    reader.onerror = () => {
      setFormError('Error al leer el archivo. Intente con otro archivo.');
      setIsProcessingFile(false);
    };
    reader.readAsDataURL(file);
  };

  const handleAddInvoice = (e: React.FormEvent) => {
    e.preventDefault();

    if (!invoiceNumber.trim()) {
      setFormError('Por favor ingrese el número de factura del proveedor.');
      return;
    }

    if (!selectedFile) {
      setFormError('Por favor adjunte el archivo o PDF de la factura del proveedor.');
      return;
    }

    const newInvoice: SupplierInvoiceAttachment = {
      id: `sinv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      invoiceNumber: invoiceNumber.trim().toUpperCase(),
      issueDate: issueDate || new Date().toISOString().split('T')[0],
      amountCOP: Number(amountCOP) || 0,
      fileName: selectedFile.name,
      fileData: selectedFile.data,
      fileType: selectedFile.type,
      fileSize: selectedFile.size,
      notes: notes.trim(),
      uploadedAt: new Date().toISOString(),
      uploadedBy: 'Usuario SyD',
    };

    const updated = [newInvoice, ...invoiceList];
    setInvoiceList(updated);
    onSaveInvoices(updated);

    // Reset form
    setInvoiceNumber('');
    setAmountCOP(0);
    setNotes('');
    setSelectedFile(null);
    setShowAddForm(false);
    setFormError(null);
  };

  const handleDeleteInvoice = (id: string) => {
    if (!window.confirm('¿Está seguro de eliminar esta factura adjunta del proveedor?')) return;
    const updated = invoiceList.filter((inv) => inv.id !== id);
    setInvoiceList(updated);
    onSaveInvoices(updated);
  };

  const handleDownloadFile = (inv: SupplierInvoiceAttachment) => {
    if (!inv.fileData) return;
    const link = document.createElement('a');
    link.href = inv.fileData;
    link.download = inv.fileName || `Factura-${inv.invoiceNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalInvoicedCOP = invoiceList.reduce((acc, inv) => acc + (inv.amountCOP || 0), 0);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/25 overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#0f192b] border border-[#233a59] rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 bg-[#14233a] border-b border-[#233a59] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-black text-indigo-300 bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-500/40">
                  FACTURAS DEL PROVEEDOR
                </span>
                <span className="font-mono text-xs font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-500/40">
                  OC: {ocNumber && ocNumber !== 'Sin N° OC' ? ocNumber : 'Sin N° asignado'}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-1">
                {supplier || 'Proveedor Sin Asignar'}
              </h2>
              {(clientName || contractNumber) && (
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Destino: <strong className="text-slate-300">{clientName || 'Cliente'}</strong>
                  {contractNumber && ` • Contrato / Proceso: ${contractNumber}`}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#1a2d48] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SUMMARY STATS BAR */}
        <div className="px-5 py-3 bg-[#0d1626] border-b border-[#1f334f] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <span className="text-slate-400 block text-[10.5px]">Facturas Anexadas:</span>
              <strong className="text-white font-black text-sm">
                {invoiceList.length} {invoiceList.length === 1 ? 'Factura' : 'Facturas'}
              </strong>
            </div>
            {totalInvoicedCOP > 0 && (
              <div className="pl-3 border-l border-[#223956]">
                <span className="text-slate-400 block text-[10.5px]">Monto Total Facturado COP:</span>
                <strong className="text-emerald-400 font-mono font-black text-sm">
                  {formatCOP(totalInvoicedCOP)}
                </strong>
              </div>
            )}
          </div>

          {!isReadOnly && !showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer shadow-sm active:scale-95"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Anexar Nueva Factura</span>
            </button>
          )}
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* ADD INVOICE FORM */}
          {showAddForm && !isReadOnly && (
            <form
              onSubmit={handleAddInvoice}
              className="bg-[#132035] border border-indigo-500/40 rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg animate-fadeIn"
            >
              <div className="flex items-center justify-between border-b border-[#233a59] pb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Anexar Factura Emitida por {supplier}</span>
                </h3>
                {invoiceList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                )}
              </div>

              {formError && (
                <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    N° Factura del Proveedor *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: FAC-9820, FE-10492"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="w-full bg-[#0a1322] border border-[#2a4366] focus:border-indigo-400 rounded-xl p-2.5 text-white font-mono font-bold outline-none uppercase"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Fecha de Emisión
                  </label>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full bg-[#0a1322] border border-[#2a4366] focus:border-indigo-400 rounded-xl p-2.5 text-white outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Valor Facturado COP ($)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-emerald-400">
                      $
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={cleanNumericString(amountCOP) === '0' || !cleanNumericString(amountCOP) ? '' : cleanNumericString(amountCOP)}
                      onChange={(e) => {
                        const clean = cleanNumericString(e.target.value);
                        setAmountCOP(clean === '' ? 0 : Number(clean));
                      }}
                      className="w-full bg-[#0a1322] border border-[#2a4366] focus:border-emerald-400 rounded-xl pl-7 pr-2.5 py-2.5 text-white font-mono font-bold outline-none"
                    />
                  </div>
                  {amountCOP > 0 && (
                    <span className="text-[10px] text-emerald-300 font-mono block mt-1">
                      {formatExactCOP(amountCOP)}
                    </span>
                  )}
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-slate-300 font-bold mb-1">
                    Archivo de la Factura (PDF, Imagen, etc.) *
                  </label>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/jpg,image/webp,.docx,.xlsx"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {!selectedFile ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-[#2d476c] hover:border-indigo-400/80 rounded-xl p-4 text-center cursor-pointer transition bg-[#0a1322]/80 hover:bg-[#111e33]"
                    >
                      <Upload className="w-5 h-5 text-indigo-400 mx-auto mb-1.5" />
                      <p className="text-xs font-bold text-white">
                        Haga clic para seleccionar o arrastre el archivo de la factura
                      </p>
                      <p className="text-[10.5px] text-slate-400 mt-0.5">
                        Formatos soportados: PDF, JPG, PNG, WEBP (hasta 15MB)
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-[#0a1322] border border-indigo-500/40">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileCheck className="w-5 h-5 text-indigo-400 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-bold text-white text-xs truncate">
                            {selectedFile.name}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono">
                            {(selectedFile.size / 1024).toFixed(1)} KB • {selectedFile.type || 'Archivo'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="p-1.5 text-slate-400 hover:text-rose-300 hover:bg-rose-500/20 rounded-lg transition"
                        title="Quitar archivo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-slate-300 font-bold mb-1">
                    Observaciones / Notas (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Factura parcial correspondiente al lote 1 de entrega..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full bg-[#0a1322] border border-[#2a4366] focus:border-indigo-400 rounded-xl p-2.5 text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#233a59]">
                {invoiceList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isProcessingFile}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
                >
                  <FileText className="w-4 h-4" />
                  <span>Guardar y Anexar Factura</span>
                </button>
              </div>
            </form>
          )}

          {/* ATTACHED INVOICES LIST */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Facturas Registradas ({invoiceList.length})</span>
              <span className="text-[10px] text-slate-400 font-normal">
                Puede adjuntar múltiples facturas generadas por el mismo proveedor
              </span>
            </h3>

            {invoiceList.length === 0 ? (
              <div className="text-center py-8 bg-[#121c2e] rounded-xl border border-dashed border-[#233a59] p-5 space-y-2">
                <FileText className="w-8 h-8 text-slate-400 mx-auto opacity-60" />
                <p className="text-xs font-bold text-slate-300">
                  No hay facturas del proveedor anexadas aún a esta OC
                </p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  Anexe las facturas electrónicas o soportes en PDF emitidos por el proveedor para respaldar los costos y auditoría.
                </p>
                {!isReadOnly && !showAddForm && (
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Anexar Primera Factura</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-[#213550] bg-[#121c2e] border border-[#233a59] rounded-xl overflow-hidden shadow-sm">
                {invoiceList.map((inv) => (
                  <div
                    key={inv.id}
                    className="p-3 sm:p-4 hover:bg-[#16243a] transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0 mt-0.5">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-black text-indigo-300 bg-indigo-950/90 px-2 py-0.5 rounded border border-indigo-500/50">
                            {inv.invoiceNumber}
                          </span>
                          {inv.issueDate && (
                            <span className="text-[11px] text-slate-300 flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {inv.issueDate}
                            </span>
                          )}
                          {inv.amountCOP !== undefined && inv.amountCOP > 0 && (
                            <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-500/40">
                              {formatCOP(inv.amountCOP)}
                            </span>
                          )}
                        </div>

                        <p className="text-xs font-bold text-white truncate">
                          {inv.fileName}
                        </p>

                        {inv.notes && (
                          <p className="text-[11px] text-slate-300 italic">
                            «{inv.notes}»
                          </p>
                        )}

                        <p className="text-[10px] text-slate-400 font-mono">
                          {inv.fileSize ? `${(inv.fileSize / 1024).toFixed(1)} KB • ` : ''}
                          Anexada: {inv.uploadedAt ? inv.uploadedAt.split('T')[0] : 'Hoy'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      {inv.fileData && (
                        <>
                          <button
                            type="button"
                            onClick={() => setPreviewItem(inv)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-900/50 text-indigo-300 hover:text-white border border-[#2b4468] transition cursor-pointer text-xs font-bold flex items-center gap-1"
                            title="Visualizar documento"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(inv)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-900/50 text-emerald-300 hover:text-white border border-[#2b4468] transition cursor-pointer text-xs font-bold flex items-center gap-1"
                            title="Descargar archivo adjunto"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Descargar</span>
                          </button>
                        </>
                      )}

                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => handleDeleteInvoice(inv.id)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 hover:text-rose-200 border border-rose-500/30 transition cursor-pointer"
                          title="Eliminar factura"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-[#14233a] border-t border-[#233a59] flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Los cambios se sincronizan en tiempo real con el seguimiento de OC y órdenes de venta.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* PREVIEW SUB-MODAL */}
      {previewItem && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 bg-black/90 backdrop-blur-md">
          <div className="bg-[#0f192b] border border-[#233a59] rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-3.5 bg-[#14233a] border-b border-[#233a59] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-bold text-white">
                  Factura {previewItem.invoiceNumber} — {previewItem.fileName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadFile(previewItem)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewItem(null)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1 flex items-center justify-center bg-slate-950/60 min-h-[400px]">
              {previewItem.fileType?.includes('image') || previewItem.fileData?.startsWith('data:image') ? (
                <img
                  src={previewItem.fileData}
                  alt={previewItem.fileName}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg border border-[#233a59]"
                />
              ) : previewItem.fileType?.includes('pdf') || previewItem.fileData?.startsWith('data:application/pdf') ? (
                <iframe
                  src={previewItem.fileData}
                  title={previewItem.fileName}
                  className="w-full h-[70vh] rounded-lg border border-[#233a59]"
                />
              ) : (
                <div className="text-center p-6 space-y-2">
                  <FileText className="w-12 h-12 text-indigo-400 mx-auto" />
                  <p className="text-sm font-bold text-white">{previewItem.fileName}</p>
                  <p className="text-xs text-slate-400">
                    Vista previa embebida no disponible para este tipo de archivo. Descárguelo para abrirlo con su lector habitual.
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDownloadFile(previewItem)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Descargar Archivo</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
