import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  FileSpreadsheet,
  Download,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  Award,
  UploadCloud,
  FileCheck2,
  Calendar,
  Building2,
  Sliders,
  DollarSign,
  ArrowRight,
  RefreshCw,
  Clock,
  ShieldCheck,
  Stethoscope,
  AlertTriangle,
  X,
  RotateCcw,
  PackageCheck,
  Truck,
  AlertCircle,
  Receipt,
  Activity,
  FileText,
} from 'lucide-react';
import {
  TenderClientProject,
  TenderItem,
  OCTrackingContract,
  OCTrackingItem,
  SalesOrderRecord,
  SalesOrderItem,
  SalesInvoiceRecord,
  MedicalEquipment,
} from '../../types';
import { formatCOP, normalizeClean } from '../../utils/formatters';
import { computeOrderInvoicingData } from '../views/SalesOrdersView';
import { formatTenderProcessNumber } from '../../utils/tenderDeduplication';
import {
  ExcelColumnConfig,
  ExcelColumnHeader,
  useExcelTableFilters,
} from '../common/ExcelTableFilter';

const TENDER_ITEM_COLUMNS: ExcelColumnConfig<TenderItem>[] = [
  {
    id: 'code',
    label: 'Parte / Código',
    type: 'text',
    accessor: (row) => row.code || '',
    minWidth: '85px',
  },
  {
    id: 'name',
    label: 'Equipo Biomédico',
    type: 'text',
    accessor: (row) => row.name || '',
    minWidth: '150px',
  },
  {
    id: 'brandModel',
    label: 'Marca / Modelo',
    type: 'text',
    accessor: (row) => `${row.brand || ''} ${row.model || ''}`.trim(),
    minWidth: '105px',
  },
  {
    id: 'quantity',
    label: 'Cant.',
    type: 'number',
    accessor: (row) => row.quantity || 1,
    align: 'center',
    minWidth: '55px',
  },
  {
    id: 'unitPrice',
    label: 'Precio Unitario',
    type: 'number',
    accessor: (row) => row.offeredUnitPrice || 0,
    formatter: (val) => formatCOP(Number(val) || 0),
    align: 'right',
    minWidth: '110px',
  },
  {
    id: 'subtotal',
    label: 'Subtotal (Sin IVA)',
    type: 'number',
    accessor: (row) => (row.quantity || 1) * (row.offeredUnitPrice || 0),
    formatter: (val) => formatCOP(Number(val) || 0),
    align: 'right',
    minWidth: '105px',
  },
  {
    id: 'totalWithIva',
    label: 'Total Fila (Con IVA)',
    type: 'number',
    accessor: (row) => {
      const sub = (row.quantity || 1) * (row.offeredUnitPrice || 0);
      const tax = row.taxRate !== undefined ? row.taxRate : 0.19;
      return sub + Math.round(sub * tax);
    },
    formatter: (val) => formatCOP(Number(val) || 0),
    align: 'right',
    minWidth: '115px',
  },
  {
    id: 'specs',
    label: 'Especificaciones',
    type: 'number',
    accessor: (row) => row.requirements?.length || 0,
    formatter: (val) => `${val} specs`,
    align: 'center',
    minWidth: '95px',
  },
];

interface TenderAwardedViewProps {
  activeClient: TenderClientProject;
  onUpdateClient: (clientId: string, updates: Partial<TenderClientProject>) => void;
  onUpdateTenderItem: (clientId: string, itemId: string, updates: Partial<TenderItem>) => void;
  onDeleteTenderItem: (clientId: string, itemId: string) => void;
  onOpenExcelImportModal: () => void;
  onOpenCatalogModal?: () => void;
  onOpenManualItemModal?: () => void;
  onOpenEditClientModal: () => void;
  onDownloadExcelTemplate: () => void;
  onSwitchToSpecificationsTab: (filterItemId?: string) => void;
  onNavigateToOCTracking?: () => void;
  isReadOnly?: boolean;
  contracts?: OCTrackingContract[];
  salesOrders?: SalesOrderRecord[];
  salesInvoices?: SalesInvoiceRecord[];
  onCreateSalesOrder?: (tender: TenderClientProject) => void;
  equipments?: MedicalEquipment[];
}

