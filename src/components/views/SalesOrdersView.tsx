import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  PackageCheck,
  ReceiptText,
  GitMerge,
  Plus,
  Search,
  Filter,
  Printer,
  Calendar,
  Layers,
  Download,
  Eye,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  TrendingUp,
  FileText,
  DollarSign,
  Share2,
  Sparkles,
  ExternalLink,
  ShoppingCart,
  CheckSquare,
  FileSpreadsheet,
  Paperclip,
  Award,
  LayoutGrid,
  List,
  AlertTriangle,
  BellRing,
  Lock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronsUpDown,
  FolderTree,
  MapPin,
  Tag,
  Building2,
  RotateCcw,
  X,
  Check,
  GitFork,
} from 'lucide-react';
import { ProfitabilityCalculator } from '../modals/ProfitabilityCalculator';
import {
  SalesOrderRecord,
  SalesOrderItem,
  SalesInvoiceRecord,
  OCTrackingContract,
  TenderClientProject,
  MedicalEquipment,
  SalesOrderStatus,
  SalesInvoicePaymentStatus,
  SavedQuote,
  AuthUser,
} from '../../types';
import {
  markSalesOrderAsDeleted,
  markSalesInvoiceAsDeleted,
  unmarkSalesOrderAsDeleted,
  unmarkSalesInvoiceAsDeleted,
  isSalesOrderDeleted,
  isSalesInvoiceDeleted,
} from '../../utils/tombstones';
import {
  createSalesOrderFromOCTrackingContract,
  createOCTrackingContractFromSalesOrder,
  deduplicateSalesOrders,
  splitSalesOrderRecord,
  saveStoredSalesOrders,
} from '../../utils/salesOrdersStorage';
import { saveStoredOCTrackingContracts } from '../../utils/ocTrackingStorage';
import { NewSalesOrderModal } from './sales-orders/NewSalesOrderModal';
import { AttachInvoiceModal } from './sales-orders/AttachInvoiceModal';
import { SalesOrderPrintModal } from './sales-orders/SalesOrderPrintModal';
import { SalesOrderDetailsModal } from './sales-orders/SalesOrderDetailsModal';
import { SplitSalesOrderModal } from './sales-orders/SplitSalesOrderModal';
import { ContractTraceabilityView } from './sales-orders/ContractTraceabilityView';
import { formatCOP, isValidOCNumber, normalizeClean, cleanRef } from '../../utils/formatters';
import {
  deleteSalesOrderFromFirestore,
  deleteSalesInvoiceFromFirestore,
  saveSingleSalesOrderToFirestore,
  saveSingleSalesInvoiceToFirestore,
} from '../../services/realtimeSync';
import {
  ExcelColumnConfig,
  ExcelColumnHeader,
  useExcelTableFilters,
} from '../common/ExcelTableFilter';
import { DocumentPreviewModal } from '../common/DocumentPreviewModal';
import { getFileBlobUrlFromIndexedDB } from '../../utils/fileStorageIndexedDB';

const SALES_ORDER_COLUMNS: ExcelColumnConfig<SalesOrderRecord>[] = [
  {
    id: 'salesOrderNumber',
    label: 'N° OV / Origen',
    type: 'text',
    accessor: (row) => row.salesOrderNumber || '',
  },
  {
    id: 'clientName',
    label: 'Cliente / Ciudad',
    type: 'text',
    accessor: (row) => `${row.clientName || ''} ${row.clientCity || ''}`.trim(),
  },
  {
    id: 'items',
    label: 'Equipos',
    type: 'text',
    accessor: (row) => row.items?.map((it) => `${it.name} ${it.brand || ''} ${it.model || ''}`).join(', ') || '',
  },
  {
    id: 'totalValueCOP',
    label: 'Monto Total',
    type: 'number',
    accessor: (row) => row.totalValueCOP || 0,
    formatter: (val) => formatCOP(Number(val) || 0),
    align: 'right',
  },
  {
    id: 'status',
    label: 'Estado OV',
    type: 'enum',
    accessor: (row) => row.status || 'Borrador',
  },
  {
    id: 'ocStatus',
    label: 'Seguimiento OC',
    type: 'enum',
    accessor: (row) => (row.hasLinkedOC ? 'Con OC Proveedor' : 'Sin OC (Pendiente)'),
  },
  {
    id: 'invoicedStatus',
    label: 'Factura',
    type: 'enum',
    accessor: (row) => row.invoicedStatus || (row.invoiceNumber ? 'Facturada' : 'No Facturada'),
  },
];

const SALES_INVOICE_COLUMNS: ExcelColumnConfig<SalesInvoiceRecord>[] = [
  {
    id: 'invoiceNumber',
    label: 'N° Factura',
    type: 'text',
    accessor: (row) => row.invoiceNumber || '',
  },
  {
    id: 'salesOrderNumber',
    label: 'OV Asociada',
    type: 'text',
    accessor: (row) => row.salesOrderNumber || '',
  },
  {
    id: 'clientName',
    label: 'Cliente / Entidad',
    type: 'text',
    accessor: (row) => row.clientName || '',
  },
  {
    id: 'issueDate',
    label: 'Fecha Emisión',
    type: 'date',
    accessor: (row) => row.issueDate || '',
  },
  {
    id: 'dueDate',
    label: 'Vencimiento',
    type: 'date',
    accessor: (row) => row.dueDate || '',
  },
  {
    id: 'totalAmountCOP',
    label: 'Total Facturado',
    type: 'number',
    accessor: (row) => row.totalAmountCOP || 0,
    formatter: (val) => formatCOP(Number(val) || 0),
    align: 'right',
  },
  {
    id: 'paymentStatus',
    label: 'Estado de Pago',
    type: 'enum',
    accessor: (row) => {
      const st = row.paymentStatus || 'Pendiente';
      if (st === 'Pagada / Cancelada' || st === 'Pagada') return 'Pagada';
      if (st === 'Pendiente de Pago' || st === 'Pendiente') return 'Pendiente';
      return st;
    },
    align: 'center',
  },
];

export function computeOrderInvoicingData(order: SalesOrderRecord, salesInvoices: SalesInvoiceRecord[] = []) {
  if (!order) {
    return {
      orderInvoices: [],
      totalInvoicedCOP: 0,
      totalOrderCOP: 0,
      isFullyInvoiced: false,
      remainingToInvoiceCOP: 0,
      invoiceCount: 0,
      invoiceNumbers: '',
      percentInvoiced: 0,
      itemCoverage: [],
      invoicedQuantities: {},
      allItemsCovered: false,
      hasItemLevelInvoices: false,
    };
  }

  const invoices = salesInvoices || [];
  const orderInvoices = invoices.filter(
    (inv) =>
      Boolean(inv && inv.id) &&
      ((inv.salesOrderId && inv.salesOrderId === order.id) ||
        (order.invoiceId && inv.id === order.invoiceId) ||
        (order.salesOrderNumber &&
          inv.salesOrderNumber &&
          cleanRef(inv.salesOrderNumber) === cleanRef(order.salesOrderNumber)))
  );

  const totalInvoicedCOP =
    orderInvoices.length > 0
      ? orderInvoices.reduce((sum, inv) => sum + (Number(inv.totalAmountCOP) || 0), 0)
      : (order.totalInvoicedCOP || 0);

  const totalOrderCOP = Number(order.totalValueCOP) || 0;

  // Item-level coverage: how many units of each OV item are already invoiced.
  const invoicedQuantities: Record<string, number> = {};
  let hasItemLevelInvoices = false;
  orderInvoices.forEach((inv) => {
    (inv.items || []).forEach((alloc) => {
      if (!alloc || !alloc.salesOrderItemId) return;
      hasItemLevelInvoices = true;
      invoicedQuantities[alloc.salesOrderItemId] =
        (invoicedQuantities[alloc.salesOrderItemId] || 0) + (Number(alloc.quantity) || 0);
    });
  });

  const itemCoverage = (order.items || []).map((it) => {
    const quantity = Number(it.quantityToDispatch ?? it.quantity ?? 1) || 1;
    const invoicedQty = Math.min(quantity, invoicedQuantities[it.id] || 0);
    return {
      item: it,
      quantity,
      invoicedQty,
      remainingQty: Math.max(0, quantity - invoicedQty),
      isCovered: invoicedQty >= quantity,
    };
  });

  const allItemsCovered = itemCoverage.length > 0 && itemCoverage.every((c) => c.isCovered);
  const valueCovered = totalOrderCOP > 0 ? totalInvoicedCOP >= totalOrderCOP : totalInvoicedCOP > 0;

  // Full invoicing requires every unit invoiced. Legacy invoices without item
  // allocations fall back to value coverage so already-closed orders stay closed.
  const isFullyInvoiced =
    orderInvoices.length > 0 &&
    (itemCoverage.length > 0
      ? hasItemLevelInvoices
        ? allItemsCovered
        : valueCovered
      : valueCovered);

  const remainingToInvoiceCOP = Math.max(0, totalOrderCOP - totalInvoicedCOP);
  const invoiceCount = orderInvoices.length;
  const invoiceNumbers =
    Array.from(new Set(orderInvoices.map((i) => i.invoiceNumber).filter(Boolean))).join(', ') ||
    order.invoiceNumber ||
    '';
  const percentInvoiced =
    totalOrderCOP > 0 ? Math.min(100, Math.round((totalInvoicedCOP / totalOrderCOP) * 100)) : 0;

  return {
    orderInvoices,
    totalInvoicedCOP,
    totalOrderCOP,
    isFullyInvoiced,
    remainingToInvoiceCOP,
    invoiceCount,
    invoiceNumbers,
    percentInvoiced,
    itemCoverage,
    invoicedQuantities,
    allItemsCovered,
    hasItemLevelInvoices,
  };
}

interface SalesOrdersViewProps {
  salesOrders: SalesOrderRecord[];
  onUpdateSalesOrders: (orders: SalesOrderRecord[]) => void;
  salesInvoices: SalesInvoiceRecord[];
  onUpdateSalesInvoices: (invoices: SalesInvoiceRecord[]) => void;
  contracts: OCTrackingContract[];
  onUpdateContracts?: (contracts: OCTrackingContract[]) => void;
  savedQuotes: SavedQuote[];
  tenderClients?: TenderClientProject[];
  onUpdateTenderClient?: (clientId: string, updates: Partial<TenderClientProject>) => void;
  equipments: MedicalEquipment[];
  currentUser?: AuthUser | null;
  onNavigateToTab?: (tab: string) => void;
  customLetterheadUrl?: string | null;
  onGenerateOCTracking?: (order: SalesOrderRecord) => void;
  initialQuoteToConvert?: SavedQuote | null;
  onClearInitialQuoteToConvert?: () => void;
  initialTenderToConvert?: TenderClientProject | null;
  onClearInitialTenderToConvert?: () => void;
}

