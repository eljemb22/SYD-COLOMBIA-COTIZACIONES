import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  writeBatch,
  Unsubscribe,
  serverTimestamp,
  Firestore,
} from 'firebase/firestore';
import { db, defaultDb, auth, getFirestoreInstances } from '../lib/firebase';
import {
  SavedQuote,
  MedicalEquipment,
  TenderClientProject,
  OCTrackingContract,
  TechnicalDocument,
  StoredUserAccount,
  ThemeSettings,
  ClientRecord,
  SalesOrderRecord,
  SalesInvoiceRecord,
  SupplierProfile,
} from '../types';
import {
  INITIAL_EQUIPMENTS,
  INITIAL_DOCUMENTS,
  INITIAL_TENDER_CLIENTS,
} from '../data/initialData';
import { INITIAL_SYSTEM_USERS, sanitizeUserAccounts } from '../data/authData';
import {
  mergeEquipments,
  mergeQuotes,
  mergeTenders,
  mergeOCContracts,
  mergeDocuments,
  mergeUsers,
  mergeSalesOrders,
  mergeSalesInvoices,
  mergeSuppliers,
  mergeClients,
} from '../utils/backupRestoreUtils';
import { getSavedQuotes } from '../utils/quoteStorage';
import { getStoredOCTrackingContracts, getStoredSupplierProfiles } from '../utils/ocTrackingStorage';
import { getStoredClients } from '../utils/clientStorage';
import { isRateLimitError, notifyRateLimit } from '../utils/rateLimitHandler';
import {
  getStoredSalesOrders,
  getStoredSalesInvoices,
} from '../utils/salesOrdersStorage';

export type SyncConnectionStatus = 'connecting' | 'connected' | 'syncing' | 'offline' | 'error';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  // Log with silent debug level only if non-permission offline event
  if (process.env.NODE_ENV === 'development' && !String(errInfo.error).includes('permission-denied')) {
    console.debug('Firestore Handled Info:', errInfo);
  }
  if (isRateLimitError(errInfo.error)) {
    notifyRateLimit(
      `Firestore (${path || operationType})`,
      'Límite de velocidad temporal en la base de datos de Firestore. El sistema opera normalmente con la memoria local mientras se estabiliza la conexión.'
    );
  }
  return errInfo;
}

// Flag to prevent echoing remote updates back to Firestore
let isSyncingFromRemote = false;
let isRestoringFromBackup = false;
let lastRemoteUpdateTime = 0;

export function recordRemoteUpdateReceived(): void {
  lastRemoteUpdateTime = Date.now();
}

export function isRecentRemoteUpdate(withinMs = 2000): boolean {
  return Date.now() - lastRemoteUpdateTime < withinMs;
}

export function getIsSyncingFromRemote(): boolean {
  return isSyncingFromRemote;
}

export function setIsSyncingFromRemote(val: boolean): void {
  isSyncingFromRemote = val;
}

export function setRestoringBackupMode(active: boolean): void {
  isRestoringFromBackup = active;
}

export function getIsRestoringBackupMode(): boolean {
  return isRestoringFromBackup;
}

export async function broadcastAppReloadTrigger(message = 'Actualización del sistema aplicada'): Promise<void> {
  try {
    if (!db) return;
    const reloadDoc = doc(db, 'system_settings', 'app_reload_signal');
    await setDoc(
      reloadDoc,
      {
        timestamp: Date.now(),
        reason: message,
        triggeredAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (e) {
    console.warn('Could not broadcast reload trigger:', e);
  }
}

/**
 * Ensures any ID is safe to use as a Firestore document path (replaces slashes and backslashes)
 */
export function toSafeDocId(rawId: string | number | undefined, fallbackPrefix = 'doc'): string {
  if (!rawId) return `${fallbackPrefix}_${Date.now()}`;
  const cleaned = String(rawId).replace(/[\/\\]/g, '_').trim();
  return cleaned || `${fallbackPrefix}_${Date.now()}`;
}

export async function deleteEquipmentFromFirestore(equipmentId: string): Promise<void> {
  try {
    const safeId = toSafeDocId(equipmentId, 'eq');
    const docRef = doc(db, 'equipments', safeId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `equipments/${equipmentId}`);
  }
}

export async function clearAllEquipmentsFromFirestore(): Promise<void> {
  try {
    try {
      localStorage.setItem('syd_catalog_cleared_by_admin', 'true');
      localStorage.setItem('syd_equipments_catalog', JSON.stringify([]));
    } catch (e) {}

    // Also mark status in system_settings
    try {
      const statusDoc = doc(db, 'system_settings', 'catalog_status');
      await setDoc(statusDoc, { status: 'empty', clearedAt: new Date().toISOString(), timestamp: Date.now() }, { merge: true });
    } catch (e) {}

    const eqColl = collection(db, 'equipments');
    const snapshot = await getDocs(eqColl);
    if (!snapshot.empty) {
      const docs = snapshot.docs;
      const CHUNK_SIZE = 250;
      for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const chunk = docs.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((d) => {
          try {
            batch.delete(d.ref);
          } catch (e) {}
        });
        await batch.commit();
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'equipments');
  }
}

export async function deleteTenderClientFromFirestore(clientId: string): Promise<void> {
  try {
    const safeId = toSafeDocId(clientId, 'tender');
    const docRef = doc(db, 'tender_projects', safeId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `tender_projects/${clientId}`);
  }
}

export async function deleteOCTrackingContractFromFirestore(contractId: string): Promise<void> {
  try {
    const safeId = toSafeDocId(contractId, 'oc');
    const docRef = doc(db, 'oc_contracts', safeId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `oc_contracts/${contractId}`);
  }
}

export async function deleteTechnicalDocumentFromFirestore(docId: string): Promise<void> {
  try {
    const safeId = toSafeDocId(docId, 'doc');
    const docRef = doc(db, 'technical_documents', safeId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `technical_documents/${docId}`);
  }
}

export async function deleteUserFromFirestore(userId: string): Promise<void> {
  try {
    const safeId = toSafeDocId(userId, 'user');
    const docRef = doc(db, 'system_users', safeId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `system_users/${userId}`);
  }
}

export async function deleteSalesOrderFromFirestore(orderId: string): Promise<void> {
  try {
    const safeId = toSafeDocId(orderId, 'ov');
    const docRef = doc(db, 'sales_orders', safeId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `sales_orders/${orderId}`);
  }
}

export async function deleteSalesInvoiceFromFirestore(invoiceId: string): Promise<void> {
  try {
    const safeId = toSafeDocId(invoiceId, 'inv');
    const docRef = doc(db, 'sales_invoices', safeId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `sales_invoices/${invoiceId}`);
  }
}

export async function deleteQuoteFromFirestore(quoteId: string): Promise<void> {
  try {
    const safeId = toSafeDocId(quoteId, 'quote');
    const docRef = doc(db, 'saved_quotes', safeId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `saved_quotes/${quoteId}`);
  }
}

export async function deleteClientFromFirestore(clientId: string): Promise<void> {
  try {
    const safeId = toSafeDocId(clientId, 'client');
    const docRef = doc(db, 'client_directory', safeId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `client_directory/${clientId}`);
  }
}

export async function saveSingleClientToFirestore(client: ClientRecord): Promise<void> {
  if (!client || !client.id) return;
  try {
    const safeId = toSafeDocId(client.id, 'client');
    const docRef = doc(db, 'client_directory', safeId);
    await setDoc(docRef, sanitizeForFirestore({ ...client, id: safeId, _updatedAt: new Date().toISOString() }), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `client_directory/${client.id}`);
  }
}

export async function saveClientsBatchToFirestore(clients: ClientRecord[]): Promise<void> {
  if (isSyncingFromRemote) return;
  debounceWrite('batch_clients', 400, async () => {
    try {
      await writeInChunks('client_directory', clients);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'client_directory');
    }
  });
}

export async function deleteSupplierFromFirestore(supplierId: string): Promise<void> {
  try {
    const docRef = doc(db, 'supplier_directory', String(supplierId));
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `supplier_directory/${supplierId}`);
  }
}

export async function saveSingleSupplierToFirestore(supplier: SupplierProfile): Promise<void> {
  if (!supplier || !supplier.id) return;
  try {
    const docRef = doc(db, 'supplier_directory', String(supplier.id));
    await setDoc(docRef, sanitizeForFirestore({ ...supplier, _updatedAt: new Date().toISOString() }), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `supplier_directory/${supplier.id}`);
  }
}

export async function saveSuppliersBatchToFirestore(suppliers: SupplierProfile[]): Promise<void> {
  if (isSyncingFromRemote) return;
  debounceWrite('batch_suppliers', 400, async () => {
    try {
      await writeInChunks('supplier_directory', suppliers);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'supplier_directory');
    }
  });
}

