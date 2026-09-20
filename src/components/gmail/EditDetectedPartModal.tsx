import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  CheckCircle2,
  FileText,
  DollarSign,
  ShieldCheck,
  Building,
  Tag,
  Sparkles,
  Info,
  Package,
} from 'lucide-react';
import { DetectedPartToImport, DetectedPurchaseOrder } from '../../services/gmailIntegrationService';
import { MedicalEquipment } from '../../types';
import { cleanSupplierName } from '../../utils/cleanSupplierUtils';
import { EmailContentRenderer } from './EmailContentRenderer';

interface EditDetectedPartModalProps {
  isOpen: boolean;
  onClose: () => void;
  part: DetectedPartToImport | null;
  order: DetectedPurchaseOrder;
  onSavePart: (updatedPart: DetectedPartToImport, andImportToCatalog?: boolean) => void;
}

export const EditDetectedPartModal: React.FC<EditDetectedPartModalProps> = ({
  isOpen,
  onClose,
  part,
  order,
  onSavePart,
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [supplier, setSupplier] = useState('');
  const [invimaRecordNumber, setInvimaRecordNumber] = useState('');
  const [baseCostCOP, setBaseCostCOP] = useState<number>(0);
  const [taxExempt, setTaxExempt] = useState(false);
  const [category, setCategory] = useState<DetectedPartToImport['category']>('Accesorios');
  const [subReferences, setSubReferences] = useState('');
  const [showEmailContext, setShowEmailContext] = useState(true);

  useEffect(() => {
    if (part) {
      setCode(part.code || '');
      setName(part.name || '');
      setDescription(part.description || '');
      setBrand(part.brand || order.senderName || 'SYD');
      setModel(part.model || 'Estándar');
      setSupplier(cleanSupplierName(part.supplier) || cleanSupplierName(order.senderName) || 'Proveedor Asignado');
      setInvimaRecordNumber(part.invimaRecordNumber || 'INVIMA 2021EBC-0008450');
      setBaseCostCOP(part.baseCostCOP || 0);
      setTaxExempt(part.taxExempt || false);
      setCategory(part.category || 'Accesorios');
      setSubReferences(part.subReferences || '');
    } else {
      setCode('');
      setName('');
      setDescription('');
      setBrand(order.partCreationNotice?.requestedItem?.brand || order.detectedPartsToImport?.[0]?.brand || '');
      setModel(order.partCreationNotice?.requestedItem?.model || order.detectedPartsToImport?.[0]?.model || 'Estándar');
      setSupplier(cleanSupplierName(order.partCreationNotice?.requestedItem?.supplier) || cleanSupplierName(order.detectedPartsToImport?.[0]?.supplier) || '');
      setInvimaRecordNumber('INVIMA 2021EBC-0008450');
      setBaseCostCOP(0);
      setTaxExempt(false);
      setCategory('Accesorios');
      setSubReferences('');
    }
  }, [part, order]);

  if (!isOpen) return null;

  const formatCOP = (val: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const handleSubmit = (andImport: boolean = false) => {
    const trimmedCode = code.trim();
    const trimmedName = name.trim();

    if (!trimmedCode) {
      alert('Por favor ingrese el código oficial de la parte.');
      return;
    }
    if (!trimmedName) {
      alert('Por favor ingrese el nombre o referencia del equipo/parte.');
      return;
    }

    const updated: DetectedPartToImport = {
      code: trimmedCode,
      name: trimmedName,
      brand: brand.trim() || 'SYD',
      model: model.trim() || 'Estándar',
      supplier: cleanSupplierName(supplier.trim()) || 'Proveedor Asignado',
      invimaRecordNumber: invimaRecordNumber.trim(),
      baseCostCOP: Number(baseCostCOP) || 0,
      taxExempt,
      taxRate: taxExempt ? 0 : 0.19,
      category,
      subReferences: subReferences.trim(),
      description:
        description.trim() ||
        `Parte oficial ${trimmedCode}: ${trimmedName}${subReferences ? ` (Refs: ${subReferences})` : ''}`,
    };

    onSavePart(updated, andImport);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-emerald-950/60 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>{part ? 'Modificar Parte Detectada' : 'Agregar Nueva Parte'}</span>
                {code && (
                  <span className="text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/30">
                    {code}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Ajuste el nombre real, descripción, registro INVIMA y precio antes de importar al catálogo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Email Context Accordion - Larger, clearer and high legibility */}
          <div className="bg-slate-950/90 border border-cyan-500/30 rounded-xl p-3.5 space-y-2.5 shadow-inner">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-md bg-cyan-500/20 text-cyan-300">
                  <FileText className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <span className="font-bold text-sm text-cyan-300 block">
                    Texto del Correo ({order.senderName}):
                  </span>
                  <span className="text-xs text-slate-400 block truncate max-w-md" title={order.subject}>
                    Asunto: {order.subject}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEmailContext(!showEmailContext)}
                className="text-xs font-semibold text-cyan-400 hover:text-cyan-200 bg-slate-800/80 hover:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 transition cursor-pointer"
              >
                {showEmailContext ? 'Ocultar' : 'Ver mensaje original'}
              </button>
            </div>

            {showEmailContext && (
              <div className="space-y-2">
                {/* Detected codes in email for 1-click selection */}
                {(() => {
                  const raw = order.rawBodyText || order.snippet || '';
                  const foundCodes = Array.from(new Set(raw.match(/\b\d{4,8}\b/g) || []));
                  if (foundCodes.length > 0) {
                    return (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                        <span className="text-slate-400 font-semibold">Códigos detectados:</span>
                        {foundCodes.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setCode(c)}
                            className={`px-2 py-0.5 rounded-md font-mono font-bold text-xs border transition cursor-pointer ${
                              code === c
                                ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                                : 'bg-cyan-950/60 text-cyan-300 border-cyan-700/60 hover:bg-cyan-900'
                            }`}
                            title={`Haga clic para usar el código ${c}`}
                          >
                            #{c}
                          </button>
                        ))}
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="p-4 bg-slate-900/95 rounded-xl max-h-60 overflow-y-auto border border-slate-700 shadow-inner">
                  <EmailContentRenderer
                    content={order.rawBodyText || order.snippet || 'Sin texto'}
                    rawHtml={order.rawHtml}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Code and Name */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Código de Parte <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ej: 70868"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nombre Oficial / Referencia <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej: Laringoscopio Fibra Óptica Hojas Miller..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl px-3 py-2 text-xs text-white font-medium"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
                <span>Descripción Técnica Detallada</span>
                <span className="text-[10px] text-slate-500 font-normal">Se usará en cotizaciones</span>
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción completa, aplicaciones clínicas, características..."
                className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 rounded-xl p-3 text-xs text-slate-200"
              />
            </div>

            {/* Price & Tax */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl">
              <div>
                <label className="block text-xs font-bold text-emerald-300 mb-1 flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>Costo Base COP (Antes de IVA)</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={baseCostCOP || ''}
                  onChange={(e) => setBaseCostCOP(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full bg-slate-950 border border-emerald-500/40 focus:border-emerald-400 rounded-xl px-3 py-2 text-xs font-mono font-bold text-emerald-300"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Valor: <strong>{formatCOP(baseCostCOP)}</strong>
                </span>
              </div>

              <div className="flex flex-col justify-between">
                <label className="block text-xs font-bold text-slate-300 mb-1">Tratamiento Tributario</label>
                <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={taxExempt}
                    onChange={(e) => setTaxExempt(e.target.checked)}
                    className="rounded text-cyan-600 focus:ring-cyan-500 w-4 h-4 bg-slate-800"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-white">Exento de IVA (Tarifa 0%)</span>
                    <p className="text-[10px] text-slate-400">Marque si es dispositivo médico exento</p>
                  </div>
                </label>
              </div>
            </div>

            {/* INVIMA & Sub-references */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Registro Sanitario INVIMA</span>
                </label>
                <input
                  type="text"
                  value={invimaRecordNumber}
                  onChange={(e) => setInvimaRecordNumber(e.target.value)}
                  placeholder="Ej: INVIMA 2021EBC-0008450"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Sub-Referencias / Códigos Componentes</span>
                </label>
                <input
                  type="text"
                  value={subReferences}
                  onChange={(e) => setSubReferences(e.target.value)}
                  placeholder="Ej: 33681 13401 33682 11260"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            {/* Brand, Model, Supplier, Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Marca</label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Ej: Técnica Electromédica, Mindray..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Modelo</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Ej: Estándar, Adulto/Pediátrico..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Proveedor Asignado</label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Ej: Técnica Electromédica"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Categoría</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-400 rounded-xl px-3 py-2 text-xs text-white cursor-pointer"
                >
                  <option value="Accesorios">Accesorios</option>
                  <option value="Cirugía">Cirugía</option>
                  <option value="Monitoreo">Monitoreo</option>
                  <option value="Diagnóstico">Diagnóstico</option>
                  <option value="Quirófano">Quirófano</option>
                  <option value="Cuidados Críticos">Cuidados Críticos</option>
                  <option value="Hospitalización">Hospitalización</option>
                  <option value="Neonatología">Neonatología</option>
                  <option value="Laboratorio">Laboratorio</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleSubmit(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl border border-slate-600 transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-cyan-400" />
              <span>Guardar Modificación</span>
            </button>

            <button
              type="button"
              onClick={() => handleSubmit(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Crear Parte</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
