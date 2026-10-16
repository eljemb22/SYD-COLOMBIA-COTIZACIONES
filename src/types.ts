export type MarginListKey =
  | 'L1'
  | 'L2'
  | 'L2_5'
  | 'L3'
  | 'L3_5'
  | 'L4'
  | 'L4_5'
  | 'L5'
  | 'L6'
  | 'L7'
  | 'L8'
  | 'custom';

export type ProductGroup =
  | 'Equipos Médicos'
  | 'Equipos hospitalarios'
  | 'Instrumental Quirúrgico'
  | 'Muebles Hospitalarios'
  | 'Muebles hospitalarios'
  | 'Dispositivos Médicos'
  | 'Accesorios y Sensores'
  | string;

export interface SupplierPriceQuote {
  supplier: string;
  costCOP: number;
  costUSD?: number;
  date?: string;
  notes?: string;
}

export interface MedicalEquipment {
  id: string;
  code: string;
  name: string;
  brand: string;
  manufacturer?: string;
  productGroup?: ProductGroup;
  supplier?: string;
  allSuppliers?: string[];
  alternateSuppliers?: string[];
  supplierPrices?: SupplierPriceQuote[];
  model: string;
  category:
    | 'Monitoreo'
    | 'Cirugía'
    | 'Diagnóstico'
    | 'Quirófano'
    | 'Cuidados Críticos'
    | 'Cuidado Crítico'
    | 'Urgencias'
    | 'Ginecología'
    | 'Hospitalización'
    | 'Neonatología'
    | 'Esterilización'
    | 'Laboratorio'
    | 'Accesorios';
  baseCostCOP: number;
  baseCostUSD?: number;
  taxExempt?: boolean;
  taxRate?: number;
  defaultMarginList: MarginListKey;
  customFactor?: number;
  invimaRecordNumber: string;
  invimaExpiryDate?: string;
  invimaStatus?: 'Vigente' | 'En Renovación' | 'Vencido' | 'No Aplica';
  warrantyMonths: number;
  originCountry: string;
  description: string;
  subReferences?: string;
  technicalSpecs: string[];
  standardAccessories: { name: string; costCOP: number; included: boolean }[];
  imageUrl?: string;
  hasDocSheet: boolean;
  hasInvimaDoc: boolean;
  hasManual: boolean;
  hasQualityCert: boolean;
}

export interface QuoteItemAccessory {
  id: string;
  name: string;
  quantity: number;
  unitCostCOP: number;
  includedInBase: boolean;
}

export interface QuoteItem {
  id: string;
  equipmentId: string;
  code: string;
  name: string;
  brand: string;
  supplier?: string;
  supplierName?: string;
  productGroup?: ProductGroup;
  model: string;
  quantity: number;
  unitCostCOP: number;
  taxExempt?: boolean;
  taxRate?: number;
  marginType: MarginListKey;
  customFactor?: number;
  multiplier: number;
  unitSalePrice: number;
  totalCost: number;
  totalSalePrice: number;
  discountPercentage: number;
  warrantyMonths: number;
  notes: string;
  accessories: QuoteItemAccessory[];
  showSpecsInQuote: boolean;
  customSpecsOverride?: string;
  hasCeilingPrice?: boolean;
  ceilingPriceCOP?: number;
  isManualSalePrice?: boolean;
  manualSalePriceCOP?: number;
}

export interface QuoteHeader {
  quoteNumber: string;
  clientName: string;
  nit: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  city: string;
  date: string;
  validityDays: number;
  paymentTerms: string;
  deliveryTime: string;
  deliveryPlace: string;
  warrantyTerms: string;
  trainingTerms?: string;
  maintenanceTerms?: string;
  taxRate: number; // 0.19
  advisorName: string;
  advisorRole: string;
  advisorPhone: string;
  advisorEmail: string;
  notes: string;
}

export type QuoteStatus = 'Borrador' | 'Enviada' | 'Aprobada' | 'Rechazada' | 'Facturada';

export interface ClientRecord {
  id: string;
  name: string;
  nit?: string;
  city?: string;
  department?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  source?: 'cotizacion' | 'licitacion' | 'oc' | 'manual' | 'quote' | 'tender';
  createdAt?: string;
  updatedAt?: string;
}

