import React, { useState, useEffect, useRef } from 'react';
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
import { AdminSQLModal } from './components/modals/AdminSQLModal';
import { EquipmentModal } from './components/modals/EquipmentModal';
import { DocumentModal } from './components/modals/DocumentModal';
import { PrintModal } from './components/modals/PrintModal';
import { LoginModal } from './components/modals/LoginModal';
import { SuspensionLockScreen } from './components/modals/SuspensionLockScreen';
import { StandbyScreen } from './components/modals/StandbyScreen';
import { useIdleStandby } from './hooks/useIdleStandby';
import { UserManagementModal } from './components/modals/UserManagementModal';
import { CustomizationModal } from './components/modals/CustomizationModal';
import { AppUpdatesModal } from './components/modals/AppUpdatesModal';
import { AppUpdateBanner } from './components/common/AppUpdateBanner';
import { BackupModal } from './components/modals/BackupModal';
import { GoogleWorkspaceModal } from './components/modals/GoogleWorkspaceModal';
import { FloatingChatWidget } from './components/chat/FloatingChatWidget';
import { WorkflowPipelineGuide } from './components/common/WorkflowPipelineGuide';
import confetti from 'canvas-confetti';
import { Sparkles, ArrowRight, Bell, X as CloseIcon } from 'lucide-react';
import {
  INITIAL_EQUIPMENTS,
  INITIAL_QUOTE_HEADER,
  INITIAL_DOCUMENTS,
  INITIAL_TENDER_CLIENTS,
  MARGIN_LISTS,
} from './data/initialData';
import { getStoredAuthUser, setStoredAuthUser, updateStoredUserAccount, getStoredUsers, sanitizeUserAccounts } from './data/authData';
import {
  QuoteHeader,
  QuoteItem,
  MarginListKey,
  MedicalEquipment,
  TenderClientProject,
  TenderHeader,
  TenderItem,
  TechnicalDocument,
  TechnicalRequirement,
  SavedQuote,
  AuthUser,
  StoredUserAccount,
  ThemeSettings,
  OCTrackingContract,
  OCStatus,
  SalesOrderRecord,
  SalesInvoiceRecord,
} from './types';
import { getTodayDateCode, getFormattedQuoteNumber, incrementConsecutive, getFormattedSpanishDate, getNextDailyQuoteNumber } from './utils/quoteConsecutive';
import {
  getSavedQuotes,
  saveOrUpdateQuote,
  updateQuoteStatus,
  deleteSavedQuote,
  duplicateSavedQuote,
} from './utils/quoteStorage';
import {
  isQuoteDeleted,
  markQuoteAsDeleted,
  unmarkQuoteAsDeleted,
  isEquipmentDeleted,
  markEquipmentAsDeleted,
  unmarkEquipmentAsDeleted,
  isTenderDeleted,
  markTenderAsDeleted,
  unmarkTenderAsDeleted,
  isContractDeleted,
  markContractAsDeleted,
  unmarkContractAsDeleted,
  isDocumentDeleted,
  markDocumentAsDeleted,
  unmarkDocumentAsDeleted,
  isSalesOrderDeleted,
  markSalesOrderAsDeleted,
  unmarkSalesOrderAsDeleted,
  isSalesInvoiceDeleted,
  markSalesInvoiceAsDeleted,
  unmarkSalesInvoiceAsDeleted,
} from './utils/tombstones';
import {
  getStoredOCTrackingContracts,
  saveStoredOCTrackingContracts,
  syncAwardedTendersToOCTracking,
  syncApprovedQuoteToOCTracking,
  deduplicateOCTrackingContracts,
  checkOCItemAlert,
  autoRegisterSuppliersFromEquipments,
} from './utils/ocTrackingStorage';
import {
  getStoredSalesOrders,
  getStoredSalesInvoices,
  saveStoredSalesOrders,
  saveStoredSalesInvoices,
  deduplicateSalesOrders,
  createOCTrackingContractFromSalesOrder,
  createSalesOrderFromTenderProject,
  createSalesOrderFromOCTrackingContract,
  createTenderProjectFromQuote,
} from './utils/salesOrdersStorage';
import {
  getStoredThemeSettings,
  applyThemeToDOM,
  saveStoredThemeSettings,
} from './utils/themeStorage';
import { getOfficialSyDLetterheadDataUrl } from './utils/sydDefaultLetterhead';
import { getGenericSpecificationsForEquipment, getLiveDraftingAdvice } from './utils/specOptimizer';
import { syncTenderItemToCatalog, batchSyncTenderItemsToCatalog } from './utils/catalogSyncUtils';
import { normalizeClean } from './utils/formatters';
import { computeSystemAlerts } from './utils/alertNotificationEngine';
import { FloatingAlertsWidget } from './components/alerts/FloatingAlertsWidget';
import {
  subscribeToAppVersionUpdates,
} from './utils/versionCheck';
import {
  subscribeToRealtimeDatabase,
  saveQuoteToFirestore,
  broadcastLocalDataSync,
  saveEquipmentsBatchToFirestore,
  saveSingleEquipmentToFirestore,
  saveSingleTenderClientToFirestore,
  saveSingleOCTrackingContractToFirestore,
  saveSingleTechnicalDocumentToFirestore,
  saveTenderClientsToFirestore,
  saveTechnicalDocumentsToFirestore,
  saveThemeSettingsToFirestore,
  saveLetterheadToFirestore,
  saveOCTrackingContractsToFirestore,
  saveSalesOrdersBatchToFirestore,
  saveSalesInvoicesBatchToFirestore,
  deleteEquipmentFromFirestore,
  clearAllEquipmentsFromFirestore,
  deleteQuoteFromFirestore,
  deleteTenderClientFromFirestore,
  deleteOCTrackingContractFromFirestore,
  deleteTechnicalDocumentFromFirestore,
  performHourlyAutomaticBackup,
  performDailyAutomaticBackup,
  syncDatabaseStateToServer,
  fetchLatestServerBackupState,
  saveCreatedSheetPartToFirestore,
  SyncConnectionStatus,
  getIsSyncingFromRemote,
  isRecentRemoteUpdate,
  getStoredTenders,
} from './services/realtimeSync';
import { CloudSyncStatusModal } from './components/common/CloudSyncStatusModal';
import { RateLimitToast } from './components/common/RateLimitToast';
import { useAutoReloadOnServerUpdate } from './hooks/useAutoReloadOnServerUpdate';
import {
  mergeEquipments,
  mergeQuotes,
  mergeTenders,
  mergeOCContracts,
  mergeDocuments,
  mergeSalesOrders,
  mergeSalesInvoices,
} from './utils/backupRestoreUtils';
import { deduplicateTenderProjects } from './utils/tenderDeduplication';
import { sanitizeEquipmentSuppliers } from './utils/supplierDeduplication';

/**
 * Master financial sanitizer for QuoteItem: guarantees 100% mathematical consistency
 * between unitCostCOP, accessories, multiplier, discount, unitSalePrice, totalCost, and totalSalePrice.
 */
export function sanitizeQuoteItemFinancials(item: QuoteItem, updates: Partial<QuoteItem> = {}): QuoteItem {
  const merged: QuoteItem = { ...item, ...updates };

  const accessories = merged.accessories || [];
  const accessoriesExtraCost = accessories
    .filter((a) => !a.includedInBase)
    .reduce((sum, a) => sum + (Number(a.unitCostCOP) || 0) * (Number(a.quantity) || 1), 0);

  const baseCost = Number(merged.unitCostCOP) || 0;
  const effectiveUnitCost = baseCost + accessoriesExtraCost;

  let multiplier = merged.multiplier;
  if (merged.marginType && merged.marginType !== 'custom') {
    multiplier = MARGIN_LISTS[merged.marginType]?.multiplier || multiplier || 1.5874;
    merged.multiplier = multiplier;
  } else if (merged.marginType === 'custom') {
    if (updates.customFactor !== undefined && updates.customFactor > 0) {
      multiplier = updates.customFactor;
      merged.multiplier = multiplier;
    } else if (merged.customFactor !== undefined && merged.customFactor > 0) {
      multiplier = merged.customFactor;
      merged.multiplier = multiplier;
    } else {
      multiplier = multiplier || 2.0;
      merged.multiplier = multiplier;
    }
  }

  let unitSalePrice = merged.unitSalePrice;
  if (merged.isManualSalePrice) {
    if (updates.unitSalePrice !== undefined) {
      unitSalePrice = updates.unitSalePrice;
    } else if (updates.manualSalePriceCOP !== undefined) {
      unitSalePrice = updates.manualSalePriceCOP;
    } else if (merged.manualSalePriceCOP !== undefined && merged.manualSalePriceCOP > 0) {
      unitSalePrice = merged.manualSalePriceCOP;
    } else {
      unitSalePrice = Number(merged.unitSalePrice) || 0;
    }
    merged.manualSalePriceCOP = unitSalePrice;
    if (effectiveUnitCost > 0) {
      multiplier = parseFloat((unitSalePrice / effectiveUnitCost).toFixed(4));
      merged.multiplier = multiplier;
    }
  } else {
    // Automatic formula mode: calculate unit sale price from cost * multiplier * (1 - discount)
    if (
      updates.unitSalePrice !== undefined &&
      updates.unitCostCOP === undefined &&
      updates.marginType === undefined &&
      updates.customFactor === undefined &&
      updates.multiplier === undefined &&
      updates.discountPercentage === undefined &&
      updates.accessories === undefined
    ) {
      unitSalePrice = updates.unitSalePrice;
    } else {
      const discount = Math.max(0, Math.min(90, Number(merged.discountPercentage) || 0));
      unitSalePrice = Math.round(effectiveUnitCost * (multiplier || 1.5874) * (1 - discount / 100));
    }
  }

  const quantity = Math.max(1, Number(merged.quantity) || 1);
  const totalCost = effectiveUnitCost * quantity;
  const totalSalePrice = unitSalePrice * quantity;

  let normalizedTaxRate = merged.taxRate;
  if (normalizedTaxRate !== undefined && normalizedTaxRate > 1) {
    normalizedTaxRate = normalizedTaxRate / 100;
  }

  return {
    ...merged,
    accessories,
    multiplier,
    unitSalePrice,
    totalCost,
    totalSalePrice,
    quantity,
    taxRate: normalizedTaxRate,
  };
}

