import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  Plus,
  FileDown,
  Eye,
  Edit3,
  Trash2,
  Copy,
  Printer,
  Calendar,
  Building2,
  DollarSign,
  CheckCircle2,
  Clock,
  Filter,
  FileSpreadsheet,
  X,
  Sparkles,
  ArrowUpDown,
  Layers,
  Check,
  Lock,
  PackageCheck,
  Award,
  ArrowRight,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import { googleWorkspaceService } from '../../services/googleWorkspaceService';
import { SavedQuote, QuoteStatus, QuoteHeader, QuoteItem, AuthUser } from '../../types';
import { formatCOP } from '../../utils/formatters';
import { exportQuoteToWord } from '../../utils/exportUtils';
import confetti from 'canvas-confetti';
import {
  ExcelColumnConfig,
  ExcelColumnHeader,
  useExcelTableFilters,
} from '../common/ExcelTableFilter';

const SAVED_QUOTE_COLUMNS: ExcelColumnConfig<SavedQuote>[] = [
  {
    id: 'quoteNumber',
    label: 'Consecutivo N°',
    type: 'text',
    accessor: (row) => row.quoteNumber || '',
  },
  {
    id: 'clientName',
    label: 'Cliente / Institución',
    type: 'text',
    accessor: (row) => `${row.clientName || ''} ${row.nit ? `(${row.nit})` : ''}`.trim(),
  },
  {
    id: 'date',
    label: 'Fecha',
    type: 'date',
    accessor: (row) => row.date || '',
  },
  {
    id: 'items',
    label: 'Equipos e Ítems',
    type: 'text',
    accessor: (row) => row.items?.map((it) => `${it.name} ${it.brand || ''} ${it.model || ''}`).join(', ') || '',
  },
  {
    id: 'total',
    label: 'Valor Total (COP)',
    type: 'number',
    accessor: (row) => row.total || 0,
    formatter: (val) => formatCOP(Number(val) || 0),
    align: 'right',
  },
  {
    id: 'status',
    label: 'Estado',
    type: 'enum',
    accessor: (row) => row.status || 'Borrador',
    align: 'center',
  },
];

interface QuotesHistoryViewProps {
  savedQuotes: SavedQuote[];
  onLoadQuoteIntoEditor: (quote: SavedQuote) => void;
  onCreateNewQuote: () => void;
  onUpdateQuoteStatus: (id: string, status: QuoteStatus) => void;
  onDeleteQuote: (id: string) => void;
  onDuplicateQuote: (id: string) => void;
  onConvertToSalesOrder?: (quote: SavedQuote) => void;
  onConvertToTender?: (quote: SavedQuote) => void;
  currentUser?: AuthUser | null;
}

const STATUS_CONFIG: Record<
  QuoteStatus,
  { label: string; bg: string; text: string; border: string; icon: any }
> = {
  Borrador: {
    label: 'Borrador',
    bg: 'bg-slate-500/15',
    text: 'text-slate-300',
    border: 'border-slate-500/40',
    icon: Clock,
  },
  Enviada: {
    label: 'Enviada',
    bg: 'bg-[#38bdf8]/15',
    text: 'text-[#38bdf8]',
    border: 'border-[#38bdf8]/40',
    icon: Clock,
  },
  Aprobada: {
    label: 'Aprobada',
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/40',
    icon: CheckCircle2,
  },
  Rechazada: {
    label: 'Rechazada',
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-500/40',
    icon: X,
  },
  Facturada: {
    label: 'Facturada',
    bg: 'bg-purple-500/15',
    text: 'text-purple-400',
    border: 'border-purple-500/40',
    icon: Sparkles,
  },
};

