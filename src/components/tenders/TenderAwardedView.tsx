import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  Award,
  UploadCloud,
  FileCheck2,
  Calendar,
  Building2,
  Sliders,
  DollarSign,
  ArrowRight,
  RefreshCw,
  Clock,
  ShieldCheck,
  Stethoscope,
  AlertTriangle,
  X,
  RotateCcw,
} from 'lucide-react';
import { TenderClientProject, TenderItem } from '../../types';
import { formatCOP } from '../../utils/formatters';
import {
  ExcelColumnConfig,
  ExcelColumnHeader,
  useExcelTableFilters,
} from '../common/ExcelTableFilter';

const TENDER_ITEM_COLUMNS: ExcelColumnConfig<TenderItem>[] = [
  {
    id: 'code',
    label: 'Parte / Código',
    type: 'text',
    accessor: (row) => row.code || '',
    minWidth: '100px',
  },
  {
    id: 'name',
    label: 'Equipo Biomédico',
    type: 'text',
    accessor: (row) => row.name || '',
    minWidth: '180px',
  },
  {
    id: 'brandModel',
    label: 'Marca / Modelo',
    type: 'text',
    accessor: (row) => `${row.brand || ''} ${row.model || ''}`.trim(),
    minWidth: '130px',
  },
  {
    id: 'quantity',
    label: 'Cant.',
    type: 'number',
    accessor: (row) => row.quantity || 1,
    align: 'center',
    minWidth: '60px',
  },
  {
    id: 'unitPrice',
    label: 'Precio Unitario',
    type: 'number',
    accessor: (row) => row.offeredUnitPrice || 0,
    formatter: (val) => formatCOP(Number(val) || 0),
    align: 'right',
    minWidth: '130px',
  },
  {
    id: 'subtotal',
    label: 'Subtotal (Sin IVA)',
    type: 'number',
    accessor: (row) => (row.quantity || 1) * (row.offeredUnitPrice || 0),
    formatter: (val) => formatCOP(Number(val) || 0),
    align: 'right',
    minWidth: '120px',
  },
  {
    id: 'totalWithIva',
    label: 'Total Fila (Con IVA)',
    type: 'number',
    accessor: (row) => {
      const sub = (row.quantity || 1) * (row.offeredUnitPrice || 0);
      const tax = row.taxRate !== undefined ? row.taxRate : 0.19;
      return sub + Math.round(sub * tax);
    },
    formatter: (val) => formatCOP(Number(val) || 0),
    align: 'right',
    minWidth: '130px',
  },
  {
    id: 'specs',
    label: 'Especificaciones',
    type: 'number',
    accessor: (row) => row.requirements?.length || 0,
    formatter: (val) => `${val} specs`,
    align: 'center',
    minWidth: '110px',
  },
];

interface TenderAwardedViewProps {
  activeClient: TenderClientProject;
  onUpdateClient: (clientId: string, updates: Partial<TenderClientProject>) => void;
  onUpdateTenderItem: (clientId: string, itemId: string, updates: Partial<TenderItem>) => void;
  onDeleteTenderItem: (clientId: string, itemId: string) => void;
  onOpenExcelImportModal: () => void;
  onOpenCatalogModal: () => void;
  onOpenManualItemModal: () => void;
  onOpenEditClientModal: () => void;
  onDownloadExcelTemplate: () => void;
  onSwitchToSpecificationsTab: (filterItemId?: string) => void;
  onNavigateToOCTracking?: () => void;
  isReadOnly?: boolean;
}

