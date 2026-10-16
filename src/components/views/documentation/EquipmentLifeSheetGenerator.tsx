import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  FileText,
  Printer,
  Save,
  Plus,
  Trash2,
  Clock,
  Building2,
  ShieldCheck,
  Wrench,
  Calendar,
  Layers,
  ZoomIn,
  ZoomOut,
  Eye,
  CheckCircle2,
  Upload,
  Image as ImageIcon,
  Eraser,
  Download,
  X,
  FileCheck2,
  Search,
  Filter,
} from 'lucide-react';
import {
  MedicalEquipment,
  TechnicalDocument,
  EquipmentLifeSheetData,
  MaintenanceIntervention,
} from '../../../types';
import {
  createDefaultLifeSheetData,
  createEmptyLifeSheetData,
  getStoredLifeSheets,
  saveStoredLifeSheet,
  deleteStoredLifeSheet,
} from '../../../utils/equipmentLifeSheetStorage';
import { exportLifeSheetToWord } from '../../../utils/equipmentLifeSheetWordExport';
import { LiveEquipmentLifeSheetPreview } from './LiveEquipmentLifeSheetPreview';

interface EquipmentLifeSheetGeneratorProps {
  equipments: MedicalEquipment[];
  onSaveToDocuments?: (newDoc: TechnicalDocument) => void;
  onNavigateToRepository?: () => void;
}

