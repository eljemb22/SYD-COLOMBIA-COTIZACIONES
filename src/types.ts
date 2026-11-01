// SYD Colombia - Tipos Globales Oficiales del Sistema

export type ActiveTab =
  | 'inicio'
  | 'ventas'
  | 'historial'
  | 'costos'
  | 'catalogo'
  | 'licitaciones'
  | 'documentacion'
  | 'seguimiento_oc'
  | 'ordenes_venta'
  | 'gmail_compras'
  | 'herramientas';

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
  canManageGoogleWorkspace: boolean;
  canQuoteEmergencyParts: boolean;
  canSplitSalesOrders: boolean;
}

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  roleLabel: string;
  department: string;
  avatarColor?: string;
  permissions?: ViewerPermissions;
}

export interface StoredUserAccount extends AuthUser {
  password?: string;
  createdAt?: string;
  lastLogin?: string;
}

export type CanvasThemeKey =
  | 'dark_original'
  | 'light_modern'
  | 'navy_dark'
  | 'midnight_oled'
  | 'slate_pro'
  | 'emerald_dark'
  | 'purple_night'
  | 'sapphire_deep'
  | 'crimson_dark'
  | 'amber_dark'
  | 'carbon_dark'
  | 'clean_light'
  | 'custom';

export type AccentColorKey =
  | 'sky'
  | 'emerald'
  | 'indigo'
  | 'violet'
  | 'amber'
  | 'rose'
  | 'cyan'
  | 'crimson'
  | 'gold'
  | 'teal'
  | 'custom';

export type ButtonShapeKey = 'square' | 'soft' | 'rounded' | 'pill';

export type TextColorKey =
  | 'pure_white'
  | 'platinum'
  | 'soft_cyan'
  | 'warm_gold'
  | 'slate'
  | 'white'
  | 'cyan'
  | 'custom';

export type FontFamilyKey =
  | 'plus_jakarta'
  | 'inter'
  | 'outfit'
  | 'montserrat'
  | 'roboto'
  | 'jetbrains_mono'
  | 'playfair'
  | 'sans'
  | 'mono'
  | 'serif';

export type FontSizeKey = 'compact' | 'normal' | 'comfortable' | 'sm' | 'md' | 'lg';

export interface ThemeSettings {
  id?: string;
  companyName?: string;
  companySubtitle?: string;
  companyLogoUrl?: string;
  logoStyle?: string;
  canvasTheme: CanvasThemeKey;
  customCanvasHex?: string;
  accentColor: AccentColorKey;
  customAccentHex?: string;
  buttonShape: ButtonShapeKey;
  buttonColor?: string;
  customButtonHex?: string;
  textColor: TextColorKey;
  customTextHex?: string;
  fontFamily: FontFamilyKey;
  fontSize: FontSizeKey;
  textContrast?: string;
  sidebarBackground?: string;
  headerBackground?: string;
  cardRadius?: string;
  enableAmbientGlow?: boolean;
  enableGlassmorphism?: boolean;
  standbyTimeoutMinutes?: number;
  updatedAt?: string;
}

export type ProductGroup =
  | 'Equipos hospitalarios'
  | 'Instrumental quirúrgico'
  | 'Mobiliario clínico'
  | 'Monitoreo y diagnóstico'
  | 'Cuidado crítico'
  | 'Neonatología'
  | 'Accesorios y consumibles'
  | 'Otros';

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

export interface SupplierPriceQuote {
  supplierName: string;
  priceCOP: number;
  priceUSD?: number;
  contactName?: string;
  phone?: string;
  email?: string;
  validUntil?: string;
  notes?: string;
  updatedAt?: string;
}

export interface MedicalEquipment {
  id: string;
  code: string;
  name: string;
  brand: string;
  model: string;
  category: string;
  productGroup?: ProductGroup | string;
  supplier?: string;
  allSuppliers?: string[];
  alternateSuppliers?: string[];
  supplierPrices?: Record<string, number>;
  baseCostCOP: number;
  baseCostUSD?: number;
  defaultMarginList?: MarginListKey | string;
  taxExempt?: boolean;
  taxRate?: number;
  invimaRecordNumber?: string;
  invimaStatus?: string;
  invimaExpiryDate?: string;
  warrantyMonths?: number;
  originCountry?: string;
  description: string;
  technicalSpecs: string[];
  standardAccessories?: string[];
  subReferences?: string[];
  hasDocSheet?: boolean;
  hasInvimaDoc?: boolean;
  hasManual?: boolean;
  hasQualityCert?: boolean;
  image?: string;
  imageUrl?: string;
  sourceOrigin?: string;
  createdAt?: string;
  updatedAt?: string;
  isInactive?: boolean;
  inactivationReason?: string;
  replacementPartCode?: string;
  replacedPartCode?: string;
}

