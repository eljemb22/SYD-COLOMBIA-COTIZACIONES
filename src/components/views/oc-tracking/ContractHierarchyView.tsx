import React, { useState } from 'react';
import {
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  CreditCard,
  DollarSign,
  Edit3,
  ExternalLink,
  FileText,
  History,
  Layers,
  MapPin,
  Plus,
  Tag,
  Trash2,
  Truck,
  Activity,
  AlertTriangle,
  Boxes,
  ShoppingCart,
  ReceiptText,
  CheckCircle2,
} from 'lucide-react';
import {
  OCTrackingContract,
  OCTrackingItem,
  OCStatus,
  OCPaymentTerms,
  OCPaymentStatus,
  AuthUser,
} from '../../../types';
import {
  PAYMENT_TERMS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  OC_STATUS_OPTIONS,
} from '../../../utils/ocTrackingStorage';

export interface SupplierOCGroup {
  supplier: string;
  ocNumber: string;
  paymentTerms: OCPaymentTerms | string;
  paymentStatus: OCPaymentStatus | string;
  status: OCStatus | string;
  invoiceNumber?: string;
  trackingNumber?: string;
  items: OCTrackingItem[];
  totalCostCOP: number;
  totalUnits: number;
  hasAlert: boolean;
}

interface ContractHierarchyViewProps {
  contracts: OCTrackingContract[];
  collapsedContractIds: Set<string>;
  onToggleContractCollapse: (contractId: string) => void;
  onOpenAddSupplierOCModal?: (contract: OCTrackingContract) => void;
  onOpenAddItemsToOC: (contractId: string, ocNumber: string, supplier: string) => void;
  onOpenEditOCHeader: (contract: OCTrackingContract) => void;
  onOpenEditItem: (contractId: string, item: OCTrackingItem) => void;
  onOpenSerialsModal?: (contract: OCTrackingContract, item: OCTrackingItem) => void;
  onOpenHistory: (contractName: string, item: OCTrackingItem) => void;
  onQuickChangeItemStatus: (contractId: string, itemId: string, newStatus: OCStatus) => void;
  onQuickChangeItemPaymentTerms: (contractId: string, itemId: string, terms: OCPaymentTerms) => void;
  onQuickChangeItemPaymentStatus: (contractId: string, itemId: string, status: OCPaymentStatus) => void;
  onRequestDeleteContract: (contract: OCTrackingContract) => void;
  onRequestDeleteItem: (contractId: string, item: OCTrackingItem) => void;
  onRequestDeleteSupplierOC: (contractId: string, supplier: string, ocNumber: string) => void;
  onNavigateToTab?: (tab: string) => void;
  currentUser?: AuthUser | null;
}

