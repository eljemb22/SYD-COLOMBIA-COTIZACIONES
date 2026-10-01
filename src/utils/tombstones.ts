/**
 * Persistent Tombstone Registry for Deleted Entities
 * Prevents deleted quotes, equipments, tenders, contracts, and orders
 * from being resurrected by stale backup snapshots, remote echo events, or offline caches.
 */

const KEY_DELETED_QUOTES = 'syd_deleted_quote_ids';
const KEY_DELETED_EQUIPMENTS = 'syd_deleted_equipment_ids';
const KEY_DELETED_TENDERS = 'syd_deleted_tender_ids';
const KEY_DELETED_CONTRACTS = 'syd_deleted_contract_ids';
const KEY_DELETED_SALES_ORDERS = 'syd_deleted_sales_order_ids';
const KEY_DELETED_SALES_INVOICES = 'syd_deleted_sales_invoice_ids';
const KEY_DELETED_DOCUMENTS = 'syd_deleted_document_ids';

function getStoredSet(key: string): Set<string> {
  try {
    if (typeof localStorage === 'undefined') return new Set();
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveStoredSet(key: string, set: Set<string>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  } catch {}
}

// ---------------- Quotes ----------------
export function getDeletedQuoteIds(): Set<string> {
  const set = getStoredSet(KEY_DELETED_QUOTES);
  // Guarantee ghost quote IDs previously purged are blocked if not un-marked
  const unblocked = getStoredSet('syd_unblocked_quote_ids');
  if (!unblocked.has('quote-1790198216564-6xkz3mp4o')) {
    set.add('quote-1790198216564-6xkz3mp4o');
  }
  if (!unblocked.has('quote-1790354289807-dszz4nkmg')) {
    set.add('quote-1790354289807-dszz4nkmg');
  }
  return set;
}

export function markQuoteAsDeleted(id: string, quoteNumber?: string): void {
  if (!id) return;
  const set = getDeletedQuoteIds();
  set.add(String(id).trim());
  if (quoteNumber) {
    set.add(String(quoteNumber).trim());
    set.add(String(quoteNumber).trim().toUpperCase());
  }
  saveStoredSet(KEY_DELETED_QUOTES, set);

  // Remove from unblocked if previously present
  const unblocked = getStoredSet('syd_unblocked_quote_ids');
  unblocked.delete(String(id).trim());
  if (quoteNumber) {
    unblocked.delete(String(quoteNumber).trim());
    unblocked.delete(String(quoteNumber).trim().toUpperCase());
  }
  saveStoredSet('syd_unblocked_quote_ids', unblocked);
}

export function unmarkQuoteAsDeleted(id: string, quoteNumber?: string): void {
  if (!id) return;
  const set = getDeletedQuoteIds();
  set.delete(String(id).trim());
  if (quoteNumber) {
    set.delete(String(quoteNumber).trim());
    set.delete(String(quoteNumber).trim().toUpperCase());
  }
  saveStoredSet(KEY_DELETED_QUOTES, set);

  // Track as explicitly unblocked so legacy lists never re-block it
  const unblocked = getStoredSet('syd_unblocked_quote_ids');
  unblocked.add(String(id).trim());
  if (quoteNumber) {
    unblocked.add(String(quoteNumber).trim());
    unblocked.add(String(quoteNumber).trim().toUpperCase());
  }
  saveStoredSet('syd_unblocked_quote_ids', unblocked);
}

export function isQuoteDeleted(id: string, quoteNumber?: string): boolean {
  if (!id && !quoteNumber) return false;
  const set = getDeletedQuoteIds();
  if (id && (set.has(String(id).trim()) || set.has(String(id).trim().toLowerCase()))) return true;
  if (quoteNumber) {
    const cleanNum = String(quoteNumber).trim();
    if (set.has(cleanNum) || set.has(cleanNum.toUpperCase()) || set.has(cleanNum.toLowerCase())) return true;
  }
  return false;
}

// ---------------- Equipments ----------------
export function getDeletedEquipmentIds(): Set<string> {
  return getStoredSet(KEY_DELETED_EQUIPMENTS);
}

export function markEquipmentAsDeleted(id: string, code?: string): void {
  if (!id) return;
  const set = getDeletedEquipmentIds();
  set.add(String(id));
  if (code && code.trim()) {
    set.add(`code:${code.trim().toUpperCase()}`);
  }
  saveStoredSet(KEY_DELETED_EQUIPMENTS, set);
}

export function unmarkEquipmentAsDeleted(id: string, code?: string): void {
  if (!id) return;
  const set = getDeletedEquipmentIds();
  set.delete(String(id));
  if (code && code.trim()) {
    set.delete(`code:${code.trim().toUpperCase()}`);
  }
  saveStoredSet(KEY_DELETED_EQUIPMENTS, set);
}

export function isEquipmentDeleted(id: string, code?: string): boolean {
  if (!id && !code) return false;
  const set = getDeletedEquipmentIds();
  if (id && set.has(String(id))) return true;
  if (code && set.has(`code:${code.trim().toUpperCase()}`)) return true;
  return false;
}

// ---------------- Tenders ----------------
export function getDeletedTenderIds(): Set<string> {
  return getStoredSet(KEY_DELETED_TENDERS);
}

export function markTenderAsDeleted(id: string, processNumber?: string): void {
  if (!id && !processNumber) return;
  const set = getDeletedTenderIds();
  if (id) {
    set.add(String(id).trim());
    set.add(String(id).trim().toLowerCase());
  }
  if (processNumber && processNumber.trim()) {
    set.add(`proc:${processNumber.trim().toUpperCase()}`);
    set.add(`proc:${processNumber.trim().toLowerCase()}`);
  }
  saveStoredSet(KEY_DELETED_TENDERS, set);
}

export function unmarkTenderAsDeleted(id: string, processNumber?: string): void {
  if (!id && !processNumber) return;
  const set = getDeletedTenderIds();
  if (id) {
    set.delete(String(id).trim());
    set.delete(String(id).trim().toLowerCase());
  }
  if (processNumber && processNumber.trim()) {
    set.delete(`proc:${processNumber.trim().toUpperCase()}`);
    set.delete(`proc:${processNumber.trim().toLowerCase()}`);
  }
  saveStoredSet(KEY_DELETED_TENDERS, set);
}

export function isTenderDeleted(id: string, processNumber?: string): boolean {
  if (!id && !processNumber) return false;
  const set = getDeletedTenderIds();
  if (id && (set.has(String(id).trim()) || set.has(String(id).trim().toLowerCase()))) return true;
  if (processNumber && (set.has(`proc:${processNumber.trim().toUpperCase()}`) || set.has(`proc:${processNumber.trim().toLowerCase()}`))) return true;
  return false;
}

// ---------------- OC Contracts ----------------
export function getDeletedContractIds(): Set<string> {
  return getStoredSet(KEY_DELETED_CONTRACTS);
}

export function markContractAsDeleted(
  id: string,
  contractNumber?: string,
  salesOrderNumber?: string,
  tenderClientId?: string
): void {
  if (!id && !contractNumber && !salesOrderNumber && !tenderClientId) return;
  const set = getDeletedContractIds();
  if (id) {
    set.add(String(id).trim());
    set.add(String(id).trim().toLowerCase());
  }
  if (contractNumber && contractNumber.trim()) {
    const num = contractNumber.trim();
    set.add(`cnt:${num.toUpperCase()}`);
    set.add(`cnt:${num.toLowerCase()}`);
  }
  if (salesOrderNumber && salesOrderNumber.trim()) {
    const so = salesOrderNumber.trim();
    set.add(`so:${so.toUpperCase()}`);
    set.add(`so:${so.toLowerCase()}`);
  }
  if (tenderClientId && tenderClientId.trim()) {
    set.add(`tender:${tenderClientId.trim()}`);
  }
  saveStoredSet(KEY_DELETED_CONTRACTS, set);
}

export function unmarkContractAsDeleted(
  id: string,
  contractNumber?: string,
  salesOrderNumber?: string,
  tenderClientId?: string
): void {
  if (!id && !contractNumber && !salesOrderNumber && !tenderClientId) return;
  const set = getDeletedContractIds();
  if (id) {
    set.delete(String(id).trim());
    set.delete(String(id).trim().toLowerCase());
  }
  if (contractNumber && contractNumber.trim()) {
    const num = contractNumber.trim();
    set.delete(`cnt:${num.toUpperCase()}`);
    set.delete(`cnt:${num.toLowerCase()}`);
  }
  if (salesOrderNumber && salesOrderNumber.trim()) {
    const so = salesOrderNumber.trim();
    set.delete(`so:${so.toUpperCase()}`);
    set.delete(`so:${so.toLowerCase()}`);
  }
  if (tenderClientId && tenderClientId.trim()) {
    set.delete(`tender:${tenderClientId.trim()}`);
  }
  saveStoredSet(KEY_DELETED_CONTRACTS, set);
}

export function isContractDeleted(
  id?: string,
  contractNumber?: string,
  salesOrderNumber?: string,
  tenderClientId?: string
): boolean {
  if (!id && !contractNumber && !salesOrderNumber && !tenderClientId) return false;
  const set = getDeletedContractIds();
  if (id && (set.has(String(id).trim()) || set.has(String(id).trim().toLowerCase()))) return true;
  if (contractNumber && (set.has(`cnt:${contractNumber.trim().toUpperCase()}`) || set.has(`cnt:${contractNumber.trim().toLowerCase()}`))) return true;
  if (salesOrderNumber && (set.has(`so:${salesOrderNumber.trim().toUpperCase()}`) || set.has(`so:${salesOrderNumber.trim().toLowerCase()}`))) return true;
  if (tenderClientId && set.has(`tender:${tenderClientId.trim()}`)) return true;
  return false;
}

// ---------------- Documents ----------------
export function getDeletedDocumentIds(): Set<string> {
  return getStoredSet(KEY_DELETED_DOCUMENTS);
}

export function markDocumentAsDeleted(id: string): void {
  if (!id) return;
  const set = getDeletedDocumentIds();
  set.add(String(id));
  saveStoredSet(KEY_DELETED_DOCUMENTS, set);
}

export function unmarkDocumentAsDeleted(id: string): void {
  if (!id) return;
  const set = getDeletedDocumentIds();
  set.delete(String(id));
  saveStoredSet(KEY_DELETED_DOCUMENTS, set);
}

export function isDocumentDeleted(id: string): boolean {
  if (!id) return false;
  return getDeletedDocumentIds().has(String(id));
}

// ---------------- Sales Orders (Órdenes de Venta) ----------------
export function getDeletedSalesOrderIds(): Set<string> {
  return getStoredSet(KEY_DELETED_SALES_ORDERS);
}

export function markSalesOrderAsDeleted(
  id: string,
  salesOrderNumber?: string,
  tenderClientId?: string,
  contractId?: string
): void {
  if (!id && !salesOrderNumber) return;
  const set = getDeletedSalesOrderIds();
  if (id) {
    set.add(String(id).trim());
    set.add(String(id).trim().toLowerCase());
  }
  if (salesOrderNumber && !['OV', 'SINOV'].includes(salesOrderNumber.trim().toUpperCase())) {
    set.add(`so:${salesOrderNumber.trim().toUpperCase()}`);
    set.add(`so:${salesOrderNumber.trim().toLowerCase()}`);
  }
  saveStoredSet(KEY_DELETED_SALES_ORDERS, set);
}

export function unmarkSalesOrderAsDeleted(
  id: string,
  salesOrderNumber?: string,
  tenderClientId?: string,
  contractId?: string
): void {
  if (!id && !salesOrderNumber && !tenderClientId && !contractId) return;
  const set = getDeletedSalesOrderIds();
  if (id) {
    set.delete(String(id).trim());
    set.delete(String(id).trim().toLowerCase());
  }
  if (salesOrderNumber) {
    set.delete(`so:${salesOrderNumber.trim().toUpperCase()}`);
    set.delete(`so:${salesOrderNumber.trim().toLowerCase()}`);
  }
  saveStoredSet(KEY_DELETED_SALES_ORDERS, set);
}

export function isSalesOrderDeleted(
  id?: string,
  salesOrderNumber?: string,
  tenderClientId?: string,
  contractId?: string
): boolean {
  if (!id && !salesOrderNumber) return false;
  const set = getDeletedSalesOrderIds();
  if (id && (set.has(String(id).trim()) || set.has(String(id).trim().toLowerCase()))) {
    return true;
  }
  if (salesOrderNumber && !['OV', 'SINOV'].includes(salesOrderNumber.trim().toUpperCase())) {
    if (set.has(`so:${salesOrderNumber.trim().toUpperCase()}`) || set.has(`so:${salesOrderNumber.trim().toLowerCase()}`)) {
      return true;
    }
  }
  return false;
}

// ---------------- Sales Invoices (Facturas de Venta) ----------------
export function getDeletedSalesInvoiceIds(): Set<string> {
  return getStoredSet(KEY_DELETED_SALES_INVOICES);
}

export function markSalesInvoiceAsDeleted(id: string, invoiceNumber?: string, salesOrderId?: string): void {
  if (!id && !invoiceNumber && !salesOrderId) return;
  const set = getDeletedSalesInvoiceIds();
  if (id) {
    set.add(String(id).trim());
    set.add(String(id).trim().toLowerCase());
  }
  if (invoiceNumber) {
    const num = String(invoiceNumber).trim();
    set.add(num);
    set.add(num.toUpperCase());
  }
  if (salesOrderId) {
    set.add(`order:${String(salesOrderId).trim()}`);
  }
  saveStoredSet(KEY_DELETED_SALES_INVOICES, set);
}

export function unmarkSalesInvoiceAsDeleted(
  id: string,
  invoiceNumber?: string,
  salesOrderId?: string
): void {
  if (!id && !invoiceNumber && !salesOrderId) return;
  const set = getDeletedSalesInvoiceIds();
  if (id) {
    set.delete(String(id).trim());
    set.delete(String(id).trim().toLowerCase());
  }
  if (invoiceNumber) {
    const num = String(invoiceNumber).trim();
    set.delete(num);
    set.delete(num.toUpperCase());
  }
  if (salesOrderId) {
    set.delete(`order:${String(salesOrderId).trim()}`);
  }
  saveStoredSet(KEY_DELETED_SALES_INVOICES, set);
}

export function isSalesInvoiceDeleted(id?: string, invoiceNumber?: string, salesOrderId?: string): boolean {
  if (!id && !invoiceNumber && !salesOrderId) return false;
  const set = getDeletedSalesInvoiceIds();
  if (id && (set.has(String(id).trim()) || set.has(String(id).trim().toLowerCase()))) {
    return true;
  }
  if (invoiceNumber) {
    const num = String(invoiceNumber).trim();
    if (set.has(num) || set.has(num.toUpperCase())) {
      return true;
    }
  }
  if (salesOrderId && set.has(`order:${String(salesOrderId).trim()}`)) {
    return true;
  }
  return false;
}

// ---------------- Multi-Device Cloud Sync Integration ----------------
export interface CloudTombstonesPayload {
  deletedQuotes?: string[];
  deletedEquipments?: string[];
  deletedTenders?: string[];
  deletedContracts?: string[];
  deletedSalesOrders?: string[];
  deletedSalesInvoices?: string[];
  deletedDocuments?: string[];
  lastAction?: {
    type: string;
    id: string;
    code?: string;
    quoteNumber?: string;
    invoiceNumber?: string;
    salesOrderNumber?: string;
    tenderClientId?: string;
    contractId?: string;
    timestamp?: number;
  };
}

export function mergeCloudTombstones(payload: CloudTombstonesPayload): void {
  if (!payload || typeof payload !== 'object') return;
  if (Array.isArray(payload.deletedTenders) && payload.deletedTenders.length > 0) {
    const set = getDeletedTenderIds();
    payload.deletedTenders.forEach((id) => set.add(String(id)));
    saveStoredSet(KEY_DELETED_TENDERS, set);
  }
  if (Array.isArray(payload.deletedContracts) && payload.deletedContracts.length > 0) {
    const set = getDeletedContractIds();
    payload.deletedContracts.forEach((id) => set.add(String(id)));
    saveStoredSet(KEY_DELETED_CONTRACTS, set);
  }
  if (Array.isArray(payload.deletedSalesOrders) && payload.deletedSalesOrders.length > 0) {
    const set = getDeletedSalesOrderIds();
    payload.deletedSalesOrders.forEach((id) => {
      set.add(String(id).trim());
      set.add(String(id).trim().toLowerCase());
    });
    saveStoredSet(KEY_DELETED_SALES_ORDERS, set);
  }
  if (Array.isArray(payload.deletedSalesInvoices) && payload.deletedSalesInvoices.length > 0) {
    const set = getDeletedSalesInvoiceIds();
    payload.deletedSalesInvoices.forEach((id) => {
      set.add(String(id).trim());
      set.add(String(id).trim().toLowerCase());
    });
    saveStoredSet(KEY_DELETED_SALES_INVOICES, set);
  }
  if (Array.isArray(payload.deletedQuotes) && payload.deletedQuotes.length > 0) {
    const set = getDeletedQuoteIds();
    payload.deletedQuotes.forEach((id) => {
      set.add(String(id).trim());
      set.add(String(id).trim().toLowerCase());
    });
    saveStoredSet(KEY_DELETED_QUOTES, set);
  }
  if (Array.isArray(payload.deletedEquipments) && payload.deletedEquipments.length > 0) {
    const set = getDeletedEquipmentIds();
    payload.deletedEquipments.forEach((id) => set.add(String(id)));
    saveStoredSet(KEY_DELETED_EQUIPMENTS, set);
  }
  if (Array.isArray(payload.deletedDocuments) && payload.deletedDocuments.length > 0) {
    const set = getDeletedDocumentIds();
    payload.deletedDocuments.forEach((id) => set.add(String(id)));
    saveStoredSet(KEY_DELETED_DOCUMENTS, set);
  }

  // Also apply specific lastAction payload if present
  if (payload.lastAction && payload.lastAction.id) {
    const { type, id, code, quoteNumber, invoiceNumber, salesOrderNumber, tenderClientId, contractId } = payload.lastAction;
    if (type === 'tender') markTenderAsDeleted(id);
    else if (type === 'contract') markContractAsDeleted(id);
    else if (type === 'salesOrder') markSalesOrderAsDeleted(id, salesOrderNumber, tenderClientId, contractId);
    else if (type === 'salesInvoice') markSalesInvoiceAsDeleted(id, invoiceNumber);
    else if (type === 'quote') markQuoteAsDeleted(id, quoteNumber);
    else if (type === 'equipment') markEquipmentAsDeleted(id, code);
    else if (type === 'document') markDocumentAsDeleted(id);
  }
}
