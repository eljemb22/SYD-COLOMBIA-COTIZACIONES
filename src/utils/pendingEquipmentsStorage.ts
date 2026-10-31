/**
 * SYD Colombia - Almacenamiento y Gestión de Equipos de Emergencia Pendientes por Crear
 * Permite registrar equipos cotizados rápidamente que aún no existen en el catálogo oficial,
 * para luego completarlos en la Ventana 3 (Catálogo de Equipos).
 */

export interface PendingCatalogEquipment {
  id: string;
  name: string;
  brand: string;
  model: string;
  quantityQuoted: number;
  baseCostCOP: number;
  suggestedSalePriceCOP?: number;
  appliedFactorKey?: string;
  quoteOrigin?: string; // Ej: "Cotización COT-2026-004"
  clientOrigin?: string; // Ej: "Hospital San Rafael"
  quotedDate: string; // ISO string
  status: 'pendiente' | 'creado' | 'descartado';
  createdEquipmentId?: string;
  createdEquipmentCode?: string;
  createdAt: string;
}

const STORAGE_KEY = 'syd_pending_catalog_equipments_v1';

export const getPendingCatalogEquipments = (): PendingCatalogEquipment[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error al leer equipos pendientes por crear:', e);
    return [];
  }
};

export const savePendingCatalogEquipments = (items: PendingCatalogEquipment[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('syd-pending-equipments-updated', { detail: items }));
  } catch (e) {
    console.error('Error al guardar equipos pendientes por crear:', e);
  }
};

export const addPendingCatalogEquipment = (
  item: Omit<PendingCatalogEquipment, 'id' | 'createdAt' | 'status'>
): PendingCatalogEquipment => {
  const current = getPendingCatalogEquipments();
  const newItem: PendingCatalogEquipment = {
    ...item,
    id: `pending-eq-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    status: 'pendiente',
    createdAt: new Date().toISOString(),
  };

  const updated = [newItem, ...current];
  savePendingCatalogEquipments(updated);
  return newItem;
};

export const updatePendingCatalogEquipment = (
  id: string,
  updates: Partial<PendingCatalogEquipment>
): void => {
  const current = getPendingCatalogEquipments();
  const updated = current.map((item) => (item.id === id ? { ...item, ...updates } : item));
  savePendingCatalogEquipments(updated);
};

export const deletePendingCatalogEquipment = (id: string): void => {
  const current = getPendingCatalogEquipments();
  const updated = current.filter((item) => item.id !== id);
  savePendingCatalogEquipments(updated);
};

export const markPendingAsCreated = (
  id: string,
  officialEquipmentId: string,
  officialCode?: string
): void => {
  const current = getPendingCatalogEquipments();
  const updated = current.map((item) =>
    item.id === id
      ? {
          ...item,
          status: 'creado' as const,
          createdEquipmentId: officialEquipmentId,
          createdEquipmentCode: officialCode,
        }
      : item
  );
  savePendingCatalogEquipments(updated);
};