export interface SavedQuote {
  id: string;
  quoteNumber: string;
  date: string;
  dateCode: string;
  clientName: string;
  nit: string;
  contactPerson: string;
  contactEmail: string;
  contactPhone: string;
  city: string;
  validityDays: number;
  paymentTerms: string;
  deliveryTime: string;
  deliveryPlace: string;
  warrantyTerms: string;
  trainingTerms: string;
  maintenanceTerms?: string;
  taxRate: number;
  advisorName: string;
  advisorRole: string;
  advisorPhone: string;
  advisorEmail: string;
  notes: string;
  items: QuoteItem[];
  subtotal: number;
  iva: number;
  total: number;
  totalQuantity: number;
  status: QuoteStatus;
  savedAt: string;
  updatedAt: string;
  letterheadUrl?: string | null;
  marginSettings?: {
    subirBajar: number;
    izqDer: number;
    tableScale: number;
  };
}

export interface TechnicalRequirement {
  id: string;
  requirement: string;
  isUnique?: boolean; // Característica Única / Diferencial Exclusivo
  uniqueNote?: string;
  hasWorkRange?: boolean; // Especificación con Rango de Trabajo
  workRange?: string; // Ej: "50 a 100 lpm", "10 a 270 mmHg", "10 a 1500 ml"
  rangeMin?: string;
  rangeMax?: string;
  rangeUnit?: string;
  offeredSpec?: string;
  complies?: boolean;
  folioRef?: string;
}

export interface TenderItem {
  id: string;
  itemNumber: number;
  equipmentId: string;
  code: string;
  name: string;
  brand: string;
  supplier?: string;
  supplierName?: string;
  productGroup?: ProductGroup;
  model: string;
  originCountry: string;
  quantity: number;
  unitEstimatedBudget: number;
  offeredUnitPrice: number;
  taxRate?: number; // IVA rate (0.19 default)
  invimaRecord: string;
  warrantyMonths: number;
  deliveryTimeDays: number;
  requirements: TechnicalRequirement[];
  selected: boolean;
  observations: string;
}

export interface TenderHeader {
  entityName: string;
  clientName?: string;
  nit?: string;
  processNumber: string;
  processType: string;
  contractObject: string;
  openingDate: string;
  closingDate: string;
  city: string;
  budgetCOP: number;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  executionTerm?: string; // Tiempo o Plazo de Ejecución del Contrato (ej: "30 días calendario", "6 meses")
  isDirectClientOC?: boolean; // True si es Orden de Compra Directa del cliente
  clientOrderNumber?: string; // N° de OC del cliente si es directa
  linkedQuoteId?: string;
  linkedQuoteNumber?: string;
  linkedQuoteTotal?: number;
  linkedQuoteDate?: string;
}

export interface TenderClientProject {
  id: string;
  clientName: string;
  nit: string;
  header: TenderHeader;
  items: TenderItem[];
  status: 'En Preparación' | 'Presentada' | 'Adjudicada' | 'Desierta' | 'Cerrada' | 'Cumplido / Archivado';
  linkedQuoteId?: string;
  linkedQuoteNumber?: string;
  linkedQuoteTotal?: number;
  createdAt: string;
  updatedAt: string;
}

export type TechnicalDocumentType =
  | 'Ficha Técnica'
  | 'Registro INVIMA'
  | 'Manual de Usuario'
  | 'Manual de Servicio'
  | 'Guía Rápida'
  | 'Certificado Calidad'
  | 'Otro Anexo';

export interface TechnicalDocument {
  id: string;
  equipmentId?: string;
  equipmentName: string;
  equipmentCode?: string;
  docType: TechnicalDocumentType | string;
  title: string;
  fileName: string;
  fileSize: string;
  fileData?: string;
  fileType?: string;
  fileUrl?: string; // Link de descarga en la nube (Google Drive, Dropbox, OneDrive, etc.)
  downloadUrl?: string;
  isCloudLink?: boolean;
  cloudProvider?: 'google_drive' | 'dropbox' | 'onedrive' | 'direct_link' | 'other';
  driveFileId?: string;
  uploadDate: string;
  status: 'Vigente' | 'En Trámite' | 'Vencido';
  invimaNumber?: string;
  validUntil?: string;
  notes?: string;
  uploadedBy?: string;
}

export interface DocumentMarginSettings {
  headerMarginTop: number; // Top margin / header height (px)
  footerMarginBottom: number; // Bottom margin / footer height (px)
  contentWidth: number; // Content width (%)
  sidePadding: number; // Left/Right padding (px)
  fontSize: number; // Base body font size (px)
  lineSpacing: number; // Line-height multiplier
  paperTheme: 'white' | 'dark' | 'sepia';
  headerType: 'official' | 'compact' | 'graphic';
  footerText: string;
  headerSubtitle: string;
  companyLogoUrl?: string;
}