export default function App() {
  const { isUpdating, updateMessage } = useAutoReloadOnServerUpdate();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredAuthUser());
  const currentUserRef = useRef<AuthUser | null>(currentUser);
  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Keep currentUser permissions synchronized with local updates
  useEffect(() => {
    const handleUsersUpdated = (e: any) => {
      const users: StoredUserAccount[] = e?.detail || getStoredUsers();
      const currentActive = currentUserRef.current;
      if (currentActive && Array.isArray(users)) {
        const fresh = users.find(
          (u) =>
            u.id === currentActive.id ||
            (u.username && currentActive.username && u.username.toLowerCase() === currentActive.username.toLowerCase())
        );
        if (fresh) {
          const { password, ...safe } = fresh;
          setCurrentUser(safe);
          setStoredAuthUser(safe);
        }
      }
    };
    window.addEventListener('syd_users_updated', handleUsersUpdated);
    return () => window.removeEventListener('syd_users_updated', handleUsersUpdated);
  }, []);

  const [isSuspended, setIsSuspended] = useState<boolean>(false);
  const {
    isStandby,
    timeoutMinutes: standbyTimeoutMinutes,
    setTimeoutMinutes: setStandbyTimeoutMinutes,
    enterStandby,
    wakeUp: handleWakeUpStandby,
  } = useIdleStandby(currentUser);
  const [isUserManagementModalOpen, setIsUserManagementModalOpen] = useState(false);
  const [isCustomizationModalOpen, setIsCustomizationModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isAppUpdatesModalOpen, setIsAppUpdatesModalOpen] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isGoogleWorkspaceModalOpen, setIsGoogleWorkspaceModalOpen] = useState(false);
  const [isAdminSqlModalOpen, setIsAdminSqlModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncConnectionStatus>('connecting');
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(() => getStoredThemeSettings());
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    try {
      const saved = localStorage.getItem('syd_active_tab');
      if (saved) return saved as ActiveTab;
    } catch {}
    return 'inicio';
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>(() => getSavedQuotes());

  // Keep active tab remembered across page reloads
  useEffect(() => {
    try {
      localStorage.setItem('syd_active_tab', activeTab);
    } catch {}
  }, [activeTab]);

  // Listen to open workspace modal
  useEffect(() => {
    const handleOpenWorkspace = () => {
      setIsGoogleWorkspaceModalOpen(true);
    };
    window.addEventListener('syd-open-workspace-modal', handleOpenWorkspace);
    return () => window.removeEventListener('syd-open-workspace-modal', handleOpenWorkspace);
  }, []);

  // Apply theme dynamically to document root on load and on any updates
  useEffect(() => {
    applyThemeToDOM(themeSettings);
  }, [themeSettings]);

  const handleThemeUpdated = (newTheme: ThemeSettings) => {
    setThemeSettings(newTheme);
    applyThemeToDOM(newTheme);
    saveThemeSettingsToFirestore(newTheme).catch((e) => console.error(e));
  };

  // Real-time Cloud Synchronization with Firebase Firestore
  useEffect(() => {
    const unsubVersion = subscribeToAppVersionUpdates();

    const unsubscribe = subscribeToRealtimeDatabase({
      onQuotesChange: (quotes) => {
        if (quotes) {
          setSavedQuotes(quotes);
          try {
            localStorage.setItem('syd_saved_quotes_database_v2', JSON.stringify(quotes));
          } catch (e) {}
        }
      },
      onEquipmentsChange: (eqs) => {
        if (eqs) {
          setEquipments(eqs);
          try {
            localStorage.setItem('syd_equipments_catalog', JSON.stringify(eqs));
          } catch (e) {}
        }
      },
      onTendersChange: (tenders) => {
        if (tenders) {
          const deduped = deduplicateTenderProjects(tenders);
          setTenderClients(deduped);
          try {
            localStorage.setItem('syd_tender_clients_v2', JSON.stringify(deduped));
          } catch (e) {}
        }
      },
      onOCContractsChange: (contracts) => {
        if (contracts) {
          const deduped = deduplicateOCTrackingContracts(contracts);
          setOcContracts(deduped);
          try {
            localStorage.setItem('syd_oc_tracking_contracts_v3', JSON.stringify(deduped));
          } catch (e) {}
        }
      },
      onSalesOrdersChange: (orders) => {
        if (orders) {
          const deduped = deduplicateSalesOrders(orders);
          setSalesOrders(deduped);
          try {
            localStorage.setItem('syd_sales_orders_v1', JSON.stringify(deduped));
          } catch (e) {}
        }
      },
      onSalesInvoicesChange: (invoices) => {
        if (invoices) {
          setSalesInvoices(invoices);
          try {
            localStorage.setItem('syd_sales_invoices_v1', JSON.stringify(invoices));
          } catch (e) {}
        }
      },
      onDocumentsChange: (docs) => {
        if (docs) {
          setDocuments(docs);
          try {
            localStorage.setItem('syd_technical_documents_v3', JSON.stringify(docs));
          } catch (e) {}
        }
      },
      onUsersChange: (users) => {
        if (users && users.length > 0) {
          const { users: cleanUsers } = sanitizeUserAccounts(users);
          try {
            localStorage.setItem('syd_registered_system_users_v4', JSON.stringify(cleanUsers));
            localStorage.setItem('syd_registered_system_users_v3', JSON.stringify(cleanUsers));
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('syd_users_updated', { detail: cleanUsers }));
            }
          } catch (e) {}
          // Only update permissions/profile if this specific window/device is already logged in
          const currentActive = currentUserRef.current;
          if (currentActive) {
            let searchUName = currentActive.username?.toLowerCase();
            if (searchUName === 'papi') searchUName = 'jairo';
            if (searchUName === 'hijo') searchUName = 'fabian';
            const fresh = cleanUsers.find(
              (u) =>
                u.id === currentActive.id ||
                (u.username && u.username.toLowerCase() === searchUName)
            );
            if (fresh) {
              const { password, ...safe } = fresh;
              setCurrentUser(safe);
              setStoredAuthUser(safe);
            }
          }
        }
      },
      onThemeChange: (theme) => {
        if (theme) {
          setThemeSettings(theme);
          applyThemeToDOM(theme);
        }
      },
      onSuppliersChange: (suppliers) => {
        if (suppliers) {
          try {
            localStorage.setItem('syd_suppliers_directory_v1', JSON.stringify(suppliers));
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('syd_suppliers_updated', { detail: suppliers }));
            }
          } catch (e) {}
        }
      },
      onClientsChange: (clients) => {
        if (clients) {
          try {
            localStorage.setItem('syd_clients_directory_v1', JSON.stringify(clients));
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('syd_clients_updated', { detail: clients }));
            }
          } catch (e) {}
        }
      },
      onLetterheadChange: (url) => {
        if (url && url.length > 20) {
          setActiveLetterheadUrl(url);
          try {
            localStorage.setItem('syd_active_letterhead_url', url);
            localStorage.setItem('syd_permanent_default_letterhead', url);
          } catch (e) {}
        }
      },
      onStatusChange: (status) => {
        setSyncStatus(status);
      },
    });

    return () => {
      if (unsubVersion) unsubVersion();
      unsubscribe();
    };
  }, []);

  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setStoredAuthUser(user);
    setIsSuspended(false);
    // User requested: Al iniciar sesión con usuario y contraseña, la app debe abrir siempre en el inicio
    setActiveTab('inicio');
    try {
      localStorage.setItem('syd_active_tab', 'inicio');
    } catch {}
  };

  // Command to suspend application into standby mode
  const handleSuspendApp = () => {
    if (currentUser) {
      enterStandby();
    }
  };

  const handleUnlockApp = (user: AuthUser) => {
    setCurrentUser(user);
    setStoredAuthUser(user);
    setIsSuspended(false);
    handleWakeUpStandby();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setStoredAuthUser(null);
    setIsSuspended(false);
    handleWakeUpStandby();
    setActiveTab('inicio');
    try {
      localStorage.setItem('syd_active_tab', 'inicio');
    } catch {}
  };

  const handleUpdateCurrentUserPhoto = (photoUrl: string) => {
    if (!currentUser) return;
    const updatedUser: AuthUser = { ...currentUser, avatarPhotoUrl: photoUrl };
    setCurrentUser(updatedUser);
    setStoredAuthUser(updatedUser);
    updateStoredUserAccount(currentUser.id, { avatarPhotoUrl: photoUrl });
  };

  // Global keyboard shortcut listener: Ctrl+L, Cmd+L or Alt+S to suspend application
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.ctrlKey && e.key.toLowerCase() === 'l') ||
        (e.metaKey && e.key.toLowerCase() === 'l') ||
        (e.altKey && e.key.toLowerCase() === 's')
      ) {
        e.preventDefault();
        handleSuspendApp();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentUser]);

  // Active quote editing session state (null when creating a brand-new quote, ID when editing an existing quote)
  const [editingQuoteId, setEditingQuoteId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('syd_editing_quote_id') || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      if (editingQuoteId) {
        localStorage.setItem('syd_editing_quote_id', editingQuoteId);
      } else {
        localStorage.removeItem('syd_editing_quote_id');
      }
    } catch {}
  }, [editingQuoteId]);

  const [quoteHeader, setQuoteHeader] = useState<QuoteHeader>(() => {
    try {
      const savedDraft = localStorage.getItem('syd_working_quote_header_draft');
      if (savedDraft) {
        const parsed = JSON.parse(savedDraft);
        if (parsed && typeof parsed === 'object' && parsed.clientName && parsed.clientName !== 'NOMBRE DEL CLIENTE O INSTITUCIÓN') {
          return {
            ...INITIAL_QUOTE_HEADER,
            ...parsed,
          };
        }
      }
    } catch {}
    const initialSavedQuotes = getSavedQuotes();
    const currentNum = getNextDailyQuoteNumber(initialSavedQuotes);
    return {
      ...INITIAL_QUOTE_HEADER,
      city: 'Barranquilla',
      date: getFormattedSpanishDate('Barranquilla'),
      quoteNumber: currentNum,
    };
  });
  
  // Clean initial state with draft auto-recovery so items are never lost on reload
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>(() => {
    try {
      const savedItems = localStorage.getItem('syd_working_quote_items_draft');
      if (savedItems) {
        const parsed = JSON.parse(savedItems);
        if (Array.isArray(parsed)) {
          return parsed.map((it) => sanitizeQuoteItemFinancials(it));
        }
      }
    } catch {}
    return [];
  });

  // Auto-persist working quote draft to prevent accidental data loss on refresh or close
  useEffect(() => {
    try {
      localStorage.setItem('syd_working_quote_header_draft', JSON.stringify(quoteHeader));
    } catch {}
  }, [quoteHeader]);

  useEffect(() => {
    try {
      localStorage.setItem('syd_working_quote_items_draft', JSON.stringify(quoteItems));
    } catch {}
  }, [quoteItems]);

  // Active Commercial Quote Letterhead: clean by default; user can manually place their centered letterhead
  const [activeLetterheadUrl, setActiveLetterheadUrl] = useState<string | null>(() => {
    try {
      const savedManual = localStorage.getItem('syd_custom_manual_letterhead');
      if (savedManual && savedManual.length > 20 && savedManual !== 'none') {
        return savedManual;
      }
      const saved = localStorage.getItem('syd_active_letterhead_url');
      if (saved && saved.length > 20 && saved !== 'none' && !saved.includes('OFICIAL SYD COLOMBIA')) {
        return saved;
      }
    } catch {}
    return null;
  });

  // Remove any legacy auto-injected official letterhead so quotation sheet is clean and in blank
  useEffect(() => {
    try {
      const saved = localStorage.getItem('syd_active_letterhead_url');
      if (saved && (saved.includes('OFICIAL SYD COLOMBIA') || saved.startsWith('data:image/svg+xml') || saved === 'default')) {
        localStorage.setItem('syd_active_letterhead_url', 'none');
        localStorage.removeItem('syd_permanent_default_letterhead');
        localStorage.removeItem('syd_custom_manual_letterhead');
        setActiveLetterheadUrl(null);
      }
    } catch {}
  }, []);

  const [activeMarginSettings, setActiveMarginSettings] = useState<{ subirBajar: number; izqDer: number; tableScale: number }>(() => {
    try {
      const saved = localStorage.getItem('syd_active_margin_settings');
      if (saved) return JSON.parse(saved);
    } catch {}
    return { subirBajar: 50, izqDer: 78, tableScale: 85 };
  });

  const handleUpdateLetterhead = (url: string | null) => {
    setActiveLetterheadUrl(url);
    try {
      if (url) {
        localStorage.setItem('syd_active_letterhead_url', url);
        localStorage.setItem('syd_permanent_default_letterhead', url);
        saveLetterheadToFirestore(url).catch((e) => console.error(e));
      } else {
        // Mark as explicitly none so it doesn't auto-reset until user restores it
        localStorage.setItem('syd_active_letterhead_url', 'none');
        localStorage.removeItem('syd_permanent_default_letterhead');
        saveLetterheadToFirestore(null).catch((e) => console.error(e));
      }
    } catch (e) {
      console.error('Failed to save active letterhead', e);
    }
  };

  const handleUpdateMarginSettings = (settings: { subirBajar: number; izqDer: number; tableScale: number }) => {
    setActiveMarginSettings(settings);
    try {
      localStorage.setItem('syd_active_margin_settings', JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save active margin settings', e);
    }
  };

  // Equipments Catalog State
  const [equipments, setEquipments] = useState<MedicalEquipment[]>(() => {
    try {
      if (localStorage.getItem('syd_catalog_cleared_by_admin') === 'true') {
        return [];
      }
      const saved = localStorage.getItem('syd_equipments_catalog');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error(e);
    }
    return INITIAL_EQUIPMENTS;
  });

  // Client-based Tenders/Projects (Ventana 4)
  const [tenderClients, setTenderClients] = useState<TenderClientProject[]>(() => {
    try {
      const saved = localStorage.getItem('syd_tender_clients_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return deduplicateTenderProjects(parsed).filter(
            (t) => t && t.id && !isTenderDeleted(t.id, t.header?.processNumber)
          );
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  const [activeTenderClientId, setActiveTenderClientId] = useState<string>(() => {
    return tenderClients[0]?.id || '';
  });

  const [documents, setDocuments] = useState<TechnicalDocument[]>(() => {
    const saved = localStorage.getItem('syd_technical_documents_v3');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading stored technical documents:', e);
      }
    }
    return INITIAL_DOCUMENTS;
  });

  // OC Tracking & Logistics State (Window 6 - Seguimiento de OC)
  const [ocContracts, setOcContracts] = useState<OCTrackingContract[]>(() => getStoredOCTrackingContracts());

  // Sales Orders & Invoices State (Window 7 - Órdenes de Venta y Facturación)
  const [salesOrders, setSalesOrders] = useState<SalesOrderRecord[]>(() => {
    const stored = getStoredSalesOrders();
    const deduped = deduplicateSalesOrders(stored);
    if (deduped.length !== stored.length) {
      saveStoredSalesOrders(deduped);
    }
    return deduped;
  });
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoiceRecord[]>(() => getStoredSalesInvoices());
  const [tenderToConvertInOV, setTenderToConvertInOV] = useState<TenderClientProject | null>(null);
  const [quoteToConvertInOV, setQuoteToConvertInOV] = useState<SavedQuote | null>(null);

  // Save local copy to localStorage synchronously (Instant offline cache & reload stability)
  useEffect(() => {
    try {
      localStorage.setItem('syd_equipments_catalog', JSON.stringify(equipments));
    } catch (e) {}
  }, [equipments]);

  useEffect(() => {
    try {
      localStorage.setItem('syd_tender_clients_v2', JSON.stringify(tenderClients));
    } catch (e) {}
  }, [tenderClients]);

  useEffect(() => {
    try {
      localStorage.setItem('syd_technical_documents_v3', JSON.stringify(documents));
    } catch (e) {}
  }, [documents]);

  useEffect(() => {
    try {
      localStorage.setItem('syd_oc_tracking_contracts_v3', JSON.stringify(ocContracts));
    } catch (e) {}
  }, [ocContracts]);

  useEffect(() => {
    try {
      localStorage.setItem('syd_sales_orders_v1', JSON.stringify(salesOrders));
    } catch (e) {}
  }, [salesOrders]);

  useEffect(() => {
    try {
      localStorage.setItem('syd_sales_invoices_v1', JSON.stringify(salesInvoices));
    } catch (e) {}
  }, [salesInvoices]);

  // Listen for storage or cross-component Tenders, OC and Sales Orders updates across tabs and installed PWA
  useEffect(() => {
    const handleStorageUpdate = (e?: Event) => {
      const isCustom = e && 'type' in e && (e.type.startsWith('syd-'));
      const eventType = isCustom ? e.type : null;
      const storageKey = e && 'key' in (e as any) ? (e as any).key : null;

      if (eventType === 'syd-tenders-updated' || storageKey === 'syd_tender_clients_v2') {
        const freshTenders = getStoredTenders().filter((t) => t && !isTenderDeleted(t.id));
        setTenderClients(freshTenders);
      }
      if (eventType === 'syd-oc-tracking-updated' || storageKey === 'syd_oc_tracking_contracts_v3') {
        const freshOC = deduplicateOCTrackingContracts(getStoredOCTrackingContracts().filter((c) => !isContractDeleted(c.id)));
        setOcContracts(freshOC);
      }
      if (eventType === 'syd-sales-orders-updated' || storageKey === 'syd_sales_orders_v1') {
        const freshSO = getStoredSalesOrders().filter(
          (o) => !isSalesOrderDeleted(o.id, o.salesOrderNumber, o.tenderClientId, o.contractId)
        );
        setSalesOrders(freshSO);
      }
      if (eventType === 'syd-sales-invoices-updated' || storageKey === 'syd_sales_invoices_v1') {
        const freshSI = getStoredSalesInvoices().filter(
          (i) => !isSalesInvoiceDeleted(i.id, i.invoiceNumber, i.salesOrderId)
        );
        setSalesInvoices(freshSI);
      }
    };
    window.addEventListener('syd-tenders-updated', handleStorageUpdate);
    window.addEventListener('syd-oc-tracking-updated', handleStorageUpdate);
    window.addEventListener('syd-sales-orders-updated', handleStorageUpdate);
    window.addEventListener('storage', handleStorageUpdate);
    return () => {
      window.removeEventListener('syd-tenders-updated', handleStorageUpdate);
      window.removeEventListener('syd-oc-tracking-updated', handleStorageUpdate);
      window.removeEventListener('syd-sales-orders-updated', handleStorageUpdate);
      window.removeEventListener('storage', handleStorageUpdate);
    };
  }, []);

  // Ensure sales orders state stays clean and deduplicated without spamming auto-generated rows
  useEffect(() => {
    const deduped = deduplicateSalesOrders(salesOrders);
    if (deduped.length !== salesOrders.length) {
      setSalesOrders(deduped);
      saveStoredSalesOrders(deduped);
      saveSalesOrdersBatchToFirestore(deduped).catch(() => {});
    }
  }, [salesOrders]);

  // Immediate hydration check from server disk cache on mount (vital for newly opened PWAs and fresh tabs)
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const serverState = await fetchLatestServerBackupState();
        if (!isMounted || !serverState) return;

        if (serverState.tenderProjects && serverState.tenderProjects.length > 0) {
          const freshTenders = deduplicateTenderProjects(serverState.tenderProjects.filter((t: any) => t && t.id && !isTenderDeleted(t.id)));
          if (freshTenders.length > 0) {
            setTenderClients((prev) => {
              const merged = deduplicateTenderProjects([...prev, ...freshTenders]);
              try {
                localStorage.setItem('syd_tender_clients_v2', JSON.stringify(merged));
              } catch (e) {}
              return merged;
            });
          }
        }
        if (serverState.ocContracts && serverState.ocContracts.length > 0) {
          const freshOC = deduplicateOCTrackingContracts(serverState.ocContracts.filter((c: any) => c && c.id && !isContractDeleted(c.id)));
          if (freshOC.length > 0) {
            setOcContracts((prev) => {
              const merged = deduplicateOCTrackingContracts([...prev, ...freshOC]);
              try {
                localStorage.setItem('syd_oc_tracking_contracts_v3', JSON.stringify(merged));
              } catch (e) {}
              return merged;
            });
          }
        }
        if (serverState.salesOrders && serverState.salesOrders.length > 0) {
          const freshOrders = deduplicateSalesOrders(serverState.salesOrders.filter((o: any) => o && o.id && !isSalesOrderDeleted(o.id, o.salesOrderNumber, o.tenderClientId, o.contractId)));
          if (freshOrders.length > 0) {
            setSalesOrders((prev) => {
              const merged = deduplicateSalesOrders([...prev, ...freshOrders]);
              try {
                localStorage.setItem('syd_sales_orders_v1', JSON.stringify(merged));
              } catch (e) {}
              return merged;
            });
          }
        }
        if (serverState.salesInvoices && serverState.salesInvoices.length > 0) {
          const freshInvoices = serverState.salesInvoices.filter((i: any) => i && i.id && !isSalesInvoiceDeleted(i.id, i.invoiceNumber, i.salesOrderId));
          if (freshInvoices.length > 0) {
            setSalesInvoices((prev) => {
              const existingIds = new Set(prev.map((i) => i.id));
              const combined = [...prev, ...freshInvoices.filter((i: any) => !existingIds.has(i.id))];
              try {
                localStorage.setItem('syd_sales_invoices_v1', JSON.stringify(combined));
              } catch (e) {}
              return combined;
            });
          }
        }
        if (serverState.quotes && serverState.quotes.length > 0 && savedQuotes.length === 0) {
          const freshQuotes = serverState.quotes.filter((q: any) => q && q.id && !isQuoteDeleted(q.id, q.quoteNumber));
          if (freshQuotes.length > 0) {
            setSavedQuotes(freshQuotes);
            try {
              localStorage.setItem('syd_saved_quotes_database_v2', JSON.stringify(freshQuotes));
            } catch (e) {}
          }
        }
      } catch (err) {
        console.debug('Startup server hydration error:', err);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Google Drive new parts real-time detection listener
  const [detectedPartsUpdateVer, setDetectedPartsUpdateVer] = useState(0);
  const [newPartDriveToast, setNewPartDriveToast] = useState<{ count: number; name: string; code: string } | null>(null);

  useEffect(() => {
    const handlePartsUpdated = () => {
      setDetectedPartsUpdateVer((v) => v + 1);
    };
    const handleNewPart = (e: any) => {
      setDetectedPartsUpdateVer((v) => v + 1);
      const parts = e.detail?.parts;
      if (Array.isArray(parts) && parts.length > 0) {
        setNewPartDriveToast({
          count: parts.length,
          name: parts[0].name,
          code: parts[0].code,
        });
      }
    };
    window.addEventListener('syd-detected-sheet-parts-updated', handlePartsUpdated);
    window.addEventListener('syd-new-part-detected-notification', handleNewPart);
    return () => {
      window.removeEventListener('syd-detected-sheet-parts-updated', handlePartsUpdated);
      window.removeEventListener('syd-new-part-detected-notification', handleNewPart);
    };
  }, []);

  // Centralized System Alerts (Prioritized by Critical, Medium, Informative)
  const systemAlertsData = React.useMemo(() => {
    return computeSystemAlerts({
      equipments,
      ocContracts,
      tenderClients,
      savedQuotes,
      salesOrders,
    });
  }, [equipments, ocContracts, tenderClients, savedQuotes, salesOrders, detectedPartsUpdateVer]);

  // Continuous Server State Sync to Disk Snapshot (Debounced 1200ms to prevent high-frequency write saturation)
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      // Do not sync back to server if the update originated from a remote Firestore snapshot or SSE event
      if (getIsSyncingFromRemote() || isRecentRemoteUpdate(2000)) {
        return;
      }
      if (equipments.length > 0 || savedQuotes.length > 0 || tenderClients.length > 0) {
        const currentUsers = getStoredUsers();
        syncDatabaseStateToServer({
          equipments,
          quotes: savedQuotes,
          tenders: tenderClients,
          contracts: ocContracts,
          salesOrders,
          salesInvoices,
          documents,
          users: currentUsers,
        });
      }
    }, 1200);

    return () => clearTimeout(debounceTimer);
  }, [equipments, savedQuotes, tenderClients, ocContracts, salesOrders, salesInvoices, documents]);

  // Automatic Hourly Backup Email Dispatch (auxlineadiagnostica@syd.com.co & eljemb22@gmail.com)
  useEffect(() => {
    const runHourlyBackupCheck = () => {
      if (equipments.length > 0 || savedQuotes.length > 0 || tenderClients.length > 0) {
        const currentUsers = getStoredUsers();
        const savedRecipients = localStorage.getItem('syd_backup_recipient_emails') || 'auxlineadiagnostica@syd.com.co, eljemb22@gmail.com';
        const parsedRecipients = savedRecipients
          .split(/[,;\s]+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 3 && s.includes('@'));

        performHourlyAutomaticBackup(
          equipments,
          savedQuotes,
          tenderClients,
          ocContracts,
          documents,
          currentUsers,
          salesOrders,
          salesInvoices,
          parsedRecipients.length > 0 ? parsedRecipients : ['auxlineadiagnostica@syd.com.co', 'eljemb22@gmail.com'],
          false
        ).then((res) => {
          if (res.success) {
            console.log('[Automatic Hourly Backup]', res.message);
          }
        });
      }
    };

    // Initial check 5s after mount
    const initialTimer = setTimeout(runHourlyBackupCheck, 5000);

    // Periodic check every 15 minutes to ensure no hour window is missed
    const intervalTimer = setInterval(runHourlyBackupCheck, 15 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [equipments.length, savedQuotes.length, tenderClients.length, ocContracts.length, salesOrders.length, salesInvoices.length, documents.length]);

  // Modals state
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<MedicalEquipment | null>(null);
  const [isDocumentModalOpen, setIsDocumentModalOpen] = useState(false);
  const [documentModalParams, setDocumentModalParams] = useState<{
    equipmentId?: string;
    docType?: string;
  }>({});
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  const handleOpenDocumentModal = (equipmentId?: string, docType?: string) => {
    setDocumentModalParams({ equipmentId, docType });
    setIsDocumentModalOpen(true);
  };

  // Calculated active quote values
  const activeQuoteSubtotal = quoteItems.reduce((acc, it) => acc + it.totalSalePrice, 0);
  const activeQuoteIVA = quoteItems.reduce((acc, it) => {
    const rate = it.taxExempt ? 0 : (it.taxRate !== undefined ? it.taxRate : quoteHeader.taxRate);
    return acc + Math.round(it.totalSalePrice * rate);
  }, 0);
  const activeQuoteTotal = activeQuoteSubtotal + activeQuoteIVA;

  // Handlers for Quote Management & Storage
  const handleSaveQuote = (
    customLetterheadUrl: string | null,
    marginSettings: { subirBajar: number; izqDer: number; tableScale: number },
    targetQuoteId?: string
  ) => {
    const idToUpdate = targetQuoteId || editingQuoteId || undefined;
    const saved = saveOrUpdateQuote(
      quoteHeader,
      quoteItems,
      'Borrador',
      customLetterheadUrl,
      marginSettings,
      idToUpdate
    );
    const updatedQuotes = getSavedQuotes();
    setSavedQuotes(updatedQuotes);

    // 1. Immediately push to Firestore cloud database so other devices/windows see it in real-time
    saveQuoteToFirestore(saved).catch(() => {});

    // 2. Immediately broadcast across open tabs/windows via BroadcastChannel
    broadcastLocalDataSync({ type: 'QUOTES_SYNC', quotes: updatedQuotes });

    // 3. Instant sync to server backup snapshot so quotes are never lost on reload or session close
    syncDatabaseStateToServer({
      equipments,
      quotes: updatedQuotes,
      tenders: tenderClients,
      contracts: ocContracts,
      salesOrders,
      salesInvoices,
      documents,
    }).catch(() => {});

    return saved;
  };

  const handleLoadQuoteIntoEditor = (quote: SavedQuote) => {
    setEditingQuoteId(quote.id);
    try {
      localStorage.setItem('syd_editing_quote_id', quote.id);
    } catch {}

    setQuoteHeader({
      quoteNumber: quote.quoteNumber,
      clientName: quote.clientName,
      nit: quote.nit,
      contactPerson: quote.contactPerson,
      contactEmail: quote.contactEmail,
      contactPhone: quote.contactPhone,
      city: quote.city,
      date: quote.date,
      validityDays: quote.validityDays,
      paymentTerms: quote.paymentTerms,
      deliveryTime: quote.deliveryTime,
      deliveryPlace: quote.deliveryPlace,
      warrantyTerms: quote.warrantyTerms,
      trainingTerms: quote.trainingTerms,
      taxRate: quote.taxRate,
      advisorName: quote.advisorName,
      advisorRole: quote.advisorRole,
      advisorPhone: quote.advisorPhone,
      advisorEmail: quote.advisorEmail,
      notes: quote.notes,
    });
    setQuoteItems(quote.items.map((it) => sanitizeQuoteItemFinancials(it)));
    if (quote.letterheadUrl) {
      handleUpdateLetterhead(quote.letterheadUrl);
    }
    if (quote.marginSettings) {
      handleUpdateMarginSettings(quote.marginSettings);
    }
    setActiveTab('ventas');
  };

  const handleCreateNewQuote = () => {
    setEditingQuoteId(null);
    try {
      localStorage.removeItem('syd_editing_quote_id');
      localStorage.removeItem('syd_working_quote_header_draft');
      localStorage.removeItem('syd_working_quote_items_draft');
    } catch {}

    const currentSavedQuotes = getSavedQuotes();
    const nextFormatted = getNextDailyQuoteNumber(currentSavedQuotes);
    setQuoteHeader({
      ...INITIAL_QUOTE_HEADER,
      city: 'Barranquilla',
      quoteNumber: nextFormatted,
      date: getFormattedSpanishDate('Barranquilla'),
      validityDays: 15,
      deliveryTime: 'Inmediata / 3 a 5 días hábiles',
    });
    setQuoteItems([]);
    setActiveTab('ventas');
  };

  const handleUpdateQuoteStatusInDb = async (quoteId: string, newStatus: any) => {
    updateQuoteStatus(quoteId, newStatus);
    const updatedQuotes = getSavedQuotes();
    setSavedQuotes(updatedQuotes);
    const updatedQuote = updatedQuotes.find((q) => q.id === quoteId);
    if (updatedQuote) {
      await saveQuoteToFirestore(updatedQuote).catch(() => {});
    }
  };

  const handleDeleteSavedQuoteInDb = async (quoteId: string) => {
    const target = savedQuotes.find((q) => q.id === quoteId);
    markQuoteAsDeleted(quoteId, target?.quoteNumber);
    deleteSavedQuote(quoteId);
    const updatedQuotes = getSavedQuotes();
    setSavedQuotes(updatedQuotes);

    try {
      await deleteQuoteFromFirestore(quoteId, target?.quoteNumber);
    } catch (e) {
      console.error('Error deleting quote from Firestore:', e);
    }

    syncDatabaseStateToServer({
      equipments,
      quotes: updatedQuotes,
      tenders: tenderClients,
      contracts: ocContracts,
      salesOrders,
      salesInvoices,
      documents,
    }).catch(() => {});
  };

  const handleDuplicateSavedQuoteInDb = async (quoteId: string) => {
    const dup = duplicateSavedQuote(quoteId);
    if (dup) {
      setSavedQuotes(getSavedQuotes());
      await saveQuoteToFirestore(dup).catch(() => {});
    }
  };

  // Handlers for Quote Header & Items
  const handleUpdateHeader = (updates: Partial<QuoteHeader>) => {
    setQuoteHeader((prev) => ({ ...prev, ...updates }));
  };

  const handleUpdateEquipmentBaseCost = (
    equipmentIdOrCodeOrName: string,
    newCost: number,
    brand?: string,
    model?: string
  ) => {
    if (!newCost || newCost <= 0) return;
    setEquipments((prev) => {
      let matched = false;
      let targetEqToSync: MedicalEquipment | null = null;
      const updated = prev.map((eq) => {
        const matchesIdOrCode = eq.id === equipmentIdOrCodeOrName || eq.code === equipmentIdOrCodeOrName;
        const matchesName =
          equipmentIdOrCodeOrName &&
          eq.name.trim().toLowerCase() === equipmentIdOrCodeOrName.trim().toLowerCase();
        const matchesBrandModel =
          brand &&
          model &&
          eq.brand.trim().toLowerCase() === brand.trim().toLowerCase() &&
          eq.model.trim().toLowerCase() === model.trim().toLowerCase();

        if (matchesIdOrCode || matchesName || matchesBrandModel) {
          matched = true;
          const updatedEq = { ...eq, baseCostCOP: newCost };
          targetEqToSync = updatedEq;
          return updatedEq;
        }
        return eq;
      });

      if (!matched && equipmentIdOrCodeOrName && equipmentIdOrCodeOrName.trim().length > 0) {
        const newEq: MedicalEquipment = {
          id: `eq-oc-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          code: `EQ-${(prev.length + 1).toString().padStart(3, '0')}`,
          name: equipmentIdOrCodeOrName,
          brand: brand || 'SYD Biomedical',
          model: model || 'General',
          originCountry: 'Colombia',
          category: 'Diagnóstico',
          description: 'Equipo registrado desde Seguimiento de OC',
          baseCostCOP: newCost,
          taxExempt: false,
          taxRate: 19,
          defaultMarginList: 'L4',
          warrantyMonths: 24,
          invimaRecordNumber: 'En Trámite',
          standardAccessories: [],
          technicalSpecs: [],
          hasDocSheet: false,
          hasInvimaDoc: false,
          hasManual: false,
          hasQualityCert: false,
        };
        saveSingleEquipmentToFirestore(newEq).catch(() => {});
        return [newEq, ...prev];
      }

      if (targetEqToSync) {
        saveSingleEquipmentToFirestore(targetEqToSync).catch(() => {});
      }

      return updated;
    });
  };

  const handleUpdateQuoteItem = (id: string, updates: Partial<QuoteItem>) => {
    setQuoteItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const sanitized = sanitizeQuoteItemFinancials(item, updates);

          if (updates.unitCostCOP !== undefined) {
            handleUpdateEquipmentBaseCost(sanitized.equipmentId || sanitized.code, updates.unitCostCOP);
          }

          return sanitized;
        }
        return item;
      })
    );
  };

  const handleDeleteQuoteItem = (id: string) => {
    setQuoteItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddItemFromEquipment = (eq: MedicalEquipment, marginCode: MarginListKey = 'L4') => {
    const rawAccessories = (eq.standardAccessories || []).map((a, idx) => ({
      id: `acc-${Date.now()}-${idx}`,
      name: a.name,
      quantity: 1,
      unitCostCOP: a.costCOP || 0,
      includedInBase: a.included,
    }));

    const templateItem: QuoteItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      equipmentId: eq.id,
      code: eq.code,
      name: eq.name,
      brand: eq.brand,
      model: eq.model,
      quantity: 1,
      unitCostCOP: eq.baseCostCOP || 0,
      marginType: marginCode,
      customFactor: MARGIN_LISTS[marginCode]?.multiplier || 1.5874,
      multiplier: MARGIN_LISTS[marginCode]?.multiplier || 1.5874,
      unitSalePrice: 0,
      totalCost: 0,
      totalSalePrice: 0,
      discountPercentage: 0,
      warrantyMonths: eq.warrantyMonths || 12,
      taxExempt: !!eq.taxExempt,
      taxRate: eq.taxRate,
      notes: 'Equipo nuevo de fábrica con garantía total.',
      showSpecsInQuote: true,
      accessories: rawAccessories,
    };

    const sanitized = sanitizeQuoteItemFinancials(templateItem);
    setQuoteItems((prev) => [...prev, sanitized]);
  };

  // --- Handlers for Client-Based Tenders (Ventana 4) ---
  const handleCreateTenderClient = (clientData: {
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
  }) => {
    const rawBudget =
      clientData.budgetCOP !== undefined
        ? Number(clientData.budgetCOP)
        : clientData.header?.budgetCOP !== undefined
        ? Number(clientData.header.budgetCOP)
        : 0;

    const newClient: TenderClientProject = {
      id: `cli-tend-${Date.now()}`,
      clientName: clientData.clientName,
      nit: clientData.nit || clientData.header?.nit || '',
      status: clientData.status || 'En Preparación',
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      header: {
        entityName: clientData.header?.entityName || clientData.clientName,
        nit: clientData.nit || clientData.header?.nit || '',
        processNumber: clientData.processNumber || clientData.header?.processNumber || `LP-${new Date().getFullYear()}-001`,
        processType: clientData.processType || clientData.header?.processType || 'Licitación Pública',
        contractObject: clientData.contractObject || clientData.header?.contractObject || 'ADQUISICIÓN Y SUMINISTRO DE EQUIPOS BIOMÉDICOS',
        openingDate: clientData.openingDate || clientData.header?.openingDate || new Date().toISOString().split('T')[0],
        closingDate: clientData.closingDate || clientData.header?.closingDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        city: clientData.city || clientData.header?.city || 'Bogotá D.C.',
        budgetCOP: rawBudget,
        contactPerson: clientData.contactPerson || clientData.header?.contactPerson || '',
        contactEmail: clientData.header?.contactEmail || '',
        contactPhone: clientData.header?.contactPhone || '',
        executionTerm: clientData.executionTerm || clientData.header?.executionTerm || '',
      },
      items: [],
    };

    unmarkTenderAsDeleted(newClient.id, newClient.header.processNumber);
    setTenderClients((prev) => {
      const merged = deduplicateTenderProjects([newClient, ...prev]);
      try {
        localStorage.setItem('syd_tender_clients_v2', JSON.stringify(merged));
      } catch (_) {}
      return merged;
    });
    setActiveTenderClientId(newClient.id);
    saveSingleTenderClientToFirestore(newClient).catch(() => {});
  };

  const handleBatchCreateTenderClients = (newClients: TenderClientProject[]) => {
    if (newClients.length === 0) return;
    newClients.forEach((c) => unmarkTenderAsDeleted(c.id, c.header?.processNumber));
    setTenderClients((prev) => {
      const merged = deduplicateTenderProjects([...newClients, ...prev]);
      try {
        localStorage.setItem('syd_tender_clients_v2', JSON.stringify(merged));
      } catch (_) {}
      return merged;
    });
    setActiveTenderClientId(newClients[0].id);
    newClients.forEach((c) => saveSingleTenderClientToFirestore(c).catch(() => {}));

    // Sync all equipments to Catalog (Ventana 3)
    const allItems = newClients.flatMap((c) => c.items || []);
    if (allItems.length > 0) {
      handleBatchSyncTenderItemsToCatalog(allItems);
    }
  };

  const handleUpdateTenderClient = (clientId: string, updates: Partial<TenderClientProject>) => {
    unmarkTenderAsDeleted(clientId);
    setTenderClients((prev) => {
      const next = prev.map((c) => {
        if (c.id === clientId) {
          const updated = { ...c, ...updates, updatedAt: new Date().toISOString().split('T')[0] };
          unmarkTenderAsDeleted(updated.id, updated.header?.processNumber);
          saveSingleTenderClientToFirestore(updated).catch(() => {});
          if (updates.status === 'Adjudicada' && c.status !== 'Adjudicada') {
            try {
              confetti({ particleCount: 80, spread: 90, origin: { y: 0.6 } });
            } catch (e) {}
          }
          return updated;
        }
        return c;
      });
      try {
        localStorage.setItem('syd_tender_clients_v2', JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  const handleDeleteTenderClient = async (clientId: string) => {
    const target = tenderClients.find((t) => t.id === clientId);
    const processNum = target?.header?.processNumber;
    markTenderAsDeleted(clientId, processNum);

    const next = tenderClients.filter(
      (c) => c.id !== clientId && (!processNum || c.header?.processNumber !== processNum)
    );
    setTenderClients(next);
    try {
      localStorage.setItem('syd_tender_clients_v2', JSON.stringify(next));
    } catch (e) {}

    // Deselect if active
    setActiveTenderClientId((prevId) => {
      if (prevId === clientId || (target && prevId === target.id)) {
        return next.length > 0 ? next[0].id : '';
      }
      return prevId;
    });

    // Also clean up any linked OC contracts and Sales Orders for this deleted tender
    setOcContracts((prev) => {
      const filtered = prev.filter(
        (c) =>
          c.tenderClientId !== clientId &&
          c.id !== clientId &&
          (!processNum || c.contractNumber !== processNum)
      );
      if (filtered.length !== prev.length) {
        saveStoredOCTrackingContracts(filtered);
        return filtered;
      }
      return prev;
    });

    setSalesOrders((prev) => {
      const filtered = prev.filter(
        (o) =>
          o.tenderClientId !== clientId &&
          o.contractId !== clientId &&
          (!processNum || o.contractNumber !== processNum)
      );
      if (filtered.length !== prev.length) {
        saveStoredSalesOrders(filtered);
        return filtered;
      }
      return prev;
    });

    try {
      await deleteTenderClientFromFirestore(clientId, processNum);
    } catch (e) {
      console.error('Error deleting tender from Firestore:', e);
    }
  };

  const handleAddItemToTender = (eq: MedicalEquipment, targetClientId?: string) => {
    setTenderClients((prev) => {
      let targetId = targetClientId || activeTenderClientId || prev[0]?.id;
      let updatedList = [...prev];

      // If client doesn't exist yet, auto-create it
      if (!targetId || !prev.some((c) => c.id === targetId)) {
        const newClient: TenderClientProject = {
          id: targetId || `cli-tend-${Date.now()}`,
          clientName: 'Cliente Licitación Nueva',
          nit: '900.000.000-1',
          status: 'En Preparación',
          createdAt: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString().split('T')[0],
          header: {
            entityName: 'ENTIDAD CONTRATANTE',
            nit: '900.000.000-1',
            processNumber: `LP-${new Date().getFullYear()}-01`,
            processType: 'Licitación Pública',
            contractObject: 'SUMINISTRO DE EQUIPOS BIOMÉDICOS HOSPITALARIOS',
            openingDate: new Date().toISOString().split('T')[0],
            closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            city: 'Bogotá D.C.',
            budgetCOP: 200000000,
          },
          items: [],
        };
        updatedList = [newClient, ...prev];
        targetId = newClient.id;
      }

      const multiplier = MARGIN_LISTS[eq.defaultMarginList]?.multiplier || 1.5;
      const offeredUnitPrice = Math.round(eq.baseCostCOP * multiplier);

      // Build specs from equipment technicalSpecs or auto-generate tailored generic biomedical ranges
      const specs: TechnicalRequirement[] =
        eq.technicalSpecs && eq.technicalSpecs.length > 0
          ? eq.technicalSpecs.map((spec, sIdx) => {
              const isUnique = spec.includes('⭐') || spec.toLowerCase().includes('exclusiv') || spec.toLowerCase().includes('patentad');
              const clean = spec.replace(/^⭐\s*/, '');
              const liveAdvice = getLiveDraftingAdvice(clean);
              return {
                id: `req-${Date.now()}-${sIdx}`,
                requirement: clean,
                isUnique: isUnique,
                hasWorkRange: !!liveAdvice?.extractedRange,
                workRange: liveAdvice?.extractedRange?.formatted,
                complies: true,
                folioRef: `Folio ${10 + sIdx * 2}`,
              };
            })
          : getGenericSpecificationsForEquipment(eq.name, eq.brand, eq.model).map((genSpec, sIdx) => ({
              id: `req-gen-${Date.now()}-${sIdx}`,
              requirement: genSpec.requirement,
              isUnique: !!genSpec.isUnique,
              hasWorkRange: !!genSpec.hasWorkRange,
              workRange: genSpec.workRange,
              complies: true,
              folioRef: `Folio ${10 + sIdx * 2}`,
            }));

      const finalUpdatedList = updatedList.map((client) => {
        if (client.id === targetId) {
          const existingItem = client.items.find(
            (it) => it.equipmentId === eq.id || it.code === eq.code
          );
          let targetClientUpdated: TenderClientProject;
          if (existingItem) {
            targetClientUpdated = {
              ...client,
              updatedAt: new Date().toISOString().split('T')[0],
              items: client.items.map((it) =>
                it.id === existingItem.id ? { ...it, quantity: it.quantity + 1, selected: true } : it
              ),
            };
          } else {
            const newItem: TenderItem = {
              id: `tend-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
              itemNumber: client.items.length + 1,
              equipmentId: eq.id,
              code: eq.code,
              name: eq.name,
              brand: eq.brand,
              model: eq.model,
              originCountry: eq.originCountry,
              quantity: 1,
              unitEstimatedBudget: Math.round(offeredUnitPrice * 1.15),
              offeredUnitPrice,
              invimaRecord: eq.invimaRecordNumber,
              warrantyMonths: eq.warrantyMonths,
              deliveryTimeDays: 15,
              selected: true,
              observations: 'Cumple con los requerimientos técnicos exigidos en el pliego de condiciones.',
              requirements: specs,
            };

            targetClientUpdated = {
              ...client,
              updatedAt: new Date().toISOString().split('T')[0],
              items: [...client.items, newItem],
            };
          }

          saveSingleTenderClientToFirestore(targetClientUpdated).catch(() => {});
          return targetClientUpdated;
        }
        return client;
      });

      return finalUpdatedList;
    });

    if (targetClientId) {
      setActiveTenderClientId(targetClientId);
    }
  };

  const handleUpdateTenderItemInClient = (clientId: string, itemId: string, updates: Partial<TenderItem>) => {
    setTenderClients((prev) => {
      const next = prev.map((c) => {
        if (c.id === clientId) {
          const updatedClient = {
            ...c,
            updatedAt: new Date().toISOString().split('T')[0],
            items: c.items.map((it) => (it.id === itemId ? { ...it, ...updates } : it)),
          };
          saveSingleTenderClientToFirestore(updatedClient).catch(() => {});
          return updatedClient;
        }
        return c;
      });
      try {
        localStorage.setItem('syd_tender_clients_v2', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  const handleDeleteTenderItemInClient = (clientId: string, itemId: string) => {
    setTenderClients((prev) => {
      const next = prev.map((c) => {
        if (c.id === clientId) {
          const updatedClient = {
            ...c,
            updatedAt: new Date().toISOString().split('T')[0],
            items: c.items.filter((it) => it.id !== itemId),
          };
          saveSingleTenderClientToFirestore(updatedClient).catch(() => {});
          return updatedClient;
        }
        return c;
      });
      try {
        localStorage.setItem('syd_tender_clients_v2', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  const handleAddRequirementInClient = (clientId: string, itemId: string, req: TechnicalRequirement) => {
    setTenderClients((prev) => {
      const next = prev.map((c) => {
        if (c.id === clientId) {
          const updatedClient = {
            ...c,
            updatedAt: new Date().toISOString().split('T')[0],
            items: c.items.map((it) =>
              it.id === itemId ? { ...it, requirements: [...it.requirements, req] } : it
            ),
          };
          saveSingleTenderClientToFirestore(updatedClient).catch(() => {});
          return updatedClient;
        }
        return c;
      });
      try {
        localStorage.setItem('syd_tender_clients_v2', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  const handleUpdateRequirementInClient = (
    clientId: string,
    itemId: string,
    reqId: string,
    updates: Partial<TechnicalRequirement>
  ) => {
    setTenderClients((prev) => {
      const next = prev.map((c) => {
        if (c.id === clientId) {
          const updatedClient = {
            ...c,
            updatedAt: new Date().toISOString().split('T')[0],
            items: c.items.map((it) =>
              it.id === itemId
                ? {
                    ...it,
                    requirements: it.requirements.map((r) => (r.id === reqId ? { ...r, ...updates } : r)),
                  }
                : it
            ),
          };
          saveSingleTenderClientToFirestore(updatedClient).catch(() => {});
          return updatedClient;
        }
        return c;
      });
      try {
        localStorage.setItem('syd_tender_clients_v2', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  const handleDeleteRequirementInClient = (clientId: string, itemId: string, reqId: string) => {
    setTenderClients((prev) => {
      const next = prev.map((c) => {
        if (c.id === clientId) {
          const updatedClient = {
            ...c,
            updatedAt: new Date().toISOString().split('T')[0],
            items: c.items.map((it) =>
              it.id === itemId
                ? {
                    ...it,
                    requirements: it.requirements.filter((r) => r.id !== reqId),
                  }
                : it
            ),
          };
          saveSingleTenderClientToFirestore(updatedClient).catch(() => {});
          return updatedClient;
        }
        return c;
      });
      try {
        localStorage.setItem('syd_tender_clients_v2', JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  };

  // Automatic Catalog (Ventana 3) Synchronization Handlers
  const handleSyncTenderItemToCatalog = (item: TenderItem, createNewDuplicate = false) => {
    setEquipments((prev) => {
      const res = syncTenderItemToCatalog(item, prev, { createNewDuplicate });
      const targetEq = res.updatedEquipments.find((e) => e.id === res.equipmentId);
      if (targetEq) {
        saveSingleEquipmentToFirestore(targetEq).catch(() => {});
      }
      return res.updatedEquipments;
    });
  };

  const handleBatchSyncTenderItemsToCatalog = (items: TenderItem[]) => {
    autoRegisterSuppliersFromEquipments(items);
    setEquipments((prev) => {
      const res = batchSyncTenderItemsToCatalog(items, prev);
      saveEquipmentsBatchToFirestore(res.updatedEquipments).catch(() => {});
      return res.updatedEquipments;
    });
  };

  // Handlers for Equipments & Documents
  const handleOpenCreateEquipment = () => {
    setEditingEquipment(null);
    setIsEquipmentModalOpen(true);
  };

  const handleOpenEditEquipment = (eq: MedicalEquipment) => {
    setEditingEquipment(eq);
    setIsEquipmentModalOpen(true);
  };

  const handleSaveEquipment = (eqToSave: MedicalEquipment) => {
    // Auto-register supplier in Directory (Ventana 5)
    if (eqToSave.supplier && eqToSave.supplier.trim()) {
      autoRegisterSuppliersFromEquipments([eqToSave]);
    }

    unmarkEquipmentAsDeleted(eqToSave.id, eqToSave.code);

    // Compute updated catalog deterministically from existing state / storage
    const currentList = equipments && equipments.length > 0 ? equipments : (() => {
      try {
        const raw = localStorage.getItem('syd_equipments_catalog');
        if (raw) return JSON.parse(raw);
      } catch {}
      return [];
    })();

    const existsIndex = currentList.findIndex(
      (e) => e.id === eqToSave.id || (e.code && eqToSave.code && e.code.trim().toUpperCase() === eqToSave.code.trim().toUpperCase())
    );
    let updatedCatalog: MedicalEquipment[];
    if (existsIndex >= 0) {
      updatedCatalog = [...currentList];
      updatedCatalog[existsIndex] = { ...updatedCatalog[existsIndex], ...eqToSave };
    } else {
      updatedCatalog = [eqToSave, ...currentList];
    }

    setEquipments(updatedCatalog);

    // Synchronous immediate local persistence so closing browser never loses it
    try {
      localStorage.setItem('syd_equipments_catalog', JSON.stringify(updatedCatalog));
    } catch (e) {}

    // Instant direct save to Firestore (bypassing debounce for rapid UI feedback)
    saveSingleEquipmentToFirestore(eqToSave).catch(() => {});

    // Instant sync to server disk backup cache
    syncDatabaseStateToServer({
      equipments: updatedCatalog,
      quotes: savedQuotes,
      tenders: tenderClients,
      contracts: ocContracts,
      salesOrders,
      salesInvoices,
      documents,
    }).catch(() => {});

    // Also update any active quote items with new equipment data if matched
    setQuoteItems((prev) =>
      prev.map((it) => {
        if (it.equipmentId === eqToSave.id) {
          const mult = it.multiplier || 1.5;
          const newSalePrice = Math.round(eqToSave.baseCostCOP * mult);
          return {
            ...it,
            name: eqToSave.name,
            brand: eqToSave.brand,
            model: eqToSave.model,
            unitCostCOP: eqToSave.baseCostCOP,
            totalCost: eqToSave.baseCostCOP * it.quantity,
            unitSalePrice: newSalePrice,
            totalSalePrice: newSalePrice * it.quantity,
            warrantyMonths: eqToSave.warrantyMonths,
            taxExempt: !!eqToSave.taxExempt,
          };
        }
        return it;
      })
    );
  };

  const handleBatchSaveEquipmentsToCatalog = (
    updatedCatalog: MedicalEquipment[],
    importedCount: number,
    mode: 'append_update' | 'replace'
  ) => {
    // Auto-register all suppliers from imported/updated catalog items into Ventana 5 (Directorio de Proveedores)
    autoRegisterSuppliersFromEquipments(updatedCatalog);
    setEquipments(updatedCatalog);
    try {
      localStorage.setItem('syd_equipments_catalog', JSON.stringify(updatedCatalog));
    } catch (e) {}
    saveEquipmentsBatchToFirestore(updatedCatalog).catch(() => {});
    syncDatabaseStateToServer({
      equipments: updatedCatalog,
      quotes: savedQuotes,
      tenders: tenderClients,
      contracts: ocContracts,
      salesOrders,
      salesInvoices,
      documents,
    }).catch(() => {});
  };

  const handleDeleteEquipment = async (eqId: string, eqCode?: string) => {
    markEquipmentAsDeleted(eqId, eqCode);
    const currentList = equipments && equipments.length > 0 ? equipments : (() => {
      try {
        const raw = localStorage.getItem('syd_equipments_catalog');
        if (raw) return JSON.parse(raw);
      } catch {}
      return [];
    })();
    const updatedCatalog = currentList.filter((e) => e.id !== eqId && (!eqCode || e.code !== eqCode));
    setEquipments(updatedCatalog);
    try {
      localStorage.setItem('syd_equipments_catalog', JSON.stringify(updatedCatalog));
    } catch (e) {}

    try {
      await deleteEquipmentFromFirestore(eqId, eqCode);
    } catch (e) {
      console.error('Error deleting equipment from Firestore:', e);
    }

    syncDatabaseStateToServer({
      equipments: updatedCatalog,
      quotes: savedQuotes,
      tenders: tenderClients,
      contracts: ocContracts,
      salesOrders,
      salesInvoices,
      documents,
    }).catch(() => {});
  };

  const handleClearAllEquipments = async () => {
    setEquipments([]);
    try {
      localStorage.setItem('syd_equipments_catalog', JSON.stringify([]));
      localStorage.setItem('syd_catalog_cleared_by_admin', 'true');
    } catch (e) {}
    try {
      await clearAllEquipmentsFromFirestore();
    } catch (e) {
      console.error('Error clearing equipments from Firestore:', e);
    }
  };

  const handleSaveNewDocument = async (newDoc: TechnicalDocument) => {
    setDocuments((prev) => [newDoc, ...prev]);
    try {
      await saveSingleTechnicalDocumentToFirestore(newDoc);
    } catch (e) {
      console.error('Error saving document to Firestore:', e);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
    try {
      await deleteTechnicalDocumentFromFirestore(docId);
    } catch (e) {
      console.error('Error deleting document from Firestore:', e);
    }
  };

  const handleResetSample = () => {
    setQuoteItems([]);
  };

  // Centralized OCTracking Contracts Update Handler with Real-Time Persistence and Sales Orders Sync
  const handleUpdateContracts = (updatedContracts: OCTrackingContract[]) => {
    const deduped = deduplicateOCTrackingContracts(updatedContracts);
    setOcContracts(deduped);
    saveStoredOCTrackingContracts(deduped);
    saveOCTrackingContractsToFirestore(deduped).catch(() => {});
    broadcastLocalDataSync({ type: 'OC_SYNC', contracts: deduped });

    // Synchronize serial numbers, equipment status, missing equipments, and supplier OC numbers with Sales Orders
    setSalesOrders((prevOrders) => {
      let anyOrderChanged = false;
      let orderList = [...prevOrders];

      deduped.forEach((contract) => {
        if (!contract || !contract.clientName) return;
        const normSO = normalizeClean(contract.salesOrderNumber?.replace(/^ov:\s*/i, ''));
        const normContract = normalizeClean(contract.contractNumber?.replace(/^n°?o?hboc/i, 'hboc'));
        const normClient = normalizeClean(contract.clientName);

        // Precise verification: check if salesOrderId, contract relation, tender, SO number, contract number, or client matches
        const matchIdx = orderList.findIndex(
          (o) =>
            (contract.salesOrderId && o.id === contract.salesOrderId) ||
            (contract.id && o.ocContractId === contract.id) ||
            (contract.tenderClientId && (o.tenderClientId === contract.tenderClientId || o.contractId === contract.tenderClientId)) ||
            (normSO && normSO.length >= 3 && !['ov', 'sinov', 'na', 'n/a'].includes(normSO) && (normalizeClean(o.salesOrderNumber?.replace(/^ov:\s*/i, '')) === normSO || normSO.includes(normalizeClean(o.salesOrderNumber?.replace(/^ov:\s*/i, ''))))) ||
            (normContract && normContract.length >= 4 && !['nohboc', 'hboc', 'na', 'n/a'].includes(normContract) && (normalizeClean(o.contractNumber?.replace(/^n°?o?hboc/i, 'hboc')) === normContract || normContract.includes(normalizeClean(o.contractNumber?.replace(/^n°?o?hboc/i, 'hboc'))))) ||
            (normClient && normClient.length >= 4 && normalizeClean(o.clientName) === normClient)
        );

        if (matchIdx >= 0) {
          // Update the matched existing order without duplicating it
          const order = orderList[matchIdx];
          const isProcessNum = normSO.startsWith('nohb') || normSO.startsWith('hboc') || normSO.startsWith('lic');
          const newSO = (!order.salesOrderNumber || order.salesOrderNumber.startsWith('NoHB')) && !isProcessNum
            ? (contract.salesOrderNumber || order.salesOrderNumber)
            : order.salesOrderNumber;

          const updatedItems = (order.items || []).map((soItem, soIdx) => {
            const normSoName = normalizeClean(soItem.name);
            const normSoCode = normalizeClean(soItem.code);

            const cItem = contract.items.find(
              (it) =>
                (it.equipmentId && soItem.equipmentId && it.equipmentId === soItem.equipmentId) ||
                (it.code && soItem.code && normalizeClean(it.code) === normSoCode) ||
                (it.name && soItem.name && (
                  normalizeClean(it.name) === normSoName ||
                  normalizeClean(it.name).includes(normSoName) ||
                  normSoName.includes(normalizeClean(it.name))
                ))
            ) || (contract.items.length === (order.items || []).length ? contract.items[soIdx] : null);

            if (!cItem) return soItem;
            const eqStatus = cItem.status === 'Entregado e Instalado' ? 'Entregado al Cliente' : (cItem.status || soItem.equipmentStatus);
            return {
              ...soItem,
              equipmentStatus: eqStatus,
              supplierOCRef: cItem.ocNumber || soItem.supplierOCRef,
              linkedSupplierOCNumber: cItem.ocNumber || soItem.linkedSupplierOCNumber,
              assignedSerialNumbers: (cItem.serialNumbers || []).map((s) => s.serialNumber).filter(Boolean).length > 0
                ? (cItem.serialNumbers || []).map((s) => s.serialNumber).filter(Boolean)
                : soItem.assignedSerialNumbers,
            };
          });

          // Also check for any extra/missing equipment items present in OC contract that are missing in order.items
          const unmatchedContractItems = (contract.items || []).filter((cItem) => {
            const normCName = normalizeClean(cItem.name);
            const normCCode = normalizeClean(cItem.code);
            return !(order.items || []).some((soItem) =>
              (cItem.equipmentId && soItem.equipmentId && cItem.equipmentId === soItem.equipmentId) ||
              (cItem.code && soItem.code && normalizeClean(soItem.code) === normCCode) ||
              (cItem.name && soItem.name && (
                normalizeClean(soItem.name) === normCName ||
                normalizeClean(soItem.name).includes(normCName) ||
                normCName.includes(normalizeClean(soItem.name))
              ))
            );
          });

          const newOrderItemsFromContract = unmatchedContractItems.map((cItem, extraIdx) => {
            const qty = Number(cItem.quantity) || 1;
            const cost = Number(cItem.costPriceCOP) || 0;
            const salePrice = Math.round(cost > 0 ? cost * 1.35 : 10000000);
            const eqStatus = cItem.status === 'Entregado e Instalado' ? 'Entregado al Cliente' : (cItem.status || 'Pendiente de OC');
            return {
              id: `ov-item-${contract.id}-extra-${Date.now()}-${extraIdx}`,
              equipmentId: cItem.equipmentId,
              code: cItem.code || `EQ-${(order.items?.length || 0) + extraIdx + 1}`,
              name: cItem.name,
              brand: cItem.brand || '',
              model: cItem.model || '',
              quotedQuantity: qty,
              quantityToDispatch: qty,
              unitSalePriceCOP: salePrice,
              totalSalePriceCOP: salePrice * qty,
              equipmentStatus: eqStatus as any,
              supplierOCRef: cItem.ocNumber || '',
              linkedSupplierOCNumber: cItem.ocNumber || '',
              assignedSerialNumbers: (cItem.serialNumbers || []).map((s) => s.serialNumber).filter(Boolean),
              notes: cItem.notes || '',
            };
          });

          const finalItems = [...updatedItems, ...newOrderItemsFromContract];
          const subtotalVal = finalItems.reduce((acc, it) => acc + (it.totalSalePriceCOP || 0), 0);

          orderList[matchIdx] = {
            ...order,
            salesOrderNumber: newSO,
            hasLinkedOC: true,
            ocContractId: contract.id,
            items: finalItems,
            totalValueCOP: order.totalValueCOP && order.totalValueCOP > 0 ? Math.max(order.totalValueCOP, subtotalVal) : subtotalVal,
            updatedAt: new Date().toISOString(),
          };
          anyOrderChanged = true;
        } else if ((contract.items || []).length > 0) {
          // Contract without sales order (e.g. Direct OC created in Ventana 5) -> Auto-generate linked Sales Order
          const newSO = createSalesOrderFromOCTrackingContract(contract, orderList);
          contract.salesOrderId = newSO.id;
          contract.salesOrderNumber = newSO.salesOrderNumber;
          orderList = [newSO, ...orderList];
          anyOrderChanged = true;
        }
      });

      const dedupedOrders = deduplicateSalesOrders(orderList);
      if (anyOrderChanged || dedupedOrders.length !== prevOrders.length) {
        saveStoredSalesOrders(dedupedOrders);
        saveSalesOrdersBatchToFirestore(dedupedOrders).catch(() => {});
        broadcastLocalDataSync({ type: 'ORDERS_SYNC', orders: dedupedOrders });
        return dedupedOrders;
      }
      return prevOrders;
    });

    window.dispatchEvent(new CustomEvent('syd_data_sync_updated'));
    window.dispatchEvent(new CustomEvent('syd-oc-tracking-updated'));
  };

  // Sales Orders (Window 7) Update Handlers with Bidirectional OC Sync
  const handleUpdateSalesOrders = (updated: SalesOrderRecord[]) => {
    setSalesOrders(updated);
    saveStoredSalesOrders(updated);
    saveSalesOrdersBatchToFirestore(updated).catch(() => {});
    broadcastLocalDataSync({ type: 'ORDERS_SYNC', orders: updated });
    window.dispatchEvent(new CustomEvent('syd-sales-orders-updated'));

    // Also sync back to linked OC Contracts in Ventana 5 if sales order items or OV numbers were updated
    setOcContracts((prevContracts) => {
      let contractChanged = false;
      let newContractsToAdd: OCTrackingContract[] = [];
      const syncedContracts = prevContracts.map((contract) => {
        const matchedOrder = updated.find(
          (o) =>
            o.id === contract.salesOrderId ||
            o.ocContractId === contract.id
        );
        if (!matchedOrder || !matchedOrder.items) return contract;

        let itemsChanged = false;
        const newItems = contract.items.map((cItem, idx) => {
          const soItem = matchedOrder.items.find(
            (it) =>
              (it.equipmentId && cItem.equipmentId && it.equipmentId === cItem.equipmentId) ||
              (it.code && cItem.code && it.code.trim().toLowerCase() === cItem.code.trim().toLowerCase()) ||
              (it.name && cItem.name && it.name.trim().toLowerCase() === cItem.name.trim().toLowerCase())
          ) || (matchedOrder.items.length === contract.items.length ? matchedOrder.items[idx] : null);

          if (!soItem) return cItem;

          let updatedCItem = { ...cItem };
          let changed = false;

          if (soItem.serialNumbers && soItem.serialNumbers.length > 0 && JSON.stringify(soItem.serialNumbers) !== JSON.stringify(cItem.serialNumbers || [])) {
            updatedCItem.serialNumbers = soItem.serialNumbers;
            changed = true;
          } else if (soItem.assignedSerialNumbers && soItem.assignedSerialNumbers.length > 0 && (!cItem.serialNumbers || cItem.serialNumbers.length === 0)) {
            updatedCItem.serialNumbers = soItem.assignedSerialNumbers.map((s, sIdx) => ({
              id: `sn-${Date.now()}-${sIdx}`,
              serialNumber: s,
              status: 'En Bodega',
              documents: [],
            }));
            changed = true;
          }

          if (soItem.linkedSupplierOCNumber && soItem.linkedSupplierOCNumber !== cItem.ocNumber) {
            updatedCItem.ocNumber = soItem.linkedSupplierOCNumber;
            changed = true;
          }

          if (changed) {
            itemsChanged = true;
            return updatedCItem;
          }
          return cItem;
        });

        if (itemsChanged || (matchedOrder.salesOrderNumber && contract.salesOrderNumber !== matchedOrder.salesOrderNumber)) {
          contractChanged = true;
          return {
            ...contract,
            salesOrderNumber: matchedOrder.salesOrderNumber || contract.salesOrderNumber,
            items: newItems,
            lastUpdatedAt: new Date().toISOString(),
          };
        }
        return contract;
      });

      // Check for any sales orders that have an explicit contract/tender connection but no matching ocContract yet
      updated.forEach((order) => {
        if (isSalesOrderDeleted(order.id, order.salesOrderNumber, order.tenderClientId, order.contractId)) return;
        const normSO = normalizeClean(order.salesOrderNumber?.replace(/^ov:\s*/i, ''));
        const normContract = normalizeClean(order.contractNumber?.replace(/^n°?o?hboc/i, 'hboc'));

        const hasMatch = syncedContracts.some(
          (c) =>
            (order.ocContractId && c.id === order.ocContractId) ||
            (c.salesOrderId && c.salesOrderId === order.id) ||
            (order.tenderClientId && (c.tenderClientId === order.tenderClientId || c.id === order.tenderClientId)) ||
            (order.contractId && (c.id === order.contractId || c.tenderClientId === order.contractId)) ||
            (normSO && normSO.length >= 3 && !['ov', 'sinov', 'na', 'n/a'].includes(normSO) && normalizeClean(c.salesOrderNumber?.replace(/^ov:\s*/i, '')) === normSO) ||
            (normContract && normContract.length >= 4 && !['nohboc', 'hboc', 'na', 'n/a'].includes(normContract) && normalizeClean(c.contractNumber?.replace(/^n°?o?hboc/i, 'hboc')) === normContract)
        );
        if (!hasMatch && (order.contractId || order.tenderClientId) && (order.items || []).length > 0) {
          const newC = createOCTrackingContractFromSalesOrder(order, equipments);
          newContractsToAdd.push(newC);
          contractChanged = true;
        }
      });

      const finalContracts = deduplicateOCTrackingContracts([...newContractsToAdd, ...syncedContracts]);
      if (contractChanged || finalContracts.length !== prevContracts.length) {
        saveStoredOCTrackingContracts(finalContracts);
        saveOCTrackingContractsToFirestore(finalContracts).catch(() => {});
        broadcastLocalDataSync({ type: 'OC_SYNC', contracts: finalContracts });
        return finalContracts;
      }
      return prevContracts;
    });
  };

  const handleUpdateSalesInvoices = (updated: SalesInvoiceRecord[]) => {
    setSalesInvoices(updated);
    saveStoredSalesInvoices(updated);
    saveSalesInvoicesBatchToFirestore(updated).catch(() => {});
  };

  const handleGenerateOCTrackingFromSalesOrder = (salesOrder: SalesOrderRecord, navigateToOCTab: boolean = false) => {
    // Only match contract if it was specifically generated for this exact sales order
    const existing = ocContracts.find(
      (c) =>
        (salesOrder.ocContractId && c.id === salesOrder.ocContractId) ||
        (salesOrder.id && c.salesOrderId === salesOrder.id)
    );

    let newContract: OCTrackingContract;
    let updatedContracts: OCTrackingContract[];

    if (existing) {
      const freshContract = createOCTrackingContractFromSalesOrder(salesOrder, equipments);
      newContract = {
        ...existing,
        salesOrderId: salesOrder.id,
        salesOrderNumber: salesOrder.salesOrderNumber || existing.salesOrderNumber,
        quoteId: salesOrder.quoteId || existing.quoteId,
        quoteNumber: salesOrder.quoteNumber || existing.quoteNumber,
        tenderClientId: salesOrder.tenderClientId || salesOrder.contractId || existing.tenderClientId,
        clientName: salesOrder.clientName || existing.clientName,
        contractNumber: salesOrder.contractNumber || existing.contractNumber,
        items: salesOrder.items && salesOrder.items.length > 0 ? freshContract.items.map((fItem) => {
          const existingItem = (existing.items || []).find(
            (eIt) => (eIt.equipmentId && fItem.equipmentId && eIt.equipmentId === fItem.equipmentId) ||
                     (eIt.code && fItem.code && eIt.code.trim().toLowerCase() === fItem.code.trim().toLowerCase()) ||
                     (eIt.name && fItem.name && eIt.name.trim().toLowerCase() === fItem.name.trim().toLowerCase())
          );
          if (existingItem) {
            return {
              ...fItem,
              ocNumber: existingItem.ocNumber || fItem.ocNumber,
              supplier: existingItem.supplier || fItem.supplier,
              status: existingItem.status || fItem.status,
              serialNumbers: existingItem.serialNumbers || fItem.serialNumbers,
            };
          }
          return fItem;
        }) : existing.items,
        lastUpdatedAt: new Date().toISOString(),
      };
      updatedContracts = ocContracts.map((c) => (c.id === existing.id ? newContract : c));
    } else {
      newContract = createOCTrackingContractFromSalesOrder(salesOrder, equipments);
      updatedContracts = [newContract, ...ocContracts];
    }

    const deduped = deduplicateOCTrackingContracts(updatedContracts);
    setOcContracts(deduped);
    saveStoredOCTrackingContracts(deduped);
    saveOCTrackingContractsToFirestore(deduped).catch(() => {});

    // Update sales orders state safely with functional update so we NEVER erase new OVs!
    setSalesOrders((prev) => {
      const updatedSO: SalesOrderRecord = {
        ...salesOrder,
        hasLinkedOC: true,
        ocContractId: newContract.id,
        updatedAt: new Date().toISOString(),
      };
      const idx = prev.findIndex((o) => o.id === salesOrder.id);
      let next: SalesOrderRecord[];
      if (idx >= 0) {
        next = [...prev];
        next[idx] = updatedSO;
      } else {
        next = [updatedSO, ...prev];
      }
      const dedupedSO = deduplicateSalesOrders(next);
      saveStoredSalesOrders(dedupedSO);
      saveSalesOrdersBatchToFirestore(dedupedSO).catch(() => {});
      return dedupedSO;
    });

    if (navigateToOCTab) {
      setActiveTab('seguimiento_oc');
    }
  };

  const handleConvertQuoteToSalesOrder = (quote: SavedQuote | { header: QuoteHeader; items: QuoteItem[] }) => {
    let targetSavedQuote: SavedQuote;
    if ('savedAt' in quote || ('quoteNumber' in quote && 'dateCode' in quote)) {
      targetSavedQuote = quote as SavedQuote;
    } else {
      const header = (quote as any).header || quoteHeader;
      const items = (quote as any).items || quoteItems;
      const subtotal = items.reduce((acc: number, it: QuoteItem) => acc + it.totalSalePrice, 0);
      const iva = items.reduce((acc: number, it: QuoteItem) => {
        const rate = it.taxExempt ? 0 : (it.taxRate !== undefined ? it.taxRate : (header.taxRate ?? 0.19));
        return acc + Math.round(it.totalSalePrice * rate);
      }, 0);
      const totalQty = items.reduce((acc: number, it: QuoteItem) => acc + (it.quantity || 1), 0);
      const quoteNum = header.quoteNumber || getNextDailyQuoteNumber(savedQuotes);
      targetSavedQuote = {
        id: `quote-conv-${Date.now()}`,
        quoteNumber: quoteNum,
        date: header.date || new Date().toISOString().split('T')[0],
        dateCode: getTodayDateCode(),
        clientName: header.clientName || 'Institución / Cliente',
        nit: header.nit || '',
        contactPerson: header.contactPerson || '',
        contactPhone: header.contactPhone || '',
        contactEmail: header.contactEmail || '',
        city: header.city || 'Barranquilla',
        deliveryTime: header.deliveryTime || '30 días calendario',
        paymentTerms: header.paymentTerms || 'Contado comercial',
        validityDays: header.validityDays || 30,
        deliveryPlace: header.deliveryPlace || 'Sitio del cliente',
        warrantyTerms: header.warrantyTerms || 'Garantía oficial 24 meses',
        trainingTerms: header.trainingTerms || 'Capacitación técnica y operacional incluida',
        taxRate: header.taxRate ?? 0.19,
        advisorName: header.advisorName || currentUser?.name || 'Ing. Biomédico SyD',
        advisorRole: header.advisorRole || 'Asesor Comercial',
        advisorPhone: header.advisorPhone || '',
        advisorEmail: header.advisorEmail || '',
        notes: header.notes || '',
        status: 'Aprobada',
        subtotal,
        iva,
        total: subtotal + iva,
        totalQuantity: totalQty,
        items,
        savedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    const linkedTender = tenderClients.find(
      (t) =>
        t.linkedQuoteId === targetSavedQuote.id ||
        t.header?.linkedQuoteId === targetSavedQuote.id ||
        t.linkedQuoteNumber === targetSavedQuote.quoteNumber ||
        t.header?.linkedQuoteNumber === targetSavedQuote.quoteNumber ||
        (targetSavedQuote as any).linkedTenderId === t.id
    );

    if (linkedTender && linkedTender.status !== 'Adjudicada') {
      alert(
        `⛔ CONVERSIÓN BLOQUEADA:\n\nEsta cotización está vinculada a la Licitación / Contrato "${linkedTender.header.processNumber || linkedTender.clientName}" en estado "${linkedTender.status || 'En Preparación'}".\n\nPor regla de negocio, solo las licitaciones ADJUDICADAS pueden convertirse a Orden de Venta (OV). Por favor actualiza el estado de la licitación a "Adjudicada" en la Ventana 4 si fue ganada.`
      );
      return;
    }

    setQuoteToConvertInOV(targetSavedQuote);
    setTenderToConvertInOV(null);
    setActiveTab('ordenes_venta');
  };

  const handleConvertQuoteToTender = (quote: SavedQuote | { header: QuoteHeader; items: QuoteItem[] }) => {
    const qNum = (quote as any).quoteNumber || (quote as any).header?.quoteNumber;
    const qId = (quote as any).id;

    // Check if tender already exists for this quote
    const existing = tenderClients.find(
      (t) =>
        (qId && (t.linkedQuoteId === qId || t.header?.linkedQuoteId === qId)) ||
        (qNum && (t.linkedQuoteNumber === qNum || t.header?.linkedQuoteNumber === qNum))
    );

    if (existing) {
      setActiveTenderClientId(existing.id);
      setActiveTab('licitaciones');
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
      return;
    }

    const newTender = createTenderProjectFromQuote(quote, tenderClients, equipments);
    setTenderClients((prev) => {
      const updated = deduplicateTenderProjects([newTender, ...prev]);
      saveTenderClientsToFirestore(updated).catch(() => {});
      return updated;
    });
    setActiveTenderClientId(newTender.id);
    setActiveTab('licitaciones');
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
  };

  // Compute total items across all client tenders for badge count
  const totalTenderItemsCount = tenderClients.reduce((acc, c) => acc + (c.items?.length || 0), 0);

  // Compute OC counts and active alerts for Navigation badge
  const allOCItems = ocContracts.flatMap((c) => c.items || []);
  const totalOCItemsCount = allOCItems.length;
  const totalOCAlertsCount = allOCItems.filter((it) => checkOCItemAlert(it.lastUpdatedAt, it.status as OCStatus).hasAlert).length;

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0b1322] flex items-center justify-center p-4">
        <LoginModal
          isOpen={true}
          onLoginSuccess={handleLoginSuccess}
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row font-sans transition-colors duration-200"
      style={{
        backgroundColor: 'var(--syd-body-bg)',
        color: 'var(--syd-text-primary)',
      }}
    >
      {/* Left Sidebar Navigation */}
      <Navigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenUserManagement={() => setIsUserManagementModalOpen(true)}
        onOpenCustomization={() => setIsCustomizationModalOpen(true)}
        onOpenAppUpdates={() => setIsAppUpdatesModalOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onSuspendApp={handleSuspendApp}
        themeSettings={themeSettings}
        quoteItemsCount={quoteItems.length}
        costItemsCount={quoteItems.length}
        catalogItemsCount={equipments.length}
        tenderItemsCount={totalTenderItemsCount}
        docItemsCount={documents.length}
        savedQuotesCount={savedQuotes.length}
        ocItemsCount={totalOCItemsCount}
        ocAlertsCount={totalOCAlertsCount}
        salesOrdersCount={salesOrders.length}
      />

      {/* Main Workspace Area (Right side) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Top Header Bar */}
        <div
          id="top-header-bar-container"
          className="p-3 sm:px-6 sm:py-3.5 border-b sticky top-0 z-30 backdrop-blur-md transition-colors duration-200"
          style={{
            backgroundColor: 'var(--syd-header-bg)',
            borderColor: 'var(--syd-border-color)',
          }}
        >
          <Header
            activeTab={activeTab}
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            onOpenCustomization={() => setIsCustomizationModalOpen(true)}
            currentUser={currentUser}
            themeSettings={themeSettings}
            syncStatus={syncStatus}
            onOpenShareModal={() => setIsShareModalOpen(true)}
            onOpenAppUpdates={() => setIsAppUpdatesModalOpen(true)}
            onOpenBackupModal={() => setIsBackupModalOpen(true)}
            onOpenGoogleWorkspaceModal={() => setIsGoogleWorkspaceModalOpen(true)}
          />
        </div>

        {/* Global Online Update Banner (Shows only when new version is available) */}
        <AppUpdateBanner onOpenDetails={() => setIsAppUpdatesModalOpen(true)} />

        {/* Dynamic View Content */}
        <main
          className="flex-1 p-3 sm:p-6 pb-28 sm:pb-36 overflow-y-auto transition-colors duration-200"
          style={{ backgroundColor: 'var(--syd-body-bg)' }}
        >
          {activeTab === 'inicio' && (
            <DashboardOverview
              quoteHeader={quoteHeader}
              quoteItems={quoteItems}
              equipments={equipments}
              tenderItems={tenderClients.flatMap((c) => c.items || [])}
              documents={documents}
              savedQuotes={savedQuotes}
              tenderClients={tenderClients}
              ocContracts={ocContracts}
              onNavigate={setActiveTab}
              onLoadQuoteIntoEditor={handleLoadQuoteIntoEditor}
              currentUser={currentUser}
            />
          )}

          {(activeTab === 'ventas' || activeTab === 'historial') && (
            <QuotesView
              quoteHeader={quoteHeader}
              quoteItems={quoteItems}
              equipments={equipments}
              savedQuotes={savedQuotes}
              initialSubTab={activeTab === 'historial' ? 'historial' : 'editor'}
              customLetterheadUrl={activeLetterheadUrl}
              onUpdateLetterhead={handleUpdateLetterhead}
              marginSettings={activeMarginSettings}
              onUpdateMarginSettings={handleUpdateMarginSettings}
              onUpdateHeader={handleUpdateHeader}
              onUpdateItem={handleUpdateQuoteItem}
              onDeleteItem={handleDeleteQuoteItem}
              onNavigateToCatalog={() => setActiveTab('catalogo')}
              onNavigateToCostManager={() => setActiveTab('costos')}
              onSaveQuote={handleSaveQuote}
              onCreateNewQuote={handleCreateNewQuote}
              onLoadQuoteIntoEditor={handleLoadQuoteIntoEditor}
              onUpdateQuoteStatus={handleUpdateQuoteStatusInDb}
              onDeleteQuote={handleDeleteSavedQuoteInDb}
              onDuplicateQuote={handleDuplicateSavedQuoteInDb}
              onConvertToSalesOrder={handleConvertQuoteToSalesOrder}
              onConvertToTender={handleConvertQuoteToTender}
              currentUser={currentUser}
              editingQuoteId={editingQuoteId}
              onCancelEditQuote={handleCreateNewQuote}
            />
          )}

          {activeTab === 'costos' && (
            <CostManagerView
              quoteItems={quoteItems}
              equipments={equipments}
              taxRate={quoteHeader.taxRate}
              onUpdateItem={handleUpdateQuoteItem}
              onDeleteItem={handleDeleteQuoteItem}
              onNavigateToSales={() => setActiveTab('ventas')}
              onAddItemFromEquipment={handleAddItemFromEquipment}
              onUpdateEquipmentBaseCost={handleUpdateEquipmentBaseCost}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'catalogo' && (
            <EquipmentCatalogView
              equipments={equipments}
              tenderClients={tenderClients}
              onAddToTender={handleAddItemToTender}
              onAddToQuote={(eq) => handleAddItemFromEquipment(eq)}
              onNavigateToSales={() => setActiveTab('ventas')}
              onNavigateToTenders={() => setActiveTab('licitaciones')}
              onOpenNewEquipmentModal={handleOpenCreateEquipment}
              onEditEquipment={handleOpenEditEquipment}
              onDeleteEquipment={handleDeleteEquipment}
              onClearAllEquipments={handleClearAllEquipments}
              onBatchImportEquipments={handleBatchSaveEquipmentsToCatalog}
              onViewDoc={(eqId) => {
                setActiveTab('documentacion');
              }}
              currentUser={currentUser}
            />
          )}

          {activeTab === 'licitaciones' && (
            <TendersView
              tenderClients={tenderClients}
              activeClientId={activeTenderClientId}
              savedQuotes={savedQuotes}
              onSelectClient={setActiveTenderClientId}
              onCreateClient={handleCreateTenderClient}
              onCreateTenderClient={handleCreateTenderClient}
              onBatchCreateClients={handleBatchCreateTenderClients}
              onUpdateClient={handleUpdateTenderClient}
              onDeleteClient={handleDeleteTenderClient}
              onAddItemToClient={(clientId, eq) => handleAddItemToTender(eq, clientId)}
              onUpdateTenderItem={handleUpdateTenderItemInClient}
              onDeleteTenderItem={handleDeleteTenderItemInClient}
              onAddRequirement={handleAddRequirementInClient}
              onUpdateRequirement={handleUpdateRequirementInClient}
              onDeleteRequirement={handleDeleteRequirementInClient}
              onSyncTenderItemToCatalog={handleSyncTenderItemToCatalog}
              onBatchSyncTenderItemsToCatalog={handleBatchSyncTenderItemsToCatalog}
              equipments={equipments}
              currentUser={currentUser}
              contracts={ocContracts}
              salesOrders={salesOrders}
              salesInvoices={salesInvoices}
              onNavigateToOCTracking={() => setActiveTab('seguimiento_oc')}
            />
          )}

          {activeTab === 'seguimiento_oc' && (
            <OCTrackingView
              contracts={ocContracts}
              onUpdateContracts={handleUpdateContracts}
              tenderClients={tenderClients}
              equipments={equipments}
              currentUser={currentUser}
              onNavigateToTab={(tab: string) => setActiveTab(tab as ActiveTab)}
              onUpdateEquipmentBaseCost={handleUpdateEquipmentBaseCost}
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
              onUpdateTenderClient={handleUpdateTenderClient}
              equipments={equipments}
              currentUser={currentUser}
              onNavigateToTab={(tab: string) => setActiveTab(tab as ActiveTab)}
              customLetterheadUrl={activeLetterheadUrl}
              onGenerateOCTracking={handleGenerateOCTrackingFromSalesOrder}
              initialQuoteToConvert={quoteToConvertInOV}
              onClearInitialQuoteToConvert={() => setQuoteToConvertInOV(null)}
              initialTenderToConvert={tenderToConvertInOV}
              onClearInitialTenderToConvert={() => setTenderToConvertInOV(null)}
            />
          )}

          {activeTab === 'documentacion' && (
            <DocumentationView
              documents={documents}
              equipments={equipments}
              tenderClients={tenderClients}
              ocContracts={ocContracts}
              onUpdateContracts={setOcContracts}
              onOpenNewDocumentModal={handleOpenDocumentModal}
              onSaveDocument={handleSaveNewDocument}
              onDeleteDocument={handleDeleteDocument}
              currentUser={currentUser}
              onNavigateToOCTracking={() => setActiveTab('seguimiento_oc')}
            />
          )}

          {activeTab === 'gmail_compras' && (
            <GmailPurchasingHubView
              equipments={equipments}
              onAddEquipmentToCatalog={handleSaveEquipment}
              onBatchSaveEquipments={handleBatchSaveEquipmentsToCatalog}
              documents={documents}
              onSaveDocument={handleSaveNewDocument}
              onNavigateToTab={(tab: string) => setActiveTab(tab as ActiveTab)}
              currentUser={currentUser}
              onNavigateToQuoteWithItems={(items) => {
                setActiveTab('ventas');
              }}
            />
          )}
        </main>

        {/* Global Modals */}
        <EquipmentModal
          isOpen={isEquipmentModalOpen}
          onClose={() => {
            setIsEquipmentModalOpen(false);
            setEditingEquipment(null);
          }}
          onSave={handleSaveEquipment}
          equipmentToEdit={editingEquipment}
        />

        <DocumentModal
          isOpen={isDocumentModalOpen}
          equipments={equipments}
          existingDocuments={documents}
          initialEquipmentId={documentModalParams.equipmentId}
          initialDocType={documentModalParams.docType}
          onClose={() => setIsDocumentModalOpen(false)}
          onSave={handleSaveNewDocument}
        />

        <PrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          quoteHeader={quoteHeader}
          quoteItems={quoteItems}
        />

        <UserManagementModal
          isOpen={isUserManagementModalOpen}
          onClose={() => setIsUserManagementModalOpen(false)}
          currentUser={currentUser}
          onUserUpdated={(updatedUser) => setCurrentUser(updatedUser)}
        />

        {/* Real-time Cloud Sync & Share Modal */}
        <CloudSyncStatusModal
          isOpen={isShareModalOpen}
          onClose={() => setIsShareModalOpen(false)}
          syncStatus={syncStatus}
          stats={{
            quotesCount: savedQuotes.length,
            equipmentsCount: equipments.length,
            tendersCount: tenderClients.length,
            ocContractsCount: ocContracts.length,
            documentsCount: documents.length,
          }}
          onForceSync={() => {
            saveEquipmentsBatchToFirestore(equipments);
            saveTenderClientsToFirestore(tenderClients);
            saveOCTrackingContractsToFirestore(ocContracts);
            saveTechnicalDocumentsToFirestore(documents);
            saveSalesOrdersBatchToFirestore(salesOrders);
            saveSalesInvoicesBatchToFirestore(salesInvoices);
          }}
          onSendBackupNow={async () => {
            const currentUsers = getStoredUsers();
            return await performDailyAutomaticBackup(
              equipments,
              savedQuotes,
              tenderClients,
              ocContracts,
              documents,
              currentUsers,
              true // force manual dispatch
            );
          }}
        />

        {/* Global Customization & Branding Modal */}
        <CustomizationModal
          isOpen={isCustomizationModalOpen}
          onClose={() => setIsCustomizationModalOpen(false)}
          currentTheme={themeSettings}
          onThemeUpdated={handleThemeUpdated}
          currentUser={currentUser}
          onUpdateCurrentUserPhoto={handleUpdateCurrentUserPhoto}
          onUserUpdated={(updatedUser) => {
            setCurrentUser(updatedUser);
            setStoredAuthUser(updatedUser);
          }}
          standbyTimeoutMinutes={standbyTimeoutMinutes}
          onStandbyTimeoutChange={setStandbyTimeoutMinutes}
        />

        {/* Global App Updates & Release Changelog Modal */}
        <AppUpdatesModal
          isOpen={isAppUpdatesModalOpen}
          onClose={() => setIsAppUpdatesModalOpen(false)}
        />

        {/* Global System Backup & Restore Modal */}
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
          users={getStoredUsers()}
          themeSettings={themeSettings}
          activeLetterheadUrl={activeLetterheadUrl}
          quoteHeader={quoteHeader}
          quoteItems={quoteItems}
          currentUser={currentUser}
          onRestoreCallbacks={{
            onRestoreQuotes: (restored) => setSavedQuotes(restored),
            onRestoreEquipments: (restored) => setEquipments(restored),
            onRestoreTenders: (restored) => setTenderClients(restored),
            onRestoreOCContracts: (restored) => setOcContracts(restored),
            onRestoreDocuments: (restored) => setDocuments(restored),
            onRestoreUsers: (restored) => {
              try {
                localStorage.setItem('syd_registered_system_users_v3', JSON.stringify(restored));
                localStorage.setItem('syd_user_accounts_v2', JSON.stringify(restored));
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('syd_users_updated', { detail: restored }));
                }
              } catch (e) {}
            },
            onRestoreTheme: (restored) => {
              handleThemeUpdated(restored);
            },
            onRestoreLetterhead: (restored) => {
              handleUpdateLetterhead(restored);
            },
          }}
          onOpenSqlConsole={() => setIsAdminSqlModalOpen(true)}
        />

        {/* Global Google Workspace & Firebase Cloud Hub Modal */}
        <GoogleWorkspaceModal
          isOpen={isGoogleWorkspaceModalOpen}
          onClose={() => setIsGoogleWorkspaceModalOpen(false)}
          equipments={equipments}
          quotes={savedQuotes}
          ocContracts={ocContracts}
          salesOrders={salesOrders}
          documents={documents}
          users={getStoredUsers()}
          themeSettings={themeSettings}
          activeLetterheadUrl={activeLetterheadUrl}
          quoteHeader={quoteHeader}
          quoteItems={quoteItems}
          syncStatus={syncStatus}
          onNavigateToGmail={() => setActiveTab('gmail_compras')}
          onNavigateToBackup={() => setIsBackupModalOpen(true)}
          onNavigateToCatalog={() => {
            setIsGoogleWorkspaceModalOpen(false);
            setActiveTab('catalogo');
          }}
          onAddEquipments={(newEqs) => {
            setEquipments((prev) => {
              const updated = [...prev];
              newEqs.forEach((item) => {
                if (!updated.some((e) => e.code === item.code || e.id === item.id)) {
                  updated.unshift(item); // Prepend so it appears right at the top of Creación de Equipos
                }
              });
              try {
                localStorage.setItem('syd_equipments_catalog', JSON.stringify(updated));
              } catch (_) {}
              saveEquipmentsBatchToFirestore(updated).catch(() => {});
              syncDatabaseStateToServer({
                equipments: updated,
                quotes: savedQuotes,
                tenderProjects: tenderClients,
                ocContracts,
                salesOrders,
                salesInvoices,
                technicalDocuments: documents,
              }).catch(() => {});
              return updated;
            });
            newEqs.forEach((item) => {
              saveSingleEquipmentToFirestore(item).catch(() => {});
              if (item.code) {
                saveCreatedSheetPartToFirestore(item.code, item.name).catch(() => {});
              }
            });
          }}
        />

        {/* Global Admin SQL Analytics Console Modal (Password Protected) */}
        <AdminSQLModal
          isOpen={isAdminSqlModalOpen}
          onClose={() => setIsAdminSqlModalOpen(false)}
          equipments={equipments}
          savedQuotes={savedQuotes}
          tenderClients={tenderClients}
          ocContracts={ocContracts}
          salesOrders={salesOrders}
          salesInvoices={salesInvoices}
          currentUser={currentUser}
        />

        {/* Global Mandatory Login Screen when app opens or user logs out */}
        <LoginModal
          isOpen={!currentUser}
          onLoginSuccess={handleLoginSuccess}
        />

        {/* Global Standby / Inactivity Suspension Screen (10 min idle or Ctrl+L / Alt+S) */}
        <StandbyScreen
          isOpen={isStandby || isSuspended}
          currentUser={currentUser}
          onWakeUp={() => {
            setIsSuspended(false);
            handleWakeUpStandby();
          }}
          onLogout={handleLogout}
          timeoutMinutes={standbyTimeoutMinutes}
          onTimeoutChange={setStandbyTimeoutMinutes}
        />

        {/* Global Floating Alerts System (Missing costs, OC tracking delays, payments, updates) */}
        {!isSuspended && !isStandby && currentUser && (
          <FloatingAlertsWidget
            alerts={systemAlertsData.alerts}
            summary={systemAlertsData.summary}
            onNavigateTab={(tab) => setActiveTab(tab)}
            onEditEquipment={handleOpenEditEquipment}
            equipments={equipments}
            onOpenAppUpdates={() => setIsAppUpdatesModalOpen(true)}
          />
        )}

        {/* Real-time Server Auto-Reload Notice */}
        {isUpdating && (
          <div
            id="live-auto-update-overlay"
            className="fixed top-5 left-1/2 -translate-x-1/2 z-[99999] bg-slate-900/95 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center space-x-4 border border-cyan-500/50 backdrop-blur-xl animate-bounce font-medium text-sm max-w-lg text-center"
          >
            <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0"></div>
            <div className="text-left">
              <p className="font-bold text-cyan-300 text-xs uppercase tracking-wider">Actualización en Curso</p>
              <p className="text-slate-200 text-xs sm:text-sm">{updateMessage || 'Sincronizando y reiniciando app automáticamente...'}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="ml-auto bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-3 py-1.5 rounded-lg font-bold shrink-0 shadow cursor-pointer transition-all"
            >
              Recargar Ya
            </button>
          </div>
        )}

        {/* Global Real-Time Google Drive New Part Notification Toast */}
        {newPartDriveToast && (
          <div
            id="global-new-part-drive-toast"
            className="fixed top-5 right-5 z-[99999] max-w-md bg-slate-900/95 backdrop-blur-md border-2 border-emerald-500 shadow-2xl rounded-2xl p-4 text-white animate-slideDown transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shrink-0 mt-0.5 animate-bounce">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black uppercase tracking-wider">
                    ¡Nueva Parte Creada en Drive!
                  </span>
                  <span className="text-[10px] text-slate-400">Google Sheets / N-FCO-03</span>
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                  {newPartDriveToast.count === 1
                    ? `Se detectó: "${newPartDriveToast.name}"`
                    : `Se detectaron ${newPartDriveToast.count} nuevas partes creadas`}
                </h4>
                <p className="text-xs text-slate-300">
                  Ref: <span className="font-mono text-emerald-300 font-bold">{newPartDriveToast.code || 'En trámite'}</span>. Lista para consulta e incorporación al catálogo.
                </p>
                <div className="pt-2 flex items-center gap-2">
                  <button
                    onClick={() => {
                      setNewPartDriveToast(null);
                      setIsGoogleWorkspaceModalOpen(true);
                      window.dispatchEvent(
                        new CustomEvent('syd-open-workspace-modal', {
                          detail: { openSubTab: 'parts', partCode: newPartDriveToast.code },
                        })
                      );
                    }}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition cursor-pointer shadow flex items-center gap-1"
                  >
                    <span>Consultar en Drive</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setNewPartDriveToast(null)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Global Floating Chat Widget (Mara AI & User Team Messenger) */}
        {!isSuspended && !isStandby && currentUser && (
          <FloatingChatWidget
            currentUser={currentUser}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            equipmentsCount={equipments.length}
            quotesCount={savedQuotes.length}
            tenderClientsCount={tenderClients.length}
            ocContractsCount={ocContracts.length}
            documentsCount={documents.length}
            alertsCount={systemAlertsData.alerts.length}
            onOpenEquipmentModal={() => {
              setEditingEquipment(null);
              setIsEquipmentModalOpen(true);
            }}
            onOpenDocumentModal={() => {
              setDocumentModalParams({
                equipmentId: equipments[0]?.id || '',
                docType: 'Ficha Técnica',
              });
              setIsDocumentModalOpen(true);
            }}
            onOpenNewQuote={() => {
              setActiveTab('ventas');
            }}
            onOpenUserManagement={() => setIsUserManagementModalOpen(true)}
            onOpenCustomization={() => setIsCustomizationModalOpen(true)}
            onOpenPrintModal={() => setIsPrintModalOpen(true)}
            onOpenAppUpdates={() => setIsAppUpdatesModalOpen(true)}
            onOpenBackupModal={() => setIsBackupModalOpen(true)}
            onOpenWorkspaceModal={() => setIsGoogleWorkspaceModalOpen(true)}
          />
        )}

        {/* Global Toast for 429 Rate Limit Notifications */}
        <RateLimitToast />
      </div>
    </div>
  );
}
