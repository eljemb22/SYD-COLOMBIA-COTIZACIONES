import React, { useState, useMemo, useEffect } from 'react';
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
} from '../../types';
import {
  getStoredOCTrackingContracts,
  saveStoredOCTrackingContracts,
  syncAwardedTendersToOCTracking,
  COMMON_SUPPLIERS,
  exportOCTrackingToExcel,
} from '../../utils/ocTrackingStorage';
import { deleteOCTrackingContractFromFirestore } from '../../services/realtimeSync';

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
import { Trash2 } from 'lucide-react';

interface OCTrackingViewProps {
  contracts: OCTrackingContract[];
  onUpdateContracts: (updated: OCTrackingContract[]) => void;
  tenderClients?: TenderClientProject[];
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

  // Collapse state for contracts in hierarchical view
  const [collapsedContractIds, setCollapsedContractIds] = useState<Set<string>>(new Set());

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

  // Distinct suppliers collected across all contracts
  const distinctSuppliers = useMemo(() => {
    const set = new Set<string>();
    contracts.forEach((c) => {
      if (c.supplier) set.add(c.supplier);
      c.items.forEach((it) => {
        if (it.supplier) set.add(it.supplier);
      });
    });
    return Array.from(set).sort();
  }, [contracts]);

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

    contracts.forEach((c) => {
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
          it.status === 'Cerrado / Concluido' ||
          it.status === 'Pagado al Proveedor';
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
      totalContracts: contracts.length,
      totalOCs: ocStatusMap.size || contracts.length,
      totalItems,
      totalCostCOP,
      totalCreditOrders,
      totalAlerts,
    };
  }, [contracts]);

  // Filtered Contracts (Hierarchical)
  const filteredContracts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    return contracts
      .map((contract) => {
        const matchesContractText =
          !term ||
          contract.contractNumber.toLowerCase().includes(term) ||
          contract.clientName.toLowerCase().includes(term) ||
          contract.nit.toLowerCase().includes(term) ||
          (contract.supplier && contract.supplier.toLowerCase().includes(term)) ||
          (contract.ocNumber && contract.ocNumber.toLowerCase().includes(term));

        const filteredItems = contract.items.filter((item) => {
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
        if (matchesContractText && contract.items.length === 0 && !filterAlertOnly) {
          return contract;
        }

        if (filteredItems.length === 0 && !matchesContractText) {
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
    setCollapsedContractIds((prev) => {
      const next = new Set(prev);
      if (next.has(contractId)) {
        next.delete(contractId);
      } else {
        next.add(contractId);
      }
      return next;
    });
  };

  // Quick changes on item status / payment terms
  const handleQuickChangeItemStatus = (contractId: string, itemId: string, newStatus: OCStatus) => {
    const updated = contracts.map((c) => {
      if (c.id !== contractId) return c;
      return {
        ...c,
        items: c.items.map((it) => {
          if (it.id !== itemId) return it;
          return {
            ...it,
            status: newStatus,
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
        }),
        lastUpdatedAt: new Date().toISOString(),
      };
    });

    onUpdateContracts(updated);
    saveStoredOCTrackingContracts(updated);
    showToast(`✓ Estado actualizado a "${newStatus}"`);
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
    setEditingOCHeaderState(null);
    showToast('✓ Datos de la Orden de Compra y Proveedor actualizados con éxito');
  };

  // Save changes from EditOCItemModal
  const handleSaveItemModal = (updates: Partial<OCTrackingItem>, novedadNote: string) => {
    if (!editingItemState) return;

    const { contractId, item } = editingItemState;
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
      title: `¿Eliminar Contrato ${contract.contractNumber}?`,
      subtitle: `Se eliminarán todas las OCs de proveedores y los ${contract.items.length} equipos asociados a ${contract.clientName}.`,
      onConfirm: () => {
        const updated = contracts.filter((c) => c.id !== contract.id);
        onUpdateContracts(updated);
        saveStoredOCTrackingContracts(updated);
        deleteOCTrackingContractFromFirestore(contract.id).catch(() => {});
        setDeleteConfirmState(null);
        showToast(`✓ Contrato ${contract.contractNumber} eliminado`);
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
      onConfirm: () => {
        const updated = contracts.map((c) => {
          if (c.id !== contractId) return c;
          const remainingItems = c.items.filter(
            (it) => !(it.supplier === supplier && it.ocNumber === ocNumber)
          );
          return {
            ...c,
            items: remainingItems,
            totalCostCOP: remainingItems.reduce((s, it) => s + it.totalCostCOP, 0),
            lastUpdatedAt: new Date().toISOString(),
          };
        });
        onUpdateContracts(updated);
        saveStoredOCTrackingContracts(updated);
        setDeleteConfirmState(null);
        showToast(`✓ Orden de Compra ${ocNumber} eliminada`);
      },
    });
  };

  const handleRequestDeleteItem = (contractId: string, item: OCTrackingItem) => {
    setDeleteConfirmState({
      title: `¿Eliminar ${item.name}?`,
      subtitle: `Se removerá de la OC ${item.ocNumber} (${item.supplier}).`,
      onConfirm: () => {
        const updated = contracts.map((c) => {
          if (c.id !== contractId) return c;
          const remainingItems = c.items.filter((it) => it.id !== item.id);
          return {
            ...c,
            items: remainingItems,
            totalCostCOP: remainingItems.reduce((s, it) => s + it.totalCostCOP, 0),
            lastUpdatedAt: new Date().toISOString(),
          };
        });
        onUpdateContracts(updated);
        saveStoredOCTrackingContracts(updated);
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
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#192b45] border border-sky-400 text-white font-bold text-xs sm:text-sm px-4 py-3 rounded-2xl shadow-2xl animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Header, KPIs & Filters */}
      <OCTrackingHeader
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
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

      {/* Primary View: Hierarchical (Client Contract -> Supplier OCs -> Equipments) */}
      {viewMode === 'hierarchy' && (
        <ContractHierarchyView
          contracts={filteredContracts}
          collapsedContractIds={collapsedContractIds}
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
          onQuickChangeItemPaymentTerms={handleQuickChangeItemPaymentTerms}
          onQuickChangeItemPaymentStatus={handleQuickChangeItemPaymentStatus}
          onRequestDeleteContract={handleRequestDeleteContract}
          onRequestDeleteItem={handleRequestDeleteItem}
          onRequestDeleteSupplierOC={handleRequestDeleteSupplierOC}
          onNavigateToTab={onNavigateToTab}
          currentUser={currentUser}
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
          onSave={(newOrUpdatedContract) => {
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
          onSave={(newItems) => {
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

      {/* IN-APP CONFIRMATION MODAL */}
      {deleteConfirmState && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-fadeIn">
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
