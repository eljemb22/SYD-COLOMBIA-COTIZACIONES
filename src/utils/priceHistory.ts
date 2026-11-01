/**
 * Historial de precios de equipos médicos.
 * Guarda un registro cada vez que se guarda una cotización, para poder
 * consultar cómo han variado los precios de costo y venta con el tiempo.
 */

import { QuoteItem, QuoteHeader, SavedQuote } from '../types';

const PRICE_HISTORY_STORAGE_KEY = 'syd_price_history_database';

/**
 * Obtiene todo el historial de precios almacenado
 */
export function getPriceHistory(): PriceHistoryEntry[] {
  try {
    const raw = localStorage.getItem(PRICE_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load price history', e);
    return [];
  }
}

/**
 * Guarda una lista completa de historial de precios
 */
function persistPriceHistory(history: PriceHistoryEntry[]): void {
  try {
    localStorage.setItem(PRICE_HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Failed to persist price history', e);
  }
}

/**
 * Registra los precios de los items de una cotización recién guardada
 */
export function recordPriceHistoryFromQuote(
  header: QuoteHeader,
  items: QuoteItem[]
): void {
  const history = getPriceHistory();
  const now = new Date().toISOString();

  const newEntries: PriceHistoryEntry[] = items.map((item) => ({
    id: `price-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    equipmentName: item.name,
    brand: item.brand,
    model: item.model,
    unitCostCOP: item.unitCostCOP || 0,
    unitSalePriceCOP: item.unitSalePrice || 0,
    marginPercent:
      item.unitCostCOP > 0
        ? Math.round(((item.unitSalePrice - item.unitCostCOP) / item.unitCostCOP) * 100)
        : 0,
    quoteNumber: header.quoteNumber,
    quoteDate: header.date,
    clientName: header.clientName,
  }));

  const updated = [...history, ...newEntries];
  persistPriceHistory(updated);
}

/**
 * Obtiene el historial de precios filtrado por equipo (nombre + marca + modelo)
 */
export function getPriceHistoryForEquipment(
  equipmentName: string,
  brand?: string,
  model?: string
): PriceHistoryEntry[] {
  const all = getPriceHistory();
  return all.filter((h) => {
    const matchName = h.equipmentName.toLowerCase() === equipmentName.toLowerCase();
    const matchBrand = !brand || h.brand.toLowerCase() === brand.toLowerCase();
    const matchModel = !model || h.model.toLowerCase() === model.toLowerCase();
    return matchName && matchBrand && matchModel;
  });
}

/**
 * Obtiene el precio más reciente de venta para un equipo
 */
export function getLatestPriceForEquipment(
  equipmentName: string,
  brand?: string,
  model?: string
): PriceHistoryEntry | null {
  const history = getPriceHistoryForEquipment(equipmentName, brand, model);
  if (history.length === 0) return null;
  // Ordenar por fecha descendente y tomar el primero
  return history.sort((a, b) => (a.quoteDate < b.quoteDate ? 1 : -1))[0];
}

/**
 * Obtiene estadísticas de precios (promedio, mínimo, máximo)
 */
export function getPriceStatsForEquipment(
  equipmentName: string,
  brand?: string,
  model?: string
): {
  count: number;
  avgSalePrice: number;
  minSalePrice: number;
  maxSalePrice: number;
  avgMargin: number;
} {
  const history = getPriceHistoryForEquipment(equipmentName, brand, model);
  if (history.length === 0) {
    return { count: 0, avgSalePrice: 0, minSalePrice: 0, maxSalePrice: 0, avgMargin: 0 };
  }

  const salePrices = history.map((h) => h.unitSalePriceCOP);
  const margins = history.map((h) => h.marginPercent);

  return {
    count: history.length,
    avgSalePrice: Math.round(salePrices.reduce((a, b) => a + b, 0) / salePrices.length),
    minSalePrice: Math.min(...salePrices),
    maxSalePrice: Math.max(...salePrices),
    avgMargin: Math.round(margins.reduce((a, b) => a + b, 0) / margins.length),
  };
}
