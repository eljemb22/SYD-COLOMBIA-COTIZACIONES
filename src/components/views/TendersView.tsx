import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FileSpreadsheet,
  FileDown,
  Plus,
  Trash2,
  Building2,
  FileText,
  Edit3,
  Search,
  Check,
  Award,
  Layers,
  Sliders,
  Sparkles,
  ChevronRight,
  AlertTriangle,
  X,
  PlusCircle,
  HelpCircle,
  Pencil,
  LayoutGrid,
  List,
  LayoutList,
  ReceiptText,
  PackageCheck,
  Eye,
  Link2,
  Link2Off,
  RotateCcw,
  ShoppingCart,
  CheckCircle2,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  TenderClientProject,
  TenderItem,
  TechnicalRequirement,
  MedicalEquipment,
  AuthUser,
  TenderHeader,
  SavedQuote,
  OCTrackingContract,
  SalesOrderRecord,
  SalesInvoiceRecord,
} from '../../types';
import { downloadTenderEquipmentTemplate } from '../../utils/excelImportUtils';
import { createTenderProjectFromQuote, getStoredSalesOrders, getStoredSalesInvoices } from '../../utils/salesOrdersStorage';
import { getStoredOCTrackingContracts } from '../../utils/ocTrackingStorage';
import { formatCOP } from '../../utils/formatters';
import { isTenderProjectDirectOC, formatTenderProcessNumber } from '../../utils/tenderDeduplication';
import {
  ExcelColumnConfig,
  ExcelColumnHeader,
  useExcelTableFilters,
} from '../common/ExcelTableFilter';
import { TenderAwardedView } from '../tenders/TenderAwardedView';

const TENDER_CLIENT_COLUMNS: ExcelColumnConfig<TenderClientProject>[] = [
  {
    id: 'processNumber',
    label: 'N° Proceso / Tipo',
    type: 'text',
    accessor: (row) => `${formatTenderProcessNumber(row)} ${isTenderProjectDirectOC(row) ? 'OC Directa' : (row.header?.processType || '')}`.trim(),
    minWidth: '150px',
  },
  {
    id: 'client',
    label: 'Entidad / Cliente',
    type: 'text',
    accessor: (row) => `${row.clientName || ''} ${row.header?.nit || ''}`.trim(),
    minWidth: '180px',
  },
  {
    id: 'city',
    label: 'Ciudad',
    type: 'text',
    accessor: (row) => row.header?.city || 'No especificada',
    minWidth: '110px',
  },
  {
    id: 'budget',
    label: 'Presupuesto',
    type: 'number',
    accessor: (row) => Number(row.header?.budgetCOP) || 0,
    formatter: (val) => formatCOP(Number(val) || 0),
    align: 'right',
    minWidth: '130px',
  },
  {
    id: 'equipments',
    label: 'Equipos',
    type: 'number',
    accessor: (row) => row.items?.length || 0,
    formatter: (val) => `${val} equipos`,
    align: 'center',
    minWidth: '100px',
  },
  {
    id: 'executionTerm',
    label: 'Plazo',
    type: 'text',
    accessor: (row) => row.header?.executionTerm || 'No especificado',
    minWidth: '110px',
  },
  {
    id: 'status',
    label: 'Estado',
    type: 'text',
    accessor: (row) => row.status || 'En Preparación',
    align: 'center',
    minWidth: '120px',
  },
];
import { TenderSpecificationsView } from '../tenders/TenderSpecificationsView';
import { TenderExcelImportModal } from '../tenders/TenderExcelImportModal';
import { TenderManualItemModal } from '../tenders/TenderManualItemModal';
import { TenderClientModal } from '../tenders/TenderClientModal';
import { TenderLinkQuoteModal } from '../tenders/TenderLinkQuoteModal';

interface TendersViewProps {
  tenderClients: TenderClientProject[];
  equipments: MedicalEquipment[];
  currentUser: AuthUser | null;
  activeClientId?: string | null;
  savedQuotes?: SavedQuote[];
  onSelectClient?: (clientId: string) => void;
  onCreateClient?: (clientData: {
    clientName: string;
    nit?: string;
    processNumber?: string;
    budgetCOP?: number;
    city?: string;
    processType?: string;
    contractObject?: string;
    contactPerson?: string;
    status?: TenderClientProject['status'];
    openingDate?: string;
    closingDate?: string;
    executionTerm?: string;
    header?: Partial<TenderHeader>;
  }) => void;
  onCreateTenderClient?: (clientData: {
    clientName: string;
    nit?: string;
    processNumber?: string;
    budgetCOP?: number;
    city?: string;
    processType?: string;
    contractObject?: string;
    contactPerson?: string;
    status?: TenderClientProject['status'];
    openingDate?: string;
    closingDate?: string;
    executionTerm?: string;
    header?: Partial<TenderHeader>;
  }) => void;
  onBatchCreateClients?: (newClients: TenderClientProject[]) => void;
  onUpdateClient?: (clientId: string, updates: Partial<TenderClientProject>) => void;
  onUpdateTenderClient?: (clientId: string, updates: Partial<TenderClientProject>) => void;
  onDeleteClient?: (clientId: string) => void;
  onDeleteTenderClient?: (clientId: string) => void;
  onAddItemToClient?: (clientId: string, equipment: MedicalEquipment) => void;
  onUpdateTenderItem?: (clientId: string, itemId: string, updates: Partial<TenderItem>) => void;
  onDeleteTenderItem?: (clientId: string, itemId: string) => void;
  onAddRequirement?: (clientId: string, itemId: string, requirement: TechnicalRequirement) => void;
  onUpdateRequirement?: (
    clientId: string,
    itemId: string,
    requirementId: string,
    updates: Partial<TechnicalRequirement>
  ) => void;
  onDeleteRequirement?: (clientId: string, itemId: string, requirementId: string) => void;
  onNavigateToOCTracking?: () => void;
  onSyncTenderItemToCatalog?: (item: TenderItem, createNewDuplicate?: boolean) => void;
  onBatchSyncTenderItemsToCatalog?: (items: TenderItem[]) => void;
  contracts?: OCTrackingContract[];
  salesOrders?: SalesOrderRecord[];
  salesInvoices?: SalesInvoiceRecord[];
  onCreateSalesOrder?: (tender: TenderClientProject) => void;
}

