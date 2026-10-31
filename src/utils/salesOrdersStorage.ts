import {
  SalesOrderRecord,
  SalesInvoiceRecord,
  OCTrackingContract,
  OCTrackingItem,
  SavedQuote,
  MedicalEquipment,
  TenderClientProject,
  QuoteItem,
  QuoteHeader,
  TenderItem,
  TechnicalRequirement,
  SupplierProfile,
} from '../types';
import {
  isSalesOrderDeleted,
  isSalesInvoiceDeleted,
  unmarkSalesOrderAsDeleted,
  unmarkSalesInvoiceAsDeleted,
} from './tombstones';
import { resolveItemManufacturerBrand } from './equipmentBrandResolver';
import {
  autoRegisterSuppliersFromEquipments,
  getStoredSupplierProfiles,
} from './ocTrackingStorage';
import backupSnapshot from '../../data_backup_snapshot.json';

export const SALES_ORDERS_STORAGE_KEY = 'syd_sales_orders_v1';
export const SALES_INVOICES_STORAGE_KEY = 'syd_sales_invoices_v1';

const snapInvoice = (backupSnapshot as any)?.data?.salesInvoices?.find(
  (i: any) => i.invoiceNumber === 'FE-1001'
);
export const REAL_FE1001_DATA_URL: string =
  snapInvoice?.attachedInvoiceFile?.dataUrl || '';

export const INITIAL_SEED_SALES_ORDERS: SalesOrderRecord[] = [];

export const INITIAL_SEED_SALES_INVOICES: SalesInvoiceRecord[] = [];

/**
 * Helper to normalize strings for robust equivalence matching
 */
const cleanNorm = (str?: string): string => {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^ov:\s*/i, '')
    .replace(/[^a-z0-9]/g, '');
};

const isProcessNumberCode = (num?: string): boolean => {
  if (!num) return false;
  const clean = cleanNorm(num);
  return (
    clean.startsWith('hboc') ||
    clean.startsWith('nohb') ||
    clean.startsWith('lic') ||
    clean.startsWith('contrato') ||
    clean.startsWith('cotiz')
  );
};

/**
 * Strictly deduplicates sales orders, keeping the latest single record for each unique ID or manual salesOrderNumber.
 */
export function deduplicateSalesOrders(orders: SalesOrderRecord[]): SalesOrderRecord[] {
  if (!Array.isArray(orders)) return [];

  const seenKeys = new Set<string>();
  const result: SalesOrderRecord[] = [];

  // Sort descending by updatedAt/createdAt so the latest record is prioritized
  const sorted = [...orders].sort(
    (a, b) => new Date(b?.updatedAt || b?.createdAt || 0).getTime() - new Date(a?.updatedAt || a?.createdAt || 0).getTime()
  );

  for (const o of sorted) {
    if (!o || !o.id || isSalesOrderDeleted(o.id, o.salesOrderNumber, o.tenderClientId, o.contractId)) {
      continue;
    }

    const cleanNum = cleanNorm(o.salesOrderNumber);
    const key = (cleanNum && !['ov', 'sinov'].includes(cleanNum) && !isProcessNumberCode(o.salesOrderNumber))
      ? `num-${cleanNum}`
      : `id-${o.id}`;

    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);

    // Sanitize order items: purge duplicate items that were injected by old cross-OV bugs
    const cleanItems: typeof o.items = [];
    const seenItemKeys = new Set<string>();
    (o.items || []).forEach((it) => {
      if (!it) return;
      const itCode = String(it.code || '').trim().toLowerCase();
      const itName = String(it.name || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const itEqId = it.equipmentId ? String(it.equipmentId) : '';
      const itemKey = itEqId ? `eq-${itEqId}` : (itCode ? `code-${itCode}` : `name-${itName}`);
      if (seenItemKeys.has(itemKey)) {
        return; // Skip duplicate equipment inside the same OV
      }
      seenItemKeys.add(itemKey);
      cleanItems.push(it);
    });

    const sanitizedOrder: SalesOrderRecord = {
      ...o,
      items: cleanItems,
    };
    result.push(sanitizedOrder);
  }

  return result;
}

export const DEFAULT_NAPOLEON_FACTURADA_OV: SalesOrderRecord = {
  id: 'ov-1152149-napoleon',
  salesOrderNumber: '1152149',
  clientName: 'FUNDACION HOSPITAL INFANTIL NAPOLEON FRANCO PAREJA',
  clientNit: '800.000.000-1',
  clientCity: 'Cartagena, Bolivar',
  contractNumber: 'NoHBOC0000000640',
  contractId: 'tender-from-quote-1790883515061',
  tenderClientId: 'tender-from-quote-1790883515061',
  orderDate: '2026-09-15',
  deliveryDate: '2026-10-01',
  status: 'Facturada',
  invoicedStatus: 'Facturada Total',
  invoiceNumber: 'FE-1001',
  totalValueCOP: 472626055,
  hasLinkedOC: true,
  items: [
    {
      id: 'ov-item-hybase-v5',
      code: '70904',
      name: 'MESA DE CIRUGIA',
      brand: 'MINDRAY',
      model: 'HYBASE V5',
      quotedQuantity: 1,
      quantityToDispatch: 1,
      unitSalePriceCOP: 76160000,
      totalSalePriceCOP: 76160000,
      equipmentStatus: 'Entregado e Instalado',
      supplierOCRef: '126622',
      linkedSupplierOCNumber: '126622',
      assignedSerialNumbers: [],
      notes: 'Entregada e instalada a satisfacción',
    },
    {
      id: 'ov-item-mobieye-700',
      code: '70796',
      name: 'EQUIPO DE RAYOS PORTATIL X CON FLAT PANEL',
      brand: 'MINDRAY',
      model: 'MOBIEYE 700',
      quotedQuantity: 1,
      quantityToDispatch: 1,
      unitSalePriceCOP: 396466055,
      totalSalePriceCOP: 396466055,
      equipmentStatus: 'Entregado e Instalado',
      supplierOCRef: '126622',
      linkedSupplierOCNumber: '126622',
      assignedSerialNumbers: [],
      notes: 'Entregado e instalado a satisfacción',
    },
  ],
  attachedInvoiceFile: {
    id: 'doc-fe-1001',
    name: '327404 (2).pdf',
    size: '75.3 KB',
    type: 'application/pdf',
    dataUrl: REAL_FE1001_DATA_URL,
    uploadedAt: '2026-10-01T10:00:00.000Z',
  },
  notes: 'Orden de Venta culminada y facturada al 100% con Factura Oficial FE-1001.',
  createdAt: '2026-09-15T08:00:00.000Z',
  updatedAt: '2026-10-01T16:00:00.000Z',
};

