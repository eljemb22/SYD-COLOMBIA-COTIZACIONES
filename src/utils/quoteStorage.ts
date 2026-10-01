import { SavedQuote, QuoteHeader, QuoteItem, QuoteStatus } from '../types';
import { extractDateCode, getTodayDateCode, incrementConsecutive, parseQuoteNumber, setConsecutive } from './quoteConsecutive';
import { saveQuoteToFirestore, deleteQuoteFromFirestore } from '../services/realtimeSync';
import { saveOrUpdateClientRecord } from './clientStorage';
import { isQuoteDeleted, markQuoteAsDeleted, unmarkQuoteAsDeleted } from './tombstones';

const QUOTES_STORAGE_KEY = 'syd_saved_quotes_database_v2';

// Clean initial state: no dummy quotes stored by default
const SEED_QUOTES: SavedQuote[] = [];

/**
 * Retrieves all saved quotes from localStorage or seeds initial database
 */
export function getSavedQuotes(): SavedQuote[] {
  try {
    const raw = localStorage.getItem(QUOTES_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Strict filter to guarantee deleted quotes (like 23092026-1) are never returned
    return parsed.filter((q) => q && !isQuoteDeleted(q.id, q.quoteNumber));
  } catch (e) {
    console.error('Failed to load saved quotes from localStorage', e);
    return [];
  }
}

/**
 * Saves all quotes to localStorage
 */
function persistQuotes(quotes: SavedQuote[]): void {
  try {
    // Purge any deleted quotes before persisting
    const clean = quotes.filter((q) => q && !isQuoteDeleted(q.id, q.quoteNumber));
    localStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(clean));
  } catch (e) {
    console.error('Failed to persist quotes to localStorage', e);
  }
}

/**
 * Saves or updates a quote in the database with strict validation
 */
