import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Sliders,
  DollarSign,
  TrendingUp,
  Percent,
  Plus,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  HelpCircle,
  PackagePlus,
  Check,
  Target,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Layers,
  ShoppingCart,
  Settings,
  ChevronDown,
  ChevronUp,
  Lock,
  Unlock,
  Edit3,
  Search,
  X,
  Filter,
  Eye,
  EyeOff,
  RotateCcw,
  Globe,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { QuoteItem, MarginListKey, MedicalEquipment, AuthUser, QuoteItemAccessory, QuoteHeader } from '../../types';
import { MARGIN_LISTS } from '../../data/initialData';
import { formatCOP } from '../../utils/formatters';
import { fetchLiveTRM, getCachedTRM, TrmData } from '../../utils/trmService';
import { addPendingCatalogEquipment } from '../../utils/pendingEquipmentsStorage';
import {
  ExcelColumnConfig,
  ExcelColumnHeader,
  useExcelTableFilters,
} from '../common/ExcelTableFilter';

export type CostTableColumnKey =
  | 'index'
  | 'equipment'
  | 'unitCost'
  | 'factor'
  | 'profit'
  | 'unitSalePrice'
  | 'tax'
  | 'discount'
  | 'quantity'
  | 'subtotal'
  | 'totalWithIva'
  | 'actions';

export interface ColumnConfig {
  key: CostTableColumnKey;
  label: string;
  defaultVisible: boolean;
  alwaysVisible?: boolean;
}

export const ALL_COST_COLUMNS: ColumnConfig[] = [
  { key: 'index', label: '#', defaultVisible: true },
  { key: 'equipment', label: 'Equipo & Marca', defaultVisible: true, alwaysVisible: true },
  { key: 'unitCost', label: 'Costo Base Unit.', defaultVisible: true },
  { key: 'factor', label: 'Factor / Lista', defaultVisible: true },
  { key: 'profit', label: 'Ganancia', defaultVisible: true },
  { key: 'unitSalePrice', label: 'P. Venta Unit.', defaultVisible: true },
  { key: 'tax', label: 'IVA', defaultVisible: true },
  { key: 'discount', label: 'Desc.%', defaultVisible: true },
  { key: 'quantity', label: 'Cant.', defaultVisible: true },
  { key: 'subtotal', label: 'Subtotal', defaultVisible: true },
  { key: 'totalWithIva', label: 'Total c/IVA', defaultVisible: true },
  { key: 'actions', label: 'Acciones', defaultVisible: true },
];

export const DEFAULT_COLUMN_VISIBILITY: Record<CostTableColumnKey, boolean> = {
  index: true,
  equipment: true,
  unitCost: true,
  factor: true,
  profit: true,
  unitSalePrice: true,
  tax: true,
  discount: true,
  quantity: true,
  subtotal: true,
  totalWithIva: true,
  actions: true,
};

export const COLUMN_LABELS: Record<CostTableColumnKey, string> = {
  index: '#',
  equipment: 'Equipo & Marca',
  unitCost: 'Costo Base Unit.',
  factor: 'Factor / Lista',
  profit: 'Ganancia',
  unitSalePrice: 'P. Venta Unit.',
  tax: 'IVA',
  discount: 'Desc.%',
  quantity: 'Cant.',
  subtotal: 'Subtotal',
  totalWithIva: 'Total c/IVA',
  actions: 'Acciones',
};

export const getCostTableExcelColumns = (defaultTaxRate: number): ExcelColumnConfig<QuoteItem>[] => [
  {
    id: 'index',
    label: '#',
    type: 'number',
    accessor: (row) => row.id,
    align: 'center',
    minWidth: '35px',
    disableFilter: true,
  },
  {
    id: 'equipment',
    label: 'Equipo & Marca',
    type: 'text',
    accessor: (row) => `${row.name || ''} ${row.brand || ''} ${row.model || ''}`.trim(),
    minWidth: '180px',
  },
  {
    id: 'unitCost',
    label: 'Costo Base Unit.',
    type: 'number',
    accessor: (row) => row.unitCostCOP || 0,
    formatter: (val) => formatCOP(Number(val) || 0),
    align: 'right',
    minWidth: '120px',
  },
  {
    id: 'factor',
    label: 'Factor / Lista',
    type: 'text',
    accessor: (row) =>
      row.marginType === 'custom'
        ? `Personalizado (${(row.multiplier || row.customFactor || 1).toFixed(2)})`
        : `${row.marginType} (${MARGIN_LISTS[row.marginType]?.label || ''})`,
    minWidth: '120px',
  },
  {
    id: 'profit',
    label: 'Ganancia',
    type: 'number',
    accessor: (row) => (row.unitSalePrice || 0) - (row.unitCostCOP || 0),
    formatter: (val) => formatCOP(Number(val) || 0),
    align: 'right',
    minWidth: '95px',
  },
  {
    id: 'unitSalePrice',
    label: 'P. Venta Unit.',
    type: 'number',
    accessor: (row) => row.unitSalePrice || 0,
    formatter: (val) => formatCOP(Number(val) || 0),
    align: 'right',
    minWidth: '130px',
  },
  {
    id: 'tax',
    label: 'IVA',
    type: 'text',
    accessor: (row) => {
      if (row.taxExempt) return '0% (Exento)';
      const eff =
        row.taxRate !== undefined
          ? row.taxRate > 1
            ? row.taxRate
            : Math.round(row.taxRate * 100)
          : defaultTaxRate > 1
          ? defaultTaxRate
          : Math.round(defaultTaxRate * 100);
      return `${eff}%`;
    },
    align: 'center',
    minWidth: '80px',
  },
  {
    id: 'discount',
    label: 'Desc.%',
    type: 'number',
    accessor: (row) => row.discountPercentage || 0,
    formatter: (val) => `${val}%`,
    align: 'center',
    minWidth: '60px',
  },
  {
    id: 'quantity',
    label: 'Cant.',
    type: 'number',
    accessor: (row) => row.quantity || 0,
    align: 'center',
    minWidth: '55px',
  },
  {
    id: 'subtotal',
    label: 'Subtotal',
    type: 'number',
    accessor: (row) => row.totalSalePrice || 0,
    formatter: (val) => formatCOP(Number(val) || 0),
    align: 'right',
    minWidth: '110px',
  },
  {
    id: 'totalWithIva',
    label: 'Total c/IVA',
    type: 'number',
    accessor: (row) => {
      const rate = row.taxExempt
        ? 0
        : row.taxRate !== undefined
        ? row.taxRate > 1
          ? row.taxRate / 100
          : row.taxRate
        : defaultTaxRate > 1
        ? defaultTaxRate / 100
        : defaultTaxRate;
      return (row.totalSalePrice || 0) + Math.round((row.totalSalePrice || 0) * rate);
    },
    formatter: (val) => formatCOP(Number(val) || 0),
    align: 'right',
    minWidth: '120px',
  },
];

interface CostManagerViewProps {
  quoteItems: QuoteItem[];
  equipments: MedicalEquipment[];
  taxRate: number;
  quoteHeader?: QuoteHeader;
  onUpdateItem: (id: string, updates: Partial<QuoteItem>) => void;
  onDeleteItem: (id: string) => void;
  onNavigateToSales: () => void;
  onAddItemFromEquipment: (equipment: MedicalEquipment) => void;
  onAddCustomQuoteItem?: (item: QuoteItem) => void;
  onUpdateEquipmentBaseCost?: (equipmentIdOrCode: string, newCost: number) => void;
  currentUser?: AuthUser | null;
}

