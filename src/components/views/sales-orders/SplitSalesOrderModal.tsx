import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  GitFork,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Package,
  Layers,
  ShoppingCart,
  Clock,
  Sparkles,
  Minus,
  Plus,
  Building2,
  Check,
  ChevronDown,
  RefreshCw,
  Trash2,
  Truck,
  ShieldAlert,
  Info,
  Search,
  UserPlus,
  Edit2,
  ExternalLink,
} from 'lucide-react';
import {
  SalesOrderRecord,
  SalesOrderItem,
  OCTrackingContract,
  SalesInvoiceRecord,
  SupplierProfile,
} from '../../../types';
import { formatCOP } from '../../../utils/formatters';
import {
  COMMON_SUPPLIERS,
  getStoredSupplierProfiles,
  saveStoredSupplierProfiles,
  autoRegisterSupplierIfNotExists,
} from '../../../utils/ocTrackingStorage';
import { computeOrderInvoicingData } from '../SalesOrdersView';

export interface ItemQuantitySplit {
  itemId: string;
  quantityToMove: number;
}

export interface SplitSalesOrderParams {
  sourceOrderId: string;
  itemSplits: ItemQuantitySplit[];
  itemIdsToMove?: string[];
  newSalesOrderNumber: string;
  ocMappings: Record<string, string>; // currentOC -> newOCNumber
  supplierMappings?: Record<string, string>; // currentOC -> newSupplier
  itemSupplierOverrides?: Record<string, string>; // itemId -> specific supplier
  itemOcOverrides?: Record<string, string>; // itemId -> specific OC
  newSupplierOCNumber?: string;
  orderDate: string;
  reason: string;
}

interface SplitSalesOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceOrder?: SalesOrderRecord | null;
  allOrders: SalesOrderRecord[];
  contracts?: OCTrackingContract[];
  salesInvoices?: SalesInvoiceRecord[];
  preselectedItemIds?: string[];
  onConfirmSplit: (params: SplitSalesOrderParams) => void;
}

interface OCGroupData {
  groupKey: string;
  ocNumber: string;
  originalSupplier: string;
  items: SalesOrderItem[];
  totalUnits: number;
  pendingUnits: number;
  deliveredUnits: number;
}

const EMPTY_PRESELECTED_IDS: string[] = [];
const EMPTY_CONTRACTS_LIST: OCTrackingContract[] = [];
const EMPTY_INVOICES_LIST: SalesInvoiceRecord[] = [];

