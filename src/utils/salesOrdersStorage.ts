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
} from '../types';
import { isSalesOrderDeleted, isSalesInvoiceDeleted } from './tombstones';
const SALES_ORDERS_STORAGE_KEY = 'syd_sales_orders_v1';
const SALES_INVOICES_STORAGE_KEY = 'syd_sales_invoices_v1';

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
    result.push(o);
  }

  return result;
}

export function getStoredSalesOrders(): SalesOrderRecord[] {
  try {
    const raw = localStorage.getItem(SALES_ORDERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter(
          (o: any) =>
            o &&
            o.id &&
            !o.id?.startsWith('ov-seed-') &&
            !isSalesOrderDeleted(o.id, o.salesOrderNumber, o.tenderClientId, o.contractId)
        );
        const deduped = deduplicateSalesOrders(filtered);
        if (deduped.length !== parsed.length) {
          localStorage.setItem(SALES_ORDERS_STORAGE_KEY, JSON.stringify(deduped));
        }
        return deduped;
      }
    }
  } catch (e) {
    console.error('Error loading stored sales orders:', e);
  }
  return [];
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
            !isSalesInvoiceDeleted(inv.id, inv.invoiceNumber)
        );
        return filtered;
      }
    }
  } catch (e) {
    console.error('Error loading stored sales invoices:', e);
  }
  return [];
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
 * Creates an OCTrackingContract entry from a SalesOrderRecord to place in Ventana 5 (Seguimiento de OC).
 * This establishes the immediate link between the commercial Sales Order and supplier purchases!
 */
export function createOCTrackingContractFromSalesOrder(
  salesOrder: SalesOrderRecord,
  equipments: MedicalEquipment[] = []
): OCTrackingContract {
  const contractId = `oc-contract-ov-${salesOrder.id || Date.now()}`;
  const now = new Date().toISOString();

  // Create OCTrackingItem for each item in the Sales Order
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
    const supplierName = matchedEq?.supplier || item.brand || 'Proveedor Principal';

    return {
      id: `oc-item-${Date.now()}-${idx}`,
      equipmentId: item.equipmentId || matchedEq?.id,
      code: item.code || `EQ-${idx + 1}`,
      name: item.name,
      brand: item.brand,
      model: item.model,
      quantity: qty,
      costPriceCOP: costPriceCOP,
      totalCostCOP: costPriceCOP * qty,
      supplier: supplierName,
      ocNumber: item.supplierOCRef || '',
      status: 'Borrador / Solicitud',
      paymentStatus: 'Pendiente',
      createdAt: now,
      lastUpdatedAt: now,
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

  const totalCost = ocItems.reduce((acc, it) => acc + (it.totalCostCOP || 0), 0);

  return {
    id: contractId,
    salesOrderId: salesOrder.id,
    salesOrderNumber: salesOrder.salesOrderNumber,
    quoteId: salesOrder.quoteId,
    quoteNumber: salesOrder.quoteNumber,
    tenderClientId: salesOrder.tenderClientId || salesOrder.contractId,
    sourceType: salesOrder.contractId ? 'licitacion_adjudicada' : 'cotizacion_aprobada',
    contractNumber: `OV: ${salesOrder.salesOrderNumber}${salesOrder.quoteNumber ? ` (${salesOrder.quoteNumber})` : salesOrder.contractNumber ? ` (${salesOrder.contractNumber})` : ''}`,
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
      brand: it.brand || '',
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
