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
  Link2,
  FileText,
  CheckCircle2,
  Zap,
} from 'lucide-react';
import { googleWorkspaceService, DetectedSheetPart } from '../../services/googleWorkspaceService';
import { MedicalEquipment, AuthUser, TenderClientProject } from '../../types';
import { formatCOP } from '../../utils/formatters';
import { fetchLiveTRM, getCachedTRM, TrmData } from '../../utils/trmService';
import { CatalogExcelImportModal } from '../catalog/CatalogExcelImportModal';
import { downloadCatalogEquipmentTemplate } from '../../utils/excelImportUtils';
import { MASTER_EQUIPMENTS_CATALOG } from '../../data/masterEquipmentsCatalog';
import { verifyAdminPassword } from '../../data/authData';
import {
  getPendingCatalogEquipments,
  deletePendingCatalogEquipment,
  markPendingAsCreated,
  PendingCatalogEquipment,
} from '../../utils/pendingEquipmentsStorage';
import { autoRegisterSuppliersFromEquipments } from '../../utils/ocTrackingStorage';
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

  // SubTab: Catálogo General vs Pendientes por Crear
  const [catalogSubTab, setCatalogSubTab] = useState<'catalog' | 'pending'>('catalog');
  const [pendingEquipments, setPendingEquipments] = useState<PendingCatalogEquipment[]>(() =>
    getPendingCatalogEquipments()
  );

  useEffect(() => {
    const handleUpdate = () => {
      setPendingEquipments(getPendingCatalogEquipments());
    };
    window.addEventListener('syd-pending-equipments-updated', handleUpdate);
    return () => window.removeEventListener('syd-pending-equipments-updated', handleUpdate);
  }, []);

  const [pendingSearchQuery, setPendingSearchQuery] = useState('');

  const filteredPendingEquipments = useMemo(() => {
    // ONLY show items that are still pending! Once created, they disappear from here and go to Catálogo Maestro
    const pendingOnly = pendingEquipments.filter(
      (p) => p.status !== 'creado' && p.status !== 'created' && p.status !== 'descartado'
    );
    if (!pendingSearchQuery.trim()) return pendingOnly;
    const q = pendingSearchQuery.toLowerCase();
    return pendingOnly.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q) ||
        p.model.toLowerCase().includes(q) ||
        (p.clientOrigin && p.clientOrigin.toLowerCase().includes(q)) ||
        (p.quoteOrigin && p.quoteOrigin.toLowerCase().includes(q))
    );
  }, [pendingEquipments, pendingSearchQuery]);

  // Drive N-FCO-03 Parts detection & linking
  const [driveParts, setDriveParts] = useState<DetectedSheetPart[]>(() => {
    try {
      const raw = localStorage.getItem('syd_detected_sheet_parts_v1');
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  });

  const [linkingPendingItem, setLinkingPendingItem] = useState<PendingCatalogEquipment | null>(null);
  const [drivePartModalSearch, setDrivePartModalSearch] = useState('');
  const [driveEmpalmeAlert, setDriveEmpalmeAlert] = useState<string | null>(null);

  // Helper to find candidate matches in Drive N-FCO-03 (excluding already created parts)
  const findDriveCandidatesForPending = (pending: PendingCatalogEquipment): DetectedSheetPart[] => {
    if (!driveParts || driveParts.length === 0) return [];
    const existingCodes = new Set(
      equipments.map((e) => (e.code || '').trim().toLowerCase()).filter(Boolean)
    );
    let locallyCreatedCodes = new Set<string>();
    try {
      const raw = localStorage.getItem('syd_created_sheet_parts_v1');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          locallyCreatedCodes = new Set(arr.map((c: string) => String(c).trim().toLowerCase()));
        }
      }
    } catch (_) {}

    const cleanName = (pending.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const cleanModel = (pending.model || '').toLowerCase().trim();
    const cleanBrand = (pending.brand || '').toLowerCase().trim();
    const tokens = cleanName
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !['para', 'con', 'del', 'los', 'las', 'una', 'equipo'].includes(t));

    return driveParts.filter((dp) => {
      const dpCode = (dp.code || '').trim().toLowerCase();
      // Only exclude parts that are ALREADY created in Catálogo Maestro
      if (!dpCode || existingCodes.has(dpCode) || locallyCreatedCodes.has(dpCode)) return false;

      const dpDesc = (dp.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const dpModel = (dp.model || '').toLowerCase();
      const dpBrand = (dp.brand || '').toLowerCase();

      if (cleanModel && cleanModel.length >= 2 && (dpModel.includes(cleanModel) || dpDesc.includes(cleanModel))) return true;
      if (cleanBrand && dpBrand.includes(cleanBrand) && tokens.some((t) => dpDesc.includes(t))) return true;
      const matchedTokens = tokens.filter((t) => dpDesc.includes(t)).length;
      if (tokens.length >= 2 && matchedTokens >= 2) return true;
      return false;
    });
  };

  const handleEmpalmarWithDrivePart = (pendingItem: PendingCatalogEquipment, drivePart: DetectedSheetPart) => {
    try {
      const finalCode = (drivePart.code || '').trim();
      if (!finalCode) {
        alert('La parte seleccionada no tiene código asignado en Drive.');
        return;
      }

      const cleanSupplier = (drivePart.supplier || '').trim() || 'TECNICA';
      const cleanBrand = (drivePart.brand || '').trim() || pendingItem.brand;
      const cleanModel = (drivePart.model || '').trim() || pendingItem.model || 'Estándar';
      const cleanName = (drivePart.name || '').trim() || pendingItem.name;
      const cleanInvima = (drivePart.invimaRegister || '').trim() || 'No Aplica';
      const costValue = drivePart.costCOP && drivePart.costCOP > 0 ? drivePart.costCOP : pendingItem.baseCostCOP;

      const newEq: MedicalEquipment = {
        id: `eq-drive-${finalCode.replace(/[^a-zA-Z0-9_-]/g, '_')}-${Date.now()}`,
        code: finalCode,
        name: cleanName,
        brand: cleanBrand,
        model: cleanModel,
        supplier: cleanSupplier,
        baseCostCOP: costValue,
        category: (drivePart.category as any) || 'Diagnóstico',
        productGroup: 'Equipos Médicos',
        invimaRecordNumber: cleanInvima,
        warrantyMonths: 24,
        taxExempt: (drivePart.hasIVA || '').toLowerCase().includes('no') || (drivePart.hasIVA || '').toLowerCase().includes('0'),
        originCountry: 'Colombia',
        description: `Equipo biomédico oficial ${cleanName} (${cleanBrand} ${cleanModel}), empalmado y creado desde el formato N-FCO-03 de Drive para solicitud de cotización.`,
        technicalSpecs: [
          `Código de Parte Oficial: ${finalCode}`,
          `Proveedor Oficial: ${cleanSupplier}`,
          `Marca: ${cleanBrand}`,
          `Modelo: ${cleanModel}`,
          `Registro Sanitario INVIMA: ${cleanInvima}`,
          `Origen: Empalmado con N-FCO-03 (Cotizado inicialmente para ${pendingItem.clientOrigin || 'cliente'})`,
        ],
        standardAccessories: [],
        sourceOrigin: `pending-id:${pendingItem.id}`,
      };

      // 1. Auto-register supplier in Supplier Directory
      autoRegisterSuppliersFromEquipments([newEq]);

      // 2. Add to equipments catalog in localStorage and dispatch event
      const stored = localStorage.getItem('syd_equipments_catalog');
      let catalogList: MedicalEquipment[] = stored ? JSON.parse(stored) : [...equipments];
      catalogList = [newEq, ...catalogList.filter((e) => (e.code || '').trim().toLowerCase() !== finalCode.toLowerCase())];
      localStorage.setItem('syd_equipments_catalog', JSON.stringify(catalogList));
      window.dispatchEvent(new CustomEvent('syd-catalog-updated', { detail: { catalog: catalogList } }));

      // 3. Mark pending item as created
      markPendingAsCreated(pendingItem.id, newEq.id, finalCode);

      // 4. Update drive parts state and localStorage so it is marked as created
      const updatedDriveParts = driveParts.map((dp) =>
        (dp.code || '').trim().toLowerCase() === finalCode.toLowerCase()
          ? { ...dp, status: 'creado', action: 'Creado' }
          : dp
      );
      setDriveParts(updatedDriveParts);
      try {
        localStorage.setItem('syd_detected_sheet_parts_v1', JSON.stringify(updatedDriveParts));
        const rawCodes = localStorage.getItem('syd_created_sheet_parts_v1');
        const arrCodes: string[] = rawCodes ? JSON.parse(rawCodes) : [];
        if (!arrCodes.includes(finalCode)) {
          arrCodes.push(finalCode);
          localStorage.setItem('syd_created_sheet_parts_v1', JSON.stringify(arrCodes));
          window.dispatchEvent(new CustomEvent('syd-created-sheet-parts-updated', { detail: arrCodes }));
        }
      } catch (_) {}

      // 5. Update UI
      setPendingEquipments(getPendingCatalogEquipments());
      setLinkingPendingItem(null);
      setDriveEmpalmeAlert(`¡Equipo "${cleanName}" empalmado exitosamente con la Parte #${finalCode} de Drive y creado en el Catálogo Maestro!`);
      setTimeout(() => setDriveEmpalmeAlert(null), 5000);
    } catch (err: any) {
      console.error('Error empalmando equipo con Drive:', err);
      alert('Ocurrió un error al empalmar la parte con Drive.');
    }
  };

  const handleCreateFromPending = (item: PendingCatalogEquipment) => {
    const draft: MedicalEquipment = {
      id: '',
      code: '',
      name: item.name,
      brand: item.brand,
      model: item.model,
      category: 'Monitoreo',
      baseCostCOP: item.baseCostCOP,
      description: `Equipo ${item.name} (${item.brand} ${item.model}) cotizado de emergencia para ${item.clientOrigin || 'cliente'}.`,
      technicalSpecs: [
        `Marca: ${item.brand}`,
        `Modelo: ${item.model}`,
        `Origen: Cotización de emergencia (${item.quoteOrigin || 'Cotización'})`,
      ],
      standardAccessories: [],
      originCountry: 'Colombia',
      warrantyMonths: 12,
      invimaRecordNumber: '',
      sourceOrigin: `pending-id:${item.id}`,
    };
    onEditEquipment(draft);
  };

  const handleDeletePending = (id: string) => {
    deletePendingCatalogEquipment(id);
    setPendingEquipments(getPendingCatalogEquipments());
  };

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
        <div className="p-3 bg-[var(--syd-accent)] text-slate-950 border border-sky-300 rounded-xl text-xs font-bold flex flex-wrap items-center justify-between gap-3 shadow-xl animate-scaleUp">
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

      {/* SubTab Switcher: Catálogo Maestro vs Pendientes por Crear */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 bg-[#15253d] border border-[#334d6e] rounded-2xl shadow-inner">
          <button
            type="button"
            onClick={() => setCatalogSubTab('catalog')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              catalogSubTab === 'catalog'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Catálogo Maestro ({equipments.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setCatalogSubTab('pending')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer relative ${
              catalogSubTab === 'pending'
                ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className={`w-4 h-4 ${catalogSubTab === 'pending' ? 'text-slate-950' : 'text-amber-400'}`} />
            <span>Pendientes por Crear</span>
            {pendingEquipments.filter((p) => p.status === 'pending').length > 0 && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                  catalogSubTab === 'pending'
                    ? 'bg-slate-950 text-amber-300'
                    : 'bg-amber-500 text-slate-950 animate-pulse'
                }`}
              >
                {pendingEquipments.filter((p) => p.status === 'pending').length}
              </span>
            )}
          </button>
        </div>

        {catalogSubTab === 'pending' && (
          <div className="text-xs text-amber-300/90 font-bold flex items-center gap-1.5 bg-amber-950/40 px-3 py-1.5 rounded-xl border border-amber-500/40">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Equipos cotizados de emergencia para formalizar en catálogo</span>
          </div>
        )}
      </div>

      {/* RENDER CATALOG MAESTRO */}
      {catalogSubTab === 'catalog' && (
        <>
          {/* Unified Search, Filter & Action Bar */}
          <div className="bg-[#1e314b]/95 backdrop-blur-md border border-[#334d6e] rounded-2xl p-3.5 sm:p-4 space-y-3.5 shadow-xl sticky top-0 z-20">
        {/* Row 1: Search (Left) + Filters, View Switcher & TRM (Right) */}
        <div className="view-toolbar">
          {/* Search Input */}
          <div className="view-toolbar-group">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              id="search-catalog-input"
              type="text"
              placeholder="Buscar por equipo, parte, proveedor, marca, modelo o INVIMA..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#15253d] border border-[#334d6e] focus:border-[var(--syd-accent)] focus:ring-1 focus:ring-[var(--syd-accent)] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-400 outline-none font-medium transition"
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
          </div>

          {/* Right Tools: Brand Filter + View Mode Switcher + Live TRM Badge */}
          <div className="view-toolbar-group" data-label="Vista y divisa">
            {/* Brand Filter */}
            <div className="flex items-center gap-1.5 text-xs">
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
            <div className="flex items-center gap-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'grid' ? 'bg-[var(--syd-accent)] text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
                title="Vista de Tarjetas"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition cursor-pointer ${
                  viewMode === 'table' ? 'bg-[var(--syd-accent)] text-slate-950 font-bold shadow-sm' : 'text-slate-400 hover:text-white'
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
                className="bg-[#15253d] hover:bg-[#1b3150] border border-[#334d6e] hover:border-[var(--syd-accent)]/60 px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs transition cursor-pointer shadow-xs select-none"
                title="Haga clic para ver el análisis de volatilidad y la TRM recomendada para cotizaciones"
              >
                <Globe className="w-3.5 h-3.5 text-[var(--syd-accent)]" />
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
                  className="absolute right-0 mt-1.5 w-84 bg-[#0f1a2a] border border-[var(--syd-accent)]/70 rounded-xl shadow-2xl p-3 z-50 text-xs text-white animate-fadeIn"
                >
                  <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-[#334d6e]">
                    <span className="font-bold text-[var(--syd-accent)] flex items-center gap-1.5 text-xs">
                      <Globe className="w-4 h-4 text-[var(--syd-accent)]" />
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
        <div className="view-toolbar view-toolbar--stack">
          {/* Category Pills */}
          <div className="view-toolbar-group" data-label="Categoría">
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
          </div>

          {/* Action Buttons Group (Importar / Exportar Excel, Borrar Datos, Nuevo Equipo) - Aligned to the Right */}
          <div className="view-toolbar-group" data-label="Acciones">
            {!isReadOnly ? (
              <>
                <button
                  id="btn-import-catalog-excel"
                  onClick={() => setIsImportModalOpen(true)}
                  className="inline-flex items-center gap-1.5 bg-[#15253d] hover:bg-[#1f375a] text-slate-100 border border-[var(--syd-accent)]/60 hover:border-[var(--syd-accent)] font-bold text-xs px-3 py-2 rounded-xl shadow-xs transition cursor-pointer whitespace-nowrap active:scale-95"
                  title="Importar masivamente desde archivo Excel (.xlsx / .xls)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-[var(--syd-accent)]" />
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
                  className="inline-flex items-center gap-1.5 bg-[var(--syd-accent)] hover:bg-[var(--syd-accent-light)] text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl shadow-md transition cursor-pointer whitespace-nowrap active:scale-95"
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
                    className="inline-flex items-center gap-1.5 bg-[#1e314b] hover:bg-[#253d5e] text-slate-200 border border-[var(--syd-accent)]/40 hover:border-[var(--syd-accent)] font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs active:scale-95"
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
                  className="bg-[#1e314b] border border-[#334d6e] hover:border-[var(--syd-accent)]/70 rounded-xl p-3.5 flex flex-col justify-between transition-all duration-200 shadow-md group relative hover:shadow-lg"
                >
                  <div className="space-y-2.5">
                    {/* Name */}
                    <h3 className="text-xs font-bold text-white group-hover:text-[var(--syd-accent)] transition line-clamp-2 leading-snug">
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
                          <Building2 className="w-3 h-3 text-[var(--syd-accent)] shrink-0" />
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
              <FileSpreadsheet className="w-4 h-4 text-[var(--syd-accent)]" />
              <span className="text-xs font-bold text-white">
                Vista de Catálogo en Tabla — <strong className="text-[var(--syd-accent)]">{filteredEquipments.length} Equipos</strong>
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

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10">
                <tr className="bg-[#121f33] text-slate-300 font-bold border-b border-[#334d6e] text-[11px] shadow-xs">
                  <th className="py-2 px-2 min-w-[95px]">
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
                  <th className="py-2 px-2 min-w-[180px]">
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
                  <th className="py-2 px-2 min-w-[120px]">
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
                  <th className="py-2 px-2 min-w-[120px]">
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
                  <th className="py-2 px-2 min-w-[100px] text-right">
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
                  <th className="py-2 px-2 min-w-[100px] text-right">
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
                  <th className="py-2 px-2 min-w-[100px]">
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
                  <th className="py-2 px-2 min-w-[80px] text-center">
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
                  <th className="py-2 px-2 text-center w-20 whitespace-nowrap">Acciones</th>
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
                            className="inline-flex items-center gap-1.5 bg-[#1e314b] hover:bg-[#253d5e] text-slate-200 border border-[var(--syd-accent)]/40 hover:border-[var(--syd-accent)] font-bold text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-xs active:scale-95"
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
                      <td className="p-3 font-mono font-bold text-[var(--syd-accent)] whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{eq.code}</span>
                          {eq.isInactive && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-950 text-rose-300 border border-rose-600/70 select-none">
                              🚫 Inactiva N-FCO-03
                            </span>
                          )}
                        </div>
                        {eq.replacedPartCode && (
                          <span className="text-[10px] text-cyan-300 block font-normal mt-0.5">
                            ↳ Reemplaza: {eq.replacedPartCode}
                          </span>
                        )}
                        {eq.replacementPartCode && (
                          <span className="text-[10px] text-amber-300 block font-normal mt-0.5">
                            ↳ Reemplazada por: {eq.replacementPartCode}
                          </span>
                        )}
                      </td>
                      <td className="p-3 max-w-xs">
                        <span className="font-bold text-white block">{eq.name}</span>
                        {eq.isInactive && eq.inactivationReason && (
                          <span className="text-[10px] text-rose-300 italic block">{eq.inactivationReason}</span>
                        )}
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
        </>
      )}

      {/* RENDER PENDIENTES POR CREAR VIEW */}
      {catalogSubTab === 'pending' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Feedback banner when empalmado with Drive */}
          {driveEmpalmeAlert && (
            <div className="p-3 bg-emerald-950/90 border border-emerald-500 rounded-xl text-emerald-200 text-xs font-bold flex items-center justify-between gap-3 shadow-xl animate-scaleUp">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 stroke-[3]" />
                <span>{driveEmpalmeAlert}</span>
              </div>
              <button
                onClick={() => setDriveEmpalmeAlert(null)}
                className="bg-emerald-900/50 hover:bg-emerald-900 text-emerald-200 px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          )}

          {/* Search bar & count */}
          <div className="bg-[#1e314b]/95 backdrop-blur-md border border-[#334d6e] rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xl">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por equipo, marca, modelo, cliente u origen..."
                value={pendingSearchQuery}
                onChange={(e) => setPendingSearchQuery(e.target.value)}
                className="w-full bg-[#15253d] border border-[#334d6e] focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-400 outline-none font-medium transition"
              />
              {pendingSearchQuery && (
                <button
                  type="button"
                  onClick={() => setPendingSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs p-0.5 cursor-pointer"
                  title="Limpiar"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="text-xs text-slate-300 font-bold shrink-0 flex items-center gap-2">
              <span className="px-3 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl">
                {filteredPendingEquipments.length} {filteredPendingEquipments.length === 1 ? 'Equipo' : 'Equipos'}
              </span>
            </div>
          </div>

          {/* Pending Table */}
          <div className="bg-[#192b45] border border-[#334d6e] rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#121f33] text-slate-300 font-bold border-b border-[#334d6e] text-[11px]">
                    <th className="p-3 text-center w-12">#</th>
                    <th className="p-3">Equipo Biomédico</th>
                    <th className="p-3">Marca / Modelo</th>
                    <th className="p-3 text-center">Cant.</th>
                    <th className="p-3 text-right">Costo Unit. Base (COP)</th>
                    <th className="p-3 text-right">P. Venta Sugerido (COP)</th>
                    <th className="p-3">Origen / Cotización</th>
                    <th className="p-3">Fecha</th>
                    <th className="p-3 text-center">Estado</th>
                    <th className="p-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#334d6e]/50">
                  {filteredPendingEquipments.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-12 text-center text-slate-400">
                        <Sparkles className="w-8 h-8 text-amber-400/50 mx-auto mb-2" />
                        <p className="font-bold text-white text-sm">
                          {pendingSearchQuery
                            ? 'No se encontraron equipos pendientes con esa búsqueda'
                            : 'No hay equipos cotizados de emergencia pendientes por crear'}
                        </p>
                        <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                          Cuando ingrese un requerimiento urgente desde la Cotización Comercial usando el botón <strong className="text-amber-300">"⚡ Cotizar No Creado (Emergencia)"</strong>, aparecerá listado aquí automáticamente para su formalización oficial.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredPendingEquipments.map((p, idx) => {
                      const isCreated = p.status === 'creado' || p.status === 'created';
                      const isPending = !isCreated && p.status !== 'descartado';
                      const driveCandidates = isPending ? findDriveCandidatesForPending(p) : [];
                      const topDriveMatch = driveCandidates.length > 0 ? driveCandidates[0] : null;

                      return (
                        <tr key={p.id} className="hover:bg-[#1e314b] transition">
                          <td className="p-3 text-center font-mono text-slate-400 font-bold">{idx + 1}</td>
                          <td className="p-3">
                            <span className="font-bold text-white block text-sm">{p.name}</span>
                            <span className="text-[10px] text-amber-400/90 font-medium">⚡ Equipo no catalogado</span>
                            {topDriveMatch && isPending && (
                              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap animate-fadeIn">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-sky-950 text-sky-300 border border-sky-500/50">
                                  <Link2 className="w-2.5 h-2.5 text-sky-400" />
                                  <span>En Drive: Parte #{topDriveMatch.code} ({topDriveMatch.supplier || topDriveMatch.brand})</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleEmpalmarWithDrivePart(p, topDriveMatch)}
                                  className="px-2 py-0.5 rounded text-[10px] font-black bg-sky-500 hover:bg-sky-400 text-slate-950 transition cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
                                  title={`Empalmar inmediatamente con la Parte #${topDriveMatch.code} (${topDriveMatch.name}) del formato N-FCO-03 en Drive`}
                                >
                                  <Zap className="w-2.5 h-2.5 fill-current" />
                                  <span>Empalmar ya</span>
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded text-[10px] border border-blue-500/30">
                              {p.brand}
                            </span>
                            <span className="block text-slate-300 text-xs mt-0.5">{p.model}</span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="bg-slate-800 text-slate-200 font-bold px-2 py-1 rounded text-xs">
                              {p.quantity} ud
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-200">
                            {formatCOP(p.baseCostCOP)}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-emerald-400">
                            {formatCOP(p.suggestedSellingPriceCOP || Math.round(p.baseCostCOP * 1.5874))}
                          </td>
                          <td className="p-3">
                            <span className="text-slate-200 font-medium block">{p.clientOrigin || 'Cliente Directo'}</span>
                            <span className="text-[10px] text-slate-400">{p.quoteOrigin || 'Cotización'}</span>
                          </td>
                          <td className="p-3 text-slate-400 text-[11px] whitespace-nowrap">
                            {p.quotedAt ? new Date(p.quotedAt).toLocaleDateString('es-CO') : 'Hoy'}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            {isCreated ? (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-950 text-emerald-300 border border-emerald-600/70 inline-flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span>Creado ({p.createdEquipmentCode || 'Catálogo'})</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-950 text-amber-300 border border-amber-600/70 inline-flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-amber-400" />
                                <span>Pendiente por Crear</span>
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {isPending && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleCreateFromPending(p)}
                                    className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow transition cursor-pointer flex items-center gap-1.5 active:scale-95 whitespace-nowrap"
                                    title="Abrir formulario oficial completo para ingresar proveedor, código de parte, INVIMA y archivarlo en el catálogo"
                                  >
                                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                    <span>Crear en Catálogo</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setLinkingPendingItem(p);
                                      setDrivePartModalSearch(p.model || p.brand || p.name);
                                    }}
                                    className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer flex items-center gap-1.5 active:scale-95 whitespace-nowrap"
                                    title="Buscar y enlazar con parte oficial en Google Drive (N-FCO-03)"
                                  >
                                    <Link2 className="w-3.5 h-3.5" />
                                    <span>Enlazar con Drive</span>
                                  </button>
                                </>
                              )}
                              {isCreated && (
                                <span className="text-[11px] font-bold text-emerald-400 px-2 py-1 bg-emerald-950/60 border border-emerald-500/40 rounded-lg">
                                  ✓ En Catálogo Maestro
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeletePending(p.id)}
                                className="p-1.5 text-rose-400 hover:text-rose-200 bg-rose-500/15 hover:bg-rose-500/30 rounded-lg border border-rose-500/30 cursor-pointer transition"
                                title="Descartar este equipo pendiente"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
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
                            : 'bg-[var(--syd-accent)] hover:bg-[var(--syd-accent-light)] text-slate-950'
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

      {/* MODAL PARA ENLAZAR / EMPALMAR CON PARTE DE GOOGLE DRIVE (N-FCO-03) */}
      {linkingPendingItem && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fadeIn">
          <div className="bg-[#192b45] border border-sky-400/60 rounded-2xl max-w-4xl w-full p-5 space-y-4 shadow-2xl animate-scaleUp max-h-[90vh] h-[85vh] flex flex-col overflow-hidden my-auto">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#334d6e] shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-500/40">
                  <Link2 className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <span>Empalmar con Parte en Google Drive (N-FCO-03)</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-sky-950 text-sky-300 border border-sky-500/50">
                      Oficial SyD
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    Seleccione la parte creada en el formato N-FCO-03 para asociarla a <strong>"{linkingPendingItem.name}"</strong> ({linkingPendingItem.brand} - {linkingPendingItem.model})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLinkingPendingItem(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Item info pill */}
            <div className="bg-[#121f33] p-3 rounded-xl border border-[#334d6e] flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-xs">
                <span className="text-slate-400">Equipo Cotizado: </span>
                <strong className="text-amber-300">{linkingPendingItem.name}</strong>
                <span className="text-slate-400 ml-2">Marca: </span>
                <strong className="text-white">{linkingPendingItem.brand}</strong>
                <span className="text-slate-400 ml-2">Modelo: </span>
                <strong className="text-white">{linkingPendingItem.model}</strong>
                <span className="text-slate-400 ml-2">Costo Cotizado: </span>
                <strong className="text-emerald-400 font-mono">{formatCOP(linkingPendingItem.baseCostCOP)}</strong>
              </div>
              <span className="text-[11px] text-slate-400">
                Cliente: <strong>{linkingPendingItem.clientOrigin || 'Cliente Directo'}</strong>
              </span>
            </div>

            {/* Search Input */}
            <div className="relative shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Buscar parte en Drive por código (#), descripción, marca, modelo o proveedor..."
                value={drivePartModalSearch}
                onChange={(e) => setDrivePartModalSearch(e.target.value)}
                className="w-full bg-[#15253d] border border-sky-500/50 focus:border-sky-400 rounded-xl pl-9 pr-8 py-2.5 text-xs text-white placeholder-slate-400 outline-none"
              />
              {drivePartModalSearch && (
                <button
                  type="button"
                  onClick={() => setDrivePartModalSearch('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white text-xs p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Table of Drive Parts */}
            <div className="flex-1 overflow-y-auto border border-[#334d6e] rounded-xl bg-[#15253d] scrollbar-thin">
              {(() => {
                const existingCodes = new Set(
                  equipments.map((e) => (e.code || '').trim().toLowerCase()).filter(Boolean)
                );
                let locallyCreatedCodes = new Set<string>();
                try {
                  const raw = localStorage.getItem('syd_created_sheet_parts_v1');
                  if (raw) {
                    const arr = JSON.parse(raw);
                    if (Array.isArray(arr)) {
                      locallyCreatedCodes = new Set(arr.map((c: string) => String(c).trim().toLowerCase()));
                    }
                  }
                } catch (_) {}

                const query = drivePartModalSearch.toLowerCase().trim();
                const filteredParts = driveParts.filter((dp) => {
                  const dpCode = (dp.code || '').trim().toLowerCase();
                  if (!dpCode) return false;
                  // Only parts that are NOT yet created in the Catálogo Maestro
                  if (existingCodes.has(dpCode) || locallyCreatedCodes.has(dpCode)) return false;

                  if (!query) return true;
                  return (
                    dpCode.includes(query) ||
                    (dp.name || '').toLowerCase().includes(query) ||
                    (dp.brand || '').toLowerCase().includes(query) ||
                    (dp.model || '').toLowerCase().includes(query) ||
                    (dp.supplier || '').toLowerCase().includes(query) ||
                    (dp.invimaRegister || '').toLowerCase().includes(query)
                  );
                });

                if (filteredParts.length === 0) {
                  return (
                    <div className="p-8 text-center text-slate-400 space-y-2">
                      <FileText className="w-8 h-8 text-slate-500 mx-auto" />
                      <p className="text-sm font-bold text-white">No se encontraron partes en N-FCO-03 con ese filtro</p>
                      <p className="text-xs text-slate-400">Intente con palabras clave como el modelo, marca o código de parte.</p>
                    </div>
                  );
                }

                return (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-[#121f33] text-slate-300 font-bold border-b border-[#334d6e] z-10 text-[11px]">
                      <tr>
                        <th className="p-2.5 text-center">Parte #</th>
                        <th className="p-2.5">Descripción de la Parte</th>
                        <th className="p-2.5">Marca / Modelo</th>
                        <th className="p-2.5">Proveedor</th>
                        <th className="p-2.5">Reg. INVIMA</th>
                        <th className="p-2.5 text-right">Costo COP</th>
                        <th className="p-2.5 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#334d6e]/50">
                      {filteredParts.map((dp) => (
                        <tr key={`${dp.code}-${dp.rowNumber}`} className="hover:bg-[#1e314b] transition">
                          <td className="p-2.5 text-center font-mono font-black text-sky-300">
                            #{dp.code}
                          </td>
                          <td className="p-2.5">
                            <span className="font-bold text-white block">{dp.name}</span>
                            <span className="text-[10px] text-slate-400">{dp.requestType || 'CREACION'}</span>
                          </td>
                          <td className="p-2.5">
                            <span className="text-blue-300 font-bold text-[10px] bg-blue-500/20 px-1.5 py-0.5 rounded border border-blue-500/30">
                              {dp.brand || 'N/A'}
                            </span>
                            <span className="block text-slate-300 text-xs mt-0.5">{dp.model || '-'}</span>
                          </td>
                          <td className="p-2.5 text-slate-300 font-medium">
                            {dp.supplier || 'TECNICA'}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-300">
                            {dp.invimaRegister || 'No Aplica'}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-400">
                            {dp.costCOP && dp.costCOP > 0 ? formatCOP(dp.costCOP) : 'Consultar'}
                          </td>
                          <td className="p-2.5 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleEmpalmarWithDrivePart(linkingPendingItem, dp)}
                              className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-xs rounded-xl shadow transition cursor-pointer flex items-center gap-1 active:scale-95"
                              title="Empalmar automáticamente con esta parte oficial de Drive"
                            >
                              <Zap className="w-3.5 h-3.5 fill-current" />
                              <span>Empalmar</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-[#334d6e] shrink-0">
              <span className="text-xs text-slate-400">
                Total partes oficiales detectadas en N-FCO-03: <strong className="text-sky-300">{driveParts.length}</strong>
              </span>
              <button
                type="button"
                onClick={() => setLinkingPendingItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#15253d] transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
