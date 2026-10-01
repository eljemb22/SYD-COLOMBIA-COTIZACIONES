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
  Lock,
} from 'lucide-react';
import {
  OCTrackingContract,
  OCTrackingItem,
  OCStatus,
  OCPaymentTerms,
  OCPaymentStatus,
  AuthUser,
  SupplierInvoiceAttachment,
  SalesOrderRecord,
} from '../../../types';
import {
  PAYMENT_TERMS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  OC_STATUS_OPTIONS,
} from '../../../utils/ocTrackingStorage';
import { isValidOCNumber } from '../../../utils/formatters';
import { SupplierInvoicesModal } from './SupplierInvoicesModal';

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
  onUpdateOCNumber?: (contractId: string, supplier: string, oldOCNumber: string, newOCNumber: string) => void;
  onUpdateSalesOrderNumber?: (contractId: string, newOVNumber: string) => void;
  onSaveSupplierInvoices?: (contractId: string, supplier: string, ocNumber: string, invoices: SupplierInvoiceAttachment[]) => void;
  onNavigateToTab?: (tab: string) => void;
  currentUser?: AuthUser | null;
  salesOrders?: SalesOrderRecord[];
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
  onUpdateOCNumber,
  onUpdateSalesOrderNumber,
  onSaveSupplierInvoices,
  currentUser,
  salesOrders = [],
}) => {
  const isReadOnly = currentUser?.role === 'viewer' && !currentUser?.permissions?.canManageOCTracking;

  // State for manual OC number modal
  const [editingOCModal, setEditingOCModal] = useState<{
    contractId: string;
    supplier: string;
    oldOC: string;
    newOC: string;
  } | null>(null);

  // State for manual OV (Sales Order) number modal
  const [editingSalesOrderModal, setEditingSalesOrderModal] = useState<{
    contractId: string;
    currentOV: string;
  } | null>(null);

  // State for Supplier Invoices attachment modal
  const [supplierInvoicesTarget, setSupplierInvoicesTarget] = useState<{
    contract: OCTrackingContract;
    supplier: string;
    ocNumber: string;
    invoices: SupplierInvoiceAttachment[];
  } | null>(null);

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
    const rawContractNum = contract.contractNumber || '';
    const cleanContractNum = rawContractNum.replace(/^ov:\s*/i, '').trim();

    // Identify Client OC or Tender Process number
    const isTender =
      contract.sourceType === 'licitacion_adjudicada' ||
      Boolean(contract.tenderClientId) ||
      cleanContractNum.toLowerCase().startsWith('nohb') ||
      cleanContractNum.toLowerCase().startsWith('lic') ||
      cleanContractNum.toLowerCase().startsWith('contrato');

    const clientOCorProcess =
      cleanContractNum && !cleanContractNum.startsWith('ov-')
        ? cleanContractNum
        : contract.tenderClientId || (contract.quoteNumber ? `Cotiz: ${contract.quoteNumber}` : '');

    if (isTender) {
      return (
        <span className="inline-flex items-center gap-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[11px] font-black px-2.5 py-0.5 rounded-lg shadow-xs">
          <Tag className="w-3.5 h-3.5 text-purple-400" />
          <span>LICITACIÓN / OC CLIENTE ({clientOCorProcess || 'Adjudicada'})</span>
        </span>
      );
    }
    if (contract.sourceType === 'cotizacion_aprobada' || contract.quoteNumber) {
      return (
        <span className="inline-flex items-center gap-1.5 bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[11px] font-black px-2.5 py-0.5 rounded-lg shadow-xs">
          <FileText className="w-3.5 h-3.5 text-sky-400" />
          <span>OC CLIENTE ({clientOCorProcess || contract.quoteNumber || 'Cotización Aprobada'})</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-black px-2.5 py-0.5 rounded-lg shadow-xs">
        <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
        <span>OC CLIENTE ({clientOCorProcess || 'Directa'})</span>
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
                    <span className="font-mono text-sky-300 font-bold bg-sky-950/60 px-2 py-0.5 rounded border border-sky-500/40">
                      {contract.salesOrderNumber || contract.contractNumber || 'Sin N° de OV'}
                    </span>
                    {!isReadOnly && onUpdateSalesOrderNumber && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingSalesOrderModal({
                            contractId: contract.id,
                            currentOV: contract.salesOrderNumber || (isSalesOrder ? contract.contractNumber : '') || '',
                          })
                        }
                        className="p-1 rounded text-amber-400 hover:text-white hover:bg-amber-900/40 transition cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                        title="Modificar manualmente el número consecutivo de Orden de Venta (OV)"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>N° OV Manual</span>
                      </button>
                    )}
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
                                {isValidOCNumber(group.ocNumber) ? (
                                  <div className="flex items-center gap-1">
                                    <span className="font-mono text-[11px] font-bold text-sky-300 bg-sky-950/90 px-2 py-0.5 rounded border border-sky-500/50">
                                      {group.ocNumber}
                                    </span>
                                    {!isReadOnly && onUpdateOCNumber && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEditingOCModal({
                                            contractId: contract.id,
                                            supplier: group.supplier,
                                            oldOC: group.ocNumber,
                                            newOC: group.ocNumber,
                                          })
                                        }
                                        className="p-1 rounded text-sky-400 hover:text-white hover:bg-sky-900/50 transition cursor-pointer"
                                        title="Modificar número consecutivo de OC asignado por la empresa"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  !isReadOnly && onUpdateOCNumber ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditingOCModal({
                                          contractId: contract.id,
                                          supplier: group.supplier,
                                          oldOC: '',
                                          newOC: '',
                                        })
                                      }
                                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10.5px] font-bold transition cursor-pointer"
                                      title="Asignar el número de Orden de Compra (OC) consecutivo de la empresa"
                                    >
                                      <Plus className="w-3 h-3 stroke-[2.5]" />
                                      <span>Añadir OC</span>
                                    </button>
                                  ) : (
                                    <span className="font-mono text-[10.5px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                                      Sin N° OC
                                    </span>
                                  )
                                )}
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

                            {/* Facturas del Proveedor (Anexos de facturas emitidas por el fabricante / proveedor) */}
                            {(() => {
                              const groupInvoices: SupplierInvoiceAttachment[] = group.items.flatMap((it) => it.supplierInvoices || []).reduce((acc: SupplierInvoiceAttachment[], inv) => {
                                if (!acc.some((existing) => existing.id === inv.id || (existing.invoiceNumber === inv.invoiceNumber && existing.fileName === inv.fileName))) {
                                  acc.push(inv);
                                }
                                return acc;
                              }, (contract.supplierInvoices || []).filter((inv) => {
                                if (!inv) return false;
                                const matchNotes = inv.notes && (inv.notes.includes(group.ocNumber) || inv.notes.toLowerCase().includes(group.supplier.toLowerCase()));
                                const matchProps = (inv.ocNumber && inv.ocNumber === group.ocNumber) || (inv.supplier && inv.supplier.toLowerCase() === group.supplier.toLowerCase());
                                return matchNotes || matchProps;
                              }));

                              return (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSupplierInvoicesTarget({
                                      contract,
                                      supplier: group.supplier,
                                      ocNumber: group.ocNumber,
                                      invoices: groupInvoices,
                                    })
                                  }
                                  className={`inline-flex items-center gap-1.5 text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border transition cursor-pointer ${
                                    groupInvoices.length > 0
                                      ? 'bg-indigo-500/25 hover:bg-indigo-500/40 text-indigo-300 border-indigo-500/50 shadow-xs'
                                      : 'bg-slate-800 hover:bg-indigo-950/60 text-slate-300 hover:text-indigo-200 border-slate-700'
                                  }`}
                                  title="Ver y anexar facturas del proveedor para esta Orden de Compra"
                                >
                                  <FileText className="w-3 h-3 text-indigo-400" />
                                  <span>Facturas Proveedor ({groupInvoices.length})</span>
                                </button>
                              );
                            })()}

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
                                        {(() => {
                                          const hasOCNumber = Boolean(
                                            isValidOCNumber(group.ocNumber) ||
                                            isValidOCNumber(item.ocNumber)
                                          );

                                          return (
                                            <div className="space-y-0.5">
                                              <select
                                                disabled={isReadOnly || !hasOCNumber}
                                                value={item.status}
                                                onChange={(e) => {
                                                  if (!hasOCNumber) {
                                                    alert('Debe colocar el número de la OC primero para poder manipular el estado del equipo.');
                                                    return;
                                                  }
                                                  onQuickChangeItemStatus(
                                                    contract.id,
                                                    item.id,
                                                    e.target.value as OCStatus
                                                  );
                                                }}
                                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border outline-none w-full ${
                                                  !hasOCNumber
                                                    ? 'opacity-40 bg-slate-800 text-slate-400 cursor-not-allowed border-slate-700'
                                                    : isReadOnly
                                                    ? 'cursor-default opacity-85'
                                                    : 'cursor-pointer'
                                                } ${hasOCNumber ? getOCStatusBadgeClass(item.status) : ''}`}
                                                title={!hasOCNumber ? 'Bloqueado: Debe colocar el número de la OC primero' : 'Cambiar estado del equipo'}
                                              >
                                                {OC_STATUS_OPTIONS.map((opt) => (
                                                  <option key={opt.status} value={opt.status} className="bg-[#192b45] text-white">
                                                    {opt.label}
                                                  </option>
                                                ))}
                                              </select>
                                              {!hasOCNumber && (
                                                <div
                                                  onClick={() => {
                                                    if (!isReadOnly && onUpdateOCNumber) {
                                                      setEditingOCModal({
                                                        contractId: contract.id,
                                                        supplier: group.supplier,
                                                        oldOC: '',
                                                        newOC: '',
                                                      });
                                                    }
                                                  }}
                                                  className="text-[8.5px] font-black text-amber-300 flex items-center gap-0.5 cursor-pointer hover:underline"
                                                  title="Clic para ingresar el número de OC"
                                                >
                                                  <Lock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                                  <span>Asignar N° OC primero</span>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })()}
                                      </td>

                                      {/* Payment Terms Selector */}
                                      <td className="py-2 px-2.5">
                                        {(() => {
                                          const hasOCNumber = Boolean(
                                            isValidOCNumber(group.ocNumber) ||
                                            isValidOCNumber(item.ocNumber)
                                          );

                                          return (
                                            <select
                                              disabled={isReadOnly || !hasOCNumber}
                                              value={item.paymentTerms || 'Crédito 30 días'}
                                              onChange={(e) => {
                                                if (!hasOCNumber) return;
                                                onQuickChangeItemPaymentTerms(
                                                  contract.id,
                                                  item.id,
                                                  e.target.value as OCPaymentTerms
                                                );
                                              }}
                                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border outline-none w-full ${
                                                !hasOCNumber
                                                  ? 'opacity-40 bg-slate-800 text-slate-400 cursor-not-allowed border-slate-700'
                                                  : isReadOnly
                                                  ? 'cursor-default opacity-85'
                                                  : 'cursor-pointer'
                                              } ${hasOCNumber ? getPaymentTermsBadgeClass(item.paymentTerms) : ''}`}
                                              title={!hasOCNumber ? 'Bloqueado: Debe colocar el número de la OC primero' : 'Forma de pago'}
                                            >
                                              {PAYMENT_TERMS_OPTIONS.map((p) => (
                                                <option key={p.terms} value={p.terms} className="bg-[#192b45] text-white">
                                                  {p.label}
                                                </option>
                                              ))}
                                            </select>
                                          );
                                        })()}
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
                                              setSupplierInvoicesTarget({
                                                contract,
                                                supplier: group.supplier,
                                                ocNumber: group.ocNumber,
                                                invoices: (item.supplierInvoices && item.supplierInvoices.length > 0)
                                                  ? item.supplierInvoices
                                                  : (contract.supplierInvoices || []).filter((inv) => inv && (inv.ocNumber === group.ocNumber || inv.supplier?.toLowerCase() === group.supplier.toLowerCase())),
                                              })
                                            }
                                            className="p-1 rounded bg-[#1b2d46] hover:bg-[#253f63] text-indigo-300 hover:text-white transition cursor-pointer"
                                            title="Ver o anexar facturas del proveedor"
                                          >
                                            <FileText className="w-3 h-3 text-indigo-400" />
                                          </button>

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

      {/* MODAL: ASIGNAR / MODIFICAR N° DE OC MANUAL */}
      {editingOCModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#132235] border border-sky-500/50 rounded-2xl shadow-2xl p-6 text-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#253952]">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black text-white">
                  {editingOCModal.oldOC ? 'Modificar N° de OC' : 'Añadir N° de OC Manual'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingOCModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Proveedor: <strong className="text-white">{editingOCModal.supplier}</strong>
              </p>
              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1.5">
                  Número de Orden de Compra (OC de la Empresa) *:
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="ej: OC-1045 o Consecutivo Interno"
                  value={editingOCModal.newOC}
                  onChange={(e) =>
                    setEditingOCModal((prev) => (prev ? { ...prev, newOC: e.target.value } : null))
                  }
                  className="w-full bg-[#0b1420] border-2 border-amber-500/60 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-300 outline-none focus:border-amber-400"
                />
                <p className="text-[10.5px] text-slate-400 mt-1">
                  Ingrese el número consecutivo oficial que le asigna el sistema interno de la empresa.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#253952]">
              <button
                type="button"
                onClick={() => setEditingOCModal(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!editingOCModal.newOC.trim()) return;
                  onUpdateOCNumber?.(
                    editingOCModal.contractId,
                    editingOCModal.supplier,
                    editingOCModal.oldOC,
                    editingOCModal.newOC.trim()
                  );
                  setEditingOCModal(null);
                }}
                disabled={!editingOCModal.newOC.trim()}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition cursor-pointer disabled:opacity-50"
              >
                Guardar N° de OC
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MANUAL SALES ORDER (OV) NUMBER ASSIGNMENT */}
      {editingSalesOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#101b2b] border border-amber-500/50 rounded-2xl w-full max-w-md p-4 sm:p-5 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-[#253952] pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>Asignar N° de Orden de Venta (OV) Manual</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingSalesOrderModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Selecciona una Orden de Venta (OV) existente o asigna manualmente su número consecutivo oficial.
              </p>
              {salesOrders.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-amber-300 mb-1">
                    Seleccionar Orden de Venta (OV) Registrada:
                  </label>
                  <select
                    onChange={(e) => {
                      const so = salesOrders.find((s) => s.id === e.target.value);
                      if (so && so.salesOrderNumber) {
                        setEditingSalesOrderModal((prev) => prev ? { ...prev, currentOV: so.salesOrderNumber } : null);
                      }
                    }}
                    className="w-full bg-[#0b1420] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none mb-2 cursor-pointer"
                  >
                    <option value="">-- Seleccionar OV existente --</option>
                    {salesOrders.map((so) => (
                      <option key={so.id} value={so.id}>
                        {so.salesOrderNumber} — {so.clientName} (${so.totalValueCOP?.toLocaleString('es-CO')})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1.5">
                  Número Consecutivo de Orden de Venta (OV) *:
                </label>
                <input
                  type="text"
                  placeholder="ej: OV-2026-001"
                  value={editingSalesOrderModal.currentOV}
                  onChange={(e) =>
                    setEditingSalesOrderModal((prev) =>
                      prev ? { ...prev, currentOV: e.target.value } : null
                    )
                  }
                  className="w-full bg-[#0b1420] border-2 border-amber-500/60 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-300 outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#253952]">
              <button
                type="button"
                onClick={() => setEditingSalesOrderModal(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!editingSalesOrderModal.currentOV.trim()) return;
                  onUpdateSalesOrderNumber?.(
                    editingSalesOrderModal.contractId,
                    editingSalesOrderModal.currentOV.trim().toUpperCase()
                  );
                  setEditingSalesOrderModal(null);
                }}
                disabled={!editingSalesOrderModal.currentOV.trim()}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition cursor-pointer disabled:opacity-50"
              >
                Guardar N° de OV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SUPPLIER INVOICES ATTACHMENT */}
      {supplierInvoicesTarget && (
        <SupplierInvoicesModal
          isOpen={true}
          onClose={() => setSupplierInvoicesTarget(null)}
          supplier={supplierInvoicesTarget.supplier}
          ocNumber={supplierInvoicesTarget.ocNumber}
          clientName={supplierInvoicesTarget.contract.clientName}
          contractNumber={supplierInvoicesTarget.contract.contractNumber || supplierInvoicesTarget.contract.salesOrderNumber}
          invoices={supplierInvoicesTarget.invoices}
          isReadOnly={isReadOnly}
          onSaveInvoices={(updatedInvoices) => {
            onSaveSupplierInvoices?.(
              supplierInvoicesTarget.contract.id,
              supplierInvoicesTarget.supplier,
              supplierInvoicesTarget.ocNumber,
              updatedInvoices
            );
            setSupplierInvoicesTarget(null);
          }}
        />
      )}
    </div>
  );
};
