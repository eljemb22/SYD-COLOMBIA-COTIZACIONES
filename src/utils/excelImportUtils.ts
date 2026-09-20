import * as XLSX from 'xlsx';
import {
  TenderItem,
  TechnicalRequirement,
  MedicalEquipment,
  TenderClientProject,
  MarginListKey,
  SupplierPriceQuote,
  ProductGroup,
} from '../types';
import { getLiveDraftingAdvice, getGenericSpecificationsForEquipment } from './specOptimizer';
import {
  isSupplierRegisteredInDirectory,
  matchSupplierInDirectory,
} from './ocTrackingStorage';
import { SupplierProfile } from '../types';
import {
  detectProductGroup,
  auditProductGroups,
  ProductGroupsAuditResult,
} from './productGroupUtils';
import { MASTER_EQUIPMENTS_CATALOG } from '../data/masterEquipmentsCatalog';

export interface DetectedSupplierInFile {
  supplier: string;
  brand: string;
  name: string;
  model: string;
  isNewInDirectory: boolean;
  excelRowNumbers: number[];
}

export interface UnifiedEquipmentDetail {
  key: string;
  code: string;
  name: string;
  brand: string;
  model: string;
  category: MedicalEquipment['category'];
  supplier: string;
  allSuppliers: string[];
  newSuppliers: string[];
  baseCostCOP: number;
  supplierPrices?: SupplierPriceQuote[];
  excelRowNumbers: number[]; // 1-based original Excel rows e.g. [2, 5, 8]
  unifiedCount: number;
  reason: string;
  summary: string;
  mergedAccessoriesCount: number;
}

export interface ParsedCatalogEquipmentsResult {
  rows: ParsedCatalogEquipmentRow[];
  unifiedDuplicates: UnifiedEquipmentDetail[];
  allDetectedSuppliers: DetectedSupplierInFile[];
  totalExcelRowsRead: number;
  productGroupsAudit: ProductGroupsAuditResult;
}

export interface ParsedCatalogEquipmentRow {
  code: string;
  name: string;
  brand: string;
  productGroup: ProductGroup;
  supplier: string;
  allSuppliersFound?: string[];
  alternateSuppliers?: string[];
  newSuppliersDetected?: string[];
  supplierPrices?: SupplierPriceQuote[];
  model: string;
  category: MedicalEquipment['category'];
  baseCostCOP: number;
  defaultMarginList: MarginListKey;
  invimaRecordNumber: string;
  warrantyMonths: number;
  originCountry: string;
  taxExempt: boolean;
  taxRate: number;
  description: string;
  technicalSpecs: string[];
  standardAccessories: { name: string; costCOP: number; included: boolean }[];
  isExistingMatch: boolean;
  matchedEquipmentId?: string;
  importAction?: 'update' | 'create_new';
  isDuplicateInFile?: boolean;
  duplicateOfIndex?: number;
  isUnified?: boolean;
  unifiedExcelRows?: number[];
  unifiedCount?: number;
  isSupplierInDirectory?: boolean;
  supplierMatchStatus?: 'exact' | 'suggested' | 'none';
  suggestedSupplierName?: string;
  suggestedSupplierProfile?: SupplierProfile;
  validationIssues?: string[];
}

export interface ParsedTenderEquipmentRow {
  code: string;
  name: string;
  brand: string;
  model: string;
  category?: string;
  quantity: number;
  offeredUnitPrice: number;
  unitEstimatedBudget?: number; // Precio Tope / Presupuesto Unitario Oficial
  baseCostCOP?: number;
  defaultMarginList?: string;
  invimaRecord: string;
  warrantyMonths: number;
  deliveryTimeDays: number;
  originCountry: string;
  specificationsText: string;
  observations: string;
  matchedCatalogEquipment?: MedicalEquipment;
  processNumberRef?: string;
  clientNameRef?: string;
}

export interface ParsedMasterContract {
  clientName: string;
  nit: string;
  processNumber: string;
  processType: string;
  city: string;
  contractObject: string;
  contactPerson: string;
  executionTerm: string;
  openingDate: string;
  closingDate: string;
  budgetCOP: number;
  status: 'Adjudicada' | 'En Preparación' | 'Presentada' | 'Desierta' | 'Cerrada';
  items: ParsedTenderEquipmentRow[];
}

/**
 * Downloads a clean, official Excel template for importing Contracts/Tenders (Ventana 4 - Tab 1)
 * Includes 9 columns with Valor Total del Contrato ($ COP):
 * 1. Nombre del Cliente
 * 2. NIT
 * 3. Número del Proceso
 * 4. Valor Total del Contrato ($ COP)
 * 5. Ciudad
 * 6. Modalidad de Proceso
 * 7. Objeto del Pliego
 * 8. Tiempo / Plazo
 * 9. Estado
 */
