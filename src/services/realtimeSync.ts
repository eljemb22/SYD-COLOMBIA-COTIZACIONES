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
  arrayUnion,
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
import { deduplicateTenderProjects } from '../utils/tenderDeduplication';
import { getSavedQuotes } from '../utils/quoteStorage';
import {
  getStoredOCTrackingContracts,
  getStoredSupplierProfiles,
  deduplicateOCTrackingContracts,
} from '../utils/ocTrackingStorage';
import { getStoredClients } from '../utils/clientStorage';
import { isRateLimitError, notifyRateLimit } from '../utils/rateLimitHandler';
import {
  getStoredSalesOrders,
  getStoredSalesInvoices,
  deduplicateSalesOrders,
} from '../utils/salesOrdersStorage';
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
  mergeCloudTombstones,
  CloudTombstonesPayload,
} from '../utils/tombstones';

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

// IDs de equipos eliminados recientemente.
// Evita que una escritura antigua pendiente pueda recrearlos.
const recentlyDeletedEquipmentIds = new Map<string, number>();
const RECENT_DELETE_PROTECTION_MS = 10000;

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

export function getStoredTenders(): TenderClientProject[] {
  try {
    const raw = localStorage.getItem('syd_tender_clients_v2');
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    const deduped = deduplicateTenderProjects(list);
    if (deduped.length !== list.length) {
      localStorage.setItem('syd_tender_clients_v2', JSON.stringify(deduped));
    }
    return deduped;
  } catch {
    return [];
  }
}

/**
 * Persists deleted entity identifiers into Firestore system_settings/tombstones
 * so that any other browser, mobile PWA, or computer listening in real-time
 * immediately registers the tombstone and drops the entity from memory and screen.
 */
export async function recordCloudTombstone(
  type: 'tender' | 'contract' | 'salesOrder' | 'salesInvoice' | 'quote' | 'equipment' | 'document',
  id: string,
  extra: Record<string, any> = {}
): Promise<void> {
  if (!id) return;
  try {
    const tombstoneDoc = doc(db, 'system_settings', 'tombstones');
    const updatePayload: Record<string, any> = {
      updatedAt: serverTimestamp(),
      lastAction: {
        type,
        id,
        timestamp: Date.now(),
        ...extra,
      },
    };
    if (type === 'tender') updatePayload.deletedTenders = arrayUnion(id);
    else if (type === 'contract') updatePayload.deletedContracts = arrayUnion(id);
    else if (type === 'salesOrder') updatePayload.deletedSalesOrders = arrayUnion(id);
    else if (type === 'salesInvoice') updatePayload.deletedSalesInvoices = arrayUnion(id);
    else if (type === 'quote') updatePayload.deletedQuotes = arrayUnion(id);
    else if (type === 'equipment') updatePayload.deletedEquipments = arrayUnion(id);
    else if (type === 'document') updatePayload.deletedDocuments = arrayUnion(id);

    await setDoc(tombstoneDoc, updatePayload, { merge: true });
  } catch (e) {
    // Non-blocking fallback
    console.debug('Failed to record cloud tombstone:', e);
  }
}

export async function deleteEquipmentFromFirestore(equipmentId: string, equipmentCode?: string): Promise<void> {
  try {
    const safeId = toSafeDocId(equipmentId, 'eq');
    markEquipmentAsDeleted(equipmentId, equipmentCode);
    await recordCloudTombstone('equipment', equipmentId, { code: equipmentCode });

    // Cancel pending debounce writes
    if (debounceTimers[`equipment_${safeId}`]) {
      clearTimeout(debounceTimers[`equipment_${safeId}`]);
      delete debounceTimers[`equipment_${safeId}`];
    }

    recentlyDeletedEquipmentIds.set(safeId, Date.now());

    const docRef = doc(db, 'equipments', safeId);
    await deleteDoc(docRef);

    // Also delete any doc that might have used the code directly as ID
    if (equipmentCode) {
      try {
        const codeSafeId = toSafeDocId(equipmentCode, 'eq');
        if (codeSafeId !== safeId) {
          await deleteDoc(doc(db, 'equipments', codeSafeId));
        }
      } catch (_) {}
    }

    // Clean local storage cache immediately
    try {
      const raw = localStorage.getItem('syd_equipments_catalog');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((e) => e.id !== equipmentId && (!equipmentCode || e.code !== equipmentCode));
          localStorage.setItem('syd_equipments_catalog', JSON.stringify(filtered));
        }
      }
    } catch (_) {}

    broadcastLocalDataSync({
      type: 'ENTITY_DELETED',
      entityType: 'equipment',
      id: equipmentId,
      code: equipmentCode,
    });

    // Immediately remove from server disk backup snapshot so it never resurrects
    await fetch('/api/backup/delete-entity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'equipment', id: equipmentId, code: equipmentCode }),
    }).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `equipments/${equipmentId}`);
    throw err;
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

