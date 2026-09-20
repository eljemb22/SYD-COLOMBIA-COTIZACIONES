import React, { useState, useMemo } from 'react';
import {
  GitMerge,
  Building2,
  ReceiptText,
  DollarSign,
  PackageCheck,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  ShoppingCart,
  FileSpreadsheet,
  FileText,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  CheckCircle,
  Truck,
  Box,
  Factory,
  Archive,
  Search,
  Filter,
} from 'lucide-react';
import {
  OCTrackingContract,
  OCTrackingItem,
  SalesOrderRecord,
  SalesInvoiceRecord,
  SavedQuote,
  AuthUser,
  OCStatus,
} from '../../../types';
import { formatCOP } from '../../../utils/formatters';

interface ContractTraceabilityViewProps {
  contracts: OCTrackingContract[];
  salesOrders: SalesOrderRecord[];
  salesInvoices: SalesInvoiceRecord[];
  savedQuotes?: SavedQuote[];
  onSelectOrder: (order: SalesOrderRecord) => void;
  onSelectInvoice: (invoice: SalesInvoiceRecord) => void;
  onNavigateToTab?: (tab: string) => void;
  currentUser?: AuthUser | null;
}

export const ContractTraceabilityView: React.FC<ContractTraceabilityViewProps> = ({
  contracts,
  salesOrders,
  salesInvoices,
  savedQuotes = [],
  onSelectOrder,
  onSelectInvoice,
  onNavigateToTab,
  currentUser,
}) => {
  const [activeTraceSection, setActiveTraceSection] = useState<'active' | 'completed'>('active');
  const [completedSearchQuery, setCompletedSearchQuery] = useState('');

  // Helper to determine if an order is completed (delivered and installed or invoiced)
  const isOrderCompleted = (so: SalesOrderRecord): boolean => {
    if (so.status === 'Facturada' || so.status === 'Entregada al Cliente') {
      return true;
    }
    // Check if linked OC items are all delivered
    const linkedOC = contracts.find(
      (c) =>
        c.id === so.ocContractId ||
        (so.salesOrderNumber && c.contractNumber?.includes(so.salesOrderNumber)) ||
        (so.id && c.salesOrderId === so.id)
    );
    if (linkedOC && linkedOC.items && linkedOC.items.length > 0) {
      return linkedOC.items.every(
        (it) => it.status === 'Entregado e Instalado' || it.status === 'Cerrado / Concluido'
      );
    }
    return false;
  };

  const activeOrders = useMemo(() => {
    return salesOrders.filter((so) => !isOrderCompleted(so) && so.status !== 'Cancelada');
  }, [salesOrders, contracts]);

  const completedOrders = useMemo(() => {
    return salesOrders.filter((so) => isOrderCompleted(so));
  }, [salesOrders, contracts]);

  // Selected Order for pipeline inspection
  const currentOrdersList = activeTraceSection === 'active' ? activeOrders : completedOrders;

  const [selectedOrderId, setSelectedOrderId] = useState<string>(() => {
    return currentOrdersList.length > 0 ? currentOrdersList[0].id : salesOrders[0]?.id || '';
  });

  // Make sure selectedOrderId stays synchronized with current list
  const selectedOrder = useMemo(() => {
    const found = salesOrders.find((o) => o.id === selectedOrderId);
    if (found) return found;
    return currentOrdersList[0] || salesOrders[0];
  }, [salesOrders, selectedOrderId, currentOrdersList]);

  // Find linked Quote
  const linkedQuote = useMemo(() => {
    if (!selectedOrder) return null;
    return savedQuotes.find(
      (q) =>
        q.id === selectedOrder.quoteId ||
        (selectedOrder.quoteNumber && q.quoteNumber === selectedOrder.quoteNumber)
    );
  }, [savedQuotes, selectedOrder]);

  // Find linked OC Contract
  const linkedOCContract = useMemo(() => {
    if (!selectedOrder) return null;
    return contracts.find(
      (c) =>
        c.id === selectedOrder.ocContractId ||
        (selectedOrder.salesOrderNumber && c.contractNumber?.includes(selectedOrder.salesOrderNumber)) ||
        (selectedOrder.id && c.salesOrderId === selectedOrder.id)
    );
  }, [contracts, selectedOrder]);

  // Find linked Invoices (supports multiple invoices)
  const linkedInvoices = useMemo(() => {
    if (!selectedOrder) return [];
    return salesInvoices.filter(
      (inv) =>
        inv.salesOrderId === selectedOrder.id ||
        (selectedOrder.invoiceIds && selectedOrder.invoiceIds.includes(inv.id)) ||
        (selectedOrder.salesOrderNumber && inv.salesOrderNumber === selectedOrder.salesOrderNumber) ||
        (selectedOrder.invoiceNumber &&
          inv.invoiceNumber &&
          selectedOrder.invoiceNumber
            .split(',')
            .map((s) => s.trim().toUpperCase())
            .includes(inv.invoiceNumber.trim().toUpperCase()))
    );
  }, [salesInvoices, selectedOrder]);

  const linkedInvoice = linkedInvoices[0] || null;

  // Helper to find real-time operational status of an equipment item
  const getItemLiveStatus = (item: any): { status: string; badgeClass: string; icon: any } => {
    // 1. Try matching with linked OC Contract items
    if (linkedOCContract && linkedOCContract.items) {
      const ocItem = linkedOCContract.items.find(
        (it) =>
          (it.code && item.code && it.code.trim().toLowerCase() === item.code.trim().toLowerCase()) ||
          (it.name && item.name && it.name.trim().toLowerCase() === item.name.trim().toLowerCase())
      );
      if (ocItem && ocItem.status) {
        return getStatusBadgeMeta(ocItem.status);
      }
    }

    // 2. Derive from Sales Order status
    if (selectedOrder?.status === 'Facturada' || selectedOrder?.status === 'Entregada al Cliente') {
      return getStatusBadgeMeta('Entregado e Instalado');
    }
    if (selectedOrder?.status === 'Equipos en Bodega') {
      return getStatusBadgeMeta('En Bodega SyD / Recepcionado');
    }
    if (item.equipmentStatus && item.equipmentStatus !== 'Pendiente de OC') {
      return getStatusBadgeMeta(item.equipmentStatus);
    }
    if (linkedOCContract) {
      return getStatusBadgeMeta('Generación de OC');
    }

    return getStatusBadgeMeta('Generación de OC');
  };

  const getStatusBadgeMeta = (st: string) => {
    switch (st) {
      case 'Entregado e Instalado':
      case 'Cerrado / Concluido':
        return {
          status: 'Entregado e Instalado',
          badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          icon: CheckCircle2,
        };
      case 'En Ruta de Entrega':
        return {
          status: 'En Ruta de Entrega',
          badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
          icon: Truck,
        };
      case 'En Bodega SyD / Recepcionado':
        return {
          status: 'En Bodega SyD',
          badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
          icon: Box,
        };
      case 'Nacionalización / DIAN':
        return {
          status: 'Nacionalización DIAN',
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          icon: ShieldCheck,
        };
      case 'En Tránsito Nacional / Despachado':
      case 'En Tránsito Internacional':
        return {
          status: 'En Tránsito / Despachado',
          badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
          icon: Truck,
        };
      case 'En Fabricación / Alistamiento':
      case 'Confirmación de Fábrica':
        return {
          status: 'En Fabricación Fábrica',
          badgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
          icon: Factory,
        };
      default:
        return {
          status: st || 'OC Generada / En Proceso',
          badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
          icon: Clock,
        };
    }
  };

  // Filtered completed orders for archive view
  const filteredCompletedOrders = useMemo(() => {
    if (!completedSearchQuery.trim()) return completedOrders;
    const q = completedSearchQuery.toLowerCase().trim();
    return completedOrders.filter(
      (o) =>
        o.salesOrderNumber?.toLowerCase().includes(q) ||
        o.clientName?.toLowerCase().includes(q) ||
        o.invoiceNumber?.toLowerCase().includes(q) ||
        o.items?.some((it) => it.name.toLowerCase().includes(q))
    );
  }, [completedOrders, completedSearchQuery]);

  const totalCompletedCOP = useMemo(() => {
    return completedOrders.reduce((sum, o) => sum + (Number(o.totalValueCOP) || 0), 0);
  }, [completedOrders]);

  return (
    <div className="space-y-6">
      {/* Top Navigation Tabs: Active vs Completed */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-2 rounded-2xl shadow-xl">
        <div className="flex items-center gap-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setActiveTraceSection('active');
              if (activeOrders.length > 0) setSelectedOrderId(activeOrders[0].id);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTraceSection === 'active'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>⚡ Órdenes en Curso y Tránsito</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTraceSection === 'active'
                  ? 'bg-slate-950 text-amber-300'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {activeOrders.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTraceSection('completed');
              if (completedOrders.length > 0) setSelectedOrderId(completedOrders[0].id);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTraceSection === 'completed'
                ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>🏆 Órdenes Terminadas y Entregadas</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTraceSection === 'completed'
                  ? 'bg-slate-950 text-emerald-300'
                  : 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {completedOrders.length}
            </span>
          </button>
        </div>

        {activeTraceSection === 'active' ? (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-400 font-semibold shrink-0">Seleccionar OV activa:</span>
            <select
              value={selectedOrder?.id || ''}
              onChange={(e) => setSelectedOrderId(e.target.value)}
              className="px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-400 max-w-[280px]"
            >
              {activeOrders.length === 0 ? (
                <option value="">No hay OVs activas en curso</option>
              ) : (
                activeOrders.map((so) => (
                  <option key={so.id} value={so.id}>
                    {so.salesOrderNumber} — {so.clientName}
                  </option>
                ))
              )}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={completedSearchQuery}
                onChange={(e) => setCompletedSearchQuery(e.target.value)}
                placeholder="Buscar orden terminada..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-400"
              />
            </div>
          </div>
        )}
      </div>

      {/* SECTION 1: ACTIVE PIPELINE TRACKING */}
      {activeTraceSection === 'active' && (
        <div className="space-y-6">
          {/* Header Info Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 border border-slate-800 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <GitMerge className="w-4 h-4" />
                  Trazabilidad 360° en Tiempo Real
                </span>
                <h3 className="text-base font-bold text-white">
                  Flujo Activo: Cotización ➔ Orden de Venta (OV) ➔ Compras (OC) ➔ Facturación
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Visualiza el avance del suministro de equipos en tiempo real. Cuando los equipos queden completamente entregados e instalados, la orden pasará automáticamente al archivo de Órdenes Terminadas.
                </p>
              </div>

              {selectedOrder && (
                <div className="flex items-center gap-2 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Orden Seleccionada:</span>
                    <span className="text-xs font-mono font-bold text-amber-400">{selectedOrder.salesOrderNumber}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    {selectedOrder.status}
                  </span>
                </div>
              )}
            </div>
          </div>

          {selectedOrder ? (
            <div className="space-y-6">
              {/* Step by Step 4-Stage Pipeline */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Step 1: Cotización */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-sky-500/30 shadow-lg relative flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-500/20 text-sky-300 border border-sky-500/40">
                        Paso 1 • Cotización
                      </span>
                      <FileSpreadsheet className="w-4 h-4 text-sky-400" />
                    </div>
                    <h4 className="text-sm font-bold text-white mb-1">
                      {selectedOrder.quoteNumber || linkedQuote?.quoteNumber || 'Cotización Comercial'}
                    </h4>
                    <p className="text-xs text-slate-300 font-medium">{selectedOrder.clientName}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Ciudad: {selectedOrder.clientCity || 'Barranquilla'}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {linkedQuote ? `${linkedQuote.items?.length || 0} equipos cotizados` : 'Cotización directa'}
                    </span>
                    {onNavigateToTab && (
                      <button
                        onClick={() => onNavigateToTab('historial_cotizaciones')}
                        className="text-[11px] text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        Ver Historial
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Step 2: Orden de Venta (OV) */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-amber-500/30 shadow-lg relative flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        Paso 2 • Orden de Venta
                      </span>
                      <PackageCheck className="w-4 h-4 text-amber-400" />
                    </div>
                    <h4 className="text-sm font-bold text-amber-300 mb-1">
                      {selectedOrder.salesOrderNumber}
                    </h4>
                    <p className="text-xs text-slate-300 font-medium">Estado: {selectedOrder.status}</p>
                    <p className="text-sm font-black text-amber-400 mt-1">
                      {formatCOP(selectedOrder.totalValueCOP)}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {selectedOrder.items?.length || 0} equipos solicitados
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      Fecha: {selectedOrder.orderDate || selectedOrder.dispatchDate || 'N/A'}
                    </span>
                    <button
                      onClick={() => onSelectOrder(selectedOrder)}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      Detalles OV
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Step 3: Compras a Proveedores (Seguimiento de OC - Ventana 5) */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-emerald-500/30 shadow-lg relative flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        Paso 3 • Compras (OC)
                      </span>
                      <ShoppingCart className="w-4 h-4 text-emerald-400" />
                    </div>

                    {linkedOCContract ? (
                      <>
                        <h4 className="text-sm font-bold text-white mb-1">
                          OC Sincronizada en Ventana 5
                        </h4>
                        <p className="text-xs text-slate-300 font-medium">
                          Estado Operativo: <strong className="text-emerald-400">{linkedOCContract.globalStatus || 'En Proceso'}</strong>
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {linkedOCContract.items?.length || 0} equipos gestionados con proveedores
                        </p>
                      </>
                    ) : (
                      <>
                        <h4 className="text-sm font-bold text-slate-400 mb-1">OC en Gestión</h4>
                        <p className="text-xs text-slate-400">
                          Sincronizando órdenes de compra a proveedores.
                        </p>
                      </>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Ventana 5</span>
                    {onNavigateToTab && (
                      <button
                        onClick={() => onNavigateToTab('seguimiento_oc')}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        Ir a Seguimiento OC
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Step 4: Facturación SyD al Cliente */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-purple-500/30 shadow-lg relative flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
                        Paso 4 • Facturación SyD
                      </span>
                      <ReceiptText className="w-4 h-4 text-purple-400" />
                    </div>

                    {linkedInvoices.length > 0 || selectedOrder.invoiceNumber ? (
                      <>
                        <h4 className="text-sm font-bold text-purple-300 mb-1">
                          {linkedInvoices.length > 1
                            ? `${linkedInvoices.length} Facturas: ${linkedInvoices.map((i) => i.invoiceNumber).join(', ')}`
                            : `Factura N° ${selectedOrder.invoiceNumber || linkedInvoice?.invoiceNumber}`}
                        </h4>
                        <p className="text-xs text-slate-300">
                          Total Facturado:{' '}
                          <strong className="text-emerald-400 font-mono font-bold">
                            {formatCOP(
                              linkedInvoices.reduce(
                                (s, i) => s + (Number(i.totalAmountCOP) || 0),
                                0
                              ) || selectedOrder.totalValueCOP
                            )}
                          </strong>
                        </p>
                        <div className="mt-1.5 space-y-1">
                          {linkedInvoices.map((inv) => (
                            <div
                              key={inv.id}
                              className="text-[11px] flex items-center justify-between text-slate-300 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800"
                            >
                              <span className="font-mono text-purple-300 font-bold">{inv.invoiceNumber}</span>
                              <span className="font-mono text-emerald-400">{formatCOP(inv.totalAmountCOP)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <>
                        <h4 className="text-sm font-bold text-slate-400 mb-1">Sin Facturar</h4>
                        <p className="text-xs text-slate-400">
                          Esta Orden de Venta aún no tiene factura electrónica radicada.
                        </p>
                      </>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {selectedOrder.invoiceDate ? `Fecha: ${selectedOrder.invoiceDate}` : 'Pendiente'}
                    </span>
                    {linkedInvoice && (
                      <button
                        onClick={() => onSelectInvoice(linkedInvoice)}
                        className="text-[11px] text-purple-400 hover:text-purple-300 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        Ver Factura
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Detailed Item Traceability Table with Live Status */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-400" />
                    Equipos de la Orden de Venta y Estado Operativo de Suministro
                  </h4>
                  <span className="text-xs text-slate-400">
                    Estados actualizados en tiempo real desde Compras y Proveedores
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Equipo Médico</th>
                        <th className="py-2.5 px-3">Marca / Modelo</th>
                        <th className="py-2.5 px-3 text-center">Cant.</th>
                        <th className="py-2.5 px-3 text-right">Precio Venta COP</th>
                        <th className="py-2.5 px-3 text-right">Total COP</th>
                        <th className="py-2.5 px-3 text-center">Estado del Equipo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {selectedOrder.items?.map((item, i) => {
                        const statusMeta = getItemLiveStatus(item);
                        const StatusIcon = statusMeta.icon;

                        return (
                          <tr key={item.id || i} className="hover:bg-slate-800/30 transition">
                            <td className="py-3 px-3">
                              <div className="font-semibold text-white">{item.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                Cód: {item.code || 'N/A'}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-slate-300">
                              <span className="font-bold text-sky-300 block">{item.brand}</span>
                              <span className="text-[10px] text-slate-400">{item.model}</span>
                            </td>
                            <td className="py-3 px-3 text-center font-bold text-white">
                              {item.quantityToDispatch}
                            </td>
                            <td className="py-3 px-3 text-right text-slate-300 font-mono">
                              {formatCOP(item.unitSalePriceCOP || 0)}
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-amber-400 font-mono">
                              {formatCOP(item.totalSalePriceCOP || 0)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusMeta.badgeClass}`}
                              >
                                <StatusIcon className="w-3 h-3 shrink-0" />
                                <span>{statusMeta.status}</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-2 opacity-80" />
              <h4 className="text-sm font-bold text-white mb-1">¡No hay órdenes activas pendientes!</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Todas las órdenes de venta han sido entregadas e instaladas exitosamente. Puedes consultarlas en la pestaña de <strong>Órdenes Terminadas y Entregadas</strong>.
              </p>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: COMPLETED & DELIVERED SALES ORDERS ARCHIVE */}
      {activeTraceSection === 'completed' && (
        <div className="space-y-6">
          {/* Header Banner for Completed Orders */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-emerald-950/40 to-slate-950 border border-emerald-500/30 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                  <Archive className="w-4 h-4" />
                  Archivo de Órdenes Concluidas
                </span>
                <h3 className="text-base font-bold text-white">
                  Histórico de Órdenes de Venta Entregadas, Instaladas y Facturadas
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Registro histórico de contratos y ventas directas donde todos los equipos médicos fueron entregados e instalados satisfactoriamente.
                </p>
              </div>

              {/* Summary KPIs */}
              <div className="flex items-center gap-3">
                <div className="bg-slate-950/80 border border-emerald-500/30 px-4 py-2.5 rounded-xl text-right">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Total Entregadas</span>
                  <span className="text-base font-black text-emerald-400">{completedOrders.length} OVs</span>
                </div>
                <div className="bg-slate-950/80 border border-emerald-500/30 px-4 py-2.5 rounded-xl text-right">
                  <span className="text-[10px] text-slate-400 font-semibold block uppercase">Facturado Concluido</span>
                  <span className="text-base font-black text-white font-mono">{formatCOP(totalCompletedCOP)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Completed Orders List / Table */}
          {filteredCompletedOrders.length === 0 ? (
            <div className="py-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl">
              <PackageCheck className="w-12 h-12 text-slate-500 mx-auto mb-2 opacity-50" />
              <h4 className="text-sm font-bold text-white mb-1">No hay órdenes terminadas que coincidan</h4>
              <p className="text-xs text-slate-400">
                Cuando una orden sea entregada al cliente o facturada, se mostrará aquí automáticamente.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-[11px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">N° Orden de Venta</th>
                      <th className="py-3 px-4">Cliente / Entidad</th>
                      <th className="py-3 px-4">Equipos Entregados</th>
                      <th className="py-3 px-4">Monto Total</th>
                      <th className="py-3 px-4">Factura Radicada</th>
                      <th className="py-3 px-4">Estado Final</th>
                      <th className="py-3 px-4 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredCompletedOrders.map((order) => {
                      const totalQty = order.items?.reduce((acc, it) => acc + (it.quantityToDispatch || 1), 0) || 0;
                      return (
                        <tr key={order.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-amber-400 block text-sm">
                              {order.salesOrderNumber}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {order.contractNumber ? `Contrato: ${order.contractNumber}` : 'Venta Directa'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-white block">{order.clientName}</span>
                            <span className="text-[11px] text-slate-400">{order.clientCity || 'Colombia'}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-emerald-400 block flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {order.items?.length || 0} equipos ({totalQty} uds)
                            </span>
                            <div className="text-[10px] text-slate-400 truncate max-w-xs">
                              {order.items?.map((it) => it.name).join(', ')}
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                            {formatCOP(order.totalValueCOP)}
                          </td>
                          <td className="py-3 px-4">
                            {order.invoiceNumber ? (
                              <span className="inline-flex items-center gap-1 text-[11px] text-purple-300 font-bold bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded">
                                <ReceiptText className="w-3 h-3 text-purple-400" /> {order.invoiceNumber}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-300 font-bold bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Entregada
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span>{order.status === 'Facturada' ? 'Facturada' : 'Entregada e Instalada'}</span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => onSelectOrder(order)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                title="Ver detalles y trazabilidad de esta OV"
                              >
                                Ver Detalle
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
