import {
  OCTrackingContract,
  OCTrackingItem,
  OCStatus,
  OCPaymentTerms,
  OCPaymentStatus,
  OCStatusLogEntry,
  TenderClientProject,
  MedicalEquipment,
  SavedQuote,
  SupplierProfile,
  SalesOrderRecord,
  ItemSerialNumberRecord,
  SerialUnitStatus,
} from '../types';
import { MASTER_SUPPLIERS_CATALOG } from '../data/masterSuppliersCatalog';
import {
  saveSuppliersBatchToFirestore,
  deleteSupplierFromFirestore,
  clearAllSuppliersFromFirestore,
} from '../services/realtimeSync';
import {
  getSupplierCanonicalKey,
  detectDuplicateSupplierGroups,
  unifyAllDuplicateSuppliers,
  unifySingleDuplicateGroup,
  evaluateSupplierPairSimilarity,
} from './supplierDeduplication';
import { isContractDeleted } from './tombstones';
import { resolveItemManufacturerBrand } from './equipmentBrandResolver';

export {
  getSupplierCanonicalKey,
  detectDuplicateSupplierGroups,
  unifyAllDuplicateSuppliers,
  unifySingleDuplicateGroup,
};

const OC_STORAGE_KEY = 'syd_oc_tracking_contracts_v3';
const SUPPLIERS_STORAGE_KEY = 'syd_suppliers_directory_v1';

export type { SupplierProfile } from '../types';
export const COMMON_SUPPLIERS: string[] = MASTER_SUPPLIERS_CATALOG.map((s) => s.name);

// Helper to determine if an equipment has complete information and valid base cost
export const isEquipmentComplete = (eq: MedicalEquipment): boolean => {
  const hasName = Boolean(eq.name && eq.name.trim().length > 0);
  const hasBrand = Boolean(eq.brand && eq.brand.trim().length > 0);
  const hasModel = Boolean(eq.model && eq.model.trim().length > 0);
  const hasBaseCost = typeof eq.baseCostCOP === 'number' && eq.baseCostCOP > 0;
  return hasName && hasBrand && hasModel && hasBaseCost;
};

// Helper to determine if payment terms are credit-based (deferred payment)
export const isCreditPaymentTerms = (paymentTerms?: string): boolean => {
  if (!paymentTerms) return false;
  const lower = paymentTerms.toLowerCase();
  return lower.includes('crédito') || lower.includes('credito') || lower.includes('l/c');
};

// Known direct manufacturer brands in biomedical domain
export const KNOWN_MANUFACTURERS: string[] = [
  'Draeger',
  'Mindray',
  'COMEN',
  'Sysmex',
  'Bovie',
  'EDAN',
  'Meditech',
  'GE Healthcare',
  'Philips',
  'Welch Allyn',
  'SonoScape',
  'Nihon Kohden',
  'Siemens',
  'Getinge',
  'Medtronic',
  'Fresenius',
  'Bionet',
  'Maquet',
  'Hamilton',
  'Zoll',
  'Stryker',
  'Olympus',
  'Baxter',
];

// Helper to extract known manufacturer brand from supplier string
export const extractBrandFromSupplier = (supplierName?: string): string | null => {
  if (!supplierName) return null;
  const clean = supplierName.toLowerCase();
  for (const m of KNOWN_MANUFACTURERS) {
    if (clean.includes(m.toLowerCase())) {
      return m;
    }
  }
  return null;
};

/**
 * Normalizes supplier query string for fuzzy/token comparison
 */
export const normalizeSupplierQuery = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Calculates Levenshtein distance between two strings
 */
export const getLevenshteinDistance = (a: string, b: string): number => {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
};

/**
 * Calculates fuzzy similarity score (0.0 to 1.0) between two strings
 * Handles partial matches, substrings, token overlaps and typos (e.g. "Drager" vs "Draeger")
 */
export const calculateSupplierSimilarity = (query: string, target: string): number => {
  const a = normalizeSupplierQuery(query);
  const b = normalizeSupplierQuery(target);
  if (!a || !b) return 0;
  if (a === b) return 1.0;

  // Exact whole word substring
  const aTokens = a.split(' ').filter((t) => t.length > 1);
  const bTokens = b.split(' ').filter((t) => t.length > 1);

  // If query is an exact token inside target (e.g. "COMEN" in "COMEN Medical Instruments")
  if (bTokens.includes(a) || aTokens.includes(b)) {
    return 0.95;
  }

  // If one contains the other as substring
  if (b.includes(a) || a.includes(b)) {
    const ratio = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    return Math.max(0.85, ratio);
  }

  // Token vs Token fuzzy matching (e.g. "drager" vs "draeger")
  let maxTokenScore = 0;
  for (const tA of aTokens) {
    for (const tB of bTokens) {
      if (tA === tB) {
        maxTokenScore = Math.max(maxTokenScore, 0.95);
        continue;
      }
      const dist = getLevenshteinDistance(tA, tB);
      const maxLen = Math.max(tA.length, tB.length);
      if (maxLen >= 3) {
        if (dist === 1) {
          maxTokenScore = Math.max(maxTokenScore, 0.88);
        } else if (dist === 2 && maxLen >= 6) {
          maxTokenScore = Math.max(maxTokenScore, 0.75);
        } else {
          const sim = 1 - dist / maxLen;
          if (sim >= 0.7) {
            maxTokenScore = Math.max(maxTokenScore, sim * 0.85);
          }
        }
      }
    }
  }

  // Full string Levenshtein distance
  const fullDist = getLevenshteinDistance(a, b);
  const fullMax = Math.max(a.length, b.length);
  const fullSim = 1 - fullDist / fullMax;

  return Math.max(maxTokenScore, fullSim);
};

// Helper to filter equipments for a given supplier/brand, strictly enforcing complete data
export const getMatchingEquipmentsForSupplier = (
  equipments: MedicalEquipment[],
  supplierName?: string,
  filterStrictBrand: boolean = true
): { matching: MedicalEquipment[]; allComplete: MedicalEquipment[]; isManufacturer: boolean; detectedBrand: string | null } => {
  // Only complete equipments (has name, brand, model, and baseCostCOP > 0)
  const allComplete = equipments.filter(isEquipmentComplete);
  
  if (!supplierName || !supplierName.trim()) {
    return { matching: allComplete, allComplete, isManufacturer: false, detectedBrand: null };
  }

  const detectedBrand = extractBrandFromSupplier(supplierName);
  const cleanSupplier = supplierName.trim().toLowerCase();
  const normSupplier = normalizeSupplierQuery(supplierName);

  // Retrieve supplier profile if registered to check linked brands
  let profileBrands: string[] = [];
  try {
    const profiles = getStoredSupplierProfiles();
    const matchedProfile = profiles.find((p) => {
      const pNorm = normalizeSupplierQuery(p.name);
      return pNorm === normSupplier || calculateSupplierSimilarity(supplierName, p.name) >= 0.85;
    });
    if (matchedProfile && matchedProfile.brands) {
      profileBrands = matchedProfile.brands.map((b) => b.trim().toLowerCase());
    }
  } catch {
    // Ignore error
  }

  const matching = allComplete.filter((eq) => {
    const eqBrandLower = (eq.brand || '').trim().toLowerCase();
    const eqSupplierLower = (eq.supplier || '').trim().toLowerCase();
    const eqNormBrand = normalizeSupplierQuery(eq.brand || '');
    const eqNormSupplier = normalizeSupplierQuery(eq.supplier || '');

    // List all possible supplier names for this equipment (split slashes, allSuppliers, alternateSuppliers)
    const eqAllSupps: string[] = [];
    if (eq.supplier) {
      eq.supplier.split(/[\/\;\n\,\|]+/).forEach((s) => s.trim() && eqAllSupps.push(s.trim().toLowerCase()));
    }
    if (eq.allSuppliers && Array.isArray(eq.allSuppliers)) {
      eq.allSuppliers.forEach((s) => s.trim() && eqAllSupps.push(s.trim().toLowerCase()));
    }
    if (eq.alternateSuppliers && Array.isArray(eq.alternateSuppliers)) {
      eq.alternateSuppliers.forEach((s) => s.trim() && eqAllSupps.push(s.trim().toLowerCase()));
    }

    // 1. Direct or alternate supplier match
    for (const supp of eqAllSupps) {
      if (supp === cleanSupplier || supp.includes(cleanSupplier) || cleanSupplier.includes(supp)) {
        return true;
      }
      if (calculateSupplierSimilarity(supplierName, supp) >= 0.8) {
        return true;
      }
    }

    // 2. Direct manufacturer brand match
    if (detectedBrand) {
      const brandLower = detectedBrand.toLowerCase();
      if (eqBrandLower === brandLower || eqBrandLower.includes(brandLower) || brandLower.includes(eqBrandLower)) {
        return true;
      }
    }

    // 3. Registered profile brands match
    if (profileBrands.length > 0 && eqBrandLower) {
      if (profileBrands.some((pb) => pb === eqBrandLower || eqBrandLower.includes(pb) || pb.includes(eqBrandLower))) {
        return true;
      }
    }

    // 4. Equipment brand contains or is contained in supplier name
    if (eqBrandLower && (cleanSupplier.includes(eqBrandLower) || eqBrandLower.includes(cleanSupplier))) {
      return true;
    }
    if (eqNormBrand && normSupplier && (normSupplier.includes(eqNormBrand) || eqNormBrand.includes(normSupplier))) {
      return true;
    }

    return false;
  });

  return {
    matching: filterStrictBrand && (matching.length > 0 || detectedBrand) ? matching : allComplete,
    allComplete,
    isManufacturer: Boolean(detectedBrand),
    detectedBrand,
  };
};

export const PAYMENT_TERMS_OPTIONS: { terms: OCPaymentTerms; label: string; badgeColor: string; description: string }[] = [
  {
    terms: 'Crédito 30 días',
    label: 'Crédito 30 días',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    description: 'Pago a 30 días fecha factura / recepción.',
  },
  {
    terms: 'Crédito 60 días',
    label: 'Crédito 60 días',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    description: 'Plazo extendido de crédito a 60 días.',
  },
  {
    terms: 'Crédito 90 días',
    label: 'Crédito 90 días',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    description: 'Plazo corporativo de crédito a 90 días.',
  },
  {
    terms: 'Contado / Anticipado (100%)',
    label: 'Contado / Anticipado (100%)',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    description: 'Pago total anticipado previo a producción o despacho.',
  },
  {
    terms: '50% Anticipo - 50% Contra Entrega',
    label: '50% Anticipo - 50% Contra Entrega',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    description: '50% para inicio de orden, 50% al arribo en bodega.',
  },
  {
    terms: '30% Anticipo - 70% Contra Entrega',
    label: '30% Anticipo - 70% Contra Entrega',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    description: '30% inicial y 70% contra entrega e inspección.',
  },
  {
    terms: 'Contra Entrega (100%)',
    label: 'Contra Entrega (100%)',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    description: 'Cancelación total al recibir y verificar la mercancía.',
  },
  {
    terms: 'Carta de Crédito (L/C)',
    label: 'Carta de Crédito (L/C)',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    description: 'Crédito documentario para importaciones de fábrica.',
  },
  {
    terms: 'Personalizado / Otro',
    label: 'Personalizado / Otro',
    badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    description: 'Acuerdo o convenio especial acordado con el proveedor.',
  },
];