export const SplitSalesOrderModal: React.FC<SplitSalesOrderModalProps> = ({
  isOpen,
  onClose,
  sourceOrder: initialSourceOrder,
  allOrders,
  contracts = EMPTY_CONTRACTS_LIST,
  salesInvoices = EMPTY_INVOICES_LIST,
  preselectedItemIds = EMPTY_PRESELECTED_IDS,
  onConfirmSplit,
}) => {
  // 1. Filter out orders that are:
  // - Cancelled
  // - Have 0 items
  // - Fully Invoiced (100% facturadas no deben aparecer para dividir ni renovar)
  const availableOrders = useMemo(() => {
    return (allOrders || []).filter((o) => {
      if (!o || o.status === 'Cancelada' || (o.items?.length || 0) === 0) return false;
      if (o.status === 'Facturada' || o.invoicedStatus === 'Facturada Total') return false;
      const invData = computeOrderInvoicingData(o, salesInvoices);
      if (invData.isFullyInvoiced) return false;
      return true;
    });
  }, [allOrders, salesInvoices]);

  // 2. Distinct clients with available active orders
  const clientList = useMemo(() => {
    const map = new Map<string, { clientName: string; clientCity?: string; ordersCount: number }>();
    availableOrders.forEach((o) => {
      const key = (o.clientName || 'Cliente no especificado').trim();
      if (!map.has(key)) {
        map.set(key, { clientName: key, clientCity: o.clientCity, ordersCount: 0 });
      }
      map.get(key)!.ordersCount++;
    });
    return Array.from(map.values()).sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [availableOrders]);

  // Client Selection State
  const [selectedClientName, setSelectedClientName] = useState<string>(() => {
    return initialSourceOrder?.clientName || clientList[0]?.clientName || '';
  });

  useEffect(() => {
    if (initialSourceOrder?.clientName) {
      setSelectedClientName(initialSourceOrder.clientName);
    } else if (!selectedClientName && clientList.length > 0) {
      setSelectedClientName(clientList[0].clientName);
    }
  }, [initialSourceOrder?.id, clientList.length]);

  // Orders available for the selected client
  const clientOrders = useMemo(() => {
    if (!selectedClientName) return availableOrders;
    return availableOrders.filter(
      (o) => (o.clientName || '').trim().toLowerCase() === selectedClientName.trim().toLowerCase()
    );
  }, [availableOrders, selectedClientName]);

  // Selected source order ID
  const [selectedOrderId, setSelectedOrderId] = useState<string>(() => {
    return initialSourceOrder?.id || (clientOrders[0]?.id ?? availableOrders[0]?.id ?? '');
  });

  useEffect(() => {
    if (initialSourceOrder?.id) {
      setSelectedOrderId(initialSourceOrder.id);
    } else if (clientOrders.length > 0) {
      const exists = clientOrders.some((o) => o.id === selectedOrderId);
      if (!exists) {
        setSelectedOrderId(clientOrders[0].id);
      }
    }
  }, [initialSourceOrder?.id, selectedClientName, clientOrders]);

  const currentOrder = useMemo(() => {
    return (
      clientOrders.find((o) => o.id === selectedOrderId) ||
      clientOrders[0] ||
      availableOrders.find((o) => o.id === selectedOrderId) ||
      initialSourceOrder ||
      null
    );
  }, [clientOrders, selectedOrderId, availableOrders, initialSourceOrder]);

  // Helper to check if an OV is recent (created or renewed within 3 to 5 days)
  const getOrderRecentInfo = (order: SalesOrderRecord | null) => {
    if (!order) return { isRecent: false, daysAgo: 0 };
    const dateStr = order.renewedAt || order.orderDate || order.createdAt;
    if (!dateStr) return { isRecent: false, daysAgo: 0 };
    const orderDate = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - orderDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const isRecent = !isNaN(diffDays) && diffDays >= 0 && diffDays <= 5;
    return { isRecent, daysAgo: Math.max(0, diffDays) };
  };

  // Helper to check if an individual equipment item has had a recent new OV (<= 5 days)
  const getItemRecentOVInfo = (item: SalesOrderItem) => {
    const now = new Date().getTime();

    // 1. Check if item has metadata indicating it was transferred recently
    if (item.transferredAt) {
      const tDate = new Date(item.transferredAt);
      const diffDays = Math.floor((now - tDate.getTime()) / (1000 * 60 * 60 * 24));
      if (!isNaN(diffDays) && diffDays >= 0 && diffDays <= 5) {
        return {
          hasRecentOV: true,
          daysAgo: Math.max(0, diffDays),
          recentOVNumber: item.transferredFromOV || 'Nueva OV',
          isTransferred: true,
        };
      }
    }

    // 2. Cross-order check in allOrders for other orders created within 5 days containing this equipment
    if (allOrders && allOrders.length > 0) {
      for (const ord of allOrders) {
        if (ord.id === currentOrder?.id) continue;
        if (ord.status === 'Cancelada') continue;

        const dateStr = ord.renewedAt || ord.orderDate || ord.createdAt;
        if (!dateStr) continue;
        const ordDate = new Date(dateStr);
        const diffDays = Math.floor((now - ordDate.getTime()) / (1000 * 60 * 60 * 24));
        if (isNaN(diffDays) || diffDays < 0 || diffDays > 5) continue;

        const matches = (ord.items || []).some((it) => {
          if (it.id === item.id) return true;
          if (it.code && item.code && it.code.trim().toLowerCase() === item.code.trim().toLowerCase()) return true;
          if (it.equipmentId && item.equipmentId && it.equipmentId === item.equipmentId) return true;
          if (it.name && item.name && it.name.trim().toLowerCase() === item.name.trim().toLowerCase()) return true;
          return false;
        });

        if (matches) {
          return {
            hasRecentOV: true,
            daysAgo: Math.max(0, diffDays),
            recentOVNumber: ord.salesOrderNumber || ord.id,
            isTransferred: false,
          };
        }
      }
    }

    return { hasRecentOV: false, daysAgo: 0, recentOVNumber: '', isTransferred: false };
  };

  // Helper to find matching contract item and check delivered status
  const getItemDeliveryInfo = (item: SalesOrderItem) => {
    const totalQty = item.quantityToDispatch || item.quotedQuantity || 1;
    const st = String(item.equipmentStatus || '').toLowerCase();
    const isDirectDelivered =
      st.includes('entregad') || st.includes('instalad') || st.includes('concluid') || st.includes('cerrad');

    if (isDirectDelivered) {
      return {
        isDelivered: true,
        deliveredQty: totalQty,
        pendingQty: 0,
        connectedOC: item.supplierOCRef || item.linkedSupplierOCNumber || '',
        supplier: (item as any).supplier || (item as any).supplierName || '',
      };
    }

    let matchedContractItem: any = null;
    for (const c of contracts) {
      for (const it of c.items || []) {
        const match =
          (it.salesOrderItemId && it.salesOrderItemId === item.id) ||
          (it.code && item.code && it.code.trim().toLowerCase() === item.code.trim().toLowerCase()) ||
          (it.name && item.name && it.name.trim().toLowerCase() === item.name.trim().toLowerCase());
        if (match) {
          matchedContractItem = it;
          break;
        }
      }
      if (matchedContractItem) break;
    }

    const ocNumber = matchedContractItem?.ocNumber || item.supplierOCRef || item.linkedSupplierOCNumber || '';
    const supplier = matchedContractItem?.supplier || (item as any).supplier || (item as any).supplierName || '';

    if (matchedContractItem) {
      const ocSt = String(matchedContractItem.status || '').toLowerCase();
      const isOCDelivered =
        ocSt.includes('entregad') || ocSt.includes('instalad') || ocSt.includes('concluid') || ocSt.includes('cerrad');
      if (isOCDelivered) {
        return { isDelivered: true, deliveredQty: totalQty, pendingQty: 0, connectedOC: ocNumber, supplier };
      }
    }

    return {
      isDelivered: false,
      deliveredQty: 0,
      pendingQty: totalQty,
      connectedOC: ocNumber,
      supplier,
    };
  };

  // Group items by their Connected OC
  const ocGroups = useMemo((): OCGroupData[] => {
    if (!currentOrder || !currentOrder.items) return [];
    const map = new Map<string, OCGroupData>();

    currentOrder.items.forEach((item) => {
      const { connectedOC, supplier, deliveredQty, pendingQty } = getItemDeliveryInfo(item);
      const ocNum = connectedOC?.trim() || 'Sin OC Asignada';
      const supp = supplier?.trim() || (item as any).supplier || (item as any).supplierName || 'Proveedor por Asignar';
      const groupKey = `${ocNum}___${supp}`;

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          groupKey,
          ocNumber: ocNum,
          originalSupplier: supp,
          items: [],
          totalUnits: 0,
          pendingUnits: 0,
          deliveredUnits: 0,
        });
      }

      const g = map.get(groupKey)!;
      g.items.push(item);
      const qty = item.quantityToDispatch || item.quotedQuantity || 1;
      g.totalUnits += qty;
      g.pendingUnits += pendingQty;
      g.deliveredUnits += deliveredQty;
    });

    return Array.from(map.values());
  }, [currentOrder, contracts]);

  // Master Suppliers list from storage
  const [supplierProfiles, setSupplierProfiles] = useState<SupplierProfile[]>(() => {
    return getStoredSupplierProfiles();
  });

  const reloadSupplierProfiles = () => {
    try {
      const profiles = getStoredSupplierProfiles();
      setSupplierProfiles(profiles);
    } catch {}
  };

  // State: quantity to move per item (itemId -> quantityToMove)
  // User explicitly requested: By default, items start UNSELECTED (0) so user explicitly picks what to move!
  const [quantitiesToMove, setQuantitiesToMove] = useState<Record<string, number>>({});

  const preselectedKey = useMemo(() => {
    return (preselectedItemIds || []).slice().sort().join(',');
  }, [preselectedItemIds]);

  // Initialize quantitiesToMove whenever currentOrder changes:
  // Starts with 0 so the user can choose which equipments to add, unless explicitly preselected
  useEffect(() => {
    if (!currentOrder) return;
    const initialMap: Record<string, number> = {};

    (currentOrder.items || []).forEach((item) => {
      const { pendingQty } = getItemDeliveryInfo(item);
      const total = item.quantityToDispatch || item.quotedQuantity || 1;

      if (preselectedItemIds && preselectedItemIds.length > 0) {
        if (preselectedItemIds.includes(item.id)) {
          initialMap[item.id] = pendingQty > 0 ? pendingQty : total;
        } else {
          initialMap[item.id] = 0;
        }
      } else {
        // Start unselected (0) as requested by the user
        initialMap[item.id] = 0;
      }
    });

    setQuantitiesToMove(initialMap);
  }, [currentOrder?.id, preselectedKey]);

  // Form states: Step 2 New OV
  // User explicitly requested: MUST START EMPTY
  const [newOVNumber, setNewOVNumber] = useState<string>('');
  const [orderDate, setOrderDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [reasonCategory, setReasonCategory] = useState<string>('cierre_tiempo');
  const [customReasonNotes, setCustomReasonNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // When switching OV, reset newOVNumber to empty
  useEffect(() => {
    setNewOVNumber('');
    setErrorMsg('');
  }, [currentOrder?.id]);

  // Mappings per OC: New OC Number and New Supplier
  // User explicitly requested: NEW OC NUMBERS MUST START EMPTY
  const [ocMappings, setOcMappings] = useState<Record<string, string>>({});
  const [supplierMappings, setSupplierMappings] = useState<Record<string, string>>({});

  // Individual item overrides: itemSupplierOverrides & itemOcOverrides
  const [itemSupplierOverrides, setItemSupplierOverrides] = useState<Record<string, string>>({});
  const [itemOcOverrides, setItemOcOverrides] = useState<Record<string, string>>({});

  // Reset mappings when currentOrder changes so they start empty
  useEffect(() => {
    if (!currentOrder) return;
    const initialOcMap: Record<string, string> = {};
    const initialSuppMap: Record<string, string> = {};

    ocGroups.forEach((g) => {
      initialOcMap[g.ocNumber] = ''; // ALWAYS EMPTY as requested
      initialSuppMap[g.ocNumber] = g.originalSupplier || '';
    });

    setOcMappings(initialOcMap);
    setSupplierMappings(initialSuppMap);
    setItemSupplierOverrides({});
    setItemOcOverrides({});
  }, [currentOrder?.id]);

  // -------------------------------------------------------------
  // SUPPLIER DIRECTORY / PICKER SUB-MODAL STATE
  // -------------------------------------------------------------
  const [supplierDirectoryTarget, setSupplierDirectoryTarget] = useState<{
    type: 'oc' | 'item';
    targetKey: string; // ocNumber if 'oc', itemId if 'item'
    currentSupplierName: string;
  } | null>(null);

  const [dirSearchQuery, setDirSearchQuery] = useState('');
  const [showCreateSupplierForm, setShowCreateSupplierForm] = useState(false);
  const [newSupplierForm, setNewSupplierForm] = useState({
    name: '',
    nit: '',
    contactPerson: '',
    phone: '',
    email: '',
    city: 'Colombia',
    brands: '',
  });

  const filteredDirectorySuppliers = useMemo(() => {
    const q = dirSearchQuery.trim().toLowerCase();
    const set = new Set<string>();
    const list: { name: string; nit?: string; contact?: string; phone?: string; brands?: string[] }[] = [];

    // Add stored profiles
    supplierProfiles.forEach((p) => {
      if (p.name && !set.has(p.name.toLowerCase())) {
        set.add(p.name.toLowerCase());
        list.push({
          name: p.name,
          nit: p.nit,
          contact: p.contactPerson || p.contactName,
          phone: p.phone,
          brands: p.brands || p.brandsRepresented,
        });
      }
    });

    // Add common suppliers
    COMMON_SUPPLIERS.forEach((s) => {
      if (!set.has(s.toLowerCase())) {
        set.add(s.toLowerCase());
        list.push({ name: s });
      }
    });

    if (!q) return list;
    return list.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.nit && s.nit.toLowerCase().includes(q)) ||
        (s.contact && s.contact.toLowerCase().includes(q)) ||
        (s.brands && s.brands.some((b) => b.toLowerCase().includes(q)))
    );
  }, [supplierProfiles, dirSearchQuery]);

  const handleSelectSupplierFromDirectory = (supplierName: string) => {
    if (!supplierDirectoryTarget) return;
    const cleanName = supplierName.trim();

    if (supplierDirectoryTarget.type === 'oc') {
      const ocNum = supplierDirectoryTarget.targetKey;
      setSupplierMappings((prev) => ({ ...prev, [ocNum]: cleanName }));
    } else if (supplierDirectoryTarget.type === 'item') {
      const itemId = supplierDirectoryTarget.targetKey;
      setItemSupplierOverrides((prev) => ({ ...prev, [itemId]: cleanName }));
    }

    setSupplierDirectoryTarget(null);
    setShowCreateSupplierForm(false);
    setDirSearchQuery('');
  };

  const handleCreateAndSelectSupplier = () => {
    const name = newSupplierForm.name.trim();
    if (!name) {
      alert('Por favor ingrese el nombre del proveedor.');
      return;
    }

    const brandsArray = newSupplierForm.brands
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);

    autoRegisterSupplierIfNotExists(name, brandsArray[0], {
      nit: newSupplierForm.nit.trim(),
      contactPerson: newSupplierForm.contactPerson.trim(),
      phone: newSupplierForm.phone.trim(),
      email: newSupplierForm.email.trim(),
      city: newSupplierForm.city.trim() || 'Colombia',
      brands: brandsArray,
    });

    reloadSupplierProfiles();
    handleSelectSupplierFromDirectory(name);
    setNewSupplierForm({
      name: '',
      nit: '',
      contactPerson: '',
      phone: '',
      email: '',
      city: 'Colombia',
      brands: '',
    });
  };

  // Quantity Stepper Handlers
  const handleSetQuantity = (itemId: string, qty: number, maxQty: number) => {
    const clamped = Math.max(0, Math.min(qty, maxQty));
    setQuantitiesToMove((prev) => ({ ...prev, [itemId]: clamped }));
  };

  const handleToggleItemSelection = (item: SalesOrderItem) => {
    const { pendingQty } = getItemDeliveryInfo(item);
    const total = item.quantityToDispatch || item.quotedQuantity || 1;
    const currentMove = quantitiesToMove[item.id] ?? 0;

    if (currentMove > 0) {
      handleSetQuantity(item.id, 0, total);
    } else {
      const targetQty = pendingQty > 0 ? pendingQty : total;
      handleSetQuantity(item.id, targetQty, total);
    }
  };

  const handleSelectOnlyPendingForGroup = (group: OCGroupData) => {
    setQuantitiesToMove((prev) => {
      const next = { ...prev };
      group.items.forEach((it) => {
        const { pendingQty } = getItemDeliveryInfo(it);
        next[it.id] = pendingQty;
      });
      return next;
    });
  };

  const handleSelectAllForGroup = (group: OCGroupData) => {
    setQuantitiesToMove((prev) => {
      const next = { ...prev };
      group.items.forEach((it) => {
        const total = it.quantityToDispatch || it.quotedQuantity || 1;
        next[it.id] = total;
      });
      return next;
    });
  };

  const handleSelectNoneForGroup = (group: OCGroupData) => {
    setQuantitiesToMove((prev) => {
      const next = { ...prev };
      group.items.forEach((it) => {
        next[it.id] = 0;
      });
      return next;
    });
  };

  const handleSelectAllPendingGlobal = () => {
    if (!currentOrder?.items) return;
    setQuantitiesToMove((prev) => {
      const next = { ...prev };
      currentOrder.items.forEach((it) => {
        const { pendingQty } = getItemDeliveryInfo(it);
        next[it.id] = pendingQty;
      });
      return next;
    });
  };

  const handleSelectAll100Global = () => {
    if (!currentOrder?.items) return;
    setQuantitiesToMove((prev) => {
      const next = { ...prev };
      currentOrder.items.forEach((it) => {
        const total = it.quantityToDispatch || it.quotedQuantity || 1;
        next[it.id] = total;
      });
      return next;
    });
  };

  const handleSelectNoneGlobal = () => {
    if (!currentOrder?.items) return;
    setQuantitiesToMove((prev) => {
      const next = { ...prev };
      currentOrder.items.forEach((it) => {
        next[it.id] = 0;
      });
      return next;
    });
  };

  // Live Calculations
  const calculationSummary = useMemo(() => {
    if (!currentOrder?.items) {
      return {
        totalUnitsOriginal: 0,
        movingUnits: 0,
        remainingUnits: 0,
        movingValueCOP: 0,
        remainingValueCOP: 0,
        isCompleteTransfer: false,
        movingItemsCount: 0,
        remainingItemsCount: 0,
      };
    }

    let totalUnitsOriginal = 0;
    let movingUnits = 0;
    let remainingUnits = 0;
    let movingValueCOP = 0;
    let remainingValueCOP = 0;
    let movingItemsCount = 0;
    let remainingItemsCount = 0;

    currentOrder.items.forEach((it) => {
      const total = it.quantityToDispatch || it.quotedQuantity || 1;
      const move = quantitiesToMove[it.id] ?? 0;
      const keep = total - move;
      const unitPrice = it.unitSalePriceCOP || 0;

      totalUnitsOriginal += total;
      movingUnits += move;
      remainingUnits += keep;
      movingValueCOP += move * unitPrice;
      remainingValueCOP += keep * unitPrice;

      if (move > 0) movingItemsCount++;
      if (keep > 0) remainingItemsCount++;
    });

    const isCompleteTransfer = movingUnits > 0 && remainingUnits === 0;

    return {
      totalUnitsOriginal,
      movingUnits,
      remainingUnits,
      movingValueCOP,
      remainingValueCOP,
      isCompleteTransfer,
      movingItemsCount,
      remainingItemsCount,
    };
  }, [currentOrder, quantitiesToMove]);

  // Validation & Submit
  const handleConfirm = () => {
    setErrorMsg('');

    if (!currentOrder) {
      setErrorMsg('No hay una Orden de Venta seleccionada.');
      return;
    }

    const cleanOV = newOVNumber.trim();
    if (!cleanOV) {
      setErrorMsg('Debe ingresar el número de la NUEVA Orden de Venta.');
      return;
    }

    if (cleanOV.toLowerCase() === (currentOrder.salesOrderNumber || '').trim().toLowerCase()) {
      setErrorMsg('El número de la nueva OV debe ser diferente al de la OV actual.');
      return;
    }

    if (calculationSummary.movingUnits === 0) {
      setErrorMsg('Debe seleccionar al menos una (1) unidad para trasladar a la nueva OV.');
      return;
    }

    // Check that any OC with moving items has a new OC number specified
    const missingOCs: string[] = [];
    ocGroups.forEach((g) => {
      const hasMovingItemsInGroup = g.items.some((it) => (quantitiesToMove[it.id] ?? 0) > 0);
      if (hasMovingItemsInGroup) {
        const assignedNewOC = (ocMappings[g.ocNumber] || '').trim();
        if (!assignedNewOC) {
          missingOCs.push(g.ocNumber);
        }
      }
    });

    if (missingOCs.length > 0) {
      setErrorMsg(
        `Debe indicar el número de la NUEVA OC para: ${missingOCs.join(', ')}. (Es requerido para el seguimiento en compras).`
      );
      return;
    }

    const itemSplits: ItemQuantitySplit[] = Object.entries(quantitiesToMove)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, quantityToMove]) => ({ itemId, quantityToMove }));

    const reasonLabel =
      reasonCategory === 'cierre_tiempo'
        ? 'Vencimiento de vigencia en sistema (Cierre de tiempo)'
        : reasonCategory === 'demora_proveedor'
        ? 'Demora del fabricante / proveedor en entrega de equipos'
        : reasonCategory === 'cambio_proveedor'
        ? 'Cambio de proveedor o condiciones contractuales'
        : customReasonNotes.trim() || 'Renovación de Orden de Venta';

    const fullReason = customReasonNotes.trim()
      ? `${reasonLabel} — ${customReasonNotes.trim()}`
      : reasonLabel;

    onConfirmSplit({
      sourceOrderId: currentOrder.id,
      itemSplits,
      newSalesOrderNumber: cleanOV,
      ocMappings,
      supplierMappings,
      itemSupplierOverrides,
      itemOcOverrides,
      orderDate,
      reason: fullReason,
    });
  };

  if (!isOpen) return null;

  const currentOrderRecentMeta = getOrderRecentInfo(currentOrder);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      {/* WIDER MODAL (max-w-[1160px] / max-w-6xl for extra horizontal room requested) */}
      <div className="relative w-full max-w-[1160px] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden text-slate-100">
        
        {/* COMPACT MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <GitFork className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Dividir y Renovar Orden de Venta & OCs Conectadas
                <span className="text-[10px] font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-slate-700">
                  Ventana 6
                </span>
                {currentOrderRecentMeta.isRecent && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    <Clock className="w-3 h-3 text-amber-400" />
                    OV Reciente ({currentOrderRecentMeta.daysAgo === 0 ? 'Hoy' : `Hace ${currentOrderRecentMeta.daysAgo}d`})
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-400">
                Selecciona qué equipos y OCs deseas agregar a la nueva OV. Los equipos trasladados no volverán a aparecer en la OV original.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* MODAL BODY (SCROLLABLE & SPACIOUS) */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3.5 text-xs">
          
          {/* PASO 1: SELECCIÓN COMPACTA DE CLIENTE Y OV */}
          <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-[260px]">
              <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 mb-1">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                <span>1. Cliente / Institución:</span>
              </label>
              <select
                value={selectedClientName}
                onChange={(e) => setSelectedClientName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {clientList.map((c) => (
                  <option key={c.clientName} value={c.clientName}>
                    {c.clientName} ({c.ordersCount} OVs activas)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[300px]">
              <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5 mb-1">
                <Package className="w-3.5 h-3.5 text-amber-400" />
                <span>Orden de Venta a Renovar / Dividir:</span>
              </label>
              <select
                value={selectedOrderId}
                onChange={(e) => setSelectedOrderId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {clientOrders.map((ord) => {
                  const recent = getOrderRecentInfo(ord);
                  return (
                    <option key={ord.id} value={ord.id}>
                      {recent.isRecent ? `⚡ [Reciente: ${recent.daysAgo === 0 ? 'Hoy' : `${recent.daysAgo}d`}] ` : ''}
                      OV: {ord.salesOrderNumber || ord.id} • {ord.items?.length || 0} equipos • {formatCOP(ord.totalValueCOP)}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Subtle Inline Stats of selected OV */}
            {currentOrder && (
              <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                <span>
                  <strong className="text-white">{currentOrder.items?.length || 0}</strong> tipos ({calculationSummary.totalUnitsOriginal} uds)
                </span>
                <span className="text-slate-600">|</span>
                <span className="font-mono font-bold text-emerald-400">
                  {formatCOP(currentOrder.totalValueCOP)}
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-sky-300">
                  {ocGroups.length} OCs vinculadas
                </span>
              </div>
            )}
          </div>

          {/* PASO 2: DEFINIR NUEVA ORDEN DE VENTA (VACÍA POR DEFECTO) */}
          <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/20">
            <div className="flex items-center gap-2 mb-2 text-amber-300 font-bold text-xs">
              <Sparkles className="w-3.5 h-3.5" />
              <span>2. Definir la NUEVA Orden de Venta (Inicia vacía para ingresar el número oficial)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[10.5px] font-bold text-slate-300 block mb-1">
                  Número de la NUEVA OV <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newOVNumber}
                  onChange={(e) => setNewOVNumber(e.target.value)}
                  placeholder="Ej: 1146400 (ingresar N° oficial)"
                  className="w-full bg-slate-950 border border-amber-500/50 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-amber-300 placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-300 block mb-1">
                  Fecha de la Nueva OV
                </label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-bold text-slate-300 block mb-1">
                  Motivo de Renovación
                </label>
                <select
                  value={reasonCategory}
                  onChange={(e) => setReasonCategory(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-500 cursor-pointer"
                >
                  <option value="cierre_tiempo">Vencimiento de vigencia en sistema</option>
                  <option value="demora_proveedor">Demora de fabricante en entrega</option>
                  <option value="cambio_proveedor">Cambio de proveedor / condiciones</option>
                  <option value="otro">Otro motivo personalizado</option>
                </select>
              </div>
            </div>
          </div>

          {/* PASO 3: OCS CONECTADAS, CAMBIO DE PROVEEDOR Y EQUIPOS CON SELECCIÓN INDIVIDUAL */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 text-slate-300 font-bold text-xs">
                <ShoppingCart className="w-3.5 h-3.5 text-sky-400" />
                <span>3. Seleccionar qué Equipos y OCs agregar a la Nueva OV:</span>
                <span className="text-[11px] font-normal text-amber-300/90">
                  (Marca la casilla de los equipos que deseas trasladar)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAllPendingGlobal}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10.5px] font-semibold cursor-pointer transition flex items-center gap-1"
                >
                  <span>⚡ Trasladar Solo Faltantes ({calculationSummary.totalUnitsOriginal} uds)</span>
                </button>
                <button
                  type="button"
                  onClick={handleSelectAll100Global}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[10.5px] font-medium cursor-pointer transition"
                >
                  Todo (100%)
                </button>
                <button
                  type="button"
                  onClick={handleSelectNoneGlobal}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 text-[10.5px] font-medium cursor-pointer transition"
                >
                  Desmarcar Todos
                </button>
              </div>
            </div>

            {/* List of OC Groups */}
            <div className="space-y-3">
              {ocGroups.map((group) => {
                const newOCVal = ocMappings[group.ocNumber] || '';
                const currentOCSupplier = supplierMappings[group.ocNumber] || group.originalSupplier;
                const groupMovingUnits = group.items.reduce(
                  (sum, it) => sum + (quantitiesToMove[it.id] ?? 0),
                  0
                );
                const isAllGroupSelected = group.items.length > 0 && group.items.every((it) => (quantitiesToMove[it.id] ?? 0) > 0);
                const isSomeGroupSelected = group.items.some((it) => (quantitiesToMove[it.id] ?? 0) > 0);

                return (
                  <div
                    key={group.groupKey}
                    className={`p-3.5 rounded-xl border transition ${
                      groupMovingUnits > 0
                        ? 'bg-slate-950/70 border-sky-500/40'
                        : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* OC Group Header Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-800/80 mb-2.5">
                      <div className="flex items-center gap-2.5">
                        {/* OC Select / Toggle Checkbox */}
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isAllGroupSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = isSomeGroupSelected && !isAllGroupSelected;
                            }}
                            onChange={(e) => {
                              if (e.target.checked) {
                                handleSelectAllForGroup(group);
                              } else {
                                handleSelectNoneForGroup(group);
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-sky-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-sky-500"
                          />
                          <span className="text-[11px] font-bold text-sky-300 bg-sky-500/10 border border-sky-500/30 px-2.5 py-0.5 rounded font-mono">
                            OC Origen: {group.ocNumber}
                          </span>
                        </label>
                        <span className="text-[11px] text-slate-300 flex items-center gap-1">
                          Prov: <strong className="text-white">{group.originalSupplier}</strong>
                        </span>
                        <span className="text-[10px] text-slate-500">
                          ({group.items.length} equipos • {group.totalUnits} uds)
                        </span>
                        {groupMovingUnits > 0 && (
                          <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                            {groupMovingUnits} uds seleccionadas
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSelectOnlyPendingForGroup(group)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10.5px] font-medium cursor-pointer"
                        >
                          Faltantes ({group.pendingUnits})
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectAllForGroup(group)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] font-medium cursor-pointer"
                        >
                          Todo ({group.totalUnits})
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSelectNoneForGroup(group)}
                          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10.5px] font-medium cursor-pointer"
                        >
                          0
                        </button>
                      </div>
                    </div>

                    {/* NEW OC & SUPPLIER FOR THIS OC GROUP */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2.5 p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/70">
                      <div>
                        <label className="text-[10.5px] font-bold text-slate-300 flex items-center justify-between mb-1">
                          <span>N° NUEVA OC Proveedor <span className="text-red-400">*</span></span>
                          {groupMovingUnits > 0 && !newOCVal && (
                            <span className="text-[10px] text-amber-400 font-semibold animate-pulse">
                              Requerido al trasladar equipos de esta OC
                            </span>
                          )}
                        </label>
                        <input
                          type="text"
                          value={newOCVal}
                          onChange={(e) =>
                            setOcMappings((prev) => ({ ...prev, [group.ocNumber]: e.target.value }))
                          }
                          placeholder="Ej: 124500 (vacío por defecto)"
                          className={`w-full bg-slate-950 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-sky-300 placeholder:text-slate-600 focus:outline-none ${
                            groupMovingUnits > 0 && !newOCVal
                              ? 'border-2 border-amber-500/80 focus:border-amber-400'
                              : 'border border-slate-700 focus:border-sky-500'
                          }`}
                        />
                      </div>

                      <div>
                        <label className="text-[10.5px] font-bold text-slate-300 flex items-center justify-between mb-1">
                          <span>Proveedor para la NUEVA OC</span>
                          <span className="text-[9.5px] text-slate-400 font-normal">
                            {currentOCSupplier !== group.originalSupplier ? 'Proveedor cambiado' : 'Mantiene actual'}
                          </span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={currentOCSupplier}
                            onChange={(e) =>
                              setSupplierMappings((prev) => ({ ...prev, [group.ocNumber]: e.target.value }))
                            }
                            placeholder="Nombre del proveedor..."
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-slate-500"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setSupplierDirectoryTarget({
                                type: 'oc',
                                targetKey: group.ocNumber,
                                currentSupplierName: currentOCSupplier,
                              })
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-[10.5px] font-bold flex items-center gap-1 cursor-pointer transition whitespace-nowrap"
                            title="Abrir Directorio de Proveedores para seleccionar o crear un nuevo proveedor"
                          >
                            <Building2 className="w-3.5 h-3.5 text-purple-400" />
                            <span>Directorio / + Crear</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* EQUIPMENT ROWS (COMPACT TABLE FORMAT WITH INDIVIDUAL SELECTION & RECENT OV BADGES) */}
                    <div className="space-y-1.5">
                      <div className="text-[10px] font-bold text-slate-400 px-1 uppercase tracking-wider flex items-center justify-between">
                        <span>Equipos en esta OC ({group.items.length}):</span>
                        <span className="text-slate-500 font-normal normal-case">
                          Marca la casilla para incluir en la nueva OV
                        </span>
                      </div>
                      {group.items.map((item) => {
                        const { deliveredQty, pendingQty } = getItemDeliveryInfo(item);
                        const total = item.quantityToDispatch || item.quotedQuantity || 1;
                        const moveQty = quantitiesToMove[item.id] ?? 0;
                        const isSelected = moveQty > 0;
                        const itemCustomSupplier = itemSupplierOverrides[item.id] || currentOCSupplier;
                        const hasCustomSupplier = Boolean(itemSupplierOverrides[item.id]);
                        const recentItemMeta = getItemRecentOVInfo(item);

                        return (
                          <div
                            key={item.id}
                            className={`p-2.5 rounded-xl border transition flex flex-wrap items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-amber-500/10 border-amber-500/40 shadow-xs'
                                : 'bg-slate-900/40 border-slate-800/80 opacity-80 hover:opacity-100 hover:border-slate-700'
                            }`}
                          >
                            {/* Checkbox and Equipment Info */}
                            <div className="flex items-center gap-2.5 flex-1 min-w-[240px]">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleItemSelection(item)}
                                className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-amber-500 shrink-0"
                                title="Seleccionar este equipo para trasladar a la Nueva OV"
                              />

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-white text-xs">{item.name}</span>
                                  {item.code && (
                                    <span className="text-[9.5px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                      Cód: {item.code}
                                    </span>
                                  )}

                                  {/* NOTIFICATION BADGE FOR RECENT OV (3 to 5 days) */}
                                  {recentItemMeta.hasRecentOV && (
                                    <span
                                      className="inline-flex items-center gap-1 text-[9.5px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-xs"
                                      title={`Este equipo ya tiene una OV reciente (${recentItemMeta.recentOVNumber}) creada hace ${recentItemMeta.daysAgo === 0 ? 'hoy' : `${recentItemMeta.daysAgo} días`}.`}
                                    >
                                      <Clock className="w-3 h-3 text-sky-400" />
                                      <span>OV Reciente: {recentItemMeta.recentOVNumber} ({recentItemMeta.daysAgo === 0 ? 'Hoy' : `Hace ${recentItemMeta.daysAgo}d`})</span>
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10.5px] text-slate-400 flex items-center gap-2 mt-0.5">
                                  <span>{item.brand || 'SYD'} {item.model || ''}</span>
                                  <span className="text-slate-600">•</span>
                                  <span className="font-mono text-emerald-400">{formatCOP(item.unitSalePriceCOP)} c/u</span>
                                </div>
                              </div>
                            </div>

                            {/* Stock status indicator */}
                            <div className="flex items-center gap-2 text-[10.5px] shrink-0">
                              <span className="text-slate-400">Total: <strong className="text-white">{total}</strong></span>
                              <span className="text-slate-600">|</span>
                              <span className="text-emerald-400 font-medium">✓ {deliveredQty} ent.</span>
                              <span className="text-slate-600">|</span>
                              <span className="text-amber-400 font-medium">⏳ {pendingQty} pend.</span>
                            </div>

                            {/* Stepper controls */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="text-[10.5px] text-slate-400">Trasladar:</span>
                              <button
                                type="button"
                                onClick={() => handleSetQuantity(item.id, moveQty - 1, total)}
                                disabled={moveQty <= 0}
                                className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center font-bold cursor-pointer transition"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className={`w-8 text-center font-mono font-bold text-xs ${moveQty > 0 ? 'text-amber-300' : 'text-slate-500'}`}>
                                {moveQty}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleSetQuantity(item.id, moveQty + 1, total)}
                                disabled={moveQty >= total}
                                className="w-6 h-6 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center font-bold cursor-pointer transition"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            {/* INDIVIDUAL EQUIPMENT SUPPLIER (PER-EQUIPMENT SUPPLIER CHANGE) */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-[10.5px]"
                                title={`Proveedor asignado a este equipo: ${itemCustomSupplier}`}
                              >
                                <Building2 className="w-3 h-3 text-purple-400" />
                                <span className="max-w-[130px] truncate text-slate-200">
                                  {itemCustomSupplier}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setSupplierDirectoryTarget({
                                    type: 'item',
                                    targetKey: item.id,
                                    currentSupplierName: itemCustomSupplier,
                                  })
                                }
                                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-purple-300 border border-purple-500/30 text-[10.5px] font-semibold cursor-pointer transition flex items-center gap-1"
                                title="Cambiar proveedor únicamente para este equipo"
                              >
                                <Edit2 className="w-2.5 h-2.5" />
                                <span>{hasCustomSupplier ? 'Cambiar' : 'Asignar Otro'}</span>
                              </button>
                              {hasCustomSupplier && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setItemSupplierOverrides((prev) => {
                                      const next = { ...prev };
                                      delete next[item.id];
                                      return next;
                                    })
                                  }
                                  className="p-1 text-slate-500 hover:text-red-400 transition cursor-pointer"
                                  title="Restablecer proveedor al general de la OC"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ERROR ALERT IF ANY */}
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/40 text-red-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* COMPACT BOTTOM SUMMARY & ACTION BAR */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
          {/* Summary notice */}
          <div className="flex-1 min-w-[300px]">
            {calculationSummary.isCompleteTransfer ? (
              <div className="flex items-center gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 rounded-xl font-medium">
                <Trash2 className="w-4 h-4 text-rose-400 shrink-0" />
                <span>
                  <strong>Traslado 100%:</strong> La OV original ({currentOrder?.salesOrderNumber || currentOrder?.id}) quedará sin equipos y se retirará automáticamente.
                </span>
              </div>
            ) : calculationSummary.movingUnits > 0 ? (
              <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl font-medium">
                <Info className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>Traslado Parcial ({calculationSummary.movingItemsCount} equipos seleccionados):</strong> OV original conserva {calculationSummary.remainingUnits} uds ({formatCOP(calculationSummary.remainingValueCOP)}). Nueva OV recibirá {calculationSummary.movingUnits} uds ({formatCOP(calculationSummary.movingValueCOP)}).
                </span>
              </div>
            ) : (
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-500" />
                <span>Marca las casillas de los equipos y OCs que deseas agregar a la nueva OV.</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={calculationSummary.movingUnits === 0}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
            >
              <GitFork className="w-4 h-4" />
              <span>Confirmar y Crear Nueva OV / OCs</span>
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------- */}
        {/* SUPPLIER DIRECTORY / PICKER SUB-MODAL                         */}
        {/* ------------------------------------------------------------- */}
        {supplierDirectoryTarget && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
            <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-purple-400" />
                  <h3 className="text-xs font-bold text-white">
                    Directorio de Proveedores
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSupplierDirectoryTarget(null);
                    setShowCreateSupplierForm(false);
                  }}
                  className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 space-y-3 overflow-y-auto flex-1 text-xs">
                {/* Search Bar & New Button */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={dirSearchQuery}
                      onChange={(e) => setDirSearchQuery(e.target.value)}
                      placeholder="Buscar por nombre, NIT, marcas..."
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateSupplierForm(!showCreateSupplierForm)}
                    className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition whitespace-nowrap"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Crear Nuevo</span>
                  </button>
                </div>

                {/* Optional: Inline Create Supplier Form */}
                {showCreateSupplierForm && (
                  <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 space-y-2">
                    <div className="font-bold text-purple-300 text-xs">
                      Registrar Nuevo Proveedor en el Directorio:
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Nombre / Razón Social *</label>
                        <input
                          type="text"
                          value={newSupplierForm.name}
                          onChange={(e) => setNewSupplierForm({ ...newSupplierForm, name: e.target.value })}
                          placeholder="Ej: BIOSUMMA S.A.S"
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">NIT</label>
                        <input
                          type="text"
                          value={newSupplierForm.nit}
                          onChange={(e) => setNewSupplierForm({ ...newSupplierForm, nit: e.target.value })}
                          placeholder="Ej: 900.123.456-7"
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Contacto</label>
                        <input
                          type="text"
                          value={newSupplierForm.contactPerson}
                          onChange={(e) => setNewSupplierForm({ ...newSupplierForm, contactPerson: e.target.value })}
                          placeholder="Ej: Juan Pérez"
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Teléfono</label>
                        <input
                          type="text"
                          value={newSupplierForm.phone}
                          onChange={(e) => setNewSupplierForm({ ...newSupplierForm, phone: e.target.value })}
                          placeholder="Ej: +57 300 123 4567"
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Correo</label>
                        <input
                          type="email"
                          value={newSupplierForm.email}
                          onChange={(e) => setNewSupplierForm({ ...newSupplierForm, email: e.target.value })}
                          placeholder="ventas@proveedor.com"
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-0.5">Marcas Representadas</label>
                        <input
                          type="text"
                          value={newSupplierForm.brands}
                          onChange={(e) => setNewSupplierForm({ ...newSupplierForm, brands: e.target.value })}
                          placeholder="Ej: MINDRAY, COMEN"
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowCreateSupplierForm(false)}
                        className="px-2.5 py-1 rounded text-slate-400 hover:text-white bg-slate-800 text-xs cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateAndSelectSupplier}
                        className="px-3 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer"
                      >
                        Guardar y Seleccionar
                      </button>
                    </div>
                  </div>
                )}

                {/* Suppliers List */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Proveedores Registrados ({filteredDirectorySuppliers.length}):
                  </div>
                  {filteredDirectorySuppliers.length === 0 ? (
                    <div className="text-center py-6 text-slate-500">
                      No se encontraron proveedores que coincidan con la búsqueda.
                    </div>
                  ) : (
                    filteredDirectorySuppliers.map((supp) => {
                      const isCurrent =
                        supp.name.trim().toLowerCase() ===
                        supplierDirectoryTarget.currentSupplierName.trim().toLowerCase();

                      return (
                        <div
                          key={supp.name}
                          className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 transition ${
                            isCurrent
                              ? 'bg-purple-600/15 border-purple-500/40'
                              : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              {supp.name}
                              {isCurrent && (
                                <span className="text-[9px] font-bold text-purple-300 bg-purple-500/20 px-1.5 py-0.2 rounded">
                                  Actual
                                </span>
                              )}
                            </div>
                            <div className="text-[10.5px] text-slate-400 flex items-center gap-2 mt-0.5">
                              {supp.nit && <span>NIT: {supp.nit}</span>}
                              {supp.contact && <span>• Contacto: {supp.contact}</span>}
                              {supp.phone && <span>• Tel: {supp.phone}</span>}
                            </div>
                            {supp.brands && supp.brands.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {supp.brands.map((b) => (
                                  <span
                                    key={b}
                                    className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700"
                                  >
                                    {b}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleSelectSupplierFromDirectory(supp.name)}
                            className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs cursor-pointer transition flex items-center gap-1 shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Seleccionar</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
};
