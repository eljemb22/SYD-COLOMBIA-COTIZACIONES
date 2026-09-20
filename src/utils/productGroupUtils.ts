import { MedicalEquipment, ProductGroup } from '../types';

export const CORE_PRODUCT_GROUPS: ProductGroup[] = [
  'Equipos Médicos',
  'Instrumental Quirúrgico',
  'Muebles Hospitalarios',
];

export interface ProductGroupAuditItem {
  group: ProductGroup;
  label: string;
  icon: string; // 'equipment' | 'instrument' | 'furniture'
  color: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  count: number;
  isPresent: boolean;
  sampleItems: string[];
}

export interface ProductGroupsAuditResult {
  allExpectedGroups: ProductGroup[];
  presentGroups: ProductGroup[];
  missingGroups: ProductGroup[];
  groupCounts: Record<ProductGroup, number>;
  totalItems: number;
  isComplete: boolean;
  auditItems: ProductGroupAuditItem[];
  missingWarningMessage?: string;
}

/**
 * Intelligent classifier for product groups based on text analysis of name, category, model, brand and raw text.
 */
export function detectProductGroup(
  name: string = '',
  category: string = '',
  brand: string = '',
  model: string = '',
  rawGroupText: string = ''
): ProductGroup {
  const combined = `${rawGroupText} ${name} ${category} ${brand} ${model}`.toLowerCase();

  // 1. Direct match with raw group text if provided
  if (rawGroupText) {
    const rawLower = rawGroupText.toLowerCase().trim();
    if (
      rawLower.includes('instrumental') ||
      rawLower.includes('quirurgico') ||
      rawLower.includes('pinza') ||
      rawLower.includes('tijera') ||
      rawLower.includes('qx') ||
      rawLower.includes('instrument')
    ) {
      return 'Instrumental Quirúrgico';
    }
    if (
      rawLower.includes('mueble') ||
      rawLower.includes('mobiliario') ||
      rawLower.includes('cama') ||
      rawLower.includes('camilla') ||
      rawLower.includes('mesa') ||
      rawLower.includes('vitrina') ||
      rawLower.includes('carro') ||
      rawLower.includes('furniture')
    ) {
      return 'Muebles Hospitalarios';
    }
    if (
      rawLower.includes('equipo') ||
      rawLower.includes('biomedico') ||
      rawLower.includes('electromedico') ||
      rawLower.includes('device') ||
      rawLower.includes('monitor')
    ) {
      return 'Equipos Médicos';
    }
  }

  // 2. High-confidence Instrumental Quirúrgico keywords
  const surgicalKeywords = [
    'instrumental',
    'pinza',
    'pinzas',
    'tijera',
    'tijeras',
    'porta aguja',
    'porta-aguja',
    'portaaguja',
    'separador',
    'separadores',
    'mango de bisturi',
    'mango bisturi',
    'cureta',
    'curetaje',
    'valva',
    'valvas',
    'forceps',
    'fórceps',
    'retractor',
    'dilatador',
    'clamp',
    'clamps',
    'gubia',
    'cizalla',
    'osteotomo',
    'osteótomo',
    'periostotomo',
    'periostótomo',
    'sonda acanalada',
    'canula de yankauer',
    'cánula de yankauer',
    'especulo',
    'espéculo',
    'trocar',
    'trócar',
    'caja de instrumental',
    'set de instrumental',
    'set instrumental',
    'caja de cirugia',
    'caja de cesarea',
    'caja de parto',
    'caja de hernia',
    'caja de laparoscopia',
    'caja de traumatologia',
    'caja de ortopedia',
    'caja de osteosintesis',
    'gancho de nervio',
    'disector',
    'raspador',
    'raspa',
    'legra',
    'escalpelo',
    'microtijera',
    'micropinza',
    'bisturi quirurgico',
    'kocher',
    'kelly',
    'hemostatica',
    'metzenbaum',
    'mayo',
    'adson',
    'debakey',
    'allis',
    'babcock',
    'foerster',
    'backhaus',
    'weitlaner',
    'gelpi',
    'richardson',
    'deaver',
    'balfour',
    'gosset',
    'farabeuf',
    'mathieu',
    'castroviejo',
  ];

  for (const kw of surgicalKeywords) {
    // Check if the keyword exists as a word or substring
    if (combined.includes(kw)) {
      return 'Instrumental Quirúrgico';
    }
  }

  // 3. High-confidence Muebles Hospitalarios keywords
  const furnitureKeywords = [
    'cama hospitalaria',
    'cama clinica',
    'cama uci',
    'cama manual',
    'cama electrica',
    'cama de parto',
    'camilla de transporte',
    'camilla de traslado',
    'camilla ginecologica',
    'camilla de examen',
    'camilla de recuperacion',
    'camilla quirurgica',
    'camilla fowler',
    'mesa quirurgica',
    'mesa de cirugia',
    'mesa de operaciones',
    'mesa de mayo',
    'mesa pasteur',
    'mesa puente',
    'mesa de noche hospitalaria',
    'mesa de noche clinica',
    'mesa de alimentacion',
    'carro de paro',
    'carro de medicamentos',
    'carro de curaciones',
    'carro portahistorias',
    'carro de ropa limpia',
    'carro de ropa sucia',
    'vitrina de medicamentos',
    'vitrina hospitalaria',
    'escalerilla',
    'escalinata de 2 pasos',
    'escalinata de dos pasos',
    'atril portasuero',
    'atril porta-suero',
    'atril portasueros',
    'porta suero',
    'portasueros',
    'biombo hospitalario',
    'biombo de 2 cuerpos',
    'biombo de 3 cuerpos',
    'silla de ruedas',
    'silla de toma de muestras',
    'silla ginecologica',
    'sillon reclinable hospitalario',
    'sillon de hemodialisis',
    'sillon de quimioterapia',
    'taburete giratorio',
    'caneca hospitalaria',
    'soporte de historias',
    'armario hospitalario',
    'banca de vestier',
    'mesa de examinacion',
    'mueble hospitalario',
    'mobiliario hospitalario',
    'mobiliario clinico',
  ];

  for (const kw of furnitureKeywords) {
    if (combined.includes(kw)) {
      return 'Muebles Hospitalarios';
    }
  }

  // 4. Default to 'Equipos Médicos' for biomedical devices, monitors, generators, etc.
  return 'Equipos Médicos';
}

