import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Calendar,
  FileSpreadsheet,
  Printer,
  Edit2,
  CheckCircle2,
  Search,
  Check,
  X,
  Wrench,
  GraduationCap,
  ShieldCheck,
  Upload,
  Download,
  Trash2,
  Camera,
  FileText,
  Image as ImageIcon,
  Clock,
  AlertCircle,
  Eye,
  Zap,
  Plus,
  ArrowRight,
  ExternalLink,
  ShieldAlert,
  Truck,
  ReceiptText,
} from 'lucide-react';
import {
  MedicalEquipment,
  TenderClientProject,
  OCTrackingContract,
  MaintenanceFrequencyType,
  SalesInvoiceRecord,
  SalesOrderRecord,
  ItemSerialNumberRecord,
  SerialUnitStatus,
} from '../../../types';
import {
  getStoredSalesInvoices,
  saveStoredSalesInvoices,
  getStoredSalesOrders,
  saveStoredSalesOrders,
} from '../../../utils/salesOrdersStorage';
import {
  getStoredOCTrackingContracts,
  saveStoredOCTrackingContracts,
} from '../../../utils/ocTrackingStorage';
import { isValidOCNumber } from '../../../utils/formatters';

interface MaintenanceScheduleManagerProps {
  equipments: MedicalEquipment[];
  tenderClients?: TenderClientProject[];
  ocContracts?: OCTrackingContract[];
  salesOrders?: SalesOrderRecord[];
  onNavigateToInvoicing?: () => void;
}

// 12 Meses Oficiales del Año
export const MONTHS = [
  { num: 1, key: 'ene', label: 'ENE', full: 'Enero' },
  { num: 2, key: 'feb', label: 'FEB', full: 'Febrero' },
  { num: 3, key: 'mar', label: 'MAR', full: 'Marzo' },
  { num: 4, key: 'abr', label: 'ABR', full: 'Abril' },
  { num: 5, key: 'may', label: 'MAY', full: 'Mayo' },
  { num: 6, key: 'jun', label: 'JUN', full: 'Junio' },
  { num: 7, key: 'jul', label: 'JUL', full: 'Julio' },
  { num: 8, key: 'ago', label: 'AGO', full: 'Agosto' },
  { num: 9, key: 'sep', label: 'SEP', full: 'Septiembre' },
  { num: 10, key: 'oct', label: 'OCT', full: 'Octubre' },
  { num: 11, key: 'nov', label: 'NOV', full: 'Noviembre' },
  { num: 12, key: 'dic', label: 'DIC', full: 'Diciembre' },
];

export const FREQUENCY_OPTIONS: MaintenanceFrequencyType[] = [
  'Semestral',     // Frecuencia estándar por garantía (2 al año cada 6 meses)
  'Cuatrimestral', // 3 al año
  'Trimestral',    // 4 al año
  'Bimestral',     // 6 al año
  'Mensual',       // 12 al año
  'Anual',         // 1 al año
];

// Asignación de actividades por mes
export interface MonthAssignment {
  inst?: boolean;        // I = Instalación de Equipo (fijada por factura o ajustada)
  mp?: 'P' | 'E' | null; // P = Preventivo Programado (cada 6m), E = Preventivo Ejecutado
  mc?: boolean;          // C = Mantenimiento Correctivo (OCASIONAL / solo manual ante falla)
  cap?: boolean;         // CAP = Capacitación (el MISMO DÍA de la instalación)
}

export interface EquipmentScheduleData {
  frequency: MaintenanceFrequencyType; // Por defecto: Semestral (sincronizada con garantía)
  serialNumber?: string;               // Serie real (de Seguimiento OC o editada)
  installationDate?: string;           // Fecha de Instalación (YYYY-MM-DD, por defecto = Fecha de Factura)
  invoiceNumber?: string;              // N° de Factura vinculada
  hasInvoice?: boolean;                // true si ya se subió factura en Ventana 6
  warrantyMonths?: number;             // Por defecto: 12 meses (1 año)
  warrantyEndDate?: string;            // Fecha de fin de garantía (instalación + 1 año)
  months: Record<number, MonthAssignment>;
}

// Estructura de soportes y fotos de capacitación por equipo
export interface TrainingEvidenceItem {
  attendanceDoc?: {
    name: string;
    size: string;
    dataUrl: string;
    uploadedAt: string;
  } | null;
  photos: Array<{
    id: string;
    name: string;
    caption?: string;
    dataUrl: string;
    uploadedAt: string;
  }>;
  trainingDate?: string; // Mismo día de instalación
  trainerName?: string;
  traineesCount?: number;
  status: 'Pendiente' | 'Programada' | 'Realizada';
  notes?: string;
}

const STORAGE_MATRIX_KEY = 'syd_maintenance_matrix_v6';
const STORAGE_TRAINING_KEY = 'syd_maintenance_training_evidence_v3';

const cleanNorm = (str?: string): string => {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
};

// Formatear fecha legible
const formatDateDisplay = (dateStr?: string): string => {
  if (!dateStr) return 'Pendiente';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
  } catch (e) {
    // fallback
  }
  return dateStr;
};

// Calcular fecha fin de garantía (1 año desde la instalación)
function calculateWarrantyEndDate(installDateStr?: string, monthsCount = 12): string | undefined {
  if (!installDateStr) return undefined;
  const d = new Date(installDateStr);
  if (isNaN(d.getTime())) return undefined;
  // Sumar 1 año (12 meses)
  const endD = new Date(d);
  endD.setMonth(endD.getMonth() + monthsCount);
  endD.setDate(endD.getDate() - 1); // 1 día antes del aniversario exacto
  return endD.toISOString().split('T')[0];
}

/**
 * GENERADOR DE CRONOGRAMA SINCRONIZADO CON LA GARANTÍA
 * Reglas de negocio:
 * 1. Garantía técnica: configurable en años (1 año = 12m, 2 años = 24m, 3 años = 36m, etc.).
 * 2. Mantenimientos Preventivos: calculados según frecuencia (Semestral = cada 6m, Trimestral = cada 3m, etc.).
 *    - Mes de instalación: I (Instalación) + CAP (Capacitación el mismo día).
 *    - Preventivos (P): estrictamente DENTRO del periodo de garantía (monthsDiff <= warrantyMonths).
 *    - En Semestral:
 *      * 1 año de garantía: 2 mantenimientos en total (mes +6 y mes +12). En años posteriores (ej: 2028), 0 mantenimientos.
 *      * 3 años de garantía: 6 mantenimientos en total (mes +6, +12, +18, +24, +30, +36) cubriendo los 3 años.
 *    - En Trimestral: cada 3 meses dentro de la garantía (4 al año).
 * 3. Mantenimiento Correctivo (C): Ocasional / solo colocado manualmente ante falla imprevista.
 */
function generateScheduleFromInstallation(
  freq: MaintenanceFrequencyType = 'Semestral',
  installationDate: string | undefined,
  selectedYear: number,
  warrantyMonths: number = 12
): Record<number, MonthAssignment> {
  const result: Record<number, MonthAssignment> = {};
  for (let m = 1; m <= 12; m++) {
    result[m] = { inst: false, mp: null, mc: false, cap: false };
  }

  if (!installationDate) {
    // Si aún no hay fecha de instalación (no facturado), queda en blanco esperando inicio
    return result;
  }

  const d = new Date(installationDate);
  if (isNaN(d.getTime())) {
    return result;
  }

  const instYear = d.getFullYear();
  const instMonth = d.getMonth() + 1; // 1 a 12

  // Mes absoluto de instalación
  const installAbsMonth = instYear * 12 + (instMonth - 1);

  // Intervalo en meses según la frecuencia elegida
  let stepMonths = 6;
  switch (freq) {
    case 'Mensual':
      stepMonths = 1;
      break;
    case 'Bimestral':
      stepMonths = 2;
      break;
    case 'Trimestral':
      stepMonths = 3; // Trimestral = cada 3 meses
      break;
    case 'Cuatrimestral':
      stepMonths = 4;
      break;
    case 'Semestral':
      stepMonths = 6; // Semestral = cada 6 meses
      break;
    case 'Anual':
      stepMonths = 12;
      break;
    default:
      stepMonths = 6;
  }

  const effectiveWarrantyMonths = Math.max(1, warrantyMonths || 12);

  for (let m = 1; m <= 12; m++) {
    const currentAbsMonth = selectedYear * 12 + (m - 1);
    const monthsDiff = currentAbsMonth - installAbsMonth;

    if (monthsDiff < 0) {
      // Mes previo a la instalación (no se programa nada)
      continue;
    }

    if (monthsDiff === 0) {
      // Mes de instalación: Instalación (I) y Capacitación (CAP) el mismo día
      result[m].inst = true;
      result[m].cap = true;
    }

    // Programar Preventivo (P) cada N meses a partir de la instalación DENTRO DE LA GARANTÍA
    // Si la garantía es de 1 año (12m) y Semestral: solo mes +6 y mes +12 (2 mantenimientos en total).
    // Si la garantía es de 3 años (36m) y Semestral: mes +6, +12, +18, +24, +30, +36 (6 en total, 2 por año).
    // Si la garantía ya expiró (ej: año 2028 para un equipo de 1 año instalado en 2025): NO se programa NADA!
    if (monthsDiff > 0 && monthsDiff <= effectiveWarrantyMonths && monthsDiff % stepMonths === 0) {
      result[m].mp = 'P';
    }

    // Mantenimiento Correctivo (C): NUNCA se pre-marca por defecto.
    result[m].mc = false;
  }

  return result;
}

