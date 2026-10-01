import * as XLSX from 'xlsx';
import {
  SavedQuote,
  MedicalEquipment,
  TenderClientProject,
  OCTrackingContract,
  TechnicalDocument,
  StoredUserAccount,
  ThemeSettings,
  QuoteHeader,
  QuoteItem,
  AuthUser,
  QuoteStatus,
  SalesOrderRecord,
  SalesInvoiceRecord,
  SupplierProfile,
} from '../types';
import { ClientRecord } from './clientStorage';
import { CURRENT_APP_VERSION } from './versionCheck';
import { directBatchRestoreToFirestore } from '../services/realtimeSync';
import { FULL_ADMIN_PERMISSIONS, DEFAULT_VIEWER_PERMISSIONS } from '../data/authData';
import { unifyAllDuplicateSuppliers } from './supplierDeduplication';
import { isContractDeleted, isSalesOrderDeleted, isSalesInvoiceDeleted } from './tombstones';
import { deduplicateTenderProjects } from './tenderDeduplication';

export interface AppBackupMetadata {
  version: string;
  exportTimestamp: string;
  exportDateFormatted: string;
  appName: string;
  exportedBy: {
    id?: string;
    name?: string;
    username?: string;
    role?: string;
    email?: string;
  };
  counts: {
    quotes: number;
    equipments: number;
    tenderProjects: number;
    ocContracts: number;
    salesOrders?: number;
    salesInvoices?: number;
    technicalDocuments: number;
    systemUsers: number;
  };
}

export interface AppBackupPayload {
  metadata: AppBackupMetadata;
  data: {
    quotes: SavedQuote[];
    equipments: MedicalEquipment[];
    tenderProjects: TenderClientProject[];
    ocContracts: OCTrackingContract[];
    salesOrders?: SalesOrderRecord[];
    salesInvoices?: SalesInvoiceRecord[];
    technicalDocuments: TechnicalDocument[];
    systemUsers: StoredUserAccount[];
    themeSettings?: ThemeSettings;
    activeLetterheadUrl?: string | null;
    currentQuoteDraft?: {
      header?: QuoteHeader;
      items?: QuoteItem[];
    };
  };
}

export interface GenerateBackupParams {
  quotes: SavedQuote[];
  equipments: MedicalEquipment[];
  tenderProjects: TenderClientProject[];
  ocContracts: OCTrackingContract[];
  salesOrders?: SalesOrderRecord[];
  salesInvoices?: SalesInvoiceRecord[];
  technicalDocuments: TechnicalDocument[];
  systemUsers: StoredUserAccount[];
  themeSettings?: ThemeSettings;
  activeLetterheadUrl?: string | null;
  currentQuoteDraft?: {
    header?: QuoteHeader;
    items?: QuoteItem[];
  };
  currentUser?: AuthUser | null;
}

/**
 * Generates a full snapshot object of the entire application state
 */