export function downloadTenderContractsTemplate() {
  const headers = [
    'Nombre del Cliente',
    'NIT',
    'Número del Proceso',
    'Valor Total del Contrato ($ COP)',
    'Ciudad',
    'Modalidad de Proceso',
    'Objeto del Pliego',
    'Tiempo / Plazo',
    'Estado',
  ];

  const sampleRows = [
    [
      'HOSPITAL UNIVERSITARIO SAN JOSÉ E.S.E.',
      '890.102.345-8',
      'LP-2026-042',
      350000000,
      'Bogotá D.C.',
      'Licitación Pública',
      'ADQUISICIÓN, INSTALACIÓN Y PUESTA EN MARCHA DE EQUIPAMIENTO BIOMÉDICO PARA UNIDAD DE CUIDADOS INTENSIVOS Y URGENCIAS',
      '60 días calendario',
      'Adjudicada',
    ],
    [
      'CLÍNICA METROPOLITANA DE OCCIDENTE',
      '900.554.890-1',
      'SAM-2026-019',
      185000000,
      'Cali',
      'Selección Abreviada',
      'DOTACIÓN DE EQUIPOS DE MONITOREO Y CIRUGÍA PARA SALAS DE PROCEDIMIENTOS',
      '45 días calendario',
      'En Preparación',
    ],
    [
      'ESE HOSPITAL DEPARTAMENTAL SAN VICENTE',
      '890.980.123-4',
      'MC-2026-088',
      92000000,
      'Medellín',
      'Mínima Cuantía',
      'SUMINISTRO DE ELECTROCARDIÓGRAFOS Y DESFIBRILADORES PARA ATENCIÓN BÁSICA',
      '30 días calendario',
      'Presentada',
    ],
    [
      'HOSPITAL REGIONAL DEL SUR E.S.E.',
      '800.234.567-9',
      'CD-2026-012',
      140000000,
      'Pasto',
      'Contratación Directa',
      'SUMINISTRO Y PUESTA EN FUNCIONAMIENTO DE BOMBAS DE INFUSIÓN Y MONITORES',
      '20 días calendario',
      'Adjudicada',
    ],
  ];

  const worksheetData = [headers, ...sampleRows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  worksheet['!cols'] = [
    { wch: 42 }, // Nombre del Cliente
    { wch: 18 }, // NIT
    { wch: 22 }, // Número del Proceso
    { wch: 30 }, // Valor Total del Contrato ($ COP)
    { wch: 18 }, // Ciudad
    { wch: 24 }, // Modalidad de Proceso
    { wch: 75 }, // Objeto del Pliego
    { wch: 24 }, // Tiempo / Plazo
    { wch: 18 }, // Estado
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Contratos_Licitaciones');

  XLSX.writeFile(workbook, 'Plantilla_Importar_Contratos.xlsx');
}

/**
 * Downloads a clean Excel template for importing Equipments and Technical Specifications (Ventana 4 - Tab 2)
 * Supports dynamic column for 'Precio Tope / Techo Unitario ($ COP)' when enabled by the user.
 */
export function downloadTenderEquipmentSpecsTemplate(options?: { includeCeilingPrice?: boolean }) {
  const includeCeilingPrice = options?.includeCeilingPrice !== false;

  const headers = includeCeilingPrice
    ? ['Nombre del Equipo', 'Cantidad', 'Precio Tope Unitario ($ COP)', 'Especificaciones Técnicas']
    : ['Nombre del Equipo', 'Cantidad', 'Especificaciones Técnicas'];

  const sampleRows = includeCeilingPrice
    ? [
        // Equipo 1: Monitor de signos vitales con precio tope
        [
          'Monitor de signos vitales',
          2,
          28000000,
          '1. Pantalla TFT a color de 10"\n2. Formas de 12 ondas simultáneas en pantalla\n3. Batería recargable con autonomía de 6 horas\n4. SpO2 de 0 a 100%',
        ],
        // Equipo 2: Desfibrilador bifásico
        [
          'Desfibrilador bifásico con marcapasos y monitor',
          1,
          42000000,
          '1. Tecnología de onda bifásica hasta 360 Joules\n2. Tiempo de carga a 200J menor a 3 segundos\n3. Modo de desfibrilación manual, sincronizada y DEA en español\n4. Marcapasos no invasivo transcutáneo fijo y a demanda\n5. Paletas externas adulto/pediátrico intercambiables\n6. Registrador térmico integrado de 3 canales',
        ],
        // Equipo 3: Electrocardiógrafo digital
        [
          'Electrocardiógrafo digital de 12 canales',
          3,
          14500000,
          '1. Pantalla LCD a color de 7 pulgadas\n2. Registro simultáneo de 12 derivaciones\n3. Interpretación diagnóstica automática de arritmias\n4. Memoria interna para más de 500 pacientes\n5. Puertos USB y exportación directa en PDF/DICOM',
        ],
        // Equipos estándar
        ['Bomba de infusión volumétrica peristáltica', 6, 8500000, ''],
        ['Cama hospitalaria eléctrica de 4 planos', 8, 12000000, ''],
      ]
    : [
        // Standard 3 columns without price cap
        [
          'Monitor de signos vitales',
          2,
          '1. Pantalla TFT a color de 10"\n2. Formas de 12 ondas simultáneas en pantalla\n3. Batería recargable con autonomía de 6 horas\n4. SpO2 de 0 a 100%',
        ],
        [
          'Desfibrilador bifásico con marcapasos y monitor',
          1,
          '1. Tecnología de onda bifásica hasta 360 Joules\n2. Tiempo de carga a 200J menor a 3 segundos\n3. Modo de desfibrilación manual, sincronizada y DEA en español\n4. Marcapasos no invasivo transcutáneo fijo y a demanda\n5. Paletas externas adulto/pediátrico intercambiables\n6. Registrador térmico integrado de 3 canales',
        ],
        [
          'Electrocardiógrafo digital de 12 canales',
          3,
          '1. Pantalla LCD a color de 7 pulgadas\n2. Registro simultáneo de 12 derivaciones\n3. Interpretación diagnóstica automática de arritmias\n4. Memoria interna para más de 500 pacientes\n5. Puertos USB y exportación directa en PDF/DICOM',
        ],
        ['Bomba de infusión volumétrica peristáltica', 6, ''],
        ['Cama hospitalaria eléctrica de 4 planos', 8, ''],
      ];

  const worksheetData = [headers, ...sampleRows];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  worksheet['!cols'] = includeCeilingPrice
    ? [
        { wch: 45 }, // Nombre del Equipo
        { wch: 12 }, // Cantidad
        { wch: 30 }, // Precio Tope Unitario ($ COP)
        { wch: 85 }, // Especificaciones Técnicas
      ]
    : [
        { wch: 45 }, // Nombre del Equipo
        { wch: 14 }, // Cantidad
        { wch: 85 }, // Especificaciones Técnicas
      ];

  // Configurar altura de filas para que Excel visualice todas las líneas con espacio
  worksheet['!rows'] = [
    { hpt: 28 }, // Cabecera
    { hpt: 75 }, // Monitor de Signos Vitales (4 líneas)
    { hpt: 110 }, // Desfibrilador (6 líneas)
    { hpt: 95 }, // Electrocardiógrafo (5 líneas)
    { hpt: 26 }, // Bomba de infusión
    { hpt: 26 }, // Cama hospitalaria
  ];

  // Configurar alineación centrada verticalmente y ajuste de texto (wrap text) en todas las celdas
  Object.keys(worksheet).forEach((cellRef) => {
    if (cellRef.startsWith('!')) return;
    const cell = worksheet[cellRef];
    if (cell) {
      const isHeader = cellRef.endsWith('1');
      const isQuantityCol = cellRef.startsWith('B');
      cell.s = {
        font: isHeader ? { bold: true } : undefined,
        alignment: {
          vertical: 'center',
          horizontal: isHeader || isQuantityCol ? 'center' : 'left',
          wrapText: true,
        },
      };
    }
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Equipos_Especificaciones');

  XLSX.writeFile(workbook, 'Plantilla_Equipos_Especificaciones_Tecnicas.xlsx');
}

/**
 * Backward compatibility alias for equipment template
 */
export function downloadTenderEquipmentTemplate() {
  downloadTenderEquipmentSpecsTemplate();
}

/**
 * Downloads a Master 2-Sheet Excel template for importing entire Contracts/Tenders along with their associated Equipments
 */
export function downloadMasterContractTemplate() {
  downloadTenderContractsTemplate();
}

/**
 * Normalizes string keys for flexible Excel column mapping
 */
function normalizeHeaderKey(key: string): string {
  return key
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, ''); // alphanumeric only
}

/**
 * Highly robust extractor for INVIMA registration number across varied Excel headers, aliases and cell patterns
 */
export function extractInvimaValueFromRow(
  rowMap: Record<string, any>,
  rawRow: Record<string, any> = {}
): string {
  const invimaAliases = [
    'registroinvima',
    'registrosanitarioinvima',
    'registrosanitario',
    'reginvima',
    'regsanitario',
    'regsanitarioinvima',
    'invima',
    'noinvima',
    'nroinvima',
    'numinvima',
    'numeroinvima',
    'ninvima',
    'invimano',
    'invimanro',
    'invimanumero',
    'invimarecord',
    'invimacert',
    'certificadoinvima',
    'resolucioninvima',
    'invimaregistro',
    'registrosanitarioinvimavigente',
    'registro',
    'sanitario',
    'regsanitarioinvima',
  ];

  // 1. Direct search by normalized aliases
  for (const alias of invimaAliases) {
    const norm = normalizeHeaderKey(alias);
    if (rowMap[norm] !== undefined && rowMap[norm] !== null && String(rowMap[norm]).trim() !== '') {
      const val = String(rowMap[norm]).trim();
      if (val.length > 0 && val !== '-') return val;
    }
  }

  // 2. Partial key match in normalized rowMap
  for (const k of Object.keys(rowMap)) {
    if (rowMap[k] !== undefined && rowMap[k] !== null && String(rowMap[k]).trim() !== '') {
      if (
        k.includes('invima') ||
        k.includes('sanitar') ||
        (k.includes('registr') && !k.includes('fecha') && !k.includes('cread') && !k.includes('usuari'))
      ) {
        const val = String(rowMap[k]).trim();
        if (val.length > 0 && val !== '-') return val;
      }
    }
  }

  // 3. Fallback: inspect raw row cell values for INVIMA patterns (e.g. "INVIMA 2021EBC-0004521" or "2021EBC-0004521")
  const invimaRegex = /(invima[\s\:\.\-]*[a-z0-9\-\/]+|\b\d{4}[a-z]{2,5}\-[\w\d]+\b)/i;
  for (const val of Object.values(rawRow)) {
    if (typeof val === 'string' && val.trim().length > 3) {
      const match = val.trim().match(invimaRegex);
      if (match) {
        return val.trim();
      }
    }
  }

  return '';
}

/**
 * Parses an Excel file specifically formatted for Contracts / Tenders (Ventana 4 - Tab 1)
 * Extracts: Nombre del Cliente, NIT, Número del Proceso, Ciudad, Modalidad de Proceso, Objeto del Pliego, Tiempo/Plazo, Estado
 */
export async function parseTenderContractsExcel(file: File): Promise<ParsedMasterContract[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        if (workbook.SheetNames.length === 0) {
          throw new Error('El archivo no contiene hojas de datos.');
        }

        const firstSheetName = workbook.SheetNames[0];
        const rows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheetName], { defval: '' });

        if (!rows || rows.length === 0) {
          throw new Error('La hoja de cálculo está vacía o no contiene registros válidos.');
        }

        const parsedContracts: ParsedMasterContract[] = [];

        rows.forEach((row, index) => {
          const rowMap: Record<string, any> = {};
          Object.keys(row).forEach((k) => {
            rowMap[normalizeHeaderKey(k)] = row[k];
          });

          const findVal = (...aliases: string[]) => {
            for (const alias of aliases) {
              const norm = normalizeHeaderKey(alias);
              if (rowMap[norm] !== undefined && rowMap[norm] !== '') {
                return rowMap[norm];
              }
            }
            return '';
          };

          const rawClient = String(
            findVal('nombredelcliente', 'cliente', 'entidad', 'clientname', 'nombrecliente', 'entidadcontratante', 'razonsocial', 'institucion') || ''
          ).trim();

          const rawProcess = String(
            findVal('numerodelproceso', 'numeroproceso', 'proceso', 'noproceso', 'processnumber', 'licitacion', 'radicado', 'nroproceso') || ''
          ).trim();

          // Skip completely empty rows
          if (!rawClient && !rawProcess) return;

          const nit = String(findVal('nit', 'rut', 'identificacion', 'nroidentificacion') || '900.000.000-1').trim();
          const rawBudget = Number(
            String(
              findVal(
                'valortotaldelcontratocop',
                'valortotaldelcontrato',
                'presupuestooficialcop',
                'presupuestooficial',
                'presupuesto',
                'valordelcontrato',
                'valortotal',
                'valor',
                'budgetcop',
                'budget',
                'cuantia'
              ) || 0
            ).replace(/[^0-9.-]+/g, '')
          );
          const budgetCOP = !isNaN(rawBudget) && rawBudget > 0 ? Math.round(rawBudget) : 0;
          const city = String(findVal('dequeciudades', 'ciudad', 'municipio', 'sede', 'city', 'departamento') || 'Bogotá D.C.').trim();
          const processType = String(findVal('modalidaddeproceso', 'modalidad', 'modalidaddelproceso', 'tipodeproceso', 'tipo', 'regimen') || 'Licitación Pública').trim();
          const contractObject = String(findVal('objetodelpliego', 'objetodelcontrato', 'objeto', 'pliego', 'descripcioncontrato', 'objetoplural') || 'SUMINISTRO DE EQUIPAMIENTO BIOMÉDICO').trim();
          const executionTerm = String(findVal('tiempoplazo', 'tiempoplazodeejecucion', 'tiempo', 'plazo', 'plazodeejecucion', 'duracion') || '60 días calendario').trim();
          const rawStatus = String(findVal('estado', 'status', 'estadoproceso', 'fase') || 'Adjudicada').trim().toLowerCase();

          let status: ParsedMasterContract['status'] = 'Adjudicada';
          if (rawStatus.includes('prep') || rawStatus.includes('borrador') || rawStatus.includes('creac')) status = 'En Preparación';
          else if (rawStatus.includes('pres') || rawStatus.includes('enviad') || rawStatus.includes('eval')) status = 'Presentada';
          else if (rawStatus.includes('desiert')) status = 'Desierta';
          else if (rawStatus.includes('cerrad') || rawStatus.includes('finaliz')) status = 'Cerrada';

          parsedContracts.push({
            clientName: rawClient || `Entidad Proceso ${rawProcess || index + 1}`,
            nit,
            processNumber: rawProcess || `LP-${new Date().getFullYear()}-${String(index + 1).padStart(3, '0')}`,
            processType,
            city,
            contractObject,
            contactPerson: '',
            executionTerm,
            openingDate: new Date().toISOString().split('T')[0],
            closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            budgetCOP: budgetCOP > 0 ? budgetCOP : 250000000,
            status,
            items: [],
          });
        });

        if (parsedContracts.length === 0) {
          throw new Error('No se encontraron contratos válidos. Verifique que las columnas coincidan con la plantilla.');
        }

        resolve(parsedContracts);
      } catch (err: any) {
        reject(new Error(err.message || 'Error al procesar el archivo Excel de contratos.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Error de lectura en el archivo seleccionado.'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parses an Excel or CSV file containing equipment list and technical specifications
 */
export async function parseTenderEquiposExcel(
  file: File,
  catalogEquipments: MedicalEquipment[] = []
): Promise<ParsedTenderEquipmentRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error('El archivo Excel no contiene hojas de datos válidas.');
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!rawJson || rawJson.length === 0) {
          throw new Error('La hoja de cálculo está vacía o no tiene filas legibles.');
        }

        const groupedEquipmentsMap = new Map<string, ParsedTenderEquipmentRow>();
        let lastEquipmentKey = '';

        rawJson.forEach((row, index) => {
          // Build normalized key lookup
          const rowMap: Record<string, any> = {};
          Object.keys(row).forEach((k) => {
            rowMap[normalizeHeaderKey(k)] = row[k];
          });

          // Helper to find value from potential header aliases
          const findVal = (...aliases: string[]) => {
            for (const alias of aliases) {
              const norm = normalizeHeaderKey(alias);
              if (rowMap[norm] !== undefined && rowMap[norm] !== '') {
                return rowMap[norm];
              }
            }
            return '';
          };

          const rawName = String(
            findVal(
              'nombredelequipo',
              'nombreequipo',
              'equipo',
              'descripcion',
              'dispositivo',
              'nombredeldispositivo',
              'nombre',
              'item',
              'equipomedico'
            ) || ''
          ).trim();

          const rawCode = String(findVal('codigo', 'code', 'cod', 'item', 'ref', 'referencia', 'parte', 'nroparte') || '').trim();

          // Extract all specifications in this row: primary column + extra columns (e.g. especificacion1, especificacion2...)
          const extractedSpecsInRow: string[] = [];
          const primarySpec = String(
            findVal(
              'especificaciontecnica1porcelda',
              'especificaciontecnica',
              'especificacionestecnicas',
              'especificaciones',
              'especificacion',
              'requisitos',
              'requerimientos',
              'requerimientostecnicos',
              'fichatecnica',
              'specs',
              'caracteristicas',
              'detallestecnicos'
            ) || ''
          ).trim();

          if (primarySpec) {
            extractedSpecsInRow.push(primarySpec);
          }

          // Check if there are horizontal specification columns (especificacion 1, especificacion 2, etc.)
          Object.keys(rowMap).forEach((k) => {
            if (
              (k.startsWith('especificacion') || k.startsWith('requisito') || k.startsWith('spec')) &&
              k !== 'especificaciontecnica' &&
              k !== 'especificacionestecnicas' &&
              k !== 'especificacion' &&
              rowMap[k]
            ) {
              const val = String(rowMap[k]).trim();
              if (val && !extractedSpecsInRow.includes(val)) {
                extractedSpecsInRow.push(val);
              }
            }
          });

          // If this row has no equipment name and no code, but has specs, append specs to previous equipment
          if (!rawName && !rawCode) {
            if (extractedSpecsInRow.length > 0 && lastEquipmentKey && groupedEquipmentsMap.has(lastEquipmentKey)) {
              const prev = groupedEquipmentsMap.get(lastEquipmentKey)!;
              const existingSpecs = prev.specificationsText ? prev.specificationsText.split(';\n') : [];
              extractedSpecsInRow.forEach((s) => {
                if (!existingSpecs.includes(s)) existingSpecs.push(s);
              });
              prev.specificationsText = existingSpecs.join(';\n');
            }
            return;
          }

          const rawBrand = String(findVal('marca', 'brand', 'fabricante') || 'Genérico').trim();
          const rawModel = String(findVal('modelo', 'model', 'referenciamodelo') || 'Estándar').trim();
          const rawCategory = String(findVal('categoria', 'category', 'linea', 'tipo') || '').trim();

          const rawQty = Number(findVal('cantidad', 'cant', 'unidades', 'qty', 'numero', 'unid') || 1);
          const quantity = isNaN(rawQty) || rawQty <= 0 ? 1 : Math.round(rawQty);

          const rawPrice = Number(
            String(findVal('preciounitario', 'preciounitarioofertado', 'valorunitario', 'precio', 'punit') || 0)
              .replace(/[^0-9.-]+/g, '')
          );
          const offeredUnitPrice = isNaN(rawPrice) || rawPrice < 0 ? 0 : Math.round(rawPrice);

          const rawCeilingPrice = Number(
            String(
              findVal(
                'preciotopeunitariocop',
                'preciotopeunitario',
                'preciotope',
                'preciotecho',
                'preciotechounitario',
                'presupuestounitario',
                'valortope',
                'preciomaximo',
                'techounitario',
                'presupuestoestimado',
                'unitestimatedbudget',
                'preciotopedelexcel'
              ) || 0
            ).replace(/[^0-9.-]+/g, '')
          );
          const unitEstimatedBudget = !isNaN(rawCeilingPrice) && rawCeilingPrice > 0 ? Math.round(rawCeilingPrice) : undefined;

          const rawCost = Number(
            String(findVal('costobase', 'costo', 'costounitario', 'costobasecop', 'costocp', 'basecost') || 0)
              .replace(/[^0-9.-]+/g, '')
          );
          const baseCostCOP = !isNaN(rawCost) && rawCost > 0 ? Math.round(rawCost) : undefined;
          const rawMargin = String(findVal('margen', 'margin', 'listamargen', 'factor') || 'L4').trim();

          const rawInvima = extractInvimaValueFromRow(rowMap, row);
          const rawWarranty = Number(findVal('garantia', 'garantiameses', 'mesesgarantia', 'garantiames') || 24);
          const warrantyMonths = isNaN(rawWarranty) || rawWarranty <= 0 ? 24 : Math.round(rawWarranty);

          const rawDelivery = Number(findVal('tiempoentrega', 'tiempoentregadias', 'plazoentrega', 'diasentrega', 'entrega') || 15);
          const deliveryTimeDays = isNaN(rawDelivery) || rawDelivery <= 0 ? 15 : Math.round(rawDelivery);

          const rawOrigin = String(findVal('paisdeorigen', 'paisorigen', 'origen', 'procedencia', 'pais') || 'Colombia').trim();
          const rawObs = String(findVal('observaciones', 'observacion', 'notas', 'cumplimiento', 'nota') || '').trim();
          const rawProcessRef = String(findVal('numerodeproceso', 'proceso', 'noproceso', 'processnumber', 'licitacion') || '').trim();
          const rawClientRef = String(findVal('cliente', 'entidad', 'clientname', 'nombrecliente') || '').trim();

          // Try to match with existing catalog equipment
          const matchedCatalogEquipment = catalogEquipments.find((eq) => {
            if (rawCode && eq.code.toLowerCase() === rawCode.toLowerCase()) return true;
            if (
              eq.name.toLowerCase().includes(rawName.toLowerCase()) ||
              rawName.toLowerCase().includes(eq.name.toLowerCase())
            ) {
              if (rawBrand && rawBrand !== 'Genérico' && eq.brand.toLowerCase().includes(rawBrand.toLowerCase())) {
                return true;
              }
              return true;
            }
            return false;
          });

          // Equipment unique key for grouping multi-row specs
          const groupKey = (rawCode ? rawCode : rawName).toLowerCase();
          lastEquipmentKey = groupKey;

          if (groupedEquipmentsMap.has(groupKey)) {
            // Append specifications to existing equipment entry
            const existing = groupedEquipmentsMap.get(groupKey)!;
            const currentSpecs = existing.specificationsText ? existing.specificationsText.split(';\n') : [];
            extractedSpecsInRow.forEach((s) => {
              if (s && !currentSpecs.includes(s)) {
                currentSpecs.push(s);
              }
            });
            existing.specificationsText = currentSpecs.join(';\n');
            if (quantity > existing.quantity) {
              existing.quantity = quantity;
            }
            if (unitEstimatedBudget && !existing.unitEstimatedBudget) {
              existing.unitEstimatedBudget = unitEstimatedBudget;
            }
          } else {
            const calculatedOfferedPrice =
              offeredUnitPrice > 0
                ? offeredUnitPrice
                : unitEstimatedBudget
                ? unitEstimatedBudget
                : matchedCatalogEquipment
                ? Math.round(matchedCatalogEquipment.baseCostCOP * 1.5)
                : 10000000;

            groupedEquipmentsMap.set(groupKey, {
              code: rawCode || `EQ-${index + 1}`,
              name: rawName || (matchedCatalogEquipment ? matchedCatalogEquipment.name : `Equipo Médico ${index + 1}`),
              brand: rawBrand !== 'Genérico' ? rawBrand : matchedCatalogEquipment?.brand || 'Biomédico',
              model: rawModel !== 'Estándar' ? rawModel : matchedCatalogEquipment?.model || 'Clínico',
              category: rawCategory || matchedCatalogEquipment?.category || undefined,
              quantity,
              offeredUnitPrice: calculatedOfferedPrice,
              unitEstimatedBudget: unitEstimatedBudget || (calculatedOfferedPrice > 0 ? calculatedOfferedPrice : undefined),
              baseCostCOP:
                baseCostCOP || matchedCatalogEquipment?.baseCostCOP || (calculatedOfferedPrice > 0 ? Math.round(calculatedOfferedPrice / 1.5) : 6666667),
              defaultMarginList: rawMargin,
              invimaRecord: rawInvima !== 'Vigente' ? rawInvima : matchedCatalogEquipment?.invimaRecordNumber || 'INVIMA Vigente',
              warrantyMonths: warrantyMonths || matchedCatalogEquipment?.warrantyMonths || 24,
              deliveryTimeDays: deliveryTimeDays || 15,
              originCountry: rawOrigin || matchedCatalogEquipment?.originCountry || 'Colombia',
              specificationsText: extractedSpecsInRow.join(';\n'),
              observations: rawObs || 'Cumple con los requerimientos técnicos del pliego.',
              matchedCatalogEquipment,
              processNumberRef: rawProcessRef,
              clientNameRef: rawClientRef,
            });
          }
        });

        const parsedRows = Array.from(groupedEquipmentsMap.values());
        resolve(parsedRows);
      } catch (err: any) {
        reject(new Error(err.message || 'Error al procesar el archivo Excel.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Error de lectura en el archivo seleccionado.'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Backward compatibility alias for equipment specifications parser
 */
export const parseTenderEquiposSpecsExcel = parseTenderEquiposExcel;

/**
 * Parses a Master Excel file containing multiple contracts/tenders and/or sheets
 */
export async function parseMasterContractExcel(
  file: File,
  catalogEquipments: MedicalEquipment[] = []
): Promise<ParsedMasterContract[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        if (workbook.SheetNames.length === 0) {
          throw new Error('El archivo no contiene hojas de datos.');
        }

        let contractRows: any[] = [];
        let equipmentRows: any[] = [];

        // Check if there are separate sheets for contracts and equipments
        const contractSheetName = workbook.SheetNames.find((s) =>
          normalizeHeaderKey(s).includes('contrato') ||
          normalizeHeaderKey(s).includes('licitacion') ||
          normalizeHeaderKey(s).includes('cliente') ||
          normalizeHeaderKey(s).includes('1')
        );

        const equipmentSheetName = workbook.SheetNames.find((s) =>
          normalizeHeaderKey(s).includes('equipo') ||
          normalizeHeaderKey(s).includes('item') ||
          normalizeHeaderKey(s).includes('dispositivo') ||
          normalizeHeaderKey(s).includes('2')
        );

        if (contractSheetName && equipmentSheetName && contractSheetName !== equipmentSheetName) {
          contractRows = XLSX.utils.sheet_to_json(workbook.Sheets[contractSheetName], { defval: '' });
          equipmentRows = XLSX.utils.sheet_to_json(workbook.Sheets[equipmentSheetName], { defval: '' });
        } else {
          // Single sheet mode
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const allRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
          equipmentRows = allRows;
          contractRows = allRows;
        }

        const parsedContracts: ParsedMasterContract[] = [];

        // 1. Process contract metadata rows
        const contractMap = new Map<string, ParsedMasterContract>();

        contractRows.forEach((row, index) => {
          const rowMap: Record<string, any> = {};
          Object.keys(row).forEach((k) => {
            rowMap[normalizeHeaderKey(k)] = row[k];
          });

          const findVal = (...aliases: string[]) => {
            for (const alias of aliases) {
              const norm = normalizeHeaderKey(alias);
              if (rowMap[norm] !== undefined && rowMap[norm] !== '') {
                return rowMap[norm];
              }
            }
            return '';
          };

          const rawClient = String(findVal('cliente', 'entidad', 'clientname', 'nombrecliente', 'entidadcontratante') || '').trim();
          const rawProcess = String(findVal('numerodeproceso', 'proceso', 'noproceso', 'processnumber', 'licitacion') || '').trim();

          if (!rawClient && !rawProcess) return;

          const key = (rawProcess || rawClient).toLowerCase();
          if (contractMap.has(key)) return;

          const nit = String(findVal('nit', 'rut', 'identificacion') || '900.000.000-1').trim();
          const processType = String(findVal('tipodeproceso', 'tipo', 'modalidad') || 'Licitación Pública').trim();
          const city = String(findVal('ciudad', 'municipio', 'sede', 'city') || 'Bogotá D.C.').trim();
          const contractObject = String(findVal('objetodelcontrato', 'objeto', 'descripcioncontrato') || 'SUMINISTRO DE EQUIPOS BIOMÉDICOS').trim();
          const contactPerson = String(findVal('personadecontacto', 'contacto', 'responsable') || '').trim();
          const executionTerm = String(findVal('plazodeejecucion', 'plazo', 'tiempoejecucion') || '60 días calendario').trim();
          const openingDate = String(findVal('fechaapertura', 'apertura', 'fechainicio') || new Date().toISOString().split('T')[0]).trim();
          const closingDate = String(findVal('fechacierre', 'cierre', 'fechafin') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]).trim();
          const rawBudget = Number(String(findVal('presupuestooficial', 'presupuesto', 'budget') || 0).replace(/[^0-9.-]+/g, ''));
          const rawStatus = String(findVal('estado', 'status') || 'Adjudicada').trim().toLowerCase();

          let status: ParsedMasterContract['status'] = 'Adjudicada';
          if (rawStatus.includes('prep') || rawStatus.includes('borrador')) status = 'En Preparación';
          else if (rawStatus.includes('pres') || rawStatus.includes('enviad') || rawStatus.includes('eval')) status = 'Presentada';
          else if (rawStatus.includes('desiert')) status = 'Desierta';
          else if (rawStatus.includes('cerrad')) status = 'Cerrada';

          contractMap.set(key, {
            clientName: rawClient || `Cliente Proceso ${rawProcess}`,
            nit,
            processNumber: rawProcess || `LP-${new Date().getFullYear()}-${index + 1}`,
            processType,
            city,
            contractObject,
            contactPerson,
            executionTerm,
            openingDate,
            closingDate,
            budgetCOP: !isNaN(rawBudget) && rawBudget > 0 ? rawBudget : 250000000,
            status,
            items: [],
          });
        });

        // 2. Parse equipment rows and link them to contracts
        equipmentRows.forEach((row, index) => {
          const rowMap: Record<string, any> = {};
          Object.keys(row).forEach((k) => {
            rowMap[normalizeHeaderKey(k)] = row[k];
          });

          const findVal = (...aliases: string[]) => {
            for (const alias of aliases) {
              const norm = normalizeHeaderKey(alias);
              if (rowMap[norm] !== undefined && rowMap[norm] !== '') {
                return rowMap[norm];
              }
            }
            return '';
          };

          const rawCode = String(findVal('codigo', 'code', 'cod', 'item', 'ref') || `EQ-${index + 1}`).trim();
          const rawName = String(findVal('equipo', 'nombre', 'equiponombre', 'descripcion', 'dispositivo') || '').trim();

          if (!rawName && !rawCode) return;

          const rawBrand = String(findVal('marca', 'brand', 'fabricante') || 'Genérico').trim();
          const rawModel = String(findVal('modelo', 'model') || 'Estándar').trim();
          const rawCategory = String(findVal('categoria', 'category') || '').trim();

          const rawQty = Number(findVal('cantidad', 'cant', 'unidades') || 1);
          const quantity = isNaN(rawQty) || rawQty <= 0 ? 1 : Math.round(rawQty);

          const rawPrice = Number(String(findVal('preciounitario', 'precio', 'punit') || 0).replace(/[^0-9.-]+/g, ''));
          const offeredUnitPrice = isNaN(rawPrice) || rawPrice < 0 ? 0 : Math.round(rawPrice);

          const rawCost = Number(String(findVal('costobase', 'costo', 'costounitario') || 0).replace(/[^0-9.-]+/g, ''));
          const baseCostCOP = !isNaN(rawCost) && rawCost > 0 ? Math.round(rawCost) : undefined;
          const rawMargin = String(findVal('margen', 'margin') || 'L4').trim();

          const rawInvima = extractInvimaValueFromRow(rowMap, row);
          const rawWarranty = Number(findVal('garantia', 'garantiameses') || 24);
          const warrantyMonths = isNaN(rawWarranty) || rawWarranty <= 0 ? 24 : Math.round(rawWarranty);

          const rawDelivery = Number(findVal('tiempoentrega', 'tiempoentregadias', 'plazoentrega') || 15);
          const deliveryTimeDays = isNaN(rawDelivery) || rawDelivery <= 0 ? 15 : Math.round(rawDelivery);

          const rawOrigin = String(findVal('paisdeorigen', 'paisorigen', 'origen') || 'Colombia').trim();
          const rawSpecs = String(findVal('especificaciones', 'especificacionestecnicas', 'specs') || '').trim();
          const rawObs = String(findVal('observaciones', 'observacion') || '').trim();

          const linkProcess = String(findVal('numerodeprocesovinculacion', 'numerodeproceso', 'proceso', 'noproceso', 'processnumber') || '').trim().toLowerCase();
          const linkClient = String(findVal('cliente', 'entidad', 'clientname') || '').trim().toLowerCase();

          // Match equipment to catalog
          const matchedCatalogEquipment = catalogEquipments.find((eq) => {
            if (rawCode && eq.code.toLowerCase() === rawCode.toLowerCase()) return true;
            if (
              eq.name.toLowerCase().includes(rawName.toLowerCase()) ||
              rawName.toLowerCase().includes(eq.name.toLowerCase())
            ) {
              if (rawBrand && rawBrand !== 'Genérico' && eq.brand.toLowerCase().includes(rawBrand.toLowerCase())) {
                return true;
              }
            }
            return false;
          });

          const eqObj: ParsedTenderEquipmentRow = {
            code: rawCode,
            name: rawName || `Equipo ${index + 1}`,
            brand: rawBrand !== 'Genérico' ? rawBrand : matchedCatalogEquipment?.brand || 'Biomédico',
            model: rawModel !== 'Estándar' ? rawModel : matchedCatalogEquipment?.model || 'Clínico',
            category: rawCategory || matchedCatalogEquipment?.category || undefined,
            quantity,
            offeredUnitPrice: offeredUnitPrice > 0 ? offeredUnitPrice : (matchedCatalogEquipment ? Math.round(matchedCatalogEquipment.baseCostCOP * 1.5) : 10000000),
            baseCostCOP: baseCostCOP || matchedCatalogEquipment?.baseCostCOP || (offeredUnitPrice > 0 ? Math.round(offeredUnitPrice / 1.5) : 6666667),
            defaultMarginList: rawMargin,
            invimaRecord: rawInvima !== 'Vigente' ? rawInvima : (matchedCatalogEquipment?.invimaRecordNumber || 'INVIMA Vigente'),
            warrantyMonths: warrantyMonths || matchedCatalogEquipment?.warrantyMonths || 24,
            deliveryTimeDays: deliveryTimeDays || 15,
            originCountry: rawOrigin || matchedCatalogEquipment?.originCountry || 'Colombia',
            specificationsText: rawSpecs,
            observations: rawObs || 'Cumple con los requerimientos técnicos del contrato.',
            matchedCatalogEquipment,
            processNumberRef: linkProcess,
            clientNameRef: linkClient,
          };

          // Find which contract to append to
          let targetContract: ParsedMasterContract | undefined;
          if (linkProcess && contractMap.has(linkProcess)) {
            targetContract = contractMap.get(linkProcess);
          } else if (linkClient && contractMap.has(linkClient)) {
            targetContract = contractMap.get(linkClient);
          } else if (contractMap.size === 1) {
            targetContract = Array.from(contractMap.values())[0];
          }

          if (targetContract) {
            targetContract.items.push(eqObj);
          } else {
            // Create a default contract if none exists
            const fallbackKey = linkProcess || linkClient || 'default-contract';
            if (!contractMap.has(fallbackKey)) {
              contractMap.set(fallbackKey, {
                clientName: linkClient || 'Cliente Importado Excel',
                nit: '900.000.000-1',
                processNumber: linkProcess || `LP-${new Date().getFullYear()}-001`,
                processType: 'Licitación Pública',
                city: 'Colombia',
                contractObject: 'SUMINISTRO DE EQUIPAMIENTO MÉDICO',
                contactPerson: '',
                executionTerm: '60 días calendario',
                openingDate: new Date().toISOString().split('T')[0],
                closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                budgetCOP: 200000000,
                status: 'Adjudicada',
                items: [eqObj],
              });
            } else {
              contractMap.get(fallbackKey)!.items.push(eqObj);
            }
          }
        });

        parsedContracts.push(...Array.from(contractMap.values()));
        resolve(parsedContracts);
      } catch (err: any) {
        reject(new Error(err.message || 'Error al procesar el archivo Excel maestro.'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Error de lectura en el archivo seleccionado.'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Converts ParsedMasterContract array into full TenderClientProject array with TechnicalRequirements
 */
export function convertParsedMasterContractsToTenderProjects(
  parsedContracts: ParsedMasterContract[]
): TenderClientProject[] {
  return parsedContracts.map((c, cIdx) => {
    const clientId = `tend-cli-${Date.now()}-${cIdx}-${Math.random().toString(36).substring(2, 6)}`;
    const convertedItems = convertParsedRowsToTenderItems(c.items, 0);

    return {
      id: clientId,
      clientName: c.clientName,
      nit: c.nit,
      status: c.status,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      header: {
        entityName: c.clientName,
        nit: c.nit,
        processNumber: c.processNumber,
        processType: c.processType,
        contractObject: c.contractObject,
        openingDate: c.openingDate,
        closingDate: c.closingDate,
        city: c.city,
        budgetCOP: c.budgetCOP,
        contactPerson: c.contactPerson,
        executionTerm: c.executionTerm,
      },
      items: convertedItems,
    };
  });
}

/**
 * Converts parsed Excel rows into fully structured TenderItems with TechnicalRequirements
 */
export function convertParsedRowsToTenderItems(
  parsedRows: ParsedTenderEquipmentRow[],
  startIndex: number = 0
): TenderItem[] {
  return parsedRows.map((row, idx) => {
    const itemNumber = startIndex + idx + 1;
    const itemId = `tend-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`;
    const equipmentId = row.matchedCatalogEquipment?.id || `eq-import-${Date.now()}-${idx}`;

    let requirements: TechnicalRequirement[] = [];

    // 1. If custom specs text was provided in Excel
    if (row.specificationsText && row.specificationsText.trim()) {
      // Split by newlines, semicolons, bullet points, or numbered markers (1. 2.)
      const specLines = row.specificationsText
        .split(/\r?\n|;|\u2022|\*|(?=\b\d+[\.\)]\s+)/)
        .map((s) => s.trim())
        .filter((s) => s.length > 2);

      requirements = specLines.map((line, sIdx) => {
        const isUnique = line.includes('⭐') || line.toLowerCase().includes('exclusiv') || line.toLowerCase().includes('patentad') || line.toLowerCase().includes('únic');
        const cleanText = line.replace(/^[⭐\s]*(\d+[\.\)\-:\s]+|[\-\*•\u2022]\s*)/, '').trim();
        const liveAdvice = getLiveDraftingAdvice(cleanText || line);

        return {
          id: `req-xl-${Date.now()}-${idx}-${sIdx}`,
          requirement: cleanText || line,
          isUnique,
          hasWorkRange: !!liveAdvice?.extractedRange,
          workRange: liveAdvice?.extractedRange?.formatted,
          complies: true,
          folioRef: `Folio ${10 + sIdx * 2}`,
        };
      });
    }

    // 2. If no specs in Excel, use matched catalog specs or auto-generate tailored biomedical specs
    if (requirements.length === 0) {
      if (row.matchedCatalogEquipment && row.matchedCatalogEquipment.technicalSpecs?.length) {
        requirements = row.matchedCatalogEquipment.technicalSpecs.map((spec, sIdx) => {
          const isUnique = spec.includes('⭐') || spec.toLowerCase().includes('exclusiv');
          const clean = spec.replace(/^⭐\s*/, '');
          const liveAdvice = getLiveDraftingAdvice(clean);
          return {
            id: `req-cat-${Date.now()}-${idx}-${sIdx}`,
            requirement: clean,
            isUnique,
            hasWorkRange: !!liveAdvice?.extractedRange,
            workRange: liveAdvice?.extractedRange?.formatted,
            complies: true,
            folioRef: `Folio ${10 + sIdx * 2}`,
          };
        });
      } else {
        requirements = getGenericSpecificationsForEquipment(row.name, row.brand, row.model).map((gen, sIdx) => ({
          id: `req-gen-${Date.now()}-${idx}-${sIdx}`,
          requirement: gen.requirement,
          isUnique: !!gen.isUnique,
          hasWorkRange: !!gen.hasWorkRange,
          workRange: gen.workRange,
          complies: true,
          folioRef: `Folio ${10 + sIdx * 2}`,
        }));
      }
    }

    return {
      id: itemId,
      itemNumber,
      equipmentId,
      code: row.code,
      name: row.name,
      brand: row.brand,
      model: row.model,
      originCountry: row.originCountry,
      quantity: row.quantity,
      unitEstimatedBudget:
        row.unitEstimatedBudget && row.unitEstimatedBudget > 0
          ? row.unitEstimatedBudget
          : Math.round(row.offeredUnitPrice * 1.15),
      offeredUnitPrice: row.offeredUnitPrice,
      invimaRecord: row.invimaRecord,
      warrantyMonths: row.warrantyMonths,
      deliveryTimeDays: row.deliveryTimeDays,
      requirements,
      selected: true,
      observations: row.observations || 'Cumple 100% con las especificaciones técnicas solicitadas.',
    };
  });
}

/**
 * Intelligent Biomedical Knowledge Engine: Detects and assigns realistic standard accessories
 * automatically based on equipment type, name, brand, model and clinical category.
 */
export function getAutomaticStandardAccessories(
  equipmentName: string,
  brand?: string,
  model?: string,
  category?: string
): { name: string; costCOP: number; included: boolean }[] {
  const q = `${equipmentName || ''} ${brand || ''} ${model || ''} ${category || ''}`.toLowerCase();

  const toAccessories = (names: string[]) =>
    names.map((name) => ({ name, costCOP: 0, included: true }));

  // 1. Ventiladores Mecánicos / UCI / Transporte / No Invasivo
  if (
    q.includes('ventilador') ||
    q.includes('respirador') ||
    q.includes('pulmonar') ||
    q.includes('synovent') ||
    q.includes('sv300') ||
    q.includes('sv600') ||
    q.includes('sv800') ||
    q.includes('hamilton') ||
    q.includes('evita') ||
    q.includes('vela') ||
    q.includes('astral')
  ) {
    return toAccessories([
      'Circuito de paciente adulto reusable con trampa de agua',
      'Circuito de paciente pediátrico / neonatal reusable',
      'Brazo articulado de soporte para mangueras de ventilación',
      'Sensor de flujo proximal de alta precisión (autoclavable)',
      'Pulmón de prueba / simulación para calibración y autotest',
      'Filtro espiratorio antibacterial / antiviral de grado médico',
      'Juego de mangueras de suministro de O2 y Aire medicinal con conectores DISS / NIST',
      'Cable de alimentación grado hospitalario con polo a tierra',
    ]);
  }

  // 2. Monitores de Signos Vitales / Multiparámetro / Modular
  if (
    (q.includes('monitor') &&
      (q.includes('signo') ||
        q.includes('vital') ||
        q.includes('multiparam') ||
        q.includes('im60') ||
        q.includes('im70') ||
        q.includes('epm') ||
        q.includes('umec') ||
        q.includes('benevision') ||
        q.includes('vista') ||
        q.includes('truscope'))) ||
    q.includes('multiparametrico')
  ) {
    return toAccessories([
      'Cable troncal de ECG de 5 derivaciones con latiguillos tipo broche / snap',
      'Sensor de SpO2 reusable adulto tipo dedal en silicona médica',
      'Brazalete de PANI (Presión Arterial No Invasiva) adulto estándar (25-35 cm)',
      'Manguera de interconexión neumática rápida para brazalete de PANI',
      'Sensor de temperatura corporal cutánea / de superficie',
      'Batería interna recargable de litio de alta autonomía (4+ horas)',
      'Cable de alimentación eléctrica grado médico hospitalario',
    ]);
  }

  // 3. Electrocardiógrafos (3, 6, 12 canales)
  if (
    q.includes('electrocard') ||
    q.includes('ecg') ||
    q.includes('ekg') ||
    q.includes('cardiofax') ||
    q.includes('imac') ||
    q.includes('zoncare') ||
    q.includes('beneheart r')
  ) {
    return toAccessories([
      'Cable de paciente para ECG de 10 puntas / derivaciones (conector tipo banana)',
      'Juego de 4 pinzas para extremidades en código internacional de colores (R, L, F, N)',
      'Juego de 6 peras / copas precordiales con ventosa de succión en silicona',
      'Paquete de papel térmico milimetrado para impresión de trazados diagnósticos',
      'Cable de conexión equipotencial de seguridad a tierra',
      'Cable de alimentación eléctrica grado hospitalario',
    ]);
  }

  // 4. Desfibriladores / Monitores Desfibriladores / DEA / Cardioversores
  if (
    q.includes('desfibrilad') ||
    q.includes('cardiovers') ||
    q.includes('dea') ||
    q.includes('aed') ||
    q.includes('beneheart d') ||
    q.includes('defigard') ||
    q.includes('corpuls') ||
    q.includes('zoll')
  ) {
    return toAccessories([
      'Juego de palas externas reusables adulto / pediátrico integradas con botones de descarga',
      'Cable de paciente ECG de 3/5 derivaciones',
      'Juego de electrodos / parches de desfibrilación descartables multifunción',
      'Resistencia de prueba / simulador de descarga de 50 ohms para autodiagnóstico',
      'Frasco de gel conductor electroquirúrgico de 250 ml',
      'Batería recargable de alta densidad y cable de alimentación grado médico',
    ]);
  }

  // 5. Bombas de Infusión (Volumétricas, Jeringa, PCA)
  if (
    q.includes('bomba') &&
    (q.includes('infus') ||
      q.includes('jeringa') ||
      q.includes('pca') ||
      q.includes('volumetr') ||
      q.includes('benefusion') ||
      q.includes('sk-600') ||
      q.includes('perfusor'))
  ) {
    return toAccessories([
      'Sensor óptico de gotas externo de alta sensibilidad',
      'Abrazadera / clamp universal para fijación a atril porta-suero',
      'Cable de poder grado hospitalario',
      'Batería interna de respaldo recargable de ion de litio',
      'Manual de usuario y guía de calibración para sets de infusión',
    ]);
  }

  // 6. Máquinas de Anestesia / Estaciones Anestésicas
  if (
    q.includes('anestesia') ||
    q.includes('wato') ||
    q.includes('a7') ||
    q.includes('a5') ||
    q.includes('fabius') ||
    q.includes('perseus') ||
    q.includes('leon')
  ) {
    return toAccessories([
      'Circuito respiratorio circular de paciente con bolsa reservorio de 2 litros',
      'Caníster / absorbedor de cal sodada integrado con trampa de condensación',
      'Juego de mangueras de conexión para gases medicinales (O2, N2O, Aire) codificadas por color',
      'Sensor de flujo espiratorio e inspiratorio de alta precisión',
      'Sensor galvánico de O2 para celda de medición',
      'Yugo de fijación y sello para cilindros de reserva de gases',
      'Cable de alimentación eléctrica grado hospitalario',
    ]);
  }

  // 7. Mesas Quirúrgicas / Mesas de Cirugía / Operaciones
  if (
    q.includes('mesa') &&
    (q.includes('quirurg') ||
      q.includes('cirug') ||
      q.includes('operacion') ||
      q.includes('parto') ||
      q.includes('qx') ||
      q.includes('brumaba') ||
      q.includes('hybase'))
  ) {
    return toAccessories([
      'Control de mando alámbrico ergonómico retroiluminado',
      'Juego de soportes laterales para brazos acolchados con abrazaderas a riel',
      'Arco de anestesia en acero inoxidable quirúrgico',
      'Par de perneras ginecológicas tipo bota con rótula tridimensional',
      'Cinturón / correa de fijación para paciente con hebilla rápida',
      'Juego de colchones viscoelásticos antiestáticos termosensibles sin costuras',
    ]);
  }

  // 8. Lámparas Cielíticas / Quirúrgicas / Examen
  if (
    q.includes('lampara') ||
    q.includes('cielitica') ||
    q.includes('quirurgica') ||
    q.includes('foco') ||
    q.includes('hyled') ||
    q.includes('marled')
  ) {
    return toAccessories([
      'Juego de mangos / manijas esterilizables en autoclave (2 unidades)',
      'Panel de control de intensidad lumínica y temperatura de color (Kelvin)',
      'Brazo articulado de suspensión compensado por resorte con giro 360°',
      'Fuente de poder conmutada y módulo de respaldo de emergencia',
    ]);
  }

  // 9. Electrobisturís / Unidades Electroquirúrgicas
  if (
    q.includes('electrobisturi') ||
    q.includes('electroquirurg') ||
    q.includes('generador') ||
    q.includes('bisturi') ||
    q.includes('valleylab') ||
    q.includes('bovie') ||
    q.includes('erbe')
  ) {
    return toAccessories([
      'Mango / lápiz monopolar desechable o reusable con pulsadores de corte y coagulación',
      'Placa de paciente neutra / retorno reusable o descartable bipartida con cable',
      'Pedal doble de accionamiento sellado e impermeable (corte / coagulación)',
      'Set de electrodos activos surtidos (cuchilla, bola, aguja)',
      'Cable de conexión equipotencial de seguridad a tierra',
    ]);
  }

  // 10. Ecógrafos / Ultrasonidos
  if (
    q.includes('ecograf') ||
    q.includes('ultrason') ||
    q.includes('doppler') ||
    q.includes('chison') ||
    q.includes('mindray dc') ||
    q.includes('sonoscape') ||
    q.includes('logiq')
  ) {
    return toAccessories([
      'Transductor Convexo multifrecuencia para abdomen y obstetricia',
      'Transductor Lineal de alta resolución para partes blandas y vascular',
      'Frasco de gel acústico conductor para ultrasonido de 250 ml',
      'Soporte integrado para transductores y gancho para cables',
      'Funda protectora antipolvo y cable de alimentación grado médico',
    ]);
  }

  // 11. Succionadores / Aspiradores de Secreciones
  if (q.includes('succion') || q.includes('aspirador') || q.includes('aspiracion')) {
    return toAccessories([
      'Frasco recolector de secreciones en policarbonato autoclavable de 2 a 5 litros con válvula de sobrellenado',
      'Juego de mangueras de succión en silicona grado médico con conectores universales',
      'Filtro hidrofóbico antibacterial y antiviral de alta eficiencia',
      'Pedal de accionamiento neumático / eléctrico',
      'Cánula de succión tipo Yankauer con control de vacío',
    ]);
  }

  // 12. Camas Hospitalarias / Camillas de Transporte
  if (q.includes('cama') || q.includes('camilla') || q.includes('hospitalaria')) {
    return toAccessories([
      'Colchón hospitalario de espuma de alta densidad con forro impermeable y antibacteriano',
      'Atril porta-suero en acero inoxidable telescópico de 4 ganchos',
      'Barandas laterales de protección abatibles en polímero ABS con mecanismo de amortiguación',
      'Control de mando ergonómico integrado',
    ]);
  }

  // 13. Incubadoras Neonatales / Cunas de Calor Radiante
  if (q.includes('incubadora') || q.includes('cuna') || q.includes('calor radiante') || q.includes('neonat')) {
    return toAccessories([
      'Sensor de temperatura de piel neonatal de alta sensibilidad (servo-control)',
      'Colchón viscoelástico hipoalergénico con cubierta impermeable y lavable',
      'Bandeja porta chasis de Rayos X deslizable sin perturbar al paciente',
      'Filtro de aire de entrada HEPA antibacterial',
      'Atril porta-suero en acero inoxidable acoplable a la estructura',
    ]);
  }

  // 14. Fototerapia Neonatal
  if (q.includes('fototerapia') || q.includes('bilirrubina') || q.includes('bili')) {
    return toAccessories([
      'Kit de antifaces / protectores oculares neonatales opacos',
      'Base rodable con sistema de elevación asistida por resorte de gas',
      'Contador horario digital integrado para monitoreo de vida útil de emisores LED',
      'Cable de alimentación eléctrica grado hospitalario',
    ]);
  }

  // 15. Torres de Endoscopia / Laparoscopia
  if (q.includes('laparoscop') || q.includes('endoscop') || q.includes('artroscop') || q.includes('torre')) {
    return toAccessories([
      'Óptica / laparoscopio de 0° y 30° autoclavable de alta definición',
      'Cable de fibra óptica de transmisión de luz fría de alta intensidad',
      'Manguera de insuflación de CO2 de alta presión con conector rápido',
      'Cabezal de cámara HD/4K sumergible con botones programables',
    ]);
  }

  // 16. Autoclaves / Esterilizadores
  if (q.includes('autoclave') || q.includes('esterilizad')) {
    return toAccessories([
      'Juego de 3 a 5 bandejas de carga en acero inoxidable perforado AISI 316',
      'Soporte portabandejas y pinza extractora ergonómica',
      'Manguera para drenaje de agua residual y llenado manual',
      'Junta / empaque de silicona para sellado hermético de la puerta de repuesto',
      'Filtro bacteriológico de aire de reposición',
    ]);
  }

  // Accesorios estándar genéricos para cualquier equipo médico
  return toAccessories([
    'Cable de alimentación eléctrica grado hospitalario con polo a tierra',
    'Batería interna recargable de respaldo de alta autonomía',
    'Manual de usuario y operación técnica en idioma español',
    'Kit de cables de conexión y accesorios estándar de puesta en marcha',
    'Certificado de control de calidad y calibración de fábrica',
  ]);
}

/**
 * Downloads a clean, empty Excel template with only the 8 required columns for importing new equipments:
 * Parte, Equipo, Marca, Modelo, Proveedor, Costo, IVA (Aplica SÍ / NO), Número INVIMA.
 */
export function downloadCatalogEquipmentTemplate() {
  const headers = [
    'Parte',
    'Equipo',
    'Marca',
    'Modelo',
    'Proveedor',
    'Costo',
    'IVA (Aplica SÍ / NO)',
    'Número INVIMA',
  ];

  // Completely empty template containing only the headers
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);

  // Set optimal column widths for the 8 core columns
  worksheet['!cols'] = [
    { wch: 18 }, // Parte
    { wch: 48 }, // Equipo
    { wch: 22 }, // Marca
    { wch: 22 }, // Modelo
    { wch: 30 }, // Proveedor
    { wch: 18 }, // Costo
    { wch: 24 }, // IVA (Aplica SÍ / NO)
    { wch: 28 }, // Número INVIMA
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla Equipos');

  XLSX.writeFile(workbook, 'Plantilla_Importar_Equipos.xlsx');
}

/**
 * Exports the complete database of medical equipments from the project codebase to an Excel workbook (.xlsx)
 */
export function downloadMasterCatalogExcel(equipmentsList?: MedicalEquipment[]) {
  const listToExport =
    equipmentsList && equipmentsList.length > 0 ? equipmentsList : MASTER_EQUIPMENTS_CATALOG;

  const headers = [
    'Parte / Código',
    'Tipo de Producto',
    'Nombre del Equipo o Producto',
    'Marca',
    'Modelo',
    'Categoría',
    'Proveedor Principal',
    'Proveedores Alternos',
    'Costo Base COP',
    'Costo Base USD',
    'Exento IVA',
    'Lista de Margen Predeterminada',
    'Registro INVIMA',
    'Estado INVIMA',
    'Vigencia INVIMA',
    'Meses de Garantía',
    'País de Origen',
    'Descripción',
    'Especificaciones Técnicas (Puntos clave)',
    'Accesorios Estándar Incluidos',
  ];

  const rows = listToExport.map((eq) => [
    eq.code || '',
    eq.productGroup || 'Equipos Médicos',
    eq.name || '',
    eq.brand || '',
    eq.model || '',
    eq.category || 'Diagnóstico',
    eq.supplier || '',
    (eq.alternateSuppliers || []).join(', '),
    eq.baseCostCOP || 0,
    eq.baseCostUSD || (eq.baseCostCOP ? Math.round(eq.baseCostCOP / 4000) : 0),
    eq.taxExempt ? 'SÍ' : 'NO',
    eq.defaultMarginList || 'L4',
    eq.invimaRecordNumber || 'No Registra',
    eq.invimaStatus || 'Vigente',
    eq.invimaExpiryDate || '',
    eq.warrantyMonths || 12,
    eq.originCountry || 'Colombia',
    eq.description || '',
    (eq.technicalSpecs || []).join(' | '),
    (eq.standardAccessories || []).map((a) => `${a.name}${a.costCOP > 0 ? ` ($${a.costCOP})` : ''}`).join('; '),
  ]);

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

  worksheet['!cols'] = [
    { wch: 16 }, // Parte / Código
    { wch: 24 }, // Tipo de Producto
    { wch: 50 }, // Nombre del Equipo
    { wch: 20 }, // Marca
    { wch: 22 }, // Modelo
    { wch: 18 }, // Categoría
    { wch: 32 }, // Proveedor Principal
    { wch: 30 }, // Proveedores Alternos
    { wch: 18 }, // Costo Base COP
    { wch: 16 }, // Costo Base USD
    { wch: 12 }, // Exento IVA
    { wch: 22 }, // Lista de Margen
    { wch: 26 }, // Registro INVIMA
    { wch: 16 }, // Estado INVIMA
    { wch: 16 }, // Vigencia INVIMA
    { wch: 16 }, // Garantía
    { wch: 20 }, // País de Origen
    { wch: 60 }, // Descripción
    { wch: 75 }, // Especificaciones Técnicas
    { wch: 60 }, // Accesorios
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Base de Datos Equipos SYD');

  const todayStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Base_Datos_Equipos_SYD_Colombia_${todayStr}.xlsx`);
}

/**
 * Parses an Excel or CSV file containing equipments to register or update in the Master Catalog (Ventana 3)
 */
export async function parseCatalogEquipmentsExcel(
  file: File,
  existingEquipments: MedicalEquipment[] = []
): Promise<ParsedCatalogEquipmentsResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const rawBuffer = e.target?.result as ArrayBuffer;
        const isJsonFile = file.name.toLowerCase().endsWith('.json') || file.type.includes('json');
        let rawJson: Record<string, any>[] = [];

        if (isJsonFile) {
          try {
            const text = new TextDecoder('utf-8').decode(new Uint8Array(rawBuffer));
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed)) {
              rawJson = parsed;
            } else if (parsed && typeof parsed === 'object') {
              rawJson =
                parsed.equipments ||
                parsed.equipos ||
                parsed.catalog ||
                parsed.catalogo ||
                parsed.medicalEquipments ||
                parsed.items ||
                parsed.data?.equipments ||
                parsed.data?.equipos ||
                parsed.data ||
                [];
            }
          } catch (jsonErr: any) {
            throw new Error(`Error al leer archivo JSON: ${jsonErr?.message || 'Formato JSON inválido'}`);
          }
        } else {
          const data = new Uint8Array(rawBuffer);
          const workbook = XLSX.read(data, { type: 'array' });

          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            throw new Error('El archivo Excel no contiene hojas de datos válidas.');
          }

          const worksheet = workbook.Sheets[firstSheetName];
          rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        }

        if (!rawJson || rawJson.length === 0) {
          throw new Error('El archivo no contiene filas legibles de equipos médicos.');
        }

        const validCategories: MedicalEquipment['category'][] = [
          'Monitoreo',
          'Cirugía',
          'Diagnóstico',
          'Quirófano',
          'Cuidados Críticos',
          'Urgencias',
          'Ginecología',
        ];

        const parsedRows: ParsedCatalogEquipmentRow[] = [];
        const unifiedDuplicatesMap = new Map<string, UnifiedEquipmentDetail>();
        const allDetectedSuppliersMap = new Map<string, DetectedSupplierInFile>();

        rawJson.forEach((row, index) => {
          const rowMap: Record<string, any> = {};
          Object.keys(row).forEach((k) => {
            rowMap[normalizeHeaderKey(k)] = row[k];
          });

          const findVal = (...aliases: string[]) => {
            for (const alias of aliases) {
              const norm = normalizeHeaderKey(alias);
              if (rowMap[norm] !== undefined && rowMap[norm] !== '') {
                return rowMap[norm];
              }
            }
            return '';
          };

          const rawCode = String(
            findVal('parte', 'part', 'partnumber', 'numerodeparte', 'nroparte', 'numparte', 'codigo', 'code', 'cod', 'item', 'ref', 'referencia') || ''
          ).trim();
          const rawName = String(
            findVal('nombredelequipo', 'equipo', 'nombre', 'equiponombre', 'dispositivo', 'nombreequipo', 'item', 'descripcion') ||
              ''
          ).trim();

          if (!rawCode && !rawName) return;

          const rawBrand = String(findVal('marca', 'brand', 'fabricante') || 'SYD Biomedical').trim();
          const rawModel = String(findVal('modelo', 'model', 'referenciamodelo') || 'Estándar').trim();
          const rawSupplier = String(findVal('proveedor', 'supplier', 'distribuidor', 'fabricante') || '').trim();

          // 1-based original Excel row number (Row 1 is header, row index 0 is Excel row 2)
          const currentExcelRowNumber = index + 2;

          // Track every supplier mentioned in the entire Excel file for directory auto-registration
          if (rawSupplier) {
            const suppKey = rawSupplier.toLowerCase();
            const existingSuppEntry = allDetectedSuppliersMap.get(suppKey);
            if (!existingSuppEntry) {
              allDetectedSuppliersMap.set(suppKey, {
                supplier: rawSupplier,
                brand: rawBrand,
                name: rawName || 'Equipo Médico',
                model: rawModel,
                isNewInDirectory: !isSupplierRegisteredInDirectory(rawSupplier),
                excelRowNumbers: [currentExcelRowNumber],
              });
            } else {
              if (!existingSuppEntry.excelRowNumbers.includes(currentExcelRowNumber)) {
                existingSuppEntry.excelRowNumbers.push(currentExcelRowNumber);
              }
            }
          }

          // Match category
          let category: MedicalEquipment['category'] = 'Diagnóstico';
          const rawCat = String(findVal('categoria', 'category', 'linea', 'tipo') || '').toLowerCase();
          if (rawCat.includes('monit')) category = 'Monitoreo';
          else if (rawCat.includes('cirug')) category = 'Cirugía';
          else if (rawCat.includes('crit') || rawCat.includes('uci') || rawCat.includes('ventila')) category = 'Cuidados Críticos';
          else if (rawCat.includes('quirof') || rawCat.includes('quirurg')) category = 'Quirófano';
          else if (rawCat.includes('urgenc') || rawCat.includes('emergenc')) category = 'Urgencias';
          else if (rawCat.includes('ginec') || rawCat.includes('materno') || rawCat.includes('obstet')) category = 'Ginecología';
          else if (rawCat.includes('diag') || rawCat.includes('ecog') || rawCat.includes('electro')) category = 'Diagnóstico';

          // Detect Product Group (Equipos Médicos, Instrumental Quirúrgico, Muebles Hospitalarios)
          const rawGroup = String(
            findVal('tipodeproducto', 'grupodeproducto', 'grupo', 'tipoproducto', 'lineadeproducto', 'familia', 'productgroup', 'classification') || ''
          ).trim();
          const productGroup = detectProductGroup(rawName, category, rawBrand, rawModel, rawGroup);

          // Base Cost in COP
          const rawCost = Number(
            String(
              findVal('costobase', 'costobasecop', 'costo', 'costocop', 'valorcompra', 'preciobase', 'valordecompra') || 0
            ).replace(/[^0-9.-]+/g, '')
          );
          const baseCostCOP = isNaN(rawCost) || rawCost < 0 ? 0 : Math.round(rawCost);

          // Margin List
          let defaultMarginList: MarginListKey = 'L4';
          const rawMargin = String(
            findVal('margensugerido', 'margen', 'listamargen', 'defaultmargin', 'listaprecios', 'nivelmargen') || ''
          ).toUpperCase();
          if (['L1', 'L2', 'L2_5', 'L3', 'L3_5', 'L4', 'L4_5', 'L5', 'L6', 'L7', 'L8'].includes(rawMargin)) {
            defaultMarginList = rawMargin as MarginListKey;
          }

          // INVIMA
          const rawInvima = extractInvimaValueFromRow(rowMap, row);
          const invimaRecordNumber = rawInvima || 'En Trámite';

          // Warranty
          const rawWarranty = Number(findVal('garantia', 'garantiameses', 'mesesgarantia', 'garantiaenmeses') || 24);
          const warrantyMonths = isNaN(rawWarranty) || rawWarranty <= 0 ? 24 : Math.round(rawWarranty);

          // Country
          const originCountry = String(findVal('paisdeorigen', 'pais', 'origen', 'procedencia') || 'Colombia').trim();

          // Tax Exemption & IVA
          let taxExempt = false;
          let taxRate = 19;

          const rawAplicaIva = String(
            findVal('ivaaplicasinó', 'ivaaplicasino', 'ivaaplicasi/no', 'aplicaiva', 'iva', 'gravado') || ''
          ).trim().toLowerCase();

          const rawExentoIva = String(
            findVal('exentodeiva', 'exento', 'ivaexento', 'exencion') || ''
          ).trim().toLowerCase();

          if (rawAplicaIva) {
            if (
              rawAplicaIva === 'no' ||
              rawAplicaIva === '0' ||
              rawAplicaIva === '0%' ||
              rawAplicaIva === 'false' ||
              rawAplicaIva.includes('exent')
            ) {
              taxExempt = true;
              taxRate = 0;
            } else {
              taxExempt = false;
              taxRate = 19;
            }
          } else if (rawExentoIva) {
            if (
              rawExentoIva.includes('si') ||
              rawExentoIva.includes('yes') ||
              rawExentoIva === '1' ||
              rawExentoIva === 'true'
            ) {
              taxExempt = true;
              taxRate = 0;
            } else {
              taxExempt = false;
              taxRate = 19;
            }
          }

          // Commercial Description
          const description = String(
            findVal('descripcioncomercial', 'descripcion', 'detalle', 'resumen') ||
              `${rawName} marca ${rawBrand} modelo ${rawModel}`
          ).trim();

          // Technical Specs
          const rawSpecsText = String(
            findVal('especificacionestecnicas', 'especificaciones', 'fichatecnica', 'specs', 'requerimientostecnicos') || ''
          ).trim();

          let technicalSpecs: string[] = [];
          if (rawSpecsText) {
            technicalSpecs = rawSpecsText
              .split(/\r?\n|;|\u2022|\*/)
              .map((s) => s.trim())
              .filter((s) => s.length > 3);
          }

          if (technicalSpecs.length === 0) {
            technicalSpecs = getGenericSpecificationsForEquipment(rawName, rawBrand, rawModel).map((g) => g.requirement);
          }

          // Standard Accessories (Auto-detected intelligently if not provided)
          const rawAccessoriesText = String(
            findVal('accesoriosestandar', 'accesorios', 'incluye', 'accesoriosincluidos') || ''
          ).trim();

          let standardAccessories: { name: string; costCOP: number; included: boolean }[] = [];
          if (rawAccessoriesText) {
            const accLines = rawAccessoriesText
              .split(/\r?\n|;|\u2022|\*/)
              .map((s) => s.trim())
              .filter((s) => s.length > 2);

            standardAccessories = accLines.map((accName) => ({
              name: accName.replace(/^[-\*•\d\.\)]\s*/, '').trim(),
              costCOP: 0,
              included: true,
            }));
          }

          // If no accessories in Excel, use intelligent biomedical detection engine
          if (standardAccessories.length === 0) {
            standardAccessories = getAutomaticStandardAccessories(rawName, rawBrand, rawModel, category);
          }

          // Robust Code / Part Number & Existing Match Detection
          const finalCode = rawCode || `EQ-${(existingEquipments.length + parsedRows.length + 1).toString().padStart(3, '0')}`;
          const finalName = rawName || `Equipo Biomédico ${index + 1}`;

          const normRawCode = rawCode.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
          const isSpecificModel = rawModel.length >= 3 && !['estandar', 'estándar', 'standard', 's/m'].includes(rawModel.toLowerCase());

          // 1. CHECK IF REPEATED / DUPLICATE WITHIN THIS SAME EXCEL FILE -> UNIFY AUTOMATICALLY
          let duplicateInFileIndex = -1;
          let matchReason = '';

          for (let pIdx = 0; pIdx < parsedRows.length; pIdx++) {
            const prev = parsedRows[pIdx];
            const prevNormCode = prev.code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

            // Match by exact Part Number / Code
            if (rawCode && prev.code.trim().toLowerCase() === rawCode.toLowerCase()) {
              duplicateInFileIndex = pIdx;
              matchReason = `Mismo N° de Parte / Código: "${rawCode}"`;
              break;
            }
            if (normRawCode && prevNormCode && normRawCode === prevNormCode) {
              duplicateInFileIndex = pIdx;
              matchReason = `Mismo Código normalizado: "${rawCode || prev.code}"`;
              break;
            }

            // Match by exact Name + Brand + Model
            if (
              prev.name.trim().toLowerCase() === finalName.toLowerCase() &&
              prev.brand.trim().toLowerCase() === rawBrand.toLowerCase() &&
              prev.model.trim().toLowerCase() === rawModel.toLowerCase()
            ) {
              duplicateInFileIndex = pIdx;
              matchReason = `Mismo Equipo ("${finalName}"), Marca ("${rawBrand}") y Modelo ("${rawModel}")`;
              break;
            }

            // Match by specific Brand + Model
            if (
              isSpecificModel &&
              prev.brand.trim().toLowerCase() === rawBrand.toLowerCase() &&
              prev.model.trim().toLowerCase() === rawModel.toLowerCase()
            ) {
              duplicateInFileIndex = pIdx;
              matchReason = `Misma Marca ("${rawBrand}") y Modelo ("${rawModel}")`;
              break;
            }
          }

          if (duplicateInFileIndex >= 0) {
            // UNIFY AUTOMATICALLY WITH PREVIOUS ROW
            const primary = parsedRows[duplicateInFileIndex];
            const primaryInitialExcelRow = primary.unifiedExcelRows ? primary.unifiedExcelRows[0] : (duplicateInFileIndex + 2);

            // Merge cost & supplier specific price quotes
            if (!primary.supplierPrices) {
              primary.supplierPrices = [];
              if (primary.supplier && primary.baseCostCOP > 0) {
                primary.supplierPrices.push({
                  supplier: primary.supplier,
                  costCOP: primary.baseCostCOP,
                  date: new Date().toISOString().split('T')[0],
                });
              }
            }

            if (rawSupplier && baseCostCOP > 0) {
              const existingQuoteIdx = primary.supplierPrices.findIndex(
                (sp) => sp.supplier.trim().toLowerCase() === rawSupplier.trim().toLowerCase()
              );
              if (existingQuoteIdx >= 0) {
                primary.supplierPrices[existingQuoteIdx].costCOP = baseCostCOP;
              } else {
                primary.supplierPrices.push({
                  supplier: rawSupplier,
                  costCOP: baseCostCOP,
                  date: new Date().toISOString().split('T')[0],
                });
              }
            }

            // Always select and preserve the LOWEST valid non-zero price for commercial quotes & catalog default
            const validCosts = [
              primary.baseCostCOP,
              baseCostCOP,
              ...(primary.supplierPrices ? primary.supplierPrices.map((sp) => sp.costCOP) : []),
            ].filter((c) => typeof c === 'number' && c > 0);

            if (validCosts.length > 0) {
              primary.baseCostCOP = Math.min(...validCosts);
            }

            // Ensure suppliers tracking list is initialized on primary
            if (!primary.allSuppliersFound) {
              primary.allSuppliersFound = primary.supplier ? [primary.supplier] : [];
            }
            if (!primary.alternateSuppliers) {
              primary.alternateSuppliers = [];
            }
            if (!primary.newSuppliersDetected) {
              primary.newSuppliersDetected = [];
            }

            // Merge supplier if primary had none, or record alternate/new supplier
            if (rawSupplier) {
              const alreadyHasSupp = primary.allSuppliersFound.some(
                (s) => s.trim().toLowerCase() === rawSupplier.toLowerCase()
              );
              if (!alreadyHasSupp) {
                primary.allSuppliersFound.push(rawSupplier);
              }

              const isSupplierInDir = isSupplierRegisteredInDirectory(rawSupplier);
              if (!isSupplierInDir && !primary.newSuppliersDetected.some((s) => s.toLowerCase() === rawSupplier.toLowerCase())) {
                primary.newSuppliersDetected.push(rawSupplier);
              }

              if (!primary.supplier || primary.supplier === 'Por Asignar') {
                primary.supplier = rawSupplier;
                const suppMatch = matchSupplierInDirectory(rawSupplier, rawBrand);
                primary.isSupplierInDirectory = suppMatch.status === 'exact';
                primary.supplierMatchStatus = suppMatch.status;
                primary.suggestedSupplierName = suppMatch.status === 'suggested' ? suppMatch.bestSuggestion?.name : undefined;
                primary.suggestedSupplierProfile = suppMatch.status === 'suggested' ? suppMatch.bestSuggestion : undefined;
              } else if (!primary.supplier.toLowerCase().includes(rawSupplier.toLowerCase())) {
                if (!primary.alternateSuppliers.some((s) => s.trim().toLowerCase() === rawSupplier.toLowerCase())) {
                  primary.alternateSuppliers.push(rawSupplier);
                }
                const allUnique = Array.from(new Set(primary.allSuppliersFound.filter(Boolean)));
                primary.supplier = allUnique.join(' / ');
              }
            }

            // Merge INVIMA record
            if ((!primary.invimaRecordNumber || primary.invimaRecordNumber === 'En Trámite') && invimaRecordNumber && invimaRecordNumber !== 'En Trámite') {
              primary.invimaRecordNumber = invimaRecordNumber;
            }

            // Merge standard accessories without duplicates
            standardAccessories.forEach((acc) => {
              const alreadyHas = primary.standardAccessories.some(
                (p) => p.name.trim().toLowerCase() === acc.name.trim().toLowerCase()
              );
              if (!alreadyHas) {
                primary.standardAccessories.push(acc);
              }
            });

            // Merge technical specs without duplicates
            technicalSpecs.forEach((spec) => {
              const alreadyHas = primary.technicalSpecs.some(
                (p) => p.trim().toLowerCase() === spec.trim().toLowerCase()
              );
              if (!alreadyHas) {
                primary.technicalSpecs.push(spec);
              }
            });

            // Update unification metadata
            primary.isUnified = true;
            if (!primary.unifiedExcelRows) {
              primary.unifiedExcelRows = [primaryInitialExcelRow, currentExcelRowNumber];
            } else if (!primary.unifiedExcelRows.includes(currentExcelRowNumber)) {
              primary.unifiedExcelRows.push(currentExcelRowNumber);
            }
            primary.unifiedCount = primary.unifiedExcelRows.length;

            // Re-evaluate validation issues on primary
            const newIssues: string[] = [];
            if (primary.baseCostCOP === 0) {
              newIssues.push('Costo base en $0 COP (Requiere asignación de costo)');
            }
            primary.validationIssues = newIssues;

            // Record in unifiedDuplicatesMap
            const uKey = primary.code || `${primary.brand}-${primary.model}`;
            let uRecord = unifiedDuplicatesMap.get(uKey);
            if (!uRecord) {
              uRecord = {
                key: uKey,
                code: primary.code,
                name: primary.name,
                brand: primary.brand,
                model: primary.model,
                category: primary.category,
                supplier: primary.supplier,
                allSuppliers: [...primary.allSuppliersFound],
                newSuppliers: [...primary.newSuppliersDetected],
                baseCostCOP: primary.baseCostCOP,
                supplierPrices: primary.supplierPrices ? [...primary.supplierPrices] : [],
                excelRowNumbers: [...primary.unifiedExcelRows],
                unifiedCount: primary.unifiedExcelRows.length,
                reason: matchReason,
                summary: `Unificadas ${primary.unifiedExcelRows.length} filas (#${primary.unifiedExcelRows.join(', #')}) del archivo Excel.`,
                mergedAccessoriesCount: primary.standardAccessories.length,
              };
              unifiedDuplicatesMap.set(uKey, uRecord);
            } else {
              uRecord.excelRowNumbers = [...primary.unifiedExcelRows];
              uRecord.unifiedCount = primary.unifiedExcelRows.length;
              uRecord.summary = `Unificadas ${uRecord.unifiedCount} filas (#${uRecord.excelRowNumbers.join(', #')}) del archivo Excel.`;
              uRecord.baseCostCOP = primary.baseCostCOP;
              uRecord.supplierPrices = primary.supplierPrices ? [...primary.supplierPrices] : [];
              uRecord.supplier = primary.supplier;
              uRecord.allSuppliers = [...primary.allSuppliersFound];
              uRecord.newSuppliers = [...primary.newSuppliersDetected];
              uRecord.mergedAccessoriesCount = primary.standardAccessories.length;
            }

            // Do not add duplicate row to parsedRows!
            return;
          }

          // 2. CHECK AGAINST EXISTING CATALOG DATABASE (Priority: Part Number / Code first, then Name+Brand+Model, then Brand+Model)
          const existingMatch = existingEquipments.find((e) => {
            const normECode = e.code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            // Match by Part Number / Code
            if (rawCode && e.code.trim().toLowerCase() === rawCode.toLowerCase()) return true;
            if (normRawCode && normECode && normRawCode === normECode) return true;

            // Match by Name + Brand + Model
            if (
              e.name.trim().toLowerCase() === finalName.toLowerCase() &&
              e.brand.trim().toLowerCase() === rawBrand.toLowerCase() &&
              e.model.trim().toLowerCase() === rawModel.toLowerCase()
            ) {
              return true;
            }

            // Match by specific Brand + Model
            if (
              isSpecificModel &&
              e.brand.trim().toLowerCase() === rawBrand.toLowerCase() &&
              e.model.trim().toLowerCase() === rawModel.toLowerCase()
            ) {
              return true;
            }

            return false;
          });

          const validationIssues: string[] = [];
          if (baseCostCOP === 0) {
            validationIssues.push('Costo base en $0 COP (Requiere asignación de costo)');
          }

          const supplierMatch = rawSupplier ? matchSupplierInDirectory(rawSupplier, rawBrand) : { status: 'none' as const, suggestedSuppliers: [] };
          const isSupplierInDir = supplierMatch.status === 'exact';
          const suggestedSupplierName = supplierMatch.status === 'suggested' ? supplierMatch.bestSuggestion?.name : undefined;
          const suggestedSupplierProfile = supplierMatch.status === 'suggested' ? supplierMatch.bestSuggestion : undefined;

          parsedRows.push({
            code: finalCode,
            name: finalName,
            brand: rawBrand,
            productGroup,
            model: rawModel,
            category,
            supplier: rawSupplier,
            allSuppliersFound: rawSupplier ? [rawSupplier] : [],
            alternateSuppliers: [],
            newSuppliersDetected: rawSupplier && !isSupplierInDir ? [rawSupplier] : [],
            supplierPrices: rawSupplier && baseCostCOP > 0 ? [{
              supplier: rawSupplier,
              costCOP: baseCostCOP,
              date: new Date().toISOString().split('T')[0],
            }] : [],
            baseCostCOP,
            defaultMarginList,
            invimaRecordNumber,
            warrantyMonths,
            originCountry,
            taxExempt,
            taxRate,
            description,
            technicalSpecs,
            standardAccessories,
            isExistingMatch: !!existingMatch,
            matchedEquipmentId: existingMatch?.id,
            importAction: existingMatch ? 'update' : 'create_new',
            isDuplicateInFile: false,
            isUnified: false,
            unifiedExcelRows: [currentExcelRowNumber],
            unifiedCount: 1,
            isSupplierInDirectory: isSupplierInDir,
            supplierMatchStatus: supplierMatch.status,
            suggestedSupplierName,
            suggestedSupplierProfile,
            validationIssues,
          });
        });

        const productGroupsAudit = auditProductGroups(parsedRows);

        resolve({
          rows: parsedRows,
          unifiedDuplicates: Array.from(unifiedDuplicatesMap.values()),
          allDetectedSuppliers: Array.from(allDetectedSuppliersMap.values()),
          totalExcelRowsRead: rawJson.length,
          productGroupsAudit,
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Helper to combine supplier price quotes cleanly across existing and incoming records
 */
function mergeSupplierPriceQuotes(
  existingQuotes: SupplierPriceQuote[] = [],
  incomingQuotes: SupplierPriceQuote[] = [],
  fallbackSupplier?: string,
  fallbackCost?: number
): SupplierPriceQuote[] {
  const map = new Map<string, SupplierPriceQuote>();
  existingQuotes.forEach((q) => {
    if (q.supplier && q.supplier.trim()) {
      map.set(q.supplier.trim().toLowerCase(), { ...q });
    }
  });
  incomingQuotes.forEach((q) => {
    if (q.supplier && q.supplier.trim()) {
      const key = q.supplier.trim().toLowerCase();
      map.set(key, { ...q });
    }
  });
  if (map.size === 0 && fallbackSupplier && fallbackCost && fallbackCost > 0) {
    map.set(fallbackSupplier.trim().toLowerCase(), {
      supplier: fallbackSupplier.trim(),
      costCOP: fallbackCost,
      date: new Date().toISOString().split('T')[0],
    });
  }
  return Array.from(map.values());
}

/**
 * Helper to compute the minimum non-zero cost (best purchasing price)
 */
function computeLowestCost(quotes: SupplierPriceQuote[], ...otherCosts: (number | undefined)[]): number {
  const allCosts = [
    ...quotes.map((q) => q.costCOP),
    ...otherCosts,
  ].filter((c): c is number => typeof c === 'number' && c > 0);
  return allCosts.length > 0 ? Math.min(...allCosts) : 0;
}

/**
 * Converts parsed rows into full MedicalEquipment objects to update or add to the Catalog
 */
export function convertParsedRowsToCatalogEquipments(
  parsedRows: ParsedCatalogEquipmentRow[],
  existingEquipments: MedicalEquipment[] = [],
  mode: 'append_update' | 'replace' = 'append_update'
): MedicalEquipment[] {
  if (mode === 'replace') {
    const seenNewKeys = new Map<string, string>();
    const replaceList: MedicalEquipment[] = [];

    parsedRows.forEach((row, idx) => {
      const normCode = row.code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const itemKey = `${row.name.trim().toLowerCase()}|${row.brand.trim().toLowerCase()}|${row.model.trim().toLowerCase()}`;
      const lookupKey = normCode || itemKey;

      const rowSuppliers = Array.from(
        new Set([
          ...(row.allSuppliersFound || []),
          ...(row.alternateSuppliers || []),
          ...(row.supplier ? row.supplier.split(/[\/\;\n\,\|]+/).map((s) => s.trim()) : []),
        ].filter((s) => s && s.length > 0 && s.toLowerCase() !== 'por asignar'))
      );

      if (seenNewKeys.has(lookupKey)) {
        // Repeated row in file: update previously created record instead of creating duplicate
        const existingIdx = replaceList.findIndex((r) => r.id === seenNewKeys.get(lookupKey));
        if (existingIdx >= 0) {
          const prev = replaceList[existingIdx];
          const mergedSupps = Array.from(
            new Set([...(prev.allSuppliers || []), ...rowSuppliers].filter(Boolean))
          );
          const finalSuppStr = mergedSupps.length > 1 ? mergedSupps.join(' / ') : (mergedSupps[0] || prev.supplier || row.supplier);

          const mergedQuotes = mergeSupplierPriceQuotes(prev.supplierPrices, row.supplierPrices, row.supplier, row.baseCostCOP);
          const lowestCost = computeLowestCost(mergedQuotes, prev.baseCostCOP, row.baseCostCOP);

          replaceList[existingIdx] = {
            ...prev,
            supplier: finalSuppStr,
            allSuppliers: mergedSupps,
            alternateSuppliers: mergedSupps.slice(1),
            supplierPrices: mergedQuotes,
            baseCostCOP: lowestCost > 0 ? lowestCost : prev.baseCostCOP,
            invimaRecordNumber: row.invimaRecordNumber !== 'En Trámite' ? row.invimaRecordNumber : prev.invimaRecordNumber,
          };
          return;
        }
      }

      const newId = `eq-cat-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`;
      seenNewKeys.set(lookupKey, newId);

      const finalSuppStr = rowSuppliers.length > 1 ? rowSuppliers.join(' / ') : (row.supplier || '');
      const mergedQuotes = mergeSupplierPriceQuotes([], row.supplierPrices, row.supplier, row.baseCostCOP);
      const lowestCost = computeLowestCost(mergedQuotes, row.baseCostCOP);

      replaceList.push({
        id: newId,
        code: row.code,
        name: row.name,
        brand: row.brand,
        productGroup: row.productGroup || 'Equipos Médicos',
        supplier: finalSuppStr,
        allSuppliers: rowSuppliers.length > 0 ? rowSuppliers : (row.supplier ? [row.supplier] : []),
        alternateSuppliers: row.alternateSuppliers || rowSuppliers.slice(1),
        supplierPrices: mergedQuotes,
        model: row.model,
        category: row.category,
        baseCostCOP: lowestCost > 0 ? lowestCost : row.baseCostCOP,
        taxExempt: row.taxExempt,
        taxRate: row.taxRate,
        defaultMarginList: row.defaultMarginList,
        invimaRecordNumber: row.invimaRecordNumber,
        invimaStatus: row.invimaRecordNumber.toLowerCase().includes('trámite') || row.invimaRecordNumber.toLowerCase().includes('tramite') ? 'En Renovación' : 'Vigente',
        warrantyMonths: row.warrantyMonths,
        originCountry: row.originCountry,
        description: row.description,
        technicalSpecs: row.technicalSpecs,
        standardAccessories: row.standardAccessories,
        hasDocSheet: false,
        hasInvimaDoc: false,
        hasManual: false,
        hasQualityCert: false,
      });
    });

    return replaceList;
  }

  // Mode: Append / Update based on per-row importAction
  const resultMap = new Map<string, MedicalEquipment>();

  // Add existing first
  existingEquipments.forEach((eq) => {
    resultMap.set(eq.id, { ...eq });
  });

  // Track newly created items in this import batch by code / itemKey to prevent duplicate records
  const batchCreatedKeys = new Map<string, string>();

  parsedRows.forEach((row, idx) => {
    const shouldUpdate =
      row.importAction === 'update' &&
      row.isExistingMatch &&
      row.matchedEquipmentId &&
      resultMap.has(row.matchedEquipmentId);

    const rowSuppliers = Array.from(
      new Set([
        ...(row.allSuppliersFound || []),
        ...(row.alternateSuppliers || []),
        ...(row.supplier ? row.supplier.split(/[\/\;\n\,\|]+/).map((s) => s.trim()) : []),
      ].filter((s) => s && s.length > 0 && s.toLowerCase() !== 'por asignar'))
    );

    if (shouldUpdate && row.matchedEquipmentId) {
      // Update existing equipment
      const current = resultMap.get(row.matchedEquipmentId)!;
      const currentSuppliers = Array.from(
        new Set([
          ...(current.allSuppliers || []),
          ...(current.alternateSuppliers || []),
          ...(current.supplier ? current.supplier.split(/[\/\;\n\,\|]+/).map((s) => s.trim()) : []),
        ].filter((s) => s && s.length > 0 && s.toLowerCase() !== 'por asignar'))
      );

      const mergedSuppliers = Array.from(
        new Set([...currentSuppliers, ...rowSuppliers].filter(Boolean))
      );
      const finalSuppStr = mergedSuppliers.length > 1 ? mergedSuppliers.join(' / ') : (row.supplier || current.supplier || '');

      const mergedQuotes = mergeSupplierPriceQuotes(current.supplierPrices, row.supplierPrices, row.supplier, row.baseCostCOP);
      const lowestCost = computeLowestCost(mergedQuotes, current.baseCostCOP, row.baseCostCOP);

      resultMap.set(row.matchedEquipmentId, {
        ...current,
        name: row.name || current.name,
        brand: row.brand || current.brand,
        productGroup: row.productGroup || current.productGroup || 'Equipos Médicos',
        model: row.model || current.model,
        category: row.category || current.category,
        supplier: finalSuppStr,
        allSuppliers: mergedSuppliers.length > 0 ? mergedSuppliers : (finalSuppStr ? [finalSuppStr] : []),
        alternateSuppliers: mergedSuppliers.slice(1),
        supplierPrices: mergedQuotes,
        baseCostCOP: lowestCost > 0 ? lowestCost : current.baseCostCOP,
        defaultMarginList: row.defaultMarginList || current.defaultMarginList,
        invimaRecordNumber: row.invimaRecordNumber !== 'En Trámite' ? row.invimaRecordNumber : current.invimaRecordNumber,
        warrantyMonths: row.warrantyMonths || current.warrantyMonths,
        originCountry: row.originCountry || current.originCountry,
        description: row.description || current.description,
        technicalSpecs: row.technicalSpecs.length > 0 ? row.technicalSpecs : current.technicalSpecs,
        standardAccessories: row.standardAccessories.length > 0 ? row.standardAccessories : current.standardAccessories,
      });
    } else {
      // Check if this newly created item was already created by an earlier row in the same batch
      const normCode = row.code.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const itemKey = `${row.name.trim().toLowerCase()}|${row.brand.trim().toLowerCase()}|${row.model.trim().toLowerCase()}`;
      const lookupKey = normCode || itemKey;

      if (batchCreatedKeys.has(lookupKey)) {
        const existingCreatedId = batchCreatedKeys.get(lookupKey)!;
        if (resultMap.has(existingCreatedId)) {
          // Consolidate into the existing new equipment record
          const current = resultMap.get(existingCreatedId)!;
          const currentSuppliers = Array.from(
            new Set([
              ...(current.allSuppliers || []),
              ...(current.alternateSuppliers || []),
              ...(current.supplier ? current.supplier.split(/[\/\;\n\,\|]+/).map((s) => s.trim()) : []),
            ].filter((s) => s && s.length > 0 && s.toLowerCase() !== 'por asignar'))
          );

          const mergedSuppliers = Array.from(
            new Set([...currentSuppliers, ...rowSuppliers].filter(Boolean))
          );
          const finalSuppStr = mergedSuppliers.length > 1 ? mergedSuppliers.join(' / ') : (row.supplier || current.supplier || '');

          const mergedQuotes = mergeSupplierPriceQuotes(current.supplierPrices, row.supplierPrices, row.supplier, row.baseCostCOP);
          const lowestCost = computeLowestCost(mergedQuotes, current.baseCostCOP, row.baseCostCOP);

          resultMap.set(existingCreatedId, {
            ...current,
            supplier: finalSuppStr,
            allSuppliers: mergedSuppliers.length > 0 ? mergedSuppliers : (finalSuppStr ? [finalSuppStr] : []),
            alternateSuppliers: mergedSuppliers.slice(1),
            supplierPrices: mergedQuotes,
            baseCostCOP: lowestCost > 0 ? lowestCost : current.baseCostCOP,
            invimaRecordNumber: row.invimaRecordNumber !== 'En Trámite' ? row.invimaRecordNumber : current.invimaRecordNumber,
            standardAccessories:
              row.standardAccessories.length >= current.standardAccessories.length
                ? row.standardAccessories
                : current.standardAccessories,
          });
          return;
        }
      }

      // Create new equipment
      const newId = `eq-cat-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`;
      batchCreatedKeys.set(lookupKey, newId);

      const finalSuppStr = rowSuppliers.length > 1 ? rowSuppliers.join(' / ') : (row.supplier || '');
      const mergedQuotes = mergeSupplierPriceQuotes([], row.supplierPrices, row.supplier, row.baseCostCOP);
      const lowestCost = computeLowestCost(mergedQuotes, row.baseCostCOP);

      // Keep part number / code intact
      const codeToUse = row.code;

      resultMap.set(newId, {
        id: newId,
        code: codeToUse,
        name: row.name,
        brand: row.brand,
        productGroup: row.productGroup || 'Equipos Médicos',
        supplier: finalSuppStr,
        allSuppliers: rowSuppliers.length > 0 ? rowSuppliers : (row.supplier ? [row.supplier] : []),
        alternateSuppliers: row.alternateSuppliers || rowSuppliers.slice(1),
        supplierPrices: mergedQuotes,
        model: row.model,
        category: row.category,
        baseCostCOP: lowestCost > 0 ? lowestCost : row.baseCostCOP,
        taxExempt: row.taxExempt,
        taxRate: row.taxRate,
        defaultMarginList: row.defaultMarginList,
        invimaRecordNumber: row.invimaRecordNumber,
        invimaStatus: row.invimaRecordNumber.toLowerCase().includes('trámite') || row.invimaRecordNumber.toLowerCase().includes('tramite') ? 'En Renovación' : 'Vigente',
        warrantyMonths: row.warrantyMonths,
        originCountry: row.originCountry,
        description: row.description,
        technicalSpecs: row.technicalSpecs,
        standardAccessories: row.standardAccessories,
        hasDocSheet: false,
        hasInvimaDoc: false,
        hasManual: false,
        hasQualityCert: false,
      });
    }
  });

  return Array.from(resultMap.values());
}

