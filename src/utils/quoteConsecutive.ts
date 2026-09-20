/**
 * Utility to manage automatic daily quote consecutive numbers.
 * Format: DDMMAAAA-N (e.g., 24082026-1, 24082026-2)
 * Resets automatically each day (e.g., tomorrow starts at 25082026-1).
 */

import { SavedQuote } from '../types';

const STORAGE_KEY = 'syd_quote_counters';

const SPANISH_MONTHS: { [key: string]: string } = {
  enero: '01',
  febrero: '02',
  marzo: '03',
  abril: '04',
  mayo: '05',
  junio: '06',
  julio: '07',
  agosto: '08',
  septiembre: '09',
  octubre: '10',
  noviembre: '11',
  diciembre: '12',
};

const SPANISH_MONTH_NAMES_LOWER = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * Returns today's date code in format DDMMAAAA (e.g. 24082026)
 */
export function getTodayDateCode(d: Date = new Date()): string {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear());
  return `${day}${month}${year}`;
}

/**
 * Returns formatted Spanish date string in format "Barranquilla, 24 agosto de 2026"
 */
export function getFormattedSpanishDate(city: string = 'Barranquilla', d: Date = new Date()): string {
  const day = d.getDate();
  const monthName = SPANISH_MONTH_NAMES_LOWER[d.getMonth()];
  const year = d.getFullYear();
  const cityName = city && city.trim() ? city.trim() : 'Barranquilla';
  return `${cityName}, ${day} ${monthName} de ${year}`;
}

/**
 * Parses any date string (e.g., "Barranquilla, 24 agosto de 2026", "2026-08-24", "24/08/2026")
 * and extracts the DDMMAAAA code. If parsing fails, returns today's date code.
 */
export function extractDateCode(dateStr: string): string {
  if (!dateStr || typeof dateStr !== 'string') {
    return getTodayDateCode();
  }

  // Check for ISO format: YYYY-MM-DD
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return `${dd}${mm}${yyyy}`;
  }

  // Check for DD/MM/YYYY or DD-MM-YYYY
  const slashMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (slashMatch) {
    const [, dd, mm, yyyy] = slashMatch;
    return `${dd.padStart(2, '0')}${mm.padStart(2, '0')}${yyyy}`;
  }

  // Check for Spanish text: "24 agosto de 2026", "18 de Agosto de 2026", "Barranquilla, 24 agosto de 2026"
  const spanishMatch = dateStr.match(/(\d{1,2})\s+(?:de\s+)?([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+(?:de|del)\s+(\d{4})/i);
  if (spanishMatch) {
    const dd = spanishMatch[1].padStart(2, '0');
    const monthWord = spanishMatch[2].toLowerCase();
    const yyyy = spanishMatch[3];
    const mm = SPANISH_MONTHS[monthWord] || String(new Date().getMonth() + 1).padStart(2, '0');
    return `${dd}${mm}${yyyy}`;
  }

  return getTodayDateCode();
}

/**
 * Gets all saved counters from localStorage
 */
function getAllCounters(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Saves counters dictionary to localStorage
 */
function saveAllCounters(counters: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counters));
  } catch (e) {
    console.error('Failed to save quote counters', e);
  }
}

/**
 * Parses any quote number string (e.g. "24082026-2", "24082026-1") into its dateCode and counter number
 */
export function parseQuoteNumber(quoteNum: string): { dateCode: string; count: number } {
  if (!quoteNum || typeof quoteNum !== 'string') {
    const today = getTodayDateCode();
    return { dateCode: today, count: 1 };
  }
  const parts = quoteNum.trim().split('-');
  const dateCode = parts[0] || getTodayDateCode();
  const count = parts.length > 1 ? parseInt(parts[1], 10) || 1 : 1;
  return { dateCode, count };
}

/**
 * Calculates the next available daily quote number strictly based on saved quotes and storage.
 * If no quotes have been saved for this dateCode, starts at 1 (e.g. DDMMAAAA-1).
 */
export function getNextDailyQuoteNumber(savedQuotesList: SavedQuote[] = [], targetDateStr?: string): string {
  const dateCode = targetDateStr ? extractDateCode(targetDateStr) : getTodayDateCode();

  // Inspect all quotes saved for this date code
  let maxCount = 0;
  for (const q of savedQuotesList || []) {
    const qCode = q.dateCode || extractDateCode(q.date);
    if (qCode === dateCode || (q.quoteNumber && q.quoteNumber.startsWith(`${dateCode}-`))) {
      const { count } = parseQuoteNumber(q.quoteNumber);
      if (count > maxCount) {
        maxCount = count;
      }
    }
  }

  // If no saved quotes exist for this date code, start cleanly at 1
  const nextCount = maxCount > 0 ? maxCount + 1 : 1;

  return `${dateCode}-${nextCount}`;
}

/**
 * Gets the current active consecutive count for a given date code.
 * Defaults to 1 if no quotes exist for the day.
 */
export function getCurrentConsecutive(dateCode: string = getTodayDateCode(), savedQuotesList: SavedQuote[] = []): number {
  let maxSaved = 0;
  for (const q of savedQuotesList || []) {
    const qCode = q.dateCode || extractDateCode(q.date);
    if (qCode === dateCode || (q.quoteNumber && q.quoteNumber.startsWith(`${dateCode}-`))) {
      const { count } = parseQuoteNumber(q.quoteNumber);
      if (count > maxSaved) {
        maxSaved = count;
      }
    }
  }

  return maxSaved > 0 ? maxSaved + 1 : 1;
}

/**
 * Returns the formatted quote number string for a given date code and saved quotes: "24082026-1"
 */
export function getFormattedQuoteNumber(dateCode: string = getTodayDateCode(), savedQuotesList: SavedQuote[] = []): string {
  const current = getCurrentConsecutive(dateCode, savedQuotesList);
  return `${dateCode}-${current}`;
}

/**
 * Increments the consecutive for the date code and returns the new quote number string.
 */
export function incrementConsecutive(dateCode: string = getTodayDateCode()): string {
  const counters = getAllCounters();
  const current = counters[dateCode] || 1;
  const next = current + 1;
  counters[dateCode] = next;
  saveAllCounters(counters);
  return `${dateCode}-${next}`;
}

/**
 * Advances from the given quote number (e.g. "24082026-1" -> "24082026-2"),
 * saves the new counter to localStorage, and returns the new string.
 */
export function advanceFromCurrentQuoteNumber(currentQuoteNumber: string): string {
  const { dateCode, count } = parseQuoteNumber(currentQuoteNumber);
  const nextCount = count + 1;
  return setConsecutive(dateCode, nextCount);
}

/**
 * Sets specific consecutive number for a date code
 */
export function setConsecutive(dateCode: string, num: number): string {
  const counters = getAllCounters();
  counters[dateCode] = Math.max(1, num);
  saveAllCounters(counters);
  return `${dateCode}-${counters[dateCode]}`;
}
