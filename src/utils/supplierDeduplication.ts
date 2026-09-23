import { SupplierProfile, OCTrackingContract } from '../types';

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
 * Strips common corporate suffixes, country designations, and distribution noise
 * to extract the true canonical entity root (e.g., "STRYKER" and "Stryker Colombia S.A.S." both yield "stryker",
 * "TECNICA" and "Técnica Electromédica" both yield "tecnica")
 */
export const getSupplierCanonicalKey = (name: string): string => {
  if (!name) return '';
  let s = normalizeSupplierQuery(name);

  // Exact canonical alias handling for prominent medical suppliers in Colombia
  if (s.includes('tecnica') || s.includes('electromedica')) {
    return 'tecnica';
  }
  if (s.includes('stryker')) {
    return 'stryker';
  }
  if (s.includes('mindray')) {
    return 'mindray';
  }
  if (s.includes('philips')) {
    return 'philips';
  }
  if (s.includes('welch') && s.includes('allyn')) {
    return 'welch allyn';
  }

  // Common corporate, industry & geographic noise patterns
  const corporateNoisePatterns: RegExp[] = [
    /\b(s\s*a\s*s|sas)\b/g,
    /\b(s\s*a|sa)\b/g,
    /\b(ltda|limitada)\b/g,
    /\b(inc|incorporated)\b/g,
    /\b(corp|corporation)\b/g,
    /\b(llc|gmbh|srl|spa)\b/g,
    /\b(colombia|bogota|medellin|cali|barranquilla|de colombia|en colombia|sucursal colombia)\b/g,
    /\b(latin america|latam)\b/g,
    /\b(medical|healthcare|instruments|endoscopia|distribuciones|distribuidor|distribuidora|equipos medicos|linea medica|soluciones medicas|suministros|suministro y dotaciones)\b/g,
    /\b(electromedica|electromedico|electromedicos|biomedica|biomedicos|hospitalaria|hospitalario|hospitalarios)\b/g,
    /\b(y cia|cia)\b/g,
  ];

  corporateNoisePatterns.forEach((rx) => {
    s = s.replace(rx, ' ');
  });

  const cleaned = s.replace(/\s+/g, ' ').trim();
  // Return cleaned root if meaningful, otherwise fallback to normalized
  return cleaned.length >= 2 ? cleaned : normalizeSupplierQuery(name);
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
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
};

/**
 * Evaluates similarity between two supplier names and reports whether they are duplicates
 */
export const evaluateSupplierPairSimilarity = (
  a: SupplierProfile,
  b: SupplierProfile
): { isDuplicate: boolean; confidence: number; reason: string } => {
  const nameA = a.name.trim();
  const nameB = b.name.trim();

  // 1. Exact identical case-insensitive name
  if (nameA.toLowerCase() === nameB.toLowerCase()) {
    return { isDuplicate: true, confidence: 1.0, reason: 'Nombres idénticos' };
  }

  // 2. Exact normalized (accents removed)
  const normA = normalizeSupplierQuery(nameA);
  const normB = normalizeSupplierQuery(nameB);
  if (normA === normB) {
    return { isDuplicate: true, confidence: 0.99, reason: 'Mismo nombre (variación de tildes o mayúsculas)' };
  }

  // 3. Real NIT match (excluding placeholder or S/N)
  const cleanNitA = (a.nit || '').replace(/[^0-9]/g, '');
  const cleanNitB = (b.nit || '').replace(/[^0-9]/g, '');
  if (cleanNitA.length >= 8 && cleanNitB.length >= 8) {
    // Exact or main root match
    if (cleanNitA === cleanNitB || cleanNitA.startsWith(cleanNitB) || cleanNitB.startsWith(cleanNitA)) {
      return { isDuplicate: true, confidence: 0.98, reason: `Mismo NIT oficial (${a.nit || b.nit})` };
    }
  }

  // 4. Canonical corporate root match (e.g. STRYKER vs Stryker Colombia S.A.S., TECNICA vs Técnica Electromédica)
  const canonA = getSupplierCanonicalKey(nameA);
  const canonB = getSupplierCanonicalKey(nameB);
  if (canonA && canonB) {
    if (canonA === canonB) {
      return { isDuplicate: true, confidence: 0.98, reason: 'Misma razón social o entidad base (ej: Stryker vs Stryker Colombia S.A.S. / Técnica)' };
    }
    // Substring / containment detection (e.g. "stryker" and "stryker endoscopia", or "tecnica" and "tecnica electromedica")
    const shorter = canonA.length < canonB.length ? canonA : canonB;
    const longer = canonA.length < canonB.length ? canonB : canonA;
    if (shorter.length >= 3 && (longer.startsWith(shorter) || longer.includes(shorter))) {
      return { isDuplicate: true, confidence: 0.96, reason: 'Misma entidad corporativa con sufijo o especialidad' };
    }
  }

  // 5. Brand and name cross-matching (e.g. STRYKER brand in Stryker Colombia S.A.S.)
  const brandsA = (a.brands || []).map((br) => normalizeSupplierQuery(br));
  const brandsB = (b.brands || []).map((br) => normalizeSupplierQuery(br));
  const brandMatch =
    brandsA.some((br) => br && (br === canonB || br === normB)) ||
    brandsB.some((br) => br && (br === canonA || br === normA));

  if (brandMatch && (canonA.includes(canonB) || canonB.includes(canonA))) {
    return { isDuplicate: true, confidence: 0.92, reason: 'Misma marca oficial y raíz de fabricante' };
  }

  // 6. Fuzzy similarity on canonical strings (handles typos or small variations, e.g. Draeger vs Drager)
  if (canonA.length >= 4 && canonB.length >= 4) {
    const dist = getLevenshteinDistance(canonA, canonB);
    const maxLen = Math.max(canonA.length, canonB.length);
    const sim = 1 - dist / maxLen;
    if (sim >= 0.85) {
      return { isDuplicate: true, confidence: sim, reason: `Alta similitud en el nombre (${Math.round(sim * 100)}%)` };
    }
  }

  return { isDuplicate: false, confidence: 0, reason: '' };
};

