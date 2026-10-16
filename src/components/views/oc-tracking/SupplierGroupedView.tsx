import React, { useState } from 'react';
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
  FileText,
  Paperclip,
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
} from '../../../types';
import {
  PAYMENT_TERMS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  OC_STATUS_OPTIONS,
} from '../../../utils/ocTrackingStorage';
import { isValidOCNumber } from '../../../utils/formatters';
import { resolveItemManufacturerBrand } from '../../../utils/equipmentBrandResolver';
import { SupplierInvoicesModal } from './SupplierInvoicesModal';

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
  onUpdateOCNumber?: (contractId: string, supplier: string, oldOCNumber: string, newOCNumber: string) => void;
  onSaveSupplierInvoices?: (contractId: string, supplier: string, ocNumber: string, invoices: SupplierInvoiceAttachment[]) => void;
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
  onUpdateOCNumber,
  onSaveSupplierInvoices,
  currentUser,
}) => {
  const isReadOnly = currentUser?.role === 'viewer' && !currentUser?.permissions?.canManageOCTracking;

  // State for manual OC number modal
  const [editingOCModal, setEditingOCModal] = React.useState<{
    contractId: string;
    supplier: string;
    oldOC: string;
    newOC: string;
  } | null>(null);

  // State for supplier invoices attachment modal
  const [supplierInvoicesTarget, setSupplierInvoicesTarget] = useState<{
    contractId: string;
    supplier: string;
    ocNumber: string;
    clientName?: string;
    contractNumber?: string;
    invoices: SupplierInvoiceAttachment[];
  } | null>(null);

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
          style={{
            backgroundColor: 'var(--syd-card-bg)',
            borderColor: 'var(--syd-border-color)',
          }}
          className="border rounded-2xl shadow-xl overflow-hidden"
        >
          {/* Supplier Header */}
          <div
            style={{
              backgroundColor: 'var(--syd-card-hover)',
              borderColor: 'var(--syd-border-color)',
            }}
            className="p-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div className="flex items-center gap-3">
              <div
                style={{
                  backgroundColor: 'var(--syd-accent-glow)',
                  borderColor: 'var(--syd-accent)',
                  color: 'var(--syd-accent)',
                }}
                className="w-10 h-10 rounded-xl border flex items-center justify-center font-black"
              >
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

            <div
              style={{
                backgroundColor: 'var(--syd-card-bg)',
                borderColor: 'var(--syd-border-color)',
              }}
              className="text-left sm:text-right px-3 py-1 rounded-xl border"
            >
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
                style={{
                  backgroundColor: 'var(--syd-card-bg)',
                  borderColor: 'var(--syd-border-color)',
                }}
                className="border rounded-2xl overflow-hidden"
              >
                {/* OC Header */}
                <div
                  style={{
                    backgroundColor: 'var(--syd-card-hover)',
                    borderColor: 'var(--syd-border-color)',
                  }}
                  className="p-3 border-b flex flex-col md:flex-row md:items-center justify-between gap-2.5"
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    {oc.ocNumber && oc.ocNumber !== 'Sin N° OC' ? (
                      <div className="flex items-center gap-1.5">
                        <span
                          style={{
                            backgroundColor: 'var(--syd-accent-glow)',
                            borderColor: 'var(--syd-accent)',
                            color: 'var(--syd-accent)',
                          }}
                          className="font-mono text-xs font-black px-2 py-0.5 rounded border"
                        >
                          {oc.ocNumber}
                        </span>
                        {!isReadOnly && onUpdateOCNumber && (
                          <button
                            type="button"
                            onClick={() =>
                              setEditingOCModal({
                                contractId: oc.contractId,
                                supplier: grp.supplier,
                                oldOC: oc.ocNumber,
                                newOC: oc.ocNumber,
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
                              contractId: oc.contractId,
                              supplier: grp.supplier,
                              oldOC: '',
                              newOC: '',
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition cursor-pointer"
                          title="Asignar el número de Orden de Compra (OC) consecutivo de la empresa"
                        >
                          <Plus className="w-3 h-3 stroke-[2.5]" />
                          <span>Añadir OC</span>
                        </button>
                      ) : (
                        <span className="font-mono text-xs font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                          Sin N° OC
                        </span>
                      )
                    )}
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

                    {/* Facturas del Proveedor (Anexos de facturas emitidas por el fabricante / proveedor) */}
                    {(() => {
                      const ocInvoices: SupplierInvoiceAttachment[] = (oc.items || []).flatMap((it) => it.supplierInvoices || []).reduce((acc: SupplierInvoiceAttachment[], inv) => {
                        if (!acc.some((existing) => existing.id === inv.id || (existing.invoiceNumber === inv.invoiceNumber && existing.fileName === inv.fileName))) {
                          acc.push(inv);
                        }
                        return acc;
                      }, []);

                      return (
                        <button
                          type="button"
                          onClick={() =>
                            setSupplierInvoicesTarget({
                              contractId: oc.contractId,
                              supplier: grp.supplier,
                              ocNumber: oc.ocNumber,
                              clientName: oc.clientName,
                              contractNumber: oc.contractNumber,
                              invoices: ocInvoices,
                            })
                          }
                          className={`inline-flex items-center gap-1.5 text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border transition cursor-pointer ${
                            ocInvoices.length > 0
                              ? 'bg-indigo-500/25 hover:bg-indigo-500/40 text-indigo-300 border-indigo-500/50 shadow-xs'
                              : 'bg-slate-800 hover:bg-indigo-950/60 text-slate-300 hover:text-indigo-200 border-slate-700'
                          }`}
                          title="Ver y anexar facturas del proveedor para esta Orden de Compra"
                        >
                          <FileText className="w-3 h-3 text-indigo-400" />
                          <span>Facturas Proveedor ({ocInvoices.length})</span>
                        </button>
                      );
                    })()}

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
                              {resolveItemManufacturerBrand(it)} <span className="text-slate-400 font-normal">({it.model})</span>
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-white">{it.quantity}</td>
                            <td className="py-2 px-3 text-right text-slate-300 font-mono">
                              ${it.costPriceCOP?.toLocaleString('es-CO')}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-400 font-mono">
                              ${it.totalCostCOP?.toLocaleString('es-CO')}
                            </td>
                            <td className="py-2 px-3">
                              {(() => {
                                const hasOC = Boolean(
                                  isValidOCNumber(oc.ocNumber) ||
                                  isValidOCNumber(it.ocNumber)
                                );
                                return (
                                  <div className="space-y-0.5">
                                    <select
                                      disabled={isReadOnly || !hasOC}
                                      value={it.status}
                                      onChange={(e) => {
                                        if (!hasOC) {
                                          alert('⛔ ACCIÓN BLOQUEADA:\n\nDebe colocar el número consecutivo de la OC primero para poder manipular el estado del equipo.\n\nSin número de OC no se puede saber ni hacer seguimiento a este estado.');
                                          return;
                                        }
                                        onQuickChangeItemStatus(oc.contractId, it.id, e.target.value as OCStatus);
                                      }}
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border outline-none w-full ${
                                        !hasOC
                                          ? 'opacity-40 bg-slate-800 text-slate-400 cursor-not-allowed border-slate-700'
                                          : isReadOnly
                                          ? 'cursor-default opacity-85'
                                          : 'cursor-pointer'
                                      } ${hasOC ? getOCStatusBadgeClass(it.status) : ''}`}
                                      title={!hasOC ? 'Bloqueado: Debe colocar el número de la OC primero' : 'Cambiar estado del equipo'}
                                    >
                                      {OC_STATUS_OPTIONS.map((opt) => (
                                        <option key={opt.status} value={opt.status} className="bg-[#192b45] text-white">
                                          {opt.label}
                                        </option>
                                      ))}
                                    </select>
                                    {!hasOC && (
                                      <div className="text-[8.5px] font-black text-amber-300 flex items-center gap-0.5">
                                        <Lock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                        <span>N° OC requerido</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="py-2 px-3">
                              {(() => {
                                const hasOC = Boolean(
                                  isValidOCNumber(oc.ocNumber) ||
                                  isValidOCNumber(it.ocNumber)
                                );
                                return (
                                  <select
                                    disabled={isReadOnly || !hasOC}
                                    value={it.paymentTerms || 'Crédito 30 días'}
                                    onChange={(e) => {
                                      if (!hasOC) return;
                                      onQuickChangeItemPaymentTerms(
                                        oc.contractId,
                                        it.id,
                                        e.target.value as OCPaymentTerms
                                      );
                                    }}
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-lg border outline-none w-full ${
                                      !hasOC
                                        ? 'opacity-40 bg-slate-800 text-slate-400 cursor-not-allowed border-slate-700'
                                        : isReadOnly
                                        ? 'cursor-default opacity-85'
                                        : 'cursor-pointer'
                                    } ${hasOC ? getPaymentTermsBadgeClass(it.paymentTerms) : ''}`}
                                    title={!hasOC ? 'Bloqueado: Ingrese N° OC primero' : 'Forma de pago'}
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

      {/* MODAL: FACTURAS DEL PROVEEDOR */}
      {supplierInvoicesTarget && (
        <SupplierInvoicesModal
          isOpen={true}
          onClose={() => setSupplierInvoicesTarget(null)}
          supplier={supplierInvoicesTarget.supplier}
          ocNumber={supplierInvoicesTarget.ocNumber}
          clientName={supplierInvoicesTarget.clientName}
          contractNumber={supplierInvoicesTarget.contractNumber}
          invoices={supplierInvoicesTarget.invoices}
          onSaveInvoices={(updatedInvoices) => {
            onSaveSupplierInvoices?.(
              supplierInvoicesTarget.contractId,
              supplierInvoicesTarget.supplier,
              supplierInvoicesTarget.ocNumber,
              updatedInvoices
            );
            setSupplierInvoicesTarget(null);
          }}
          isReadOnly={isReadOnly}
        />
      )}
    </div>
  );
};
