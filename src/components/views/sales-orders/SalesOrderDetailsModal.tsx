import React from 'react';
import {
  X,
  Printer,
  Edit2,
  Trash2,
  Building2,
  Calendar,
  ReceiptText,
  Truck,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Layers,
  Sparkles,
  ExternalLink,
  ShoppingCart,
  Plus,
} from 'lucide-react';
import { SalesOrderRecord, SalesInvoiceRecord, SalesOrderStatus, AuthUser } from '../../../types';
import { formatCOP } from '../../../utils/formatters';

interface SalesOrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: SalesOrderRecord | null;
  linkedInvoices?: SalesInvoiceRecord[];
  onEdit: (order: SalesOrderRecord) => void;
  onDelete: (orderId: string) => void;
  onPrint: (order: SalesOrderRecord) => void;
  onCreateInvoiceForOrder: (order: SalesOrderRecord) => void;
  onUpdateStatus: (orderId: string, newStatus: SalesOrderStatus) => void;
  onGenerateOC?: (order: SalesOrderRecord) => void;
  onNavigateToOC?: () => void;
  currentUser?: AuthUser | null;
}

export const SalesOrderDetailsModal: React.FC<SalesOrderDetailsModalProps> = ({
  isOpen,
  onClose,
  order,
  linkedInvoices = [],
  onEdit,
  onDelete,
  onPrint,
  onCreateInvoiceForOrder,
  onUpdateStatus,
  onGenerateOC,
  onNavigateToOC,
  currentUser,
}) => {
  if (!isOpen || !order) return null;

  const getStatusBadge = (st: SalesOrderStatus) => {
    switch (st) {
      case 'Borrador':
        return 'bg-slate-700 text-slate-200 border-slate-600';
      case 'En Proceso':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'Equipos en Bodega':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Entregada al Cliente':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'Facturada':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'Cancelada':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      default:
        return 'bg-slate-700 text-slate-200 border-slate-600';
    }
  };

  const totalOrderCOP = Number(order.totalValueCOP) || 0;
  const totalInvoicedCOP =
    linkedInvoices.length > 0
      ? linkedInvoices.reduce((sum, i) => sum + (Number(i.totalAmountCOP) || 0), 0)
      : order.totalInvoicedCOP || (order.invoicedStatus === 'Facturada Total' ? totalOrderCOP : 0);

  const isFullyInvoiced =
    (totalOrderCOP > 0 && totalInvoicedCOP >= totalOrderCOP) || order.invoicedStatus === 'Facturada Total';
  const remainingToInvoiceCOP = Math.max(0, totalOrderCOP - totalInvoicedCOP);
  const percentInvoiced = totalOrderCOP > 0 ? Math.min(100, Math.round((totalInvoicedCOP / totalOrderCOP) * 100)) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden text-slate-100 animate-in fade-in duration-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Orden de Venta {order.salesOrderNumber}</h2>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${getStatusBadge(order.status)}`}>
                  {order.status}
                </span>
                {isFullyInvoiced ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Facturada 100%
                  </span>
                ) : linkedInvoices.length > 0 ? (
                  <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Facturada Parcial ({percentInvoiced}%)
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Generada el {order.orderDate || order.createdAt?.split('T')[0] || 'N/A'} • Origen:{' '}
                {order.contractNumber
                  ? `Licitación / Contrato ${order.contractNumber}`
                  : order.quoteNumber
                  ? `Cotización ${order.quoteNumber}`
                  : 'Venta Directa'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPrint(order)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 border border-slate-700 transition-colors"
              title="Imprimir Orden"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={() => onEdit(order)}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
              title="Editar Orden"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Client and Summary Header Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
              <span className="text-xs font-semibold text-slate-400 block mb-1">Información del Cliente</span>
              <strong className="text-sm font-bold text-white block">{order.clientName}</strong>
              <div className="text-xs text-slate-300 mt-1 space-y-0.5">
                {order.clientNit && <p>NIT: {order.clientNit}</p>}
                {order.clientContactPerson && <p>Contacto: {order.clientContactPerson}</p>}
                {order.clientContactPhone && <p>Tel: {order.clientContactPhone}</p>}
                {order.clientContactEmail && <p>Email: {order.clientContactEmail}</p>}
                <p>Ciudad: {order.clientCity || 'Colombia'}</p>
                {order.clientAddress && <p>Dir: {order.clientAddress}</p>}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60">
              <span className="text-xs font-semibold text-slate-400 block mb-1">Detalles de Entrega</span>
              <div className="text-xs text-slate-300 space-y-1">
                <p className="flex justify-between">
                  <span className="text-slate-400">Fecha Estimada:</span>
                  <span className="font-semibold text-white">{order.deliveryDate || 'No definida'}</span>
                </p>
                {order.dispatchDate && (
                  <p className="flex justify-between">
                    <span className="text-slate-400">Fecha Despacho:</span>
                    <span className="font-semibold text-white">{order.dispatchDate}</span>
                  </p>
                )}
                {order.carrierName && (
                  <p className="flex justify-between">
                    <span className="text-slate-400">Transportadora:</span>
                    <span className="font-semibold text-white">{order.carrierName}</span>
                  </p>
                )}
                {order.trackingNumber && (
                  <p className="flex justify-between">
                    <span className="text-slate-400">N° Guía:</span>
                    <span className="font-mono font-semibold text-amber-400">{order.trackingNumber}</span>
                  </p>
                )}
                {order.destinationHospitalService && (
                  <p className="flex justify-between">
                    <span className="text-slate-400">Servicio Destino:</span>
                    <span className="font-semibold text-white">{order.destinationHospitalService}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-400 block mb-1">Monto Total de la Orden</span>
                <span className="text-2xl font-mono font-bold text-emerald-400 block">
                  {formatCOP(order.totalValueCOP)}
                </span>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  {order.items?.length || 0} equipos / {order.items?.reduce((acc, it) => acc + (it.quantityToDispatch || 1), 0)} unidades
                </span>
              </div>
              <div className="pt-2 border-t border-slate-700/60 mt-2">
                <span className="text-[11px] text-slate-400 block mb-1">Cambiar Estado Rápido:</span>
                <select
                  value={order.status}
                  onChange={(e) => onUpdateStatus(order.id, e.target.value as SalesOrderStatus)}
                  className={`w-full text-xs font-bold px-2.5 py-1 rounded-lg border bg-slate-900 focus:outline-none cursor-pointer ${getStatusBadge(
                    order.status
                  )}`}
                >
                  <option value="Borrador">Borrador</option>
                  <option value="En Proceso">En Proceso</option>
                  <option value="Equipos en Bodega">Equipos en Bodega</option>
                  <option value="Entregada al Cliente">Entregada al Cliente</option>
                  <option value="Facturada">Facturada</option>
                  <option value="Cancelada">Cancelada</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section: Equipos y Productos */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Equipos / Productos a Despachar
            </h3>
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[11px] font-bold text-slate-400 uppercase border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Descripción</th>
                    <th className="py-2.5 px-3">Marca / Modelo</th>
                    <th className="py-2.5 px-3 text-center">Cant.</th>
                    <th className="py-2.5 px-3 text-right">Precio Unit.</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {order.items?.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-mono text-amber-400 font-bold">{item.code || '-'}</td>
                      <td className="py-2.5 px-3 font-medium text-white">{item.name}</td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {item.brand} {item.model ? `/ ${item.model}` : ''}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-200">
                        {item.quantityToDispatch || 1}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">{formatCOP(item.unitSalePriceCOP || 0)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                        {formatCOP(item.totalSalePriceCOP || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: Facturación al Cliente (Multi-Invoice Support) */}
          <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                <ReceiptText className="w-4 h-4 text-purple-400" />
                Facturación al Cliente ({linkedInvoices.length} {linkedInvoices.length === 1 ? 'Factura' : 'Facturas'})
              </span>
              <div className="flex items-center gap-2">
                {isFullyInvoiced ? (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 100% Facturado ({formatCOP(totalInvoicedCOP)})
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      Pendiente por facturar: {formatCOP(remainingToInvoiceCOP)} ({100 - percentInvoiced}%)
                    </span>
                    <button
                      type="button"
                      onClick={() => onCreateInvoiceForOrder(order)}
                      className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                    >
                      <ReceiptText className="w-3.5 h-3.5" /> Facturar Saldo Restante
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Invoices List */}
            {linkedInvoices.length > 0 ? (
              <div className="space-y-2">
                {linkedInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-purple-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-xs font-bold text-white font-mono">{inv.invoiceNumber}</strong>
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            {formatCOP(inv.totalAmountCOP)}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                            {inv.paymentStatus || 'Pendiente de Pago'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block">
                          Emitida: {inv.issueDate || 'N/A'} {inv.dueDate ? `• Vence: ${inv.dueDate}` : ''}{' '}
                          {inv.notes ? `• ${inv.notes}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {inv.attachedInvoiceFile ? (
                        <a
                          href={inv.attachedInvoiceFile.dataUrl}
                          download={inv.attachedInvoiceFile.name}
                          className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1 transition-colors"
                          title="Descargar Factura Adjunta"
                        >
                          <Download className="w-3 h-3" />
                          <span>Descargar ({inv.attachedInvoiceFile.name})</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-500 italic">Sin archivo adjunto</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : order.invoiceNumber ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-purple-500/20">
                <div className="flex items-center gap-2.5">
                  <FileText className="w-5 h-5 text-purple-400" />
                  <div>
                    <p className="text-xs font-semibold text-white">Factura {order.invoiceNumber}</p>
                    {order.attachedInvoiceFile && (
                      <span className="text-[10px] text-slate-400">{order.attachedInvoiceFile.name}</span>
                    )}
                  </div>
                </div>
                {order.attachedInvoiceFile && (
                  <a
                    href={order.attachedInvoiceFile.dataUrl}
                    download={order.attachedInvoiceFile.name}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar Factura
                  </a>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
                <span>No se han registrado facturas para esta Orden de Venta.</span>
                <button
                  type="button"
                  onClick={() => onCreateInvoiceForOrder(order)}
                  className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition-colors cursor-pointer"
                >
                  Facturar Orden
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          {order.notes && (
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-300">
              <strong className="text-slate-200 block mb-1">Notas:</strong>
              {order.notes}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <button
            onClick={() => {
              if (confirm(`¿Estás seguro de eliminar la Orden de Venta ${order.salesOrderNumber}?`)) {
                onDelete(order.id);
                onClose();
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Eliminar Orden
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
