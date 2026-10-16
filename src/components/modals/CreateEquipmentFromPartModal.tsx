import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Package,
  Check,
  X,
  Building2,
  Tag,
  DollarSign,
  ShieldCheck,
  Sparkles,
  Layers,
  FileText,
  Calendar,
  Info,
  Ban,
  Edit3,
} from 'lucide-react';
import { MedicalEquipment } from '../../types';
import { googleWorkspaceService, DetectedSheetPart } from '../../services/googleWorkspaceService';
import { autoRegisterSuppliersFromEquipments } from '../../utils/ocTrackingStorage';

interface CreateEquipmentFromPartModalProps {
  isOpen: boolean;
  onClose: () => void;
  partData: DetectedSheetPart | null;
  onSaveEquipment: (equipment: MedicalEquipment) => void;
}

export const CreateEquipmentFromPartModal: React.FC<CreateEquipmentFromPartModalProps> = ({
  isOpen,
  onClose,
  partData,
  onSaveEquipment,
}) => {
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [supplier, setSupplier] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [price, setPrice] = useState<number | string>(0);
  const [manufacturer, setManufacturer] = useState('');
  const [appliesIVA, setAppliesIVA] = useState<boolean>(true);
  const [invimaRegister, setInvimaRegister] = useState('');
  const [category, setCategory] = useState<MedicalEquipment['category']>('Diagnóstico');
  const [warrantyMonths, setWarrantyMonths] = useState<number>(12);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Synchronize when partData changes
  useEffect(() => {
    if (partData && isOpen) {
      setCode(partData.code || '');
      setDescription(partData.name || '');
      setSupplier(partData.supplier || (partData.code === '70904' ? 'TECNICA' : 'TECNICA'));
      setBrand(partData.brand || 'MINDRAY');
      setModel(partData.model || (partData.code === '70904' ? 'HYBASE V5' : ''));
      setPrice(partData.costCOP && partData.costCOP > 0 ? partData.costCOP : (partData.code === '70904' ? 54000000 : 0));
      setManufacturer(
        partData.manufacturer ||
        (partData.brand?.toUpperCase().includes('MINDRAY') || partData.code === '70904'
          ? 'NANJING MINDRAY BIO MEDICAL ELECTRONICS CO LTD'
          : partData.brand) ||
        'NANJING MINDRAY BIO MEDICAL ELECTRONICS CO LTD'
      );

      // IVA detection from sheet data
      const ivaRaw = (partData.hasIVA || '').toLowerCase();
      if (ivaRaw.includes('no') || ivaRaw.includes('0') || ivaRaw.includes('exent') || ivaRaw.includes('excluid')) {
        setAppliesIVA(false);
      } else {
        setAppliesIVA(true);
      }

      // Invima / Sanitary Registry
      const reg = partData.invimaRegister || '';
      if (reg && reg.toLowerCase() !== 'no aplica' && reg.toLowerCase() !== 'no requiere') {
        setInvimaRegister(reg);
      } else if (partData.code === '70904' || (partData.name && partData.name.toUpperCase().includes('CIRUGIA'))) {
        setInvimaRegister('2024DM-0012529-R1');
      } else {
        setInvimaRegister(reg || '');
      }

      // Category detection
      if (partData.category && ['Diagnóstico', 'Monitoreo', 'Cirugía', 'Quirófano', 'Cuidados Críticos', 'Cuidado Crítico', 'Urgencias', 'Ginecología', 'Hospitalización', 'Neonatología', 'Esterilización', 'Laboratorio', 'Accesorios'].includes(partData.category)) {
        setCategory(partData.category as MedicalEquipment['category']);
      } else if (partData.name?.toUpperCase().includes('CIRUGIA') || partData.code === '70904') {
        setCategory('Cirugía');
      } else {
        setCategory('Diagnóstico');
      }

      setWarrantyMonths(24);
      setErrorMsg(null);
    }
  }, [partData, isOpen]);

  if (!isOpen || !partData) return null;

  const isInactive = (partData.requestType || '').toUpperCase().includes('INACTIV') || partData.status === 'Inactivada';
  const isModification = (partData.requestType || '').toUpperCase().includes('MODIFIC');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isInactive) {
      setErrorMsg('Esta parte tiene solicitud de INACTIVACIÓN en el formato N-FCO-03 y no se puede incorporar al catálogo activo.');
      return;
    }

    const cleanCode = code.trim();
    const cleanDesc = description.trim();

    if (!cleanCode) {
      setErrorMsg('Debe especificar el código de la parte.');
      return;
    }
    if (!cleanDesc) {
      setErrorMsg('Debe especificar la descripción o nombre del equipo.');
      return;
    }

    const cleanSupplier = supplier.trim() || (cleanCode === '70904' ? 'TECNICA' : 'TECNICA');
    const cleanBrand = brand.trim() || 'MINDRAY';
    const cleanModel = model.trim() || (cleanCode === '70904' ? 'HYBASE V5' : '');
    const cleanMfr = manufacturer.trim() || (cleanBrand.toUpperCase().includes('MINDRAY') ? 'NANJING MINDRAY BIO MEDICAL ELECTRONICS CO LTD' : cleanBrand);
    const cleanInvima = invimaRegister.trim() || (cleanCode === '70904' ? '2024DM-0012529-R1' : 'No Aplica');
    const parsedPrice = typeof price === 'number' ? price : googleWorkspaceService.parseSpreadsheetCost(price);

    const newEq: MedicalEquipment = {
      id: `eq-part-${cleanCode.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}`,
      code: cleanCode,
      name: cleanDesc,
      description: cleanDesc,
      supplier: cleanSupplier,
      brand: cleanBrand,
      model: cleanModel,
      baseCostCOP: parsedPrice >= 0 ? parsedPrice : 0,
      manufacturer: cleanMfr,
      taxExempt: !appliesIVA,
      invimaRecordNumber: cleanInvima,
      category: category,
      defaultMarginList: 'L3',
      warrantyMonths: warrantyMonths || 12,
      originCountry: 'Colombia',
      technicalSpecs: [
        `Código de parte: ${cleanCode}`,
        `Descripción: ${cleanDesc}`,
        `Proveedor: ${cleanSupplier}`,
        `Marca: ${cleanBrand}`,
        `Modelo: ${cleanModel}`,
        `Fabricante: ${cleanMfr}`,
        `IVA: ${appliesIVA ? 'Aplica 19%' : 'Exento (0%)'}`,
        `Registro Sanitario INVIMA: ${cleanInvima}`,
      ],
      standardAccessories: [],
      hasDocSheet: false,
      hasInvimaDoc: Boolean(cleanInvima && cleanInvima !== 'No Aplica'),
      hasManual: false,
      hasQualityCert: false,
    };

    // Auto-register supplier in Supplier Directory
    try {
      autoRegisterSuppliersFromEquipments([newEq]);
    } catch (_) {}

    onSaveEquipment(newEq);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/25 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                isInactive
                  ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  : isModification
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}
            >
              {isInactive ? (
                <Ban className="w-5 h-5" />
              ) : isModification ? (
                <Edit3 className="w-5 h-5" />
              ) : (
                <Package className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <span>
                  {isInactive
                    ? 'Parte Inactivada (Formato N-FCO-03)'
                    : isModification
                    ? 'Ajustar / Modificar Equipo desde N-FCO-03'
                    : 'Crear Equipo desde Parte Detectada'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold ${
                    isInactive
                      ? 'bg-rose-950 text-rose-300 border border-rose-800/60'
                      : isModification
                      ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                      : 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                  }`}
                >
                  {code || partData.code}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isInactive
                  ? 'Esta parte tiene estado de INACTIVACIÓN y ya no se utilizará más en la operación.'
                  : isModification
                  ? 'Revisa y actualiza los datos modificados según la solicitud N-FCO-03.'
                  : 'Valida los datos detectados de la hoja para incorporar este equipo al catálogo institucional.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {isInactive && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-500/80 text-rose-200 flex items-start gap-2.5">
              <Ban className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-rose-300 text-xs">Parte Inactivada en Formato N-FCO-03</h4>
                <p className="text-[11px] text-rose-200/90 mt-0.5 leading-relaxed">
                  En la columna <strong>Tipo de Solicitud</strong> de la hoja, esta parte figura como <strong>INACTIVACIÓN</strong>. Esto indica que fue dada de baja o retirada y <strong>ya no se utilizará más</strong>. Por control de calidad, el sistema impide su creación en el catálogo activo.
                </p>
              </div>
            </div>
          )}

          {isModification && (
            <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/60 text-amber-200 flex items-center gap-2.5">
              <Edit3 className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="text-[11px] text-amber-200/90">
                <strong>Solicitud de Modificación:</strong> Al guardar, se sincronizarán y ajustarán las especificaciones, modelo, precios o INVIMA de este equipo en el catálogo maestro.
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/60 text-rose-300 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Row 1: Parte (Código) & Descripción */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                1. Parte (Código) *
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ej: 70904 o SYD-1234"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                2. Descripción (Nombre del Equipo) *
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: MESA DE CIRUGIA ELECTRICA PST 300"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-semibold focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
          </div>

          {/* Row 2: Proveedor & Marca & Modelo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-sky-400" />
                <span>3. Proveedor</span>
              </label>
              <input
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Ej: TECNICA / SYD"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-amber-400" />
                <span>4. Marca</span>
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Ej: MINDRAY"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                5. Modelo / Referencia
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Ej: PST 300"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Row 3: Precio (Costo COP) & Fabricante */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>6. Precio / Costo Base (COP)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={price === '' ? '' : price}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPrice(val === '' ? '' : val);
                  }}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>
              <p className="text-[10px] text-emerald-400 font-mono mt-1">
                Formato: $ {Number(price || 0).toLocaleString('es-CO')} COP
              </p>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>7. Fabricante</span>
              </label>
              <input
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="Ej: SHENZHEN MINDRAY BIO-MEDICAL"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Row 4: Si Aplica o No IVA & Registro Sanitario (INVIMA) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-2">
                8. ¿Aplica o No IVA?
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAppliesIVA(true)}
                  className={`p-2.5 rounded-xl border font-bold text-xs flex flex-col items-center gap-1 transition cursor-pointer ${
                    appliesIVA
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-sm'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    {appliesIVA && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>Aplica IVA</span>
                  </span>
                  <span className="text-[10px] opacity-80 font-normal">Tarifa General (19%)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAppliesIVA(false)}
                  className={`p-2.5 rounded-xl border font-bold text-xs flex flex-col items-center gap-1 transition cursor-pointer ${
                    !appliesIVA
                      ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-sm'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="flex items-center gap-1">
                    {!appliesIVA && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                    <span>Exento de IVA</span>
                  </span>
                  <span className="text-[10px] opacity-80 font-normal">Tarifa 0% (Médico)</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
                <span>9. Registro Sanitario (INVIMA)</span>
              </label>
              <input
                type="text"
                value={invimaRegister}
                onChange={(e) => setInvimaRegister(e.target.value)}
                placeholder="Ej: INVIMA 2021EBC-0001234 o No Aplica"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
              <div className="flex gap-2 mt-1.5">
                <button
                  type="button"
                  onClick={() => setInvimaRegister('No Aplica')}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] border border-slate-700 cursor-pointer"
                >
                  No Aplica
                </button>
                <button
                  type="button"
                  onClick={() => setInvimaRegister('En Trámite')}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-[10px] border border-slate-700 cursor-pointer"
                >
                  En Trámite
                </button>
              </div>
            </div>
          </div>

          {/* Additional Catalog Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span>Categoría en Catálogo</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MedicalEquipment['category'])}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Diagnóstico">Diagnóstico</option>
                <option value="Monitoreo">Monitoreo</option>
                <option value="Cuidados Críticos">Cuidados Críticos</option>
                <option value="Cirugía">Cirugía</option>
                <option value="Quirófano">Quirófano</option>
                <option value="Urgencias">Urgencias</option>
                <option value="Hospitalización">Hospitalización</option>
                <option value="Neonatología">Neonatología</option>
                <option value="Ginecología">Ginecología</option>
                <option value="Laboratorio">Laboratorio</option>
                <option value="Esterilización">Esterilización</option>
                <option value="Accesorios">Accesorios y Repuestos</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Garantía (Meses)</span>
              </label>
              <input
                type="number"
                min="0"
                max="60"
                value={warrantyMonths}
                onChange={(e) => setWarrantyMonths(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            {isInactive ? (
              <button
                type="button"
                disabled
                className="px-5 py-2.5 bg-rose-950/60 border border-rose-800/80 text-rose-300 font-bold text-xs rounded-xl shadow cursor-not-allowed opacity-75 flex items-center gap-2 select-none"
              >
                <Ban className="w-4 h-4 text-rose-400" />
                <span>Parte Inactivada (No Creable)</span>
              </button>
            ) : isModification ? (
              <button
                type="submit"
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-950/50 transition flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Guardar Ajustes del Equipo</span>
              </button>
            ) : (
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-950/50 transition flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Guardar y Añadir a Creación de Equipos</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