export type ActiveTab =
  | 'inicio'
  | 'ventas'
  | 'costos'
  | 'catalogo'
  | 'licitaciones'
  | 'seguimiento_oc'
  | 'ordenes_venta'
  | 'documentacion'
  | 'historial'
  | 'gmail_compras';

export type UserRole = 'admin' | 'viewer';

export interface ViewerPermissions {
  canEditSales: boolean;
  canEditCostManager: boolean;
  canEditCatalog: boolean;
  canEditTenders: boolean;
  canManageOCTracking: boolean;
  canEditDocuments: boolean;
  canManageSalesOrders: boolean;
  canManageQuotesHistory: boolean;
  canManageSuppliers: boolean;
  canManageSerials: boolean;
  canManageCustomization: boolean;
  canExportData: boolean;
  canManageBackups: boolean;
  canAccessSqlAnalytics: boolean;
  canManageGmailPurchases: boolean;
}

export type SalesOrderStatus =
  | 'Borrador'
  | 'En Proceso'
  | 'Equipos en Bodega'
  | 'Entregada al Cliente'
  | 'Listo para Facturar'
  | 'Facturada'
  | 'Cancelada';

export type SalesOrderEquipmentStatus =
  | 'Pendiente de OC'
  | 'OC Solicitada a Proveedor'
  | 'En Bodega SYD'
  | 'Entregado al Cliente';

export interface SalesOrderItem {
  id: string;
  equipmentId?: string;
  code: string;
  name: string;
  brand: string;
  model: string;
  supplier?: string;
  supplierName?: string;
  quotedQuantity?: number;
  contractQuantity?: number;
  quantityToDispatch: number;
  unitSalePriceCOP: number;
  totalSalePriceCOP: number;
  equipmentStatus?: SalesOrderEquipmentStatus | string;
  assignedSerialNumbers?: string[];
  serialNumbers?: ItemSerialNumberRecord[];
  inventoryPlates?: string[];
  supplierOCRef?: string;
  linkedSupplierOCNumber?: string;
  notes?: string;
}

export interface AttachedSalesDoc {
  id?: string;
  name: string;
  size?: string;
  dataUrl: string; // Base64 data URL o link http(s) en la nube
  fileUrl?: string; // Link directo / Drive
  downloadUrl?: string;
  isCloudLink?: boolean;
  cloudProvider?: 'google_drive' | 'dropbox' | 'onedrive' | 'direct_link' | 'other';
  driveFileId?: string;
  type?: string;
  uploadedAt: string;
}

export interface SalesOrderRecord {
  id: string;
  salesOrderNumber: string; // ej: OV-2026-001 (editable manualmente)
  quoteId?: string;         // ID de cotización de origen
  quoteNumber?: string;     // Número de cotización (ej: COT-2026-08-25-01)
  contractId?: string;      // ID de contrato de licitación si aplica
  contractNumber?: string;  // Número o referencia del contrato (ej: LP-045-2026)
  tenderClientId?: string;  // ID del cliente de licitaciones si aplica
  clientName: string;
  clientNit: string;
  clientCity: string;
  clientAddress?: string;
  clientContactPerson?: string;
  clientContactPhone?: string;
  clientContactEmail?: string;
  orderDate?: string;       // Fecha de la Orden de Venta
  deliveryDate?: string;    // Fecha Estimada de Entrega
  dispatchDate?: string;    // Fecha de entrega / despacho estimada o real
  estimatedArrivalDate?: string;
  actualDeliveryDate?: string;
  carrierName?: string;
  trackingNumber?: string;
  vehiclePlate?: string;
  driverName?: string;
  driverPhone?: string;
  destinationHospitalService?: string;
  status: SalesOrderStatus;
  items: SalesOrderItem[];
  totalValueCOP: number;
  invoicedStatus: 'No Facturada' | 'Facturada Parcial' | 'Facturada Total';
  invoiceNumber?: string;   // Número(s) de Factura(s) Electrónica(s) emitida(s) (ej: FE-1045 o FE-1045, FE-1046)
  invoiceId?: string;       // ID de la última factura o factura vinculada
  invoiceIds?: string[];    // Lista de IDs de facturas asociadas
  invoiceDate?: string;     // Fecha de emisión de la factura
  totalInvoicedCOP?: number; // Monto acumulado total facturado en COP
  attachedInvoiceFile?: AttachedSalesDoc;     // Archivo PDF / imagen de la factura
  attachedDeliveryReceipt?: AttachedSalesDoc; // Acta de entrega o soporte opcional
  ocContractId?: string;    // ID del contrato/registro de compras en Ventana 5 (Seguimiento OC)
  hasLinkedOC?: boolean;    // Indica si ya se generaron las OCs a proveedores
  notes?: string;
  preparedBy?: string;
  createdAt: string;
  updatedAt: string;
  statusHistory?: {
    id: string;
    timestamp: string;
    user: string;
    status: string;
    note: string;
  }[];
}

