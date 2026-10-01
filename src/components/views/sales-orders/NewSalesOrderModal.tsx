import React, { useState, useEffect, useRef } from 'react';
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
} from '../../../types';
import { generateNextSalesOrderNumber } from '../../../utils/salesOrdersStorage';
import { formatCOP } from '../../../utils/formatters';
import { getStoredClients, ClientRecord } from '../../../utils/clientStorage';
import { isSalesOrderDeleted } from '../../../utils/tombstones';

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
  const [originType, setOriginType] = useState<'quote' | 'tender' | 'oc_tracking' | 'manual'>('quote');
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
  }
  const [itemDrafts, setItemDrafts] = useState<ItemDraftState[]>([]);

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

  const getAlreadyAssignedItemKeys = (
    tenderId?: string,
    processNum?: string,
    contractId?: string,
    quoteId?: string,
    quoteNum?: string,
    client?: string
  ): Set<string> => {
    const assignedKeys = new Set<string>();
    const normClient = cleanNorm(client);
    const normProcess = cleanNorm(processNum);
    const normQuote = cleanNorm(quoteNum);

    (existingOrders || []).forEach((ov) => {
      if (!ov || ov.id === orderToEdit?.id || ov.status === 'Cancelada' || isSalesOrderDeleted(ov.id)) return;

      const ovProcess = cleanNorm(ov.contractNumber);
      const ovQuote = cleanNorm(ov.quoteNumber);

      const matchesTender = Boolean(tenderId && (ov.tenderClientId === tenderId || ov.contractId === tenderId));
      const matchesProcess = Boolean(normProcess && ovProcess && normProcess === ovProcess);
      const matchesContract = Boolean(contractId && (ov.ocContractId === contractId || ov.contractId === contractId));
      const matchesQuote = Boolean(quoteId && ov.quoteId === quoteId);
      const matchesQuoteNum = Boolean(normQuote && ovQuote && normQuote === ovQuote);

      if (matchesTender || matchesProcess || matchesContract || matchesQuote || matchesQuoteNum) {
        (ov.items || []).forEach((it) => {
          if (it.equipmentId) assignedKeys.add(`eq-${it.equipmentId}`);
          if (it.code) {
            assignedKeys.add(`code-${it.code.trim().toLowerCase()}`);
            assignedKeys.add(`code-${cleanNorm(it.code)}`);
          }
          if (it.name) {
            assignedKeys.add(`name-${it.name.trim().toLowerCase()}`);
            assignedKeys.add(`name-${cleanNorm(it.name)}`);
          }
        });
      }
    });
    return assignedKeys;
  };

  const isItemAssigned = (it: { equipmentId?: string; code?: string; name?: string }, assignedKeys: Set<string>) => {
    if (it.equipmentId && assignedKeys.has(`eq-${it.equipmentId}`)) return true;
    if (it.code) {
      if (assignedKeys.has(`code-${it.code.trim().toLowerCase()}`)) return true;
      if (assignedKeys.has(`code-${cleanNorm(it.code)}`)) return true;
    }
    if (it.name) {
      if (assignedKeys.has(`name-${it.name.trim().toLowerCase()}`)) return true;
      if (assignedKeys.has(`name-${cleanNorm(it.name)}`)) return true;
    }
    return false;
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

      const mapped: ItemDraftState[] = (orderToEdit.items || []).map((it) => ({
        ...it,
        isSelected: true,
        equipmentStatus: it.equipmentStatus || 'Pendiente de OC',
      }));
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

      const assignedKeys = getAlreadyAssignedItemKeys(
        initialTenderToConvert.id,
        initialTenderToConvert.header.processNumber,
        undefined,
        undefined,
        undefined,
        initialTenderToConvert.clientName
      );

      const unassignedItems = (initialTenderToConvert.items || []).filter((tItem) => !isItemAssigned(tItem, assignedKeys));
      const itemsToMap = unassignedItems.length > 0 ? unassignedItems : (initialTenderToConvert.items || []);

      const mapped: ItemDraftState[] = itemsToMap.map((tItem, idx) => {
        const qty = Number(tItem.quantity) || 1;
        const unitPrice = Number(tItem.offeredUnitPrice) || 0;
        return {
          id: `item-${Date.now()}-${idx}`,
          equipmentId: tItem.equipmentId,
          code: tItem.code || `EQ-${idx + 1}`,
          name: tItem.name,
          brand: tItem.brand || '',
          model: tItem.model || '',
          quotedQuantity: qty,
          quantityToDispatch: qty,
          unitSalePriceCOP: unitPrice,
          totalSalePriceCOP: unitPrice * qty,
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

      const assignedKeys = getAlreadyAssignedItemKeys(
        undefined,
        undefined,
        undefined,
        initialQuoteToConvert.id,
        initialQuoteToConvert.quoteNumber,
        initialQuoteToConvert.clientName
      );

      const unassignedItems = (initialQuoteToConvert.items || []).filter((qItem) => !isItemAssigned(qItem, assignedKeys));
      const itemsToMap = unassignedItems;

      const mapped: ItemDraftState[] = itemsToMap.map((qItem, idx) => {
        const qty = Number(qItem.quantity) || 1;
        const unitPrice = Number(qItem.unitSalePrice) || 0;
        return {
          id: `item-${Date.now()}-${idx}`,
          equipmentId: qItem.equipmentId,
          code: qItem.code || `EQ-${idx + 1}`,
          name: qItem.name,
          brand: qItem.brand || '',
          model: qItem.model || '',
          quotedQuantity: qty,
          quantityToDispatch: qty,
          unitSalePriceCOP: unitPrice,
          totalSalePriceCOP: unitPrice * qty,
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

      const assignedKeys = getAlreadyAssignedItemKeys(
        linkedTender?.id,
        linkedTender?.header.processNumber,
        undefined,
        matchedQuote.id,
        matchedQuote.quoteNumber,
        matchedQuote.clientName
      );

      const unassignedItems = (matchedQuote.items || []).filter((qItem) => !isItemAssigned(qItem, assignedKeys));
      const itemsToMap = unassignedItems.length > 0 ? unassignedItems : (matchedQuote.items || []);

      const mapped: ItemDraftState[] = itemsToMap.map((qItem, idx) => {
        const qty = Number(qItem.quantity) || 1;
        const unitPrice = Number(qItem.unitSalePrice) || 0;
        return {
          id: `item-${Date.now()}-${idx}`,
          equipmentId: qItem.equipmentId,
          code: qItem.code || `EQ-${idx + 1}`,
          name: qItem.name,
          brand: qItem.brand || '',
          model: qItem.model || '',
          quotedQuantity: qty,
          quantityToDispatch: qty,
          unitSalePriceCOP: unitPrice,
          totalSalePriceCOP: unitPrice * qty,
          equipmentStatus: 'Pendiente de OC',
          assignedSerialNumbers: [],
          isSelected: true,
          notes: qItem.notes || '',
        };
      });
      setItemDrafts(mapped);
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

      const assignedKeys = getAlreadyAssignedItemKeys(
        matchedTender.id,
        matchedTender.header.processNumber,
        undefined,
        undefined,
        undefined,
        matchedTender.clientName
      );

      const unassignedItems = (matchedTender.items || []).filter((tItem) => !isItemAssigned(tItem, assignedKeys));
      const itemsToMap = unassignedItems.length > 0 ? unassignedItems : (matchedTender.items || []);

      const mapped: ItemDraftState[] = itemsToMap.map((tItem, idx) => {
        const qty = Number(tItem.quantity) || 1;
        const unitPrice = Number(tItem.offeredUnitPrice) || 0;
        return {
          id: `item-${Date.now()}-${idx}`,
          equipmentId: tItem.equipmentId,
          code: tItem.code || `EQ-${idx + 1}`,
          name: tItem.name,
          brand: tItem.brand || '',
          model: tItem.model || '',
          quotedQuantity: qty,
          quantityToDispatch: qty,
          unitSalePriceCOP: unitPrice,
          totalSalePriceCOP: unitPrice * qty,
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

      const assignedKeys = getAlreadyAssignedItemKeys(
        matchedContract.tenderClientId,
        matchedContract.contractNumber,
        matchedContract.id,
        matchedContract.quoteId,
        matchedContract.quoteNumber,
        matchedContract.clientName
      );

      const unassignedItems = (matchedContract.items || []).filter((cItem) => !isItemAssigned(cItem, assignedKeys));
      const itemsToMap = unassignedItems;

      const mapped: ItemDraftState[] = itemsToMap.map((cItem, idx) => {
        const qty = Number(cItem.quantity) || 1;
        const cost = Number(cItem.costPriceCOP) || 0;
        const unitPrice = cost > 0 ? Math.round(cost * 1.35) : 10000000;
        return {
          id: `item-${Date.now()}-${idx}`,
          equipmentId: cItem.equipmentId,
          code: cItem.code || `EQ-${idx + 1}`,
          name: cItem.name,
          brand: cItem.brand || '',
          model: cItem.model || '',
          quotedQuantity: qty,
          quantityToDispatch: qty,
          unitSalePriceCOP: unitPrice,
          totalSalePriceCOP: unitPrice * qty,
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

  // Change supplier / brand for an item
  const handleItemBrandSupplierChange = (index: number, brandVal: string) => {
    setItemDrafts((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              brand: brandVal,
            }
          : item
      )
    );
  };

  // Remove item
  const handleRemoveItem = (index: number) => {
    setItemDrafts((prev) => prev.filter((_, i) => i !== index));
  };

  // Add manual item from catalog
  const handleAddManualItem = () => {
    if (!manualItemName.trim()) return;

    const newItem: ItemDraftState = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      equipmentId: selectedCatalogEquipmentId || undefined,
      code: 'EQ-MANUAL',
      name: manualItemName.trim(),
      brand: manualItemBrand.trim(),
      model: manualItemModel.trim(),
      quotedQuantity: manualItemQty,
      quantityToDispatch: manualItemQty,
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
    if (!clientName.trim()) {
      alert('Por favor especifica el nombre del cliente o institución médica');
      return;
    }
    if (selectedItems.length === 0) {
      alert('Debes seleccionar al menos un equipo médico para incluir en la Orden de Venta.');
      return;
    }

    const cleanItems: SalesOrderItem[] = selectedItems.map((draft) => {
      const { isSelected, ...rest } = draft;
      return rest;
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
      await onSave(finalOrder);
      onClose();
    } catch (err) {
      console.error('Error in onSave:', err);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2 flex-wrap">
                {orderToEdit ? 'Editar Orden de Venta (OV)' : 'Nueva Orden de Venta (OV)'}
                {quoteNumber && (
                  <span className="px-2 py-0.5 rounded text-xs bg-[#38bdf8]/10 text-[#38bdf8] border border-[#38bdf8]/20 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Cotización {quoteNumber}
                  </span>
                )}
                {contractNumber && (
                  <span className="px-2 py-0.5 rounded text-xs bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1">
                    <Award className="w-3 h-3" />
                    Contrato {contractNumber}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                Formalización del pedido, selección de equipos a despachar y enlace a compras (OC)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Origin Linkage & OV Number */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ReceiptText className="w-3.5 h-3.5 text-amber-400" />
                1. Origen y Número de Orden de Venta
              </span>
              <span className="text-[11px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                Toda venta pasa por OV
              </span>
            </div>

            {/* Origin Type Selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 bg-slate-900/80 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setOriginType('quote');
                  setSelectedTenderClientId('');
                  setSelectedContractId('');
                  setContractId(undefined);
                  setContractNumber(undefined);
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition ${
                  originType === 'quote'
                    ? 'bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>1. Cotización</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOriginType('tender');
                  setSelectedQuoteId('');
                  setSelectedContractId('');
                  setQuoteNumber('');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition ${
                  originType === 'tender'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>2. Licitación</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOriginType('oc_tracking');
                  setSelectedQuoteId('');
                  setSelectedTenderClientId('');
                  setQuoteNumber('');
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition ${
                  originType === 'oc_tracking'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>3. OC Cliente (Seg. OC)</span>
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
                className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition ${
                  originType === 'manual'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>4. Directa Manual</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Select Quote when originType === quote */}
              {originType === 'quote' && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Seleccionar Cotización (OC Directa o Licitación Adjudicada)
                  </label>
                  <select
                    value={selectedQuoteId}
                    onChange={(e) => handleSelectQuote(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-400"
                  >
                    <option value="">-- Seleccionar cotización guardada --</option>
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
                          {isBlocked
                            ? `⛔ [Licitación ${linkedTender?.status || 'En Proceso'}] `
                            : isLinked
                            ? '✓ [Licitación Adjudicada] '
                            : '🛒 [OC Directa] '}
                          {q.quoteNumber} — {q.clientName || 'Cliente sin nombre'} ({q.city}) [{q.items?.length || 0} equipos]
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Select Tender when originType === tender */}
              {originType === 'tender' && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-purple-300 mb-1.5">
                    Seleccionar Licitación o Contrato Adjudicado
                  </label>
                  <select
                    value={selectedTenderClientId}
                    onChange={(e) => handleSelectTender(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-purple-500/50 rounded-lg text-sm text-white focus:outline-none focus:border-purple-400"
                  >
                    <option value="">-- Seleccionar licitación / contrato --</option>
                    {tenderClients.map((t) => {
                      const isAwarded = t.status === 'Adjudicada';
                      return (
                        <option key={t.id} value={t.id} disabled={!isAwarded}>
                          {isAwarded ? '✓ [ADJUDICADA] ' : `⛔ [${t.status || 'En Proceso'} - Bloqueada] `}
                          {t.header.processNumber || t.header.processType || 'Proceso'} — {t.clientName || t.header.entityName} ({t.header.city}) [{t.items?.length || 0} equipos]
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Select OC Tracking Contract when originType === oc_tracking */}
              {originType === 'oc_tracking' && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-emerald-300 mb-1.5">
                    Seleccionar Orden de Compra de Cliente (Ventana 5 - Seguimiento OC)
                  </label>
                  <select
                    value={selectedContractId}
                    onChange={(e) => handleSelectContract(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-emerald-500/50 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-400"
                  >
                    <option value="">-- Seleccionar OC de Cliente / Contrato en Seguimiento --</option>
                    {contracts.map((c) => (
                      <option key={c.id} value={c.id}>
                        🛒 {c.salesOrderNumber ? `[OV: ${c.salesOrderNumber}] ` : ''}{c.clientName} — {c.contractNumber || c.sourceType || 'OC'} [{c.items?.length || 0} equipos]
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Manual mode info */}
              {originType === 'manual' && (
                <div className="md:col-span-2 flex items-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200">
                  <span>Modo Venta Directa: Digita los datos del cliente abajo y agrega los equipos mediante el botón «+ Agregar Equipo» en la tabla.</span>
                </div>
              )}

              {/* OV Number */}
              <div>
                <label className="block text-xs font-medium text-amber-300 mb-1.5 flex items-center justify-between">
                  <span>Número de Orden de Venta (OV) *</span>
                  <span className="text-[10px] text-amber-400/80 font-normal">Asignación manual de consecutivo de empresa</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    required
                    value={salesOrderNumber}
                    onChange={(e) => setSalesOrderNumber(e.target.value)}
                    placeholder="Ingrese el N° de OV asignado por su empresa (ej: OV-1052 o 1052)..."
                    className="flex-1 px-3 py-2 bg-slate-900 border-2 border-amber-500/50 rounded-lg text-sm font-bold text-amber-300 focus:outline-none focus:border-amber-400 placeholder:text-slate-500 placeholder:font-normal"
                  />
                  {!salesOrderNumber && (
                    <button
                      type="button"
                      onClick={() => setSalesOrderNumber(generateNextSalesOrderNumber(existingOrders))}
                      className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 whitespace-nowrap cursor-pointer"
                      title="Sugerir consecutivo automático"
                    >
                      Sugerir
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Client & Date Details */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#38bdf8]" />
              2. Datos del Cliente / Hospital y Fechas
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <div className="sm:col-span-2 relative" ref={clientInputWrapperRef}>
                <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center justify-between">
                  <span>Cliente o Institución Médica *</span>
                  <span className="text-[10px] text-sky-400 font-normal">Sugerencias automáticas activas</span>
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
                    placeholder="Escribe el nombre del cliente o NIT..."
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-400"
                    autoComplete="off"
                  />
                  {clientName && (
                    <button
                      type="button"
                      onClick={() => {
                        setClientName('');
                        setShowClientSuggestions(false);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-200"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Suggestions Dropdown */}
                {showClientSuggestions && clientSuggestions.length > 0 && (
                  <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden divide-y divide-slate-800 max-h-60 overflow-y-auto">
                    <div className="px-3 py-1.5 bg-slate-950/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                      <span>Clientes Encontrados ({clientSuggestions.length})</span>
                      <span>Click para auto-completar</span>
                    </div>
                    {clientSuggestions.map((sug, idx) => (
                      <button
                        key={sug.id || idx}
                        type="button"
                        onClick={() => handleSelectClientSuggestion(sug)}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-sky-950/40 transition-colors flex items-start justify-between gap-2 group cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white group-hover:text-sky-300 truncate">
                            {sug.name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 flex-wrap">
                            {sug.nit && (
                              <span className="font-mono text-slate-300">NIT: {sug.nit}</span>
                            )}
                            {sug.city && (
                              <span className="flex items-center gap-0.5 text-slate-400">
                                <MapPin className="w-3 h-3 text-sky-400" />
                                {sug.city}
                              </span>
                            )}
                            {sug.contactPerson && (
                              <span className="text-slate-400 truncate max-w-[200px]">
                                • {sug.contactPerson}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 shrink-0 font-medium self-center">
                          Seleccionar
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">NIT / Identificación</label>
                <input
                  type="text"
                  value={clientNit}
                  onChange={(e) => setClientNit(e.target.value)}
                  placeholder="ej: 890.399.010-6"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Ciudad</label>
                <input
                  type="text"
                  value={clientCity}
                  onChange={(e) => setClientCity(e.target.value)}
                  placeholder="ej: Cali, Valle"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Persona de Contacto</label>
                <input
                  type="text"
                  value={clientContactPerson}
                  onChange={(e) => setClientContactPerson(e.target.value)}
                  placeholder="ej: Dra. Martha Lucía Gómez"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Teléfono / Celular</label>
                <input
                  type="text"
                  value={clientContactPhone}
                  onChange={(e) => setClientContactPhone(e.target.value)}
                  placeholder="ej: 315 889 4421"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Fecha de la Orden (OV) *</label>
                <input
                  type="date"
                  required
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Estado de la Orden (OV)</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as SalesOrderStatus)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-400"
                >
                  <option value="Borrador">Borrador</option>
                  <option value="En Proceso">En Proceso</option>
                  <option value="Equipos en Bodega">Equipos en Bodega</option>
                  <option value="Entregada al Cliente">Entregada al Cliente</option>
                  <option value="Listo para Facturar">Listo para Facturar</option>
                  {status === 'Facturada' && (
                    <option value="Facturada">Facturada</option>
                  )}
                  <option value="Cancelada">Cancelada</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Fecha Estimada de Entrega</label>
                <input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-sky-400"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Equipment Selection & Quantities */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  3. Selección de Equipos Médicos y Cantidades para esta OV
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Marca solo los equipos que el cliente aprobó o solicitó en este pedido. Puedes ajustar la cantidad si es entrega parcial.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Marcar Todos
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  Desmarcar Todos
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingManualItem(!isAddingManualItem)}
                  className="text-xs px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar Otro Equipo
                </button>
              </div>
            </div>

            {/* Manual Equipment Adder Drawer */}
            {isAddingManualItem && (
              <div className="p-3.5 rounded-xl bg-slate-900 border border-emerald-500/30 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400">Agregar Equipo Adicional</span>
                  <button
                    type="button"
                    onClick={() => setIsAddingManualItem(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Pick from catalog */}
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">Cargar desde Catálogo SyD (Opcional)</label>
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
                    className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                  >
                    <option value="">-- Seleccionar equipo del catálogo --</option>
                    {equipments.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.name} ({eq.brand} - {eq.model})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">Nombre del Equipo *</label>
                    <input
                      type="text"
                      value={manualItemName}
                      onChange={(e) => setManualItemName(e.target.value)}
                      placeholder="Nombre del equipo"
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Marca</label>
                    <input
                      type="text"
                      value={manualItemBrand}
                      onChange={(e) => setManualItemBrand(e.target.value)}
                      placeholder="Marca"
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Modelo</label>
                    <input
                      type="text"
                      value={manualItemModel}
                      onChange={(e) => setManualItemModel(e.target.value)}
                      placeholder="Modelo"
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Cantidad</label>
                    <input
                      type="number"
                      min="1"
                      value={manualItemQty}
                      onChange={(e) => setManualItemQty(Number(e.target.value) || 1)}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-slate-400 mb-1">Precio de Venta Unitario (COP)</label>
                    <input
                      type="number"
                      min="0"
                      value={manualItemUnitPrice}
                      onChange={(e) => setManualItemUnitPrice(Number(e.target.value) || 0)}
                      className="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleAddManualItem}
                      className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Incluir en Lista
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Items Checklist Table */}
            {itemDrafts.length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed border-slate-700/70 rounded-xl bg-slate-900/30 px-4">
                <Layers className="w-8 h-8 mx-auto text-emerald-400/60 mb-2" />
                <p className="text-sm font-bold text-white">
                  {selectedQuoteId || selectedTenderClientId || selectedContractId
                    ? 'Todos los equipos de este proceso ya tienen una Orden de Venta (OV) asignada'
                    : 'No hay equipos agregados en esta orden'}
                </p>
                <p className="text-xs text-slate-400 mt-1 max-w-lg mx-auto">
                  {selectedQuoteId || selectedTenderClientId || selectedContractId
                    ? 'Los equipos previamente contratados ya se encuentran vinculados a otras OVs activas. Si requiere despachar un equipo nuevo o complementario, presione «+ Agregar Equipo Manual» arriba.'
                    : 'Selecciona una cotización o licitación arriba o presiona «+ Agregar Equipo Manual» para incluir equipos.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {itemDrafts.map((item, index) => (
                  <div
                    key={item.id || index}
                    className={`p-3.5 rounded-xl border transition-all ${
                      item.isSelected
                        ? 'bg-slate-900/90 border-slate-700 shadow-md'
                        : 'bg-slate-950/40 border-slate-800/60 opacity-60'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox */}
                      <button
                        type="button"
                        onClick={() => toggleItemSelection(index)}
                        className="mt-1 text-slate-400 hover:text-emerald-400 transition-colors"
                      >
                        {item.isSelected ? (
                          <CheckSquare className="w-5 h-5 text-emerald-400" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-500" />
                        )}
                      </button>

                      {/* Equipment Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-semibold text-sm text-white">{item.name}</span>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                              {item.brand && <span className="font-medium text-slate-300">{item.brand}</span>}
                              {item.model && <span>• Mod: {item.model}</span>}
                              {item.quotedQuantity !== undefined && (
                                <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                                  Cotizado: {item.quotedQuantity} uds
                                </span>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-800"
                            title="Eliminar de la lista"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Editable Qty, Price, Status, Supplier & Supplier OC when selected */}
                        {item.isSelected && (
                          <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-[11px] text-slate-400 mb-1">
                                  Cantidad a Despachar
                                </label>
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantityToDispatch}
                                  onChange={(e) => handleItemQuantityChange(index, Number(e.target.value) || 1)}
                                  className="w-full px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white font-bold text-center"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] text-slate-400 mb-1">
                                  Precio Unitario Venta (COP)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={item.unitSalePriceCOP}
                                  onChange={(e) => handleItemUnitPriceChange(index, Number(e.target.value) || 0)}
                                  className="w-full px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Estado del Equipo</label>
                                <select
                                  value={item.equipmentStatus || 'Pendiente de OC'}
                                  onChange={(e) =>
                                    handleItemStatusChange(index, e.target.value as SalesOrderEquipmentStatus)
                                  }
                                  className="w-full px-2.5 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white"
                                >
                                  <option value="Pendiente de OC">Pendiente de OC</option>
                                  <option value="OC Solicitada a Proveedor">OC Solicitada a Proveedor</option>
                                  <option value="En Bodega SYD">En Bodega SYD</option>
                                  <option value="Entregado al Cliente">Entregado al Cliente</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] text-slate-400 mb-1">Subtotal Item</label>
                                <div className="px-2.5 py-1 bg-slate-950/60 rounded text-xs font-bold text-emerald-400 flex items-center justify-end h-[28px]">
                                  {formatCOP(item.totalSalePriceCOP || 0)}
                                </div>
                              </div>
                            </div>

                            {/* Supplier / Brand */}
                            <div className="pt-2 border-t border-slate-800/40 bg-slate-950/30 p-2.5 rounded-lg border border-slate-800">
                              <div>
                                <label className="block text-[10.5px] font-medium text-slate-300 mb-1 flex items-center gap-1">
                                  <Building2 className="w-3 h-3 text-sky-400" />
                                  Proveedor / Marca Asignada
                                </label>
                                <input
                                  type="text"
                                  value={item.brand || ''}
                                  onChange={(e) => handleItemBrandSupplierChange(index, e.target.value)}
                                  placeholder="ej: TECNICA, Mindray, etc..."
                                  className="w-full px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 placeholder:text-slate-600"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Total Summary Footer */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-300">
                Equipos seleccionados para la OV: <strong className="text-white">{selectedItems.length}</strong> de{' '}
                {itemDrafts.length}
              </span>
              <div className="text-right">
                <span className="text-[11px] text-slate-400 block">Total Valor Orden de Venta:</span>
                <span className="text-base font-black text-amber-400">{formatCOP(totalSelectedValueCOP)}</span>
              </div>
            </div>
          </div>

          {/* Section 4: Notes */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Notas u Observaciones del Pedido</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observaciones de entrega, condiciones especiales o detalles técnicos..."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
            >
              <PackageCheck className="w-4 h-4" />
              {orderToEdit ? 'Guardar Cambios' : 'Crear Orden de Venta (OV)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