export interface DuplicateSupplierGroup {
  groupId: string;
  canonicalKey: string;
  reason: string;
  confidence: number;
  matchReason?: string;
  confidenceScore?: number;
  canonicalProfile: SupplierProfile;
  duplicateProfiles: SupplierProfile[];
  allProfiles: SupplierProfile[];
}

/**
 * Computes a completeness score for a supplier profile to automatically select
 * the best canonical profile to retain (preferring valid NIT, phone, address, and proper casing)
 */
export const computeSupplierCompletenessScore = (profile: SupplierProfile): number => {
  let score = 0;

  // Real NIT (not S/N, not empty)
  const cleanNit = (profile.nit || '').replace(/[^0-9]/g, '');
  if (cleanNit.length >= 8) score += 40;
  else if (profile.nit && profile.nit.trim().toLowerCase() !== 's/n') score += 15;

  // Phone number
  if (profile.phone && profile.phone.trim().length >= 7) score += 20;

  // Contact person
  if (profile.contactPerson && profile.contactPerson.trim().length >= 3) score += 15;

  // Email
  if (profile.email && profile.email.includes('@')) score += 15;

  // Address and City
  if (profile.address && profile.address.trim().length >= 5) score += 10;
  if (profile.city && profile.city.trim().toLowerCase() !== 'colombia') score += 10;

  // Brands defined
  if (profile.brands && profile.brands.length > 0) score += 10;

  // Casing: Title Case is preferred over ALL CAPS
  const name = profile.name.trim();
  const isAllCaps = name === name.toUpperCase() && /[A-Z]/.test(name);
  if (!isAllCaps) score += 10;

  // Strict priority requested by user: "deja tecnica y ya"
  if (name.toUpperCase() === 'TECNICA') {
    score += 1000;
  }

  // Specific corporate details (e.g. "S.A.S." shows registered legal name)
  if (/s\.?a\.?s|ltda|s\.?a\b/i.test(name)) score += 10;

  // Master catalog or persistent non-auto ID
  if (profile.id && !profile.id.startsWith('supp-cat-') && !profile.id.startsWith('supp-')) {
    score += 15;
  }

  return score;
};

/**
 * Analyzes an array of supplier profiles and clusters them into duplicate groups
 */