export async function deleteTenderClientFromFirestore(clientId: string, processNumber?: string): Promise<void> {
  try {
    const safeId = toSafeDocId(clientId, 'tender');
    markTenderAsDeleted(clientId, processNumber);
    await recordCloudTombstone('tender', clientId, { processNumber });

    if (debounceTimers[`tender_${safeId}`]) {
      clearTimeout(debounceTimers[`tender_${safeId}`]);
      delete debounceTimers[`tender_${safeId}`];
    }
    const docRef = doc(db, 'tender_projects', safeId);
    await deleteDoc(docRef);

    if (safeId !== clientId) {
      try {
        await deleteDoc(doc(db, 'tender_projects', clientId));
      } catch (_) {}
    }

    // Thorough deletion across collection for any matching IDs or processNumbers
    try {
      const coll = collection(db, 'tender_projects');
      const snap = await getDocs(coll);
      snap.forEach((d) => {
        const data = d.data();
        if (
          d.id === safeId ||
          d.id === clientId ||
          data?.id === clientId ||
          data?.id === safeId ||
          (processNumber && (d.id === processNumber || data?.header?.processNumber === processNumber))
        ) {
          deleteDoc(d.ref).catch(() => {});
        }
      });
    } catch (_) {}

    try {
      const list = getStoredTenders().filter(
        (t) => t.id !== clientId && (!processNumber || t.header?.processNumber !== processNumber)
      );
      localStorage.setItem('syd_tender_clients_v2', JSON.stringify(list));
    } catch (_) {}

    broadcastLocalDataSync({
      type: 'ENTITY_DELETED',
      entityType: 'tender',
      id: clientId,
      processNumber,
    });

    await fetch('/api/backup/delete-entity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'tender', id: clientId, processNumber }),
    }).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `tender_projects/${clientId}`);
    throw err;
  }
}

export async function deleteOCTrackingContractFromFirestore(
  contractId: string,
  contractNumber?: string,
  salesOrderNumber?: string,
  tenderClientId?: string
): Promise<void> {
  try {
    const safeId = toSafeDocId(contractId, 'oc');
    markContractAsDeleted(contractId, contractNumber, salesOrderNumber, tenderClientId);
    await recordCloudTombstone('contract', contractId, { contractNumber, salesOrderNumber, tenderClientId });

    if (debounceTimers[`oc_${safeId}`]) {
      clearTimeout(debounceTimers[`oc_${safeId}`]);
      delete debounceTimers[`oc_${safeId}`];
    }
    const docRef = doc(db, 'oc_contracts', safeId);
    await deleteDoc(docRef);

    if (safeId !== contractId) {
      try {
        await deleteDoc(doc(db, 'oc_contracts', contractId));
      } catch (_) {}
    }

    // Thorough deletion across collection for any matching IDs, contract numbers, or SO numbers
    try {
      const coll = collection(db, 'oc_contracts');
      const snap = await getDocs(coll);
      snap.forEach((d) => {
        const data = d.data();
        if (
          d.id === safeId ||
          d.id === contractId ||
          data?.id === contractId ||
          data?.id === safeId ||
          (contractNumber && (d.id === contractNumber || data?.contractNumber === contractNumber)) ||
          (salesOrderNumber && (d.id === salesOrderNumber || data?.salesOrderNumber === salesOrderNumber)) ||
          (tenderClientId && (d.id === tenderClientId || data?.tenderClientId === tenderClientId))
        ) {
          deleteDoc(d.ref).catch(() => {});
        }
      });
    } catch (_) {}

    try {
      const list = getStoredOCTrackingContracts().filter(
        (c) =>
          c.id !== contractId &&
          (!contractNumber || c.contractNumber !== contractNumber) &&
          (!salesOrderNumber || c.salesOrderNumber !== salesOrderNumber)
      );
      localStorage.setItem('syd_oc_tracking_contracts_v3', JSON.stringify(list));
    } catch (_) {}

    broadcastLocalDataSync({
      type: 'ENTITY_DELETED',
      entityType: 'contract',
      id: contractId,
      contractNumber,
      salesOrderNumber,
      tenderClientId,
    });

    await fetch('/api/backup/delete-entity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'contract', id: contractId, contractNumber, salesOrderNumber, tenderClientId }),
    }).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `oc_contracts/${contractId}`);
    throw err;
  }
}

export async function deleteTechnicalDocumentFromFirestore(docId: string): Promise<void> {
  try {
    const safeId = toSafeDocId(docId, 'doc');
    markDocumentAsDeleted(docId);
    await recordCloudTombstone('document', docId);

    if (debounceTimers[`doc_${safeId}`]) {
      clearTimeout(debounceTimers[`doc_${safeId}`]);
      delete debounceTimers[`doc_${safeId}`];
    }
    const docRef = doc(db, 'technical_documents', safeId);
    await deleteDoc(docRef);

    try {
      const raw = localStorage.getItem('syd_technical_documents_v3');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          localStorage.setItem('syd_technical_documents_v3', JSON.stringify(parsed.filter((d) => d.id !== docId)));
        }
      }
    } catch (_) {}

    broadcastLocalDataSync({
      type: 'ENTITY_DELETED',
      entityType: 'document',
      id: docId,
    });

    await fetch('/api/backup/delete-entity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'document', id: docId }),
    }).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `technical_documents/${docId}`);
    throw err;
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

export async function deleteSalesOrderFromFirestore(
  orderId: string,
  salesOrderNumber?: string,
  tenderClientId?: string,
  contractId?: string
): Promise<void> {
  try {
    markSalesOrderAsDeleted(orderId, salesOrderNumber, tenderClientId, contractId);
    await recordCloudTombstone('salesOrder', orderId, { salesOrderNumber, tenderClientId, contractId });

    if (debounceTimers['batch_sales_orders']) {
      clearTimeout(debounceTimers['batch_sales_orders']);
      delete debounceTimers['batch_sales_orders'];
    }
    const safeId = toSafeDocId(orderId, 'ov');
    const docRef = doc(db, 'sales_orders', safeId);
    await deleteDoc(docRef);

    // Also delete any document that might have used raw orderId or salesOrderNumber as ID
    if (orderId && orderId !== safeId) {
      try {
        await deleteDoc(doc(db, 'sales_orders', orderId));
      } catch (_) {}
    }

    if (salesOrderNumber && salesOrderNumber !== safeId) {
      try {
        const numSafeId = toSafeDocId(salesOrderNumber, 'ov');
        await deleteDoc(doc(db, 'sales_orders', numSafeId));
      } catch (_) {}
    }

    // Immediately purge from local storage cache so zero residual data remains
    try {
      const stored = getStoredSalesOrders().filter(
        (o) => o.id !== orderId && (!salesOrderNumber || o.salesOrderNumber !== salesOrderNumber)
      );
      localStorage.setItem('syd_sales_orders_v1', JSON.stringify(stored));
    } catch (_) {}

    // Broadcast entity deletion across all open tabs and PWA immediately
    broadcastLocalDataSync({
      type: 'ENTITY_DELETED',
      entityType: 'salesOrder',
      id: orderId,
      salesOrderNumber,
      tenderClientId,
      contractId,
    });

    await fetch('/api/backup/delete-entity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'salesOrder', id: orderId, salesOrderNumber, tenderClientId, contractId }),
    }).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `sales_orders/${orderId}`);
    throw err;
  }
}

