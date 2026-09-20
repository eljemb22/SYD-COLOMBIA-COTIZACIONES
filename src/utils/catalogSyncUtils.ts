import { MedicalEquipment, TenderItem, TechnicalRequirement } from '../types';

/**
 * Normalizes a text string for case-insensitive and whitespace-trimmed comparison
 */
export function normalizeText(text?: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/\s+/g, ' '); // collapse spaces
}

/**
 * Infers an equipment category based on its name and clinical keywords
 */
export function inferEquipmentCategory(
  name: string
): 'Monitoreo' | 'Cirugía' | 'Diagnóstico' | 'Quirófano' | 'Cuidados Críticos' | 'Urgencias' | 'Ginecología' {
  const lower = normalizeText(name);

  if (
    lower.includes('monitor') ||
    lower.includes('signos vitales') ||
    lower.includes('spo2') ||
    lower.includes('ecg') ||
    lower.includes('electrocardiog') ||
    lower.includes('holter') ||
    lower.includes('presion') ||
    lower.includes('pulsioximetro')
  ) {
    return 'Monitoreo';
  }

  if (
    lower.includes('electrobisturi') ||
    lower.includes('electrocirugia') ||
    lower.includes('mesa quirurgica') ||
    lower.includes('mesa de cirugia') ||
    lower.includes('lampara cielitica') ||
    lower.includes('cielitica') ||
    lower.includes('aspirador quirurgico') ||
    lower.includes('torre de laparoscopia') ||
    lower.includes('artroscopia')
  ) {
    return 'Cirugía';
  }

  if (
    lower.includes('desfibrilador') ||
    lower.includes('ventilador') ||
    lower.includes('respirador') ||
    lower.includes('bomba de infusion') ||
    lower.includes('bomba de jeringa') ||
    lower.includes('terapia intensiva') ||
    lower.includes('dialisis') ||
    lower.includes('hemodialisis')
  ) {
    return 'Cuidados Críticos';
  }

  if (
    lower.includes('camilla') ||
    lower.includes('paro') ||
    lower.includes('trauma') ||
    lower.includes('ambulancia') ||
    lower.includes('inmovilizador') ||
    lower.includes('succionador portatil')
  ) {
    return 'Urgencias';
  }

  if (
    lower.includes('ecografo') ||
    lower.includes('ultrasonido') ||
    lower.includes('rayos x') ||
    lower.includes('doppler') ||
    lower.includes('oftalmoscopio') ||
    lower.includes('otoscopio') ||
    lower.includes('tensiómetro') ||
    lower.includes('glucometro')
  ) {
    return 'Diagnóstico';
  }

  if (
    lower.includes('ginecolog') ||
    lower.includes('fetal') ||
    lower.includes('incubadora') ||
    lower.includes('cuna radiante') ||
    lower.includes('colposcopio') ||
    lower.includes('parto')
  ) {
    return 'Ginecología';
  }

  if (
    lower.includes('anestesia') ||
    lower.includes('vaporizador') ||
    lower.includes('quiroprax')
  ) {
    return 'Quirófano';
  }

  return 'Diagnóstico';
}

/**
 * Checks if a tender item is a duplicate of an existing equipment in the Catalog (Window 3)
 * Primary detection criteria: Brand + Model (case-insensitive trimmed comparison)
 */
export function findCatalogDuplicate(
  item: { brand?: string; model?: string; name?: string; code?: string; equipmentId?: string },
  catalogEquipments: MedicalEquipment[]
): { isDuplicate: boolean; matchedIndex: number; matchedEquipment?: MedicalEquipment } {
  const normBrand = normalizeText(item.brand);
  const normModel = normalizeText(item.model);
  const normName = normalizeText(item.name);
  const normCode = normalizeText(item.code);

  const matchedIndex = catalogEquipments.findIndex((eq) => {
    const eqBrand = normalizeText(eq.brand);
    const eqModel = normalizeText(eq.model);
    const eqName = normalizeText(eq.name);
    const eqCode = normalizeText(eq.code);

    // 1. Primary Rule: Exact Match on Brand + Model (ignoring empty or placeholder strings)
    if (
      normBrand &&
      normModel &&
      normBrand !== 'biomedico' &&
      normModel !== 'estandar' &&
      normModel !== 'general' &&
      eqBrand &&
      eqModel
    ) {
      if (eqBrand === normBrand && eqModel === normModel) {
        return true;
      }
    }

    // 2. Secondary Rule: Match by ID or explicit Equipment Code
    if (item.equipmentId && eq.id === item.equipmentId) {
      return true;
    }
    if (normCode && eqCode === normCode && eqCode !== '') {
      return true;
    }

    // 3. Fallback Rule: Identical Name and identical Brand
    if (normName && eqName === normName && normBrand && eqBrand === normBrand) {
      return true;
    }

    return false;
  });

  if (matchedIndex >= 0) {
    return {
      isDuplicate: true,
      matchedIndex,
      matchedEquipment: catalogEquipments[matchedIndex],
    };
  }

  return {
    isDuplicate: false,
    matchedIndex: -1,
  };
}

