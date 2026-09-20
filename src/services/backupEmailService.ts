import nodemailer from 'nodemailer';
import * as XLSX from 'xlsx';

export interface BackupDataPayload {
  timestamp: string;
  dateString?: string;
  equipmentsCount?: number;
  quotesCount?: number;
  tendersCount?: number;
  contractsCount?: number;
  salesOrdersCount?: number;
  salesInvoicesCount?: number;
  documentsCount?: number;
  usersCount?: number;
  data: {
    equipments?: any[];
    quotes?: any[];
    tenderProjects?: any[];
    ocContracts?: any[];
    salesOrders?: any[];
    salesInvoices?: any[];
    technicalDocuments?: any[];
    systemUsers?: any[];
    themeSettings?: any;
    activeLetterheadUrl?: string | null;
    currentQuoteDraft?: any;
  };
}

const DEFAULT_RECIPIENTS = ['auxlineadiagnostica@syd.com.co', 'eljemb22@gmail.com'];

/**
 * Generates a rich, multi-tab Microsoft Excel (.xlsx) buffer with all collections
 */
export function generateExcelBuffer(payload: BackupDataPayload): Buffer {
  const wb = XLSX.utils.book_new();
  const cleanStr = (val: any) => (val === undefined || val === null ? '' : String(val).trim());
  const data = payload?.data || {};

  const equipments = data.equipments || [];
  const quotes = data.quotes || [];
  const tenderProjects = data.tenderProjects || [];
  const ocContracts = data.ocContracts || [];
  const salesOrders = data.salesOrders || [];
  const salesInvoices = data.salesInvoices || [];
  const technicalDocuments = data.technicalDocuments || [];
  const systemUsers = data.systemUsers || [];

  // 1. Sheet: Catálogo de Equipos Médicos
  const catalogRows = equipments.map((eq: any, idx: number) => ({
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
      ? eq.standardAccessories.map((a: any) => `${a.name}${a.costCOP ? ` ($${a.costCOP})` : ''}`).join(' | ')
      : '',
  }));
  const wsCatalog = XLSX.utils.json_to_sheet(
    catalogRows.length > 0
      ? catalogRows
      : [{ 'Código': 'EQ-001', 'Nombre del Equipo': 'Monitor de Signos Vitales', 'Marca': 'SYD Biomedical', 'Modelo': 'Pro-10', 'Costo Base COP': 4500000 }]
  );
  XLSX.utils.book_append_sheet(wb, wsCatalog, '1_Catalogo_Equipos');

  // 2. Sheet: Cotizaciones Guardadas
  const quoteRows = quotes.map((q: any) => ({
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
    quoteRows.length > 0
      ? quoteRows
      : [{ 'N° Cotización': 'COT-2026-001', 'Fecha': new Date().toISOString().split('T')[0], 'Cliente / Institución': 'Hospital General', 'Total COP': 15000000, 'Estado': 'Enviada' }]
  );
  XLSX.utils.book_append_sheet(wb, wsQuotes, '2_Cotizaciones_Guardadas');

  // 3. Sheet: Detalle de Ítems Cotizados
  const quoteItemRows: any[] = [];
  quotes.forEach((q: any) => {
    (q.items || []).forEach((it: any, idx: number) => {
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
        'Accesorios / Notas': cleanStr(it.notes || (Array.isArray(it.accessories) ? it.accessories.map((a: any) => a.name).join(', ') : '')),
      });
    });
  });
  const wsQuoteItems = XLSX.utils.json_to_sheet(
    quoteItemRows.length > 0
      ? quoteItemRows
      : [{ 'N° Cotización': 'COT-2026-001', 'Item #': 1, 'Código': 'EQ-001', 'Nombre del Equipo': 'Monitor', 'Cantidad': 1, 'Precio Venta Unitario COP': 6500000 }]
  );
  XLSX.utils.book_append_sheet(wb, wsQuoteItems, '3_Detalle_Items_Cotizados');

  // 4. Sheet: Licitaciones y Proyectos
  const tenderRows = tenderProjects.map((t: any, idx: number) => ({
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
    tenderRows.length > 0
      ? tenderRows
      : [{ 'ID Proyecto': 'LIC-01', 'Entidad / Cliente': 'ESE Hospital Departamental', 'N° Proceso': 'SAM-001-2026', 'Presupuesto Oficial COP': 50000000, 'Estado Licitación': 'En Preparación' }]
  );
  XLSX.utils.book_append_sheet(wb, wsTenders, '4_Licitaciones_Proyectos');

  // 5. Sheet: Ítems de Licitaciones
  const tenderItemRows: any[] = [];
  tenderProjects.forEach((t: any) => {
    (t.items || []).forEach((it: any, idx: number) => {
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
          ? it.requirements.map((r: any) => `[${r.complies !== false ? 'CUMPLE' : 'NO CUMPLE'}] ${r.requirement}${r.offeredSpec ? `: ${r.offeredSpec}` : ''}`).join(' | ')
          : '',
      });
    });
  });
  const wsTenderItems = XLSX.utils.json_to_sheet(
    tenderItemRows.length > 0
      ? tenderItemRows
      : [{ 'ID Proyecto': 'LIC-01', 'Item #': 1, 'Nombre del Equipo': 'Bomba de Infusión', 'Cantidad': 2, 'Precio Ofertado Unitario': 3200000 }]
  );
  XLSX.utils.book_append_sheet(wb, wsTenderItems, '5_Items_Licitaciones');

  // 6. Sheet: Órdenes de Compra y OCs
  const ocRows = ocContracts.map((oc: any, idx: number) => ({
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
    ocRows.length > 0
      ? ocRows
      : [{ 'ID Contrato': '', 'N° Contrato / OC': '', 'Entidad / Cliente': '', 'Costo Total Compra COP': '', 'Estado Global': '' }]
  );
  XLSX.utils.book_append_sheet(wb, wsOCs, '6_Ordenes_Compra_OC');

  // 7. Sheet: Órdenes de Venta (OV)
  const salesOrderRows = salesOrders.map((so: any, idx: number) => ({
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
    salesOrderRows.length > 0
      ? salesOrderRows
      : [{ 'ID Orden': '', 'N° Orden de Venta': '', 'Cliente / Institución': '', 'Valor Total COP': '', 'Estado OV': '' }]
  );
  XLSX.utils.book_append_sheet(wb, wsSalesOrders, '7_Ordenes_de_Venta_OV');

  // 8. Sheet: Facturas Emitidas a Clientes
  const salesInvoiceRows = salesInvoices.map((inv: any, idx: number) => ({
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
    'Notas / Pagos': cleanStr(inv.notes),
  }));
  const wsSalesInvoices = XLSX.utils.json_to_sheet(
    salesInvoiceRows.length > 0
      ? salesInvoiceRows
      : [{ 'ID Factura': '', 'N° Factura': '', 'N° Orden de Venta': '', 'Cliente / Institución': '', 'Total Factura COP': '', 'Estado Pago Factura': '' }]
  );
  XLSX.utils.book_append_sheet(wb, wsSalesInvoices, '8_Facturas_Emitidas');

  // 9. Sheet: Directorio de Clientes
  const clientMap = new Map<string, any>();
  quotes.forEach((q: any) => {
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
  tenderProjects.forEach((t: any) => {
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
  salesOrders.forEach((so: any) => {
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
    clientRows.length > 0
      ? clientRows
      : [{ 'Nombre Institución / Cliente': 'Hospital Universitario', 'NIT': '900123456-1', 'Ciudad': 'Barranquilla', 'Origen': 'Directorio' }]
  );
  XLSX.utils.book_append_sheet(wb, wsClients, '9_Directorio_Clientes');

  // 10. Sheet: Directorio de Proveedores
  const supplierMap = new Map<string, any>();
  equipments.forEach((eq: any) => {
    const suppliers = [eq.supplier, ...(eq.allSuppliers || []), ...(eq.alternateSuppliers || [])].filter(Boolean);
    suppliers.forEach((s: any) => {
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
    supplierRows.length > 0
      ? supplierRows
      : [{ 'Nombre Proveedor / Fabricante': 'Mindray Colombia', 'Marcas Distribuidas': 'Mindray', 'Origen de Registro': 'Catálogo' }]
  );
  XLSX.utils.book_append_sheet(wb, wsSuppliers, '10_Directorio_Proveedores');

  // 11. Sheet: Usuarios del Sistema
  const userRows = systemUsers.map((u: any) => ({
    'Usuario (Login)': cleanStr(u.username),
    'Nombre Completo': cleanStr(u.name),
    'Correo Electrónico': cleanStr(u.email),
    'Rol': u.role === 'admin' ? 'Administrador General' : 'Asesor / Consultor',
    'Cargo / Etiqueta': cleanStr(u.roleLabel),
    'Departamento': cleanStr(u.department || 'Ventas & Licitaciones'),
  }));
  const wsUsers = XLSX.utils.json_to_sheet(
    userRows.length > 0
      ? userRows
      : [{ 'Usuario (Login)': 'admin', 'Nombre Completo': 'Administrador', 'Rol': 'Administrador General' }]
  );
  XLSX.utils.book_append_sheet(wb, wsUsers, '11_Usuarios_Sistema');

  // 12. Sheet: Metadatos y Resumen
  const metadataRows = [
    { 'Propiedad': 'Software', 'Valor': 'SYD Colombia - Software de Cotizaciones y Licitaciones' },
    { 'Propiedad': 'Frecuencia de Respaldo', 'Valor': 'Automático Cada Hora (Horario 24/7)' },
    { 'Propiedad': 'Fecha y Hora del Respaldo', 'Valor': new Date().toLocaleString('es-CO') },
    { 'Propiedad': 'Total Equipos en Catálogo', 'Valor': equipments.length },
    { 'Propiedad': 'Total Cotizaciones Guardadas', 'Valor': quotes.length },
    { 'Propiedad': 'Total Licitaciones y Proyectos', 'Valor': tenderProjects.length },
    { 'Propiedad': 'Total Órdenes de Compra (OC)', 'Valor': ocContracts.length },
    { 'Propiedad': 'Total Órdenes de Venta (OV)', 'Valor': salesOrders.length },
    { 'Propiedad': 'Total Facturas Emitidas', 'Valor': salesInvoices.length },
    { 'Propiedad': 'Total Documentos Técnicos', 'Valor': technicalDocuments.length },
    { 'Propiedad': 'Total Usuarios del Sistema', 'Valor': systemUsers.length },
  ];
  const wsMeta = XLSX.utils.json_to_sheet(metadataRows);
  XLSX.utils.book_append_sheet(wb, wsMeta, '12_Resumen_Base_Datos');

  // Write workbook to Buffer
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/**
 * Sends an automated hourly backup email with complete Excel (.xlsx) and JSON database attachments
 */
export async function sendHourlyBackupEmail(
  backupPayload: BackupDataPayload,
  customRecipients?: string[] | string
): Promise<{ success: boolean; messageId?: string; recipients?: string[]; error?: string; time?: string }> {
  try {
    const data = backupPayload?.data || {};
    const eqCount = backupPayload.equipmentsCount ?? data.equipments?.length ?? 0;
    const quotesCount = backupPayload.quotesCount ?? data.quotes?.length ?? 0;
    const tendersCount = backupPayload.tendersCount ?? data.tenderProjects?.length ?? 0;
    const ocCount = backupPayload.contractsCount ?? data.ocContracts?.length ?? 0;
    const salesOrdersCount = backupPayload.salesOrdersCount ?? data.salesOrders?.length ?? 0;
    const salesInvoicesCount = backupPayload.salesInvoicesCount ?? data.salesInvoices?.length ?? 0;
    const docsCount = backupPayload.documentsCount ?? data.technicalDocuments?.length ?? 0;
    const usersCount = backupPayload.usersCount ?? data.systemUsers?.length ?? 0;

    // Determine recipient list
    let recipients: string[] = DEFAULT_RECIPIENTS;
    if (customRecipients) {
      if (Array.isArray(customRecipients)) {
        recipients = Array.from(new Set([...customRecipients.filter(Boolean), ...DEFAULT_RECIPIENTS]));
      } else if (typeof customRecipients === 'string') {
        const split = customRecipients.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
        recipients = Array.from(new Set([...split, ...DEFAULT_RECIPIENTS]));
      }
    }

    const now = new Date();
    const dateFormatted = now.toISOString().split('T')[0];
    const timeFormatted = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const fullDateTimeStamp = `${dateFormatted}_${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}`;

    const excelFileName = `Base_de_Datos_Completa_SYD_Colombia_${fullDateTimeStamp}.xlsx`;
    const jsonFileName = `Respaldo_Integral_SYD_Colombia_${fullDateTimeStamp}.json`;

    // Generate Excel (.xlsx) file buffer
    const excelBuffer = generateExcelBuffer(backupPayload);

    // Generate JSON file buffer
    const jsonString = JSON.stringify(backupPayload, null, 2);
    const jsonBuffer = Buffer.from(jsonString, 'utf-8');

    // Configure nodemailer transporter
    let transporter: nodemailer.Transporter;

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // Direct / Test account transporter
      const testAccount = await nodemailer.createTestAccount().catch(() => null);
      if (testAccount) {
        transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
      } else {
        transporter = nodemailer.createTransport({
          jsonTransport: true,
        });
      }
    }

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; background-color: #0b1322; color: #f1f5f9; padding: 28px; border-radius: 16px; max-width: 680px; margin: 0 auto; border: 1px solid #1e293b; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
        <!-- Header -->
        <div style="border-bottom: 2px solid #10b981; padding-bottom: 16px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <h2 style="color: #34d399; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">
              📊 SYD Colombia - Respaldo Automático Cada Hora
            </h2>
            <p style="color: #94a3b8; font-size: 13px; margin: 6px 0 0 0;">
              Generado con éxito el <strong>${dateFormatted} a las ${timeFormatted}</strong>
            </p>
          </div>
          <div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); padding: 4px 10px; border-radius: 20px; color: #6ee7b7; font-size: 11px; font-weight: 700; text-transform: uppercase;">
            Excel .XLSX + JSON
          </div>
        </div>

        <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
          Se ha generado la copia de seguridad horaria de la base de datos completa de <strong>SYD Colombia (Cotizaciones, Licitaciones SECOP II, Equipos Médicos, OCs, Órdenes de Venta y Facturación)</strong>.
        </p>

        <!-- Metrics Grid -->
        <div style="background-color: #111e33; padding: 18px; border-radius: 12px; margin: 18px 0; border: 1px solid #1e293b;">
          <h4 style="color: #38bdf8; margin: 0 0 14px 0; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
            Resumen de Registros Respaldados:
          </h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #e2e8f0;">
            <tbody>
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 8px 4px;">📦 <strong>Catálogo de Equipos Médicos:</strong></td>
                <td style="padding: 8px 4px; text-align: right; color: #34d399; font-weight: 700;">${eqCount} equipos</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 8px 4px;">📄 <strong>Cotizaciones Guardadas:</strong></td>
                <td style="padding: 8px 4px; text-align: right; color: #38bdf8; font-weight: 700;">${quotesCount} cotizaciones</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 8px 4px;">🏛️ <strong>Licitaciones & Proyectos:</strong></td>
                <td style="padding: 8px 4px; text-align: right; color: #c084fc; font-weight: 700;">${tendersCount} licitaciones</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 8px 4px;">📑 <strong>Órdenes de Compra (OC):</strong></td>
                <td style="padding: 8px 4px; text-align: right; color: #fbbf24; font-weight: 700;">${ocCount} contratos</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 8px 4px;">🛒 <strong>Órdenes de Venta (OV):</strong></td>
                <td style="padding: 8px 4px; text-align: right; color: #2dd4bf; font-weight: 700;">${salesOrdersCount} órdenes</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 8px 4px;">🧾 <strong>Facturas Emitidas:</strong></td>
                <td style="padding: 8px 4px; text-align: right; color: #f472b6; font-weight: 700;">${salesInvoicesCount} facturas</td>
              </tr>
              <tr style="border-bottom: 1px solid #1e293b;">
                <td style="padding: 8px 4px;">📚 <strong>Documentos & INVIMA:</strong></td>
                <td style="padding: 8px 4px; text-align: right; color: #94a3b8; font-weight: 700;">${docsCount} archivos</td>
              </tr>
              <tr>
                <td style="padding: 8px 4px;">👥 <strong>Usuarios Registrados:</strong></td>
                <td style="padding: 8px 4px; text-align: right; color: #818cf8; font-weight: 700;">${usersCount} usuarios</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Attachments Info -->
        <div style="background-color: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 10px; padding: 14px; margin-bottom: 18px;">
          <div style="color: #6ee7b7; font-weight: 700; font-size: 13px; margin-bottom: 6px;">
            📎 Archivos Adjuntos a este Correo:
          </div>
          <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: #cbd5e1; line-height: 1.7;">
            <li>
              <strong style="color: #34d399;">${excelFileName}</strong>: Libro de Excel con 12 pestañas independientes (Catálogo, Cotizaciones, Ítems, Licitaciones, OCs, OVs, Facturas, Clientes y Proveedores) para abrir y editar en Microsoft Excel.
            </li>
            <li>
              <strong style="color: #38bdf8;">${jsonFileName}</strong>: Archivo de recuperación integral del sistema para restaurar la aplicación en un clic.
            </li>
          </ul>
        </div>

        <!-- Footer -->
        <div style="margin-top: 24px; padding-top: 14px; border-top: 1px solid #1e293b; font-size: 11px; color: #64748b; text-align: center; line-height: 1.5;">
          Sistema Automatizado de Respaldo Horario SYD Colombia &bull; Destinatarios: ${recipients.join(', ')}<br />
          Para soporte técnico o restauraciones de emergencia, contacta al Administrador del Sistema.
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: `"SYD Colombia Respaldo" <${process.env.SMTP_USER || 'backup@syd.com.co'}>`,
      to: recipients.join(', '),
      subject: `[Respaldo Horario Excel] SYD Colombia - ${dateFormatted} ${timeFormatted}`,
      text: `Respaldo Horario SYD Colombia generado el ${dateFormatted} ${timeFormatted}. Equipos: ${eqCount}, Cotizaciones: ${quotesCount}, Licitaciones: ${tendersCount}, OCs: ${ocCount}, OVs: ${salesOrdersCount}, Facturas: ${salesInvoicesCount}. Se adjunta archivo Excel y JSON.`,
      html: htmlContent,
      attachments: [
        {
          filename: excelFileName,
          content: excelBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
        {
          filename: jsonFileName,
          content: jsonBuffer,
          contentType: 'application/json',
        },
      ],
    });

    console.log(`[Backup Email] Hourly backup successfully sent to ${recipients.join(', ')}. MessageId: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
      recipients,
      time: `${dateFormatted} ${timeFormatted}`,
    };
  } catch (error: any) {
    console.error('[Hourly Backup Email Error]:', error);
    return { success: false, error: error?.message || 'Error al enviar el respaldo horario por correo' };
  }
}

// Backward-compatible alias for existing imports
export const sendDailyBackupEmail = sendHourlyBackupEmail;
