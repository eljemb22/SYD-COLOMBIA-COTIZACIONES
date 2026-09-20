import React, { useMemo } from 'react';
import {
  Clock,
  CreditCard,
  DollarSign,
  Edit3,
  History,
  Tag,
  Trash2,
  Activity,
  AlertTriangle,
  RotateCcw,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import {
  OCTrackingItem,
  OCStatus,
  OCPaymentTerms,
  OCPaymentStatus,
  AuthUser,
} from '../../../types';
import {
  PAYMENT_TERMS_OPTIONS,
  PAYMENT_STATUS_OPTIONS,
  OC_STATUS_OPTIONS,
} from '../../../utils/ocTrackingStorage';
import {
  ExcelColumnConfig,
  ExcelColumnHeader,
  useExcelTableFilters,
} from '../../common/ExcelTableFilter';

export interface FlatItemRow {
  contractId: string;
  contractNumber: string;
  clientName: string;
  city: string;
  item: OCTrackingItem;
}

interface MasterTableViewProps {
  flatItems: FlatItemRow[];
  onOpenEditItem: (contractId: string, item: OCTrackingItem) => void;
  onOpenSerialsModal?: (contractId: string, item: OCTrackingItem) => void;
  onOpenHistory: (contractName: string, item: OCTrackingItem) => void;
  onQuickChangeItemStatus: (contractId: string, itemId: string, newStatus: OCStatus) => void;
  onQuickChangeItemPaymentTerms: (contractId: string, itemId: string, terms: OCPaymentTerms) => void;
  onRequestDeleteItem: (contractId: string, item: OCTrackingItem) => void;
  currentUser?: AuthUser | null;
}

const MASTER_TABLE_COLUMNS: ExcelColumnConfig<FlatItemRow>[] = [
  {
    id: 'ocNumber',
    label: 'N° OC Proveedor',
    accessor: (r) => r.item.ocNumber || 'Sin OC',
    type: 'text',
  },
  {
    id: 'supplier',
    label: 'Proveedor / Fabricante',
    accessor: (r) => r.item.supplier || 'Sin Proveedor',
    type: 'text',
  },
  {
    id: 'contractClient',
    label: 'Contrato / Cliente',
    accessor: (r) => `${r.clientName} (${r.contractNumber})`,
    type: 'text',
  },
  {
    id: 'equipment',
    label: 'Equipo Médico',
    accessor: (r) => `${r.item.name} - ${r.item.brand} ${r.item.model}`,
    type: 'text',
  },
  {
    id: 'quantity',
    label: 'Cant.',
    accessor: (r) => r.item.quantity || 1,
    type: 'number',
    align: 'center',
  },
  {
    id: 'totalCostCOP',
    label: 'Costo Total COP',
    accessor: (r) => r.item.totalCostCOP || 0,
    type: 'number',
    formatter: (v) => `$${Number(v).toLocaleString('es-CO')}`,
    align: 'right',
  },
  {
    id: 'paymentTerms',
    label: 'Forma de Pago',
    accessor: (r) => r.item.paymentTerms || 'Crédito 30 días',
    type: 'enum',
  },
  {
    id: 'ocStatus',
    label: 'Estado de la OC',
    accessor: (r) => r.item.status,
    type: 'enum',
  },
  {
    id: 'alert',
    label: 'Alerta 48h',
    accessor: (r) => {
      const lastUpdate = new Date(r.item.lastUpdatedAt || r.item.createdAt).getTime();
      const hoursSinceUpdate = (Date.now() - lastUpdate) / (1000 * 60 * 60);
      const isAlert =
        hoursSinceUpdate > 48 &&
        r.item.status !== 'Entregado e Instalado' &&
        r.item.status !== 'Cerrado / Concluido' &&
        r.item.status !== 'Cancelada';
      return isAlert ? '⚠️ Con Alerta (+48h)' : '✅ Al día';
    },
    type: 'enum',
    align: 'center',
  },
];

export const MasterTableView: React.FC<MasterTableViewProps> = ({
  flatItems,
  onOpenEditItem,
  onOpenSerialsModal,
  onOpenHistory,
  onQuickChangeItemStatus,
  onQuickChangeItemPaymentTerms,
  onRequestDeleteItem,
  currentUser,
}) => {
  const isReadOnly = currentUser?.role === 'viewer' && !currentUser?.permissions?.canManageOCTracking;

  const {
    filteredRows,
    filters,
    sort,
    onApplyFilter,
    onApplySort,
    onClearColumnFilter,
    onResetAllFilters,
    isFilteredOrSorted,
    activeFiltersCount,
  } = useExcelTableFilters(flatItems, MASTER_TABLE_COLUMNS);

  const getPaymentTermsBadgeClass = (terms?: string) => {
    const found = PAYMENT_TERMS_OPTIONS.find((p) => p.terms === terms);
    return found ? found.badgeColor : 'bg-slate-500/20 text-slate-300 border-slate-500/40';
  };

  const getOCStatusBadgeClass = (status?: string) => {
    const found = OC_STATUS_OPTIONS.find((s) => s.status === status);
    return found ? found.badgeColor : 'bg-slate-500/20 text-slate-300 border-slate-500/40';
  };

  return (
    <div className="bg-[#15253d] border border-[#334d6e] rounded-2xl shadow-xl overflow-hidden">
      <div className="p-3.5 bg-[#142338] border-b border-[#334d6e] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-sky-400" />
          <span className="text-xs font-bold text-white">
            Tabla Maestra Consolidada — <strong className="text-sky-300">{filteredRows.length} Equipos</strong>
            {filteredRows.length !== flatItems.length && (
              <span className="text-slate-400 font-normal ml-1">({flatItems.length} total)</span>
            )}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isFilteredOrSorted && (
            <button
              type="button"
              onClick={onResetAllFilters}
              className="inline-flex items-center gap-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl px-3 py-1 text-xs font-bold transition cursor-pointer active:scale-95 shadow-xs"
              title="Restablecer todos los filtros tipo Excel aplicados"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Limpiar Todos los Filtros ({activeFiltersCount})</span>
            </button>
          )}
          <span className="text-[11px] text-slate-400">
            Filtros y ordenamiento tipo Excel en cada columna
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#0e1726] text-slate-300 border-b border-[#243a56] text-[10.5px] font-bold">
              <th className="py-2.5 px-3 min-w-[140px]">
                <ExcelColumnHeader
                  column={MASTER_TABLE_COLUMNS[0]}
                  allRows={flatItems}
                  filters={filters}
                  sort={sort}
                  onApplyFilter={onApplyFilter}
                  onApplySort={onApplySort}
                  onClearColumnFilter={onClearColumnFilter}
                />
              </th>
              <th className="py-2.5 px-3 min-w-[170px]">
                <ExcelColumnHeader
                  column={MASTER_TABLE_COLUMNS[1]}
                  allRows={flatItems}
                  filters={filters}
                  sort={sort}
                  onApplyFilter={onApplyFilter}
                  onApplySort={onApplySort}
                  onClearColumnFilter={onClearColumnFilter}
                />
              </th>
              <th className="py-2.5 px-3 min-w-[210px]">
                <ExcelColumnHeader
                  column={MASTER_TABLE_COLUMNS[2]}
                  allRows={flatItems}
                  filters={filters}
                  sort={sort}
                  onApplyFilter={onApplyFilter}
                  onApplySort={onApplySort}
                  onClearColumnFilter={onClearColumnFilter}
                />
              </th>
              <th className="py-2.5 px-3 min-w-[240px]">
                <ExcelColumnHeader
                  column={MASTER_TABLE_COLUMNS[3]}
                  allRows={flatItems}
                  filters={filters}
                  sort={sort}
                  onApplyFilter={onApplyFilter}
                  onApplySort={onApplySort}
                  onClearColumnFilter={onClearColumnFilter}
                />
              </th>
              <th className="py-2.5 px-3 w-20 text-center">
                <ExcelColumnHeader
                  column={MASTER_TABLE_COLUMNS[4]}
                  allRows={flatItems}
                  filters={filters}
                  sort={sort}
                  onApplyFilter={onApplyFilter}
                  onApplySort={onApplySort}
                  onClearColumnFilter={onClearColumnFilter}
                />
              </th>
              <th className="py-2.5 px-3 min-w-[140px] text-right">
                <ExcelColumnHeader
                  column={MASTER_TABLE_COLUMNS[5]}
                  allRows={flatItems}
                  filters={filters}
                  sort={sort}
                  onApplyFilter={onApplyFilter}
                  onApplySort={onApplySort}
                  onClearColumnFilter={onClearColumnFilter}
                />
              </th>
              <th className="py-2.5 px-3 min-w-[170px]">
                <ExcelColumnHeader
                  column={MASTER_TABLE_COLUMNS[6]}
                  allRows={flatItems}
                  filters={filters}
                  sort={sort}
                  onApplyFilter={onApplyFilter}
                  onApplySort={onApplySort}
                  onClearColumnFilter={onClearColumnFilter}
                />
              </th>
              <th className="py-2.5 px-3 min-w-[180px]">
                <ExcelColumnHeader
                  column={MASTER_TABLE_COLUMNS[7]}
                  allRows={flatItems}
                  filters={filters}
                  sort={sort}
                  onApplyFilter={onApplyFilter}
                  onApplySort={onApplySort}
                  onClearColumnFilter={onClearColumnFilter}
                />
              </th>
              <th className="py-2.5 px-3 min-w-[120px] text-center">
                <ExcelColumnHeader
                  column={MASTER_TABLE_COLUMNS[8]}
                  allRows={flatItems}
                  filters={filters}
                  sort={sort}
                  onApplyFilter={onApplyFilter}
                  onApplySort={onApplySort}
                  onClearColumnFilter={onClearColumnFilter}
                />
              </th>
              <th className="py-2.5 px-3 w-28 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1b2d46]">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <p className="text-sm font-bold text-white">No se encontraron equipos con los filtros tipo Excel aplicados</p>
                    {isFilteredOrSorted && (
                      <button
                        type="button"
                        onClick={onResetAllFilters}
                        className="inline-flex items-center gap-1.5 bg-[#1e314b] hover:bg-[#253d5e] text-sky-300 border border-sky-400/40 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restablecer Filtros</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredRows.map(({ contractId, contractNumber, clientName, item }) => {
                const lastUpdate = new Date(item.lastUpdatedAt || item.createdAt).getTime();
                const hoursSinceUpdate = (Date.now() - lastUpdate) / (1000 * 60 * 60);
                const isAlert =
                  hoursSinceUpdate > 48 &&
                  item.status !== 'Entregado e Instalado' &&
                  item.status !== 'Cerrado / Concluido' &&
                  item.status !== 'Cancelada';

                return (
                  <tr key={item.id} className="hover:bg-[#182a44] transition">
                    <td className="py-2.5 px-3">
                      <span className="font-mono text-xs font-bold text-sky-300 bg-sky-950 px-2 py-0.5 rounded border border-sky-500/40">
                        {item.ocNumber || 'Sin OC'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white">
                      {item.supplier || 'Sin Proveedor'}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-200">{clientName}</div>
                      <div className="text-[10px] text-purple-300 font-mono">{contractNumber}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-white">{item.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {item.brand} • {item.model}
                      </div>
                      {onOpenSerialsModal && (
                        <div className="mt-1">
                          {(() => {
                            const serialsCount =
                              item.serialNumbers?.filter(
                                (s) => s.serialNumber && s.serialNumber.trim().length > 0
                              ).length || 0;
                            const isSerialsComplete =
                              serialsCount >= (item.quantity || 1);

                            return (
                              <button
                                type="button"
                                onClick={() => onOpenSerialsModal(contractId, item)}
                                className={`inline-flex items-center gap-1 text-[9.5px] font-bold px-1.5 py-0.5 rounded border transition cursor-pointer ${
                                  isSerialsComplete
                                    ? 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border-emerald-500/50'
                                    : serialsCount > 0
                                    ? 'bg-amber-950/80 hover:bg-amber-900 text-amber-300 border-amber-500/50'
                                    : 'bg-purple-950/80 hover:bg-purple-900 text-purple-300 border-purple-500/40'
                                }`}
                                title="Gestionar seriales, declaración DIAN y dossier hospitalario"
                              >
                                <Tag className="w-2.5 h-2.5" />
                                <span>Seriales ({serialsCount}/{item.quantity})</span>
                              </button>
                            );
                          })()}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-white">
                      {item.quantity}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-400 font-mono">
                      ${item.totalCostCOP?.toLocaleString('es-CO')}
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        disabled={isReadOnly}
                        value={item.paymentTerms || 'Crédito 30 días'}
                        onChange={(e) =>
                          onQuickChangeItemPaymentTerms(
                            contractId,
                            item.id,
                            e.target.value as OCPaymentTerms
                          )
                        }
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border outline-none ${isReadOnly ? 'cursor-default opacity-85' : 'cursor-pointer'} w-full ${getPaymentTermsBadgeClass(
                          item.paymentTerms
                        )}`}
                      >
                        {PAYMENT_TERMS_OPTIONS.map((p) => (
                          <option key={p.terms} value={p.terms} className="bg-[#192b45] text-white">
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        disabled={isReadOnly}
                        value={item.status}
                        onChange={(e) =>
                          onQuickChangeItemStatus(contractId, item.id, e.target.value as OCStatus)
                        }
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border outline-none ${isReadOnly ? 'cursor-default opacity-85' : 'cursor-pointer'} w-full ${getOCStatusBadgeClass(
                          item.status
                        )}`}
                      >
                        {OC_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.status} value={opt.status} className="bg-[#192b45] text-white">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {isAlert ? (
                        <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                          <AlertTriangle className="w-3 h-3" />
                          <span>{Math.floor(hoursSinceUpdate / 24)}d</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-400 font-mono">Al día</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => onOpenEditItem(contractId, item)}
                            className="p-1.5 rounded-lg bg-[#1b2d46] hover:bg-[#253f63] text-slate-300 hover:text-white"
                            title="Editar"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                          </button>
                        )}
                        {onOpenSerialsModal && (
                          <button
                            type="button"
                            onClick={() => onOpenSerialsModal(contractId, item)}
                            className="p-1.5 rounded-lg bg-purple-950/60 hover:bg-purple-900/80 text-purple-300 hover:text-white border border-purple-500/40"
                            title="Seriales, Declaración DIAN y Dossier Hospitalario"
                          >
                            <Tag className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onOpenHistory(`${contractNumber} - ${item.supplier}`, item)}
                          className="p-1.5 rounded-lg bg-[#1b2d46] hover:bg-[#253f63] text-slate-300 hover:text-white"
                          title="Historial"
                        >
                          <History className="w-3.5 h-3.5 text-purple-400" />
                        </button>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => onRequestDeleteItem(contractId, item)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                            title="Eliminar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
