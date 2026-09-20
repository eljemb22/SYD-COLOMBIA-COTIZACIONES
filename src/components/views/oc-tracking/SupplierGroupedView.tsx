import React from 'react';
import {
  Building2,
  Calendar,
  Clock,
  CreditCard,
  DollarSign,
  Edit3,
  History,
  MapPin,
  Plus,
  Tag,
  Trash2,
  Activity,
  AlertTriangle,
  Boxes,
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

export interface GroupedSupplierData {
  supplier: string;
  totalCostCOP: number;
  totalUnits: number;
  hasAlert: boolean;
  ocGroups: {
    ocNumber: string;
    contractId: string;
    contractNumber: string;
    clientName: string;
    city: string;
    paymentTerms: OCPaymentTerms | string;
    paymentStatus: OCPaymentStatus | string;
    status: OCStatus | string;
    totalCostCOP: number;
    items: OCTrackingItem[];
  }[];
}

interface SupplierGroupedViewProps {
  supplierGroups: GroupedSupplierData[];
  onOpenAddItemsToOC: (contractId: string, ocNumber: string, supplier: string) => void;
  onOpenEditItem: (contractId: string, item: OCTrackingItem) => void;
  onOpenSerialsModal?: (contractId: string, item: OCTrackingItem) => void;
  onOpenHistory: (contractName: string, item: OCTrackingItem) => void;
  onQuickChangeItemStatus: (contractId: string, itemId: string, newStatus: OCStatus) => void;
  onQuickChangeItemPaymentTerms: (contractId: string, itemId: string, terms: OCPaymentTerms) => void;
  onRequestDeleteItem: (contractId: string, item: OCTrackingItem) => void;
  currentUser?: AuthUser | null;
}

export const SupplierGroupedView: React.FC<SupplierGroupedViewProps> = ({
  supplierGroups,
  onOpenAddItemsToOC,
  onOpenEditItem,
  onOpenSerialsModal,
  onOpenHistory,
  onQuickChangeItemStatus,
  onQuickChangeItemPaymentTerms,
  onRequestDeleteItem,
  currentUser,
}) => {
  const isReadOnly = currentUser?.role === 'viewer' && !currentUser?.permissions?.canManageOCTracking;

  const getPaymentTermsBadgeClass = (terms?: string) => {
    const found = PAYMENT_TERMS_OPTIONS.find((p) => p.terms === terms);
    return found ? found.badgeColor : 'bg-slate-500/20 text-slate-300 border-slate-500/40';
  };

  const getOCStatusBadgeClass = (status?: string) => {
    const found = OC_STATUS_OPTIONS.find((s) => s.status === status);
    return found ? found.badgeColor : 'bg-slate-500/20 text-slate-300 border-slate-500/40';
  };

  return (
    <div className="space-y-6">
      {supplierGroups.map((grp, grpIdx) => (
        <div
          key={`supplier_group_${grp.supplier}_${grpIdx}`}
          className="bg-[#15253d] border border-[#334d6e] rounded-2xl shadow-xl overflow-hidden"
        >
          {/* Supplier Header */}
          <div className="p-4 bg-[#142338] border-b border-[#334d6e] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-400/40 flex items-center justify-center font-black">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white">{grp.supplier}</h3>
                  {grp.hasAlert && (
                    <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10.5px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Alerta de Gestión</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {grp.ocGroups.length} Órdenes de Compra • {grp.totalUnits} Equipos en seguimiento
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right px-3 py-1 bg-[#101b2b] rounded-xl border border-[#334d6e]">
              <span className="text-[10px] text-slate-400 font-bold block">Inversión con este Proveedor</span>
              <span className="text-sm sm:text-base font-black text-emerald-400">
                ${grp.totalCostCOP.toLocaleString('es-CO')} COP
              </span>
            </div>
          </div>

          {/* OCs of this supplier */}
          <div className="p-4 space-y-4">
            {grp.ocGroups.map((oc, ocIdx) => (
              <div
                key={`grp_oc_${oc.contractId}_${oc.ocNumber}_${ocIdx}`}
                className="bg-[#101b2b] border border-[#2d4666] rounded-2xl overflow-hidden"
              >
                {/* OC Header */}
                <div className="p-3 bg-[#142338] border-b border-[#2d4666] flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-black text-sky-300 bg-sky-950 px-2 py-0.5 rounded border border-sky-400/40">
                      {oc.ocNumber}
                    </span>
                    <span className="text-xs font-bold text-white">
                      Cliente: {oc.clientName}
                    </span>
                    <span className="text-[11px] text-purple-300 font-mono">
                      (Contrato: {oc.contractNumber})
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${getPaymentTermsBadgeClass(
                        oc.paymentTerms
                      )}`}
                    >
                      <CreditCard className="w-3 h-3 inline mr-1" />
                      {oc.paymentTerms}
                    </span>

                    <span
                      className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full border ${getOCStatusBadgeClass(
                        oc.status
                      )}`}
                    >
                      <Activity className="w-3 h-3 inline mr-1" />
                      {oc.status}
                    </span>

                    <span className="text-xs font-bold text-emerald-400">
                      ${oc.totalCostCOP.toLocaleString('es-CO')} COP
                    </span>

                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => onOpenAddItemsToOC(oc.contractId, oc.ocNumber, grp.supplier)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold bg-[#1d3350] hover:bg-[#27446b] text-sky-300 px-2.5 py-1 rounded-lg border border-sky-500/30 transition cursor-pointer"
                        title="Agregar equipos a esta Orden de Compra"
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                        <span>Equipos</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#0e1726] text-slate-400 border-b border-[#243a56] text-[10px] font-bold">
                        <th className="py-2 px-3">Equipo Médico</th>
                        <th className="py-2 px-3">Marca / Modelo</th>
                        <th className="py-2 px-3 text-center">Cant.</th>
                        <th className="py-2 px-3 text-right">Costo Unit. COP</th>
                        <th className="py-2 px-3 text-right">Subtotal</th>
                        <th className="py-2 px-3">Estado</th>
                        <th className="py-2 px-3">Forma Pago</th>
                        <th className="py-2 px-3 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1b2d46]">
                      {oc.items.map((it) => {
                        const serialsCount =
                          it.serialNumbers?.filter(
                            (s) => s.serialNumber && s.serialNumber.trim().length > 0
                          ).length || 0;
                        const isSerialsComplete = serialsCount >= (it.quantity || 1);

                        return (
                          <tr key={it.id} className="hover:bg-[#15253d]/80">
                            <td className="py-2 px-3">
                              <div className="font-bold text-white">{it.name}</div>
                              {onOpenSerialsModal && (
                                <button
                                  type="button"
                                  onClick={() => onOpenSerialsModal(oc.contractId, it)}
                                  className={`mt-1 inline-flex items-center gap-1 text-[9.5px] font-bold px-1.5 py-0.5 rounded border transition cursor-pointer ${
                                    isSerialsComplete
                                      ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-500/50'
                                      : serialsCount > 0
                                      ? 'bg-amber-950/80 hover:bg-amber-900 text-amber-300 border-amber-500/50'
                                      : 'bg-purple-950/80 hover:bg-purple-900 text-purple-300 border-purple-500/40'
                                  }`}
                                  title="Gestionar seriales, declaración DIAN y dossier hospitalario"
                                >
                                  <Tag className="w-2.5 h-2.5" />
                                  <span>Seriales ({serialsCount}/{it.quantity})</span>
                                </button>
                              )}
                            </td>
                            <td className="py-2 px-3 text-sky-300">
                              {it.brand} <span className="text-slate-400 font-normal">({it.model})</span>
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-white">{it.quantity}</td>
                            <td className="py-2 px-3 text-right text-slate-300 font-mono">
                              ${it.costPriceCOP?.toLocaleString('es-CO')}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-400 font-mono">
                              ${it.totalCostCOP?.toLocaleString('es-CO')}
                            </td>
                            <td className="py-2 px-3">
                              <select
                                disabled={isReadOnly}
                                value={it.status}
                                onChange={(e) =>
                                  onQuickChangeItemStatus(oc.contractId, it.id, e.target.value as OCStatus)
                                }
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border outline-none ${isReadOnly ? 'cursor-default opacity-85' : 'cursor-pointer'} ${getOCStatusBadgeClass(
                                  it.status
                                )}`}
                              >
                                {OC_STATUS_OPTIONS.map((opt) => (
                                  <option key={opt.status} value={opt.status} className="bg-[#192b45] text-white">
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-3">
                              <select
                                disabled={isReadOnly}
                                value={it.paymentTerms || 'Crédito 30 días'}
                                onChange={(e) =>
                                  onQuickChangeItemPaymentTerms(
                                    oc.contractId,
                                    it.id,
                                    e.target.value as OCPaymentTerms
                                  )
                                }
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border outline-none ${isReadOnly ? 'cursor-default opacity-85' : 'cursor-pointer'} ${getPaymentTermsBadgeClass(
                                  it.paymentTerms
                                )}`}
                              >
                                {PAYMENT_TERMS_OPTIONS.map((p) => (
                                  <option key={p.terms} value={p.terms} className="bg-[#192b45] text-white">
                                    {p.label}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {!isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenEditItem(oc.contractId, it)}
                                    className="p-1 text-slate-300 hover:text-white rounded bg-[#1b2d46]"
                                    title="Editar"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                                  </button>
                                )}
                                {onOpenSerialsModal && (
                                  <button
                                    type="button"
                                    onClick={() => onOpenSerialsModal(oc.contractId, it)}
                                    className="p-1 text-purple-300 hover:text-white rounded bg-purple-950/60 border border-purple-500/40"
                                    title="Expediente Técnico y Seriales"
                                  >
                                    <Tag className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => onOpenHistory(`${oc.contractNumber} - ${grp.supplier}`, it)}
                                  className="p-1 text-slate-300 hover:text-white rounded bg-[#1b2d46]"
                                  title="Historial"
                                >
                                  <History className="w-3.5 h-3.5 text-purple-400" />
                                </button>
                                {!isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() => onRequestDeleteItem(oc.contractId, it)}
                                    className="p-1 text-slate-400 hover:text-rose-400 rounded"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
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
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
