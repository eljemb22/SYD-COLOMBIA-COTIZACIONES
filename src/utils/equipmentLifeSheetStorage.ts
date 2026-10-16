import {
  EquipmentLifeSheetData,
  MaintenanceIntervention,
  AnnualMaintenanceSchedule,
  MaintenanceScheduleItem,
  MedicalEquipment,
  ScheduleMonthStatus,
} from '../types';

export const LIFE_SHEETS_STORAGE_KEY = 'syd_equipment_life_sheets_v1';
export const MAINTENANCE_SCHEDULE_STORAGE_KEY = 'syd_annual_maintenance_schedules_v1';

/**
 * Creates a 100% empty Life Sheet with NO pre-filled equipment info,
 * allowing the user to enter their own data from scratch.
 */
export function createEmptyLifeSheetData(formatCode = 'F-GHB-01', formatVersion = 'Versión 01'): EquipmentLifeSheetData {
  return {
    id: `hv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    formatCode: formatCode,
    formatVersion: formatVersion,
    institutionName: '',
    institutionNit: '',
    departmentCity: '',
    serviceLocation: '',
    equipmentName: '',
    brand: '',
    model: '',
    serialNumber: '',
    inventoryPlate: '',
    invimaRecord: '',
    riskClassification: 'Clase I',
    biomedicalClassification: 'Diagnóstico',
    technologyType: 'Electromédico',
    usefulLifeYears: 5,

    acquisitionDate: '',
    installationDate: '',
    supplier: '',
    supplierPhone: '',
    commercialValueCOP: 0,
    warrantyStatus: 'Vigente',
    warrantyExpiration: '',
    purchaseInvoiceOrOC: '',

    voltageVolts: '',
    currentAmperes: '',
    frequencyHz: '',
    powerWatts: '',
    batteryType: '',
    operatingPressure: '',
    operatingTemperature: '',
    humidityRange: '',
    weightDimensions: '',

    maintenanceFrequency: 'Semestral',
    requiresCalibration: false,
    calibrationFrequency: 'No Aplica',
    calibrationVariable: '',
    manualsAvailable: {
      userManual: false,
      serviceManual: false,
      technicalSheet: false,
    },
    accessoriesIncluded: '',

    interventions: [],

    biomedicalEngineerName: '',
    biomedicalEngineerTitle: '',
    biomedicalEngineerLicense: '',
    maintenanceManagerName: '',
    maintenanceManagerTitle: '',

    imageUrl: '',
    logoUrl: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Creates default sample or empty Life Sheet for an equipment
 */
export function createDefaultLifeSheetData(equipment?: MedicalEquipment | null): EquipmentLifeSheetData {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const nextYear = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10);

  const defaultInterventions: MaintenanceIntervention[] = [
    {
      id: 'interv-init-1',
      date: dateStr,
      type: 'Instalación',
      description: 'Inspección inicial de recepción, desembalaje, verificación física de accesorios, prueba de encendido y verificación de seguridad eléctrica.',
      partsReplaced: 'N/A (Equipo Nuevo)',
      engineerName: 'Ing. Biomédico Soporte SYD Colombia',
      professionalLicense: 'COPNIA 25200-XXXXX',
      status: 'Operativo',
      costCOP: 0,
      reportNumber: 'ACTA-INS-001',
      notes: 'Equipo entregado con manuales en español y operando conforme a especificaciones del fabricante.',
    },
  ];

  return {
    id: `hv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    equipmentId: equipment?.id,
    formatCode: 'F-GHB-01',
    formatVersion: 'Versión 04',
    institutionName: 'SUMINISTROS Y DOTACIONES DE COLOMBIA S.A.S.',
    institutionNit: '901.458.239-1',
    departmentCity: 'Bogotá D.C. / Colombia',
    serviceLocation: equipment?.category ? `Servicio de ${equipment.category}` : 'Área Asistencial / Hospitalaria',
    equipmentName: equipment?.name || 'Monitor de Signos Vitales Multiparámetro',
    brand: equipment?.brand || 'Mindray',
    model: equipment?.model || 'ePM 12M',
    serialNumber: `SN-${now.getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
    inventoryPlate: `SYD-AF-${Math.floor(1000 + Math.random() * 9000)}`,
    invimaRecord: equipment?.invimaRecordNumber || '2021EBC-0008450 (Vigente)',
    riskClassification: (equipment?.category?.toLowerCase().includes('soporte') || equipment?.category?.toLowerCase().includes('cirugía'))
      ? 'Clase IIb'
      : (equipment?.category?.toLowerCase().includes('diagnóstico') ? 'Clase IIa' : 'Clase I'),
    biomedicalClassification: equipment?.category?.toLowerCase().includes('soporte')
      ? 'Tratamiento y Soporte de Vida'
      : 'Monitoreo / Cuidados Intensivos',
    technologyType: 'Electromédico',
    usefulLifeYears: 7,

    acquisitionDate: dateStr,
    installationDate: dateStr,
    supplier: equipment?.supplier || 'Suministros y Dotaciones de Colombia S.A.S.',
    supplierPhone: '+57 (601) 745-8900 / 310 850-2020',
    commercialValueCOP: (equipment as any)?.costCOP ? Math.round((equipment as any).costCOP * 1.35) : (equipment as any)?.costPriceCOP ? Math.round((equipment as any).costPriceCOP * 1.35) : 15800000,
    warrantyStatus: 'Vigente',
    warrantyExpiration: nextYear,
    purchaseInvoiceOrOC: `OC-SYD-${now.getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,

    voltageVolts: '100 - 240 VAC',
    currentAmperes: '1.6 A',
    frequencyHz: '50 / 60 Hz',
    powerWatts: '140 W',
    batteryType: 'Batería Inteligente Ion de Litio 11.1V / 4500 mAh (Autonomía 4h)',
    operatingPressure: 'N/A',
    operatingTemperature: '10°C a 40°C',
    humidityRange: '15% a 85% RH (Sin condensación)',
    weightDimensions: '320 x 280 x 160 mm / 4.2 kg',

    maintenanceFrequency: 'Semestral',
    requiresCalibration: true,
    calibrationFrequency: 'Anual',
    calibrationVariable: 'Presión No Invasiva (NIBP), Saturación SpO2, Frecuencia Cardíaca',
    manualsAvailable: {
      userManual: true,
      serviceManual: true,
      technicalSheet: true,
    },
    accessoriesIncluded: 'Cable de alimentación grado hospitalario, Cable ECG 5 derivaciones con latiguillos, Brazalete NIBP adulto reusable con manguera, Sensor SpO2 adulto tipo dedal, Sensor de temperatura piel, Guía rápida de usuario en español.',

    interventions: defaultInterventions,

    biomedicalEngineerName: 'Ing. Alejandro Morales Restrepo',
    biomedicalEngineerTitle: 'Ingeniero Biomédico Especialista en Mantenimiento',
    biomedicalEngineerLicense: 'CNB-84920 / MinSalud',
    maintenanceManagerName: 'Dra. Carolina Vargas Peña',
    maintenanceManagerTitle: 'Directora de Calidad y Gestión Tecnológica',

    imageUrl: equipment?.imageUrl || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Storage CRUD for Equipment Life Sheets
 */
export function getStoredLifeSheets(): EquipmentLifeSheetData[] {
  try {
    const raw = localStorage.getItem(LIFE_SHEETS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading stored life sheets:', e);
    return [];
  }
}

export function saveStoredLifeSheet(sheet: EquipmentLifeSheetData): void {
  try {
    const list = getStoredLifeSheets();
    const idx = list.findIndex((s) => s.id === sheet.id);
    if (idx >= 0) {
      list[idx] = { ...sheet, updatedAt: new Date().toISOString() };
    } else {
      list.unshift({ ...sheet, updatedAt: new Date().toISOString() });
    }
    localStorage.setItem(LIFE_SHEETS_STORAGE_KEY, JSON.stringify(list));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('syd_life_sheets_updated', { detail: list }));
    }
  } catch (e) {
    console.error('Error saving stored life sheet:', e);
  }
}

export function deleteStoredLifeSheet(sheetId: string): void {
  try {
    const list = getStoredLifeSheets().filter((s) => s.id !== sheetId);
    localStorage.setItem(LIFE_SHEETS_STORAGE_KEY, JSON.stringify(list));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('syd_life_sheets_updated', { detail: list }));
    }
  } catch (e) {
    console.error('Error deleting stored life sheet:', e);
  }
}