export const detectDuplicateSupplierGroups = (suppliers: SupplierProfile[]): DuplicateSupplierGroup[] => {
  if (!suppliers || suppliers.length <= 1) return [];

  const visited = new Set<string>();
  const groups: DuplicateSupplierGroup[] = [];

  for (let i = 0; i < suppliers.length; i++) {
    const pA = suppliers[i];
    if (visited.has(pA.id)) continue;

    const currentCluster: SupplierProfile[] = [pA];
    let topReason = '';
    let maxConfidence = 0;

    for (let j = i + 1; j < suppliers.length; j++) {
      const pB = suppliers[j];
      if (visited.has(pB.id)) continue;

      const evalRes = evaluateSupplierPairSimilarity(pA, pB);
      if (evalRes.isDuplicate) {
        currentCluster.push(pB);
        visited.add(pB.id);
        if (evalRes.confidence > maxConfidence) {
          maxConfidence = evalRes.confidence;
          topReason = evalRes.reason;
        }
      }
    }

    if (currentCluster.length > 1) {
      visited.add(pA.id);

      // Rank profiles in cluster to pick the most complete as canonical
      const sorted = [...currentCluster].sort(
        (x, y) => computeSupplierCompletenessScore(y) - computeSupplierCompletenessScore(x)
      );

      const canonicalProfile = sorted[0];
      const duplicateProfiles = sorted.slice(1);

      groups.push({
        groupId: `dup-group-${canonicalProfile.id}`,
        canonicalKey: getSupplierCanonicalKey(canonicalProfile.name),
        reason: topReason || 'Nombre y características equivalentes',
        confidence: maxConfidence || 0.95,
        matchReason: topReason || 'Nombre y características equivalentes',
        confidenceScore: Math.round((maxConfidence || 0.95) * 100),
        canonicalProfile,
        duplicateProfiles,
        allProfiles: currentCluster,
      });
    }
  }

  return groups;
};

/**
 * Merges a group of duplicate supplier profiles into a single comprehensive canonical profile
 */
export const mergeSupplierProfiles = (
  canonical: SupplierProfile,
  duplicates: SupplierProfile[]
): SupplierProfile => {
  const merged: SupplierProfile = { ...canonical };

  // If this group is the Tecnica / Tecnica Electromedica entity, enforce canonical name "TECNICA" as requested
  const isTecnicaGroup =
    merged.name.toLowerCase().includes('tecnica') ||
    merged.name.toLowerCase().includes('electromedica') ||
    duplicates.some(
      (d) => d.name.toLowerCase().includes('tecnica') || d.name.toLowerCase().includes('electromedica')
    );
  if (isTecnicaGroup) {
    merged.name = 'TECNICA';
  }

  // Combine and deduplicate brands
  const brandSet = new Set<string>();
  (canonical.brands || []).forEach((b) => b && brandSet.add(b.trim()));
  duplicates.forEach((d) => {
    (d.brands || []).forEach((b) => b && brandSet.add(b.trim()));
  });
  merged.brands = Array.from(brandSet);

  // Fill in missing information from duplicates
  duplicates.forEach((d) => {
    if ((!merged.nit || merged.nit === 'S/N' || merged.nit === '') && d.nit && d.nit !== 'S/N') {
      merged.nit = d.nit;
    }
    if (!merged.phone && d.phone) merged.phone = d.phone;
    if (!merged.email && d.email) merged.email = d.email;
    if (!merged.contactPerson && d.contactPerson) merged.contactPerson = d.contactPerson;
    if ((!merged.city || merged.city.toLowerCase() === 'colombia') && d.city && d.city.toLowerCase() !== 'colombia') {
      merged.city = d.city;
    }
    if (!merged.address && d.address) merged.address = d.address;
    if (!merged.defaultPaymentTerms && d.defaultPaymentTerms) merged.defaultPaymentTerms = d.defaultPaymentTerms;

    // Merge notes if distinct
    if (d.notes && d.notes.trim()) {
      if (!merged.notes) {
        merged.notes = d.notes;
      } else if (!merged.notes.includes(d.notes.trim()) && !d.notes.includes('registrado automáticamente')) {
        merged.notes = `${merged.notes} | ${d.notes}`;
      }
    }
  });

  merged.updatedAt = new Date().toISOString();
  return merged;
};

/**
 * Unifies all detected duplicates in a list of supplier profiles and updates linked contracts
 */