export function saveOrUpdateQuote(
  header: QuoteHeader,
  items: QuoteItem[],
  status: QuoteStatus = 'Borrador',
  letterheadUrl?: string | null,
  marginSettings?: { subirBajar: number; izqDer: number; tableScale: number },
  existingId?: string
): SavedQuote {
  const quotes = getSavedQuotes();
  const now = new Date().toISOString();

  // Strict validation check: filter out malformed or empty items
  const validItems = (items || []).filter((it) => it && (it.name || it.code || it.totalSalePrice));
  const subtotal = validItems.reduce((acc, it) => acc + (it.totalSalePrice || 0), 0);
  const iva = validItems.reduce((acc, it) => {
    const rate = it.taxExempt ? 0 : (it.taxRate !== undefined ? it.taxRate : (header.taxRate ?? 0.19));
    return acc + Math.round((it.totalSalePrice || 0) * rate);
  }, 0);
  const total = subtotal + iva;
  const totalQuantity = validItems.reduce((acc, it) => acc + (it.quantity || 0), 0);
  const dateCode = extractDateCode(header.date);

  // Check if we are updating an existing quote by ID or quoteNumber (ensuring not tombstoned)
  let targetIndex = -1;
  if (existingId) {
    targetIndex = quotes.findIndex((q) => q.id === existingId && !isQuoteDeleted(q.id, q.quoteNumber));
  } else if (header.quoteNumber) {
    targetIndex = quotes.findIndex((q) => q.quoteNumber === header.quoteNumber && !isQuoteDeleted(q.id, q.quoteNumber));
  }

  const quoteRecord: SavedQuote = {
    id: targetIndex >= 0 ? quotes[targetIndex].id : `quote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    quoteNumber: header.quoteNumber || `${dateCode}-1`,
    date: header.date,
    dateCode,
    clientName: header.clientName || 'Cliente No Especificado',
    nit: header.nit || '',
    contactPerson: header.contactPerson || '',
    contactEmail: header.contactEmail || '',
    contactPhone: header.contactPhone || '',
    city: header.city || '',
    validityDays: header.validityDays || 30,
    paymentTerms: header.paymentTerms || '',
    deliveryTime: header.deliveryTime || '',
    deliveryPlace: header.deliveryPlace || '',
    warrantyTerms: header.warrantyTerms || '',
    trainingTerms: header.trainingTerms || '',
    taxRate: header.taxRate ?? 0.19,
    advisorName: header.advisorName || '',
    advisorRole: header.advisorRole || '',
    advisorPhone: header.advisorPhone || '',
    advisorEmail: header.advisorEmail || '',
    notes: header.notes || '',
    items: JSON.parse(JSON.stringify(validItems)),
    subtotal,
    iva,
    total,
    totalQuantity,
    status: targetIndex >= 0 ? (status || quotes[targetIndex].status) : status,
    savedAt: targetIndex >= 0 ? quotes[targetIndex].savedAt : now,
    updatedAt: now,
    letterheadUrl: letterheadUrl !== undefined ? letterheadUrl : (targetIndex >= 0 ? quotes[targetIndex].letterheadUrl : null),
    marginSettings: marginSettings || {
      subirBajar: 154,
      izqDer: 78,
      tableScale: 85,
    },
  };

  // Re-activate this quote in case it had previously been tombstoned
  unmarkQuoteAsDeleted(quoteRecord.id, quoteRecord.quoteNumber);

  if (targetIndex >= 0) {
    quotes[targetIndex] = quoteRecord;
  } else {
    quotes.unshift(quoteRecord);
  }

  // Update consecutive counter in storage to ensure it's at least this quote's count
  const { count } = parseQuoteNumber(quoteRecord.quoteNumber);
  setConsecutive(dateCode, count);

  // Automatically save/update client into Central Clients Directory
  if (header.clientName && header.clientName.trim() && header.clientName.trim() !== 'NOMBRE DEL CLIENTE O INSTITUCIÓN' && header.clientName.trim() !== 'Cliente No Especificado') {
    saveOrUpdateClientRecord({
      name: header.clientName.trim(),
      nit: header.nit || '',
      city: header.city || '',
      contactPerson: header.contactPerson || '',
      contactEmail: header.contactEmail || '',
      contactPhone: header.contactPhone || '',
      source: 'cotizacion',
    }).catch(() => {});
  }

  persistQuotes(quotes);
  // Realtime Cloud Sync
  saveQuoteToFirestore(quoteRecord).catch(() => {});
  return quoteRecord;
}

/**
 * Updates status of a quote (e.g. Borrador -> Enviada -> Aprobada)
 */
export function updateQuoteStatus(id: string, newStatus: QuoteStatus): SavedQuote | null {
  const quotes = getSavedQuotes();
  const index = quotes.findIndex((q) => q.id === id);
  if (index === -1) return null;

  quotes[index] = {
    ...quotes[index],
    status: newStatus,
    updatedAt: new Date().toISOString(),
  };

  persistQuotes(quotes);
  // Realtime Cloud Sync
  saveQuoteToFirestore(quotes[index]).catch(() => {});
  return quotes[index];
}

/**
 * Deletes a quote from the database permanently and cleans all cached drafts
 */
export function deleteSavedQuote(id: string): boolean {
  const quotes = getSavedQuotes();
  const target = quotes.find((q) => q.id === id);
  if (target) {
    markQuoteAsDeleted(target.id, target.quoteNumber);
  } else {
    markQuoteAsDeleted(id);
  }

  const filtered = quotes.filter((q) => q.id !== id && (!target || q.quoteNumber !== target.quoteNumber));
  persistQuotes(filtered);

  // Purge any temporary draft keys from localStorage
  try {
    localStorage.removeItem('syd_current_quote_draft');
    localStorage.removeItem('syd_quote_draft');
    localStorage.removeItem('syd_active_quote_id');
  } catch (_) {}

  // Realtime Cloud Deletion with Error Handler and server snapshot sync
  deleteQuoteFromFirestore(id, target?.quoteNumber).catch(() => {});
  return true;
}

/**
 * Duplicates a quote and generates a new daily consecutive number
 */
export function duplicateSavedQuote(id: string): SavedQuote | null {
  const quotes = getSavedQuotes();
  const source = quotes.find((q) => q.id === id);
  if (!source) return null;

  const todayCode = getTodayDateCode();
  const nextQuoteNum = incrementConsecutive(todayCode);
  const now = new Date().toISOString();

  const newQuote: SavedQuote = {
    ...JSON.parse(JSON.stringify(source)),
    id: `quote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    quoteNumber: nextQuoteNum,
    dateCode: todayCode,
    status: 'Borrador',
    savedAt: now,
    updatedAt: now,
  };

  quotes.unshift(newQuote);
  persistQuotes(quotes);
  // Realtime Cloud Sync
  saveQuoteToFirestore(newQuote).catch((e) => console.error('Cloud duplicate quote sync error:', e));
  return newQuote;
}