/**
 * Audits a collection of equipment items against the 3 required core product groups.
 * Detects which groups are present, which are MISSING (hacen falta), and provides
 * a formatted summary.
 */
export function auditProductGroups(
  items: { productGroup?: ProductGroup; name?: string; category?: string; brand?: string; model?: string }[]
): ProductGroupsAuditResult {
  const counts: Record<ProductGroup, number> = {
    'Equipos Médicos': 0,
    'Instrumental Quirúrgico': 0,
    'Muebles Hospitalarios': 0,
    'Dispositivos Médicos': 0,
    'Accesorios y Sensores': 0,
  };

  const sampleMap: Record<ProductGroup, string[]> = {
    'Equipos Médicos': [],
    'Instrumental Quirúrgico': [],
    'Muebles Hospitalarios': [],
    'Dispositivos Médicos': [],
    'Accesorios y Sensores': [],
  };

  items.forEach((item) => {
    const group: ProductGroup =
      item.productGroup ||
      detectProductGroup(item.name, item.category, item.brand, item.model);

    if (counts[group] !== undefined) {
      counts[group]++;
      if (item.name && sampleMap[group].length < 3 && !sampleMap[group].includes(item.name)) {
        sampleMap[group].push(item.name);
      }
    }
  });

  const presentGroups: ProductGroup[] = [];
  const missingGroups: ProductGroup[] = [];

  CORE_PRODUCT_GROUPS.forEach((group) => {
    if (counts[group] > 0) {
      presentGroups.push(group);
    } else {
      missingGroups.push(group);
    }
  });

  const isComplete = missingGroups.length === 0;

  let missingWarningMessage: string | undefined;
  if (!isComplete && items.length > 0) {
    if (missingGroups.length === 1) {
      missingWarningMessage = `Atención: El archivo o catálogo NO contiene productos del grupo "${missingGroups[0]}". Hacen falta registros de este tipo.`;
    } else if (missingGroups.length === 2) {
      missingWarningMessage = `Atención: Hacen falta productos de 2 grupos: "${missingGroups[0]}" y "${missingGroups[1]}".`;
    } else if (missingGroups.length === 3) {
      missingWarningMessage = `Atención: No se detectaron productos en ninguno de los 3 grupos principales.`;
    }
  }

  const metaMap: Record<
    ProductGroup,
    { label: string; icon: string; color: string; badgeBg: string; badgeBorder: string; badgeText: string }
  > = {
    'Equipos Médicos': {
      label: 'Equipos Médicos',
      icon: 'equipment',
      color: '#38bdf8',
      badgeBg: 'bg-sky-500/15',
      badgeBorder: 'border-sky-500/30',
      badgeText: 'text-sky-300',
    },
    'Instrumental Quirúrgico': {
      label: 'Instrumental Quirúrgico',
      icon: 'instrument',
      color: '#c084fc',
      badgeBg: 'bg-purple-500/15',
      badgeBorder: 'border-purple-500/30',
      badgeText: 'text-purple-300',
    },
    'Muebles Hospitalarios': {
      label: 'Muebles Hospitalarios',
      icon: 'furniture',
      color: '#34d399',
      badgeBg: 'bg-emerald-500/15',
      badgeBorder: 'border-emerald-500/30',
      badgeText: 'text-emerald-300',
    },
    'Dispositivos Médicos': {
      label: 'Dispositivos Médicos',
      icon: 'device',
      color: '#f59e0b',
      badgeBg: 'bg-amber-500/15',
      badgeBorder: 'border-amber-500/30',
      badgeText: 'text-amber-300',
    },
    'Accesorios y Sensores': {
      label: 'Accesorios y Sensores',
      icon: 'accessories',
      color: '#06b6d4',
      badgeBg: 'bg-cyan-500/15',
      badgeBorder: 'border-cyan-500/30',
      badgeText: 'text-cyan-300',
    },
  };

  const auditItems: ProductGroupAuditItem[] = CORE_PRODUCT_GROUPS.map((group) => {
    const meta = metaMap[group];
    const count = counts[group] || 0;
    return {
      group,
      label: meta.label,
      icon: meta.icon,
      color: meta.color,
      badgeBg: meta.badgeBg,
      badgeBorder: meta.badgeBorder,
      badgeText: meta.badgeText,
      count,
      isPresent: count > 0,
      sampleItems: sampleMap[group] || [],
    };
  });

  return {
    allExpectedGroups: CORE_PRODUCT_GROUPS,
    presentGroups,
    missingGroups,
    groupCounts: counts,
    totalItems: items.length,
    isComplete,
    auditItems,
    missingWarningMessage,
  };
}