export const unifyAllDuplicateSuppliers = (
  suppliers: SupplierProfile[],
  contracts: OCTrackingContract[] = []
): {
  unifiedSuppliers: SupplierProfile[];
  updatedContracts: OCTrackingContract[];
  mergedCount: number;
  deletedIds: string[];
  mergedGroupsSummary: { canonicalName: string; mergedNames: string[] }[];
} => {
  const groups = detectDuplicateSupplierGroups(suppliers);
  if (groups.length === 0) {
    return {
      unifiedSuppliers: suppliers,
      updatedContracts: contracts,
      mergedCount: 0,
      deletedIds: [],
      mergedGroupsSummary: [],
    };
  }

  const deletedIds = new Set<string>();
  const nameReplacementMap = new Map<string, { newName: string; newNit?: string }>();
  const updatedCanonicalMap = new Map<string, SupplierProfile>();
  const mergedGroupsSummary: { canonicalName: string; mergedNames: string[] }[] = [];

  groups.forEach((g) => {
    const mergedCanonical = mergeSupplierProfiles(g.canonicalProfile, g.duplicateProfiles);
    updatedCanonicalMap.set(mergedCanonical.id, mergedCanonical);

    const mergedNames: string[] = [];
    g.duplicateProfiles.forEach((d) => {
      deletedIds.add(d.id);
      mergedNames.push(d.name);
      nameReplacementMap.set(d.name.trim().toLowerCase(), {
        newName: mergedCanonical.name,
        newNit: mergedCanonical.nit,
      });
    });

    mergedGroupsSummary.push({
      canonicalName: mergedCanonical.name,
      mergedNames,
    });
  });

  // Rebuild unified suppliers list
  const unifiedSuppliers: SupplierProfile[] = [];
  suppliers.forEach((s) => {
    if (deletedIds.has(s.id)) return; // Exclude deleted duplicate
    if (updatedCanonicalMap.has(s.id)) {
      unifiedSuppliers.push(updatedCanonicalMap.get(s.id)!);
    } else {
      unifiedSuppliers.push(s);
    }
  });

  // Re-link and update contracts where obsolete duplicate names were referenced
  let contractsChanged = false;
  const updatedContracts = contracts.map((c) => {
    let contractModified = false;
    let supp = c.supplier;
    let nit = c.supplierNit;

    if (supp && nameReplacementMap.has(supp.trim().toLowerCase())) {
      const rep = nameReplacementMap.get(supp.trim().toLowerCase())!;
      supp = rep.newName;
      if (rep.newNit && (!nit || nit === 'S/N')) nit = rep.newNit;
      contractModified = true;
    }

    const updatedItems = c.items.map((it) => {
      if (it.supplier && nameReplacementMap.has(it.supplier.trim().toLowerCase())) {
        const rep = nameReplacementMap.get(it.supplier.trim().toLowerCase())!;
        contractModified = true;
        return {
          ...it,
          supplier: rep.newName,
          supplierNit: rep.newNit && (!it.supplierNit || it.supplierNit === 'S/N') ? rep.newNit : it.supplierNit,
        };
      }
      return it;
    });

    if (contractModified) {
      contractsChanged = true;
      return {
        ...c,
        supplier: supp,
        supplierNit: nit,
        items: updatedItems,
        lastUpdatedAt: new Date().toISOString(),
      };
    }
    return c;
  });

  return {
    unifiedSuppliers: unifiedSuppliers.sort((a, b) => a.name.localeCompare(b.name)),
    updatedContracts: contractsChanged ? updatedContracts : contracts,
    mergedCount: deletedIds.size,
    deletedIds: Array.from(deletedIds),
    mergedGroupsSummary,
  };
};

/**
 * Unifies a single selected duplicate group, optionally allowing the user to specify
 * which profile ID to retain as the primary canonical profile
 */
