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
  RotateCcw,
  X,
} from 'lucide-react';
import {
  SalesOrderRecord,
  SalesInvoiceRecord,
  OCTrackingContract,
  TenderClientProject,
  MedicalEquipment,
  SalesOrderStatus,
  SalesInvoicePaymentStatus,
  SavedQuote,
  AuthUser,
} from '../../types';
import { NewSalesOrderModal } from './sales-orders/NewSalesOrderModal';
import { AttachInvoiceModal } from './sales-orders/AttachInvoiceModal';
import { SalesOrderPrintModal } from './sales-orders/SalesOrderPrintModal';
import { SalesOrderDetailsModal } from './sales-orders/SalesOrderDetailsModal';
import { ContractTraceabilityView } from './sales-orders/ContractTraceabilityView';
import { formatCOP } from '../../utils/formatters';
import { deleteSalesOrderFromFirestore, deleteSalesInvoiceFromFirestore } from '../../services/realtimeSync';
import {
  ExcelColumnConfig,
  ExcelColumnHeader,
  useExcelTableFilters,
} from '../common/ExcelTableFilter';

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
    accessor: (row) => row.paymentStatus || 'Pendiente',
    align: 'center',
  },
];

interface SalesOrdersViewProps {
  salesOrders: SalesOrderRecord[];
  onUpdateSalesOrders: (orders: SalesOrderRecord[]) => void;
  salesInvoices: SalesInvoiceRecord[];
  onUpdateSalesInvoices: (invoices: SalesInvoiceRecord[]) => void;
  contracts: OCTrackingContract[];
  onUpdateContracts?: (contracts: OCTrackingContract[]) => void;
  savedQuotes: SavedQuote[];
  tenderClients?: TenderClientProject[];
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
  // Main subtab selection
  const [activeSubTab, setActiveSubTab] = useState<'orders' | 'invoices' | 'traceability'>('orders');

  // Permission enforcement
  const isReadOnly = currentUser?.role === 'viewer' && !currentUser?.permissions?.canManageSalesOrders;