export const TenderAwardedView: React.FC<TenderAwardedViewProps> = ({
  activeClient,
  onUpdateClient,
  onUpdateTenderItem,
  onDeleteTenderItem,
  onOpenExcelImportModal,
  onOpenCatalogModal,
  onOpenManualItemModal,
  onOpenEditClientModal,
  onDownloadExcelTemplate,
  onSwitchToSpecificationsTab,
  onNavigateToOCTracking,
  isReadOnly,
}) => {
  const [isConfirmClearModalOpen, setIsConfirmClearModalOpen] = useState(false);
  const items = activeClient.items || [];
  const defaultTaxRate = 0.19; // 19% IVA standard

  // Excel table filter hook
  const {
    filteredRows: filteredItems,
    filters: excelFilters,
    sort: excelSort,
    onApplyFilter,
    onApplySort,
    onClearColumnFilter,
    onResetAllFilters,
    isFilteredOrSorted,
  } = useExcelTableFilters(items, TENDER_ITEM_COLUMNS);

  const totalUnits = items.reduce((acc, it) => acc + (it.quantity || 1), 0);
  const totalSubtotalCOP = items.reduce(
    (acc, it) => acc + (it.quantity || 1) * (it.offeredUnitPrice || 0),
    0
  );
  const totalIvaCOP = items.reduce((acc, it) => {
    const sub = (it.quantity || 1) * (it.offeredUnitPrice || 0);
    const rate = it.taxRate !== undefined ? it.taxRate : defaultTaxRate;
    return acc + Math.round(sub * rate);
  }, 0);
  const grandTotalCOP = totalSubtotalCOP + totalIvaCOP;

  const totalSpecsCount = items.reduce((acc, it) => acc + (it.requirements?.length || 0), 0);
  const isAwarded = activeClient.status === 'Adjudicada';

  const handleStatusChange = (newStatus: TenderClientProject['status']) => {
    onUpdateClient(activeClient.id, { status: newStatus });
  };

  const handleConfirmClearTable = () => {
    onUpdateClient(activeClient.id, { items: [] });
    setIsConfirmClearModalOpen(false);
  };

  return (
    <div className="space-y-3 animate-fadeIn">
      {/* Contract Status & Executive Overview Banner (Compact & High-Density) */}
      <div className="bg-[#192b45] border border-[#334d6e] rounded-xl p-3 shadow-md space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-[#334d6e]">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-[11px] font-mono font-bold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">
              {activeClient.header.processNumber || 'Sin proceso'}
            </span>
            <h3 className="text-sm sm:text-base font-black text-white truncate">
              {activeClient.clientName}
            </h3>
            {isAwarded ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full shadow-xs">
                <Award className="w-3 h-3" />
                <span>ADJUDICADA</span>
              </span>
            ) : (
              <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                {activeClient.status || 'En Preparación'}
              </span>
            )}
            <span className="text-xs text-slate-400 font-medium truncate">• {activeClient.header.city}</span>
          </div>

          {/* Status Quick Switcher & Actions */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {!isReadOnly && (
              <>
                {isAwarded ? (
                  <button
                    type="button"
                    onClick={() => handleStatusChange('En Preparación')}
                    className="inline-flex items-center gap-1 text-xs text-slate-300 bg-[#15253d] hover:bg-[#1e314b] border border-[#334d6e] px-2.5 py-1 rounded-lg font-bold transition cursor-pointer"
                  >
                    <span>Cambiar a En Preparación</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleStatusChange('Adjudicada')}
                    className="inline-flex items-center gap-1 text-xs text-slate-950 bg-emerald-400 hover:bg-emerald-300 px-3 py-1 rounded-lg font-black transition cursor-pointer shadow-sm active:scale-95"
                    title="Marca este contrato como adjudicado"
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>Marcar Adjudicada</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={onOpenEditClientModal}
                  className="inline-flex items-center gap-1 text-xs text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 px-2.5 py-1 rounded-lg border border-amber-500/30 font-bold transition cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Editar</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Compact Financial & Quantity Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          <div className="bg-[#15253d] px-2.5 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-950/20">
            <span className="text-[9.5px] text-emerald-300 font-bold block">
              Presupuesto Contrato
            </span>
            <strong className="text-xs sm:text-sm font-black text-emerald-300 block truncate">
              {activeClient.header.budgetCOP > 0 ? formatCOP(activeClient.header.budgetCOP) : 'Sin definir'}
            </strong>
          </div>

          <div className="bg-[#15253d] px-2.5 py-1.5 rounded-lg border border-[#334d6e]">
            <span className="text-[9.5px] text-slate-400 block font-medium">Equipos / Ítems</span>
            <strong className="text-xs sm:text-sm font-bold text-white block truncate">{items.length} Tipos ({totalUnits} ud)</strong>
          </div>

          <div className="bg-[#15253d] px-2.5 py-1.5 rounded-lg border border-[#334d6e]">
            <span className="text-[9.5px] text-slate-400 block font-medium">Subtotal sin IVA</span>
            <strong className="text-xs sm:text-sm font-bold text-slate-200 block truncate">{formatCOP(totalSubtotalCOP)}</strong>
          </div>

          <div className="bg-[#15253d] px-2.5 py-1.5 rounded-lg border border-[#334d6e]">
            <span className="text-[9.5px] text-amber-400/90 block font-medium">Total Contrato (IVA)</span>
            <strong className="text-xs sm:text-sm font-black text-amber-300 block truncate">{formatCOP(grandTotalCOP)}</strong>
          </div>

          <div className="bg-[#15253d] px-2.5 py-1.5 rounded-lg border border-sky-500/40">
            <span className="text-[9.5px] text-sky-300 font-bold block truncate">
              Plazo Ejecución
            </span>
            <strong className="text-xs font-black text-white truncate block">
              {activeClient.header.executionTerm || 'No especificado'}
            </strong>
          </div>

          <div className="bg-[#15253d] px-2.5 py-1.5 rounded-lg border border-purple-500/40">
            <span className="text-[9.5px] text-purple-300 font-bold block truncate">
              Especificaciones
            </span>
            <strong className="text-xs font-black text-purple-200 truncate block">
              {totalSpecsCount} Requisitos
            </strong>
          </div>
        </div>
      </div>

      {/* Equipment Table for this Contract with Integrated Compact Actions */}
      <div className="bg-[#192b45] border border-[#334d6e] rounded-xl overflow-hidden shadow-md">
        <div className="bg-[#15253d] px-3.5 py-2.5 border-b border-[#334d6e] flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
              <span>Listado de Equipos del Contrato ({items.length})</span>
            </h4>
            <span className="text-[10px] text-purple-300 font-bold bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30">
              {totalUnits} unidades
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={onDownloadExcelTemplate}
              className="inline-flex items-center gap-1 text-[11px] text-slate-300 bg-[#111c2e] hover:bg-[#1e314b] hover:text-white px-2.5 py-1.5 rounded-lg border border-[#334d6e] font-bold transition cursor-pointer"
              title="Descargar plantilla Excel"
            >
              <Download className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span className="hidden sm:inline">Plantilla Excel</span>
            </button>

            {!isReadOnly && (
              <>
                <button
                  type="button"
                  onClick={onOpenExcelImportModal}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-950 bg-emerald-400 hover:bg-emerald-300 px-3 py-1.5 rounded-lg font-black transition cursor-pointer shadow-xs active:scale-95"
                  title="Importar archivo Excel con equipos"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>Importar Excel</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenCatalogModal}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-950 bg-[#38bdf8] hover:bg-[#0284c7] px-3 py-1.5 rounded-lg font-black transition cursor-pointer shadow-xs active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>+ De Catálogo</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenManualItemModal}
                  className="inline-flex items-center gap-1 text-[11px] text-purple-200 bg-purple-500/20 hover:bg-purple-500/30 px-2.5 py-1.5 rounded-lg border border-purple-500/40 font-bold transition cursor-pointer"
                >
                  <Stethoscope className="w-3.5 h-3.5 text-purple-300" />
                  <span>+ Manual</span>
                </button>

                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsConfirmClearModalOpen(true)}
                    className="inline-flex items-center gap-1 text-[11px] text-rose-300 hover:text-white bg-rose-500/15 hover:bg-rose-600/80 border border-rose-500/30 px-2.5 py-1.5 rounded-lg font-bold transition cursor-pointer"
                    title="Eliminar todos los equipos para dejar la tabla nueva y limpia"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Vaciar Tabla</span>
                  </button>
                )}
              </>
            )}

            <button
              type="button"
              onClick={() => onSwitchToSpecificationsTab()}
              className="inline-flex items-center gap-1 text-[11px] text-purple-300 hover:text-white bg-purple-950/80 hover:bg-purple-900 border border-purple-500/40 px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ml-1"
            >
              <span>Specs ({totalSpecsCount})</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Modal de Confirmación para Vaciar Tabla */}
        {isConfirmClearModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-fadeIn">
            <div className="bg-[#192b45] border border-rose-500/50 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4 animate-scaleUp">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="space-y-1 flex-1 min-w-0">
                  <h3 className="text-base font-black text-white">¿Vaciar toda la tabla de equipos?</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Se eliminarán los <strong className="text-rose-300">{items.length} equipos</strong> registrados en este contrato junto con sus especificaciones para dejar la tabla completamente limpia y nueva.
                  </p>
                </div>
              </div>

              <div className="bg-[#111c2e] p-3 rounded-xl border border-[#334d6e] text-[11px] text-slate-300">
                <p>✓ La tabla quedará vacía lista para importar un nuevo archivo Excel o agregar nuevos equipos.</p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#334d6e]">
                <button
                  type="button"
                  onClick={() => setIsConfirmClearModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-[#15253d] transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClearTable}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-500 text-white transition cursor-pointer shadow-lg active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Sí, Vaciar y Dejar Nueva</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {items.length === 0 ? (
          <div className="p-10 text-center space-y-3">
            <div className="p-3 bg-purple-500/10 text-purple-300 rounded-full w-14 h-14 mx-auto flex items-center justify-center border border-purple-500/20">
              <FileSpreadsheet className="w-7 h-7" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-white">No hay equipos registrados en este contrato aún</p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Utilice los botones de la barra superior para adjuntar su archivo Excel (.xlsx), agregar equipos desde el catálogo o registrar un equipo manual.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-[#111e30] text-slate-300 font-bold border-b border-[#334d6e]">
                <tr>
                  <th className="p-2.5 text-center w-10 text-slate-400">#</th>
                  {TENDER_ITEM_COLUMNS.map((col) => (
                    <th
                      key={col.id}
                      className="p-2.5"
                      style={{ minWidth: col.minWidth, width: col.width }}
                    >
                      <ExcelColumnHeader
                        column={col}
                        allRows={items}
                        filters={excelFilters}
                        sort={excelSort}
                        onApplyFilter={onApplyFilter}
                        onApplySort={onApplySort}
                        onClearColumnFilter={onClearColumnFilter}
                      />
                    </th>
                  ))}
                  <th className="p-2.5 text-right w-20 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <span>Acciones</span>
                      {isFilteredOrSorted && (
                        <button
                          type="button"
                          onClick={onResetAllFilters}
                          className="inline-flex items-center gap-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded px-1.5 py-0.5 text-[10px] font-bold transition cursor-pointer"
                          title="Restablecer filtros Excel"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>Limpiar</span>
                        </button>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#334d6e]/50">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-6 text-slate-400 text-xs">
                      No se encontraron equipos con los filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => {
                  const itemSpecsCount = item.requirements?.length || 0;
                  const itemUniqueCount = item.requirements?.filter((r) => r.isUnique)?.length || 0;
                  const qty = item.quantity || 1;
                  const unitSinIVA = item.offeredUnitPrice || 0;
                  const itemTaxRate = item.taxRate !== undefined ? item.taxRate : defaultTaxRate;
                  const unitConIVA = Math.round(unitSinIVA * (1 + itemTaxRate));
                  const rowSubtotalSinIVA = qty * unitSinIVA;
                  const rowTotalConIVA = Math.round(rowSubtotalSinIVA * (1 + itemTaxRate));

                  return (
                    <tr key={item.id} className="hover:bg-[#17263c] transition">
                      <td className="p-2.5 text-center font-mono font-bold text-purple-300">{idx + 1}</td>
                      <td className="p-2.5 font-mono text-[11px] font-bold text-[#38bdf8] whitespace-nowrap">
                        {item.code}
                      </td>
                      <td className="p-2.5 font-bold text-white">
                        <div className="line-clamp-1" title={item.name}>{item.name}</div>
                        {item.observations && (
                          <span className="text-[10px] text-slate-400 block font-normal truncate max-w-xs">
                            {item.observations}
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-slate-300">
                        <div className="font-semibold text-slate-200 truncate">{item.brand}</div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">{item.model}</div>
                      </td>
                      <td className="p-2.5 text-center">
                        <input
                          type="number"
                          min="1"
                          disabled={isReadOnly}
                          value={item.quantity}
                          onChange={(e) =>
                            onUpdateTenderItem(activeClient.id, item.id, {
                              quantity: Math.max(1, parseInt(e.target.value) || 1),
                            })
                          }
                          className="w-12 bg-[#111c2e] border border-[#334d6e] rounded text-center py-1 text-xs font-bold text-white outline-none focus:border-purple-400"
                        />
                      </td>
                      {/* Precio Unitario (Sin IVA) + Subtexto con IVA */}
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          min="0"
                          disabled={isReadOnly}
                          value={item.offeredUnitPrice}
                          onChange={(e) =>
                            onUpdateTenderItem(activeClient.id, item.id, {
                              offeredUnitPrice: Math.max(0, parseInt(e.target.value) || 0),
                            })
                          }
                          className="w-24 bg-[#111c2e] border border-[#334d6e] rounded text-right py-0.5 px-1.5 text-xs text-white font-mono font-bold outline-none focus:border-purple-400"
                        />
                        <div className="text-[10px] text-emerald-400 font-mono mt-0.5 whitespace-nowrap" title="Precio unitario con IVA incluido">
                          c/IVA: <span className="font-semibold">{formatCOP(unitConIVA)}</span>
                        </div>
                      </td>
                      {/* Subtotal sin IVA */}
                      <td className="p-2.5 text-right font-mono font-semibold text-slate-200 whitespace-nowrap">
                        {formatCOP(rowSubtotalSinIVA)}
                      </td>
                      {/* Total con IVA */}
                      <td className="p-2.5 text-right font-mono font-bold text-emerald-300 whitespace-nowrap bg-emerald-950/10">
                        {formatCOP(rowTotalConIVA)}
                      </td>
                      {/* Especificaciones */}
                      <td className="p-2.5 text-center">
                        <button
                          type="button"
                          onClick={() => onSwitchToSpecificationsTab(item.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-300 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 px-2 py-0.5 rounded-lg transition cursor-pointer"
                          title="Ver y configurar especificaciones técnicas de este equipo"
                        >
                          <span>{itemSpecsCount} Specs</span>
                          {itemUniqueCount > 0 && (
                            <span className="inline-flex items-center text-amber-300 font-bold gap-0.5">
                              <ShieldCheck className="w-2.5 h-2.5 text-amber-400" />
                              <span>{itemUniqueCount}</span>
                            </span>
                          )}
                        </button>
                      </td>
                      {/* Acciones */}
                      <td className="p-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => onSwitchToSpecificationsTab(item.id)}
                            className="p-1 rounded-lg text-purple-300 hover:text-white bg-purple-500/15 hover:bg-purple-500/25 transition cursor-pointer"
                            title="Editar especificaciones técnicas de este equipo"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => onDeleteTenderItem(activeClient.id, item.id)}
                              className="p-1 rounded-lg text-rose-400 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 transition cursor-pointer"
                              title="Eliminar este equipo del contrato"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                }))}
              </tbody>
              {/* Table Footer with Summary */}
              <tfoot className="bg-[#101c2d] border-t-2 border-[#334d6e] text-xs font-bold">
                <tr>
                  <td colSpan={4} className="p-3 text-right text-slate-300">
                    TOTALES GENERALES DEL CONTRATO ({items.length} ítems):
                  </td>
                  <td className="p-3 text-center text-purple-300 font-mono">
                    {totalUnits} ud
                  </td>
                  <td className="p-3 text-right text-slate-400 text-[11px]">
                    Subtotal s/IVA:
                  </td>
                  <td className="p-3 text-right text-slate-100 font-mono">
                    {formatCOP(totalSubtotalCOP)}
                  </td>
                  <td className="p-3 text-right text-emerald-300 font-mono text-sm bg-emerald-950/20">
                    {formatCOP(grandTotalCOP)}
                  </td>
                  <td colSpan={2} className="p-3 text-right text-[11px] text-amber-300/90 font-mono">
                    IVA 19%: {formatCOP(totalIvaCOP)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
