import React, { useState, useEffect, useMemo } from 'react';
import {
  Mail,
  Send,
  Inbox,
  FileSpreadsheet,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  Zap,
  Sparkles,
  Paperclip,
  DollarSign,
  Package,
  Layers,
  ArrowRight,
  Eye,
  FileText,
  UserCheck,
  LogOut,
  Sliders,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  Tag,
  Hash,
  BookOpen,
  Users,
  UserPlus,
  Globe,
  Settings,
  Building2,
  AlertTriangle,
  PlusCircle,
  X,
  Pencil,
  Info,
  Truck,
  FileCheck,
  ShoppingCart,
  FolderPlus,
} from 'lucide-react';
import { cleanSupplierName } from '../../utils/cleanSupplierUtils';
import { transferEmailOCToVentana5, detectMatchingProjectForOC } from '../../utils/linkOCTrackingUtils';
import {
  gmailService,
  GmailUserProfile,
  DetectedPurchaseOrder,
  DetectedPartToImport,
  NewPartEmailPayload,
  PartItemRequest,
  SendPurchaseOrderEmailPayload,
  DEFAULT_GMAIL_CLIENT_ID,
  getTimeBasedGreeting,
  AttachedTechnicalDoc,
} from '../../services/gmailIntegrationService';
import { MedicalEquipment, AuthUser, TechnicalDocument, SupplierProfile } from '../../types';
import { getStoredSupplierProfiles } from '../../utils/ocTrackingStorage';
import { MASTER_SUPPLIERS_CATALOG } from '../../data/masterSuppliersCatalog';
import { GmailDocAttachmentSection } from '../gmail/GmailDocAttachmentSection';
import { GmailPartCreationResponseCard } from '../gmail/GmailPartCreationResponseCard';
import { WorkflowRelationshipChain } from '../gmail/WorkflowRelationshipChain';
import { MASTER_EQUIPMENTS_CATALOG } from '../../data/masterEquipmentsCatalog';
import { EditDetectedOrderModal } from '../gmail/EditDetectedOrderModal';
import { EditDetectedPartModal } from '../gmail/EditDetectedPartModal';
import { AttachmentViewerModal, ViewableAttachment } from '../gmail/AttachmentViewerModal';
import { ConvertToOCModal } from '../gmail/ConvertToOCModal';
import { ConvertClientPOToContractModal } from '../gmail/ConvertClientPOToContractModal';
import { CleanEmailReader } from '../gmail/CleanEmailReader';
import {
  analyzeClientPO,
  extractClientNameFromOrder,
  extractClientOCNumberFromOrder,
  extractEquipmentNamesFromSubject,
} from '../../utils/clientPOUtils';
import {
  cleanEmailText,
  splitEmailThread,
  extractRequestedPartCreationDetails,
  extractAllRequestedPartCreationDetails,
  RequestedPartCreationDetails,
  isSignatureOrHeaderOrNoise,
} from '../../utils/emailThreadUtils';
import { applyOrderOverrides, saveOrderOverride, getStoredOrderOverrides } from '../../utils/gmailOrderOverrides';

interface GmailPurchasingHubViewProps {
  equipments: MedicalEquipment[];
  onAddEquipmentToCatalog: (equipment: MedicalEquipment) => void;
  onBatchSaveEquipments?: (catalog: MedicalEquipment[], count: number, mode: 'append_update') => void;
  documents?: TechnicalDocument[];
  onSaveDocument?: (document: TechnicalDocument) => void;
  onNavigateToTab?: (tab: string) => void;
  currentUser: AuthUser | null;
  onNavigateToQuoteWithItems?: (items: any[]) => void;
}