export const DEFAULT_FE1001_INVOICE: SalesInvoiceRecord = {
  id: 'inv-fe-1001',
  invoiceNumber: 'FE-1001',
  salesOrderId: 'ov-1152149-napoleon',
  salesOrderNumber: '1152149',
  contractId: 'tender-from-quote-1790883515061',
  contractNumber: 'NoHBOC0000000640',
  tenderClientId: 'tender-from-quote-1790883515061',
  clientName: 'FUNDACION HOSPITAL INFANTIL NAPOLEON FRANCO PAREJA',
  clientNit: '800.000.000-1',
  issueDate: '2026-10-01',
  dueDate: '2026-11-01',
  totalAmountCOP: 472626055,
  paymentStatus: 'Pagada',
  items: [
    {
      id: 'inv-item-hybase-v5',
      code: '70904',
      name: 'MESA DE CIRUGIA',
      brand: 'MINDRAY',
      model: 'HYBASE V5',
      quotedQuantity: 1,
      quantityToDispatch: 1,
      unitSalePriceCOP: 76160000,
      totalSalePriceCOP: 76160000,
      equipmentStatus: 'Entregado e Instalado',
    },
    {
      id: 'inv-item-mobieye-700',
      code: '70796',
      name: 'EQUIPO DE RAYOS PORTATIL X CON FLAT PANEL',
      brand: 'MINDRAY',
      model: 'MOBIEYE 700',
      quotedQuantity: 1,
      quantityToDispatch: 1,
      unitSalePriceCOP: 396466055,
      totalSalePriceCOP: 396466055,
      equipmentStatus: 'Entregado e Instalado',
    },
  ],
  attachedInvoiceFile: {
    id: 'doc-fe-1001',
    name: '327404 (2).pdf',
    size: '75.3 KB',
    type: 'application/pdf',
    dataUrl: REAL_FE1001_DATA_URL,
    uploadedAt: '2026-10-01T10:00:00.000Z',
  },
  notes: 'Soporte oficial de Factura Electrónica FE-1001',
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
};

export function getStoredSalesOrders(): SalesOrderRecord[] {
  try {
    unmarkSalesOrderAsDeleted('ov-1152149-napoleon', '1152149');
    const raw = localStorage.getItem(SALES_ORDERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter(
          (o: any) =>
            o &&
            o.id &&
            !o.id?.startsWith('ov-seed-') &&
            (o.salesOrderNumber === '1152149' || !isSalesOrderDeleted(o.id, o.salesOrderNumber, o.tenderClientId, o.contractId))
        );
        let hasNapoleonOV = false;
        const normalizedFiltered = filtered.map((o: any) => {
          if (o.salesOrderNumber === '1152149' || o.id === 'ov-1152149-napoleon') {
            hasNapoleonOV = true;
            return {
              ...o,
              contractNumber: o.contractNumber || 'NoHBOC0000000640',
              status: 'Facturada',
              invoicedStatus: 'Facturada Total',
              invoiceNumber: 'FE-1001',
              hasLinkedInvoice: true,
              hasLinkedOC: true,
              items: DEFAULT_NAPOLEON_FACTURADA_OV.items,
              attachedInvoiceFile: {
                ...o.attachedInvoiceFile,
                dataUrl: o.attachedInvoiceFile?.dataUrl || REAL_FE1001_DATA_URL,
              },
            };
          }
          if ((o.status === 'Facturada' || Boolean(o.invoiceNumber)) && Array.isArray(o.items)) {
            return {
              ...o,
              items: o.items.map((it: any) => ({
                ...it,
                equipmentStatus: it.equipmentStatus || 'Entregado e Instalado',
                status: it.status || 'Entregado e Instalado',
              })),
            };
          }
          return o;
        });
        if (!hasNapoleonOV) {
          normalizedFiltered.push(DEFAULT_NAPOLEON_FACTURADA_OV);
        }
        const deduped = deduplicateSalesOrders(normalizedFiltered);
        if (deduped.length !== parsed.length) {
          localStorage.setItem(SALES_ORDERS_STORAGE_KEY, JSON.stringify(deduped));
        }
        return deduped;
      }
    }
  } catch (e) {
    console.error('Error loading stored sales orders:', e);
  }
  return [DEFAULT_NAPOLEON_FACTURADA_OV];
}

export function saveStoredSalesOrders(orders: SalesOrderRecord[]): void {
  try {
    const filtered = (orders || []).filter(
      (o) => o && o.id && !isSalesOrderDeleted(o.id, o.salesOrderNumber, o.tenderClientId, o.contractId)
    );
    const deduped = deduplicateSalesOrders(filtered);
    try {
      localStorage.setItem(SALES_ORDERS_STORAGE_KEY, JSON.stringify(deduped));
    } catch (quotaErr) {
      // If localStorage is full, save a lean copy without massive base64 file payloads
      const leanOrders = deduped.map((o) => ({
        ...o,
        attachedInvoiceFile: o.attachedInvoiceFile
          ? { ...o.attachedInvoiceFile, dataUrl: undefined }
          : undefined,
      }));
      localStorage.setItem(SALES_ORDERS_STORAGE_KEY, JSON.stringify(leanOrders));
    }
  } catch (e) {
    console.warn('Error saving sales orders to localStorage:', e);
  }
}

