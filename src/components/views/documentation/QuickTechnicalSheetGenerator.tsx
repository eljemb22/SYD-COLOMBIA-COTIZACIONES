import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  FileText,
  Sparkles,
  Download,
  Eye,
  Save,
  Printer,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  Edit3,
  RefreshCw,
  X,
  Layers,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Check,
  Building2,
  Trash2,
  Plus,
  Search,
  Globe,
  Loader2,
  Maximize2,
  Smartphone,
  Monitor,
  Clipboard,
  Lock,
  Lightbulb,
} from 'lucide-react';
import { MedicalEquipment, TechnicalDocument } from '../../../types';
import {
  TechnicalSheetData,
  getImprovisedTechnicalSheetData,
  generateTechnicalSheetPdf,
  exportTechnicalSheetPdf,
} from '../../../utils/technicalSheetPdfGenerator';
import { LiveTechnicalSheetPreview } from './LiveTechnicalSheetPreview';
import { isRateLimitError, notifyRateLimit } from '../../../utils/rateLimitHandler';

interface QuickTechnicalSheetGeneratorProps {
  equipments: MedicalEquipment[];
  onSaveToDocuments?: (newDoc: TechnicalDocument) => void;
  onNavigateToRepository?: () => void;
}

// Límites de caracteres calibrados para ajuste perfecto en 2 páginas oficiales de PDF sin desbordes
export const SHEET_FIELD_LIMITS = {
  productName: 100,
  brand: 45,
  model: 40,
  description: 800, // Ampliado conforme a solicitud
  mainFunction: 500, // Ampliado conforme a solicitud
  characteristics: 1600, // Ampliado de 650 a 1600 caracteres para permitir todas las especificaciones y viñetas
  material: 450, // Ampliado de 240 a 450 caracteres
  invima: 90, // Ampliado de 60 a 90 caracteres
  area: 140, // Ampliado de 90 a 140 caracteres
  sterilization: 500, // Ampliado de 260 a 500 caracteres
  storage: 500, // Ampliado de 260 a 500 caracteres
  warranty: 250, // Ampliado de 150 a 250 caracteres
  tableCode: 40,
  tableDimension: 90,
};

export interface SuggestionOption {
  label: string;
  text: string;
  badge?: string;
}

export const BIOMEDICAL_STANDARD_SUGGESTIONS: Record<string, SuggestionOption[]> = {
  material: [
    {
      label: 'Acero Quirúrgico Martensítico Alemán (Instrumental Cortante)',
      text: 'Fabricado en Acero Inoxidable Martensítico Alemán (AISI 420 / DIN 1.4021) templado al vacío para máxima dureza y retención prolongada del filo.',
      badge: 'Tijeras / Bisturís',
    },
    {
      label: 'Acero Inoxidable Austenítico Quirúrgico AISI 304 / 316L (Prensión y General)',
      text: 'Acero Inoxidable Quirúrgico AISI 304 / 316L de alta resistencia a la corrosión con acabado satinado antirreflejo.',
      badge: 'Pinzas / Separadores',
    },
    {
      label: 'Polímero ABS Médico Ignífugo y Chasis Metálico (Equipos Electromédicos)',
      text: 'Carcasa en polímero ABS de grado médico ignífugo de alto impacto con blindaje electromagnético interno y grado de protección IP21.',
      badge: 'Monitores / Bombas',
    },
    {
      label: 'Estructura Tubular con Pintura Electrostática Epoxi (Mobiliario Hospitalario)',
      text: 'Estructura en tubería de acero estructural SAE 1020 calibre 16/18 con recubrimiento en pintura electrostática epoxi-poliéster horneada a 200°C.',
      badge: 'Mobiliario / Camillas',
    },
    {
      label: 'Aleación de Titanio Grado 5 (Implantes y Microcirugía)',
      text: 'Aleación de Titanio Grado 5 (Ti-6Al-4V ELI) biocompatible según norma ASTM F136, ferromagnéticamente inerte compatible con RM.',
      badge: 'Microcirugía',
    },
    {
      label: 'Silicona Médica Grado Platino Autoclavable (Accesorios y Tubuladuras)',
      text: 'Silicona translúcida 100% grado médico biocompatible curada al platino, libre de látex y plastificantes, resistente a autoclave continuo.',
      badge: 'Accesorios',
    },
  ],
  sterilization: [
    {
      label: 'Autoclave a Vapor Saturado 134°C (Instrumental Quirúrgico Reutilizable)',
      text: 'Suministrado NO ESTÉRIL. Lavado manual o ultrasónico con detergente enzimático neutro, enjuague con agua desmineralizada y esterilización en autoclave a vapor a 134°C por 5 a 18 minutos.',
      badge: 'Instrumental',
    },
    {
      label: 'Calor Húmedo Estándar Hospitalario (121°C por 20 min / 134°C por 7 min)',
      text: 'Esterilización por calor húmedo en autoclave a 121°C durante 20 minutos o a 134°C durante 7 minutos con ciclo de secado al vacío.',
      badge: 'Metálico / Vidrio',
    },
    {
      label: 'Baja Temperatura: Óxido de Etileno (OE) o Plasma H2O2 (Termosensibles)',
      text: 'Esterilización a baja temperatura mediante Óxido de Etileno (OE) o Sistema de Plasma de Peróxido de Hidrógeno (H2O2) para componentes termosensibles.',
      badge: 'Fibra Óptica / Sensores',
    },
    {
      label: 'Limpieza y Desinfección Nivel Intermedio (Equipos Electromédicos y Muebles)',
      text: 'Limpieza de superficies y cables con paño suave humedecido en solución de amonio cuaternario de quinta generación o alcohol al 70%. No sumergir.',
      badge: 'Equipos / Mobiliario',
    },
    {
      label: 'Dispositivo Estéril de Un Solo Uso (Insumos Médicos Descartables)',
      text: 'Dispositivo médico estéril de un solo uso (Single Use Only) esterilizado por rayos gamma u óxido de etileno. Prohibida su reutilización o reesterilización.',
      badge: 'Descartables',
    },
  ],
  storage: [
    {
      label: 'Central de Esterilización y Bodega Quirúrgica (Ambiente Controlado)',
      text: 'Almacenar en lugar limpio, fresco y seco (temperatura 15°C a 25°C, humedad relativa < 65%), en estanterías sanitarias elevadas a mínimo 20 cm del suelo.',
      badge: 'Quirúrgico',
    },
    {
      label: 'Protección en Empaque Primario o Contenedor Rígido',
      text: 'Conservar en su empaque original sellado o dentro de contenedores quirúrgicos rígidos protegidos contra caídas, humedad y partículas de polvo.',
      badge: 'Bodega Central',
    },
    {
      label: 'Condiciones Hospitalarias para Equipos Biomédicos',
      text: 'Almacenar en recinto cubierto con temperatura controlada (10°C a 30°C), protegido de fuentes de calor directo, campos magnéticos y humedad sin condensación.',
      badge: 'Equipos',
    },
    {
      label: 'Insumos Médicos y Material Estéril',
      text: 'Conservar en bodega con temperatura de 15°C a 30°C y humedad de 30% a 65%, en empaque primario intacto, protegido de radiación UV y contaminantes.',
      badge: 'Farmacia / Almacén',
    },
  ],
  invima: [
    {
      label: 'Formato Registro Sanitario INVIMA 2024 (Instrumental y Dispositivos)',
      text: '2024DM-0029361',
      badge: 'Vigente',
    },
    {
      label: 'Dispositivo Médico Regulado Decreto 4725 de 2005',
      text: 'INVIMA 2021DM-0021945',
      badge: 'Clase I / IIa',
    },
    {
      label: 'No Requiere Registro Sanitario (Mobiliario Hospitalario no invasivo)',
      text: 'NO REQUIERE REGISTRO SANITARIO INVIMA (Decreto 4725 de 2005 / Mobiliario)',
      badge: 'Mobiliario',
    },
  ],
  area: [
    {
      label: 'Central de Esterilización y Quirófano',
      text: 'CENTRAL DE ESTERILIZACIÓN Y QUIRÓFANO',
      badge: 'Quirúrgico',
    },
    {
      label: 'Unidad de Cuidados Intensivos (UCI) y Urgencias',
      text: 'UNIDAD DE CUIDADOS INTENSIVOS (UCI) Y URGENCIAS',
      badge: 'Críticos',
    },
    {
      label: 'Hospitalización y Consulta Externa',
      text: 'HOSPITALIZACIÓN, CIRUGÍA Y CONSULTA EXTERNA',
      badge: 'General',
    },
  ],
  warranty: [
    {
      label: '5 Años — Acero Quirúrgico e Instrumental',
      text: '5 años contra defectos de fabricación en acero quirúrgico.',
      badge: 'Instrumental',
    },
    {
      label: '3 Años — Garantía Estructural Mobiliario Hospitalario',
      text: '3 años de garantía estructural por defectos de fabricación.',
      badge: 'Mobiliario',
    },
    {
      label: '2 Años — Equipos Biomédicos con Soporte y Repuestos',
      text: '2 años de garantía total del equipo con soporte técnico oficial, disponibilidad de repuestos y calibración anual.',
      badge: 'Equipos',
    },
    {
      label: '1 Año — Garantía Estándar de Fábrica',
      text: '1 año de garantía contra defectos de fabricación.',
      badge: 'Estándar',
    },
  ],
};

export interface MeasurementPresetItem {
  code: string;
  dimension: string;
}

export interface MeasurementPresetGroup {
  id: string;
  category: string;
  shortLabel: string;
  badge: string;
  items: MeasurementPresetItem[];
}

export const BIOMEDICAL_MEASUREMENT_PRESETS: MeasurementPresetGroup[] = [
  {
    id: 'scissors',
    category: 'Tijeras Quirúrgicas (Metzenbaum / Mayo / Iris)',
    shortLabel: '✂️ Tijeras',
    badge: 'Corte y Disección',
    items: [
      { code: '11.5 cm (Curva / Recta)', dimension: 'Microcirugía, disección fina oftálmica y plástica' },
      { code: '14.5 cm (Curva)', dimension: 'Disección tisular delicada en planos superficiales y medios' },
      { code: '17.0 cm (Curva)', dimension: 'Disección de planos fasciales y tejidos blandos intermedios' },
      { code: '18.0 cm (Recta)', dimension: 'Corte de suturas, gasas, apósitos y tejidos duros' },
      { code: '20.0 cm (Curva)', dimension: 'Disección quirúrgica en cavidad profunda' },
      { code: '23.0 cm (Curva)', dimension: 'Cirugía torácica y abdominal profunda' },
    ],
  },
  {
    id: 'forceps_hemo',
    category: 'Pinzas Hemostáticas (Kelly / Crile / Halsted Mosquito)',
    shortLabel: '🗜️ Pinzas Hemostáticas',
    badge: 'Hemostasia',
    items: [
      { code: '12.5 cm (Curva)', dimension: 'Hemostasia delicada de vasos pequeños y capilares en pediatría' },
      { code: '14.0 cm (Curva)', dimension: 'Hemostasia general y clampeo de vasos de mediano calibre' },
      { code: '14.0 cm (Recta)', dimension: 'Prensión firme de tejidos resistentes, gasas y tracción' },
      { code: '16.0 cm (Curva)', dimension: 'Control vascular en planos tisulares medios y musculares' },
      { code: '18.5 cm (Curva)', dimension: 'Hemostasia en planos profundos y cavidad pélvica' },
      { code: '20.0 cm (Curva)', dimension: 'Prensión vascular robusta en cirugía abdominal / ginecológica' },
    ],
  },
  {
    id: 'forceps_dissec',
    category: 'Pinzas de Disección (Adson / Estándar / Tisulares)',
    shortLabel: '🔬 Pinzas Disección',
    badge: 'Prensión Atraumática',
    items: [
      { code: '12.0 cm (Sin Garra)', dimension: 'Manipulación atraumática de tejidos friables y vasos' },
      { code: '12.0 cm con Garra (1x2)', dimension: 'Prensión firme de piel, fascias y planos aponeuróticos' },
      { code: '14.5 cm con Garra (1x2)', dimension: 'Tracción de bordes de herida durante síntesis quirúrgica' },
      { code: '16.0 cm (Sin Garra)', dimension: 'Afrontamiento de tejidos en cirugía general' },
      { code: '20.0 cm (Sin Garra)', dimension: 'Disección profunda en cavidades corporales' },
    ],
  },
  {
    id: 'retractors',
    category: 'Separadores y Valvas Quirúrgicas (Farabeuf / Deaver / Richardson)',
    shortLabel: '📐 Separadores / Valvas',
    badge: 'Retracción Quirúrgica',
    items: [
      { code: '120 x 12 mm (Farabeuf)', dimension: 'Separación y tracción de tejidos en planos superficiales' },
      { code: '150 x 15 mm (Farabeuf)', dimension: 'Retracción de bordes musculares en planos intermedios' },
      { code: '215 x 25 mm (Deaver)', dimension: 'Retracción de vísceras y pared en cavidad abdominal' },
      { code: '240 x 38 mm (Richardson)', dimension: 'Separación profunda en laparotomía y cirugía pélvica' },
      { code: '300 x 50 mm (Valva Maleable)', dimension: 'Retracción adaptable de órganos abdominales' },
    ],
  },
  {
    id: 'scalpels',
    category: 'Mangos de Bisturí y Cuchillas Quirúrgicas',
    shortLabel: '🔪 Mangos Bisturí',
    badge: 'Incisión Quirúrgica',
    items: [
      { code: 'Mango No. 3 (12.5 cm)', dimension: 'Para hojas de bisturí No. 10, 11, 12 y 15 (Cirugía fina / menor)' },
      { code: 'Mango No. 4 (13.5 cm)', dimension: 'Para hojas de bisturí No. 20, 21, 22, 23 y 24 (Cirugía mayor)' },
      { code: 'Mango No. 7 (16.0 cm)', dimension: 'Mango estilizado para incisiones precisas en cavidad profunda' },
    ],
  },
  {
    id: 'trays_boxes',
    category: 'Bandejas, Cajas y Contenedores de Instrumental',
    shortLabel: '📦 Bandejas & Cajas',
    badge: 'Esterilización y Asepsia',
    items: [
      { code: '20 x 10 x 4 cm', dimension: 'Bandeja pequeña para instrumental de curación y sutura' },
      { code: '30 x 20 x 5 cm', dimension: 'Bandeja mediana para procedimientos y cirugía menor' },
      { code: '35 x 25 x 2 cm', dimension: 'Bandeja para mesa de mayo y sets básicos de quirófano' },
      { code: '40 x 30 x 5 cm', dimension: 'Bandeja amplia para sets completos de cirugía general' },
      { code: '285 x 280 x 135 mm', dimension: 'Contenedor de esterilización con filtro 1/2 DIN' },
      { code: '580 x 280 x 150 mm', dimension: 'Contenedor de esterilización 1/1 DIN para set de instrumental' },
    ],
  },
  {
    id: 'furniture',
    category: 'Mobiliario Clínico y Equipos Hospitalarios',
    shortLabel: '🏥 Mobiliario Clínico',
    badge: 'Hospitalario',
    items: [
      { code: '60 x 40 x 85 cm', dimension: 'Mesa de mayo rodante en acero inoxidable con bandeja desmontable' },
      { code: '75 x 45 x 85 cm', dimension: 'Mesa de curaciones con barandilla perimetral y dos planos' },
      { code: '190 x 60 x 80 cm', dimension: 'Camilla de examinación con colchoneta lavable y cabecero reclinable' },
      { code: '218 x 102 x 50-80 cm', dimension: 'Cama hospitalaria eléctrica con posiciones Fowler y Trendelenburg' },
      { code: '45 x 45 x 90 cm', dimension: 'Atril portasuero en acero inoxidable con 4 ganchos y base rodable' },
    ],
  },
];

export interface ContextualMeasurementItem {
  code: string;
  dimension: string;
  category: 'detected' | 'variant' | 'range' | 'preset';
  badge: string;
  isExact?: boolean;
}

/**
 * Intelligent extraction and scale expansion of surgical and clinical measurements.
 * Inspects product name, model, description, characteristics, and current rows.
 * If a measurement is detected (e.g., 30 cm, 14.5 cm), generates exact variants (Recta, Curva, con garra)
 * and complementary scale neighbors (e.g. 24 cm, 26 cm, 28 cm, 32 cm, 35 cm, 40 cm).
 */