export type SalesInvoicePaymentStatus =
  | 'Pendiente de Pago'
  | 'Radicada en Cliente'
  | 'Pagada / Cancelada'
  | 'Anulada';

export interface SalesInvoiceRecord {
  id: string;
  invoiceNumber: string;     // Número de Factura Electrónica SYD al cliente (ej: FE-1045)
  salesOrderId?: string;     // OV vinculada
  salesOrderNumber?: string; // Número de OV vinculada
  quoteId?: string;          // Cotización vinculada
  quoteNumber?: string;
  contractId?: string;       // Contrato / Licitación asociada si aplica
  contractNumber?: string;
  clientName: string;
  clientNit: string;
  clientCity?: string;
  clientAddress?: string;
  issueDate: string;         // Fecha de la Factura
  filingDate?: string;       // Fecha de Radicación opcional
  dueDate?: string;          // Fecha de Vencimiento
  paymentDate?: string;      // Fecha en que el cliente pagó
  subtotalCOP: number;
  taxRate?: number;
  taxAmountCOP?: number;
  totalAmountCOP: number;    // Valor total facturado en COP
  withholdingCOP?: number;
  netReceivableCOP?: number;
  paymentStatus: SalesInvoicePaymentStatus;
  paymentMethod?: string;
  attachedInvoiceFile?: AttachedSalesDoc;     // PDF o Imagen de la Factura de Venta
  attachedDeliveryActFile?: AttachedSalesDoc; // Acta de entrega opcional
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type OCStatus =
  | 'Borrador / Solicitud'
  | 'Emitida / Enviada al Proveedor'
  | 'Confirmada por Proveedor'
  | 'En Fabricación / Procesamiento'
  | 'En Tránsito / Despachada'
  | 'En Aduana / Nacionalización'
  | 'Equipos en Bodega'
  | 'En Ingreso Técnico'
  | 'Listo para Despacho'
  | 'Despachado al Cliente'
  | 'Entregado e Instalado'
  | 'Cerrado / Concluido'
  | 'Cancelada'
  | 'Pendiente de Pago'       // Compatibilidad hacia atrás
  | 'Pagado al Proveedor';     // Compatibilidad hacia atrás

export type OCPaymentTerms =
  | 'Crédito 30 días'
  | 'Crédito 60 días'
  | 'Crédito 90 días'
  | 'Contado / Anticipado (100%)'
  | '50% Anticipo - 50% Contra Entrega'
  | '30% Anticipo - 70% Contra Entrega'
  | 'Contra Entrega (100%)'
  | 'Carta de Crédito (L/C)'
  | 'Personalizado / Otro';

export type OCPaymentStatus =
  | 'Pendiente'
  | 'Anticipo Pagado'
  | 'En Trámite de Tesorería'
  | 'Crédito Vigente (Por Vencer)'
  | 'Pagado Total'
  | 'Vencido';

export interface OCStatusLogEntry {
  id: string;
  timestamp: string;
  previousStatus?: OCStatus | string;
  newStatus: OCStatus | string;
  user: string;
  note: string;
}

export interface IndividualSerialDoc {
  id: string;
  docType:
    | 'dian_import'
    | 'hoja_vida'
    | 'acta_entrega'
    | 'calibracion_electrica'
    | 'garantia'
    | 'invima_ref'
    | 'otro';
  title: string;
  fileName?: string;
  fileSize?: string;
  fileData?: string;
  fileType?: string;
  fileUrl?: string; // Link directo / Drive
  downloadUrl?: string;
  isCloudLink?: boolean;
  cloudProvider?: 'google_drive' | 'dropbox' | 'onedrive' | 'direct_link' | 'other';
  uploadDate: string;
  dianDeclarationNumber?: string;
  dianDate?: string;
  notes?: string;
}

export type SerialUnitStatus =
  | 'En Bodega'
  | 'En Pruebas Técnicas'
  | 'Listo para Despacho'
  | 'Despachado'
  | 'Entregado e Instalado';

export interface ItemSerialNumberRecord {
  id: string;
  identifierType?: 'serial' | 'lote' | 'na'; // Tipo: Serial individual, Lote o No Aplica
  serialNumber: string;              // S/N o N° de Lote del equipo
  inventoryPlate?: string;           // Placa de activo fijo / inventario del Hospital
  status: SerialUnitStatus;          // Estado operativo de la unidad
  dianDeclarationNumber?: string;    // N° de Declaración de Importación / Manifiesto DIAN
  dianImportDeclaration?: string;    // Alias para declaración aduanera DIAN
  dianDate?: string;                 // Fecha de la declaración aduanera
  dianDeclarationDate?: string;      // Alias para fecha DIAN
  receptionDate?: string;            // Fecha de llegada física a bodega
  inspectionDate?: string;           // Fecha de inspección biomédica y calibración
  deliveryDate?: string;             // Fecha de entrega al cliente
  technicianName?: string;           // Ingeniero Biomédico / Técnico responsable
  hospitalLocation?: string;         // Servicio o área hospitalaria (UCI, Urgencias, Quirófano, etc.)
  locationInHospital?: string;       // Alias para ubicación en hospital
  notes?: string;
  documents: IndividualSerialDoc[];  // Documentos individuales específicos de este serial
}

export interface OCTrackingItem {
  id: string;
  equipmentId?: string;
  code: string;
  name: string;
  brand: string;
  model: string;
  quantity: number;
  costPriceCOP: number;
  costPriceUSD?: number;
  totalCostCOP: number;
  supplier: string;          // Proveedor / Fabricante asignado
  supplierNit?: string;      // NIT / Tax ID del proveedor
  supplierContact?: string;  // Contacto o asesor
  ocNumber: string;          // Número de Orden de Compra
  status: OCStatus | string;
  paymentTerms?: OCPaymentTerms | string; // Forma de pago (Crédito, Contado, 50/50, etc.)
  paymentStatus: OCPaymentStatus | string; // Estado del pago
  invoiceNumber?: string;    // Factura Proveedor / Guía
  carrierName?: string;      // Transportadora
  trackingNumber?: string;   // Número de Guía
  estimatedDeliveryDate?: string;
  actualArrivalDate?: string;
  technicalInspectionDate?: string;
  dispatchDate?: string;
  clientDeliveryDate?: string;
  createdAt: string;
  lastUpdatedAt: string;     // ISO timestamp for 2-day alert computation
  notes: string;
  history: OCStatusLogEntry[];
  serialNumbers?: ItemSerialNumberRecord[]; // Seriales físicos y documentación individual
  serialNumber?: string;     // Serial principal o único
  assignedSerialNumbers?: string[]; // Seriales asignados en órdenes de venta
  deliveryDate?: string;     // Fecha de entrega
  installedDate?: string;    // Fecha de instalación
  receptionDate?: string;    // Fecha de recepción en bodega
  supplierInvoices?: SupplierInvoiceAttachment[]; // Facturas del proveedor anexadas
  salesOrderId?: string;     // ID de la Orden de Venta (OV)
  salesOrderNumber?: string; // N° Consecutivo de la Orden de Venta (ej: OV-2026-001)
  salesOrderItemId?: string; // ID del ítem en la Orden de Venta
}

export interface SupplierInvoiceAttachment {
  id: string;
  invoiceNumber: string;
  issueDate?: string;
  amountCOP?: number;
  fileName: string;
  fileData?: string; // base64 / data URL o link http(s)
  fileType?: string;
  fileSize?: number;
  fileUrl?: string; // Link directo / Drive
  downloadUrl?: string;
  isCloudLink?: boolean;
  cloudProvider?: 'google_drive' | 'dropbox' | 'onedrive' | 'direct_link' | 'other';
  notes?: string;
  supplier?: string;
  ocNumber?: string;
  uploadedAt: string;
  uploadedBy?: string;
}

export type OCLogisticsStatus = OCStatus | string;

export interface SupplierProfile {
  id: string;
  name: string;
  nit?: string;
  contactPerson?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  city?: string;
  address?: string;
  country?: string;
  brands?: string[];
  defaultPaymentTerms?: OCPaymentTerms | string;
  leadTimeDays?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPurchaseOrder {
  id: string;
  ocNumber: string;          // N° de OC al proveedor (ej: OC-2026-MINDRAY-01)
  supplier: string;          // Nombre del Proveedor / Fabricante
  supplierNit?: string;      // NIT o identificación
  supplierContact?: string;  // Contacto comercial
  supplierEmail?: string;
  supplierPhone?: string;
  paymentTerms: OCPaymentTerms | string; // Forma de pago (Crédito 30d, etc.)
  paymentStatus: OCPaymentStatus | string; // Estado de pago
  status: OCStatus | string; // Estado operativo / logístico de la OC
  invoiceNumber?: string;    // Factura emitida por el fabricante
  carrierName?: string;      // Transportadora
  trackingNumber?: string;   // Número de guía
  estimatedDeliveryDate?: string;
  actualArrivalDate?: string;
  notes?: string;
  createdAt: string;
  lastUpdatedAt: string;
  supplierInvoices?: SupplierInvoiceAttachment[];
  items: OCTrackingItem[];   // Equipos médicos solicitados a este proveedor
}

export interface OCTrackingContract {
  id: string;
  tenderClientId?: string;   // Link to TenderClientProject (Licitaciones Adjudicadas)
  quoteId?: string;          // Link to Quote if applicable
  quoteNumber?: string;
  salesOrderId?: string;     // Link to SalesOrderRecord (Ventana 7 - Órdenes de Venta)
  salesOrderNumber?: string;
  salesOrderIds?: string[];  // Lista de IDs de Órdenes de Venta vinculadas
  salesOrderNumbers?: string[]; // Lista de N° de Órdenes de Venta vinculadas (ej: ['OV-2024-001', 'OV-2024-002'])
  sourceType: 'licitacion_adjudicada' | 'cotizacion_aprobada' | 'orden_venta' | 'oc_directa' | 'manual';
  isDirectOC?: boolean;
  contractNumber: string;    // Proceso / Contrato / N° de OV / Referencia del Cliente
  ocNumber?: string;         // Número de Orden de Compra principal / de cliente
  supplier?: string;         // Proveedor principal o de referencia
  supplierNit?: string;      // NIT o identificación del proveedor
  supplierContact?: string;  // Contacto o asesor del proveedor
  clientName: string;
  nit: string;
  city: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  processType?: string;
  totalBudgetCOP?: number;
  totalCostCOP: number;
  items: OCTrackingItem[];   // Todos los equipos del contrato agrupados por OC/proveedor
  purchaseOrders?: SupplierPurchaseOrder[]; // OCs estructuradas por proveedor
  supplierInvoices?: SupplierInvoiceAttachment[]; // Facturas de proveedores
  globalStatus: OCStatus | string;
  paymentTerms?: OCPaymentTerms | string;
  paymentStatus?: OCPaymentStatus | string;
  createdAt: string;
  lastUpdatedAt: string;     // Timestamp for 2-day alert computation
  deliveryDate?: string;     // Fecha de entrega del contrato
  actualDeliveryDate?: string; // Fecha de entrega real
  invoiceNumber?: string;    // Factura vinculada
  attachedInvoiceFile?: any; // Factura adjunta
  notes?: string;
}

export interface AuthUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  department: string;
  avatarColor: string;
  avatarPhotoUrl?: string; // Real profile photo or custom uploaded avatar
  avatarType?: 'initials' | 'photo' | 'preset_doctor' | 'preset_engineer' | 'preset_specialist' | 'preset_executive';
  permissions?: ViewerPermissions;
  updatedAt?: string;
  _updatedAt?: string;
}

export interface StoredUserAccount extends AuthUser {
  password: string;
}

export type FontFamilyKey =
  | 'inter'
  | 'outfit'
  | 'plus_jakarta'
  | 'montserrat'
  | 'roboto'
  | 'jetbrains_mono'
  | 'playfair';

export type CanvasThemeKey =
  | 'navy_dark'      // Default Corporate Navy (#0f1a2e / #111c2e)
  | 'midnight_oled'  // Deep OLED Dark (#060910 / #0e1320)
  | 'slate_pro'      // Slate Titanium (#0f172a / #1e293b)
  | 'emerald_dark'   // Deep Medical Teal/Emerald (#041c18 / #092e28)
  | 'purple_night'   // Velvet Dark Purple (#140c24 / #20133a)
  | 'sapphire_deep'  // Deep Ocean Sapphire (#08142c / #0f2347)
  | 'crimson_dark'   // Deep Crimson / Velvet Red (#1f080c / #330e16)
  | 'carbon_dark'    // Minimal Carbon Graphite (#121212 / #1e1e1e)
  | 'amber_dark'     // Warm Amber & Espresso (#1c1208 / #2b1d0c)
  | 'clean_light'    // Titanium Clinical Light (#f1f5f9 / #ffffff)
  | 'custom';        // Fully custom background hex

export type AccentColorKey =
  | 'sky'      // #38bdf8
  | 'emerald'  // #10b981
  | 'indigo'   // #6366f1
  | 'violet'   // #a855f7
  | 'amber'    // #f59e0b
  | 'rose'     // #f43f5e
  | 'cyan'     // #06b6d4
  | 'crimson'  // #e11d48
  | 'gold'     // #eab308
  | 'teal'     // #14b8a6
  | 'custom';  // User custom hex

export type ButtonShapeKey = 'square' | 'soft' | 'rounded' | 'pill';
export type TextColorKey = 'pure_white' | 'platinum' | 'soft_cyan' | 'warm_gold' | 'custom';

export type TextContrastKey =
  | 'high_contrast' // Crisp Pure White
  | 'soft_platinum' // Gentle silver/gray
  | 'accent_tint';  // Headings tinted with accent color

export type FontSizeKey = 'compact' | 'normal' | 'comfortable';

export interface ThemeSettings {
  id: string;
  companyName: string;
  companySubtitle: string;
  companyLogoUrl?: string; // Custom logo URL or base64
  logoStyle: 'emblem_3d' | 'medical_cross' | 'shield_tech' | 'custom_image' | 'minimal';
  canvasTheme: CanvasThemeKey;
  customCanvasHex: string;
  accentColor: AccentColorKey;
  customAccentHex: string;
  buttonShape: ButtonShapeKey;
  buttonColor: AccentColorKey;
  customButtonHex: string;
  textColor: TextColorKey;
  customTextHex: string;
  fontFamily: FontFamilyKey;
  fontSize: FontSizeKey;
  textContrast: TextContrastKey;
  sidebarBackground: string;
  headerBackground: string;
  cardRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  enableAmbientGlow: boolean;
  enableGlassmorphism: boolean;
  updatedAt: string;
}

export interface BotActionOption {
  id?: string;
  label: string;
  type?: 'navigate' | 'modal' | 'query';
  tab?: ActiveTab;
  modalAction?:
    | 'new_equipment'
    | 'new_document'
    | 'new_quote'
    | 'user_management'
    | 'customization'
    | 'print_preview'
    | 'manage_suppliers'
    | 'new_oc'
    | 'alerts_widget'
    | 'app_updates'
    | 'backup_modal'
    | 'google_workspace_modal';
  queryPrompt?: string;
  primary?: boolean;
}

export interface BotChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  actions?: BotActionOption[];
  suggestedAction?: BotActionOption;
}