export const TenderAwardedView: React.FC<TenderAwardedViewProps> = ({
  activeClient,
  onUpdateClient,
  onUpdateTenderItem,
  onDeleteTenderItem,
  onOpenExcelImportModal,
  onOpenCatalogModal,
  onOpenManualItemModal,
  onOpenEditClientModal,
  onDownloadExcelTemplate,
  onSwitchToSpecificationsTab,
  onNavigateToOCTracking,
  isReadOnly,
  contracts = [],
  salesOrders = [],
  salesInvoices = [],
  onCreateSalesOrder,
  equipments = [],
}) => {
  const [isConfirmClearModalOpen, setIsConfirmClearModalOpen] = useState(false);
  const items = activeClient.items || [];
  const defaultTaxRate = 0.19; // 19% IVA standard

  // Helper to read latest catalog from props or localStorage
  const getEffectiveCatalog = useCallback((): MedicalEquipment[] => {
    let list: MedicalEquipment[] = equipments || [];
    try {
      const raw = localStorage.getItem('syd_equipments_catalog');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          list = parsed;
        }
      }
    } catch (_) {}
    return list;
  }, [equipments]);

  const [catalogList, setCatalogList] = useState<MedicalEquipment[]>(getEffectiveCatalog);

  useEffect(() => {
    setCatalogList(getEffectiveCatalog());
    const onCatalogUpdate = () => setCatalogList(getEffectiveCatalog());
    window.addEventListener('syd_equipment_catalog_updated', onCatalogUpdate);
    return () => window.removeEventListener('syd_equipment_catalog_updated', onCatalogUpdate);
  }, [getEffectiveCatalog]);

  const resolveItemCode = useCallback((item: TenderItem): string => {
    const rawCode = (item.code || '').trim();
    if (rawCode && rawCode.toUpperCase() !== 'PENDIENTE' && rawCode !== '-' && rawCode !== '0' && rawCode !== 'N/A') {
      return rawCode;
    }
    const clean = (s?: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const itemName = clean(item.name);
    const itemModel = clean(item.model);

    const match = catalogList.find((eq) => {
      const eqCode = (eq.code || '').trim();
      if (!eqCode || eqCode.toUpperCase() === 'PENDIENTE') return false;
      const eqName = clean(eq.name);
      const eqModel = clean(eq.model);
      if (itemName && eqName === itemName) return true;
      if (itemModel && (eqModel === itemModel || eqName === itemModel)) return true;
      if (itemName && (eqName.includes(itemName) || itemName.includes(eqName))) return true;
      return false;
    });

    return match?.code || rawCode || 'PENDIENTE';
  }, [catalogList]);

  // Auto-detect and sync newly registered catalog items (e.g. ADIOS -> code 00000)
  useEffect(() => {
    if (!activeClient || !activeClient.items || activeClient.items.length === 0) return;
    const clean = (s?: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    activeClient.items.forEach((item) => {
      const currentCode = (item.code || '').trim();
      const isPending = !currentCode || currentCode.toUpperCase() === 'PENDIENTE' || currentCode === '-' || currentCode === '0';
      if (!isPending) return;

      const itemName = clean(item.name);
      const itemModel = clean(item.model);

      const match = catalogList.find((eq) => {
        const eqCode = (eq.code || '').trim();
        if (!eqCode || eqCode.toUpperCase() === 'PENDIENTE') return false;
        const eqName = clean(eq.name);
        const eqModel = clean(eq.model);
        if (itemName && eqName === itemName) return true;
        if (itemModel && (eqModel === itemModel || eqName === itemModel)) return true;
        if (itemName && (eqName.includes(itemName) || itemName.includes(eqName))) return true;
        return false;
      });

      if (match && match.code && match.code.toUpperCase() !== 'PENDIENTE') {
        onUpdateTenderItem(activeClient.id, item.id, {
          code: match.code,
          brand: (item.brand && item.brand.toUpperCase() !== 'PENDIENTE' && item.brand !== item.name) ? item.brand : (match.brand || item.brand),
          model: (item.model && item.model.toUpperCase() !== 'PENDIENTE' && item.model !== item.name) ? item.model : (match.model || item.model),
        });
      }
    });
  }, [activeClient?.id, activeClient?.items, catalogList, onUpdateTenderItem]);

  // Excel table filter hook
  const {
    filteredRows: filteredItems,
    filters: excelFilters,
    sort: excelSort,
    onApplyFilter,
    onApplySort,
    onClearColumnFilter,
    onResetAllFilters,
    isFilteredOrSorted,
  } = useExcelTableFilters(items, TENDER_ITEM_COLUMNS);

  const totalUnits = items.reduce((acc, it) => acc + (it.quantity || 1), 0);
  const totalSubtotalCOP = items.reduce(
    (acc, it) => acc + (it.quantity || 1) * (it.offeredUnitPrice || 0),
    0
  );
  const totalIvaCOP = items.reduce((acc, it) => {
    const sub = (it.quantity || 1) * (it.offeredUnitPrice || 0);
    const rate = it.taxRate !== undefined ? it.taxRate : defaultTaxRate;
    return acc + Math.round(sub * rate);
  }, 0);
  const grandTotalCOP = totalSubtotalCOP + totalIvaCOP;

  const totalSpecsCount = items.reduce((acc, it) => acc + (it.requirements?.length || 0), 0);
  const isAwarded = activeClient.status === 'Adjudicada';
  const isFulfilled = activeClient.status === 'Cumplido / Archivado';

  // Helper: Strips prefixes (No, N°, CTO, Contrato, leading zeros in HBOC) to match contract/process numbers perfectly
  const cleanRef = (str?: string | null): string => {
    if (!str) return '';
    return normalizeClean(str)
      .replace(/^(no|n°|nro|num|numero|cto|contrato|ov|oc)[\s.:_-]*/i, '')
      .replace(/^hboc0*/i, 'hboc')
      .replace(/^oc0*/i, 'oc')
      .replace(/[^a-z0-9]/g, '');
  };

  const isSameClientEntity = (name1?: string, name2?: string): boolean => {
    if (!name1 || !name2) return false;
    const n1 = normalizeClean(name1);
    const n2 = normalizeClean(name2);
    if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) return true;

    // Napoleón Franco Pareja / Casa del Niño / HBOC
    const isNap1 = /napoleon|infantil|casa del nino|especialidades|hboc/i.test(n1);
    const isNap2 = /napoleon|infantil|casa del nino|especialidades|hboc/i.test(n2);
    if (isNap1 && isNap2) return true;

    // Hospital Armando Pabón López
    const isPabon1 = /armando|pabon/i.test(n1);
    const isPabon2 = /armando|pabon/i.test(n2);
    if (isPabon1 && isPabon2) return true;

    // Word token overlap
    const toks1 = extractCleanTokens(name1);
    const toks2 = extractCleanTokens(name2);
    if (toks1.length > 0 && toks2.length > 0) {
      const set2 = new Set(toks2);
      const common = toks1.filter((t) => set2.has(t));
      if (common.length >= 2) return true;
    }

    return false;
  };

  const extractCleanTokens = (text?: string): string[] => {
    if (!text) return [];
    const stopWords = new Set([
      'de', 'del', 'la', 'el', 'los', 'las', 'para', 'con', 'por', 'en', 'un', 'una',
      'equipo', 'equipos', 'sistema', 'sistemas', 'unidad', 'unidades', 'medico', 'medica',
      'biomedico', 'biomedica', 'hospitalario', 'hospitalaria', 'clinico', 'clinica',
      'digital', 'fijo', 'portatil', 'tipo', 'marca', 'suministro', 'e', 'instalacion',
      'hospital', 'nacional', 'general', 'universal'
    ]);
    return normalizeClean(text)
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length >= 2 && !stopWords.has(w));
  };

  const matchesTenderItemWithTarget = (
    tIt: TenderItem,
    target: { id?: string; equipmentId?: string; code?: string; name?: string; brand?: string; model?: string; description?: string; equipmentName?: string }
  ): boolean => {
    if (!target) return false;
    if (tIt.equipmentId && target.equipmentId && tIt.equipmentId === target.equipmentId) return true;
    if (tIt.id && target.id && tIt.id === target.id) return true;

    const tCode = cleanRef(tIt.code);
    const targetCode = cleanRef(target.code || (target as any).equipmentCode || (target as any).codigo || (target as any).partNumber);
    const genericCodes = new Set(['eq', 'item', 'eq1', 'eq2', 'eq3', 'equipo', 'part', 'na', 'pendiente']);
    if (tCode && targetCode && !genericCodes.has(tCode) && !genericCodes.has(targetCode)) {
      if (tCode !== targetCode) {
        return false; // Different specific part codes (e.g. 70904 vs PENDIENTE) never match
      }
      return true;
    }

    const tModel = cleanRef(tIt.model);
    const targetModel = cleanRef(target.model || (target as any).modelo);
    if (tModel && targetModel && !genericCodes.has(tModel) && !genericCodes.has(targetModel)) {
      if (tModel !== targetModel && !tModel.includes(targetModel) && !targetModel.includes(tModel)) {
        return false; // Different specific models (e.g. DIGIEYE 350 vs MOBIEYE 700) never match
      }
      return true;
    }
    if (tModel && !genericCodes.has(tModel) && tModel.length >= 4) {
      const targetText = cleanRef((target.name || '') + ' ' + (target.model || '') + ' ' + ((target as any).description || ''));
      if (!targetText.includes(tModel)) {
        return false;
      }
    }

    const targetName = target.name || target.description || target.equipmentName || '';
    const tNorm = normalizeClean(tIt.name);
    const targetNorm = normalizeClean(targetName);
    if (tNorm && targetNorm && !genericCodes.has(tNorm) && !genericCodes.has(targetNorm)) {
      if (tNorm === targetNorm) return true;
      if (tNorm.length >= 6 && (targetNorm.includes(tNorm) || tNorm.includes(targetNorm))) return true;
    }

    return false;
  };

  const isStatusInTransit = (status?: string): boolean => {
    if (!status) return false;
    const s = normalizeClean(status);
    return (
      s.includes('transito') ||
      s.includes('despachad') ||
      s.includes('aduan')
    );
  };

  const isStatusDelivered = (status?: string): boolean => {
    if (!status) return false;
    if (isStatusInTransit(status)) return false;
    const s = normalizeClean(status);
    return (
      s === 'entregado e instalado' ||
      s === 'entregada al cliente' ||
      s === 'entregado en clinica' ||
      s === 'instalado / recibido' ||
      s === 'entregado' ||
      s === 'instalado' ||
      s === 'cerrado / concluido' ||
      s.includes('entregado e instalado') ||
      s.includes('acta de entrega')
    );
  };

  const tenderCodes = useMemo(() => {
    const set = new Set<string>();
    if (activeClient.header?.processNumber) set.add(cleanRef(activeClient.header.processNumber));
    if (activeClient.header?.clientOrderNumber) set.add(cleanRef(activeClient.header.clientOrderNumber));
    if (activeClient.linkedQuoteNumber) set.add(cleanRef(activeClient.linkedQuoteNumber));
    if (activeClient.id) set.add(cleanRef(activeClient.id));
    return Array.from(set).filter((c) => c.length >= 3);
  }, [activeClient]);

  /**
   * A contract/OV is "orphaned" when its tenderClientId no longer matches any
   * existing tender project (e.g. an old process that was re-created). Only in
   * that case we fall back to matching by client name; records that belong to
   * another existing tender must never leak into this tender's delivery status.
   */
  const isOrphanTenderLink = useCallback((tenderClientId?: string): boolean => {
    if (!tenderClientId) return true;
    try {
      const raw = localStorage.getItem('syd_tender_clients_v2');
      if (!raw) return true;
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) return true;
      return !list.some((t) => t && String(t.id) === String(tenderClientId));
    } catch {
      return true;
    }
  }, []);

  // 1. Verify equipment delivery in Seguimiento de OC (strictly for this specific tender/contract)
  const linkedContracts = useMemo(() => {
    return (contracts || []).filter((c) => {
      if (!c) return false;
      if (c.tenderClientId && (c.tenderClientId === activeClient.id || c.id === activeClient.id)) return true;
      if (c.id === activeClient.id) return true;

      const cCodes = [
        c.contractNumber,
        c.ocNumber,
        c.salesOrderNumber,
        ...(c.salesOrderNumbers || []),
        c.quoteNumber,
      ]
        .map(cleanRef)
        .filter((code) => code.length >= 3);

      const hasCodeMatch = tenderCodes.some((tCode) =>
        cCodes.some((cCode) => cCode === tCode || (cCode.length >= 4 && (cCode.includes(tCode) || tCode.includes(cCode))))
      );
      if (hasCodeMatch) return true;

      if (c.salesOrderId && (salesOrders || []).some((so) => (so.tenderClientId === activeClient.id || so.contractId === activeClient.id) && so.id === c.salesOrderId)) return true;
      if (c.id && (salesOrders || []).some((so) => (so.tenderClientId === activeClient.id || so.contractId === activeClient.id) && so.ocContractId === c.id)) return true;
      if (activeClient.linkedQuoteNumber && c.quoteNumber && normalizeClean(c.quoteNumber) === normalizeClean(activeClient.linkedQuoteNumber)) return true;
      if (activeClient.linkedQuoteId && c.quoteId === activeClient.linkedQuoteId) return true;

      // Only fall back to client-name matching for contracts that are not linked
      // to another existing tender. Otherwise an OC from a different tender of
      // the same client would contaminate this tender's delivery statuses.
      if (isOrphanTenderLink(c.tenderClientId) && isSameClientEntity(c.clientName, activeClient.clientName)) {
        return true;
      }
      return false;
    });
  }, [contracts, activeClient, tenderCodes, salesOrders, isOrphanTenderLink]);

  // 2. Verify invoicing & invoice attachment in Órdenes de Venta & Facturas (strictly for this tender project)
  const linkedOrders = useMemo(() => {
    return (salesOrders || []).filter((so) => {
      if (!so) return false;
      if (so.tenderClientId === activeClient.id || so.contractId === activeClient.id) return true;

      const soCodes = [so.contractNumber, so.salesOrderNumber, so.quoteNumber]
        .map(cleanRef)
        .filter((code) => code.length >= 3);

      const hasCodeMatch = tenderCodes.some((tCode) =>
        soCodes.some((soCode) => soCode === tCode || (soCode.length >= 4 && (soCode.includes(tCode) || tCode.includes(soCode))))
      );
      if (hasCodeMatch) return true;

      if (activeClient.linkedQuoteNumber && so.quoteNumber && normalizeClean(so.quoteNumber) === normalizeClean(activeClient.linkedQuoteNumber)) return true;
      if (activeClient.linkedQuoteId && so.quoteId === activeClient.linkedQuoteId) return true;
      if (so.ocContractId && linkedContracts.some((c) => c.id === so.ocContractId)) return true;

      // Same rule as contracts: do not pull OVs from a different existing tender
      // of the same client when they belong to another tender project.
      if (isOrphanTenderLink(so.tenderClientId) && isSameClientEntity(so.clientName, activeClient.clientName)) {
        return true;
      }
      return false;
    });
  }, [salesOrders, activeClient, tenderCodes, linkedContracts, isOrphanTenderLink]);

  // 3. Match relevant sales invoices for this tender project
  const linkedInvoices = useMemo(() => {
    const linkedOrderIds = new Set(linkedOrders.map((so) => so.id));
    const linkedOrderNums = new Set(linkedOrders.map((so) => cleanRef(so.salesOrderNumber)).filter(Boolean));

    return (salesInvoices || []).filter((inv) => {
      if (!inv) return false;
      if (inv.contractId && (inv.contractId === activeClient.id || inv.contractId === activeClient.header?.processNumber)) return true;
      if (inv.salesOrderId && linkedOrderIds.has(inv.salesOrderId)) return true;
      if (inv.salesOrderNumber && linkedOrderNums.has(cleanRef(inv.salesOrderNumber))) return true;

      const invCodes = [inv.contractNumber, inv.salesOrderNumber]
        .map(cleanRef)
        .filter((code) => code.length >= 3);

      const hasCodeMatch = tenderCodes.some((tCode) =>
        invCodes.some((invCode) => invCode === tCode || (invCode.length >= 4 && (invCode.includes(tCode) || tCode.includes(invCode))))
      );
      if (hasCodeMatch) return true;
      // Only fall back to client-name matching when the invoice is not already
      // attached to a specific contract/tender.
      if (!inv.contractId && isSameClientEntity(inv.clientName, activeClient.clientName)) return true;

      return false;
    });
  }, [salesInvoices, activeClient, tenderCodes, linkedOrders]);

  interface TenderItemDeliveryStatus {
    isDelivered: boolean;
    hasOC: boolean;
    hasOV?: boolean;
    ovNumber?: string;
    isInTransit: boolean;
    isPendingOC: boolean;
    isInvoiced: boolean;
    status: string;
    ocNumber?: string;
    invoiceNumber?: string;
  }

  // Check individual item delivery & invoicing status in Seguimiento de OC / OV / Facturas
  const getItemDeliveryStatus = useCallback(
    (tIt: TenderItem): TenderItemDeliveryStatus => {
      // 1. Search in linkedContracts (Seguimiento de OC a Proveedores)
      let foundOC: (OCTrackingItem & { contractOC?: string; contractGlobalStatus?: string }) | undefined;
      for (const c of linkedContracts) {
        for (const it of c.items || []) {
          if (matchesTenderItemWithTarget(tIt, it)) {
            foundOC = {
              ...it,
              contractOC: it.ocNumber || c.ocNumber || c.contractNumber,
              contractGlobalStatus: c.globalStatus,
            };
            break;
          }
        }
        if (foundOC) break;
      }

      // 2. Search in linkedOrders (Órdenes de Venta & Facturas de Venta)
      let foundSO: (SalesOrderItem & { parentOrder: SalesOrderRecord }) | undefined;
      for (const so of linkedOrders) {
        for (const sIt of so.items || []) {
          if (matchesTenderItemWithTarget(tIt, sIt)) {
            foundSO = { ...sIt, parentOrder: so };
            break;
          }
        }
        if (foundSO) break;
      }

      // 3. Invoicing comes ONLY from real invoice allocations for this item.
      //    Status flags (invoicedStatus / status) and OC supplier invoices are
      //    never trusted as proof that the client invoice covers this equipment.
      let itemInvoicedQty = 0;
      let itemTotalQty = 0;
      let itemInvoiceNumber = '';
      let orderHasItemLevelInvoices = false;
      let orderFullyInvoicedByValue = false;
      let orderInvoiceNumbers = '';

      if (foundSO) {
        const order = foundSO.parentOrder;
        const invData = computeOrderInvoicingData(order, linkedInvoices);
        orderHasItemLevelInvoices = invData.hasItemLevelInvoices;
        orderFullyInvoicedByValue = invData.isFullyInvoiced && !invData.hasItemLevelInvoices;
        orderInvoiceNumbers = invData.invoiceNumbers;

        const coverage =
          invData.itemCoverage.find((c) => c.item.id && c.item.id === foundSO!.id) ||
          invData.itemCoverage.find((c) => matchesTenderItemWithTarget(tIt, c.item));
        if (coverage) {
          itemInvoicedQty = coverage.invoicedQty;
          itemTotalQty = coverage.quantity;
        } else {
          itemTotalQty =
            Number(foundSO.quantityToDispatch ?? foundSO.quantity ?? 1) || 1;
        }

        if (itemInvoicedQty > 0) {
          itemInvoiceNumber =
            invData.orderInvoices
              .filter((inv) =>
                (inv.items || []).some(
                  (alloc) =>
                    alloc &&
                    (alloc.salesOrderItemId === foundSO!.id ||
                      matchesTenderItemWithTarget(tIt, alloc as any))
                )
              )
              .map((inv) => inv.invoiceNumber)
              .filter(Boolean)
              .join(', ') || orderInvoiceNumbers;
        }
      }

      const isInvoiced = Boolean(
        foundSO &&
          ((orderHasItemLevelInvoices &&
            itemTotalQty > 0 &&
            itemInvoicedQty >= itemTotalQty) ||
            orderFullyInvoicedByValue)
      );
      const invRef = isInvoiced
        ? itemInvoiceNumber || orderInvoiceNumbers
        : '';

      const ocRef =
        foundOC?.contractOC ||
        (foundSO as any)?.supplierOCRef ||
        (foundSO as any)?.supplierOCNumber ||
        (foundSO as any)?.linkedSupplierOCNumber ||
        (foundOC?.ocNumber || '');
      const ovRef =
        foundSO?.parentOrder?.salesOrderNumber || foundOC?.salesOrderNumber || '';
      const hasOC = Boolean(foundOC) || Boolean(ocRef);
      const hasOV = Boolean(foundSO) || Boolean(ovRef);

      // A. If found in OC Tracking:
      if (foundOC) {
        const inTransit = isStatusInTransit(foundOC.status);
        if (inTransit) {
          return {
            isDelivered: false,
            hasOC: true,
            hasOV: hasOV,
            ovNumber: ovRef,
            isInTransit: true,
            isPendingOC: false,
            isInvoiced,
            status: foundOC.status || 'En Tránsito / Despachada',
            ocNumber: ocRef,
            invoiceNumber: invRef,
          };
        }
        // Delivered only from a real manual item status / delivered quantity.
        // A contract global status never marks equipment as delivered.
        const isDelivered =
          isStatusDelivered(foundOC.status) ||
          (Boolean((foundOC as any).deliveredQuantity) &&
            ((foundOC as any).deliveredQuantity || 0) >= (foundOC.quantity || 1));
        if (isDelivered) {
          return {
            isDelivered: true,
            hasOC: true,
            hasOV: hasOV,
            ovNumber: ovRef,
            isInTransit: false,
            isPendingOC: false,
            isInvoiced,
            status: foundOC.status || 'Entregado e Instalado',
            ocNumber: ocRef,
            invoiceNumber: invRef,
          };
        }

        // Return exact status from OC Tracking (e.g. Borrador / Solicitud, Emitida, Confirmada, En Fabricación, etc.)
        return {
          isDelivered: false,
          hasOC: true,
          hasOV: hasOV,
          ovNumber: ovRef,
          isInTransit: false,
          isPendingOC: false,
          isInvoiced,
          status: foundOC.status || 'Borrador / Solicitud',
          ocNumber: ocRef,
          invoiceNumber: invRef,
        };
      }

      // B. If found in Sales Orders:
      if (foundSO) {
        const order = foundSO.parentOrder;
        const soItemStatus = foundSO.equipmentStatus;
        const inTransit = isStatusInTransit(soItemStatus) || isStatusInTransit(order.status);
        if (inTransit) {
          return {
            isDelivered: false,
            hasOC: hasOC,
            hasOV: true,
            ovNumber: order.salesOrderNumber,
            isInTransit: true,
            isPendingOC: !hasOC,
            isInvoiced,
            status: soItemStatus || 'En Tránsito',
            ocNumber: ocRef,
            invoiceNumber: invRef,
          };
        }
        const isItemDelivered = isStatusDelivered(soItemStatus);
        if (isItemDelivered) {
          return {
            isDelivered: true,
            hasOC: hasOC,
            hasOV: true,
            ovNumber: order.salesOrderNumber,
            isInTransit: false,
            isPendingOC: !hasOC,
            isInvoiced,
            status: soItemStatus || 'Entregado e Instalado',
            ocNumber: ocRef,
            invoiceNumber: invRef,
          };
        }

        return {
          isDelivered: false,
          hasOC: hasOC,
          hasOV: true,
          ovNumber: order.salesOrderNumber,
          isInTransit: false,
          isPendingOC: !hasOC,
          isInvoiced,
          status: hasOC ? 'OC Generada' : 'OV Asignada',
          ocNumber: ocRef,
          invoiceNumber: invRef,
        };
      }

      // C. Fallback checking general contract linkage:
      if (hasOC) {
        return {
          isDelivered: false,
          hasOC: true,
          hasOV: hasOV,
          ovNumber: ovRef,
          isInTransit: false,
          isPendingOC: false,
          isInvoiced: false,
          status: 'OC Generada',
          ocNumber: ocRef,
          invoiceNumber: invRef,
        };
      }

      if (hasOV) {
        return {
          isDelivered: false,
          hasOC: false,
          hasOV: true,
          ovNumber: ovRef,
          isInTransit: false,
          isPendingOC: true,
          isInvoiced: false,
          status: 'OV Asignada',
          ocNumber: ocRef,
          invoiceNumber: invRef,
        };
      }

      return {
        isDelivered: false,
        hasOC: false,
        hasOV: false,
        isInTransit: false,
        isPendingOC: true,
        isInvoiced: false,
        status: 'Pendiente de OC',
        ocNumber: ocRef,
      };
    },
    [linkedContracts, linkedOrders, linkedInvoices]
  );

  const itemsDeliveryStatuses = useMemo(() => {
    return items.map((it) => ({ item: it, delivery: getItemDeliveryStatus(it) }));
  }, [items, getItemDeliveryStatus]);

  const renderItemDeliveryBadge = (itemDelivery: TenderItemDeliveryStatus) => {
    if (itemDelivery.isInvoiced) {
      return (
        <span
          className="inline-flex items-center gap-0.5 text-[8.5px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded-md shrink-0 font-mono"
          title={`Facturado${itemDelivery.invoiceNumber ? `: ${itemDelivery.invoiceNumber}` : ''}`}
        >
          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
          <span>FACTURADO{itemDelivery.invoiceNumber ? ` (${itemDelivery.invoiceNumber})` : ''}</span>
        </span>
      );
    }

    if (itemDelivery.isDelivered) {
      return (
        <span
          className="inline-flex items-center gap-0.5 text-[8.5px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.2 rounded-md shrink-0"
          title={`Equipo entregado e instalado${itemDelivery.ocNumber ? ` (${itemDelivery.ocNumber})` : ''}`}
        >
          <CheckCircle2 className="w-2.5 h-2.5" />
          <span>ENTREGADO E INSTALADO</span>
        </span>
      );
    }

    if (itemDelivery.hasOC && itemDelivery.status) {
      const ocRef = itemDelivery.ocNumber ? ` (${itemDelivery.ocNumber})` : '';
      const normSt = itemDelivery.status.toLowerCase();

      if (normSt.includes('solicitud') || normSt.includes('borrador')) {
        return (
          <span
            className="inline-flex items-center gap-0.5 text-[8.5px] font-black bg-slate-700/80 text-slate-200 border border-slate-500/60 px-1.5 py-0.2 rounded-md shrink-0 font-mono"
            title={`Orden de compra en borrador / solicitud: ${itemDelivery.ocNumber || 'Sin N° OC'}`}
          >
            <Clock className="w-2.5 h-2.5 text-slate-300" />
            <span>BORRADOR / SOLICITUD{ocRef}</span>
          </span>
        );
      }

      if (normSt.includes('emitida') || normSt.includes('enviada')) {
        return (
          <span
            className="inline-flex items-center gap-0.5 text-[8.5px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/40 px-1.5 py-0.2 rounded-md shrink-0"
            title={`OC emitida al proveedor: ${itemDelivery.ocNumber || ''}`}
          >
            <Clock className="w-2.5 h-2.5 text-blue-400" />
            <span>EMITIDA AL PROVEEDOR{ocRef}</span>
          </span>
        );
      }

      if (normSt.includes('confirmada')) {
        return (
          <span
            className="inline-flex items-center gap-0.5 text-[8.5px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.2 rounded-md shrink-0"
            title={`OC confirmada por proveedor: ${itemDelivery.ocNumber || ''}`}
          >
            <CheckCircle2 className="w-2.5 h-2.5 text-indigo-400" />
            <span>CONFIRMADA{ocRef}</span>
          </span>
        );
      }

      if (normSt.includes('fabricacion') || normSt.includes('procesamiento')) {
        return (
          <span
            className="inline-flex items-center gap-0.5 text-[8.5px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded-md shrink-0"
            title={`En fabricación o procesamiento: ${itemDelivery.ocNumber || ''}`}
          >
            <Clock className="w-2.5 h-2.5 text-amber-400" />
            <span>EN FABRICACIÓN{ocRef}</span>
          </span>
        );
      }

      if (normSt.includes('transito') || normSt.includes('despachada')) {
        return (
          <span
            className="inline-flex items-center gap-0.5 text-[8.5px] font-black bg-sky-500/20 text-sky-400 border border-sky-500/40 px-1.5 py-0.2 rounded-md shrink-0"
            title={`Equipo en tránsito hacia el cliente / en proceso logístico: ${itemDelivery.ocNumber || ''}`}
          >
            <Truck className="w-2.5 h-2.5 text-sky-400" />
            <span>EN TRÁNSITO{ocRef}</span>
          </span>
        );
      }

      if (normSt.includes('aduana') || normSt.includes('nacionalizacion')) {
        return (
          <span
            className="inline-flex items-center gap-0.5 text-[8.5px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/40 px-1.5 py-0.2 rounded-md shrink-0"
            title={`En aduana / nacionalización: ${itemDelivery.ocNumber || ''}`}
          >
            <Truck className="w-2.5 h-2.5 text-purple-400" />
            <span>EN ADUANA{ocRef}</span>
          </span>
        );
      }

      if (normSt.includes('bodega')) {
        return (
          <span
            className="inline-flex items-center gap-0.5 text-[8.5px] font-black bg-teal-500/20 text-teal-300 border border-teal-500/40 px-1.5 py-0.2 rounded-md shrink-0"
            title={`Equipos en bodega SYD: ${itemDelivery.ocNumber || ''}`}
          >
            <PackageCheck className="w-2.5 h-2.5 text-teal-400" />
            <span>EN BODEGA SYD{ocRef}</span>
          </span>
        );
      }

      if (normSt.includes('ingreso') || normSt.includes('calidad')) {
        return (
          <span
            className="inline-flex items-center gap-0.5 text-[8.5px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-1.5 py-0.2 rounded-md shrink-0"
            title={`Ingreso técnico y control de calidad: ${itemDelivery.ocNumber || ''}`}
          >
            <Activity className="w-2.5 h-2.5 text-cyan-400" />
            <span>INGRESO TÉCNICO{ocRef}</span>
          </span>
        );
      }

      if (normSt.includes('listo para despacho')) {
        return (
          <span
            className="inline-flex items-center gap-0.5 text-[8.5px] font-black bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 px-1.5 py-0.2 rounded-md shrink-0"
            title={`Listo para despacho a cliente: ${itemDelivery.ocNumber || ''}`}
          >
            <Truck className="w-2.5 h-2.5 text-yellow-400" />
            <span>LISTO PARA DESPACHO{ocRef}</span>
          </span>
        );
      }

      if (normSt.includes('despachado al cliente')) {
        return (
          <span
            className="inline-flex items-center gap-0.5 text-[8.5px] font-black bg-blue-600/25 text-blue-300 border border-blue-500/50 px-1.5 py-0.2 rounded-md shrink-0"
            title={`Despachado al cliente: ${itemDelivery.ocNumber || ''}`}
          >
            <Truck className="w-2.5 h-2.5 text-blue-400" />
            <span>DESPACHADO AL CLIENTE{ocRef}</span>
          </span>
        );
      }

      return (
        <span
          className="inline-flex items-center gap-0.5 text-[8.5px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.2 rounded-md shrink-0 font-mono"
          title={`Estado OC: ${itemDelivery.status}`}
        >
          <Clock className="w-2.5 h-2.5 text-indigo-400" />
          <span>{itemDelivery.status.toUpperCase()}{ocRef}</span>
        </span>
      );
    }

    if (itemDelivery.hasOV) {
      return (
        <span
          className="inline-flex items-center gap-0.5 text-[8.5px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/40 px-1.5 py-0.2 rounded-md shrink-0"
          title={`Orden de Venta asignada${itemDelivery.ovNumber ? ` (OV: ${itemDelivery.ovNumber})` : ''}`}
        >
          <FileText className="w-2.5 h-2.5 text-blue-400" />
          <span>OV ASIGNADA{itemDelivery.ovNumber ? ` (${itemDelivery.ovNumber})` : ''}</span>
        </span>
      );
    }

    return (
      <span
        className="inline-flex items-center gap-0.5 text-[8.5px] font-black bg-amber-500/20 text-amber-400 border border-amber-500/40 px-1.5 py-0.2 rounded-md shrink-0"
        title="Falta generar la orden de compra a proveedor para este equipo"
      >
        <AlertCircle className="w-2.5 h-2.5 text-amber-400" />
        <span>PENDIENTE DE OC</span>
      </span>
    );
  };

  const deliveredItemsCount = useMemo(() => {
    return itemsDeliveryStatuses.filter((s) => s.delivery.isDelivered).length;
  }, [itemsDeliveryStatuses]);

  const itemsWithOCCount = useMemo(() => {
    return itemsDeliveryStatuses.filter((s) => s.delivery.hasOC).length;
  }, [itemsDeliveryStatuses]);

  const pendingOCCount = useMemo(() => {
    return itemsDeliveryStatuses.filter((s) => s.delivery.isPendingOC).length;
  }, [itemsDeliveryStatuses]);

  const inTransitCount = useMemo(() => {
    return itemsDeliveryStatuses.filter((s) => s.delivery.isInTransit).length;
  }, [itemsDeliveryStatuses]);

  const invoicedItemsCount = useMemo(() => {
    return itemsDeliveryStatuses.filter((s) => s.delivery.isInvoiced).length;
  }, [itemsDeliveryStatuses]);

  const allOCItemsDelivered = useMemo(() => {
    if (!items || items.length === 0) return false;
    return deliveredItemsCount === items.length;
  }, [items, deliveredItemsCount]);

  const allItemsHaveOC = useMemo(() => {
    if (!items || items.length === 0) return false;
    return itemsWithOCCount === items.length;
  }, [items, itemsWithOCCount]);

  const allItemsInvoiced = useMemo(() => {
    if (!items || items.length === 0) return false;
    return invoicedItemsCount === items.length;
  }, [items, invoicedItemsCount]);

  const hasOrders = linkedOrders.length > 0;
  const isOrderBilledAndUploaded =
    hasOrders &&
    linkedOrders.every((so) => {
      // Full invoicing is required: a partial invoice, an invoice number or a
      // loose file must never archive the tender.
      const isFullyInvoiced = computeOrderInvoicingData(so, salesInvoices || []).isFullyInvoiced;
      const hasInvoiceFile = Boolean(
        so.attachedInvoiceFile?.dataUrl ||
        (salesInvoices || []).some((inv) => (inv.salesOrderId === so.id || (so.salesOrderNumber && inv.salesOrderNumber === so.salesOrderNumber)) && Boolean(inv.attachedInvoiceFile?.dataUrl)) ||
        linkedInvoices.some((inv) => inv.salesOrderId === so.id || (so.salesOrderNumber && cleanRef(inv.salesOrderNumber) === cleanRef(so.salesOrderNumber)))
      );
      return isFullyInvoiced && hasInvoiceFile;
    });

  // Ready to fulfill requirement: both OC equipments delivered and invoice uploaded
  const isReadyToFulfill = items.length > 0 && allOCItemsDelivered && allItemsInvoiced && isOrderBilledAndUploaded;

  // Auto-mark as fulfilled when ALL conditions are 100% satisfied
  const fulfilledHandledForIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (isReadyToFulfill && activeClient.status !== 'Cumplido / Archivado' && fulfilledHandledForIdRef.current !== activeClient.id) {
      fulfilledHandledForIdRef.current = activeClient.id;
      onUpdateClient(activeClient.id, { status: 'Cumplido / Archivado' });
    }
  }, [isReadyToFulfill, activeClient.id, activeClient.status, onUpdateClient]);

  // Auto-revert if contract was prematurely marked as 'Cumplido / Archivado' but actually has items in transit, pending OC or pending invoicing
  const autoRevertedRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      activeClient.status === 'Cumplido / Archivado' &&
      (!allOCItemsDelivered || !allItemsInvoiced) &&
      autoRevertedRef.current !== activeClient.id
    ) {
      autoRevertedRef.current = activeClient.id;
      onUpdateClient(activeClient.id, { status: 'Adjudicada' });
    }
  }, [activeClient.status, allOCItemsDelivered, allItemsInvoiced, activeClient.id, onUpdateClient]);

  const handleStatusChange = (newStatus: TenderClientProject['status']) => {
    onUpdateClient(activeClient.id, { status: newStatus });
  };

  const handleConfirmClearTable = () => {
    onUpdateClient(activeClient.id, { items: [] });
    setIsConfirmClearModalOpen(false);
  };

  return (
    <div className="space-y-3 animate-fadeIn min-w-0 w-full">
      {/* Contract Status & Executive Overview Banner (Compact & High-Density) */}
      <div className="bg-[#192b45] border border-[#334d6e] rounded-xl p-3 shadow-md space-y-2.5 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-[#334d6e]">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-[11px] font-mono font-bold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
              {formatTenderProcessNumber(activeClient)}
            </span>
            <h3 className="text-sm sm:text-base font-black text-white truncate">
              {activeClient.clientName}
            </h3>
            {isFulfilled && allOCItemsDelivered ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full shadow-xs">
                <CheckCircle2 className="w-3 h-3 text-purple-300" />
                <span>CUMPLIDO / ARCHIVADO (100% Entregado)</span>
              </span>
            ) : isFulfilled && !allOCItemsDelivered ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full shadow-xs">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>EN PROCESO ({deliveredItemsCount}/{items.length} Entregados)</span>
              </span>
            ) : isAwarded ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full shadow-xs">
                <Award className="w-3 h-3" />
                <span>ADJUDICADA</span>
              </span>
            ) : (
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                {activeClient.status || 'En Preparación'}
              </span>
            )}
            <span className="text-xs text-slate-400 font-medium truncate">• {activeClient.header.city}</span>
          </div>

          {/* Status Quick Switcher & Actions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {!isReadOnly && (
              <>
                {!isFulfilled ? (
                  isReadyToFulfill ? (
                    <button
                      type="button"
                      onClick={() => handleStatusChange('Cumplido / Archivado')}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-950 bg-emerald-400 hover:bg-emerald-300 px-3 py-1.5 rounded-lg font-black transition cursor-pointer shadow-sm active:scale-95"
                      title="Equipos entregados en OC y facturados con soporte. Clic para marcar cumplido y archivar."
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Marcar Cumplido / Archivado</span>
                    </button>
                  ) : (
                    <div
                      className="inline-flex items-center gap-1.5 text-[10.5px] bg-[#111c2e] border border-[#334d6e] text-slate-300 px-2.5 py-1 rounded-lg"
                      title={`Desglose operativo: ${deliveredItemsCount}/${items.length} equipos entregados, ${itemsWithOCCount}/${items.length} con OC generada, ${invoicedItemsCount}/${items.length} facturados.`}
                    >
                      <Clock className="w-3 h-3 text-sky-400 shrink-0" />
                      <span className="flex items-center gap-1.5 flex-wrap">
                        {linkedOrders.length > 0 && (
                          <>
                            <span className="text-slate-400">OV:</span>{' '}
                            <strong className="text-blue-300 font-mono">
                              {Array.from(new Set(linkedOrders.map((o) => o.salesOrderNumber).filter(Boolean))).join(', ')}
                            </strong>
                            <span className="text-slate-500">•</span>
                          </>
                        )}
                        <span className="text-slate-400">OC:</span>{' '}
                        <strong
                          className={
                            allOCItemsDelivered
                              ? 'text-emerald-400'
                              : itemsWithOCCount > 0 || linkedContracts.length > 0
                              ? 'text-sky-400'
                              : 'text-amber-400'
                          }
                        >
                          {allOCItemsDelivered
                            ? `Entregados ✓ (${deliveredItemsCount}/${items.length})`
                            : linkedContracts.length > 0
                            ? Array.from(new Set(linkedContracts.map((c) => c.ocNumber || c.contractNumber).filter(Boolean))).join(', ') || `${itemsWithOCCount}/${items.length} con OC`
                            : itemsWithOCCount > 0
                            ? `${itemsWithOCCount}/${items.length} con OC`
                            : 'Pendiente de OC'}
                        </strong>
                        <span className="text-slate-500">•</span>
                        <span className="text-slate-400">Factura:</span>{' '}
                        <strong
                          className={
                            (allItemsInvoiced && isOrderBilledAndUploaded) || linkedInvoices.length > 0
                              ? 'text-emerald-400 font-mono'
                              : invoicedItemsCount > 0
                              ? 'text-sky-400 font-mono'
                              : 'text-amber-400'
                          }
                        >
                          {linkedInvoices.length > 0
                            ? Array.from(new Set(linkedInvoices.map((inv) => inv.invoiceNumber).filter(Boolean))).join(', ')
                            : allItemsInvoiced && isOrderBilledAndUploaded
                            ? `Subida ✓ (${invoicedItemsCount}/${items.length})`
                            : invoicedItemsCount > 0
                            ? `${invoicedItemsCount}/${items.length} Facturados`
                            : 'Pendiente'}
                        </strong>
                      </span>
                    </div>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStatusChange('Adjudicada')}
                    className="inline-flex items-center gap-1 text-xs text-slate-300 bg-[#15253d] hover:bg-[#1e314b] border border-[#334d6e] px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
                  >
                    <span>Reabrir Contrato</span>
                  </button>
                )}

                {isFulfilled && !allOCItemsDelivered && (
                  <button
                    type="button"
                    onClick={() => handleStatusChange('Adjudicada')}
                    className="inline-flex items-center gap-1 text-xs text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
                    title="Este contrato tiene equipos en proceso o pendientes. Clic para reactivar a Adjudicada."
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reactivar a Adjudicada</span>
                  </button>
                )}

                {onCreateSalesOrder && (
                  <button
                    type="button"
                    onClick={() => onCreateSalesOrder(activeClient)}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-950 bg-amber-400 hover:bg-amber-300 px-3 py-1.5 rounded-lg font-black transition cursor-pointer shadow-sm active:scale-95"
                    title="Crear una Orden de Venta en Despacho & Facturación con los equipos pendientes de este contrato"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>+ Generar OV</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onOpenEditClientModal}
                  className="inline-flex items-center gap-1 text-xs text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 px-2.5 py-1 rounded-lg border border-amber-500/30 font-bold transition cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Editar</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Compact Financial & Quantity Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2 text-xs min-w-0">
          <div className="bg-[#15253d] px-2.5 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/20">
            <span className="text-[9.5px] text-emerald-300 font-bold block">
              Presupuesto Contrato
            </span>
            <strong className="text-xs sm:text-sm font-black text-emerald-300 block truncate">
              {activeClient.header.budgetCOP > 0 ? formatCOP(activeClient.header.budgetCOP) : 'Sin definir'}
            </strong>
          </div>

          <div className="bg-[#15253d] px-2.5 py-1.5 rounded-lg border border-[#334d6e]">
            <span className="text-[9.5px] text-slate-400 block font-medium">Equipos / Ítems</span>
            <strong className="text-xs sm:text-sm font-bold text-white block truncate">{items.length} Tipos ({totalUnits} ud)</strong>
          </div>

          <div className="bg-[#15253d] px-2.5 py-1.5 rounded-lg border border-[#334d6e]">
            <span className="text-[9.5px] text-slate-400 block font-medium">Subtotal sin IVA</span>
            <strong className="text-xs sm:text-sm font-bold text-slate-200 block truncate">{formatCOP(totalSubtotalCOP)}</strong>
          </div>

          <div className="bg-[#15253d] px-2.5 py-1.5 rounded-lg border border-[#334d6e]">
            <span className="text-[9.5px] text-amber-400/90 block font-medium">Total Contrato (IVA)</span>
            <strong className="text-xs sm:text-sm font-black text-amber-300 block truncate">{formatCOP(grandTotalCOP)}</strong>
          </div>

          <div className="bg-[#15253d] px-2.5 py-1.5 rounded-lg border border-sky-500/40">
            <span className="text-[9.5px] text-sky-300 font-bold block truncate">
              Plazo Ejecución
            </span>
            <strong className="text-xs font-black text-white truncate block">
              {activeClient.header.executionTerm || 'No especificado'}
            </strong>
          </div>

          <div className="bg-[#15253d] px-2.5 py-1.5 rounded-lg border border-purple-500/40">
            <span className="text-[9.5px] text-purple-300 font-bold block truncate">
              Especificaciones
            </span>
            <strong className="text-xs font-black text-purple-200 truncate block">
              {totalSpecsCount} Requisitos
            </strong>
          </div>
        </div>
      </div>

      {/* Equipment Table for this Contract with Integrated Compact Actions */}
      <div className="bg-[#192b45] border border-[#334d6e] rounded-xl overflow-hidden shadow-md min-w-0 w-full">
        <div className="bg-[#15253d] px-3.5 py-2.5 border-b border-[#334d6e] flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Listado de Equipos del Contrato ({items.length})</span>
            </h4>
            <span className="text-[10px] text-purple-300 font-bold bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">
              {totalUnits} unidades
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={onDownloadExcelTemplate}
              className="inline-flex items-center gap-1 text-[11px] text-slate-300 bg-[#111c2e] hover:bg-[#1e314b] hover:text-white px-2.5 py-1.5 rounded-lg border border-[#334d6e] font-bold transition cursor-pointer"
              title="Descargar plantilla Excel"
            >
              <Download className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span className="hidden sm:inline">Plantilla Excel</span>
            </button>

            {!isReadOnly && (
              <>
                <button
                  type="button"
                  onClick={onOpenExcelImportModal}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-950 bg-emerald-400 hover:bg-emerald-300 px-3 py-1.5 rounded-lg font-black transition cursor-pointer shadow-xs active:scale-95"
                  title="Importar archivo Excel con equipos"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Importar Excel</span>
                </button>

                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsConfirmClearModalOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] text-rose-300 hover:text-white bg-rose-500/15 hover:bg-rose-600/80 border border-rose-500/30 px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer"
                    title="Eliminar todos los equipos para dejar la tabla nueva y limpia"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Vaciar Tabla</span>
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => onSwitchToSpecificationsTab()}
              className="inline-flex items-center gap-1 text-[11px] text-purple-300 hover:text-white bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ml-1"
            >
              <span>Specs ({totalSpecsCount})</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Modal de Confirmación para Vaciar Tabla */}
        {isConfirmClearModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
            <div className="bg-[#192b45] border border-rose-500/50 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-scaleUp">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  <h3 className="text-base font-black text-white">¿Vaciar toda la tabla de equipos?</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Se eliminarán los <strong className="text-rose-300">{items.length} equipos</strong> registrados en este contrato junto con sus especificaciones para dejar la tabla completamente limpia y nueva.
                  </p>
                </div>
              </div>

              <div className="bg-[#111c2e] p-3 rounded-xl border border-[#334d6e] text-[11px] text-slate-300">
                <p>✓ La tabla quedará vacía lista para importar un nuevo archivo Excel o agregar nuevos equipos.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#334d6e]">
                <button
                  type="button"
                  onClick={() => setIsConfirmClearModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-[#15253d] transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClearTable}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer shadow-lg active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Sí, Vaciar y Dejar Nueva</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="p-3 bg-purple-500/10 text-purple-300 rounded-full w-14 h-14 mx-auto flex items-center justify-center border border-purple-500/20">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-white">No hay equipos registrados en este contrato aún</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Utilice los botones de la barra superior para adjuntar su archivo Excel (.xlsx), agregar equipos desde el catálogo o registrar un equipo manual.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#111e30] text-slate-300 font-bold border-b border-[#334d6e]">
                <tr>
                  <th className="p-2.5 text-center w-10 text-slate-400">#</th>
                  {TENDER_ITEM_COLUMNS.map((col) => (
                    <th
                      key={col.id}
                      className="p-2.5"
                      style={{ minWidth: col.minWidth, width: col.width }}
                    >
                      <ExcelColumnHeader
                        column={col}
                        allRows={items}
                        filters={excelFilters}
                        sort={excelSort}
                        onApplyFilter={onApplyFilter}
                        onApplySort={onApplySort}
                        onClearColumnFilter={onClearColumnFilter}
                      />
                    </th>
                  ))}
                  <th className="p-2.5 text-right w-20 whitespace-nowrap sticky right-0 z-20 bg-[#111e30] border-l border-[#334d6e]/60 shadow-[-4px_0_6px_rgba(0,0,0,0.35)]">
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Acciones</span>
                      {isFilteredOrSorted && (
                        <button
                          type="button"
                          onClick={onResetAllFilters}
                          className="inline-flex items-center gap-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded px-1.5 py-0.5 text-[10px] font-bold transition cursor-pointer"
                          title="Restablecer filtros Excel"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>Limpiar</span>
                        </button>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334d6e]/50">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-6 text-slate-400 text-xs">
                      No se encontraron equipos con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => {
                  const itemSpecsCount = item.requirements?.length || 0;
                  const itemUniqueCount = item.requirements?.filter((r) => r.isUnique)?.length || 0;
                  const qty = item.quantity || 1;
                  const unitSinIVA = item.offeredUnitPrice || 0;
                  const itemTaxRate = item.taxRate !== undefined ? item.taxRate : defaultTaxRate;
                  const unitConIVA = Math.round(unitSinIVA * (1 + itemTaxRate));
                  const rowSubtotalSinIVA = qty * unitSinIVA;
                  const rowTotalConIVA = Math.round(rowSubtotalSinIVA * (1 + itemTaxRate));
                  const itemDelivery = getItemDeliveryStatus(item);

                    return (
                    <tr
                      key={item.id}
                      className={`transition ${
                        itemDelivery.isInvoiced
                          ? "bg-[#09121d]/90 opacity-70 hover:opacity-100 border-l-2 border-l-purple-500"
                          : itemDelivery.isDelivered
                          ? "bg-[#0a1422]/80 opacity-90 hover:opacity-100 border-l-2 border-l-emerald-500"
                          : itemDelivery.isInTransit
                          ? "bg-[#0c1c2e]/60 hover:bg-[#15253d] border-l-2 border-l-sky-500"
                          : itemDelivery.hasOC
                          ? "bg-[#131b2e]/60 hover:bg-[#17263c] border-l-2 border-l-indigo-500/70"
                          : "hover:bg-[#17263c] border-l-2 border-l-amber-500/50"
                      }`}
                    >
                      <td className="p-2.5 text-center font-mono font-bold text-purple-300">{idx + 1}</td>
                      <td className="p-2.5 font-mono text-[11px] font-bold whitespace-nowrap">
                        {(() => {
                          const displayCode = resolveItemCode(item);
                          const isPending = !displayCode || displayCode.toUpperCase() === 'PENDIENTE' || displayCode === '-';
                          return (
                            <span
                              className={
                                itemDelivery.isInvoiced
                                  ? "line-through text-slate-500 decoration-rose-400/80 decoration-2 font-semibold"
                                  : isPending
                                  ? "text-amber-400 font-bold"
                                  : "text-[#38bdf8]"
                              }
                            >
                              {displayCode}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-2.5 font-bold text-white">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={itemDelivery.isInvoiced ? "line-through text-slate-400 decoration-rose-400/80 decoration-2 font-normal" : "text-white"}
                            title={item.name}
                          >
                            {item.name}
                          </span>
                          {renderItemDeliveryBadge(itemDelivery)}
                        </div>
                        {item.observations && (
                          <span className="text-[10px] text-slate-400 block font-normal truncate max-w-xs">
                            {item.observations}
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-300">
                        <div className={`font-semibold truncate ${itemDelivery.isInvoiced ? 'line-through text-slate-500 decoration-rose-400/80' : 'text-slate-200'}`}>
                          {item.brand}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">{item.model}</div>
                      </td>
                      <td className="p-2.5 text-center">
                        <input
                          type="number"
                          min="1"
                          disabled={isReadOnly}
                          value={item.quantity}
                          onChange={(e) =>
                            onUpdateTenderItem(activeClient.id, item.id, {
                              quantity: Math.max(1, parseInt(e.target.value) || 1),
                            })
                          }
                          className="w-12 bg-[#111c2e] border border-[#334d6e] rounded text-center py-1 text-xs font-bold text-white outline-none focus:border-purple-400"
                        />
                      </td>
                      {/* Precio Unitario (Sin IVA) + Subtexto con IVA */}
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          min="0"
                          disabled={isReadOnly}
                          value={item.offeredUnitPrice}
                          onChange={(e) =>
                            onUpdateTenderItem(activeClient.id, item.id, {
                              offeredUnitPrice: Math.max(0, parseInt(e.target.value) || 0),
                            })
                          }
                          className="w-24 bg-[#111c2e] border border-[#334d6e] rounded text-right py-0.5 px-1.5 text-xs text-white font-mono font-bold outline-none focus:border-purple-400"
                        />
                        <div className="text-[10px] text-emerald-400 font-mono mt-0.5 whitespace-nowrap" title="Precio unitario con IVA incluido">
                          c/IVA: <span className="font-semibold">{formatCOP(unitConIVA)}</span>
                        </div>
                      </td>
                      {/* Subtotal sin IVA */}
                      <td className={`p-2.5 text-right font-mono font-semibold whitespace-nowrap ${itemDelivery.isInvoiced ? 'line-through text-slate-500 decoration-rose-400/80' : 'text-slate-200'}`}>
                        {formatCOP(rowSubtotalSinIVA)}
                      </td>
                      {/* Total con IVA */}
                      <td className={`p-2.5 text-right font-mono font-bold whitespace-nowrap ${itemDelivery.isInvoiced ? 'line-through text-slate-500 decoration-rose-400/80 bg-slate-950/20' : 'text-emerald-300 bg-emerald-950/10'}`}>
                        {formatCOP(rowTotalConIVA)}
                      </td>
                      {/* Especificaciones */}
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => onSwitchToSpecificationsTab(item.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-300 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 px-2 py-0.5 rounded-lg transition cursor-pointer whitespace-nowrap"
                          title="Ver y configurar especificaciones técnicas de este equipo"
                        >
                          <span>{itemSpecsCount} Specs</span>
                          {itemUniqueCount > 0 && (
                            <span className="inline-flex items-center text-amber-300 font-bold gap-0.5">
                              <ShieldCheck className="w-2.5 h-2.5 text-amber-400" />
                              <span>{itemUniqueCount}</span>
                            </span>
                          )}
                        </button>
                      </td>
                      {/* Acciones (Sticky to the right edge) */}
                      <td className="p-2.5 text-right whitespace-nowrap sticky right-0 z-10 bg-[#17263c] border-l border-[#334d6e]/50 shadow-[-4px_0_6px_rgba(0,0,0,0.3)]">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onSwitchToSpecificationsTab(item.id)}
                            className="p-1 rounded-lg text-purple-300 hover:text-white bg-purple-500/15 hover:bg-purple-500/25 transition cursor-pointer"
                            title="Editar especificaciones técnicas de este equipo"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => onDeleteTenderItem(activeClient.id, item.id)}
                              className="p-1 rounded-lg text-rose-400 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 transition cursor-pointer"
                              title="Eliminar este equipo del contrato"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
              {/* Table Footer with Summary */}
              <tfoot className="bg-[#101c2d] border-t-2 border-[#334d6e] text-xs font-bold">
                <tr>
                  <td colSpan={4} className="p-3 text-right text-slate-300">
                    TOTALES GENERALES DEL CONTRATO ({items.length} ítems):
                  </td>
                  <td className="p-3 text-center text-purple-300 font-mono">
                    {totalUnits} ud
                  </td>
                  <td className="p-3 text-right text-slate-400 text-[11px]">
                    Subtotal s/IVA:
                  </td>
                  <td className="p-3 text-right text-slate-100 font-mono">
                    {formatCOP(totalSubtotalCOP)}
                  </td>
                  <td className="p-3 text-right text-emerald-300 font-mono text-sm bg-emerald-950/20">
                    {formatCOP(grandTotalCOP)}
                  </td>
                  <td colSpan={2} className="p-3 text-right text-[11px] text-amber-300/90 font-mono sticky right-0 z-10 bg-[#101c2d] border-l border-[#334d6e]/50 shadow-[-4px_0_6px_rgba(0,0,0,0.35)] whitespace-nowrap">
                    IVA 19%: {formatCOP(totalIvaCOP)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
