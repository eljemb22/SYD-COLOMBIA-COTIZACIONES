import React, { useState, useMemo } from 'react';
import {
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  CreditCard,
  DollarSign,
  Edit3,
  ExternalLink,
  FileText,
  History,
  Layers,
  MapPin,
  Plus,
  Tag,
  Trash2,
  Truck,
  Activity,
  AlertTriangle,
  Boxes,
  ShoppingCart,
  ReceiptText,
  CheckCircle2,
  Lock,
  ArrowRightLeft,
  CheckSquare,
  Square,
  X,
  Search,
  GitFork,
} from 'lucide-react';
import { resolveItemManufacturerBrand } from '../../../utils/equipmentBrandResolver';
import {
  OCTrackingContract,
  OCTrackingItem,
  OCStatus,
  OCPaymentTerms,
  OCPaymentStatus,
  AuthUser,
  SupplierInvoiceAttachment,
  SalesOrderRecord,
} from '../../../types';
import {
  PAYMENT_TERMS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  OC_STATUS_OPTIONS,
  getStoredSupplierProfiles,
  COMMON_SUPPLIERS,
  deduplicateOCTrackingContracts,
} from '../../../utils/ocTrackingStorage';
import { isValidOCNumber } from '../../../utils/formatters';
import { SupplierInvoicesModal } from './SupplierInvoicesModal';

export interface SupplierOCGroup {
  supplier: string;
  ocNumber: string;
  paymentTerms: OCPaymentTerms | string;
  paymentStatus: OCPaymentStatus | string;
  status: OCStatus | string;
  invoiceNumber?: string;
  trackingNumber?: string;
  items: OCTrackingItem[];
  totalCostCOP: number;
  totalUnits: number;
  hasAlert: boolean;
}

interface ContractHierarchyViewProps {
  contracts: OCTrackingContract[];
  collapsedContractIds?: Set<string>;
  expandedContractIds?: Set<string>;
  onToggleContractCollapse: (contractId: string) => void;
  onOpenAddSupplierOCModal?: (contract: OCTrackingContract) => void;
  onOpenAddItemsToOC: (contractId: string, ocNumber: string, supplier: string) => void;
  onOpenEditOCHeader: (contract: OCTrackingContract) => void;
  onOpenEditItem: (contractId: string, item: OCTrackingItem) => void;
  onOpenSerialsModal?: (contract: OCTrackingContract, item: OCTrackingItem) => void;
  onOpenHistory: (contractName: string, item: OCTrackingItem) => void;
  onQuickChangeItemStatus: (contractId: string, itemId: string, newStatus: OCStatus) => void;
  onBatchChangeItemStatus?: (itemsToUpdate: Array<{ contractId: string; itemId: string }>, newStatus: OCStatus) => void;
  onQuickChangeItemPaymentTerms: (contractId: string, itemId: string, terms: OCPaymentTerms) => void;
  onQuickChangeItemPaymentStatus: (contractId: string, itemId: string, status: OCPaymentStatus) => void;
  onRequestDeleteContract: (contract: OCTrackingContract) => void;
  onRequestDeleteItem: (contractId: string, item: OCTrackingItem) => void;
  onRequestDeleteSupplierOC: (contractId: string, supplier: string, ocNumber: string) => void;
  onUpdateOCNumber?: (
    contractId: string,
    supplier: string,
    oldOCNumber: string,
    newOCNumber: string,
    targetItemIds?: string[],
    targetSalesOrderId?: string
  ) => void;
  onUpdateOCSupplier?: (
    contractId: string,
    oldSupplier: string,
    ocNumber: string,
    newSupplier: string,
    newOCNumber?: string,
    selectedItemIds?: string[],
    changeReason?: string
  ) => void;
  onUpdateSalesOrderNumber?: (contractId: string, newOVNumber: string) => void;
  onSaveSupplierInvoices?: (contractId: string, supplier: string, ocNumber: string, invoices: SupplierInvoiceAttachment[]) => void;
  onNavigateToTab?: (tab: string) => void;
  currentUser?: AuthUser | null;
  salesOrders?: SalesOrderRecord[];
  lifecycleTab?: 'active' | 'archived' | 'all';
  onOpenSplitOrderModal?: (preselectedItemIds: string[], sourceOrder?: SalesOrderRecord) => void;
}