export const QuotesHistoryView: React.FC<QuotesHistoryViewProps> = ({
  savedQuotes,
  onLoadQuoteIntoEditor,
  onCreateNewQuote,
  onUpdateQuoteStatus,
  onDeleteQuote,
  onDuplicateQuote,
  onConvertToSalesOrder,
  onConvertToTender,
  currentUser,
}) => {
  const isReadOnly = currentUser?.role === 'viewer' && !currentUser?.permissions?.canManageQuotesHistory;
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'highest' | 'lowest'>('recent');
  const [previewQuote, setPreviewQuote] = useState<SavedQuote | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ESC key press handler to close modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteConfirmId) {
          setDeleteConfirmId(null);
        } else if (previewQuote) {
          setPreviewQuote(null);
        }
      }
    };

    if (deleteConfirmId || previewQuote) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [deleteConfirmId, previewQuote]);

  // Statistics
  const totalQuotesCount = savedQuotes.length;
  const totalAmountSum = savedQuotes.reduce((acc, q) => acc + (q.total || 0), 0);

  // Base search and status filter
  const baseQuotes = useMemo(() => {
    return savedQuotes
      .filter((q) => {
        const matchesSearch =
          !searchTerm ||
          q.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.nit.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()) ||
          q.items.some(
            (it) =>
              it.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              it.model.toLowerCase().includes(searchTerm.toLowerCase())
          );

        const matchesStatus = selectedStatus === 'all' || q.status === selectedStatus;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortOrder === 'highest') return (b.total || 0) - (a.total || 0);
        if (sortOrder === 'lowest') return (a.total || 0) - (b.total || 0);
        return (
          new Date(b.updatedAt || b.savedAt).getTime() -
          new Date(a.updatedAt || a.savedAt).getTime()
        );
      });
  }, [savedQuotes, searchTerm, selectedStatus, sortOrder]);

  // Excel filter hook
  const {
    filteredRows: filteredQuotes,
    filters: excelFilters,
    sort: excelSort,
    onApplyFilter,
    onApplySort,
    onClearColumnFilter,
    onResetAllFilters,
    isFilteredOrSorted,
  } = useExcelTableFilters(baseQuotes, SAVED_QUOTE_COLUMNS);

  const handleExportWordForQuote = async (quote: SavedQuote) => {
    const header: QuoteHeader = {
      quoteNumber: quote.quoteNumber,
      clientName: quote.clientName,
      nit: quote.nit,
      contactPerson: quote.contactPerson,
      contactEmail: quote.contactEmail,
      contactPhone: quote.contactPhone,
      city: quote.city,
      date: quote.date,
      validityDays: quote.validityDays,
      paymentTerms: quote.paymentTerms,
      deliveryTime: quote.deliveryTime,
      deliveryPlace: quote.deliveryPlace,
      warrantyTerms: quote.warrantyTerms,
      trainingTerms: quote.trainingTerms,
      taxRate: quote.taxRate,
      advisorName: quote.advisorName,
      advisorRole: quote.advisorRole,
      advisorPhone: quote.advisorPhone,
      advisorEmail: quote.advisorEmail,
      notes: quote.notes,
    };

    await exportQuoteToWord(header, quote.items, {
      headerMarginTop: quote.marginSettings?.subirBajar || 154,
      sidePadding: quote.marginSettings?.izqDer || 78,
      companyLetterheadUrl: quote.letterheadUrl || undefined,
    });

    confetti({
      particleCount: 40,
      spread: 50,
      origin: { y: 0.8 },
    });
  };

  const handleExportCSV = () => {
    const headers = ['Consecutivo', 'Fecha', 'Cliente', 'NIT', 'Contacto', 'Items', 'Subtotal COP', 'IVA COP', 'Total COP', 'Estado'];
    const rows = filteredQuotes.map((q) => [
      `"${q.quoteNumber}"`,
      `"${q.date}"`,
      `"${q.clientName.replace(/"/g, '""')}"`,
      `"${q.nit}"`,
      `"${q.contactPerson.replace(/"/g, '""')}"`,
      q.totalQuantity || q.items.length,
      q.subtotal,
      q.iva,
      q.total,
      `"${q.status}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Reporte_Cotizaciones_SyD_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [isExportingSheets, setIsExportingSheets] = useState(false);
  const handleExportGoogleSheet = () => {
    const existingSheet = googleWorkspaceService.getConnectedSpreadsheet();
    if (existingSheet?.url) {
      window.open(existingSheet.url, '_blank');
      return;
    }
    window.dispatchEvent(new CustomEvent('syd-open-workspace-modal', { detail: { tab: 'sheets' } }));
  };

  return (
    <div className="space-y-6">
      {/* Read-Only Mode Banner for Investigator */}
      {isReadOnly && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs font-semibold flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Modo Consulta Activo (Usuario Investigador):</strong> Puede consultar el historial, visualizar detalles y descargar cotizaciones en Word y CSV. La creación, duplicación, cambio de estado y eliminación está restringida al Administrador.
            </span>
          </div>
          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-md text-[10px] font-bold border border-emerald-500/40 uppercase whitespace-nowrap">
            Solo Lectura
          </span>
        </div>
      )}

      {/* Compact KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-[#192b45] px-4 py-3 rounded-xl border border-[#334d6e]/70 flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-semibold block">Total Cotizaciones</span>
            <p className="text-2xl font-black text-white mt-0.5">{totalQuotesCount}</p>
            <p className="text-[11px] text-slate-400">Guardadas en el sistema</p>
          </div>
          <div className="p-3 bg-[#0284c7]/20 border border-[#0284c7]/40 rounded-xl text-[#38bdf8]">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#192b45] px-4 py-3 rounded-xl border border-[#334d6e]/70 flex items-center justify-between">
          <div>
            <span className="text-slate-400 text-xs font-semibold block">Valor Total Cotizado</span>
            <p className="text-2xl font-black text-emerald-400 font-mono mt-0.5">
              {formatCOP(totalAmountSum)}
            </p>
            <p className="text-[11px] text-slate-400">Con IVA incluido</p>
          </div>
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-400">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#192b45] p-4 rounded-xl border border-[#334d6e]/70 flex flex-col md:flex-row items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="search-quotes-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por N° consecutivo, cliente, NIT, contacto o equipo..."
            className="w-full bg-[#15253d] text-white text-xs pl-9 pr-3.5 py-2.5 rounded-xl border border-[#334d6e] focus:border-[#38bdf8] outline-none transition"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 w-full md:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            id="filter-status-select"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-[#15253d] text-slate-200 text-xs px-3 py-2.5 rounded-xl border border-[#334d6e] focus:border-[#38bdf8] outline-none cursor-pointer"
          >
            <option value="all">Todos los Estados</option>
            <option value="Borrador">Borrador</option>
            <option value="Enviada">Enviada</option>
            <option value="Aprobada">Aprobada</option>
            <option value="Rechazada">Rechazada</option>
            <option value="Facturada">Facturada</option>
          </select>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5 w-full md:w-auto">
          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
          <select
            id="sort-quotes-select"
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="bg-[#15253d] text-slate-200 text-xs px-3 py-2.5 rounded-xl border border-[#334d6e] focus:border-[#38bdf8] outline-none cursor-pointer"
          >
            <option value="recent">Más Recientes Primero</option>
            <option value="highest">Mayor Valor ($)</option>
            <option value="lowest">Menor Valor ($)</option>
          </select>
        </div>

        {/* Export Buttons */}
        <div className="flex items-center gap-2 ml-auto shrink-0 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={handleExportCSV}
            title="Descargar reporte completo en formato CSV"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#15253d] hover:bg-[#1f375a] text-cyan-200 border border-cyan-500/40 text-xs font-bold transition cursor-pointer active:scale-95"
          >
            <FileDown className="w-3.5 h-3.5 text-cyan-300" />
            <span>CSV</span>
          </button>

          <button
            type="button"
            onClick={handleExportGoogleSheet}
            title="Conectar o abrir hoja de Google Sheets de Google Drive en modo solo lectura"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 hover:text-white border border-emerald-500/50 hover:border-emerald-400 text-xs font-bold transition cursor-pointer active:scale-95"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Google Sheets (Solo Lectura)</span>
          </button>
        </div>
      </div>

      {/* Main Quotes List Table */}
      <div className="bg-[#192b45] rounded-2xl border border-[#334d6e] overflow-hidden shadow-lg">
        {filteredQuotes.length === 0 ? (
          <div className="p-12 text-center">
            <Layers className="w-12 h-12 text-slate-500 mx-auto mb-3 opacity-40" />
            <h3 className="text-base font-bold text-slate-200">No se encontraron cotizaciones</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              {searchTerm || selectedStatus !== 'all'
                ? 'Intenta ajustar tus criterios de búsqueda o filtro.'
                : 'Aún no hay cotizaciones guardadas. Las cotizaciones que guardes desde la ventana de Cotizaciones aparecerán aquí.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#15253d] text-slate-300 border-b border-[#334d6e]">
                  {SAVED_QUOTE_COLUMNS.map((col) => (
                    <th
                      key={col.id}
                      className="py-2.5 px-3"
                      style={{ minWidth: col.minWidth, width: col.width }}
                    >
                      <ExcelColumnHeader
                        column={col}
                        allRows={baseQuotes}
                        filters={excelFilters}
                        sort={excelSort}
                        onApplyFilter={onApplyFilter}
                        onApplySort={onApplySort}
                        onClearColumnFilter={onClearColumnFilter}
                      />
                    </th>
                  ))}
                  <th className="py-2.5 px-3 font-bold text-right text-slate-300 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Acciones</span>
                      {isFilteredOrSorted && (
                        <button
                          type="button"
                          onClick={onResetAllFilters}
                          className="inline-flex items-center gap-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded px-1.5 py-0.5 text-[10px] font-bold transition cursor-pointer"
                          title="Restablecer todos los filtros Excel"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>Limpiar</span>
                        </button>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334d6e]/60">
                {filteredQuotes.map((quote) => {
                  const statusConf = STATUS_CONFIG[quote.status] || STATUS_CONFIG.Borrador;
                  const isDeleting = deleteConfirmId === quote.id;

                  return (
                    <tr
                      key={quote.id}
                      className="hover:bg-[#1f3555]/50 transition duration-150 group"
                    >
                      {/* Consecutivo */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-[#38bdf8] bg-[#0284c7]/10 px-2 py-0.5 rounded border border-[#0284c7]/30">
                            {quote.quoteNumber}
                          </span>
                        </div>
                      </td>

                      {/* Cliente */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white max-w-[240px] truncate">
                          {quote.clientName}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <Building2 className="w-3 h-3 text-slate-500" />
                          <span>{quote.nit || 'Sin NIT'}</span>
                          {quote.city && <span>• {quote.city}</span>}
                        </div>
                      </td>

                      {/* Fecha */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-300 text-[11px]">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{quote.date}</span>
                        </div>
                      </td>

                      {/* Equipos */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[260px]">
                          {quote.items.slice(0, 2).map((it, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] bg-[#15253d] text-slate-300 px-1.5 py-0.5 rounded border border-[#334d6e] truncate max-w-[200px]"
                              title={it.name}
                            >
                              {it.quantity}x {it.model || it.name}
                            </span>
                          ))}
                          {quote.items.length > 2 && (
                            <span className="text-[10px] bg-[#0284c7]/20 text-[#38bdf8] px-1.5 py-0.5 rounded font-bold">
                              +{quote.items.length - 2} más
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="font-mono font-black text-sm text-emerald-400">
                          {formatCOP(quote.total)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Subtotal: {formatCOP(quote.subtotal)}
                        </div>
                      </td>

                      {/* Estado */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <select
                          disabled={isReadOnly}
                          value={quote.status}
                          onChange={(e) => onUpdateQuoteStatus(quote.id, e.target.value as QuoteStatus)}
                          className={`text-[11px] font-bold px-2 py-1 rounded-lg border outline-none transition ${isReadOnly ? 'cursor-default' : 'cursor-pointer'} ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}
                        >
                          <option value="Borrador" className="bg-[#15253d] text-slate-200">Borrador</option>
                          <option value="Enviada" className="bg-[#15253d] text-slate-200">Enviada</option>
                          <option value="Aprobada" className="bg-[#15253d] text-slate-200">Aprobada</option>
                          <option value="Rechazada" className="bg-[#15253d] text-slate-200">Rechazada</option>
                          <option value="Facturada" className="bg-[#15253d] text-slate-200">Facturada</option>
                        </select>
                      </td>

                      {/* Acciones */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {isDeleting ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="text-[11px] text-red-300 font-bold">¿Borrar?</span>
                            <button
                              onClick={() => {
                                onDeleteQuote(quote.id);
                                setDeleteConfirmId(null);
                              }}
                              className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold px-2 py-1 rounded cursor-pointer"
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="bg-slate-700 hover:bg-slate-600 text-white text-[10px] px-2 py-1 rounded cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            {/* Ver Preview */}
                            <button
                              id={`btn-view-quote-${quote.id}`}
                              onClick={() => setPreviewQuote(quote)}
                              title="Ver detalle de la cotización"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#15253d] transition cursor-pointer"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Cargar en Editor */}
                            <button
                              id={`btn-edit-quote-${quote.id}`}
                              onClick={() => onLoadQuoteIntoEditor(quote)}
                              title={isReadOnly ? "Visualizar en formato de ventas" : "Cargar y editar en Vista de Ventas"}
                              className="p-1.5 rounded-lg text-[#38bdf8] hover:text-white hover:bg-[#0284c7] transition cursor-pointer"
                            >
                              {isReadOnly ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                            </button>

                            {/* Exportar Word */}
                            <button
                              id={`btn-export-word-${quote.id}`}
                              onClick={() => handleExportWordForQuote(quote)}
                              title="Descargar en formato Word (.docx)"
                              className="p-1.5 rounded-lg text-blue-400 hover:text-white hover:bg-blue-600 transition cursor-pointer"
                            >
                              <FileDown className="w-4 h-4" />
                            </button>

                            {/* Convertir a Orden de Venta (OV) */}
                            {onConvertToSalesOrder && !isReadOnly && (
                              <button
                                id={`btn-convert-ov-${quote.id}`}
                                onClick={() => onConvertToSalesOrder(quote)}
                                title="Generar Orden de Venta (OV) y OC a proveedores"
                                className="p-1.5 rounded-lg text-emerald-400 hover:text-white hover:bg-emerald-600/80 transition cursor-pointer"
                              >
                                <PackageCheck className="w-4 h-4" />
                              </button>
                            )}

                            {/* Convertir a Licitación / Contrato */}
                            {onConvertToTender && !isReadOnly && (
                              <button
                                id={`btn-convert-tender-${quote.id}`}
                                onClick={() => onConvertToTender(quote)}
                                title="Convertir a Licitación / Contrato con pliegos y specs"
                                className="p-1.5 rounded-lg text-purple-300 hover:text-white hover:bg-purple-600/80 transition cursor-pointer"
                              >
                                <Building2 className="w-4 h-4" />
                              </button>
                            )}

                            {/* Duplicar */}
                            {!isReadOnly && (
                              <button
                                id={`btn-dup-quote-${quote.id}`}
                                onClick={() => onDuplicateQuote(quote.id)}
                                title="Duplicar cotización (+1 consecutivo nuevo)"
                                className="p-1.5 rounded-lg text-amber-400 hover:text-white hover:bg-amber-600 transition cursor-pointer"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            )}

                            {/* Eliminar */}
                            {!isReadOnly && (
                              <button
                                id={`btn-delete-quote-${quote.id}`}
                                onClick={() => setDeleteConfirmId(quote.id)}
                                title="Eliminar de la base de datos"
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/20 transition cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAIL / PREVIEW MODAL */}
      {previewQuote && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4">
          <div className="bg-[#192b45] border border-[#334d6e] rounded-2xl w-full max-w-5xl max-h-[92vh] h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#334d6e] flex items-center justify-between bg-[#15253d]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#0284c7]/20 border border-[#0284c7]/40 rounded-xl text-[#38bdf8]">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>Cotización N° {previewQuote.quoteNumber}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        STATUS_CONFIG[previewQuote.status].bg
                      } ${STATUS_CONFIG[previewQuote.status].text} ${
                        STATUS_CONFIG[previewQuote.status].border
                      }`}
                    >
                      {previewQuote.status}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">{previewQuote.date} • {previewQuote.clientName}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {onConvertToSalesOrder && !isReadOnly && (
                  <button
                    onClick={() => {
                      onConvertToSalesOrder(previewQuote);
                      setPreviewQuote(null);
                    }}
                    className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer shadow"
                    title="Crear Orden de Venta y generar OCs a proveedores"
                  >
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>Generar OV</span>
                  </button>
                )}

                {onConvertToTender && !isReadOnly && (
                  <button
                    onClick={() => {
                      onConvertToTender(previewQuote);
                      setPreviewQuote(null);
                    }}
                    className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer shadow"
                    title="Crear Licitación con pliegos y especificaciones técnicas"
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>Crear Licitación</span>
                  </button>
                )}

                <button
                  onClick={() => handleExportWordForQuote(previewQuote)}
                  className="inline-flex items-center gap-1.5 bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer shadow"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Descargar Word</span>
                </button>

                <button
                  onClick={() => {
                    onLoadQuoteIntoEditor(previewQuote);
                    setPreviewQuote(null);
                  }}
                  className="inline-flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition cursor-pointer shadow"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Cargar en Editor</span>
                </button>

                <button
                  onClick={() => setPreviewQuote(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-200">
              {/* Client and Commercial Data Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#15253d] p-4 rounded-xl border border-[#334d6e]">
                <div>
                  <h4 className="font-bold text-[#38bdf8] mb-2 uppercase tracking-wider text-[11px]">
                    Datos del Cliente / Institución
                  </h4>
                  <div className="space-y-1 text-slate-300">
                    <p><span className="text-slate-400">Razón Social:</span> <strong className="text-white">{previewQuote.clientName}</strong></p>
                    <p><span className="text-slate-400">NIT:</span> {previewQuote.nit || 'N/A'}</p>
                    <p><span className="text-slate-400">Contacto:</span> {previewQuote.contactPerson || 'N/A'}</p>
                    <p><span className="text-slate-400">Teléfono:</span> {previewQuote.contactPhone || 'N/A'}</p>
                    <p><span className="text-slate-400">Email:</span> {previewQuote.contactEmail || 'N/A'}</p>
                    <p><span className="text-slate-400">Ciudad:</span> {previewQuote.city || 'N/A'}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-[#38bdf8] mb-2 uppercase tracking-wider text-[11px]">
                    Condiciones Comerciales
                  </h4>
                  <div className="space-y-1 text-slate-300">
                    <p><span className="text-slate-400">Validez de Oferta:</span> {previewQuote.validityDays} días</p>
                    <p><span className="text-slate-400">Forma de Pago:</span> {previewQuote.paymentTerms}</p>
                    <p><span className="text-slate-400">Tiempo de Entrega:</span> {previewQuote.deliveryTime}</p>
                    <p><span className="text-slate-400">Lugar de Entrega:</span> {previewQuote.deliveryPlace}</p>
                    <p><span className="text-slate-400">Garantía:</span> {previewQuote.warrantyTerms}</p>
                    <p><span className="text-slate-400">Asesor Comercial:</span> {previewQuote.advisorName} ({previewQuote.advisorPhone})</p>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="font-bold text-white mb-2 text-sm">Ítems y Equipos Cotizados ({previewQuote.items.length})</h4>
                <div className="rounded-xl border border-[#334d6e] overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#15253d] text-slate-300 border-b border-[#334d6e]">
                        <th className="py-2.5 px-3 font-bold">Ítem</th>
                        <th className="py-2.5 px-3 font-bold">Descripción del Equipo</th>
                        <th className="py-2.5 px-3 font-bold">Marca / Modelo</th>
                        <th className="py-2.5 px-3 font-bold text-center">Cant.</th>
                        <th className="py-2.5 px-3 font-bold text-right">Valor Unitario</th>
                        <th className="py-2.5 px-3 font-bold text-right">Valor Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#334d6e]/50">
                      {previewQuote.items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-[#15253d]/40">
                          <td className="py-2.5 px-3 font-bold text-slate-400">{idx + 1}</td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-white">{item.name}</div>
                            {item.notes && <div className="text-[10px] text-slate-400 italic">{item.notes}</div>}
                            {item.accessories && item.accessories.length > 0 && (
                              <div className="mt-1 text-[10px] text-slate-400">
                                <strong>Accesorios:</strong> {item.accessories.map((a) => a.name).join(', ')}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            <span className="font-semibold text-white">{item.brand}</span> - {item.model}
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold">{item.quantity}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{formatCOP(item.unitSalePrice)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                            {formatCOP(item.totalSalePrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Summary */}
              <div className="flex justify-end">
                <div className="bg-[#15253d] p-4 rounded-xl border border-[#334d6e] w-full max-w-xs space-y-2">
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>Subtotal:</span>
                    <span className="font-mono font-bold">{formatCOP(previewQuote.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-300">
                    <span>IVA (19%):</span>
                    <span className="font-mono font-bold">{formatCOP(previewQuote.iva)}</span>
                  </div>
                  <div className="pt-2 border-t border-[#334d6e] flex justify-between text-sm font-black text-emerald-400">
                    <span>Total COP:</span>
                    <span className="font-mono">{formatCOP(previewQuote.total)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