/**
 * Automatically synchronizes a TenderItem to the Catalog (Window 3 - MedicalEquipment).
 * - Only includes fields relevant to Window 3.
 * - Detects duplicates by Brand + Model.
 * - If duplicated, updates/replaces the existing record with latest specs and metadata,
 *   or creates a new differentiated item if `createNewDuplicate` is true.
 */
export function syncTenderItemToCatalog(
  item: TenderItem,
  currentEquipments: MedicalEquipment[],
  options?: {
    createNewDuplicate?: boolean;
    customCategory?: MedicalEquipment['category'];
  }
): {
  updatedEquipments: MedicalEquipment[];
  status: 'created' | 'updated';
  equipmentId: string;
} {
  const { isDuplicate, matchedIndex, matchedEquipment } = findCatalogDuplicate(item, currentEquipments);
  const specsList = (item.requirements || []).map((r) => r.requirement);

  // Preserve existing cost if already set by user, otherwise keep at 0 so user can define it later with alert
  const baseCost =
    matchedEquipment?.baseCostCOP && matchedEquipment.baseCostCOP > 0
      ? matchedEquipment.baseCostCOP
      : 0;

  if (isDuplicate && matchedIndex >= 0 && !options?.createNewDuplicate) {
    // UPDATE / REPLACE EXISTING CATALOG RECORD
    const updated = [...currentEquipments];
    const existing = updated[matchedIndex];

    const updatedEquipment: MedicalEquipment = {
      ...existing,
      name: item.name.trim() || existing.name,
      brand: item.brand.trim() || existing.brand,
      model: item.model.trim() || existing.model,
      originCountry: item.originCountry || existing.originCountry,
      warrantyMonths: item.warrantyMonths || existing.warrantyMonths,
      invimaRecordNumber:
        item.invimaRecord && item.invimaRecord !== 'Vigente'
          ? item.invimaRecord
          : existing.invimaRecordNumber || 'Vigente',
      description: item.observations
        ? `${existing.description ? existing.description + ' | ' : ''}${item.observations}`
        : existing.description,
      // Merge / update technical specs from the tender if provided
      technicalSpecs: specsList.length > 0 ? specsList : existing.technicalSpecs,
      baseCostCOP: baseCost,
    };

    updated[matchedIndex] = updatedEquipment;
    return {
      updatedEquipments: updated,
      status: 'updated',
      equipmentId: existing.id,
    };
  }

  // CREATE NEW CATALOG EQUIPMENT
  const nextSeq = (currentEquipments.length + 1).toString().padStart(3, '0');
  const codePrefix = item.name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, 'EQ');
  const generatedCode = options?.createNewDuplicate
    ? `EQ-${codePrefix}-${nextSeq}-DUP`
    : item.code && !currentEquipments.some((e) => e.code === item.code)
    ? item.code
    : `EQ-${codePrefix}-${nextSeq}`;

  const newCatalogEq: MedicalEquipment = {
    id: `eq-cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    code: generatedCode,
    name: options?.createNewDuplicate ? `${item.name.trim()} (Variante/Copia)` : item.name.trim(),
    brand: item.brand.trim() || 'SYD Biomedical',
    model: item.model.trim() || 'Estándar',
    originCountry: item.originCountry || 'Colombia',
    category: options?.customCategory || inferEquipmentCategory(item.name),
    baseCostCOP: baseCost,
    taxExempt: false,
    taxRate: 19,
    defaultMarginList: 'L4',
    warrantyMonths: item.warrantyMonths || 24,
    invimaRecordNumber: item.invimaRecord || 'Vigente',
    description: item.observations || 'Equipo incorporado automáticamente desde Licitaciones y Contratos',
    technicalSpecs: specsList,
    standardAccessories: [],
    hasDocSheet: false,
    hasInvimaDoc: false,
    hasManual: false,
    hasQualityCert: false,
  };

  return {
    updatedEquipments: [newCatalogEq, ...currentEquipments],
    status: 'created',
    equipmentId: newCatalogEq.id,
  };
}

/**
 * Batch syncs a list of TenderItems into the Catalog, handling duplicates seamlessly
 */
export function batchSyncTenderItemsToCatalog(
  items: TenderItem[],
  currentEquipments: MedicalEquipment[]
): {
  updatedEquipments: MedicalEquipment[];
  createdCount: number;
  updatedCount: number;
} {
  let catalog = [...currentEquipments];
  let createdCount = 0;
  let updatedCount = 0;

  for (const item of items) {
    const res = syncTenderItemToCatalog(item, catalog);
    catalog = res.updatedEquipments;
    if (res.status === 'created') createdCount++;
    else updatedCount++;
  }

  return {
    updatedEquipments: catalog,
    createdCount,
    updatedCount,
  };
}