export const CostManagerView: React.FC<CostManagerViewProps> = ({
  quoteItems,
  equipments,
  taxRate,
  quoteHeader,
  onUpdateItem,
  onDeleteItem,
  onNavigateToSales,
  onAddItemFromEquipment,
  onAddCustomQuoteItem,
  onUpdateEquipmentBaseCost,
  currentUser,
}) => {
  const isReadOnly = currentUser?.role === 'viewer' && !currentUser?.permissions?.canEditCostManager;
  const [globalFactorType, setGlobalFactorType] = useState<MarginListKey>('L4');
  const [customGlobalFactorStr, setCustomGlobalFactorStr] = useState<string>('2.0000');

  // Emergency uncreated equipment modal state (Cotización rápida de equipos no registrados)
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyBrand, setEmergencyBrand] = useState('');
  const [emergencyModel, setEmergencyModel] = useState('');
  const [emergencyQuantity, setEmergencyQuantity] = useState<number>(1);
  const [emergencyCostCOP, setEmergencyCostCOP] = useState<number | ''>('');
  const [emergencyFactorType, setEmergencyFactorType] = useState<MarginListKey>('L4');
  const [editingAccessoryId, setEditingAccessoryId] = useState<string | null>(null);
  const [openCeilingItemId, setOpenCeilingItemId] = useState<string | null>(null);
  const [factorInputStrings, setFactorInputStrings] = useState<Record<string, string>>({});
  const [manualPriceInputStrings, setManualPriceInputStrings] = useState<Record<string, string>>({});
  const [editingManualPriceItemIds, setEditingManualPriceItemIds] = useState<Record<string, boolean>>({});
  const [manualCostInputStrings, setManualCostInputStrings] = useState<Record<string, string>>({});
  const [ceilingInputStrings, setCeilingInputStrings] = useState<Record<string, string>>({});
  const [expandedCostBeforeIva, setExpandedCostBeforeIva] = useState<Record<string, boolean>>({});
  const [hideSummaryHeaders, setHideSummaryHeaders] = useState(false);
  const [actionAlert, setActionAlert] = useState<{ msg: string; type: 'success' | 'info' } | null>(null);
  const [isAddEquipmentDrawerOpen, setIsAddEquipmentDrawerOpen] = useState(false);
  const [costSearchQuery, setCostSearchQuery] = useState('');
  const [costCategoryFilter, setCostCategoryFilter] = useState('Todos');
  const [selectedEquipmentToAdd, setSelectedEquipmentToAdd] = useState<string>(equipments[0]?.id || '');

  // Floating hover popover for accessory list (rendered via portal to avoid table overflow cutoff)
  const [hoveredAccessoryInfo, setHoveredAccessoryInfo] = useState<{
    item: QuoteItem;
    rect: DOMRect;
  } | null>(null);

  // Live TRM & Currency Protection state
  const [trmData, setTrmData] = useState<TrmData>(() => getCachedTRM());
  const [isRefreshingTrm, setIsRefreshingTrm] = useState(false);
  const [isTrmPopoverOpen, setIsTrmPopoverOpen] = useState(false);

  const handleRefreshTrm = async () => {
    setIsRefreshingTrm(true);
    try {
      const data = await fetchLiveTRM();
      setTrmData(data);
    } catch (e) {
      console.error('Error refreshing TRM:', e);
    } finally {
      setIsRefreshingTrm(false);
    }
  };

  // Column Visibility state persisted in localStorage
  const [columnVisibility, setColumnVisibility] = useState<Record<CostTableColumnKey, boolean>>(() => {
    try {
      const saved = localStorage.getItem('equimed_cost_table_columns_v3');
      if (saved) {
        return { ...DEFAULT_COLUMN_VISIBILITY, ...JSON.parse(saved) };
      }
    } catch (e) {
      // fallback
    }
    return DEFAULT_COLUMN_VISIBILITY;
  });

  const [isColumnManagerOpen, setIsColumnManagerOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    columnKey: CostTableColumnKey;
  } | null>(null);

  // Close context menu, column manager, TRM popover, drawer on click outside or escape, and sync TRM in background
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setIsColumnManagerOpen(false);
        setIsAddEquipmentDrawerOpen(false);
        setIsTrmPopoverOpen(false);
        setHoveredAccessoryInfo(null);
        setOpenCeilingItemId(null);
        setCostSearchQuery('');
      }
    };
    const handleTrmUpdated = (e: any) => {
      if (e.detail) {
        setTrmData(e.detail);
      }
    };

    window.addEventListener('click', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('syd_trm_updated', handleTrmUpdated);
    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('syd_trm_updated', handleTrmUpdated);
    };
  }, []);

  const handleToggleColumn = (colKey: CostTableColumnKey) => {
    if (colKey === 'equipment') return; // Always keep equipment column visible
    setColumnVisibility((prev) => {
      const updated = { ...prev, [colKey]: !prev[colKey] };
      try {
        localStorage.setItem('equimed_cost_table_columns_v3', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleHideColumn = (colKey: CostTableColumnKey) => {
    if (colKey === 'equipment') return;
    setColumnVisibility((prev) => {
      const updated = { ...prev, [colKey]: false };
      try {
        localStorage.setItem('equimed_cost_table_columns_v3', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    setContextMenu(null);
    setActionAlert({
      msg: `Columna "${COLUMN_LABELS[colKey]}" ocultada. Puede reactivarla en "Columnas".`,
      type: 'info',
    });
    setTimeout(() => setActionAlert(null), 3500);
  };

  const handleCreateEmergencyQuoteItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emergencyName.trim()) {
      alert('Por favor ingrese el Nombre del equipo.');
      return;
    }
    if (!emergencyBrand.trim()) {
      alert('Por favor ingrese la Marca del equipo.');
      return;
    }
    if (!emergencyModel.trim()) {
      alert('Por favor ingrese el Modelo del equipo.');
      return;
    }
    const cost = typeof emergencyCostCOP === 'number' ? emergencyCostCOP : 0;
    if (cost <= 0) {
      alert('Por favor ingrese un Precio costo mayor a cero.');
      return;
    }
    const qty = Math.max(1, Number(emergencyQuantity) || 1);
    const factorCfg = MARGIN_LISTS[emergencyFactorType] || MARGIN_LISTS.L4;
    const factorMultiplier = factorCfg.multiplier;
    const unitSalePrice = Math.round(cost * factorMultiplier);

    // 1. Register in pending equipments storage for Ventana 3 (Catálogo)
    const pendingRecord = addPendingCatalogEquipment({
      name: emergencyName.trim(),
      brand: emergencyBrand.trim(),
      model: emergencyModel.trim(),
      quantityQuoted: qty,
      baseCostCOP: cost,
      suggestedSalePriceCOP: unitSalePrice,
      appliedFactorKey: emergencyFactorType,
      quoteOrigin: quoteHeader?.quoteNumber ? `Cotización ${quoteHeader.quoteNumber}` : 'Cotización Comercial',
      clientOrigin: quoteHeader?.clientName || 'Cliente en Cotización',
      quotedDate: new Date().toISOString(),
    });

    // 2. Build QuoteItem with emergency uncreated flag
    const newQuoteItem: QuoteItem = {
      id: `emergency-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      code: 'PENDIENTE',
      name: emergencyName.trim().toUpperCase(),
      brand: emergencyBrand.trim().toUpperCase(),
      model: emergencyModel.trim().toUpperCase(),
      description: `Equipo cotizado de emergencia. Pendiente de registro oficial en Catálogo.`,
      briefDescription: `Equipo cotizado de emergencia (${emergencyBrand.trim().toUpperCase()} ${emergencyModel.trim().toUpperCase()})`,
      technicalFeatures: [
        `Marca: ${emergencyBrand.trim().toUpperCase()}`,
        `Modelo: ${emergencyModel.trim().toUpperCase()}`,
        `Estado: Pendiente de Registro Oficial en Catálogo`,
      ],
      quantity: qty,
      unitCostCOP: cost,
      totalCost: cost * qty,
      multiplier: factorMultiplier,
      marginType: emergencyFactorType,
      unitSalePrice: unitSalePrice,
      totalSalePrice: unitSalePrice * qty,
      taxExempt: false,
      taxRate: taxRate,
      warrantyMonths: 12,
      isEmergencyUncreated: true,
      pendingCatalogId: pendingRecord.id,
      accessories: [],
    };

    if (onAddCustomQuoteItem) {
      onAddCustomQuoteItem(newQuoteItem);
    } else {
      const tempEq: MedicalEquipment = {
        id: `temp-${Date.now()}`,
        code: 'PENDIENTE',
        name: emergencyName.trim().toUpperCase(),
        brand: emergencyBrand.trim().toUpperCase(),
        model: emergencyModel.trim().toUpperCase(),
        category: 'Equipos Médicos',
        baseCostCOP: cost,
        description: `Equipo cotizado de emergencia. Pendiente de registro oficial en Catálogo.`,
        technicalSpecs: [],
        standardAccessories: [],
        originCountry: 'Colombia',
        warrantyMonths: 12,
      };
      onAddItemFromEquipment(tempEq);
    }

    // Reset form & close
    setEmergencyName('');
    setEmergencyBrand('');
    setEmergencyModel('');
    setEmergencyQuantity(1);
    setEmergencyCostCOP('');
    setIsEmergencyModalOpen(false);

    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
    } catch (_) {}

    setActionAlert({
      msg: `¡Equipo "${emergencyName.trim().toUpperCase()}" cotizado exitosamente y registrado en «Pendientes por Crear» de Catálogo!`,
      type: 'success',
    });
    setTimeout(() => setActionAlert(null), 6000);
  };

  const handleShowAllColumns = () => {
    setColumnVisibility(DEFAULT_COLUMN_VISIBILITY);
    try {
      localStorage.setItem('equimed_cost_table_columns_v3', JSON.stringify(DEFAULT_COLUMN_VISIBILITY));
    } catch (e) {}
    setContextMenu(null);
    setActionAlert({
      msg: 'Todas las columnas están ahora visibles.',
      type: 'success',
    });
    setTimeout(() => setActionAlert(null), 3000);
  };

  const handleHeaderContextMenu = (e: React.MouseEvent, colKey: CostTableColumnKey) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      columnKey: colKey,
    });
  };

  const visibleColumnCount = Object.values(columnVisibility).filter(Boolean).length;

  // Excel Table Filters Hook for Main Cost Table
  const costTableColumns = useMemo(() => getCostTableExcelColumns(taxRate), [taxRate]);

  const {
    filteredRows: filteredQuoteItems,
    filters: excelFilters,
    sort: excelSort,
    onApplyFilter,
    onApplySort,
    onClearColumnFilter,
    onResetAllFilters,
    isFilteredOrSorted,
  } = useExcelTableFilters(quoteItems, costTableColumns);

  // Handle ESC key press to close modal
  useEffect(() => {
    if (!isAddEquipmentDrawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAddEquipmentDrawerOpen(false);
        setCostSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddEquipmentDrawerOpen]);

  // State for creating new accessory in the active item's accessory panel
  const [newAccForm, setNewAccForm] = useState<{
    itemId: string | null;
    name: string;
    quantity: number;
    unitCostCOP: string;
    includedInBase: boolean;
  }>({
    itemId: null,
    name: '',
    quantity: 1,
    unitCostCOP: '',
    includedInBase: false,
  });

  // Helper to parse decimal factors safely (supports "2,00", "2.00", "2.0000", etc.)
  const parseFactorValue = (val: string | number): number => {
    if (typeof val === 'number') return isNaN(val) ? 2.0 : val;
    const sanitized = val.toString().replace(',', '.').trim();
    const parsed = parseFloat(sanitized);
    return isNaN(parsed) ? 2.0 : parsed;
  };

  // Helper to format factor with 4 decimal places
  const formatFactor = (factor: number): string => {
    return Number(factor).toFixed(4);
  };

  // Centralized helper to update active accessories on an item
  const recalculateItemWithAccessories = (
    item: QuoteItem,
    newAccessories: QuoteItemAccessory[]
  ) => {
    onUpdateItem(item.id, {
      accessories: newAccessories,
    });
  };

  // Add new accessory to an item
  const handleAddAccessoryToItem = (item: QuoteItem) => {
    if (!newAccForm.name.trim()) {
      setActionAlert({
        msg: 'Por favor ingrese el nombre del accesorio.',
        type: 'info',
      });
      setTimeout(() => setActionAlert(null), 3000);
      return;
    }

    const cleanCost = parseInt(newAccForm.unitCostCOP.replace(/[^0-9]/g, ''), 10) || 0;
    const qty = Math.max(1, newAccForm.quantity || 1);

    const newAcc: QuoteItemAccessory = {
      id: `acc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: newAccForm.name.trim(),
      quantity: qty,
      unitCostCOP: cleanCost,
      includedInBase: newAccForm.includedInBase,
    };

    const currentAccs = item.accessories || [];
    const updatedAccs = [...currentAccs, newAcc];

    recalculateItemWithAccessories(item, updatedAccs);

    setNewAccForm({
      itemId: item.id,
      name: '',
      quantity: 1,
      unitCostCOP: '',
      includedInBase: false,
    });

    setActionAlert({
      msg: `Accesorio "${newAcc.name}" agregado. Precio recalculado con lista de precios.`,
      type: 'success',
    });
    setTimeout(() => setActionAlert(null), 3200);
  };

  // Modify an accessory property
  const handleUpdateAccessoryField = (
    item: QuoteItem,
    accId: string,
    field: keyof QuoteItemAccessory,
    value: any
  ) => {
    const currentAccs = item.accessories || [];
    const updatedAccs = currentAccs.map((acc) => {
      if (acc.id === accId) {
        return { ...acc, [field]: value };
      }
      return acc;
    });

    recalculateItemWithAccessories(item, updatedAccs);
  };

  // Delete an accessory
  const handleDeleteAccessoryFromItem = (item: QuoteItem, accId: string) => {
    const currentAccs = item.accessories || [];
    const accToDelete = currentAccs.find((a) => a.id === accId);
    const updatedAccs = currentAccs.filter((a) => a.id !== accId);

    recalculateItemWithAccessories(item, updatedAccs);

    setActionAlert({
      msg: `Accesorio "${accToDelete?.name || ''}" eliminado de ${item.name}.`,
      type: 'info',
    });
    setTimeout(() => setActionAlert(null), 3000);
  };

  // Restore standard accessories from catalog
  const handleRestoreStandardAccessories = (item: QuoteItem) => {
    const catalogEq = equipments.find((e) => e.id === item.equipmentId);
    if (!catalogEq) return;

    const stdAccs: QuoteItemAccessory[] = catalogEq.standardAccessories.map((a, idx) => ({
      id: `acc-std-${idx}-${Date.now()}`,
      name: a.name,
      quantity: 1,
      unitCostCOP: a.costCOP || 0,
      includedInBase: a.included,
    }));

    recalculateItemWithAccessories(item, stdAccs);

    setActionAlert({
      msg: `Accesorios estándar restablecidos para ${item.name}.`,
      type: 'success',
    });
    setTimeout(() => setActionAlert(null), 3000);
  };

  // Toggle manual sale price mode for an item
  const handleToggleManualSalePrice = (item: QuoteItem, enableManual: boolean) => {
    if (enableManual) {
      const currentPrice = item.manualSalePriceCOP || item.unitSalePrice;
      setManualPriceInputStrings((prev) => ({
        ...prev,
        [item.id]: currentPrice.toString(),
      }));
      setEditingManualPriceItemIds((prev) => ({
        ...prev,
        [item.id]: true,
      }));

      onUpdateItem(item.id, {
        isManualSalePrice: true,
        manualSalePriceCOP: currentPrice,
        unitSalePrice: currentPrice,
      });

      setActionAlert({
        msg: `Modo de Precio Manual activado para "${item.name}". Digite el precio y presione INTRO para fijarlo.`,
        type: 'info',
      });
      setTimeout(() => setActionAlert(null), 3200);
    } else {
      setEditingManualPriceItemIds((prev) => ({
        ...prev,
        [item.id]: false,
      }));

      onUpdateItem(item.id, {
        isManualSalePrice: false,
      });

      setActionAlert({
        msg: `Precio de venta restablecido a cálculo automático (${item.marginType === 'custom' ? 'Factor Libre' : MARGIN_LISTS[item.marginType]?.label || 'Lista'}).`,
        type: 'success',
      });
      setTimeout(() => setActionAlert(null), 3200);
    }
  };

  // Handle typing custom price in manual mode (allows erasing full number cleanly)
  const handleManualPriceInputChange = (item: QuoteItem, rawVal: string) => {
    setManualPriceInputStrings((prev) => ({ ...prev, [item.id]: rawVal }));

    if (rawVal.trim() === '') {
      return;
    }

    const sanitized = rawVal.replace(/[^0-9]/g, '');
    if (sanitized === '') return;
    const priceNum = parseInt(sanitized, 10);

    if (!isNaN(priceNum) && priceNum >= 0) {
      onUpdateItem(item.id, {
        isManualSalePrice: true,
        manualSalePriceCOP: priceNum,
        unitSalePrice: priceNum,
      });
    }
  };

  // Commit and lock manual price with Enter key or blur
  const handleCommitAndLockManualPrice = (item: QuoteItem) => {
    const rawVal = manualPriceInputStrings[item.id];
    let priceNum = item.unitSalePrice;

    if (rawVal !== undefined && rawVal.trim() !== '') {
      const sanitized = rawVal.replace(/[^0-9]/g, '');
      if (sanitized !== '') {
        priceNum = parseInt(sanitized, 10);
      }
    } else if (rawVal !== undefined && rawVal.trim() === '') {
      priceNum = 0;
    }

    onUpdateItem(item.id, {
      isManualSalePrice: true,
      manualSalePriceCOP: priceNum,
      unitSalePrice: priceNum,
    });

    setManualPriceInputStrings((prev) => ({ ...prev, [item.id]: priceNum.toString() }));
    setEditingManualPriceItemIds((prev) => ({ ...prev, [item.id]: false }));

    setActionAlert({
      msg: `Precio manual fijado en $ ${formatCOP(priceNum)} para "${item.name}".`,
      type: 'success',
    });
    setTimeout(() => setActionAlert(null), 3000);
  };

  // Handle direct unit base cost change (allows erasing full number cleanly & syncs with Ventana 3 Catálogo)
  const handleDirectUnitCostChange = (item: QuoteItem, rawVal: string) => {
    setManualCostInputStrings((prev) => ({ ...prev, [item.id]: rawVal }));

    if (rawVal.trim() === '') {
      return;
    }

    const sanitized = rawVal.replace(/[^0-9]/g, '');
    if (sanitized === '') return;
    const costNum = parseInt(sanitized, 10);

    if (!isNaN(costNum) && costNum >= 0) {
      onUpdateItem(item.id, {
        unitCostCOP: costNum,
      });
    }
  };

  const handleDirectUnitCostBlur = (item: QuoteItem) => {
    const rawVal = manualCostInputStrings[item.id];
    if (rawVal !== undefined) {
      if (rawVal.trim() === '') {
        onUpdateItem(item.id, {
          unitCostCOP: 0,
        });
        setManualCostInputStrings((prev) => ({ ...prev, [item.id]: '0' }));
      } else {
        const sanitized = rawVal.replace(/[^0-9]/g, '');
        const costNum = parseInt(sanitized, 10);
        if (!isNaN(costNum) && costNum >= 0) {
          setManualCostInputStrings((prev) => ({ ...prev, [item.id]: costNum.toString() }));
          onUpdateItem(item.id, {
            unitCostCOP: costNum,
          });
        }
      }
    }
  };

  // Handle free custom factor input with precision (retains user typing like "2.", "2,0", "2.1524")
  const handleCustomFactorInputChange = (item: QuoteItem, rawVal: string) => {
    setFactorInputStrings((prev) => ({ ...prev, [item.id]: rawVal }));

    if (rawVal.trim() === '') return;

    const sanitized = rawVal.replace(',', '.').trim();
    const parsedNum = parseFloat(sanitized);

    if (!isNaN(parsedNum) && parsedNum >= 0) {
      onUpdateItem(item.id, {
        isManualSalePrice: false,
        marginType: 'custom',
        customFactor: parsedNum,
        multiplier: parsedNum,
      });
    }
  };

  const handleCustomFactorBlur = (item: QuoteItem) => {
    const rawVal = factorInputStrings[item.id];
    if (rawVal !== undefined) {
      if (rawVal.trim() === '') {
        const fallback = item.multiplier || 2.0;
        setFactorInputStrings((prev) => ({ ...prev, [item.id]: fallback.toFixed(4) }));
      } else {
        const sanitized = rawVal.replace(',', '.').trim();
        const parsedNum = parseFloat(sanitized);
        if (!isNaN(parsedNum) && parsedNum > 0) {
          setFactorInputStrings((prev) => ({ ...prev, [item.id]: parsedNum.toFixed(4) }));
        } else {
          const fallback = item.multiplier || 2.0;
          setFactorInputStrings((prev) => ({ ...prev, [item.id]: fallback.toFixed(4) }));
        }
      }
    }
  };

  // Apply global factor to all items in active quote
  const handleApplyGlobalFactor = () => {
    const globalMultiplier =
      globalFactorType === 'custom'
        ? parseFactorValue(customGlobalFactorStr)
        : MARGIN_LISTS[globalFactorType]?.multiplier || 1.5;

    quoteItems.forEach((item) => {
      onUpdateItem(item.id, {
        isManualSalePrice: false,
        marginType: globalFactorType,
        customFactor: globalFactorType === 'custom' ? globalMultiplier : undefined,
        multiplier: globalMultiplier,
      });
    });

    // Reset local inputs to match
    if (globalFactorType === 'custom') {
      const formatted = globalMultiplier.toFixed(4);
      const newMap: Record<string, string> = {};
      quoteItems.forEach((it) => {
        newMap[it.id] = formatted;
      });
      setFactorInputStrings(newMap);
    }

    setActionAlert({
      msg: `Factor masivo aplicado exitosamente a todos los equipos (${globalMultiplier.toFixed(4)}x).`,
      type: 'success',
    });
    setTimeout(() => setActionAlert(null), 3500);
  };

  const handleItemFactorChange = (
    item: QuoteItem,
    newMarginType: MarginListKey,
    customFactorInput?: number | string
  ) => {
    let multiplier = item.multiplier;
    let customFactorNumber: number | undefined = undefined;

    if (newMarginType === 'custom') {
      if (customFactorInput !== undefined) {
        multiplier = parseFactorValue(customFactorInput);
        customFactorNumber = multiplier;
      } else {
        multiplier = item.customFactor !== undefined ? item.customFactor : 2.0;
        customFactorNumber = multiplier;
      }
      setFactorInputStrings((prev) => ({ ...prev, [item.id]: multiplier.toFixed(4) }));
    } else if (MARGIN_LISTS[newMarginType]) {
      multiplier = MARGIN_LISTS[newMarginType].multiplier;
      customFactorNumber = undefined;
    }

    onUpdateItem(item.id, {
      isManualSalePrice: false,
      marginType: newMarginType,
      customFactor: customFactorNumber,
      multiplier,
    });
  };

  const handleDiscountChange = (item: QuoteItem, discount: number) => {
    onUpdateItem(item.id, {
      discountPercentage: discount,
    });
  };

  // Handle Ceiling Price (Tope de Precio)
  const handleToggleCeilingPrice = (item: QuoteItem, enabled: boolean) => {
    const accessoriesExtraCost = (item.accessories || [])
      .filter((a) => !a.includedInBase)
      .reduce((sum, a) => sum + (Number(a.unitCostCOP) || 0) * (Number(a.quantity) || 1), 0);
    const effectiveCost = item.unitCostCOP + accessoriesExtraCost;

    const defaultCeiling =
      item.ceilingPriceCOP !== undefined && item.ceilingPriceCOP > 0
        ? item.ceilingPriceCOP
        : Math.round(effectiveCost * 1.5);

    onUpdateItem(item.id, {
      hasCeilingPrice: enabled,
      ceilingPriceCOP: defaultCeiling,
    });
    setCeilingInputStrings((prev) => ({ ...prev, [item.id]: defaultCeiling.toString() }));
    if (enabled) {
      setOpenCeilingItemId(item.id);
    }
  };

  const handleCeilingInputChange = (item: QuoteItem, rawVal: string) => {
    setCeilingInputStrings((prev) => ({ ...prev, [item.id]: rawVal }));
    const clean = rawVal.replace(/[^0-9]/g, '');
    if (clean !== '') {
      const num = parseInt(clean, 10);
      onUpdateItem(item.id, {
        ceilingPriceCOP: isNaN(num) ? 0 : num,
      });
    } else {
      onUpdateItem(item.id, {
        ceilingPriceCOP: 0,
      });
    }
  };

  const handleCeilingInputBlur = (item: QuoteItem) => {
    const currentStr = ceilingInputStrings[item.id];
    if (currentStr === undefined) return;
    const clean = currentStr.replace(/[^0-9]/g, '');
    const num = clean === '' ? 0 : parseInt(clean, 10);
    onUpdateItem(item.id, {
      ceilingPriceCOP: num,
    });
    setCeilingInputStrings((prev) => ({ ...prev, [item.id]: num === 0 ? '0' : num.toString() }));
  };

  const handleUpdateCeilingPriceValue = (item: QuoteItem, ceilingValue: number) => {
    onUpdateItem(item.id, {
      ceilingPriceCOP: ceilingValue,
    });
    setCeilingInputStrings((prev) => ({ ...prev, [item.id]: ceilingValue.toString() }));
  };

  // Apply the Ceiling Price as the exact Sale Price
  const handleApplyCeilingPriceAsSale = (item: QuoteItem) => {
    if (!item.ceilingPriceCOP) return;
    const accessoriesExtraCost = (item.accessories || [])
      .filter((a) => !a.includedInBase)
      .reduce((sum, a) => sum + a.unitCostCOP * a.quantity, 0);
    const effectiveCost = item.unitCostCOP + accessoriesExtraCost;

    if (effectiveCost <= 0) return;

    const calculatedFactor = parseFloat((item.ceilingPriceCOP / effectiveCost).toFixed(4));
    const unitSalePrice = item.ceilingPriceCOP;

    setFactorInputStrings((prev) => ({ ...prev, [item.id]: calculatedFactor.toFixed(4) }));

    onUpdateItem(item.id, {
      isManualSalePrice: true,
      manualSalePriceCOP: unitSalePrice,
      unitSalePrice,
      marginType: 'custom',
      customFactor: calculatedFactor,
      multiplier: calculatedFactor,
      discountPercentage: 0,
    });

    setActionAlert({
      msg: `Precio Techo de ${formatCOP(unitSalePrice)} aplicado como precio de venta para ${item.name}.`,
      type: 'success',
    });
    setTimeout(() => setActionAlert(null), 3500);
  };

  // Apply recommended standard list that fits under ceiling price
  const handleApplyRecommendedListForCeiling = (item: QuoteItem, listKey: MarginListKey) => {
    handleItemFactorChange(item, listKey);
  };

  // Helper to analyze ceiling price vs standard lists with full L1-L8 simulation
  const analyzeCeilingPrice = (effectiveCost: number, ceilingPrice: number) => {
    if (effectiveCost <= 0 || ceilingPrice <= 0) {
      return {
        factor: 1.0,
        profitCOP: 0,
        profitPercent: 0,
        bestFittingList: null as MarginListKey | null,
        closestList: 'L4' as MarginListKey,
        isBelowCost: false,
        allListsComparison: [] as Array<{
          key: MarginListKey;
          label: string;
          multiplier: number;
          description: string;
          calculatedPrice: number;
          differenceCOP: number;
          profitCOP: number;
          profitPercent: number;
          status: 'exact' | 'under' | 'over';
          isBestFit: boolean;
          isClosest: boolean;
        }>,
      };
    }

    const exactProfitCOP = ceilingPrice - effectiveCost;
    const exactProfitPercent = (exactProfitCOP / effectiveCost) * 100;
    const ceilingFactor = ceilingPrice / effectiveCost;
    const isBelowCost = ceilingPrice < effectiveCost;

    const listEntries = Object.entries(MARGIN_LISTS) as [
      MarginListKey,
      { label: string; multiplier: number; description: string }
    ][];

    let bestFittingList: MarginListKey | null = null;
    let closestList: MarginListKey = 'L1';
    let minDiff = Infinity;
    let maxMultiplierUnderCeiling = -1;

    // First pass to determine bestFit and closest
    listEntries.forEach(([key, cfg]) => {
      const calcPrice = Math.round(effectiveCost * cfg.multiplier);
      const diff = Math.abs(calcPrice - ceilingPrice);

      if (calcPrice <= ceilingPrice && cfg.multiplier > maxMultiplierUnderCeiling) {
        maxMultiplierUnderCeiling = cfg.multiplier;
        bestFittingList = key;
      }

      if (diff < minDiff) {
        minDiff = diff;
        closestList = key;
      }
    });

    const allListsComparison = listEntries.map(([key, cfg]) => {
      const calculatedPrice = Math.round(effectiveCost * cfg.multiplier);
      const differenceCOP = calculatedPrice - ceilingPrice;
      const profitCOP = calculatedPrice - effectiveCost;
      const profitPercent = (profitCOP / effectiveCost) * 100;

      let status: 'exact' | 'under' | 'over' = 'under';
      if (Math.abs(differenceCOP) < 500) {
        status = 'exact';
      } else if (calculatedPrice > ceilingPrice) {
        status = 'over';
      }

      return {
        key,
        label: cfg.label,
        multiplier: cfg.multiplier,
        description: cfg.description,
        calculatedPrice,
        differenceCOP,
        profitCOP,
        profitPercent,
        status,
        isBestFit: key === bestFittingList,
        isClosest: key === closestList,
      };
    });

    return {
      factor: ceilingFactor,
      profitCOP: exactProfitCOP,
      profitPercent: exactProfitPercent,
      bestFittingList,
      closestList,
      isBelowCost,
      allListsComparison,
    };
  };

  // Action: "A Cotizar" (Passes to Tab 1 Word Table directly)
  const handleSendItemToQuote = (item: QuoteItem) => {
    confetti({
      particleCount: 35,
      spread: 50,
      origin: { y: 0.6 },
    });

    setActionAlert({
      msg: `¡"${item.name}" transferido exitosamente a la Cotización (Hoja 1 de Word)!`,
      type: 'success',
    });

    // Automatically navigate to Sales Tab so user sees it in the Word document table immediately
    setTimeout(() => {
      onNavigateToSales();
    }, 600);
  };

  const handleAddEquipmentFromCatalog = (equipmentToInsert?: MedicalEquipment) => {
    const eq = equipmentToInsert || equipments.find((e) => e.id === selectedEquipmentToAdd);
    if (eq) {
      const existing = quoteItems.find((it) => it.equipmentId === eq.id || (eq.code && it.code === eq.code));
      if (existing) {
        const nextQty = (existing.quantity || 1) + 1;
        onUpdateItem(existing.id, {
          quantity: nextQty,
          totalCost: (existing.unitCostCOP || 0) * nextQty,
          totalSalePrice: (existing.unitSalePrice || 0) * nextQty,
        });
        setActionAlert({
          msg: `✓ +1 unidad agregada a "${eq.name}" (Total: ${nextQty} uds en cotización).`,
          type: 'success',
        });
      } else {
        onAddItemFromEquipment(eq);
        setActionAlert({
          msg: `✓ Equipo "${eq.name}" agregado al Gestor de Costos (1 ud).`,
          type: 'success',
        });
      }
      setTimeout(() => setActionAlert(null), 3000);
    }
  };

  const totalCostAccumulated = quoteItems.reduce((acc, it) => acc + it.totalCost, 0);
  const totalCostIVA = quoteItems.reduce((acc, it) => {
    const rate = it.taxExempt ? 0 : (it.taxRate !== undefined ? it.taxRate : taxRate);
    return acc + Math.round(it.totalCost * rate);
  }, 0);
  const totalCostWithIVA = totalCostAccumulated + totalCostIVA;

  const totalSaleSubtotal = quoteItems.reduce((acc, it) => acc + it.totalSalePrice, 0);
  const totalProfitCOP = totalSaleSubtotal - totalCostAccumulated;
  const overallMarginPercentage =
    totalCostAccumulated > 0 ? ((totalProfitCOP / totalCostAccumulated) * 100).toFixed(1) : '0.0';
  
  const totalIva = quoteItems.reduce((acc, it) => {
    const rate = it.taxExempt ? 0 : (it.taxRate !== undefined ? it.taxRate : taxRate);
    return acc + Math.round(it.totalSalePrice * rate);
  }, 0);
  const totalWithIva = totalSaleSubtotal + totalIva;

  return (
    <div id="cost-manager-container" className="space-y-4 animate-fadeIn">
      {/* Read-Only Mode Banner for Investigator */}
      {isReadOnly && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Modo Consulta Activo (Usuario Investigador):</strong> Puede revisar el desglose de costos, listas de factores y simulación de precios. La aplicación de nuevos factores, modificación de precios manuales y eliminación de equipos está restringida al Administrador.
            </span>
          </div>
          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-md text-[10px] font-bold border border-emerald-500/40 uppercase whitespace-nowrap">
            Solo Lectura
          </span>
        </div>
      )}

      {/* Sleek Top Bar with Centered Global Factor & Add Cost Controls + KPI Summary */}
      <div className="sticky top-0 z-20 bg-[var(--syd-body-bg,#0b1523)]/95 pt-1 pb-2 space-y-2 backdrop-blur-md">
        {/* Compact Top Action Bar: Global Factor, Add Cost, Client selector */}
        <div className="view-toolbar bg-[#192b45] border border-[#334d6e] rounded-xl p-2.5 sm:p-3 shadow-md">
        {/* Left: Global Factor Applicator (Admin Only or Disabled) */}
        {!isReadOnly ? (
          <div className="view-toolbar-group" data-label="Factor global">
            <div className="flex items-center gap-1 text-xs font-bold text-amber-400">
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Factor Masivo:</span>
            </div>

            <select
              id="select-global-factor"
              value={globalFactorType}
              onChange={(e) => setGlobalFactorType(e.target.value as MarginListKey)}
              className="bg-[#15253d] border border-amber-400/40 rounded-lg px-2 py-1 text-xs font-bold text-amber-300 focus:border-amber-400 outline-none cursor-pointer"
            >
              {Object.entries(MARGIN_LISTS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.label}
                </option>
              ))}
              <option value="custom">Factor Libre (4 dec.)...</option>
            </select>

            {globalFactorType === 'custom' && (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={customGlobalFactorStr}
                  onChange={(e) => setCustomGlobalFactorStr(e.target.value)}
                  placeholder="2.0000"
                  className="w-20 bg-[#15253d] border border-amber-400 rounded-lg px-2 py-1 text-xs text-center font-mono font-bold text-amber-300 focus:border-amber-400 outline-none"
                />
                <span className="text-xs text-slate-400">x</span>
              </div>
            )}

            <button
              id="btn-apply-global-factor"
              onClick={handleApplyGlobalFactor}
              className="inline-flex items-center gap-1 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs px-2.5 py-1 rounded-lg shadow-sm transition cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Aplicar</span>
            </button>
          </div>
        ) : (
          <div className="view-toolbar-group" data-label="Factor global">
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Factores protegidos por Administrador</span>
          </div>
        )}

        {/* Right: Quick Add Cost button and view toggles */}
        <div className="view-toolbar-group ml-auto" data-label="Herramientas">
          <button
            type="button"
            onClick={() => setHideSummaryHeaders(!hideSummaryHeaders)}
            className="inline-flex items-center gap-1 bg-[#192b45] hover:bg-[#223a5e] text-slate-300 border border-[#334d6e] text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer"
            title="Ocultar o mostrar las tarjetas superiores de resumen para maximizar espacio"
          >
            {hideSummaryHeaders ? (
              <>
                <Eye className="w-3 h-3 text-[#38bdf8]" />
                <span>Ver Resumen</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3 h-3 text-slate-400" />
                <span>Ocultar Resumen</span>
              </>
            )}
          </button>

          {/* Column Visibility Manager Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsColumnManagerOpen(!isColumnManagerOpen)}
              className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                visibleColumnCount < ALL_COST_COLUMNS.length
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400/60'
                  : 'bg-[#192b45] hover:bg-[#223a5e] text-slate-300 border-[#334d6e]'
              }`}
              title="Configurar qué columnas mostrar u ocultar en la tabla"
            >
              <Sliders className="w-3 h-3 text-[#38bdf8]" />
              <span>Columnas ({visibleColumnCount}/{ALL_COST_COLUMNS.length})</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isColumnManagerOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 mt-1.5 w-64 bg-[#111c2e] border border-[#38bdf8]/60 rounded-xl shadow-2xl p-2.5 z-50 text-xs text-white animate-fadeIn"
              >
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-[#334d6e]">
                  <span className="text-[11px] font-bold text-[#38bdf8] flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Columnas Visibles</span>
                  </span>
                  <button
                    onClick={() => setIsColumnManagerOpen(false)}
                    className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mb-2">
                  Active o desactive las columnas según su preferencia o dé <strong>clic derecho</strong> en cualquier encabezado de la tabla:
                </p>
                <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin">
                  {ALL_COST_COLUMNS.map((col) => {
                    const isVisible = columnVisibility[col.key];
                    const isLocked = col.alwaysVisible;
                    return (
                      <label
                        key={col.key}
                        className={`flex items-center justify-between px-2 py-1 rounded text-[11px] cursor-pointer transition ${
                          isVisible ? 'hover:bg-[#1a2e4c] text-slate-200' : 'hover:bg-[#15253d] text-slate-400'
                        } ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            disabled={isLocked}
                            checked={isVisible}
                            onChange={() => handleToggleColumn(col.key)}
                            className="rounded border-[#334d6e] bg-[#15253d] text-[#38bdf8] focus:ring-0 cursor-pointer"
                          />
                          <span className={isVisible ? 'font-medium' : ''}>{col.label}</span>
                        </div>
                        {isVisible ? (
                          <Eye className="w-3 h-3 text-[#38bdf8]" />
                        ) : (
                          <EyeOff className="w-3 h-3 text-slate-500" />
                        )}
                      </label>
                    );
                  })}
                </div>

                <div className="pt-2 mt-2 border-t border-[#334d6e] flex items-center justify-between gap-1">
                  <button
                    type="button"
                    onClick={handleShowAllColumns}
                    className="w-full text-center text-[10.5px] font-bold bg-[#192b45] hover:bg-[#223a5e] text-slate-200 py-1 px-2 rounded-lg border border-[#334d6e] transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3 text-amber-400" />
                    <span>Mostrar Todas</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Live TRM & Dollar Volatility Analysis Pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsTrmPopoverOpen(!isTrmPopoverOpen)}
              className="inline-flex items-center gap-1.5 bg-[#15253d] hover:bg-[#1f3555] text-slate-200 border border-[#334d6e] hover:border-[#38bdf8]/60 text-[11px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer shadow-xs"
              title="Ver análisis de volatilidad del dólar y TRM recomendada"
            >
              <Globe className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span className="text-slate-400">TRM:</span>
              <span className="font-mono text-emerald-400 font-bold">${trmData.rate.toLocaleString()}</span>
              <span className="text-slate-500">•</span>
              <span className="text-amber-300 font-mono font-bold" title="TRM Recomendada con margen de protección para cotizar">
                Rec: ${trmData.analysis?.recommendedRoundRate.toLocaleString() || (Math.ceil(trmData.rate * 1.05 / 50) * 50).toLocaleString()}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

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
                      <span className="text-[10px] text-slate-400 block font-medium">TRM Oficial Spot en Vivo</span>
                      <strong className="text-sm font-mono text-emerald-400 font-black">
                        ${trmData.rate.toLocaleString()} COP
                      </strong>
                    </div>
                    <button
                      onClick={handleRefreshTrm}
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
                      Recomendada para proteger la rentabilidad frente a la volatilidad cambiaria del USD al cotizar en pesos colombianos con vigencia de 15 a 30 días.
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

          {!isReadOnly && (
            <div className="view-toolbar-subgroup">
              <button
                type="button"
                onClick={() => setIsEmergencyModalOpen(true)}
                className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white font-bold text-xs px-3 py-1 rounded-lg shadow-md transition cursor-pointer border border-amber-400/40"
                title="Cotizar de emergencia un equipo que aún no está creado en el catálogo"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                <span>Cotizar Parte no creada</span>
              </button>

              <button
                onClick={() => setIsAddEquipmentDrawerOpen(!isAddEquipmentDrawerOpen)}
                className="inline-flex items-center gap-1.5 bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs px-3 py-1 rounded-lg shadow-sm transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar costo</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Searchable & Spacious Add Equipment Modal */}
      {isAddEquipmentDrawerOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/25 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddEquipmentDrawerOpen(false);
          }}
        >
          <div className="bg-[#192b45] border border-[#38bdf8]/60 rounded-2xl max-w-4xl w-full max-h-[90vh] h-[86vh] flex flex-col shadow-2xl overflow-hidden animate-scaleUp my-auto">
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-[#334d6e] flex items-center justify-between gap-3 bg-[#15253d] shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-[#0284c7]/20 text-[#38bdf8] border border-[#0284c7]/30 shrink-0">
                  <PackagePlus className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-white truncate">
                    Agregar Equipos al Gestor de Costos
                  </h3>
                  <p className="text-[11px] text-slate-300 truncate">
                    Seleccione equipos para calcular costos, márgenes y precios
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddEquipmentDrawerOpen(false);
                    setCostSearchQuery('');
                  }}
                  className="px-2.5 py-1 text-xs font-bold text-slate-300 hover:text-white hover:bg-red-500/20 hover:border-red-500/40 border border-[#334d6e] rounded-lg transition cursor-pointer flex items-center gap-1"
                  title="Cerrar ventana"
                >
                  <X className="w-3.5 h-3.5 text-red-400" />
                  <span className="hidden sm:inline">Cerrar</span>
                </button>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="px-3.5 py-2.5 bg-[#111c2e] border-b border-[#334d6e] space-y-2 shrink-0">
              {/* Emergency Quick Action Banner */}
              <div className="bg-amber-950/40 border border-amber-500/40 rounded-xl p-2 px-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-amber-200 font-medium">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>¿El equipo que necesitas no existe en el catálogo todavía?</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddEquipmentDrawerOpen(false);
                    setIsEmergencyModalOpen(true);
                  }}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs px-2.5 py-1 rounded-lg transition cursor-pointer shrink-0 shadow-sm flex items-center gap-1"
                >
                  <span>⚡ Cotizar de Emergencia</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={costSearchQuery}
                    onChange={(e) => setCostSearchQuery(e.target.value)}
                    placeholder="Buscar por nombre, marca, modelo, parte o INVIMA..."
                    className="w-full bg-[#192b45] border border-[#334d6e] focus:border-[#38bdf8] rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-400 outline-none"
                    autoFocus
                  />
                  {costSearchQuery && (
                    <button
                      onClick={() => setCostSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 text-xs text-slate-300 font-bold shrink-0">
                  <Filter className="w-3 h-3 text-[#38bdf8]" />
                  <select
                    value={costCategoryFilter}
                    onChange={(e) => setCostCategoryFilter(e.target.value)}
                    className="bg-[#192b45] border border-[#334d6e] rounded-xl px-2.5 py-1.5 text-xs text-white focus:border-[#38bdf8] outline-none cursor-pointer"
                  >
                    <option value="Todos">Todas las Categorías</option>
                    {Array.from(new Set(equipments.map((e) => e.category).filter(Boolean))).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Equipment Grid List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin bg-[#15253d]">
              {(() => {
                const filtered = equipments.filter((eq) => {
                  const matchesSearch =
                    costSearchQuery === '' ||
                    eq.name.toLowerCase().includes(costSearchQuery.toLowerCase()) ||
                    eq.brand.toLowerCase().includes(costSearchQuery.toLowerCase()) ||
                    eq.model.toLowerCase().includes(costSearchQuery.toLowerCase()) ||
                    eq.code.toLowerCase().includes(costSearchQuery.toLowerCase()) ||
                    (eq.invimaRecordNumber && eq.invimaRecordNumber.toLowerCase().includes(costSearchQuery.toLowerCase()));
                  const matchesCategory =
                    costCategoryFilter === 'Todos' || eq.category === costCategoryFilter;
                  return matchesSearch && matchesCategory;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="p-6 text-center bg-[#111c2e] rounded-xl border border-dashed border-[#334d6e] text-slate-400 space-y-1">
                      <p className="text-xs font-bold text-white">No se encontraron equipos en el catálogo</p>
                      <p className="text-[11px] text-slate-400">
                        Pruebe con otro término de búsqueda o categoría.
                      </p>
                    </div>
                  );
                }

                return filtered.map((eq, eqIdx) => {
                  const existingItem = quoteItems.find((it) => it.equipmentId === eq.id || it.code === eq.code);
                  const costWithIva = eq.taxExempt ? eq.baseCostCOP : Math.round(eq.baseCostCOP * (1 + taxRate));

                  return (
                    <div
                      key={`search-eq-${eq.id || eq.code || 'item'}-${eqIdx}`}
                      className="bg-[#111c2e] border border-[#334d6e] hover:border-[#38bdf8]/60 rounded-xl p-2.5 sm:p-3 flex items-center justify-between gap-3 transition group shadow-sm"
                    >
                      <div className="space-y-0.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono text-[10.5px] font-black bg-[#0284c7]/20 text-[#38bdf8] px-1.5 py-0.5 rounded border border-[#0284c7]/30">
                            {eq.code}
                          </span>
                          <span className="text-[10.5px] font-bold text-white bg-[#192b45] px-2 py-0.5 rounded border border-[#334d6e]">
                            {eq.brand} • {eq.model}
                          </span>
                          {eq.category && (
                            <span className="text-[10.5px] text-slate-300 bg-[#15253d] px-1.5 py-0.5 rounded">
                              {eq.category}
                            </span>
                          )}
                          {existingItem && (
                            <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 rounded">
                              ✓ En cotización ({existingItem.quantity} {existingItem.quantity === 1 ? 'u' : 'u'})
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-[#38bdf8] transition truncate">
                          {eq.name}
                        </h4>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-300">
                          <span>
                            Costo Base:{' '}
                            <strong className="font-mono text-amber-300 font-bold">
                              {formatCOP(eq.baseCostCOP)}
                            </strong>
                          </span>
                          <span>
                            C/ IVA:{' '}
                            <strong className="font-mono text-cyan-300">
                              {formatCOP(costWithIva)}
                            </strong>
                          </span>
                          {eq.invimaRecordNumber && (
                            <span className="text-emerald-400 font-mono">
                              • INVIMA: {eq.invimaRecordNumber}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {existingItem ? (
                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center bg-[#15253d] border border-emerald-500/50 rounded-lg p-0.5 shadow-inner">
                              <button
                                type="button"
                                onClick={() => {
                                  if (existingItem.quantity > 1) {
                                    const nextQty = existingItem.quantity - 1;
                                    onUpdateItem(existingItem.id, {
                                      quantity: nextQty,
                                      totalCost: (existingItem.unitCostCOP || 0) * nextQty,
                                      totalSalePrice: (existingItem.unitSalePrice || 0) * nextQty,
                                    });
                                  } else {
                                    onDeleteItem(existingItem.id);
                                  }
                                }}
                                className="w-6 h-6 rounded flex items-center justify-center font-bold text-slate-300 hover:text-white hover:bg-slate-700 active:scale-95 transition cursor-pointer"
                                title="Reducir 1 unidad"
                              >
                                -
                              </button>
                              <span className="font-mono font-black text-xs text-emerald-300 px-2 min-w-[24px] text-center">
                                {existingItem.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const nextQty = (existingItem.quantity || 1) + 1;
                                  onUpdateItem(existingItem.id, {
                                    quantity: nextQty,
                                    totalCost: (existingItem.unitCostCOP || 0) * nextQty,
                                    totalSalePrice: (existingItem.unitSalePrice || 0) * nextQty,
                                  });
                                }}
                                className="w-6 h-6 rounded flex items-center justify-center font-bold text-slate-300 hover:text-white hover:bg-slate-700 active:scale-95 transition cursor-pointer"
                                title="Aumentar 1 unidad"
                              >
                                +
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleAddEquipmentFromCatalog(eq)}
                              className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-2.5 py-1.5 rounded-lg shadow-sm transition cursor-pointer active:scale-95 whitespace-nowrap"
                              title="Agregar otra unidad a la cotización"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[3]" />
                              <span>Otra Unidad</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddEquipmentFromCatalog(eq)}
                            className="inline-flex items-center gap-1.5 bg-[#0284c7] hover:bg-[#0369a1] text-white font-black text-xs px-3.5 py-1.5 rounded-lg shadow-md transition cursor-pointer active:scale-95 whitespace-nowrap"
                          >
                            <Plus className="w-4 h-4 stroke-[3]" />
                            <span>Agregar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2.5 bg-[#111c2e] border-t border-[#334d6e] flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 shrink-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-[11px] text-slate-400">{equipments.length} equipos en catálogo</span>
                <span className="inline-flex items-center gap-1.5 bg-[#0284c7]/20 border border-[#0284c7]/40 text-[#38bdf8] px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                  <ShoppingCart className="w-3 h-3" />
                  <span>{quoteItems.length} ítems ({quoteItems.reduce((s, it) => s + it.quantity, 0)} uds) en cotización</span>
                </span>
                {quoteHeader?.clientName && (
                  <span className="text-[11px] text-emerald-300 font-semibold truncate max-w-[220px]" title={quoteHeader.clientName}>
                    Destino: {quoteHeader.clientName}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 hidden sm:inline">Presione <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px]">ESC</kbd> al terminar</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddEquipmentDrawerOpen(false);
                    setCostSearchQuery('');
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 py-1.5 rounded-lg shadow transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Listo, ver en Gestor de Costos</span>
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Emergency Uncreated Equipment Modal: Only 5 requested fields */}
      {isEmergencyModalOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEmergencyModalOpen(false);
          }}
        >
          <div className="bg-[#192b45] border border-amber-500/60 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden animate-scaleUp my-auto">
            {/* Header */}
            <div className="px-5 py-3.5 bg-gradient-to-r from-amber-950/80 to-[#15253d] border-b border-amber-500/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    Cotizar Equipo No Creado (Emergencia)
                  </h3>
                  <p className="text-[11px] text-amber-200/80">
                    5 datos básicos para cotizar ya. Pasará a «Pendientes por Crear» en Catálogo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEmergencyModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateEmergencyQuoteItem} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                {/* 1. Nombre del Equipo */}
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-200 mb-1">
                    1. Nombre del Equipo Médico *
                  </label>
                  <input
                    type="text"
                    required
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    placeholder="Ej: ECÓGRAFO PORTÁTIL COLOR"
                    className="w-full px-3 py-2 bg-[#111c2e] border border-[#334d6e] focus:border-amber-400 rounded-xl text-white font-medium outline-none"
                    autoFocus
                  />
                </div>

                {/* 2. Marca */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-200 mb-1">
                    2. Marca *
                  </label>
                  <input
                    type="text"
                    required
                    value={emergencyBrand}
                    onChange={(e) => setEmergencyBrand(e.target.value)}
                    placeholder="Ej: MINDRAY, SECA, BIOCARE..."
                    className="w-full px-3 py-2 bg-[#111c2e] border border-[#334d6e] focus:border-amber-400 rounded-xl text-white font-medium outline-none uppercase"
                  />
                </div>

                {/* 3. Modelo */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-200 mb-1">
                    3. Modelo *
                  </label>
                  <input
                    type="text"
                    required
                    value={emergencyModel}
                    onChange={(e) => setEmergencyModel(e.target.value)}
                    placeholder="Ej: M9, UMEC 100, 874+..."
                    className="w-full px-3 py-2 bg-[#111c2e] border border-[#334d6e] focus:border-amber-400 rounded-xl text-white font-medium outline-none uppercase"
                  />
                </div>

                {/* 4. Cantidad */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-200 mb-1">
                    4. Cantidad *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={emergencyQuantity}
                    onChange={(e) => setEmergencyQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 bg-[#111c2e] border border-[#334d6e] focus:border-amber-400 rounded-xl text-white font-bold text-center outline-none"
                  />
                </div>

                {/* 5. Precio Costo */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-200 mb-1">
                    5. Precio Costo (COP) *
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-cyan-400 font-mono font-bold">$</span>
                    <input
                      type="number"
                      min="0"
                      required
                      value={emergencyCostCOP}
                      onChange={(e) => setEmergencyCostCOP(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className="w-full pl-7 pr-3 py-2 bg-[#111c2e] border border-cyan-500/50 focus:border-cyan-400 rounded-xl text-cyan-300 font-mono font-bold text-right outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Automatic Price Calculation Preview based on List factor */}
              <div className="p-3.5 rounded-xl bg-[#111c2e] border border-[#334d6e] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-medium">Lista de Precios Aplicada:</span>
                  <select
                    value={emergencyFactorType}
                    onChange={(e) => setEmergencyFactorType(e.target.value as MarginListKey)}
                    className="bg-[#192b45] border border-[#334d6e] rounded-lg px-2 py-1 text-xs font-bold text-amber-300 outline-none cursor-pointer"
                  >
                    {Object.entries(MARGIN_LISTS).map(([k, cfg]) => (
                      <option key={k} value={k}>
                        {cfg.label}
                      </option>
                    ))}
                  </select>
                </div>

                {typeof emergencyCostCOP === 'number' && emergencyCostCOP > 0 ? (
                  <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Precio Venta Unitario:</span>
                      <strong className="text-sm font-mono text-emerald-400">
                        {formatCOP(Math.round(emergencyCostCOP * (MARGIN_LISTS[emergencyFactorType]?.multiplier || 1.4)))}
                      </strong>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Subtotal Propuesta:</span>
                      <strong className="text-sm font-mono text-amber-300">
                        {formatCOP(Math.round(emergencyCostCOP * (MARGIN_LISTS[emergencyFactorType]?.multiplier || 1.4) * emergencyQuantity))}
                      </strong>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 italic">
                    Ingrese el precio costo para previsualizar el cálculo automático del precio de venta según la lista seleccionada.
                  </p>
                )}
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEmergencyModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition shadow-lg shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Incluir en Cotización</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Action Notification Alert */}
      {actionAlert && (
        <div
          className={`border text-xs px-4 py-2.5 rounded-xl flex items-center justify-between gap-2 animate-fadeIn shadow ${
            actionAlert.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
              : 'bg-[#15253d] border-[#38bdf8]/60 text-slate-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{actionAlert.msg}</span>
          </div>
          <button
            onClick={() => onNavigateToSales()}
            className="text-[11px] font-bold text-emerald-300 hover:text-white underline flex items-center gap-1 cursor-pointer"
          >
            <span>Ver Hoja 1</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPI Metric Summary Cards - Collapsible */}
      {!hideSummaryHeaders && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 animate-fadeIn">
          <div className="bg-[#192b45] p-2 rounded-lg border border-[#334d6e]">
            <span className="text-[10px] text-slate-400 block font-medium">Costo Base</span>
            <strong className="text-xs sm:text-sm text-slate-200 block font-bold mt-0.5 font-mono truncate">
              {formatCOP(totalCostAccumulated)}
            </strong>
            <span className="text-[9px] text-slate-500 block truncate">Equipos + accesorios</span>
          </div>

          <div className="bg-[#192b45] p-2 rounded-lg border border-cyan-500/40 bg-gradient-to-br from-[#192b45] to-[#122842]">
            <span className="text-[10px] text-cyan-300 block font-bold">Costo Total c/ IVA</span>
            <strong className="text-xs sm:text-sm text-cyan-300 block font-black mt-0.5 font-mono truncate">
              {formatCOP(totalCostWithIVA)}
            </strong>
            <span className="text-[9px] text-cyan-400/80 block truncate">IVA: +{formatCOP(totalCostIVA)}</span>
          </div>

          <div className="bg-[#192b45] p-2 rounded-lg border border-[#334d6e]">
            <span className="text-[10px] text-slate-400 block font-medium">Utilidad Bruta</span>
            <strong className="text-xs sm:text-sm text-emerald-400 block font-bold mt-0.5 font-mono truncate">
              +{formatCOP(totalProfitCOP)}
            </strong>
            <span className="text-[9px] text-emerald-400/80 block truncate">Margen +{overallMarginPercentage}%</span>
          </div>

          <div className="bg-[#192b45] p-2 rounded-lg border border-[#334d6e]">
            <span className="text-[10px] text-slate-400 block font-medium">Subtotal Venta</span>
            <strong className="text-xs sm:text-sm text-amber-300 block font-bold mt-0.5 font-mono truncate">
              {formatCOP(totalSaleSubtotal)}
            </strong>
            <span className="text-[9px] text-slate-500 block truncate">Sin IVA</span>
          </div>

          <div className="bg-[#192b45] p-2 rounded-lg border border-emerald-500/40 bg-gradient-to-br from-[#192b45] to-[#102d38]">
            <span className="text-[10px] text-emerald-300 block font-bold">Total Propuesta c/ IVA</span>
            <strong className="text-xs sm:text-sm text-emerald-400 block font-black mt-0.5 font-mono truncate">
              {formatCOP(totalWithIva)}
            </strong>
            <span className="text-[9px] text-emerald-300/80 block truncate">IVA Venta: {formatCOP(totalIva)}</span>
          </div>
        </div>
      )}
      </div>

      {/* Main Cost & Margin Breakdown Table - Compact & Screen Optimized */}
      <div className="overflow-x-auto rounded-xl border border-[#334d6e] bg-[#192b45] shadow-md scrollbar-thin">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#15253d] text-slate-300 font-bold border-b border-[#334d6e] text-[11px] select-none">
              {costTableColumns.map((col) => {
                if (!columnVisibility[col.id as CostTableColumnKey]) return null;
                return (
                  <th
                    key={col.id}
                    onContextMenu={(e) => handleHeaderContextMenu(e, col.id as CostTableColumnKey)}
                    title="Clic derecho para ocultar columna"
                    className={`py-2 px-2 text-xs font-bold select-none cursor-context-menu hover:bg-[#1f3555] transition ${
                      col.id === 'unitCost'
                        ? 'bg-cyan-950/30 text-cyan-300 hover:bg-cyan-900/30'
                        : col.id === 'unitSalePrice'
                        ? 'bg-emerald-950/20 text-emerald-300 hover:bg-emerald-900/30'
                        : col.id === 'totalWithIva'
                        ? 'bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/30'
                        : 'text-slate-300'
                    }`}
                    style={{ minWidth: col.minWidth, width: col.width }}
                  >
                    <ExcelColumnHeader
                      column={col}
                      allRows={quoteItems}
                      filters={excelFilters}
                      sort={excelSort}
                      onApplyFilter={onApplyFilter}
                      onApplySort={onApplySort}
                      onClearColumnFilter={onClearColumnFilter}
                    />
                  </th>
                );
              })}
              {columnVisibility.actions && (
                <th
                  onContextMenu={(e) => handleHeaderContextMenu(e, 'actions')}
                  title="Clic derecho para ocultar columna"
                  className="py-2 px-2 text-center min-w-[115px] cursor-context-menu hover:bg-[#1f3555] transition text-slate-300 font-bold text-[11px] whitespace-nowrap"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Acciones</span>
                    {isFilteredOrSorted && (
                      <button
                        type="button"
                        onClick={onResetAllFilters}
                        className="inline-flex items-center gap-0.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded px-1.5 py-0.5 text-[9.5px] font-bold transition cursor-pointer"
                        title="Restablecer filtros Excel"
                      >
                        <RotateCcw className="w-2 h-2" />
                        <span>Limpiar</span>
                      </button>
                    )}
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#334d6e]/50">
            {filteredQuoteItems.length === 0 ? (
              <tr>
                <td colSpan={visibleColumnCount} className="text-center py-8 text-slate-400">
                  <PackagePlus className="w-10 h-10 text-slate-500 mx-auto mb-1.5 opacity-40" />
                  <p className="font-semibold text-xs text-slate-200">
                    {quoteItems.length === 0 ? 'No hay costos cargados' : 'No se encontraron items con los filtros aplicados'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {quoteItems.length === 0
                      ? 'Haga clic en el botón "Agregar costo" para añadir productos.'
                      : 'Modifique los filtros o haga clic en Limpiar.'}
                  </p>
                </td>
              </tr>
            ) : (
              filteredQuoteItems.map((item, index) => {
                const accessoriesExtraCost = (item.accessories || [])
                  .filter((a) => !a.includedInBase)
                  .reduce((sum, a) => sum + (Number(a.unitCostCOP) || 0) * (Number(a.quantity) || 1), 0);

                const effectiveUnitCost = item.unitCostCOP + accessoriesExtraCost;
                const itemCostSubtotal = effectiveUnitCost * item.quantity;
                const effectiveTaxRate = item.taxRate !== undefined ? (item.taxRate > 1 ? item.taxRate / 100 : item.taxRate) : (taxRate > 1 ? taxRate / 100 : taxRate);
                const itemTaxRate = item.taxExempt ? 0 : (effectiveTaxRate !== undefined && !isNaN(effectiveTaxRate) ? effectiveTaxRate : 0.19);
                const unitCostIVA = Math.round(effectiveUnitCost * itemTaxRate);
                const unitCostWithIVA = effectiveUnitCost + unitCostIVA;
                const itemCostIVA = Math.round(itemCostSubtotal * itemTaxRate);
                const itemTotalCostWithIVA = itemCostSubtotal + itemCostIVA;

                const itemSaleSubtotal = item.totalSalePrice;
                const unitSaleIVA = Math.round(item.unitSalePrice * itemTaxRate);
                const unitSaleWithIVA = item.unitSalePrice + unitSaleIVA;
                const itemSaleIVA = Math.round(itemSaleSubtotal * itemTaxRate);
                const itemTotalSaleWithIVA = itemSaleSubtotal + itemSaleIVA;

                const unitProfit = item.unitSalePrice - effectiveUnitCost;
                const profitPercentage =
                  effectiveUnitCost > 0 ? ((unitProfit / effectiveUnitCost) * 100).toFixed(2) : '0.00';

                const isCeilingActive = !!item.hasCeilingPrice;
                const ceilingValue = item.ceilingPriceCOP || Math.round(effectiveUnitCost * 1.5);
                const ceilingAnalysis = analyzeCeilingPrice(effectiveUnitCost, ceilingValue);
                const isCeilingModalOpen = openCeilingItemId === item.id;

                const isCostBeforeIvaExpanded = !!expandedCostBeforeIva[item.id];

                // Local string for factor input or fallback to 4 decimals
                const factorInputValue =
                  factorInputStrings[item.id] !== undefined
                    ? factorInputStrings[item.id]
                    : item.customFactor !== undefined
                    ? item.customFactor.toFixed(4)
                    : item.multiplier.toFixed(4);

                return (
                  <React.Fragment key={`cost-item-${item.id || item.equipmentId || 'it'}-${index}`}>
                    <tr className="hover:bg-[#1f3555]/50 transition text-xs">
                      {/* # Index */}
                      {columnVisibility.index && (
                        <td className="py-2 px-1 text-center font-bold text-slate-400 text-[11px]">{index + 1}</td>
                      )}

                      {/* Equipment Info */}
                      {columnVisibility.equipment && (
                        <td className="py-2 px-2">
                          <div className="font-bold text-white leading-tight text-xs">{item.name}</div>
                          <div className="text-[10px] text-[#38bdf8] font-mono mt-0.5">
                            {item.code} • <span className="text-slate-300">{item.brand} ({item.model})</span>
                          </div>

                          {/* Accessories Badge (Hover triggers portal tooltip that never gets cut off) */}
                          <div className="mt-1 inline-block">
                            <div
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredAccessoryInfo({ item, rect });
                              }}
                              onMouseLeave={() => setHoveredAccessoryInfo(null)}
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border inline-flex items-center gap-1 shadow-xs cursor-default select-none transition ${
                                accessoriesExtraCost > 0
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-400/50 hover:bg-amber-500/30'
                                  : 'bg-[#15253d] text-slate-300 border-[#334d6e] hover:border-[#38bdf8]'
                              }`}
                              title="Pase el cursor para ver la lista de accesorios"
                            >
                              <Sliders className="w-2.5 h-2.5 text-slate-400" />
                              <span>{item.accessories?.length || 0} Acc.</span>
                              {accessoriesExtraCost > 0 ? (
                                <span className="font-mono text-amber-300">(+{formatCOP(accessoriesExtraCost)})</span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      )}

                      {/* COSTO BASE UNITARIO (Directly editable & clean & syncs with Ventana 3) */}
                      {columnVisibility.unitCost && (
                        <td className="py-2 px-2 text-right bg-cyan-950/15">
                          <div className="flex flex-col items-end">
                            <div className="relative flex items-center w-full max-w-[120px]">
                              <span className="absolute left-1.5 text-[10px] text-cyan-400 font-mono font-bold">$</span>
                              <input
                                type="text"
                                disabled={isReadOnly}
                                value={
                                  manualCostInputStrings[item.id] !== undefined
                                    ? manualCostInputStrings[item.id]
                                    : item.unitCostCOP === 0
                                    ? ''
                                    : item.unitCostCOP.toString()
                                }
                                onChange={(e) => handleDirectUnitCostChange(item, e.target.value)}
                                onBlur={() => handleDirectUnitCostBlur(item)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.currentTarget.blur();
                                  }
                                }}
                                placeholder="0"
                                title="Costo base antes de IVA (Editable directamente - Sincronizado con Catálogo)"
                                className={`w-full bg-[#15253d] border border-cyan-500/40 rounded px-1 pl-4 py-1 text-right font-mono font-bold text-cyan-300 text-xs ${
                                  isReadOnly
                                    ? 'cursor-default opacity-80'
                                    : 'focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 cursor-text'
                                } outline-none`}
                              />
                            </div>
                            {accessoriesExtraCost > 0 && (
                              <div className="text-[9.5px] text-amber-300 font-mono mt-0.5" title="Costo unitario total incluyendo accesorios extra">
                                Total: {formatCOP(effectiveUnitCost)}
                              </div>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Margin Selector */}
                      {columnVisibility.factor && (
                        <td className="py-2 px-1.5">
                          <select
                            disabled={isReadOnly}
                            value={item.marginType}
                            onChange={(e) =>
                              handleItemFactorChange(item, e.target.value as MarginListKey)
                            }
                            className={`w-full bg-[#15253d] border border-[#334d6e] rounded-md px-1.5 py-1 text-[11px] font-bold text-amber-300 ${isReadOnly ? 'cursor-default opacity-80' : 'focus:border-amber-400 cursor-pointer'} outline-none`}
                          >
                            {Object.entries(MARGIN_LISTS).map(([k, cfg]) => (
                              <option key={k} value={k}>
                                {cfg.label}
                              </option>
                            ))}
                            <option value="custom">Libre (Manual)...</option>
                          </select>

                          {/* Factor Input with 4 decimals */}
                          {item.marginType === 'custom' && (
                            <div className="flex items-center gap-1 mt-1">
                              <input
                                type="text"
                                disabled={isReadOnly}
                                value={factorInputValue}
                                onChange={(e) => handleCustomFactorInputChange(item, e.target.value)}
                                onBlur={() => handleCustomFactorBlur(item)}
                                placeholder="2.0000"
                                title="Factor con hasta 4 decimales"
                                className={`w-16 bg-[#15253d] border border-amber-400 rounded px-1 py-0.5 text-[10.5px] text-amber-300 font-mono font-bold text-center outline-none ${isReadOnly ? 'cursor-default opacity-80' : 'focus:ring-1 focus:ring-amber-400'}`}
                              />
                              <span className="text-[9.5px] text-slate-400 font-mono">x</span>
                            </div>
                          )}
                        </td>
                      )}

                      {/* Profit */}
                      {columnVisibility.profit && (
                        <td className="py-2 px-1.5 text-right">
                          <div className="text-emerald-400 font-bold font-mono text-xs">
                            +{formatCOP(unitProfit)}
                          </div>
                          <div className="text-[9px] text-emerald-400/80">+{profitPercentage}%</div>
                        </td>
                      )}

                      {/* Unit Sale Price: Before IVA + smaller With IVA */}
                      {columnVisibility.unitSalePrice && (
                        <td className="py-2 px-2 text-right bg-emerald-950/10">
                          <div className="flex flex-col items-end gap-0.5">
                            {/* Toggle / Edit Mode Bar */}
                            <div className="flex items-center justify-between w-full gap-1">
                              <span className="text-[8.5px] text-slate-400 font-sans tracking-tight">
                                {item.isManualSalePrice
                                  ? editingManualPriceItemIds[item.id]
                                    ? '✏️ Editando'
                                    : '🔒 Manual'
                                  : 'Fórmula'}
                              </span>
                              {!isReadOnly && (
                                <div className="flex items-center gap-1">
                                  {item.isManualSalePrice ? (
                                    <>
                                      {editingManualPriceItemIds[item.id] ? (
                                        <button
                                          type="button"
                                          onClick={() => handleCommitAndLockManualPrice(item)}
                                          title="Fijar y bloquear precio (O presione INTRO en el teclado)"
                                          className="inline-flex items-center gap-0.5 text-[8.5px] font-bold px-1.5 py-0.2 rounded transition cursor-pointer border bg-emerald-500/20 text-emerald-300 border-emerald-400/60 hover:bg-emerald-500/30"
                                        >
                                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                                          <span>INTRO</span>
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setEditingManualPriceItemIds((prev) => ({
                                              ...prev,
                                              [item.id]: true,
                                            }))
                                          }
                                          title="Habilitar edición del precio manual"
                                          className="inline-flex items-center gap-0.5 text-[8.5px] font-bold px-1.5 py-0.2 rounded transition cursor-pointer border bg-amber-500/20 text-amber-300 border-amber-400/60 hover:bg-amber-500/30"
                                        >
                                          <Edit3 className="w-2 h-2 text-amber-400" />
                                          <span>Manual</span>
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleToggleManualSalePrice(item, false)}
                                        title="Restablecer a fórmula automática de lista"
                                        className="p-0.5 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                                      >
                                        <RotateCcw className="w-2.5 h-2.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleToggleManualSalePrice(item, true)}
                                      title="Fijar precio unitario manualmente"
                                      className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded transition cursor-pointer border bg-[#15253d] text-slate-400 border-[#334d6e] hover:text-amber-300 hover:border-amber-400"
                                    >
                                      <Edit3 className="w-2 h-2" />
                                      <span>Manual</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Price Input or Display (Antes de IVA) */}
                            {item.isManualSalePrice ? (
                              editingManualPriceItemIds[item.id] ? (
                                <div className="w-full space-y-0.5">
                                  <div className="relative flex items-center">
                                    <span className="absolute left-1.5 text-[10px] font-bold text-amber-400 font-mono">$</span>
                                    <input
                                      type="text"
                                      autoFocus
                                      disabled={isReadOnly}
                                      value={
                                        manualPriceInputStrings[item.id] !== undefined
                                          ? manualPriceInputStrings[item.id]
                                          : item.unitSalePrice.toString()
                                      }
                                      onChange={(e) => handleManualPriceInputChange(item, e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          handleCommitAndLockManualPrice(item);
                                        }
                                      }}
                                      onBlur={() => handleCommitAndLockManualPrice(item)}
                                      placeholder="0"
                                      title="Presione INTRO en su teclado para aplicar y fijar este precio"
                                      className={`w-full bg-[#111c2e] border-2 border-amber-400 rounded pl-4 pr-1 py-0.5 text-right text-xs font-mono font-black text-amber-300 outline-none ${
                                        isReadOnly ? 'cursor-default opacity-80' : 'focus:ring-2 focus:ring-amber-400/60'
                                      }`}
                                    />
                                  </div>
                                  <div className="text-[8px] text-amber-400/90 text-right font-sans">
                                    ↵ INTRO para fijar
                                  </div>
                                </div>
                              ) : (
                                <div
                                  onClick={() => {
                                    if (!isReadOnly) {
                                      setEditingManualPriceItemIds((prev) => ({
                                        ...prev,
                                        [item.id]: true,
                                      }));
                                    }
                                  }}
                                  title="Precio manual fijado. Haga clic o presione 'Manual' para modificarlo."
                                  className={`font-extrabold text-amber-300 font-mono text-xs text-right bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-500/40 ${
                                    !isReadOnly ? 'cursor-pointer hover:border-amber-400' : ''
                                  }`}
                                >
                                  {formatCOP(item.unitSalePrice)}
                                </div>
                              )
                            ) : (
                              <div className="font-extrabold text-white font-mono text-xs">
                                {formatCOP(item.unitSalePrice)}
                              </div>
                            )}

                            {/* Smaller Sale Price with IVA Included */}
                            <div className="text-[9.5px] font-mono text-emerald-400/90 bg-emerald-950/40 px-1 py-0.2 rounded border border-emerald-500/30 text-right">
                              c/ IVA: {formatCOP(unitSaleWithIVA)}
                            </div>

                            {/* Ceiling Price check */}
                            {isCeilingActive && (
                              <div className="text-[8.5px]">
                                {item.unitSalePrice <= ceilingValue ? (
                                  <span className="text-emerald-400">✓ En tope</span>
                                ) : (
                                  <span className="text-rose-400 font-bold">
                                    ⚠️ Excede
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      )}

                      {/* IVA Toggle */}
                      {columnVisibility.tax && (
                        <td className="py-2 px-1 text-center">
                          <button
                            type="button"
                            disabled={isReadOnly}
                            onClick={() => {
                              onUpdateItem(item.id, { taxExempt: !item.taxExempt });
                              setActionAlert({
                                msg: item.taxExempt
                                  ? `IVA del 19% activado para "${item.name}".`
                                  : `Producto "${item.name}" marcado como EXENTO (0%).`,
                                type: 'info',
                              });
                              setTimeout(() => setActionAlert(null), 2500);
                            }}
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                              item.taxExempt
                                ? 'bg-slate-800 text-slate-300 border-slate-600 hover:bg-slate-700'
                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/60 hover:bg-emerald-500/30'
                            } ${isReadOnly ? 'cursor-default opacity-80' : 'active:scale-95'}`}
                            title={item.taxExempt ? 'Exento (0%). Clic para IVA 19%.' : 'Con IVA 19%. Clic para Exento.'}
                          >
                            {item.taxExempt ? <span>0% Exento</span> : <span>IVA 19%</span>}
                          </button>
                        </td>
                      )}

                      {/* Discount % */}
                      {columnVisibility.discount && (
                        <td className="py-2 px-1 text-center">
                          <input
                            type="number"
                            disabled={isReadOnly}
                            min={0}
                            max={90}
                            value={item.discountPercentage}
                            onChange={(e) =>
                              handleDiscountChange(item, Math.max(0, parseInt(e.target.value) || 0))
                            }
                            className={`w-11 bg-[#15253d] border border-[#334d6e] rounded px-1 py-0.5 text-center text-xs font-bold text-white ${isReadOnly ? 'cursor-default opacity-80' : 'focus:border-amber-400'} outline-none`}
                          />
                        </td>
                      )}

                      {/* Quantity */}
                      {columnVisibility.quantity && (
                        <td className="py-2 px-1 text-center">
                          <input
                            type="number"
                            disabled={isReadOnly}
                            min={1}
                            value={item.quantity}
                            onChange={(e) => {
                              const qty = Math.max(1, parseInt(e.target.value) || 1);
                              onUpdateItem(item.id, {
                                quantity: qty,
                                totalCost: effectiveUnitCost * qty,
                                totalSalePrice: item.unitSalePrice * qty,
                              });
                            }}
                            className={`w-10 bg-[#15253d] border border-[#334d6e] rounded px-1 py-0.5 text-center text-xs font-bold text-white ${isReadOnly ? 'cursor-default opacity-80' : 'focus:border-amber-400'} outline-none`}
                          />
                        </td>
                      )}

                      {/* Subtotal Sale */}
                      {columnVisibility.subtotal && (
                        <td className="py-2 px-1.5 text-right font-black text-amber-300 font-mono text-xs">
                          {formatCOP(item.totalSalePrice)}
                        </td>
                      )}

                      {/* Total Sale with IVA */}
                      {columnVisibility.totalWithIva && (
                        <td className="py-2 px-2 text-right bg-emerald-950/15">
                          <div className="font-mono text-emerald-400 font-extrabold text-xs">
                            {formatCOP(itemTotalSaleWithIVA)}
                          </div>
                          <div className="text-[9px]">
                            {item.taxExempt ? (
                              <span className="text-slate-400">$0 IVA</span>
                            ) : (
                              <span className="text-emerald-400/80 font-mono">+{formatCOP(itemSaleIVA)}</span>
                            )}
                          </div>
                        </td>
                      )}

                      {/* Actions: [🎯 Techo] [⚙️ Acc] [🗑️] */}
                      {columnVisibility.actions && (
                        <td className="py-2 px-1.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {/* Purple [🎯 Techo] Button */}
                            <button
                              onClick={() => {
                                if (!isCeilingActive) {
                                  if (!isReadOnly) handleToggleCeilingPrice(item, true);
                                  setOpenCeilingItemId(item.id);
                                } else {
                                  setOpenCeilingItemId(isCeilingModalOpen ? null : item.id);
                                }
                              }}
                              title={
                                isCeilingActive
                                  ? `Precio Techo Activo: Tope ${formatCOP(ceilingValue)} (${
                                      item.unitSalePrice <= ceilingValue ? 'Cumple tope' : 'Excede presupuesto'
                                    }). Clic para abrir simulador`
                                  : 'Activar y simular Precio Techo (Tope Presupuestal)'
                              }
                              className={`inline-flex items-center justify-center gap-1 font-bold text-[10.5px] px-1.5 py-1 rounded-md border transition cursor-pointer active:scale-95 whitespace-nowrap shadow-xs ${
                                isCeilingActive
                                  ? item.unitSalePrice <= ceilingValue
                                    ? 'bg-purple-900/50 text-purple-200 border-purple-400/60 hover:bg-purple-800/60'
                                    : 'bg-rose-900/60 text-rose-200 border-rose-500/60 hover:bg-rose-800/60 animate-pulse'
                                  : 'bg-[#15253d] hover:bg-[#1f3350] text-purple-300 border-purple-500/30 hover:border-purple-400/60'
                              }`}
                            >
                              <Target className="w-3 h-3 text-purple-400" />
                              <span>{isCeilingActive ? 'Techo' : 'P. Techo'}</span>
                              {isCeilingActive && (
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    item.unitSalePrice <= ceilingValue ? 'bg-emerald-400' : 'bg-rose-400 animate-ping'
                                  }`}
                                />
                              )}
                            </button>

                            {/* Purple [⚙️] Config Button */}
                            <button
                              onClick={() =>
                                setEditingAccessoryId(editingAccessoryId === item.id ? null : item.id)
                              }
                              title="Configurar accesorios"
                              className="p-1 bg-[#6b5ca5]/40 hover:bg-[#6b5ca5]/60 text-[#c4b5fd] border border-[#6b5ca5]/60 rounded-md transition cursor-pointer active:scale-95"
                            >
                              <Settings className="w-3 h-3" />
                            </button>

                            {/* Red Delete Icon (Admin Only) */}
                            {!isReadOnly && (
                              <button
                                onClick={() => onDeleteItem(item.id)}
                                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/15 p-1 rounded-md transition cursor-pointer"
                                title="Eliminar este equipo"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* EXPANDABLE ACCESSORIES MANAGER AND COST SIMULATOR - Compact */}
                    {editingAccessoryId === item.id && (
                      <tr className="bg-[#0e1927] border-y-2 border-[#38bdf8]/50">
                        <td colSpan={visibleColumnCount} className="p-2 sm:p-2.5">
                          <div className="bg-[#15253d] p-2.5 sm:p-3 rounded-xl border border-[#38bdf8]/40 shadow-xl space-y-2.5">
                            {/* Header */}
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#334d6e] pb-1.5">
                              <div className="flex items-center gap-2">
                                <div className="p-1 rounded-lg bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/30">
                                  <Settings className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-white text-xs flex items-center gap-1.5 flex-wrap">
                                    <span>Accesorios &amp; Configuración</span>
                                    <span className="px-1.5 py-0.2 rounded text-[10.5px] font-mono font-bold bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40">
                                      {item.name} • {item.brand} ({item.model})
                                    </span>
                                  </h4>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                {equipments.some((e) => e.id === item.equipmentId) && (
                                  <button
                                    onClick={() => handleRestoreStandardAccessories(item)}
                                    title="Restaurar lista de accesorios por defecto del catálogo"
                                    className="inline-flex items-center gap-1 text-[10.5px] text-slate-300 hover:text-white bg-[#192b45] hover:bg-[#1f3555] border border-[#334d6e] px-2 py-0.5 rounded-lg transition cursor-pointer"
                                  >
                                    <RefreshCw className="w-2.5 h-2.5 text-slate-400" />
                                    <span>Restaurar Catálogo</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => setEditingAccessoryId(null)}
                                  className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-300 hover:text-white bg-[#192b45] hover:bg-[#1f3555] border border-[#334d6e] px-2 py-0.5 rounded-lg transition cursor-pointer"
                                >
                                  ✕ Cerrar
                                </button>
                              </div>
                            </div>

                            {/* Live Cost & Calculation Banner - Compact */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#192b45] p-2 rounded-xl border border-[#334d6e]">
                              <div>
                                <span className="text-[10px] text-slate-400 block font-medium">1. Costo Base Equipo:</span>
                                <strong className="text-xs font-mono text-slate-200 block font-bold mt-0.5">
                                  {formatCOP(item.unitCostCOP)}
                                </strong>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block font-medium">
                                  2. Extra Accesorios ({item.accessories?.filter((a) => !a.includedInBase).length || 0}):
                                </span>
                                <strong className="text-xs font-mono text-amber-300 block font-bold mt-0.5">
                                  +{formatCOP(accessoriesExtraCost)}
                                </strong>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block font-medium">3. Costo Unitario Total:</span>
                                <strong className="text-xs font-mono text-cyan-300 block font-bold mt-0.5">
                                  {formatCOP(effectiveUnitCost)}
                                </strong>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 block font-medium">
                                  4. Precio Venta Unitario ({item.marginType === 'custom' ? `${item.multiplier.toFixed(4)}x` : item.marginType}):
                                </span>
                                <strong className="text-xs font-mono text-emerald-400 block font-black mt-0.5">
                                  {formatCOP(item.unitSalePrice)} COP
                                </strong>
                              </div>
                            </div>

                            {/* Top Summary Bar - Ultra Compact */}
                            <div className="bg-[#122033] p-2 rounded-lg border border-[#334d6e] flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-1.5 text-[#38bdf8] font-bold">
                                <Sliders className="w-3.5 h-3.5" />
                                <span>Configuración de Accesorios: <span className="text-white">{item.name}</span></span>
                              </div>
                              <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
                                <div className="text-slate-300">
                                  Base: <span className="font-bold text-white">{formatCOP(item.unitCostCOP)}</span>
                                </div>
                                <div className="text-amber-300">
                                  + Acc Extra ({item.accessories?.filter((a) => !a.includedInBase).length || 0}):{' '}
                                  <span className="font-bold">+{formatCOP(accessoriesExtraCost)}</span>
                                </div>
                                <div className="text-cyan-300 border-l border-slate-700 pl-3">
                                  Costo Total: <span className="font-bold">{formatCOP(effectiveUnitCost)}</span>
                                </div>
                                <div className="text-emerald-400 border-l border-slate-700 pl-3">
                                  P. Venta: <span className="font-black">{formatCOP(item.unitSalePrice)} COP</span>
                                </div>
                              </div>
                            </div>

                            {/* Form: Agregar Nuevo Accesorio - Compact */}
                            <div className="bg-[#15253d] p-2 rounded-lg border border-[#38bdf8]/30 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-1">
                                <span className="text-[11px] font-bold text-[#38bdf8] flex items-center gap-1">
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Nuevo Accesorio</span>
                                </span>

                                {/* Inclusión Switch / Segmented Control */}
                                <div className="flex items-center gap-1 bg-[#0f1a2e] p-0.5 rounded-lg border border-[#334d6e]">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setNewAccForm((prev) => ({ ...prev, itemId: item.id, includedInBase: false }))
                                    }
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
                                      (newAccForm.itemId === item.id ? !newAccForm.includedInBase : true)
                                        ? 'bg-emerald-600 text-white shadow-xs'
                                        : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                                    <span>Suma al Precio (+Factor)</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setNewAccForm((prev) => ({ ...prev, itemId: item.id, includedInBase: true }))
                                    }
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer flex items-center gap-1 ${
                                      (newAccForm.itemId === item.id ? newAccForm.includedInBase : false)
                                        ? 'bg-slate-700 text-white shadow-xs'
                                        : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                                    <span>Viene Incluido ($0 adicional)</span>
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-1.5 items-end">
                                {/* Nombre */}
                                <div className="sm:col-span-6">
                                  <label className="text-[9.5px] text-slate-400 block mb-0.5 font-medium">
                                    Nombre / Descripción:
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Ej: Sensor Oximetría Pediátrico..."
                                    value={newAccForm.itemId === item.id ? newAccForm.name : ''}
                                    onChange={(e) =>
                                      setNewAccForm((prev) => ({
                                        ...prev,
                                        itemId: item.id,
                                        name: e.target.value,
                                      }))
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleAddAccessoryToItem(item);
                                    }}
                                    className="w-full bg-[#0f1a2e] border border-[#334d6e] rounded-md px-2 py-1 text-xs text-white placeholder-slate-500 focus:border-[#38bdf8] outline-none font-medium"
                                  />
                                </div>

                                {/* Cantidad */}
                                <div className="sm:col-span-2">
                                  <label className="text-[9.5px] text-slate-400 block mb-0.5 font-medium text-center">
                                    Cant:
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    value={newAccForm.itemId === item.id ? newAccForm.quantity : 1}
                                    onChange={(e) =>
                                      setNewAccForm((prev) => ({
                                        ...prev,
                                        itemId: item.id,
                                        quantity: Math.max(1, parseInt(e.target.value) || 1),
                                      }))
                                    }
                                    className="w-full bg-[#0f1a2e] border border-[#334d6e] rounded-md px-1.5 py-1 text-xs text-center font-bold text-white focus:border-[#38bdf8] outline-none font-mono"
                                  />
                                </div>

                                {/* Costo Unitario COP */}
                                <div className="sm:col-span-2">
                                  <label className="text-[9.5px] text-slate-400 block mb-0.5 font-medium text-right">
                                    Costo (COP):
                                  </label>
                                  <div className="relative flex items-center">
                                    <span className="absolute left-1.5 text-slate-400 font-mono text-[10px]">$</span>
                                    <input
                                      type="text"
                                      placeholder="0"
                                      value={newAccForm.itemId === item.id ? newAccForm.unitCostCOP : ''}
                                      onChange={(e) =>
                                        setNewAccForm((prev) => ({
                                          ...prev,
                                          itemId: item.id,
                                          unitCostCOP: e.target.value.replace(/[^0-9]/g, ''),
                                        }))
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddAccessoryToItem(item);
                                      }}
                                      className="w-full bg-[#0f1a2e] border border-[#334d6e] rounded-md pl-4 pr-1.5 py-1 text-xs font-mono text-right font-bold text-amber-300 focus:border-amber-400 outline-none"
                                    />
                                  </div>
                                </div>

                                {/* Botón Agregar */}
                                <div className="sm:col-span-2">
                                  <button
                                    onClick={() => handleAddAccessoryToItem(item)}
                                    className="w-full bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-xs py-1 px-2 rounded-md shadow-xs transition cursor-pointer flex items-center justify-center gap-1"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Añadir</span>
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* List of Existing Accessories */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                                <span>Lista de Accesorios ({item.accessories?.length || 0}):</span>
                                <span className="text-[10px] text-slate-400 font-normal">
                                  Active o desactive si el accesorio contabiliza en el precio o viene incluido
                                </span>
                              </div>

                              {(!item.accessories || item.accessories.length === 0) ? (
                                <div className="p-2.5 bg-[#15253d] rounded-lg border border-dashed border-[#334d6e] text-center text-xs text-slate-400">
                                  Este equipo no tiene accesorios asignados. Ingrese uno arriba para agregarlo.
                                </div>
                              ) : (
                                <div className="overflow-x-auto rounded-lg border border-[#334d6e] bg-[#15253d]">
                                  <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                      <tr className="bg-[#122033] text-slate-400 font-bold border-b border-[#334d6e] text-[10.5px]">
                                        <th className="py-1.5 px-2 w-7 text-center">#</th>
                                        <th className="py-1.5 px-2 min-w-[160px]">Accesorio</th>
                                        <th className="py-1.5 px-1.5 w-12 text-center">Cant.</th>
                                        <th className="py-1.5 px-2 w-24 text-right">Costo Unit.</th>
                                        <th className="py-1.5 px-2 w-28 text-right">Precio Venta</th>
                                        <th className="py-1.5 px-2 w-44 text-center">¿Contabiliza en Precio?</th>
                                        <th className="py-1.5 px-1.5 w-8 text-center"></th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#334d6e]/40 text-xs">
                                      {item.accessories.map((acc, accIdx) => {
                                        const singleAccSalePrice = Math.round(
                                          (acc.unitCostCOP || 0) * item.multiplier * (1 - (item.discountPercentage || 0) / 100)
                                        );
                                        const totalAccSalePrice = singleAccSalePrice * (acc.quantity || 1);
                                        const isCountedInPrice = !acc.includedInBase;

                                        return (
                                          <tr key={acc.id || accIdx} className="hover:bg-[#1a2f4c]/50 transition">
                                            {/* # */}
                                            <td className="py-1 px-2 text-center text-slate-400 font-mono text-[10.5px]">
                                              {accIdx + 1}
                                            </td>

                                            {/* Name input */}
                                            <td className="py-1 px-2">
                                              <input
                                                type="text"
                                                value={acc.name}
                                                onChange={(e) =>
                                                  handleUpdateAccessoryField(item, acc.id, 'name', e.target.value)
                                                }
                                                placeholder="Nombre del accesorio"
                                                className="w-full bg-[#0f1a2e] border border-[#334d6e] rounded px-1.5 py-0.5 text-xs text-white focus:border-[#38bdf8] outline-none font-medium"
                                              />
                                            </td>

                                            {/* Quantity input */}
                                            <td className="py-1 px-1.5 text-center">
                                              <input
                                                type="number"
                                                min={1}
                                                value={acc.quantity || 1}
                                                onChange={(e) =>
                                                  handleUpdateAccessoryField(
                                                    item,
                                                    acc.id,
                                                    'quantity',
                                                    Math.max(1, parseInt(e.target.value) || 1)
                                                  )
                                                }
                                                className="w-10 bg-[#0f1a2e] border border-[#334d6e] rounded px-1 py-0.5 text-xs text-center font-bold text-white focus:border-[#38bdf8] outline-none font-mono"
                                              />
                                            </td>

                                            {/* Cost unit input */}
                                            <td className="py-1 px-2 text-right">
                                              <div className="relative flex items-center">
                                                <span className="absolute left-1 text-slate-400 font-mono text-[9.5px]">$</span>
                                                <input
                                                  type="text"
                                                  value={acc.unitCostCOP === 0 ? '' : acc.unitCostCOP || ''}
                                                  onChange={(e) => {
                                                    const clean = parseInt(e.target.value.replace(/[^0-9]/g, ''), 10) || 0;
                                                    handleUpdateAccessoryField(item, acc.id, 'unitCostCOP', clean);
                                                  }}
                                                  placeholder="0"
                                                  className="w-full bg-[#0f1a2e] border border-[#334d6e] rounded pl-3 pr-1 py-0.5 text-xs text-right font-mono font-bold text-amber-300 focus:border-amber-400 outline-none"
                                                />
                                              </div>
                                            </td>

                                            {/* Precio Venta */}
                                            <td className="py-1 px-2 text-right font-mono">
                                              {isCountedInPrice ? (
                                                <div>
                                                  <span className="font-bold text-emerald-400 text-xs">
                                                    +{formatCOP(totalAccSalePrice)}
                                                  </span>
                                                  {acc.quantity > 1 && (
                                                    <div className="text-[9px] text-slate-400">
                                                      ({formatCOP(singleAccSalePrice)} c/u)
                                                    </div>
                                                  )}
                                                </div>
                                              ) : (
                                                <span className="text-[11px] text-slate-400 italic">
                                                  Incluido ($0)
                                                </span>
                                              )}
                                            </td>

                                            {/* Toggle Activar/Desactivar Contabilización */}
                                            <td className="py-1 px-2 text-center">
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  handleUpdateAccessoryField(item, acc.id, 'includedInBase', !acc.includedInBase)
                                                }
                                                className={`w-full inline-flex items-center justify-center gap-1 text-[10.5px] font-bold px-2 py-0.5 rounded-md border transition cursor-pointer active:scale-95 shadow-xs ${
                                                  isCountedInPrice
                                                    ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border-emerald-500/60'
                                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600'
                                                }`}
                                                title={
                                                  isCountedInPrice
                                                    ? 'Contabiliza en el costo y precio de venta. Clic para desactivar y marcarlo como INCLUIDO en el equipo ($0 extra).'
                                                    : 'Viene incluido en base ($0 extra). Clic para activar y SUMAR su costo al precio con el factor.'
                                                }
                                              >
                                                {isCountedInPrice ? (
                                                  <>
                                                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                                    <span>Suma al Precio</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                                                    <span>Viene Incluido ($0)</span>
                                                  </>
                                                )}
                                              </button>
                                            </td>

                                            {/* Delete */}
                                            <td className="py-1 px-1.5 text-center">
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteAccessoryFromItem(item, acc.id)}
                                                title="Eliminar accesorio"
                                                className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 rounded transition cursor-pointer"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* EXPANDABLE PRECIO TECHO ANALYSIS ROW & SIMULATOR */}
                    {isCeilingActive && isCeilingModalOpen && (
                      <tr className="bg-[#111c2e] border-y-2 border-purple-500/40">
                        <td colSpan={visibleColumnCount} className="p-4 sm:p-5">
                          <div className="bg-[#15253d] p-4 sm:p-5 rounded-2xl border border-purple-500/40 shadow-2xl space-y-4">
                            {/* Header Section */}
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#334d6e]">
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                  <Target className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="font-bold text-white text-sm sm:text-base flex items-center gap-2 flex-wrap">
                                    <span>Simulador &amp; Cálculo Inteligente de Precio Techo (Tope Máximo)</span>
                                    <span className="text-xs text-purple-300 font-mono bg-purple-950/80 px-2 py-0.5 rounded-md border border-purple-500/40">
                                      {item.name} ({item.model})
                                    </span>
                                  </h4>
                                  <p className="text-xs text-slate-300 mt-0.5">
                                    Ingrese el presupuesto máximo del cliente (Tope). El sistema calcula el factor exacto y simula cuál lista (L1 a L8) se acerca más sin sobrepasar el presupuesto.
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleToggleCeilingPrice(item, false)}
                                  className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/30 transition cursor-pointer"
                                >
                                  Desactivar Precio Techo
                                </button>
                                <button
                                  onClick={() => setOpenCeilingItemId(null)}
                                  className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-[#192b45] transition cursor-pointer"
                                >
                                  Cerrar Panel
                                </button>
                              </div>
                            </div>

                            {/* Top 3 KPI / Input Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {/* 1. Precio Techo Input Card */}
                              <div className="bg-[#192b45] p-3.5 rounded-xl border border-purple-500/40 shadow-sm flex flex-col justify-between">
                                <div>
                                  <label className="block text-xs font-bold text-purple-300 mb-1.5 flex items-center gap-1">
                                    <Target className="w-3.5 h-3.5 text-purple-400" />
                                    <span>1. Ingrese Precio Techo / Tope (COP):</span>
                                  </label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm font-bold">$</span>
                                    <input
                                      type="text"
                                      value={
                                        ceilingInputStrings[item.id] !== undefined
                                          ? ceilingInputStrings[item.id]
                                          : item.ceilingPriceCOP !== undefined && item.ceilingPriceCOP !== 0
                                          ? item.ceilingPriceCOP.toString()
                                          : item.ceilingPriceCOP === 0
                                          ? '0'
                                          : ceilingValue.toString()
                                      }
                                      onChange={(e) => handleCeilingInputChange(item, e.target.value)}
                                      onBlur={() => handleCeilingInputBlur(item)}
                                      className="w-full bg-[#15253d] text-white font-mono font-black text-sm pl-7 pr-3 py-2 rounded-xl border border-purple-500 focus:border-purple-400 focus:ring-1 focus:ring-purple-400 outline-none"
                                      placeholder="0"
                                    />
                                  </div>
                                </div>
                                <div className="mt-2 pt-2 border-t border-[#334d6e] flex justify-between items-center text-[11px]">
                                  <span className="text-slate-400">Costo Base Real:</span>
                                  <span className="font-mono font-bold text-slate-200">{formatCOP(effectiveUnitCost)}</span>
                                </div>
                              </div>

                              {/* 2. Factor Exacto Resultante */}
                              <div className="bg-[#192b45] p-3.5 rounded-xl border border-[#334d6e] shadow-sm flex flex-col justify-between">
                                <div>
                                  <span className="block text-xs font-bold text-emerald-400 mb-1 flex items-center gap-1">
                                    <TrendingUp className="w-3.5 h-3.5" />
                                    <span>2. Factor Exacto &amp; Utilidad con Techo:</span>
                                  </span>
                                  {ceilingAnalysis.isBelowCost ? (
                                    <div className="text-rose-400 font-bold flex items-center gap-1.5 text-xs mt-2 bg-rose-950/40 p-2 rounded-lg border border-rose-500/40">
                                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                                      <span>El tope es menor al costo (-{formatCOP(Math.abs(ceilingAnalysis.profitCOP))})</span>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <div className="flex items-baseline justify-between">
                                        <span className="text-xs text-slate-400">Factor Requerido:</span>
                                        <strong className="text-base font-mono font-black text-amber-300">
                                          {ceilingAnalysis.factor.toFixed(4)}x
                                        </strong>
                                      </div>
                                      <div className="flex items-baseline justify-between">
                                        <span className="text-xs text-slate-400">Ganancia Neta:</span>
                                        <strong className="text-sm font-mono font-bold text-emerald-400">
                                          +{formatCOP(ceilingAnalysis.profitCOP)}
                                        </strong>
                                      </div>
                                      <div className="flex items-baseline justify-between">
                                        <span className="text-xs text-slate-400">Rentabilidad (%):</span>
                                        <strong className="text-xs font-mono font-bold text-emerald-300">
                                          +{ceilingAnalysis.profitPercent.toFixed(2)}%
                                        </strong>
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <div className="mt-2 pt-2 border-t border-[#334d6e]">
                                  <button
                                    onClick={() => handleApplyCeilingPriceAsSale(item)}
                                    className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs py-1.5 px-3 rounded-lg shadow transition cursor-pointer flex items-center justify-center gap-1.5"
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>Ajustar a Precio Techo Exacto ({formatCOP(ceilingValue)})</span>
                                  </button>
                                </div>
                              </div>

                              {/* 3. Lista Recomendada Inteligente */}
                              <div className="bg-[#192b45] p-3.5 rounded-xl border border-amber-400/40 shadow-sm flex flex-col justify-between">
                                <div>
                                  <span className="block text-xs font-bold text-amber-400 mb-1 flex items-center gap-1">
                                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                                    <span>3. Lista Estándar Más Cercana:</span>
                                  </span>

                                  {ceilingAnalysis.bestFittingList ? (
                                    <div className="space-y-1.5 mt-1">
                                      <div className="bg-[#15253d] p-2 rounded-lg border border-amber-400/30">
                                        <div className="font-bold text-amber-300 text-xs">
                                          {MARGIN_LISTS[ceilingAnalysis.bestFittingList]?.label}
                                        </div>
                                        <div className="text-[11px] text-slate-300 mt-0.5">
                                          Precio Lista: <strong className="font-mono text-white">{formatCOP(Math.round(effectiveUnitCost * MARGIN_LISTS[ceilingAnalysis.bestFittingList]?.multiplier))}</strong>
                                        </div>
                                        <div className="text-[10px] text-emerald-400 font-mono mt-0.5">
                                          Margen seguro • {formatCOP(ceilingValue - Math.round(effectiveUnitCost * MARGIN_LISTS[ceilingAnalysis.bestFittingList]?.multiplier))} por debajo del tope
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-xs text-slate-300 mt-1">
                                      Ninguna lista estándar queda por debajo del tope. Se sugiere usar <strong>Factor Libre Exacto ({ceilingAnalysis.factor.toFixed(4)}x)</strong>.
                                    </p>
                                  )}
                                </div>

                                <div className="mt-2 pt-2 border-t border-[#334d6e]">
                                  {ceilingAnalysis.bestFittingList && (
                                    <button
                                      onClick={() => handleApplyRecommendedListForCeiling(item, ceilingAnalysis.bestFittingList!)}
                                      className="w-full bg-amber-400 hover:bg-amber-500 text-slate-950 font-extrabold text-xs py-1.5 px-3 rounded-lg shadow transition cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                                      <span>Aplicar {MARGIN_LISTS[ceilingAnalysis.bestFittingList]?.label}</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Full Interactive Comparison Table: All 8 Standard Lists vs Ceiling Price */}
                            <div className="bg-[#192b45] rounded-xl border border-[#334d6e] overflow-hidden">
                              <div className="bg-[#15253d] px-4 py-2.5 border-b border-[#334d6e] flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Layers className="w-4 h-4 text-[#38bdf8]" />
                                  <span className="font-bold text-white text-xs">
                                    Simulación Comparativa de Listas de Precios (L1 a L8) vs Precio Techo ({formatCOP(ceilingValue)})
                                  </span>
                                </div>
                                <span className="text-[11px] text-slate-400">
                                  Haga clic en <strong>"Aplicar Lista"</strong> en cualquiera de las opciones
                                </span>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs border-collapse">
                                  <thead>
                                    <tr className="bg-[#111c2e] text-slate-400 font-semibold border-b border-[#334d6e]">
                                      <th className="p-2.5">Lista de Precio</th>
                                      <th className="p-2.5">Multiplicador</th>
                                      <th className="p-2.5 text-right">Precio Resultante</th>
                                      <th className="p-2.5 text-right">Ganancia Neta ($)</th>
                                      <th className="p-2.5 text-center">Rentabilidad %</th>
                                      <th className="p-2.5 min-w-[190px]">Diferencia vs Precio Techo</th>
                                      <th className="p-2.5 text-center w-28">Acción</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#334d6e]/40">
                                    {ceilingAnalysis.allListsComparison.map((comp) => {
                                      const isSelected = item.marginType === comp.key;

                                      return (
                                        <tr
                                          key={comp.key}
                                          className={`transition ${
                                            comp.isBestFit
                                              ? 'bg-amber-500/10 hover:bg-amber-500/20'
                                              : isSelected
                                              ? 'bg-[#0284c7]/15 hover:bg-[#0284c7]/25'
                                              : 'hover:bg-[#15253d]'
                                          }`}
                                        >
                                          {/* Lista Name & Badges */}
                                          <td className="p-2.5 font-bold">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className={comp.isBestFit ? 'text-amber-300 font-black' : 'text-white'}>
                                                {comp.label}
                                              </span>

                                              {comp.isBestFit && (
                                                <span className="bg-amber-400 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                                  ★ Recomendada
                                                </span>
                                              )}

                                              {isSelected && (
                                                <span className="bg-[#0284c7] text-white font-bold text-[9px] px-1.5 py-0.5 rounded-full">
                                                  Activa
                                                </span>
                                              )}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-normal">
                                              {comp.description}
                                            </div>
                                          </td>

                                          {/* Multiplier */}
                                          <td className="p-2.5 font-mono text-slate-300 font-semibold">
                                            {comp.multiplier.toFixed(4)}x
                                          </td>

                                          {/* Calculated Price */}
                                          <td className="p-2.5 text-right font-mono font-black text-white">
                                            {formatCOP(comp.calculatedPrice)}
                                          </td>

                                          {/* Profit COP */}
                                          <td className="p-2.5 text-right font-mono text-emerald-400 font-bold">
                                            +{formatCOP(comp.profitCOP)}
                                          </td>

                                          {/* Margin % */}
                                          <td className="p-2.5 text-center font-mono text-emerald-300 text-[11px]">
                                            +{comp.profitPercent.toFixed(1)}%
                                          </td>

                                          {/* Difference vs Ceiling Price */}
                                          <td className="p-2.5">
                                            {comp.status === 'exact' ? (
                                              <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-md text-[11px]">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                                <span>Coincide con el tope exacto ($0)</span>
                                              </span>
                                            ) : comp.status === 'under' ? (
                                              <span className="inline-flex items-center gap-1 text-sky-300 bg-sky-950/50 border border-sky-500/30 px-2 py-0.5 rounded-md text-[11px]">
                                                <Check className="w-3 h-3 text-sky-400" />
                                                <span>Bajo el tope por -{formatCOP(Math.abs(comp.differenceCOP))}</span>
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 text-rose-300 font-bold bg-rose-950/60 border border-rose-500/40 px-2 py-0.5 rounded-md text-[11px]">
                                                <AlertTriangle className="w-3 h-3 text-rose-400" />
                                                <span>Supera el tope por +{formatCOP(comp.differenceCOP)}</span>
                                              </span>
                                            )}
                                          </td>

                                          {/* Apply Button */}
                                          <td className="p-2.5 text-center">
                                            <button
                                              onClick={() => handleItemFactorChange(item, comp.key)}
                                              className={`text-[11px] font-bold px-3 py-1 rounded-lg transition cursor-pointer ${
                                                isSelected
                                                  ? 'bg-slate-700 text-slate-300 cursor-default'
                                                  : comp.isBestFit
                                                  ? 'bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-sm'
                                                  : comp.status === 'over'
                                                  ? 'bg-[#15253d] hover:bg-rose-900/40 text-rose-300 border border-rose-500/30'
                                                  : 'bg-[#15253d] hover:bg-[#0284c7] text-white border border-[#334d6e]'
                                              }`}
                                            >
                                              {isSelected ? 'Seleccionada' : 'Aplicar'}
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
          {quoteItems.length > 0 && (
            <tfoot className="bg-[#111c2e] border-t-2 border-[#334d6e] font-bold text-xs">
              <tr className="divide-x divide-[#334d6e]/40">
                {columnVisibility.index && (
                  <td className="p-2 text-center text-slate-500 font-bold">#</td>
                )}
                {columnVisibility.equipment && (
                  <td className="p-2 text-left uppercase tracking-wider text-slate-300 font-extrabold text-xs">
                    TOTALES:
                  </td>
                )}
                {columnVisibility.unitCost && (
                  <td className="p-2 text-right font-mono text-cyan-300 font-extrabold bg-cyan-950/30">
                    {formatCOP(totalCostAccumulated)}
                  </td>
                )}
                {columnVisibility.factor && (
                  <td className="p-2 text-center text-slate-400 text-[11px] italic">
                    Margen {overallMarginPercentage}%
                  </td>
                )}
                {columnVisibility.profit && (
                  <td className="p-2 text-right font-mono text-emerald-400 font-bold">
                    +{formatCOP(totalProfitCOP)}
                  </td>
                )}
                {columnVisibility.unitSalePrice && (
                  <td className="p-2 text-right font-mono text-slate-400 text-[11px]">-</td>
                )}
                {columnVisibility.tax && (
                  <td className="p-2 text-center text-[10.5px] font-mono text-slate-300">
                    IVA: {formatCOP(totalIva)}
                  </td>
                )}
                {columnVisibility.discount && (
                  <td className="p-2 text-center text-slate-400 text-[11px]">-</td>
                )}
                {columnVisibility.quantity && (
                  <td className="p-2 text-center font-mono text-white font-bold">
                    {quoteItems.reduce((sum, it) => sum + it.quantity, 0)}
                  </td>
                )}
                {columnVisibility.subtotal && (
                  <td className="p-2 text-right font-mono font-black text-amber-300">
                    {formatCOP(totalSaleSubtotal)}
                  </td>
                )}
                {columnVisibility.totalWithIva && (
                  <td className="p-2 text-right font-mono font-black text-emerald-400 bg-emerald-950/30">
                    {formatCOP(totalWithIva)} COP
                  </td>
                )}
                {columnVisibility.actions && <td className="p-2"></td>}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Floating Hover Tooltip Portal for Accessories (Rendered on document.body, free from any table overflow cutoffs) */}
      {hoveredAccessoryInfo &&
        typeof document !== 'undefined' &&
        createPortal(
          (() => {
            const { item, rect } = hoveredAccessoryInfo;
            const estimatedHeight = 180;
            const spaceBelow = window.innerHeight - rect.bottom;
            const showAbove = spaceBelow < estimatedHeight && rect.top > estimatedHeight;

            const topPos = showAbove ? undefined : rect.bottom + 6;
            const bottomPos = showAbove ? window.innerHeight - rect.top + 6 : undefined;
            const leftPos = Math.max(12, Math.min(window.innerWidth - 330, rect.left));

            return (
              <div
                style={{
                  position: 'fixed',
                  top: topPos !== undefined ? `${topPos}px` : undefined,
                  bottom: bottomPos !== undefined ? `${bottomPos}px` : undefined,
                  left: `${leftPos}px`,
                  zIndex: 9999,
                }}
                className="min-w-[230px] max-w-[330px] bg-[#0b1422] border border-[#38bdf8]/70 rounded-xl p-3 shadow-2xl backdrop-blur-md pointer-events-none animate-fadeIn"
              >
                <div className="text-[10.5px] font-bold text-[#38bdf8] uppercase tracking-wider mb-2 flex items-center justify-between border-b border-[#334d6e]/70 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Sliders className="w-3 h-3 text-[#38bdf8]" />
                    <span>Accesorios del Equipo ({item.accessories?.length || 0})</span>
                  </span>
                </div>
                {!item.accessories || item.accessories.length === 0 ? (
                  <p className="text-[10.5px] text-slate-400 italic py-1">Sin accesorios registrados</p>
                ) : (
                  <ul className="space-y-1.5 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
                    {item.accessories.map((acc, accIdx) => (
                      <li
                        key={acc.id || accIdx}
                        className="text-[11px] text-slate-200 flex items-center justify-between gap-2 border-b border-[#1e2f47]/60 pb-1.5 last:border-0 last:pb-0"
                      >
                        <span className="truncate flex-1 font-medium">• {acc.name}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-mono text-[9.5px] text-slate-400">x{acc.quantity || 1}</span>
                          {acc.includedInBase ? (
                            <span className="text-[9px] text-emerald-400 font-bold bg-emerald-950/80 px-1.5 py-0.2 rounded border border-emerald-500/40">
                              Inc.
                            </span>
                          ) : (
                            <span className="text-[9.5px] text-amber-300 font-mono font-bold">
                              +{formatCOP(acc.unitCostCOP * (acc.quantity || 1))}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })(),
          document.body
        )}
    </div>
  );
};
