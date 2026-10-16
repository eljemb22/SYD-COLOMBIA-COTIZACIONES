import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FileSpreadsheet,
  UploadCloud,
  Download,
  Check,
  AlertTriangle,
  X,
  FileCheck,
  Building2,
  Stethoscope,
  Info,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  MapPin,
  Tag,
  ListOrdered,
  Pencil,
  Trash2,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Star,
  ArrowLeft,
  DollarSign,
} from 'lucide-react';
import { MedicalEquipment, TenderItem, TenderClientProject } from '../../types';
import {
  downloadTenderContractsTemplate,
  downloadTenderEquipmentSpecsTemplate,
  parseTenderContractsExcel,
  parseTenderEquiposSpecsExcel,
  convertParsedRowsToTenderItems,
  convertParsedMasterContractsToTenderProjects,
  ParsedTenderEquipmentRow,
  ParsedMasterContract,
} from '../../utils/excelImportUtils';
import { optimizeTechnicalSpecification } from '../../utils/specOptimizer';

interface LocalSpecItem {
  id: string;
  text: string;
  isUnique: boolean;
}

interface TenderExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportItems: (newItems: TenderItem[], mode: 'append' | 'replace', targetClientId?: string) => void;
  onImportFullContracts?: (newContracts: TenderClientProject[]) => void;
  tenderClients: TenderClientProject[];
  catalogEquipments: MedicalEquipment[];
  activeClientId?: string | null;
  initialTab?: 'contracts' | 'equipments';
}