export async function clearAllSuppliersFromFirestore(): Promise<void> {
  try {
    const suppColl = collection(db, 'supplier_directory');
    const snapshot = await getDocs(suppColl);
    if (!snapshot.empty) {
      const docs = snapshot.docs;
      const CHUNK_SIZE = 250;
      for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const chunk = docs.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((d) => {
          try {
            batch.delete(d.ref);
          } catch (e) {}
        });
        await batch.commit();
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'supplier_directory');
  }
}

// Helper to remove undefined fields recursively so Firestore doesn't reject document writes
export function sanitizeForFirestore<T>(data: T): T {
  if (data === undefined) {
    return null as any;
  }
  if (data === null || typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item)) as any;
  }
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(data as Record<string, any>)) {
    if (val !== undefined) {
      clean[key] = sanitizeForFirestore(val);
    }
  }
  return clean as T;
}

// -------------------------------------------------------------
// SAVE METHODS (UPSERT / BATCH) - GUARDED & DEBOUNCED
// -------------------------------------------------------------

// Debounce timers to avoid rapid queuing of writes
const debounceTimers: Record<string, any> = {};

function debounceWrite(key: string, delay: number, fn: () => Promise<void>): void {
  if (debounceTimers[key]) {
    clearTimeout(debounceTimers[key]);
  }
  debounceTimers[key] = setTimeout(() => {
    delete debounceTimers[key];
    fn().catch((err) => console.error(`Debounced write failed for ${key}:`, err));
  }, delay);
}

export async function saveQuoteToFirestore(quote: SavedQuote): Promise<void> {
  if (isSyncingFromRemote) return;
  const safeId = toSafeDocId(quote.id, 'quote');
  debounceWrite(`quote_${safeId}`, 300, async () => {
    try {
      const clean = sanitizeForFirestore({ ...quote, id: safeId });
      const docRef = doc(db, 'saved_quotes', safeId);
      await setDoc(docRef, {
        ...clean,
        _updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `saved_quotes/${quote.id}`);
    }
  });
}

export async function saveQuotesBatchToFirestore(quotes: SavedQuote[]): Promise<void> {
  if (isSyncingFromRemote || !quotes || quotes.length === 0) return;
  debounceWrite('batch_quotes', 400, async () => {
    try {
      await writeInChunks('saved_quotes', quotes);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'saved_quotes');
    }
  });
}

// Helper to safely write in batches to avoid exhausting write queues, document ID errors, and Firestore 500 limit
export async function writeInChunks<T extends { id?: string; code?: string }>(
  collectionName: string,
  items: T[],
  onProgressChunk?: (processed: number, total: number) => void
): Promise<void> {
  if (!items || items.length === 0) return;
  const validItems = items
    .filter(Boolean)
    .map((item, idx) => {
      const existingId = item.id || (item as any)._id || (item as any).quoteNumber;
      const fallbackId = item.code ? `eq_${String(item.code).replace(/[^a-zA-Z0-9_-]/g, '_')}` : `${collectionName}_${Date.now()}_${idx}`;
      const rawId = String(existingId || fallbackId);
      // Clean Firestore document ID: Forward slashes, backslashes, empty or spaces are invalid for Firestore doc references
      const safeId = rawId.replace(/[\/\\]/g, '_').trim() || `${collectionName}_${Date.now()}_${idx}`;
      return {
        ...item,
        id: safeId,
      };
    });

  // Use a safe, fast chunk size of 30 items per batch to keep payloads snappy
  const CHUNK_SIZE = 30;
  for (let i = 0; i < validItems.length; i += CHUNK_SIZE) {
    const chunk = validItems.slice(i, i + CHUNK_SIZE);
    
    // Batch commit with safe timeout fallback (never blocks indefinitely)
    const commitPromise = (async () => {
      const batch = writeBatch(db);
      chunk.forEach((item) => {
        try {
          const docRef = doc(db, collectionName, String(item.id));
          batch.set(docRef, sanitizeForFirestore({ ...item, _updatedAt: new Date().toISOString() }), { merge: true });
        } catch (itemErr) {
          // ignore item formatting issues
        }
      });
      await batch.commit();
    })();

    const timeoutPromise = new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 4000); // 4 seconds max per chunk before proceeding smoothly
    });

    try {
      await Promise.race([commitPromise, timeoutPromise]);
    } catch (batchErr) {
      // ignore transient batch commit error
    }

    onProgressChunk?.(Math.min(i + chunk.length, validItems.length), validItems.length);
  }
}