export function generateContextualMeasurementSuggestions(params: {
  productName?: string;
  model?: string;
  description?: string;
  characteristics?: string[] | string;
  currentRows?: Array<{ code: string; dimension: string }>;
  aiSuggestions?: Array<{ code: string; dimension: string }>;
  baseTable?: Array<{ code: string; dimension: string }>;
}): ContextualMeasurementItem[] {
  const {
    productName = '',
    model = '',
    description = '',
    characteristics = '',
    currentRows = [],
    aiSuggestions = [],
    baseTable = [],
  } = params;

  const charsText = Array.isArray(characteristics) ? characteristics.join(' ') : characteristics;

  const textToScan = [
    model,
    productName,
    description,
    charsText,
    ...currentRows.map((r) => `${r.code} ${r.dimension}`),
  ]
    .filter(Boolean)
    .join(' ');

  const textLower = textToScan.toLowerCase();

  // Determine instrument family
  const isScissor = /tijera|scissor|mayo|metzenbaum|iris|lister|potts|corte/i.test(textLower);
  const isClamp = /pinza|clamp|hemost[aá]t|babcock|kelly|crile|kocher|allis|foerster|duval|rochester|mosquito|halsted/i.test(textLower);
  const isDissection = /disecci[oó]n|dissec|adson|garra|diente/i.test(textLower);
  const isRetractor = /separador|valva|retractor|farabeuf|deaver|richardson|senn|balfour|volkmann/i.test(textLower);
  const isNeedleHolder = /porta[\s-]?aguja|needle[\s-]?holder|mayo-hegar|mathieu|castroviejo/i.test(textLower);
  const isTray = /bandeja|caja|contenedor|cesta|charola/i.test(textLower);
  const isFurniture = /camilla|cama|mesa|atril|vitrina|escalerilla/i.test(textLower);

  const results: ContextualMeasurementItem[] = [];
  const seenCodes = new Set<string>();

  const addResult = (item: ContextualMeasurementItem) => {
    const cleanCode = item.code.trim();
    if (!cleanCode) return;
    const norm = cleanCode.toLowerCase();
    if (seenCodes.has(norm)) return;
    seenCodes.add(norm);
    results.push({
      ...item,
      code: cleanCode.slice(0, SHEET_FIELD_LIMITS.tableCode),
      dimension: item.dimension.trim().slice(0, SHEET_FIELD_LIMITS.tableDimension),
    });
  };

  // 1. Detect numbers associated with cm, mm, inches, or standalone in model/rows
  const detectedLengths: number[] = [];

  // Match: e.g. "30 cm", "14.5 cm", "18 cms", "14,5 cm"
  const cmMatches = textToScan.matchAll(/(?:^|[^\d.,])(\d+(?:[.,]\d+)?)\s*(?:cm|cms|cent[ií]metros?)\b/gi);
  for (const m of cmMatches) {
    const val = parseFloat(m[1].replace(',', '.'));
    if (!isNaN(val) && val >= 3 && val <= 250 && !detectedLengths.includes(val)) {
      detectedLengths.push(val);
    }
  }

  // Match: e.g. "300 mm", "140 mm", "250 mm" -> convert to cm
  const mmMatches = textToScan.matchAll(/(?:^|[^\d.,])(\d+(?:[.,]\d+)?)\s*(?:mm|mil[ií]metros?)\b/gi);
  for (const m of mmMatches) {
    const val = parseFloat(m[1].replace(',', '.'));
    if (!isNaN(val) && val >= 40 && val <= 2500) {
      const cmVal = Math.round((val / 10) * 10) / 10;
      if (!detectedLengths.includes(cmVal)) {
        detectedLengths.push(cmVal);
      }
    }
  }

  // Check model specifically for standalone dimension (e.g. "30", "14.5", "REF-30", "M30")
  if (model.trim()) {
    const modelNumMatch = model.match(/(?:^|[^\d.,])(\d+(?:[.,]\d+)?)(?:\s*cm|\s*mm)?(?:\s|$|[^\d.,])/i);
    if (modelNumMatch) {
      let val = parseFloat(modelNumMatch[1].replace(',', '.'));
      if (!isNaN(val)) {
        if (val >= 40 && val <= 2500 && !model.toLowerCase().includes('cm')) {
          val = Math.round((val / 10) * 10) / 10;
        }
        if (val >= 4 && val <= 250 && !detectedLengths.includes(val)) {
          detectedLengths.unshift(val);
        }
      }
    }
  }

  // Check current rows in table (e.g., user wrote "30 cm")
  for (const r of currentRows) {
    const rowMatch = r.code.match(/(\d+(?:[.,]\d+)?)\s*(?:cm)?/i);
    if (rowMatch) {
      const val = parseFloat(rowMatch[1].replace(',', '.'));
      if (!isNaN(val) && val >= 4 && val <= 250 && !detectedLengths.includes(val)) {
        detectedLengths.push(val);
      }
    }
  }

  // 2. Generate variations and ranges for each detected length
  if (detectedLengths.length > 0) {
    detectedLengths.forEach((len) => {
      const lenStr = len.toString();

      // A) Exact variations of this detected length
      let rectaDesc = `Longitud: ${lenStr} cm, diseño recto para abordaje directo`;
      if (isScissor) rectaDesc = `Longitud: ${lenStr} cm, hojas rectas para corte de suturas y tejidos superficiales`;
      else if (isClamp) rectaDesc = `Longitud: ${lenStr} cm, mandíbula recta para prensión y oclusión en abordaje directo`;
      else if (isDissection) rectaDesc = `Longitud: ${lenStr} cm, ramas rectas para disección y afrontamiento tisular`;
      else if (isNeedleHolder) rectaDesc = `Longitud: ${lenStr} cm, ramas rectas con bocas de tungsteno para sutura`;

      addResult({
        code: `${lenStr} cm (Recta)`,
        dimension: rectaDesc,
        category: 'detected',
        badge: `🎯 Detectado (${lenStr} cm)`,
        isExact: true,
      });

      let curvaDesc = `Longitud: ${lenStr} cm, curvatura anatómica para visibilidad en planos anatómicos`;
      if (isScissor) curvaDesc = `Longitud: ${lenStr} cm, hojas curvas para disección tisular delicada y visibilidad`;
      else if (isClamp) curvaDesc = `Longitud: ${lenStr} cm, mandíbula curva para oclusión vascular y planos anatómicos`;
      else if (isDissection) curvaDesc = `Longitud: ${lenStr} cm, ramas curvas para disección en cavidad`;
      else if (isNeedleHolder) curvaDesc = `Longitud: ${lenStr} cm, ramas curvas para sutura en planos profundos`;

      addResult({
        code: `${lenStr} cm (Curva)`,
        dimension: curvaDesc,
        category: 'detected',
        badge: `🎯 Detectado (${lenStr} cm)`,
        isExact: true,
      });

      // Con Garra / Sin Garra
      if (isClamp || isDissection || (!isScissor && !isRetractor)) {
        addResult({
          code: `${lenStr} cm con Garra (1x2)`,
          dimension: `Longitud: ${lenStr} cm, dientes 1x2 para tracción y sujeción firme de fascias y tejidos resistentes`,
          category: 'variant',
          badge: 'Con Dientes 1x2',
        });
        addResult({
          code: `${lenStr} cm Sin Garra (Atraumática)`,
          dimension: `Longitud: ${lenStr} cm, mandíbulas atraumáticas para manipulación delicada de vísceras y tejidos`,
          category: 'variant',
          badge: 'Atraumática',
        });
      }

      // Si es tijera, puntas romas vs agudas
      if (isScissor) {
        addResult({
          code: `${lenStr} cm (Punta Roma)`,
          dimension: `Longitud: ${lenStr} cm, puntas romas de seguridad para disección atraumática sin perforación`,
          category: 'variant',
          badge: 'Punta Roma',
        });
        addResult({
          code: `${lenStr} cm (Punta Aguda)`,
          dimension: `Longitud: ${lenStr} cm, corte de precisión y disección fina`,
          category: 'variant',
          badge: 'Punta Aguda',
        });
      }

      // B) EXPAND RANGE ("le agregues más")
      let neighborScale: number[] = [];
      if (len >= 24) {
        neighborScale = [20, 24, 26, 28, 30, 32, 35, 40].filter((n) => n !== len);
      } else if (len >= 17) {
        neighborScale = [14, 16, 18, 20, 22, 24, 26].filter((n) => n !== len);
      } else if (len >= 12) {
        neighborScale = [10, 11.5, 12.5, 14, 14.5, 16, 18, 20].filter((n) => n !== len);
      } else {
        neighborScale = [8, 9, 10, 11.5, 12.5, 14].filter((n) => n !== len);
      }

      neighborScale.forEach((n) => {
        let nDesc = `Longitud: ${n} cm para procedimientos quirúrgicos`;
        if (n <= 12) {
          nDesc = `Longitud: ${n} cm, microcirugía, oftalmología y planos muy superficiales`;
        } else if (n <= 15) {
          nDesc = `Longitud: ${n} cm, cirugía menor, disección delicada y planos superficiales`;
        } else if (n <= 19) {
          nDesc = `Longitud: ${n} cm, estándar para cirugía general y planos anatómicos medios`;
        } else if (n <= 24) {
          nDesc = `Longitud: ${n} cm, abordaje en cavidades torácicas y abdominales intermedias`;
        } else if (n <= 28) {
          nDesc = `Longitud: ${n} cm, cirugía abdominal profunda, urológica y ginecológica`;
        } else if (n <= 33) {
          nDesc = `Longitud: ${n} cm, procedimientos en cavidad pélvica profunda y ginecología oncológica`;
        } else {
          nDesc = `Longitud: ${n} cm, abordaje quirúrgico ultra-profundo y cirugía bariátrica`;
        }

        addResult({
          code: `${n} cm (Curva)`,
          dimension: nDesc,
          category: 'range',
          badge: `📏 Rango (${n} cm)`,
        });
      });
    });
  }

  // 3. Detect 2D / 3D dimensions (e.g., "35x25 cm")
  const dim2dMatches = textToScan.matchAll(/(?:^|[^\d.,])(\d+(?:[.,]\d+)?)\s*(?:x|×)\s*(\d+(?:[.,]\d+)?)(?:\s*(?:x|×)\s*(\d+(?:[.,]\d+)?))?\s*(?:cm|mm)?\b/gi);
  for (const d of dim2dMatches) {
    const d1 = d[1];
    const d2 = d[2];
    const d3 = d[3];
    const unit = textLower.includes('mm') && !textLower.includes('cm') ? 'mm' : 'cm';
    const baseCode = d3 ? `${d1} x ${d2} x ${d3} ${unit}` : `${d1} x ${d2} ${unit}`;

    addResult({
      code: baseCode,
      dimension: `Dimensiones detectadas: ${baseCode} para uso hospitalario`,
      category: 'detected',
      badge: '🎯 Dimensiones Detectadas',
      isExact: true,
    });

    if (isTray) {
      addResult({ code: `25 x 15 x 3 ${unit}`, dimension: `Bandeja formato pequeño para instrumental menor`, category: 'range', badge: '📏 Formato Pequeño' });
      addResult({ code: `30 x 20 x 4 ${unit}`, dimension: `Bandeja formato mediano para cirugía ambulatoria`, category: 'range', badge: '📏 Formato Mediano' });
      addResult({ code: `35 x 25 x 5 ${unit}`, dimension: `Bandeja formato estándar para mesa de mayo y sets básicos`, category: 'range', badge: '📏 Formato Estándar' });
      addResult({ code: `40 x 30 x 5 ${unit}`, dimension: `Bandeja formato amplio para sets de cirugía general`, category: 'range', badge: '📏 Formato Amplio' });
    } else if (isRetractor) {
      addResult({ code: `120 x 12 mm`, dimension: `Separador Farabeuf para planos superficiales y celular subcutáneo`, category: 'range', badge: '📏 Rango Farabeuf' });
      addResult({ code: `150 x 15 mm`, dimension: `Separador Farabeuf para planos musculares e incisión media`, category: 'range', badge: '📏 Rango Farabeuf' });
      addResult({ code: `180 x 20 mm`, dimension: `Separador Farabeuf para planos anatómicos profundos`, category: 'range', badge: '📏 Rango Farabeuf' });
    }
  }

  // 4. Merge AI Suggestions
  aiSuggestions.forEach((s) => {
    addResult({
      code: s.code,
      dimension: s.dimension,
      category: 'detected',
      badge: '✨ Sugerencia IA',
    });
  });

  // 5. Merge Base Table Suggestions
  baseTable.forEach((s) => {
    addResult({
      code: s.code,
      dimension: s.dimension,
      category: 'preset',
      badge: '📋 Catálogo',
    });
  });

  // 6. If still fewer than 5 items, pull from matching presets
  if (results.length < 5) {
    let fallbackPresetId = 'forceps_hemo';
    if (isScissor) fallbackPresetId = 'scissors';
    else if (isDissection) fallbackPresetId = 'forceps_dissec';
    else if (isRetractor) fallbackPresetId = 'retractors';
    else if (isTray) fallbackPresetId = 'trays_boxes';
    else if (isFurniture) fallbackPresetId = 'furniture';

    const group = BIOMEDICAL_MEASUREMENT_PRESETS.find((g) => g.id === fallbackPresetId) || BIOMEDICAL_MEASUREMENT_PRESETS[0];
    group.items.forEach((it) => {
      addResult({
        code: it.code,
        dimension: it.dimension,
        category: 'preset',
        badge: group.shortLabel,
      });
    });
  }

  return results;
}

const CharCounter: React.FC<{ current: number; max: number; className?: string }> = ({
  current,
  max,
  className = '',
}) => {
  const isNear = current >= max * 0.9 && current < max;
  const isAtLimit = current >= max;

  return (
    <span
      className={`text-[10px] font-mono tracking-tight transition-colors ${
        isAtLimit
          ? 'text-rose-400 font-bold bg-rose-950/70 px-1.5 py-0.5 rounded border border-rose-800/60'
          : isNear
          ? 'text-amber-400 font-semibold'
          : 'text-slate-400'
      } ${className}`}
      title={`Límite de ${max} caracteres para evitar desbordes en el PDF`}
    >
      {current}/{max}
      {isAtLimit ? ' • Límite' : ''}
    </span>
  );
};