export const MaintenanceScheduleManager: React.FC<MaintenanceScheduleManagerProps> = ({
  equipments = [],
  tenderClients = [],
  ocContracts = [],
  salesOrders = [],
  onNavigateToInvoicing,
}) => {
  const currentYear = new Date().getFullYear();

  // Multi-año (incluye hasta 2028/2029 por defecto para fácil navegación)
  const [availableYears, setAvailableYears] = useState<number[]>(() => {
    return [currentYear - 1, currentYear, currentYear + 1, currentYear + 2, currentYear + 3, currentYear + 4];
  });
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Filtros
  const [filterType, setFilterType] = useState<'all' | 'licitacion_adjudicada' | 'oc_directa'>('all');
  const [clientSearchQuery, setClientSearchQuery] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Versión reactiva de almacenamiento de facturas y OVs
  const [invoicesVersion, setInvoicesVersion] = useState<number>(0);

  useEffect(() => {
    const handleStorageUpdate = () => {
      setInvoicesVersion((v) => v + 1);
    };
    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('syd-sales-orders-updated', handleStorageUpdate);
    window.addEventListener('syd-sales-invoices-updated', handleStorageUpdate);
    window.addEventListener('syd-oc-tracking-updated', handleStorageUpdate);
    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('syd-sales-orders-updated', handleStorageUpdate);
      window.removeEventListener('syd-sales-invoices-updated', handleStorageUpdate);
      window.removeEventListener('syd-oc-tracking-updated', handleStorageUpdate);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // =========================================================================
  // 1. OBTENER INFORMACIÓN DE FACTURACIÓN Y ENTREGA DESDE ÓRDENES DE VENTA Y SEGUIMIENTO DE OC
  // =========================================================================
  const extractCodes = (str?: string): string[] => {
    if (!str) return [];
    const matches = str.match(/[A-Za-z0-9_-]{4,}/g) || [];
    return matches
      .map((m) => cleanNorm(m))
      .filter(
        (m) =>
          m.length >= 4 &&
          !['contrato', 'orden', 'compra', 'directa', 'licitacion', 'adjudicada', 'colombia', 'salud', 'hospital', 'clinica', 'servicios'].includes(m)
      );
  };

  const isOrderMatchingContract = (
    ord: SalesOrderRecord,
    contractId: string,
    contractNumber: string,
    tenderClientId?: string
  ): boolean => {
    if (!ord) return false;

    // 1. Enlace exacto por ID
    if (ord.contractId && ord.contractId === contractId) return true;
    if (ord.tenderClientId && (ord.tenderClientId === contractId || (tenderClientId && ord.tenderClientId === tenderClientId))) {
      return true;
    }

    // 2. Coincidencia estricta de códigos alfanuméricos únicos (ej: HBOC0000000655, LP-045, LIC-2024)
    const cCodes = extractCodes(contractNumber);
    const ordCodes = [
      ...extractCodes(ord.contractNumber),
      ...extractCodes(ord.salesOrderNumber),
    ];

    for (const cCode of cCodes) {
      if (ordCodes.includes(cCode)) return true;
    }

    return false;
  };

  const isInvoiceMatchingContract = (
    inv: SalesInvoiceRecord,
    contractId: string,
    contractNumber: string,
    matchingOrderId?: string
  ): boolean => {
    if (!inv) return false;

    // 1. Vinculada a la orden de venta emparejada
    if (matchingOrderId && inv.salesOrderId && inv.salesOrderId === matchingOrderId) return true;

    // 2. Enlace exacto por contractId
    if (inv.contractId && inv.contractId === contractId) return true;

    // 3. Coincidencia estricta de códigos alfanuméricos
    const cCodes = extractCodes(contractNumber);
    const invCodes = [
      ...extractCodes(inv.contractNumber),
      ...extractCodes(inv.salesOrderNumber),
    ];

    for (const cCode of cCodes) {
      if (invCodes.includes(cCode)) return true;
    }

    return false;
  };

  const lookupContractStatus = (
    contractId: string,
    contractNumber: string,
    tenderClientId?: string,
    isOcSource = false
  ) => {
    try {
      const storedInvoices = getStoredSalesInvoices();
      const storedOrders = getStoredSalesOrders();

      // Encontrar orden de venta emparejada exclusivamente por ID o código de contrato (NUNCA solo por nombre de cliente)
      const matchingOrder = storedOrders.find((ord) =>
        isOrderMatchingContract(ord, contractId, contractNumber, tenderClientId)
      );

      // Encontrar factura directa emparejada
      const directInv = storedInvoices.find((inv) =>
        isInvoiceMatchingContract(inv, contractId, contractNumber, matchingOrder?.id)
      );

      // Encontrar registro en seguimiento de OC
      const matchingOC = (ocContracts || []).find((oc) => {
        if (oc.id === contractId) return true;
        if (tenderClientId && oc.tenderClientId === tenderClientId) return true;
        return false;
      });

      // 1. Detección de Entrega Física de Equipos
      const isOrderDelivered = Boolean(
        matchingOrder &&
          ((matchingOrder.status as any) === 'Entregada' ||
            matchingOrder.status === 'Facturada' ||
            Boolean(matchingOrder.actualDeliveryDate) ||
            matchingOrder.items?.some((i) => i.equipmentStatus === 'Entregado al Cliente'))
      );

      const isOcDelivered = Boolean(
        matchingOC &&
          ((matchingOC.globalStatus as any) === 'Entregado' ||
            (matchingOC.globalStatus as any) === 'Entregada' ||
            (matchingOC.globalStatus as any) === 'Instalada' ||
            (matchingOC.globalStatus as any) === 'Completada' ||
            (matchingOC as any).status === 'Entregado' ||
            Boolean(matchingOC.actualDeliveryDate))
      );

      const isDelivered = isOrderDelivered || isOcDelivered;
      const deliveryDate =
        matchingOrder?.actualDeliveryDate ||
        matchingOrder?.dispatchDate ||
        matchingOC?.actualDeliveryDate;

      // 2. Detección de Factura Radicada
      const isOrderInvoiced = Boolean(
        matchingOrder &&
          (matchingOrder.status === 'Facturada' ||
            matchingOrder.invoicedStatus === 'Facturada Total' ||
            Boolean(matchingOrder.invoiceNumber) ||
            Boolean(matchingOrder.attachedInvoiceFile))
      );

      const hasInvoice = Boolean(directInv || isOrderInvoiced);

      let invoiceNumber: string | undefined = undefined;
      let invoiceDate: string | undefined = undefined;
      let attachedFile: any = undefined;

      if (directInv && (directInv.issueDate || directInv.createdAt)) {
        invoiceNumber = directInv.invoiceNumber || 'Factura Electrónica';
        invoiceDate = directInv.issueDate || directInv.createdAt.split('T')[0];
        attachedFile = directInv.attachedInvoiceFile;
      } else if (matchingOrder && isOrderInvoiced) {
        invoiceNumber = matchingOrder.invoiceNumber || 'Facturada';
        const rawDate =
          (matchingOrder as any).invoicedDate ||
          matchingOrder.invoiceDate ||
          (matchingOrder.status === 'Facturada' ? matchingOrder.updatedAt || matchingOrder.createdAt : undefined);
        if (rawDate) {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            invoiceDate = d.toISOString().split('T')[0];
          }
        }
        attachedFile = matchingOrder.attachedInvoiceFile;
      }

      return {
        isDelivered,
        deliveryDate,
        hasInvoice,
        invoiceNumber,
        invoiceDate,
        attachedFile,
        matchingOrder,
      };
    } catch (e) {
      console.error('Error buscando estado de contrato/factura:', e);
      return {
        isDelivered: false,
        deliveryDate: undefined,
        hasInvoice: false,
        invoiceNumber: undefined,
        invoiceDate: undefined,
        attachedFile: undefined,
        matchingOrder: undefined,
      };
    }
  };

  // =========================================================================
  // 2. ENCONTRAR SERIALES REALES Y VERIFICAR ENTREGA E INSTALACIÓN DE EQUIPOS
  // =========================================================================
  // Normalizador de estados que indican entrega e instalación hospitalaria
  const isInstalledStatus = (st?: string): boolean => {
    if (!st) return false;
    const s = st
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    // Filtro de exclusión para estados pendientes, borradores o no instalados
    if (
      s.includes('pendiente') ||
      s.includes('no instalad') ||
      s.includes('sin entreg') ||
      s.includes('por entreg') ||
      s.includes('por instal') ||
      s.includes('borrador') ||
      s.includes('fabricacion') ||
      s.includes('transito') ||
      s.includes('bodega')
    ) {
      return false;
    }

    return (
      s.includes('entregado e instalad') ||
      s.includes('entregada e instalad') ||
      s.includes('entregados e instalad') ||
      s.includes('entregadas e instalad') ||
      s.includes('entregado al cliente') ||
      s.includes('entregada al cliente') ||
      s.includes('entregados al cliente') ||
      s.includes('instalado en ips') ||
      s.includes('instalada en ips') ||
      s.includes('instalado') ||
      s.includes('instalada') ||
      s.includes('instalados') ||
      s.includes('instaladas') ||
      s.includes('instalacion') ||
      s.includes('cerrado / concluido') ||
      s.includes('cerrado') ||
      s.includes('concluido') ||
      s.includes('cumplido') ||
      s.includes('finalizado') ||
      s === 'entregado' ||
      s === 'entregada' ||
      s === 'entregados'
    );
  };

  // Helper estricto de negocio: Solo los equipos con estado 'Entregado e Instalado'
  // se incluyen en el cronograma oficial de mantenimiento, instalación y capacitación.
  const checkItemDeliveryAndInstallation = (
    contractId: string,
    contractNumber: string,
    tenderClientId: string | undefined,
    itemId: string,
    itemName: string,
    itemModel: string,
    itDirect?: any,
    ocDirect?: any
  ): {
    isDeliveredAndInstalled: boolean;
    deliveryDate?: string;
    serialNumber?: string;
    ocNumber?: string;
  } => {
    const cleanItemName = cleanNorm(itemName);
    const cleanItemModel = cleanNorm(itemModel);

    // 1. Verificación directa en el ítem de OC (Paso B)
    if (itDirect) {
      const directItemInstalled = isInstalledStatus(itDirect.status) || isInstalledStatus(itDirect.equipmentStatus);
      const directSerialInstalled = Boolean(
        itDirect.serialNumbers &&
        Array.isArray(itDirect.serialNumbers) &&
        itDirect.serialNumbers.some((sn: any) => isInstalledStatus(sn.status))
      );
      const directContractInstalled = isInstalledStatus(ocDirect?.status);

      if (directItemInstalled || directSerialInstalled || directContractInstalled) {
        const dDate =
          itDirect.deliveryDate ||
          itDirect.actualDeliveryDate ||
          itDirect.installedDate ||
          itDirect.receptionDate ||
          itDirect.serialNumbers?.find((sn: any) => isInstalledStatus(sn.status) && (sn.deliveryDate || sn.receptionDate))?.deliveryDate ||
          itDirect.serialNumbers?.find((sn: any) => sn.deliveryDate || sn.receptionDate)?.deliveryDate ||
          ocDirect?.actualDeliveryDate ||
          ocDirect?.deliveryDate ||
          new Date().toISOString().split('T')[0];

        let realSerial = '';
        if (itDirect.serialNumbers && itDirect.serialNumbers.length > 0) {
          realSerial = itDirect.serialNumbers.map((s: any) => s.serialNumber?.trim()).filter(Boolean).join(', ');
        } else if (itDirect.serialNumber && itDirect.serialNumber.trim()) {
          realSerial = itDirect.serialNumber.trim();
        } else if (itDirect.assignedSerialNumbers && itDirect.assignedSerialNumbers.length > 0) {
          realSerial = itDirect.assignedSerialNumbers.filter(Boolean).join(', ');
        }

        return {
          isDeliveredAndInstalled: true,
          deliveryDate: dDate,
          serialNumber: realSerial,
          ocNumber: itDirect.ocNumber || ocDirect?.ocNumber,
        };
      }
    }

    // 2. Buscar en Seguimiento de Órdenes de Compra (ocContracts)
    for (const oc of ocContracts || []) {
      const isMatch =
        oc.id === contractId ||
        (tenderClientId && oc.tenderClientId === tenderClientId) ||
        (oc.tenderClientId && (oc.tenderClientId === contractId || oc.tenderClientId === tenderClientId)) ||
        isOrderMatchingContract(oc as any, contractId, contractNumber, tenderClientId);

      if (isMatch) {
        const ocInstalled = isInstalledStatus(oc.globalStatus) || isInstalledStatus((oc as any).status);

        for (const it of oc.items || []) {
          const isItemMatch =
            it.id === itemId ||
            it.equipmentId === itemId ||
            (cleanItemName && cleanNorm(it.name) === cleanItemName) ||
            (cleanItemModel && cleanNorm(it.model) === cleanItemModel);

          if (isItemMatch) {
            const itemInstalled = isInstalledStatus(it.status);
            const serialInstalled = Boolean(
              it.serialNumbers &&
              Array.isArray(it.serialNumbers) &&
              it.serialNumbers.some((sn: any) => isInstalledStatus(sn.status))
            );

            if (itemInstalled || serialInstalled || ocInstalled) {
              const dDate =
                it.deliveryDate ||
                (it as any).actualDeliveryDate ||
                it.installedDate ||
                it.receptionDate ||
                it.serialNumbers?.find((sn: any) => isInstalledStatus(sn.status) && (sn.deliveryDate || sn.receptionDate))?.deliveryDate ||
                it.serialNumbers?.find((sn: any) => sn.deliveryDate || sn.receptionDate)?.deliveryDate ||
                oc.actualDeliveryDate ||
                oc.deliveryDate ||
                new Date().toISOString().split('T')[0];

              let realSerial = '';
              if (it.serialNumbers && it.serialNumbers.length > 0) {
                realSerial = it.serialNumbers.map((s: any) => s.serialNumber?.trim()).filter(Boolean).join(', ');
              } else if (it.serialNumber && it.serialNumber.trim()) {
                realSerial = it.serialNumber.trim();
              } else if (it.assignedSerialNumbers && it.assignedSerialNumbers.length > 0) {
                realSerial = it.assignedSerialNumbers.filter(Boolean).join(', ');
              }

              return {
                isDeliveredAndInstalled: true,
                deliveryDate: dDate,
                serialNumber: realSerial,
                ocNumber: it.ocNumber || oc.ocNumber,
              };
            }
          }
        }
      }
    }

    // 3. Buscar en Órdenes de Venta (Sales Orders)
    try {
      const storedOrders = getStoredSalesOrders();
      for (const ord of storedOrders) {
        if (isOrderMatchingContract(ord, contractId, contractNumber, tenderClientId)) {
          const ordInstalled = isInstalledStatus(ord.status);

          for (const oi of ord.items || []) {
            const isItemMatch =
              oi.id === itemId ||
              oi.equipmentId === itemId ||
              (cleanItemName && cleanNorm(oi.name) === cleanItemName);

            if (isItemMatch) {
              const ordItemInstalled = isInstalledStatus(oi.equipmentStatus) || isInstalledStatus((oi as any).status);

              if (ordItemInstalled || ordInstalled) {
                const dDate =
                  ord.actualDeliveryDate ||
                  ord.dispatchDate ||
                  (oi as any).deliveryDate ||
                  (oi as any).installedDate ||
                  new Date().toISOString().split('T')[0];

                const realSerial = (oi as any).serialNumber || oi.assignedSerialNumbers?.filter(Boolean).join(', ') || '';
                return {
                  isDeliveredAndInstalled: true,
                  deliveryDate: dDate,
                  serialNumber: realSerial,
                  ocNumber: oi.supplierOCRef || (ord as any).orderNumber || ord.salesOrderNumber,
                };
              }
            }
          }
        }
      }
    } catch (e) {}

    return { isDeliveredAndInstalled: false };
  };

  const checkItemHasOC = (
    contractId: string,
    contractNumber: string,
    tenderClientId: string | undefined,
    itemId: string,
    itemName: string,
    itemModel: string
  ): { hasOC: boolean; ocNumber?: string; serialNumber?: string } => {
    const cleanItemName = cleanNorm(itemName);
    const cleanItemModel = cleanNorm(itemModel);

    // 1. Buscar en Seguimiento de Órdenes de Compra (Window 6)
    for (const oc of ocContracts || []) {
      const isMatch =
        oc.id === contractId ||
        (tenderClientId && oc.tenderClientId === tenderClientId) ||
        (oc.tenderClientId && (oc.tenderClientId === contractId || oc.tenderClientId === tenderClientId)) ||
        isOrderMatchingContract(oc as any, contractId, contractNumber, tenderClientId);

      if (isMatch) {
        for (const it of oc.items || []) {
          const isItemMatch =
            it.id === itemId ||
            it.equipmentId === itemId ||
            (cleanItemName && cleanNorm(it.name) === cleanItemName) ||
            (cleanItemModel && cleanNorm(it.model) === cleanItemModel);

          if (isItemMatch) {
            const itemOC = (it.ocNumber || '').trim();
            const contractOC = (oc.ocNumber || '').trim();
            const validItemOC = Boolean(
              itemOC &&
              !itemOC.toLowerCase().includes('sin') &&
              !itemOC.toLowerCase().includes('pendiente') &&
              itemOC !== '-'
            );
            const validContractOC = Boolean(
              contractOC &&
              !contractOC.toLowerCase().includes('sin') &&
              !contractOC.toLowerCase().includes('pendiente') &&
              contractOC !== '-'
            );

            let realSerial = '';
            if (it.serialNumbers && it.serialNumbers.length > 0) {
              realSerial = it.serialNumbers.map((s) => s.serialNumber?.trim()).filter(Boolean).join(', ');
            } else if (it.serialNumber && it.serialNumber.trim()) {
              realSerial = it.serialNumber.trim();
            } else if (it.assignedSerialNumbers && it.assignedSerialNumbers.length > 0) {
              realSerial = it.assignedSerialNumbers.filter(Boolean).join(', ');
            }

            // Also check equipmentSettingsStore
            try {
              const rawSettings = localStorage.getItem('syd_maintenance_equipment_settings_v4');
              if (rawSettings) {
                const parsed = JSON.parse(rawSettings);
                const sItem = parsed[contractId]?.[itemId]?.serialNumber || parsed[oc.id]?.[it.id]?.serialNumber;
                if (sItem && sItem.trim()) {
                  realSerial = realSerial || sItem.trim();
                }
              }
            } catch (e) {}

            const hasSerials = Boolean(realSerial && realSerial.trim());
            const isDirectOC = Boolean(oc.isDirectOC || oc.sourceType === 'oc_directa');

            const hasRealOC = Boolean(
              validItemOC ||
              hasSerials ||
              (isDirectOC && validContractOC && !itemOC.toLowerCase().includes('sin') && !itemOC.toLowerCase().includes('pendiente'))
            );

            return {
              hasOC: hasRealOC,
              ocNumber: validItemOC ? itemOC : (validContractOC ? contractOC : undefined),
              serialNumber: realSerial,
            };
          }
        }
      }
    }

    // 2. Buscar en Órdenes de Venta (Window 7)
    try {
      const storedOrders = getStoredSalesOrders();
      for (const ord of storedOrders) {
        if (isOrderMatchingContract(ord, contractId, contractNumber, tenderClientId)) {
          for (const oi of ord.items || []) {
            const isItemMatch =
              oi.id === itemId ||
              oi.equipmentId === itemId ||
              (cleanItemName && cleanNorm(oi.name) === cleanItemName);

            if (isItemMatch) {
              const orderOC = (oi.supplierOCRef || (ord as any).orderNumber || ord.salesOrderNumber || '').trim();
              const realSerial = (oi as any).serialNumber || oi.assignedSerialNumbers?.filter(Boolean).join(', ') || '';
              const validOrderOC = Boolean(
                oi.supplierOCRef &&
                !oi.supplierOCRef.toLowerCase().includes('sin') &&
                !oi.supplierOCRef.toLowerCase().includes('pendiente') &&
                oi.supplierOCRef !== '-'
              );
              const hasRealOC = Boolean(
                validOrderOC ||
                Boolean(realSerial && realSerial.trim())
              );
              return {
                hasOC: hasRealOC,
                ocNumber: orderOC,
                serialNumber: realSerial,
              };
            }
          }
        }
      }
    } catch (e) {
      // ignore
    }

    return { hasOC: false };
  };

  const findRealSerialsFromOCTracking = (
    contractId: string,
    itemId: string,
    itemName: string,
    itemModel: string
  ): string => {
    // 1. Primero verificar configuración local guardada
    try {
      const rawSettings = localStorage.getItem('syd_maintenance_equipment_settings_v4');
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings);
        if (parsed[contractId]?.[itemId]?.serialNumber) {
          return parsed[contractId][itemId].serialNumber;
        }
      }
    } catch (e) {}

    // 2. Buscar en Seguimiento de OC y Órdenes de Venta
    const ocCheck = checkItemHasOC(contractId, '', undefined, itemId, itemName, itemModel);
    if (ocCheck.serialNumber) {
      return ocCheck.serialNumber;
    }

    return '';
  };

  // Sincronizar número de serie bidireccionalmente a Seguimiento de OC y Órdenes de Venta
  const syncSerialNumberToAllStores = (
    contractId: string,
    contractNumber: string,
    itemId: string,
    itemName: string,
    itemModel: string,
    newSerial: string
  ) => {
    const trimmedSerial = (newSerial || '').trim();
    if (!trimmedSerial) return;

    // A. Sincronizar en Seguimiento de OC (Window 6)
    try {
      const storedOCs = getStoredOCTrackingContracts();
      let ocModified = false;
      const cleanTargetName = cleanNorm(itemName);
      const cleanTargetModel = cleanNorm(itemModel);

      const updatedOCs = storedOCs.map((oc) => {
        const isMatchContract =
          oc.id === contractId ||
          oc.tenderClientId === contractId ||
          (contractNumber && (cleanNorm(oc.contractNumber) === cleanNorm(contractNumber) || isOrderMatchingContract(oc as any, contractId, contractNumber)));

        if (!isMatchContract) return oc;

        const updatedItems = (oc.items || []).map((it) => {
          const isMatchItem =
            it.id === itemId ||
            it.equipmentId === itemId ||
            (cleanTargetName && cleanNorm(it.name) === cleanTargetName) ||
            (cleanTargetModel && cleanNorm(it.model) === cleanTargetModel);

          if (!isMatchItem) return it;

          ocModified = true;
          const existingSerials = it.serialNumbers || [];
          const updatedSerialsList: ItemSerialNumberRecord[] = existingSerials.length > 0
            ? existingSerials.map((s, sIdx) => sIdx === 0 ? { ...s, serialNumber: trimmedSerial, status: (s.status || 'Entregado e Instalado') as SerialUnitStatus } : s)
            : [{ id: `sn-${Date.now()}-1`, serialNumber: trimmedSerial, status: 'Entregado e Instalado', inventoryPlate: '', documents: [] }];

          return {
            ...it,
            serialNumber: trimmedSerial,
            serialNumbers: updatedSerialsList,
            assignedSerialNumbers: [trimmedSerial],
            lastUpdatedAt: new Date().toISOString(),
          };
        });

        return {
          ...oc,
          items: updatedItems,
          lastUpdatedAt: new Date().toISOString(),
        };
      });

      if (ocModified) {
        saveStoredOCTrackingContracts(updatedOCs);
        window.dispatchEvent(new Event('syd-oc-tracking-updated'));
        window.dispatchEvent(new Event('storage'));
      }
    } catch (e) {
      console.error('Error sincronizando serial con Seguimiento de OC:', e);
    }

    // B. Sincronizar en Órdenes de Venta (Window 7)
    try {
      const storedOrders = getStoredSalesOrders();
      let orderModified = false;
      const cleanTargetName = cleanNorm(itemName);

      const updatedOrders = storedOrders.map((ord) => {
        const isMatchOrder = isOrderMatchingContract(ord, contractId, contractNumber);
        if (!isMatchOrder) return ord;

        const updatedItems = (ord.items || []).map((oi) => {
          const isMatchItem =
            oi.id === itemId ||
            oi.equipmentId === itemId ||
            (cleanTargetName && cleanNorm(oi.name) === cleanTargetName);

          if (!isMatchItem) return oi;

          orderModified = true;
          return {
            ...oi,
            serialNumber: trimmedSerial,
            assignedSerialNumbers: [trimmedSerial],
          };
        });

        return {
          ...ord,
          items: updatedItems,
          updatedAt: new Date().toISOString(),
        };
      });

      if (orderModified) {
        saveStoredSalesOrders(updatedOrders);
        window.dispatchEvent(new Event('syd-sales-orders-updated'));
        window.dispatchEvent(new Event('storage'));
      }
    } catch (e) {
      console.error('Error sincronizando serial con Órdenes de Venta:', e);
    }
  };

  // =========================================================================
  // 3. CONTRATOS REALES DINÁMICOS: SEGUIMIENTO DE OC, ÓRDENES DE VENTA Y LICITACIONES
  // =========================================================================
  const contractsList = useMemo(() => {
    // 1. Obtener todas las fuentes de datos vivas
    const allOCsMap = new Map<string, OCTrackingContract>();
    (ocContracts || []).forEach((c) => {
      if (c && c.id) allOCsMap.set(c.id, c);
    });
    try {
      const fromStorage = getStoredOCTrackingContracts();
      (fromStorage || []).forEach((c) => {
        if (c && c.id) {
          const prev = allOCsMap.get(c.id);
          if (prev) {
            allOCsMap.set(c.id, {
              ...c,
              ...prev,
              items: (prev.items && prev.items.length > 0) ? prev.items : (c.items || []),
            });
          } else {
            allOCsMap.set(c.id, c);
          }
        }
      });
    } catch (e) {}
    const combinedOCs = Array.from(allOCsMap.values());

    let storedSOs: SalesOrderRecord[] = [];
    try {
      storedSOs = (salesOrders && salesOrders.length > 0 ? salesOrders : getStoredSalesOrders()) || [];
    } catch (e) {}

    const allTendersMap = new Map<string, TenderClientProject>();
    (tenderClients || []).forEach((tc) => {
      if (tc && tc.id) allTendersMap.set(tc.id, tc);
    });
    try {
      const rawTenders = localStorage.getItem('syd_tender_clients_v2');
      if (rawTenders) {
        const parsedTenders = JSON.parse(rawTenders);
        if (Array.isArray(parsedTenders)) {
          parsedTenders.forEach((tc: TenderClientProject) => {
            if (tc && tc.id && !allTendersMap.has(tc.id)) {
              allTendersMap.set(tc.id, tc);
            }
          });
        }
      }
    } catch (e) {}
    const combinedTenders = Array.from(allTendersMap.values());

    // 2. Extraer códigos clave de un registro (contrato, OV, licitación)
    const extractCodesFromRecord = (rec: any): string[] => {
      if (!rec) return [];
      const sources = [
        rec.contractNumber,
        rec.salesOrderNumber,
        rec.orderNumber,
        rec.quoteNumber,
        rec.tenderClientId,
        rec.header?.processNumber,
        rec.header?.contractNumber,
        rec.processNumber,
        rec.tenderProcessNumber,
      ].filter(Boolean);

      const codes = new Set<string>();
      sources.forEach((s) => {
        const matches = String(s).match(/[A-Za-z0-9_-]{4,}/g) || [];
        matches.forEach((m) => {
          const clean = cleanNorm(m);
          if (
            clean.length >= 4 &&
            !['contrato', 'orden', 'compra', 'directa', 'licitacion', 'adjudicada', 'colombia', 'salud', 'hospital', 'clinica', 'servicios'].includes(clean)
          ) {
            codes.add(clean);
          }
        });
      });
      return Array.from(codes);
    };

    // 3. Estructura de candidato a Contrato / Expediente unificado
    interface CandidateContract {
      id: string;
      tenderClientId?: string;
      clientName: string;
      clientNit: string;
      city: string;
      contractNumber: string;
      codes: Set<string>;
      isTender: boolean;
      matchingOCs: OCTrackingContract[];
      matchingSOs: SalesOrderRecord[];
      matchingTenders: TenderClientProject[];
    }

    const candidateList: CandidateContract[] = [];

    const findMatchingCandidate = (rec: any): CandidateContract | undefined => {
      const recCodes = extractCodesFromRecord(rec);
      const recClient = cleanNorm(
        rec.clientName ||
        rec.customerName ||
        rec.detectedCustomer ||
        rec.supplier ||
        rec.header?.clientName ||
        rec.header?.entityName ||
        ''
      );

      return candidateList.find((cand) => {
        // A. Coincidencia por ID o relación directa
        if (cand.id === rec.id) return true;
        if (cand.tenderClientId && (rec.tenderClientId === cand.tenderClientId || rec.id === cand.tenderClientId || rec.contractId === cand.tenderClientId)) return true;
        if (rec.tenderClientId && (cand.id === rec.tenderClientId || cand.tenderClientId === rec.tenderClientId)) return true;
        if (rec.contractId && (cand.id === rec.contractId || cand.matchingOCs.some((o) => o.id === rec.contractId))) return true;
        if (rec.ocContractId && (cand.id === rec.ocContractId || cand.matchingOCs.some((o) => o.id === rec.ocContractId))) return true;

        // B. Coincidencia por código de proceso o contrato específico (ej: HBOC0000000655, 1152149, LP-045)
        if (recCodes.some((code) => cand.codes.has(code))) return true;

        // NUNCA emparejar solo por nombre de cliente: un mismo cliente puede tener múltiples OCs diferentes
        return false;
      });
    };

    // A. Incorporar desde Seguimiento de OC
    combinedOCs.forEach((oc) => {
      if (!oc) return;
      const rawContractNum = oc.contractNumber || '';
      const cleanContractNum = rawContractNum.replace(/^ov:\s*/i, '').trim();
      const clientName = oc.clientName || oc.supplier || 'Cliente';
      const processRef = cleanContractNum || oc.tenderClientId || (oc.quoteNumber ? `Cotiz: ${oc.quoteNumber}` : oc.ocNumber || '');

      const isTender =
        oc.sourceType === 'licitacion_adjudicada' ||
        Boolean(oc.tenderClientId) ||
        cleanContractNum.toLowerCase().startsWith('nohb') ||
        cleanContractNum.toLowerCase().startsWith('hboc') ||
        cleanContractNum.toLowerCase().startsWith('lic') ||
        cleanContractNum.toLowerCase().startsWith('contrato');

      const candCodes = extractCodesFromRecord(oc);
      const existing = findMatchingCandidate(oc);

      if (existing) {
        if (!existing.matchingOCs.some((c) => c.id === oc.id)) {
          existing.matchingOCs.push(oc);
        }
        candCodes.forEach((c) => existing.codes.add(c));
        if (isTender) existing.isTender = true;
        if (!existing.clientNit || existing.clientNit === 'NIT en trámite') {
          existing.clientNit = oc.nit || 'NIT en trámite';
        }
        if (!existing.city || existing.city === 'Colombia') {
          existing.city = oc.city || 'Colombia';
        }
      } else {
        candidateList.push({
          id: oc.id,
          tenderClientId: oc.tenderClientId,
          clientName,
          clientNit: oc.nit || 'NIT en trámite',
          city: oc.city || 'Colombia',
          contractNumber: processRef || oc.salesOrderNumber || `OC-${oc.id.slice(-4)}`,
          codes: new Set(candCodes),
          isTender,
          matchingOCs: [oc],
          matchingSOs: [],
          matchingTenders: [],
        });
      }
    });

    // B. Incorporar desde Licitaciones y Contratos (tenderClients)
    combinedTenders.forEach((tc) => {
      if (!tc) return;
      const clientName = tc.clientName || tc.header?.entityName || tc.header?.clientName || 'Cliente';
      const processRef = tc.header?.processNumber || (tc.header as any)?.contractNumber || (tc as any).contractNumber || `LIC-${tc.id.slice(-4)}`;
      const candCodes = extractCodesFromRecord(tc);
      const existing = findMatchingCandidate(tc);

      if (existing) {
        if (!existing.matchingTenders.some((t) => t.id === tc.id)) {
          existing.matchingTenders.push(tc);
        }
        candCodes.forEach((c) => existing.codes.add(c));
        existing.isTender = true;
        if (!existing.clientNit || existing.clientNit === 'NIT en trámite') {
          existing.clientNit = tc.nit || tc.header?.nit || 'NIT en trámite';
        }
        if (!existing.city || existing.city === 'Colombia') {
          existing.city = tc.header?.city || 'Colombia';
        }
      } else {
        candidateList.push({
          id: tc.id,
          tenderClientId: tc.id,
          clientName,
          clientNit: tc.nit || tc.header?.nit || 'NIT en trámite',
          city: tc.header?.city || 'Colombia',
          contractNumber: processRef,
          codes: new Set(candCodes),
          isTender: true,
          matchingOCs: [],
          matchingSOs: [],
          matchingTenders: [tc],
        });
      }
    });

    // C. Asociar Órdenes de Venta (storedSOs)
    storedSOs.forEach((so) => {
      if (!so) return;
      const soClient = so.clientName || (so as any).customerName || (so as any).detectedCustomer || 'Cliente';
      const soProc = so.contractNumber || so.salesOrderNumber || '';
      const candCodes = extractCodesFromRecord(so);
      const existing = findMatchingCandidate(so);

      if (existing) {
        if (!existing.matchingSOs.some((o) => o.id === so.id)) {
          existing.matchingSOs.push(so);
        }
        candCodes.forEach((c) => existing.codes.add(c));
      } else if (so.items && so.items.length > 0) {
        candidateList.push({
          id: so.id,
          clientName: soClient,
          clientNit: so.clientNit || (so as any).customerNit || 'NIT en trámite',
          city: so.clientCity || (so as any).shippingCity || 'Colombia',
          contractNumber: soProc || `OV-${so.id.slice(-4)}`,
          codes: new Set(candCodes),
          isTender: Boolean(so.contractNumber && /HBOC|LIC|NoHB/i.test(so.contractNumber)),
          matchingOCs: [],
          matchingSOs: [so],
          matchingTenders: [],
        });
      }
    });

    // 4. Evaluar equipos de cada candidato bajo la REGLA ESTRICTA DE NEGOCIO:
    // Solo se incluyen los equipos con estado 'Entregado e Instalado'.
    // Si un contrato tiene 10 equipos y solo 5 están entregados, aparecen ÚNICAMENTE esos 5.
    // A medida que con el tiempo se marquen más equipos, aparecerán dinámicamente aquí.
    const list: {
      id: string;
      clientId: string;
      clientName: string;
      clientNit: string;
      city: string;
      contractNumber: string;
      sourceType: 'licitacion_adjudicada' | 'oc_directa';
      isDelivered: boolean;
      deliveryDate?: string;
      hasInvoice: boolean;
      invoiceNumber?: string;
      defaultInvoiceDate?: string;
      attachedInvoiceFile?: any;
      items: Array<{
        id: string;
        name: string;
        brand: string;
        model: string;
        hasOC: boolean;
        ocNumber?: string;
        realSerialFromOC: string;
        quantity: number;
        deliveryDate?: string;
        isDeliveredAndInstalled: boolean;
        isInvoiced: boolean;
      }>;
    }[] = [];

    candidateList.forEach((cand) => {
      // Recopilar todas las representaciones de equipos del contrato
      const rawEquipmentPool: any[] = [];

      cand.matchingOCs.forEach((oc) => {
        (oc.items || []).forEach((it) => {
          rawEquipmentPool.push({ ...it, _source: 'oc', _parentOC: oc });
        });
      });

      cand.matchingSOs.forEach((so) => {
        (so.items || []).forEach((soIt) => {
          rawEquipmentPool.push({ ...soIt, _source: 'so', _parentSO: so });
        });
      });

      cand.matchingTenders.forEach((tc) => {
        (tc.items || []).forEach((tIt) => {
          // Un ítem de licitación propuesta SOLO entra si tiene Orden de Compra (OC) generada o asignada
          const tItName = cleanNorm(tIt.name);
          const tItModel = cleanNorm(tIt.model);
          const hasLinkedOCorSO =
            Boolean((tIt as any).hasOC || ((tIt as any).ocNumber && isValidOCNumber((tIt as any).ocNumber)) || (tIt as any).orderNumber) ||
            cand.matchingOCs.some((oc) =>
              (oc.items || []).some(
                (oi) =>
                  oi.id === tIt.id ||
                  (oi.name && cleanNorm(oi.name) === tItName) ||
                  (oi.model && tItModel && cleanNorm(oi.model) === tItModel)
              )
            ) ||
            cand.matchingSOs.some((so) =>
              (so.items || []).some(
                (si) =>
                  si.id === tIt.id ||
                  (si.name && cleanNorm(si.name) === tItName) ||
                  (si.model && tItModel && cleanNorm(si.model) === tItModel)
              )
            );

          if (hasLinkedOCorSO) {
            rawEquipmentPool.push({ ...tIt, _source: 'tender', _parentTender: tc });
          }
        });
      });

      // Agrupar representaciones del mismo equipo biomédico
      interface EquipmentGroup {
        reps: any[];
      }
      const eqGroups: EquipmentGroup[] = [];

      rawEquipmentPool.forEach((it) => {
        const itCode = cleanNorm(it.code);
        const itName = cleanNorm(it.name || it.equipmentName);
        const itModel = cleanNorm(it.model || it.modelo);

        let group = eqGroups.find((g) => {
          return g.reps.some((r) => {
            if (it.id && r.id && String(it.id) === String(r.id)) return true;
            if (it.equipmentId && r.equipmentId && String(it.equipmentId) === String(r.equipmentId)) return true;
            if (it.salesOrderItemId && r.id && String(it.salesOrderItemId) === String(r.id)) return true;
            if (r.salesOrderItemId && it.id && String(r.salesOrderItemId) === String(it.id)) return true;
            const rCode = cleanNorm(r.code);
            if (itCode && rCode && itCode === rCode && itCode !== 'na') return true;
            const rName = cleanNorm(r.name || r.equipmentName);
            if (itName && rName && (itName === rName || itName.includes(rName) || rName.includes(itName))) {
              const rModel = cleanNorm(r.model || r.modelo);
              if (!itModel || !rModel || itModel === rModel) return true;
            }
            return false;
          });
        });

        if (!group) {
          group = { reps: [] };
          eqGroups.push(group);
        }
        group.reps.push(it);
      });

      // EVALUAR ESTRICTAMENTE SI CADA EQUIPO TIENE OC Y ESTÁ ENTREGADO E INSTALADO
      const deliveredItems: any[] = [];

      eqGroups.forEach((group, gIdx) => {
        // 1. REGLA ESTRICTA DE NEGOCIO: El equipo DEBE tener una Orden de Compra (OC) válida
        // Si no tiene OC generada/asignada, no entra al cronograma ("el ultimo no tiene ni orden de compra")
        const hasValidOC = group.reps.some((r) => {
          if (r.hasOC === true) return true;
          if (r.ocNumber && isValidOCNumber(r.ocNumber)) return true;
          if (r.supplierOCRef && isValidOCNumber(r.supplierOCRef)) return true;
          if (r.linkedSupplierOCNumber && isValidOCNumber(r.linkedSupplierOCNumber)) return true;
          if (r._source === 'oc' && isValidOCNumber(r._parentOC?.ocNumber)) return true;
          if (r._source === 'so' && (Boolean(r._parentSO?.salesOrderNumber) || isValidOCNumber(r.supplierOCRef))) return true;
          return false;
        });

        if (!hasValidOC) return;

        let isDeliveredAndInstalled = false;
        let deliveryDate: string | undefined = undefined;
        let realSerial = '';
        let ocNumber = '';
        let bestName = '';
        let bestBrand = '';
        let bestModel = '';
        let bestQty = 1;
        let primaryId = '';

        for (const rep of group.reps) {
          if (!primaryId && rep.id) primaryId = rep.id;
          if (!bestName && (rep.name || rep.equipmentName)) bestName = rep.name || rep.equipmentName;
          if (!bestBrand && (rep.brand || rep.marca)) bestBrand = rep.brand || rep.marca;
          if (!bestModel && (rep.model || rep.modelo)) bestModel = rep.model || rep.modelo;
          if (rep.quantity && Number(rep.quantity) > bestQty) bestQty = Number(rep.quantity);
          if (rep.quantityToDispatch && Number(rep.quantityToDispatch) > bestQty) bestQty = Number(rep.quantityToDispatch);

          // A. Estado directo del ítem o estado de despacho
          if (isInstalledStatus(rep.status) || isInstalledStatus(rep.equipmentStatus)) {
            isDeliveredAndInstalled = true;
          }

          // B. Estado de seriales individuales
          if (rep.serialNumbers && Array.isArray(rep.serialNumbers)) {
            for (const sn of rep.serialNumbers) {
              if (isInstalledStatus(sn.status)) {
                isDeliveredAndInstalled = true;
              }
              if (sn.serialNumber && !realSerial) realSerial = sn.serialNumber.trim();
              if ((sn.deliveryDate || sn.receptionDate) && !deliveryDate) {
                deliveryDate = sn.deliveryDate || sn.receptionDate;
              }
            }
          }
          if (rep.serialNumber && !realSerial) realSerial = rep.serialNumber.trim();
          if (rep.assignedSerialNumbers?.length && !realSerial) realSerial = rep.assignedSerialNumbers[0].trim();

          // C. Fechas de entrega e instalación
          if (rep.deliveryDate && !deliveryDate) deliveryDate = rep.deliveryDate;
          if (rep.actualDeliveryDate && !deliveryDate) deliveryDate = rep.actualDeliveryDate;
          if (rep.installedDate && !deliveryDate) deliveryDate = rep.installedDate;
          if (rep.receptionDate && !deliveryDate) deliveryDate = rep.receptionDate;

          // D. Referencia de OC
          if (rep.ocNumber && isValidOCNumber(rep.ocNumber) && !ocNumber) ocNumber = rep.ocNumber;
          if (rep.supplierOCRef && isValidOCNumber(rep.supplierOCRef) && !ocNumber) ocNumber = rep.supplierOCRef;
        }

        // REGLA ESTRICTA DE NEGOCIO:
        // Solo los equipos con estado 'Entregado e Instalado' ingresan al cronograma!
        // No se usan respaldos genéricos de contrato para inflar equipos pendientes.
        if (!isDeliveredAndInstalled) return;

        // Recuperar serial de almacenamiento persistente si aún falta
        if (!realSerial) {
          try {
            const rawSettings = localStorage.getItem('syd_maintenance_equipment_settings_v4');
            if (rawSettings) {
              const parsed = JSON.parse(rawSettings);
              const sItem = parsed[cand.id]?.[primaryId]?.serialNumber;
              if (sItem && sItem.trim()) {
                realSerial = sItem.trim();
              }
            }
          } catch (e) {}
        }

        const effectiveDate =
          deliveryDate ||
          cand.matchingSOs[0]?.actualDeliveryDate ||
          (cand.matchingOCs[0] as any)?.actualDeliveryDate ||
          (cand.matchingOCs[0] as any)?.deliveryDate ||
          new Date().toISOString().split('T')[0];

        deliveredItems.push({
          id: primaryId || `eq-${cand.id}-${gIdx}`,
          name: bestName || 'Equipo Biomédico',
          brand: bestBrand || 'Mindray',
          model: bestModel || 'Estándar',
          hasOC: true,
          ocNumber: ocNumber || cand.matchingOCs[0]?.ocNumber,
          realSerialFromOC: realSerial,
          quantity: bestQty,
          deliveryDate: effectiveDate,
          isDeliveredAndInstalled: true,
          isInvoiced: false,
        });
      });

      // Si ningún equipo del contrato está entregado e instalado, NO entra al cronograma
      if (deliveredItems.length === 0) return;

      const firstItemDate = deliveredItems.find((i) => i.deliveryDate)?.deliveryDate;
      const contractEffectiveDeliveryDate =
        firstItemDate ||
        cand.matchingSOs[0]?.actualDeliveryDate ||
        (cand.matchingOCs[0] as any)?.deliveryDate ||
        new Date().toISOString().split('T')[0];

      // Detección de factura adjunta vinculada al contrato u órdenes de venta
      let candidateHasInvoice = false;
      let candidateInvoiceNumber: string | undefined = undefined;
      let candidateInvoiceDate: string | undefined = undefined;
      let candidateAttachedFile: any = undefined;

      let storedInvoices: SalesInvoiceRecord[] = [];
      try {
        storedInvoices = getStoredSalesInvoices() || [];
      } catch (e) {}

      for (const inv of storedInvoices) {
        const isMatchInv =
          (cand.id && inv.contractId === cand.id) ||
          cand.matchingSOs.some(
            (so) =>
              (inv.salesOrderId && inv.salesOrderId === so.id) ||
              (so.salesOrderNumber && inv.salesOrderNumber === so.salesOrderNumber)
          ) ||
          (cand.codes &&
            Array.from(cand.codes).some(
              (c) => cleanNorm(inv.contractNumber) === c || cleanNorm(inv.salesOrderNumber) === c
            ));

        if (isMatchInv) {
          candidateHasInvoice = true;
          if (inv.invoiceNumber && !candidateInvoiceNumber) candidateInvoiceNumber = inv.invoiceNumber;
          if (inv.attachedInvoiceFile && !candidateAttachedFile) candidateAttachedFile = inv.attachedInvoiceFile;
          if ((inv.issueDate || inv.createdAt) && !candidateInvoiceDate) {
            candidateInvoiceDate = inv.issueDate || inv.createdAt?.split('T')[0];
          }
        }
      }

      for (const so of cand.matchingSOs) {
        if (
          so.attachedInvoiceFile ||
          so.invoiceNumber ||
          so.status === 'Facturada' ||
          so.invoicedStatus === 'Facturada Total'
        ) {
          candidateHasInvoice = true;
          if (so.invoiceNumber && !candidateInvoiceNumber) candidateInvoiceNumber = so.invoiceNumber;
          if (so.attachedInvoiceFile && !candidateAttachedFile) candidateAttachedFile = so.attachedInvoiceFile;
          if (((so as any).invoicedDate || so.invoiceDate) && !candidateInvoiceDate) {
            candidateInvoiceDate = (so as any).invoicedDate || so.invoiceDate;
          }
        }
      }

      for (const oc of cand.matchingOCs) {
        if ((oc as any).attachedInvoiceFile || (oc as any).invoiceNumber) {
          candidateHasInvoice = true;
          if ((oc as any).invoiceNumber && !candidateInvoiceNumber) candidateInvoiceNumber = (oc as any).invoiceNumber;
          if ((oc as any).attachedInvoiceFile && !candidateAttachedFile) candidateAttachedFile = (oc as any).attachedInvoiceFile;
        }
      }

      list.push({
        id: cand.id,
        clientId: cand.tenderClientId || cand.id,
        clientName: cand.clientName,
        clientNit: cand.clientNit,
        city: cand.city,
        contractNumber: `${cand.contractNumber} (${cand.isTender ? 'Contrato Adjudicado' : 'OC Directa'})`,
        sourceType: cand.isTender ? 'licitacion_adjudicada' : 'oc_directa',
        isDelivered: true,
        deliveryDate: contractEffectiveDeliveryDate,
        hasInvoice: candidateHasInvoice,
        invoiceNumber: candidateInvoiceNumber,
        defaultInvoiceDate: candidateInvoiceDate || contractEffectiveDeliveryDate,
        attachedInvoiceFile: candidateAttachedFile,
        items: deliveredItems.map((it) => ({
          ...it,
          isInvoiced: candidateHasInvoice,
        })),
      });
    });

    return list;
  }, [tenderClients, ocContracts, salesOrders, invoicesVersion]);

  // Contrato activo seleccionado
  const [selectedContractId, setSelectedContractId] = useState<string>('');

  useEffect(() => {
    if (contractsList.length > 0) {
      if (!selectedContractId || !contractsList.some((c) => c.id === selectedContractId)) {
        setSelectedContractId(contractsList[0].id);
      }
    } else {
      if (selectedContractId !== '') {
        setSelectedContractId('');
      }
    }
  }, [contractsList, selectedContractId]);

  const activeContract = useMemo(() => {
    return contractsList.find((c) => c.id === selectedContractId) || null;
  }, [contractsList, selectedContractId]);

  // Sincronizar automáticamente el año seleccionado con el año de instalación de los equipos
  useEffect(() => {
    if (activeContract && activeContract.deliveryDate) {
      const d = new Date(activeContract.deliveryDate);
      if (!isNaN(d.getTime())) {
        const yr = d.getFullYear();
        if (yr >= 2020 && yr <= 2040) {
          setAvailableYears((prev) => (prev.includes(yr) ? prev : [...prev, yr].sort((a, b) => a - b)));
          setSelectedYear(yr);
        }
      }
    }
  }, [activeContract?.id]);

  // =========================================================================
  // 4. ALMACENAMIENTO DE CONFIGURACIÓN DE EQUIPOS (Vigencia multi-año global)
  // =========================================================================
  const [equipmentSettingsStore, setEquipmentSettingsStore] = useState<
    Record<string, Record<string, {
      serialNumber?: string;
      installationDate?: string;
      warrantyMonths?: number;
      frequency?: MaintenanceFrequencyType;
    }>>
  >(() => {
    try {
      const raw = localStorage.getItem('syd_maintenance_equipment_settings_v4');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  });

  const saveEquipmentSettings = (
    contractId: string,
    itemId: string,
    updates: Partial<{
      serialNumber: string;
      installationDate: string;
      warrantyMonths: number;
      frequency: MaintenanceFrequencyType;
    }>
  ) => {
    const curContract = equipmentSettingsStore[contractId] || {};
    const curItem = curContract[itemId] || {};
    const updated = {
      ...equipmentSettingsStore,
      [contractId]: {
        ...curContract,
        [itemId]: {
          ...curItem,
          ...updates,
        },
      },
    };
    setEquipmentSettingsStore(updated);
    try {
      localStorage.setItem('syd_maintenance_equipment_settings_v4', JSON.stringify(updated));
    } catch (e) {
      console.error('Error guardando configuración de equipo:', e);
    }
  };

  // Almacenamiento de sobrescrituras manuales de celdas por [contractId][year][itemId][monthNum]
  const [cellOverridesStore, setCellOverridesStore] = useState<
    Record<string, Record<number, Record<string, Record<number, MonthAssignment>>>>
  >(() => {
    try {
      const raw = localStorage.getItem('syd_maintenance_cell_overrides_v4');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  });

  const saveCellOverride = (
    contractId: string,
    year: number,
    itemId: string,
    monthNum: number,
    assignment: MonthAssignment
  ) => {
    setCellOverridesStore((prev) => {
      const curContract = prev[contractId] || {};
      const curYear = curContract[year] || {};
      const curItem = curYear[itemId] || {};
      const updated = {
        ...prev,
        [contractId]: {
          ...curContract,
          [year]: {
            ...curYear,
            [itemId]: {
              ...curItem,
              [monthNum]: assignment,
            },
          },
        },
      };
      try {
        localStorage.setItem('syd_maintenance_cell_overrides_v4', JSON.stringify(updated));
      } catch (e) {
        console.error('Error guardando sobrescritura de celda:', e);
      }
      return updated;
    });
  };

  // Matriz heredada para retrocompatibilidad
  const [matrixStore, setMatrixStore] = useState<Record<string, Record<number, Record<string, EquipmentScheduleData>>>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_MATRIX_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  });

  const saveMatrixStore = (next: typeof matrixStore) => {
    setMatrixStore(next);
    try {
      localStorage.setItem(STORAGE_MATRIX_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('Error guardando matriz:', e);
    }
  };

  // =========================================================================
  // 5. ALMACENAMIENTO DE EVIDENCIAS Y FOTOS DE CAPACITACIÓN POR EQUIPO
  // =========================================================================
  const [trainingEvidenceStore, setTrainingEvidenceStore] = useState<Record<string, Record<string, TrainingEvidenceItem>>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_TRAINING_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  });

  const saveTrainingEvidence = (contractId: string, itemId: string, itemData: TrainingEvidenceItem) => {
    const next = {
      ...trainingEvidenceStore,
      [contractId]: {
        ...(trainingEvidenceStore[contractId] || {}),
        [itemId]: itemData,
      },
    };
    setTrainingEvidenceStore(next);
    try {
      localStorage.setItem(STORAGE_TRAINING_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('Error guardando evidencias:', e);
    }
  };

  // Obtener datos del cronograma para un ítem sincronizado con multi-año
  const getItemSchedule = (itemId: string, itemRealSerial = '', overridesStore?: typeof cellOverridesStore): EquipmentScheduleData => {
    if (!activeContract) {
      return {
        frequency: 'Semestral',
        serialNumber: itemRealSerial,
        warrantyMonths: 12,
        months: generateScheduleFromInstallation('Semestral', undefined, selectedYear, 12),
      };
    }

    const itemObj = activeContract.items.find((i) => i.id === itemId);
    const isItemInvoiced = itemObj ? itemObj.isInvoiced : activeContract.hasInvoice;

    // 1. Obtener ajustes del equipo persistidos a nivel global (multi-año)
    const eqSettings = equipmentSettingsStore[activeContract.id]?.[itemId];

    // Soporte retrocompatible con matrixStore legado
    let legacyWarrantyMonths: number | undefined = undefined;
    let legacyFreq: MaintenanceFrequencyType | undefined = undefined;
    let legacyInstDate: string | undefined = undefined;
    let legacySerial: string | undefined = undefined;

    const contractMatrix = matrixStore[activeContract.id] || {};
    for (const yr of Object.keys(contractMatrix)) {
      const yrData = contractMatrix[Number(yr)]?.[itemId];
      if (yrData) {
        if (!legacyWarrantyMonths && yrData.warrantyMonths) legacyWarrantyMonths = yrData.warrantyMonths;
        if (!legacyFreq && yrData.frequency) legacyFreq = yrData.frequency;
        if (!legacyInstDate && yrData.installationDate) legacyInstDate = yrData.installationDate;
        if (!legacySerial && yrData.serialNumber) legacySerial = yrData.serialNumber;
      }
    }

    const effectiveWarrantyMonths = eqSettings?.warrantyMonths ?? legacyWarrantyMonths ?? 12;
    const effectiveFrequency: MaintenanceFrequencyType = eqSettings?.frequency ?? legacyFreq ?? 'Semestral';
    const effectiveInstDate =
      eqSettings?.installationDate ??
      legacyInstDate ??
      itemObj?.deliveryDate ??
      activeContract.deliveryDate ??
      activeContract.defaultInvoiceDate ??
      new Date().toISOString().split('T')[0];
    const effectiveSerial = (eqSettings?.serialNumber || legacySerial || itemRealSerial || '').trim();
    const effectiveEndDate = calculateWarrantyEndDate(effectiveInstDate, effectiveWarrantyMonths);

    // 2. Generar el cronograma base oficial según la fecha de instalación, garantía y frecuencia para selectedYear
    const baseSchedule = generateScheduleFromInstallation(
      effectiveFrequency,
      effectiveInstDate,
      selectedYear,
      effectiveWarrantyMonths
    );

    // 3. Aplicar sobrescrituras manuales (permite activar/inactivar cada convención independientemente)
    const manualOverrides = (overridesStore || cellOverridesStore)[activeContract.id]?.[selectedYear]?.[itemId];
    const legacyMatrixMonths = matrixStore[activeContract.id]?.[selectedYear]?.[itemId]?.months;

    const finalMonths: Record<number, MonthAssignment> = { ...baseSchedule };
    // Primero aplicar matriz legada si existe
    if (legacyMatrixMonths) {
      for (let m = 1; m <= 12; m++) {
        if (legacyMatrixMonths[m]) {
          if (legacyMatrixMonths[m].mc || legacyMatrixMonths[m].mp || legacyMatrixMonths[m].inst || legacyMatrixMonths[m].cap) {
            finalMonths[m] = { ...legacyMatrixMonths[m] };
          }
        }
      }
    }
    // Luego aplicar sobrescrituras manuales mes a mes (tienen máxima prioridad e independencia absoluta)
    if (manualOverrides) {
      for (let m = 1; m <= 12; m++) {
        if (manualOverrides[m] !== undefined && manualOverrides[m] !== null) {
          finalMonths[m] = {
            inst: Boolean(manualOverrides[m].inst),
            cap: Boolean(manualOverrides[m].cap),
            mp: manualOverrides[m].mp || null,
            mc: Boolean(manualOverrides[m].mc),
          };
        }
      }
    }

    // REGLA ESTRICTA DE VIGENCIA DE GARANTÍA:
    // Si la garantía para este mes ya expiró (monthsDiff > effectiveWarrantyMonths) o es previo a la instalación:
    // NUNCA debe aparecer 'P' (Preventivo). Solo 'C' (Correctivo) si fue registrado manualmente.
    if (effectiveInstDate) {
      const dInst = new Date(effectiveInstDate);
      if (!isNaN(dInst.getTime())) {
        const instAbsMonth = dInst.getFullYear() * 12 + dInst.getMonth();
        for (let m = 1; m <= 12; m++) {
          const currentAbsMonth = selectedYear * 12 + (m - 1);
          const monthsDiff = currentAbsMonth - instAbsMonth;
          if (monthsDiff > effectiveWarrantyMonths || monthsDiff < 0) {
            // Fuera del periodo de garantía: el mantenimiento preventivo 'P' queda nulo
            if (finalMonths[m].mp === 'P') {
              finalMonths[m].mp = null;
            }
          }
        }
      }
    }

    return {
      frequency: effectiveFrequency,
      serialNumber: effectiveSerial,
      installationDate: effectiveInstDate,
      invoiceNumber: isItemInvoiced ? activeContract.invoiceNumber : undefined,
      hasInvoice: isItemInvoiced,
      warrantyMonths: effectiveWarrantyMonths,
      warrantyEndDate: effectiveEndDate,
      months: finalMonths,
    };
  };

  // Modificar años de garantía (válido para todos los años: ej. 1 año = 2 mttos, 3 años = 6 mttos)
  const handleUpdateWarrantyYears = (itemId: string, years: number) => {
    if (!activeContract) return;
    const months = Math.max(1, years) * 12;
    saveEquipmentSettings(activeContract.id, itemId, { warrantyMonths: months });

    // Limpiar sobrescrituras manuales y matriz legada para proyectar la nueva garantía limpia en todos los años
    if (cellOverridesStore[activeContract.id]) {
      const curContract = { ...cellOverridesStore[activeContract.id] };
      for (const yr of Object.keys(curContract)) {
        if (curContract[Number(yr)]?.[itemId]) {
          delete curContract[Number(yr)][itemId];
        }
      }
      setCellOverridesStore({ ...cellOverridesStore, [activeContract.id]: curContract });
      try {
        localStorage.setItem('syd_maintenance_cell_overrides_v4', JSON.stringify({ ...cellOverridesStore, [activeContract.id]: curContract }));
      } catch (e) {}
    }

    if (matrixStore[activeContract.id]) {
      const curMat = { ...matrixStore[activeContract.id] };
      for (const yr of Object.keys(curMat)) {
        if (curMat[Number(yr)]?.[itemId]) {
          delete curMat[Number(yr)][itemId];
        }
      }
      saveMatrixStore({ ...matrixStore, [activeContract.id]: curMat });
    }

    showToast(`✓ Garantía actualizada a ${years} año(s) (${months} meses). Cobertura sincronizada para todos los años.`);
  };

  // Cambiar frecuencia (Semestral, Trimestral, etc.)
  const handleChangeFrequency = (itemId: string, newFreq: MaintenanceFrequencyType) => {
    if (!activeContract) return;
    saveEquipmentSettings(activeContract.id, itemId, { frequency: newFreq });

    // Limpiar sobrescrituras para regenerar con la nueva frecuencia
    if (cellOverridesStore[activeContract.id]) {
      const curContract = { ...cellOverridesStore[activeContract.id] };
      for (const yr of Object.keys(curContract)) {
        if (curContract[Number(yr)]?.[itemId]) {
          delete curContract[Number(yr)][itemId];
        }
      }
      setCellOverridesStore({ ...cellOverridesStore, [activeContract.id]: curContract });
      try {
        localStorage.setItem('syd_maintenance_cell_overrides_v4', JSON.stringify({ ...cellOverridesStore, [activeContract.id]: curContract }));
      } catch (e) {}
    }

    if (matrixStore[activeContract.id]) {
      const curMat = { ...matrixStore[activeContract.id] };
      for (const yr of Object.keys(curMat)) {
        if (curMat[Number(yr)]?.[itemId]) {
          delete curMat[Number(yr)][itemId];
        }
      }
      saveMatrixStore({ ...matrixStore, [activeContract.id]: curMat });
    }

    showToast(`✓ Frecuencia preventiva actualizada a ${newFreq}.`);
  };

  // Cambiar fecha de instalación oficial
  const handleUpdateInstallationDate = (itemId: string, newDateStr: string) => {
    if (!activeContract) return;
    saveEquipmentSettings(activeContract.id, itemId, { installationDate: newDateStr });
    showToast(`✓ Fecha de instalación oficial actualizada.`);
  };

  // Estado del modal de selección y activación de múltiples convenciones en un mismo mes
  const [activeCellPopover, setActiveCellPopover] = useState<{
    itemId: string;
    itemName: string;
    monthNum: number;
    monthName: string;
  } | null>(null);

  // Alternar convención específica en un cuadro/celda (Permite tener varias convenciones simultáneamente o inactivarlas individualmente)
  const handleToggleCellConvention = (
    itemId: string,
    monthNum: number,
    convention: 'inst' | 'cap' | 'mp' | 'mc'
  ) => {
    if (!activeContract) return;
    const contractId = activeContract.id;
    const year = selectedYear;

    setCellOverridesStore((prev) => {
      const curContract = prev[contractId] || {};
      const curYear = curContract[year] || {};
      const curItem = curYear[itemId] || {};
      const existingCell = curItem[monthNum];

      let baseCell: MonthAssignment;
      if (existingCell !== undefined && existingCell !== null) {
        baseCell = { ...existingCell };
      } else {
        const sched = getItemSchedule(itemId, '', prev);
        baseCell = sched.months[monthNum]
          ? { ...sched.months[monthNum] }
          : { inst: false, cap: false, mp: null, mc: false };
      }

      const nextCell: MonthAssignment = {
        inst: Boolean(baseCell.inst),
        cap: Boolean(baseCell.cap),
        mp: baseCell.mp || null,
        mc: Boolean(baseCell.mc),
      };

      if (convention === 'inst') {
        nextCell.inst = !nextCell.inst;
      } else if (convention === 'cap') {
        nextCell.cap = !nextCell.cap;
      } else if (convention === 'mp') {
        nextCell.mp = nextCell.mp ? null : 'P';
      } else if (convention === 'mc') {
        nextCell.mc = !nextCell.mc;
      }

      const nextStore = {
        ...prev,
        [contractId]: {
          ...curContract,
          [year]: {
            ...curYear,
            [itemId]: {
              ...curItem,
              [monthNum]: nextCell,
            },
          },
        },
      };

      try {
        localStorage.setItem('syd_maintenance_cell_overrides_v4', JSON.stringify(nextStore));
      } catch (e) {
        console.error('Error guardando sobrescritura de celda:', e);
      }
      return nextStore;
    });
  };

  // Inactivar simultáneamente Instalación (I) y Capacitación (CAP) en el mes
  const handleInactivateBothInstAndCap = (itemId: string, monthNum: number) => {
    if (!activeContract) return;
    const contractId = activeContract.id;
    const year = selectedYear;

    setCellOverridesStore((prev) => {
      const curContract = prev[contractId] || {};
      const curYear = curContract[year] || {};
      const curItem = curYear[itemId] || {};
      const existingCell = curItem[monthNum];

      let baseCell: MonthAssignment;
      if (existingCell !== undefined && existingCell !== null) {
        baseCell = { ...existingCell };
      } else {
        const sched = getItemSchedule(itemId, '', prev);
        baseCell = sched.months[monthNum]
          ? { ...sched.months[monthNum] }
          : { inst: false, cap: false, mp: null, mc: false };
      }

      const nextCell: MonthAssignment = {
        ...baseCell,
        inst: false,
        cap: false,
      };

      const nextStore = {
        ...prev,
        [contractId]: {
          ...curContract,
          [year]: {
            ...curYear,
            [itemId]: {
              ...curItem,
              [monthNum]: nextCell,
            },
          },
        },
      };

      try {
        localStorage.setItem('syd_maintenance_cell_overrides_v4', JSON.stringify(nextStore));
      } catch (e) {}
      return nextStore;
    });
    showToast(`✓ Instalación y Capacitación inactivadas para este mes.`);
  };

  // Activar directamente Instalación (I) y Capacitación (CAP) en el mismo mes
  const handleSetBothInstAndCap = (itemId: string, monthNum: number) => {
    if (!activeContract) return;
    const contractId = activeContract.id;
    const year = selectedYear;

    setCellOverridesStore((prev) => {
      const curContract = prev[contractId] || {};
      const curYear = curContract[year] || {};
      const curItem = curYear[itemId] || {};
      const existingCell = curItem[monthNum];

      let baseCell: MonthAssignment;
      if (existingCell !== undefined && existingCell !== null) {
        baseCell = { ...existingCell };
      } else {
        const sched = getItemSchedule(itemId, '', prev);
        baseCell = sched.months[monthNum]
          ? { ...sched.months[monthNum] }
          : { inst: false, cap: false, mp: null, mc: false };
      }

      const nextCell: MonthAssignment = {
        ...baseCell,
        inst: true,
        cap: true,
      };

      const nextStore = {
        ...prev,
        [contractId]: {
          ...curContract,
          [year]: {
            ...curYear,
            [itemId]: {
              ...curItem,
              [monthNum]: nextCell,
            },
          },
        },
      };

      try {
        localStorage.setItem('syd_maintenance_cell_overrides_v4', JSON.stringify(nextStore));
      } catch (e) {}
      return nextStore;
    });
    showToast(`✓ Instalación y Capacitación activadas en el mismo mes.`);
  };

  // Limpiar todas las convenciones de una celda (inactivar todo)
  const handleClearCell = (itemId: string, monthNum: number) => {
    if (!activeContract) return;
    const contractId = activeContract.id;
    const year = selectedYear;

    setCellOverridesStore((prev) => {
      const curContract = prev[contractId] || {};
      const curYear = curContract[year] || {};
      const curItem = curYear[itemId] || {};

      const nextCell: MonthAssignment = { inst: false, cap: false, mp: null, mc: false };

      const nextStore = {
        ...prev,
        [contractId]: {
          ...curContract,
          [year]: {
            ...curYear,
            [itemId]: {
              ...curItem,
              [monthNum]: nextCell,
            },
          },
        },
      };

      try {
        localStorage.setItem('syd_maintenance_cell_overrides_v4', JSON.stringify(nextStore));
      } catch (e) {}
      return nextStore;
    });
    showToast(`✓ Celda limpiada (todas las actividades inactivadas).`);
  };

  // Re-sincronizar distribución automática según la garantía y frecuencia
  const handleResyncFromInstallationDate = (itemId: string) => {
    if (!activeContract) return;
    if (cellOverridesStore[activeContract.id]?.[selectedYear]?.[itemId]) {
      const nextStore = { ...cellOverridesStore };
      delete nextStore[activeContract.id][selectedYear][itemId];
      setCellOverridesStore(nextStore);
      try {
        localStorage.setItem('syd_maintenance_cell_overrides_v4', JSON.stringify(nextStore));
      } catch (e) {}
    }
    showToast(`✓ Cronograma resincronizado automáticamente según la garantía y frecuencia.`);
  };

  // Modal para evidencias y fotos de capacitación
  const [trainingModalItem, setTrainingModalItem] = useState<{
    itemId: string;
    itemName: string;
    brand: string;
    model: string;
    serial: string;
    installationDate?: string;
  } | null>(null);

  // Modal para edición rápida de Serie, Fecha de Instalación, Garantía y Frecuencia
  const [quickEditItem, setQuickEditItem] = useState<{
    itemId: string;
    itemName: string;
    brand: string;
    model: string;
    serial: string;
    installationDate: string;
    warrantyMonths: number;
    frequency?: MaintenanceFrequencyType;
  } | null>(null);

  // Visor de foto ampliada
  const [lightboxPhoto, setLightboxPhoto] = useState<{
    url: string;
    title: string;
    caption?: string;
  } | null>(null);

  // Filtrado de contratos
  const filteredContracts = useMemo(() => {
    return contractsList.filter((c) => {
      if (filterType !== 'all' && c.sourceType !== filterType) return false;
      if (clientSearchQuery.trim()) {
        const q = clientSearchQuery.toLowerCase();
        const matchesName = c.clientName.toLowerCase().includes(q);
        const matchesNit = c.clientNit.toLowerCase().includes(q);
        const matchesContract = c.contractNumber.toLowerCase().includes(q);
        const matchesCity = c.city.toLowerCase().includes(q);
        if (!matchesName && !matchesNit && !matchesContract && !matchesCity) return false;
      }
      return true;
    });
  }, [contractsList, filterType, clientSearchQuery]);

  // =========================================================================
  // DESCARGA DE EXCEL ELEGANTE Y PROFESIONAL (SheetJS)
  // =========================================================================
  const handleDownloadExcel = () => {
    if (!activeContract) {
      alert('Por favor seleccione un cliente para descargar el cronograma.');
      return;
    }

    const wb = XLSX.utils.book_new();
    const wsData: any[][] = [];

    // ENCABEZADO INSTITUCIONAL ELEGANTE
    wsData.push(['S&D MEDICAL S.A.S. - GESTIÓN INTEGRAL DE TECNOLOGÍA BIOMÉDICA']);
    wsData.push(['CRONOGRAMA OFICIAL DE MANTENIMIENTO PREVENTIVO, CORRECTIVO Y CAPACITACIÓN']);
    wsData.push(['Sincronizado con Garantía Técnica de 1 Año (2 Mantenimientos Semestrales) • Resolución 3100 de 2019 MinSalud']);
    wsData.push([]); // Espaciador

    // BLOQUE DE DATOS INSTITUCIONALES DEL CONTRATO
    wsData.push(['DATOS INSTITUCIONALES DEL CONTRATO Y FACTURACIÓN']);
    wsData.push([
      'ENTIDAD / CLIENTE:',
      activeContract.clientName,
      '',
      'CONTRATO / PROCESO:',
      activeContract.contractNumber,
    ]);
    wsData.push([
      'NIT INSTITUCIONAL:',
      activeContract.clientNit,
      '',
      'MODALIDAD:',
      activeContract.sourceType === 'licitacion_adjudicada' ? 'Licitación Adjudicada' : 'Orden de Compra Directa',
    ]);
    wsData.push([
      'CIUDAD / SEDE:',
      activeContract.city,
      '',
      'FACTURA VINCULADA:',
      activeContract.invoiceNumber
        ? `${activeContract.invoiceNumber} (${formatDateDisplay(activeContract.defaultInvoiceDate)})`
        : 'Pendiente de Factura en Ventana 6',
    ]);
    wsData.push([
      'VIGENCIA DEL CRONOGRAMA:',
      `Año ${selectedYear}`,
      '',
      'ESTADO DEL CRONOGRAMA:',
      activeContract.hasInvoice ? '🟢 Iniciado y Activo' : '⏳ Pendiente de Facturación',
    ]);
    wsData.push([
      'FECHA DE EMISIÓN DEL DOCUMENTO:',
      new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }),
      '',
      'GARANTÍA ESTÁNDAR:',
      '1 Año (12 Meses desde Instalación)',
    ]);
    wsData.push([]); // Espaciador

    // ENCABEZADOS DE LA MATRIZ MENSUAL
    wsData.push([
      'ITEM',
      'EQUIPO BIOMÉDICO',
      'MARCA',
      'MODELO',
      'NÚMERO DE SERIE (S/N)',
      'FECHA INSTALACIÓN',
      'VIGENCIA GARANTÍA (1 AÑO)',
      'FRECUENCIA PREVENTIVA',
      'ENE',
      'FEB',
      'MAR',
      'ABR',
      'MAY',
      'JUN',
      'JUL',
      'AGO',
      'SEP',
      'OCT',
      'NOV',
      'DIC',
      'MTTO CORRECTIVO (OCASIONAL)',
      'CAPACITACIÓN (MISMO DÍA)',
    ]);

    // FILAS DE EQUIPOS
    activeContract.items.forEach((item, idx) => {
      const sch = getItemSchedule(item.id, item.realSerialFromOC);
      const trainingEv = trainingEvidenceStore[activeContract.id]?.[item.id];

      // Formateo de meses con convenciones
      const monthValues = MONTHS.map((m) => {
        const cell = sch.months[m.num];
        if (!cell) return '-';

        let isPre = false;
        if (sch.installationDate) {
          const d = new Date(sch.installationDate);
          if (!isNaN(d.getTime()) && selectedYear === d.getFullYear()) {
            if (m.num < d.getMonth() + 1) isPre = true;
          }
        }
        if (isPre) return '-';

        const codes: string[] = [];
        if (cell.inst) codes.push('I');
        if (cell.cap) codes.push('CAP');
        if (cell.mp === 'P') codes.push('P');
        if (cell.mp === 'E') codes.push('E');
        if (cell.mc) codes.push('C'); // Solo si se colocó manualmente

        return codes.length > 0 ? codes.join(' • ') : '-';
      });

      // Conteo de correctivos manuales en el año
      let correctivosCount = 0;
      Object.values(sch.months).forEach((c) => {
        if (c.mc) correctivosCount++;
      });
      const correctivoText =
        correctivosCount === 0
          ? '0 eventos (Ocasional / Manual)'
          : `${correctivosCount} evento(s) correctivo(s) registrado(s)`;

      // Estado de capacitación
      let capStatus = 'Mismo día de instalación';
      if (trainingEv?.status === 'Realizada' || (trainingEv?.photos && trainingEv.photos.length > 0)) {
        capStatus = 'Realizada y Certificada (Con Fotos)';
      } else if (trainingEv?.attendanceDoc) {
        capStatus = 'Con Asistencia Adjunta';
      }

      // Vigencia de Garantía
      const wYears = Math.round((sch.warrantyMonths || 12) / 12) || 1;
      const garantiaText = sch.installationDate
        ? `${wYears} Año(s) (Vence: ${formatDateDisplay(sch.warrantyEndDate)})`
        : `${wYears} Año(s) (Pendiente instalación)`;

      wsData.push([
        idx + 1,
        item.name,
        item.brand,
        item.model,
        sch.serialNumber || 'Sin serie en Seguimiento OC',
        formatDateDisplay(sch.installationDate),
        garantiaText,
        sch.frequency,
        ...monthValues,
        correctivoText,
        capStatus,
      ]);
    });

    // CONVENCIONES Y PROTOCOLOS NORMATIVOS
    wsData.push([]);
    wsData.push(['CONVENCIONES:']);
    wsData.push(['[I] = Instalacion']);
    wsData.push(['[CAP] = Capacitacion']);
    wsData.push(['[P] = mantenimiento preventivo']);
    wsData.push(['[C] = mantenimiento correctivo']);
    wsData.push([]);
    wsData.push(['ALCANCE NORMATIVO Y OPERATIVO:']);
    wsData.push(['1. El cronograma inicia oficialmente cuando se emite y sube la factura en la Ventana de Órdenes de Venta y Facturación.']);
    wsData.push(['2. La fecha de facturación fija el día de instalación de los equipos y activa la garantía técnica de 1 año.']);
    wsData.push(['3. Los mantenimientos preventivos se programan automáticamente cada 6 meses (2 al año) según vigencia de garantía.']);
    wsData.push(['4. Los registros de asistencia y fotografías de capacitación reposan en el expediente técnico de la dotación.']);
    wsData.push([]);
    wsData.push(['FIRMAS DE APROBACIÓN Y CONFORMIDAD:']);
    wsData.push([]);
    wsData.push([
      '__________________________________________',
      '',
      '',
      '',
      '__________________________________________',
    ]);
    wsData.push([
      'INGENIERÍA BIOMÉDICA S&D MEDICAL S.A.S.',
      '',
      '',
      '',
      `COORDINACIÓN DE MANTENIMIENTO / BIOMÉDICA`,
    ]);
    wsData.push([
      'Soporte Técnico y Garantías • Registro INVIMA',
      '',
      '',
      '',
      `${activeContract.clientName} • Firma y Sello`,
    ]);

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // COMBINACIÓN DE CELDAS PARA EL ENCABEZADO ELEGANTE
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 21 } }, // Título 1
      { s: { r: 1, c: 0 }, e: { r: 1, c: 21 } }, // Título 2
      { s: { r: 2, c: 0 }, e: { r: 2, c: 21 } }, // Subtítulo
      { s: { r: 4, c: 0 }, e: { r: 4, c: 21 } }, // Título Datos
      { s: { r: wsData.length - 14, c: 0 }, e: { r: wsData.length - 14, c: 21 } }, // Convenciones
      { s: { r: wsData.length - 7, c: 0 }, e: { r: wsData.length - 7, c: 21 } }, // Alcance
      { s: { r: wsData.length - 5, c: 0 }, e: { r: wsData.length - 5, c: 21 } }, // Firmas
    ];

    // ANCHOS DE COLUMNAS CALCULADOS PARA VISUALIZACIÓN ELEGANTE
    ws['!cols'] = [
      { wch: 6 },  // ITEM
      { wch: 34 }, // EQUIPO BIOMÉDICO
      { wch: 18 }, // MARCA
      { wch: 18 }, // MODELO
      { wch: 24 }, // SERIE (S/N)
      { wch: 18 }, // FECHA INSTALACIÓN
      { wch: 26 }, // VIGENCIA GARANTÍA
      { wch: 22 }, // FRECUENCIA PREVENTIVA
      // 12 Meses
      { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 },
      { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 },
      { wch: 9 }, { wch: 9 }, { wch: 9 }, { wch: 9 },
      { wch: 28 }, // MTTO CORRECTIVO
      { wch: 30 }, // CAPACITACIÓN
    ];

    XLSX.utils.book_append_sheet(wb, ws, `Cronograma_${selectedYear}`);

    const safeClientName = activeContract.clientName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const fileName = `Cronograma_Mantenimiento_${safeClientName}_${selectedYear}.xlsx`;
    XLSX.writeFile(wb, fileName);
    showToast(`✓ Excel descargado con éxito: ${fileName}`);
  };

  // Imprimir cronograma
  const handlePrint = () => {
    if (!activeContract) return;
    const oldTitle = document.title;
    document.title = `Cronograma_Mantenimiento_${activeContract.clientName.replace(/\s+/g, '_')}_${selectedYear}`;
    window.print();
    document.title = oldTitle;
  };

  // Habilitar nuevo año
  const handleAddYear = () => {
    const input = prompt('Ingrese el nuevo año a habilitar en el cronograma (ej: 2027, 2028):');
    if (!input) return;
    const num = parseInt(input.trim(), 10);
    if (isNaN(num) || num < 2020 || num > 2040) {
      alert('Por favor ingrese un año válido entre 2020 y 2040.');
      return;
    }
    if (!availableYears.includes(num)) {
      const updated = [...availableYears, num].sort((a, b) => a - b);
      setAvailableYears(updated);
    }
    setSelectedYear(num);
    showToast(`Año ${num} habilitado.`);
  };

  // Referencias para subida de archivos de capacitación
  const attendanceFileInputRef = useRef<HTMLInputElement>(null);
  const photosFileInputRef = useRef<HTMLInputElement>(null);

  // Subir lista de asistencia
  const handleUploadAttendanceDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!trainingModalItem || !activeContract) return;
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const currentEv = trainingEvidenceStore[activeContract.id]?.[trainingModalItem.itemId] || {
        attendanceDoc: null,
        photos: [],
        status: 'Programada',
      };

      const updatedEv: TrainingEvidenceItem = {
        ...currentEv,
        attendanceDoc: {
          name: file.name,
          size: `${(file.size / 1024).toFixed(1)} KB`,
          dataUrl,
          uploadedAt: new Date().toISOString(),
        },
        status: 'Realizada',
      };

      saveTrainingEvidence(activeContract.id, trainingModalItem.itemId, updatedEv);
      showToast(`✓ Lista de asistencia "${file.name}" adjuntada con éxito.`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Subir fotos de capacitación
  const handleUploadTrainingPhotos = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!trainingModalItem || !activeContract) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    let loaded = 0;
    const newPhotos: Array<{ id: string; name: string; dataUrl: string; uploadedAt: string }> = [];

    fileList.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        newPhotos.push({
          id: `photo-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          name: file.name,
          dataUrl: reader.result as string,
          uploadedAt: new Date().toISOString(),
        });
        loaded++;
        if (loaded === fileList.length) {
          const currentEv = trainingEvidenceStore[activeContract.id]?.[trainingModalItem.itemId] || {
            attendanceDoc: null,
            photos: [],
            status: 'Programada',
          };

          const updatedEv: TrainingEvidenceItem = {
            ...currentEv,
            photos: [...(currentEv.photos || []), ...newPhotos],
            status: 'Realizada',
          };

          saveTrainingEvidence(activeContract.id, trainingModalItem.itemId, updatedEv);
          showToast(`✓ ${fileList.length} foto(s) de capacitación subida(s).`);
        }
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  // Eliminar foto de capacitación
  const handleDeletePhoto = (photoId: string) => {
    if (!trainingModalItem || !activeContract) return;
    const currentEv = trainingEvidenceStore[activeContract.id]?.[trainingModalItem.itemId];
    if (!currentEv) return;

    const updatedEv: TrainingEvidenceItem = {
      ...currentEv,
      photos: (currentEv.photos || []).filter((p) => p.id !== photoId),
    };

    saveTrainingEvidence(activeContract.id, trainingModalItem.itemId, updatedEv);
    showToast('Foto eliminada.');
  };

  return (
    <div id="maintenance-schedule-view" className="space-y-4 animate-fadeIn pb-12">
      {/* Toast Notifier */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-[100] bg-emerald-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-fadeIn border border-emerald-400">
          <CheckCircle2 className="w-4 h-4 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER CONTROLS */}
      <div className="bg-[#0f1b2d] border border-indigo-500/40 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {/* Título & Vigencia */}
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                <span>Cronograma Oficial de Mantenimiento por Cliente</span>
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-500/40">
                  Año {selectedYear}
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Equipos Entregados e Instalados • Sincronizado con <strong>Instalación, Capacitación y Garantía Técnica</strong> (2 mantenimientos semestrales)
              </p>
            </div>
          </div>

          {/* Acciones Superiores: Selector de Año + BOTÓN ÚNICO DE DESCARGAR EXCEL */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Multi-Year Selector */}
            <div className="flex items-center gap-1 bg-[#15253d] p-1 rounded-xl border border-[#334d6e]">
              <span className="text-xs text-slate-400 font-bold px-2">Año:</span>
              <div className="flex items-center gap-1">
                {availableYears.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setSelectedYear(yr)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
                      selectedYear === yr
                        ? 'bg-cyan-500 text-slate-950 shadow-md'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {yr}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleAddYear}
                  className="px-2 py-1 rounded-lg text-xs font-bold text-cyan-400 hover:bg-cyan-500/20 transition cursor-pointer"
                  title="Habilitar otro año de vigencia contractual"
                >
                  + Año
                </button>
              </div>
            </div>

            {/* BOTÓN ÚNICO DE DESCARGAR EXCEL */}
            <button
              type="button"
              onClick={handleDownloadExcel}
              disabled={!activeContract}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs transition cursor-pointer shadow-lg shadow-emerald-700/25 border border-emerald-400/40 active:scale-95 disabled:opacity-50"
              title="Descargar el cronograma oficial de este cliente en formato Microsoft Excel (.xlsx)"
            >
              <FileSpreadsheet className="w-4 h-4 stroke-[2.5]" />
              <span>Descargar Excel del Cronograma (.xlsx)</span>
            </button>

            {/* Imprimir / PDF */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={!activeContract}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#192b45] hover:bg-[#203657] text-slate-200 border border-[#334d6e] text-xs font-bold transition cursor-pointer active:scale-95 disabled:opacity-50"
              title="Imprimir o guardar en PDF el cronograma"
            >
              <Printer className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Imprimir / PDF</span>
            </button>
          </div>
        </div>

        {/* BARRA DE FILTROS Y BÚSQUEDA DE CLIENTES */}
        <div className="pt-2 border-t border-[#334d6e]/60 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 bg-[#132035] p-1 rounded-xl border border-[#334d6e] text-xs">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterType === 'all'
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Todos ({contractsList.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('licitacion_adjudicada')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterType === 'licitacion_adjudicada'
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              🏛️ Contratos Adjudicados (
              {contractsList.filter((c) => c.sourceType === 'licitacion_adjudicada').length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('oc_directa')}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterType === 'oc_directa'
                  ? 'bg-cyan-500 text-slate-950 font-black shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              📦 OC Directas ({contractsList.filter((c) => c.sourceType === 'oc_directa').length})
            </button>
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar cliente o contrato..."
              value={clientSearchQuery}
              onChange={(e) => setClientSearchQuery(e.target.value)}
              className="w-full bg-[#111c2e] border border-[#334d6e] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        {/* SELECTOR DE CLIENTES */}
        {filteredContracts.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 bg-[#121f33] rounded-xl border border-dashed border-[#334d6e] space-y-2">
            <div className="w-10 h-10 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 stroke-[2.5]" />
            </div>
            <h4 className="text-sm font-bold text-white">
              {contractsList.length === 0
                ? 'No hay contratos con equipos en estado «Entregado e Instalado»'
                : 'No se encontraron clientes que coincidan con la búsqueda'}
            </h4>
            <p className="max-w-md mx-auto text-slate-300">
              {contractsList.length === 0 ? (
                <span>
                  El cronograma oficial de mantenimiento se habilita automáticamente cuando el estado de los equipos cambia a <strong>«Entregado e Instalado»</strong> en el Seguimiento de Órdenes de Compra (OC).
                </span>
              ) : (
                'Intenta ajustar el término de búsqueda o selecciona otro filtro.'
              )}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1 max-h-56 overflow-y-auto custom-scrollbar pr-1">
            {filteredContracts.map((contract) => {
              const isSelected = activeContract?.id === contract.id;
              const isAdjudicado = contract.sourceType === 'licitacion_adjudicada';

              return (
                <div
                  key={contract.id}
                  onClick={() => setSelectedContractId(contract.id)}
                  className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between gap-1.5 ${
                    isSelected
                      ? 'bg-[#1e3250] border-cyan-400 shadow-md ring-1 ring-cyan-400/40'
                      : 'bg-[#111c2e] border-[#334d6e] hover:border-slate-400/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5 flex-wrap">
                    <span
                      className={`text-[9.5px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        isAdjudicado
                          ? 'bg-purple-900/60 text-purple-200 border border-purple-500/40'
                          : 'bg-blue-900/60 text-blue-200 border border-blue-500/40'
                      }`}
                    >
                      {isAdjudicado ? '🏛️ Adjudicado' : '📦 OC Directa'}
                    </span>

                    {/* Identificación de Entrega e Instalación Oficial */}
                    <span className="text-[9.5px] font-black text-emerald-300 bg-emerald-950/90 px-2 py-0.5 rounded-md border border-emerald-500/50 flex items-center gap-1 shadow-sm">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 stroke-[3]" />
                      <span>Entregado e Instalado</span>
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-white leading-tight truncate" title={contract.clientName}>
                      {contract.clientName}
                    </h4>
                    <p className="text-[11px] text-slate-300 font-mono truncate mt-0.5" title={contract.contractNumber}>
                      {contract.contractNumber}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-[#334d6e]/50">
                    <span className="truncate">NIT: {contract.clientNit}</span>
                    <span className="text-cyan-300 font-bold truncate">
                      {contract.items.length} {contract.items.length === 1 ? 'equipo' : 'equipos'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* BANNER DE VINCULACIÓN CON FACTURACIÓN & ESTADO DE INICIO DEL CRONOGRAMA   */}
      {/* ========================================================================= */}
      {activeContract && (
        <div className="space-y-3">
          {/* Banner Principal del Cliente Activo */}
          <div className="bg-gradient-to-r from-[#112038] via-[#152744] to-[#112038] border border-cyan-500/30 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-black uppercase text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded-md border border-cyan-500/40">
                  Cliente Seleccionado
                </span>
                <h3 className="text-sm sm:text-base font-black text-white truncate">
                  {activeContract.clientName}
                </h3>
                <span className="text-xs font-mono text-slate-300">
                  (NIT: {activeContract.clientNit} • {activeContract.city})
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-300 flex-wrap">
                <span>
                  Proceso: <strong className="text-white">{activeContract.contractNumber}</strong>
                </span>
                <span>•</span>
                <span>
                  Equipos: <strong className="text-emerald-400">{activeContract.items.length}</strong>
                </span>
                <span>•</span>
                <span className="text-cyan-300 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Garantía: 1 Año (2 Mantenimientos Semestrales)</span>
                </span>
              </div>
            </div>

            {/* Estado de Entrega e Instalación Oficial y Factura Adjuntada */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <div className="flex items-center gap-2 bg-emerald-950/80 border border-emerald-500/50 px-3 py-1.5 rounded-xl shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
                <div className="text-left text-xs">
                  <span className="text-emerald-300 font-black block leading-tight">
                    Equipos Entregados e Instalados (Cronograma Activo)
                  </span>
                  <span className="text-[11px] text-slate-300 font-mono">
                    Instalación Oficial: {formatDateDisplay(activeContract.deliveryDate || activeContract.defaultInvoiceDate)}
                  </span>
                </div>
              </div>

              {activeContract.hasInvoice && (
                <div className="flex items-center gap-2 bg-purple-950/80 border border-purple-500/50 px-3 py-1.5 rounded-xl shadow-sm">
                  <ReceiptText className="w-4 h-4 text-purple-400 stroke-[2.5]" />
                  <div className="text-left text-xs">
                    <span className="text-purple-300 font-black block leading-tight">
                      Factura Adjunta: {activeContract.invoiceNumber || 'Factura de Venta'}
                    </span>
                    {activeContract.attachedInvoiceFile?.dataUrl ? (
                      <a
                        href={activeContract.attachedInvoiceFile.dataUrl}
                        download={activeContract.attachedInvoiceFile.name || 'Factura.pdf'}
                        className="text-[11px] text-cyan-300 hover:text-cyan-200 underline font-mono flex items-center gap-1 mt-0.5"
                        target="_blank"
                        rel="noreferrer"
                        title={`Descargar ${activeContract.attachedInvoiceFile.name}`}
                      >
                        <FileSpreadsheet className="w-3 h-3" />
                        <span className="truncate max-w-[150px]">{activeContract.attachedInvoiceFile.name}</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-300 font-mono">
                        {activeContract.defaultInvoiceDate ? formatDateDisplay(activeContract.defaultInvoiceDate) : 'Factura Vinculada'}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* BARRA DE CONVENCIONES OFICIALES */}
          <div className="bg-[#0c1626] border border-[#334d6e] rounded-xl p-3 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold">
              <span>Convenciones:</span>
            </div>

            <div className="flex items-center gap-3 flex-wrap text-xs">
              {/* Instalacion */}
              <div className="flex items-center gap-1.5 bg-blue-950/60 border border-blue-500/40 px-2.5 py-1 rounded-lg">
                <span className="bg-blue-500 text-slate-950 px-1.5 py-0.2 rounded font-black text-[10px]">
                  I
                </span>
                <span className="text-blue-200 font-bold text-xs">
                  Instalacion
                </span>
              </div>

              {/* Capacitacion */}
              <div className="flex items-center gap-1.5 bg-purple-950/60 border border-purple-500/40 px-2.5 py-1 rounded-lg">
                <span className="bg-purple-500 text-white px-1.5 py-0.2 rounded font-black text-[10px]">
                  CAP
                </span>
                <span className="text-purple-200 font-bold text-xs">
                  Capacitacion
                </span>
              </div>

              {/* Mantenimiento preventivo */}
              <div className="flex items-center gap-1.5 bg-cyan-950/60 border border-cyan-500/40 px-2.5 py-1 rounded-lg">
                <span className="bg-cyan-500 text-slate-950 px-1.5 py-0.2 rounded font-black text-[10px]">
                  P
                </span>
                <span className="text-cyan-200 font-bold text-xs">
                  mantenimiento preventivo
                </span>
              </div>

              {/* Mantenimiento correctivo */}
              <div className="flex items-center gap-1.5 bg-amber-950/60 border border-amber-500/40 px-2.5 py-1 rounded-lg">
                <span className="bg-amber-500 text-slate-950 px-1.5 py-0.2 rounded font-black text-[10px]">
                  C
                </span>
                <span className="text-amber-200 font-bold text-xs">
                  mantenimiento correctivo
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TABLA PRINCIPAL DE CRONOGRAMA SINCRONIZADA CON LA GARANTÍA               */}
      {/* ========================================================================= */}
      {activeContract && (
        <div className="bg-[#0f1b2d] border border-[#334d6e] rounded-2xl shadow-xl overflow-hidden">
          <div className="p-3 bg-[#132238] border-b border-[#334d6e] flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200">
                Matriz de Cronograma Mensual — Año {selectedYear} ({activeContract.items.length} Equipos)
              </span>
              <span className="text-[11px] text-cyan-400 font-medium">
                • 1 Año de Garantía y 2 Mantenimientos cada 6 meses (Semestral)
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              Haz clic en cualquier celda para alternar actividades o registrar un mantenimiento correctivo ocasional.
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#0c1626] text-slate-300 border-b border-[#334d6e] uppercase font-bold text-[10px] tracking-wider">
                  <th className="py-2.5 px-2 text-center w-10">#</th>
                  <th className="py-2.5 px-3 min-w-[210px]">Equipo Biomédico</th>
                  <th className="py-2.5 px-2.5 min-w-[140px] text-cyan-300">Serie (S/N Seguimiento OC)</th>
                  <th className="py-2.5 px-2.5 min-w-[170px] text-blue-300">Fecha Instalación</th>
                  <th className="py-2.5 px-2.5 min-w-[140px] text-indigo-300">Garantía</th>
                  <th className="py-2.5 px-2.5 min-w-[140px] text-emerald-300">Frecuencia Preventivo</th>
                  {/* 12 Meses */}
                  {MONTHS.map((m) => (
                    <th key={m.num} className="py-2.5 px-1 text-center min-w-[50px] text-cyan-300">
                      {m.label}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 min-w-[170px] text-purple-300">Soportes Capacitación</th>
                  <th className="py-2.5 px-2 text-center w-12">Editar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e324d]/60">
                {activeContract.items.map((item, idx) => {
                  const sch = getItemSchedule(item.id, item.realSerialFromOC);
                  const trainingEv = trainingEvidenceStore[activeContract.id]?.[item.id];
                  const hasAttendance = Boolean(trainingEv?.attendanceDoc);
                  const photoCount = trainingEv?.photos?.length || 0;

                  // Determinar mes de inicio por instalación
                  let instMonthNum = 0;
                  let isInstYear = false;
                  if (sch.installationDate) {
                    const d = new Date(sch.installationDate);
                    if (!isNaN(d.getTime())) {
                      if (d.getFullYear() === selectedYear) {
                        instMonthNum = d.getMonth() + 1;
                        isInstYear = true;
                      }
                    }
                  }

                  return (
                    <tr key={item.id} className="hover:bg-[#14233a] transition group">
                      {/* Índice */}
                      <td className="py-2.5 px-2 text-center font-bold text-slate-400 font-mono text-[11px]">
                        {idx + 1}
                      </td>

                      {/* Información del Equipo */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-white text-xs leading-tight">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-slate-300 font-medium mt-0.5">
                          <strong className="text-cyan-400">{item.brand}</strong> • {item.model}
                        </div>
                      </td>

                      {/* Serie Real de Seguimiento OC (Click para editar o asignar) */}
                      <td className="py-2.5 px-2.5">
                        {sch.serialNumber ? (
                          <div
                            onClick={() =>
                              setQuickEditItem({
                                itemId: item.id,
                                itemName: item.name,
                                brand: item.brand,
                                model: item.model,
                                serial: sch.serialNumber || '',
                                installationDate: sch.installationDate || '',
                                warrantyMonths: sch.warrantyMonths || 12,
                                frequency: sch.frequency,
                              })
                            }
                            className="flex items-center justify-between gap-1 font-mono text-xs text-emerald-300 bg-emerald-950/40 px-2 py-1 rounded-lg border border-emerald-500/30 font-bold hover:bg-emerald-900/40 transition cursor-pointer"
                            title="Clic para editar el número de serie (se sincroniza con Seguimiento de OC)"
                          >
                            <span className="truncate">S/N: {sch.serialNumber}</span>
                            <Edit2 className="w-3 h-3 text-emerald-400 shrink-0 opacity-70 hover:opacity-100" />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              setQuickEditItem({
                                itemId: item.id,
                                itemName: item.name,
                                brand: item.brand,
                                model: item.model,
                                serial: '',
                                installationDate: sch.installationDate || '',
                                warrantyMonths: sch.warrantyMonths || 12,
                                frequency: sch.frequency,
                              })
                            }
                            className="text-[11px] text-amber-400/90 italic flex items-center gap-1 bg-amber-950/30 px-2 py-1 rounded-lg border border-amber-500/20 hover:bg-amber-900/40 transition cursor-pointer w-full text-left"
                            title="Clic para asignar número de serie"
                          >
                            <AlertCircle className="w-3 h-3 shrink-0 text-amber-400" />
                            <span className="truncate">Sin serie • Clic para asignar</span>
                          </button>
                        )}
                      </td>

                      {/* Fecha de Instalación Oficial en IPS editable */}
                      <td className="py-2.5 px-2.5">
                        <div className="space-y-1">
                          <input
                            type="date"
                            value={sch.installationDate || ''}
                            onChange={(e) => handleUpdateInstallationDate(item.id, e.target.value)}
                            className="w-full border rounded-lg px-2 py-1 text-xs text-white font-mono outline-none cursor-pointer bg-[#111c2e] border-blue-500/40 focus:border-blue-400"
                            title="Fecha oficial de entrega e instalación en IPS (activa cronograma y capacitación)"
                          />
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>
                              {sch.installationDate ? (
                                <span className="text-blue-300 font-medium">
                                  Inst: {formatDateDisplay(sch.installationDate)}
                                </span>
                              ) : (
                                <span className="text-amber-400/90 italic">Fecha por definir</span>
                              )}
                            </span>
                            {sch.installationDate && (
                              <button
                                type="button"
                                onClick={() => handleResyncFromInstallationDate(item.id)}
                                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 cursor-pointer"
                                title="Re-sincronizar los mantenimientos preventivos según la garantía y frecuencia"
                              >
                                <Zap className="w-3 h-3" />
                                <span>Sincronizar</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Garantía (Editable en años, 1 a 5 años) */}
                      <td className="py-2.5 px-2.5">
                        <div className="space-y-1">
                          <select
                            value={Math.round((sch.warrantyMonths || 12) / 12) || 1}
                            onChange={(e) =>
                              handleUpdateWarrantyYears(item.id, parseInt(e.target.value, 10))
                            }
                            className="w-full bg-[#111c2e] border border-indigo-500/40 rounded-lg px-2 py-1 text-xs text-indigo-300 font-bold focus:border-indigo-400 outline-none cursor-pointer"
                            title="Modificar años de cobertura de garantía técnica"
                          >
                            <option value={1} className="bg-[#111c2e] text-white">
                              1 Año (12m • 2 Preventivos)
                            </option>
                            <option value={2} className="bg-[#111c2e] text-white">
                              2 Años (24m • 4 Preventivos)
                            </option>
                            <option value={3} className="bg-[#111c2e] text-white">
                              3 Años (36m • 6 Preventivos)
                            </option>
                            <option value={4} className="bg-[#111c2e] text-white">
                              4 Años (48m • 8 Preventivos)
                            </option>
                            <option value={5} className="bg-[#111c2e] text-white">
                              5 Años (60m • 10 Preventivos)
                            </option>
                          </select>
                          <div className="text-[10px] space-y-0.5">
                            {sch.installationDate ? (
                              <div>
                                <span className="text-slate-400 font-mono block">
                                  Vence: <strong className="text-indigo-300">{formatDateDisplay(sch.warrantyEndDate)}</strong>
                                </span>
                                {sch.warrantyEndDate && new Date(sch.warrantyEndDate).getFullYear() < selectedYear && (
                                  <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-amber-950/70 text-amber-300 border border-amber-500/30 font-bold text-[9px]">
                                    Garantía Vencida en {selectedYear}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-500 italic">Vigencia 1 año</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Frecuencia Preventivo (Default: Semestral - 2 al año cada 6 meses) */}
                      <td className="py-2.5 px-2.5">
                        <div className="space-y-1">
                          <select
                            value={sch.frequency}
                            onChange={(e) =>
                              handleChangeFrequency(item.id, e.target.value as MaintenanceFrequencyType)
                            }
                            className="w-full bg-[#111c2e] border border-emerald-500/40 rounded-lg px-2 py-1.5 text-xs text-emerald-300 font-black focus:border-emerald-400 outline-none cursor-pointer"
                          >
                            {FREQUENCY_OPTIONS.map((opt) => (
                              <option key={opt} value={opt} className="bg-[#111c2e] text-white">
                                {opt} {opt === 'Semestral' ? '(Cada 6 meses)' : opt === 'Trimestral' ? '(Cada 3 meses)' : opt === 'Cuatrimestral' ? '(Cada 4 meses)' : opt === 'Bimestral' ? '(Cada 2 meses)' : opt === 'Mensual' ? '(Cada mes)' : '(1 al año)'}
                              </option>
                            ))}
                          </select>
                          <div className="text-[10px] text-emerald-400/90 font-medium">
                            {(() => {
                              const wYears = Math.round((sch.warrantyMonths || 12) / 12) || 1;
                              let perYear = 2;
                              if (sch.frequency === 'Trimestral') perYear = 4;
                              else if (sch.frequency === 'Cuatrimestral') perYear = 3;
                              else if (sch.frequency === 'Bimestral') perYear = 6;
                              else if (sch.frequency === 'Mensual') perYear = 12;
                              else if (sch.frequency === 'Anual') perYear = 1;
                              const totalMttos = perYear * wYears;
                              return (
                                <span>
                                  {totalMttos} mttos en {wYears} {wYears === 1 ? 'año' : 'años'} ({perYear}/año)
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </td>

                      {/* 12 Meses Matriz (Clic directo para gestionar múltiples convenciones en la misma celda) */}
                      {MONTHS.map((m) => {
                        const cell = sch.months[m.num] || { inst: false, mp: null, mc: false, cap: false };
                        const isPreInstallation = isInstYear && instMonthNum > 0 && m.num < instMonthNum;
                        const isInstallMonth = isInstYear && m.num === instMonthNum;
                        const hasActivity = cell.inst || cell.mp || cell.mc || cell.cap;

                        return (
                          <td
                            key={m.num}
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveCellPopover({
                                itemId: item.id,
                                itemName: item.name,
                                monthNum: m.num,
                                monthName: m.full,
                              });
                            }}
                            className={`py-2 px-1 text-center cursor-pointer transition select-none border-l border-[#1e324d]/40 ${
                              isPreInstallation
                                ? 'bg-slate-900/40 opacity-40 hover:opacity-80'
                                : isInstallMonth
                                ? 'bg-blue-950/20 hover:bg-blue-900/30'
                                : cell.mp === 'P'
                                ? 'bg-cyan-950/25 hover:bg-cyan-900/35'
                                : cell.mc
                                ? 'bg-amber-950/25 hover:bg-amber-900/35'
                                : cell.cap
                                ? 'bg-purple-950/25 hover:bg-purple-900/35'
                                : cell.inst
                                ? 'bg-blue-950/25 hover:bg-blue-900/35'
                                : 'hover:bg-[#1a2d48]'
                            }`}
                            title="Clic para gestionar convenciones: Instalación (I), Capacitación (CAP), Preventivo (P), Correctivo (C)"
                          >
                            <div className="flex flex-wrap items-center justify-center gap-1 min-h-[38px] p-0.5 rounded-lg">
                              {/* I: Instalación */}
                              {cell.inst && (
                                <span
                                  className="bg-blue-500 text-slate-950 px-1.5 py-0.5 rounded text-[10px] font-black leading-none shadow-xs"
                                  title="Instalación de Equipo"
                                >
                                  I
                                </span>
                              )}

                              {/* CAP: Capacitación */}
                              {cell.cap && (
                                <span
                                  className="bg-purple-500 text-white px-1.5 py-0.5 rounded text-[9.5px] font-black leading-none shadow-xs"
                                  title="Capacitación al Personal"
                                >
                                  CAP
                                </span>
                              )}

                              {/* MP: P (Programado) o E (Ejecutado) */}
                              {(cell.mp === 'P' || cell.mp === 'E') && (
                                <span
                                  className="bg-cyan-500 text-slate-950 px-1.5 py-0.5 rounded text-[10px] font-black leading-none shadow-xs"
                                  title={cell.mp === 'E' ? 'Preventivo Ejecutado' : 'Preventivo Programado'}
                                >
                                  {cell.mp}
                                </span>
                              )}

                              {/* MC: Correctivo Ocasional */}
                              {cell.mc && (
                                <span
                                  className="bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded text-[10px] font-black leading-none shadow-xs animate-pulse"
                                  title="Mantenimiento Correctivo"
                                >
                                  C
                                </span>
                              )}

                              {!hasActivity && !isPreInstallation && (
                                <span className="text-slate-600 group-hover:text-slate-400 text-[10px] leading-none">
                                  -
                                </span>
                              )}

                              {isPreInstallation && (
                                <span className="text-slate-700 text-[9px] leading-none font-mono">
                                  Pre
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* Soportes y Fotos de Capacitación por Equipo */}
                      <td className="py-2.5 px-3">
                        <button
                          type="button"
                          onClick={() =>
                            setTrainingModalItem({
                              itemId: item.id,
                              itemName: item.name,
                              brand: item.brand,
                              model: item.model,
                              serial: sch.serialNumber || 'Sin serie registrada',
                              installationDate: sch.installationDate,
                            })
                          }
                          className={`w-full py-1.5 px-2.5 rounded-xl border flex items-center justify-between gap-1.5 transition cursor-pointer text-xs font-bold ${
                            hasAttendance || photoCount > 0
                              ? 'bg-purple-950/60 border-purple-500/40 text-purple-200 hover:bg-purple-900/60'
                              : 'bg-[#15253d] border-[#334d6e] text-slate-300 hover:border-purple-400 hover:text-white'
                          }`}
                          title="Adjuntar listado de asistencia y fotos de la capacitación realizada a este equipo"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <GraduationCap className="w-4 h-4 text-purple-400 shrink-0" />
                            <span className="truncate">
                              {hasAttendance || photoCount > 0
                                ? 'Evidencias Adjuntas'
                                : '+ Asistencia & Fotos'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                            {hasAttendance && (
                              <span className="bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/40 font-bold" title="Asistencia adjunta">
                                📄 Doc
                              </span>
                            )}
                            {photoCount > 0 && (
                              <span className="bg-purple-900 text-purple-200 px-1.5 py-0.2 rounded border border-purple-500/40 font-bold" title={`${photoCount} fotos adjuntas`}>
                                📷 {photoCount}
                              </span>
                            )}
                          </div>
                        </button>
                      </td>

                      {/* Editar Ficha Rápida */}
                      <td className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setQuickEditItem({
                              itemId: item.id,
                              itemName: item.name,
                              brand: item.brand,
                              model: item.model,
                              serial: sch.serialNumber || '',
                              installationDate: sch.installationDate || '',
                              warrantyMonths: sch.warrantyMonths || 12,
                              frequency: sch.frequency,
                            })
                          }
                          className="p-1.5 rounded-lg bg-sky-950/60 hover:bg-sky-900 text-sky-300 border border-sky-600/40 transition cursor-pointer"
                          title="Personalizar Serie, Fecha de Instalación, Garantía y Frecuencia"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {activeContract.items.length === 0 && (
                  <tr>
                    <td colSpan={18} className="py-12 text-center text-slate-400 italic">
                      Este contrato no tiene equipos registrados aún en la dotación.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADJUNTAR LISTA DE ASISTENCIA Y FOTOS DE CAPACITACIÓN POR EQUIPO */}
      {/* ========================================================================= */}
      {trainingModalItem && activeContract && (
        <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-[#15253d] border border-purple-500/50 rounded-2xl max-w-2xl w-full p-5 shadow-2xl space-y-4 animate-scaleUp max-h-[92vh] overflow-y-auto custom-scrollbar">
            {/* Encabezado */}
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white">
                    Soportes y Evidencias de Capacitación por Equipo
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    <strong>{trainingModalItem.itemName}</strong> • S/N:{' '}
                    <span className="font-mono text-cyan-300 font-bold">{trainingModalItem.serial}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTrainingModalItem(null)}
                className="text-slate-400 hover:text-white font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Aviso: Capacitación el mismo día de la instalación */}
            <div className="p-2.5 bg-purple-950/40 border border-purple-500/40 rounded-xl text-xs text-purple-200 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-300 shrink-0" />
              <span>
                <strong>Fecha Oficial de Capacitación:</strong> El mismo día de instalación (
                {formatDateDisplay(trainingModalItem.installationDate)}). Adjunta aquí el listado de asistencia firmado y las fotografías del personal capacitado.
              </span>
            </div>

            {(() => {
              const currentEv = trainingEvidenceStore[activeContract.id]?.[trainingModalItem.itemId] || {
                attendanceDoc: null,
                photos: [],
                status: 'Programada',
              };

              return (
                <div className="space-y-4 text-xs">
                  {/* SECCIÓN A: LISTADO DE ASISTENCIA OFICIAL */}
                  <div className="bg-[#0f1b2d] p-4 rounded-xl border border-slate-700/70 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold text-white text-xs">
                          1. Formato / Listado de Asistencia Firmado
                        </span>
                      </div>
                      <input
                        type="file"
                        ref={attendanceFileInputRef}
                        onChange={handleUploadAttendanceDoc}
                        accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => attendanceFileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-md transition"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Adjuntar Asistencia (PDF / Imagen)</span>
                      </button>
                    </div>

                    {currentEv.attendanceDoc ? (
                      <div className="flex items-center justify-between p-2.5 bg-[#172b47] rounded-xl border border-emerald-500/40">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-5 h-5 text-emerald-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="font-bold text-white text-xs truncate">
                              {currentEv.attendanceDoc.name}
                            </p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              Tamaño: {currentEv.attendanceDoc.size} • Subido:{' '}
                              {new Date(currentEv.attendanceDoc.uploadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={currentEv.attendanceDoc.dataUrl}
                            download={currentEv.attendanceDoc.name}
                            className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 transition cursor-pointer"
                            title="Descargar lista de asistencia"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => {
                              const updatedEv: TrainingEvidenceItem = {
                                ...currentEv,
                                attendanceDoc: null,
                              };
                              saveTrainingEvidence(activeContract.id, trainingModalItem.itemId, updatedEv);
                              showToast('Lista de asistencia removida.');
                            }}
                            className="p-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 transition cursor-pointer"
                            title="Eliminar archivo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 text-center border border-dashed border-slate-700 rounded-xl text-slate-400 italic">
                        No se ha adjuntado aún el listado de asistencia de capacitación para este equipo.
                      </div>
                    )}
                  </div>

                  {/* SECCIÓN B: FOTOS DE LA CAPACITACIÓN POR EQUIPO */}
                  <div className="bg-[#0f1b2d] p-4 rounded-xl border border-slate-700/70 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Camera className="w-4 h-4 text-purple-400" />
                        <span className="font-bold text-white text-xs">
                          2. Fotografías de la Capacitación en Sede ({currentEv.photos?.length || 0})
                        </span>
                      </div>
                      <input
                        type="file"
                        ref={photosFileInputRef}
                        onChange={handleUploadTrainingPhotos}
                        accept="image/*"
                        multiple
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => photosFileInputRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer shadow-md transition"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Subir Fotos</span>
                      </button>
                    </div>

                    {currentEv.photos && currentEv.photos.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                        {currentEv.photos.map((ph, pIdx) => (
                          <div
                            key={ph.id}
                            className="group relative bg-[#15253d] rounded-xl overflow-hidden border border-slate-700 hover:border-purple-400 transition flex flex-col"
                          >
                            <div
                              onClick={() =>
                                setLightboxPhoto({
                                  url: ph.dataUrl,
                                  title: `Foto ${pIdx + 1}: ${ph.name}`,
                                  caption: ph.caption,
                                })
                              }
                              className="h-28 bg-black/40 flex items-center justify-center cursor-pointer overflow-hidden"
                            >
                              <img
                                src={ph.dataUrl}
                                alt={ph.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                              />
                            </div>
                            <div className="p-2 flex items-center justify-between gap-1 text-[10px] text-slate-300">
                              <span className="truncate" title={ph.name}>
                                {ph.name}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLightboxPhoto({
                                      url: ph.dataUrl,
                                      title: `Foto ${pIdx + 1}: ${ph.name}`,
                                    })
                                  }
                                  className="text-cyan-400 hover:text-cyan-300 p-0.5"
                                  title="Ver grande"
                                >
                                  <Eye className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeletePhoto(ph.id)}
                                  className="text-rose-400 hover:text-rose-300 p-0.5"
                                  title="Eliminar foto"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 text-center border border-dashed border-slate-700 rounded-xl text-slate-400 italic">
                        No hay fotografías registradas aún. Haz clic en "Subir Fotos" para adjuntar evidencias visuales de la inducción al personal.
                      </div>
                    )}
                  </div>

                  {/* Botón Cerrar */}
                  <div className="pt-2 flex justify-end border-t border-slate-700/60">
                    <button
                      type="button"
                      onClick={() => setTrainingModalItem(null)}
                      className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer shadow-md"
                    >
                      Listo / Guardar Soportes
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EDICIÓN RÁPIDA DE SERIE, FECHA DE INSTALACIÓN Y GARANTÍA         */}
      {/* ========================================================================= */}
      {quickEditItem && activeContract && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
          <div className="bg-[#15253d] border border-cyan-500/50 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-2.5">
              <div>
                <h3 className="text-sm font-black text-white">
                  Editar Datos: {quickEditItem.itemName}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  {quickEditItem.brand} • {quickEditItem.model}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickEditItem(null)}
                className="text-slate-400 hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Número de Serie (S/N de Seguimiento de OC):
                </label>
                <input
                  type="text"
                  value={quickEditItem.serial}
                  onChange={(e) => setQuickEditItem({ ...quickEditItem, serial: e.target.value })}
                  placeholder="Ej: MD-2026-101"
                  className="w-full bg-[#111c2e] border border-[#334d6e] rounded-lg px-2.5 py-1.5 text-xs text-white font-mono outline-none focus:border-cyan-400"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Se sincroniza con el módulo de Seguimiento de Órdenes de Compra.
                </p>
              </div>

              <div>
                <label className="block text-blue-300 font-bold mb-1">
                  Fecha de Facturación / Instalación:
                </label>
                <input
                  type="date"
                  value={quickEditItem.installationDate}
                  onChange={(e) =>
                    setQuickEditItem({ ...quickEditItem, installationDate: e.target.value })
                  }
                  className="w-full bg-[#111c2e] border border-blue-500/40 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono outline-none focus:border-blue-400 cursor-pointer"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Por defecto toma la fecha de la factura en Órdenes de Ventas. Puedes ajustarla si la instalación física fue en días posteriores.
                </p>
              </div>

              <div>
                <label className="block text-indigo-300 font-bold mb-1">
                  Años de Garantía Técnica:
                </label>
                <select
                  value={Math.round((quickEditItem.warrantyMonths || 12) / 12) || 1}
                  onChange={(e) =>
                    setQuickEditItem({
                      ...quickEditItem,
                      warrantyMonths: (parseInt(e.target.value, 10) || 1) * 12,
                    })
                  }
                  className="w-full bg-[#111c2e] border border-indigo-500/40 rounded-lg px-2.5 py-1.5 text-xs text-indigo-300 font-bold outline-none focus:border-indigo-400 cursor-pointer"
                >
                  <option value={1} className="bg-[#111c2e] text-white">1 Año (12 meses - 2 Preventivos semestrales)</option>
                  <option value={2} className="bg-[#111c2e] text-white">2 Años (24 meses - 4 Preventivos semestrales)</option>
                  <option value={3} className="bg-[#111c2e] text-white">3 Años (36 meses - 6 Preventivos semestrales)</option>
                  <option value={4} className="bg-[#111c2e] text-white">4 Años (48 meses - 8 Preventivos semestrales)</option>
                  <option value={5} className="bg-[#111c2e] text-white">5 Años (60 meses - 10 Preventivos semestrales)</option>
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  Cobertura: {quickEditItem.warrantyMonths} meses en total.
                </p>
              </div>

              <div>
                <label className="block text-emerald-300 font-bold mb-1">
                  Frecuencia de Mantenimiento Preventivo:
                </label>
                <select
                  value={quickEditItem.frequency || 'Semestral'}
                  onChange={(e) =>
                    setQuickEditItem({
                      ...quickEditItem,
                      frequency: e.target.value as MaintenanceFrequencyType,
                    })
                  }
                  className="w-full bg-[#111c2e] border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-bold outline-none focus:border-emerald-400 cursor-pointer"
                >
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt} className="bg-[#111c2e] text-white">
                      {opt} {opt === 'Semestral' ? '(Cada 6 meses - 2 al año)' : opt === 'Trimestral' ? '(Cada 3 meses - 4 al año)' : opt === 'Cuatrimestral' ? '(Cada 4 meses - 3 al año)' : opt === 'Bimestral' ? '(Cada 2 meses - 6 al año)' : opt === 'Mensual' ? '(Cada mes - 12 al año)' : '(1 al año)'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-700/60">
                <button
                  type="button"
                  onClick={() => setQuickEditItem(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!activeContract || !quickEditItem) return;
                    const trimmedSerial = (quickEditItem.serial || '').trim();

                    // 1. Guardar ajustes del equipo de manera persistente (válido para todos los años)
                    saveEquipmentSettings(activeContract.id, quickEditItem.itemId, {
                      serialNumber: trimmedSerial,
                      installationDate: quickEditItem.installationDate,
                      warrantyMonths: quickEditItem.warrantyMonths,
                      frequency: quickEditItem.frequency || 'Semestral',
                    });

                    // 2. Sincronizar número de serie a Seguimiento de OC y Órdenes de Venta
                    if (trimmedSerial) {
                      syncSerialNumberToAllStores(
                        activeContract.id,
                        activeContract.contractNumber,
                        quickEditItem.itemId,
                        quickEditItem.itemName,
                        quickEditItem.model,
                        trimmedSerial
                      );
                    }

                    // 3. Limpiar sobrescrituras para regenerar el cronograma limpio
                    if (cellOverridesStore[activeContract.id]) {
                      const curContract = { ...cellOverridesStore[activeContract.id] };
                      for (const yr of Object.keys(curContract)) {
                        if (curContract[Number(yr)]?.[quickEditItem.itemId]) {
                          delete curContract[Number(yr)][quickEditItem.itemId];
                        }
                      }
                      setCellOverridesStore({ ...cellOverridesStore, [activeContract.id]: curContract });
                      try {
                        localStorage.setItem('syd_maintenance_cell_overrides_v4', JSON.stringify({ ...cellOverridesStore, [activeContract.id]: curContract }));
                      } catch (e) {}
                    }

                    if (matrixStore[activeContract.id]) {
                      const curMat = { ...matrixStore[activeContract.id] };
                      for (const yr of Object.keys(curMat)) {
                        if (curMat[Number(yr)]?.[quickEditItem.itemId]) {
                          delete curMat[Number(yr)][quickEditItem.itemId];
                        }
                      }
                      saveMatrixStore({ ...matrixStore, [activeContract.id]: curMat });
                    }

                    setQuickEditItem(null);
                    showToast(`✓ Datos del equipo y serie "${trimmedSerial || 'Sin serie'}" sincronizados con éxito.`);
                  }}
                  className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs cursor-pointer shadow-md"
                >
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SELECCIÓN Y CONFIGURACIÓN DE MÚLTIPLES CONVENCIONES DEL MES        */}
      {/* ========================================================================= */}
      {activeCellPopover && activeContract && (() => {
        const currentItemSchedule = getItemSchedule(activeCellPopover.itemId);
        const currentCell = currentItemSchedule.months[activeCellPopover.monthNum] || {
          inst: false,
          mp: null,
          mc: false,
          cap: false,
        };

        return (
          <div
            className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn"
            onClick={() => setActiveCellPopover(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-[#15253d] border border-cyan-500/60 rounded-2xl max-w-sm w-full p-4 sm:p-5 shadow-2xl space-y-4 animate-scaleUp text-xs"
            >
              <div className="flex items-center justify-between border-b border-slate-700/70 pb-2.5">
                <div>
                  <span className="text-[10px] font-black uppercase text-cyan-400 bg-cyan-950/90 px-2 py-0.5 rounded border border-cyan-500/40">
                    Convenciones del Mes
                  </span>
                  <h4 className="text-sm font-black text-white mt-1">
                    {activeCellPopover.monthName} — Año {selectedYear}
                  </h4>
                  <p className="text-[11px] text-slate-300 truncate max-w-[260px]">
                    {activeCellPopover.itemName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCellPopover(null)}
                  className="text-slate-400 hover:text-white font-bold text-lg p-1 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <p className="text-slate-300 text-xs">
                Activa o desactiva las actividades para este mes. Puedes marcar <strong>varias convenciones simultáneamente</strong> (ej: Instalación + Capacitación el mismo mes):
              </p>

              {/* Botones de Convención */}
              <div className="space-y-2">
                {/* I: Instalación */}
                <button
                  type="button"
                  onClick={() =>
                    handleToggleCellConvention(
                      activeCellPopover.itemId,
                      activeCellPopover.monthNum,
                      'inst'
                    )
                  }
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                    currentCell.inst
                      ? 'bg-blue-950/80 border-blue-400 text-white shadow-md'
                      : 'bg-[#101b2d] border-[#294263] text-slate-400 hover:text-white hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-blue-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-sm">
                      I
                    </span>
                    <div className="text-left">
                      <span className="text-xs font-bold block text-white">Instalación de Equipo</span>
                      <span className="text-[10px] text-blue-300">Puesta en marcha en la IPS</span>
                    </div>
                  </div>
                  <span className={`text-xs font-black ${currentCell.inst ? 'text-blue-400' : 'text-slate-600'}`}>
                    {currentCell.inst ? '✓ Activa' : 'Inactiva'}
                  </span>
                </button>

                {/* CAP: Capacitación */}
                <button
                  type="button"
                  onClick={() =>
                    handleToggleCellConvention(
                      activeCellPopover.itemId,
                      activeCellPopover.monthNum,
                      'cap'
                    )
                  }
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                    currentCell.cap
                      ? 'bg-purple-950/80 border-purple-400 text-white shadow-md'
                      : 'bg-[#101b2d] border-[#294263] text-slate-400 hover:text-white hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-purple-500 text-white font-black text-xs flex items-center justify-center shadow-sm">
                      CAP
                    </span>
                    <div className="text-left">
                      <span className="text-xs font-bold block text-white">Capacitación al Personal</span>
                      <span className="text-[10px] text-purple-300">Entrenamiento asistencial / biomédico</span>
                    </div>
                  </div>
                  <span className={`text-xs font-black ${currentCell.cap ? 'text-purple-400' : 'text-slate-600'}`}>
                    {currentCell.cap ? '✓ Activa' : 'Inactiva'}
                  </span>
                </button>

                {/* P: Mantenimiento Preventivo */}
                <button
                  type="button"
                  onClick={() =>
                    handleToggleCellConvention(
                      activeCellPopover.itemId,
                      activeCellPopover.monthNum,
                      'mp'
                    )
                  }
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                    currentCell.mp
                      ? 'bg-cyan-950/80 border-cyan-400 text-white shadow-md'
                      : 'bg-[#101b2d] border-[#294263] text-slate-400 hover:text-white hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-cyan-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-sm">
                      P
                    </span>
                    <div className="text-left">
                      <span className="text-xs font-bold block text-white">Mantenimiento Preventivo</span>
                      <span className="text-[10px] text-cyan-300">Revisión periódica semestral</span>
                    </div>
                  </div>
                  <span className={`text-xs font-black ${currentCell.mp ? 'text-cyan-400' : 'text-slate-600'}`}>
                    {currentCell.mp ? '✓ Activa' : 'Inactiva'}
                  </span>
                </button>

                {/* C: Mantenimiento Correctivo */}
                <button
                  type="button"
                  onClick={() =>
                    handleToggleCellConvention(
                      activeCellPopover.itemId,
                      activeCellPopover.monthNum,
                      'mc'
                    )
                  }
                  className={`w-full p-2.5 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                    currentCell.mc
                      ? 'bg-amber-950/80 border-amber-400 text-white shadow-md'
                      : 'bg-[#101b2d] border-[#294263] text-slate-400 hover:text-white hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-sm">
                      C
                    </span>
                    <div className="text-left">
                      <span className="text-xs font-bold block text-white">Mantenimiento Correctivo</span>
                      <span className="text-[10px] text-amber-300">Atención de fallo imprevisto</span>
                    </div>
                  </div>
                  <span className={`text-xs font-black ${currentCell.mc ? 'text-amber-400' : 'text-slate-600'}`}>
                    {currentCell.mc ? '✓ Activa' : 'Inactiva'}
                  </span>
                </button>
              </div>

              {/* Acciones Rápidas */}
              <div className="pt-2 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() =>
                      handleSetBothInstAndCap(
                        activeCellPopover.itemId,
                        activeCellPopover.monthNum
                      )
                    }
                    className="text-[11px] font-bold text-indigo-300 hover:text-white bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-500/40 px-2 py-1.5 rounded-lg transition cursor-pointer"
                    title="Marcar Instalación y Capacitación en este mismo mes"
                  >
                    ⚡ Activar I + CAP
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleInactivateBothInstAndCap(
                        activeCellPopover.itemId,
                        activeCellPopover.monthNum
                      )
                    }
                    className="text-[11px] font-bold text-rose-300 hover:text-white bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 px-2 py-1.5 rounded-lg transition cursor-pointer"
                    title="Inactivar simultáneamente Instalación y Capacitación en este mes"
                  >
                    🚫 Inactivar I y CAP
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      handleClearCell(
                        activeCellPopover.itemId,
                        activeCellPopover.monthNum
                      )
                    }
                    className="text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-600/50 px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                    title="Limpiar todas las convenciones de este mes"
                  >
                    Limpiar
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCellPopover(null)}
                    className="text-xs font-black text-slate-950 bg-cyan-400 hover:bg-cyan-300 px-3 py-1.5 rounded-lg transition shadow-md cursor-pointer"
                  >
                    Listo
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL LIGHTBOX: VISOR DE FOTO AMPLIA DE CAPACITACIÓN                     */}
      {/* ========================================================================= */}
      {lightboxPhoto && (
        <div
          onClick={() => setLightboxPhoto(null)}
          className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-w-4xl max-h-[90vh] bg-[#111c2e] rounded-2xl overflow-hidden border border-slate-700 shadow-2xl flex flex-col"
          >
            <div className="p-3 bg-[#15253d] border-b border-slate-700 flex items-center justify-between">
              <span className="font-bold text-white text-xs truncate">{lightboxPhoto.title}</span>
              <button
                type="button"
                onClick={() => setLightboxPhoto(null)}
                className="text-slate-400 hover:text-white font-bold text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-2 flex items-center justify-center bg-black max-h-[75vh] overflow-hidden">
              <img
                src={lightboxPhoto.url}
                alt={lightboxPhoto.title}
                className="max-w-full max-h-[75vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