export const TendersView: React.FC<TendersViewProps> = ({
  tenderClients,
  equipments,
  currentUser,
  activeClientId: controlledActiveClientId,
  savedQuotes = [],
  onSelectClient,
  onCreateClient,
  onCreateTenderClient,
  onBatchCreateClients,
  onUpdateClient,
  onUpdateTenderClient,
  onDeleteClient,
  onDeleteTenderClient,
  onAddItemToClient,
  onUpdateTenderItem,
  onDeleteTenderItem,
  onAddRequirement,
  onUpdateRequirement,
  onDeleteRequirement,
  onNavigateToOCTracking,
  onSyncTenderItemToCatalog,
  onBatchSyncTenderItemsToCatalog,
  contracts = [],
  salesOrders = [],
  salesInvoices = [],
  onCreateSalesOrder,
}) => {
  const effectiveContracts = useMemo(() => {
    return contracts && contracts.length > 0 ? contracts : getStoredOCTrackingContracts();
  }, [contracts]);

  const effectiveOrders = useMemo(() => {
    return salesOrders && salesOrders.length > 0 ? salesOrders : getStoredSalesOrders();
  }, [salesOrders]);

  const effectiveInvoices = useMemo(() => {
    return salesInvoices && salesInvoices.length > 0 ? salesInvoices : getStoredSalesInvoices();
  }, [salesInvoices]);
  const handleCreateClientFn = onCreateTenderClient || onCreateClient;
  const handleUpdateClientFn = onUpdateTenderClient || onUpdateClient;
  const handleDeleteClientFn = onDeleteTenderClient || onDeleteClient;

  const handleUpdateClient = (clientId: string, updates: Partial<TenderClientProject>) => {
    if (handleUpdateClientFn) {
      handleUpdateClientFn(clientId, updates);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (handleDeleteClientFn) {
      await handleDeleteClientFn(clientId);
    }
  };

  const handleUpdateTenderItemFn = onUpdateTenderItem || ((clientId: string, itemId: string, updates: Partial<TenderItem>) => {
    const target = tenderClients.find((c) => c.id === clientId);
    if (!target) return;
    const updatedItems = (target.items || []).map((it) => (it.id === itemId ? { ...it, ...updates } : it));
    handleUpdateClient(clientId, { items: updatedItems });
  });

  const handleDeleteTenderItemFn = onDeleteTenderItem || ((clientId: string, itemId: string) => {
    const target = tenderClients.find((c) => c.id === clientId);
    if (!target) return;
    const updatedItems = (target.items || []).filter((it) => it.id !== itemId);
    handleUpdateClient(clientId, { items: updatedItems });
  });

  const handleAddRequirementFn = onAddRequirement || ((clientId: string, itemId: string, requirement: TechnicalRequirement) => {
    const target = tenderClients.find((c) => c.id === clientId);
    if (!target) return;
    const updatedItems = (target.items || []).map((it) => {
      if (it.id !== itemId) return it;
      return { ...it, requirements: [...(it.requirements || []), requirement] };
    });
    handleUpdateClient(clientId, { items: updatedItems });
  });

  const handleUpdateRequirementFn = onUpdateRequirement || ((clientId: string, itemId: string, requirementId: string, updates: Partial<TechnicalRequirement>) => {
    const target = tenderClients.find((c) => c.id === clientId);
    if (!target) return;
    const updatedItems = (target.items || []).map((it) => {
      if (it.id !== itemId) return it;
      return {
        ...it,
        requirements: (it.requirements || []).map((r) => (r.id === requirementId ? { ...r, ...updates } : r)),
      };
    });
    handleUpdateClient(clientId, { items: updatedItems });
  });

  const handleDeleteRequirementFn = onDeleteRequirement || ((clientId: string, itemId: string, requirementId: string) => {
    const target = tenderClients.find((c) => c.id === clientId);
    if (!target) return;
    const updatedItems = (target.items || []).map((it) => {
      if (it.id !== itemId) return it;
      return {
        ...it,
        requirements: (it.requirements || []).filter((r) => r.id !== requirementId),
      };
    });
    handleUpdateClient(clientId, { items: updatedItems });
  });
  // Client selection state
  const [internalActiveClientId, setInternalActiveClientId] = useState<string | null>(null);
  const activeClientId = controlledActiveClientId !== undefined ? controlledActiveClientId : internalActiveClientId;

  // Tender window filter: 'activas' (default) vs 'terminadas' (cumplidas/archivadas)
  const [tenderStatusFilter, setTenderStatusFilter] = useState<'activas' | 'terminadas'>('activas');

  // View layout: 'workspace' (split panel) or 'list' (full width master table)
  const [tendersViewLayout, setTendersViewLayout] = useState<'workspace' | 'list'>('workspace');

  // Connected sub-tab in the main window: 'adjudicadas' | 'especificaciones'
  const [activeSubTab, setActiveSubTab] = useState<'adjudicadas' | 'especificaciones'>('adjudicadas');
  const [selectedEquipmentIdForSpecs, setSelectedEquipmentIdForSpecs] = useState<string | null>(null);

  // Search in client list
  const [clientSearchQuery, setClientSearchQuery] = useState('');

  // Modals state
  const [isExcelImportModalOpen, setIsExcelImportModalOpen] = useState(false);
  const [excelImportInitialTab, setExcelImportInitialTab] = useState<'equipments' | 'contracts'>('equipments');
  const [isManualItemModalOpen, setIsManualItemModalOpen] = useState(false);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientModalMode, setClientModalMode] = useState<'tender' | 'direct_oc'>('tender');
  const [isLinkQuoteModalOpen, setIsLinkQuoteModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<TenderClientProject | null>(null);
  const [clientToDelete, setClientToDelete] = useState<TenderClientProject | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Handle ESC key press to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (clientToDelete) {
          setClientToDelete(null);
        } else if (isCatalogModalOpen) {
          setIsCatalogModalOpen(false);
          setCatalogSearchQuery('');
        } else if (isClientModalOpen) {
          setIsClientModalOpen(false);
          setClientToEdit(null);
        } else if (isLinkQuoteModalOpen) {
          setIsLinkQuoteModalOpen(false);
        } else if (isExcelImportModalOpen) {
          setIsExcelImportModalOpen(false);
        } else if (isManualItemModalOpen) {
          setIsManualItemModalOpen(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clientToDelete, isCatalogModalOpen, isClientModalOpen, isLinkQuoteModalOpen, isExcelImportModalOpen, isManualItemModalOpen]);

  // Helper to determine if a tender is terminated/completed
  const isCompletedTender = (c: TenderClientProject) => {
    const s = (c.status || '').toLowerCase().trim();
    return s.includes('cumplido') || s.includes('archivado') || s.includes('terminad') || s.includes('finaliz');
  };

  // Computed counts for Active vs Terminated tenders
  const activeCount = useMemo(
    () => tenderClients.filter((c) => !isCompletedTender(c)).length,
    [tenderClients]
  );
  const completedCount = useMemo(
    () => tenderClients.filter((c) => isCompletedTender(c)).length,
    [tenderClients]
  );

  // Base clients from search query filtered strictly by active vs terminadas window
  const baseClients = useMemo(() => {
    return tenderClients.filter((c) => {
      const isCompleted = isCompletedTender(c);
      if (tenderStatusFilter === 'activas' && isCompleted) return false;
      if (tenderStatusFilter === 'terminadas' && !isCompleted) return false;

      if (clientSearchQuery.trim()) {
        const q = clientSearchQuery.toLowerCase().trim();
        const matchesMain =
          c.clientName.toLowerCase().includes(q) ||
          (c.header.processNumber && c.header.processNumber.toLowerCase().includes(q)) ||
          (c.header.city && c.header.city.toLowerCase().includes(q)) ||
          (c.header.executionTerm && c.header.executionTerm.toLowerCase().includes(q)) ||
          (c.header.nit && c.header.nit.toLowerCase().includes(q));
        if (!matchesMain) return false;
      }
      return true;
    });
  }, [tenderClients, tenderStatusFilter, clientSearchQuery]);

  const activeClient = useMemo(() => {
    if (baseClients.length === 0) return null;
    if (activeClientId) {
      const found = baseClients.find((c) => c.id === activeClientId);
      if (found) return found;
    }
    return baseClients[0] || null;
  }, [baseClients, activeClientId]);

  // Sync active client selection strictly within the filtered baseClients window
  useEffect(() => {
    if (baseClients.length > 0) {
      if (!activeClientId || !baseClients.find((c) => c.id === activeClientId)) {
        const firstId = baseClients[0].id;
        if (activeClientId !== firstId) {
          if (onSelectClient) onSelectClient(firstId);
          else setInternalActiveClientId(firstId);
        }
      }
    } else {
      if (activeClientId) {
        if (onSelectClient) onSelectClient('');
        else setInternalActiveClientId(null);
      }
    }
  }, [baseClients, activeClientId, onSelectClient]);

  // Auto-heal activeClient if it has 0 items but is linked to a quote
  useEffect(() => {
    if (activeClient && (!activeClient.items || activeClient.items.length === 0)) {
      const qNum = activeClient.linkedQuoteNumber || activeClient.header?.linkedQuoteNumber;
      const qId = activeClient.linkedQuoteId || activeClient.header?.linkedQuoteId;
      if (qNum || qId) {
        const matchedQuote = (savedQuotes || []).find(
          (q) => (qNum && q.quoteNumber === qNum) || (qId && q.id === qId)
        );
        if (matchedQuote && matchedQuote.items && matchedQuote.items.length > 0) {
          const generated = createTenderProjectFromQuote(matchedQuote, tenderClients, equipments);
          if (generated.items && generated.items.length > 0) {
            handleUpdateClient(activeClient.id, {
              items: generated.items,
            });
          }
        }
      }
    }
  }, [activeClient, savedQuotes, equipments, tenderClients, handleUpdateClientFn]);

  const handleSelectClient = (clientId: string) => {
    if (onSelectClient) onSelectClient(clientId);
    else setInternalActiveClientId(clientId);
    setSelectedEquipmentIdForSpecs(null);
  };

  // Create Tender from Saved Quote
  const handleCreateTenderFromQuote = (quote: SavedQuote) => {
    const existing = tenderClients.find(
      (t) =>
        (quote.id && (t.linkedQuoteId === quote.id || t.header?.linkedQuoteId === quote.id)) ||
        (quote.quoteNumber && (t.linkedQuoteNumber === quote.quoteNumber || t.header?.linkedQuoteNumber === quote.quoteNumber))
    );

    if (existing) {
      if (onSelectClient) onSelectClient(existing.id);
      else setInternalActiveClientId(existing.id);
      showToast(`✓ Proceso ya existente seleccionado para la cotización ${quote.quoteNumber}`);
      return;
    }

    const newTender = createTenderProjectFromQuote(quote, tenderClients, equipments);
    if (onBatchCreateClients) {
      onBatchCreateClients([newTender]);
    } else if (handleCreateClientFn) {
      handleCreateClientFn(newTender);
    }

    if (onSelectClient) {
      onSelectClient(newTender.id);
    } else {
      setInternalActiveClientId(newTender.id);
    }

    if (onBatchSyncTenderItemsToCatalog && newTender.items.length > 0) {
      onBatchSyncTenderItemsToCatalog(newTender.items);
    }

    confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
    showToast(`✓ Licitación creada a partir de cotización ${quote.quoteNumber}`);
  };

  // Link Quote to Current Active Tender
  const handleLinkQuoteToCurrentTender = (quote: SavedQuote, importItems: boolean) => {
    if (!activeClient) return;
    const updates: Partial<TenderClientProject> = {
      linkedQuoteId: quote.id,
      linkedQuoteNumber: quote.quoteNumber,
      linkedQuoteTotal: quote.total,
      header: {
        ...activeClient.header,
        linkedQuoteId: quote.id,
        linkedQuoteNumber: quote.quoteNumber,
        linkedQuoteTotal: quote.total,
        linkedQuoteDate: quote.date,
        budgetCOP: activeClient.header.budgetCOP || quote.total,
        clientName: activeClient.clientName || quote.clientName,
        nit: activeClient.header.nit || quote.nit,
        city: activeClient.header.city || quote.city,
        contactPerson: activeClient.header.contactPerson || quote.contactPerson,
        contactEmail: activeClient.header.contactEmail || quote.contactEmail,
        contactPhone: activeClient.header.contactPhone || quote.contactPhone,
        executionTerm: activeClient.header.executionTerm || quote.deliveryTime,
      },
    };

    if (importItems) {
      const tenderFromQuote = createTenderProjectFromQuote(quote, tenderClients, equipments);
      updates.items = tenderFromQuote.items;
      if (onBatchSyncTenderItemsToCatalog) {
        onBatchSyncTenderItemsToCatalog(tenderFromQuote.items);
      }
    }

    handleUpdateClient(activeClient.id, updates);
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
    showToast(`✓ Cotización ${quote.quoteNumber} enlazada exitosamente a este proceso`);
  };

  // Unlink Quote from Current Active Tender
  const handleUnlinkQuoteFromCurrentTender = () => {
    if (!activeClient) return;
    const oldQuoteNum = activeClient.linkedQuoteNumber || activeClient.header?.linkedQuoteNumber || 'cotización';
    const cleanHeader = { ...activeClient.header };
    delete (cleanHeader as any).linkedQuoteId;
    delete (cleanHeader as any).linkedQuoteNumber;
    delete (cleanHeader as any).linkedQuoteTotal;
    delete (cleanHeader as any).linkedQuoteDate;
    (cleanHeader as any).linkedQuoteId = '';
    (cleanHeader as any).linkedQuoteNumber = '';
    (cleanHeader as any).linkedQuoteTotal = 0;
    (cleanHeader as any).linkedQuoteDate = '';

    const updates: Partial<TenderClientProject> = {
      linkedQuoteId: '',
      linkedQuoteNumber: '',
      linkedQuoteTotal: 0,
      header: cleanHeader,
    };
    handleUpdateClient(activeClient.id, updates);
    showToast(`✓ Cotización ${oldQuoteNum} desenlazada de esta licitación`);
  };

  // Batch import handler from Excel (Equipments)
  const handleImportExcelItems = (
    newItems: TenderItem[],
    mode: 'append' | 'replace',
    targetClientId?: string
  ) => {
    const targetId = targetClientId || activeClient?.id;
    if (!targetId) return;

    const targetClient = tenderClients.find((c) => c.id === targetId);
    const existingItems = targetClient?.items || [];
    const finalItems = mode === 'append' ? [...existingItems, ...newItems] : newItems;

    handleUpdateClient(targetId, { items: finalItems });

    if (onBatchSyncTenderItemsToCatalog) {
      onBatchSyncTenderItemsToCatalog(newItems);
    }

    if (onSelectClient) {
      onSelectClient(targetId);
    } else {
      setInternalActiveClientId(targetId);
    }

    confetti({ particleCount: 45, spread: 60, origin: { y: 0.7 } });
    showToast(`✓ Se cargaron ${newItems.length} equipos y se sincronizaron al Catálogo de Equipos`);
  };

  // Master import handler for Contracts & Equipments
  const handleImportFullContracts = (newContracts: TenderClientProject[]) => {
    if (onBatchCreateClients) {
      onBatchCreateClients(newContracts);
    } else if (handleCreateClientFn) {
      newContracts.forEach((c) => {
        handleCreateClientFn(c);
      });
    }

    if (newContracts.length > 0) {
      if (onSelectClient) onSelectClient(newContracts[0].id);
      else setInternalActiveClientId(newContracts[0].id);
    }

    const totalEquipments = newContracts.reduce((acc, c) => acc + (c.items?.length || 0), 0);
    confetti({ particleCount: 60, spread: 80, origin: { y: 0.6 } });
    showToast(`✓ Se importaron ${newContracts.length} contratos con ${totalEquipments} equipos asociados`);
  };

  // Save client modal
  const handleSaveClientModal = (data: any) => {
    if (clientToEdit) {
      handleUpdateClient(clientToEdit.id, {
        clientName: data.clientName,
        status: data.status,
        header: {
          ...clientToEdit.header,
          clientName: data.clientName,
          nit: data.nit,
          processNumber: data.processNumber,
          budgetCOP: data.budgetCOP !== undefined ? Number(data.budgetCOP) : clientToEdit.header.budgetCOP,
          city: data.city,
          processType: data.processType,
          contractObject: data.contractObject,
          contactPerson: data.contactPerson,
          openingDate: data.openingDate,
          closingDate: data.closingDate,
          executionTerm: data.executionTerm,
          isDirectClientOC: Boolean(data.isDirectClientOC),
          clientOrderNumber: data.clientOrderNumber || (data.isDirectClientOC ? data.processNumber : undefined),
        },
      });
      showToast(data.isDirectClientOC ? '✓ Orden de Compra directa del cliente actualizada' : '✓ Datos de la licitación actualizados');
    } else {
      if (data.linkedQuote) {
        const qNum = data.linkedQuote.quoteNumber;
        const qId = data.linkedQuote.id;
        const procNum = data.processNumber;

        const existingTender = tenderClients.find(
          (t) =>
            (procNum && t.header?.processNumber && t.header.processNumber.trim().toLowerCase() === procNum.trim().toLowerCase()) ||
            (qId && (t.linkedQuoteId === qId || t.header?.linkedQuoteId === qId)) ||
            (qNum && (t.linkedQuoteNumber === qNum || t.header?.linkedQuoteNumber === qNum))
        );

        if (existingTender) {
          const tenderFromQuote = createTenderProjectFromQuote(data.linkedQuote, tenderClients, equipments);
          handleUpdateClient(existingTender.id, {
            clientName: data.clientName,
            status: data.status || (data.isDirectClientOC ? 'Adjudicada' : existingTender.status),
            items: tenderFromQuote.items.length > 0 ? tenderFromQuote.items : existingTender.items,
            header: {
              ...existingTender.header,
              ...tenderFromQuote.header,
              clientName: data.clientName,
              nit: data.nit || existingTender.header.nit,
              processNumber: data.processNumber || existingTender.header.processNumber,
              budgetCOP: data.budgetCOP !== undefined && data.budgetCOP > 0 ? Number(data.budgetCOP) : existingTender.header.budgetCOP,
              city: data.city || existingTender.header.city,
              processType: data.processType || existingTender.header.processType,
              contractObject: data.contractObject || existingTender.header.contractObject,
              contactPerson: data.contactPerson || existingTender.header.contactPerson,
              executionTerm: data.executionTerm || existingTender.header.executionTerm,
              isDirectClientOC: Boolean(data.isDirectClientOC),
              clientOrderNumber: data.clientOrderNumber || (data.isDirectClientOC ? data.processNumber : undefined),
            },
          });
          if (onSelectClient) {
            onSelectClient(existingTender.id);
          } else {
            setInternalActiveClientId(existingTender.id);
          }
          confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
          showToast(`✓ Proceso existente actualizado y vinculado a la cotización ${data.linkedQuote.quoteNumber}`);
          return;
        }

        const tenderFromQuote = createTenderProjectFromQuote(data.linkedQuote, tenderClients, equipments);
        const newProject: TenderClientProject = {
          ...tenderFromQuote,
          clientName: data.clientName,
          status: data.status || (data.isDirectClientOC ? 'Adjudicada' : 'En Preparación'),
          header: {
            ...tenderFromQuote.header,
            clientName: data.clientName,
            nit: data.nit || tenderFromQuote.header.nit,
            processNumber: data.processNumber || tenderFromQuote.header.processNumber,
            budgetCOP: data.budgetCOP !== undefined && data.budgetCOP > 0 ? Number(data.budgetCOP) : tenderFromQuote.header.budgetCOP,
            city: data.city || tenderFromQuote.header.city,
            processType: data.processType || tenderFromQuote.header.processType,
            contractObject: data.contractObject || tenderFromQuote.header.contractObject,
            contactPerson: data.contactPerson || tenderFromQuote.header.contactPerson,
            openingDate: data.openingDate || tenderFromQuote.header.openingDate,
            closingDate: data.closingDate || tenderFromQuote.header.closingDate,
            executionTerm: data.executionTerm || tenderFromQuote.header.executionTerm,
            isDirectClientOC: Boolean(data.isDirectClientOC),
            clientOrderNumber: data.clientOrderNumber || (data.isDirectClientOC ? data.processNumber : undefined),
          },
        };
        if (onBatchCreateClients) {
          onBatchCreateClients([newProject]);
        } else if (handleCreateClientFn) {
          handleCreateClientFn(newProject);
        }
        if (onBatchSyncTenderItemsToCatalog && newProject.items?.length > 0) {
          onBatchSyncTenderItemsToCatalog(newProject.items);
        }
        if (onSelectClient) {
          onSelectClient(newProject.id);
        } else {
          setInternalActiveClientId(newProject.id);
        }
        confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
        showToast(
          data.isDirectClientOC
            ? `✓ Orden de Compra directa de cliente registrada y vinculada a la cotización ${data.linkedQuote.quoteNumber}`
            : `✓ Nueva licitación creada y enlazada a la cotización ${data.linkedQuote.quoteNumber} con ${newProject.items?.length || 0} equipos`
        );
      } else {
        if (handleCreateClientFn) {
          handleCreateClientFn(data);
        }
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
        showToast(data.isDirectClientOC ? '✓ Orden de Compra Directa del cliente registrada exitosamente' : '✓ Nueva licitación registrada exitosamente');
      }
    }
    setClientToEdit(null);
  };

  const isReadOnly = currentUser?.role === 'viewer' && !currentUser?.permissions?.canEditTenders;

  // Excel table filters hook
  const {
    filteredRows: filteredClients,
    filters: excelFilters,
    sort: excelSort,
    onApplyFilter,
    onApplySort,
    onClearColumnFilter,
    onResetAllFilters,
    isFilteredOrSorted,
  } = useExcelTableFilters(baseClients, TENDER_CLIENT_COLUMNS);

  return (
    <div id="tenders-view-container" className="space-y-4 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#38bdf8] text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-2xl animate-scaleUp flex items-center gap-2 border border-white/20">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Layout Mode Switcher Bar */}
      <div className="bg-[#192b45]/95 backdrop-blur-md border border-[#334d6e] rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xl sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30">
            <Award className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white flex items-center gap-2">
              <span>Licitaciones & Contratos de Suministro</span>
              <span className="text-[11px] font-mono bg-purple-500/20 text-purple-200 px-2 py-0.5 rounded-full border border-purple-500/30">
                {tenderClients.length} Procesos
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Gestión de pliegos, especificaciones técnicas de equipos médicos y adjudicaciones
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Active vs Terminated Filter Switcher */}
          <div className="flex items-center bg-[#15253d] p-1 rounded-xl border border-[#334d6e]">
            <button
              type="button"
              onClick={() => {
                setTenderStatusFilter('activas');
                const firstActive = tenderClients.find((c) => !isCompletedTender(c));
                handleSelectClient(firstActive ? firstActive.id : '');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                tenderStatusFilter === 'activas'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Activas ({activeCount})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTenderStatusFilter('terminadas');
                const firstTerm = tenderClients.find((c) => isCompletedTender(c));
                handleSelectClient(firstTerm ? firstTerm.id : '');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                tenderStatusFilter === 'terminadas'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
              <span>Terminadas ({completedCount})</span>
            </button>
          </div>

          {/* View Mode Toggle: Workspace vs List */}
          <div className="flex items-center bg-[#15253d] p-1 rounded-xl border border-[#334d6e]">
            <button
              type="button"
              onClick={() => setTendersViewLayout('workspace')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                tendersViewLayout === 'workspace'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Vista de trabajo dividida (Panel lateral + Matriz de Equipos y Specs)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Workspace</span>
            </button>
            <button
              type="button"
              onClick={() => setTendersViewLayout('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                tendersViewLayout === 'list'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Vista en Lista / Tabla General de todas las licitaciones"
            >
              <List className="w-3.5 h-3.5" />
              <span>Lista General</span>
            </button>
          </div>

          {!isReadOnly && (
            <div className="flex items-center gap-2">
              {activeClient && (activeClient.linkedQuoteNumber || activeClient.linkedQuoteId || activeClient.header?.linkedQuoteNumber || activeClient.header?.linkedQuoteId) ? (
                <button
                  type="button"
                  onClick={handleUnlinkQuoteFromCurrentTender}
                  className="inline-flex items-center gap-1.5 bg-rose-950/90 hover:bg-rose-900 text-rose-300 hover:text-rose-200 font-bold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer border border-rose-500/40 hover:border-rose-400 active:scale-95 shadow-xs"
                  title={`Desenlazar cotización (${activeClient.linkedQuoteNumber || activeClient.header?.linkedQuoteNumber || ''}) de esta licitación`}
                >
                  <Link2Off className="w-3.5 h-3.5 text-rose-400" />
                  <span>Desenlazar Cotización</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsLinkQuoteModalOpen(true)}
                  className="inline-flex items-center gap-1.5 bg-purple-950/90 hover:bg-purple-900 text-purple-300 hover:text-purple-200 font-bold text-xs px-3 py-1.5 rounded-xl transition cursor-pointer border border-purple-500/40 hover:border-purple-400 active:scale-95 shadow-xs"
                  title="Enlazar o importar datos y equipos desde una Cotización Guardada"
                >
                  <Link2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Enlazar Cotización</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setClientToEdit(null);
                  setClientModalMode('direct_oc');
                  setIsClientModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs px-3 py-1.5 rounded-xl transition cursor-pointer shadow-md active:scale-95"
                title="Registrar Orden de Compra directa enviada por el cliente (despacho directo sin licitación)"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>+ OC Directa Cliente</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setClientToEdit(null);
                  setClientModalMode('tender');
                  setIsClientModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-md active:scale-95"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Nueva Licitación</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {tendersViewLayout === 'list' ? (
        /* LIST / TABLE VIEW MODE */
        <div className="bg-[#192b45] border border-[#334d6e] rounded-2xl p-4 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[260px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={clientSearchQuery}
                onChange={(e) => setClientSearchQuery(e.target.value)}
                placeholder="Filtrar por N° de proceso, entidad, ciudad o plazo..."
                className="w-full pl-9 pr-3 py-2 bg-[#15253d] border border-[#334d6e] rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-400"
              />
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Mostrando {filteredClients.length} de {tenderClients.length} licitaciones
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#334d6e]">
            <table className="w-full text-left text-xs text-slate-200 border-collapse">
              <thead className="bg-[#111e30] text-[11px] font-bold text-slate-300 border-b border-[#334d6e]">
                <tr>
                  {TENDER_CLIENT_COLUMNS.map((col) => (
                    <th
                      key={col.id}
                      className="py-2.5 px-3"
                      style={{ minWidth: col.minWidth, width: col.width }}
                    >
                      <ExcelColumnHeader
                        column={col}
                        allRows={baseClients}
                        filters={excelFilters}
                        sort={excelSort}
                        onApplyFilter={onApplyFilter}
                        onApplySort={onApplySort}
                        onClearColumnFilter={onClearColumnFilter}
                      />
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
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
              <tbody className="divide-y divide-[#334d6e]/60 bg-[#15253d]/50">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No se encontraron licitaciones con el criterio de búsqueda
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => {
                    const itemsCount = client.items?.length || 0;
                    const totalUnits = client.items?.reduce((acc, it) => acc + (it.quantity || 1), 0) || 0;

                    return (
                      <tr key={client.id} className="hover:bg-[#192b45] transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-amber-300">
                          {formatTenderProcessNumber(client)}
                          <span className="text-[10px] text-slate-400 block font-normal">
                            {isTenderProjectDirectOC(client)
                              ? '📦 OC Directa del Cliente'
                              : (client.header.processType || 'Licitación Pública')}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-white max-w-[220px] truncate">
                          {client.clientName}
                          {client.header.nit && (
                            <span className="text-[10px] text-slate-400 block font-normal">NIT: {client.header.nit}</span>
                          )}
                          {(client.linkedQuoteNumber || client.header.linkedQuoteNumber) && (
                            <span className="text-[10px] font-mono text-purple-300 flex items-center gap-1 font-semibold mt-0.5">
                              <Link2 className="w-2.5 h-2.5" />
                              <span>Cot: {client.linkedQuoteNumber || client.header.linkedQuoteNumber}</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-300">{client.header.city || 'Colombia'}</td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                          {client.header.budgetCOP ? (
                            `$ ${Number(client.header.budgetCOP).toLocaleString('es-CO')}`
                          ) : (
                            <span className="text-slate-500 font-normal">Por cotizar</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-purple-300">{itemsCount} equipos</span>
                          <span className="text-[10px] text-slate-400 block">({totalUnits} uds)</span>
                        </td>
                        <td className="py-3 px-4 text-slate-300">{client.header.executionTerm || 'N/A'}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              client.status === 'Adjudicada'
                                ? 'bg-amber-400/15 text-amber-300 border-amber-400/40'
                                : client.status === 'Presentada'
                                ? 'bg-sky-400/15 text-sky-300 border-sky-400/40'
                                : client.status === 'En Preparación'
                                ? 'bg-indigo-400/15 text-indigo-300 border-indigo-400/40'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {client.status || 'En Preparación'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                if (onSelectClient) onSelectClient(client.id);
                                else setInternalActiveClientId(client.id);
                                setTendersViewLayout('workspace');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/40 text-[11px] font-bold transition flex items-center gap-1"
                              title="Abrir en espacio de trabajo detallado"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ver</span>
                            </button>

                            {!isReadOnly && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setClientToEdit(client);
                                    setIsClientModalOpen(true);
                                  }}
                                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                                  title="Editar datos de licitación"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setClientToDelete(client)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                                  title="Eliminar proceso"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
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
      ) : (
        /* WORKSPACE VIEW MODE (Sidebar + Details Matrix) */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 min-w-0 w-full items-start">
          {/* Left Sidebar: Contracts & Tenders List (Compact & Narrow) */}
          <div className="lg:col-span-4 xl:col-span-3 bg-[#192b45] border border-[#334d6e] rounded-xl p-3 flex flex-col gap-2.5 shadow-md min-w-0">
            <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-[#334d6e]">
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                  <Building2 className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-xs font-black text-white truncate">Licitaciones / Contratos</h3>
              </div>
              <span className="text-[10px] font-mono font-bold bg-[#15253d] text-purple-300 px-2 py-0.5 rounded-md border border-[#334d6e]">
                {tenderClients.length}
              </span>
            </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por entidad o N°..."
              value={clientSearchQuery}
              onChange={(e) => setClientSearchQuery(e.target.value)}
              className="w-full bg-[#111c2e] border border-[#334d6e] focus:border-purple-400 rounded-lg pl-8 pr-2 py-1.5 text-xs text-white placeholder-slate-400 outline-none"
            />
          </div>

          {/* Clients List */}
          <div className="space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto scrollbar-thin pr-0.5">
            {filteredClients.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 bg-[#111c2e] rounded-xl border border-[#334d6e]/50">
                <p>No se encontraron procesos.</p>
              </div>
            ) : (
              filteredClients.map((client) => {
                const isSelected = activeClient?.id === client.id;
                const isAwarded = client.status === 'Adjudicada';
                const itemsCount = client.items?.length || 0;
                const totalUnits = client.items?.reduce((acc, it) => acc + (it.quantity || 1), 0) || 0;

                return (
                  <div
                    key={client.id}
                    onClick={() => handleSelectClient(client.id)}
                    className={`p-2.5 rounded-xl border transition cursor-pointer flex flex-col gap-1.5 ${
                      isSelected
                        ? 'bg-[#1e314b] border-purple-400 shadow-md ring-1 ring-purple-400/40'
                        : 'bg-[#111c2e] border-[#334d6e] hover:border-slate-400/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="font-mono text-[9.5px] text-purple-300 font-bold bg-[#15253d] px-1.5 py-0.2 rounded border border-purple-500/30 truncate max-w-[110px]">
                            {formatTenderProcessNumber(client)}
                          </span>
                          {isTenderProjectDirectOC(client) ? (
                            <span className="text-[9px] font-black bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/40">
                              📦 OC Directa
                            </span>
                          ) : isAwarded ? (
                            <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/40">
                              ⭐ Adjudicada
                            </span>
                          ) : (
                            <span className="text-[9px] font-semibold bg-slate-800 text-slate-300 px-1 py-0.2 rounded">
                              {client.status || 'En Prep.'}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-bold text-white truncate mt-1">{client.clientName}</h4>
                      </div>

                      {!isReadOnly && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setClientToEdit(client);
                              setIsClientModalOpen(true);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-[#38bdf8] hover:bg-[#38bdf8]/10 transition cursor-pointer"
                            title="Editar contrato / licitación"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setClientToDelete(client);
                            }}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Eliminar contrato / licitación"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {client.header.executionTerm && (
                      <div className="text-[10px] text-sky-300 font-mono flex items-center gap-1 truncate">
                        <span>⏱️ Plazo:</span>
                        <strong className="text-white truncate">{client.header.executionTerm}</strong>
                      </div>
                    )}

                    {(client.linkedQuoteNumber || client.header.linkedQuoteNumber) && (
                      <div className="text-[9.5px] font-mono text-purple-300 bg-purple-950/60 border border-purple-500/30 rounded px-1.5 py-0.5 flex items-center gap-1 truncate">
                        <Link2 className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">Cot: {client.linkedQuoteNumber || client.header.linkedQuoteNumber}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-[#334d6e]/50">
                      <span className="truncate max-w-[80px]">{client.header.city || 'Colombia'}</span>
                      <span className="font-medium text-slate-300 shrink-0">
                        {itemsCount} eq. ({totalUnits} ud)
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Connected Two-Section Window (Spacious 9 Cols) */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-3 min-w-0 w-full">
          {activeClient ? (
            <>
              {/* Top Connected Sub-Tabs Navigation */}
              <div className="bg-[#192b45] border border-[#334d6e] rounded-xl p-1.5 flex items-center gap-1.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => setActiveSubTab('adjudicadas')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-black transition cursor-pointer ${
                    activeSubTab === 'adjudicadas'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-[#15253d]'
                  }`}
                >
                  <Award className="w-4 h-4 text-amber-300" />
                  <span>1. Licitaciones & Contratos Adjudicados</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border transition-colors ${
                      activeSubTab === 'adjudicadas'
                        ? 'bg-slate-950 text-white border-white/30 shadow-xs'
                        : 'bg-[#15253d] text-slate-200 border-[#334d6e]'
                    }`}
                  >
                    {activeClient.items?.length || 0} Equipos
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveSubTab('especificaciones')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-black transition cursor-pointer ${
                    activeSubTab === 'especificaciones'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-[#15253d]'
                  }`}
                >
                  <Sliders className="w-4 h-4 text-[#38bdf8]" />
                  <span>2. Especificaciones Técnicas & Anexos</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border transition-colors ${
                      activeSubTab === 'especificaciones'
                        ? 'bg-slate-950 text-white border-white/30 shadow-xs'
                        : 'bg-[#15253d] text-slate-200 border-[#334d6e]'
                    }`}
                  >
                    {activeClient.items?.reduce((acc, it) => acc + (it.requirements?.length || 0), 0) || 0} Specs
                  </span>
                </button>
              </div>

              {/* Connected Sub-Tab 1: Licitaciones & Contratos Adjudicados */}
              {activeSubTab === 'adjudicadas' && (
                <TenderAwardedView
                  activeClient={activeClient}
                  onUpdateClient={handleUpdateClient}
                  onUpdateTenderItem={handleUpdateTenderItemFn}
                  onDeleteTenderItem={handleDeleteTenderItemFn}
                  onOpenExcelImportModal={() => setIsExcelImportModalOpen(true)}
                  onOpenEditClientModal={() => {
                    setClientToEdit(activeClient);
                    setIsClientModalOpen(true);
                  }}
                  onDownloadExcelTemplate={downloadTenderEquipmentTemplate}
                  onSwitchToSpecificationsTab={(filterItemId) => {
                    if (filterItemId) setSelectedEquipmentIdForSpecs(filterItemId);
                    setActiveSubTab('especificaciones');
                  }}
                  onNavigateToOCTracking={onNavigateToOCTracking}
                  isReadOnly={isReadOnly}
                  contracts={effectiveContracts}
                  salesOrders={effectiveOrders}
                  salesInvoices={effectiveInvoices}
                  onCreateSalesOrder={onCreateSalesOrder}
                  equipments={equipments}
                />
              )}

              {/* Connected Sub-Tab 2: Especificaciones Técnicas & Anexos */}
              {activeSubTab === 'especificaciones' && (
                <TenderSpecificationsView
                  activeClient={activeClient}
                  equipments={equipments}
                  selectedEquipmentId={selectedEquipmentIdForSpecs}
                  onSelectEquipmentId={setSelectedEquipmentIdForSpecs}
                  onUpdateTenderItem={handleUpdateTenderItemFn}
                  onAddRequirement={handleAddRequirementFn}
                  onUpdateRequirement={handleUpdateRequirementFn}
                  onDeleteRequirement={handleDeleteRequirementFn}
                  onSwitchToAwardedTab={() => setActiveSubTab('adjudicadas')}
                  isReadOnly={isReadOnly}
                />
              )}
            </>
          ) : (
            <div className="bg-[#192b45] border border-[#334d6e] rounded-2xl p-10 text-center space-y-3 shadow-xl">
              <div className="p-3.5 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/30 w-fit mx-auto">
                <Building2 className="w-10 h-10" />
              </div>
              <div className="space-y-1 max-w-md mx-auto">
                <h3 className="text-base sm:text-lg font-black text-white">
                  {tenderStatusFilter === 'terminadas'
                    ? 'No hay licitaciones terminadas o archivadas'
                    : 'No hay licitaciones o contratos seleccionados'}
                </h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {tenderStatusFilter === 'terminadas'
                    ? 'Actualmente no hay contratos marcados como cumplidos o archivados. Puedes consultar los procesos en curso en la pestaña de «Activas».'
                    : 'Seleccione un proceso existente en el panel lateral izquierdo, registre uno nuevo con el botón «+ Nueva Licitación» o importe contratos y equipos médicos desde Excel.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* MODAL: EXCEL IMPORT (Equipments & Master Contracts) */}
      <TenderExcelImportModal
        isOpen={isExcelImportModalOpen}
        onClose={() => setIsExcelImportModalOpen(false)}
        onImportItems={handleImportExcelItems}
        onImportFullContracts={handleImportFullContracts}
        tenderClients={tenderClients}
        catalogEquipments={equipments}
        activeClientId={activeClient?.id}
        initialTab={excelImportInitialTab}
      />

      {/* MODAL: MANUAL ITEM CREATION */}
      {activeClient && (
        <TenderManualItemModal
          isOpen={isManualItemModalOpen}
          onClose={() => setIsManualItemModalOpen(false)}
          catalogEquipments={equipments}
          onAddItem={(newItem, createNewDuplicate) => {
            const current = activeClient.items || [];
            handleUpdateClient(activeClient.id, { items: [...current, newItem] });

            if (onSyncTenderItemToCatalog) {
              onSyncTenderItemToCatalog(newItem, createNewDuplicate);
            }

            showToast(`✓ ${newItem.name} guardado y sincronizado al Catálogo de Equipos`);
          }}
          itemsCount={activeClient.items?.length || 0}
        />
      )}

      {/* MODAL: ADD EQUIPMENT FROM CATALOG */}
      {isCatalogModalOpen && activeClient && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/25 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCatalogModalOpen(false);
          }}
        >
          <div className="bg-[#192b45] border border-purple-400/60 rounded-2xl max-w-3xl w-full shadow-2xl animate-scaleUp max-h-[88vh] flex flex-col overflow-hidden my-auto">
            <div className="px-4 py-3 border-b border-[#334d6e] flex items-center justify-between gap-3 bg-[#15253d] shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                  <Plus className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-white truncate">
                    Agregar Equipo desde Catálogo a {activeClient.clientName}
                  </h3>
                  <p className="text-[11px] text-slate-300 truncate">
                    Seleccione un equipo biomédico para incorporarlo al contrato
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCatalogModalOpen(false);
                  setCatalogSearchQuery('');
                }}
                className="px-2.5 py-1 text-xs font-bold text-slate-300 hover:text-white hover:bg-red-500/20 hover:border-red-500/40 border border-[#334d6e] rounded-lg transition cursor-pointer flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5 text-red-400" />
                <span className="hidden sm:inline">Cerrar</span>
              </button>
            </div>

            {/* Search */}
            <div className="p-3 bg-[#111c2e] border-b border-[#334d6e] shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por equipo, marca, modelo o parte..."
                  value={catalogSearchQuery}
                  onChange={(e) => setCatalogSearchQuery(e.target.value)}
                  className="w-full bg-[#15253d] border border-[#334d6e] focus:border-purple-400 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 outline-none"
                  autoFocus
                />
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto p-3 space-y-2 flex-1 scrollbar-thin bg-[#15253d]">
              {equipments
                .filter((eq) => {
                  const q = catalogSearchQuery.toLowerCase();
                  return (
                    eq.name.toLowerCase().includes(q) ||
                    eq.brand.toLowerCase().includes(q) ||
                    eq.model.toLowerCase().includes(q) ||
                    eq.code.toLowerCase().includes(q)
                  );
                })
                .map((eq, eqIdx) => {
                  const alreadyIn = activeClient.items?.some(
                    (it) => it.equipmentId === eq.id || it.code === eq.code
                  );

                  return (
                    <div
                      key={`tender-eq-${eq.id || eq.code || 'it'}-${eqIdx}`}
                      className="bg-[#111c2e] border border-[#334d6e] hover:border-purple-400/80 rounded-xl p-3 flex items-center justify-between gap-3 transition shadow-sm"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10.5px] font-bold text-[#38bdf8] bg-[#15253d] px-1.5 py-0.5 rounded border border-[#334d6e]">
                            {eq.code}
                          </span>
                          <span className="text-[10.5px] font-bold bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">
                            {eq.brand}
                          </span>
                          <span className="text-[10.5px] text-cyan-300 font-medium">
                            {eq.model}
                          </span>
                          {alreadyIn && (
                            <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 border border-purple-500/40 px-1.5 py-0.5 rounded">
                              ✓ En Contrato
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate">{eq.name}</h4>
                        <p className="text-[11px] text-slate-400">
                          {eq.technicalSpecs?.length || 0} especificaciones de fábrica
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onAddItemToClient(activeClient.id, eq);
                          showToast(`✓ ${eq.name} agregado al contrato`);
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer shadow-md shrink-0 active:scale-95 ${
                          alreadyIn
                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                            : 'bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950'
                        }`}
                      >
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                        <span>{alreadyIn ? '+ Otra Unidad' : 'Agregar'}</span>
                      </button>
                    </div>
                  );
                })}
            </div>

            <div className="p-3 bg-[#111c2e] border-t border-[#334d6e] flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-slate-300 font-semibold">
                Equipos actuales en este contrato: <strong className="text-purple-300 font-mono font-bold">{activeClient.items?.length || 0}</strong>
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsCatalogModalOpen(false);
                  setCatalogSearchQuery('');
                }}
                className="px-4 py-1.5 bg-[#38bdf8] hover:bg-[#0284c7] text-slate-950 font-black text-xs rounded-xl shadow-lg transition cursor-pointer"
              >
                Listo / Finalizar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: LINK QUOTE TO TENDER */}
      <TenderLinkQuoteModal
        isOpen={isLinkQuoteModalOpen}
        onClose={() => setIsLinkQuoteModalOpen(false)}
        savedQuotes={savedQuotes}
        activeClient={activeClient}
        equipments={equipments}
        onCreateTenderFromQuote={handleCreateTenderFromQuote}
        onLinkQuoteToCurrentTender={handleLinkQuoteToCurrentTender}
      />

      {/* MODAL: CREATE / EDIT CLIENT */}
      <TenderClientModal
        isOpen={isClientModalOpen}
        onClose={() => {
          setIsClientModalOpen(false);
          setClientToEdit(null);
        }}
        onSave={handleSaveClientModal}
        editingClient={clientToEdit}
        savedQuotes={savedQuotes}
        initialMode={clientModalMode}
      />

      {/* MODAL: DELETE CLIENT CONFIRMATION */}
      {clientToDelete && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/25 flex items-center justify-center p-2.5 sm:p-4 animate-fadeIn"
          onClick={(e) => {
            if (e.target === e.currentTarget) setClientToDelete(null);
          }}
        >
          <div className="bg-[#192b45] border border-rose-500/50 rounded-2xl max-w-md w-full p-4 sm:p-5 space-y-3.5 shadow-2xl animate-scaleUp my-auto">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-black text-white">¿Eliminar este contrato / licitación?</h3>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Está a punto de eliminar a <strong className="text-white font-bold">{clientToDelete.clientName}</strong> ({clientToDelete.header.processNumber || 'Sin proceso'}) y todos sus equipos y especificaciones técnicas asociadas.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#334d6e]">
              <button
                type="button"
                onClick={() => setClientToDelete(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-[#15253d] transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const idToDelete = clientToDelete.id;
                  setClientToDelete(null);
                  await handleDeleteClient(idToDelete);
                  showToast('✓ Licitación eliminada permanentemente');
                }}
                className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition cursor-pointer shadow-lg active:scale-95"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sí, Eliminar</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