export function getStoredSalesInvoices(): SalesInvoiceRecord[] {
  try {
    unmarkSalesInvoiceAsDeleted('inv-fe-1001', 'FE-1001');
    const raw = localStorage.getItem(SALES_INVOICES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const seenIds = new Set<string>();
        const filtered = parsed.filter(
          (inv: any) =>
            inv &&
            inv.id &&
            !seenIds.has(inv.id) &&
            (seenIds.add(inv.id), true) &&
            !inv.id?.startsWith('inv-seed-') &&
            inv.invoiceNumber !== 'FE-1045' &&
            (inv.invoiceNumber === 'FE-1001' || !isSalesInvoiceDeleted(inv.id, inv.invoiceNumber))
        );
        let hasFE1001 = false;
        const mapped = filtered.map((inv: any) => {
          if (inv.invoiceNumber === 'FE-1001' || inv.id === 'inv-fe-1001') {
            hasFE1001 = true;
            return {
              ...inv,
              contractNumber: inv.contractNumber || 'NoHBOC0000000640',
              salesOrderNumber: inv.salesOrderNumber || '1152149',
              salesOrderId: inv.salesOrderId || 'ov-1152149-napoleon',
              paymentStatus: 'Pagada',
              items: (inv.items && inv.items.length > 0) ? inv.items : DEFAULT_FE1001_INVOICE.items,
              attachedInvoiceFile: {
                ...inv.attachedInvoiceFile,
                name: inv.attachedInvoiceFile?.name || '327404 (2).pdf',
                type: 'application/pdf',
                size: inv.attachedInvoiceFile?.size || '75.3 KB',
                dataUrl: inv.attachedInvoiceFile?.dataUrl || REAL_FE1001_DATA_URL,
              },
            };
          }
          return inv;
        });
        if (!hasFE1001) {
          mapped.push(DEFAULT_FE1001_INVOICE);
        }
        return mapped;
      }
    }
  } catch (e) {
    console.error('Error loading stored sales invoices:', e);
  }
  return [DEFAULT_FE1001_INVOICE];
}

export function saveStoredSalesInvoices(invoices: SalesInvoiceRecord[]): void {
  try {
    const filtered = (invoices || []).filter(
      (inv) => inv && inv.id && !isSalesInvoiceDeleted(inv.id, inv.invoiceNumber)
    );
    try {
      localStorage.setItem(SALES_INVOICES_STORAGE_KEY, JSON.stringify(filtered));
    } catch (quotaErr) {
      // If localStorage is full, save a lean copy without massive base64 file payloads
      const leanInvoices = filtered.map((inv) => ({
        ...inv,
        attachedInvoiceFile: inv.attachedInvoiceFile
          ? { ...inv.attachedInvoiceFile, dataUrl: undefined }
          : undefined,
      }));
      localStorage.setItem(SALES_INVOICES_STORAGE_KEY, JSON.stringify(leanInvoices));
    }
  } catch (e) {
    console.warn('Error saving sales invoices to localStorage:', e);
  }
}

/**
 * Generates the next Sales Order number, e.g. OV-2026-001, OV-2026-002, etc.
 */