export const unifySingleDuplicateGroup = (
  group: DuplicateSupplierGroup,
  suppliers: SupplierProfile[],
  contracts: OCTrackingContract[] = [],
  preferredCanonicalId?: string
): {
  unifiedSuppliers: SupplierProfile[];
  updatedContracts: OCTrackingContract[];
  mergedCanonical: SupplierProfile;
  deletedIds: string[];
} => {
  // Determine canonical profile
  const chosenCanonical = preferredCanonicalId
    ? group.allProfiles.find((p) => p.id === preferredCanonicalId) || group.canonicalProfile
    : group.canonicalProfile;

  const duplicates = group.allProfiles.filter((p) => p.id !== chosenCanonical.id);
  const mergedCanonical = mergeSupplierProfiles(chosenCanonical, duplicates);

  const deletedIds = new Set(duplicates.map((d) => d.id));
  const nameReplacementMap = new Map<string, { newName: string; newNit?: string }>();

  duplicates.forEach((d) => {
    nameReplacementMap.set(d.name.trim().toLowerCase(), {
      newName: mergedCanonical.name,
      newNit: mergedCanonical.nit,
    });
  });

  const unifiedSuppliers = suppliers
    .filter((s) => !deletedIds.has(s.id))
    .map((s) => (s.id === chosenCanonical.id ? mergedCanonical : s))
    .sort((a, b) => a.name.localeCompare(b.name));

  let contractsChanged = false;
  const updatedContracts = contracts.map((c) => {
    let modified = false;
    let supp = c.supplier;
    let nit = c.supplierNit;

    if (supp && nameReplacementMap.has(supp.trim().toLowerCase())) {
      const rep = nameReplacementMap.get(supp.trim().toLowerCase())!;
      supp = rep.newName;
      if (rep.newNit && (!nit || nit === 'S/N')) nit = rep.newNit;
      modified = true;
    }

    const updatedItems = c.items.map((it) => {
      if (it.supplier && nameReplacementMap.has(it.supplier.trim().toLowerCase())) {
        const rep = nameReplacementMap.get(it.supplier.trim().toLowerCase())!;
        modified = true;
        return {
          ...it,
          supplier: rep.newName,
          supplierNit: rep.newNit && (!it.supplierNit || it.supplierNit === 'S/N') ? rep.newNit : it.supplierNit,
        };
      }
      return it;
    });

    if (modified) {
      contractsChanged = true;
      return {
        ...c,
        supplier: supp,
        supplierNit: nit,
        items: updatedItems,
        lastUpdatedAt: new Date().toISOString(),
      };
    }
    return c;
  });

  return {
    unifiedSuppliers,
    updatedContracts: contractsChanged ? updatedContracts : contracts,
    mergedCanonical,
    deletedIds: Array.from(deletedIds),
  };
};

/**
 * Normalizes and unifies supplier names across equipment items.
 * Specifically converts any reference to "TECNICA ELECTROMEDICA", "Técnica Electromédica", etc. to "TECNICA",
 * as requested: "deja tecnica y ya" and "cambia los equipos que tenga que ver con estos dos nombres y cambialo por el que vas a dejar, deja tecnica y ya".
 */
export const sanitizeEquipmentSuppliers = <T extends {
  supplier?: string;
  alternateSuppliers?: string[];
  allSuppliers?: string[];
  supplierPrices?: any[];
}>(equipments: T[]): T[] => {
  if (!equipments || !Array.isArray(equipments)) return equipments;

  return equipments.map((eq) => {
    let modified = false;
    let s = eq.supplier;
    if (s && (s.toLowerCase().includes('tecnica') || s.toLowerCase().includes('electromedica'))) {
      if (s !== 'TECNICA') {
        s = 'TECNICA';
        modified = true;
      }
    }

    let alt = eq.alternateSuppliers;
    if (alt && Array.isArray(alt)) {
      const newAlt = alt.map((item) =>
        item && (item.toLowerCase().includes('tecnica') || item.toLowerCase().includes('electromedica'))
          ? 'TECNICA'
          : item
      );
      if (JSON.stringify(newAlt) !== JSON.stringify(alt)) {
        alt = Array.from(new Set(newAlt));
        modified = true;
      }
    }

    let allS = eq.allSuppliers;
    if (allS && Array.isArray(allS)) {
      const newAllS = allS.map((item) =>
        item && (item.toLowerCase().includes('tecnica') || item.toLowerCase().includes('electromedica'))
          ? 'TECNICA'
          : item
      );
      if (JSON.stringify(newAllS) !== JSON.stringify(allS)) {
        allS = Array.from(new Set(newAllS));
        modified = true;
      }
    }

    let sps = eq.supplierPrices;
    if (sps && Array.isArray(sps)) {
      const newSps = sps.map((p) => {
        if (p && p.supplier && (p.supplier.toLowerCase().includes('tecnica') || p.supplier.toLowerCase().includes('electromedica'))) {
          if (p.supplier !== 'TECNICA') {
            modified = true;
            return { ...p, supplier: 'TECNICA' };
          }
        }
        return p;
      });
      if (modified) sps = newSps;
    }

    if (modified) {
      return {
        ...eq,
        supplier: s,
        alternateSuppliers: alt,
        allSuppliers: allS,
        supplierPrices: sps,
      };
    }
    return eq;
  });
};

