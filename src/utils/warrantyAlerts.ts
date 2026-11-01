/**
 * Gestión de alertas de garantía por vencer para equipos médicos vendidos.
 */

import { QuoteItem, QuoteHeader, WarrantyAlert } from '../types';

const WARRANTY_ALERTS_STORAGE_KEY = 'syd_warranty_alerts_database';

/**
 * Obtiene todas las alertas de garantía almacenadas
 */
export function getWarrantyAlerts(): WarrantyAlert[] {
  try {
    const raw = localStorage.getItem(WARRANTY_ALERTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to load warranty alerts', e);
    return [];
  }
}

/**
 * Guarda la lista completa de alertas
 */
function persistWarrantyAlerts(alerts: WarrantyAlert[]): void {
  try {
    localStorage.setItem(WARRANTY_ALERTS_STORAGE_KEY, JSON.stringify(alerts));
  } catch (e) {
    console.error('Failed to persist warranty alerts', e);
  }
}

/**
 * Calcula los días restantes hasta una fecha
 */
function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Determina la severidad según los días restantes
 */
function severityForDays(days: number): 'critica' | 'media' | 'baja' {
  if (days <= 30) return 'critica';
  if (days <= 90) return 'media';
  return 'baja';
}

/**
 * Registra alertas de garantía para los equipos de una cotización que tengan fecha de garantía
 */
export function registerWarrantyAlertsFromQuote(
  header: QuoteHeader,
  items: QuoteItem[]
): void {
  const existing = getWarrantyAlerts();
  const now = new Date().toISOString();

  const newAlerts: WarrantyAlert[] = items
    .filter((item) => item.warrantyMonths && item.warrantyMonths > 0)
    .map((item) => {
      // La fecha de vencimiento se calcula como fecha de cotización + meses de garantía
      const quoteDate = new Date(header.date);
      const warrantyEnd = new Date(quoteDate);
      warrantyEnd.setMonth(warrantyEnd.getMonth() + item.warrantyMonths!);

      const daysRemaining = daysUntil(warrantyEnd.toISOString());

      return {
        id: `warranty-${item.id}-${header.quoteNumber}`,
        equipmentName: item.name,
        brand: item.brand,
        model: item.model,
        serialNumber: item.serialNumber,
        clientName: header.clientName,
        warrantyEndDate: warrantyEnd.toISOString().split('T')[0],
        daysRemaining,
        severity: severityForDays(daysRemaining),
        quoteNumber: header.quoteNumber,
      };
    });

  // Evitar duplicados: actualizar si ya existe una alerta para ese equipo y cotización
  const updated: WarrantyAlert[] = [];
  const processedIds = new Set<string>();

  for (const alert of newAlerts) {
    const existingIdx = existing.findIndex(
      (a) => a.equipmentName === alert.equipmentName &&
             a.brand === alert.brand &&
             a.model === alert.model &&
             a.clientName === alert.clientName
    );
    if (existingIdx >= 0) {
      updated.push({ ...existing[existingIdx], ...alert });
      processedIds.add(existing[existingIdx].id);
    } else {
      updated.push(alert);
      processedIds.add(alert.id);
    }
  }

  // Mantener alertas existentes que no se hayan actualizado
  for (const alert of existing) {
    if (!processedIds.has(alert.id)) {
      updated.push(alert);
    }
  }

  persistWarrantyAlerts(updated);
}

/**
 * Obtiene solo las alertas críticas (garantía vence en 30 días o menos)
 */
export function getCriticalWarrantyAlerts(): WarrantyAlert[] {
  return getWarrantyAlerts().filter((a) => a.severity === 'critica');
}

/**
 * Obtiene alertas próximas a vencer (30-90 días)
 */
export function getUpcomingWarrantyAlerts(): WarrantyAlert[] {
  return getWarrantyAlerts().filter((a) => a.severity === 'media');
}

/**
 * Marca una alerta como resuelta (elimínala)
 */
export function dismissWarrantyAlert(alertId: string): void {
  const alerts = getWarrantyAlerts();
  const filtered = alerts.filter((a) => a.id !== alertId);
  persistWarrantyAlerts(filtered);
}