export async function deleteSalesInvoiceFromFirestore(
  invoiceId: string,
  invoiceNumber?: string,
  salesOrderId?: string
): Promise<void> {
  try {
    markSalesInvoiceAsDeleted(invoiceId, invoiceNumber, salesOrderId);
    await recordCloudTombstone('salesInvoice', invoiceId, { invoiceNumber, salesOrderId });

    if (debounceTimers['batch_sales_invoices']) {
      clearTimeout(debounceTimers['batch_sales_invoices']);
      delete debounceTimers['batch_sales_invoices'];
    }
    const safeId = toSafeDocId(invoiceId, 'inv');
    const docRef = doc(db, 'sales_invoices', safeId);
    await deleteDoc(docRef);

    if (invoiceId && invoiceId !== safeId) {
      try {
        await deleteDoc(doc(db, 'sales_invoices', invoiceId));
      } catch (_) {}
    }

    // Immediately purge from local storage cache
    try {
      const stored = getStoredSalesInvoices().filter(
        (i) => i.id !== invoiceId && (!invoiceNumber || i.invoiceNumber !== invoiceNumber)
      );
      localStorage.setItem('syd_sales_invoices_v1', JSON.stringify(stored));
    } catch (_) {}

    broadcastLocalDataSync({
      type: 'ENTITY_DELETED',
      entityType: 'salesInvoice',
      id: invoiceId,
      invoiceNumber,
      salesOrderId,
    });

    await fetch('/api/backup/delete-entity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'salesInvoice', id: invoiceId, invoiceNumber, salesOrderId }),
    }).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `sales_invoices/${invoiceId}`);
    throw err;
  }
}

export async function deleteQuoteFromFirestore(quoteId: string, quoteNumber?: string): Promise<void> {
  try {
    const safeId = toSafeDocId(quoteId, 'quote');
    markQuoteAsDeleted(quoteId, quoteNumber);
    await recordCloudTombstone('quote', quoteId, { quoteNumber });

    if (debounceTimers[`quote_${safeId}`]) {
      clearTimeout(debounceTimers[`quote_${safeId}`]);
      delete debounceTimers[`quote_${safeId}`];
    }
    const docRef = doc(db, 'saved_quotes', safeId);
    await deleteDoc(docRef);

    if (quoteId && quoteId !== safeId) {
      try {
        await deleteDoc(doc(db, 'saved_quotes', quoteId));
      } catch (_) {}
    }

    // Also delete any document that might have used the quoteNumber directly as ID
    if (quoteNumber && quoteNumber !== safeId) {
      try {
        const numSafeId = toSafeDocId(quoteNumber, 'quote');
        await deleteDoc(doc(db, 'saved_quotes', numSafeId));
      } catch (_) {}
    }

    // Thorough check across collection to eliminate any orphan duplicates
    try {
      const coll = collection(db, 'saved_quotes');
      const snap = await getDocs(coll);
      snap.forEach((d) => {
        const data = d.data();
        if (
          d.id === safeId ||
          d.id === quoteId ||
          data?.id === quoteId ||
          (quoteNumber && (d.id === quoteNumber || data?.quoteNumber === quoteNumber))
        ) {
          deleteDoc(d.ref).catch(() => {});
        }
      });
    } catch (_) {}

    // Immediately purge from local storage cache
    try {
      const quotes = getSavedQuotes().filter(
        (q) => q.id !== quoteId && (!quoteNumber || q.quoteNumber !== quoteNumber)
      );
      localStorage.setItem('syd_saved_quotes_database_v2', JSON.stringify(quotes));
    } catch (_) {}

    broadcastLocalDataSync({
      type: 'ENTITY_DELETED',
      entityType: 'quote',
      id: quoteId,
      quoteNumber,
    });

    // Immediately remove from server disk backup snapshot
    await fetch('/api/backup/delete-entity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'quote', id: quoteId, quoteNumber }),
    }).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `saved_quotes/${quoteId}`);
    throw err;
  }
}

export async function deleteClientFromFirestore(clientId: string): Promise<void> {
  try {
    const safeId = toSafeDocId(clientId, 'client');
    const docRef = doc(db, 'client_directory', safeId);
    await deleteDoc(docRef);

    if (clientId && clientId !== safeId) {
      try {
        await deleteDoc(doc(db, 'client_directory', clientId));
      } catch (_) {}
    }

    try {
      const list = getStoredClients().filter((c) => c.id !== clientId);
      localStorage.setItem('syd_clients_directory_v1', JSON.stringify(list));
      localStorage.setItem('syd_client_directory_v2', JSON.stringify(list));
    } catch (_) {}

    await fetch('/api/backup/delete-entity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'client', id: clientId }),
    }).catch(() => {});
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `client_directory/${clientId}`);
    throw err;
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

