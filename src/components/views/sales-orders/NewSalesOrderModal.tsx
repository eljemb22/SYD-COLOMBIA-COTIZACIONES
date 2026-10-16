import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Plus,
  Trash2,
  PackageCheck,
  Building2,
  Calendar,
  Layers,
  FileCheck2,
  Sparkles,
  CheckCircle2,
  Tag,
  ReceiptText,
  CheckSquare,
  Square,
  ArrowRight,
  ShoppingCart,
  Award,
  FileText,
  Search,
  MapPin,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  AlertTriangle,
} from 'lucide-react';
import {
  SalesOrderRecord,
  SalesOrderItem,
  SalesOrderStatus,
  SalesOrderEquipmentStatus,
  OCTrackingContract,
  SavedQuote,
  MedicalEquipment,
  AuthUser,
  TenderClientProject,
  SupplierProfile,
} from '../../../types';
import { resolveItemManufacturerBrand } from '../../../utils/equipmentBrandResolver';
import { generateNextSalesOrderNumber } from '../../../utils/salesOrdersStorage';
import { formatCOP } from '../../../utils/formatters';
import { getStoredClients, ClientRecord } from '../../../utils/clientStorage';
import { isSalesOrderDeleted } from '../../../utils/tombstones';
import { getStoredSupplierProfiles } from '../../../utils/ocTrackingStorage';

interface NewSalesOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (order: SalesOrderRecord, generateOCNow?: boolean) => void;
  orderToEdit?: SalesOrderRecord | null;
  initialQuoteToConvert?: SavedQuote | null;
  initialTenderToConvert?: TenderClientProject | null;
  existingOrders: SalesOrderRecord[];
  savedQuotes: SavedQuote[];
  tenderClients?: TenderClientProject[];
  contracts: OCTrackingContract[];
  equipments: MedicalEquipment[];
  currentUser?: AuthUser | null;
}