export const QuickTechnicalSheetGenerator: React.FC<QuickTechnicalSheetGeneratorProps> = ({
  equipments,
  onSaveToDocuments,
  onNavigateToRepository,
}) => {
  // Core user inputs - initialized in BLANK per user request
  const [productName, setProductName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');

  // Branding & Watermark customization (Vendor-neutral / White-label)
  const [companyName, setCompanyName] = useState<string>('');
  const [headerSubtitle, setHeaderSubtitle] = useState<string>('');
  const [headerCertification, setHeaderCertification] = useState<string>('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState<string>('');
  const [showWatermark, setShowWatermark] = useState<boolean>(true);
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.07);
  const [showLogoInHeader, setShowLogoInHeader] = useState<boolean>(true);
  const [focusedUploadTarget, setFocusedUploadTarget] = useState<'photo' | 'logo'>('photo');
  const focusedUploadTargetRef = useRef<'photo' | 'logo'>('photo');

  const setUploadTarget = (target: 'photo' | 'logo') => {
    focusedUploadTargetRef.current = target;
    setFocusedUploadTarget(target);
  };

  // Selected equipment from catalog (optional shortcut)
  const [selectedCatalogEquipmentId, setSelectedCatalogEquipmentId] = useState<string>('');

  // AI Research States
  const [isSearchingAi, setIsSearchingAi] = useState(false);
  const [aiSource, setAiSource] = useState<string | null>(null);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  // Internet Product Image Search States
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [isImageSearchModalOpen, setIsImageSearchModalOpen] = useState(false);
  const [imageSearchResults, setImageSearchResults] = useState<
    Array<{
      title: string;
      url: string;
      thumbnail: string;
      width?: number;
      height?: number;
      source?: string;
    }>
  >([]);
  const [imageSearchQuery, setImageSearchQuery] = useState('');
  const [isProxyingImage, setIsProxyingImage] = useState<string | null>(null);

  // Technical Specs States (AI populated / user editable) - Starts in BLANK
  const [customDescription, setCustomDescription] = useState('');
  const [customFunction, setCustomFunction] = useState('');
  const [customCharacteristics, setCustomCharacteristics] = useState<string>('');
  const [customMaterial, setCustomMaterial] = useState('');
  const [customInvima, setCustomInvima] = useState('');
  const [customArea, setCustomArea] = useState('');
  const [customSterilization, setCustomSterilization] = useState('');
  const [customStorage, setCustomStorage] = useState('');
  const [customWarranty, setCustomWarranty] = useState('');

  // Table of Reference Variants
  const [referenceRows, setReferenceRows] = useState<Array<{ code: string; dimension: string }>>([]);

  // View switch for mobile/narrow screens: 'editor' | 'preview' | 'split'
  const [mobileTab, setMobileTab] = useState<'editor' | 'preview'>('editor');

  // Accordions
  const [isSpecsAccordionOpen, setIsSpecsAccordionOpen] = useState(true);
  const [isBrandingAccordionOpen, setIsBrandingAccordionOpen] = useState(true);

  // Feedback notifications
  const [savedSuccessMessage, setSavedSuccessMessage] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Fullscreen Preview Modal
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Auto-improvised base data
  const baseData = useMemo(() => {
    return getImprovisedTechnicalSheetData(productName, brand, model, imagePreviewUrl || undefined);
  }, [productName, brand, model, imagePreviewUrl]);

  // Combined full data ready for live preview and PDF generation
  const finalSheetData = useMemo<TechnicalSheetData>(() => {
    const charList = customCharacteristics
      .split('\n')
      .map((c) => c.replace(/^•\s*/, '').trim())
      .filter((c) => c.length > 0);

    return {
      ...baseData,
      companyName: companyName.trim() || undefined,
      headerSubtitle: headerSubtitle.trim() || undefined,
      headerCertification: headerCertification.trim() || undefined,
      companyLogoUrl: companyLogoUrl || undefined,
      showWatermark,
      watermarkOpacity,
      showLogoInHeader,
      productName: productName.trim() || 'PRODUCTO MÉDICO',
      brand: brand.trim() || '',
      model: model.trim() || '',
      description: customDescription.trim() || baseData.description,
      mainFunction: customFunction.trim() || baseData.mainFunction,
      characteristics: charList.length > 0 ? charList : baseData.characteristics,
      fabricationMaterial: customMaterial.trim() || baseData.fabricationMaterial,
      invimaRegistration: customInvima.trim() || baseData.invimaRegistration,
      areaDepartment: customArea.trim() || baseData.areaDepartment,
      sterilization: customSterilization.trim() || baseData.sterilization,
      storageConditions: customStorage.trim() ? [customStorage.trim()] : baseData.storageConditions,
      warranty: customWarranty.trim() || baseData.warranty,
      referenceTable: referenceRows.length > 0 ? referenceRows : baseData.referenceTable,
      productImageBase64: imagePreviewUrl || undefined,
    };
  }, [
    baseData,
    companyName,
    headerSubtitle,
    headerCertification,
    companyLogoUrl,
    showWatermark,
    watermarkOpacity,
    showLogoInHeader,
    productName,
    brand,
    model,
    customDescription,
    customFunction,
    customCharacteristics,
    customMaterial,
    customInvima,
    customArea,
    customSterilization,
    customStorage,
    customWarranty,
    referenceRows,
    imagePreviewUrl,
  ]);

  // Suggestions states for manual/fixed fields (material, sterilization, storage, invima, area, warranty)
  const [aiFieldSuggestions, setAiFieldSuggestions] = useState<{
    material?: string;
    sterilization?: string;
    storage?: string;
    invima?: string;
    area?: string;
    warranty?: string;
  }>({});
  const [openSuggestionsField, setOpenSuggestionsField] = useState<string | null>(null);
  const [customDraftSuggestion, setCustomDraftSuggestion] = useState('');

  // Effective suggestions: combines AI search suggestions with smart domain fallback
  const effectiveSuggestions = useMemo(() => {
    const defaultStorageStr = Array.isArray(baseData.storageConditions)
      ? baseData.storageConditions.join('. ')
      : 'Almacenar en lugar limpio, fresco y seco (15°C a 25°C), humedad relativa < 65%, protegido de la luz solar directa y el polvo.';

    return {
      material: aiFieldSuggestions.material || baseData.fabricationMaterial || 'Acero Inoxidable de grado quirúrgico AISI 420 / 316L certificado conforme a directivas sanitarias aplicables.',
      sterilization: aiFieldSuggestions.sterilization || baseData.sterilization || 'Suministrado NO ESTÉRIL. Lavado enzimático neutro y esterilización en autoclave a vapor a 134°C por 5 a 18 minutos.',
      storage: aiFieldSuggestions.storage || defaultStorageStr,
      invima: aiFieldSuggestions.invima || baseData.invimaRegistration || '2024DM-0029361',
      area: aiFieldSuggestions.area || baseData.areaDepartment || 'CENTRAL DE ESTERILIZACIÓN Y QUIRÓFANO',
      warranty: aiFieldSuggestions.warranty || baseData.warranty || '5 años contra defectos de fabricación en acero quirúrgico.',
    };
  }, [aiFieldSuggestions, baseData]);

  const handleApplySingleSuggestion = (
    fieldKey: 'material' | 'sterilization' | 'storage' | 'invima' | 'area' | 'warranty',
    text: string,
    append = false
  ) => {
    const limit = (SHEET_FIELD_LIMITS as any)[fieldKey] || 500;
    const cleanText = text.trim();
    if (fieldKey === 'material') {
      setCustomMaterial((prev) => (append && prev.trim() ? `${prev.trim()}\n${cleanText}` : cleanText).slice(0, limit));
    } else if (fieldKey === 'sterilization') {
      setCustomSterilization((prev) => (append && prev.trim() ? `${prev.trim()}\n${cleanText}` : cleanText).slice(0, limit));
    } else if (fieldKey === 'storage') {
      setCustomStorage((prev) => (append && prev.trim() ? `${prev.trim()}\n${cleanText}` : cleanText).slice(0, limit));
    } else if (fieldKey === 'invima') {
      setCustomInvima(cleanText.slice(0, limit));
    } else if (fieldKey === 'area') {
      setCustomArea(cleanText.slice(0, limit));
    } else if (fieldKey === 'warranty') {
      setCustomWarranty(cleanText.slice(0, limit));
    }
    setOpenSuggestionsField(null);
    setCustomDraftSuggestion('');
  };

  const handleApplyAllEmptySuggestions = () => {
    let count = 0;
    if (!customMaterial.trim() && effectiveSuggestions.material) {
      setCustomMaterial(effectiveSuggestions.material.slice(0, SHEET_FIELD_LIMITS.material));
      count++;
    }
    if (!customSterilization.trim() && effectiveSuggestions.sterilization) {
      setCustomSterilization(effectiveSuggestions.sterilization.slice(0, SHEET_FIELD_LIMITS.sterilization));
      count++;
    }
    if (!customStorage.trim() && effectiveSuggestions.storage) {
      setCustomStorage(effectiveSuggestions.storage.slice(0, SHEET_FIELD_LIMITS.storage));
      count++;
    }
    if (!customArea.trim() && effectiveSuggestions.area) {
      setCustomArea(effectiveSuggestions.area.slice(0, SHEET_FIELD_LIMITS.area));
      count++;
    }
    if (!customInvima.trim() && effectiveSuggestions.invima) {
      setCustomInvima(effectiveSuggestions.invima.slice(0, SHEET_FIELD_LIMITS.invima));
      count++;
    }
    if (!customWarranty.trim() && effectiveSuggestions.warranty) {
      setCustomWarranty(effectiveSuggestions.warranty.slice(0, SHEET_FIELD_LIMITS.warranty));
      count++;
    }

    if (count > 0) {
      setSavedSuccessMessage(`✓ Se aplicaron sugerencias técnicas a ${count} campo(s) manual(es) vacío(s).`);
      setTimeout(() => setSavedSuccessMessage(null), 4500);
    } else {
      setSavedSuccessMessage('Todos los campos manuales ya cuentan con información.');
      setTimeout(() => setSavedSuccessMessage(null), 3000);
    }
  };

  const renderFieldSuggestionsBox = (
    fieldKey: 'material' | 'sterilization' | 'storage' | 'invima' | 'area' | 'warranty',
    fieldLabel: string
  ) => {
    if (openSuggestionsField !== fieldKey) return null;
    const currentVal =
      fieldKey === 'material'
        ? customMaterial
        : fieldKey === 'sterilization'
        ? customSterilization
        : fieldKey === 'storage'
        ? customStorage
        : fieldKey === 'invima'
        ? customInvima
        : fieldKey === 'area'
        ? customArea
        : customWarranty;

    const aiRec = effectiveSuggestions[fieldKey];
    const standardList = BIOMEDICAL_STANDARD_SUGGESTIONS[fieldKey] || [];

    return (
      <div className="mt-2 p-3 bg-[#0a1628] border border-cyan-500/50 rounded-xl shadow-2xl space-y-3">
        <div className="flex items-center justify-between border-b border-[#203a5c] pb-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-white">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Sugerencias para {fieldLabel}</span>
          </div>
          <button
            type="button"
            onClick={() => setOpenSuggestionsField(null)}
            className="text-slate-400 hover:text-white text-xs p-1 rounded hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 1. Sugerencia adaptada al producto actual */}
        {aiRec && (
          <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-500/30">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="text-[10.5px] font-bold text-cyan-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" /> Sugerencia para {productName || 'este producto'}:
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleApplySingleSuggestion(fieldKey, aiRec, false)}
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[10px] px-2.5 py-0.5 rounded shadow cursor-pointer transition active:scale-95"
                >
                  ✓ Usar sugerencia
                </button>
                {currentVal.trim() && (
                  <button
                    type="button"
                    onClick={() => handleApplySingleSuggestion(fieldKey, aiRec, true)}
                    className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold text-[10px] px-2 py-0.5 rounded cursor-pointer transition"
                    title="Añadir al final del texto actual"
                  >
                    + Añadir
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-200 leading-relaxed italic bg-slate-900/60 p-2 rounded border border-cyan-900/50">
              "{aiRec}"
            </p>
          </div>
        )}

        {/* 2. Catálogo de opciones estándar certificadas */}
        {standardList.length > 0 && (
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Opciones estándar del sector biomédico / hospitalario:
            </span>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {standardList.map((item, sIdx) => (
                <div
                  key={sIdx}
                  className="p-2 rounded-lg bg-[#122238] hover:bg-[#182c47] border border-[#233a59] hover:border-cyan-500/40 transition group cursor-pointer"
                  onClick={() => handleApplySingleSuggestion(fieldKey, item.text, false)}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold text-cyan-200 group-hover:text-cyan-100">
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className="text-[9px] bg-sky-950 text-sky-300 px-1.5 py-0.2 rounded border border-sky-800 font-mono shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {item.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Hacer o personalizar una sugerencia manual */}
        <div className="pt-2 border-t border-[#203a5c]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
            Hacer o redactar tu propia sugerencia personalizada:
          </span>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Escribe tu sugerencia personalizada..."
              value={customDraftSuggestion}
              onChange={(e) => setCustomDraftSuggestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customDraftSuggestion.trim()) {
                  e.preventDefault();
                  handleApplySingleSuggestion(fieldKey, customDraftSuggestion, false);
                }
              }}
              className="flex-1 bg-[#15253d] border border-[#334d6e] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 outline-none"
            />
            <button
              type="button"
              disabled={!customDraftSuggestion.trim()}
              onClick={() => handleApplySingleSuggestion(fieldKey, customDraftSuggestion, false)}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer transition shrink-0"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ===========================================================================
  // MEASUREMENT TABLE SUGGESTIONS (Hoja 2) - Presets & AI variants
  // ===========================================================================
  const [aiMeasurementSuggestions, setAiMeasurementSuggestions] = useState<
    Array<{ code: string; dimension: string }>
  >([]);
  const [isMeasurementSuggestionsOpen, setIsMeasurementSuggestionsOpen] = useState(false);
  const [measurementActiveCategory, setMeasurementActiveCategory] = useState<string>('recommended');
  const [customDraftCode, setCustomDraftCode] = useState('');
  const [customDraftDim, setCustomDraftDim] = useState('');
  const [rowPickerOpenIndex, setRowPickerOpenIndex] = useState<number | null>(null);

  // Recommended measurements combining AI research, contextual extraction (model, description, product) and smart scale expansion ("le agregues más")
  const effectiveRecommendedMeasurements = useMemo(() => {
    return generateContextualMeasurementSuggestions({
      productName,
      model,
      description: customDescription,
      characteristics: customCharacteristics,
      currentRows: referenceRows,
      aiSuggestions: aiMeasurementSuggestions,
      baseTable: baseData.referenceTable,
    });
  }, [
    productName,
    model,
    customDescription,
    customCharacteristics,
    referenceRows,
    aiMeasurementSuggestions,
    baseData.referenceTable,
  ]);

  // Apply single measurement item (append or update specific row)
  const handleApplySingleMeasurement = (item: { code: string; dimension: string }, targetRowIndex?: number) => {
    const cleanCode = item.code.trim().slice(0, SHEET_FIELD_LIMITS.tableCode);
    const cleanDim = item.dimension.trim().slice(0, SHEET_FIELD_LIMITS.tableDimension);

    if (typeof targetRowIndex === 'number' && targetRowIndex >= 0 && targetRowIndex < referenceRows.length) {
      const updated = [...referenceRows];
      updated[targetRowIndex] = { code: cleanCode, dimension: cleanDim };
      setReferenceRows(updated);
      setRowPickerOpenIndex(null);
      setSavedSuccessMessage(`✓ Medida actualizada en fila ${targetRowIndex + 1}: ${cleanCode}`);
      setTimeout(() => setSavedSuccessMessage(null), 3000);
      return;
    }

    if (referenceRows.length >= 8) {
      alert('La tabla ha alcanzado el límite recomendado de 8 medidas para el formato oficial de dos páginas.');
      return;
    }

    setReferenceRows([...referenceRows, { code: cleanCode, dimension: cleanDim }]);
    setSavedSuccessMessage(`✓ Medida añadida a la tabla: ${cleanCode}`);
    setTimeout(() => setSavedSuccessMessage(null), 3000);
  };

  // Load a complete preset package into the measurement table
  const handleLoadMeasurementPreset = (items: Array<{ code: string; dimension: string }>, replace = false) => {
    const cleanItems = items.slice(0, 8).map((it) => ({
      code: it.code.trim().slice(0, SHEET_FIELD_LIMITS.tableCode),
      dimension: it.dimension.trim().slice(0, SHEET_FIELD_LIMITS.tableDimension),
    }));

    if (replace) {
      setReferenceRows(cleanItems);
      setSavedSuccessMessage(`✓ Se cargó el paquete con ${cleanItems.length} medidas en la tabla.`);
    } else {
      const currentCodes = new Set(referenceRows.map((r) => r.code.trim().toLowerCase()));
      const newItems = cleanItems.filter((it) => !currentCodes.has(it.code.trim().toLowerCase()));
      const combined = [...referenceRows, ...newItems].slice(0, 8);
      setReferenceRows(combined);
      setSavedSuccessMessage(`✓ Se añadieron ${newItems.length} medidas nuevas a la tabla.`);
    }
    setTimeout(() => setSavedSuccessMessage(null), 3500);
  };

  // ===========================================================================
  // AI INTERNET RESEARCH HANDLER
  // ===========================================================================
  const handleResearchWithAi = async (nameToSearch?: string) => {
    const queryName = (nameToSearch || productName).trim();
    if (!queryName) {
      alert('Por favor escribe el nombre del equipo o producto antes de investigar.');
      return;
    }

    try {
      setIsSearchingAi(true);
      setAiMessage(null);

      const response = await fetch('/api/gemini/research-equipment-sheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          equipmentName: queryName,
          brand: brand.trim(),
          model: model.trim(),
        }),
      });

      if (response.status === 429) {
        notifyRateLimit(
          'Investigación IA de Ficha Técnica',
          'Límite de consultas temporal (Rate Limit). Se han cargado las especificaciones predeterminadas del catálogo biomédico.'
        );
        throw new Error('Rate limit exceeded (429)');
      }

      if (!response.ok) {
        throw new Error(`Error en servidor: ${response.status}`);
      }

      const resJson = await response.json();
      if (resJson.success && resJson.data) {
        const d = resJson.data;

        if (d.description) setCustomDescription(d.description.slice(0, SHEET_FIELD_LIMITS.description));
        if (d.function) setCustomFunction(d.function.slice(0, SHEET_FIELD_LIMITS.mainFunction));
        if (d.characteristics && Array.isArray(d.characteristics)) {
          setCustomCharacteristics(d.characteristics.join('\n').slice(0, SHEET_FIELD_LIMITS.characteristics));
        }

        // Guardar sugerencias de la IA para campos fijos/manuales sin sobrescribir los valores existentes del usuario
        setAiFieldSuggestions({
          material: d.material,
          sterilization: d.sterilization,
          storage: d.storage,
          invima: d.invimaRecordNumber,
          area: d.hospitalArea,
          warranty: d.warranty,
        });

        if (d.variants && Array.isArray(d.variants) && d.variants.length > 0) {
          const mappedVariants = d.variants
            .slice(0, 8)
            .map((v: any) => ({
              code: (v.code || `${model || 'Ref'}-01`).slice(0, SHEET_FIELD_LIMITS.tableCode),
              dimension: `${v.dimensions || ''} ${v.description ? `(${v.description})` : ''}`.trim().slice(0, SHEET_FIELD_LIMITS.tableDimension),
            }))
            .filter((v: any) => v.code.trim() || v.dimension.trim());

          setAiMeasurementSuggestions(mappedVariants);
          if (referenceRows.length === 0) {
            setReferenceRows(mappedVariants);
          }
        }

        const src = resJson.source || 'gemini_web_search';
        setAiSource(src);
        if (src.includes('biomedical')) {
          setAiMessage(
            `📋 Especificaciones técnicas actualizadas desde el catálogo biomédico para "${queryName}". Tus datos fijos (INVIMA, área, material, protocolo, almacenamiento y garantía) se mantuvieron intactos.`
          );
        } else {
          setAiMessage(
            `✨ Información investigada con éxito con IA para "${queryName}". Tus datos fijos (INVIMA, área, material, protocolo, almacenamiento y garantía) se mantuvieron intactos.`
          );
        }
        setIsSpecsAccordionOpen(true);
      } else {
        throw new Error(resJson.message || 'No se recibieron datos de la investigación');
      }

      // Always search and update product image for the newly researched equipment
      try {
        const queryToSearch = `${queryName} ${brand.trim()} ${model.trim()}`.trim();
        setImageSearchQuery(queryToSearch);
        const imgSearchRes = await fetch('/api/products/search-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: queryToSearch,
            equipmentName: queryName,
            brand: brand.trim(),
            model: model.trim(),
          }),
        });
        const imgSearchData = await imgSearchRes.json();
        if (imgSearchData.success && Array.isArray(imgSearchData.images) && imgSearchData.images.length > 0) {
          setImageSearchResults(imgSearchData.images);
          const topImg = imgSearchData.images[0];
          // Convert to clean Base64 via proxy to avoid CORS/PDF failures
          const proxyRes = await fetch('/api/proxy-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: topImg.url }),
          });
          const proxyData = await proxyRes.json();
          if (proxyData.success && proxyData.dataUrl) {
            setImagePreviewUrl(proxyData.dataUrl);
          } else {
            setImagePreviewUrl(topImg.url);
          }
        }
      } catch (imgErr) {
        console.warn('Auto image search background error:', imgErr);
      }
    } catch (_err: any) {
      // Fallback local heuristic - Only fills dynamic fields, strictly preserves manual regulatory fields
      const fallback = getImprovisedTechnicalSheetData(queryName, brand, model);
      if (fallback.description) setCustomDescription(fallback.description.slice(0, SHEET_FIELD_LIMITS.description));
      if (fallback.mainFunction) setCustomFunction(fallback.mainFunction.slice(0, SHEET_FIELD_LIMITS.mainFunction));
      if (fallback.characteristics) setCustomCharacteristics(fallback.characteristics.join('\n').slice(0, SHEET_FIELD_LIMITS.characteristics));
      setAiFieldSuggestions({
        material: fallback.fabricationMaterial,
        sterilization: fallback.sterilization,
        storage: fallback.storageConditions ? fallback.storageConditions.join('. ') : '',
        invima: fallback.invimaRegistration,
        area: fallback.areaDepartment,
        warranty: fallback.warranty,
      });
      if (fallback.referenceTable && fallback.referenceTable.length > 0) {
        const fallbackVariants = fallback.referenceTable.slice(0, 8).map((r) => ({
          code: r.code.slice(0, SHEET_FIELD_LIMITS.tableCode),
          dimension: r.dimension.slice(0, SHEET_FIELD_LIMITS.tableDimension),
        }));
        setAiMeasurementSuggestions(fallbackVariants);
        if (referenceRows.length === 0) {
          setReferenceRows(fallbackVariants);
        }
      }
      setAiMessage(`📋 Especificaciones de "${queryName}" completadas. Tus datos fijos manuales se conservaron.`);

      // Search and update image in fallback mode too for the newly requested product
      try {
        const queryToSearch = `${queryName} ${brand.trim()} ${model.trim()}`.trim();
        setImageSearchQuery(queryToSearch);
        const imgSearchRes = await fetch('/api/products/search-images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: queryToSearch,
            equipmentName: queryName,
            brand: brand.trim(),
            model: model.trim(),
          }),
        });
        const imgSearchData = await imgSearchRes.json();
        if (imgSearchData.success && Array.isArray(imgSearchData.images) && imgSearchData.images.length > 0) {
          setImageSearchResults(imgSearchData.images);
          const topImg = imgSearchData.images[0];
          const proxyRes = await fetch('/api/proxy-image', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: topImg.url }),
          });
          const proxyData = await proxyRes.json();
          if (proxyData.success && proxyData.dataUrl) {
            setImagePreviewUrl(proxyData.dataUrl);
          } else {
            setImagePreviewUrl(topImg.url);
          }
        }
      } catch (_imgErr) {
        // Non-blocking
      }
    } finally {
      setIsSearchingAi(false);
      setTimeout(() => setAiMessage(null), 8000);
    }
  };

  // Search Internet for product images (DuckDuckGo + Wikimedia + Certified biomedical catalog)
  const handleSearchInternetImages = async (customQuery?: string) => {
    // ALWAYS prioritize the explicitly passed query or the current fresh form values
    const currentFormQuery = `${productName} ${brand} ${model}`.trim() || productName.trim();
    const queryToSearch = (customQuery || currentFormQuery || imageSearchQuery).trim();
    if (!queryToSearch) {
      alert('Por favor escribe el nombre del producto antes de buscar su fotografía en internet.');
      return;
    }

    setImageSearchQuery(queryToSearch);
    setIsSearchingImages(true);
    setIsImageSearchModalOpen(true);

    try {
      const res = await fetch('/api/products/search-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryToSearch,
          equipmentName: productName.trim(),
          brand: brand.trim(),
          model: model.trim(),
        }),
      });

      if (res.status === 429) {
        notifyRateLimit(
          'Búsqueda de Imágenes',
          'Límite de solicitudes temporal. Puedes subir la fotografía directamente desde tu computador o intentar en unos instantes.'
        );
        setImageSearchResults([]);
        return;
      }

      const data = await res.json();
      if (data.success && Array.isArray(data.images)) {
        setImageSearchResults(data.images);
      } else {
        setImageSearchResults([]);
      }
    } catch (err) {
      console.error('Error buscando imágenes en internet:', err);
      setImageSearchResults([]);
    } finally {
      setIsSearchingImages(false);
    }
  };

  // Convert selected internet image to clean Base64 data URL and assign as product photo
  const handleSelectInternetImage = async (imgItem: { url: string; thumbnail?: string; title?: string }) => {
    try {
      setIsProxyingImage(imgItem.url);
      const res = await fetch('/api/proxy-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: imgItem.url }),
      });
      const data = await res.json();
      if (data.success && data.dataUrl) {
        setImagePreviewUrl(data.dataUrl);
      } else {
        setImagePreviewUrl(imgItem.url);
      }
      setAiMessage(`📸 Imagen de "${productName || imgItem.title || 'producto'}" asignada con éxito desde internet.`);
      setIsImageSearchModalOpen(false);
    } catch (err) {
      console.warn('Error convirtiendo imagen a Base64:', err);
      setImagePreviewUrl(imgItem.url);
      setIsImageSearchModalOpen(false);
    } finally {
      setIsProxyingImage(null);
    }
  };

  // Preset loader for immediate testing and verification
  const handleLoadPreset = (type: 'scissors' | 'monitor' | 'bed' | 'tray') => {
    if (type === 'scissors') {
      setProductName('Tijera Quirúrgica Metzembaum');
      setBrand('Aesculap');
      setModel('BC-281R');
      setCustomInvima('2024DM-0019283');
      setCustomArea('QUIRÓFANO Y CIRUGÍA GENERAL');
      setCustomDescription(
        'Instrumental quirúrgico de corte y disección tisular delicada con hojas curvas y puntas romas, diseñado para la separación atraumática de planos anatómicos profundos sin lesionar estructuras adyacentes.'
      );
      setCustomFunction(
        'Disección fina y corte preciso de tejidos blandos y planos fasciales durante intervenciones quirúrgicas abiertas o de cavidad.'
      );
      setCustomCharacteristics(
        [
          'Fabricada en Acero Inoxidable Martensítico AISI 420B de grado quirúrgico alemán.',
          'Hojas curvas con filo biselado de alta precisión y puntas redondeadas totalmente atraumáticas.',
          'Articulación fija con tornillo avellanado rectificado para un deslizamiento suave sin holguras.',
          'Acabado superficial satinado mate antideslumbrante para confort visual del cirujano bajo luz cialítica.',
          'Resistente a ciclos repetitivos de esterilización en autoclave a vapor hasta 134°C.',
        ].join('\n')
      );
      setCustomMaterial(
        'Acero Inoxidable Quirúrgico Martensítico AISI 420B certificado según normas ASTM F899 e ISO 7153-1.'
      );
      setCustomSterilization(
        'Lavar previamente con detergente enzimático de pH neutro, secar minuciosamente y esterilizar en autoclave por vapor a 134°C por 5 a 18 min.'
      );
      setCustomStorage(
        'Almacenar en bandeja con protectores de silicona para filos, en lugar seco (15°C a 25°C) con humedad relativa menor al 65%.'
      );
      setCustomWarranty('5 años de garantía contra defectos de fabricación o porosidad en el acero.');
      setReferenceRows([
        { code: '14.5 cm (Curva)', dimension: '14.5 cm (5-3/4") — Disección tisular fina superficial' },
        { code: '18.0 cm (Curva)', dimension: '18 cm (7.0") — Estándar de cirugía general' },
        { code: '20.0 cm (Curva)', dimension: '20 cm (8.0") — Disección profunda en cavidades' },
        { code: '23.0 cm (Curva)', dimension: '23 cm (9.0") — Cirugía pélvica y torácica profunda' },
        { code: '18.0 cm (Recta)', dimension: '18 cm (7.0") — Corte de suturas y tejidos resistentes' },
      ]);
      setAiMessage('✂️ Plantilla cargada: Tijera Quirúrgica Metzembaum con especificaciones reales.');
    } else if (type === 'monitor') {
      setProductName('Monitor de Signos Vitales Multiparámetro');
      setBrand('Mindray');
      setModel('uMEC-12');
      setCustomInvima('2023EIR-0021094');
      setCustomArea('CUIDADOS INTENSIVOS, URGENCIAS Y QUIRÓFANO');
      setCustomDescription(
        'Monitor multiparámetro de grado clínico para la monitorización continua y en tiempo real de los parámetros fisiológicos esenciales en pacientes adultos, pediátricos y neonatales.'
      );
      setCustomFunction(
        'Supervisión continua de ECG, SpO2, PNI, Frecuencia Respiratoria y Temperatura con alarmas visuales y auditivas configurables.'
      );
      setCustomCharacteristics(
        [
          'Pantalla táctil TFT a color de 12.1 pulgadas de alta resolución antirreflejo.',
          'Monitoreo integral: ECG de 3/5 derivaciones, SpO2, PNI, Frecuencia Respiratoria y 2 canales de Temperatura.',
          'Batería recargable de Ión-Litio con más de 4 horas de autonomía para traslados intrahospitalarios.',
          'Diseño Fanless sin ventilador que previene la contaminación cruzada en áreas asépticas.',
          'Gabinete antimicrobiano de alta resistencia química a desinfectantes hospitalarios.',
        ].join('\n')
      );
      setCustomMaterial(
        'Carcasa en policarbonato/ABS de grado médico con aditivo antibacteriano y chasis interior de aleación ligera.'
      );
      setCustomSterilization(
        'Desinfección superficial con paño humedecido en alcohol isopropílico al 70% o solución de amonio cuaternario. No sumergir.'
      );
      setCustomStorage(
        'Almacenar en recinto con temperatura controlada entre 15°C a 30°C y humedad sin condensación.'
      );
      setCustomWarranty('2 años de garantía en unidad principal y 1 año en sensores y cables de paciente.');
      setReferenceRows([
        { code: 'uMEC-12', dimension: 'Configuración estándar: ECG, SpO2, PNI, Temp, Resp' },
        { code: 'uMEC-12-W', dimension: 'Con conectividad inalámbrica Wi-Fi a Central de Monitoreo' },
        { code: 'uMEC-12-IBP', dimension: 'Con módulo adicional de Presión Invasiva (PI) y Capnografía' },
      ]);
      setAiMessage('🩺 Plantilla cargada: Monitor de Signos Vitales con especificaciones reales.');
    } else if (type === 'bed') {
      setProductName('Cama Hospitalaria Eléctrica de 4 Planos');
      setBrand('Stryker');
      setModel('Secure-3');
      setCustomInvima('2022DM-0018742');
      setCustomArea('HOSPITALIZACIÓN Y CUIDADOS CRÍTICOS');
      setCustomDescription(
        'Cama hospitalaria eléctrica multifuncional diseñada para optimizar la seguridad del paciente, prevenir caídas y facilitar la labor asistencial con ajustes ergonómicos de posición.'
      );
      setCustomFunction(
        'Posicionamiento del paciente en Fowler, Semi-Fowler, Trendelenburg e Inverso mediante controles eléctricos intuitivos.'
      );
      setCustomCharacteristics(
        [
          'Estructura de alta resistencia con capacidad de carga estática de hasta 250 kg.',
          '4 motores eléctricos silenciosos con grado de protección IPX4 para lavado y desinfección.',
          'Barandas de seguridad laterales de polímero con controles integrados.',
          'Ruedas de 150 mm con sistema de freno centralizado y direccional silencioso.',
          'Palanca de RCP manual de liberación rápida en ambos lados de la cama.',
        ].join('\n')
      );
      setCustomMaterial(
        'Estructura de acero estructural con recubrimiento epóxico antibacterial y paneles desmontables de polietileno de alta densidad.'
      );
      setCustomSterilization(
        'Limpieza y desinfección por frotado con soluciones de amonio cuaternario o hipoclorito diluido.'
      );
      setCustomStorage(
        'Mantener en recinto techado a temperatura ambiente, protegida del polvo y humedad.'
      );
      setCustomWarranty('3 años en estructura metálica y 2 años en componentes eléctricos y motores.');
      setReferenceRows([
        { code: 'SEC-3-STD', dimension: '218 cm x 102 cm - Altura variable 40 cm a 80 cm' },
        { code: 'SEC-3-BAR', dimension: 'Con báscula electrónica de pesaje incorporada' },
      ]);
      setAiMessage('🛏️ Plantilla cargada: Cama Hospitalaria Eléctrica.');
    } else if (type === 'tray') {
      setProductName('Bandeja Quirúrgica Plana Acero Quirúrgico');
      setBrand('DADDY D PRO');
      setModel('DE-806064');
      setCustomInvima('2024DM-0029361');
      setCustomArea('CENTRAL DE ESTERILIZACIÓN Y QUIRÓFANO');
      setCustomDescription(
        'Dispositivo e instrumental quirúrgico diseñado para la contención, organización, transporte y esterilización de instrumental médico en quirófano y áreas clínicas hospitalarias.'
      );
      setCustomFunction(
        'Soporte, transporte, organización y esterilización del instrumental médico en quirófano y áreas clínicas.'
      );
      setCustomCharacteristics(
        [
          'Fabricado en Acero Inoxidable ASIS 420/316 de grado quirúrgico de alta pureza.',
          'Acabado superficial sanitario no poroso, resistente a picaduras y corrosión química.',
          'Bordes romos perimetrales y esquinas redondeadas para evitar acumulación de residuos patógenos.',
          'Excelente tolerancia térmica a ciclos repetitivos de autoclave a 134°C y calor seco.',
          'Alta resistencia mecánica a impactos, deformaciones y agentes de lavado enzimático.',
        ].join('\n')
      );
      setCustomMaterial(
        'Acero Inoxidable ASIS 420/316 para uso en fabricación de implantes y dispositivos quirúrgicos.'
      );
      setCustomSterilization(
        'Esterilización por vapor húmedo en autoclave a 134°C tras lavado previo con detergente enzimático.'
      );
      setCustomStorage(
        'Almacenar en lugar limpio, fresco y seco a temperatura ambiente.'
      );
      setCustomWarranty('5 años contra defectos de fabricación en acero quirúrgico.');
      setReferenceRows([
        { code: '35 x 25 x 1 cm', dimension: '13-3/4" x 9-3/4" x 1/2" — Bandeja instrumental menor' },
        { code: '38 x 26.5 x 2 cm', dimension: '15" x 10-1/2" x 3/4" — Bandeja estándar cirugía general' },
        { code: '43 x 29.5 x 1 cm', dimension: '17" x 11-5/8" x 1/2" — Bandeja instrumental mayor' },
        { code: '48 x 32.5 x 1.9 cm', dimension: '19" x 12-3/4" x 3/4" — Bandeja laparoscopia y ortopedia' },
      ]);
      setAiMessage('📥 Plantilla cargada: Bandeja Quirúrgica.');
    }
  };

  // When picking from catalog, auto-fill and auto-research if needed
  const handleSelectCatalogEquipment = (eqId: string) => {
    setSelectedCatalogEquipmentId(eqId);
    const eq = equipments.find((e) => e.id === eqId);
    if (eq) {
      setProductName(eq.name || '');
      setBrand(eq.brand || '');
      setModel(eq.model || eq.code || '');
      if (eq.invimaRecordNumber) {
        setCustomInvima(eq.invimaRecordNumber);
      }
      if (eq.imageUrl) {
        setImagePreviewUrl(eq.imageUrl);
      }
      if (eq.description) {
        setCustomDescription(eq.description);
      }
      if (eq.technicalSpecs && eq.technicalSpecs.length > 0) {
        setCustomCharacteristics(eq.technicalSpecs.join('\n'));
      }
      // Trigger AI research to fill the rest
      handleResearchWithAi(eq.name);
    }
  };

  // Helper to read and set image file
  const processImageFile = (file: File, target: 'photo' | 'logo') => {
    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona o pega un archivo de imagen válido (PNG, JPG, WebP).');
      return;
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      if (target === 'logo') {
        setCompanyLogoUrl(result);
        setAiMessage('🏢 Logo de la empresa cargado exitosamente. Se aplicará en el encabezado y como marca de agua.');
      } else {
        setImagePreviewUrl(result);
        setAiMessage('📸 Fotografía del producto cargada exitosamente.');
      }
      setTimeout(() => setAiMessage(null), 5000);
    };
    reader.readAsDataURL(file);
  };

  // Handle product photo upload via input
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file, 'photo');
    }
  };

  // Handle company logo upload via input
  const handleCompanyLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file, 'logo');
    }
  };

  // Handle Drag & Drop on photo or logo containers
  const handleDropOnTarget = (e: React.DragEvent<HTMLElement>, target: 'photo' | 'logo') => {
    e.preventDefault();
    e.stopPropagation();
    setUploadTarget(target);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file, target);
    }
  };

  // Handle Direct Paste on photo or logo dropzones or text fields
  const handlePasteOnTarget = (e: React.ClipboardEvent<HTMLElement>, target: 'photo' | 'logo') => {
    setUploadTarget(target);
    const items = e.clipboardData?.items;

    // Check for image binary in clipboard
    if (items) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          e.stopPropagation();
          const blob = item.getAsFile();
          if (blob) {
            processImageFile(blob, target);
          }
          return;
        }
      }
    }

    // Check for image URL or data URI text in clipboard
    const text = e.clipboardData?.getData('text')?.trim();
    if (text && (text.startsWith('http') || text.startsWith('data:image/') || /\.(png|jpe?g|webp|svg|gif)($|\?)/i.test(text))) {
      e.preventDefault();
      e.stopPropagation();
      if (target === 'logo') {
        setCompanyLogoUrl(text);
        setAiMessage('🏢 Logo cargado exitosamente.');
      } else {
        setImagePreviewUrl(text);
        setAiMessage('📸 Fotografía cargada exitosamente.');
      }
      setTimeout(() => setAiMessage(null), 4000);
    }
  };

  // Direct Button Paste using Clipboard API with safe fallback
  const handlePasteFromClipboard = async (target: 'photo' | 'logo') => {
    setUploadTarget(target);
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            processImageFile(new File([blob], `${target}.png`, { type: imageType }), target);
            return;
          }
        }
      }
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        const clean = text?.trim();
        if (clean && (clean.startsWith('http') || clean.startsWith('data:image/') || /\.(png|jpe?g|webp|svg|gif)($|\?)/i.test(clean))) {
          if (target === 'logo') {
            setCompanyLogoUrl(clean);
            setAiMessage('🏢 Logo cargado exitosamente desde el portapapeles.');
          } else {
            setImagePreviewUrl(clean);
            setAiMessage('📸 Fotografía cargada exitosamente desde el portapapeles.');
          }
          setTimeout(() => setAiMessage(null), 4000);
          return;
        }
      }
      // Focus the input target for manual Ctrl+V
      const el = document.getElementById(target === 'logo' ? 'logo-input-field' : 'photo-input-field');
      el?.focus();
      setAiMessage(`💡 Copia la imagen de tu ${target === 'logo' ? 'Logo' : 'Producto'} y presiona Ctrl + V.`);
      setTimeout(() => setAiMessage(null), 4000);
    } catch {
      const el = document.getElementById(target === 'logo' ? 'logo-input-field' : 'photo-input-field');
      el?.focus();
      setAiMessage(`💡 Portapapeles listo para ${target === 'logo' ? 'Logo' : 'Foto'}: Presiona Ctrl + V en tu teclado.`);
      setTimeout(() => setAiMessage(null), 4000);
    }
  };

  // Window-level Ctrl+V listener: captures image pasted from clipboard anywhere in the view
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const activeEl = document.activeElement as HTMLElement | null;

      // Smart target detection using current ref
      let target: 'photo' | 'logo' = focusedUploadTargetRef.current;
      if (activeEl) {
        if (
          activeEl.id === 'logo-input-field' ||
          activeEl.closest('#logo-upload-zone') ||
          activeEl.closest('#branding-section') ||
          activeEl.getAttribute('data-paste-target') === 'logo'
        ) {
          target = 'logo';
        } else if (
          activeEl.id === 'photo-input-field' ||
          activeEl.closest('#photo-upload-zone') ||
          activeEl.getAttribute('data-paste-target') === 'photo'
        ) {
          target = 'photo';
        }
      }
      focusedUploadTargetRef.current = target;
      setFocusedUploadTarget(target);

      // Check for image binary in clipboard
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            processImageFile(blob, target);
          }
          return;
        }
      }

      // If user isn't typing in an unrelated text box, check if text is an image link
      const isUnrelatedText =
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') &&
        !activeEl.getAttribute('data-paste-image');

      if (!isUnrelatedText) {
        const text = e.clipboardData?.getData('text')?.trim();
        if (text && (text.startsWith('http') || text.startsWith('data:image/')) && /\.(png|jpe?g|webp|svg|gif)($|\?)/i.test(text)) {
          e.preventDefault();
          if (target === 'logo') {
            setCompanyLogoUrl(text);
            setAiMessage('🏢 URL del logo cargada exitosamente.');
          } else {
            setImagePreviewUrl(text);
            setAiMessage('📸 URL de fotografía cargada exitosamente.');
          }
          setTimeout(() => setAiMessage(null), 4000);
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, []);

  // Reset form to completely blank
  const handleReset = () => {
    setProductName('');
    setBrand('');
    setModel('');
    setImagePreviewUrl('');
    setSelectedCatalogEquipmentId('');
    setCustomDescription('');
    setCustomFunction('');
    setCustomCharacteristics('');
    setCustomMaterial('');
    setCustomInvima('');
    setCustomArea('');
    setCustomSterilization('');
    setCustomStorage('');
    setCustomWarranty('');
    setReferenceRows([]);
    setSavedSuccessMessage(null);
    setAiMessage('✨ Formulario reiniciado en blanco.');
    setTimeout(() => setAiMessage(null), 4000);
  };

  // Add a new row to the table
  const handleAddReferenceRow = () => {
    setReferenceRows([
      ...referenceRows,
      {
        code: '',
        dimension: '',
      },
    ]);
  };

  // Remove a row from the table
  const handleRemoveReferenceRow = (index: number) => {
    setReferenceRows(referenceRows.filter((_, i) => i !== index));
  };

  // Update a row
  const handleUpdateReferenceRow = (index: number, field: 'code' | 'dimension', value: string) => {
    const updated = [...referenceRows];
    updated[index][field] = value;
    setReferenceRows(updated);
  };

  // Generate & Download PDF (Vector 2-page document with 100% fidelity to preview)
  const handleDownloadPdf = () => {
    try {
      setIsGeneratingPdf(true);
      const safeName = (productName || 'Ficha_Tecnica')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 30);
      const safeModel = (model || 'Ref').replace(/[^a-zA-Z0-9_-]/g, '_');
      const fileName = `Ficha_Tecnica_${safeName}_${safeModel}.pdf`;

      const doc = generateTechnicalSheetPdf(finalSheetData);
      doc.save(fileName);
      setSavedSuccessMessage('✅ Ficha técnica descargada exitosamente en formato PDF (2 páginas oficiales).');
      setTimeout(() => setSavedSuccessMessage(null), 5000);
    } catch (err) {
      console.error('Error generating PDF:', err);
      alert('Error generando el archivo PDF de la ficha técnica.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Print PDF directly
  const handlePrintPdf = () => {
    window.print();
  };

  // Save as TechnicalDocument in Ventana 7
  const handleSaveToDocumentation = () => {
    try {
      setIsGeneratingPdf(true);
      const safeName = (productName || 'Producto')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 25);
      const fileName = `Ficha_Tecnica_${safeName}_${model || 'Ref'}.pdf`;

      const doc = generateTechnicalSheetPdf(finalSheetData);
      const dataUri = doc.output('datauristring');

      const matchedEq = equipments.find(
        (eq) =>
          eq.id === selectedCatalogEquipmentId ||
          eq.name.toLowerCase() === productName.toLowerCase() ||
          eq.model.toLowerCase() === model.toLowerCase()
      );

      const newDoc: TechnicalDocument = {
        id: `ft-${Date.now()}`,
        equipmentId: matchedEq?.id || selectedCatalogEquipmentId || '',
        equipmentName: productName || 'Equipo / Dispositivo Médico',
        equipmentCode: model || matchedEq?.code || '',
        docType: 'Ficha Técnica',
        title: `Ficha Técnica - ${productName} (${brand})`,
        fileName,
        fileSize: `${Math.round(dataUri.length / 1024)} KB`,
        fileData: dataUri,
        fileType: 'application/pdf',
        uploadDate: new Date().toISOString().split('T')[0],
        status: 'Vigente',
        invimaNumber: finalSheetData.invimaRegistration || undefined,
        notes: `Generado automáticamente con IA & Web Search (Marca: ${brand}, Modelo: ${model}).`,
        uploadedBy: 'Generador Rápido con IA',
      };

      if (onSaveToDocuments) {
        onSaveToDocuments(newDoc);
        setSavedSuccessMessage(
          `✅ Ficha técnica guardada con éxito para "${productName}".`
        );
        setTimeout(() => setSavedSuccessMessage(null), 6000);
      }
    } catch (err) {
      console.error('Error saving document:', err);
      alert('Error al guardar la ficha técnica en la documentación.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Top Banner & Fast Selector */}
      <div className="bg-gradient-to-r from-[#192b45] via-[#1b3459] to-[#15253d] border border-[#334d6e] rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 shadow-xs">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Generador de Fichas Técnicas con IA
              </span>
              <span className="text-[11px] font-semibold text-slate-300 hidden sm:inline">
                • Búsqueda en Internet & Previsualización en Vivo
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-black text-white tracking-wide">
              Generador Inteligente de Fichas Técnicas
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Ingresa el <strong>Nombre del Equipo</strong>, <strong>Marca</strong>, <strong>Modelo</strong> y una <strong>Imagen</strong>. 
              Usa el botón <strong className="text-cyan-300">"Investigar con IA e Internet"</strong> para completar automáticamente 
              la descripción, características, función, materiales, INVIMA y medidas. Puedes ver en tiempo real cómo queda el documento oficial.
            </p>
          </div>

          {/* Catalog auto-complete selector */}
          <div className="bg-[#15253d]/90 border border-[#334d6e] p-3 rounded-xl shrink-0 max-w-md">
            <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 mb-1.5">
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Cargar desde Equipos del Catálogo:</span>
            </div>
            <select
              value={selectedCatalogEquipmentId}
              onChange={(e) => handleSelectCatalogEquipment(e.target.value)}
              className="w-full bg-[#1e3455] border border-[#334d6e] text-xs text-white rounded-lg px-2.5 py-1.5 outline-none focus:border-cyan-400 cursor-pointer"
            >
              <option value="">-- Seleccionar Equipo Existente --</option>
              {equipments.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name} • {eq.brand} ({eq.model || eq.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* AI Notification Alert */}
        {aiMessage && (
          <div className="mt-4 p-3 bg-cyan-500/15 border border-cyan-500/40 rounded-xl text-xs text-cyan-200 flex items-center justify-between animate-fadeIn shadow-md">
            <div className="flex items-center gap-2 font-medium">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>{aiMessage}</span>
            </div>
            <button
              onClick={() => setAiMessage(null)}
              className="text-cyan-300 hover:text-white cursor-pointer ml-3"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Success Alert Toast */}
        {savedSuccessMessage && (
          <div className="mt-4 p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center justify-between animate-fadeIn shadow-md">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{savedSuccessMessage}</span>
            </div>
            <button
              onClick={() => setSavedSuccessMessage(null)}
              className="text-emerald-400 hover:text-white cursor-pointer ml-3"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Mobile / Narrow Screen Switcher */}
      <div className="lg:hidden flex items-center justify-center gap-2 bg-[#12233e] p-1.5 rounded-xl border border-[#22395d]">
        <button
          type="button"
          onClick={() => setMobileTab('editor')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            mobileTab === 'editor'
              ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Edit3 className="w-4 h-4" />
          <span>1. Editor de Datos</span>
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('preview')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
            mobileTab === 'preview'
              ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>2. Vista Previa en Vivo</span>
        </button>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* =================================================================== */}
        {/* LEFT COLUMN: Input Form & AI Trigger (6 cols on large)             */}
        {/* =================================================================== */}
        <div className={`space-y-4 ${mobileTab === 'preview' ? 'hidden lg:block' : 'block'} lg:col-span-6`}>
          {/* Section 1: Core Inputs */}
          <div className="bg-[#192b45] border border-[#334d6e] rounded-2xl p-5 shadow-md space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#334d6e]/70">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  1. Datos Principales del Producto
                </h3>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="text-[11px] font-semibold text-slate-400 hover:text-rose-300 flex items-center gap-1 transition cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Limpiar Todo
              </button>
            </div>

            {/* 1. Nombre del Producto + Botón IA Internet */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-200">
                  Nombre del Producto / Equipo <span className="text-rose-400">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <CharCounter current={productName.length} max={SHEET_FIELD_LIMITS.productName} />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch gap-2">
                <input
                  type="text"
                  maxLength={SHEET_FIELD_LIMITS.productName}
                  placeholder="Ej: Tijera Metzembaum, Monitor Multiparámetro, Mesa de Cirugía..."
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleResearchWithAi();
                    }
                  }}
                  className="flex-1 bg-[#15253d] border border-[#334d6e] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-white placeholder-slate-500 focus:border-cyan-400 outline-none transition"
                />

                {/* Primary Top AI & Web Research Button */}
                <button
                  type="button"
                  onClick={() => handleResearchWithAi()}
                  disabled={isSearchingAi || !productName.trim()}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 active:scale-95"
                  title="Consultar en internet con IA y autocompletar especificaciones y fotografía real del producto"
                >
                  {isSearchingAi ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                      <span>Investigando...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-slate-950" />
                      <span>Investigar con IA</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                💡 Consejo: Al presionar <strong>"Investigar con IA"</strong> se autocompletan la descripción, función, características, medidas y la fotografía real del producto desde internet. Tus datos normativos (INVIMA, área, material, protocolo, almacenamiento y garantía) <strong>se conservan intactos</strong>.
              </p>
            </div>

            {/* 2 & 3. Marca y Modelo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-200">
                    2. Marca <span className="text-rose-400">*</span>
                  </label>
                  <CharCounter current={brand.length} max={SHEET_FIELD_LIMITS.brand} />
                </div>
                <input
                  type="text"
                  maxLength={SHEET_FIELD_LIMITS.brand}
                  placeholder="Ej: Aesculap, Mindray, Welch Allyn, Stryker..."
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-white placeholder-slate-500 focus:border-cyan-400 outline-none transition"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-200">
                    3. Modelo / Referencia <span className="text-rose-400">*</span>
                  </label>
                  <CharCounter current={model.length} max={SHEET_FIELD_LIMITS.model} />
                </div>
                <input
                  type="text"
                  maxLength={SHEET_FIELD_LIMITS.model}
                  placeholder="Ej: 18cm Curva, uMEC-12, MOD-200..."
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-white placeholder-slate-500 focus:border-cyan-400 outline-none transition"
                />
              </div>
            </div>

            {/* 4. Fotografía del Producto */}
            <div
              id="photo-upload-zone"
              tabIndex={0}
              onFocus={() => setFocusedUploadTarget('photo')}
              onMouseEnter={() => setFocusedUploadTarget('photo')}
              onClick={() => setFocusedUploadTarget('photo')}
              className="outline-none"
            >
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-200">
                  4. Fotografía del Producto (PNG, JPG o WebP)
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePasteFromClipboard('photo')}
                    className="text-[10px] text-cyan-300 font-mono bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-700/50 hover:border-cyan-400 px-2 py-0.5 rounded flex items-center gap-1.5 cursor-pointer transition active:scale-95"
                    title="Pegar imagen desde el portapapeles o presiona Ctrl + V"
                  >
                    <Clipboard className="w-3 h-3" />
                    <kbd className="font-bold">Ctrl + V</kbd> Pegar Foto
                  </button>
                  {imagePreviewUrl && (
                    <span className="text-[10px] text-emerald-400 font-medium">✓ Foto activa</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                {/* Drop/Upload Button Box */}
                <label
                  id="photo-dropzone"
                  data-paste-target="photo"
                  tabIndex={0}
                  onFocus={() => setUploadTarget('photo')}
                  onMouseEnter={() => setUploadTarget('photo')}
                  onClick={() => setUploadTarget('photo')}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => handleDropOnTarget(e, 'photo')}
                  onPaste={(e) => handlePasteOnTarget(e, 'photo')}
                  className={`flex-1 w-full flex items-center justify-center gap-2.5 border-2 border-dashed ${
                    focusedUploadTarget === 'photo'
                      ? 'border-cyan-400 bg-[#193256]'
                      : 'border-[#334d6e] hover:border-cyan-400/80 bg-[#15253d]'
                  } hover:bg-[#1e3455] p-3 rounded-xl cursor-pointer transition text-center group outline-none`}
                >
                  <Upload className="w-5 h-5 text-cyan-400 group-hover:scale-110 transition shrink-0" />
                  <div className="text-left">
                    <span className="text-xs font-bold text-slate-200 group-hover:text-white block">
                      {imagePreviewUrl ? 'Cambiar Fotografía del Producto' : 'Subir o Pegar Fotografía del Producto'}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Haz clic para examinar o presiona <strong className="text-cyan-300">Ctrl + V</strong>
                    </span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>

                {/* Image Preview Box */}
                {imagePreviewUrl ? (
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-cyan-500/50 shrink-0 bg-slate-950 p-1 shadow-md group">
                    <img
                      src={imagePreviewUrl}
                      alt="Vista Previa"
                      className="w-full h-full object-contain rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setImagePreviewUrl('')}
                      className="absolute top-1 right-1 bg-rose-500/90 hover:bg-rose-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition cursor-pointer shadow-md"
                      title="Quitar imagen"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-xl border border-[#334d6e] bg-[#15253d] flex flex-col items-center justify-center text-slate-500 shrink-0 text-center p-1">
                    <ImageIcon className="w-5 h-5 mb-0.5 text-slate-400" />
                    <span className="text-[9px]">Sin foto</span>
                  </div>
                )}
              </div>

              {imagePreviewUrl && (
                <div className="flex items-center justify-end mt-2 px-1">
                  <span className="text-[10px] text-slate-400">Base64 optimizado para PDF</span>
                </div>
              )}

              {/* Paste URL */}
              <div className="mt-2">
                <input
                  type="text"
                  id="photo-input-field"
                  data-paste-image="true"
                  data-paste-target="photo"
                  onFocus={() => setUploadTarget('photo')}
                  onClick={() => setUploadTarget('photo')}
                  onPaste={(e) => handlePasteOnTarget(e, 'photo')}
                  placeholder="O pega aquí la URL web directa de la imagen (o presiona Ctrl+V)..."
                  value={imagePreviewUrl.startsWith('data:') ? '' : imagePreviewUrl}
                  onChange={(e) => setImagePreviewUrl(e.target.value)}
                  className="w-full bg-[#15253d]/70 border border-[#334d6e]/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-400 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Logo & Watermark (No Company Name per User Request) */}
          <div id="branding-section" className="bg-[#192b45] border border-[#334d6e] rounded-2xl p-5 shadow-md">
            <button
              type="button"
              onClick={() => {
                setIsBrandingAccordionOpen(!isBrandingAccordionOpen);
                setUploadTarget('logo');
              }}
              className="w-full flex items-center justify-between pb-3 border-b border-[#334d6e]/70 text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider group-hover:text-amber-300 transition">
                    2. Logo Institucional y Marca de Agua
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Sube o pega directamente tu logo (con Ctrl + V) para el encabezado del documento
                  </p>
                </div>
              </div>
              {isBrandingAccordionOpen ? (
                <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-white" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-white" />
              )}
            </button>

            {isBrandingAccordionOpen && (
              <div className="space-y-4 pt-4 animate-fadeIn">
                {/* Subir Logo de la Empresa - Con soporte directo para Ctrl + V */}
                <div
                  id="logo-upload-zone"
                  data-paste-target="logo"
                  tabIndex={0}
                  onFocus={() => setUploadTarget('logo')}
                  onMouseEnter={() => setUploadTarget('logo')}
                  onClick={() => setUploadTarget('logo')}
                  className="outline-none"
                >
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-200">
                      Logo del Encabezado (PNG o JPG):
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePasteFromClipboard('logo')}
                        className="text-[10px] text-amber-300 font-mono bg-amber-950/70 hover:bg-amber-900 border border-amber-700/50 hover:border-amber-400 px-2 py-0.5 rounded flex items-center gap-1.5 cursor-pointer transition active:scale-95"
                        title="Pegar logo desde el portapapeles o presiona Ctrl + V"
                      >
                        <Clipboard className="w-3 h-3" />
                        <kbd className="font-bold">Ctrl + V</kbd> Pegar Logo
                      </button>
                      {companyLogoUrl && (
                        <span className="text-[10px] text-emerald-400 font-medium">✓ Logo activo</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <label
                      id="logo-dropzone"
                      data-paste-target="logo"
                      tabIndex={0}
                      onFocus={() => setUploadTarget('logo')}
                      onMouseEnter={() => setUploadTarget('logo')}
                      onClick={() => setUploadTarget('logo')}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDrop={(e) => handleDropOnTarget(e, 'logo')}
                      onPaste={(e) => handlePasteOnTarget(e, 'logo')}
                      className={`flex-1 w-full flex items-center justify-center gap-2.5 border-2 border-dashed ${
                        focusedUploadTarget === 'logo'
                          ? 'border-amber-400 bg-[#2b2f42]'
                          : 'border-[#334d6e] hover:border-amber-400/80 bg-[#15253d]'
                      } hover:bg-[#1e3455] p-3 rounded-xl cursor-pointer transition text-center group outline-none`}
                    >
                      <Upload className="w-5 h-5 text-amber-400 group-hover:scale-110 transition shrink-0" />
                      <div className="text-left">
                        <span className="text-xs font-bold text-slate-200 group-hover:text-white block">
                          {companyLogoUrl ? 'Cambiar Logo del Encabezado' : 'Subir o Pegar Logo del Encabezado'}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          Haz clic para examinar o presiona <strong className="text-amber-300">Ctrl + V</strong> para pegar
                        </span>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCompanyLogoUpload}
                        className="hidden"
                      />
                    </label>

                    {companyLogoUrl ? (
                      <div className="relative w-24 h-16 rounded-xl overflow-hidden border border-amber-500/50 shrink-0 bg-white p-1.5 shadow-md group flex items-center justify-center">
                        <img
                          src={companyLogoUrl}
                          alt="Logo Encabezado"
                          className="max-w-full max-h-full object-contain"
                        />
                        <button
                          type="button"
                          onClick={() => setCompanyLogoUrl('')}
                          className="absolute top-1 right-1 bg-rose-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition cursor-pointer shadow-md"
                          title="Quitar logo"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-16 rounded-xl border border-[#334d6e] bg-[#15253d] flex flex-col items-center justify-center text-slate-500 shrink-0 text-center p-1">
                        <Building2 className="w-5 h-5 mb-0.5 text-slate-400" />
                        <span className="text-[9px]">Sin logo</span>
                      </div>
                    )}
                  </div>

                  {/* URL Input */}
                  <div className="mt-2">
                    <input
                      type="text"
                      id="logo-input-field"
                      data-paste-image="true"
                      data-paste-target="logo"
                      onFocus={() => setUploadTarget('logo')}
                      onClick={() => setUploadTarget('logo')}
                      onPaste={(e) => handlePasteOnTarget(e, 'logo')}
                      placeholder="O escribe la URL web directa del logo (o presiona Ctrl+V)..."
                      value={companyLogoUrl.startsWith('data:') ? '' : companyLogoUrl}
                      onChange={(e) => setCompanyLogoUrl(e.target.value)}
                      className="w-full bg-[#15253d]/70 border border-[#334d6e]/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-400 outline-none"
                    />
                  </div>
                </div>

                {/* Controles de Marca de Agua & Visibilidad de Logo */}
                <div className="bg-[#12233e] border border-[#233a5d] rounded-xl p-3 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showWatermark}
                        onChange={(e) => setShowWatermark(e.target.checked)}
                        className="w-4 h-4 rounded text-cyan-500 bg-[#15253d] border-[#334d6e] focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-200">
                        Marca de agua en el fondo de las páginas del PDF y preview
                      </span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={showLogoInHeader}
                        onChange={(e) => setShowLogoInHeader(e.target.checked)}
                        className="w-4 h-4 rounded text-cyan-500 bg-[#15253d] border-[#334d6e] focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-slate-200">
                        Mostrar logo en cabecera
                      </span>
                    </label>
                  </div>

                  {/* Opacidad de Marca de Agua */}
                  {showWatermark && (
                    <div className="pt-2 border-t border-[#233a5d]/70 flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-300 font-semibold">Opacidad de la Marca de Agua:</span>
                          <span className="text-cyan-300 font-mono font-bold">
                            {Math.round(watermarkOpacity * 100)}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.02}
                          max={0.25}
                          step={0.01}
                          value={watermarkOpacity}
                          onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 max-w-[140px] leading-tight">
                        (Baja opacidad recomendada para asegurar máxima legibilidad del texto)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 3: AI Specifications Accordion */}
          <div className="bg-[#192b45] border border-[#334d6e] rounded-2xl p-5 shadow-md">
            <button
              type="button"
              onClick={() => setIsSpecsAccordionOpen(!isSpecsAccordionOpen)}
              className="w-full flex items-center justify-between pb-3 border-b border-[#334d6e]/70 text-left cursor-pointer group"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider group-hover:text-cyan-300 transition">
                    3. Descripción, Características y Función (Completadas con IA)
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Investigadas en la web o editables directamente según tus requerimientos
                  </p>
                </div>
              </div>
              {isSpecsAccordionOpen ? (
                <ChevronUp className="w-5 h-5 text-slate-400 group-hover:text-white" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-white" />
              )}
            </button>

            {isSpecsAccordionOpen && (
              <div className="space-y-4 pt-4 animate-fadeIn">
                {/* Descripción del Producto */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-200">
                      Descripción Técnica del Producto:
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-cyan-300">Hoja 1 y 2</span>
                      <CharCounter current={customDescription.length} max={SHEET_FIELD_LIMITS.description} />
                    </div>
                  </div>
                  <textarea
                    rows={3}
                    maxLength={SHEET_FIELD_LIMITS.description}
                    placeholder="Descripción técnica formal del equipo..."
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 outline-none leading-relaxed"
                  />
                </div>

                {/* Función Principal */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-200">
                      Función Principal:
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-cyan-300">Hoja 1</span>
                      <CharCounter current={customFunction.length} max={SHEET_FIELD_LIMITS.mainFunction} />
                    </div>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={SHEET_FIELD_LIMITS.mainFunction}
                    placeholder="Función principal en quirófano o áreas asistenciales..."
                    value={customFunction}
                    onChange={(e) => setCustomFunction(e.target.value)}
                    className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 outline-none leading-relaxed"
                  />
                </div>

                {/* Características Clave */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-200">
                      Características Técnicas Clave (1 por línea):
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCustomCharacteristics((prev) => (prev ? `${prev}\n• ` : '• '))}
                        className="text-[10px] text-cyan-300 hover:text-cyan-100 bg-cyan-950/60 hover:bg-cyan-900 border border-cyan-700/50 px-1.5 py-0.5 rounded cursor-pointer transition"
                        title="Añadir viñeta"
                      >
                        + Viñeta
                      </button>
                      <span className="text-[10px] text-cyan-300">Hoja 1 y 2</span>
                      <CharCounter current={customCharacteristics.length} max={SHEET_FIELD_LIMITS.characteristics} />
                    </div>
                  </div>
                  <textarea
                    rows={6}
                    maxLength={SHEET_FIELD_LIMITS.characteristics}
                    placeholder="• Una característica por cada línea...&#10;• Dimensiones adaptadas para uso hospitalario&#10;• Material de alta resistencia a la corrosión"
                    value={customCharacteristics}
                    onChange={(e) => setCustomCharacteristics(e.target.value)}
                    className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 outline-none font-mono text-[11px] leading-relaxed"
                  />
                </div>

                {/* Banner de Ayuda y Sugerencias para Campos Fijos y Manuales */}
                <div className="bg-gradient-to-r from-[#0d1d33] via-[#122846] to-[#0d1d33] border border-cyan-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5 shadow-md">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0">
                      <Lightbulb className="w-4 h-4 text-cyan-300" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        Sugerencias para Campos Manuales y Fijos
                        <span className="text-[9px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-600/40 px-1.5 py-0.2 rounded">
                          Normativa INVIMA
                        </span>
                      </h4>
                      <p className="text-[10.5px] text-slate-300">
                        Sugerencias de material, protocolo y almacenamiento adaptadas para {productName || 'este equipo'}.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyAllEmptySuggestions}
                    className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow active:scale-95 shrink-0"
                    title="Rellenar los campos fijos vacíos con sugerencias biomédicas"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Sugerir campos vacíos</span>
                  </button>
                </div>

                {/* Material de Fabricación */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <label className="block text-xs font-bold text-slate-200">
                        Material de Fabricación:
                      </label>
                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-600/40 px-1.5 py-0.5 rounded shadow-xs" title="No se sobrescribe con la IA">
                        <Lock className="w-2.5 h-2.5" /> Fijo (Manual)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenSuggestionsField(openSuggestionsField === 'material' ? null : 'material');
                          setCustomDraftSuggestion('');
                        }}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition ${
                          openSuggestionsField === 'material'
                            ? 'bg-cyan-500 text-slate-950 shadow-md'
                            : 'text-cyan-300 hover:text-cyan-100 bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-600/50'
                        }`}
                        title="Ver o elegir sugerencias biomédicas para Material"
                      >
                        <Lightbulb className="w-3 h-3" />
                        <span>Sugerencias</span>
                      </button>
                    </div>
                    <CharCounter current={customMaterial.length} max={SHEET_FIELD_LIMITS.material} />
                  </div>

                  {/* Sugerencia rápida cuando el campo está vacío */}
                  {!customMaterial.trim() && effectiveSuggestions.material && (
                    <div className="mb-1.5 flex items-center justify-between gap-2 p-1.5 px-2 bg-cyan-950/40 border border-dashed border-cyan-500/40 rounded-lg text-xs">
                      <div className="flex items-center gap-1.5 text-cyan-200 truncate min-w-0">
                        <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
                        <span className="font-bold text-cyan-300 text-[10.5px] shrink-0">Sugerencia:</span>
                        <span className="truncate italic text-slate-300 text-[10.5px]">"{effectiveSuggestions.material}"</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleApplySingleSuggestion('material', effectiveSuggestions.material, false)}
                        className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[10px] px-2.5 py-0.5 rounded shadow shrink-0 cursor-pointer active:scale-95 transition"
                      >
                        Aplicar
                      </button>
                    </div>
                  )}

                  <textarea
                    rows={3}
                    maxLength={SHEET_FIELD_LIMITS.material}
                    placeholder="Material de fabricación certificado (ej: Acero Inoxidable Martensítico Alemán AISI 420 templado al calor)..."
                    value={customMaterial}
                    onChange={(e) => setCustomMaterial(e.target.value)}
                    className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-cyan-400 outline-none leading-relaxed"
                  />
                  {renderFieldSuggestionsBox('material', 'Material de Fabricación')}
                </div>

                {/* INVIMA & Área */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <label className="block text-xs font-bold text-slate-200">
                          Registro Sanitario INVIMA:
                        </label>
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-600/40 px-1.5 py-0.5 rounded shadow-xs" title="No se sobrescribe con la IA">
                          <Lock className="w-2.5 h-2.5" /> Fijo
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenSuggestionsField(openSuggestionsField === 'invima' ? null : 'invima');
                            setCustomDraftSuggestion('');
                          }}
                          className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5 cursor-pointer transition ${
                            openSuggestionsField === 'invima'
                              ? 'bg-cyan-500 text-slate-950'
                              : 'text-cyan-300 hover:text-cyan-100 bg-cyan-950/70 border border-cyan-600/50'
                          }`}
                          title="Sugerencias INVIMA"
                        >
                          <Lightbulb className="w-2.5 h-2.5" />
                          <span>Sugerir</span>
                        </button>
                      </div>
                      <CharCounter current={customInvima.length} max={SHEET_FIELD_LIMITS.invima} />
                    </div>

                    {!customInvima.trim() && effectiveSuggestions.invima && (
                      <div className="mb-1 flex items-center justify-between gap-1 p-1 px-1.5 bg-cyan-950/40 border border-dashed border-cyan-500/40 rounded text-[10px]">
                        <span className="truncate italic text-slate-300">{effectiveSuggestions.invima}</span>
                        <button
                          type="button"
                          onClick={() => handleApplySingleSuggestion('invima', effectiveSuggestions.invima, false)}
                          className="text-cyan-300 hover:text-cyan-100 font-bold underline shrink-0 cursor-pointer"
                        >
                          Usar
                        </button>
                      </div>
                    )}

                    <input
                      type="text"
                      maxLength={SHEET_FIELD_LIMITS.invima}
                      placeholder="Ej: 2024DM-0029361"
                      value={customInvima}
                      onChange={(e) => setCustomInvima(e.target.value)}
                      className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 focus:border-cyan-400 outline-none"
                    />
                    {renderFieldSuggestionsBox('invima', 'Registro Sanitario INVIMA')}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <label className="block text-xs font-bold text-slate-200">
                          Área / Servicio Hospitalario:
                        </label>
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-600/40 px-1.5 py-0.5 rounded shadow-xs" title="No se sobrescribe con la IA">
                          <Lock className="w-2.5 h-2.5" /> Fijo
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenSuggestionsField(openSuggestionsField === 'area' ? null : 'area');
                            setCustomDraftSuggestion('');
                          }}
                          className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5 cursor-pointer transition ${
                            openSuggestionsField === 'area'
                              ? 'bg-cyan-500 text-slate-950'
                              : 'text-cyan-300 hover:text-cyan-100 bg-cyan-950/70 border border-cyan-600/50'
                          }`}
                          title="Sugerencias de Área"
                        >
                          <Lightbulb className="w-2.5 h-2.5" />
                          <span>Sugerir</span>
                        </button>
                      </div>
                      <CharCounter current={customArea.length} max={SHEET_FIELD_LIMITS.area} />
                    </div>

                    {!customArea.trim() && effectiveSuggestions.area && (
                      <div className="mb-1 flex items-center justify-between gap-1 p-1 px-1.5 bg-cyan-950/40 border border-dashed border-cyan-500/40 rounded text-[10px]">
                        <span className="truncate italic text-slate-300">{effectiveSuggestions.area}</span>
                        <button
                          type="button"
                          onClick={() => handleApplySingleSuggestion('area', effectiveSuggestions.area, false)}
                          className="text-cyan-300 hover:text-cyan-100 font-bold underline shrink-0 cursor-pointer"
                        >
                          Usar
                        </button>
                      </div>
                    )}

                    <input
                      type="text"
                      maxLength={SHEET_FIELD_LIMITS.area}
                      placeholder="Ej: CENTRAL DE ESTERILIZACIÓN Y QUIRÓFANO"
                      value={customArea}
                      onChange={(e) => setCustomArea(e.target.value)}
                      className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-400 outline-none"
                    />
                    {renderFieldSuggestionsBox('area', 'Área / Servicio Hospitalario')}
                  </div>
                </div>

                {/* Esterilización & Almacenamiento */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <label className="block text-xs font-bold text-slate-200">
                          Protocolo de Esterilización:
                        </label>
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-600/40 px-1.5 py-0.5 rounded shadow-xs" title="No se sobrescribe con la IA">
                          <Lock className="w-2.5 h-2.5" /> Fijo
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenSuggestionsField(openSuggestionsField === 'sterilization' ? null : 'sterilization');
                            setCustomDraftSuggestion('');
                          }}
                          className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5 cursor-pointer transition ${
                            openSuggestionsField === 'sterilization'
                              ? 'bg-cyan-500 text-slate-950'
                              : 'text-cyan-300 hover:text-cyan-100 bg-cyan-950/70 border border-cyan-600/50'
                          }`}
                          title="Sugerencias de Esterilización"
                        >
                          <Lightbulb className="w-2.5 h-2.5" />
                          <span>Sugerir</span>
                        </button>
                      </div>
                      <CharCounter current={customSterilization.length} max={SHEET_FIELD_LIMITS.sterilization} />
                    </div>

                    {!customSterilization.trim() && effectiveSuggestions.sterilization && (
                      <div className="mb-1.5 flex items-center justify-between gap-1 p-1 px-1.5 bg-cyan-950/40 border border-dashed border-cyan-500/40 rounded text-[10px]">
                        <span className="truncate italic text-slate-300">{effectiveSuggestions.sterilization}</span>
                        <button
                          type="button"
                          onClick={() => handleApplySingleSuggestion('sterilization', effectiveSuggestions.sterilization, false)}
                          className="text-cyan-300 hover:text-cyan-100 font-bold underline shrink-0 cursor-pointer"
                        >
                          Usar
                        </button>
                      </div>
                    )}

                    <textarea
                      rows={3}
                      maxLength={SHEET_FIELD_LIMITS.sterilization}
                      placeholder="Protocolo de lavado, desinfección y autoclave a vapor..."
                      value={customSterilization}
                      onChange={(e) => setCustomSterilization(e.target.value)}
                      className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl p-2 text-xs text-slate-100 focus:border-cyan-400 outline-none leading-relaxed"
                    />
                    {renderFieldSuggestionsBox('sterilization', 'Protocolo de Esterilización')}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <label className="block text-xs font-bold text-slate-200">
                          Condiciones de Almacenamiento:
                        </label>
                        <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-600/40 px-1.5 py-0.5 rounded shadow-xs" title="No se sobrescribe con la IA">
                          <Lock className="w-2.5 h-2.5" /> Fijo
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenSuggestionsField(openSuggestionsField === 'storage' ? null : 'storage');
                            setCustomDraftSuggestion('');
                          }}
                          className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded flex items-center gap-0.5 cursor-pointer transition ${
                            openSuggestionsField === 'storage'
                              ? 'bg-cyan-500 text-slate-950'
                              : 'text-cyan-300 hover:text-cyan-100 bg-cyan-950/70 border border-cyan-600/50'
                          }`}
                          title="Sugerencias de Almacenamiento"
                        >
                          <Lightbulb className="w-2.5 h-2.5" />
                          <span>Sugerir</span>
                        </button>
                      </div>
                      <CharCounter current={customStorage.length} max={SHEET_FIELD_LIMITS.storage} />
                    </div>

                    {!customStorage.trim() && effectiveSuggestions.storage && (
                      <div className="mb-1.5 flex items-center justify-between gap-1 p-1 px-1.5 bg-cyan-950/40 border border-dashed border-cyan-500/40 rounded text-[10px]">
                        <span className="truncate italic text-slate-300">{effectiveSuggestions.storage}</span>
                        <button
                          type="button"
                          onClick={() => handleApplySingleSuggestion('storage', effectiveSuggestions.storage, false)}
                          className="text-cyan-300 hover:text-cyan-100 font-bold underline shrink-0 cursor-pointer"
                        >
                          Usar
                        </button>
                      </div>
                    )}

                    <textarea
                      rows={3}
                      maxLength={SHEET_FIELD_LIMITS.storage}
                      placeholder="Temperatura (15°C a 25°C), humedad < 65%, protección contra polvo y luz..."
                      value={customStorage}
                      onChange={(e) => setCustomStorage(e.target.value)}
                      className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl p-2 text-xs text-slate-100 focus:border-cyan-400 outline-none leading-relaxed"
                    />
                    {renderFieldSuggestionsBox('storage', 'Condiciones de Almacenamiento')}
                  </div>
                </div>

                {/* Garantía */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <label className="block text-xs font-bold text-slate-200">
                        Garantía del Producto:
                      </label>
                      <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-600/40 px-1.5 py-0.5 rounded shadow-xs" title="No se sobrescribe con la IA">
                        <Lock className="w-2.5 h-2.5" /> Fijo (Manual)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenSuggestionsField(openSuggestionsField === 'warranty' ? null : 'warranty');
                          setCustomDraftSuggestion('');
                        }}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer transition ${
                          openSuggestionsField === 'warranty'
                            ? 'bg-cyan-500 text-slate-950 shadow-md'
                            : 'text-cyan-300 hover:text-cyan-100 bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-600/50'
                        }`}
                        title="Sugerencias de Garantía"
                      >
                        <Lightbulb className="w-3 h-3" />
                        <span>Sugerencias</span>
                      </button>
                    </div>
                    <CharCounter current={customWarranty.length} max={SHEET_FIELD_LIMITS.warranty} />
                  </div>

                  {!customWarranty.trim() && effectiveSuggestions.warranty && (
                    <div className="mb-1.5 flex items-center justify-between gap-1 p-1 px-2 bg-cyan-950/40 border border-dashed border-cyan-500/40 rounded text-xs">
                      <span className="truncate italic text-slate-300">{effectiveSuggestions.warranty}</span>
                      <button
                        type="button"
                        onClick={() => handleApplySingleSuggestion('warranty', effectiveSuggestions.warranty, false)}
                        className="text-cyan-300 hover:text-cyan-100 font-bold underline shrink-0 cursor-pointer"
                      >
                        Usar sugerencia
                      </button>
                    </div>
                  )}

                  <input
                    type="text"
                    maxLength={SHEET_FIELD_LIMITS.warranty}
                    placeholder="Ej: 5 años contra defectos de fabricación en acero quirúrgico"
                    value={customWarranty}
                    onChange={(e) => setCustomWarranty(e.target.value)}
                    className="w-full bg-[#15253d] border border-[#334d6e] rounded-xl px-3 py-2 text-xs text-white focus:border-cyan-400 outline-none"
                  />
                  {renderFieldSuggestionsBox('warranty', 'Garantía del Producto')}
                </div>

                {/* Tabla de Referencias y Medidas */}
                <div className="pt-2 border-t border-[#334d6e]">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="block text-xs font-bold text-slate-200">
                          Tabla de Medidas de la Pieza y Especificaciones (Hoja 2):
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsMeasurementSuggestionsOpen(!isMeasurementSuggestionsOpen)}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer transition shadow-xs ${
                            isMeasurementSuggestionsOpen
                              ? 'bg-cyan-500 text-slate-950 font-black ring-1 ring-cyan-300'
                              : 'text-cyan-300 hover:text-cyan-100 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50'
                          }`}
                          title="Explorar múltiples sugerencias de medidas hospitalarias y quirúrgicas"
                        >
                          <Lightbulb className="w-3 h-3 text-amber-300" />
                          <span>Sugerencias de Medidas ({BIOMEDICAL_MEASUREMENT_PRESETS.reduce((acc, g) => acc + g.items.length, 0) + effectiveRecommendedMeasurements.length})</span>
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Medidas físicas reales de la pieza (ej: 14.5 cm Curva, 18 cm, 35x25 cm) y uso clínico
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAddReferenceRow}
                        className="text-cyan-400 hover:text-cyan-300 text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5" /> Añadir Medida
                      </button>
                    </div>
                  </div>

                  {/* Panel Interactivo de Múltiples Sugerencias de Medidas */}
                  {isMeasurementSuggestionsOpen && (
                    <div className="mb-3 p-3 bg-[#0d1a2d] border border-cyan-500/40 rounded-xl space-y-3 shadow-lg">
                      <div className="flex items-center justify-between border-b border-[#223854] pb-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
                          <Lightbulb className="w-4 h-4 text-amber-400" />
                          <span>Catálogo de Sugerencias de Medidas y Especificaciones</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsMeasurementSuggestionsOpen(false)}
                          className="text-slate-400 hover:text-white p-1 rounded cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Categorías / Pestañas de medidas */}
                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
                        <button
                          type="button"
                          onClick={() => setMeasurementActiveCategory('recommended')}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0 cursor-pointer transition ${
                            measurementActiveCategory === 'recommended'
                              ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                              : 'bg-[#15253d] text-slate-300 hover:text-white border border-[#2d4769]'
                          }`}
                        >
                          ⭐ Recomendadas ({effectiveRecommendedMeasurements.length})
                        </button>
                        {BIOMEDICAL_MEASUREMENT_PRESETS.map((grp) => (
                          <button
                            key={grp.id}
                            type="button"
                            onClick={() => setMeasurementActiveCategory(grp.id)}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0 cursor-pointer transition ${
                              measurementActiveCategory === grp.id
                                ? 'bg-cyan-500 text-slate-950 shadow-md font-black'
                                : 'bg-[#15253d] text-slate-300 hover:text-white border border-[#2d4769]'
                            }`}
                          >
                            {grp.shortLabel} ({grp.items.length})
                          </button>
                        ))}
                      </div>

                      {/* Medidas de la categoría seleccionada */}
                      {(() => {
                        const isRec = measurementActiveCategory === 'recommended';
                        const activeGroup = BIOMEDICAL_MEASUREMENT_PRESETS.find((g) => g.id === measurementActiveCategory);
                        const itemsToShow = isRec
                          ? effectiveRecommendedMeasurements
                          : activeGroup?.items || [];
                        const categoryTitle = isRec
                          ? `Medidas recomendadas para ${productName.trim() || 'este equipo'}`
                          : activeGroup?.category || '';

                        return (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
                              <span className="truncate">{categoryTitle}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleLoadMeasurementPreset(itemsToShow, true)}
                                  className="text-[10px] bg-cyan-950/90 hover:bg-cyan-900 text-cyan-300 border border-cyan-600/50 px-2 py-0.5 rounded cursor-pointer transition"
                                  title="Reemplaza toda la tabla con estas medidas"
                                >
                                  Cargar paquete (Reemplazar)
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleLoadMeasurementPreset(itemsToShow, false)}
                                  className="text-[10px] bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 border border-emerald-600/50 px-2 py-0.5 rounded cursor-pointer transition"
                                  title="Añade estas medidas al final de la tabla actual"
                                >
                                  + Añadir todas
                                </button>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                              {itemsToShow.map((item, itIdx) => (
                                <div
                                  key={itIdx}
                                  className="p-2 rounded-lg bg-[#142339] border border-[#263e5e] hover:border-cyan-500/60 flex items-start justify-between gap-2 transition group"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                      <span className="text-xs font-bold text-cyan-300 truncate font-mono">
                                        {item.code}
                                      </span>
                                      {(item as any).badge && (
                                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-600/40 shrink-0 font-sans font-medium">
                                          {(item as any).badge}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-slate-400 line-clamp-2 leading-snug">
                                      {item.dimension}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleApplySingleMeasurement(item)}
                                    className="text-[10px] font-bold bg-cyan-500/20 hover:bg-cyan-500 hover:text-slate-950 text-cyan-300 px-2 py-1 rounded transition shrink-0 cursor-pointer self-center"
                                    title="Añadir a la tabla de medidas"
                                  >
                                    + Usar
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Input rápido para medida personalizada */}
                      <div className="pt-2 border-t border-[#223854]">
                        <span className="block text-[10px] font-bold text-slate-400 mb-1">
                          Añadir tu propia sugerencia a la tabla:
                        </span>
                        <div className="flex flex-col sm:flex-row gap-1.5">
                          <input
                            type="text"
                            placeholder="Medida (ej: 16.0 cm Curva)"
                            maxLength={SHEET_FIELD_LIMITS.tableCode}
                            value={customDraftCode}
                            onChange={(e) => setCustomDraftCode(e.target.value)}
                            className="sm:w-1/3 bg-[#15253d] border border-[#334d6e] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Uso / Aplicación clínica..."
                            maxLength={SHEET_FIELD_LIMITS.tableDimension}
                            value={customDraftDim}
                            onChange={(e) => setCustomDraftDim(e.target.value)}
                            className="flex-1 bg-[#15253d] border border-[#334d6e] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 outline-none"
                          />
                          <button
                            type="button"
                            disabled={!customDraftCode.trim()}
                            onClick={() => {
                              if (customDraftCode.trim()) {
                                handleApplySingleMeasurement({
                                  code: customDraftCode,
                                  dimension: customDraftDim,
                                });
                                setCustomDraftCode('');
                                setCustomDraftDim('');
                              }
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer transition shrink-0"
                          >
                            + Añadir
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Barra de Sugerencias Rápidas Dinámicas (Extraídas de modelo, descripción y rango clínico) */}
                  {effectiveRecommendedMeasurements.length > 0 && (
                    <div className="mb-2.5 p-2 bg-[#0c182b] border border-cyan-500/30 rounded-xl space-y-1.5 shadow-md">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-cyan-300">
                          <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                          <span>Sugerencias inteligentes (Modelo / Descripción / Rango):</span>
                          <span className="text-[10px] font-mono bg-cyan-950 text-cyan-400 px-1.5 py-0.2 rounded border border-cyan-800/60 font-normal">
                            {effectiveRecommendedMeasurements.length} disponibles
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleLoadMeasurementPreset(effectiveRecommendedMeasurements.slice(0, 4), false)}
                            className="text-[10px] font-bold text-emerald-300 hover:text-emerald-200 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/50 px-2 py-0.5 rounded cursor-pointer transition flex items-center gap-1"
                            title="Añade las 4 medidas principales a la tabla"
                          >
                            <Plus className="w-3 h-3" /> Cargar Rango (4 medidas)
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsMeasurementSuggestionsOpen(!isMeasurementSuggestionsOpen)}
                            className="text-[10px] text-slate-300 hover:text-cyan-300 underline underline-offset-2 px-1 cursor-pointer"
                          >
                            {isMeasurementSuggestionsOpen ? 'Ocultar catálogo' : 'Ver todas'}
                          </button>
                        </div>
                      </div>

                      {/* Chips de un solo clic */}
                      <div className="flex flex-wrap items-center gap-1 pt-0.5">
                        {effectiveRecommendedMeasurements.slice(0, 8).map((sug, sIdx) => {
                          const isAlreadyInTable = referenceRows.some(
                            (r) => r.code.trim().toLowerCase() === sug.code.trim().toLowerCase()
                          );
                          return (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => {
                                const emptyIdx = referenceRows.findIndex((r) => !r.code.trim());
                                if (emptyIdx >= 0) {
                                  handleApplySingleMeasurement(sug, emptyIdx);
                                } else {
                                  handleApplySingleMeasurement(sug);
                                }
                              }}
                              disabled={isAlreadyInTable}
                              className={`group inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-lg border transition cursor-pointer ${
                                isAlreadyInTable
                                  ? 'bg-slate-800/40 text-slate-500 border-slate-700/40 cursor-not-allowed'
                                  : sug.isExact
                                  ? 'bg-amber-950/70 hover:bg-amber-900 text-amber-200 hover:text-amber-100 border-amber-500/50 shadow-sm'
                                  : 'bg-[#15273f] hover:bg-cyan-950 text-cyan-300 hover:text-cyan-100 border-[#2f4a6e] hover:border-cyan-400/60'
                              }`}
                              title={`${sug.dimension} ${isAlreadyInTable ? '(Ya está en la tabla)' : '(Clic para añadir a la tabla)'}`}
                            >
                              <span className="font-bold">{isAlreadyInTable ? '✓' : '+'}</span>
                              <span className="truncate max-w-[160px]">{sug.code}</span>
                              {sug.isExact && (
                                <span className="text-[9px] text-amber-400 font-sans font-bold">★</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Estado vacío con llamada a la acción */}
                  {referenceRows.length === 0 && (
                    <div className="p-3 mb-2 bg-[#142339]/80 border border-dashed border-cyan-500/40 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
                      <div className="text-xs text-slate-300">
                        <span className="font-bold text-cyan-300">Tabla vacía:</span> Carga las medidas recomendadas para {productName.trim() || 'tu equipo'} o abre las sugerencias.
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleLoadMeasurementPreset(effectiveRecommendedMeasurements, true)}
                          className="text-[11px] font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-3 py-1 rounded-lg transition cursor-pointer"
                        >
                          Cargar Recomendadas
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsMeasurementSuggestionsOpen(true)}
                          className="text-[11px] font-bold bg-[#1e3455] hover:bg-[#25426e] text-cyan-300 border border-[#334d6e] px-2.5 py-1 rounded-lg transition cursor-pointer"
                        >
                          Ver Todas
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-400 px-1 mb-1">
                    <span className="col-span-5 text-cyan-300">Medida (máx. {SHEET_FIELD_LIMITS.tableCode})</span>
                    <span className="col-span-6 text-slate-300">Descripción (máx. {SHEET_FIELD_LIMITS.tableDimension})</span>
                    <span className="col-span-1 text-center"></span>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {referenceRows.map((row, idx) => (
                      <div key={idx} className="relative">
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <div className="col-span-5 relative flex items-center">
                            <input
                              type="text"
                              maxLength={SHEET_FIELD_LIMITS.tableCode}
                              placeholder="Ej: 14.5 cm (Curva)"
                              value={row.code}
                              onChange={(e) => handleUpdateReferenceRow(idx, 'code', e.target.value)}
                              className="w-full bg-[#15253d] border border-[#334d6e] rounded-lg pl-2.5 pr-7 py-1.5 text-xs text-white font-medium focus:border-cyan-400 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setRowPickerOpenIndex(rowPickerOpenIndex === idx ? null : idx)}
                              className="absolute right-1 text-slate-400 hover:text-amber-300 p-1 cursor-pointer"
                              title="Sugerir medida para esta fila"
                            >
                              <Lightbulb className="w-3 h-3" />
                            </button>
                          </div>
                          <input
                            type="text"
                            maxLength={SHEET_FIELD_LIMITS.tableDimension}
                            placeholder="Ej: Disección tisular fina superficial"
                            value={row.dimension}
                            onChange={(e) => handleUpdateReferenceRow(idx, 'dimension', e.target.value)}
                            className="col-span-6 bg-[#15253d] border border-[#334d6e] rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveReferenceRow(idx)}
                            className="col-span-1 text-slate-400 hover:text-rose-400 p-1 flex items-center justify-center cursor-pointer"
                            title="Eliminar fila"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Mini-picker contextual para la fila específica */}
                        {rowPickerOpenIndex === idx && (
                          <div className="mt-1.5 p-2.5 bg-[#091424] border border-amber-500/50 rounded-xl shadow-2xl z-30 space-y-2 animate-fadeIn">
                            <div className="flex items-center justify-between text-[11px] font-bold text-amber-300 pb-1.5 border-b border-[#1e3455]">
                              <div className="flex items-center gap-1.5">
                                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                                <span>Sugerencias para fila #{idx + 1} {row.code ? `(actual: "${row.code}")` : ''}:</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setRowPickerOpenIndex(null)}
                                className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto pr-1">
                              {effectiveRecommendedMeasurements.map((preset, pIdx) => {
                                const isExact = preset.isExact || preset.category === 'detected';
                                return (
                                  <div
                                    key={pIdx}
                                    className={`p-2 rounded-lg border transition text-left flex flex-col justify-between gap-1.5 ${
                                      isExact
                                        ? 'bg-[#13233b] border-amber-500/50 hover:border-amber-400'
                                        : 'bg-[#0f1d30] border-[#223854] hover:border-cyan-400/50'
                                    }`}
                                  >
                                    <div>
                                      <div className="flex items-center justify-between gap-1 mb-0.5">
                                        <span className="text-xs font-bold text-cyan-300 font-mono truncate">{preset.code}</span>
                                        {preset.badge && (
                                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-600/40 shrink-0 font-sans">
                                            {preset.badge}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[10px] text-slate-300 line-clamp-2 leading-tight">
                                        {preset.dimension}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1 pt-1 border-t border-[#1c324e]">
                                      <button
                                        type="button"
                                        onClick={() => handleApplySingleMeasurement(preset, idx)}
                                        className="flex-1 text-[10px] font-bold bg-cyan-600 hover:bg-cyan-500 text-white px-2 py-1 rounded cursor-pointer transition text-center"
                                        title="Reemplaza esta fila con esta medida"
                                      >
                                        ✓ Usar en fila #{idx + 1}
                                      </button>
                                      {referenceRows.length < 8 && (
                                        <button
                                          type="button"
                                          onClick={() => handleApplySingleMeasurement(preset)}
                                          className="text-[10px] font-bold bg-[#1b2e49] hover:bg-[#254167] text-cyan-300 border border-[#335077] px-2 py-1 rounded cursor-pointer transition"
                                          title="Añadir como nueva fila adicional"
                                        >
                                          + Nueva fila
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons Bar */}
          <div className="bg-[#192b45] border border-[#334d6e] rounded-2xl p-4 shadow-md flex flex-wrap items-center gap-3">
            {/* Guardar Ficha Técnica (Reemplaza Guardar en Ventana 7) */}
            <button
              type="button"
              onClick={handleSaveToDocumentation}
              disabled={isGeneratingPdf || !productName.trim()}
              className="flex-1 min-w-[240px] inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm px-6 py-3.5 rounded-xl shadow-lg shadow-emerald-600/30 transition cursor-pointer active:scale-95 disabled:opacity-50"
              title="Guardar y archivar la Ficha Técnica"
            >
              <Save className="w-4 h-4 shrink-0" />
              <span>Guardar Ficha Técnica</span>
            </button>

            {/* Pantalla Completa Modal Preview */}
            <button
              type="button"
              onClick={() => setIsPreviewModalOpen(true)}
              className="inline-flex items-center gap-2 bg-[#1e3455] hover:bg-[#25426e] text-cyan-300 hover:text-white border border-[#334d6e] hover:border-cyan-500 font-bold text-xs px-4 py-3.5 rounded-xl transition cursor-pointer active:scale-95"
              title="Abrir vista previa interactiva en pantalla completa"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Pantalla Completa</span>
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* RIGHT COLUMN: Real Live WYSIWYG Technical Sheet (6 cols on large)   */}
        {/* =================================================================== */}
        <div className={`space-y-4 ${mobileTab === 'editor' ? 'hidden lg:block' : 'block'} lg:col-span-6`}>
          <div className="sticky top-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <h3 className="text-xs font-black text-white uppercase tracking-wider">
                  Previsualización en Tiempo Real
                </h3>
              </div>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Actualización Inmediata
              </span>
            </div>

            {/* The Live Interactive Canvas Component */}
            <div className="h-[800px]">
              <LiveTechnicalSheetPreview
                data={finalSheetData}
                onDownloadPdf={handleDownloadPdf}
                onPrint={handlePrintPdf}
                compactMode={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* FULLSCREEN MODAL: LIVE PREVIEW (Guaranteed 100% Rendering)          */}
      {/* =================================================================== */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
          <div className="bg-[#0f1b2d] border border-[#334d6e] rounded-2xl w-full max-w-6xl h-[94vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="bg-[#15253d] border-b border-[#334d6e] px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span>Ficha Técnica Oficial: {productName}</span>
                    <span className="text-[10px] font-bold text-sky-400 bg-sky-500/15 px-2 py-0.5 rounded-full border border-sky-500/30">
                      {brand} • {model}
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Previsualización de alta fidelidad con encabezado oficial, tablas, especificaciones y sellos técnicos.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-md"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Direct Live Preview */}
            <div className="flex-1 min-h-0">
              <LiveTechnicalSheetPreview
                data={finalSheetData}
                onDownloadPdf={handleDownloadPdf}
                onPrint={handlePrintPdf}
                compactMode={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: BÚSQUEDA DE FOTOGRAFÍAS EN INTERNET                          */}
      {/* =================================================================== */}
      {isImageSearchModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          <div className="bg-[#0f1b2d] border border-[#334d6e] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="bg-[#15253d] border-b border-[#334d6e] px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  <Globe className="w-4 h-4 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    <span>Buscar Fotografía en Internet</span>
                    {productName && (
                      <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/15 px-2 py-0.5 rounded-full border border-cyan-500/30 hidden sm:inline-block">
                        {productName}
                      </span>
                    )}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Búsqueda web en vivo de imágenes reales de producto para la ficha técnica
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsImageSearchModalOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input Bar inside Modal */}
            <div className="bg-[#122238] border-b border-[#2b4160] p-3.5 space-y-2">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSearchInternetImages(imageSearchQuery);
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={imageSearchQuery}
                    onChange={(e) => setImageSearchQuery(e.target.value)}
                    placeholder="Escribe el nombre del instrumental o equipo (ej: Pinza disección sin garra, Tijera Metzenbaum)..."
                    className="w-full bg-[#0d1827] border border-[#2b4160] rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white font-medium placeholder-slate-500 focus:border-cyan-400 outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearchingImages || !imageSearchQuery.trim()}
                  className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 transition cursor-pointer disabled:opacity-40 shrink-0"
                >
                  {isSearchingImages ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>Buscar</span>
                </button>
              </form>

              {/* Quick Search Suggestion Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[10px] text-slate-300 no-scrollbar">
                <span className="text-slate-500 font-bold shrink-0">Sugerencias rápidas:</span>
                {productName.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      setImageSearchQuery(productName.trim());
                      handleSearchInternetImages(productName.trim());
                    }}
                    className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-full shrink-0 font-bold transition cursor-pointer"
                  >
                    🎯 {productName.trim()}
                  </button>
                )}
                {[
                  'Pinza Babcock',
                  'Pinza de disección sin garra',
                  'Pinza de disección con garra',
                  'Pinza Adson',
                  'Pinza Kelly curva',
                  'Tijera Metzenbaum curva',
                  'Mango de bisturí',
                  'Monitor de signos vitales',
                  'Electrobisturí',
                ].map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => {
                      setImageSearchQuery(sug);
                      handleSearchInternetImages(sug);
                    }}
                    className="bg-[#1a2c47] hover:bg-[#233a5e] border border-[#2b4468] hover:border-cyan-500/50 text-slate-300 hover:text-white px-2 py-0.5 rounded-full shrink-0 transition cursor-pointer"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Body: Image Grid */}
            <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
              {isSearchingImages ? (
                <div className="h-64 flex flex-col items-center justify-center text-center space-y-3">
                  <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
                  <div className="text-xs text-slate-300 font-bold">
                    Buscando fotografías en internet para "{imageSearchQuery}"...
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-sm">
                    Consultando motores de búsqueda web y repositorios médicos para encontrar las mejores imágenes del producto.
                  </p>
                </div>
              ) : imageSearchResults.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {imageSearchResults.map((img, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleSelectInternetImage(img)}
                      className="group relative bg-[#132237] border border-[#253952] hover:border-cyan-400 rounded-xl overflow-hidden cursor-pointer transition shadow-md flex flex-col justify-between"
                    >
                      <div className="relative aspect-square w-full bg-slate-950/60 p-2 flex items-center justify-center overflow-hidden">
                        <img
                          src={img.thumbnail || img.url}
                          alt={img.title || 'Producto'}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            // If thumbnail fails, try original URL or hide
                            const target = e.currentTarget;
                            if (img.url && target.src !== img.url) {
                              target.src = img.url;
                            } else {
                              target.style.opacity = '0.3';
                            }
                          }}
                          className="max-w-full max-h-full object-contain group-hover:scale-105 transition duration-200"
                        />
                        {isProxyingImage === img.url && (
                          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-2 text-center">
                            <Loader2 className="w-6 h-6 animate-spin text-cyan-400 mb-1" />
                            <span className="text-[10px] text-cyan-300 font-bold">Optimizando imagen...</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-2">
                          <button
                            type="button"
                            className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-[11px] py-1.5 rounded-lg shadow transition"
                          >
                            Usar esta Fotografía
                          </button>
                        </div>
                      </div>
                      <div className="p-2 border-t border-[#1e3149] bg-[#0e1929]">
                        <p className="text-[10px] text-slate-300 font-medium line-clamp-1" title={img.title}>
                          {img.title || 'Imagen de producto'}
                        </p>
                        <div className="flex items-center justify-between text-[9px] text-slate-500 mt-0.5">
                          <span>{img.source || 'Web'}</span>
                          {img.width && img.height && <span>{img.width}x{img.height}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-slate-400">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div className="text-xs text-slate-300 font-bold">
                    No se encontraron imágenes para "{imageSearchQuery}"
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-sm">
                    Intenta cambiar o simplificar los términos de búsqueda en la barra superior (por ejemplo, usa sólo el nombre común o la marca).
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-[#15253d] border-t border-[#334d6e] px-4 py-3 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span>La imagen seleccionada se optimiza automáticamente en Base64 para el PDF oficial y vista previa.</span>
              </span>
              <button
                type="button"
                onClick={() => setIsImageSearchModalOpen(false)}
                className="bg-[#1f3350] hover:bg-[#284268] text-slate-300 hover:text-white text-xs font-bold px-3.5 py-1.5 rounded-xl transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