export interface UserChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRoleLabel: string;
  senderAvatarColor: string;
  recipientId: string; // 'general' or specific userId
  text: string;
  timestamp: string;
  quoteRef?: string;
  equipmentRef?: string;
  isRead?: boolean;
}

export type AlertSeverity = 'critica' | 'media' | 'informativa';

export type AlertCategory =
  | 'actualizacion_sistema'
  | 'costo_catalogo'
  | 'oc_retraso'
  | 'oc_pago'
  | 'licitacion_sin_oc'
  | 'ov_sin_oc'
  | 'invima_pendiente'
  | 'cotizacion_pendiente'
  | 'nueva_parte_drive';

export interface SystemAlertItem {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  category: AlertCategory;
  sourceModule:
    | 'Catálogo (Ventana 3)'
    | 'Licitaciones (Ventana 4)'
    | 'Seguimiento OC (Ventana 5)'
    | 'Cotizaciones (Ventana 2)'
    | 'Órdenes de Venta (OV)'
    | 'Google Drive / Sheets'
    | 'Actualizaciones (Sistema)';
  targetTab: ActiveTab;
  entityId?: string;
  entityName?: string;
  actionLabel?: string;
  createdAt?: string;
  details?: Record<string, any>;
}

// =========================================================================
// HOJAS DE VIDA DE EQUIPOS BIOMÉDICOS & CRONOGRAMA DE MANTENIMIENTO
// (Resolución 3100 de 2019 / Circular 029 MinSalud / INVIMA)
// =========================================================================