export const TenderExcelImportModal: React.FC<TenderExcelImportModalProps> = ({
  isOpen,
  onClose,
  onImportItems,
  onImportFullContracts,
  tenderClients,
  catalogEquipments,
  activeClientId,
  initialTab = 'equipments',
}) => {
  const [activeImportTab, setActiveImportTab] = useState<'contracts' | 'equipments'>(initialTab);
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // TAB 1: Contracts State
  const [parsedContracts, setParsedContracts] = useState<ParsedMasterContract[]>([]);
  const [showContractsGuide, setShowContractsGuide] = useState<boolean>(false);
  const [editingContractIndex, setEditingContractIndex] = useState<number | null>(null);
  const [contractEditForm, setContractEditForm] = useState<ParsedMasterContract | null>(null);

  // TAB 2: Equipments & Specs State
  const [parsedRows, setParsedRows] = useState<ParsedTenderEquipmentRow[]>([]);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [includeCeilingPrice, setIncludeCeilingPrice] = useState<boolean>(true);
  const [selectedTargetClientId, setSelectedTargetClientId] = useState<string>(
    activeClientId || (tenderClients.length > 0 ? tenderClients[0].id : '')
  );
  const [showEquipmentsGuide, setShowEquipmentsGuide] = useState<boolean>(false);
  const [editingEquipmentIndex, setEditingEquipmentIndex] = useState<number | null>(null);
  const [equipmentEditForm, setEquipmentEditForm] = useState<ParsedTenderEquipmentRow | null>(null);

  // Local specifications manager inside editing equipment (Matching Image 4)
  const [localSpecsList, setLocalSpecsList] = useState<LocalSpecItem[]>([]);
  const [newSpecInput, setNewSpecInput] = useState<string>('');
  const [newSpecIsUnique, setNewSpecIsUnique] = useState<boolean>(false);
  const [editingSpecId, setEditingSpecId] = useState<string | null>(null);
  const [editingSpecText, setEditingSpecText] = useState<string>('');
  const [editingSpecIsUnique, setEditingSpecIsUnique] = useState<boolean>(false);
  const [isAiOptimizingSpecId, setIsAiOptimizingSpecId] = useState<string | null>(null);
  const [isAiOptimizingNewSpec, setIsAiOptimizingNewSpec] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync initial tab and client when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveImportTab(initialTab);
      setSelectedTargetClientId(activeClientId || (tenderClients.length > 0 ? tenderClients[0].id : ''));
      setErrorMessage(null);
      setParsedRows([]);
      setParsedContracts([]);
      setSelectedFileName('');
      setEditingContractIndex(null);
      setEditingEquipmentIndex(null);
    }
  }, [isOpen, initialTab, activeClientId, tenderClients]);

  // Handle ESC key press to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingContractIndex !== null) {
          setEditingContractIndex(null);
        } else if (editingEquipmentIndex !== null) {
          setEditingEquipmentIndex(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editingContractIndex, editingEquipmentIndex, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleFileChange = async (file?: File) => {
    if (!file) return;
    setErrorMessage(null);
    setIsProcessing(true);
    setSelectedFileName(file.name);

    try {
      if (activeImportTab === 'contracts') {
        const contracts = await parseTenderContractsExcel(file);
        if (contracts.length === 0) {
          throw new Error('No se encontraron contratos válidos en el archivo Excel.');
        }
        setParsedContracts(contracts);
      } else {
        const rows = await parseTenderEquiposSpecsExcel(file, catalogEquipments);
        if (rows.length === 0) {
          throw new Error('No se encontraron filas con datos válidos de equipos en el archivo.');
        }
        setParsedRows(rows);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err.message || 'Error al procesar el archivo Excel. Asegúrese de usar formato .xlsx, .xls o .csv'
      );
      setParsedRows([]);
      setParsedContracts([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Contracts Actions
  const handleDeleteContract = (index: number) => {
    setParsedContracts((prev) => prev.filter((_, i) => i !== index));
    if (editingContractIndex === index) {
      setEditingContractIndex(null);
      setContractEditForm(null);
    }
  };

  const handleStartEditContract = (index: number) => {
    setEditingContractIndex(index);
    setContractEditForm({ ...parsedContracts[index] });
  };

  const handleSaveContractEdit = () => {
    if (editingContractIndex === null || !contractEditForm) return;
    setParsedContracts((prev) =>
      prev.map((c, i) => (i === editingContractIndex ? contractEditForm : c))
    );
    setEditingContractIndex(null);
    setContractEditForm(null);
  };

  // Equipments Actions
  const handleDeleteEquipment = (index: number) => {
    setParsedRows((prev) => prev.filter((_, i) => i !== index));
    if (editingEquipmentIndex === index) {
      setEditingEquipmentIndex(null);
      setEquipmentEditForm(null);
      setLocalSpecsList([]);
    }
  };

  const handleStartEditEquipment = (index: number) => {
    const row = parsedRows[index];
    setEditingEquipmentIndex(index);
    setEquipmentEditForm({ ...row });

    // Parse specifications into individual items
    const rawText = row.specificationsText || '';
    const lines = rawText
      .split(/\r?\n|;|\u2022|\*|(?=\b\d+[\.\)]\s+)/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2);

    const items: LocalSpecItem[] = lines.map((line, sIdx) => {
      const isUnique =
        line.includes('⭐') ||
        line.toLowerCase().includes('exclusiv') ||
        line.toLowerCase().includes('patentad') ||
        line.toLowerCase().includes('únic');
      const cleanText = line.replace(/^[⭐\s]*(\d+[\.\)\-:\s]+|[\-\*•\u2022]\s*)/, '').trim();
      return {
        id: `spec-${Date.now()}-${sIdx}`,
        text: cleanText || line,
        isUnique,
      };
    });

    setLocalSpecsList(items);
    setNewSpecInput('');
    setNewSpecIsUnique(false);
    setEditingSpecId(null);
    setEditingSpecText('');
  };

  const handleAddLocalSpec = () => {
    const text = newSpecInput.trim();
    if (!text) return;
    const cleanText = text.replace(/^[⭐\s]*(\d+[\.\)\-:\s]+|[\-\*•\u2022]\s*)/, '').trim();
    setLocalSpecsList((prev) => [
      ...prev,
      {
        id: `spec-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        text: cleanText || text,
        isUnique: newSpecIsUnique || text.includes('⭐'),
      },
    ]);
    setNewSpecInput('');
    setNewSpecIsUnique(false);
  };

  const handleAiOptimizeNewSpec = async () => {
    const text = newSpecInput.trim();
    if (!text || isAiOptimizingNewSpec) return;
    setIsAiOptimizingNewSpec(true);
    try {
      const res = await optimizeTechnicalSpecification(
        text,
        equipmentEditForm?.name || '',
        equipmentEditForm?.brand || '',
        equipmentEditForm?.model || ''
      );
      const improved = res.optimized || res.formal || text;
      setNewSpecInput(improved);
      if (res.isUniqueCandidate) {
        setNewSpecIsUnique(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiOptimizingNewSpec(false);
    }
  };

  const handleAiOptimizeSingleSpec = async (specId: string) => {
    const spec = localSpecsList.find((s) => s.id === specId);
    if (!spec || isAiOptimizingSpecId) return;
    setIsAiOptimizingSpecId(specId);
    try {
      const res = await optimizeTechnicalSpecification(
        spec.text,
        equipmentEditForm?.name || '',
        equipmentEditForm?.brand || '',
        equipmentEditForm?.model || ''
      );
      const improved = res.optimized || res.formal || spec.text;
      setLocalSpecsList((prev) =>
        prev.map((s) =>
          s.id === specId
            ? {
                ...s,
                text: improved,
                isUnique: s.isUnique || Boolean(res.isUniqueCandidate),
              }
            : s
        )
      );
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiOptimizingSpecId(null);
    }
  };

  const handleStartEditSingleSpec = (spec: LocalSpecItem) => {
    setEditingSpecId(spec.id);
    setEditingSpecText(spec.text);
    setEditingSpecIsUnique(spec.isUnique);
  };

  const handleSaveSingleSpec = () => {
    if (!editingSpecId) return;
    const clean = editingSpecText.replace(/^[⭐\s]*(\d+[\.\)\-:\s]+|[\-\*•\u2022]\s*)/, '').trim();
    setLocalSpecsList((prev) =>
      prev.map((s) =>
        s.id === editingSpecId
          ? {
              ...s,
              text: clean || editingSpecText,
              isUnique: editingSpecIsUnique,
            }
          : s
      )
    );
    setEditingSpecId(null);
    setEditingSpecText('');
  };

  const handleAiOptimizeEditingSpec = async () => {
    if (!editingSpecText.trim() || isAiOptimizingSpecId) return;
    setIsAiOptimizingSpecId(editingSpecId);
    try {
      const res = await optimizeTechnicalSpecification(
        editingSpecText,
        equipmentEditForm?.name || '',
        equipmentEditForm?.brand || '',
        equipmentEditForm?.model || ''
      );
      const improved = res.optimized || res.formal || editingSpecText;
      setEditingSpecText(improved);
      if (res.isUniqueCandidate) {
        setEditingSpecIsUnique(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiOptimizingSpecId(null);
    }
  };

  const handleToggleSpecUnique = (specId: string) => {
    setLocalSpecsList((prev) =>
      prev.map((s) => (s.id === specId ? { ...s, isUnique: !s.isUnique } : s))
    );
  };

  const handleDeleteSingleSpec = (specId: string) => {
    setLocalSpecsList((prev) => prev.filter((s) => s.id !== specId));
    if (editingSpecId === specId) {
      setEditingSpecId(null);
    }
  };

  const handleSaveEquipmentEdit = () => {
    if (editingEquipmentIndex === null || !equipmentEditForm) return;

    // Compile local specs list into multi-line text with numbers and stars
    const compiledSpecsText = localSpecsList
      .map((s, i) => `${i + 1}. ${s.isUnique ? '⭐ ' : ''}${s.text.trim()}`)
      .join('\r\n');

    const updatedRow: ParsedTenderEquipmentRow = {
      ...equipmentEditForm,
      specificationsText: compiledSpecsText,
    };

    setParsedRows((prev) =>
      prev.map((r, i) => (i === editingEquipmentIndex ? updatedRow : r))
    );
    setEditingEquipmentIndex(null);
    setEquipmentEditForm(null);
    setLocalSpecsList([]);
  };

  // Confirm Tab 1: Contracts Import
  const handleConfirmContractsImport = () => {
    if (parsedContracts.length === 0) return;
    const convertedProjects = convertParsedMasterContractsToTenderProjects(parsedContracts);
    if (onImportFullContracts) {
      onImportFullContracts(convertedProjects);
    }
    onClose();
  };

  // Confirm Tab 2: Equipments & Specs Import
  const handleConfirmEquipmentsImport = () => {
    if (parsedRows.length === 0) return;
    if (!selectedTargetClientId) {
      setErrorMessage('Por favor seleccione un contrato de destino para importar los equipos.');
      return;
    }

    const existingClient = tenderClients.find((c) => c.id === selectedTargetClientId);
    const existingCount = existingClient?.items?.length || 0;
    const startIndex = importMode === 'append' ? existingCount : 0;
    const convertedItems = convertParsedRowsToTenderItems(parsedRows, startIndex);
    onImportItems(convertedItems, importMode, selectedTargetClientId);
    onClose();
  };

  // Metrics for contracts (Tab 1)
  const totalContractsCount = parsedContracts.length;
  const uniqueCitiesCount = new Set(parsedContracts.map((c) => c.city).filter(Boolean)).size;
  const awardedContractsCount = parsedContracts.filter((c) => c.status === 'Adjudicada').length;
  const prepContractsCount = parsedContracts.filter((c) => c.status === 'En Preparación').length;

  // Metrics for equipments (Tab 2)
  const totalUnits = parsedRows.reduce((acc, row) => acc + row.quantity, 0);
  const totalSpecsDetected = parsedRows.reduce((acc, row) => {
    if (!row.specificationsText) return acc;
    const count = row.specificationsText
      .split(/\r?\n|;|\u2022|\*/)
      .map((s) => s.trim())
      .filter((s) => s.length > 3).length;
    return acc + count;
  }, 0);

  const selectedClientObj = tenderClients.find((c) => c.id === selectedTargetClientId);

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/25 flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fadeIn"
    >
      <div className="bg-[#192b45] border border-purple-400/60 rounded-xl max-w-5xl lg:max-w-6xl w-full shadow-2xl animate-scaleUp max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Modal Header - Ultra Compact & Context-Aware */}
        <div className="px-3.5 py-2.5 border-b border-[#334d6e] flex items-center justify-between gap-3 bg-[#15253d] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`p-1.5 rounded-lg border shrink-0 ${
                activeImportTab === 'equipments'
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                  : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
              }`}
            >
              {activeImportTab === 'equipments' ? (
                <Stethoscope className="w-4 h-4" />
              ) : (
                <Building2 className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5 truncate">
                <span>
                  {activeImportTab === 'equipments'
                    ? 'Importar Equipos y Especificaciones Técnicas'
                    : 'Importar Contratos Licitatorios en Lote (Carga Inicial)'}
                </span>
                <span className="text-[9.5px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded-full font-bold border border-emerald-500/40">
                  .XLSX / .XLS
                </span>
              </h3>
              <p className="text-[10.5px] text-slate-300 truncate">
                {activeImportTab === 'equipments'
                  ? 'Cargue equipos médicos con sus requerimientos técnicos directamente al contrato'
                  : 'Cargue múltiples procesos licitatorios a la vez para poblar el sistema'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeImportTab === 'equipments' ? (
              <button
                type="button"
                onClick={() => {
                  setActiveImportTab('contracts');
                  setParsedRows([]);
                  setParsedContracts([]);
                  setSelectedFileName('');
                  setErrorMessage(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-sky-300 hover:text-white bg-[#1a2b42] hover:bg-[#243d60] border border-[#334d6e] hover:border-sky-400/50 px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer shadow-xs active:scale-95"
                title="Herramienta secundaria para cargar masivamente contratos base desde Excel"
              >
                <Building2 className="w-3.5 h-3.5 text-sky-400" />
                <span>Importar Contratos</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setActiveImportTab('equipments');
                  setParsedRows([]);
                  setParsedContracts([]);
                  setSelectedFileName('');
                  setErrorMessage(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs text-purple-200 hover:text-white bg-purple-600/30 hover:bg-purple-600 border border-purple-500/40 px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer shadow-xs active:scale-95"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver a Importar Equipos</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 text-xs font-bold text-slate-300 hover:text-white hover:bg-red-500/20 hover:border-red-500/40 border border-[#334d6e] rounded-lg transition cursor-pointer flex items-center gap-1 shrink-0"
            >
              <X className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Cerrar</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 text-xs scrollbar-thin bg-[#15253d]">
          {/* TAB 1: CONTRACTS IMPORT (Secondary Initial Utility) */}
          {activeImportTab === 'contracts' && (
            <div className="space-y-2.5 animate-fadeIn">
              {/* Ultra Compact Guidance & Download Bar */}
              <div className="bg-[#111c2e] border border-[#334d6e] rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
                    <span className="font-bold text-white text-xs">Plantilla de Contratos:</span>
                    <span className="text-[11px] text-slate-300 hidden md:inline truncate">
                      Nombre del Cliente, NIT, N° Proceso, Valor Contrato ($ COP), Ciudad, Modalidad, Objeto, Plazo y Estado.
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowContractsGuide(!showContractsGuide)}
                    className="inline-flex items-center gap-1 bg-[#1e314b] hover:bg-[#284163] text-slate-200 text-xs font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer border border-[#334d6e]"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-[#38bdf8]" />
                    <span>{showContractsGuide ? 'Ocultar Formato' : '¿Cómo debe ser el formato?'}</span>
                    {showContractsGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  <button
                    type="button"
                    onClick={downloadTenderContractsTemplate}
                    className="inline-flex items-center gap-1.5 bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950 font-black text-xs px-3 py-1.5 rounded-lg transition cursor-pointer shadow-sm active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar Plantilla (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Format Guide */}
              {showContractsGuide && (
                <div className="bg-[#0b1322] border border-[#38bdf8]/30 rounded-xl p-2.5 space-y-1.5 text-[11px] text-slate-300 animate-fadeIn">
                  <p className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-[#38bdf8]" />
                    <span>Columnas requeridas en la Plantilla de Contratos:</span>
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 text-[10.5px]">
                    <div className="bg-[#15253d] p-1.5 rounded border border-[#334d6e]">
                      <strong className="text-purple-300 block">1. Nombre del Cliente</strong>
                      <span className="text-slate-400">Entidad contratante</span>
                    </div>
                    <div className="bg-[#15253d] p-1.5 rounded border border-[#334d6e]">
                      <strong className="text-purple-300 block">2. NIT</strong>
                      <span className="text-slate-400">NIT con o sin DV</span>
                    </div>
                    <div className="bg-[#15253d] p-1.5 rounded border border-[#334d6e]">
                      <strong className="text-purple-300 block">3. Número del Proceso</strong>
                      <span className="text-slate-400">Radicado oficial</span>
                    </div>
                    <div className="bg-[#15253d] p-1.5 rounded border border-emerald-500/40 bg-emerald-950/20">
                      <strong className="text-emerald-300 block">4. Valor Contrato ($ COP)</strong>
                      <span className="text-slate-400">Presupuesto total</span>
                    </div>
                    <div className="bg-[#15253d] p-1.5 rounded border border-[#334d6e]">
                      <strong className="text-purple-300 block">5. Ciudad</strong>
                      <span className="text-slate-400">Municipio o sede</span>
                    </div>
                    <div className="bg-[#15253d] p-1.5 rounded border border-[#334d6e]">
                      <strong className="text-purple-300 block">6. Modalidad de Proceso</strong>
                      <span className="text-slate-400">Licitación, SAM, etc.</span>
                    </div>
                    <div className="bg-[#15253d] p-1.5 rounded border border-[#334d6e]">
                      <strong className="text-purple-300 block">7. Objeto del Pliego</strong>
                      <span className="text-slate-400">Descripción contractual</span>
                    </div>
                    <div className="bg-[#15253d] p-1.5 rounded border border-[#334d6e]">
                      <strong className="text-purple-300 block">8. Tiempo / Plazo</strong>
                      <span className="text-slate-400">Ej: 60 días</span>
                    </div>
                    <div className="bg-[#15253d] p-1.5 rounded border border-[#334d6e]">
                      <strong className="text-purple-300 block">9. Estado</strong>
                      <span className="text-slate-400">Adjudicada, En Prep., etc.</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Ultra Compact Dropzone */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl py-3 px-4 text-center cursor-pointer transition flex items-center justify-between gap-3 ${
                  dragActive
                    ? 'border-[#38bdf8] bg-sky-950/30'
                    : 'border-[#334d6e] hover:border-[#38bdf8]/80 bg-[#111c2e]/70 hover:bg-[#111c2e]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                  className="hidden"
                />
                <div className="flex items-center gap-2.5 min-w-0 text-left">
                  <div className="p-2 bg-sky-500/20 text-sky-300 rounded-lg border border-sky-500/30 shrink-0">
                    <UploadCloud className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-white text-xs truncate">
                      Haga clic o arrastre el archivo Excel de Contratos aquí
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      Formatos compatibles: .xlsx, .xls, .csv
                    </p>
                  </div>
                </div>
                {selectedFileName ? (
                  <div className="inline-flex items-center gap-1 text-[11px] text-emerald-300 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30 shrink-0">
                    <FileCheck className="w-3.5 h-3.5" />
                    <span className="max-w-[160px] truncate">{selectedFileName}</span>
                  </div>
                ) : (
                  <span className="text-[11px] bg-[#1e314b] text-slate-300 font-bold px-2.5 py-1 rounded-lg border border-[#334d6e] shrink-0">
                    Explorar archivo
                  </span>
                )}
              </div>

              {/* Loading Indicator */}
              {isProcessing && (
                <div className="p-3 text-center space-y-1 bg-[#111c2e] rounded-xl border border-[#334d6e]">
                  <div className="w-5 h-5 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-300 font-bold">Procesando contratos del archivo Excel...</p>
                </div>
              )}

              {/* Error Banner */}
              {errorMessage && (
                <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Parsed Contracts Preview & Actions */}
              {parsedContracts.length > 0 && (
                <div className="space-y-2 animate-fadeIn">
                  {/* Slim Stats Bar + Clear List Action */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-[#111c2e] px-3 py-1.5 rounded-xl border border-[#334d6e]">
                    <div className="flex items-center gap-2 text-[11px] flex-wrap">
                      <span className="font-bold text-white flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-[#38bdf8]" />
                        <span>{totalContractsCount} Contratos</span>
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="text-emerald-300 font-bold flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span>{uniqueCitiesCount} Sedes</span>
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="text-purple-300 font-bold flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        <span>{awardedContractsCount} Adjudicadas</span>
                      </span>
                      {prepContractsCount > 0 && (
                        <>
                          <span className="text-slate-500">•</span>
                          <span className="text-amber-300 font-bold">
                            {prepContractsCount} En Preparación
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10.5px] text-slate-400">
                        Puede editar o eliminar contratos antes de confirmar:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setParsedContracts([]);
                          setSelectedFileName('');
                        }}
                        className="text-[11px] text-rose-300 hover:text-white bg-rose-500/20 hover:bg-rose-500/30 px-2 py-0.5 rounded border border-rose-500/40 flex items-center gap-1 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Limpiar</span>
                      </button>
                    </div>
                  </div>

                  {/* Interactive Table with Edit & Delete */}
                  <div className="border border-[#334d6e] rounded-xl overflow-hidden bg-[#111c2e] max-h-56 overflow-y-auto scrollbar-thin">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-[#0e1726] text-slate-300 font-bold sticky top-0 border-b border-[#334d6e]">
                        <tr>
                          <th className="p-2 text-center w-8">#</th>
                          <th className="p-2">Cliente</th>
                          <th className="p-2">NIT</th>
                          <th className="p-2">N° Proceso</th>
                          <th className="p-2 text-right">Valor Contrato</th>
                          <th className="p-2">Ciudad</th>
                          <th className="p-2">Modalidad</th>
                          <th className="p-2">Objeto del Pliego</th>
                          <th className="p-2">Plazo</th>
                          <th className="p-2 text-center">Estado</th>
                          <th className="p-2 text-center w-16">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#334d6e]/50">
                        {parsedContracts.map((c, idx) => (
                          <tr key={idx} className="hover:bg-[#17263c] transition">
                            <td className="p-2 text-center font-mono text-purple-300 font-bold">{idx + 1}</td>
                            <td className="p-2 font-bold text-white max-w-[160px] truncate" title={c.clientName}>
                              {c.clientName}
                            </td>
                            <td className="p-2 font-mono text-[11px] text-slate-300">{c.nit}</td>
                            <td className="p-2 font-mono text-[11px] font-bold text-[#38bdf8]">{c.processNumber}</td>
                            <td className="p-2 text-right font-mono text-[11px] font-bold text-emerald-300 whitespace-nowrap">
                              {c.budgetCOP && c.budgetCOP > 0 ? `$ ${c.budgetCOP.toLocaleString('es-CO')} COP` : '$ 0 COP'}
                            </td>
                            <td className="p-2 text-slate-300">{c.city}</td>
                            <td className="p-2 text-slate-300">{c.processType}</td>
                            <td className="p-2 text-slate-300 max-w-[200px] truncate" title={c.contractObject}>
                              {c.contractObject}
                            </td>
                            <td className="p-2 text-slate-300 whitespace-nowrap">{c.executionTerm}</td>
                            <td className="p-2 text-center">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                  c.status === 'Adjudicada'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : c.status === 'En Preparación'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                    : 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                }`}
                              >
                                {c.status}
                              </span>
                            </td>
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  title="Editar contrato"
                                  onClick={() => handleStartEditContract(idx)}
                                  className="p-1 text-slate-300 hover:text-white bg-[#1e314b] hover:bg-purple-600 rounded transition cursor-pointer"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  title="Eliminar contrato de la lista"
                                  onClick={() => handleDeleteContract(idx)}
                                  className="p-1 text-rose-300 hover:text-white bg-rose-500/20 hover:bg-rose-600 rounded transition cursor-pointer"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Edit Contract Inline Modal */}
              {editingContractIndex !== null && contractEditForm && (
                <div className="bg-[#0e1726] border border-purple-400/80 rounded-xl p-3 space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between border-b border-[#334d6e] pb-1.5">
                    <span className="font-bold text-white text-xs flex items-center gap-1.5">
                      <Pencil className="w-3.5 h-3.5 text-purple-400" />
                      <span>Editar Contrato #{editingContractIndex + 1}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingContractIndex(null);
                        setContractEditForm(null);
                      }}
                      className="text-slate-400 hover:text-white text-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="space-y-0.5">
                      <label className="text-[10.5px] font-bold text-slate-300">Nombre del Cliente:</label>
                      <input
                        type="text"
                        value={contractEditForm.clientName}
                        onChange={(e) =>
                          setContractEditForm({ ...contractEditForm, clientName: e.target.value })
                        }
                        className="w-full bg-[#15253d] border border-[#334d6e] focus:border-purple-400 rounded px-2 py-1 text-xs text-white outline-none"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-[10.5px] font-bold text-slate-300">NIT:</label>
                      <input
                        type="text"
                        value={contractEditForm.nit}
                        onChange={(e) =>
                          setContractEditForm({ ...contractEditForm, nit: e.target.value })
                        }
                        className="w-full bg-[#15253d] border border-[#334d6e] focus:border-purple-400 rounded px-2 py-1 text-xs text-white outline-none"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-[10.5px] font-bold text-slate-300">Número de Proceso:</label>
                      <input
                        type="text"
                        value={contractEditForm.processNumber}
                        onChange={(e) =>
                          setContractEditForm({ ...contractEditForm, processNumber: e.target.value })
                        }
                        className="w-full bg-[#15253d] border border-[#334d6e] focus:border-purple-400 rounded px-2 py-1 text-xs text-white outline-none"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-[10.5px] font-bold text-emerald-300">Valor Total Contrato ($ COP):</label>
                      <input
                        type="number"
                        value={contractEditForm.budgetCOP || ''}
                        onChange={(e) =>
                          setContractEditForm({ ...contractEditForm, budgetCOP: Number(e.target.value) || 0 })
                        }
                        placeholder="Ej: 350000000"
                        className="w-full bg-[#15253d] border border-emerald-500/50 focus:border-emerald-400 rounded px-2 py-1 text-xs text-emerald-300 font-bold outline-none"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-[10.5px] font-bold text-slate-300">Ciudad:</label>
                      <input
                        type="text"
                        value={contractEditForm.city}
                        onChange={(e) =>
                          setContractEditForm({ ...contractEditForm, city: e.target.value })
                        }
                        className="w-full bg-[#15253d] border border-[#334d6e] focus:border-purple-400 rounded px-2 py-1 text-xs text-white outline-none"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-[10.5px] font-bold text-slate-300">Modalidad:</label>
                      <input
                        type="text"
                        value={contractEditForm.processType}
                        onChange={(e) =>
                          setContractEditForm({ ...contractEditForm, processType: e.target.value })
                        }
                        className="w-full bg-[#15253d] border border-[#334d6e] focus:border-purple-400 rounded px-2 py-1 text-xs text-white outline-none"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-[10.5px] font-bold text-slate-300">Tiempo / Plazo:</label>
                      <input
                        type="text"
                        value={contractEditForm.executionTerm}
                        onChange={(e) =>
                          setContractEditForm({ ...contractEditForm, executionTerm: e.target.value })
                        }
                        className="w-full bg-[#15253d] border border-[#334d6e] focus:border-purple-400 rounded px-2 py-1 text-xs text-white outline-none"
                      />
                    </div>

                    <div className="space-y-0.5">
                      <label className="text-[10.5px] font-bold text-slate-300">Estado:</label>
                      <select
                        value={contractEditForm.status}
                        onChange={(e) =>
                          setContractEditForm({
                            ...contractEditForm,
                            status: e.target.value as ParsedMasterContract['status'],
                          })
                        }
                        className="w-full bg-[#15253d] border border-[#334d6e] focus:border-purple-400 rounded px-2 py-1 text-xs text-white outline-none"
                      >
                        <option value="Adjudicada">Adjudicada</option>
                        <option value="En Preparación">En Preparación</option>
                        <option value="Presentada">Presentada</option>
                        <option value="Desierta">Desierta</option>
                        <option value="Cerrada">Cerrada</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2 md:col-span-4 space-y-0.5">
                      <label className="text-[10.5px] font-bold text-slate-300">Objeto del Pliego:</label>
                      <textarea
                        rows={2}
                        value={contractEditForm.contractObject}
                        onChange={(e) =>
                          setContractEditForm({ ...contractEditForm, contractObject: e.target.value })
                        }
                        className="w-full bg-[#15253d] border border-[#334d6e] focus:border-purple-400 rounded px-2 py-1 text-xs text-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-1 border-t border-[#334d6e]/60">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingContractIndex(null);
                        setContractEditForm(null);
                      }}
                      className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-[#15253d] rounded"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveContractEdit}
                      className="px-3.5 py-1 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded shadow"
                    >
                      Guardar Cambios
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: EQUIPMENTS & SPECS IMPORT */}
          {activeImportTab === 'equipments' && (
            <div className="space-y-2.5 animate-fadeIn">
              {/* Ultra Compact Header Bar with Download Template, Price Cap Switch & Format Button */}
              <div className="bg-[#111c2e] border border-[#334d6e] rounded-xl p-2.5 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Download className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <span className="font-bold text-white text-xs">Plantilla de Equipos & Especificaciones:</span>
                    <span className="text-[11px] text-slate-300 hidden md:inline truncate">
                      {includeCeilingPrice
                        ? 'Nombre del Equipo, Cantidad, Precio Tope Unitario ($ COP) y Especificaciones Técnicas.'
                        : 'Nombre del Equipo, Cantidad y Especificaciones Técnicas.'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  {/* Dynamic Switch for Ceiling Price column */}
                  <button
                    type="button"
                    onClick={() => setIncludeCeilingPrice(!includeCeilingPrice)}
                    className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer border ${
                      includeCeilingPrice
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30 shadow-xs'
                        : 'bg-[#1e314b] text-slate-400 border-[#334d6e] hover:text-slate-200'
                    }`}
                    title="Activar o desactivar columna de Precios Tope en la plantilla de Excel"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    <span>{includeCeilingPrice ? 'Precios Tope: Activo' : 'Precios Tope: Desactivado'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowEquipmentsGuide(!showEquipmentsGuide)}
                    className="inline-flex items-center gap-1 bg-[#1e314b] hover:bg-[#284163] text-slate-200 text-xs font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer border border-[#334d6e]"
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-purple-400" />
                    <span>{showEquipmentsGuide ? 'Ocultar Formato' : '¿Cómo debe ser el formato?'}</span>
                    {showEquipmentsGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadTenderEquipmentSpecsTemplate({ includeCeilingPrice })}
                    className="inline-flex items-center gap-1.5 bg-purple-500 hover:bg-purple-400 text-white font-black text-xs px-3 py-1.5 rounded-lg transition cursor-pointer shadow-sm active:scale-95"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Descargar Plantilla (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Collapsible Format Explanation Guide */}
              {showEquipmentsGuide && (
                <div className="bg-[#0b1322] border border-purple-500/30 rounded-xl p-2.5 space-y-1.5 text-[11px] text-slate-300 animate-fadeIn">
                  <p className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-purple-400" />
                    <span>Estructura de la Plantilla de Equipos y Especificaciones:</span>
                  </p>
                  <div
                    className={`grid grid-cols-1 ${
                      includeCeilingPrice ? 'sm:grid-cols-2 md:grid-cols-4' : 'sm:grid-cols-3'
                    } gap-2 pt-0.5 text-[10.5px]`}
                  >
                    <div className="bg-[#15253d] p-2 rounded border border-[#334d6e] space-y-0.5">
                      <strong className="text-purple-300 block font-bold">1. Nombre del Equipo</strong>
                      <p className="text-slate-300">
                        Nombre del equipo biomédico (ej: <span className="text-white font-semibold">Monitor de Signos Vitales</span>).
                      </p>
                    </div>
                    <div className="bg-[#15253d] p-2 rounded border border-[#334d6e] space-y-0.5">
                      <strong className="text-purple-300 block font-bold">2. Cantidad</strong>
                      <p className="text-slate-300">
                        Número de unidades a ofertar en el contrato (ej: <span className="text-white font-semibold">2, 4, 1</span>).
                      </p>
                    </div>
                    {includeCeilingPrice && (
                      <div className="bg-[#15253d] p-2 rounded border border-amber-500/40 bg-amber-950/20 space-y-0.5">
                        <strong className="text-amber-300 block font-bold">3. Precio Tope Unitario ($ COP)</strong>
                        <p className="text-slate-300">
                          Presupuesto máximo o precio techo por equipo (ej: <span className="text-amber-200 font-semibold">$ 28.000.000</span>).
                        </p>
                      </div>
                    )}
                    <div className="bg-[#15253d] p-2 rounded border border-[#334d6e] space-y-0.5">
                      <strong className="text-purple-300 block font-bold">
                        {includeCeilingPrice ? '4. Especificaciones Técnicas' : '3. Especificaciones Técnicas'}
                      </strong>
                      <p className="text-slate-300 font-mono text-[10px] bg-[#0b1322] p-1 rounded border border-[#334d6e]">
                        1. Pantalla TFT a color de 10"<br />
                        2. Formas de 12 ondas simultáneas<br />
                        3. Batería recargable con autonomía de 6 horas<br />
                        4. SpO2 de 0 a 100%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Streamlined Destination Selector Bar */}
              <div className="bg-[#111c2e] p-2.5 rounded-xl border border-[#334d6e] flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                  <label className="text-slate-300 font-bold text-xs flex items-center gap-1 shrink-0">
                    <Building2 className="w-3.5 h-3.5 text-purple-400" />
                    <span>Destino del Contrato:</span>
                  </label>
                  {tenderClients.length > 0 ? (
                    <select
                      value={selectedTargetClientId}
                      onChange={(e) => setSelectedTargetClientId(e.target.value)}
                      className="flex-1 bg-[#15253d] border border-[#334d6e] focus:border-purple-400 rounded-lg px-2.5 py-1 text-xs text-white outline-none truncate cursor-pointer font-medium"
                    >
                      {tenderClients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.clientName} ({client.header.processNumber || 'Sin N°'} - {client.items?.length || 0} eq)
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex-1 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2.5 py-1 font-medium">
                      No hay contratos creados. Primero registre un contrato con el botón "+ Nuevo Cliente / Licitación".
                    </div>
                  )}
                </div>
              </div>

              {/* Ultra Compact Dropzone for Equipments */}
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl py-3 px-4 text-center cursor-pointer transition flex items-center justify-between gap-3 ${
                  dragActive
                    ? 'border-purple-400 bg-purple-950/30'
                    : 'border-[#334d6e] hover:border-purple-400/80 bg-[#111c2e]/70 hover:bg-[#111c2e]'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                  className="hidden"
                />
                <div className="flex items-center gap-2.5 min-w-0 text-left">
                  <div className="p-2 bg-purple-500/20 text-purple-300 rounded-lg border border-purple-500/30 shrink-0">
                    <UploadCloud className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-white text-xs truncate">
                      Haga clic o arrastre el archivo Excel de Equipos y Especificaciones aquí
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      Cada especificación en una celda / fila o columna • Formatos .xlsx, .xls, .csv
                    </p>
                  </div>
                </div>
                {selectedFileName ? (
                  <div className="inline-flex items-center gap-1 text-[11px] text-emerald-300 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30 shrink-0">
                    <FileCheck className="w-3.5 h-3.5" />
                    <span className="max-w-[160px] truncate">{selectedFileName}</span>
                  </div>
                ) : (
                  <span className="text-[11px] bg-[#1e314b] text-slate-300 font-bold px-2.5 py-1 rounded-lg border border-[#334d6e] shrink-0">
                    Explorar archivo
                  </span>
                )}
              </div>

              {/* Loading Indicator */}
              {isProcessing && (
                <div className="p-3 text-center space-y-1 bg-[#111c2e] rounded-xl border border-[#334d6e]">
                  <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-300 font-bold">Procesando equipos y agrupando especificaciones técnicas...</p>
                </div>
              )}

              {/* Error Banner */}
              {errorMessage && (
                <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Parsed Rows Preview */}
              {parsedRows.length > 0 && (
                <div className="space-y-2 animate-fadeIn">
                  {/* Slim Stats Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-[#111c2e] px-3 py-1.5 rounded-xl border border-[#334d6e]">
                    <div className="flex items-center gap-2 text-[11px] flex-wrap">
                      <span className="font-bold text-white flex items-center gap-1">
                        <Stethoscope className="w-3 h-3 text-purple-300" />
                        <span>{parsedRows.length} Equipos</span>
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="text-purple-300 font-bold">
                        {totalUnits} Unidades Totales
                      </span>
                      <span className="text-slate-500">•</span>
                      <span className="text-[#38bdf8] font-bold flex items-center gap-1">
                        <ListOrdered className="w-3 h-3" />
                        <span>{totalSpecsDetected} Requisitos Técnicos</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[10.5px] text-slate-400">
                        Puede editar o eliminar ítems antes de importar:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setParsedRows([]);
                          setSelectedFileName('');
                        }}
                        className="text-[11px] text-rose-300 hover:text-white bg-rose-500/20 hover:bg-rose-500/30 px-2 py-0.5 rounded border border-rose-500/40 flex items-center gap-1 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Limpiar</span>
                      </button>
                    </div>
                  </div>

                  {/* Table Preview (Clean, vertically centered, without Ref: EQ-1 and without Marca) */}
                  <div className="border border-[#334d6e] rounded-xl overflow-hidden bg-[#111c2e] max-h-64 overflow-y-auto scrollbar-thin">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-[#0e1726] text-slate-300 font-bold sticky top-0 border-b border-[#334d6e]">
                        <tr>
                          <th className="p-2.5 text-center w-10 align-middle">#</th>
                          <th className="p-2.5 align-middle">Nombre del Equipo</th>
                          <th className="p-2.5 text-center w-16 align-middle">Cant.</th>
                          {includeCeilingPrice && (
                            <th className="p-2.5 text-right w-28 align-middle text-amber-300">Precio Tope Unit.</th>
                          )}
                          <th className="p-2.5 align-middle">Especificaciones Técnicas</th>
                          <th className="p-2.5 text-center w-20 align-middle">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#334d6e]/50">
                        {parsedRows.map((row, idx) => {
                          const specCount = row.specificationsText
                            ? row.specificationsText
                                .split(/\r?\n|;|\u2022|\*|(?=\b\d+[\.\)]\s+)/)
                                .map((s) => s.trim())
                                .filter((s) => s.length > 2).length
                            : 0;

                          return (
                            <tr key={idx} className="hover:bg-[#17263c] transition">
                              <td className="p-2.5 text-center font-mono text-purple-300 font-bold align-middle">{idx + 1}</td>
                              <td className="p-2.5 font-bold text-white max-w-[240px] align-middle">
                                <div className="leading-snug">{row.name}</div>
                              </td>
                              <td className="p-2.5 text-center font-bold text-white text-xs align-middle">{row.quantity}</td>
                              {includeCeilingPrice && (
                                <td className="p-2.5 text-right font-mono text-amber-300 font-bold text-xs align-middle whitespace-nowrap">
                                  {row.unitEstimatedBudget && row.unitEstimatedBudget > 0
                                    ? `$ ${row.unitEstimatedBudget.toLocaleString('es-CO')}`
                                    : <span className="text-slate-500 font-normal italic">Sin tope</span>}
                                </td>
                              )}
                              <td className="p-2.5 text-slate-300 max-w-[360px] align-middle">
                                {row.specificationsText ? (
                                  <div className="space-y-0.5">
                                    <span className="text-[9px] font-bold bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/30 inline-flex items-center gap-1">
                                      <ListOrdered className="w-2.5 h-2.5" />
                                      <span>{specCount} requisitos</span>
                                    </span>
                                    <p className="text-[11px] text-slate-300 truncate" title={row.specificationsText}>
                                      {row.specificationsText}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-[10.5px] text-slate-500 italic">
                                    Sin especificaciones asignadas
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5 text-center align-middle">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    title="Editar equipo y sus especificaciones (Ventana emergente)"
                                    onClick={() => handleStartEditEquipment(idx)}
                                    className="p-1.5 text-sky-300 hover:text-white bg-sky-500/20 hover:bg-sky-600 rounded-lg transition cursor-pointer"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    title="Eliminar equipo de la lista"
                                    onClick={() => handleDeleteEquipment(idx)}
                                    className="p-1.5 text-rose-300 hover:text-white bg-rose-500/20 hover:bg-rose-600 rounded-lg transition cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Edit Equipment & Specifications Modal (Ventana Emergente Dedicada) */}
                  {editingEquipmentIndex !== null && equipmentEditForm && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fadeIn">
                      <div className="bg-[#0e1726] border border-purple-500/80 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-scaleIn">
                        {/* Popup Header */}
                        <div className="px-5 py-3.5 bg-[#111c2e] border-b border-[#334d6e] flex items-center justify-between shrink-0">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/20 text-purple-300 rounded-xl border border-purple-500/30">
                              <Pencil className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-bold text-white text-sm sm:text-base">
                                Editar Equipo #{editingEquipmentIndex + 1} y Especificaciones Técnicas
                              </h3>
                              <p className="text-xs text-slate-400">
                                Gestione el nombre, cantidad, precio tope y requisitos técnicos de forma cómoda y detallada
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEquipmentIndex(null);
                              setEquipmentEditForm(null);
                              setLocalSpecsList([]);
                            }}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-[#15253d] rounded-lg transition"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>

                        {/* Popup Body */}
                        <div className="p-5 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
                          {/* Equipment Info: Name, Quantity and Ceiling Price */}
                          <div className="grid grid-cols-1 sm:grid-cols-6 gap-3 bg-[#111c2e] p-3.5 rounded-xl border border-[#334d6e]">
                            <div className="sm:col-span-3 space-y-1">
                              <label className="text-xs font-bold text-slate-300">Nombre del Equipo:</label>
                              <input
                                type="text"
                                value={equipmentEditForm.name}
                                onChange={(e) =>
                                  setEquipmentEditForm({ ...equipmentEditForm, name: e.target.value })
                                }
                                placeholder="Nombre del equipo biomédico"
                                className="w-full bg-[#15253d] border border-[#334d6e] focus:border-purple-400 rounded-lg px-3 py-2 text-sm text-white outline-none font-semibold"
                              />
                            </div>

                            <div className="sm:col-span-1 space-y-1">
                              <label className="text-xs font-bold text-slate-300 text-center block">Cantidad:</label>
                              <input
                                type="number"
                                min="1"
                                value={equipmentEditForm.quantity}
                                onChange={(e) =>
                                  setEquipmentEditForm({
                                    ...equipmentEditForm,
                                    quantity: Math.max(1, parseInt(e.target.value) || 1),
                                  })
                                }
                                className="w-full bg-[#15253d] border border-[#334d6e] focus:border-purple-400 rounded-lg px-3 py-2 text-sm text-white outline-none font-bold text-center"
                              />
                            </div>

                            <div className="sm:col-span-2 space-y-1">
                              <label className="text-xs font-bold text-amber-300 block">Precio Tope ($ COP):</label>
                              <input
                                type="number"
                                value={equipmentEditForm.unitEstimatedBudget || ''}
                                onChange={(e) =>
                                  setEquipmentEditForm({
                                    ...equipmentEditForm,
                                    unitEstimatedBudget: Number(e.target.value) || 0,
                                  })
                                }
                                placeholder="Ej: 28000000"
                                className="w-full bg-[#15253d] border border-amber-500/50 focus:border-amber-400 rounded-lg px-3 py-2 text-sm text-amber-300 outline-none font-bold"
                              />
                            </div>
                          </div>

                          {/* Specifications Manager */}
                          <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-slate-200 flex items-center gap-2">
                                <ListOrdered className="w-4 h-4 text-purple-400" />
                                <span>Especificaciones Técnicas ({localSpecsList.length} requisitos)</span>
                              </label>
                              <span className="text-[11px] text-slate-400">
                                Agregue o modifique los requerimientos técnicos del equipo
                              </span>
                            </div>

                            {/* Quick Add Bar */}
                            <div className="bg-[#111c2e] p-2.5 rounded-xl border border-[#334d6e] flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                value={newSpecInput}
                                onChange={(e) => setNewSpecInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddLocalSpec();
                                  }
                                }}
                                placeholder="Escriba un nuevo requisito (ej: Batería recargable con autonomía de 6 horas)..."
                                className="flex-1 min-w-[240px] bg-[#15253d] border border-[#334d6e] focus:border-purple-400 rounded-lg px-3 py-2 text-xs text-white outline-none font-sans"
                              />
                              <button
                                type="button"
                                onClick={handleAiOptimizeNewSpec}
                                disabled={!newSpecInput.trim() || isAiOptimizingNewSpec}
                                title="Corregir redacción con IA antes de agregar"
                                className="px-3 py-2 text-xs font-bold rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 flex items-center gap-1.5 transition disabled:opacity-40 cursor-pointer"
                              >
                                <Sparkles className={`w-3.5 h-3.5 text-purple-300 ${isAiOptimizingNewSpec ? 'animate-spin' : ''}`} />
                                <span>Corregir IA</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setNewSpecIsUnique(!newSpecIsUnique)}
                                title="Marcar como requisito exclusivo / blindaje técnico"
                                className={`px-3 py-2 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition cursor-pointer ${
                                  newSpecIsUnique
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                    : 'bg-[#15253d] text-slate-400 border-[#334d6e] hover:text-slate-200'
                                }`}
                              >
                                <Star className={`w-3.5 h-3.5 ${newSpecIsUnique ? 'fill-amber-400 text-amber-400' : ''}`} />
                                <span>Blindaje</span>
                              </button>
                              <button
                                type="button"
                                onClick={handleAddLocalSpec}
                                disabled={!newSpecInput.trim()}
                                className="px-4 py-2 text-xs font-bold rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition flex items-center gap-1.5 disabled:opacity-40 cursor-pointer shadow"
                              >
                                <Plus className="w-4 h-4" />
                                <span>Agregar</span>
                              </button>
                            </div>

                            {/* Interactive List of Specifications */}
                            <div className="space-y-2 max-h-[46vh] overflow-y-auto scrollbar-thin pr-1">
                              {localSpecsList.length === 0 ? (
                                <div className="p-6 text-center text-slate-500 text-xs italic bg-[#111c2e] rounded-xl border border-[#334d6e]/50">
                                  Este equipo no tiene especificaciones asignadas. Puede agregar requisitos usando la barra superior.
                                </div>
                              ) : (
                                localSpecsList.map((spec, sIdx) => (
                                  <div
                                    key={spec.id}
                                    className={`p-3 rounded-xl border transition ${
                                      spec.isUnique
                                        ? 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400/80'
                                        : 'bg-[#15253d] border-[#334d6e]/70 hover:border-purple-400/50'
                                    }`}
                                  >
                                    {editingSpecId === spec.id ? (
                                      // Inline Edit Mode inside popup
                                      <div className="space-y-2.5">
                                        <textarea
                                          rows={2}
                                          value={editingSpecText}
                                          onChange={(e) => setEditingSpecText(e.target.value)}
                                          className="w-full bg-[#0e1726] border border-purple-400/70 rounded-lg p-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-purple-400 font-sans"
                                          placeholder="Texto del requisito..."
                                        />
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={handleAiOptimizeEditingSpec}
                                              disabled={isAiOptimizingSpecId === spec.id}
                                              className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 flex items-center gap-1.5 transition cursor-pointer"
                                            >
                                              <Sparkles className={`w-3.5 h-3.5 text-purple-300 ${isAiOptimizingSpecId === spec.id ? 'animate-spin' : ''}`} />
                                              <span>Corregir con IA</span>
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setEditingSpecIsUnique(!editingSpecIsUnique)}
                                              className={`px-2.5 py-1.5 text-xs font-bold rounded-lg border flex items-center gap-1.5 transition cursor-pointer ${
                                                editingSpecIsUnique
                                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                                                  : 'bg-[#1c2e47] text-slate-300 border-[#334d6e]'
                                              }`}
                                            >
                                              <Star className={`w-3.5 h-3.5 ${editingSpecIsUnique ? 'fill-amber-400 text-amber-400' : 'text-slate-400'}`} />
                                              <span>{editingSpecIsUnique ? 'Blindaje Activo' : 'Marcar Blindaje'}</span>
                                            </button>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => setEditingSpecId(null)}
                                              className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#1c2e47] hover:bg-[#253d5e] text-slate-300 transition cursor-pointer"
                                            >
                                              Cancelar
                                            </button>
                                            <button
                                              type="button"
                                              onClick={handleSaveSingleSpec}
                                              className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition flex items-center gap-1.5 cursor-pointer shadow"
                                            >
                                              <Check className="w-3.5 h-3.5" />
                                              <span>Guardar Requisito</span>
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      // Normal View Mode inside popup
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-start gap-2.5 flex-1 min-w-0">
                                          <span className="text-slate-400 font-mono font-bold text-xs shrink-0 mt-0.5">
                                            {sIdx + 1}.
                                          </span>
                                          <div className="space-y-1 flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                                                <Check className="w-3 h-3" />
                                                <span>Cumple</span>
                                              </span>
                                              {spec.isUnique && (
                                                <span className="inline-flex items-center gap-1 text-[9.5px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded">
                                                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                                  <span>BLINDAJE</span>
                                                </span>
                                              )}
                                            </div>
                                            <p className="text-xs text-slate-200 leading-relaxed break-words font-sans">
                                              {spec.text}
                                            </p>
                                          </div>
                                        </div>

                                        {/* Action buttons on the right */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() => handleAiOptimizeSingleSpec(spec.id)}
                                            disabled={isAiOptimizingSpecId === spec.id}
                                            title="Corregir redacción con Inteligencia Artificial"
                                            className="px-2.5 py-1 text-xs font-bold rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 flex items-center gap-1 transition cursor-pointer"
                                          >
                                            <Sparkles className={`w-3 h-3 text-purple-300 ${isAiOptimizingSpecId === spec.id ? 'animate-spin' : ''}`} />
                                            <span className="hidden sm:inline">Corregir IA</span>
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleStartEditSingleSpec(spec)}
                                            title="Editar especificación"
                                            className="p-1.5 text-sky-300 hover:text-white bg-sky-500/20 hover:bg-sky-600 rounded-lg transition cursor-pointer"
                                          >
                                            <Pencil className="w-3.5 h-3.5" />
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleToggleSpecUnique(spec.id)}
                                            title={spec.isUnique ? 'Quitar blindaje' : 'Blindar especificación'}
                                            className={`p-1.5 rounded-lg transition cursor-pointer ${
                                              spec.isUnique
                                                ? 'bg-amber-500/30 text-amber-300 hover:bg-amber-500/50'
                                                : 'bg-[#1c2e47] text-slate-400 hover:text-amber-300 hover:bg-[#284163]'
                                            }`}
                                          >
                                            <Star className={`w-3.5 h-3.5 ${spec.isUnique ? 'fill-amber-400 text-amber-400' : ''}`} />
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => handleDeleteSingleSpec(spec.id)}
                                            title="Eliminar especificación"
                                            className="p-1.5 text-rose-300 hover:text-white bg-rose-500/20 hover:bg-rose-600 rounded-lg transition cursor-pointer"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Popup Footer */}
                        <div className="px-5 py-3.5 bg-[#111c2e] border-t border-[#334d6e] flex items-center justify-between shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingEquipmentIndex(null);
                              setEquipmentEditForm(null);
                              setLocalSpecsList([]);
                            }}
                            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-[#15253d] hover:bg-[#1e314b] rounded-lg transition cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEquipmentEdit}
                            className="px-5 py-2 text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow transition flex items-center gap-2 cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            <span>Guardar Cambios del Equipo</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer - Compact */}
        <div className="px-3.5 py-2 bg-[#111c2e] border-t border-[#334d6e] flex items-center justify-between text-xs text-slate-400 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#15253d] transition cursor-pointer"
          >
            Cancelar
          </button>

          {activeImportTab === 'contracts' ? (
            <button
              type="button"
              disabled={parsedContracts.length === 0}
              onClick={handleConfirmContractsImport}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-black text-xs transition cursor-pointer shadow-md active:scale-95 ${
                parsedContracts.length === 0
                  ? 'bg-[#15253d] text-slate-500 border border-[#334d6e] cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              }`}
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>
                Importar {parsedContracts.length} Contratos a Licitaciones
              </span>
            </button>
          ) : (
            <button
              type="button"
              disabled={parsedRows.length === 0}
              onClick={handleConfirmEquipmentsImport}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-black text-xs transition cursor-pointer shadow-md active:scale-95 ${
                parsedRows.length === 0
                  ? 'bg-[#15253d] text-slate-500 border border-[#334d6e] cursor-not-allowed'
                  : 'bg-purple-500 hover:bg-purple-400 text-white'
              }`}
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>
                Importar {parsedRows.length} Equipos ({totalUnits} Uds)
              </span>
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