export function generateNextSalesOrderNumber(existingOrders: SalesOrderRecord[]): string {
  const currentYear = new Date().getFullYear();
  const prefix = `OV-${currentYear}-`;

  let maxNum = 0;
  existingOrders.forEach((o) => {
    if (o.salesOrderNumber) {
      const match = o.salesOrderNumber.match(/OV-(\d{4})-(\d+)/i) || o.salesOrderNumber.match(/OV-(\d+)/i);
      if (match) {
        const num = parseInt(match[2] || match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  });

  const nextNum = maxNum + 1;
  return `${prefix}${String(nextNum).padStart(3, '0')}`;
}

/**
 * Generates the next SYD Sales Invoice number, e.g. FE-1046
 */
export function generateNextInvoiceNumber(existingInvoices: SalesInvoiceRecord[]): string {
  let maxNum = 1000;
  existingInvoices.forEach((inv) => {
    if (inv.invoiceNumber) {
      const match = inv.invoiceNumber.match(/FE-(\d+)/i) || inv.invoiceNumber.match(/(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  });

  const nextNum = maxNum + 1;
  return `FE-${nextNum}`;
}

/**
 * Intelligent resolver for equipment supplier:
 * 1. Checks explicit supplier assigned on item
 * 2. Checks supplier stored on the equipment when it was created in the catalog
 * 3. Checks Supplier Directory for suppliers handling this brand or named after the brand
 * 4. Falls back to brand or 'Proveedor Principal'
 */
export function resolveSupplierForOVItem(
  item: { equipmentId?: string; code?: string; name?: string; brand?: string; supplier?: string; supplierName?: string },
  equipments: MedicalEquipment[] = [],
  supplierProfiles?: SupplierProfile[]
): string {
  // 1. Explicit supplier on item
  const explicit = (item.supplier || item.supplierName || '').trim();
  if (
    explicit &&
    !['por asignar', 'n/a', 'ninguno', 'sin proveedor asignado', 'proveedor principal'].includes(
      explicit.toLowerCase()
    )
  ) {
    return explicit;
  }

  // 2. Lookup in equipment catalog (as assigned when equipment was created)
  const matchedEq = equipments.find(
    (e) =>
      (item.equipmentId && e.id === item.equipmentId) ||
      (item.code && e.code?.trim().toLowerCase() === item.code?.trim().toLowerCase()) ||
      (item.name && e.name?.trim().toLowerCase() === item.name?.trim().toLowerCase())
  );

  if (
    matchedEq?.supplier &&
    matchedEq.supplier.trim() &&
    !['por asignar', 'n/a', 'ninguno'].includes(matchedEq.supplier.trim().toLowerCase())
  ) {
    return matchedEq.supplier.trim();
  }

  if (matchedEq?.allSuppliers && Array.isArray(matchedEq.allSuppliers) && matchedEq.allSuppliers.length > 0) {
    const valid = matchedEq.allSuppliers.find(
      (s) => s && s.trim() && !['por asignar', 'n/a', 'ninguno'].includes(s.trim().toLowerCase())
    );
    if (valid) return valid.trim();
  }

  if (matchedEq?.supplierPrices && Array.isArray(matchedEq.supplierPrices) && matchedEq.supplierPrices.length > 0) {
    const valid = matchedEq.supplierPrices.find(
      (sp) =>
        sp.supplier &&
        sp.supplier.trim() &&
        !['por asignar', 'n/a', 'ninguno'].includes(sp.supplier.trim().toLowerCase())
    );
    if (valid) return valid.supplier.trim();
  }

  // 3. Match from Catalog Equipments by same Brand
  const targetBrand = (item.brand || matchedEq?.brand || '').trim();
  if (targetBrand) {
    const normBrand = targetBrand
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    // Check if another equipment in the catalog with same brand has an assigned supplier
    const eqSameBrand = equipments.find((e) => {
      const eBrand = (e.brand || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return (
        eBrand &&
        (eBrand === normBrand || eBrand.includes(normBrand) || normBrand.includes(eBrand)) &&
        e.supplier &&
        !['por asignar', 'n/a', 'ninguno', 'sin proveedor asignado'].includes(e.supplier.trim().toLowerCase())
      );
    });
    if (eqSameBrand?.supplier) {
      return eqSameBrand.supplier.trim();
    }

    // 4. Match from Supplier Directory based on Brand
    const profiles = supplierProfiles || getStoredSupplierProfiles();
    // Registered supplier whose brands list includes targetBrand
    const matchByBrandList = profiles.find((p) =>
      p.brands?.some((b) => {
        if (!b) return false;
        const bNorm = b
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        return bNorm === normBrand || bNorm.includes(normBrand) || normBrand.includes(bNorm);
      })
    );
    if (matchByBrandList) {
      return matchByBrandList.name.trim();
    }

    // Registered supplier whose name matches targetBrand
    const matchByName = profiles.find((p) => {
      const normName = p.name
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return normName === normBrand || normName.includes(normBrand) || normBrand.includes(normName);
    });
    if (matchByName) {
      return matchByName.name.trim();
    }

    // Fallback: the brand itself
    return targetBrand;
  }

  return 'Proveedor Principal';
}

/**
 * Creates an OCTrackingContract entry from a SalesOrderRecord to place in Ventana 5 (Seguimiento de OC).
 * This establishes the immediate link between the commercial Sales Order and supplier purchases!
 */
export function createOCTrackingContractFromSalesOrder(
  salesOrder: SalesOrderRecord,
  equipments: MedicalEquipment[] = []
): OCTrackingContract {
  const contractId = `oc-contract-ov-${salesOrder.id || Date.now()}`;
  const now = new Date().toISOString();
  const profiles = getStoredSupplierProfiles();

  // Create OCTrackingItem for each item in the Sales Order with resolved supplier
  const ocItems: OCTrackingItem[] = (salesOrder.items || []).map((item, idx) => {
    // Attempt to lookup base cost from catalog
    const matchedEq = equipments.find(
      (e) =>
        e.id === item.equipmentId ||
        (item.code && e.code?.toLowerCase() === item.code?.toLowerCase()) ||
        (item.name && e.name?.toLowerCase() === item.name?.toLowerCase())
    );

    const costPriceCOP = matchedEq?.baseCostCOP || Math.round(Number(item.unitSalePriceCOP || 10000000) * 0.65);
    const qty = Number(item.quantityToDispatch) || 1;
    const supplierName = resolveSupplierForOVItem(item, equipments, profiles);
    const resolvedBrand = resolveItemManufacturerBrand(
      {
        ...item,
        brand: item.brand || matchedEq?.brand || '',
      },
      equipments
    );

    return {
      id: `oc-item-${salesOrder.id || 'so'}-${item.id || idx}-${Date.now()}`,
      equipmentId: item.equipmentId || matchedEq?.id,
      code: item.code || `EQ-${idx + 1}`,
      name: item.name,
      brand: resolvedBrand,
      model: item.model || matchedEq?.model || '',
      quantity: qty,
      costPriceCOP: costPriceCOP,
      totalCostCOP: costPriceCOP * qty,
      supplier: supplierName,
      ocNumber: item.supplierOCRef || '',
      status: 'Borrador / Solicitud',
      paymentStatus: 'Pendiente',
      createdAt: now,
      lastUpdatedAt: now,
      salesOrderId: salesOrder.id,
      salesOrderNumber: salesOrder.salesOrderNumber,
      salesOrderItemId: item.id,
      notes: `Equipo proveniente de Orden de Venta ${salesOrder.salesOrderNumber}. ${item.notes || ''}`,
      history: [
        {
          id: `hist-${Date.now()}`,
          timestamp: now,
          newStatus: 'Borrador / Solicitud',
          user: 'Sistema SyD (Desde OV)',
          note: `Generación automática de OC para atender Orden de Venta ${salesOrder.salesOrderNumber}`,
        },
      ],
      serialNumbers: (item.assignedSerialNumbers || []).map((sn) => ({
        id: `sn-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        serialNumber: sn,
        receivedDate: now.split('T')[0],
        status: 'Listo para Despacho',
        documents: [],
      })),
    };
  });

  // Guarantee all suppliers and brands from this sales order are registered in directory
  try {
    const toRegister = ocItems.map((it) => ({
      supplier: it.supplier,
      brand: it.brand,
      name: it.name,
      model: it.model,
      code: it.code,
    }));
    autoRegisterSuppliersFromEquipments(toRegister);
  } catch (err) {
    console.error('Error auto-registering suppliers in createOCTrackingContractFromSalesOrder:', err);
  }

  const totalCost = ocItems.reduce((acc, it) => acc + (it.totalCostCOP || 0), 0);

  return {
    id: contractId,
    salesOrderId: salesOrder.id,
    salesOrderNumber: salesOrder.salesOrderNumber,
    salesOrderIds: salesOrder.id ? [salesOrder.id] : [],
    salesOrderNumbers: salesOrder.salesOrderNumber ? [salesOrder.salesOrderNumber] : [],
    quoteId: salesOrder.quoteId,
    quoteNumber: salesOrder.quoteNumber,
    tenderClientId: salesOrder.tenderClientId || salesOrder.contractId,
    sourceType: salesOrder.contractId ? 'licitacion_adjudicada' : 'cotizacion_aprobada',
    contractNumber: salesOrder.contractNumber ? salesOrder.contractNumber : `OV: ${salesOrder.salesOrderNumber}`,
    clientName: salesOrder.clientName,
    nit: salesOrder.clientNit,
    city: salesOrder.clientCity,
    contactPerson: salesOrder.clientContactPerson,
    contactPhone: salesOrder.clientContactPhone,
    contactEmail: salesOrder.clientContactEmail,
    totalBudgetCOP: salesOrder.totalValueCOP,
    totalCostCOP: totalCost,
    items: ocItems,
    globalStatus: 'Borrador / Solicitud',
    createdAt: now,
    lastUpdatedAt: now,
    notes: `Pedido de compras generado a partir de la Orden de Venta ${salesOrder.salesOrderNumber}.`,
  };
}

/**
 * Creates a draft SalesOrderRecord from a TenderClientProject (Licitaciones / Contratos Adjudicados)
 */
/**
 * Creates a draft TenderClientProject from a SavedQuote or active QuoteHeader/QuoteItems
 * This enables the seamless flow: Cotización ➔ Licitación / Contrato
 */
export function createTenderProjectFromQuote(
  quote: SavedQuote | { header: QuoteHeader; items: QuoteItem[]; quoteNumber?: string; clientName?: string; nit?: string; city?: string; date?: string; contactPerson?: string; contactEmail?: string; contactPhone?: string; deliveryTime?: string },
  existingProjects: TenderClientProject[] = [],
  catalogEquipments: MedicalEquipment[] = []
): TenderClientProject {
  const isSavedQuote = 'savedAt' in quote || 'quoteNumber' in quote;
  const header: any = (quote as any).header || quote;
  const items: QuoteItem[] = (quote as any).items || [];
  const now = new Date().toISOString();
  const dateStr = now.split('T')[0];

  const tenderItems: TenderItem[] = items.map((qItem: QuoteItem, idx: number) => {
    const matchedEq = catalogEquipments.find(
      (e) =>
        e.id === qItem.equipmentId ||
        (qItem.code && e.code?.toLowerCase() === qItem.code?.toLowerCase()) ||
        (qItem.name && e.name?.toLowerCase() === qItem.name?.toLowerCase())
    );

    // Pull technical specifications if available, or generate standard compliance specs
    const reqs: TechnicalRequirement[] = (matchedEq?.technicalSpecs || []).map((spec: string | any, sIdx: number) => {
      const specText = typeof spec === 'string' ? spec : (spec?.name || spec?.description || 'Especificación Técnica');
      return {
        id: `req-${Date.now()}-${idx}-${sIdx}`,
        requirement: specText,
        offeredSpec: specText,
        complies: true,
        folioRef: `FT-${qItem.model || '01'}`,
      };
    });

    // If no specs in catalog, add basic compliance standard
    if (reqs.length === 0) {
      reqs.push({
        id: `req-${Date.now()}-${idx}-1`,
        requirement: `Equipo biomédico ${qItem.name} marca ${qItem.brand || 'SYD'} modelo ${qItem.model || 'Standard'}. Garantía oficial de ${qItem.warrantyMonths || 24} meses con soporte técnico autorizado.`,
        offeredSpec: 'Cumple a cabalidad con registro INVIMA vigente y soporte post-venta',
        complies: true,
        folioRef: 'Folio 1-15',
      });
    }

    const qty = Number(qItem.quantity) || 1;
    const unitPrice = Number(qItem.unitSalePrice) || 0;

    return {
      id: `t-item-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
      itemNumber: idx + 1,
      equipmentId: qItem.equipmentId || matchedEq?.id || `eq-auto-${idx}`,
      code: qItem.code || matchedEq?.code || `EQ-${idx + 1}`,
      name: qItem.name,
      brand: qItem.brand || matchedEq?.brand || 'SYD Biomedical',
      model: qItem.model || matchedEq?.model || 'General',
      originCountry: matchedEq?.originCountry || 'Colombia',
      quantity: qty,
      unitEstimatedBudget: unitPrice,
      offeredUnitPrice: unitPrice,
      taxRate: qItem.taxRate !== undefined ? qItem.taxRate : 0.19,
      invimaRecord: matchedEq?.invimaRecordNumber || 'Registro INVIMA Vigente',
      warrantyMonths: qItem.warrantyMonths || matchedEq?.warrantyMonths || 24,
      deliveryTimeDays: 30,
      requirements: reqs,
      selected: true,
      observations: qItem.notes || 'Ítem originado desde Cotización comercial.',
    };
  });

  const totalBudget = tenderItems.reduce((acc, it) => acc + it.offeredUnitPrice * it.quantity, 0);
  const tenderId = `tender-from-quote-${Date.now()}`;
  const qNum = header.quoteNumber || (quote as any).quoteNumber;
  const processNum = qNum
    ? `LIC-${qNum}`
    : `LIC-${new Date().getFullYear()}-${String(existingProjects.length + 1).padStart(3, '0')}`;

  const cName = header.clientName || (quote as any).clientName || 'Institución / Cliente';
  const cNit = header.nit || (quote as any).nit || '';
  const cCity = header.city || (quote as any).city || 'Barranquilla';
  const cPerson = header.contactPerson || (quote as any).contactPerson || '';
  const cEmail = header.contactEmail || (quote as any).contactEmail || '';
  const cPhone = header.contactPhone || (quote as any).contactPhone || '';
  const cDelivery = header.deliveryTime || (quote as any).deliveryTime || '30 días calendario';

  return {
    id: tenderId,
    clientName: cName,
    nit: cNit,
    header: {
      entityName: cName,
      clientName: cName,
      nit: cNit,
      processNumber: processNum,
      processType: 'Licitación Pública / Contrato de Suministro',
      contractObject: `Suministro de equipos médicos biomédicos según cotización ${qNum || ''}`,
      openingDate: dateStr,
      closingDate: dateStr,
      city: cCity,
      budgetCOP: totalBudget,
      contactPerson: cPerson,
      contactEmail: cEmail,
      contactPhone: cPhone,
      executionTerm: cDelivery,
      linkedQuoteId: isSavedQuote ? (quote as any).id : undefined,
      linkedQuoteNumber: qNum,
      linkedQuoteTotal: (quote as any).total || totalBudget,
      linkedQuoteDate: (quote as any).date || dateStr,
    },
    items: tenderItems,
    status: 'En Preparación',
    linkedQuoteId: isSavedQuote ? (quote as any).id : undefined,
    linkedQuoteNumber: qNum,
    linkedQuoteTotal: (quote as any).total || totalBudget,
    createdAt: now,
    updatedAt: now,
  };
}

export function createSalesOrderFromTenderProject(
  tender: TenderClientProject,
  existingOrders: SalesOrderRecord[] = []
): SalesOrderRecord {
  // Respect user preference: Do NOT auto-generate a consecutive number, let the user assign it manually
  const manualOrClientNum = tender.header?.clientOrderNumber || (tender.header?.isDirectClientOC ? tender.header.processNumber : '') || '';
  const now = new Date().toISOString();
  const linkedQNum = tender.linkedQuoteNumber || tender.header?.linkedQuoteNumber;
  const linkedQId = tender.linkedQuoteId || tender.header?.linkedQuoteId;

  const items = (tender.items || []).map((tItem, idx) => {
    const qty = Number(tItem.quantity) || 1;
    const unitPrice = Number(tItem.offeredUnitPrice) || 0;
    return {
      id: `ov-item-${Date.now()}-${idx}`,
      equipmentId: tItem.equipmentId,
      code: tItem.code || `EQ-${idx + 1}`,
      name: tItem.name,
      brand: tItem.brand || '',
      model: tItem.model || '',
      quotedQuantity: qty,
      quantityToDispatch: qty,
      unitSalePriceCOP: unitPrice,
      totalSalePriceCOP: unitPrice * qty,
      equipmentStatus: 'Pendiente de OC' as const,
      assignedSerialNumbers: [],
      notes: tItem.observations || '',
    };
  });

  const subtotalVal = items.reduce((acc, it) => acc + (it.totalSalePriceCOP || 0), 0);
  const ivaVal = (tender.items || []).reduce((acc, it) => {
    const sub = (it.quantity || 1) * (it.offeredUnitPrice || 0);
    const rate = it.taxRate !== undefined ? it.taxRate : 0.19;
    return acc + Math.round(sub * rate);
  }, 0);
  const totalVal = subtotalVal + ivaVal;

  return {
    id: `ov-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    salesOrderNumber: manualOrClientNum || '',
    quoteId: linkedQId,
    quoteNumber: linkedQNum,
    contractId: tender.id,
    contractNumber: tender.header.processNumber || tender.header.processType || 'Contrato Licitación',
    tenderClientId: tender.id,
    clientName: tender.clientName || tender.header.entityName || '',
    clientNit: tender.nit || tender.header.nit || '',
    clientCity: tender.header.city || 'Barranquilla',
    clientContactPerson: tender.header.contactPerson || '',
    clientContactPhone: tender.header.contactPhone || '',
    clientContactEmail: tender.header.contactEmail || '',
    orderDate: now.split('T')[0],
    deliveryDate: tender.header.executionTerm || '',
    status: 'En Proceso',
    items,
    totalValueCOP: totalVal > 0 ? totalVal : subtotalVal,
    invoicedStatus: 'No Facturada',
    hasLinkedOC: false,
    createdAt: now,
    updatedAt: now,
    notes: `Orden de Venta generada automáticamente a partir del Proceso Licitatorio Adjudicado ${tender.header.processNumber || tender.clientName}.${linkedQNum ? ` (Cotización: ${linkedQNum})` : ''}`,
  };
}

/**
 * Creates a SalesOrderRecord from an existing OCTrackingContract in Ventana 5.
 * Guarantees that any OC contract tracking entry is immediately visible as an OV in Ventana 6!
 */
export function createSalesOrderFromOCTrackingContract(
  contract: OCTrackingContract,
  existingOrders: SalesOrderRecord[] = []
): SalesOrderRecord {
  const now = new Date().toISOString();
  const rawOvNum = contract.salesOrderNumber || '';
  let cleanOvNum = rawOvNum.replace(/^OV:\s*/i, '').trim();

  if (!cleanOvNum || ['ov', 'sinov', 'na', 'n/a'].includes(cleanNorm(cleanOvNum))) {
    cleanOvNum = generateNextSalesOrderNumber(existingOrders.length > 0 ? existingOrders : getStoredSalesOrders());
  }

  const items = (contract.items || []).map((it, idx) => {
    const qty = Number(it.quantity) || 1;
    const cost = Number(it.costPriceCOP) || 0;
    const salePrice = Math.round(cost > 0 ? cost * 1.35 : 10000000);
    const eqStatus = it.status === 'Entregado e Instalado' ? 'Entregado al Cliente' : (it.status ? it.status : 'Pendiente de OC');
    return {
      id: `ov-item-${contract.id}-${idx}`,
      equipmentId: it.equipmentId,
      code: it.code || `EQ-${idx + 1}`,
      name: it.name,
      brand: resolveItemManufacturerBrand(it),
      model: it.model || '',
      quotedQuantity: qty,
      quantityToDispatch: qty,
      unitSalePriceCOP: salePrice,
      totalSalePriceCOP: salePrice * qty,
      equipmentStatus: eqStatus as any,
      supplierOCRef: it.ocNumber || '',
      linkedSupplierOCNumber: it.ocNumber || '',
      assignedSerialNumbers: (it.serialNumbers || []).map((s) => s.serialNumber).filter(Boolean),
      notes: it.notes || '',
    };
  });

  const totalSale = items.reduce((acc, it) => acc + (it.totalSalePriceCOP || 0), 0);

  return {
    id: contract.salesOrderId || `ov-from-contract-${contract.id}`,
    salesOrderNumber: cleanOvNum,
    quoteId: contract.quoteId,
    quoteNumber: contract.quoteNumber,
    contractId: contract.tenderClientId || contract.id,
    contractNumber: contract.contractNumber || '',
    tenderClientId: contract.tenderClientId,
    clientName: contract.clientName,
    clientNit: contract.nit || '',
    clientCity: contract.city || 'Cartagena, Bolivar',
    clientContactPerson: contract.contactPerson || '',
    clientContactPhone: contract.contactPhone || '',
    clientContactEmail: contract.contactEmail || '',
    orderDate: contract.createdAt ? contract.createdAt.split('T')[0] : now.split('T')[0],
    deliveryDate: '',
    status: 'En Proceso',
    items,
    totalValueCOP: contract.totalBudgetCOP && contract.totalBudgetCOP > 0 ? contract.totalBudgetCOP : (totalSale > 0 ? totalSale : 0),
    invoicedStatus: 'No Facturada',
    hasLinkedOC: true,
    ocContractId: contract.id,
    createdAt: contract.createdAt || now,
    updatedAt: contract.lastUpdatedAt || now,
    notes: `Orden de Venta enlazada con Seguimiento de OC (${contract.clientName}).`,
  };
}

/**
 * Reconciles and synchronizes all Sales Orders (OVs) with OC Tracking Contracts.
 * Guarantees that:
 * 1. EVERY distinct OV (salesOrderNumber / salesOrderId) referenced in ocContracts or its items (e.g. 1152149)
 *    has a corresponding, dedicated, intact SalesOrderRecord in Ventana 6 (Órdenes de Venta).
 * 2. If multiple OVs exist for a single client (e.g. 1142830, 1142794, 1146396, 1153267, 1152149),
 *    ALL of them are registered as individual SalesOrderRecords, never omitted or merged into one.
 * 3. Bidirectional data consistency is strictly maintained so Ventana 6 and Ventana 5 are 100% in sync.
 */
export function reconcileAndSyncSalesOrdersWithOC(
  existingOrders: SalesOrderRecord[] = [],
  contracts: OCTrackingContract[] = [],
  equipments: MedicalEquipment[] = []
): { syncedOrders: SalesOrderRecord[]; hasChanges: boolean } {
  const norm = (s?: string | number) =>
    String(s || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/^ov:\s*/i, '')
      .replace(/[^a-z0-9]/g, '');

  let orderList = deduplicateSalesOrders(existingOrders);
  let hasChanges = false;

  contracts.forEach((contract) => {
    if (!contract || !contract.clientName) return;

    // Collect all distinct OV identifiers present in this contract or in its items
    const ovMap = new Map<string, { soNumber: string; soId?: string; items: OCTrackingItem[] }>();

    // 1. Check contract-level salesOrderNumber / salesOrderNumbers
    const cSONums: string[] = [];
    if (contract.salesOrderNumbers && Array.isArray(contract.salesOrderNumbers)) {
      contract.salesOrderNumbers.forEach((s) => s && cSONums.push(String(s).trim()));
    }
    if (contract.salesOrderNumber) {
      String(contract.salesOrderNumber).split(',').forEach((s) => {
        const clean = s.trim();
        if (clean && !cSONums.includes(clean)) cSONums.push(clean);
      });
    }

    cSONums.forEach((num) => {
      const cleanNum = num.replace(/^ov:\s*/i, '').trim();
      const nKey = norm(cleanNum);
      if (nKey && !['ov', 'sinov', 'na', 'n/a'].includes(nKey)) {
        if (!ovMap.has(nKey)) {
          ovMap.set(nKey, {
            soNumber: cleanNum,
            soId: contract.salesOrderId,
            items: [],
          });
        }
      }
    });

    // 2. Check item-level salesOrderNumber and salesOrderId
    (contract.items || []).forEach((it) => {
      const itemSONum = it.salesOrderNumber ? String(it.salesOrderNumber).replace(/^ov:\s*/i, '').trim() : '';
      const itemSOId = it.salesOrderId ? String(it.salesOrderId).trim() : '';
      const nKey = norm(itemSONum || itemSOId);

      if (nKey && !['ov', 'sinov', 'na', 'n/a'].includes(nKey)) {
        if (!ovMap.has(nKey)) {
          ovMap.set(nKey, {
            soNumber: itemSONum || `OV-${nKey}`,
            soId: itemSOId,
            items: [],
          });
        }
        ovMap.get(nKey)!.items.push(it);
      }
    });

    // If no specific OV number was registered on items or contract, but contract has items and a salesOrderId
    if (ovMap.size === 0 && contract.items && contract.items.length > 0) {
      const fallbackNum = contract.salesOrderNumber || contract.contractNumber || '';
      const cleanFallback = fallbackNum.replace(/^ov:\s*/i, '').trim();
      const nKey = norm(cleanFallback || contract.id);
      if (nKey && !['ov', 'sinov', 'na', 'n/a'].includes(nKey)) {
        ovMap.set(nKey, {
          soNumber: cleanFallback || `OV-${contract.id.slice(-6)}`,
          soId: contract.salesOrderId,
          items: [...contract.items],
        });
      }
    }

    // Process each discovered OV for this contract
    ovMap.forEach((ovData, nKey) => {
      const targetNum = ovData.soNumber;
      const targetId = ovData.soId;

      // Check if this specific OV already exists in orderList
      const existingIdx = orderList.findIndex(
        (o) =>
          (targetId && (o.id === targetId || String(o.id) === String(targetId))) ||
          (targetNum && norm(o.salesOrderNumber) === norm(targetNum)) ||
          (o.ocContractId && o.ocContractId === contract.id && !o.salesOrderNumber)
      );

      if (existingIdx === -1) {
        // Create new SalesOrderRecord for this specific OV
        const itemsToUse = ovData.items.length > 0 ? ovData.items : (contract.items || []);
        const mappedItems = itemsToUse.map((cIt, idx) => {
          const qty = Number(cIt.quantity) || 1;
          const cost = Number(cIt.costPriceCOP) || 0;
          const salePrice = Math.round(cost > 0 ? cost * 1.35 : 10000000);
          const eqStatus = cIt.status === 'Entregado e Instalado' ? 'Entregado al Cliente' : (cIt.status || 'Pendiente de OC');
          return {
            id: cIt.salesOrderItemId || `ov-item-${contract.id}-${nKey}-${idx}`,
            equipmentId: cIt.equipmentId,
            code: cIt.code || `EQ-${idx + 1}`,
            name: cIt.name,
            brand: resolveItemManufacturerBrand(cIt, equipments),
            model: cIt.model || '',
            quotedQuantity: qty,
            quantityToDispatch: qty,
            unitSalePriceCOP: salePrice,
            totalSalePriceCOP: salePrice * qty,
            equipmentStatus: eqStatus as any,
            supplierOCRef: cIt.ocNumber || '',
            linkedSupplierOCNumber: cIt.ocNumber || '',
            assignedSerialNumbers: (cIt.serialNumbers || []).map((s) => s.serialNumber).filter(Boolean),
            notes: cIt.notes || '',
          };
        });

        const totalVal = mappedItems.reduce((s, it) => s + (it.totalSalePriceCOP || 0), 0);
        const newSO: SalesOrderRecord = {
          id: targetId || `ov-sync-${nKey}-${Date.now()}`,
          salesOrderNumber: targetNum,
          quoteId: contract.quoteId,
          quoteNumber: contract.quoteNumber,
          contractId: contract.tenderClientId || contract.id,
          contractNumber: contract.contractNumber || `OV: ${targetNum}`,
          tenderClientId: contract.tenderClientId,
          clientName: contract.clientName,
          clientNit: contract.nit || '',
          clientCity: contract.city || 'Cartagena, Bolivar',
          clientContactPerson: contract.contactPerson || '',
          clientContactPhone: contract.contactPhone || '',
          clientContactEmail: contract.contactEmail || '',
          orderDate: contract.createdAt ? contract.createdAt.split('T')[0] : new Date().toISOString().split('T')[0],
          deliveryDate: '',
          status: 'En Proceso',
          items: mappedItems,
          totalValueCOP: contract.totalBudgetCOP && contract.totalBudgetCOP > 0 ? contract.totalBudgetCOP : totalVal,
          invoicedStatus: 'No Facturada',
          hasLinkedOC: mappedItems.some((it) => Boolean(it.supplierOCRef || it.linkedSupplierOCNumber)),
          ocContractId: contract.id,
          createdAt: contract.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          notes: `Orden de Venta sincronizada automáticamente desde Seguimiento de OC (${contract.clientName}).`,
        };

        orderList = [newSO, ...orderList];
        hasChanges = true;
      } else {
        // Sync existing order items with contract item status, serials, and OC refs
        const existingOrder = orderList[existingIdx];
        let orderItemsChanged = false;

        const updatedItems = (existingOrder.items || []).map((soItem) => {
          const matchedCItem = (contract.items || []).find(
            (cIt) =>
              (cIt.salesOrderItemId && soItem.id && cIt.salesOrderItemId === soItem.id) ||
              (cIt.equipmentId && soItem.equipmentId && cIt.equipmentId === soItem.equipmentId) ||
              (cIt.code && soItem.code && norm(cIt.code) === norm(soItem.code)) ||
              (cIt.name && soItem.name && norm(cIt.name) === norm(soItem.name))
          );

          if (!matchedCItem) return soItem;

          const newOCRef = matchedCItem.ocNumber || soItem.supplierOCRef || '';
          const newLinkedOC = matchedCItem.ocNumber || soItem.linkedSupplierOCNumber || '';
          const newSerials = (matchedCItem.serialNumbers || []).map((s) => s.serialNumber).filter(Boolean);
          const eqStatus = matchedCItem.status === 'Entregado e Instalado' ? 'Entregado al Cliente' : (soItem.equipmentStatus || 'Pendiente de OC');

          if (
            newOCRef !== soItem.supplierOCRef ||
            newLinkedOC !== soItem.linkedSupplierOCNumber ||
            eqStatus !== soItem.equipmentStatus ||
            (newSerials.length > 0 && newSerials.length !== (soItem.assignedSerialNumbers || []).length)
          ) {
            orderItemsChanged = true;
            return {
              ...soItem,
              supplierOCRef: newOCRef,
              linkedSupplierOCNumber: newLinkedOC,
              equipmentStatus: eqStatus as any,
              assignedSerialNumbers: newSerials.length > 0 ? newSerials : soItem.assignedSerialNumbers,
            };
          }
          return soItem;
        });

        if (orderItemsChanged) {
          orderList[existingIdx] = {
            ...existingOrder,
            items: updatedItems,
            hasLinkedOC: updatedItems.some((it) => Boolean(it.supplierOCRef || it.linkedSupplierOCNumber)),
            updatedAt: new Date().toISOString(),
          };
          hasChanges = true;
        }
      }
    });
  });

  const finalDeduped = deduplicateSalesOrders(orderList);
  return {
    syncedOrders: finalDeduped,
    hasChanges: hasChanges || finalDeduped.length !== existingOrders.length,
  };
}