export interface MaintenanceIntervention {
  id: string;
  date: string;
  type: 'Preventivo' | 'Correctivo' | 'Calibración' | 'Inspección / Calificación' | 'Instalación';
  description: string;
  partsReplaced?: string;
  engineerName: string;
  professionalLicense?: string;
  status: 'Operativo' | 'En Observación' | 'Fuera de Servicio' | 'Requiere Repuesto';
  costCOP?: number;
  reportNumber?: string;
  notes?: string;
}

export interface EquipmentLifeSheetData {
  id: string;
  equipmentId?: string;
  formatCode: string;
  formatVersion: string;
  // 1. Identificación del Equipo
  institutionName: string;
  institutionNit?: string;
  departmentCity?: string;
  serviceLocation: string;
  equipmentName: string;
  brand: string;
  model: string;
  serialNumber: string;
  inventoryPlate: string;
  invimaRecord: string;
  riskClassification: 'Clase I' | 'Clase IIa' | 'Clase IIb' | 'Clase III';
  biomedicalClassification: 'Diagnóstico' | 'Tratamiento y Soporte de Vida' | 'Rehabilitación' | 'Monitoreo / Cuidados Intensivos' | 'Laboratorio Clínico';
  technologyType: 'Electromédico' | 'Mecánico / Neumático' | 'Óptico / Láser' | 'Electrónico Microprocesado' | 'Hidráulico';
  usefulLifeYears: number;