export function generateAppBackup(params: GenerateBackupParams): AppBackupPayload {
  const now = new Date();
  const dateFormatted = now.toLocaleString('es-CO', {
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  const metadata: AppBackupMetadata = {
    appName: 'SYD Colombia - Software de Cotizaciones y Licitaciones',
    version: CURRENT_APP_VERSION,
    exportTimestamp: now.toISOString(),
    exportDateFormatted: dateFormatted,
    exportedBy: {
      id: params.currentUser?.id || 'admin',
      name: params.currentUser?.name || 'Administrador',
      username: params.currentUser?.username || 'admin',
      role: params.currentUser?.role || 'admin',
      email: params.currentUser?.email || '',
    },
    counts: {
      quotes: params.quotes.length,
      equipments: params.equipments.length,
      tenderProjects: params.tenderProjects.length,
      ocContracts: params.ocContracts.length,
      salesOrders: (params.salesOrders || []).length,
      salesInvoices: (params.salesInvoices || []).length,
      technicalDocuments: params.technicalDocuments.length,
      systemUsers: params.systemUsers.length,
    },
  };

  return {
    metadata,
    data: {
      quotes: params.quotes,
      equipments: params.equipments,
      tenderProjects: params.tenderProjects,
      ocContracts: params.ocContracts,
      salesOrders: params.salesOrders || [],
      salesInvoices: params.salesInvoices || [],
      technicalDocuments: params.technicalDocuments,
      systemUsers: params.systemUsers,
      themeSettings: params.themeSettings,
      activeLetterheadUrl: params.activeLetterheadUrl,
      currentQuoteDraft: params.currentQuoteDraft,
    },
  };
}

/**
 * Downloads the backup data payload as a formatted .json file directly to the client's device
 */
export function downloadBackupAsJson(backupPayload: AppBackupPayload): void {
  const dateSlug = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `Backup_SYD_Colombia_${dateSlug}.json`;

  const jsonString = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  // Save record of last manual backup
  try {
    localStorage.setItem('syd_last_manual_backup_date', new Date().toISOString());
    localStorage.setItem('syd_last_manual_backup_filename', fileName);
  } catch (e) {}
}

/**
 * Downloads the full database state as a rich, multi-tab Microsoft Excel (.xlsx) workbook
 */
export function downloadDatabaseAsExcel(params: GenerateBackupParams): void {
  const dateSlug = new Date().toISOString().split('T')[0];
  const fileName = `Base_de_Datos_Maestra_SYD_Colombia_${dateSlug}.xlsx`;

  const wb = XLSX.utils.book_new();

  // Helper to safely format cell strings
  const cleanStr = (val: any) => (val === undefined || val === null ? '' : String(val).trim());

  // 1. Sheet: Catálogo de Equipos Médicos
  const catalogRows = (params.equipments || []).map((eq, idx) => ({
    'ID': eq.id || `eq_${idx + 1}`,
    'Código': cleanStr(eq.code),
    'Nombre del Equipo': cleanStr(eq.name),
    'Marca': cleanStr(eq.brand),
    'Modelo': cleanStr(eq.model),
    'Grupo de Producto': eq.productGroup || 'Equipos Médicos',
    'Categoría': eq.category || 'Diagnóstico',
    'Proveedor Principal': cleanStr(eq.supplier),
    'Proveedores Alternos': Array.isArray(eq.allSuppliers) ? eq.allSuppliers.join(', ') : '',
    'Costo Base COP': Number(eq.baseCostCOP) || 0,
    'Costo USD': Number(eq.baseCostUSD) || 0,
    'Lista de Margen Sugerida': eq.defaultMarginList || 'L4',
    'IVA Exento': eq.taxExempt ? 'SÍ' : 'NO',
    'Tarifa IVA %': eq.taxRate !== undefined ? Number(eq.taxRate) : (eq.taxExempt ? 0 : 19),
    'Registro INVIMA': cleanStr(eq.invimaRecordNumber || 'En Trámite'),
    'Estado INVIMA': cleanStr(eq.invimaStatus || 'Vigente'),
    'Vigencia INVIMA': cleanStr(eq.invimaExpiryDate),
    'Garantía (Meses)': Number(eq.warrantyMonths) || 24,
    'País de Origen': cleanStr(eq.originCountry || 'Colombia'),
    'Descripción Comercial': cleanStr(eq.description),
    'Especificaciones Técnicas': Array.isArray(eq.technicalSpecs) ? eq.technicalSpecs.join(' | ') : '',
    'Accesorios Estándar': Array.isArray(eq.standardAccessories)
      ? eq.standardAccessories.map(a => `${a.name}${a.costCOP ? ` ($${a.costCOP})` : ''}`).join(' | ')
      : '',
  }));
  const wsCatalog = XLSX.utils.json_to_sheet(
    catalogRows.length > 0 ? catalogRows : [{ 'Código': 'EQ-001', 'Nombre del Equipo': 'Monitor de Signos Vitales', 'Marca': 'SYD Biomedical', 'Modelo': 'Pro-10', 'Costo Base COP': 4500000 }]
  );
  XLSX.utils.book_append_sheet(wb, wsCatalog, '1_Catalogo_Equipos');

  // 2. Sheet: Cotizaciones Guardadas
  const quoteRows = (params.quotes || []).map((q) => ({
    'N° Cotización': cleanStr(q.quoteNumber),
    'Fecha': cleanStr(q.date),
    'Cliente / Institución': cleanStr(q.clientName),
    'NIT': cleanStr(q.nit),
    'Persona de Contacto': cleanStr(q.contactPerson),
    'Email Contacto': cleanStr(q.contactEmail),
    'Teléfono Contacto': cleanStr(q.contactPhone),
    'Ciudad': cleanStr(q.city || 'Bogotá D.C.'),
    'Días de Validez': Number(q.validityDays) || 30,
    'Forma de Pago': cleanStr(q.paymentTerms || 'Contado'),
    'Tiempo de Entrega': cleanStr(q.deliveryTime || 'Inmediata'),
    'Lugar de Entrega': cleanStr(q.deliveryPlace || 'Instalaciones del cliente'),
    'Términos de Garantía': cleanStr(q.warrantyTerms || '24 meses'),
    'Capacitación': cleanStr(q.trainingTerms || 'Incluida'),
    'Asesor Comercial': cleanStr(q.advisorName || 'Asesor SYD'),
    'Cargo Asesor': cleanStr(q.advisorRole || 'Especialista de Producto'),
    'Email Asesor': cleanStr(q.advisorEmail),
    'Teléfono Asesor': cleanStr(q.advisorPhone),
    'Subtotal COP': Number(q.subtotal) || 0,
    'IVA COP': Number(q.iva) || 0,
    'Total COP': Number(q.total) || 0,
    'Total Equipos': Number(q.totalQuantity) || (q.items ? q.items.length : 0),
    'Estado': cleanStr(q.status || 'Enviada'),
    'Observaciones': cleanStr(q.notes),
  }));
  const wsQuotes = XLSX.utils.json_to_sheet(
    quoteRows.length > 0 ? quoteRows : [{ 'N° Cotización': 'COT-2026-001', 'Fecha': dateSlug, 'Cliente / Institución': 'Hospital General', 'Total COP': 15000000, 'Estado': 'Enviada' }]
  );
  XLSX.utils.book_append_sheet(wb, wsQuotes, '2_Cotizaciones_Guardadas');

  // 3. Sheet: Detalle de Ítems Cotizados
  const quoteItemRows: any[] = [];
  (params.quotes || []).forEach((q) => {
    (q.items || []).forEach((it, idx) => {
      quoteItemRows.push({
        'N° Cotización': cleanStr(q.quoteNumber),
        'Cliente': cleanStr(q.clientName),
        'Item #': idx + 1,
        'Código': cleanStr(it.code),
        'Nombre del Equipo': cleanStr(it.name),
        'Marca': cleanStr(it.brand),
        'Modelo': cleanStr(it.model),
        'Cantidad': Number(it.quantity) || 1,
        'Costo Unitario COP': Number(it.unitCostCOP) || 0,
        'Margen / Factor': cleanStr(it.marginType || 'L4'),
        'Multiplicador': Number(it.multiplier) || 1,
        'Precio Venta Unitario COP': Number(it.unitSalePrice) || 0,
        'Total Venta COP': Number(it.totalSalePrice) || 0,
        'Descuento %': Number(it.discountPercentage) || 0,
        'Garantía (Meses)': Number(it.warrantyMonths) || 24,
        'Accesorios / Notas': cleanStr(it.notes || (Array.isArray(it.accessories) ? it.accessories.map(a => a.name).join(', ') : '')),
      });
    });
  });
  const wsQuoteItems = XLSX.utils.json_to_sheet(
    quoteItemRows.length > 0 ? quoteItemRows : [{ 'N° Cotización': 'COT-2026-001', 'Item #': 1, 'Código': 'EQ-001', 'Nombre del Equipo': 'Monitor', 'Cantidad': 1, 'Precio Venta Unitario COP': 6500000 }]
  );
  XLSX.utils.book_append_sheet(wb, wsQuoteItems, '3_Detalle_Items_Cotizados');

  // 4. Sheet: Licitaciones y Proyectos
  const tenderRows = (params.tenderProjects || []).map((t, idx) => ({
    'ID Proyecto': t.id || `tender_${idx + 1}`,
    'Entidad / Cliente': cleanStr(t.clientName || t.header?.entityName),
    'NIT': cleanStr(t.nit || t.header?.nit),
    'N° Proceso': cleanStr(t.header?.processNumber),
    'Tipo de Proceso': cleanStr(t.header?.processType || 'Licitación Pública'),
    'Objeto del Contrato': cleanStr(t.header?.contractObject),
    'Fecha de Apertura': cleanStr(t.header?.openingDate),
    'Fecha de Cierre': cleanStr(t.header?.closingDate),
    'Ciudad': cleanStr(t.header?.city || 'Bogotá D.C.'),
    'Presupuesto Oficial COP': Number(t.header?.budgetCOP) || 0,
    'Persona de Contacto': cleanStr(t.header?.contactPerson),
    'Email de Contacto': cleanStr(t.header?.contactEmail),
    'Teléfono de Contacto': cleanStr(t.header?.contactPhone),
    'Plazo de Ejecución': cleanStr(t.header?.executionTerm || '30 días'),
    'Total Ítems': Number(t.items?.length) || 0,
    'Estado Licitación': cleanStr(t.status || 'En Preparación'),
    'Fecha Creación': cleanStr(t.createdAt),
  }));
  const wsTenders = XLSX.utils.json_to_sheet(
    tenderRows.length > 0 ? tenderRows : [{ 'ID Proyecto': 'LIC-01', 'Entidad / Cliente': 'ESE Hospital Departamental', 'N° Proceso': 'SAM-001-2026', 'Presupuesto Oficial COP': 50000000, 'Estado Licitación': 'En Preparación' }]
  );
  XLSX.utils.book_append_sheet(wb, wsTenders, '4_Licitaciones_Proyectos');

  // 5. Sheet: Ítems de Licitaciones
  const tenderItemRows: any[] = [];
  (params.tenderProjects || []).forEach((t) => {
    (t.items || []).forEach((it, idx) => {
      tenderItemRows.push({
        'ID Proyecto': cleanStr(t.id),
        'Entidad': cleanStr(t.clientName || t.header?.entityName),
        'N° Proceso': cleanStr(t.header?.processNumber),
        'Item #': it.itemNumber || (idx + 1),
        'Código': cleanStr(it.code),
        'Nombre del Equipo': cleanStr(it.name),
        'Marca': cleanStr(it.brand),
        'Modelo': cleanStr(it.model),
        'País de Origen': cleanStr(it.originCountry || 'Colombia'),
        'Cantidad': Number(it.quantity) || 1,
        'Presupuesto Estimado Unitario': Number(it.unitEstimatedBudget) || 0,
        'Precio Ofertado Unitario': Number(it.offeredUnitPrice) || 0,
        'Registro INVIMA': cleanStr(it.invimaRecord),
        'Garantía (Meses)': Number(it.warrantyMonths) || 24,
        'Tiempo de Entrega (Días)': Number(it.deliveryTimeDays) || 30,
        'Cumple Técnico': 'SÍ',
        'Observaciones': cleanStr(it.observations),
        'Requisitos Técnicos': Array.isArray(it.requirements)
          ? it.requirements.map(r => `[${r.complies !== false ? 'CUMPLE' : 'NO CUMPLE'}] ${r.requirement}${r.offeredSpec ? `: ${r.offeredSpec}` : ''}`).join(' | ')
          : '',
      });
    });
  });
  const wsTenderItems = XLSX.utils.json_to_sheet(
    tenderItemRows.length > 0 ? tenderItemRows : [{ 'ID Proyecto': 'LIC-01', 'Item #': 1, 'Nombre del Equipo': 'Bomba de Infusión', 'Cantidad': 2, 'Precio Ofertado Unitario': 3200000 }]
  );
  XLSX.utils.book_append_sheet(wb, wsTenderItems, '5_Items_Licitaciones');

  // 6. Sheet: Órdenes de Compra y OCs
  const ocRows = (params.ocContracts || []).map((oc, idx) => ({
    'ID Contrato': oc.id || `oc_${idx + 1}`,
    'N° Contrato / OC': cleanStr(oc.contractNumber || oc.ocNumber || `OC-${idx + 1}`),
    'Entidad / Cliente': cleanStr(oc.clientName),
    'NIT': cleanStr(oc.nit),
    'Ciudad': cleanStr(oc.city || 'Bogotá D.C.'),
    'Contacto': cleanStr(oc.contactPerson),
    'Presupuesto Total COP': Number(oc.totalBudgetCOP || oc.totalCostCOP) || 0,
    'Costo Total Compra COP': Number(oc.totalCostCOP) || 0,
    'Estado Global': cleanStr(oc.globalStatus || 'Borrador / Solicitud'),
    'Forma de Pago': cleanStr(oc.paymentTerms || 'Crédito 30 días'),
    'Estado de Pago': cleanStr(oc.paymentStatus || 'Pendiente'),
    'Proveedor Asignado': cleanStr(oc.supplier),
    'Total Ítems': Number(oc.items?.length) || 0,
    'Fecha Creación': cleanStr(oc.createdAt),
    'Notas': cleanStr(oc.notes),
  }));
  const wsOCs = XLSX.utils.json_to_sheet(
    ocRows.length > 0 ? ocRows : [{ 'ID Contrato': 'OC-01', 'N° Contrato / OC': 'OC-2026-001', 'Entidad / Cliente': 'Clínica del Norte', 'Costo Total Compra COP': 12000000, 'Estado Global': 'Orden de Compra Emitida' }]
  );
  XLSX.utils.book_append_sheet(wb, wsOCs, '6_Ordenes_Compra_OC');

  // 7. Sheet: Órdenes de Venta (OV)
  const salesOrderRows = (params.salesOrders || []).map((so, idx) => ({
    'ID Orden': so.id || `ov_${idx + 1}`,
    'N° Orden de Venta': cleanStr(so.salesOrderNumber),
    'Cliente / Institución': cleanStr(so.clientName),
    'NIT': cleanStr(so.clientNit),
    'Ciudad': cleanStr(so.clientCity || 'Bogotá D.C.'),
    'Persona de Contacto': cleanStr(so.clientContactPerson),
    'Email Contacto': cleanStr(so.clientContactEmail),
    'Teléfono Contacto': cleanStr(so.clientContactPhone),
    'N° Licitación / Contrato': cleanStr(so.contractNumber),
    'N° Cotización': cleanStr(so.quoteNumber),
    'N° Factura Emitida': cleanStr(so.invoiceNumber),
    'Fecha de Creación': cleanStr(so.createdAt),
    'Fecha Estimada Entrega': cleanStr(so.deliveryDate),
    'Estado Facturación': cleanStr(so.invoicedStatus),
    'Total Equipos': Number(so.items?.length) || 0,
    'Valor Total COP': Number(so.totalValueCOP) || 0,
    'Estado OV': cleanStr(so.status || 'Borrador'),
    'Observaciones': cleanStr(so.notes),
  }));
  const wsSalesOrders = XLSX.utils.json_to_sheet(
    salesOrderRows.length > 0 ? salesOrderRows : [{ 'N° Orden de Venta': 'OV-2026-001', 'Cliente / Institución': 'Clínica Las Américas', 'Valor Total COP': 25000000, 'Estado OV': 'En Proceso' }]
  );
  XLSX.utils.book_append_sheet(wb, wsSalesOrders, '7_Ordenes_de_Venta_OV');

  // 8. Sheet: Facturas Emitidas a Clientes
  const salesInvoiceRows = (params.salesInvoices || []).map((inv, idx) => ({
    'ID Factura': inv.id || `fac_${idx + 1}`,
    'N° Factura': cleanStr(inv.invoiceNumber),
    'N° Orden de Venta': cleanStr(inv.salesOrderNumber),
    'Cliente / Institución': cleanStr(inv.clientName),
    'NIT': cleanStr(inv.clientNit),
    'Fecha Emisión': cleanStr(inv.issueDate),
    'Fecha Vencimiento': cleanStr(inv.dueDate),
    'Subtotal COP': Number(inv.subtotalCOP) || 0,
    'IVA COP': Number(inv.taxAmountCOP) || 0,
    'Total Factura COP': Number(inv.totalAmountCOP) || 0,
    'Estado Pago Factura': cleanStr(inv.paymentStatus || 'Pendiente de Pago'),
    'Fecha Radicación': cleanStr(inv.filingDate),
    'Fecha Pago': cleanStr(inv.paymentDate),
    'Archivo Adjunto': cleanStr(inv.attachedInvoiceFile?.name),
    'Notas / Pagos': cleanStr(inv.notes),
  }));
  const wsSalesInvoices = XLSX.utils.json_to_sheet(
    salesInvoiceRows.length > 0 ? salesInvoiceRows : [{ 'N° Factura': 'FAC-001', 'N° Orden de Venta': 'OV-2026-001', 'Cliente / Institución': 'Clínica Las Américas', 'Total Factura COP': 25000000, 'Estado Pago Factura': 'Pendiente de Pago' }]
  );
  XLSX.utils.book_append_sheet(wb, wsSalesInvoices, '8_Facturas_Emitidas');

  // 9. Sheet: Directorio de Clientes
  const clientMap = new Map<string, any>();
  (params.quotes || []).forEach((q) => {
    if (q.clientName) {
      clientMap.set(q.clientName.toUpperCase().trim(), {
        'Nombre Institución / Cliente': cleanStr(q.clientName),
        'NIT': cleanStr(q.nit),
        'Ciudad': cleanStr(q.city || 'Bogotá D.C.'),
        'Persona de Contacto': cleanStr(q.contactPerson),
        'Email Contacto': cleanStr(q.contactEmail),
        'Teléfono Contacto': cleanStr(q.contactPhone),
        'Origen': 'Cotizaciones',
        'Notas': `Registrado en cotización ${q.quoteNumber}`,
      });
    }
  });
  (params.tenderProjects || []).forEach((t) => {
    const name = t.clientName || t.header?.entityName;
    if (name) {
      const key = name.toUpperCase().trim();
      const existing = clientMap.get(key);
      clientMap.set(key, {
        'Nombre Institución / Cliente': cleanStr(name),
        'NIT': cleanStr(t.nit || t.header?.nit || existing?.['NIT']),
        'Ciudad': cleanStr(t.header?.city || existing?.['Ciudad'] || 'Bogotá D.C.'),
        'Persona de Contacto': cleanStr(t.header?.contactPerson || existing?.['Persona de Contacto']),
        'Email Contacto': cleanStr(t.header?.contactEmail || existing?.['Email Contacto']),
        'Teléfono Contacto': cleanStr(t.header?.contactPhone || existing?.['Teléfono Contacto']),
        'Origen': existing ? 'Cotizaciones y Licitaciones' : 'Licitaciones',
        'Notas': `Licitación ${t.header?.processNumber || ''}`,
      });
    }
  });
  (params.salesOrders || []).forEach((so) => {
    if (so.clientName) {
      const key = so.clientName.toUpperCase().trim();
      const existing = clientMap.get(key);
      if (!existing) {
        clientMap.set(key, {
          'Nombre Institución / Cliente': cleanStr(so.clientName),
          'NIT': cleanStr(so.clientNit),
          'Ciudad': cleanStr(so.clientCity || 'Bogotá D.C.'),
          'Persona de Contacto': cleanStr(so.clientContactPerson),
          'Email Contacto': cleanStr(so.clientContactEmail),
          'Teléfono Contacto': cleanStr(so.clientContactPhone),
          'Origen': 'Órdenes de Venta',
          'Notas': `Registrado en OV ${so.salesOrderNumber}`,
        });
      }
    }
  });
  const clientRows = Array.from(clientMap.values());
  const wsClients = XLSX.utils.json_to_sheet(
    clientRows.length > 0 ? clientRows : [{ 'Nombre Institución / Cliente': 'Hospital Universitario', 'NIT': '900123456-1', 'Ciudad': 'Barranquilla', 'Origen': 'Directorio' }]
  );
  XLSX.utils.book_append_sheet(wb, wsClients, '9_Directorio_Clientes');

  // 10. Sheet: Directorio de Proveedores
  const supplierMap = new Map<string, any>();
  (params.equipments || []).forEach((eq) => {
    const suppliers = [eq.supplier, ...(eq.allSuppliers || []), ...(eq.alternateSuppliers || [])].filter(Boolean);
    suppliers.forEach((s) => {
      const clean = String(s).trim();
      if (clean && !supplierMap.has(clean.toUpperCase())) {
        supplierMap.set(clean.toUpperCase(), {
          'Nombre Proveedor / Fabricante': clean,
          'Marcas Distribuidas': cleanStr(eq.brand),
          'Origen de Registro': 'Catálogo de Equipos',
          'Notas': `Asociado al equipo ${eq.code || eq.name}`,
        });
      }
    });
  });
  const supplierRows = Array.from(supplierMap.values());
  const wsSuppliers = XLSX.utils.json_to_sheet(
    supplierRows.length > 0 ? supplierRows : [{ 'Nombre Proveedor / Fabricante': 'Mindray Colombia', 'Marcas Distribuidas': 'Mindray', 'Origen de Registro': 'Catálogo' }]
  );
  XLSX.utils.book_append_sheet(wb, wsSuppliers, '10_Directorio_Proveedores');

  // 11. Sheet: Usuarios del Sistema
  const userRows = (params.systemUsers || []).map((u) => ({
    'Usuario (Login)': cleanStr(u.username),
    'Nombre Completo': cleanStr(u.name),
    'Correo Electrónico': cleanStr(u.email),
    'Rol': u.role === 'admin' ? 'Administrador General' : 'Asesor / Consultor',
    'Cargo / Etiqueta': cleanStr(u.roleLabel),
    'Departamento': cleanStr(u.department || 'Ventas & Licitaciones'),
  }));
  const wsUsers = XLSX.utils.json_to_sheet(
    userRows.length > 0 ? userRows : [{ 'Usuario (Login)': 'admin', 'Nombre Completo': 'Administrador', 'Rol': 'Administrador General' }]
  );
  XLSX.utils.book_append_sheet(wb, wsUsers, '11_Usuarios_Sistema');

  // 12. Sheet: Metadatos y Resumen
  const metadataRows = [
    { 'Propiedad': 'Software', 'Valor': 'SYD Colombia - Software de Cotizaciones y Licitaciones' },
    { 'Propiedad': 'Versión del Sistema', 'Valor': CURRENT_APP_VERSION },
    { 'Propiedad': 'Fecha de Exportación', 'Valor': new Date().toLocaleString('es-CO') },
    { 'Propiedad': 'Generado Por', 'Valor': `${params.currentUser?.name || 'Administrador'} (${params.currentUser?.role || 'admin'})` },
    { 'Propiedad': 'Total Equipos en Catálogo', 'Valor': params.equipments.length },
    { 'Propiedad': 'Total Cotizaciones Guardadas', 'Valor': params.quotes.length },
    { 'Propiedad': 'Total Licitaciones y Proyectos', 'Valor': params.tenderProjects.length },
    { 'Propiedad': 'Total Órdenes de Compra', 'Valor': params.ocContracts.length },
    { 'Propiedad': 'Total Órdenes de Venta (OV)', 'Valor': (params.salesOrders || []).length },
    { 'Propiedad': 'Total Facturas Emitidas', 'Valor': (params.salesInvoices || []).length },
    { 'Propiedad': 'Total Documentos Técnicos', 'Valor': params.technicalDocuments.length },
    { 'Propiedad': 'Total Usuarios', 'Valor': params.systemUsers.length },
  ];
  const wsMeta = XLSX.utils.json_to_sheet(metadataRows);
  XLSX.utils.book_append_sheet(wb, wsMeta, '12_Metadatos_Sistema');

  // Write file as blob and download
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  try {
    localStorage.setItem('syd_last_manual_backup_date', new Date().toISOString());
    localStorage.setItem('syd_last_manual_backup_filename', fileName);
  } catch (e) {}
}

/**
 * Downloads a pre-formatted empty Excel template with sample rows ready for offline bulk editing
 */
export function downloadExcelDatabaseTemplate(): void {
  const fileName = `Plantilla_Base_de_Datos_SYD_Colombia.xlsx`;
  const wb = XLSX.utils.book_new();

  // 1. Template: Catálogo de Equipos
  const sampleCatalog = [
    {
      'Código': 'MON-001',
      'Nombre del Equipo': 'Monitor de Signos Vitales 6 Parámetros',
      'Marca': 'Mindray',
      'Modelo': 'uMEC12',
      'Grupo de Producto': 'Equipos Médicos',
      'Categoría': 'Monitoreo',
      'Proveedor Principal': 'Mindray Colombia',
      'Proveedores Alternos': 'Distribuidora Médica del Norte',
      'Costo Base COP': 5200000,
      'Costo USD': 1300,
      'Lista de Margen Sugerida': 'L4',
      'IVA Exento': 'NO',
      'Tarifa IVA %': 19,
      'Registro INVIMA': 'INVIMA 2021E-0012345',
      'Estado INVIMA': 'Vigente',
      'Vigencia INVIMA': '2028-12-31',
      'Garantía (Meses)': 24,
      'País de Origen': 'China',
      'Descripción Comercial': 'Monitor de signos vitales para paciente adulto, pediátrico y neonatal con pantalla táctil de 12 pulgadas.',
      'Especificaciones Técnicas': 'Pantalla táctil TFT 12.1" | ECG 3/5 derivadas | SpO2, PNI, Temp, Resp, PI | Batería 4 horas',
      'Accesorios Estándar': 'Sensor SpO2 adulto | Brazalete PNI adulto | Cable ECG 5 puntas | Sensor de temperatura | Cable AC',
    },
    {
      'Código': 'DES-002',
      'Nombre del Equipo': 'Desfibrilador Bifásico con Monitor y Marcapasos',
      'Marca': 'Zoll',
      'Modelo': 'R Series Plus',
      'Grupo de Producto': 'Equipos Médicos',
      'Categoría': 'Urgencias',
      'Proveedor Principal': 'Zoll Medical Colombia',
      'Proveedores Alternos': '',
      'Costo Base COP': 18500000,
      'Costo USD': 4600,
      'Lista de Margen Sugerida': 'L3',
      'IVA Exento': 'NO',
      'Tarifa IVA %': 19,
      'Registro INVIMA': 'INVIMA 2020E-0009876',
      'Estado INVIMA': 'Vigente',
      'Vigencia INVIMA': '2029-06-30',
      'Garantía (Meses)': 36,
      'País de Origen': 'Estados Unidos',
      'Descripción Comercial': 'Desfibrilador bifásico con tecnología Real CPR Help, marcapasos no invasivo y monitoreo ECG.',
      'Especificaciones Técnicas': 'Onda Rectilínea Bifásica (RBW) | Energía hasta 200J | Pantalla color alta resolución | Marcapasos a demanda',
      'Accesorios Estándar': 'Palas multifunción adulto/pediátrico | Cable ECG 3 puntas | Cable de terapia | Batería recargable',
    },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sampleCatalog), '1_Catalogo_Equipos');

  // 2. Template: Cotizaciones
  const sampleQuotes = [
    {
      'N° Cotización': 'COT-2026-001',
      'Fecha': new Date().toISOString().split('T')[0],
      'Cliente / Institución': 'Clínica Portoazul Auna',
      'NIT': '900.543.210-5',
      'Persona de Contacto': 'Ing. Carlos Mendoza (Jefe Biomédica)',
      'Email Contacto': 'biomedica@portoazul.com',
      'Teléfono Contacto': '3001234567',
      'Ciudad': 'Barranquilla',
      'Días de Validez': 30,
      'Forma de Pago': 'Crédito 30 días',
      'Tiempo de Entrega': '5 a 8 días hábiles',
      'Lugar de Entrega': 'Instalaciones Clínica Portoazul',
      'Términos de Garantía': '24 meses por defectos de fabricación',
      'Capacitación': 'Capacitación teórico-práctica con certificación',
      'Asesor Comercial': 'Asesor SYD Colombia',
      'Cargo Asesor': 'Especialista en Equipamiento Hospitalario',
      'Subtotal COP': 23700000,
      'IVA COP': 4503000,
      'Total COP': 28203000,
      'Estado': 'Enviada',
      'Observaciones': 'Precios sujetos a disponibilidad de inventario.',
    }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sampleQuotes), '2_Cotizaciones_Guardadas');

  // 3. Template: Directorio de Clientes
  const sampleClients = [
    {
      'Nombre Institución / Cliente': 'Hospital Universitario Cari E.S.E.',
      'NIT': '890.102.003-4',
      'Ciudad': 'Barranquilla',
      'Departamento': 'Atlántico',
      'Persona de Contacto': 'Dra. María Fernández',
      'Email Contacto': 'compras@hospitalcari.gov.co',
      'Teléfono Contacto': '(605) 3850000',
      'Origen': 'Directorio Institucional',
      'Notas': 'Entidad pública de alta complejidad',
    }
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sampleClients), '3_Directorio_Clientes');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Parses and validates an Excel workbook (.xlsx / .xls) into typed application state
 */
