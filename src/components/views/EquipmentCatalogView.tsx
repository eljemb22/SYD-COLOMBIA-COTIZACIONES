import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  BookOpen,
  Search,
  Filter,
  Plus,
  FileSpreadsheet,
  Download,
  ShieldCheck,
  Check,
  Tag,
  Lock,
  Edit3,
  Trash2,
  Building2,
  LayoutGrid,
  List,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Users,
  X,
  PlusCircle,
  Globe,
  RefreshCw,
  Eye,
  EyeOff,
  Key,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { googleWorkspaceService } from '../../services/googleWorkspaceService';
import { MedicalEquipment, AuthUser, TenderClientProject } from '../../types';
import { formatCOP } from '../../utils/formatters';
import { fetchLiveTRM, getCachedTRM, TrmData } from '../../utils/trmService';
import { CatalogExcelImportModal } from '../catalog/CatalogExcelImportModal';
import { downloadCatalogEquipmentTemplate } from '../../utils/excelImportUtils';
import { MASTER_EQUIPMENTS_CATALOG } from '../../data/masterEquipmentsCatalog';
import { verifyAdminPassword } from '../../data/authData';
import {
  ExcelColumnConfig,
  ExcelColumnHeader,
  useExcelTableFilters,
} from '../common/ExcelTableFilter';

interface EquipmentCatalogViewProps {
  equipments: MedicalEquipment[];
  tenderClients?: TenderClientProject[];
  onAddToTender: (equipment: MedicalEquipment, targetClientId?: string) => void;
  onAddToQuote?: (equipment: MedicalEquipment) => void;
  onNavigateToSales?: () => void;
  onNavigateToTenders?: () => void;
  onOpenNewEquipmentModal: () => void;
  onEditEquipment: (equipment: MedicalEquipment) => void;
  onDeleteEquipment?: (id: string, code?: string) => void;
  onClearAllEquipments?: () => void | Promise<void>;
  onBatchImportEquipments?: (
    updatedCatalog: MedicalEquipment[],
    importedCount: number,
    mode: 'append_update' | 'replace'
  ) => void;
  onViewDoc?: (equipmentId: string) => void;
  currentUser?: AuthUser | null;
}

const CATALOG_TABLE_COLUMNS: ExcelColumnConfig<MedicalEquipment>[] = [
  {
    id: 'code',
    label: 'Parte / Código',
    accessor: (eq) => eq.code || 'N/A',
    type: 'text',
  },
  {
    id: 'name',
    label: 'Equipo / Descripción',
    accessor: (eq) => eq.name,
    type: 'text',
  },
  {
    id: 'brandModel',
    label: 'Marca / Modelo',
    accessor: (eq) => `${eq.brand || 'N/A'} - ${eq.model || ''}`,
    type: 'text',
  },
  {
    id: 'supplier',
    label: 'Proveedor',
    accessor: (eq) => eq.supplier || 'No especificado',
    type: 'text',
  },
  {
    id: 'baseCostCOP',
    label: 'Costo Base',
    accessor: (eq) => eq.baseCostCOP || 0,
    type: 'number',
    formatter: (v) => formatCOP(Number(v)),
    align: 'right',
  },
  {
    id: 'costWithIva',
    label: 'Costo c/ IVA',
    accessor: (eq) => (eq.taxExempt ? eq.baseCostCOP || 0 : Math.round((eq.baseCostCOP || 0) * 1.19)),
    type: 'number',
    formatter: (v) => formatCOP(Number(v)),
    align: 'right',
  },
  {
    id: 'invima',
    label: 'INVIMA',
    accessor: (eq) => eq.invimaRecordNumber || 'N/A',
    type: 'text',
  },
  {
    id: 'warranty',
    label: 'Garantía',
    accessor: (eq) => `${eq.warrantyMonths || 12} Meses`,
    type: 'enum',
    align: 'center',
  },
];

