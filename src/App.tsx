import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Header } from './components/Header';
import { Navigation, ActiveTab } from './components/Navigation';
import { DashboardOverview } from './components/views/DashboardOverview';
import { QuotesView } from './components/views/QuotesView';
import { CostManagerView } from './components/views/CostManagerView';
import { EquipmentCatalogView } from './components/views/EquipmentCatalogView';
import { TendersView } from './components/views/TendersView';
import { OCTrackingView } from './components/views/OCTrackingView';
import { SalesOrdersView } from './components/views/SalesOrdersView';
import { DocumentationView } from './components/views/DocumentationView';
import { GmailPurchasingHubView } from './components/views/GmailPurchasingHubView';
import { FloatingAlertsWidget } from './components/alerts/FloatingAlertsWidget';
import { FloatingChatWidget } from './components/chat/FloatingChatWidget';
import { RateLimitToast } from './components/common/RateLimitToast';
import { AppUpdateBanner } from './components/common/AppUpdateBanner';
import { CustomizationModal } from './components/modals/CustomizationModal';
import { BackupModal } from './components/modals/BackupModal';
import { GoogleWorkspaceModal } from './components/modals/GoogleWorkspaceModal';
import { AppUpdatesModal } from './components/modals/AppUpdatesModal';
import { UserManagementModal } from './components/modals/UserManagementModal';
import { LoginModal } from './components/modals/LoginModal';
import { EquipmentModal } from './components/modals/EquipmentModal';
import { DocumentModal } from './components/modals/DocumentModal';
import { StandbyScreen } from './components/modals/StandbyScreen';
import { SuspensionLockScreen } from './components/modals/SuspensionLockScreen';
import { CloudSyncStatusModal } from './components/common/CloudSyncStatusModal';

import {
  QuoteHeader,
  QuoteItem,
  MedicalEquipment,
  SavedQuote,
  TenderClientProject,
  OCTrackingContract,
  SalesOrderRecord,
  SalesInvoiceRecord,
  TechnicalDocument,
  AuthUser,
  StoredUserAccount,
  ThemeSettings,
  QuoteStatus,
  SystemAlertItem,
} from './types';

import {
  INITIAL_QUOTE_HEADER,
  INITIAL_EQUIPMENTS,
  INITIAL_DOCUMENTS,
} from './data/initialData';
import {
  getActiveSessionUser,
  getStoredUsers,
  setStoredAuthUser,
  INITIAL_SYSTEM_USERS,
} from './data/authData';
import { getStoredThemeSettings, applyThemeToDOM } from './utils/themeStorage';
import { getSavedQuotes, saveOrUpdateQuote } from './utils/quoteStorage';
import { getNextDailyQuoteNumber, getFormattedSpanishDate } from './utils/quoteConsecutive';
import { markPendingAsCreated } from './utils/pendingEquipmentsStorage';
import { getOfficialSyDLetterheadDataUrl } from './utils/sydDefaultLetterhead';
import {
  getStoredOCTrackingContracts,
  saveStoredOCTrackingContracts,
} from './utils/ocTrackingStorage';
import {
  getStoredSalesOrders,
  saveStoredSalesOrders,
  getStoredSalesInvoices,
  saveStoredSalesInvoices,
  createTenderProjectFromQuote,
  createOCTrackingContractFromSalesOrder,
} from './utils/salesOrdersStorage';
import {
  getStoredTenders,
  subscribeToRealtimeDatabase,
  saveSingleTenderClientToFirestore,
  deleteTenderClientFromFirestore,
  saveSingleEquipmentToFirestore,
  deleteEquipmentFromFirestore,
  saveOCTrackingContractsToFirestore,
  saveSingleSalesOrderToFirestore,
  SyncConnectionStatus,
} from './services/realtimeSync';
import { useIdleStandby } from './hooks/useIdleStandby';
import { hydrateFromSnapshotIfEmpty } from './utils/hydrateInitialData';
import { isValidEquipmentCode, isValidSupplierName } from './utils/formatters';

// Hydrate local data on bundle evaluation
hydrateFromSnapshotIfEmpty();

