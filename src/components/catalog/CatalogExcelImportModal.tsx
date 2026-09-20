import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  FileSpreadsheet,
  UploadCloud,
  Download,
  Check,
  AlertTriangle,
  X,
  RefreshCw,
  Search,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  FileCheck,
  HelpCircle,
  Edit3,
  Trash2,
  Plus,
  Package,
  Save,
  RotateCcw,
  PlusCircle,
  Building2,
  Layers,
  Scissors,
  Activity,
  BedDouble,
  Stethoscope,
  CheckCircle2,
  XCircle,
  Tag,
  Filter,
} from 'lucide-react';
import { MedicalEquipment, ProductGroup } from '../../types';
import {
  downloadCatalogEquipmentTemplate,
  parseCatalogEquipmentsExcel,
  convertParsedRowsToCatalogEquipments,
  ParsedCatalogEquipmentRow,
  UnifiedEquipmentDetail,
  DetectedSupplierInFile,
  ParsedCatalogEquipmentsResult,
  getAutomaticStandardAccessories,
} from '../../utils/excelImportUtils';
import {
  autoRegisterSuppliersFromEquipments,
  isSupplierRegisteredInDirectory,
  matchSupplierInDirectory,
  getStoredSupplierProfiles,
} from '../../utils/ocTrackingStorage';
import {
  ProductGroupsAuditResult,
  auditProductGroups,
  getProductGroupBadgeStyle,
  CORE_PRODUCT_GROUPS,
} from '../../utils/productGroupUtils';
import { formatCOP } from '../../utils/formatters';

interface CatalogExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingEquipments: MedicalEquipment[];
  onImportEquipments: (
    updatedCatalog: MedicalEquipment[],
    importedCount: number,
    mode: 'append_update' | 'replace'
  ) => void;
}