export function validateAndParseExcelDatabase(data: ArrayBuffer | Uint8Array): {
  isValid: boolean;
  error?: string;
  counts?: AppBackupMetadata['counts'];
  metadata?: AppBackupMetadata;
  extractedData?: AppBackupPayload['data'];
  detectedSheets?: string[];
} {
  try {
    const wb = XLSX.read(data, { type: 'array' });
    if (!wb || !wb.SheetNames || wb.SheetNames.length === 0) {
      return { isValid: false, error: 'El archivo Excel está vacío o no contiene hojas de datos válidas.' };
    }

    const detectedSheets: string[] = wb.SheetNames;
    let extractedEquipments: MedicalEquipment[] = [];
    let extractedQuotes: SavedQuote[] = [];
    let extractedTenders: TenderClientProject[] = [];
    let extractedOCs: OCTrackingContract[] = [];
    let extractedDocs: TechnicalDocument[] = [];
    let extractedUsers: StoredUserAccount[] = [];

    // Helper: case-insensitive column finder
    const getVal = (row: any, ...keys: string[]) => {
      if (!row) return '';
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') return row[k];
      }
      const lowerKeys = keys.map(k => k.toLowerCase().replace(/[^a-z0-9]/g, ''));
      for (const prop of Object.keys(row)) {
        const cleanProp = prop.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (lowerKeys.includes(cleanProp) && row[prop] !== undefined && row[prop] !== null) {
          return row[prop];
        }
      }
      return '';
    };

    // Iterate through all sheets
    wb.SheetNames.forEach((sheetName) => {
      const ws = wb.Sheets[sheetName];
      const jsonRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!jsonRows || jsonRows.length === 0) return;

      const normSheetName = sheetName.toLowerCase().replace(/[^a-z0-9]/g, '');

      // 1. Check if sheet is Catalog / Equipments
      const isCatalogSheet =
        normSheetName.includes('catalogo') ||
        normSheetName.includes('equipo') ||
        normSheetName.includes('product') ||
        normSheetName.includes('inventario') ||
        (jsonRows[0] && (getVal(jsonRows[0], 'Nombre del Equipo', 'equipo', 'nombre') && getVal(jsonRows[0], 'Costo Base COP', 'costo', 'precio')));

      if (isCatalogSheet) {
        jsonRows.forEach((row, idx) => {
          const name = String(getVal(row, 'Nombre del Equipo', 'nombre', 'equipo', 'descripcion', 'name')).trim();
          if (!name || name === 'Nombre del Equipo') return;

          const code = String(getVal(row, 'Código', 'codigo', 'code', 'referencia', 'ref') || `EQ-${(extractedEquipments.length + 1).toString().padStart(3, '0')}`).trim();
          const brand = String(getVal(row, 'Marca', 'marca', 'brand', 'fabricante') || 'SYD Biomedical').trim();
          const model = String(getVal(row, 'Modelo', 'modelo', 'model') || 'Estándar').trim();
          const rawCost = Number(String(getVal(row, 'Costo Base COP', 'costoBaseCOP', 'costo', 'costoCOP', 'valorCompra') || 0).replace(/[^0-9.-]+/g, ''));
          const baseCostCOP = isNaN(rawCost) ? 0 : Math.round(rawCost);
          const rawUSD = Number(String(getVal(row, 'Costo USD', 'costoUSD', 'usd') || 0).replace(/[^0-9.-]+/g, ''));

          const supplier = String(getVal(row, 'Proveedor Principal', 'proveedor', 'supplier', 'distribuidor') || '').trim();
          const altSuppliersStr = String(getVal(row, 'Proveedores Alternos', 'proveedoresAlternos', 'allSuppliers') || '');
          const allSuppliers = altSuppliersStr ? altSuppliersStr.split(/[,|;]/).map(s => s.trim()).filter(Boolean) : (supplier ? [supplier] : []);

          const techSpecsStr = String(getVal(row, 'Especificaciones Técnicas', 'especificaciones', 'technicalSpecs', 'specs') || '');
          const technicalSpecs = techSpecsStr ? techSpecsStr.split(/[\r\n|;]/).map(s => s.trim()).filter(Boolean) : [];

          const accStr = String(getVal(row, 'Accesorios Estándar', 'accesorios', 'standardAccessories') || '');
          const standardAccessories = accStr ? accStr.split(/[\r\n|;]/).map(s => {
            const cleanAcc = s.trim();
            const costMatch = cleanAcc.match(/\(\$?([0-9,.]+)\)/);
            const cost = costMatch ? Number(costMatch[1].replace(/[^0-9]/g, '')) : 0;
            const cleanAccName = cleanAcc.replace(/\(\$?([0-9,.]+)\)/, '').trim();
            return { name: cleanAccName || 'Accesorio', costCOP: cost, included: true };
          }).filter(a => a.name) : [];

          extractedEquipments.push({
            id: `eq_${code.replace(/[^a-zA-Z0-9_-]/g, '_')}_${extractedEquipments.length + 1}`,
            code,
            name,
            brand,
            model,
            category: (getVal(row, 'Categoría', 'categoria', 'category') || 'Diagnóstico') as any,
            productGroup: (getVal(row, 'Grupo de Producto', 'grupoProducto', 'productGroup') || 'Equipos Médicos') as any,
            supplier,
            allSuppliers,
            baseCostCOP,
            baseCostUSD: rawUSD > 0 ? rawUSD : undefined,
            defaultMarginList: (getVal(row, 'Lista de Margen Sugerida', 'margen', 'defaultMarginList') || 'L4') as any,
            taxExempt: String(getVal(row, 'IVA Exento', 'exento')).toUpperCase().includes('S') || String(getVal(row, 'IVA Exento', 'exento')).toUpperCase() === 'SI',
            taxRate: Number(getVal(row, 'Tarifa IVA %', 'taxRate')) || 19,
            invimaRecordNumber: String(getVal(row, 'Registro INVIMA', 'registroInvima', 'invima') || 'En Trámite'),
            invimaStatus: (getVal(row, 'Estado INVIMA', 'invimaStatus') || 'Vigente') as any,
            invimaExpiryDate: String(getVal(row, 'Vigencia INVIMA', 'invimaExpiryDate') || ''),
            warrantyMonths: Number(getVal(row, 'Garantía (Meses)', 'garantia', 'warrantyMonths')) || 24,
            originCountry: String(getVal(row, 'País de Origen', 'paisOrigen', 'originCountry') || 'Colombia'),
            description: String(getVal(row, 'Descripción Comercial', 'descripcion', 'description') || `${name} marca ${brand}`),
            technicalSpecs,
            standardAccessories,
            hasDocSheet: false,
            hasInvimaDoc: false,
            hasManual: false,
            hasQualityCert: false,
          });
        });
      }

      // 2. Check if sheet is Saved Quotes
      const isQuoteSheet =
        normSheetName.includes('cotizacion') ||
        normSheetName.includes('quote') ||
        (jsonRows[0] && getVal(jsonRows[0], 'N° Cotización', 'numeroCotizacion', 'quoteNumber'));

      if (isQuoteSheet) {
        jsonRows.forEach((row, idx) => {
          const quoteNumber = String(getVal(row, 'N° Cotización', 'numeroCotizacion', 'quoteNumber', 'numero') || `COT-${Date.now()}-${idx + 1}`).trim();
          const clientName = String(getVal(row, 'Cliente / Institución', 'cliente', 'clientName') || 'Cliente General').trim();
          const date = String(getVal(row, 'Fecha', 'date', 'fecha') || new Date().toISOString().split('T')[0]).trim();
          const subtotal = Number(String(getVal(row, 'Subtotal COP', 'subtotal') || 0).replace(/[^0-9.-]+/g, ''));
          const iva = Number(String(getVal(row, 'IVA COP', 'iva', 'taxAmount') || 0).replace(/[^0-9.-]+/g, ''));
          const total = Number(String(getVal(row, 'Total COP', 'total') || (subtotal + iva)).replace(/[^0-9.-]+/g, ''));

          extractedQuotes.push({
            id: `quote_${quoteNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
            quoteNumber,
            date,
            dateCode: date.replace(/-/g, ''),
            clientName,
            nit: String(getVal(row, 'NIT', 'nit', 'documento') || ''),
            contactPerson: String(getVal(row, 'Persona de Contacto', 'contacto', 'contactPerson') || ''),
            contactEmail: String(getVal(row, 'Email Contacto', 'email', 'correo', 'contactEmail') || ''),
            contactPhone: String(getVal(row, 'Teléfono Contacto', 'telefono', 'phone', 'contactPhone') || ''),
            city: String(getVal(row, 'Ciudad', 'ciudad', 'city') || 'Bogotá D.C.'),
            validityDays: Number(getVal(row, 'Días de Validez', 'validez', 'validityDays')) || 30,
            paymentTerms: String(getVal(row, 'Forma de Pago', 'formaPago', 'paymentTerms') || 'Contado'),
            deliveryTime: String(getVal(row, 'Tiempo de Entrega', 'tiempoEntrega', 'deliveryTime') || 'Inmediata'),
            deliveryPlace: String(getVal(row, 'Lugar de Entrega', 'lugarEntrega', 'deliveryPlace') || 'Instalaciones del cliente'),
            warrantyTerms: String(getVal(row, 'Términos de Garantía', 'garantia', 'warrantyTerms') || '24 meses'),
            trainingTerms: String(getVal(row, 'Capacitación', 'capacitacion', 'trainingTerms') || 'Incluida'),
            advisorName: String(getVal(row, 'Asesor Comercial', 'asesor', 'advisorName') || 'Asesor Comercial'),
            advisorRole: String(getVal(row, 'Cargo Asesor', 'cargo', 'advisorRole') || 'Especialista de Producto'),
            advisorEmail: String(getVal(row, 'Email Asesor', 'emailAsesor', 'advisorEmail') || ''),
            advisorPhone: String(getVal(row, 'Teléfono Asesor', 'telefonoAsesor', 'advisorPhone') || ''),
            notes: String(getVal(row, 'Observaciones', 'notas', 'notes') || ''),
            subtotal,
            iva,
            total,
            totalQuantity: Number(getVal(row, 'Total Equipos', 'cantidadTotal')) || 1,
            status: (getVal(row, 'Estado', 'status') || 'Enviada') as any,
            items: [],
            taxRate: 19,
            savedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        });
      }

      // 3. Check if sheet is Tenders / Licitaciones
      const isTenderSheet =
        normSheetName.includes('licitacion') ||
        normSheetName.includes('tender') ||
        normSheetName.includes('proyecto') ||
        (jsonRows[0] && getVal(jsonRows[0], 'N° Proceso', 'numeroProceso', 'ID Proyecto'));

      if (isTenderSheet) {
        jsonRows.forEach((row, idx) => {
          const clientName = String(getVal(row, 'Entidad / Cliente', 'entidad', 'cliente', 'clientName') || 'Entidad Pública').trim();
          const processNumber = String(getVal(row, 'N° Proceso', 'numeroProceso', 'processNumber') || `LIC-${idx + 1}`).trim();
          const budgetCOP = Number(String(getVal(row, 'Presupuesto Oficial COP', 'presupuesto', 'budgetCOP') || 0).replace(/[^0-9.-]+/g, ''));

          extractedTenders.push({
            id: String(getVal(row, 'ID Proyecto', 'id') || `tender_${processNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}_${idx + 1}`),
            clientName,
            nit: String(getVal(row, 'NIT', 'nit') || ''),
            header: {
              entityName: clientName,
              clientName,
              nit: String(getVal(row, 'NIT', 'nit') || ''),
              processNumber,
              processType: String(getVal(row, 'Tipo de Proceso', 'tipoProceso', 'processType') || 'Licitación Pública'),
              contractObject: String(getVal(row, 'Objeto del Contrato', 'objeto', 'contractObject') || `Proceso ${processNumber}`),
              openingDate: String(getVal(row, 'Fecha de Apertura', 'fechaApertura', 'openingDate') || new Date().toISOString().split('T')[0]),
              closingDate: String(getVal(row, 'Fecha de Cierre', 'fechaCierre', 'closingDate') || ''),
              city: String(getVal(row, 'Ciudad', 'ciudad', 'city') || 'Bogotá D.C.'),
              budgetCOP,
              contactPerson: String(getVal(row, 'Persona de Contacto', 'contacto', 'contactPerson') || ''),
              contactEmail: String(getVal(row, 'Email de Contacto', 'email', 'contactEmail') || ''),
              contactPhone: String(getVal(row, 'Teléfono de Contacto', 'telefono', 'contactPhone') || ''),
              executionTerm: String(getVal(row, 'Plazo de Ejecución', 'plazo', 'executionTerm') || '30 días'),
            },
            items: [],
            status: (getVal(row, 'Estado Licitación', 'estado', 'status') || 'En Preparación') as any,
            createdAt: String(getVal(row, 'Fecha Creación', 'createdAt') || new Date().toISOString()),
            updatedAt: new Date().toISOString(),
          });
        });
      }

      // 4. Check if sheet is OCs / Ordenes de Compra
      const isOCSheet =
        normSheetName.includes('orden') ||
        normSheetName.includes('seguimiento') ||
        normSheetName.includes('oc') ||
        (jsonRows[0] && getVal(jsonRows[0], 'N° Contrato / OC', 'numeroContrato', 'contractNumber'));

      if (isOCSheet) {
        jsonRows.forEach((row, idx) => {
          const contractNumber = String(getVal(row, 'N° Contrato / OC', 'numeroContrato', 'contractNumber', 'ocNumber') || `OC-${idx + 1}`).trim();
          const clientName = String(getVal(row, 'Entidad / Cliente', 'cliente', 'clientName') || 'Cliente').trim();
          const totalCostCOP = Number(String(getVal(row, 'Costo Total Compra COP', 'costoTotal', 'totalCostCOP') || 0).replace(/[^0-9.-]+/g, ''));
          const totalBudgetCOP = Number(String(getVal(row, 'Presupuesto Total COP', 'presupuesto', 'totalBudgetCOP') || totalCostCOP).replace(/[^0-9.-]+/g, ''));

          extractedOCs.push({
            id: String(getVal(row, 'ID Contrato', 'id') || `oc_${contractNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}_${idx + 1}`),
            sourceType: (getVal(row, 'Tipo Origen', 'sourceType') || 'manual') as any,
            contractNumber,
            ocNumber: contractNumber,
            clientName,
            nit: String(getVal(row, 'NIT', 'nit') || ''),
            city: String(getVal(row, 'Ciudad', 'ciudad') || 'Bogotá D.C.'),
            contactPerson: String(getVal(row, 'Contacto', 'contactPerson') || ''),
            totalBudgetCOP,
            totalCostCOP,
            globalStatus: String(getVal(row, 'Estado Global', 'estado', 'globalStatus') || 'Borrador / Solicitud'),
            paymentTerms: String(getVal(row, 'Forma de Pago', 'formaPago', 'paymentTerms') || 'Crédito 30 días'),
            paymentStatus: String(getVal(row, 'Estado de Pago', 'estadoPago', 'paymentStatus') || 'Pendiente'),
            supplier: String(getVal(row, 'Proveedor Asignado', 'proveedor', 'supplier') || ''),
            items: [],
            createdAt: String(getVal(row, 'Fecha Creación', 'createdAt') || new Date().toISOString()),
            lastUpdatedAt: new Date().toISOString(),
            notes: String(getVal(row, 'Notas', 'observaciones', 'notes') || ''),
          });
        });
      }
    });

    const counts = {
      equipments: extractedEquipments.length,
      quotes: extractedQuotes.length,
      tenderProjects: extractedTenders.length,
      ocContracts: extractedOCs.length,
      technicalDocuments: extractedDocs.length,
      systemUsers: extractedUsers.length,
    };

    const totalFound = counts.equipments + counts.quotes + counts.tenderProjects + counts.ocContracts + counts.technicalDocuments + counts.systemUsers;

    if (totalFound === 0) {
      return {
        isValid: false,
        error: 'No se encontraron columnas reconocibles de Catálogo, Cotizaciones o Licitaciones en el archivo Excel. Verifique que las columnas tengan títulos como Código, Nombre del Equipo, Costo, etc.',
      };
    }

    return {
      isValid: true,
      counts,
      detectedSheets,
      metadata: {
        appName: 'SYD Colombia - Importación Excel',
        version: CURRENT_APP_VERSION,
        exportTimestamp: new Date().toISOString(),
        exportDateFormatted: new Date().toLocaleDateString('es-CO'),
        exportedBy: { name: 'Archivo Excel (.xlsx)' },
        counts,
      },
      extractedData: {
        equipments: extractedEquipments,
        quotes: extractedQuotes,
        tenderProjects: extractedTenders,
        ocContracts: extractedOCs,
        technicalDocuments: extractedDocs,
        systemUsers: extractedUsers,
      },
    };
  } catch (err: any) {
    console.error('Error parsing Excel database:', err);
    return {
      isValid: false,
      error: `Error al leer el archivo Excel: ${err?.message || 'Archivo dañado o formato incompatible'}`,
    };
  }
}

/**
 * Universal validator that accepts both Excel (.xlsx, .xls) and JSON files transparently
 */
export async function validateAnyBackupFile(file: File): Promise<{
  isValid: boolean;
  error?: string;
  fileType: 'excel' | 'json';
  counts?: AppBackupMetadata['counts'];
  metadata?: AppBackupMetadata;
  extractedData?: AppBackupPayload['data'];
  detectedSheets?: string[];
}> {
  const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.type.includes('spreadsheet') || file.type.includes('excel');

  if (isExcel) {
    const buffer = await file.arrayBuffer();
    const result = validateAndParseExcelDatabase(buffer);
    return {
      ...result,
      fileType: 'excel',
    };
  } else {
    // JSON file
    const text = await file.text();
    try {
      const parsed = JSON.parse(text);
      const result = validateBackupJson(parsed);
      return {
        ...result,
        fileType: 'json',
      };
    } catch (e: any) {
      return {
        isValid: false,
        error: 'El archivo no contiene una estructura JSON válida.',
        fileType: 'json',
      };
    }
  }
}

/**
 * Normalizes an individual raw equipment object from any JSON source
 */
export function normalizeEquipmentFromJson(raw: any, index: number): MedicalEquipment {
  const code = String(
    raw.code || raw.codigo || raw.parte || raw.partNumber || raw.ref || raw.referencia || `EQ-${(index + 1).toString().padStart(3, '0')}`
  ).trim();
  const name = String(
    raw.name || raw.nombre || raw.nombreEquipo || raw.equipo || raw.descripcion || `Equipo Biomédico ${index + 1}`
  ).trim();
  const brand = String(raw.brand || raw.marca || raw.fabricante || 'SYD Biomedical').trim();
  const model = String(raw.model || raw.modelo || raw.referenciaModelo || 'Estándar').trim();
  const supplier = String(raw.supplier || raw.proveedor || raw.distribuidor || '').trim();

  // Clean ID
  const id = String(
    raw.id || raw._id || (code ? `eq_${code.replace(/[^a-zA-Z0-9_-]/g, '_')}` : `eq_${Date.now()}_${index}`)
  );

  // Cost
  const rawCost = Number(
    String(raw.baseCostCOP ?? raw.costoBaseCOP ?? raw.costo ?? raw.costoCOP ?? raw.valorCompra ?? 0).replace(/[^0-9.-]+/g, '')
  );
  const baseCostCOP = isNaN(rawCost) || rawCost < 0 ? 0 : Math.round(rawCost);

  // Category
  let category: MedicalEquipment['category'] = (raw.category || raw.categoria) as any;
  const validCategories = ['Monitoreo', 'Cirugía', 'Diagnóstico', 'Quirófano', 'Cuidados Críticos', 'Urgencias', 'Ginecología'];
  if (!validCategories.includes(category)) {
    const catLower = String(raw.category || raw.categoria || name).toLowerCase();
    if (catLower.includes('monit')) category = 'Monitoreo';
    else if (catLower.includes('cirug')) category = 'Cirugía';
    else if (catLower.includes('crit') || catLower.includes('uci') || catLower.includes('ventila')) category = 'Cuidados Críticos';
    else if (catLower.includes('quirof') || catLower.includes('quirurg')) category = 'Quirófano';
    else if (catLower.includes('urgenc') || catLower.includes('emergenc')) category = 'Urgencias';
    else if (catLower.includes('ginec') || catLower.includes('materno') || catLower.includes('obstet')) category = 'Ginecología';
    else category = 'Diagnóstico';
  }

  // Product Group
  let productGroup = raw.productGroup || raw.tipoProducto || raw.grupoProducto;
  if (!productGroup) {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('pinza') || nameLower.includes('tijera') || nameLower.includes('instrumental') || nameLower.includes('caja de')) {
      productGroup = 'Instrumental Quirúrgico';
    } else if (nameLower.includes('cama') || nameLower.includes('camilla') || nameLower.includes('carro de paro') || nameLower.includes('mesa') || nameLower.includes('atril')) {
      productGroup = 'Muebles Hospitalarios';
    } else {
      productGroup = 'Equipos Médicos';
    }
  }

  // Suppliers list
  const allSuppliers = Array.isArray(raw.allSuppliers)
    ? raw.allSuppliers
    : supplier
    ? [supplier]
    : [];

  // Accessories
  const standardAccessories = Array.isArray(raw.standardAccessories)
    ? raw.standardAccessories.map((a: any) =>
        typeof a === 'string' ? { name: a, costCOP: 0, included: true } : { name: a.name || 'Accesorio', costCOP: Number(a.costCOP) || 0, included: a.included !== false }
      )
    : Array.isArray(raw.accesorios)
    ? raw.accesorios.map((a: any) =>
        typeof a === 'string' ? { name: a, costCOP: 0, included: true } : { name: a.name || a.nombre || 'Accesorio', costCOP: Number(a.costCOP || a.costo) || 0, included: true }
      )
    : [];

  // Technical Specs
  const technicalSpecs: string[] = Array.isArray(raw.technicalSpecs)
    ? raw.technicalSpecs.map(String)
    : Array.isArray(raw.especificaciones)
    ? raw.especificaciones.map(String)
    : typeof raw.specs === 'string'
    ? raw.specs.split(/\r?\n|;/).map((s: string) => s.trim()).filter(Boolean)
    : [];

  return {
    id,
    code,
    name,
    brand,
    model,
    category,
    productGroup,
    supplier,
    allSuppliers,
    alternateSuppliers: raw.alternateSuppliers || [],
    supplierPrices: raw.supplierPrices || (supplier && baseCostCOP > 0 ? [{ supplier, costCOP: baseCostCOP, date: new Date().toISOString().split('T')[0] }] : []),
    baseCostCOP,
    taxExempt: !!(raw.taxExempt || raw.exento || raw.ivaExento),
    taxRate: raw.taxRate !== undefined ? Number(raw.taxRate) : (raw.taxExempt ? 0 : 19),
    defaultMarginList: raw.defaultMarginList || raw.margen || 'L4',
    invimaRecordNumber: String(raw.invimaRecordNumber || raw.registroInvima || raw.invima || 'En Trámite'),
    invimaStatus: raw.invimaStatus || 'Vigente',
    warrantyMonths: Number(raw.warrantyMonths || raw.garantia || 24),
    originCountry: String(raw.originCountry || raw.paisOrigen || 'Colombia'),
    description: String(raw.description || raw.descripcion || `${name} marca ${brand} modelo ${model}`),
    technicalSpecs,
    standardAccessories,
    hasDocSheet: !!raw.hasDocSheet,
    hasInvimaDoc: !!raw.hasInvimaDoc,
    hasManual: !!raw.hasManual,
    hasQualityCert: !!raw.hasQualityCert,
  };
}

/**
 * Normalizes a single quote object from backup JSON
 */
export function normalizeQuoteFromJson(raw: any, index: number): SavedQuote {
  const quoteNumber = String(
    raw.quoteNumber || raw.numeroCotizacion || raw.numero || `COT-${Date.now()}-${index + 1}`
  ).trim();
  const id = String(raw.id || raw._id || `quote_${quoteNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}`);
  const clientName = String(
    raw.clientName || raw.cliente || raw.nombreCliente || raw.client || 'Cliente General'
  ).trim();
  const date = String(raw.date || raw.fecha || new Date().toISOString().split('T')[0]);

  const rawItems = Array.isArray(raw.items) ? raw.items : Array.isArray(raw.productos) ? raw.productos : [];
  const items: QuoteItem[] = rawItems.map((it: any, itIdx: number) => {
    const itName = String(it.name || it.nombre || it.description || it.descripcion || `Ítem ${itIdx + 1}`).trim();
    const itCode = String(it.code || it.codigo || it.ref || `ITM-${itIdx + 1}`).trim();
    const quantity = Math.max(1, Number(it.quantity || it.cantidad || 1));
    const unitPrice = Number(it.unitPrice || it.valorUnitario || it.precioUnitario || it.unitPriceCOP || 0);
    const unitCostCOP = Number(it.unitCostCOP || it.costoUnitario || it.baseCostCOP || 0);
    const totalSalePrice = Number(it.totalSalePrice || it.total || unitPrice * quantity);
    const totalCostCOP = Number(it.totalCostCOP || unitCostCOP * quantity);

    return {
      id: String(it.id || `item_${quoteNumber}_${itIdx}`),
      equipmentId: it.equipmentId || `eq_${itCode}`,
      code: itCode,
      name: itName,
      brand: String(it.brand || it.marca || 'SYD'),
      model: String(it.model || it.modelo || 'Estándar'),
      quantity,
      unitCostCOP,
      unitPrice,
      totalCostCOP,
      totalSalePrice,
      marginPercentage: Number(it.marginPercentage || it.margen || 30),
      marginList: it.marginList || 'L4',
      selectedMarginList: it.selectedMarginList || it.marginList || 'L4',
      taxRate: it.taxRate !== undefined ? Number(it.taxRate) : 19,
      taxAmount: Number(it.taxAmount || 0),
      subtotal: Number(it.subtotal || unitPrice * quantity),
      total: Number(it.total || totalSalePrice),
      isTaxExempt: !!it.isTaxExempt,
      includedAccessories: Array.isArray(it.includedAccessories) ? it.includedAccessories : [],
      technicalSpecs: Array.isArray(it.technicalSpecs) ? it.technicalSpecs : [],
      description: String(it.description || it.descripcion || itName),
      warrantyMonths: Number(it.warrantyMonths || 24),
    };
  });

  const subtotal = Number(raw.subtotal || items.reduce((acc, it) => acc + (it.totalSalePrice || 0), 0));
  const iva = Number(raw.iva || raw.taxAmount || Math.round(subtotal * 0.19));
  const total = Number(raw.total || (subtotal + iva));
  const totalQuantity = Number(raw.totalQuantity || items.reduce((acc, it) => acc + (it.quantity || 1), 0));

  let status: QuoteStatus = 'Enviada';
  if (['Borrador', 'Enviada', 'Aprobada', 'Rechazada', 'Facturada'].includes(raw.status)) {
    status = raw.status;
  } else if (raw.status === 'Emitida') {
    status = 'Enviada';
  } else if (raw.status === 'Aceptada') {
    status = 'Aprobada';
  }

  return {
    id,
    quoteNumber,
    date,
    dateCode: String(raw.dateCode || date.replace(/-/g, '')),
    clientName,
    nit: String(raw.nit || raw.documento || ''),
    contactPerson: String(raw.contactPerson || raw.contacto || ''),
    contactEmail: String(raw.contactEmail || raw.email || raw.correo || ''),
    contactPhone: String(raw.contactPhone || raw.phone || raw.telefono || ''),
    city: String(raw.city || raw.ciudad || 'Bogotá D.C.'),
    validityDays: Number(raw.validityDays || raw.diasValidez || 30),
    paymentTerms: String(raw.paymentTerms || raw.formaPago || 'Contado'),
    deliveryTime: String(raw.deliveryTime || raw.tiempoEntrega || 'Inmediata'),
    deliveryPlace: String(raw.deliveryPlace || raw.lugarEntrega || 'Instalaciones del cliente'),
    warrantyTerms: String(raw.warrantyTerms || raw.garantia || '24 meses'),
    trainingTerms: String(raw.trainingTerms || raw.capacitacion || 'Incluida con personal certificado'),
    maintenanceTerms: raw.maintenanceTerms || 'Preventivo según manual de fabricante',
    taxRate: raw.taxRate !== undefined ? Number(raw.taxRate) : 19,
    advisorName: String(raw.advisorName || raw.sellerName || raw.vendedor || 'Asesor Comercial'),
    advisorRole: String(raw.advisorRole || raw.sellerRole || raw.cargoVendedor || 'Especialista de Producto'),
    advisorPhone: String(raw.advisorPhone || raw.sellerPhone || ''),
    advisorEmail: String(raw.advisorEmail || raw.sellerEmail || ''),
    notes: String(raw.notes || raw.generalNotes || raw.observaciones || ''),
    items,
    subtotal,
    iva,
    total,
    totalQuantity,
    status,
    savedAt: String(raw.savedAt || raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || raw.savedAt || new Date().toISOString()),
    letterheadUrl: raw.letterheadUrl || null,
    marginSettings: raw.marginSettings || undefined,
  };
}

/**
 * Normalizes tender client project from JSON
 */
export function normalizeTenderFromJson(raw: any, index: number): TenderClientProject {
  const id = String(raw.id || raw._id || `tender_${Date.now()}_${index}`);
  const clientName = String(raw.clientName || raw.cliente || raw.header?.entityName || 'Entidad Pública').trim();
  const nit = String(raw.nit || raw.header?.nit || '');
  const projectName = String(
    raw.projectName || raw.header?.contractObject || raw.proyecto || raw.nombre || `Licitación ${index + 1}`
  ).trim();

  const header = raw.header || {
    entityName: clientName,
    clientName,
    nit,
    processNumber: String(raw.processNumber || raw.numeroProceso || `LIC-${index + 1}`),
    processType: String(raw.processType || raw.tipoProceso || 'Selección Abreviada'),
    contractObject: projectName,
    openingDate: String(raw.openingDate || raw.fechaApertura || new Date().toISOString().split('T')[0]),
    closingDate: String(raw.closingDate || raw.fechaCierre || ''),
    city: String(raw.city || raw.ciudad || 'Bogotá D.C.'),
    budgetCOP: Number(raw.budgetCOP || raw.totalAmount || raw.monto || 0),
    contactPerson: raw.contactPerson || '',
    contactEmail: raw.contactEmail || '',
    contactPhone: raw.contactPhone || '',
    executionTerm: raw.executionTerm || '30 días',
  };

  let status: TenderClientProject['status'] = 'En Preparación';
  if (['En Preparación', 'Presentada', 'Adjudicada', 'Desierta', 'Cerrada'].includes(raw.status)) {
    status = raw.status;
  }

  return {
    id,
    clientName,
    nit,
    header,
    items: Array.isArray(raw.items) ? raw.items : [],
    status,
    createdAt: String(raw.createdAt || raw.createdDate || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || raw.createdAt || new Date().toISOString()),
  };
}

/**
 * Normalizes OC Tracking contract from JSON
 */
export function normalizeOCFromJson(raw: any, index: number): OCTrackingContract {
  const id = String(raw.id || raw._id || `oc_${Date.now()}_${index}`);
  const contractNumber = String(
    raw.contractNumber || raw.numeroContrato || raw.numeroOC || `OC-${index + 1}`
  ).trim();
  const clientName = String(raw.clientName || raw.cliente || 'Cliente OC').trim();
  const totalCostCOP = Number(raw.totalCostCOP || raw.totalContractValueCOP || raw.valorTotalCOP || 0);

  return {
    id,
    tenderClientId: raw.tenderClientId || undefined,
    quoteId: raw.quoteId || undefined,
    sourceType: (raw.sourceType || 'manual') as any,
    contractNumber,
    ocNumber: raw.ocNumber || contractNumber,
    supplier: raw.supplier || '',
    clientName,
    nit: String(raw.nit || ''),
    city: String(raw.city || 'Bogotá D.C.'),
    contactPerson: raw.contactPerson || '',
    totalBudgetCOP: raw.totalBudgetCOP || totalCostCOP,
    totalCostCOP,
    items: Array.isArray(raw.items) ? raw.items : [],
    purchaseOrders: Array.isArray(raw.purchaseOrders) ? raw.purchaseOrders : undefined,
    globalStatus: raw.globalStatus || raw.status || 'Borrador / Solicitud',
    paymentTerms: raw.paymentTerms || 'Crédito 30 días',
    paymentStatus: raw.paymentStatus || 'Pendiente',
    createdAt: String(raw.createdAt || raw.createdDate || new Date().toISOString()),
    lastUpdatedAt: String(raw.lastUpdatedAt || new Date().toISOString()),
    notes: String(raw.notes || ''),
  };
}

/**
 * Normalizes technical document from JSON
 */
export function normalizeDocFromJson(raw: any, index: number): TechnicalDocument {
  const id = String(raw.id || raw._id || `doc_${Date.now()}_${index}`);
  const equipmentName = String(raw.equipmentName || raw.nombreEquipo || raw.title || 'Documento Técnico').trim();
  const fileName = String(raw.fileName || raw.nombreArchivo || 'documento.pdf');
  const fileSize = typeof raw.fileSize === 'string' ? raw.fileSize : raw.fileSize ? `${raw.fileSize} KB` : '0 KB';

  return {
    id,
    equipmentId: raw.equipmentId || undefined,
    equipmentName,
    equipmentCode: raw.equipmentCode || undefined,
    docType: raw.docType || raw.tipoDocumento || 'Ficha Técnica',
    title: String(raw.title || raw.titulo || equipmentName),
    fileName,
    fileSize,
    fileData: raw.fileData || raw.fileUrl || undefined,
    fileType: raw.fileType || 'application/pdf',
    uploadDate: String(raw.uploadDate || raw.fechaSubida || new Date().toISOString().split('T')[0]),
    status: (raw.status || 'Vigente') as any,
    invimaNumber: raw.invimaNumber || raw.registroInvima || undefined,
    validUntil: raw.validUntil || undefined,
    notes: raw.notes || '',
    uploadedBy: raw.uploadedBy || 'Sistema',
  };
}

/**
 * Normalizes system user from JSON
 */
export function normalizeUserFromJson(raw: any, index: number): StoredUserAccount {
  const id = String(raw.id || raw._id || `usr_${Date.now()}_${index}`);
  const username = String(raw.username || raw.usuario || `user_${index + 1}`).trim().toLowerCase();
  const role = (raw.role === 'admin' ? 'admin' : 'viewer') as 'admin' | 'viewer';
  const roleLabel = raw.roleLabel || (role === 'admin' ? 'Administrador General' : 'Asesor Comercial / Consultor');

  return {
    id,
    username,
    password: String(raw.password || '123456'),
    name: String(raw.name || raw.nombre || 'Usuario').trim(),
    email: String(raw.email || raw.correo || ''),
    role,
    roleLabel,
    department: String(raw.department || 'Ventas & Licitaciones'),
    avatarColor: String(raw.avatarColor || 'bg-blue-600'),
    permissions: raw.permissions || undefined,
  };
}

/**
 * Validates whether an imported JSON file matches the expected backup structure
 * Accepts ALL formats: full backup bundles, arrays, or single-category exports without dropping anything.
 */
export function validateBackupJson(parsed: any): {
  isValid: boolean;
  error?: string;
  counts?: AppBackupMetadata['counts'];
  metadata?: AppBackupMetadata;
  extractedData?: AppBackupPayload['data'];
} {
  if (!parsed || (typeof parsed !== 'object' && !Array.isArray(parsed))) {
    return { isValid: false, error: 'El archivo no contiene un formato JSON válido.' };
  }

  // Case A: Parsed is directly a JSON array of items (e.g. 306 medical equipments or quotes)
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return { isValid: false, error: 'El archivo JSON contiene una lista vacía (0 registros).' };
    }

    const firstItem = parsed[0] || {};

    const isQuoteArray = !!(firstItem.quoteNumber || firstItem.numeroCotizacion || (firstItem.clientName && firstItem.items));
    const isTenderArray = !!(firstItem.projectName || firstItem.header?.contractObject || firstItem.licitacion || firstItem.proceso);
    const isOCArray = !!(firstItem.contractNumber || firstItem.numeroContrato || firstItem.trackingSteps || firstItem.purchaseOrders);
    const isDocArray = !!(firstItem.docType || firstItem.tipoDocumento || (firstItem.fileName && firstItem.equipmentName));
    const isUserArray = !!(firstItem.username && (firstItem.role || firstItem.password));

    let extractedQuotes: SavedQuote[] = [];
    let extractedEquipments: MedicalEquipment[] = [];
    let extractedTenders: TenderClientProject[] = [];
    let extractedOCs: OCTrackingContract[] = [];
    let extractedDocs: TechnicalDocument[] = [];
    let extractedUsers: StoredUserAccount[] = [];

    if (isQuoteArray) {
      extractedQuotes = parsed.map((item, idx) => normalizeQuoteFromJson(item, idx));
    } else if (isTenderArray) {
      extractedTenders = parsed.map((item, idx) => normalizeTenderFromJson(item, idx));
    } else if (isOCArray) {
      extractedOCs = parsed.map((item, idx) => normalizeOCFromJson(item, idx));
    } else if (isDocArray) {
      extractedDocs = parsed.map((item, idx) => normalizeDocFromJson(item, idx));
    } else if (isUserArray) {
      extractedUsers = parsed.map((item, idx) => normalizeUserFromJson(item, idx));
    } else {
      // Default: parse as full medical equipment catalog (e.g. 306 items)
      extractedEquipments = parsed.map((item, idx) => normalizeEquipmentFromJson(item, idx));
    }

    const counts = {
      quotes: extractedQuotes.length,
      equipments: extractedEquipments.length,
      tenderProjects: extractedTenders.length,
      ocContracts: extractedOCs.length,
      technicalDocuments: extractedDocs.length,
      systemUsers: extractedUsers.length,
    };

    return {
      isValid: true,
      counts,
      metadata: {
        appName: 'SYD Colombia - Importación Directa',
        version: CURRENT_APP_VERSION,
        exportTimestamp: new Date().toISOString(),
        exportDateFormatted: new Date().toLocaleDateString('es-CO'),
        exportedBy: { name: 'Archivo JSON Externo' },
        counts,
      },
      extractedData: {
        quotes: extractedQuotes,
        equipments: extractedEquipments,
        tenderProjects: extractedTenders,
        ocContracts: extractedOCs,
        technicalDocuments: extractedDocs,
        systemUsers: extractedUsers,
      },
    };
  }

  // Case B: Parsed is an object (standard payload with metadata or flat data object)
  const data = parsed.data || parsed.backup || parsed.export || parsed;
  const metadata = parsed.metadata || null;

  // Find equipments array across possible alias names
  const rawEquipments =
    data.equipments ||
    data.equipos ||
    data.catalog ||
    data.catalogo ||
    data.medicalEquipments ||
    data.productos ||
    data.articulos ||
    (Array.isArray(data.items) && !data.quotes && !data.cotizaciones ? data.items : null) ||
    [];

  const rawQuotes = data.quotes || data.cotizaciones || data.savedQuotes || data.saved_quotes || data.ventas || [];
  const rawTenders = data.tenderProjects || data.tenderClients || data.licitaciones || data.proyectos || [];
  const rawOCs = data.ocContracts || data.ordenesCompra || data.ordenes_compra || data.contratos || data.seguimientoOC || [];
  const rawDocs = data.technicalDocuments || data.documents || data.documentos || data.invimaDocs || [];
  const rawUsers = data.systemUsers || data.users || data.usuarios || data.cuentas || [];

  const normalizedEquipments = Array.isArray(rawEquipments)
    ? rawEquipments.map((item, idx) => normalizeEquipmentFromJson(item, idx))
    : [];

  const normalizedQuotes = Array.isArray(rawQuotes)
    ? rawQuotes.map((item, idx) => normalizeQuoteFromJson(item, idx))
    : [];

  const normalizedTenders = Array.isArray(rawTenders)
    ? rawTenders.map((item, idx) => normalizeTenderFromJson(item, idx))
    : [];

  const normalizedOCs = Array.isArray(rawOCs)
    ? rawOCs.map((item, idx) => normalizeOCFromJson(item, idx))
    : [];

  const normalizedDocs = Array.isArray(rawDocs)
    ? rawDocs.map((item, idx) => normalizeDocFromJson(item, idx))
    : [];

  const normalizedUsers = Array.isArray(rawUsers)
    ? rawUsers.map((item, idx) => normalizeUserFromJson(item, idx))
    : [];

  const totalDetected =
    normalizedEquipments.length +
    normalizedQuotes.length +
    normalizedTenders.length +
    normalizedOCs.length +
    normalizedDocs.length +
    normalizedUsers.length;

  if (totalDetected === 0 && !data.themeSettings && !data.activeLetterheadUrl) {
    return {
      isValid: false,
      error: 'El archivo no contiene registros de equipos, cotizaciones, licitaciones ni documentos legibles para SYD Colombia.',
    };
  }

  const counts = {
    quotes: normalizedQuotes.length,
    equipments: normalizedEquipments.length,
    tenderProjects: normalizedTenders.length,
    ocContracts: normalizedOCs.length,
    technicalDocuments: normalizedDocs.length,
    systemUsers: normalizedUsers.length,
  };

  const normalizedData: AppBackupPayload['data'] = {
    quotes: normalizedQuotes,
    equipments: normalizedEquipments,
    tenderProjects: normalizedTenders,
    ocContracts: normalizedOCs,
    technicalDocuments: normalizedDocs,
    systemUsers: normalizedUsers,
    themeSettings: data.themeSettings || data.configuracion || undefined,
    activeLetterheadUrl: data.activeLetterheadUrl || data.membrete || undefined,
    currentQuoteDraft: data.currentQuoteDraft || undefined,
  };

  return {
    isValid: true,
    counts,
    metadata: metadata || {
      appName: 'SYD Colombia',
      version: CURRENT_APP_VERSION,
      exportTimestamp: new Date().toISOString(),
      exportDateFormatted: new Date().toLocaleDateString('es-CO'),
      exportedBy: { name: 'Copia de Seguridad' },
      counts,
    },
    extractedData: normalizedData,
  };
}

export interface RestoreCallbacks {
  onRestoreQuotes?: (quotes: SavedQuote[]) => void;
  onRestoreEquipments?: (equipments: MedicalEquipment[]) => void;
  onRestoreTenders?: (tenders: TenderClientProject[]) => void;
  onRestoreOCContracts?: (contracts: OCTrackingContract[]) => void;
  onRestoreDocuments?: (docs: TechnicalDocument[]) => void;
  onRestoreUsers?: (users: StoredUserAccount[]) => void;
  onRestoreTheme?: (theme: ThemeSettings) => void;
  onRestoreLetterhead?: (url: string | null) => void;
  // Aliases
  setSavedQuotes?: (quotes: SavedQuote[]) => void;
  setEquipments?: (equipments: MedicalEquipment[]) => void;
  setTenderClients?: (tenders: TenderClientProject[]) => void;
  setOcContracts?: (contracts: OCTrackingContract[]) => void;
  setDocuments?: (docs: TechnicalDocument[]) => void;
  setThemeSettings?: (theme: ThemeSettings) => void;
  setActiveLetterheadUrl?: (url: string | null) => void;
}

export interface RestoreOptions {
  mode: 'merge' | 'overwrite';
  selectedCollections: {
    equipments: boolean;
    quotes: boolean;
    tenderProjects: boolean;
    ocContracts: boolean;
    technicalDocuments: boolean;
    systemUsers: boolean;
    themeAndSettings: boolean;
  };
  currentData: {
    equipments: MedicalEquipment[];
    quotes: SavedQuote[];
    tenderProjects: TenderClientProject[];
    ocContracts: OCTrackingContract[];
    technicalDocuments: TechnicalDocument[];
    systemUsers: StoredUserAccount[];
    themeSettings?: ThemeSettings;
    activeLetterheadUrl?: string | null;
  };
  onProgress?: (message: string) => void;
}

/**
 * Intelligent Merger: Combines existing data with incoming data without deleting anything.
 * Updates matching records by ID or key, and appends new ones.
 */
export function mergeEquipments(existing: MedicalEquipment[], incoming: MedicalEquipment[]): MedicalEquipment[] {
  if (!incoming || incoming.length === 0) return existing || [];
  if (!existing || existing.length === 0) return incoming;

  const map = new Map<string, MedicalEquipment>();
  // 1. Index existing by ID and by code
  existing.forEach((item) => {
    if (item.id) map.set(String(item.id).toLowerCase(), item);
    if (item.code) map.set(`code:${String(item.code).toLowerCase().trim()}`, item);
  });

  // 2. Process incoming
  const result: MedicalEquipment[] = [...existing];

  incoming.forEach((newItem) => {
    const byId = newItem.id ? map.get(String(newItem.id).toLowerCase()) : null;
    const byCode = newItem.code ? map.get(`code:${String(newItem.code).toLowerCase().trim()}`) : null;
    const match = byId || byCode;

    if (match) {
      const idx = result.findIndex((r) => r === match);
      if (idx !== -1) {
        result[idx] = {
          ...match,
          ...newItem,
          id: match.id || newItem.id,
          technicalSpecs: newItem.technicalSpecs?.length ? newItem.technicalSpecs : match.technicalSpecs,
          standardAccessories: newItem.standardAccessories?.length ? newItem.standardAccessories : match.standardAccessories,
        };
      }
    } else {
      result.push(newItem);
      if (newItem.id) map.set(String(newItem.id).toLowerCase(), newItem);
      if (newItem.code) map.set(`code:${String(newItem.code).toLowerCase().trim()}`, newItem);
    }
  });

  return result;
}

export function mergeQuotes(existing: SavedQuote[], incoming: SavedQuote[]): SavedQuote[] {
  if (!incoming || incoming.length === 0) return existing || [];
  if (!existing || existing.length === 0) return incoming;

  const map = new Map<string, SavedQuote>();
  existing.forEach((q) => {
    if (q.id) map.set(String(q.id).toLowerCase(), q);
    if (q.quoteNumber) map.set(`num:${String(q.quoteNumber).toLowerCase().trim()}`, q);
  });

  const result: SavedQuote[] = [...existing];
  incoming.forEach((newQuote) => {
    const byId = newQuote.id ? map.get(String(newQuote.id).toLowerCase()) : null;
    const byNum = newQuote.quoteNumber ? map.get(`num:${String(newQuote.quoteNumber).toLowerCase().trim()}`) : null;
    const match = byId || byNum;

    if (match) {
      const idx = result.findIndex((r) => r === match);
      if (idx !== -1) {
        const matchTime = new Date(match.updatedAt || match.savedAt || 0).getTime();
        const incomingTime = new Date(newQuote.updatedAt || newQuote.savedAt || 0).getTime();
        const matchHasItems = (match.items || []).length > 0;
        const incomingHasItems = (newQuote.items || []).length > 0;

        if (incomingTime >= matchTime || (!matchHasItems && incomingHasItems)) {
          result[idx] = { ...match, ...newQuote, id: match.id || newQuote.id };
        } else if (matchHasItems && !incomingHasItems) {
          // Preserve match items so an incomplete incoming sync never erases items
          result[idx] = { ...newQuote, ...match, id: match.id || newQuote.id };
        } else {
          result[idx] = { ...match, ...newQuote, id: match.id || newQuote.id };
        }
      }
    } else {
      result.push(newQuote);
      if (newQuote.id) map.set(String(newQuote.id).toLowerCase(), newQuote);
      if (newQuote.quoteNumber) map.set(`num:${String(newQuote.quoteNumber).toLowerCase().trim()}`, newQuote);
    }
  });

  result.sort((a, b) => new Date(b.updatedAt || b.savedAt || 0).getTime() - new Date(a.updatedAt || a.savedAt || 0).getTime());
  return result;
}

export function mergeTenders(existing: TenderClientProject[], incoming: TenderClientProject[]): TenderClientProject[] {
  const combined = [...(existing || []), ...(incoming || [])];
  return deduplicateTenderProjects(combined);
}

export function mergeOCContracts(existing: OCTrackingContract[], incoming: OCTrackingContract[]): OCTrackingContract[] {
  const filteredExisting = (existing || []).filter((c) => c && c.id && !isContractDeleted(c.id));
  const filteredIncoming = (incoming || []).filter((c) => c && c.id && !isContractDeleted(c.id));

  if (!filteredIncoming || filteredIncoming.length === 0) return filteredExisting;
  if (!filteredExisting || filteredExisting.length === 0) return filteredIncoming;

  const map = new Map<string, OCTrackingContract>();
  filteredExisting.forEach((oc) => {
    if (oc.id) map.set(String(oc.id).toLowerCase(), oc);
    if (oc.contractNumber) map.set(`oc:${String(oc.contractNumber).toLowerCase().trim()}`, oc);
  });

  const result: OCTrackingContract[] = [...filteredExisting];
  filteredIncoming.forEach((newOC) => {
    const byId = newOC.id ? map.get(String(newOC.id).toLowerCase()) : null;
    const byNum = newOC.contractNumber ? map.get(`oc:${String(newOC.contractNumber).toLowerCase().trim()}`) : null;
    const match = byId || byNum;

    if (match) {
      const idx = result.findIndex((r) => r === match);
      if (idx !== -1) {
        // Smart item-level merge: Never wipe out serial numbers or assigned OC numbers!
        const matchItems = match.items || [];
        const newItems = newOC.items || [];

        const mergedItems = matchItems.map((mItem) => {
          const matchingNew = newItems.find(
            (n) =>
              (n.id && mItem.id && n.id === mItem.id) ||
              (n.code && mItem.code && n.code.trim().toLowerCase() === mItem.code.trim().toLowerCase() &&
               n.supplier && mItem.supplier && n.supplier.trim().toLowerCase() === mItem.supplier.trim().toLowerCase())
          );

          if (!matchingNew) return mItem;

          // Preserve serials: If one has serials and the other doesn't, keep serials. If both, merge.
          let resolvedSerials = mItem.serialNumbers || [];
          if ((!resolvedSerials || resolvedSerials.length === 0) && matchingNew.serialNumbers && matchingNew.serialNumbers.length > 0) {
            resolvedSerials = matchingNew.serialNumbers;
          } else if (resolvedSerials && resolvedSerials.length > 0 && matchingNew.serialNumbers && matchingNew.serialNumbers.length > 0) {
            const seenSerials = new Set<string>();
            const combined: typeof resolvedSerials = [];
            [...resolvedSerials, ...matchingNew.serialNumbers].forEach((s) => {
              const key = (s.serialNumber || s.inventoryPlate || '').trim();
              if (key && !seenSerials.has(key)) {
                seenSerials.add(key);
                combined.push(s);
              }
            });
            resolvedSerials = combined.length > 0 ? combined : resolvedSerials;
          }

          // Preserve assigned OC number: Don't revert assigned number to empty or 'Sin N° OC'
          let resolvedOCNumber = mItem.ocNumber || '';
          if ((!resolvedOCNumber || resolvedOCNumber === 'Sin N° OC') && matchingNew.ocNumber && matchingNew.ocNumber !== 'Sin N° OC') {
            resolvedOCNumber = matchingNew.ocNumber;
          }

          // Preserve status: If one is more advanced (e.g. En Tránsito / Despachada or Entregado), keep it
          let resolvedStatus = mItem.status || matchingNew.status;
          if (mItem.status === 'En Tránsito / Despachada' || mItem.status === 'Entregado en Clínica' || mItem.status === 'Instalado / Recibido') {
            resolvedStatus = mItem.status;
          } else if (matchingNew.status === 'En Tránsito / Despachada' || matchingNew.status === 'Entregado en Clínica' || matchingNew.status === 'Instalado / Recibido') {
            resolvedStatus = matchingNew.status;
          }

          // Merge item-level supplier invoices
          const mInvs = mItem.supplierInvoices || [];
          const nInvs = matchingNew.supplierInvoices || [];
          const seenInv = new Set<string>();
          const combinedInvs = [...mInvs, ...nInvs].filter((inv) => {
            const key = `${inv.invoiceNumber || ''}_${inv.fileName || ''}`;
            if (key && !seenInv.has(key)) {
              seenInv.add(key);
              return true;
            }
            return false;
          });

          return {
            ...matchingNew,
            ...mItem,
            ocNumber: resolvedOCNumber || mItem.ocNumber || matchingNew.ocNumber,
            status: resolvedStatus,
            serialNumbers: resolvedSerials,
            supplierInvoices: combinedInvs.length > 0 ? combinedInvs : undefined,
          };
        });

        // Add any newly added items in newOC that weren't in match
        newItems.forEach((nItem) => {
          const already = mergedItems.some(
            (m) =>
              (m.id && nItem.id && m.id === nItem.id) ||
              (m.code && nItem.code && m.code.trim().toLowerCase() === nItem.code.trim().toLowerCase() &&
               m.supplier && nItem.supplier && m.supplier.trim().toLowerCase() === nItem.supplier.trim().toLowerCase())
          );
          if (!already) {
            mergedItems.push(nItem);
          }
        });

        // Merge contract-level supplier invoices
        const mContractInvs = match.supplierInvoices || [];
        const nContractInvs = newOC.supplierInvoices || [];
        const seenContractInv = new Set<string>();
        const mergedContractInvs = [...mContractInvs, ...nContractInvs].filter((inv) => {
          const key = `${inv.invoiceNumber || ''}_${inv.fileName || ''}`;
          if (key && !seenContractInv.has(key)) {
            seenContractInv.add(key);
            return true;
          }
          return false;
        });

        result[idx] = {
          ...match,
          ...newOC,
          id: match.id || newOC.id,
          contractNumber: match.contractNumber || newOC.contractNumber,
          salesOrderNumber: match.salesOrderNumber || newOC.salesOrderNumber,
          items: mergedItems,
          supplierInvoices: mergedContractInvs,
          lastUpdatedAt: new Date().toISOString(),
        };
      }
    } else {
      result.push(newOC);
      if (newOC.id) map.set(String(newOC.id).toLowerCase(), newOC);
      if (newOC.contractNumber) map.set(`oc:${String(newOC.contractNumber).toLowerCase().trim()}`, newOC);
    }
  });
  return result;
}

export function mergeDocuments(existing: TechnicalDocument[], incoming: TechnicalDocument[]): TechnicalDocument[] {
  if (!incoming || incoming.length === 0) return existing || [];
  if (!existing || existing.length === 0) return incoming;

  const map = new Map<string, TechnicalDocument>();
  existing.forEach((d) => {
    if (d.id) map.set(String(d.id).toLowerCase(), d);
    if (d.equipmentCode && d.docType) map.set(`doc:${String(d.equipmentCode).toLowerCase().trim()}_${d.docType}`, d);
  });

  const result: TechnicalDocument[] = [...existing];
  incoming.forEach((newDoc) => {
    const byId = newDoc.id ? map.get(String(newDoc.id).toLowerCase()) : null;
    const byKey = newDoc.equipmentCode && newDoc.docType ? map.get(`doc:${String(newDoc.equipmentCode).toLowerCase().trim()}_${newDoc.docType}`) : null;
    const match = byId || byKey;

    if (match) {
      const idx = result.findIndex((r) => r === match);
      if (idx !== -1) result[idx] = { ...match, ...newDoc, id: match.id || newDoc.id };
    } else {
      result.push(newDoc);
      if (newDoc.id) map.set(String(newDoc.id).toLowerCase(), newDoc);
    }
  });
  return result;
}

export function mergeUsers(existing: StoredUserAccount[], incoming: StoredUserAccount[]): StoredUserAccount[] {
  if (!incoming || incoming.length === 0) return existing || [];
  if (!existing || existing.length === 0) return incoming;

  const map = new Map<string, StoredUserAccount>();
  existing.forEach((u) => {
    if (u.id) map.set(String(u.id).toLowerCase(), u);
    if (u.username) map.set(`u:${String(u.username).toLowerCase().trim()}`, u);
  });

  const result: StoredUserAccount[] = [...existing];
  incoming.forEach((newUser) => {
    const byId = newUser.id ? map.get(String(newUser.id).toLowerCase()) : null;
    const byUname = newUser.username ? map.get(`u:${String(newUser.username).toLowerCase().trim()}`) : null;
    const match = byId || byUname;

    if (match) {
      const idx = result.findIndex((r) => r === match);
      if (idx !== -1) {
        const resolvedPermissions =
          newUser.role === 'admin'
            ? { ...FULL_ADMIN_PERMISSIONS }
            : newUser.permissions
            ? { ...DEFAULT_VIEWER_PERMISSIONS, ...newUser.permissions }
            : match.permissions
            ? { ...DEFAULT_VIEWER_PERMISSIONS, ...match.permissions }
            : { ...DEFAULT_VIEWER_PERMISSIONS };

        result[idx] = {
          ...match,
          ...newUser,
          permissions: resolvedPermissions,
          id: match.id || newUser.id,
        };
      }
    } else {
      result.push({
        ...newUser,
        permissions:
          newUser.role === 'admin'
            ? { ...FULL_ADMIN_PERMISSIONS }
            : newUser.permissions
            ? { ...DEFAULT_VIEWER_PERMISSIONS, ...newUser.permissions }
            : { ...DEFAULT_VIEWER_PERMISSIONS },
      });
      if (newUser.id) map.set(String(newUser.id).toLowerCase(), newUser);
      if (newUser.username) map.set(`u:${String(newUser.username).toLowerCase().trim()}`, newUser);
    }
  });
  return result;
}

export function mergeSalesOrders(existing: SalesOrderRecord[], incoming: SalesOrderRecord[]): SalesOrderRecord[] {
  const filteredExisting = (existing || []).filter(
    (o) => o && o.id && !isSalesOrderDeleted(o.id, o.salesOrderNumber, o.tenderClientId, o.contractId)
  );
  const filteredIncoming = (incoming || []).filter(
    (o) => o && o.id && !isSalesOrderDeleted(o.id, o.salesOrderNumber, o.tenderClientId, o.contractId)
  );

  if (!filteredIncoming || filteredIncoming.length === 0) return filteredExisting;
  if (!filteredExisting || filteredExisting.length === 0) return filteredIncoming;

  const map = new Map<string, SalesOrderRecord>();
  filteredExisting.forEach((o) => {
    if (o.id) map.set(String(o.id).toLowerCase(), o);
  });

  const result: SalesOrderRecord[] = [...filteredExisting];
  filteredIncoming.forEach((newOrder) => {
    if (!newOrder || !newOrder.id || isSalesOrderDeleted(newOrder.id, newOrder.salesOrderNumber, newOrder.tenderClientId, newOrder.contractId)) {
      return;
    }

    const match = map.get(String(newOrder.id).toLowerCase());
    if (match) {
      const idx = result.findIndex((r) => r.id === match.id);
      if (idx !== -1) {
        result[idx] = {
          ...match,
          ...newOrder,
          updatedAt: new Date().toISOString(),
        };
      }
    } else {
      result.push(newOrder);
      map.set(String(newOrder.id).toLowerCase(), newOrder);
    }
  });

  result.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
  return result;
}

export function mergeSalesInvoices(existing: SalesInvoiceRecord[], incoming: SalesInvoiceRecord[]): SalesInvoiceRecord[] {
  const filteredExisting = (existing || []).filter((inv) => inv && inv.id && !isSalesInvoiceDeleted(inv.id, inv.invoiceNumber));
  const filteredIncoming = (incoming || []).filter((inv) => inv && inv.id && !isSalesInvoiceDeleted(inv.id, inv.invoiceNumber));

  if (!filteredIncoming || filteredIncoming.length === 0) return filteredExisting;
  if (!filteredExisting || filteredExisting.length === 0) return filteredIncoming;

  const map = new Map<string, SalesInvoiceRecord>();
  filteredExisting.forEach((inv) => {
    if (inv.id) map.set(String(inv.id).toLowerCase(), inv);
    if (inv.invoiceNumber) map.set(`inv:${String(inv.invoiceNumber).toLowerCase().trim()}`, inv);
  });

  const result: SalesInvoiceRecord[] = [...filteredExisting];
  filteredIncoming.forEach((newInv) => {
    if (isSalesInvoiceDeleted(newInv.id, newInv.invoiceNumber)) return;

    const byId = newInv.id ? map.get(String(newInv.id).toLowerCase()) : null;
    const byNum = newInv.invoiceNumber ? map.get(`inv:${String(newInv.invoiceNumber).toLowerCase().trim()}`) : null;
    const match = byId || byNum;

    if (match) {
      const idx = result.findIndex((r) => r === match);
      if (idx !== -1) result[idx] = { ...match, ...newInv, id: match.id || newInv.id };
    } else {
      result.push(newInv);
      if (newInv.id) map.set(String(newInv.id).toLowerCase(), newInv);
      if (newInv.invoiceNumber) map.set(`inv:${String(newInv.invoiceNumber).toLowerCase().trim()}`, newInv);
    }
  });

  result.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
  return result;
}

export function mergeSuppliers(existing: SupplierProfile[], incoming: SupplierProfile[]): SupplierProfile[] {
  if (!incoming || incoming.length === 0) return existing || [];
  if (!existing || existing.length === 0) return incoming;

  const map = new Map<string, SupplierProfile>();
  existing.forEach((s) => {
    if (s.id) map.set(String(s.id).toLowerCase(), s);
    if (s.name) map.set(`s:${String(s.name).toLowerCase().trim()}`, s);
  });

  const result: SupplierProfile[] = [...existing];
  incoming.forEach((newSupp) => {
    const byId = newSupp.id ? map.get(String(newSupp.id).toLowerCase()) : null;
    const byName = newSupp.name ? map.get(`s:${String(newSupp.name).toLowerCase().trim()}`) : null;
    const match = byId || byName;

    if (match) {
      const idx = result.findIndex((r) => r === match);
      if (idx !== -1) result[idx] = { ...match, ...newSupp, id: match.id || newSupp.id };
    } else {
      result.push(newSupp);
      if (newSupp.id) map.set(String(newSupp.id).toLowerCase(), newSupp);
      if (newSupp.name) map.set(`s:${String(newSupp.name).toLowerCase().trim()}`, newSupp);
    }
  });
  return unifyAllDuplicateSuppliers(result).unifiedSuppliers;
}

export function mergeClients(existing: ClientRecord[], incoming: ClientRecord[]): ClientRecord[] {
  if (!incoming || incoming.length === 0) return existing || [];
  if (!existing || existing.length === 0) return incoming;

  const map = new Map<string, ClientRecord>();
  existing.forEach((c) => {
    if (c.id) map.set(String(c.id).toLowerCase(), c);
    if (c.name) map.set(`c:${String(c.name).toLowerCase().trim()}`, c);
  });

  const result: ClientRecord[] = [...existing];
  incoming.forEach((newClient) => {
    const byId = newClient.id ? map.get(String(newClient.id).toLowerCase()) : null;
    const byName = newClient.name ? map.get(`c:${String(newClient.name).toLowerCase().trim()}`) : null;
    const match = byId || byName;

    if (match) {
      const idx = result.findIndex((r) => r === match);
      if (idx !== -1) result[idx] = { ...match, ...newClient, id: match.id || newClient.id };
    } else {
      result.push(newClient);
      if (newClient.id) map.set(String(newClient.id).toLowerCase(), newClient);
      if (newClient.name) map.set(`c:${String(newClient.name).toLowerCase().trim()}`, newClient);
    }
  });
  return result;
}

/**
 * Restores the application state from a validated backup payload and synchronizes to Cloud Firestore
 * Supports both "Merge (Without Restrictions)" and "Overwrite" modes.
 */
export async function restoreBackupToSystem(
  incomingData: AppBackupPayload['data'],
  callbacks: RestoreCallbacks,
  options?: RestoreOptions
): Promise<{ success: boolean; message: string; counts?: AppBackupMetadata['counts'] }> {
  try {
    const mode = options?.mode || 'merge';
    const selected = options?.selectedCollections || {
      equipments: true,
      quotes: true,
      tenderProjects: true,
      ocContracts: true,
      technicalDocuments: true,
      systemUsers: true,
      themeAndSettings: true,
    };
    const current = options?.currentData || {
      equipments: [],
      quotes: [],
      tenderProjects: [],
      ocContracts: [],
      technicalDocuments: [],
      systemUsers: [],
    };

    options?.onProgress?.('Preparando datos para la restauración...');

    // 1. Process Equipments
    let finalEquipments: MedicalEquipment[] = current.equipments;
    if (selected.equipments && incomingData.equipments && incomingData.equipments.length > 0) {
      finalEquipments = mode === 'merge'
        ? mergeEquipments(current.equipments, incomingData.equipments)
        : incomingData.equipments;
    }

    // 2. Process Quotes
    let finalQuotes: SavedQuote[] = current.quotes;
    if (selected.quotes && incomingData.quotes && incomingData.quotes.length > 0) {
      finalQuotes = mode === 'merge'
        ? mergeQuotes(current.quotes, incomingData.quotes)
        : incomingData.quotes;
    }

    // 3. Process Tenders
    let finalTenders: TenderClientProject[] = current.tenderProjects;
    if (selected.tenderProjects && incomingData.tenderProjects && incomingData.tenderProjects.length > 0) {
      finalTenders = mode === 'merge'
        ? mergeTenders(current.tenderProjects, incomingData.tenderProjects)
        : incomingData.tenderProjects;
    }

    // 4. Process OC Contracts
    let finalOCs: OCTrackingContract[] = current.ocContracts;
    if (selected.ocContracts && incomingData.ocContracts && incomingData.ocContracts.length > 0) {
      finalOCs = mode === 'merge'
        ? mergeOCContracts(current.ocContracts, incomingData.ocContracts)
        : incomingData.ocContracts;
    }

    // 5. Process Technical Documents
    let finalDocs: TechnicalDocument[] = current.technicalDocuments;
    if (selected.technicalDocuments && incomingData.technicalDocuments && incomingData.technicalDocuments.length > 0) {
      finalDocs = mode === 'merge'
        ? mergeDocuments(current.technicalDocuments, incomingData.technicalDocuments)
        : incomingData.technicalDocuments;
    }

    // 6. Process System Users
    let finalUsers: StoredUserAccount[] = current.systemUsers;
    if (selected.systemUsers && incomingData.systemUsers && incomingData.systemUsers.length > 0) {
      finalUsers = mode === 'merge'
        ? mergeUsers(current.systemUsers, incomingData.systemUsers)
        : incomingData.systemUsers;
    }

    // 7. Process Theme & Letterhead
    const finalTheme = selected.themeAndSettings && incomingData.themeSettings
      ? incomingData.themeSettings
      : current.themeSettings;
    const finalLetterhead = selected.themeAndSettings && incomingData.activeLetterheadUrl
      ? incomingData.activeLetterheadUrl
      : current.activeLetterheadUrl;

    // Persist immediately to localStorage
    try {
      if (selected.equipments) localStorage.setItem('syd_equipments_catalog', JSON.stringify(finalEquipments));
      if (selected.quotes) localStorage.setItem('syd_saved_quotes_database_v2', JSON.stringify(finalQuotes));
      if (selected.tenderProjects) localStorage.setItem('syd_tender_clients_v2', JSON.stringify(finalTenders));
      if (selected.ocContracts) localStorage.setItem('syd_oc_tracking_contracts_v3', JSON.stringify(finalOCs));
      if (selected.technicalDocuments) localStorage.setItem('syd_technical_documents_v3', JSON.stringify(finalDocs));
      if (selected.systemUsers) {
        localStorage.setItem('syd_registered_system_users_v3', JSON.stringify(finalUsers));
        localStorage.setItem('syd_user_accounts_v2', JSON.stringify(finalUsers));
      }
      if (finalTheme) localStorage.setItem('syd_theme_settings_v1', JSON.stringify(finalTheme));
      if (finalLetterhead) {
        localStorage.setItem('syd_active_letterhead_url', finalLetterhead);
        localStorage.setItem('syd_permanent_default_letterhead', finalLetterhead);
      }
    } catch (localErr) {
      console.warn('LocalStorage save warning during restore:', localErr);
    }

    // Update React UI states across the app
    const quotesSetter = callbacks.onRestoreQuotes || callbacks.setSavedQuotes;
    if (quotesSetter && selected.quotes) quotesSetter(finalQuotes);

    const equipmentsSetter = callbacks.onRestoreEquipments || callbacks.setEquipments;
    if (equipmentsSetter && selected.equipments) equipmentsSetter(finalEquipments);

    const tendersSetter = callbacks.onRestoreTenders || callbacks.setTenderClients;
    if (tendersSetter && selected.tenderProjects) tendersSetter(finalTenders);

    const ocSetter = callbacks.onRestoreOCContracts || callbacks.setOcContracts;
    if (ocSetter && selected.ocContracts) ocSetter(finalOCs);

    const docsSetter = callbacks.onRestoreDocuments || callbacks.setDocuments;
    if (docsSetter && selected.technicalDocuments) docsSetter(finalDocs);

    const usersSetter = callbacks.onRestoreUsers;
    if (usersSetter && selected.systemUsers) usersSetter(finalUsers);

    const themeSetter = callbacks.onRestoreTheme || callbacks.setThemeSettings;
    if (themeSetter && finalTheme) themeSetter(finalTheme);

    const letterSetter = callbacks.onRestoreLetterhead || callbacks.setActiveLetterheadUrl;
    if (letterSetter && finalLetterhead) letterSetter(finalLetterhead);

    // Synchronize to Firestore in direct batches
    options?.onProgress?.('Sincronizando registros con la base de datos Firestore...');

    await directBatchRestoreToFirestore(
      {
        equipments: selected.equipments ? finalEquipments : undefined,
        quotes: selected.quotes ? finalQuotes : undefined,
        tenderProjects: selected.tenderProjects ? finalTenders : undefined,
        ocContracts: selected.ocContracts ? finalOCs : undefined,
        technicalDocuments: selected.technicalDocuments ? finalDocs : undefined,
        systemUsers: selected.systemUsers ? finalUsers : undefined,
        themeSettings: finalTheme,
        activeLetterheadUrl: finalLetterhead,
      },
      options?.onProgress
    );

    const finalCounts = {
      quotes: finalQuotes.length,
      equipments: finalEquipments.length,
      tenderProjects: finalTenders.length,
      ocContracts: finalOCs.length,
      technicalDocuments: finalDocs.length,
      systemUsers: finalUsers.length,
    };

    return {
      success: true,
      message: `¡Restauración exitosa! Se cargaron ${finalEquipments.length} equipos médicos y ${finalQuotes.length} cotizaciones sin restricciones.`,
      counts: finalCounts,
    };
  } catch (err: any) {
    console.error('Error restaurando backup:', err);
    return {
      success: false,
      message: `Error al restaurar: ${err?.message || 'Fallo desconocido'}`,
    };
  }
}