  // 2. Adquisición y Garantía
  acquisitionDate: string;
  installationDate: string;
  supplier: string;
  supplierPhone?: string;
  commercialValueCOP?: number;
  warrantyStatus: 'Vigente' | 'Vencida' | 'Extendida';
  warrantyExpiration: string;
  purchaseInvoiceOrOC?: string;

  // 3. Especificaciones Técnicas y Eléctricas
  voltageVolts: string;
  currentAmperes: string;
  frequencyHz: string;
  powerWatts: string;
  batteryType?: string;
  operatingPressure?: string;
  operatingTemperature?: string;
  humidityRange?: string;
  weightDimensions?: string;

  // 4. Protocolo de Mantenimiento y Metrología
  maintenanceFrequency: 'Trimestral' | 'Cuatrimestral' | 'Semestral' | 'Anual';
  requiresCalibration: boolean;
  calibrationFrequency?: 'Semestral' | 'Anual' | 'Bianual' | 'No Aplica';
  calibrationVariable?: string;
  manualsAvailable: {
    userManual: boolean;
    serviceManual: boolean;
    technicalSheet: boolean;
  };
  accessoriesIncluded: string;

  // 5. Historial de Intervenciones
  interventions: MaintenanceIntervention[];

  // 6. Firmas y Responsables
  biomedicalEngineerName: string;
  biomedicalEngineerTitle: string;
  biomedicalEngineerLicense: string;
  maintenanceManagerName: string;
  maintenanceManagerTitle: string;