/**
 * Maintenance Schedule CRUD & Generator
 */
export function getStoredMaintenanceSchedules(): AnnualMaintenanceSchedule[] {
  try {
    const raw = localStorage.getItem(MAINTENANCE_SCHEDULE_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error loading maintenance schedules:', e);
    return [];
  }
}

export function saveStoredMaintenanceSchedule(schedule: AnnualMaintenanceSchedule): void {
  try {
    const list = getStoredMaintenanceSchedules();
    const idx = list.findIndex((s) => s.id === schedule.id || s.year === schedule.year);
    if (idx >= 0) {
      list[idx] = { ...schedule, updatedAt: new Date().toISOString() };
    } else {
      list.unshift({ ...schedule, updatedAt: new Date().toISOString() });
    }
    localStorage.setItem(MAINTENANCE_SCHEDULE_STORAGE_KEY, JSON.stringify(list));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('syd_maintenance_schedules_updated', { detail: list }));
    }
  } catch (e) {
    console.error('Error saving maintenance schedule:', e);
  }
}

/**
 * Creates or auto-populates an Annual Maintenance Schedule from current equipment catalog
 */
export function createDefaultAnnualSchedule(
  year: number = new Date().getFullYear(),
  equipments: MedicalEquipment[] = []
): AnnualMaintenanceSchedule {
  const sampleItems: MaintenanceScheduleItem[] = equipments.length > 0
    ? equipments.map((eq, idx) => {
        const freq: 'Trimestral' | 'Semestral' | 'Anual' =
          idx % 3 === 0 ? 'Trimestral' : idx % 2 === 0 ? 'Semestral' : 'Anual';

        const months: Record<number, ScheduleMonthStatus> = {
          1: null, 2: null, 3: null, 4: null, 5: null, 6: null,
          7: null, 8: null, 9: null, 10: null, 11: null, 12: null,
        };

        // Populate months based on frequency
        if (freq === 'Trimestral') {
          months[1] = 'E'; // Enero ejecutado
          months[4] = 'P'; // Abril programado
          months[7] = 'P'; // Julio programado
          months[10] = 'P'; // Octubre programado
        } else if (freq === 'Semestral') {
          months[3] = 'E'; // Marzo ejecutado
          months[9] = 'P'; // Septiembre programado
        } else {
          months[6] = 'P'; // Junio programado
        }

        if (idx % 2 === 0) {
          months[11] = 'C'; // Noviembre Calibración
        }

        return {
          id: `sch-item-${eq.id || idx}-${Date.now()}`,
          equipmentId: eq.id,
          equipmentName: eq.name,
          brand: eq.brand || 'Mindray',
          model: eq.model || 'Standard',
          serialNumber: `SN-${year}-${1000 + idx}`,
          inventoryPlate: `AF-${2000 + idx}`,
          serviceArea: eq.category || 'UCI / Hospitalización',
          riskClass: idx % 3 === 0 ? 'Clase IIb' : 'Clase IIa',
          frequency: freq,
          requiresCalibration: idx % 2 === 0,
          responsibleSupplier: 'Ingeniería Biomédica SYD Colombia S.A.S.',
          months,
        };
      })
    : [
        {
          id: `sch-item-sample-1`,
          equipmentName: 'Monitor de Signos Vitales Multiparámetro ePM 12M',
          brand: 'Mindray',
          model: 'ePM 12M',
          serialNumber: 'SN-2026-948201',
          inventoryPlate: 'AF-3041',
          serviceArea: 'UCI Adultos',
          riskClass: 'Clase IIb',
          frequency: 'Trimestral',
          requiresCalibration: true,
          responsibleSupplier: 'Ingeniería Biomédica SYD Colombia S.A.S.',
          months: { 1: 'E', 2: null, 3: null, 4: 'P', 5: null, 6: null, 7: 'P', 8: null, 9: null, 10: 'P', 11: 'C', 12: null },
        },
        {
          id: `sch-item-sample-2`,
          equipmentName: 'Electrocardiógrafo Digital de 12 Canales BeneHeart R12',
          brand: 'Mindray',
          model: 'BeneHeart R12',
          serialNumber: 'SN-2026-882190',
          inventoryPlate: 'AF-3042',
          serviceArea: 'Urgencias / Triage',
          riskClass: 'Clase IIa',
          frequency: 'Semestral',
          requiresCalibration: true,
          responsibleSupplier: 'Ingeniería Biomédica SYD Colombia S.A.S.',
          months: { 1: null, 2: null, 3: 'E', 4: null, 5: null, 6: null, 7: null, 8: null, 9: 'P', 10: null, 11: null, 12: null },
        },
        {
          id: `sch-item-sample-3`,
          equipmentName: 'Desfibrilador Bifásico con Monitor y Marcapasos BeneHeart D3',
          brand: 'Mindray',
          model: 'BeneHeart D3',
          serialNumber: 'SN-2026-551029',
          inventoryPlate: 'AF-3043',
          serviceArea: 'Quirófano 1',
          riskClass: 'Clase III',
          frequency: 'Trimestral',
          requiresCalibration: true,
          responsibleSupplier: 'Ingeniería Biomédica SYD Colombia S.A.S.',
          months: { 1: 'E', 2: null, 3: null, 4: 'P', 5: null, 6: null, 7: 'P', 8: null, 9: null, 10: 'P', 11: null, 12: 'C' },
        },
      ];

  return {
    id: `sch-annual-${year}`,
    year,
    institutionName: 'SUMINISTROS Y DOTACIONES DE COLOMBIA S.A.S.',
    nit: '901.458.239-1',
    responsibleName: 'Ing. Alejandro Morales Restrepo',
    responsibleTitle: 'Director de Ingeniería Biomédica y Metrología',
    items: sampleItems,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