export interface QuoteItemAccessory {
  id: string;
  name: string;
  quantity: number;
  unitCostCOP?: number;
  unitSalePriceCOP?: number;
  notes?: string;
}

export interface QuoteItem {
  id: string;
  equipmentId?: string;
  code?: string;
  name: string;
  brand: string;
  model: string;
  description?: string;
  briefDescription?: string;
  technicalFeatures?: string[];
  quantity: number;
  unitCostCOP: number;
  totalCost: number;
  multiplier: number;
  customFactor?: number;
  marginType: MarginListKey | string;
  unitSalePrice: number;
  totalSalePrice: number;
  taxExempt?: boolean;
  taxRate?: number;
  discountPercentage?: number;
  warrantyMonths?: number;
  serialNumber?: string;
  notes?: string;
  imageUrl?: string;
  isManualSalePrice?: boolean;
  manualSalePriceCOP?: number;
  hasCeilingPrice?: boolean;
  ceilingPriceCOP?: number;
  accessories?: QuoteItemAccessory[];
  originCountry?: string;
  isEmergencyUncreated?: boolean;
  pendingCatalogId?: string;
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
  trainingTerms: string;
  maintenanceTerms: string;
  warrantyTerms: string;
  taxRate: number;
  advisorName: string;
  advisorRole: string;
  advisorPhone: string;
  advisorEmail: string;
  notes: string;
  formatStyle?: 'standard' | 'with-images';
}

export type QuoteStatus = 'Borrador' | 'Enviada' | 'Aprobada' | 'Perdida' | 'Cancelada';

export interface SavedQuote {
  id: string;
  quoteNumber: string;
  date?: string;
  dateCode?: string;
  clientName?: string;
  nit?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  city?: string;
  validityDays?: number;
  paymentTerms?: string;
  deliveryTime?: string;
  deliveryPlace?: string;
  warrantyTerms?: string;
  trainingTerms?: string;
  maintenanceTerms?: string;
  taxRate?: number;
  advisorName?: string;
  advisorRole?: string;
  advisorPhone?: string;
  advisorEmail?: string;
  notes?: string;
  formatStyle?: 'standard' | 'with-images';
  header?: QuoteHeader;
  items: QuoteItem[];
  subtotal: number;
  iva: number;
  total: number;
  totalQuantity: number;
  status: QuoteStatus;
  createdAt?: string;
  updatedAt?: string;
  savedAt?: string;
  letterheadUrl?: string | null;
  marginSettings?: { subirBajar: number; izqDer: number; tableScale: number };
}

export interface Quote {
  id: string;
  consecutive: string;
  clientName: string;
  clientNit: string;
  clientEmail: string;
  clientCity: string;
  date: string;
  validUntil: string;
  items: QuoteItem[];
  subtotal: number;
  ivaTotal: number;
  total: number;
  currency: 'COP' | 'USD';
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  notes?: string;
}

export interface ClientRecord {
  id: string;
  name: string;
  nit: string;
  email: string;
  phone?: string;
  city: string;
  address?: string;
  contactPerson?: string;
  department?: string;
  lastQuotedAt?: string;
}

export type Client = ClientRecord;

export interface TechnicalRequirement {
  id: string;
  requirement: string;
  compliance: boolean;
  response: string;
  weight?: number;
  sourceDocPage?: number;
  category?: string;
}

export interface TenderItem {
  id: string;
  itemNumber: number | string;
  equipmentId?: string;
  code?: string;
  partNumber?: string;
  name: string;
  description?: string;
  brand: string;
  model: string;
  quantity: number;
  unitBudgetCOP?: number;
  totalBudgetCOP?: number;
  unitOfferCOP?: number;
  totalOfferCOP?: number;
  unitPriceCOP?: number;
  warrantyMonths?: number;
  requirements: TechnicalRequirement[];
  compliancePercentage?: number;
  invoicedStatus?: string;
  invoicedNumber?: string;
  notes?: string;
  accessories?: string[];
}

export interface TenderHeader {
  entityName: string;
  processNumber: string;
  processType: string;
  contractObject: string;
  openingDate: string;
  closingDate: string;
  city: string;
  budgetCOP: number;
  executionTerm?: string;
  nit?: string;
  clientName?: string;
  isDirectClientOC?: boolean;
  clientOrderNumber?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  linkedQuoteId?: string;
  linkedQuoteNumber?: string;
  linkedQuoteTotal?: number;
  linkedQuoteDate?: string;
}