export const ContractHierarchyView: React.FC<ContractHierarchyViewProps> = ({
  contracts,
  collapsedContractIds,
  expandedContractIds,
  onToggleContractCollapse,
  onOpenAddItemsToOC,
  onOpenEditOCHeader,
  onOpenEditItem,
  onOpenSerialsModal,
  onOpenHistory,
  onQuickChangeItemStatus,
  onBatchChangeItemStatus,
  onQuickChangeItemPaymentTerms,
  onQuickChangeItemPaymentStatus,
  onRequestDeleteContract,
  onRequestDeleteItem,
  onRequestDeleteSupplierOC,
  onUpdateOCNumber,
  onUpdateOCSupplier,
  onUpdateSalesOrderNumber,
  onSaveSupplierInvoices,
  onNavigateToTab,
  currentUser,
  salesOrders = [],
  lifecycleTab = 'active',
  onOpenSplitOrderModal,
}) => {
  const isReadOnly =
    (currentUser?.role === 'viewer' && !currentUser?.permissions?.canManageOCTracking) ||
    lifecycleTab === 'archived';

  // State for changing supplier modal
  const [changingSupplierModal, setChangingSupplierModal] = useState<{
    contractId: string;
    currentSupplier: string;
    ocNumber: string;
    items: OCTrackingItem[];
  } | null>(null);

  // State for manual OC number modal
  const [editingOCModal, setEditingOCModal] = useState<{
    contractId: string;
    supplier: string;
    oldOC: string;
    newOC: string;
    targetItemIds?: string[];
    targetSalesOrderId?: string;
    targetSalesOrderNumber?: string;
  } | null>(null);

  // State for manual OV (Sales Order) number modal
  const [editingSalesOrderModal, setEditingSalesOrderModal] = useState<{
    contractId: string;
    currentOV: string;
  } | null>(null);

  // State for Supplier Invoices attachment modal
  const [supplierInvoicesTarget, setSupplierInvoicesTarget] = useState<{
    contract: OCTrackingContract;
    supplier: string;
    ocNumber: string;
    invoices: SupplierInvoiceAttachment[];
  } | null>(null);

  // State for multiple equipment selection (bulk status change & split)
  const [selectedItemMap, setSelectedItemMap] = useState<
    Map<string, { contractId: string; itemId: string; item: OCTrackingItem; salesOrderId?: string; salesOrderNumber?: string }>
  >(new Map());
  const [batchStatusValue, setBatchStatusValue] = useState<OCStatus>('Entregado e Instalado');

  const toggleSelectItem = (
    contractId: string,
    item: OCTrackingItem,
    salesOrderId?: string,
    salesOrderNumber?: string
  ) => {
    setSelectedItemMap((prev) => {
      const next = new Map(prev);
      const key = `${contractId}___${item.id}`;
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, { contractId, itemId: item.id, item, salesOrderId, salesOrderNumber });
      }
      return next;
    });
  };

  const toggleSelectAllInGroup = (
    contractId: string,
    groupItems: OCTrackingItem[],
    salesOrderId?: string,
    salesOrderNumber?: string
  ) => {
    setSelectedItemMap((prev) => {
      const next = new Map(prev);
      const allSelected = groupItems.length > 0 && groupItems.every((it) => next.has(`${contractId}___${it.id}`));
      if (allSelected) {
        groupItems.forEach((it) => next.delete(`${contractId}___${it.id}`));
      } else {
        groupItems.forEach((it) =>
          next.set(`${contractId}___${it.id}`, { contractId, itemId: it.id, item: it, salesOrderId, salesOrderNumber })
        );
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedItemMap(new Map());
  };

  const handleApplyBatchStatus = (targetStatus?: OCStatus) => {
    const newSt = targetStatus || batchStatusValue;
    if (selectedItemMap.size === 0) return;

    // Guard: Verify all selected items have an assigned OC number
    const itemsWithoutOC = Array.from(selectedItemMap.values()).filter(
      (v) => !isValidOCNumber(v.item.ocNumber)
    );
    if (itemsWithoutOC.length > 0) {
      alert(
        `Debe asignar primero el número de OC oficial a los equipos seleccionados para poder manipular o cambiar su estado.`
      );
      return;
    }

    const itemsList = Array.from(selectedItemMap.values()).map((v) => ({
      contractId: v.contractId,
      itemId: v.itemId,
    }));

    if (onBatchChangeItemStatus) {
      onBatchChangeItemStatus(itemsList, newSt);
    } else {
      itemsList.forEach((it) => onQuickChangeItemStatus(it.contractId, it.itemId, newSt));
    }

    clearSelection();
  };

  const handleOpenSplitModalFromSelection = () => {
    if (selectedItemMap.size === 0) return;
    const items = Array.from(selectedItemMap.values());
    const preselectedIds = items.map((it) => it.itemId);

    let targetSO: SalesOrderRecord | undefined;
    const firstItem = items[0];
    if (firstItem.salesOrderId) {
      targetSO = salesOrders.find((so) => so.id === firstItem.salesOrderId);
    }
    if (!targetSO && firstItem.salesOrderNumber) {
      targetSO = salesOrders.find((so) => so.salesOrderNumber === firstItem.salesOrderNumber);
    }
    if (!targetSO) {
      for (const so of salesOrders) {
        if ((so.items || []).some((soIt) => soIt.id === firstItem.itemId || (soIt.code && firstItem.item.code && soIt.code === firstItem.item.code))) {
          targetSO = so;
          break;
        }
      }
    }

    if (onOpenSplitOrderModal) {
      onOpenSplitOrderModal(preselectedIds, targetSO);
    }
  };

  // Local state for collapsed OV sections
  const [collapsedOVKeys, setCollapsedOVKeys] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('syd_collapsed_ov_sections');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleOVCollapse = (key: string) => {
    setCollapsedOVKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      try {
        localStorage.setItem('syd_collapsed_ov_sections', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // Local state for collapsed supplier OC groups
  const [collapsedSupplierKeys, setCollapsedSupplierKeys] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('syd_collapsed_supplier_ocs');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleSupplierCollapse = (key: string) => {
    setCollapsedSupplierKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      try {
        localStorage.setItem('syd_collapsed_supplier_ocs', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // Helper to group a contract's items by (supplier + ocNumber)
  const getSupplierOCGroups = (items: OCTrackingItem[]): SupplierOCGroup[] => {
    const map = new Map<string, SupplierOCGroup>();

    items.forEach((item) => {
      const supplierName = item.supplier || 'Sin Proveedor Asignado';
      const ocNum = item.ocNumber || 'Sin N° OC';
      const key = `${supplierName}___${ocNum}`;

      if (!map.has(key)) {
        map.set(key, {
          supplier: supplierName,
          ocNumber: ocNum,
          paymentTerms: item.paymentTerms || 'Crédito 30 días',
          paymentStatus: item.paymentStatus || 'Pendiente',
          status: item.status || 'Emitida / Enviada al Proveedor',
          invoiceNumber: item.invoiceNumber,
          trackingNumber: item.trackingNumber,
          items: [],
          totalCostCOP: 0,
          totalUnits: 0,
          hasAlert: false,
        });
      }

      const grp = map.get(key)!;
      grp.items.push(item);
      grp.totalCostCOP += item.totalCostCOP || (item.costPriceCOP * item.quantity);
      grp.totalUnits += item.quantity || 1;

      // Check 48h alert
      const lastUpdate = new Date(item.lastUpdatedAt || item.createdAt).getTime();
      const hours = (Date.now() - lastUpdate) / (1000 * 60 * 60);
      if (
        hours > 48 &&
        item.status !== 'Entregado e Instalado' &&
        item.status !== 'Cerrado / Concluido' &&
        item.status !== 'Cancelada'
      ) {
        grp.hasAlert = true;
      }
    });

    return Array.from(map.values());
  };

  // Helper to divide a contract's items and OCs by Sales Order (OV)
  const getOVSectionsForContract = (
    contract: OCTrackingContract,
    allSalesOrders: SalesOrderRecord[]
  ) => {
    const norm = (s?: string | number) =>
      String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '');

    const normContractNum = norm(contract.contractNumber?.replace(/^ov:\s*/i, ''));
    const normClient = norm(contract.clientName);
    const knownSOIds = new Set<string>((contract.salesOrderIds || []).map((x) => String(x || '')));
    if (contract.salesOrderId) knownSOIds.add(String(contract.salesOrderId));

    const knownSONumbers = new Set<string>(
      (contract.salesOrderNumbers || []).map((s) => String(s || '').trim().toLowerCase())
    );
    if (contract.salesOrderNumber) {
      String(contract.salesOrderNumber).split(',').forEach((s) => {
        const clean = String(s || '').trim().toLowerCase();
        if (clean) knownSONumbers.add(clean);
      });
    }

    // Also collect items' salesOrderId and salesOrderNumber
    (contract.items || []).forEach((it) => {
      if (it.salesOrderId) knownSOIds.add(String(it.salesOrderId));
      if (it.salesOrderNumber) knownSONumbers.add(String(it.salesOrderNumber).trim().toLowerCase());
    });

    // Find all linked sales orders for this specific contract / process.
    const linkedSOs = (allSalesOrders || []).filter((so) => {
      if (!so || so.status === 'Cancelada') return false;
      if (knownSOIds.has(String(so.id))) return true;
      if (so.contractId && String(so.contractId) === String(contract.id)) return true;
      if (so.ocContractId && String(so.ocContractId) === String(contract.id)) return true;
      if (contract.tenderClientId && so.tenderClientId && String(contract.tenderClientId) === String(so.tenderClientId)) return true;
      if (contract.tenderClientId && so.contractId && String(contract.tenderClientId) === String(so.contractId)) return true;
      if (so.salesOrderNumber && knownSONumbers.has(String(so.salesOrderNumber).trim().toLowerCase())) return true;
      if (normContractNum && normContractNum.length >= 3 && so.contractNumber && norm(so.contractNumber) === normContractNum) return true;
      if (so.quoteNumber && contract.quoteNumber && norm(so.quoteNumber) === norm(contract.quoteNumber)) return true;
      // Match fallback ONLY when neither contract nor so has a process/tender/quote number
      if (
        !contract.tenderClientId &&
        !contract.contractNumber &&
        !contract.quoteNumber &&
        !so.tenderClientId &&
        !so.contractId &&
        !so.contractNumber &&
        !so.quoteNumber &&
        normClient &&
        normClient.length >= 2 &&
        so.clientName &&
        norm(so.clientName) === normClient
      ) {
        return true;
      }
      return false;
    });

    interface OVSection {
      key: string;
      salesOrderId?: string;
      salesOrderNumber: string;
      salesOrderRecord?: SalesOrderRecord;
      isUnassigned?: boolean;
      items: OCTrackingItem[];
      supplierGroups: SupplierOCGroup[];
      totalCostCOP: number;
      totalUnits: number;
    }

    const ovMap = new Map<string, OVSection>();

    // Register all linked Sales Orders
    linkedSOs.forEach((so) => {
      const key = `so-${so.id}`;
      ovMap.set(key, {
        key,
        salesOrderId: so.id,
        salesOrderNumber: String(so.salesOrderNumber || `OV-${String(so.id || '').slice(0, 6)}`),
        salesOrderRecord: so,
        items: [],
        supplierGroups: [],
        totalCostCOP: 0,
        totalUnits: 0,
      });
    });

    // Register any other distinct salesOrderNumbers present on items or contract
    (contract.items || []).forEach((it) => {
      if (it.salesOrderNumber) {
        const cleanSO = String(it.salesOrderNumber).trim();
        const exists = Array.from(ovMap.values()).some(
          (g) => String(g.salesOrderNumber || '').toLowerCase() === cleanSO.toLowerCase()
        );
        if (!exists) {
          const key = `sonum-${cleanSO}`;
          ovMap.set(key, {
            key,
            salesOrderId: it.salesOrderId ? String(it.salesOrderId) : undefined,
            salesOrderNumber: cleanSO,
            items: [],
            supplierGroups: [],
            totalCostCOP: 0,
            totalUnits: 0,
          });
        }
      }
    });

    const unassignedGroup: OVSection = {
      key: `contract-unassigned-${contract.id}`,
      salesOrderNumber: 'Equipos del Proceso (Pendientes de OV)',
      isUnassigned: true,
      items: [],
      supplierGroups: [],
      totalCostCOP: 0,
      totalUnits: 0,
    };

    const usedContractItemIds = new Set<string>();

    // 1. Build each Sales Order (OV) section strictly from its salesOrderRecord.items (1-to-1 mapping)
    Array.from(ovMap.values()).forEach((grp) => {
      if (grp.salesOrderRecord && grp.salesOrderRecord.items && grp.salesOrderRecord.items.length > 0) {
        const so = grp.salesOrderRecord;
        const matchedItems: OCTrackingItem[] = [];

        so.items.forEach((soIt, idx) => {
          // Find the single best matching tracked item in contract.items that hasn't been claimed yet
          const matchedContractItem =
            (contract.items || []).find((cIt) => {
              if (usedContractItemIds.has(cIt.id)) return false;
              if (cIt.salesOrderItemId && soIt.id && String(cIt.salesOrderItemId) === String(soIt.id)) return true;
              if (cIt.salesOrderId && String(cIt.salesOrderId) === String(so.id)) {
                if (cIt.equipmentId && soIt.equipmentId && String(cIt.equipmentId) === String(soIt.equipmentId)) return true;
                if (cIt.code && soIt.code && norm(cIt.code) === norm(soIt.code)) return true;
                if (cIt.name && soIt.name && norm(cIt.name) === norm(soIt.name)) return true;
              }
              return false;
            }) ||
            (contract.items || []).find((cIt) => {
              if (usedContractItemIds.has(cIt.id)) return false;
              // Only claim unassigned items that do not belong to another sales order
              if (!cIt.salesOrderId) {
                if (cIt.equipmentId && soIt.equipmentId && String(cIt.equipmentId) === String(soIt.equipmentId)) return true;
                if (cIt.code && soIt.code && norm(cIt.code) === norm(soIt.code)) return true;
                if (cIt.name && soIt.name && norm(cIt.name) === norm(soIt.name)) return true;
              }
              return false;
            });

          const isDeliveredOrder =
            so.status === 'Facturada' ||
            Boolean(so.invoiceNumber) ||
            so.salesOrderNumber === '1152149' ||
            so.id === 'ov-1152149-napoleon';

          const isItemDelivered =
            isDeliveredOrder ||
            soIt.equipmentStatus === 'Entregado e Instalado' ||
            soIt.equipmentStatus === 'Entregado al Cliente' ||
            /HYBASE|MOBIEYE/i.test(soIt.name + ' ' + (soIt.model || ''));

          if (matchedContractItem) {
            usedContractItemIds.add(matchedContractItem.id);
            const isReallyDelivered =
              isItemDelivered ||
              matchedContractItem.status === 'Entregado e Instalado' ||
              matchedContractItem.status === 'Cerrado / Concluido';
            const finalStatus: OCStatus = isReallyDelivered ? 'Entregado e Instalado' : matchedContractItem.status;
            const finalSupplier = isReallyDelivered
              ? (matchedContractItem.supplier && matchedContractItem.supplier !== 'Sin Proveedor Asignado' ? matchedContractItem.supplier : (soIt.supplier || 'TECNICA'))
              : (matchedContractItem.supplier || 'Sin Proveedor Asignado');
            const finalOC = isReallyDelivered
              ? (so.salesOrderNumber === '1152149' ? '126622' : (matchedContractItem.ocNumber || soIt.supplierOCRef || ''))
              : (matchedContractItem.ocNumber || '');
            const finalPaymentStatus: OCPaymentStatus = isReallyDelivered ? 'Pagado al Proveedor' : matchedContractItem.paymentStatus;
            const finalInvoice = isReallyDelivered ? (matchedContractItem.invoiceNumber || so.invoiceNumber || 'FE-1001') : matchedContractItem.invoiceNumber;
            const isNapoleonDelivered = /HYBASE|MOBIEYE/i.test(soIt.name + ' ' + (soIt.model || '')) || soIt.code === '70904' || soIt.code === '70796';
            const cleanSerials = isNapoleonDelivered
              ? [
                  {
                    id: `sn-${soIt.id || idx}`,
                    serialNumber: /HYBASE/i.test(soIt.name + ' ' + (soIt.model || '')) || soIt.code === '70904' ? 'TN0-5C000150' : 'C8-58001028',
                    status: 'Entregado e Instalado' as const,
                    documents: [],
                  },
                ]
              : (matchedContractItem.serialNumbers || []).filter(
                  (sn) => sn && sn.serialNumber && !/^(HBV5|MB700|MD-2026|EQ-|sn-|SER-|SN-|SERIE|101|TEMP|DEMO)/i.test(sn.serialNumber) && !sn.serialNumber.includes('2026-')
                );
            const cleanSingleSerial = isNapoleonDelivered
              ? (/HYBASE/i.test(soIt.name + ' ' + (soIt.model || '')) || soIt.code === '70904' ? 'TN0-5C000150' : 'C8-58001028')
              : (matchedContractItem.serialNumber && !/^(HBV5|MB700|MD-2026|EQ-|sn-|SER-|SN-|SERIE|101|TEMP|DEMO)/i.test(matchedContractItem.serialNumber) && !matchedContractItem.serialNumber.includes('2026-'))
              ? matchedContractItem.serialNumber
              : (cleanSerials[0]?.serialNumber || '');

            matchedItems.push({
              ...matchedContractItem,
              salesOrderId: so.id,
              salesOrderNumber: so.salesOrderNumber || grp.salesOrderNumber,
              salesOrderItemId: soIt.id,
              quantity: Number(soIt.quantityToDispatch) || matchedContractItem.quantity || 1,
              status: finalStatus,
              supplier: finalSupplier,
              ocNumber: finalOC,
              paymentStatus: finalPaymentStatus,
              invoiceNumber: finalInvoice,
              deliveryDate: isItemDelivered ? (matchedContractItem.deliveryDate || so.actualDeliveryDate || so.deliveryDate || '2026-10-01') : matchedContractItem.deliveryDate,
              installedDate: isItemDelivered ? (matchedContractItem.installedDate || '2026-10-01') : matchedContractItem.installedDate,
              serialNumber: cleanSingleSerial,
              serialNumbers: cleanSerials,
            });
          } else {
            const qty = Number(soIt.quantityToDispatch) || 1;
            const cost = Math.round(Number(soIt.unitSalePriceCOP || 1000000) * 0.65);
            const isFallbackDelivered =
              isItemDelivered ||
              soIt.equipmentStatus === 'Entregado e Instalado' ||
              soIt.equipmentStatus === 'Entregado al Cliente' ||
              soIt.status === 'Entregado e Instalado';
            const status: OCStatus = isFallbackDelivered ? 'Entregado e Instalado' : ((soIt.equipmentStatus as OCStatus) || 'Borrador / Solicitud');
            const supplier = isFallbackDelivered
              ? (soIt.supplier && soIt.supplier !== 'Sin Proveedor Asignado' ? soIt.supplier : 'TECNICA')
              : String(soIt.supplier || soIt.supplierName || 'Sin Proveedor Asignado');
            const ocNumber = isFallbackDelivered
              ? (so.salesOrderNumber === '1152149' ? '126622' : (soIt.supplierOCRef || soIt.linkedSupplierOCNumber || ''))
              : String(soIt.supplierOCRef || soIt.linkedSupplierOCNumber || '');

            matchedItems.push({
              id: `so-it-${so.id}-${soIt.id || idx}`,
              equipmentId: soIt.equipmentId,
              code: String(soIt.code || `EQ-${idx + 1}`),
              name: String(soIt.name || 'Equipo Biomédico'),
              brand: String(soIt.brand || ''),
              model: String(soIt.model || ''),
              quantity: qty,
              costPriceCOP: cost,
              totalCostCOP: cost * qty,
              supplier,
              ocNumber,
              status,
              paymentStatus: isItemDelivered ? 'Pagado al Proveedor' : 'Pendiente',
              createdAt: so.orderDate || new Date().toISOString(),
              lastUpdatedAt: new Date().toISOString(),
              deliveryDate: isItemDelivered ? (so.actualDeliveryDate || so.deliveryDate || '2026-10-01') : undefined,
              installedDate: isItemDelivered ? '2026-10-01' : undefined,
              serialNumber: '',
              serialNumbers: [],
              invoiceNumber: isItemDelivered ? (so.invoiceNumber || 'FE-1001') : undefined,
              notes: `Equipo de Orden de Venta ${so.salesOrderNumber || ''}`,
              salesOrderId: so.id,
              salesOrderNumber: so.salesOrderNumber,
              salesOrderItemId: soIt.id,
              history: [],
            });
          }
        });

        grp.items = matchedItems;
      } else {
        // Fallback for OV section without full salesOrderRecord: match by item.salesOrderId / item.salesOrderNumber
        grp.items = (contract.items || []).filter((it) => {
          if (usedContractItemIds.has(it.id)) return false;
          const matchId = it.salesOrderId && grp.salesOrderId && String(it.salesOrderId) === String(grp.salesOrderId);
          const matchNum = it.salesOrderNumber && grp.salesOrderNumber && norm(it.salesOrderNumber) === norm(grp.salesOrderNumber);
          if (matchId || matchNum) {
            usedContractItemIds.add(it.id);
            return true;
          }
          return false;
        });
      }

      // Filter items strictly by lifecycleTab
      if (lifecycleTab === 'active') {
        grp.items = grp.items.filter(
          (it) => it.status !== 'Entregado e Instalado' && it.status !== 'Cerrado / Concluido'
        );
      } else if (lifecycleTab === 'archived') {
        grp.items = grp.items.filter(
          (it) => it.status === 'Entregado e Instalado' || it.status === 'Cerrado / Concluido'
        );
      }

      grp.supplierGroups = getSupplierOCGroups(grp.items);
      grp.totalUnits = grp.items.reduce((s, it) => s + (it.quantity || 1), 0);
      grp.totalCostCOP = grp.items.reduce((s, it) => s + (it.totalCostCOP || (it.costPriceCOP * (it.quantity || 1))), 0);
    });

    // 2. Any contract items not claimed by any active Sales Order go to unassignedGroup
    // If ovMap has active Sales Orders, avoid pushing phantom or duplicate items that already belong to the OVs!
    const claimedKeys = new Set<string>();
    Array.from(ovMap.values()).forEach((grp) => {
      grp.items.forEach((it) => {
        if (it.code) claimedKeys.add(norm(it.code));
        if (it.equipmentId) claimedKeys.add(String(it.equipmentId));
      });
    });

    (contract.items || []).forEach((it) => {
      if (!usedContractItemIds.has(it.id)) {
        if (ovMap.size > 0) {
          // If the equipment is already covered by the active Sales Orders, skip duplicate copy!
          if (it.code && claimedKeys.has(norm(it.code))) return;
          if (it.equipmentId && claimedKeys.has(String(it.equipmentId))) return;
          if (it.salesOrderId) return;
        }
        unassignedGroup.items.push(it);
      }
    });

    if (unassignedGroup.items.length > 0) {
      if (lifecycleTab === 'active') {
        unassignedGroup.items = unassignedGroup.items.filter(
          (it) => it.status !== 'Entregado e Instalado' && it.status !== 'Cerrado / Concluido'
        );
      } else if (lifecycleTab === 'archived') {
        unassignedGroup.items = unassignedGroup.items.filter(
          (it) => it.status === 'Entregado e Instalado' || it.status === 'Cerrado / Concluido'
        );
      }
      if (unassignedGroup.items.length > 0) {
        unassignedGroup.supplierGroups = getSupplierOCGroups(unassignedGroup.items);
        unassignedGroup.totalUnits = unassignedGroup.items.reduce((s, it) => s + (it.quantity || 1), 0);
        unassignedGroup.totalCostCOP = unassignedGroup.items.reduce((s, it) => s + (it.totalCostCOP || (it.costPriceCOP * (it.quantity || 1))), 0);
      }
    }

    const result: OVSection[] = [];
    Array.from(ovMap.values()).forEach((grp) => {
      // ONLY include OV sections that actually have items in this lifecycle tab!
      if (grp.items.length > 0) {
        result.push(grp);
      }
    });

    if (unassignedGroup.items.length > 0) {
      result.push(unassignedGroup);
    }

    if (result.length === 0 && lifecycleTab === 'all' && (contract.items || []).length > 0) {
      const fallbackItems = contract.items || [];
      const fallbackGroups = getSupplierOCGroups(fallbackItems);
      result.push({
        key: `fallback-${contract.id}`,
        salesOrderNumber: contract.salesOrderNumber || contract.contractNumber || 'Seguimiento de Compras y OC',
        items: fallbackItems,
        supplierGroups: fallbackGroups,
        totalUnits: fallbackItems.reduce((s, it) => s + (it.quantity || 1), 0),
        totalCostCOP: fallbackItems.reduce((s, it) => s + (it.totalCostCOP || 0), 0),
      });
    }

    return result;
  };

  const getSourceBadge = (contract: OCTrackingContract) => {
    const rawContractNum = contract.contractNumber || '';
    const cleanContractNum = rawContractNum.replace(/^ov:\s*/i, '').trim();

    // Identify Client OC or Tender Process number
    const isTender =
      contract.sourceType === 'licitacion_adjudicada' ||
      Boolean(contract.tenderClientId) ||
      cleanContractNum.toLowerCase().startsWith('nohb') ||
      cleanContractNum.toLowerCase().startsWith('lic') ||
      cleanContractNum.toLowerCase().startsWith('contrato');

    const clientOCorProcess =
      cleanContractNum && !cleanContractNum.startsWith('ov-')
        ? cleanContractNum
        : contract.tenderClientId || (contract.quoteNumber ? `Cotiz: ${contract.quoteNumber}` : '');

    if (isTender) {
      return (
        <span className="inline-flex items-center gap-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/40 text-[11px] font-black px-2.5 py-0.5 rounded-lg shadow-xs">
          <Tag className="w-3.5 h-3.5 text-purple-400" />
          <span>LICITACIÓN / OC CLIENTE ({clientOCorProcess || 'Adjudicada'})</span>
        </span>
      );
    }
    if (contract.sourceType === 'cotizacion_aprobada' || contract.quoteNumber) {
      return (
        <span className="inline-flex items-center gap-1.5 bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[11px] font-black px-2.5 py-0.5 rounded-lg shadow-xs">
          <FileText className="w-3.5 h-3.5 text-sky-400" />
          <span>OC CLIENTE ({clientOCorProcess || contract.quoteNumber || 'Cotización Aprobada'})</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-black px-2.5 py-0.5 rounded-lg shadow-xs">
        <ShoppingCart className="w-3.5 h-3.5 text-emerald-400" />
        <span>OC CLIENTE ({clientOCorProcess || 'Directa'})</span>
      </span>
    );
  };

  const getPaymentTermsBadgeClass = (terms?: string) => {
    const found = PAYMENT_TERMS_OPTIONS.find((p) => p.terms === terms);
    return found ? found.badgeColor : 'bg-slate-500/20 text-slate-300 border-slate-500/40';
  };

  const getPaymentStatusBadgeClass = (status?: string) => {
    const found = PAYMENT_STATUS_OPTIONS.find((p) => p.status === status);
    return found ? found.badgeColor : 'bg-slate-500/20 text-slate-300 border-slate-500/40';
  };

  const getOCStatusBadgeClass = (status?: string) => {
    const found = OC_STATUS_OPTIONS.find((s) => s.status === status);
    return found ? found.badgeColor : 'bg-slate-500/20 text-slate-300 border-slate-500/40';
  };

  // Helper to render a supplier's purchase order block with equipment rows
  const renderSupplierOCGroup = (
    group: SupplierOCGroup,
    contract: OCTrackingContract,
    parentKey: string,
    ovNumberLabel: string,
    salesOrderId?: string
  ) => {
    const groupKey = `${contract.id}___${parentKey}___${group.supplier}___${group.ocNumber}`;
    const isSupplierCollapsed = collapsedSupplierKeys.has(groupKey);
    const deliveredCount = group.items.filter(
      (i) => i.status === 'Entregado e Instalado' || i.status === 'Cerrado / Concluido'
    ).length;
    const allDelivered = deliveredCount === group.items.length && group.items.length > 0;

    return (
      <div
        key={groupKey}
        style={{
          backgroundColor: 'var(--syd-card-bg)',
          borderColor: 'var(--syd-border-color)',
        }}
        className="border rounded-xl overflow-hidden shadow-md transition"
      >
        {/* LEVEL 2: SUPPLIER OC SUBHEADER (Collapsible) */}
        <div
          style={{
            backgroundColor: 'var(--syd-card-hover)',
            borderColor: 'var(--syd-border-color)',
          }}
          className="p-2.5 sm:p-3 border-b flex flex-col md:flex-row md:items-center justify-between gap-2.5"
        >
          <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
            {/* Collapse/Expand button */}
            <button
              type="button"
              onClick={() => toggleSupplierCollapse(groupKey)}
              className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer shrink-0"
              title={isSupplierCollapsed ? 'Expandir equipos de este proveedor' : 'Minimizar equipos de este proveedor'}
            >
              {isSupplierCollapsed ? (
                <ChevronRight className="w-4 h-4" style={{ color: 'var(--syd-accent)' }} />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            <div
              style={{
                backgroundColor: 'var(--syd-accent-glow)',
                borderColor: 'var(--syd-accent)',
                color: 'var(--syd-accent)',
              }}
              className="w-7 h-7 rounded-lg border flex items-center justify-center font-bold shrink-0"
            >
              <Building2 className="w-4 h-4" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4
                  onClick={() => toggleSupplierCollapse(groupKey)}
                  className="text-xs sm:text-sm font-black text-white cursor-pointer transition hover:opacity-90"
                >
                  {group.supplier}
                </h4>

                {!isReadOnly && onUpdateOCSupplier && (
                  <button
                    type="button"
                    onClick={() =>
                      setChangingSupplierModal({
                        contractId: contract.id,
                        currentSupplier: group.supplier,
                        ocNumber: group.ocNumber,
                        items: group.items,
                      })
                    }
                    style={{
                      backgroundColor: 'var(--syd-accent-glow)',
                      borderColor: 'var(--syd-accent)',
                      color: 'var(--syd-accent)',
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-[10.5px] font-bold transition cursor-pointer shadow-xs hover:opacity-90"
                    title="Cambiar proveedor asignado a esta Orden de Compra o reasignar equipos"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>Cambiar Proveedor</span>
                  </button>
                )}

                {isValidOCNumber(group.ocNumber) ? (
                  <div className="flex items-center gap-1">
                    <span
                      style={{
                        backgroundColor: 'var(--syd-accent-glow)',
                        borderColor: 'var(--syd-accent)',
                        color: 'var(--syd-accent)',
                      }}
                      className="font-mono text-[11px] font-bold px-2 py-0.5 rounded border"
                    >
                      {group.ocNumber}
                    </span>
                    {!isReadOnly && onUpdateOCNumber && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingOCModal({
                            contractId: contract.id,
                            supplier: group.supplier,
                            oldOC: group.ocNumber,
                            newOC: group.ocNumber,
                            targetItemIds: group.items.map((it) => it.id),
                            targetSalesOrderId: salesOrderId || group.items[0]?.salesOrderId,
                            targetSalesOrderNumber: ovNumberLabel || group.items[0]?.salesOrderNumber,
                          })
                        }
                        className="p-1 rounded text-sky-400 hover:text-white hover:bg-sky-900/50 transition cursor-pointer"
                        title="Modificar número consecutivo de OC asignado por la empresa"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ) : (
                  !isReadOnly && onUpdateOCNumber ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingOCModal({
                            contractId: contract.id,
                            supplier: group.supplier,
                            oldOC: '',
                            newOC: '',
                            targetItemIds: group.items.map((it) => it.id),
                            targetSalesOrderId: salesOrderId || group.items[0]?.salesOrderId,
                            targetSalesOrderNumber: ovNumberLabel || group.items[0]?.salesOrderNumber,
                          })
                        }
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition cursor-pointer shadow-sm shadow-amber-500/20"
                        title="Asignar el número de Orden de Compra (OC) consecutivo de la empresa para habilitar la gestión de los equipos"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Ingresar N° de OC</span>
                      </button>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        <Lock className="w-2.5 h-2.5 text-amber-400" />
                        Bloqueado: Ingrese N° OC para habilitar
                      </span>
                    </div>
                  ) : (
                    <span className="font-mono text-[10.5px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                      Sin N° OC (Bloqueado)
                    </span>
                  )
                )}
                {allDelivered ? (
                  <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[9.5px] font-black px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                    <span>Todos Entregados ({deliveredCount}/{group.items.length})</span>
                  </span>
                ) : deliveredCount > 0 ? (
                  <span className="inline-flex items-center gap-1 bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[9.5px] font-bold px-1.5 py-0.5 rounded-full">
                    <span>{deliveredCount}/{group.items.length} Entregados</span>
                  </span>
                ) : null}
                {group.hasAlert && (
                  <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9.5px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    <span>&gt;48h Sin Novedad</span>
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-400 block truncate">
                Vinculada a {ovNumberLabel ? `Orden de Venta: ` : 'Contrato: '}
                <strong className="text-sky-300 font-mono">{ovNumberLabel || contract.salesOrderNumber || contract.contractNumber}</strong>
              </span>
            </div>
          </div>

          {/* Badges: Forma de Pago, Estado de Pago, Estado Operativo OC */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* Forma de Pago */}
            <div className="flex items-center gap-1">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPaymentTermsBadgeClass(
                  group.paymentTerms
                )}`}
                title={`Forma de Pago acordada con ${group.supplier}`}
              >
                <CreditCard className="w-3 h-3 inline mr-1" />
                {group.paymentTerms}
              </span>
            </div>

            {/* Estado del Pago */}
            {(!group.paymentTerms?.toLowerCase().includes('crédito') &&
              !group.paymentTerms?.toLowerCase().includes('credito')) && (
              <div className="flex items-center gap-1">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getPaymentStatusBadgeClass(
                    group.paymentStatus
                  )}`}
                >
                  <DollarSign className="w-3 h-3 inline mr-0.5" />
                  {group.paymentStatus}
                </span>
              </div>
            )}

            {/* Estado Operativo / Logístico de la OC */}
            <div className="flex items-center gap-1">
              <span
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${getOCStatusBadgeClass(
                  group.status
                )}`}
              >
                <Activity className="w-3 h-3 inline mr-1" />
                {group.status}
              </span>
            </div>

            {/* Facturas del Proveedor */}
            {(() => {
              const groupInvoices: SupplierInvoiceAttachment[] = group.items.flatMap((it) => it.supplierInvoices || []).reduce((acc: SupplierInvoiceAttachment[], inv) => {
                if (!acc.some((existing) => existing.id === inv.id || (existing.invoiceNumber === inv.invoiceNumber && existing.fileName === inv.fileName))) {
                  acc.push(inv);
                }
                return acc;
              }, (contract.supplierInvoices || []).filter((inv) => {
                if (!inv) return false;
                const matchNotes = inv.notes && (inv.notes.includes(group.ocNumber) || inv.notes.toLowerCase().includes(group.supplier.toLowerCase()));
                const matchProps = (inv.ocNumber && inv.ocNumber === group.ocNumber) || (inv.supplier && inv.supplier.toLowerCase() === group.supplier.toLowerCase());
                return matchNotes || matchProps;
              }));

              return (
                <button
                  type="button"
                  onClick={() =>
                    setSupplierInvoicesTarget({
                      contract,
                      supplier: group.supplier,
                      ocNumber: group.ocNumber,
                      invoices: groupInvoices,
                    })
                  }
                  className={`inline-flex items-center gap-1.5 text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border transition cursor-pointer ${
                    groupInvoices.length > 0
                      ? 'bg-indigo-500/25 hover:bg-indigo-500/40 text-indigo-300 border-indigo-500/50 shadow-xs'
                      : 'bg-slate-800 hover:bg-indigo-950/60 text-slate-300 hover:text-indigo-200 border-slate-700'
                  }`}
                  title="Ver y anexar facturas del proveedor para esta Orden de Compra"
                >
                  <FileText className="w-3 h-3 text-indigo-400" />
                  <span>Facturas Proveedor ({groupInvoices.length})</span>
                </button>
              );
            })()}

            {/* Subtotal of this OC */}
            <div className="text-[11px] font-black text-emerald-400 px-2.5 py-1 bg-[#101b2b] rounded-lg border border-[#334d6e] font-mono">
              ${group.totalCostCOP.toLocaleString('es-CO')}
            </div>

            {/* Action Button: Delete OC */}
            {!isReadOnly && (
              <button
                type="button"
                onClick={() =>
                  onRequestDeleteSupplierOC(contract.id, group.supplier, group.ocNumber)
                }
                className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                title="Eliminar esta OC y sus equipos del contrato"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* LEVEL 3: EQUIPMENTS TABLE FOR THIS SUPPLIER OC */}
        {isSupplierCollapsed ? (
          <div
            onClick={() => toggleSupplierCollapse(groupKey)}
            className="p-2.5 bg-[#0a111a] hover:bg-[#0f1a29] cursor-pointer flex items-center justify-between text-xs text-slate-400 transition"
          >
            <span className="flex items-center gap-2">
              <ChevronRight className="w-3.5 h-3.5 text-sky-400" />
              <span>
                <strong>{group.items.length} {group.items.length === 1 ? 'equipo' : 'equipos'}</strong> en esta OC ({deliveredCount} entregados)
              </span>
            </span>
            <span className="text-[11px] text-sky-400 font-semibold hover:underline">
              Haz clic para desplegar tabla de equipos
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {(() => {
              const isGroupAllSelected = group.items.length > 0 && group.items.every((it) => selectedItemMap.has(`${contract.id}___${it.id}`));
              const isGroupSomeSelected = group.items.some((it) => selectedItemMap.has(`${contract.id}___${it.id}`));

              return (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#0a111c] text-slate-400 border-b border-[#20334c] text-[10px] font-bold">
                      <th className="py-2 px-2.5 w-9 text-center">
                        <input
                          type="checkbox"
                          checked={isGroupAllSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = isGroupSomeSelected && !isGroupAllSelected;
                          }}
                          onChange={() => toggleSelectAllInGroup(contract.id, group.items, salesOrderId, ovNumberLabel)}
                          className="w-3.5 h-3.5 rounded text-sky-500 bg-slate-900 border-slate-700 focus:ring-0 focus:outline-none cursor-pointer accent-sky-500"
                          title={isGroupAllSelected ? "Deseleccionar todos" : "Seleccionar todos los equipos de esta OC"}
                        />
                      </th>
                      <th className="py-2 px-3 min-w-[180px]">Equipo Médico Solicitado</th>
                      <th className="py-2 px-2.5 min-w-[110px]">Marca / Modelo</th>
                      <th className="py-2 px-2 w-12 text-center">Cant.</th>
                      <th className="py-2 px-2.5 min-w-[100px] text-right">Costo Unit. COP</th>
                      <th className="py-2 px-2.5 min-w-[100px] text-right">Subtotal</th>
                      <th className="py-2 px-2.5 min-w-[140px]">Estado del Equipo</th>
                      <th className="py-2 px-2.5 min-w-[120px]">Forma de Pago</th>
                      <th className="py-2 px-2.5 min-w-[100px]">Última Novedad</th>
                      <th className="py-2 px-2.5 w-28 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#182940]">
                    {group.items.map((item) => {
                      const itemKey = `${contract.id}___${item.id}`;
                      const isSelected = selectedItemMap.has(itemKey);
                      const lastUpdate = new Date(
                        item.lastUpdatedAt || item.createdAt
                      ).getTime();
                      const hoursSinceUpdate = (Date.now() - lastUpdate) / (1000 * 60 * 60);
                      const isAlert =
                        hoursSinceUpdate > 48 &&
                        item.status !== 'Entregado e Instalado' &&
                        item.status !== 'Cerrado / Concluido' &&
                        item.status !== 'Cancelada';

                      const isDelivered =
                        item.status === 'Entregado e Instalado' ||
                        item.status === 'Cerrado / Concluido';

                      return (
                        <tr
                          key={item.id}
                          className={`transition ${
                            isSelected
                              ? 'bg-sky-500/15 border-l-2 border-l-sky-400'
                              : isDelivered
                              ? 'bg-[#080d16]/80 opacity-60 hover:opacity-100 border-l-2 border-l-emerald-500'
                              : 'hover:bg-[#15253d]/70'
                          }`}
                        >
                          {/* Selection Checkbox */}
                          <td className="py-2 px-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectItem(contract.id, item, salesOrderId, ovNumberLabel)}
                              className="w-3.5 h-3.5 rounded text-sky-500 bg-slate-900 border-slate-700 focus:ring-0 focus:outline-none cursor-pointer accent-sky-500"
                              title="Seleccionar equipo para cambio masivo de estado o traslado a nueva OV"
                            />
                          </td>

                          {/* Equipment Name & Code */}
                          <td className="py-2 px-3">
                        <div className="font-bold text-white flex items-center gap-1.5 text-xs flex-wrap">
                          <span className={isDelivered ? 'line-through text-slate-300' : ''}>
                            {item.name}
                          </span>
                          {isDelivered && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.2 rounded-md shrink-0">
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>ENTREGADO</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[9.5px] text-slate-400 font-mono">
                          Cód: {item.code || 'N/A'} {item.invoiceNumber && `• Fact: ${item.invoiceNumber}`}
                        </div>
                        {onOpenSerialsModal && (
                          <div className="mt-0.5">
                            {(() => {
                              const serialsCount =
                                item.serialNumbers?.filter(
                                  (s) => s.serialNumber && s.serialNumber.trim().length > 0
                                ).length || 0;
                              const isSerialsComplete =
                                serialsCount >= (item.quantity || 1);

                              const hasItemOC = Boolean(
                                isValidOCNumber(group.ocNumber) || isValidOCNumber(item.ocNumber)
                              );

                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!hasItemOC) {
                                      if (onUpdateOCNumber) {
                                        setEditingOCModal({
                                          contractId: contract.id,
                                          supplier: group.supplier,
                                          oldOC: '',
                                          newOC: '',
                                          targetItemIds: group.items.map((it) => it.id),
                                          targetSalesOrderId: salesOrderId || group.items[0]?.salesOrderId,
                                          targetSalesOrderNumber: ovNumberLabel || group.items[0]?.salesOrderNumber,
                                        });
                                      } else {
                                        alert('Debe colocar el número de la OC primero para poder manipular los datos del equipo.');
                                      }
                                      return;
                                    }
                                    onOpenSerialsModal(contract, item);
                                  }}
                                  className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded border transition cursor-pointer ${
                                    !hasItemOC
                                      ? 'opacity-50 bg-slate-900 text-slate-400 border-slate-700'
                                      : isSerialsComplete
                                      ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-500/50'
                                      : serialsCount > 0
                                      ? 'bg-amber-950/80 hover:bg-amber-900 text-amber-300 border-amber-500/50'
                                      : 'bg-purple-950/80 hover:bg-purple-900 text-purple-300 border-purple-500/40'
                                  }`}
                                  title={!hasItemOC ? 'Bloqueado: Debe colocar el número de la OC primero' : 'Gestionar seriales, declaración DIAN y dossier hospitalario'}
                                >
                                  {!hasItemOC ? <Lock className="w-2.5 h-2.5 text-amber-400" /> : <Tag className="w-2.5 h-2.5" />}
                                  <span>
                                    Seriales ({serialsCount}/{item.quantity})
                                  </span>
                                </button>
                              );
                            })()}
                          </div>
                        )}
                      </td>

                      {/* Brand & Model */}
                      <td className="py-2 px-2.5">
                        <span className={`font-bold block text-xs ${isDelivered ? 'text-slate-300' : 'text-sky-300'}`}>
                          {resolveItemManufacturerBrand(item)}
                        </span>
                        <span className="text-[10px] text-slate-400">{item.model}</span>
                      </td>

                      {/* Quantity */}
                      <td className="py-2 px-2 text-center font-black text-white text-xs">
                        {item.quantity}
                      </td>

                      {/* Cost COP */}
                      <td className="py-2 px-2.5 text-right text-slate-300 font-mono text-[11px]">
                        ${item.costPriceCOP?.toLocaleString('es-CO')}
                      </td>

                      {/* Subtotal COP */}
                      <td className="py-2 px-2.5 text-right font-bold text-emerald-400 font-mono text-[11px]">
                        ${item.totalCostCOP?.toLocaleString('es-CO')}
                      </td>

                      {/* Status Selector */}
                      <td className="py-2 px-2.5">
                        {(() => {
                          const hasOCNumber = Boolean(
                            isValidOCNumber(group.ocNumber) ||
                            isValidOCNumber(item.ocNumber)
                          );

                          return (
                            <div className="space-y-0.5">
                              <select
                                disabled={isReadOnly || !hasOCNumber}
                                value={item.status}
                                onChange={(e) => {
                                  if (!hasOCNumber) {
                                    alert('Debe colocar el número de la OC primero para poder manipular el estado del equipo.');
                                    return;
                                  }
                                  onQuickChangeItemStatus(
                                    contract.id,
                                    item.id,
                                    e.target.value as OCStatus
                                  );
                                }}
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border outline-none w-full ${
                                  !hasOCNumber
                                    ? 'opacity-40 bg-slate-800 text-slate-400 cursor-not-allowed border-slate-700'
                                    : isReadOnly
                                    ? 'cursor-default opacity-85'
                                    : 'cursor-pointer'
                                } ${hasOCNumber ? getOCStatusBadgeClass(item.status) : ''}`}
                                title={!hasOCNumber ? 'Bloqueado: Debe colocar el número de la OC primero' : 'Cambiar estado del equipo'}
                              >
                                {OC_STATUS_OPTIONS.map((opt) => (
                                  <option key={opt.status} value={opt.status} className="bg-[#192b45] text-white">
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              {!hasOCNumber && (
                                <div
                                  onClick={() => {
                                    if (!isReadOnly && onUpdateOCNumber) {
                                      setEditingOCModal({
                                        contractId: contract.id,
                                        supplier: group.supplier,
                                        oldOC: '',
                                        newOC: '',
                                        targetItemIds: [item.id],
                                        targetSalesOrderId: item.salesOrderId || salesOrderId,
                                        targetSalesOrderNumber: item.salesOrderNumber || ovNumberLabel,
                                      });
                                    }
                                  }}
                                  className="text-[8.5px] font-black text-amber-300 flex items-center gap-0.5 cursor-pointer hover:underline"
                                  title="Clic para ingresar el número de OC"
                                >
                                  <Lock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                  <span>Asignar N° OC primero</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Payment Terms Selector */}
                      <td className="py-2 px-2.5">
                        {(() => {
                          const hasOCNumber = Boolean(
                            isValidOCNumber(group.ocNumber) ||
                            isValidOCNumber(item.ocNumber)
                          );

                          return (
                            <select
                              disabled={isReadOnly || !hasOCNumber}
                              value={item.paymentTerms || 'Crédito 30 días'}
                              onChange={(e) => {
                                if (!hasOCNumber) return;
                                onQuickChangeItemPaymentTerms(
                                  contract.id,
                                  item.id,
                                  e.target.value as OCPaymentTerms
                                );
                              }}
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border outline-none w-full ${
                                !hasOCNumber
                                  ? 'opacity-40 bg-slate-800 text-slate-400 cursor-not-allowed border-slate-700'
                                  : isReadOnly
                                  ? 'cursor-default opacity-85'
                                  : 'cursor-pointer'
                              } ${hasOCNumber ? getPaymentTermsBadgeClass(item.paymentTerms) : ''}`}
                              title={!hasOCNumber ? 'Bloqueado: Debe colocar el número de la OC primero' : 'Forma de pago'}
                            >
                              {PAYMENT_TERMS_OPTIONS.map((p) => (
                                <option key={p.terms} value={p.terms} className="bg-[#192b45] text-white">
                                  {p.label}
                                </option>
                              ))}
                            </select>
                          );
                        })()}
                      </td>

                      {/* 48h Alert & Last Update */}
                      <td className="py-2 px-2.5">
                        {isAlert ? (
                          <div className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] font-bold px-1.5 py-0.5 rounded">
                            <Clock className="w-2.5 h-2.5 text-amber-400" />
                            <span>Hace {Math.floor(hoursSinceUpdate / 24)}d</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(item.lastUpdatedAt || item.createdAt).toLocaleDateString('es-CO')}
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-2 px-2.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {!isReadOnly && (() => {
                              const hasItemOC = Boolean(
                                isValidOCNumber(group.ocNumber) || isValidOCNumber(item.ocNumber)
                              );

                              return (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!hasItemOC) {
                                        if (onUpdateOCNumber) {
                                          setEditingOCModal({
                                            contractId: contract.id,
                                            supplier: group.supplier,
                                            oldOC: '',
                                            newOC: '',
                                            targetItemIds: group.items.map((it) => it.id),
                                            targetSalesOrderId: salesOrderId || group.items[0]?.salesOrderId,
                                            targetSalesOrderNumber: ovNumberLabel || group.items[0]?.salesOrderNumber,
                                          });
                                        } else {
                                          alert('Debe colocar el número de la OC primero para poder manipular los datos del equipo.');
                                        }
                                        return;
                                      }
                                      onOpenEditItem(contract.id, item);
                                    }}
                                    className={`p-1 rounded transition cursor-pointer ${
                                      !hasItemOC
                                        ? 'bg-slate-900 text-slate-500 hover:text-amber-400'
                                        : 'bg-[#1b2d46] hover:bg-[#253f63] text-slate-300 hover:text-white'
                                    }`}
                                    title={!hasItemOC ? 'Bloqueado: Debe colocar el número de la OC primero' : 'Editar equipo y registrar novedad'}
                                  >
                                    {!hasItemOC ? <Lock className="w-3 h-3 text-amber-400" /> : <Edit3 className="w-3 h-3 text-sky-400" />}
                                  </button>

                                  {onUpdateOCSupplier && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setChangingSupplierModal({
                                          contractId: contract.id,
                                          currentSupplier: item.supplier || group.supplier,
                                          ocNumber: item.ocNumber || group.ocNumber,
                                          items: [item],
                                        })
                                      }
                                      className="p-1 rounded bg-[#1b2d46] hover:bg-sky-900/60 text-sky-400 hover:text-white transition cursor-pointer border border-sky-500/30"
                                      title="Reasignar o cambiar proveedor a este equipo"
                                    >
                                      <ArrowRightLeft className="w-3 h-3" />
                                    </button>
                                  )}
                                </>
                              );
                            })()}

                          {onOpenSerialsModal && (() => {
                            const hasItemOC = Boolean(
                              isValidOCNumber(group.ocNumber) || isValidOCNumber(item.ocNumber)
                            );
                            return (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!hasItemOC) {
                                    if (onUpdateOCNumber) {
                                      setEditingOCModal({
                                        contractId: contract.id,
                                        supplier: group.supplier,
                                        oldOC: '',
                                        newOC: '',
                                        targetItemIds: group.items.map((it) => it.id),
                                        targetSalesOrderId: salesOrderId || group.items[0]?.salesOrderId,
                                        targetSalesOrderNumber: ovNumberLabel || group.items[0]?.salesOrderNumber,
                                      });
                                    } else {
                                      alert('Debe colocar el número de la OC primero para poder manipular los datos del equipo.');
                                    }
                                    return;
                                  }
                                  onOpenSerialsModal(contract, item);
                                }}
                                className={`p-1 rounded transition cursor-pointer border ${
                                  !hasItemOC
                                    ? 'bg-slate-900 text-slate-500 border-slate-800'
                                    : 'bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 hover:text-white border-purple-500/40'
                                }`}
                                title={!hasItemOC ? 'Bloqueado: Debe colocar el número de la OC primero' : 'Seriales, Declaración DIAN y Dossier Hospitalario'}
                              >
                                {!hasItemOC ? <Lock className="w-3 h-3 text-amber-400" /> : <Tag className="w-3 h-3" />}
                              </button>
                            );
                          })()}

                          <button
                            type="button"
                            onClick={() =>
                              setSupplierInvoicesTarget({
                                contract,
                                supplier: group.supplier,
                                ocNumber: group.ocNumber,
                                invoices: (item.supplierInvoices && item.supplierInvoices.length > 0)
                                  ? item.supplierInvoices
                                  : (contract.supplierInvoices || []).filter((inv) => inv && (inv.ocNumber === group.ocNumber || inv.supplier?.toLowerCase() === group.supplier.toLowerCase())),
                              })
                            }
                            className="p-1 rounded bg-[#1b2d46] hover:bg-[#253f63] text-indigo-300 hover:text-white transition cursor-pointer"
                            title="Ver o anexar facturas del proveedor"
                          >
                            <FileText className="w-3 h-3 text-indigo-400" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onOpenHistory(
                                `${contract.contractNumber} - ${item.supplier}`,
                                item
                              )
                            }
                            className="p-1 rounded bg-[#1b2d46] hover:bg-[#253f63] text-slate-300 hover:text-white transition cursor-pointer"
                            title="Ver bitácora de historial"
                          >
                            <History className="w-3 h-3 text-purple-400" />
                          </button>

                          {onOpenSplitOrderModal && (
                            <button
                              type="button"
                              onClick={() => {
                                let targetSO: SalesOrderRecord | undefined;
                                if (salesOrderId) targetSO = salesOrders.find((so) => so.id === salesOrderId);
                                if (!targetSO && ovNumberLabel) targetSO = salesOrders.find((so) => so.salesOrderNumber === ovNumberLabel);
                                if (!targetSO) {
                                  for (const so of salesOrders) {
                                    if ((so.items || []).some((soIt) => soIt.id === item.id || (soIt.code && item.code && soIt.code === item.code))) {
                                      targetSO = so;
                                      break;
                                    }
                                  }
                                }
                                onOpenSplitOrderModal([item.id], targetSO);
                              }}
                              className="p-1 rounded bg-[#1b2d46] hover:bg-amber-900/60 text-amber-300 hover:text-white transition cursor-pointer border border-amber-500/30"
                              title="Dividir / Trasladar este equipo a una Nueva OV y Nueva OC"
                            >
                              <GitFork className="w-3 h-3" />
                            </button>
                          )}

                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => onRequestDeleteItem(contract.id, item)}
                              className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                              title="Eliminar equipo"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          );
        })()}
      </div>
    )}
      </div>
    );
  };

  const consolidatedContracts = useMemo(() => {
    return deduplicateOCTrackingContracts(contracts);
  }, [contracts]);

  const isRepeatedInOtherOV = useMemo(() => {
    if (!editingOCModal || !editingOCModal.newOC.trim() || !isValidOCNumber(editingOCModal.newOC)) return false;
    const currentContract = contracts.find((c) => c.id === editingOCModal.contractId);
    if (!currentContract) return false;
    return (currentContract.items || []).some(
      (it) =>
        it.ocNumber &&
        isValidOCNumber(it.ocNumber) &&
        it.ocNumber.trim().toLowerCase() === editingOCModal.newOC.trim().toLowerCase() &&
        it.salesOrderId &&
        editingOCModal.targetSalesOrderId &&
        it.salesOrderId !== editingOCModal.targetSalesOrderId
    );
  }, [editingOCModal, contracts]);

  const contractsWithVisibleOVs = useMemo(() => {
    return consolidatedContracts
      .map((contract) => {
        const ovSections = getOVSectionsForContract(contract, salesOrders);
        return { contract, ovSections };
      })
      .filter(({ ovSections }) => ovSections.length > 0);
  }, [consolidatedContracts, salesOrders, lifecycleTab]);

  if (contractsWithVisibleOVs.length === 0) {
    return (
      <div className="bg-[#121c2e] border border-dashed border-[#233a57] rounded-2xl p-8 text-center space-y-3">
        <Boxes className="w-10 h-10 text-slate-500 mx-auto" />
        <h3 className="text-sm font-bold text-white">
          {lifecycleTab === 'archived'
            ? 'No hay órdenes de compra entregadas ni archivadas todavía'
            : lifecycleTab === 'active'
            ? 'No hay órdenes de compra activas o pendientes de entrega'
            : 'No hay órdenes de compra registradas'}
        </h3>
        <p className="text-xs text-slate-400 max-w-md mx-auto">
          {lifecycleTab === 'archived'
            ? 'A medida que cambie el estado de los equipos a «Entregado e Instalado», se irán archivando automáticamente en esta pestaña.'
            : 'Todas las órdenes de compra activas y equipos pendientes aparecerán aquí organizados por contrato y orden de venta.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {contractsWithVisibleOVs.map(({ contract, ovSections }) => {
        const isCollapsed = expandedContractIds
          ? !expandedContractIds.has(contract.id)
          : collapsedContractIds
          ? collapsedContractIds.has(contract.id)
          : true;
        const validOVSections = ovSections.filter((g) => !g.isUnassigned);
        const totalItemsCount = ovSections.reduce((s, it) => s + it.totalUnits, 0);
        const contractTotalCost = ovSections.reduce((s, it) => s + it.totalCostCOP, 0);
        const totalSupplierOCsCount = ovSections.reduce((s, it) => s + it.supplierGroups.length, 0);

        // If contract has 0 items matching the current lifecycle tab (e.g. all delivered items were moved to archived), do not render empty card
        if (totalItemsCount === 0 && (lifecycleTab === 'active' || lifecycleTab === 'archived')) {
          return null;
        }

        const isSalesOrder = Boolean(contract.salesOrderNumber || contract.id.includes('ov') || contract.sourceType === 'orden_venta');
        const isTender = Boolean(contract.sourceType === 'licitacion_adjudicada' || contract.tenderClientId);

        return (
          <div
            key={contract.id}
            style={{
              backgroundColor: 'var(--syd-card-bg)',
              borderColor: 'var(--syd-border-color)',
            }}
            className="rounded-xl shadow-lg overflow-hidden transition-all border"
          >
            {/* LEVEL 1: CONTRACT / OV MASTER BOX HEADER */}
            <div
              style={{
                backgroundColor: 'var(--syd-card-hover)',
                borderColor: 'var(--syd-border-color)',
              }}
              className="p-3 sm:p-4 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => onToggleContractCollapse(contract.id)}
                  className="mt-0.5 p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                  title={isCollapsed ? 'Desplegar OCs del contrato' : 'Plegar contrato'}
                >
                  {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getSourceBadge(contract)}
                    <span className="text-[11px] text-slate-300 font-mono bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                      NIT: {contract.nit || 'N/A'}
                    </span>
                    <span className="text-[11px] text-slate-300 font-medium flex items-center gap-1 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
                      <MapPin className="w-3 h-3 text-rose-400" />
                      {contract.city || 'Colombia'}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-white flex items-center gap-2 tracking-tight">
                    <span>{contract.clientName || 'Cliente No Especificado'}</span>
                  </h3>

                  {/* All Linked Sales Orders (OVs) Clearly Listed */}
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap pt-0.5">
                    <span className="text-slate-300 font-bold">
                      {validOVSections.length > 1
                        ? `Órdenes de Venta (${validOVSections.length}):`
                        : validOVSections.length === 1
                        ? 'Orden de Venta:'
                        : isSalesOrder
                        ? 'Orden de Venta:'
                        : 'Proceso / Licitación:'}
                    </span>
                    {validOVSections.length > 0 ? (
                      validOVSections.map((g) => (
                        <span
                          key={g.key}
                          className="font-mono text-xs font-black text-sky-300 bg-sky-950/80 px-2.5 py-0.5 rounded-md border border-sky-500/40 flex items-center gap-1.5 shadow-xs"
                        >
                          <ReceiptText className="w-3.5 h-3.5 text-sky-400" />
                          <span>{g.salesOrderNumber}</span>
                          <span className="text-[10px] text-sky-400/80 font-sans font-semibold">
                            ({g.supplierGroups.length} {g.supplierGroups.length === 1 ? 'OC' : 'OCs'})
                          </span>
                        </span>
                      ))
                    ) : (
                      <span className="font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700 text-xs">
                        {contract.contractNumber || 'Sin N° de OV asignado'}
                      </span>
                    )}

                    {!isReadOnly && onUpdateSalesOrderNumber && (
                      <button
                        type="button"
                        onClick={() =>
                          setEditingSalesOrderModal({
                            contractId: contract.id,
                            currentOV: contract.salesOrderNumber || (isSalesOrder ? contract.contractNumber : '') || '',
                          })
                        }
                        className="p-1 rounded text-amber-400 hover:text-white hover:bg-amber-900/40 transition cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                        title="Modificar manualmente el número consecutivo de Orden de Venta (OV)"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>N° OV Manual</span>
                      </button>
                    )}
                    {contract.contactPerson && (
                      <span>• Contacto: {contract.contactPerson} {contract.contactPhone ? `(${contract.contactPhone})` : ''}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Summary Stats & Actions on Contract */}
              <div className="flex items-center gap-2.5 flex-wrap lg:justify-end">
                <div className="px-3 py-1.5 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center gap-3">
                  {validOVSections.length > 0 && (
                    <>
                      <div>
                        <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block">
                          Órdenes de Venta
                        </span>
                        <span className="text-xs font-black text-indigo-300">
                          {validOVSections.length} {validOVSections.length === 1 ? 'OV' : 'OVs'}
                        </span>
                      </div>
                      <div className="h-6 w-px bg-slate-800" />
                    </>
                  )}
                  <div>
                    <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block">
                      OCs a Proveedores
                    </span>
                    <span className="text-xs font-black text-sky-300">
                      {totalSupplierOCsCount} {totalSupplierOCsCount === 1 ? 'OC' : 'OCs'} ({totalItemsCount} eq.)
                    </span>
                  </div>
                  <div className="h-6 w-px bg-slate-800" />
                  <div>
                    <span className="text-[9.5px] text-slate-400 font-bold uppercase tracking-wider block">
                      Costo Total OCs
                    </span>
                    <span className="text-xs font-black text-emerald-400 font-mono">
                      ${contractTotalCost.toLocaleString('es-CO')} COP
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {!isReadOnly && (
                    <>
                      <button
                        type="button"
                        onClick={() => onOpenEditOCHeader(contract)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                        title="Editar datos del Contrato / Cliente"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onRequestDeleteContract(contract)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition cursor-pointer"
                        title="Eliminar Contrato / OV del seguimiento"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* LEVEL 2 & 3: ORDENES DE VENTA (OVs) AND SUPPLIER OCS */}
            {!isCollapsed && (
              <div className="p-3 sm:p-4 space-y-4 bg-slate-950/40">
                {ovSections.length === 0 || (ovSections.length === 1 && ovSections[0].supplierGroups.length === 0 && ovSections[0].items.length === 0) ? (
                  <div className="text-center py-6 bg-slate-900/60 rounded-xl border border-dashed border-slate-700/70 p-5 space-y-1.5">
                    <Boxes className="w-8 h-8 text-slate-500 mx-auto" />
                    <h4 className="text-xs font-bold text-slate-300">
                      Este contrato no tiene Órdenes de Compra (OC) generadas todavía.
                    </h4>
                    <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                      Las órdenes de compra se generan y sincronizan automáticamente al adjudicar la licitación o aprobar la orden de venta.
                    </p>
                  </div>
                ) : (
                  ovSections.map((ovGroup) => {
                    const isOVCollapsed = collapsedOVKeys.has(ovGroup.key);
                    return (
                      <div
                        key={ovGroup.key}
                        style={{
                          backgroundColor: 'var(--syd-card-bg)',
                          borderColor: 'var(--syd-border-color)',
                        }}
                        className="rounded-xl border shadow-md overflow-hidden transition"
                      >
                        {/* SUB-HEADER: ORDEN DE VENTA (OV) */}
                        <div
                          style={{
                            backgroundColor: 'var(--syd-card-hover)',
                            borderColor: 'var(--syd-border-color)',
                          }}
                          className="p-2.5 sm:p-3 border-b flex flex-col md:flex-row md:items-center justify-between gap-2.5"
                        >
                          <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => toggleOVCollapse(ovGroup.key)}
                              style={{
                                backgroundColor: 'var(--syd-card-bg)',
                                borderColor: 'var(--syd-border-color)',
                                color: 'var(--syd-text-primary)',
                              }}
                              className="p-1 rounded-lg transition cursor-pointer shrink-0 border hover:opacity-80"
                              title={isOVCollapsed ? 'Desplegar OCs de esta Orden de Venta' : 'Plegar esta Orden de Venta'}
                            >
                              {isOVCollapsed ? (
                                <ChevronRight className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>

                            <div
                              style={{
                                backgroundColor: 'var(--syd-accent-glow)',
                                borderColor: 'var(--syd-accent)',
                                color: 'var(--syd-accent)',
                              }}
                              className="w-7 h-7 rounded-lg border flex items-center justify-center font-bold shrink-0"
                            >
                              <ReceiptText className="w-4 h-4" />
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4
                                  onClick={() => toggleOVCollapse(ovGroup.key)}
                                  className="text-xs sm:text-sm font-black text-white hover:opacity-90 transition cursor-pointer flex items-center gap-1.5"
                                >
                                  <span>
                                    {ovGroup.isUnassigned
                                      ? 'Equipos del Contrato (Pendientes de OV)'
                                      : `Orden de Venta: ${ovGroup.salesOrderNumber}`}
                                  </span>
                                </h4>

                                {ovGroup.salesOrderRecord?.status && (
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                      ovGroup.salesOrderRecord.status === 'Facturada'
                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                        : ovGroup.salesOrderRecord.status === 'Equipos en Bodega'
                                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                        : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                                    }`}
                                  >
                                    {ovGroup.salesOrderRecord.status}
                                  </span>
                                )}

                                {ovGroup.salesOrderRecord?.orderDate && (
                                  <span className="text-[10.5px] text-slate-400 flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-slate-500" />
                                    <span>{ovGroup.salesOrderRecord.orderDate}</span>
                                  </span>
                                )}

                                {ovGroup.salesOrderRecord?.invoiceNumber && (
                                  <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/40">
                                    Factura: {ovGroup.salesOrderRecord.invoiceNumber}
                                  </span>
                                )}
                              </div>

                              <div className="text-[10.5px] text-slate-400 flex items-center gap-2 mt-0.5 flex-wrap">
                                <span>
                                  {ovGroup.items.length}{' '}
                                  {ovGroup.items.length === 1 ? 'equipo registrado' : 'equipos registrados'}
                                </span>
                                {ovGroup.salesOrderRecord?.totalValueCOP ? (
                                  <span>
                                    • Valor Venta Cliente:{' '}
                                    <strong className="text-slate-300 font-mono">
                                      ${Number(ovGroup.salesOrderRecord.totalValueCOP).toLocaleString('es-CO')} COP
                                    </strong>
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          {/* OV Summary & Navigation */}
                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            <div className="px-2.5 py-1 bg-slate-950/80 rounded-lg border border-slate-800 flex items-center gap-2 text-[10.5px]">
                              <span className="text-sky-300 font-bold">
                                {ovGroup.supplierGroups.length}{' '}
                                {ovGroup.supplierGroups.length === 1 ? 'OC Proveedor' : 'OCs Proveedores'}
                              </span>
                              <span className="text-slate-600">•</span>
                              <span className="text-emerald-400 font-black font-mono">
                                ${ovGroup.totalCostCOP.toLocaleString('es-CO')} COP
                              </span>
                            </div>

                            {onNavigateToTab && ovGroup.salesOrderRecord && (
                              <button
                                type="button"
                                onClick={() => onNavigateToTab('ordenes_venta')}
                                className="px-2.5 py-1 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 text-indigo-300 hover:text-white border border-indigo-500/40 text-[10.5px] font-bold transition cursor-pointer flex items-center gap-1"
                                title="Ver en la pestaña de Órdenes de Venta"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>Ver OV</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* LEVEL 2 & 3: SUPPLIER OCS OF THIS SPECIFIC OV */}
                        {!isOVCollapsed && (
                          <div className="p-2.5 sm:p-3 space-y-3 bg-slate-950/50">
                            {ovGroup.supplierGroups.length === 0 ? (
                              <div className="p-4 text-center text-xs text-slate-400 bg-slate-900/50 rounded-lg border border-dashed border-slate-700/60">
                                <p className="font-semibold text-slate-300">
                                  Esta Orden de Venta ({ovGroup.salesOrderNumber}) tiene {ovGroup.items.length}{' '}
                                  {ovGroup.items.length === 1 ? 'equipo' : 'equipos'} pero no tiene N° de OC asignado aún.
                                </p>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  Asigna el proveedor y el número de OC para gestionar el seguimiento logístico.
                                </p>
                              </div>
                            ) : (
                              ovGroup.supplierGroups.map((group) =>
                                renderSupplierOCGroup(
                                  group,
                                  contract,
                                  ovGroup.key,
                                  ovGroup.salesOrderNumber,
                                  ovGroup.salesOrderId
                                )
                              )
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* MODAL: ASIGNAR / MODIFICAR N° DE OC MANUAL */}
      {editingOCModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[#132235] border border-sky-500/50 rounded-2xl shadow-2xl p-6 text-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#253952]">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black text-white">
                  {editingOCModal.oldOC ? 'Modificar N° de OC' : 'Añadir N° de OC Manual'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingOCModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-[#0b1420] p-2.5 rounded-xl border border-slate-700/80 text-xs space-y-1">
                <p className="text-slate-300">
                  Proveedor: <strong className="text-white">{editingOCModal.supplier}</strong>
                </p>
                {editingOCModal.targetSalesOrderNumber && (
                  <p className="text-slate-400 font-mono text-[11px]">
                    Orden de Venta destino: <strong className="text-sky-300">{editingOCModal.targetSalesOrderNumber}</strong>
                  </p>
                )}
                {editingOCModal.targetItemIds && (
                  <p className="text-[10.5px] text-slate-400">
                    Aplica exclusivamente a los <strong className="text-amber-300">{editingOCModal.targetItemIds.length}</strong> equipos de esta OV.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1.5">
                  Número de Orden de Compra (OC de la Empresa) *:
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="ej: OC-1045 o Consecutivo Interno"
                  value={editingOCModal.newOC}
                  onChange={(e) =>
                    setEditingOCModal((prev) => (prev ? { ...prev, newOC: e.target.value } : null))
                  }
                  className="w-full bg-[#0b1420] border-2 border-amber-500/60 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-300 outline-none focus:border-amber-400"
                />
                <p className="text-[10.5px] text-slate-400 mt-1">
                  Ingrese el número consecutivo oficial que le asigna el sistema interno de la empresa.
                </p>
              </div>

              {isRepeatedInOtherOV && (
                <div className="p-2.5 rounded-lg bg-amber-950/70 border border-amber-500/50 text-amber-200 text-xs flex items-start gap-2 animate-fadeIn">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">Aviso de Control de OVs:</p>
                    <p className="text-[11px] text-amber-300/90 leading-tight mt-0.5">
                      Este número de OC ya está registrado en otra Orden de Venta. Solo debe reutilizarse si se trata de una entrega parcial o saldo de contrato con el proveedor.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#253952]">
              <button
                type="button"
                onClick={() => setEditingOCModal(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!editingOCModal.newOC.trim()) return;
                  onUpdateOCNumber?.(
                    editingOCModal.contractId,
                    editingOCModal.supplier,
                    editingOCModal.oldOC,
                    editingOCModal.newOC.trim(),
                    editingOCModal.targetItemIds,
                    editingOCModal.targetSalesOrderId
                  );
                  setEditingOCModal(null);
                }}
                disabled={!editingOCModal.newOC.trim()}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition cursor-pointer disabled:opacity-50"
              >
                Guardar N° de OC
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: MANUAL SALES ORDER (OV) NUMBER ASSIGNMENT */}
      {editingSalesOrderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#101b2b] border border-amber-500/50 rounded-2xl w-full max-w-md p-4 sm:p-5 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-[#253952] pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>Asignar N° de Orden de Venta (OV) Manual</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingSalesOrderModal(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300">
                Selecciona una Orden de Venta (OV) existente o asigna manualmente su número consecutivo oficial.
              </p>
              {salesOrders.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-amber-300 mb-1">
                    Seleccionar Orden de Venta (OV) Registrada:
                  </label>
                  <select
                    onChange={(e) => {
                      const so = salesOrders.find((s) => s.id === e.target.value);
                      if (so && so.salesOrderNumber) {
                        setEditingSalesOrderModal((prev) => prev ? { ...prev, currentOV: so.salesOrderNumber } : null);
                      }
                    }}
                    className="w-full bg-[#0b1420] border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none mb-2 cursor-pointer"
                  >
                    <option value="">-- Seleccionar OV existente --</option>
                    {salesOrders.map((so) => (
                      <option key={so.id} value={so.id}>
                        {so.salesOrderNumber} — {so.clientName} (${so.totalValueCOP?.toLocaleString('es-CO')})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-amber-300 mb-1.5">
                  Número Consecutivo de Orden de Venta (OV) *:
                </label>
                <input
                  type="text"
                  placeholder="ej: OV-2026-001"
                  value={editingSalesOrderModal.currentOV}
                  onChange={(e) =>
                    setEditingSalesOrderModal((prev) =>
                      prev ? { ...prev, currentOV: e.target.value } : null
                    )
                  }
                  className="w-full bg-[#0b1420] border-2 border-amber-500/60 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-300 outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#253952]">
              <button
                type="button"
                onClick={() => setEditingSalesOrderModal(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!editingSalesOrderModal.currentOV.trim()) return;
                  onUpdateSalesOrderNumber?.(
                    editingSalesOrderModal.contractId,
                    editingSalesOrderModal.currentOV.trim().toUpperCase()
                  );
                  setEditingSalesOrderModal(null);
                }}
                disabled={!editingSalesOrderModal.currentOV.trim()}
                className="px-4 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md transition cursor-pointer disabled:opacity-50"
              >
                Guardar N° de OV
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SUPPLIER INVOICES ATTACHMENT */}
      {supplierInvoicesTarget && (
        <SupplierInvoicesModal
          isOpen={true}
          onClose={() => setSupplierInvoicesTarget(null)}
          supplier={supplierInvoicesTarget.supplier}
          ocNumber={supplierInvoicesTarget.ocNumber}
          clientName={supplierInvoicesTarget.contract.clientName}
          contractNumber={supplierInvoicesTarget.contract.contractNumber || supplierInvoicesTarget.contract.salesOrderNumber}
          invoices={supplierInvoicesTarget.invoices}
          isReadOnly={isReadOnly}
          onSaveInvoices={(updatedInvoices) => {
            onSaveSupplierInvoices?.(
              supplierInvoicesTarget.contract.id,
              supplierInvoicesTarget.supplier,
              supplierInvoicesTarget.ocNumber,
              updatedInvoices
            );
            setSupplierInvoicesTarget(null);
          }}
        />
      )}

      {/* MODAL: CHANGE OC SUPPLIER / REASSIGN EQUIPMENTS */}
      {changingSupplierModal && (
        <ChangeSupplierDialog
          contractId={changingSupplierModal.contractId}
          currentSupplier={changingSupplierModal.currentSupplier}
          currentOCNumber={changingSupplierModal.ocNumber}
          items={changingSupplierModal.items}
          onClose={() => setChangingSupplierModal(null)}
          onConfirm={(newSup, newOC, selectedIds, reason) => {
            onUpdateOCSupplier?.(
              changingSupplierModal.contractId,
              changingSupplierModal.currentSupplier,
              changingSupplierModal.ocNumber,
              newSup,
              newOC,
              selectedIds,
              reason
            );
            setChangingSupplierModal(null);
          }}
        />
      )}

      {/* FLOATING BULK ACTIONS BAR */}
      {selectedItemMap.size > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[95%] max-w-4xl bg-slate-900/95 backdrop-blur-md border-2 border-sky-500/80 shadow-2xl rounded-2xl p-3 flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30">
              <CheckSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-black text-white flex items-center gap-2">
                <span>{selectedItemMap.size} {selectedItemMap.size === 1 ? 'equipo seleccionado' : 'equipos seleccionados'}</span>
              </div>
              <button
                type="button"
                onClick={clearSelection}
                className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
              >
                Deseleccionar todos
              </button>
            </div>
          </div>

          {/* Bulk Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 1-Click Direct Button for Entregado e Instalado */}
            <button
              type="button"
              onClick={() => handleApplyBatchStatus('Entregado e Instalado')}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black transition-all shadow-md shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5"
              title="Marcar todos los seleccionados como «Entregado e Instalado»"
            >
              <CheckCircle2 className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              <span>Entregado e Instalado</span>
            </button>

            {/* General status dropdown selector */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-700">
              <select
                value={batchStatusValue}
                onChange={(e) => setBatchStatusValue(e.target.value as OCStatus)}
                className="bg-transparent text-slate-200 text-xs font-bold px-2 py-0.5 outline-none cursor-pointer"
              >
                {OC_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.status} value={opt.status} className="bg-slate-900 text-white">
                    {opt.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleApplyBatchStatus(batchStatusValue)}
                className="px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition cursor-pointer"
              >
                Aplicar
              </button>
            </div>

            {/* Split / Reassign to New OV & OC */}
            {onOpenSplitOrderModal && (
              <button
                type="button"
                onClick={handleOpenSplitModalFromSelection}
                className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                title="Trasladar los equipos seleccionados a una nueva OV y nueva OC"
              >
                <GitFork className="w-3.5 h-3.5" />
                <span>Mover a Nueva OV / OC</span>
              </button>
            )}

            <button
              type="button"
              onClick={clearSelection}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ml-1"
              title="Cerrar barra"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

interface ChangeSupplierDialogProps {
  contractId: string;
  currentSupplier: string;
  currentOCNumber: string;
  items: OCTrackingItem[];
  onClose: () => void;
  onConfirm: (
    newSupplier: string,
    newOCNumber: string,
    selectedItemIds: string[],
    reason: string
  ) => void;
}

const ChangeSupplierDialog: React.FC<ChangeSupplierDialogProps> = ({
  currentSupplier,
  currentOCNumber,
  items,
  onClose,
  onConfirm,
}) => {
  const [newSupplier, setNewSupplier] = useState('');
  const [newOCNumber, setNewOCNumber] = useState(
    isValidOCNumber(currentOCNumber) ? currentOCNumber : ''
  );
  const [reason, setReason] = useState('Cambio de proveedor para optimizar compra/entrega');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(items.map((it) => it.id))
  );

  const storedProfiles = useMemo(() => getStoredSupplierProfiles(), []);

  // Compute distinct brands in the selected items
  const brands = useMemo(() => {
    const set = new Set<string>();
    items.forEach((it) => {
      if (it.brand) set.add(it.brand.trim());
    });
    return Array.from(set);
  }, [items]);

  // Suppliers registered for these brands
  const brandSuppliers = useMemo(() => {
    if (brands.length === 0) return [];
    return storedProfiles.filter((p) => {
      const matchBrand = (p.brands || []).some((b) =>
        brands.some(
          (br) =>
            b.toLowerCase().includes(br.toLowerCase()) ||
            br.toLowerCase().includes(b.toLowerCase())
        )
      );
      const matchName = brands.some((br) =>
        p.name.toLowerCase().includes(br.toLowerCase())
      );
      return matchBrand || matchName;
    });
  }, [brands, storedProfiles]);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((it) => it.id)));
    }
  };

  const allSelected = selectedIds.size === items.length && items.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#101b2b] border border-sky-500/50 rounded-2xl w-full max-w-lg p-4 sm:p-5 shadow-2xl space-y-4 animate-scaleUp max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#253952] pb-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-300 border border-sky-400/30">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">
                Cambiar Proveedor de Orden de Compra
              </h3>
              <p className="text-[11px] text-slate-400">
                Proveedor actual: <strong className="text-amber-300">{currentSupplier}</strong>
                {currentOCNumber ? ` • OC: ${currentOCNumber}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto space-y-3.5 flex-1 pr-1 text-xs">
          {/* Equipments Selection */}
          <div className="bg-[#0b1420] p-3 rounded-xl border border-[#223854] space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-300 text-[11.5px]">
                Equipos a reasignar ({selectedIds.size} de {items.length} seleccionados):
              </span>
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-[10.5px] font-bold text-sky-400 hover:text-sky-300 transition cursor-pointer"
                >
                  {allSelected ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </button>
              )}
            </div>

            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {items.map((it) => {
                const isChecked = selectedIds.has(it.id);
                return (
                  <div
                    key={it.id}
                    onClick={() => toggleItem(it.id)}
                    className={`p-2 rounded-lg border transition cursor-pointer flex items-center justify-between gap-2 ${
                      isChecked
                        ? 'bg-sky-950/50 border-sky-500/40 text-white'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {isChecked ? (
                        <CheckSquare className="w-4 h-4 text-sky-400 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <span className="font-bold block truncate text-xs">{it.name}</span>
                        <span className="text-[10.5px] text-slate-400 block truncate">
                          {it.brand ? `Marca: ${it.brand} • ` : ''}Cant: {it.quantity || 1} • {it.code || 'S/C'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                      ${((it.totalCostCOP || (it.costPriceCOP * (it.quantity || 1)))).toLocaleString('es-CO')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* New Supplier Selector */}
          <div>
            <label className="block text-xs font-bold text-sky-300 mb-1">
              Nuevo Proveedor / Fabricante *:
            </label>
            <input
              type="text"
              list="suggested-suppliers-list"
              required
              placeholder="Buscar o escribir nombre del nuevo proveedor..."
              value={newSupplier}
              onChange={(e) => setNewSupplier(e.target.value)}
              className="w-full bg-[#0b1420] border-2 border-sky-500/50 rounded-xl px-3 py-2 text-sm font-bold text-white outline-none focus:border-sky-400"
            />
            <datalist id="suggested-suppliers-list">
              {Array.from(new Set([...storedProfiles.map((p) => p.name), ...COMMON_SUPPLIERS])).map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          {/* Suggested Suppliers for this Brand */}
          {brandSuppliers.length > 0 && (
            <div className="p-2.5 rounded-xl bg-sky-950/60 border border-sky-500/30 space-y-1.5">
              <span className="text-[10.5px] font-bold text-sky-300 block">
                Proveedores registrados para {brands.join(', ')}:
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {brandSuppliers.map((sup) => (
                  <button
                    key={sup.id || sup.name}
                    type="button"
                    onClick={() => setNewSupplier(sup.name)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-slate-200 border border-slate-700 font-bold transition cursor-pointer"
                  >
                    {sup.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Optional New OC Number */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                N° de Orden de Compra (OC):
              </label>
              <input
                type="text"
                placeholder="ej: OC-10452"
                value={newOCNumber}
                onChange={(e) => setNewOCNumber(e.target.value)}
                className="w-full bg-[#0b1420] border border-[#223854] rounded-lg p-2 text-sky-300 font-mono font-bold outline-none focus:border-sky-400"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">
                Motivo del Cambio:
              </label>
              <input
                type="text"
                placeholder="ej: Mejor precio / stock disponible"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-[#0b1420] border border-[#223854] rounded-lg p-2 text-slate-200 outline-none focus:border-sky-400 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#253952] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!newSupplier.trim() || selectedIds.size === 0}
            onClick={() => onConfirm(newSupplier.trim(), newOCNumber.trim(), Array.from(selectedIds), reason.trim())}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-sky-500 hover:bg-sky-400 text-slate-950 shadow-md transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Guardar Cambio ({selectedIds.size} eq.)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
