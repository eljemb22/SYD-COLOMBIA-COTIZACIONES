import { SavedQuote, QuoteHeader, QuoteItem, QuoteStatus } from '../types';
import { extractDateCode, getTodayDateCode, incrementConsecutive, parseQuoteNumber, setConsecutive } from './quoteConsecutive';
import { saveQuoteToFirestore, deleteQuoteFromFirestore } from '../services/realtimeSync';
import { saveOrUpdateClientRecord } from './clientStorage';

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
    return Array.isArray(parsed) ? parsed : [];
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
    localStorage.setItem(QUOTES_STORAGE_KEY, JSON.stringify(quotes));
  } catch (e) {
    console.error('Failed to persist quotes to localStorage', e);
  }
}

/**
 * Saves or updates a quote in the database
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

  const subtotal = items.reduce((acc, it) => acc + (it.totalSalePrice || 0), 0);
  const iva = items.reduce((acc, it) => {
    const rate = it.taxExempt ? 0 : (it.taxRate !== undefined ? it.taxRate : (header.taxRate ?? 0.19));
    return acc + Math.round((it.totalSalePrice || 0) * rate);
  }, 0);
  const total = subtotal + iva;
  const totalQuantity = items.reduce((acc, it) => acc + (it.quantity || 0), 0);
  const dateCode = extractDateCode(header.date);

  // Check if we are updating an existing quote by ID or quoteNumber
  let targetIndex = -1;
  if (existingId) {
    targetIndex = quotes.findIndex((q) => q.id === existingId);
  } else {
    // If quote with same quoteNumber exists, update it
    targetIndex = quotes.findIndex((q) => q.quoteNumber === header.quoteNumber);
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
    items: JSON.parse(JSON.stringify(items)),
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
 * Deletes a quote from the database
 */
export function deleteSavedQuote(id: string): boolean {
  const quotes = getSavedQuotes();
  const filtered = quotes.filter((q) => q.id !== id);
  if (filtered.length === quotes.length) return false;
  persistQuotes(filtered);
  // Realtime Cloud Deletion with Error Handler
  deleteQuoteFromFirestore(id).catch(() => {});
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