export const EquipmentCatalogView: React.FC<EquipmentCatalogViewProps> = ({
  equipments,
  tenderClients = [],
  onAddToTender,
  onAddToQuote,
  onNavigateToSales,
  onNavigateToTenders,
  onOpenNewEquipmentModal,
  onEditEquipment,
  onDeleteEquipment,
  onClearAllEquipments,
  onBatchImportEquipments,
  currentUser,
}) => {
  const isReadOnly = currentUser?.role === 'viewer' && !currentUser?.permissions?.canEditCatalog;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [selectedBrand, setSelectedBrand] = useState<string>('Todos');
  const [equipmentToDelete, setEquipmentToDelete] = useState<MedicalEquipment | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
  const [filterMissingCostOnly, setFilterMissingCostOnly] = useState(false);
  const [addedQuoteFeedback, setAddedQuoteFeedback] = useState<{ eqName: string } | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importSuccessFeedback, setImportSuccessFeedback] = useState<{
    count: number;
    mode: 'append_update' | 'replace';
  } | null>(null);

  // Clear Catalog Data states
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [showClearPassword, setShowClearPassword] = useState(false);
  const [clearPasswordError, setClearPasswordError] = useState<string | null>(null);
  const [isClearingData, setIsClearingData] = useState(false);
  const [clearSuccessFeedback, setClearSuccessFeedback] = useState<boolean>(false);

  // Live TRM State
  const [trmData, setTrmData] = useState<TrmData>(() => getCachedTRM());
  const [isRefreshingTrm, setIsRefreshingTrm] = useState(false);
  const [isTrmPopoverOpen, setIsTrmPopoverOpen] = useState(false);

  // Google Sheets (Read-Only) handler
  const [isExportingSheets, setIsExportingSheets] = useState(false);
  const [sheetExportUrl, setSheetExportUrl] = useState<string | null>(null);

  const handleExportGoogleSheet = () => {
    const existingSheet = googleWorkspaceService.getConnectedSpreadsheet();
    if (existingSheet?.url) {
      window.open(existingSheet.url, '_blank');
      return;
    }
    window.dispatchEvent(new CustomEvent('syd-open-workspace-modal', { detail: { tab: 'sheets' } }));
  };

  // Equipments without cost ($0 COP or undefined)
  const equipmentsWithoutCost = equipments.filter((eq) => !eq.baseCostCOP || eq.baseCostCOP === 0);

  const handleRefreshCatalogTrm = async () => {
    setIsRefreshingTrm(true);
    try {
      const data = await fetchLiveTRM();
      setTrmData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshingTrm(false);
    }
  };

  // Client Selection Flow Modal when adding to Tender
  const [selectedEqForTender, setSelectedEqForTender] = useState<MedicalEquipment | null>(null);
  const [addedTenderFeedback, setAddedTenderFeedback] = useState<{ eqName: string; clientName: string } | null>(null);

  // Quick new client creation inside selection modal
  const [isCreatingQuickClient, setIsCreatingQuickClient] = useState(false);
  const [clientModalSearch, setClientModalSearch] = useState('');
  const [quickClientName, setQuickClientName] = useState('');
  const [quickClientNit, setQuickClientNit] = useState('');
  const [quickProcessNumber, setQuickProcessNumber] = useState('');
  const [quickCity, setQuickCity] = useState('Bogotá D.C.');

  // Handle ESC key press to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (equipmentToDelete) {
          setEquipmentToDelete(null);
        } else if (selectedEqForTender) {
          setSelectedEqForTender(null);
          setIsCreatingQuickClient(false);
        } else if (isTrmPopoverOpen) {
          setIsTrmPopoverOpen(false);
        }
      }
    };

    const handleTrmUpdated = (e: any) => {
      if (e.detail) {
        setTrmData(e.detail);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('syd_trm_updated', handleTrmUpdated);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('syd_trm_updated', handleTrmUpdated);
    };
  }, [equipmentToDelete, selectedEqForTender, isTrmPopoverOpen]);

  const categories = [
    'Todos',
    'Monitoreo',
    'Cirugía',
    'Diagnóstico',
    'Quirófano',
    'Cuidados Críticos',
    'Urgencias',
    'Ginecología',
  ];

  // Extract unique brands dynamically from equipment list
  const uniqueBrands = ['Todos', ...Array.from(new Set(equipments.map((e) => e.brand).filter(Boolean)))];

  const baseEquipments = useMemo(() => {
    return equipments.filter((eq) => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        eq.name.toLowerCase().includes(query) ||
        eq.code.toLowerCase().includes(query) ||
        eq.brand.toLowerCase().includes(query) ||
        (eq.supplier && eq.supplier.toLowerCase().includes(query)) ||
        eq.model.toLowerCase().includes(query) ||
        eq.invimaRecordNumber.toLowerCase().includes(query);

      const matchesCat = selectedCategory === 'Todos' || eq.category === selectedCategory;
      const matchesBrand = selectedBrand === 'Todos' || eq.brand === selectedBrand;
      const matchesMissingCost = !filterMissingCostOnly || (!eq.baseCostCOP || eq.baseCostCOP === 0);

      return matchesSearch && matchesCat && matchesBrand && matchesMissingCost;
    });
  }, [equipments, searchQuery, selectedCategory, selectedBrand, filterMissingCostOnly]);

  const {
    filteredRows: filteredEquipments,
    filters: excelFilters,
    sort: excelSort,
    onApplyFilter: onApplyExcelFilter,
    onApplySort: onApplyExcelSort,
    onClearColumnFilter: onClearExcelColumnFilter,
    onResetAllFilters: onResetAllExcelFilters,
    isFilteredOrSorted: isExcelFilteredOrSorted,
    activeFiltersCount: excelActiveFiltersCount,
  } = useExcelTableFilters(baseEquipments, CATALOG_TABLE_COLUMNS);

  const handleOpenClientSelector = (eq: MedicalEquipment) => {
    setSelectedEqForTender(eq);
    setIsCreatingQuickClient(false);
  };

  const handleConfirmAddToClient = (clientId: string, clientName: string) => {
    if (!selectedEqForTender) return;
    onAddToTender(selectedEqForTender, clientId);
    const eqName = selectedEqForTender.name;
    setSelectedEqForTender(null);
    setAddedTenderFeedback({ eqName, clientName });
    setTimeout(() => {
      setAddedTenderFeedback(null);
    }, 4500);
  };

  const handleAddToQuoteDirect = (eq: MedicalEquipment) => {
    if (onAddToQuote) {
      onAddToQuote(eq);
      setAddedQuoteFeedback({ eqName: eq.name });
      setTimeout(() => {
        setAddedQuoteFeedback(null);
      }, 4500);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('Todos');
    setSelectedBrand('Todos');
    setFilterMissingCostOnly(false);
  };

  const confirmDelete = () => {
    if (equipmentToDelete && onDeleteEquipment) {
      onDeleteEquipment(equipmentToDelete.id, equipmentToDelete.code);
      setEquipmentToDelete(null);
    }
  };

  const handleConfirmClearAllData = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setClearPasswordError(null);
    if (!adminPasswordInput.trim()) {
      setClearPasswordError('Por favor ingrese la contraseña de administrador.');
      return;
    }
    const isValid = verifyAdminPassword(adminPasswordInput);
    if (!isValid) {
      setClearPasswordError('Contraseña de administrador incorrecta. Ingrese la clave del usuario admin.');
      return;
    }

    setIsClearingData(true);
    try {
      if (onClearAllEquipments) {
        await onClearAllEquipments();
      } else if (onBatchImportEquipments) {
        onBatchImportEquipments([], 0, 'replace');
      }
      setIsClearModalOpen(false);
      setAdminPasswordInput('');
      setClearSuccessFeedback(true);
      setTimeout(() => {
        setClearSuccessFeedback(false);
      }, 6000);
    } catch (err) {
      setClearPasswordError('Ocurrió un error al vaciar los datos del catálogo. Intente de nuevo.');
    } finally {
      setIsClearingData(false);
    }
  };

  return (
    <div id="equipment-catalog-container" className="space-y-4 animate-fadeIn">
      {/* Feedback Toast Notification when catalog is cleared */}
      {clearSuccessFeedback && (
        <div className="p-3 bg-rose-950/90 border border-rose-500 rounded-xl text-rose-200 text-xs font-bold flex flex-wrap items-center justify-between gap-3 shadow-xl animate-scaleUp">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-rose-400 stroke-[3]" />
            <span>
              Todos los datos de equipos del catálogo han sido <strong>borrados exitosamente</strong>.
            </span>
          </div>
          <button
            onClick={() => setClearSuccessFeedback(false)}
            className="bg-rose-900/50 hover:bg-rose-900 text-rose-200 px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Feedback Toast Notification when imported via Excel */}
      {importSuccessFeedback && (
        <div className="p-3 bg-[#38bdf8] text-slate-950 border border-sky-300 rounded-xl text-xs font-bold flex flex-wrap items-center justify-between gap-3 shadow-xl animate-scaleUp">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 stroke-[3] text-emerald-950" />
            <span>
              ¡Se han {importSuccessFeedback.mode === 'replace' ? 'reemplazado y cargado' : 'importado / actualizado'} exitosamente <strong>{importSuccessFeedback.count} equipos</strong> en el Catálogo Maestro!
            </span>
          </div>
          <button
            onClick={() => setImportSuccessFeedback(null)}
            className="bg-slate-950/20 hover:bg-slate-950/30 text-slate-950 px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Feedback Toast Notification when added to Commercial Quote */}
      {addedQuoteFeedback && (
        <div className="p-3 bg-emerald-700 border border-emerald-400 rounded-xl text-white text-xs font-bold flex flex-wrap items-center justify-between gap-3 shadow-xl animate-scaleUp">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-200 stroke-[3]" />
            <span>
              ¡Equipo <strong>"{addedQuoteFeedback.eqName}"</strong> agregado exitosamente a la <strong>Cotización Comercial</strong>!
            </span>
          </div>
          {onNavigateToSales && (
            <button
              onClick={onNavigateToSales}
              className="bg-white text-emerald-950 px-3 py-1.5 rounded-lg text-xs font-black hover:bg-slate-100 transition cursor-pointer shadow-md inline-flex items-center gap-1"
            >
              <span>Ver en Cotización</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Feedback Toast Notification when added to Tender Client */}
      {addedTenderFeedback && (
        <div className="p-3 bg-purple-600 border border-purple-400 rounded-xl text-white text-xs font-bold flex flex-wrap items-center justify-between gap-3 shadow-xl animate-scaleUp">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-300 stroke-[3]" />
            <span>
              ¡Equipo <strong>"{addedTenderFeedback.eqName}"</strong> agregado con sus especificaciones técnicas a <strong>"{addedTenderFeedback.clientName}"</strong> en Licitaciones!
            </span>
          </div>
          {onNavigateToTenders && (
            <button
              onClick={onNavigateToTenders}
              className="bg-white text-purple-950 px-3 py-1.5 rounded-lg text-xs font-black hover:bg-slate-100 transition cursor-pointer shadow-md inline-flex items-center gap-1"
            >
              <span>Ver en Licitaciones</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Alert Banner: Missing Equipment Cost ($0 COP) */}
      {equipmentsWithoutCost.length > 0 && (
        <div className="bg-amber-950/40 border border-amber-500/60 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs shadow-md animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-300 rounded-lg border border-amber-500/40 shrink-0">
              <AlertTriangle className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <p className="font-bold text-amber-200">
                ⚠️ {equipmentsWithoutCost.length} {equipmentsWithoutCost.length === 1 ? 'equipo en el catálogo no tiene costo base asignado ($0 COP)' : 'equipos en el catálogo no tienen costo base asignado ($0 COP)'}
              </p>
              <p className="text-[11px] text-slate-300">
                Equipos creados o sincronizados desde Licitaciones requieren que asigne manualmente su costo base de compra para calcular cotizaciones comerciales precisas.
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilterMissingCostOnly(!filterMissingCostOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border shadow-xs inline-flex items-center gap-1.5 ${
              filterMissingCostOnly
                ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-md font-black'
                : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-500/40'
            }`}
          >
            <span>{filterMissingCostOnly ? '✓ Mostrando solo sin costo' : `Filtrar ${equipmentsWithoutCost.length} sin costo`}</span>
          </button>
        </div>
      )}

      {/* Unified Search, Filter & Action Bar */}
      <div className="bg-[#1e314b] border border-[#334d6e] rounded-2xl p-3.5 sm:p-4 space-y-3.5 shadow-lg">
        {/* Row 1: Search (Left) + Filters, View Switcher & TRM (Right) */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              id="search-catalog-input"
              type="text"
              placeholder="Buscar por equipo, parte, proveedor, marca, modelo o INVIMA..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#15253d] border border-[#334d6e] focus:border-[#38bdf8] focus:ring-1 focus:ring-[#38bdf8] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-400 outline-none font-medium transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs p-0.5 cursor-pointer"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right Tools: Brand Filter + View Mode Switcher + Live TRM Badge */}
          <div className="flex items-center justify-end flex-wrap gap-2 shrink-0">
            {/* Brand Filter */}
            <div className="flex items-center gap-1.5 bg-[#15253d] border border-[#334d6e] rounded-xl px-2.5 py-1.5 text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="bg-transparent border-0 text-xs font-bold text-slate-200 focus:outline-none cursor-pointer pr-1"
              >
                {uniqueBrands.map((b) => (
                  <option key={b} value={b} className="bg-[#15253d] text-white">
                    Marca: {b}
                  </option>
                ))}
              </select>
            </div>

            {/* View Mode Switcher */}
            <div className="bg-[#15253d] p-1 rounded-xl border border-[#334d6e] flex items-center gap-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'grid' ? 'bg-[#38bdf8] text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                title="Vista de Tarjetas"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'table' ? 'bg-[#38bdf8] text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                title="Vista de Tabla / Lista Rápida"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Live TRM Badge & Dollar Volatility Analysis Popover */}
            <div className="relative">
              <div
                onClick={() => setIsTrmPopoverOpen(!isTrmPopoverOpen)}
                className="bg-[#15253d] hover:bg-[#1b3150] border border-[#334d6e] hover:border-[#38bdf8]/60 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs transition cursor-pointer shadow-xs select-none"
                title="Haga clic para ver el análisis de volatilidad y la TRM recomendada para cotizaciones"
              >
                <Globe className="w-3.5 h-3.5 text-[#38bdf8]" />
                <span className="text-slate-400 hidden sm:inline">TRM:</span>
                <span className="text-emerald-400 font-mono font-bold">${trmData.rate.toLocaleString()}</span>
                <span className="text-slate-500 hidden md:inline">•</span>
                <span className="text-amber-300 font-mono font-bold hidden md:inline" title="TRM Recomendada de Seguridad (Valor Redondo)">
                  Rec: ${trmData.analysis?.recommendedRoundRate.toLocaleString() || (Math.ceil(trmData.rate * 1.05 / 50) * 50).toLocaleString()}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRefreshCatalogTrm();
                  }}
                  disabled={isRefreshingTrm}
                  className="text-slate-400 hover:text-white transition p-0.5 cursor-pointer disabled:opacity-50"
                  title="Actualizar TRM en vivo de internet"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshingTrm ? 'animate-spin text-amber-300' : ''}`} />
                </button>
              </div>

              {isTrmPopoverOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-1.5 w-84 bg-[#0f1a2a] border border-[#38bdf8]/70 rounded-xl shadow-2xl p-3 z-50 text-xs text-white animate-fadeIn"
                >
                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#334d6e]">
                    <span className="font-bold text-[#38bdf8] flex items-center gap-1.5 text-xs">
                      <Globe className="w-4 h-4 text-[#38bdf8]" />
                      <span>Análisis Cambiario del Dólar (TRM)</span>
                    </span>
                    <button
                      onClick={() => setIsTrmPopoverOpen(false)}
                      className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    <div className="bg-[#15253d] p-2.5 rounded-lg border border-[#334d6e] flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">TRM Oficial Spot</span>
                        <strong className="text-sm font-mono text-emerald-400 font-black">
                          ${trmData.rate.toLocaleString()} COP
                        </strong>
                      </div>
                      <button
                        onClick={handleRefreshCatalogTrm}
                        disabled={isRefreshingTrm}
                        className="inline-flex items-center gap-1 bg-[#192b45] hover:bg-[#253f68] text-slate-200 border border-[#334d6e] px-2 py-1 rounded-md text-[10.5px] font-bold cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${isRefreshingTrm ? 'animate-spin text-amber-300' : ''}`} />
                        <span>{isRefreshingTrm ? 'Actualizando...' : 'Actualizar'}</span>
                      </button>
                    </div>

                    <div className="bg-amber-950/30 border border-amber-500/40 rounded-lg p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10.5px] font-bold text-amber-300 flex items-center gap-1">
                          <span>🛡️ TRM Recomendada (Valor Redondo)</span>
                        </span>
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold">
                          +{trmData.analysis?.bufferPercent || '5.1'}%
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <strong className="text-base font-mono font-black text-amber-300">
                          ${(trmData.analysis?.recommendedRoundRate || Math.ceil(trmData.rate * 1.05 / 50) * 50).toLocaleString()} COP
                        </strong>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Margen: +${(trmData.analysis?.bufferCOP || Math.round((Math.ceil(trmData.rate * 1.05 / 50) * 50) - trmData.rate)).toLocaleString()} COP
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-tight">
                        Al ingresar equipos en USD, se multiplican por esta tasa para fijar el costo base en COP y garantizar que las cotizaciones en pesos conserven la rentabilidad esperada.
                      </p>
                    </div>

                    <div className="space-y-1 text-[10.5px]">
                      <div className="text-slate-400 font-bold">Rangos Sugeridos por Nivel de Riesgo:</div>
                      <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
                        <div className="bg-[#15253d] p-1.5 rounded border border-[#334d6e]">
                          <span className="text-[9px] text-slate-400 block font-sans">Moderado (+3%)</span>
                          <strong className="text-slate-200 text-[11px] font-bold">
                            ${(trmData.analysis?.moderateRoundRate || Math.ceil(trmData.rate * 1.03 / 50) * 50).toLocaleString()}
                          </strong>
                        </div>
                        <div className="bg-amber-500/10 p-1.5 rounded border border-amber-500/30">
                          <span className="text-[9px] text-amber-300 block font-sans font-bold">Recomendado (+5%)</span>
                          <strong className="text-amber-300 text-[11px] font-black">
                            ${(trmData.analysis?.conservativeRoundRate || Math.ceil(trmData.rate * 1.05 / 50) * 50).toLocaleString()}
                          </strong>
                        </div>
                        <div className="bg-[#15253d] p-1.5 rounded border border-[#334d6e]">
                          <span className="text-[9px] text-slate-400 block font-sans">Alta Seg. (+7.5%)</span>
                          <strong className="text-cyan-300 text-[11px] font-bold">
                            ${(trmData.analysis?.highProtectionRoundRate || Math.ceil(trmData.rate * 1.075 / 100) * 100).toLocaleString()}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Categories (Left) & Action Buttons (Right) */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 pt-2.5 border-t border-[#334d6e]/60">
          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin flex-1 min-w-0 pr-2">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-sm font-bold border border-blue-400/50'
                      : 'bg-[#15253d] text-slate-400 hover:text-slate-200 border border-[#334d6e]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Action Buttons Group (Importar / Exportar Excel, Borrar Datos, Nuevo Equipo) - Aligned to the Right */}
          <div className="flex items-center justify-end flex-wrap gap-2 shrink-0">
            {!isReadOnly ? (
              <>
                <button
                  id="btn-import-catalog-excel"
                  onClick={() => setIsImportModalOpen(true)}
                  className="inline-flex items-center gap-1.5 bg-[#15253d] hover:bg-[#1f375a] text-slate-100 border border-[#38bdf8]/60 hover:border-[#38bdf8] font-bold text-xs px-3 py-2 rounded-xl shadow-xs transition cursor-pointer whitespace-nowrap active:scale-95"
                  title="Importar masivamente desde archivo Excel (.xlsx / .xls)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span>Importar Excel</span>
                </button>

                <button
                  id="btn-export-catalog-excel"
                  onClick={downloadCatalogEquipmentTemplate}
                  className="inline-flex items-center gap-1.5 bg-[#15253d] hover:bg-[#1f375a] text-cyan-200 border border-cyan-500/50 hover:border-cyan-400 font-bold text-xs px-3 py-2 rounded-xl shadow-xs transition cursor-pointer whitespace-nowrap active:scale-95"
                  title="Descargar plantilla Excel en blanco para importar equipos nuevos (Parte, Equipo, Marca, Modelo, Proveedor, Costo, IVA, INVIMA)"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Plantilla Excel</span>
                </button>

                <button
                  id="btn-export-catalog-sheets"
                  onClick={handleExportGoogleSheet}
                  className="inline-flex items-center gap-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/50 hover:border-emerald-400 font-bold text-xs px-3 py-2 rounded-xl shadow-xs transition cursor-pointer whitespace-nowrap active:scale-95"
                  title="Conectar o abrir hoja de Google Sheets de Google Drive en modo solo lectura"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Google Sheets (Solo Lectura)</span>
                </button>

                <button
                  id="btn-clear-catalog-data"
                  onClick={() => {
                    setAdminPasswordInput('');
                    setClearPasswordError(null);
                    setShowClearPassword(false);
                    setIsClearModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 hover:text-rose-200 border border-rose-500/40 hover:border-rose-400 font-bold text-xs px-3 py-2 rounded-xl shadow-xs transition cursor-pointer whitespace-nowrap active:scale-95"
                  title="Borrar todos los datos de equipos del catálogo (Requiere clave de administrador)"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Borrar Datos</span>
                </button>

                <button
                  id="btn-open-create-equipment"
                  onClick={onOpenNewEquipmentModal}
                  className="inline-flex items-center gap-1.5 bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl shadow-md transition cursor-pointer whitespace-nowrap active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Nuevo Equipo</span>
                </button>
              </>
            ) : (
              <div className="inline-flex items-center gap-1.5 bg-[#15253d] border border-[#334d6e] text-slate-400 text-xs px-3 py-2 rounded-xl">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Solo Consulta</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {filteredEquipments.length === 0 ? (
            <div className="col-span-full bg-[#15253d] border border-[#334d6e] rounded-xl p-10 text-center text-slate-400">
              <p className="text-sm font-bold text-white mb-1">
                {equipments.length === 0
                  ? 'El catálogo se encuentra vacío'
                  : 'No se encontraron equipos con esos criterios'}
              </p>
              <p className="text-xs text-slate-500">
                {equipments.length === 0
                  ? 'Use el botón "Importar Excel" o "Nuevo Equipo" para registrar sus equipos médicos personalizados.'
                  : 'Pruebe limpiando los filtros de búsqueda o categoría.'}
              </p>
              <div className="mt-4 flex items-center justify-center gap-2.5 flex-wrap">
                {(searchQuery || selectedCategory !== 'Todos' || selectedBrand !== 'Todos' || filterMissingCostOnly) && (
                  <button
                    onClick={handleResetFilters}
                    className="inline-flex items-center gap-1.5 bg-[#1e314b] hover:bg-[#253d5e] text-slate-200 border border-[#38bdf8]/40 hover:border-[#38bdf8] font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs active:scale-95"
                  >
                    <span>Limpiar Filtros de Búsqueda</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            filteredEquipments.map((eq, idx) => {
              const costWithIva = eq.taxExempt ? eq.baseCostCOP : Math.round(eq.baseCostCOP * 1.19);
              return (
                <div
                  key={`eq-card-${eq.id || eq.code || 'item'}-${idx}`}
                  className="bg-[#1e314b] border border-[#334d6e] hover:border-[#38bdf8]/70 rounded-xl p-3.5 flex flex-col justify-between transition-all duration-200 shadow-md group relative hover:shadow-lg"
                >
                  <div className="space-y-2.5">
                    {/* Name */}
                    <h3 className="text-xs font-bold text-white group-hover:text-[#38bdf8] transition line-clamp-2 leading-snug">
                      {eq.name}
                    </h3>

                    {/* Especificaciones: Marca, Modelo & Proveedor */}
                    <div className="space-y-1.5 text-[11px] bg-[#15253d]/60 p-2.5 rounded-lg border border-[#334d6e]/40">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-slate-400 font-medium">Marca:</span>
                        <span className="bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded text-[10px] border border-blue-500/30 truncate">
                          {eq.brand || 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-1 text-slate-300">
                        <span className="text-slate-400 font-medium">Modelo:</span>
                        <strong className="text-white truncate font-medium">{eq.model || 'N/A'}</strong>
                      </div>
                      <div className="flex items-center justify-between gap-1 text-slate-300">
                        <span className="text-slate-400 font-medium flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-[#38bdf8] shrink-0" />
                          Proveedor:
                        </span>
                        <span className="truncate font-medium text-slate-200">
                          {eq.supplier || 'No especificado'}
                        </span>
                      </div>
                    </div>

                    {/* Cost in COP breakdown: Before IVA & With IVA & USD tag, or Missing Cost Warning */}
                    {(!eq.baseCostCOP || eq.baseCostCOP === 0) ? (
                      <div className="bg-amber-950/30 border border-amber-500/50 p-2.5 rounded-lg space-y-1.5 animate-fadeIn">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-black text-amber-300 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 animate-pulse" />
                            <span>Sin Costo Base</span>
                          </span>
                          <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono font-bold">
                            $0 COP
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-300 leading-tight">
                          Equipo pendiente de asignar costo de adquisición en catálogo.
                        </p>
                        {!isReadOnly && (
                          <button
                            onClick={() => onEditEquipment(eq)}
                            className="w-full text-center bg-amber-500/20 hover:bg-amber-500/35 border border-amber-500/50 text-amber-200 hover:text-white text-[11px] font-bold py-1 px-2 rounded-md transition cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Definir Costo Base</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="bg-[#15253d] p-2.5 rounded-lg border border-[#334d6e] space-y-1.5 shadow-inner">
                        {eq.baseCostUSD && eq.baseCostUSD > 0 ? (
                          <div className="flex items-center justify-between text-[11px] pb-1 border-b border-[#334d6e]/40">
                            <span className="text-amber-400 font-bold flex items-center gap-1">
                              <span>USD Base:</span>
                            </span>
                            <strong className="text-xs font-bold text-amber-300 font-mono">
                              US${eq.baseCostUSD.toLocaleString()}
                            </strong>
                          </div>
                        ) : null}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[10.5px] text-slate-400 font-semibold uppercase">Costo Base (COP):</span>
                          <strong className="text-xs font-bold text-slate-200 font-mono">
                            {formatCOP(eq.baseCostCOP)}
                          </strong>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-[#334d6e]/50">
                          <span className="text-[10.5px] text-cyan-300 font-bold uppercase flex items-center gap-1">
                            <span>Costo c/ IVA</span>
                            <span className="text-[9px] font-normal text-cyan-400/80 font-sans">
                              ({eq.taxExempt ? 'Exento 0%' : '19%'})
                            </span>
                            :
                          </span>
                          <strong className="text-xs font-black text-cyan-300 font-mono">
                            {formatCOP(costWithIva)}
                          </strong>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Actions */}
                  <div className="mt-3 pt-2.5 border-t border-[#334d6e]/60 flex items-center gap-2">
                    {!isReadOnly ? (
                      <>
                        <button
                          onClick={() => onEditEquipment(eq)}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 bg-amber-500/15 hover:bg-amber-500/25 py-2 px-3 rounded-xl border border-amber-500/30 font-bold transition cursor-pointer shadow-xs active:scale-95"
                          title="Editar equipo (Costos, Proveedor, INVIMA, etc.)"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>

                        <button
                          onClick={() => setEquipmentToDelete(eq)}
                          className="inline-flex items-center justify-center p-2 text-rose-400 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/25 rounded-xl border border-rose-500/30 transition cursor-pointer shadow-xs active:scale-95"
                          title="Eliminar equipo del catálogo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-500 italic mx-auto">Solo lectura</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VIEW MODE 2: TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-[#192b45] border border-[#334d6e] rounded-xl overflow-hidden shadow-md">
          <div className="p-3 bg-[#142338] border-b border-[#334d6e] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#38bdf8]" />
              <span className="text-xs font-bold text-white">
                Vista de Catálogo en Tabla — <strong className="text-[#38bdf8]">{filteredEquipments.length} Equipos</strong>
                {filteredEquipments.length !== equipments.length && (
                  <span className="text-slate-400 font-normal ml-1">({equipments.length} total)</span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isExcelFilteredOrSorted && (
                <button
                  type="button"
                  onClick={onResetAllExcelFilters}
                  className="inline-flex items-center gap-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl px-3 py-1 text-xs font-bold transition cursor-pointer active:scale-95 shadow-xs"
                  title="Restablecer filtros tipo Excel"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpiar Filtros Excel ({excelActiveFiltersCount})</span>
                </button>
              )}
              <span className="text-[11px] text-slate-400">
                Filtros tipo Excel con búsqueda y selección múltiple
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#121f33] text-slate-300 font-bold border-b border-[#334d6e] text-[11px]">
                  <th className="p-3 min-w-[130px]">
                    <ExcelColumnHeader
                      column={CATALOG_TABLE_COLUMNS[0]}
                      allRows={baseEquipments}
                      filters={excelFilters}
                      sort={excelSort}
                      onApplyFilter={onApplyExcelFilter}
                      onApplySort={onApplyExcelSort}
                      onClearColumnFilter={onClearExcelColumnFilter}
                    />
                  </th>
                  <th className="p-3 min-w-[240px]">
                    <ExcelColumnHeader
                      column={CATALOG_TABLE_COLUMNS[1]}
                      allRows={baseEquipments}
                      filters={excelFilters}
                      sort={excelSort}
                      onApplyFilter={onApplyExcelFilter}
                      onApplySort={onApplyExcelSort}
                      onClearColumnFilter={onClearExcelColumnFilter}
                    />
                  </th>
                  <th className="p-3 min-w-[170px]">
                    <ExcelColumnHeader
                      column={CATALOG_TABLE_COLUMNS[2]}
                      allRows={baseEquipments}
                      filters={excelFilters}
                      sort={excelSort}
                      onApplyFilter={onApplyExcelFilter}
                      onApplySort={onApplyExcelSort}
                      onClearColumnFilter={onClearExcelColumnFilter}
                    />
                  </th>
                  <th className="p-3 min-w-[170px]">
                    <ExcelColumnHeader
                      column={CATALOG_TABLE_COLUMNS[3]}
                      allRows={baseEquipments}
                      filters={excelFilters}
                      sort={excelSort}
                      onApplyFilter={onApplyExcelFilter}
                      onApplySort={onApplyExcelSort}
                      onClearColumnFilter={onClearExcelColumnFilter}
                    />
                  </th>
                  <th className="p-3 min-w-[140px] text-right">
                    <ExcelColumnHeader
                      column={CATALOG_TABLE_COLUMNS[4]}
                      allRows={baseEquipments}
                      filters={excelFilters}
                      sort={excelSort}
                      onApplyFilter={onApplyExcelFilter}
                      onApplySort={onApplyExcelSort}
                      onClearColumnFilter={onClearExcelColumnFilter}
                    />
                  </th>
                  <th className="p-3 min-w-[140px] text-right">
                    <ExcelColumnHeader
                      column={CATALOG_TABLE_COLUMNS[5]}
                      allRows={baseEquipments}
                      filters={excelFilters}
                      sort={excelSort}
                      onApplyFilter={onApplyExcelFilter}
                      onApplySort={onApplyExcelSort}
                      onClearColumnFilter={onClearExcelColumnFilter}
                    />
                  </th>
                  <th className="p-3 min-w-[140px]">
                    <ExcelColumnHeader
                      column={CATALOG_TABLE_COLUMNS[6]}
                      allRows={baseEquipments}
                      filters={excelFilters}
                      sort={excelSort}
                      onApplyFilter={onApplyExcelFilter}
                      onApplySort={onApplyExcelSort}
                      onClearColumnFilter={onClearExcelColumnFilter}
                    />
                  </th>
                  <th className="p-3 min-w-[120px] text-center">
                    <ExcelColumnHeader
                      column={CATALOG_TABLE_COLUMNS[7]}
                      allRows={baseEquipments}
                      filters={excelFilters}
                      sort={excelSort}
                      onApplyFilter={onApplyExcelFilter}
                      onApplySort={onApplyExcelSort}
                      onClearColumnFilter={onClearExcelColumnFilter}
                    />
                  </th>
                  <th className="p-3 text-center w-28">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334d6e]/50">
                {filteredEquipments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      <p className="text-sm font-bold text-white mb-1">
                        {equipments.length === 0
                          ? 'El catálogo se encuentra vacío'
                          : 'No se encontraron equipos con esos criterios'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {equipments.length === 0
                          ? 'Use el botón "Importar Excel" o "Nuevo Equipo" para registrar sus equipos médicos personalizados.'
                          : 'Pruebe limpiando los filtros de búsqueda o categoría.'}
                      </p>
                      <div className="mt-4 flex items-center justify-center gap-2.5 flex-wrap">
                        {(searchQuery || selectedCategory !== 'Todos' || selectedBrand !== 'Todos' || filterMissingCostOnly) && (
                          <button
                            onClick={handleResetFilters}
                            className="inline-flex items-center gap-1.5 bg-[#1e314b] hover:bg-[#253d5e] text-slate-200 border border-[#38bdf8]/40 hover:border-[#38bdf8] font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs active:scale-95"
                          >
                            <span>Limpiar Filtros de Búsqueda</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEquipments.map((eq, idx) => {
                  const costWithIva = eq.taxExempt ? eq.baseCostCOP : Math.round(eq.baseCostCOP * 1.19);
                  return (
                    <tr key={`eq-row-${eq.id || eq.code || 'item'}-${idx}`} className="hover:bg-[#1e314b] transition">
                      <td className="p-3 font-mono font-bold text-[#38bdf8] whitespace-nowrap">
                        {eq.code}
                      </td>
                      <td className="p-3 max-w-xs">
                        <span className="font-bold text-white block">{eq.name}</span>
                        <span className="text-[11px] text-slate-400 line-clamp-1">{eq.category} • {eq.originCountry}</span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="text-white font-bold block">{eq.brand}</span>
                        <span className="text-slate-400 text-[11px]">{eq.model}</span>
                      </td>
                      <td className="p-3 text-slate-300 text-[11px] whitespace-nowrap">
                        {eq.supplier || <span className="text-slate-500 italic">No especificado</span>}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {(!eq.baseCostCOP || eq.baseCostCOP === 0) ? (
                           <div className="inline-flex flex-col items-end">
                            <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2 py-0.5 rounded">
                              <AlertTriangle className="w-2.5 h-2.5 animate-pulse" />
                              <span>Sin Costo</span>
                            </span>
                            {!isReadOnly && (
                              <button
                                onClick={() => onEditEquipment(eq)}
                                className="text-[9.5px] text-amber-300 hover:text-amber-100 hover:underline mt-0.5 cursor-pointer font-bold"
                              >
                                Definir costo
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="font-mono font-bold text-slate-200">
                            {formatCOP(eq.baseCostCOP)}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-black text-cyan-300 whitespace-nowrap">
                        {(!eq.baseCostCOP || eq.baseCostCOP === 0) ? (
                          <span className="text-slate-500 text-[11px] font-normal italic">Por calcular</span>
                        ) : (
                          <>
                            {formatCOP(costWithIva)}
                            {eq.taxExempt && <span className="block text-[9px] text-emerald-400">(0% Exento)</span>}
                          </>
                        )}
                      </td>
                      <td className="p-3 font-mono text-emerald-300 text-[11px] whitespace-nowrap">
                        {eq.invimaRecordNumber}
                      </td>
                      <td className="p-3 text-center text-slate-300 font-bold whitespace-nowrap">
                        {eq.warrantyMonths} m
                      </td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {!isReadOnly ? (
                            <>
                              <button
                                onClick={() => onEditEquipment(eq)}
                                className="p-1.5 text-amber-300 hover:text-amber-200 bg-amber-500/20 hover:bg-amber-500/35 rounded-lg border border-amber-500/30 cursor-pointer font-bold transition"
                                title="Editar todo (Costos, Proveedor, INVIMA, etc.)"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEquipmentToDelete(eq)}
                                className="p-1.5 text-rose-400 hover:text-rose-200 bg-rose-500/15 hover:bg-rose-500/30 rounded-lg border border-rose-500/30 cursor-pointer transition"
                                title="Eliminar del catálogo"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-500 italic">Solo lectura</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CLIENT PICKER MODAL (WHEN USER CLICKS + A LICITACIÓN) */}
      {selectedEqForTender && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-fadeIn"
        >
          <div className="bg-[#192b45] border border-purple-400/60 rounded-2xl max-w-4xl w-full p-4 sm:p-5 space-y-3.5 shadow-2xl animate-scaleUp max-h-[92vh] h-[88vh] flex flex-col overflow-hidden my-auto">
            <div className="flex items-center justify-between pb-2.5 border-b border-[#334d6e] shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-white truncate">
                    Seleccionar Cliente para Licitación
                  </h3>
                  <p className="text-[11px] text-slate-300 truncate">
                    Asignar equipo <strong className="text-purple-300">{selectedEqForTender.name}</strong> a un pliego
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEqForTender(null);
                    setClientModalSearch('');
                    setIsCreatingQuickClient(false);
                  }}
                  className="px-2.5 py-1 text-xs font-bold text-slate-300 hover:text-white hover:bg-red-500/20 hover:border-red-500/40 border border-[#334d6e] rounded-lg transition cursor-pointer flex items-center gap-1"
                  title="Cerrar ventana"
                >
                  <X className="w-3.5 h-3.5 text-red-400" />
                  <span className="hidden sm:inline">Cerrar</span>
                </button>
              </div>
            </div>

            {/* Search Input for Clients */}
            {tenderClients.length > 0 && (
              <div className="relative shrink-0">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={clientModalSearch}
                  onChange={(e) => setClientModalSearch(e.target.value)}
                  placeholder="Buscar cliente por nombre, NIT, proceso o ciudad..."
                  className="w-full bg-[#15253d] border border-[#334d6e] focus:border-purple-400 rounded-xl pl-9 pr-8 py-2 text-xs sm:text-sm text-white placeholder-slate-400 outline-none font-medium"
                />
                {clientModalSearch && (
                  <button
                    onClick={() => setClientModalSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* List of existing clients */}
            <div className="overflow-y-auto space-y-2.5 pr-1 flex-1 scrollbar-thin">
              {(() => {
                const filteredClients = tenderClients.filter((client) => {
                  if (!clientModalSearch.trim()) return true;
                  const q = clientModalSearch.toLowerCase();
                  return (
                    client.clientName.toLowerCase().includes(q) ||
                    (client.nit && client.nit.toLowerCase().includes(q)) ||
                    (client.header?.processNumber && client.header.processNumber.toLowerCase().includes(q)) ||
                    (client.header?.city && client.header.city.toLowerCase().includes(q))
                  );
                });

                if (filteredClients.length === 0) {
                  return (
                    <div className="bg-[#15253d] p-6 text-center rounded-xl border border-dashed border-[#334d6e] text-slate-400">
                      <p className="text-xs font-bold text-slate-300">
                        {tenderClients.length === 0
                          ? 'No hay clientes creados en Licitaciones'
                          : 'No se encontraron clientes con ese criterio de búsqueda'}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Cree un nuevo cliente en el formulario inferior para asignar este equipo.
                      </p>
                    </div>
                  );
                }

                return filteredClients.map((client) => {
                  const itemsCount = client.items?.length || 0;
                  const alreadyHasEq = client.items?.some(
                    (it) => it.equipmentId === selectedEqForTender.id || it.code === selectedEqForTender.code
                  );

                  return (
                    <div
                      key={client.id}
                      className="bg-[#15253d] border border-[#334d6e] hover:border-purple-400/80 rounded-xl p-3.5 flex items-center justify-between gap-3 transition shadow-sm"
                    >
                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
                            {client.header?.processNumber || 'Sin proceso'}
                          </span>
                          {client.header?.city && (
                            <span className="text-[10px] text-slate-300 bg-[#1e314b] px-2 py-0.5 rounded">
                              {client.header.city}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-white truncate">{client.clientName}</h4>
                        <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
                          {client.nit && <span>NIT: <strong className="text-slate-300">{client.nit}</strong></span>}
                          <span>• {itemsCount} {itemsCount === 1 ? 'equipo actual' : 'equipos actuales'}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleConfirmAddToClient(client.id, client.clientName)}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition cursor-pointer shadow-md shrink-0 ${
                          alreadyHasEq
                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                            : 'bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950'
                        }`}
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                        <span>{alreadyHasEq ? 'Agregar Otra Unidad' : 'Asignar a este Cliente'}</span>
                      </button>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Quick Create Client Section */}
            <div className="pt-3 border-t border-[#334d6e] shrink-0">
              {!isCreatingQuickClient ? (
                <button
                  type="button"
                  onClick={() => setIsCreatingQuickClient(true)}
                  className="w-full py-2.5 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-2 transition cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Crear Nuevo Cliente / Licitación Rápido</span>
                </button>
              ) : (
                <div className="p-4 bg-[#15253d] rounded-xl border border-purple-400/50 space-y-3 text-xs animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">Nuevo Cliente / Licitación:</span>
                    <button
                      type="button"
                      onClick={() => setIsCreatingQuickClient(false)}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className="text-[11px] text-slate-300 block mb-1 font-medium">Nombre de la Entidad / Cliente:</label>
                      <input
                        type="text"
                        placeholder="Ej: Hospital Universitario San Ignacio..."
                        value={quickClientName}
                        onChange={(e) => setQuickClientName(e.target.value)}
                        className="w-full bg-[#1e314b] border border-[#334d6e] rounded-xl px-3 py-2 text-white outline-none focus:border-purple-400 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-300 block mb-1 font-medium">NIT:</label>
                      <input
                        type="text"
                        placeholder="Ej: 900.123.456-7"
                        value={quickClientNit}
                        onChange={(e) => setQuickClientNit(e.target.value)}
                        className="w-full bg-[#1e314b] border border-[#334d6e] rounded-xl px-3 py-2 text-white outline-none focus:border-purple-400 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-300 block mb-1 font-medium">N° Proceso / Pliego:</label>
                      <input
                        type="text"
                        placeholder="Ej: LP-2026-09"
                        value={quickProcessNumber}
                        onChange={(e) => setQuickProcessNumber(e.target.value)}
                        className="w-full bg-[#1e314b] border border-[#334d6e] rounded-xl px-3 py-2 text-purple-300 outline-none focus:border-purple-400 font-mono font-bold text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      disabled={!quickClientName.trim()}
                      onClick={() => {
                        if (!quickClientName.trim()) return;
                        const newClientId = `cli-tend-${Date.now()}`;
                        const clientName = quickClientName.trim();
                        onAddToTender(selectedEqForTender, newClientId);
                        setSelectedEqForTender(null);
                        setAddedTenderFeedback({ eqName: selectedEqForTender.name, clientName });
                        setTimeout(() => setAddedTenderFeedback(null), 4500);
                      }}
                      className={`flex-1 py-2.5 rounded-xl font-black transition cursor-pointer text-xs ${
                        quickClientName.trim()
                          ? 'bg-purple-500 hover:bg-purple-600 text-white shadow-md'
                          : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      Crear Cliente y Asignar Equipo
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCreatingQuickClient(false)}
                      className="px-3.5 py-2.5 rounded-xl text-slate-400 hover:text-white bg-[#1e314b] text-xs font-bold"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Catalog Excel Import Center Modal */}
      <CatalogExcelImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        existingEquipments={equipments}
        onImportEquipments={(updatedCatalog, count, mode) => {
          if (onBatchImportEquipments) {
            onBatchImportEquipments(updatedCatalog, count, mode);
          }
          setImportSuccessFeedback({ count, mode });
          setTimeout(() => {
            setImportSuccessFeedback(null);
          }, 6000);
        }}
      />

      {/* Confirmation Modal for Equipment Deletion */}
      {equipmentToDelete && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2.5 sm:p-4 animate-fadeIn"
        >
          <div className="bg-[#192b45] border border-rose-500/50 rounded-2xl max-w-md w-full p-4 sm:p-5 space-y-3.5 shadow-2xl animate-scaleUp my-auto">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-black text-white">¿Eliminar este equipo del catálogo?</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Está a punto de eliminar <strong className="text-white font-bold">{equipmentToDelete.name}</strong> ({equipmentToDelete.code} - {equipmentToDelete.brand}).
                </p>
                <p className="text-[11px] text-slate-400 pt-0.5">
                  Esta acción retirará el equipo del catálogo maestro.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#334d6e]">
              <button
                type="button"
                onClick={() => setEquipmentToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#15253d] transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-lg active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, Eliminar Equipo</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirmation Modal for Clearing ALL Catalog Data (Protected with Admin Password) */}
      {isClearModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn"
        >
          <div className="bg-[#192b45] border border-rose-500/60 rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl animate-scaleUp my-auto">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="p-3 bg-rose-500/20 text-rose-400 border border-rose-500/40 rounded-xl shrink-0">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-white">¿Borrar todos los datos del Catálogo?</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Esta acción eliminará de forma permanente todos los <strong className="text-rose-300 font-bold">{equipments.length} equipos médicos</strong> registrados en el catálogo.
                </p>
              </div>
            </div>

            {/* Password Input Form */}
            <form onSubmit={handleConfirmClearAllData} className="space-y-3.5 pt-1">
              <div className="bg-[#15253d] p-3 rounded-xl border border-[#334d6e] space-y-2">
                <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-rose-400" />
                  Contraseña de Administrador (Admin)
                </label>
                <div className="relative">
                  <input
                    type={showClearPassword ? 'text' : 'password'}
                    autoFocus
                    value={adminPasswordInput}
                    onChange={(e) => {
                      setAdminPasswordInput(e.target.value);
                      if (clearPasswordError) setClearPasswordError(null);
                    }}
                    placeholder="Ingrese la contraseña de admin..."
                    className="w-full bg-[#1e314b] border border-[#334d6e] focus:border-rose-500 focus:ring-1 focus:ring-rose-500 rounded-xl px-3.5 py-2.5 text-white text-xs placeholder:text-slate-500 outline-none pr-10 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowClearPassword(!showClearPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showClearPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10.5px] text-slate-400">
                  Por seguridad, esta acción requiere la contraseña de la cuenta Administrador (<strong>221295</strong>).
                </p>
              </div>

              {clearPasswordError && (
                <div className="p-2.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-2 animate-fadeIn">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{clearPasswordError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#334d6e]">
                <button
                  type="button"
                  disabled={isClearingData}
                  onClick={() => setIsClearModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#15253d] transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isClearingData || !adminPasswordInput.trim()}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-white shadow-lg transition active:scale-95 cursor-pointer ${
                    isClearingData || !adminPasswordInput.trim()
                      ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                      : 'bg-rose-600 hover:bg-rose-700 border border-rose-500/50'
                  }`}
                >
                  {isClearingData ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Borrando datos...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirmar y Borrar Catálogo</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