export interface TenderClientProject {
  id: string;
  clientName: string;
  nit?: string;
  header: TenderHeader;
  items: TenderItem[];
  status: 'borrador' | 'en_evaluacion' | 'adjudicado' | 'no_adjudicado' | 'terminado' | 'Adjudicada' | string;
  createdAt: string;
  updatedAt: string;
  linkedQuoteId?: string;
  linkedQuoteNumber?: string;
  linkedQuoteTotal?: number;
  linkedQuoteDate?: string;
  notes?: string;
}

export type OCStatus =
  | 'Pendiente'
  | 'Borrador / Solicitud'
  | 'Emitida / Enviada al Proveedor'
  | 'Confirmada por Proveedor'
  | 'En Fabricación / Procesamiento'
  | 'En Tránsito / Despachada'
  | 'En Tránsito'
  | 'En Aduana'
  | 'En Aduana / Nacionalización'
  | 'Nacionalizado'
  | 'En Bodega SYD'
  | 'Equipos en Bodega SYD'
  | 'En Ingreso Técnico & Calidad'
  | 'Listo para Despacho a Cliente'
  | 'Despachado al Cliente'
  | 'Entregado a Cliente'
  | 'Entregado e Instalado'
  | 'Cerrado / Concluido'
  | 'Cancelado'
  | 'Cancelada'
  | (string & {});

export type OCLogisticsStatus = OCStatus;
export type OCPaymentTerms = 'Anticipo 50/50' | '100% Anticipado' | 'Contraentrega' | 'Crédito 30 días' | 'Crédito 60 días';
export type OCPaymentStatus = 'Pendiente' | 'Anticipo Pagado' | 'Pagada 100%' | 'En Mora';

export interface OCStatusLogEntry {
  id: string;
  status: OCStatus;
  date: string;
  notes?: string;
  user?: string;
}

export type SerialUnitStatus = 'en_bodega' | 'entregado' | 'en_mantenimiento' | 'baja';

export interface IndividualSerialDoc {
  id: string;
  docType: string;
  title: string;
  fileUrl?: string;
  fileData?: string;
  uploadedAt: string;
}

export interface ItemSerialNumberRecord {
  id: string;
  serialNumber: string;
  lotNumber?: string;
  status: SerialUnitStatus;
  deliveryDate?: string;
  installationDate?: string;
  warrantyEndDate?: string;
  clientLocation?: string;
  responsibleStaff?: string;
  individualDocs?: IndividualSerialDoc[];
  notes?: string;
}

export interface OCTrackingItem {
  id: string;
  equipmentId?: string;
  code?: string;
  description: string;
  name?: string;
  brand: string;
  model: string;
  supplier: string;
  supplierNit?: string;
  quantity: number;
  unitCostCOP: number;
  totalCostCOP: number;
  unitCostUSD?: number;
  costPriceCOP?: number;
  status: OCStatus;
  estimatedDeliveryDate?: string;
  actualDeliveryDate?: string;
  carrierTrackingNumber?: string;
  carrierName?: string;
  serialNumbers?: string[];
  serialNumber?: string;
  serializedUnits?: ItemSerialNumberRecord[];
  salesOrderId?: string;
  salesOrderNumber?: string;
  salesOrderItemId?: string;
  ocNumber?: string;
  notes?: string;
  lastUpdatedAt?: string;
  invoiceNumber?: string;
  paymentStatus?: string;
  paymentTerms?: string;
  history?: any[];
}