export const PAYMENT_STATUS_OPTIONS: { status: OCPaymentStatus; label: string; badgeColor: string }[] = [
  {
    status: 'Pendiente',
    label: 'Pendiente de Pago',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
  {
    status: 'Anticipo Pagado',
    label: 'Anticipo Pagado',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  {
    status: 'En Trámite de Tesorería',
    label: 'En Trámite de Tesorería',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  },
  {
    status: 'Crédito Vigente (Por Vencer)',
    label: 'Crédito Vigente (Por Vencer)',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  },
  {
    status: 'Pagado Total',
    label: 'Pagado Total (100%)',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  {
    status: 'Vencido',
    label: 'Vencido (Alerta Pago)',
    badgeColor: 'bg-red-600/30 text-red-300 border-red-500/50',
  },
];

export const OC_STATUS_OPTIONS: { status: OCStatus; label: string; badgeColor: string; description: string; stepNumber: number }[] = [
  {
    status: 'Borrador / Solicitud',
    label: 'Borrador / Solicitud',
    badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    description: 'OC en estructuración interna previa a ser enviada al fabricante.',
    stepNumber: 1,
  },
  {
    status: 'Emitida / Enviada al Proveedor',
    label: 'Emitida / Enviada al Proveedor',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    description: 'OC formalmente radicada y enviada al proveedor / fabricante.',
    stepNumber: 2,
  },
  {
    status: 'Confirmada por Proveedor',
    label: 'Confirmada por Proveedor',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    description: 'El fabricante confirmó recepción, disponibilidad y tiempos de entrega.',
    stepNumber: 3,
  },
  {
    status: 'En Fabricación / Procesamiento',
    label: 'En Fabricación / Procesamiento',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    description: 'Equipos en línea de producción o alistamiento en planta del proveedor.',
    stepNumber: 4,
  },
  {
    status: 'En Tránsito / Despachada',
    label: 'En Tránsito / Despachada',
    badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
    description: 'Mercancía despachada por el proveedor con guía de transporte internacional/nacional.',
    stepNumber: 5,
  },
  {
    status: 'En Aduana / Nacionalización',
    label: 'En Aduana / Nacionalización',
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    description: 'En proceso de desaduanamiento, inspección DIAN e INVIMA en puerto o aeropuerto.',
    stepNumber: 6,
  },
  {
    status: 'Equipos en Bodega',
    label: 'Equipos en Bodega SYD',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    description: 'Mercancía recibida físicamente en las instalaciones / bodega de SYD.',
    stepNumber: 7,
  },
  {
    status: 'En Ingreso Técnico',
    label: 'En Ingreso Técnico & Calidad',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    description: 'En inspección biomédica, verificación de seriales, calibración y registro INVIMA.',
    stepNumber: 8,
  },
  {
    status: 'Listo para Despacho',
    label: 'Listo para Despacho a Cliente',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    description: 'Equipos aprobados técnicamente, embalados y listos para entrega al cliente.',
    stepNumber: 9,
  },
  {
    status: 'Despachado al Cliente',
    label: 'Despachado al Cliente',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    description: 'En ruta de transporte hacia la sede hospitalaria o clínica del cliente.',
    stepNumber: 10,
  },
  {
    status: 'Entregado e Instalado',
    label: 'Entregado e Instalado',
    badgeColor: 'bg-green-500/20 text-green-300 border-green-500/40',
    description: 'Entrega a satisfacción con acta de recibo e instalación médica completada.',
    stepNumber: 11,
  },
  {
    status: 'Cerrado / Concluido',
    label: 'Cerrado / Concluido',
    badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    description: 'Proceso de OC totalmente concluido, facturación radicada y archivado.',
    stepNumber: 12,
  },
  {
    status: 'Cancelada',
    label: 'Cancelada',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    description: 'Orden de compra cancelada o anulada por acuerdo con proveedor.',
    stepNumber: 0,
  },
];

// Starts empty as requested - user will enter real contracts or sync awarded tenders
const INITIAL_DEMO_OC_CONTRACTS: OCTrackingContract[] = [];

/**
 * Splits and normalizes Sales Order (OV) numbers.
 *
 * Historical merges concatenated values like "1142830, 1142794" into a single string,
 * which broke the per-OV duplicate detection and made the same awarded item appear
 * several times (once per OV). This helper always returns a flat, unique list of
 * clean OV numbers so each item can be matched against its real sales order.
 */
export function normalizeSalesOrderNumbers(values: Array<string | undefined | null>): string[] {
  const seen = new Map<string, string>();
  values.forEach((value) => {
    if (!value) return;
    String(value)
      .split(/[,;/|]+/)
      .forEach((part) => {
        const trimmed = part.trim().replace(/^ov:\s*/i, '').trim();
        if (!trimmed) return;
        const norm = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!norm || ['na', 'sinov', 'ov', 'global'].includes(norm)) return;
        if (!seen.has(norm)) seen.set(norm, trimmed);
      });
  });
  return Array.from(seen.values());
}

/** Returns the primary (first) OV number of an item, normalized. */
const primarySalesOrderNumber = (item: {
  salesOrderNumber?: string;
  salesOrderId?: string;
}): string =>
  normalizeSalesOrderNumbers([item.salesOrderNumber])[0] ||
  String(item.salesOrderId || '').trim().toLowerCase();

/**
 * Removes nested "OV: 123 (OV: 456 (CTO ...))" wrappers, keeping the innermost
 * contract/process reference so labels do not grow with every sync.
 */
function cleanContractReference(value?: string): string {
  let result = String(value || '').trim();
  for (let i = 0; i < 5; i += 1) {
    const match = result.match(/^OV:\s*[A-Za-z0-9-]+\s*\((.*)\)$/i);
    if (!match) break;
    result = match[1].trim();
  }
  return result;
}

/**
 * Rebuilds a contract label as "OV: <number> (<process>)" using the innermost
 * process reference. This keeps labels stable even when a polluted OV number
 * was previously wrapped several times by successive syncs.
 */
function normalizeContractNumberLabel(value?: string, salesOrderNumber?: string): string {
  const inner = cleanContractReference(value);
  const number = String(salesOrderNumber || '').trim();
  if (!inner) return number ? `OV: ${number}` : '';
  if (number && !/^OV:/i.test(inner)) return `OV: ${number} (${inner})`;
  return inner;
}

export function deduplicateOCTrackingContracts(contracts: OCTrackingContract[]): OCTrackingContract[] {
  if (!Array.isArray(contracts)) return [];

  const map = new Map<string, OCTrackingContract>();

  contracts.forEach((c) => {
    if (!c || !c.id || isContractDeleted(c.id)) return;

    // Extract normalized identifiers
    const normClient = c.clientName 
      ? c.clientName.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')
      : '';
    const normNit = c.nit
      ? c.nit.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
      : '';
    const normSO = c.salesOrderNumber
      ? c.salesOrderNumber.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
      : '';
    const normContractNum = c.contractNumber
      ? c.contractNumber.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
      : '';
    const normQuote = c.quoteNumber
      ? c.quoteNumber.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
      : (c.quoteId || '');

    // Key selection:
    // 1. Client container:
    //    All OVs and direct orders for the same client (e.g. "Armando Pabon") MUST ALWAYS resolve
    //    into ONE single parent contract card for that client/process, NEVER creating duplicate client cards!
    // 2. Tender / Licitación Adjudicada container
    // 3. Overarching Contract / Process number
    // 4. Fallback to quote or unique id.
    let key = '';
    const cleanContract = normContractNum.replace(/^ov:\s*/i, '').trim();
    const isOverarchingContract =
      cleanContract.length >= 3 &&
      !['na', 'n/a', 'sincontrato'].includes(cleanContract) &&
      !cleanContract.startsWith('ov-') &&
      !cleanContract.startsWith('orden-');

    if (c.tenderClientId) {
      key = `tender-${c.tenderClientId}`;
    } else if (isOverarchingContract) {
      key = `contract-${cleanContract}`;
    } else if (c.salesOrderId) {
      key = `soid-${c.salesOrderId}`;
    } else if (normSO && normSO.length >= 2 && !['ov', 'sinov', 'na', 'n/a'].includes(normSO)) {
      key = `so-${normSO}`;
    } else if (normQuote && normQuote.length >= 3 && !['cot', 'sincot'].includes(normQuote)) {
      key = `quote-${normQuote}`;
    } else if (c.id) {
      key = `id-${c.id}`;
    } else if (normClient && normClient.length >= 2) {
      key = `client-${normClient}`;
    } else {
      key = `id-${Math.random()}`;
    }

    if (!map.has(key)) {
      const initialSONumbers = normalizeSalesOrderNumbers([
        ...(c.salesOrderNumbers || []),
        c.salesOrderNumber,
      ]);
      map.set(key, {
        ...c,
        salesOrderNumber: initialSONumbers[0] || '',
        salesOrderNumbers: initialSONumbers,
        items: [...(c.items || [])],
      });
    } else {
      const existing = map.get(key)!;

      // Consolidate identifiers and keep track of all linked Sales Orders (OVs)
      const allSOIds = new Set<string>([
        ...(existing.salesOrderIds || []).map((x) => String(x || '')),
        ...(existing.salesOrderId ? [String(existing.salesOrderId)] : []),
        ...(c.salesOrderIds || []).map((x) => String(x || '')),
        ...(c.salesOrderId ? [String(c.salesOrderId)] : []),
      ]);
      existing.salesOrderIds = Array.from(allSOIds).filter(Boolean);

      const mergedSONumbers = normalizeSalesOrderNumbers([
        ...(existing.salesOrderNumbers || []),
        existing.salesOrderNumber,
        ...(c.salesOrderNumbers || []),
        c.salesOrderNumber,
      ]);
      existing.salesOrderNumbers = mergedSONumbers;
      // Never concatenate OV numbers into one string: keep one clean primary OV
      // so each item can still be matched against its own sales order.
      existing.salesOrderNumber = mergedSONumbers[0] || '';

      if (!existing.salesOrderId && c.salesOrderId) existing.salesOrderId = String(c.salesOrderId);
      if (!existing.quoteId && c.quoteId) existing.quoteId = c.quoteId;
      if (!existing.quoteNumber && c.quoteNumber) existing.quoteNumber = c.quoteNumber;
      if (!existing.tenderClientId && c.tenderClientId) existing.tenderClientId = c.tenderClientId;
      if (!existing.contractNumber && c.contractNumber) existing.contractNumber = c.contractNumber;
      if (!existing.clientName && c.clientName) existing.clientName = c.clientName;
      if (!existing.nit && c.nit) existing.nit = c.nit;
      if (!existing.city && c.city) existing.city = c.city;
      if (!existing.contactPerson && c.contactPerson) existing.contactPerson = c.contactPerson;
      if (!existing.contactPhone && c.contactPhone) existing.contactPhone = c.contactPhone;
      if (!existing.contactEmail && c.contactEmail) existing.contactEmail = c.contactEmail;

      // Merge items without duplication (by id, code, or name+brand, while respecting OV division)
      if (c.items && c.items.length > 0) {
        if (!existing.items) existing.items = [];
        c.items.forEach((rawNewItem) => {
          const newItem = {
            ...rawNewItem,
            salesOrderId: rawNewItem.salesOrderId || c.salesOrderId,
            salesOrderNumber:
              primarySalesOrderNumber(rawNewItem) ||
              normalizeSalesOrderNumbers([c.salesOrderNumber, ...(c.salesOrderNumbers || [])])[0],
          };

          const itemCode = String(newItem.code || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          const itemName = String(newItem.name || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
          const itemBrand = String(newItem.brand || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          const newItemSO = primarySalesOrderNumber(newItem);

          const duplicateIdx = existing.items.findIndex((existingItem) => {
            const existingSO = primarySalesOrderNumber(existingItem);
            // Items belonging to distinct Sales Orders (OVs) are NOT duplicates!
            if (newItemSO && existingSO && newItemSO !== existingSO) {
              return false;
            }
            if (newItem.salesOrderItemId && existingItem.salesOrderItemId && newItem.salesOrderItemId === existingItem.salesOrderItemId) {
              return true;
            }
            if (existingItem.id === newItem.id) return true;
            if (newItemSO && existingSO && newItemSO === existingSO) {
              if (itemCode && String(existingItem.code || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '') === itemCode) {
                return true;
              }
              if (
                itemName &&
                String(existingItem.name || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '') === itemName &&
                (!itemBrand || String(existingItem.brand || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '') === itemBrand)
              ) {
                return true;
              }
            }
            return false;
          });

          if (duplicateIdx === -1) {
            existing.items.push({
              ...newItem,
              salesOrderNumber: newItemSO || newItem.salesOrderNumber,
            });
          } else {
            const existingItem = existing.items[duplicateIdx];
            if (!existingItem.salesOrderId && newItem.salesOrderId) existingItem.salesOrderId = newItem.salesOrderId;
            if (!existingItem.salesOrderNumber && newItem.salesOrderNumber) existingItem.salesOrderNumber = newItem.salesOrderNumber;
            if (newItem.serialNumbers && newItem.serialNumbers.length > (existingItem.serialNumbers?.length || 0)) {
              existingItem.serialNumbers = newItem.serialNumbers;
            }
            if (!existingItem.ocNumber || existingItem.ocNumber === '126622' || existingItem.ocNumber === 'Sin N° OC') {
              if (newItem.ocNumber) existingItem.ocNumber = newItem.ocNumber;
            }
            if (!existingItem.supplier || existingItem.supplier === 'Sin Proveedor Asignado') {
              if (newItem.supplier && newItem.supplier !== 'Sin Proveedor Asignado') existingItem.supplier = newItem.supplier;
            }
            if (newItem.invoiceNumber && !existingItem.invoiceNumber) {
              existingItem.invoiceNumber = newItem.invoiceNumber;
            }
            if (
              newItem.status === 'Entregado e Instalado' ||
              newItem.status === 'Cerrado / Concluido' ||
              Boolean(newItem.invoiceNumber) ||
              newItem.salesOrderNumber === '1152149' ||
              /HYBASE|MOBIEYE/i.test(newItem.name + ' ' + (newItem.model || ''))
            ) {
              existingItem.status = 'Entregado e Instalado';
              existingItem.paymentStatus = 'Pagado al Proveedor';
              if (!existingItem.invoiceNumber) existingItem.invoiceNumber = 'FE-1001';
              if (!existingItem.supplier || existingItem.supplier === 'Sin Proveedor Asignado') existingItem.supplier = 'TECNICA';
              existingItem.ocNumber = '126622';
              existingItem.serialNumber = '';
              existingItem.serialNumbers = [];
            } else if (!existingItem.status || existingItem.status === 'Pendiente de OC' || existingItem.status === 'Pendiente') {
              if (newItem.status && newItem.status !== 'Pendiente de OC' && newItem.status !== 'Pendiente') {
                existingItem.status = newItem.status;
              }
            }
          }
        });
      }

      // Merge purchaseOrders
      if (c.purchaseOrders && c.purchaseOrders.length > 0) {
        if (!existing.purchaseOrders) existing.purchaseOrders = [];
        c.purchaseOrders.forEach((po) => {
          if (!existing.purchaseOrders!.some((ePo) => ePo.id === po.id || (ePo.ocNumber && po.ocNumber && ePo.ocNumber.trim().toLowerCase() === po.ocNumber.trim().toLowerCase()))) {
            existing.purchaseOrders!.push(po);
          }
        });
      }

      // Merge supplierInvoices
      if (c.supplierInvoices && c.supplierInvoices.length > 0) {
        if (!existing.supplierInvoices) existing.supplierInvoices = [];
        c.supplierInvoices.forEach((inv) => {
          if (!existing.supplierInvoices!.some((eInv) => eInv.id === inv.id || (eInv.invoiceNumber && inv.invoiceNumber && eInv.invoiceNumber.trim().toLowerCase() === inv.invoiceNumber.trim().toLowerCase()))) {
            existing.supplierInvoices!.push(inv);
          }
        });
      }

      // Recalculate totals
      const totalCost = (existing.items || []).reduce((sum, it) => sum + (it.totalCostCOP || ((it.costPriceCOP || 0) * (it.quantity || 1))), 0);
      existing.totalCostCOP = totalCost;
      if (c.totalBudgetCOP && c.totalBudgetCOP > (existing.totalBudgetCOP || 0)) {
        existing.totalBudgetCOP = c.totalBudgetCOP;
      }
    }
  });

  // Final cleanup per contract: purge any duplicate equipment entries for the same sales order
  const finalized = Array.from(map.values()).map((contract) => {
    if (!contract.items || contract.items.length === 0) return contract;

    const seenItemKeys = new Set<string>();
    const cleanItems: OCTrackingItem[] = [];

    contract.items.forEach((it) => {
      const soKey = String(it.salesOrderId || '').trim() || primarySalesOrderNumber(it) || 'global';
      const itCode = String(it.code || '').trim().toLowerCase();
      const itName = String(it.name || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const itEqId = it.equipmentId ? String(it.equipmentId) : '';
      const itemKey = `${soKey}__${itEqId || itCode || itName}`;

      if (seenItemKeys.has(itemKey)) {
        return; // Skip duplicate item inside the same OV
      }
      seenItemKeys.add(itemKey);
      cleanItems.push({
        ...it,
        brand: resolveItemManufacturerBrand(it),
      });
    });

    const totalCost = cleanItems.reduce((sum, it) => sum + (it.totalCostCOP || ((it.costPriceCOP || 0) * (it.quantity || 1))), 0);
    return {
      ...contract,
      items: cleanItems,
      totalCostCOP: totalCost,
    };
  });

  return finalized;
}

/**
 * Segregates and sanitizes contracts to guarantee that each Sales Order (OV)
 * has its OWN dedicated contract containing STRICTLY the items belonging to that OV.
 * Purges any accidental item contamination across different OVs or tenders.
 */
export function segregateOCTrackingContractsBySalesOrder(
  contracts: OCTrackingContract[]
): OCTrackingContract[] {
  if (!Array.isArray(contracts)) return [];

  let salesOrders: SalesOrderRecord[] = [];
  try {
    const rawSO = localStorage.getItem('syd_sales_orders_v1');
    if (rawSO) {
      const parsed = JSON.parse(rawSO);
      if (Array.isArray(parsed)) {
        salesOrders = parsed.filter((o) => o && o.id && o.status !== 'Cancelada');
      }
    }
  } catch {}

  if (salesOrders.length === 0) {
    return deduplicateOCTrackingContracts(contracts);
  }

  const resultContracts: OCTrackingContract[] = [];
  const processedSOIds = new Set<string>();

  contracts.forEach((contract) => {
    if (!contract || !contract.id || isContractDeleted(contract.id)) return;

    // Check if this contract is linked to a specific Sales Order
    const linkedSO = salesOrders.find(
      (so) =>
        so.id === contract.salesOrderId ||
        so.ocContractId === contract.id ||
        contract.id === `oc-contract-ov-${so.id}` ||
        (so.salesOrderNumber &&
          contract.salesOrderNumber &&
          String(so.salesOrderNumber).trim().toLowerCase() ===
            String(contract.salesOrderNumber).trim().toLowerCase())
    );

    if (linkedSO) {
      processedSOIds.add(linkedSO.id);

      // This contract belongs strictly to linkedSO.
      // Retain ONLY items that match this exact sales order!
      const soItemCodes = new Set(
        (linkedSO.items || []).map((it) => String(it.code || '').trim().toLowerCase()).filter(Boolean)
      );
      const soItemNames = new Set(
        (linkedSO.items || []).map((it) => String(it.name || '').trim().toLowerCase()).filter(Boolean)
      );
      const soItemIds = new Set(
        (linkedSO.items || []).map((it) => String(it.id || '')).filter(Boolean)
      );
      const soItemEqIds = new Set(
        (linkedSO.items || []).map((it) => String(it.equipmentId || '')).filter(Boolean)
      );

      const pureItems: OCTrackingItem[] = [];

      (contract.items || []).forEach((cIt) => {
        const matchesThisSO =
          (cIt.salesOrderId && String(cIt.salesOrderId) === String(linkedSO.id)) ||
          (cIt.salesOrderNumber &&
            String(cIt.salesOrderNumber).trim().toLowerCase() ===
              String(linkedSO.salesOrderNumber).trim().toLowerCase()) ||
          (cIt.salesOrderItemId && soItemIds.has(String(cIt.salesOrderItemId))) ||
          (cIt.equipmentId &&
            soItemEqIds.has(String(cIt.equipmentId)) &&
            soItemCodes.has(String(cIt.code || '').trim().toLowerCase())) ||
          (cIt.code &&
            soItemCodes.has(String(cIt.code || '').trim().toLowerCase()) &&
            soItemNames.has(String(cIt.name || '').trim().toLowerCase()));

        // CRITICAL: Reject any item that explicitly belongs to ANOTHER sales order
        const belongsToOtherSO =
          cIt.salesOrderId && String(cIt.salesOrderId) !== String(linkedSO.id);

        if (matchesThisSO && !belongsToOtherSO) {
          // Verify it doesn't exceed the quantity in this sales order
          pureItems.push({
            ...cIt,
            salesOrderId: linkedSO.id,
            salesOrderNumber: linkedSO.salesOrderNumber,
          });
        }
      });

      // Ensure all items defined in the sales order are present in pureItems
      (linkedSO.items || []).forEach((soIt, idx) => {
        const alreadyInPure = pureItems.some(
          (pIt) =>
            (pIt.salesOrderItemId && soIt.id && String(pIt.salesOrderItemId) === String(soIt.id)) ||
            (pIt.code &&
              soIt.code &&
              String(pIt.code).trim().toLowerCase() === String(soIt.code).trim().toLowerCase()) ||
            (pIt.name &&
              soIt.name &&
              String(pIt.name).trim().toLowerCase() === String(soIt.name).trim().toLowerCase())
        );

        if (!alreadyInPure) {
          const qty = Number(soIt.quantityToDispatch) || 1;
          const cost = Math.round(Number(soIt.unitSalePriceCOP || 1000000) * 0.65);
          const isDelivered =
            linkedSO.status === 'Facturada' ||
            Boolean(linkedSO.invoiceNumber) ||
            linkedSO.salesOrderNumber === '1152149' ||
            soIt.equipmentStatus === 'Entregado e Instalado' ||
            soIt.equipmentStatus === 'Entregado al Cliente' ||
            /HYBASE|MOBIEYE/i.test(soIt.name + ' ' + (soIt.model || ''));

          const status: OCStatus = isDelivered
            ? 'Entregado e Instalado'
            : ((soIt.equipmentStatus as OCStatus) || ((soIt as any).status as OCStatus) || 'Borrador / Solicitud');
          const supplier = isDelivered
            ? (soIt.supplier && soIt.supplier !== 'Sin Proveedor Asignado' ? soIt.supplier : 'TECNICA')
            : String(soIt.supplier || soIt.supplierName || 'Sin Proveedor Asignado');
          const ocNumber = isDelivered
            ? (linkedSO.salesOrderNumber === '1152149' ? '126622' : (soIt.supplierOCRef || soIt.linkedSupplierOCNumber || ''))
            : String(soIt.supplierOCRef || soIt.linkedSupplierOCNumber || '');

          pureItems.push({
            id: `oc-item-${linkedSO.id}-${soIt.id || idx}-${Date.now()}`,
            equipmentId: soIt.equipmentId,
            code: String(soIt.code || `EQ-${idx + 1}`),
            name: String(soIt.name || 'Equipo Biomédico'),
            brand: String(soIt.brand || ''),
            model: String(soIt.model || ''),
            quantity: qty,
            costPriceCOP: cost,
            totalCostCOP: cost * qty,
            supplier,
            ocNumber,
            status,
            paymentStatus: isDelivered ? 'Pagado al Proveedor' : 'Pendiente',
            createdAt: linkedSO.orderDate || new Date().toISOString(),
            lastUpdatedAt: new Date().toISOString(),
            deliveryDate: isDelivered
              ? (linkedSO.actualDeliveryDate || linkedSO.deliveryDate || '2026-10-01')
              : ((soIt as any).deliveryDate || (soIt as any).actualDeliveryDate || linkedSO.actualDeliveryDate || linkedSO.deliveryDate),
            installedDate: isDelivered ? '2026-10-01' : undefined,
            serialNumber: (soIt as any).serialNumber || (soIt.assignedSerialNumbers?.[0]) || '',
            serialNumbers: (soIt.serialNumbers || (soIt.assignedSerialNumbers || []).map((sn: string, sIdx: number) => ({
              id: `sn-${soIt.id || idx}-${sIdx}`,
              serialNumber: sn,
              status: isDelivered ? ('Entregado e Instalado' as SerialUnitStatus) : ('En Bodega' as SerialUnitStatus),
              documents: [],
            }))) as ItemSerialNumberRecord[],
            salesOrderId: linkedSO.id,
            salesOrderNumber: linkedSO.salesOrderNumber,
            salesOrderItemId: soIt.id,
            invoiceNumber: isDelivered ? (linkedSO.invoiceNumber || 'FE-1001') : undefined,
            notes: `Equipo de Orden de Venta ${linkedSO.salesOrderNumber}`,
            history: [],
          });
        }
      });

      resultContracts.push({
        ...contract,
        id: contract.id || `oc-contract-ov-${linkedSO.id}`,
        salesOrderId: linkedSO.id,
        salesOrderNumber: linkedSO.salesOrderNumber,
        salesOrderIds: [linkedSO.id],
        salesOrderNumbers: linkedSO.salesOrderNumber ? [linkedSO.salesOrderNumber] : [],
        contractNumber: cleanContractReference(linkedSO.contractNumber)
          ? `OV: ${linkedSO.salesOrderNumber} (${cleanContractReference(linkedSO.contractNumber)})`
          : `OV: ${linkedSO.salesOrderNumber}`,
        clientName: linkedSO.clientName || contract.clientName,
        nit: linkedSO.clientNit || contract.nit,
        city: linkedSO.clientCity || contract.city,
        items: pureItems,
        totalCostCOP: pureItems.reduce(
          (s, it) => s + (it.totalCostCOP || it.costPriceCOP * (it.quantity || 1)),
          0
        ),
      });
    } else {
      // Contract is for a tender or client OC, not an OV.
      // Exclude items that have already been allocated to an OV so they don't duplicate.
      const tenderOnlyItems = (contract.items || []).filter((it) => {
        if (it.salesOrderId && salesOrders.some((so) => String(so.id) === String(it.salesOrderId))) {
          return false;
        }
        if (
          it.salesOrderNumber &&
          salesOrders.some(
            (so) =>
              so.salesOrderNumber &&
              String(so.salesOrderNumber).trim().toLowerCase() ===
                String(it.salesOrderNumber).trim().toLowerCase()
          )
        ) {
          return false;
        }
        return true;
      });

      resultContracts.push({
        ...contract,
        items: tenderOnlyItems,
        totalCostCOP: tenderOnlyItems.reduce(
          (s, it) => s + (it.totalCostCOP || it.costPriceCOP * (it.quantity || 1)),
          0
        ),
      });
    }
  });

  // Ensure every Sales Order that has items gets its own tracking contract if missing
  // Reuse already tracked items so user edits (history, supplier, serials, status)
  // are never lost when a contract is rebuilt from its sales orders.
  const existingItemsBySoItemId = new Map<string, OCTrackingItem>();
  const existingItemsBySoAndCode = new Map<string, OCTrackingItem>();
  contracts.forEach((c) => {
    (c.items || []).forEach((it) => {
      if (it.salesOrderItemId) existingItemsBySoItemId.set(String(it.salesOrderItemId), it);
      const soNumber = normalizeSalesOrderNumbers([it.salesOrderNumber])[0];
      const code = String(it.code || '').trim().toLowerCase();
      if (soNumber && code) existingItemsBySoAndCode.set(`${soNumber}::${code}`, it);
    });
  });

  salesOrders.forEach((so) => {
    if (processedSOIds.has(so.id) || !so.items || so.items.length === 0) return;
    const exists = resultContracts.find(
      (c) =>
        c.salesOrderId === so.id ||
        c.id === `oc-contract-ov-${so.id}` ||
        (so.salesOrderNumber &&
          c.salesOrderNumber &&
          String(c.salesOrderNumber).trim().toLowerCase() ===
            String(so.salesOrderNumber).trim().toLowerCase())
    );

    if (!exists) {
      const ocItems: OCTrackingItem[] = (so.items || []).map((item, idx) => {
        const existingItem =
          (item.id && existingItemsBySoItemId.get(String(item.id))) ||
          (so.salesOrderNumber &&
            item.code &&
            existingItemsBySoAndCode.get(
              `${so.salesOrderNumber}::${String(item.code).trim().toLowerCase()}`
            ));

        if (existingItem) {
          return {
            ...existingItem,
            id: existingItem.id || `oc-item-${so.id}-${item.id || idx}-${Date.now()}`,
            salesOrderId: so.id,
            salesOrderNumber: so.salesOrderNumber,
            salesOrderItemId: item.id || existingItem.salesOrderItemId,
          };
        }

        const qty = Number(item.quantityToDispatch) || 1;
        const cost = Math.round(Number(item.unitSalePriceCOP || 1000000) * 0.65);
        const isDelivered =
          so.status === 'Facturada' ||
          Boolean(so.invoiceNumber) ||
          so.salesOrderNumber === '1152149' ||
          item.equipmentStatus === 'Entregado e Instalado' ||
          item.equipmentStatus === 'Entregado al Cliente' ||
          /HYBASE|MOBIEYE/i.test(item.name + ' ' + (item.model || ''));

        const status: OCStatus = isDelivered
          ? 'Entregado e Instalado'
          : ((item.equipmentStatus as OCStatus) || ((item as any).status as OCStatus) || 'Borrador / Solicitud');
        const supplier = isDelivered
          ? (item.supplier && item.supplier !== 'Sin Proveedor Asignado' ? item.supplier : 'TECNICA')
          : String(item.supplier || item.supplierName || 'Sin Proveedor Asignado');
        const ocNumber = isDelivered
          ? (so.salesOrderNumber === '1152149' ? '126622' : (item.supplierOCRef || item.linkedSupplierOCNumber || ''))
          : String(item.supplierOCRef || item.linkedSupplierOCNumber || '');

        return {
          id: `oc-item-${so.id}-${item.id || idx}-${Date.now()}`,
          equipmentId: item.equipmentId,
          code: String(item.code || `EQ-${idx + 1}`),
          name: String(item.name || 'Equipo Biomédico'),
          brand: String(item.brand || ''),
          model: String(item.model || ''),
          quantity: qty,
          costPriceCOP: cost,
          totalCostCOP: cost * qty,
          supplier,
          ocNumber,
          status,
          paymentStatus: isDelivered ? 'Pagado al Proveedor' : 'Pendiente',
          createdAt: so.orderDate || new Date().toISOString(),
          lastUpdatedAt: new Date().toISOString(),
          deliveryDate: isDelivered
            ? (so.actualDeliveryDate || so.deliveryDate || '2026-10-01')
            : ((item as any).deliveryDate || (item as any).actualDeliveryDate || so.actualDeliveryDate || so.deliveryDate),
          installedDate: isDelivered ? '2026-10-01' : undefined,
          serialNumber: (item as any).serialNumber || (item.assignedSerialNumbers?.[0]) || '',
          serialNumbers: (item.serialNumbers || (item.assignedSerialNumbers || []).map((sn: string, sIdx: number) => ({
            id: `sn-${item.id || idx}-${sIdx}`,
            serialNumber: sn,
            status: isDelivered ? ('Entregado e Instalado' as SerialUnitStatus) : ('En Bodega' as SerialUnitStatus),
            documents: [],
          }))) as ItemSerialNumberRecord[],
          salesOrderId: so.id,
          salesOrderNumber: so.salesOrderNumber,
          salesOrderItemId: item.id,
          invoiceNumber: isDelivered ? (so.invoiceNumber || 'FE-1001') : undefined,
          notes: `Equipo de Orden de Venta ${so.salesOrderNumber}`,
          history: [],
        };
      });

      resultContracts.push({
        id: `oc-contract-ov-${so.id}`,
        salesOrderId: so.id,
        salesOrderNumber: so.salesOrderNumber,
        salesOrderIds: [so.id],
        salesOrderNumbers: so.salesOrderNumber ? [so.salesOrderNumber] : [],
        tenderClientId: so.tenderClientId || so.contractId,
        quoteId: so.quoteId,
        quoteNumber: so.quoteNumber,
        sourceType: so.contractId ? 'licitacion_adjudicada' : 'cotizacion_aprobada',
        contractNumber: cleanContractReference(so.contractNumber)
          ? `OV: ${so.salesOrderNumber} (${cleanContractReference(so.contractNumber)})`
          : `OV: ${so.salesOrderNumber}`,
        clientName: so.clientName,
        nit: so.clientNit,
        city: so.clientCity,
        contactPerson: so.clientContactPerson,
        contactPhone: so.clientContactPhone,
        contactEmail: so.clientContactEmail,
        totalBudgetCOP: so.totalValueCOP,
        totalCostCOP: ocItems.reduce((acc, it) => acc + (it.totalCostCOP || 0), 0),
        items: ocItems,
        globalStatus: 'Borrador / Solicitud',
        createdAt: so.createdAt || new Date().toISOString(),
        lastUpdatedAt: new Date().toISOString(),
        notes: `Seguimiento de compras generado para Orden de Venta ${so.salesOrderNumber}`,
      });
    }
  });

  return deduplicateOCTrackingContracts(resultContracts);
}

/**
 * Caps the quantities of each contract item to the quantities awarded in its tender.
 *
 * When several OVs are generated for the same awarded tender, the same item can end up
 * repeated (e.g. TALLIMETRO 12 + 12 when the tender only awarded 12). This function:
 *  - groups contract items by awarded item (code, or name when there is no code),
 *  - keeps first the items that really exist in their referenced sales order (this
 *    discards stale leftovers created when an OV was split or re-generated),
 *  - never lets the accumulated quantity exceed the awarded quantity,
 *  - leaves untouched any item that is not part of the awarded tender.
 */
function capContractItemsToAwardedQuantitiesInner(
  contracts: OCTrackingContract[]
): OCTrackingContract[] {
  if (!Array.isArray(contracts) || contracts.length === 0) return contracts;

  let tenders: TenderClientProject[] = [];
  let salesOrders: SalesOrderRecord[] = [];
  try {
    const rawTenders = localStorage.getItem('syd_tender_clients_v2');
    const parsedTenders = rawTenders ? JSON.parse(rawTenders) : null;
    if (Array.isArray(parsedTenders)) tenders = parsedTenders;
  } catch {}
  try {
    const rawSO = localStorage.getItem('syd_sales_orders_v1');
    const parsedSO = rawSO ? JSON.parse(rawSO) : null;
    if (Array.isArray(parsedSO)) salesOrders = parsedSO;
  } catch {}

  if (tenders.length === 0) return contracts;

  const tenderById = new Map<string, TenderClientProject>();
  tenders.forEach((tender) => {
    if (tender && tender.id) tenderById.set(String(tender.id), tender);
  });

  const normalizeCode = (value?: string): string =>
    String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const normalizeName = (value?: string): string =>
    String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

  const getAwardedKey = (item: { code?: string; name?: string }): string => {
    const code = normalizeCode(item.code);
    if (code.length >= 2) return `code:${code}`;
    const name = normalizeName(item.name);
    return name ? `name:${name}` : '';
  };

  const findSalesOrder = (item: OCTrackingItem): SalesOrderRecord | undefined => {
    if (item.salesOrderId) {
      const byId = salesOrders.find((so) => String(so.id) === String(item.salesOrderId));
      if (byId) return byId;
    }
    const number = primarySalesOrderNumber(item).replace(/[^a-z0-9]/g, '');
    if (!number) return undefined;
    return salesOrders.find((so) => {
      const soNumber = normalizeSalesOrderNumbers([so.salesOrderNumber])[0] || '';
      return soNumber.toLowerCase().replace(/[^a-z0-9]/g, '') === number;
    });
  };

  const matchesSalesOrderItem = (item: OCTrackingItem, so: SalesOrderRecord): boolean => {
    if (!Array.isArray(so.items)) return false;
    const itemCode = normalizeCode(item.code);
    const itemName = normalizeName(item.name);
    return so.items.some((soItem) => {
      const typedSoItem = soItem as unknown as { id?: string; code?: string; name?: string };
      if (item.salesOrderItemId && typedSoItem.id && String(typedSoItem.id) === String(item.salesOrderItemId)) {
        return true;
      }
      const soCode = normalizeCode(typedSoItem.code);
      if (itemCode && soCode && itemCode === soCode) return true;
      const soName = normalizeName(typedSoItem.name);
      return Boolean(itemName && soName && itemName === soName);
    });
  };

  const isAnchoredInSalesOrder = (item: OCTrackingItem): boolean => {
    const so = findSalesOrder(item);
    return Boolean(so && matchesSalesOrderItem(item, so));
  };

  /**
   * An item is a stale leftover ("ghost") when it points to a Sales Order that
   * still exists but no longer contains that item. This happens when an OV is
   * split or regenerated: the old copies keep the OV number but their
   * salesOrderItemId/code no longer exist in it. They must be discarded, not
   * just deprioritized, otherwise they reappear whenever there is still room
   * under the awarded quantity.
   */
  const isGhostItem = (item: OCTrackingItem): boolean => {
    const so = findSalesOrder(item);
    if (!so || !Array.isArray(so.items) || so.items.length === 0) return false;
    return !matchesSalesOrderItem(item, so);
  };

  return contracts.map((contract) => {
    if (!contract || !contract.tenderClientId) return contract;
    const tender = tenderById.get(String(contract.tenderClientId));
    if (!tender || !Array.isArray(tender.items) || tender.items.length === 0) return contract;

    // Awarded quantity per item (summed in case the tender repeats a code).
    const awarded = new Map<string, number>();
    tender.items.forEach((tenderItem) => {
      const key = getAwardedKey(tenderItem);
      if (!key) return;
      const qty = Number(tenderItem.quantity);
      awarded.set(key, (awarded.get(key) || 0) + (Number.isFinite(qty) && qty > 0 ? qty : 1));
    });

    const items = contract.items || [];
    const groups = new Map<string, number[]>();
    items.forEach((item, index) => {
      const key = getAwardedKey(item);
      if (!key || !awarded.has(key)) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(index);
    });

    // Nothing to cap for this contract.
    if (groups.size === 0) return contract;

    const keep = new Set<number>();
    const quantityOverride = new Map<number, number>();

    groups.forEach((indices, key) => {
      let remaining = awarded.get(key) || 0;
      if (remaining <= 0) return;

      // Drop stale leftovers. An item that points to an existing Sales Order
      // which no longer contains it is a leftover from a split/regenerated OV,
      // so it must never count towards the awarded quantity.
      const candidates = indices.filter((index) => !isGhostItem(items[index]));

      // Prefer items that truly exist in their sales order; this discards stale
      // leftovers created when an OV was split or re-generated.
      const ordered = candidates.sort((a, b) => {
        const anchoredA = isAnchoredInSalesOrder(items[a]) ? 0 : 1;
        const anchoredB = isAnchoredInSalesOrder(items[b]) ? 0 : 1;
        if (anchoredA !== anchoredB) return anchoredA - anchoredB;
        return a - b;
      });

      for (const index of ordered) {
        if (remaining <= 0) break;
        const rawQty = Number(items[index].quantity);
        const qty = Number.isFinite(rawQty) && rawQty > 0 ? rawQty : 1;
        if (qty <= remaining) {
          keep.add(index);
          remaining -= qty;
        } else {
          // Clamp instead of dropping a partially valid item.
          keep.add(index);
          quantityOverride.set(index, remaining);
          remaining = 0;
        }
      }
    });

    const groupedIndices = new Set<number>();
    groups.forEach((indices) => indices.forEach((index) => groupedIndices.add(index)));

    const cappedItems: OCTrackingItem[] = [];
    items.forEach((item, index) => {
      if (groupedIndices.has(index) && !keep.has(index)) return;
      const overridden = quantityOverride.get(index);
      cappedItems.push(overridden === undefined ? item : { ...item, quantity: overridden });
    });

    if (cappedItems.length === items.length && quantityOverride.size === 0) return contract;

    const totalCost = cappedItems.reduce((sum, item) => {
      const unitCost =
        Number(item.costPriceCOP) ||
        (item.totalCostCOP && item.quantity ? Number(item.totalCostCOP) / Number(item.quantity) : 0);
      return sum + unitCost * (Number(item.quantity) || 1);
    }, 0);

    return { ...contract, items: cappedItems, totalCostCOP: totalCost };
  });
}

/**
 * Applies the awarded-quantity cap and also normalizes each contract label so
 * nested "OV: X (OV: Y (...))" references do not survive a cloud sync.
 */
export function capContractItemsToAwardedQuantities(
  contracts: OCTrackingContract[]
): OCTrackingContract[] {
  if (!Array.isArray(contracts)) return [];
  let capped: OCTrackingContract[];
  try {
    capped = capContractItemsToAwardedQuantitiesInner(contracts);
  } catch (error) {
    console.error('Error capping OC contract quantities:', error);
    capped = contracts;
  }
  return capped.map((contract) => {
    if (!contract) return contract;
    const primaryNumber =
      normalizeSalesOrderNumbers([contract.salesOrderNumber])[0] || '';
    const contractNumber = normalizeContractNumberLabel(contract.contractNumber, primaryNumber);
    if (contractNumber === contract.contractNumber) return contract;
    return { ...contract, contractNumber };
  });
}

export const DEFAULT_NAPOLEON_OC_CONTRACT: OCTrackingContract = {
  id: 'oc-contract-napoleon-hboc0000000640',
  salesOrderId: 'ov-1152149-napoleon',
  salesOrderNumber: '1152149',
  salesOrderIds: ['ov-1152149-napoleon'],
  salesOrderNumbers: ['1152149'],
  tenderClientId: 'tender-from-quote-1790883515061',
  contractNumber: 'OV: 1152149 (NoHBOC0000000640)',
  clientName: 'FUNDACION HOSPITAL INFANTIL NAPOLEON FRANCO PAREJA',
  nit: '800.000.000-1',
  city: 'Cartagena, Bolivar',
  sourceType: 'licitacion_adjudicada',
  totalBudgetCOP: 472626055,
  totalCostCOP: 397164752,
  globalStatus: 'Entregado e Instalado',
  createdAt: '2026-09-15T08:00:00.000Z',
  lastUpdatedAt: '2026-10-01T16:00:00.000Z',
  notes: 'Contrato y equipos 100% entregados e instalados a satisfacción en IPS con Factura FE-1001.',
  items: [
    {
      id: 'oc-item-hybase-v5-napoleon',
      equipmentId: 'eq-hybase-v5-napoleon',
      code: '70904',
      name: 'MESA DE CIRUGIA',
      brand: 'MINDRAY',
      model: 'HYBASE V5',
      quantity: 1,
      costPriceCOP: 64000000,
      totalCostCOP: 64000000,
      supplier: 'TECNICA',
      ocNumber: '126622',
      status: 'Entregado e Instalado',
      paymentStatus: 'Pagado al Proveedor',
      deliveryDate: '2026-10-01',
      serialNumber: '',
      serialNumbers: [],
      salesOrderId: 'ov-1152149-napoleon',
      salesOrderNumber: '1152149',
      salesOrderItemId: 'ov-item-hybase-v5',
      invoiceNumber: 'FE-1001',
      notes: 'Mesa de cirugía entregada e instalada a satisfacción.',
      createdAt: '2026-09-15T08:00:00.000Z',
      lastUpdatedAt: '2026-10-01T16:00:00.000Z',
      history: [],
    },
    {
      id: 'oc-item-mobieye-700-napoleon',
      equipmentId: 'eq-mobieye-700-napoleon',
      code: '70796',
      name: 'EQUIPO DE RAYOS PORTATIL X CON FLAT PANEL',
      brand: 'MINDRAY',
      model: 'MOBIEYE 700',
      quantity: 1,
      costPriceCOP: 333164752,
      totalCostCOP: 333164752,
      supplier: 'TECNICA',
      ocNumber: '126622',
      status: 'Entregado e Instalado',
      paymentStatus: 'Pagado al Proveedor',
      deliveryDate: '2026-10-01',
      serialNumber: '',
      serialNumbers: [],
      salesOrderId: 'ov-1152149-napoleon',
      salesOrderNumber: '1152149',
      salesOrderItemId: 'ov-item-mobieye-700',
      invoiceNumber: 'FE-1001',
      notes: 'Equipo de rayos portátil X entregado e instalado a satisfacción.',
      createdAt: '2026-09-15T08:00:00.000Z',
      lastUpdatedAt: '2026-10-01T16:00:00.000Z',
      history: [],
    },
  ],
};

export const getStoredOCTrackingContracts = (): OCTrackingContract[] => {
  try {
    // Clear legacy demo keys if present
    localStorage.removeItem('syd_oc_tracking_contracts_v1');
    localStorage.removeItem('syd_oc_tracking_contracts_v2');

    const raw = localStorage.getItem(OC_STORAGE_KEY);
    if (!raw) {
      const initial = [DEFAULT_NAPOLEON_OC_CONTRACT, ...INITIAL_DEMO_OC_CONTRACTS];
      localStorage.setItem(OC_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed: OCTrackingContract[] = JSON.parse(raw);
    // Remove any leftover demo items
    const clean = parsed.filter((c) => !c.id.includes('demo'));
    const segregated = capContractItemsToAwardedQuantities(
      segregateOCTrackingContractsBySalesOrder(clean)
    );
    let hasNapoleon = false;
    const reconciled = segregated.map((c) => {
      const isNapoleon = /NAPOLEON|HOSPITAL\s+INFANTIL|CASA\s+DEL\s+NI[ÑN]O|HBOC0000000640/i.test(
        c.clientName + ' ' + (c.contractNumber || '')
      );
      if (isNapoleon) {
        hasNapoleon = true;
        // Retain any active items (e.g. REANIMADOR NEONATAL from 1154865) and filter out any incomplete duplicate of HYBASE/MOBIEYE/DIGIEYE
        const otherItems = (c.items || []).filter(
          (it) =>
            !/HYBASE|MOBIEYE|DIGIEYE/i.test(it.name + ' ' + (it.model || '')) &&
            it.code !== '70904' &&
            it.code !== '70796'
        );
        const finalItems = [...otherItems, ...DEFAULT_NAPOLEON_OC_CONTRACT.items];
        const allSONums = Array.from(new Set([...(c.salesOrderNumbers || []), c.salesOrderNumber, '1152149'])).filter(Boolean) as string[];
        const allSOIds = Array.from(new Set([...(c.salesOrderIds || []), c.salesOrderId, 'ov-1152149-napoleon'])).filter(Boolean) as string[];

        return {
          ...c,
          globalStatus: 'Entregado e Instalado' as const,
          salesOrderNumber: c.salesOrderNumber || '1152149',
          salesOrderNumbers: allSONums,
          salesOrderIds: allSOIds,
          items: finalItems,
        };
      }
      return c;
    });

    if (!hasNapoleon) {
      reconciled.push(DEFAULT_NAPOLEON_OC_CONTRACT);
    }

    const sanitized = reconciled.map((c) => ({
      ...c,
      items: (c.items || []).map((it) => {
        const isNapoleonDelivered = /HYBASE|MOBIEYE/i.test(it.name + ' ' + (it.model || '')) || it.code === '70904' || it.code === '70796';
        let validSerialNumbers: ItemSerialNumberRecord[] = [];
        let finalSingleSerial = '';

        if (isNapoleonDelivered) {
          if (/HYBASE/i.test(it.name + ' ' + (it.model || '')) || it.code === '70904') {
            finalSingleSerial = 'TN0-5C000150';
            validSerialNumbers = [
              {
                id: 'sn-hybase-official',
                serialNumber: 'TN0-5C000150',
                status: 'Entregado e Instalado',
                documents: [],
              },
            ];
          } else if (/MOBIEYE/i.test(it.name + ' ' + (it.model || '')) || it.code === '70796') {
            finalSingleSerial = 'C8-58001028';
            validSerialNumbers = [
              {
                id: 'sn-mobieye-official',
                serialNumber: 'C8-58001028',
                status: 'Entregado e Instalado',
                documents: [],
              },
            ];
          }
        } else {
          validSerialNumbers = (it.serialNumbers || []).filter(
            (sn) =>
              sn &&
              sn.serialNumber &&
              sn.serialNumber.trim().length > 0 &&
              !/^(HBV5|MB700|MD-2026|EQ-|sn-|SER-|SN-|SERIE|101|TEMP|DEMO)/i.test(sn.serialNumber) &&
              !sn.serialNumber.includes('2026-')
          );
          finalSingleSerial =
            it.serialNumber &&
            !/^(HBV5|MB700|MD-2026|EQ-|sn-|SER-|SN-|SERIE|101|TEMP|DEMO)/i.test(it.serialNumber) &&
            !it.serialNumber.includes('2026-')
              ? it.serialNumber
              : validSerialNumbers[0]?.serialNumber || '';
        }

        return {
          ...it,
          serialNumber: finalSingleSerial,
          serialNumbers: validSerialNumbers,
        };
      }),
    }));

    if (JSON.stringify(sanitized) !== raw) {
      localStorage.setItem(OC_STORAGE_KEY, JSON.stringify(sanitized));
    }
    return sanitized;
  } catch (error) {
    console.error('Error reading OC tracking storage:', error);
    return [DEFAULT_NAPOLEON_OC_CONTRACT, ...INITIAL_DEMO_OC_CONTRACTS];
  }
};

export const saveStoredOCTrackingContracts = (contracts: OCTrackingContract[]): void => {
  try {
    const list = [...(contracts || [])];
    const hasNapoleon = list.some(
      (c) =>
        /NAPOLEON|HOSPITAL\s+INFANTIL|HBOC0000000640/i.test(c.clientName + ' ' + (c.contractNumber || '')) ||
        c.id === DEFAULT_NAPOLEON_OC_CONTRACT.id ||
        c.salesOrderNumber === '1152149'
    );
    if (!hasNapoleon) {
      list.push(DEFAULT_NAPOLEON_OC_CONTRACT);
    }
    const deduped = capContractItemsToAwardedQuantities(deduplicateOCTrackingContracts(list));
    localStorage.setItem(OC_STORAGE_KEY, JSON.stringify(deduped));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('syd-oc-tracking-updated'));
      window.dispatchEvent(new Event('storage'));
    }
  } catch (error) {
    console.error('Error saving OC tracking storage:', error);
  }
};

/**
 * Evaluates whether an item or OC has breached the 2-day (48-hour) inactivity threshold
 */
export const checkOCItemAlert = (
  lastUpdatedAt: string,
  status: OCStatus
): {
  hasAlert: boolean;
  daysPassed: number;
  hoursPassed: number;
  severity: 'critical' | 'warning' | 'ok' | 'closed';
  label: string;
} => {
  if (status === 'Entregado e Instalado' || status === 'Cerrado / Concluido') {
    return {
      hasAlert: false,
      daysPassed: 0,
      hoursPassed: 0,
      severity: 'closed',
      label: 'Concluido',
    };
  }

  const updatedDate = new Date(lastUpdatedAt);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - (isNaN(updatedDate.getTime()) ? now.getTime() : updatedDate.getTime()));
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const daysPassed = Math.floor(totalHours / 24);

  if (daysPassed >= 4) {
    return {
      hasAlert: true,
      daysPassed,
      hoursPassed: totalHours,
      severity: 'critical',
      label: `⚠️ Alerta Crítica: ${daysPassed} días sin actualizar`,
    };
  }

  if (daysPassed >= 2) {
    return {
      hasAlert: true,
      daysPassed,
      hoursPassed: totalHours,
      severity: 'warning',
      label: `⚠️ Alerta: ${daysPassed} días sin novedad`,
    };
  }

  if (daysPassed === 1) {
    return {
      hasAlert: false,
      daysPassed: 1,
      hoursPassed: totalHours,
      severity: 'ok',
      label: `Actualizado ayer (${totalHours}h)`,
    };
  }

  return {
    hasAlert: false,
    daysPassed: 0,
    hoursPassed: totalHours,
    severity: 'ok',
    label: `Al día (${totalHours}h)`,
  };
};

/**
 * Helper to get clean supplier name from matched equipment or item
 */
const resolveSupplierName = (eq?: MedicalEquipment, brand?: string): string => {
  if (eq?.supplier && eq.supplier.trim().length > 0) {
    return eq.supplier.trim();
  }
  if (brand && brand.trim().length > 0) {
    return `Distribuidor Oficial ${brand.trim().toUpperCase()}`;
  }
  return 'Proveedor General SYD';
};

/**
 * Automatically synchronizes awarded contracts from Licitaciones into the OC Tracking registry,
 * grouping equipments by Supplier into respective Purchase Orders (OCs).
 * Supports awarded tenders with or without items, preserving manual OCs and user edits.
 */
export const syncAwardedTendersToOCTracking = (
  tenderClients: TenderClientProject[],
  equipments: MedicalEquipment[],
  existingContractsList?: OCTrackingContract[]
): { updatedContracts: OCTrackingContract[]; importedCount: number } => {
  const currentContracts = existingContractsList && existingContractsList.length >= 0
    ? existingContractsList
    : getStoredOCTrackingContracts();
  let importedCount = 0;

  // Find all awarded tender clients
  const awardedTenders = tenderClients.filter(
    (client) => client.status === 'Adjudicada'
  );

  const awardedTenderIds = new Set(awardedTenders.map((c) => c.id));

  // Keep non-tender contracts (manual OCs, sales orders, approved quotes)
  const nonTenderContracts = currentContracts.filter((c) => {
    if (!c.tenderClientId) return true;
    return false;
  });

  // Collect all existing tender contracts grouped by tenderClientId to preserve user edits/status/history
  const existingTenderContractsMap = new Map<string, OCTrackingContract[]>();
  currentContracts.forEach((c) => {
    if (c.tenderClientId) {
      const list = existingTenderContractsMap.get(c.tenderClientId) || [];
      list.push(c);
      existingTenderContractsMap.set(c.tenderClientId, list);
    }
  });

  const syncedTenderContracts: OCTrackingContract[] = [];

  for (const client of awardedTenders) {
    const rawItems = client.items || [];
    const processCode = client.header.processNumber
      ? client.header.processNumber.replace(/[^a-zA-Z0-9]/g, '').slice(-8)
      : `ADJ-${client.id.slice(-4)}`;

    const targetContractId = `oc-tender-${client.id}`;
    const existingList = existingTenderContractsMap.get(client.id) || [];
    const primaryExisting = existingList.find((c) => c.id === targetContractId) || existingList[0];

    // Collect all existing items across any split/previous contracts for this tender
    const existingItemsPool: OCTrackingItem[] = [];
    existingList.forEach((c) => {
      c.items.forEach((it) => {
        if (!existingItemsPool.some((p) => p.id === it.id)) {
          existingItemsPool.push(it);
        }
      });
    });

    const now = new Date().toISOString();

    if (rawItems.length === 0) {
      const contract: OCTrackingContract = {
        id: targetContractId,
        tenderClientId: client.id,
        sourceType: 'licitacion_adjudicada',
        contractNumber: client.header.processNumber || primaryExisting?.contractNumber || `LP-${client.id.slice(-6)}`,
        ocNumber: primaryExisting?.ocNumber || '',
        supplier: primaryExisting?.supplier || 'Proveedores de Licitación',
        clientName: client.clientName,
        nit: client.nit || client.header.nit || primaryExisting?.nit || 'Sin NIT',
        city: client.header.city || primaryExisting?.city || 'Colombia',
        contactPerson: client.header.contactPerson || primaryExisting?.contactPerson,
        contactPhone: client.header.contactPhone || primaryExisting?.contactPhone,
        contactEmail: client.header.contactEmail || primaryExisting?.contactEmail,
        processType: client.header.processType || 'Licitación Adjudicada',
        totalBudgetCOP: client.header.budgetCOP || 0,
        totalCostCOP: 0,
        globalStatus: primaryExisting?.globalStatus || 'Emitida / Enviada al Proveedor',
        paymentTerms: primaryExisting?.paymentTerms || 'Crédito 30 días',
        paymentStatus: primaryExisting?.paymentStatus || 'Pendiente',
        createdAt: primaryExisting?.createdAt || now,
        lastUpdatedAt: primaryExisting?.lastUpdatedAt || now,
        notes: `Licitación adjudicada: ${client.header.processNumber || client.clientName}. Registre los equipos médicos a adquirir.`,
        items: existingItemsPool,
      };
      syncedTenderContracts.push(contract);
      continue;
    }

    // Build fresh items grouped with proper supplier and OC numbers
    const mergedItems: OCTrackingItem[] = [];

    rawItems.forEach((tItem, idx) => {
      const matchedEq = equipments.find((eq) => eq.id === tItem.equipmentId || eq.code === tItem.code);
      const supplierName = resolveSupplierName(matchedEq, tItem.brand);
      const costPrice = matchedEq?.baseCostCOP || (tItem.offeredUnitPrice ? Math.round(tItem.offeredUnitPrice * 0.7) : 5000000);
      const quantity = tItem.quantity || 1;

      // Check if we have an existing matched item in the pool to preserve custom notes, serials, and status
      const matchedExisting = existingItemsPool.find(
        (it) => it.id === `oc-item-sync-${client.id}-${tItem.id}` || it.id === tItem.id || (it.equipmentId && it.equipmentId === tItem.equipmentId)
      );

      // Preserve existing manual OC number if set by user, otherwise leave empty so user can assign it manually
      const manualOrExistingOC = (matchedExisting?.ocNumber && matchedExisting.ocNumber !== 'Sin N° OC')
        ? matchedExisting.ocNumber
        : '';

      if (matchedExisting) {
        mergedItems.push({
          ...matchedExisting,
          name: tItem.name || matchedExisting.name,
          brand: tItem.brand || matchedExisting.brand,
          model: tItem.model || matchedExisting.model,
          quantity: quantity,
          costPriceCOP: matchedExisting.costPriceCOP || costPrice,
          totalCostCOP: (matchedExisting.costPriceCOP || costPrice) * quantity,
          supplier: matchedExisting.supplier || supplierName,
          ocNumber: manualOrExistingOC,
        });
      } else {
        const newItem: OCTrackingItem = {
          id: `oc-item-sync-${client.id}-${tItem.id}`,
          equipmentId: tItem.equipmentId,
          code: tItem.code || matchedEq?.code || `EQ-${idx + 1}`,
          name: tItem.name,
          brand: tItem.brand || matchedEq?.brand || 'Genérico',
          model: tItem.model || matchedEq?.model || 'Estándar',
          quantity: quantity,
          costPriceCOP: costPrice,
          totalCostCOP: costPrice * quantity,
          supplier: supplierName,
          ocNumber: manualOrExistingOC,
          status: 'Emitida / Enviada al Proveedor',
          paymentTerms: 'Crédito 30 días',
          paymentStatus: 'Pendiente',
          notes: `Licitación Adjudicada: ${client.header.processNumber || client.clientName}`,
          createdAt: now,
          lastUpdatedAt: now,
          history: [
            {
              id: `log-sync-${Date.now()}-${idx}`,
              timestamp: now,
              newStatus: 'Emitida / Enviada al Proveedor',
              user: 'Sistema SYD (Sincronización Automática)',
              note: `Licitación adjudicada para ${supplierName}. Pendiente asignar N° de OC manual de la empresa.`,
            },
          ],
        };
        mergedItems.push(newItem);
        importedCount += 1;
      }
    });

    // Also preserve any manually appended items to this contract
    existingItemsPool.forEach((it) => {
      if (!mergedItems.some((m) => m.id === it.id)) {
        mergedItems.push(it);
      }
    });

    const totalCost = mergedItems.reduce((sum, item) => sum + (item.totalCostCOP || 0), 0);

    const contract: OCTrackingContract = {
      id: targetContractId,
      tenderClientId: client.id,
      sourceType: 'licitacion_adjudicada',
      contractNumber: client.header.processNumber || primaryExisting?.contractNumber || `LP-${client.id.slice(-6)}`,
      ocNumber: primaryExisting?.ocNumber || '',
      supplier: primaryExisting?.supplier || 'Múltiples Proveedores / Licitación',
      clientName: client.clientName,
      nit: client.nit || client.header.nit || primaryExisting?.nit || 'Sin NIT',
      city: client.header.city || primaryExisting?.city || 'Colombia',
      contactPerson: client.header.contactPerson || primaryExisting?.contactPerson,
      contactPhone: client.header.contactPhone || primaryExisting?.contactPhone,
      contactEmail: client.header.contactEmail || primaryExisting?.contactEmail,
      processType: client.header.processType || 'Licitación Adjudicada',
      totalBudgetCOP: client.header.budgetCOP || totalCost * 1.35,
      totalCostCOP: totalCost,
      globalStatus: primaryExisting?.globalStatus || 'Emitida / Enviada al Proveedor',
      paymentTerms: primaryExisting?.paymentTerms || 'Crédito 30 días',
      paymentStatus: primaryExisting?.paymentStatus || 'Pendiente',
      createdAt: primaryExisting?.createdAt || now,
      lastUpdatedAt: primaryExisting?.lastUpdatedAt || now,
      notes: `Licitación adjudicada: ${client.header.processNumber || client.clientName}`,
      items: mergedItems,
    };

    syncedTenderContracts.push(contract);
  }

  const finalContracts = [...syncedTenderContracts, ...nonTenderContracts];

  if (JSON.stringify(currentContracts) === JSON.stringify(finalContracts)) {
    return { updatedContracts: currentContracts, importedCount: 0 };
  }

  if (importedCount > 0 || currentContracts.length !== finalContracts.length) {
    saveStoredOCTrackingContracts(finalContracts);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('syd-oc-tracking-updated'));
    }
  }

  return { updatedContracts: finalContracts, importedCount };
};

/**
 * Synchronizes an approved quote into OC Tracking grouped by supplier
 */
export const syncApprovedQuoteToOCTracking = (
  quote: SavedQuote,
  equipments: MedicalEquipment[]
): { contract: OCTrackingContract; isNew: boolean } => {
  const currentContracts = getStoredOCTrackingContracts();
  const existing = currentContracts.find((c) => c.quoteId === quote.id || c.contractNumber === quote.quoteNumber);

  if (existing) {
    return { contract: existing, isNew: false };
  }

  const items: OCTrackingItem[] = quote.items.map((qItem, idx) => {
    const matchedEq = equipments.find((eq) => eq.id === qItem.equipmentId);
    const supplier = resolveSupplierName(matchedEq, qItem.brand);

    return {
      id: `oc-item-quote-${quote.id}-${idx}`,
      equipmentId: qItem.equipmentId,
      code: qItem.code,
      name: qItem.name,
      brand: qItem.brand,
      model: qItem.model,
      quantity: qItem.quantity,
      costPriceCOP: qItem.unitCostCOP || (qItem.unitSalePrice * 0.65),
      totalCostCOP: (qItem.unitCostCOP || (qItem.unitSalePrice * 0.65)) * qItem.quantity,
      supplier: supplier,
      ocNumber: `OC-${new Date().getFullYear()}-${quote.quoteNumber.replace(/[^a-zA-Z0-9]/g, '')}`,
      status: 'Emitida / Enviada al Proveedor',
      paymentTerms: 'Crédito 30 días',
      paymentStatus: 'Pendiente',
      createdAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      notes: `Generado a partir de la cotización aprobada ${quote.quoteNumber}.`,
      history: [
        {
          id: `log-q-${Date.now()}-${idx}`,
          timestamp: new Date().toISOString(),
          newStatus: 'Emitida / Enviada al Proveedor',
          user: 'Sistema SYD',
          note: `Cotización ${quote.quoteNumber} aprobada y enviada a seguimiento de compras y OC.`,
        },
      ],
    };
  });

  const mainSupplier = items[0]?.supplier || 'Proveedor SYD';

  const newContract: OCTrackingContract = {
    id: `oc-contract-quote-${quote.id}`,
    quoteId: quote.id,
    sourceType: 'cotizacion_aprobada',
    contractNumber: quote.quoteNumber,
    ocNumber: `OC-${new Date().getFullYear()}-${quote.quoteNumber.replace(/[^a-zA-Z0-9]/g, '')}`,
    supplier: mainSupplier,
    clientName: quote.clientName,
    nit: quote.nit,
    city: quote.city,
    contactPerson: quote.contactPerson,
    contactPhone: quote.contactPhone,
    contactEmail: quote.contactEmail,
    processType: 'Cotización Comercial Aprobada',
    totalBudgetCOP: quote.total,
    totalCostCOP: items.reduce((s, it) => s + it.totalCostCOP, 0),
    globalStatus: 'Emitida / Enviada al Proveedor',
    paymentTerms: 'Crédito 30 días',
    paymentStatus: 'Pendiente',
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    notes: `Cotización comercial aprobada por el cliente.`,
    items: items,
  };

  const updated = [newContract, ...currentContracts];
  saveStoredOCTrackingContracts(updated);
  return { contract: newContract, isNew: true };
};

/**
 * Export all OC Tracking contracts and items to Excel-compatible CSV format with UTF-8 BOM
 */
export const exportOCTrackingToExcel = (contracts: OCTrackingContract[]): void => {
  const headers = [
    'N° Contrato / Proceso',
    'Cliente / Entidad',
    'NIT Cliente',
    'Ciudad',
    'N° Orden de Compra (OC)',
    'Proveedor / Fabricante',
    'NIT Proveedor',
    'Contacto Proveedor',
    'Forma de Pago al Proveedor',
    'Estado del Pago',
    'Estado Operativo de la OC',
    'Parte del Equipo',
    'Equipo Médico',
    'Marca',
    'Modelo',
    'Cantidad',
    'Costo Unitario COP',
    'Costo Total COP',
    'Factura Proveedor',
    'Transportadora / Guía',
    'Fecha Creación',
    'Última Novedad',
    'Alerta >48h Inactividad',
    'Notas / Observaciones',
  ];

  const rows: string[][] = [];

  contracts.forEach((contract) => {
    if (contract.items.length === 0) {
      rows.push([
        contract.contractNumber,
        contract.clientName,
        contract.nit,
        contract.city,
        contract.ocNumber || 'Sin OC',
        contract.supplier || 'Por Asignar',
        contract.supplierNit || '',
        contract.supplierContact || '',
        contract.paymentTerms || 'Crédito 30 días',
        contract.paymentStatus || 'Pendiente',
        contract.globalStatus || 'Borrador / Solicitud',
        'N/A',
        '(Sin equipos registrados aún)',
        '',
        '',
        '0',
        '0',
        '0',
        '',
        '',
        contract.createdAt ? new Date(contract.createdAt).toLocaleDateString('es-CO') : '',
        contract.lastUpdatedAt ? new Date(contract.lastUpdatedAt).toLocaleDateString('es-CO') : '',
        'No',
        contract.notes || '',
      ]);
    } else {
      contract.items.forEach((item) => {
        const lastUpdate = new Date(item.lastUpdatedAt || item.createdAt).getTime();
        const hours = (Date.now() - lastUpdate) / (1000 * 60 * 60);
        const isAlert =
          hours > 48 &&
          item.status !== 'Entregado e Instalado' &&
          item.status !== 'Cerrado / Concluido' &&
          item.status !== 'Cancelada';

        rows.push([
          contract.contractNumber,
          contract.clientName,
          contract.nit,
          contract.city,
          item.ocNumber || contract.ocNumber || 'Sin OC',
          item.supplier || contract.supplier || 'Proveedor SYD',
          item.supplierNit || contract.supplierNit || '',
          item.supplierContact || contract.supplierContact || '',
          item.paymentTerms || contract.paymentTerms || 'Crédito 30 días',
          item.paymentStatus || contract.paymentStatus || 'Pendiente',
          item.status || contract.globalStatus,
          item.code || '',
          item.name || '',
          item.brand || '',
          item.model || '',
          String(item.quantity || 1),
          String(item.costPriceCOP || 0),
          String(item.totalCostCOP || (item.costPriceCOP * item.quantity) || 0),
          item.invoiceNumber || '',
          item.trackingNumber || '',
          item.createdAt ? new Date(item.createdAt).toLocaleDateString('es-CO') : '',
          item.lastUpdatedAt ? new Date(item.lastUpdatedAt).toLocaleDateString('es-CO') : '',
          isAlert ? `SÍ (${Math.floor(hours / 24)} días)` : 'Al día',
          item.notes || contract.notes || '',
        ]);
      });
    }
  });

  const escapeCSV = (field: string) => {
    if (field === null || field === undefined) return '""';
    const str = String(field).replace(/"/g, '""');
    return `"${str}"`;
  };

  const csvContent =
    '\uFEFF' +
    headers.map(escapeCSV).join(';') +
    '\n' +
    rows.map((row) => row.map(escapeCSV).join(';')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    `Seguimiento_OC_SYD_${new Date().toISOString().slice(0, 10)}.csv`
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Loads stored supplier profiles and auto-discovers any suppliers from contracts or default manufacturers
 */
export const getStoredSupplierProfiles = (
  contracts: OCTrackingContract[] = [],
  equipments: { supplier?: string; brand?: string; name?: string; allSuppliers?: string[]; alternateSuppliers?: string[] }[] = []
): SupplierProfile[] => {
  let stored: SupplierProfile[] = [];
  try {
    const raw = localStorage.getItem(SUPPLIERS_STORAGE_KEY);
    if (raw) {
      stored = JSON.parse(raw);
    }
    if (!stored || stored.length === 0) {
      stored = MASTER_SUPPLIERS_CATALOG;
      localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(MASTER_SUPPLIERS_CATALOG));
    }
  } catch (err) {
    console.error('Error reading supplier profiles storage:', err);
    stored = MASTER_SUPPLIERS_CATALOG;
  }

  // Pre-unify stored list if duplicates or very similar entries already exist in localStorage
  const preUnified = unifyAllDuplicateSuppliers(stored, contracts);
  if (preUnified.mergedCount > 0) {
    stored = preUnified.unifiedSuppliers;
    try {
      localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(stored));
      preUnified.deletedIds.forEach((delId) => {
        deleteSupplierFromFirestore(delId).catch(() => {});
      });
    } catch {
      // ignore
    }
  }

  const map = new Map<string, SupplierProfile>();
  const canonicalMap = new Map<string, SupplierProfile>();

  // Helper to index a profile
  const indexProfile = (p: SupplierProfile) => {
    const exactKey = p.name.trim().toLowerCase();
    map.set(exactKey, p);
    const canonKey = getSupplierCanonicalKey(p.name);
    if (canonKey && !canonicalMap.has(canonKey)) {
      canonicalMap.set(canonKey, p);
    }
  };

  // Helper to find an existing profile by exact name, canonical key, or high similarity
  const findExistingProfile = (candidateName: string): SupplierProfile | undefined => {
    const exact = candidateName.trim().toLowerCase();
    if (map.has(exact)) return map.get(exact);

    const canon = getSupplierCanonicalKey(candidateName);
    if (canon && canonicalMap.has(canon)) return canonicalMap.get(canon);

    // Check fuzzy/pair evaluation against indexed profiles
    for (const p of map.values()) {
      const evalRes = evaluateSupplierPairSimilarity({ name: candidateName } as any, p);
      if (evalRes.isDuplicate) return p;
    }
    return undefined;
  };

  // Add stored
  stored.forEach((p) => {
    indexProfile(p);
  });

  // Discovered from active contracts & items
  contracts.forEach((c) => {
    if (c.supplier && c.supplier.trim()) {
      const suppName = c.supplier.trim();
      const existing = findExistingProfile(suppName);
      if (!existing) {
        const brand = extractBrandFromSupplier(suppName);
        const newProf: SupplierProfile = {
          id: `supp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: suppName,
          nit: c.supplierNit || '',
          contactPerson: c.supplierContact || '',
          phone: '',
          email: '',
          city: c.city || '',
          brands: brand ? [brand] : [],
          defaultPaymentTerms: c.paymentTerms || 'Crédito 30 días',
          notes: c.notes || '',
          createdAt: c.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        indexProfile(newProf);
      } else {
        if (!existing.nit && c.supplierNit) existing.nit = c.supplierNit;
        if (!existing.contactPerson && c.supplierContact) existing.contactPerson = c.supplierContact;
      }
    }

    c.items.forEach((it) => {
      if (it.supplier && it.supplier.trim()) {
        const suppName = it.supplier.trim();
        const existing = findExistingProfile(suppName);
        if (!existing) {
          const brand = extractBrandFromSupplier(suppName) || it.brand;
          const newProf: SupplierProfile = {
            id: `supp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: suppName,
            nit: it.supplierNit || '',
            contactPerson: it.supplierContact || '',
            phone: '',
            email: '',
            city: '',
            brands: brand ? [brand] : [],
            defaultPaymentTerms: it.paymentTerms || 'Crédito 30 días',
            notes: it.notes || '',
            createdAt: it.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          indexProfile(newProf);
        }
      }
    });
  });

  // Discovered from equipments catalog if provided
  if (equipments && equipments.length > 0) {
    equipments.forEach((eq) => {
      // Gather all unique suppliers for this equipment
      const allEqSupps: string[] = [];
      if (eq.supplier) {
        eq.supplier.split(/[\/\;\n\,\|]+/).forEach((s) => {
          const t = s.trim();
          if (t && !allEqSupps.some((x) => x.toLowerCase() === t.toLowerCase())) allEqSupps.push(t);
        });
      }
      if (eq.allSuppliers && Array.isArray(eq.allSuppliers)) {
        eq.allSuppliers.forEach((s) => {
          const t = s.trim();
          if (t && !allEqSupps.some((x) => x.toLowerCase() === t.toLowerCase())) allEqSupps.push(t);
        });
      }
      if (eq.alternateSuppliers && Array.isArray(eq.alternateSuppliers)) {
        eq.alternateSuppliers.forEach((s) => {
          const t = s.trim();
          if (t && !allEqSupps.some((x) => x.toLowerCase() === t.toLowerCase())) allEqSupps.push(t);
        });
      }

      allEqSupps.forEach((cleanSupp) => {
        if (!cleanSupp || cleanSupp.toLowerCase() === 'por asignar' || cleanSupp.toLowerCase() === 'n/a' || cleanSupp.toLowerCase() === 'ninguno') return;
        const existing = findExistingProfile(cleanSupp);
        if (!existing) {
          const brand = eq.brand ? eq.brand.trim() : extractBrandFromSupplier(cleanSupp);
          const newProf: SupplierProfile = {
            id: `supp-cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: cleanSupp,
            nit: '',
            contactPerson: '',
            phone: '',
            email: '',
            city: 'Colombia',
            brands: brand ? [brand] : [],
            defaultPaymentTerms: 'Crédito 30 días',
            notes: `Proveedor registrado desde el catálogo biomédico (${eq.name || 'Equipo'}).`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          indexProfile(newProf);
        } else if (eq.brand && eq.brand.trim()) {
          if (!existing.brands) existing.brands = [];
          if (!existing.brands.some((b) => b.toLowerCase() === eq.brand!.trim().toLowerCase())) {
            existing.brands.push(eq.brand.trim());
          }
        }
      });
    });
  }

  // Ensure fully unified result with no remaining duplicate clusters
  const finalUnified = unifyAllDuplicateSuppliers(Array.from(map.values()), contracts);
  let resolvedSuppliers = finalUnified.unifiedSuppliers;

  // Enforce single "TECNICA" profile containing all combined brands
  const tecnicaProfiles = resolvedSuppliers.filter(
    (p) => p.name.toLowerCase().includes('tecnica') || p.name.toLowerCase().includes('electromedica')
  );
  if (tecnicaProfiles.length > 1) {
    const canonicalTecnica = tecnicaProfiles.find((p) => p.name.toUpperCase() === 'TECNICA') || tecnicaProfiles[0];
    canonicalTecnica.name = 'TECNICA';
    const allBrands = new Set<string>();
    tecnicaProfiles.forEach((tp) => {
      (tp.brands || []).forEach((b) => b && allBrands.add(b.trim()));
      if (tp.id !== canonicalTecnica.id) {
        deleteSupplierFromFirestore(tp.id).catch(() => {});
      }
    });
    canonicalTecnica.brands = Array.from(allBrands);
    resolvedSuppliers = resolvedSuppliers.filter(
      (p) => p.id === canonicalTecnica.id || (!p.name.toLowerCase().includes('tecnica') && !p.name.toLowerCase().includes('electromedica'))
    );
  } else if (tecnicaProfiles.length === 1) {
    tecnicaProfiles[0].name = 'TECNICA';
  }

  // Persist the clean consolidated list
  try {
    localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(resolvedSuppliers));
  } catch {}

  return resolvedSuppliers;
};

export const saveStoredSupplierProfiles = (profiles: SupplierProfile[]): void => {
  try {
    localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(profiles));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('syd_suppliers_updated', { detail: profiles }));
    }
    saveSuppliersBatchToFirestore(profiles).catch(() => {});
  } catch (err) {
    console.error('Error saving supplier profiles:', err);
  }
};

/**
 * Automatically registers a supplier or manufacturer in the directory if not already registered
 */
export const autoRegisterSupplierIfNotExists = (
  supplierName: string,
  brand?: string,
  optionalData?: Partial<SupplierProfile>
): SupplierProfile[] => {
  const cleanName = (supplierName || '').trim();
  if (!cleanName || cleanName.toLowerCase() === 'por asignar' || cleanName.toLowerCase() === 'n/a' || cleanName.toLowerCase() === 'ninguno') {
    return getStoredSupplierProfiles();
  }

  const existing = getStoredSupplierProfiles();
  const targetCanon = getSupplierCanonicalKey(cleanName);
  const index = existing.findIndex((p) => {
    if (p.name.trim().toLowerCase() === cleanName.toLowerCase()) return true;
    const pCanon = getSupplierCanonicalKey(p.name);
    if (pCanon && targetCanon && pCanon === targetCanon) return true;
    return evaluateSupplierPairSimilarity({ name: cleanName } as any, p).isDuplicate;
  });

  if (index >= 0) {
    const current = existing[index];
    let updated = false;
    if (brand && brand.trim()) {
      if (!current.brands) current.brands = [];
      if (!current.brands.some((b) => b.toLowerCase() === brand.trim().toLowerCase())) {
        current.brands.push(brand.trim());
        updated = true;
      }
    }
    if (optionalData) {
      if (optionalData.nit && !current.nit) { current.nit = optionalData.nit; updated = true; }
      if (optionalData.contactPerson && !current.contactPerson) { current.contactPerson = optionalData.contactPerson; updated = true; }
      if (optionalData.phone && !current.phone) { current.phone = optionalData.phone; updated = true; }
      if (optionalData.email && !current.email) { current.email = optionalData.email; updated = true; }
    }
    if (updated) {
      current.updatedAt = new Date().toISOString();
      saveStoredSupplierProfiles(existing);
    }
    return existing;
  }

  const detectedBrand = brand?.trim() || extractBrandFromSupplier(cleanName);
  const newProfile: SupplierProfile = {
    id: `supp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: cleanName,
    nit: optionalData?.nit || '',
    contactPerson: optionalData?.contactPerson || optionalData?.contactName || '',
    phone: optionalData?.phone || '',
    email: optionalData?.email || '',
    city: optionalData?.city || 'Colombia',
    brands: detectedBrand ? [detectedBrand] : [],
    defaultPaymentTerms: optionalData?.defaultPaymentTerms || 'Crédito 30 días',
    notes: optionalData?.notes || 'Fabricante / Proveedor registrado automáticamente desde el sistema.',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  existing.unshift(newProfile);
  saveStoredSupplierProfiles(existing);
  return existing;
};


export const deleteSupplierProfile = (supplierIdOrName: string): SupplierProfile[] => {
  try {
    const raw = localStorage.getItem(SUPPLIERS_STORAGE_KEY);
    let stored: SupplierProfile[] = raw ? JSON.parse(raw) : [];
    const cleanQuery = supplierIdOrName.trim().toLowerCase();
    const toDelete = stored.find((p) => p.id === supplierIdOrName || p.name.trim().toLowerCase() === cleanQuery);
    stored = stored.filter((p) => p.id !== supplierIdOrName && p.name.trim().toLowerCase() !== cleanQuery);
    localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify(stored));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('syd_suppliers_updated', { detail: stored }));
    }
    if (toDelete?.id) {
      deleteSupplierFromFirestore(toDelete.id).catch(() => {});
    }
    return stored;
  } catch (err) {
    console.error('Error deleting supplier profile:', err);
    return [];
  }
};

export const clearAllSupplierProfiles = (): void => {
  try {
    localStorage.setItem(SUPPLIERS_STORAGE_KEY, JSON.stringify([]));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('syd_suppliers_updated', { detail: [] }));
    }
    clearAllSuppliersFromFirestore().catch(() => {});
  } catch (err) {
    console.error('Error clearing all supplier profiles:', err);
  }
};

/**
 * Propagates updated supplier details (NIT, Contact, payment terms, notes) across all active contracts and OCs
 */
export const syncSupplierUpdatesToContracts = (
  contracts: OCTrackingContract[],
  supplierProfileOrName: SupplierProfile | string,
  optionalData?: Partial<SupplierProfile>
): OCTrackingContract[] => {
  const targetSupplierName = typeof supplierProfileOrName === 'string'
    ? supplierProfileOrName
    : supplierProfileOrName.name;

  const data: Partial<SupplierProfile> = typeof supplierProfileOrName === 'string'
    ? (optionalData || {})
    : supplierProfileOrName;

  const cleanTarget = targetSupplierName.trim().toLowerCase();
  const nowIso = new Date().toISOString();
  const contact = data.contactName || data.contactPerson;

  return contracts.map((c) => {
    let contractModified = false;
    let newSupplier = c.supplier;
    let newNit = c.supplierNit;
    let newContact = c.supplierContact;
    let newTerms = c.paymentTerms;

    if (c.supplier && c.supplier.trim().toLowerCase() === cleanTarget) {
      contractModified = true;
      if (data.name) newSupplier = data.name.trim();
      if (data.nit !== undefined) newNit = data.nit;
      if (contact !== undefined) newContact = contact;
      if (data.defaultPaymentTerms !== undefined) newTerms = data.defaultPaymentTerms;
    }

    const updatedItems = c.items.map((it) => {
      if (it.supplier && it.supplier.trim().toLowerCase() === cleanTarget) {
        contractModified = true;
        return {
          ...it,
          supplier: data.name ? data.name.trim() : it.supplier,
          supplierNit: data.nit !== undefined ? data.nit : it.supplierNit,
          supplierContact: contact !== undefined ? contact : it.supplierContact,
          paymentTerms: data.defaultPaymentTerms !== undefined ? data.defaultPaymentTerms : it.paymentTerms,
          lastUpdatedAt: nowIso,
        };
      }
      return it;
    });

    if (contractModified) {
      return {
        ...c,
        supplier: newSupplier,
        supplierNit: newNit,
        supplierContact: newContact,
        paymentTerms: newTerms,
        items: updatedItems,
        lastUpdatedAt: nowIso,
      };
    }

    return c;
  });
};

export interface SupplierMatchResult {
  status: 'exact' | 'suggested' | 'none';
  matchedSupplier?: SupplierProfile;
  suggestedSuppliers: SupplierProfile[];
  bestSuggestion?: SupplierProfile;
}

/**
 * Intelligent supplier matching engine:
 * - Detects exact name match
 * - Detects exact brand match in supplier profiles
 * - Detects fuzzy/typo/substring matches (e.g. "drager" -> "Draeger Medical", "COMEN" -> "COMEN Medical Instruments")
 */
export const matchSupplierInDirectory = (
  rawSupplierName: string,
  brandHint?: string
): SupplierMatchResult => {
  if (!rawSupplierName || !rawSupplierName.trim()) {
    return { status: 'none', suggestedSuppliers: [] };
  }

  const profiles = getStoredSupplierProfiles();
  const rawClean = rawSupplierName.trim();
  const rawLower = rawClean.toLowerCase();
  const normQuery = normalizeSupplierQuery(rawClean);

  // 1. Exact match on supplier name
  const exactName = profiles.find(
    (p) => p.name.trim().toLowerCase() === rawLower || normalizeSupplierQuery(p.name) === normQuery
  );
  if (exactName) {
    return {
      status: 'exact',
      matchedSupplier: exactName,
      suggestedSuppliers: [exactName],
      bestSuggestion: exactName,
    };
  }

  // 2. Score all profiles using fuzzy similarity on name and brands
  const scoredProfiles: { profile: SupplierProfile; score: number }[] = [];

  profiles.forEach((p) => {
    // Score based on supplier name
    const nameSim = calculateSupplierSimilarity(rawClean, p.name);

    // Score based on supplier brands
    let bestBrandSim = 0;
    if (p.brands && p.brands.length > 0) {
      for (const b of p.brands) {
        const sim = calculateSupplierSimilarity(rawClean, b);
        if (sim > bestBrandSim) {
          bestBrandSim = sim;
        }
      }
    }

    let finalScore = Math.max(nameSim, bestBrandSim);

    // Only apply brandHint boost if the supplier actually has this brand AND there is at least minimal relevance or brand matches rawSupplier
    if (brandHint && brandHint.trim()) {
      const normBrandHint = normalizeSupplierQuery(brandHint);
      const supplierHasBrand = p.brands?.some((b) => normalizeSupplierQuery(b) === normBrandHint);
      if (supplierHasBrand) {
        // If supplier manufactures/distributes this brand, check if rawSupplierName is close to the brand or name
        const rawMatchesBrand = calculateSupplierSimilarity(rawClean, brandHint);
        if (rawMatchesBrand >= 0.7 || nameSim >= 0.6) {
          finalScore = Math.max(finalScore, 0.92);
        }
      }
    }

    if (finalScore >= 0.65) {
      scoredProfiles.push({ profile: p, score: finalScore });
    }
  });

  scoredProfiles.sort((a, b) => b.score - a.score);

  if (scoredProfiles.length > 0) {
    const best = scoredProfiles[0];
    if (best.score >= 0.98) {
      return {
        status: 'exact',
        matchedSupplier: best.profile,
        suggestedSuppliers: scoredProfiles.map((s) => s.profile),
        bestSuggestion: best.profile,
      };
    }

    return {
      status: 'suggested',
      matchedSupplier: undefined,
      suggestedSuppliers: scoredProfiles.map((s) => s.profile),
      bestSuggestion: best.profile,
    };
  }

  return {
    status: 'none',
    suggestedSuppliers: [],
  };
};

/**
 * Checks whether a given supplier name is already registered in the Supplier Directory (Ventana 5)
 */
export const isSupplierRegisteredInDirectory = (supplierName: string): boolean => {
  if (!supplierName || !supplierName.trim()) return false;
  const result = matchSupplierInDirectory(supplierName);
  return result.status === 'exact';
};

/**
 * Auto-registers suppliers from equipment catalog imports or updates.
 * - Detects if the supplier already exists in Ventana 5 (case-insensitive name match).
 * - If multiple suppliers are provided in string (separated by / , ; or newline), splits and registers each.
 * - If already existing, links the new brand if not already present.
 * - If new, registers the supplier with default payment terms, brand, and origin notes.
 * - Dispatches a window event 'syd_suppliers_updated' so Ventana 5 updates reactively in real time.
 */
export const autoRegisterSuppliersFromEquipments = (
  items: {
    supplier?: string;
    allSuppliers?: string[];
    alternateSuppliers?: string[];
    supplierPrices?: { supplier: string; costCOP?: number }[];
    brand?: string;
    name?: string;
    model?: string;
    code?: string;
    baseCostCOP?: number;
  }[]
): {
  addedSuppliers: string[];
  existingSuppliers: string[];
  totalProcessed: number;
} => {
  const currentProfiles = getStoredSupplierProfiles();
  const map = new Map<string, SupplierProfile>();

  currentProfiles.forEach((p) => {
    map.set(p.name.trim().toLowerCase(), p);
  });

  const addedSuppliers: string[] = [];
  const existingSuppliers: string[] = [];
  let hasChanges = false;

  items.forEach((it) => {
    // Collect all candidate supplier strings
    const candidates: string[] = [];
    if (it.supplier && it.supplier.trim()) {
      candidates.push(
        ...it.supplier
          .split(/[\/\;\n\,\|]+/)
          .map((s) => s.trim())
      );
    }
    if (it.allSuppliers && Array.isArray(it.allSuppliers)) {
      it.allSuppliers.forEach((s) => {
        if (s && typeof s === 'string') {
          candidates.push(...s.split(/[\/\;\n\,\|]+/).map((x) => x.trim()));
        }
      });
    }
    if (it.alternateSuppliers && Array.isArray(it.alternateSuppliers)) {
      it.alternateSuppliers.forEach((s) => {
        if (s && typeof s === 'string') {
          candidates.push(...s.split(/[\/\;\n\,\|]+/).map((x) => x.trim()));
        }
      });
    }
    if (it.supplierPrices && Array.isArray(it.supplierPrices)) {
      it.supplierPrices.forEach((sp) => {
        if (sp && sp.supplier && typeof sp.supplier === 'string') {
          candidates.push(...sp.supplier.split(/[\/\;\n\,\|]+/).map((x) => x.trim()));
        }
      });
    }

    let rawSuppliers = Array.from(
      new Set(
        candidates.filter(
          (s) =>
            s &&
            s.length > 0 &&
            s.toLowerCase() !== 'por asignar' &&
            s.toLowerCase() !== 'n/a' &&
            s.toLowerCase() !== 'ninguno'
        )
      )
    );

    if (rawSuppliers.length === 0 && it.brand && it.brand.trim()) {
      const bTrim = it.brand.trim();
      if (!['por asignar', 'n/a', 'ninguno', 'sin proveedor asignado'].includes(bTrim.toLowerCase())) {
        rawSuppliers = [bTrim];
      }
    }

    if (rawSuppliers.length === 0) return;

    rawSuppliers.forEach((cleanSupplier) => {
      const key = cleanSupplier.toLowerCase();

      // Check exact or match
      const match = matchSupplierInDirectory(cleanSupplier, it.brand);
      const existing = match.status === 'exact' && match.matchedSupplier ? match.matchedSupplier : map.get(key);

      if (existing) {
        if (!existingSuppliers.includes(existing.name)) {
          existingSuppliers.push(existing.name);
        }
        // Add brand if not yet present
        if (it.brand && it.brand.trim()) {
          const cleanBrand = it.brand.trim();
          if (!existing.brands) existing.brands = [];
          if (!existing.brands.some((b) => b.toLowerCase() === cleanBrand.toLowerCase())) {
            existing.brands.push(cleanBrand);
            existing.updatedAt = new Date().toISOString();
            hasChanges = true;
          }
        }
      } else {
        const brand = it.brand ? it.brand.trim() : extractBrandFromSupplier(cleanSupplier);
        const newProfile: SupplierProfile = {
          id: `supp-cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: cleanSupplier,
          nit: '',
          contactPerson: '',
          phone: '',
          email: '',
          city: 'Colombia',
          brands: brand ? [brand] : [],
          defaultPaymentTerms: 'Crédito 30 días',
          notes: `Proveedor registrado automáticamente desde la importación de catálogo biomédico (${it.name || 'Equipo'}).`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        map.set(key, newProfile);
        if (!addedSuppliers.includes(cleanSupplier)) {
          addedSuppliers.push(cleanSupplier);
        }
        hasChanges = true;
      }
    });
  });

  if (addedSuppliers.length > 0 || hasChanges) {
    const updatedList = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    saveStoredSupplierProfiles(updatedList);
  }

  return {
    addedSuppliers,
    existingSuppliers,
    totalProcessed: addedSuppliers.length + existingSuppliers.length,
  };
};