/**
 * Returns color & visual styling for a product group badge
 */
export function getProductGroupBadgeStyle(group?: ProductGroup): {
  label: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  dotColor: string;
  badgeClass: string;
} {
  switch (group) {
    case 'Instrumental Quirúrgico':
      return {
        label: 'Instrumental Quirúrgico',
        bgClass: 'bg-purple-500/15',
        borderClass: 'border-purple-500/30',
        textClass: 'text-purple-300',
        dotColor: 'bg-purple-400',
        badgeClass: 'bg-purple-500/15 border-purple-500/40 text-purple-300',
      };
    case 'Muebles Hospitalarios':
      return {
        label: 'Muebles Hospitalarios',
        bgClass: 'bg-emerald-500/15',
        borderClass: 'border-emerald-500/30',
        textClass: 'text-emerald-300',
        dotColor: 'bg-emerald-400',
        badgeClass: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
      };
    case 'Dispositivos Médicos':
      return {
        label: 'Dispositivos Médicos',
        bgClass: 'bg-amber-500/15',
        borderClass: 'border-amber-500/30',
        textClass: 'text-amber-300',
        dotColor: 'bg-amber-400',
        badgeClass: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
      };
    case 'Equipos Médicos':
    default:
      return {
        label: 'Equipos Médicos',
        bgClass: 'bg-sky-500/15',
        borderClass: 'border-sky-500/30',
        textClass: 'text-sky-300',
        dotColor: 'bg-sky-400',
        badgeClass: 'bg-sky-500/15 border-sky-500/40 text-sky-300',
      };
  }
}