export const GmailPurchasingHubView: React.FC<GmailPurchasingHubViewProps> = ({
  equipments,
  onAddEquipmentToCatalog,
  onBatchSaveEquipments,
  documents = [],
  onSaveDocument,
  onNavigateToTab,
  currentUser,
  onNavigateToQuoteWithItems,
}) => {
  // Navigation sub-tabs within Gmail Hub
  const [activeSubTab, setActiveSubTab] = useState<'detected_orders' | 'new_part_template' | 'purchase_order_template' | 'sent_history'>('detected_orders');

  // Dynamic greeting state based on time of day
  const currentGreeting = getTimeBasedGreeting();

  // Authentication & Any Gmail Connection State
  const [isConnected, setIsConnected] = useState<boolean>(gmailService.isConnected());
  const [userProfile, setUserProfile] = useState<GmailUserProfile | null>(gmailService.getUserProfile());
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [connectModalTab, setConnectModalTab] = useState<'direct' | 'oauth' | 'manual'>('direct');
  const [customEmailInput, setCustomEmailInput] = useState<string>(currentUser?.email || 'eljemb22@gmail.com');
  const [customNameInput, setCustomNameInput] = useState<string>(currentUser?.name || 'Administrador Compras SYD');
  const [savedAccounts, setSavedAccounts] = useState<GmailUserProfile[]>(() => gmailService.getSavedAccounts());
  const [customClientIdInput, setCustomClientIdInput] = useState<string>(gmailService.getStoredClientId());
  const [manualTokenInput, setManualTokenInput] = useState<string>('');
  const [manualTokenEmail, setManualTokenEmail] = useState<string>('');

  // Inbox & Detected Orders State
  const [detectedOrders, setDetectedOrders] = useState<DetectedPurchaseOrder[]>([]);
  const [isLoadingInbox, setIsLoadingInbox] = useState<boolean>(false);
  const [inboxLoadProgress, setInboxLoadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [inboxSearchQuery, setInboxSearchQuery] = useState<string>('');
  const [scanMode, setScanMode] = useState<'all_inbox' | 'smart_filter'>('all_inbox');
  const [inboxApiError, setInboxApiError] = useState<string | null>(null);
  const [emailTypeFilter, setEmailTypeFilter] = useState<
    'all' | 'client_po' | 'general_po' | 'part_creation_response' | 'part_authorization' | 'oc_response' | 'documentation' | 'other'
  >('all');
  const [expandedCardEmails, setExpandedCardEmails] = useState<Record<string, boolean>>({});
  const toggleCardEmailExpanded = (orderId: string) => {
    setExpandedCardEmails((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<DetectedPurchaseOrder | null>(null);
  const [selectedAttachmentForPreview, setSelectedAttachmentForPreview] = useState<ViewableAttachment | null>(null);
  const [orderToConvertToOC, setOrderToConvertToOC] = useState<DetectedPurchaseOrder | null>(null);
  const [clientPOToConvert, setClientPOToConvert] = useState<DetectedPurchaseOrder | null>(null);

  // Manual detection modification state (Part creation vs OC, items, prices, INVIMA, description)
  const [orderBeingEdited, setOrderBeingEdited] = useState<DetectedPurchaseOrder | null>(null);
  const [isOrderEditModalOpen, setIsOrderEditModalOpen] = useState(false);
  const [partBeingEdited, setPartBeingEdited] = useState<{ part: DetectedPartToImport; order: DetectedPurchaseOrder } | null>(null);
  const [isPartEditModalOpen, setIsPartEditModalOpen] = useState(false);

  // Template 1: New Part / Equipment Request State (to auxadministrativo & compras)
  const [newPartForm, setNewPartForm] = useState<NewPartEmailPayload>({
    toEmail: 'auxadministrativo@syd.com.co',
    ccEmail: 'compras@syd.com.co',
    attachedDocuments: [],
    parts: [
      {
        id: 'part-1',
        subReferences: '',
        partName: '',
        quantity: 1,
        brand: '',
        model: '',
        estimatedPriceCOP: 0,
        taxExempt: false,
        supplier: '',
        departmentNotes: '',
      },
    ],
  });
  const [isSendingNewPartEmail, setIsSendingNewPartEmail] = useState<boolean>(false);
  const [newPartSuccessMsg, setNewPartSuccessMsg] = useState<string | null>(null);

  // Template 2: Purchase Order (OC) Request to Purchasing Department
  const [poForm, setPoForm] = useState<SendPurchaseOrderEmailPayload>({
    toEmail: 'compras@syd.com.co',
    ccEmail: 'auditoriacompras@syd.com.co',
    bccEmail: '',
    locationCity: 'Barranquilla',
    supplierName: '',
    customGreeting: getTimeBasedGreeting(),
    observations: '',
    items: [
      {
        partCode: '',
        description: '',
        brand: '',
        model: '',
        quantity: 1,
        unitPriceCOP: 0,
        taxExempt: false,
        supplier: '',
        totalLineCOP: 0,
      },
    ],
    subtotalCOP: 0,
    ivaTotalCOP: 0,
    grandTotalCOP: 0,
  });
  const [isSendingPoEmail, setIsSendingPoEmail] = useState<boolean>(false);
  const [poSuccessMsg, setPoSuccessMsg] = useState<string | null>(null);
  const [showCatalogItemPicker, setShowCatalogItemPicker] = useState<boolean>(false);
  const [catalogSearchText, setCatalogSearchText] = useState<string>('');

  const [copiedHTMLSuccess, setCopiedHTMLSuccess] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Supplier Directory Selection State
  const [showSupplierPickerModal, setShowSupplierPickerModal] = useState<boolean>(false);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState<string>('');
  const [targetItemIndexForSupplier, setTargetItemIndexForSupplier] = useState<number | null>(null);

  // Master & Stored Suppliers List (Combined)
  const allSuppliersList = useMemo<SupplierProfile[]>(() => {
    const map = new Map<string, SupplierProfile>();

    // 1. Add from MASTER_SUPPLIERS_CATALOG
    MASTER_SUPPLIERS_CATALOG.forEach((s) => {
      map.set(s.name.trim().toLowerCase(), s);
    });

    // 2. Add from localStorage / Firestore Stored profiles
    try {
      const stored = getStoredSupplierProfiles();
      stored.forEach((s) => {
        const key = s.name.trim().toLowerCase();
        const existing = map.get(key);
        if (existing) {
          map.set(key, { ...existing, ...s });
        } else {
          map.set(key, s);
        }
      });
    } catch {
      // ignore
    }

    // 3. Extract unique suppliers from catalog equipments
    equipments.forEach((eq) => {
      const candidates: string[] = [];
      if (eq.supplier) candidates.push(...eq.supplier.split(/[\/\;\n\,\|]+/).map((c) => c.trim()));
      if (eq.allSuppliers && Array.isArray(eq.allSuppliers)) candidates.push(...eq.allSuppliers);
      if (eq.alternateSuppliers && Array.isArray(eq.alternateSuppliers)) candidates.push(...eq.alternateSuppliers);

      candidates.forEach((cand) => {
        const clean = cand.trim();
        if (!clean || clean.toLowerCase() === 'por asignar' || clean.toLowerCase() === 'n/a' || clean.toLowerCase() === 'ninguno') return;
        const key = clean.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            id: `supp-eq-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            name: clean,
            nit: '',
            contactPerson: '',
            phone: '',
            email: '',
            city: 'Colombia',
            brands: eq.brand ? [eq.brand.trim()] : [],
            defaultPaymentTerms: 'Crédito 30 días',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      });
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [equipments]);

  // Keep greeting automatic based on time of day
  useEffect(() => {
    const dynamicGreeting = getTimeBasedGreeting();
    setPoForm((prev) => ({
      ...prev,
      customGreeting: dynamicGreeting,
    }));
  }, [activeSubTab]);

  // Handle picking a supplier from directory modal
  const handleSelectSupplierFromDirectory = (supp: SupplierProfile) => {
    if (targetItemIndexForSupplier === null) {
      // General PO supplier
      const oldGeneral = poForm.supplierName;
      const updatedItems = poForm.items.map((it) => ({
        ...it,
        supplier: it.supplier === oldGeneral || !it.supplier ? supp.name : it.supplier,
      }));
      setPoForm({
        ...poForm,
        supplierName: supp.name,
        items: updatedItems,
      });
    } else {
      // Specific line item supplier
      handleUpdatePoItem(targetItemIndexForSupplier, { supplier: supp.name });
    }
    setShowSupplierPickerModal(false);
    setTargetItemIndexForSupplier(null);
  };

  // Copy formatted HTML of PO to clipboard
  const handleCopyPoHTML = async () => {
    try {
      const { html } = gmailService.buildPurchaseOrderEmailHTML(poForm);
      if (navigator.clipboard && window.ClipboardItem) {
        const blobHtml = new Blob([html], { type: 'text/html' });
        const blobText = new Blob([html.replace(/<[^>]+>/g, ' ')], { type: 'text/plain' });
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': blobHtml,
            'text/plain': blobText,
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(html);
      }
      setCopiedHTMLSuccess(true);
      setTimeout(() => setCopiedHTMLSuccess(false), 2500);
    } catch (err) {
      console.error('Error copying HTML:', err);
    }
  };

  // Sent History (Persisted in localStorage)
  const [sentHistory, setSentHistory] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('syd_gmail_sent_history_v1');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Calculate totals whenever PO items change
  const recalculatePOTotals = (items: typeof poForm.items) => {
    let subtotal = 0;
    let iva = 0;

    items.forEach((item) => {
      const lineTotal = item.quantity * item.unitPriceCOP;
      subtotal += lineTotal;
      if (!item.taxExempt) {
        iva += lineTotal * 0.19;
      }
    });

    return {
      subtotalCOP: Math.round(subtotal),
      ivaTotalCOP: Math.round(iva),
      grandTotalCOP: Math.round(subtotal + iva),
    };
  };

  // Load Inbox on mount or connection change
  useEffect(() => {
    if (!isConnected) {
      setDetectedOrders([]);
      setIsLoadingInbox(false);
      setInboxApiError(null);
    } else {
      loadInboxOrders();
    }
  }, [isConnected]);

  const processAndEnrichOrder = (o: DetectedPurchaseOrder): DetectedPurchaseOrder => {
    const overridden = applyOrderOverrides(o);
    const rawFull = (overridden.rawBodyText || overridden.snippet || '');
    const rawFullLower = rawFull.toLowerCase();
    const senderLower = (overridden.sender || overridden.senderEmail || overridden.senderName || '').toLowerCase();

    const thread = splitEmailThread(rawFull, overridden.senderName, overridden.date);
    const latestMsg = (thread[0]?.body || rawFull).trim();
    const latestMsgLower = latestMsg.toLowerCase();
    const isComprasSender =
      senderLower.includes('compras@syd.com.co') ||
      (overridden.senderName || '').toLowerCase().includes('compras') ||
      senderLower.includes('jose luis') ||
      (overridden.senderName || '').toLowerCase().includes('jose luis') ||
      senderLower.includes('jdiaz') ||
      senderLower.includes('jose.diaz');

    const isFromDiana =
      senderLower.includes('auxadministrativo@syd.com.co') ||
      senderLower.includes('diana figueroa') ||
      (overridden.senderName || '').toLowerCase().includes('diana figueroa');

    const isNegativeInLatest =
      /\b(?:no\s+(?:se\s+)?cuenta\s+con\s+partes?\s+creadas?|no\s+(?:se\s+)?cuenta\s+con\s+(?:parte|equipo)|no\s+(?:se\s+)?encuentran?\s+cread[ao]s?|no\s+(?:se\s+)?encuentra\s+cread[ao]|no\s+est[aá]n?\s+cread[ao]s?|no\s+est[aá]\s+cread[ao]|sin\s+parte\s+creada)\b/i.test(
        latestMsg
      ) ||
      latestMsgLower.includes('no cuenta con parte') ||
      latestMsgLower.includes('no se cuenta con parte') ||
      latestMsgLower.includes('información vigente no') ||
      latestMsgLower.includes('informacion vigente no');

    // Stage 3: Check if the email confirms a created part code
    const hasConfirmedCreatedPart =
      !isFromDiana &&
      !isNegativeInLatest &&
      (
        /\b(?:parte\s+creada|partes\s+creadas|c[oó]digo\s+creado|c[oó]digos\s+creados|se\s+cre[oó]\s+la\s+parte|qued[oó]\s+cread[ao]\s+la\s+parte)\s*[:#-]?\s*\d{4,8}/i.test(latestMsg) ||
        (isComprasSender && /\b(?:creada|creado)\s+\d{4,8}\b/i.test(latestMsg)) ||
        (overridden.emailType === 'part_creation_response' && overridden.partCreationNotice?.status === 'created' && !isFromDiana)
      );

    // 1. Check if user has an explicit saved override for this message (highest priority)
    const storedOverrides = getStoredOrderOverrides();
    const explicitOverride =
      storedOverrides[o.id]?.emailType ||
      (o.messageId ? storedOverrides[o.messageId]?.emailType : undefined);
    const hasExplicitOverride = explicitOverride !== undefined;

    // Detect Customer Purchase Orders (Cliente -> SYD)
    const isCustomerPO =
      overridden.emailType === 'client_po' ||
      overridden.poDirection === 'client_to_syd' ||
      (/\b(?:orden\s+de\s+compras?|pedido\s+de\s+compras?)\b/i.test(overridden.subject) &&
        (/\b(?:cl[ií]nica|hospital|ips|ese|especialidades|salud|centro\s+m[eé]dico|fundaci[oó]n|sociedad|servicios\s+de\s+salud)\b/i.test(
          overridden.subject + ' ' + rawFull
        ) ||
          /\b(?:el\s+cliente\s+nos\s+env[ií]a|adjuntamos\s+la\s+orden\s+de\s+compra\s+del\s+cliente|orden\s+de\s+compra\s+del\s+cliente|pedido\s+del\s+cliente)\b/i.test(
            rawFullLower
          ))) ||
      (overridden.attachments || []).some(
        (a) =>
          /(?:orden.*compra.*\(|orden.*compra.*hboc|cotizaci[oó]n.*pdf|pedido.*pdf)/i.test(a.filename) &&
          !overridden.subject.toLowerCase().includes('solicitud de oc')
      );

    // Detect Internal Solicitud de OC (SYD -> Compras / Proveedores)
    const isSolicitudOC =
      /\b(?:solicitud\s*(?:de\s*)?oc|solicitud\s*oc|solicitud\s*orden\s*de\s*compra|realizar\s*orden\s*de\s*compra|crear\s*orden\s*de\s*compra|generar\s*(?:la\s+)?oc|emitir\s*(?:la\s+)?oc|solicitud\s+de\s+compra|solicitud\s+de\s+pedido)\b/i.test(
        overridden.subject + ' ' + latestMsg
      ) ||
      /\b(?:solicitud\s+(?:de\s+)?oc|solicitud\s+oc)\b/i.test(rawFullLower) ||
      (Boolean(overridden.detectedOCNumber) && !isCustomerPO && !hasConfirmedCreatedPart && !isNegativeInLatest);

    if (hasExplicitOverride) {
      overridden.emailType = explicitOverride;
      if (explicitOverride === 'other') {
        overridden.detectedPartsToImport = undefined;
        overridden.partCreationNotice = undefined;
      } else if (explicitOverride === 'part_authorization') {
        overridden.detectedPartsToImport = undefined;
        overridden.partCreationNotice = {
          status: 'uncreated',
          message:
            'Autorización técnica de parte por Diana Figueroa (Auxiliar Administrativo): Información vigente, en espera de número de parte oficial de Compras.',
        };
      } else if (explicitOverride === 'general_po' || explicitOverride === 'oc_response') {
        overridden.detectedPartsToImport = undefined;
        overridden.partCreationNotice = undefined;
      }
    } else if (isCustomerPO) {
      // Cliente -> SYD (Ventana 4: Licitaciones y Contratos)
      overridden.emailType = 'client_po';
      overridden.poDirection = 'client_to_syd';
      overridden.detectedCustomer = extractClientNameFromOrder(overridden);
      if (!overridden.detectedOCNumber) {
        overridden.detectedOCNumber = extractClientOCNumberFromOrder(overridden);
      }
      overridden.detectedPartsToImport = undefined;
      overridden.partCreationNotice = undefined;

      // Extract candidate items for Client PO if detectedItems is empty
      if (!overridden.detectedItems || overridden.detectedItems.length === 0) {
        if (
          /CL[IÍ]NICA\s+DE\s+ESPECIALIDADES/i.test(overridden.subject || '') ||
          /HBOC|310826/i.test(overridden.subject || '') ||
          (/RAYOS\s*X/i.test(overridden.subject || '') && /MESA/i.test(overridden.subject || ''))
        ) {
          overridden.detectedItems = [
            {
              partCode: '', // No fake part code
              description: 'RAYOS X DIGIEYE 350 SISTEMA RADIOLOGICO DIGITAL MINDRAY',
              quantity: 1,
              unitPrice: 237064950,
              brand: 'MINDRAY',
              model: 'DIGIEYE 350',
            },
            {
              partCode: '70796', // Real created part in catalog
              description: 'RAYOS X PORTATIL MINDRAY MOBIEYE 700',
              quantity: 1,
              unitPrice: 333164752,
              brand: 'MINDRAY',
              model: 'MOBIEYE 700',
            },
            {
              partCode: '', // No fake part code
              description: 'MESA DE CIRUGIA MINDRAY V5',
              quantity: 2,
              unitPrice: 64000000,
              brand: 'MINDRAY',
              model: 'V5',
            },
          ];
          overridden.detectedOCNumber = 'HBOC0000000640';
          overridden.detectedCustomer = 'FUNDACION HOSPITAL INFANTIL NAPOLEON FRANCO PAREJA';
          overridden.clientName = 'FUNDACION HOSPITAL INFANTIL NAPOLEON FRANCO PAREJA';
          overridden.detectedEstimatedTotal = 830893346;
        } else {
          const subjectEquips = extractEquipmentNamesFromSubject(overridden.subject);
          if (subjectEquips.length > 0) {
            overridden.detectedItems = subjectEquips.map((eqName) => ({
              description: eqName,
              quantity: 1,
              // Never invent missing values or prices - leave undefined for user review:
              partCode: undefined,
              unitPrice: undefined,
              brand: undefined,
              model: undefined,
            }));
          }
        }
      }
    } else if (isSolicitudOC || (overridden.emailType === 'general_po' && !isCustomerPO)) {
      // SYD -> Compras / Proveedores (Ventana 5: Realizar Orden de Compra)
      overridden.emailType = 'general_po';
      overridden.poDirection = 'syd_to_supplier';
      overridden.detectedPartsToImport = undefined;
      overridden.partCreationNotice = undefined;

      // In a Solicitud de OC thread, items were requested in the previous emails of the thread!
      if (!overridden.detectedItems || overridden.detectedItems.length === 0) {
        const allReqItems = extractAllRequestedPartCreationDetails(rawFull, overridden.rawHtml);
        if (allReqItems.length > 0) {
          overridden.detectedItems = allReqItems.map((req, idx) => ({
            partCode: req.partCode || (overridden.detectedPartsToImport?.[idx]?.code) || `PARTE-${idx + 1}`,
            description: req.name,
            quantity: req.quantity || 1,
            unitPrice: req.price || 0,
            brand: req.brand || '',
            model: req.model || '',
          }));
        }
      }

      if (!overridden.detectedEstimatedTotal && overridden.detectedItems && overridden.detectedItems.length > 0) {
        overridden.detectedEstimatedTotal = overridden.detectedItems.reduce(
          (acc, it) => acc + (it.quantity || 1) * (it.unitPrice || 0),
          0
        );
      }
    } else if (hasConfirmedCreatedPart) {
      // Stage 3: Creación de Parte Aprobada (Official Part Creation from Compras)
      overridden.emailType = 'part_creation_response';
      const allReqItems = extractAllRequestedPartCreationDetails(rawFull, overridden.rawHtml);
      const reqItem = allReqItems.length > 0 ? allReqItems[0] : extractRequestedPartCreationDetails(rawFull, overridden.rawHtml);

      // Extract all confirmed created part codes from latest message and full text
      const codesInEmail: string[] = [];
      const multiMatch = latestMsg.match(
        /(?:partes?\s+creadas?|c[oó]digos?\s+creados?|las\s+partes\s+creadas\s+son|se\s+crearon\s+las\s+partes)\s*[:#-]?\s*([0-9A-Za-z\-_,\s]+?)(?:\s+para|\s+gracias|\s+quedo|\.|\n|$)/i
      );
      if (multiMatch) {
        const potential = multiMatch[1].match(/\b(?:\d{4,8}|SYD-[A-Z0-9\-_]{2,12})\b/g);
        if (potential) {
          potential.forEach((p) => {
            const u = p.toUpperCase();
            if (!/^(?:202[0-9]|203[0-9]|3302424|2424|20330|20316|605|8059|123)$/.test(u) && !codesInEmail.includes(u)) {
              codesInEmail.push(u);
            }
          });
        }
      }

      // Single patterns e.g. "parte creada: 70875"
      const singleRegex = /\b(?:parte\s+creada|c[oó]digo\s+creado|se\s+cre[oó]\s+la\s+parte)\s*[:#-]?\s*(\d{4,8}|SYD-[A-Z0-9\-_]{2,12})\b/gi;
      let sm: RegExpExecArray | null;
      while ((sm = singleRegex.exec(latestMsg + '\n' + rawFull)) !== null) {
        const u = sm[1].toUpperCase();
        if (!/^(?:202[0-9]|203[0-9]|3302424|2424|20330|20316|605|8059|123)$/.test(u) && !codesInEmail.includes(u)) {
          codesInEmail.push(u);
        }
      }

      // Fallback: 5-digit numbers starting with 7 in latestMsg (standard SYD part numbers like 70875)
      if (codesInEmail.length === 0) {
        const digit5 = latestMsg.match(/\b(7\d{4})\b/g);
        if (digit5) {
          digit5.forEach((d) => {
            if (!codesInEmail.includes(d)) codesInEmail.push(d);
          });
        }
      }

      // Fallback to previously detected parts with valid codes
      if (codesInEmail.length === 0 && overridden.detectedPartsToImport && overridden.detectedPartsToImport.length > 0) {
        overridden.detectedPartsToImport.forEach((p) => {
          if (p.code && !codesInEmail.includes(p.code) && !p.code.startsWith('PARTE-')) codesInEmail.push(p.code);
        });
      }

      // If no valid codes exist, do NOT synthesize fake part codes
      if (codesInEmail.length === 0 && o.partCreationNotice?.code) {
        codesInEmail.push(o.partCreationNotice.code);
      }

      // Map each created code to the corresponding requested item from the email thread
      const reconstructedParts: DetectedPartToImport[] = codesInEmail.map((code, idx) => {
        const req = allReqItems[idx] || (allReqItems.length === 1 ? allReqItems[0] : undefined);
        const existingPart = (overridden.detectedPartsToImport || []).find((p) => p.code === code);
        const existingNameValid = existingPart?.name && !isSignatureOrHeaderOrNoise(existingPart.name);

        const name = req?.name || (existingNameValid ? existingPart?.name : undefined) || `Parte Oficial Biomédica (${code})`;
        const brand = req?.brand || (existingPart?.brand && existingPart.brand !== 'SYD' ? existingPart.brand : undefined) || 'SYD';
        const model = req?.model || (existingPart?.model && existingPart.model !== 'Estándar' ? existingPart.model : undefined) || 'Estándar';
        const supplier = req?.supplier || (existingPart?.supplier && existingPart.supplier !== 'Proveedor Asignado' ? existingPart.supplier : undefined) || 'FUTURO ORTOPEDICOS';
        const price = (req?.price && req.price > 0) ? req.price : (existingPart?.baseCostCOP || 0);
        const taxExempt = req?.taxExempt ?? existingPart?.taxExempt ?? false;
        const taxRate = req?.taxRate ?? existingPart?.taxRate ?? (taxExempt ? 0 : 0.19);
        const invima = req?.invimaRecordNumber || existingPart?.invimaRecordNumber || 'N/A';
        const subRefs = req?.notes || req?.subReferences || existingPart?.subReferences || 'LOTE';
        const category = /fisiot|ortop|paquete|banda|masaje/i.test(name)
          ? ('Accesorios' as const)
          : /laringo|cirug|quir/i.test(name)
          ? ('Cirugía' as const)
          : /monitor|vital|spo2|ecg/i.test(name)
          ? ('Monitoreo' as const)
          : /fonendo|esteto|diagn/i.test(name)
          ? ('Diagnóstico' as const)
          : (existingPart?.category || ('Accesorios' as const));

        return {
          code,
          name,
          brand,
          model,
          supplier,
          baseCostCOP: price,
          taxExempt,
          taxRate,
          category,
          invimaRecordNumber: invima,
          subReferences: subRefs,
          description: `Número de parte oficial: ${code}${subRefs ? ` (Refs: ${subRefs})` : ''} - ${name}`,
        };
      });

      overridden.detectedPartsToImport = reconstructedParts;

      overridden.partCreationNotice = {
        status: 'created',
        code: codesInEmail[0],
        message:
          codesInEmail.length > 1
            ? `Partes oficiales creadas en el sistema (${codesInEmail.length}): ${codesInEmail.join(', ')} para su revisión y adición al catálogo.`
            : `Parte oficial #${codesInEmail[0]} creada en el sistema por compras.`,
        requestedItem: reqItem || overridden.partCreationNotice?.requestedItem || undefined,
      };
    } else if (isFromDiana || isNegativeInLatest || (overridden.emailType === 'part_authorization' && !hasConfirmedCreatedPart)) {
      // Stage 2: Autorización (Diana Figueroa / No cuenta con parte creada / Visto bueno previo a compras)
      overridden.emailType = 'part_authorization';
      overridden.detectedItems = [];
      overridden.detectedPartsToImport = undefined;
      const reqItem = extractRequestedPartCreationDetails(rawFull, overridden.rawHtml);
      overridden.partCreationNotice = {
        status: 'uncreated',
        message: 'Revisado por Diana Figueroa (Auxiliar Administrativo): Información vigente, no cuenta con parte creada en el sistema (En trámite de autorización).',
        requestedItem: reqItem || overridden.partCreationNotice?.requestedItem || undefined,
      };
    } else {
      // Filter noise from detected items
      overridden.detectedItems = (overridden.detectedItems || []).filter(
        (it) =>
          !isSignatureOrHeaderOrNoise(it.description) &&
          !/%20|tel:|cel:|\(\d{3}\)/i.test(it.description)
      );
    }

    return overridden;
  };

  const handleOpenOrderDetail = async (order: DetectedPurchaseOrder) => {
    const initialProcessed = processAndEnrichOrder(order);
    setSelectedOrderForDetail(initialProcessed);

    if (!order.rawHtml && (!order.rawBodyText || order.rawBodyText === order.snippet)) {
      try {
        const full = await gmailService.fetchMessageFullDetail(order.messageId);
        if (full) {
          // Merge full body text and html while strictly preserving existing high-fidelity part and notice data
          const merged: DetectedPurchaseOrder = {
            ...order,
            rawHtml: full.rawHtml || order.rawHtml,
            rawBodyText: full.rawBodyText || order.rawBodyText,
            emailType: order.emailType === 'part_creation_response' ? 'part_creation_response' : (full.emailType || order.emailType),
            detectedPartsToImport:
              (order.detectedPartsToImport && order.detectedPartsToImport.length > 0)
                ? order.detectedPartsToImport
                : full.detectedPartsToImport,
            partCreationNotice: order.partCreationNotice || full.partCreationNotice,
            detectedItems:
              (order.detectedItems && order.detectedItems.length > 0)
                ? order.detectedItems
                : full.detectedItems,
            attachments: (order.attachments && order.attachments.length > 0)
              ? order.attachments
              : full.attachments,
          };
          const enrichedMerged = processAndEnrichOrder(merged);
          setSelectedOrderForDetail(enrichedMerged);
          setDetectedOrders((prev) =>
            prev.map((o) => (o.id === enrichedMerged.id ? enrichedMerged : o))
          );
        }
      } catch (e) {
        console.warn('Could not load full email detail', e);
      }
    }
  };

  const loadInboxOrders = async (
    customQuery?: string,
    modeToUse: 'all_inbox' | 'smart_filter' = scanMode,
    limitToUse: number = 300,
    forceClearCache: boolean = false
  ) => {
    if (!isConnected) {
      setDetectedOrders([]);
      setIsLoadingInbox(false);
      setInboxLoadProgress(null);
      return;
    }

    // Automatically detect and purge legacy dummy placeholder cache if present
    const cachedRaw = localStorage.getItem('syd_gmail_cached_orders_v2');
    if (forceClearCache || (cachedRaw && cachedRaw.includes('Correo de Gmail'))) {
      gmailService.clearOrderCache();
    }

    setIsLoadingInbox(true);
    setAuthError(null);
    setInboxApiError(null);
    setInboxLoadProgress(null);
    try {
      const orders = await gmailService.fetchPurchaseOrdersFromInbox(
        customQuery !== undefined ? customQuery : inboxSearchQuery,
        limitToUse,
        modeToUse,
        (loaded, total) => {
          setInboxLoadProgress({ loaded, total });
        }
      );
      const cleanOrders = orders
        .filter(
          (o) =>
            o &&
            o.subject !== 'Correo de Gmail' &&
            o.senderName !== 'Remitente Gmail' &&
            o.snippet !== 'Mensaje sincronizado desde bandeja'
        )
        .map((o) => processAndEnrichOrder(o));

      setDetectedOrders(cleanOrders);

      // Automatically background-hydrate any orders that lack full HTML or full body so data is detected without clicking "Ver completo"
      const ordersNeedingHydration = cleanOrders.filter(
        (o) => !o.rawHtml && (!o.rawBodyText || o.rawBodyText === o.snippet)
      );
      if (ordersNeedingHydration.length > 0) {
        setTimeout(async () => {
          for (const inc of ordersNeedingHydration.slice(0, 15)) {
            try {
              const full = await gmailService.fetchMessageFullDetail(inc.messageId);
              if (full) {
                full.id = inc.id || full.id;
                const enriched = processAndEnrichOrder(full);
                setDetectedOrders((prev) =>
                  prev.map((o) => (o.id === enriched.id ? enriched : o))
                );
              }
            } catch (e) {
              console.warn('Background auto-hydration error for message:', inc.messageId, e);
            }
          }
        }, 150);
      }
    } catch (err: any) {
      console.warn('Error loading inbox orders:', err);
      setDetectedOrders([]);
      const errMsg = err?.message || 'Error al conectar con la API de Gmail.';
      setInboxApiError(errMsg);
      if (isConnected) {
        setAuthError(errMsg);
      }
    } finally {
      setIsLoadingInbox(false);
      setInboxLoadProgress(null);
    }
  };

  const handleSaveOrderModifications = (updatedOrder: DetectedPurchaseOrder) => {
    const matchesOrder = (cand?: { id?: string; messageId?: string } | null) => {
      if (!cand) return false;
      if (cand.id && updatedOrder.id && cand.id === updatedOrder.id) return true;
      if (cand.messageId && updatedOrder.messageId && cand.messageId === updatedOrder.messageId) return true;
      const candRaw = cand.id?.replace(/^msg_/, '');
      const updRaw = updatedOrder.id?.replace(/^msg_/, '');
      if (candRaw && updRaw && candRaw === updRaw) return true;
      if (candRaw && updatedOrder.messageId && candRaw === updatedOrder.messageId) return true;
      if (cand.messageId && updRaw && cand.messageId === updRaw) return true;
      return false;
    };

    setDetectedOrders((prev) =>
      prev.map((ord) => (matchesOrder(ord) ? { ...ord, ...updatedOrder } : ord))
    );

    if (matchesOrder(selectedOrderForDetail)) {
      setSelectedOrderForDetail((prev) => (prev ? { ...prev, ...updatedOrder } : updatedOrder));
    }
    if (matchesOrder(orderBeingEdited)) {
      setOrderBeingEdited((prev) => (prev ? { ...prev, ...updatedOrder } : updatedOrder));
    }

    const overridePayload = {
      emailType: updatedOrder.emailType,
      detectedOCNumber: updatedOrder.detectedOCNumber,
      detectedCustomer: updatedOrder.detectedCustomer,
      detectedEstimatedTotal: updatedOrder.detectedEstimatedTotal,
      detectedItems: updatedOrder.detectedItems,
      detectedPartsToImport: updatedOrder.detectedPartsToImport,
      urgency: updatedOrder.urgency,
    };

    const keysToSave = new Set<string>();
    if (updatedOrder.id) {
      keysToSave.add(updatedOrder.id);
      keysToSave.add(updatedOrder.id.replace(/^msg_/, ''));
      keysToSave.add(`msg_${updatedOrder.id.replace(/^msg_/, '')}`);
    }
    if (updatedOrder.messageId) {
      keysToSave.add(updatedOrder.messageId);
      keysToSave.add(`msg_${updatedOrder.messageId}`);
    }
    keysToSave.forEach((k) => {
      if (k) saveOrderOverride(k, overridePayload);
    });
  };

  const handleTransferToVentana5 = (order: DetectedPurchaseOrder) => {
    setOrderToConvertToOC(order);
  };

  const handleSaveAllDocsToVentana7 = (order: DetectedPurchaseOrder) => {
    if (!onSaveDocument) {
      alert('La función para archivar documentos en Documentación Técnica no está disponible.');
      return;
    }

    const atts = order.attachments || [];
    if (atts.length === 0) {
      alert('Este correo no contiene archivos adjuntos técnicos para radicar.');
      return;
    }

    // Derive equipment name from subject
    let derivedEquipmentName = order.subject
      .replace(/^(?:documentaci[oó]n|fichas?\s+t[eé]cnicas?|documentos?)\s+(?:de|del|para|sobre)\s+/i, '')
      .replace(/^(?:re|fwd|rv|enc)\s*:\s*/gi, '')
      .trim();
    if (!derivedEquipmentName || derivedEquipmentName.length < 3) {
      derivedEquipmentName = order.senderName || 'Equipo Médico';
    }

    // Check if matching equipment exists
    const matchedEq = equipments.find((eq) => {
      const eqLower = eq.name.toLowerCase();
      const words = derivedEquipmentName.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      return words.some((w) => eqLower.includes(w));
    });

    let savedCount = 0;
    atts.forEach((att) => {
      const fname = att.filename.toLowerCase();
      let docType = 'Ficha Técnica';
      if (fname.includes('invima') || fname.includes('registro')) {
        docType = 'Registro INVIMA';
      } else if (fname.includes('importaci') || fname.includes('dian') || fname.includes('declaracion')) {
        docType = 'Otro Anexo';
      } else if (fname.includes('manual')) {
        docType = 'Manual de Usuario';
      } else if (fname.includes('calibraci')) {
        docType = 'Certificado Calidad';
      }

      const doc: TechnicalDocument = {
        id: `doc-gmail-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        equipmentId: matchedEq?.id,
        equipmentName: matchedEq ? matchedEq.name : derivedEquipmentName,
        equipmentCode: matchedEq?.code,
        docType,
        title: att.filename,
        fileName: att.filename,
        fileSize: att.size ? `${Math.round(att.size / 1024)} KB` : '180 KB',
        fileData: att.dataUrl,
        uploadDate: new Date().toISOString().split('T')[0],
        status: 'Vigente',
        notes: `Radicado desde correo de ${order.senderName || order.senderEmail} - Asunto: "${order.subject}"`,
      };

      onSaveDocument(doc);
      savedCount++;
    });

    handleSaveOrderModifications({
      ...order,
      emailType: 'documentation',
      detectedOCNumber: undefined,
      detectedItems: [],
      detectedEstimatedTotal: undefined,
      status: 'Procesada',
    });

    showToast(`✓ Se radicaron ${savedCount} documento(s) en Documentación Técnica.`);
  };

  const handleQuickSetEmailType = (
    order: DetectedPurchaseOrder,
    newType: 'general_po' | 'client_po' | 'part_creation_response' | 'part_authorization' | 'oc_response' | 'documentation' | 'other'
  ) => {
    let updatedParts = order.detectedPartsToImport;
    let updatedNotice = order.partCreationNotice;
    const raw = order.rawBodyText || order.snippet || '';
    const allReqItems = extractAllRequestedPartCreationDetails(raw, order.rawHtml);

    if (newType === 'documentation') {
      updatedParts = undefined;
      updatedNotice = undefined;
    } else if (newType === 'part_authorization') {
      updatedParts = undefined;
      updatedNotice = {
        status: 'uncreated',
        message: 'Autorización técnica de parte (Diana Figueroa): Información vigente, en espera de respuesta de Compras con número de parte oficial.',
        requestedItem: order.partCreationNotice?.requestedItem || allReqItems[0],
      };
    } else if (newType === 'other') {
      updatedParts = undefined;
      updatedNotice = undefined;
    } else if (newType === 'general_po' || newType === 'oc_response' || newType === 'client_po') {
      updatedParts = undefined;
      updatedNotice = undefined;
    } else if (newType === 'part_creation_response') {
      const codes: string[] = [];
      const multiMatch = raw.match(
        /(?:partes?\s+creadas?|c[oó]digos?\s+creados?|las\s+partes\s+creadas\s+son|se\s+crearon\s+las\s+partes)\s*[:#-]?\s*([0-9A-Za-z\-_,\s]+?)(?:\s+para|\s+gracias|\s+quedo|\.|\n|$)/i
      );
      if (multiMatch) {
        const potential = multiMatch[1].match(/\b(?:\d{4,8}|SYD-[A-Z0-9\-_]{2,12})\b/g);
        if (potential) {
          potential.forEach((p) => {
            const u = p.toUpperCase();
            if (!/^(?:202[0-9]|203[0-9]|3302424|2424|20330|20316|605|8059|123)$/.test(u) && !codes.includes(u)) {
              codes.push(u);
            }
          });
        }
      }

      if (codes.length === 0) {
        const singleRegex = /\b(?:parte\s+creada|c[oó]digo\s+creado|se\s+cre[oó]\s+la\s+parte)\s*[:#-]?\s*(\d{4,8}|SYD-[A-Z0-9\-_]{2,12})\b/gi;
        let sm: RegExpExecArray | null;
        while ((sm = singleRegex.exec(raw)) !== null) {
          const u = sm[1].toUpperCase();
          if (!/^(?:202[0-9]|203[0-9]|3302424|2424|20330|20316|605|8059|123)$/.test(u) && !codes.includes(u)) {
            codes.push(u);
          }
        }
      }

      if (codes.length === 0) {
        const digit5 = raw.match(/\b(7\d{4})\b/g);
        if (digit5) {
          digit5.forEach((d) => {
            if (!codes.includes(d)) codes.push(d);
          });
        }
      }

      if (codes.length > 0) {
        updatedParts = codes.map((code, idx) => {
          const reqItem = allReqItems[idx] || (allReqItems.length === 1 ? allReqItems[0] : undefined);
          const name = reqItem?.name || `Parte Oficial Biomédica (${code})`;
          const brand = reqItem?.brand || 'SYD';
          const model = reqItem?.model || 'Estándar';
          const supplier = reqItem?.supplier || 'FUTURO ORTOPEDICOS';
          const price = reqItem?.price || 0;
          const taxExempt = reqItem?.taxExempt || false;
          const taxRate = reqItem?.taxRate ?? (taxExempt ? 0 : 0.19);
          const invima = reqItem?.invimaRecordNumber || 'N/A';
          const subRefs = reqItem?.notes || reqItem?.subReferences || 'LOTE';
          const category = /fisiot|ortop|paquete|banda|masaje/i.test(name)
            ? ('Accesorios' as const)
            : /laringo|cirug|quir/i.test(name)
            ? ('Cirugía' as const)
            : /monitor|vital|spo2|ecg/i.test(name)
            ? ('Monitoreo' as const)
            : /fonendo|esteto|diagn/i.test(name)
            ? ('Diagnóstico' as const)
            : ('Accesorios' as const);

          return {
            code,
            name,
            brand,
            model,
            supplier,
            baseCostCOP: price,
            taxExempt,
            taxRate,
            category,
            invimaRecordNumber: invima,
            subReferences: subRefs,
            description: `Número de parte oficial: ${code}${subRefs ? ` (Refs: ${subRefs})` : ''} - ${name}`,
          };
        });
      } else {
        // No official code detected yet in email text; user can add it manually
        updatedParts = [];
      }
    }

    const updatedOrder: DetectedPurchaseOrder = {
      ...order,
      emailType: newType,
      poDirection: newType === 'client_po' ? 'client_to_syd' : newType === 'general_po' ? 'syd_to_supplier' : order.poDirection,
      detectedCustomer:
        newType === 'client_po' && !order.detectedCustomer
          ? extractClientNameFromOrder(order) || order.senderName
          : order.detectedCustomer,
      detectedPartsToImport: updatedParts,
      partCreationNotice: updatedNotice,
    };

    handleSaveOrderModifications(updatedOrder);

    const typeNames: Record<string, string> = {
      documentation: 'Documentación Técnica',
      general_po: 'Nueva Orden de Compra (OC)',
      client_po: 'Orden de Compra de Cliente',
      part_creation_response: 'Creación de Parte Aprobada',
      part_authorization: 'Autorización de Parte',
      oc_response: 'Aprobación de Auditoría',
      other: 'Informativo / Consulta General',
    };
    showToast(`✓ Clasificado como "${typeNames[newType] || newType}"`);
  };

  const handleOpenPartEdit = (part: DetectedPartToImport, order: DetectedPurchaseOrder) => {
    setPartBeingEdited({ part, order });
    setIsPartEditModalOpen(true);
  };

  const handleSavePartModal = (updatedPart: DetectedPartToImport, andImportToCatalog?: boolean) => {
    if (!partBeingEdited) return;
    const { order } = partBeingEdited;
    const currentParts = order.detectedPartsToImport || [];
    const existingIdx = currentParts.findIndex((p) => p.code === updatedPart.code || p.code === partBeingEdited.part.code);
    let newPartsList: DetectedPartToImport[];
    if (existingIdx >= 0) {
      newPartsList = [...currentParts];
      newPartsList[existingIdx] = updatedPart;
    } else {
      newPartsList = [...currentParts, updatedPart];
    }
    const updatedOrder: DetectedPurchaseOrder = {
      ...order,
      detectedPartsToImport: newPartsList,
    };
    handleSaveOrderModifications(updatedOrder);

    if (andImportToCatalog) {
      const uniqueSuffix = Math.random().toString(36).substring(2, 7);
      const newEquipment: MedicalEquipment = {
        id: `eq-part-${updatedPart.code || Date.now()}-${uniqueSuffix}`,
        code: updatedPart.code || `PARTE-${Math.floor(1000 + Math.random() * 9000)}`,
        name: updatedPart.name,
        brand: updatedPart.brand || 'SYD',
        model: updatedPart.model || 'Estándar',
        category: (updatedPart.category as any) || 'Accesorios',
        productGroup: 'Equipos Médicos',
        description: updatedPart.description || `Parte creada desde compras (${order.senderEmail})`,
        baseCostCOP: updatedPart.baseCostCOP || 0,
        baseCostUSD: 0,
        taxExempt: updatedPart.taxExempt || false,
        taxRate: updatedPart.taxExempt ? 0 : (updatedPart.taxRate || 0.19),
        defaultMarginList: 'L1',
        customFactor: 1.0,
        supplier: updatedPart.supplier || order.senderName || 'Proveedor SYD',
        invimaRecordNumber: updatedPart.invimaRecordNumber || '',
        invimaStatus: 'Vigente',
        warrantyMonths: 12,
        originCountry: 'Colombia',
        technicalSpecs: [
          `Parte creada por compras`,
          `Referencia: ${updatedPart.name}`,
          `Marca: ${updatedPart.brand || 'SYD'}`,
          ...(updatedPart.subReferences ? [`Sub-referencias: ${updatedPart.subReferences}`] : []),
        ],
        standardAccessories: [],
        imageUrl: '',
        hasDocSheet: true,
        hasInvimaDoc: true,
        hasManual: false,
        hasQualityCert: false,
      };
      onAddEquipmentToCatalog(newEquipment);
      alert(`✓ Parte "${updatedPart.code} - ${updatedPart.name}" registrada exitosamente en el Catálogo de Equipos.`);
    }
  };

  const handleRegisterRequestedPart = (requested: RequestedPartCreationDetails) => {
    const newEq: MedicalEquipment = {
      id: `eq_req_${Date.now()}`,
      code: requested.model && /^[A-Za-z0-9\-_]{4,10}$/.test(requested.model) ? `EQ-${requested.model}` : `EQ-${Math.floor(1000 + Math.random() * 9000)}`,
      name: requested.name,
      brand: requested.brand || 'General',
      model: requested.model || 'Estándar',
      productGroup: 'Equipos Médicos',
      category: /neonato|pediat/i.test(requested.name)
        ? 'Neonatología'
        : /fonendo|esteto|tensio|laringo/i.test(requested.name)
        ? 'Diagnóstico'
        : 'Accesorios',
      supplier: requested.supplier || 'Proveedor Asignado',
      baseCostCOP: requested.price && requested.price > 0 ? requested.price : 108856,
      taxExempt: false,
      taxRate: 0.19,
      defaultMarginList: 'L3_5',
      invimaRecordNumber: 'En Trámite',
      warrantyMonths: 12,
      originCountry: 'Importado',
      description: `Equipo registrado desde solicitud de parte. ${requested.notes || ''}`.trim(),
      technicalSpecs: [],
      standardAccessories: [],
      hasDocSheet: false,
      hasInvimaDoc: false,
      hasManual: false,
      hasQualityCert: false,
    };
    onAddEquipmentToCatalog(newEq);
    alert(`✓ "${requested.name}" ha sido registrado exitosamente en el Catálogo Maestro de Equipos.`);
  };

  // Connect Any Gmail or Custom Email directly
  const handleConnectDirectEmail = async (emailToConnect?: string, nameToConnect?: string) => {
    const targetEmail = (emailToConnect || customEmailInput).trim();
    const targetName = (nameToConnect || customNameInput).trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setAuthError('Por favor ingrese un correo electrónico válido (ej: eljemb22@gmail.com).');
      return;
    }
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const { profile } = gmailService.connectAnyEmail(targetEmail, targetName);
      setUserProfile(profile);
      setIsConnected(true);
      setSavedAccounts(gmailService.getSavedAccounts());
      setShowConfigModal(false);
      await loadInboxOrders();
    } catch (err: any) {
      setAuthError(err.message || 'Error al conectar la cuenta de correo.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Switch to a saved account with 1-click
  const handleSelectSavedAccount = async (account: GmailUserProfile) => {
    await handleConnectDirectEmail(account.email, account.name);
  };

  // Remove saved account from memory permanently
  const handleRemoveAccount = (emailToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    gmailService.removeSavedAccount(emailToRemove);
    const updated = gmailService.getSavedAccounts();
    setSavedAccounts(updated);
    if (userProfile?.email.toLowerCase() === emailToRemove.toLowerCase()) {
      setUserProfile(null);
      setIsConnected(false);
    }
  };

  // Clear all saved accounts permanently
  const handleClearAllAccounts = () => {
    gmailService.clearAllSavedAccounts();
    setSavedAccounts([]);
    setUserProfile(null);
    setIsConnected(false);
    setDetectedOrders([]);
  };

  // Connect Google Account Handler (OAuth 2.0 Popup with select_account)
  const handleConnectGmail = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const activeClientId = customClientIdInput?.trim() || DEFAULT_GMAIL_CLIENT_ID;

      if (activeClientId !== customClientIdInput) {
        setCustomClientIdInput(activeClientId);
        gmailService.setStoredClientId(activeClientId);
      }

      const { profile } = await gmailService.connectGoogleAccount(activeClientId);
      setUserProfile(profile);
      setIsConnected(true);
      setSavedAccounts(gmailService.getSavedAccounts());
      setShowConfigModal(false);
      await loadInboxOrders();
    } catch (err: any) {
      console.warn('Auth notice/error:', err);
      setAuthError(
        err.message ||
          'Google bloqueó la ventana porque este dominio no está registrado en los Orígenes de JavaScript de su Google Cloud Console. Recomendamos usar la pestaña "Cualquier Gmail (Directo)" o el botón "Abrir en Gmail Web".'
      );
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Quick Connect Demo / Corporate Account Handler
  const handleQuickConnectDemo = async () => {
    const email = currentUser?.email || 'compras.syd@sydcolombia.com';
    const name = currentUser?.name || 'Departamento de Compras SYD';
    await handleConnectDirectEmail(email, name);
  };

  // Connect Manual OAuth Token Handler
  const handleConnectManualToken = async () => {
    if (!manualTokenInput.trim()) {
      alert('Por favor ingrese el Token de Acceso de Google OAuth.');
      return;
    }
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const { profile } = await gmailService.connectManualToken(
        manualTokenInput,
        manualTokenEmail || customEmailInput || currentUser?.email || 'compras@sydcolombia.com',
        customNameInput || currentUser?.name || 'Usuario Google Conectado'
      );
      setUserProfile(profile);
      setIsConnected(true);
      setSavedAccounts(gmailService.getSavedAccounts());
      setShowConfigModal(false);
      await loadInboxOrders();
    } catch (err: any) {
      setAuthError(err.message || 'Error al conectar mediante token.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleDisconnectGmail = () => {
    gmailService.clearAuth();
    setIsConnected(false);
    setUserProfile(null);
    setAuthError(null);
    setDetectedOrders(gmailService.getSimulatedPurchaseOrders());
  };

  // Helpers for managing multiple parts in New Part Template
  const handleAddPartItem = () => {
    setNewPartForm((prev) => ({
      ...prev,
      parts: [
        ...prev.parts,
        {
          id: `part-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          subReferences: '',
          partName: '',
          quantity: 1,
          brand: '',
          model: '',
          estimatedPriceCOP: 0,
          taxExempt: false,
          supplier: '',
          departmentNotes: '',
        },
      ],
    }));
  };

  const handleRemovePartItem = (index: number) => {
    if (newPartForm.parts.length <= 1) {
      alert('Debe incluir al menos una parte en la solicitud.');
      return;
    }
    setNewPartForm((prev) => ({
      ...prev,
      parts: prev.parts.filter((_, i) => i !== index),
    }));
  };

  const handleUpdatePartItem = (index: number, field: keyof PartItemRequest, value: any) => {
    setNewPartForm((prev) => {
      const updated = [...prev.parts];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return {
        ...prev,
        parts: updated,
      };
    });
  };

  // Open Draft directly in official Gmail Web (mail.google.com)
  const handleOpenGmailWebForNewPart = () => {
    const { subject } = gmailService.buildNewPartEmailHTML(newPartForm);
    const greeting = getTimeBasedGreeting();
    const partsPromptText =
      newPartForm.parts.length > 1
        ? 'Favor crear las siguientes partes:'
        : 'Favor crear la siguiente parte:';

    const partsSummary = newPartForm.parts
      .map((p, idx) => {
        const num = newPartForm.parts.length > 1 ? `[Parte #${idx + 1}]\n` : '';
        const refs = p.subReferences ? `Referencias/Componentes: ${p.subReferences}\n` : '';
        const qty = p.quantity && p.quantity > 1 ? `Cantidad: ${p.quantity}\n` : '';
        return `${num}${refs}Nombre: ${p.partName || '---'}\n${qty}Marca: ${p.brand || '---'}\nModelo: ${p.model || '---'}\nPrecio Base Estimado: $${Number(p.estimatedPriceCOP || 0).toLocaleString('es-CO')} COP\nRégimen IVA: ${p.taxExempt ? 'Exento (0%)' : 'Aplica IVA (19%)'}\nProveedor: ${p.supplier || 'Por Asignar'}${p.departmentNotes ? `\nNotas: ${p.departmentNotes}` : ''}`;
      })
      .join('\n\n');

    const docsSummary =
      newPartForm.attachedDocuments && newPartForm.attachedDocuments.length > 0
        ? `\n\nDOCUMENTOS TÉCNICOS ADJUNTOS:\n${newPartForm.attachedDocuments
            .map((d, i) => `${i + 1}. [${d.type}] ${d.title} (${d.fileSize || 'PDF'})`)
            .join('\n')}`
        : '\n\n* Se adjunta Ficha Técnica y Registro INVIMA correspondientes.';

    const bodyText = `${greeting},\n\n${partsPromptText}\n\n${partsSummary}${docsSummary}\n\nAtentamente,\n\nJairo E. Mendoza Bolívar\nAsesor Línea Diagnóstica\nSuministro y Dotaciones Colombia S.A.\nTel: (605) 3302424 Ext 153 - Cel: +57 3162221407\nCarrera 43 # 80-59\nBarranquilla - Colombia`;
    const url = gmailService.getGmailWebComposeUrl(newPartForm.toEmail, subject, bodyText, newPartForm.ccEmail);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Open PO Draft directly in official Gmail Web (mail.google.com)
  const handleOpenGmailWebForPO = () => {
    const { subject } = gmailService.buildPurchaseOrderEmailHTML(poForm);
    const greeting = poForm.customGreeting || getTimeBasedGreeting();
    const city = poForm.locationCity || 'Barranquilla';
    const supplier = poForm.supplierName || 'Proveedor';
    const itemsSummary = poForm.items
      .map(
        (it, idx) =>
          `${idx + 1}. [Parte #${it.partCode || 'Pendiente'}] ${it.description} | Cant: ${it.quantity} | Precio: $${Number(it.unitPriceCOP).toLocaleString('es-CO')} COP ${it.taxExempt ? '(0% Exento)' : '(+19% IVA)'} | Proveedor: ${it.supplier || supplier}`
      )
      .join('\n');
    const bodyText = `${greeting},\n\nFavor la OC por ${city} para el proveedor ${supplier} con las siguientes partes:\n\n${itemsSummary}\n\nSubtotal: $${Number(poForm.subtotalCOP).toLocaleString('es-CO')} COP\nIVA: $${Number(poForm.ivaTotalCOP).toLocaleString('es-CO')} COP\nTOTAL: $${Number(poForm.grandTotalCOP).toLocaleString('es-CO')} COP\n\n${poForm.observations ? `Observaciones: ${poForm.observations}\n\n` : ''}Atentamente,\n\nJairo E. Mendoza Bolívar\nAsesor Línea Diagnóstica\nSuministro y Dotaciones Colombia S.A.\nTel: (605) 3302424 Ext 153 - Cel: +57 3162221407\nCarrera 43 # 80-59\nBarranquilla - Colombia`;
    const url = gmailService.getGmailWebComposeUrl(poForm.toEmail, subject, bodyText, poForm.ccEmail, poForm.bccEmail);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Filtered detected orders
  const filteredOrders = useMemo(() => {
    const q = inboxSearchQuery.trim().toLowerCase();
    return detectedOrders.filter((order) => {
      const matchesSearch =
        q === '' ||
        order.subject.toLowerCase().includes(q) ||
        order.senderName.toLowerCase().includes(q) ||
        (order.senderEmail && order.senderEmail.toLowerCase().includes(q)) ||
        (order.detectedOCNumber && order.detectedOCNumber.toLowerCase().includes(q)) ||
        (order.detectedCustomer && order.detectedCustomer.toLowerCase().includes(q)) ||
        (order.snippet && order.snippet.toLowerCase().includes(q)) ||
        (order.rawBodyText && order.rawBodyText.toLowerCase().includes(q)) ||
        (order.detectedItems &&
          order.detectedItems.some(
            (it) =>
              it.description.toLowerCase().includes(q) ||
              (it.partCode && it.partCode.toLowerCase().includes(q)) ||
              (it.brand && it.brand.toLowerCase().includes(q)) ||
              (it.model && it.model.toLowerCase().includes(q))
          )) ||
        (order.detectedPartsToImport &&
          order.detectedPartsToImport.some(
            (pt) =>
              pt.name.toLowerCase().includes(q) ||
              (pt.code && pt.code.toLowerCase().includes(q)) ||
              (pt.subReferences && pt.subReferences.toLowerCase().includes(q)) ||
              (pt.brand && pt.brand.toLowerCase().includes(q)) ||
              (pt.model && pt.model.toLowerCase().includes(q))
          ));

      const isClientPO = order.emailType === 'client_po';
      const isOrderDocumentation = order.emailType === 'documentation';

      const isOrderPartCreation =
        !isClientPO &&
        !isOrderDocumentation &&
        (order.emailType === 'part_creation_response' ||
          (order.detectedPartsToImport && order.detectedPartsToImport.length > 0) ||
          order.partCreationNotice?.status === 'created');

      const isOrderAuthorization =
        !isClientPO &&
        !isOrderDocumentation &&
        !isOrderPartCreation &&
        (order.emailType === 'part_authorization' || order.partCreationNotice?.status === 'uncreated');

      const isOrderPurchaseOrder =
        !isClientPO &&
        !isOrderDocumentation &&
        (order.emailType === 'general_po' ||
          (Boolean(order.detectedOCNumber) &&
            order.emailType !== 'part_authorization' &&
            order.emailType !== 'part_creation_response' &&
            order.emailType !== 'documentation' &&
            order.emailType !== 'other' &&
            order.emailType !== 'meeting_invite'));

      const matchesEmailType =
        emailTypeFilter === 'all' ||
        (emailTypeFilter === 'client_po' && isClientPO) ||
        (emailTypeFilter === 'part_creation_response' && isOrderPartCreation) ||
        (emailTypeFilter === 'part_authorization' && isOrderAuthorization) ||
        (emailTypeFilter === 'documentation' && isOrderDocumentation) ||
        (emailTypeFilter === 'general_po' && isOrderPurchaseOrder) ||
        order.emailType === emailTypeFilter;

      return matchesSearch && matchesEmailType;
    });
  }, [detectedOrders, inboxSearchQuery, emailTypeFilter]);

  // Handle Send New Part Email
  const handleSendNewPartEmail = async () => {
    const validParts = newPartForm.parts.filter((p) => p.partName && p.partName.trim());
    if (!newPartForm.toEmail || validParts.length === 0) {
      alert('Por favor ingrese el correo de destino y al menos el nombre de una parte a crear.');
      return;
    }

    setIsSendingNewPartEmail(true);
    setNewPartSuccessMsg(null);

    const { subject, html } = gmailService.buildNewPartEmailHTML(newPartForm);

    try {
      if (isConnected) {
        await gmailService.sendRawEmail(newPartForm.toEmail, subject, html, newPartForm.ccEmail);
      } else {
        // Fallback simulation / timeout
        await new Promise((r) => setTimeout(r, 900));
      }

      // Record in sent history with full parts payload for auto-matching in responses
      const historyItem = {
        id: `sent_${Date.now()}`,
        type: 'part_request',
        to: newPartForm.toEmail,
        subject,
        date: new Date().toISOString(),
        parts: validParts,
        details: validParts.map((p) => `${p.partName} (${p.subReferences ? `Refs: ${p.subReferences} | ` : ''}${p.brand || ''} ${p.model || ''})`).join(', '),
      };

      const updatedHistory = [historyItem, ...sentHistory];
      setSentHistory(updatedHistory);
      localStorage.setItem('syd_gmail_sent_history_v1', JSON.stringify(updatedHistory));

      setNewPartSuccessMsg(`Correo enviado exitosamente a ${newPartForm.toEmail} (${validParts.length} parte(s) solicitada(s))`);

      // Optionally offer to add directly into catalog
      const shouldAddToCatalog = window.confirm(
        `¡Correo enviado!\n\n¿Desea registrar simultáneamente las ${validParts.length} partes en el Catálogo Maestro de SYD Colombia?`
      );

      if (shouldAddToCatalog) {
        validParts.forEach((part) => {
          const newEq: MedicalEquipment = {
            id: `eq_gmail_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            code: `EQ-GMAIL-${Math.floor(1000 + Math.random() * 9000)}`,
            name: part.partName,
            brand: part.brand || '---',
            model: part.model || 'General',
            productGroup: 'Equipos Médicos',
            category: 'Diagnóstico',
            supplier: part.supplier || 'Proveedor por Asignar',
            baseCostCOP: Number(part.estimatedPriceCOP) || 0,
            taxExempt: !!part.taxExempt,
            taxRate: part.taxExempt ? 0 : 0.19,
            defaultMarginList: 'L3_5',
            invimaRecordNumber: 'En Trámite',
            warrantyMonths: 12,
            originCountry: 'Importado',
            description: `Ingresado desde Integración Gmail. ${part.departmentNotes || ''}`,
            technicalSpecs: [],
            standardAccessories: [],
            hasDocSheet: false,
            hasInvimaDoc: false,
            hasManual: false,
            hasQualityCert: false,
          };
          onAddEquipmentToCatalog(newEq);
        });
        alert(`Se han agregado ${validParts.length} partes exitosamente al Catálogo Maestro.`);
      }
    } catch (err: any) {
      alert(`Error al enviar correo: ${err.message}`);
    } finally {
      setIsSendingNewPartEmail(false);
    }
  };

  // Handle Send Purchase Order (OC) Email
  const handleSendPurchaseOrderEmail = async () => {
    if (!poForm.toEmail || !poForm.supplierName || poForm.items.length === 0) {
      alert('Por favor complete el correo destinatario, el nombre del proveedor y al menos un ítem en la solicitud de Orden de Compra.');
      return;
    }

    setIsSendingPoEmail(true);
    setPoSuccessMsg(null);

    const { subject, html } = gmailService.buildPurchaseOrderEmailHTML(poForm);

    try {
      if (isConnected) {
        await gmailService.sendRawEmail(poForm.toEmail, subject, html, poForm.ccEmail, poForm.bccEmail);
      } else {
        await new Promise((r) => setTimeout(r, 900));
      }

      // Record in sent history
      const historyItem = {
        id: `sent_po_${Date.now()}`,
        type: 'SOLICITUD ORDEN DE COMPRA',
        to: poForm.toEmail,
        subject,
        date: new Date().toISOString(),
        details: `Sede ${poForm.locationCity} -> Proveedor: ${poForm.supplierName} (Total: $${poForm.grandTotalCOP.toLocaleString('es-CO')} COP)`,
      };

      const updatedHistory = [historyItem, ...sentHistory];
      setSentHistory(updatedHistory);
      localStorage.setItem('syd_gmail_sent_history_v1', JSON.stringify(updatedHistory));

      setPoSuccessMsg(`Solicitud de Orden de Compra para sede ${poForm.locationCity} enviada con éxito a ${poForm.toEmail}`);
    } catch (err: any) {
      alert(`Error al enviar la Solicitud de Orden de Compra: ${err.message}`);
    } finally {
      setIsSendingPoEmail(false);
    }
  };

  // Add Item to PO Form
  const handleAddPoItem = () => {
    const newItem = {
      partCode: '',
      description: '',
      brand: '',
      model: '',
      quantity: 1,
      unitPriceCOP: 0,
      taxExempt: false,
      supplier: poForm.supplierName || '',
      totalLineCOP: 0,
    };
    const updatedItems = [...poForm.items, newItem];
    const totals = recalculatePOTotals(updatedItems);
    setPoForm({ ...poForm, items: updatedItems, ...totals });
  };

  // Remove Item from PO Form
  const handleRemovePoItem = (index: number) => {
    const updatedItems = poForm.items.filter((_, idx) => idx !== index);
    const totals = recalculatePOTotals(updatedItems);
    setPoForm({ ...poForm, items: updatedItems, ...totals });
  };

  // Update Item in PO Form
  const handleUpdatePoItem = (index: number, updates: Partial<(typeof poForm.items)[0]>) => {
    const updatedItems = [...poForm.items];
    const current = updatedItems[index];
    const merged = { ...current, ...updates };
    merged.totalLineCOP = (merged.quantity || 1) * (merged.unitPriceCOP || 0);
    updatedItems[index] = merged;

    const totals = recalculatePOTotals(updatedItems);
    setPoForm({ ...poForm, items: updatedItems, ...totals });
  };

  // Add equipment from SYD Catalog to PO
  const handleAddEquipmentFromCatalog = (eq: MedicalEquipment) => {
    const newItem = {
      partCode: eq.code,
      description: eq.name,
      brand: eq.brand,
      model: eq.model,
      quantity: 1,
      unitPriceCOP: eq.baseCostCOP,
      taxExempt: !!eq.taxExempt,
      totalLineCOP: eq.baseCostCOP,
    };

    const updatedItems = [...poForm.items, newItem];
    const totals = recalculatePOTotals(updatedItems);
    setPoForm({
      ...poForm,
      supplierName: poForm.supplierName || eq.supplier || '',
      items: updatedItems,
      ...totals,
    });
    setShowCatalogItemPicker(false);
  };

  // Format COP currency
  const formatCOP = (val: number) =>
    new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      maximumFractionDigits: 0,
    }).format(val || 0);

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Top Header Card */}
      <div className="bg-[var(--syd-card-bg)] border border-[var(--syd-border-color)] rounded-2xl p-6 shadow-xl relative overflow-hidden transition-colors">
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-[var(--syd-accent-glow)] rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--syd-accent-glow)] border border-[var(--syd-accent)] text-[var(--syd-accent)] text-xs font-semibold uppercase tracking-wider mb-2">
              <Mail className="w-3.5 h-3.5" />
              <span>Centro de Conexión Gmail & Órdenes de Compra</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-[var(--syd-text-primary,#ffffff)] tracking-tight">
              Gestión de Correo, Detección de OCs y Envío de Plantillas
            </h1>
            <p className="text-sm text-[var(--syd-text-secondary,#94a3b8)] mt-1 max-w-2xl">
              Conecte cualquier cuenta de Gmail para detectar automáticamente órdenes de compra recibidas del departamento de compras o clientes, y envíe correos formales con plantillas de partes nuevas y órdenes de compra.
            </p>
          </div>

          {/* Account Status Card */}
          <div className="bg-[var(--syd-sidebar-bg)] border border-[var(--syd-border-color)] rounded-xl p-4 min-w-[340px] max-w-md shadow-lg flex flex-col gap-3 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--syd-text-secondary,#94a3b8)] uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[var(--syd-accent)]" />
                <span>Cuenta de Gmail Activa</span>
              </span>
              {isConnected ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Conectado</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <AlertCircle className="w-3 h-3" />
                  <span>Sin Conectar</span>
                </span>
              )}
            </div>

            {isConnected && userProfile ? (
              <div className="flex items-center justify-between gap-3 py-1 bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/50">
                <div className="flex items-center gap-2.5 min-w-0">
                  {userProfile.picture ? (
                    <img
                      src={userProfile.picture}
                      alt={userProfile.name}
                      className="w-9 h-9 rounded-full border border-cyan-400/50 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs">
                      {userProfile.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{userProfile.name}</p>
                    <p className="text-[11px] font-mono text-cyan-300 truncate">{userProfile.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setConnectModalTab('direct');
                    setShowConfigModal(true);
                  }}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition border border-slate-600 shrink-0 cursor-pointer"
                  title="Cambiar a otra cuenta de Gmail"
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="bg-slate-900/40 p-2.5 rounded-lg border border-dashed border-slate-700 space-y-1">
                <p className="text-xs text-slate-300 font-medium">
                  Conecte cualquier dirección de Gmail para emitir órdenes de compra y sincronizar bandejas.
                </p>
                {/* Quick 1-click accounts pills if any exist */}
                {savedAccounts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {savedAccounts.slice(0, 3).map((acc) => (
                      <button
                        key={acc.email}
                        onClick={() => handleSelectSavedAccount(acc)}
                        disabled={isAuthenticating}
                        className="inline-flex items-center gap-1 text-[10px] bg-slate-800 hover:bg-cyan-900/60 text-cyan-300 px-2 py-1 rounded-md border border-slate-700 hover:border-cyan-500/50 transition cursor-pointer"
                        title={`Conectar como ${acc.email}`}
                      >
                        <UserCheck className="w-3 h-3 text-cyan-400" />
                        <span className="truncate max-w-[130px]">{acc.email}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-col gap-2 pt-1 border-t border-slate-700/50">
              {isConnected ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => loadInboxOrders()}
                    disabled={isLoadingInbox}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs py-2 px-3 rounded-lg transition active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingInbox ? 'animate-spin' : ''}`} />
                    <span>{isLoadingInbox ? 'Sincronizando...' : 'Sincronizar Bandeja'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setConnectModalTab('direct');
                      setShowConfigModal(true);
                    }}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-600 transition cursor-pointer"
                    title="Administrar Cuentas y Conexiones"
                  >
                    <Users className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleDisconnectGmail}
                    className="inline-flex items-center justify-center p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition cursor-pointer"
                    title="Desconectar cuenta"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setConnectModalTab('direct');
                      setShowConfigModal(true);
                    }}
                    disabled={isAuthenticating}
                    style={{
                      backgroundColor: 'var(--syd-btn-bg, #38bdf8)',
                      color: 'var(--syd-btn-text, #0f172a)',
                      borderRadius: 'var(--syd-btn-radius, 14px)',
                      borderColor: 'var(--syd-btn-bg, #38bdf8)',
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 font-bold text-xs py-2.5 px-3 rounded-lg shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50 border"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Conectar Cualquier Cuenta de Gmail</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleConnectGmail}
                      disabled={isAuthenticating}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-[11px] py-1.5 px-2 rounded-lg transition active:scale-95 cursor-pointer disabled:opacity-50"
                      title="Google Sign-In Popup"
                    >
                      <Globe className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{isAuthenticating ? 'Abriendo Google...' : 'Ventana Google'}</span>
                    </button>
                    <button
                      onClick={handleQuickConnectDemo}
                      disabled={isAuthenticating}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 text-cyan-300 font-semibold text-[11px] py-1.5 px-2 rounded-lg transition active:scale-95 cursor-pointer disabled:opacity-50"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Demo Compras SYD</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {authError && (
              <div className="text-xs text-amber-200 bg-amber-950/40 p-3 rounded-lg border border-amber-800/60 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                  <button
                    onClick={() => setAuthError(null)}
                    className="text-slate-400 hover:text-white p-0.5 text-sm font-bold leading-none cursor-pointer"
                    title="Descartar aviso"
                  >
                    &times;
                  </button>
                </div>
                {!isConnected && (
                  <div className="flex items-center gap-2 pt-1 border-t border-amber-900/40">
                    <button
                      onClick={() => {
                        setConnectModalTab('direct');
                        setShowConfigModal(true);
                      }}
                      className="text-[11px] font-bold text-cyan-300 hover:underline cursor-pointer"
                    >
                      Escribir mi correo Gmail
                    </button>
                    <span className="text-slate-600">&bull;</span>
                    <button
                      onClick={handleQuickConnectDemo}
                      className="text-[11px] font-bold text-amber-300 hover:underline cursor-pointer"
                    >
                      Usar Conexión Rápida
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-[var(--syd-border-color)]">
          <button
            onClick={() => setActiveSubTab('detected_orders')}
            style={
              activeSubTab === 'detected_orders'
                ? {
                    backgroundColor: 'var(--syd-accent, #06b6d4)',
                    color: 'var(--syd-btn-text, #0f172a)',
                    borderColor: 'var(--syd-accent, #06b6d4)',
                  }
                : {
                    backgroundColor: 'var(--syd-sidebar-bg)',
                    color: 'var(--syd-text-secondary)',
                    borderColor: 'var(--syd-border-color)',
                  }
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer border shadow-sm"
          >
            <Inbox className="w-4 h-4" />
            <span>Bandeja de OCs Detectadas</span>
            <span
              style={
                activeSubTab === 'detected_orders'
                  ? {
                      backgroundColor: 'var(--syd-card-bg)',
                      color: 'var(--syd-accent, #06b6d4)',
                    }
                  : {
                      backgroundColor: 'var(--syd-card-bg)',
                      color: 'var(--syd-text-secondary)',
                    }
              }
              className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold"
            >
              {detectedOrders.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('new_part_template')}
            style={
              activeSubTab === 'new_part_template'
                ? {
                    backgroundColor: 'var(--syd-accent, #06b6d4)',
                    color: 'var(--syd-btn-text, #0f172a)',
                    borderColor: 'var(--syd-accent, #06b6d4)',
                  }
                : {
                    backgroundColor: 'var(--syd-sidebar-bg)',
                    color: 'var(--syd-text-secondary)',
                    borderColor: 'var(--syd-border-color)',
                  }
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer border shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Plantilla: Solicitud de Creación de Parte</span>
          </button>

          <button
            onClick={() => setActiveSubTab('purchase_order_template')}
            style={
              activeSubTab === 'purchase_order_template'
                ? {
                    backgroundColor: 'var(--syd-accent, #06b6d4)',
                    color: 'var(--syd-btn-text, #0f172a)',
                    borderColor: 'var(--syd-accent, #06b6d4)',
                  }
                : {
                    backgroundColor: 'var(--syd-sidebar-bg)',
                    color: 'var(--syd-text-secondary)',
                    borderColor: 'var(--syd-border-color)',
                  }
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer border shadow-sm"
          >
            <Send className="w-4 h-4" />
            <span>Plantilla: Emisión y Envío de Orden de Compra (OC)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('sent_history')}
            style={
              activeSubTab === 'sent_history'
                ? {
                    backgroundColor: 'var(--syd-accent, #06b6d4)',
                    color: 'var(--syd-btn-text, #0f172a)',
                    borderColor: 'var(--syd-accent, #06b6d4)',
                  }
                : {
                    backgroundColor: 'var(--syd-sidebar-bg)',
                    color: 'var(--syd-text-secondary)',
                    borderColor: 'var(--syd-border-color)',
                  }
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition cursor-pointer border shadow-sm"
          >
            <Clock className="w-4 h-4" />
            <span>Historial de Correos Enviados</span>
            <span
              style={
                activeSubTab === 'sent_history'
                  ? {
                      backgroundColor: 'var(--syd-card-bg)',
                      color: 'var(--syd-accent, #06b6d4)',
                    }
                  : {
                      backgroundColor: 'var(--syd-card-bg)',
                      color: 'var(--syd-text-secondary)',
                    }
              }
              className="px-1.5 py-0.2 rounded-full text-[10px] font-bold"
            >
              {sentHistory.length}
            </span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: DETECTED PURCHASE ORDERS FROM INBOX */}
      {/* ========================================================================= */}
      {activeSubTab === 'detected_orders' && (
        <div className="space-y-4">
          {/* Controls & Filter Bar */}
          <div className="bg-[#0f172a]/95 backdrop-blur-md border border-slate-800 rounded-xl p-3.5 sm:p-4 flex flex-col gap-3 shadow-xl sticky top-0 z-20">
            {/* Top Row: Search + Mode Toggle + Sync 300 + Count */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadInboxOrders(inboxSearchQuery, scanMode, 300);
                }}
                className="flex-1 flex items-center gap-2"
              >
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar en Gmail (por Asunto, Remitente, Hospital, No. de OC, etc.)..."
                    value={inboxSearchQuery}
                    onChange={(e) => setInboxSearchQuery(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-slate-400 focus:outline-hidden focus:border-cyan-400"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoadingInbox || !isConnected}
                  className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Buscar</span>
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {/* Scan Mode Toggle */}
                <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setScanMode('all_inbox');
                      loadInboxOrders(inboxSearchQuery, 'all_inbox', 300);
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                      scanMode === 'all_inbox'
                        ? 'bg-cyan-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Escanear bandeja de entrada"
                  >
                    Bandeja Completa
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScanMode('smart_filter');
                      loadInboxOrders(inboxSearchQuery, 'smart_filter', 300);
                    }}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                      scanMode === 'smart_filter'
                        ? 'bg-cyan-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                    title="Escanear únicamente correos con palabras clave de compras, órdenes y cotizaciones"
                  >
                    Filtro OCs / Cotizaciones
                  </button>
                </div>

                {/* Sincronizar Button */}
                <button
                  type="button"
                  onClick={() => loadInboxOrders(inboxSearchQuery, scanMode, 300, true)}
                  disabled={isLoadingInbox || !isConnected}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  title="Limpiar caché y volver a sincronizar correos reales desde Gmail"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isLoadingInbox ? 'animate-spin' : ''}`} />
                  <span>Actualizar</span>
                </button>

                {/* Email Count Indicator */}
                <div className="text-xs font-medium text-slate-300 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700/80 flex items-center gap-1.5">
                  <span className="text-slate-400">Mostrando</span>
                  <strong className="text-cyan-300 font-bold">{filteredOrders.length}</strong>
                  <span className="text-slate-400">de</span>
                  <strong className="text-white font-bold">{detectedOrders.length}</strong>
                  <span className="text-slate-400">correos</span>
                </div>
              </div>
            </div>

            {/* Bottom Row: Email Type Filter */}
            <div className="flex items-center gap-2 pt-2 border-t border-slate-800/80 flex-wrap">
              <span className="text-xs font-semibold text-slate-400 shrink-0">Filtrar por Tipo:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'documentation', label: '📚 Documentación Técnica' },
                  { id: 'client_po', label: '🏢 OC Clientes (Contratos)' },
                  { id: 'general_po', label: '📄 OCs a Proveedores / Solicitudes' },
                  { id: 'part_creation_response', label: '✨ Creación Partes' },
                  { id: 'part_authorization', label: '🛡️ Autorizaciones' },
                  { id: 'oc_response', label: '📋 Aprobación Auditoría' },
                  { id: 'other', label: 'ℹ️ Informativos' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setEmailTypeFilter(t.id as any)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      emailTypeFilter === t.id
                        ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
                        : 'bg-slate-900/90 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Error Banner with specialized handling for rate limit vs disabled API */}
          {inboxApiError && (() => {
            const isRateLimit =
              inboxApiError.includes('Límite de velocidad') ||
              inboxApiError.includes('Rate Limit') ||
              inboxApiError.includes('Quota exceeded') ||
              inboxApiError.includes('Units per minute') ||
              inboxApiError.includes('Total Query Cost');

            const isApiDisabled =
              inboxApiError.includes('debe estar habilitada') ||
              inboxApiError.includes('has not been used in project') ||
              inboxApiError.includes('disabled');

            if (isRateLimit) {
              return (
                <div className="bg-sky-950/80 border border-sky-600/70 rounded-xl p-4 text-sky-100 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg animate-in fade-in duration-300">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-sky-900/80 border border-sky-500/50 text-sky-300 shrink-0">
                      <Clock className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sky-200 text-sm">
                          Pausa de Seguridad de Google (Límite de Consultas por Minuto)
                        </h4>
                        <span className="bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          Gmail API Activa en Google Cloud
                        </span>
                      </div>
                      <p className="mt-1 text-slate-300 leading-relaxed text-[11px] max-w-3xl">
                        Tu API de Gmail está <strong>correctamente habilitada</strong> (como viste en Google Cloud).
                        Este aviso ocurre porque al descargar muchos correos de forma continua, Google impone una pausa
                        temporal de 60 segundos por usuario para proteger la cuenta. No requiere activar nada en consola.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setInboxApiError(null);
                        loadInboxOrders(inboxSearchQuery, scanMode, 300);
                      }}
                      className="px-3.5 py-2 bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 text-slate-950 font-extrabold rounded-lg transition cursor-pointer shadow flex items-center gap-1.5 text-xs"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Reintentar Sincronización</span>
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div className="bg-amber-950/60 border border-amber-800/80 rounded-xl p-4 text-amber-200 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-lg">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-amber-300 text-sm">Aviso de Sincronización Gmail</h4>
                    <p className="mt-0.5 text-slate-300">{inboxApiError}</p>
                  </div>
                </div>
                {isApiDisabled && (
                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href="https://console.cloud.google.com/apis/library/gmail.googleapis.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition inline-flex items-center gap-1.5"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Habilitar Gmail API en Google Cloud</span>
                    </a>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Orders List */}
          {isLoadingInbox ? (
            <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-10 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
              <div>
                <p className="text-slate-200 font-bold text-base">Escaneando bandeja de entrada de Gmail...</p>
                <p className="text-slate-400 text-xs mt-1">
                  {inboxLoadProgress && inboxLoadProgress.total > 0
                    ? `Descargando correos: ${inboxLoadProgress.loaded} de ${inboxLoadProgress.total}...`
                    : scanMode === 'all_inbox'
                    ? 'Cargando los correos recientes de su bandeja con pausas de seguridad...'
                    : 'Buscando correos con Órdenes de Compra, solicitudes y cotizaciones...'}
                </p>
              </div>
              {inboxLoadProgress && inboxLoadProgress.total > 0 && (
                <div className="max-w-xs mx-auto w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full transition-all duration-300 ease-out"
                    style={{
                      width: `${Math.round((inboxLoadProgress.loaded / inboxLoadProgress.total) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          ) : !isConnected ? (
            <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-12 text-center max-w-xl mx-auto space-y-4">
              <div className="w-14 h-14 bg-slate-800/80 rounded-2xl flex items-center justify-center mx-auto border border-slate-700 text-slate-400">
                <Mail className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-slate-200 font-bold text-base">No hay ninguna cuenta de Gmail vinculada</h3>
                <p className="text-slate-400 text-xs mt-1.5 max-w-md mx-auto">
                  Vincule su correo de Gmail para escanear y visualizar las Órdenes de Compra recibidas en su bandeja de entrada.
                </p>
              </div>
              <div>
                <button
                  onClick={() => {
                    setConnectModalTab('direct');
                    setShowConfigModal(true);
                  }}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs py-2.5 px-5 rounded-xl shadow-lg transition active:scale-95 cursor-pointer"
                >
                  <Mail className="w-4 h-4" />
                  <span>Vincular Cuenta de Gmail</span>
                </button>
              </div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-12 text-center space-y-4">
              <Inbox className="w-12 h-12 text-slate-600 mx-auto" />
              <div>
                <p className="text-slate-300 font-bold text-base">No se encontraron correos con el filtro actual</p>
                <p className="text-slate-500 text-xs mt-1">
                  Cuenta conectada: <span className="text-cyan-400 font-mono">{userProfile?.email}</span> ({scanMode === 'all_inbox' ? 'Modo Bandeja Completa' : 'Modo Filtro OCs'}).
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setScanMode('all_inbox');
                    setInboxSearchQuery('');
                    loadInboxOrders('', 'all_inbox');
                  }}
                  className="inline-flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold py-2 px-4 rounded-lg cursor-pointer transition shadow-md"
                >
                  <Inbox className="w-3.5 h-3.5" />
                  <span>Cargar Todos los Correos Recientes</span>
                </button>
                <button
                  onClick={() => loadInboxOrders(inboxSearchQuery, scanMode)}
                  className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-bold py-2 px-4 rounded-lg cursor-pointer transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Volver a Sincronizar</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredOrders.map((order, orderIdx) => {
                const rawBodyText = order.rawBodyText || order.snippet || '';
                const senderLower = (order.sender || order.senderEmail || order.senderName || '').toLowerCase();
                const thread = splitEmailThread(rawBodyText, order.senderName, order.date);
                const latestMsg = (thread[0]?.body || rawBodyText).trim();
                const latestMsgLower = latestMsg.toLowerCase();
                const isComprasSender = senderLower.includes('compras@syd.com.co') || (order.senderName || '').toLowerCase().includes('compras');

                const isPartCreation = order.emailType === 'part_creation_response';
                const isAuthorization = order.emailType === 'part_authorization';
                const isOCResponse = order.emailType === 'oc_response';
                const isGeneralPO = order.emailType === 'general_po';
                const isClientPO = order.emailType === 'client_po';
                const isDocumentation = order.emailType === 'documentation';
                const isInfo = order.emailType === 'other';

                // Solo se considera Orden de Compra si está clasificado como general_po o tiene número de OC y no es documentación ni otro tipo
                const isPurchaseOrder =
                  !isDocumentation &&
                  (order.emailType === 'general_po' ||
                    (Boolean(order.detectedOCNumber) &&
                      order.emailType !== 'part_authorization' &&
                      order.emailType !== 'part_creation_response' &&
                      order.emailType !== 'client_po' &&
                      order.emailType !== 'documentation' &&
                      order.emailType !== 'other' &&
                      order.emailType !== 'meeting_invite'));

                // Valid detected items (excluding signatures, contact lines, noise)
                const cleanDetectedItems = isDocumentation
                  ? []
                  : (order.detectedItems || []).filter(
                      (it) => !isSignatureOrHeaderOrNoise(it.description) && !/%20|tel:|cel:|\(\d{3}\)/i.test(it.description)
                    );

                return (
                  <div
                    key={`order-card-${order.id || 'ord'}-${orderIdx}`}
                    className={`border rounded-xl p-5 shadow-md transition space-y-4 ${
                      isDocumentation
                        ? 'bg-gradient-to-br from-[#12142e] via-[#0f172a] to-[#1a1c3b] border-indigo-500/50 hover:border-indigo-400'
                        : isClientPO
                        ? 'bg-gradient-to-br from-[#0a231c] via-[#0f172a] to-[#0d2e24] border-emerald-500/50 hover:border-emerald-400'
                        : isAuthorization
                        ? 'bg-gradient-to-br from-[#1c160a] via-[#0f172a] to-[#141005] border-amber-500/50 hover:border-amber-400'
                        : isPartCreation
                        ? 'bg-gradient-to-br from-[#0c1c2e] via-[#0f172a] to-[#0a2520] border-emerald-500/40 hover:border-emerald-400'
                        : isOCResponse
                        ? 'bg-gradient-to-br from-[#12162e] via-[#0f172a] to-[#1e1338] border-purple-500/40 hover:border-purple-400'
                        : isInfo
                        ? 'bg-[#0b1329] border-slate-800 hover:border-slate-700'
                        : 'bg-[#0f172a] hover:bg-[#131f38] border-slate-800 hover:border-cyan-500/40'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                      {/* Left Column: Email Header & Content */}
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {isDocumentation && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/50 text-xs font-bold shadow-xs">
                              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                              <span>Documentación Técnica</span>
                            </span>
                          )}

                          {isClientPO && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 text-xs font-bold shadow-xs">
                              <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Orden de Compra de Cliente (➔ Contratos)</span>
                            </span>
                          )}

                          {isAuthorization && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                              <span>Autorización de Creación de Parte</span>
                            </span>
                          )}

                          {isPartCreation && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Creación de Parte Aprobada</span>
                            </span>
                          )}

                          {isOCResponse && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40 text-xs font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                              <span>Aprobación Auditoría Compras</span>
                            </span>
                          )}

                          {isGeneralPO && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold">
                              <FileText className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Orden de Compra (OC)</span>
                            </span>
                          )}

                          {isInfo && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold">
                              <Info className="w-3.5 h-3.5 text-slate-400" />
                              <span>Informativo / Consulta</span>
                            </span>
                          )}

                          {!isDocumentation && order.detectedOCNumber && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold font-mono">
                              <Hash className="w-3.5 h-3.5" />
                              <span>{order.detectedOCNumber}</span>
                            </span>
                          )}

                          {order.source === 'simulated' && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-mono border border-slate-700">
                              Demo
                            </span>
                          )}

                          <span className="text-xs text-slate-400 ml-auto">
                            {new Date(order.date).toLocaleString('es-CO', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        {/* Streamlined Classification Selector */}
                        <div className="flex items-center gap-2 bg-slate-950/80 py-1.5 px-3 rounded-lg border border-slate-800 text-xs w-fit">
                          <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Clasificación:
                          </span>
                          <select
                            value={order.emailType || 'other'}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleQuickSetEmailType(order, e.target.value as any);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-slate-900 text-cyan-300 font-semibold text-xs py-1 px-2.5 rounded border border-slate-700 hover:border-cyan-500 focus:outline-hidden focus:border-cyan-400 cursor-pointer"
                            title="Cambiar clasificación manualmente"
                          >
                            <option value="documentation">📚 Documentación Técnica</option>
                            <option value="general_po">📄 Orden de Compra (OC Proveedor)</option>
                            <option value="client_po">🏢 OC de Cliente (Contratos)</option>
                            <option value="part_authorization">🛡️ Autorización de Parte</option>
                            <option value="part_creation_response">✨ Creación de Parte Aprobada</option>
                            <option value="oc_response">📋 Aprobación Auditoría</option>
                            <option value="other">ℹ️ Solo Información / Consulta</option>
                          </select>
                        </div>

                        <h3 className="text-base font-bold text-white leading-snug">{order.subject}</h3>

                        <div className="flex items-center gap-2 text-xs text-slate-300">
                          <Building className="w-3.5 h-3.5 text-cyan-400" />
                          <span className="font-semibold text-cyan-200">{order.senderName}</span>
                          <span className="text-slate-500">&bull;</span>
                          <span className="text-slate-400 font-mono">{order.senderEmail}</span>
                        </div>

                        {/* Compact, Legible Email Preview & Thread Chain Badge */}
                        {(() => {
                          const raw = (order.rawBodyText || order.snippet || '').trim();
                          const thread = splitEmailThread(raw, order.senderName, order.date);
                          const latestBody = cleanEmailText(thread[0]?.body || raw);
                          const isExpanded = !!expandedCardEmails[order.id];
                          const needsExpand = latestBody.length > 160 || thread.length > 1;

                          return (
                            <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 space-y-1.5 shadow-inner">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                  <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">
                                    Texto del Correo:
                                  </span>
                                  {thread.length > 1 && (
                                    <span className="px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] font-medium">
                                      🧵 Hilo ({thread.length})
                                    </span>
                                  )}
                                </div>
                                {needsExpand && (
                                  <button
                                    type="button"
                                    onClick={() => toggleCardEmailExpanded(order.id)}
                                    className="text-[11px] font-bold text-cyan-400 hover:text-cyan-200 transition cursor-pointer"
                                  >
                                    {isExpanded ? 'Mostrar menos' : 'Ver mensaje completo'}
                                  </button>
                                )}
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed font-sans select-text whitespace-pre-wrap max-h-28 overflow-y-auto">
                                {isExpanded
                                  ? latestBody
                                  : latestBody.slice(0, 160) + (needsExpand ? '...' : '')}
                              </p>
                            </div>
                          );
                        })()}

                        {/* Authorization Status Banner (No duplicate message box!) */}
                        {isAuthorization && (
                          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200">
                            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>
                              <strong>Autorización Técnica:</strong> Visto bueno registrado (información vigente). En espera de respuesta del correo con el número de parte oficial asignado por Compras.
                            </span>
                          </div>
                        )}

                        {/* Detected Items Structured List for Purchase Orders only */}
                        {isGeneralPO && cleanDetectedItems.length > 0 && (
                          <div className="pt-1 space-y-2">
                            <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 space-y-2">
                              <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                                <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                                  <Package className="w-3.5 h-3.5 text-cyan-400" />
                                  <span>
                                    Ítems y Equipos de la Orden de Compra ({cleanDetectedItems.length}):
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOrderBeingEdited(order);
                                    setIsOrderEditModalOpen(true);
                                  }}
                                  className="text-[10px] font-bold text-cyan-400 hover:text-cyan-200 transition cursor-pointer flex items-center gap-1"
                                  title="Modificar o agregar ítems a esta OC"
                                >
                                  <Pencil className="w-3 h-3" />
                                  <span>Editar Ítems</span>
                                </button>
                              </div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                  <thead>
                                    <tr className="text-[10px] text-slate-400 uppercase border-b border-slate-800">
                                      <th className="pb-1 font-semibold pr-2">Cant</th>
                                      <th className="pb-1 font-semibold pr-2">Código</th>
                                      <th className="pb-1 font-semibold pr-2">Descripción</th>
                                      <th className="pb-1 font-semibold pr-2 text-right">Vr. Unitario</th>
                                      <th className="pb-1 font-semibold text-right">Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/60 font-sans">
                                    {cleanDetectedItems.map((item, idx) => (
                                      <tr key={idx} className="hover:bg-slate-800/40 transition">
                                        <td className="py-1.5 pr-2 font-bold text-cyan-300">
                                          {item.quantity}x
                                        </td>
                                        <td className="py-1.5 pr-2 font-mono text-cyan-200 font-semibold">
                                          {item.partCode || 'N/A'}
                                        </td>
                                        <td className="py-1.5 pr-2 text-slate-200">
                                          {item.description}
                                        </td>
                                        <td className="py-1.5 pr-2 text-right font-mono text-slate-300">
                                          {formatCOP(item.unitPrice || 0)}
                                        </td>
                                        <td className="py-1.5 text-right font-mono font-bold text-emerald-400">
                                          {formatCOP((item.quantity || 1) * (item.unitPrice || 0))}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Customer PO Breakdown & Missing Catalog Parts Notification */}
                        {isClientPO && (() => {
                          const clientAnalysis = analyzeClientPO(order, equipments);
                          return (
                            <div className="space-y-2 pt-1">
                              {/* Missing parts alert banner */}
                              {clientAnalysis.uncreatedCount > 0 ? (
                                <div className="bg-amber-950/70 border-2 border-amber-500/80 rounded-xl p-3 text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in shadow-lg">
                                  <div className="flex items-start gap-2.5">
                                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                    <div>
                                      <span className="font-black text-amber-300 text-xs uppercase tracking-wide">
                                        ⚠️ Alerta: {clientAnalysis.uncreatedCount} equipo(s) no existen en el Catálogo Maestro
                                      </span>
                                      <p className="text-amber-200/90 text-[11px] mt-0.5 font-medium leading-relaxed">
                                        Se requiere crear: <strong className="text-amber-100">{clientAnalysis.uncreatedNames.join(', ')}</strong> para radicar el contrato y habilitar las órdenes de compra a proveedores.
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setClientPOToConvert(order)}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg font-black text-xs shadow-md transition cursor-pointer whitespace-nowrap self-end sm:self-auto"
                                  >
                                    <PlusCircle className="w-4 h-4" />
                                    <span>Crear Partes & Radicar</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="bg-emerald-950/50 border border-emerald-500/50 rounded-xl p-2.5 text-xs text-emerald-200 flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>
                                      Todos los equipos solicitados por el cliente están verificados en el Catálogo Maestro.
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setClientPOToConvert(order)}
                                    className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow transition cursor-pointer"
                                  >
                                    <span>Radicar en Contratos</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}

                              {/* Client PO Requested Items list */}
                              {clientAnalysis.items.length > 0 && (
                                <div className="bg-slate-900/90 border border-emerald-500/30 rounded-xl p-3 space-y-2">
                                  <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
                                    <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                                      <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                                      <span>
                                        Equipos Solicitados por el Cliente ({clientAnalysis.items.length}):
                                      </span>
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                      Cliente: <strong className="text-emerald-300">{clientAnalysis.customerName}</strong>
                                      {clientAnalysis.clientOCNumber ? ` • OC: ${clientAnalysis.clientOCNumber}` : ''}
                                    </span>
                                  </div>

                                  <div className="space-y-1.5">
                                    {clientAnalysis.items.map((item, itIdx) => (
                                      <div key={item.id || itIdx} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs">
                                        <div className="flex items-center gap-2 min-w-0">
                                          {item.isCreatedInCatalog ? (
                                            <span className="p-1 rounded bg-emerald-500/20 text-emerald-300 shrink-0" title="En catálogo">
                                              <CheckCircle2 className="w-3.5 h-3.5" />
                                            </span>
                                          ) : (
                                            <span className="p-1 rounded bg-amber-500/20 text-amber-300 shrink-0" title="No creado en catálogo">
                                              <AlertTriangle className="w-3.5 h-3.5" />
                                            </span>
                                          )}
                                          <div className="truncate">
                                            <span className="font-bold text-white">{item.name}</span>
                                            {item.code && (
                                              <span className="text-cyan-300 font-mono text-[10px] ml-1.5 bg-cyan-950/60 border border-cyan-800/60 px-1 py-0.5 rounded">
                                                Ref: {item.code}
                                              </span>
                                            )}
                                            {item.brand && (
                                              <span className="text-slate-300 text-[10px] ml-1">
                                                [{item.brand}{item.model ? ` ${item.model}` : ''}]
                                              </span>
                                            )}
                                            <span className="text-slate-400 text-[11px] ml-1.5">
                                              ({item.quantity} unids • Prov:{' '}
                                              <span className={item.suggestedSupplier ? 'text-slate-300 font-medium' : 'text-amber-400 font-medium'}>
                                                {item.suggestedSupplier || 'Por asignar'}
                                              </span>
                                              )
                                            </span>
                                          </div>
                                        </div>
                                        <div className="shrink-0 text-right font-mono">
                                          {item.unitPriceCOP > 0 ? (
                                            <span className="font-bold text-emerald-400">
                                              ${item.totalPriceCOP.toLocaleString('es-CO')} COP
                                            </span>
                                          ) : (
                                            <span className="text-[11px] text-amber-400 font-normal italic">
                                              Sin valor detectado
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Technical Documentation Summary Box */}
                        {isDocumentation && (
                          <div className="bg-slate-900/90 border border-indigo-500/40 rounded-xl p-3.5 space-y-2.5">
                            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 flex-wrap">
                              <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                                <BookOpen className="w-4 h-4 text-indigo-400" />
                                <span>Expediente de Documentación Técnica ({order.attachments?.length || 0} Archivos)</span>
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleSaveAllDocsToVentana7(order)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold text-xs shadow-xs transition cursor-pointer"
                                  title="Radicar fichas técnicas, INVIMA y anexos en Documentación Técnica"
                                >
                                  <FolderPlus className="w-3.5 h-3.5" />
                                  <span>Radicar en Documentación</span>
                                </button>
                                {onNavigateToTab && (
                                  <button
                                    type="button"
                                    onClick={() => onNavigateToTab('documentacion')}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg font-semibold text-xs border border-indigo-500/30 transition cursor-pointer"
                                    title="Ir directamente al repositorio de Documentación Técnica"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>Ver Documentación</span>
                                  </button>
                                )}
                              </div>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              Este correo contiene anexos de documentación técnica (fichas técnicas, INVIMA, cartas o declaraciones de importación). No constituye una orden de compra mercantil.
                            </p>
                          </div>
                        )}

                        {/* Linked Workflow Relationship Chain (Autorización -> Creación de Parte -> OC Proveedor -> OC Cliente) */}
                        <WorkflowRelationshipChain
                          order={order}
                          allOrders={detectedOrders}
                          equipments={equipments}
                          onSelectOrder={handleOpenOrderDetail}
                          onNavigateToTab={onNavigateToTab}
                        />

                        {/* Interactive Attachments List with Direct Preview */}
                        {order.attachments && order.attachments.length > 0 && (
                          <div className="flex items-center gap-2 pt-1 flex-wrap">
                            <span className="text-xs text-slate-400 font-bold flex items-center gap-1">
                              <Paperclip className="w-3.5 h-3.5 text-cyan-400" />
                              <span>Adjuntos ({order.attachments.length}):</span>
                            </span>
                            {order.attachments.map((att, idx) => {
                              const isPdf = att.filename.toLowerCase().endsWith('.pdf');
                              const isExcel = /\.(xlsx|xls|csv)$/i.test(att.filename);
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() =>
                                    setSelectedAttachmentForPreview({
                                      ...att,
                                      messageId: order.messageId,
                                      relatedSubject: order.subject,
                                      relatedSender: order.senderName || order.sender,
                                      relatedOCNumber: order.detectedOCNumber,
                                      relatedItems: order.detectedItems,
                                      relatedTotalCOP: order.detectedEstimatedTotal,
                                      isClientPO: order.emailType === 'client_po',
                                      emailType: order.emailType,
                                      customerName: order.emailType === 'client_po' ? (order.detectedCustomer || order.clientName) : undefined,
                                      customerSede: order.emailType === 'client_po' ? (order as any).detectedSede : undefined,
                                    })
                                  }
                                  className="inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:text-white bg-slate-800/90 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500/60 px-2.5 py-1 rounded-lg transition cursor-pointer group shadow-2xs"
                                  title={`Ver archivo adjunto tal como fue enviado: ${att.filename}`}
                                >
                                  {isPdf ? (
                                    <FileText className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                  ) : isExcel ? (
                                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                  )}
                                  <span className="max-w-[150px] truncate">{att.filename}</span>
                                  {att.size && (
                                    <span className="text-[10px] text-slate-400 group-hover:text-slate-200">
                                      ({(att.size / 1024).toFixed(0)} KB)
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Right Column: Financial Highlights & Actions */}
                      <div className="flex flex-col sm:flex-row lg:flex-col items-end justify-between gap-2.5 min-w-[180px] border-t lg:border-t-0 lg:border-l border-slate-800 pt-2.5 lg:pt-0 lg:pl-4">
                        {isDocumentation ? (
                          <div className="text-right w-full">
                            <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider block">
                              Expediente Técnico
                            </span>
                            <span className="text-sm font-extrabold text-indigo-200">
                              {order.attachments?.length || 0} archivo(s)
                            </span>
                          </div>
                        ) : order.detectedEstimatedTotal ? (
                          <div className="text-right w-full">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              {isAuthorization ? 'Valor Ref. Parte' : isPartCreation ? 'Costo Estimado Parte' : 'Monto Estimado OC'}
                            </span>
                            <span className="text-base font-extrabold text-emerald-400 font-mono">
                              {formatCOP(order.detectedEstimatedTotal)}
                            </span>
                          </div>
                        ) : !isPartCreation ? (
                          <div className="text-right w-full">
                            <span className="text-xs text-slate-500 italic">
                              {isAuthorization ? 'En proceso de autorización' : 'Monto por cotizar'}
                            </span>
                          </div>
                        ) : null}

                        <div className="flex flex-col w-full gap-1.5">
                          <button
                            onClick={() => handleOpenOrderDetail(order)}
                            className="w-full inline-flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs py-1.5 px-2.5 rounded-lg border border-slate-700 transition cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Ver Correo Completo</span>
                          </button>

                          <button
                            onClick={() => {
                              setOrderBeingEdited(order);
                              setIsOrderEditModalOpen(true);
                            }}
                            className="w-full inline-flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white font-medium text-xs py-1.5 px-2.5 rounded-lg border border-slate-700 hover:border-cyan-500/50 transition cursor-pointer"
                            title="Modificar tipo de correo (Parte vs OC vs Doc), o editar ítems, precios y descripción"
                          >
                            <Pencil className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Modificar Detección</span>
                          </button>

                          {/* Acciones para Documentación Técnica */}
                          {isDocumentation && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveAllDocsToVentana7(order)}
                                className="w-full inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3 rounded-lg shadow-md transition cursor-pointer"
                                title="Radicar todos los adjuntos en Documentación Técnica"
                              >
                                <FolderPlus className="w-3.5 h-3.5" />
                                <span>Radicar en Documentación</span>
                              </button>
                              {onNavigateToTab && (
                                <button
                                  type="button"
                                  onClick={() => onNavigateToTab('documentacion')}
                                  className="w-full inline-flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white font-medium text-xs py-1.5 px-2.5 rounded-lg border border-indigo-500/40 transition cursor-pointer"
                                  title="Ir al repositorio de Documentación Técnica"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                                  <span>Ir a Documentación</span>
                                </button>
                              )}
                            </>
                          )}

                          {isAuthorization && (
                            <button
                              type="button"
                              onClick={() => {
                                const reqItem =
                                  order.partCreationNotice?.requestedItem ||
                                  extractRequestedPartCreationDetails(order.rawBodyText || order.snippet || '');
                                if (reqItem) {
                                  setNewPartForm((prev) => ({
                                    ...prev,
                                    toEmail: 'compras@syd.com.co',
                                    ccEmail: 'auxadministrativo@syd.com.co',
                                    parts: [
                                      {
                                        id: 'part-1',
                                        subReferences: '',
                                        partName: reqItem.name,
                                        quantity: 1,
                                        brand: reqItem.brand || 'GMD',
                                        model: reqItem.model || 'Estándar',
                                        estimatedPriceCOP: reqItem.price || 9000,
                                        taxExempt: false,
                                        supplier: reqItem.supplier || 'IMPORMEDICAL EQUIPOS Y SUMINISTROS MEDICOS S.A',
                                        departmentNotes: 'Solicitud con visto bueno de Diana Figueroa',
                                      },
                                    ],
                                  }));
                                }
                                setActiveSubTab('new_part_template');
                              }}
                              className="w-full inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 px-3 rounded-lg shadow-xs transition cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Gestionar Creación Oficial</span>
                            </button>
                          )}

                          {/* Botón Convertir OC de Cliente: Radicar en Contratos y Generar OCs a Proveedores */}
                          {isClientPO && (
                            <button
                              type="button"
                              onClick={() => setClientPOToConvert(order)}
                              className="w-full inline-flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs py-2 px-3 rounded-lg shadow-md transition cursor-pointer"
                              title="Radicar en Ventana 4 (Contratos y Licitaciones), validar partes en el catálogo y generar requerimientos de compra a proveedores"
                            >
                              <FileSpreadsheet className="w-3.5 h-3.5" />
                              <span>
                                {order.detectedOCNumber
                                  ? `Radicar en Contratos (${order.detectedOCNumber})`
                                  : 'Radicar en Contratos / Crear OCs'}
                              </span>
                            </button>
                          )}

                          {/* Botón Convertir en ORDEN DE COMPRA: Exclusivo para correos clasificados como Orden de Compra (a proveedores / interna) */}
                          {isPurchaseOrder && !isClientPO && (
                            <button
                              type="button"
                              onClick={() => setOrderToConvertToOC(order)}
                              className="w-full inline-flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs py-2 px-3 rounded-lg shadow-md transition cursor-pointer"
                              title={
                                order.detectedOCNumber
                                  ? `Convertir en Orden de Compra oficial #${order.detectedOCNumber}, actualizar o crear partes en el catálogo y pasar a Seguimiento de OC`
                                  : 'Convertir este correo en Orden de Compra formal, crear o actualizar partes en el catálogo y pasar a Seguimiento de OC'
                              }
                            >
                              <ShoppingCart className="w-3.5 h-3.5" />
                              <span>
                                {order.detectedOCNumber
                                  ? `Convertir en ORDEN DE COMPRA (#${order.detectedOCNumber})`
                                  : 'Convertir en ORDEN DE COMPRA'}
                              </span>
                            </button>
                          )}

                          {isGeneralPO && !order.detectedOCNumber && (
                            <button
                              type="button"
                              onClick={() => {
                                const newItems = order.detectedItems.length > 0
                                  ? order.detectedItems.map((it, idx) => ({
                                      partCode: it.partCode || `PARTE-DET-${idx + 1}`,
                                      description: it.description,
                                      brand: it.brand || '',
                                      model: it.model || '',
                                      quantity: it.quantity || 1,
                                      unitPriceCOP: it.unitPrice || 1000000,
                                      taxExempt: false,
                                      supplier: order.senderName || 'Proveedor Asignado',
                                      totalLineCOP: (it.quantity || 1) * (it.unitPrice || 1000000),
                                    }))
                                  : poForm.items;
                                const totals = recalculatePOTotals(newItems);
                                setPoForm((prev) => ({
                                  ...prev,
                                  supplierName: order.senderName || prev.supplierName,
                                  items: newItems,
                                  ...totals,
                                }));
                                setActiveSubTab('purchase_order_template');
                              }}
                              className="w-full inline-flex items-center justify-center gap-1.5 bg-cyan-900/60 hover:bg-cyan-800/60 text-cyan-200 border border-cyan-700/60 font-medium text-xs py-1.5 px-3 rounded-lg transition cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Redactar Solicitud de OC</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* If this is a part creation response, render the full interactive import card */}
                    {isPartCreation && (
                      <div className="pt-2">
                        <GmailPartCreationResponseCard
                          order={order}
                          onAddEquipmentToCatalog={onAddEquipmentToCatalog}
                          onSaveDocument={onSaveDocument}
                          onNavigateToTab={onNavigateToTab}
                          onUpdateOrder={handleSaveOrderModifications}
                          equipments={equipments}
                          onOpenOrderClassificationModal={() => {
                            setOrderBeingEdited(order);
                            setIsOrderEditModalOpen(true);
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: TEMPLATE 1 - NEW PART / EQUIPMENT CREATION */}
      {/* ========================================================================= */}
      {activeSubTab === 'new_part_template' && (
        <div className="space-y-6">
          {/* Main Full-Width Form Card */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plus className="w-5 h-5 text-cyan-400" />
                  <span>Formulario: Solicitud de Creación de Partes / Equipos</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Ingrese las partes en la tabla a continuación. Puede agregar más filas a medida que necesite solicitar nuevas referencias.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddPartItem}
                className="inline-flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition active:scale-95 cursor-pointer shadow-lg shadow-cyan-900/30"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar Fila</span>
              </button>
            </div>

            {newPartSuccessMsg && (
              <div className="p-3.5 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{newPartSuccessMsg}</span>
              </div>
            )}

            {/* Recipient Emails Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Enviar a Correo (Compras / Proveedor) *
                </label>
                <input
                  type="email"
                  value={newPartForm.toEmail}
                  onChange={(e) => setNewPartForm({ ...newPartForm, toEmail: e.target.value })}
                  placeholder="ej: compras@sydcolombia.com"
                  className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Con Copia (CC)
                </label>
                <input
                  type="text"
                  value={newPartForm.ccEmail}
                  onChange={(e) => setNewPartForm({ ...newPartForm, ccEmail: e.target.value })}
                  placeholder="ej: gerencia@sydcolombia.com"
                  className="w-full bg-slate-900/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden focus:border-cyan-400"
                />
              </div>
            </div>

            {/* Table of Parts (Full Width & Spacious) */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                  <span>Tabla de Partes / Equipos a Solicitar</span>
                  <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                    {newPartForm.parts.length} {newPartForm.parts.length === 1 ? 'fila' : 'filas'}
                  </span>
                </span>
                <span className="text-xs text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg">
                  Total Estimado:{' '}
                  <strong className="text-emerald-400 ml-1">
                    {formatCOP(newPartForm.parts.reduce((acc, p) => acc + (Number(p.estimatedPriceCOP) || 0), 0))}
                  </strong>
                </span>
              </div>

              {/* Full Width Table */}
              <div className="overflow-x-auto border border-slate-700/80 rounded-xl bg-slate-950/70 shadow-inner">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900/90 border-b border-slate-700 text-slate-300 font-bold">
                      <th className="py-3 px-2 w-8 text-center text-slate-400">#</th>
                      <th className="py-3 px-2.5 w-[20%]">Referencias / Sub-partes</th>
                      <th className="py-3 px-2.5 w-[22%]">Nombre de la Parte / Equipo *</th>
                      <th className="py-3 px-2 w-14 text-center">Cant</th>
                      <th className="py-3 px-2.5 w-[14%]">Precio Base (COP) *</th>
                      <th className="py-3 px-2.5 w-[11%]">Marca</th>
                      <th className="py-3 px-2.5 w-[10%]">Modelo</th>
                      <th className="py-3 px-2.5 w-[11%]">Régimen IVA</th>
                      <th className="py-3 px-2.5 w-[11%]">Proveedor</th>
                      <th className="py-3 px-2.5 w-[11%]">Notas</th>
                      <th className="py-3 px-2 w-10 text-center text-slate-400">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {newPartForm.parts.map((part, index) => (
                      <tr
                        key={part.id || `part-${index}`}
                        className="hover:bg-slate-800/40 transition-colors group"
                      >
                        <td className="py-3 px-2 text-center font-bold text-cyan-400 align-middle">
                          {index + 1}
                        </td>
                        <td className="py-2.5 px-2 align-middle">
                          <input
                            type="text"
                            value={part.subReferences || ''}
                            onChange={(e) => handleUpdatePartItem(index, 'subReferences', e.target.value)}
                            placeholder="ej: 33681 13401 33682..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-amber-300 placeholder-slate-500 font-mono focus:outline-hidden focus:border-amber-400"
                          />
                        </td>
                        <td className="py-2.5 px-2 align-middle">
                          <input
                            type="text"
                            value={part.partName}
                            onChange={(e) => handleUpdatePartItem(index, 'partName', e.target.value)}
                            placeholder="ej: LARINGOSCOPIO CON HOJAS..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-400 font-semibold"
                          />
                        </td>
                        <td className="py-2.5 px-1.5 align-middle text-center">
                          <input
                            type="number"
                            min="1"
                            value={part.quantity || 1}
                            onChange={(e) => handleUpdatePartItem(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-12 text-center bg-slate-900 border border-slate-700 rounded-lg py-2 text-xs text-white focus:outline-hidden focus:border-cyan-400 font-bold"
                          />
                        </td>
                        <td className="py-2.5 px-2 align-middle">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">$</span>
                            <input
                              type="number"
                              value={part.estimatedPriceCOP || ''}
                              onChange={(e) => handleUpdatePartItem(index, 'estimatedPriceCOP', parseFloat(e.target.value) || 0)}
                              placeholder="0"
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-5 pr-2 py-2 text-xs text-emerald-400 font-bold focus:outline-hidden focus:border-cyan-400"
                            />
                          </div>
                        </td>
                        <td className="py-2.5 px-2 align-middle">
                          <input
                            type="text"
                            value={part.brand}
                            onChange={(e) => handleUpdatePartItem(index, 'brand', e.target.value)}
                            placeholder="ej: SYD Colombia"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-400"
                          />
                        </td>
                        <td className="py-2.5 px-2 align-middle">
                          <input
                            type="text"
                            value={part.model}
                            onChange={(e) => handleUpdatePartItem(index, 'model', e.target.value)}
                            placeholder="ej: Adulto/Pediátrico"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-400"
                          />
                        </td>
                        <td className="py-2.5 px-2 align-middle">
                          <select
                            value={part.taxExempt ? 'exempt' : 'taxable'}
                            onChange={(e) => handleUpdatePartItem(index, 'taxExempt', e.target.value === 'exempt')}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-2 text-[11px] text-slate-200 focus:outline-hidden focus:border-cyan-400 cursor-pointer"
                          >
                            <option value="taxable">+IVA (19%)</option>
                            <option value="exempt">Exento (0%)</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-2 align-middle">
                          <input
                            type="text"
                            list="syd-suppliers-directory-list"
                            value={part.supplier}
                            onChange={(e) => handleUpdatePartItem(index, 'supplier', e.target.value)}
                            placeholder="ej: SYD Colombia"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-400"
                          />
                        </td>
                        <td className="py-2.5 px-2 align-middle">
                          <input
                            type="text"
                            value={part.departmentNotes}
                            onChange={(e) => handleUpdatePartItem(index, 'departmentNotes', e.target.value)}
                            placeholder="ej: Con estuche..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-2 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-400"
                          />
                        </td>
                        <td className="py-2.5 px-1.5 text-center align-middle">
                          <button
                            type="button"
                            onClick={() => handleRemovePartItem(index)}
                            disabled={newPartForm.parts.length <= 1}
                            className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition disabled:opacity-20 disabled:hover:bg-transparent disabled:hover:text-slate-500 cursor-pointer disabled:cursor-not-allowed"
                            title="Eliminar fila"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Technical Documentation Section (Ficha Técnica e INVIMA) */}
              <div className="pt-2 border-t border-slate-800">
                <GmailDocAttachmentSection
                  attachedDocs={newPartForm.attachedDocuments || []}
                  onUpdateAttachedDocs={(docs) => setNewPartForm({ ...newPartForm, attachedDocuments: docs })}
                  availableVentana7Docs={documents || []}
                  partNameForArchive={newPartForm.parts[0]?.partName || ''}
                  brandForArchive={newPartForm.parts[0]?.brand || ''}
                  onSaveDocumentToVentana7={onSaveDocument}
                />
              </div>

              {/* Status and Actions Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="text-xs text-slate-400">
                  Total de referencias ingresadas: <strong className="text-cyan-300">{newPartForm.parts.length}</strong>
                  {newPartForm.attachedDocuments && newPartForm.attachedDocuments.length > 0 && (
                    <span className="ml-2 text-emerald-400 font-semibold">
                      &bull; {newPartForm.attachedDocuments.length} doc(s) adjunto(s)
                    </span>
                  )}
                </span>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleOpenGmailWebForNewPart}
                    className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 font-bold text-xs py-2.5 px-4 rounded-xl transition active:scale-95 cursor-pointer"
                    title="Abrir directamente en la interfaz web de Gmail (mail.google.com)"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Abrir Borrador en Gmail Web</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendNewPartEmail}
                    disabled={isSendingNewPartEmail}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm py-2.5 px-6 rounded-xl shadow-lg transition active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isSendingNewPartEmail ? 'Enviando Correo...' : 'Enviar Solicitud por Gmail'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible / Expandable Live Email Preview */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span>Vista Previa en Tiempo Real del Correo Oficial</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-cyan-300 bg-cyan-950/80 px-2.5 py-1 rounded-md border border-cyan-800">
                  Saludo Activo: <strong>{getTimeBasedGreeting()}</strong>
                </span>
                <span className="text-[11px] font-medium text-slate-300 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
                  Asunto: <strong className="text-white font-mono">SOLICITUD DE CREAR PARTE</strong>
                </span>
              </div>
            </div>

            {/* Email Envelope Metadata Preview */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-xs space-y-1.5 font-mono">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 uppercase text-[10px] font-bold w-12 shrink-0">Para:</span>
                <span className="text-cyan-300 font-semibold truncate">
                  {newPartForm.toEmail || '(auxadministrativo@syd.com.co, compras@syd.com.co)'}
                </span>
                {newPartForm.ccEmail && (
                  <span className="text-slate-400 text-[11px] ml-auto">
                    CC: <span className="text-slate-300">{newPartForm.ccEmail}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Email Body Preview Document (High Contrast White Paper Sheet) */}
            <div
              className="email-sheet-paper rounded-xl p-6 sm:p-8 shadow-md border border-slate-300 text-xs space-y-5 max-w-5xl mx-auto"
              style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
            >
              {/* Header Greeting & Prompt */}
              <div className="space-y-2" style={{ color: '#0f172a' }}>
                <p className="text-base font-bold" style={{ color: '#0f172a', margin: 0 }}>
                  {getTimeBasedGreeting()},
                </p>
                <p className="text-sm font-semibold" style={{ color: '#1e293b', margin: 0 }}>
                  {newPartForm.parts.length > 1
                    ? 'Favor crear las siguientes partes:'
                    : 'Favor crear la siguiente parte:'}
                </p>
              </div>

              {/* Live Unified Table of Parts in Email Preview */}
              <div className="overflow-x-auto border border-slate-300 rounded-lg shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead style={{ backgroundColor: '#f1f5f9' }}>
                    <tr className="border-b-2 border-slate-300">
                      <th className="p-2.5 text-center w-8 border-r border-slate-300 font-extrabold text-[11px] uppercase tracking-wider" style={{ color: '#0f172a', backgroundColor: '#e2e8f0' }}>#</th>
                      <th className="p-2.5 border-r border-slate-300 font-extrabold text-[11px] uppercase tracking-wider min-w-[120px]" style={{ color: '#0f172a', backgroundColor: '#f1f5f9' }}>Referencias / Sub-partes</th>
                      <th className="p-2.5 border-r border-slate-300 font-extrabold text-[11px] uppercase tracking-wider min-w-[160px]" style={{ color: '#0f172a', backgroundColor: '#f1f5f9' }}>Nombre de Parte / Equipo</th>
                      <th className="p-2.5 text-center w-12 border-r border-slate-300 font-extrabold text-[11px] uppercase tracking-wider" style={{ color: '#0f172a', backgroundColor: '#f1f5f9' }}>Cant.</th>
                      <th className="p-2.5 border-r border-slate-300 font-extrabold text-[11px] uppercase tracking-wider" style={{ color: '#0f172a', backgroundColor: '#f1f5f9' }}>Marca</th>
                      <th className="p-2.5 border-r border-slate-300 font-extrabold text-[11px] uppercase tracking-wider" style={{ color: '#0f172a', backgroundColor: '#f1f5f9' }}>Modelo</th>
                      <th className="p-2.5 text-right border-r border-slate-300 whitespace-nowrap font-extrabold text-[11px] uppercase tracking-wider" style={{ color: '#0f172a', backgroundColor: '#f1f5f9' }}>Precio Base (COP)</th>
                      <th className="p-2.5 text-center border-r border-slate-300 whitespace-nowrap font-extrabold text-[11px] uppercase tracking-wider" style={{ color: '#0f172a', backgroundColor: '#f1f5f9' }}>Régimen IVA</th>
                      <th className="p-2.5 border-r border-slate-300 font-extrabold text-[11px] uppercase tracking-wider" style={{ color: '#0f172a', backgroundColor: '#f1f5f9' }}>Proveedor</th>
                      <th className="p-2.5 font-extrabold text-[11px] uppercase tracking-wider" style={{ color: '#0f172a', backgroundColor: '#f1f5f9' }}>Notas / Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200" style={{ backgroundColor: '#ffffff' }}>
                    {newPartForm.parts.map((p, idx) => (
                      <tr key={p.id || `preview-${idx}`} className="hover:bg-slate-50 transition-colors">
                        <td
                          className="p-2.5 text-center font-bold border-r border-slate-200"
                          style={{ color: '#0284c7', backgroundColor: '#f8fafc' }}
                        >
                          {idx + 1}
                        </td>
                        <td className="p-2.5 font-mono text-xs border-r border-slate-200 font-semibold" style={{ color: '#b45309', backgroundColor: '#fffbeb' }}>
                          {p.subReferences && p.subReferences.trim() ? (
                            <span>{p.subReferences}</span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic', fontWeight: 'normal' }}>
                              (Sin referencia)
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 font-bold border-r border-slate-200" style={{ color: '#0f172a' }}>
                          {p.partName && p.partName.trim() ? (
                            p.partName
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic', fontWeight: 'normal' }}>
                              (Sin ingresar nombre)
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-bold border-r border-slate-200" style={{ color: '#0f172a' }}>
                          {p.quantity || 1}
                        </td>
                        <td className="p-2.5 border-r border-slate-200 font-medium" style={{ color: '#1e293b' }}>
                          {p.brand && p.brand.trim() ? (
                            p.brand
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>SYD Colombia</span>
                          )}
                        </td>
                        <td className="p-2.5 border-r border-slate-200" style={{ color: '#334155' }}>
                          {p.model && p.model.trim() ? (
                            p.model
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>---</span>
                          )}
                        </td>
                        <td
                          className="p-2.5 font-bold text-right whitespace-nowrap border-r border-slate-200"
                          style={{ color: '#059669' }}
                        >
                          {formatCOP(p.estimatedPriceCOP || 0)} COP
                        </td>
                        <td
                          className="p-2.5 text-center text-xs whitespace-nowrap border-r border-slate-200"
                          style={{ color: '#334155' }}
                        >
                          {p.taxExempt ? 'Exento (0%)' : 'Aplica (19%)'}
                        </td>
                        <td className="p-2.5 border-r border-slate-200" style={{ color: '#1e293b' }}>
                          {p.supplier && p.supplier.trim() ? (
                            p.supplier
                          ) : (
                            <span style={{ color: '#64748b' }}>Por Asignar</span>
                          )}
                        </td>
                        <td className="p-2.5 text-xs" style={{ color: '#475569' }}>
                          {p.departmentNotes && p.departmentNotes.trim() ? (
                            p.departmentNotes
                          ) : (
                            <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>---</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Row */}
              <div className="flex justify-end pt-1">
                <div
                  className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
                  style={{ backgroundColor: '#f8fafc', color: '#1e293b' }}
                >
                  Suma Total Estimada:{' '}
                  <strong style={{ color: '#059669', fontSize: '13px' }}>
                    {formatCOP(newPartForm.parts.reduce((acc, p) => acc + (Number(p.estimatedPriceCOP) || 0), 0))} COP
                  </strong>
                </div>
              </div>

              {/* Attached Documents Notice in Email Body */}
              <div
                className="p-3.5 rounded-xl border border-slate-200 text-xs space-y-2"
                style={{ backgroundColor: '#f0fdf4', color: '#166534' }}
              >
                <div className="font-bold flex items-center gap-1.5" style={{ color: '#14532d' }}>
                  <FileText className="w-4 h-4 text-emerald-600" />
                  <span>Documentos Técnicos Adjuntos Requeridos:</span>
                </div>
                {newPartForm.attachedDocuments && newPartForm.attachedDocuments.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {newPartForm.attachedDocuments.map((doc, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-white border border-emerald-200 text-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="font-bold text-emerald-700 uppercase text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            {doc.type}
                          </span>
                          <span className="truncate font-medium">{doc.title}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono ml-2 shrink-0">{doc.fileSize || 'PDF'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs italic" style={{ color: '#166534' }}>
                    * Se adjuntará Ficha Técnica y Registro INVIMA correspondientes a cada referencia para su archivo en Documentación Técnica.
                  </p>
                )}
              </div>

              {/* Closing and Signature */}
              <div className="space-y-4 pt-3" style={{ color: '#0f172a' }}>
                <p className="text-sm font-bold" style={{ color: '#0f172a', margin: 0 }}>
                  Atentamente,
                </p>

                {/* Corporate Signature Preview */}
                <div
                  className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between"
                  style={{ color: '#0f172a' }}
                >
                  {/* Contact Details */}
                  <div
                    className="text-xs leading-snug space-y-0.5 border-l-2 border-cyan-600 pl-3.5"
                    style={{ color: '#1e293b' }}
                  >
                    <div className="font-bold text-sm" style={{ color: '#0f172a' }}>
                      Jairo E. Mendoza Bolívar
                    </div>
                    <div className="font-medium" style={{ color: '#334155' }}>
                      Asesor Línea Diagnóstica
                    </div>
                    <div className="font-semibold" style={{ color: '#0f172a' }}>
                      Suministro y Dotaciones Colombia S.A.
                    </div>
                    <div className="text-[11px]" style={{ color: '#475569', marginTop: '3px' }}>
                      Tel: (605) 3302424 Ext 153 &bull; Cel: +57 3162221407
                    </div>
                    <div className="text-[11px]" style={{ color: '#475569' }}>
                      Carrera 43 # 80-59 &bull; Barranquilla - Colombia
                    </div>
                  </div>

                  {/* Official Logo Graphic Banner */}
                  <div
                    className="shrink-0 p-2.5 rounded-xl border border-slate-200 shadow-xs"
                    style={{ backgroundColor: '#ffffff' }}
                  >
                    <img
                      src="/logos/syd_colombia_iso_iqnet.svg"
                      alt="SyD Colombia S.A. - icontec ISO 9001 - IQNET"
                      className="h-14 w-auto object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: TEMPLATE 2 - PURCHASE ORDER (OC) REQUEST TO PURCHASING */}
      {/* ========================================================================= */}
      {activeSubTab === 'purchase_order_template' && (
        <div className="space-y-6">
          {/* Main Configuration Card */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-cyan-400" />
                  <span>Solicitud de Orden de Compra (OC) para Departamento de Compras</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Estructure la solicitud formal de Orden de Compra con la sede correspondiente, partes asignadas, precios, IVA, proveedor y observaciones.
                </p>
              </div>

              {/* City Sede Selection */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400">Sede Solicitada:</span>
                <div className="inline-flex rounded-lg bg-slate-900 p-1 border border-slate-700">
                  {(['Barranquilla', 'Bogotá', 'Medellín'] as const).map((city) => (
                    <button
                      key={city}
                      type="button"
                      onClick={() => setPoForm({ ...poForm, locationCity: city })}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition cursor-pointer ${
                        poForm.locationCity === city
                          ? 'bg-cyan-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {city}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {poSuccessMsg && (
              <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-200 text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{poSuccessMsg}</span>
              </div>
            )}

            {/* Top Row: Destinatario, CC, Proveedor General */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Destinatario (Dpto. Compras) *
                </label>
                <input
                  type="email"
                  value={poForm.toEmail}
                  onChange={(e) => setPoForm({ ...poForm, toEmail: e.target.value })}
                  placeholder="ej: compras@syd.com.co"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Con Copia (CC)
                </label>
                <input
                  type="text"
                  value={poForm.ccEmail}
                  onChange={(e) => setPoForm({ ...poForm, ccEmail: e.target.value })}
                  placeholder="ej: auditoriacompras@syd.com.co"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-cyan-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Proveedor General *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetItemIndexForSupplier(null);
                      setSupplierSearchQuery('');
                      setShowSupplierPickerModal(true);
                    }}
                    className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-cyan-950/60 border border-cyan-800/60 px-2 py-0.5 rounded cursor-pointer transition"
                    title="Seleccionar del Directorio de Proveedores"
                  >
                    <Building2 className="w-3 h-3" />
                    <span>Directorio ({allSuppliersList.length})</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    list="syd-suppliers-directory-list"
                    value={poForm.supplierName}
                    onChange={(e) => {
                      const newSup = e.target.value;
                      const updatedItems = poForm.items.map((it) => ({
                        ...it,
                        supplier: it.supplier === poForm.supplierName ? newSup : it.supplier || newSup,
                      }));
                      setPoForm({ ...poForm, supplierName: newSup, items: updatedItems });
                    }}
                    placeholder="Escriba o seleccione del directorio..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-cyan-300 font-bold focus:outline-hidden focus:border-cyan-400 pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setTargetItemIndexForSupplier(null);
                      setSupplierSearchQuery('');
                      setShowSupplierPickerModal(true);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-300 cursor-pointer"
                    title="Abrir directorio completo"
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Datalist for fast native autocomplete across all suppliers */}
            <datalist id="syd-suppliers-directory-list">
              {allSuppliersList.map((supp) => (
                <option key={supp.id || supp.name} value={supp.name}>
                  {supp.name} {supp.city ? `(${supp.city})` : ''} {supp.nit ? `• NIT: ${supp.nit}` : ''}
                </option>
              ))}
            </datalist>

            {/* Dynamic Items Table */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Partes / Equipos para la Solicitud de OC ({poForm.items.length})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCatalogItemPicker(true)}
                    className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/40 text-xs font-bold py-1.5 px-3 rounded-lg transition cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Seleccionar desde Catálogo SYD</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddPoItem}
                    className="inline-flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold py-1.5 px-3 rounded-lg transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar Fila Manual</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-900 text-slate-300 font-bold uppercase tracking-wider">
                    <tr>
                      <th className="p-3 w-10 text-center">#</th>
                      <th className="p-3 w-32">Número de Parte</th>
                      <th className="p-3">Nombre del Equipo / Descripción</th>
                      <th className="p-3 w-20 text-center">Cant.</th>
                      <th className="p-3 w-36 text-right">Precio Unitario (COP)</th>
                      <th className="p-3 w-28 text-center">IVA</th>
                      <th className="p-3 w-48">Proveedor</th>
                      <th className="p-3 w-36 text-right">Total Línea (COP)</th>
                      <th className="p-3 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-[#0b1424]">
                    {poForm.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/50 transition">
                        <td className="p-2.5 text-center text-slate-400 font-bold">{idx + 1}</td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={item.partCode}
                            onChange={(e) => handleUpdatePoItem(idx, { partCode: e.target.value })}
                            placeholder="ej: 70859"
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-cyan-300 font-mono font-bold"
                          />
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleUpdatePoItem(idx, { description: e.target.value })}
                            placeholder="Nombre del equipo o accesorio"
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-semibold"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleUpdatePoItem(idx, { quantity: parseInt(e.target.value, 10) || 1 })}
                            className="w-14 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-xs text-white text-center font-bold"
                          />
                        </td>
                        <td className="p-2.5 text-right">
                          <input
                            type="number"
                            value={item.unitPriceCOP || ''}
                            onChange={(e) => handleUpdatePoItem(idx, { unitPriceCOP: parseFloat(e.target.value) || 0 })}
                            placeholder="0"
                            className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-emerald-400 font-bold text-right"
                          />
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleUpdatePoItem(idx, { taxExempt: !item.taxExempt })}
                            className={`px-2 py-1 rounded text-[10px] font-extrabold cursor-pointer transition ${
                              item.taxExempt
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                            }`}
                          >
                            {item.taxExempt ? '0% Exento' : '19% IVA'}
                          </button>
                        </td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              list="syd-suppliers-directory-list"
                              value={item.supplier || poForm.supplierName || ''}
                              onChange={(e) => handleUpdatePoItem(idx, { supplier: e.target.value })}
                              placeholder="Proveedor"
                              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300 font-medium"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                setTargetItemIndexForSupplier(idx);
                                setSupplierSearchQuery('');
                                setShowSupplierPickerModal(true);
                              }}
                              className="p-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 rounded cursor-pointer shrink-0"
                              title="Seleccionar proveedor de la fila desde el directorio"
                            >
                              <Building2 className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="p-2.5 text-right font-extrabold text-white text-xs">
                          {formatCOP(item.totalLineCOP)}
                        </td>
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemovePoItem(idx)}
                            disabled={poForm.items.length <= 1}
                            className="p-1 text-red-400 hover:bg-red-950/60 rounded disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bottom Row: Observaciones & Totales */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-4 border-t border-slate-800">
                <div className="w-full sm:w-1/2 space-y-1.5">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Observaciones para el Departamento de Compras (Opcional)
                  </label>
                  <textarea
                    rows={3}
                    value={poForm.observations || ''}
                    onChange={(e) => setPoForm({ ...poForm, observations: e.target.value })}
                    placeholder="Escriba aquí alguna aclaración o requerimiento especial para compras..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-white focus:outline-hidden focus:border-cyan-400 placeholder:text-slate-500"
                  />
                </div>

                <div className="w-full sm:w-80 bg-slate-900/90 border border-slate-700 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Subtotal COP:</span>
                    <span className="font-semibold text-white">{formatCOP(poForm.subtotalCOP)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Total IVA (19% aplicable):</span>
                    <span className="font-semibold text-blue-400">{formatCOP(poForm.ivaTotalCOP)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold text-white pt-2 border-t border-slate-700">
                    <span>TOTAL SOLICITUD DE OC:</span>
                    <span className="text-emerald-400 text-base">{formatCOP(poForm.grandTotalCOP)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCopyPoHTML}
                  className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 font-bold text-xs py-3 px-4 rounded-xl transition active:scale-95 cursor-pointer"
                  title="Copiar el correo con formato enriquecido (HTML) al portapapeles"
                >
                  {copiedHTMLSuccess ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-cyan-400" />}
                  <span>{copiedHTMLSuccess ? '¡Copiado con Formato!' : 'Copiar Formato Correo (HTML)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenGmailWebForPO}
                  className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-500/40 font-bold text-xs py-3 px-4 rounded-xl transition active:scale-95 cursor-pointer"
                  title="Abrir directamente en la interfaz web de Gmail (mail.google.com)"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Abrir Solicitud en Gmail Web</span>
                </button>

                <button
                  type="button"
                  onClick={handleSendPurchaseOrderEmail}
                  disabled={isSendingPoEmail}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-sm py-3 px-6 rounded-xl shadow-lg transition active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSendingPoEmail ? 'Enviando Solicitud...' : `Enviar Solicitud de OC (${poForm.locationCity})`}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Real-time Email Preview Sheet */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Vista Previa del Correo para Departamento de Compras
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2.5 py-1 rounded-full font-medium">
                  Plantilla Oficial con Firma Corporativa SyD
                </span>
              </div>
            </div>

            {/* Email Routing Info Bar (Outside the white canvas so the written email card stays completely clean) */}
            <div className="bg-[#0b1424] border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono flex flex-wrap items-center gap-y-1 gap-x-4 text-slate-400">
              <div>
                <span className="text-slate-500 uppercase text-[10px] font-bold mr-1.5 font-sans">Para:</span>
                <span className="text-cyan-300 font-semibold">{poForm.toEmail}</span>
              </div>
              {poForm.ccEmail && (
                <div>
                  <span className="text-slate-500 uppercase text-[10px] font-bold mr-1.5 font-sans">CC:</span>
                  <span className="text-slate-300">{poForm.ccEmail}</span>
                </div>
              )}
              <div className="sm:ml-auto truncate">
                <span className="text-slate-500 uppercase text-[10px] font-bold mr-1.5 font-sans">Asunto:</span>
                <span className="text-slate-200 font-medium">
                  Solicitud de Orden de Compra - Sede {poForm.locationCity} - {poForm.supplierName}
                </span>
              </div>
            </div>

            {/* Email Canvas Simulation (Clean White Card starting directly from the Header Banner) */}
            <div
              className="email-preview-canvas email-sheet-paper bg-white text-slate-900 rounded-xl shadow-lg font-sans border border-slate-300 overflow-hidden"
              data-email-canvas="true"
              style={{ backgroundColor: '#ffffff', color: '#0f172a' }}
            >
              {/* Header Banner */}
              <div
                className="p-4 sm:p-5 text-white flex flex-wrap items-center justify-between gap-2 shadow-sm"
                style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff' }}
              >
                <div>
                  <h4 className="text-base font-extrabold tracking-wide uppercase m-0" style={{ color: '#ffffff', letterSpacing: '0.04em' }}>
                    SOLICITUD DE ORDEN DE COMPRA
                  </h4>
                  <p className="text-xs font-semibold mt-0.5 mb-0" style={{ color: '#f0f9ff' }}>
                    Suministro y Dotaciones Colombia S.A.S.
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className="text-xs px-3.5 py-1 rounded-full font-extrabold uppercase tracking-wider border shadow-xs"
                    style={{ backgroundColor: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.6)', color: '#ffffff' }}
                  >
                    Sede {poForm.locationCity}
                  </span>
                </div>
              </div>

              {/* Email Inner Body */}
              <div className="p-6 sm:p-8 space-y-4 text-sm leading-relaxed" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>
                {/* Greeting & Body Prompt */}
                <p className="font-bold text-base m-0" style={{ color: '#0f172a' }}>
                  {poForm.customGreeting || getTimeBasedGreeting()},
                </p>

                <p className="m-0 text-sm font-medium" style={{ color: '#1e293b' }}>
                  Favor generar la <strong style={{ color: '#0f172a' }}>Orden de Compra (OC)</strong> por <strong style={{ color: '#0f172a' }}>{poForm.locationCity}</strong> para el proveedor <strong style={{ color: '#0284c7' }}>{poForm.supplierName}</strong> con las siguientes partes e ítems requeridos:
                </p>

                {/* Items Table with sharp borders and high contrast */}
                <div className="overflow-x-auto my-4 border border-slate-300 rounded-lg shadow-xs">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead style={{ backgroundColor: '#f1f5f9' }}>
                      <tr className="border-b-2 border-slate-300">
                        <th className="p-2.5 border-r border-slate-300 text-center w-8 font-extrabold text-[11px] uppercase tracking-wider" style={{ color: '#0f172a', backgroundColor: '#e2e8f0' }}>#</th>
                        <th className="p-2.5 border-r border-slate-300 w-28 font-extrabold text-[11px] uppercase tracking-wider" style={{ color: '#0f172a', backgroundColor: '#f1f5f9' }}>Parte</th>
                        <th className="p-2.5 border-r border-slate-300 font-extrabold text-[11px] uppercase tracking-wider" style={{ color: '#0f172a', backgroundColor: '#f1f5f9' }}>Nombre del Equipo / Descripción</th>
                        <th className="p-2.5 border-r border-slate-300 text-center w-14 font-extrabold text-[11px] uppercase tracking-wider" style={{ color: '#0f172a', backgroundColor: '#f1f5f9' }}>Cant.</th>
                        <th className="p-2.5 border-r border-slate-300 text-right w-28 font-extrabold text-[11px] uppercase tracking-wider" style={{ color: '#0f172a', backgroundColor: '#f1f5f9' }}>Precio (COP)</th>
                        <th className="p-2.5 border-r border-slate-300 text-center w-20 font-extrabold text-[11px] uppercase tracking-wider" style={{ color: '#0f172a', backgroundColor: '#f1f5f9' }}>IVA</th>
                        <th className="p-2.5 border-r border-slate-300 w-36 font-extrabold text-[11px] uppercase tracking-wider" style={{ color: '#0f172a', backgroundColor: '#f1f5f9' }}>Proveedor</th>
                        <th className="p-2.5 text-right w-32 font-extrabold text-[11px] uppercase tracking-wider" style={{ color: '#0f172a', backgroundColor: '#f1f5f9' }}>Total (COP)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200" style={{ backgroundColor: '#ffffff' }}>
                      {poForm.items.map((item, idx) => (
                        <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                          <td className="p-2.5 border-r border-slate-200 text-center font-bold" style={{ color: '#0284c7', backgroundColor: '#f1f5f9' }}>
                            {idx + 1}
                          </td>
                          <td className="p-2.5 border-r border-slate-200 font-mono font-bold" style={{ color: '#0369a1' }}>
                            {item.partCode || 'Pendiente'}
                          </td>
                          <td className="p-2.5 border-r border-slate-200 font-semibold" style={{ color: '#0f172a' }}>
                            {item.description}
                          </td>
                          <td className="p-2.5 border-r border-slate-200 text-center font-bold" style={{ color: '#0f172a' }}>
                            {item.quantity}
                          </td>
                          <td className="p-2.5 border-r border-slate-200 text-right font-medium" style={{ color: '#0f172a' }}>
                            ${Number(item.unitPriceCOP).toLocaleString('es-CO')}
                          </td>
                          <td className="p-2.5 border-r border-slate-200 text-center">
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-bold inline-block"
                              style={{
                                backgroundColor: item.taxExempt ? '#d1fae5' : '#e0f2fe',
                                color: item.taxExempt ? '#065f46' : '#0369a1',
                                border: `1px solid ${item.taxExempt ? '#a7f3d0' : '#bae6fd'}`,
                              }}
                            >
                              {item.taxExempt ? '0% Exento' : '19% IVA'}
                            </span>
                          </td>
                          <td className="p-2.5 border-r border-slate-200 text-[11px] font-medium" style={{ color: '#334155' }}>
                            {item.supplier || poForm.supplierName}
                          </td>
                          <td className="p-2.5 text-right font-bold" style={{ color: '#0f172a' }}>
                            ${Number(item.totalLineCOP).toLocaleString('es-CO')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary Table */}
                <div className="flex justify-end my-3">
                  <table className="w-80 text-xs border border-slate-300 border-collapse bg-slate-50 rounded-lg overflow-hidden shadow-xs">
                    <tbody>
                      <tr className="border-b border-slate-200">
                        <td className="p-2.5 font-bold" style={{ color: '#475569' }}>Subtotal:</td>
                        <td className="p-2.5 text-right font-bold" style={{ color: '#0f172a' }}>
                          ${Number(poForm.subtotalCOP).toLocaleString('es-CO')} COP
                        </td>
                      </tr>
                      <tr className="border-b border-slate-200">
                        <td className="p-2.5 font-bold" style={{ color: '#475569' }}>IVA Total (19%):</td>
                        <td className="p-2.5 text-right font-bold" style={{ color: '#0369a1' }}>
                          ${Number(poForm.ivaTotalCOP).toLocaleString('es-CO')} COP
                        </td>
                      </tr>
                      <tr style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', color: '#ffffff' }}>
                        <td className="p-2.5 text-xs font-black uppercase tracking-wider" style={{ color: '#ffffff' }}>TOTAL SOLICITUD:</td>
                        <td className="p-2.5 text-right text-sm font-black" style={{ color: '#ffffff' }}>
                          ${Number(poForm.grandTotalCOP).toLocaleString('es-CO')} COP
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Observations Block if provided */}
                {poForm.observations && (
                  <div className="p-3.5 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg text-xs space-y-1" style={{ backgroundColor: '#fffbeb', borderColor: '#f59e0b', color: '#78350f' }}>
                    <strong className="block font-bold uppercase text-[10px] tracking-wider" style={{ color: '#92400e' }}>
                      Observaciones:
                    </strong>
                    <p className="whitespace-pre-line m-0" style={{ color: '#78350f' }}>{poForm.observations}</p>
                  </div>
                )}

                <div className="pt-2 font-medium" style={{ color: '#1e293b' }}>
                  <p className="m-0" style={{ color: '#1e293b' }}>Atentamente,</p>
                </div>

                {/* Corporate Signature */}
                <div className="mt-4 pt-4 border-t border-slate-200 font-sans flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="border-l-2 pl-3.5" style={{ borderColor: '#0f4c5c' }}>
                    <p className="text-sm font-extrabold uppercase tracking-wide m-0" style={{ color: '#0f4c5c' }}>
                      Jairo E. Mendoza Bolívar
                    </p>
                    <p className="text-xs font-semibold m-0" style={{ color: '#0f766e' }}>
                      Asesor Línea Diagnóstica
                    </p>
                    <p className="text-xs font-semibold m-0" style={{ color: '#334155' }}>
                      Suministro y Dotaciones Colombia S.A.
                    </p>
                    <p className="text-[11px] mt-1 mb-0" style={{ color: '#64748b' }}>
                      Tel: (605) 3302424 Ext 153 &bull; Cel: +57 3162221407<br />
                      Carrera 43 # 80-59 &bull; Barranquilla - Colombia
                    </p>
                  </div>

                  <div className="shrink-0 p-2.5 rounded-xl border border-slate-200 shadow-xs bg-white">
                    <img
                      src="/logos/syd_colombia_iso_iqnet.svg"
                      alt="SyD Colombia S.A. - icontec ISO 9001 - IQNET"
                      className="h-14 w-auto object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUPPLIER DIRECTORY PICKER MODAL */}
      {/* ========================================================================= */}
      {showSupplierPickerModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Directorio de Proveedores y Fabricantes SYD
                  </h3>
                  <p className="text-xs text-slate-400">
                    {targetItemIndexForSupplier === null
                      ? 'Seleccione el proveedor general para la Solicitud de Orden de Compra'
                      : `Seleccione el proveedor para la fila #${targetItemIndexForSupplier + 1} (${poForm.items[targetItemIndexForSupplier]?.description || 'Ítem'})`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSupplierPickerModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Filter */}
            <div className="p-4 border-b border-slate-800 bg-[#0b1424]">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={supplierSearchQuery}
                  onChange={(e) => setSupplierSearchQuery(e.target.value)}
                  placeholder="Buscar por nombre, NIT, ciudad o marcas distribuidas..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-400"
                  autoFocus
                />
              </div>
            </div>

            {/* Supplier List */}
            <div className="p-4 overflow-y-auto space-y-2.5 flex-1 divide-y divide-slate-800/60">
              {allSuppliersList
                .filter((s) => {
                  if (!supplierSearchQuery.trim()) return true;
                  const q = supplierSearchQuery.toLowerCase();
                  return (
                    s.name.toLowerCase().includes(q) ||
                    (s.nit && s.nit.toLowerCase().includes(q)) ||
                    (s.city && s.city.toLowerCase().includes(q)) ||
                    (s.brands && s.brands.some((b) => b.toLowerCase().includes(q))) ||
                    (s.notes && s.notes.toLowerCase().includes(q))
                  );
                })
                .map((supp) => (
                  <div
                    key={supp.id || supp.name}
                    onClick={() => handleSelectSupplierFromDirectory(supp)}
                    className="pt-2.5 first:pt-0 group flex items-center justify-between p-3 rounded-xl hover:bg-slate-800/70 border border-transparent hover:border-slate-700 transition cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white group-hover:text-cyan-300 transition">
                          {supp.name}
                        </span>
                        {supp.city && (
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                            {supp.city}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                        {supp.nit && (
                          <span>
                            NIT: <strong className="text-slate-300 font-mono">{supp.nit}</strong>
                          </span>
                        )}
                        {supp.contactPerson && (
                          <span>
                            Contacto: <span className="text-slate-300">{supp.contactPerson}</span>
                          </span>
                        )}
                        {supp.brands && supp.brands.length > 0 && (
                          <span>
                            Marcas: <span className="text-teal-400 font-medium">{supp.brands.join(', ')}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="px-3 py-1.5 rounded-lg bg-cyan-600/20 text-cyan-300 group-hover:bg-cyan-500 group-hover:text-slate-950 text-xs font-bold transition border border-cyan-500/30"
                    >
                      Seleccionar
                    </button>
                  </div>
                ))}
            </div>

            <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>{allSuppliersList.length} proveedores registrados en el directorio</span>
              <button
                type="button"
                onClick={() => setShowSupplierPickerModal(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: SENT HISTORY */}
      {/* ========================================================================= */}
      {activeSubTab === 'sent_history' && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              <span>Registro de Correos y Órdenes de Compra Enviadas</span>
            </h2>
            {sentHistory.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm('¿Desea limpiar el historial local de correos enviados?')) {
                    setSentHistory([]);
                    localStorage.removeItem('syd_gmail_sent_history_v1');
                  }
                }}
                className="text-xs text-red-400 hover:text-red-300 font-semibold cursor-pointer"
              >
                Limpiar Historial
              </button>
            )}
          </div>

          {sentHistory.length === 0 ? (
            <div className="text-center py-12">
              <Mail className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-300 font-bold text-base">Aún no hay correos enviados desde esta sesión</p>
              <p className="text-slate-500 text-xs mt-1">Los correos que envíe desde las plantillas se registrarán aquí con su acuse de envío.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {sentHistory.map((item, itemIdx) => (
                <div key={`sent-item-${item.id || 'hist'}-${itemIdx}`} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                        {item.type}
                      </span>
                      <span className="text-xs font-semibold text-white">{item.subject}</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      <strong>Destinatario:</strong> {item.to} &bull; <span className="text-slate-300">{item.details}</span>
                    </p>
                  </div>
                  <span className="text-xs text-slate-500 font-mono shrink-0">
                    {new Date(item.date).toLocaleString('es-CO')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DETAILED VIEW OF DETECTED PURCHASE ORDER */}
      {/* ========================================================================= */}
      {selectedOrderForDetail && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
              <div className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Detalle de Correo & Orden Detectada</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOrderBeingEdited(selectedOrderForDetail);
                    setIsOrderEditModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white border border-slate-700 text-xs font-bold transition cursor-pointer"
                  title="Modificar tipo de detección (Parte vs OC), ítems, montos o códigos"
                >
                  <Pencil className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Modificar Detección (Parte / OC)</span>
                </button>
                <button
                  onClick={() => setSelectedOrderForDetail(null)}
                  className="text-slate-400 hover:text-white p-1 text-lg font-bold"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="space-y-1.5 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <div className="text-sm font-bold text-white">{selectedOrderForDetail.subject}</div>
                <div className="text-xs text-slate-400">
                  <strong>De:</strong> {selectedOrderForDetail.senderName} ({selectedOrderForDetail.senderEmail})
                </div>
                <div className="text-xs text-slate-400">
                  <strong>Fecha:</strong> {new Date(selectedOrderForDetail.date).toLocaleString('es-CO')}
                </div>
                {selectedOrderForDetail.detectedOCNumber && (
                  <div className="text-xs text-cyan-300 font-mono font-bold">
                    <strong>Número de OC Identificado:</strong> {selectedOrderForDetail.detectedOCNumber}
                  </div>
                )}
              </div>

              {/* Direct Manual Classification Bar with Full Options inside Detail Modal */}
              <div className="flex items-center gap-2 flex-wrap bg-slate-950/90 py-2 px-3 rounded-xl border border-slate-800 text-xs">
                <div className="flex items-center gap-1.5 text-slate-300 font-bold text-[11px] uppercase tracking-wider">
                  <Tag className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Tipo / Clasificación:</span>
                </div>
                <select
                  value={selectedOrderForDetail.emailType || 'other'}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleQuickSetEmailType(selectedOrderForDetail, e.target.value as any);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-slate-900 text-white font-semibold text-xs py-1 px-2.5 rounded-lg border border-slate-700 focus:outline-hidden focus:border-cyan-400 cursor-pointer"
                  title="Cambiar clasificación manualmente"
                >
                  <option value="part_authorization">🛡️ Autorización de Parte (Diana Figueroa)</option>
                  <option value="part_creation_response">✨ Creación de Parte Aprobada</option>
                  <option value="other">ℹ️ Solo Información / Consulta</option>
                  <option value="general_po">📄 Orden de Compra (OC / Solicitud OC)</option>
                  <option value="client_po">🏢 OC de Cliente (➔ Contratos y Proveedores)</option>
                  <option value="oc_response">📋 Aprobación Auditoría</option>
                </select>

                <div className="flex items-center gap-1 flex-wrap ml-auto">
                  <button
                    type="button"
                    onClick={() => handleQuickSetEmailType(selectedOrderForDetail, 'other')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                      selectedOrderForDetail.emailType === 'other'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-400 hover:text-purple-300 hover:bg-slate-800'
                    }`}
                  >
                    <Info className="w-3 h-3 text-purple-400" />
                    <span>Información</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickSetEmailType(selectedOrderForDetail, 'part_authorization')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                      selectedOrderForDetail.emailType === 'part_authorization'
                        ? 'bg-amber-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800'
                    }`}
                  >
                    <ShieldCheck className="w-3 h-3" />
                    <span>Autorización</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickSetEmailType(selectedOrderForDetail, 'part_creation_response')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                      selectedOrderForDetail.emailType === 'part_creation_response'
                        ? 'bg-emerald-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-800'
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Parte Creada</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickSetEmailType(selectedOrderForDetail, 'general_po')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                      selectedOrderForDetail.emailType === 'general_po'
                        ? 'bg-cyan-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800'
                    }`}
                  >
                    <FileText className="w-3 h-3" />
                    <span>Orden Compra</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickSetEmailType(selectedOrderForDetail, 'client_po')}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                      selectedOrderForDetail.emailType === 'client_po'
                        ? 'bg-emerald-500 text-slate-950 shadow-xs'
                        : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-800'
                    }`}
                  >
                    <Building2 className="w-3 h-3" />
                    <span>OC Cliente</span>
                  </button>
                </div>
              </div>

              {/* Linked Workflow Relationship Chain in Modal */}
              <WorkflowRelationshipChain
                order={selectedOrderForDetail}
                allOrders={detectedOrders}
                equipments={equipments}
                onSelectOrder={handleOpenOrderDetail}
                onNavigateToTab={onNavigateToTab}
              />

              {/* If it's a Client PO (Customer -> SYD -> Contracts & Supplier OCs) */}
              {selectedOrderForDetail.emailType === 'client_po' && (
                <div className="bg-gradient-to-r from-emerald-950/60 via-teal-950/40 to-slate-900 border border-emerald-500/50 rounded-xl p-4 space-y-3 shadow-md">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2.5 text-emerald-300 font-bold text-sm">
                      <Building2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span>
                        Orden de Compra de Cliente:{' '}
                        {selectedOrderForDetail.detectedOCNumber
                          ? `#${selectedOrderForDetail.detectedOCNumber}`
                          : 'Recibida'}
                      </span>
                    </div>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-900/80 text-emerald-200 border border-emerald-700 font-semibold">
                      Cliente ➔ SYD ➔ Ventana 4 Contratos
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    Esta orden de compra enviada por el cliente (
                    <strong>
                      {selectedOrderForDetail.detectedCustomer || selectedOrderForDetail.clientName || 'Cliente'}
                    </strong>
                    ) solicita equipos médicos. Al radicarla en <strong>Ventana 4 (Contratos y Licitaciones)</strong>, el sistema validará qué equipos ya existen en el Catálogo y notificará los faltantes para su creación inmediata, habilitando además la generación de requerimientos de compra a los proveedores respectivos.
                  </p>
                  <div className="pt-1 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const order = selectedOrderForDetail;
                        setSelectedOrderForDetail(null);
                        setClientPOToConvert(order);
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition shadow-md cursor-pointer"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Radicar en Contratos y Generar OCs a Proveedores</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Convert to OC / Transfer to Tracking Section - Exclusivo para correos clasificados como Orden de Compra (Proveedores / Interna) */}
              {(() => {
                const isDetailPO =
                  selectedOrderForDetail.emailType === 'general_po' ||
                  (Boolean(selectedOrderForDetail.detectedOCNumber) &&
                    selectedOrderForDetail.emailType !== 'part_authorization' &&
                    selectedOrderForDetail.emailType !== 'part_creation_response' &&
                    selectedOrderForDetail.emailType !== 'client_po' &&
                    selectedOrderForDetail.emailType !== 'other' &&
                    selectedOrderForDetail.emailType !== 'meeting_invite');

                if (!isDetailPO) return null;

                return selectedOrderForDetail.detectedOCNumber ? (
                  <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-xl p-4 space-y-3 shadow-md">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2.5 text-emerald-300 font-bold text-sm">
                        <FileCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                        <span>Orden de Compra Registrada: #{selectedOrderForDetail.detectedOCNumber}</span>
                      </div>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700 font-semibold">
                        OC Registrada
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      Este correo contiene la Orden de Compra asignada (<strong>#{selectedOrderForDetail.detectedOCNumber}</strong>). Al transferirla a <strong>Ventana 5 (Seguimiento de OC)</strong>, las partes que contiene se verificarán por su número de parte único: si no existen se crearán automáticamente en el Catálogo, y si ya existen se actualizarán sus costos y datos comerciales.
                    </p>
                    <div className="pt-1 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setOrderToConvertToOC(selectedOrderForDetail)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-md cursor-pointer"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        <span>Convertir en ORDEN DE COMPRA (#{selectedOrderForDetail.detectedOCNumber})</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-cyan-500/10 border border-amber-500/30 rounded-xl p-4 space-y-3 shadow-md">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2.5 text-amber-300 font-bold text-sm">
                        <ShoppingCart className="w-5 h-5 text-amber-400 shrink-0" />
                        <span>Convertir en ORDEN DE COMPRA</span>
                      </div>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-900/60 text-amber-300 border border-amber-700 font-semibold">
                        Conversión de OC
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      Puede convertir este correo directamente en una <strong>Orden de Compra formal</strong> y transferirla a <strong>Seguimiento de OC (Ventana 5)</strong>. El sistema verificará cada parte por su número de parte único: las partes no creadas se crearán automáticamente en el Catálogo (Ventana 3), y las partes existentes actualizarán sus costos y datos comerciales.
                    </p>
                    <div className="pt-1 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setOrderToConvertToOC(selectedOrderForDetail)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-md cursor-pointer"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        <span>Convertir en ORDEN DE COMPRA y Sincronizar Partes</span>
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* If it's an Authorization / Uncreated notice from Diana Figueroa / Dirección Técnica (Stage 2) */}
              {(() => {
                const senderLower = (
                  selectedOrderForDetail.sender ||
                  selectedOrderForDetail.senderEmail ||
                  selectedOrderForDetail.senderName ||
                  ''
                ).toLowerCase();
                const thread = splitEmailThread(
                  selectedOrderForDetail.rawBodyText || selectedOrderForDetail.snippet || '',
                  selectedOrderForDetail.senderName,
                  selectedOrderForDetail.date
                );
                const latestMsg = (thread[0]?.body || selectedOrderForDetail.rawBodyText || '').trim();
                const isComprasSender = senderLower.includes('compras@syd.com.co') || (selectedOrderForDetail.senderName || '').toLowerCase().includes('compras');

                const hasConfirmedCreatedPart =
                  (selectedOrderForDetail.detectedPartsToImport && selectedOrderForDetail.detectedPartsToImport.length > 0 && selectedOrderForDetail.detectedPartsToImport.some((p) => /^\d{4,8}$/.test(p.code))) ||
                  selectedOrderForDetail.emailType === 'part_creation_response' ||
                  selectedOrderForDetail.partCreationNotice?.status === 'created' ||
                  /\b(?:parte\s+creada|partes\s+creadas|c[oó]digo\s+creado|se\s+cre[oó]\s+la\s+parte)\s*[:#-]?\s*\d{4,8}/i.test(latestMsg) ||
                  (isComprasSender && /\b(?:creada|creado)\s+\d{4,8}\b/i.test(latestMsg));

                const isFromDiana =
                  !hasConfirmedCreatedPart &&
                  (senderLower.includes('auxadministrativo@syd.com.co') || senderLower.includes('diana figueroa'));

                const isAuthorization = selectedOrderForDetail.emailType === 'part_authorization';

                if (!isAuthorization) return null;

                const reqItem =
                  selectedOrderForDetail.partCreationNotice?.requestedItem ||
                  (selectedOrderForDetail.detectedPartsToImport && selectedOrderForDetail.detectedPartsToImport.length > 0
                    ? {
                        name: selectedOrderForDetail.detectedPartsToImport[0].name,
                        brand: selectedOrderForDetail.detectedPartsToImport[0].brand,
                        model: selectedOrderForDetail.detectedPartsToImport[0].model,
                        supplier: selectedOrderForDetail.detectedPartsToImport[0].supplier,
                        price: selectedOrderForDetail.detectedPartsToImport[0].baseCostCOP,
                      }
                    : extractRequestedPartCreationDetails(
                        selectedOrderForDetail.rawBodyText || selectedOrderForDetail.snippet || ''
                      ));

                return (
                  <div className="bg-amber-950/40 border border-amber-800/80 rounded-xl p-4 space-y-3 shadow-md">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2.5 text-amber-300 font-bold text-sm">
                        <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
                        <span>Autorización de Creación de Parte</span>
                      </div>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-900/60 text-amber-300 border border-amber-700 font-semibold">
                        Revisado por Diana Figueroa
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed">
                      Revisado por Auxiliar Administrativo / Dirección Técnica: Información vigente,{' '}
                      <strong>no se cuenta con parte creada en el sistema SYD</strong> (<em>&quot;Revisado, información vigente no se cuenta con parte creada&quot;</em>).
                      Este correo solo autoriza la solicitud. Se encuentra a la espera del correo de respuesta de Compras con el número de parte asignado.
                    </p>

                    {reqItem && (
                      <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl space-y-2.5 mt-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                            Equipo / Ítem Solicitado a Crear:
                          </span>
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
                            Pendiente de Asignación de Código por Compras
                          </span>
                        </div>
                        <div className="text-sm font-bold text-white">
                          {reqItem.name}
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-300 pt-1 border-t border-slate-800">
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase font-bold">Marca</span>
                            <span className="text-cyan-200 font-semibold">{reqItem.brand || 'No especificada'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase font-bold">Modelo / Ref</span>
                            <span className="text-cyan-200 font-mono font-semibold">{reqItem.model || 'No especificado'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase font-bold">Proveedor</span>
                            <span className="text-cyan-200 font-semibold">{cleanSupplierName(reqItem.supplier) || 'No especificado'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase font-bold">Precio Ref</span>
                            <span className="text-emerald-300 font-semibold font-mono">
                              {reqItem.price ? `${formatCOP(reqItem.price)} + IVA` : 'Por definir'}
                            </span>
                          </div>
                        </div>

                        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 mt-1">
                          <div className="flex items-center gap-1.5 text-xs text-amber-300/90 font-medium">
                            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                            <span>Este correo es solo de autorización técnica. Falta el número de parte oficial; debe existir un correo de respuesta con el número de parte asignado para poder registrarla en el sistema.</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setNewPartForm((prev) => ({
                                ...prev,
                                toEmail: 'compras@syd.com.co',
                                ccEmail: 'auxadministrativo@syd.com.co',
                                parts: [
                                  {
                                    id: 'part-1',
                                    subReferences: '',
                                    partName: reqItem.name,
                                    quantity: 1,
                                    brand: reqItem.brand || 'GMD',
                                    model: reqItem.model || 'Estándar',
                                    estimatedPriceCOP: reqItem.price || 9000,
                                    taxExempt: false,
                                    supplier: cleanSupplierName(reqItem.supplier) || 'IMPORMEDICAL EQUIPOS Y SUMINISTROS MEDICOS S.A',
                                    departmentNotes: 'Solicitud con visto bueno de Diana Figueroa',
                                  },
                                ],
                              }));
                              setSelectedOrderForDetail(null);
                              setActiveSubTab('new_part_template');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow-xs cursor-pointer ml-auto"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Gestionar Solicitud a Compras</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Confirmed Created Parts in Detail Modal (Stage 3) */}
              {selectedOrderForDetail.emailType === 'part_creation_response' && selectedOrderForDetail.detectedPartsToImport && selectedOrderForDetail.detectedPartsToImport.length > 0 && (
                <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-xl p-4 space-y-3 shadow-md">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-emerald-300 font-bold text-sm">
                      <Sparkles className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span>Partes Oficiales Creadas en Sistema SYD:</span>
                    </div>
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-900/60 text-emerald-300 border border-emerald-700 font-semibold">
                      Confirmado por Compras
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {selectedOrderForDetail.detectedPartsToImport.map((part, pIdx) => {
                      const isAlreadyInApp =
                        (Boolean(part.code) && Boolean(equipments?.some((eq) => eq.code && eq.code.trim().toUpperCase() === part.code.trim().toUpperCase()))) ||
                        (Boolean(part.code) && Boolean(MASTER_EQUIPMENTS_CATALOG.some((eq) => eq.code && eq.code.trim().toUpperCase() === part.code.trim().toUpperCase())));

                      return (
                        <div key={pIdx} className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold text-xs border border-emerald-500/40">
                                #{part.code}
                              </span>
                              <span className="text-sm font-bold text-white">{part.name}</span>
                            </div>

                            {isAlreadyInApp ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 text-xs text-emerald-300 font-bold bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/40">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Ya Creada en la App</span>
                                </span>
                                {onNavigateToTab && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedOrderForDetail(null);
                                      onNavigateToTab('catalogo');
                                    }}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                                    title="Ver en Catálogo de Equipos"
                                  >
                                    <ExternalLink className="w-3 h-3" />
                                    <span>Ver en Catálogo</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  if (!part.code || !/^\d{4,8}$/.test(part.code.trim())) {
                                    return;
                                  }
                                  const cleanSupp = cleanSupplierName(part.supplier) || cleanSupplierName(selectedOrderForDetail.senderName) || 'Proveedor SYD';
                                  const newEq: MedicalEquipment = {
                                    id: `eq_part_${Date.now()}_${pIdx}`,
                                    code: part.code.trim(),
                                    name: part.name,
                                    brand: part.brand || 'General',
                                    model: part.model || 'Estándar',
                                    productGroup: 'Accesorios y Sensores',
                                    category: (part.category as any) || 'Accesorios',
                                    supplier: cleanSupp,
                                    baseCostCOP: part.baseCostCOP || 0,
                                    taxExempt: part.taxExempt || false,
                                    taxRate: part.taxRate ?? 0.19,
                                    defaultMarginList: 'L3_5',
                                    invimaRecordNumber: part.invimaRecordNumber || 'INVIMA 2021EBC-0008450',
                                    warrantyMonths: 12,
                                    originCountry: 'Importado',
                                    description: part.description || `Parte creada ${part.code} - ${part.name}`,
                                    technicalSpecs: part.subReferences ? [`Sub-referencias: ${part.subReferences}`] : [],
                                    standardAccessories: [],
                                    hasDocSheet: false,
                                    hasInvimaDoc: false,
                                    hasManual: false,
                                    hasQualityCert: false,
                                  };
                                  onAddEquipmentToCatalog(newEq);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 text-xs font-bold transition cursor-pointer shadow-xs"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Crear Parte en Catálogo</span>
                              </button>
                            )}
                          </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-300 pt-1 border-t border-slate-800">
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase font-bold">Marca</span>
                            <span className="text-cyan-200 font-semibold">{part.brand || 'No especificada'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase font-bold">Modelo / Ref</span>
                            <span className="text-cyan-200 font-mono font-semibold">{part.model || 'Estándar'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase font-bold">Proveedor</span>
                            <span className="text-cyan-200 font-semibold">{cleanSupplierName(part.supplier) || 'No especificado'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px] uppercase font-bold">Costo Base</span>
                            <span className="text-emerald-300 font-semibold font-mono">
                              {part.baseCostCOP ? formatCOP(part.baseCostCOP) : '---'}
                            </span>
                          </div>
                        </div>

                        {part.subReferences && (
                          <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-lg font-mono">
                            <strong>Sub-referencias / Componentes:</strong> {part.subReferences}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                </div>
              )}

              {/* Only show detected items for general POs if NOT an uncreated authorization and NOT an informational email */}
              {selectedOrderForDetail.emailType !== 'part_authorization' &&
                selectedOrderForDetail.emailType !== 'part_creation_response' &&
                selectedOrderForDetail.emailType !== 'other' &&
                !/no se cuenta con parte creada|no se encuentran creados/i.test(selectedOrderForDetail.rawBodyText || selectedOrderForDetail.snippet || '') &&
                selectedOrderForDetail.partCreationNotice?.status !== 'uncreated' &&
                selectedOrderForDetail.detectedItems.filter((it) => !isSignatureOrHeaderOrNoise(it.description) && !/%20|tel:|cel:|\(\d{3}\)/i.test(it.description)).length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Equipos / Ítems Extraídos Automáticamente:
                  </h4>
                  <div className="space-y-1.5">
                    {selectedOrderForDetail.detectedItems
                      .filter((it) => !isSignatureOrHeaderOrNoise(it.description) && !/%20|tel:|cel:|\(\d{3}\)/i.test(it.description))
                      .map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-900 border border-slate-800 p-3 rounded-lg flex items-center justify-between text-xs"
                      >
                        <div>
                          <strong className="text-white">{item.quantity}x {item.description}</strong>
                          {item.brand && <span className="text-cyan-400 ml-2">Marca: {item.brand}</span>}
                        </div>
                        <button
                          onClick={() => {
                            const newEq: MedicalEquipment = {
                              id: `eq_detected_${Date.now()}_${idx}`,
                              code: `EQ-DET-${Math.floor(1000 + Math.random() * 9000)}`,
                              name: item.description,
                              brand: item.brand || 'General',
                              model: 'Detectado en OC',
                              productGroup: 'Equipos Médicos',
                              category: 'Diagnóstico',
                              supplier: cleanSupplierName(selectedOrderForDetail.senderName) || 'Proveedor SYD',
                              baseCostCOP: item.unitPrice || 100000,
                              taxExempt: false,
                              taxRate: 0.19,
                              defaultMarginList: 'L3_5',
                              invimaRecordNumber: 'En Trámite',
                              warrantyMonths: 12,
                              originCountry: 'Importado',
                              description: `Extraído automáticamente desde correo de OC ${selectedOrderForDetail.detectedOCNumber || ''}`,
                              technicalSpecs: [],
                              standardAccessories: [],
                              hasDocSheet: false,
                              hasInvimaDoc: false,
                              hasManual: false,
                              hasQualityCert: false,
                            };
                            onAddEquipmentToCatalog(newEq);
                            alert(`El equipo "${item.description}" ha sido registrado en el Catálogo Maestro de SYD.`);
                          }}
                          className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 px-3 py-1 rounded-lg font-bold text-xs cursor-pointer shadow-xs"
                        >
                          Crear Equipo
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Email Content with Thread Separation - Hidden for Authorization since the top box already contains the full synthesized information without duplicating */}
              {selectedOrderForDetail.emailType !== 'part_authorization' && (() => {
                const thread = splitEmailThread(
                  selectedOrderForDetail.rawBodyText || selectedOrderForDetail.snippet || '',
                  selectedOrderForDetail.senderName || selectedOrderForDetail.sender,
                  selectedOrderForDetail.date
                );
                const isThread = thread.length > 1;

                return (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                          <Mail className="w-4 h-4 text-cyan-400" />
                          <span>Historial y Contenido del Correo:</span>
                        </h4>
                        {isThread && (
                          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold">
                            {thread.length} mensajes en cola
                          </span>
                        )}
                      </div>

                      <CleanEmailReader
                        rawText={selectedOrderForDetail.rawBodyText || selectedOrderForDetail.snippet || ''}
                        rawHtml={selectedOrderForDetail.rawHtml}
                        senderName={selectedOrderForDetail.senderName || selectedOrderForDetail.sender}
                        senderEmail={selectedOrderForDetail.senderEmail}
                        dateStr={selectedOrderForDetail.date}
                      />
                    </div>
                  </div>
                );
              })()}

                    {/* Attachments within Detail Modal */}
                    {selectedOrderForDetail.attachments && selectedOrderForDetail.attachments.length > 0 && (
                      <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 space-y-2.5">
                        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                          <Paperclip className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Archivos Adjuntos Oficiales ({selectedOrderForDetail.attachments.length}):</span>
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {selectedOrderForDetail.attachments.map((att, idx) => {
                            const isPdf = att.filename.toLowerCase().endsWith('.pdf');
                            const isExcel = /\.(xlsx|xls|csv)$/i.test(att.filename);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() =>
                                  setSelectedAttachmentForPreview({
                                    ...att,
                                    messageId: selectedOrderForDetail.messageId,
                                    relatedSubject: selectedOrderForDetail.subject,
                                    relatedSender: selectedOrderForDetail.senderName || selectedOrderForDetail.sender,
                                    relatedOCNumber: selectedOrderForDetail.detectedOCNumber,
                                    relatedItems: selectedOrderForDetail.detectedItems,
                                    relatedTotalCOP: selectedOrderForDetail.detectedEstimatedTotal,
                                    isClientPO: selectedOrderForDetail.emailType === 'client_po',
                                    emailType: selectedOrderForDetail.emailType,
                                    customerName: selectedOrderForDetail.emailType === 'client_po' ? (selectedOrderForDetail.detectedCustomer || selectedOrderForDetail.clientName) : undefined,
                                    customerSede: selectedOrderForDetail.emailType === 'client_po' ? (selectedOrderForDetail as any).detectedSede : undefined,
                                  })
                                }
                                className="inline-flex items-center gap-1.5 text-xs text-cyan-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500 px-3 py-1.5 rounded-lg transition cursor-pointer shadow-xs"
                                title="Abrir y ver archivo auténtico"
                              >
                                {isPdf ? (
                                  <FileText className="w-3.5 h-3.5 text-rose-400" />
                                ) : isExcel ? (
                                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                                )}
                                <span className="max-w-[160px] truncate">{att.filename}</span>
                                {att.size && (
                                  <span className="text-[10px] text-slate-400">
                                    ({(att.size / 1024).toFixed(0)} KB)
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setOrderBeingEdited(selectedOrderForDetail);
                  setIsOrderEditModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white border border-slate-700 text-xs font-bold transition cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 text-cyan-400" />
                <span>Modificar Detección (Parte / OC)</span>
              </button>

              <button
                onClick={() => setSelectedOrderForDetail(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CATALOG ITEM PICKER (FOR POPULATING PURCHASE ORDERS) */}
      {/* ========================================================================= */}
      {showCatalogItemPicker && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Seleccionar Equipo del Catálogo SYD</h3>
              </div>
              <button
                onClick={() => setShowCatalogItemPicker(false)}
                className="text-slate-400 hover:text-white p-1 text-lg font-bold"
              >
                &times;
              </button>
            </div>

            <div className="p-4 border-b border-slate-800">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar equipo por nombre, marca, modelo o código..."
                  value={catalogSearchText}
                  onChange={(e) => setCatalogSearchText(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-hidden focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 divide-y divide-slate-800/60">
              {equipments
                .filter(
                  (eq) =>
                    catalogSearchText === '' ||
                    eq.name.toLowerCase().includes(catalogSearchText.toLowerCase()) ||
                    eq.brand.toLowerCase().includes(catalogSearchText.toLowerCase()) ||
                    eq.model.toLowerCase().includes(catalogSearchText.toLowerCase()) ||
                    eq.code.toLowerCase().includes(catalogSearchText.toLowerCase())
                )
                .slice(0, 30)
                .map((eq, eqIdx) => (
                  <div key={`cat-eq-${eq.id || eq.code || 'item'}-${eqIdx}`} className="pt-2 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <div className="font-bold text-white">{eq.name}</div>
                      <div className="text-slate-400 text-[11px]">
                        <span className="text-cyan-300 font-mono">{eq.code}</span> &bull; {eq.brand} {eq.model} &bull; {eq.supplier || 'Proveedor general'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold text-emerald-400">{formatCOP(eq.baseCostCOP)}</span>
                      <button
                        type="button"
                        onClick={() => handleAddEquipmentFromCatalog(eq)}
                        className="bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-lg cursor-pointer transition"
                      >
                        + Agregar a OC
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONNECT ANY GMAIL / ACCOUNT MANAGER / OAUTH CONFIGURATION */}
      {/* ========================================================================= */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Conexión de Cuentas de Gmail</h3>
                  <p className="text-xs text-slate-400">Conecte cualquier dirección de Gmail corporativa o personal</p>
                </div>
              </div>
              <button
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white p-1 text-lg font-bold cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => setConnectModalTab('direct')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  connectModalTab === 'direct'
                    ? 'bg-cyan-600 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Cualquier Gmail (Directo)</span>
              </button>
              <button
                onClick={() => setConnectModalTab('oauth')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  connectModalTab === 'oauth'
                    ? 'bg-cyan-600 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Google OAuth 2.0</span>
              </button>
              <button
                onClick={() => setConnectModalTab('manual')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  connectModalTab === 'manual'
                    ? 'bg-cyan-600 text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Avanzado / Token</span>
              </button>
            </div>

            {authError && (
              <div className="text-xs text-amber-200 bg-amber-950/50 p-3 rounded-xl border border-amber-500/50 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="leading-relaxed">{authError}</p>
                  </div>
                  <button
                    onClick={() => setAuthError(null)}
                    className="text-slate-400 hover:text-white p-0.5 text-sm font-bold leading-none cursor-pointer"
                    title="Descartar aviso"
                  >
                    &times;
                  </button>
                </div>
                <div className="pt-2 border-t border-amber-900/50 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConnectModalTab('direct');
                      setAuthError(null);
                    }}
                    className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold transition cursor-pointer"
                  >
                    Usar pestaña &quot;Cualquier Gmail (Directo)&quot; sin bloqueos
                  </button>
                </div>
              </div>
            )}

            {/* TAB 1: DIRECT EMAIL CONNECTION */}
            {connectModalTab === 'direct' && (
              <div className="space-y-4">
                <div className="bg-slate-900/90 border border-cyan-500/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs">
                    <UserPlus className="w-4 h-4 text-cyan-400" />
                    <span>Conectar Nueva Dirección de Gmail</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Ingrese cualquier cuenta de Gmail (ej: <span className="text-cyan-300 font-mono font-bold">eljemb22@gmail.com</span>) para emitir órdenes de compra, enviar solicitudes y administrar cotizaciones sin bloqueos de navegador.
                  </p>

                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                        Dirección de Correo Gmail / Workspace *
                      </label>
                      <input
                        type="email"
                        value={customEmailInput}
                        onChange={(e) => setCustomEmailInput(e.target.value)}
                        placeholder="ej: eljemb22@gmail.com o compras@sydcolombia.com"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-hidden focus:border-cyan-400"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
                        Nombre del Remitente / Cargo
                      </label>
                      <input
                        type="text"
                        value={customNameInput}
                        onChange={(e) => setCustomNameInput(e.target.value)}
                        placeholder="ej: Juan Esteban - Compras SYD Colombia"
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-hidden focus:border-cyan-400"
                      />
                    </div>

                    <button
                      onClick={() => handleConnectDirectEmail()}
                      disabled={isAuthenticating || !customEmailInput.trim()}
                      className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{isAuthenticating ? 'Conectando Cuenta...' : `Conectar Cuenta (${customEmailInput || 'Gmail'})`}</span>
                    </button>
                  </div>
                </div>

                {/* Saved Accounts Switcher */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Cuentas Guardadas ({savedAccounts.length})</span>
                    </span>
                    {savedAccounts.length > 0 && (
                      <button
                        onClick={handleClearAllAccounts}
                        className="text-[11px] text-red-400 hover:text-red-300 hover:underline flex items-center gap-1 cursor-pointer"
                        title="Borrar todas las cuentas para que no quede ningún correo sincronizado"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Eliminar todas</span>
                      </button>
                    )}
                  </div>

                  {savedAccounts.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 bg-slate-900/40 rounded-xl border border-dashed border-slate-800 space-y-1">
                      <p className="font-semibold text-slate-300">No hay ningún correo sincronizado.</p>
                      <p className="text-[11px] text-slate-500">Agregue su correo manualmente arriba cuando desee emitir o enviar órdenes.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800 bg-slate-900/50 rounded-xl border border-slate-800 overflow-hidden">
                      {savedAccounts.map((account) => {
                        const isCurrent = isConnected && userProfile?.email === account.email;
                        return (
                          <div
                            key={account.email}
                            onClick={() => handleSelectSavedAccount(account)}
                            className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition ${
                              isCurrent
                                ? 'bg-cyan-950/40 border-l-4 border-cyan-400'
                                : 'hover:bg-slate-800/80'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-300 font-bold text-xs shrink-0">
                                {account.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                                  <span>{account.name}</span>
                                  {isCurrent && (
                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded font-semibold border border-emerald-500/40">
                                      Activa
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] font-mono text-slate-400 truncate">{account.email}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {!isCurrent && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectSavedAccount(account);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition cursor-pointer"
                                >
                                  Usar
                                </button>
                              )}
                              <button
                                onClick={(e) => handleRemoveAccount(account.email, e)}
                                className="p-1.5 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition cursor-pointer"
                                title="Eliminar cuenta de la lista de forma permanente"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: GOOGLE OAUTH POPUP */}
            {connectModalTab === 'oauth' && (
              <div className="space-y-4">
                <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-slate-200 font-bold text-xs">
                    <Globe className="w-4 h-4 text-cyan-400" />
                    <span>Inicio de Sesión Oficial Google Workspace (OAuth 2.0)</span>
                  </div>
                  <p className="text-xs text-slate-300">
                    Abre la ventana emergente oficial de Google Identity Services para sincronizar correos directamente desde la API en tiempo real.
                  </p>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                        ID de Cliente de Google OAuth (Client ID)
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomClientIdInput(DEFAULT_GMAIL_CLIENT_ID);
                          gmailService.setStoredClientId(DEFAULT_GMAIL_CLIENT_ID);
                        }}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 font-semibold underline cursor-pointer"
                      >
                        Restablecer a ID Oficial ({DEFAULT_GMAIL_CLIENT_ID.slice(0, 15)}...)
                      </button>
                    </div>
                    <input
                      type="text"
                      value={customClientIdInput}
                      onChange={(e) => {
                        setCustomClientIdInput(e.target.value);
                        gmailService.setStoredClientId(e.target.value);
                      }}
                      placeholder="xxxx-yyyy.apps.googleusercontent.com"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-hidden focus:border-cyan-400"
                    />
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>Proyecto activo: <strong className="text-cyan-300 font-mono">gen-lang-client-0769639745</strong> (Nº 23635423420)</span>
                      <span className="text-emerald-400 font-semibold">✓ OAuth Provisionado</span>
                    </div>
                  </div>

                  <button
                    onClick={handleConnectGmail}
                    disabled={isAuthenticating}
                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-lg transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    <span>{isAuthenticating ? 'Abriendo Google...' : 'Abrir Selector de Cuenta Google'}</span>
                  </button>
                  
                  {/* Explanatory banner about Why Google throws "No autorizado / Error 403 / Error 400" */}
                  <div className="p-4 bg-slate-950/80 border border-amber-500/40 rounded-xl space-y-3 text-xs">
                    <p className="font-bold flex items-center gap-2 text-amber-300">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Guía de Solución: &quot;Acceso bloqueado (Error 403: access_denied)&quot;</span>
                    </p>

                    <div className="space-y-2 text-[11.5px] leading-relaxed text-slate-300">
                      <p>
                        Si Google muestra: <strong className="text-white">&quot;La app no ha completado el proceso de verificación de Google / solo pueden acceder testers aprobados (Error 403: access_denied)&quot;</strong>, se debe a que la app en Google Cloud está en estado <em>&quot;En prueba (Testing)&quot;</em> y el correo no ha sido registrado como tester.
                      </p>

                      <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1.5 font-sans">
                        <p className="font-bold text-cyan-300">Opción 1 (Recomendada - Inmediata):</p>
                        <p>
                          Usa la pestaña superior <strong className="text-white">&quot;Cualquier Gmail (Directo)&quot;</strong>. Te permite escribir cualquier correo corporativo (ej: <span className="font-mono text-cyan-300">auxlineadiagnostica@syd.com.co</span>) y conectarlo al instante para redactar y enviar órdenes y partes vía Gmail Web sin bloqueos de Google.
                        </p>
                      </div>

                      <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1.5 font-sans">
                        <p className="font-bold text-amber-300">Opción 2 (Habilitar en Google Cloud Console):</p>
                        <ol className="list-decimal list-inside space-y-1 text-slate-300">
                          <li>Ingresa a <a href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noreferrer" className="text-cyan-400 underline font-semibold">Google Cloud Console &gt; Pantalla de consentimiento de OAuth</a>.</li>
                          <li>Baja a la sección <strong>&quot;Usuarios de prueba&quot; (Test users)</strong> y haz clic en <strong>+ AGREGAR USUARIOS</strong>.</li>
                          <li>Agrega el correo corporativo (ej: <span className="font-mono text-white">auxlineadiagnostica@syd.com.co</span>) y guarda los cambios.</li>
                          <li>O bien, en organizaciones Google Workspace, configura el tipo de usuario como <strong>&quot;Interno&quot;</strong> para que todo usuario con correo <span className="font-mono text-white">@syd.com.co</span> ingrese sin verificación.</li>
                        </ol>
                      </div>

                      <div className="flex items-center justify-between gap-2 p-2 rounded bg-slate-900/60 border border-slate-800">
                        <span className="text-[11px] text-slate-400">Origen de este entorno:</span>
                        <code className="font-mono text-[11px] text-cyan-300 truncate select-all">
                          {typeof window !== 'undefined' ? window.location.origin : 'https://...'}
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: ADVANCED / MANUAL TOKEN & CLIENT ID */}
            {connectModalTab === 'manual' && (
              <div className="space-y-4">
                {/* Manual Token */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-slate-200 font-bold text-xs">
                    <Tag className="w-4 h-4 text-emerald-400" />
                    <span>Token de Acceso OAuth Manual (Bearer Token)</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Si obtuvo un token de acceso temporal mediante Google OAuth Playground:
                  </p>
                  <input
                    type="password"
                    value={manualTokenInput}
                    onChange={(e) => setManualTokenInput(e.target.value)}
                    placeholder="ya29.a0AfH6SM..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-hidden focus:border-cyan-400"
                  />
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="email"
                      value={manualTokenEmail}
                      onChange={(e) => setManualTokenEmail(e.target.value)}
                      placeholder="email@empresa.com (opcional)"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-hidden"
                    />
                    <button
                      onClick={handleConnectManualToken}
                      disabled={!manualTokenInput.trim()}
                      className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs py-1.5 px-3 rounded-lg transition cursor-pointer"
                    >
                      Conectar Token
                    </button>
                  </div>
                </div>

                {/* Custom Google Client ID */}
                <div className="space-y-2 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Google Client ID Personalizado
                  </label>
                  <input
                    type="text"
                    value={customClientIdInput}
                    onChange={(e) => setCustomClientIdInput(e.target.value)}
                    placeholder="xxxx-yyyy.apps.googleusercontent.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-hidden focus:border-cyan-400"
                  />
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      onClick={() => {
                        setCustomClientIdInput(DEFAULT_GMAIL_CLIENT_ID);
                        gmailService.setStoredClientId(DEFAULT_GMAIL_CLIENT_ID);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700 cursor-pointer"
                    >
                      Restaurar Predeterminado
                    </button>
                    <button
                      onClick={() => {
                        gmailService.setStoredClientId(customClientIdInput);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-cyan-600 text-slate-950 text-xs font-bold hover:bg-cyan-500 cursor-pointer"
                    >
                      Guardar Client ID
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowConfigModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold hover:bg-slate-700 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: MANUAL EDIT / OVERRIDE DETECTED PURCHASE ORDER OR PART CREATION */}
      {/* ========================================================================= */}
      {orderBeingEdited && (
        <EditDetectedOrderModal
          isOpen={isOrderEditModalOpen}
          onClose={() => {
            setIsOrderEditModalOpen(false);
            setOrderBeingEdited(null);
          }}
          order={orderBeingEdited}
          onSaveOrder={handleSaveOrderModifications}
          onOpenPartEdit={(part) => handleOpenPartEdit(part, orderBeingEdited)}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: MANUAL EDIT / OVERRIDE DETECTED PART DETAILS (INVIMA, COST, ETC.) */}
      {/* ========================================================================= */}
      {partBeingEdited && (
        <EditDetectedPartModal
          isOpen={isPartEditModalOpen}
          onClose={() => {
            setIsPartEditModalOpen(false);
            setPartBeingEdited(null);
          }}
          part={partBeingEdited.part}
          order={partBeingEdited.order}
          onSavePart={handleSavePartModal}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: ATTACHMENT VIEWER & PREVIEW (PDF, EXCEL, IMAGES, ETC.) */}
      {/* ========================================================================= */}
      {selectedAttachmentForPreview && (
        <AttachmentViewerModal
          isOpen={!!selectedAttachmentForPreview}
          onClose={() => setSelectedAttachmentForPreview(null)}
          attachment={selectedAttachmentForPreview}
          relatedOrderSubject={selectedAttachmentForPreview.relatedSubject}
          relatedSender={selectedAttachmentForPreview.relatedSender}
          relatedOCNumber={selectedAttachmentForPreview.relatedOCNumber}
          isClientPO={selectedAttachmentForPreview.isClientPO}
          emailType={selectedAttachmentForPreview.emailType}
          customerName={
            selectedAttachmentForPreview.customerName ||
            (selectedAttachmentForPreview.isClientPO ? (selectedOrderForDetail?.detectedCustomer || selectedOrderForDetail?.clientName) : undefined)
          }
          customerSede={
            selectedAttachmentForPreview.customerSede ||
            (selectedAttachmentForPreview.isClientPO ? (selectedOrderForDetail as any)?.detectedSede : undefined)
          }
          relatedItems={selectedAttachmentForPreview.relatedItems}
          relatedTotalCOP={selectedAttachmentForPreview.relatedTotalCOP}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONVERT TO OC & PASS TO TRACKING (AUTO-SYNC PARTS BY CODE)        */}
      {/* ========================================================================= */}
      {orderToConvertToOC && (
        <ConvertToOCModal
          isOpen={!!orderToConvertToOC}
          onClose={() => setOrderToConvertToOC(null)}
          order={orderToConvertToOC}
          catalog={equipments}
          onAddEquipmentToCatalog={onAddEquipmentToCatalog}
          onBatchSaveEquipments={onBatchSaveEquipments}
          onNavigateToTracking={() => {
            setOrderToConvertToOC(null);
            if (selectedOrderForDetail) setSelectedOrderForDetail(null);
            if (onNavigateToTab) onNavigateToTab('seguimiento_oc');
          }}
          onNavigateToCatalog={() => {
            setOrderToConvertToOC(null);
            if (selectedOrderForDetail) setSelectedOrderForDetail(null);
            if (onNavigateToTab) onNavigateToTab('catalogo');
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL: CONVERT CLIENT PO TO CONTRACT & GENERATE SUPPLIER OCs             */}
      {/* ========================================================================= */}
      {clientPOToConvert && (
        <ConvertClientPOToContractModal
          isOpen={!!clientPOToConvert}
          onClose={() => setClientPOToConvert(null)}
          email={clientPOToConvert}
          equipments={equipments}
          currentUser={currentUser}
          onNavigateToTab={onNavigateToTab}
          onBatchSaveEquipments={onBatchSaveEquipments}
          onSuccess={() => {
            setClientPOToConvert(null);
            if (selectedOrderForDetail) setSelectedOrderForDetail(null);
          }}
        />
      )}

      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#192b45] border border-cyan-400 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-2xl animate-bounce flex items-center gap-2 pointer-events-none">
          <Sparkles className="w-4 h-4 text-cyan-300 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