/**
 * Direct un-throttled batch restoration directly to Cloud Firestore without debounce delays
 */
export async function directBatchRestoreToFirestore(
  data: {
    quotes?: SavedQuote[];
    equipments?: MedicalEquipment[];
    tenderProjects?: TenderClientProject[];
    ocContracts?: OCTrackingContract[];
    technicalDocuments?: TechnicalDocument[];
    systemUsers?: StoredUserAccount[];
    themeSettings?: ThemeSettings;
    activeLetterheadUrl?: string | null;
  },
  onProgress?: (msg: string) => void
): Promise<{ success: boolean; error?: string }> {
  try {
    setRestoringBackupMode(true);

    if (data.equipments && data.equipments.length > 0) {
      await writeInChunks('equipments', data.equipments, (done, total) => {
        onProgress?.(`Guardando ${total} equipos médicos en Firestore (${done}/${total})...`);
      });
    }

    if (data.quotes && data.quotes.length > 0) {
      await writeInChunks('saved_quotes', data.quotes, (done, total) => {
        onProgress?.(`Guardando ${total} cotizaciones en Firestore (${done}/${total})...`);
      });
    }

    if (data.tenderProjects && data.tenderProjects.length > 0) {
      await writeInChunks('tender_projects', data.tenderProjects, (done, total) => {
        onProgress?.(`Guardando ${total} licitaciones en Firestore (${done}/${total})...`);
      });
    }

    if (data.ocContracts && data.ocContracts.length > 0) {
      await writeInChunks('oc_contracts', data.ocContracts, (done, total) => {
        onProgress?.(`Guardando ${total} contratos OC en Firestore (${done}/${total})...`);
      });
    }

    if (data.technicalDocuments && data.technicalDocuments.length > 0) {
      await writeInChunks('technical_documents', data.technicalDocuments, (done, total) => {
        onProgress?.(`Guardando ${total} documentos técnicos en Firestore (${done}/${total})...`);
      });
    }

    if (data.systemUsers && data.systemUsers.length > 0) {
      await writeInChunks('system_users', data.systemUsers, (done, total) => {
        onProgress?.(`Guardando ${total} usuarios en Firestore (${done}/${total})...`);
      });
    }

    if (data.themeSettings) {
      try {
        const themeDoc = doc(db, 'system_settings', 'theme');
        await Promise.race([
          setDoc(themeDoc, sanitizeForFirestore({ ...data.themeSettings, _updatedAt: new Date().toISOString() }), { merge: true }),
          new Promise((r) => setTimeout(r, 2000))
        ]);
      } catch (e) {}
    }

    if (data.activeLetterheadUrl) {
      try {
        const letterDoc = doc(db, 'system_settings', 'letterhead');
        await Promise.race([
          setDoc(letterDoc, sanitizeForFirestore({ letterheadUrl: data.activeLetterheadUrl, isPermanent: true, _updatedAt: new Date().toISOString() }), { merge: true }),
          new Promise((r) => setTimeout(r, 2000))
        ]);
      } catch (e) {}
    }

    onProgress?.('¡Sincronización completada exitosamente!');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error guardando datos en Firestore' };
  } finally {
    // Keep restore mode active for a brief period so all live snapshot echoes settle smoothly
    setTimeout(() => {
      setRestoringBackupMode(false);
    }, 1500);
  }
}

export async function saveEquipmentsBatchToFirestore(equipments: MedicalEquipment[]): Promise<void> {
  if (isSyncingFromRemote || !equipments || equipments.length === 0) return;
  try {
    localStorage.removeItem('syd_catalog_cleared_by_admin');
  } catch (e) {}
  debounceWrite('batch_equipments', 500, async () => {
    try {
      await writeInChunks('equipments', equipments);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'equipments');
    }
  });
}

export async function saveSingleEquipmentToFirestore(equipment: MedicalEquipment): Promise<void> {
  if (!equipment || !equipment.id) return;
  try {
    const safeId = toSafeDocId(equipment.id, 'eq');
    const docRef = doc(db, 'equipments', safeId);
    await setDoc(docRef, sanitizeForFirestore({ ...equipment, id: safeId, _updatedAt: new Date().toISOString() }), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `equipments/${equipment.id}`);
  }
}

export async function saveSingleTenderClientToFirestore(tender: TenderClientProject): Promise<void> {
  if (!tender || !tender.id) return;
  try {
    const safeId = toSafeDocId(tender.id, 'tender');
    const docRef = doc(db, 'tender_projects', safeId);
    await setDoc(docRef, sanitizeForFirestore({ ...tender, id: safeId, _updatedAt: new Date().toISOString() }), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `tender_projects/${tender.id}`);
  }
}

export async function saveTenderClientsToFirestore(tenders: TenderClientProject[]): Promise<void> {
  if (isSyncingFromRemote) return;
  debounceWrite('batch_tenders', 400, async () => {
    try {
      await writeInChunks('tender_projects', tenders);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'tender_projects');
    }
  });
}

export async function saveSingleOCTrackingContractToFirestore(contract: OCTrackingContract): Promise<void> {
  if (!contract || !contract.id) return;
  try {
    const safeId = toSafeDocId(contract.id, 'oc');
    const docRef = doc(db, 'oc_contracts', safeId);
    await setDoc(docRef, sanitizeForFirestore({ ...contract, id: safeId, _updatedAt: new Date().toISOString() }), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `oc_contracts/${contract.id}`);
  }
}

export async function saveOCTrackingContractsToFirestore(contracts: OCTrackingContract[]): Promise<void> {
  if (isSyncingFromRemote) return;
  debounceWrite('batch_oc', 400, async () => {
    try {
      await writeInChunks('oc_contracts', contracts);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'oc_contracts');
    }
  });
}

