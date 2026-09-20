import React, { useState, useEffect, useMemo } from 'react';
import { Edit3, X, Save, Building2, CreditCard, DollarSign, Activity, FileText } from 'lucide-react';
import { OCTrackingItem, OCStatus, OCPaymentTerms, OCPaymentStatus } from '../../../types';
import {
  COMMON_SUPPLIERS,
  KNOWN_MANUFACTURERS,
  PAYMENT_TERMS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  OC_STATUS_OPTIONS,
  isCreditPaymentTerms,
  getStoredSupplierProfiles,
  autoRegisterSupplierIfNotExists,
} from '../../../utils/ocTrackingStorage';

interface EditOCItemModalProps {
  contractId: string;
  item: OCTrackingItem;
  distinctSuppliers?: string[];
  onClose: () => void;
  onSave: (updates: Partial<OCTrackingItem>, novedadNote: string) => void;
}

export const EditOCItemModal: React.FC<EditOCItemModalProps> = ({
  item,
  distinctSuppliers = [],
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    status: item.status,
    supplier: item.supplier || '',
    ocNumber: item.ocNumber || '',
    costPriceCOP: item.costPriceCOP || 0,
    quantity: item.quantity || 1,
    paymentTerms: item.paymentTerms || 'Crédito 30 días',
    paymentStatus: item.paymentStatus || 'Pendiente',
    invoiceNumber: item.invoiceNumber || '',
    carrierName: item.carrierName || '',
    trackingNumber: item.trackingNumber || '',
    notes: item.notes || '',
  });

  const [novedadNote, setNovedadNote] = useState('');

  const storedProfiles = useMemo(() => getStoredSupplierProfiles(), []);

  const quickManufacturersList = useMemo(() => {
    const list: string[] = [];
    const pushIfNew = (name: string) => {
      if (name && !list.some((x) => x.toLowerCase() === name.toLowerCase())) {
        list.push(name);
      }
    };
    ['Mindray', 'COMEN', 'Sysmex', 'Draeger', 'EDAN', 'GE Healthcare', 'Philips', 'Welch Allyn', 'SonoScape'].forEach(pushIfNew);
    storedProfiles.forEach((p) => {
      if (p.brands && p.brands.length > 0) p.brands.forEach(pushIfNew);
      else pushIfNew(p.name);
    });
    return list.slice(0, 9);
  }, [storedProfiles]);

  const handleSelectSupplierPill = (name: string) => {
    setFormData((prev) => ({ ...prev, supplier: name }));
  };

  const isCredit = isCreditPaymentTerms(formData.paymentTerms);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalPaymentStatus: OCPaymentStatus = isCredit
      ? 'Crédito Vigente (Por Vencer)'
      : (formData.paymentStatus as OCPaymentStatus) || 'Pendiente';

    if (formData.supplier.trim()) {
      try {
        autoRegisterSupplierIfNotExists(formData.supplier.trim());
      } catch (err) {
        console.warn('Auto register supplier warning:', err);
      }
    }

    onSave(
      {
        ...formData,
        paymentStatus: finalPaymentStatus,
        quantity: Number(formData.quantity) || 1,
        costPriceCOP: Number(formData.costPriceCOP) || 0,
        totalCostCOP: (Number(formData.costPriceCOP) || 0) * (Number(formData.quantity) || 1),
      },
      novedadNote
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-3 sm:p-5 md:p-6 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#192b45] border border-[#334d6e] rounded-2xl w-full max-w-3xl lg:max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-3.5 sm:p-4 bg-[#142338] border-b border-[#334d6e] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10.5px] font-mono font-bold bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded border border-sky-400/30">
                {item.ocNumber || 'Sin OC'}
              </span>
              <span className="text-xs text-slate-300 font-bold">
                {item.supplier}
              </span>
            </div>
            <h3 className="text-sm font-black text-white mt-1">{item.name}</h3>
            <p className="text-[11px] text-slate-400">
              Marca: <strong className="text-sky-300">{item.brand}</strong> • Modelo: {item.model}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-3.5 sm:p-4 overflow-y-auto flex-1 space-y-3 text-xs">
          {/* Main Status Selector */}
          <div className="bg-[#15253d] p-3 rounded-xl border border-[#334d6e] space-y-1">
            <label className="block text-slate-200 font-bold flex items-center gap-1.5 text-xs">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span>Estado Logístico del Equipo / OC:</span>
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as OCStatus })}
              className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg p-2 text-white font-bold outline-none focus:border-[#38bdf8] cursor-pointer"
            >
              {OC_STATUS_OPTIONS.map((opt) => (
                <option key={opt.status} value={opt.status}>
                  {opt.label} — {opt.description}
                </option>
              ))}
            </select>
          </div>

          {/* Supplier & OC # */}
          <div className="bg-[#15253d] p-3 rounded-xl border border-[#334d6e] space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-300 font-bold mb-1 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-sky-400" />
                  <span>Proveedor / Fabricante:</span>
                </label>
                <input
                  type="text"
                  list="item-supplier-list"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg p-2 text-white font-bold outline-none focus:border-[#38bdf8]"
                />
                <datalist id="item-supplier-list">
                  {Array.from(new Set([...distinctSuppliers, ...COMMON_SUPPLIERS])).map((s, sIdx) => (
                    <option key={`item_sup_${s}_${sIdx}`} value={s} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-1">N° Orden de Compra (OC):</label>
                <input
                  type="text"
                  value={formData.ocNumber}
                  onChange={(e) => setFormData({ ...formData, ocNumber: e.target.value })}
                  className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg p-2 text-sky-300 font-mono font-bold outline-none focus:border-[#38bdf8]"
                />
              </div>
            </div>

            {/* Quick Fabricantes Pills */}
            <div className="flex items-center gap-1 flex-wrap pt-0.5">
              <span className="text-[10px] text-slate-400 font-bold mr-1">Fabricantes:</span>
              {quickManufacturersList.map((brand) => (
                <button
                  key={brand}
                  type="button"
                  onClick={() => handleSelectSupplierPill(brand)}
                  className={`text-[9.5px] px-2 py-0.5 rounded-full transition cursor-pointer ${
                    formData.supplier.toLowerCase().includes(brand.toLowerCase())
                      ? 'bg-sky-500 text-slate-950 font-black border border-sky-400'
                      : 'bg-[#101b2b] text-slate-300 border border-[#334d6e] hover:border-sky-400 hover:text-white'
                  }`}
                >
                  {brand}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Terms & Payment Status */}
          <div className="bg-[#15253d] p-3 rounded-xl border border-[#334d6e] space-y-2">
            <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
              <span>Condiciones de Pago al Proveedor</span>
            </h4>

            <div className={`grid gap-2.5 ${isCredit ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
              <div>
                <label className="block text-slate-300 font-bold mb-1">Forma de Pago:</label>
                <select
                  value={formData.paymentTerms}
                  onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value as OCPaymentTerms })}
                  className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg p-2 text-sky-300 font-bold outline-none focus:border-[#38bdf8] cursor-pointer"
                >
                  {PAYMENT_TERMS_OPTIONS.map((opt) => (
                    <option key={opt.terms} value={opt.terms}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {isCredit && (
                  <span className="inline-block text-[10px] text-sky-300/90 mt-1 font-semibold">
                    💳 Condición a crédito diferido (no requiere estado de pago manual)
                  </span>
                )}
              </div>

              {!isCredit && (
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Estado del Pago:</label>
                  <select
                    value={formData.paymentStatus}
                    onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as OCPaymentStatus })}
                    className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg p-2 text-emerald-300 font-bold outline-none focus:border-[#38bdf8] cursor-pointer"
                  >
                    {PAYMENT_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.status} value={opt.status}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Quantity & Cost */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-300 font-bold mb-1">Cantidad de Unidades:</label>
              <input
                type="number"
                min="1"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                className="w-full bg-[#15253d] border border-[#334d6e] rounded-lg p-2 text-white font-bold outline-none focus:border-[#38bdf8]"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Precio Costo Unitario COP:</label>
              <input
                type="number"
                min="0"
                value={formData.costPriceCOP}
                onChange={(e) => setFormData({ ...formData, costPriceCOP: parseFloat(e.target.value) || 0 })}
                className="w-full bg-[#15253d] border border-[#334d6e] rounded-lg p-2 text-emerald-400 font-bold outline-none focus:border-[#38bdf8]"
              />
            </div>
          </div>

          {/* Tracking & Invoice */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-slate-300 font-bold mb-1">N° Factura Proveedor:</label>
              <input
                type="text"
                placeholder="Ej: FE-990812"
                value={formData.invoiceNumber}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                className="w-full bg-[#15253d] border border-[#334d6e] rounded-lg p-2 text-white font-mono outline-none focus:border-[#38bdf8]"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1">Guía / Transportadora:</label>
              <input
                type="text"
                placeholder="Ej: DHL Express / Servientrega 109283"
                value={formData.trackingNumber}
                onChange={(e) => setFormData({ ...formData, trackingNumber: e.target.value })}
                className="w-full bg-[#15253d] border border-[#334d6e] rounded-lg p-2 text-white outline-none focus:border-[#38bdf8]"
              />
            </div>
          </div>

          {/* Register Novedad for 2-day reset */}
          <div className="bg-[#101b2b] p-3 rounded-xl border border-purple-500/40 space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-purple-300 font-black text-xs">
                📝 Registrar Novedad en Bitácora (Reinicia Alerta de 48h):
              </label>
              <span className="text-[10px] text-emerald-400 font-bold">✓ Reinicia contador</span>
            </div>
            <textarea
              rows={2}
              placeholder="Ej: Fabricante confirmó despacho de fábrica. En alistamiento de bodega..."
              value={novedadNote}
              onChange={(e) => setNovedadNote(e.target.value)}
              className="w-full bg-[#15253d] border border-[#334d6e] rounded-lg p-2 text-white outline-none focus:border-purple-400 placeholder-slate-500 text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-[#334d6e]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-slate-300 hover:bg-[#15253d] transition font-bold cursor-pointer text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-xl bg-[#38bdf8] text-slate-950 font-black hover:bg-[#0284c7] transition shadow-md cursor-pointer text-xs"
            >
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