export const ContractHierarchyView: React.FC<ContractHierarchyViewProps> = ({
  contracts,
  collapsedContractIds,
  onToggleContractCollapse,
  onOpenAddItemsToOC,
  onOpenEditOCHeader,
  onOpenEditItem,
  onOpenSerialsModal,
  onOpenHistory,
  onQuickChangeItemStatus,
  onQuickChangeItemPaymentTerms,
  onQuickChangeItemPaymentStatus,
  onRequestDeleteContract,
  onRequestDeleteItem,
  onRequestDeleteSupplierOC,
  currentUser,
}) => {
  const isReadOnly = currentUser?.role === 'viewer' && !currentUser?.permissions?.canManageOCTracking;

  // Local state for collapsed supplier OC groups
  const [collapsedSupplierKeys, setCollapsedSupplierKeys] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('syd_collapsed_supplier_ocs');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleSupplierCollapse = (key: string) => {
    setCollapsedSupplierKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      try {
        localStorage.setItem('syd_collapsed_supplier_ocs', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // Helper to group a contract's items by (supplier + ocNumber)
  const getSupplierOCGroups = (items: OCTrackingItem[]): SupplierOCGroup[] => {
    const map = new Map<string, SupplierOCGroup>();

    items.forEach((item) => {
      const supplierName = item.supplier || 'Sin Proveedor Asignado';
      const ocNum = item.ocNumber || 'Sin N° OC';
      const key = `${supplierName}___${ocNum}`;

      if (!map.has(key)) {
        map.set(key, {
          supplier: supplierName,
          ocNumber: ocNum,
          paymentTerms: item.paymentTerms || 'Crédito 30 días',
          paymentStatus: item.paymentStatus || 'Pendiente',
          status: item.status || 'Emitida / Enviada al Proveedor',
          invoiceNumber: item.invoiceNumber,
          trackingNumber: item.trackingNumber,
          items: [],
          totalCostCOP: 0,
          totalUnits: 0,
          hasAlert: false,
        });
      }

      const grp = map.get(key)!;
      grp.items.push(item);
      grp.totalCostCOP += item.totalCostCOP || (item.costPriceCOP * item.quantity);
      grp.totalUnits += item.quantity || 1;

      // Check 48h alert
      const lastUpdate = new Date(item.lastUpdatedAt || item.createdAt).getTime();
      const hours = (Date.now() - lastUpdate) / (1000 * 60 * 60);
      if (
        hours > 48 &&
        item.status !== 'Entregado e Instalado' &&
        item.status !== 'Cerrado / Concluido' &&
        item.status !== 'Cancelada'
      ) {
        grp.hasAlert = true;
      }
    });

    return Array.from(map.values());
  };

  const getSourceBadge = (contract: OCTrackingContract) => {
    if (contract.salesOrderNumber || contract.id.includes('ov') || contract.sourceType === 'orden_venta') {
      return (
        <span className="inline-flex items-center gap-1.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[11px] font-black px-2.5 py-0.5 rounded-lg shadow-xs">
          <ShoppingCart className="w-3.5 h-3.5 text-indigo-400" />
          <span>ORDEN DE VENTA ({contract.salesOrderNumber || contract.contractNumber})</span>
        </span>
      );
    }
    if (contract.sourceType === 'licitacion_adjudicada' || contract.tenderClientId) {
      return (
        <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-black px-2.5 py-0.5 rounded-lg shadow-xs">
          <Tag className="w-3.5 h-3.5 text-emerald-400" />
          <span>LICITACIÓN ADJUDICADA ({contract.contractNumber})</span>
        </span>
      );
    }
    if (contract.sourceType === 'cotizacion_aprobada') {
      return (
        <span className="inline-flex items-center gap-1.5 bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[11px] font-black px-2.5 py-0.5 rounded-lg shadow-xs">
          <FileText className="w-3.5 h-3.5 text-sky-400" />
          <span>COTIZACIÓN APROBADA ({contract.quoteNumber || contract.contractNumber})</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[11px] font-black px-2.5 py-0.5 rounded-lg shadow-xs">
        <Layers className="w-3.5 h-3.5 text-purple-400" />
        <span>CONTRATO / PEDIDO ({contract.contractNumber})</span>
      </span>
    );
  };

  const getPaymentTermsBadgeClass = (terms?: string) => {
    const found = PAYMENT_TERMS_OPTIONS.find((p) => p.terms === terms);
    return found ? found.badgeColor : 'bg-slate-500/20 text-slate-300 border-slate-500/40';
  };

  const getPaymentStatusBadgeClass = (status?: string) => {
    const found = PAYMENT_STATUS_OPTIONS.find((p) => p.status === status);
    return found ? found.badgeColor : 'bg-slate-500/20 text-slate-300 border-slate-500/40';
  };

  const getOCStatusBadgeClass = (status?: string) => {
    const found = OC_STATUS_OPTIONS.find((s) => s.status === status);
    return found ? found.badgeColor : 'bg-slate-500/20 text-slate-300 border-slate-500/40';
  };

  return (
    <div className="space-y-4">
      {contracts.map((contract) => {
        const isCollapsed = collapsedContractIds.has(contract.id);
        const supplierGroups = getSupplierOCGroups(contract.items);
        const totalItemsCount = contract.items.reduce((s, it) => s + (it.quantity || 1), 0);
        const contractTotalCost = contract.items.reduce((s, it) => s + it.totalCostCOP, 0);

        const isSalesOrder = Boolean(contract.salesOrderNumber || contract.id.includes('ov') || contract.sourceType === 'orden_venta');
        const isTender = Boolean(contract.sourceType === 'licitacion_adjudicada' || contract.tenderClientId);

        return (
          <div
            key={contract.id}
            className={`rounded-xl shadow-lg overflow-hidden transition-all border ${
              isSalesOrder
                ? 'bg-[#121c2e] border-indigo-500/40 hover:border-indigo-400/60'
                : isTender
                ? 'bg-[#12222e] border-emerald-500/40 hover:border-emerald-400/60'
                : 'bg-[#15253d] border-[#334d6e] hover:border-[#41628d]'
            }`}
          >
            {/* LEVEL 1: CONTRACT / OV MASTER BOX HEADER */}
            <div className="p-3 sm:p-4 bg-slate-900/90 border-b border-slate-700/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => onToggleContractCollapse(contract.id)}
                  className="mt-0.5 p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                  title={isCollapsed ? 'Desplegar OCs del contrato' : 'Plegar contrato'}
                >
                  {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getSourceBadge(contract)}
                    <span className="text-[11px] text-slate-300 font-mono bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                      NIT: {contract.nit || 'N/A'}
                    </span>
                    <span className="text-[11px] text-slate-300 font-medium flex items-center gap-1 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                      <MapPin className="w-3 h-3 text-rose-400" />
                      {contract.city || 'Colombia'}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-white flex items-center gap-2 tracking-tight">
                    <span>{contract.clientName || 'Cliente No Especificado'}</span>
                  </h3>

                  <p className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                    <span className="text-slate-300 font-semibold">
                      {isSalesOrder ? 'Orden de Venta:' : 'Proceso / Licitación:'}
                    </span>
                    <span className="font-mono text-sky-300 font-bold">
                      {contract.contractNumber || contract.salesOrderNumber || 'N/A'}
                    </span>
                    {contract.contactPerson && (
                      <span>• Contacto: {contract.contactPerson} {contract.contactPhone ? `(${contract.contactPhone})` : ''}</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Summary Stats & Actions on Contract */}
              <div className="flex items-center gap-2.5 flex-wrap lg:justify-end">
                <div className="px-3 py-1.5 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center gap-3">
                  <div>
                    <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block">
                      OCs a Proveedores
                    </span>
                    <span className="text-xs font-black text-sky-300">
                      {supplierGroups.length} {supplierGroups.length === 1 ? 'OC' : 'OCs'} ({totalItemsCount} eq.)
                    </span>
                  </div>
                  <div className="h-6 w-px bg-slate-800" />
                  <div>
                    <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block">
                      Costo Total OCs
                    </span>
                    <span className="text-xs font-black text-emerald-400 font-mono">
                      ${contractTotalCost.toLocaleString('es-CO')} COP
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {!isReadOnly && (
                    <>
                      <button
                        type="button"
                        onClick={() => onOpenEditOCHeader(contract)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                        title="Editar datos del Contrato / Cliente"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onRequestDeleteContract(contract)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer"
                        title="Eliminar Contrato / OV del seguimiento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* LEVEL 2 & 3: SUPPLIER OCS AND EQUIPMENTS */}
            {!isCollapsed && (
              <div className="p-3 sm:p-4 space-y-3.5 bg-slate-950/40">
                {supplierGroups.length === 0 ? (
                  <div className="text-center py-6 bg-slate-900/60 rounded-xl border border-dashed border-slate-700/70 p-5 space-y-1.5">
                    <Boxes className="w-8 h-8 text-slate-500 mx-auto" />
                    <h4 className="text-xs font-bold text-slate-300">
                      Este contrato no tiene Órdenes de Compra (OC) generadas todavía.
                    </h4>
                    <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                      Las órdenes de compra se generan y sincronizan automáticamente al adjudicar la licitación o aprobar la orden de venta.
                    </p>
                  </div>
                ) : (
                  supplierGroups.map((group) => {
                    const groupKey = `${contract.id}___${group.supplier}___${group.ocNumber}`;
                    const isSupplierCollapsed = collapsedSupplierKeys.has(groupKey);
                    const deliveredCount = group.items.filter(
                      (i) => i.status === 'Entregado e Instalado' || i.status === 'Cerrado / Concluido'
                    ).length;
                    const allDelivered = deliveredCount === group.items.length && group.items.length > 0;

                    return (
                      <div
                        key={groupKey}
                        className={`border rounded-xl overflow-hidden shadow-md transition ${
                          allDelivered
                            ? 'bg-[#0b121d] border-emerald-950/80 hover:border-emerald-800/60'
                            : 'bg-[#0e1726] border-[#223854] hover:border-[#31517a]'
                        }`}
                      >
                        {/* LEVEL 2: SUPPLIER OC SUBHEADER (Collapsible) */}
                        <div className="p-2.5 sm:p-3 bg-[#142338] border-b border-[#223854] flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
                            {/* Collapse/Expand button */}
                            <button
                              type="button"
                              onClick={() => toggleSupplierCollapse(groupKey)}
                              className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer shrink-0"
                              title={isSupplierCollapsed ? 'Expandir equipos de este proveedor' : 'Minimizar equipos de este proveedor'}
                            >
                              {isSupplierCollapsed ? (
                                <ChevronRight className="w-4 h-4 text-sky-400" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                              )}
                            </button>

                            <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-400/40 flex items-center justify-center font-bold shrink-0">
                              <Building2 className="w-4 h-4" />
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4
                                  onClick={() => toggleSupplierCollapse(groupKey)}
                                  className="text-xs sm:text-sm font-black text-white cursor-pointer hover:text-sky-300 transition"
                                >
                                  {group.supplier}
                                </h4>
                                <span className="font-mono text-[11px] font-bold text-sky-300 bg-sky-950/90 px-2 py-0.5 rounded border border-sky-500/50">
                                  {group.ocNumber}
                                </span>
                                {allDelivered ? (
                                  <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9.5px] font-black px-2 py-0.5 rounded-full">
                                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                                    <span>Todos Entregados ({deliveredCount}/{group.items.length})</span>
                                  </span>
                                ) : deliveredCount > 0 ? (
                                  <span className="inline-flex items-center gap-1 bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[9.5px] font-bold px-1.5 py-0.5 rounded-full">
                                    <span>{deliveredCount}/{group.items.length} Entregados</span>
                                  </span>
                                ) : null}
                                {group.hasAlert && (
                                  <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9.5px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    <span>&gt;48h Sin Novedad</span>
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 block truncate">
                                Vinculada a {isSalesOrder ? 'Orden de Venta' : 'Contrato'}: <strong className="text-slate-300">{contract.contractNumber || contract.salesOrderNumber}</strong>
                              </span>
                            </div>
                          </div>

                          {/* Badges: Forma de Pago, Estado de Pago, Estado Operativo OC */}
                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            {/* Forma de Pago (Crédito, Contado, 50/50, etc.) */}
                            <div className="flex items-center gap-1">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPaymentTermsBadgeClass(
                                  group.paymentTerms
                                )}`}
                                title={`Forma de Pago acordada con ${group.supplier}`}
                              >
                                <CreditCard className="w-3 h-3 inline mr-1" />
                                {group.paymentTerms}
                              </span>
                            </div>

                            {/* Estado del Pago (Solo si NO es a Crédito) */}
                            {(!group.paymentTerms?.toLowerCase().includes('crédito') &&
                              !group.paymentTerms?.toLowerCase().includes('credito')) && (
                              <div className="flex items-center gap-1">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPaymentStatusBadgeClass(
                                    group.paymentStatus
                                  )}`}
                                >
                                  <DollarSign className="w-3 h-3 inline mr-0.5" />
                                  {group.paymentStatus}
                                </span>
                              </div>
                            )}

                            {/* Estado Operativo / Logístico de la OC */}
                            <div className="flex items-center gap-1">
                              <span
                                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getOCStatusBadgeClass(
                                  group.status
                                )}`}
                              >
                                <Activity className="w-3 h-3 inline mr-1" />
                                {group.status}
                              </span>
                            </div>

                            {/* Subtotal of this OC */}
                            <div className="text-[11px] font-black text-emerald-400 px-2.5 py-1 bg-[#101b2b] rounded-lg border border-[#334d6e] font-mono">
                              ${group.totalCostCOP.toLocaleString('es-CO')}
                            </div>

                            {/* Action Button: Delete OC */}
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() =>
                                  onRequestDeleteSupplierOC(contract.id, group.supplier, group.ocNumber)
                                }
                                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                                title="Eliminar esta OC y sus equipos del contrato"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* LEVEL 3: EQUIPMENTS TABLE FOR THIS SUPPLIER OC */}
                        {isSupplierCollapsed ? (
                          <div
                            onClick={() => toggleSupplierCollapse(groupKey)}
                            className="p-2.5 bg-[#0a111a] hover:bg-[#0f1a29] cursor-pointer flex items-center justify-between text-xs text-slate-400 transition"
                          >
                            <span className="flex items-center gap-2">
                              <ChevronRight className="w-3.5 h-3.5 text-sky-400" />
                              <span>
                                <strong>{group.items.length} {group.items.length === 1 ? 'equipo' : 'equipos'}</strong> en esta OC ({deliveredCount} entregados)
                              </span>
                            </span>
                            <span className="text-[11px] text-sky-400 font-semibold hover:underline">
                              Haz clic para desplegar tabla de equipos
                            </span>
                          </div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                              <thead>
                                <tr className="bg-[#0a111c] text-slate-400 border-b border-[#20334c] text-[10px] font-bold">
                                  <th className="py-2 px-3 min-w-[180px]">Equipo Médico Solicitado</th>
                                  <th className="py-2 px-2.5 min-w-[110px]">Marca / Modelo</th>
                                  <th className="py-2 px-2 w-12 text-center">Cant.</th>
                                  <th className="py-2 px-2.5 min-w-[100px] text-right">Costo Unit. COP</th>
                                  <th className="py-2 px-2.5 min-w-[100px] text-right">Subtotal</th>
                                  <th className="py-2 px-2.5 min-w-[140px]">Estado del Equipo</th>
                                  <th className="py-2 px-2.5 min-w-[120px]">Forma de Pago</th>
                                  <th className="py-2 px-2.5 min-w-[100px]">Última Novedad</th>
                                  <th className="py-2 px-2.5 w-24 text-center">Acciones</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#182940]">
                                {group.items.map((item) => {
                                  const lastUpdate = new Date(
                                    item.lastUpdatedAt || item.createdAt
                                  ).getTime();
                                  const hoursSinceUpdate = (Date.now() - lastUpdate) / (1000 * 60 * 60);
                                  const isAlert =
                                    hoursSinceUpdate > 48 &&
                                    item.status !== 'Entregado e Instalado' &&
                                    item.status !== 'Cerrado / Concluido' &&
                                    item.status !== 'Cancelada';

                                  const isDelivered =
                                    item.status === 'Entregado e Instalado' ||
                                    item.status === 'Cerrado / Concluido';

                                  return (
                                    <tr
                                      key={item.id}
                                      className={`transition ${
                                        isDelivered
                                          ? 'bg-[#080d16]/80 opacity-60 hover:opacity-100 border-l-2 border-l-emerald-500'
                                          : 'hover:bg-[#15253d]/70'
                                      }`}
                                    >
                                      {/* Equipment Name & Code */}
                                      <td className="py-2 px-3">
                                        <div className="font-bold text-white flex items-center gap-1.5 text-xs flex-wrap">
                                          <span className={isDelivered ? 'line-through text-slate-300' : ''}>
                                            {item.name}
                                          </span>
                                          {isDelivered && (
                                            <span className="inline-flex items-center gap-0.5 text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.2 rounded-md shrink-0">
                                              <CheckCircle2 className="w-2.5 h-2.5" />
                                              <span>ENTREGADO</span>
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-[9.5px] text-slate-400 font-mono">
                                          Cód: {item.code || 'N/A'} {item.invoiceNumber && `• Fact: ${item.invoiceNumber}`}
                                        </div>
                                        {onOpenSerialsModal && (
                                          <div className="mt-0.5">
                                            {(() => {
                                              const serialsCount =
                                                item.serialNumbers?.filter(
                                                  (s) => s.serialNumber && s.serialNumber.trim().length > 0
                                                ).length || 0;
                                              const isSerialsComplete =
                                                serialsCount >= (item.quantity || 1);

                                              return (
                                                <button
                                                  type="button"
                                                  onClick={() => onOpenSerialsModal(contract, item)}
                                                  className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded border transition cursor-pointer ${
                                                    isSerialsComplete
                                                      ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-500/50'
                                                      : serialsCount > 0
                                                      ? 'bg-amber-950/80 hover:bg-amber-900 text-amber-300 border-amber-500/50'
                                                      : 'bg-purple-950/80 hover:bg-purple-900 text-purple-300 border-purple-500/40'
                                                  }`}
                                                  title="Gestionar seriales, declaración DIAN y dossier hospitalario"
                                                >
                                                  <Tag className="w-2.5 h-2.5" />
                                                  <span>
                                                    Seriales ({serialsCount}/{item.quantity})
                                                  </span>
                                                </button>
                                              );
                                            })()}
                                          </div>
                                        )}
                                      </td>

                                      {/* Brand & Model */}
                                      <td className="py-2 px-2.5">
                                        <span className={`font-bold block text-xs ${isDelivered ? 'text-slate-300' : 'text-sky-300'}`}>
                                          {item.brand}
                                        </span>
                                        <span className="text-[10px] text-slate-400">{item.model}</span>
                                      </td>

                                      {/* Quantity */}
                                      <td className="py-2 px-2 text-center font-black text-white text-xs">
                                        {item.quantity}
                                      </td>

                                      {/* Cost COP */}
                                      <td className="py-2 px-2.5 text-right text-slate-300 font-mono text-[11px]">
                                        ${item.costPriceCOP?.toLocaleString('es-CO')}
                                      </td>

                                      {/* Subtotal COP */}
                                      <td className="py-2 px-2.5 text-right font-bold text-emerald-400 font-mono text-[11px]">
                                        ${item.totalCostCOP?.toLocaleString('es-CO')}
                                      </td>

                                      {/* Status Selector */}
                                      <td className="py-2 px-2.5">
                                        <select
                                          disabled={isReadOnly}
                                          value={item.status}
                                          onChange={(e) =>
                                            onQuickChangeItemStatus(
                                              contract.id,
                                              item.id,
                                              e.target.value as OCStatus
                                            )
                                          }
                                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border outline-none ${isReadOnly ? 'cursor-default opacity-85' : 'cursor-pointer'} w-full ${getOCStatusBadgeClass(
                                            item.status
                                          )}`}
                                        >
                                          {OC_STATUS_OPTIONS.map((opt) => (
                                            <option key={opt.status} value={opt.status} className="bg-[#192b45] text-white">
                                              {opt.label}
                                            </option>
                                          ))}
                                        </select>
                                      </td>

                                      {/* Payment Terms Selector */}
                                      <td className="py-2 px-2.5">
                                        <select
                                          disabled={isReadOnly}
                                          value={item.paymentTerms || 'Crédito 30 días'}
                                          onChange={(e) =>
                                            onQuickChangeItemPaymentTerms(
                                              contract.id,
                                              item.id,
                                              e.target.value as OCPaymentTerms
                                            )
                                          }
                                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border outline-none ${isReadOnly ? 'cursor-default opacity-85' : 'cursor-pointer'} w-full ${getPaymentTermsBadgeClass(
                                            item.paymentTerms
                                          )}`}
                                        >
                                          {PAYMENT_TERMS_OPTIONS.map((p) => (
                                            <option key={p.terms} value={p.terms} className="bg-[#192b45] text-white">
                                              {p.label}
                                            </option>
                                          ))}
                                        </select>
                                      </td>

                                      {/* 48h Alert & Last Update */}
                                      <td className="py-2 px-2.5">
                                        {isAlert ? (
                                          <div className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                            <Clock className="w-2.5 h-2.5 text-amber-400" />
                                            <span>Hace {Math.floor(hoursSinceUpdate / 24)}d</span>
                                          </div>
                                        ) : (
                                          <span className="text-[10px] text-slate-400 font-mono">
                                            {new Date(item.lastUpdatedAt || item.createdAt).toLocaleDateString('es-CO')}
                                          </span>
                                        )}
                                      </td>

                                      {/* Action Buttons */}
                                      <td className="py-2 px-2.5 text-center">
                                        <div className="flex items-center justify-center gap-1">
                                          {!isReadOnly && (
                                            <button
                                              type="button"
                                              onClick={() => onOpenEditItem(contract.id, item)}
                                              className="p-1 rounded bg-[#1b2d46] hover:bg-[#253f63] text-slate-300 hover:text-white transition cursor-pointer"
                                              title="Editar equipo y registrar novedad"
                                            >
                                              <Edit3 className="w-3 h-3 text-sky-400" />
                                            </button>
                                          )}

                                          {onOpenSerialsModal && (
                                            <button
                                              type="button"
                                              onClick={() => onOpenSerialsModal(contract, item)}
                                              className="p-1 rounded bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 hover:text-white transition cursor-pointer border border-purple-500/40"
                                              title="Seriales, Declaración DIAN y Dossier Hospitalario"
                                            >
                                              <Tag className="w-3 h-3" />
                                            </button>
                                          )}

                                          <button
                                            type="button"
                                            onClick={() =>
                                              onOpenHistory(
                                                `${contract.contractNumber} - ${item.supplier}`,
                                                item
                                              )
                                            }
                                            className="p-1 rounded bg-[#1b2d46] hover:bg-[#253f63] text-slate-300 hover:text-white transition cursor-pointer"
                                            title="Ver bitácora de historial"
                                          >
                                            <History className="w-3 h-3 text-purple-400" />
                                          </button>

                                          {!isReadOnly && (
                                            <button
                                              type="button"
                                              onClick={() => onRequestDeleteItem(contract.id, item)}
                                              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                                              title="Eliminar equipo"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
