import React, { useState, useEffect } from 'react';
import {
  X,
  ReceiptText,
  Upload,
  FileText,
  Trash2,
  Download,
  Calendar,
  Building2,
  DollarSign,
  CheckCircle2,
  Paperclip,
  Eye,
  Sparkles,
  AlertCircle,
  Plus,
  Layers,
} from 'lucide-react';
import {
  SalesInvoiceRecord,
  SalesOrderRecord,
  SalesInvoicePaymentStatus,
  AttachedSalesDoc,
  AuthUser,
} from '../../../types';
import { generateNextInvoiceNumber } from '../../../utils/salesOrdersStorage';
import { formatCOP } from '../../../utils/formatters';

interface AttachInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (invoice: SalesInvoiceRecord, updatedSalesOrder?: SalesOrderRecord) => void;
  invoiceToEdit?: SalesInvoiceRecord | null;
  targetSalesOrder?: SalesOrderRecord | null;
  salesOrders: SalesOrderRecord[];
  existingInvoices: SalesInvoiceRecord[];
  currentUser?: AuthUser | null;
}

export const AttachInvoiceModal: React.FC<AttachInvoiceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  invoiceToEdit,
  targetSalesOrder,
  salesOrders,
  existingInvoices,
  currentUser,
}) => {
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [selectedSalesOrderId, setSelectedSalesOrderId] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientNit, setClientNit] = useState('');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [totalAmountCOP, setTotalAmountCOP] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<SalesInvoicePaymentStatus>('Pendiente de Pago');
  const [attachedInvoiceFile, setAttachedInvoiceFile] = useState<AttachedSalesDoc | undefined>(undefined);
  const [notes, setNotes] = useState('');

  // Find currently active sales order (either passed target or selected in dropdown)
  const currentSalesOrder = targetSalesOrder || salesOrders.find((o) => o.id === selectedSalesOrderId);

  // Existing invoices already attached to this OV (excluding the one being edited, if any)
  const otherLinkedInvoices = currentSalesOrder
    ? existingInvoices.filter(
        (inv) =>
          (inv.salesOrderId === currentSalesOrder.id ||
            (currentSalesOrder.salesOrderNumber && inv.salesOrderNumber === currentSalesOrder.salesOrderNumber)) &&
          (!invoiceToEdit || inv.id !== invoiceToEdit.id)
      )
    : [];

  const previouslyInvoicedCOP = otherLinkedInvoices.reduce((sum, inv) => sum + (Number(inv.totalAmountCOP) || 0), 0);
  const orderTotalCOP = Number(currentSalesOrder?.totalValueCOP) || 0;
  const remainingBalanceCOP = Math.max(0, orderTotalCOP - previouslyInvoicedCOP);

  // Pre-fill fields when modal opens
  useEffect(() => {
    if (!isOpen) return;

    if (invoiceToEdit) {
      setInvoiceNumber(invoiceToEdit.invoiceNumber || '');
      setSelectedSalesOrderId(invoiceToEdit.salesOrderId || '');
      setClientName(invoiceToEdit.clientName || '');
      setClientNit(invoiceToEdit.clientNit || '');
      setIssueDate(invoiceToEdit.issueDate || new Date().toISOString().split('T')[0]);
      setDueDate(invoiceToEdit.dueDate || '');
      setTotalAmountCOP(invoiceToEdit.totalAmountCOP || 0);
      setPaymentStatus(invoiceToEdit.paymentStatus || 'Pendiente de Pago');
      setAttachedInvoiceFile(invoiceToEdit.attachedInvoiceFile);
      setNotes(invoiceToEdit.notes || '');
    } else if (targetSalesOrder) {
      const nextNum = generateNextInvoiceNumber(existingInvoices);
      const otherInvoices = existingInvoices.filter(
        (inv) =>
          inv.salesOrderId === targetSalesOrder.id ||
          (targetSalesOrder.salesOrderNumber && inv.salesOrderNumber === targetSalesOrder.salesOrderNumber)
      );
      const prevSum = otherInvoices.reduce((sum, inv) => sum + (Number(inv.totalAmountCOP) || 0), 0);
      const rem = Math.max(0, (targetSalesOrder.totalValueCOP || 0) - prevSum);

      setInvoiceNumber(nextNum);
      setSelectedSalesOrderId(targetSalesOrder.id);
      setClientName(targetSalesOrder.clientName || '');
      setClientNit(targetSalesOrder.clientNit || '');
      setIssueDate(new Date().toISOString().split('T')[0]);
      setDueDate('');
      setTotalAmountCOP(rem > 0 ? rem : targetSalesOrder.totalValueCOP || 0);
      setPaymentStatus('Pendiente de Pago');
      setAttachedInvoiceFile(undefined);
      setNotes(
        otherInvoices.length > 0
          ? `Factura parcial para Orden de Venta ${targetSalesOrder.salesOrderNumber} (Factura #${otherInvoices.length + 1})`
          : `Factura emitida para Orden de Venta ${targetSalesOrder.salesOrderNumber}`
      );
    } else {
      const nextNum = generateNextInvoiceNumber(existingInvoices);
      setInvoiceNumber(nextNum);
      setSelectedSalesOrderId('');
      setClientName('');
      setClientNit('');
      setIssueDate(new Date().toISOString().split('T')[0]);
      setDueDate('');
      setTotalAmountCOP(0);
      setPaymentStatus('Pendiente de Pago');
      setAttachedInvoiceFile(undefined);
      setNotes('');
    }
  }, [isOpen, invoiceToEdit, targetSalesOrder, existingInvoices]);

  // When sales order is changed in dropdown
  const handleSelectSalesOrder = (soId: string) => {
    setSelectedSalesOrderId(soId);
    if (!soId) return;

    const matchedSO = salesOrders.find((o) => o.id === soId);
    if (matchedSO) {
      setClientName(matchedSO.clientName || '');
      setClientNit(matchedSO.clientNit || '');

      const otherInvoices = existingInvoices.filter(
        (inv) =>
          (inv.salesOrderId === matchedSO.id ||
            (matchedSO.salesOrderNumber && inv.salesOrderNumber === matchedSO.salesOrderNumber)) &&
          (!invoiceToEdit || inv.id !== invoiceToEdit.id)
      );
      const prevSum = otherInvoices.reduce((sum, inv) => sum + (Number(inv.totalAmountCOP) || 0), 0);
      const rem = Math.max(0, (matchedSO.totalValueCOP || 0) - prevSum);

      setTotalAmountCOP(rem > 0 ? rem : matchedSO.totalValueCOP || 0);
    }
  };

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const dataUrl = loadEvt.target?.result as string;
      const sizeKB = (file.size / 1024).toFixed(1);
      const sizeStr = file.size > 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : `${sizeKB} KB`;

      setAttachedInvoiceFile({
        id: `doc-${Date.now()}`,
        name: file.name,
        size: sizeStr,
        dataUrl: dataUrl,
        type: file.type,
        uploadedAt: new Date().toISOString(),
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveFile = () => {
    setAttachedInvoiceFile(undefined);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!invoiceNumber.trim()) {
      alert('Por favor indica el Número de Factura Electrónica emitida al cliente (ej: FE-1045)');
      return;
    }
    if (!clientName.trim()) {
      alert('Por favor indica el cliente de la factura');
      return;
    }
    if (totalAmountCOP <= 0) {
      alert('El valor total de la factura debe ser mayor a 0 COP');
      return;
    }

    const matchedSO = currentSalesOrder;

    const finalInvoice: SalesInvoiceRecord = {
      id: invoiceToEdit?.id || `inv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      invoiceNumber: invoiceNumber.trim().toUpperCase(),
      salesOrderId: matchedSO?.id || selectedSalesOrderId || undefined,
      salesOrderNumber: matchedSO?.salesOrderNumber || invoiceToEdit?.salesOrderNumber || undefined,
      quoteId: matchedSO?.quoteId || invoiceToEdit?.quoteId,
      quoteNumber: matchedSO?.quoteNumber || invoiceToEdit?.quoteNumber,
      contractId: matchedSO?.contractId || invoiceToEdit?.contractId,
      contractNumber: matchedSO?.contractNumber || invoiceToEdit?.contractNumber,
      clientName: clientName.trim(),
      clientNit: clientNit.trim(),
      issueDate: issueDate,
      dueDate: dueDate || undefined,
      subtotalCOP: totalAmountCOP,
      totalAmountCOP: totalAmountCOP,
      paymentStatus: paymentStatus,
      attachedInvoiceFile: attachedInvoiceFile,
      notes: notes.trim(),
      createdAt: invoiceToEdit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // If an OV is linked, update it with all invoice info and recompute invoicing status
    let updatedSO: SalesOrderRecord | undefined = undefined;
    if (matchedSO) {
      const allOtherInvoices = existingInvoices.filter(
        (inv) =>
          (inv.salesOrderId === matchedSO.id ||
            (matchedSO.salesOrderNumber && inv.salesOrderNumber === matchedSO.salesOrderNumber)) &&
          inv.id !== finalInvoice.id
      );

      const allInvoicesForOrder = [...allOtherInvoices, finalInvoice];
      const newTotalInvoicedSum = allInvoicesForOrder.reduce((sum, inv) => sum + (Number(inv.totalAmountCOP) || 0), 0);
      const isFullyInvoicedNow = matchedSO.totalValueCOP > 0 && newTotalInvoicedSum >= matchedSO.totalValueCOP;

      const allInvoiceNumbers = Array.from(
        new Set(allInvoicesForOrder.map((i) => i.invoiceNumber).filter(Boolean))
      ).join(', ');

      const allInvoiceIds = allInvoicesForOrder.map((i) => i.id);

      updatedSO = {
        ...matchedSO,
        invoiceNumber: allInvoiceNumbers,
        invoiceId: finalInvoice.id,
        invoiceIds: allInvoiceIds,
        invoiceDate: finalInvoice.issueDate,
        totalInvoicedCOP: newTotalInvoicedSum,
        attachedInvoiceFile: finalInvoice.attachedInvoiceFile || matchedSO.attachedInvoiceFile,
        invoicedStatus: isFullyInvoicedNow ? 'Facturada Total' : 'Facturada Parcial',
        status: isFullyInvoicedNow && matchedSO.status !== 'Cancelada' ? 'Facturada' : matchedSO.status,
        updatedAt: new Date().toISOString(),
      };
    }

    onSave(finalInvoice, updatedSO);
    onClose();
  };

  if (!isOpen) return null;

  const currentAccumulatedAfterThis = previouslyInvoicedCOP + (Number(totalAmountCOP) || 0);
  const currentPercentageAfterThis =
    orderTotalCOP > 0 ? Math.min(100, Math.round((currentAccumulatedAfterThis / orderTotalCOP) * 100)) : 0;
  const isCoveringFullValue = orderTotalCOP > 0 && currentAccumulatedAfterThis >= orderTotalCOP;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <ReceiptText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {invoiceToEdit ? 'Editar Factura de Venta' : 'Registrar Factura al Cliente'}
                {otherLinkedInvoices.length > 0 && !invoiceToEdit && (
                  <span className="text-[10.5px] font-bold px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                    Factura #{otherLinkedInvoices.length + 1} para esta OV
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Permite registrar facturas individuales o parciales con número, soporte PDF y montos acumulables
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multi-Invoice Financial Summary Banner if linked to an OV */}
        {currentSalesOrder && (
          <div className="px-6 py-3.5 bg-gradient-to-r from-purple-950/30 via-slate-900 to-slate-950 border-b border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-300">Orden de Venta:</span>
                <span className="font-mono font-bold text-amber-400 text-sm">
                  {currentSalesOrder.salesOrderNumber}
                </span>
                {currentSalesOrder.contractNumber && (
                  <span className="text-[11px] font-mono text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                    {currentSalesOrder.contractNumber}
                  </span>
                )}
              </div>
              <div className="text-right text-xs">
                <span className="text-slate-400">Total OV / Contrato: </span>
                <strong className="text-emerald-400 font-mono text-sm">{formatCOP(orderTotalCOP)}</strong>
              </div>
            </div>

            {/* Financial Status Breakdown Cards */}
            <div className="grid grid-cols-3 gap-2 text-xs mb-2">
              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 text-center">
                <span className="text-[10px] text-slate-400 block font-medium">Facturado Previo</span>
                <strong className="text-purple-300 font-mono block text-xs truncate">
                  {formatCOP(previouslyInvoicedCOP)}
                </strong>
                <span className="text-[9.5px] text-slate-500 block">
                  {otherLinkedInvoices.length} {otherLinkedInvoices.length === 1 ? 'factura' : 'facturas'}
                </span>
              </div>

              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 text-center">
                <span className="text-[10px] text-amber-400/90 block font-medium">Esta Factura</span>
                <strong className="text-amber-300 font-mono block text-xs truncate">
                  {formatCOP(totalAmountCOP)}
                </strong>
                <button
                  type="button"
                  onClick={() => setTotalAmountCOP(remainingBalanceCOP)}
                  className="text-[9.5px] text-amber-400 hover:underline block mx-auto font-bold cursor-pointer"
                >
                  Saldo exacto
                </button>
              </div>

              <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 text-center">
                <span className="text-[10px] text-emerald-400 block font-medium">Saldo Restante</span>
                <strong
                  className={`font-mono block text-xs truncate ${
                    orderTotalCOP - currentAccumulatedAfterThis <= 0 ? 'text-emerald-400' : 'text-slate-200'
                  }`}
                >
                  {formatCOP(Math.max(0, orderTotalCOP - currentAccumulatedAfterThis))}
                </strong>
                <span className="text-[9.5px] text-emerald-400 block font-bold">
                  {isCoveringFullValue ? '✓ 100% Cubierto' : `${currentPercentageAfterThis}% del total`}
                </span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isCoveringFullValue
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                    : 'bg-gradient-to-r from-purple-500 to-amber-400'
                }`}
                style={{ width: `${currentPercentageAfterThis}%` }}
              />
            </div>

            {/* Previously Attached Invoices List */}
            {otherLinkedInvoices.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-slate-800/80">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1 mb-1">
                  <Layers className="w-3 h-3 text-purple-400" />
                  Facturas ya registradas para esta OV ({otherLinkedInvoices.length}):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {otherLinkedInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px]"
                    >
                      <ReceiptText className="w-3 h-3 text-purple-400" />
                      <strong className="text-white font-mono">{inv.invoiceNumber}</strong>
                      <span className="text-emerald-400 font-mono font-semibold">{formatCOP(inv.totalAmountCOP)}</span>
                      {inv.issueDate && <span className="text-slate-500 text-[10px]">({inv.issueDate})</span>}
                      {inv.attachedInvoiceFile && (
                        <a
                          href={inv.attachedInvoiceFile.dataUrl}
                          download={inv.attachedInvoiceFile.name}
                          className="text-purple-400 hover:text-purple-200"
                          title={`Descargar: ${inv.attachedInvoiceFile.name}`}
                        >
                          <Paperclip className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[68vh] overflow-y-auto">
          {/* Section 1: Upload Invoice File */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-purple-500/30 space-y-2">
            <label className="block text-xs font-bold text-purple-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-purple-400" />
                1. Adjuntar Archivo de Soporte (PDF o Imagen de Factura)
              </span>
              <span className="text-[11px] text-slate-400 font-normal">PDF / PNG / JPG</span>
            </label>

            {attachedInvoiceFile ? (
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-white truncate">{attachedInvoiceFile.name}</p>
                    <span className="text-[11px] text-slate-400">{attachedInvoiceFile.size} • Adjuntada correctamente</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={attachedInvoiceFile.dataUrl}
                    download={attachedInvoiceFile.name}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Descargar archivo"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                    title="Cambiar archivo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-purple-500/40 rounded-xl bg-purple-950/20 hover:bg-purple-950/30 cursor-pointer transition-colors group">
                <Upload className="w-7 h-7 text-purple-400 group-hover:scale-110 mb-1.5 transition-transform" />
                <span className="text-xs text-white font-bold">Haz clic para seleccionar o arrastra la Factura (PDF)</span>
                <span className="text-[11px] text-slate-400 mt-0.5">Soporta Factura Electrónica en PDF o imagen escaneada</span>
                <input
                  type="file"
                  accept=".pdf,image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Invoice Number / Name */}
            <div>
              <label className="block text-xs font-bold text-slate-200 mb-1">
                2. Número o Nombre de la Factura *
              </label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="ej: FE-1045 o Factura Parcial 1..."
                className="w-full px-3 py-2 bg-slate-900 border-2 border-purple-500/50 rounded-lg text-sm font-bold text-purple-300 focus:outline-none focus:border-purple-400"
              />
            </div>

            {/* Total Value of this Invoice */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-200">
                  3. Valor de esta Factura ($ COP) *
                </label>
                {remainingBalanceCOP > 0 && (
                  <button
                    type="button"
                    onClick={() => setTotalAmountCOP(remainingBalanceCOP)}
                    className="text-[10.5px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                  >
                    Usar Saldo ({formatCOP(remainingBalanceCOP)})
                  </button>
                )}
              </div>
              <input
                type="number"
                min="1"
                required
                value={totalAmountCOP || ''}
                onChange={(e) => setTotalAmountCOP(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm font-bold text-emerald-400 focus:outline-none focus:border-emerald-400 font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Monto: <strong className="text-emerald-400">{formatCOP(totalAmountCOP)}</strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Client Name */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Cliente / Entidad Receptora *</label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Nombre del hospital o cliente"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-400"
              />
            </div>

            {/* NIT */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">NIT del Cliente</label>
              <input
                type="text"
                value={clientNit}
                onChange={(e) => setClientNit(e.target.value)}
                placeholder="890.399.010-6"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-purple-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Issue Date */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Fecha de Emisión</label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-purple-400"
              />
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Fecha Vencimiento (Opcional)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-purple-400"
              />
            </div>

            {/* Payment Status */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Estado del Pago</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as SalesInvoicePaymentStatus)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-amber-300 focus:outline-none focus:border-purple-400"
              >
                <option value="Pendiente de Pago">Pendiente de Pago</option>
                <option value="Radicada en Cliente">Radicada en Cliente</option>
                <option value="Pagada / Cancelada">Pagada / Cancelada</option>
                <option value="Anulada">Anulada</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Notas / Observaciones de la Factura</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalles sobre radicación en ventanilla única, número de radicado, entrega parcial..."
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-purple-400"
            />
          </div>

          {/* Automatic Invoicing Rule Notification */}
          <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-slate-200 block">Comportamiento Automático de Facturación:</span>
              <p className="text-[11px] text-slate-400">
                {isCoveringFullValue ? (
                  <span className="text-emerald-400 font-semibold">
                    ✓ Esta factura completará el 100% del valor de la Orden de Venta. El botón "Facturar" se deshabilitará automáticamente y el estado pasará a Facturada Total.
                  </span>
                ) : (
                  <span>
                    El valor ingresado cubre el {currentPercentageAfterThis}% del total de la OV. La orden quedará en estado <strong>Facturada Parcial</strong> y el botón de facturar seguirá activo para registrar las facturas restantes.
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 transition-all shadow-lg shadow-purple-500/20 flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{invoiceToEdit ? 'Actualizar Factura' : 'Guardar Factura'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