export async function saveSingleTechnicalDocumentToFirestore(docItem: TechnicalDocument): Promise<void> {
  if (!docItem || !docItem.id) return;
  try {
    const safeId = toSafeDocId(docItem.id, 'doc');
    const docRef = doc(db, 'technical_documents', safeId);
    await setDoc(docRef, sanitizeForFirestore({ ...docItem, id: safeId, _updatedAt: new Date().toISOString() }), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `technical_documents/${docItem.id}`);
  }
}

export async function saveTechnicalDocumentsToFirestore(docs: TechnicalDocument[]): Promise<void> {
  if (isSyncingFromRemote) return;
  debounceWrite('batch_docs', 400, async () => {
    try {
      await writeInChunks('technical_documents', docs);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'technical_documents');
    }
  });
}

export async function saveSingleUserToFirestore(user: StoredUserAccount): Promise<void> {
  if (!user || !user.id) return;
  try {
    const safeId = toSafeDocId(user.id, 'user');
    const docRef = doc(db, 'system_users', safeId);
    await setDoc(docRef, sanitizeForFirestore({ ...user, id: safeId, _updatedAt: new Date().toISOString() }), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `system_users/${user.id}`);
  }
}

export async function saveSystemUsersToFirestore(users: StoredUserAccount[]): Promise<void> {
  if (isSyncingFromRemote) return;
  debounceWrite('batch_users', 150, async () => {
    try {
      await writeInChunks('system_users', users);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'system_users');
    }
  });
}