export function broadcastLocalDataSync(payload: { type: string; [key: string]: any }): void {
  try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel('syd_realtime_data_bus');
      bc.postMessage({
        ...payload,
        senderSessionId: getClientSessionId(),
        timestamp: Date.now(),
      });
      bc.close();
    }
  } catch (e) {}
}

export async function saveQuoteToFirestore(quote: SavedQuote): Promise<void> {
  if (isSyncingFromRemote || !quote || !quote.id) return;
  unmarkQuoteAsDeleted(quote.id, quote.quoteNumber);
  const safeId = toSafeDocId(quote.id, 'quote');
  broadcastLocalDataSync({ type: 'QUOTES_SYNC', quotes: getSavedQuotes() });
  
  try {
    const clean = sanitizeForFirestore({ ...quote, id: safeId });
    const docRef = doc(db, 'saved_quotes', safeId);
    await setDoc(docRef, {
      ...clean,
      _updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `saved_quotes/${quote.id}`);
    throw err;
  }
}

export async function saveQuotesBatchToFirestore(quotes: SavedQuote[]): Promise<void> {
  if (isSyncingFromRemote || !quotes || quotes.length === 0) return;
  const safeQuotes = quotes.filter((q) => q && !isQuoteDeleted(q.id, q.quoteNumber));
  if (safeQuotes.length === 0) return;
  debounceWrite('batch_quotes', 400, async () => {
    try {
      await writeInChunks('saved_quotes', safeQuotes);
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
    salesOrders?: SalesOrderRecord[];
    salesInvoices?: SalesInvoiceRecord[];
    technicalDocuments?: TechnicalDocument[];
    systemUsers?: StoredUserAccount[];
    suppliers?: SupplierProfile[];
    clients?: ClientRecord[];
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

    if (data.salesOrders && data.salesOrders.length > 0) {
      await writeInChunks('sales_orders', data.salesOrders, (done, total) => {
        onProgress?.(`Guardando ${total} órdenes de venta en Firestore (${done}/${total})...`);
      });
    }

    if (data.salesInvoices && data.salesInvoices.length > 0) {
      await writeInChunks('sales_invoices', data.salesInvoices, (done, total) => {
        onProgress?.(`Guardando ${total} facturas en Firestore (${done}/${total})...`);
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

    if (data.suppliers && data.suppliers.length > 0) {
      await writeInChunks('suppliers', data.suppliers, (done, total) => {
        onProgress?.(`Guardando ${total} proveedores en Firestore (${done}/${total})...`);
      });
    }

    if (data.clients && data.clients.length > 0) {
      await writeInChunks('clients', data.clients, (done, total) => {
        onProgress?.(`Guardando ${total} clientes en Firestore (${done}/${total})...`);
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

  // Copiar el catálogo en el momento de programar la escritura.
  // Así evitamos depender de una referencia que pueda cambiar después.
  const equipmentSnapshot = equipments.map((equipment) => ({ ...equipment }));

  debounceWrite('batch_equipments', 500, async () => {
    try {
      const now = Date.now();

      // Limpiar protecciones antiguas y excluir de esta escritura
      // los equipos eliminados recientemente.
      const protectedIds = new Set<string>();

      for (const [id, deletedAt] of recentlyDeletedEquipmentIds.entries()) {
        if (now - deletedAt < RECENT_DELETE_PROTECTION_MS) {
          protectedIds.add(id);
        } else {
          recentlyDeletedEquipmentIds.delete(id);
        }
      }

      const safeEquipments = equipmentSnapshot.filter((equipment) => {
        if (!equipment?.id) return false;

        const safeId = toSafeDocId(equipment.id, 'eq');

        if (protectedIds.has(safeId)) {
          console.warn(
            `[SYNC] Escritura por lote bloqueada para equipo eliminado recientemente: ${safeId}`
          );
          return false;
        }

        return true;
      });

      if (safeEquipments.length === 0) return;

      await writeInChunks('equipments', safeEquipments);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'equipments');
    }
  });
}

export async function saveSingleEquipmentToFirestore(equipment: MedicalEquipment): Promise<void> {
  if (!equipment || !equipment.id) return;

  // Unmark tombstone since user is actively saving/creating this equipment
  unmarkEquipmentAsDeleted(equipment.id, equipment.code);

  try {
    const safeId = toSafeDocId(equipment.id, 'eq');
    recentlyDeletedEquipmentIds.delete(safeId);

    const docRef = doc(db, 'equipments', safeId);

    await setDoc(
      docRef,
      sanitizeForFirestore({
        ...equipment,
        id: safeId,
        _updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );

    // Broadcast update across open tabs immediately
    let localEq: MedicalEquipment[] = [];
    try {
      const raw = localStorage.getItem('syd_equipments_catalog');
      if (raw) localEq = JSON.parse(raw);
    } catch (e) {}
    const updated = localEq.some((e) => e.id === equipment.id)
      ? localEq.map((e) => (e.id === equipment.id ? { ...e, ...equipment } : e))
      : [equipment, ...localEq];
    broadcastLocalDataSync({ type: 'EQUIPMENTS_SYNC', equipments: updated });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `equipments/${equipment.id}`);
    throw err;
  }
}

export async function saveSingleTenderClientToFirestore(tender: TenderClientProject): Promise<void> {
  if (!tender || !tender.id) return;
  unmarkTenderAsDeleted(tender.id, tender.header?.processNumber);
  try {
    const safeId = toSafeDocId(tender.id, 'tender');
    const docRef = doc(db, 'tender_projects', safeId);
    await setDoc(docRef, sanitizeForFirestore({ ...tender, id: safeId, _updatedAt: new Date().toISOString() }));

    // Broadcast update across open tabs immediately
    try {
      const stored = getStoredTenders();
      const idx = stored.findIndex(
        (t) => t.id === tender.id || (tender.header?.processNumber && t.header?.processNumber === tender.header.processNumber)
      );
      let nextStored: TenderClientProject[];
      if (idx >= 0) {
        nextStored = [...stored];
        nextStored[idx] = { ...nextStored[idx], ...tender };
      } else {
        nextStored = [tender, ...stored];
      }
      localStorage.setItem('syd_tender_clients_v2', JSON.stringify(nextStored));
    } catch (_) {}

    broadcastLocalDataSync({ type: 'TENDERS_SYNC', tenders: getStoredTenders() });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `tender_projects/${tender.id}`);
    throw err;
  }
}

export async function saveTenderClientsToFirestore(tenders: TenderClientProject[]): Promise<void> {
  if (isSyncingFromRemote || !tenders || tenders.length === 0) return;
  tenders.forEach((t) => t && t.id && unmarkTenderAsDeleted(t.id));
  broadcastLocalDataSync({ type: 'TENDERS_SYNC', tenders });
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
  unmarkContractAsDeleted(contract.id, contract.contractNumber, contract.salesOrderNumber, contract.tenderClientId);
  try {
    const safeId = toSafeDocId(contract.id, 'oc');
    const docRef = doc(db, 'oc_contracts', safeId);
    await setDoc(docRef, sanitizeForFirestore({ ...contract, id: safeId, _updatedAt: new Date().toISOString() }));

    // Broadcast update across open tabs immediately
    try {
      const stored = getStoredOCTrackingContracts();
      const idx = stored.findIndex((c) => c.id === contract.id);
      let nextStored: OCTrackingContract[];
      if (idx >= 0) {
        nextStored = [...stored];
        nextStored[idx] = { ...nextStored[idx], ...contract };
      } else {
        nextStored = [contract, ...stored];
      }
      localStorage.setItem('syd_oc_tracking_contracts_v3', JSON.stringify(nextStored));
    } catch (_) {}

    broadcastLocalDataSync({ type: 'OC_SYNC', contracts: getStoredOCTrackingContracts() });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `oc_contracts/${contract.id}`);
    throw err;
  }
}

export async function saveOCTrackingContractsToFirestore(contracts: OCTrackingContract[]): Promise<void> {
  if (isSyncingFromRemote) return;
  broadcastLocalDataSync({ type: 'OC_SYNC', contracts });
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
  unmarkSalesOrderAsDeleted(order.id, order.salesOrderNumber, order.tenderClientId, order.contractId);
  try {
    const safeId = toSafeDocId(order.id, 'ov');
    const docRef = doc(db, 'sales_orders', safeId);
    await setDoc(docRef, sanitizeForFirestore({ ...order, id: safeId, _updatedAt: new Date().toISOString() }), { merge: true });

    // Also update local storage cache immediately
    try {
      const stored = getStoredSalesOrders();
      const idx = stored.findIndex((o) => o.id === order.id || (order.salesOrderNumber && o.salesOrderNumber === order.salesOrderNumber));
      let nextStored: SalesOrderRecord[];
      if (idx >= 0) {
        nextStored = [...stored];
        nextStored[idx] = { ...nextStored[idx], ...order };
      } else {
        nextStored = [order, ...stored];
      }
      localStorage.setItem('syd_sales_orders_v1', JSON.stringify(nextStored));
    } catch (_) {}

    broadcastLocalDataSync({ type: 'ORDERS_SYNC', orders: getStoredSalesOrders() });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `sales_orders/${order.id}`);
    throw err;
  }
}

export async function saveSalesOrdersBatchToFirestore(orders: SalesOrderRecord[]): Promise<void> {
  if (isSyncingFromRemote) return;
  broadcastLocalDataSync({ type: 'ORDERS_SYNC', orders });
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
  unmarkSalesInvoiceAsDeleted(invoice.id, invoice.invoiceNumber, invoice.salesOrderId);
  try {
    const safeId = toSafeDocId(invoice.id, 'inv');
    const docRef = doc(db, 'sales_invoices', safeId);
    await setDoc(docRef, sanitizeForFirestore({ ...invoice, id: safeId, _updatedAt: new Date().toISOString() }), { merge: true });

    try {
      const stored = getStoredSalesInvoices();
      const idx = stored.findIndex((i) => i.id === invoice.id || (invoice.invoiceNumber && i.invoiceNumber === invoice.invoiceNumber));
      let nextStored: SalesInvoiceRecord[];
      if (idx >= 0) {
        nextStored = [...stored];
        nextStored[idx] = { ...nextStored[idx], ...invoice };
      } else {
        nextStored = [invoice, ...stored];
      }
      localStorage.setItem('syd_sales_invoices_v1', JSON.stringify(nextStored));
    } catch (_) {}

    broadcastLocalDataSync({ type: 'INVOICES_SYNC', invoices: getStoredSalesInvoices() });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `sales_invoices/${invoice.id}`);
    throw err;
  }
}

export async function saveSalesInvoicesBatchToFirestore(invoices: SalesInvoiceRecord[]): Promise<void> {
  if (isSyncingFromRemote) return;
  broadcastLocalDataSync({ type: 'INVOICES_SYNC', invoices });
  debounceWrite('batch_sales_invoices', 600, async () => {
    try {
      await writeInChunks('sales_invoices', invoices);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'sales_invoices');
    }
  });
}

/**
 * Persists a detected Google Drive / Sheet part code to the cloud database
 * so it is immediately marked as "✓ Creado" across all devices, windows, and URLs.
 */
export async function saveCreatedSheetPartToFirestore(code: string, name?: string): Promise<void> {
  if (!code) return;
  const cleanCode = code.trim().toLowerCase();
  const safeId = toSafeDocId(`part_${cleanCode}`, 'part');
  try {
    const docRef = doc(db, 'created_sheet_parts', safeId);
    await setDoc(
      docRef,
      {
        code: cleanCode,
        rawCode: code.trim(),
        name: name?.trim() || '',
        createdAt: new Date().toISOString(),
        _updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    // Non-blocking write error
  }
}

/**
 * Subscribes to real-time changes in the cloud created_sheet_parts collection
 */
export function subscribeToCreatedSheetParts(callback: (codes: string[]) => void): () => void {
  try {
    const partsColl = collection(db, 'created_sheet_parts');
    return onSnapshot(
      partsColl,
      (snapshot) => {
        const codes: string[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.code) codes.push(String(d.code).trim().toLowerCase());
          if (d.rawCode) codes.push(String(d.rawCode).trim().toLowerCase());
        });
        callback(codes);
      },
      (err) => {
        console.debug('Created parts subscription fallback:', err?.message || err);
      }
    );
  } catch (e) {
    return () => {};
  }
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
  onCreatedPartsChange?: (partCodes: string[]) => void;
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

  // 0. Cloud Tombstones Listener (Realtime Deletion Sync Across All Devices & PWAs)
  try {
    const tombstoneDoc = doc(db, 'system_settings', 'tombstones');
    const unsubTombstones = onSnapshot(
      tombstoneDoc,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as CloudTombstonesPayload;
          mergeCloudTombstones(data);

          // Immediately remove deleted items from memory & local storage and notify callbacks
          // 1. Tenders
          const freshTenders = getStoredTenders().filter((t) => t && !isTenderDeleted(t.id, t.header?.processNumber));
          try {
            localStorage.setItem('syd_tender_clients_v2', JSON.stringify(freshTenders));
          } catch (e) {}
          callbacks.onTendersChange?.(freshTenders);

          // 2. Contracts
          const freshContracts = getStoredOCTrackingContracts().filter((c) => c && !isContractDeleted(c.id));
          try {
            localStorage.setItem('syd_oc_tracking_contracts_v3', JSON.stringify(freshContracts));
          } catch (e) {}
          callbacks.onOCContractsChange?.(freshContracts);

          // 3. Sales Orders
          const freshOrders = getStoredSalesOrders().filter(
            (o) => o && !isSalesOrderDeleted(o.id, o.salesOrderNumber, o.tenderClientId, o.contractId)
          );
          try {
            localStorage.setItem('syd_sales_orders_v1', JSON.stringify(freshOrders));
          } catch (e) {}
          callbacks.onSalesOrdersChange?.(freshOrders);

          // 4. Sales Invoices
          const freshInvoices = getStoredSalesInvoices().filter(
            (i) => i && !isSalesInvoiceDeleted(i.id, i.invoiceNumber, i.salesOrderId)
          );
          try {
            localStorage.setItem('syd_sales_invoices_v1', JSON.stringify(freshInvoices));
          } catch (e) {}
          callbacks.onSalesInvoicesChange?.(freshInvoices);

          // 5. Quotes
          const freshQuotes = getSavedQuotes().filter((q) => q && !isQuoteDeleted(q.id, q.quoteNumber));
          try {
            localStorage.setItem('syd_saved_quotes_database_v2', JSON.stringify(freshQuotes));
          } catch (e) {}
          callbacks.onQuotesChange?.(freshQuotes);

          // 6. Equipments
          try {
            const rawEq = localStorage.getItem('syd_equipments_catalog');
            if (rawEq) {
              const parsed = JSON.parse(rawEq);
              if (Array.isArray(parsed)) {
                const freshEq = parsed.filter((eq) => eq && !isEquipmentDeleted(eq.id, eq.code));
                localStorage.setItem('syd_equipments_catalog', JSON.stringify(freshEq));
                callbacks.onEquipmentsChange?.(freshEq);
              }
            }
          } catch (e) {}

          // 7. Documents
          try {
            const rawDocs = localStorage.getItem('syd_technical_documents_v3');
            if (rawDocs) {
              const parsed = JSON.parse(rawDocs);
              if (Array.isArray(parsed)) {
                const freshDocs = parsed.filter((d) => d && !isDocumentDeleted(d.id));
                localStorage.setItem('syd_technical_documents_v3', JSON.stringify(freshDocs));
                callbacks.onDocumentsChange?.(freshDocs);
              }
            }
          } catch (e) {}
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'system_settings/tombstones');
      }
    );
    unsubscribers.push(unsubTombstones);
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, 'system_settings/tombstones');
  }

  // 1. Saved Quotes Listener
  try {
    const quotesColl = collection(db, 'saved_quotes');
    const unsubQuotes = onSnapshot(
      quotesColl,
      (snapshot) => {
        const remoteQuotes: SavedQuote[] = [];
        snapshot.forEach((docSnap) => {
          const q = docSnap.data() as SavedQuote;
          if (q && !isQuoteDeleted(q.id, q.quoteNumber)) {
            remoteQuotes.push(q);
          }
        });

        const resolvedQuotes = remoteQuotes;

        resolvedQuotes.sort(
          (a, b) => new Date(b.updatedAt || b.savedAt || 0).getTime() - new Date(a.updatedAt || a.savedAt || 0).getTime()
        );

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

  // 2. Equipments Listener (Authoritative cloud source of truth with local creation preservation)
  try {
    const eqColl = collection(db, 'equipments');
    const unsubEq = onSnapshot(
      eqColl,
      (snapshot) => {
        const remoteList: MedicalEquipment[] = [];
        snapshot.forEach((docSnap) => {
          const eq = docSnap.data() as MedicalEquipment;
          if (eq && !isEquipmentDeleted(eq.id, eq.code)) {
            remoteList.push(eq);
          }
        });

        const resolvedEquipments: MedicalEquipment[] = remoteList;

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
          const t = docSnap.data() as TenderClientProject;
          if (t && !isTenderDeleted(t.id, t.header?.processNumber)) {
            remoteList.push(t);
          }
        });

        const resolvedTenders = deduplicateTenderProjects(remoteList);

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
          const c = docSnap.data() as OCTrackingContract;
          if (c && !isContractDeleted(c.id)) {
            remoteList.push(c);
          }
        });

        const resolvedOC = deduplicateOCTrackingContracts(remoteList);

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
          const o = docSnap.data() as SalesOrderRecord;
          if (o && o.id && !isSalesOrderDeleted(o.id, o.salesOrderNumber, o.tenderClientId, o.contractId)) {
            remoteList.push(o);
          }
        });

        const resolvedOrders = deduplicateSalesOrders(remoteList);

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
          const inv = docSnap.data() as SalesInvoiceRecord;
          if (inv && inv.id && !isSalesInvoiceDeleted(inv.id, inv.invoiceNumber, inv.salesOrderId)) {
            remoteList.push(inv);
          }
        });

        const resolvedInvoices = remoteList;

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
          const doc = docSnap.data() as TechnicalDocument;
          if (doc && doc.id && !isDocumentDeleted(doc.id)) {
            remoteList.push(doc);
          }
        });

        let localDocs: TechnicalDocument[] = [];
        try {
          const raw = localStorage.getItem('syd_technical_documents_v3');
          if (raw) localDocs = JSON.parse(raw);
        } catch (e) {}
        localDocs = localDocs.filter((d) => d && d.id && !isDocumentDeleted(d.id));

        const resolvedDocs = remoteList;

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

  // 9. Suppliers Directory Listener (Authoritative Cloud Source of Truth)
  try {
    const suppColl = collection(db, 'supplier_directory');
    const unsubSupp = onSnapshot(
      suppColl,
      (snapshot) => {
        const remoteList: SupplierProfile[] = [];
        snapshot.forEach((docSnap) => {
          const s = docSnap.data() as SupplierProfile;
          if (s && s.id) {
            remoteList.push(s);
          }
        });

        const resolvedSuppliers = remoteList;

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

  // 10. Clients Directory Listener (Authoritative Cloud Source of Truth)
  try {
    const clientColl = collection(db, 'client_directory');
    const unsubClients = onSnapshot(
      clientColl,
      (snapshot) => {
        const remoteList: ClientRecord[] = [];
        snapshot.forEach((docSnap) => {
          const c = docSnap.data() as ClientRecord;
          if (c && c.name && c.id) {
            remoteList.push(c);
          }
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

        const resolvedClients = cleanRemoteList;

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

  // 12. Created Sheet Parts Listener (Google Drive / Sheets detected parts realtime sync)
  try {
    const partsColl = collection(db, 'created_sheet_parts');
    const unsubParts = onSnapshot(
      partsColl,
      (snapshot) => {
        const codes: string[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          if (d.code) codes.push(String(d.code).trim().toLowerCase());
          if (d.rawCode) codes.push(String(d.rawCode).trim().toLowerCase());
        });
        if (callbacks.onCreatedPartsChange) {
          callbacks.onCreatedPartsChange(codes);
        }
      },
      () => {}
    );
    unsubscribers.push(unsubParts);
  } catch (e) {
    // Non-blocking
  }

  // 11. Local / LAN Server Real-time State Listener & Instant Multi-Tab Broadcast
  if (typeof window !== 'undefined') {
    const clientSessionId = getClientSessionId();

    // Multi-tab instant synchronization channel
    let realtimeChannel: BroadcastChannel | null = null;
    try {
      if ('BroadcastChannel' in window) {
        realtimeChannel = new BroadcastChannel('syd_realtime_data_bus');
        realtimeChannel.onmessage = (event) => {
          const msg = event.data;
          if (!msg || msg.senderSessionId === clientSessionId) return;

          wrapRemoteUpdate(() => {
            if (msg.type === 'QUOTES_SYNC' && Array.isArray(msg.quotes)) {
              const cleanQuotes = msg.quotes.filter((q: any) => q && !isQuoteDeleted(q.id, q.quoteNumber));
              try {
                localStorage.setItem('syd_saved_quotes_database_v2', JSON.stringify(cleanQuotes));
              } catch (e) {}
              callbacks.onQuotesChange?.(cleanQuotes);
            } else if (msg.type === 'EQUIPMENTS_SYNC' && Array.isArray(msg.equipments)) {
              const cleanEq = msg.equipments.filter((e: any) => e && !isEquipmentDeleted(e.id, e.code));
              try {
                localStorage.setItem('syd_equipments_catalog', JSON.stringify(cleanEq));
              } catch (e) {}
              callbacks.onEquipmentsChange?.(cleanEq);
            } else if (msg.type === 'OC_SYNC' && Array.isArray(msg.contracts)) {
              const cleanOC = msg.contracts.filter((c: any) => c && !isContractDeleted(c.id));
              try {
                localStorage.setItem('syd_oc_tracking_contracts_v3', JSON.stringify(cleanOC));
              } catch (e) {}
              callbacks.onOCContractsChange?.(cleanOC);
            } else if (msg.type === 'ORDERS_SYNC' && Array.isArray(msg.orders)) {
              const cleanOrders = deduplicateSalesOrders(
                msg.orders.filter((o: any) => o && !isSalesOrderDeleted(o.id, o.salesOrderNumber, o.tenderClientId, o.contractId))
              );
              try {
                localStorage.setItem('syd_sales_orders_v1', JSON.stringify(cleanOrders));
              } catch (e) {}
              callbacks.onSalesOrdersChange?.(cleanOrders);
            } else if (msg.type === 'TENDERS_SYNC' && Array.isArray(msg.tenders)) {
              const currentTenders = deduplicateTenderProjects(
                msg.tenders.filter((t: any) => t && t.id && !isTenderDeleted(t.id, t.header?.processNumber))
              );
              try {
                localStorage.setItem('syd_tender_clients_v2', JSON.stringify(currentTenders));
              } catch (e) {}
              callbacks.onTendersChange?.(currentTenders);
            } else if (msg.type === 'INVOICES_SYNC' && Array.isArray(msg.invoices)) {
              const currentInv = msg.invoices.filter((i: any) => !isSalesInvoiceDeleted(i.id, i.invoiceNumber, i.salesOrderId));
              try {
                localStorage.setItem('syd_sales_invoices_v1', JSON.stringify(currentInv));
              } catch (e) {}
              callbacks.onSalesInvoicesChange?.(currentInv);
            } else if (msg.type === 'ENTITY_DELETED') {
              if (msg.entityType === 'salesOrder') {
                markSalesOrderAsDeleted(msg.id, msg.salesOrderNumber, msg.tenderClientId, msg.contractId);
                const current = getStoredSalesOrders().filter(
                  (o) => !isSalesOrderDeleted(o.id, o.salesOrderNumber, o.tenderClientId, o.contractId)
                );
                try {
                  localStorage.setItem('syd_sales_orders_v1', JSON.stringify(current));
                } catch (e) {}
                callbacks.onSalesOrdersChange?.(current);
              } else if (msg.entityType === 'salesInvoice') {
                markSalesInvoiceAsDeleted(msg.id, msg.invoiceNumber, msg.salesOrderId);
                const current = getStoredSalesInvoices().filter(
                  (i) => !isSalesInvoiceDeleted(i.id, i.invoiceNumber, i.salesOrderId)
                );
                try {
                  localStorage.setItem('syd_sales_invoices_v1', JSON.stringify(current));
                } catch (e) {}
                callbacks.onSalesInvoicesChange?.(current);
              } else if (msg.entityType === 'contract') {
                markContractAsDeleted(msg.id);
                const current = getStoredOCTrackingContracts().filter((c) => !isContractDeleted(c.id));
                try {
                  localStorage.setItem('syd_oc_tracking_contracts_v3', JSON.stringify(current));
                } catch (e) {}
                callbacks.onOCContractsChange?.(current);
              } else if (msg.entityType === 'tender') {
                markTenderAsDeleted(msg.id, msg.processNumber);
                const current = getStoredTenders().filter((t) => !isTenderDeleted(t.id, t.header?.processNumber));
                try {
                  localStorage.setItem('syd_tender_clients_v2', JSON.stringify(current));
                } catch (e) {}
                callbacks.onTendersChange?.(current);
              } else if (msg.entityType === 'equipment') {
                markEquipmentAsDeleted(msg.id, msg.code);
                let localEq: MedicalEquipment[] = [];
                try {
                  const raw = localStorage.getItem('syd_equipments_catalog');
                  if (raw) localEq = JSON.parse(raw);
                } catch (e) {}
                const current = localEq.filter((eq) => !isEquipmentDeleted(eq.id, eq.code));
                try {
                  localStorage.setItem('syd_equipments_catalog', JSON.stringify(current));
                } catch (e) {}
                callbacks.onEquipmentsChange?.(current);
              } else if (msg.entityType === 'document') {
                markDocumentAsDeleted(msg.id);
                let localDocs: TechnicalDocument[] = [];
                try {
                  const raw = localStorage.getItem('syd_technical_documents_v3');
                  if (raw) localDocs = JSON.parse(raw);
                } catch (e) {}
                const current = localDocs.filter((d) => !isDocumentDeleted(d.id));
                try {
                  localStorage.setItem('syd_technical_documents_v3', JSON.stringify(current));
                } catch (e) {}
                callbacks.onDocumentsChange?.(current);
              }
            }
          });
        };
      }
    } catch (e) {}

    unsubscribers.push(() => {
      if (realtimeChannel) {
        try {
          realtimeChannel.close();
        } catch (e) {}
      }
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
  tenders?: TenderClientProject[];
  tenderProjects?: TenderClientProject[];
  contracts?: OCTrackingContract[];
  ocContracts?: OCTrackingContract[];
  salesOrders?: SalesOrderRecord[];
  salesInvoices?: SalesInvoiceRecord[];
  documents?: TechnicalDocument[];
  technicalDocuments?: TechnicalDocument[];
  users?: StoredUserAccount[];
}): Promise<void> {
  try {
    const clientId = getClientSessionId();
    const actualTenders = params.tenders || params.tenderProjects || [];
    const actualContracts = params.contracts || params.ocContracts || [];
    const actualDocuments = params.documents || params.technicalDocuments || [];
    const actualUsers = params.users || [];

    const payload = {
      clientId,
      timestamp: new Date().toISOString(),
      equipmentsCount: params.equipments.length,
      quotesCount: params.quotes.length,
      tendersCount: actualTenders.length,
      contractsCount: actualContracts.length,
      salesOrdersCount: (params.salesOrders || []).length,
      salesInvoicesCount: (params.salesInvoices || []).length,
      documentsCount: actualDocuments.length,
      usersCount: actualUsers.length,
      data: {
        equipments: params.equipments,
        quotes: params.quotes,
        tenderProjects: actualTenders,
        ocContracts: actualContracts,
        salesOrders: params.salesOrders || [],
        salesInvoices: params.salesInvoices || [],
        technicalDocuments: actualDocuments,
        systemUsers: actualUsers.map(u => ({ id: u.id, username: u.username, role: u.role, name: u.name, email: u.email, roleLabel: u.roleLabel, department: u.department })),
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