export const SalesOrdersView: React.FC<SalesOrdersViewProps> = ({
  salesOrders,
  onUpdateSalesOrders,
  salesInvoices,
  onUpdateSalesInvoices,
  contracts,
  onUpdateContracts,
  savedQuotes,
  tenderClients = [],
  onUpdateTenderClient,
  equipments,
  currentUser,
  onNavigateToTab,
  customLetterheadUrl,
  onGenerateOCTracking,
  initialQuoteToConvert,
  onClearInitialQuoteToConvert,
  initialTenderToConvert,
  onClearInitialTenderToConvert,
}) => {
  // Helper to compute invoicing breakdown for any sales order (initialized at top to eliminate any TDZ ReferenceError)
  const getOrderInvoicingData = (order: SalesOrderRecord) => computeOrderInvoicingData(order, salesInvoices);

  // An OV is archived only when real invoice coverage reaches 100% of its units.
  const isOrderArchived = (order: SalesOrderRecord): boolean =>
    computeOrderInvoicingData(order, salesInvoices).isFullyInvoiced;

  // Main subtab selection
  const [activeSubTab, setActiveSubTab] = useState<'orders' | 'invoices' | 'traceability'>('orders');

  // Permission enforcement
  const isReadOnly = currentUser?.role === 'viewer' && !currentUser?.permissions?.canManageSalesOrders;

  // Search & Filter State (OVs)
  const [orderSearchText, setOrderSearchText] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderOriginFilter, setOrderOriginFilter] = useState<'all' | 'tender' | 'quote' | 'direct'>('all');
  const [showActiveOrders, setShowActiveOrders] = useState<boolean>(true);
  const [showArchivedOrders, setShowArchivedOrders] = useState<boolean>(true);
  const [ordersViewMode, setOrdersViewMode] = useState<'clients' | 'list' | 'grid'>('clients');
  const [collapsedClientKeys, setCollapsedClientKeys] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('syd_collapsed_client_keys_v1');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleClientCollapse = (key: string) => {
    setCollapsedClientKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      try {
        localStorage.setItem('syd_collapsed_client_keys_v1', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const expandAllClients = () => {
    setCollapsedClientKeys(new Set());
    try {
      localStorage.setItem('syd_collapsed_client_keys_v1', JSON.stringify([]));
    } catch {}
  };

  const collapseAllClients = (allKeys: string[]) => {
    setCollapsedClientKeys(new Set(allKeys));
    try {
      localStorage.setItem('syd_collapsed_client_keys_v1', JSON.stringify(allKeys));
    } catch {}
  };

  // State for expanded equipments per sales order (plegar/desplegar equipos para optimizar espacio)
  const [expandedOrderEquipments, setExpandedOrderEquipments] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('syd_expanded_order_equipments_v1');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleOrderEquipments = (orderId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedOrderEquipments((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      try {
        localStorage.setItem('syd_expanded_order_equipments_v1', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const expandAllOrderEquipments = (orderIds: string[]) => {
    setExpandedOrderEquipments((prev) => {
      const next = new Set(prev);
      orderIds.forEach((id) => next.add(id));
      try {
        localStorage.setItem('syd_expanded_order_equipments_v1', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const collapseAllOrderEquipments = (orderIds?: string[]) => {
    setExpandedOrderEquipments((prev) => {
      let next: Set<string>;
      if (orderIds && orderIds.length > 0) {
        next = new Set(prev);
        orderIds.forEach((id) => next.delete(id));
      } else {
        next = new Set();
      }
      try {
        localStorage.setItem('syd_expanded_order_equipments_v1', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // Search & Filter State (Invoices)
  const [invoiceSearchText, setInvoiceSearchText] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('all');

  // Modals state
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SalesOrderRecord | null>(null);
  const [orderToDelete, setOrderToDelete] = useState<SalesOrderRecord | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<SalesInvoiceRecord | null>(null);
  const [quoteToConvert, setQuoteToConvert] = useState<SavedQuote | null>(initialQuoteToConvert || null);
  const [tenderToConvert, setTenderToConvert] = useState<TenderClientProject | null>(initialTenderToConvert || null);
  const [splitOrderModalTarget, setSplitOrderModalTarget] = useState<SalesOrderRecord | null>(null);

  // Document preview modal for invoice attachments
  const [previewInvoiceDoc, setPreviewInvoiceDoc] = useState<{
    isOpen: boolean;
    title: string;
    subtitle?: string;
    fileName: string;
    fileSize?: string;
    fileData?: string;
    fileType?: string;
    onDownload?: () => void;
  } | null>(null);

  // Handle ESC key press to close delete modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (orderToDelete) setOrderToDelete(null);
        if (invoiceToDelete) setInvoiceToDelete(null);
      }
    };
    if (orderToDelete || invoiceToDelete) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [orderToDelete, invoiceToDelete]);

  // Auto-open modal when initialQuoteToConvert is passed
  React.useEffect(() => {
    if (initialQuoteToConvert) {
      setQuoteToConvert(initialQuoteToConvert);
      setTenderToConvert(null);
      setEditingOrder(null);
      setIsNewOrderModalOpen(true);
      setActiveSubTab('orders');
      onClearInitialQuoteToConvert?.();
    }
  }, [initialQuoteToConvert, onClearInitialQuoteToConvert]);

  // Auto-open modal when initialTenderToConvert is passed
  React.useEffect(() => {
    if (initialTenderToConvert) {
      setTenderToConvert(initialTenderToConvert);
      setQuoteToConvert(null);
      setEditingOrder(null);
      setIsNewOrderModalOpen(true);
      setActiveSubTab('orders');
      onClearInitialTenderToConvert?.();
    }
  }, [initialTenderToConvert, onClearInitialTenderToConvert]);

  const [isAttachInvoiceModalOpen, setIsAttachInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<SalesInvoiceRecord | null>(null);
  const [targetSalesOrderForInvoice, setTargetSalesOrderForInvoice] = useState<SalesOrderRecord | null>(null);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printingOrder, setPrintingOrder] = useState<SalesOrderRecord | null>(null);

  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isProfitabilityModalOpen, setIsProfitabilityModalOpen] = useState(false);
  const [viewingOrder, setViewingOrder] = useState<SalesOrderRecord | null>(null);

  // Helper to resolve live item status and styled badge from linked OC Tracking contracts
  const resolveItemStatusAndBadge = (order: SalesOrderRecord, item: SalesOrderItem) => {
    let liveStatus = item.equipmentStatus || 'Pendiente de OC';
    let liveOCNumber = (isValidOCNumber(item.linkedSupplierOCNumber) ? item.linkedSupplierOCNumber : null) ||
                       (isValidOCNumber(item.supplierOCRef) ? item.supplierOCRef : null);

    const normOrderClient = normalizeClean(order.clientName);
    const normOrderSO = normalizeClean(order.salesOrderNumber?.replace(/^ov:\s*/i, ''));
    const normOrderContract = normalizeClean(order.contractNumber?.replace(/^n°?o?hboc/i, 'hboc'));

    if (contracts && contracts.length > 0) {
      const candidateContracts = contracts.filter((c) => {
        if (order.ocContractId && c.id === order.ocContractId) return true;
        if (order.id && c.salesOrderId === order.id) return true;
        if (order.tenderClientId && (c.tenderClientId === order.tenderClientId || c.id === order.tenderClientId)) return true;
        if (order.contractId && (c.id === order.contractId || c.tenderClientId === order.contractId)) return true;
        if (normOrderSO && normOrderSO.length >= 3 && !['ov', 'sinov', 'na', 'n/a'].includes(normOrderSO)) {
          const cSO = normalizeClean(c.salesOrderNumber?.replace(/^ov:\s*/i, ''));
          if (cSO === normOrderSO || cSO.includes(normOrderSO) || normOrderSO.includes(cSO)) return true;
        }
        if (normOrderContract && normOrderContract.length >= 4 && !['nohboc', 'hboc', 'na', 'n/a'].includes(normOrderContract)) {
          const cContract = normalizeClean(c.contractNumber?.replace(/^n°?o?hboc/i, 'hboc'));
          if (cContract === normOrderContract || cContract.includes(normOrderContract) || normOrderContract.includes(cContract)) return true;
        }
        return false;
      });

      const normItemName = normalizeClean(item.name);
      const normItemCode = normalizeClean(item.code);

      for (const matchedContract of candidateContracts) {
        if (!matchedContract.items || matchedContract.items.length === 0) continue;

        const cItem = matchedContract.items.find((cIt) => {
          if (cIt.equipmentId && item.equipmentId && cIt.equipmentId === item.equipmentId) return true;
          if (cIt.code && item.code && (normalizeClean(cIt.code) === normItemCode || normalizeClean(cIt.code).includes(normItemCode) || normItemCode.includes(normalizeClean(cIt.code)))) return true;
          if (cIt.name && item.name && (
            normalizeClean(cIt.name) === normItemName ||
            normalizeClean(cIt.name).includes(normItemName) ||
            normItemName.includes(normalizeClean(cIt.name))
          )) return true;
          return false;
        }) || (matchedContract.items.length === (order.items || []).length ? matchedContract.items[0] : null);

        if (cItem) {
          if (cItem.status) {
            liveStatus = cItem.status;
          }
          if (isValidOCNumber(cItem.ocNumber)) {
            liveOCNumber = cItem.ocNumber;
          }
          break;
        }
      }
    }

    // Normalize delivery state
    const normLiveStatus = normalizeClean(liveStatus);
    const isDeliveredState =
      normLiveStatus.includes('entregad') ||
      normLiveStatus.includes('instalad') ||
      normLiveStatus.includes('despachad') ||
      normLiveStatus.includes('bodega') ||
      normLiveStatus.includes('cerrad') ||
      normLiveStatus.includes('concluid') ||
      normLiveStatus.includes('pagad') ||
      normLiveStatus.includes('facturad');

    // If an OC number was assigned but status is still initial, reflect that OC is assigned!
    if (liveOCNumber && (!liveStatus || liveStatus === 'Pendiente de OC' || liveStatus === 'Pendiente')) {
      liveStatus = 'OC Asignada';
    }

    // If equipment is delivered, NEVER erase status to 'Pendiente de OC'
    if (!isDeliveredState && (!liveStatus || liveStatus === 'Pendiente de OC' || !liveOCNumber)) {
      if (!liveOCNumber) {
        return {
          status: 'Pendiente de OC',
          badgeClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium',
          ocNumber: null,
        };
      }
    }

    let badgeClass = 'bg-purple-500/15 text-purple-300 border border-purple-500/30 font-medium';
    switch (liveStatus) {
      case 'Despachado al Cliente':
      case 'Entregado e Instalado':
      case 'Cerrado / Concluido':
      case 'Entregada al Cliente':
        badgeClass = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold';
        break;
      case 'Equipos en Bodega':
      case 'Equipos en Bodega SYD':
      case 'En Bodega SYD':
      case 'Listo para Despacho a Cliente':
      case 'Listo para Despacho':
      case 'En Ingreso Técnico & Calidad':
      case 'En Ingreso Técnico':
        badgeClass = 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold';
        break;
      case 'En Tránsito / Despachada':
      case 'En Aduana / Nacionalización':
      case 'En Fabricación / Procesamiento':
      case 'Confirmada por Proveedor':
      case 'Emitida / Enviada al Proveedor':
        badgeClass = 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-medium';
        break;
      default:
        badgeClass = 'bg-purple-500/15 text-purple-300 border border-purple-500/30 font-medium';
        break;
    }

    return {
      status: liveStatus,
      badgeClass,
      ocNumber: liveOCNumber,
    };
  };

  // Helper to determine origin info for an OV
  const getOrderOriginInfo = (order: SalesOrderRecord) => {
    if (order.contractNumber || order.contractId || order.tenderClientId) {
      return {
        type: 'tender' as const,
        label: 'Licitación Adjudicada',
        badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
        icon: Award,
        detail: order.contractNumber ? `Licitación: ${order.contractNumber}` : 'Licitación / Contrato',
        subDetail: order.quoteNumber ? `(Cotiz: ${order.quoteNumber})` : null,
      };
    }
    if (order.quoteNumber || order.quoteId) {
      return {
        type: 'quote' as const,
        label: 'Desde Cotización',
        badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        icon: FileSpreadsheet,
        detail: `Cotización: ${order.quoteNumber || 'Directa'}`,
        subDetail: null,
      };
    }
    return {
      type: 'direct' as const,
      label: 'Orden de Venta Directa',
      badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
      icon: ShoppingCart,
      detail: 'Venta Directa (OC Cliente)',
      subDetail: null,
    };
  };

  // Consolidated deduplicated sales orders (user-controlled OVs)
  const deduplicatedSalesOrders = useMemo(() => {
    return deduplicateSalesOrders(salesOrders);
  }, [salesOrders]);

  // Base Filtered Orders (Search & Quick Status & Lifecycle Filters)
  const baseSalesOrders = useMemo(() => {
    return deduplicatedSalesOrders.filter((order) => {
      // Lifecycle Filter: Activas vs Culminadas / Facturadas
      const isArchived = isOrderArchived(order);

      if (!showActiveOrders && !isArchived) return false;
      if (!showArchivedOrders && isArchived) return false;

      if (orderStatusFilter !== 'all' && order.status !== orderStatusFilter) {
        return false;
      }
      if (orderOriginFilter !== 'all') {
        const isTender = Boolean(order.contractNumber || order.contractId || order.tenderClientId);
        const isQuote = !isTender && Boolean(order.quoteNumber || order.quoteId);
        const isDirect = !isTender && !isQuote;

        if (orderOriginFilter === 'tender' && !isTender) return false;
        if (orderOriginFilter === 'quote' && !isQuote) return false;
        if (orderOriginFilter === 'direct' && !isDirect) return false;
      }
      if (orderSearchText.trim()) {
        const query = orderSearchText.toLowerCase().trim();
        const matchesNumber = order.salesOrderNumber?.toLowerCase().includes(query);
        const matchesClient = order.clientName?.toLowerCase().includes(query);
        const matchesQuote = order.quoteNumber?.toLowerCase().includes(query);
        const matchesContract = order.contractNumber?.toLowerCase().includes(query);
        const matchesNotes = order.notes?.toLowerCase().includes(query);
        const matchesItems = order.items?.some(
          (it) =>
            it.name.toLowerCase().includes(query) ||
            it.brand?.toLowerCase().includes(query) ||
            it.model?.toLowerCase().includes(query)
        );
        if (!matchesNumber && !matchesClient && !matchesQuote && !matchesContract && !matchesNotes && !matchesItems) {
          return false;
        }
      }
      return true;
    });
  }, [deduplicatedSalesOrders, orderStatusFilter, orderOriginFilter, orderSearchText, showActiveOrders, showArchivedOrders, salesInvoices]);

  // Counts for active vs archived orders
  const activeOrdersCount = useMemo(() => {
    return deduplicatedSalesOrders.filter((order) => {
      const isArchived = isOrderArchived(order);
      return !isArchived;
    }).length;
  }, [deduplicatedSalesOrders, salesInvoices]);

  const archivedOrdersCount = useMemo(() => {
    return deduplicatedSalesOrders.filter((order) => {
      const isArchived = isOrderArchived(order);
      return isArchived;
    }).length;
  }, [deduplicatedSalesOrders, salesInvoices]);

  const {
    filteredRows: filteredOrders,
    filters: orderExcelFilters,
    sort: orderExcelSort,
    onApplyFilter: onApplyOrderExcelFilter,
    onApplySort: onApplyOrderExcelSort,
    onClearColumnFilter: onClearOrderExcelColumnFilter,
    onResetAllFilters: onResetAllOrderExcelFilters,
    isFilteredOrSorted: isOrderExcelFilteredOrSorted,
    activeFiltersCount: orderExcelActiveFiltersCount,
  } = useExcelTableFilters(baseSalesOrders, SALES_ORDER_COLUMNS);

  // Group filtered orders by client for accordion foldable view
  interface ClientGroupedOV {
    clientKey: string;
    clientName: string;
    clientNit?: string;
    clientCity?: string;
    clientContactPerson?: string;
    clientContactPhone?: string;
    orders: SalesOrderRecord[];
    totalCOP: number;
    totalInvoicedCOP: number;
    totalItems: number;
    isFullyInvoiced: boolean;
  }

  const groupedClientsOrders = useMemo((): ClientGroupedOV[] => {
    const map = new Map<string, ClientGroupedOV>();

    filteredOrders.forEach((order) => {
      const name = (order.clientName || 'Cliente No Especificado').trim();
      const key = normalizeClean(name) || 'sin-cliente';

      if (!map.has(key)) {
        map.set(key, {
          clientKey: key,
          clientName: name,
          clientNit: order.clientNit,
          clientCity: order.clientCity,
          clientContactPerson: order.clientContactPerson,
          clientContactPhone: order.clientContactPhone,
          orders: [],
          totalCOP: 0,
          totalInvoicedCOP: 0,
          totalItems: 0,
          isFullyInvoiced: true,
        });
      }

      const group = map.get(key)!;
      group.orders.push(order);
      group.totalCOP += order.totalValueCOP || 0;
      const invData = getOrderInvoicingData(order);
      group.totalInvoicedCOP += invData.totalInvoicedCOP;
      group.totalItems += order.items?.length || 0;
      if (!invData.isFullyInvoiced) {
        group.isFullyInvoiced = false;
      }
    });

    return Array.from(map.values());
  }, [filteredOrders, salesInvoices]);

  // Base Filtered Invoices (Search & Status)
  const baseSalesInvoices = useMemo(() => {
    return salesInvoices.filter((inv) => {
      if (invoiceStatusFilter !== 'all') {
        const normSt = (inv.paymentStatus === 'Pagada / Cancelada' || inv.paymentStatus === 'Pagada')
          ? 'Pagada'
          : (inv.paymentStatus === 'Pendiente de Pago' || inv.paymentStatus === 'Pendiente' || !inv.paymentStatus)
          ? 'Pendiente'
          : inv.paymentStatus;
        if (normSt !== invoiceStatusFilter) {
          return false;
        }
      }
      if (invoiceSearchText.trim()) {
        const query = invoiceSearchText.toLowerCase().trim();
        const matchesNumber = inv.invoiceNumber?.toLowerCase().includes(query);
        const matchesClient = inv.clientName?.toLowerCase().includes(query);
        const matchesSO = inv.salesOrderNumber?.toLowerCase().includes(query);
        if (!matchesNumber && !matchesClient && !matchesSO) return false;
      }
      return true;
    });
  }, [salesInvoices, invoiceStatusFilter, invoiceSearchText]);

  const {
    filteredRows: filteredInvoices,
    filters: invoiceExcelFilters,
    sort: invoiceExcelSort,
    onApplyFilter: onApplyInvoiceExcelFilter,
    onApplySort: onApplyInvoiceExcelSort,
    onClearColumnFilter: onClearInvoiceExcelColumnFilter,
    onResetAllFilters: onResetAllInvoiceExcelFilters,
    isFilteredOrSorted: isInvoiceExcelFilteredOrSorted,
    activeFiltersCount: invoiceExcelActiveFiltersCount,
  } = useExcelTableFilters(baseSalesInvoices, SALES_INVOICE_COLUMNS);

  // Collapsible KPI state
  const [isKpiMinimized, setIsKpiMinimized] = useState<boolean>(() => {
    try {
      return localStorage.getItem('syd_ov_kpis_minimized') === 'true';
    } catch {
      return false;
    }
  });

  const toggleKpiMinimized = () => {
    setIsKpiMinimized((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('syd_ov_kpis_minimized', String(next));
      } catch {}
      return next;
    });
  };

  // KPI Calculations (OVs)
  const totalOrdersCount = deduplicatedSalesOrders.length;
  const enProcesoCount = deduplicatedSalesOrders.filter((o) => o.status === 'En Proceso' || o.status === 'Borrador').length;
  const enBodegaCount = deduplicatedSalesOrders.filter((o) => o.status === 'Equipos en Bodega').length;
  const facturadasCount = deduplicatedSalesOrders.filter((o) => o.status === 'Facturada').length;
  const totalOVValueCOP = deduplicatedSalesOrders
    .filter((o) => o.status !== 'Cancelada')
    .reduce((acc, o) => acc + (Number(o.totalValueCOP) || 0), 0);

  // Active OVs pending purchase orders (OC)
  const ordersWithoutOC = useMemo(() => {
    return deduplicatedSalesOrders.filter((o) => o.status !== 'Cancelada' && !o.hasLinkedOC);
  }, [deduplicatedSalesOrders]);

  // Handlers for Save / Delete
  const handleSaveOrder = async (savedOrder: SalesOrderRecord, generateOCNow?: boolean) => {
    unmarkSalesOrderAsDeleted(savedOrder.id, savedOrder.salesOrderNumber, savedOrder.tenderClientId, savedOrder.contractId);

    const hasItems = (savedOrder.items || []).length > 0;
    const finalOrder: SalesOrderRecord = hasItems
      ? { ...savedOrder, hasLinkedOC: true }
      : savedOrder;

    const existingIndex = deduplicatedSalesOrders.findIndex((o) => o.id === finalOrder.id);
    let updatedOrders: SalesOrderRecord[];
    if (existingIndex >= 0) {
      updatedOrders = [...deduplicatedSalesOrders];
      updatedOrders[existingIndex] = finalOrder;
    } else {
      updatedOrders = [finalOrder, ...deduplicatedSalesOrders];
    }
    onUpdateSalesOrders(updatedOrders);

    // Guaranteed cloud persistence before proceeding
    try {
      await saveSingleSalesOrderToFirestore(finalOrder);
    } catch (e) {
      console.error('Error saving sales order to Firestore:', e);
    }

    // Automatically generate/sync OC tracking contract in Ventana 7
    if (hasItems) {
      if (onGenerateOCTracking) {
        onGenerateOCTracking(finalOrder);
      } else if (onUpdateContracts) {
        const newContract = createOCTrackingContractFromSalesOrder(finalOrder, equipments);
        const existingIdx = contracts.findIndex(
          (c) =>
            c.id === newContract.id ||
            c.salesOrderId === finalOrder.id ||
            (finalOrder.salesOrderNumber && c.salesOrderNumber === finalOrder.salesOrderNumber)
        );
        let updatedContracts = [...contracts];
        if (existingIdx >= 0) {
          updatedContracts[existingIdx] = { ...updatedContracts[existingIdx], ...newContract };
        } else {
          updatedContracts = [newContract, ...updatedContracts];
        }
        onUpdateContracts(updatedContracts);
        saveStoredOCTrackingContracts(updatedContracts);
      }
    }
  };

  const handleDeleteOrder = (orderIdOrOrder: string | SalesOrderRecord) => {
    const target = typeof orderIdOrOrder === 'string'
      ? deduplicatedSalesOrders.find((o) => o.id === orderIdOrOrder)
      : orderIdOrOrder;
    if (!target) return;
    setOrderToDelete(target);
  };

  // Inline Manual OV Number Editing State
  const [editingOVNumberId, setEditingOVNumberId] = useState<string | null>(null);
  const [editingOVNumberValue, setEditingOVNumberValue] = useState<string>('');

  const handleStartEditOVNumber = (order: SalesOrderRecord, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingOVNumberId(order.id);
    setEditingOVNumberValue(order.salesOrderNumber || '');
  };

  const handleSaveOVNumber = (orderId: string, e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    const cleanNum = editingOVNumberValue.trim();
    const updated = deduplicatedSalesOrders.map((o) =>
      o.id === orderId ? { ...o, salesOrderNumber: cleanNum, updatedAt: new Date().toISOString() } : o
    );
    onUpdateSalesOrders(updated);
    setEditingOVNumberId(null);
  };

  const handleCancelEditOVNumber = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingOVNumberId(null);
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    const orderId = orderToDelete.id;
    const soNum = orderToDelete.salesOrderNumber;
    const tenderId = orderToDelete.tenderClientId;
    const contractId = orderToDelete.contractId;

    // 1. Mark tombstone immediately in local memory/storage so it can NEVER resurrect
    markSalesOrderAsDeleted(orderId, soNum, tenderId, contractId);

    // 2. Remove from local state
    const updated = salesOrders.filter((o) => o.id !== orderId);
    onUpdateSalesOrders(updated);

    try {
      localStorage.setItem('syd_sales_orders_v1', JSON.stringify(updated));
    } catch (e) {}

    // 3. Remove permanently from Firestore and server disk snapshot, awaited
    try {
      await deleteSalesOrderFromFirestore(orderId, soNum, tenderId, contractId);
    } catch (e) {
      console.error('Error deleting sales order from Firestore:', e);
    }

    // 4. Clean up any linked OC Tracking contracts generated for this sales order so old data is not reused
    if (onUpdateContracts && contracts && contracts.length > 0) {
      const remainingContracts = contracts.filter((c) => {
        if (c.salesOrderId && c.salesOrderId === orderId) return false;
        if (orderToDelete.ocContractId && c.id === orderToDelete.ocContractId) return false;
        return true;
      });
      if (remainingContracts.length !== contracts.length) {
        onUpdateContracts(remainingContracts);
        try {
          localStorage.setItem('syd_oc_tracking_contracts_v3', JSON.stringify(remainingContracts));
        } catch (_) {}
      }
    }

    // 5. Clean up any linked sales invoices for this sales order so old invoice data is not reused
    if (salesInvoices && salesInvoices.length > 0) {
      const remainingInvoices = salesInvoices.filter(
        (inv) => inv.salesOrderId !== orderId && (!soNum || inv.salesOrderNumber !== soNum)
      );
      if (remainingInvoices.length !== salesInvoices.length) {
        onUpdateSalesInvoices(remainingInvoices);
        try {
          localStorage.setItem('syd_sales_invoices_v1', JSON.stringify(remainingInvoices));
        } catch (_) {}
      }
    }

    if (viewingOrder?.id === orderId) setViewingOrder(null);
    if (editingOrder?.id === orderId) setEditingOrder(null);
    setOrderToDelete(null);
  };

  // Helper to check if all equipment linked to a Sales Order is delivered in Seguimiento de OC
  const isOrderEquipmentDeliveredInOC = (order: SalesOrderRecord): { isDelivered: boolean; pendingCount: number; deliveredCount?: number; reason?: string } => {
    if (!order.items || order.items.length === 0) {
      return { isDelivered: false, pendingCount: 0, reason: 'La Orden no tiene equipos registrados' };
    }

    const normSO = normalizeClean(order.salesOrderNumber?.replace(/^ov:\s*/i, ''));
    const normContract = normalizeClean(order.contractNumber?.replace(/^n°?o?hboc/i, 'hboc'));

    // Prioritize direct matched contract strictly for this specific order
    const matchedContracts = (contracts || []).filter((c) => {
      if (order.ocContractId && c.id === order.ocContractId) return true;
      if (order.id && c.salesOrderId === order.id) return true;
      if (order.id && (c.salesOrderIds || []).includes(order.id)) return true;
      if (normSO && normSO.length >= 3 && !['ov', 'sinov', 'na', 'n/a'].includes(normSO)) {
        const cSO = normalizeClean(c.salesOrderNumber?.replace(/^ov:\s*/i, ''));
        if (cSO === normSO || (c.salesOrderNumbers || []).some(s => normalizeClean(s?.replace(/^ov:\s*/i, '')) === normSO)) return true;
      }
      if (order.tenderClientId && (c.tenderClientId === order.tenderClientId || c.id === order.tenderClientId)) return true;
      if (order.contractId && (c.id === order.contractId || c.tenderClientId === order.contractId)) return true;
      if (normContract && normContract.length >= 4 && !['nohboc', 'hboc', 'na', 'n/a'].includes(normContract)) {
        const cContract = normalizeClean(c.contractNumber?.replace(/^n°?o?hboc/i, 'hboc'));
        if (cContract === normContract || cContract.includes(normContract) || normContract.includes(cContract)) return true;
      }
      return false;
    });

    const isDeliveredStatus = (st?: string) => {
      if (!st) return false;
      const s = normalizeClean(st);
      if (
        s.includes('despachad') ||
        s.includes('transito') ||
        s.includes('bodega') ||
        s.includes('aduana') ||
        s.includes('solicitud') ||
        s.includes('proceso') ||
        s.includes('embarque') ||
        s.includes('fabricacion') ||
        s.includes('pendiente')
      ) {
        return false;
      }
      return (
        s.includes('entregado e instalado') ||
        s.includes('entregada al cliente') ||
        s.includes('instalado / recibido') ||
        s.includes('instalado') ||
        s.includes('cerrado / concluido') ||
        s.includes('cerrado') ||
        s.includes('concluid')
      );
    };

    const contractItems = matchedContracts.flatMap((c) => c.items || []);

    if (contractItems.length === 0 && matchedContracts.length === 0) {
      return {
        isDelivered: false,
        pendingCount: order.items.length,
        reason: 'Los equipos aún no cuentan con registro de entrega en Seguimiento de OC',
      };
    }

    let pending = 0;
    let deliveredCount = 0;
    for (let i = 0; i < order.items.length; i++) {
      const item = order.items[i];
      const normItemName = normalizeClean(item.name);
      const normItemCode = normalizeClean(item.code);

      const matchedCItem = contractItems.find((cIt) => {
        const itemSO = cIt.salesOrderNumber ? normalizeClean(cIt.salesOrderNumber.replace(/^ov:\s*/i, '')) : '';
        const orderSO = normSO;
        if (itemSO && orderSO && itemSO !== orderSO) return false;

        return (
          (cIt.salesOrderItemId && item.id && cIt.salesOrderItemId === item.id) ||
          (cIt.equipmentId && item.equipmentId && cIt.equipmentId === item.equipmentId) ||
          (cIt.code && item.code && normalizeClean(cIt.code) === normItemCode) ||
          (cIt.name && item.name && (
            normalizeClean(cIt.name) === normItemName ||
            (normItemName.length >= 6 && normalizeClean(cIt.name).includes(normItemName)) ||
            (normItemName.length >= 6 && normItemName.includes(normalizeClean(cIt.name)))
          ))
        );
      });

      const status = matchedCItem ? matchedCItem.status : item.equipmentStatus;
      const isDelivered = isDeliveredStatus(status);

      if (!isDelivered) {
        pending++;
      } else {
        deliveredCount++;
      }
    }

    if (pending > 0 && deliveredCount === 0) {
      return {
        isDelivered: false,
        deliveredCount: 0,
        pendingCount: pending,
        reason: `Faltan ${pending} de ${order.items.length} equipos por cambiar a «Entregado e Instalado» en Seguimiento de OC`,
      };
    }

    return { isDelivered: pending === 0, deliveredCount, pendingCount: pending };
  };

  const handleUpdateOrderStatus = (orderId: string, newStatus: SalesOrderStatus) => {
    if (newStatus === 'Facturada') {
      const targetOrd = salesOrders.find((o) => o.id === orderId);
      if (targetOrd) {
        const { isDelivered, reason } = isOrderEquipmentDeliveredInOC(targetOrd);
        if (!isDelivered) {
          alert(`⛔ BLOQUEO DE FACTURACIÓN:\n\nNo se puede cambiar el estado a "Facturada" porque aún no se han entregado los equipos en Seguimiento de OC.\n\nDetalle: ${reason || 'Pendiente de entrega'}.\n\nPor favor marque los equipos como entregados en Seguimiento de OC primero.`);
          return;
        }

        // Invoicing is authoritative: a manual status change must never mark
        // an OV as invoiced without real invoice coverage for every unit.
        const targetInvoicing = computeOrderInvoicingData(targetOrd, salesInvoices);
        if (!targetInvoicing.isFullyInvoiced) {
          alert(`⛔ BLOQUEO DE FACTURACIÓN:\n\nEsta Orden de Venta aún no está facturada por completo (${targetInvoicing.percentInvoiced}% cubierto).\n\nAdjunta las facturas que cubran todos los equipos antes de marcarla como "Facturada".`);
          return;
        }

        // Auto-archive linked Tender & Contract
        const targetTenderId = targetOrd.tenderClientId || targetOrd.contractId;
        const matchedTender = (tenderClients || []).find((t) => {
          if (targetTenderId && t.id === targetTenderId) return true;
          if (targetOrd.contractNumber && t.header?.processNumber && normalizeClean(t.header.processNumber).includes(normalizeClean(targetOrd.contractNumber))) return true;
          if (targetOrd.salesOrderNumber && t.header?.processNumber && normalizeClean(t.header.processNumber).includes(normalizeClean(targetOrd.salesOrderNumber))) return true;
          if (targetOrd.clientName && t.clientName && (
            normalizeClean(t.clientName) === normalizeClean(targetOrd.clientName) ||
            normalizeClean(t.clientName).includes(normalizeClean(targetOrd.clientName)) ||
            normalizeClean(targetOrd.clientName).includes(normalizeClean(t.clientName))
          )) return true;
          return false;
        });

        if (matchedTender && onUpdateTenderClient) {
          const tenderItems = matchedTender.items || [];
          const allDelivered = tenderItems.length > 0 && tenderItems.every((tIt) => {
            return (contracts || []).some((c) =>
              (c.items || []).some((cIt) => {
                const isMatch = (cIt.equipmentId && tIt.equipmentId && cIt.equipmentId === tIt.equipmentId) ||
                  (cIt.code && tIt.code && cIt.code === tIt.code) ||
                  (cIt.name && tIt.name && normalizeClean(cIt.name) === normalizeClean(tIt.name));
                return isMatch && (cIt.status === 'Entregado e Instalado' || cIt.status === 'Cerrado / Concluido');
              })
            );
          });

          // The whole tender/OC directa must be invoiced, not just this OV.
          const normProcess = normalizeClean(matchedTender.header?.processNumber || '');
          const linkedTenderOrders = salesOrders.filter((so) => {
            if (so.id === targetOrd.id) return true;
            if (so.tenderClientId && so.tenderClientId === matchedTender.id) return true;
            if (so.contractId && so.contractId === matchedTender.id) return true;
            if (normProcess) {
              const refs = [so.contractNumber, so.salesOrderNumber]
                .map((r) => normalizeClean(r || ''))
                .filter((r) => r.length >= 3);
              if (refs.some((r) => r.includes(normProcess) || normProcess.includes(r))) return true;
            }
            return false;
          });
          const allOrdersInvoiced =
            linkedTenderOrders.length > 0 &&
            linkedTenderOrders.every((so) => computeOrderInvoicingData(so, salesInvoices).isFullyInvoiced);

          if (allDelivered && allOrdersInvoiced) {
            onUpdateTenderClient(matchedTender.id, { status: 'Cumplido / Archivado' });
          }
        }
        if (onUpdateContracts && contracts && contracts.length > 0) {
          const normSO = normalizeClean(targetOrd.salesOrderNumber);
          const updatedContracts = contracts.map((c) => {
            const isMatch =
              (targetOrd.ocContractId && c.id === targetOrd.ocContractId) ||
              c.salesOrderId === targetOrd.id ||
              (normSO && c.salesOrderNumber && normalizeClean(c.salesOrderNumber) === normSO);
            if (isMatch) {
              const allDelivered = (c.items || []).length > 0 && (c.items || []).every(
                (it) => it.status === 'Entregado e Instalado' || it.status === 'Cerrado / Concluido'
              );
              const linkedContractOrders = salesOrders.filter((so) => {
                if (so.id === targetOrd.id) return true;
                if (so.ocContractId && so.ocContractId === c.id) return true;
                if (so.id && (c.salesOrderIds || []).includes(so.id)) return true;
                if (so.id && c.salesOrderId === so.id) return true;
                if (normSO && c.salesOrderNumber && normalizeClean(c.salesOrderNumber) === normSO) return true;
                return false;
              });
              const allContractOrdersInvoiced =
                linkedContractOrders.length > 0 &&
                linkedContractOrders.every((so) => computeOrderInvoicingData(so, salesInvoices).isFullyInvoiced);
              if (allDelivered && allContractOrdersInvoiced) {
                return { ...c, globalStatus: 'Cerrado / Concluido' as any, lastUpdatedAt: new Date().toISOString() };
              }
            }
            return c;
          });
          onUpdateContracts(updatedContracts);
        }
      }
    }
    const updated = salesOrders.map((o) => (o.id === orderId ? { ...o, status: newStatus, updatedAt: new Date().toISOString() } : o));
    onUpdateSalesOrders(updated);
  };

  const handleSaveInvoice = async (savedInvoice: SalesInvoiceRecord, _updatedSalesOrder?: SalesOrderRecord) => {
    unmarkSalesInvoiceAsDeleted(savedInvoice.id, savedInvoice.invoiceNumber, savedInvoice.salesOrderId);

    // Accumulate invoices: never drop previously registered partial invoices.
    const updatedInvoices: SalesInvoiceRecord[] = [
      savedInvoice,
      ...salesInvoices.filter(
        (i) => i.id !== savedInvoice.id && i.invoiceNumber !== savedInvoice.invoiceNumber
      ),
    ];
    onUpdateSalesInvoices(updatedInvoices);

    try {
      await saveSingleSalesInvoiceToFirestore(savedInvoice);
    } catch (e) {
      console.error('Error saving invoice to Firestore:', e);
    }

    const targetOrder =
      (savedInvoice.salesOrderId && salesOrders.find((o) => o.id === savedInvoice.salesOrderId)) ||
      (savedInvoice.salesOrderNumber &&
        salesOrders.find(
          (o) => cleanRef(o.salesOrderNumber) === cleanRef(savedInvoice.salesOrderNumber!)
        )) ||
      undefined;

    if (!targetOrder) return;

    const invData = computeOrderInvoicingData(targetOrder, updatedInvoices);
    const updatedSO: SalesOrderRecord = {
      ...targetOrder,
      invoiceNumber: invData.invoiceNumbers || targetOrder.invoiceNumber,
      invoiceId: invData.orderInvoices[0]?.id || targetOrder.invoiceId,
      invoiceIds: invData.orderInvoices.map((i) => i.id),
      invoiceDate: savedInvoice.issueDate || targetOrder.invoiceDate,
      totalInvoicedCOP: invData.totalInvoicedCOP,
      attachedInvoiceFile: savedInvoice.attachedInvoiceFile || targetOrder.attachedInvoiceFile,
      invoicedStatus: invData.isFullyInvoiced
        ? 'Facturada Total'
        : invData.totalInvoicedCOP > 0
        ? 'Facturada Parcial'
        : 'No Facturada',
      status:
        invData.isFullyInvoiced && targetOrder.status !== 'Cancelada'
          ? 'Facturada'
          : targetOrder.status,
      updatedAt: new Date().toISOString(),
    };

    await handleSaveOrder(updatedSO);

    // Invoice numbers per equipment: only items actually covered by an invoice.
    const coveredItemInvoiceMap = new Map<string, string[]>();
    updatedInvoices.forEach((inv) => {
      (inv.items || []).forEach((alloc) => {
        if (!alloc || !alloc.salesOrderItemId) return;
        const list = coveredItemInvoiceMap.get(alloc.salesOrderItemId) || [];
        if (inv.invoiceNumber) list.push(inv.invoiceNumber);
        coveredItemInvoiceMap.set(alloc.salesOrderItemId, list);
      });
    });

    // Auto-archive the linked tender only when every unit is invoiced AND delivered.
    const targetTenderId = updatedSO.tenderClientId || updatedSO.contractId;
    const matchedTender = (tenderClients || []).find((t) => {
      if (targetTenderId && t.id === targetTenderId) return true;
      if (updatedSO.contractNumber && t.header?.processNumber && normalizeClean(t.header.processNumber).includes(normalizeClean(updatedSO.contractNumber))) return true;
      if (updatedSO.salesOrderNumber && t.header?.processNumber && normalizeClean(t.header.processNumber).includes(normalizeClean(updatedSO.salesOrderNumber))) return true;
      if (updatedSO.clientName && t.clientName && (
        normalizeClean(t.clientName) === normalizeClean(updatedSO.clientName) ||
        normalizeClean(t.clientName).includes(normalizeClean(updatedSO.clientName)) ||
        normalizeClean(updatedSO.clientName).includes(normalizeClean(t.clientName))
      )) return true;
      return false;
    });

    if (matchedTender && onUpdateTenderClient) {
      const tenderItems = matchedTender.items || [];
      const allDelivered = tenderItems.length > 0 && tenderItems.every((tIt) => {
        return (contracts || []).some((c) =>
          (c.items || []).some((cIt) => {
            const isMatch = (cIt.equipmentId && tIt.equipmentId && cIt.equipmentId === tIt.equipmentId) ||
              (cIt.code && tIt.code && cIt.code === tIt.code) ||
              (cIt.name && tIt.name && normalizeClean(cIt.name) === normalizeClean(tIt.name));
            return isMatch && (cIt.status === 'Entregado e Instalado' || cIt.status === 'Cerrado / Concluido');
          })
        );
      });

      // Archive the tender/OC directa only when EVERY linked OV is fully invoiced.
      const normProcess = normalizeClean(matchedTender.header?.processNumber || '');
      const linkedTenderOrders = salesOrders.filter((so) => {
        if (so.id === updatedSO.id) return true;
        if (so.tenderClientId && so.tenderClientId === matchedTender.id) return true;
        if (so.contractId && so.contractId === matchedTender.id) return true;
        if (normProcess) {
          const refs = [so.contractNumber, so.salesOrderNumber]
            .map((r) => normalizeClean(r || ''))
            .filter((r) => r.length >= 3);
          if (refs.some((r) => r.includes(normProcess) || normProcess.includes(r))) return true;
        }
        return false;
      });
      const allOrdersInvoiced =
        linkedTenderOrders.length > 0 &&
        linkedTenderOrders.every((so) => computeOrderInvoicingData(so, updatedInvoices).isFullyInvoiced);

      if (allDelivered && allOrdersInvoiced) {
        onUpdateTenderClient(matchedTender.id, { status: 'Cumplido / Archivado' });
      }
    }

    if (onUpdateContracts && contracts && contracts.length > 0) {
      const normSO = normalizeClean(updatedSO.salesOrderNumber);

      const updatedContracts = contracts.map((c) => {
        const isMatch =
          (updatedSO.ocContractId && c.id === updatedSO.ocContractId) ||
          c.salesOrderId === updatedSO.id ||
          (normSO && c.salesOrderNumber && normalizeClean(c.salesOrderNumber) === normSO);

        if (isMatch) {
          // Associate invoiceNumber only with the equipment actually invoiced.
          const updatedItems = (c.items || []).map((it) => {
            const matchingSOItem = (updatedSO.items || []).find(
              (sIt) =>
                (it.salesOrderItemId && sIt.id === it.salesOrderItemId) ||
                sIt.code === it.code ||
                sIt.name === it.name ||
                (sIt.equipmentId && sIt.equipmentId === it.equipmentId)
            );
            if (!matchingSOItem) return it;

            const itemInvoices = coveredItemInvoiceMap.get(matchingSOItem.id);
            let invoiceNumber: string | undefined = it.invoiceNumber;
            if (itemInvoices && itemInvoices.length > 0) {
              invoiceNumber = Array.from(new Set(itemInvoices)).join(', ');
            } else if (invData.isFullyInvoiced && !invData.hasItemLevelInvoices) {
              invoiceNumber = invData.invoiceNumbers || it.invoiceNumber;
            }
            return { ...it, invoiceNumber };
          });

          const allDelivered = updatedItems.length > 0 && updatedItems.every(
            (it) => it.status === 'Entregado e Instalado' || it.status === 'Cerrado / Concluido'
          );
          const linkedContractOrders = salesOrders.filter((so) => {
            if (so.id === updatedSO.id) return true;
            if (so.ocContractId && so.ocContractId === c.id) return true;
            if (so.id && (c.salesOrderIds || []).includes(so.id)) return true;
            if (so.id && c.salesOrderId === so.id) return true;
            if (normSO && c.salesOrderNumber && normalizeClean(c.salesOrderNumber) === normSO) return true;
            return false;
          });
          const allContractOrdersInvoiced =
            linkedContractOrders.length > 0 &&
            linkedContractOrders.every((so) => computeOrderInvoicingData(so, updatedInvoices).isFullyInvoiced);
          return {
            ...c,
            globalStatus:
              allDelivered && allContractOrdersInvoiced ? ('Cerrado / Concluido' as any) : c.globalStatus,
            items: updatedItems,
            lastUpdatedAt: new Date().toISOString(),
          };
        }
        return c;
      });
      onUpdateContracts(updatedContracts);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    const invoiceToDelete = salesInvoices.find((i) => i.id === invoiceId);
    markSalesInvoiceAsDeleted(invoiceId, invoiceToDelete?.invoiceNumber, invoiceToDelete?.salesOrderId);
    const updated = salesInvoices.filter((i) => i.id !== invoiceId);

    onUpdateSalesInvoices(updated);
    try {
      await deleteSalesInvoiceFromFirestore(invoiceId, invoiceToDelete?.invoiceNumber, invoiceToDelete?.salesOrderId);
    } catch (e) {
      console.error('Error deleting sales invoice from Firestore:', e);
    }

    // If invoice was linked to an OV, recalculate order's invoice state
    if (invoiceToDelete?.salesOrderId) {
      const so = salesOrders.find((o) => o.id === invoiceToDelete.salesOrderId);
      if (so) {
        const invData = computeOrderInvoicingData(so, updated);
        const updatedSO: SalesOrderRecord = {
          ...so,
          invoiceNumber: invData.invoiceNumbers || undefined,
          invoiceId: invData.orderInvoices[0]?.id || undefined,
          invoiceIds: invData.orderInvoices.map((i) => i.id),
          totalInvoicedCOP: invData.totalInvoicedCOP,
          invoicedStatus: invData.isFullyInvoiced
            ? 'Facturada Total'
            : invData.totalInvoicedCOP > 0
            ? 'Facturada Parcial'
            : 'No Facturada',
          status:
            invData.isFullyInvoiced
              ? 'Facturada'
              : so.status === 'Facturada'
              ? 'Entregada al Cliente'
              : so.status,
          updatedAt: new Date().toISOString(),
        };
        await handleSaveOrder(updatedSO);
      }
    }
  };

  const handleUpdateInvoicePaymentStatus = async (invoiceId: string, newStatus: string) => {
    const updated = salesInvoices.map((inv) =>
      inv.id === invoiceId
        ? { ...inv, paymentStatus: newStatus as any, updatedAt: new Date().toISOString() }
        : inv
    );
    onUpdateSalesInvoices(updated);
    try {
      localStorage.setItem('syd_sales_invoices_v1', JSON.stringify(updated));
    } catch (_) {}

    const targetInv = updated.find((i) => i.id === invoiceId);
    if (targetInv) {
      try {
        await saveSingleSalesInvoiceToFirestore(targetInv);
      } catch (e) {
        console.warn('Error updating invoice payment status in Firestore:', e);
      }
    }
  };

  // Helper for status badge
  const getStatusBadge = (st: SalesOrderStatus) => {
    switch (st) {
      case 'Borrador':
        return 'bg-slate-700 text-slate-200 border-slate-600';
      case 'En Proceso':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'Equipos en Bodega':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Entregada al Cliente':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'Listo para Facturar':
        return 'bg-purple-500/25 text-purple-300 border-purple-500/40 font-bold';
      case 'Facturada':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 font-bold';
      case 'Cancelada':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      default:
        return 'bg-slate-700 text-slate-200 border-slate-600';
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--syd-card-bg)] border border-[var(--syd-border-color)] shadow-xl flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 transition-colors">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[var(--syd-accent-glow)] border border-[var(--syd-accent)] text-[var(--syd-accent)] shrink-0">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-[var(--syd-text-primary,#ffffff)] tracking-tight flex items-center gap-2">
                Órdenes de Venta (OV) y Facturación
              </h1>
              <p className="text-xs text-[var(--syd-text-secondary,#94a3b8)] truncate max-w-md">
                Pedidos de licitaciones, cotizaciones y venta directa
              </p>
            </div>
          </div>
        </div>

        <div className="view-toolbar view-toolbar--inline">
        <div className="view-toolbar-group">
          <button
            type="button"
            onClick={toggleKpiMinimized}
            className="px-3 py-2 bg-[var(--syd-sidebar-bg)] hover:bg-[var(--syd-card-hover)] text-[var(--syd-text-primary,#ffffff)] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border border-[var(--syd-border-color)] cursor-pointer"
            title={isKpiMinimized ? 'Expandir panel de resumen numérico' : 'Minimizar panel de resumen numérico'}
          >
            {isKpiMinimized ? (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-[var(--syd-accent)]" />
                <span>Mostrar Resumen ({totalOrdersCount} OVs)</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-[var(--syd-text-secondary,#94a3b8)]" />
                <span>Minimizar Resumen</span>
              </>
            )}
          </button>

          {/* Single primary button: Nueva Orden de Venta */}
          {!isReadOnly ? (
            <>
            <button
              type="button"
              onClick={() => {
                const target = deduplicatedSalesOrders.find((o) => {
                  if ((o.items?.length || 0) === 0) return false;
                  if (o.status === 'Facturada' || o.invoicedStatus === 'Facturada Total') return false;
                  const inv = computeOrderInvoicingData(o, salesInvoices);
                  return !inv.isFullyInvoiced;
                }) || null;
                setSplitOrderModalTarget(target);
              }}
              className="px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40"
              title="Dividir o Renovar Orden de Venta (OV) y Órdenes de Compra (OCs) por vencimiento de tiempo o equipos pendientes"
            >
              <GitFork className="w-4 h-4 text-purple-400" />
              <span>Dividir / Renovar OV y OCs</span>
            </button>
            <button
              onClick={() => {
                setEditingOrder(null);
                setQuoteToConvert(null);
                setTenderToConvert(null);
                setIsNewOrderModalOpen(true);
              }}
              style={{
                backgroundColor: 'var(--syd-btn-bg, var(--syd-accent))',
                color: 'var(--syd-btn-text, #0f172a)',
                borderRadius: 'var(--syd-btn-radius, 14px)',
                borderColor: 'var(--syd-btn-bg, var(--syd-accent))',
              }}
              className="px-3.5 py-2 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer active:scale-95 border"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Orden de Venta</span>
            </button>
            </>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-semibold">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Modo Lectura</span>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Main Subtabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveSubTab('orders')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'orders'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            Órdenes de Venta (OV) ({deduplicatedSalesOrders.length})
          </button>

          <button
            onClick={() => setActiveSubTab('invoices')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'invoices'
                ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <ReceiptText className="w-4 h-4" />
            Facturación al Cliente ({salesInvoices.length})
          </button>

          <button
            onClick={() => setActiveSubTab('traceability')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              activeSubTab === 'traceability'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800'
            }`}
          >
            <GitMerge className="w-4 h-4" />
            Trazabilidad entre Ventanas
          </button>
        </div>
      </div>

      {/* SUBTAB 1: Órdenes de Venta (OV) */}
      {activeSubTab === 'orders' && (
        <div className="space-y-4">
          {/* Sticky Controls Container: Lifecycle Filter + Search & Filter bar */}
          <div className="sticky top-0 z-20 bg-[var(--syd-card-bg)]/95 backdrop-blur-md border border-[var(--syd-border-color)] rounded-2xl px-3 py-2.5 space-y-2.5 shadow-lg">
            {/* Lifecycle Filter: Activas vs Culminadas/Facturadas vs Todas las OVs (Permite activar/inactivar individualmente) */}
            <div className="view-toolbar">
              <div className="view-toolbar-group" data-label="Órdenes">
                <button
                  type="button"
                  onClick={() => setShowActiveOrders((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    showActiveOrders
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
                  }`}
                  title="Clic para activar o inactivar órdenes activas individualmente"
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  <span>OVs Activas / En Proceso ({activeOrdersCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowArchivedOrders((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    showArchivedOrders
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/60'
                  }`}
                  title="Clic para activar o inactivar órdenes culminadas / facturadas individualmente"
                >
                  <ReceiptText className="w-3.5 h-3.5" />
                  <span>OVs Culminadas / Facturadas ({archivedOrdersCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowActiveOrders(true);
                    setShowArchivedOrders(true);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    showActiveOrders && showArchivedOrders
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                  title="Activar ambas opciones para ver todas las OVs"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Todas las OVs ({deduplicatedSalesOrders.length})</span>
                </button>
              </div>

              <div className="view-toolbar-note" data-label="Mostrando">
                {showActiveOrders && showArchivedOrders
                  ? 'Todas las OVs (activas y culminadas)'
                  : showActiveOrders
                  ? 'Solo órdenes activas'
                  : showArchivedOrders
                  ? 'Solo culminadas / facturadas'
                  : 'Sin filtros: no se muestra ninguna'}
              </div>
            </div>

          {/* Search & Filter bar */}
          <div className="view-toolbar">
            <div className="view-toolbar-group">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={orderSearchText}
                onChange={(e) => setOrderSearchText(e.target.value)}
                placeholder="Buscar por N° OV, cotización, licitación, cliente o equipo..."
                className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
              />
            </div>
            </div>

            <div className="view-toolbar-group" data-label="Filtros y vista">
              {/* Origin filter */}
              <span className="text-xs text-slate-400 font-medium">Origen:</span>
              <select
                value={orderOriginFilter}
                onChange={(e) => setOrderOriginFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="all">Todos los Orígenes ({deduplicatedSalesOrders.length})</option>
                <option value="tender">🏛️ Licitación Adjudicada</option>
                <option value="quote">📄 Desde Cotización</option>
                <option value="direct">🛒 Venta Directa</option>
              </select>

              <span className="text-xs text-slate-400 font-medium">Estado:</span>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="all">Todos los Estados</option>
                <option value="Borrador">Borrador</option>
                <option value="En Proceso">En Proceso</option>
                <option value="Equipos en Bodega">Equipos en Bodega</option>
                <option value="Entregada al Cliente">Entregada al Cliente</option>
                <option value="Facturada">Facturada</option>
                <option value="Cancelada">Cancelada</option>
              </select>

              {/* View Mode Toggle: Clients (Grouped Accordion) vs List (Table) vs Grid */}
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setOrdersViewMode('clients')}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                    ordersViewMode === 'clients'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Vista Agrupada por Cliente con Acordeón Plegable"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Por Cliente (Plegable)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrdersViewMode('list')}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    ordersViewMode === 'list'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Vista en Lista / Tabla Plana (Excel)"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setOrdersViewMode('grid')}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    ordersViewMode === 'grid'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Vista en Cuadrícula"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
          </div>

          {/* Orders Empty State */}
          {filteredOrders.length === 0 ? (
            <div className="py-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl">
              <PackageCheck className="w-12 h-12 text-slate-500 mx-auto mb-2 opacity-50" />
              <h3 className="text-sm font-bold text-white mb-1">No hay Órdenes de Venta que coincidan</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {!showActiveOrders && !showArchivedOrders
                  ? 'Has inactivado ambos filtros individualmente. Activa "OVs Activas" o "OVs Culminadas / Facturadas" para visualizar pedidos.'
                  : showActiveOrders && !showArchivedOrders
                  ? 'No hay Órdenes de Venta activas en este momento. Puedes activar las órdenes culminadas / facturadas para consultar el histórico.'
                  : !showActiveOrders && showArchivedOrders
                  ? 'No hay Órdenes de Venta culminadas o facturadas con el criterio actual.'
                  : 'Las OVs de licitaciones adjudicadas y cotizaciones se generan automáticamente aquí, o puedes crear una OV de venta directa usando el botón superior "Nueva Orden de Venta".'}
              </p>
            </div>
          ) : ordersViewMode === 'clients' ? (
            /* CLIENT ACCORDION VIEW (Grouped by Customer with Collapsible Card) */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-slate-400 px-1">
                <span>
                  Mostrando <strong className="text-white">{groupedClientsOrders.length}</strong> {groupedClientsOrders.length === 1 ? 'cliente' : 'clientes'} con <strong className="text-amber-400">{filteredOrders.length}</strong> {filteredOrders.length === 1 ? 'Orden de Venta' : 'Órdenes de Venta'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={expandAllClients}
                    className="hover:text-amber-300 transition text-[11px] font-bold cursor-pointer"
                  >
                    Desplegar Todos
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => collapseAllClients(groupedClientsOrders.map((g) => g.clientKey))}
                    className="hover:text-amber-300 transition text-[11px] font-bold cursor-pointer"
                  >
                    Plegar Todos
                  </button>
                </div>
              </div>

              {groupedClientsOrders.map((clientGroup) => {
                const isCollapsed = collapsedClientKeys.has(clientGroup.clientKey);

                return (
                  <div
                    key={clientGroup.clientKey}
                    className="bg-[var(--syd-card-bg)] border border-[var(--syd-border-color)] rounded-2xl shadow-xl overflow-hidden transition-all hover:border-[var(--syd-accent)]"
                  >
                    {/* CLIENT ACCORDION HEADER (Cuadro grande del cliente) */}
                    <div
                      onClick={() => toggleClientCollapse(clientGroup.clientKey)}
                      className="p-3.5 sm:p-4 bg-[var(--syd-sidebar-bg)] border-b border-[var(--syd-border-color)] flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-[var(--syd-card-hover)] transition-colors select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          className="p-1 rounded-lg bg-[var(--syd-card-bg)] hover:bg-[var(--syd-card-hover)] text-[var(--syd-text-secondary)] hover:text-[var(--syd-text-primary)] border border-[var(--syd-border-color)] transition cursor-pointer"
                          title={isCollapsed ? 'Desplegar OVs del cliente' : 'Plegar OVs del cliente'}
                        >
                          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                        </button>

                        <div className="p-2 rounded-xl bg-[var(--syd-accent-glow)] border border-[var(--syd-accent)] text-[var(--syd-accent)] shrink-0">
                          <Building2 className="w-5 h-5" />
                        </div>

                        <div className="min-w-0 space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-black text-[var(--syd-text-primary,#ffffff)] truncate hover:text-[var(--syd-accent)] transition">
                              {clientGroup.clientName}
                            </h3>
                            {clientGroup.clientNit && (
                              <span className="text-[11px] text-[var(--syd-text-secondary)] font-mono bg-[var(--syd-card-bg)] px-2 py-0.5 rounded border border-[var(--syd-border-color)]">
                                NIT: {clientGroup.clientNit}
                              </span>
                            )}
                            {clientGroup.clientCity && (
                              <span className="text-[11px] text-[var(--syd-text-secondary)] font-medium flex items-center gap-1 bg-[var(--syd-card-bg)] px-2 py-0.5 rounded border border-[var(--syd-border-color)]">
                                <MapPin className="w-3 h-3 text-rose-400" />
                                {clientGroup.clientCity}
                              </span>
                            )}
                          </div>
                          {clientGroup.clientContactPerson && (
                            <p className="text-[11px] text-[var(--syd-text-secondary,#94a3b8)] truncate">
                              Contacto: <strong className="text-[var(--syd-text-primary,#ffffff)]">{clientGroup.clientContactPerson}</strong> {clientGroup.clientContactPhone ? `(${clientGroup.clientContactPhone})` : ''}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Header KPIs on Client Card */}
                      <div className="flex items-center gap-2 flex-wrap sm:ml-auto">
                        <span className="px-2.5 py-1 rounded-lg bg-[var(--syd-accent-glow)] border border-[var(--syd-accent)] text-[var(--syd-accent)] text-xs font-bold">
                          {clientGroup.orders.length} {clientGroup.orders.length === 1 ? 'Orden de Venta' : 'Órdenes de Venta'} ({clientGroup.totalItems} eq.)
                        </span>

                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-bold">
                          Total: {formatCOP(clientGroup.totalCOP)}
                        </span>

                        {clientGroup.isFullyInvoiced ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-black">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Facturado 100%
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold">
                            Facturado: {formatCOP(clientGroup.totalInvoicedCOP)}
                          </span>
                        )}

                        <span className="text-[var(--syd-text-secondary)] text-xs font-semibold hover:text-[var(--syd-text-primary)] transition flex items-center gap-1">
                          {isCollapsed ? 'Desplegar' : 'Plegar'}
                        </span>
                      </div>
                    </div>

                    {/* CLIENT ACCORDION BODY (Contenido de las OVs del cliente) */}
                    {!isCollapsed && (
                      <div className="p-3 sm:p-4 space-y-3 bg-slate-950/40">
                        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/90 shadow-inner">
                          <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-950/90 text-[11px] font-bold text-slate-300 border-b border-slate-800">
                              <tr>
                                <th className="py-2.5 px-3 min-w-[140px]">N° OV / Origen</th>
                                <th className="py-2.5 px-3 min-w-[240px]">
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span>Equipos & N° OC / Logística</span>
                                    {clientGroup.orders.some((o) => (o.items?.length || 0) > 2) && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const orderIds = clientGroup.orders.map((o) => o.id);
                                          const allExpanded = orderIds.every((id) => expandedOrderEquipments.has(id));
                                          if (allExpanded) {
                                            collapseAllOrderEquipments(orderIds);
                                          } else {
                                            expandAllOrderEquipments(orderIds);
                                          }
                                        }}
                                        className="text-[9.5px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition font-medium cursor-pointer flex items-center gap-1 border border-slate-700/60"
                                        title="Alternar plegar/desplegar equipos de todas las órdenes de este cliente"
                                      >
                                        <ChevronsUpDown className="w-2.5 h-2.5 text-amber-400" />
                                        <span>{clientGroup.orders.every((o) => expandedOrderEquipments.has(o.id)) ? 'Plegar todos' : 'Desplegar todos'}</span>
                                      </button>
                                    )}
                                  </div>
                                </th>
                                <th className="py-2.5 px-3 min-w-[130px] text-right">Monto Total COP</th>
                                <th className="py-2.5 px-3 min-w-[130px]">Seguimiento OC</th>
                                <th className="py-2.5 px-3 min-w-[170px]">Facturación & Soporte</th>
                                <th className="py-2.5 px-3 text-right min-w-[110px]">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                              {clientGroup.orders.map((order) => {
                                const { isDelivered, reason } = isOrderEquipmentDeliveredInOC(order);
                                const canInvoice = isDelivered;
                                const originInfo = getOrderOriginInfo(order);
                                const OriginIcon = originInfo.icon;
                                const invData = getOrderInvoicingData(order);

                                return (
                                  <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                                    {/* N° OV & Origen */}
                                    <td className="py-3 px-3">
                                      {editingOVNumberId === order.id ? (
                                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                          <input
                                            type="text"
                                            autoFocus
                                            value={editingOVNumberValue}
                                            onChange={(e) => setEditingOVNumberValue(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') handleSaveOVNumber(order.id, e);
                                              if (e.key === 'Escape') handleCancelEditOVNumber();
                                            }}
                                            placeholder="N° OV..."
                                            className="px-2 py-0.5 bg-slate-950 border-2 border-amber-400 rounded text-xs font-mono font-bold text-amber-300 outline-none w-28"
                                          />
                                          <button
                                            type="button"
                                            onClick={(e) => handleSaveOVNumber(order.id, e)}
                                            className="p-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer"
                                            title="Guardar"
                                          >
                                            <Check className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => handleCancelEditOVNumber(e)}
                                            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                                            title="Cancelar"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1.5 group/ov">
                                          <span className="font-mono font-bold text-amber-400 text-sm">
                                            {order.salesOrderNumber || (
                                              <span className="text-slate-500 font-normal italic text-xs">[Sin N° OV]</span>
                                            )}
                                          </span>
                                          {!isReadOnly && (
                                            <button
                                              type="button"
                                              onClick={(e) => handleStartEditOVNumber(order, e)}
                                              className="opacity-70 group-hover/ov:opacity-100 p-0.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded transition cursor-pointer"
                                              title="Editar N° de OV"
                                            >
                                              <Edit2 className="w-3 h-3" />
                                            </button>
                                          )}
                                        </div>
                                      )}
                                      <span className={`inline-flex items-center gap-1 text-[9.5px] font-bold px-2 py-0.5 rounded border mt-1 ${originInfo.badgeClass}`}>
                                        <OriginIcon className="w-3 h-3" />
                                        {originInfo.label}
                                      </span>
                                      <span className="text-[10px] text-slate-400 block mt-0.5 truncate max-w-[160px]">
                                        {originInfo.detail}
                                      </span>
                                    </td>

                                    {/* Equipos, OC, Status (Harmonious, Compact & Single Toggle) */}
                                    <td className="py-2.5 px-3 align-top min-w-[240px]">
                                      {(() => {
                                        const isExpanded = expandedOrderEquipments.has(order.id);
                                        const itemsCount = order.items?.length || 0;
                                        const totalUnits = order.items?.reduce((acc, it) => acc + (it.quantityToDispatch || 1), 0) || 0;
                                        const visibleItems = isExpanded || itemsCount <= 2 ? (order.items || []) : (order.items || []).slice(0, 2);
                                        const hasMore = itemsCount > 2;

                                        return (
                                          <div className="space-y-1.5">
                                            {/* Header: Item & units counter + Single Toggle button */}
                                            <div className="flex items-center justify-between gap-1.5">
                                              <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-slate-100 text-xs">
                                                  {itemsCount} {itemsCount === 1 ? 'equipo' : 'equipos'}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.2 rounded-full bg-slate-800/80 border border-slate-700/60">
                                                  {totalUnits} uds
                                                </span>
                                              </div>

                                              {hasMore && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => toggleOrderEquipments(order.id, e)}
                                                  className="text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                                  title={isExpanded ? 'Plegar lista de equipos' : `Ver todos los ${itemsCount} equipos`}
                                                >
                                                  {isExpanded ? (
                                                    <>
                                                      <ChevronUp className="w-3 h-3 text-amber-400" />
                                                      <span>Plegar</span>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <ChevronDown className="w-3 h-3 text-amber-400" />
                                                      <span>Ver todos ({itemsCount})</span>
                                                    </>
                                                  )}
                                                </button>
                                              )}
                                            </div>

                                            {/* Harmonious Equipment List */}
                                            <div className={`space-y-1 max-w-sm ${isExpanded && itemsCount > 4 ? 'max-h-56 overflow-y-auto pr-1' : ''}`}>
                                              {visibleItems.map((it, itIdx) => {
                                                const statusMeta = resolveItemStatusAndBadge(order, it);
                                                const hasOC = Boolean(statusMeta.ocNumber);
                                                return (
                                                  <div
                                                    key={it.id || itIdx}
                                                    className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80 transition-colors text-[11px]"
                                                  >
                                                    <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400/80 shrink-0" />
                                                      <span className="font-medium text-slate-200 truncate" title={it.name}>
                                                        {it.name}
                                                      </span>
                                                      {it.code && (
                                                        <span className="text-[9px] font-mono text-cyan-300/80 bg-slate-900 px-1 py-0.2 rounded border border-slate-800 shrink-0">
                                                          {it.code}
                                                        </span>
                                                      )}
                                                    </div>

                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                      <span className="font-mono text-emerald-400 font-bold text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20">
                                                        x{it.quantityToDispatch}
                                                      </span>

                                                      {hasOC ? (
                                                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                                                          OC: {statusMeta.ocNumber}
                                                        </span>
                                                      ) : (
                                                        <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300/90 border border-amber-500/20">
                                                          Pend. OC
                                                        </span>
                                                      )}
                                                      {it.assignedSerialNumbers && it.assignedSerialNumbers.length > 0 && (
                                                        <span
                                                          className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700"
                                                          title={`S/N: ${it.assignedSerialNumbers.join(', ')}`}
                                                        >
                                                          S/N
                                                        </span>
                                                      )}
                                                    </div>
                                                  </div>
                                                );
                                              })}

                                              {/* Subtle link when collapsed with more items */}
                                              {hasMore && !isExpanded && (
                                                <button
                                                  type="button"
                                                  onClick={(e) => toggleOrderEquipments(order.id, e)}
                                                  className="w-full text-center text-[10px] font-medium text-amber-400/90 hover:text-amber-300 py-0.5 hover:underline transition cursor-pointer"
                                                >
                                                  +{itemsCount - 2} equipos más • Ver todos
                                                </button>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })()}
                                    </td>

                                    {/* Monto Total */}
                                    <td className="py-3 px-3 font-mono font-bold text-emerald-400 text-right text-xs">
                                      {formatCOP(order.totalValueCOP)}
                                    </td>

                                    {/* Seguimiento OC */}
                                    <td className="py-3 px-3">
                                      {order.hasLinkedOC ? (
                                        <button
                                          type="button"
                                          onClick={() => onNavigateToTab?.('seguimiento_oc')}
                                          className="inline-flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold cursor-pointer transition"
                                          title="Ver en Seguimiento de OC"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> OC Activa
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (onGenerateOCTracking) {
                                              onGenerateOCTracking(order);
                                            } else {
                                              if (onUpdateContracts && (order.items || []).length > 0) {
                                                const newContract = createOCTrackingContractFromSalesOrder(order, equipments);
                                                const updated = [newContract, ...contracts.filter((c) => c.id !== newContract.id)];
                                                onUpdateContracts(updated);
                                                saveStoredOCTrackingContracts(updated);
                                              }
                                              onNavigateToTab?.('seguimiento_oc');
                                            }
                                          }}
                                          className="inline-flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 font-bold border border-sky-500/30 cursor-pointer"
                                        >
                                          <ShoppingCart className="w-3 h-3 text-sky-400" /> Ver OC
                                        </button>
                                      )}
                                    </td>

                                    {/* Facturación & Soporte */}
                                    <td className="py-3 px-3">
                                      {(() => {
                                        if (order.status === 'Cancelada') {
                                          return <span className="text-[10px] text-slate-500">Cancelada</span>;
                                        }
                                        if (invData.isFullyInvoiced || order.status === 'Facturada') {
                                          return (
                                            <span
                                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-xs"
                                              title={`Facturación Completa: ${invData.invoiceNumbers || 'Facturada'}`}
                                            >
                                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                              <span>Facturada{invData.invoiceNumbers ? ` (${invData.invoiceNumbers})` : ''}</span>
                                            </span>
                                          );
                                        }
                                        const isInvoiceEnabled = isDelivered;
                                        if (invData.invoiceCount > 0) {
                                          return (
                                            <div className="flex flex-col gap-1 items-start">
                                              <span
                                                className="inline-flex items-center gap-1 text-[10px] text-purple-300 font-bold bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 rounded"
                                                title={`Facturas registradas: ${invData.invoiceNumbers}`}
                                              >
                                                <ReceiptText className="w-3 h-3 text-purple-400" /> {invData.invoiceNumbers} ({formatCOP(invData.totalInvoicedCOP)})
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (!isInvoiceEnabled) {
                                                    alert(`⛔ BLOQUEO DE FACTURACIÓN:\n\nEste botón se habilita únicamente cuando el estado de los equipos en la ventana de Seguimiento de OC cambie a "Entregado e Instalado".\n\nEstado actual: Aún hay equipos pendientes de entrega e instalación.`);
                                                    return;
                                                  }
                                                  setTargetSalesOrderForInvoice(order);
                                                  setEditingInvoice(null);
                                                  setIsAttachInvoiceModalOpen(true);
                                                }}
                                                className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg font-bold transition shadow-xs ${
                                                  isInvoiceEnabled
                                                    ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer'
                                                    : 'bg-slate-800 text-slate-500 border border-slate-700/60 opacity-60 cursor-not-allowed'
                                                }`}
                                                title={
                                                  isInvoiceEnabled
                                                    ? `Saldo pendiente por facturar: ${formatCOP(invData.remainingToInvoiceCOP)}. Haz clic para registrar otra factura.`
                                                    : 'Bloqueado: se habilita cuando los equipos se cambien a «Entregado e Instalado» en Seguimiento de OC'
                                                }
                                              >
                                                <ReceiptText className="w-3 h-3" /> {isInvoiceEnabled ? `Facturar (${formatCOP(invData.remainingToInvoiceCOP)})` : 'Facturar 🔒'}
                                              </button>
                                            </div>
                                          );
                                        }
                                        return (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (!isInvoiceEnabled) {
                                                alert(`⛔ BLOQUEO DE FACTURACIÓN:\n\nEste botón se habilita únicamente cuando el estado de los equipos en la ventana de Seguimiento de OC cambie a "Entregado e Instalado".\n\nEstado actual: Aún hay equipos pendientes de entrega e instalación.`);
                                                return;
                                              }
                                              setTargetSalesOrderForInvoice(order);
                                              setEditingInvoice(null);
                                              setIsAttachInvoiceModalOpen(true);
                                            }}
                                            className={`inline-flex items-center gap-1 text-[10.5px] px-2 py-0.5 rounded-lg font-bold transition-all shadow-xs ${
                                              isInvoiceEnabled
                                                ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer'
                                                : 'bg-slate-800 text-slate-500 border border-slate-700/60 opacity-60 cursor-not-allowed'
                                            }`}
                                            title={
                                              isInvoiceEnabled
                                                ? 'Registrar factura a esta OV'
                                                : 'Bloqueado: se habilita cuando los equipos se cambien a «Entregado e Instalado» en Seguimiento de OC'
                                            }
                                          >
                                            <ReceiptText className="w-3 h-3" />
                                            {isInvoiceEnabled ? 'Facturar' : 'Facturar 🔒'}
                                          </button>
                                        );
                                      })()}
                                    </td>

                                    {/* Acciones */}
                                    <td className="py-3 px-3 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        {!invData.isFullyInvoiced && order.status !== 'Facturada' && (order.items?.length || 0) > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => setSplitOrderModalTarget(order)}
                                            className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                                            title="Dividir OV / Trasladar equipos demorados a Nueva OV y OC"
                                          >
                                            <GitFork className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setPrintingOrder(order);
                                            setIsPrintModalOpen(true);
                                          }}
                                          className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors cursor-pointer"
                                          title="Imprimir OV"
                                        >
                                          <Printer className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingOrder(order);
                                            setQuoteToConvert(null);
                                            setTenderToConvert(null);
                                            setIsNewOrderModalOpen(true);
                                          }}
                                          className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                                          title="Editar OV"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteOrder(order.id)}
                                          className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                                          title="Eliminar OV"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setViewingOrder(order);
                                            setIsDetailsModalOpen(true);
                                          }}
                                          className="p-1 rounded text-slate-400 hover:text-sky-300 hover:bg-slate-800 transition-colors cursor-pointer"
                                          title="Gestionar OV"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : ordersViewMode === 'grid' ? (
            /* Orders Cards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredOrders.map((order) => {
                const { isDelivered } = isOrderEquipmentDeliveredInOC(order);
                const canInvoice = isDelivered;
                const originInfo = getOrderOriginInfo(order);
                const OriginIcon = originInfo.icon;

                return (
                  <div
                    key={order.id}
                    className="p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 shadow-xl flex flex-col justify-between transition-all group"
                  >
                    <div>
                      {/* Top Row: Origin Badge & Status */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg border ${originInfo.badgeClass}`}>
                          <OriginIcon className="w-3.5 h-3.5" />
                          {originInfo.label}
                        </span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusBadge(order.status)}`}>
                          {order.status}
                        </span>
                      </div>

                      {/* OV Number and Reference with Inline Editing */}
                      <div className="mb-3">
                        {editingOVNumberId === order.id ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              autoFocus
                              value={editingOVNumberValue}
                              onChange={(e) => setEditingOVNumberValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveOVNumber(order.id, e);
                                if (e.key === 'Escape') handleCancelEditOVNumber();
                              }}
                              placeholder="N° OV manual..."
                              className="px-2 py-1 bg-slate-950 border-2 border-amber-400 rounded-lg text-xs font-mono font-bold text-amber-300 outline-none w-36"
                            />
                            <button
                              type="button"
                              onClick={(e) => handleSaveOVNumber(order.id, e)}
                              className="p-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer"
                              title="Guardar N° OV"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleCancelEditOVNumber(e)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                              title="Cancelar"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 group/ov">
                            <span className="text-base font-black text-amber-400 font-mono tracking-tight block">
                              {order.salesOrderNumber || (
                                <span className="text-slate-500 font-normal italic text-xs">[Sin N° de OV Asignado]</span>
                              )}
                            </span>
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={(e) => handleStartEditOVNumber(order, e)}
                                className="opacity-70 group-hover/ov:opacity-100 p-1 text-slate-400 hover:text-amber-300 hover:bg-slate-800/80 rounded transition cursor-pointer"
                                title="Asignar o editar N° de OV manualmente"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                        <span className="text-[11px] text-slate-300 font-medium flex items-center gap-1 mt-0.5">
                          {originInfo.detail}
                        </span>
                        {originInfo.subDetail && (
                          <span className="text-[10px] text-sky-400 font-mono block">
                            {originInfo.subDetail}
                          </span>
                        )}
                      </div>

                      {/* Client & Value */}
                      <div className="space-y-1 mb-3">
                        <h4 className="text-sm font-bold text-white line-clamp-1">{order.clientName}</h4>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>{order.clientCity || 'Colombia'}</span>
                          <span className="text-sm font-black text-emerald-400">{formatCOP(order.totalValueCOP)}</span>
                        </div>
                      </div>

                      {/* Equipment summary preview with Serials, Status and OC */}
                      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-3 space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Equipos ({order.items?.length || 0})
                        </span>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                          {order.items?.map((it, idx) => (
                            <div key={idx} className="p-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs space-y-1">
                              <div className="flex items-center justify-between text-slate-200">
                                <span className="truncate pr-1 font-medium">• {it.name}</span>
                                <span className="text-[11px] font-bold text-emerald-400 shrink-0">x{it.quantityToDispatch}</span>
                              </div>
                              <div className="flex items-center gap-1 flex-wrap text-[9.5px]">
                                {(() => {
                                  const statusMeta = resolveItemStatusAndBadge(order, it);
                                  return (
                                    <>
                                      {(it.linkedSupplierOCNumber || it.supplierOCRef) ? (
                                        <>
                                          <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 font-mono font-bold">
                                            OC: {it.linkedSupplierOCNumber || it.supplierOCRef}
                                          </span>
                                          {statusMeta.status !== 'Pendiente de OC' && (
                                            <span className={`px-1.5 py-0.5 rounded border ${statusMeta.badgeClass}`}>
                                              {statusMeta.status}
                                            </span>
                                          )}
                                        </>
                                      ) : (
                                        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
                                          Pendiente de OC
                                        </span>
                                      )}
                                      {it.assignedSerialNumbers && it.assignedSerialNumbers.length > 0 && (
                                        <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono font-bold" title={it.assignedSerialNumbers.join(', ')}>
                                          S/N: {it.assignedSerialNumbers.join(', ')}
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Quick badges for OC and Invoice */}
                      <div className="flex flex-wrap items-center gap-2 mb-4">
                        {order.hasLinkedOC ? (
                          <button
                            type="button"
                            onClick={() => onNavigateToTab?.('seguimiento_oc')}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold transition cursor-pointer"
                            title="Ver en Seguimiento de OC"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> OC Proveedores Activa
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onGenerateOCTracking?.(order)}
                            className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30 font-bold transition-all shadow-xs cursor-pointer"
                          >
                            <ShoppingCart className="w-3 h-3 text-sky-400" /> Ver OC en Seguimiento
                          </button>
                        )}

                        {(() => {
                          const invData = getOrderInvoicingData(order);
                          if (order.status === 'Cancelada') {
                            return <span className="text-[11px] text-slate-500">Orden Cancelada</span>;
                          }
                          if (invData.isFullyInvoiced || order.status === 'Facturada') {
                            return (
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                title={`Facturación Completa: ${invData.invoiceNumbers || 'Facturada'}`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>Facturada{invData.invoiceNumbers ? ` (${invData.invoiceNumbers})` : ''}</span>
                              </span>
                            );
                          }
                          const isInvoiceEnabled = isDelivered;
                          if (invData.invoiceCount > 0) {
                            return (
                              <div className="flex flex-col gap-1 items-start">
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30 font-bold"
                                  title={`Facturas registradas: ${invData.invoiceNumbers}`}
                                >
                                  <ReceiptText className="w-3 h-3 text-purple-400" /> {invData.invoiceNumbers} ({formatCOP(invData.totalInvoicedCOP)})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!isInvoiceEnabled) {
                                      alert(`⛔ BLOQUEO DE FACTURACIÓN:\n\nEste botón se habilita únicamente cuando el estado de los equipos en la ventana de Seguimiento de OC cambie a "Entregado e Instalado".\n\nEstado actual: Aún hay equipos pendientes de entrega e instalación.`);
                                      return;
                                    }
                                    setTargetSalesOrderForInvoice(order);
                                    setEditingInvoice(null);
                                    setIsAttachInvoiceModalOpen(true);
                                  }}
                                  className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-bold transition-all shadow-xs ${
                                    isInvoiceEnabled
                                      ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer'
                                      : 'bg-slate-800 text-slate-500 border border-slate-700/60 opacity-60 cursor-not-allowed'
                                  }`}
                                  title={
                                    isInvoiceEnabled
                                      ? `Saldo pendiente por facturar: ${formatCOP(invData.remainingToInvoiceCOP)}. Haz clic para registrar otra factura.`
                                      : 'Bloqueado: se habilita cuando los equipos se cambien a «Entregado e Instalado» en Seguimiento de OC'
                                  }
                                >
                                  <ReceiptText className="w-3 h-3" /> {isInvoiceEnabled ? `Facturar (${formatCOP(invData.remainingToInvoiceCOP)} restante)` : 'Facturar 🔒'}
                                </button>
                              </div>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                if (!isInvoiceEnabled) {
                                  alert(`⛔ BLOQUEO DE FACTURACIÓN:\n\nEste botón se habilita únicamente cuando el estado de los equipos en la ventana de Seguimiento de OC cambie a "Entregado e Instalado".\n\nEstado actual: Aún hay equipos pendientes de entrega e instalación.`);
                                  return;
                                }
                                setTargetSalesOrderForInvoice(order);
                                setEditingInvoice(null);
                                setIsAttachInvoiceModalOpen(true);
                              }}
                              className={`inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg font-bold transition-all shadow-xs ${
                                isInvoiceEnabled
                                  ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer'
                                  : 'bg-slate-800 text-slate-500 border border-slate-700/60 opacity-60 cursor-not-allowed'
                              }`}
                              title={
                                isInvoiceEnabled
                                  ? 'Registrar factura(s) a esta Orden de Venta'
                                  : 'Bloqueado: se habilita cuando los equipos se cambien a «Entregado e Instalado» en Seguimiento de OC'
                              }
                            >
                              <ReceiptText className="w-3 h-3" /> {isInvoiceEnabled ? 'Facturar' : 'Facturar 🔒'}
                            </button>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setPrintingOrder(order);
                            setIsPrintModalOpen(true);
                          }}
                          className="p-2 rounded-xl text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Imprimir Orden de Venta"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingOrder(order);
                            setQuoteToConvert(null);
                            setTenderToConvert(null);
                            setIsNewOrderModalOpen(true);
                          }}
                          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Editar Orden de Venta"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteOrder(order.id)}
                          className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Eliminar Orden de Venta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setViewingOrder(order);
                          setIsDetailsModalOpen(true);
                        }}
                        className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                      >
                        Gestionar OV
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Orders Table / List View */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white">
                    Órdenes de Venta — <strong className="text-amber-400">{filteredOrders.length}</strong>
                    {filteredOrders.length !== salesOrders.length && (
                      <span className="text-slate-400 font-normal ml-1">({salesOrders.length} total)</span>
                    )}
                  </span>
                </div>
                {isOrderExcelFilteredOrSorted && (
                  <button
                    type="button"
                    onClick={onResetAllOrderExcelFilters}
                    className="inline-flex items-center gap-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl px-3 py-1 text-xs font-bold transition cursor-pointer active:scale-95 shadow-xs"
                    title="Restablecer filtros tipo Excel"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Limpiar Filtros Excel ({orderExcelActiveFiltersCount})</span>
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/90 text-[11px] font-bold text-slate-300 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 min-w-[150px]">
                        <ExcelColumnHeader
                          column={SALES_ORDER_COLUMNS[0]}
                          allRows={baseSalesOrders}
                          filters={orderExcelFilters}
                          sort={orderExcelSort}
                          onApplyFilter={onApplyOrderExcelFilter}
                          onApplySort={onApplyOrderExcelSort}
                          onClearColumnFilter={onClearOrderExcelColumnFilter}
                        />
                      </th>
                      <th className="py-2.5 px-3 min-w-[180px]">
                        <ExcelColumnHeader
                          column={SALES_ORDER_COLUMNS[1]}
                          allRows={baseSalesOrders}
                          filters={orderExcelFilters}
                          sort={orderExcelSort}
                          onApplyFilter={onApplyOrderExcelFilter}
                          onApplySort={onApplyOrderExcelSort}
                          onClearColumnFilter={onClearOrderExcelColumnFilter}
                        />
                      </th>
                      <th className="py-2.5 px-3 min-w-[180px]">
                        <ExcelColumnHeader
                          column={SALES_ORDER_COLUMNS[2]}
                          allRows={baseSalesOrders}
                          filters={orderExcelFilters}
                          sort={orderExcelSort}
                          onApplyFilter={onApplyOrderExcelFilter}
                          onApplySort={onApplyOrderExcelSort}
                          onClearColumnFilter={onClearOrderExcelColumnFilter}
                        />
                      </th>
                      <th className="py-2.5 px-3 min-w-[140px] text-right">
                        <ExcelColumnHeader
                          column={SALES_ORDER_COLUMNS[3]}
                          allRows={baseSalesOrders}
                          filters={orderExcelFilters}
                          sort={orderExcelSort}
                          onApplyFilter={onApplyOrderExcelFilter}
                          onApplySort={onApplyOrderExcelSort}
                          onClearColumnFilter={onClearOrderExcelColumnFilter}
                        />
                      </th>
                      <th className="py-2.5 px-3 min-w-[150px]">
                        <ExcelColumnHeader
                          column={SALES_ORDER_COLUMNS[4]}
                          allRows={baseSalesOrders}
                          filters={orderExcelFilters}
                          sort={orderExcelSort}
                          onApplyFilter={onApplyOrderExcelFilter}
                          onApplySort={onApplyOrderExcelSort}
                          onClearColumnFilter={onClearOrderExcelColumnFilter}
                        />
                      </th>
                      <th className="py-2.5 px-3 min-w-[150px]">
                        <ExcelColumnHeader
                          column={SALES_ORDER_COLUMNS[5]}
                          allRows={baseSalesOrders}
                          filters={orderExcelFilters}
                          sort={orderExcelSort}
                          onApplyFilter={onApplyOrderExcelFilter}
                          onApplySort={onApplyOrderExcelSort}
                          onClearColumnFilter={onClearOrderExcelColumnFilter}
                        />
                      </th>
                      <th className="py-2.5 px-3 min-w-[160px]">
                        <ExcelColumnHeader
                          column={SALES_ORDER_COLUMNS[6]}
                          allRows={baseSalesOrders}
                          filters={orderExcelFilters}
                          sort={orderExcelSort}
                          onApplyFilter={onApplyOrderExcelFilter}
                          onApplySort={onApplyOrderExcelSort}
                          onClearColumnFilter={onClearOrderExcelColumnFilter}
                        />
                      </th>
                      <th className="py-2.5 px-3 text-right min-w-[100px]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredOrders.map((order) => {
                      const { isDelivered } = isOrderEquipmentDeliveredInOC(order);
                      const canInvoice = isDelivered;
                      const originInfo = getOrderOriginInfo(order);
                      const OriginIcon = originInfo.icon;
                      const invData = getOrderInvoicingData(order);

                      return (
                        <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            {editingOVNumberId === order.id ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  autoFocus
                                  value={editingOVNumberValue}
                                  onChange={(e) => setEditingOVNumberValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveOVNumber(order.id, e);
                                    if (e.key === 'Escape') handleCancelEditOVNumber();
                                  }}
                                  placeholder="N° OV manual..."
                                  className="px-2 py-0.5 bg-slate-950 border-2 border-amber-400 rounded text-xs font-mono font-bold text-amber-300 outline-none w-32"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => handleSaveOVNumber(order.id, e)}
                                  className="p-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer"
                                  title="Guardar N° OV"
                                >
                                  <Check className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => handleCancelEditOVNumber(e)}
                                  className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                                  title="Cancelar"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 group/ov">
                                <span className="font-mono font-bold text-amber-400 text-sm">
                                  {order.salesOrderNumber || (
                                    <span className="text-slate-500 font-normal italic text-xs">[Sin N° OV]</span>
                                  )}
                                </span>
                                {!isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleStartEditOVNumber(order, e)}
                                    className="opacity-70 group-hover/ov:opacity-100 p-0.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded transition cursor-pointer"
                                    title="Asignar o editar N° de OV manualmente"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            )}
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border mt-1 ${originInfo.badgeClass}`}>
                              <OriginIcon className="w-3 h-3" />
                              {originInfo.label}
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {originInfo.detail}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-white block">{order.clientName}</span>
                            <span className="text-[11px] text-slate-400">{order.clientCity || 'Colombia'}</span>
                          </td>
                          <td className="py-2.5 px-4 align-top min-w-[240px]">
                            {(() => {
                              const isExpanded = expandedOrderEquipments.has(order.id);
                              const itemsCount = order.items?.length || 0;
                              const totalUnits = order.items?.reduce((acc, it) => acc + (it.quantityToDispatch || 1), 0) || 0;
                              const visibleItems = isExpanded || itemsCount <= 2 ? (order.items || []) : (order.items || []).slice(0, 2);
                              const hasMore = itemsCount > 2;

                              return (
                                <div className="space-y-1.5">
                                  {/* Header: Item & units counter + Single Toggle button */}
                                  <div className="flex items-center justify-between gap-1.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-slate-100 text-xs">
                                        {itemsCount} {itemsCount === 1 ? 'equipo' : 'equipos'}
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.2 rounded-full bg-slate-800/80 border border-slate-700/60">
                                        {totalUnits} uds
                                      </span>
                                    </div>

                                    {hasMore && (
                                      <button
                                        type="button"
                                        onClick={(e) => toggleOrderEquipments(order.id, e)}
                                        className="text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                        title={isExpanded ? 'Plegar lista de equipos' : `Ver todos los ${itemsCount} equipos`}
                                      >
                                        {isExpanded ? (
                                          <>
                                            <ChevronUp className="w-3 h-3 text-amber-400" />
                                            <span>Plegar</span>
                                          </>
                                        ) : (
                                          <>
                                            <ChevronDown className="w-3 h-3 text-amber-400" />
                                            <span>Ver todos ({itemsCount})</span>
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>

                                  {/* Harmonious Equipment List */}
                                  <div className={`space-y-1 max-w-sm ${isExpanded && itemsCount > 4 ? 'max-h-56 overflow-y-auto pr-1' : ''}`}>
                                    {visibleItems.map((it, itIdx) => {
                                      const statusMeta = resolveItemStatusAndBadge(order, it);
                                      const hasOC = Boolean(statusMeta.ocNumber);
                                      return (
                                        <div
                                          key={it.id || itIdx}
                                          className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80 transition-colors text-[11px]"
                                        >
                                          <div className="min-w-0 flex-1 flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400/80 shrink-0" />
                                            <span className="font-medium text-slate-200 truncate" title={it.name}>
                                              {it.name}
                                            </span>
                                            {it.code && (
                                              <span className="text-[9px] font-mono text-cyan-300/80 bg-slate-900 px-1 py-0.2 rounded border border-slate-800 shrink-0">
                                                {it.code}
                                              </span>
                                            )}
                                          </div>

                                          <div className="flex items-center gap-1.5 shrink-0">
                                            <span className="font-mono text-emerald-400 font-bold text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 border border-emerald-500/20">
                                              x{it.quantityToDispatch}
                                            </span>

                                            {hasOC ? (
                                              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30">
                                                OC: {statusMeta.ocNumber}
                                              </span>
                                            ) : (
                                              <span className="text-[9px] font-medium px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300/90 border border-amber-500/20">
                                                Pend. OC
                                              </span>
                                            )}
                                            {it.assignedSerialNumbers && it.assignedSerialNumbers.length > 0 && (
                                              <span
                                                className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700"
                                                title={`S/N: ${it.assignedSerialNumbers.join(', ')}`}
                                              >
                                                S/N
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}

                                    {/* Subtle link when collapsed with more items */}
                                    {hasMore && !isExpanded && (
                                      <button
                                        type="button"
                                        onClick={(e) => toggleOrderEquipments(order.id, e)}
                                        className="w-full text-center text-[10px] font-medium text-amber-400/90 hover:text-amber-300 py-0.5 hover:underline transition cursor-pointer"
                                      >
                                        +{itemsCount - 2} equipos más • Ver todos
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                            {formatCOP(order.totalValueCOP)}
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={order.status}
                              onChange={(e) => {
                                const newSt = e.target.value as SalesOrderStatus;
                                handleUpdateOrderStatus(order.id, newSt);
                              }}
                              className={`text-[11px] font-bold px-2 py-1 rounded-lg border bg-slate-900 focus:outline-none cursor-pointer ${getStatusBadge(order.status)}`}
                              title="Cambiar estado de la OV"
                            >
                              <option value="Borrador">Borrador</option>
                              <option value="En Proceso">En Proceso</option>
                              <option value="Equipos en Bodega">Equipos en Bodega</option>
                              <option value="Entregada al Cliente">Entregada al Cliente</option>
                              <option value="Listo para Facturar">Listo para Facturar</option>
                              {order.status === 'Facturada' && (
                                <option value="Facturada">Facturada</option>
                              )}
                              <option value="Cancelada">Cancelada</option>
                            </select>
                          </td>
                          <td className="py-3 px-4">
                            {order.hasLinkedOC ? (
                              <button
                                type="button"
                                onClick={() => onNavigateToTab?.('seguimiento_oc')}
                                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold cursor-pointer transition"
                                title="Ver en Seguimiento de OC"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> OC Activa
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onGenerateOCTracking?.(order)}
                                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 font-bold border border-sky-500/30 cursor-pointer"
                              >
                                <ShoppingCart className="w-3 h-3 text-sky-400" /> Ver OC
                              </button>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {(() => {
                              const invData = getOrderInvoicingData(order);
                              if (order.status === 'Cancelada') {
                                return <span className="text-[10px] text-slate-500">Cancelada</span>;
                              }
                              if (invData.isFullyInvoiced || order.status === 'Facturada') {
                                return (
                                  <span
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-xs"
                                    title={`Facturación Completa: ${invData.invoiceNumbers || 'Facturada'}`}
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span>Facturada{invData.invoiceNumbers ? ` (${invData.invoiceNumbers})` : ''}</span>
                                  </span>
                                );
                              }
                              const isInvoiceEnabled = canInvoice;
                              if (invData.invoiceCount > 0) {
                                return (
                                  <div className="flex flex-col gap-1 items-start">
                                    <span
                                      className="inline-flex items-center gap-1 text-[10px] text-purple-300 font-bold bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.5 rounded"
                                      title={`Facturas registradas: ${invData.invoiceNumbers}`}
                                    >
                                      <ReceiptText className="w-3 h-3 text-purple-400" /> {invData.invoiceNumbers} ({formatCOP(invData.totalInvoicedCOP)})
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (!isInvoiceEnabled) {
                                          alert(`⛔ BLOQUEO DE FACTURACIÓN:\n\nEste botón se habilita únicamente cuando el estado de los equipos en la ventana de Seguimiento de OC cambie a "Entregado e Instalado".\n\nEstado actual: Aún hay equipos pendientes de entrega e instalación.`);
                                          return;
                                        }
                                        setTargetSalesOrderForInvoice(order);
                                        setEditingInvoice(null);
                                        setIsAttachInvoiceModalOpen(true);
                                      }}
                                      className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg font-bold transition shadow-xs ${
                                        isInvoiceEnabled
                                          ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer'
                                          : 'bg-slate-800 text-slate-500 border border-slate-700/60 opacity-60 cursor-not-allowed'
                                      }`}
                                      title={
                                        isInvoiceEnabled
                                          ? `Saldo pendiente por facturar: ${formatCOP(invData.remainingToInvoiceCOP)}. Haz clic para registrar otra factura.`
                                          : 'Bloqueado: se habilita cuando los equipos se cambien a «Entregado e Instalado» en Seguimiento de OC'
                                      }
                                    >
                                      <ReceiptText className="w-3 h-3" /> {isInvoiceEnabled ? `Facturar (${formatCOP(invData.remainingToInvoiceCOP)})` : 'Facturar 🔒'}
                                    </button>
                                  </div>
                                );
                              }
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!isInvoiceEnabled) {
                                      alert(`⛔ BLOQUEO DE FACTURACIÓN:\n\nEste botón se habilita únicamente cuando el estado de los equipos en la ventana de Seguimiento de OC cambie a "Entregado e Instalado".\n\nEstado actual: Aún hay equipos pendientes de entrega e instalación.`);
                                      return;
                                    }
                                    setTargetSalesOrderForInvoice(order);
                                    setEditingInvoice(null);
                                    setIsAttachInvoiceModalOpen(true);
                                  }}
                                  className={`inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg font-bold transition shadow-xs ${
                                    isInvoiceEnabled
                                      ? 'bg-purple-600 hover:bg-purple-500 text-white cursor-pointer'
                                      : 'bg-slate-800 text-slate-500 border border-slate-700/60 opacity-60 cursor-not-allowed'
                                  }`}
                                  title={
                                    isInvoiceEnabled
                                      ? 'Registrar factura(s) a esta Orden de Venta'
                                      : 'Bloqueado: se habilita cuando los equipos se cambien a «Entregado e Instalado» en Seguimiento de OC'
                                  }
                                >
                                  <ReceiptText className="w-3 h-3" />
                                  {isInvoiceEnabled ? 'Facturar' : 'Facturar 🔒'}
                                </button>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {!invData.isFullyInvoiced && order.status !== 'Facturada' && (order.items?.length || 0) > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setSplitOrderModalTarget(order)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 cursor-pointer transition-colors"
                                  title="Dividir OV / Trasladar equipos demorados a Nueva OV y OC"
                                >
                                  <GitFork className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setViewingOrder(order);
                                  setIsDetailsModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                                title="Ver detalles"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setPrintingOrder(order);
                                  setIsPrintModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 cursor-pointer"
                                title="Imprimir"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingOrder(order);
                                  setQuoteToConvert(null);
                                  setTenderToConvert(null);
                                  setIsNewOrderModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
                                title="Editar"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteOrder(order.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                                title="Eliminar OV"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: Facturación al Cliente */}
      {activeSubTab === 'invoices' && (
        <div className="space-y-4">
          {/* Filter / Search for Invoices */}
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={invoiceSearchText}
                onChange={(e) => setInvoiceSearchText(e.target.value)}
                placeholder="Buscar por N° Factura, cliente o N° OV..."
                className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-400 focus:outline-none focus:border-purple-400"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Estado:</span>
              <select
                value={invoiceStatusFilter}
                onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-purple-400"
              >
                <option value="all">Todos los Estados</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Radicada en Cliente">Radicada en Cliente</option>
                <option value="Pagada">Pagada</option>
                <option value="Anulada">Anulada</option>
              </select>
            </div>
          </div>

          {/* Invoices List / Table View */}
          {filteredInvoices.length === 0 ? (
            <div className="py-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl">
              <ReceiptText className="w-12 h-12 text-slate-500 mx-auto mb-2 opacity-50" />
              <h3 className="text-sm font-bold text-white mb-1">No hay facturas registradas</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                Las facturas se generan y adjuntan directamente desde las Órdenes de Venta (OV) una vez marcadas como "Entregada al Cliente" o desde el módulo de Licitaciones.
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveSubTab('orders');
                  setOrderStatusFilter('all');
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Ir a Órdenes de Venta (OV)
              </button>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-white">
                    Facturas de Venta — <strong className="text-purple-400">{filteredInvoices.length}</strong>
                    {filteredInvoices.length !== salesInvoices.length && (
                      <span className="text-slate-400 font-normal ml-1">({salesInvoices.length} total)</span>
                    )}
                  </span>
                </div>
                {isInvoiceExcelFilteredOrSorted && (
                  <button
                    type="button"
                    onClick={onResetAllInvoiceExcelFilters}
                    className="inline-flex items-center gap-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl px-3 py-1 text-xs font-bold transition cursor-pointer active:scale-95 shadow-xs"
                    title="Restablecer filtros tipo Excel"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Limpiar Filtros Excel ({invoiceExcelActiveFiltersCount})</span>
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950/90 border-b border-slate-800 text-slate-300 font-bold text-[11px]">
                      <th className="py-2.5 px-3 min-w-[130px]">
                        <ExcelColumnHeader
                          column={SALES_INVOICE_COLUMNS[0]}
                          allRows={baseSalesInvoices}
                          filters={invoiceExcelFilters}
                          sort={invoiceExcelSort}
                          onApplyFilter={onApplyInvoiceExcelFilter}
                          onApplySort={onApplyInvoiceExcelSort}
                          onClearColumnFilter={onClearInvoiceExcelColumnFilter}
                        />
                      </th>
                      <th className="py-2.5 px-3 min-w-[140px]">
                        <ExcelColumnHeader
                          column={SALES_INVOICE_COLUMNS[1]}
                          allRows={baseSalesInvoices}
                          filters={invoiceExcelFilters}
                          sort={invoiceExcelSort}
                          onApplyFilter={onApplyInvoiceExcelFilter}
                          onApplySort={onApplyInvoiceExcelSort}
                          onClearColumnFilter={onClearInvoiceExcelColumnFilter}
                        />
                      </th>
                      <th className="py-2.5 px-3 min-w-[200px]">
                        <ExcelColumnHeader
                          column={SALES_INVOICE_COLUMNS[2]}
                          allRows={baseSalesInvoices}
                          filters={invoiceExcelFilters}
                          sort={invoiceExcelSort}
                          onApplyFilter={onApplyInvoiceExcelFilter}
                          onApplySort={onApplyInvoiceExcelSort}
                          onClearColumnFilter={onClearInvoiceExcelColumnFilter}
                        />
                      </th>
                      <th className="py-2.5 px-3 min-w-[220px] text-slate-300 font-bold text-[11px]">
                        Equipos Facturados
                      </th>
                      <th className="py-2.5 px-3 min-w-[130px]">
                        <ExcelColumnHeader
                          column={SALES_INVOICE_COLUMNS[3]}
                          allRows={baseSalesInvoices}
                          filters={invoiceExcelFilters}
                          sort={invoiceExcelSort}
                          onApplyFilter={onApplyInvoiceExcelFilter}
                          onApplySort={onApplyInvoiceExcelSort}
                          onClearColumnFilter={onClearInvoiceExcelColumnFilter}
                        />
                      </th>
                      <th className="py-2.5 px-3 min-w-[130px]">
                        <ExcelColumnHeader
                          column={SALES_INVOICE_COLUMNS[4]}
                          allRows={baseSalesInvoices}
                          filters={invoiceExcelFilters}
                          sort={invoiceExcelSort}
                          onApplyFilter={onApplyInvoiceExcelFilter}
                          onApplySort={onApplyInvoiceExcelSort}
                          onClearColumnFilter={onClearInvoiceExcelColumnFilter}
                        />
                      </th>
                      <th className="py-2.5 px-3 min-w-[140px] text-right">
                        <ExcelColumnHeader
                          column={SALES_INVOICE_COLUMNS[5]}
                          allRows={baseSalesInvoices}
                          filters={invoiceExcelFilters}
                          sort={invoiceExcelSort}
                          onApplyFilter={onApplyInvoiceExcelFilter}
                          onApplySort={onApplyInvoiceExcelSort}
                          onClearColumnFilter={onClearInvoiceExcelColumnFilter}
                        />
                      </th>
                      <th className="py-2.5 px-3 min-w-[140px] text-center">
                        <ExcelColumnHeader
                          column={SALES_INVOICE_COLUMNS[6]}
                          allRows={baseSalesInvoices}
                          filters={invoiceExcelFilters}
                          sort={invoiceExcelSort}
                          onApplyFilter={onApplyInvoiceExcelFilter}
                          onApplySort={onApplyInvoiceExcelSort}
                          onClearColumnFilter={onClearInvoiceExcelColumnFilter}
                        />
                      </th>
                      <th className="py-2.5 px-3 text-center min-w-[120px]">Soporte Adjunto</th>
                      <th className="py-2.5 px-3 text-right min-w-[90px]">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredInvoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* N° Factura */}
                        <td className="py-3 px-4 font-mono font-bold text-purple-400 whitespace-nowrap">
                          {inv.invoiceNumber}
                        </td>

                        {/* OV Asociada */}
                        <td className="py-3 px-4">
                          {inv.salesOrderNumber ? (
                            <span className="font-mono text-amber-300 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 whitespace-nowrap">
                              {inv.salesOrderNumber}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic">Sin OV</span>
                          )}
                        </td>

                        {/* Cliente */}
                        <td className="py-3 px-4 font-semibold text-white max-w-[220px] truncate">
                          {inv.clientName}
                        </td>

                        {/* Equipos Facturados */}
                        <td className="py-3 px-3 max-w-[280px]">
                          {(() => {
                            const linkedOrder = salesOrders.find(
                              (o) => o.id === inv.salesOrderId || (inv.salesOrderNumber && o.salesOrderNumber === inv.salesOrderNumber)
                            );
                            const billedItems = (inv.items && inv.items.length > 0)
                              ? inv.items
                              : (linkedOrder?.items || []);

                            if (billedItems.length === 0) {
                              return <span className="text-[11px] text-slate-500 italic">Sin detalle de equipos</span>;
                            }

                            const totalUnits = billedItems.reduce((acc: number, it: any) => acc + (it.quantity || it.quantityToDispatch || 1), 0);

                            return (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 shrink-0">
                                    {totalUnits} uds • {billedItems.length} {billedItems.length === 1 ? 'equipo' : 'equipos'}
                                  </span>
                                </div>
                                <div className="max-h-24 overflow-y-auto space-y-0.5 scrollbar-thin pr-1">
                                  {billedItems.map((it: any, itIdx: number) => (
                                    <div key={it.id || itIdx} className="text-[11px] text-slate-200 flex items-center justify-between gap-1.5 leading-snug">
                                      <span className="truncate text-white font-medium" title={it.name}>
                                        • {it.name}
                                      </span>
                                      <span className="text-[10px] text-purple-300 font-mono font-bold shrink-0">
                                        x{it.quantity || it.quantityToDispatch || 1}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </td>

                        {/* Fecha Emisión */}
                        <td className="py-3 px-4 text-slate-300 font-mono whitespace-nowrap">
                          {inv.issueDate || '—'}
                        </td>

                        {/* Fecha Vencimiento */}
                        <td className="py-3 px-4 text-slate-400 font-mono whitespace-nowrap">
                          {inv.dueDate || '—'}
                        </td>

                        {/* Total Facturado */}
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400 text-right whitespace-nowrap">
                          {formatCOP(inv.totalAmountCOP)}
                        </td>

                        {/* Estado de Pago */}
                        <td className="py-3 px-4 text-center">
                          {(() => {
                            const rawSt = inv.paymentStatus;
                            const currentVal = (rawSt === 'Pagada / Cancelada' || rawSt === 'Pagada')
                              ? 'Pagada'
                              : (rawSt === 'Pendiente de Pago' || rawSt === 'Pendiente' || !rawSt)
                              ? 'Pendiente'
                              : rawSt;

                            return (
                              <select
                                value={currentVal}
                                disabled={isReadOnly}
                                onChange={(e) => handleUpdateInvoicePaymentStatus(inv.id, e.target.value)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border outline-none cursor-pointer transition shadow-xs ${
                                  currentVal === 'Pagada'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                    : currentVal === 'Radicada en Cliente'
                                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30'
                                    : currentVal === 'Anulada'
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                                }`}
                                title="Clic para cambiar el estado de pago de la factura"
                              >
                                <option value="Pendiente" className="bg-slate-900 text-amber-300 font-bold">Pendiente</option>
                                <option value="Radicada en Cliente" className="bg-slate-900 text-blue-300 font-bold">Radicada en Cliente</option>
                                <option value="Pagada" className="bg-slate-900 text-emerald-300 font-bold">Pagada</option>
                                <option value="Anulada" className="bg-slate-900 text-rose-300 font-bold">Anulada</option>
                              </select>
                            );
                          })()}
                        </td>

                        {/* Soporte Adjunto */}
                        <td className="py-3 px-4 text-center">
                          {inv.attachedInvoiceFile ? (
                            <button
                              type="button"
                              onClick={async () => {
                                const rawSize = (inv.attachedInvoiceFile as any)?.size;
                                let formattedFileSize: string | undefined = undefined;
                                if (typeof rawSize === 'number' && !isNaN(rawSize) && rawSize > 0) {
                                  formattedFileSize = rawSize > 1024 * 1024
                                    ? `${(rawSize / (1024 * 1024)).toFixed(2)} MB`
                                    : `${(rawSize / 1024).toFixed(1)} KB`;
                                } else if (typeof rawSize === 'string' && rawSize.trim() && !rawSize.includes('NaN')) {
                                  formattedFileSize = rawSize;
                                }

                                let effectiveData = inv.attachedInvoiceFile!.dataUrl;
                                if (!effectiveData && inv.attachedInvoiceFile!.id) {
                                  const idbUrl = await getFileBlobUrlFromIndexedDB(inv.attachedInvoiceFile!.id);
                                  if (idbUrl) effectiveData = idbUrl;
                                }

                                setPreviewInvoiceDoc({
                                  isOpen: true,
                                  title: `Factura ${inv.invoiceNumber} - ${inv.clientName}`,
                                  subtitle: `Soporte Oficial Facturado • OV: ${inv.salesOrderNumber || 'Sin OV'} • Emisión: ${inv.issueDate || '—'}`,
                                  fileName: inv.attachedInvoiceFile!.name,
                                  fileSize: formattedFileSize,
                                  fileData: effectiveData,
                                  fileType: inv.attachedInvoiceFile!.type,
                                  onDownload: () => {
                                    if (!effectiveData) return;
                                    const a = document.createElement('a');
                                    a.href = effectiveData;
                                    a.download = inv.attachedInvoiceFile!.name;
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                  },
                                });
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-purple-500/15 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 hover:border-purple-400 transition cursor-pointer group/att shadow-xs"
                              title={`Previsualizar soporte oficial: ${inv.attachedInvoiceFile.name}`}
                            >
                              <Paperclip className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                              <span className="max-w-[110px] truncate">{inv.attachedInvoiceFile.name}</span>
                              <Eye className="w-3.5 h-3.5 text-purple-300 ml-0.5 group-hover/att:scale-110 transition-transform" />
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-500 italic">Sin adjunto</span>
                          )}
                        </td>

                        {/* Acciones */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingInvoice(inv);
                                setTargetSalesOrderForInvoice(null);
                                setIsAttachInvoiceModalOpen(true);
                              }}
                              className="p-1.5 rounded-lg text-purple-400 hover:text-purple-200 hover:bg-purple-500/20 border border-transparent hover:border-purple-500/30 transition cursor-pointer"
                              title="Editar Factura"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setInvoiceToDelete(inv)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition cursor-pointer"
                              title="Eliminar Factura"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 4: Trazabilidad entre Pestañas */}
      {activeSubTab === 'traceability' && (
        <ContractTraceabilityView
          contracts={contracts}
          salesOrders={salesOrders}
          salesInvoices={salesInvoices}
          savedQuotes={savedQuotes}
          onSelectOrder={(ord) => {
            setViewingOrder(ord);
            setIsDetailsModalOpen(true);
          }}
          onSelectInvoice={(inv) => {
            setEditingInvoice(inv);
            setIsAttachInvoiceModalOpen(true);
          }}
          onNavigateToTab={onNavigateToTab}
          currentUser={currentUser}
        />
      )}

      {/* Modals */}
      <NewSalesOrderModal
        isOpen={isNewOrderModalOpen}
        onClose={() => setIsNewOrderModalOpen(false)}
        onSave={handleSaveOrder}
        orderToEdit={editingOrder}
        initialQuoteToConvert={quoteToConvert}
        initialTenderToConvert={tenderToConvert}
        existingOrders={salesOrders}
        savedQuotes={savedQuotes}
        tenderClients={tenderClients}
        contracts={contracts}
        equipments={equipments}
        currentUser={currentUser}
      />

      <AttachInvoiceModal
        isOpen={isAttachInvoiceModalOpen}
        onClose={() => setIsAttachInvoiceModalOpen(false)}
        onSave={handleSaveInvoice}
        invoiceToEdit={editingInvoice}
        targetSalesOrder={targetSalesOrderForInvoice}
        salesOrders={salesOrders}
        existingInvoices={salesInvoices}
        currentUser={currentUser}
      />

      <SalesOrderDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        order={viewingOrder}
        linkedInvoices={
          viewingOrder
            ? salesInvoices.filter(
                (i) =>
                  i.salesOrderId === viewingOrder.id ||
                  (viewingOrder.invoiceIds && viewingOrder.invoiceIds.includes(i.id)) ||
                  (viewingOrder.salesOrderNumber && i.salesOrderNumber === viewingOrder.salesOrderNumber) ||
                  (viewingOrder.invoiceNumber &&
                    i.invoiceNumber &&
                    viewingOrder.invoiceNumber
                      .split(',')
                      .map((s) => s.trim().toUpperCase())
                      .includes(i.invoiceNumber.trim().toUpperCase()))
              )
            : []
        }
        onEdit={(ord) => {
          setEditingOrder(ord);
          setQuoteToConvert(null);
          setIsNewOrderModalOpen(true);
        }}
        onDelete={handleDeleteOrder}
        onPrint={(ord) => {
          setPrintingOrder(ord);
          setIsPrintModalOpen(true);
        }}
        onCreateInvoiceForOrder={(ord) => {
          setTargetSalesOrderForInvoice(ord);
          setEditingInvoice(null);
          setIsAttachInvoiceModalOpen(true);
        }}
        onUpdateStatus={handleUpdateOrderStatus}
        onGenerateOC={(ord) => onGenerateOCTracking?.(ord)}
        onNavigateToOC={() => onNavigateToTab?.('seguimiento_oc')}
        currentUser={currentUser}
        contracts={contracts}
      />

      <SalesOrderPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        order={printingOrder}
        customLetterheadUrl={customLetterheadUrl}
      />

      {/* Delete Confirmation Modal */}
      {orderToDelete &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            id="delete-order-modal-overlay"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn"
            onClick={() => setOrderToDelete(null)}
          >
            <div
              id="delete-order-modal-card"
              className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scaleUp"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-red-400 mb-4">
                <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                  <Trash2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Eliminar Orden de Venta</h3>
                  <p className="text-xs text-slate-400">Esta acción no se puede deshacer</p>
                </div>
              </div>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 mb-5 text-xs text-slate-300 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">N° Orden de Venta:</span>
                  <span className="font-mono font-bold text-amber-400">{orderToDelete.salesOrderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Cliente:</span>
                  <span className="font-semibold text-white truncate max-w-[200px]">{orderToDelete.clientName}</span>
                </div>
                {orderToDelete.contractNumber && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">Contrato / Licitación:</span>
                    <span className="text-purple-300 font-mono">{orderToDelete.contractNumber}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-slate-800 pt-1.5">
                  <span className="text-slate-400 font-medium">Equipos:</span>
                  <span className="font-semibold text-slate-200">{orderToDelete.items?.length || 0} equipos</span>
                </div>
              </div>

              <p className="text-xs text-slate-400 mb-6">
                ¿Estás seguro de que deseas eliminar permanentemente esta Orden de Venta de la base de datos?
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOrderToDelete(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteOrder}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-red-900/30 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Confirmar Eliminación
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* CONFIRM INVOICE DELETE MODAL */}
      {invoiceToDelete &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scaleUp">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6" />
              </div>

              <h3 className="text-lg font-bold text-white mb-2">Eliminar Factura de Venta</h3>

              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 mb-5 text-xs text-slate-300 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">N° Factura:</span>
                  <span className="font-mono font-bold text-purple-400">{invoiceToDelete.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Cliente:</span>
                  <span className="font-semibold text-white truncate max-w-[200px]">{invoiceToDelete.clientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-medium">Total Facturado:</span>
                  <span className="text-emerald-400 font-bold font-mono">{formatCOP(invoiceToDelete.totalAmountCOP)}</span>
                </div>
                {invoiceToDelete.salesOrderNumber && (
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-medium">OV Asociada:</span>
                    <span className="text-amber-300 font-mono">{invoiceToDelete.salesOrderNumber}</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-400 mb-6">
                ¿Estás seguro de que deseas eliminar permanentemente esta factura de la base de datos?
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setInvoiceToDelete(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDeleteInvoice(invoiceToDelete.id);
                    setInvoiceToDelete(null);
                  }}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-red-900/30 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  Confirmar Eliminación
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Document Preview Modal for Invoices & Attachments */}
      {previewInvoiceDoc && (
        <DocumentPreviewModal
          isOpen={previewInvoiceDoc.isOpen}
          onClose={() => setPreviewInvoiceDoc(null)}
          title={previewInvoiceDoc.title}
          subtitle={previewInvoiceDoc.subtitle}
          fileName={previewInvoiceDoc.fileName}
          fileSize={previewInvoiceDoc.fileSize}
          fileData={previewInvoiceDoc.fileData}
          fileType={previewInvoiceDoc.fileType}
          onDownload={previewInvoiceDoc.onDownload}
        />
      )}

      {/* Modal para Dividir OV / Trasladar equipos demorados a Nueva OV y OC */}
      {splitOrderModalTarget && (
        <SplitSalesOrderModal
          isOpen={true}
          onClose={() => setSplitOrderModalTarget(null)}
          sourceOrder={splitOrderModalTarget}
          allOrders={salesOrders}
          contracts={contracts}
          salesInvoices={salesInvoices}
          onConfirmSplit={(params) => {
            const isCompleteTransfer = (() => {
              const currentTotalUnits = (splitOrderModalTarget.items || []).reduce((s, it) => s + (it.quantityToDispatch || it.quantity || 1), 0);
              const movingUnits = params.itemSplits.reduce((s, it) => s + it.quantityToMove, 0);
              return movingUnits >= currentTotalUnits;
            })();
            const { updatedOrders, updatedContracts } = splitSalesOrderRecord(
              params,
              salesOrders,
              contracts
            );
            saveStoredSalesOrders(updatedOrders);
            if (onUpdateSalesOrders) {
              onUpdateSalesOrders(updatedOrders);
            }
            if (onUpdateContracts) {
              onUpdateContracts(updatedContracts);
              saveStoredOCTrackingContracts(updatedContracts);
            }
            setSplitOrderModalTarget(null);
            if (isCompleteTransfer) {
              alert(`✓ Se trasladaron todos los equipos a la Nueva Orden de Venta ${params.newSalesOrderNumber}. La OV original (${splitOrderModalTarget.salesOrderNumber || splitOrderModalTarget.id}) quedó sin equipos y fue retirada del listado activo.`);
            } else {
              alert(`✓ Se trasladaron los equipos a la Nueva Orden de Venta ${params.newSalesOrderNumber} exitosamente.`);
            }
          }}
        />
      )}
      <ProfitabilityCalculator
        isOpen={isProfitabilityModalOpen}
        onClose={() => setIsProfitabilityModalOpen(false)}
      />
    </div>
  );
};

