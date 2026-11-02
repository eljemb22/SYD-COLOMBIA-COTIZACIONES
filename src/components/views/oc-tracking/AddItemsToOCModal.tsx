import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Trash2, Filter, DollarSign } from 'lucide-react';
import { OCTrackingItem, MedicalEquipment, AuthUser, OCPaymentTerms, OCPaymentStatus } from '../../../types';
import {
  isEquipmentComplete,
  getMatchingEquipmentsForSupplier,
  extractBrandFromSupplier,
  autoRegisterSupplierIfNotExists,
} from '../../../utils/ocTrackingStorage';
import { formatCOP } from '../../../utils/formatters';

interface AddItemsToOCModalProps {
  contractId: string;
  ocNumber: string;
  supplier: string;
  paymentTerms?: OCPaymentTerms | string;
  paymentStatus?: OCPaymentStatus | string;
  equipments: MedicalEquipment[];
  currentUser?: AuthUser | null;
  onClose: () => void;
  onSave: (newItems: OCTrackingItem[]) => void;
}

interface TempEquipmentRow {
  tempId: string;
  name: string;
  brand: string;
  model: string;
  quantity: number;
  costPriceCOP: number;
  taxRate?: number;
  code?: string;
  equipmentId?: string;
}

export const AddItemsToOCModal: React.FC<AddItemsToOCModalProps> = ({
  ocNumber,
  supplier,
  paymentTerms = 'Crédito 30 días',
  paymentStatus = 'Pendiente',
  equipments,
  currentUser,
  onClose,
  onSave,
}) => {
  const [showAllBrandsOverride, setShowAllBrandsOverride] = useState(false);
  const detected = extractBrandFromSupplier(supplier);

  const [itemsList, setItemsList] = useState<TempEquipmentRow[]>([
    {
      tempId: `add-${Date.now()}-1`,
      name: '',
      brand: detected || '',
      model: '',
      quantity: 1,
      costPriceCOP: 0,
      taxRate: 0.19,
    },
  ]);

  const supplierEquipmentMatch = useMemo(() => {
    return getMatchingEquipmentsForSupplier(equipments, supplier, !showAllBrandsOverride);
  }, [equipments, supplier, showAllBrandsOverride]);

  // Handle ESC key press to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleAddBlankRow = () => {
    setItemsList((prev) => [
      ...prev,
      {
        tempId: `add-${Date.now()}-${prev.length + 1}`,
        name: '',
        brand: detected || '',
        model: '',
        quantity: 1,
        costPriceCOP: 0,
        taxRate: 0.19,
      },
    ]);
  };

  const handleAddFromCatalog = (eqId: string) => {
    const eq = equipments.find((e) => e.id === eqId);
    if (!eq) return;

    if (!isEquipmentComplete(eq)) {
      alert(`El equipo "${eq.name}" tiene información incompleta o costo de $0 COP. Complete su información en el Catálogo antes de agregarlo.`);
      return;
    }

    setItemsList((prev) => [
      ...prev.filter((r) => r.name.trim() !== ''),
      {
        tempId: `add-${Date.now()}-${prev.length + 1}`,
        equipmentId: eq.id,
        code: eq.code,
        name: eq.name,
        brand: eq.brand,
        model: eq.model,
        quantity: 1,
        costPriceCOP: eq.baseCostCOP || 0,
        taxRate: eq.taxExempt ? 0 : (eq.taxRate !== undefined ? eq.taxRate : 0.19),
      },
    ]);
  };

  const handleUpdateItem = (index: number, field: keyof TempEquipmentRow, val: any) => {
    setItemsList((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  const handleRemoveRow = (index: number) => {
    if (itemsList.length <= 1) return;
    setItemsList((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotalBeforeTax = itemsList.reduce((sum, it) => sum + (it.costPriceCOP || 0) * (it.quantity || 1), 0);
  const totalTax = itemsList.reduce((sum, it) => sum + ((it.costPriceCOP || 0) * (it.quantity || 1) * (it.taxRate !== undefined ? it.taxRate : 0.19)), 0);
  const totalCost = subtotalBeforeTax + totalTax;
  const totalUnits = itemsList.reduce((sum, it) => sum + (it.quantity || 1), 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validItems = itemsList.filter((it) => it.name.trim().length > 0);
    if (validItems.length === 0) {
      alert('Por favor ingrese al menos un equipo médico');
      return;
    }

    for (let i = 0; i < validItems.length; i++) {
      const it = validItems[i];
      if (!it.brand.trim() || !it.model.trim()) {
        alert(`El equipo #${i + 1} (${it.name}) debe tener Marca y Modelo definidos.`);
        return;
      }
      if (!it.costPriceCOP || it.costPriceCOP <= 0) {
        alert(`El equipo #${i + 1} (${it.name}) no puede tener costo de $0 COP. Ingrese el costo de compra.`);
        return;
      }
    }

    const created: OCTrackingItem[] = validItems.map((v, idx) => {
      const rowRate = v.taxRate !== undefined ? v.taxRate : 0.19;
      const rowSubtotal = (Number(v.costPriceCOP) || 0) * (Number(v.quantity) || 1);
      const rowTotal = rowSubtotal * (1 + rowRate);

      return {
        id: `oc-item-${Date.now()}-${idx}`,
        equipmentId: v.equipmentId,
        code: v.code || `EQ-ADD-${idx + 1}`,
        name: v.name,
        brand: v.brand || 'SYD Biomedical',
        model: v.model || 'Standard',
        quantity: Number(v.quantity) || 1,
        costPriceCOP: Number(v.costPriceCOP) || 0,
        totalCostCOP: rowTotal,
        supplier: supplier,
        ocNumber: ocNumber,
        status: 'Emitida / Enviada al Proveedor',
        paymentTerms: paymentTerms,
        paymentStatus: paymentStatus,
        notes: `Agregado a la OC ${ocNumber}.`,
        createdAt: new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        history: [
          {
            id: `log-add-${Date.now()}-${idx}`,
            timestamp: new Date().toISOString(),
            newStatus: 'Emitida / Enviada al Proveedor',
            user: currentUser ? `${currentUser.name}` : 'Usuario SYD',
            note: `Equipo incorporado a la Orden de Compra ${ocNumber} (Subtotal: ${formatCOP(rowSubtotal)}, Total: ${formatCOP(rowTotal)}).`,
          },
        ],
      };
    });

    try {
      autoRegisterSupplierIfNotExists(supplier.trim());
    } catch (e) {
      console.warn('Auto register supplier warning:', e);
    }

    onSave(created);
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/25 flex items-center justify-center p-3 sm:p-5 md:p-6 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#192b45] border border-[#334d6e] rounded-2xl w-full max-w-5xl lg:max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-3 sm:p-4 bg-[#142338] border-b border-[#334d6e] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-black text-sky-300 bg-sky-950/80 px-2 py-0.5 rounded border border-sky-400/40">
                {ocNumber}
              </span>
              <h3 className="text-sm sm:text-base font-black text-white">Agregar Equipos a la Orden de Compra</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Proveedor: <strong className="text-white">{supplier}</strong>
              {detected && (
                <span className="ml-2 text-[10px] font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/40">
                  Marca fabricante: {detected}
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-3 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-200 text-xs">Equipos a Incorporar:</span>
              {supplierEquipmentMatch.detectedBrand && !showAllBrandsOverride && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                  <Filter className="w-3 h-3" />
                  <span>Filtrando por: <strong>{supplierEquipmentMatch.detectedBrand}</strong> ({supplierEquipmentMatch.matching.length} equipos con costo)</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {supplierEquipmentMatch.detectedBrand && (
                <button
                  type="button"
                  onClick={() => setShowAllBrandsOverride(!showAllBrandsOverride)}
                  className="text-[10px] text-slate-400 hover:text-sky-300 underline font-semibold cursor-pointer"
                >
                  {showAllBrandsOverride ? 'Filtrar por ' + supplierEquipmentMatch.detectedBrand : 'Ver todas las marcas'}
                </button>
              )}

              <select
                onChange={(e) => {
                  if (e.target.value) {
                    handleAddFromCatalog(e.target.value);
                    e.target.value = '';
                  }
                }}
                className="bg-[#101b2b] border border-[#334d6e] text-xs text-sky-300 rounded-lg p-1.5 outline-none cursor-pointer max-w-[240px]"
              >
                <option value="">+ Cargar desde Catálogo...</option>
                {supplierEquipmentMatch.matching.length === 0 ? (
                  <option value="" disabled>No hay equipos completos para este proveedor</option>
                ) : (
                  supplierEquipmentMatch.matching.map((eq, eqIdx) => (
                    <option key={`add-oc-${eq.id || eq.code || 'eq'}-${eqIdx}`} value={eq.id}>
                      {eq.name} — {eq.brand} (${(eq.baseCostCOP || 0).toLocaleString('es-CO')})
                    </option>
                  ))
                )}
              </select>

              <button
                type="button"
                onClick={handleAddBlankRow}
                className="inline-flex items-center gap-1.5 bg-[var(--syd-accent)]/20 hover:bg-[var(--syd-accent)]/30 text-sky-300 border border-sky-400/40 text-xs font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Agregar Fila</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#223854] max-h-56 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[#101b2b] z-10">
                <tr className="text-slate-400 border-b border-[#334d6e] text-[10px] sm:text-[10.5px] font-bold">
                  <th className="py-1 px-1.5 w-6 text-center">#</th>
                  <th className="py-1 px-2 min-w-[140px]">Equipo Médico *</th>
                  <th className="py-1 px-1.5 w-24">Marca *</th>
                  <th className="py-1 px-1.5 w-24">Modelo *</th>
                  <th className="py-1 px-1 w-10 text-center">Cant *</th>
                  <th className="py-1 px-1.5 w-28 text-right">Costo Antes IVA *</th>
                  <th className="py-1 px-1.5 w-28 text-right">Subtotal Antes IVA</th>
                  <th className="py-1 px-1 w-14 text-center">IVA</th>
                  <th className="py-1 px-2 w-28 text-right">Total</th>
                  <th className="py-1 px-1 w-6 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#223854] bg-[#101b2b]/60">
                {itemsList.map((row, idx) => {
                  const rowRate = row.taxRate !== undefined ? row.taxRate : 0.19;
                  const rowSubtotalBeforeTax = (row.costPriceCOP || 0) * (row.quantity || 1);
                  const rowTax = rowSubtotalBeforeTax * rowRate;
                  const rowTotal = rowSubtotalBeforeTax + rowTax;
                  const isRowIncomplete = !row.name.trim() || !row.brand.trim() || !row.model.trim() || (row.costPriceCOP || 0) <= 0;

                  return (
                    <tr key={row.tempId} className={`hover:bg-[#182a44] ${isRowIncomplete ? 'bg-amber-950/10' : ''}`}>
                      <td className="py-1 px-1.5 text-center text-slate-400 font-mono text-[10.5px]">
                        {idx + 1}
                      </td>
                      <td className="py-1 px-1.5">
                        <input
                          type="text"
                          required
                          placeholder="Nombre..."
                          value={row.name}
                          onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                          className="w-full bg-[#101b2b] border border-[#334d6e] rounded px-1.5 py-0.5 text-white outline-none focus:border-[var(--syd-accent)] text-xs"
                        />
                      </td>
                      <td className="py-1 px-1.5">
                        <input
                          type="text"
                          required
                          placeholder="Marca..."
                          value={row.brand}
                          onChange={(e) => handleUpdateItem(idx, 'brand', e.target.value)}
                          className="w-full bg-[#101b2b] border border-[#334d6e] rounded px-1.5 py-0.5 text-white outline-none focus:border-[var(--syd-accent)] text-xs font-semibold"
                        />
                      </td>
                      <td className="py-1 px-1.5">
                        <input
                          type="text"
                          required
                          placeholder="Modelo..."
                          value={row.model}
                          onChange={(e) => handleUpdateItem(idx, 'model', e.target.value)}
                          className="w-full bg-[#101b2b] border border-[#334d6e] rounded px-1.5 py-0.5 text-white outline-none focus:border-[var(--syd-accent)] text-xs"
                        />
                      </td>
                      <td className="py-1 px-1 text-center">
                        <input
                          type="number"
                          min="1"
                          required
                          value={row.quantity}
                          onChange={(e) => handleUpdateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-10 text-center bg-[#101b2b] border border-[#334d6e] rounded py-0.5 text-white font-black outline-none focus:border-[var(--syd-accent)] text-xs"
                        />
                      </td>
                      <td className="py-1 px-1.5 text-right">
                        <input
                          type="number"
                          min="1"
                          required
                          placeholder="Costo Antes IVA..."
                          value={row.costPriceCOP || ''}
                          onChange={(e) => handleUpdateItem(idx, 'costPriceCOP', parseFloat(e.target.value) || 0)}
                          className={`w-full text-right bg-[#101b2b] border rounded px-1.5 py-0.5 font-bold outline-none text-xs ${
                            (row.costPriceCOP || 0) <= 0
                              ? 'border-rose-500/70 text-rose-300 focus:border-rose-400'
                              : 'border-[#334d6e] text-emerald-400 focus:border-[var(--syd-accent)]'
                          }`}
                        />
                      </td>
                      <td className="py-1 px-1.5 text-right font-bold text-sky-300 text-xs">
                        ${rowSubtotalBeforeTax.toLocaleString('es-CO')}
                      </td>
                      <td className="py-1 px-1 text-center">
                        <select
                          value={rowRate}
                          onChange={(e) => handleUpdateItem(idx, 'taxRate', parseFloat(e.target.value))}
                          className="bg-[#101b2b] border border-[#334d6e] text-[10px] text-amber-300 rounded px-1 py-0.5 font-bold outline-none cursor-pointer"
                        >
                          <option value={0.19}>19%</option>
                          <option value={0.05}>5%</option>
                          <option value={0}>0%</option>
                        </select>
                      </td>
                      <td className="py-1 px-2 text-right font-black text-emerald-400 text-xs">
                        ${rowTotal.toLocaleString('es-CO')}
                      </td>
                      <td className="py-1 px-1 text-center">
                        {itemsList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            className="p-1 text-slate-400 hover:text-rose-400 rounded transition cursor-pointer"
                            title="Eliminar fila"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 pt-1.5 border-t border-[#334d6e] text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">
                Total Equipos: <strong className="text-white">{totalUnits}</strong> uds
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-[10.5px] text-slate-400">
                Costo antes de IVA, subtotal y total calculados sin desborde.
              </span>
            </div>
            <div className="flex items-center gap-3 text-right">
              <div>
                <span className="text-slate-400 text-[11px] block">Subtotal Antes IVA:</span>
                <span className="text-xs sm:text-sm font-bold text-sky-300">
                  ${subtotalBeforeTax.toLocaleString('es-CO')}
                </span>
              </div>
              <div className="border-l border-[#334d6e] pl-3">
                <span className="text-slate-400 text-[11px] block">IVA Liquidado:</span>
                <span className="text-xs sm:text-sm font-bold text-amber-300">
                  ${totalTax.toLocaleString('es-CO')}
                </span>
              </div>
              <div className="border-l border-[#334d6e] pl-3">
                <span className="text-slate-300 text-[11px] font-bold block">Total Adicional (con IVA):</span>
                <span className="text-sm sm:text-base font-black text-emerald-400">
                  ${totalCost.toLocaleString('es-CO')} COP
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-slate-300 hover:bg-[#15253d] transition font-bold cursor-pointer text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-400 to-blue-500 text-slate-950 font-black hover:from-sky-300 hover:to-blue-400 transition shadow-lg cursor-pointer text-xs"
            >
              Confirmar e Incorporar
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