export default function App() {
  // Navigation & Active View Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('inicio');
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Authentication & Current User - Always opens to the corporate login portal
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isCloudSyncModalOpen, setIsCloudSyncModalOpen] = useState(false);
  const [usersList, setUsersList] = useState<StoredUserAccount[]>(() => {
    const stored = getStoredUsers();
    return stored.length > 0 ? stored : INITIAL_SYSTEM_USERS;
  });

  // Theme Settings
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(() => getStoredThemeSettings());
  useEffect(() => {
    applyThemeToDOM(themeSettings);
  }, [themeSettings]);

  // Real-time Database Connection Status
  const [syncStatus, setSyncStatus] = useState<SyncConnectionStatus>('connected');

  // Helper to construct a pristine new daily quote header
  const buildNewDailyQuoteHeader = (quotesList?: SavedQuote[]): QuoteHeader => {
    const quotes = quotesList || getSavedQuotes();
    const nextNum = getNextDailyQuoteNumber(quotes);
    const formattedDate = getFormattedSpanishDate('Barranquilla', new Date());
    return {
      ...INITIAL_QUOTE_HEADER,
      city: 'Barranquilla',
      date: formattedDate,
      quoteNumber: nextNum,
    };
  };

  // Core Business State - Draft quote persisted across sessions and tab navigation
  const [quoteHeader, setQuoteHeader] = useState<QuoteHeader>(() => {
    try {
      const saved = localStorage.getItem('syd_active_draft_quote_header');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch (_) {}
    return buildNewDailyQuoteHeader();
  });
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>(() => {
    try {
      const saved = localStorage.getItem('syd_active_draft_quote_items');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (_) {}
    return [];
  });
  const [customLetterheadUrl, setCustomLetterheadUrl] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('syd_custom_manual_letterhead');
      if (saved && saved !== 'none' && saved.length > 20) return saved;
      const active = localStorage.getItem('syd_active_letterhead_url');
      if (active && active !== 'none' && active.length > 20) return active;
    } catch {}
    return getOfficialSyDLetterheadDataUrl();
  });
  const [marginSettings, setMarginSettings] = useState<{ subirBajar: number; izqDer: number; tableScale: number }>({
    subirBajar: 174,
    izqDer: 86,
    tableScale: 85,
  });
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(null);

  // Master Repositories
  const [equipments, setEquipments] = useState<MedicalEquipment[]>(() => {
    try {
      const stored = localStorage.getItem('syd_equipments_catalog');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const seenIds = new Set<string>();
          const seenCodes = new Set<string>();
          let hasDuplicates = false;
          const cleaned: MedicalEquipment[] = [];

          for (let idx = 0; idx < parsed.length; idx++) {
            const eq = parsed[idx];
            if (!eq) continue;
            const cleanCode = (eq.code || '').trim().toLowerCase();
            // Drop duplicate part numbers
            if (cleanCode && seenCodes.has(cleanCode)) {
              hasDuplicates = true;
              continue;
            }
            if (cleanCode) {
              seenCodes.add(cleanCode);
            }

            let uniqueId = eq.id;
            if (!uniqueId || seenIds.has(uniqueId)) {
              hasDuplicates = true;
              uniqueId = `eq-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`;
            }
            seenIds.add(uniqueId);
            cleaned.push({ ...eq, id: uniqueId });
          }

          if (hasDuplicates) {
            try {
              localStorage.setItem('syd_equipments_catalog', JSON.stringify(cleaned));
            } catch (_) {}
          }
          return cleaned;
        }
      }
    } catch (_) {}
    return INITIAL_EQUIPMENTS;
  });

  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>(() => getSavedQuotes());
  const [tenderClients, setTenderClients] = useState<TenderClientProject[]>(() => {
    const stored = getStoredTenders();
    try {
      const quotes = getSavedQuotes();
      let changed = false;
      const healed = stored.map((t) => {
        if ((!t.items || t.items.length === 0) && (t.linkedQuoteNumber || t.linkedQuoteId || t.header?.linkedQuoteNumber || t.header?.linkedQuoteId)) {
          const qNum = t.linkedQuoteNumber || t.header?.linkedQuoteNumber;
          const qId = t.linkedQuoteId || t.header?.linkedQuoteId;
          const q = quotes.find((sq) => (qNum && sq.quoteNumber === qNum) || (qId && sq.id === qId));
          if (q && q.items && q.items.length > 0) {
            const generated = createTenderProjectFromQuote(q, stored, []);
            if (generated.items && generated.items.length > 0) {
              changed = true;
              return {
                ...t,
                items: generated.items,
              };
            }
          }
        }
        return t;
      });
      if (changed) {
        localStorage.setItem('syd_tender_clients_v2', JSON.stringify(healed));
        return healed;
      }
    } catch (_) {}
    return stored;
  });
  const [ocContracts, setOcContracts] = useState<OCTrackingContract[]>(() => getStoredOCTrackingContracts());
  const [salesOrders, setSalesOrders] = useState<SalesOrderRecord[]>(() => getStoredSalesOrders());
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoiceRecord[]>(() => getStoredSalesInvoices());
  const [documents, setDocuments] = useState<TechnicalDocument[]>(() => {
    try {
      const stored = localStorage.getItem('syd_technical_documents_v3');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return INITIAL_DOCUMENTS;
  });

  // Cross-view conversion states
  const [initialQuoteToConvert, setInitialQuoteToConvert] = useState<SavedQuote | null>(null);
  const [initialTenderToConvert, setInitialTenderToConvert] = useState<TenderClientProject | null>(null);

  // Modals state
  const [isCustomizationModalOpen, setIsCustomizationModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isGoogleWorkspaceModalOpen, setIsGoogleWorkspaceModalOpen] = useState(false);
  const [isAppUpdatesModalOpen, setIsAppUpdatesModalOpen] = useState(false);
  const [isUserManagementModalOpen, setIsUserManagementModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [equipmentToEdit, setEquipmentToEdit] = useState<MedicalEquipment | null>(null);
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [documentModalProps, setDocumentModalProps] = useState<{
    equipmentId?: string;
    docType?: string;
    equipmentData?: any;
    contractContext?: any;
  }>({});
  const [isSuspended, setIsSuspended] = useState(false);

  // Standby Hook
  const { isStandby, wakeUp, enterStandby, timeoutMinutes, setTimeoutMinutes } = useIdleStandby(currentUser);

  // Real-time Firestore Sync Subscription
  useEffect(() => {
    const unsubscribe = subscribeToRealtimeDatabase({
      onEquipmentsUpdate: (newEqs) => {
        if (newEqs && newEqs.length > 0) {
          setEquipments(newEqs);
          try {
            localStorage.setItem('syd_equipments_catalog', JSON.stringify(newEqs));
          } catch (_) {}
        }
      },
      onQuotesUpdate: (newQuotes) => {
        if (newQuotes) {
          setSavedQuotes(newQuotes);
          try {
            localStorage.setItem('syd_saved_quotes_database_v2', JSON.stringify(newQuotes));
          } catch (_) {}
        }
      },
      onTendersUpdate: (newTenders) => {
        if (newTenders) {
          setTenderClients(newTenders);
          try {
            localStorage.setItem('syd_tender_clients_v2', JSON.stringify(newTenders));
          } catch (_) {}
        }
      },
      onOCContractsUpdate: (newContracts) => {
        if (newContracts) {
          setOcContracts(newContracts);
          saveStoredOCTrackingContracts(newContracts);
        }
      },
      onSalesOrdersUpdate: (newOrders) => {
        if (newOrders) {
          setSalesOrders(newOrders);
          saveStoredSalesOrders(newOrders);
        }
      },
      onSalesInvoicesUpdate: (newInvoices) => {
        if (newInvoices) {
          setSalesInvoices(newInvoices);
          saveStoredSalesInvoices(newInvoices);
        }
      },
      onDocumentsUpdate: (newDocs) => {
        if (newDocs) {
          setDocuments(newDocs);
          try {
            localStorage.setItem('syd_technical_documents_v3', JSON.stringify(newDocs));
          } catch (_) {}
        }
      },
      onUsersUpdate: (newUsers) => {
        if (newUsers && newUsers.length > 0) {
          setUsersList(newUsers);
          try {
            localStorage.setItem('syd_registered_system_users_v4', JSON.stringify(newUsers));
          } catch (_) {}
        }
      },
      onSyncStatusChange: (status) => setSyncStatus(status),
    });

    const handleCatalogUpdated = (e: any) => {
      if (e.detail?.catalog && Array.isArray(e.detail.catalog)) {
        setEquipments(e.detail.catalog);
      }
    };

    const handleUsersUpdated = (e: any) => {
      const freshUsers: StoredUserAccount[] = e?.detail || getStoredUsers();
      setUsersList(freshUsers);
      setCurrentUser((prev) => {
        if (!prev) return prev;
        const matching = freshUsers.find(
          (u) => u.id === prev.id || u.username.toLowerCase() === prev.username.toLowerCase()
        );
        if (matching) {
          const { password, ...safe } = matching;
          setStoredAuthUser(safe);
          return safe;
        }
        return prev;
      });
    };

    window.addEventListener('syd-catalog-updated', handleCatalogUpdated);
    window.addEventListener('syd_users_updated', handleUsersUpdated as EventListener);

    return () => {
      unsubscribe();
      window.removeEventListener('syd-catalog-updated', handleCatalogUpdated);
      window.removeEventListener('syd_users_updated', handleUsersUpdated as EventListener);
    };
  }, []);

  // Handlers for Quotes
  const handleUpdateHeader = useCallback((headerUpdates: Partial<QuoteHeader>) => {
    setQuoteHeader((prev) => {
      const updated = { ...prev, ...headerUpdates };
      try {
        localStorage.setItem('syd_active_draft_quote_header', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  }, []);

  const handleUpdateItem = useCallback((id: string, updates: Partial<QuoteItem>) => {
    setQuoteItems((prev) => {
      const updated = prev.map((it) => (it.id === id ? { ...it, ...updates } : it));
      try {
        localStorage.setItem('syd_active_draft_quote_items', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  }, []);

  const handleDeleteItem = useCallback((id: string) => {
    setQuoteItems((prev) => {
      const updated = prev.filter((it) => it.id !== id);
      try {
        localStorage.setItem('syd_active_draft_quote_items', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  }, []);

  // Global tab navigation event listener
  useEffect(() => {
    const handleNavEvent = (e: any) => {
      if (e.detail?.tab) {
        setActiveTab(e.detail.tab);
      }
    };
    window.addEventListener('syd_navigate_tab', handleNavEvent);
    return () => window.removeEventListener('syd_navigate_tab', handleNavEvent);
  }, []);

  const handleCreateNewQuote = useCallback(() => {
    const latestSaved = getSavedQuotes();
    const freshHeader = buildNewDailyQuoteHeader(latestSaved);
    setQuoteHeader(freshHeader);
    setQuoteItems([]);
    setEditingQuoteId(null);
    try {
      localStorage.removeItem('syd_active_draft_quote_header');
      localStorage.removeItem('syd_active_draft_quote_items');
    } catch (_) {}
    setCustomLetterheadUrl((prev) => {
      if (prev && prev !== 'none' && prev.length > 20) return prev;
      return getOfficialSyDLetterheadDataUrl();
    });
    setMarginSettings({ subirBajar: 174, izqDer: 86, tableScale: 85 });
    setActiveTab('ventas');
  }, []);

  const handleLoadQuoteIntoEditor = useCallback((quote: any) => {
    const rawHeader = quote.header || {};
    const header: QuoteHeader = {
      quoteNumber: quote.quoteNumber || rawHeader.quoteNumber || '',
      clientName: quote.clientName || rawHeader.clientName || '',
      nit: quote.nit || rawHeader.nit || '',
      contactPerson: quote.contactPerson || rawHeader.contactPerson || '',
      contactEmail: quote.contactEmail || rawHeader.contactEmail || '',
      contactPhone: quote.contactPhone || rawHeader.contactPhone || '',
      city: quote.city || rawHeader.city || 'Bogotá',
      date: quote.date || rawHeader.date || '',
      validityDays: quote.validityDays !== undefined ? quote.validityDays : (rawHeader.validityDays || 30),
      paymentTerms: quote.paymentTerms || rawHeader.paymentTerms || '50% Anticipo y 50% Contra-entrega.',
      deliveryTime: quote.deliveryTime || rawHeader.deliveryTime || '90D',
      deliveryPlace: quote.deliveryPlace || rawHeader.deliveryPlace || 'Sede Cliente',
      trainingTerms: quote.trainingTerms || rawHeader.trainingTerms || 'Un (1) día en la ubicación del equipo.',
      maintenanceTerms: quote.maintenanceTerms || rawHeader.maintenanceTerms || 'Un (1) mantenimiento preventivo.',
      warrantyTerms: quote.warrantyTerms || rawHeader.warrantyTerms || 'Doce (12) meses.',
      taxRate: quote.taxRate !== undefined ? quote.taxRate : (rawHeader.taxRate ?? 0.19),
      advisorName: quote.advisorName || rawHeader.advisorName || '',
      advisorRole: quote.advisorRole || rawHeader.advisorRole || 'Especialista Comercial',
      advisorPhone: quote.advisorPhone || rawHeader.advisorPhone || '',
      advisorEmail: quote.advisorEmail || rawHeader.advisorEmail || '',
      notes: quote.notes || rawHeader.notes || '',
      formatStyle: quote.formatStyle || rawHeader.formatStyle || 'standard',
    };
    setQuoteHeader(header);
    setQuoteItems(quote.items || []);
    setEditingQuoteId(quote.id);
    try {
      localStorage.setItem('syd_active_draft_quote_header', JSON.stringify(header));
      localStorage.setItem('syd_active_draft_quote_items', JSON.stringify(quote.items || []));
    } catch (_) {}
    setEditingQuoteId(quote.id);
    if (quote.letterheadUrl !== undefined) {
      setCustomLetterheadUrl(quote.letterheadUrl === 'none' ? null : (quote.letterheadUrl || getOfficialSyDLetterheadDataUrl()));
    } else {
      setCustomLetterheadUrl(getOfficialSyDLetterheadDataUrl());
    }
    if (quote.marginSettings && quote.marginSettings.subirBajar > 0) {
      setMarginSettings(quote.marginSettings);
    } else {
      setMarginSettings({ subirBajar: 174, izqDer: 86, tableScale: 85 });
    }
    setActiveTab('ventas');
  }, []);

  const handleSaveQuote = useCallback(
    (letterheadUrl: string | null, margins: { subirBajar: number; izqDer: number; tableScale: number }) => {
      const saved = saveOrUpdateQuote(
        quoteHeader,
        quoteItems,
        'Borrador',
        letterheadUrl,
        margins,
        editingQuoteId || undefined
      );
      setSavedQuotes(getSavedQuotes());
      setEditingQuoteId(saved.id);
    },
    [quoteHeader, quoteItems, editingQuoteId]
  );

  const handleUpdateQuoteStatus = useCallback((id: string, status: QuoteStatus) => {
    const all = getSavedQuotes();
    const target = all.find((q) => q.id === id);
    if (target) {
      target.status = status;
      target.updatedAt = new Date().toISOString();
      localStorage.setItem('syd_saved_quotes_database_v2', JSON.stringify(all));
      setSavedQuotes([...all]);
    }
  }, []);

  const handleDeleteQuote = useCallback((id: string) => {
    const all = getSavedQuotes().filter((q) => q.id !== id);
    localStorage.setItem('syd_saved_quotes_database_v2', JSON.stringify(all));
    setSavedQuotes(all);
  }, []);

  const handleDuplicateQuote = useCallback((id: string) => {
    const all = getSavedQuotes();
    const source = all.find((q) => q.id === id);
    if (source) {
      const dup: SavedQuote = {
        ...source,
        id: `quote-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        quoteNumber: `${source.quoteNumber}-COPIA`,
        header: {
          ...source.header,
          quoteNumber: `${source.header.quoteNumber}-COPIA`,
          date: new Date().toISOString().split('T')[0],
        },
        status: 'Borrador',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updated = [dup, ...all];
      localStorage.setItem('syd_saved_quotes_database_v2', JSON.stringify(updated));
      setSavedQuotes(updated);
    }
  }, []);

  // Handlers for Equipments
  const handleAddItemFromEquipment = useCallback((equipment: MedicalEquipment, shouldNavigate = false) => {
    setQuoteItems((prev) => {
      const existing = prev.find(
        (it) => it.equipmentId === equipment.id || (equipment.code && it.code === equipment.code)
      );
      let updated: QuoteItem[];
      if (existing) {
        const newQty = (existing.quantity || 1) + 1;
        updated = prev.map((it) =>
          it.id === existing.id
            ? {
                ...it,
                quantity: newQty,
                totalCost: (it.unitCostCOP || 0) * newQty,
                totalSalePrice: (it.unitSalePrice || 0) * newQty,
              }
            : it
        );
      } else {
        const newItem: QuoteItem = {
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          equipmentId: equipment.id,
          code: equipment.code,
          name: equipment.name,
          brand: equipment.brand,
          model: equipment.model,
          description: equipment.description,
          briefDescription: equipment.description,
          technicalFeatures: equipment.technicalSpecs || [],
          quantity: 1,
          unitCostCOP: equipment.baseCostCOP || 0,
          totalCost: equipment.baseCostCOP || 0,
          multiplier: 1.5874, // L4 default
          marginType: 'L4',
          unitSalePrice: Math.round((equipment.baseCostCOP || 0) * 1.5874),
          totalSalePrice: Math.round((equipment.baseCostCOP || 0) * 1.5874),
          taxExempt: equipment.taxExempt || false,
          taxRate: equipment.taxRate ?? 0.19,
          warrantyMonths: equipment.warrantyMonths || 12,
          imageUrl: equipment.imageUrl || equipment.image,
          accessories: [],
        };
        updated = [...prev, newItem];
      }
      try {
        localStorage.setItem('syd_active_draft_quote_items', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });

    if (shouldNavigate) {
      setActiveTab('ventas');
    }
  }, []);

  const handleAddCustomQuoteItem = useCallback((item: QuoteItem) => {
    setQuoteItems((prev) => {
      const updated = [...prev, item];
      try {
        localStorage.setItem('syd_active_draft_quote_items', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  }, []);

  const handleSaveEquipment = useCallback((equipment: MedicalEquipment) => {
    setEquipments((prev) => {
      const idx = prev.findIndex((e) => e.id === equipment.id || (e.code && e.code === equipment.code));
      let updated: MedicalEquipment[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = equipment;
      } else {
        updated = [equipment, ...prev];
      }
      try {
        localStorage.setItem('syd_equipments_catalog', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });

    // Dispatch catalog update event so open modals immediately see the new equipment
    window.dispatchEvent(new CustomEvent('syd_equipment_catalog_updated', { detail: equipment }));

    // Propagate newly assigned code, supplier, brand to any pending items in tender projects (such as Contrato 11111)
    if (isValidEquipmentCode(equipment.code)) {
      const cleanNormStr = (str?: string) =>
        (str || '')
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '');

      const eqNormName = cleanNormStr(equipment.name);
      const eqNormModel = cleanNormStr(equipment.model);

      setTenderClients((prevTenders) => {
        let tendersChanged = false;
        const nextTenders = prevTenders.map((t) => {
          let itemChanged = false;
          const nextItems = (t.items || []).map((ti) => {
            const tiNormName = cleanNormStr(ti.name);
            const tiNormModel = cleanNormStr(ti.model);

            const isMatch =
              (tiNormName && (tiNormName === eqNormName || tiNormName === eqNormModel)) ||
              (tiNormModel && (tiNormModel === eqNormModel || tiNormModel === eqNormName)) ||
              (ti.equipmentId && ti.equipmentId === equipment.id);

            if (isMatch && (!isValidEquipmentCode(ti.code) || !isValidSupplierName(ti.supplier))) {
              itemChanged = true;
              return {
                ...ti,
                equipmentId: equipment.id,
                code: equipment.code,
                supplier: isValidSupplierName(equipment.supplier) ? equipment.supplier : ti.supplier,
                brand: equipment.brand || ti.brand,
                model: equipment.model || ti.model,
              };
            }
            return ti;
          });

          if (itemChanged) {
            tendersChanged = true;
            return {
              ...t,
              items: nextItems,
              updatedAt: new Date().toISOString(),
            };
          }
          return t;
        });

        if (tendersChanged) {
          try {
            localStorage.setItem('syd_tender_clients_v2', JSON.stringify(nextTenders));
          } catch (_) {}
          window.dispatchEvent(new CustomEvent('syd_tender_clients_updated', { detail: nextTenders }));
          return nextTenders;
        }
        return prevTenders;
      });

      // Also propagate to draft quote items if active
      setQuoteItems((prevItems) => {
        let itemsChanged = false;
        const nextItems = prevItems.map((qi) => {
          const qiNormName = cleanNormStr(qi.name);
          const qiNormModel = cleanNormStr(qi.model);
          const isMatch =
            (qiNormName && (qiNormName === eqNormName || qiNormName === eqNormModel)) ||
            (qiNormModel && (qiNormModel === eqNormModel || qiNormModel === eqNormName)) ||
            (qi.equipmentId && qi.equipmentId === equipment.id);

          if (isMatch && (!isValidEquipmentCode(qi.code) || !qi.code)) {
            itemsChanged = true;
            return {
              ...qi,
              equipmentId: equipment.id,
              code: equipment.code,
              brand: equipment.brand || qi.brand,
              model: equipment.model || qi.model,
            };
          }
          return qi;
        });

        if (itemsChanged) {
          try {
            localStorage.setItem('syd_active_draft_quote_items', JSON.stringify(nextItems));
          } catch (_) {}
          return nextItems;
        }
        return prevItems;
      });
    }

    // If equipment was created from a pending emergency quote equipment, mark it as created
    if (equipment.sourceOrigin && equipment.sourceOrigin.startsWith('pending-id:')) {
      const pendingId = equipment.sourceOrigin.replace('pending-id:', '').trim();
      markPendingAsCreated(pendingId, equipment.id, equipment.code);
    }

    saveSingleEquipmentToFirestore(equipment).catch(console.warn);
  }, []);

  const handleDeleteEquipment = useCallback((id: string, code?: string) => {
    setEquipments((prev) => {
      const updated = prev.filter((e) => e.id !== id && (!code || e.code !== code));
      try {
        localStorage.setItem('syd_equipments_catalog', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
    deleteEquipmentFromFirestore(id).catch(console.warn);
  }, []);

  // Handlers for Tenders
  const handleCreateTenderClient = useCallback((clientData: any) => {
    const rawHeader = clientData.header || {};
    const newTender: TenderClientProject = {
      id: clientData.id || `tender-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      clientName: clientData.clientName || rawHeader.clientName || 'Nuevo Cliente Hospitalario',
      nit: clientData.nit || rawHeader.nit || '',
      header: {
        entityName: clientData.clientName || rawHeader.clientName || '',
        processNumber: clientData.processNumber || rawHeader.processNumber || '',
        processType: clientData.processType || rawHeader.processType || 'Licitación Pública',
        contractObject: clientData.contractObject || rawHeader.contractObject || '',
        openingDate: clientData.openingDate || rawHeader.openingDate || new Date().toISOString().split('T')[0],
        closingDate: clientData.closingDate || rawHeader.closingDate || '',
        city: clientData.city || rawHeader.city || 'Bogotá',
        budgetCOP: clientData.budgetCOP !== undefined ? Number(clientData.budgetCOP) : (rawHeader.budgetCOP || 0),
        executionTerm: clientData.executionTerm || rawHeader.executionTerm || '',
        nit: clientData.nit || rawHeader.nit || '',
        linkedQuoteId: clientData.linkedQuoteId || rawHeader.linkedQuoteId,
        linkedQuoteNumber: clientData.linkedQuoteNumber || rawHeader.linkedQuoteNumber,
        linkedQuoteTotal: clientData.linkedQuoteTotal || rawHeader.linkedQuoteTotal,
        isDirectClientOC: Boolean(clientData.isDirectClientOC || rawHeader.isDirectClientOC),
        clientOrderNumber: clientData.clientOrderNumber || rawHeader.clientOrderNumber,
        ...rawHeader,
      },
      items: Array.isArray(clientData.items) ? clientData.items : [],
      status: clientData.status || (clientData.isDirectClientOC || rawHeader.isDirectClientOC ? 'Adjudicada' : 'borrador'),
      linkedQuoteId: clientData.linkedQuoteId || rawHeader.linkedQuoteId,
      linkedQuoteNumber: clientData.linkedQuoteNumber || rawHeader.linkedQuoteNumber,
      linkedQuoteTotal: clientData.linkedQuoteTotal || rawHeader.linkedQuoteTotal,
      createdAt: clientData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTenderClients((prev) => {
      const idx = prev.findIndex((t) => t.id === newTender.id);
      let updated: TenderClientProject[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = newTender;
      } else {
        updated = [newTender, ...prev];
      }
      try {
        localStorage.setItem('syd_tender_clients_v2', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
    saveSingleTenderClientToFirestore(newTender).catch(console.warn);
  }, []);

  // Handlers for OC Contracts
  const handleUpdateContracts = useCallback((updated: OCTrackingContract[]) => {
    setOcContracts(updated);
    saveStoredOCTrackingContracts(updated);
    saveOCTrackingContractsToFirestore(updated).catch(console.warn);
  }, []);

  const handleGenerateOCTracking = useCallback(
    (order: SalesOrderRecord) => {
      if (!order || !order.items || order.items.length === 0) {
        return;
      }

      const newContract = createOCTrackingContractFromSalesOrder(order, equipments);

      setOcContracts((prev) => {
        const idx = prev.findIndex(
          (c) =>
            c.id === newContract.id ||
            c.salesOrderId === order.id ||
            (order.salesOrderNumber && c.salesOrderNumber === order.salesOrderNumber)
        );
        let updated: OCTrackingContract[];
        if (idx >= 0) {
          updated = [...prev];
          updated[idx] = { ...updated[idx], ...newContract };
        } else {
          updated = [newContract, ...prev];
        }
        try {
          localStorage.setItem('syd_oc_tracking_contracts_v1', JSON.stringify(updated));
        } catch (_) {}
        saveOCTrackingContractsToFirestore(updated).catch(console.warn);
        return updated;
      });

      setSalesOrders((prev) => {
        const updated = prev.map((o) =>
          o.id === order.id ? { ...o, hasLinkedOC: true, ocContractId: newContract.id } : o
        );
        try {
          localStorage.setItem('syd_sales_orders_v1', JSON.stringify(updated));
        } catch (_) {}
        saveSingleSalesOrderToFirestore({
          ...order,
          hasLinkedOC: true,
          ocContractId: newContract.id,
        }).catch(console.warn);
        return updated;
      });
    },
    [equipments]
  );

  // Handlers for Sales Orders & Invoices
  const handleUpdateSalesOrders = useCallback((orders: SalesOrderRecord[]) => {
    setSalesOrders(orders);
    saveStoredSalesOrders(orders);
  }, []);

  const handleUpdateSalesInvoices = useCallback((invoices: SalesInvoiceRecord[]) => {
    setSalesInvoices(invoices);
    saveStoredSalesInvoices(invoices);
  }, []);

  const handleClearInitialQuoteToConvert = useCallback(() => setInitialQuoteToConvert(null), []);
  const handleClearInitialTenderToConvert = useCallback(() => setInitialTenderToConvert(null), []);

  // Handlers for Documents
  const handleOpenNewDocumentModal = useCallback(
    (equipmentId?: string, docType?: string, equipmentData?: any, contractContext?: any) => {
      setDocumentModalProps({ equipmentId, docType, equipmentData, contractContext });
      setIsDocumentModalOpen(true);
    },
    []
  );

  const handleSaveDocument = useCallback((newDoc: TechnicalDocument) => {
    setDocuments((prev) => {
      const idx = prev.findIndex((d) => d.id === newDoc.id);
      let updated: TechnicalDocument[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = newDoc;
      } else {
        updated = [newDoc, ...prev];
      }
      try {
        localStorage.setItem('syd_technical_documents_v3', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  }, []);

  const handleDeleteDocument = useCallback((id: string) => {
    setDocuments((prev) => {
      const updated = prev.filter((d) => d.id !== id);
      try {
        localStorage.setItem('syd_technical_documents_v3', JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  }, []);

  // Conversions
  const handleConvertToSalesOrder = useCallback((quote: any) => {
    setInitialQuoteToConvert(quote);
    setActiveTab('ordenes_venta');
  }, []);

  const handleConvertToTender = useCallback((quote: any) => {
    setInitialTenderToConvert(quote);
    setActiveTab('licitaciones');
  }, []);

  // Derived Alerts
  const systemAlerts = useMemo<SystemAlertItem[]>(() => {
    const alerts: SystemAlertItem[] = [];
    const now = Date.now();

    // Check OC tracking items in transit/customs
    ocContracts.forEach((contract) => {
      contract.items.forEach((item) => {
        if (item.status === 'En Tránsito' || item.status === 'En Aduana') {
          alerts.push({
            id: `alert-oc-${item.id}`,
            title: `Seguimiento OC: ${item.brand} ${item.model}`,
            message: `Contrato ${contract.contractNumber}: ${item.quantity} unds en estado "${item.status}".`,
            severity: 'media',
            category: 'aduana',
            actionLabel: 'Ver en Seguimiento OC',
            actionTab: 'seguimiento_oc',
            timestamp: now,
          });
        }
      });
    });

    // Check unpaid invoices
    salesInvoices.forEach((inv) => {
      if (inv.paymentStatus === 'Pendiente Radicación') {
        alerts.push({
          id: `alert-inv-${inv.id}`,
          title: `Factura ${inv.invoiceNumber} Pendiente`,
          message: `Factura a nombre de ${inv.clientName} está pendiente de radicación.`,
          severity: 'critica',
          category: 'facturacion',
          actionLabel: 'Ver Facturación',
          actionTab: 'ordenes_venta',
          timestamp: now,
        });
      }
    });

    return alerts;
  }, [ocContracts, salesInvoices]);

  // If app is suspended by admin lock
  if (isSuspended) {
    return (
      <SuspensionLockScreen
        isOpen={isSuspended}
        onUnlock={() => setIsSuspended(false)}
        currentUser={currentUser}
      />
    );
  }

  // If not logged in, strictly display corporate Login Screen
  if (!currentUser) {
    return (
      <LoginModal
        isOpen={true}
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setStoredAuthUser(user);
        }}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0f1d] text-slate-100 antialiased font-sans">
      {/* Standby screen when idle */}
      {isStandby && <StandbyScreen isOpen={isStandby} onWakeUp={wakeUp} />}

      {/* Main Left Navigation Sidebar */}
      <Navigation
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setIsMobileNavOpen(false);
        }}
        isCollapsed={isNavCollapsed}
        onToggleCollapse={() => setIsNavCollapsed((prev) => !prev)}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        currentUser={currentUser}
        onLogout={() => {
          setStoredAuthUser(null);
          setCurrentUser(null);
        }}
        onOpenUserManagement={() => setIsUserManagementModalOpen(true)}
        onSuspendApp={() => setIsSuspended(true)}
        onOpenCustomization={() => setIsCustomizationModalOpen(true)}
        themeSettings={themeSettings}
        quoteItemsCount={quoteItems.length}
        costItemsCount={quoteItems.length}
        catalogItemsCount={equipments.length}
        tenderItemsCount={tenderClients.length}
        docItemsCount={documents.length}
        savedQuotesCount={savedQuotes.length}
        ocItemsCount={ocContracts.reduce((acc, c) => acc + c.items.length, 0)}
        ocAlertsCount={systemAlerts.length}
        salesOrdersCount={salesOrders.length}
        salesInvoicesCount={salesInvoices.length}
        onOpenAppUpdates={() => setIsAppUpdatesModalOpen(true)}
        onOpenShareModal={() => setIsCloudSyncModalOpen(true)}
      />

      {/* Main Content Layout */}
      <div
        className="flex-1 flex flex-col min-w-0 h-full overflow-hidden transition-colors"
        style={{
          backgroundColor: 'var(--syd-body-bg)',
        }}
      >
        {/* Top Header Bar Container */}
        <div
          className="px-4 py-3 sm:px-6 lg:px-8 border-b shrink-0 transition-colors"
          style={{
            backgroundColor: 'var(--syd-header-bg)',
            borderColor: 'var(--syd-border-color)',
          }}
        >
          <Header
            activeTab={activeTab}
            onOpenMobileMenu={() => setIsMobileNavOpen(true)}
            currentUser={currentUser}
            themeSettings={themeSettings}
            syncStatus={syncStatus}
            onOpenCustomization={() => setIsCustomizationModalOpen(true)}
            onOpenAppUpdates={() => setIsAppUpdatesModalOpen(true)}
            onOpenBackupModal={() => setIsBackupModalOpen(true)}
            onOpenGoogleWorkspaceModal={() => setIsGoogleWorkspaceModalOpen(true)}
            onOpenShareModal={() => setIsCloudSyncModalOpen(true)}
            onSuspendApp={() => setIsSuspended(true)}
            alertsCount={systemAlerts.length}
            onRefresh={() => {
              setSavedQuotes(getSavedQuotes());
              setTenderClients(getStoredTenders());
              setOcContracts(getStoredOCTrackingContracts());
              setSalesOrders(getStoredSalesOrders());
              setSalesInvoices(getStoredSalesInvoices());
            }}
          />
        </div>

        {/* Global App Update Banner */}
        <AppUpdateBanner />

        {/* Dynamic View Router */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative p-4 sm:p-6 lg:p-8">
          {activeTab === 'inicio' && (
            <DashboardOverview
              quoteHeader={quoteHeader}
              quoteItems={quoteItems}
              equipments={equipments}
              tenderItems={[]}
              documents={documents}
              savedQuotes={savedQuotes}
              tenderClients={tenderClients}
              ocContracts={ocContracts}
              onNavigate={(tab) => setActiveTab(tab)}
              onLoadQuoteIntoEditor={handleLoadQuoteIntoEditor}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'ventas' && (
            <QuotesView
              quoteHeader={quoteHeader}
              quoteItems={quoteItems}
              equipments={equipments}
              savedQuotes={savedQuotes}
              initialSubTab="editor"
              customLetterheadUrl={customLetterheadUrl}
              onUpdateLetterhead={setCustomLetterheadUrl}
              marginSettings={marginSettings}
              onUpdateMarginSettings={setMarginSettings}
              onUpdateHeader={handleUpdateHeader}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onNavigateToCatalog={() => setActiveTab('catalogo')}
              onNavigateToCostManager={() => setActiveTab('costos')}
              onSaveQuote={handleSaveQuote}
              onCreateNewQuote={handleCreateNewQuote}
              onLoadQuoteIntoEditor={handleLoadQuoteIntoEditor}
              onUpdateQuoteStatus={handleUpdateQuoteStatus}
              onDeleteQuote={handleDeleteQuote}
              onDuplicateQuote={handleDuplicateQuote}
              onConvertToSalesOrder={handleConvertToSalesOrder}
              onConvertToTender={handleConvertToTender}
              currentUser={currentUser}
              editingQuoteId={editingQuoteId}
              onCancelEditQuote={() => setEditingQuoteId(null)}
            />
          )}

          {activeTab === 'historial' && (
            <QuotesView
              quoteHeader={quoteHeader}
              quoteItems={quoteItems}
              equipments={equipments}
              savedQuotes={savedQuotes}
              initialSubTab="historial"
              customLetterheadUrl={customLetterheadUrl}
              onUpdateLetterhead={setCustomLetterheadUrl}
              marginSettings={marginSettings}
              onUpdateMarginSettings={setMarginSettings}
              onUpdateHeader={handleUpdateHeader}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onNavigateToCatalog={() => setActiveTab('catalogo')}
              onNavigateToCostManager={() => setActiveTab('costos')}
              onSaveQuote={handleSaveQuote}
              onCreateNewQuote={handleCreateNewQuote}
              onLoadQuoteIntoEditor={handleLoadQuoteIntoEditor}
              onUpdateQuoteStatus={handleUpdateQuoteStatus}
              onDeleteQuote={handleDeleteQuote}
              onDuplicateQuote={handleDuplicateQuote}
              onConvertToSalesOrder={handleConvertToSalesOrder}
              onConvertToTender={handleConvertToTender}
              currentUser={currentUser}
              editingQuoteId={editingQuoteId}
              onCancelEditQuote={() => setEditingQuoteId(null)}
            />
          )}

          {activeTab === 'costos' && (
            <CostManagerView
              quoteItems={quoteItems}
              quoteHeader={quoteHeader}
              equipments={equipments}
              taxRate={quoteHeader.taxRate ?? 0.19}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onNavigateToSales={() => setActiveTab('ventas')}
              onAddItemFromEquipment={(eq) => handleAddItemFromEquipment(eq, false)}
              onAddCustomQuoteItem={handleAddCustomQuoteItem}
              onUpdateEquipmentBaseCost={(idOrCode, newCost) => {
                setEquipments((prev) =>
                  prev.map((eq) =>
                    eq.id === idOrCode || eq.code === idOrCode ? { ...eq, baseCostCOP: newCost } : eq
                  )
                );
              }}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'catalogo' && (
            <EquipmentCatalogView
              equipments={equipments}
              tenderClients={tenderClients}
              onAddToTender={(eq) => {
                setActiveTab('licitaciones');
              }}
              onAddToQuote={handleAddItemFromEquipment}
              onNavigateToSales={() => setActiveTab('ventas')}
              onNavigateToTenders={() => setActiveTab('licitaciones')}
              onOpenNewEquipmentModal={() => {
                setEquipmentToEdit(null);
                setIsEquipmentModalOpen(true);
              }}
              onEditEquipment={(eq) => {
                setEquipmentToEdit(eq);
                setIsEquipmentModalOpen(true);
              }}
              onDeleteEquipment={handleDeleteEquipment}
              onClearAllEquipments={async () => {
                setEquipments([]);
                localStorage.removeItem('syd_equipments_catalog');
              }}
              onBatchImportEquipments={(updatedCatalog) => {
                setEquipments(updatedCatalog);
                localStorage.setItem('syd_equipments_catalog', JSON.stringify(updatedCatalog));
              }}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'licitaciones' && (
            <TendersView
              tenderClients={tenderClients}
              equipments={equipments}
              currentUser={currentUser}
              savedQuotes={savedQuotes}
              contracts={ocContracts}
              salesOrders={salesOrders}
              salesInvoices={salesInvoices}
              onCreateClient={handleCreateTenderClient}
              onCreateTenderClient={handleCreateTenderClient}
              onUpdateClient={(clientId, updates) => {
                setTenderClients((prev) => {
                  const updated = prev.map((tc) => (tc.id === clientId ? { ...tc, ...updates } : tc));
                  localStorage.setItem('syd_tender_clients_v2', JSON.stringify(updated));
                  return updated;
                });
              }}
              onUpdateTenderClient={(clientId, updates) => {
                setTenderClients((prev) => {
                  const updated = prev.map((tc) => (tc.id === clientId ? { ...tc, ...updates } : tc));
                  localStorage.setItem('syd_tender_clients_v2', JSON.stringify(updated));
                  return updated;
                });
              }}
              onDeleteClient={(clientId) => {
                setTenderClients((prev) => {
                  const updated = prev.filter((tc) => tc.id !== clientId);
                  localStorage.setItem('syd_tender_clients_v2', JSON.stringify(updated));
                  return updated;
                });
                deleteTenderClientFromFirestore(clientId).catch(console.warn);
              }}
              onDeleteTenderClient={(clientId) => {
                setTenderClients((prev) => {
                  const updated = prev.filter((tc) => tc.id !== clientId);
                  localStorage.setItem('syd_tender_clients_v2', JSON.stringify(updated));
                  return updated;
                });
                deleteTenderClientFromFirestore(clientId).catch(console.warn);
              }}
              onNavigateToQuote={() => setActiveTab('ventas')}
              onNavigateToCatalog={() => setActiveTab('catalogo')}
              onNavigateToOCTracking={() => setActiveTab('seguimiento_oc')}
              onOpenDocModal={handleOpenNewDocumentModal}
            />
          )}

          {activeTab === 'documentacion' && (
            <DocumentationView
              documents={documents}
              equipments={equipments}
              tenderClients={tenderClients}
              ocContracts={ocContracts}
              salesOrders={salesOrders}
              onUpdateContracts={handleUpdateContracts}
              onOpenNewDocumentModal={handleOpenNewDocumentModal}
              onSaveDocument={handleSaveDocument}
              onDeleteDocument={handleDeleteDocument}
              currentUser={currentUser}
              onNavigateToOCTracking={() => setActiveTab('seguimiento_oc')}
              onNavigateToInvoicing={() => setActiveTab('ordenes_venta')}
            />
          )}

          {activeTab === 'seguimiento_oc' && (
            <OCTrackingView
              contracts={ocContracts}
              onUpdateContracts={handleUpdateContracts}
              tenderClients={tenderClients}
              salesOrders={salesOrders}
              onUpdateSalesOrders={handleUpdateSalesOrders}
              equipments={equipments}
              allDocuments={documents}
              currentUser={currentUser}
              onNavigateToTab={(tab) => setActiveTab(tab as ActiveTab)}
            />
          )}

          {activeTab === 'ordenes_venta' && (
            <SalesOrdersView
              salesOrders={salesOrders}
              onUpdateSalesOrders={handleUpdateSalesOrders}
              salesInvoices={salesInvoices}
              onUpdateSalesInvoices={handleUpdateSalesInvoices}
              contracts={ocContracts}
              onUpdateContracts={handleUpdateContracts}
              savedQuotes={savedQuotes}
              tenderClients={tenderClients}
              equipments={equipments}
              currentUser={currentUser}
              onNavigateToTab={(tab) => setActiveTab(tab as ActiveTab)}
              customLetterheadUrl={customLetterheadUrl}
              initialQuoteToConvert={initialQuoteToConvert}
              onClearInitialQuoteToConvert={handleClearInitialQuoteToConvert}
              initialTenderToConvert={initialTenderToConvert}
              onClearInitialTenderToConvert={handleClearInitialTenderToConvert}
              onGenerateOCTracking={handleGenerateOCTracking}
            />
          )}

          {activeTab === 'gmail_compras' && (
            <GmailPurchasingHubView
              equipments={equipments}
              onAddEquipmentToCatalog={handleSaveEquipment}
              documents={documents}
              onSaveDocument={handleSaveDocument}
              onNavigateToTab={(tab) => setActiveTab(tab as ActiveTab)}
              currentUser={currentUser}
            />
          )}
        </main>
      </div>

      {/* Floating System Alerts Engine */}
      <FloatingAlertsWidget
        alerts={systemAlerts}
        summary={{
          total: systemAlerts.length,
          critica: systemAlerts.filter((a) => a.severity === 'critica').length,
          media: systemAlerts.filter((a) => a.severity === 'media').length,
          informativa: systemAlerts.filter((a) => a.severity === 'informativa').length,
        }}
        onNavigateTab={(tab) => setActiveTab(tab)}
        equipments={equipments}
        onOpenAppUpdates={() => setIsAppUpdatesModalOpen(true)}
      />

      {/* MARA Biomedical AI Assistant */}
      <FloatingChatWidget
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onNavigateTab={(tab) => setActiveTab(tab as ActiveTab)}
        equipmentsCount={equipments.length}
        quotesCount={savedQuotes.length}
        tenderClientsCount={tenderClients.length}
        ocContractsCount={ocContracts.length}
        documentsCount={documents.length}
        alertsCount={systemAlerts.length}
        onOpenEquipmentModal={() => setIsEquipmentModalOpen(true)}
        onOpenDocumentModal={() => setIsDocumentModalOpen(true)}
        onOpenNewQuote={() => handleCreateNewQuote()}
        onOpenUserManagement={() => setIsUserManagementModalOpen(true)}
        onOpenCustomization={() => setIsCustomizationModalOpen(true)}
        onOpenAppUpdates={() => setIsAppUpdatesModalOpen(true)}
        onOpenBackupModal={() => setIsBackupModalOpen(true)}
        onOpenWorkspaceModal={() => setIsGoogleWorkspaceModalOpen(true)}
      />

      {/* Rate Limit Toast Notifications */}
      <RateLimitToast />

      {/* Modals */}
      {isEquipmentModalOpen && (
        <EquipmentModal
          isOpen={isEquipmentModalOpen}
          onClose={() => {
            setIsEquipmentModalOpen(false);
            setEquipmentToEdit(null);
          }}
          onSave={(eq) => {
            handleSaveEquipment(eq);
            setIsEquipmentModalOpen(false);
            setEquipmentToEdit(null);
          }}
          equipmentToEdit={equipmentToEdit}
        />
      )}

      {isDocumentModalOpen && (
        <DocumentModal
          isOpen={isDocumentModalOpen}
          onClose={() => setIsDocumentModalOpen(false)}
          equipments={equipments}
          existingDocuments={documents}
          initialEquipmentId={documentModalProps.equipmentId}
          initialEquipmentData={documentModalProps.equipmentData}
          contractContext={documentModalProps.contractContext}
          initialDocType={documentModalProps.docType}
          onSaveDocument={(doc) => {
            handleSaveDocument(doc);
            setIsDocumentModalOpen(false);
          }}
        />
      )}

      {isCustomizationModalOpen && (
        <CustomizationModal
          isOpen={isCustomizationModalOpen}
          onClose={() => setIsCustomizationModalOpen(false)}
          currentTheme={themeSettings}
          onThemeUpdated={(newTheme) => setThemeSettings(newTheme)}
          currentUser={currentUser}
          standbyTimeoutMinutes={timeoutMinutes}
          onStandbyTimeoutChange={setTimeoutMinutes}
        />
      )}

      {isBackupModalOpen && (
        <BackupModal
          isOpen={isBackupModalOpen}
          onClose={() => setIsBackupModalOpen(false)}
          quotes={savedQuotes}
          equipments={equipments}
          tenderProjects={tenderClients}
          ocContracts={ocContracts}
          salesOrders={salesOrders}
          salesInvoices={salesInvoices}
          documents={documents}
          users={usersList}
          themeSettings={themeSettings}
          currentUser={currentUser}
          onRestoreCallbacks={{
            onQuotesRestored: (q) => setSavedQuotes(q),
            onEquipmentsRestored: (e) => setEquipments(e),
            onTendersRestored: (t) => setTenderClients(t),
            onOCContractsRestored: (c) => setOcContracts(c),
            onSalesOrdersRestored: (so) => setSalesOrders(so),
            onSalesInvoicesRestored: (si) => setSalesInvoices(si),
            onDocumentsRestored: (d) => setDocuments(d),
            onUsersRestored: (u) => setUsersList(u),
            onThemeRestored: (th) => setThemeSettings(th),
          }}
        />
      )}

      {isGoogleWorkspaceModalOpen && (
        <GoogleWorkspaceModal
          isOpen={isGoogleWorkspaceModalOpen}
          onClose={() => setIsGoogleWorkspaceModalOpen(false)}
          equipments={equipments}
          quotes={savedQuotes}
          ocContracts={ocContracts}
          salesOrders={salesOrders}
          documents={documents}
          users={usersList}
          themeSettings={themeSettings}
          syncStatus={syncStatus}
          onNavigateToGmail={() => {
            setIsGoogleWorkspaceModalOpen(false);
            setActiveTab('gmail_compras');
          }}
          onNavigateToBackup={() => {
            setIsGoogleWorkspaceModalOpen(false);
            setIsBackupModalOpen(true);
          }}
          onUpdateEntireCatalog={(updated) => {
            setEquipments(updated);
            try {
              localStorage.setItem('syd_equipments_catalog', JSON.stringify(updated));
            } catch (_) {}
          }}
          onAddEquipments={(newEqs) => {
            setEquipments((prev) => {
              const existingCodes = new Set(prev.map((e) => (e.code || '').trim().toLowerCase()));
              const trulyNew = newEqs.filter((e) => {
                const code = (e.code || '').trim().toLowerCase();
                if (!code || existingCodes.has(code)) return false;
                existingCodes.add(code);
                return true;
              });
              if (trulyNew.length === 0) return prev;
              const updated = [...prev, ...trulyNew];
              try {
                localStorage.setItem('syd_equipments_catalog', JSON.stringify(updated));
              } catch (_) {}
              return updated;
            });
          }}
          onNavigateToCatalog={() => {
            setIsGoogleWorkspaceModalOpen(false);
            setActiveTab('catalogo');
          }}
        />
      )}

      {isAppUpdatesModalOpen && (
        <AppUpdatesModal
          isOpen={isAppUpdatesModalOpen}
          onClose={() => setIsAppUpdatesModalOpen(false)}
        />
      )}

      {isCloudSyncModalOpen && (
        <CloudSyncStatusModal
          isOpen={isCloudSyncModalOpen}
          onClose={() => setIsCloudSyncModalOpen(false)}
          syncStatus={syncStatus}
          stats={{
            quotesCount: savedQuotes.length,
            equipmentsCount: equipments.length,
            tendersCount: tenderClients.length,
            ocContractsCount: ocContracts.length,
            documentsCount: documents.length,
          }}
          onForceSync={() => {
            setSavedQuotes(getSavedQuotes());
            setTenderClients(getStoredTenders());
            setOcContracts(getStoredOCTrackingContracts());
            setSalesOrders(getStoredSalesOrders());
            setSalesInvoices(getStoredSalesInvoices());
          }}
        />
      )}

      {isUserManagementModalOpen && (
        <UserManagementModal
          isOpen={isUserManagementModalOpen}
          onClose={() => setIsUserManagementModalOpen(false)}
          currentUser={currentUser}
          onUserUpdated={(updated) => {
            setCurrentUser(updated);
            setUsersList((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
          }}
        />
      )}

      {isLoginModalOpen && (
        <LoginModal
          isOpen={isLoginModalOpen}
          onClose={() => setIsLoginModalOpen(false)}
          onLoginSuccess={(user) => {
            setCurrentUser(user);
            setIsLoginModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