  // Search & Filter State (OVs)
  const [orderSearchText, setOrderSearchText] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderOriginFilter, setOrderOriginFilter] = useState<'all' | 'tender' | 'quote' | 'direct'>('all');
  const [ordersViewMode, setOrdersViewMode] = useState<'grid' | 'list'>('list');

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
  const [viewingOrder, setViewingOrder] = useState<SalesOrderRecord | null>(null);

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

  // Base Filtered Orders (Search & Quick Status Filters)
  const baseSalesOrders = useMemo(() => {
    return salesOrders.filter((order) => {
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
  }, [salesOrders, orderStatusFilter, orderOriginFilter, orderSearchText]);

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

  // Base Filtered Invoices (Search & Status)
  const baseSalesInvoices = useMemo(() => {
    return salesInvoices.filter((inv) => {
      if (invoiceStatusFilter !== 'all' && inv.paymentStatus !== invoiceStatusFilter) {
        return false;
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
  const totalOrdersCount = salesOrders.length;
  const enProcesoCount = salesOrders.filter((o) => o.status === 'En Proceso' || o.status === 'Borrador').length;
  const enBodegaCount = salesOrders.filter((o) => o.status === 'Equipos en Bodega').length;
  const facturadasCount = salesOrders.filter((o) => o.status === 'Facturada').length;
  const totalOVValueCOP = salesOrders
    .filter((o) => o.status !== 'Cancelada')
    .reduce((acc, o) => acc + (Number(o.totalValueCOP) || 0), 0);

  // Active OVs pending purchase orders (OC)
  const ordersWithoutOC = useMemo(() => {
    return salesOrders.filter((o) => o.status !== 'Cancelada' && !o.hasLinkedOC);
  }, [salesOrders]);

  // Handlers for Save / Delete
  const handleSaveOrder = (savedOrder: SalesOrderRecord, generateOCNow?: boolean) => {
    const existingIndex = salesOrders.findIndex((o) => o.id === savedOrder.id);
    let updatedOrders: SalesOrderRecord[];
    if (existingIndex >= 0) {
      updatedOrders = [...salesOrders];
      updatedOrders[existingIndex] = savedOrder;
    } else {
      updatedOrders = [savedOrder, ...salesOrders];
    }
    onUpdateSalesOrders(updatedOrders);

    // If requested to generate OC now in Ventana 5
    if (generateOCNow && onGenerateOCTracking) {
      onGenerateOCTracking(savedOrder);
    }
  };

  const handleDeleteOrder = (orderIdOrOrder: string | SalesOrderRecord) => {
    const target = typeof orderIdOrOrder === 'string'
      ? salesOrders.find((o) => o.id === orderIdOrOrder)
      : orderIdOrOrder;
    if (!target) return;
    setOrderToDelete(target);
  };

  const confirmDeleteOrder = () => {
    if (!orderToDelete) return;
    const orderId = orderToDelete.id;

    // Actualizar únicamente el estado local.
    // Firestore elimina directamente el documento correspondiente.
    const updated = salesOrders.filter((o) => o.id !== orderId);
    onUpdateSalesOrders(updated.filter((o) => o.id !== orderId));
    deleteSalesOrderFromFirestore(orderId).catch(console.error);

    if (viewingOrder?.id === orderId) setViewingOrder(null);
    if (editingOrder?.id === orderId) setEditingOrder(null);
    setOrderToDelete(null);
  };

  const handleUpdateOrderStatus = (orderId: string, newStatus: SalesOrderStatus) => {
    const updated = salesOrders.map((o) => (o.id === orderId ? { ...o, status: newStatus, updatedAt: new Date().toISOString() } : o));
    onUpdateSalesOrders(updated);
  };

  const handleSaveInvoice = (savedInvoice: SalesInvoiceRecord, updatedSalesOrder?: SalesOrderRecord) => {
    const existingIndex = salesInvoices.findIndex((i) => i.id === savedInvoice.id);
    let updatedInvoices: SalesInvoiceRecord[];
    if (existingIndex >= 0) {
      updatedInvoices = [...salesInvoices];
      updatedInvoices[existingIndex] = savedInvoice;
    } else {
      updatedInvoices = [savedInvoice, ...salesInvoices];
    }
    onUpdateSalesInvoices(updatedInvoices);

    if (updatedSalesOrder) {
      handleSaveOrder(updatedSalesOrder);
    }
  };

  const handleDeleteInvoice = (invoiceId: string) => {
    const invoiceToDelete = salesInvoices.find((i) => i.id === invoiceId);
    const updated = salesInvoices.filter((i) => i.id !== invoiceId);

    // Eliminar únicamente esta factura de Firestore.
    // La colección completa ya no se vuelve a guardar.
    onUpdateSalesInvoices(updated);
    deleteSalesInvoiceFromFirestore(invoiceId).catch(console.error);

    // If invoice was linked to an OV, recalculate order's invoice state
    if (invoiceToDelete?.salesOrderId) {
      const so = salesOrders.find((o) => o.id === invoiceToDelete.salesOrderId);
      if (so) {
        const remainingInvoices = updated.filter(
          (i) => i.salesOrderId === so.id || (so.salesOrderNumber && i.salesOrderNumber === so.salesOrderNumber)
        );
        const newTotalInvoiced = remainingInvoices.reduce((sum, i) => sum + (Number(i.totalAmountCOP) || 0), 0);
        const isFullyInvoiced = so.totalValueCOP > 0 && newTotalInvoiced >= so.totalValueCOP;
        const allInvoiceNumbers = Array.from(new Set(remainingInvoices.map((i) => i.invoiceNumber).filter(Boolean))).join(', ');
        const allInvoiceIds = remainingInvoices.map((i) => i.id);

        const updatedSO: SalesOrderRecord = {
          ...so,
          invoiceNumber: allInvoiceNumbers || undefined,
          invoiceId: remainingInvoices[0]?.id || undefined,
          invoiceIds: allInvoiceIds,
          totalInvoicedCOP: newTotalInvoiced,
          invoicedStatus: isFullyInvoiced
            ? 'Facturada Total'
            : newTotalInvoiced > 0
            ? 'Facturada Parcial'
            : 'No Facturada',
          status: isFullyInvoiced ? 'Facturada' : so.status === 'Facturada' ? 'Entregada al Cliente' : so.status,
          updatedAt: new Date().toISOString(),
        };
        handleSaveOrder(updatedSO);
      }
    }
  };

  // Helper to compute invoicing breakdown for any sales order
  const getOrderInvoicingData = (order: SalesOrderRecord) => {
    const orderInvoices = salesInvoices.filter(
      (inv) =>
        inv.salesOrderId === order.id ||
        (order.invoiceId && inv.id === order.invoiceId) ||
        (order.invoiceIds && order.invoiceIds.includes(inv.id)) ||
        (order.salesOrderNumber && inv.salesOrderNumber === order.salesOrderNumber) ||
        (order.invoiceNumber &&
          inv.invoiceNumber &&
          order.invoiceNumber
            .split(',')
            .map((s) => s.trim().toUpperCase())
            .includes(inv.invoiceNumber.trim().toUpperCase()))
    );

    const totalInvoicedCOP =
      orderInvoices.length > 0
        ? orderInvoices.reduce((sum, inv) => sum + (Number(inv.totalAmountCOP) || 0), 0)
        : order.totalInvoicedCOP || (order.invoicedStatus === 'Facturada Total' ? order.totalValueCOP : 0);

    const totalOrderCOP = Number(order.totalValueCOP) || 0;
    const isFullyInvoiced =
      (totalOrderCOP > 0 && totalInvoicedCOP >= totalOrderCOP) || order.invoicedStatus === 'Facturada Total';
    const remainingToInvoiceCOP = Math.max(0, totalOrderCOP - totalInvoicedCOP);
    const invoiceCount = orderInvoices.length;
    const invoiceNumbers =
      Array.from(new Set(orderInvoices.map((i) => i.invoiceNumber).filter(Boolean))).join(', ') || order.invoiceNumber;
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
    };
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
      case 'Facturada':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'Cancelada':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/30';
      default:
        return 'bg-slate-700 text-slate-200 border-slate-600';
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-950 border border-slate-800 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shrink-0">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                Órdenes de Venta (OV) y Facturación
              </h1>
              <p className="text-xs text-slate-400 truncate max-w-xl">
                Gestión comercial unificada de pedidos vinculados a Licitaciones, Cotizaciones y Venta Directa
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={toggleKpiMinimized}
            className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-700 cursor-pointer"
            title={isKpiMinimized ? 'Expandir panel de resumen numérico' : 'Minimizar panel de resumen numérico'}
          >
            {isKpiMinimized ? (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-amber-400" />
                <span>Mostrar Resumen ({totalOrdersCount} OVs)</span>
              </>
            ) : (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                <span>Minimizar Resumen</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              setEditingOrder(null);
              setQuoteToConvert(null);
              setTenderToConvert(null);
              setIsNewOrderModalOpen(true);
            }}
            className="px-3.5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Orden de Venta</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Bar (Collapsible) */}
      {!isKpiMinimized && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 animate-fadeIn">
          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 shadow-md">
            <span className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider block mb-0.5">
              Total Órdenes (OV)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-white">{totalOrdersCount}</span>
              <span className="text-xs text-slate-400">pedidos</span>
            </div>
          </div>

          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900/80 border border-amber-500/30 shadow-md">
            <span className="text-[10.5px] font-semibold text-amber-400 uppercase tracking-wider block mb-0.5">
              En Proceso / Pedido
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-amber-400">{enProcesoCount}</span>
              <span className="text-xs text-slate-400">en gestión</span>
            </div>
          </div>

          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900/80 border border-blue-500/30 shadow-md">
            <span className="text-[10.5px] font-semibold text-blue-400 uppercase tracking-wider block mb-0.5">
              Equipos en Bodega
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-blue-400">{enBodegaCount}</span>
              <span className="text-xs text-slate-400">recibidos</span>
            </div>
          </div>

          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900/80 border border-purple-500/30 shadow-md">
            <span className="text-[10.5px] font-semibold text-purple-400 uppercase tracking-wider block mb-0.5">
              Facturadas al Cliente
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-black text-purple-400">{facturadasCount}</span>
              <span className="text-xs text-slate-400">con FE</span>
            </div>
          </div>

          <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900/80 border border-emerald-500/30 shadow-md col-span-2 sm:col-span-1">
            <span className="text-[10.5px] font-semibold text-emerald-400 uppercase tracking-wider block mb-0.5">
              Monto Total en OVs
            </span>
            <div className="truncate">
              <span className="text-base sm:text-lg font-black text-emerald-400">{formatCOP(totalOVValueCOP)}</span>
            </div>
          </div>
        </div>
      )}

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
            Órdenes de Venta (OV) ({salesOrders.length})
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

        {/* Action Button: New OV or Lock badge */}
        <div>
          {!isReadOnly ? (
            <button
              type="button"
              onClick={() => {
                setEditingOrder(null);
                setQuoteToConvert(null);
                setTenderToConvert(null);
                setIsNewOrderModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Orden de Venta (OV)</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-xs font-semibold">
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Modo Lectura (Sin permiso de edición)</span>
            </div>
          )}
        </div>
      </div>

      {/* SUBTAB 1: Órdenes de Venta (OV) */}
      {activeSubTab === 'orders' && (
        <div className="space-y-4">
          {/* Search & Filter bar */}
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
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

            <div className="flex items-center gap-2 flex-wrap">
              {/* Origin filter */}
              <span className="text-xs text-slate-400 font-medium">Origen:</span>
              <select
                value={orderOriginFilter}
                onChange={(e) => setOrderOriginFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-400"
              >
                <option value="all">Todos los Orígenes ({salesOrders.length})</option>
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

              {/* View Mode Toggle: Grid vs List */}
              <div className="flex items-center bg-slate-800 p-1 rounded-lg border border-slate-700">
                <button
                  type="button"
                  onClick={() => setOrdersViewMode('grid')}
                  className={`p-1.5 rounded-md transition-colors ${
                    ordersViewMode === 'grid'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Vista en Cuadrícula"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setOrdersViewMode('list')}
                  className={`p-1.5 rounded-md transition-colors ${
                    ordersViewMode === 'list'
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Vista en Lista / Tabla"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Orders Empty State */}
          {filteredOrders.length === 0 ? (
            <div className="py-12 text-center bg-slate-900/60 border border-slate-800 rounded-2xl">
              <PackageCheck className="w-12 h-12 text-slate-500 mx-auto mb-2 opacity-50" />
              <h3 className="text-sm font-bold text-white mb-1">No hay Órdenes de Venta que coincidan</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                Las OVs de licitaciones adjudicadas y cotizaciones se generan automáticamente aquí, o puedes crear una OV de venta directa.
              </p>
              <button
                onClick={() => {
                  setEditingOrder(null);
                  setQuoteToConvert(null);
                  setTenderToConvert(null);
                  setIsNewOrderModalOpen(true);
                }}
                className="px-4 py-2 bg-amber-500 text-slate-950 text-xs font-bold rounded-xl hover:bg-amber-400 transition-colors cursor-pointer"
              >
                Crear Primera OV
              </button>
            </div>
          ) : ordersViewMode === 'grid' ? (
            /* Orders Cards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredOrders.map((order) => {
                const canInvoice = order.status === 'Entregada al Cliente' || order.status === 'Facturada';
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

                      {/* OV Number and Reference */}
                      <div className="mb-3">
                        <span className="text-base font-black text-amber-400 font-mono tracking-tight block">
                          {order.salesOrderNumber}
                        </span>
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

                      {/* Equipment summary preview */}
                      <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-3 space-y-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                          Equipos ({order.items?.length || 0})
                        </span>
                        <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                          {order.items?.map((it, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs text-slate-300">
                              <span className="truncate pr-2">• {it.name}</span>
                              <span className="text-[11px] font-bold text-slate-400 shrink-0">x{it.quantityToDispatch}</span>
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
                          if (invData.isFullyInvoiced) {
                            return (
                              <div className="flex flex-col gap-0.5">
                                <span
                                  className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold"
                                  title={`Facturación Completa (100%): ${invData.invoiceNumbers}`}
                                >
                                  <ReceiptText className="w-3 h-3 text-emerald-400" /> Facturas: {invData.invoiceNumbers || 'Facturada Total'}
                                </span>
                                <span className="text-[9.5px] text-emerald-400 font-bold">
                                  ✓ 100% Facturado ({formatCOP(invData.totalInvoicedCOP)})
                                </span>
                              </div>
                            );
                          }
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
                                    setTargetSalesOrderForInvoice(order);
                                    setEditingInvoice(null);
                                    setIsAttachInvoiceModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-xs cursor-pointer"
                                  title={`Saldo pendiente por facturar: ${formatCOP(invData.remainingToInvoiceCOP)}. Haz clic para registrar otra factura.`}
                                >
                                  <ReceiptText className="w-3 h-3" /> Facturar ({formatCOP(invData.remainingToInvoiceCOP)} restante)
                                </button>
                              </div>
                            );
                          }
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setTargetSalesOrderForInvoice(order);
                                setEditingInvoice(null);
                                setIsAttachInvoiceModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-xs cursor-pointer"
                              title="Registrar factura(s) a esta Orden de Venta"
                            >
                              <ReceiptText className="w-3 h-3" /> Facturar
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
                      const canInvoice = order.status === 'Entregada al Cliente' || order.status === 'Facturada';
                      const originInfo = getOrderOriginInfo(order);
                      const OriginIcon = originInfo.icon;

                      return (
                        <tr key={order.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-mono font-bold text-amber-400 block text-sm">
                              {order.salesOrderNumber}
                            </span>
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
                          <td className="py-3 px-4">
                            <span className="font-semibold text-slate-200">{order.items?.length || 0} equipos</span>
                            <span className="text-[10px] text-slate-400 block">
                              {order.items?.reduce((acc, it) => acc + (it.quantityToDispatch || 1), 0)} unidades
                            </span>
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
                                if (newSt === 'Facturada' && !order.invoiceNumber) {
                                  setTargetSalesOrderForInvoice(order);
                                  setEditingInvoice(null);
                                  setIsAttachInvoiceModalOpen(true);
                                }
                              }}
                              className={`text-[11px] font-bold px-2 py-1 rounded-lg border bg-slate-900 focus:outline-none cursor-pointer ${getStatusBadge(order.status)}`}
                              title="Cambiar estado de la OV"
                            >
                              <option value="Borrador">Borrador</option>
                              <option value="En Proceso">En Proceso</option>
                              <option value="Equipos en Bodega">Equipos en Bodega</option>
                              <option value="Entregada al Cliente">Entregada al Cliente</option>
                              <option value="Facturada">Facturada</option>
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
                              if (invData.isFullyInvoiced) {
                                return (
                                  <div className="flex flex-col gap-0.5">
                                    <span
                                      className="inline-flex items-center gap-1 text-[11px] text-emerald-300 font-bold bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded"
                                      title={`Facturación Completa (100%): ${invData.invoiceNumbers}`}
                                    >
                                      <ReceiptText className="w-3.5 h-3.5 text-emerald-400" /> {invData.invoiceNumbers || 'Facturada Total'}
                                    </span>
                                    <span className="text-[9.5px] text-emerald-400 font-bold">
                                      ✓ 100% Facturado ({formatCOP(invData.totalInvoicedCOP)})
                                    </span>
                                  </div>
                                );
                              }
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
                                        setTargetSalesOrderForInvoice(order);
                                        setEditingInvoice(null);
                                        setIsAttachInvoiceModalOpen(true);
                                      }}
                                      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer transition shadow-xs"
                                      title={`Saldo pendiente por facturar: ${formatCOP(invData.remainingToInvoiceCOP)}. Haz clic para registrar otra factura.`}
                                    >
                                      <ReceiptText className="w-3 h-3" /> Facturar ({formatCOP(invData.remainingToInvoiceCOP)})
                                    </button>
                                  </div>
                                );
                              }
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTargetSalesOrderForInvoice(order);
                                    setEditingInvoice(null);
                                    setIsAttachInvoiceModalOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold cursor-pointer transition shadow-xs"
                                  title="Registrar factura(s) a esta Orden de Venta"
                                >
                                  <ReceiptText className="w-3 h-3" /> Facturar
                                </button>
                              );
                            })()}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
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
                <option value="Pendiente de Pago">Pendiente de Pago</option>
                <option value="Radicada en Cliente">Radicada en Cliente</option>
                <option value="Pagada / Cancelada">Pagada / Cancelada</option>
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

                        {/* Estado */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border ${
                              inv.paymentStatus === 'Pagada / Cancelada'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : inv.paymentStatus === 'Pendiente de Pago'
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                : inv.paymentStatus === 'Radicada en Cliente'
                                ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                                : inv.paymentStatus === 'Anulada'
                                ? 'bg-red-500/15 text-red-300 border-red-500/30'
                                : 'bg-slate-700 text-slate-300 border-slate-600'
                            }`}
                          >
                            {inv.paymentStatus}
                          </span>
                        </td>

                        {/* Soporte Adjunto */}
                        <td className="py-3 px-4 text-center">
                          {inv.attachedInvoiceFile ? (
                            <a
                              href={inv.attachedInvoiceFile.dataUrl}
                              download={inv.attachedInvoiceFile.name}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 transition cursor-pointer"
                              title={`Descargar: ${inv.attachedInvoiceFile.name}`}
                            >
                              <Paperclip className="w-3 h-3 text-purple-400" />
                              <span className="max-w-[100px] truncate">{inv.attachedInvoiceFile.name}</span>
                              <Download className="w-3 h-3 ml-0.5" />
                            </a>
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
    </div>
  );
};
