import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  OCTrackingContract,
  OCTrackingItem,
  OCStatus,
  OCPaymentTerms,
  OCPaymentStatus,
  TenderClientProject,
  MedicalEquipment,
  AuthUser,
  ItemSerialNumberRecord,
  TechnicalDocument,
  SupplierInvoiceAttachment,
  SalesOrderRecord,
} from '../../types';
import {
  getStoredOCTrackingContracts,
  saveStoredOCTrackingContracts,
  syncAwardedTendersToOCTracking,
  deduplicateOCTrackingContracts,
  COMMON_SUPPLIERS,
  exportOCTrackingToExcel,
  autoRegisterSupplierIfNotExists,
} from '../../utils/ocTrackingStorage';
import {
  getStoredSalesOrders,
  saveStoredSalesOrders,
  splitSalesOrderRecord,
  createOCTrackingContractFromSalesOrder,
} from '../../utils/salesOrdersStorage';
import { normalizeClean, isValidOCNumber } from '../../utils/formatters';
import { SplitSalesOrderModal } from './sales-orders/SplitSalesOrderModal';
import {
  deleteOCTrackingContractFromFirestore,
  saveOCTrackingContractsToFirestore,
  saveSingleOCTrackingContractToFirestore,
  saveSalesOrdersBatchToFirestore,
} from '../../services/realtimeSync';
import {
  markContractAsDeleted,
  unmarkContractAsDeleted,
  isContractDeleted,
} from '../../utils/tombstones';

import { OCTrackingHeader } from './oc-tracking/OCTrackingHeader';
import { ContractHierarchyView } from './oc-tracking/ContractHierarchyView';
import { SupplierGroupedView, GroupedSupplierData } from './oc-tracking/SupplierGroupedView';
import { MasterTableView, FlatItemRow } from './oc-tracking/MasterTableView';
import { NewSupplierOCModal } from './oc-tracking/NewSupplierOCModal';
import { EditOCHeaderModal } from './oc-tracking/EditOCHeaderModal';
import { EditOCItemModal } from './oc-tracking/EditOCItemModal';
import { AddItemsToOCModal } from './oc-tracking/AddItemsToOCModal';
import { OCHistoryModal } from './oc-tracking/OCHistoryModal';
import { ManageSuppliersModal } from './oc-tracking/ManageSuppliersModal';
import { ItemSerialsDossierModal } from './oc-tracking/ItemSerialsDossierModal';
import { SupplierInvoicesModal } from './oc-tracking/SupplierInvoicesModal';
import { Trash2 } from 'lucide-react';

interface OCTrackingViewProps {
  contracts: OCTrackingContract[];
  onUpdateContracts: (updated: OCTrackingContract[]) => void;
  tenderClients?: TenderClientProject[];
  salesOrders?: SalesOrderRecord[];
  onUpdateSalesOrders?: (orders: SalesOrderRecord[]) => void;
  equipments: MedicalEquipment[];
  allDocuments?: TechnicalDocument[];
  currentUser?: AuthUser | null;
  onNavigateToTab?: (tab: string) => void;
  onUpdateEquipmentBaseCost?: (
    equipmentIdOrCodeOrName: string,
    newCost: number,
    brand?: string,
    model?: string
  ) => void;
}