export const NewSalesOrderModal: React.FC<NewSalesOrderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  orderToEdit,
  initialQuoteToConvert,
  initialTenderToConvert,
  existingOrders,
  savedQuotes,
  tenderClients = [],
  contracts = [],
  equipments,
  currentUser,
}) => {
  const [originType, setOriginType] = useState<'quote' | 'tender' | 'manual'>('quote');
  const [salesOrderNumber, setSalesOrderNumber] = useState('');
  const [selectedQuoteId, setSelectedQuoteId] = useState('');
  const [quoteNumber, setQuoteNumber] = useState('');
  const [selectedTenderClientId, setSelectedTenderClientId] = useState('');
  const [selectedContractId, setSelectedContractId] = useState('');
  const [contractId, setContractId] = useState<string | undefined>(undefined);
  const [contractNumber, setContractNumber] = useState<string | undefined>(undefined);
  const [clientName, setClientName] = useState('');
  const [clientNit, setClientNit] = useState('');
  const [clientCity, setClientCity] = useState('');
  const [clientContactPerson, setClientContactPerson] = useState('');
  const [clientContactPhone, setClientContactPhone] = useState('');
  const [clientContactEmail, setClientContactEmail] = useState('');
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [status, setStatus] = useState<SalesOrderStatus>('En Proceso');
  const [notes, setNotes] = useState('');

  // Client Autocomplete State
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [clientSuggestions, setClientSuggestions] = useState<ClientRecord[]>([]);
  const clientInputWrapperRef = useRef<HTMLDivElement>(null);

  // Listen for click outside client suggestions
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        clientInputWrapperRef.current &&
        !clientInputWrapperRef.current.contains(e.target as Node)
      ) {
        setShowClientSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update suggestions when user types client name
  const handleClientNameChange = (val: string) => {
    setClientName(val);
    if (!val || val.trim().length < 1) {
      setShowClientSuggestions(false);
      setClientSuggestions([]);
      return;
    }

    const query = val.trim().toLowerCase();
    const allKnownClients = getStoredClients();
    
    // Also gather clients from existing tender projects and saved quotes
    const extraClients: ClientRecord[] = [];
    const seenNames = new Set(allKnownClients.map((c) => c.name.toLowerCase()));

    (tenderClients || []).forEach((t) => {
      const name = t.clientName || t.header?.entityName;
      if (name && !seenNames.has(name.toLowerCase())) {
        seenNames.add(name.toLowerCase());
        extraClients.push({
          id: `tender-${t.id}`,
          name: name,
          nit: t.nit || t.header?.nit,
          city: t.header?.city || '',
          contactPerson: t.header?.contactPerson || '',
          contactPhone: t.header?.contactPhone || '',
          contactEmail: t.header?.contactEmail || '',
          source: 'licitacion',
        });
      }
    });

    (savedQuotes || []).forEach((q) => {
      const name = q.clientName;
      if (name && !seenNames.has(name.toLowerCase())) {
        seenNames.add(name.toLowerCase());
        extraClients.push({
          id: `quote-${q.id}`,
          name: name,
          nit: q.nit,
          city: q.city || '',
          contactPerson: q.contactPerson || '',
          contactPhone: q.contactPhone || '',
          contactEmail: q.contactEmail || '',
          source: 'cotizacion',
        });
      }
    });

    const merged = [...allKnownClients, ...extraClients];
    const filtered = merged.filter((c) => {
      const matchName = c.name?.toLowerCase().includes(query);
      const matchNit = c.nit?.toLowerCase().includes(query);
      const matchCity = c.city?.toLowerCase().includes(query);
      return matchName || matchNit || matchCity;
    });

    setClientSuggestions(filtered.slice(0, 6));
    setShowClientSuggestions(filtered.length > 0);
  };

  const handleSelectClientSuggestion = (c: ClientRecord) => {
    setClientName(c.name);
    if (c.nit) setClientNit(c.nit);
    if (c.city) setClientCity(c.city);
    if (c.contactPerson) setClientContactPerson(c.contactPerson);
    if (c.contactPhone) setClientContactPhone(c.contactPhone);
    if (c.contactEmail) setClientContactEmail(c.contactEmail);
    setShowClientSuggestions(false);
  };

  // Items selection state
  interface ItemDraftState extends SalesOrderItem {
    isSelected: boolean;
    totalContractQuantity?: number;
    alreadyDispatchedQuantity?: number;
  }
  const [itemDrafts, setItemDrafts] = useState<ItemDraftState[]>([]);

  // Folding / Unfolding (accordion) states for space optimization and visual harmony
  const [isAvailableContractItemsFolded, setIsAvailableContractItemsFolded] = useState(false);
  const [expandedItemMap, setExpandedItemMap] = useState<Record<string | number, boolean>>({});

  const isItemExpanded = (index: number, itemId?: string) => {
    const key = itemId || index;
    if (expandedItemMap[key] !== undefined) {
      return expandedItemMap[key];
    }
    // Default: expand if 2 or fewer items; keep compact/folded if 3 or more for clean overview
    return itemDrafts.length <= 2;
  };

  const toggleItemExpanded = (index: number, itemId?: string) => {
    const key = itemId || index;
    setExpandedItemMap((prev) => ({
      ...prev,
      [key]: !isItemExpanded(index, itemId),
    }));
  };

  const areAllItemsFolded = useMemo(() => {
    if (itemDrafts.length === 0) return false;
    return itemDrafts.every((it, idx) => !isItemExpanded(idx, it.id));
  }, [itemDrafts, expandedItemMap]);

  const toggleAllItemsFold = (expand: boolean) => {
    const nextMap: Record<string | number, boolean> = {};
    itemDrafts.forEach((it, idx) => {
      const key = it.id || idx;
      nextMap[key] = expand;
    });
    setExpandedItemMap(nextMap);
  };

  // Registered suppliers directory from Ventana 5 for intelligent matching
  const [supplierProfiles, setSupplierProfiles] = useState<SupplierProfile[]>(() => {
    try {
      return getStoredSupplierProfiles();
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleSuppliersUpdated = (e: any) => {
      if (e.detail && Array.isArray(e.detail)) {
        setSupplierProfiles(e.detail);
      } else {
        setSupplierProfiles(getStoredSupplierProfiles());
      }
    };
    window.addEventListener('syd_suppliers_updated', handleSuppliersUpdated);
    return () => window.removeEventListener('syd_suppliers_updated', handleSuppliersUpdated);
  }, []);

  // Manual equipment adder state
  const [isAddingManualItem, setIsAddingManualItem] = useState(false);
  const [selectedCatalogEquipmentId, setSelectedCatalogEquipmentId] = useState('');
  const [manualItemName, setManualItemName] = useState('');
  const [manualItemBrand, setManualItemBrand] = useState('');
  const [manualItemModel, setManualItemModel] = useState('');
  const [manualItemQty, setManualItemQty] = useState(1);
  const [manualItemUnitPrice, setManualItemUnitPrice] = useState(0);

  // Helper to determine item keys that already belong to another active OV for this origin
  const cleanNorm = (str?: string) =>
    (str || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

  /**
   * Intelligently detects the assigned supplier for an equipment:
   * 1. If explicit supplier provided on item, respects it
   * 2. Checks supplier stored in the equipment catalog when created (eq.supplier, allSuppliers, supplierPrices)
   * 3. Checks registered supplier directory for suppliers handling this brand or named after the brand
   */
  const detectSupplierAndBrandForItem = (
    item: { equipmentId?: string; code?: string; name?: string; brand?: string; supplier?: string },
    profiles: SupplierProfile[] = supplierProfiles
  ): { supplier: string; brand: string; source: string } => {
    // 1. Explicit supplier on item
    if (
      item.supplier &&
      item.supplier.trim() &&
      !['por asignar', 'n/a', 'ninguno', 'sin proveedor asignado', 'proveedor principal'].includes(
        item.supplier.trim().toLowerCase()
      )
    ) {
      return { supplier: item.supplier.trim(), brand: item.brand || '', source: 'manual' };
    }

    // 2. Lookup in equipment catalog (as assigned when equipment was created)
    const matchedEq = equipments.find(
      (e) =>
        (item.equipmentId && e.id === item.equipmentId) ||
        (item.code && cleanNorm(e.code) === cleanNorm(item.code)) ||
        (item.name && cleanNorm(e.name) === cleanNorm(item.name))
    );

    const catalogBrand = (item.brand || matchedEq?.brand || '').trim();

    if (
      matchedEq?.supplier &&
      matchedEq.supplier.trim() &&
      !['por asignar', 'n/a', 'ninguno', 'sin proveedor asignado'].includes(matchedEq.supplier.trim().toLowerCase())
    ) {
      return { supplier: matchedEq.supplier.trim(), brand: catalogBrand, source: 'catalogo_equipo' };
    }

    if (matchedEq?.allSuppliers && Array.isArray(matchedEq.allSuppliers) && matchedEq.allSuppliers.length > 0) {
      const valid = matchedEq.allSuppliers.find(
        (s) => s && s.trim() && !['por asignar', 'n/a', 'ninguno', 'sin proveedor asignado'].includes(s.trim().toLowerCase())
      );
      if (valid) return { supplier: valid.trim(), brand: catalogBrand, source: 'catalogo_proveedores' };
    }

    if (matchedEq?.supplierPrices && Array.isArray(matchedEq.supplierPrices) && matchedEq.supplierPrices.length > 0) {
      const valid = matchedEq.supplierPrices.find(
        (sp) =>
          sp.supplier &&
          sp.supplier.trim() &&
          !['por asignar', 'n/a', 'ninguno', 'sin proveedor asignado'].includes(sp.supplier.trim().toLowerCase())
      );
      if (valid) return { supplier: valid.supplier.trim(), brand: catalogBrand, source: 'catalogo_precios' };
    }

    // 3. Search in equipment catalog for any other equipment with the SAME brand that has an assigned supplier
    if (catalogBrand) {
      const normBrand = cleanNorm(catalogBrand);

      const eqSameBrand = equipments.find((e) => {
        const eBrand = cleanNorm(e.brand);
        return (
          eBrand &&
          (eBrand === normBrand || eBrand.includes(normBrand) || normBrand.includes(eBrand)) &&
          e.supplier &&
          !['por asignar', 'n/a', 'ninguno', 'sin proveedor asignado'].includes(e.supplier.trim().toLowerCase())
        );
      });
      if (eqSameBrand?.supplier) {
        return { supplier: eqSameBrand.supplier.trim(), brand: catalogBrand, source: 'catalogo_misma_marca' };
      }

      // 4. Search in registered Supplier Directory for suppliers handling this brand
      // A. Supplier with this brand in their brand list
      const supplierWithBrand = profiles.find((p) =>
        p.brands?.some((b) => {
          if (!b) return false;
          const bNorm = cleanNorm(b);
          return bNorm === normBrand || bNorm.includes(normBrand) || normBrand.includes(bNorm);
        })
      );
      if (supplierWithBrand) {
        return { supplier: supplierWithBrand.name.trim(), brand: catalogBrand, source: 'marca_proveedor' };
      }

      // B. Supplier whose name matches the brand
      const supplierNamedBrand = profiles.find((p) => {
        const normName = cleanNorm(p.name);
        return normName === normBrand || normName.includes(normBrand) || normBrand.includes(normName);
      });
      if (supplierNamedBrand) {
        return { supplier: supplierNamedBrand.name.trim(), brand: catalogBrand, source: 'proveedor_marca' };
      }

      // C. Brand itself as manufacturer/supplier
      return { supplier: catalogBrand, brand: catalogBrand, source: 'marca_directa' };
    }

    return { supplier: item.supplier || 'Por Asignar', brand: item.brand || '', source: 'ninguna' };
  };

  /**
   * Extract meaningful word tokens for fuzzy item matching
   */
  const extractTokens = (str?: string): string[] => {
    return cleanNorm(str)
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3);
  };

  /**
   * Compares whether an item from a tender/contract corresponds to an item in an existing sales order or OC
   */
  const doesItemMatch = (
    target: { equipmentId?: string; code?: string; name?: string; model?: string },
    existing: { equipmentId?: string; code?: string; name?: string; model?: string }
  ): boolean => {
    // 1. Direct equipment ID match
    if (target.equipmentId && existing.equipmentId && target.equipmentId === existing.equipmentId) {
      return true;
    }

    const normTargetCode = cleanNorm(target.code);
    const normExistingCode = cleanNorm(existing.code);
    // 2. Direct code match (excluding generic defaults)
    if (
      normTargetCode &&
      normExistingCode &&
      normTargetCode === normExistingCode &&
      !['eqmanual', 'eq', 'item', 'eq1', 'eq2', 'eq3', 'pendiente', 'sinasignar'].includes(normTargetCode)
    ) {
      return true;
    }

    const normTargetName = cleanNorm(target.name);
    const normExistingName = cleanNorm(existing.name);
    if (!normTargetName || !normExistingName) return false;

    // 3. Exact normalized name match
    if (normTargetName === normExistingName) return true;

    // 4. Substring containment if sufficiently long (e.g. "equipo de rayos portatil x con flat panel" vs "equipo de rayos portatil x")
    if (normTargetName.length >= 5 && normExistingName.length >= 5) {
      if (normTargetName.includes(normExistingName) || normExistingName.includes(normTargetName)) {
        return true;
      }
    }

    // 5. Significant word token overlap (e.g. "mesa", "cirugia" or "rayos", "portatil")
    const targetTokens = extractTokens(target.name);
    const existingTokens = extractTokens(existing.name);
    if (targetTokens.length > 0 && existingTokens.length > 0) {
      const common = targetTokens.filter((t) => existingTokens.includes(t));
      if (common.length >= 2 || (targetTokens.length === 1 && common.length === 1 && common[0].length >= 5)) {
        return true;
      }
    }

    return false;
  };

  interface DispatchedTracker {
    map: Map<string, number>;
    items: SalesOrderItem[];
  }

  /**
   * Helper to determine already committed quantities in other active OVs or OCs for this contract/origin/client
   */
  const getAlreadyDispatchedQuantities = (
    tenderId?: string,
    processNum?: string,
    contractId?: string,
    quoteId?: string,
    quoteNum?: string,
    client?: string
  ): DispatchedTracker => {
    const map = new Map<string, number>();
    const matchedItems: SalesOrderItem[] = [];
    const normProcess = cleanNorm(processNum);
    const normQuote = cleanNorm(quoteNum);
    const normClient = cleanNorm(client);
    const processDigits = normProcess ? normProcess.replace(/[^0-9]/g, '') : '';

    // 1. Scan all existing Sales Orders (OVs)
    (existingOrders || []).forEach((ov) => {
      if (!ov || ov.id === orderToEdit?.id || ov.status === 'Cancelada' || isSalesOrderDeleted(ov.id, ov.salesOrderNumber, ov.tenderClientId, ov.contractId)) return;

      const ovProcess = cleanNorm(ov.contractNumber);
      const ovQuote = cleanNorm(ov.quoteNumber);
      const ovClient = cleanNorm(ov.clientName);
      const ovDigits = ovProcess ? ovProcess.replace(/[^0-9]/g, '') : '';

      const matchesTender = Boolean(tenderId && (ov.tenderClientId === tenderId || ov.contractId === tenderId));
      const matchesProcess = Boolean(
        normProcess &&
          ovProcess &&
          (normProcess === ovProcess ||
            ovProcess.includes(normProcess) ||
            normProcess.includes(ovProcess) ||
            (processDigits.length >= 3 && ovDigits.length >= 3 && (processDigits === ovDigits || ovDigits.includes(processDigits) || processDigits.includes(ovDigits))))
      );
      const matchesContract = Boolean(contractId && (ov.ocContractId === contractId || ov.contractId === contractId));
      const matchesQuote = Boolean(quoteId && ov.quoteId === quoteId);
      const matchesQuoteNum = Boolean(normQuote && ovQuote && (normQuote === ovQuote || ovQuote.includes(normQuote) || normQuote.includes(ovQuote)));
      const matchesClient = Boolean(
        normClient &&
        ovClient &&
        (normClient === ovClient || ovClient.includes(normClient) || normClient.includes(ovClient))
      );

      // Associate orders belonging to this tender, process, contract, quote, or client
      const isAssociatedOrder =
        matchesTender ||
        matchesProcess ||
        matchesContract ||
        matchesQuote ||
        matchesQuoteNum ||
        matchesClient;

      if (isAssociatedOrder) {
        (ov.items || []).forEach((it) => {
          matchedItems.push(it);
          const qty = Number(it.quantityToDispatch) || Number(it.quotedQuantity) || 1;
          if (it.equipmentId) {
            const k = `eq-${it.equipmentId}`;
            map.set(k, (map.get(k) || 0) + qty);
          }
          if (it.code && cleanNorm(it.code)) {
            const k1 = `code-${cleanNorm(it.code)}`;
            map.set(k1, (map.get(k1) || 0) + qty);
          }
          if (it.name && cleanNorm(it.name)) {
            const k2 = `name-${cleanNorm(it.name)}`;
            map.set(k2, (map.get(k2) || 0) + qty);
          }
        });
      }
    });

    // 2. Also scan OC Tracking Contracts (contracts) for items already assigned to an OV or supplier OC
    (contracts || []).forEach((c) => {
      if (!c) return;
      const cClient = cleanNorm(c.clientName);
      const cContractNum = cleanNorm(c.contractNumber);
      const cDigits = cContractNum ? cContractNum.replace(/[^0-9]/g, '') : '';

      const isSameTarget =
        Boolean(tenderId && c.tenderClientId === tenderId) ||
        Boolean(contractId && c.id === contractId) ||
        Boolean(normProcess && cContractNum && (normProcess === cContractNum || cContractNum.includes(normProcess) || normProcess.includes(cContractNum) || (processDigits.length >= 3 && cDigits.length >= 3 && processDigits === cDigits))) ||
        Boolean(normClient && cClient && (normClient === cClient || cClient.includes(normClient) || normClient.includes(cClient)));

      if (isSameTarget) {
        (c.items || []).forEach((cIt) => {
          // If the item in Seguimiento de OC is already tied to an OV or has an OC number or status
          const hasAssignedOV = Boolean(
            cIt.salesOrderId ||
            cIt.salesOrderNumber ||
            cIt.ocNumber ||
            (cIt.status && cIt.status !== 'Borrador / Solicitud' && cIt.status !== 'Pendiente de OC')
          );
          if (hasAssignedOV) {
            const qty = Number(cIt.quantity) || 1;
            const fakeSalesItem: SalesOrderItem = {
              id: cIt.id,
              equipmentId: cIt.equipmentId,
              code: cIt.code,
              name: cIt.name,
              brand: cIt.brand,
              model: cIt.model,
              quotedQuantity: qty,
              quantityToDispatch: qty,
              unitSalePriceCOP: cIt.costPriceCOP || 0,
              totalSalePriceCOP: (cIt.costPriceCOP || 0) * qty,
              equipmentStatus: 'Pendiente de OC',
              supplierOCRef: cIt.ocNumber,
              linkedSupplierOCNumber: cIt.ocNumber,
            };
            matchedItems.push(fakeSalesItem);
            if (cIt.equipmentId) {
              const k = `eq-${cIt.equipmentId}`;
              map.set(k, Math.max(map.get(k) || 0, qty));
            }
            if (cIt.code && cleanNorm(cIt.code)) {
              const k1 = `code-${cleanNorm(cIt.code)}`;
              map.set(k1, Math.max(map.get(k1) || 0, qty));
            }
            if (cIt.name && cleanNorm(cIt.name)) {
              const k2 = `name-${cleanNorm(cIt.name)}`;
              map.set(k2, Math.max(map.get(k2) || 0, qty));
            }
          }
        });
      }
    });

    return { map, items: matchedItems };
  };

  const getDispatchedCount = (
    it: { equipmentId?: string; code?: string; name?: string; model?: string },
    tracker: DispatchedTracker
  ): number => {
    let count = 0;
    // 1. Direct map lookups
    if (it.equipmentId && tracker.map.has(`eq-${it.equipmentId}`)) {
      count = Math.max(count, tracker.map.get(`eq-${it.equipmentId}`) || 0);
    }
    if (it.code && cleanNorm(it.code) && tracker.map.has(`code-${cleanNorm(it.code)}`)) {
      count = Math.max(count, tracker.map.get(`code-${cleanNorm(it.code)}`) || 0);
    }
    if (it.name && cleanNorm(it.name) && tracker.map.has(`name-${cleanNorm(it.name)}`)) {
      count = Math.max(count, tracker.map.get(`name-${cleanNorm(it.name)}`) || 0);
    }

    // 2. Intelligent fuzzy scanning over all matched items in existing orders
    let fuzzyCount = 0;
    for (const ovItem of tracker.items) {
      if (doesItemMatch(it, ovItem)) {
        const qty = Number(ovItem.quantityToDispatch) || Number(ovItem.quotedQuantity) || 1;
        fuzzyCount += qty;
      }
    }

    return Math.max(count, fuzzyCount);
  };

  // Initialize or reset form
  useEffect(() => {
    if (!isOpen) return;

    if (orderToEdit) {
      setSalesOrderNumber(orderToEdit.salesOrderNumber || '');
      setSelectedQuoteId(orderToEdit.quoteId || '');
      setQuoteNumber(orderToEdit.quoteNumber || '');
      setSelectedTenderClientId(orderToEdit.tenderClientId || orderToEdit.contractId || '');
      setContractId(orderToEdit.contractId);
      setContractNumber(orderToEdit.contractNumber);
      setOriginType(orderToEdit.contractId ? 'tender' : orderToEdit.quoteId ? 'quote' : 'manual');
      setClientName(orderToEdit.clientName || '');
      setClientNit(orderToEdit.clientNit || '');
      setClientCity(orderToEdit.clientCity || '');
      setClientContactPerson(orderToEdit.clientContactPerson || '');
      setClientContactPhone(orderToEdit.clientContactPhone || '');
      setClientContactEmail(orderToEdit.clientContactEmail || '');
      setOrderDate(orderToEdit.orderDate || orderToEdit.dispatchDate || new Date().toISOString().split('T')[0]);
      setDeliveryDate(orderToEdit.deliveryDate || orderToEdit.estimatedArrivalDate || '');
      setStatus(orderToEdit.status || 'En Proceso');
      setNotes(orderToEdit.notes || '');

      const mapped: ItemDraftState[] = (orderToEdit.items || []).map((it) => {
        const detected = detectSupplierAndBrandForItem(it);
        const isPlaceholderSup =
          !it.supplier ||
          ['por asignar', 'sin proveedor asignado', 'n/a', 'ninguno', 'proveedor principal'].includes(
            it.supplier.trim().toLowerCase()
          );
        const resolvedSup = (!isPlaceholderSup && it.supplier?.trim())
          ? it.supplier.trim()
          : (detected.supplier || 'Por Asignar');

        return {
          ...it,
          brand: it.brand || detected.brand || '',
          supplier: resolvedSup,
          isSelected: true,
          equipmentStatus: it.equipmentStatus || 'Pendiente de OC',
        };
      });

      // Directly set the items that belong to this order.
      // Unselected items from the linked contract are shown in the purple banner above!
      setItemDrafts(mapped);
    } else if (initialTenderToConvert) {
      // Converting directly from a Tender / Contract!
      setOriginType('tender');
      setSalesOrderNumber('');
      setSelectedTenderClientId(initialTenderToConvert.id);
      setContractId(initialTenderToConvert.id);
      setContractNumber(initialTenderToConvert.header.processNumber || initialTenderToConvert.header.processType || 'Contrato Licitación');
      setSelectedQuoteId('');
      setQuoteNumber('');
      setClientName(initialTenderToConvert.clientName || initialTenderToConvert.header.entityName || '');
      setClientNit(initialTenderToConvert.nit || initialTenderToConvert.header.nit || '');
      setClientCity(initialTenderToConvert.header.city || 'Barranquilla');
      setClientContactPerson(initialTenderToConvert.header.contactPerson || '');
      setClientContactPhone(initialTenderToConvert.header.contactPhone || '');
      setClientContactEmail(initialTenderToConvert.header.contactEmail || '');
      setOrderDate(new Date().toISOString().split('T')[0]);
      setDeliveryDate(initialTenderToConvert.header.executionTerm || '');
      setStatus('En Proceso');
      setNotes(`Orden de Venta generada a partir del Contrato de Licitación ${initialTenderToConvert.header.processNumber || initialTenderToConvert.clientName}.`);

      const dispatchedMap = getAlreadyDispatchedQuantities(
        initialTenderToConvert.id,
        initialTenderToConvert.header.processNumber,
        undefined,
        undefined,
        undefined,
        initialTenderToConvert.clientName
      );

      const itemsWithRemaining = (initialTenderToConvert.items || []).map((tItem, idx) => {
        const totalQty = Number(tItem.quantity) || 1;
        const alreadyDispatched = getDispatchedCount(tItem, dispatchedMap);
        const remaining = totalQty - alreadyDispatched;
        return { tItem, totalQty, alreadyDispatched, remaining, idx };
      }).filter((x) => x.remaining > 0);

      const mapped: ItemDraftState[] = itemsWithRemaining.map(({ tItem, totalQty, alreadyDispatched, remaining, idx }) => {
        const unitPrice = Number(tItem.offeredUnitPrice) || 0;
        const detected = detectSupplierAndBrandForItem(tItem);
        return {
          id: `item-${Date.now()}-${idx}`,
          equipmentId: tItem.equipmentId,
          code: tItem.code || `EQ-${idx + 1}`,
          name: tItem.name,
          brand: tItem.brand || detected.brand || '',
          supplier: (tItem as any).supplier || detected.supplier || 'Por Asignar',
          model: tItem.model || '',
          quotedQuantity: remaining,
          quantityToDispatch: remaining,
          totalContractQuantity: totalQty,
          alreadyDispatchedQuantity: alreadyDispatched,
          unitSalePriceCOP: unitPrice,
          totalSalePriceCOP: unitPrice * remaining,
          equipmentStatus: 'Pendiente de OC',
          assignedSerialNumbers: [],
          isSelected: true,
          notes: tItem.observations || '',
        };
      });
      setItemDrafts(mapped);
    } else if (initialQuoteToConvert) {
      // Converting directly from a Quote!
      setOriginType('quote');
      setSalesOrderNumber('');
      setSelectedQuoteId(initialQuoteToConvert.id);
      setQuoteNumber(initialQuoteToConvert.quoteNumber || '');
      setSelectedTenderClientId('');
      setContractId(undefined);
      setContractNumber(undefined);
      setClientName(initialQuoteToConvert.clientName || '');
      setClientNit(initialQuoteToConvert.nit || '');
      setClientCity(initialQuoteToConvert.city || 'Barranquilla');
      setClientContactPerson(initialQuoteToConvert.contactPerson || '');
      setClientContactPhone(initialQuoteToConvert.contactPhone || '');
      setClientContactEmail(initialQuoteToConvert.contactEmail || '');
      setOrderDate(new Date().toISOString().split('T')[0]);
      setDeliveryDate('');
      setStatus('En Proceso');
      setNotes(`Orden de Venta generada a partir de la Cotización ${initialQuoteToConvert.quoteNumber}.`);

      const dispatchedMap = getAlreadyDispatchedQuantities(
        undefined,
        undefined,
        undefined,
        initialQuoteToConvert.id,
        initialQuoteToConvert.quoteNumber,
        initialQuoteToConvert.clientName
      );

      const itemsWithRemaining = (initialQuoteToConvert.items || []).map((qItem, idx) => {
        const totalQty = Number(qItem.quantity) || 1;
        const alreadyDispatched = getDispatchedCount(qItem, dispatchedMap);
        const remaining = totalQty - alreadyDispatched;
        return { qItem, totalQty, alreadyDispatched, remaining, idx };
      }).filter((x) => x.remaining > 0);

      const mapped: ItemDraftState[] = itemsWithRemaining.map(({ qItem, totalQty, alreadyDispatched, remaining, idx }) => {
        const unitPrice = Number(qItem.unitSalePrice) || 0;
        const detected = detectSupplierAndBrandForItem(qItem);
        return {
          id: `item-${Date.now()}-${idx}`,
          equipmentId: qItem.equipmentId,
          code: qItem.code || `EQ-${idx + 1}`,
          name: qItem.name,
          brand: qItem.brand || detected.brand || '',
          supplier: qItem.supplier || detected.supplier || 'Por Asignar',
          model: qItem.model || '',
          quotedQuantity: remaining,
          quantityToDispatch: remaining,
          totalContractQuantity: totalQty,
          alreadyDispatchedQuantity: alreadyDispatched,
          unitSalePriceCOP: unitPrice,
          totalSalePriceCOP: unitPrice * remaining,
          equipmentStatus: 'Pendiente de OC',
          assignedSerialNumbers: [],
          isSelected: true,
          notes: qItem.notes || '',
        };
      });
      setItemDrafts(mapped);
    } else {
      // Brand new empty order
      setOriginType('manual');
      setSalesOrderNumber('');
      setSelectedQuoteId('');
      setQuoteNumber('');
      setSelectedTenderClientId('');
      setContractId(undefined);
      setContractNumber(undefined);
      setClientName('');
      setClientNit('');
      setClientCity('');
      setClientContactPerson('');
      setClientContactPhone('');
      setClientContactEmail('');
      setOrderDate(new Date().toISOString().split('T')[0]);
      setDeliveryDate('');
      setStatus('En Proceso');
      setNotes('');
      setItemDrafts([]);
    }
  }, [isOpen, orderToEdit, initialQuoteToConvert, initialTenderToConvert, existingOrders]);

  // Handle selecting a Quote from the dropdown
  const handleSelectQuote = (quoteId: string) => {
    if (!quoteId) {
      setSelectedQuoteId('');
      return;
    }

    const matchedQuote = savedQuotes.find((q) => q.id === quoteId);
    if (matchedQuote) {
      // Check if linked to a non-adjudicated tender
      const linkedTender = (tenderClients || []).find(
        (t) =>
          t.linkedQuoteId === matchedQuote.id ||
          t.header?.linkedQuoteId === matchedQuote.id ||
          t.linkedQuoteNumber === matchedQuote.quoteNumber ||
          t.header?.linkedQuoteNumber === matchedQuote.quoteNumber ||
          (matchedQuote as any).linkedTenderId === t.id
      );

      if (linkedTender && linkedTender.status !== 'Adjudicada') {
        alert(
          `⛔ CONVERSIÓN BLOQUEADA:\n\nEsta cotización está vinculada a la Licitación "${linkedTender.header.processNumber || linkedTender.clientName}" en estado "${linkedTender.status || 'En Preparación'}".\n\nSolo las licitaciones Adjudicadas pueden formalizarse como Orden de Venta.`
        );
        return;
      }

      setSelectedQuoteId(quoteId);
      setSelectedTenderClientId(linkedTender ? linkedTender.id : '');
      setContractId(linkedTender ? linkedTender.id : undefined);
      setContractNumber(linkedTender ? (linkedTender.header.processNumber || linkedTender.header.processType) : undefined);
      setQuoteNumber(matchedQuote.quoteNumber || '');
      setClientName(matchedQuote.clientName || '');
      setClientNit(matchedQuote.nit || '');
      setClientCity(matchedQuote.city || 'Barranquilla');
      setClientContactPerson(matchedQuote.contactPerson || '');
      setClientContactPhone(matchedQuote.contactPhone || '');
      setClientContactEmail(matchedQuote.contactEmail || '');

      const dispatchedMap = getAlreadyDispatchedQuantities(
        linkedTender?.id,
        linkedTender?.header.processNumber,
        undefined,
        matchedQuote.id,
        matchedQuote.quoteNumber,
        matchedQuote.clientName
      );

      const itemsWithRemaining = (matchedQuote.items || []).map((qItem, idx) => {
        const totalQty = Number(qItem.quantity) || 1;
        const alreadyDispatched = getDispatchedCount(qItem, dispatchedMap);
        const remaining = totalQty - alreadyDispatched;
        return { qItem, totalQty, alreadyDispatched, remaining, idx };
      }).filter((x) => x.remaining > 0);

      const mapped: ItemDraftState[] = itemsWithRemaining.map(({ qItem, totalQty, alreadyDispatched, remaining, idx }) => {
        const unitPrice = Number(qItem.unitSalePrice) || 0;
        const detected = detectSupplierAndBrandForItem(qItem);
        return {
          id: `item-${Date.now()}-${idx}`,
          equipmentId: qItem.equipmentId,
          code: qItem.code || `EQ-${idx + 1}`,
          name: qItem.name,
          brand: qItem.brand || detected.brand || '',
          supplier: qItem.supplier || detected.supplier || 'Por Asignar',
          model: qItem.model || '',
          quotedQuantity: remaining,
          quantityToDispatch: remaining,
          totalContractQuantity: totalQty,
          alreadyDispatchedQuantity: alreadyDispatched,
          unitSalePriceCOP: unitPrice,
          totalSalePriceCOP: unitPrice * remaining,
          equipmentStatus: 'Pendiente de OC',
          assignedSerialNumbers: [],
          isSelected: true,
          notes: qItem.notes || '',
        };
      });
      setItemDrafts(mapped);
    }
  };

  // Handle typing or pasting the Contract / Process number
  const handleContractNumberChange = (val: string) => {
    setContractNumber(val);
    if (!val || val.trim().length < 2) return;
    const cleanInput = cleanNorm(val);

    const matchedTender = (tenderClients || []).find((t) => {
      const pNum = cleanNorm(t.header?.processNumber);
      const cNum = cleanNorm(t.header?.clientOrderNumber);
      return (
        (pNum && (pNum === cleanInput || pNum.includes(cleanInput) || cleanInput.includes(pNum))) ||
        (cNum && (cNum === cleanInput || cNum.includes(cleanInput) || cleanInput.includes(cNum)))
      );
    });

    if (matchedTender) {
      if (matchedTender.status !== 'Adjudicada') return;

      if (selectedTenderClientId !== matchedTender.id) {
        setSelectedTenderClientId(matchedTender.id);
        setContractId(matchedTender.id);
      }
      if (!clientName) setClientName(matchedTender.clientName || matchedTender.header?.entityName || '');
      if (!clientNit) setClientNit(matchedTender.nit || matchedTender.header?.nit || '');
      if (!clientCity) setClientCity(matchedTender.header?.city || 'Barranquilla');
      if (matchedTender.header.executionTerm && !deliveryDate) {
        setDeliveryDate(matchedTender.header.executionTerm);
      }

      if (itemDrafts.length === 0) {
        const tracker = getAlreadyDispatchedQuantities(
          matchedTender.id,
          matchedTender.header.processNumber,
          undefined,
          undefined,
          undefined,
          matchedTender.clientName
        );

        const itemsWithRemaining = (matchedTender.items || []).map((tItem, idx) => {
          const totalQty = Number(tItem.quantity) || 1;
          const alreadyDispatched = getDispatchedCount(tItem, tracker);
          const remaining = totalQty - alreadyDispatched;
          return { tItem, totalQty, alreadyDispatched, remaining, idx };
        }).filter((x) => x.remaining > 0);

        const mapped: ItemDraftState[] = itemsWithRemaining.map(({ tItem, totalQty, alreadyDispatched, remaining, idx }) => {
          const unitPrice = Number(tItem.offeredUnitPrice) || 0;
          const detected = detectSupplierAndBrandForItem(tItem);
          return {
            id: `item-${Date.now()}-${idx}`,
            equipmentId: tItem.equipmentId,
            code: tItem.code || `EQ-${idx + 1}`,
            name: tItem.name,
            brand: tItem.brand || detected.brand || '',
            supplier: (tItem as any).supplier || detected.supplier || 'Por Asignar',
            model: tItem.model || '',
            quotedQuantity: remaining,
            quantityToDispatch: remaining,
            totalContractQuantity: totalQty,
            alreadyDispatchedQuantity: alreadyDispatched,
            unitSalePriceCOP: unitPrice,
            totalSalePriceCOP: unitPrice * remaining,
            equipmentStatus: 'Pendiente de OC',
            assignedSerialNumbers: [],
            isSelected: true,
            notes: tItem.observations || '',
          };
        });
        setItemDrafts(mapped);
      }
    }
  };

  // Handle selecting a Tender / Contract from dropdown
  const handleSelectTender = (tenderId: string) => {
    if (!tenderId) {
      setSelectedTenderClientId('');
      return;
    }

    const matchedTender = (tenderClients || []).find((t) => t.id === tenderId);
    if (matchedTender) {
      if (matchedTender.status !== 'Adjudicada') {
        alert(
          `⛔ CONVERSIÓN BLOQUEADA:\n\nLa Licitación "${matchedTender.header.processNumber || matchedTender.clientName}" se encuentra en estado "${matchedTender.status || 'En Preparación'}".\n\nSolo los procesos Adjudicados pueden formalizarse como Orden de Venta.`
        );
        return;
      }

      setSelectedTenderClientId(tenderId);
      setSelectedQuoteId('');
      setQuoteNumber('');
      setContractId(matchedTender.id);
      setContractNumber(matchedTender.header.processNumber || matchedTender.header.processType || 'Contrato Licitación');
      setClientName(matchedTender.clientName || matchedTender.header.entityName || '');
      setClientNit(matchedTender.nit || matchedTender.header.nit || '');
      setClientCity(matchedTender.header.city || 'Barranquilla');
      setClientContactPerson(matchedTender.header.contactPerson || '');
      setClientContactPhone(matchedTender.header.contactPhone || '');
      setClientContactEmail(matchedTender.header.contactEmail || '');
      if (matchedTender.header.executionTerm) {
        setDeliveryDate(matchedTender.header.executionTerm);
      }

      const dispatchedMap = getAlreadyDispatchedQuantities(
        matchedTender.id,
        matchedTender.header.processNumber,
        undefined,
        undefined,
        undefined,
        matchedTender.clientName
      );

      const itemsWithRemaining = (matchedTender.items || []).map((tItem, idx) => {
        const totalQty = Number(tItem.quantity) || 1;
        const alreadyDispatched = getDispatchedCount(tItem, dispatchedMap);
        const remaining = totalQty - alreadyDispatched;
        return { tItem, totalQty, alreadyDispatched, remaining, idx };
      }).filter((x) => x.remaining > 0);

      const mapped: ItemDraftState[] = itemsWithRemaining.map(({ tItem, totalQty, alreadyDispatched, remaining, idx }) => {
        const unitPrice = Number(tItem.offeredUnitPrice) || 0;
        const detected = detectSupplierAndBrandForItem(tItem);
        return {
          id: `item-${Date.now()}-${idx}`,
          equipmentId: tItem.equipmentId,
          code: tItem.code || `EQ-${idx + 1}`,
          name: tItem.name,
          brand: tItem.brand || detected.brand || '',
          supplier: (tItem as any).supplier || detected.supplier || 'Por Asignar',
          model: tItem.model || '',
          quotedQuantity: remaining,
          quantityToDispatch: remaining,
          totalContractQuantity: totalQty,
          alreadyDispatchedQuantity: alreadyDispatched,
          unitSalePriceCOP: unitPrice,
          totalSalePriceCOP: unitPrice * remaining,
          equipmentStatus: 'Pendiente de OC',
          assignedSerialNumbers: [],
          isSelected: true,
          notes: tItem.observations || '',
        };
      });
      setItemDrafts(mapped);
    }
  };

  // Handle selecting an existing OC Tracking Contract from Ventana 5
  const handleSelectContract = (contractIdToSelect: string) => {
    if (!contractIdToSelect) {
      setSelectedContractId('');
      return;
    }

    const matchedContract = contracts.find((c) => c.id === contractIdToSelect);
    if (matchedContract) {
      setSelectedContractId(contractIdToSelect);
      setContractId(matchedContract.id);
      setContractNumber(matchedContract.contractNumber || matchedContract.salesOrderNumber || 'OC Directa');
      setSelectedTenderClientId(matchedContract.tenderClientId || '');
      setSelectedQuoteId(matchedContract.quoteId || '');
      setQuoteNumber(matchedContract.quoteNumber || '');

      const cleanSO = matchedContract.salesOrderNumber
        ? matchedContract.salesOrderNumber.replace(/^ov:\s*/i, '').trim()
        : '';
      if (cleanSO) {
        setSalesOrderNumber(cleanSO);
      }

      setClientName(matchedContract.clientName || '');
      setClientNit(matchedContract.nit || '');
      setClientCity(matchedContract.city || 'Barranquilla');
      setClientContactPerson(matchedContract.contactPerson || '');
      setClientContactPhone(matchedContract.contactPhone || '');
      setClientContactEmail(matchedContract.contactEmail || '');

      const dispatchedMap = getAlreadyDispatchedQuantities(
        matchedContract.tenderClientId,
        matchedContract.contractNumber,
        matchedContract.id,
        matchedContract.quoteId,
        matchedContract.quoteNumber,
        matchedContract.clientName
      );

      // Look up any linked tender project for this contract to gather all contracted items
      const linkedTenderForContract = (tenderClients || []).find(
        (t) =>
          (matchedContract.tenderClientId && t.id === matchedContract.tenderClientId) ||
          (matchedContract.contractNumber && t.header?.processNumber && cleanNorm(matchedContract.contractNumber) === cleanNorm(t.header?.processNumber)) ||
          (matchedContract.clientName && t.clientName && cleanNorm(matchedContract.clientName) === cleanNorm(t.clientName))
      );

      const allContractSourceItems: {
        equipmentId?: string;
        code?: string;
        name: string;
        brand?: string;
        supplier?: string;
        model?: string;
        quantity: number;
        unitPrice: number;
        notes?: string;
        status?: string;
        ocNumber?: string;
        serialNumbers?: any[];
      }[] = [];

      // 1. Include items from the linked tender if available
      if (linkedTenderForContract?.items && Array.isArray(linkedTenderForContract.items)) {
        linkedTenderForContract.items.forEach((ti) => {
          const detected = detectSupplierAndBrandForItem(ti);
          allContractSourceItems.push({
            equipmentId: ti.equipmentId,
            code: ti.code,
            name: ti.name,
            brand: ti.brand || detected.brand || '',
            supplier: (ti as any).supplier || detected.supplier || 'Por Asignar',
            model: ti.model || '',
            quantity: Number(ti.quantity) || 1,
            unitPrice: Number(ti.offeredUnitPrice) || 0,
            notes: ti.observations || '',
          });
        });
      }

      // 2. Include items directly registered in matchedContract that are not duplicates
      (matchedContract.items || []).forEach((ci) => {
        const alreadyInList = allContractSourceItems.some(
          (it) =>
            (ci.equipmentId && it.equipmentId && ci.equipmentId === it.equipmentId) ||
            (ci.code && it.code && cleanNorm(ci.code) === cleanNorm(it.code)) ||
            (ci.name && it.name && cleanNorm(ci.name) === cleanNorm(it.name))
        );
        if (!alreadyInList) {
          const cost = Number(ci.costPriceCOP) || 0;
          const detected = detectSupplierAndBrandForItem(ci);
          allContractSourceItems.push({
            equipmentId: ci.equipmentId,
            code: ci.code,
            name: ci.name,
            brand: ci.brand || detected.brand || '',
            supplier: ci.supplier || detected.supplier || 'Por Asignar',
            model: ci.model || '',
            quantity: Number(ci.quantity) || 1,
            unitPrice: cost > 0 ? Math.round(cost * 1.35) : 10000000,
            notes: ci.notes || '',
            status: ci.status,
            ocNumber: ci.ocNumber,
            serialNumbers: ci.serialNumbers,
          });
        }
      });

      const itemsWithRemaining = allContractSourceItems.map((cItem, idx) => {
        const totalQty = Number(cItem.quantity) || 1;
        const alreadyDispatched = getDispatchedCount(cItem, dispatchedMap);
        const remaining = totalQty - alreadyDispatched;
        return { cItem, totalQty, alreadyDispatched, remaining, idx };
      }).filter((x) => x.remaining > 0);

      const mapped: ItemDraftState[] = itemsWithRemaining.map(({ cItem, totalQty, alreadyDispatched, remaining, idx }) => {
        const detected = detectSupplierAndBrandForItem(cItem);
        return {
          id: `item-${Date.now()}-${idx}`,
          equipmentId: cItem.equipmentId,
          code: cItem.code || `EQ-${idx + 1}`,
          name: cItem.name,
          brand: cItem.brand || detected.brand || '',
          supplier: cItem.supplier || detected.supplier || 'Por Asignar',
          model: cItem.model || '',
          quotedQuantity: remaining,
          quantityToDispatch: remaining,
          totalContractQuantity: totalQty,
          alreadyDispatchedQuantity: alreadyDispatched,
          unitSalePriceCOP: cItem.unitPrice || 0,
          totalSalePriceCOP: (cItem.unitPrice || 0) * remaining,
          equipmentStatus: (cItem.status === 'Entregado e Instalado' ? 'Entregado al Cliente' : 'Pendiente de OC') as any,
          supplierOCRef: cItem.ocNumber || '',
          linkedSupplierOCNumber: cItem.ocNumber || '',
          assignedSerialNumbers: (cItem.serialNumbers || []).map((s) => s.serialNumber),
          isSelected: true,
          notes: cItem.notes || '',
        };
      });
      setItemDrafts(mapped);
    }
  };

  // Toggle item selection
  const toggleItemSelection = (index: number) => {
    setItemDrafts((prev) =>
      prev.map((item, i) => (i === index ? { ...item, isSelected: !item.isSelected } : item))
    );
  };

  // Select/Deselect All
  const handleSelectAll = (select: boolean) => {
    setItemDrafts((prev) => prev.map((item) => ({ ...item, isSelected: select })));
  };

  // Change quantity for an item
  const handleItemQuantityChange = (index: number, newQty: number) => {
    const validQty = Math.max(1, newQty);
    setItemDrafts((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              quantityToDispatch: validQty,
              totalSalePriceCOP: validQty * (item.unitSalePriceCOP || 0),
            }
          : item
      )
    );
  };

  // Change unit price for an item
  const handleItemUnitPriceChange = (index: number, newPrice: number) => {
    const validPrice = Math.max(0, newPrice);
    setItemDrafts((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              unitSalePriceCOP: validPrice,
              totalSalePriceCOP: (item.quantityToDispatch || 1) * validPrice,
            }
          : item
      )
    );
  };

  // Change item equipment status
  const handleItemStatusChange = (index: number, newStatus: SalesOrderEquipmentStatus) => {
    setItemDrafts((prev) =>
      prev.map((item, i) => (i === index ? { ...item, equipmentStatus: newStatus } : item))
    );
  };

  // Change manual supplier OC number for an item
  const handleItemSupplierOCChange = (index: number, ocRef: string) => {
    setItemDrafts((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              supplierOCRef: ocRef,
              linkedSupplierOCNumber: ocRef,
            }
          : item
      )
    );
  };

  // Change brand for an item and optionally auto-detect supplier
  const handleItemBrandChange = (index: number, brandVal: string) => {
    setItemDrafts((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        let newSupplier = item.supplier;
        if (!newSupplier || newSupplier === item.brand || newSupplier === 'Por Asignar') {
          const detected = detectSupplierAndBrandForItem({ ...item, brand: brandVal });
          if (detected.supplier && detected.supplier !== 'Por Asignar') {
            newSupplier = detected.supplier;
          } else if (brandVal) {
            newSupplier = brandVal;
          }
        }
        return {
          ...item,
          brand: brandVal,
          supplier: newSupplier,
        };
      })
    );
  };

  // Change supplier for an item
  const handleItemSupplierChange = (index: number, supplierVal: string) => {
    setItemDrafts((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const normSup = cleanNorm(supplierVal);
        const matchedProfile = supplierProfiles.find((p) => cleanNorm(p.name) === normSup);
        const resolvedBrand = item.brand || matchedProfile?.brands?.[0] || '';
        return {
          ...item,
          supplier: supplierVal,
          brand: resolvedBrand,
        };
      })
    );
  };

  // Change supplier / brand for an item (legacy fallback)
  const handleItemBrandSupplierChange = (index: number, brandVal: string) => {
    handleItemBrandChange(index, brandVal);
  };

  // Remove item
  const handleRemoveItem = (index: number) => {
    setItemDrafts((prev) => prev.filter((_, i) => i !== index));
  };

  // Add manual item from catalog
  const handleAddManualItem = () => {
    if (!manualItemName.trim()) return;

    const detected = detectSupplierAndBrandForItem({
      equipmentId: selectedCatalogEquipmentId || undefined,
      name: manualItemName.trim(),
      brand: manualItemBrand.trim(),
    });

    const newItem: ItemDraftState = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      equipmentId: selectedCatalogEquipmentId || undefined,
      code: 'EQ-MANUAL',
      name: manualItemName.trim(),
      brand: manualItemBrand.trim() || detected.brand,
      supplier: detected.supplier || manualItemBrand.trim() || 'Por Asignar',
      model: manualItemModel.trim(),
      quotedQuantity: manualItemQty,
      quantityToDispatch: manualItemQty,
      totalContractQuantity: manualItemQty,
      alreadyDispatchedQuantity: 0,
      unitSalePriceCOP: manualItemUnitPrice,
      totalSalePriceCOP: manualItemQty * manualItemUnitPrice,
      equipmentStatus: 'Pendiente de OC',
      assignedSerialNumbers: [],
      isSelected: true,
    };

    setItemDrafts((prev) => [...prev, newItem]);
    setManualItemName('');
    setManualItemBrand('');
    setManualItemModel('');
    setManualItemQty(1);
    setManualItemUnitPrice(0);
    setSelectedCatalogEquipmentId('');
    setIsAddingManualItem(false);
  };

  // Active linked source contract/tender/quote
  const linkedTender = useMemo(() => {
    let allT = tenderClients;
    if (!allT || allT.length === 0) {
      try {
        const raw = localStorage.getItem('syd_tender_clients_v2');
        if (raw) allT = JSON.parse(raw);
      } catch {}
    }

    const tid = selectedTenderClientId || contractId || orderToEdit?.tenderClientId || orderToEdit?.contractId;
    const cNum = contractNumber || orderToEdit?.contractNumber;
    const orderItemCodes = new Set((orderToEdit?.items || []).map((it) => cleanNorm(it.code)).filter(Boolean));
    const orderItemNames = new Set((orderToEdit?.items || []).map((it) => cleanNorm(it.name)).filter(Boolean));
    const orderItemEqIds = new Set((orderToEdit?.items || []).map((it) => it.equipmentId).filter(Boolean));

    return (allT || []).find(
      (t) =>
        (tid && (t.id === tid || (t as any).tenderClientId === tid)) ||
        (selectedContractId && contracts.find((c) => c.id === selectedContractId)?.tenderClientId === t.id) ||
        (cNum && t.header?.processNumber && cleanNorm(t.header.processNumber) === cleanNorm(cNum)) ||
        (cNum && t.header?.processNumber && (cleanNorm(t.header.processNumber).includes(cleanNorm(cNum)) || cleanNorm(cNum).includes(cleanNorm(t.header.processNumber)))) ||
        (clientName && t.clientName && cleanNorm(t.clientName) === cleanNorm(clientName)) ||
        (t.items && t.items.some((ti) => (ti.equipmentId && orderItemEqIds.has(ti.equipmentId)) || (ti.code && orderItemCodes.has(cleanNorm(ti.code))) || (ti.name && orderItemNames.has(cleanNorm(ti.name)))))
    );
  }, [tenderClients, selectedTenderClientId, selectedContractId, contracts, clientName, contractId, contractNumber, orderToEdit]);

  const linkedContract = useMemo(() => {
    let allC = contracts;
    if (!allC || allC.length === 0) {
      try {
        const raw = localStorage.getItem('syd_oc_tracking_contracts_v2');
        if (raw) allC = JSON.parse(raw);
      } catch {}
    }

    const cid = selectedContractId || contractId || orderToEdit?.ocContractId || orderToEdit?.contractId;
    const cNum = contractNumber || orderToEdit?.contractNumber;
    const orderItemCodes = new Set((orderToEdit?.items || []).map((it) => cleanNorm(it.code)).filter(Boolean));
    const orderItemNames = new Set((orderToEdit?.items || []).map((it) => cleanNorm(it.name)).filter(Boolean));
    const orderItemEqIds = new Set((orderToEdit?.items || []).map((it) => it.equipmentId).filter(Boolean));

    return (allC || []).find(
      (c) =>
        (cid && (c.id === cid || c.tenderClientId === cid)) ||
        (cNum && c.contractNumber && cleanNorm(c.contractNumber) === cleanNorm(cNum)) ||
        (cNum && c.contractNumber && (cleanNorm(c.contractNumber).includes(cleanNorm(cNum)) || cleanNorm(cNum).includes(cleanNorm(c.contractNumber)))) ||
        (orderToEdit?.id && c.salesOrderId === orderToEdit.id) ||
        (c.items && c.items.some((ci) => (ci.equipmentId && orderItemEqIds.has(ci.equipmentId)) || (ci.code && orderItemCodes.has(cleanNorm(ci.code))) || (ci.name && orderItemNames.has(cleanNorm(ci.name)))))
    );
  }, [contracts, selectedContractId, contractId, contractNumber, orderToEdit]);

  const linkedQuote = useMemo(() => {
    const qid = selectedQuoteId || orderToEdit?.quoteId;
    const qNum = quoteNumber || orderToEdit?.quoteNumber;
    return (savedQuotes || []).find(
      (q) => (qid && q.id === qid) || (qNum && q.quoteNumber && cleanNorm(q.quoteNumber) === cleanNorm(qNum))
    );
  }, [savedQuotes, selectedQuoteId, quoteNumber, orderToEdit]);

  // Extract all equipment defined in the linked contract/tender/quote that STILL HAVE REMAINING QUANTITY
  const contractAvailableEquipments = useMemo(() => {
    const list: {
      sourceId: string;
      code: string;
      name: string;
      brand: string;
      model: string;
      quantity: number;
      totalContractQty: number;
      alreadyDispatchedQty: number;
      unitPriceCOP: number;
      notes?: string;
      equipmentId?: string;
      supplier?: string;
      sourceLabel: string;
    }[] = [];

    const isDirect =
      linkedTender?.header?.processType === 'OC Directa' ||
      linkedTender?.header?.processType === 'Orden de Compra Directa del Cliente' ||
      linkedTender?.header?.processType === 'Contratación Directa' ||
      (linkedTender as any)?.isDirectOC ||
      Boolean((linkedContract as any)?.isDirectOC) ||
      linkedContract?.sourceType === 'oc_directa';
    const sLabel = isDirect ? 'OC Directa' : 'Licitación / Contrato';

    const dispatchedMap = getAlreadyDispatchedQuantities(
      linkedTender?.id,
      linkedTender?.header?.processNumber,
      linkedContract?.id,
      linkedQuote?.id,
      linkedQuote?.quoteNumber,
      linkedTender?.clientName || linkedContract?.clientName || linkedQuote?.clientName
    );

    if (linkedTender?.items && Array.isArray(linkedTender.items)) {
      linkedTender.items.forEach((ti, idx) => {
        const totalQty = Number(ti.quantity) || 1;
        const dispatched = getDispatchedCount(ti, dispatchedMap);
        const remaining = totalQty - dispatched;
        if (remaining > 0) {
          const detected = detectSupplierAndBrandForItem(ti);
          list.push({
            sourceId: ti.id || `tender-item-${idx}`,
            code: ti.code || `EQ-${idx + 1}`,
            name: ti.name,
            brand: ti.brand || detected.brand || '',
            supplier: (ti as any).supplier || detected.supplier || 'Por Asignar',
            model: ti.model || '',
            quantity: remaining,
            totalContractQty: totalQty,
            alreadyDispatchedQty: dispatched,
            unitPriceCOP: Number(ti.offeredUnitPrice) || 0,
            notes: ti.observations || '',
            equipmentId: ti.equipmentId,
            sourceLabel: sLabel,
          });
        }
      });
    }

    if (linkedContract?.items && Array.isArray(linkedContract.items)) {
      linkedContract.items.forEach((ci, idx) => {
        const alreadyInList = list.some((item) => (ci.code && cleanNorm(ci.code) === cleanNorm(item.code)) || (ci.name && cleanNorm(ci.name) === cleanNorm(item.name)));
        if (!alreadyInList) {
          const totalQty = Number(ci.quantity) || 1;
          const dispatched = getDispatchedCount(ci, dispatchedMap);
          const remaining = totalQty - dispatched;
          if (remaining > 0) {
            const cost = Number(ci.costPriceCOP) || 0;
            const detected = detectSupplierAndBrandForItem(ci);
            list.push({
              sourceId: ci.id || `contract-item-${idx}`,
              code: ci.code || `EQ-${idx + 1}`,
              name: ci.name,
              brand: ci.brand || detected.brand || '',
              supplier: ci.supplier || detected.supplier || 'Por Asignar',
              model: ci.model || '',
              quantity: remaining,
              totalContractQty: totalQty,
              alreadyDispatchedQty: dispatched,
              unitPriceCOP: cost > 0 ? Math.round(cost * 1.35) : 10000000,
              notes: ci.notes || '',
              equipmentId: ci.equipmentId,
              sourceLabel: 'Contrato OC',
            });
          }
        }
      });
    }

    if (list.length === 0 && linkedQuote?.items && Array.isArray(linkedQuote.items)) {
      linkedQuote.items.forEach((qi, idx) => {
        const totalQty = Number(qi.quantity) || 1;
        const dispatched = getDispatchedCount(qi, dispatchedMap);
        const remaining = totalQty - dispatched;
        if (remaining > 0) {
          const detected = detectSupplierAndBrandForItem(qi);
          list.push({
            sourceId: qi.id || `quote-item-${idx}`,
            code: qi.code || `EQ-${idx + 1}`,
            name: qi.name,
            brand: qi.brand || detected.brand || '',
            supplier: qi.supplier || detected.supplier || 'Por Asignar',
            model: qi.model || '',
            quantity: remaining,
            totalContractQty: totalQty,
            alreadyDispatchedQty: dispatched,
            unitPriceCOP: Number(qi.unitSalePrice) || 0,
            notes: qi.notes || '',
            equipmentId: qi.equipmentId,
            sourceLabel: 'Cotización',
          });
        }
      });
    }

    return list;
  }, [linkedTender, linkedContract, linkedQuote, existingOrders, orderToEdit, supplierProfiles]);

  // Which equipments from the linked contract are currently NOT selected in this OV
  const unselectedContractItems = useMemo(() => {
    return contractAvailableEquipments.filter((cEq) => {
      return !itemDrafts.some((draft) => {
        if (!draft.isSelected) return false;
        return doesItemMatch(cEq, draft);
      });
    });
  }, [contractAvailableEquipments, itemDrafts]);

  // Add or include an item from the linked contract into itemDrafts
  const handleAddContractItemToOrder = (cEq: typeof contractAvailableEquipments[0]) => {
    setItemDrafts((prev) => {
      const existingIdx = prev.findIndex((d) => doesItemMatch(cEq, d));

      if (existingIdx >= 0) {
        return prev.map((d, i) => (i === existingIdx ? { ...d, isSelected: true } : d));
      }

      const detected = detectSupplierAndBrandForItem(cEq);

      const newItem: ItemDraftState = {
        id: `item-from-contract-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        equipmentId: cEq.equipmentId,
        code: cEq.code,
        name: cEq.name,
        brand: cEq.brand || detected.brand || '',
        supplier: cEq.supplier || detected.supplier || 'Por Asignar',
        model: cEq.model,
        quotedQuantity: cEq.quantity,
        quantityToDispatch: cEq.quantity,
        totalContractQuantity: cEq.totalContractQty || cEq.quantity,
        alreadyDispatchedQuantity: cEq.alreadyDispatchedQty || 0,
        unitSalePriceCOP: cEq.unitPriceCOP,
        totalSalePriceCOP: cEq.quantity * cEq.unitPriceCOP,
        equipmentStatus: 'Pendiente de OC',
        assignedSerialNumbers: [],
        isSelected: true,
        notes: cEq.notes || '',
      };
      return [...prev, newItem];
    });
  };

  // Check if contractNumber or OC number is already used in an existing active Sales Order
  const duplicateOrderFound = useMemo(() => {
    if (!contractNumber || !contractNumber.trim()) return null;
    const cleanCurrent = cleanNorm(contractNumber);
    if (!cleanCurrent || cleanCurrent.length < 3 || ['na', 'n/a', 'sincontrato', 'oc', 'ov', 'proceso', 'contratolicitacion'].includes(cleanCurrent)) return null;

    return (existingOrders || []).find((ov) => {
      if (!ov || ov.id === orderToEdit?.id || ov.status === 'Cancelada' || isSalesOrderDeleted(ov.id, ov.salesOrderNumber, ov.tenderClientId, ov.contractId)) return false;
      const otherContractNum = cleanNorm(ov.contractNumber);
      if (!otherContractNum || otherContractNum.length < 3) return false;
      return otherContractNum === cleanCurrent;
    });
  }, [contractNumber, existingOrders, orderToEdit]);

  const isDuplicateContractNumber = Boolean(duplicateOrderFound);

  // Check if salesOrderNumber is already used in an existing active Sales Order
  const duplicateSOFound = useMemo(() => {
    if (!salesOrderNumber || !salesOrderNumber.trim()) return null;
    const cleanCurrent = cleanNorm(salesOrderNumber);
    if (!cleanCurrent || cleanCurrent.length < 2 || ['ov', 'sinov'].includes(cleanCurrent)) return null;

    return (existingOrders || []).find((ov) => {
      if (!ov || ov.id === orderToEdit?.id || ov.status === 'Cancelada' || isSalesOrderDeleted(ov.id, ov.salesOrderNumber, ov.tenderClientId, ov.contractId)) return false;
      const otherSONum = cleanNorm(ov.salesOrderNumber);
      return otherSONum === cleanCurrent;
    });
  }, [salesOrderNumber, existingOrders, orderToEdit]);

  // Calculate selected total
  const selectedItems = itemDrafts.filter((it) => it.isSelected);
  const totalSelectedValueCOP = selectedItems.reduce((acc, it) => acc + (it.totalSalePriceCOP || 0), 0);

  // Submit handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!salesOrderNumber.trim()) {
      alert('Por favor especifica el número de la Orden de Venta (ej: OV-2026-001)');
      return;
    }
    if (duplicateSOFound) {
      alert(
        `⛔ N° DE ORDEN DE VENTA REPETIDO:\n\nLa Orden de Venta "${salesOrderNumber}" ya se encuentra registrada en el sistema.\n\nPor favor asigne un número de Orden de Venta consecutivo único.`
      );
      return;
    }
    if (!clientName.trim()) {
      alert('Por favor especifica el nombre del cliente o institución médica');
      return;
    }
    if (selectedItems.length === 0) {
      alert('Debes seleccionar al menos un equipo médico para incluir en la Orden de Venta.');
      return;
    }

    const cleanItems: SalesOrderItem[] = selectedItems.map((draft) => {
      const { isSelected, totalContractQuantity, alreadyDispatchedQuantity, ...rest } = draft;
      const detected = detectSupplierAndBrandForItem(rest);
      const isPlaceholder =
        !rest.supplier ||
        ['por asignar', 'sin proveedor asignado', 'n/a', 'ninguno', 'proveedor principal'].includes(
          rest.supplier.trim().toLowerCase()
        );
      const finalSupplier = (!isPlaceholder && rest.supplier?.trim())
        ? rest.supplier.trim()
        : (detected.supplier && detected.supplier !== 'Por Asignar' ? detected.supplier : (rest.brand || detected.brand || 'Proveedor Principal'));
      const finalBrand = rest.brand?.trim() || detected.brand?.trim() || '';
      return {
        ...rest,
        brand: finalBrand,
        supplier: finalSupplier,
        supplierName: finalSupplier,
      };
    });

    const finalOrder: SalesOrderRecord = {
      id: orderToEdit?.id || `ov-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      salesOrderNumber: salesOrderNumber.trim().toUpperCase(),
      quoteId: selectedQuoteId || undefined,
      quoteNumber: quoteNumber || undefined,
      contractId: contractId || orderToEdit?.contractId,
      contractNumber: contractNumber || orderToEdit?.contractNumber,
      tenderClientId: selectedTenderClientId || orderToEdit?.tenderClientId,
      clientName: clientName.trim(),
      clientNit: clientNit.trim(),
      clientCity: clientCity.trim(),
      clientContactPerson: clientContactPerson.trim(),
      clientContactPhone: clientContactPhone.trim(),
      clientContactEmail: clientContactEmail.trim(),
      orderDate: orderDate,
      dispatchDate: orderDate,
      deliveryDate: deliveryDate || undefined,
      status: status,
      items: cleanItems,
      totalValueCOP: totalSelectedValueCOP,
      invoicedStatus: orderToEdit?.invoicedStatus || 'No Facturada',
      invoiceNumber: orderToEdit?.invoiceNumber,
      invoiceId: orderToEdit?.invoiceId,
      invoiceDate: orderToEdit?.invoiceDate,
      attachedInvoiceFile: orderToEdit?.attachedInvoiceFile,
      attachedDeliveryReceipt: orderToEdit?.attachedDeliveryReceipt,
      ocContractId: orderToEdit?.ocContractId,
      hasLinkedOC: orderToEdit?.hasLinkedOC || false,
      notes: notes.trim(),
      preparedBy: orderToEdit?.preparedBy || currentUser?.name || 'Ing. Biomédico SyD',
      createdAt: orderToEdit?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await onSave(finalOrder, true);
      onClose();
    } catch (err) {
      console.error('Error in onSave:', err);
      onClose();
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black/25 overflow-y-auto animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-5xl xl:max-w-6xl max-h-[86vh] h-[84vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Harmonious Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  {orderToEdit ? 'Editar Orden de Venta (OV)' : 'Nueva Orden de Venta (OV)'}
                </h2>
                {quoteNumber && (
                  <span className="px-2 py-0.5 rounded text-xs bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/20 flex items-center gap-1 font-medium">
                    <FileText className="w-3 h-3" />
                    Cotización {quoteNumber}
                  </span>
                )}
                {contractNumber && (
                  <span className="px-2 py-0.5 rounded text-xs bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1 font-medium">
                    <Award className="w-3 h-3" />
                    Contrato {contractNumber}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Formalización comercial, selección de equipos a despachar y asignación de proveedores para compras (OC).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live summary badge in header */}
            <div className="hidden sm:flex items-center gap-2.5 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block leading-none">Total Orden</span>
                <span className="text-xs font-bold text-amber-400 leading-tight">
                  {formatCOP(totalSelectedValueCOP)}
                </span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {itemDrafts.length} {itemDrafts.length === 1 ? 'eq' : 'eqs'}
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Cerrar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Form with 2-Column Responsive Harmonious Grid & Sticky Footer */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Scrollable Workspace */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
              
              {/* LEFT COLUMN: Order Origin, Client & Delivery Data (Compact Sidebar) */}
              <div className="lg:col-span-5 xl:col-span-4 space-y-3">
                {/* 1. Origen y Número de Orden */}
                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                      <ReceiptText className="w-3.5 h-3.5 text-amber-400" />
                      1. Origen y N° de OV
                    </span>
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20 font-medium">
                      Requerido
                    </span>
                  </div>

                  {/* Origin Selector Pills (Cotización, Licitación, Directa) */}
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900/90 rounded-lg border border-slate-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        setOriginType('quote');
                        setSelectedTenderClientId('');
                        setSelectedContractId('');
                        setContractId(undefined);
                        setContractNumber(undefined);
                      }}
                      className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded font-semibold transition cursor-pointer ${
                        originType === 'quote'
                          ? 'bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40 shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <FileText className="w-3 h-3" />
                      <span>Cotización</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOriginType('tender');
                        setSelectedQuoteId('');
                        setSelectedContractId('');
                        setQuoteNumber('');
                      }}
                      className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded font-semibold transition cursor-pointer ${
                        originType === 'tender'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Award className="w-3 h-3" />
                      <span>Licitación</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOriginType('manual');
                        setSelectedQuoteId('');
                        setQuoteNumber('');
                        setSelectedTenderClientId('');
                        setSelectedContractId('');
                        setContractId(undefined);
                        setContractNumber(undefined);
                      }}
                      className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded font-semibold transition cursor-pointer ${
                        originType === 'manual'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Plus className="w-3 h-3" />
                      <span>Directa</span>
                    </button>
                  </div>

                  {/* Dynamic Source Selection */}
                  {originType === 'quote' && (
                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Cotización Vinculada
                      </label>
                      <select
                        value={selectedQuoteId}
                        onChange={(e) => handleSelectQuote(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-sky-400"
                      >
                        <option value="">-- Seleccionar cotización --</option>
                        {savedQuotes.map((q) => {
                          const linkedTender = tenderClients.find(
                            (t) =>
                              t.linkedQuoteId === q.id ||
                              t.header?.linkedQuoteId === q.id ||
                              t.linkedQuoteNumber === q.quoteNumber ||
                              t.header?.linkedQuoteNumber === q.quoteNumber ||
                              (q as any).linkedTenderId === t.id
                          );
                          const isLinked = Boolean(linkedTender);
                          const isAwarded = linkedTender?.status === 'Adjudicada';
                          const isBlocked = isLinked && !isAwarded;

                          return (
                            <option key={q.id} value={q.id} disabled={isBlocked}>
                              {isBlocked ? '⛔ [En Proceso] ' : isLinked ? '✓ [Adjudicada] ' : '🛒 [Directa] '}
                              {q.quoteNumber} — {q.clientName || 'Cliente'} [{q.items?.length || 0} eqs]
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {originType === 'tender' && (
                    <div>
                      <label className="block text-[11px] font-medium text-purple-300 mb-1">
                        Licitación / Contrato Adjudicado
                      </label>
                      <select
                        value={selectedTenderClientId}
                        onChange={(e) => handleSelectTender(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-purple-500/50 rounded-lg text-xs text-white focus:outline-none focus:border-purple-400"
                      >
                        <option value="">-- Seleccionar proceso adjudicado --</option>
                        {tenderClients.map((t) => {
                          const isAwarded = t.status === 'Adjudicada';
                          const isDirect =
                            Boolean((t as any).isDirectOC) ||
                            t.header?.processType === 'OC Directa' ||
                            t.header?.processType === 'Orden de Compra Directa del Cliente' ||
                            t.header?.processType === 'Contratación Directa' ||
                            /orden\s+de\s+compra|oc\s+directa/i.test(t.header?.processType || '') ||
                            /oc[-_\s]/i.test(t.header?.processNumber || '');
                          const isAllowed = isDirect || isAwarded;

                          const tracker = getAlreadyDispatchedQuantities(
                            t.id,
                            t.header?.processNumber,
                            undefined,
                            undefined,
                            undefined,
                            t.clientName
                          );
                          const totalTenderUnits = (t.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 1), 0);
                          const pendingTenderUnits = (t.items || []).reduce((sum, it) => {
                            const q = Number(it.quantity) || 1;
                            const d = getDispatchedCount(it, tracker);
                            return sum + Math.max(0, q - d);
                          }, 0);
                          const isFullyDispatched = isAllowed && totalTenderUnits > 0 && pendingTenderUnits === 0;

                          return (
                            <option key={t.id} value={t.id} disabled={!isAllowed || (isFullyDispatched && !orderToEdit)}>
                              {isFullyDispatched
                                ? `✓ [COMPLETO • OV Generada] `
                                : isAwarded
                                ? `✓ [ADJUDICADA • ${pendingTenderUnits} de ${totalTenderUnits} eqs pend.] `
                                : isDirect
                                ? `✓ [DIRECTA • ${pendingTenderUnits} de ${totalTenderUnits} eqs pend.] `
                                : `⛔ [${t.status || 'En Proceso'}] `}
                              {t.header?.processNumber || 'Proceso'} — {t.clientName || t.header?.entityName} [{pendingTenderUnits} pendientes]
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {/* N° de Contrato / OC del Cliente / Proceso */}
                  <div>
                    <label className="block text-[11px] font-medium text-purple-300 mb-1 flex items-center justify-between">
                      <span>N° de Contrato / OC del Cliente / Proceso</span>
                      <span className="text-[10px] text-purple-400/80 font-normal">Identificador único</span>
                    </label>
                    <input
                      type="text"
                      value={contractNumber || ''}
                      onChange={(e) => handleContractNumberChange(e.target.value)}
                      placeholder="ej: OC-2026-994, Contrato 450001 o NOHB-1025"
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-purple-500/50 rounded-lg text-xs font-mono font-bold text-purple-200 focus:outline-none focus:border-purple-400 placeholder:text-slate-600 placeholder:font-normal"
                    />
                    {isDuplicateContractNumber && (
                      <p className="text-[10.5px] text-sky-400 font-semibold mt-1 flex items-center gap-1 bg-sky-950/60 p-1.5 rounded border border-sky-500/30">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-sky-400" />
                        <span>Este Contrato/Proceso tiene entregas previas (OV: {duplicateOrderFound?.salesOrderNumber}). Esta nueva OV se sumará al seguimiento de este contrato.</span>
                      </p>
                    )}
                  </div>

                  {/* Número de Orden de Venta */}
                  <div>
                    <label className="block text-[11px] font-medium text-amber-300 mb-1 flex items-center justify-between">
                      <span>N° de Orden de Venta (OV) *</span>
                      <span className="text-[10px] text-amber-400/80 font-normal">Consecutivo SyD</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        required
                        value={salesOrderNumber}
                        onChange={(e) => setSalesOrderNumber(e.target.value)}
                        placeholder="ej: OV-1052 o 1052"
                        className="flex-1 px-2.5 py-1.5 bg-slate-950 border border-amber-500/60 rounded-lg text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-400 placeholder:text-slate-600 placeholder:font-normal"
                      />
                      {!salesOrderNumber && (
                        <button
                          type="button"
                          onClick={() => setSalesOrderNumber(generateNextSalesOrderNumber(existingOrders))}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 whitespace-nowrap cursor-pointer transition font-medium"
                          title="Sugerir consecutivo automático"
                        >
                          Sugerir
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Datos del Cliente */}
                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-sky-400" />
                    2. Cliente e Institución
                  </span>

                  {/* Cliente Name with Search */}
                  <div className="relative" ref={clientInputWrapperRef}>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Nombre o Razón Social *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={clientName}
                        onChange={(e) => handleClientNameChange(e.target.value)}
                        onFocus={() => {
                          if (clientName && clientName.trim().length >= 1) {
                            handleClientNameChange(clientName);
                          }
                        }}
                        placeholder="Nombre del cliente o clínica..."
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-sky-400 pr-7"
                        autoComplete="off"
                      />
                      {clientName && (
                        <button
                          type="button"
                          onClick={() => {
                            setClientName('');
                            setShowClientSuggestions(false);
                          }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-200"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Suggestions list */}
                    {showClientSuggestions && clientSuggestions.length > 0 && (
                      <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden divide-y divide-slate-800 max-h-52 overflow-y-auto">
                        <div className="px-3 py-1 bg-slate-950 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Clientes Sugeridos ({clientSuggestions.length})
                        </div>
                        {clientSuggestions.map((sug, idx) => (
                          <button
                            key={sug.id || idx}
                            type="button"
                            onClick={() => handleSelectClientSuggestion(sug)}
                            className="w-full text-left px-3 py-2 hover:bg-sky-950/40 transition-colors flex items-center justify-between gap-2 group cursor-pointer"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-white group-hover:text-sky-300 truncate">
                                {sug.name}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate">
                                {sug.nit ? `NIT: ${sug.nit}` : ''} {sug.city ? `• ${sug.city}` : ''}
                              </div>
                            </div>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium">
                              Elegir
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* NIT & Ciudad (2 cols) */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 mb-0.5">NIT / ID</label>
                      <input
                        type="text"
                        value={clientNit}
                        onChange={(e) => setClientNit(e.target.value)}
                        placeholder="ej: 890.399.010-6"
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-sky-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 mb-0.5">Ciudad</label>
                      <input
                        type="text"
                        value={clientCity}
                        onChange={(e) => setClientCity(e.target.value)}
                        placeholder="ej: Cali, Valle"
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-sky-400"
                      />
                    </div>
                  </div>

                  {/* Contacto & Teléfono (2 cols) */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 mb-0.5">Contacto</label>
                      <input
                        type="text"
                        value={clientContactPerson}
                        onChange={(e) => setClientContactPerson(e.target.value)}
                        placeholder="Persona contacto"
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-sky-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 mb-0.5">Teléfono</label>
                      <input
                        type="text"
                        value={clientContactPhone}
                        onChange={(e) => setClientContactPhone(e.target.value)}
                        placeholder="ej: 315 889 4421"
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-sky-400"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Fechas, Estado y Notas */}
                <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    3. Fechas, Estado y Notas
                  </span>

                  {/* Dates (2 cols) */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 mb-0.5">Fecha OV *</label>
                      <input
                        type="date"
                        required
                        value={orderDate}
                        onChange={(e) => setOrderDate(e.target.value)}
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-medium text-slate-400 mb-0.5">Entrega Estimada</label>
                      <input
                        type="date"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-[10px] font-medium text-slate-400 mb-0.5">Estado de la Orden</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as SalesOrderStatus)}
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-emerald-400"
                    >
                      <option value="Borrador">Borrador</option>
                      <option value="En Proceso">En Proceso</option>
                      <option value="Equipos en Bodega">Equipos en Bodega</option>
                      <option value="Entregada al Cliente">Entregada al Cliente</option>
                      <option value="Listo para Facturar">Listo para Facturar</option>
                      {status === 'Facturada' && <option value="Facturada">Facturada</option>}
                      <option value="Cancelada">Cancelada</option>
                    </select>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-[10px] font-medium text-slate-400 mb-0.5">Observaciones</label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Condiciones de despacho, entrega o notas..."
                      className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Equipment Workspace & Clean Data Table */}
              <div className="lg:col-span-7 xl:col-span-8 flex flex-col space-y-3">
                
                {/* Equipment Section Header Toolbar */}
                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-400" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-white">
                          4. Equipos Médicos en esta OV
                        </span>
                        <span className="text-[11px] px-2 py-0.2 rounded-full font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          {itemDrafts.length} {itemDrafts.length === 1 ? 'equipo' : 'equipos'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 hidden sm:block">
                        Asigna el proveedor para compras (OC), ajusta cantidades y precios de venta.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {itemDrafts.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleAllItemsFold(areAllItemsFolded)}
                          className="text-xs px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer flex items-center gap-1 font-medium shadow-2xs"
                          title={areAllItemsFolded ? 'Desplegar detalles de todos los equipos' : 'Plegar detalles de todos los equipos'}
                        >
                          <ChevronsUpDown className="w-3 h-3 text-amber-400" />
                          <span>{areAllItemsFolded ? 'Desplegar Todos' : 'Plegar Todos'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setItemDrafts([])}
                          className="text-xs px-2 py-1 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-300 border border-slate-700 transition cursor-pointer"
                          title="Quitar todos los equipos de la orden"
                        >
                          Quitar Todos
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsAddingManualItem(!isAddingManualItem)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition cursor-pointer flex items-center gap-1 shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Agregar Equipo</span>
                    </button>
                  </div>
                </div>

                {/* Available Contract Equipments: Slim, Harmonious & Compact Bar */}
                {unselectedContractItems.length > 0 && (
                  <div className="rounded-xl bg-purple-950/30 border border-purple-500/30 overflow-hidden text-xs transition-all">
                    <div className="p-2.5 flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-md bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 border border-purple-500/30">
                          <PackageCheck className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-white text-xs">
                            Equipos del Contrato Disponibles ({unselectedContractItems.length})
                          </span>
                          <span className="text-[10px] text-purple-300/80 ml-2 hidden sm:inline">
                            Haz clic en «+ Agregar» para sumarlos a esta OV
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setIsAvailableContractItemsFolded(!isAvailableContractItemsFolded)}
                          className="px-2 py-0.5 text-[11px] font-semibold rounded bg-slate-900/80 hover:bg-slate-800 text-purple-200 border border-purple-500/30 transition cursor-pointer flex items-center gap-1"
                        >
                          {isAvailableContractItemsFolded ? (
                            <>
                              <ChevronDown className="w-3 h-3 text-purple-300" />
                              <span>Ver Disponibles ({unselectedContractItems.length})</span>
                            </>
                          ) : (
                            <>
                              <ChevronUp className="w-3 h-3 text-purple-300" />
                              <span>Plegar</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            unselectedContractItems.forEach((cEq) => handleAddContractItemToOrder(cEq));
                          }}
                          className="px-2.5 py-0.5 text-[11px] font-bold rounded bg-purple-600 hover:bg-purple-500 text-white transition cursor-pointer shadow-xs flex items-center gap-1"
                          title="Agregar todos los equipos disponibles del contrato a esta orden"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Agregar Todos</span>
                        </button>
                      </div>
                    </div>

                    {!isAvailableContractItemsFolded && (
                      <div className="px-2.5 pb-2.5 pt-1.5 border-t border-purple-500/20">
                        <div className="flex flex-wrap gap-2">
                          {unselectedContractItems.map((cEq) => (
                            <div
                              key={`avail-citem-${cEq.sourceId}`}
                              className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-purple-500/30 hover:border-purple-400 text-xs shadow-2xs"
                            >
                              <div className="min-w-0">
                                <span className="font-semibold text-white truncate block max-w-[150px] sm:max-w-[180px]">
                                  {cEq.name}
                                </span>
                                <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                  <span className="text-purple-300 font-mono">Disp: {cEq.quantity}</span>
                                  {cEq.unitPriceCOP > 0 && (
                                    <span className="text-emerald-400 font-medium">• {formatCOP(cEq.unitPriceCOP)}</span>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleAddContractItemToOrder(cEq)}
                                className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition cursor-pointer shrink-0 shadow-xs"
                                title="Sumar este equipo a la OV"
                              >
                                + Agregar
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Drawer: Add Manual Equipment / From SyD Catalog */}
                {isAddingManualItem && (
                  <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-2.5 text-xs animate-in fade-in">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-400">Agregar Equipo Adicional</span>
                        <span className="text-[10px] text-slate-400">Manual o catálogo SyD</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddingManualItem(false)}
                        className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-slate-800"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                      <div className="sm:col-span-3">
                        <label className="block text-[10px] text-slate-400 mb-0.5">Catálogo SyD (Carga Rápida)</label>
                        <select
                          value={selectedCatalogEquipmentId}
                          onChange={(e) => {
                            const eqId = e.target.value;
                            setSelectedCatalogEquipmentId(eqId);
                            const matched = equipments.find((eq) => eq.id === eqId);
                            if (matched) {
                              setManualItemName(matched.name);
                              setManualItemBrand(matched.brand);
                              setManualItemModel(matched.model);
                              setManualItemUnitPrice(matched.baseCostCOP ? Math.round(matched.baseCostCOP * 1.4) : 0);
                            }
                          }}
                          className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                        >
                          <option value="">-- Cargar desde catálogo --</option>
                          {equipments.map((eq) => (
                            <option key={eq.id} value={eq.id}>
                              {eq.name} ({eq.brand})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3">
                        <label className="block text-[10px] text-slate-400 mb-0.5">Nombre del Equipo *</label>
                        <input
                          type="text"
                          value={manualItemName}
                          onChange={(e) => setManualItemName(e.target.value)}
                          placeholder="Nombre del equipo"
                          className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] text-slate-400 mb-0.5">Marca / Modelo</label>
                        <input
                          type="text"
                          value={manualItemBrand}
                          onChange={(e) => setManualItemBrand(e.target.value)}
                          placeholder="Marca"
                          className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                        />
                      </div>

                      <div className="sm:col-span-1">
                        <label className="block text-[10px] text-slate-400 mb-0.5">Cant.</label>
                        <input
                          type="number"
                          min="1"
                          value={manualItemQty}
                          onChange={(e) => setManualItemQty(Number(e.target.value) || 1)}
                          className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white text-center font-bold"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] text-slate-400 mb-0.5">Precio Unitario (COP)</label>
                        <input
                          type="number"
                          min="0"
                          value={manualItemUnitPrice}
                          onChange={(e) => setManualItemUnitPrice(Number(e.target.value) || 0)}
                          className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                        />
                      </div>

                      <div className="sm:col-span-1 flex items-end">
                        <button
                          type="button"
                          onClick={handleAddManualItem}
                          className="w-full py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition flex items-center justify-center gap-1 shadow-sm"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Incluir</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Equipment Data Table: Elegant, Aligned, Harmonious & Compact */}
                {itemDrafts.length === 0 ? (
                  <div className="py-10 text-center border-2 border-dashed border-slate-700/60 rounded-xl bg-slate-900/30 px-4">
                    <Layers className="w-8 h-8 mx-auto text-emerald-400/50 mb-2" />
                    <p className="text-xs sm:text-sm font-bold text-white">
                      {selectedQuoteId || selectedTenderClientId || selectedContractId
                        ? unselectedContractItems.length > 0
                          ? 'Ningún equipo seleccionado aún para esta Orden de Venta'
                          : 'Todos los equipos de este proceso ya están asignados a una OV'
                        : 'No hay equipos agregados en esta orden'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                      {unselectedContractItems.length > 0
                        ? 'Presiona «+ Agregar» en cualquiera de los equipos del contrato disponibles arriba o «+ Agregar Todos».'
                        : 'Selecciona una cotización o licitación a la izquierda o presiona «+ Agregar Equipo» arriba.'}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-800 bg-slate-900/90 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            <th className="py-2 px-2.5 w-7 text-center">#</th>
                            <th className="py-2 px-2.5">Equipo & Descripción</th>
                            <th className="py-2 px-2.5 w-44">Proveedor Asignado para OC</th>
                            <th className="py-2 px-2 w-16 text-center">Cant.</th>
                            <th className="py-2 px-2.5 w-28 text-right">Vlr. Unitario</th>
                            <th className="py-2 px-2.5 w-28 text-right">Subtotal</th>
                            <th className="py-2 px-2 w-14 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 text-xs">
                          {itemDrafts.map((item, index) => {
                            const expanded = isItemExpanded(index, item.id);
                            return (
                              <React.Fragment key={item.id || index}>
                                <tr className="hover:bg-slate-900/50 transition-colors group">
                                  {/* Number */}
                                  <td className="py-2 px-2.5 text-center font-bold text-slate-400">
                                    {index + 1}
                                  </td>

                                  {/* Equipo Info */}
                                  <td className="py-2 px-2.5 min-w-[170px]">
                                    <div className="font-semibold text-white truncate max-w-[200px] sm:max-w-[240px]">
                                      {item.name}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                                      {item.code && (
                                        <span className="font-mono text-cyan-300 bg-slate-900 px-1 py-0.2 rounded border border-slate-800">
                                          {item.code}
                                        </span>
                                      )}
                                      <span>{resolveItemManufacturerBrand(item)}</span>
                                      {item.model && <span>({item.model})</span>}
                                      {item.totalContractQuantity !== undefined && item.alreadyDispatchedQuantity !== undefined && item.alreadyDispatchedQuantity > 0 ? (
                                        <span className="text-amber-300 font-medium">
                                          • Disp: {item.quotedQuantity} (de {item.totalContractQuantity})
                                        </span>
                                      ) : null}
                                    </div>
                                  </td>

                                  {/* Proveedor para OC with Datalist */}
                                  <td className="py-2 px-2.5">
                                    <input
                                      type="text"
                                      list={`suppliers-list-${index}`}
                                      value={item.supplier || ''}
                                      onChange={(e) => handleItemSupplierChange(index, e.target.value)}
                                      placeholder="Proveedor para OC..."
                                      className="w-full px-2 py-1 bg-slate-900 border border-slate-700/80 focus:border-sky-400 rounded text-xs text-white placeholder:text-slate-600 font-medium"
                                    />
                                    <datalist id={`suppliers-list-${index}`}>
                                      {supplierProfiles.map((p) => (
                                        <option key={p.id} value={p.name}>
                                          {p.brands && p.brands.length > 0 ? `Marcas: ${p.brands.join(', ')}` : p.city || 'Proveedor registrado'}
                                        </option>
                                      ))}
                                      {equipments
                                        .map((e) => e.supplier)
                                        .filter((s): s is string => Boolean(s && s.trim()))
                                        .filter((s, sIdx, arr) => arr.indexOf(s) === sIdx)
                                        .map((s, sIdx) => (
                                          <option key={`eq-sup-${sIdx}`} value={s}>
                                            Proveedor de Catálogo
                                          </option>
                                        ))}
                                    </datalist>
                                    <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                      <span className="text-slate-400">Estado:</span>
                                      <span className="text-sky-300 font-medium truncate max-w-[120px]">
                                        {item.equipmentStatus || 'Pendiente de OC'}
                                      </span>
                                    </div>
                                  </td>

                                  {/* Cantidad Input */}
                                  <td className="py-2 px-2 text-center">
                                    <input
                                      type="number"
                                      min="1"
                                      value={item.quantityToDispatch}
                                      onChange={(e) => handleItemQuantityChange(index, Number(e.target.value) || 1)}
                                      className="w-14 mx-auto block px-1 py-1 bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded text-xs font-bold text-center text-white"
                                    />
                                  </td>

                                  {/* Precio Unitario Input */}
                                  <td className="py-2 px-2.5 text-right">
                                    <input
                                      type="number"
                                      min="0"
                                      value={item.unitSalePriceCOP}
                                      onChange={(e) => handleItemUnitPriceChange(index, Number(e.target.value) || 0)}
                                      className="w-24 ml-auto block px-1.5 py-1 bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded text-xs text-right text-slate-200"
                                    />
                                  </td>

                                  {/* Subtotal */}
                                  <td className="py-2 px-2.5 text-right font-bold text-emerald-400">
                                    {formatCOP(item.totalSalePriceCOP || 0)}
                                  </td>

                                  {/* Actions: Toggle Details & Trash */}
                                  <td className="py-2 px-2 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => toggleItemExpanded(index, item.id)}
                                        className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition cursor-pointer"
                                        title={expanded ? 'Ocultar detalles adicionales' : 'Editar estado y detalles'}
                                      >
                                        {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveItem(index)}
                                        className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                                        title="Quitar este equipo de la orden"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>

                                {/* Collapsible Row Details */}
                                {expanded && (
                                  <tr className="bg-slate-900/60 border-t border-slate-800/80">
                                    <td colSpan={7} className="px-4 py-2.5">
                                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                                        <div>
                                          <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                                            Estado del Equipo
                                          </label>
                                          <select
                                            value={item.equipmentStatus || 'Pendiente de OC'}
                                            onChange={(e) =>
                                              handleItemStatusChange(index, e.target.value as SalesOrderEquipmentStatus)
                                            }
                                            className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                                          >
                                            <option value="Pendiente de OC">Pendiente de OC</option>
                                            <option value="OC Solicitada a Proveedor">OC Solicitada a Proveedor</option>
                                            <option value="En Bodega SYD">En Bodega SYD</option>
                                            <option value="Entregado al Cliente">Entregado al Cliente</option>
                                          </select>
                                        </div>

                                        <div>
                                          <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                                            Marca Específica
                                          </label>
                                          <input
                                            type="text"
                                            value={item.brand || ''}
                                            onChange={(e) => handleItemBrandChange(index, e.target.value)}
                                            placeholder="Marca"
                                            className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                                            Modelo Específico
                                          </label>
                                          <input
                                            type="text"
                                            value={item.model || ''}
                                            onChange={(e) => {
                                              const updated = [...itemDrafts];
                                              updated[index].model = e.target.value;
                                              setItemDrafts(updated);
                                            }}
                                            placeholder="Modelo"
                                            className="w-full px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white"
                                          />
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Subtotal summary card inside right column */}
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    Equipos incluidos en esta Orden: <strong className="text-white">{itemDrafts.length}</strong>
                    {itemDrafts.length > 0 && (
                      <span className="text-slate-500 ml-2">
                        (Cant. Total:{' '}
                        {itemDrafts.reduce((acc, it) => acc + (it.quantityToDispatch || 0), 0)})
                      </span>
                    )}
                  </span>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block leading-none">Subtotal Equipos</span>
                    <span className="text-sm sm:text-base font-black text-amber-400">
                      {formatCOP(totalSelectedValueCOP)}
                    </span>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Sticky Modal Action Footer */}
          <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/95 flex items-center justify-between flex-wrap gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-400">Total Valor Orden de Venta:</span>
              <span className="text-base sm:text-lg font-black text-amber-400">
                {formatCOP(totalSelectedValueCOP)}
              </span>
              <span className="text-xs text-slate-500 hidden sm:inline">
                • {itemDrafts.length} {itemDrafts.length === 1 ? 'equipo' : 'equipos'}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer"
              >
                <PackageCheck className="w-4 h-4" />
                <span>{orderToEdit ? 'Guardar Cambios' : 'Crear Orden de Venta (OV)'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
