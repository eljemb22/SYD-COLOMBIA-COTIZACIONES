import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Edit3, X, Save, Building2, CreditCard, DollarSign, Activity } from 'lucide-react';
import { OCTrackingContract, OCStatus, OCPaymentTerms, OCPaymentStatus, AuthUser } from '../../../types';
import {
  COMMON_SUPPLIERS,
  PAYMENT_TERMS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  OC_STATUS_OPTIONS,
  isCreditPaymentTerms,
} from '../../../utils/ocTrackingStorage';

interface EditOCHeaderModalProps {
  contract: OCTrackingContract;
  distinctSuppliers: string[];
  currentUser?: AuthUser | null;
  onClose: () => void;
  onSave: (contractId: string, updates: Partial<OCTrackingContract>, syncToItems: boolean) => void;
}

export const EditOCHeaderModal: React.FC<EditOCHeaderModalProps> = ({
  contract,
  distinctSuppliers,
  currentUser,
  onClose,
  onSave,
}) => {
  const [ocNumber, setOcNumber] = useState(contract.ocNumber || '');
  const [supplier, setSupplier] = useState(contract.supplier || '');
  const [supplierNit, setSupplierNit] = useState(contract.supplierNit || '');
  const [supplierContact, setSupplierContact] = useState(contract.supplierContact || '');
  const [contractNumber, setContractNumber] = useState(contract.contractNumber || '');
  const [clientName, setClientName] = useState(contract.clientName || '');
  const [nit, setNit] = useState(contract.nit || '');
  const [city, setCity] = useState(contract.city || 'Colombia');
  const [totalBudgetCOP, setTotalBudgetCOP] = useState<number>(contract.totalBudgetCOP || 0);
  const [paymentTerms, setPaymentTerms] = useState<OCPaymentTerms | string>(
    contract.paymentTerms || 'Crédito 30 días'
  );
  const [paymentStatus, setPaymentStatus] = useState<OCPaymentStatus | string>(
    contract.paymentStatus || 'Pendiente'
  );
  const [globalStatus, setGlobalStatus] = useState<OCStatus | string>(
    contract.globalStatus || 'Borrador / Solicitud'
  );
  const [notes, setNotes] = useState(contract.notes || '');
  const [syncToItems, setSyncToItems] = useState(true);

  const isCredit = isCreditPaymentTerms(paymentTerms);

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

  // Quick select common brand/supplier
  const handleSelectSupplierPill = (name: string) => {
    setSupplier(name);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier.trim()) {
      alert('Por favor ingrese o seleccione el Proveedor / Fabricante');
      return;
    }
    if (!ocNumber.trim()) {
      alert('Por favor ingrese el Número de Orden de Compra (OC)');
      return;
    }

    const finalPaymentStatus: OCPaymentStatus = isCredit
      ? 'Crédito Vigente (Por Vencer)'
      : (paymentStatus as OCPaymentStatus) || 'Pendiente';

    onSave(
      contract.id,
      {
        ocNumber: ocNumber.trim(),
        supplier: supplier.trim(),
        supplierNit: supplierNit.trim(),
        supplierContact: supplierContact.trim(),
        contractNumber: contractNumber.trim(),
        clientName: clientName.trim(),
        nit: nit.trim(),
        city: city.trim(),
        totalBudgetCOP: Number(totalBudgetCOP) || 0,
        paymentTerms,
        paymentStatus: finalPaymentStatus,
        globalStatus,
        notes: notes.trim(),
      },
      syncToItems
    );
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/25 flex items-center justify-center p-3 sm:p-5 md:p-6 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#192b45] border border-amber-500/50 rounded-2xl w-full max-w-4xl lg:max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-4 py-2.5 bg-[#142338] border-b border-[#334d6e] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-md">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white">
                Editar Datos de la Orden de Compra & Proveedor
              </h3>
              <p className="text-[11px] text-slate-400">
                Personalice proveedor, forma de pago, estado logístico y cliente.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-3 sm:p-4 overflow-y-auto flex-1 space-y-2.5 text-xs">
          {/* Section 1: Proveedor / Fabricante (Customizable & Quick Select) */}
          <div className="bg-[#15253d] p-2.5 rounded-xl border border-[#334d6e] space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-slate-200 font-bold flex items-center gap-1.5 text-xs">
                <Building2 className="w-3.5 h-3.5 text-sky-400" />
                <span>Proveedor / Fabricante *</span>
              </label>
              <span className="text-[10px] text-slate-400">Escriba o elija un fabricante</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  required
                  placeholder="Ej: Mindray Medical / COMEN / Sysmex / GE"
                  list="edit-supplier-suggestions"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg px-2.5 py-1 text-white font-bold outline-none focus:border-amber-400 text-xs"
                />
                <datalist id="edit-supplier-suggestions">
                  {Array.from(new Set([...distinctSuppliers, ...COMMON_SUPPLIERS])).map((s, sIdx) => (
                    <option key={`edit_sup_${s}_${sIdx}`} value={s} />
                  ))}
                </datalist>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="NIT / ID Proveedor"
                  value={supplierNit}
                  onChange={(e) => setSupplierNit(e.target.value)}
                  className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg px-2.5 py-1 text-slate-300 font-mono outline-none focus:border-amber-400 text-xs"
                />
              </div>
            </div>

            {/* Quick Supplier Pills */}
            <div className="flex items-center gap-1 flex-wrap pt-0.5">
              <span className="text-[9.5px] text-slate-400 font-bold mr-1">Frecuentes:</span>
              {['Mindray', 'COMEN', 'Sysmex', 'GE Healthcare', 'Philips', 'Welch Allyn', 'SonoScape', 'Edan', 'Draeger'].map(
                (brand) => (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => handleSelectSupplierPill(brand)}
                    className={`text-[9.5px] px-1.5 py-0.2 rounded border transition cursor-pointer ${
                      supplier.toLowerCase().includes(brand.toLowerCase())
                        ? 'bg-amber-500 text-slate-950 font-black border-amber-400'
                        : 'bg-[#101b2b] text-slate-300 border-[#334d6e] hover:border-amber-400 hover:text-white'
                    }`}
                  >
                    {brand}
                  </button>
                )
              )}
            </div>

            <div>
              <input
                type="text"
                placeholder="Asesor / Contacto Comercial del Proveedor (Opcional)"
                value={supplierContact}
                onChange={(e) => setSupplierContact(e.target.value)}
                className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg px-2.5 py-1 text-slate-200 outline-none focus:border-amber-400 text-xs"
              />
            </div>
          </div>

          {/* Section 2: Datos de la Orden & Contrato */}
          <div className="bg-[#15253d] p-2.5 rounded-xl border border-[#334d6e] space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-300 font-bold mb-0.5 text-[11px]">N° Orden de Compra (OC) *:</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: OC-2026-0089"
                  value={ocNumber}
                  onChange={(e) => setOcNumber(e.target.value)}
                  className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg px-2.5 py-1 text-sky-300 font-mono font-bold outline-none focus:border-amber-400 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-0.5 text-[11px]">N° Contrato / Proceso:</label>
                <input
                  type="text"
                  placeholder="Ej: LP-2026-088"
                  value={contractNumber}
                  onChange={(e) => setContractNumber(e.target.value)}
                  className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg px-2.5 py-1 text-purple-300 font-mono outline-none focus:border-amber-400 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-0.5 text-[11px]">Cliente / Destino de Entrega:</label>
                <input
                  type="text"
                  placeholder="Ej: Hospital San Ignacio / Clínica del Country"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg px-2.5 py-1 text-white outline-none focus:border-amber-400 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-bold mb-0.5 text-[11px]">NIT del Cliente / Ciudad:</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    placeholder="NIT: 860.012.345-1"
                    value={nit}
                    onChange={(e) => setNit(e.target.value)}
                    className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg px-2 py-1 text-slate-300 font-mono outline-none focus:border-amber-400 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Ciudad"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg px-2 py-1 text-white outline-none focus:border-amber-400 text-xs"
                  />
                </div>
              </div>

              <div className="sm:col-span-2 bg-[#101b2b] p-2 rounded-lg border border-emerald-500/40 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-emerald-300 font-bold text-[11px] flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Valor / Presupuesto Total del Contrato o Licitación ($ COP):</span>
                  </label>
                  {totalBudgetCOP > 0 && (
                    <span className="text-[11px] font-black text-emerald-300 font-mono">
                      $ {totalBudgetCOP.toLocaleString('es-CO')} COP
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="Ej: 250000000"
                  value={totalBudgetCOP === 0 ? '' : totalBudgetCOP}
                  onChange={(e) => setTotalBudgetCOP(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                  className="w-full bg-[#0a1322] border border-[#334d6e] rounded-lg px-2.5 py-1 text-white font-mono font-bold outline-none focus:border-emerald-400 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Forma de Pago & Estados */}
          <div className="bg-[#15253d] p-2.5 rounded-xl border border-[#334d6e] space-y-2">
            <h4 className="font-bold text-white text-xs flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
              <span>Condiciones Comerciales, Forma de Pago & Estado</span>
            </h4>

            <div className={`grid gap-2 ${isCredit ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-3'}`}>
              {/* Forma de Pago al Proveedor (Crédito, Contado, 50/50, etc.) */}
              <div>
                <label className="block text-slate-300 font-bold mb-0.5 text-[11px] flex items-center gap-1">
                  <CreditCard className="w-3 h-3 text-sky-400" />
                  <span>Forma de Pago:</span>
                </label>
                <select
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg px-2 py-1 text-sky-300 font-bold outline-none focus:border-amber-400 cursor-pointer text-xs"
                >
                  {PAYMENT_TERMS_OPTIONS.map((opt) => (
                    <option key={opt.terms} value={opt.terms}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {isCredit && (
                  <span className="inline-block text-[9.5px] text-sky-300/90 mt-1 font-semibold">
                    💳 Pago diferido según plazo comercial
                  </span>
                )}
              </div>

              {/* Estado del Pago: Oculto para pagos a crédito */}
              {!isCredit && (
                <div>
                  <label className="block text-slate-300 font-bold mb-0.5 text-[11px] flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-emerald-400" />
                    <span>Estado del Pago:</span>
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as any)}
                    className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg px-2 py-1 text-emerald-300 font-bold outline-none focus:border-amber-400 cursor-pointer text-xs"
                  >
                    {PAYMENT_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.status} value={opt.status}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Estado Operativo / Logístico de la OC */}
              <div>
                <label className="block text-slate-300 font-bold mb-0.5 text-[11px] flex items-center gap-1">
                  <Activity className="w-3 h-3 text-purple-400" />
                  <span>Estado Operativo:</span>
                </label>
                <select
                  value={globalStatus}
                  onChange={(e) => setGlobalStatus(e.target.value as OCStatus)}
                  className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg px-2 py-1 text-white font-bold outline-none focus:border-amber-400 cursor-pointer text-xs"
                >
                  {OC_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.status} value={opt.status}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <input
                type="text"
                placeholder="Notas u observaciones de compra / entrega..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-[#101b2b] border border-[#334d6e] rounded-lg px-2.5 py-1 text-white outline-none focus:border-amber-400 text-xs"
              />
            </div>

            {/* Sync to items checkbox */}
            {contract.items.length > 0 && (
              <label className="flex items-center gap-2 p-1.5 rounded-lg bg-[#101b2b] border border-[#334d6e] cursor-pointer hover:bg-[#132236]">
                <input
                  type="checkbox"
                  checked={syncToItems}
                  onChange={(e) => setSyncToItems(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-sky-500 cursor-pointer"
                />
                <span className="text-slate-200 text-[11px] font-bold">
                  Sincronizar Proveedor ({supplier || 'Asignado'}), N° OC ({ocNumber}) y Forma de Pago en todos los {contract.items.length} equipos
                </span>
              </label>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#334d6e]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-[#15253d] hover:bg-[#203654] text-white rounded-xl font-bold text-xs cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-4 py-1.5 rounded-xl transition cursor-pointer shadow-lg active:scale-95"
            >
              <Save className="w-4 h-4" />
              <span>Guardar Cambios</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