export const OCTrackingView: React.FC<OCTrackingViewProps> = ({
  contracts,
  onUpdateContracts,
  tenderClients = [],
  salesOrders = [],
  onUpdateSalesOrders,
  equipments,
  allDocuments = [],
  currentUser,
  onNavigateToTab,
  onUpdateEquipmentBaseCost,
}) => {
  const isReadOnly = currentUser?.role === 'viewer' && !currentUser?.permissions?.canManageOCTracking;

  // View mode: 'hierarchy' (default, client contract -> supplier OCs -> equipments), 'supplier', or 'table'
  const [viewMode, setViewMode] = useState<'hierarchy' | 'supplier' | 'table'>('hierarchy');

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSupplier, setFilterSupplier] = useState<string>('ALL');
  const [filterPaymentTerms, setFilterPaymentTerms] = useState<string>('ALL');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterAlertOnly, setFilterAlertOnly] = useState<boolean>(false);

  // Contracts collapsed / expanded state persisted in localStorage
  const [expandedContractIds, setExpandedContractIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('syd_oc_expanded_contracts_v1');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Modals state
  const [isNewOCModalOpen, setIsNewOCModalOpen] = useState(false);
  const [isSuppliersModalOpen, setIsSuppliersModalOpen] = useState(false);
  const [targetContractForNewOC, setTargetContractForNewOC] = useState<OCTrackingContract | null>(null);
  const [editingOCHeaderState, setEditingOCHeaderState] = useState<OCTrackingContract | null>(null);
  const [editingItemState, setEditingItemState] = useState<{ contractId: string; item: OCTrackingItem } | null>(null);
  const [serialsModalState, setSerialsModalState] = useState<{
    contract: OCTrackingContract;
    item: OCTrackingItem;
  } | null>(null);
  const [addItemsToOCState, setAddItemsToOCState] = useState<{
    contractId: string;
    ocNumber: string;
    supplier: string;
  } | null>(null);
  const [historyModalItem, setHistoryModalItem] = useState<{
    contractName: string;
    item: OCTrackingItem;
  } | null>(null);
  const [supplierInvoicesModalTarget, setSupplierInvoicesModalTarget] = useState<{
    contractId: string;
    contractName?: string;
    supplier: string;
    ocNumber: string;
    invoices: SupplierInvoiceAttachment[];
  } | null>(null);

  // State for Split Sales Order / Move delayed items to New OV & OC modal
  const [splitModalState, setSplitModalState] = useState<{
    isOpen: boolean;
    sourceOrder?: SalesOrderRecord | null;
    preselectedItemIds?: string[];
  }>({ isOpen: false });

  // In-app delete confirm state (works reliably inside sandboxed iframes)
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    title: string;
    subtitle: string;
    onConfirm: () => void;
  } | null>(null);

  // Listen for global custom events to open modals (from Mara AI Assistant or external triggers)
  useEffect(() => {
    const handleOpenSuppliers = () => {
      setIsSuppliersModalOpen(true);
    };

    const handleOpenNewOC = () => {
      setTargetContractForNewOC(null);
      setIsNewOCModalOpen(true);
    };

    window.addEventListener('syd_open_suppliers_modal', handleOpenSuppliers);
    window.addEventListener('syd_open_new_oc_modal', handleOpenNewOC);

    return () => {
      window.removeEventListener('syd_open_suppliers_modal', handleOpenSuppliers);
      window.removeEventListener('syd_open_new_oc_modal', handleOpenNewOC);
    };
  }, []);

  // Handle ESC key press to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteConfirmState) {
          setDeleteConfirmState(null);
        } else if (historyModalItem) {
          setHistoryModalItem(null);
        } else if (addItemsToOCState) {
          setAddItemsToOCState(null);
        } else if (editingItemState) {
          setEditingItemState(null);
        } else if (editingOCHeaderState) {
          setEditingOCHeaderState(null);
        } else if (isNewOCModalOpen) {
          setIsNewOCModalOpen(false);
          setTargetContractForNewOC(null);
        } else if (isSuppliersModalOpen) {
          setIsSuppliersModalOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    deleteConfirmState,
    historyModalItem,
    addItemsToOCState,
    editingItemState,
    editingOCHeaderState,
    isNewOCModalOpen,
    isSuppliersModalOpen,
  ]);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Ensure all contracts are strictly consolidated by client/order into a single card
  const deduplicatedContracts = useMemo(() => {
    return deduplicateOCTrackingContracts(contracts);
  }, [contracts]);

  const effectiveSalesOrders = useMemo(() => {
    return salesOrders && salesOrders.length > 0 ? salesOrders : getStoredSalesOrders();
  }, [salesOrders]);

  const contractsRef = useRef(contracts);
  useEffect(() => {
    contractsRef.current = contracts;
  }, [contracts]);

  // Auto-reconciliation: Guarantee all active Sales Orders with items are represented in contracts
  useEffect(() => {
    if (!onUpdateContracts) return;
    const activeOrders = effectiveSalesOrders.filter(
      (so) => (so.items || []).length > 0 && so.status !== 'Cancelada'
    );
    if (activeOrders.length === 0) return;

    const currentContracts = contractsRef.current || [];
    let hasNewContracts = false;
    let nextContracts = [...currentContracts];

    activeOrders.forEach((so) => {
      const soNum = (so.salesOrderNumber || '').trim();
      const soId = so.id;
      const soClient = normalizeClean(so.clientName);

      const alreadyCovered = nextContracts.some((c) => {
        if (soId && c.salesOrderId === soId) return true;
        if (c.salesOrderIds && soId && c.salesOrderIds.includes(soId)) return true;
        if (soNum && c.salesOrderNumber === soNum) return true;
        if (c.salesOrderNumbers && soNum && c.salesOrderNumbers.includes(soNum)) return true;
        if (c.items?.some((it) => (soId && it.salesOrderId === soId) || (soNum && it.salesOrderNumber === soNum))) {
          return true;
        }
        return false;
      });

      if (!alreadyCovered) {
        const newContract = createOCTrackingContractFromSalesOrder(so, equipments);
        // If contract for same client already exists, merge items under this client contract card
        const clientContractIdx = nextContracts.findIndex(
          (c) => normalizeClean(c.clientName) === soClient && soClient.length > 3
        );
        if (clientContractIdx >= 0) {
          const existingC = nextContracts[clientContractIdx];
          const combinedItems = [...existingC.items];
          newContract.items.forEach((newIt) => {
            const alreadyHas = combinedItems.some(
              (ci) => ci.id === newIt.id || (ci.code && ci.code === newIt.code && ci.salesOrderId === newIt.salesOrderId)
            );
            if (!alreadyHas) combinedItems.push(newIt);
          });
          const updatedSOIds = Array.from(new Set([...(existingC.salesOrderIds || []), so.id]));
          const updatedSONums = Array.from(
            new Set([...(existingC.salesOrderNumbers || []), so.salesOrderNumber].filter(Boolean))
          );
          nextContracts[clientContractIdx] = {
            ...existingC,
            items: combinedItems,
            salesOrderIds: updatedSOIds,
            salesOrderNumbers: updatedSONums,
          };
        } else {
          nextContracts.push(newContract);
        }
        hasNewContracts = true;
      }
    });

    if (hasNewContracts) {
      onUpdateContracts(nextContracts);
      saveStoredOCTrackingContracts(nextContracts);
      saveOCTrackingContractsToFirestore(nextContracts).catch(console.warn);
    }
  }, [effectiveSalesOrders, equipments, onUpdateContracts]);

  // Distinct suppliers collected across all contracts
  const distinctSuppliers = useMemo(() => {
    const set = new Set<string>();
    deduplicatedContracts.forEach((c) => {
      if (c.supplier) set.add(c.supplier);
      c.items.forEach((it) => {
        if (it.supplier) set.add(it.supplier);
      });
    });
    return Array.from(set).sort();
  }, [deduplicatedContracts]);

  // Lifecycle state: active (default, pending items), archived (100% delivered/installed), or all
  const [lifecycleTab, setLifecycleTab] = useState<'active' | 'archived' | 'all'>('active');

  // Compute KPIs
  const kpis = useMemo(() => {
    let totalItems = 0;
    let totalCostCOP = 0;
    let pendingItems = 0;
    let pendingTotalCostCOP = 0;
    let completedItems = 0;
    let completedTotalCostCOP = 0;
    let totalCreditOrders = 0;
    let totalAlerts = 0;

    // Track OCs and their individual statuses
    const ocStatusMap = new Map<string, { hasPending: boolean; hasCompleted: boolean; totalCost: number }>();

    deduplicatedContracts.forEach((c) => {
      c.items.forEach((it) => {
        const qty = it.quantity || 1;
        const cost = it.totalCostCOP || (it.costPriceCOP * qty);
        totalItems += qty;
        totalCostCOP += cost;

        const ocKey = `${it.supplier}__${it.ocNumber}__${c.id}`;
        if (!ocStatusMap.has(ocKey)) {
          ocStatusMap.set(ocKey, { hasPending: false, hasCompleted: false, totalCost: 0 });
        }
        const ocEntry = ocStatusMap.get(ocKey)!;
        ocEntry.totalCost += cost;

        const isCompleted =
          it.status === 'Entregado e Instalado' ||
          it.status === 'Cerrado / Concluido';
        const isCancelled = it.status === 'Cancelada';

        if (isCompleted) {
          completedItems += qty;
          completedTotalCostCOP += cost;
          ocEntry.hasCompleted = true;
        } else if (!isCancelled) {
          pendingItems += qty;
          pendingTotalCostCOP += cost;
          ocEntry.hasPending = true;
        }

        if (
          it.paymentTerms &&
          (it.paymentTerms.toLowerCase().includes('crédito') ||
            it.paymentTerms.toLowerCase().includes('credito') ||
            it.paymentTerms.toLowerCase().includes('l/c'))
        ) {
          totalCreditOrders++;
        }

        const lastUpdate = new Date(it.lastUpdatedAt || it.createdAt).getTime();
        const hours = (Date.now() - lastUpdate) / (1000 * 60 * 60);
        if (
          hours > 48 &&
          !isCompleted &&
          !isCancelled
        ) {
          totalAlerts++;
        }
      });
    });

    let pendingOCs = 0;
    let completedOCs = 0;
    ocStatusMap.forEach((entry) => {
      if (entry.hasPending) {
        pendingOCs++;
      } else if (entry.hasCompleted) {
        completedOCs++;
      }
    });

    return {
      pendingOCs,
      pendingItems,
      pendingTotalCostCOP,
      completedOCs,
      completedItems,
      completedTotalCostCOP,
      totalContracts: deduplicatedContracts.length,
      totalOCs: ocStatusMap.size || deduplicatedContracts.length,
      totalItems,
      totalCostCOP,
      totalCreditOrders,
      totalAlerts,
    };
  }, [deduplicatedContracts]);

  // Compute active vs archived counts across all distinct OCs / OVs
  const { activeOCsCount, archivedOCsCount, totalOCsCount } = useMemo(() => {
    const ocStatusMap = new Map<string, { hasPending: boolean; hasCompleted: boolean }>();

    deduplicatedContracts.forEach((c) => {
      c.items.forEach((it) => {
        const key = it.salesOrderId
          ? `so-${it.salesOrderId}`
          : it.salesOrderNumber
          ? `sonum-${it.salesOrderNumber}-${c.id}`
          : it.ocNumber
          ? `oc-${it.supplier}-${it.ocNumber}-${c.id}`
          : `item-${it.id}`;

        if (!ocStatusMap.has(key)) {
          ocStatusMap.set(key, { hasPending: false, hasCompleted: false });
        }
        const entry = ocStatusMap.get(key)!;
        const isCompleted =
          it.status === 'Entregado e Instalado' ||
          it.status === 'Cerrado / Concluido';
        const isCancelled = it.status === 'Cancelada';

        if (isCompleted) {
          entry.hasCompleted = true;
        } else if (!isCancelled) {
          entry.hasPending = true;
        }
      });
    });

    let active = 0;
    let archived = 0;

    ocStatusMap.forEach((entry) => {
      if (entry.hasPending) {
        active++;
      } else if (entry.hasCompleted) {
        archived++;
      }
    });

    const finalArchived = Math.max(archived, kpis.completedOCs);
    const finalActive = Math.max(active, kpis.pendingOCs);
    const finalTotal = ocStatusMap.size || kpis.totalOCs || (finalActive + finalArchived);

    return {
      activeOCsCount: finalActive,
      archivedOCsCount: finalArchived,
      totalOCsCount: finalTotal,
    };
  }, [deduplicatedContracts, kpis.completedOCs, kpis.pendingOCs, kpis.totalOCs]);

  // Filtered Contracts (Hierarchical)
  const filteredContracts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return deduplicatedContracts
      .map((contract) => {
        const matchesContractText =
          !term ||
          contract.contractNumber.toLowerCase().includes(term) ||
          contract.clientName.toLowerCase().includes(term) ||
          contract.nit.toLowerCase().includes(term) ||
          (contract.supplier && contract.supplier.toLowerCase().includes(term)) ||
          (contract.ocNumber && contract.ocNumber.toLowerCase().includes(term));

        const filteredItems = contract.items.filter((item) => {
          // Lifecycle Tab Filter (Activas / Pendientes vs Entregadas & Archivadas)
          const isItemDelivered =
            item.status === 'Entregado e Instalado' ||
            item.status === 'Cerrado / Concluido';

          if (lifecycleTab === 'active' && isItemDelivered) {
            return false;
          }
          if (lifecycleTab === 'archived' && !isItemDelivered) {
            return false;
          }

          const matchesItemText =
            !term ||
            matchesContractText ||
            item.name.toLowerCase().includes(term) ||
            item.brand.toLowerCase().includes(term) ||
            item.model.toLowerCase().includes(term) ||
            item.supplier.toLowerCase().includes(term) ||
            item.ocNumber.toLowerCase().includes(term);

          const matchesSupplier =
            filterSupplier === 'ALL' || item.supplier === filterSupplier;

          const matchesPaymentTerms =
            filterPaymentTerms === 'ALL' || item.paymentTerms === filterPaymentTerms;

          const matchesPaymentStatus =
            filterPaymentStatus === 'ALL' || item.paymentStatus === filterPaymentStatus;

          const matchesStatus =
            filterStatus === 'ALL' || item.status === filterStatus;

          const lastUpdate = new Date(item.lastUpdatedAt || item.createdAt).getTime();
          const hours = (Date.now() - lastUpdate) / (1000 * 60 * 60);
          const isAlert =
            hours > 48 &&
            item.status !== 'Entregado e Instalado' &&
            item.status !== 'Cerrado / Concluido' &&
            item.status !== 'Cancelada';

          const matchesAlert = !filterAlertOnly || isAlert;

          return (
            matchesItemText &&
            matchesSupplier &&
            matchesPaymentTerms &&
            matchesPaymentStatus &&
            matchesStatus &&
            matchesAlert
          );
        });

        // If the contract text itself matched and has 0 items, keep it so the user can add OCs to it
        if (matchesContractText && contract.items.length === 0 && !filterAlertOnly && lifecycleTab !== 'archived') {
          return contract;
        }

        if (filteredItems.length === 0) {
          return null;
        }

        return {
          ...contract,
          items: filteredItems,
        };
      })
      .filter((c): c is OCTrackingContract => c !== null);
  }, [
    contracts,
    lifecycleTab,
    searchTerm,
    filterSupplier,
    filterPaymentTerms,
    filterPaymentStatus,
    filterStatus,
    filterAlertOnly,
  ]);

  // Grouped by Supplier data structure
  const groupedBySupplier = useMemo((): GroupedSupplierData[] => {
    const map = new Map<string, GroupedSupplierData>();

    filteredContracts.forEach((contract) => {
      contract.items.forEach((item) => {
        const supplierName = item.supplier || 'Sin Proveedor Asignado';

        if (!map.has(supplierName)) {
          map.set(supplierName, {
            supplier: supplierName,
            totalCostCOP: 0,
            totalUnits: 0,
            hasAlert: false,
            ocGroups: [],
          });
        }

        const supData = map.get(supplierName)!;
        supData.totalCostCOP += item.totalCostCOP || (item.costPriceCOP * item.quantity);
        supData.totalUnits += item.quantity || 1;

        const lastUpdate = new Date(item.lastUpdatedAt || item.createdAt).getTime();
        const hours = (Date.now() - lastUpdate) / (1000 * 60 * 60);
        if (
          hours > 48 &&
          item.status !== 'Entregado e Instalado' &&
          item.status !== 'Cerrado / Concluido' &&
          item.status !== 'Cancelada'
        ) {
          supData.hasAlert = true;
        }

        // Find or create OC group
        let ocGrp = supData.ocGroups.find(
          (g) => g.ocNumber === item.ocNumber && g.contractId === contract.id
        );
        if (!ocGrp) {
          ocGrp = {
            ocNumber: item.ocNumber || 'Sin N° OC',
            contractId: contract.id,
            contractNumber: contract.contractNumber,
            clientName: contract.clientName,
            city: contract.city,
            paymentTerms: item.paymentTerms || 'Crédito 30 días',
            paymentStatus: item.paymentStatus || 'Pendiente',
            status: item.status || 'Emitida / Enviada al Proveedor',
            totalCostCOP: 0,
            items: [],
          };
          supData.ocGroups.push(ocGrp);
        }

        ocGrp.items.push(item);
        ocGrp.totalCostCOP += item.totalCostCOP || (item.costPriceCOP * item.quantity);
      });
    });

    return Array.from(map.values()).sort((a, b) => b.totalCostCOP - a.totalCostCOP);
  }, [filteredContracts]);

  // Flat Item Rows for Master Table
  const flatItemRows = useMemo((): FlatItemRow[] => {
    const rows: FlatItemRow[] = [];
    filteredContracts.forEach((contract) => {
      contract.items.forEach((item) => {
        rows.push({
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          clientName: contract.clientName,
          city: contract.city,
          item,
        });
      });
    });
    return rows;
  }, [filteredContracts]);

  // Toggle contract collapse in hierarchy view
  const handleToggleContractCollapse = (contractId: string) => {
    setExpandedContractIds((prev) => {
      const next = new Set(prev);
      if (next.has(contractId)) {
        next.delete(contractId);
      } else {
        next.add(contractId);
      }
      try {
        localStorage.setItem('syd_oc_expanded_contracts_v1', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // Contracts passed to ContractHierarchyView keep full item list so ContractHierarchyView can match OVs accurately
  const filteredContractsForHierarchy = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return deduplicatedContracts
      .map((contract) => {
        const matchesContractText =
          !term ||
          contract.contractNumber.toLowerCase().includes(term) ||
          contract.clientName.toLowerCase().includes(term) ||
          contract.nit.toLowerCase().includes(term) ||
          (contract.supplier && contract.supplier.toLowerCase().includes(term)) ||
          (contract.ocNumber && contract.ocNumber.toLowerCase().includes(term));

        if (!matchesContractText) {
          const hasMatchingItem = contract.items.some(
            (it) =>
              it.name.toLowerCase().includes(term) ||
              it.brand.toLowerCase().includes(term) ||
              it.model.toLowerCase().includes(term) ||
              it.supplier.toLowerCase().includes(term) ||
              it.ocNumber.toLowerCase().includes(term)
          );
          if (!hasMatchingItem) return null;
        }

        return contract;
      })
      .filter((c): c is OCTrackingContract => c !== null);
  }, [deduplicatedContracts, searchTerm]);

  // Quick changes on item status / payment terms
  const handleQuickChangeItemStatus = (contractId: string, itemId: string, newStatus: OCStatus) => {
    let itemFoundInAnyContract = false;
    let targetSOItem: any = null;

    // Check if this itemId points to a Sales Order item
    const currentSalesOrders = salesOrders && salesOrders.length > 0 ? salesOrders : getStoredSalesOrders();
    for (const so of currentSalesOrders) {
      for (const soIt of so.items || []) {
        if (
          itemId === `so-it-${so.id}-${soIt.id}` ||
          itemId === soIt.id ||
          itemId.includes(String(soIt.id)) ||
          (soIt.equipmentId && String(soIt.equipmentId) === String(itemId))
        ) {
          targetSOItem = { so, soIt };
          break;
        }
      }
      if (targetSOItem) break;
    }

    // Fallback: If not found by direct ID, locate item in contracts and match against SO items
    if (!targetSOItem) {
      for (const c of contracts) {
        const it = c.items.find((item) => item.id === itemId);
        if (it) {
          for (const so of currentSalesOrders) {
            for (const soIt of so.items || []) {
              if (
                (it.salesOrderItemId && soIt.id === it.salesOrderItemId) ||
                (it.salesOrderId && so.id === it.salesOrderId && it.code === soIt.code) ||
                (it.salesOrderId && so.id === it.salesOrderId && it.name === soIt.name) ||
                (it.equipmentId && soIt.equipmentId && it.equipmentId === soIt.equipmentId) ||
                (it.code && soIt.code && it.code.trim().toLowerCase() === soIt.code.trim().toLowerCase()) ||
                (it.name && soIt.name && it.name.trim().toLowerCase() === soIt.name.trim().toLowerCase())
              ) {
                targetSOItem = { so, soIt };
                break;
              }
            }
            if (targetSOItem) break;
          }
          break;
        }
      }
    }

    const isNowDelivered =
      newStatus === 'Entregado e Instalado' || newStatus === 'Cerrado / Concluido';

    // A real OC number is mandatory before advancing an item beyond the initial draft.
    const isAdvancedStatus = newStatus !== 'Borrador / Solicitud' && newStatus !== 'Cancelada';
    if (isAdvancedStatus) {
      const targetContract = contracts.find((c) => c.id === contractId);
      const relatedItems = (targetContract?.items || []).filter(
        (it) =>
          it.id === itemId ||
          it.salesOrderItemId === itemId ||
          (targetSOItem && targetSOItem.soIt.id === it.salesOrderItemId) ||
          (it.equipmentId && String(it.equipmentId) === String(itemId))
      );
      const ocCandidates = [
        ...relatedItems.map((it) => it.ocNumber),
        targetSOItem?.soIt?.supplierOCRef,
        targetSOItem?.soIt?.linkedSupplierOCNumber,
      ];
      if (!ocCandidates.some((oc) => isValidOCNumber(oc))) {
        alert(
          '⛔ N° DE OC REQUERIDO:\n\nDebes registrar el número real de Orden de Compra del proveedor antes de cambiar el estado, proveedor, seriales o facturación de este equipo.\n\nEdita el ítem y guarda su N° de OC primero.'
        );
        return;
      }
    }

    const updated = contracts.map((c) => {
      if (c.id !== contractId) return c;

      const directExists = c.items.some((it) => it.id === itemId);
      let matchedCount = 0;

      const updatedItems = c.items.map((it) => {
        const isMatch = directExists
          ? it.id === itemId
          : it.id === itemId ||
            it.salesOrderItemId === itemId ||
            (it.equipmentId && String(it.equipmentId) === String(itemId)) ||
            (targetSOItem && targetSOItem.soIt.id === it.salesOrderItemId) ||
            (targetSOItem && targetSOItem.soIt.code && it.code && targetSOItem.soIt.code === it.code);

        if (!isMatch) return it;
        matchedCount++;
        itemFoundInAnyContract = true;

        return {
          ...it,
          status: newStatus,
          paymentStatus: isNowDelivered ? 'Pagado al Proveedor' : it.paymentStatus,
          deliveryDate: isNowDelivered
            ? it.deliveryDate || new Date().toISOString().split('T')[0]
            : it.deliveryDate,
          installedDate: isNowDelivered
            ? it.installedDate || new Date().toISOString().split('T')[0]
            : it.installedDate,
          lastUpdatedAt: new Date().toISOString(),
          history: [
            ...(it.history || []),
            {
              id: `log-${Date.now()}`,
              timestamp: new Date().toISOString(),
              previousStatus: it.status,
              newStatus,
              user: currentUser ? currentUser.name : 'Usuario SYD',
              note: `Estado actualizado rápidamente a "${newStatus}".`,
            },
          ],
        };
      });

      // If item was rendered on-the-fly from a Sales Order and not yet in c.items, append it!
      if (matchedCount === 0 && targetSOItem) {
        itemFoundInAnyContract = true;
        const cost = Math.round(Number(targetSOItem.soIt.unitSalePriceCOP || 1000000) * 0.65);
        const qty = Number(targetSOItem.soIt.quantityToDispatch) || 1;

        updatedItems.push({
          id: itemId,
          equipmentId: targetSOItem.soIt.equipmentId,
          code: String(targetSOItem.soIt.code || 'EQ-1'),
          name: String(targetSOItem.soIt.name || 'Equipo Biomédico'),
          brand: String(targetSOItem.soIt.brand || ''),
          model: String(targetSOItem.soIt.model || ''),
          quantity: qty,
          costPriceCOP: cost,
          totalCostCOP: cost * qty,
          supplier: String(targetSOItem.soIt.supplier || targetSOItem.soIt.supplierName || 'Proveedor'),
          ocNumber: String(targetSOItem.soIt.supplierOCRef || targetSOItem.soIt.linkedSupplierOCNumber || ''),
          status: newStatus,
          paymentStatus: isNowDelivered ? 'Pagado al Proveedor' : 'Pendiente',
          deliveryDate: isNowDelivered ? new Date().toISOString().split('T')[0] : undefined,
          installedDate: isNowDelivered ? new Date().toISOString().split('T')[0] : undefined,
          serialNumber: targetSOItem.soIt.serialNumber || targetSOItem.soIt.assignedSerialNumbers?.[0] || '',
          serialNumbers: targetSOItem.soIt.serialNumbers || (targetSOItem.soIt.serialNumber ? [{ id: `sn-${Date.now()}`, serialNumber: targetSOItem.soIt.serialNumber, status: newStatus as any }] : []),
          salesOrderId: targetSOItem.so.id,
          salesOrderNumber: targetSOItem.so.salesOrderNumber,
          salesOrderItemId: targetSOItem.soIt.id,
          createdAt: targetSOItem.so.orderDate || new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
          notes: `Equipo de Orden de Venta ${targetSOItem.so.salesOrderNumber}`,
          history: [
            {
              id: `log-${Date.now()}`,
              timestamp: new Date().toISOString(),
              previousStatus: 'Borrador / Solicitud',
              newStatus,
              user: currentUser ? currentUser.name : 'Usuario SYD',
              note: `Estado establecido a "${newStatus}".`,
            },
          ],
        });
      }

      return {
        ...c,
        items: updatedItems,
        lastUpdatedAt: new Date().toISOString(),
      };
    });

    // Also sync sales orders in storage and React state
    if (targetSOItem) {
      try {
        const updatedSOs = currentSalesOrders.map((so) => {
          if (so.id !== targetSOItem.so.id) return so;
          return {
            ...so,
            items: (so.items || []).map((it) => {
              const isMatch =
                it.id === targetSOItem.soIt.id ||
                (it.code && targetSOItem.soIt.code && it.code === targetSOItem.soIt.code) ||
                (it.name && targetSOItem.soIt.name && it.name === targetSOItem.soIt.name);
              if (!isMatch) return it;
              return {
                ...it,
                equipmentStatus: newStatus,
                status: newStatus,
                actualDeliveryDate: isNowDelivered
                  ? new Date().toISOString().split('T')[0]
                  : (it as any).actualDeliveryDate,
              };
            }),
            updatedAt: new Date().toISOString(),
          };
        });
        saveStoredSalesOrders(updatedSOs);
        if (onUpdateSalesOrders) {
          onUpdateSalesOrders(updatedSOs);
        }
      } catch (e) {
        console.warn('Error updating sales orders:', e);
      }
    }

    onUpdateContracts(updated);
    saveStoredOCTrackingContracts(updated);
    if (isNowDelivered) {
      showToast(`✓ Equipo marcado como "${newStatus}" y archivado exitosamente`);
    } else {
      showToast(`✓ Estado actualizado a "${newStatus}"`);
    }
  };

  // Batch changes for multiple equipment items at once
  const handleBatchChangeItemStatus = (
    itemsToUpdate: Array<{ contractId: string; itemId: string }>,
    newStatus: OCStatus
  ) => {
    if (!itemsToUpdate || itemsToUpdate.length === 0) return;

    const isNowDelivered =
      newStatus === 'Entregado e Instalado' || newStatus === 'Cerrado / Concluido';

    const currentSalesOrders = salesOrders && salesOrders.length > 0 ? salesOrders : getStoredSalesOrders();
    const itemIdsSet = new Set(itemsToUpdate.map((it) => it.itemId));
    const touchedSOCodes = new Set<string>();
    const touchedSONames = new Set<string>();

    const updatedContracts = contracts.map((c) => {
      const itemsForThisContract = itemsToUpdate
        .filter((it) => it.contractId === c.id)
        .map((it) => it.itemId);

      if (itemsForThisContract.length === 0) return c;

      const updatedItems = c.items.map((it) => {
        const isMatch =
          itemsForThisContract.includes(it.id) ||
          (it.salesOrderItemId && itemsForThisContract.includes(it.salesOrderItemId));

        if (!isMatch) return it;

        if (it.code) touchedSOCodes.add(it.code.trim().toLowerCase());
        if (it.name) touchedSONames.add(it.name.trim().toLowerCase());

        return {
          ...it,
          status: newStatus,
          paymentStatus: isNowDelivered ? 'Pagado al Proveedor' : it.paymentStatus,
          deliveryDate: isNowDelivered
            ? it.deliveryDate || new Date().toISOString().split('T')[0]
            : it.deliveryDate,
          installedDate: isNowDelivered
            ? it.installedDate || new Date().toISOString().split('T')[0]
            : it.installedDate,
          lastUpdatedAt: new Date().toISOString(),
          history: [
            ...(it.history || []),
            {
              id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              timestamp: new Date().toISOString(),
              previousStatus: it.status,
              newStatus,
              user: currentUser ? currentUser.name : 'Usuario SYD',
              note: `Estado actualizado masivamente a "${newStatus}".`,
            },
          ],
        };
      });

      return {
        ...c,
        items: updatedItems,
        lastUpdatedAt: new Date().toISOString(),
      };
    });

    // Update sales orders
    try {
      let soChanged = false;
      const updatedSOs = currentSalesOrders.map((so) => {
        let orderChanged = false;
        const updatedItems = (so.items || []).map((it) => {
          const isDirectMatch =
            itemIdsSet.has(it.id) ||
            itemIdsSet.has(`so-it-${so.id}-${it.id}`) ||
            (it.code && touchedSOCodes.has(it.code.trim().toLowerCase())) ||
            (it.name && touchedSONames.has(it.name.trim().toLowerCase()));

          if (!isDirectMatch) return it;
          orderChanged = true;
          soChanged = true;

          return {
            ...it,
            equipmentStatus: newStatus,
            status: newStatus,
            actualDeliveryDate: isNowDelivered
              ? new Date().toISOString().split('T')[0]
              : (it as any).actualDeliveryDate,
          };
        });

        if (!orderChanged) return so;
        return {
          ...so,
          items: updatedItems,
          updatedAt: new Date().toISOString(),
        };
      });

      if (soChanged) {
        saveStoredSalesOrders(updatedSOs);
        if (onUpdateSalesOrders) {
          onUpdateSalesOrders(updatedSOs);
        }
      }
    } catch (e) {
      console.warn('Error updating sales orders in batch:', e);
    }

    onUpdateContracts(updatedContracts);
    saveStoredOCTrackingContracts(updatedContracts);
    saveOCTrackingContractsToFirestore(updatedContracts).catch(() => {});

    showToast(
      isNowDelivered
        ? `✓ ${itemsToUpdate.length} equipos marcados como "${newStatus}" y listos para facturar`
        : `✓ ${itemsToUpdate.length} equipos actualizados a "${newStatus}"`
    );
  };

  const handleQuickChangeItemPaymentTerms = (
    contractId: string,
    itemId: string,
    terms: OCPaymentTerms
  ) => {
    const updated = contracts.map((c) => {
      if (c.id !== contractId) return c;
      return {
        ...c,
        items: c.items.map((it) => {
          if (it.id !== itemId) return it;
          return {
            ...it,
            paymentTerms: terms,
            lastUpdatedAt: new Date().toISOString(),
          };
        }),
      };
    });

    onUpdateContracts(updated);
    saveStoredOCTrackingContracts(updated);
    showToast(`✓ Forma de pago actualizada a "${terms}"`);
  };

  const handleQuickChangeItemPaymentStatus = (
    contractId: string,
    itemId: string,
    status: OCPaymentStatus
  ) => {
    const updated = contracts.map((c) => {
      if (c.id !== contractId) return c;
      return {
        ...c,
        items: c.items.map((it) => {
          if (it.id !== itemId) return it;
          return {
            ...it,
            paymentStatus: status,
            lastUpdatedAt: new Date().toISOString(),
          };
        }),
      };
    });

    onUpdateContracts(updated);
    saveStoredOCTrackingContracts(updated);
    showToast(`✓ Estado del pago actualizado a "${status}"`);
  };

  const handleUpdateOCNumberForSupplier = (
    contractId: string,
    supplier: string,
    oldOCNumber: string,
    newOCNumber: string,
    targetItemIds?: string[],
    targetSalesOrderId?: string
  ) => {
    const cleanNew = newOCNumber.trim();
    if (!cleanNew) return;

    const updated = contracts.map((c) => {
      if (c.id !== contractId) return c;
      const updatedItems = c.items.map((it) => {
        const matchesSelection = targetItemIds && targetItemIds.length > 0
          ? targetItemIds.includes(it.id)
          : (!targetSalesOrderId || it.salesOrderId === targetSalesOrderId);

        if (
          matchesSelection &&
          it.supplier === supplier &&
          (it.ocNumber === oldOCNumber || !it.ocNumber || it.ocNumber === 'Sin N° OC')
        ) {
          return {
            ...it,
            ocNumber: cleanNew,
            lastUpdatedAt: new Date().toISOString(),
            history: [
              ...(it.history || []),
              {
                id: `log-oc-${Date.now()}`,
                timestamp: new Date().toISOString(),
                previousStatus: it.status,
                newStatus: it.status,
                user: currentUser ? currentUser.name : 'Usuario SYD',
                note: `N° de Orden de Compra asignado manualmente a "${cleanNew}".`,
              },
            ],
          };
        }
        return it;
      });

      return {
        ...c,
        items: updatedItems,
        lastUpdatedAt: new Date().toISOString(),
      };
    });

    onUpdateContracts(updated);
    saveStoredOCTrackingContracts(updated);
    saveOCTrackingContractsToFirestore(updated).catch(() => {});

    // Sync updated OC number back strictly to the target Sales Order
    try {
      const storedSOs = getStoredSalesOrders();
      let soChanged = false;
      const updatedSOs = storedSOs.map((so) => {
        if (targetSalesOrderId && so.id !== targetSalesOrderId) {
          return so; // Strictly skip other sales orders!
        }
        let orderItemChanged = false;
        const newItems = (so.items || []).map((soIt) => {
          const matchesItem = targetItemIds && targetItemIds.length > 0
            ? targetItemIds.some((tId) => tId.includes(soIt.id) || soIt.id.includes(tId))
            : true;

          if (
            matchesItem &&
            (soIt.supplier === supplier || soIt.supplierName === supplier) &&
            (!soIt.supplierOCRef || soIt.supplierOCRef === oldOCNumber || soIt.supplierOCRef === 'Sin N° OC')
          ) {
            orderItemChanged = true;
            return {
              ...soIt,
              supplierOCRef: cleanNew,
              linkedSupplierOCNumber: cleanNew,
            };
          }
          return soIt;
        });
        if (orderItemChanged) {
          soChanged = true;
          return { ...so, items: newItems, updatedAt: new Date().toISOString() };
        }
        return so;
      });
      if (soChanged) {
        saveStoredSalesOrders(updatedSOs);
        saveSalesOrdersBatchToFirestore(updatedSOs).catch(() => {});
      }
    } catch {}

    showToast(`✓ N° de Orden de Compra asignado a "${cleanNew}" exitosamente.`);
  };

  // Reassign supplier for an OC or specific equipments within an OC
  const handleUpdateOCSupplier = (
    contractId: string,
    oldSupplier: string,
    ocNumber: string,
    newSupplier: string,
    newOCNumber?: string,
    selectedItemIds?: string[],
    changeReason?: string
  ) => {
    const cleanNewSup = newSupplier.trim();
    if (!cleanNewSup) return;

    const targetOC = (newOCNumber || ocNumber || '').trim();
    if (!isValidOCNumber(targetOC)) {
      alert(
        '⛔ N° DE OC REQUERIDO:\n\nNo se puede cambiar el proveedor de un equipo sin un número real de Orden de Compra. Registra primero el N° de OC.'
      );
      return;
    }

    try {
      autoRegisterSupplierIfNotExists(cleanNewSup);
    } catch {}

    const updated = contracts.map((c) => {
      if (c.id !== contractId) return c;
      const updatedItems = c.items.map((it) => {
        const matchesSupplier = it.supplier === oldSupplier;
        const matchesOC = !ocNumber || it.ocNumber === ocNumber || !it.ocNumber || it.ocNumber === 'Sin N° OC';
        const matchesItemSelection = !selectedItemIds || selectedItemIds.length === 0 || selectedItemIds.includes(it.id);

        if (matchesSupplier && matchesOC && matchesItemSelection) {
          const finalOC = newOCNumber && newOCNumber.trim() ? newOCNumber.trim() : it.ocNumber;
          return {
            ...it,
            supplier: cleanNewSup,
            ocNumber: finalOC,
            lastUpdatedAt: new Date().toISOString(),
            history: [
              ...(it.history || []),
              {
                id: `log-sup-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                timestamp: new Date().toISOString(),
                previousStatus: it.status,
                newStatus: it.status,
                user: currentUser ? currentUser.name : 'Usuario SYD',
                note: `Cambio de proveedor: de "${oldSupplier}" a "${cleanNewSup}"${newOCNumber && newOCNumber.trim() ? ` (OC: ${newOCNumber.trim()})` : ''}.${changeReason ? ` Motivo: ${changeReason}` : ''}`,
              },
            ],
          };
        }
        return it;
      });

      return {
        ...c,
        items: updatedItems,
        lastUpdatedAt: new Date().toISOString(),
      };
    });

    onUpdateContracts(updated);
    saveStoredOCTrackingContracts(updated);
    saveOCTrackingContractsToFirestore(updated).catch(() => {});

    // Sync updated supplier and OC back to Sales Orders (Ventana 7)
    try {
      const storedSOs = getStoredSalesOrders();
      let soChanged = false;
      const updatedSOs = storedSOs.map((so) => {
        let orderItemChanged = false;
        const newItems = (so.items || []).map((soIt) => {
          const matchesItem = selectedItemIds && selectedItemIds.length > 0
            ? selectedItemIds.some((sId) => sId.includes(soIt.id) || soIt.id.includes(sId))
            : (soIt.supplier === oldSupplier || soIt.supplierName === oldSupplier);
          if (matchesItem) {
            orderItemChanged = true;
            return {
              ...soIt,
              supplier: cleanNewSup,
              supplierName: cleanNewSup,
              supplierOCRef: newOCNumber && newOCNumber.trim() ? newOCNumber.trim() : soIt.supplierOCRef,
              linkedSupplierOCNumber: newOCNumber && newOCNumber.trim() ? newOCNumber.trim() : soIt.linkedSupplierOCNumber,
            };
          }
          return soIt;
        });
        if (orderItemChanged) {
          soChanged = true;
          return { ...so, items: newItems, updatedAt: new Date().toISOString() };
        }
        return so;
      });
      if (soChanged) {
        saveStoredSalesOrders(updatedSOs);
        saveSalesOrdersBatchToFirestore(updatedSOs).catch(() => {});
      }
    } catch {}

    showToast(`✓ Proveedor actualizado a "${cleanNewSup}" exitosamente.`);
  };

  // Assign or update manual Sales Order (OV) number
  const handleUpdateSalesOrderNumberForContract = (contractId: string, newOV: string) => {
    const cleanOV = newOV.trim().toUpperCase();
    if (!cleanOV) return;

    const updated = contracts.map((c) => {
      if (c.id !== contractId) return c;
      return {
        ...c,
        salesOrderNumber: cleanOV,
        lastUpdatedAt: new Date().toISOString(),
      };
    });

    onUpdateContracts(updated);
    saveStoredOCTrackingContracts(updated);
    saveOCTrackingContractsToFirestore(updated).catch(() => {});
    showToast(`✓ Número de Orden de Venta actualizado a "${cleanOV}".`);
  };

  // Save supplier invoices attachments
  const handleSaveSupplierInvoices = (
    contractId: string,
    supplier: string,
    ocNumber: string,
    invoices: SupplierInvoiceAttachment[]
  ) => {
    if (!isValidOCNumber(ocNumber)) {
      alert(
        '⛔ N° DE OC REQUERIDO:\n\nDebes registrar el número real de Orden de Compra del proveedor antes de adjuntar facturas de proveedor.'
      );
      return;
    }
    const updated = contracts.map((c) => {
      if (c.id !== contractId) return c;

      const updatedItems = c.items.map((it) => {
        const matchSupplier = it.supplier?.trim().toLowerCase() === supplier.trim().toLowerCase();
        const matchOC = !ocNumber || ocNumber === 'Sin N° OC' || it.ocNumber === ocNumber;
        if (matchSupplier && matchOC) {
          return {
            ...it,
            supplierInvoices: invoices,
            lastUpdatedAt: new Date().toISOString(),
          };
        }
        return it;
      });

      // Also persist at contract level with notes matching
      const otherInvoices = (c.supplierInvoices || []).filter(
        (inv) => !(inv.notes?.includes(ocNumber) || inv.notes?.includes(supplier))
      );
      const contractInvoices = [...otherInvoices, ...invoices];

      return {
        ...c,
        items: updatedItems,
        supplierInvoices: contractInvoices,
        lastUpdatedAt: new Date().toISOString(),
      };
    });

    onUpdateContracts(updated);
    saveStoredOCTrackingContracts(updated);
    saveOCTrackingContractsToFirestore(updated).catch(() => {});
    showToast(`✓ Facturas del proveedor ${supplier} guardadas correctamente.`);
  };

  // Save changes from EditOCHeaderModal
  const handleSaveOCHeader = (
    contractId: string,
    updates: Partial<OCTrackingContract>,
    syncToItems: boolean
  ) => {
    const updated = contracts.map((c) => {
      if (c.id !== contractId) return c;

      let updatedItems = c.items;
      if (syncToItems) {
        updatedItems = c.items.map((it) => ({
          ...it,
          supplier: updates.supplier || it.supplier,
          supplierNit: updates.supplierNit || it.supplierNit,
          supplierContact: updates.supplierContact || it.supplierContact,
          ocNumber: updates.ocNumber || it.ocNumber,
          paymentTerms: updates.paymentTerms || it.paymentTerms,
          paymentStatus: updates.paymentStatus || it.paymentStatus,
          status: updates.globalStatus || it.status,
          lastUpdatedAt: new Date().toISOString(),
        }));
      }

      return {
        ...c,
        ...updates,
        items: updatedItems,
        lastUpdatedAt: new Date().toISOString(),
      };
    });

    onUpdateContracts(updated);
    saveStoredOCTrackingContracts(updated);
    const target = updated.find((c) => c.id === contractId);
    if (target) {
      saveSingleOCTrackingContractToFirestore(target).catch(() => {});
    }
    setEditingOCHeaderState(null);
    showToast('✓ Datos de la Orden de Compra y Proveedor actualizados con éxito');
  };

  // Save changes from EditOCItemModal
  const handleSaveItemModal = (updates: Partial<OCTrackingItem>, novedadNote: string) => {
    if (!editingItemState) return;

    const { contractId, item } = editingItemState;
    const finalOCNumber = String(updates.ocNumber || item.ocNumber || '').trim();
    const touchesGatedFields =
      updates.status !== undefined ||
      updates.supplier !== undefined ||
      updates.serialNumbers !== undefined ||
      updates.serialNumber !== undefined ||
      updates.invoiceNumber !== undefined;
    if (touchesGatedFields && !isValidOCNumber(finalOCNumber)) {
      alert(
        '⛔ N° DE OC REQUERIDO:\n\nDebes registrar el número real de Orden de Compra del proveedor antes de modificar estado, proveedor, seriales o facturación de este equipo.'
      );
      return;
    }

    const updated = contracts.map((c) => {
      if (c.id !== contractId) return c;
      return {
        ...c,
        items: c.items.map((it) => {
          if (it.id !== item.id) return it;

          const hasStatusChanged = updates.status && updates.status !== it.status;
          const logEntry =
            hasStatusChanged || novedadNote.trim()
              ? [
                  ...(it.history || []),
                  {
                    id: `log-${Date.now()}`,
                    timestamp: new Date().toISOString(),
                    previousStatus: it.status,
                    newStatus: updates.status || it.status,
                    user: currentUser ? currentUser.name : 'Usuario SYD',
                    note:
                      novedadNote.trim() ||
                      `Actualización general de datos y estado a ${updates.status || it.status}.`,
                  },
                ]
              : it.history;

          return {
            ...it,
            ...updates,
            lastUpdatedAt: new Date().toISOString(),
            history: logEntry || [],
          };
        }),
        totalCostCOP: c.items.reduce(
          (s, it) => (it.id === item.id ? s + (updates.totalCostCOP || it.totalCostCOP) : s + it.totalCostCOP),
          0
        ),
        lastUpdatedAt: new Date().toISOString(),
      };
    });

    onUpdateContracts(updated);
    saveStoredOCTrackingContracts(updated);
    const target = updated.find((c) => c.id === contractId);
    if (target) {
      saveSingleOCTrackingContractToFirestore(target).catch(() => {});
    }

    // Auto-update base cost in Pestaña 3 (Catalog) without requiring user button
    if (onUpdateEquipmentBaseCost && updates.costPriceCOP !== undefined && updates.costPriceCOP > 0) {
      onUpdateEquipmentBaseCost(
        item.equipmentId || updates.name || item.name,
        updates.costPriceCOP,
        updates.brand || item.brand,
        updates.model || item.model
      );
    }

    setEditingItemState(null);
    showToast('✓ Equipo y novedad registrados con éxito (alerta reiniciada)');
  };

  // Delete handlers
  const handleRequestDeleteContract = (contract: OCTrackingContract) => {
    setDeleteConfirmState({
      title: `¿Eliminar Contrato ${contract.contractNumber || contract.clientName}?`,
      subtitle: `Se eliminarán todas las OCs de proveedores y los ${contract.items?.length || 0} equipos asociados a ${contract.clientName}.`,
      onConfirm: async () => {
        const updated = contracts.filter((c) => c.id !== contract.id);
        onUpdateContracts(updated);
        saveStoredOCTrackingContracts(updated);
        try {
          await deleteOCTrackingContractFromFirestore(
            contract.id,
            contract.contractNumber,
            contract.salesOrderNumber,
            contract.tenderClientId
          );
        } catch (e) {
          console.error('Error deleting contract from Firestore:', e);
        }
        setDeleteConfirmState(null);
        showToast(`✓ Contrato ${contract.contractNumber || contract.clientName} eliminado permanentemente`);
      },
    });
  };

  const handleRequestDeleteSupplierOC = (
    contractId: string,
    supplier: string,
    ocNumber: string
  ) => {
    setDeleteConfirmState({
      title: `¿Eliminar OC ${ocNumber} de ${supplier}?`,
      subtitle: 'Se removerán los equipos asociados a esta Orden de Compra.',
      onConfirm: async () => {
        const targetContract = contracts.find((c) => c.id === contractId);
        const remainingItems = (targetContract?.items || []).filter(
          (it) => !(it.supplier === supplier && it.ocNumber === ocNumber)
        );

        let updated: OCTrackingContract[];
        if (remainingItems.length === 0) {
          // If no items remain in this contract, remove the contract entirely
          updated = contracts.filter((c) => c.id !== contractId);
          onUpdateContracts(updated);
          saveStoredOCTrackingContracts(updated);
          try {
            await deleteOCTrackingContractFromFirestore(
              contractId,
              targetContract?.contractNumber,
              targetContract?.salesOrderNumber,
              targetContract?.tenderClientId
            );
          } catch (e) {
            console.error('Error deleting empty contract from Firestore:', e);
          }
        } else {
          updated = contracts.map((c) => {
            if (c.id !== contractId) return c;
            return {
              ...c,
              items: remainingItems,
              totalCostCOP: remainingItems.reduce(
                (s, it) => s + (it.totalCostCOP || ((it.costPriceCOP || 0) * (it.quantity || 1))),
                0
              ),
              lastUpdatedAt: new Date().toISOString(),
            };
          });
          onUpdateContracts(updated);
          saveStoredOCTrackingContracts(updated);
          const target = updated.find((c) => c.id === contractId);
          if (target) {
            try {
              await saveSingleOCTrackingContractToFirestore(target);
            } catch (e) {
              console.error('Error updating contract in Firestore:', e);
            }
          }
        }
        setDeleteConfirmState(null);
        showToast(`✓ Orden de Compra ${ocNumber} eliminada`);
      },
    });
  };

  const handleRequestDeleteItem = (contractId: string, item: OCTrackingItem) => {
    setDeleteConfirmState({
      title: `¿Eliminar ${item.name}?`,
      subtitle: `Se removerá de la OC ${item.ocNumber} (${item.supplier}).`,
      onConfirm: async () => {
        const targetContract = contracts.find((c) => c.id === contractId);
        const remainingItems = (targetContract?.items || []).filter((it) => it.id !== item.id);

        let updated: OCTrackingContract[];
        if (remainingItems.length === 0) {
          updated = contracts.filter((c) => c.id !== contractId);
          onUpdateContracts(updated);
          saveStoredOCTrackingContracts(updated);
          try {
            await deleteOCTrackingContractFromFirestore(
              contractId,
              targetContract?.contractNumber,
              targetContract?.salesOrderNumber,
              targetContract?.tenderClientId
            );
          } catch (e) {
            console.error('Error deleting empty contract from Firestore:', e);
          }
        } else {
          updated = contracts.map((c) => {
            if (c.id !== contractId) return c;
            return {
              ...c,
              items: remainingItems,
              totalCostCOP: remainingItems.reduce(
                (s, it) => s + (it.totalCostCOP || ((it.costPriceCOP || 0) * (it.quantity || 1))),
                0
              ),
              lastUpdatedAt: new Date().toISOString(),
            };
          });
          onUpdateContracts(updated);
          saveStoredOCTrackingContracts(updated);
          const target = updated.find((c) => c.id === contractId);
          if (target) {
            try {
              await saveSingleOCTrackingContractToFirestore(target);
            } catch (e) {
              console.error('Error updating contract in Firestore:', e);
            }
          }
        }
        setDeleteConfirmState(null);
        showToast(`✓ Equipo ${item.name} eliminado de la OC`);
      },
    });
  };

  // Sync from Ventana 4
  const handleSyncAwarded = () => {
    const { updatedContracts, importedCount } = syncAwardedTendersToOCTracking(
      tenderClients,
      equipments,
      contracts
    );
    onUpdateContracts(updatedContracts);
    saveStoredOCTrackingContracts(updatedContracts);
    if (importedCount > 0) {
      showToast(`✓ Sincronizados ${importedCount} nuevos contratos adjudicados`);
    } else {
      showToast('✓ Los contratos ya se encontraban sincronizados');
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    exportOCTrackingToExcel(contracts);
    showToast('✓ Descargando archivo Excel de Seguimiento de OCs');
  };

  return (
    <div className="w-full space-y-5 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#192b45] border border-sky-400 text-white font-bold text-xs sm:text-sm px-4 py-3 rounded-2xl shadow-2xl animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Header, KPIs & Filters */}
      <div className="sticky top-0 z-20 bg-[var(--syd-body-bg,#0b1523)]/95 pt-1 pb-2 backdrop-blur-md">
        <OCTrackingHeader
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          lifecycleTab={lifecycleTab}
          onChangeLifecycleTab={setLifecycleTab}
          activeOCsCount={activeOCsCount}
          archivedOCsCount={archivedOCsCount}
          totalOCsCount={totalOCsCount}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          filterSupplier={filterSupplier}
          onFilterSupplierChange={setFilterSupplier}
          filterPaymentTerms={filterPaymentTerms}
          onFilterPaymentTermsChange={setFilterPaymentTerms}
          filterPaymentStatus={filterPaymentStatus}
          onFilterPaymentStatusChange={setFilterPaymentStatus}
          filterStatus={filterStatus}
          onFilterStatusChange={setFilterStatus}
          filterAlertOnly={filterAlertOnly}
          onFilterAlertOnlyChange={setFilterAlertOnly}
          distinctSuppliers={distinctSuppliers}
          kpis={kpis}
          isReadOnly={isReadOnly}
          onOpenNewOCModal={() => {
            setTargetContractForNewOC(null);
            setIsNewOCModalOpen(true);
          }}
          onOpenSuppliersModal={() => setIsSuppliersModalOpen(true)}
          onExportExcel={handleExportExcel}
          onSyncAwarded={handleSyncAwarded}
        />
      </div>

      {/* Primary View: Hierarchical (Client Contract -> Supplier OCs -> Equipments) */}
      {viewMode === 'hierarchy' && (
        <ContractHierarchyView
          contracts={filteredContractsForHierarchy}
          lifecycleTab={lifecycleTab}
          salesOrders={salesOrders && salesOrders.length > 0 ? salesOrders : getStoredSalesOrders()}
          expandedContractIds={expandedContractIds}
          onToggleContractCollapse={handleToggleContractCollapse}
          onOpenAddSupplierOCModal={(contract) => {
            setTargetContractForNewOC(contract);
            setIsNewOCModalOpen(true);
          }}
          onOpenAddItemsToOC={(contractId, ocNumber, supplier) => {
            setAddItemsToOCState({ contractId, ocNumber, supplier });
          }}
          onOpenEditOCHeader={(contract) => setEditingOCHeaderState(contract)}
          onOpenEditItem={(contractId, item) => setEditingItemState({ contractId, item })}
          onOpenSerialsModal={(contract, item) => setSerialsModalState({ contract, item })}
          onOpenHistory={(contractName, item) => setHistoryModalItem({ contractName, item })}
          onQuickChangeItemStatus={handleQuickChangeItemStatus}
          onBatchChangeItemStatus={handleBatchChangeItemStatus}
          onQuickChangeItemPaymentTerms={handleQuickChangeItemPaymentTerms}
          onQuickChangeItemPaymentStatus={handleQuickChangeItemPaymentStatus}
          onRequestDeleteContract={handleRequestDeleteContract}
          onRequestDeleteItem={handleRequestDeleteItem}
          onRequestDeleteSupplierOC={handleRequestDeleteSupplierOC}
          onUpdateOCNumber={handleUpdateOCNumberForSupplier}
          onUpdateOCSupplier={handleUpdateOCSupplier}
          onUpdateSalesOrderNumber={handleUpdateSalesOrderNumberForContract}
          onSaveSupplierInvoices={handleSaveSupplierInvoices}
          onNavigateToTab={onNavigateToTab}
          currentUser={currentUser}
          onOpenSplitOrderModal={(preselectedItemIds, sourceOrder) => {
            setSplitModalState({
              isOpen: true,
              sourceOrder: sourceOrder || null,
              preselectedItemIds,
            });
          }}
        />
      )}

      {/* View: By Supplier / Manufacturer */}
      {viewMode === 'supplier' && (
        <SupplierGroupedView
          supplierGroups={groupedBySupplier}
          onOpenAddItemsToOC={(contractId, ocNumber, supplier) => {
            setAddItemsToOCState({ contractId, ocNumber, supplier });
          }}
          onOpenEditItem={(contractId, item) => setEditingItemState({ contractId, item })}
          onOpenSerialsModal={(contractId, item) => {
            const found = contracts.find((c) => c.id === contractId);
            if (found) {
              setSerialsModalState({ contract: found, item });
            }
          }}
          onOpenHistory={(contractName, item) => setHistoryModalItem({ contractName, item })}
          onQuickChangeItemStatus={handleQuickChangeItemStatus}
          onQuickChangeItemPaymentTerms={handleQuickChangeItemPaymentTerms}
          onRequestDeleteItem={handleRequestDeleteItem}
          onUpdateOCNumber={handleUpdateOCNumberForSupplier}
          onSaveSupplierInvoices={handleSaveSupplierInvoices}
          currentUser={currentUser}
        />
      )}

      {/* View: Consolidated Master Table */}
      {viewMode === 'table' && (
        <MasterTableView
          flatItems={flatItemRows}
          onOpenEditItem={(contractId, item) => setEditingItemState({ contractId, item })}
          onOpenSerialsModal={(contractId, item) => {
            const found = contracts.find((c) => c.id === contractId);
            if (found) {
              setSerialsModalState({ contract: found, item });
            }
          }}
          onOpenSupplierInvoices={(contractId, supplier, ocNumber, invoices) => {
            const found = contracts.find((c) => c.id === contractId);
            setSupplierInvoicesModalTarget({
              contractId,
              contractName: found?.contractNumber || found?.clientName,
              supplier,
              ocNumber,
              invoices,
            });
          }}
          onOpenHistory={(contractName, item) => setHistoryModalItem({ contractName, item })}
          onQuickChangeItemStatus={handleQuickChangeItemStatus}
          onQuickChangeItemPaymentTerms={handleQuickChangeItemPaymentTerms}
          onRequestDeleteItem={handleRequestDeleteItem}
          currentUser={currentUser}
        />
      )}

      {/* MODAL: ITEM SERIALS & HOSPITAL DOSSIER */}
      {serialsModalState && (
        <ItemSerialsDossierModal
          isOpen={true}
          contract={serialsModalState.contract}
          item={serialsModalState.item}
          equipments={equipments}
          allDocuments={allDocuments}
          onClose={() => setSerialsModalState(null)}
          onSaveSerials={(contractId, itemId, serials) => {
            const updated = contracts.map((c) => {
              if (c.id !== contractId) return c;
              const updatedItems = c.items.map((it) => {
                if (it.id !== itemId) return it;
                return {
                  ...it,
                  serialNumbers: serials,
                  lastUpdatedAt: new Date().toISOString(),
                };
              });
              return {
                ...c,
                items: updatedItems,
                lastUpdatedAt: new Date().toISOString(),
              };
            });

            onUpdateContracts(updated);
            saveStoredOCTrackingContracts(updated);
            saveOCTrackingContractsToFirestore(updated).catch(() => {});
            setSerialsModalState(null);
            showToast(`✓ Seriales y expediente hospitalario guardados correctamente`);
          }}
        />
      )}

      {/* MODAL: NEW SUPPLIER OC (CAN ATTACH TO EXISTING CONTRACT OR CREATE NEW) */}
      {isNewOCModalOpen && (
        <NewSupplierOCModal
          existingContracts={contracts}
          preselectedContractId={targetContractForNewOC?.id}
          equipments={equipments}
          distinctSuppliers={distinctSuppliers}
          currentUser={currentUser}
          onClose={() => {
            setIsNewOCModalOpen(false);
            setTargetContractForNewOC(null);
          }}
          onSave={async (newOrUpdatedContract) => {
            unmarkContractAsDeleted(
              newOrUpdatedContract.id,
              newOrUpdatedContract.contractNumber,
              newOrUpdatedContract.salesOrderNumber,
              newOrUpdatedContract.tenderClientId
            );
            let updated: OCTrackingContract[];
            const exists = contracts.some((c) => c.id === newOrUpdatedContract.id);
            if (exists) {
              updated = contracts.map((c) =>
                c.id === newOrUpdatedContract.id ? newOrUpdatedContract : c
              );
            } else {
              updated = [newOrUpdatedContract, ...contracts];
            }

            onUpdateContracts(updated);
            saveStoredOCTrackingContracts(updated);
            try {
              await saveSingleOCTrackingContractToFirestore(newOrUpdatedContract);
            } catch (e) {
              console.error('Error saving OC contract to Firestore:', e);
            }

            // Auto-update base cost in Pestaña 3 (Catalog)
            if (onUpdateEquipmentBaseCost && newOrUpdatedContract.items) {
              newOrUpdatedContract.items.forEach((it) => {
                if (it.costPriceCOP && it.costPriceCOP > 0) {
                  onUpdateEquipmentBaseCost(
                    it.equipmentId || it.name,
                    it.costPriceCOP,
                    it.brand,
                    it.model
                  );
                }
              });
            }

            setIsNewOCModalOpen(false);
            setTargetContractForNewOC(null);
            showToast(`✓ Orden de Compra registrada con éxito`);
          }}
        />
      )}

      {/* MODAL: EDIT OC HEADER & SUPPLIER */}
      {editingOCHeaderState && (
        <EditOCHeaderModal
          contract={editingOCHeaderState}
          distinctSuppliers={distinctSuppliers}
          currentUser={currentUser}
          onClose={() => setEditingOCHeaderState(null)}
          onSave={handleSaveOCHeader}
        />
      )}

      {/* MODAL: ADD EQUIPMENTS TO EXISTING OC */}
      {addItemsToOCState && (
        <AddItemsToOCModal
          contractId={addItemsToOCState.contractId}
          ocNumber={addItemsToOCState.ocNumber}
          supplier={addItemsToOCState.supplier}
          equipments={equipments}
          currentUser={currentUser}
          onClose={() => setAddItemsToOCState(null)}
          onSave={async (newItems) => {
            const updated = contracts.map((c) => {
              if (c.id !== addItemsToOCState.contractId) return c;
              const merged = [...c.items, ...newItems];
              return {
                ...c,
                items: merged,
                totalCostCOP: merged.reduce((s, it) => s + it.totalCostCOP, 0),
                lastUpdatedAt: new Date().toISOString(),
              };
            });
            onUpdateContracts(updated);
            saveStoredOCTrackingContracts(updated);
            const target = updated.find((c) => c.id === addItemsToOCState.contractId);
            if (target) {
              try {
                await saveSingleOCTrackingContractToFirestore(target);
              } catch (e) {
                console.error('Error saving items to OC contract in Firestore:', e);
              }
            }

            // Auto-update base cost in Pestaña 3 (Catalog)
            if (onUpdateEquipmentBaseCost && newItems) {
              newItems.forEach((it) => {
                if (it.costPriceCOP && it.costPriceCOP > 0) {
                  onUpdateEquipmentBaseCost(
                    it.equipmentId || it.name,
                    it.costPriceCOP,
                    it.brand,
                    it.model
                  );
                }
              });
            }

            setAddItemsToOCState(null);
            showToast(`✓ Se agregaron ${newItems.length} equipos a la OC ${addItemsToOCState.ocNumber}`);
          }}
        />
      )}

      {/* MODAL: EDIT OC ITEM & NOVEDAD */}
      {editingItemState && (
        <EditOCItemModal
          contractId={editingItemState.contractId}
          item={editingItemState.item}
          distinctSuppliers={distinctSuppliers}
          onClose={() => setEditingItemState(null)}
          onSave={handleSaveItemModal}
        />
      )}

      {/* MODAL: TIMELINE & AUDIT LOGS */}
      {historyModalItem && (
        <OCHistoryModal
          contractName={historyModalItem.contractName}
          item={historyModalItem.item}
          onClose={() => setHistoryModalItem(null)}
        />
      )}

      {/* MODAL: SUPPLIERS DIRECTORY & MANAGEMENT */}
      {isSuppliersModalOpen && (
        <ManageSuppliersModal
          contracts={contracts}
          equipments={equipments}
          currentUser={currentUser}
          onClose={() => setIsSuppliersModalOpen(false)}
          onUpdateContracts={(updated) => {
            onUpdateContracts(updated);
            saveStoredOCTrackingContracts(updated);
            showToast(`✓ Datos del proveedor y contratos sincronizados con éxito`);
          }}
        />
      )}

      {/* MODAL: SUPPLIER INVOICES ATTACHMENT */}
      {supplierInvoicesModalTarget && (
        <SupplierInvoicesModal
          isOpen={true}
          onClose={() => setSupplierInvoicesModalTarget(null)}
          supplier={supplierInvoicesModalTarget.supplier}
          ocNumber={supplierInvoicesModalTarget.ocNumber}
          contractNumber={supplierInvoicesModalTarget.contractName}
          invoices={supplierInvoicesModalTarget.invoices}
          isReadOnly={isReadOnly}
          onSaveInvoices={(updatedInvoices) => {
            handleSaveSupplierInvoices(
              supplierInvoicesModalTarget.contractId,
              supplierInvoicesModalTarget.supplier,
              supplierInvoicesModalTarget.ocNumber,
              updatedInvoices
            );
            setSupplierInvoicesModalTarget(null);
          }}
        />
      )}

      {/* MODAL: SPLIT SALES ORDER / MOVE DELAYED EQUIPMENTS TO NEW OV & OC */}
      {splitModalState.isOpen && (
        <SplitSalesOrderModal
          isOpen={true}
          onClose={() => setSplitModalState({ isOpen: false })}
          sourceOrder={splitModalState.sourceOrder}
          allOrders={effectiveSalesOrders}
          contracts={contracts}
          preselectedItemIds={splitModalState.preselectedItemIds}
          onConfirmSplit={(params) => {
            const currentSOs = effectiveSalesOrders;
            const { updatedOrders, updatedContracts } = splitSalesOrderRecord(
              params,
              currentSOs,
              contracts
            );

            saveStoredSalesOrders(updatedOrders);
            if (onUpdateSalesOrders) {
              onUpdateSalesOrders(updatedOrders);
            }

            onUpdateContracts(updatedContracts);
            saveStoredOCTrackingContracts(updatedContracts);
            saveOCTrackingContractsToFirestore(updatedContracts).catch(() => {});

            setSplitModalState({ isOpen: false });
            showToast(`✓ Se trasladaron equipos a la Nueva OV ${params.newSalesOrderNumber}${params.newSupplierOCNumber ? ` (OC ${params.newSupplierOCNumber})` : ''} exitosamente`);
          }}
        />
      )}

      {deleteConfirmState && (
        <div
          className="fixed inset-0 z-50 bg-black/25 flex items-center justify-center p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteConfirmState(null);
          }}
        >
          <div className="bg-[#192b45] border border-rose-500/50 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black text-white">{deleteConfirmState.title}</h3>
                <p className="text-xs text-slate-300 mt-1">{deleteConfirmState.subtitle}</p>
                <p className="text-[11px] text-rose-300 font-bold mt-2">
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#334d6e]">
              <button
                type="button"
                onClick={() => setDeleteConfirmState(null)}
                className="px-4 py-2 rounded-xl text-slate-300 hover:bg-[#15253d] transition font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={deleteConfirmState.onConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition shadow-md cursor-pointer"
              >
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default OCTrackingView;