export async function saveThemeSettingsToFirestore(theme: ThemeSettings): Promise<void> {
  if (isSyncingFromRemote) return;
  debounceWrite('theme_settings', 400, async () => {
    try {
      const docRef = doc(db, 'system_settings', 'theme');
      await setDoc(docRef, sanitizeForFirestore({ ...theme, _updatedAt: new Date().toISOString() }), { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'system_settings/theme');
    }
  });
}

export async function saveLetterheadToFirestore(letterheadUrl: string | null): Promise<void> {
  if (isSyncingFromRemote) return;
  debounceWrite('letterhead_settings', 400, async () => {
    try {
      const docRef = doc(db, 'system_settings', 'letterhead');
      await setDoc(
        docRef,
        sanitizeForFirestore({
          letterheadUrl: letterheadUrl || '',
          isPermanent: true,
          _updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'system_settings/letterhead');
    }
  });
}

export async function saveSingleSalesOrderToFirestore(order: SalesOrderRecord): Promise<void> {
  if (!order || !order.id) return;
  try {
    const safeId = toSafeDocId(order.id, 'ov');
    const docRef = doc(db, 'sales_orders', safeId);
    await setDoc(docRef, sanitizeForFirestore({ ...order, id: safeId, _updatedAt: new Date().toISOString() }), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `sales_orders/${order.id}`);
  }
}

export async function saveSalesOrdersBatchToFirestore(orders: SalesOrderRecord[]): Promise<void> {
  if (isSyncingFromRemote) return;
  debounceWrite('batch_sales_orders', 600, async () => {
    try {
      await writeInChunks('sales_orders', orders);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'sales_orders');
    }
  });
}

export async function saveSingleSalesInvoiceToFirestore(invoice: SalesInvoiceRecord): Promise<void> {
  if (!invoice || !invoice.id) return;
  try {
    const safeId = toSafeDocId(invoice.id, 'inv');
    const docRef = doc(db, 'sales_invoices', safeId);
    await setDoc(docRef, sanitizeForFirestore({ ...invoice, id: safeId, _updatedAt: new Date().toISOString() }), { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `sales_invoices/${invoice.id}`);
  }
}

export async function saveSalesInvoicesBatchToFirestore(invoices: SalesInvoiceRecord[]): Promise<void> {
  if (isSyncingFromRemote) return;
  debounceWrite('batch_sales_invoices', 600, async () => {
    try {
      await writeInChunks('sales_invoices', invoices);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'sales_invoices');
    }
  });
}

// -------------------------------------------------------------
// REAL-TIME SUBSCRIBERS
// -------------------------------------------------------------

export interface RealtimeDataCallbacks {
  onQuotesChange?: (quotes: SavedQuote[]) => void;
  onEquipmentsChange?: (equipments: MedicalEquipment[]) => void;
  onTendersChange?: (tenders: TenderClientProject[]) => void;
  onOCContractsChange?: (contracts: OCTrackingContract[]) => void;
  onSalesOrdersChange?: (orders: SalesOrderRecord[]) => void;
  onSalesInvoicesChange?: (invoices: SalesInvoiceRecord[]) => void;
  onDocumentsChange?: (documents: TechnicalDocument[]) => void;
  onUsersChange?: (users: StoredUserAccount[]) => void;
  onSuppliersChange?: (suppliers: SupplierProfile[]) => void;
  onClientsChange?: (clients: ClientRecord[]) => void;
  onThemeChange?: (theme: ThemeSettings) => void;
  onLetterheadChange?: (letterheadUrl: string | null) => void;
  onStatusChange?: (status: SyncConnectionStatus) => void;
}

export function subscribeToRealtimeDatabase(callbacks: RealtimeDataCallbacks): () => void {
  const unsubscribers: Unsubscribe[] = [];
  callbacks.onStatusChange?.('connecting');

  let quotesInitialized = false;
  let equipmentsInitialized = false;
  let tendersInitialized = false;
  let ocInitialized = false;
  let salesOrdersInitialized = false;
  let salesInvoicesInitialized = false;
  let docsInitialized = false;
  let usersInitialized = false;
  let suppliersInitialized = false;
  let clientsInitialized = false;

  const checkInitialSyncDone = () => {
    if (
      quotesInitialized &&
      equipmentsInitialized &&
      tendersInitialized &&
      ocInitialized &&
      salesOrdersInitialized &&
      salesInvoicesInitialized &&
      docsInitialized &&
      usersInitialized &&
      suppliersInitialized &&
      clientsInitialized
    ) {
      callbacks.onStatusChange?.('connected');
    }
  };

  const wrapRemoteUpdate = (fn: () => void) => {
    if (isRestoringFromBackup) {
      // While a backup restore transaction is actively running, do not let remote snapshot echoes override
      return;
    }
    isSyncingFromRemote = true;
    recordRemoteUpdateReceived();
    try {
      fn();
    } finally {
      setTimeout(() => {
        isSyncingFromRemote = false;
      }, 250);
    }
  };

  // 1. Saved Quotes Listener
  try {
    const quotesColl = collection(db, 'saved_quotes');
    const unsubQuotes = onSnapshot(
      quotesColl,
      (snapshot) => {
        const remoteQuotes: SavedQuote[] = [];
        snapshot.forEach((docSnap) => {
          remoteQuotes.push(docSnap.data() as SavedQuote);
        });

        const localQuotes = getSavedQuotes();
        let resolvedQuotes: SavedQuote[];

        if (remoteQuotes.length === 0) {
          // If Firestore is completely empty and this is the first sync, seed with local data
          if (!quotesInitialized && localQuotes.length > 0) {
            resolvedQuotes = localQuotes;
            saveQuotesBatchToFirestore(localQuotes).catch(() => {});
          } else {
            resolvedQuotes = [];
          }
        } else {
          // Authoritative remote list from Firestore: reflects real-time adds, edits, and deletions
          resolvedQuotes = remoteQuotes;
        }

        resolvedQuotes.sort((a, b) => new Date(b.updatedAt || b.savedAt || 0).getTime() - new Date(a.updatedAt || a.savedAt || 0).getTime());
        
        try {
          localStorage.setItem('syd_saved_quotes_database_v2', JSON.stringify(resolvedQuotes));
        } catch (e) {}
        wrapRemoteUpdate(() => {
          callbacks.onQuotesChange?.(resolvedQuotes);
        });
        quotesInitialized = true;
        checkInitialSyncDone();
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'saved_quotes');
        quotesInitialized = true;
        checkInitialSyncDone();
      }
    );
    unsubscribers.push(unsubQuotes);
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'saved_quotes');
  }

  // 2. Equipments Listener (Authoritative cloud source of truth)
  try {
    const eqColl = collection(db, 'equipments');
    const unsubEq = onSnapshot(
      eqColl,
      (snapshot) => {
        const remoteList: MedicalEquipment[] = [];
        snapshot.forEach((docSnap) => {
          remoteList.push(docSnap.data() as MedicalEquipment);
        });

        let localEquipments: MedicalEquipment[] = [];
        try {
          const raw = localStorage.getItem('syd_equipments_catalog');
          if (raw) localEquipments = JSON.parse(raw);
        } catch (e) {}

        const isClearedExplicitly = localStorage.getItem('syd_catalog_cleared_by_admin') === 'true';
        let resolvedEquipments: MedicalEquipment[];

        if (remoteList.length === 0) {
          if (isClearedExplicitly) {
            resolvedEquipments = [];
          } else if (!equipmentsInitialized && localEquipments.length > 0) {
            resolvedEquipments = localEquipments;
            saveEquipmentsBatchToFirestore(resolvedEquipments).catch(() => {});
          } else {
            resolvedEquipments = [];
          }
        } else {
          try {
            localStorage.removeItem('syd_catalog_cleared_by_admin');
          } catch (e) {}
          // Live remote list is authoritative: reflecting adds, edits, and deletions
          resolvedEquipments = remoteList;
        }

        try {
          localStorage.setItem('syd_equipments_catalog', JSON.stringify(resolvedEquipments));
        } catch (e) {}

        wrapRemoteUpdate(() => {
          callbacks.onEquipmentsChange?.(resolvedEquipments);
        });
        equipmentsInitialized = true;
        checkInitialSyncDone();
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'equipments');
        equipmentsInitialized = true;
        checkInitialSyncDone();
      }
    );
    unsubscribers.push(unsubEq);
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'equipments');
  }

  // 3. Tenders / Licitaciones Listener
  try {
    const tendersColl = collection(db, 'tender_projects');
    const unsubTenders = onSnapshot(
      tendersColl,
      (snapshot) => {
        const remoteList: TenderClientProject[] = [];
        snapshot.forEach((docSnap) => {
          remoteList.push(docSnap.data() as TenderClientProject);
        });

        let localTenders: TenderClientProject[] = [];
        try {
          const raw = localStorage.getItem('syd_tender_clients_v2');
          if (raw) localTenders = JSON.parse(raw);
        } catch (e) {}

        let resolvedTenders: TenderClientProject[];
        if (remoteList.length === 0) {
          if (!tendersInitialized && localTenders.length > 0) {
            resolvedTenders = localTenders;
            saveTenderClientsToFirestore(resolvedTenders).catch(() => {});
          } else {
            resolvedTenders = [];
          }
        } else {
          resolvedTenders = remoteList;
        }

        try {
          localStorage.setItem('syd_tender_clients_v2', JSON.stringify(resolvedTenders));
        } catch (e) {}
        wrapRemoteUpdate(() => {
          callbacks.onTendersChange?.(resolvedTenders);
        });
        tendersInitialized = true;
        checkInitialSyncDone();
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'tender_projects');
        tendersInitialized = true;
        checkInitialSyncDone();
      }
    );
    unsubscribers.push(unsubTenders);
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'tender_projects');
  }

  // 4. OC Tracking Listener
  try {
    const ocColl = collection(db, 'oc_contracts');
    const unsubOC = onSnapshot(
      ocColl,
      (snapshot) => {
        const remoteList: OCTrackingContract[] = [];
        snapshot.forEach((docSnap) => {
          remoteList.push(docSnap.data() as OCTrackingContract);
        });

        const localOC = getStoredOCTrackingContracts();
        let resolvedOC: OCTrackingContract[];
        if (remoteList.length === 0) {
          if (!ocInitialized && localOC.length > 0) {
            resolvedOC = localOC;
            saveOCTrackingContractsToFirestore(localOC).catch(() => {});
          } else {
            resolvedOC = [];
          }
        } else {
          resolvedOC = remoteList;
        }

        try {
          localStorage.setItem('syd_oc_tracking_contracts_v3', JSON.stringify(resolvedOC));
        } catch (e) {}
        wrapRemoteUpdate(() => {
          callbacks.onOCContractsChange?.(resolvedOC);
        });
        ocInitialized = true;
        checkInitialSyncDone();
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'oc_contracts');
        ocInitialized = true;
        checkInitialSyncDone();
      }
    );
    unsubscribers.push(unsubOC);
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'oc_contracts');
  }

  // 4b. Sales Orders (Órdenes de Venta) Listener
  try {
    const soColl = collection(db, 'sales_orders');
    const unsubSO = onSnapshot(
      soColl,
      (snapshot) => {
        const remoteList: SalesOrderRecord[] = [];
        snapshot.forEach((docSnap) => {
          remoteList.push(docSnap.data() as SalesOrderRecord);
        });

        const localOrders = getStoredSalesOrders();
        let resolvedOrders: SalesOrderRecord[];
        if (remoteList.length === 0) {
          if (!salesOrdersInitialized && localOrders.length > 0) {
            resolvedOrders = localOrders;
            saveSalesOrdersBatchToFirestore(localOrders).catch(() => {});
          } else {
            resolvedOrders = [];
          }
        } else {
          resolvedOrders = remoteList;
        }

        resolvedOrders.sort(
          (a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
        );

        try {
          localStorage.setItem('syd_sales_orders_v1', JSON.stringify(resolvedOrders));
        } catch (e) {}
        wrapRemoteUpdate(() => {
          callbacks.onSalesOrdersChange?.(resolvedOrders);
        });
        salesOrdersInitialized = true;
        checkInitialSyncDone();
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'sales_orders');
        salesOrdersInitialized = true;
        checkInitialSyncDone();
      }
    );
    unsubscribers.push(unsubSO);
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'sales_orders');
  }

  // 4c. Sales Invoices (Facturación SYD) Listener
  try {
    const invColl = collection(db, 'sales_invoices');
    const unsubInv = onSnapshot(
      invColl,
      (snapshot) => {
        const remoteList: SalesInvoiceRecord[] = [];
        snapshot.forEach((docSnap) => {
          remoteList.push(docSnap.data() as SalesInvoiceRecord);
        });

        const localInvoices = getStoredSalesInvoices();
        let resolvedInvoices: SalesInvoiceRecord[];
        if (remoteList.length === 0) {
          if (!salesInvoicesInitialized && localInvoices.length > 0) {
            resolvedInvoices = localInvoices;
            saveSalesInvoicesBatchToFirestore(localInvoices).catch(() => {});
          } else {
            resolvedInvoices = [];
          }
        } else {
          resolvedInvoices = remoteList;
        }

        resolvedInvoices.sort(
          (a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
        );

        try {
          localStorage.setItem('syd_sales_invoices_v1', JSON.stringify(resolvedInvoices));
        } catch (e) {}
        wrapRemoteUpdate(() => {
          callbacks.onSalesInvoicesChange?.(resolvedInvoices);
        });
        salesInvoicesInitialized = true;
        checkInitialSyncDone();
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'sales_invoices');
        salesInvoicesInitialized = true;
        checkInitialSyncDone();
      }
    );
    unsubscribers.push(unsubInv);
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'sales_invoices');
  }

  // 5. Technical Documents Listener
  try {
    const docsColl = collection(db, 'technical_documents');
    const unsubDocs = onSnapshot(
      docsColl,
      (snapshot) => {
        const remoteList: TechnicalDocument[] = [];
        snapshot.forEach((docSnap) => {
          remoteList.push(docSnap.data() as TechnicalDocument);
        });

        let localDocs: TechnicalDocument[] = [];
        try {
          const raw = localStorage.getItem('syd_technical_documents_v3');
          if (raw) localDocs = JSON.parse(raw);
        } catch (e) {}

        let resolvedDocs: TechnicalDocument[];
        if (remoteList.length === 0) {
          if (!docsInitialized && localDocs.length > 0) {
            resolvedDocs = localDocs;
            saveTechnicalDocumentsToFirestore(resolvedDocs).catch(() => {});
          } else {
            resolvedDocs = [];
          }
        } else {
          resolvedDocs = remoteList;
        }

        try {
          localStorage.setItem('syd_technical_documents_v3', JSON.stringify(resolvedDocs));
        } catch (e) {}
        wrapRemoteUpdate(() => {
          callbacks.onDocumentsChange?.(resolvedDocs);
        });
        docsInitialized = true;
        checkInitialSyncDone();
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'technical_documents');
        docsInitialized = true;
        checkInitialSyncDone();
      }
    );
    unsubscribers.push(unsubDocs);
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'technical_documents');
  }

  // 6. System Users Listener
  try {
    const usersColl = collection(db, 'system_users');
    const unsubUsers = onSnapshot(
      usersColl,
      (snapshot) => {
        const list: StoredUserAccount[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as StoredUserAccount);
        });

        if (list.length === 0 && !usersInitialized) {
          saveSystemUsersToFirestore(INITIAL_SYSTEM_USERS).catch((e) =>
            console.error('Initial cloud users seed error:', e)
          );
        }

        const rawList = list.length > 0 ? list : INITIAL_SYSTEM_USERS;
        const { users: resolvedUsers, hasChanges } = sanitizeUserAccounts(rawList);

        if (hasChanges && !usersInitialized) {
          saveSystemUsersToFirestore(resolvedUsers).catch((e) =>
            console.error('Auto migration cloud users error:', e)
          );
        }

        try {
          localStorage.setItem('syd_registered_system_users_v4', JSON.stringify(resolvedUsers));
          localStorage.setItem('syd_registered_system_users_v3', JSON.stringify(resolvedUsers));
        } catch (e) {}

        wrapRemoteUpdate(() => {
          callbacks.onUsersChange?.(resolvedUsers);
        });

        usersInitialized = true;
        checkInitialSyncDone();
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'system_users');
        usersInitialized = true;
        checkInitialSyncDone();
      }
    );
    unsubscribers.push(unsubUsers);
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'system_users');
  }

  // 7. Theme Settings Listener
  try {
    const themeDoc = doc(db, 'system_settings', 'theme');
    const unsubTheme = onSnapshot(
      themeDoc,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as ThemeSettings;
          wrapRemoteUpdate(() => {
            callbacks.onThemeChange?.(data);
          });
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'system_settings/theme');
      }
    );
    unsubscribers.push(unsubTheme);
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, 'system_settings/theme');
  }

  // 8. Permanent Letterhead Listener
  try {
    const letterheadDoc = doc(db, 'system_settings', 'letterhead');
    const unsubLetterhead = onSnapshot(
      letterheadDoc,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as { letterheadUrl?: string };
          if (data?.letterheadUrl && data.letterheadUrl.length > 20) {
            wrapRemoteUpdate(() => {
              callbacks.onLetterheadChange?.(data.letterheadUrl || null);
            });
          }
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'system_settings/letterhead');
      }
    );
    unsubscribers.push(unsubLetterhead);
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, 'system_settings/letterhead');
  }

  // 9. Suppliers Directory Listener
  try {
    const suppColl = collection(db, 'supplier_directory');
    const unsubSupp = onSnapshot(
      suppColl,
      (snapshot) => {
        const remoteList: SupplierProfile[] = [];
        snapshot.forEach((docSnap) => {
          remoteList.push(docSnap.data() as SupplierProfile);
        });

        const localSuppliers = getStoredSupplierProfiles();
        let resolvedSuppliers: SupplierProfile[];
        if (remoteList.length === 0) {
          if (!suppliersInitialized && localSuppliers.length > 0) {
            resolvedSuppliers = localSuppliers;
            saveSuppliersBatchToFirestore(localSuppliers).catch(() => {});
          } else {
            resolvedSuppliers = [];
          }
        } else {
          resolvedSuppliers = remoteList;
        }

        try {
          localStorage.setItem('syd_suppliers_directory_v1', JSON.stringify(resolvedSuppliers));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('syd_suppliers_updated', { detail: resolvedSuppliers }));
          }
        } catch (e) {}
        wrapRemoteUpdate(() => {
          callbacks.onSuppliersChange?.(resolvedSuppliers);
        });

        suppliersInitialized = true;
        checkInitialSyncDone();
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'supplier_directory');
        suppliersInitialized = true;
        checkInitialSyncDone();
      }
    );
    unsubscribers.push(unsubSupp);
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'supplier_directory');
  }

  // 10. Clients Directory Listener
  try {
    const clientColl = collection(db, 'client_directory');
    const unsubClients = onSnapshot(
      clientColl,
      (snapshot) => {
        const remoteList: ClientRecord[] = [];
        snapshot.forEach((docSnap) => {
          remoteList.push(docSnap.data() as ClientRecord);
        });

        const cleanRemoteList = remoteList.filter(
          (c) =>
            c &&
            c.name &&
            !c.id?.startsWith('client-nazareth-') &&
            !c.id?.startsWith('client-merced-') &&
            !c.id?.startsWith('client-prado-') &&
            !c.id?.startsWith('client-suba-') &&
            c.name !== 'NOMBRE DEL CLIENTE O INSTITUCIÓN' &&
            c.name !== 'CLIENTE NO ESPECIFICADO'
        );

        // Delete mock clients from Firestore once only on initial load, never repeatedly
        if (!clientsInitialized) {
          const mockClients = remoteList.filter((c) => !cleanRemoteList.includes(c));
          mockClients.forEach((rem) => {
            if (rem?.id) {
              deleteClientFromFirestore(rem.id).catch(() => {});
            }
          });
        }

        const localClients = getStoredClients();
        let resolvedClients: ClientRecord[];
        if (cleanRemoteList.length === 0) {
          if (!clientsInitialized && localClients.length > 0) {
            resolvedClients = localClients;
            saveClientsBatchToFirestore(localClients).catch(() => {});
          } else {
            resolvedClients = [];
          }
        } else {
          resolvedClients = cleanRemoteList;
        }

        try {
          localStorage.setItem('syd_clients_directory_v1', JSON.stringify(resolvedClients));
          localStorage.setItem('syd_client_directory_v2', JSON.stringify(resolvedClients));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('syd_clients_updated', { detail: resolvedClients }));
          }
        } catch (e) {}
        wrapRemoteUpdate(() => {
          callbacks.onClientsChange?.(resolvedClients);
        });

        clientsInitialized = true;
        checkInitialSyncDone();
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'client_directory');
        clientsInitialized = true;
        checkInitialSyncDone();
      }
    );
    unsubscribers.push(unsubClients);
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'client_directory');
  }

  // 11. Local / LAN Server Real-time State Listener (SSE & Fast Version Polling)
  // Ensures all computers connected via IP / Localhost receive updates from each other instantly in real time
  if (typeof window !== 'undefined') {
    let lastKnownVersion = 0;
    const clientSessionId = getClientSessionId();

    const applyServerSyncData = (serverData: any) => {
      if (!serverData) return;
      wrapRemoteUpdate(() => {
        if (serverData.equipments && Array.isArray(serverData.equipments)) {
          callbacks.onEquipmentsChange?.(serverData.equipments);
        }
        if (serverData.quotes && Array.isArray(serverData.quotes)) {
          callbacks.onQuotesChange?.(serverData.quotes);
        }
        if (serverData.tenderProjects && Array.isArray(serverData.tenderProjects)) {
          callbacks.onTendersChange?.(serverData.tenderProjects);
        }
        if (serverData.ocContracts && Array.isArray(serverData.ocContracts)) {
          callbacks.onOCContractsChange?.(serverData.ocContracts);
        }
        if (serverData.salesOrders && Array.isArray(serverData.salesOrders)) {
          callbacks.onSalesOrdersChange?.(serverData.salesOrders);
        }
        if (serverData.salesInvoices && Array.isArray(serverData.salesInvoices)) {
          callbacks.onSalesInvoicesChange?.(serverData.salesInvoices);
        }
        if (serverData.technicalDocuments && Array.isArray(serverData.technicalDocuments)) {
          callbacks.onDocumentsChange?.(serverData.technicalDocuments);
        }
        if (serverData.systemUsers && Array.isArray(serverData.systemUsers)) {
          callbacks.onUsersChange?.(serverData.systemUsers);
        }
      });
    };

    // Periodic lightweight fallback polling (every 60s, only when tab is visible)
    const pollInterval = setInterval(async () => {
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      try {
        const res = await fetch('/api/realtime/version', { cache: 'no-store' });
        if (res.status === 429) {
          notifyRateLimit('Sincronización Local');
          return;
        }
        if (res.ok) {
          const vJson = await res.json();
          if (vJson && vJson.version && vJson.version > lastKnownVersion) {
            lastKnownVersion = vJson.version;
            const stateRes = await fetch('/api/backup/latest-state', { cache: 'no-store' });
            if (stateRes.ok) {
              const stateJson = await stateRes.json();
              if (stateJson?.success && stateJson?.data) {
                applyServerSyncData(stateJson.data);
              }
            }
          }
        }
      } catch (e) {}
    }, 60000);

    unsubscribers.push(() => {
      clearInterval(pollInterval);
    });
  }

  return () => {
    unsubscribers.forEach((unsub) => unsub());
  };
}

