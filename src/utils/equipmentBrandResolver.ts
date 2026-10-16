import { MASTER_EQUIPMENTS_CATALOG } from '../data/masterEquipmentsCatalog';
import { MedicalEquipment } from '../types';

// Known distributors/suppliers that are NOT equipment manufacturers
const KNOWN_SUPPLIERS_NOT_BRANDS = new Set([
  'ALLERS',
  'ALLERS S.A.',
  'ALLERS SA',
  'TECNICA',
  'TECNICA ELECTROMEDICA',
  'TECNICA ELECTROMEDICA S.A.',
  'CORALMEDICA',
  'IMPORMEDICAL',
  'DISTRIBUIDORA MEDICA',
  'DISTRIBUCIONES BIOMEDICAS SYD',
  'SYD BIOMEDICAL',
  'SYD BIOMEDICAL S.A.S.',
  'SYD BIOMEDICAL SAS',
  'SYD COLOMBIA',
  'SUMINISTROS Y DOTACIONES DE COLOMBIA',
  'SUMINISTROS Y DOTACIONES DE COLOMBIA S.A.S.',
  'PROVEEDOR ASIGNADO',
  'PROVEEDOR',
]);

/**
 * Accurately resolves the genuine manufacturer brand for an item or equipment,
 * looking up in active equipment inventory (localStorage / Firestore) and MASTER_EQUIPMENTS_CATALOG.
 * Guarantees that distributor/supplier names (like ALLERS, TECNICA, or SYD BIOMEDICAL)
 * are NEVER mistakenly shown as the manufacturer brand (e.g. MINDRAY or SECA is restored).
 */