export interface OCTrackingContract {
  id: string;
  tenderClientId?: string;
  salesOrderId?: string;
  salesOrderNumber?: string;
  quoteId?: string;
  quoteNumber?: string;
  contractNumber: string;
  supplierName: string;
  supplier?: string;
  supplierNit?: string;
  clientName: string;
  nit?: string;
  city?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  date: string;
  items: OCTrackingItem[];
  totalAmountCOP: number;
  totalBudgetCOP?: number;
  paymentTerms: OCPaymentTerms | string;
  paymentStatus: OCPaymentStatus;
  statusLogs: OCStatusLogEntry[];
  invoiceNumber?: string;
  attachedInvoiceFile?: any;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierPurchaseOrder extends OCTrackingContract {}
export interface SupplierOrder extends OCTrackingContract {
  ocNumber?: string;
}

export interface SupplierProfile {
  id: string;
  name: string;
  nit?: string;
  contactName?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  city?: string;
  address?: string;
  country?: string;
  brandsRepresented?: string[];
  brands?: string[];
  productCategories?: string[];
  paymentTerms?: string;
  defaultPaymentTerms?: string;
  deliveryLeadDays?: number;
  notes?: string;
  isPreferred?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type SalesOrderStatus =
  | 'Borrador'
  | 'Confirmada'
  | 'En Proceso'
  | 'En Despacho'
  | 'Entregada'
  | 'Entregada Parcial'
  | 'Entregada Total'
  | 'Facturada'
  | 'Cancelada';

export type SalesOrderEquipmentStatus = 'Pendiente' | 'Asignado' | 'Despachado' | 'Instalado';

export interface AttachedSalesDoc {
  id: string;
  name: string;
  type: string;
  data?: string;
  url?: string;
  uploadedAt: string;
}

export interface SalesOrderItem {
  id: string;
  equipmentId?: string;
  code?: string;
  name: string;
  brand: string;
  model: string;
  quantity?: number;
  quotedQuantity?: number;
  quantityToDispatch?: number;
  unitSalePriceCOP: number;
  totalSalePriceCOP: number;
  equipmentStatus: SalesOrderEquipmentStatus | string;
  supplier?: string;
  supplierName?: string;
  paymentStatus?: string;
  supplierOCRef?: string;
  linkedSupplierOCNumber?: string;
  supplier?: string;
  preferredSupplier?: string;
  assignedSerialNumbers?: any[];
  serialNumbers?: string[];
  invoiceNumber?: string;
  deliveryDate?: string;
  actualDeliveryDate?: string;
  installedDate?: string;
  notes?: string;
  transferredFromOV?: string;
  transferredAt?: string;
}

export interface SalesOrderRecord {
  id: string;
  salesOrderNumber: string;
  quoteId?: string;
  quoteNumber?: string;
  contractNumber?: string;
  contractId?: string;
  ocContractId?: string;
  tenderClientId?: string;
  clientName: string;
  clientNit?: string;
  clientCity?: string;
  city?: string;
  orderDate: string;
  estimatedDeliveryDate?: string;
  actualDeliveryDate?: string;
  status: SalesOrderStatus;
  invoicedStatus?: string;
  items: SalesOrderItem[];
  subtotalCOP: number;
  taxCOP: number;
  totalCOP: number;
  totalValueCOP?: number;
  hasLinkedOC?: boolean;
  attachedDocs?: AttachedSalesDoc[];
  remisionNumber?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  attachedInvoiceFile?: any;
  notes?: string;
  renewedFromSalesOrderNumber?: string;
  renewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type SalesInvoicePaymentStatus = 'Pendiente Radicación' | 'Radicada en Cliente' | 'Pagada' | 'Vencida';

/**
 * Item-level allocation of a sales invoice. One invoice may cover only part of
 * the equipment of an OV; the OV is archived only when every unit is invoiced.
 */
export interface SalesInvoiceItemAllocation {
  salesOrderItemId: string;
  equipmentId?: string;
  code?: string;
  name: string;
  quantity: number;
  unitPriceCOP: number;
  totalCOP: number;
}

export interface SalesInvoiceRecord {
  id: string;
  invoiceNumber: string;
  salesOrderId?: string;
  salesOrderNumber?: string;
  contractNumber?: string;
  clientName: string;
  clientNit?: string;
  issueDate: string;
  dueDate?: string;
  totalAmountCOP: number;
  subtotalCOP?: number;
  taxCOP?: number;
  paymentStatus: SalesInvoicePaymentStatus;
  items?: any[];
  attachedInvoiceFile?: any;
  radicadoProofDoc?: any;
  items?: SalesInvoiceItemAllocation[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierInvoiceAttachment {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  amountCOP: number;
  issueDate: string;
  fileUrl?: string;
  fileData?: string;
  notes?: string;
}

export type TechnicalDocumentType =
  | 'ficha_tecnica'
  | 'registro_invima'
  | 'manual_usuario'
  | 'manual_servicio'
  | 'certificado_calidad'
  | 'hoja_de_vida'
  | 'protocolo_mantenimiento'
  | 'otro';

export interface TechnicalDocument {
  id: string;
  equipmentId?: string;
  equipmentCode?: string;
  equipmentName?: string;
  equipmentBrand?: string;
  equipmentModel?: string;
  type: TechnicalDocumentType;
  title: string;
  fileName?: string;
  fileUrl?: string;
  fileData?: string;
  driveFileId?: string;
  driveFolderName?: string;
  mimeType?: string;
  sizeBytes?: number;
  version?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface EquipmentLifeSheetData {
  id: string;
  equipmentId: string;
  institutionName: string;
  serviceArea: string;
  location: string;
  serialNumber: string;
  inventoryNumber: string;
  riskClass: 'I' | 'IIa' | 'IIb' | 'III';
  biomedicalClassification: string;
  acquisitionDate: string;
  installationDate: string;
  warrantyExpiryDate: string;
  acquisitionCostCOP: number;
  powerSupply: string;
  operatingVoltage: string;
  currentConsumption: string;
  frequency: string;
  operatingTech: string;
  maintenanceFrequency: 'Trimestral' | 'Cuatrimestral' | 'Semestral' | 'Anual';
  calibrationFrequency: 'Semestral' | 'Anual' | 'No Requiere';
  lastPreventiveDate?: string;
  nextPreventiveDate?: string;
  supplierName: string;
  supplierPhone: string;
  supplierEmail: string;
}

export type MaintenanceFrequencyType = 'Semestral' | 'Cuatrimestral' | 'Trimestral' | 'Anual';
export type ScheduleMonthStatus = 'none' | 'scheduled' | 'executed' | 'pending';

export interface MaintenanceIntervention {
  id: string;
  month: number;
  type: 'preventivo' | 'correctivo' | 'calibracion' | 'capacitacion';
  status: 'programado' | 'realizado' | 'cancelado';
  date?: string;
  engineerName?: string;
  reportNumber?: string;
  notes?: string;
}

export interface MaintenanceScheduleItem {
  id: string;
  equipmentId: string;
  equipmentName: string;
  serialNumber: string;
  brand: string;
  model: string;
  location: string;
  monthsStatus: Record<number, ScheduleMonthStatus>;
  interventions: MaintenanceIntervention[];
}

export interface AnnualMaintenanceSchedule {
  id: string;
  contractId: string;
  year: number;
  frequency: MaintenanceFrequencyType;
  items: MaintenanceScheduleItem[];
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type AlertSeverity = 'critica' | 'media' | 'informativa';

export interface SystemAlertItem {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  category: 'garantia' | 'mantenimiento' | 'aduana' | 'facturacion' | 'actualizacion_sistema' | 'general';
  actionLabel?: string;
  actionTab?: ActiveTab;
  relatedEntityId?: string;
  timestamp: number;
}

/**
 * Historial de precios de un equipo (para consultar cómo ha variado el costo/venta con el tiempo)
 */
export interface PriceHistoryEntry {
  id: string;
  equipmentName: string;
  brand: string;
  model: string;
  unitCostCOP: number;
  unitSalePriceCOP: number;
  marginPercent: number;
  quoteNumber: string;
  quoteDate: string;
  clientName: string;
}

/**
 * Alerta de garantía por vencer
 */
export interface WarrantyAlert {
  id: string;
  equipmentName: string;
  brand: string;
  model: string;
  serialNumber?: string;
  clientName: string;
  warrantyEndDate: string;
  daysRemaining: number;
  severity: 'critica' | 'media' | 'baja';
  quoteNumber?: string;
}

/**
 * Firma digital para cotizaciones
 */
export interface DigitalSignature {
  id: string;
  dataUrl: string; // base64 image
  signedAt: string;
  signerName: string;
  signerRole?: string;
}

/**
 * Resumen de rentabilidad por proyecto/cotización
 */
export interface ProfitabilitySummary {
  quoteNumber: string;
  clientName: string;
  totalCostCOP: number;
  totalSalePriceCOP: number;
  totalProfitCOP: number;
  marginPercent: number;
  items: ProfitabilityItem[];
}

export interface ProfitabilityItem {
  equipmentName: string;
  brand: string;
  model: string;
  quantity: number;
  unitCostCOP: number;
  unitSalePriceCOP: number;
  totalCostCOP: number;
  totalSalePriceCOP: number;
  profitCOP: number;
  marginPercent: number;
}

/**
 * Pliego técnico generado para licitación
 */
export interface TechnicalTenderSpec {
  id: string;
  tenderNumber: string;
  entityName: string;
  equipmentItems: TenderEquipmentSpec[];
  generalTerms: string;
  generatedAt: string;
}

export interface TenderEquipmentSpec {
  itemNumber: number;
  name: string;
  brand: string;
  model: string;
  quantity: number;
  technicalDescription: string;
  keyFeatures: string[];
  complianceRequirements: string[];
}

export type BotActionType =
  | 'navigate'
  | 'modal'
  | 'query'
  | 'execute'
  | 'auto';

export interface BotActionOption {
  label: string;
  type?: BotActionType;
  action?: string;
  tab?: ActiveTab;
  primary?: boolean;
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
  payload?: any;
  autoExecute?: boolean;
  confirmationRequired?: boolean;
  description?: string;
}

export interface BotChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  actions?: BotActionOption[];
}

export interface UserChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  recipientId?: string;
  text: string;
  timestamp: string;
}