// Generates or retrieves a unique session ID for this browser tab to prevent echo loops
function getClientSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  let sid = sessionStorage.getItem('syd_client_session_id');
  if (!sid) {
    sid = 'client_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    sessionStorage.setItem('syd_client_session_id', sid);
  }
  return sid;
}

/**
 * Fetches the latest database state snapshot saved on the backend server disk
 */
export async function fetchLatestServerBackupState(): Promise<{
  equipments?: MedicalEquipment[];
  quotes?: SavedQuote[];
  tenderProjects?: TenderClientProject[];
  ocContracts?: OCTrackingContract[];
  salesOrders?: SalesOrderRecord[];
  salesInvoices?: SalesInvoiceRecord[];
  technicalDocuments?: TechnicalDocument[];
  systemUsers?: StoredUserAccount[];
} | null> {
  try {
    const res = await fetch('/api/backup/latest-state');
    if (!res.ok) return null;
    const json = await res.json();
    if (json && json.success && json.data) {
      return json.data;
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Synchronizes the latest full client-side state with the server background cache
 */
export async function syncDatabaseStateToServer(params: {
  equipments: MedicalEquipment[];
  quotes: SavedQuote[];
  tenders: TenderClientProject[];
  contracts: OCTrackingContract[];
  salesOrders?: SalesOrderRecord[];
  salesInvoices?: SalesInvoiceRecord[];
  documents: TechnicalDocument[];
  users: StoredUserAccount[];
}): Promise<void> {
  try {
    const clientId = getClientSessionId();
    const payload = {
      clientId,
      timestamp: new Date().toISOString(),
      equipmentsCount: params.equipments.length,
      quotesCount: params.quotes.length,
      tendersCount: params.tenders.length,
      contractsCount: params.contracts.length,
      salesOrdersCount: (params.salesOrders || []).length,
      salesInvoicesCount: (params.salesInvoices || []).length,
      documentsCount: params.documents.length,
      usersCount: params.users.length,
      data: {
        equipments: params.equipments,
        quotes: params.quotes,
        tenderProjects: params.tenders,
        ocContracts: params.contracts,
        salesOrders: params.salesOrders || [],
        salesInvoices: params.salesInvoices || [],
        technicalDocuments: params.documents,
        systemUsers: params.users.map(u => ({ id: u.id, username: u.username, role: u.role, name: u.name, email: u.email, roleLabel: u.roleLabel, department: u.department })),
      },
    };

    await fetch('/api/backup/sync-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    // Non-blocking sync error
  }
}

/**
 * Triggers a full backup generation (Excel .xlsx + JSON) and sends it to the configured emails
 * Supports hourly automated frequency and manual triggers.
 */
export async function performHourlyAutomaticBackup(
  equipments: MedicalEquipment[],
  quotes: SavedQuote[],
  tenders: TenderClientProject[],
  contracts: OCTrackingContract[],
  documents: TechnicalDocument[],
  users: StoredUserAccount[],
  salesOrders: SalesOrderRecord[] = [],
  salesInvoices: SalesInvoiceRecord[] = [],
  recipients: string[] = ['auxlineadiagnostica@syd.com.co', 'eljemb22@gmail.com'],
  forceManual = false
): Promise<{ success: boolean; message: string; date?: string; time?: string; recipients?: string[] }> {
  try {
    const now = new Date();
    const todayKey = now.toISOString().split('T')[0];
    const currentHourKey = `${todayKey}_${now.getHours()}`;
    const lastHourlyKey = localStorage.getItem('syd_last_hourly_backup_key');

    // Only run if not run in this hour, or if explicitly forced
    if (!forceManual && lastHourlyKey === currentHourKey) {
      return {
        success: true,
        message: `El respaldo de esta hora ya fue enviado (${currentHourKey}).`,
        date: todayKey,
        time: now.toLocaleTimeString('es-CO'),
        recipients,
      };
    }

    const payload = {
      timestamp: now.toISOString(),
      dateString: todayKey,
      recipients,
      equipmentsCount: equipments.length,
      quotesCount: quotes.length,
      tendersCount: tenders.length,
      contractsCount: contracts.length,
      salesOrdersCount: salesOrders.length,
      salesInvoicesCount: salesInvoices.length,
      documentsCount: documents.length,
      usersCount: users.length,
      data: {
        equipments,
        quotes,
        tenderProjects: tenders,
        ocContracts: contracts,
        salesOrders,
        salesInvoices,
        technicalDocuments: documents,
        systemUsers: users.map(u => ({ id: u.id, username: u.username, role: u.role, name: u.name, email: u.email, roleLabel: u.roleLabel, department: u.department })),
      },
    };

    const res = await fetch('/api/backup/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      localStorage.setItem('syd_last_hourly_backup_key', currentHourKey);
      localStorage.setItem('syd_last_hourly_backup_date', todayKey);
      localStorage.setItem('syd_last_hourly_backup_time', now.toISOString());
      localStorage.setItem('syd_last_daily_backup_date', todayKey);
      localStorage.setItem('syd_last_daily_backup_time', now.toISOString());

      const recText = recipients.join(', ');
      return {
        success: true,
        message: `Copia de seguridad en Excel (.xlsx) y JSON enviada con éxito a ${recText}`,
        date: todayKey,
        time: now.toLocaleTimeString('es-CO'),
        recipients,
      };
    } else {
      const errData = await res.json().catch(() => ({}));
      return { success: false, message: errData?.error || 'Error al enviar respaldo por correo' };
    }
  } catch (err: any) {
    console.warn('Hourly backup dispatch exception:', err);
    return { success: false, message: err?.message || 'Error de conexión al enviar el respaldo' };
  }
}

/**
 * Backward-compatible alias for daily automatic backup
 */
export async function performDailyAutomaticBackup(
  equipments: MedicalEquipment[],
  quotes: SavedQuote[],
  tenders: TenderClientProject[],
  contracts: OCTrackingContract[],
  documents: TechnicalDocument[],
  users: StoredUserAccount[],
  forceManual = false
): Promise<{ success: boolean; message: string; date?: string }> {
  return performHourlyAutomaticBackup(
    equipments,
    quotes,
    tenders,
    contracts,
    documents,
    users,
    [],
    [],
    ['auxlineadiagnostica@syd.com.co', 'eljemb22@gmail.com'],
    forceManual
  );
}