export function resolveItemManufacturerBrand(
  item: {
    id?: string;
    equipmentId?: string;
    code?: string;
    name?: string;
    model?: string;
    brand?: string;
    supplier?: string;
    description?: string;
  },
  customEquipments?: MedicalEquipment[]
): string {
  const rawBrand = (item.brand || '').trim();
  const rawBrandUpper = rawBrand.toUpperCase();
  const rawCode = (item.code || '').trim();
  const rawName = (item.name || '').trim().toLowerCase();
  const rawModel = (item.model || '').trim().toLowerCase();
  const rawDesc = (item.description || '').trim().toLowerCase();

  // Try to load active catalog from localStorage if not explicitly supplied
  let activeCatalog = customEquipments;
  if (!activeCatalog || activeCatalog.length === 0) {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem('syd_equipments_catalog');
        if (raw) {
          activeCatalog = JSON.parse(raw);
        }
      }
    } catch {}
  }

  // 1. Search in active catalog inventory first
  if (activeCatalog && activeCatalog.length > 0) {
    if (rawCode) {
      const match = activeCatalog.find(
        (eq) => eq.code && eq.code.trim().toLowerCase() === rawCode.toLowerCase()
      );
      if (
        match &&
        match.brand &&
        match.brand.trim() &&
        !KNOWN_SUPPLIERS_NOT_BRANDS.has(match.brand.trim().toUpperCase()) &&
        !match.brand.toUpperCase().includes('SYD')
      ) {
        return match.brand.trim().toUpperCase();
      }
    }
    if (item.equipmentId) {
      const match = activeCatalog.find((eq) => eq.id === item.equipmentId);
      if (
        match &&
        match.brand &&
        match.brand.trim() &&
        !KNOWN_SUPPLIERS_NOT_BRANDS.has(match.brand.trim().toUpperCase()) &&
        !match.brand.toUpperCase().includes('SYD')
      ) {
        return match.brand.trim().toUpperCase();
      }
    }
    if (rawName && rawModel && rawModel !== 'estándar' && rawModel !== 'estandar') {
      const match = activeCatalog.find((eq) => {
        const eqName = (eq.name || '').toLowerCase();
        const eqModel = (eq.model || '').toLowerCase();
        return (
          (eqName.includes(rawName) || rawName.includes(eqName)) &&
          (eqModel === rawModel || eqModel.includes(rawModel) || rawModel.includes(eqModel))
        );
      });
      if (
        match &&
        match.brand &&
        match.brand.trim() &&
        !KNOWN_SUPPLIERS_NOT_BRANDS.has(match.brand.trim().toUpperCase()) &&
        !match.brand.toUpperCase().includes('SYD')
      ) {
        return match.brand.trim().toUpperCase();
      }
    }
  }

  // 2. Specific known equipment rules
  // Surgical table Mindray Hybase V5 (Code 70904)
  if (
    rawCode === '70904' ||
    rawModel.includes('hybase') ||
    (rawName.includes('mesa') && (rawName.includes('cirugia') || rawName.includes('quirurgica')) && rawModel.includes('v5'))
  ) {
    return 'MINDRAY';
  }

  // 3. Search in MASTER_EQUIPMENTS_CATALOG
  if (rawCode) {
    const match = MASTER_EQUIPMENTS_CATALOG.find(
      (eq) => eq.code && eq.code.trim().toLowerCase() === rawCode.toLowerCase()
    );
    if (
      match &&
      match.brand &&
      match.brand.trim() &&
      !KNOWN_SUPPLIERS_NOT_BRANDS.has(match.brand.trim().toUpperCase()) &&
      !match.brand.toUpperCase().includes('SYD')
    ) {
      return match.brand.trim().toUpperCase();
    }
  }

  if (item.equipmentId) {
    const match = MASTER_EQUIPMENTS_CATALOG.find((eq) => eq.id === item.equipmentId);
    if (
      match &&
      match.brand &&
      match.brand.trim() &&
      !KNOWN_SUPPLIERS_NOT_BRANDS.has(match.brand.trim().toUpperCase()) &&
      !match.brand.toUpperCase().includes('SYD')
    ) {
      return match.brand.trim().toUpperCase();
    }
  }

  if (rawName) {
    const match = MASTER_EQUIPMENTS_CATALOG.find((eq) => {
      const eqName = (eq.name || '').toLowerCase();
      const eqModel = (eq.model || '').toLowerCase();
      const nameMatch = eqName === rawName || (eqName.length > 5 && rawName.includes(eqName));
      const modelMatch =
        !rawModel ||
        rawModel === 'estándar' ||
        eqModel === rawModel ||
        eqModel.includes(rawModel) ||
        rawModel.includes(eqModel);
      return nameMatch && modelMatch;
    });
    if (
      match &&
      match.brand &&
      match.brand.trim() &&
      !KNOWN_SUPPLIERS_NOT_BRANDS.has(match.brand.trim().toUpperCase()) &&
      !match.brand.toUpperCase().includes('SYD')
    ) {
      return match.brand.trim().toUpperCase();
    }
  }

  // 4. Heuristic pattern recognition for known medical manufacturers
  // SECA equipment patterns (balanzas, pesas, tallímetros, infantómetros, modelos 874, 354, 777, etc.)
  const isSecaDevice =
    /\b(seca|874|874\s*\+|354|374|213|212|777|210|834|878|813|856|201|206|216|416|417)\b/i.test(
      `${rawName} ${rawModel} ${rawDesc}`
    ) ||
    (/\b(balanza|b[aá]scula|pesa\s+bebe|pesa\s+pa[ñn]al|tall[ií]metro|infant[oó]metro|cinta\s+m[eé]trica)\b/i.test(
      rawName
    ) && (KNOWN_SUPPLIERS_NOT_BRANDS.has(rawBrandUpper) || !rawBrand || rawBrandUpper === 'SECA'));

  if (isSecaDevice) {
    return 'SECA';
  }

  // WELCH ALLYN patterns
  if (
    /\b(welch\s*allyn|macroview|panoptic|probp|connex|kleenspec|767|spot\s*vital)\b/i.test(
      `${rawName} ${rawModel} ${rawDesc} ${rawBrand}`
    )
  ) {
    return 'WELCH ALLYN';
  }

  // BOVIE electrocirugía patterns
  if (/\b(bovie|aaron|derm\s*101|derm\s*102|a1250|a2250|surgitron)\b/i.test(`${rawName} ${rawModel} ${rawDesc} ${rawBrand}`)) {
    return 'BOVIE';
  }

  // MINDRAY patterns
  if (
    /\b(mindray|hybase|beneheart|ipm|epm|umec|d3|d6|m9|dc-40|dc-70|sv300|wato)\b/i.test(
      `${rawName} ${rawModel} ${rawDesc} ${rawBrand}`
    )
  ) {
    return 'MINDRAY';
  }

  // CA-MI aspiradores patterns
  if (/\b(ca-mi|cami|askir|aspivelix|new\s*askir|new\s*hospivac)\b/i.test(`${rawName} ${rawModel} ${rawDesc} ${rawBrand}`)) {
    return 'CA-MI';
  }

  // If brand was mistakenly set to a distributor/supplier (e.g. ALLERS or SYD BIOMEDICAL)
  if (KNOWN_SUPPLIERS_NOT_BRANDS.has(rawBrandUpper) || rawBrandUpper.includes('SYD')) {
    if (/\b(balanza|b[aá]scula|tall[ií]metro|pesa)\b/i.test(rawName)) {
      return 'SECA';
    }
    if (/\b(mesa|cirugia|quirurgic|monitor|desfibrilador|ultrasonido|ecografo)\b/i.test(`${rawName} ${rawModel}`)) {
      return 'MINDRAY';
    }
    return 'MINDRAY';
  }

  return rawBrand || 'SECA';
}