  // 7. Metadatos & Personalización
  imageUrl?: string;
  logoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type ScheduleMonthStatus = 'P' | 'E' | 'C' | 'A' | null;

export interface MaintenanceScheduleItem {
  id: string;
  equipmentId?: string;
  equipmentName: string;
  brand: string;
  model: string;
  serialNumber: string;
  inventoryPlate: string;
  serviceArea: string;
  riskClass: string;
  frequency: 'Trimestral' | 'Cuatrimestral' | 'Semestral' | 'Anual';
  requiresCalibration: boolean;
  responsibleSupplier: string;
  months: Record<number, ScheduleMonthStatus>; // key: 1..12
}

export interface AnnualMaintenanceSchedule {
  id: string;
  year: number;
  institutionName: string;
  nit: string;
  responsibleName: string;
  responsibleTitle: string;
  items: MaintenanceScheduleItem[];
  createdAt: string;
  updatedAt: string;
}

export type MaintenanceFrequencyType =
  | 'Mensual'
  | 'Bimestral'
  | 'Trimestral'
  | 'Cuatrimestral'
  | 'Semestral'
  | 'Anual';

export interface ClientScheduleItem {
  id: string;
  equipmentId?: string;
  equipmentName: string;
  brand: string;
  model: string;
  serialNumber: string;
  inventoryPlate: string;
  serviceArea: string;
  // The 4 requested dimensions
  preventiveMaintenance: string;
  preventiveFrequency: MaintenanceFrequencyType;
  correctiveMaintenance: string;
  training: string;
  status?: 'Programado' | 'En Proceso' | 'Ejecutado / Al Día';
}

export interface ClientMaintenanceSchedule {
  id: string;
  clientId: string;
  clientName: string;
  clientNit: string;
  city: string;
  contractNumber: string;
  sourceType: 'licitacion_adjudicada' | 'oc_directa' | 'ambas';
  year: number;
  items: ClientScheduleItem[];
  createdAt: string;
  updatedAt: string;
}