export const EquipmentLifeSheetGenerator: React.FC<EquipmentLifeSheetGeneratorProps> = ({
  equipments = [],
  onSaveToDocuments,
  onNavigateToRepository,
}) => {
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  // Selected equipment id for optional quick population
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('');

  // Active Life Sheet Data State
  const [sheetData, setSheetData] = useState<EquipmentLifeSheetData>(() => {
    const stored = getStoredLifeSheets();
    if (stored.length > 0) return stored[0];
    // Start with empty clean template so user doesn't see dummy data they didn't write
    return createEmptyLifeSheetData();
  });

  // Stored life sheets list for quick switching
  const [storedList, setStoredList] = useState<EquipmentLifeSheetData[]>(() => getStoredLifeSheets());

  // Active form section
  const [activeSection, setActiveSection] = useState<'institucion' | 'id' | 'adq' | 'tec' | 'proto' | 'itv' | 'firmas'>('institucion');

  // Preview zoom scale
  const [zoomScale, setZoomScale] = useState<number>(1);

  // Success message toast
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Saved sheets drawer / modal
  const [showSavedListModal, setShowSavedListModal] = useState<boolean>(false);

  // Modal to add/edit intervention
  const [isInterventionModalOpen, setIsInterventionModalOpen] = useState<boolean>(false);
  const [editingIntervention, setEditingIntervention] = useState<MaintenanceIntervention | null>(null);

  // Search Catalog Modal State
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState<boolean>(false);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState<string>('');
  const [catalogCategoryFilter, setCatalogCategoryFilter] = useState<string>('Todos');

  // Inline Quick Search in Top Bar
  const [inlineSearchText, setInlineSearchText] = useState<string>('');
  const [isInlineDropdownOpen, setIsInlineDropdownOpen] = useState<boolean>(false);
  const inlineDropdownRef = useRef<HTMLDivElement | null>(null);

  // Close inline dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inlineDropdownRef.current && !inlineDropdownRef.current.contains(event.target as Node)) {
        setIsInlineDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute distinct categories from catalog
  const catalogCategories = useMemo(() => {
    const set = new Set<string>();
    equipments.forEach((e) => {
      if (e.category) set.add(e.category);
    });
    return ['Todos', ...Array.from(set).sort()];
  }, [equipments]);

  // Filtered equipments for the search modal
  const filteredCatalogEquipments = useMemo(() => {
    const q = catalogSearchQuery.trim().toLowerCase();
    return equipments.filter((eq) => {
      if (catalogCategoryFilter !== 'Todos' && eq.category !== catalogCategoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        (eq.name || '').toLowerCase().includes(q) ||
        (eq.brand || '').toLowerCase().includes(q) ||
        (eq.model || '').toLowerCase().includes(q) ||
        (eq.code || '').toLowerCase().includes(q) ||
        (eq.category || '').toLowerCase().includes(q) ||
        (eq.invimaRecordNumber || '').toLowerCase().includes(q) ||
        (eq.supplier || '').toLowerCase().includes(q)
      );
    });
  }, [equipments, catalogSearchQuery, catalogCategoryFilter]);

  // Quick matches for inline top bar search
  const inlineSearchResults = useMemo(() => {
    const q = inlineSearchText.trim().toLowerCase();
    if (!q) return [];
    return equipments
      .filter((eq) => {
        return (
          (eq.name || '').toLowerCase().includes(q) ||
          (eq.brand || '').toLowerCase().includes(q) ||
          (eq.model || '').toLowerCase().includes(q) ||
          (eq.code || '').toLowerCase().includes(q) ||
          (eq.category || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  }, [equipments, inlineSearchText]);

  const showNotification = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast(null);
    }, 3500);
  };

  // 1. ATTACH / UPLOAD CUSTOM LOGO
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor seleccione un archivo de imagen válido (PNG, JPG, SVG o WebP).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setSheetData((prev) => ({
          ...prev,
          logoUrl: base64,
        }));
        showNotification('¡Logo institucional cargado y adjuntado con éxito!');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setSheetData((prev) => ({
      ...prev,
      logoUrl: '',
    }));
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
    showNotification('Logo institucional removido.');
  };

  // 2. CLEAR ALL DATA / HOJA EN BLANCO
  const handleClearToBlank = () => {
    if (confirm('¿Desea limpiar todos los campos para diligenciar la Hoja de Vida en blanco desde cero?')) {
      const blank = createEmptyLifeSheetData(
        sheetData.formatCode || 'F-GHB-01',
        sheetData.formatVersion || 'Versión 01'
      );
      // Preserve uploaded logo if existing
      if (sheetData.logoUrl) {
        blank.logoUrl = sheetData.logoUrl;
      }
      if (sheetData.institutionName) {
        blank.institutionName = sheetData.institutionName;
        blank.institutionNit = sheetData.institutionNit;
        blank.departmentCity = sheetData.departmentCity;
      }
      setSheetData(blank);
      setSelectedEquipmentId('');
      showNotification('Hoja de Vida en blanco lista para diligenciar.');
    }
  };

  // 3. AUTO-POPULATE OPTIONALLY FROM CATALOG
  const handleSelectEquipment = (target: string | MedicalEquipment) => {
    let eq: MedicalEquipment | undefined;
    if (typeof target === 'string') {
      setSelectedEquipmentId(target);
      if (!target) return;
      eq = equipments.find((e) => e.id === target);
    } else {
      eq = target;
      setSelectedEquipmentId(eq.id);
    }

    if (eq) {
      setSheetData((prev) => ({
        ...prev,
        equipmentId: eq.id,
        equipmentName: eq.name,
        brand: eq.brand || prev.brand,
        model: eq.model || prev.model,
        inventoryPlate: eq.code || prev.inventoryPlate,
        invimaRecord: (eq.invimaRecordNumber && eq.invimaRecordNumber !== 'No Aplica') ? eq.invimaRecordNumber : prev.invimaRecord,
        serviceLocation: eq.category ? `Servicio de ${eq.category}` : prev.serviceLocation,
        commercialValueCOP: ((eq as any).costCOP || (eq as any).costPriceCOP || (eq as any).baseCostCOP) ? Math.round((((eq as any).costCOP || (eq as any).costPriceCOP || (eq as any).baseCostCOP) || 0) * 1.35) : prev.commercialValueCOP,
        supplier: eq.supplier || prev.supplier,
        imageUrl: eq.imageUrl || prev.imageUrl,
        usefulLifeYears: eq.category === 'Cuidado Crítico' || eq.category === 'Cuidados Críticos' ? 10 : (prev.usefulLifeYears || 7),
        riskClassification: (eq.category === 'Cuidado Crítico' || eq.category === 'Cuidados Críticos') ? 'Clase IIb' : (prev.riskClassification || 'Clase IIa'),
        biomedicalClassification: eq.category === 'Monitoreo' ? 'Monitoreo / Cuidados Intensivos' : (prev.biomedicalClassification || 'Diagnóstico'),
        technologyType: (prev.technologyType || 'Electromédico') as any,
        voltageVolts: prev.voltageVolts || '110 - 120 VAC',
        frequencyHz: prev.frequencyHz || '60 Hz',
      }));

      showNotification(`Datos del equipo "${eq.name} (${eq.brand || ''})" cargados en la Hoja de Vida.`);
      setActiveSection('id');
      setIsCatalogModalOpen(false);
      setIsInlineDropdownOpen(false);
      setInlineSearchText('');
    }
  };

  // 4. DOWNLOAD IN WORD (.doc)
  const handleDownloadWord = () => {
    exportLifeSheetToWord(sheetData);
    showNotification('Descargando Hoja de Vida oficial en formato Word (.doc)...');
  };

  // 5. PRINT / SAVE PDF
  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `Hoja_de_Vida_${sheetData.equipmentName || 'Equipo'}_${sheetData.serialNumber || 'SN'}`;
    window.print();
    document.title = originalTitle;
  };

  // 6. SAVE TO STORAGE AND TECHNICAL DOCUMENTS REPOSITORY
  const handleSaveLifeSheet = () => {
    saveStoredLifeSheet(sheetData);
    setStoredList(getStoredLifeSheets());

    if (onSaveToDocuments) {
      const newDoc: TechnicalDocument = {
        id: `doc-hv-${Date.now()}`,
        equipmentId: sheetData.equipmentId || '',
        equipmentName: sheetData.equipmentName || 'Equipo Biomédico',
        title: `Hoja de Vida Biomédica - ${sheetData.equipmentName || 'Equipo'} (S/N: ${sheetData.serialNumber || 'Sin serial'})`,
        fileName: `Hoja_de_Vida_${sheetData.serialNumber || 'Equipo'}.doc`,
        fileType: 'application/msword',
        fileSize: '420 KB',
        uploadDate: new Date().toISOString().slice(0, 10),
        docType: 'hoja_vida',
        status: 'Vigente',
        notes: `Hoja de Vida oficial según Resolución 3100 de 2019. Placa: ${sheetData.inventoryPlate || 'N/A'}, Ubicación: ${sheetData.serviceLocation || 'N/A'}.`,
      };
      onSaveToDocuments(newDoc);
    }

    showNotification('¡Hoja de Vida guardada con éxito en el sistema!');
  };

  // 7. CREATE NEW SHEET
  const handleCreateNew = () => {
    const brandNew = createEmptyLifeSheetData();
    if (sheetData.logoUrl) {
      brandNew.logoUrl = sheetData.logoUrl;
    }
    setSheetData(brandNew);
    setSelectedEquipmentId('');
    showNotification('Nueva Hoja de Vida en blanco lista para diligenciar.');
  };

  // 8. LOAD / DELETE SAVED
  const handleLoadSavedSheet = (item: EquipmentLifeSheetData) => {
    setSheetData(item);
    setShowSavedListModal(false);
    showNotification(`Hoja de Vida de "${item.equipmentName}" cargada.`);
  };

  const handleDeleteSavedSheet = (id: string) => {
    if (confirm('¿Está seguro de eliminar este registro de Hoja de Vida?')) {
      deleteStoredLifeSheet(id);
      const updated = getStoredLifeSheets();
      setStoredList(updated);
      if (sheetData.id === id) {
        setSheetData(updated[0] || createEmptyLifeSheetData());
      }
      showNotification('Registro eliminado.');
    }
  };

  // 9. INTERVENTIONS LOG
  const handleSaveIntervention = (itv: MaintenanceIntervention) => {
    setSheetData((prev) => {
      const current = prev.interventions || [];
      const idx = current.findIndex((i) => i.id === itv.id);
      let updated: MaintenanceIntervention[];
      if (idx >= 0) {
        updated = [...current];
        updated[idx] = itv;
      } else {
        updated = [itv, ...current];
      }
      return { ...prev, interventions: updated };
    });
    setIsInterventionModalOpen(false);
    setEditingIntervention(null);
    showNotification('Intervención registrada en la Hoja de Vida.');
  };

  const handleDeleteIntervention = (id: string) => {
    setSheetData((prev) => ({
      ...prev,
      interventions: (prev.interventions || []).filter((i) => i.id !== id),
    }));
    showNotification('Intervención eliminada.');
  };

  return (
    <div id="equipment-life-sheet-generator" className="space-y-4 animate-fadeIn">
      {/* Hidden file input for logo attachment */}
      <input
        ref={logoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleLogoUpload}
      />

      {/* SUCCESS TOAST */}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-fadeIn border border-emerald-400">
          <CheckCircle2 className="w-4 h-4 stroke-[3]" />
          <span>{successToast}</span>
        </div>
      )}

      {/* TOP CONTROL BAR: High density actions */}
      <div className="bg-[#15253d] border border-[#334d6e] rounded-2xl p-3 sm:p-4 shadow-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Left: Title & Quick Equipment Selector */}
        <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap sm:flex-nowrap">
          <div className="p-2 rounded-xl bg-purple-500/15 text-purple-300 border border-purple-500/30 shrink-0">
            <FileText className="w-5 h-5" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-black text-white tracking-tight">
                Hojas de Vida de Equipos Biomédicos
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                Res. 3100 MinSalud
              </span>
              {sheetData.logoUrl && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <FileCheck2 className="w-3 h-3" />
                  Logo Adjunto
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-300 truncate">
              Formato oficial editable • Exportación a Word (.doc) y PDF • Adjunte su propio logo
            </p>
          </div>

          {/* BUSCADOR DE EQUIPOS DESDE EL CATÁLOGO */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Botón Principal para Abrir Buscador Modal */}
            <button
              type="button"
              onClick={() => {
                setIsCatalogModalOpen(true);
                setCatalogSearchQuery('');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black transition cursor-pointer shadow-md shadow-emerald-700/25 border border-emerald-400/40 active:scale-95"
              title="Abrir buscador inteligente para seleccionar y cargar equipos desde el Catálogo Maestro"
            >
              <Search className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Buscar en Catálogo ({equipments.length})</span>
            </button>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* BOTÓN GUARDADAS */}
          <button
            type="button"
            onClick={() => setShowSavedListModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#192b45] hover:bg-[#203657] text-slate-200 border border-[#334d6e] text-xs font-bold transition cursor-pointer"
            title="Ver registros de hojas de vida guardadas previamente"
          >
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span>Guardadas ({storedList.length})</span>
          </button>

          {/* BOTÓN DESCARGAR EN WORD (.doc) */}
          <button
            type="button"
            onClick={handleDownloadWord}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-600 hover:from-blue-600 hover:to-indigo-500 text-white font-black text-xs transition cursor-pointer shadow-md shadow-blue-500/25 active:scale-95"
            title="Descargar documento editable en formato Microsoft Word (.doc)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Descargar en Word (.doc)</span>
          </button>

          {/* BOTÓN IMPRIMIR / PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 via-cyan-500 to-sky-400 hover:brightness-110 text-slate-950 font-black text-xs transition cursor-pointer shadow-lg shadow-sky-500/25 active:scale-95"
            title="Imprimir documento oficial o guardar en archivo PDF"
          >
            <Printer className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Imprimir / PDF</span>
          </button>

          {/* BOTÓN GUARDAR EN SISTEMA */}
          <button
            type="button"
            onClick={handleSaveLifeSheet}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs transition cursor-pointer shadow-md active:scale-95"
            title="Guardar en el sistema y en el repositorio de documentos"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar</span>
          </button>
        </div>
      </div>

      {/* MAIN TWO-COLUMN WORKSPACE: LEFT EDITOR | RIGHT PREVIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: ACCORDION / TABBED FORM EDITOR (5 COLS)                      */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 bg-[#15253d] border border-[#334d6e] rounded-2xl p-4 shadow-xl space-y-4">
          {/* Section Navigation Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-[#111c2e] p-1 rounded-xl border border-[#334d6e]">
            {[
              { id: 'institucion', label: '1. Logo & Entidad', icon: ImageIcon },
              { id: 'id', label: '2. Equipo', icon: Building2 },
              { id: 'adq', label: '3. Compra', icon: Calendar },
              { id: 'tec', label: '4. Eléctrico', icon: Wrench },
              { id: 'proto', label: '5. Protocolo', icon: ShieldCheck },
              { id: 'itv', label: '6. Historial', icon: Clock },
              { id: 'firmas', label: '7. Firmas', icon: Layers },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id as any)}
                className={`py-1.5 px-1 rounded-lg text-[10.5px] font-bold transition flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  activeSection === tab.id
                    ? 'bg-sky-500 text-slate-950 shadow-xs font-black'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* TAB 1: LOGO E INSTITUCIÓN */}
          {activeSection === 'institucion' && (
            <div className="space-y-3 animate-fadeIn text-xs">
              <div className="pb-1 border-b border-slate-700/60 font-bold text-cyan-400 uppercase tracking-wider text-[11px] flex items-center justify-between">
                <span>1. Logo Institucional y Encabezado</span>
                <span className="text-[10px] text-slate-400 font-normal">Identidad Visual</span>
              </div>

              {/* LOGO UPLOAD AREA */}
              <div className="bg-[#111c2e] border border-[#334d6e] rounded-xl p-3 space-y-2">
                <label className="text-[11px] font-bold text-slate-200 block">
                  Logo Institucional / Empresa
                </label>
                {sheetData.logoUrl ? (
                  <div className="flex items-center gap-3 bg-[#15253d] p-2 rounded-lg border border-[#334d6e]">
                    <div className="w-20 h-14 bg-white rounded-md p-1 flex items-center justify-center overflow-hidden border border-slate-300">
                      <img
                        src={sheetData.logoUrl}
                        alt="Logo Adjunto"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Logo adjuntado correctamente</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => logoInputRef.current?.click()}
                          className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold text-[10px] transition cursor-pointer"
                        >
                          Cambiar imagen
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveLogo}
                          className="px-2.5 py-1 rounded bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-700/50 font-bold text-[10px] transition cursor-pointer"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => logoInputRef.current?.click()}
                    className="border-2 border-dashed border-[#334d6e] hover:border-cyan-400 rounded-xl p-4 text-center cursor-pointer transition bg-[#15253d]/50 hover:bg-[#15253d] space-y-1"
                  >
                    <Upload className="w-6 h-6 text-cyan-400 mx-auto" />
                    <div className="text-xs font-bold text-white">
                      Haga clic para adjuntar el logo de su empresa o clínica
                    </div>
                    <p className="text-[10px] text-slate-400">
                      Soporta archivos PNG, JPG, SVG o WebP. Se incluirá en la vista previa, en Word y en PDF.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-200 block mb-1">
                  Nombre de la Institución / Empresa
                </label>
                <input
                  type="text"
                  value={sheetData.institutionName}
                  onChange={(e) => setSheetData({ ...sheetData, institutionName: e.target.value })}
                  placeholder="ej: HOSPITAL SAN VICENTE / CLÍNICA DEL NORTE"
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-2 text-white font-bold focus:border-cyan-400 outline-none placeholder-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">NIT de la Institución</label>
                  <input
                    type="text"
                    value={sheetData.institutionNit || ''}
                    onChange={(e) => setSheetData({ ...sheetData, institutionNit: e.target.value })}
                    placeholder="901.458.239-1"
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white font-mono focus:border-cyan-400 outline-none placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">Ciudad / Departamento</label>
                  <input
                    type="text"
                    value={sheetData.departmentCity || ''}
                    onChange={(e) => setSheetData({ ...sheetData, departmentCity: e.target.value })}
                    placeholder="Bogotá D.C. / Colombia"
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white focus:border-cyan-400 outline-none placeholder-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">Código de Formato</label>
                  <input
                    type="text"
                    value={sheetData.formatCode}
                    onChange={(e) => setSheetData({ ...sheetData, formatCode: e.target.value })}
                    placeholder="F-GHB-01"
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white font-mono font-bold focus:border-cyan-400 outline-none placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">Versión de Formato</label>
                  <input
                    type="text"
                    value={sheetData.formatVersion}
                    onChange={(e) => setSheetData({ ...sheetData, formatVersion: e.target.value })}
                    placeholder="Versión 04"
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white font-bold focus:border-cyan-400 outline-none placeholder-slate-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IDENTIFICACIÓN DEL EQUIPO */}
          {activeSection === 'id' && (
            <div className="space-y-3 animate-fadeIn text-xs">
              <div className="pb-1 border-b border-slate-700/60 font-bold text-sky-400 uppercase tracking-wider text-[11px] flex items-center justify-between">
                <span>2. Identificación y Clasificación</span>
                <span className="text-[10px] text-slate-400 font-normal">Datos Principales</span>
              </div>

              {/* QUICK CATALOG SEARCH BANNER */}
              <div className="bg-gradient-to-r from-[#10243e] to-[#0d3448] border border-cyan-500/40 rounded-xl p-3 flex items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shrink-0">
                    <Search className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Buscador del Catálogo Maestro</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 font-bold border border-emerald-500/40">
                        {equipments.length} equipos
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-300 truncate">
                      Haga clic para buscar y autocompletar automáticamente los datos de este equipo.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsCatalogModalOpen(true);
                    setCatalogSearchQuery('');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs transition cursor-pointer shrink-0 shadow-sm flex items-center gap-1.5 active:scale-95"
                >
                  <Search className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Buscar Equipo</span>
                </button>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-200 block mb-1">
                  Nombre del Equipo Médico *
                </label>
                <input
                  type="text"
                  value={sheetData.equipmentName}
                  onChange={(e) => setSheetData({ ...sheetData, equipmentName: e.target.value })}
                  placeholder="ej: Monitor de Signos Vitales Multiparámetro"
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-2 text-white font-bold focus:border-cyan-400 outline-none placeholder-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">Marca</label>
                  <input
                    type="text"
                    value={sheetData.brand}
                    onChange={(e) => setSheetData({ ...sheetData, brand: e.target.value })}
                    placeholder="Mindray"
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white focus:border-cyan-400 outline-none font-medium placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">Modelo</label>
                  <input
                    type="text"
                    value={sheetData.model}
                    onChange={(e) => setSheetData({ ...sheetData, model: e.target.value })}
                    placeholder="ePM 12M"
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white focus:border-cyan-400 outline-none font-medium placeholder-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">
                    Número de Serie (S/N) *
                  </label>
                  <input
                    type="text"
                    value={sheetData.serialNumber}
                    onChange={(e) => setSheetData({ ...sheetData, serialNumber: e.target.value })}
                    placeholder="SN-2026-XXXXXX"
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-sky-300 font-mono font-bold focus:border-cyan-400 outline-none placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">
                    Placa Activo Fijo / Inv.
                  </label>
                  <input
                    type="text"
                    value={sheetData.inventoryPlate}
                    onChange={(e) => setSheetData({ ...sheetData, inventoryPlate: e.target.value })}
                    placeholder="AF-1049"
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white font-mono focus:border-cyan-400 outline-none placeholder-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-200 block mb-1">
                  Servicio / Ubicación Hospitalaria
                </label>
                <input
                  type="text"
                  value={sheetData.serviceLocation}
                  onChange={(e) => setSheetData({ ...sheetData, serviceLocation: e.target.value })}
                  placeholder="ej: UCI Adultos - Cama 4 / Quirófano 2"
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white focus:border-cyan-400 outline-none placeholder-slate-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-200 block mb-1">
                  Registro Sanitario INVIMA
                </label>
                <input
                  type="text"
                  value={sheetData.invimaRecord}
                  onChange={(e) => setSheetData({ ...sheetData, invimaRecord: e.target.value })}
                  placeholder="2021EBC-0008450"
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white font-mono focus:border-cyan-400 outline-none placeholder-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">
                    Clasificación de Riesgo
                  </label>
                  <select
                    value={sheetData.riskClassification}
                    onChange={(e) => setSheetData({ ...sheetData, riskClassification: e.target.value as any })}
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-2.5 py-1.5 text-white focus:border-cyan-400 outline-none font-bold"
                  >
                    <option value="Clase I">Clase I (Bajo Riesgo)</option>
                    <option value="Clase IIa">Clase IIa (Riesgo Moderado)</option>
                    <option value="Clase IIb">Clase IIb (Riesgo Alto)</option>
                    <option value="Clase III">Clase III (Muy Alto / Soporte Vital)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">
                    Vida Útil Estimada (Años)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="25"
                    value={sheetData.usefulLifeYears || ''}
                    onChange={(e) => setSheetData({ ...sheetData, usefulLifeYears: parseInt(e.target.value) || 0 })}
                    placeholder="7"
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white focus:border-cyan-400 outline-none placeholder-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-200 block mb-1">
                  Clasificación Biomédica
                </label>
                <select
                  value={sheetData.biomedicalClassification}
                  onChange={(e) => setSheetData({ ...sheetData, biomedicalClassification: e.target.value as any })}
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-2.5 py-1.5 text-white focus:border-cyan-400 outline-none font-medium"
                >
                  <option value="Diagnóstico">Diagnóstico</option>
                  <option value="Tratamiento y Soporte de Vida">Tratamiento y Soporte de Vida</option>
                  <option value="Monitoreo / Cuidados Intensivos">Monitoreo / Cuidados Intensivos</option>
                  <option value="Rehabilitación">Rehabilitación</option>
                  <option value="Laboratorio Clínico">Laboratorio Clínico</option>
                </select>
              </div>
            </div>
          )}

          {/* TAB 3: ADQUISICIÓN Y GARANTÍA */}
          {activeSection === 'adq' && (
            <div className="space-y-3 animate-fadeIn text-xs">
              <div className="pb-1 border-b border-slate-700/60 font-bold text-cyan-400 uppercase tracking-wider text-[11px] flex items-center justify-between">
                <span>3. Adquisición &amp; Garantía</span>
                <span className="text-[10px] text-slate-400 font-normal">Trazabilidad Comercial</span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-200 block mb-1">
                  Proveedor / Fabricante
                </label>
                <input
                  type="text"
                  value={sheetData.supplier}
                  onChange={(e) => setSheetData({ ...sheetData, supplier: e.target.value })}
                  placeholder="ej: Suministros y Dotaciones de Colombia S.A.S."
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white focus:border-cyan-400 outline-none placeholder-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">
                    Fecha Adquisición
                  </label>
                  <input
                    type="date"
                    value={sheetData.acquisitionDate}
                    onChange={(e) => setSheetData({ ...sheetData, acquisitionDate: e.target.value })}
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white focus:border-cyan-400 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">
                    Fecha Puesta en Marcha
                  </label>
                  <input
                    type="date"
                    value={sheetData.installationDate}
                    onChange={(e) => setSheetData({ ...sheetData, installationDate: e.target.value })}
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white focus:border-cyan-400 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">
                    Estado de Garantía
                  </label>
                  <select
                    value={sheetData.warrantyStatus}
                    onChange={(e) => setSheetData({ ...sheetData, warrantyStatus: e.target.value as any })}
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-2.5 py-1.5 text-white focus:border-cyan-400 outline-none font-bold"
                  >
                    <option value="Vigente">Vigente</option>
                    <option value="Vencida">Vencida</option>
                    <option value="Extendida">Extendida</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">
                    Vencimiento Garantía
                  </label>
                  <input
                    type="date"
                    value={sheetData.warrantyExpiration}
                    onChange={(e) => setSheetData({ ...sheetData, warrantyExpiration: e.target.value })}
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white focus:border-cyan-400 outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">
                    Factura / Orden de Compra
                  </label>
                  <input
                    type="text"
                    value={sheetData.purchaseInvoiceOrOC || ''}
                    onChange={(e) => setSheetData({ ...sheetData, purchaseInvoiceOrOC: e.target.value })}
                    placeholder="OC-2026-102"
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white font-mono focus:border-cyan-400 outline-none placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">
                    Valor Comercial COP
                  </label>
                  <input
                    type="number"
                    value={sheetData.commercialValueCOP || ''}
                    onChange={(e) => setSheetData({ ...sheetData, commercialValueCOP: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-emerald-400 font-mono font-bold focus:border-cyan-400 outline-none placeholder-slate-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ESPECIFICACIONES TÉCNICAS Y ELÉCTRICAS */}
          {activeSection === 'tec' && (
            <div className="space-y-3 animate-fadeIn text-xs">
              <div className="pb-1 border-b border-slate-700/60 font-bold text-amber-400 uppercase tracking-wider text-[11px] flex items-center justify-between">
                <span>4. Parámetros Técnicos &amp; Eléctricos</span>
                <span className="text-[10px] text-slate-400 font-normal">Requerimientos de Instalación</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">Voltaje (V)</label>
                  <input
                    type="text"
                    value={sheetData.voltageVolts}
                    onChange={(e) => setSheetData({ ...sheetData, voltageVolts: e.target.value })}
                    placeholder="100 - 240 VAC"
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white font-mono focus:border-cyan-400 outline-none placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">Corriente (A)</label>
                  <input
                    type="text"
                    value={sheetData.currentAmperes}
                    onChange={(e) => setSheetData({ ...sheetData, currentAmperes: e.target.value })}
                    placeholder="1.6 A"
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white font-mono focus:border-cyan-400 outline-none placeholder-slate-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">Frecuencia (Hz)</label>
                  <input
                    type="text"
                    value={sheetData.frequencyHz}
                    onChange={(e) => setSheetData({ ...sheetData, frequencyHz: e.target.value })}
                    placeholder="50 / 60 Hz"
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white font-mono focus:border-cyan-400 outline-none placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">Potencia (W)</label>
                  <input
                    type="text"
                    value={sheetData.powerWatts}
                    onChange={(e) => setSheetData({ ...sheetData, powerWatts: e.target.value })}
                    placeholder="140 W"
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white font-mono focus:border-cyan-400 outline-none placeholder-slate-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-200 block mb-1">
                  Batería / Fuente de Respaldo
                </label>
                <input
                  type="text"
                  value={sheetData.batteryType || ''}
                  onChange={(e) => setSheetData({ ...sheetData, batteryType: e.target.value })}
                  placeholder="Ion de Litio Recargable 11.1V / 4500mAh"
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white focus:border-cyan-400 outline-none placeholder-slate-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-200 block mb-1">
                  Dimensiones y Peso
                </label>
                <input
                  type="text"
                  value={sheetData.weightDimensions || ''}
                  onChange={(e) => setSheetData({ ...sheetData, weightDimensions: e.target.value })}
                  placeholder="320 x 280 x 160 mm / 4.2 kg"
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white focus:border-cyan-400 outline-none placeholder-slate-400"
                />
              </div>
            </div>
          )}

          {/* TAB 5: PROTOCOLO DE MANTENIMIENTO Y METROLOGÍA */}
          {activeSection === 'proto' && (
            <div className="space-y-3 animate-fadeIn text-xs">
              <div className="pb-1 border-b border-slate-700/60 font-bold text-emerald-400 uppercase tracking-wider text-[11px] flex items-center justify-between">
                <span>5. Protocolo de Mantenimiento &amp; Calibración</span>
                <span className="text-[10px] text-slate-400 font-normal">Aseguramiento Metrológico</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">
                    Frecuencia Preventivo *
                  </label>
                  <select
                    value={sheetData.maintenanceFrequency}
                    onChange={(e) => setSheetData({ ...sheetData, maintenanceFrequency: e.target.value as any })}
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-2.5 py-1.5 text-white focus:border-cyan-400 outline-none font-bold"
                  >
                    <option value="Trimestral">Trimestral (Cada 3 meses)</option>
                    <option value="Cuatrimestral">Cuatrimestral (Cada 4 meses)</option>
                    <option value="Semestral">Semestral (Cada 6 meses)</option>
                    <option value="Anual">Anual (Cada 12 meses)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">
                    ¿Requiere Calibración?
                  </label>
                  <select
                    value={sheetData.requiresCalibration ? 'si' : 'no'}
                    onChange={(e) => setSheetData({ ...sheetData, requiresCalibration: e.target.value === 'si' })}
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-2.5 py-1.5 text-white focus:border-cyan-400 outline-none font-bold"
                  >
                    <option value="si">SÍ Requiere Calibración</option>
                    <option value="no">NO Aplica Calibración</option>
                  </select>
                </div>
              </div>

              {sheetData.requiresCalibration && (
                <div>
                  <label className="text-[11px] font-bold text-slate-200 block mb-1">
                    Variable / Parámetro a Calibrar
                  </label>
                  <input
                    type="text"
                    value={sheetData.calibrationVariable || ''}
                    onChange={(e) => setSheetData({ ...sheetData, calibrationVariable: e.target.value })}
                    placeholder="ej: Presión No Invasiva (NIBP), Saturación SpO2, Seguridad Eléctrica"
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white focus:border-cyan-400 outline-none placeholder-slate-400"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] font-bold text-slate-200 block mb-1">
                  Manuales Disponibles
                </label>
                <div className="space-y-1.5 bg-[#111c2e] p-2.5 rounded-xl border border-[#334d6e]">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                    <input
                      type="checkbox"
                      checked={sheetData.manualsAvailable?.userManual ?? false}
                      onChange={(e) =>
                        setSheetData({
                          ...sheetData,
                          manualsAvailable: {
                            ...sheetData.manualsAvailable,
                            userManual: e.target.checked,
                          },
                        })
                      }
                      className="rounded accent-cyan-500"
                    />
                    <span>Manual de Usuario en Español</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                    <input
                      type="checkbox"
                      checked={sheetData.manualsAvailable?.serviceManual ?? false}
                      onChange={(e) =>
                        setSheetData({
                          ...sheetData,
                          manualsAvailable: {
                            ...sheetData.manualsAvailable,
                            serviceManual: e.target.checked,
                          },
                        })
                      }
                      className="rounded accent-cyan-500"
                    />
                    <span>Manual de Servicio Técnico / Mantenimiento</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-200">
                    <input
                      type="checkbox"
                      checked={sheetData.manualsAvailable?.technicalSheet ?? false}
                      onChange={(e) =>
                        setSheetData({
                          ...sheetData,
                          manualsAvailable: {
                            ...sheetData.manualsAvailable,
                            technicalSheet: e.target.checked,
                          },
                        })
                      }
                      className="rounded accent-cyan-500"
                    />
                    <span>Ficha Técnica Oficial del Fabricante</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-200 block mb-1">
                  Accesorios &amp; Consumibles Incluidos
                </label>
                <textarea
                  rows={3}
                  value={sheetData.accessoriesIncluded}
                  onChange={(e) => setSheetData({ ...sheetData, accessoriesIncluded: e.target.value })}
                  placeholder="Detalle de sensores, cables, mangueras y adaptadores incluidos..."
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl p-2.5 text-white focus:border-cyan-400 outline-none leading-relaxed placeholder-slate-400"
                />
              </div>
            </div>
          )}

          {/* TAB 6: HISTORIAL DE INTERVENCIONES */}
          {activeSection === 'itv' && (
            <div className="space-y-3 animate-fadeIn text-xs">
              <div className="pb-1 border-b border-slate-700/60 font-bold text-rose-400 uppercase tracking-wider text-[11px] flex items-center justify-between">
                <span>6. Historial de Mantenimientos</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingIntervention({
                      id: `itv-${Date.now()}`,
                      date: new Date().toISOString().slice(0, 10),
                      type: 'Preventivo',
                      description: '',
                      partsReplaced: 'N/A',
                      engineerName: sheetData.biomedicalEngineerName || '',
                      professionalLicense: sheetData.biomedicalEngineerLicense || '',
                      status: 'Operativo',
                      reportNumber: '',
                    });
                    setIsInterventionModalOpen(true);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10.5px] flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                >
                  <Plus className="w-3 h-3" />
                  <span>+ Agregar Intervención</span>
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                {(sheetData.interventions || []).length > 0 ? (
                  sheetData.interventions.map((itv, idx) => (
                    <div
                      key={itv.id || idx}
                      className="p-2.5 rounded-xl bg-[#111c2e] border border-[#334d6e] flex items-start justify-between gap-2 hover:border-cyan-500/50 transition"
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sky-400 text-[10.5px]">{itv.date}</span>
                          <span className="font-bold text-white text-[11px]">[{itv.type}]</span>
                          <span className={`px-1.5 py-0.2 rounded-xs font-bold text-[9px] ${
                            itv.status === 'Operativo'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                              : 'bg-rose-950 text-rose-300 border border-rose-500/40'
                          }`}>
                            {itv.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-200 leading-snug">{itv.description}</p>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Técnico: {itv.engineerName || 'No especificado'} • Rep: {itv.reportNumber || 'N/A'}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingIntervention(itv);
                            setIsInterventionModalOpen(true);
                          }}
                          className="p-1 rounded text-cyan-400 hover:bg-cyan-950 transition cursor-pointer"
                          title="Editar intervención"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteIntervention(itv.id)}
                          className="p-1 rounded text-rose-400 hover:bg-rose-950 transition cursor-pointer"
                          title="Eliminar intervención"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-slate-400 italic bg-[#111c2e]/60 rounded-xl border border-dashed border-[#334d6e]">
                    No hay intervenciones registradas. Puede agregar intervenciones cuando realice mantenimientos o inspecciones.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: FIRMAS Y RESPONSABLES */}
          {activeSection === 'firmas' && (
            <div className="space-y-3 animate-fadeIn text-xs">
              <div className="pb-1 border-b border-slate-700/60 font-bold text-purple-400 uppercase tracking-wider text-[11px] flex items-center justify-between">
                <span>7. Firmas y Responsables Oficiales</span>
                <span className="text-[10px] text-slate-400 font-normal">Habilitación en Salud</span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-200 block mb-1">
                  Nombre del Ingeniero Biomédico
                </label>
                <input
                  type="text"
                  value={sheetData.biomedicalEngineerName}
                  onChange={(e) => setSheetData({ ...sheetData, biomedicalEngineerName: e.target.value })}
                  placeholder="ej: Ing. Alejandro Morales"
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white font-bold focus:border-cyan-400 outline-none placeholder-slate-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-200 block mb-1">
                  Cargo / Especialidad
                </label>
                <input
                  type="text"
                  value={sheetData.biomedicalEngineerTitle}
                  onChange={(e) => setSheetData({ ...sheetData, biomedicalEngineerTitle: e.target.value })}
                  placeholder="Ingeniero Biomédico Especialista en Mantenimiento"
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white focus:border-cyan-400 outline-none placeholder-slate-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-200 block mb-1">
                  Matrícula Profesional / Tarjeta COPNIA
                </label>
                <input
                  type="text"
                  value={sheetData.biomedicalEngineerLicense}
                  onChange={(e) => setSheetData({ ...sheetData, biomedicalEngineerLicense: e.target.value })}
                  placeholder="CNB-84920 / MinSalud"
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white font-mono focus:border-cyan-400 outline-none placeholder-slate-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-200 block mb-1">
                  Director / Coordinador de Calidad o Mantenimiento
                </label>
                <input
                  type="text"
                  value={sheetData.maintenanceManagerName}
                  onChange={(e) => setSheetData({ ...sheetData, maintenanceManagerName: e.target.value })}
                  placeholder="ej: Dra. Carolina Vargas"
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white font-bold focus:border-cyan-400 outline-none placeholder-slate-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-200 block mb-1">
                  Cargo del Director
                </label>
                <input
                  type="text"
                  value={sheetData.maintenanceManagerTitle}
                  onChange={(e) => setSheetData({ ...sheetData, maintenanceManagerTitle: e.target.value })}
                  placeholder="Directora de Calidad y Gestión Tecnológica"
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white focus:border-cyan-400 outline-none placeholder-slate-400"
                />
              </div>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: REAL-TIME OFFICIAL PREVIEW SHEET (7 COLS)                   */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 bg-[#111c2e] border border-[#334d6e] rounded-2xl p-4 shadow-xl flex flex-col items-center">
          {/* Zoom and Preview Toolbar */}
          <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-[#334d6e] flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span>Vista Previa en Vivo (Formato Oficial MinSalud)</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomScale((prev) => Math.max(0.5, prev - 0.1))}
                className="p-1.5 rounded-lg bg-[#192b45] hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                title="Reducir zoom"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono font-bold text-slate-300">
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomScale((prev) => Math.min(1.4, prev + 0.1))}
                className="p-1.5 rounded-lg bg-[#192b45] hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                title="Aumentar zoom"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomScale(1)}
                className="px-2 py-1 rounded-lg bg-[#192b45] hover:bg-slate-700 text-[10px] text-slate-300 font-bold transition cursor-pointer"
              >
                100%
              </button>
            </div>
          </div>

          {/* Scrollable Document Container */}
          <div className="w-full overflow-x-auto flex justify-center py-2 custom-scrollbar">
            <LiveEquipmentLifeSheetPreview data={sheetData} zoomScale={zoomScale} />
          </div>
        </div>
      </div>

      {/* MODAL: ADD / EDIT INTERVENTION */}
      {isInterventionModalOpen && editingIntervention && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#15253d] border border-cyan-500/50 rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-2.5">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-cyan-400" />
                <span>Registrar Intervención / Mantenimiento</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsInterventionModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Fecha</label>
                  <input
                    type="date"
                    value={editingIntervention.date}
                    onChange={(e) => setEditingIntervention({ ...editingIntervention, date: e.target.value })}
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Tipo de Mantenimiento</label>
                  <select
                    value={editingIntervention.type}
                    onChange={(e) => setEditingIntervention({ ...editingIntervention, type: e.target.value as any })}
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-2.5 py-1.5 text-white font-bold"
                  >
                    <option value="Preventivo">Preventivo</option>
                    <option value="Correctivo">Correctivo</option>
                    <option value="Calibración">Calibración / Metrología</option>
                    <option value="Inspección / Calificación">Inspección / Calificación</option>
                    <option value="Instalación">Instalación Inicial</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">
                  Descripción del Trabajo Realizado *
                </label>
                <textarea
                  rows={3}
                  value={editingIntervention.description}
                  onChange={(e) => setEditingIntervention({ ...editingIntervention, description: e.target.value })}
                  placeholder="Detalle de actividades, limpieza, pruebas de seguridad eléctrica, etc."
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl p-2.5 text-white leading-relaxed placeholder-slate-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Repuestos Sustituidos</label>
                  <input
                    type="text"
                    value={editingIntervention.partsReplaced || ''}
                    onChange={(e) => setEditingIntervention({ ...editingIntervention, partsReplaced: e.target.value })}
                    placeholder="ej: N/A o Batería de litio"
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Estado del Equipo</label>
                  <select
                    value={editingIntervention.status}
                    onChange={(e) => setEditingIntervention({ ...editingIntervention, status: e.target.value as any })}
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-2.5 py-1.5 text-white font-bold"
                  >
                    <option value="Operativo">Operativo (100%)</option>
                    <option value="En Observación">En Observación</option>
                    <option value="Fuera de Servicio">Fuera de Servicio</option>
                    <option value="Requiere Repuesto">Requiere Repuesto</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Reporte Técnico N°</label>
                  <input
                    type="text"
                    value={editingIntervention.reportNumber || ''}
                    onChange={(e) => setEditingIntervention({ ...editingIntervention, reportNumber: e.target.value })}
                    placeholder="REP-0491"
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white font-mono placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Ingeniero / Técnico</label>
                  <input
                    type="text"
                    value={editingIntervention.engineerName}
                    onChange={(e) => setEditingIntervention({ ...editingIntervention, engineerName: e.target.value })}
                    className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-1.5 text-white font-bold placeholder-slate-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700/60">
              <button
                type="button"
                onClick={() => setIsInterventionModalOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSaveIntervention(editingIntervention)}
                className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-black text-xs cursor-pointer shadow-md"
              >
                Guardar Intervención
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SAVED LIFE SHEETS DRAWER */}
      {showSavedListModal && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#15253d] border border-cyan-500/50 rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 animate-scaleUp max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-black text-white">
                  Hojas de Vida Registradas en el Sistema ({storedList.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSavedListModal(false)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {storedList.length > 0 ? (
                storedList.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-[#111c2e] border border-[#334d6e] flex items-center justify-between gap-3 hover:border-cyan-400/60 transition"
                  >
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs truncate">
                          {item.equipmentName || 'Hoja de Vida Sin Nombre'}
                        </span>
                        <span className="px-1.5 py-0.2 rounded-xs font-mono font-bold text-[10px] bg-sky-950 text-sky-300 border border-sky-500/40">
                          S/N: {item.serialNumber || 'N/A'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 font-medium">
                        {item.brand || 'Sin marca'} • {item.model || 'Sin modelo'} • Placa: {item.inventoryPlate || 'N/A'} • {item.serviceLocation || 'Sin ubicación'}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        Última actualización: {new Date(item.updatedAt || item.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleLoadSavedSheet(item)}
                        className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs transition cursor-pointer"
                      >
                        Abrir
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSavedSheet(item.id)}
                        className="p-1 rounded-lg text-rose-400 hover:bg-rose-950/60 transition cursor-pointer"
                        title="Eliminar registro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-400 italic">
                  No hay hojas de vida guardadas aún. Diligencie el formulario y haga clic en "Guardar".
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: BUSCADOR DE EQUIPOS DEL CATÁLOGO MAESTRO (362+ EQUIPOS)            */}
      {/* ========================================================================= */}
      {isCatalogModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn">
          <div className="bg-[#122138] border border-cyan-500/50 rounded-2xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl space-y-4 animate-scaleUp max-h-[88vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-700/60 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>Buscador del Catálogo Maestro de Equipos</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/40 font-mono">
                      {equipments.length} equipos
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Seleccione un equipo para transferir automáticamente nombre, marca, modelo, código, registro INVIMA y especificaciones a la Hoja de Vida.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCatalogModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Cerrar buscador"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="space-y-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-cyan-400 absolute left-3.5 top-3 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Buscar por nombre (ej: Monitor, Desfibrilador, Mesa), marca (Mindray), modelo, código o registro INVIMA..."
                  value={catalogSearchQuery}
                  onChange={(e) => setCatalogSearchQuery(e.target.value)}
                  className="w-full bg-[#0d1726] border-2 border-cyan-500/40 focus:border-cyan-400 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 font-medium outline-none shadow-inner"
                />
                {catalogSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setCatalogSearchQuery('')}
                    className="absolute right-3 top-3 text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs custom-scrollbar">
                <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1 shrink-0">
                  <Filter className="w-3 h-3" />
                  Filtrar:
                </span>
                {catalogCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatalogCategoryFilter(cat)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition shrink-0 cursor-pointer ${
                      catalogCategoryFilter === cat
                        ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                        : 'bg-[#15253d] text-slate-300 hover:text-white border border-[#334d6e]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>
                  Mostrando <strong className="text-white">{filteredCatalogEquipments.length}</strong> de {equipments.length} equipos
                </span>
                {catalogSearchQuery && (
                  <span>
                    Filtro activo: "<strong className="text-cyan-300">{catalogSearchQuery}</strong>"
                  </span>
                )}
              </div>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar min-h-[250px]">
              {filteredCatalogEquipments.length > 0 ? (
                filteredCatalogEquipments.map((eq) => (
                  <div
                    key={eq.id}
                    className="p-3 rounded-xl bg-[#0e1929] border border-[#233a59] hover:border-cyan-400/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition shadow-xs group"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-white text-xs sm:text-sm group-hover:text-cyan-300 transition">
                          {eq.name}
                        </span>
                        {eq.code && (
                          <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                            Cód: {eq.code}
                          </span>
                        )}
                        {eq.category && (
                          <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-indigo-950/80 text-indigo-300 border border-indigo-500/30">
                            {eq.category}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-300 flex-wrap">
                        <span className="font-bold text-sky-400">
                          {eq.brand || 'Marca no especificada'}
                        </span>
                        <span>•</span>
                        <span className="font-medium text-slate-200">
                          Mod: {eq.model || 'N/A'}
                        </span>
                        {eq.invimaRecordNumber && (
                          <>
                            <span>•</span>
                            <span className="text-[11px] font-mono text-emerald-400">
                              INVIMA: {eq.invimaRecordNumber}
                            </span>
                          </>
                        )}
                        {eq.supplier && (
                          <>
                            <span>•</span>
                            <span className="text-[11px] text-slate-400">
                              Prov: {eq.supplier}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectEquipment(eq)}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs transition cursor-pointer shrink-0 shadow-md shadow-emerald-700/20 active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Cargar en Hoja de Vida</span>
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
                    <Search className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-bold text-slate-200">
                    No se encontraron equipos en el catálogo para "{catalogSearchQuery}"
                  </div>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Intente buscar con otro nombre, marca (ej: Mindray, Sonoscape), modelo o limpie el filtro de categoría.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setCatalogSearchQuery('');
                      setCatalogCategoryFilter('Todos');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#192b45] hover:bg-[#203657] text-cyan-300 text-xs font-bold transition cursor-pointer"
                  >
                    Limpiar filtros
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