export const CatalogExcelImportModal: React.FC<CatalogExcelImportModalProps> = ({
  isOpen,
  onClose,
  existingEquipments,
  onImportEquipments,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [showSummaryKpis, setShowSummaryKpis] = useState(false);

  // Parsed state
  const [parsedRows, setParsedRows] = useState<ParsedCatalogEquipmentRow[]>([]);
  const [unifiedDuplicates, setUnifiedDuplicates] = useState<UnifiedEquipmentDetail[]>([]);
  const [allDetectedSuppliers, setAllDetectedSuppliers] = useState<DetectedSupplierInFile[]>([]);
  const [productGroupsAudit, setProductGroupsAudit] = useState<ProductGroupsAuditResult | null>(null);
  const [selectedProductGroupFilter, setSelectedProductGroupFilter] = useState<ProductGroup | 'ALL'>('ALL');
  const [showUnifiedDetails, setShowUnifiedDetails] = useState<boolean>(false);
  const [previewSearch, setPreviewSearch] = useState('');
  const [filterIssueOnly, setFilterIssueOnly] = useState(false);

  // Modal sub-states: Edit Row & Accessories Manager
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editingRowData, setEditingRowData] = useState<ParsedCatalogEquipmentRow | null>(null);

  const [accessoriesRowIndex, setAccessoriesRowIndex] = useState<number | null>(null);
  const [accessoriesList, setAccessoriesList] = useState<{ name: string; costCOP: number; included: boolean }[]>([]);
  const [newAccessoryInput, setNewAccessoryInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setParsedRows([]);
      setUnifiedDuplicates([]);
      setAllDetectedSuppliers([]);
      setProductGroupsAudit(null);
      setSelectedProductGroupFilter('ALL');
      setShowUnifiedDetails(false);
      setSelectedFileName('');
      setPreviewSearch('');
      setFilterIssueOnly(false);
      setEditingRowIndex(null);
      setEditingRowData(null);
      setShowSummaryKpis(false);
      setAccessoriesRowIndex(null);
      setAccessoriesList([]);
      setNewAccessoryInput('');
    }
  }, [isOpen]);

  // Handle ESC key press to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (accessoriesRowIndex !== null) {
          setAccessoriesRowIndex(null);
        } else if (editingRowIndex !== null) {
          setEditingRowIndex(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, accessoriesRowIndex, editingRowIndex]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleFileChange = async (file?: File) => {
    if (!file) return;
    setErrorMessage(null);
    setIsProcessing(true);
    setSelectedFileName(file.name);
    setShowUnifiedDetails(false);

    try {
      const result: ParsedCatalogEquipmentsResult = await parseCatalogEquipmentsExcel(file, existingEquipments);
      if (!result.rows || result.rows.length === 0) {
        throw new Error('No se encontraron filas con datos legibles de equipos en el archivo.');
      }
      setParsedRows(result.rows);
      setUnifiedDuplicates(result.unifiedDuplicates || []);
      setAllDetectedSuppliers(result.allDetectedSuppliers || []);
      setProductGroupsAudit(result.productGroupsAudit || auditProductGroups(result.rows));
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err.message || 'Error al procesar el archivo Excel. Verifique que tenga formato .xlsx, .xls o .csv'
      );
      setParsedRows([]);
      setUnifiedDuplicates([]);
      setAllDetectedSuppliers([]);
      setProductGroupsAudit(null);
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

  // Set specific action (create_new or update) for a row
  const handleSetRowAction = (index: number, action: 'update' | 'create_new') => {
    setParsedRows((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, importAction: action } : row))
    );
  };

  // Toggle between Update Existing and Create New for an individual matched item
  const handleToggleRowAction = (index: number) => {
    setParsedRows((prev) =>
      prev.map((row, idx) => {
        if (idx !== index) return row;
        const nextAction: 'update' | 'create_new' = row.importAction === 'update' ? 'create_new' : 'update';
        return {
          ...row,
          importAction: nextAction,
        };
      })
    );
  };

  // Delete row from import list
  const handleDeleteRow = (index: number) => {
    setParsedRows((prev) => {
      const updated = prev.filter((_, idx) => idx !== index);
      setProductGroupsAudit(auditProductGroups(updated));
      return updated;
    });
  };

  // Open row edit modal
  const handleOpenEditModal = (index: number) => {
    setEditingRowIndex(index);
    setEditingRowData({ ...parsedRows[index] });
  };

  // Apply suggested supplier match for a row
  const handleApplySuggestedSupplier = (index: number, supplierName: string) => {
    setParsedRows((prev) =>
      prev.map((row, idx) =>
        idx === index
          ? {
              ...row,
              supplier: supplierName,
              isSupplierInDirectory: true,
              supplierMatchStatus: 'exact',
              suggestedSupplierName: undefined,
              suggestedSupplierProfile: undefined,
            }
          : row
      )
    );
  };

  // Keep supplier as new independently
  const handleKeepAsNewSupplier = (index: number) => {
    setParsedRows((prev) =>
      prev.map((row, idx) =>
        idx === index
          ? {
              ...row,
              isSupplierInDirectory: false,
              supplierMatchStatus: 'none',
              suggestedSupplierName: undefined,
              suggestedSupplierProfile: undefined,
            }
          : row
      )
    );
  };

  // Apply all suggested suppliers across the entire file
  const handleApplyAllSuggestedSuppliers = () => {
    setParsedRows((prev) =>
      prev.map((row) => {
        if (row.supplierMatchStatus === 'suggested' && row.suggestedSupplierName) {
          return {
            ...row,
            supplier: row.suggestedSupplierName,
            isSupplierInDirectory: true,
            supplierMatchStatus: 'exact',
            suggestedSupplierName: undefined,
            suggestedSupplierProfile: undefined,
          };
        }
        return row;
      })
    );
  };

  // Keep all suggested suppliers as new
  const handleKeepAllSuggestedAsNew = () => {
    setParsedRows((prev) =>
      prev.map((row) => {
        if (row.supplierMatchStatus === 'suggested') {
          return {
            ...row,
            isSupplierInDirectory: false,
            supplierMatchStatus: 'none',
            suggestedSupplierName: undefined,
            suggestedSupplierProfile: undefined,
          };
        }
        return row;
      })
    );
  };

  // Save row edit changes
  const handleSaveEditModal = () => {
    if (editingRowIndex === null || !editingRowData) return;
    const match = editingRowData.supplier
      ? matchSupplierInDirectory(editingRowData.supplier, editingRowData.brand)
      : { status: 'none' as const, suggestedSuppliers: [] };
    const isSupplierInDir = match.status === 'exact';
    setParsedRows((prev) => {
      const updated = prev.map((row, idx) =>
        idx === editingRowIndex
          ? {
              ...editingRowData,
              isSupplierInDirectory: isSupplierInDir,
              supplierMatchStatus: match.status,
              suggestedSupplierName: match.status === 'suggested' ? match.bestSuggestion?.name : undefined,
              suggestedSupplierProfile: match.status === 'suggested' ? match.bestSuggestion : undefined,
            }
          : row
      );
      setProductGroupsAudit(auditProductGroups(updated));
      return updated;
    });
    setEditingRowIndex(null);
    setEditingRowData(null);
  };

  // Open accessories manager modal
  const handleOpenAccessoriesModal = (index: number) => {
    setAccessoriesRowIndex(index);
    setAccessoriesList(
      (parsedRows[index].standardAccessories || []).map((acc) => ({ ...acc }))
    );
    setNewAccessoryInput('');
  };

  // Add accessory in manager
  const handleAddAccessory = () => {
    if (!newAccessoryInput.trim()) return;
    setAccessoriesList((prev) => [
      ...prev,
      { name: newAccessoryInput.trim(), costCOP: 0, included: true },
    ]);
    setNewAccessoryInput('');
  };

  // Delete accessory in manager
  const handleDeleteAccessory = (accIdx: number) => {
    setAccessoriesList((prev) => prev.filter((_, idx) => idx !== accIdx));
  };

  // Update accessory name in manager
  const handleUpdateAccessoryName = (accIdx: number, newName: string) => {
    setAccessoriesList((prev) =>
      prev.map((acc, idx) => (idx === accIdx ? { ...acc, name: newName } : acc))
    );
  };

  // Reset accessories using biomedical AI auto-detection engine
  const handleResetAutoAccessories = () => {
    if (accessoriesRowIndex === null) return;
    const target = parsedRows[accessoriesRowIndex];
    const autoAccessories = getAutomaticStandardAccessories(
      target.name,
      target.brand,
      target.model,
      target.category
    );
    setAccessoriesList(autoAccessories);
  };

  // Save accessories changes
  const handleSaveAccessories = () => {
    if (accessoriesRowIndex === null) return;
    setParsedRows((prev) =>
      prev.map((row, idx) =>
        idx === accessoriesRowIndex
          ? { ...row, standardAccessories: [...accessoriesList] }
          : row
      )
    );
    setAccessoriesRowIndex(null);
  };

  // Confirm and apply import into Catalog & sync new suppliers to Ventana 5
  const handleConfirmImport = () => {
    if (parsedRows.length === 0) return;

    // Auto-register any new suppliers into Ventana 5 (Directorio de Proveedores)
    // Gather all supplier-equipment associations from allDetectedSuppliers & parsedRows
    const supplierItemsToRegister: { supplier: string; brand?: string; name?: string; model?: string; code?: string; baseCostCOP?: number }[] = [];

    allDetectedSuppliers.forEach((s) => {
      if (s.supplier && s.supplier.trim()) {
        supplierItemsToRegister.push({
          supplier: s.supplier.trim(),
          brand: s.brand,
          name: s.name,
          model: s.model,
        });
      }
    });

    parsedRows.forEach((r) => {
      if (r.supplier && r.supplier.trim()) {
        supplierItemsToRegister.push({
          supplier: r.supplier.trim(),
          brand: r.brand,
          name: r.name,
          model: r.model,
          code: r.code,
          baseCostCOP: r.baseCostCOP,
        });
      }
      if (r.allSuppliersFound && Array.isArray(r.allSuppliersFound)) {
        r.allSuppliersFound.forEach((s) => {
          if (s && s.trim()) {
            supplierItemsToRegister.push({
              supplier: s.trim(),
              brand: r.brand,
              name: r.name,
              model: r.model,
              code: r.code,
              baseCostCOP: r.baseCostCOP,
            });
          }
        });
      }
      if (r.alternateSuppliers && Array.isArray(r.alternateSuppliers)) {
        r.alternateSuppliers.forEach((s) => {
          if (s && s.trim()) {
            supplierItemsToRegister.push({
              supplier: s.trim(),
              brand: r.brand,
              name: r.name,
              model: r.model,
              code: r.code,
              baseCostCOP: r.baseCostCOP,
            });
          }
        });
      }
    });

    autoRegisterSuppliersFromEquipments(supplierItemsToRegister);

    const updatedCatalog = convertParsedRowsToCatalogEquipments(
      parsedRows,
      existingEquipments,
      'append_update'
    );
    onImportEquipments(updatedCatalog, parsedRows.length, 'append_update');
    onClose();
  };

  // Metrics
  const totalEquipments = parsedRows.length;
  const newEquipmentsCount = parsedRows.filter((r) => r.importAction === 'create_new').length;
  const updatedEquipmentsCount = parsedRows.filter((r) => r.importAction === 'update').length;
  const totalCostCOP = parsedRows.reduce((acc, r) => acc + (r.baseCostCOP || 0), 0);
  const itemsWithoutCost = parsedRows.filter((r) => !r.baseCostCOP || r.baseCostCOP === 0).length;

  const suggestedSuppliersCount = parsedRows.filter(
    (r) => r.supplierMatchStatus === 'suggested' && r.suggestedSupplierName
  ).length;

  const newSuppliersInFile = Array.from(
    new Set([
      ...allDetectedSuppliers.filter((s) => s.isNewInDirectory).map((s) => s.supplier.trim()),
      ...parsedRows
        .filter((r) => r.supplier && !r.isSupplierInDirectory && r.supplierMatchStatus !== 'suggested')
        .map((r) => r.supplier.trim()),
      ...parsedRows.flatMap((r) => r.newSuppliersDetected || []),
    ])
  );

  const filteredPreviewRows = parsedRows.map((row, originalIndex) => ({ row, originalIndex })).filter(({ row }) => {
    const q = previewSearch.toLowerCase();
    const matchesSearch =
      row.name.toLowerCase().includes(q) ||
      row.code.toLowerCase().includes(q) ||
      row.brand.toLowerCase().includes(q) ||
      row.model.toLowerCase().includes(q) ||
      (row.supplier && row.supplier.toLowerCase().includes(q)) ||
      row.category.toLowerCase().includes(q);

    const matchesIssue = !filterIssueOnly || (row.validationIssues && row.validationIssues.length > 0);
    const matchesProductGroup =
      selectedProductGroupFilter === 'ALL' ||
      (row.productGroup || 'Equipos Médicos') === selectedProductGroupFilter;

    return matchesSearch && matchesIssue && matchesProductGroup;
  });

  const validCategories: MedicalEquipment['category'][] = [
    'Diagnóstico',
    'Monitoreo',
    'Cirugía',
    'Cuidados Críticos',
    'Quirófano',
    'Urgencias',
    'Ginecología',
  ];

  return createPortal(
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 md:p-6 overflow-y-auto animate-fadeIn"
    >
      <div className="bg-[#192b45] border border-[#38bdf8]/60 rounded-2xl max-w-5xl lg:max-w-6xl w-full shadow-2xl animate-scaleUp max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="px-4 py-2.5 sm:px-5 sm:py-3 border-b border-[#334d6e] flex items-center justify-between gap-3 bg-[#15253d] shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/30 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2 truncate">
                <span>Importación Masiva al Catálogo de Equipos</span>
                <span className="text-[10px] bg-[#38bdf8]/20 text-[#38bdf8] px-2 py-0.5 rounded-full font-bold border border-[#38bdf8]/40">
                  Catálogo Maestro
                </span>
              </h3>
              <p className="text-[11px] text-slate-300 truncate">
                Carga rápida de nuevos equipos con las 8 columnas requeridas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {parsedRows.length > 0 && (
              <button
                type="button"
                onClick={downloadCatalogEquipmentTemplate}
                className="hidden sm:inline-flex items-center gap-1.5 bg-[#192b45] hover:bg-[#223b5d] text-slate-200 border border-[#334d6e] font-semibold text-[11px] px-2.5 py-1 rounded-lg transition cursor-pointer"
                title="Descargar plantilla Excel vacía con las columnas requeridas"
              >
                <Download className="w-3 h-3 text-[#38bdf8]" />
                <span>Plantilla .xlsx</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 text-xs font-bold text-slate-300 hover:text-white hover:bg-red-500/20 hover:border-red-500/40 border border-[#334d6e] rounded-lg transition cursor-pointer flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Cerrar</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 text-xs scrollbar-thin bg-[#15253d] flex flex-col">
          {/* Quick Action & Template Download Header (Only shown initially when no file is loaded) */}
          {parsedRows.length === 0 && (
            <div className="bg-[#111c2e] border border-[#334d6e] rounded-xl p-3 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-bold text-slate-200 text-xs">
                    <Download className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
                    <span>Plantilla Excel en Blanco (Importar Equipos Nuevos):</span>
                  </div>
                  <p className="text-[10.5px] text-slate-300">
                    Columnas requeridas: <strong className="text-white">Parte</strong>, <strong className="text-white">Equipo</strong>, <strong className="text-white">Marca</strong>, <strong className="text-white">Modelo</strong>, <strong className="text-white">Proveedor</strong>, <strong className="text-white">Costo</strong>, <strong className="text-white">IVA (Aplica SÍ / NO)</strong> y <strong className="text-white">Número INVIMA</strong>.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <button
                    type="button"
                    onClick={() => setShowGuide(!showGuide)}
                    className="inline-flex items-center gap-1 bg-[#192b45] hover:bg-[#223b5d] text-slate-200 border border-[#334d6e] font-semibold text-[11px] px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                  >
                    <HelpCircle className="w-3 h-3 text-amber-300" />
                    <span>{showGuide ? 'Ocultar' : '¿Cómo subir?'}</span>
                    {showGuide ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  <button
                    type="button"
                    onClick={downloadCatalogEquipmentTemplate}
                    className="inline-flex items-center gap-1.5 bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950 font-black text-[11px] px-3.5 py-1.5 rounded-lg transition cursor-pointer shadow-sm active:scale-95"
                    title="Descargar plantilla Excel vacía con las 8 columnas requeridas"
                  >
                    <Download className="w-3 h-3 text-slate-950" />
                    <span>Descargar Plantilla (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Interactive Guide Accordion */}
              {showGuide && (
                <div className="bg-[#0b1322] border border-[#38bdf8]/40 rounded-xl p-3 space-y-2.5 animate-fadeIn text-xs text-slate-300">
                  <div className="flex items-center gap-2 text-white font-bold pb-1.5 border-b border-[#334d6e]">
                    <Info className="w-3.5 h-3.5 text-[#38bdf8]" />
                    <span className="text-xs">Estructura del Archivo Excel para Importación</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] leading-relaxed">
                    <div className="space-y-1.5 bg-[#15253d] p-2.5 rounded-lg border border-[#334d6e]">
                      <h5 className="font-bold text-[#38bdf8] text-xs">
                        1. Las 8 Columnas del Excel
                      </h5>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-300 pl-0.5">
                        <li><strong className="text-white">Parte:</strong> Código o número de parte único.</li>
                        <li><strong className="text-white">Equipo:</strong> Nombre o descripción del equipo.</li>
                        <li><strong className="text-white">Marca:</strong> Fabricante (ej: Mindray, Stryker, Welch Allyn).</li>
                        <li><strong className="text-white">Modelo:</strong> Referencia del modelo.</li>
                        <li><strong className="text-white">Proveedor:</strong> Empresa proveedora / distribuidora.</li>
                        <li><strong className="text-white">Costo:</strong> Costo base en COP (sin puntos ni signos).</li>
                        <li><strong className="text-white">IVA (Aplica SÍ / NO):</strong> SÍ (19%) o NO (Exento).</li>
                        <li><strong className="text-white">Número INVIMA:</strong> Registro sanitario INVIMA.</li>
                      </ul>
                    </div>

                    <div className="space-y-1.5 bg-[#15253d] p-2.5 rounded-lg border border-[#38bdf8]/30">
                      <h5 className="font-bold text-emerald-300 text-xs flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-emerald-400" />
                        <span>2. Detección Inteligente</span>
                      </h5>
                      <ul className="list-disc list-inside space-y-0.5 text-slate-300 pl-0.5">
                        <li><strong className="text-cyan-300">Por N° de Parte:</strong> Detecta si el equipo ya existe para actualizarlo o crearlo nuevo.</li>
                        <li><strong className="text-emerald-200">Nuevos:</strong> Se crean automáticamente en el catálogo.</li>
                        <li><strong className="text-amber-300">Duplicados en Excel:</strong> Se consolidan de forma segura sin duplicar registros.</li>
                        <li><strong className="text-purple-300">Proveedores:</strong> Autodetecta coincidencias con el Directorio.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Drag and Drop File Zone (Only shown when no file is loaded) */}
          {parsedRows.length === 0 && (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl py-8 px-4 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 ${
                dragActive
                  ? 'border-[#38bdf8] bg-[#38bdf8]/10'
                  : 'border-[#334d6e] hover:border-[#38bdf8]/80 bg-[#111c2e]/60 hover:bg-[#111c2e]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv, .json, application/json"
                onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                className="hidden"
              />
              <div className="p-3 bg-[#38bdf8]/20 text-[#38bdf8] rounded-2xl border border-[#38bdf8]/30">
                <UploadCloud className="w-7 h-7" />
              </div>
              <div className="space-y-0.5">
                <p className="font-bold text-white text-xs sm:text-sm">
                  Haga clic para adjuntar archivo Excel o JSON de Equipos o arrástrelo aquí
                </p>
                <p className="text-[10.5px] text-slate-400">
                  Soporta libros Excel (.xlsx, .xls), archivos .csv y copias de seguridad / catálogos .json (hasta 306+ equipos)
                </p>
              </div>
            </div>
          )}

          {/* Processing Spinner */}
          {isProcessing && (
            <div className="p-4 text-center space-y-2 bg-[#111c2e] rounded-xl border border-[#334d6e]">
              <div className="w-6 h-6 border-2 border-[#38bdf8] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-300 font-bold">Procesando, detectando existentes y asignando accesorios estándar...</p>
            </div>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500 text-rose-200 flex items-start gap-2.5 animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-xs">Error al procesar el archivo Excel</p>
                <p className="text-[11px] text-rose-300">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* PARSED EQUIPMENTS PREVIEW TABLE (MAXIMIZED VIEWPORT) */}
          {parsedRows.length > 0 && !isProcessing && (
            <div className="space-y-2.5 flex-1 flex flex-col min-h-0 animate-fadeIn">
              {/* Ultra-Compact Control Bar: File Info + Stats + Actions */}
              <div className="bg-[#111c2e] border border-[#334d6e] rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <div className="p-1.5 bg-[#38bdf8]/20 text-[#38bdf8] rounded-lg border border-[#38bdf8]/30 shrink-0">
                    <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <span className="font-bold text-slate-200 text-xs truncate max-w-[200px]" title={selectedFileName || 'Equipos.xlsx'}>
                    {selectedFileName || 'Equipos.xlsx'}
                  </span>
                  <span className="text-[10.5px] bg-[#192b45] text-slate-200 px-2 py-0.5 rounded-md border border-[#334d6e] font-semibold whitespace-nowrap">
                    <strong>{totalEquipments}</strong> equipos
                  </span>
                  <span className="text-[10.5px] bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded-md border border-emerald-500/30 font-bold whitespace-nowrap">
                    +{newEquipmentsCount} nuevos
                  </span>
                  {updatedEquipmentsCount > 0 && (
                    <span className="text-[10.5px] bg-cyan-500/15 text-cyan-300 px-2 py-0.5 rounded-md border border-cyan-500/30 font-bold whitespace-nowrap">
                      {updatedEquipmentsCount} a actualizar
                    </span>
                  )}
                  {newSuppliersInFile.length > 0 && (
                    <span className="text-[10.5px] bg-purple-500/15 text-purple-300 px-2 py-0.5 rounded-md border border-purple-500/30 font-semibold whitespace-nowrap">
                      +{newSuppliersInFile.length} proveedores nuevos
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                  <button
                    type="button"
                    onClick={() => setShowSummaryKpis(!showSummaryKpis)}
                    className="px-2.5 py-1 rounded-lg bg-[#192b45] hover:bg-[#223b5d] text-slate-300 border border-[#334d6e] text-[11px] font-semibold transition cursor-pointer flex items-center gap-1"
                  >
                    <span>{showSummaryKpis ? 'Ocultar Métricas' : 'Ver Métricas'}</span>
                    {showSummaryKpis ? <ChevronUp className="w-3 h-3 text-[#38bdf8]" /> : <ChevronDown className="w-3 h-3 text-[#38bdf8]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 rounded-lg bg-[#192b45] hover:bg-[#223b5d] text-slate-200 border border-[#334d6e] text-[11px] font-semibold transition cursor-pointer active:scale-95"
                  >
                    Cambiar Archivo
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Collapsible KPIs Panel (Only shown when user clicks 'Ver Métricas') */}
              {showSummaryKpis && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 animate-fadeIn shrink-0">
                  <div className="bg-[#111c2e] p-2.5 rounded-xl border border-[#334d6e]">
                    <span className="text-[10px] text-slate-400 block font-bold">TOTAL EN ARCHIVO</span>
                    <strong className="text-sm font-mono text-white">{totalEquipments}</strong>
                  </div>

                  <div className="bg-[#111c2e] p-2.5 rounded-xl border border-emerald-500/40">
                    <span className="text-[10px] text-emerald-400 block font-bold">NUEVOS A CREAR</span>
                    <strong className="text-sm font-mono text-emerald-300">+{newEquipmentsCount}</strong>
                  </div>

                  <div className="bg-[#111c2e] p-2.5 rounded-xl border border-cyan-500/40">
                    <span className="text-[10px] text-cyan-400 block font-bold">EXISTENTES A ACTUALIZAR</span>
                    <strong className="text-sm font-mono text-cyan-300">{updatedEquipmentsCount}</strong>
                  </div>

                  <div className="bg-[#111c2e] p-2.5 rounded-xl border border-purple-500/40">
                    <span className="text-[10px] text-purple-300 block font-bold">DIRECTORIO DE PROVEEDORES</span>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="text-xs font-bold text-white">
                        {newSuppliersInFile.length > 0 ? (
                          <span className="text-emerald-300">+{newSuppliersInFile.length} nuevos</span>
                        ) : (
                          <span className="text-slate-300">Al día</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Automatic Unification Notification Banner & Accordion (Ultra Compact) */}
              {unifiedDuplicates.length > 0 && (
                <div className="rounded-lg bg-purple-950/30 border border-purple-500/30 px-2.5 py-1.5 text-xs animate-fadeIn shrink-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                        <Layers className="w-3.5 h-3.5" />
                      </div>
                      <div className="min-w-0 flex items-center flex-wrap gap-x-2 gap-y-0.5">
                        <span className="font-bold text-white text-[11.5px]">
                          Se unificaron {unifiedDuplicates.length} {unifiedDuplicates.length === 1 ? 'equipo repetido' : 'equipos repetidos'}
                        </span>
                        <span className="text-[9px] bg-purple-500/25 text-purple-200 px-1.5 py-0.2 rounded font-extrabold border border-purple-400/30">
                          Auto-Consolidado
                        </span>
                        <span className="text-[10.5px] text-purple-300/80 hidden sm:inline truncate">
                          • Costos, accesorios y proveedores fusionados sin duplicar
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowUnifiedDetails(!showUnifiedDetails)}
                      className="px-2 py-0.5 rounded bg-purple-900/60 hover:bg-purple-800/80 text-purple-200 border border-purple-500/40 text-[10.5px] font-bold transition flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
                    >
                      <span>{showUnifiedDetails ? 'Ocultar' : `Ver ${unifiedDuplicates.length} Detalle`}</span>
                      {showUnifiedDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                  </div>

                  {/* Expandable list of unified equipments (Compact View) */}
                  {showUnifiedDetails && (
                    <div className="space-y-1 pt-1.5 border-t border-purple-500/20 max-h-40 overflow-y-auto scrollbar-thin">
                      {unifiedDuplicates.map((item, uIdx) => (
                        <div
                          key={item.key || uIdx}
                          className="px-2 py-1.5 rounded bg-[#111c2e]/95 border border-purple-500/25 flex flex-wrap items-center justify-between gap-1.5 text-[10.5px]"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-bold text-[#38bdf8] text-[10px] bg-[#192b45] px-1 py-0.2 rounded border border-[#334d6e]">
                                {item.code}
                              </span>
                              <span className="font-bold text-white text-[11px]">{item.name}</span>
                              <span className="text-slate-400 font-medium">• {item.brand} {item.model}</span>
                              <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded font-bold border border-purple-500/30">
                                {item.unifiedCount} filas
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-300 flex items-center flex-wrap gap-x-2 gap-y-0.5">
                              <span>
                                <span className="text-purple-300 font-semibold">Criterio:</span> {item.reason} — <span className="text-emerald-300 font-semibold">Filas #{item.excelRowNumbers.join(', #')}</span>
                              </span>
                              {item.allSuppliers && item.allSuppliers.length > 0 && (
                                <span className="text-slate-400">
                                  • Proveedores:{' '}
                                  <strong className="text-slate-200">{item.allSuppliers.join(', ')}</strong>
                                  {item.newSuppliers && item.newSuppliers.length > 0 && (
                                    <span className="ml-1 text-[8.5px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded font-bold border border-emerald-500/30">
                                      +{item.newSuppliers.length} nuevo{item.newSuppliers.length > 1 ? 's' : ''} a directorio
                                    </span>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0 text-[10.5px]">
                            <span className="font-mono text-emerald-300 font-bold block">{formatCOP(item.baseCostCOP)}</span>
                            <span className="text-[9px] text-slate-400">{item.mergedAccessoriesCount} acc. estándar</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Smart Supplier Match Banner (Compact 1-line strip) */}
              {suggestedSuppliersCount > 0 && (
                <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs animate-fadeIn shrink-0">
                  <div className="flex items-center gap-1.5 text-amber-300 text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      <strong className="text-amber-200">{suggestedSuppliersCount} {suggestedSuppliersCount === 1 ? 'proveedor sugerido' : 'proveedores sugeridos'}</strong> en el archivo
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleApplyAllSuggestedSuppliers}
                      className="px-2.5 py-0.5 rounded-md bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10.5px] inline-flex items-center gap-1 shadow-xs transition active:scale-95 cursor-pointer"
                      title="Corregir y asignar el proveedor existente a todos los equipos sugeridos"
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>Corregir Todos ({suggestedSuppliersCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleKeepAllSuggestedAsNew}
                      className="px-2 py-0.5 rounded-md bg-[#111c2e] hover:bg-[#192b45] text-slate-300 border border-[#334d6e] text-[10.5px] font-medium transition active:scale-95 cursor-pointer"
                      title="Mantener todos los nombres del archivo como proveedores nuevos"
                    >
                      Dejar como Nuevos
                    </button>
                  </div>
                </div>
              )}

              {itemsWithoutCost > 0 && (
                <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-500/50 flex items-center justify-between gap-2 text-xs shrink-0">
                  <div className="flex items-center gap-1.5 text-amber-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>
                      Hay <strong>{itemsWithoutCost} equipos</strong> con costo en $0 COP en el archivo.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFilterIssueOnly(!filterIssueOnly)}
                    className="text-[11px] font-bold text-amber-300 underline cursor-pointer hover:text-amber-200 shrink-0"
                  >
                    {filterIssueOnly ? 'Ver todos los equipos' : `Filtrar los ${itemsWithoutCost} sin costo`}
                  </button>
                </div>
              )}

              {/* Product Groups Audit Banner & Missing Groups Detector */}
              {productGroupsAudit && (
                <div
                  className={`rounded-xl p-3 border text-xs animate-fadeIn shrink-0 transition-all ${
                    productGroupsAudit.missingGroups.length > 0
                      ? 'bg-amber-950/30 border-amber-500/50 shadow-md'
                      : 'bg-emerald-950/25 border-emerald-500/40 shadow-xs'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`p-2 rounded-xl border shrink-0 mt-0.5 ${
                          productGroupsAudit.missingGroups.length > 0
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        }`}
                      >
                        {productGroupsAudit.missingGroups.length > 0 ? (
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-black text-sm text-white flex items-center gap-1.5">
                            <span>Auditoría de Tipos de Producto</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              (Equipos Médicos, Instrumental QX, Muebles Hospitalarios)
                            </span>
                          </h4>
                          {productGroupsAudit.missingGroups.length > 0 ? (
                            <span className="text-[10px] bg-rose-500/25 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded-full font-black animate-pulse">
                              Faltan {productGroupsAudit.missingGroups.length}{' '}
                              {productGroupsAudit.missingGroups.length === 1 ? 'grupo requerido' : 'grupos requeridos'}
                            </span>
                          ) : (
                            <span className="text-[10px] bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-black">
                              Portafolio Completo (3/3)
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-300 leading-snug">
                          {productGroupsAudit.missingGroups.length > 0 ? (
                            <span>
                              Se detectaron tipos de producto faltantes en el archivo Excel cargado. Verifique el desglose a continuación:
                            </span>
                          ) : (
                            <span className="text-emerald-200">
                              El archivo importado cubre satisfactoriamente todos los tipos de producto estándar de la empresa.
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Core Groups Status Pills */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-slate-700/50">
                    {/* Equipos Médicos */}
                    <div
                      onClick={() =>
                        setSelectedProductGroupFilter(
                          selectedProductGroupFilter === 'Equipos Médicos' ? 'ALL' : 'Equipos Médicos'
                        )
                      }
                      className={`p-2 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition active:scale-95 ${
                        selectedProductGroupFilter === 'Equipos Médicos'
                          ? 'ring-2 ring-sky-400 bg-sky-950/60 border-sky-400'
                          : productGroupsAudit.groupCounts['Equipos Médicos'] > 0
                          ? 'bg-[#111c2e] border-sky-500/40 hover:border-sky-400/80'
                          : 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 shrink-0">
                          <Activity className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-white text-[11px] block truncate">Equipos Médicos</span>
                          <span className="text-[10px] text-slate-400">
                            {productGroupsAudit.groupCounts['Equipos Médicos'] > 0
                              ? `${productGroupsAudit.groupCounts['Equipos Médicos']} en archivo`
                              : '0 registros'}
                          </span>
                        </div>
                      </div>
                      {productGroupsAudit.groupCounts['Equipos Médicos'] > 0 ? (
                        <span className="text-[9.5px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold shrink-0">
                          ✓ Presente
                        </span>
                      ) : (
                        <span className="text-[9.5px] bg-rose-500/25 text-rose-300 border border-rose-500/40 px-1.5 py-0.5 rounded font-bold shrink-0">
                          ✗ Hace falta
                        </span>
                      )}
                    </div>

                    {/* Instrumental Quirúrgico */}
                    <div
                      onClick={() =>
                        setSelectedProductGroupFilter(
                          selectedProductGroupFilter === 'Instrumental Quirúrgico'
                            ? 'ALL'
                            : 'Instrumental Quirúrgico'
                        )
                      }
                      className={`p-2 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition active:scale-95 ${
                        selectedProductGroupFilter === 'Instrumental Quirúrgico'
                          ? 'ring-2 ring-purple-400 bg-purple-950/60 border-purple-400'
                          : productGroupsAudit.groupCounts['Instrumental Quirúrgico'] > 0
                          ? 'bg-[#111c2e] border-purple-500/40 hover:border-purple-400/80'
                          : 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-400 shrink-0">
                          <Scissors className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-white text-[11px] block truncate">
                            Instrumental Quirúrgico
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {productGroupsAudit.groupCounts['Instrumental Quirúrgico'] > 0
                              ? `${productGroupsAudit.groupCounts['Instrumental Quirúrgico']} en archivo`
                              : '0 registros'}
                          </span>
                        </div>
                      </div>
                      {productGroupsAudit.groupCounts['Instrumental Quirúrgico'] > 0 ? (
                        <span className="text-[9.5px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold shrink-0">
                          ✓ Presente
                        </span>
                      ) : (
                        <span className="text-[9.5px] bg-rose-500/25 text-rose-300 border border-rose-500/40 px-1.5 py-0.5 rounded font-bold shrink-0">
                          ✗ Hace falta
                        </span>
                      )}
                    </div>

                    {/* Muebles Hospitalarios */}
                    <div
                      onClick={() =>
                        setSelectedProductGroupFilter(
                          selectedProductGroupFilter === 'Muebles Hospitalarios'
                            ? 'ALL'
                            : 'Muebles Hospitalarios'
                        )
                      }
                      className={`p-2 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition active:scale-95 ${
                        selectedProductGroupFilter === 'Muebles Hospitalarios'
                          ? 'ring-2 ring-emerald-400 bg-emerald-950/60 border-emerald-400'
                          : productGroupsAudit.groupCounts['Muebles Hospitalarios'] > 0
                          ? 'bg-[#111c2e] border-emerald-500/40 hover:border-emerald-400/80'
                          : 'bg-rose-950/20 border-rose-500/40 hover:border-rose-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
                          <BedDouble className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-white text-[11px] block truncate">
                            Muebles Hospitalarios
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {productGroupsAudit.groupCounts['Muebles Hospitalarios'] > 0
                              ? `${productGroupsAudit.groupCounts['Muebles Hospitalarios']} en archivo`
                              : '0 registros'}
                          </span>
                        </div>
                      </div>
                      {productGroupsAudit.groupCounts['Muebles Hospitalarios'] > 0 ? (
                        <span className="text-[9.5px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold shrink-0">
                          ✓ Presente
                        </span>
                      ) : (
                        <span className="text-[9.5px] bg-rose-500/25 text-rose-300 border border-rose-500/40 px-1.5 py-0.5 rounded font-bold shrink-0">
                          ✗ Hace falta
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Group Filter Tabs & Preview Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shrink-0">
                {/* Filter Tabs by Product Group */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setSelectedProductGroupFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 cursor-pointer ${
                      selectedProductGroupFilter === 'ALL'
                        ? 'bg-[#38bdf8] text-slate-950 shadow-xs font-black'
                        : 'bg-[#111c2e] text-slate-300 border border-[#334d6e] hover:text-white'
                    }`}
                  >
                    Todos ({parsedRows.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProductGroupFilter('Equipos Médicos')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 inline-flex items-center gap-1 cursor-pointer ${
                      selectedProductGroupFilter === 'Equipos Médicos'
                        ? 'bg-sky-500 text-slate-950 shadow-xs font-black'
                        : 'bg-[#111c2e] text-sky-300 border border-sky-500/40 hover:bg-sky-500/20'
                    }`}
                  >
                    <Activity className="w-3 h-3" />
                    <span>Equipos ({productGroupsAudit?.groupCounts['Equipos Médicos'] || 0})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProductGroupFilter('Instrumental Quirúrgico')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 inline-flex items-center gap-1 cursor-pointer ${
                      selectedProductGroupFilter === 'Instrumental Quirúrgico'
                        ? 'bg-purple-500 text-slate-950 shadow-xs font-black'
                        : 'bg-[#111c2e] text-purple-300 border border-purple-500/40 hover:bg-purple-500/20'
                    }`}
                  >
                    <Scissors className="w-3 h-3" />
                    <span>Instrumental ({productGroupsAudit?.groupCounts['Instrumental Quirúrgico'] || 0})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedProductGroupFilter('Muebles Hospitalarios')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 inline-flex items-center gap-1 cursor-pointer ${
                      selectedProductGroupFilter === 'Muebles Hospitalarios'
                        ? 'bg-emerald-500 text-slate-950 shadow-xs font-black'
                        : 'bg-[#111c2e] text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/20'
                    }`}
                  >
                    <BedDouble className="w-3 h-3" />
                    <span>Muebles ({productGroupsAudit?.groupCounts['Muebles Hospitalarios'] || 0})</span>
                  </button>
                </div>

                {/* Preview Search Bar */}
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Buscar por equipo, marca, modelo, proveedor o parte..."
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    className="w-full bg-[#111c2e] border border-[#334d6e] focus:border-[#38bdf8] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 outline-none font-medium"
                  />
                  {previewSearch && (
                    <button
                      type="button"
                      onClick={() => setPreviewSearch('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Equipments Table (Cleaned: NO margin, NO invima column, NO warranty column) */}
              <div className="border border-[#334d6e] rounded-xl overflow-hidden shadow-inner flex-1 min-h-[380px] max-h-[58vh] overflow-y-auto scrollbar-thin">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[#111c2e] text-slate-300 sticky top-0 z-10 border-b border-[#334d6e] font-bold text-[11px]">
                    <tr>
                      <th className="p-2.5">Parte</th>
                      <th className="p-2.5">Equipo & Marca / Modelo</th>
                      <th className="p-2.5 text-center">Tipo de Producto</th>
                      <th className="p-2.5">Categoría</th>
                      <th className="p-2.5 text-right">Costo Base (COP)</th>
                      <th className="p-2.5 text-center">Accesorios</th>
                      <th className="p-2.5 text-center">Estado / Modo</th>
                      <th className="p-2.5 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#334d6e]/60 bg-[#15253d]">
                    {filteredPreviewRows.map(({ row, originalIndex }) => (
                      <tr key={originalIndex} className="hover:bg-[#192b45] transition">
                        {/* Parte (Código) */}
                        <td className="p-2.5 font-mono font-bold text-[#38bdf8] whitespace-nowrap">
                          {row.code}
                        </td>

                        {/* Equipo, Marca, Modelo & Proveedor (con detector inteligente de Directorio) */}
                        <td className="p-2.5 min-w-[260px]">
                          <p className="font-bold text-white leading-tight">{row.name}</p>
                          <div className="text-[10.5px] text-slate-300 mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="font-bold text-[#38bdf8]">{row.brand}</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-200">{row.model}</span>
                            {row.invimaRecordNumber && (
                              <>
                                <span className="text-slate-500">•</span>
                                <span
                                  className={`text-[9.5px] px-1.5 py-0.2 rounded font-mono border ${
                                    row.invimaRecordNumber !== 'En Trámite'
                                      ? 'text-emerald-300 bg-emerald-950/80 border-emerald-500/40 font-bold'
                                      : 'text-amber-300/80 bg-amber-950/40 border-amber-500/30'
                                  }`}
                                >
                                  INVIMA: {row.invimaRecordNumber}
                                </span>
                              </>
                            )}
                          </div>

                          {row.supplier && (
                            <div className="mt-1.5">
                              {row.supplierMatchStatus === 'suggested' && row.suggestedSupplierName ? (
                                <div className="mt-1 p-1.5 rounded-lg bg-amber-950/40 border border-amber-500/40 text-[10.5px] animate-fadeIn">
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="text-amber-300 font-semibold flex items-center gap-1 truncate">
                                      <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                                      <span className="truncate">"{row.supplier}" ➔ <strong className="text-emerald-300 font-bold">{row.suggestedSupplierName}</strong></span>
                                    </span>
                                    <span className="text-[8.5px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-bold shrink-0">
                                      Similar
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleApplySuggestedSupplier(originalIndex, row.suggestedSupplierName!)}
                                      className="px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[9.5px] inline-flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-xs"
                                      title={`Corregir a ${row.suggestedSupplierName}`}
                                    >
                                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                                      <span>Corregir a "{row.suggestedSupplierName}"</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleKeepAsNewSupplier(originalIndex)}
                                      className="px-1.5 py-0.5 rounded bg-[#111c2e] hover:bg-[#192b45] text-slate-300 border border-[#334d6e] text-[9.5px] font-medium transition active:scale-95 cursor-pointer"
                                      title="Crear como nuevo proveedor en el Directorio"
                                    >
                                      <span>Dejar como Nuevo</span>
                                    </button>
                                  </div>
                                </div>
                              ) : row.isSupplierInDirectory ? (
                                <div className="inline-flex items-center gap-1.5 bg-[#111c2e] px-2 py-0.5 rounded-lg border border-cyan-500/30">
                                  <Building2 className="w-3 h-3 text-cyan-400 shrink-0" />
                                  <span className="text-slate-200 font-semibold">{row.supplier}</span>
                                  <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1 py-0.2 rounded font-bold border border-cyan-500/40">
                                    Registrado
                                  </span>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 bg-emerald-500/15 px-2 py-0.5 rounded-lg border border-emerald-500/40">
                                  <Building2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                  <span className="text-emerald-200 font-bold">{row.supplier}</span>
                                  <span className="text-[9px] bg-emerald-500 text-slate-950 px-1.5 py-0.2 rounded-xs font-black uppercase">
                                    Nuevo
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Tipo / Grupo de Producto */}
                        <td className="p-2.5 text-center whitespace-nowrap">
                          {(() => {
                            const groupStyle = getProductGroupBadgeStyle(row.productGroup || 'Equipos Médicos');
                            return (
                              <span
                                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md font-bold border ${groupStyle.badgeClass}`}
                              >
                                {row.productGroup === 'Instrumental Quirúrgico' && <Scissors className="w-2.5 h-2.5" />}
                                {row.productGroup === 'Muebles Hospitalarios' && <BedDouble className="w-2.5 h-2.5" />}
                                {(!row.productGroup || row.productGroup === 'Equipos Médicos') && (
                                  <Activity className="w-2.5 h-2.5" />
                                )}
                                {row.productGroup === 'Dispositivos Médicos' && (
                                  <Stethoscope className="w-2.5 h-2.5" />
                                )}
                                <span>{row.productGroup || 'Equipos Médicos'}</span>
                              </span>
                            );
                          })()}
                        </td>

                        {/* Categoría */}
                        <td className="p-2.5 whitespace-nowrap">
                          <span className="text-[10px] bg-[#111c2e] text-slate-300 px-2 py-0.5 rounded-full border border-[#334d6e]">
                            {row.category}
                          </span>
                        </td>

                        {/* Costo Base COP */}
                        <td className="p-2.5 text-right font-mono font-bold whitespace-nowrap">
                          {row.baseCostCOP > 0 ? (
                            <span className="text-emerald-300">{formatCOP(row.baseCostCOP)}</span>
                          ) : (
                            <span className="text-amber-400 font-normal">⚠️ $0 COP</span>
                          )}
                        </td>

                        {/* Accesorios Estándar (Interactivo con botón) */}
                        <td className="p-2.5 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleOpenAccessoriesModal(originalIndex)}
                            className="inline-flex items-center gap-1 text-[10px] bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 px-2 py-1 rounded-lg border border-emerald-500/40 font-bold transition cursor-pointer active:scale-95"
                            title="Haga clic para ver, agregar, editar o eliminar los accesorios de este equipo"
                          >
                            <Sparkles className="w-3 h-3 text-emerald-400" />
                            <span>{row.standardAccessories?.length || 0} Accesorios</span>
                          </button>
                        </td>

                        {/* Modo / Estado (Condicional: Toggle para existentes vs Badge único para nuevo) */}
                        <td className="p-2.5 text-center whitespace-nowrap">
                          <div className="flex flex-col items-center gap-1">
                            {row.isExistingMatch ? (
                              <>
                                <div className="inline-flex items-center p-0.5 rounded-lg bg-[#0b1322] border border-[#334d6e] shadow-inner">
                                  <button
                                    type="button"
                                    onClick={() => handleSetRowAction(originalIndex, 'create_new')}
                                    className={`px-2 py-1 rounded-md text-[9.5px] font-bold inline-flex items-center gap-1 transition cursor-pointer active:scale-95 ${
                                      row.importAction === 'create_new'
                                        ? 'bg-emerald-500 text-slate-950 shadow-xs font-black'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                                    }`}
                                    title="Crear como nuevo equipo independiente en el catálogo"
                                  >
                                    <Plus className="w-2.5 h-2.5 stroke-[2.5]" />
                                    <span>Crear Nuevo</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSetRowAction(originalIndex, 'update')}
                                    className={`px-2 py-1 rounded-md text-[9.5px] font-bold inline-flex items-center gap-1 transition cursor-pointer active:scale-95 ${
                                      row.importAction === 'update'
                                        ? 'bg-cyan-500 text-slate-950 shadow-xs font-black'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                                    }`}
                                    title="Actualizar datos del equipo coincidente ya registrado en catálogo"
                                  >
                                    <RefreshCw className="w-2.5 h-2.5 stroke-[2.5]" />
                                    <span>Actualizar Existente</span>
                                  </button>
                                </div>
                                <span className="text-[9px] text-cyan-300 font-semibold flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                                  <span>Coincidencia en catálogo</span>
                                </span>
                              </>
                            ) : (
                              <div className="flex flex-col items-center gap-0.5">
                                <div className="inline-flex items-center justify-center bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-lg text-[10.5px] font-bold shadow-xs">
                                  <span>Equipo Nuevo</span>
                                </div>
                                {row.isUnified && (
                                  <span
                                    className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/40 font-bold inline-flex items-center gap-1"
                                    title={
                                      row.unifiedExcelRows
                                        ? `Unificadas ${row.unifiedExcelRows.length} filas del Excel: #${row.unifiedExcelRows.join(', #')}`
                                        : 'Equipo unificado'
                                    }
                                  >
                                    <Layers className="w-2.5 h-2.5" />
                                    <span>Unificado ({row.unifiedCount || (row.unifiedExcelRows?.length ?? 2)} filas)</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Acciones (Editar, Accesorios, Eliminar) */}
                        <td className="p-2.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(originalIndex)}
                              className="p-1.5 rounded-lg bg-[#111c2e] hover:bg-[#38bdf8]/20 text-slate-300 hover:text-[#38bdf8] border border-[#334d6e] transition cursor-pointer"
                              title="Editar datos del equipo"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenAccessoriesModal(originalIndex)}
                              className="p-1.5 rounded-lg bg-[#111c2e] hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-[#334d6e] transition cursor-pointer"
                              title="Gestionar accesorios incluidos"
                            >
                              <Package className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(originalIndex)}
                              className="p-1.5 rounded-lg bg-[#111c2e] hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-[#334d6e] transition cursor-pointer"
                              title="Eliminar este equipo del lote a importar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 border-t border-[#334d6e] flex flex-wrap items-center justify-between gap-3 bg-[#15253d] shrink-0">
          <div className="text-[11px] text-slate-400">
            {parsedRows.length > 0 ? (
              <span>
                Listo para cargar <strong>{parsedRows.length} equipos</strong> al Catálogo ({newEquipmentsCount} nuevos, {updatedEquipmentsCount} actualizados)
              </span>
            ) : (
              <span>Seleccione un archivo Excel para previsualizar los equipos antes de importar</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl border border-[#334d6e] text-slate-300 hover:text-white hover:bg-[#192b45] text-xs font-bold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={parsedRows.length === 0 || isProcessing}
              className="inline-flex items-center gap-1.5 bg-[#38bdf8] hover:bg-[#0284c7] disabled:opacity-50 text-slate-950 font-black text-xs px-4 py-2 rounded-xl transition cursor-pointer shadow-lg disabled:cursor-not-allowed active:scale-95"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Cargar {parsedRows.length} Equipos al Catálogo</span>
            </button>
          </div>
        </div>
      </div>

      {/* SUB-MODAL: ACCESORIOS MANAGER (VER, EDITAR, AGREGAR, ELIMINAR) */}
      {accessoriesRowIndex !== null && typeof document !== 'undefined' && createPortal(
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setAccessoriesRowIndex(null);
          }}
          className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
        >
          <div className="bg-[#192b45] border border-emerald-500/60 rounded-2xl max-w-xl w-full shadow-2xl animate-scaleUp overflow-hidden flex flex-col max-h-[88vh]">
            {/* Accessories Header */}
            <div className="px-4 py-3 border-b border-[#334d6e] bg-[#15253d] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                  <Package className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                    Accesorios Estándar Incluidos
                  </h4>
                  <p className="text-[10.5px] text-slate-300 truncate">
                    {parsedRows[accessoriesRowIndex]?.name} ({parsedRows[accessoriesRowIndex]?.brand} - {parsedRows[accessoriesRowIndex]?.model})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAccessoriesRowIndex(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Accessories Body */}
            <div className="p-4 space-y-3.5 overflow-y-auto flex-1 text-xs bg-[#111c2e]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-300 font-bold text-xs">
                  Lista de componentes ({accessoriesList.length}):
                </span>
                <button
                  type="button"
                  onClick={handleResetAutoAccessories}
                  className="inline-flex items-center gap-1 text-[10.5px] text-cyan-300 hover:text-cyan-200 font-bold bg-[#15253d] px-2 py-1 rounded-lg border border-[#334d6e] cursor-pointer"
                  title="Detectar y restaurar accesorios clínicos sugeridos automáticamente"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Autodetectar por tipo de equipo</span>
                </button>
              </div>

              {/* Add New Accessory Input */}
              <div className="flex items-center gap-2 bg-[#15253d] p-2 rounded-xl border border-[#334d6e]">
                <input
                  type="text"
                  placeholder="Escriba un nuevo accesorio (ej: Sensor de SpO2 pediátrico, Filtro de repuesto...)"
                  value={newAccessoryInput}
                  onChange={(e) => setNewAccessoryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAccessory();
                    }
                  }}
                  className="flex-1 bg-[#111c2e] border border-[#334d6e] focus:border-emerald-400 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-400 outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddAccessory}
                  disabled={!newAccessoryInput.trim()}
                  className="inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Añadir</span>
                </button>
              </div>

              {/* Accessories List */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto scrollbar-thin pr-1">
                {accessoriesList.length === 0 ? (
                  <div className="text-center p-4 text-slate-400 border border-dashed border-[#334d6e] rounded-xl">
                    No hay accesorios asignados a este equipo. Agregue uno arriba o use la detección automática.
                  </div>
                ) : (
                  accessoriesList.map((acc, accIdx) => (
                    <div
                      key={accIdx}
                      className="flex items-center gap-2 bg-[#15253d] border border-[#334d6e] hover:border-emerald-500/40 p-2 rounded-xl transition"
                    >
                      <span className="text-[10px] font-mono text-slate-400 w-5 text-center">
                        {accIdx + 1}
                      </span>
                      <input
                        type="text"
                        value={acc.name}
                        onChange={(e) => handleUpdateAccessoryName(accIdx, e.target.value)}
                        className="flex-1 bg-transparent border-b border-transparent focus:border-emerald-400 text-xs text-slate-200 focus:text-white px-1 py-0.5 outline-none font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteAccessory(accIdx)}
                        className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                        title="Eliminar este accesorio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Accessories Footer */}
            <div className="px-4 py-2.5 border-t border-[#334d6e] bg-[#15253d] flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setAccessoriesRowIndex(null)}
                className="px-3 py-1.5 rounded-xl border border-[#334d6e] text-slate-300 hover:text-white text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveAccessories}
                className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-md"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar Accesorios</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* SUB-MODAL: EDIT ROW DATA */}
      {editingRowIndex !== null && editingRowData && typeof document !== 'undefined' && createPortal(
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingRowIndex(null);
          }}
          className="fixed inset-0 z-60 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-fadeIn"
        >
          <div className="bg-[#192b45] border border-[#38bdf8]/60 rounded-2xl max-w-xl w-full shadow-2xl animate-scaleUp overflow-hidden flex flex-col max-h-[88vh]">
            {/* Edit Row Header */}
            <div className="px-4 py-3 border-b border-[#334d6e] bg-[#15253d] flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 rounded-xl bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/30 shrink-0">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                    Editar Datos del Equipo a Importar
                  </h4>
                  <p className="text-[10.5px] text-slate-300 truncate">
                    Modifique los campos antes de confirmar la carga al catálogo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRowIndex(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Edit Row Body */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1 text-xs bg-[#111c2e]">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Nombre del Equipo *</label>
                <input
                  type="text"
                  value={editingRowData.name}
                  onChange={(e) => setEditingRowData({ ...editingRowData, name: e.target.value })}
                  className="w-full bg-[#15253d] border border-[#334d6e] focus:border-[#38bdf8] rounded-xl px-3 py-2 text-xs text-white outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Marca *</label>
                  <input
                    type="text"
                    value={editingRowData.brand}
                    onChange={(e) => setEditingRowData({ ...editingRowData, brand: e.target.value })}
                    className="w-full bg-[#15253d] border border-[#334d6e] focus:border-[#38bdf8] rounded-xl px-3 py-2 text-xs text-white outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Modelo *</label>
                  <input
                    type="text"
                    value={editingRowData.model}
                    onChange={(e) => setEditingRowData({ ...editingRowData, model: e.target.value })}
                    className="w-full bg-[#15253d] border border-[#334d6e] focus:border-[#38bdf8] rounded-xl px-3 py-2 text-xs text-white outline-none font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Proveedor / Distribuidor</label>
                  <input
                    type="text"
                    list="modal-directory-suppliers-list"
                    value={editingRowData.supplier || ''}
                    onChange={(e) => setEditingRowData({ ...editingRowData, supplier: e.target.value })}
                    className="w-full bg-[#15253d] border border-[#334d6e] focus:border-[#38bdf8] rounded-xl px-3 py-2 text-xs text-white outline-none font-medium"
                    placeholder="Escriba o elija del Directorio..."
                  />
                  <datalist id="modal-directory-suppliers-list">
                    {getStoredSupplierProfiles().map((p) => (
                      <option key={p.id || p.name} value={p.name}>
                        {p.name} {p.brands && p.brands.length > 0 ? `(${p.brands.join(', ')})` : ''}
                      </option>
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Tipo de Producto (Grupo) *</label>
                  <select
                    value={editingRowData.productGroup || 'Equipos Médicos'}
                    onChange={(e) =>
                      setEditingRowData({
                        ...editingRowData,
                        productGroup: e.target.value as ProductGroup,
                      })
                    }
                    className="w-full bg-[#15253d] border border-[#334d6e] focus:border-[#38bdf8] rounded-xl px-3 py-2 text-xs text-white outline-none font-bold"
                  >
                    <option value="Equipos Médicos" className="bg-[#111c2e] text-sky-300">
                      ⚡ Equipos Médicos
                    </option>
                    <option value="Instrumental Quirúrgico" className="bg-[#111c2e] text-purple-300">
                      ✂️ Instrumental Quirúrgico
                    </option>
                    <option value="Muebles Hospitalarios" className="bg-[#111c2e] text-emerald-300">
                      🛏️ Muebles Hospitalarios
                    </option>
                    <option value="Dispositivos Médicos" className="bg-[#111c2e] text-amber-300">
                      🩺 Dispositivos Médicos
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Categoría Médica</label>
                  <select
                    value={editingRowData.category}
                    onChange={(e) =>
                      setEditingRowData({
                        ...editingRowData,
                        category: e.target.value as MedicalEquipment['category'],
                      })
                    }
                    className="w-full bg-[#15253d] border border-[#334d6e] focus:border-[#38bdf8] rounded-xl px-3 py-2 text-xs text-white outline-none font-medium"
                  >
                    {validCategories.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#111c2e] text-white">
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Meses de Garantía</label>
                  <input
                    type="number"
                    value={editingRowData.warrantyMonths || 24}
                    onChange={(e) =>
                      setEditingRowData({
                        ...editingRowData,
                        warrantyMonths: Number(e.target.value) || 24,
                      })
                    }
                    className="w-full bg-[#15253d] border border-[#334d6e] focus:border-[#38bdf8] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Costo Base COP *</label>
                  <input
                    type="number"
                    value={editingRowData.baseCostCOP || ''}
                    onChange={(e) =>
                      setEditingRowData({
                        ...editingRowData,
                        baseCostCOP: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full bg-[#15253d] border border-[#334d6e] focus:border-emerald-400 rounded-xl px-3 py-2 text-xs text-emerald-300 font-mono font-bold outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Parte (N° de Parte o Referencia)</label>
                  <input
                    type="text"
                    value={editingRowData.code}
                    onChange={(e) => setEditingRowData({ ...editingRowData, code: e.target.value })}
                    className="w-full bg-[#15253d] border border-[#334d6e] focus:border-[#38bdf8] rounded-xl px-3 py-2 text-xs text-[#38bdf8] font-mono outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">Registro INVIMA</label>
                  <input
                    type="text"
                    value={editingRowData.invimaRecordNumber || ''}
                    onChange={(e) =>
                      setEditingRowData({ ...editingRowData, invimaRecordNumber: e.target.value })
                    }
                    className="w-full bg-[#15253d] border border-[#334d6e] focus:border-[#38bdf8] rounded-xl px-3 py-2 text-xs text-white font-mono outline-none"
                    placeholder="ej. INVIMA 2021EBC-0004521"
                  />
                </div>
              </div>
            </div>

            {/* Edit Row Footer */}
            <div className="px-4 py-2.5 border-t border-[#334d6e] bg-[#15253d] flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setEditingRowIndex(null)}
                className="px-3 py-1.5 rounded-xl border border-[#334d6e] text-slate-300 hover:text-white text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEditModal}
                className="inline-flex items-center gap-1.5 bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-md"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>,
    document.body
  );
};
