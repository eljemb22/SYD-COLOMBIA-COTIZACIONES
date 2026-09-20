import { MedicalEquipment, QuoteHeader, TechnicalDocument, TenderHeader, TenderClientProject } from '../types';
import { MASTER_EQUIPMENTS_CATALOG } from './masterEquipmentsCatalog';

export const MARGIN_LISTS: Record<string, { label: string; multiplier: number; description: string }> = {
  L1: { label: 'Lista 1 (1.1765x)', multiplier: 1.1765, description: 'Lista 1 • Multiplicador 1.1765 (Margen 15%)' },
  L2: { label: 'Lista 2 (1.2500x)', multiplier: 1.25, description: 'Lista 2 • Multiplicador 1.2500 (Margen 20%)' },
  L2_5: { label: 'Lista 2.5 (1.3330x)', multiplier: 1.333, description: 'Lista 2.5 • Multiplicador 1.3330 (Margen 25%)' },
  L3: { label: 'Lista 3 (1.4286x)', multiplier: 1.4286, description: 'Lista 3 • Multiplicador 1.4286 (Margen 30%)' },
  L3_5: { label: 'Lista 3.5 (1.5384x)', multiplier: 1.5384, description: 'Lista 3.5 • Multiplicador 1.5384 (Margen 35%)' },
  L4: { label: 'Lista 4 (1.5874x)', multiplier: 1.5874, description: 'Lista 4 • Multiplicador 1.5874 (Margen 37%)' },
  L4_5: { label: 'Lista 4.5 (1.6807x)', multiplier: 1.6807, description: 'Lista 4.5 • Multiplicador 1.6807 (Margen 40.5%)' },
  L5: { label: 'Lista 5 (1.7858x)', multiplier: 1.7858, description: 'Lista 5 • Multiplicador 1.7858 (Margen 44%)' },
  L6: { label: 'Lista 6 (1.8519x)', multiplier: 1.8519, description: 'Lista 6 • Multiplicador 1.8519 (Margen 46%)' },
  L7: { label: 'Lista 7 (2.0834x)', multiplier: 2.0834, description: 'Lista 7 • Multiplicador 2.0834 (Margen 52%)' },
  L8: { label: 'Lista 8 (2.3810x)', multiplier: 2.381, description: 'Lista 8 • Multiplicador 2.3810 (Margen 58%)' },
};

export const INITIAL_EQUIPMENTS: MedicalEquipment[] = MASTER_EQUIPMENTS_CATALOG;

export const INITIAL_QUOTE_HEADER: QuoteHeader = {
  quoteNumber: '',
  clientName: '',
  nit: '',
  contactPerson: '',
  contactEmail: '',
  contactPhone: '',
  city: 'Barranquilla',
  date: '',
  validityDays: 30,
  paymentTerms: '50% Anticipo y 50% Contra-entrega.',
  deliveryTime: '90D',
  deliveryPlace: 'Sede Cliente',
  trainingTerms: 'Un (1) día en la ubicación del equipo. Las fechas de las visitas serán acordadas entre las partes.',
  maintenanceTerms: 'SYD COLOMBIA S.A. realizara un (1) mantenimiento preventivo por parte del Servicio Técnico de Nuestra Empresa por parte de un personal altamente calificado y entrenado, en apoyo de la marca para instalar y dar mantenimiento a esta clase de equipos.',
  warrantyTerms: 'Doce (12) meses contados a partir de la fecha de instalación del equipo.',
  taxRate: 0.19,
  advisorName: '',
  advisorRole: 'Especialista Comercial',
  advisorPhone: '',
  advisorEmail: '',
  notes: 'Precios en Pesos Colombianos (COP). Incluye transporte y entrega según condiciones comerciales.',
};

export const INITIAL_DOCUMENTS: TechnicalDocument[] = [];

export const INITIAL_TENDER_HEADER: TenderHeader = {
  entityName: '',
  processNumber: '',
  processType: 'Licitación Pública',
  contractObject: '',
  openingDate: '',
  closingDate: '',
  city: '',
  budgetCOP: 0,
};

export const INITIAL_TENDER_CLIENTS: TenderClientProject[] = [];
